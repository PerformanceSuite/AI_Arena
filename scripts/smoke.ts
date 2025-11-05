#!/usr/bin/env tsx

import { loadConfig } from '../src/util/config';
import { configureProviders, getProvider } from '../src/adapters/index';
import type { CNF } from '../src/cnf/types';

async function runSmokeTests() {
  console.log('🔥 Running smoke tests...\n');

  try {
    // Load config
    const config = loadConfig();
    await configureProviders(config);
    console.log('✅ Configuration loaded\n');

    const cnf: CNF = {
      sessionId: 'smoke-test',
      messages: [{ role: 'user', content: 'Say hello in 5 words' }]
    };

    // Test each provider
    for (const [name, cfg] of Object.entries(config.providers)) {
      try {
        console.log(`Testing ${name}...`);
        const provider = getProvider(name);

        const result = await provider.chat({
          cnf,
          targetModel: cfg.models[0]?.id || 'default',
          maxTokens: 50
        });

        console.log(`  ✅ ${name}: "${result.outputText?.slice(0, 50)}..."`);
        console.log(`  📊 Tokens: ${result.usage?.total || 'unknown'}\n`);
      } catch (error) {
        console.log(`  ❌ ${name} failed:`, (error as Error).message, '\n');
      }
    }

    console.log('✨ Smoke tests complete!');
  } catch (error) {
    console.error('❌ Smoke tests failed:', error);
    process.exit(1);
  }
}

runSmokeTests();
