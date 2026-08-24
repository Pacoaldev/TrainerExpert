# Stop-TrainerExpert.ps1
$connections = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue
if ($connections) {
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Write-Output "TrainerExpert detenido con exito."
} else {
    Write-Output "TrainerExpert ya esta detenido (puerto 8080 libre)."
}
Start-Sleep -Seconds 2
