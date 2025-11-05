import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleAdapter } from './google';
import type { CNF } from '../cnf/types';

// Mock Google SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogle {
    getGenerativeModel = vi.fn(() => ({
      generateContent: vi.fn()
    }));
  }
}));

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;

  beforeEach(() => {
    adapter = new GoogleAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('gemini-1.5-pro');
    expect(models).toContain('gemini-1.5-flash');
  });

  it('converts CNF to Google format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockGenerate = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Hello from Gemini!',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18
        }
      }
    });

    (adapter as any).client.getGenerativeModel.mockReturnValue({
      generateContent: mockGenerate
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'gemini-1.5-pro' });

    expect(result.outputText).toBe('Hello from Gemini!');
    expect(result.usage?.total).toBe(18);
  });
});
