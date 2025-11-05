# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Arena is a standalone tool that integrates with CommandCenter to provide:
- **Unified Multi-AI Interface**: Single interface across OpenAI, Anthropic, Google, xAI, Mistral, Cohere, AWS Bedrock, and local models (LiteLLM/Ollama)
- **Context Bridge**: Transfers conversation state between AI providers using Context Normal Form (CNF)
- **AI Competition**: Runs competitions between models with judging, blending, and ensemble selection
- **Proactive Task Executor**: Autonomous planning, research, generation, verification, and execution with guardrails

Package: `@commandcenter/ai-arena`
Target location: `tools/ai-arena/` (within CommandCenter monorepo)

## Development Commands

```bash
# Build
pnpm build              # Compile TypeScript to dist/

# Development
pnpm dev                # Run with tsx (hot reload)

# Testing
pnpm test               # Run smoke tests

# CommandCenter Integration (when in monorepo)
pnpm hub:tools:refresh  # Rescan tool manifests
pnpm hub:events         # Tail arena.* events on NATS mesh
```

## Architecture

### Three-Layer System

1. **Bridge Layer** (`src/bridges/`)
   - `commandcenter.ts`: NATS mesh integration (topics: `arena.invoke`, `arena.trace`, `arena.result`)
   - `http.ts`: HTTP API server (port 3457, routes: `/invoke`, `/health`, `/models`, `/judge`)
   - `mcp.ts`: MCP server (stdio transport)

2. **Core Layer**
   - `orchestrator.ts`: CNF management (compress, redact, translate, lift)
   - `arena.ts`: Competition coordinator (Round-Robin, Debate, Jury, Cascade, Blend, Critic-Refine)
   - `judges.ts`: Scoring engine (LLM judges + heuristics)
   - `taskgraph.ts`: Proactive executor (Plan → Research → Generate → Verify → Execute)

3. **Provider Layer** (`src/adapters/`)
   - Each provider implements `ProviderAdapter` interface
   - Adapters: openai, anthropic, google, xai, mistral, cohere, bedrock, local

### Context Normal Form (CNF)

CNF is the portable conversation format that bridges different AI providers. Key schema fields:
- `sessionId`: Unique session identifier
- `messages[]`: Conversation history with roles (user/assistant/system/tool)
- `attachments[]`: Files, images, audio, video, tables with URIs
- `artifacts[]`: Generated outputs (docs, code, media)
- `scratch`: Temporary workspace object
- `citations[]`: Source references

**CNF Pipelines:**
- **Lift**: Provider-specific format → CNF
- **Translate**: CNF → Provider-specific format
- **Compress**: Summarize long contexts for token limits
- **Redact**: Remove secrets/PII before cross-provider transfer

### Competition Modes

- **Round-Robin**: Each provider generates; highest-scored wins
- **Debate**: A1 vs A2 with cross-critique and refinement
- **Jury**: N providers generate, M judges score with rubric
- **Cascade**: Start with fast/cheap models, escalate to quality models until threshold met
- **Blend**: Merge multiple strong candidates
- **Critic-Refine**: Critic pass first, then revision by providers

### Judging System

**Judges**: Separate LLMs (can use different providers) + heuristics
**Heuristics**: Tests pass, lints clean, links valid, citations resolvable
**Rubric**: YAML/JSON with weighted criteria (correctness, relevance, completeness, style, safety, verifiability)

### Proactive Task Executor

**TaskGraph Phases**: Plan → Research → Generate → Verify → Execute

**Actions:**
- Research: `research.web()`, `research.codebase()`, `research.docs()`
- Generate: `generate.doc()`, `generate.code()`, `generate.test()`
- Verify: `verify.tests()`, `verify.lint()`, `verify.schema()`
- Execute: `execute.shell()`, `execute.fs()`, `execute.git()`

