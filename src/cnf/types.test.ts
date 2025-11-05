import { describe, it, expect } from 'vitest';
import { validateCNF } from './schema';

describe('CNF Schema', () => {
  it('validates a minimal valid CNF', () => {
    const cnf = {
      sessionId: 'test-123',
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(true);
  });

  it('rejects CNF without sessionId', () => {
    const cnf = {
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(false);
    expect(result.errors?.some(e => e.includes('sessionId'))).toBe(true);
  });

  it('rejects CNF with invalid role', () => {
    const cnf = {
      sessionId: 'test-123',
      messages: [{ role: 'invalid', content: 'Hello' }]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(false);
  });
});
