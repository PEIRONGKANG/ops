param(
  [Parameter(Mandatory = $true)]
  [string]$SshHost,

  [Parameter(Mandatory = $true)]
  [string]$SshUser,

  [int]$SshPort = 22,

  [string]$KeyPath = "",

  [string]$RemoteDir = "/srv/ops-training-system",

  [string]$ServiceName = "ops-training",

  [int]$AppPort = 8000,

  [string]$RepoUrl = "",

  [string]$Branch = "",

  [switch]$ForwardAgent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distIndex = Join-Path $projectRoot "frontend\dist\index.html"
$backendRequirements = Join-Path $projectRoot "backend\requirements.txt"
$remoteTarget = "$SshUser@$SshHost"

if (-not (Test-Path $distIndex)) {
  throw "Missing frontend/dist/index.html. Commit or build the frontend before deploying."
}

if (-not (Test-Path $backendRequirements)) {
  throw "Missing backend/requirements.txt. The backend dependency list is required for deployment."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find git. Install Git for Windows first."
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "The local machine cannot find the ssh command. Install Windows OpenSSH Client first."
}

$resolvedRepoUrl = $RepoUrl
if ([string]::IsNullOrWhiteSpace($resolvedRepoUrl)) {
  $resolvedRepoUrl = (git -C $projectRoot remote get-url origin).Trim()
  if ([string]::IsNullOrWhiteSpace($resolvedRepoUrl)) {
    throw "Unable to resolve the local origin remote. Pass -RepoUrl explicitly."
  }
}

$resolvedBranch = $Branch
if ([string]::IsNullOrWhiteSpace($resolvedBranch)) {
  $resolvedBranch = (git -C $projectRoot branch --show-current).Trim()
  if ([string]::IsNullOrWhiteSpace($resolvedBranch)) {
    $resolvedBranch = "main"
  }
}

$sshArgs = @("-p", $SshPort.ToString())
if ($ForwardAgent) {
  $sshArgs += "-A"
}

if ($KeyPath) {
  $resolvedKey = (Resolve-Path $KeyPath).Path
  $sshArgs += @("-i", $resolvedKey)
}

function Invoke-RemoteCommand {
  param([string]$RemoteCommand)

  & ssh @sshArgs $remoteTarget $RemoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw "The remote command failed."
  }
}

$shellSingleQuoteEscape = "'`"`'`"`'"
$escapedRepoUrl = $resolvedRepoUrl.Replace("'", $shellSingleQuoteEscape)
$escapedBranch = $resolvedBranch.Replace("'", $shellSingleQuoteEscape)
$escapedRemoteDir = $RemoteDir.Replace("'", $shellSingleQuoteEscape)
$escapedServiceName = $ServiceName.Replace("'", $shellSingleQuoteEscape)
$escapedSshUser = $SshUser.Replace("'", $shellSingleQuoteEscape)

$remoteScript = @"
set -euo pipefail

APP_ROOT='$escapedRemoteDir'
REPO_DIR="\$APP_ROOT/repo"
SERVICE_NAME='$escapedServiceName'
APP_PORT='$AppPort'
BRANCH='$escapedBranch'
REPO_URL='$escapedRepoUrl'
RUN_USER='$escapedSshUser'

need_pkg_install=false
if ! command -v git >/dev/null 2>&1; then need_pkg_install=true; fi
if ! command -v python3 >/dev/null 2>&1; then need_pkg_install=true; fi
if ! python3 -m venv --help >/dev/null 2>&1; then need_pkg_install=true; fi
if ! command -v curl >/dev/null 2>&1; then need_pkg_install=true; fi

if [ "\$need_pkg_install" = true ]; then
  sudo apt-get update -y
  sudo apt-get install -y git python3 python3-venv curl
fi

mkdir -p "\$APP_ROOT/shared/data" "\$APP_ROOT/shared/logs"

if [ ! -d "\$REPO_DIR/.git" ]; then
  mkdir -p "\$APP_ROOT"
  git clone "\$REPO_URL" "\$REPO_DIR"
fi

cd "\$REPO_DIR"
git remote set-url origin "\$REPO_URL"
git fetch --all --prune
git checkout "\$BRANCH"
git reset --hard "origin/\$BRANCH"
git clean -fd

if [ ! -f "\$REPO_DIR/frontend/dist/index.html" ]; then
  echo "frontend/dist/index.html is missing after pull. Make sure the built frontend is committed to the repository." >&2
  exit 1
fi

if [ ! -d "\$APP_ROOT/.venv" ]; then
  python3 -m venv "\$APP_ROOT/.venv"
fi

"\$APP_ROOT/.venv/bin/python" -m pip install --upgrade pip
"\$APP_ROOT/.venv/bin/python" -m pip install -r "\$REPO_DIR/backend/requirements.txt"

cat > "/tmp/\$SERVICE_NAME.service" <<SERVICE
[Unit]
Description=Ops Training System
After=network.target

[Service]
Type=simple
User=\$RUN_USER
WorkingDirectory=\$REPO_DIR
Environment=OPS_TRAINING_DB_PATH=\$APP_ROOT/shared/data/ops_training.db
ExecStart=\$APP_ROOT/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port \$APP_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv "/tmp/\$SERVICE_NAME.service" "/etc/systemd/system/\$SERVICE_NAME.service"
sudo systemctl daemon-reload
sudo systemctl enable "\$SERVICE_NAME"
sudo systemctl restart "\$SERVICE_NAME"
sleep 2
curl -fsS "http://127.0.0.1:\$APP_PORT/api/health"
"@

Write-Host "Deploying from repository: $resolvedRepoUrl"
Write-Host "Branch: $resolvedBranch"
Write-Host "Target: $remoteTarget"
Invoke-RemoteCommand -RemoteCommand $remoteScript
Write-Host "Deployment finished successfully."
Write-Host "Health endpoint: http://$SshHost`:$AppPort/api/health"
