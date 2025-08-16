// deployment-diagnostics.js
// Diagnostic script to identify deployment issues

const fs = require('fs');
const path = require('path');

function runDiagnostics() {
  console.log('🔍 FIREBASE FUNCTIONS DEPLOYMENT DIAGNOSTICS\n');
  
  const results = {
    issues: [],
    warnings: [],
    suggestions: []
  };

  // Check 1: Package.json dependencies
  checkPackageJson(results);
  
  // Check 2: Index.js structure
  checkIndexJs(results);
  
  // Check 3: Memory and timeout settings
  checkResourceSettings(results);
  
  // Check 4: Common deployment issues
  checkCommonIssues(results);
  
  printResults(results);
  generateFixes(results);
}

function checkPackageJson(results) {
  console.log('📦 Checking package.json...');
  
  try {
    const packagePath = './package.json';
    if (!fs.existsSync(packagePath)) {
      results.issues.push('package.json not found in functions directory');
      return;
    }
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Check Node.js version
    if (pkg.engines && pkg.engines.node) {
      console.log(`   Node.js version: ${pkg.engines.node}`);
      if (!pkg.engines.node.includes('20')) {
        results.warnings.push('Consider using Node.js 20 for Firebase Functions v2');
      }
    } else {
      results.issues.push('No Node.js version specified in package.json engines');
    }
    
    // Check for problematic dependencies
    const problematicDeps = ['node-fetch'];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    problematicDeps.forEach(dep => {
      if (deps[dep]) {
        results.warnings.push(`Dependency ${dep} can cause deployment issues in Firebase Functions`);
      }
    });
    
    // Check for missing essential dependencies
    const essential = ['firebase-functions', 'firebase-admin'];
    essential.forEach(dep => {
      if (!deps[dep]) {
        results.issues.push(`Missing essential dependency: ${dep}`);
      }
    });
    
    console.log('   ✅ Package.json checked');
    
  } catch (error) {
    results.issues.push(`Error reading package.json: ${error.message}`);
  }
}

function checkIndexJs(results) {
  console.log('📄 Checking index.js structure...');
  
  try {
    const indexPath = './index.js';
    if (!fs.existsSync(indexPath)) {
      results.issues.push('index.js not found in functions directory');
      return;
    }
    
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check for exports
    const exports = content.match(/exports\.\w+/g) || [];
    console.log(`   Found exports: ${exports.join(', ')}`);
    
    if (exports.length === 0) {
      results.issues.push('No exports found in index.js');
    }
    
    // Check for async/await in top level
    if (content.includes('await ') && !content.includes('async function')) {
      results.warnings.push('Top-level await usage detected - may cause startup issues');
    }
    
    // Check for dynamic imports
    if (content.includes('import(')) {
      results.warnings.push('Dynamic imports detected - ensure they are properly handled');
    }
    
    // Check for long synchronous operations
    const lines = content.split('\n');
    let hasLongSyncOperations = false;
    
    lines.forEach((line, index) => {
      if (line.includes('fs.readFileSync') || 
          line.includes('require(') && line.length > 100) {
        hasLongSyncOperations = true;
      }
    });
    
    if (hasLongSyncOperations) {
      results.warnings.push('Potential long synchronous operations detected at startup');
    }
    
    console.log('   ✅ Index.js structure checked');
    
  } catch (error) {
    results.issues.push(`Error reading index.js: ${error.message}`);
  }
}

