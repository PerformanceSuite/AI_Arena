import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XAIAdapter } from './xai';
import type { CNF } from '../cnf/types';

// xAI uses OpenAI-compatible API
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn()
      }
    };
  }
}));

describe('XAIAdapter', () => {
  let adapter: XAIAdapter;

  beforeEach(() => {
    adapter = new XAIAdapter();
  });

  it('configures with API key and custom base URL', async () => {
    await adapter.configure({
      apiKey: 'test-key',
      baseURL: 'https://api.x.ai/v1'
    });

    const models = await adapter.listModels();
    expect(models).toContain('grok-beta');
  });

  it('translates CNF and calls xAI API', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.fn().mockResolvedValue({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'grok-beta',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello from Grok!'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18
      }
    });

    (adapter as any).client.chat.completions.create = mockCreate;

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi Grok' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'grok-beta' });

    expect(result.outputText).toBe('Hello from Grok!');
    expect(result.usage?.total).toBe(18);
  });
});
