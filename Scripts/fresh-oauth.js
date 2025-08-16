// fresh-oauth.js
// Get completely fresh eBay tokens
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3002; // Use different port to avoid conflicts

const CLIENT_ID = 'SUPERFUN-S-PRD-53649ae1c-641d3320';
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const RUNAME = 'SUPERFUN_STUDIO-SUPERFUN-S-PRD--gmotfjins';

console.log('🔄 Starting fresh OAuth flow...');
console.log('📋 This will get you brand new, working tokens');

// Generate OAuth URL with proper scopes
function generateAuthUrl() {
  // Use exact scopes that match your eBay app permissions
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
  ].join(' ');

  return `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(RUNAME)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=fresh-token-${Date.now()}`;
}

// Token exchange with better error handling
async function exchangeForTokens(authCode) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
  console.log('🔄 Exchanging code for tokens...');
  console.log('Code length:', authCode.length);
  console.log('Client ID:', CLIENT_ID);
  console.log('Using RuName:', RUNAME);

  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: RUNAME
    })
  });

  const responseText = await response.text();
  console.log('📡 eBay API Response Status:', response.status);
  
  if (!response.ok) {
    console.log('❌ Full error response:', responseText);
    throw new Error(`Token exchange failed (${response.status}): ${responseText}`);
  }

  return JSON.parse(responseText);
}

// Main page
app.get('/', (req, res) => {
  const authUrl = generateAuthUrl();
  
  res.send(`
    <html>
      <head>
        <title>Fresh eBay OAuth Flow</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; line-height: 1.6; }
          .step { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
          .button { display: inline-block; background: #0064d3; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 15px 0; }
          .code-input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-family: monospace; font-size: 14px; }
          .submit-btn { background: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
          .success { background: #d4edda; border-left: 4px solid #28a745; }
        </style>
      </head>
      <body>
        <h1>🔄 Fresh eBay OAuth Flow</h1>
        
        <div class="step success">
          <h3>🎯 Goal: Get Fresh Working Tokens</h3>
          <p>We're going to get completely new tokens that will definitely work with your eBay integration.</p>
        </div>

        <div class="step">
          <h3>Step 1: Start Fresh Authorization</h3>
          <p>Click this button to get a NEW authorization code:</p>
          <a href="${authUrl}" class="button" target="_blank">🚀 Get Fresh Authorization Code</a>
          <p><small>This opens eBay's authorization page in a new tab.</small></p>
        </div>

        <div class="step warning">
          <h3>Step 2: Enter the NEW Code</h3>
          <p>After authorizing, copy the <strong>new authorization code</strong> and paste it here:</p>
          
          <form action="/fresh-tokens" method="post" style="margin-top: 15px;">
            <textarea name="code" placeholder="Paste your fresh authorization code here..." class="code-input" rows="3" required></textarea>
            <br><br>
            <button type="submit" class="submit-btn">🔄 Get Fresh Tokens</button>
          </form>
        </div>

        <div class="step">
          <h3>🔍 Why Fresh Tokens?</h3>
          <ul>
            <li><strong>Authorization codes expire:</strong> Can only be used once</li>
            <li><strong>Token corruption:</strong> Copy/paste can introduce errors</li>
            <li><strong>Scope issues:</strong> Fresh flow ensures correct permissions</li>
            <li><strong>Clean slate:</strong> Eliminates any cached issues</li>
          </ul>
        </div>

        <div class="step">
          <h3>🔧 Technical Details</h3>
          <p><strong>Client ID:</strong> ${CLIENT_ID}</p>
          <p><strong>RuName:</strong> ${RUNAME}</p>
          <p><strong>Environment:</strong> Production</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      </body>
    </html>
  `);
});

