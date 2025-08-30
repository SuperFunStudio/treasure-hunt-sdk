// ebay-diagnostic.js - Comprehensive eBay Integration Diagnostic Tool
// Run this to figure out exactly what's happening with eBay user info

require('dotenv').config({ path: './functions/.env' });
const { EbayIntegration } = require('./functions/capture-sdk/integrations/ebay/index.js');
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

class EbayDiagnostic {
  constructor() {
    this.results = {
      tokenInfo: {},
      endpointTests: [],
      scopeAnalysis: {},
      userInfoAttempts: [],
      recommendations: []
    };
  }

  async runCompleteDiagnostic() {
    console.log('🔍 Starting Comprehensive eBay Diagnostic...\n');
    
    // Load eBay config from environment
    const ebayConfig = this.loadEbayConfig();
    if (!ebayConfig.isValid) {
      console.log('❌ eBay configuration invalid:', ebayConfig.errors);
      return;
    }

    console.log('✅ eBay config loaded:', {
      hasClientId: !!ebayConfig.clientId,
      hasClientSecret: !!ebayConfig.clientSecret,
      hasAccessToken: !!ebayConfig.accessToken,
      environment: ebayConfig.environment
    });

    // Initialize eBay integration
    const ebay = new EbayIntegration(ebayConfig);

    try {
      // 1. Test basic connectivity
      await this.testBasicConnectivity(ebay);
      
      // 2. Test current access token
      await this.testAccessToken(ebay);
      
      // 3. Systematically test user info endpoints
      await this.testUserInfoEndpoints(ebay);
      
      // 4. Test account/seller endpoints
      await this.testAccountEndpoints(ebay);
      
      // 5. Test identity endpoints
      await this.testIdentityEndpoints(ebay);
      
      // 6. Test Browse API user context
      await this.testBrowseAPIUserContext(ebay);
      
      // 7. Analyze available scopes
      await this.analyzeTokenScopes(ebay);
      
      // 8. Generate recommendations
      this.generateRecommendations();
      
      // 9. Display complete results
      this.displayResults();

    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }
  }

  loadEbayConfig() {
    const config = {
      clientId: process.env.EBAY_CLIENT_ID,
      clientSecret: process.env.EBAY_CLIENT_SECRET,
      accessToken: process.env.EBAY_ACCESS_TOKEN,
      refreshToken: process.env.EBAY_REFRESH_TOKEN,
      redirectUri: process.env.EBAY_REDIRECT_URI,
      environment: process.env.EBAY_ENVIRONMENT || 'production',
      isValid: true,
      errors: []
    };

    if (!config.clientId) config.errors.push('Missing EBAY_CLIENT_ID');
    if (!config.clientSecret) config.errors.push('Missing EBAY_CLIENT_SECRET');
    if (!config.accessToken && !config.refreshToken) {
      config.errors.push('Missing both EBAY_ACCESS_TOKEN and EBAY_REFRESH_TOKEN');
    }

    config.isValid = config.errors.length === 0;
    return config;
  }

  async testBasicConnectivity(ebay) {
    console.log('\n📡 Testing Basic eBay API Connectivity...');
    
    try {
      // Test if we can reach eBay's API
      const response = await fetch(ebay.getApiUrl(), { method: 'HEAD' });
      console.log(`✅ eBay API reachable: ${response.status}`);
      
      this.results.connectivity = {
        apiReachable: response.ok,
        status: response.status,
        environment: ebay.environment
      };
    } catch (error) {
      console.log('❌ eBay API connectivity failed:', error.message);
      this.results.connectivity = { apiReachable: false, error: error.message };
    }
  }

  async testAccessToken(ebay) {
    console.log('\n🔑 Testing Access Token...');
    
    try {
      // Test a simple API call to validate token
      const response = await ebay.apiCall('GET', '/sell/account/v1/privilege');
      console.log('✅ Access token valid - privileges response:', response);
      
      this.results.tokenInfo = {
        valid: true,
        privileges: response,
        hasSellerPrivileges: response.sellingLimit ? true : false
      };
    } catch (error) {
      console.log('❌ Access token test failed:', error.message);
      this.results.tokenInfo = {
        valid: false,
        error: error.message
      };
      
      // Try to refresh token if we have refresh token
      await this.attemptTokenRefresh(ebay);
    }
  }

