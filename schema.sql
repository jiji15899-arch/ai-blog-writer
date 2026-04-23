-- ============================================================
-- AIBP (AI Blog Platform) - D1 Database Schema
-- Run: wrangler d1 execute aibp-db --file=schema.sql
-- ============================================================

-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

-- 사용자 설정 테이블 (API 키, 워드프레스 설정 등)
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  -- AI API 키
  gemini_api_key TEXT,
  -- 이미지 생성
  worker_url TEXT,
  -- 워드프레스 설정
  wp_site_url TEXT,
  wp_username TEXT,
  wp_app_password TEXT,
  -- 블로거 설정
  blogger_api_key TEXT,
  blogger_client_id TEXT,
  blogger_blog_id TEXT,
  -- 기본 설정
  default_tool TEXT DEFAULT 'affiliate',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 생성된 글 기록 테이블
CREATE TABLE IF NOT EXISTS generated_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tool_type TEXT NOT NULL,  -- 'affiliate'|'naver_seo'|'google_seo'|'policy'|'referral'|'adsense'
  title TEXT,
  keyword TEXT,
  content TEXT,
  schema_markup TEXT,
  image_url TEXT,
  word_count INTEGER DEFAULT 0,
  published_to TEXT,  -- 'wordpress'|'blogger'|null
  published_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 관리자 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 사용량 로그 테이블
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tool_type TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'generate'|'image'|'schema'|'publish'
  tokens_used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_user ON generated_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_tool ON generated_posts(tool_type);
CREATE INDEX IF NOT EXISTS idx_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON usage_logs(created_at);

-- 기본 관리자 계정 생성
-- 비밀번호: admin1234 (SHA-256 해시)
INSERT OR IGNORE INTO users (email, password_hash, name, role)
VALUES ('admin@aibp.local', 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', 'Administrator', 'admin');

-- 기본 시스템 설정
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_registration', 'true');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_users', '100');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('site_name', 'AIBP - AI Blog Platform');
