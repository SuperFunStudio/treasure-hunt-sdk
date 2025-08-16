// check-modules.js
// Scan capture-sdk directory to verify all modules have proper CommonJS exports

const fs = require('fs');
const path = require('path');

function checkModules(dir = './capture-sdk') {
  console.log('🔍 Scanning capture-sdk directory for module export issues...\n');
  
  const results = {
    correct: [],
    missing: [],
    suspicious: [],
    errors: []
  };

  function scanDirectory(dirPath, relativePath = '') {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativeFilePath = path.join(relativePath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(fullPath, relativeFilePath);
        } else if (item.endsWith('.js')) {
          checkJavaScriptFile(fullPath, relativeFilePath);
        }
      }
    } catch (error) {
      results.errors.push(`Error scanning directory ${dirPath}: ${error.message}`);
    }
  }

  function checkJavaScriptFile(filePath, relativePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const analysis = analyzeFile(content, relativePath);
      
      if (analysis.hasErrors) {
        results.errors.push(`${relativePath}: ${analysis.errors.join(', ')}`);
      } else if (analysis.isCorrect) {
        results.correct.push(relativePath);
      } else if (analysis.isMissing) {
        results.missing.push({
          file: relativePath,
          functions: analysis.functions,
          classes: analysis.classes,
          suggestion: analysis.suggestion
        });
      } else if (analysis.isSuspicious) {
        results.suspicious.push({
          file: relativePath,
          issue: analysis.issue,
          content: analysis.suspiciousContent
        });
      }
    } catch (error) {
      results.errors.push(`Error reading ${relativePath}: ${error.message}`);
    }
  }

  function analyzeFile(content, filePath) {
    const lines = content.split('\n');
    const analysis = {
      hasModuleExports: false,
      hasESExports: false,
      functions: [],
      classes: [],
      errors: [],
      isCorrect: false,
      isMissing: false,
      isSuspicious: false,
      issue: '',
      suspiciousContent: '',
      suggestion: ''
    };

    // Skip certain files that don't need exports
    const skipFiles = ['index.js', 'config.js', 'test.js'];
    const fileName = path.basename(filePath);
    if (skipFiles.some(skip => fileName.includes(skip))) {
      analysis.isCorrect = true;
      return analysis;
    }

    // Look for module.exports
    const moduleExportsRegex = /module\.exports\s*=\s*\{/;
    const moduleExportsFound = content.match(moduleExportsRegex);
    if (moduleExportsFound) {
      analysis.hasModuleExports = true;
    }

    // Look for ES module exports (these are problems)
    const esExportRegex = /export\s+(function|class|const|let|var|default|\{)/;
    const esExportsFound = content.match(esExportRegex);
    if (esExportsFound) {
      analysis.hasESExports = true;
      analysis.isSuspicious = true;
      analysis.issue = 'Contains ES module exports (should be CommonJS)';
      analysis.suspiciousContent = esExportsFound[0];
    }

    // Find function declarations
    const functionRegex = /^(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      analysis.functions.push(match[2]);
    }

    // Find class declarations
    const classRegex = /^class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    while ((match = classRegex.exec(content)) !== null) {
      analysis.classes.push(match[1]);
    }

    // Determine the file's status
    if (analysis.hasESExports) {
      analysis.isSuspicious = true;
    } else if (analysis.hasModuleExports) {
      analysis.isCorrect = true;
    } else if (analysis.functions.length > 0 || analysis.classes.length > 0) {
      analysis.isMissing = true;
      analysis.suggestion = generateSuggestion(analysis.functions, analysis.classes);
    } else {
      // File with no exports (might be a utility or config file)
      analysis.isCorrect = true;
    }

    return analysis;
  }

  function generateSuggestion(functions, classes) {
    const exports = [];
    
    if (functions.length > 0) {
      exports.push(...functions);
    }
    
    if (classes.length > 0) {
      exports.push(...classes);
    }

    if (exports.length === 0) {
      return 'module.exports = {};';
    }

    return `module.exports = { ${exports.join(', ')} };`;
  }

  // Start scanning
  scanDirectory(dir);

  // Print results
  printResults(results);
  
  return results;
}

function printResults(results) {
  console.log('📊 SCAN RESULTS:\n');

  // Correct files
  if (results.correct.length > 0) {
    console.log('✅ CORRECT CommonJS modules:');
    results.correct.forEach(file => console.log(`   ${file}`));
    console.log('');
  }

  // Missing exports
  if (results.missing.length > 0) {
    console.log('❌ MISSING module.exports:');
    results.missing.forEach(item => {
      console.log(`   📄 ${item.file}`);
      console.log(`      Functions: [${item.functions.join(', ')}]`);
      console.log(`      Classes: [${item.classes.join(', ')}]`);
      console.log(`      Add: ${item.suggestion}`);
      console.log('');
    });
  }

  // Suspicious files (still using ES modules)
  if (results.suspicious.length > 0) {
    console.log('⚠️  SUSPICIOUS (still using ES modules):');
    results.suspicious.forEach(item => {
      console.log(`   📄 ${item.file}`);
      console.log(`      Issue: ${item.issue}`);
      console.log(`      Found: ${item.suspiciousContent}`);
      console.log('');
    });
  }

  // Errors
  if (results.errors.length > 0) {
    console.log('💥 ERRORS:');
    results.errors.forEach(error => console.log(`   ${error}`));
    console.log('');
  }

  // Summary
  console.log('📈 SUMMARY:');
  console.log(`   ✅ Correct: ${results.correct.length}`);
  console.log(`   ❌ Missing exports: ${results.missing.length}`);
  console.log(`   ⚠️  Suspicious: ${results.suspicious.length}`);
  console.log(`   💥 Errors: ${results.errors.length}`);
  
  if (results.missing.length === 0 && results.suspicious.length === 0 && results.errors.length === 0) {
    console.log('\n🎉 All modules look good for CommonJS! Ready for Firebase Functions deployment.');
  } else {
    console.log(`\n🔧 Fix ${results.missing.length + results.suspicious.length} file(s) before deployment.`);
  }
}

// Auto-fix function
function autoFix(results) {
  console.log('\n🔧 AUTO-FIX MODE');
  console.log('This will automatically add module.exports to files that need it.');
  
  // In a real implementation, you'd want to be more careful about this
  // For now, just show what would be fixed
  results.missing.forEach(item => {
    console.log(`Would add to ${item.file}: ${item.suggestion}`);
  });
  
  results.suspicious.forEach(item => {
    console.log(`Would convert ES modules in ${item.file} to CommonJS`);
  });
}

// Run the check
if (require.main === module) {
  const results = checkModules();
  
  // If user wants auto-fix, uncomment the next line
  // autoFix(results);
}

module.exports = { checkModules };