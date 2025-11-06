import { describe, it, expect, vi } from 'vitest';
import { DebateCoordinator, DebateConfig, DebateState } from './debate';
import { createMockCNF } from '../../tests/mocks/mock-cnf';

describe('DebateCoordinator', () => {
  it('creates debate state from config', () => {
    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is better: TypeScript or JavaScript?',
      rounds: 1,
      judge: {
        type: 'llm',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator();
    const state = coordinator.initializeDebate(config);

    expect(state.prompt).toBe(config.prompt);
    expect(state.rounds).toHaveLength(0);
    expect(state.winner).toBeUndefined();
  });

  it('executes 2-turn debate flow', async () => {
    const mockAdapterA = {
      chat: vi.fn()
        .mockResolvedValueOnce({
          outputText: 'TypeScript is better because...',
          updatedCNF: createMockCNF()
        })
        .mockResolvedValueOnce({
          outputText: 'Taking your critique into account...',
          updatedCNF: createMockCNF()
        })
    };

    const mockAdapterB = {
      chat: vi.fn()
        .mockResolvedValueOnce({
          outputText: 'I disagree. JavaScript has...',
          updatedCNF: createMockCNF()
        })
    };

    const mockRegistry = {
      getAdapter: vi.fn((provider: string) => {
        if (provider === 'openai/gpt-4o-mini') return mockAdapterA;
        if (provider === 'google/gemini-2.5-flash') return mockAdapterB;
        throw new Error(`Unknown provider: ${provider}`);
      })
    };

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is better: TypeScript or JavaScript?',
      rounds: 1,
      judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
    };

    const coordinator = new DebateCoordinator(mockRegistry as any);
    const state = await coordinator.runDebate(config);

    expect(state.rounds).toHaveLength(1);
    expect(state.rounds[0].providerA_response).toContain('TypeScript');
    expect(state.rounds[0].providerB_critique).toContain('disagree');
    expect(state.rounds[0].providerA_refined).toContain('critique');
  });

  it('judges debate and declares winner', async () => {
    const mockJudge = {
      score: vi.fn()
        .mockResolvedValueOnce({ score: 7.5, reasoning: 'Good points' })
        .mockResolvedValueOnce({ score: 8.2, reasoning: 'Better argument' })
    };

    const mockRegistry = {
      getAdapter: vi.fn(() => ({
        chat: vi.fn().mockResolvedValue({
          outputText: 'Response',
          updatedCNF: createMockCNF()
        })
      }))
    };

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'Test prompt',
      rounds: 1,
      judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
    };

    const coordinator = new DebateCoordinator(mockRegistry as any, mockJudge as any);
    const state = await coordinator.runDebate(config);

    expect(state.winner).toBe('B');
    expect(state.scores).toEqual({ A: 7.5, B: 8.2 });
  });

  it('declares tie when both providers have equal scores', async () => {
    const mockJudge = {
      score: vi.fn()
        .mockResolvedValueOnce({ score: 8.0, reasoning: 'Strong argument' })
        .mockResolvedValueOnce({ score: 8.0, reasoning: 'Equally strong argument' })
    };

    const mockRegistry = {
      getAdapter: vi.fn(() => ({
        chat: vi.fn().mockResolvedValue({
          outputText: 'Response',
          updatedCNF: createMockCNF()
        })
      }))
    };

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'Test prompt',
      rounds: 1,
      judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
    };

    const coordinator = new DebateCoordinator(mockRegistry as any, mockJudge as any);
    const state = await coordinator.runDebate(config);

    expect(state.winner).toBe('tie');
    expect(state.scores).toEqual({ A: 8.0, B: 8.0 });
  });

  it('emits trace events during debate execution', async () => {
    const mockEmitter = {
      emit: vi.fn()
    };

    const mockRegistry = {
      getAdapter: vi.fn(() => ({
        chat: vi.fn().mockResolvedValue({
          outputText: 'Response',
          updatedCNF: createMockCNF()
        })
      }))
    };

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'Test',
      rounds: 1,
      judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
    };

    const coordinator = new DebateCoordinator(
      mockRegistry as any,
      undefined,
      mockEmitter as any
    );

    await coordinator.runDebate(config);

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'competition.start',
        data: expect.objectContaining({ mode: 'debate' })
      })
    );

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'debate.turn'
      })
    );

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'competition.end'
      })
    );
  });
});
