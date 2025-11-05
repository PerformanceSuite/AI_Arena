import { describe, it, expect } from 'vitest';
import { appendMessage, extractLastMessage, redactSecrets } from './transform';
import type { CNF } from './types';

describe('CNF Transforms', () => {
  const baseCNF: CNF = {
    sessionId: 'test-123',
    messages: [
      { role: 'user', content: 'Hello' }
    ]
  };

  describe('appendMessage', () => {
    it('appends assistant message to CNF', () => {
      const result = appendMessage(baseCNF, 'assistant', 'Hi there!');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi there!'
      });
    });

    it('preserves existing CNF properties', () => {
      const cnfWithTags = { ...baseCNF, tags: ['test'] };
      const result = appendMessage(cnfWithTags, 'user', 'Question?');

      expect(result.tags).toEqual(['test']);
      expect(result.sessionId).toBe('test-123');
    });
  });

  describe('extractLastMessage', () => {
    it('extracts the last message content', () => {
      const cnf = appendMessage(baseCNF, 'assistant', 'Response');
      const last = extractLastMessage(cnf);

      expect(last).toBe('Response');
    });

    it('returns empty string for CNF with no messages', () => {
      const emptyCNF: CNF = { sessionId: 'test', messages: [] };
      const last = extractLastMessage(emptyCNF);

      expect(last).toBe('');
    });
  });

  describe('redactSecrets', () => {
    it('redacts API keys from message content', () => {
      const cnf: CNF = {
        sessionId: 'test',
        messages: [
          { role: 'user', content: 'My key is sk-proj-abc123xyz' }
        ]
      };

      const result = redactSecrets(cnf);
      expect(result.messages[0].content).toContain('[REDACTED]');
      expect(result.messages[0].content).not.toContain('sk-proj-abc123xyz');
    });

    it('redacts multiple secret patterns', () => {
      const cnf: CNF = {
        sessionId: 'test',
        messages: [
          {
            role: 'user',
            content: 'OpenAI: sk-abc123, Anthropic: sk-ant-xyz789'
          }
        ]
      };

      const result = redactSecrets(cnf);
      expect(result.messages[0].content).toContain('[REDACTED]');
      expect(result.messages[0].content).not.toContain('sk-abc123');
      expect(result.messages[0].content).not.toContain('sk-ant-xyz789');
    });
  });
});
