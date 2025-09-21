#!/usr/bin/env node

/**
 * Script to get the Lambda function URL after deployment
 * Run this after: npx ampx sandbox deploy
 */

const { execSync } = require('child_process');
const fs = require('fs');

async function getFunctionUrl() {
  try {
    console.log('🔍 Looking for simple-invites Lambda function...');
    
    // Get the function name from AWS CLI
    const listFunctions = execSync('aws lambda list-functions --query "Functions[?contains(FunctionName, \'simple-invites\')].FunctionName" --output text', { encoding: 'utf8' });
    
    if (!listFunctions.trim()) {
      console.log('❌ No simple-invites function found. Make sure you deployed with: npx ampx sandbox deploy');
      return;
    }
    
    const functionName = listFunctions.trim();
    console.log(`✅ Found function: ${functionName}`);
    
    // Get the function URL configuration
    try {
      const urlConfig = execSync(`aws lambda get-function-url-config --function-name "${functionName}" --query "FunctionUrl" --output text`, { encoding: 'utf8' });
      
      if (urlConfig && urlConfig.trim() !== 'None') {
        const functionUrl = urlConfig.trim();
        console.log(`🎉 Function URL: ${functionUrl}`);
        
        // Update .env file
        updateEnvFile(functionUrl);
        
      } else {
        console.log('❌ Function URL not configured. The function might still be deploying.');
        console.log('💡 Try running this script again in a few minutes.');
      }
    } catch (error) {
      console.log('❌ Function URL not found. The function might still be deploying.');
      console.log('💡 Try running this script again in a few minutes.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Deployed with: npx ampx sandbox deploy');
    console.log('   2. AWS CLI configured with proper credentials');
    console.log('   3. Proper permissions to access Lambda functions');
  }
}

function updateEnvFile(functionUrl) {
  try {
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Update the function URL in .env file
    const updatedContent = envContent.replace(
      /EXPO_PUBLIC_UNIVERSAL_LINKS_FUNCTION_URL=.*/,
      `EXPO_PUBLIC_UNIVERSAL_LINKS_FUNCTION_URL=${functionUrl}`
    );
    
    fs.writeFileSync('.env', updatedContent);
    console.log('✅ Updated .env file with function URL');
    console.log('\n🚀 Your invite system is now ready!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart your Expo development server');
    console.log('   2. Test creating an invite link');
    console.log('   3. Test the deep link: hakuba://invite/test-id');
    
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
    console.log(`\n💡 Please manually update your .env file:`);
    console.log(`   EXPO_PUBLIC_UNIVERSAL_LINKS_FUNCTION_URL=${functionUrl}`);
  }
}

// Run the script
getFunctionUrl();