@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

if not exist "%BACKEND_DIR%" (
  echo [ERROR] Backend folder not found: %BACKEND_DIR%
  exit /b 1
)

if not exist "%FRONTEND_DIR%" (
  echo [ERROR] Frontend folder not found: %FRONTEND_DIR%
  exit /b 1
)

echo Starting backend and frontend...

start "CryptoProcessing Backend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%BACKEND_DIR%'; if (Test-Path '.venv\Scripts\Activate.ps1') { . '.venv\Scripts\Activate.ps1' }; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

start "CryptoProcessing Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location '%FRONTEND_DIR%'; npm run dev -- --host 127.0.0.1 --port 5173"

echo Done. Two windows were opened:
echo - Backend:  http://127.0.0.1:8000
echo - Frontend: http://127.0.0.1:5173

endlocal
