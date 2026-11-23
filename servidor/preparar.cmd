@echo off
rem Prepara o servidor do Entende+ neste computador. Basta rodar uma vez.
cd /d "%~dp0"

rem Python de 3.11 a 3.14. Versao recem-lancada (3.15) ainda nao tem todos os
rem pacotes prontos, e o pip tenta compilar e pede o Visual C++.
set "PY="
where py >nul 2>nul
if not errorlevel 1 (
  for %%v in (3.14 3.13 3.12 3.11) do (
    if not defined PY py -%%v -c "import sys" >nul 2>nul && set "PY=py -%%v"
  )
)
if not defined PY (
  python -c "import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] <= (3, 14) else 1)" >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo Precisa do Python 3.14 ^(ou 3.11, 3.12, 3.13^): https://www.python.org/downloads/windows/
  echo Na instalacao, marque "Add python.exe to PATH".
  pause
  exit /b 1
)
echo Usando %PY%

rem Ambiente criado antes com outra versao do Python: recria.
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python -c "import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] <= (3, 14) else 1)" >nul 2>nul
  if errorlevel 1 (
    echo O ambiente antigo e de outra versao do Python. Recriando...
    rmdir /s /q .venv
  )
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
