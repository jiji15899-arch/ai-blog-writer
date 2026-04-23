// AIBP - AI Blog Platform - Main App JS
'use strict';

// ── State ──────────────────────────────
let currentUser = null;
let currentPage = 'dashboard';
let lastGeneratedContent = '';
let lastPostId = null;
let lastKeyword = '';
let lastToolType = '';

// ── Init ───────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  // Enter key handling
  document.querySelectorAll('#login-email, #login-password').forEach(el => {
    el.addEventListener('keydown', e => e.key === 'Enter' && doLogin());
  });
});

// ── Auth ───────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.user) { bootApp(data.user); return; }
    }
  } catch (e) {}
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function bootApp(user) {
  currentUser = user;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.role === 'admin' ? '관리자' : '일반 사용자';
  document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
  document.getElementById('sidebar-role-text').textContent = user.role === 'admin' ? '관리자 계정' : 'AI Blog Platform';
  if (user.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
  }
  showPage('dashboard');
}

function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('auth-msg').style.display = 'none';
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showAuthMsg('이메일과 비밀번호를 입력하세요.', 'error'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = '로그인 중...';
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (res.ok && data.user) {
      bootApp(data.user);
    } else if (res.ok && data.ok) {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.user) bootApp(meData.user);
      else showAuthMsg('로그인 후 사용자 정보를 불러오지 못했습니다.', 'error');
    } else {
      showAuthMsg(data.error || '로그인 실패', 'error');
    }
  } catch (e) { showAuthMsg('서버 오류가 발생했습니다.', 'error'); }
  btn.disabled = false; btn.textContent = '로그인';
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) { showAuthMsg('모든 필드를 입력하세요.', 'error'); return; }
  if (password.length < 6) { showAuthMsg('비밀번호는 6자 이상이어야 합니다.', 'error'); return; }
  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = '처리 중...';
  try {
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    const data = await res.json();
    if (res.ok && data.ok) {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.user) bootApp(meData.user);
      else bootApp({ id: null, name: data.name || name, email, role: 'user' });
    } else {
      showAuthMsg(data.error || '회원가입 실패', 'error');
    }
  } catch (e) { showAuthMsg('서버 오류', 'error'); }
  btn.disabled = false; btn.textContent = '회원가입';
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  currentUser = null;
  showAuthScreen();
}

function showAuthMsg(msg, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg; el.className = `auth-msg ${type}`; el.style.display = 'block';
}

// ── Navigation ─────────────────────────
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    dashboard: '대시보드', affiliate: '💰 제휴 마케팅 블로그',
    naver_seo: '🟢 네이버 SEO 최적화', google_seo: '🔵 구글 SEO 최적화',
    policy: '🏛️ 정책·지원금 안내', referral: '🔗 추천인 유도 블로그',
    adsense: '💎 애드센스 승인 특화', history: '📋 생성 기록',
    settings: '⚙️ 설정', admin: '🛡️ 관리자'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('header-actions').innerHTML = '';

  const renderers = {
    dashboard, affiliate, naver_seo, google_seo, policy, referral, adsense, history: postHistory, settings, admin
  };
  if (renderers[page]) renderers[page]();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ── Helpers ────────────────────────────
function setContent(html) { document.getElementById('main-content').innerHTML = html; }
function showLoading(text = '처리 중...') { document.getElementById('loading-text').textContent = text; document.getElementById('loading').classList.add('show'); }
function hideLoading() { document.getElementById('loading').classList.remove('show'); }
function notify(msg, type = 'info') {
  const el = document.getElementById('notif');
  el.textContent = msg; el.className = `notif notif-${type} show`;
  setTimeout(() => el.classList.remove('show'), 3500);
}
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => notify('클립보드에 복사되었습니다!', 'success'));
}