// Handle fresh token exchange
app.use(express.urlencoded({ extended: true }));
app.post('/fresh-tokens', async (req, res) => {
  const { code } = req.body;
  
  if (!code || code.trim().length === 0) {
    return res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ No Code Provided</h1>
        <p>Please enter the authorization code from eBay.</p>
        <a href="/">← Try Again</a>
      </div>
    `);
  }

  const cleanCode = code.trim();
  
  try {
    console.log('🆕 Processing fresh authorization code...');
    const tokens = await exchangeForTokens(cleanCode);
    
    console.log('✅ FRESH TOKENS OBTAINED!');
    console.log('Access Token Length:', tokens.access_token.length);
    console.log('Refresh Token Length:', tokens.refresh_token.length);
    console.log('Expires In:', tokens.expires_in, 'seconds');

    res.send(`
      <div style="font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto;">
        <h1>🎉 Fresh Tokens Successfully Obtained!</h1>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>✅ Your New eBay Tokens:</h3>
          <p><strong>Access Token:</strong> ${tokens.access_token.length} characters</p>
          <p><strong>Refresh Token:</strong> ${tokens.refresh_token.length} characters</p>
          <p><strong>Valid For:</strong> ${Math.round(tokens.expires_in / 3600)} hours</p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📝 Update Your .env File:</h3>
          <p>Replace the old tokens with these fresh ones:</p>
          <textarea readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 11px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
EBAY_ACCESS_TOKEN=${tokens.access_token}
EBAY_REFRESH_TOKEN=${tokens.refresh_token}</textarea>
        </div>

        <div style="margin: 20px 0;">
          <h3>🧪 Test With Fresh Tokens:</h3>
          <button onclick="testFreshListing()" style="
            background: #28a745;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin: 10px 0;
          ">🚀 Test Listing Creation</button>
        </div>

        <script>
          async function testFreshListing() {
            try {
              const response = await fetch('/test-fresh-listing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  accessToken: '${tokens.access_token}',
                  refreshToken: '${tokens.refresh_token}'
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('🎉 SUCCESS! Test listing created!\\n\\nListing ID: ' + result.listingId + '\\nURL: ' + result.url + '\\n\\nOpening listing in new tab...');
                window.open(result.url, '_blank');
              } else {
                alert('❌ Test listing failed:\\n' + result.error);
              }
            } catch (error) {
              alert('❌ Network error: ' + error.message);
            }
          }
        </script>
      </div>
    `);

  } catch (error) {
    console.error('❌ Fresh token exchange failed:', error);
    
    res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ Fresh Token Exchange Failed</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        
        <div style="background: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h4>🔧 Troubleshooting:</h4>
          <ul>
            <li>Make sure you copied the COMPLETE authorization code</li>
            <li>Verify your EBAY_CLIENT_SECRET in .env is correct</li>
            <li>Check that code wasn't used already</li>
            <li>Try getting a new authorization code</li>
          </ul>
        </div>
        
        <a href="/" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">← Try Fresh OAuth Again</a>
      </div>
    `);
  }
});

// Test endpoint with fresh tokens
app.use(express.json());
app.post('/test-fresh-listing', async (req, res) => {
  const { accessToken, refreshToken } = req.body;
  
  try {
    // Import here to avoid circular issues
    const { EbayIntegration } = await import('../capture-sdk/integrations/ebay/index.js');
    
    const ebay = new EbayIntegration({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: RUNAME,
      environment: 'production'
    });
    
    // Set fresh tokens
    ebay.accessToken = accessToken;
    ebay.refreshToken = refreshToken;

    // Ultra-simple test listing
    const testListing = {
      title: 'TEST - Delete This Listing Immediately',
      description: 'This is a test listing created by development code. Please delete immediately.',
      images: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg'],
      pricing: { buyItNowPrice: 1.99 },
      condition: 'good',
      category: '171485'
    };

    console.log('🧪 Testing with fresh tokens...');
    const result = await ebay.createListing(testListing);
    
    if (result.success) {
      console.log('🎉 SUCCESS! Fresh tokens work!');
      console.log('Listing:', result.url);
      
      // Auto-delete
      setTimeout(async () => {
        try {
          await ebay.endListing(result.offerId, 'OTHER');
          console.log('🗑️ Test listing auto-deleted');
        } catch (e) {
          console.log('⚠️ Manual deletion needed:', result.listingId);
        }
      }, 30000);
      
      res.json({ success: true, listingId: result.listingId, url: result.url });
    } else {
      console.log('❌ Fresh tokens test failed:', result.error);
      res.json({ success: false, error: result.error });
    }

  } catch (error) {
    console.error('💥 Fresh token test error:', error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🌐 Fresh OAuth server: http://localhost:${port}`);
  console.log(`📋 Get completely new tokens that will definitely work!`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down fresh OAuth server...');
  process.exit(0);
});