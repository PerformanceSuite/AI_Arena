import type { CNF } from '../cnf/types';
import { getProvider } from '../adapters/index';
import { compete } from '../arena/competition';
import { HeuristicJudge } from '../arena/heuristic-judge';
import { LLMJudge } from '../arena/llm-judge';
import type { RubricSpec } from '../arena/types';

export interface InvokeRequest {
  cnf: CNF;
  provider: string;
  model: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface InvokeResult {
  cnf: CNF;
  outputText?: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface CompeteRequest {
  cnf: CNF;
  spec: {
    providers: Array<{ name: string; model: string }>;
    mode: 'round-robin' | 'cascade';
    rubric: RubricSpec;
    judges?: Array<{ type: 'heuristic' | 'llm'; provider?: string; model?: string }>;
    system?: string;
  };
}

export interface CompeteResult {
  winner: {
    id: string;
    text: string;
    score: number;
    breakdown: Record<string, number>;
  };
  leaderboard: Array<{
    id: string;
    text: string;
    score: number;
  }>;
}

/**
 * Invoke single provider
 */
export async function invokeOperation(req: InvokeRequest): Promise<InvokeResult> {
  const provider = getProvider(req.provider);

  const result = await provider.chat({
    cnf: req.cnf,
    targetModel: req.model,
    system: req.system,
    temperature: req.temperature,
    maxTokens: req.maxTokens
  });

  return {
    cnf: result.updatedCNF,
    outputText: result.outputText,
    usage: result.usage
  };
}

/**
 * Run competition across multiple providers
 */
export async function competeOperation(req: CompeteRequest): Promise<CompeteResult> {
  // Build judges list
  const judges = [];

  const judgeSpecs = req.spec.judges || [{ type: 'heuristic' as const }];

  for (const judgeSpec of judgeSpecs) {
    if (judgeSpec.type === 'heuristic') {
      judges.push(new HeuristicJudge());
    } else if (judgeSpec.type === 'llm' && judgeSpec.provider && judgeSpec.model) {
      const adapter = getProvider(judgeSpec.provider);
      judges.push(new LLMJudge(adapter, judgeSpec.model));
    }
  }

  // Map provider names to adapters
  const providerSpecs = req.spec.providers.map(p => ({
    adapter: getProvider(p.name),
    model: p.model
  }));

  const result = await compete(req.cnf, {
    providers: providerSpecs,
    mode: req.spec.mode,
    judges,
    rubric: req.spec.rubric,
    system: req.spec.system
  });

  return {
    winner: {
      id: result.winner.id,
      text: result.winner.text,
      score: result.winner.score,
      breakdown: result.traces.find(t => t.candidate.id === result.winner.id)
        ?.scores.heuristic?.breakdown || {}
    },
    leaderboard: result.leaderboard.map(c => ({
      id: c.id,
      text: c.text,
      score: c.score
    }))
  };
}
