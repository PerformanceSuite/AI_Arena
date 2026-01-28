# AI Arena — Master Plan

## Vision

AI Arena is a platform for running structured competitions between AI models — comparing outputs, running adversarial debates, and using pluggable judges to evaluate quality. It serves as both a standalone API and a potential CommandCenter integration.

## Completed Work

### Phase 0 — Blueprint (Complete)

- Designed CNF schema, provider adapter interface, competition modes
- Defined 4-phase roadmap
- Original blueprint: CommandCenter tool with NATS mesh integration

### Phase 1 — Foundation (Complete)

Built the core platform:
- CNF types, Zod validation, transforms (append, extract, redact)
- Provider adapters: OpenAI, Google, Local
- Provider registry with config-driven setup
- Round-robin competition with parallel execution
- Heuristic judge (length, keywords, structure)
- LLM judge (structured JSON evaluation)
- Core operations layer (invoke, compete)
- HTTP API server (Hono): /health, /models, /invoke, /compete
- Config loader with YAML + env var substitution
- 42 tests, 85.5% coverage
- Live API validation: 4/5 integration tests passed

### Phase 2 — Advanced Features (Complete)

Extended the platform:
- Anthropic adapter (Claude models, system message extraction)
- xAI adapter (Grok via OpenAI-compatible API)
- Debate mode (multi-round adversarial with critique/refine cycle)
- DebateCoordinator with provider registry injection
- CNF compression (summarize strategy)
- Artifact storage (file-based, session-scoped)
- Structured trace events with level filtering
- Trace integration into debate flow
- HTTP debate endpoint
- 59 tests passing

## Phase 3 — Research-Augmented Competition (Designed, Not Started)

### Core Additions

**Research Tools**:
- Web search integration
- Codebase search (grep/AST)
- Documentation lookup
- Citation tracking and validation

**New Competition Modes**:
- Multi-round debate (enhanced with research)
- Jury mode (N generators, M judges)
- Cascade mode (escalate from cheap to expensive models on quality threshold)
- Critic-refine mode (critic pass then revision)

**Enhanced Judging**:
- Citation scoring (are claims backed by sources?)
- Research quality scoring
- File output validation with allowlist

**New API Endpoints**:
- POST /research — standalone research queries
- Enhanced /compete and /debate with research options

### Implementation Approach

5 vertical slices:
1. Research tool infrastructure + web search
2. Codebase search + docs lookup
3. Citation tracking + validation
4. New competition modes (jury, cascade, critic-refine)
5. Enhanced judging + file output validation

## Phase 4 — Hub Integration & UI (Planned)

- CommandCenter integration via NATS mesh
- MCP server (stdio transport) for Claude Desktop/Cline
- Web dashboard for competition visualization
- Proactive task executor (TaskGraph: Plan → Research → Generate → Verify → Execute)
- Manifest registration with CommandCenter hub

## Open Questions

- Should Phase 3 research tools use existing MCP tool infrastructure or custom implementations?
- Is NATS integration still a priority, or is HTTP-only sufficient?
- Should there be a web UI, or is API + MCP sufficient for the use case?
- Clean up or remove `.worktrees/phase3-research/` stale prototype?

## Technical Debt

- Cascade competition mode declared in types but throws "unsupported" at runtime
- `src/arena/judges.ts` duplicates Judge interface already in `src/arena/types.ts`
- Debate route in `routes.ts` creates a fresh `DefaultProviderRegistry` per request instead of reusing
- No request logging middleware on HTTP server
- `.worktrees/` directory contains stale code from previous branches
- `AGENTS.md` and `GEMINI.md` contain outdated session management references
