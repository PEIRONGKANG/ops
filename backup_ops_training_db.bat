@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "ROOT=%~dp0"
set "DB_FILE=%ROOT%backend\data\ops_training.db"
set "BACKUP_DIR=%ROOT%database-backups"

if not exist "%DB_FILE%" (
  echo Database file was not found:
  echo %DB_FILE%
  call :END 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%T"
set "TARGET_FILE=%BACKUP_DIR%\ops_training_%STAMP%.db"

copy /y "%DB_FILE%" "%TARGET_FILE%" >nul
if errorlevel 1 (
  echo Failed to create database backup.
  call :END 1
)

echo Database backup created:
echo %TARGET_FILE%
call :END 0

:END
set "EXIT_CODE=%~1"
if /I not "%NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
