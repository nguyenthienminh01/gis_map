@echo off
start cmd /k "cd backend && ..\venv\Scripts\uvicorn.exe main:app --reload"
start cmd /k "cd frontend && npm run dev"
