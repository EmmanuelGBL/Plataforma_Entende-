@echo off
rem Prepara o servidor do Entende+ neste computador. Basta rodar uma vez.
cd /d "%~dp0"
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if errorlevel 1 (
  echo Precisa do Python 3.11 ou mais novo: https://www.python.org/downloads/
  echo Na instalacao, marque "Add python.exe to PATH".
  pause
  exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo Criando o ambiente do Python...
  %PY% -m venv .venv
  if errorlevel 1 goto erro
)
echo Instalando as dependencias (leva alguns minutos na primeira vez)...
.venv\Scripts\python -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 goto erro
if not exist .env (
  echo.
  echo Falta o arquivo .env nesta pasta. Ele nao vem do GitHub: peca ao Emmanuel.
  pause
  exit /b 1
)
echo.
echo Pronto. Para apresentar, de dois cliques em apresentar.cmd.
pause
exit /b 0

:erro
echo.
echo Algo deu errado. Se o erro falar de "Long Path", mova a pasta para C:\Entende
echo e rode de novo. Se for outro, mande um print desta janela ao Emmanuel.
pause
exit /b 1
