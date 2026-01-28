# AI Arena Phase 1 Implementation Design

**Date:** 2025-11-04
**Status:** Approved for Implementation
**Goal:** Foundation for iteration - solid architecture with working providers, designed for easy extension

## Design Decisions

### Core Approach
- **Architecture**: Core-first with CNF + plugin system
- **Initial Providers**: OpenAI, Anthropic, Google, Local (4 full implementations)
- **Judge System**: Pluggable architecture supporting both heuristic and LLM judges
- **Testing**: Layered approach - mocked unit tests + optional live smoke tests
- **NATS Integration**: Optional - tool works standalone via HTTP/MCP

### Success Criteria
✅ Run round-robin competition with 2+ providers
✅ Judge outputs using heuristic and LLM judges
✅ Access via HTTP API and MCP server
✅ Handle provider failures gracefully
✅ >80% test coverage for core modules
✅ Clear extensibility path for new providers/judges/modes

---

## 1. Core Architecture: Context Normal Form (CNF)

### Purpose
CNF is the universal conversation format that enables provider-agnostic operations. It decouples competition logic from provider-specific APIs.

### CNF Structure
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

interface Artifact {
  id: string;
  kind: 'doc' | 'code' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  uri: string;
  title?: string;
  meta?: Record<string, any>;
}
```

### CNF Pipeline
```
Provider Response → Lift → CNF → Transform → Translate → Different Provider
                            ↓
                    Compress / Redact
