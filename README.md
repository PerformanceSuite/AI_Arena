# AI Arena

A multi-AI competition platform that pits language models against each other and judges their outputs. Supports OpenAI, Anthropic, Google, xAI, and local models through a unified API.

## What It Does

- **Unified Interface**: Single API to invoke any supported AI provider
- **Competition**: Run the same prompt against multiple models, score and rank results
- **Debate Mode**: Two models argue and refine their positions, then a judge picks a winner
- **Context Normal Form (CNF)**: Portable conversation format that bridges provider differences
- **Pluggable Judging**: Heuristic scoring (length, structure, keywords) and LLM-as-judge

## Status

- **Phase 1** (Foundation): Complete — adapters, CNF, competition, judging, HTTP API
- **Phase 2** (Advanced): Complete — debate mode, Anthropic/xAI adapters, compression, artifacts, traces
- **Phase 3** (Research-augmented competition): Designed, not yet implemented
- **59 tests passing**, build clean

## Quick Start

```bash
pnpm install
cp .env.example .env    # Add your API keys
pnpm dev                # Starts on http://localhost:3457
```

## API

Server runs on `http://localhost:3457`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, lists configured providers |
| GET | `/models` | List all available models per provider |
| POST | `/invoke` | Send a prompt to a single provider |
| POST | `/compete` | Run competition across multiple providers |
| POST | `/debate` | Run adversarial debate between two providers |

### Competition Example

```bash
curl -X POST http://localhost:3457/compete \
  -H "Content-Type: application/json" \
  -d '{
    "cnf": {
      "sessionId": "test-1",
      "messages": [{"role": "user", "content": "Explain quantum computing"}]
    },
    "spec": {
      "providers": [
        {"name": "openai", "model": "gpt-4o"},
        {"name": "anthropic", "model": "claude-3-5-sonnet-20241022"}
      ],
      "mode": "round-robin",
      "rubric": {
        "weights": {"length": 0.3, "structure": 0.3, "keywords": 0.4},
        "keywords": ["quantum", "qubits", "superposition"]
      }
    }
  }'
```

### Debate Example

```bash
curl -X POST http://localhost:3457/debate \
  -H "Content-Type: application/json" \
  -d '{
    "providerA": "openai/gpt-4o",
    "providerB": "anthropic/claude-3-5-sonnet-20241022",
    "prompt": "Is TypeScript better than JavaScript?",
    "rounds": 2,
    "judge": {"type": "heuristic"}
  }'
```

## Architecture

```
src/
├── index.ts              # Bootstrap entry point
├── cnf/                  # Context Normal Form (schema, transforms, compression)
├── adapters/             # Provider adapters (OpenAI, Anthropic, Google, xAI, local)
├── arena/                # Competition, debate, judges (heuristic + LLM)
├── artifacts/            # Artifact storage
├── core/                 # Operation handlers (invoke, compete)
├── http/                 # Hono HTTP server and routes
├── observability/        # Structured trace events
└── util/                 # Config loader (YAML + env var substitution)
```

**CNF**: Normalized conversation schema (`sessionId`, `messages[]`, `artifacts[]`, `scratch`). All providers translate to/from CNF. Supports compression, secret redaction, and message transforms.

**Provider Adapters**: Implement `ProviderAdapter` interface (configure, listModels, chat). Registry maps names to adapters, configured from `arena.config.yaml`.

**Competition**: Round-robin sends the prompt to all providers in parallel, judges score each response, leaderboard sorted by weighted score.

**Debate**: Provider A responds → Provider B critiques → Provider A refines. Repeats for N rounds. Judge scores final outputs and declares winner.

**Judging**: `HeuristicJudge` scores length/keywords/structure. `LLMJudge` asks another model to evaluate. Judges compose via weighted scoring.

## Configuration

`arena.config.yaml` defines providers, models, and server settings. API keys injected via `${ENV_VAR}` syntax with optional defaults (`${VAR:-default}`).

## Environment Variables

```
OPENAI_API_KEY      # Required for OpenAI
ANTHROPIC_API_KEY   # Required for Anthropic
GOOGLE_API_KEY      # Required for Google/Gemini
XAI_API_KEY         # Optional, for xAI/Grok
```

## Development

```bash
pnpm build            # Compile TypeScript
pnpm dev              # Run with tsx (hot reload)
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm test:smoke       # Live API tests (RUN_LIVE_TESTS=true)
```

## Tech Stack

TypeScript 5.6+, Node.js, ES Modules, Hono, OpenAI/Anthropic/Google SDKs, Zod, YAML, Vitest, pnpm
