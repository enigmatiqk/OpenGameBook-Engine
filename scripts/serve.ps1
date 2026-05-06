# Gamebook Engine Server - Windows PowerShell
# Port: 8080

$PORT = 8080

Write-Host ""
Write-Host "🚀 Gamebook Engine Server" -ForegroundColor Green
Write-Host "📁 Serving from: $PSScriptRoot\..\dist"
Write-Host "🎮 Adventures directory: $PSScriptRoot\..\dist\adventures"

# ─── Régénérer le manifest ───────────────────────────────────────────────────

Write-Host ""
Write-Host "📋 Regenerating manifest.json..." -ForegroundColor Yellow

$distDir = Join-Path (Split-Path $PSScriptRoot) "dist"
$adventuresDir = Join-Path $distDir "adventures"
$manifestFile = Join-Path $adventuresDir "manifest.json"

# Créer le répertoire adventures s'il n'existe pas
if (-not (Test-Path $adventuresDir)) {
    New-Item -ItemType Directory -Path $adventuresDir -Force | Out-Null
}

# Créer le manifest
$adventures = @()
$dirs = Get-ChildItem -Path $adventuresDir -Directory -ErrorAction SilentlyContinue

foreach ($dir in $dirs) {
    $couverturePath = Join-Path $dir.FullName "couverture.json"
    if (Test-Path $couverturePath) {
        $adventures += @{ path = $dir.Name }
        Write-Host "  ✓ $($dir.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $($dir.Name) (missing couverture.json)" -ForegroundColor Red
    }
}

$manifest = @{ adventures = $adventures }
$manifestJson = $manifest | ConvertTo-Json -Depth 10
Set-Content -Path $manifestFile -Value $manifestJson -Encoding UTF8

Write-Host "✅ Manifest updated" -ForegroundColor Green

# ─── Démarrer le serveur ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "✅ Starting HTTP server on port $PORT" -ForegroundColor Green
Write-Host "📖 Open your browser: http://localhost:$PORT" -ForegroundColor Green
Write-Host ""
Write-Host "⏹️  Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

Push-Location $distDir
python -m http.server $PORT
Pop-Location
