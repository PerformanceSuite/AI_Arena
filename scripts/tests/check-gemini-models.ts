/**
 * Quick script to check what Gemini models are available with your API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('🔍 Checking available Gemini models...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try to list models
  try {
    console.log('Attempting to call listModels()...');
    // The SDK doesn't expose listModels directly in a simple way,
    // so let's just try the common model names

    const commonModels = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'models/gemini-pro',
      'models/gemini-1.5-pro',
      'models/gemini-1.5-flash'
    ];

    console.log('\nTrying common model names:\n');

    for (const modelName of commonModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Say "OK"' }] }]
        });

        const text = result.response.text();
        console.log(`✅ ${modelName}: ${text.substring(0, 50)}`);
      } catch (error: any) {
        if (error.status === 404) {
          console.log(`❌ ${modelName}: Not found (404)`);
        } else if (error.status === 400) {
          console.log(`⚠️  ${modelName}: Bad request (400) - ${error.message?.substring(0, 80)}`);
        } else {
          console.log(`❌ ${modelName}: ${error.message?.substring(0, 80)}`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkModels();
