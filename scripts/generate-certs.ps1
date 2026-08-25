# Genera certificado HTTPS local para el micrófono en móvil (Chrome bloquea mic en HTTP+IP).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
if ((Split-Path -Leaf $PSScriptRoot) -ne 'scripts') {
  # allow running from repo root: .\scripts\generate-certs.ps1
  $root = Get-Location
  $scriptDir = Join-Path $root "scripts"
} else {
  $scriptDir = $PSScriptRoot
  $root = Split-Path -Parent $scriptDir
}

$certsDir = Join-Path $root "certs"
New-Item -ItemType Directory -Force -Path $certsDir | Out-Null

$dnsNames = New-Object System.Collections.Generic.List[string]
$dnsNames.Add("localhost") | Out-Null
$dnsNames.Add("127.0.0.1") | Out-Null

Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
  ForEach-Object { $dnsNames.Add($_.IPAddress) | Out-Null }

$unique = $dnsNames | Select-Object -Unique
Write-Host "SAN / DNS names: $($unique -join ', ')"

# Remove previous TrainerExpert certs from store (best-effort)
Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue |
  Where-Object { $_.Subject -like "*TrainerExpert*" } |
  ForEach-Object { Remove-Item $_.PSPath -Force -ErrorAction SilentlyContinue }

$cert = New-SelfSignedCertificate `
  -DnsName $unique `
  -FriendlyName "TrainerExpert Local HTTPS" `
  -Subject "CN=TrainerExpert Local" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(5) `
  -KeyExportPolicy Exportable `
  -KeySpec KeyExchange `
  -HashAlgorithm SHA256

$pfxPath = Join-Path $certsDir "dev.pfx"
$pass = ConvertTo-SecureString -String "trainerexpert" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pass | Out-Null

# Also export CER for optional manual trust on Android
$cerPath = Join-Path $certsDir "dev.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

Write-Host ""
Write-Host "OK: $pfxPath"
Write-Host "OK: $cerPath"
Write-Host "Passphrase PFX: trainerexpert"
Write-Host ""
Write-Host "En el movil abre: https://<tu-IP>:8443"
Write-Host "Chrome -> Avanzado -> Continuar (certificado autofirmado)."
