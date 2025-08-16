const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));
const Buffer = require('buffer').Buffer;

/**
 * Refresh eBay access token using a refresh token.
 * Returns: { access_token, refresh_token, expires_in, refresh_token_expires_in, ... }
 */
async function refreshEbayToken(refresh_token, clientId, clientSecret, redirectUri) {
  const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refresh_token);
  params.append('redirect_uri', redirectUri);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error('Failed to refresh eBay token: ' + (data.error_description || JSON.stringify(data)));
  }
  return data;
}

/**
 * Check if an access token is expired or close to expiry.
 * @param {object} ebayTokenObj { access_token, expires_at (timestamp ms) }
 * @param {number} bufferSeconds How many seconds before expiry to consider "expired"
 * @returns {boolean}
 */
function isTokenExpired(ebayTokenObj, bufferSeconds = 60) {
  if (!ebayTokenObj || !ebayTokenObj.access_token || !ebayTokenObj.expires_at) return true;
  const now = Date.now();
  // If expires_at is in the past or within buffer, consider expired
  return (ebayTokenObj.expires_at - now) < (bufferSeconds * 1000);
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 * Requires you to provide user object with eBay tokens, and update tokens in DB when refreshed.
 *
 * @param {object} user User record from DB (must include ebay.refresh_token and ebay.expires_at)
 * @param {object} env process.env (for clientId, clientSecret, redirectUri)
 * @param {function} updateUserTokens Callback for saving refreshed tokens to DB (async)
 * @returns {Promise<string>} access_token
 */
async function getValidUserEbayToken(user, env, updateUserTokens) {
  if (
    user.ebay &&
    user.ebay.access_token &&
    user.ebay.expires_at &&
    !isTokenExpired(user.ebay)
  ) {
    return user.ebay.access_token;
  }
  // If expired, refresh
  const tokens = await refreshEbayToken(
    user.ebay.refresh_token,
    env.EBAY_CLIENT_ID,
    env.EBAY_CLIENT_SECRET,
    env.EBAY_REDIRECT_URI
  );
  // Compute new expiry
  const expires_at = Date.now() + (tokens.expires_in * 1000);
  // Save updated tokens to DB (merge with old as needed)
  await updateUserTokens(user.id, {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at,
    raw: tokens // optionally store the full token object for debugging
  });
  return tokens.access_token;
}

module.exports = {
  refreshEbayToken,
  isTokenExpired,
  getValidUserEbayToken
};