  async attemptTokenRefresh(ebay) {
    if (!ebay.refreshToken) {
      console.log('⚠️ No refresh token available for renewal');
      return;
    }

    try {
      console.log('🔄 Attempting to refresh access token...');
      const newToken = await ebay.refreshAccessToken();
      console.log('✅ Token refreshed successfully');
      this.results.tokenInfo.refreshed = true;
      this.results.tokenInfo.newToken = !!newToken;
    } catch (error) {
      console.log('❌ Token refresh failed:', error.message);
      this.results.tokenInfo.refreshError = error.message;
    }
  }

  async testUserInfoEndpoints(ebay) {
    console.log('\n👤 Testing User Info Endpoints...');
    
    const userEndpoints = [
      '/sell/account/v1/user',
      '/commerce/identity/v1/user', 
      '/sell/account/v1/customer_service_metric',
      '/sell/account/v1/seller_standards_profile',
      '/sell/fulfillment/v1/user_rate_limit',
      '/sell/account/v1/subscription',
      '/buy/marketplace_insights/v1/user_agreement'
    ];

    for (const endpoint of userEndpoints) {
      await this.testEndpoint(ebay, endpoint, 'User Info');
    }
  }

  async testAccountEndpoints(ebay) {
    console.log('\n🏪 Testing Account/Seller Endpoints...');
    
    const accountEndpoints = [
      '/sell/account/v1/privilege',
      '/sell/account/v1/seller_standards_profile', 
      '/sell/account/v1/subscription',
      '/sell/account/v1/customer_service_metric',
      '/sell/account/v1/advertising_eligibility',
      '/sell/account/v1/rate_limit'
    ];

    for (const endpoint of accountEndpoints) {
      await this.testEndpoint(ebay, endpoint, 'Account');
    }
  }

  async testIdentityEndpoints(ebay) {
    console.log('\n🆔 Testing Identity Endpoints...');
    
    // Identity API uses apiz.ebay.com instead of api.ebay.com
    const identityEndpoints = [
      { endpoint: '/commerce/identity/v1/user', useIdentityAPI: true },
      { endpoint: '/commerce/identity/v1/user/address', useIdentityAPI: true },
      { endpoint: '/identity/v1/user', useIdentityAPI: false },
      { endpoint: '/identity/v1/oauth2/token/introspect', useIdentityAPI: false }
    ];

    for (const endpointInfo of identityEndpoints) {
      await this.testIdentityEndpoint(ebay, endpointInfo.endpoint, endpointInfo.useIdentityAPI);
    }
  }

