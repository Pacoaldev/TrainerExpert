# Start-TrainerExpert.ps1
$projectDir = $PSScriptRoot
$pfx = Join-Path $projectDir "certs\dev.pfx"

if (-not (Test-Path $pfx)) {
  Write-Host "Generando certificado HTTPS local (necesario para micrófono en móvil)..."
  powershell -ExecutionPolicy Bypass -File (Join-Path $projectDir "scripts\generate-certs.ps1")
}

# Liberar puertos si quedaron colgados
foreach ($port in 8080, 8443) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($conns) {
    $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Sleep -Seconds 1

Start-Process -FilePath "cmd.exe" -ArgumentList "/c node server.js" -WorkingDirectory $projectDir -WindowStyle Hidden
Start-Sleep -Seconds 3
Start-Process "http://localhost:8080"
Write-Host "PC:  http://localhost:8080"
Write-Host "Movil (MIC): https://<tu-IP>:8443  (acepta el aviso del certificado)"
