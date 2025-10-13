# PowerShell eBay OAuth Diagnosis Script
Write-Host "🔍 eBay OAuth Diagnosis" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

Write-Host ""
Write-Host "1. Checking environment variables..." -ForegroundColor Yellow

# Check if .env file exists
if (Test-Path ".env") {
    Write-Host "✅ .env file exists" -ForegroundColor Green
    
    $envContent = Get-Content ".env"
    
    # Check for EBAY_REDIRECT_RU_NAME
    $ruNameLine = $envContent | Where-Object { $_ -match "EBAY_REDIRECT_RU_NAME" }
    if ($ruNameLine) {
        Write-Host "✅ EBAY_REDIRECT_RU_NAME found in .env" -ForegroundColor Green
        $ruName = ($ruNameLine -split "=")[1]
        Write-Host "   Value: $ruName" -ForegroundColor White
        
        if ($ruName -match "^http") {
            Write-Host "❌ ERROR: RuName looks like a URL - this is wrong!" -ForegroundColor Red
            Write-Host "   Should be like: YOURAPP-YOURAPP-PRD--xxxxxxxx" -ForegroundColor Yellow
            Write-Host "   NOT like: https://yoursite.com/callback" -ForegroundColor Yellow
        } else {
            Write-Host "✅ RuName format looks correct" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ EBAY_REDIRECT_RU_NAME not found in .env" -ForegroundColor Red
    }
    
    # Check for EBAY_CLIENT_ID
    $clientIdLine = $envContent | Where-Object { $_ -match "EBAY_CLIENT_ID" }
    if ($clientIdLine) {
        Write-Host "✅ EBAY_CLIENT_ID found" -ForegroundColor Green
    } else {
        Write-Host "❌ EBAY_CLIENT_ID not found" -ForegroundColor Red
    }
    
    # Check for EBAY_CLIENT_SECRET
    $clientSecretLine = $envContent | Where-Object { $_ -match "EBAY_CLIENT_SECRET" }
    if ($clientSecretLine) {
        Write-Host "✅ EBAY_CLIENT_SECRET found" -ForegroundColor Green
    } else {
        Write-Host "❌ EBAY_CLIENT_SECRET not found" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .env file not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Testing backend endpoint..." -ForegroundColor Yellow
$backendUrl = "https://us-central1-treasurehunter-sdk.cloudfunctions.net/ebayAuth"
Write-Host "Testing: $backendUrl" -ForegroundColor White

try {
    $response = Invoke-WebRequest -Uri $backendUrl -Method GET -TimeoutSec 10
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend endpoint is responding" -ForegroundColor Green
        Write-Host "Backend response:" -ForegroundColor White
        $response.Content.Substring(0, [Math]::Min(500, $response.Content.Length))
    } else {
        Write-Host "⚠️ Backend returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 404) {
        Write-Host "❌ Backend endpoint returns 404 - function not deployed or wrong URL" -ForegroundColor Red
        Write-Host "   Try: firebase deploy --only functions" -ForegroundColor Yellow
    } elseif ($statusCode -eq 500) {
        Write-Host "⚠️ Backend endpoint returns 500 - internal error" -ForegroundColor Yellow
        Write-Host "   Check: firebase functions:log" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Backend endpoint issue - HTTP $statusCode" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Checking Firebase project configuration..." -ForegroundColor Yellow

# Check if firebase.json exists
if (Test-Path "firebase.json") {
    Write-Host "✅ firebase.json exists" -ForegroundColor Green
    
    try {
        $firebaseConfig = Get-Content "firebase.json" | ConvertFrom-Json
        $functionsSource = $firebaseConfig.functions.source
        Write-Host "   Functions source directory: $functionsSource" -ForegroundColor White
        
        if (Test-Path "$functionsSource/index.js") {
            Write-Host "✅ Functions index.js exists" -ForegroundColor Green
        } else {
            Write-Host "❌ Functions index.js not found" -ForegroundColor Red
        }
        
        if (Test-Path "$functionsSource/api/ebay-auth.js") {
            Write-Host "✅ ebay-auth.js exists" -ForegroundColor Green
        } else {
            Write-Host "❌ ebay-auth.js not found" -ForegroundColor Red
        }
    } catch {
        Write-Host "⚠️ Could not parse firebase.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ firebase.json not found - not in Firebase project root?" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Testing Firebase CLI..." -ForegroundColor Yellow

try {
    $firebaseVersion = firebase --version
    Write-Host "✅ Firebase CLI installed: $firebaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Firebase CLI not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Install: npm install -g firebase-tools" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5. Next steps:" -ForegroundColor Cyan
Write-Host "   1. Fix any ❌ issues shown above" -ForegroundColor White
Write-Host "   2. If RuName is wrong, get correct one from eBay Developer Console" -ForegroundColor White
Write-Host "   3. If backend is 404, run: firebase deploy --only functions" -ForegroundColor White
Write-Host "   4. Test the OAuth flow again" -ForegroundColor White

Write-Host ""
Write-Host "🎯 Most likely fix needed:" -ForegroundColor Magenta
Write-Host "   Update EBAY_REDIRECT_RU_NAME in .env with actual RuName from eBay" -ForegroundColor White

Write-Host ""
Write-Host "To get your RuName:" -ForegroundColor Cyan
Write-Host "   1. Go to https://developer.ebay.com/" -ForegroundColor White
Write-Host "   2. Navigate to: Your Account -> Application Keys" -ForegroundColor White
Write-Host "   3. Click User Tokens next to your Client ID" -ForegroundColor White
Write-Host "   4. Copy the RuName value (NOT the URL)" -ForegroundColor White