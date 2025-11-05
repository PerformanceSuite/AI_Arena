import { describe, it, expect, vi } from 'vitest';
import { LLMJudge } from './llm-judge';
import { MockAdapter } from '../../tests/mocks/mock-adapter';

describe('LLMJudge', () => {
  it('uses LLM to score candidate', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.queueResponse(JSON.stringify({
      total: 0.85,
      breakdown: { correctness: 0.9, style: 0.8 },
      reasoning: 'Good response with clear explanations'
    }));

    const judge = new LLMJudge(mockAdapter, 'mock-model');

    const score = await judge.score({
      id: 'test',
      text: 'This is a test response',
      providerName: 'test',
      modelName: 'test'
    }, {
      weights: { correctness: 0.6, style: 0.4 }
    });

    expect(score.total).toBe(0.85);
    expect(score.reasoning).toContain('Good response');
  });

  it('handles malformed JSON from LLM', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.queueResponse('Not valid JSON');

    const judge = new LLMJudge(mockAdapter, 'mock-model');

    const score = await judge.score({
      id: 'test',
      text: 'Test',
      providerName: 'test',
      modelName: 'test'
    }, {
      weights: { correctness: 1.0 }
    });

    // Should return fallback score
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1);
  });
});
