const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { EbayApiClient } = require('../../api/ebay-api-client.js');

class EbayOauthService {
    constructor() {
        this.db = getFirestore();
        this.auth = getAuth();
        this.ebayApiClient = new EbayApiClient(); // Create an instance here
    }

    // --- OAuth URL Generation ---
    async generateAuthUrl(req, res) {
        try {
            const config = this.ebayApiClient.getEbayConfig(); // Now called on the instance
            const scopes = this.ebayApiClient.buildScopeFromRequest(); // Now called on the instance

            const user = await this.verifyAuthToken(req.headers.authorization);
            const { userId } = req.body;

            if (!userId || userId !== user.uid) {
                return res.status(400).json({ success: false, error: 'Invalid user ID' });
            }

            const state = `user_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.db.collection('ebay_oauth_states').doc(state).set({ userId: userId });

            const authUrl = new URL(config.getAuthUrl());
            authUrl.searchParams.set('client_id', config.clientId);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('redirect_uri', config.redirectRuName);
            authUrl.searchParams.set('scope', scopes);
            authUrl.searchParams.set('state', state);

            res.json({ success: true, authUrl: authUrl.toString() });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // --- OAuth Callback Handling ---
    async handleCallback(req, res) {
        try {
            const { code, state, userId } = req.body;
            const stateDoc = await this.db.collection('ebay_oauth_states').doc(state).get();
            if (!stateDoc.exists || stateDoc.data().userId !== userId) {
                throw new Error('Invalid state parameter');
            }

            const config = this.ebayApiClient.getEbayConfig(); // Now called on the instance
            const tokenResponse = await fetch(config.getTokenUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${config.getBasicAuth()}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: config.redirectRuName
                })
            });

            if (!tokenResponse.ok) {
                throw new Error('Token exchange failed');
            }

            const tokenData = await tokenResponse.json();
            const tokenManager = new EbayTokenManager();
            await tokenManager.storeTokens(userId, tokenData);
            await this.db.collection('ebay_oauth_states').doc(state).delete();
            
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async verifyAuthToken(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Missing or invalid authorization header');
        }
        const idToken = authHeader.split('Bearer ')[1];
        try {
            return await this.auth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Token verification failed:', error);
            throw new Error('Invalid Firebase auth token');
        }
    }
}

module.exports = { EbayOauthService };
