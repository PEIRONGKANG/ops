@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%.logs"
set "REQ_FILE=%ROOT%backend\requirements.txt"
set "DIST_INDEX=%ROOT%frontend\dist\index.html"
set "WHEEL_DIR=%ROOT%.vendor\python-wheels"
set "PYTHON_INSTALLER=%ROOT%.vendor\python-installer\python-3.11.9-amd64.exe"
set "PYTHON_DOWNLOAD_URL=https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
set "PYTHON_BOOTSTRAP="
set "PYTHON_EXE="
set "NPM_CMD="

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :resolve_python_bootstrap
if errorlevel 1 goto :FAIL

call :ensure_virtualenv
if errorlevel 1 goto :FAIL

call :install_backend_requirements
if errorlevel 1 goto :FAIL

call :ensure_frontend_dist
if errorlevel 1 goto :FAIL

call :stop_existing_port_8000

echo Starting backend server...
start "Ops Training Backend" cmd /c ""%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 1> "%LOG_DIR%\backend.out.log" 2> "%LOG_DIR%\backend.err.log""

set "HEALTH_OK="
for /l %%I in (1,1,30) do (
  "%PYTHON_EXE%" -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).getcode() == 200 else 1)" >nul 2>nul
  if not errorlevel 1 (
    set "HEALTH_OK=1"
    goto :READY
  )
  timeout /t 1 >nul
)

:READY
if defined HEALTH_OK (
  echo.
  echo App started successfully: http://127.0.0.1:8000
  echo Backend log: %LOG_DIR%\backend.out.log
  echo Database: %ROOT%backend\data\ops_training.db
  if /I not "%NO_BROWSER%"=="1" start "" "http://127.0.0.1:8000"
  exit /b 0
)

echo Startup failed. Please check:
echo %LOG_DIR%\backend.err.log
if exist "%LOG_DIR%\backend.err.log" type "%LOG_DIR%\backend.err.log"
goto :FAIL

:resolve_python_bootstrap
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" -V >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_BOOTSTRAP=%ROOT%.venv\Scripts\python.exe"
    goto :eof
  )
)

for /f "usebackq delims=" %%P in (`py -3.11 -c "import sys; print(sys.executable)" 2^>nul`) do (
  set "PYTHON_BOOTSTRAP=%%P"
)
if defined PYTHON_BOOTSTRAP goto :eof

for /f "usebackq delims=" %%P in (`py -3 -c "import sys; print(sys.executable)" 2^>nul`) do (
  set "PYTHON_BOOTSTRAP=%%P"
)
if defined PYTHON_BOOTSTRAP goto :eof

for /f "usebackq delims=" %%P in (`python -c "import sys; print(sys.executable)" 2^>nul`) do (
  set "PYTHON_BOOTSTRAP=%%P"
)
if defined PYTHON_BOOTSTRAP goto :eof

if exist "%LocalAppData%\Programs\Python\Python311\python.exe" (
  set "PYTHON_BOOTSTRAP=%LocalAppData%\Programs\Python\Python311\python.exe"
  goto :eof
)

echo Python 3.11 was not detected. Bootstrapping Python...
call :install_python_311
if errorlevel 1 exit /b 1

for /f "usebackq delims=" %%P in (`py -3.11 -c "import sys; print(sys.executable)" 2^>nul`) do (
  set "PYTHON_BOOTSTRAP=%%P"
)
if defined PYTHON_BOOTSTRAP goto :eof

if exist "%LocalAppData%\Programs\Python\Python311\python.exe" (
  set "PYTHON_BOOTSTRAP=%LocalAppData%\Programs\Python\Python311\python.exe"
  goto :eof
)

echo Failed to locate Python after installation.
exit /b 1

:install_python_311
if not exist "%PYTHON_INSTALLER%" (
  echo Downloading Python installer...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing '%PYTHON_DOWNLOAD_URL%' -OutFile '%PYTHON_INSTALLER%'"
  if errorlevel 1 (
    echo Failed to download Python installer.
    exit /b 1
  )
)

