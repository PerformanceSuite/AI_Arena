# AI Arena

> Unified multi-AI interface with intelligent competition and judging

AI Arena is a standalone tool that provides a single interface across multiple AI providers, enabling AI-to-AI competition, context transfer between models, and intelligent output selection through pluggable judging systems.

[![Phase](https://img.shields.io/badge/phase-1%20in%20progress-yellow)](docs/ROADMAP.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

### 🎯 Core Capabilities

- **Unified Multi-AI Interface** - Single API across OpenAI, Anthropic, Google, and local models
- **AI Competition** - Run multiple models against the same prompt and select the best output
- **Context Bridge** - Transfer conversation state between providers using Context Normal Form (CNF)
- **Pluggable Judges** - Heuristic and LLM-based scoring with customizable rubrics
- **Multiple Interfaces** - HTTP API, MCP server, optional NATS integration

### 🏆 Competition Modes

- **Round-Robin** - All providers compete, highest-scored wins
- **Cascade** - Start with cheap models, escalate to quality as needed
- **Debate, Jury, Blend** _(Phase 2)_ - Advanced multi-turn interactions

### ⚖️ Judging System

- **Heuristic Judges** - Fast, deterministic scoring (length, keywords, structure)
- **LLM Judges** - AI-powered evaluation with reasoning
- **Composite Scoring** - Weighted combination of multiple judges
- **Custom Rubrics** - YAML/JSON-based criteria definition

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/PerformanceSuite/AI_Arena.git
cd AI_Arena

# Install dependencies
pnpm install

# Build
pnpm build
```

### Configuration

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

judging:
  defaultJudge: openai:gpt-4o-mini
  heuristics:
    enable: true
```

Set environment variables:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
```

### Run

```bash
# Start the server
pnpm dev

# Server runs on http://localhost:3457
```

## Usage

### HTTP API

#### Run a Competition

```bash
curl -X POST http://localhost:3457/compete \
  -H 'Content-Type: application/json' \
  -d '{
    "cnf": {
      "sessionId": "demo-123",
      "messages": [
        {"role": "user", "content": "Write a haiku about AI"}
      ]
    },
    "spec": {
      "providers": [
        {"name": "openai", "model": "gpt-4o-mini"},
        {"name": "anthropic", "model": "claude-3-5-sonnet-20241022"}
      ],
      "mode": "round-robin",
      "rubric": {
        "weights": {"creativity": 0.5, "structure": 0.5},
        "keywords": ["haiku", "syllables"]
      }
    }
  }'
```

Response:

```json
{
  "winner": {
    "id": "anthropic:claude-3-5-sonnet-20241022",
    "text": "Silicon minds think\nPatterns emerge from the code\nWisdom without breath",
    "score": 0.92,
    "breakdown": {
      "creativity": 0.95,
      "structure": 0.89
    }
  },
  "leaderboard": [...]
}
```

#### Single Provider Invocation

```bash
curl -X POST http://localhost:3457/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "cnf": {
      "sessionId": "chat-1",
      "messages": [
        {"role": "user", "content": "Hello!"}
      ]
    },
    "provider": {"name": "openai", "model": "gpt-4o-mini"}
  }'
```

#### List Available Models

```bash
curl http://localhost:3457/models
```

### MCP Server

AI Arena exposes MCP tools for use in Claude Desktop, Cline, and other MCP clients:

```json
{
  "mcpServers": {
    "ai-arena": {
      "command": "node",
      "args": ["path/to/AI_Arena/dist/index.js"]
    }
  }
}
```

Available tools:
- `arena_compete` - Run AI competition
- `arena_invoke` - Single provider chat
- `arena_judge` - Score candidates
- `arena_list_models` - List available models

## Architecture

### Context Normal Form (CNF)

CNF is the universal conversation format that bridges different AI providers:

```typescript
{
  sessionId: "unique-id",
  messages: [
    {
      role: "user" | "assistant" | "system" | "tool",
      content: "message text",
      attachments?: [...],
      citations?: [...]
    }
  ],
  artifacts?: [...],  // Generated outputs
  scratch?: {...}     // Temporary state
}
```

### Provider Adapters

Each AI provider implements the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  configure(config: ProviderConfig): Promise<void>;
  listModels(): Promise<ModelSpec[]>;
  chat(args: ChatArgs): Promise<ChatResult>;
}
```

