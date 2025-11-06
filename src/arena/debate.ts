import type { CNF } from '../cnf/types';
import type { ProviderAdapter } from '../adapters/types';

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

export interface ProviderRegistry {
  getAdapter(provider: string): ProviderAdapter;
}

export interface Judge {
  score(prompt: string, response: string): Promise<{ score: number; reasoning: string }>;
}

export class DebateCoordinator {
  constructor(
    private registry?: ProviderRegistry,
    private judge?: Judge
  ) {}

  initializeDebate(config: DebateConfig): DebateState {
    return {
      prompt: config.prompt,
      rounds: []
    };
  }

  async runDebate(config: DebateConfig): Promise<DebateState> {
    if (!this.registry) {
      throw new Error('ProviderRegistry required for debate execution');
    }

    const state = this.initializeDebate(config);
    let cnfA: CNF = { sessionId: 'debate-a', messages: [] };
    let cnfB: CNF = { sessionId: 'debate-b', messages: [] };

    for (let turn = 0; turn < config.rounds; turn++) {
      const round: DebateRound = {
        turn: turn + 1,
        providerA_response: '',
        providerB_critique: '',
        providerA_refined: ''
      };

      // Provider A initial response
      const adapterA = this.registry.getAdapter(config.providerA);
      cnfA.messages.push({ role: 'user', content: config.prompt });
      const responseA = await adapterA.chat({
        cnf: cnfA,
        targetModel: config.providerA.split('/')[1]
      });
      round.providerA_response = responseA.outputText || '';
      cnfA = responseA.updatedCNF;

      // Provider B critique
      const adapterB = this.registry.getAdapter(config.providerB);
      cnfB.messages.push(
        { role: 'user', content: config.prompt },
        { role: 'assistant', content: `Provider A said: ${round.providerA_response}` },
        { role: 'user', content: 'Critique this response and provide your own answer.' }
      );
      const responseB = await adapterB.chat({
        cnf: cnfB,
        targetModel: config.providerB.split('/')[1]
      });
      round.providerB_critique = responseB.outputText || '';
      cnfB = responseB.updatedCNF;

      // Provider A refine
      cnfA.messages.push(
        { role: 'assistant', content: round.providerA_response },
        { role: 'user', content: `Provider B critiqued your response: ${round.providerB_critique}\n\nRefine your answer.` }
      );
      const refinedA = await adapterA.chat({
        cnf: cnfA,
        targetModel: config.providerA.split('/')[1]
      });
      round.providerA_refined = refinedA.outputText || '';
      cnfA = refinedA.updatedCNF;

      state.rounds.push(round);
    }

    // Judge final responses
    if (this.judge) {
      const lastRound = state.rounds[state.rounds.length - 1];

      const scoreA = await this.judge.score(
        config.prompt,
        lastRound.providerA_refined
      );
      const scoreB = await this.judge.score(
        config.prompt,
        lastRound.providerB_critique
      );

      state.scores = {
        A: scoreA.score,
        B: scoreB.score
      };

      if (scoreA.score > scoreB.score) {
        state.winner = 'A';
      } else if (scoreB.score > scoreA.score) {
        state.winner = 'B';
      } else {
        state.winner = 'tie';
      }
    }

    return state;
  }
}
