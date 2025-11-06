/**
 * Judge interface for scoring AI responses
 */
export interface Judge {
  /**
   * Score a response based on a prompt
   * @param prompt The original prompt/question
   * @param response The AI's response to evaluate
   * @returns Score (typically 0-10) and reasoning
   */
  score(prompt: string, response: string): Promise<{ score: number; reasoning: string }>;
}
