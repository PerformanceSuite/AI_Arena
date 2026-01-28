# Phase 2 Design: Advanced Competition & Provider Expansion

**Date**: 2025-11-05
**Status**: Approved
**Approach**: Vertical Slice (incremental shipping)

## Overview

Phase 2 extends AI Arena with debate competition mode, two new providers (Anthropic, xAI), and production infrastructure improvements. Using a vertical slice approach, we'll build complete end-to-end features incrementally rather than completing one category at a time.

## Goals

**Primary:**
- Debate mode: Two providers argue, critique, and refine responses
- Anthropic provider: Full Claude integration
- xAI provider: Grok integration
- Infrastructure: CNF compression, artifact storage, structured traces

**Future Phases:**
- Cascade mode (cheap → quality escalation)
- Jury mode (N providers, M judges with rubric)
- Critic-Refine mode (iterative improvement)
- Additional providers (Mistral, Cohere, Bedrock)

## Architecture

### 1. Debate Mode

**Coordinator Extension** (`src/arena.ts`):

```typescript
interface DebateConfig {
  providerA: string;      // e.g., "openai/gpt-4o"
  providerB: string;      // e.g., "anthropic/claude-3-5-sonnet"
  rounds: number;         // Phase 2: fixed at 1 round
  judge: JudgeConfig;     // LLM judge to score final outputs
}

interface DebateState {
  prompt: string;
  rounds: DebateRound[];
  winner?: "A" | "B" | "tie";
  scores?: { A: number; B: number };
}

interface DebateRound {
  turn: number;
  providerA_response: string;
  providerB_critique: string;
  providerA_refined: string;
}
```

**Flow:**
1. Both providers receive the original prompt
2. Provider A generates initial response
3. Provider B sees prompt + Provider A's response, generates critique
4. Provider A sees original prompt + Provider B's critique, refines answer
5. Judge scores both final responses (A's refined vs B's critique)
6. Winner declared based on scores

**CNF Integration:**
- Debate history stored in CNF messages with roles: `debate:providerA`, `debate:providerB`, `debate:critique`
- Each provider sees conversation history relevant to their position
- Final CNF contains complete debate transcript for transparency

**HTTP Endpoint:**
- `POST /debate` - Accepts DebateConfig, returns DebateState with winner

### 2. Anthropic Provider

**Implementation** (`src/adapters/anthropic.ts`):

```typescript
class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic;

  configure(config: ProviderConfig): void {
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
    // Transform CNF → Anthropic messages format
    const messages = translateCNFToAnthropic(input.cnf);

    // Call Anthropic API
    const response = await this.client.messages.create({
      model: input.targetModel,
      messages,
      max_tokens: input.maxTokens || 4096,
      temperature: input.temperature || 1.0,
      system: input.system
    });

    // Lift response → CNF
    const updatedCNF = liftAnthropicToCNF(input.cnf, response);

    return {
      updatedCNF,
      outputText: extractText(response),
      usage: response.usage
    };
  }
}
```

