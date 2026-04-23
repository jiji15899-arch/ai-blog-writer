// functions/api/schema/index.js
import { getSession, requireAuth, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResponse({ error: 'POST만 허용됩니다.' }, 405);

  const session = await getSession(request, env);
  const authError = requireAuth(session);
  if (authError) return authError;

  try {
    const { content, keyword, tool_type, schema_types, post_id } = await request.json();

    // 사용자 Gemini API 키 가져오기
    const settings = await env.DB.prepare(
      'SELECT gemini_api_key FROM user_settings WHERE user_id = ?'
    ).bind(session.user.id).first();

    if (!settings?.gemini_api_key) {
      return jsonResponse({ error: 'Gemini API 키가 설정되지 않았습니다.' }, 400);
    }

    // 요청된 스키마 타입들 처리
    const types = schema_types || getDefaultSchemaTypes(tool_type);
    const generatedSchemas = [];

    for (const schemaType of types) {
      const schema = await generateSchemaMarkup(
        schemaType, content, keyword, tool_type, settings.gemini_api_key
      );
      if (schema) generatedSchemas.push({ type: schemaType, json: schema });
    }

    // DB에 스키마 저장
    if (post_id && generatedSchemas.length > 0) {
      const schemaJson = JSON.stringify(generatedSchemas);
      await env.DB.prepare(
        'UPDATE generated_posts SET schema_markup = ? WHERE id = ? AND user_id = ?'
      ).bind(schemaJson, post_id, session.user.id).run().catch(() => {});
    }

    return jsonResponse({ ok: true, schemas: generatedSchemas });

  } catch (e) {
    return jsonResponse({ error: '스키마 생성 오류: ' + e.message }, 500);
  }
}

function getDefaultSchemaTypes(toolType) {
  const defaults = {
    affiliate:  ['Article', 'Product'],
    naver_seo:  ['Article', 'FAQ'],
    google_seo: ['Article', 'FAQ', 'HowTo'],
    policy:     ['Article', 'FAQ', 'GovernmentService'],
    referral:   ['Article', 'Product'],
    adsense:    ['Article', 'FAQ']
  };
  return defaults[toolType] || ['Article'];
}

async function generateSchemaMarkup(schemaType, content, keyword, toolType, apiKey) {
  const truncatedContent = (content || '').substring(0, 2000);
  
  const schemaPrompts = {
    Article: `다음 블로그 글 내용을 분석하여 Google Schema.org Article 스키마 마크업 JSON-LD를 생성하세요.
키워드: ${keyword}
내용 일부: ${truncatedContent}

반드시 아래 JSON 형식만 반환하세요 (마크다운, 설명 없이):
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "글 제목",
  "description": "글 설명 150자 이내",
  "keywords": "키워드1, 키워드2, 키워드3",
  "author": { "@type": "Person", "name": "블로그 작성자" },
  "datePublished": "${new Date().toISOString().split('T')[0]}",
  "dateModified": "${new Date().toISOString().split('T')[0]}",
  "inLanguage": "ko-KR"
}`,

    FAQ: `다음 블로그 글 내용을 분석하여 Google Schema.org FAQPage 스키마 마크업 JSON-LD를 생성하세요.
키워드: ${keyword}
내용: ${truncatedContent}

반드시 아래 JSON 형식만 반환하세요 (3~5개 Q&A):
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "질문1",
      "acceptedAnswer": { "@type": "Answer", "text": "답변1" }
    }
  ]
}`,

    HowTo: `다음 블로그 글 내용을 분석하여 Google Schema.org HowTo 스키마 마크업 JSON-LD를 생성하세요.
키워드: ${keyword}
내용: ${truncatedContent}

반드시 아래 JSON 형식만 반환하세요:
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "방법 제목",
  "description": "설명",
  "step": [
    { "@type": "HowToStep", "name": "단계1", "text": "단계1 설명" }
  ]
}`,

    Product: `다음 블로그 글 내용을 분석하여 Google Schema.org Product 스키마 마크업 JSON-LD를 생성하세요.
키워드: ${keyword}
내용: ${truncatedContent}

반드시 아래 JSON 형식만 반환하세요:
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "제품명",
  "description": "제품 설명",
  "brand": { "@type": "Brand", "name": "브랜드명" },
  "review": {
    "@type": "Review",
    "reviewRating": { "@type": "Rating", "ratingValue": "4.5", "bestRating": "5" },
    "author": { "@type": "Person", "name": "작성자" }
  }
}`,

    GovernmentService: `다음 정책/지원금 블로그 내용을 분석하여 Schema.org 스키마 JSON-LD를 생성하세요.
키워드: ${keyword}
내용: ${truncatedContent}

반드시 아래 JSON 형식만 반환하세요:
{
  "@context": "https://schema.org",
  "@type": "GovernmentService",
  "name": "서비스명",
  "description": "서비스 설명",
  "provider": { "@type": "GovernmentOrganization", "name": "제공 기관" },
  "serviceType": "정부 지원금",
  "areaServed": { "@type": "Country", "name": "대한민국" }
}`
  };

  const promptText = schemaPrompts[schemaType] || schemaPrompts.Article;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
        })
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // JSON 추출
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      JSON.parse(jsonMatch[0]); // 유효성 검사
      return jsonMatch[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}
