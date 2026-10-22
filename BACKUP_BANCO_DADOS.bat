@echo off
chcp 65001 >nul
title CORREIOS - Backup do Banco de Dados Local
color 1F

echo ======================================================================
echo             BACKUP DO BANCO DE DADOS LOCAL - CORREIOS
echo ======================================================================
echo.

cd /d "%~dp0"

:: Formatar data e hora para o nome do backup
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%h%datetime:~10,2%m"

if not exist "%~dp0backups" mkdir "%~dp0backups"

set "BACKUP_DIR=%~dp0backups\backup_%TIMESTAMP%"
mkdir "%BACKUP_DIR%"

echo Copiando dados atuais...
if exist "%~dp0data\banco_dados.json" (
    copy "%~dp0data\banco_dados.json" "%BACKUP_DIR%\" >nul
    echo [OK] banco_dados.json copiado.
)

if exist "%~dp0data\configuracoes.json" (
    copy "%~dp0data\configuracoes.json" "%BACKUP_DIR%\" >nul
    echo [OK] configuracoes.json copiado.
)

echo.
echo ======================================================================
echo  Backup concluído com sucesso em:
echo  %BACKUP_DIR%
echo ======================================================================
echo.
pause
