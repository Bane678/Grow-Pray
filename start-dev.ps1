# Jannah Garden - Dev Start Script
# Starts Metro bundler + localtunnel for use with Expo Go over VPN

Write-Host "`n🌿 Starting Jannah Garden dev server...`n" -ForegroundColor Green

# Kill any leftover ngrok/lt processes
Get-Process -Name ngrok, lt -ErrorAction SilentlyContinue | Stop-Process -Force

# Start Metro bundler in background
Write-Host "Starting Metro bundler on port 8081..." -ForegroundColor Cyan
$metro = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    npx expo start --clear 2>&1
}

# Wait for Metro to be ready
Write-Host "Waiting for Metro to initialize..." -ForegroundColor Yellow
Start-Sleep 8

# Start localtunnel
Write-Host "Starting localtunnel..." -ForegroundColor Cyan
$ltOutput = lt --port 8081 2>&1 &
Start-Sleep 4

# Get the tunnel URL
$rawOutput = & { lt --port 8081 2>&1 } &
Start-Sleep 4
$tunnelUrl = ($rawOutput | Select-String "https://.*\.loca\.lt").Matches.Value

if ($tunnelUrl) {
    $expoUrl = $tunnelUrl -replace "https://", "exp://"
    Write-Host "`n✅ Tunnel ready!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "Open Expo Go → tap the search bar → enter:" -ForegroundColor White
    Write-Host ""
    Write-Host "   $expoUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
} else {
    Write-Host "`n⚠️  Could not get tunnel URL. Run manually:" -ForegroundColor Yellow
    Write-Host "   lt --port 8081" -ForegroundColor White
    Write-Host "   (replace 'https://' with 'exp://' in the URL shown)" -ForegroundColor Gray
}

# Keep Metro logs visible
Write-Host "`nMetro bundler logs:" -ForegroundColor DarkGray
Receive-Job $metro -Wait
