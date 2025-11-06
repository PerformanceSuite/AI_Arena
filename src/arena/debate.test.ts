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
});
