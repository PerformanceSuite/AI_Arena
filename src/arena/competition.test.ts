import { describe, it, expect, beforeEach } from 'vitest';
import { compete } from './competition';
import { MockAdapter } from '../../tests/mocks/mock-adapter';
import { HeuristicJudge } from './heuristic-judge';
import type { CNF } from '../cnf/types';

describe('Competition', () => {
  let mockA: MockAdapter;
  let mockB: MockAdapter;
  let cnf: CNF;

  beforeEach(() => {
    mockA = new MockAdapter();
    mockB = new MockAdapter();

    cnf = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Write a README' }]
    };
  });

  it('runs round-robin and selects winner', async () => {
    mockA.queueResponse('# Project\n\nBasic readme with minimal info.');
    mockB.queueResponse('# Awesome Project\n\n## Installation\n\nRun `npm install`\n\n## Usage\n\nSee docs for details.\n\n## License\n\nMIT');

    const result = await compete(cnf, {
      providers: [
        { adapter: mockA, model: 'mock-a' },
        { adapter: mockB, model: 'mock-b' }
      ],
      mode: 'round-robin',
      judges: [new HeuristicJudge()],
      rubric: {
        weights: { structure: 0.5, length: 0.5 }
      }
    });

    expect(result.winner).toBeDefined();
    expect(result.winner.id).toContain('mock-b');
    expect(result.leaderboard).toHaveLength(2);
    expect(result.leaderboard[0].score).toBeGreaterThan(result.leaderboard[1].score);
  });

  it('handles provider failures gracefully', async () => {
    mockA.queueResponse('Good response');
    // mockB will throw because no response queued

    const result = await compete(cnf, {
      providers: [
        { adapter: mockA, model: 'mock-a' },
        { adapter: mockB, model: 'mock-b' }
      ],
      mode: 'round-robin',
      judges: [new HeuristicJudge()],
      rubric: {
        weights: { length: 1.0 }
      }
    });

    // Should still have winner from successful provider
    expect(result.winner).toBeDefined();
    expect(result.leaderboard.length).toBeGreaterThan(0);
  });
});
