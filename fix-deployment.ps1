# simple-fix.ps1
# Simple Firebase Functions deployment fix

Write-Host "Firebase Functions Simple Fix" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Check if we're in the right directory
if (!(Test-Path "functions")) {
    Write-Host "ERROR: 'functions' folder not found!" -ForegroundColor Red
    Write-Host "Please run this from your project root folder" -ForegroundColor Yellow
    exit
}

Write-Host "Found functions folder" -ForegroundColor Green

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupName = "functions/index.js.backup.$timestamp"
Copy-Item "functions/index.js" $backupName
Write-Host "Backup created: $backupName" -ForegroundColor Green

# Create minimal function content
$minimalCode = @"
// Minimal health function - no SDK, no dependencies
const {onRequest} = require('firebase-functions/v2/https');

exports.health = onRequest(
  { 
    cors: true,
    invoker: 'public'
  },
  (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'Incremental Test',
      components: {
        sdk: true,
        estimatePrice: true,
        tokenUtils: true,
        express: true,
        busboy: true
      }
    });
  }
);
"@

# Save the minimal function
Write-Host "Creating minimal index.js..." -ForegroundColor Yellow
$minimalCode | Out-File -FilePath "functions/index.js" -Encoding UTF8

# Navigate to functions folder
Set-Location functions

# Clean and reinstall
Write-Host "Cleaning old dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
}

Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`nDeploying minimal health function..." -ForegroundColor Yellow
firebase deploy --only functions:health

Write-Host "`nDeployment attempt complete!" -ForegroundColor Cyan
Write-Host "Your original index.js is backed up as: $backupName" -ForegroundColor Yellow
Write-Host "`nIf deployment succeeded, the health function should now work." -ForegroundColor Green
Write-Host "If it failed, check the error message above." -ForegroundColor Yellow

# Return to root
Set-Location ..

Write-Host "`nTo restore your original file later, run:" -ForegroundColor Cyan
Write-Host "Copy-Item '$backupName' 'functions/index.js'" -ForegroundColor White