  async testIdentityEndpoint(ebay, endpoint, useIdentityAPI) {
    try {
      console.log(`   Testing: ${endpoint} ${useIdentityAPI ? '(Identity API)' : '(Standard API)'}`);
      
      // Use apiz.ebay.com for Identity API endpoints
      const baseUrl = useIdentityAPI 
        ? (ebay.environment === 'sandbox' ? 'https://apiz.sandbox.ebay.com' : 'https://apiz.ebay.com')
        : ebay.getApiUrl();
      
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ebay.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Language': 'en-US'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`eBay API Error (${response.status}): ${error.message || JSON.stringify(error)}`);
      }

      const result = response.status === 204 ? {} : await response.json();
      
      console.log(`   ✅ Success:`, this.formatResponse(result));
      
      this.results.endpointTests.push({
        endpoint,
        category: 'Identity',
        success: true,
        response: result,
        containsUserInfo: this.checkForUserInfo(result),
        apiType: useIdentityAPI ? 'Identity API (apiz.ebay.com)' : 'Standard API (api.ebay.com)'
      });

      // Special handling for responses that might contain user info
      if (this.checkForUserInfo(result)) {
        console.log(`   🎯 USER INFO FOUND in ${endpoint}:`, this.extractUserInfo(result));
        this.results.userInfoAttempts.push({
          endpoint,
          userInfo: this.extractUserInfo(result),
          success: true
        });
      }

    } catch (error) {
      const statusCode = this.extractStatusCode(error.message);
      console.log(`   ❌ Failed (${statusCode}): ${error.message}`);
      
      this.results.endpointTests.push({
        endpoint,
        category: 'Identity',
        success: false,
        error: error.message,
        statusCode: statusCode,
        apiType: useIdentityAPI ? 'Identity API (apiz.ebay.com)' : 'Standard API (api.ebay.com)'
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async testBrowseAPIUserContext(ebay) {
    console.log('\n🔍 Testing Browse API User Context...');
    
    try {
      // Try to get user context from Browse API
      const response = await ebay.apiCall('GET', '/buy/browse/v1/user/get_user_agreement');
      console.log('✅ Browse API user agreement:', response);
      
      this.results.endpointTests.push({
        endpoint: '/buy/browse/v1/user/get_user_agreement',
        category: 'Browse API',
        success: true,
        response: response
      });
    } catch (error) {
      console.log('❌ Browse API user context failed:', error.message);
      this.results.endpointTests.push({
        endpoint: '/buy/browse/v1/user/get_user_agreement',
        category: 'Browse API', 
        success: false,
        error: error.message
      });
    }
  }

  async testEndpoint(ebay, endpoint, category) {
    try {
      console.log(`   Testing: ${endpoint}`);
      const response = await ebay.apiCall('GET', endpoint);
      
      console.log(`   ✅ Success:`, this.formatResponse(response));
      
      this.results.endpointTests.push({
        endpoint,
        category,
        success: true,
        response: response,
        containsUserInfo: this.checkForUserInfo(response)
      });

      // Special handling for responses that might contain user info
      if (this.checkForUserInfo(response)) {
        console.log(`   🎯 USER INFO FOUND in ${endpoint}:`, this.extractUserInfo(response));
        this.results.userInfoAttempts.push({
          endpoint,
          userInfo: this.extractUserInfo(response),
          success: true
        });
      }

    } catch (error) {
      const statusCode = this.extractStatusCode(error.message);
      console.log(`   ❌ Failed (${statusCode}): ${error.message}`);
      
      this.results.endpointTests.push({
        endpoint,
        category,
        success: false,
        error: error.message,
        statusCode: statusCode
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async analyzeTokenScopes(ebay) {
    console.log('\n🔐 Analyzing Token Scopes...');
    
    // Try to introspect the token if possible
    try {
      const introspectResponse = await ebay.apiCall('POST', '/identity/v1/oauth2/token/introspect', {
        token: ebay.accessToken,
        token_type_hint: 'access_token'
      });
      
      console.log('✅ Token introspection:', introspectResponse);
      this.results.scopeAnalysis = {
        introspectionSuccess: true,
        scopes: introspectResponse.scope ? introspectResponse.scope.split(' ') : [],
        active: introspectResponse.active,
        clientId: introspectResponse.client_id,
        username: introspectResponse.username,
        response: introspectResponse
      };

      if (introspectResponse.username) {
        console.log(`🎯 FOUND USERNAME IN TOKEN: ${introspectResponse.username}`);
      }

    } catch (error) {
      console.log('❌ Token introspection failed:', error.message);
      this.results.scopeAnalysis = {
        introspectionSuccess: false,
        error: error.message
      };
    }

    // Analyze what scopes we likely have based on successful endpoints
    this.analyzeImpliedScopes();
  }

  analyzeImpliedScopes() {
    const successfulEndpoints = this.results.endpointTests.filter(test => test.success);
    const impliedScopes = [];

    if (successfulEndpoints.some(test => test.endpoint.includes('/sell/account'))) {
      impliedScopes.push('https://api.ebay.com/oauth/api_scope/sell.account');
    }
    if (successfulEndpoints.some(test => test.endpoint.includes('/sell/inventory'))) {
      impliedScopes.push('https://api.ebay.com/oauth/api_scope/sell.inventory');
    }
    if (successfulEndpoints.some(test => test.endpoint.includes('/buy/'))) {
      impliedScopes.push('https://api.ebay.com/oauth/api_scope/buy.item.feed');
    }

    this.results.scopeAnalysis.impliedScopes = impliedScopes;
    console.log('🔍 Implied scopes from successful calls:', impliedScopes);
  }

  checkForUserInfo(response) {
    if (!response || typeof response !== 'object') return false;
    
    const userInfoFields = ['username', 'userId', 'displayName', 'email', 'firstName', 'lastName', 'sellerAccount'];
    return userInfoFields.some(field => response.hasOwnProperty(field));
  }

  extractUserInfo(response) {
    const userInfo = {};
    const userInfoFields = ['username', 'userId', 'displayName', 'email', 'firstName', 'lastName', 'sellerAccount'];
    
    userInfoFields.forEach(field => {
      if (response.hasOwnProperty(field)) {
        userInfo[field] = response[field];
      }
    });

    return userInfo;
  }

  extractStatusCode(errorMessage) {
    const match = errorMessage.match(/(\d{3})/);
    return match ? match[1] : 'unknown';
  }

  formatResponse(response) {
    if (typeof response === 'object') {
      const keys = Object.keys(response);
      if (keys.length > 3) {
        return `{${keys.slice(0, 3).join(', ')}, ...} (${keys.length} fields)`;
      }
      return JSON.stringify(response).substring(0, 100) + '...';
    }
    return String(response).substring(0, 100);
  }

  generateRecommendations() {
    console.log('\n💡 Generating Recommendations...');
    
    const recommendations = [];

    // Check if we found any user info
    const foundUserInfo = this.results.userInfoAttempts.filter(attempt => attempt.success);
    if (foundUserInfo.length === 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'No user information endpoints accessible',
        solution: 'Need to add identity scopes to eBay OAuth flow',
        action: 'Update authorization URL to include: https://api.ebay.com/oauth/api_scope/commerce.identity.readonly'
      });
    }

    // Check token validity
    if (!this.results.tokenInfo.valid) {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Access token invalid or expired',
        solution: 'Refresh token or re-authenticate user',
        action: 'Implement proper token refresh logic'
      });
    }

    // Check for missing scopes
    const hasIdentityScope = this.results.scopeAnalysis.scopes?.some(scope => 
      scope.includes('identity') || scope.includes('commerce.identity')
    );
    
    if (!hasIdentityScope) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Missing identity scope for user information',
        solution: 'Add commerce.identity.readonly scope to OAuth request',
        action: 'Update getAuthUrl() method to include identity scopes'
      });
    }

    // Check for alternative solutions
    if (foundUserInfo.length === 0) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Cannot get username from API',
        solution: 'Store username during OAuth flow or ask user to provide it',
        action: 'Capture username during initial authentication process'
      });
    }

    this.results.recommendations = recommendations;
    
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   Solution: ${rec.solution}`);
      console.log(`   Action: ${rec.action}\n`);
    });
  }

  displayResults() {
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(50));
    
    console.log('\n🔗 Connectivity:');
    console.log(`   API Reachable: ${this.results.connectivity?.apiReachable ? '✅' : '❌'}`);
    
    console.log('\n🔑 Token Status:');
    console.log(`   Valid: ${this.results.tokenInfo.valid ? '✅' : '❌'}`);
    console.log(`   Has Seller Privileges: ${this.results.tokenInfo.hasSellerPrivileges ? '✅' : '❌'}`);
    
    console.log('\n📡 Endpoint Tests:');
    const successfulTests = this.results.endpointTests.filter(test => test.success);
    console.log(`   Successful: ${successfulTests.length}/${this.results.endpointTests.length}`);
    
    successfulTests.forEach(test => {
      console.log(`   ✅ ${test.endpoint} ${test.containsUserInfo ? '(👤 Has User Info)' : ''}`);
    });

    console.log('\n👤 User Information Found:');
    if (this.results.userInfoAttempts.length > 0) {
      this.results.userInfoAttempts.forEach(attempt => {
        console.log(`   📍 ${attempt.endpoint}:`);
        Object.entries(attempt.userInfo).forEach(([key, value]) => {
          console.log(`      ${key}: ${value}`);
        });
      });
    } else {
      console.log('   ❌ No user information accessible with current token');
    }

    console.log('\n🔐 Scope Analysis:');
    if (this.results.scopeAnalysis.scopes) {
      console.log(`   Detected Scopes: ${this.results.scopeAnalysis.scopes.join(', ')}`);
    }
    if (this.results.scopeAnalysis.impliedScopes) {
      console.log(`   Implied Scopes: ${this.results.scopeAnalysis.impliedScopes.join(', ')}`);
    }

    console.log('\n🎯 KEY FINDINGS:');
    if (this.results.userInfoAttempts.length > 0) {
      console.log('   ✅ Found working endpoints for user information');
      const usernames = this.results.userInfoAttempts
        .flatMap(attempt => Object.entries(attempt.userInfo))
        .filter(([key]) => key.includes('username') || key.includes('Username'))
        .map(([key, value]) => value);
      
      if (usernames.length > 0) {
        console.log(`   🎉 SOLUTION: Username found: ${usernames[0]}`);
      }
    } else {
      console.log('   ❌ No user information endpoints accessible');
      console.log('   🔧 Need to add identity scopes to OAuth flow');
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Main execution
async function main() {
  const diagnostic = new EbayDiagnostic();
  await diagnostic.runCompleteDiagnostic();
}

// Export for use as module
module.exports = { EbayDiagnostic };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}