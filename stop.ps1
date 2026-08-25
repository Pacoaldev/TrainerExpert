# Stop-TrainerExpert.ps1
$stopped = $false
foreach ($port in 8080, 8443) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    $stopped = $true
  }
}
if ($stopped) {
  Write-Output "TrainerExpert detenido (puertos 8080/8443)."
} else {
  Write-Output "TrainerExpert ya esta detenido."
}
Start-Sleep -Seconds 1
