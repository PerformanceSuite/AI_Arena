# Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build foundation for AI Arena - CNF system, 4 provider adapters, pluggable judging, and HTTP/MCP/NATS interfaces

**Architecture:** Three-layer system with CNF core (provider-agnostic conversation format), plugin-based provider adapters (OpenAI, Anthropic, Google, Local), and pluggable judge system (heuristic + LLM). All state lives in CNF for easy testing.

**Tech Stack:** TypeScript, Node.js, Vitest, OpenAI SDK, Anthropic SDK, Google Generative AI SDK, YAML config, JSON Schema validation

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore` (update)
- Create: `vitest.config.ts`
- Create: `.env.example`

**Step 1: Initialize package.json**

```bash
pnpm init
```

**Step 2: Install dependencies**

```bash
pnpm add @anthropic-ai/sdk @google/generative-ai openai yaml zod
pnpm add -D typescript @types/node tsx vitest @vitest/ui
pnpm add -D @types/js-yaml
```

**Step 3: Create tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/mocks/**', 'dist/**']
    }
  }
});
```

**Step 5: Update .gitignore**

Append to `.gitignore`:
```
# Build outputs
dist/
*.tsbuildinfo

# Dependencies
node_modules/

# Environment
.env
.env.local

# Test outputs
coverage/

# Editor
.vscode/
.idea/

# OS
.DS_Store
```

**Step 6: Create .env.example**

Create `.env.example`:
```bash
# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Optional
NATS_URL=nats://127.0.0.1:4222
```

**Step 7: Add package.json scripts**

Update `package.json` to add:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:smoke": "tsx scripts/smoke.ts"
  },
  "type": "module"
}
```

**Step 8: Commit project scaffolding**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "chore: initialize Phase 1 project structure"
```

---

## Task 2: CNF Schema & Types

**Files:**
- Create: `src/cnf/types.ts`
- Create: `src/cnf/schema.ts`
- Create: `src/cnf/types.test.ts`

**Step 1: Write failing test for CNF validation**

Create `src/cnf/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateCNF } from './schema';

describe('CNF Schema', () => {
  it('validates a minimal valid CNF', () => {
    const cnf = {
      sessionId: 'test-123',
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(true);
  });

  it('rejects CNF without sessionId', () => {
    const cnf = {
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('sessionId');
  });

  it('rejects CNF with invalid role', () => {
    const cnf = {
      sessionId: 'test-123',
      messages: [{ role: 'invalid', content: 'Hello' }]
    };

    const result = validateCNF(cnf);
    expect(result.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/cnf/types.test.ts
```
Expected: FAIL - `validateCNF` not defined

**Step 3: Create CNF TypeScript types**

Create `src/cnf/types.ts`:
```typescript
export interface CNF {
  sessionId: string;
  messages: Message[];
  artifacts?: Artifact[];
  scratch?: Record<string, any>;
  tags?: string[];
  locale?: string;
  timezone?: string;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  timestamp?: string;
  attachments?: Attachment[];
  citations?: string[];
  meta?: Record<string, any>;
}

export interface Attachment {
  kind: 'file' | 'image' | 'audio' | 'video' | 'url';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}

export interface Artifact {
  id: string;
  kind: 'doc' | 'code' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}
```

**Step 4: Create CNF validation schema**

Create `src/cnf/schema.ts`:
```typescript
import { z } from 'zod';
import type { CNF } from './types';

const MessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  timestamp: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  citations: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional()
});

const CNFSchema = z.object({
  sessionId: z.string(),
  messages: z.array(MessageSchema),
  artifacts: z.array(z.any()).optional(),
  scratch: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional()
});

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: CNF;
}

export function validateCNF(data: unknown): ValidationResult {
  const result = CNFSchema.safeParse(data);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.errors.map(e =>
    e.path.length > 0 ? e.path.join('.') : e.message
  );

  return { valid: false, errors };
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm test src/cnf/types.test.ts
```
Expected: PASS (3 tests)

**Step 6: Commit CNF types and schema**

```bash
git add src/cnf/
git commit -m "feat: add CNF types and Zod validation schema"
```

---

## Task 3: CNF Transform Functions

**Files:**
- Create: `src/cnf/transform.ts`
- Create: `src/cnf/transform.test.ts`

**Step 1: Write failing tests for CNF transforms**

Create `src/cnf/transform.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { appendMessage, extractLastMessage, redactSecrets } from './transform';
import type { CNF } from './types';

describe('CNF Transforms', () => {
  const baseCNF: CNF = {
    sessionId: 'test-123',
    messages: [
      { role: 'user', content: 'Hello' }
    ]
  };

  describe('appendMessage', () => {
    it('appends assistant message to CNF', () => {
      const result = appendMessage(baseCNF, 'assistant', 'Hi there!');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi there!'
      });
    });

    it('preserves existing CNF properties', () => {
      const cnfWithTags = { ...baseCNF, tags: ['test'] };
      const result = appendMessage(cnfWithTags, 'user', 'Question?');

      expect(result.tags).toEqual(['test']);
      expect(result.sessionId).toBe('test-123');
    });
  });

  describe('extractLastMessage', () => {
    it('extracts the last message content', () => {
      const cnf = appendMessage(baseCNF, 'assistant', 'Response');
      const last = extractLastMessage(cnf);

      expect(last).toBe('Response');
    });

    it('returns empty string for CNF with no messages', () => {
      const emptyCNF: CNF = { sessionId: 'test', messages: [] };
      const last = extractLastMessage(emptyCNF);

      expect(last).toBe('');
    });
  });

  describe('redactSecrets', () => {
    it('redacts API keys from message content', () => {
      const cnf: CNF = {
        sessionId: 'test',
        messages: [
          { role: 'user', content: 'My key is sk-proj-abc123xyz' }
        ]
      };

      const result = redactSecrets(cnf);
      expect(result.messages[0].content).toContain('[REDACTED]');
      expect(result.messages[0].content).not.toContain('sk-proj-abc123xyz');
    });

    it('redacts multiple secret patterns', () => {
      const cnf: CNF = {
        sessionId: 'test',
        messages: [
          {
            role: 'user',
            content: 'OpenAI: sk-abc123, Anthropic: sk-ant-xyz789'
          }
        ]
      };

      const result = redactSecrets(cnf);
      expect(result.messages[0].content).toContain('[REDACTED]');
      expect(result.messages[0].content).not.toContain('sk-abc123');
      expect(result.messages[0].content).not.toContain('sk-ant-xyz789');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/cnf/transform.test.ts
```
Expected: FAIL - functions not defined

**Step 3: Implement CNF transform functions**

