@echo off
title StockPicker V2 Local Runner

cd /d "%~dp0"

echo Starting Backend Server (FastAPI)...
start "StockPicker Backend" cmd /k "call venv\Scripts\activate.bat & cd backend & uvicorn main:app --reload --port 8000"

echo Starting Frontend Server (Next.js)...
start "StockPicker Frontend" cmd /k "cd frontend & npm run dev"

echo.
echo Both servers have been started in separate windows.
echo Please open http://localhost:3000 in your browser.
echo.
pause