```

**Transformations:**
- **Lift**: Provider-specific format → CNF
- **Translate**: CNF → Provider-specific format (handles role mapping, token limits)
- **Compress**: Summarize long conversations (Phase 2)
- **Redact**: Regex-based secret/PII removal

### Implementation
- `src/cnf/schema.ts`: TypeScript types + JSON Schema validation
- `src/cnf/transform.ts`: Core pipeline functions
- `src/cnf/adapters/`: Provider-specific lift/translate implementations

### Key Insight
Adding a new provider = implement lift/translate for that format. Competition engine doesn't change.

---

## 2. Provider Adapter System

### Plugin Architecture

Each provider implements standard interface:

```typescript
interface ProviderAdapter {
  name: string;
  configure(config: ProviderConfig): Promise<void>;
  listModels(): Promise<ModelSpec[]>;
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

### Provider Registry Pattern
```typescript
// src/adapters/index.ts
export const providers = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GoogleAdapter(),
  local: new LocalAdapter()
};

export function getProvider(name: string): ProviderAdapter {
  if (!providers[name]) throw new Error(`Unknown provider: ${name}`);
  return providers[name];
}
```

### Configuration
`arena.config.yaml` with environment variable substitution:
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
      - id: gemini-1.5-pro
  local:
    endpoint: http://127.0.0.1:4000
```

### Phase 1 Providers
- **Full Implementation**: OpenAI, Anthropic, Google, Local
- **Stubs**: xAI, Mistral, Cohere, Bedrock (correct interface, mock responses)

### Design Principle
Adapters are stateless - all conversation state lives in CNF. This makes them easy to test and swap.

---

## 3. Competition Coordinator & Judging

### Competition Flow

```typescript
interface CompetitionSpec {
  providers: Array<{name: string; model: string}>;
  mode: 'round-robin' | 'debate' | 'jury' | 'cascade' | 'blend';
  rubric: RubricSpec;
  system?: string;
}

async function compete(cnf: CNF, spec: CompetitionSpec): Promise<CompetitionResult>
```

### Phase 1 Competition Modes
- **Round-Robin**: All providers generate in parallel → judge scores each → highest wins
- **Cascade**: Try providers in order (cheap→expensive) until quality threshold met
- **Debate/Jury/Blend**: Stubbed for Phase 2

### Pluggable Judge System

```typescript
interface Judge {
  name: string;
  score(candidate: Candidate, rubric: RubricSpec): Promise<Score>;
}

interface Score {
  total: number;
  breakdown: Record<string, number>;
  reasoning?: string;
}
```

### Phase 1 Judges

**HeuristicJudge** (fast, free, deterministic):
- Length scoring (penalize too short/long)
- Keyword matching from rubric
- Structure checks (markdown formatting, code blocks)
- Link validation, JSON/YAML syntax checks

**LLMJudge** (powerful, costs tokens):
- Configured with provider (e.g., `openai:gpt-4o-mini`)
- Receives rubric + candidates
- Returns structured scores with reasoning
- Prompt: "Score this response on [rubric criteria]..."

### Composite Scoring
```typescript
const judges = [
  new HeuristicJudge(),
  new LLMJudge('openai:gpt-4o-mini')
];

const scores = await Promise.all(
  judges.map(j => j.score(candidate, rubric))
);
const finalScore = weightedAverage(scores, rubric.judgeWeights);
```

### Rubric Format
```yaml
weights:
  correctness: 0.4
  completeness: 0.3
  style: 0.2
  safety: 0.1
keywords: [install, usage, license]
judgeWeights:
  heuristic: 0.3
  llm: 0.7
```

### Key Insight
Judge system is its own plugin architecture. Easy to add custom judges without touching competition logic.

---

## 4. API Layer & Integration

### Three Interface Modes

All expose same core operations via different transports:

**HTTP API** (`src/http.ts`):
```
GET  /health          → {ok: true, providers: [...]}
GET  /models          → {providers: {openai: [...], anthropic: [...]}}
POST /invoke          → Single provider chat
POST /compete         → Multi-provider competition
POST /judge           → Score candidates with judges
```

**MCP Server** (`src/mcp.ts`):
- Stdio transport (Claude Desktop, Cline, etc.)
- Tools: `arena_invoke`, `arena_compete`, `arena_judge`, `arena_list_models`

**NATS Bridge** (`src/nats-bridge.ts`):
- Subscribe to `arena.invoke` topic
- Publish to `arena.result`
- Optional - gracefully disabled if `NATS_URL` not set

### Unified Core Pattern
```typescript
// src/core/operations.ts
export async function invokeOperation(req: InvokeRequest): Promise<InvokeResult>
export async function competeOperation(req: CompeteRequest): Promise<CompeteResult>
export async function judgeOperation(req: JudgeRequest): Promise<JudgeResult>

// Each interface is a thin adapter calling these operations
```

### Example Request/Response
```json
// POST /compete
{
  "cnf": {
    "sessionId": "demo-123",
    "messages": [{"role": "user", "content": "Write a README"}]
  },
  "spec": {
    "providers": [
      {"name": "openai", "model": "gpt-4o"},
      {"name": "anthropic", "model": "claude-3-5-sonnet-20241022"}
    ],
    "mode": "round-robin",
    "rubric": {
      "weights": {"correctness": 0.5, "completeness": 0.3, "style": 0.2},
      "keywords": ["install", "usage"]
    }
  }
}

// Response
{
  "winner": {
    "id": "anthropic:claude-3-5-sonnet-20241022",
    "text": "# AI Arena\n\n...",
    "score": 0.87,
    "breakdown": {"correctness": 0.9, "completeness": 0.85, "style": 0.86}
  },
  "leaderboard": [...]
}
```

### Startup Sequence
1. Load `arena.config.yaml`
2. Initialize providers (configure adapters with API keys)
3. Start HTTP server (port 3457)
4. Start MCP server (stdio)
5. Try NATS bridge (optional, log warning if fails)
6. Log: "AI Arena ready: HTTP:3457 MCP:stdio NATS:disabled"

### Error Handling
- Provider failures → graceful degradation (exclude from competition)
- Missing API keys → provider disabled, logged at startup
- NATS unreachable → continue without NATS
- Validation errors → return 400 with schema violations

---

## 5. Testing Strategy

### Layered Testing

**Unit Tests** (`src/**/*.test.ts`):
- CNF transformations (lift/translate/compress/redact)
- Judge scoring with known inputs
- Rubric parsing and validation
- Mock provider responses - no API calls

**Integration Tests** (`tests/integration/`):
- Mock adapters with deterministic responses
- Full competition flow: CNF → compete → judge → result
- Error handling (provider failures, invalid CNF)

**Smoke Tests** (`scripts/smoke.ts`):
- Optional live API calls (env: `RUN_LIVE_TESTS=true`)
- Real OpenAI/Anthropic APIs with small requests
- Validates actual provider integration
- Can skip gracefully in CI without keys

### Mock Provider Strategy
```typescript
class MockAdapter implements ProviderAdapter {
  responses: string[] = [];

