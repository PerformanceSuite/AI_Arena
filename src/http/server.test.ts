import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer } from './server';

describe('HTTP Server', () => {
  const port = 13457; // Use test port

  beforeAll(async () => {
    await startServer({ port });
  });

  afterAll(async () => {
    await stopServer();
  });

  it('responds to health check', async () => {
    const response = await fetch(`http://localhost:${port}/health`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('lists available models', async () => {
    const response = await fetch(`http://localhost:${port}/models`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.providers).toBeDefined();
  });

  it('validates invoke request', async () => {
    const response = await fetch(`http://localhost:${port}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'request' })
    });

    expect(response.status).toBe(400);
  });
});
