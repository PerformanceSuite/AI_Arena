/**
 * Phase 1 Integration Test Script
 * Tests the core functionality with real API keys
 */

import { loadConfig, type ArenaConfig } from '../src/util/config';
import { configureProviders, getProvider } from '../src/adapters/index';
import { invokeOperation, competeOperation } from '../src/core/operations';
import type { CNF } from '../src/cnf/types';

// Color formatting for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function success(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function error(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function section(title: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

// Simple test CNF with a creative prompt
function createTestCNF(): CNF {
  return {
    sessionId: `test-${Date.now()}`,
    messages: [
      {
        role: 'user',
        content: 'Write a haiku about artificial intelligence.'
      }
    ]
  };
}

async function test1_BasicInvoke() {
  section('Test 1: Basic Invoke with Single Provider');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Testing OpenAI GPT-4o-mini...');
    const result = await invokeOperation({
      cnf,
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7
    });

    success('OpenAI invocation succeeded');
    console.log(`${colors.dim}Response: ${result.outputText?.substring(0, 100)}...${colors.reset}`);
    console.log(`${colors.dim}Tokens: ${result.usage?.total || 'unknown'}${colors.reset}`);

    return true;
  } catch (err) {
    error(`OpenAI invocation failed: ${(err as Error).message}`);
    return false;
  }
}

async function test2_MultipleProviders() {
  section('Test 2: Invoke Multiple Providers Individually');

  const cnf = createTestCNF();
  const providers = [
    { name: 'openai', model: 'gpt-4o-mini' },
    { name: 'google', model: 'gemini-2.5-flash' }
  ];

  let allPassed = true;

  for (const { name, model } of providers) {
    try {
      log('🔄', `Testing ${name} (${model})...`);
      const result = await invokeOperation({
        cnf,
        provider: name,
        model,
        temperature: 0.7
      });

      success(`${name} invocation succeeded`);
      console.log(`${colors.dim}Response: ${result.outputText?.substring(0, 80)}...${colors.reset}`);
      console.log(`${colors.dim}Tokens: ${result.usage?.total || 'unknown'}${colors.reset}\n`);
    } catch (err) {
      error(`${name} invocation failed: ${(err as Error).message}\n`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function test3_RoundRobinCompetition() {
  section('Test 3: Round-Robin Competition');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Running competition with OpenAI vs Google...');

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'google', model: 'gemini-2.5-flash' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.5,
            structure: 0.5
          }
        },
        judges: [
          { type: 'heuristic' }
        ]
      }
    });

    success('Competition completed');
    console.log(`\n${colors.yellow}🏆 Winner: ${result.winner.id}${colors.reset}`);
    console.log(`${colors.dim}Score: ${result.winner.score.toFixed(2)}${colors.reset}`);
    console.log(`${colors.dim}Response: ${result.winner.text.substring(0, 100)}...${colors.reset}`);

    console.log(`\n${colors.yellow}📊 Leaderboard:${colors.reset}`);
    result.leaderboard.forEach((entry, idx) => {
      console.log(`${colors.dim}${idx + 1}. ${entry.id}: ${entry.score.toFixed(2)}${colors.reset}`);
    });

    return true;
  } catch (err) {
    error(`Competition failed: ${(err as Error).message}`);
    console.error(err);
    return false;
  }
}

async function test4_CascadeMode() {
  section('Test 4: Cascade Mode (Cheap to Expensive)');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Running cascade: GPT-4o-mini → GPT-4o...');

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'openai', model: 'gpt-4o' }
        ],
        mode: 'cascade',
        rubric: {
          weights: {
            length: 0.4,
            structure: 0.6
          }
        },
        judges: [
          { type: 'heuristic' }
        ]
      }
    });

    success('Cascade completed');
    console.log(`${colors.dim}Winner: ${result.winner.id}${colors.reset}`);
    console.log(`${colors.dim}Score: ${result.winner.score.toFixed(2)}${colors.reset}`);

    return true;
  } catch (err) {
    error(`Cascade failed: ${(err as Error).message}`);
    return false;
  }
}

async function test5_LLMJudge() {
  section('Test 5: LLM Judge (Using GPT-4o-mini as judge)');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Running competition with LLM judge...');

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'google', model: 'gemini-2.5-flash' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.3,
            structure: 0.3,
            keywords: 0.4
          },
          keywords: ['haiku', 'AI', 'artificial', 'intelligence']
        },
        judges: [
          { type: 'heuristic' },
          { type: 'llm', provider: 'openai', model: 'gpt-4o-mini' }
        ]
      }
    });

    success('Competition with LLM judge completed');
    console.log(`${colors.yellow}🏆 Winner: ${result.winner.id}${colors.reset}`);
    console.log(`${colors.dim}Score: ${result.winner.score.toFixed(2)}${colors.reset}`);

    return true;
  } catch (err) {
    error(`LLM judge test failed: ${(err as Error).message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║           AI Arena Phase 1 Integration Tests             ║
║                  Testing with Real APIs                   ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  try {
    // Load configuration
    log('📋', 'Loading configuration...');
    const config = loadConfig();
    success('Configuration loaded');

    // Configure providers
    log('🔧', 'Configuring providers...');
    await configureProviders(config);
    success('Providers configured');

    const configuredProviders = Object.keys(config.providers);
    console.log(`${colors.dim}Available providers: ${configuredProviders.join(', ')}${colors.reset}\n`);

    // Run tests
    const results = {
      test1: await test1_BasicInvoke(),
      test2: await test2_MultipleProviders(),
      test3: await test3_RoundRobinCompetition(),
      test4: await test4_CascadeMode(),
      test5: await test5_LLMJudge()
    };

    // Summary
    section('Test Summary');
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    console.log(`Tests passed: ${passed}/${total}\n`);

    Object.entries(results).forEach(([test, passed]) => {
      if (passed) {
        success(test);
      } else {
        error(test);
      }
    });

    if (passed === total) {
      console.log(`\n${colors.green}🎉 All tests passed! Phase 1 is working correctly.${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.yellow}⚠️  Some tests failed. See details above.${colors.reset}\n`);
      process.exit(1);
    }

  } catch (err) {
    error(`Fatal error: ${(err as Error).message}`);
    console.error(err);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
