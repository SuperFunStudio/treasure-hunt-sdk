// simple-oauth-test.js
// Complete OAuth setup and testing for your eBay app
import express from 'express';
import dotenv from 'dotenv';
import { EbayIntegration } from '../capture-sdk/integrations/ebay/index.js';

dotenv.config();

const app = express();
const port = process.env.OAUTH_PORT || 3001; // Use port 3001 to avoid conflicts

// Your eBay app details
const CLIENT_ID = 'SUPERFUN-S-PRD-53649ae1c-641d3320';
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI || `http://localhost:${port}/auth/callback`;

// Main page with OAuth link
app.get('/', (req, res) => {
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
  ].join(' ');

  const authUrl = `https://auth.ebay.com/oauth2/authorize?` + 
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scopes)}&` +
    `state=test123`;

  res.send(`
    <html>
      <head><title>eBay OAuth Test</title></head>
      <body style="font-family: Arial; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h1>🚀 eBay OAuth Setup</h1>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>⚠️ First: Add Redirect URL in eBay Console</h3>
          <p>In your eBay Developer Console, click <strong>"+ Add eBay Redirect URL"</strong> and add:</p>
          <code style="background: #f1f3f4; padding: 5px; border-radius: 3px;">${REDIRECT_URI}</code>
        </div>

        <div style="background: #d4edda; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>✅ Ready to Test OAuth</h3>
          <p>Click the button below to start the OAuth flow:</p>
          <a href="${authUrl}" style="
            display: inline-block;
            background: #0064d3;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 10px 0;
          ">🔐 Sign in with eBay</a>
        </div>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
          <h4>Debug Info:</h4>
          <p><strong>Client ID:</strong> ${CLIENT_ID}</p>
          <p><strong>Redirect URI:</strong> ${REDIRECT_URI}</p>
          <p><strong>Environment:</strong> Production</p>
        </div>
      </body>
    </html>
  `);
});

// OAuth callback handler
app.get('/auth/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ OAuth Error</h1>
        <p><strong>Error:</strong> ${error}</p>
        <p><strong>Description:</strong> ${req.query.error_description || 'Unknown'}</p>
        <a href="/">← Try Again</a>
      </div>
    `);
  }

  if (!code) {
    return res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>⚠️ No Code Received</h1>
        <p>Make sure you added the redirect URL in eBay Developer Console</p>
        <a href="/">← Try Again</a>
      </div>
    `);
  }

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
    }

    console.log('🎉 OAuth Success!');
    console.log('Access Token:', data.access_token.substring(0, 30) + '...');
    console.log('Refresh Token:', data.refresh_token.substring(0, 30) + '...');
    console.log('Expires in:', data.expires_in, 'seconds');

    res.send(`
      <div style="font-family: Arial; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h1>🎉 OAuth Success!</h1>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>✅ Tokens Obtained!</h3>
          <p><strong>Access Token:</strong> ${data.access_token.substring(0, 40)}...</p>
          <p><strong>Refresh Token:</strong> ${data.refresh_token.substring(0, 40)}...</p>
          <p><strong>Expires in:</strong> ${Math.round(data.expires_in / 3600)} hours</p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h3>📝 Add these to your .env file:</h3>
          <pre style="background: #e9ecef; padding: 15px; border-radius: 4px; font-size: 12px; overflow-x: auto;">
EBAY_ACCESS_TOKEN=${data.access_token}
EBAY_REFRESH_TOKEN=${data.refresh_token}</pre>
        </div>

        <div style="margin: 20px 0;">
          <h3>🚀 Next Steps:</h3>
          <ol>
            <li>✅ OAuth completed successfully</li>
            <li>📝 Copy tokens to .env file</li>
            <li>🧪 Test creating a listing</li>
            <li>🔧 Set up Firebase</li>
            <li>🎨 Build the UI</li>
          </ol>
          
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
        </div>

        <p><em>Check your console for full token details!</em></p>
        
        <script>
          async function testListing() {
            const accessToken = '${data.access_token}';
            const refreshToken = '${data.refresh_token}';
            
            try {
              const response = await fetch('/test-listing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, refreshToken })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('🎉 Test listing created successfully!\\nListing ID: ' + result.listingId + '\\nURL: ' + result.url);
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
    console.error('❌ Token exchange error:', error);
    
    res.send(`
      <div style="font-family: Arial; padding: 20px;">
        <h1>❌ Token Exchange Failed</h1>
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Common issues:</p>
        <ul>
          <li>Wrong CLIENT_SECRET in .env</li>
          <li>Redirect URL not added to eBay app</li>
          <li>Code expired (try again)</li>
        </ul>
        <a href="/">← Try Again</a>
      </div>
    `);
  }
});

// Test listing creation endpoint
app.post('/test-listing', express.json(), async (req, res) => {
  const { accessToken, refreshToken } = req.body;
  
  if (!accessToken) {
    return res.json({ success: false, error: 'No access token provided' });
  }

  try {
    // Initialize eBay integration with the tokens
    const ebay = new EbayIntegration({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      environment: 'production'
    });
    
    ebay.accessToken = accessToken;
    ebay.refreshToken = refreshToken;

    // Test listing data
    const testListing = {
      title: '🧪 TEST LISTING - DELETE IMMEDIATELY',
      description: `This is a TEST LISTING created by Treasure Hunter SDK.
      
      ⚠️ THIS LISTING WILL BE DELETED IMMEDIATELY ⚠️
      
      This is just a test to verify our eBay integration works.
      Please ignore this listing.
      
      Features being tested:
      • OAuth token authentication
      • Listing creation API
      • Inventory management
      • Auto-deletion capability
      
      This listing was created automatically and will be removed within 30 seconds.`,
      
      images: [
        'https://i.ebayimg.com/images/g/9~4AAOSwcu5kXKvQ/s-l1600.jpg' // Generic test image
      ],
      
      pricing: {
        buyItNowPrice: 1.00, // Minimum price for testing
        acceptOffers: false
      },
      
      condition: 'good',
      category: '171485', // Collectibles > Other
      
      itemSpecifics: {
        Brand: 'Test',
        Model: 'SDK Test Item',
        Condition: 'Good'
      }
    };

    console.log('🧪 Creating test listing...');
    const result = await ebay.createListing(testListing);
    
    if (result.success) {
      console.log('✅ Test listing created:', result.listingId);
      console.log('🌐 URL:', result.url);
      
      // Auto-delete the test listing after 30 seconds
      setTimeout(async () => {
        try {
          await ebay.endListing(result.offerId, 'OTHER');
          console.log('🗑️ Test listing deleted automatically');
        } catch (error) {
          console.log('⚠️ Could not auto-delete listing:', error.message);
        }
      }, 30000);
      
      res.json({
        success: true,
        listingId: result.listingId,
        url: result.url,
        message: 'Test listing created successfully! It will be deleted in 30 seconds.'
      });
    } else {
      console.error('❌ Test listing failed:', result.error);
      res.json({ success: false, error: result.error });
    }

  } catch (error) {
    console.error('💥 Test listing exception:', error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🌐 OAuth test server running on http://localhost:${port}`);
  console.log(`📋 Steps:`);
  console.log(`  1. Add redirect URL in eBay Console: ${REDIRECT_URI}`);
  console.log(`  2. Visit http://localhost:${port}`);
  console.log(`  3. Click "Sign in with eBay"`);
  console.log(`  4. Get your tokens!`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});