**Guardrails:**
- Dry-run previews before execution
- Diff approval policy
- Path allowlist for file operations
- Resource quotas and timeouts
- Policy hooks from `policies/validation-policy.json`

## File Structure

```
tools/ai-arena/
  package.json          # npm/pnpm config
  tsconfig.json         # TypeScript config
  manifest.json         # CommandCenter tool registry manifest
  src/
    index.ts            # Entry point: bootstraps NATS+HTTP+MCP
    orchestrator.ts     # CNF management
    arena.ts            # Competition coordinator
    judges.ts           # Judging/scoring
    taskgraph.ts        # Proactive executor
    bridges/
      commandcenter.ts  # NATS mesh bridge
      mcp.ts            # MCP server
      http.ts           # HTTP API
    adapters/
      openai.ts         # OpenAI adapter
      anthropic.ts      # Anthropic adapter
      google.ts         # Google adapter
      xai.ts            # xAI adapter
      mistral.ts        # Mistral adapter
      cohere.ts         # Cohere adapter
      bedrock.ts        # AWS Bedrock adapter
      local.ts          # Local models (LiteLLM/Ollama)
    schemas/
      cnf.schema.json   # CNF JSON Schema
      invoke.schema.json
      result.schema.json
  policies/
    validation-policy.json  # Executor guardrails
```

## Environment Variables

Required API keys (per provider):
```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
XAI_API_KEY=...
MISTRAL_API_KEY=...
COHERE_API_KEY=...
AWS_ACCESS_KEY_ID=...      # For Bedrock
AWS_SECRET_ACCESS_KEY=...  # For Bedrock
```

Optional:
```bash
NATS_URL=nats://127.0.0.1:4222  # CommandCenter mesh bus
```

## Key Implementation Details

### ProviderAdapter Interface

All provider adapters implement:
```typescript
interface ProviderAdapter {
  name: string;
  configure(cfg: ProviderConfig): void;
  listModels(): Promise<ModelSpec[]>;
  chat(input: {
    cnf: CNF;
    targetModel: string;
    tools?: ToolSpec[];
    system?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    updatedCNF: CNF;
    outputText?: string;
    toolCalls?: ToolCall[];
    usage?: TokenUsage;
  }>;
}
```

### NATS Integration

CommandCenter uses NATS for inter-tool communication:
- Subscribe to `arena.invoke` for requests
- Publish `arena.trace` for step-by-step tracing
- Publish `arena.result` for final outputs

### Manifest Integration

`manifest.json` registers the tool with CommandCenter hub:
- Declares HTTP/MCP/CLI endpoints
- Specifies NATS topics
- Lists required environment variables
- Defines filesystem/network/shell permissions

## Security & Safety

- **Redaction**: Remove secrets/API keys/PII before cross-provider sharing
- **Consent**: Opt-in required for external provider data transfer
- **Quotas**: Per-provider token/time budgets
- **Human-in-the-loop**: Approval checkpoints per TaskGraph phase
- **Path Allowlist**: Executor only writes to permitted paths

## Development Phases

**Phase 0 (Current)**: CNF schema, NATS bridge scaffold, minimal compete/judge stubs
**Phase 1**: Full provider adapters, CNF compression/redaction, HTTP API, MCP server
**Phase 2**: Debate/Jury modes, LLM judges, rubric designer, artifact store, rich traces
**Phase 3**: Complete TaskGraph executor with guardrails, Git/FS tools, CI hooks, policy enforcement

## Session Management (USS v2.1)

This project uses Universal Session System:
```bash
/start    # Begin work session (loads context, invokes mandatory skills)
/end      # End session (cleanup, memory rotation, repository hygiene)
```

Documentation structure in `docs/`:
- `PROJECT.md`: Project overview and goals
- `ROADMAP.md`: Feature planning and phases
- `TECHNICAL.md`: Architecture and decisions
- `CURRENT_SESSION.md`: Active work tracking
- `.claude/memory.md`: Auto-rotating session history (500 line limit)
