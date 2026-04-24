// functions/api/generate/index.js
import { getSession, requireAuth, jsonResponse } from '../../_utils/auth.js';

// 6개 툴 시스템 프롬프트
const SYSTEM_PROMPTS = {
  affiliate: `당신은 제휴 마케팅 전문 블로그 작가입니다. 애드릭스, 쿠파스, 텐핑 등 제휴 마케팅 플랫폼에 최적화된 고수익 블로그 글을 작성합니다.

[작성 원칙]
1. 제목: 클릭을 유도하는 숫자/감성/혜택 키워드 포함 (예: "솔직 후기", "써봤어요", "직접 비교")
2. 도입부: 독자의 고민/문제를 공감하며 시작 (3~5문장)
3. 본문 구성:
   - 제품/서비스 소개 (특징 3가지 이상)
   - 장단점 솔직 비교 (신뢰도 UP)
   - 실제 사용 경험담 형식 (1인칭)
   - 가격/혜택 정보 (구체적 수치 포함)
4. CTA(행동 유도): 자연스럽게 제휴 링크 클릭 유도 문구 삽입
5. 마무리: 요약 + 추천 대상 명시
6. 분량: 1500~2500자
7. 키워드: 제목/소제목/본문에 자연스럽게 3~5회 반복
8. 면책 문구: 글 하단에 "이 글은 제휴 마케팅을 포함합니다" 자동 삽입
9. SEO: 소제목(H2/H3) 3~5개, 리스트 활용, 굵은 글씨로 핵심어 강조

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 실제 블로그에 바로 올릴 수 있는 수준으로 작성하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`,

  naver_seo: `당신은 네이버 검색 알고리즘 C-Rank와 D.I.A+ 전문가입니다. 네이버 블로그 상위노출과 애드센스(네이버 애드포스트) 수익 극대화에 최적화된 글을 작성합니다.

[네이버 상위노출 최적화 원칙]
1. 제목 공식: [메인키워드] + 부가설명 (20~35자, 키워드 앞쪽 배치)
2. 도입부: 키워드 자연스럽게 2회 이내 포함, 독자 공감 유도 (200~300자)
3. 본문 구조 (D.I.A+ 충족): 정보성/경험성/신뢰성/가독성
4. 키워드 밀도: 메인 키워드 1~2%, 관련 키워드(LSI) 3~5개 자연 삽입
5. 분량: 2000~3000자
6. 태그 추천: 글 하단에 네이버 블로그 태그 10개 제안
7. 이미지 배치 안내: [이미지 삽입 권장 위치] 명시
8. 체류시간 UP: 표, 리스트, Q&A 섹션 포함
9. 공감/댓글 유도 마무리 문구 포함

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 네이버 블로그에 바로 활용 가능한 완성형 글을 작성하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`,

  google_seo: `당신은 Google E-E-A-T(경험, 전문성, 권위성, 신뢰성) 기반 SEO 전문 콘텐츠 작가입니다. 구글 애드센스 수익과 검색 상위노출을 동시에 달성하는 블로그 글을 작성합니다.

[구글 SEO 최적화 원칙]
1. 제목(H1): 메인 키워드 포함, 50~60자 이내, 검색의도 반영
2. 메타 디스크립션: 키워드 포함 150~160자 요약 (글 상단에 별도 표시)
3. E-E-A-T 완벽 충족 (경험/전문성/권위/신뢰)
4. 구조: 서론(결론 먼저) → H2 4~6개 → H3 → 표/리스트/FAQ
5. 분량: 2500~4000자
6. FAQ 섹션: 구글 People Also Ask 노린 3~5개 Q&A
7. 스키마 마크업 제안 (FAQ, How-to 등)

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 완성형 글을 작성하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`,

  policy: `당신은 정부 정책, 지원금, 복지 혜택 전문 블로그 작가입니다. 복잡한 정책 정보를 일반인이 쉽게 이해하고 바로 신청할 수 있도록 안내하는 글을 작성합니다.

[정책/지원금 블로그 작성 원칙]
1. 제목: "2025년 [지원금명] 신청방법 총정리" 형식
2. 핵심 요약 박스: ✅ 지원 대상, 💰 지원 금액, 📅 신청 기간, 🔗 신청 방법 4가지
3. 본문: 개요 → 지원 대상(리스트) → 지원 내용/금액(표) → 신청 방법(STEP) → 필요 서류 → Q&A
4. 언어: 쉬운 말로 풀어쓰기, 공문서 용어 설명 필수
5. CTA: "지금 바로 신청하세요" + 공식 신청 링크 안내 문구
6. 분량: 2000~3000자
7. 면책 고지: "본 글은 정보 제공 목적이며, 정확한 내용은 공식 기관에서 확인하세요"

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 작성하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`,

  referral: `당신은 서비스 추천인 코드/링크를 활용한 바이럴 마케팅 블로그 전문가입니다.

[서비스 추천인 유도 블로그 작성 원칙]
1. 제목: "[서비스명] 추천인 코드/가입 혜택 총정리 (최대 X원 할인)" 형식
2. 추천인 혜택 극대화 구조: 추천인+신규가입자 양쪽 혜택, 단계별 가입 방법, 코드 입력 위치
3. 신뢰도 구축: 실제 사용자 경험 1인칭, 장단점 솔직 언급
4. CTA 전략: 본문 중간 1회 + 결론 1회 = 총 2회 추천 링크 유도
5. 추천인 코드 강조: 굵은 글씨 + 별도 박스로 시각화
6. 분량: 2000~2800자

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 작성하고, 추천인 코드 [코드입력] 플레이스홀더를 포함하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`,

  adsense: `당신은 구글 애드센스 승인 전문가입니다. 애드센스 심사를 통과하는 독창적이고 경험 기반의 고품질 블로그 글을 작성합니다.

[애드센스 승인 최적화 원칙]
1. 독창성: 완전히 새로운 표현, 주관적 시각 + 객관적 정보의 조화
2. E-E-A-T 완벽 충족: 1인칭 경험담, 전문 지식, 신뢰할 수 있는 출처
3. 애드센스 친화적 구조: 가족 친화적 콘텐츠, 광고 게재 적합 위치
4. 글 구조: 제목(H1) → 도입부(경험으로 시작) → H2 5~7개 → 중간 요약 → FAQ 3개 → 결론
5. 분량: 2500~3500자
6. 실제 경험처럼 느껴지는 자연스러운 1인칭 서술 필수

반드시 HTML 형식으로 출력하고, 마크다운은 절대 사용하지 마세요. h1, h2, h3, p, ul, li, strong, em, table, blockquote 등 HTML 태그를 사용하여 완성도 높은 독창적 글을 작성하세요. html, head, body 태그는 포함하지 말고 본문 콘텐츠 태그만 출력하세요.`
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return jsonResponse({ error: 'POST만 허용됩니다.' }, 405);

  const session = await getSession(request, env);
  const authError = requireAuth(session);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { tool_type, prompt_data } = body;

    if (!tool_type || !SYSTEM_PROMPTS[tool_type]) {
      return jsonResponse({ error: '잘못된 툴 타입입니다.' }, 400);
    }

    // 사용자 Gemini API 키 가져오기
    const settings = await env.DB.prepare(
      'SELECT gemini_api_key FROM user_settings WHERE user_id = ?'
    ).bind(session.user.id).first();

    if (!settings?.gemini_api_key) {
      return jsonResponse({ error: 'Gemini API 키가 설정되지 않았습니다. 설정에서 입력해주세요.' }, 400);
    }

    // 사용자 메시지 생성
    const userMessage = buildUserMessage(tool_type, prompt_data);

    // Gemini API 호출
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.gemini_api_key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPTS[tool_type] }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.8 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}));
      return jsonResponse({ error: 'Gemini API 오류: ' + (errData?.error?.message || geminiRes.status) }, 500);
    }

    const geminiData = await geminiRes.json();
    const content = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!content) return jsonResponse({ error: 'AI 응답이 비어있습니다.' }, 500);

    // 사용량 로그 기록
    const tokensUsed = geminiData?.usageMetadata?.totalTokenCount || 0;
    await env.DB.prepare(
      'INSERT INTO usage_logs (user_id, tool_type, action, tokens_used) VALUES (?, ?, ?, ?)'
    ).bind(session.user.id, tool_type, 'generate', tokensUsed).run().catch(() => {});

    // 생성된 글 저장
    const keyword = prompt_data?.keyword || prompt_data?.topic || prompt_data?.policy_name || prompt_data?.service || '';
    const wordCount = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length;
    
    const insertResult = await env.DB.prepare(
      'INSERT INTO generated_posts (user_id, tool_type, keyword, content, word_count) VALUES (?, ?, ?, ?, ?)'
    ).bind(session.user.id, tool_type, keyword, content, wordCount).run();

    return jsonResponse({
      ok: true,
      content,
      post_id: insertResult.meta?.last_row_id,
      word_count: wordCount,
      tokens_used: tokensUsed
    });

  } catch (e) {
    return jsonResponse({ error: '서버 오류: ' + e.message }, 500);
  }
}