Create `src/cnf/transform.ts`:
```typescript
import type { CNF, Message } from './types';

/**
 * Append a message to CNF (immutable)
 */
export function appendMessage(
  cnf: CNF,
  role: Message['role'],
  content: string,
  meta?: Message['meta']
): CNF {
  const newMessage: Message = {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...(meta && { meta })
  };

  return {
    ...cnf,
    messages: [...cnf.messages, newMessage]
  };
}

/**
 * Extract content of last message
 */
export function extractLastMessage(cnf: CNF): string {
  if (cnf.messages.length === 0) return '';
  return cnf.messages[cnf.messages.length - 1].content;
}

/**
 * Redact secrets from CNF using regex patterns
 */
export function redactSecrets(cnf: CNF): CNF {
  const secretPatterns = [
    /sk-[a-zA-Z0-9-_]{20,}/g,        // OpenAI keys
    /sk-ant-[a-zA-Z0-9-_]{20,}/g,    // Anthropic keys
    /AIza[a-zA-Z0-9_-]{35}/g,        // Google API keys
    /xai-[a-zA-Z0-9]{32,}/g,         // xAI keys
  ];

  function redactText(text: string): string {
    let redacted = text;
    for (const pattern of secretPatterns) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  return {
    ...cnf,
    messages: cnf.messages.map(msg => ({
      ...msg,
      content: redactText(msg.content)
    }))
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/cnf/transform.test.ts
```
Expected: PASS (7 tests)

**Step 5: Commit CNF transforms**

```bash
git add src/cnf/transform.ts src/cnf/transform.test.ts
git commit -m "feat: add CNF transform functions (append, extract, redact)"
```

---

## Task 4: Configuration Loader

**Files:**
- Create: `src/util/config.ts`
- Create: `src/util/config.test.ts`
- Create: `arena.config.yaml`

**Step 1: Write failing test for config loader**

Create `src/util/config.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';
import { writeFileSync, unlinkSync } from 'fs';

describe('Config Loader', () => {
  const testConfigPath = 'test-arena.config.yaml';

  beforeEach(() => {
    // Set test env vars
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    try { unlinkSync(testConfigPath); } catch {}
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('loads config with env var substitution', () => {
    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
    models:
      - id: gpt-4o
  anthropic:
    apiKey: \${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
`);

    const config = loadConfig(testConfigPath);

    expect(config.providers.openai.apiKey).toBe('test-openai-key');
    expect(config.providers.anthropic.apiKey).toBe('test-anthropic-key');
    expect(config.providers.openai.models).toHaveLength(1);
  });

  it('throws error if required env var missing', () => {
    delete process.env.OPENAI_API_KEY;

    writeFileSync(testConfigPath, `
providers:
  openai:
    apiKey: \${OPENAI_API_KEY}
`);

    expect(() => loadConfig(testConfigPath)).toThrow('OPENAI_API_KEY');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/util/config.test.ts
```
Expected: FAIL - `loadConfig` not defined

**Step 3: Implement config loader**

Create `src/util/config.ts`:
```typescript
import { readFileSync } from 'fs';
import yaml from 'yaml';

export interface ModelSpec {
  id: string;
  maxTokens?: number;
}

export interface ProviderConfig {
  apiKey: string;
  endpoint?: string;
  models: ModelSpec[];
}

export interface ArenaConfig {
  providers: Record<string, ProviderConfig>;
  server?: {
    http?: { port: number };
    nats?: { url: string };
  };
}

/**
 * Load arena.config.yaml with environment variable substitution
 */
export function loadConfig(path: string = 'arena.config.yaml'): ArenaConfig {
  const content = readFileSync(path, 'utf-8');

  // Substitute ${VAR} with process.env.VAR
  const substituted = content.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
    return value;
  });

  const config = yaml.parse(substituted) as ArenaConfig;
  return config;
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/util/config.test.ts
```
Expected: PASS (2 tests)

**Step 5: Create default arena.config.yaml**

Create `arena.config.yaml`:
```yaml
providers:
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      - id: gpt-4o
      - id: gpt-4o-mini

  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
      - id: claude-3-5-haiku-20241022

  google:
    apiKey: ${GOOGLE_API_KEY}
    models:
      - id: gemini-1.5-pro
      - id: gemini-1.5-flash

  local:
    endpoint: http://127.0.0.1:4000
    models:
      - id: llama-3.1-8b

server:
  http:
    port: 3457
  nats:
    url: ${NATS_URL:-nats://127.0.0.1:4222}
```

**Step 6: Commit config loader**

```bash
git add src/util/ arena.config.yaml
git commit -m "feat: add YAML config loader with env var substitution"
```

---

## Task 5: Provider Adapter Interface

**Files:**
- Create: `src/adapters/types.ts`
- Create: `tests/mocks/mock-adapter.ts`
- Create: `tests/mocks/mock-adapter.test.ts`

**Step 1: Write test for mock adapter**

Create `tests/mocks/mock-adapter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock-adapter';
import type { CNF } from '../../src/cnf/types';

describe('MockAdapter', () => {
  it('returns configured responses in order', async () => {
    const mock = new MockAdapter();
    mock.queueResponse('First response');
    mock.queueResponse('Second response');

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result1 = await mock.chat({ cnf, targetModel: 'mock' });
    const result2 = await mock.chat({ cnf, targetModel: 'mock' });

    expect(result1.outputText).toBe('First response');
    expect(result2.outputText).toBe('Second response');
  });

  it('appends assistant message to CNF', async () => {
    const mock = new MockAdapter();
    mock.queueResponse('Test response');

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = await mock.chat({ cnf, targetModel: 'mock' });

    expect(result.updatedCNF.messages).toHaveLength(2);
    expect(result.updatedCNF.messages[1].role).toBe('assistant');
    expect(result.updatedCNF.messages[1].content).toBe('Test response');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/mocks/mock-adapter.test.ts
```
Expected: FAIL - MockAdapter not defined

**Step 3: Create adapter interface**

Create `src/adapters/types.ts`:
```typescript
import type { CNF, ToolCall, TokenUsage } from '../cnf/types';

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatArgs {
  cnf: CNF;
  targetModel: string;
  system?: string;
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  updatedCNF: CNF;
  outputText?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export interface ProviderAdapter {
  name: string;
  configure(config: { apiKey: string; endpoint?: string }): Promise<void>;
  listModels(): Promise<string[]>;
  chat(args: ChatArgs): Promise<ChatResult>;
}
```

**Step 4: Implement mock adapter**

Create `tests/mocks/mock-adapter.ts`:
```typescript
import type { ProviderAdapter, ChatArgs, ChatResult } from '../../src/adapters/types';
import { appendMessage } from '../../src/cnf/transform';

export class MockAdapter implements ProviderAdapter {
  name = 'mock';
  private responses: string[] = [];
  private configured = false;

  async configure(): Promise<void> {
    this.configured = true;
  }

  async listModels(): Promise<string[]> {
    return ['mock-model-1', 'mock-model-2'];
  }

  queueResponse(text: string): void {
    this.responses.push(text);
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    const responseText = this.responses.shift() || 'default mock response';

    const updatedCNF = appendMessage(args.cnf, 'assistant', responseText);

    return {
      updatedCNF,
      outputText: responseText,
      usage: { prompt: 10, completion: 20, total: 30 }
    };
  }
}
```

**Step 5: Run test to verify it passes**

```bash
pnpm test tests/mocks/mock-adapter.test.ts
```
Expected: PASS (2 tests)

**Step 6: Commit adapter interface and mock**

```bash
git add src/adapters/types.ts tests/mocks/
git commit -m "feat: add ProviderAdapter interface and MockAdapter for testing"
```

---

## Task 6: OpenAI Adapter

**Files:**
- Create: `src/adapters/openai.ts`
- Create: `src/adapters/openai.test.ts`

**Step 1: Write failing tests for OpenAI adapter**

Create `src/adapters/openai.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIAdapter } from './openai';
import type { CNF } from '../cnf/types';

// Mock the OpenAI SDK
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn()
      }
    };
  }
}));

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
  });

  it('converts CNF to OpenAI format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    // Mock OpenAI response
    const mockCreate = vi.mocked(
      (adapter as any).client.chat.completions.create
    );
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'gpt-4o' });

    expect(result.outputText).toBe('Hello!');
    expect(result.updatedCNF.messages).toHaveLength(2);
    expect(result.usage?.total).toBe(15);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/adapters/openai.test.ts
