import { DebateCoordinator } from '../src/arena/debate';
import { createDefaultRegistry } from '../src/adapters/registry';
import type { DebateConfig } from '../src/arena/debate';

// Simple judge implementation for demonstration
class SimpleJudge {
  async score(prompt: string, response: string): Promise<{ score: number; reasoning: string }> {
    // Score based on length (simple heuristic)
    const length = response.length;
    const score = Math.min(10, length / 100);
    return {
      score,
      reasoning: `Response length: ${length} characters`
    };
  }
}

async function runDebateExample() {
  console.log('=== AI Arena Debate Example ===\n');

  // Initialize registry and judge
  const registry = createDefaultRegistry();
  const judge = new SimpleJudge();

  // Configure debate
  const config: DebateConfig = {
    providerA: 'openai/gpt-4o-mini',
    providerB: 'google/gemini-2.5-flash',
    prompt: 'What are the pros and cons of TypeScript vs JavaScript for a new web project?',
    rounds: 1,
    judge: {
      type: 'heuristic',
      provider: 'openai/gpt-4o-mini'
    }
  };

  console.log(`Prompt: ${config.prompt}`);
  console.log(`Provider A: ${config.providerA}`);
  console.log(`Provider B: ${config.providerB}`);
  console.log(`Rounds: ${config.rounds}\n`);

  try {
    // Run debate
    console.log('Running debate...\n');
    const coordinator = new DebateCoordinator(registry, judge as any);
    const result = await coordinator.runDebate(config);

    // Display results
    console.log('=== Debate Results ===\n');

    for (const round of result.rounds) {
      console.log(`\n--- Round ${round.turn} ---\n`);
      console.log(`Provider A (Initial Response):\n${round.providerA_response}\n`);
      console.log(`Provider B (Critique):\n${round.providerB_critique}\n`);
      console.log(`Provider A (Refined Response):\n${round.providerA_refined}\n`);
    }

    console.log(`\n=== Final Scores ===`);
    console.log(`Winner: ${result.winner}`);
    if (result.scores) {
      console.log(`Provider A Score: ${result.scores.A}`);
      console.log(`Provider B Score: ${result.scores.B}`);
    }
  } catch (error) {
    console.error('Error running debate:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runDebateExample().catch(console.error);
}

export { runDebateExample };
