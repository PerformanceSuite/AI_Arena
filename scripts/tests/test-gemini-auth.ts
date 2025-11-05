/**
 * Test if Gemini API key is valid and has proper access
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testAuth() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('🔑 Testing Gemini API key authentication...\n');
  console.log(`API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try gemini-pro which should be most stable
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  try {
    console.log('\nAttempting to generate content with gemini-pro...\n');

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: 'Say hello' }] }
      ]
    });

    const response = result.response;
    console.log('✅ SUCCESS! API key is valid and working!');
    console.log(`Response: ${response.text()}`);
    console.log(`\nUsage:`, response.usageMetadata);
  } catch (error: any) {
    console.error('❌ FAILED\n');
    console.error('Error details:');
    console.error('- Status:', error.status);
    console.error('- Status Text:', error.statusText);
    console.error('- Message:', error.message);

    if (error.status === 404) {
      console.error('\n🔍 Diagnosis:');
      console.error('The model name is not found. Possible reasons:');
      console.error('1. API key is for a different Google service (not Generative AI)');
      console.error('2. API key does not have Gemini API enabled');
      console.error('3. Need to use different endpoint/version');
      console.error('\n📝 Action: Get a new API key from:');
      console.error('   https://makersuite.google.com/app/apikey');
      console.error('   or https://aistudio.google.com/app/apikey');
    } else if (error.status === 401 || error.status === 403) {
      console.error('\n🔍 Diagnosis:');
      console.error('API key is invalid or lacks permissions');
      console.error('- 401: Invalid API key');
      console.error('- 403: Valid key but lacks Gemini API access');
    }
  }
}

testAuth();
