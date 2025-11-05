import { describe, it, expect, beforeEach } from 'vitest';
import { invokeOperation, competeOperation } from './operations';
import { MockAdapter } from '../../tests/mocks/mock-adapter';
import { registerProvider, getProvider } from '../adapters/index';

describe('Core Operations', () => {
  beforeEach(async () => {
    // Register mock adapter for tests
    const mockAdapter = new MockAdapter();
    await mockAdapter.configure({ apiKey: 'test' });
    registerProvider('mock', mockAdapter);
  });

  describe('invokeOperation', () => {
    it('invokes single provider and returns CNF', async () => {
      const mock = getProvider('mock') as MockAdapter;
      mock.queueResponse('Test response');

      const result = await invokeOperation({
        cnf: {
          sessionId: 'test',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        provider: 'mock',
        model: 'mock-model'
      });

      expect(result.cnf.messages).toHaveLength(2);
      expect(result.outputText).toBe('Test response');
    });
  });

  describe('competeOperation', () => {
    it('runs competition and returns winner', async () => {
      // Get the registered mock adapter and queue responses
      const mock = getProvider('mock') as MockAdapter;
      mock.queueResponse('Short');
      mock.queueResponse('This is a much longer and more detailed response with better structure.');

      const result = await competeOperation({
        cnf: {
          sessionId: 'test',
          messages: [{ role: 'user', content: 'Explain' }]
        },
        spec: {
          providers: [
            { name: 'mock', model: 'mock-a' },
            { name: 'mock', model: 'mock-b' }
          ],
          mode: 'round-robin',
          rubric: {
            weights: { length: 1.0 }
          }
        }
      });

      expect(result.winner).toBeDefined();
      expect(result.leaderboard).toHaveLength(2);
    });
  });
});