function buildUserMessage(toolType, data) {
  const { keyword, product, platform, target, sub, category, tone, intent, length,
          policyName, policyType, deadline, amount, service, referralCode,
          benefitMe, benefitNew, topic, experience, angle, secondary } = data || {};

  switch (toolType) {
    case 'affiliate':
      return `제휴 마케팅 블로그 글을 작성해주세요.
- 플랫폼: ${platform || '애드릭스'}
- 메인 키워드: ${keyword}
- 제품/서비스명: ${product}
- 타겟 독자: ${target || '일반 소비자'}
위 정보를 바탕으로 클릭률과 전환율이 높은 제휴 마케팅 블로그 글을 작성하세요.`;

    case 'naver_seo':
      return `네이버 블로그 상위노출 최적화 글을 작성해주세요.
- 메인 키워드: ${keyword}
- 서브 키워드: ${sub || '없음'}
- 카테고리: ${category || '정보/리뷰'}
- 문체/톤: ${tone || '친근한'}
D.I.A+ 알고리즘 기준을 충족하는 고품질 블로그 글을 작성하세요.`;

    case 'google_seo':
      return `구글 SEO 최적화 블로그 글을 작성해주세요.
- Primary Keyword: ${keyword}
- Secondary Keywords: ${secondary || '없음'}
- 검색 의도: ${intent || '정보 탐색형'}
- 목표 분량: ${length || '표준 (2500자)'}
E-E-A-T 기준을 완벽히 충족하고, Featured Snippet과 People Also Ask를 노린 구조로 작성하세요.`;

    case 'policy':
      return `정책/지원금 안내 블로그 글을 작성해주세요.
- 정책/지원금명: ${policyName}
- 유형: ${policyType || '청년 지원금'}
- 지원 대상: ${target || '일반적인 대상으로 작성'}
- 지원 금액: ${amount || '일반적인 금액으로 작성'}
- 신청 기한: ${deadline || '미입력'}
독자가 바로 신청할 수 있도록 핵심 요약과 단계별 안내를 포함한 완성형 글을 작성하세요.`;

    case 'referral':
      return `서비스 추천인 유도 블로그 글을 작성해주세요.
- 서비스명: ${service}
- 카테고리: ${category || '핀테크/투자 앱'}
- 추천인 코드: ${referralCode || '[코드를 여기 입력]'}
- 추천인 혜택 (나): ${benefitMe || '일반적인 추천인 혜택으로 작성'}
- 신규 가입자 혜택: ${benefitNew || '일반적인 신규 혜택으로 작성'}
구글+네이버 동시 상위노출과 추천인 코드 클릭 전환율을 극대화하는 글을 작성하세요.`;

    case 'adsense':
      return `애드센스 승인용 고품질 블로그 글을 작성해주세요.
- 주제: ${topic}
- 카테고리: ${category || '여행/맛집'}
- 개인 경험/배경: ${experience || '일반적인 사용자 경험으로 작성해주세요'}
- 글 형식: ${angle || '경험 후기형'}
애드센스 심사를 반드시 통과할 수 있는 독창적이고 경험이 풍부한 완성형 글을 작성하세요.`;

    default:
      return keyword || topic || '';
  }
}
