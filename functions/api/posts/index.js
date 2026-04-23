// functions/api/posts/index.js
import { getSession, requireAuth, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const session = await getSession(request, env);
  const authError = requireAuth(session);
  if (authError) return authError;

  if (request.method === 'GET') return getPosts(request, session, env);
  if (request.method === 'DELETE') return deletePost(request, session, env);
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function getPosts(request, session, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const tool_type = url.searchParams.get('tool') || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  const whereExtra = tool_type ? ' AND tool_type = ?' : '';
  const binds = tool_type
    ? [session.user.id, tool_type, limit, offset]
    : [session.user.id, limit, offset];

  const posts = await env.DB.prepare(`
    SELECT id, tool_type, keyword, word_count, image_url, published_to, published_url, created_at
    FROM generated_posts
    WHERE user_id = ?${whereExtra}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(...binds).all();

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM generated_posts WHERE user_id = ?${whereExtra}`
  ).bind(...(tool_type ? [session.user.id, tool_type] : [session.user.id])).first();

  return jsonResponse({ ok: true, posts: posts.results, total: total?.count || 0, page, limit });
}

async function deletePost(request, session, env) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return jsonResponse({ error: 'ID가 필요합니다.' }, 400);

  await env.DB.prepare(
    'DELETE FROM generated_posts WHERE id = ? AND user_id = ?'
  ).bind(id, session.user.id).run();

  return jsonResponse({ ok: true, message: '삭제되었습니다.' });
}
