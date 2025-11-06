import { describe, it, expect, vi } from 'vitest';
import { DebateCoordinator } from '../../src/arena/debate';
import { DefaultProviderRegistry } from '../../src/adapters/registry';
import { MockAdapter } from '../mocks/mock-adapter';
import type { DebateConfig } from '../../src/arena/debate';

// Simple judge implementation for testing
class TestJudge {
  async score(prompt: string, response: string): Promise<{ score: number; reasoning: string }> {
    // Score based on length (simple heuristic for testing)
    const length = response.length;
    const score = Math.min(10, length / 100);
    return {
      score,
      reasoning: `Response length: ${length} characters`
    };
  }
}

describe('Debate Integration', () => {
  it('runs complete debate with mock adapters', async () => {
    // Create registry with mock adapters
    const registry = new DefaultProviderRegistry();
    registry.registerProvider('openai', new MockAdapter('openai'));
    registry.registerProvider('google', new MockAdapter('google'));

    const judge = new TestJudge();

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is 2+2?',
      rounds: 1,
      judge: {
        type: 'heuristic',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator(registry, judge as any);
    const result = await coordinator.runDebate(config);

    // Verify debate structure
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].turn).toBe(1);

    // Verify all responses are present
    expect(result.rounds[0].providerA_response).toBeTruthy();
    expect(result.rounds[0].providerB_critique).toBeTruthy();
    expect(result.rounds[0].providerA_refined).toBeTruthy();

    // Verify winner declared
    expect(result.winner).toMatch(/^(A|B|tie)$/);

    // Verify scores exist
    expect(result.scores).toBeDefined();
    expect(typeof result.scores?.A).toBe('number');
    expect(typeof result.scores?.B).toBe('number');
  });

  it('handles multiple debate rounds', async () => {
    // Create registry with mock adapters
    const registry = new DefaultProviderRegistry();
    registry.registerProvider('openai', new MockAdapter('openai'));
    registry.registerProvider('google', new MockAdapter('google'));

    const judge = new TestJudge();

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'Explain the difference between let and const in JavaScript',
      rounds: 2,
      judge: {
        type: 'heuristic',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator(registry, judge as any);
    const result = await coordinator.runDebate(config);

    // Verify multiple rounds
    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0].turn).toBe(1);
    expect(result.rounds[1].turn).toBe(2);

    // Verify each round has all responses
    for (const round of result.rounds) {
      expect(round.providerA_response).toBeTruthy();
      expect(round.providerB_critique).toBeTruthy();
      expect(round.providerA_refined).toBeTruthy();
    }
  });

  it('uses trace emitter when provided', async () => {
    // Create registry with mock adapters
    const registry = new DefaultProviderRegistry();
    registry.registerProvider('openai', new MockAdapter('openai'));
    registry.registerProvider('google', new MockAdapter('google'));

    const judge = new TestJudge();

    const emittedEvents: any[] = [];
    const mockEmitter = {
      emit: (event: any) => {
        emittedEvents.push(event);
      }
    };

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is TypeScript?',
      rounds: 1,
      judge: {
        type: 'heuristic',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator(registry, judge as any, mockEmitter as any);
    await coordinator.runDebate(config);

    // Verify trace events were emitted
    expect(emittedEvents.length).toBeGreaterThan(0);

    // Verify start event
    const startEvent = emittedEvents.find(e => e.eventType === 'competition.start');
    expect(startEvent).toBeDefined();
    expect(startEvent.data.mode).toBe('debate');

    // Verify end event
    const endEvent = emittedEvents.find(e => e.eventType === 'competition.end');
    expect(endEvent).toBeDefined();
    expect(endEvent.data.winner).toMatch(/^(A|B|tie)$/);
  });
});
