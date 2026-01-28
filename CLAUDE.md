# CLAUDE.md

## Project Overview

AI Arena — multi-AI competition platform. TypeScript/Node.js API server (Hono) on port 3457. Phases 1-2 complete, Phase 3 planned.

## Commands

```bash
pnpm build              # Compile TypeScript to dist/
pnpm dev                # Run with tsx (hot reload)
pnpm test               # Run all tests (vitest)
pnpm test:watch         # Watch mode
pnpm test:coverage      # Coverage report
pnpm test:smoke         # Live API tests (RUN_LIVE_TESTS=true)
```

## Architecture

Three layers:
1. **HTTP Layer** (`src/http/`) — Hono routes: `/health`, `/models`, `/invoke`, `/compete`, `/debate`
2. **Core Layer** (`src/core/`, `src/arena/`) — Operations, competition coordinator, debate, judges
3. **Provider Layer** (`src/adapters/`) — OpenAI, Anthropic, Google, xAI, local adapters implementing `ProviderAdapter`

### Key Interfaces

- `ProviderAdapter` (`src/adapters/types.ts`) — configure, listModels, chat
- `CNF` (`src/cnf/types.ts`) — Context Normal Form: sessionId, messages[], artifacts[], scratch
- `Judge` (`src/arena/types.ts`) — score(candidate, rubric) → Score
- `CompetitionSpec` (`src/arena/competition.ts`) — providers, mode, judges, rubric
- `DebateConfig` (`src/arena/debate.ts`) — providerA, providerB, prompt, rounds, judge

### Provider Registry

`src/adapters/index.ts` — global registry. `getProvider(name)`, `registerProvider(name, adapter)`, `configureProviders(config)`.

### Configuration

`arena.config.yaml` — providers, models, server settings. Env vars via `${VAR}` or `${VAR:-default}`.

## Code Style

- ES Modules (`"type": "module"`)
- Strict TypeScript
- Tests co-located with source (`*.test.ts`) + `tests/` for integration/mocks
- Vitest with globals enabled
- Immutable CNF transforms (return new objects, don't mutate)

## Important Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Bootstrap: loadConfig → configureProviders → startServer |
| `src/http/routes.ts` | All HTTP endpoints |
| `src/core/operations.ts` | invokeOperation, competeOperation |
| `src/arena/competition.ts` | Round-robin competition logic |
| `src/arena/debate.ts` | DebateCoordinator with trace emission |
| `src/arena/heuristic-judge.ts` | Length/keywords/structure scoring |
| `src/arena/llm-judge.ts` | LLM-as-judge with JSON parsing |
| `src/cnf/types.ts` | CNF, Message, Artifact types |
| `src/cnf/schema.ts` | Zod validation |
| `src/cnf/transform.ts` | appendMessage, extractLastMessage, redactSecrets |
| `src/cnf/compression.ts` | Conversation compression |
| `src/adapters/index.ts` | Provider registry |
| `arena.config.yaml` | Runtime config |

## Testing

- 59 tests across 47 test files
- Mock adapter in `tests/mocks/mock-adapter.ts` — queue responses with `queueResponse()`
- Mock CNF helper in `tests/mocks/mock-cnf.ts`
- Integration tests in `tests/integration/`
- Live API tests gated behind `RUN_LIVE_TESTS=true`

## Known Issues

- `.worktrees/phase3-research/` contains stale Phase 3 prototype code with 4 failing tests (not part of main codebase)
- Google adapter may fail if `GOOGLE_API_KEY` not configured
- Cascade competition mode not implemented (throws error)
- No web UI — API only
