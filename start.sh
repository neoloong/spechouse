#!/bin/bash
# Start SpecHouse — backend + frontend in parallel

# Start backend
source backend/.venv/bin/activate
uvicorn backend.main:app --reload &
BACKEND_PID=$!

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID  →  http://localhost:8000/docs"
echo "Frontend PID: $FRONTEND_PID  →  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both"

# Wait and clean up on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
