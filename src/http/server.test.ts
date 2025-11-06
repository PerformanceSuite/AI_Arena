import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, stopServer } from './server';
import { registerProvider } from '../adapters/index';
import { MockAdapter } from '../../tests/mocks/mock-adapter';

describe('HTTP Server', () => {
  const port = 13457; // Use test port

  beforeAll(async () => {
    // Register mock adapters for testing
    const mockAdapterA = new MockAdapter();
    mockAdapterA.name = 'mock-a';
    mockAdapterA.queueResponse('TypeScript is better because it has types!');
    mockAdapterA.queueResponse('After considering your points, TypeScript still wins.');

    const mockAdapterB = new MockAdapter();
    mockAdapterB.name = 'mock-b';
    mockAdapterB.queueResponse('I disagree. JavaScript is more flexible.');

    registerProvider('mock-a', mockAdapterA);
    registerProvider('mock-b', mockAdapterB);

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

  it('POST /debate runs debate and returns result', async () => {
    const response = await fetch(`http://localhost:${port}/debate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerA: 'mock-a/mock-model-1',
        providerB: 'mock-b/mock-model-2',
        prompt: 'TypeScript vs JavaScript?',
        rounds: 1,
        judge: {
          type: 'heuristic',
          provider: 'mock-a/mock-model-1'
        }
      })
    });

    const data: any = await response.json();
    if (response.status !== 200) {
      console.error('Debate endpoint error:', data);
    }
    expect(response.status).toBe(200);
    expect(data.rounds).toHaveLength(1);
    expect(data.winner).toBeDefined();
  });
});
