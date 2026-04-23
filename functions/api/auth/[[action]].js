// functions/api/auth/[[action]].js
import { hashPassword, createSession, getSession, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const action = params.action?.[0] || '';
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  switch (action) {
    case 'login':    return handleLogin(request, env);
    case 'logout':   return handleLogout(request, env);
    case 'register': return handleRegister(request, env);
    case 'me':       return handleMe(request, env);
    default:
      return jsonResponse({ error: '잘못된 요청입니다.' }, 404);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
}

async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return jsonResponse({ error: '이메일과 비밀번호를 입력하세요.' }, 400);

    const passwordHash = await hashPassword(password);
    const user = await env.DB.prepare(
      'SELECT id, email, name, role, is_active FROM users WHERE email = ? AND password_hash = ?'
    ).bind(email.toLowerCase(), passwordHash).first();

    if (!user) return jsonResponse({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    if (!user.is_active) return jsonResponse({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, 403);

    const { sessionId, expiresAt } = await createSession(user.id, env);

    // 마지막 로그인 시간 업데이트
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
      .bind(new Date().toISOString(), user.id).run();

    const cookieOptions = `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${new Date(expiresAt).toUTCString()}`;
    
    return new Response(JSON.stringify({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieOptions
      }
    });
  } catch (e) {
    return jsonResponse({ error: '서버 오류가 발생했습니다.' }, 500);
  }
}

async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_id=([^;]+)/);
  if (match) {
    await env.SESSIONS.delete(`session:${match[1]}`).catch(() => {});
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session_id=; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
}

async function handleRegister(request, env) {
  try {
    // 회원가입 허용 여부 확인
    const allowReg = await env.DB.prepare(
      "SELECT value FROM system_settings WHERE key = 'allow_registration'"
    ).first();
    if (!allowReg || allowReg.value !== 'true') {
      return jsonResponse({ error: '현재 회원가입이 비활성화되어 있습니다.' }, 403);
    }

    const { email, password, name } = await request.json();
    if (!email || !password || !name) return jsonResponse({ error: '모든 필드를 입력하세요.' }, 400);
    if (password.length < 6) return jsonResponse({ error: '비밀번호는 6자 이상이어야 합니다.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase()).first();
    if (existing) return jsonResponse({ error: '이미 사용 중인 이메일입니다.' }, 409);

    const passwordHash = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).bind(email.toLowerCase(), passwordHash, name, 'user').run();

    if (!result.success) return jsonResponse({ error: '회원가입 실패. 다시 시도해주세요.' }, 500);

    const { sessionId, expiresAt } = await createSession(result.meta.last_row_id, env);
    const cookieOptions = `session_id=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=${new Date(expiresAt).toUTCString()}`;

    return new Response(JSON.stringify({ ok: true, name }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieOptions }
    });
  } catch (e) {
    return jsonResponse({ error: '서버 오류: ' + e.message }, 500);
  }
}

async function handleMe(request, env) {
  try {
    const session = await getSession(request, env);
    if (!session) return jsonResponse({ error: '로그인이 필요합니다.' }, 401);
    
    const settings = await env.DB.prepare(
      'SELECT gemini_api_key, worker_url, wp_site_url, wp_username, blogger_api_key, blogger_client_id, default_tool FROM user_settings WHERE user_id = ?'
    ).bind(session.user.id).first();

    return jsonResponse({
      ok: true,
      user: session.user,
      hasGeminiKey: !!(settings?.gemini_api_key),
      hasWorkerUrl: !!(settings?.worker_url),
      hasWpSettings: !!(settings?.wp_site_url && settings?.wp_username),
      hasBloggerSettings: !!(settings?.blogger_api_key),
      defaultTool: settings?.default_tool || 'affiliate'
    });
  } catch (e) {
    return jsonResponse({ error: '서버 오류' }, 500);
  }
}
