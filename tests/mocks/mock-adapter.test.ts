import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock-adapter';
import type { CNF } from '../../src/cnf/types';

describe('MockAdapter', () => {
  it('returns configured responses in order', async () => {
    const mock = new MockAdapter();
    mock.queueResponse('First response');
    mock.queueResponse('Second response');

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result1 = await mock.chat({ cnf, targetModel: 'mock' });
    const result2 = await mock.chat({ cnf, targetModel: 'mock' });

    expect(result1.outputText).toBe('First response');
    expect(result2.outputText).toBe('Second response');
  });

  it('appends assistant message to CNF', async () => {
    const mock = new MockAdapter();
    mock.queueResponse('Test response');

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = await mock.chat({ cnf, targetModel: 'mock' });

    expect(result.updatedCNF.messages).toHaveLength(2);
    expect(result.updatedCNF.messages[1].role).toBe('assistant');
    expect(result.updatedCNF.messages[1].content).toBe('Test response');
  });
});
