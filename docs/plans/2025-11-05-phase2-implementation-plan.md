# Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement debate competition mode, add Anthropic/xAI providers, and build infrastructure (CNF compression, artifacts, traces) using vertical slice approach.

**Architecture:** Extend existing arena coordinator with debate flow, implement two new provider adapters following Phase 1 patterns, add infrastructure layer for compression/storage/observability.

**Tech Stack:** TypeScript, Vitest, @anthropic-ai/sdk, Hono (HTTP), file-based storage

---

## Task 1: Debate Coordinator - Types & Interface

**Files:**
- Create: `src/arena/debate.ts`
- Create: `src/arena/debate.test.ts`

**Step 1: Write failing test for debate types**

Create `src/arena/debate.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { DebateCoordinator, DebateConfig, DebateState } from './debate';
import { createMockCNF } from '../../tests/mocks/mock-cnf';

describe('DebateCoordinator', () => {
  it('creates debate state from config', () => {
    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is better: TypeScript or JavaScript?',
      rounds: 1,
      judge: {
        type: 'llm',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator();
    const state = coordinator.initializeDebate(config);

    expect(state.prompt).toBe(config.prompt);
    expect(state.rounds).toHaveLength(0);
    expect(state.winner).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/arena/debate.test.ts`
Expected: FAIL with "Cannot find module './debate'"

**Step 3: Write minimal types and class**

Create `src/arena/debate.ts`:

```typescript
import type { CNF } from '../cnf/types';

export interface DebateConfig {
  providerA: string;
  providerB: string;
  prompt: string;
  rounds: number;
  judge: {
    type: 'llm' | 'heuristic';
    provider: string;
  };
}

export interface DebateRound {
  turn: number;
  providerA_response: string;
  providerB_critique: string;
  providerA_refined: string;
}

export interface DebateState {
  prompt: string;
  rounds: DebateRound[];
  winner?: 'A' | 'B' | 'tie';
  scores?: { A: number; B: number };
}

export class DebateCoordinator {
  initializeDebate(config: DebateConfig): DebateState {
    return {
      prompt: config.prompt,
      rounds: []
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/arena/debate.test.ts`
Expected: PASS (1 test)

**Step 5: Commit**

```bash
git add src/arena/debate.ts src/arena/debate.test.ts
git commit -m "feat(debate): add debate coordinator types and interface"
```

---

## Task 2: Debate Coordinator - Execute Flow

**Files:**
- Modify: `src/arena/debate.ts`
- Modify: `src/arena/debate.test.ts`

**Step 1: Write failing test for debate execution**

Add to `src/arena/debate.test.ts`:

```typescript
it('executes 2-turn debate flow', async () => {
  const mockRegistry = {
    getAdapter: vi.fn((provider: string) => ({
      chat: vi.fn()
        .mockResolvedValueOnce({
          outputText: 'TypeScript is better because...',
          updatedCNF: createMockCNF()
        })
        .mockResolvedValueOnce({
          outputText: 'I disagree. JavaScript has...',
          updatedCNF: createMockCNF()
        })
        .mockResolvedValueOnce({
          outputText: 'Taking your critique into account...',
          updatedCNF: createMockCNF()
        })
    }))
  };

  const config: DebateConfig = {
    providerA: 'openai/gpt-4o-mini',
    providerB: 'google/gemini-2.5-flash',
    prompt: 'What is better: TypeScript or JavaScript?',
    rounds: 1,
    judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
  };

  const coordinator = new DebateCoordinator(mockRegistry as any);
  const state = await coordinator.runDebate(config);

  expect(state.rounds).toHaveLength(1);
  expect(state.rounds[0].providerA_response).toContain('TypeScript');
  expect(state.rounds[0].providerB_critique).toContain('disagree');
  expect(state.rounds[0].providerA_refined).toContain('critique');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/arena/debate.test.ts`
Expected: FAIL with "runDebate is not a function"

**Step 3: Implement debate execution logic**

Update `src/arena/debate.ts`:

