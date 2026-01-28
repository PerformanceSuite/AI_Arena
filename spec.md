# AI Arena — Technical Specification

## 1. Purpose

AI Arena provides a unified interface to multiple AI providers, enabling competition, debate, and judged evaluation of model outputs. It uses Context Normal Form (CNF) as a portable conversation schema to bridge provider differences.

## 2. Context Normal Form (CNF)

CNF is the core data structure. All provider interactions go through CNF.

### Schema

```typescript
interface CNF {
  sessionId: string;
  messages: Message[];
  artifacts?: Artifact[];
  scratch?: Record<string, any>;
  tags?: string[];
  locale?: string;
  timezone?: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  timestamp?: string;
  attachments?: Attachment[];
  citations?: string[];
  meta?: Record<string, any>;
}

interface Attachment {
  kind: 'file' | 'image' | 'audio' | 'video' | 'url';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}

interface Artifact {
  id: string;
  kind: 'doc' | 'code' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}
```

### CNF Transforms

| Transform | Function | Purpose |
|-----------|----------|---------|
| Append | `appendMessage(cnf, role, content)` | Add message, return new CNF |
| Extract | `extractLastMessage(cnf)` | Get last message content |
| Redact | `redactSecrets(cnf)` | Strip API keys/secrets from content |
| Compress | `compressCNF(cnf, config, summarizeFn?)` | Summarize old messages, preserve recent |
| Validate | `validateCNF(data)` | Zod schema validation |

### Compression Strategies

- **summarize**: Use LLM to summarize old messages (requires `summarizeFn`)
- **truncate**: Drop oldest messages
- **sliding-window**: Keep N most recent messages

## 3. Provider Adapter System

### Interface

```typescript
interface ProviderAdapter {
  name: string;
  configure(config: { apiKey: string; endpoint?: string }): Promise<void>;
  listModels(): Promise<string[]>;
  chat(args: ChatArgs): Promise<ChatResult>;
}

interface ChatArgs {
  cnf: CNF;
  targetModel: string;
  system?: string;
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

interface ChatResult {
  updatedCNF: CNF;
  outputText?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}
```

### Implemented Adapters

| Provider | Class | SDK | Notes |
|----------|-------|-----|-------|
| OpenAI | `OpenAIAdapter` | `openai` | GPT-4o, GPT-4o-mini, etc. |
| Anthropic | `AnthropicAdapter` | `@anthropic-ai/sdk` | Claude models. Extracts system messages from CNF. |
| Google | `GoogleAdapter` | `@google/generative-ai` | Gemini models. Maps assistant→model role. |
| xAI | `XAIAdapter` | `openai` (custom baseURL) | Grok models via OpenAI-compatible API. |
| Local | `LocalAdapter` | `fetch` | OpenAI-compatible local endpoint (LiteLLM/Ollama). |

### Registry

Global singleton registry (`src/adapters/index.ts`):
- `getProvider(name)` — lookup by name
- `registerProvider(name, adapter)` — register custom adapter
- `configureProviders(config)` — configure all from `ArenaConfig`

Also: `DefaultProviderRegistry` class (`src/adapters/registry.ts`) for dependency injection (used by DebateCoordinator). Supports `provider/model` format parsing.

## 4. Competition System

### Round-Robin Mode (Implemented)

1. Send prompt to all providers in parallel
2. Collect candidates (failed providers are excluded gracefully)
3. Each judge scores each candidate against the rubric
4. Weighted average across judges produces final score
5. Sort by score → leaderboard + winner

### Cascade Mode (Planned)

Start with fast/cheap models, escalate to expensive models if quality threshold not met.

### Debate Mode (Implemented)

Per round:
1. Provider A responds to the prompt
2. Provider B receives A's response and critiques it
3. Provider A receives B's critique and refines

After all rounds, judge scores final outputs from both providers. Winner: A, B, or tie.

Configuration:
```typescript
interface DebateConfig {
  providerA: string;     // "provider/model" format
  providerB: string;
  prompt: string;
  rounds: number;
  judge: { type: 'llm' | 'heuristic'; provider: string };
}
```

