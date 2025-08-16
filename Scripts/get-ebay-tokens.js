// get-ebay-tokens.js
const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.account'
  ].join(' ');
  
  const state = Math.random().toString(36).substring(2, 15);
  
  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=***REMOVED***&response_type=code&redirect_uri=https://thriftstop.app/auth/ebay/callback&scope=${encodeURIComponent(scopes)}&state=${state}`;
  
  console.log('\n🔗 Visit this URL to authorize your app:');
  console.log(authUrl);