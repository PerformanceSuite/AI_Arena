/**
 * Phase 1 Integration Test - OpenAI Only
 * Comprehensive test with only OpenAI provider (multiple models)
 */

import { loadConfig } from '../src/util/config';
import { configureProviders } from '../src/adapters/index';
import { invokeOperation, competeOperation } from '../src/core/operations';
import type { CNF } from '../src/cnf/types';

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
  section('Test 1: Basic Invoke with GPT-4o-mini');

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
    console.log(`${colors.dim}Response: ${result.outputText}${colors.reset}`);
    console.log(`${colors.dim}Tokens: ${result.usage?.total || 'unknown'}${colors.reset}`);

    return true;
  } catch (err) {
    error(`Failed: ${(err as Error).message}`);
    return false;
  }
}

async function test2_MultipleModels() {
  section('Test 2: Competition Between GPT Models');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Running GPT-4o-mini vs GPT-4o...');

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'openai', model: 'gpt-4o' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.3,
            structure: 0.3,
            keywords: 0.4
          },
          keywords: ['haiku', 'AI', 'artificial', 'intelligence', 'machine']
        },
        judges: [
          { type: 'heuristic' }
        ]
      }
    });

    success('Competition completed');
    console.log(`\n${colors.yellow}🏆 Winner: ${result.winner.id}${colors.reset}`);
    console.log(`${colors.dim}Score: ${result.winner.score.toFixed(2)}${colors.reset}`);
    console.log(`${colors.dim}Response:\n${result.winner.text}${colors.reset}`);

    console.log(`\n${colors.yellow}📊 Leaderboard:${colors.reset}`);
    result.leaderboard.forEach((entry, idx) => {
      console.log(`${colors.dim}${idx + 1}. ${entry.id}: ${entry.score.toFixed(2)}${colors.reset}`);
    });

    return true;
  } catch (err) {
    error(`Failed: ${(err as Error).message}`);
    return false;
  }
}

async function test3_LLMJudge() {
  section('Test 3: LLM Judge (GPT-4o-mini as Judge)');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Running competition with LLM judge...');

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'openai', model: 'gpt-4o' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.2,
            structure: 0.2,
            keywords: 0.2
          },
          keywords: ['haiku', 'AI'],
          judgeWeights: {
            heuristic: 0.3,
            llm: 0.7  // Give LLM judge more weight
          }
        },
        judges: [
          { type: 'heuristic' },
          { type: 'llm', provider: 'openai', model: 'gpt-4o-mini' }
        ]
      }
    });

    success('Competition with LLM judge completed');
    console.log(`\n${colors.yellow}🏆 Winner: ${result.winner.id}${colors.reset}`);
    console.log(`${colors.dim}Score: ${result.winner.score.toFixed(2)}${colors.reset}`);
    console.log(`${colors.dim}Response:\n${result.winner.text}${colors.reset}`);

    console.log(`\n${colors.yellow}📊 Leaderboard:${colors.reset}`);
    result.leaderboard.forEach((entry, idx) => {
      console.log(`${colors.dim}${idx + 1}. ${entry.id}: ${entry.score.toFixed(2)}${colors.reset}`);
    });

    return true;
  } catch (err) {
    error(`Failed: ${(err as Error).message}`);
    return false;
  }
}

async function test4_ComplexPrompt() {
  section('Test 4: Complex Prompt with Multiple Turns');

  const cnf: CNF = {
    sessionId: `test-${Date.now()}`,
    messages: [
      {
        role: 'user',
        content: 'What is artificial intelligence?'
      },
      {
        role: 'assistant',
        content: 'Artificial intelligence (AI) is the simulation of human intelligence by machines, particularly computer systems.'
      },
      {
        role: 'user',
        content: 'Now write a haiku about that concept.'
      }
    ]
  };

  try {
    log('🔄', 'Testing multi-turn conversation...');

    const result = await invokeOperation({
      cnf,
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.8
    });

    success('Multi-turn conversation succeeded');
    console.log(`${colors.dim}Response:\n${result.outputText}${colors.reset}`);
    console.log(`${colors.dim}Tokens: ${result.usage?.total || 'unknown'}${colors.reset}`);

    return true;
  } catch (err) {
    error(`Failed: ${(err as Error).message}`);
    return false;
  }
}

async function test5_SystemMessage() {
  section('Test 5: System Message Support');

  const cnf = createTestCNF();

  try {
    log('🔄', 'Testing with system message...');

    const result = await invokeOperation({
      cnf,
      provider: 'openai',
      model: 'gpt-4o-mini',
      system: 'You are a poet who specializes in traditional Japanese haiku. Always count syllables carefully: 5-7-5.',
      temperature: 0.9
    });

    success('System message test succeeded');
    console.log(`${colors.dim}Response:\n${result.outputText}${colors.reset}`);
    console.log(`${colors.dim}Tokens: ${result.usage?.total || 'unknown'}${colors.reset}`);

    return true;
  } catch (err) {
    error(`Failed: ${(err as Error).message}`);
    return false;
  }
}

async function runTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║      AI Arena Phase 1 - OpenAI Provider Tests            ║
║           Comprehensive Validation Suite                  ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  try {
    log('📋', 'Loading configuration...');
    const config = loadConfig();
    success('Configuration loaded');

    log('🔧', 'Configuring providers...');
    await configureProviders(config);
    success('Providers configured');

    console.log(`${colors.dim}Testing with: OpenAI (gpt-4o-mini, gpt-4o)${colors.reset}\n`);

    const results = {
      test1: await test1_BasicInvoke(),
      test2: await test2_MultipleModels(),
      test3: await test3_LLMJudge(),
      test4: await test4_ComplexPrompt(),
      test5: await test5_SystemMessage()
    };

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
      console.log(`\n${colors.green}🎉 ALL TESTS PASSED!${colors.reset}`);
      console.log(`\n${colors.cyan}Phase 1 is fully operational with OpenAI provider!${colors.reset}\n`);
      console.log('✅ CNF system working');
      console.log('✅ Provider adapter working');
      console.log('✅ Competition system working');
      console.log('✅ Heuristic judges working');
      console.log('✅ LLM judges working');
      console.log('✅ Multi-turn conversations working');
      console.log('✅ System messages working\n');
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

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
