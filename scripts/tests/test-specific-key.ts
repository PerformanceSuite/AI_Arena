/**
 * Test a specific Gemini API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testKey() {
  const apiKey = 'AIzaSyBL1RerykYca17CcHLrmvjxVc0HRAyUm6A';

  console.log('🔑 Testing provided API key...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try different model names
  const modelsToTry = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest'
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`Testing ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Write a haiku about AI' }] }]
      });

      const text = result.response.text();
      console.log(`✅ SUCCESS with ${modelName}!`);
      console.log(`Response: ${text}\n`);

      // Found a working model, done!
      return { model: modelName, success: true };
    } catch (error: any) {
      console.log(`❌ ${modelName}: ${error.status} - ${error.statusText}`);
    }
  }

  console.log('\n❌ None of the model names worked with this key.');
  return { success: false };
}

testKey();
