// functions/api/image/index.js
import { getSession, requireAuth, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResponse({ error: 'POST만 허용됩니다.' }, 405);

  const session = await getSession(request, env);
  const authError = requireAuth(session);
  if (authError) return authError;

  try {
    const { keyword, tool_type, style, post_id } = await request.json();

    if (!keyword) return jsonResponse({ error: '키워드가 필요합니다.' }, 400);

    // 사용자 설정 가져오기
    const settings = await env.DB.prepare(
      'SELECT gemini_api_key, worker_url FROM user_settings WHERE user_id = ?'
    ).bind(session.user.id).first();

    if (!settings?.worker_url) {
      return jsonResponse({ error: 'Cloudflare Worker URL이 설정되지 않았습니다. 설정에서 입력해주세요.' }, 400);
    }

    if (!settings?.gemini_api_key) {
      return jsonResponse({ error: 'Gemini API 키가 설정되지 않았습니다.' }, 400);
    }

    const imageStyle = style || 'poster';

    // STEP 1: Gemini로 이미지 프롬프트 생성
    const promptRes = await generateImagePrompt(keyword, imageStyle, tool_type, settings.gemini_api_key);
    if (!promptRes.success) {
      return jsonResponse({ error: '프롬프트 생성 실패: ' + promptRes.error }, 500);
    }

    // STEP 2: Cloudflare Worker로 이미지 생성
    const workerUrl = settings.worker_url.replace(/\/$/, '');
    const imageRes = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptRes.prompt,
        neg_prompt: promptRes.neg_prompt,
        topic: keyword,
        style: imageStyle,
        width: 1200,
        height: 630
      })
    });

    if (!imageRes.ok) {
      const errText = await imageRes.text().catch(() => imageRes.status.toString());
      return jsonResponse({ error: 'Worker 이미지 생성 실패: ' + errText }, 500);
    }

    const imageData = await imageRes.json();
    
    // Worker 응답 형식 처리 (다양한 형식 지원)
    let imageUrl = imageData?.url || imageData?.data_url || imageData?.image_url || '';
    
    if (!imageUrl) {
      return jsonResponse({ error: 'Worker에서 이미지 URL을 받지 못했습니다.' }, 500);
    }

    // post_id가 있으면 DB 업데이트
    if (post_id) {
      await env.DB.prepare(
        'UPDATE generated_posts SET image_url = ? WHERE id = ? AND user_id = ?'
      ).bind(imageUrl, post_id, session.user.id).run().catch(() => {});
    }

    // 사용량 로그
    await env.DB.prepare(
      'INSERT INTO usage_logs (user_id, tool_type, action) VALUES (?, ?, ?)'
    ).bind(session.user.id, tool_type || 'unknown', 'image').run().catch(() => {});

    return jsonResponse({
      ok: true,
      image_url: imageUrl,
      prompt: promptRes.prompt,
      style: imageStyle
    });

  } catch (e) {
    return jsonResponse({ error: '이미지 생성 오류: ' + e.message }, 500);
  }
}

async function generateImagePrompt(keyword, style, toolType, apiKey) {
  const styleDescriptions = {
    poster: 'bold poster design, strong typography, vivid colors',
    minimal: 'minimalist design, clean lines, white space, elegant typography',
    photo_realistic: 'photo realistic, high quality photography, professional lighting, 4K',
    typography: 'typography-focused, text art, creative lettering, bold fonts',
    branding: 'professional branding, corporate design, modern business style'
  };

  const styleDesc = styleDescriptions[style] || styleDescriptions.poster;
  
  const toolContexts = {
    affiliate: 'e-commerce product review, shopping, consumer goods',
    naver_seo: 'Korean blog, lifestyle, information content',
    google_seo: 'professional blog, SEO optimized content',
    policy: 'government service, official announcement, public information',
    referral: 'referral program, app promotion, marketing',
    adsense: 'blog content, lifestyle, engaging visual'
  };
  
  const toolContext = toolContexts[toolType] || 'blog content';

  const promptText = `Generate an English image generation prompt for a blog thumbnail.
Topic: ${keyword}
Style: ${styleDesc}
Context: ${toolContext}

Return ONLY a JSON object (no markdown):
{
  "prompt": "detailed image generation prompt in English, 50-80 words",
  "neg_prompt": "negative prompt: items to avoid"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { maxOutputTokens: 256, temperature: 0.7 }
        })
      }
    );

    if (!res.ok) return { success: false, error: 'Gemini API error' };
    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return { success: true, prompt: parsed.prompt, neg_prompt: parsed.neg_prompt };
    }
    
    // 폴백: 기본 프롬프트
    return {
      success: true,
      prompt: `High quality blog thumbnail for ${keyword}, ${styleDesc}, professional design, Korean blog style`,
      neg_prompt: 'text, watermark, blurry, low quality, distorted'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
