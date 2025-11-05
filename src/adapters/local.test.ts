import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalAdapter } from './local';
import type { CNF } from '../cnf/types';

global.fetch = vi.fn();

describe('LocalAdapter', () => {
  let adapter: LocalAdapter;

  beforeEach(() => {
    adapter = new LocalAdapter();
    vi.clearAllMocks();
  });

  it('configures with endpoint', async () => {
    await adapter.configure({
      apiKey: 'not-used',
      endpoint: 'http://localhost:4000'
    });

    const models = await adapter.listModels();
    expect(models).toContain('local');
  });

  it('makes OpenAI-compatible request to local endpoint', async () => {
    await adapter.configure({
      apiKey: 'dummy',
      endpoint: 'http://localhost:4000'
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Local response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      })
    } as any);

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'llama-3.1-8b' });

    expect(result.outputText).toBe('Local response');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
