#!/bin/bash
# SpecHouse server startup script
# Waits for Docker, starts DB, then backend + ngrok

cd "$(dirname "$0")"
LOG=/tmp/spechouse_backend.log
NGROK_LOG=/tmp/ngrok.log

echo "[spechouse] $(date) Starting..." >> $LOG

echo "[spechouse] Waiting for Docker..."
for i in $(seq 1 30); do
  docker info > /dev/null 2>&1 && break
  sleep 2
done

echo "[spechouse] Starting database..."
docker compose up -d

echo "[spechouse] Waiting for PostgreSQL..."
for i in $(seq 1 20); do
  docker exec spechouse_db pg_isready -U spechouse > /dev/null 2>&1 && break
  sleep 2
done

# Kill any existing uvicorn/ngrok on these ports
pkill -f "uvicorn backend.main:app" 2>/dev/null
pkill -f "ngrok http 8000" 2>/dev/null
sleep 1

echo "[spechouse] Starting backend..."
cd /Users/chao/.openclaw/workspace/spechouse
source backend/.venv/bin/activate
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000 >> $LOG 2>&1 &
UVICORN_PID=$!
echo "[spechouse] uvicorn PID=$UVICORN_PID" >> $LOG

echo "[spechouse] Starting ngrok..."
/opt/homebrew/bin/ngrok http 8000 --domain=matchable-hildegard-untransformed.ngrok-free.dev --log=stdout >> $NGROK_LOG 2>&1 &
NGROK_PID=$!
echo "[spechouse] ngrok PID=$NGROK_PID" >> $NGROK_LOG

echo "[spechouse] All services started. uvicorn=$UVICORN_PID ngrok=$NGROK_PID"
wait
