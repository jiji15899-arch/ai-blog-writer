// functions/api/settings/index.js
import { getSession, requireAuth, jsonResponse } from '../../_utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const session = await getSession(request, env);
  const authError = requireAuth(session);
  if (authError) return authError;

  if (request.method === 'GET') return getSettings(session, env);
  if (request.method === 'POST' || request.method === 'PUT') return saveSettings(request, session, env);
  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function getSettings(session, env) {
  try {
    const settings = await env.DB.prepare(
      `SELECT gemini_api_key, worker_url, wp_site_url, wp_username, wp_app_password,
              blogger_api_key, blogger_client_id, blogger_blog_id, default_tool
       FROM user_settings WHERE user_id = ?`
    ).bind(session.user.id).first();

    if (!settings) return jsonResponse({ ok: true, settings: {} });

    // API 키는 마스킹 처리 (존재 여부만 확인, 실제 값은 노출하지 않음)
    return jsonResponse({
      ok: true,
      settings: {
        gemini_api_key: settings.gemini_api_key ? '••••••••' + settings.gemini_api_key.slice(-4) : '',
        gemini_api_key_set: !!settings.gemini_api_key,
        worker_url: settings.worker_url || '',
        wp_site_url: settings.wp_site_url || '',
        wp_username: settings.wp_username || '',
        wp_app_password: settings.wp_app_password ? '••••••••' : '',
        wp_app_password_set: !!settings.wp_app_password,
        blogger_api_key: settings.blogger_api_key ? '••••••••' + settings.blogger_api_key.slice(-4) : '',
        blogger_api_key_set: !!settings.blogger_api_key,
        blogger_client_id: settings.blogger_client_id || '',
        blogger_blog_id: settings.blogger_blog_id || '',
        default_tool: settings.default_tool || 'affiliate'
      }
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

async function saveSettings(request, session, env) {
  try {
    const body = await request.json();
    const {
      gemini_api_key, worker_url,
      wp_site_url, wp_username, wp_app_password,
      blogger_api_key, blogger_client_id, blogger_blog_id,
      default_tool
    } = body;

    // 기존 설정 가져오기
    const existing = await env.DB.prepare(
      'SELECT * FROM user_settings WHERE user_id = ?'
    ).bind(session.user.id).first();

    const now = new Date().toISOString();

    if (existing) {
      // 업데이트 - 빈 문자열이면 기존 값 유지 (•• 마스킹 값 제외)
      await env.DB.prepare(`
        UPDATE user_settings SET
          gemini_api_key = CASE WHEN ? != '' AND ? NOT LIKE '••••••••%' THEN ? ELSE gemini_api_key END,
          worker_url = CASE WHEN ? IS NOT NULL THEN ? ELSE worker_url END,
          wp_site_url = CASE WHEN ? IS NOT NULL THEN ? ELSE wp_site_url END,
          wp_username = CASE WHEN ? IS NOT NULL THEN ? ELSE wp_username END,
          wp_app_password = CASE WHEN ? != '' AND ? NOT LIKE '••••••••%' THEN ? ELSE wp_app_password END,
          blogger_api_key = CASE WHEN ? != '' AND ? NOT LIKE '••••••••%' THEN ? ELSE blogger_api_key END,
          blogger_client_id = CASE WHEN ? IS NOT NULL THEN ? ELSE blogger_client_id END,
          blogger_blog_id = CASE WHEN ? IS NOT NULL THEN ? ELSE blogger_blog_id END,
          default_tool = CASE WHEN ? IS NOT NULL THEN ? ELSE default_tool END,
          updated_at = ?
        WHERE user_id = ?
      `).bind(
        gemini_api_key || '', gemini_api_key || '', gemini_api_key || '',
        worker_url, worker_url,
        wp_site_url, wp_site_url,
        wp_username, wp_username,
        wp_app_password || '', wp_app_password || '', wp_app_password || '',
        blogger_api_key || '', blogger_api_key || '', blogger_api_key || '',
        blogger_client_id, blogger_client_id,
        blogger_blog_id, blogger_blog_id,
        default_tool, default_tool,
        now, session.user.id
      ).run();
    } else {
      // 신규 생성
      await env.DB.prepare(`
        INSERT INTO user_settings
          (user_id, gemini_api_key, worker_url, wp_site_url, wp_username, wp_app_password,
           blogger_api_key, blogger_client_id, blogger_blog_id, default_tool, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        session.user.id,
        gemini_api_key || null, worker_url || null,
        wp_site_url || null, wp_username || null, wp_app_password || null,
        blogger_api_key || null, blogger_client_id || null, blogger_blog_id || null,
        default_tool || 'affiliate', now
      ).run();
    }

    return jsonResponse({ ok: true, message: '설정이 저장되었습니다.' });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
