Param(
  [int]$Port = 8000
)

$listen = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $listen) {
  Write-Host "Status: DOWN (no listener on port $Port)" -ForegroundColor Red
  exit 1
}

$reported = $false
foreach ($item in $listen) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($item.OwningProcess)"
  if (-not $proc) {
    continue
  }

  Write-Host "Status: UP" -ForegroundColor Green
  Write-Host "Port: $Port"
  Write-Host "LocalAddress: $($item.LocalAddress)"
  Write-Host "PID: $($item.OwningProcess)"
  Write-Host "Command: $($proc.CommandLine)"
  $reported = $true
}

if (-not $reported) {
  Write-Host "Status: UP (listener exists, process details unavailable)" -ForegroundColor Yellow
  $listen | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table -AutoSize
}