**Phase 1 Providers:**
- ✅ OpenAI (GPT-4, GPT-4o)
- ✅ Anthropic (Claude 3.5)
- ✅ Google (Gemini 1.5)
- ✅ Local (LiteLLM/Ollama)

**Phase 2 Providers:**
- 📋 xAI (Grok)
- 📋 Mistral
- 📋 Cohere
- 📋 AWS Bedrock

### Three-Layer System

```
Interface Layer (HTTP/MCP/NATS)
           ↓
Core Layer (CNF/Competition/Judges)
           ↓
Provider Layer (OpenAI/Anthropic/Google/Local)
```

See [TECHNICAL.md](docs/TECHNICAL.md) for detailed architecture.

## Development

### Commands

```bash
pnpm install      # Install dependencies
pnpm build        # Compile TypeScript
pnpm dev          # Run with hot reload
pnpm test         # Run unit + integration tests
pnpm test:smoke   # Run live API tests (requires API keys)
```

### Testing

**Unit Tests** - All mocked, no API calls:
```bash
pnpm test
```

**Smoke Tests** - Optional live API validation:
```bash
export RUN_LIVE_TESTS=true
pnpm test:smoke
```

### Project Structure

```
src/
  index.ts              # Entry point
  http.ts, mcp.ts, nats-bridge.ts
  core/
    operations.ts       # Unified operation handlers
  cnf/
    schema.ts, transform.ts
  adapters/
    openai.ts, anthropic.ts, google.ts, local.ts
  arena/
    competition.ts, judges.ts, rubric.ts
  util/
    config.ts, logging.ts, validation.ts
```

## Documentation

- **[Design Document](docs/plans/2025-11-04-phase1-implementation-design.md)** - Phase 1 design
- **[Technical Details](docs/TECHNICAL.md)** - Architecture and implementation
- **[Roadmap](docs/ROADMAP.md)** - Feature timeline
- **[CLAUDE.md](CLAUDE.md)** - Guidance for Claude Code

## CommandCenter Integration

AI Arena can run standalone or integrate with [CommandCenter](https://commandcenter.cc):

### Standalone
```bash
pnpm dev  # HTTP :3457, MCP stdio
```

### CommandCenter Integration
```bash
# Copy manifest to CommandCenter
cp manifest.json /path/to/CommandCenter/tools/ai-arena/

# Refresh tools
pnpm hub:tools:refresh

# Monitor events
pnpm hub:events  # Tail arena.* topics
```

## Rubric Examples

### README Generation

```yaml
# rubrics/readme.yaml
weights:
  correctness: 0.4
  completeness: 0.3
  structure: 0.2
  style: 0.1
keywords: [install, usage, configuration, license]
```

### Code Generation

```yaml
# rubrics/codegen.yaml
weights:
  correctness: 0.5
  tests: 0.2
  maintainability: 0.2
  docs: 0.1
```

## Roadmap

### Phase 1 (Current) - Foundation
- ✅ CNF schema and transform pipeline
- 🚧 Provider adapters (OpenAI, Anthropic, Google, Local)
- 🚧 Round-robin competition
- 🚧 Pluggable judge system
- 🚧 HTTP API and MCP server

### Phase 2 - Advanced Features
- Debate/Jury/Blend competition modes
- LLM judge improvements
- Artifact storage
- CNF compression

### Phase 3 - Task Executor
- Proactive task execution
- Research/Generate/Verify/Execute pipeline
- Guardrails and safety

### Phase 4 - Hub Integration
- UI visualization
- Real-time monitoring
- Distributed judging

See [ROADMAP.md](docs/ROADMAP.md) for details.

## Contributing

AI Arena is in active development. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by the need for provider-agnostic AI interactions
- Built with Universal Session System v2.1
- Part of the PerformanceSuite ecosystem

---

**Status**: Phase 1 in progress | **Repository**: https://github.com/PerformanceSuite/AI_Arena
