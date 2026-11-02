# Post-build script - Copy serve scripts to dist/

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$distDir = Join-Path $rootDir "dist"

Write-Host ""
Write-Host "Post-build tasks..." -ForegroundColor Cyan

# Copy serve.sh
$shSource = Join-Path $scriptDir "serve.sh"
$shDest = Join-Path $distDir "serve.sh"
if (Test-Path $shSource) {
    Copy-Item -Path $shSource -Destination $shDest -Force
    Write-Host "[OK] serve.sh copied to dist/" -ForegroundColor Green
}

# Copy serve.ps1
$ps1Source = Join-Path $scriptDir "serve.ps1"
$ps1Dest = Join-Path $distDir "serve.ps1"
if (Test-Path $ps1Source) {
    Copy-Item -Path $ps1Source -Destination $ps1Dest -Force
    Write-Host "[OK] serve.ps1 copied to dist/" -ForegroundColor Green
}

Write-Host "Post-build tasks completed" -ForegroundColor Green
Write-Host ""
