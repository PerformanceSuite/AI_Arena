import { Hono } from 'hono';
import { getAllProviders, getProvider } from '../adapters/index';
import { invokeOperation, competeOperation } from '../core/operations';
import { validateCNF } from '../cnf/schema';
import { DebateCoordinator } from '../arena/debate';
import type { DebateConfig } from '../arena/debate';
import { HeuristicJudge } from '../arena/heuristic-judge';
import { LLMJudge } from '../arena/llm-judge';
import { DefaultProviderRegistry } from '../adapters/registry';

export const app = new Hono();

/**
 * GET /health
 */
app.get('/health', (c) => {
  const providers = getAllProviders().map(p => p.name);
  return c.json({ ok: true, providers });
});

/**
 * GET /models
 */
app.get('/models', async (c) => {
  const providers = getAllProviders();

  const models: Record<string, string[]> = {};
  for (const provider of providers) {
    try {
      models[provider.name] = await provider.listModels();
    } catch (error) {
      models[provider.name] = [];
    }
  }

  return c.json({ providers: models });
});

/**
 * POST /invoke
 */
app.post('/invoke', async (c) => {
  const body = await c.req.json();

  // Validate CNF
  const validation = validateCNF(body.cnf);
  if (!validation.valid) {
    return c.json({ error: 'Invalid CNF', details: validation.errors }, 400);
  }

  if (!body.provider || !body.model) {
    return c.json({ error: 'Missing provider or model' }, 400);
  }

  try {
    const result = await invokeOperation(body);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

/**
 * POST /compete
 */
app.post('/compete', async (c) => {
  const body = await c.req.json();

  // Validate CNF
  const validation = validateCNF(body.cnf);
  if (!validation.valid) {
    return c.json({ error: 'Invalid CNF', details: validation.errors }, 400);
  }

  if (!body.spec?.providers || !body.spec?.rubric) {
    return c.json({ error: 'Missing spec.providers or spec.rubric' }, 400);
  }

  try {
    const result = await competeOperation(body);
    return c.json(result);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

/**
 * POST /debate
 */
app.post('/debate', async (c) => {
  try {
    const config = await c.req.json<DebateConfig>();

    // Validate config
    if (!config.providerA || !config.providerB || !config.prompt) {
      return c.json({ error: 'Missing required fields: providerA, providerB, or prompt' }, 400);
    }

    // Create registry with adapters from provider names
    const registry = new DefaultProviderRegistry();
    const providerAName = config.providerA.split('/')[0];
    const providerBName = config.providerB.split('/')[0];

    registry.registerProvider(providerAName, getProvider(providerAName));
    registry.registerProvider(providerBName, getProvider(providerBName));

    // Create judge based on config
    // Note: For debate, we use a simple judge that returns numeric scores
    let judge;
    if (config.judge.type === 'heuristic') {
      // Wrap HeuristicJudge to match debate judge interface
      const heuristicJudge = new HeuristicJudge();
      judge = {
        score: async (prompt: string, response: string) => {
          const result = await heuristicJudge.score(
            { id: 'temp', text: response, providerName: '', modelName: '' },
            { weights: { length: 0.5, structure: 0.5 } }
          );
          return { score: result.total * 10, reasoning: 'Heuristic scoring' };
        }
      };
    } else {
      const judgeProviderName = config.judge.provider.split('/')[0];
      const judgeModelName = config.judge.provider.split('/')[1];
      const judgeAdapter = getProvider(judgeProviderName);
      const llmJudge = new LLMJudge(judgeAdapter, judgeModelName);
      judge = {
        score: async (prompt: string, response: string) => {
          const result = await llmJudge.score(
            { id: 'temp', text: response, providerName: '', modelName: '' },
            { weights: { quality: 1.0 } }
          );
          return { score: result.total * 10, reasoning: result.reasoning || 'LLM scoring' };
        }
      };
    }

    // Run debate
    const coordinator = new DebateCoordinator(registry, judge);
    const result = await coordinator.runDebate(config);

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
