import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from './openai';
import type { CNF } from '../cnf/types';

// Mock the OpenAI SDK
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn()
      }
    };
  }
}));

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
  });

  it('converts CNF to OpenAI format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    // Mock OpenAI response
    const mockCreate = vi.mocked(
      (adapter as any).client.chat.completions.create
    );
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'gpt-4o' });

    expect(result.outputText).toBe('Hello!');
    expect(result.updatedCNF.messages).toHaveLength(2);
    expect(result.usage?.total).toBe(15);
  });
});
