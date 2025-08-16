// test-ebay-setup.js - Cross-platform Node.js test script for eBay API (ES Module version)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(type, message, data = '') {
    const timestamp = new Date().toLocaleTimeString();
    const color = colors[type] || colors.reset;
    const prefix = {
        error: '[ERROR]',
        success: '[SUCCESS]',
        warning: '[WARNING]',
        info: '[INFO]'
    }[type] || '[LOG]';
    
    console.log(`${color}${prefix} ${message}${colors.reset}`, data);
}

function checkFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        log('success', `${filePath} (${stats.size} bytes)`);
        return true;
    } catch (error) {
        log('error', `${filePath} - MISSING`);
        return false;
    }
}

async function testEbayConfiguration() {
    log('cyan', '=== Testing eBay Configuration ===');
    
    // Check environment variables
    const requiredEnvVars = ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET'];
    let envOk = true;
    
    for (const envVar of requiredEnvVars) {
        if (process.env[envVar]) {
            const masked = process.env[envVar].substring(0, 10) + '...';
            log('success', `${envVar}: ${masked}`);
        } else {
            log('error', `${envVar} not set`);
            envOk = false;
        }
    }
    
    const environment = process.env.EBAY_ENVIRONMENT || 'production';
    log('info', `Environment: ${environment}`);
    
    return envOk;
}

async function checkProjectStructure() {
    log('cyan', '=== Checking Project Structure ===');
    
    const requiredFiles = [
        'package.json',
        'capture-sdk/integrations/ebay/simpleAPI.js',
        'capture-sdk/integrations/ebay/searchAPI.js',
        'capture-sdk/integrations/ebay/index.js'
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
        if (!checkFile(file)) {
            allFilesExist = false;
        }
    }
    
    return allFilesExist;
}

async function testModuleExports() {
    log('cyan', '=== Testing Module Exports ===');
    
    try {
        // Test if simpleAPI.js has correct exports
        const simpleAPIPath = path.join(__dirname, 'capture-sdk/integrations/ebay/simpleAPI.js');
        
        if (fs.existsSync(simpleAPIPath)) {
            const content = fs.readFileSync(simpleAPIPath, 'utf8');
            
            // Check for correct export
            if (content.includes('module.exports = { SimpleEbayAPI }')) {
                log('success', 'simpleAPI.js has correct export: { SimpleEbayAPI }');
            } else if (content.includes('module.exports = { simpleAPI }')) {
                log('error', 'simpleAPI.js has WRONG export: { simpleAPI } - should be { SimpleEbayAPI }');
                log('warning', 'This is likely the cause of your issue!');
                return false;
            } else {
                log('warning', 'simpleAPI.js export format unclear');
            }
            
            // Check for fetch import
            if (content.includes('const fetch = ')) {
                log('success', 'simpleAPI.js has fetch import');
            } else {
                log('error', 'simpleAPI.js missing fetch import');
                return false;
            }
        } else {
            log('error', 'simpleAPI.js not found');
            return false;
        }
        
        return true;
    } catch (error) {
        log('error', `Module export test failed: ${error.message}`);
        return false;
    }
}

async function testApiEndpoint() {
    log('cyan', '=== Testing API Endpoint ===');
    
    try {
        const fetch = (await import('node-fetch')).default;
        const apiUrl = 'https://app-beprv7ll2q-uc.a.run.app';
        
        log('info', `Testing health endpoint: ${apiUrl}/health`);
        
        const response = await fetch(`${apiUrl}/health`);
        const data = await response.json();
        
        if (response.ok) {
            log('success', 'Health endpoint responding');
            log('info', `SDK Available: ${data.sdk?.available || 'unknown'}`);
            log('info', `eBay Configured: ${data.sdk?.ebayConfigured || 'unknown'}`);
            
            if (data.sdk?.ebayConfigured) {
                log('success', 'eBay appears to be configured in Firebase');
            } else {
                log('warning', 'eBay may not be configured in Firebase');
            }
        } else {
            log('error', `Health endpoint failed: ${response.status}`);
            return false;
        }
        
        return true;
    } catch (error) {
        log('error', `API test failed: ${error.message}`);
        return false;
    }
}

async function simulateEbayCall() {
    log('cyan', '=== Simulating eBay API Call ===');
    
    // Test the exact logic your system should use
    const testItemData = {
        category: "clothing",
        brand: "Unknown",
        model: "Unknown",
        condition: { rating: "good" }
    };
    
    log('info', 'Test item data:', JSON.stringify(testItemData, null, 2));
    
    // Simulate search query building
    const searchTerms = [];
    
    if (testItemData.brand && testItemData.brand !== 'Unknown') {
        searchTerms.push(testItemData.brand);
    }
    
    if (testItemData.model && testItemData.model !== 'Unknown') {
        searchTerms.push(testItemData.model);
    }
    
    if (testItemData.category) {
        searchTerms.push(testItemData.category);
    }
    
    const query = searchTerms.join(' ');
    
    if (query.trim()) {
        log('success', `Would search eBay for: "${query}"`);
        return true;
    } else {
        log('warning', 'No valid search terms generated - this might cause fallback to manual pricing');
        return false;
    }
}

async function diagnoseIssue() {
    log('cyan', '=== Diagnosing the Issue ===');
    
    log('info', 'Based on your logs, the system shows:');
    log('info', '- eBay Config Status: hasClientId: true, hasClientSecret: true');
    log('info', '- But pricing result shows: source: "enhanced_manual"');
    log('info', '- This suggests eBay search is not being called');
    
    console.log('\nMost likely causes:');
    console.log('1. Module export/import mismatch in simpleAPI.js');
    console.log('2. Pricing logic not actually calling eBay search functions');
    console.log('3. Silent failures in eBay API calls');
    console.log('4. Missing error handling causing fallback to manual pricing');
    
    console.log('\nRecommended fixes:');
    console.log('1. Fix simpleAPI.js export: module.exports = { SimpleEbayAPI }');
    console.log('2. Add comprehensive logging to trace function calls');
    console.log('3. Ensure pricing logic actually invokes eBay search');
    console.log('4. Add try/catch blocks around eBay API calls');
}

async function main() {
    console.log('🔍 eBay API Setup Diagnostic Tool');
    console.log('==================================\n');
    
    const results = {
        environment: await testEbayConfiguration(),
        structure: await checkProjectStructure(),
        exports: await testModuleExports(),
        api: await testApiEndpoint(),
        simulation: await simulateEbayCall()
    };
    
    console.log('\n');
    await diagnoseIssue();
    
    console.log('\n=== Summary ===');
    Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${test}`);
    });
    
    const overallSuccess = Object.values(results).every(Boolean);
    
    if (overallSuccess) {
        log('success', 'All tests passed! eBay API should work.');
        console.log('\nIf you\'re still seeing "enhanced_manual", check that your pricing logic actually calls the eBay API functions.');
    } else {
        log('error', 'Some tests failed. Fix the issues above and try again.');
    }
    
    console.log('\nNext steps:');
    console.log('1. Fix any failed tests above');
    console.log('2. Deploy your functions: firebase deploy --only functions');
    console.log('3. Test with a real image upload');
    console.log('4. Check browser console for eBay API logs');
}

// Run the diagnostic
main().catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
});