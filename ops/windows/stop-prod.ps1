Param(
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$listen = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $listen) {
  Write-Host "No process is listening on port $Port."
  exit 0
}

foreach ($item in $listen) {
  try {
    Stop-Process -Id $item.OwningProcess -Force -ErrorAction Stop
    Write-Host "Stopped PID $($item.OwningProcess) on port $Port."
  }
  catch {
    Write-Warning "Cannot stop PID $($item.OwningProcess): $($_.Exception.Message)"
  }
}