// ── Dashboard ──────────────────────────
function dashboard() {
  setContent(`
    <div class="tool-grid">
      ${toolCard('💰', '제휴 마케팅 블로그', '애드릭스·쿠파스·텐핑 최적화\n전환율 극대화 구조', 'affiliate', '#f7971e', '💰 수익형')}
      ${toolCard('🟢', '네이버 SEO 최적화', 'D.I.A+ 알고리즘 · C-Rank\n상위노출 특화 글 생성', 'naver_seo', '#03c75a', '🏆 상위노출')}
      ${toolCard('🔵', '구글 SEO 최적화', 'E-E-A-T 기반 Featured Snippet\n애드센스 수익 극대화', 'google_seo', '#4285F4', '🎯 구글')}
      ${toolCard('🏛️', '정책·지원금 안내', '복잡한 정책 정보를 쉽게\n신청 가이드 완성형 글', 'policy', '#3b82f6', '📋 정보형')}
      ${toolCard('🔗', '추천인 유도 블로그', '추천인 코드 클릭 전환율\n구글+네이버 동시 최적화', 'referral', '#e53935', '🔗 바이럴')}
      ${toolCard('💎', '애드센스 승인 특화', '독창성·E-E-A-T·경험 기반\nAI 승인율 분석 포함', 'adsense', '#8b5cf6', '✅ 승인')}
    </div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:16px;color:var(--text2)">🚀 빠른 시작</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${quickGuide('1️⃣', '설정에서 Gemini API 키 입력', '⚙️ 설정', 'settings')}
        ${quickGuide('2️⃣', '원하는 도구 선택', '💰 도구 선택', 'affiliate')}
        ${quickGuide('3️⃣', '키워드/정보 입력 후 생성', '🚀 글 생성', '')}
        ${quickGuide('4️⃣', '스키마 마크업 & 이미지 생성', '✨ 완성', '')}
      </div>
    </div>
  `);
}

function toolCard(icon, name, desc, page, color, badge) {
  return `<div class="tool-card" onclick="showPage('${page}')" style="border-color:${color}22">
    <div style="position:absolute;top:12px;right:12px;background:${color}22;color:${color};font-size:10px;padding:3px 8px;border-radius:6px;font-weight:700">${badge}</div>
    <div class="tool-card-icon">${icon}</div>
    <div class="tool-card-name">${name}</div>
    <div class="tool-card-desc" style="white-space:pre-line">${desc}</div>
  </div>`;
}

function quickGuide(step, text, btn, page) {
  return `<div style="background:var(--surface2);border-radius:12px;padding:14px">
    <div style="font-size:20px;margin-bottom:8px">${step}</div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${text}</div>
    ${page ? `<button class="btn btn-sm btn-schema" onclick="showPage('${page}')">${btn}</button>` : `<span style="font-size:12px;color:var(--accent2)">${btn}</span>`}
  </div>`;
}

