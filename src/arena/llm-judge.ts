import type { Judge, Candidate, RubricSpec, Score } from './types';
import type { ProviderAdapter } from '../adapters/types';
import type { CNF } from '../cnf/types';

export class LLMJudge implements Judge {
  name = 'llm';

  constructor(
    private adapter: ProviderAdapter,
    private model: string
  ) {}

  async score(candidate: Candidate, rubric: RubricSpec): Promise<Score> {
    const prompt = this.buildPrompt(candidate, rubric);

    const cnf: CNF = {
      sessionId: `judge-${Date.now()}`,
      messages: [{ role: 'user', content: prompt }]
    };

    try {
      const result = await this.adapter.chat({
        cnf,
        targetModel: this.model,
        temperature: 0.3
      });

      return this.parseResponse(result.outputText || '');
    } catch (error) {
      console.error('LLM judge error:', error);
      return this.fallbackScore();
    }
  }

  private buildPrompt(candidate: Candidate, rubric: RubricSpec): string {
    const criteria = Object.keys(rubric.weights).join(', ');

    return `You are a judge evaluating AI-generated responses.

Score the following response on these criteria: ${criteria}

Response to evaluate:
"""
${candidate.text}
"""

Provide your evaluation as JSON with this exact structure:
{
  "total": <number between 0 and 1>,
  "breakdown": {
    ${Object.keys(rubric.weights).map(k => `"${k}": <number between 0 and 1>`).join(',\n    ')}
  },
  "reasoning": "<brief explanation>"
}`;
  }

  private parseResponse(text: string): Score {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        total: parsed.total,
        breakdown: parsed.breakdown,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.warn('Failed to parse LLM judge response:', error);
      return this.fallbackScore();
    }
  }

  private fallbackScore(): Score {
    return {
      total: 0.5,
      breakdown: {},
      reasoning: 'Failed to parse LLM response'
    };
  }
}
