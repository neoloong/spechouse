#!/bin/bash
# SpecHouse server startup script
# Waits for Docker, starts DB, then backend + ngrok

cd "$(dirname "$0")"

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

echo "[spechouse] Starting backend..."
.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 &

echo "[spechouse] Starting ngrok..."
/opt/homebrew/bin/ngrok http 8000 --domain=matchable-hildegard-untransformed.ngrok-free.dev --log=stdout >> /tmp/ngrok.log 2>&1 &

echo "[spechouse] All services started."
wait
