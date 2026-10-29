@echo off
rem Liga o servidor do Entende+ e abre o GitHub Pages pronto para apresentar.
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Rode primeiro o preparar.cmd.
  pause
  exit /b 1
)
if not exist .env (
  echo Falta o arquivo .env nesta pasta. Ele nao vem do GitHub: peca ao Emmanuel.
  pause
  exit /b 1
)
rem --no-access-log: o registro de acesso gravaria o IP de quem abre a atividade (RN05).
start "Servidor do Entende+ - nao feche durante a apresentacao" .venv\Scripts\python -m uvicorn app.principal:app --no-access-log --host 127.0.0.1 --port 8000
.venv\Scripts\python apresentar.py
pause
