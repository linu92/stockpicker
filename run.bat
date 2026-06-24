@echo off
chcp 65001 > nul
echo ==================================================
echo         📈 한국 주식 눌림목 타점 검색기
echo ==================================================
echo.

cd /d "%~dp0"

echo 스트림릿 애플리케이션을 시작합니다...
echo 인터넷 브라우저가 자동으로 열립니다. 잠시만 기다려주세요!
echo.

:: 이미 만들어진 가상환경을 활성화하고 앱 실행
call venv\Scripts\activate.bat
python -m streamlit run app.py

pause
