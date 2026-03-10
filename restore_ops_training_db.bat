@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "ROOT=%~dp0"
set "DB_FILE=%ROOT%backend\data\ops_training.db"
set "BACKUP_DIR=%ROOT%database-backups"
set "SOURCE_FILE=%~1"

if "%SOURCE_FILE%"=="" (
  echo Usage:
  echo Drag a .db backup file onto this bat,
  echo or run: restore_ops_training_db.bat "C:\path\to\ops_training.db"
  call :END 1
)

if not exist "%SOURCE_FILE%" (
  echo Backup file was not found:
  echo %SOURCE_FILE%
  call :END 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%T"
if exist "%DB_FILE%" (
  copy /y "%DB_FILE%" "%BACKUP_DIR%\before_restore_%STAMP%.db" >nul
)

copy /y "%SOURCE_FILE%" "%DB_FILE%" >nul
if errorlevel 1 (
  echo Failed to restore database.
  call :END 1
)

echo Database restored successfully:
echo %DB_FILE%
echo Please restart the project after restore.
call :END 0

:END
set "EXIT_CODE=%~1"
if /I not "%NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
