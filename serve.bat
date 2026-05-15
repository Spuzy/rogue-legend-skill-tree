@echo off
REM Start a local static server so the browser can load js modules + icons.
REM Then open http://localhost:8000/ in your browser.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 -m http.server 8000 & exit /b)
where python >nul 2>nul && (python -m http.server 8000 & exit /b)
echo Python not found. Install Python or use any other local static server.
pause
