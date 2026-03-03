#!/bin/bash
# SpecHouse 一键启动脚本

set -e
cd "$(dirname "$0")"

echo "🐳 Starting PostgreSQL..."
docker compose up -d
sleep 3

echo "🚀 Starting backend..."
pkill -f "uvicorn backend" 2>/dev/null || true
sleep 1
source backend/.venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 > /tmp/spechouse-backend.log 2>&1 &
sleep 3

echo "🌐 Starting frontend..."
pkill -f "next dev" 2>/dev/null || true
sleep 1
cd frontend
npm run dev -- --hostname 0.0.0.0 --port 3000 > /tmp/spechouse-frontend.log 2>&1 &
sleep 5
cd ..

echo ""
echo "✅ SpecHouse is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Logs: /tmp/spechouse-backend.log | /tmp/spechouse-frontend.log"