**Key Features:**
- Full CNF lift/translate pipelines (matches Phase 1 OpenAI/Google patterns)
- Streaming support (optional, use Anthropic's streaming API)
- Tool/function calling support (Phase 2.5+, stub for now)
- Error handling with retries (exponential backoff)
- Token counting and usage tracking

**Configuration:**
- Environment variable: `ANTHROPIC_API_KEY`
- Add to `arena.config.yaml` with model list
- Support for all Claude 3.5 models (Opus, Sonnet, Haiku)

### 3. xAI Provider

**Implementation** (`src/adapters/xai.ts`):

Similar structure to Anthropic adapter, following proven patterns from Phase 1:
- OpenAI-compatible API (leverage similar translation logic)
- CNF lift/translate for xAI message format
- Error handling, retries, token tracking
- Support for Grok models

**Configuration:**
- Environment variable: `XAI_API_KEY`
- Add to `arena.config.yaml`

### 4. Infrastructure Layer

**CNF Compression** (`src/orchestrator.ts`):

```typescript
interface CompressionConfig {
  strategy: 'summarize' | 'truncate' | 'sliding-window';
  maxTokens: number;
  preserveRecent: number;  // Keep last N messages uncompressed
}

async function compressCNF(cnf: CNF, config: CompressionConfig): Promise<CNF> {
  if (cnf.messages.length <= config.preserveRecent) {
    return cnf; // No compression needed
  }

  // Split: old messages (compress) vs recent (preserve)
  const oldMessages = cnf.messages.slice(0, -config.preserveRecent);
  const recentMessages = cnf.messages.slice(-config.preserveRecent);

  // Summarize old messages using LLM
  const summary = await summarizeMessages(oldMessages);

  return {
    ...cnf,
    messages: [
      { role: 'system', content: `[Conversation summary]: ${summary}` },
      ...recentMessages
    ]
  };
}
```

**Purpose:**
- Prevent token overflow in long debates
- Preserve recent context while summarizing history
- Configurable compression strategies
- Target: 50%+ token reduction for long contexts

**Artifact Storage** (`src/artifacts.ts`):

```typescript
interface Artifact {
  id: string;
  sessionId: string;
  type: 'code' | 'document' | 'image' | 'data';
  content: string | Buffer;
  metadata: Record<string, any>;
  createdAt: Date;
}

class ArtifactStore {
  // Phase 2: Simple file-based storage
  async store(artifact: Artifact): Promise<string> {
    const path = `artifacts/${artifact.sessionId}/${artifact.id}`;
    await fs.writeFile(path, artifact.content);
    return path;
  }

  async retrieve(id: string): Promise<Artifact> {
    // Load from filesystem
  }

  // Phase 3+: Database, S3, etc.
}
```

**Purpose:**
- Store debate transcripts
- Save generated content (code, documents)
- Retrievable metadata for analysis
- Phase 2: File-based, Phase 3+: Database/S3

**Structured Traces** (`src/bridges/http.ts`):

```typescript
interface TraceEvent {
  timestamp: Date;
  sessionId: string;
  eventType: 'competition.start' | 'provider.invoke' | 'judge.score' | 'debate.turn';
  data: Record<string, any>;
}

// Emit structured traces for observability
function emitTrace(event: TraceEvent): void {
  console.log(JSON.stringify(event)); // Phase 2: Simple logging
  // Phase 3+: Send to NATS, OpenTelemetry, etc.
}
```

**Purpose:**
- Debug competition flows
- Monitor provider latency
- Track judging decisions
- Phase 2: JSON logging, Phase 3+: NATS/OpenTelemetry

## Implementation Plan

### Vertical Slice Approach

**Slice 1: Debate Foundation** (Week 1)
- [ ] Extend `arena.ts` with `runDebate()` coordinator
- [ ] Implement 2-turn debate flow (answer → critique → refine)
- [ ] Store debate state in CNF with role metadata
- [ ] HTTP endpoint: `POST /debate` accepting debate config
- [ ] Unit tests for debate coordinator logic

**Slice 2: Anthropic Provider** (Week 1-2)
- [ ] Implement full Anthropic adapter matching Phase 1 quality
- [ ] CNF lift/translate functions for Anthropic message format
- [ ] Error handling, retries, token tracking
- [ ] Unit tests with mocked SDK
- [ ] Integration tests with real API (optional)
- [ ] Add to `arena.config.yaml` with example models

**Slice 3: Infrastructure** (Week 2)
- [ ] CNF compression with LLM-based summarization
- [ ] File-based artifact storage
- [ ] Structured trace events (JSON logging)
- [ ] Update HTTP responses to include trace data
- [ ] Tests for compression (verify token reduction)

**Slice 4: Polish & Integration** (Week 2-3)
- [ ] End-to-end debate tests (OpenAI vs Anthropic)
- [ ] Update documentation (README, API examples)
- [ ] Add debate example to `examples/` directory
- [ ] Performance testing (debate latency, token usage)
- [ ] Error handling edge cases

**Slice 5: xAI Provider** (Week 3)
- [ ] Implement xAI adapter (similar to Anthropic)
- [ ] Reuse proven lift/translate patterns
- [ ] Test with debate mode (3-way debates now possible)
- [ ] Documentation updates

## Testing Strategy

**Unit Tests:**
- Debate coordinator logic (flow, state management)
- CNF compression (token reduction verification)
- Artifact storage (store/retrieve)
- Provider adapters (mocked SDK responses)

**Integration Tests:**
- End-to-end debate with real providers
- CNF round-trip validation (preserves intent)
- Artifact storage with filesystem operations
- Trace event emission

**Smoke Tests (Optional):**
- Live API calls to Anthropic/xAI
- Token usage validation
- Performance benchmarks

**Coverage Target:** >80% for all core modules

## Success Criteria

- ✅ Working 2-turn debate between any two providers
- ✅ Anthropic + xAI adapters production-ready
- ✅ CNF compression reduces tokens by 50%+ for long contexts
- ✅ Artifacts stored with retrievable metadata
- ✅ Structured traces enable debugging
- ✅ >80% test coverage maintained
- ✅ Clear examples and documentation

## API Examples

### Debate Endpoint

```bash
POST /debate
{
  "providerA": "openai/gpt-4o",
  "providerB": "anthropic/claude-3-5-sonnet",
  "prompt": "What are the pros and cons of TypeScript vs JavaScript?",
  "rounds": 1,
  "judge": {
    "type": "llm",
    "model": "openai/gpt-4o-mini",
    "rubric": "correctness,clarity,completeness"
  }
}
```

**Response:**
```json
{
  "sessionId": "debate-abc123",
  "winner": "B",
  "scores": { "A": 7.5, "B": 8.2 },
  "rounds": [
    {
      "turn": 1,
      "providerA_response": "TypeScript offers...",
      "providerB_critique": "While Provider A makes valid points...",
      "providerA_refined": "Taking the critique into account..."
    }
  ],
  "artifacts": ["artifacts/debate-abc123/transcript.json"],
  "traces": [
    { "timestamp": "...", "eventType": "debate.turn", "data": {...} }
  ]
}
```

## Configuration Updates

**arena.config.yaml:**

```yaml
providers:
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      - id: gpt-4o-mini
      - id: gpt-4o

  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
      - id: claude-3-5-haiku-20241022
      - id: claude-3-opus-20240229

  xai:
    apiKey: ${XAI_API_KEY}
    models:
      - id: grok-beta

  google:
    apiKey: ${GEMINI_API_KEY}
    models:
      - id: gemini-2.5-pro
      - id: gemini-2.5-flash

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

server:
  http:
    port: 3457
```

## Future Extensions

**Phase 3:**
- Cascade mode (start cheap, escalate to quality)
- Jury mode (N providers, M judges with rubric)
- Critic-Refine mode (iterative improvement)
- Multi-round debates (3+ turns)

**Phase 4:**
- Remaining providers (Mistral, Cohere, Bedrock)
- Database-backed artifact storage
- OpenTelemetry integration
- Advanced compression strategies

## Trade-offs

**Pros:**
- Vertical slice delivers working features incrementally
- Anthropic tested thoroughly before adding xAI
- Infrastructure improvements immediately useful for debates
- Clear extensibility path for future competition modes

**Cons:**
- Not all competition modes in Phase 2 (deferred to Phase 3)
- File-based artifact storage (good enough for Phase 2, upgrade later)
- Single-round debates only (multi-round in Phase 3)
- Limited compression strategies initially

---

**Approved by**: Daniel Connolly
**Next Step**: Create worktree and implementation plan
