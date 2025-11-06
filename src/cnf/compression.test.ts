import { describe, it, expect, vi } from 'vitest';
import { compressCNF, CompressionConfig } from './compression';
import type { CNF } from './types';

describe('CNF Compression', () => {
  it('preserves short conversations without compression', async () => {
    const cnf: CNF = {
      sessionId: 'test',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
    };

    const config: CompressionConfig = {
      strategy: 'summarize',
      maxTokens: 4000,
      preserveRecent: 5
    };

    const compressed = await compressCNF(cnf, config);
    expect(compressed.messages).toHaveLength(2);
  });

  it('compresses long conversations preserving recent messages', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i + 1}`
    }));

    const cnf: CNF = {
      sessionId: 'test',
      messages
    };

    const config: CompressionConfig = {
      strategy: 'summarize',
      maxTokens: 4000,
      preserveRecent: 3
    };

    // Mock summarization
    const mockSummarize = vi.fn().mockResolvedValue('Summary of old messages');

    const compressed = await compressCNF(cnf, config, mockSummarize);

    expect(compressed.messages.length).toBeLessThan(cnf.messages.length);
    expect(compressed.messages[0].role).toBe('system');
    expect(compressed.messages[0].content).toContain('Summary');
    expect(mockSummarize).toHaveBeenCalledWith(messages.slice(0, -3));
  });
});
