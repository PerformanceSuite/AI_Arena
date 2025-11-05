# AI Arena Technical Documentation

## Architecture

### Core-First Design

AI Arena is built around a **core-first architecture** prioritizing extensibility and clean abstractions:

1. **Context Normal Form (CNF)** - Universal conversation format
2. **Plugin System** - Provider adapters and judges as plugins
3. **Stateless Components** - All state in CNF for testability
4. **Multi-Interface** - HTTP, MCP, NATS via unified operations layer

### Three-Layer System

```
┌─────────────────────────────────────────────────────┐
│                 Interface Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   HTTP   │  │   MCP    │  │  NATS (optional) │  │
│  │ :3457    │  │  stdio   │  │    mesh bus      │  │
│  └─────┬────┘  └────┬─────┘  └────────┬─────────┘  │
└────────┼────────────┼─────────────────┼────────────┘
         │            │                 │
         └────────────┴─────────────────┘
                      │
┌─────────────────────┼─────────────────────────────┐
│                Core Layer                         │
│         ┌───────────┴──────────┐                  │
│         │  Unified Operations  │                  │
│         └──────────┬───────────┘                  │
│                    │                              │
│  ┌─────────────────┼─────────────────────────┐   │
│  │          CNF Transform Pipeline           │   │
│  │  Lift → Compress → Redact → Translate     │   │
│  └─────────────────┬─────────────────────────┘   │
│                    │                              │
│  ┌─────────────────┴─────────────────────────┐   │
│  │       Competition Coordinator             │   │
│  │  (Round-Robin, Cascade, Debate, Jury...)  │   │
│  └─────────────────┬─────────────────────────┘   │
│                    │                              │
│  ┌─────────────────┴─────────────────────────┐   │
│  │          Judge System                     │   │
│  │   Heuristic Judges + LLM Judges           │   │
│  └───────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────┐
│             Provider Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  OpenAI  │  │Anthropic │  │  Google  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Local   │  │   xAI    │  │ Mistral  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐                    │
│  │  Cohere  │  │ Bedrock  │                    │
│  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────┘
```

## Tech Stack

### Languages & Runtime
- **TypeScript 5.6+** - Primary language
- **Node.js** - Runtime environment
- **ES Modules** - Module system (`"type": "module"`)

### Core Dependencies
- **nats 2.15+** - NATS messaging client (optional)
- **yaml 2.6+** - Config and rubric parsing
- **ajv 8.17+** - JSON Schema validation
- **ajv-formats 3.0+** - Additional format validators
- **undici 6.19+** - HTTP client for provider APIs

### Development Tools
- **tsx 4.19+** - TypeScript execution and hot reload
- **TypeScript 5.6+** - Type checking and compilation

### Package Manager
- **pnpm** - Fast, disk space efficient package manager

## Context Normal Form (CNF)

### Schema

```typescript
interface CNF {
  sessionId: string;              // Unique conversation ID
  messages: Message[];            // Conversation history
  artifacts?: Artifact[];         // Generated outputs
  scratch?: Record<string, any>;  // Temporary state
  tags?: string[];                // Classification tags
  locale?: string;                // Language/region
  timezone?: string;              // Timezone info
}

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;                  // Tool/function name for tool role
  timestamp?: string;
  attachments?: Attachment[];
  citations?: string[];
  meta?: Record<string, any>;
}

interface Attachment {
  kind: 'file' | 'url' | 'image' | 'audio' | 'video' | 'table';
  mime: string;
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

### Transform Pipeline

1. **Lift**: Provider response → CNF
   - Maps provider-specific formats to CNF
   - Extracts metadata and usage stats
   - Normalizes roles and content

2. **Compress**: Long CNF → Summarized CNF (Phase 2)
   - Summarizes old messages
   - Preserves important context
   - Fits within token windows

3. **Redact**: CNF → Sanitized CNF
   - Regex-based secret removal
   - PII detection and masking
   - Configurable via `policies/redaction-rules.yaml`

4. **Translate**: CNF → Provider format
   - Maps CNF to provider messages
   - Handles role conversions
   - Applies token limits

## Provider Adapter System

### Interface

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

### Phase 1 Providers

**Full Implementations:**
- **OpenAI**: GPT-4, GPT-4o, GPT-4o-mini
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus/Haiku
- **Google**: Gemini 1.5 Pro/Flash
- **Local**: LiteLLM or Ollama proxy

**Stubs (Phase 2):**
- xAI (Grok), Mistral, Cohere, AWS Bedrock

### Provider Registry

```typescript
// src/adapters/index.ts
export const providers: Record<string, ProviderAdapter> = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GoogleAdapter(),
  local: new LocalAdapter(),
  // Stubs
  xai: new StubAdapter('xai'),
  mistral: new StubAdapter('mistral'),
  cohere: new StubAdapter('cohere'),
  bedrock: new StubAdapter('bedrock')
};
```

## Competition System

### Competition Modes

#### Round-Robin (Phase 1)
```typescript
// All providers generate in parallel
// Judge scores each output
// Highest score wins
async function roundRobin(cnf: CNF, spec: CompetitionSpec): Promise<CompetitionResult>
```

#### Cascade (Phase 1)
```typescript
// Try providers in order (cheap → expensive)
// Stop when quality threshold met
async function cascade(cnf: CNF, spec: CompetitionSpec): Promise<CompetitionResult>
```

#### Debate, Jury, Blend, Critic-Refine (Phase 2)
More complex multi-turn interactions between providers.

### Judging System

#### Interface

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

interface RubricSpec {
  weights: Record<string, number>;     // e.g., {correctness: 0.4, style: 0.2}
  keywords?: string[];                 // Expected keywords
  judgeWeights?: Record<string, number>; // e.g., {heuristic: 0.3, llm: 0.7}
}
```

