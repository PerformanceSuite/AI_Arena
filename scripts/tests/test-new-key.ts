/**
 * Test new Gemini API key from clipboard
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

async function testKey() {
  const apiKey = 'AIzaSyBBbSTFEvomm-grlaNJ8xKmf3aCYjqiBuY';

  console.log('🔑 Testing new Gemini API key...\n');

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log('Testing gemini-2.5-flash...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Write a haiku about AI' }] }]
    });

    const text = result.response.text();
    console.log('✅ SUCCESS!');
    console.log(`Response:\n${text}\n`);
    console.log('Usage:', result.response.usageMetadata);

    return true;
  } catch (error: any) {
    console.log(`❌ FAILED: ${error.status} - ${error.message}`);
    return false;
  }
}

testKey();