// ── TOOL: Affiliate ────────────────────
function affiliate() {
  setContent(`
    <div class="form-card">
      <h3>💰 제휴 마케팅 블로그 생성</h3>
      <div class="form-grid">
        <div class="field"><label>메인 키워드 *</label><input id="aff-keyword" placeholder="예: 쿠팡 로켓와우 후기"></div>
        <div class="field"><label>제품/서비스명 *</label><input id="aff-product" placeholder="예: 쿠팡 로켓와우 멤버십"></div>
        <div class="field"><label>제휴 플랫폼</label>
          <select id="aff-platform">
            <option>애드릭스</option><option>쿠파스</option><option>텐핑</option><option>링크프라이스</option><option>기타</option>
          </select>
        </div>
        <div class="field"><label>타겟 독자</label><input id="aff-target" placeholder="예: 20~30대 직장인 여성"></div>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('affiliate')">🚀 제휴 블로그 글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

// ── TOOL: Naver SEO ────────────────────
function naver_seo() {
  setContent(`
    <div class="form-card">
      <h3>🟢 네이버 SEO 최적화 글 생성</h3>
      <div style="background:rgba(3,199,90,0.08);border:1px solid rgba(3,199,90,0.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#86efac">
        💡 D.I.A+ 알고리즘 · C-Rank 최적화 · 애드포스트 수익 극대화
      </div>
      <div class="form-grid">
        <div class="field"><label>메인 키워드 *</label><input id="nav-keyword" placeholder="예: 제주도 숙소 추천"></div>
        <div class="field"><label>서브 키워드</label><input id="nav-sub" placeholder="예: 제주 가성비 호텔, 제주 펜션"></div>
        <div class="field"><label>카테고리</label>
          <select id="nav-category">
            <option>정보/리뷰</option><option>맛집/여행</option><option>뷰티/패션</option><option>건강/의료</option>
            <option>재테크/금융</option><option>육아/교육</option><option>IT/테크</option><option>기타</option>
          </select>
        </div>
        <div class="field"><label>문체</label>
          <select id="nav-tone"><option>친근한</option><option>전문적</option><option>블로그체</option><option>뉴스형</option></select>
        </div>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('naver_seo')" style="background:linear-gradient(135deg,#03c75a,#00a843)">🟢 네이버 최적화 글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

// ── TOOL: Google SEO ───────────────────
function google_seo() {
  setContent(`
    <div class="form-card">
      <h3>🔵 구글 SEO 최적화 글 생성</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${['E-Experience','E-Expertise','A-Authoritativeness','T-Trustworthiness'].map((e,i)=>`<span style="padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;background:${['#4285F422','#EA433522','#FBBC0422','#34A85322'][i]};color:${['#4285F4','#EA4335','#FBBC04','#34A853'][i]};border:1px solid ${['#4285F444','#EA433544','#FBBC0444','#34A85344'][i]}">${e}</span>`).join('')}
      </div>
      <div class="form-grid">
        <div class="field"><label>Primary Keyword *</label><input id="goo-keyword" placeholder="예: 재택근무 부업 추천"></div>
        <div class="field"><label>Secondary Keywords</label><input id="goo-secondary" placeholder="예: 집에서 돈버는 방법, 부업 종류"></div>
        <div class="field"><label>검색 의도</label>
          <select id="goo-intent"><option>정보 탐색형</option><option>구매 결정형</option><option>방법/방법론형</option><option>비교/리뷰형</option><option>로컬/장소형</option></select>
        </div>
        <div class="field"><label>목표 분량</label>
          <select id="goo-length"><option>표준 (2500자)</option><option>롱폼 (4000자+)</option><option>미디엄 (1800자)</option></select>
        </div>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('google_seo')" style="background:linear-gradient(135deg,#4285F4,#34A853)">🔵 구글 SEO 글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

// ── TOOL: Policy ───────────────────────
function policy() {
  setContent(`
    <div class="form-card">
      <h3>🏛️ 정책·지원금 안내 글 생성</h3>
      <div class="field" style="margin-bottom:16px"><label>정책/지원금명 *</label><input id="pol-name" placeholder="예: 청년도약계좌, 근로장려금, 첫만남이용권"></div>
      <div class="form-grid">
        <div class="field"><label>정책 유형</label>
          <select id="pol-type">
            <option>청년 지원금</option><option>소상공인 지원</option><option>육아/출산 지원</option>
            <option>취업/고용 지원</option><option>주거/전세 지원</option><option>노인/복지 지원</option>
            <option>에너지/환경 지원</option><option>창업 지원</option><option>기타 정부 정책</option>
          </select>
        </div>
        <div class="field"><label>신청 기한</label><input id="pol-deadline" placeholder="예: 2025년 12월 31일까지"></div>
        <div class="field"><label>지원 대상</label><input id="pol-target" placeholder="예: 만 19~34세 청년"></div>
        <div class="field"><label>지원 금액</label><input id="pol-amount" placeholder="예: 월 최대 70만원 지원"></div>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('policy')" style="background:linear-gradient(135deg,#1e40af,#3b82f6)">🏛️ 정책 안내글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

// ── TOOL: Referral ─────────────────────
function referral() {
  setContent(`
    <div class="form-card">
      <h3>🔗 추천인 유도 블로그 글 생성</h3>
      <div class="field" style="margin-bottom:16px"><label>서비스명 *</label><input id="ref-service" placeholder="예: 토스증권, 당근마켓, 배달의민족"></div>
      <div class="form-grid">
        <div class="field"><label>카테고리</label>
          <select id="ref-category">
            <option>핀테크/투자 앱</option><option>쇼핑/이커머스</option><option>음식 배달</option>
            <option>모빌리티/교통</option><option>숙박/여행</option><option>헬스/피트니스</option>
            <option>교육/구독</option><option>금융/보험</option><option>기타 서비스</option>
          </select>
        </div>
        <div class="field"><label>추천인 코드</label><input id="ref-code" placeholder="예: ABC123" style="color:#ffd54f;font-weight:700"></div>
        <div class="field"><label>추천인(나) 혜택</label><input id="ref-benefit-me" placeholder="예: 1만원 적립금"></div>
        <div class="field"><label>신규 가입자 혜택</label><input id="ref-benefit-new" placeholder="예: 첫 거래 수수료 무료"></div>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('referral')" style="background:linear-gradient(135deg,#e53935,#ff6f00)">🔗 추천인 블로그 글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

// ── TOOL: Adsense ──────────────────────
function adsense() {
  setContent(`
    <div class="form-card">
      <h3>💎 애드센스 승인 특화 글 생성</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${['✅ 독창성 자동 삽입','✅ 저품질 신호 제거','✅ 광고 친화 구조','✅ AI 승인율 분석'].map(b=>`<span style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:4px 12px;color:#a5b4fc;font-size:11px;font-weight:600">${b}</span>`).join('')}
      </div>
      <div class="field" style="margin-bottom:16px">
        <label>블로그 주제 *</label>
        <input id="ads-topic" placeholder="예: 혼자 제주도 3박4일 여행한 솔직 후기">
      </div>
      <div class="form-grid">
        <div class="field"><label>카테고리</label>
          <select id="ads-category">
            <option>여행/맛집</option><option>재테크/경제</option><option>건강/운동</option>
            <option>요리/레시피</option><option>IT/테크 리뷰</option><option>독서/자기계발</option>
            <option>육아/교육</option><option>반려동물</option><option>취미/일상</option><option>패션/뷰티</option>
          </select>
        </div>
        <div class="field"><label>글 형식</label>
          <select id="ads-angle"><option>경험 후기형</option><option>정보 가이드형</option><option>비교 분석형</option><option>일기/에세이형</option><option>Q&A 해결형</option></select>
        </div>
      </div>
      <div class="field" style="margin-top:16px">
        <label>개인 경험/배경 (선택 - 입력할수록 더 자연스러운 글 생성)</label>
        <textarea id="ads-experience" placeholder="예: 작년 11월에 혼자 여행했고, 렌트카 없이 대중교통만 이용했어요. 첫 혼행이라 긴장했는데..."></textarea>
      </div>
      ${imageStyleSelector()}
      <button class="btn btn-gen" onclick="generateContent('adsense')" style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)">💎 애드센스 승인용 블로그 글 생성</button>
    </div>
    <div id="result-area"></div>
  `);
}

function imageStyleSelector() {
  return `<div class="schema-panel" style="margin-top:16px">
    <h4>🖼️ 썸네일 이미지 스타일</h4>
    <div class="schema-chips">
      ${[['poster','🎨 포스터'],['minimal','⬜ 미니멀'],['photo_realistic','📷 사실적 사진'],['typography','✍️ 타이포그래피'],['branding','🏢 브랜딩']].map(([v,l])=>`<div class="schema-chip${v==='poster'?' active':''}" onclick="selectStyle(this,'${v}')" data-value="${v}">${l}</div>`).join('')}
    </div>
  </div>`;
}

function selectStyle(el, value) {
  el.closest('.schema-chips').querySelectorAll('.schema-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  el.closest('.schema-panel').dataset.selectedStyle = value;
}

function getSelectedStyle(formEl) {
  const panel = formEl?.querySelector?.('.schema-panel') || document.querySelector('.schema-panel');
  return panel?.dataset?.selectedStyle || panel?.querySelector?.('.schema-chip.active')?.dataset?.value || 'poster';
}

// ── Core: Generate Content ─────────────
async function generateContent(toolType) {
  const promptData = collectFormData(toolType);
  if (!promptData) return;

  const style = document.querySelector('.schema-chip.active')?.dataset?.value || 'poster';
  
  showLoading('AI가 글을 작성하고 있습니다...');
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_type: toolType, prompt_data: promptData })
    });
    const data = await res.json();
    if (!data.ok) { notify(data.error || '생성 실패', 'error'); return; }

    lastGeneratedContent = data.content;
    lastPostId = data.post_id;
    lastKeyword = promptData.keyword || promptData.topic || promptData.policyName || promptData.service || '';
    lastToolType = toolType;

    renderResult(data.content, toolType, data.post_id, style);
    notify(`✅ 글 생성 완료! (${data.word_count}자)`, 'success');
  } catch (e) {
    notify('서버 오류: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

function collectFormData(toolType) {
  const g = id => document.getElementById(id)?.value || '';
  switch (toolType) {
    case 'affiliate':
      if (!g('aff-keyword') || !g('aff-product')) { notify('키워드와 제품명을 입력하세요.', 'error'); return null; }
      return { keyword: g('aff-keyword'), product: g('aff-product'), platform: g('aff-platform'), target: g('aff-target') };
    case 'naver_seo':
      if (!g('nav-keyword')) { notify('메인 키워드를 입력하세요.', 'error'); return null; }
      return { keyword: g('nav-keyword'), sub: g('nav-sub'), category: g('nav-category'), tone: g('nav-tone') };
    case 'google_seo':
      if (!g('goo-keyword')) { notify('Primary Keyword를 입력하세요.', 'error'); return null; }
      return { keyword: g('goo-keyword'), secondary: g('goo-secondary'), intent: g('goo-intent'), length: g('goo-length') };
    case 'policy':
      if (!g('pol-name')) { notify('정책/지원금명을 입력하세요.', 'error'); return null; }
      return { policyName: g('pol-name'), policyType: g('pol-type'), target: g('pol-target'), amount: g('pol-amount'), deadline: g('pol-deadline') };
    case 'referral':
      if (!g('ref-service')) { notify('서비스명을 입력하세요.', 'error'); return null; }
      return { service: g('ref-service'), category: g('ref-category'), referralCode: g('ref-code'), benefitMe: g('ref-benefit-me'), benefitNew: g('ref-benefit-new') };
    case 'adsense':
      if (!g('ads-topic')) { notify('블로그 주제를 입력하세요.', 'error'); return null; }
      return { topic: g('ads-topic'), category: g('ads-category'), angle: g('ads-angle'), experience: g('ads-experience') };
    default: return {};
  }
}

// ── Render Result ──────────────────────
function renderResult(content, toolType, postId, style) {
  const typeColors = {
    affiliate: '#f7971e', naver_seo: '#03c75a', google_seo: '#4285F4',
    policy: '#3b82f6', referral: '#e53935', adsense: '#8b5cf6'
  };
  const color = typeColors[toolType] || 'var(--accent)';

  const schemaTypes = getSchemaTypesForTool(toolType);

  document.getElementById('result-area').innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <span class="result-title">✅ 생성 완료</span>
        <div class="result-actions">
          <button class="btn btn-sm btn-copy" onclick="copyText(lastGeneratedContent)">📋 복사</button>
          <button class="btn btn-sm btn-schema" onclick="generateSchemaMarkup()">🏷️ 스키마 자동 생성</button>
          <button class="btn btn-sm btn-img" onclick="generateImage('${style}')">🖼️ 이미지 생성</button>
        </div>
      </div>
      <div class="result-body">
        <pre class="result-text" id="result-text">${escHtml(content)}</pre>
      </div>
    </div>
    
    <!-- Schema Panel -->
    <div class="schema-panel" id="schema-result-panel" style="margin-top:16px;display:none">
      <h4>🏷️ 스키마 마크업 (JSON-LD)</h4>
      <div id="schema-chips-result" class="schema-chips"></div>
      <pre class="schema-output show" id="schema-json-output"></pre>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-sm btn-copy" onclick="copyText(document.getElementById('schema-json-output').textContent)">📋 스키마 복사</button>
        <button class="btn btn-sm btn-schema" id="schema-gen-btn" onclick="generateSchemaMarkup()">🔄 재생성</button>
      </div>
    </div>

    <!-- Image Preview -->
    <div class="image-preview" id="img-preview" style="margin-top:16px">
      <img id="preview-img" src="" alt="생성된 썸네일">
    </div>
  `;
}

// ── Schema Generation ──────────────────
function getSchemaTypesForTool(toolType) {
  return { affiliate: ['Article','Product'], naver_seo: ['Article','FAQ'], google_seo: ['Article','FAQ','HowTo'], policy: ['Article','FAQ','GovernmentService'], referral: ['Article','Product'], adsense: ['Article','FAQ'] }[toolType] || ['Article'];
}

async function generateSchemaMarkup() {
  if (!lastGeneratedContent) { notify('먼저 글을 생성해주세요.', 'error'); return; }
  
  const btn = document.getElementById('schema-gen-btn');
  if (btn) { btn.textContent = '⏳ 생성 중...'; btn.disabled = true; }
  
  notify('스키마 마크업 생성 중...', 'info');
  try {
    const res = await fetch('/api/schema', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: lastGeneratedContent,
        keyword: lastKeyword,
        tool_type: lastToolType,
        post_id: lastPostId
      })
    });
    const data = await res.json();
    if (!data.ok || !data.schemas?.length) {
      notify(data.error || '스키마 생성 실패', 'error'); return;
    }

    const panel = document.getElementById('schema-result-panel');
    const chipsEl = document.getElementById('schema-chips-result');
    const outputEl = document.getElementById('schema-json-output');
    
    panel.style.display = 'block';
    chipsEl.innerHTML = data.schemas.map((s, i) =>
      `<div class="schema-chip${i===0?' active':''}" onclick="showSchema(this,${i})" data-json='${escAttr(s.json)}'>${s.type}</div>`
    ).join('');

    // Show first schema
    if (data.schemas[0]) {
      try { outputEl.textContent = JSON.stringify(JSON.parse(data.schemas[0].json), null, 2); }
      catch { outputEl.textContent = data.schemas[0].json; }
    }

    notify(`✅ ${data.schemas.length}개 스키마 생성 완료!`, 'success');
  } catch (e) {
    notify('스키마 오류: ' + e.message, 'error');
  } finally {
    if (btn) { btn.textContent = '🔄 재생성'; btn.disabled = false; }
  }
}

function showSchema(el, idx) {
  el.closest('.schema-chips').querySelectorAll('.schema-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const jsonStr = el.dataset.json;
  const output = document.getElementById('schema-json-output');
  try { output.textContent = JSON.stringify(JSON.parse(jsonStr), null, 2); }
  catch { output.textContent = jsonStr; }
}

// ── Image Generation ───────────────────
async function generateImage(style) {
  if (!lastKeyword) { notify('먼저 글을 생성해주세요.', 'error'); return; }

  showLoading('🖼️ 이미지 생성 중... (30~60초 소요)');
  try {
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: lastKeyword, tool_type: lastToolType, style: style || 'poster', post_id: lastPostId })
    });
    const data = await res.json();
    if (!data.ok) { notify(data.error || '이미지 생성 실패', 'error'); return; }

    const preview = document.getElementById('img-preview');
    const img = document.getElementById('preview-img');
    if (preview && img) {
      img.src = data.image_url;
      preview.style.display = 'block';
      preview.style.borderRadius = '12px';
      preview.style.overflow = 'hidden';
    }
    notify('✅ 이미지 생성 완료!', 'success');
  } catch (e) {
    notify('이미지 오류: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ── History Page ───────────────────────
async function postHistory() {
  setContent('<div style="text-align:center;padding:40px;color:var(--text2)">📋 기록 로딩 중...</div>');
  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    const posts = data.posts || [];

    const typeLabels = {
      affiliate:'💰 제휴', naver_seo:'🟢 네이버', google_seo:'🔵 구글',
      policy:'🏛️ 정책', referral:'🔗 추천인', adsense:'💎 애드센스'
    };
    const typeColors = {
      affiliate:'#f7971e', naver_seo:'#03c75a', google_seo:'#4285F4',
      policy:'#3b82f6', referral:'#e53935', adsense:'#8b5cf6'
    };

    setContent(`
      <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <span style="color:var(--text2);font-size:13px">총 ${data.total || 0}개의 생성 기록</span>
      </div>
      ${posts.length === 0 ? `<div style="text-align:center;padding:60px;color:var(--text2)">아직 생성된 글이 없습니다.</div>` :
        `<div class="post-list">${posts.map(p => `
          <div class="post-item">
            <span class="post-type-badge" style="background:${typeColors[p.tool_type]}22;color:${typeColors[p.tool_type]}">${typeLabels[p.tool_type]||p.tool_type}</span>
            <div class="post-info">
              <div class="post-keyword">${escHtml(p.keyword || '(제목 없음)')}</div>
              <div class="post-meta">${p.word_count || 0}자 · ${formatDate(p.created_at)}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="deletePost(${p.id})">🗑</button>
          </div>
        `).join('')}</div>`}
    `);
  } catch (e) {
    setContent(`<div style="color:var(--red)">${e.message}</div>`);
  }
}

async function deletePost(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  await fetch(`/api/posts?id=${id}`, { method: 'DELETE' });
  notify('삭제되었습니다.', 'success');
  postHistory();
}

// ── Settings Page ──────────────────────
async function settings() {
  setContent('<div style="padding:40px;text-align:center;color:var(--text2)">설정 로딩 중...</div>');
  let current = {};
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    current = data.settings || {};
  } catch (e) {}

  setContent(`
    <div class="settings-section">
      <h3>🤖 AI API 설정</h3>
      <div class="field">
        <label>Gemini API 키 ${current.gemini_api_key_set ? '<span style="color:var(--green)">✅ 설정됨</span>' : '<span style="color:var(--red)">⚠️ 미설정</span>'}</label>
        <input id="set-gemini" type="password" placeholder="${current.gemini_api_key || 'AIzaSy...'}" value="">
      </div>
      <div class="tip-box">💡 <strong>Gemini API 키 발급:</strong> <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent2)">Google AI Studio</a>에서 무료로 발급 가능합니다.</div>
    </div>

    <div class="settings-section">
      <h3>🖼️ 이미지 생성 설정 (Cloudflare Worker)</h3>
      <div class="field">
        <label>Worker URL ${current.worker_url ? '<span style="color:var(--green)">✅ 설정됨</span>' : ''}</label>
        <input id="set-worker" placeholder="https://your-worker.workers.dev" value="${current.worker_url || ''}">
      </div>
      <div class="tip-box">💡 Cloudflare Workers AI를 사용하여 이미지를 생성합니다. Worker는 POST 요청으로 <strong>prompt, style, width, height</strong>를 받고 <strong>{ url: "이미지URL" }</strong>을 반환해야 합니다.</div>
    </div>

    <div class="settings-section">
      <h3>📝 워드프레스 연동 설정</h3>
      <div class="settings-grid">
        <div class="field">
          <label>워드프레스 사이트 URL</label>
          <input id="set-wp-url" placeholder="https://yoursite.com" value="${current.wp_site_url || ''}">
        </div>
        <div class="field">
          <label>워드프레스 사용자명</label>
          <input id="set-wp-user" placeholder="admin" value="${current.wp_username || ''}">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>애플리케이션 비밀번호 ${current.wp_app_password_set ? '<span style="color:var(--green)">✅ 설정됨</span>' : ''}</label>
          <input id="set-wp-pass" type="password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" value="">
        </div>
      </div>
      <div class="tip-box">💡 워드프레스 <strong>사용자 > 프로필 > 애플리케이션 비밀번호</strong>에서 생성하세요.</div>
    </div>

    <div class="settings-section">
      <h3>📰 블로거(Blogger) 연동 설정</h3>
      <div class="settings-grid">
        <div class="field">
          <label>Blogger API 키 ${current.blogger_api_key_set ? '<span style="color:var(--green)">✅ 설정됨</span>' : ''}</label>
          <input id="set-blog-api" type="password" placeholder="AIzaSy..." value="">
        </div>
        <div class="field">
          <label>OAuth 클라이언트 ID</label>
          <input id="set-blog-client" placeholder="xxxxx.apps.googleusercontent.com" value="${current.blogger_client_id || ''}">
        </div>
        <div class="field">
          <label>블로그 ID</label>
          <input id="set-blog-id" placeholder="1234567890" value="${current.blogger_blog_id || ''}">
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3>⚙️ 기본 설정</h3>
      <div class="field">
        <label>기본 도구</label>
        <select id="set-default-tool">
          ${['affiliate','naver_seo','google_seo','policy','referral','adsense'].map(t=>
            `<option value="${t}" ${current.default_tool===t?'selected':''}>${{affiliate:'💰 제휴 마케팅',naver_seo:'🟢 네이버 SEO',google_seo:'🔵 구글 SEO',policy:'🏛️ 정책·지원금',referral:'🔗 추천인',adsense:'💎 애드센스'}[t]}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <button class="btn btn-gen" onclick="saveSettings()" style="max-width:300px">💾 설정 저장</button>
  `);
}

async function saveSettings() {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const body = {
    gemini_api_key: g('set-gemini'),
    worker_url: g('set-worker'),
    wp_site_url: g('set-wp-url'),
    wp_username: g('set-wp-user'),
    wp_app_password: g('set-wp-pass'),
    blogger_api_key: g('set-blog-api'),
    blogger_client_id: g('set-blog-client'),
    blogger_blog_id: g('set-blog-id'),
    default_tool: g('set-default-tool') || 'affiliate'
  };

  showLoading('설정 저장 중...');
  try {
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) { notify('✅ 설정이 저장되었습니다.', 'success'); settings(); }
    else notify(data.error || '저장 실패', 'error');
  } catch (e) { notify('오류: ' + e.message, 'error'); }
  finally { hideLoading(); }
}

// ── Admin Page ─────────────────────────
async function admin() {
  if (currentUser?.role !== 'admin') { notify('관리자 권한이 필요합니다.', 'error'); showPage('dashboard'); return; }
  
  setContent('<div style="padding:40px;text-align:center;color:var(--text2)">관리자 데이터 로딩 중...</div>');
  
  try {
    const [statsRes, usersRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/users')
    ]);
    const statsData = await statsRes.json();
    const usersData = await usersRes.json();
    const s = statsData.stats || {};

    setContent(`
      <div class="admin-grid">
        ${statCard('👥', '전체 사용자', s.total_users || 0, 'var(--accent)')}
        ${statCard('✅', '활성 사용자', s.active_users || 0, 'var(--green)')}
        ${statCard('📄', '전체 생성 글', s.total_posts || 0, 'var(--yellow)')}
        ${statCard('📊', '오늘 생성', s.today_posts || 0, '#f87171')}
      </div>

      <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
        <h3 style="font-size:16px;font-weight:700">👥 사용자 관리</h3>
        <button class="btn btn-schema btn-sm" onclick="showAddUserModal()">➕ 사용자 추가</button>
      </div>
      <div class="table-container" style="margin-bottom:24px">
        <table>
          <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th>상태</th><th>생성 글</th><th>최근 로그인</th><th>관리</th></tr></thead>
          <tbody>
          ${(usersData.users || []).map(u => `
            <tr>
              <td style="font-weight:600">${escHtml(u.name)}</td>
              <td style="color:var(--text2)">${escHtml(u.email)}</td>
              <td><span class="badge badge-${u.role}">${u.role === 'admin' ? '관리자' : '일반'}</span></td>
              <td><span class="badge badge-${u.is_active ? 'active' : 'inactive'}">${u.is_active ? '활성' : '비활성'}</span></td>
              <td>${u.post_count || 0}</td>
              <td style="color:var(--text2);font-size:12px">${u.last_login ? formatDate(u.last_login) : '없음'}</td>
              <td>
                <button class="btn btn-sm btn-schema" onclick="editUser(${u.id},'${escAttr(u.name)}','${u.role}',${u.is_active})">✏️</button>
                ${u.email !== 'admin@aibp.local' ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">🗑</button>` : ''}
              </td>
            </tr>
          `).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="font-size:16px;font-weight:700;margin-bottom:16px">⚙️ 시스템 설정</h3>
      <div class="settings-section" id="sys-settings-area">
        <div class="settings-grid" id="sys-settings-grid">로딩 중...</div>
        <button class="btn btn-schema" style="margin-top:16px" onclick="saveSystemSettings()">💾 시스템 설정 저장</button>
      </div>
    `);

    loadSystemSettings();
  } catch (e) {
    setContent(`<div style="color:var(--red)">오류: ${e.message}</div>`);
  }
}

function statCard(icon, label, value, color) {
  return `<div class="stat-card"><div class="stat-num" style="color:${color}">${icon} ${value.toLocaleString()}</div><div class="stat-label">${label}</div></div>`;
}

async function loadSystemSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    const s = data.settings || {};
    document.getElementById('sys-settings-grid').innerHTML = `
      <div class="field">
        <label>회원가입 허용</label>
        <select id="sys-allow-reg">
          <option value="true" ${s.allow_registration === 'true' ? 'selected' : ''}>허용</option>
          <option value="false" ${s.allow_registration === 'false' ? 'selected' : ''}>차단</option>
        </select>
      </div>
      <div class="field">
        <label>최대 사용자 수</label>
        <input id="sys-max-users" type="number" value="${s.max_users || 100}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>사이트 이름</label>
        <input id="sys-site-name" value="${escHtml(s.site_name || 'AIBP - AI Blog Platform')}">
      </div>
    `;
  } catch (e) {}
}

