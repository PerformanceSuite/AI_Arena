import type { CNF } from '../cnf/types';
import type { ProviderAdapter } from '../adapters/types';
import type { Judge, Candidate, RubricSpec, Score } from './types';

export interface CompetitionSpec {
  providers: Array<{ adapter: ProviderAdapter; model: string }>;
  mode: 'round-robin' | 'cascade';
  judges: Judge[];
  rubric: RubricSpec;
  system?: string;
}

export interface CompetitionResult {
  winner: Candidate & { score: number };
  leaderboard: Array<Candidate & { score: number }>;
  traces: Array<{
    candidate: Candidate;
    scores: Record<string, Score>;
  }>;
}

/**
 * Run AI competition with multiple providers
 */
export async function compete(
  cnf: CNF,
  spec: CompetitionSpec
): Promise<CompetitionResult> {
  if (spec.mode === 'round-robin') {
    return roundRobin(cnf, spec);
  }

  throw new Error(`Unsupported competition mode: ${spec.mode}`);
}

async function roundRobin(
  cnf: CNF,
  spec: CompetitionSpec
): Promise<CompetitionResult> {
  // Generate responses from all providers in parallel
  const candidatePromises = spec.providers.map(async ({ adapter, model }) => {
    try {
      const result = await adapter.chat({
        cnf,
        targetModel: model,
        system: spec.system
      });

      const candidate: Candidate = {
        id: `${adapter.name}:${model}`,
        text: result.outputText || '',
        providerName: adapter.name,
        modelName: model,
        usage: result.usage
      };

      return candidate;
    } catch (error) {
      console.error(`Provider ${adapter.name} failed:`, error);
      return null;
    }
  });

  const candidates = (await Promise.all(candidatePromises))
    .filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) {
    throw new Error('All providers failed');
  }

  // Score each candidate with all judges
  const traces = await Promise.all(
    candidates.map(async (candidate) => {
      const judgeScores: Record<string, Score> = {};

      for (const judge of spec.judges) {
        try {
          judgeScores[judge.name] = await judge.score(candidate, spec.rubric);
        } catch (error) {
          console.error(`Judge ${judge.name} failed:`, error);
        }
      }

      return { candidate, scores: judgeScores };
    })
  );

  // Calculate final scores with judge weights
  const judgeWeights = spec.rubric.judgeWeights || {};
  const defaultWeight = 1.0 / spec.judges.length;

  const leaderboard = traces.map(({ candidate, scores }) => {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [judgeName, score] of Object.entries(scores)) {
      const weight = judgeWeights[judgeName] ?? defaultWeight;
      totalScore += score.total * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return { ...candidate, score: finalScore };
  });

  // Sort by score descending
  leaderboard.sort((a, b) => b.score - a.score);

  return {
    winner: leaderboard[0],
    leaderboard,
    traces
  };
}
