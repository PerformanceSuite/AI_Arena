# AI Arena

## Overview

AI Arena is a standalone tool that provides a unified interface across multiple AI providers, enabling AI-to-AI competition, context transfer between models, and intelligent output selection through judging systems.

## Current Focus

**Phase 1 Implementation** - Building foundation for iteration:
- Core CNF (Context Normal Form) system for provider-agnostic conversations
- Plugin architecture for AI provider adapters
- Pluggable judging system (heuristic + LLM judges)
- Three interface modes: HTTP API, MCP server, optional NATS bridge

## Core Capabilities

### 1. Unified Multi-AI Interface
Single interface across 8+ AI providers:
- **Fully Implemented (Phase 1)**: OpenAI, Anthropic, Google, Local (LiteLLM/Ollama)
- **Stubbed (Phase 2+)**: xAI, Mistral, Cohere, AWS Bedrock

### 2. Context Bridge (CNF)
Transfers conversation state between AI providers using Context Normal Form:
- Provider-agnostic conversation format
- Lift/Translate pipeline for provider interoperability
- Compression for long contexts (Phase 2)
- Redaction for secrets/PII removal

### 3. AI Competition
Run competitions between models with multiple modes:
- **Round-Robin**: All providers compete, highest score wins
- **Cascade**: Start cheap, escalate to quality models as needed
- **Debate/Jury/Blend**: Advanced modes (Phase 2)

### 4. Judging System
Pluggable architecture supporting multiple judge types:
- **Heuristic Judges**: Fast, free, deterministic (length, keywords, structure)
- **LLM Judges**: Powerful, nuanced scoring using AI models
- **Composite Scoring**: Weighted combination of multiple judges

### 5. Proactive Task Executor (Phase 2+)
Autonomous planning, research, generation, verification, and execution with guardrails.

## Status

- **Current Phase**: Phase 1 - Foundation
- **Branch**: `feature/phase1-implementation` (worktree: `.worktrees/phase1-implementation`)
- **USS Version**: v2.1
- **Repository**: https://github.com/PerformanceSuite/AI_Arena

## Development Status

✅ **Completed:**
- Project initialization with USS v2.1
- Design document approved (`docs/plans/2025-11-04-phase1-implementation-design.md`)
- Worktree setup for isolated development
- Documentation structure

🚧 **In Progress:**
- Documentation updates
- Implementation plan creation

📋 **Next Steps:**
1. Complete documentation updates
2. Push to GitHub
3. Create detailed implementation plan
4. Begin Phase 1 implementation

## Quick Commands

```bash
# Session Management
./session-start   # Start work session (terminal)
./session-end     # End work session (terminal)
/start            # Start work session (Claude)
/end              # End work session (Claude)

# Development (once implemented)
pnpm install      # Install dependencies
pnpm build        # Compile TypeScript
pnpm dev          # Run with hot reload
pnpm test         # Run unit + integration tests
pnpm test:smoke   # Run live API tests (optional)

# Worktree Management
git worktree list                    # List all worktrees
cd .worktrees/phase1-implementation  # Enter Phase 1 worktree
```

## Key Design Decisions

1. **Core-First Architecture**: Build robust CNF and plugin system before breadth
2. **Stateless Adapters**: All conversation state in CNF for easy testing/swapping
3. **Optional NATS**: Tool works standalone via HTTP/MCP; NATS is bonus
4. **Layered Testing**: Mocked unit tests + optional live smoke tests
5. **Foundation for Iteration**: Solid architecture with 4 providers, easily extensible

## Integration

### Standalone Usage
- HTTP API on port 3457
- MCP server via stdio transport
- CLI tool: `ai-arena`

### CommandCenter Integration
- Drop-in via `manifest.json`
- NATS mesh topics: `arena.invoke`, `arena.trace`, `arena.result`
- Can run as external tool or monorepo package

## Documentation

- **Design Document**: `docs/plans/2025-11-04-phase1-implementation-design.md`
- **Technical Details**: `docs/TECHNICAL.md`
- **Roadmap**: `docs/ROADMAP.md`
- **Claude Guidance**: `CLAUDE.md`
- **Blueprint (Phase 0)**: `ai_arena_tool_for_command_center_blueprint_scaffold_phase_0.md`
- **Phase 1 Spec**: `ai_arena_phase_1_deliverable_standalone_repo_command_center_integration.md`

## Success Criteria (Phase 1)

✅ Run round-robin competition with 2+ providers
✅ Judge outputs using heuristic and LLM judges
✅ Access via HTTP API and MCP server
✅ Handle provider failures gracefully
✅ >80% test coverage for core modules
✅ Clear extensibility path for new providers/judges/modes

---

*Single source of truth - updated by /end*