```
Expected: FAIL - OpenAIAdapter not defined

**Step 3: Implement OpenAI adapter**

Create `src/adapters/openai.ts`:
```typescript
import OpenAI from 'openai';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF, Message } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class OpenAIAdapter implements ProviderAdapter {
  name = 'openai';
  private client?: OpenAI;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new OpenAI({ apiKey: config.apiKey });
  }

  async listModels(): Promise<string[]> {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('OpenAI adapter not configured');
    }

    // Convert CNF messages to OpenAI format
    const messages = args.cnf.messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content
    }));

    // Add system message if provided
    if (args.system) {
      messages.unshift({ role: 'system', content: args.system });
    }

    const response = await this.client.chat.completions.create({
      model: args.targetModel,
      messages: messages as any,
      temperature: args.temperature ?? 0.7,
      max_tokens: args.maxTokens
    });

    const assistantMessage = response.choices[0]?.message;
    const content = assistantMessage?.content || '';

    const updatedCNF = appendMessage(args.cnf, 'assistant', content);

    return {
      updatedCNF,
      outputText: content,
      usage: response.usage ? {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      } : undefined
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/adapters/openai.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit OpenAI adapter**

```bash
git add src/adapters/openai.ts src/adapters/openai.test.ts
git commit -m "feat: add OpenAI adapter with CNF translation"
```

---

## Task 7: Anthropic Adapter

**Files:**
- Create: `src/adapters/anthropic.ts`
- Create: `src/adapters/anthropic.test.ts`

**Step 1: Write failing tests for Anthropic adapter**

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
  });

  it('converts CNF to Anthropic format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.mocked((adapter as any).client.messages.create);
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      usage: { input_tokens: 10, output_tokens: 8 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'claude-3-5-sonnet-20241022' });

    expect(result.outputText).toBe('Hello from Claude!');
    expect(result.usage?.total).toBe(18);
  });

  it('extracts system message from CNF', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockCreate = vi.mocked((adapter as any).client.messages.create);
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Response' }],
      usage: { input_tokens: 10, output_tokens: 5 }
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' }
      ]
    };

    await adapter.chat({ cnf, targetModel: 'claude-3-5-sonnet-20241022' });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('You are helpful');
    expect(callArgs.messages).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/adapters/anthropic.test.ts
```
Expected: FAIL - AnthropicAdapter not defined

**Step 3: Implement Anthropic adapter**

Create `src/adapters/anthropic.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';
  private client?: Anthropic;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('Anthropic adapter not configured');
    }

    // Extract system messages (Anthropic uses separate system param)
    const systemMessages = args.cnf.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    const system = args.system || systemMessages || undefined;

    // Convert CNF messages to Anthropic format (exclude system messages)
    const messages = args.cnf.messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

    const response = await this.client.messages.create({
      model: args.targetModel,
      max_tokens: args.maxTokens ?? 4096,
      temperature: args.temperature ?? 0.7,
      system,
      messages: messages as any
    });

    const textContent = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    const updatedCNF = appendMessage(args.cnf, 'assistant', textContent);

    return {
      updatedCNF,
      outputText: textContent,
      usage: response.usage ? {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/adapters/anthropic.test.ts
```
Expected: PASS (3 tests)

**Step 5: Commit Anthropic adapter**

```bash
git add src/adapters/anthropic.ts src/adapters/anthropic.test.ts
git commit -m "feat: add Anthropic adapter with system message extraction"
```

---

## Task 8: Google Adapter

**Files:**
- Create: `src/adapters/google.ts`
- Create: `src/adapters/google.test.ts`

**Step 1: Write failing tests for Google adapter**

Create `src/adapters/google.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleAdapter } from './google';
import type { CNF } from '../cnf/types';

// Mock Google SDK
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogle {
    getGenerativeModel = vi.fn(() => ({
      generateContent: vi.fn()
    }));
  }
}));

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;

  beforeEach(() => {
    adapter = new GoogleAdapter();
  });

  it('configures with API key', async () => {
    await adapter.configure({ apiKey: 'test-key' });
    const models = await adapter.listModels();

    expect(models).toContain('gemini-1.5-pro');
    expect(models).toContain('gemini-1.5-flash');
  });

  it('converts CNF to Google format and back', async () => {
    await adapter.configure({ apiKey: 'test-key' });

    const mockGenerate = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Hello from Gemini!',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18
        }
      }
    });

    (adapter as any).client.getGenerativeModel.mockReturnValue({
      generateContent: mockGenerate
    });

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hi' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'gemini-1.5-pro' });

    expect(result.outputText).toBe('Hello from Gemini!');
    expect(result.usage?.total).toBe(18);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/adapters/google.test.ts
