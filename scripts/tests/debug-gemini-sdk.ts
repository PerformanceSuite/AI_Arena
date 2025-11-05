/**
 * Debug Gemini SDK issue
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function debug() {
  const apiKey = 'AIzaSyBBbSTFEvomm-grlaNJ8xKmf3aCYjqiBuY';

  console.log('🔍 Debugging Gemini SDK...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try with explicit model name matching the API
  const models = [
    'gemini-2.5-flash',
    'models/gemini-2.5-flash',
    'gemini-2.5-pro',
    'models/gemini-2.5-pro'
  ];

  for (const modelName of models) {
    try {
      console.log(`\nTrying: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent('Say hello');

      const text = result.response.text();
      console.log(`✅ SUCCESS with ${modelName}!`);
      console.log(`Response: ${text}`);
      console.log(`Usage:`, result.response.usageMetadata);

      return { model: modelName, success: true };
    } catch (error: any) {
      console.log(`❌ Failed: ${error.status} - ${error.message?.substring(0, 100)}`);
    }
  }

  return { success: false };
}

debug();
