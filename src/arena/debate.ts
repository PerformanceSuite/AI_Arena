import type { CNF } from '../cnf/types';

export interface DebateConfig {
  providerA: string;
  providerB: string;
  prompt: string;
  rounds: number;
  judge: {
    type: 'llm' | 'heuristic';
    provider: string;
  };
}

export interface DebateRound {
  turn: number;
  providerA_response: string;
  providerB_critique: string;
  providerA_refined: string;
}

export interface DebateState {
  prompt: string;
  rounds: DebateRound[];
  winner?: 'A' | 'B' | 'tie';
  scores?: { A: number; B: number };
}

export class DebateCoordinator {
  initializeDebate(config: DebateConfig): DebateState {
    return {
      prompt: config.prompt,
      rounds: []
    };
  }
}
