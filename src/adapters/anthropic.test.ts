import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdapter } from './anthropic';
import type { CNF } from '../cnf/types';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn()
    };
  }
}));

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('claude-3-5-sonnet-20241022');
  });

  it('converts CNF to Anthropic format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.mocked((adapter as any).client.messages.create);
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      usage: { input_tokens: 10, output_tokens: 8 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'claude-3-5-sonnet-20241022' });

    expect(result.outputText).toBe('Hello from Claude!');
    expect(result.usage?.total).toBe(18);
  });

  it('extracts system message from CNF', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.mocked((adapter as any).client.messages.create);
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' }
      ]
    };

    await adapter.chat({ cnf, targetModel: 'claude-3-5-sonnet-20241022' });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('You are helpful');
    expect(callArgs.messages).toHaveLength(1);
  });
});
