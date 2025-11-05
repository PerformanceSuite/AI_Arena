import type { Judge, Candidate, RubricSpec, Score } from './types';

export class HeuristicJudge implements Judge {
  name = 'heuristic';

  async score(candidate: Candidate, rubric: RubricSpec): Promise<Score> {
    const breakdown: Record<string, number> = {};

    // Length scoring
    if (rubric.weights.length) {
      breakdown.length = this.scoreLength(candidate.text);
    }

    // Keyword matching
    if (rubric.weights.keywords && rubric.keywords) {
      breakdown.keywords = this.scoreKeywords(candidate.text, rubric.keywords);
    }

    // Structure scoring
    if (rubric.weights.structure) {
      breakdown.structure = this.scoreStructure(candidate.text);
    }

    // Calculate weighted total
    let total = 0;
    let totalWeight = 0;

    for (const [key, score] of Object.entries(breakdown)) {
      const weight = rubric.weights[key] || 0;
      total += score * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      total = total / totalWeight;
    }

    return { total, breakdown };
  }

  private scoreLength(text: string): number {
    const length = text.length;

    // Penalty for very short (<50 chars)
    if (length < 50) return 0.2;

    // Good range (80-2000 chars)
    if (length >= 80 && length <= 2000) return 1.0;

    // Slightly penalize very long
    if (length > 2000) return 0.8;

    // Moderate length (50-80 chars)
    return 0.6;
  }

  private scoreKeywords(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    const found = keywords.filter(kw =>
      lowerText.includes(kw.toLowerCase())
    );

    return found.length / keywords.length;
  }

  private scoreStructure(text: string): number {
    let score = 0.5; // baseline

    // Check for markdown headers
    if (/^#{1,3}\s+.+$/m.test(text)) score += 0.1;

    // Check for lists
    if (/^[-*]\s+.+$/m.test(text)) score += 0.1;

    // Check for code blocks
    if (/```[\s\S]+```/.test(text)) score += 0.15;

    // Check for links
    if(/\[.+\]\(.+\)/.test(text)) score += 0.1;

    // Check for emphasis
    if (/\*\*.+\*\*|__.+__/.test(text)) score += 0.05;

    return Math.min(score, 1.0);
  }
}
