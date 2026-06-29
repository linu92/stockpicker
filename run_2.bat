@echo off
chcp 65001 > nul
echo ==================================================
echo         🚀 StockPicker V2 로컬 실행기
echo ==================================================
echo.

cd /d "%~dp0"

echo [1/2] 백엔드 서버(FastAPI)를 시작합니다...
start "StockPicker Backend" cmd /k "call venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload --port 8000"

echo [2/2] 프론트엔드 서버(Next.js)를 시작합니다...
start "StockPicker Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo 모든 서버가 실행되었습니다!
echo 까만색 터미널 창 2개가 새로 열렸는지 확인해 주세요.
echo 잠시 후 인터넷 브라우저에서 http://localhost:3000 으로 접속하시면 됩니다.
echo.
pause