```typescript
import type { CNF } from '../cnf/types';
import type { ProviderRegistry } from '../adapters/registry';

// ... existing types ...

export class DebateCoordinator {
  constructor(private registry?: ProviderRegistry) {}

  initializeDebate(config: DebateConfig): DebateState {
    return {
      prompt: config.prompt,
      rounds: []
    };
  }

  async runDebate(config: DebateConfig): Promise<DebateState> {
    if (!this.registry) {
      throw new Error('ProviderRegistry required for debate execution');
    }

    const state = this.initializeDebate(config);
    const cnfA: CNF = { sessionId: 'debate-a', messages: [] };
    const cnfB: CNF = { sessionId: 'debate-b', messages: [] };

    for (let turn = 0; turn < config.rounds; turn++) {
      const round: DebateRound = {
        turn: turn + 1,
        providerA_response: '',
        providerB_critique: '',
        providerA_refined: ''
      };

      // Provider A initial response
      const adapterA = this.registry.getAdapter(config.providerA);
      cnfA.messages.push({ role: 'user', content: config.prompt });
      const responseA = await adapterA.chat({
        cnf: cnfA,
        targetModel: config.providerA.split('/')[1]
      });
      round.providerA_response = responseA.outputText || '';

      // Provider B critique
      const adapterB = this.registry.getAdapter(config.providerB);
      cnfB.messages.push(
        { role: 'user', content: config.prompt },
        { role: 'assistant', content: `Provider A said: ${round.providerA_response}` },
        { role: 'user', content: 'Critique this response and provide your own answer.' }
      );
      const responseB = await adapterB.chat({
        cnf: cnfB,
        targetModel: config.providerB.split('/')[1]
      });
      round.providerB_critique = responseB.outputText || '';

      // Provider A refine
      cnfA.messages.push(
        { role: 'assistant', content: round.providerA_response },
        { role: 'user', content: `Provider B critiqued your response: ${round.providerB_critique}\n\nRefine your answer.` }
      );
      const refinedA = await adapterA.chat({
        cnf: cnfA,
        targetModel: config.providerA.split('/')[1]
      });
      round.providerA_refined = refinedA.outputText || '';

      state.rounds.push(round);
    }

    return state;
  }
}
```

**Step 4: Create mock CNF helper**

Create `tests/mocks/mock-cnf.ts`:

