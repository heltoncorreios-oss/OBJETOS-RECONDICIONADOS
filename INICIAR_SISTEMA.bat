@echo off
chcp 65001 >nul
title CORREIOS - Sistema de Controle de Objetos Recondicionados
color 1F

echo ======================================================================
echo           CORREIOS - SISTEMA DE CONTROLE E TERMOS
echo               CDD SÃO MANUEL - MULTI-COMPUTADOR
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Verificar se o Node.js portátil embutido existe na pasta
set "NODE_CMD="
if exist "%~dp0node-portable\node.exe" (
    echo [OK] Utilizando Node.js Portatil Embutido: %~dp0node-portable\node.exe
    set "NODE_CMD=%~dp0node-portable\node.exe"
    set "PATH=%~dp0node-portable;%PATH%"
) else (
    :: 2. Verificar se o Node.js está instalado no Windows
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        echo [OK] Node.js detectado no sistema Windows.
        set "NODE_CMD=node"
    ) else (
        echo [AVISO] Node.js nao encontrado neste computador!
        echo.
        echo ATENCAO: Este computador precisa do Node.js instalado ou da pasta "node-portable".
        echo Vamos baixar e configurar automaticamente o Node.js Portatil agora mesmo.
        echo.
        pause
        call "%~dp0BAIXAR_NODE_PORTATIL.bat"
        if exist "%~dp0node-portable\node.exe" (
            set "NODE_CMD=%~dp0node-portable\node.exe"
            set "PATH=%~dp0node-portable;%PATH%"
        ) else (
            echo.
            echo [ERRO] Nao foi possivel obter o Node.js.
            echo Por favor, execute "BAIXAR_NODE_PORTATIL.bat" manualmente.
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo ======================================================================
echo   INICIANDO O SERVIDOR DO BANCO DE DADOS LOCAL NA PORTA 3000...
echo ======================================================================
echo.

:: Descobrir o IP local deste computador para exibir aos colegas de trabalho
echo IPs DE ACESSO PARA OS OUTROS COMPUTADORES DA UNIDADE:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    echo   ==^> http:%%a:3000
)
echo.
echo * Para usar neste computador: http://localhost:3000
echo * Mantenha esta janela aberta enquanto o sistema estiver em uso.
echo ======================================================================
echo.

:: Abrir o navegador automaticamente após 2 segundos em segundo plano
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

:: Executar o servidor
if exist "%~dp0node_modules" (
    "%NODE_CMD%" server.ts
) else (
    echo Instalando dependencias essenciais pela primeira vez (pode demorar alguns segundos)...
    call npm install
    "%NODE_CMD%" server.ts
)

echo.
echo [AVISO] O servidor foi encerrado.
pause
