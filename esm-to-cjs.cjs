// esm-to-cjs.js
const fs = require('fs');
const path = require('path');

function convertFile(filePath) {
  let data = fs.readFileSync(filePath, 'utf8');

  // Replace import statements
  data = data.replace(/import\s+([\w{}*,\s]+)\s+from\s+['"](.+)['"];?/g, (match, vars, mod) => {
    // Named imports
    if (vars.includes('{')) {
      return vars.replace(/[{}]/g, '').split(',').map(v => {
        const vTrim = v.trim();
        return `const ${vTrim} = require('${mod}').${vTrim};`;
      }).join('\n');
    }
    // Default or * as
    if (vars.startsWith('* as')) {
      // import * as something from 'mod';
      const name = vars.match(/\*\s+as\s+(\w+)/)[1];
      return `const ${name} = require('${mod}');`;
    } else {
      // import X from 'mod';
      return `const ${vars.trim()} = require('${mod}');`;
    }
  });

  // Replace export default
  data = data.replace(/export\s+default\s+([\w{}]+);?/g, 'module.exports = $1;');

  // Replace named export (export { foo, bar };)
  data = data.replace(/export\s*\{\s*([^\}]+)\s*\};?/g, (match, exports) => {
    const parts = exports.split(',').map(e => e.trim()).filter(Boolean);
    return 'module.exports = {\n  ' + parts.join(',\n  ') + '\n};';
  });

  // Replace named export (export const foo = ...)
  data = data.replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 =');

  // Replace named export (export function foo...)
  data = data.replace(/export\s+function\s+(\w+)\s*\(/g, 'function $1(');

  fs.writeFileSync(filePath, data, 'utf8');
  console.log('Converted:', filePath);
}

function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.js')) convertFile(full);
  });
}

// Usage: node esm-to-cjs.js ./functions/capture-sdk
if (process.argv.length < 3) {
  console.error('Usage: node esm-to-cjs.js <sdk-folder>');
  process.exit(1);
}
const target = process.argv[2];
walk(target);

console.log('\nDone! Check your .js files in', target, 'for CommonJS syntax.');
