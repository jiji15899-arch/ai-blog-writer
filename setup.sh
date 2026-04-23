#!/bin/bash
# ============================================================
# AIBP - Cloudflare Pages 자동 설정 스크립트
# 사용법: bash setup.sh
# ============================================================

echo "🚀 AIBP - AI Blog Platform 설정 시작"
echo "======================================"

# wrangler 설치 확인
if ! command -v wrangler &> /dev/null; then
    echo "📦 wrangler 설치 중..."
    npm install -g wrangler
fi

echo ""
echo "1️⃣  Cloudflare 로그인 확인..."
wrangler whoami || wrangler login

echo ""
echo "2️⃣  D1 데이터베이스 생성..."
DB_OUTPUT=$(wrangler d1 create aibp-db 2>&1)
echo "$DB_OUTPUT"
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | grep -o '"[^"]*"' | tr -d '"')

if [ -z "$DB_ID" ]; then
    echo "⚠️  기존 DB ID를 확인하세요. wrangler.toml에 직접 입력해야 할 수 있습니다."
else
    echo "✅ D1 Database ID: $DB_ID"
    sed -i "s/YOUR_D1_DATABASE_ID/$DB_ID/g" wrangler.toml
fi

echo ""
echo "3️⃣  KV Namespace 생성 (KV)..."
KV_OUTPUT=$(wrangler kv:namespace create "KV" 2>&1)
echo "$KV_OUTPUT"
KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | grep -o '"[^"]*"' | tr -d '"')
if [ -n "$KV_ID" ]; then
    sed -i "s/YOUR_KV_NAMESPACE_ID/$KV_ID/g" wrangler.toml
    echo "✅ KV KV ID: $KV_ID"
fi

echo ""
echo "4️⃣  KV Namespace 생성 (Cache)..."
KV_CACHE_OUTPUT=$(wrangler kv:namespace create "CACHE" 2>&1)
echo "$KV_CACHE_OUTPUT"
KV_CACHE_ID=$(echo "$KV_CACHE_OUTPUT" | grep -o 'id = "[^"]*"' | grep -o '"[^"]*"' | tr -d '"')
if [ -n "$KV_CACHE_ID" ]; then
    sed -i "s/YOUR_CACHE_KV_ID/$KV_CACHE_ID/g" wrangler.toml
    echo "✅ Cache-KV ID: $KV_CACHE_ID"
fi

echo ""
echo "5️⃣  D1 스키마 적용..."
wrangler d1 execute aibp-db --file=schema.sql
echo "✅ 스키마 적용 완료"

echo ""
echo "6️⃣  JWT Secret 생성..."
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
sed -i "s/CHANGE_THIS_TO_RANDOM_SECRET/$JWT_SECRET/g" wrangler.toml
echo "✅ JWT Secret 설정 완료"

echo ""
echo "======================================"
echo "✅ 설정 완료!"
echo ""
echo "📝 다음 단계:"
echo "  1. wrangler.toml의 SITE_URL을 실제 도메인으로 변경"
echo "  2. wrangler pages deploy public --project-name=aibp-pages"
echo ""
echo "🔐 기본 관리자 계정:"
echo "  이메일: admin@aibp.local"
echo "  비밀번호: admin1234"
echo "  (첫 로그인 후 반드시 변경하세요)"
echo "======================================"
