// functions/api/admin/[[action]].js
import { getSession, requireAdmin, hashPassword, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const action = params.action?.[0] || '';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const session = await getSession(request, env);
  const adminError = requireAdmin(session);
  if (adminError) return adminError;

  switch (action) {
    case 'users':          return handleUsers(request, env);
    case 'user':           return handleUser(request, env);
    case 'stats':          return handleStats(env);
    case 'settings':       return handleSystemSettings(request, env);
    case 'logs':           return handleLogs(request, env);
    default:
      return jsonResponse({ error: '잘못된 요청' }, 404);
  }
}

// 사용자 목록 조회
async function handleUsers(request, env) {
  if (request.method !== 'GET') return jsonResponse({ error: 'GET만 허용' }, 405);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = url.searchParams.get('search') || '';

  const whereClause = search ? 'WHERE email LIKE ? OR name LIKE ?' : '';
  const binds = search ? [`%${search}%`, `%${search}%`, limit, offset] : [limit, offset];

  const users = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, u.last_login,
      (SELECT COUNT(*) FROM generated_posts WHERE user_id = u.id) as post_count,
      (SELECT COUNT(*) FROM usage_logs WHERE user_id = u.id) as usage_count
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).bind(...binds).all();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM users ${whereClause}`
  ).bind(...(search ? [`%${search}%`, `%${search}%`] : [])).first();

  return jsonResponse({ ok: true, users: users.results, total: total?.count || 0, page, limit });
}

// 개별 사용자 관리 (GET/PUT/DELETE)
async function handleUser(request, env) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('id');
  if (!userId) return jsonResponse({ error: '사용자 ID가 필요합니다.' }, 400);

  if (request.method === 'GET') {
    const user = await env.DB.prepare(
      'SELECT id, email, name, role, is_active, created_at, last_login FROM users WHERE id = ?'
    ).bind(userId).first();
    
    const settings = await env.DB.prepare(
      'SELECT worker_url, wp_site_url, wp_username, blogger_client_id, default_tool FROM user_settings WHERE user_id = ?'
    ).bind(userId).first();
    
    const stats = await env.DB.prepare(
      'SELECT COUNT(*) as posts FROM generated_posts WHERE user_id = ?'
    ).bind(userId).first();

    return jsonResponse({ ok: true, user, settings, stats });
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const { name, role, is_active, password } = body;

    if (password) {
      const passwordHash = await hashPassword(password);
      await env.DB.prepare(
        'UPDATE users SET name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = ? WHERE id = ?'
      ).bind(name, role, is_active ? 1 : 0, passwordHash, new Date().toISOString(), userId).run();
    } else {
      await env.DB.prepare(
        'UPDATE users SET name = ?, role = ?, is_active = ?, updated_at = ? WHERE id = ?'
      ).bind(name, role, is_active ? 1 : 0, new Date().toISOString(), userId).run();
    }
    return jsonResponse({ ok: true, message: '사용자 정보가 업데이트되었습니다.' });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    return jsonResponse({ ok: true, message: '사용자가 삭제되었습니다.' });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// 대시보드 통계
async function handleStats(env) {
  const [totalUsers, activeUsers, totalPosts, todayPosts, totalLogs] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM generated_posts').first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM generated_posts WHERE date(created_at) = date('now')").first(),
    env.DB.prepare('SELECT COUNT(*) as count FROM usage_logs').first()
  ]);

  const toolStats = await env.DB.prepare(`
    SELECT tool_type, COUNT(*) as count FROM generated_posts
    GROUP BY tool_type ORDER BY count DESC
  `).all();

  const recentPosts = await env.DB.prepare(`
    SELECT gp.id, gp.tool_type, gp.keyword, gp.word_count, gp.created_at, u.name as user_name
    FROM generated_posts gp JOIN users u ON gp.user_id = u.id
    ORDER BY gp.created_at DESC LIMIT 10
  `).all();

  return jsonResponse({
    ok: true,
    stats: {
      total_users: totalUsers?.count || 0,
      active_users: activeUsers?.count || 0,
      total_posts: totalPosts?.count || 0,
      today_posts: todayPosts?.count || 0,
      total_actions: totalLogs?.count || 0
    },
    tool_stats: toolStats.results,
    recent_posts: recentPosts.results
  });
}

// 시스템 설정
async function handleSystemSettings(request, env) {
  if (request.method === 'GET') {
    const settings = await env.DB.prepare('SELECT key, value FROM system_settings').all();
    const obj = {};
    settings.results.forEach(s => obj[s.key] = s.value);
    return jsonResponse({ ok: true, settings: obj });
  }

  if (request.method === 'PUT') {
    const body = await request.json();
    const now = new Date().toISOString();
    for (const [key, value] of Object.entries(body)) {
      await env.DB.prepare(
        'INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)'
      ).bind(key, String(value), now).run();
    }
    return jsonResponse({ ok: true, message: '시스템 설정이 저장되었습니다.' });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// 사용 로그
async function handleLogs(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const logs = await env.DB.prepare(`
    SELECT ul.id, ul.tool_type, ul.action, ul.tokens_used, ul.created_at, u.name as user_name, u.email
    FROM usage_logs ul JOIN users u ON ul.user_id = u.id
    ORDER BY ul.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await env.DB.prepare('SELECT COUNT(*) as count FROM usage_logs').first();

  return jsonResponse({ ok: true, logs: logs.results, total: total?.count || 0, page, limit });
}
