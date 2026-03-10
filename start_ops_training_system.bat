@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%.logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

set "NODE_HOME=%ROOT%.tools\node-v24.13.0-win-x64"
set "NPM_CMD=npm.cmd"
if exist "%NODE_HOME%\node.exe" (
  set "PATH=%NODE_HOME%;%PATH%"
  set "NPM_CMD=%NODE_HOME%\npm.cmd"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js was not found.
    echo Keep the bundled .tools folder, or install Node.js 20+ first.
    pause
    exit /b 1
  )
)

if exist "%ROOT%.venv\Scripts\python.exe" (
  set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
) else (
  set "PYTHON_BOOTSTRAP="
  where py >nul 2>nul && set "PYTHON_BOOTSTRAP=py -3"
  if not defined PYTHON_BOOTSTRAP (
    where python >nul 2>nul && set "PYTHON_BOOTSTRAP=python"
  )
  if not defined PYTHON_BOOTSTRAP (
    echo Python 3.11+ was not found.
    echo Install Python first, then run this script again.
    pause
    exit /b 1
  )

  echo Creating Python virtual environment...
  call %PYTHON_BOOTSTRAP% -m venv "%ROOT%.venv"
  if errorlevel 1 (
    echo Failed to create Python virtual environment.
    pause
    exit /b 1
  )
  set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
)

echo Installing backend requirements...
call "%PYTHON_EXE%" -m pip install --disable-pip-version-check -q -r "%ROOT%backend\requirements.txt"
if errorlevel 1 (
  echo Failed to install backend requirements.
  pause
  exit /b 1
)

if not exist "%ROOT%frontend\node_modules" (
  echo Installing frontend packages...
  pushd "%ROOT%frontend"
  call "%NPM_CMD%" install --no-fund --no-audit
  set "NPM_EXIT=%ERRORLEVEL%"
  popd
  if not "%NPM_EXIT%"=="0" (
    echo Failed to install frontend packages.
    pause
    exit /b 1
  )
)

echo Building frontend...
pushd "%ROOT%frontend"
call "%NPM_CMD%" run build
set "BUILD_EXIT=%ERRORLEVEL%"
popd
if not "%BUILD_EXIT%"=="0" (
  echo Frontend build failed.
  pause
  exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo Closing existing process on port 8000: %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo Starting backend server...
start "Ops Training Backend" cmd /c ""%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 1> "%LOG_DIR%\backend.out.log" 2> "%LOG_DIR%\backend.err.log""

set "HEALTH_OK="
for /l %%I in (1,1,20) do (
  powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 (
    set "HEALTH_OK=1"
    goto :READY
  )
  timeout /t 1 >nul
)

:READY
if defined HEALTH_OK (
  echo App started: http://127.0.0.1:8000
  echo Backend log: %LOG_DIR%\backend.out.log
  start "" "http://127.0.0.1:8000"
  exit /b 0
)

echo Startup failed. Check:
echo %LOG_DIR%\backend.err.log
type "%LOG_DIR%\backend.err.log"
pause
exit /b 1
