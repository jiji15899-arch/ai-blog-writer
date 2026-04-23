// functions/_utils/auth.js
// 인증 유틸리티

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSessionId() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session_id=([^;]+)/);
  if (!match) return null;
  const sessionId = match[1];
  
  try {
    // KV에서 세션 확인
    const sessionData = await env.SESSIONS.get(`session:${sessionId}`);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData);
    if (new Date(session.expires_at) < new Date()) {
      await env.SESSIONS.delete(`session:${sessionId}`);
      return null;
    }
    
    // 사용자 정보 가져오기
    const user = await env.DB.prepare(
      'SELECT id, email, name, role, is_active FROM users WHERE id = ?'
    ).bind(session.user_id).first();
    
    if (!user || !user.is_active) return null;
    return { ...session, user };
  } catch (e) {
    return null;
  }
}

export async function createSession(userId, env) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const sessionData = { user_id: userId, expires_at: expiresAt, created_at: new Date().toISOString() };
  await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 7 * 24 * 60 * 60
  });
  
  return { sessionId, expiresAt };
}

export function requireAuth(session) {
  if (!session) {
    return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}

export function requireAdmin(session) {
  const authError = requireAuth(session);
  if (authError) return authError;
  if (session.user.role !== 'admin') {
    return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}

export function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}
