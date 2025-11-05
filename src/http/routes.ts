import { Hono } from 'hono';
import { getAllProviders } from '../adapters/index';
import { invokeOperation, competeOperation } from '../core/operations';
import { validateCNF } from '../cnf/schema';

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