### Planned Modes (Phase 3)

- **Jury**: N providers generate, M judges score with rubric
- **Critic-Refine**: Critic pass first, then provider revision
- **Multi-round Debate**: Enhanced debate with research tools

## 5. Judging System

### Heuristic Judge

Scores candidates on three dimensions:
- **length**: Penalizes very short (<50 chars) and very long (>2000 chars) responses
- **keywords**: Fraction of specified keywords found in response
- **structure**: Markdown formatting (headings, lists, code blocks, links, bold)

Each dimension weighted per rubric. Final score: weighted average, 0-1 range.

### LLM Judge

Sends a structured prompt to an LLM asking it to evaluate a response. Expects JSON output:
```json
{
  "total": 0.85,
  "breakdown": {"correctness": 0.9, "style": 0.8},
  "reasoning": "explanation"
}
```
Falls back to 0.5 score on parse failure.

### Rubric

```typescript
interface RubricSpec {
  weights: Record<string, number>;  // dimension → weight
  keywords?: string[];              // for keyword scoring
  judgeWeights?: Record<string, number>; // judge name → weight
}
```

## 6. HTTP API

Framework: Hono, served via `@hono/node-server`.

### Endpoints

**GET /health** — Returns `{ ok: true, providers: string[] }`

**GET /models** — Returns `{ providers: Record<string, string[]> }`

**POST /invoke** — Single provider invocation
- Body: `{ cnf: CNF, provider: string, model: string, system?: string, temperature?: number, maxTokens?: number }`
- Returns: `{ cnf: CNF, outputText: string, usage: TokenUsage }`

**POST /compete** — Multi-provider competition
- Body: `{ cnf: CNF, spec: { providers: [{name, model}], mode, rubric, judges?, system? } }`
- Returns: `{ winner: {id, text, score, breakdown}, leaderboard: [{id, text, score}] }`

**POST /debate** — Adversarial debate
- Body: `DebateConfig`
- Returns: `DebateState` (rounds, winner, scores)

All endpoints validate CNF via Zod. Returns 400 for invalid input, 500 for provider errors.

## 7. Observability

### Trace Events

```typescript
interface TraceEvent {
  timestamp: Date;
  sessionId: string;
  eventType: 'competition.start' | 'competition.end' | 'provider.invoke' |
             'provider.error' | 'judge.score' | 'debate.turn' | 'debug.info';
  level?: 'debug' | 'info' | 'warning' | 'error';
  data: Record<string, any>;
}
```

`TraceEmitter` filters by minimum level and outputs JSON to stdout. DebateCoordinator emits trace events for start, each turn, and end.

## 8. Artifact Storage

File-based storage at `./artifacts/{sessionId}/{id}.json`. Supports store, retrieve by ID, and list by session. Stores metadata, type, and content as JSON.

## 9. Configuration

### arena.config.yaml

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
  google:
    apiKey: ${GOOGLE_API_KEY}
    models:
      - id: gemini-2.5-pro
  xai:
    apiKey: ${XAI_API_KEY:-}
    models:
      - id: grok-beta

infrastructure:
  compression:
    strategy: summarize
    maxTokens: 4000
    preserveRecent: 10
  artifacts:
    basePath: ./artifacts
  traces:
    minLevel: info

server:
  http:
    port: 3457
```

### Environment Variables

| Variable | Required | Provider |
|----------|----------|----------|
| OPENAI_API_KEY | Yes | OpenAI |
| ANTHROPIC_API_KEY | Yes | Anthropic |
| GOOGLE_API_KEY | Yes | Google |
| XAI_API_KEY | No | xAI |
| NATS_URL | No | CommandCenter integration |

## 10. Security

- **Secret Redaction**: `redactSecrets()` strips API key patterns (sk-*, sk-ant-*, AIza*, xai-*) from CNF before cross-provider transfer
- **Input Validation**: All HTTP endpoints validate CNF with Zod schema
- **Provider Isolation**: Each adapter manages its own client instance
- **Graceful Failure**: Competition continues if individual providers fail
