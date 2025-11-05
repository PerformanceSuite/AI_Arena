import { describe, it, expect, beforeAll } from 'vitest';
import { invokeOperation, competeOperation } from '../../src/core/operations';
import { configureProviders } from '../../src/adapters/index';
import type { CNF } from '../../src/cnf/types';

describe('Full Flow Integration', () => {
  beforeAll(async () => {
    // Configure with mock/test providers
    await configureProviders({
      providers: {
        openai: { apiKey: 'test-key', models: [] },
        anthropic: { apiKey: 'test-key', models: [] }
      }
    });
  });

  it('completes full competition flow', async () => {
    const cnf: CNF = {
      sessionId: 'integration-test',
      messages: [
        { role: 'user', content: 'Explain quantum computing in one paragraph' }
      ]
    };

    // This would use real APIs if keys are valid
    // For CI, we skip or mock
    if (!process.env.RUN_LIVE_TESTS) {
      console.log('Skipping live test (set RUN_LIVE_TESTS=true to enable)');
      return;
    }

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'anthropic', model: 'claude-3-5-haiku-20241022' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.3,
            structure: 0.3,
            keywords: 0.4
          },
          keywords: ['quantum', 'computing', 'qubits']
        }
      }
    });

    expect(result.winner).toBeDefined();
    expect(result.winner.text.length).toBeGreaterThan(50);
    expect(result.leaderboard).toHaveLength(2);
  });
});