```
Expected: FAIL - GoogleAdapter not defined

**Step 3: Implement Google adapter**

Create `src/adapters/google.ts`:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class GoogleAdapter implements ProviderAdapter {
  name = 'google';
  private client?: GoogleGenerativeAI;

  async configure(config: { apiKey: string }): Promise<void> {
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro'
    ];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    if (!this.client) {
      throw new Error('Google adapter not configured');
    }

    const model = this.client.getGenerativeModel({
      model: args.targetModel
    });

    // Convert CNF to Google's format (chat history)
    const history = args.cnf.messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const lastMessage = args.cnf.messages[args.cnf.messages.length - 1];

    // Build prompt with system message if provided
    let prompt = lastMessage.content;
    if (args.system) {
      prompt = `${args.system}\n\n${prompt}`;
    }

    const result = await model.generateContent({
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ]
    });

    const response = result.response;
    const text = response.text();

    const updatedCNF = appendMessage(args.cnf, 'assistant', text);

    const usage = response.usageMetadata;

    return {
      updatedCNF,
      outputText: text,
      usage: usage ? {
        prompt: usage.promptTokenCount || 0,
        completion: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0
      } : undefined
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/adapters/google.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit Google adapter**

```bash
git add src/adapters/google.ts src/adapters/google.test.ts
git commit -m "feat: add Google Gemini adapter with chat history support"
```

---

## Task 9: Local Adapter (LiteLLM/Ollama)

**Files:**
- Create: `src/adapters/local.ts`
- Create: `src/adapters/local.test.ts`

**Step 1: Write failing tests for Local adapter**

Create `src/adapters/local.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalAdapter } from './local';
import type { CNF } from '../cnf/types';

global.fetch = vi.fn();

