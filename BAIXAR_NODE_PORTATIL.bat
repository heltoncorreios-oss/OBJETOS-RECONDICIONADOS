@echo off
chcp 65001 >nul
title CORREIOS - Download do Node.js Portátil
color 1F

echo ======================================================================
echo          DOWNLOAD AUTOMÁTICO DO NODE.JS PORTÁTIL (STANDALONE)
echo             Não requer permissão de administrador no Windows!
echo ======================================================================
echo.

cd /d "%~dp0"

if exist "%~dp0node-portable\node.exe" (
    echo [OK] O Node.js portátil já está presente em "%~dp0node-portable".
    pause
    exit /b 0
)

echo Baixando versão oficial e estável do Node.js para Windows (x64)...
echo Aguarde alguns instantes (o download possui cerca de 30 MB)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip';" ^
    "$zipPath = Join-Path $pwd 'node-temp.zip';" ^
    "$destFolder = Join-Path $pwd 'node-temp';" ^
    "$finalFolder = Join-Path $pwd 'node-portable';" ^
    "Write-Host '[1/3] Efetuando download oficial de $url...';" ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "(New-Object System.Net.WebClient).DownloadFile($url, $zipPath);" ^
    "Write-Host '[2/3] Extraindo arquivos...';" ^
    "Expand-Archive -Path $zipPath -DestinationPath $destFolder -Force;" ^
    "Write-Host '[3/3] Configurando pasta node-portable...';" ^
    "$inner = Get-ChildItem -Path $destFolder -Directory | Select-Object -First 1;" ^
    "Move-Item -Path $inner.FullName -Destination $finalFolder -Force;" ^
    "Remove-Item -Path $zipPath -Force;" ^
    "Remove-Item -Path $destFolder -Recurse -Force;" ^
    "Write-Host '[CONCLUÍDO COM SUCESSO!] Node.js portátil configurado em node-portable!'"

if exist "%~dp0node-portable\node.exe" (
    echo.
    echo ======================================================================
    echo  Node.js instalado na pasta "node-portable" com sucesso!
    echo  Agora você pode iniciar o sistema clicando em INICIAR_SISTEMA.bat
    echo ======================================================================
    echo.
) else (
    echo.
    echo [AVISO] Se o download automático for bloqueado pela rede dos Correios,
    echo você pode baixar manualmente o arquivo .zip de https://nodejs.org
    echo e descompactar seu conteúdo diretamente dentro da pasta:
    echo "%~dp0node-portable\"
    echo.
)

pause
