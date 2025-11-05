export interface Candidate {
  id: string;
  text: string;
  providerName: string;
  modelName: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface RubricSpec {
  weights: Record<string, number>;
  keywords?: string[];
  judgeWeights?: Record<string, number>;
}

export interface Score {
  total: number;
  breakdown: Record<string, number>;
  reasoning?: string;
}

export interface Judge {
  name: string;
  score(candidate: Candidate, rubric: RubricSpec): Promise<Score>;
}