async function saveSystemSettings() {
  const g = id => document.getElementById(id)?.value || '';
  const body = {
    allow_registration: g('sys-allow-reg'),
    max_users: g('sys-max-users'),
    site_name: g('sys-site-name')
  };
  const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.ok) notify('✅ 시스템 설정 저장됨', 'success');
  else notify(data.error || '저장 실패', 'error');
}

function showAddUserModal() {
  const name = prompt('새 사용자 이름:');
  if (!name) return;
  const email = prompt('이메일:');
  if (!email) return;
  const password = prompt('비밀번호 (6자 이상):');
  if (!password || password.length < 6) { notify('비밀번호는 6자 이상이어야 합니다.', 'error'); return; }
  const isAdmin = confirm('관리자 권한 부여?');

  fetch('/api/admin/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role: isAdmin ? 'admin' : 'user' })
  }).then(r => r.json()).then(d => {
    if (d.ok) { notify('✅ 사용자 추가됨', 'success'); admin(); }
    else notify(d.error || '추가 실패', 'error');
  }).catch(() => notify('서버 오류', 'error'));
}

function editUser(id, name, role, isActive) {
  const newName = prompt('이름:', name);
  if (!newName) return;
  const newRole = confirm('관리자 권한 부여?') ? 'admin' : 'user';
  const active = confirm('계정 활성화?');
  
  fetch(`/api/admin/user?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName, role: newRole, is_active: active })
  }).then(r => r.json()).then(d => {
    if (d.ok) { notify('✅ 업데이트됨', 'success'); admin(); }
    else notify(d.error || '실패', 'error');
  });
}

async function deleteUser(id) {
  if (!confirm('이 사용자를 삭제하시겠습니까? 모든 데이터가 함께 삭제됩니다.')) return;
  const res = await fetch(`/api/admin/user?id=${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) { notify('✅ 삭제됨', 'success'); admin(); }
  else notify(data.error || '실패', 'error');
}

// ── Utils ──────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) {
  return String(str || '').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}
