#!/usr/bin/env node

// run-diagnostics-from-functions.js
// Run this from treasure-hunt-sdk/functions/ directory

const fs = require('fs');
const path = require('path');

class FixedDiagnostics {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
    this.config = {};
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type}: ${message}`;
    
    console.log(logEntry);
    
    if (type === 'ERROR') this.errors.push(message);
    if (type === 'WARN') this.warnings.push(message);
    this.results.push(logEntry);
  }

  async runTest(name, testFn) {
    this.testsTotal++;
    try {
      this.log(`\n🧪 Testing: ${name}`, 'TEST');
      const result = await testFn();
      if (result) {
        this.testsPassed++;
        this.log(`✅ PASS: ${name}`, 'PASS');
        return true;
      } else {
        this.log(`❌ FAIL: ${name}`, 'FAIL');
        return false;
      }
    } catch (error) {
      this.log(`💥 ERROR in ${name}: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testCurrentDirectory() {
    const currentDir = process.cwd();
    this.log(`Current directory: ${currentDir}`);
    
    // Check if we're in the functions directory
    if (currentDir.includes('functions')) {
      this.log('✅ Running from functions directory');
      return true;
    } else {
      this.log('❌ Not running from functions directory', 'ERROR');
      this.log('Please cd into treasure-hunt-sdk/functions/ and run again', 'ERROR');
      return false;
    }
  }

  async testEnvironmentVariables() {
    // Load .env from current directory (should be functions/.env)
    if (fs.existsSync('.env')) {
      this.log('✅ Found .env file in current directory');
      require('dotenv').config();
    } else {
      this.log('❌ No .env file found in current directory', 'ERROR');
      return false;
    }
    
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'EBAY_CLIENT_ID', 
      'EBAY_CLIENT_SECRET',
      'EBAY_ACCESS_TOKEN'
    ];

    let hasRequired = true;
    
    this.log('Checking required environment variables:');
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        const maskedValue = process.env[envVar].slice(0, 8) + '...' + process.env[envVar].slice(-4);
        this.log(`✓ ${envVar}: ${maskedValue}`);
        this.config[envVar] = process.env[envVar];
      } else {
        this.log(`✗ Missing: ${envVar}`, 'ERROR');
        hasRequired = false;
      }
    }

    return hasRequired;
  }

  async testProjectStructure() {
    const requiredFiles = [
      'package.json',
      '.env',
      'capture-sdk/index.js',
      'capture-sdk/core/analyzeItem.js',
      'capture-sdk/core/routeDisposition.js',
      'capture-sdk/integrations/ebay/index.js'
    ];

    let allExist = true;
    this.log('Checking files in current directory:');
    
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        this.log(`✓ Found: ${file}`);
      } else {
        this.log(`✗ Missing: ${file}`, 'ERROR');
        allExist = false;
      }
    }
    return allExist;
  }

  async testSDKImport() {
    try {
      if (!fs.existsSync('./capture-sdk/index.js')) {
        this.log('❌ capture-sdk/index.js not found', 'ERROR');
        return false;
      }

      this.log('Loading SDK from current directory...');
      const CaptureSDK = require('./capture-sdk/index.js');
      
      const sdk = new CaptureSDK({
        visionProvider: 'gpt4v',
        apiKeys: {
          gpt4v: this.config.OPENAI_API_KEY
        },
        ebay: {
          clientId: this.config.EBAY_CLIENT_ID,
          clientSecret: this.config.EBAY_CLIENT_SECRET,
          accessToken: this.config.EBAY_ACCESS_TOKEN,
          environment: this.config.EBAY_ENVIRONMENT || 'production'
        }
      });

      this.log('✅ SDK instantiated successfully');
      this.sdk = sdk;
      return true;
    } catch (error) {
      this.log(`❌ SDK import failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testEbayTokenValidity() {
    if (!this.config.EBAY_ACCESS_TOKEN) {
      this.log('Skipping eBay token test - no access token', 'WARN');
      return false;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      
      const apiUrl = this.config.EBAY_ENVIRONMENT === 'sandbox' 
        ? 'https://api.sandbox.ebay.com'
        : 'https://api.ebay.com';

      this.log(`Testing eBay token against: ${apiUrl}`);

      // Test token with a simple API call
      const response = await fetch(`${apiUrl}/sell/account/v1/payment_policy`, {
        headers: {
          'Authorization': `Bearer ${this.config.EBAY_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      });

      this.log(`eBay API response: ${response.status} ${response.statusText}`);

      if (response.ok) {
        this.log('✅ eBay access token is valid and working');
        return true;
      } else if (response.status === 401) {
        this.log('❌ eBay access token is invalid or expired', 'ERROR');
        return false;
      } else {
        this.log(`⚠️ eBay API returned: ${response.status} - token may be valid but limited permissions`, 'WARN');
        return response.status !== 401;
      }
    } catch (error) {
      this.log(`❌ eBay token test failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testOpenAIConnection() {
    if (!this.config.OPENAI_API_KEY) {
      this.log('Skipping OpenAI test - no API key', 'WARN');
      return false;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.config.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const gpt4Models = data.data.filter(model => model.id.includes('gpt-4'));
        this.log(`✅ OpenAI API accessible. Available GPT-4 models: ${gpt4Models.length}`);
        return true;
      } else {
        this.log(`❌ OpenAI API error: ${response.status} ${response.statusText}`, 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`❌ OpenAI connection failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testEbayIntegration() {
    if (!this.sdk) {
      this.log('Cannot test eBay integration - SDK not loaded', 'ERROR');
      return false;
    }

    try {
      // Test the eBay integration directly
      this.log('Testing eBay integration...');
      
      const mockItemData = {
        category: 'Electronics',
        brand: 'Apple',
        model: 'iPhone',
        condition: { rating: 'good' },
        description: 'Test item for diagnostics'
      };

      const routes = await this.sdk.getRoutes(mockItemData);
      
      if (routes && routes.recommendedRoute) {
        this.log('✅ eBay integration working - routes generated');
        this.log(`Route type: ${routes.recommendedRoute.type}`);
        return true;
      } else {
        this.log('❌ eBay integration failed - no routes returned', 'ERROR');
        return false;
      }
    } catch (error) {
      this.log(`❌ eBay integration test failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  generateReport() {
    const passRate = ((this.testsPassed / this.testsTotal) * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 FIXED TREASURE HUNT SDK DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Tests Passed: ${this.testsPassed}/${this.testsTotal} (${passRate}%)`);
    console.log(`❌ Errors: ${this.errors.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES TO FIX:');
      this.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS TO ADDRESS:');
      this.warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`);
      });
    }

    console.log('\n🎯 NEXT STEPS:');
    
    if (this.testsPassed === this.testsTotal) {
      console.log('🎉 ALL TESTS PASSED! Your SDK should be ready to create eBay listings.');
      console.log('Try creating a listing from your frontend now.');
    } else if (this.errors.some(e => e.includes('directory'))) {
      console.log('1. Make sure you run this script from treasure-hunt-sdk/functions/');
    } else if (this.errors.some(e => e.includes('Missing'))) {
      console.log('2. Check your .env file in the functions directory');
    } else if (this.errors.some(e => e.includes('eBay'))) {
      console.log('3. Verify your eBay access token is valid and has proper permissions');
    } else {
      console.log('4. Review the specific errors above and fix them one by one');
    }

    console.log('\n📋 Run this script again after making fixes.');
  }

  async runAllTests() {
    console.log('🚀 Fixed Treasure Hunt SDK Diagnostics\n');
    console.log('Running from the functions directory to properly load environment variables.\n');

    await this.runTest('Current Directory Check', () => this.testCurrentDirectory());
    await this.runTest('Environment Variables', () => this.testEnvironmentVariables());
    await this.runTest('Project Structure', () => this.testProjectStructure());
    await this.runTest('SDK Import', () => this.testSDKImport());
    await this.runTest('OpenAI Connection', () => this.testOpenAIConnection());
    await this.runTest('eBay Token Validity', () => this.testEbayTokenValidity());
    await this.runTest('eBay Integration', () => this.testEbayIntegration());

    this.generateReport();
  }
}

// Execute if run directly
if (require.main === module) {
  const diagnostics = new FixedDiagnostics();
  diagnostics.runAllTests().catch(error => {
    console.error('💥 Diagnostic script crashed:', error);
    process.exit(1);
  });
}

module.exports = FixedDiagnostics;