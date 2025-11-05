import { describe, it, expect } from 'vitest';
import { HeuristicJudge } from './heuristic-judge';

describe('HeuristicJudge', () => {
  const judge = new HeuristicJudge();

  describe('length scoring', () => {
    it('penalizes very short responses', async () => {
      const score = await judge.score({
        id: 'test',
        text: 'Ok',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { length: 1.0 }
      });

      expect(score.total).toBeLessThan(0.5);
    });

    it('gives high score to adequate length', async () => {
      const score = await judge.score({
        id: 'test',
        text: 'This is a reasonably detailed response that provides good information and context for the user.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { length: 1.0 }
      });

      expect(score.total).toBeGreaterThan(0.7);
    });
  });

  describe('keyword matching', () => {
    it('scores higher when keywords present', async () => {
      const withKeywords = await judge.score({
        id: 'test',
        text: 'Install using npm install. Check the documentation for usage examples.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { keywords: 1.0 },
        keywords: ['install', 'usage', 'documentation']
      });

      const withoutKeywords = await judge.score({
        id: 'test',
        text: 'You can set it up easily and refer to the guide.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { keywords: 1.0 },
        keywords: ['install', 'usage', 'documentation']
      });

      expect(withKeywords.total).toBeGreaterThan(withoutKeywords.total);
    });
  });

  describe('structure checks', () => {
    it('scores higher for markdown formatting', async () => {
      const formatted = await judge.score({
        id: 'test',
        text: '# Title\n\n## Section\n\n- Item 1\n- Item 2\n\n```js\ncode();\n```',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { structure: 1.0 }
      });

      const unformatted = await judge.score({
        id: 'test',
        text: 'Title Section Item 1 Item 2 code()',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { structure: 1.0 }
      });

      expect(formatted.total).toBeGreaterThan(unformatted.total);
    });
  });
});