function checkResourceSettings(results) {
  console.log('⚡ Checking resource settings...');
  
  try {
    const indexPath = './index.js';
    const content = fs.readFileSync(indexPath, 'utf8');
    
    // Check memory settings
    const memoryMatches = content.match(/memory:\s*['"](\d+MiB)['"]/g);
    if (memoryMatches) {
      console.log(`   Memory settings found: ${memoryMatches.join(', ')}`);
      memoryMatches.forEach(match => {
        const memory = match.match(/(\d+)MiB/)[1];
        if (parseInt(memory) < 512) {
          results.warnings.push(`Low memory setting detected: ${memory}MiB - consider increasing for SDK operations`);
        }
      });
    }
    
    // Check timeout settings
    const timeoutMatches = content.match(/timeoutSeconds:\s*(\d+)/g);
    if (timeoutMatches) {
      console.log(`   Timeout settings found: ${timeoutMatches.join(', ')}`);
      timeoutMatches.forEach(match => {
        const timeout = match.match(/(\d+)/)[1];
        if (parseInt(timeout) < 60) {
          results.warnings.push(`Short timeout detected: ${timeout}s - may not be enough for SDK initialization`);
        }
      });
    }
    
    console.log('   ✅ Resource settings checked');
    
  } catch (error) {
    results.warnings.push(`Could not check resource settings: ${error.message}`);
  }
}

function checkCommonIssues(results) {
  console.log('🚨 Checking for common deployment issues...');
  
  // Check for .env file
  if (fs.existsSync('./.env')) {
    console.log('   .env file found');
    try {
      const envContent = fs.readFileSync('./.env', 'utf8');
      const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      console.log(`   Environment variables: ${lines.length}`);
      
      // Check for required variables
      const requiredEnvVars = ['OPENAI_API_KEY'];
      requiredEnvVars.forEach(varName => {
        if (!envContent.includes(varName)) {
          results.warnings.push(`Environment variable ${varName} not found in .env`);
        }
      });
      
    } catch (error) {
      results.warnings.push('Could not read .env file');
    }
  } else {
    results.warnings.push('.env file not found - using Firebase Functions config');
  }
  
  // Check for large files
  try {
    const stats = fs.statSync('./index.js');
    const fileSizeKB = stats.size / 1024;
    console.log(`   index.js size: ${fileSizeKB.toFixed(2)} KB`);
    
    if (fileSizeKB > 100) {
      results.warnings.push(`Large index.js file (${fileSizeKB.toFixed(2)} KB) - may slow startup`);
    }
  } catch (error) {
    // File size check failed
  }
  
  console.log('   ✅ Common issues checked');
}

function printResults(results) {
  console.log('\n📊 DIAGNOSTIC RESULTS:\n');
  
  if (results.issues.length > 0) {
    console.log('❌ CRITICAL ISSUES:');
    results.issues.forEach(issue => console.log(`   • ${issue}`));
    console.log('');
  }
  
  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    results.warnings.forEach(warning => console.log(`   • ${warning}`));
    console.log('');
  }
  
  if (results.suggestions.length > 0) {
    console.log('💡 SUGGESTIONS:');
    results.suggestions.forEach(suggestion => console.log(`   • ${suggestion}`));
    console.log('');
  }
  
  // Overall assessment
  if (results.issues.length === 0) {
    console.log('✅ No critical issues found');
  } else {
    console.log(`❌ ${results.issues.length} critical issue(s) need to be fixed`);
  }
  
  if (results.warnings.length > 0) {
    console.log(`⚠️  ${results.warnings.length} warning(s) may affect deployment`);
  }
}

function generateFixes(results) {
  console.log('\n🔧 RECOMMENDED FIXES:\n');
  
  console.log('1. **Increase startup timeout:**');
  console.log('   Add to all function exports:');
  console.log('   ```javascript');
  console.log('   exports.functionName = onRequest({');
  console.log('     cors: true,');
  console.log('     invoker: "public",');
  console.log('     memory: "1GiB",           // Increase memory');
  console.log('     timeoutSeconds: 540,      // Increase timeout to 9 minutes');
  console.log('     cpu: 1                    // Ensure adequate CPU');
  console.log('   }, handler);');
  console.log('   ```\n');
  
  console.log('2. **Optimize SDK initialization:**');
  console.log('   Move SDK initialization inside request handlers:');
  console.log('   ```javascript');
  console.log('   let sdk = null;');
  console.log('   async function getSDK() {');
  console.log('     if (!sdk) {');
  console.log('       sdk = new CaptureSDK(config);');
  console.log('     }');
  console.log('     return sdk;');
  console.log('   }');
  console.log('   ```\n');
  
  console.log('3. **Check Firebase Functions logs:**');
  console.log('   View detailed error logs:');
  console.log('   ```bash');
  console.log('   firebase functions:log --only health');
  console.log('   ```\n');
  
  console.log('4. **Deploy functions individually:**');
  console.log('   Test one function at a time:');
  console.log('   ```bash');
  console.log('   firebase deploy --only functions:health');
  console.log('   ```\n');
  
  console.log('5. **Use local emulator first:**');
  console.log('   Test locally before deploying:');
  console.log('   ```bash');
  console.log('   firebase emulators:start --only functions');
  console.log('   ```');
}

if (require.main === module) {
  runDiagnostics();
}

module.exports = { runDiagnostics };