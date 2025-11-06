import type { CNF } from '../../src/cnf/types';

export function createMockCNF(overrides: Partial<CNF> = {}): CNF {
  return {
    sessionId: 'mock-session',
    messages: [],
    ...overrides
  };
}