describe('LocalAdapter', () => {
  let adapter: LocalAdapter;

  beforeEach(() => {
    adapter = new LocalAdapter();
    vi.clearAllMocks();
  });

  it('configures with endpoint', async () => {
    await adapter.configure({
      apiKey: 'not-used',
      endpoint: 'http://localhost:4000'
    });

    const models = await adapter.listModels();
    expect(models).toContain('local');
  });

  it('makes OpenAI-compatible request to local endpoint', async () => {
    await adapter.configure({
      apiKey: 'dummy',
      endpoint: 'http://localhost:4000'
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { role: 'assistant', content: 'Local response' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
      })
    } as any);

    const cnf: CNF = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const result = await adapter.chat({ cnf, targetModel: 'llama-3.1-8b' });

    expect(result.outputText).toBe('Local response');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/adapters/local.test.ts
```
Expected: FAIL - LocalAdapter not defined

**Step 3: Implement Local adapter**

Create `src/adapters/local.ts`:
```typescript
import type { ProviderAdapter, ChatArgs, ChatResult } from './types';
import type { CNF } from '../cnf/types';
import { appendMessage } from '../cnf/transform';

export class LocalAdapter implements ProviderAdapter {
  name = 'local';
  private endpoint: string = 'http://127.0.0.1:4000';

  async configure(config: { apiKey: string; endpoint?: string }): Promise<void> {
    if (config.endpoint) {
      this.endpoint = config.endpoint;
    }
  }

  async listModels(): Promise<string[]> {
    return ['local'];
  }

  async chat(args: ChatArgs): Promise<ChatResult> {
    // LiteLLM/Ollama use OpenAI-compatible API
    const messages = args.cnf.messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content
    }));

    if (args.system) {
      messages.unshift({ role: 'system', content: args.system });
    }

    const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: args.targetModel,
        messages,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`Local adapter error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    const updatedCNF = appendMessage(args.cnf, 'assistant', content);

    return {
      updatedCNF,
      outputText: content,
      usage: data.usage ? {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens
      } : undefined
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/adapters/local.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit Local adapter**

```bash
git add src/adapters/local.ts src/adapters/local.test.ts
git commit -m "feat: add Local adapter for LiteLLM/Ollama (OpenAI-compatible)"
```

---

## Task 10: Provider Registry

**Files:**
- Create: `src/adapters/index.ts`
- Create: `src/adapters/registry.test.ts`

**Step 1: Write failing tests for registry**

Create `src/adapters/registry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getProvider, getAllProviders, configureProviders } from './index';
import type { ArenaConfig } from '../util/config';

describe('Provider Registry', () => {
  it('gets provider by name', () => {
    const provider = getProvider('openai');
    expect(provider.name).toBe('openai');
  });

  it('throws error for unknown provider', () => {
    expect(() => getProvider('unknown')).toThrow('Unknown provider');
  });

  it('returns all registered providers', () => {
    const providers = getAllProviders();
    const names = providers.map(p => p.name);

    expect(names).toContain('openai');
    expect(names).toContain('anthropic');
    expect(names).toContain('google');
    expect(names).toContain('local');
  });

  it('configures all providers from config', async () => {
    const config: ArenaConfig = {
      providers: {
        openai: { apiKey: 'test-openai', models: [] },
        anthropic: { apiKey: 'test-anthropic', models: [] }
      }
    };

    await configureProviders(config);

    // Should not throw
    const openai = getProvider('openai');
    const anthropic = getProvider('anthropic');

    expect(openai).toBeDefined();
    expect(anthropic).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/adapters/registry.test.ts
```
Expected: FAIL - functions not defined

**Step 3: Implement provider registry**

Create `src/adapters/index.ts`:
```typescript
import type { ProviderAdapter } from './types';
import type { ArenaConfig } from '../util/config';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { LocalAdapter } from './local';

const registry = new Map<string, ProviderAdapter>();

// Register all providers
registry.set('openai', new OpenAIAdapter());
registry.set('anthropic', new AnthropicAdapter());
registry.set('google', new GoogleAdapter());
registry.set('local', new LocalAdapter());

/**
 * Get provider adapter by name
 */
export function getProvider(name: string): ProviderAdapter {
  const provider = registry.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

/**
 * Get all registered providers
 */
export function getAllProviders(): ProviderAdapter[] {
  return Array.from(registry.values());
}

/**
 * Configure all providers from config
 */
export async function configureProviders(config: ArenaConfig): Promise<void> {
  const promises = Object.entries(config.providers).map(async ([name, cfg]) => {
    try {
      const provider = getProvider(name);
      await provider.configure(cfg);
    } catch (error) {
      console.warn(`Failed to configure provider ${name}:`, error);
    }
  });

  await Promise.all(promises);
}

// Re-export types
export type { ProviderAdapter, ChatArgs, ChatResult } from './types';
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/adapters/registry.test.ts
```
Expected: PASS (4 tests)

**Step 5: Commit provider registry**

```bash
git add src/adapters/index.ts src/adapters/registry.test.ts
git commit -m "feat: add provider registry with configuration"
```

---

## Task 11: Heuristic Judge

**Files:**
- Create: `src/arena/types.ts`
- Create: `src/arena/heuristic-judge.ts`
- Create: `src/arena/heuristic-judge.test.ts`

**Step 1: Write failing tests for heuristic judge**

Create `src/arena/heuristic-judge.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { HeuristicJudge } from './heuristic-judge';

describe('HeuristicJudge', () => {
  const judge = new HeuristicJudge();

  describe('length scoring', () => {
    it('penalizes very short responses', async () => {
      const score = await judge.score({
        id: 'test',
        text: 'Ok',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { length: 1.0 }
      });

      expect(score.total).toBeLessThan(0.5);
    });

    it('gives high score to adequate length', async () => {
      const score = await judge.score({
        id: 'test',
        text: 'This is a reasonably detailed response that provides good information and context for the user.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { length: 1.0 }
      });

      expect(score.total).toBeGreaterThan(0.7);
    });
  });

  describe('keyword matching', () => {
    it('scores higher when keywords present', async () => {
      const withKeywords = await judge.score({
        id: 'test',
        text: 'Install using npm install. Check the documentation for usage examples.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { keywords: 1.0 },
        keywords: ['install', 'usage', 'documentation']
      });

      const withoutKeywords = await judge.score({
        id: 'test',
        text: 'You can set it up easily and refer to the guide.',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { keywords: 1.0 },
        keywords: ['install', 'usage', 'documentation']
      });

      expect(withKeywords.total).toBeGreaterThan(withoutKeywords.total);
    });
  });

  describe('structure checks', () => {
    it('scores higher for markdown formatting', async () => {
      const formatted = await judge.score({
        id: 'test',
        text: '# Title\n\n## Section\n\n- Item 1\n- Item 2\n\n```js\ncode();\n```',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { structure: 1.0 }
      });

      const unformatted = await judge.score({
        id: 'test',
        text: 'Title Section Item 1 Item 2 code()',
        providerName: 'test',
        modelName: 'test'
      }, {
        weights: { structure: 1.0 }
      });

      expect(formatted.total).toBeGreaterThan(unformatted.total);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/arena/heuristic-judge.test.ts
```
Expected: FAIL - types and judge not defined

**Step 3: Create arena types**

Create `src/arena/types.ts`:
```typescript
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
```

**Step 4: Implement heuristic judge**

Create `src/arena/heuristic-judge.ts`:
```typescript
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

    // Ideal range (100-2000 chars)
    if (length >= 100 && length <= 2000) return 1.0;

    // Slightly penalize very long
    if (length > 2000) return 0.8;

    // Moderate length
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
```

**Step 5: Run test to verify it passes**

```bash
pnpm test src/arena/heuristic-judge.test.ts
```
Expected: PASS (5 tests)

**Step 6: Commit heuristic judge**

```bash
git add src/arena/
git commit -m "feat: add heuristic judge with length, keyword, structure scoring"
```

---

## Task 12: LLM Judge

**Files:**
- Create: `src/arena/llm-judge.ts`
- Create: `src/arena/llm-judge.test.ts`

**Step 1: Write failing tests for LLM judge**

Create `src/arena/llm-judge.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { LLMJudge } from './llm-judge';
import { MockAdapter } from '../../tests/mocks/mock-adapter';

describe('LLMJudge', () => {
  it('uses LLM to score candidate', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.queueResponse(JSON.stringify({
      total: 0.85,
      breakdown: { correctness: 0.9, style: 0.8 },
      reasoning: 'Good response with clear explanations'
    }));

    const judge = new LLMJudge(mockAdapter, 'mock-model');

    const score = await judge.score({
      id: 'test',
      text: 'This is a test response',
      providerName: 'test',
      modelName: 'test'
    }, {
      weights: { correctness: 0.6, style: 0.4 }
    });

    expect(score.total).toBe(0.85);
    expect(score.reasoning).toContain('Good response');
  });

  it('handles malformed JSON from LLM', async () => {
    const mockAdapter = new MockAdapter();
    mockAdapter.queueResponse('Not valid JSON');

    const judge = new LLMJudge(mockAdapter, 'mock-model');

    const score = await judge.score({
      id: 'test',
      text: 'Test',
      providerName: 'test',
      modelName: 'test'
    }, {
      weights: { correctness: 1.0 }
    });

    // Should return fallback score
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/arena/llm-judge.test.ts
```
Expected: FAIL - LLMJudge not defined

**Step 3: Implement LLM judge**

Create `src/arena/llm-judge.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/arena/llm-judge.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit LLM judge**

```bash
git add src/arena/llm-judge.ts src/arena/llm-judge.test.ts
git commit -m "feat: add LLM judge with structured JSON scoring"
```

---

## Task 13: Competition Coordinator (Round-Robin)

**Files:**
- Create: `src/arena/competition.ts`
- Create: `src/arena/competition.test.ts`

**Step 1: Write failing tests for competition**

Create `src/arena/competition.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { compete } from './competition';
import { MockAdapter } from '../../tests/mocks/mock-adapter';
import { HeuristicJudge } from './heuristic-judge';
import type { CNF } from '../cnf/types';

describe('Competition', () => {
  let mockA: MockAdapter;
  let mockB: MockAdapter;
  let cnf: CNF;

  beforeEach(() => {
    mockA = new MockAdapter();
    mockB = new MockAdapter();

    cnf = {
      sessionId: 'test',
      messages: [{ role: 'user', content: 'Write a README' }]
    };
  });

  it('runs round-robin and selects winner', async () => {
    mockA.queueResponse('# Project\n\nBasic readme with minimal info.');
    mockB.queueResponse('# Awesome Project\n\n## Installation\n\nRun `npm install`\n\n## Usage\n\nSee docs for details.\n\n## License\n\nMIT');

    const result = await compete(cnf, {
      providers: [
        { adapter: mockA, model: 'mock-a' },
        { adapter: mockB, model: 'mock-b' }
      ],
      mode: 'round-robin',
      judges: [new HeuristicJudge()],
      rubric: {
        weights: { structure: 0.5, length: 0.5 }
      }
    });

    expect(result.winner).toBeDefined();
    expect(result.winner.id).toContain('mock-b');
    expect(result.leaderboard).toHaveLength(2);
    expect(result.leaderboard[0].score).toBeGreaterThan(result.leaderboard[1].score);
  });

  it('handles provider failures gracefully', async () => {
    mockA.queueResponse('Good response');
    // mockB will throw because no response queued

    const result = await compete(cnf, {
      providers: [
        { adapter: mockA, model: 'mock-a' },
        { adapter: mockB, model: 'mock-b' }
      ],
      mode: 'round-robin',
      judges: [new HeuristicJudge()],
      rubric: {
        weights: { length: 1.0 }
      }
    });

    // Should still have winner from successful provider
    expect(result.winner).toBeDefined();
    expect(result.leaderboard.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/arena/competition.test.ts
```
Expected: FAIL - `compete` not defined

**Step 3: Implement competition coordinator**

Create `src/arena/competition.ts`:
```typescript
import type { CNF } from '../cnf/types';
import type { ProviderAdapter } from '../adapters/types';
import type { Judge, Candidate, RubricSpec, Score } from './types';

export interface CompetitionSpec {
  providers: Array<{ adapter: ProviderAdapter; model: string }>;
  mode: 'round-robin' | 'cascade';
  judges: Judge[];
  rubric: RubricSpec;
  system?: string;
}

export interface CompetitionResult {
  winner: Candidate & { score: number };
  leaderboard: Array<Candidate & { score: number }>;
  traces: Array<{
    candidate: Candidate;
    scores: Record<string, Score>;
  }>;
}

/**
 * Run AI competition with multiple providers
 */
export async function compete(
  cnf: CNF,
  spec: CompetitionSpec
): Promise<CompetitionResult> {
  if (spec.mode === 'round-robin') {
    return roundRobin(cnf, spec);
  }

  throw new Error(`Unsupported competition mode: ${spec.mode}`);
}

async function roundRobin(
  cnf: CNF,
  spec: CompetitionSpec
): Promise<CompetitionResult> {
  // Generate responses from all providers in parallel
  const candidatePromises = spec.providers.map(async ({ adapter, model }) => {
    try {
      const result = await adapter.chat({
        cnf,
        targetModel: model,
        system: spec.system
      });

      const candidate: Candidate = {
        id: `${adapter.name}:${model}`,
        text: result.outputText || '',
        providerName: adapter.name,
        modelName: model,
        usage: result.usage
      };

      return candidate;
    } catch (error) {
      console.error(`Provider ${adapter.name} failed:`, error);
      return null;
    }
  });

  const candidates = (await Promise.all(candidatePromises))
    .filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) {
    throw new Error('All providers failed');
  }

  // Score each candidate with all judges
  const traces = await Promise.all(
    candidates.map(async (candidate) => {
      const judgeScores: Record<string, Score> = {};

      for (const judge of spec.judges) {
        try {
          judgeScores[judge.name] = await judge.score(candidate, spec.rubric);
        } catch (error) {
          console.error(`Judge ${judge.name} failed:`, error);
        }
      }

      return { candidate, scores: judgeScores };
    })
  );

  // Calculate final scores with judge weights
  const judgeWeights = spec.rubric.judgeWeights || {};
  const defaultWeight = 1.0 / spec.judges.length;

  const leaderboard = traces.map(({ candidate, scores }) => {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [judgeName, score] of Object.entries(scores)) {
      const weight = judgeWeights[judgeName] ?? defaultWeight;
      totalScore += score.total * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    return { ...candidate, score: finalScore };
  });

  // Sort by score descending
  leaderboard.sort((a, b) => b.score - a.score);

  return {
    winner: leaderboard[0],
    leaderboard,
    traces
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/arena/competition.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit competition coordinator**

```bash
git add src/arena/competition.ts src/arena/competition.test.ts
git commit -m "feat: add round-robin competition with parallel execution"
```

---

## Task 14: Core Operations Layer

**Files:**
- Create: `src/core/operations.ts`
- Create: `src/core/operations.test.ts`

**Step 1: Write failing tests for operations**

Create `src/core/operations.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { invokeOperation, competeOperation } from './operations';
import { MockAdapter } from '../../tests/mocks/mock-adapter';
import { configureProviders, getProvider } from '../adapters/index';

describe('Core Operations', () => {
  beforeEach(async () => {
    // Use mock adapter for tests
    await configureProviders({
      providers: {
        mock: { apiKey: 'test', models: [] }
      }
    });
  });

  describe('invokeOperation', () => {
    it('invokes single provider and returns CNF', async () => {
      const mock = getProvider('mock') as MockAdapter;
      mock.queueResponse('Test response');

      const result = await invokeOperation({
        cnf: {
          sessionId: 'test',
          messages: [{ role: 'user', content: 'Hello' }]
        },
        provider: 'mock',
        model: 'mock-model'
      });

      expect(result.cnf.messages).toHaveLength(2);
      expect(result.outputText).toBe('Test response');
    });
  });

  describe('competeOperation', () => {
    it('runs competition and returns winner', async () => {
      const mockA = new MockAdapter();
      const mockB = new MockAdapter();

      mockA.queueResponse('Short');
      mockB.queueResponse('This is a much longer and more detailed response with better structure.');

      const result = await competeOperation({
        cnf: {
          sessionId: 'test',
          messages: [{ role: 'user', content: 'Explain' }]
        },
        spec: {
          providers: [
            { name: 'mock', model: 'mock-a' },
            { name: 'mock', model: 'mock-b' }
          ],
          mode: 'round-robin',
          rubric: {
            weights: { length: 1.0 }
          }
        }
      });

      expect(result.winner).toBeDefined();
      expect(result.leaderboard).toHaveLength(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test src/core/operations.test.ts
```
Expected: FAIL - operations not defined

**Step 3: Implement core operations**

Create `src/core/operations.ts`:
```typescript
import type { CNF } from '../cnf/types';
import { getProvider } from '../adapters/index';
import { compete } from '../arena/competition';
import { HeuristicJudge } from '../arena/heuristic-judge';
import { LLMJudge } from '../arena/llm-judge';
import type { RubricSpec } from '../arena/types';

export interface InvokeRequest {
  cnf: CNF;
  provider: string;
  model: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface InvokeResult {
  cnf: CNF;
  outputText?: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface CompeteRequest {
  cnf: CNF;
  spec: {
    providers: Array<{ name: string; model: string }>;
    mode: 'round-robin' | 'cascade';
    rubric: RubricSpec;
    judges?: Array<{ type: 'heuristic' | 'llm'; provider?: string; model?: string }>;
    system?: string;
  };
}

export interface CompeteResult {
  winner: {
    id: string;
    text: string;
    score: number;
    breakdown: Record<string, number>;
  };
  leaderboard: Array<{
    id: string;
    text: string;
    score: number;
  }>;
}

/**
 * Invoke single provider
 */
export async function invokeOperation(req: InvokeRequest): Promise<InvokeResult> {
  const provider = getProvider(req.provider);

  const result = await provider.chat({
    cnf: req.cnf,
    targetModel: req.model,
    system: req.system,
    temperature: req.temperature,
    maxTokens: req.maxTokens
  });

  return {
    cnf: result.updatedCNF,
    outputText: result.outputText,
    usage: result.usage
  };
}

/**
 * Run competition across multiple providers
 */
export async function competeOperation(req: CompeteRequest): Promise<CompeteResult> {
  // Build judges list
  const judges = [];

  const judgeSpecs = req.spec.judges || [{ type: 'heuristic' as const }];

  for (const judgeSpec of judgeSpecs) {
    if (judgeSpec.type === 'heuristic') {
      judges.push(new HeuristicJudge());
    } else if (judgeSpec.type === 'llm' && judgeSpec.provider && judgeSpec.model) {
      const adapter = getProvider(judgeSpec.provider);
      judges.push(new LLMJudge(adapter, judgeSpec.model));
    }
  }

  // Map provider names to adapters
  const providerSpecs = req.spec.providers.map(p => ({
    adapter: getProvider(p.name),
    model: p.model
  }));

  const result = await compete(req.cnf, {
    providers: providerSpecs,
    mode: req.spec.mode,
    judges,
    rubric: req.spec.rubric,
    system: req.spec.system
  });

  return {
    winner: {
      id: result.winner.id,
      text: result.winner.text,
      score: result.winner.score,
      breakdown: result.traces.find(t => t.candidate.id === result.winner.id)
        ?.scores.heuristic?.breakdown || {}
    },
    leaderboard: result.leaderboard.map(c => ({
      id: c.id,
      text: c.text,
      score: c.score
    }))
  };
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test src/core/operations.test.ts
```
Expected: PASS (2 tests)

**Step 5: Commit core operations**

```bash
git add src/core/
git commit -m "feat: add unified operations layer for invoke and compete"
```

---

## Task 15: HTTP API Server

**Files:**
- Create: `src/http/server.ts`
- Create: `src/http/routes.ts`
- Create: `src/http/server.test.ts`

**Step 1: Install HTTP server dependency**

```bash
pnpm add hono
pnpm add -D @types/node
```

**Step 2: Write failing tests for HTTP server**

Create `src/http/server.test.ts`:
```typescript
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
```

**Step 3: Run test to verify it fails**

```bash
pnpm test src/http/server.test.ts
```
Expected: FAIL - server functions not defined

**Step 4: Implement HTTP routes**

Create `src/http/routes.ts`:
```typescript
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
```

**Step 5: Implement HTTP server**

Create `src/http/server.ts`:
```typescript
import { serve } from '@hono/node-server';
import { app } from './routes';

let server: any;

export interface ServerConfig {
  port: number;
}

export async function startServer(config: ServerConfig): Promise<void> {
  server = serve({
    fetch: app.fetch,
    port: config.port
  });

  console.log(`🚀 HTTP server running on http://localhost:${config.port}`);
}

export async function stopServer(): Promise<void> {
  if (server) {
    server.close();
  }
}
```

**Step 6: Add @hono/node-server dependency**

```bash
pnpm add @hono/node-server
```

**Step 7: Run test to verify it passes**

```bash
pnpm test src/http/server.test.ts
```
Expected: PASS (3 tests)

**Step 8: Commit HTTP server**

```bash
git add src/http/ package.json
git commit -m "feat: add HTTP API server with Hono (health, models, invoke, compete)"
```

---

## Task 16: Bootstrap & Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Implement entry point**

Create `src/index.ts`:
```typescript
import { loadConfig } from './util/config';
import { configureProviders } from './adapters/index';
import { startServer } from './http/server';

async function bootstrap() {
  try {
    console.log('🎪 AI Arena starting...');

    // Load configuration
    const config = loadConfig();
    console.log('✅ Configuration loaded');

    // Configure providers
    await configureProviders(config);
    console.log('✅ Providers configured');

    // Start HTTP server
    const port = config.server?.http?.port || 3457;
    await startServer({ port });

    console.log('✨ AI Arena ready!');
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap();
}

export { bootstrap };
```

**Step 2: Test manual startup**

```bash
# Create minimal .env
echo "OPENAI_API_KEY=test" > .env

# Try to run (will fail without real keys, but should start)
pnpm dev
```

Expected: Server starts and shows "AI Arena ready!"

**Step 3: Commit entry point**

```bash
git add src/index.ts
git commit -m "feat: add bootstrap entry point with config loading"
```

---

## Task 17: Integration Tests

**Files:**
- Create: `tests/integration/full-flow.test.ts`

**Step 1: Write integration test**

Create `tests/integration/full-flow.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { invokeOperation, competeOperation } from '../../src/core/operations';
import { configureProviders } from '../../src/adapters/index';
import type { CNF } from '../../src/cnf/types';

describe('Full Flow Integration', () => {
  beforeAll(async () => {
    // Configure with mock/test providers
    await configureProviders({
      providers: {
        openai: { apiKey: 'test-key', models: [] },
        anthropic: { apiKey: 'test-key', models: [] }
      }
    });
  });

  it('completes full competition flow', async () => {
    const cnf: CNF = {
      sessionId: 'integration-test',
      messages: [
        { role: 'user', content: 'Explain quantum computing in one paragraph' }
      ]
    };

    // This would use real APIs if keys are valid
    // For CI, we skip or mock
    if (!process.env.RUN_LIVE_TESTS) {
      console.log('Skipping live test (set RUN_LIVE_TESTS=true to enable)');
      return;
    }

    const result = await competeOperation({
      cnf,
      spec: {
        providers: [
          { name: 'openai', model: 'gpt-4o-mini' },
          { name: 'anthropic', model: 'claude-3-5-haiku-20241022' }
        ],
        mode: 'round-robin',
        rubric: {
          weights: {
            length: 0.3,
            structure: 0.3,
            keywords: 0.4
          },
          keywords: ['quantum', 'computing', 'qubits']
        }
      }
    });

    expect(result.winner).toBeDefined();
    expect(result.winner.text.length).toBeGreaterThan(50);
    expect(result.leaderboard).toHaveLength(2);
  });
});
```

**Step 2: Run integration tests**

```bash
pnpm test tests/integration/
```
Expected: PASS (skipped if no live API keys)

**Step 3: Commit integration tests**

```bash
git add tests/integration/
git commit -m "test: add full-flow integration test with live API option"
```

---

## Task 18: Smoke Tests Script

**Files:**
- Create: `scripts/smoke.ts`

**Step 1: Create smoke test script**

Create `scripts/smoke.ts`:
```typescript
#!/usr/bin/env tsx

import { loadConfig } from '../src/util/config';
import { configureProviders, getProvider } from '../src/adapters/index';
import type { CNF } from '../src/cnf/types';

async function runSmokeTests() {
  console.log('🔥 Running smoke tests...\n');

  try {
    // Load config
    const config = loadConfig();
    await configureProviders(config);
    console.log('✅ Configuration loaded\n');

    const cnf: CNF = {
      sessionId: 'smoke-test',
      messages: [{ role: 'user', content: 'Say hello in 5 words' }]
    };

    // Test each provider
    for (const [name, cfg] of Object.entries(config.providers)) {
      try {
        console.log(`Testing ${name}...`);
        const provider = getProvider(name);

        const result = await provider.chat({
          cnf,
          targetModel: cfg.models[0]?.id || 'default',
          maxTokens: 50
        });

        console.log(`  ✅ ${name}: "${result.outputText?.slice(0, 50)}..."`);
        console.log(`  📊 Tokens: ${result.usage?.total || 'unknown'}\n`);
      } catch (error) {
        console.log(`  ❌ ${name} failed:`, (error as Error).message, '\n');
      }
    }

    console.log('✨ Smoke tests complete!');
  } catch (error) {
    console.error('❌ Smoke tests failed:', error);
    process.exit(1);
  }
}

runSmokeTests();
```

**Step 2: Make script executable**

```bash
chmod +x scripts/smoke.ts
```

**Step 3: Test smoke script (optional, needs real API keys)**

```bash
# Only if you have real API keys
pnpm test:smoke
```

Expected: Tests each provider with real API calls

**Step 4: Commit smoke tests**

```bash
git add scripts/smoke.ts
git commit -m "test: add smoke test script for live API validation"
```

---

## Task 19: Documentation Updates

**Files:**
- Update: `README.md`
- Update: `docs/TECHNICAL.md`

**Step 1: Update README with Phase 1 status**

Edit `README.md` and update the Quick Start section:

```markdown
## Quick Start

### Installation

\`\`\`bash
git clone https://github.com/PerformanceSuite/AI_Arena.git
cd AI_Arena
pnpm install
pnpm build
\`\`\`

### Configuration

1. Copy `.env.example` to `.env`:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

2. Add your API keys to `.env`:
   \`\`\`bash
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=...
   \`\`\`

3. (Optional) Customize `arena.config.yaml` for models and settings

### Usage

**Start the server:**
\`\`\`bash
pnpm dev
\`\`\`

**Run a competition:**
\`\`\`bash
curl -X POST http://localhost:3457/compete \\
  -H "Content-Type: application/json" \\
  -d '{
    "cnf": {
      "sessionId": "demo",
      "messages": [{"role": "user", "content": "Write a haiku about TypeScript"}]
    },
    "spec": {
      "providers": [
        {"name": "openai", "model": "gpt-4o-mini"},
        {"name": "anthropic", "model": "claude-3-5-haiku-20241022"}
      ],
      "mode": "round-robin",
      "rubric": {
        "weights": {"structure": 0.5, "length": 0.5}
      }
    }
  }'
\`\`\`

**Run tests:**
\`\`\`bash
pnpm test              # Unit + integration (mocked)
pnpm test:coverage     # With coverage report
pnpm test:smoke        # Live API tests (optional)
\`\`\`
```

**Step 2: Update TECHNICAL.md with implementation details**

Add to `docs/TECHNICAL.md`:

```markdown
## Phase 1 Implementation

### Completed Components

#### CNF System
- TypeScript types in `src/cnf/types.ts`
- Zod validation schema in `src/cnf/schema.ts`
- Transform functions: `appendMessage`, `extractLastMessage`, `redactSecrets`

#### Provider Adapters
- **OpenAI**: Full implementation with chat completions API
- **Anthropic**: Full implementation with Messages API and system message extraction
- **Google**: Full implementation with Gemini API and chat history support
- **Local**: LiteLLM/Ollama proxy via OpenAI-compatible endpoint
- Registry pattern for dynamic provider loading

#### Judging System
- **HeuristicJudge**: Length, keyword, structure scoring (fast, free)
- **LLMJudge**: Structured JSON scoring with any provider model
- Pluggable judge architecture for easy extension

#### Competition Engine
- **Round-Robin**: Parallel execution, weighted scoring, graceful degradation
- Provider failure handling
- Multi-judge composite scoring

#### API Layer
- **HTTP Server**: Hono-based REST API (port 3457)
- Routes: `/health`, `/models`, `/invoke`, `/compete`
- JSON validation with error handling

#### Testing
- Unit tests for all core modules (>80% coverage)
- Integration tests with MockAdapter
- Optional smoke tests for live API validation

### Architecture Highlights

1. **Stateless Adapters**: All conversation state in CNF, adapters are pure functions
2. **Plugin System**: Easy to add providers (implement interface) and judges (extend base)
3. **Error Resilience**: Provider failures don't crash competitions
4. **Type Safety**: Full TypeScript with Zod runtime validation
```

**Step 3: Commit documentation**

```bash
git add README.md docs/TECHNICAL.md
git commit -m "docs: update README and TECHNICAL.md with Phase 1 implementation details"
```

---

## Task 20: Final Verification & Cleanup

**Step 1: Run all tests**

```bash
pnpm test
```
Expected: All tests pass

**Step 2: Check test coverage**

```bash
pnpm test:coverage
```
Expected: >80% coverage for core modules

**Step 3: Build project**

```bash
pnpm build
```
Expected: Clean build, no errors

**Step 4: Try manual server startup**

```bash
# With real API keys in .env
pnpm dev
```
Expected: Server starts successfully

**Step 5: Create Phase 1 completion commit**

```bash
git add .
git commit -m "feat: complete Phase 1 implementation

- CNF schema and validation
- 4 provider adapters (OpenAI, Anthropic, Google, Local)
- Heuristic and LLM judges
- Round-robin competition
- HTTP API server
- >80% test coverage
- Integration and smoke tests"
```

**Step 6: Update CURRENT_SESSION.md**

Edit `docs/CURRENT_SESSION.md`:
```markdown
# Current Session Context

## Today's Goal
Phase 1 implementation complete!

## Where We Left Off
All Phase 1 tasks completed:
- ✅ CNF system with validation
- ✅ 4 provider adapters
- ✅ Pluggable judge system
- ✅ Round-robin competition
- ✅ HTTP API
- ✅ >80% test coverage

Ready for Phase 2 planning!

## Next Steps
1. Test with real API keys
2. Create implementation plan for Phase 2
3. Add MCP server support
4. Implement Debate/Jury modes
```

---

## Success Criteria Checklist

At this point, verify all Phase 1 success criteria are met:

- ✅ Round-robin competition works with 2+ providers
- ✅ Both heuristic and LLM judges functional
- ✅ HTTP interface operational
- ✅ Graceful handling of provider failures
- ✅ >80% test coverage for core modules
- ✅ Integration tests validate full flow
- ✅ Clear error messages for common issues
- ✅ README with setup and examples
- ✅ CLAUDE.md updated with architecture

**Phase 1 Foundation Achieved!** 🎉

---

## Plan Execution Handoff

Plan complete and saved to `docs/plans/2025-11-05-phase1-implementation-plan.md`.

Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