echo Installing Python 3.11 for current user...
start /wait "" "%PYTHON_INSTALLER%" /quiet InstallAllUsers=0 Include_launcher=1 Include_pip=1 Include_test=0 SimpleInstall=1 Shortcuts=0 PrependPath=1
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" if not "%INSTALL_EXIT%"=="3010" (
  echo Python installer exited with code %INSTALL_EXIT%.
  exit /b 1
)
exit /b 0

:ensure_virtualenv
if exist "%ROOT%.venv\Scripts\python.exe" (
  "%ROOT%.venv\Scripts\python.exe" -V >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
    goto :eof
  )
)

if exist "%ROOT%.venv" (
  echo Recreating local virtual environment...
  rmdir /s /q "%ROOT%.venv"
)

echo Creating local virtual environment...
"%PYTHON_BOOTSTRAP%" -m venv "%ROOT%.venv"
if errorlevel 1 (
  echo Failed to create Python virtual environment.
  exit /b 1
)

set "PYTHON_EXE=%ROOT%.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" exit /b 0

echo Virtual environment was created but python.exe was not found.
exit /b 1

:install_backend_requirements
echo Preparing Python runtime...
"%PYTHON_EXE%" -m ensurepip --upgrade >nul 2>nul

if exist "%WHEEL_DIR%\*.whl" (
  echo Installing backend requirements from local offline wheels...
  "%PYTHON_EXE%" -m pip install --disable-pip-version-check --no-index --find-links "%WHEEL_DIR%" -r "%REQ_FILE%"
  if not errorlevel 1 goto :eof
  echo Local wheel install failed. Falling back to online install...
)

echo Installing backend requirements...
"%PYTHON_EXE%" -m pip install --disable-pip-version-check -r "%REQ_FILE%"
if errorlevel 1 (
  echo Failed to install backend requirements.
  exit /b 1
)
exit /b 0

:ensure_frontend_dist
if /I "%FORCE_FRONTEND_BUILD%"=="1" goto :BUILD_FRONTEND
if exist "%DIST_INDEX%" (
  echo Using bundled frontend build: frontend\dist
  exit /b 0
)

:BUILD_FRONTEND
echo Frontend dist was not found. Building frontend...
call :resolve_node
if errorlevel 1 exit /b 1

if not exist "%ROOT%frontend\node_modules" (
  echo Installing frontend packages...
  pushd "%ROOT%frontend"
  call "%NPM_CMD%" ci --no-fund --no-audit
  set "NPM_EXIT=%ERRORLEVEL%"
  popd
  if not "%NPM_EXIT%"=="0" (
    echo Failed to install frontend packages.
    exit /b 1
  )
)

pushd "%ROOT%frontend"
call "%NPM_CMD%" run build
set "BUILD_EXIT=%ERRORLEVEL%"
popd
if not "%BUILD_EXIT%"=="0" (
  echo Frontend build failed.
  exit /b 1
)
exit /b 0

:resolve_node
if exist "%ROOT%.tools\node-v24.13.0-win-x64\npm.cmd" (
  set "NPM_CMD=%ROOT%.tools\node-v24.13.0-win-x64\npm.cmd"
  set "PATH=%ROOT%.tools\node-v24.13.0-win-x64;%PATH%"
  exit /b 0
)

where npm >nul 2>nul
if not errorlevel 1 (
  set "NPM_CMD=npm.cmd"
  exit /b 0
)

echo Node.js was not found, and the bundled .tools folder is missing.
echo Please copy the complete project folder, or keep frontend\dist in place.
exit /b 1

:stop_existing_port_8000
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo Closing existing process on port 8000: %%P
  taskkill /PID %%P /F >nul 2>nul
)
exit /b 0

:FAIL
echo.
echo Startup did not complete.
pause
exit /b 1
