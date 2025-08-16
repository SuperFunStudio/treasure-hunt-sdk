// fix-env-tokens.js
// Fix .env token parsing by adding quotes
import fs from 'fs';

console.log('🔧 Fixing .env token parsing...\n');

try {
  // Read current .env file
  let envContent = fs.readFileSync('.env', 'utf8');
  console.log('📄 Current .env file size:', envContent.length, 'characters');
  
  // Fix EBAY_ACCESS_TOKEN line
  envContent = envContent.replace(
    /^EBAY_ACCESS_TOKEN=(.+)$/m,
    'EBAY_ACCESS_TOKEN="$1"'
  );
  
  // Fix EBAY_REFRESH_TOKEN line  
  envContent = envContent.replace(
    /^EBAY_REFRESH_TOKEN=(.+)$/m,
    'EBAY_REFRESH_TOKEN="$1"'
  );
  
  // Write back to .env
  fs.writeFileSync('.env', envContent);
  
  console.log('✅ .env file updated with quoted tokens');
  console.log('📄 New .env file size:', envContent.length, 'characters');
  
  // Test the fix
  console.log('\n🧪 Testing token loading after fix...');
  
  // Clear require cache and reload dotenv
  delete require.cache[require.resolve('dotenv')];
  process.env = {}; // Clear environment
  
  const dotenv = await import('dotenv');
  dotenv.config();
  
  console.log('✅ Environment reloaded');
  console.log('EBAY_ACCESS_TOKEN length:', process.env.EBAY_ACCESS_TOKEN?.length || 0);
  console.log('EBAY_REFRESH_TOKEN length:', process.env.EBAY_REFRESH_TOKEN?.length || 0);
  
  if (process.env.EBAY_ACCESS_TOKEN?.length > 100) {
    console.log('🎉 SUCCESS! Tokens are now properly loaded');
    console.log('✅ Access token preview:', process.env.EBAY_ACCESS_TOKEN.substring(0, 30) + '...');
    console.log('✅ Refresh token preview:', process.env.EBAY_REFRESH_TOKEN.substring(0, 30) + '...');
    
    console.log('\n🚀 Now run: node fixed-ebay-test.js');
  } else {
    console.log('❌ Tokens still not loading correctly');
    console.log('Manual check needed - look at your .env file');
  }
  
} catch (error) {
  console.error('❌ Error fixing .env file:', error.message);
  
  console.log('\n📝 Manual fix instructions:');
  console.log('1. Open your .env file');
  console.log('2. Find the EBAY_ACCESS_TOKEN line');
  console.log('3. Add quotes around the token value:');
  console.log('   EBAY_ACCESS_TOKEN="v^1.1#i^1#r^0#I^3#p^..."');
  console.log('4. Do the same for EBAY_REFRESH_TOKEN');
  console.log('5. Save the file');
}