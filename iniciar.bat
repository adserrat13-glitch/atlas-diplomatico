@echo off
cd /d "%~dp0"
echo ============================================
echo   ATLAS DIPLOMATICO - Iniciando servidor...
echo   Acesse: http://localhost:8766/login.html
echo   Pressione Ctrl+C para encerrar
echo ============================================
start "" "http://localhost:8766/login.html"
python -m http.server 8766
pause
