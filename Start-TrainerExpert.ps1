# Start-TrainerExpert.ps1
$projectDir = "c:\Users\spano\Documents\PROYECTOS\TrainerExpert"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx -y http-server -p 8080" -WorkingDirectory $projectDir -WindowStyle Hidden
Start-Sleep -Seconds 3
Start-Process -FilePath "C:\Program Files\Perplexity\Comet\Application\comet.exe" -ArgumentList "http://localhost:8080"
