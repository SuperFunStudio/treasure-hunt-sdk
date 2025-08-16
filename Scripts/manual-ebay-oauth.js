// manual-ebay-oauth.js
// Work with eBay's auto-generated RuName system
import express from 'express';
import dotenv from 'dotenv';
import { EbayIntegration } from '../capture-sdk/integrations/ebay/index.js';

dotenv.config();

const app = express();
const port = 3001;

const CLIENT_ID = 'SUPERFUN-S-PRD-53649ae1c-641d3320';
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const RUNAME = 'SUPERFUN_STUDIO-SUPERFUN-S-PRD--gmotfjins'; // From your eBay console

// Exchange authorization code for tokens
async function exchangeCodeForTokens(authCode) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

// Main page
app.get('/', (req, res) => {
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
  ].join(' ');

  const authUrl = `https://auth.ebay.com/oauth2/authorize?` + 
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(RUNAME)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=treasure-hunter-test`;

  res.send(`
    <html>
      <head>
        <title>eBay OAuth - Manual Code Entry</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; }
          .step { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff; }
          .code-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; }
          .button { display: inline-block; background: #0064d3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <h1>🔐 eBay OAuth Manual Flow</h1>
        
        <div class="step">
          <h3>Step 1: Get Authorization Code</h3>
          <p>Click this link to authorize your app:</p>
          <a href="${authUrl}" class="button" target="_blank">🚀 Authorize with eBay</a>
          <p><small>This opens in a new window. After you authorize, eBay will show you an authorization code.</small></p>
        </div>

        <div class="step warning">
          <h3>Step 2: Copy the Authorization Code</h3>
          <p>After authorizing, eBay will display a page with your <strong>authorization code</strong>.</p>
          <p>Copy that code and paste it below:</p>
          
          <form action="/exchange-token" method="post" style="margin-top: 15px;">
            <input type="text" name="code" placeholder="Paste authorization code here..." class="code-input" required>
            <br><br>
            <button type="submit" style="background: #28a745; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              🔄 Exchange for Access Tokens
            </button>
          </form>
        </div>

        <div class="step">
          <h3>🔍 Debug Info</h3>
          <p><strong>Client ID:</strong> ${CLIENT_ID}</p>
          <p><strong>RuName:</strong> ${RUNAME}</p>
          <p><strong>Environment:</strong> Production</p>
          <p><strong>Scopes:</strong> inventory, account, fulfillment</p>
        </div>

        <div class="step">
          <h3>💡 What happens next?</h3>
          <ol>
            <li>Click "Authorize with eBay" above</li>
            <li>Sign in to your eBay account</li>
            <li>Grant permissions to your app</li>
            <li>eBay shows you an authorization code</li>
            <li>Copy that code and paste it in the form above</li>
            <li>Get your access tokens!</li>
          </ol>
        </div>
      </body>
    </html>
  `);
});

// Handle manual code submission
app.use(express.urlencoded({ extended: true }));
app.post('/exchange-token', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ No Code Provided</h1>
        <p>Please enter an authorization code.</p>
        <a href="/">← Try Again</a>
      </div>
    `);
  }

  try {
    console.log('🔄 Exchanging code for tokens...');
    console.log('Code:', code.substring(0, 20) + '...');
    
    const tokens = await exchangeCodeForTokens(code);
    
    console.log('✅ SUCCESS! Tokens received:');
    console.log('Access Token:', tokens.access_token.substring(0, 30) + '...');
    console.log('Refresh Token:', tokens.refresh_token.substring(0, 30) + '...');

    res.send(`
      <div style="font-family: Arial; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h1>🎉 Tokens Obtained Successfully!</h1>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>✅ Your eBay Access Tokens:</h3>
          <p><strong>Access Token:</strong><br><code style="word-break: break-all; background: #f8f9fa; padding: 5px;">${tokens.access_token}</code></p>
          <p><strong>Refresh Token:</strong><br><code style="word-break: break-all; background: #f8f9fa; padding: 5px;">${tokens.refresh_token}</code></p>
          <p><strong>Expires in:</strong> ${Math.round(tokens.expires_in / 3600)} hours</p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h3>📝 Add these to your .env file:</h3>
          <pre style="background: #e9ecef; padding: 15px; border-radius: 4px; font-size: 12px; overflow-x: auto;">
EBAY_ACCESS_TOKEN=${tokens.access_token}
EBAY_REFRESH_TOKEN=${tokens.refresh_token}</pre>
        </div>

        <div style="margin: 20px 0;">
          <button onclick="testListing()" style="
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
          ">🧪 Test Create Listing Now</button>
        </div>

        <script>
          async function testListing() {
            try {
              const response = await fetch('/test-listing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  accessToken: '${tokens.access_token}',
                  refreshToken: '${tokens.refresh_token}'
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('🎉 Test listing created!\\nListing ID: ' + result.listingId + '\\nURL: ' + result.url);
                window.open(result.url, '_blank');
              } else {
                alert('❌ Listing failed: ' + result.error);
              }
            } catch (error) {
              alert('❌ Error: ' + error.message);
            }
          }
        </script>
      </div>
    `);

  } catch (error) {
    console.error('❌ Token exchange failed:', error);
    
    res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ Token Exchange Failed</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        <div style="background: #f8d7da; padding: 15px; border-radius: 6px;">
          <h4>Common Issues:</h4>
          <ul>
            <li>Wrong CLIENT_SECRET in .env file</li>
            <li>Authorization code expired (get a new one)</li>
            <li>Code was already used (get a new one)</li>
          </ul>
        </div>
        <a href="/">← Try Again</a>
      </div>
    `);
  }
});

// Test listing endpoint (same as before)
app.use(express.json());
app.post('/test-listing', async (req, res) => {
  const { accessToken, refreshToken } = req.body;
  
  try {
    const ebay = new EbayIntegration({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: RUNAME,
      environment: 'production'
    });
    
    ebay.accessToken = accessToken;
    ebay.refreshToken = refreshToken;

    const testListing = {
      title: '🧪 TEST - Treasure Hunter SDK Test Item - DELETE',
      description: `TEST LISTING - Created by Treasure Hunter SDK
      
      ⚠️ THIS IS A TEST LISTING ⚠️
      
      This listing was created automatically to test our eBay integration.
      It will be deleted within 1 minute.
      
      Please ignore this listing.`,
      
      images: ['https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg'],
      pricing: { buyItNowPrice: 1.00, acceptOffers: false },
      condition: 'good',
      category: '171485',
      itemSpecifics: {} // Remove problematic aspects for now
    };

    const result = await ebay.createListing(testListing);
    
    if (result.success) {
      // Auto-delete after 60 seconds
      setTimeout(async () => {
        try {
          await ebay.endListing(result.offerId, 'OTHER');
          console.log('🗑️ Test listing auto-deleted');
        } catch (error) {
          console.log('⚠️ Could not auto-delete:', error.message);
        }
      }, 60000);
      
      res.json({ success: true, listingId: result.listingId, url: result.url });
    } else {
      res.json({ success: false, error: result.error });
    }

  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🌐 Manual OAuth server running on http://localhost:${port}`);
  console.log(`📋 Visit http://localhost:${port} to start OAuth flow`);
  console.log(`🔧 This works with eBay's auto-generated RuName system`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});