  async chat(args: ChatArgs) {
    const response = this.responses.shift() || 'mock response';
    return {
      updatedCNF: appendMessage(args.cnf, 'assistant', response),
      outputText: response,
      usage: {prompt: 10, completion: 20, total: 30}
    };
  }
}

// In tests:
const mock = new MockAdapter();
mock.responses = ['Response A', 'Response B'];
// Run competition, verify judge picks correct winner
```

---

## 6. Project Structure

```
AI_Arena/
  src/
    index.ts                    # Bootstrap & startup
    http.ts, mcp.ts, nats-bridge.ts
    core/
      operations.ts             # Unified operation handlers
    cnf/
      schema.ts, types.ts
      transform.ts              # lift/translate/compress/redact
      transform.test.ts
    adapters/
      index.ts, types.ts
      openai.ts, openai.test.ts
      anthropic.ts, anthropic.test.ts
      google.ts, google.test.ts
      local.ts, local.test.ts
      xai.ts, mistral.ts, cohere.ts, bedrock.ts  # stubs
    arena/
      competition.ts, competition.test.ts
      judges.ts, judges.test.ts
      rubric.ts, rubric.test.ts
    util/
      config.ts               # Load arena.config.yaml
      logging.ts
      validation.ts
  tests/
    mocks/
      mock-adapter.ts
    integration/
      competition.test.ts
      api.test.ts
  scripts/
    smoke.ts                  # Optional live tests
  policies/
    redaction-rules.yaml
    validation-policy.json
  rubrics/
    readme.yaml
    codegen.yaml
  arena.config.yaml
  package.json, tsconfig.json
  manifest.json              # CommandCenter manifest
```

---

## 7. Implementation Priorities

### Week 1: Foundation
- CNF schema and TypeScript types
- Basic transform functions (lift/translate stubs)
- Config loader for `arena.config.yaml`
- Project scaffolding and build setup

### Week 1-2: Provider Adapters
- OpenAI adapter (full implementation)
- Anthropic adapter (full implementation)
- Google adapter (full implementation)
- Local adapter (LiteLLM/Ollama proxy)
- Stub adapters for xAI, Mistral, Cohere, Bedrock

### Week 2: Competition & Judging
- Round-robin competition mode
- Heuristic judge implementation
- LLM judge implementation
- Rubric parser and validator
- Competition coordinator

### Week 2-3: API Layer
- HTTP server with core routes
- MCP server (stdio)
- Optional NATS bridge
- Unified operations layer

### Week 3: Testing & Polish
- Unit tests for all core modules
- Integration tests with mock adapters
- Smoke tests for live validation
- Error handling and logging

---

## 8. Out of Scope for Phase 1

Deferred to Phase 2+:
- Debate/Jury/Blend competition modes
- Proactive Task Executor
- CNF compression/summarization
- Advanced redaction beyond regex
- Hub UI integration
- Artifact storage system

---

## 9. Development Workflow

```bash
# Setup
pnpm install
pnpm build

# Development
pnpm dev                      # Run with tsx (hot reload)
pnpm test                     # Unit + integration (mocked)
pnpm test:smoke               # Optional live API tests

# Usage
curl http://localhost:3457/health
curl -X POST http://localhost:3457/compete -d @test-request.json
```

---

## 10. Success Metrics

Phase 1 is complete when:

✅ Round-robin competition works with 2+ providers
✅ Both heuristic and LLM judges functional
✅ HTTP and MCP interfaces operational
✅ Graceful handling of provider failures
✅ >80% test coverage for core modules
✅ Integration tests validate full flow
✅ Smoke tests pass with real APIs
✅ Clear error messages for common issues
✅ README with setup and examples
✅ CLAUDE.md updated with architecture

**Foundation achieved**: Easy to add providers, judges, and competition modes without refactoring core.