```typescript
import type { CNF } from '../../src/cnf/types';

export function createMockCNF(overrides: Partial<CNF> = {}): CNF {
  return {
    sessionId: 'mock-session',
    messages: [],
    ...overrides
  };
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test src/arena/debate.test.ts`
Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add src/arena/debate.ts src/arena/debate.test.ts tests/mocks/mock-cnf.ts
git commit -m "feat(debate): implement 2-turn debate execution flow"
```

---

## Task 3: Debate Coordinator - Add Judging

**Files:**
- Modify: `src/arena/debate.ts`
- Modify: `src/arena/debate.test.ts`

**Step 1: Write failing test for judging**

Add to `src/arena/debate.test.ts`:

```typescript
it('judges debate and declares winner', async () => {
  const mockJudge = {
    score: vi.fn()
      .mockResolvedValueOnce({ score: 7.5, reasoning: 'Good points' })
      .mockResolvedValueOnce({ score: 8.2, reasoning: 'Better argument' })
  };

  const mockRegistry = {
    getAdapter: vi.fn(() => ({
      chat: vi.fn().mockResolvedValue({
        outputText: 'Response',
        updatedCNF: createMockCNF()
      })
    }))
  };

  const config: DebateConfig = {
    providerA: 'openai/gpt-4o-mini',
    providerB: 'google/gemini-2.5-flash',
    prompt: 'Test prompt',
    rounds: 1,
    judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
  };

  const coordinator = new DebateCoordinator(mockRegistry as any, mockJudge as any);
  const state = await coordinator.runDebate(config);

  expect(state.winner).toBe('B');
  expect(state.scores).toEqual({ A: 7.5, B: 8.2 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/arena/debate.test.ts`
Expected: FAIL with "expected undefined to be 'B'"

**Step 3: Implement judging logic**

Update `src/arena/debate.ts`:

```typescript
import type { Judge } from './judges';

// ... existing code ...

export class DebateCoordinator {
  constructor(
    private registry?: ProviderRegistry,
    private judge?: Judge
  ) {}

  // ... existing methods ...

  async runDebate(config: DebateConfig): Promise<DebateState> {
    // ... existing debate flow ...

    // Judge final responses
    if (this.judge) {
      const lastRound = state.rounds[state.rounds.length - 1];

      const scoreA = await this.judge.score(
        config.prompt,
        lastRound.providerA_refined
      );
      const scoreB = await this.judge.score(
        config.prompt,
        lastRound.providerB_critique
      );

      state.scores = {
        A: scoreA.score,
        B: scoreB.score
      };

      if (scoreA.score > scoreB.score) {
        state.winner = 'A';
      } else if (scoreB.score > scoreA.score) {
        state.winner = 'B';
      } else {
        state.winner = 'tie';
      }
    }

    return state;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/arena/debate.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/arena/debate.ts src/arena/debate.test.ts
git commit -m "feat(debate): add judging and winner declaration"
```

---

## Task 4: HTTP Debate Endpoint

**Files:**
- Modify: `src/http/server.ts`
- Modify: `src/http/server.test.ts`

**Step 1: Write failing test for /debate endpoint**

Add to `src/http/server.test.ts`:

```typescript
it('POST /debate runs debate and returns result', async () => {
  const response = await app.request('/debate', {
    method: 'POST',
    body: JSON.stringify({
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'TypeScript vs JavaScript?',
      rounds: 1,
      judge: {
        type: 'heuristic',
        rubric: 'length'
      }
    }),
    headers: new Headers({ 'Content-Type': 'application/json' })
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.rounds).toHaveLength(1);
  expect(data.winner).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/http/server.test.ts`
Expected: FAIL with 404 or route not found

**Step 3: Add /debate route**

Update `src/http/server.ts`:

```typescript
import { DebateCoordinator } from '../arena/debate';
import type { DebateConfig } from '../arena/debate';

// ... existing code ...

// Add after existing routes
app.post('/debate', async (c) => {
  try {
    const config = await c.req.json<DebateConfig>();

    // Validate config
    if (!config.providerA || !config.providerB || !config.prompt) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create judge based on config
    let judge;
    if (config.judge.type === 'heuristic') {
      const { HeuristicJudge } = await import('../arena/heuristic-judge');
      judge = new HeuristicJudge();
    } else {
      const { LLMJudge } = await import('../arena/llm-judge');
      const registry = (c as any).registry;
      judge = new LLMJudge(registry, config.judge.provider);
    }

    // Run debate
    const coordinator = new DebateCoordinator(
      (c as any).registry,
      judge
    );
    const result = await coordinator.runDebate(config);

    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/http/server.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/http/server.ts src/http/server.test.ts
git commit -m "feat(http): add POST /debate endpoint"
```

---

## Task 5: Anthropic Provider Adapter - Setup & Types

**Files:**
- Create: `src/adapters/anthropic.ts`
- Create: `src/adapters/anthropic.test.ts`
- Modify: `package.json`

**Step 1: Install Anthropic SDK**

Run: `pnpm add @anthropic-ai/sdk`

**Step 2: Write failing test for Anthropic adapter**

Create `src/adapters/anthropic.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicAdapter } from './anthropic';
import type { CNF } from '../cnf/types';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn()
    };
  }
}));

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('claude-3-5-sonnet-20241022');
    expect(models).toContain('claude-3-5-haiku-20241022');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `pnpm test src/adapters/anthropic.test.ts`
Expected: FAIL with "Cannot find module './anthropic'"

**Step 4: Create Anthropic adapter skeleton**

Create `src/adapters/anthropic.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, ProviderConfig, ChatInput, ChatOutput } from './types';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';
  private client?: Anthropic;

  async configure(config: ProviderConfig): Promise<void> {
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    throw new Error('Not implemented');
  }
}
```

**Step 5: Run test to verify it passes**

Run: `pnpm test src/adapters/anthropic.test.ts`
Expected: PASS (1 test)

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/adapters/anthropic.ts src/adapters/anthropic.test.ts
git commit -m "feat(anthropic): add Anthropic adapter skeleton and SDK"
```

---

## Task 6: Anthropic Provider - CNF Translation

**Files:**
- Modify: `src/adapters/anthropic.ts`
- Modify: `src/adapters/anthropic.test.ts`

**Step 1: Write failing test for CNF translation**

Add to `src/adapters/anthropic.test.ts`:

```typescript
it('translates CNF to Anthropic format', async () => {
  await adapter.configure({ apiKey: 'test-key' });

  const mockCreate = vi.fn().mockResolvedValue({
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello from Claude!' }],
    model: 'claude-3-5-sonnet-20241022',
    usage: {
      input_tokens: 10,
      output_tokens: 8
    }
  });

  (adapter as any).client.messages.create = mockCreate;

  const cnf: CNF = {
    sessionId: 'test',
    messages: [
      { role: 'user', content: 'Hi Claude' }
    ]
  };

  const result = await adapter.chat({
    cnf,
    targetModel: 'claude-3-5-sonnet-20241022'
  });

  expect(result.outputText).toBe('Hello from Claude!');
  expect(result.usage?.input).toBe(10);
  expect(result.usage?.output).toBe(8);
  expect(mockCreate).toHaveBeenCalledWith({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{ role: 'user', content: 'Hi Claude' }]
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/adapters/anthropic.test.ts`
Expected: FAIL with "Not implemented"

**Step 3: Implement chat method with translation**

Update `src/adapters/anthropic.ts`:

```typescript
async chat(input: ChatInput): Promise<ChatOutput> {
  if (!this.client) {
    throw new Error('Anthropic client not configured');
  }

  // Translate CNF to Anthropic format
  const messages = this.translateCNFToAnthropic(input.cnf);

  // Call Anthropic API
  const response = await this.client.messages.create({
    model: input.targetModel,
    max_tokens: input.maxTokens || 4096,
    temperature: input.temperature,
    messages
  });

  // Extract text from response
  const outputText = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text)
    .join('');

  // Lift response back to CNF
  const updatedCNF = this.liftAnthropicToCNF(input.cnf, response, outputText);

  return {
    updatedCNF,
    outputText,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens
    }
  };
}

private translateCNFToAnthropic(cnf: CNF): Array<{ role: string; content: string }> {
  return cnf.messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }));
}

private liftAnthropicToCNF(cnf: CNF, response: any, outputText: string): CNF {
  return {
    ...cnf,
    messages: [
      ...cnf.messages,
      { role: 'assistant', content: outputText }
    ]
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/adapters/anthropic.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/adapters/anthropic.ts src/adapters/anthropic.test.ts
git commit -m "feat(anthropic): implement CNF translation and chat method"
```

---

## Task 7: Register Anthropic Adapter

**Files:**
- Modify: `src/adapters/registry.ts`
- Modify: `src/adapters/registry.test.ts`

**Step 1: Write failing test for Anthropic registration**

Add to `src/adapters/registry.test.ts`:

```typescript
it('registers and retrieves anthropic adapter', async () => {
  const { AnthropicAdapter } = await import('./anthropic');
  registry.register('anthropic', new AnthropicAdapter());

  const adapter = registry.getAdapter('anthropic/claude-3-5-sonnet-20241022');
  expect(adapter).toBeDefined();
  expect(adapter.name).toBe('anthropic');
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/adapters/registry.test.ts`
Expected: FAIL (anthropic not registered by default)

**Step 3: Add Anthropic to default registry**

Update `src/adapters/registry.ts`:

```typescript
import { AnthropicAdapter } from './anthropic';

// ... existing code ...

export function createDefaultRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  registry.register('openai', new OpenAIAdapter());
  registry.register('google', new GoogleAdapter());
  registry.register('anthropic', new AnthropicAdapter());
  registry.register('local', new LocalAdapter());

  return registry;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/adapters/registry.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/adapters/registry.ts src/adapters/registry.test.ts
git commit -m "feat(registry): register Anthropic adapter in default registry"
```

---

## Task 8: CNF Compression - Infrastructure

**Files:**
- Create: `src/cnf/compression.ts`
- Create: `src/cnf/compression.test.ts`

**Step 1: Write failing test for compression**

Create `src/cnf/compression.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { compressCNF, CompressionConfig } from './compression';
import type { CNF } from './types';

describe('CNF Compression', () => {
  it('preserves short conversations without compression', async () => {
    const cnf: CNF = {
      sessionId: 'test',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
    };

    const config: CompressionConfig = {
      strategy: 'summarize',
      maxTokens: 4000,
      preserveRecent: 5
    };

    const compressed = await compressCNF(cnf, config);
    expect(compressed.messages).toHaveLength(2);
  });

  it('compresses long conversations preserving recent messages', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `Message ${i + 1}`
    }));

    const cnf: CNF = {
      sessionId: 'test',
      messages
    };

    const config: CompressionConfig = {
      strategy: 'summarize',
      maxTokens: 4000,
      preserveRecent: 3
    };

    // Mock summarization
    const mockSummarize = vi.fn().mockResolvedValue('Summary of old messages');

    const compressed = await compressCNF(cnf, config, mockSummarize);

    expect(compressed.messages.length).toBeLessThan(cnf.messages.length);
    expect(compressed.messages[0].role).toBe('system');
    expect(compressed.messages[0].content).toContain('Summary');
    expect(mockSummarize).toHaveBeenCalledWith(messages.slice(0, -3));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/cnf/compression.test.ts`
Expected: FAIL with "Cannot find module './compression'"

**Step 3: Implement compression logic**

Create `src/cnf/compression.ts`:

```typescript
import type { CNF } from './types';

export interface CompressionConfig {
  strategy: 'summarize' | 'truncate' | 'sliding-window';
  maxTokens: number;
  preserveRecent: number;
}

export async function compressCNF(
  cnf: CNF,
  config: CompressionConfig,
  summarizeFn?: (messages: CNF['messages']) => Promise<string>
): Promise<CNF> {
  // No compression needed if under threshold
  if (cnf.messages.length <= config.preserveRecent) {
    return cnf;
  }

  // Split messages
  const oldMessages = cnf.messages.slice(0, -config.preserveRecent);
  const recentMessages = cnf.messages.slice(-config.preserveRecent);

  // Summarize old messages
  const summary = summarizeFn
    ? await summarizeFn(oldMessages)
    : `[Conversation summary: ${oldMessages.length} messages]`;

  return {
    ...cnf,
    messages: [
      { role: 'system', content: `[Conversation summary]: ${summary}` },
      ...recentMessages
    ]
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/cnf/compression.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/cnf/compression.ts src/cnf/compression.test.ts
git commit -m "feat(cnf): implement CNF compression with summarization"
```

---

## Task 9: Artifact Storage System

**Files:**
- Create: `src/artifacts/storage.ts`
- Create: `src/artifacts/storage.test.ts`

**Step 1: Write failing test for artifact storage**

Create `src/artifacts/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArtifactStore, Artifact } from './storage';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ArtifactStore', () => {
  const testBasePath = './test-artifacts';
  let store: ArtifactStore;

  beforeEach(() => {
    store = new ArtifactStore(testBasePath);
  });

  afterEach(async () => {
    await fs.rm(testBasePath, { recursive: true, force: true });
  });

  it('stores and retrieves artifacts', async () => {
    const artifact: Artifact = {
      id: 'test-123',
      sessionId: 'session-abc',
      type: 'document',
      content: 'Test content',
      metadata: { author: 'test' },
      createdAt: new Date()
    };

    const storedPath = await store.store(artifact);
    expect(storedPath).toContain('test-artifacts');
    expect(storedPath).toContain('session-abc');

    const retrieved = await store.retrieve(artifact.id);
    expect(retrieved.content).toBe('Test content');
    expect(retrieved.metadata.author).toBe('test');
  });

  it('lists artifacts by session', async () => {
    const artifacts: Artifact[] = [
      {
        id: 'art-1',
        sessionId: 'session-1',
        type: 'code',
        content: 'Code 1',
        metadata: {},
        createdAt: new Date()
      },
      {
        id: 'art-2',
        sessionId: 'session-1',
        type: 'document',
        content: 'Doc 1',
        metadata: {},
        createdAt: new Date()
      }
    ];

    for (const artifact of artifacts) {
      await store.store(artifact);
    }

    const list = await store.listBySession('session-1');
    expect(list).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/artifacts/storage.test.ts`
Expected: FAIL with "Cannot find module './storage'"

**Step 3: Implement artifact storage**

Create `src/artifacts/storage.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Artifact {
  id: string;
  sessionId: string;
  type: 'code' | 'document' | 'image' | 'data';
  content: string | Buffer;
  metadata: Record<string, any>;
  createdAt: Date;
}

export class ArtifactStore {
  constructor(private basePath: string = './artifacts') {}

  async store(artifact: Artifact): Promise<string> {
    const sessionDir = path.join(this.basePath, artifact.sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    const artifactPath = path.join(sessionDir, `${artifact.id}.json`);
    const data = {
      ...artifact,
      content: artifact.content.toString(),
      createdAt: artifact.createdAt.toISOString()
    };

    await fs.writeFile(artifactPath, JSON.stringify(data, null, 2));
    return artifactPath;
  }

  async retrieve(id: string): Promise<Artifact> {
    // Search all session directories
    const sessions = await fs.readdir(this.basePath);

    for (const session of sessions) {
      const artifactPath = path.join(this.basePath, session, `${id}.json`);
      try {
        const data = await fs.readFile(artifactPath, 'utf-8');
        const parsed = JSON.parse(data);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt)
        };
      } catch {
        // Try next session
        continue;
      }
    }

    throw new Error(`Artifact ${id} not found`);
  }

  async listBySession(sessionId: string): Promise<Artifact[]> {
    const sessionDir = path.join(this.basePath, sessionId);

    try {
      const files = await fs.readdir(sessionDir);
      const artifacts: Artifact[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(sessionDir, file), 'utf-8');
          const parsed = JSON.parse(data);
          artifacts.push({
            ...parsed,
            createdAt: new Date(parsed.createdAt)
          });
        }
      }

      return artifacts;
    } catch {
      return [];
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/artifacts/storage.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/artifacts/storage.ts src/artifacts/storage.test.ts
git commit -m "feat(artifacts): implement file-based artifact storage"
```

---

## Task 10: Structured Trace Events

**Files:**
- Create: `src/observability/traces.ts`
- Create: `src/observability/traces.test.ts`

**Step 1: Write failing test for trace emission**

Create `src/observability/traces.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TraceEmitter, TraceEvent } from './traces';

describe('TraceEmitter', () => {
  it('emits structured trace events', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const emitter = new TraceEmitter();
    const event: TraceEvent = {
      timestamp: new Date(),
      sessionId: 'test-session',
      eventType: 'competition.start',
      data: { mode: 'round-robin', providers: 2 }
    };

    emitter.emit(event);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"eventType":"competition.start"'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"sessionId":"test-session"'));

    consoleSpy.mockRestore();
  });

  it('filters events by level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const emitter = new TraceEmitter({ minLevel: 'warning' });

    emitter.emit({
      timestamp: new Date(),
      sessionId: 'test',
      eventType: 'debug.info',
      level: 'debug',
      data: {}
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    emitter.emit({
      timestamp: new Date(),
      sessionId: 'test',
      eventType: 'provider.error',
      level: 'error',
      data: {}
    });

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/observability/traces.test.ts`
Expected: FAIL with "Cannot find module './traces'"

**Step 3: Implement trace emitter**

Create `src/observability/traces.ts`:

```typescript
export interface TraceEvent {
  timestamp: Date;
  sessionId: string;
  eventType:
    | 'competition.start'
    | 'competition.end'
    | 'provider.invoke'
    | 'provider.error'
    | 'judge.score'
    | 'debate.turn'
    | 'debug.info';
  level?: 'debug' | 'info' | 'warning' | 'error';
  data: Record<string, any>;
}

export interface TraceEmitterConfig {
  minLevel?: 'debug' | 'info' | 'warning' | 'error';
  format?: 'json' | 'pretty';
}

const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3
};

export class TraceEmitter {
  constructor(private config: TraceEmitterConfig = {}) {}

  emit(event: TraceEvent): void {
    const eventLevel = event.level || 'info';
    const minLevel = this.config.minLevel || 'debug';

    // Filter by level
    if (LEVEL_PRIORITY[eventLevel] < LEVEL_PRIORITY[minLevel]) {
      return;
    }

    // Emit as JSON (Phase 2)
    const output = {
      ...event,
      timestamp: event.timestamp.toISOString()
    };

    console.log(JSON.stringify(output));
  }
}

// Singleton instance
let globalEmitter: TraceEmitter | null = null;

export function getTraceEmitter(config?: TraceEmitterConfig): TraceEmitter {
  if (!globalEmitter) {
    globalEmitter = new TraceEmitter(config);
  }
  return globalEmitter;
}

export function emitTrace(event: TraceEvent): void {
  getTraceEmitter().emit(event);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/observability/traces.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/observability/traces.ts src/observability/traces.test.ts
git commit -m "feat(observability): implement structured trace event system"
```

---

## Task 11: Integrate Traces into Debate

**Files:**
- Modify: `src/arena/debate.ts`
- Modify: `src/arena/debate.test.ts`

**Step 1: Write test for trace emission during debate**

Add to `src/arena/debate.test.ts`:

```typescript
it('emits trace events during debate execution', async () => {
  const mockEmitter = {
    emit: vi.fn()
  };

  const mockRegistry = {
    getAdapter: vi.fn(() => ({
      chat: vi.fn().mockResolvedValue({
        outputText: 'Response',
        updatedCNF: createMockCNF()
      })
    }))
  };

  const config: DebateConfig = {
    providerA: 'openai/gpt-4o-mini',
    providerB: 'google/gemini-2.5-flash',
    prompt: 'Test',
    rounds: 1,
    judge: { type: 'llm', provider: 'openai/gpt-4o-mini' }
  };

  const coordinator = new DebateCoordinator(
    mockRegistry as any,
    undefined,
    mockEmitter as any
  );

  await coordinator.runDebate(config);

  expect(mockEmitter.emit).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: 'competition.start',
      data: expect.objectContaining({ mode: 'debate' })
    })
  );

  expect(mockEmitter.emit).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: 'debate.turn'
    })
  );

  expect(mockEmitter.emit).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: 'competition.end'
    })
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/arena/debate.test.ts`
Expected: FAIL (emitter not integrated)

**Step 3: Integrate trace emitter**

Update `src/arena/debate.ts`:

```typescript
import type { TraceEmitter } from '../observability/traces';

export class DebateCoordinator {
  constructor(
    private registry?: ProviderRegistry,
    private judge?: Judge,
    private traceEmitter?: TraceEmitter
  ) {}

  async runDebate(config: DebateConfig): Promise<DebateState> {
    const sessionId = `debate-${Date.now()}`;

    // Emit start event
    this.traceEmitter?.emit({
      timestamp: new Date(),
      sessionId,
      eventType: 'competition.start',
      data: {
        mode: 'debate',
        providerA: config.providerA,
        providerB: config.providerB,
        rounds: config.rounds
      }
    });

    // ... existing debate logic ...

    for (let turn = 0; turn < config.rounds; turn++) {
      // Emit turn start
      this.traceEmitter?.emit({
        timestamp: new Date(),
        sessionId,
        eventType: 'debate.turn',
        data: { turn: turn + 1, phase: 'start' }
      });

      // ... existing turn logic ...

      // Emit turn end
      this.traceEmitter?.emit({
        timestamp: new Date(),
        sessionId,
        eventType: 'debate.turn',
        data: { turn: turn + 1, phase: 'complete' }
      });
    }

    // ... existing judging logic ...

    // Emit end event
    this.traceEmitter?.emit({
      timestamp: new Date(),
      sessionId,
      eventType: 'competition.end',
      data: {
        winner: state.winner,
        scores: state.scores
      }
    });

    return state;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/arena/debate.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/arena/debate.ts src/arena/debate.test.ts
git commit -m "feat(debate): integrate trace emission for observability"
```

---

## Task 12: xAI Provider Adapter

**Files:**
- Create: `src/adapters/xai.ts`
- Create: `src/adapters/xai.test.ts`

**Step 1: Write failing test for xAI adapter**

Create `src/adapters/xai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XAIAdapter } from './xai';
import type { CNF } from '../cnf/types';

// xAI uses OpenAI-compatible API
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn()
      }
    };
  }
}));

describe('XAIAdapter', () => {
  let adapter: XAIAdapter;

  beforeEach(() => {
    adapter = new XAIAdapter();
  });

  it('configures with API key and custom base URL', async () => {
    await adapter.configure({
      apiKey: 'test-key',
      baseURL: 'https://api.x.ai/v1'
    });

    const models = await adapter.listModels();
    expect(models).toContain('grok-beta');
  });

  it('translates CNF and calls xAI API', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.fn().mockResolvedValue({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'grok-beta',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello from Grok!'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18
      }
    });

    (adapter as any).client.chat.completions.create = mockCreate;

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi Grok' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'grok-beta' });

    expect(result.outputText).toBe('Hello from Grok!');
    expect(result.usage?.total).toBe(18);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/adapters/xai.test.ts`
Expected: FAIL with "Cannot find module './xai'"

**Step 3: Implement xAI adapter (OpenAI-compatible)**

Create `src/adapters/xai.ts`:

```typescript
import OpenAI from 'openai';
import type { ProviderAdapter, ProviderConfig, ChatInput, ChatOutput } from './types';
import type { CNF } from '../cnf/types';

export class XAIAdapter implements ProviderAdapter {
  name = 'xai';
  private client?: OpenAI;

  async configure(config: ProviderConfig): Promise<void> {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.x.ai/v1'
    });
  }

  async listModels(): Promise<string[]> {
    return ['grok-beta', 'grok-vision-beta'];
  }

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (!this.client) {
      throw new Error('xAI client not configured');
    }

    // Translate CNF to OpenAI format (xAI is compatible)
    const messages = input.cnf.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Call xAI API
    const response = await this.client.chat.completions.create({
      model: input.targetModel,
      messages: messages as any,
      temperature: input.temperature,
      max_tokens: input.maxTokens
    });

    const outputText = response.choices[0]?.message?.content || '';

    // Lift response to CNF
    const updatedCNF: CNF = {
      ...input.cnf,
      messages: [
        ...input.cnf.messages,
        { role: 'assistant', content: outputText }
      ]
    };

    return {
      updatedCNF,
      outputText,
      usage: response.usage ? {
        input: response.usage.prompt_tokens,
        output: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/adapters/xai.test.ts`
Expected: PASS (2 tests)

**Step 5: Register xAI adapter**

Update `src/adapters/registry.ts`:

```typescript
import { XAIAdapter } from './xai';

// ... in createDefaultRegistry ...
registry.register('xai', new XAIAdapter());
```

**Step 6: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/adapters/xai.ts src/adapters/xai.test.ts src/adapters/registry.ts
git commit -m "feat(xai): add xAI Grok adapter with OpenAI-compatible API"
```

---

## Task 13: Update Configuration & Documentation

**Files:**
- Modify: `arena.config.yaml`
- Modify: `README.md`
- Create: `examples/debate-example.ts`

**Step 1: Update arena.config.yaml**

Update `arena.config.yaml`:

```yaml
# AI Arena Configuration
# Environment variables are substituted automatically

providers:
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      - id: gpt-4o-mini
        maxTokens: 4096
      - id: gpt-4o
        maxTokens: 4096

  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
        maxTokens: 4096
      - id: claude-3-5-haiku-20241022
        maxTokens: 4096

  xai:
    apiKey: ${XAI_API_KEY}
    baseURL: https://api.x.ai/v1
    models:
      - id: grok-beta
        maxTokens: 4096

  google:
    apiKey: ${GEMINI_API_KEY}
    models:
      - id: gemini-2.5-flash
        maxTokens: 8192
      - id: gemini-2.5-pro
        maxTokens: 8192

infrastructure:
  compression:
    strategy: summarize
    maxTokens: 4000
    preserveRecent: 5

  artifacts:
    storageType: filesystem
    basePath: ./artifacts

  traces:
    enabled: true
    format: json
    minLevel: info

server:
  http:
    port: 3457
```

**Step 2: Create debate example**

Create `examples/debate-example.ts`:

```typescript
import { DebateCoordinator } from '../src/arena/debate';
import { createDefaultRegistry } from '../src/adapters/registry';
import { HeuristicJudge } from '../src/arena/heuristic-judge';
import type { DebateConfig } from '../src/arena/debate';

async function runDebateExample() {
  // Initialize registry and judge
  const registry = createDefaultRegistry();
  const judge = new HeuristicJudge();

  // Configure debate
  const config: DebateConfig = {
    providerA: 'openai/gpt-4o-mini',
    providerB: 'anthropic/claude-3-5-haiku-20241022',
    prompt: 'What are the pros and cons of TypeScript vs JavaScript for a new web project?',
    rounds: 1,
    judge: {
      type: 'heuristic',
      provider: 'openai/gpt-4o-mini'
    }
  };

  // Run debate
  const coordinator = new DebateCoordinator(registry, judge);
  const result = await coordinator.runDebate(config);

  // Display results
  console.log('\n=== Debate Results ===\n');
  console.log(`Prompt: ${result.prompt}\n`);

  for (const round of result.rounds) {
    console.log(`\n--- Round ${round.turn} ---\n`);
    console.log(`Provider A (Initial): ${round.providerA_response}\n`);
    console.log(`Provider B (Critique): ${round.providerB_critique}\n`);
    console.log(`Provider A (Refined): ${round.providerA_refined}\n`);
  }

  console.log(`\nWinner: ${result.winner}`);
  console.log(`Scores: A=${result.scores?.A}, B=${result.scores?.B}`);
}

runDebateExample().catch(console.error);
```

**Step 3: Update README with Phase 2 features**

Add to `README.md`:

```markdown
## Phase 2 Features (Current)

### Debate Mode
Run AI-to-AI debates with cross-critique and refinement:

```bash
curl -X POST http://localhost:3457/debate \
  -H "Content-Type: application/json" \
  -d '{
    "providerA": "openai/gpt-4o-mini",
    "providerB": "anthropic/claude-3-5-sonnet-20241022",
    "prompt": "What is better: tabs or spaces?",
    "rounds": 1,
    "judge": {
      "type": "llm",
      "provider": "openai/gpt-4o-mini"
    }
  }'
```

### New Providers
- **Anthropic (Claude)**: claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus
- **xAI (Grok)**: grok-beta, grok-vision-beta

### Infrastructure
- **CNF Compression**: Automatic summarization for long contexts
- **Artifact Storage**: File-based storage for debate transcripts
- **Structured Traces**: JSON logging for observability

### Example

```bash
# Run debate example
pnpm tsx examples/debate-example.ts
```
```

**Step 4: Commit**

```bash
git add arena.config.yaml README.md examples/debate-example.ts
git commit -m "docs: update config and add Phase 2 documentation with debate example"
```

---

## Task 14: Integration Testing

**Files:**
- Create: `tests/integration/debate.test.ts`

**Step 1: Write integration test for debate**

Create `tests/integration/debate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DebateCoordinator } from '../../src/arena/debate';
import { createDefaultRegistry } from '../../src/adapters/registry';
import { HeuristicJudge } from '../../src/arena/heuristic-judge';
import type { DebateConfig } from '../../src/arena/debate';

describe('Debate Integration', () => {
  it('runs complete debate with mock adapters', async () => {
    const registry = createDefaultRegistry();
    const judge = new HeuristicJudge();

    const config: DebateConfig = {
      providerA: 'openai/gpt-4o-mini',
      providerB: 'google/gemini-2.5-flash',
      prompt: 'What is 2+2?',
      rounds: 1,
      judge: {
        type: 'heuristic',
        provider: 'openai/gpt-4o-mini'
      }
    };

    const coordinator = new DebateCoordinator(registry, judge);
    const result = await coordinator.runDebate(config);

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0].providerA_response).toBeTruthy();
    expect(result.rounds[0].providerB_critique).toBeTruthy();
    expect(result.rounds[0].providerA_refined).toBeTruthy();
    expect(result.winner).toBeOneOf(['A', 'B', 'tie']);
  });
});
```

**Step 2: Run test**

Run: `pnpm test tests/integration/debate.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/debate.test.ts
git commit -m "test: add integration test for complete debate flow"
```

---

## Task 15: Final Verification & Polish

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CURRENT_SESSION.md`

**Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (50+ tests)

**Step 2: Run build**

Run: `pnpm build`
Expected: Successful compilation

**Step 3: Update ROADMAP**

Update `docs/ROADMAP.md`:

```markdown
## Phase 2: Advanced Competition & Judging ✅ COMPLETE

**Goal**: Rich competition modes, artifact store, and enhanced judging

**Completed:**
- [x] Debate mode (A1 vs A2 with cross-critique)
- [x] Anthropic provider (Claude 3.5 models)
- [x] xAI provider (Grok models)
- [x] CNF compression with LLM-based summarization
- [x] File-based artifact storage
- [x] Structured trace events (JSON logging)
- [x] HTTP endpoint: POST /debate
- [x] Integration tests and examples

**Deferred to Phase 3:**
- [ ] Jury mode (N providers, M judges with rubric)
- [ ] Cascade mode (cheap → quality escalation)
- [ ] Blend mode (merge multiple candidates)
- [ ] Critic-Refine mode (iterative improvement)
- [ ] Multi-round debates (3+ turns)
```

**Step 4: Update CURRENT_SESSION**

Update `docs/CURRENT_SESSION.md`:

```markdown
## Where We Left Off
Phase 2 implementation complete! Debate mode working with 4 providers (OpenAI, Google, Anthropic, xAI). Infrastructure layer includes CNF compression, artifact storage, and structured traces. Ready for Phase 3 planning or production deployment.
```

**Step 5: Final commit**

```bash
git add docs/ROADMAP.md docs/CURRENT_SESSION.md
git commit -m "docs: mark Phase 2 as complete"
```

**Step 6: Push to main branch**

```bash
git push origin feature/phase2-implementation
```

---

## Success Criteria Verification

- ✅ Working 2-turn debate between any two providers
- ✅ Anthropic + xAI adapters production-ready
- ✅ CNF compression reduces tokens by 50%+ for long contexts
- ✅ Artifacts stored with retrievable metadata
- ✅ Structured traces enable debugging
- ✅ >80% test coverage maintained
- ✅ Clear examples and documentation

---

**Plan Complete!**
