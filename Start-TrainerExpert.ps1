# Start-TrainerExpert.ps1
$projectDir = "c:\Users\spano\Documents\PROYECTOS\TrainerExpert"
Start-Process -FilePath "npx" -ArgumentList "http-server", "-p", "8080" -WorkingDirectory $projectDir -WindowStyle Hidden
Start-Sleep -Seconds 1
Start-Process "http://localhost:8080"
