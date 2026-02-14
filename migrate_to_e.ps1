$dest = "E:\Coding"
$userProfile = $env:USERPROFILE

# Paths to move
$projectSource = "C:\Users\sayee\.gemini\antigravity\scratch\jannah-garden"
$geminiSource = "C:\Users\sayee\.gemini"
$extensionsSource = "C:\Users\sayee\.vscode\extensions"

# Destinations
$projectDest = Join-Path $dest "jannah-garden"
$geminiDest = Join-Path $dest ".gemini"
$extensionsDest = Join-Path $dest "extensions"

Write-Host "Creating destination directory if it doesn't exist..." -ForegroundColor Cyan
if (!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest }

Write-Host "Moving Project Files..." -ForegroundColor Cyan
Move-Item -Path $projectSource -Destination $projectDest -ErrorAction SilentlyContinue

Write-Host "Moving Agent Data (.gemini)..." -ForegroundColor Cyan
Move-Item -Path $geminiSource -Destination $geminiDest -ErrorAction SilentlyContinue

Write-Host "Moving Extensions..." -ForegroundColor Cyan
Move-Item -Path $extensionsSource -Destination $extensionsDest -ErrorAction SilentlyContinue

Write-Host "Creating Launch Script..." -ForegroundColor Cyan
$launchScriptPath = Join-Path $dest "launch_antigravity.ps1"
$launchScriptContent = @"
& `"`$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe`" --user-data-dir `"E:\Coding\.gemini\antigravity`" --extensions-dir `"E:\Coding\extensions`" `"E:\Coding\jannah-garden`"
"@
Set-Content -Path $launchScriptPath -Value $launchScriptContent

Write-Host "Migration complete! Please close Antigravity and run the launch script from E:\Coding." -ForegroundColor Green
