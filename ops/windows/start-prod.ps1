Param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
$logsDir = Join-Path $backendDir "logs"
$outLog = Join-Path $logsDir "uvicorn.out.log"
$errLog = Join-Path $logsDir "uvicorn.err.log"

if (-not (Test-Path $pythonExe)) {
  throw "Python venv not found: $pythonExe"
}

if (-not (Test-Path $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

Write-Host "[1/4] Building frontend..." -ForegroundColor Cyan
Push-Location $frontendDir
try {
  npm run build | Out-Host
}
finally {
  Pop-Location
}

Write-Host "[2/4] Stopping old backend process on port $Port..." -ForegroundColor Cyan
$listen = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if ($listen) {
  foreach ($item in $listen) {
    try { Stop-Process -Id $item.OwningProcess -Force -ErrorAction Stop } catch {}
  }
  Start-Sleep -Seconds 1
}

Write-Host "[3/4] Starting backend..." -ForegroundColor Cyan
Start-Process `
  -FilePath $pythonExe `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$Port" `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

Write-Host "[4/4] Opening firewall..." -ForegroundColor Cyan
$ruleName = "CryptoProcessing Backend $Port"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port | Out-Null
}

$running = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $running) {
  throw "Backend did not start on port $Port. Check logs: $errLog"
}

Write-Host "Done. App is running on http://0.0.0.0:$Port" -ForegroundColor Green
Write-Host "Logs:" -ForegroundColor Green
Write-Host "  $outLog"
Write-Host "  $errLog"