#### Heuristic Judge

Fast, deterministic scoring:
- Length analysis (penalize too short/long)
- Keyword matching
- Structure validation (markdown, code blocks)
- Link validation
- Syntax checks (JSON, YAML)

#### LLM Judge

AI-powered scoring:
- Configurable model (e.g., `openai:gpt-4o-mini`)
- Rubric-driven prompts
- Structured score output with reasoning
- Supports multi-criteria evaluation

## API Endpoints

### HTTP API (Port 3457)

```
GET  /health
     → {ok: true, providers: string[], version: string}

GET  /models
     → {providers: {[name: string]: ModelSpec[]}}

POST /invoke
     Body: {cnf: CNF, provider: {name, model}, system?, tools?, temperature?, maxTokens?}
     → {updatedCNF: CNF, outputText: string, usage: TokenUsage}

POST /compete
     Body: {cnf: CNF, spec: CompetitionSpec}
     → {winner: ScoredCandidate, leaderboard: ScoredCandidate[]}

POST /judge
     Body: {candidates: Candidate[], rubric: RubricSpec}
     → {scores: Score[]}
```

### MCP Server (stdio)

Tools exposed:
- `arena_invoke` - Single provider chat
- `arena_compete` - Multi-provider competition
- `arena_judge` - Score candidates
- `arena_list_models` - List available models

### NATS Topics (Optional)

```
arena.invoke   → {cnf: CNF, spec: CompetitionSpec}
arena.trace    → {step: string, data: any}
arena.result   → {winner: ScoredCandidate, leaderboard: ScoredCandidate[]}
```

## Configuration

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
      - id: gemini-1.5-pro
  local:
    endpoint: http://127.0.0.1:4000

judging:
  defaultJudge: openai:gpt-4o-mini
  heuristics:
    enable: true
    weights:
      correctness: 0.5
      completeness: 0.3
      style: 0.2
```

### policies/redaction-rules.yaml

```yaml
rules:
  - pattern: '(?i)(api[_-]?key|secret|token)[=:]\\s*([A-Za-z0-9\\-_]{16,})'
    replace: '$1=<REDACTED>'
  - pattern: '(\\b\\d{3}-\\d{2}-\\d{4}\\b)'
    replace: '<SSN-REDACTED>'
  - pattern: '(?i)(password)[=:].*'
    replace: '$1=<REDACTED>'
```

## Environment Variables

### Required (per provider used)
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
XAI_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
AWS_ACCESS_KEY_ID=...        # For Bedrock
AWS_SECRET_ACCESS_KEY=...    # For Bedrock
```

### Optional
```bash
NATS_URL=nats://127.0.0.1:4222    # CommandCenter mesh
PORT=3457                          # HTTP server port
LOG_LEVEL=info                     # Logging verbosity
RUN_LIVE_TESTS=false               # Enable smoke tests with real APIs
```

## Testing Strategy

### Unit Tests
- CNF transformations
- Provider adapter interface compliance
- Judge scoring logic
- Rubric parsing
- **All mocked** - no API calls

### Integration Tests
- Full competition flow with mock adapters
- Error handling scenarios
- Competition mode variations
- Judge composition

### Smoke Tests
- **Optional** live API tests (controlled by `RUN_LIVE_TESTS`)
- Real provider integration
- End-to-end validation
- Can skip in CI without API keys

## Error Handling

### Provider Failures
- Graceful degradation
- Exclude failed providers from competition
- Log errors, continue with available providers

### Missing Configuration
- Provider disabled if API key missing
- Log warning at startup
- Tool continues with available providers

### NATS Unavailable
- Continue without NATS
- HTTP and MCP still functional
- Log warning

### Validation Errors
- Return 400 with detailed schema violations
- Include field-level error messages
- Suggest corrections

## Performance Considerations

### Parallel Execution
- Providers called concurrently in competitions
- Promise.all for parallel scoring
- Non-blocking I/O throughout

### Caching (Future)
- Response caching for identical requests
- Model list caching
- Rubric parsing cache

### Resource Limits
- Per-provider token budgets (Phase 2)
- Request timeouts
- Rate limiting (Phase 2)

## Security

### Redaction
- Regex-based secret removal
- Applied before cross-provider calls
- Configurable patterns

### Validation
- JSON Schema for all inputs
- Type checking via TypeScript
- Sanitize user inputs

### Isolation
- Stateless adapters
- No shared mutable state
- Provider failures don't affect others

---

*Technical reference - updated with implementation*
