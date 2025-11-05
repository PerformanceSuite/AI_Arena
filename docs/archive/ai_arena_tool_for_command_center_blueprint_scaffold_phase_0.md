# AI Arena Tool for CommandCenter — Unified Multi‑AI Interface, Context Bridge & Proactive Executor

> **Goal:** A standalone tool that plugs into CommandCenter and provides a unified interface across multiple AI providers, transfers context between models to eliminate fragmented conversations, and runs an **AI Competition** that selects, blends, or ensembles the best outputs. It also supports **Proactive Task Execution**: users pose a problem and the system plans, builds, and verifies deliverables autonomously with guardrails.

---

## 0) TL;DR
- **Package name:** `@commandcenter/ai-arena`
- **Drop‑in path:** `tools/ai-arena/`
- **Entry:** `src/index.ts` (CLI + MCP server)  
- **CommandCenter bridge:** NATS mesh bus topics `arena.*` + tool registry manifest
- **Core concepts:**
  - **Context Normal Form (CNF):** portable conversation state + artifacts
  - **Provider Adapters:** OpenAI, Anthropic, Google, xAI, Mistral, Cohere, Bedrock, Local (LiteLLM/Ollama)
  - **Competition Modes:** Round‑Robin, Debate, Jury, Critic‑Refine, Blend, Cascade
  - **Judging:** rubric‑driven scoring by multiple models and heuristics
  - **Proactive Executor:** TaskGraph (Plan → Research → Generate → Verify → Execute), with tool hooks

---

## 1) Architecture Overview

```
+------------------------- CommandCenter Hub --------------------------+
|                                                                     |
|  Mesh Bus (NATS)  <---->  AI Arena Tool  <---->  External Providers |
|     hub.presence.*            |  \                                   |
|     hub.health.*              |   \-- Bridges: MCP, HTTP, CLI        |
|     arena.*                   |                                      |
|                                                                     |
+---------------------------------------------------------------------+

Inside AI Arena Tool

  +---------------------------+
  |  Context Orchestrator     |  CNF <-> Provider prompts/results
  |  - CNF store (files/RAG)  |  Translation, compression, redaction
  +-------------+-------------+
                |
                v
  +---------------------------+         +---------------------------+
  | Provider Adapters         |  <----> | Judge & Rubric Engine     |
  | (openai, anthropic, etc.) |         | - LLM judges & heuristics |
  +-----+-----+-----+---------+         +-------------+-------------+
        |     |     |                                     |
        v     v     v                                     v
  +---------------------------+         +---------------------------+
  | Competition Coordinator   | ----->  | Proactive Task Executor   |
  | Modes: RR, Debate, Jury   |         | TaskGraph: P/R/G/V/E      |
  +-------------+-------------+         +-------------+-------------+
                |                                         |
                v                                         v
          Outputs, traces                            Actions (tools)
```

**Why CNF?** Every provider has different context/conversation formats. CNF ensures we can lift state and artifacts (drafts, files, citations) from one model and drop into another with minimal loss.

---

## 2) Context Normal Form (CNF)
**CNF schema (v0):**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://commandcenter.cc/schemas/cnf.schema.json",
  "type": "object",
  "required": ["sessionId", "messages"],
  "properties": {
    "sessionId": {"type": "string"},
    "tags": {"type": "array", "items": {"type": "string"}},
    "locale": {"type": "string", "default": "en-US"},
    "timezone": {"type": "string", "default": "America/Los_Angeles"},
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["role", "content"],
        "properties": {
          "id": {"type": "string"},
          "role": {"enum": ["user", "assistant", "system", "tool"]},
          "content": {"type": "string"},
          "name": {"type": "string"},
          "timestamp": {"type": "string", "format": "date-time"},
          "attachments": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "kind": {"enum": ["file", "url", "image", "audio", "video", "table"]},
                "mime": {"type": "string"},
                "uri": {"type": "string"},
                "title": {"type": "string"},
                "meta": {"type": "object"}
              }
            }
          },
          "citations": {"type": "array", "items": {"type": "string"}},
          "meta": {"type": "object"}
        }
      }
    },
    "scratch": {"type": "object"},
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "kind", "uri"],
        "properties": {
          "id": {"type": "string"},
          "kind": {"enum": ["doc", "code", "image", "audio", "video", "archive", "other"]},
          "uri": {"type": "string"},
          "title": {"type": "string"},
          "meta": {"type": "object"}
        }
      }
    }
  }
}
```

**Pipelines:**
- **Lift:** Provider transcript → CNF
- **Translate:** CNF → Provider prompt/messages (strict length + role mapping)
- **Compress:** Summarize + embed + chunk for long contexts
- **Redact:** Secrets/PII via ruleset before cross‑provider transfer

---

## 3) Provider Adapter Interface (TypeScript)
```ts
export type ModelSpec = { id: string; family: string; mode: "chat"|"completion"|"tool"|"image"; maxTokens?: number };

export interface ProviderConfig { apiKey?: string; endpoint?: string; modelMap?: Record<string, ModelSpec>; }

export interface ProviderAdapter {
  name: string;
  configure(cfg: ProviderConfig): void;
  listModels(): Promise<ModelSpec[]>;
  chat(input: {
    cnf: CNF;
    targetModel: string; // provider-specific id
    tools?: ToolSpec[];  // JSON tool schemas
    system?: string;     // extra system prompt
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ updatedCNF: CNF; outputText?: string; toolCalls?: ToolCall[]; usage?: TokenUsage }>;
}
```

**Included stubs:** `adapters/openai.ts`, `adapters/anthropic.ts`, `adapters/google.ts`, `adapters/xai.ts`, `adapters/mistral.ts`, `adapters/cohere.ts`, `adapters/bedrock.ts`, `adapters/local.ts` (LiteLLM/Ollama proxy).

---

## 4) Competition Coordinator
**Modes:**
- **Round‑Robin:** each provider produces; select top by Judge score
- **Debate:** A1 vs A2 → cross‑critique → refine → final
- **Jury:** N providers produce; M judges score with rubric; aggregate (Borda/median)
- **Cascade:** fast/cheap → escalating quality until threshold met
- **Blend:** summarize/merge multiple strong candidates
- **Critic‑Refine:** make a critic pass first, then ask one or more providers to revise

**Judging:**
- **Judges:** separate LLMs (can be different providers), plus heuristics (tests pass, lints clean, links valid, citations resolvable, factual checks when web tools enabled)
- **Rubric:** YAML/JSON with weights (correctness, relevance, completeness, style, safety, verifiability)

**Traceability:** every step emits `arena.trace` events with inputs/outputs and scores.

---

## 5) Proactive Task Executor (TaskGraph)
**Lifecycle:** `Plan → Research → Generate → Verify → Execute` with rollback.

**Core actions:**
- `research.web(query)`, `research.codebase(search)`, `research.docs(index)`
- `generate.doc(spec)`, `generate.code(scaffold)`, `generate.test(testSpec)`
- `verify.tests()`, `verify.lint()`, `verify.schema(json, schema)`
- `execute.shell(cmd)`, `execute.fs(write|patch)`, `execute.git(branch|commit|pr)`

**Guardrails:**
- Dry‑run previews; diff approval policy; path allowlist; resource quotas; timeouts
- Policy hooks: `validation-policy.json` loaded from CommandCenter (respected by executor)

---

## 6) CommandCenter Integration
**Tool Registry Manifest (`manifest.json`):**
```json
{
  "id": "ai-arena",
  "name": "AI Arena",
  "version": "0.1.0",
  "entry": "dist/index.js",
  "health": {"path": "/health"},
  "endpoints": {
    "http": {"port": 3457, "routes": ["/invoke", "/health", "/models", "/judge"]},
    "mcp": {"transport": "stdio"},
    "cli": {"bin": "ai-arena"}
  },
  "topics": ["arena.invoke", "arena.trace", "arena.result"],
  "env": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "XAI_API_KEY", "MISTRAL_API_KEY", "COHERE_API_KEY", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
  "permissions": {"fs": ["/Users/danielconnolly/Projects"], "net": true, "shell": true}
}
```

**Mesh Topics:**
- `arena.invoke` — request (CNF + mode + judges + executor plan)
- `arena.trace` — stepwise traces
- `arena.result` — final output, scores, artifacts

**Hub Scripts:**
- `pnpm hub:tools:refresh` — rescan manifests
- `pnpm hub:events` — tail `arena.*`

---

## 7) File Tree (Scaffold)
```
tools/ai-arena/
  package.json
  tsconfig.json
  manifest.json
  README.md
  src/
    index.ts
    orchestrator.ts
    arena.ts
    judges.ts
    taskgraph.ts
    bridges/
      commandcenter.ts
      mcp.ts
      http.ts
    adapters/
      openai.ts
      anthropic.ts
      google.ts
      xai.ts
      mistral.ts
      cohere.ts
      bedrock.ts
      local.ts
    schemas/
      cnf.schema.json
      invoke.schema.json
      result.schema.json
  policies/
    validation-policy.json
```

---

## 8) Key Source Files (Minimal Implementations)

### `package.json`
```json
{
  "name": "@commandcenter/ai-arena",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "ai-arena": "dist/index.js" },
  "scripts": {
    "build": "tsc -p .",
    "dev": "tsx src/index.ts",
    "test": "tsx ./scripts/smoke.ts || echo 'todo'"
  },
  "dependencies": {
    "nats": "^2.15.1",
    "zod": "^3.23.8",
    "yaml": "^2.6.0",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "undici": "^6.19.8"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.2"
  }
}
```

### `src/index.ts` (CLI + Bridges bootstrap)
```ts
import { startNatsBridge } from "./bridges/commandcenter.js";
import { startHttp } from "./bridges/http.js";
import { startMCP } from "./bridges/mcp.js";

(async () => {
  await startNatsBridge();
  await startHttp(3457);
  await startMCP();
  console.log("AI Arena up: NATS+HTTP+MCP");
})();
```

### `src/orchestrator.ts`
```ts
import { compressCNF, redactCNF, translateToProvider, liftFromProvider } from "./util/cnf.js";
import * as adapters from "./adapters/index.js";

export async function runProviders(cnf, plan) {
  const results = [];
  for (const step of plan.sequence) {
    const prov = adapters[step.provider];
    const prepared = await translateToProvider(await redactCNF(await compressCNF(cnf)), step);
    const out = await prov.chat({ cnf: prepared, targetModel: step.model, tools: step.tools, system: step.system });
    cnf = out.updatedCNF;
    results.push({ provider: step.provider, out });
  }
  return { cnf, results };
}
```

### `src/arena.ts` (Competition)
```ts
import { judge } from "./judges.js";
import { runProviders } from "./orchestrator.js";

export async function compete(cnf, spec) {
  const candidates = await Promise.all(spec.providers.map(async p => {
    const { results } = await runProviders(cnf, { sequence: [p] });
    const final = results.at(-1);
    return { id: `${p.name}:${p.model}`, text: final.out.outputText ?? "", meta: final };
  }));
  const scored = await judge(candidates, spec.rubric);
  // blend/aggregate if needed
  return { winner: scored[0], leaderboard: scored };
}
```

### `src/judges.ts`
```ts
export async function judge(candidates, rubric) {
  // minimal heuristic: length + rubric keywords; later: LLM judges
  const scores = candidates.map(c => ({
    id: c.id,
    score: (c.text?.length || 0) * 0.001 + (rubric.keywords?.filter(k => c.text.includes(k)).length || 0),
    text: c.text
  }));
  scores.sort((a,b)=>b.score-a.score);
  return scores;
}
```

### `src/taskgraph.ts`
```ts
export async function execute(spec, tools) {
  // Plan → Research → Generate → Verify → Execute (stubs)
  const plan = spec.plan ?? [{ step: "generate", what: spec.prompt }];
  const artifacts = [];
  for (const s of plan) {
    // call tools.research/generate/verify/execute as configured
  }
  return { artifacts };
}
```

### `src/bridges/commandcenter.ts`
```ts
import { connect, StringCodec } from "nats";
import { compete } from "../arena.js";

export async function startNatsBridge() {
  const nc = await connect({ servers: process.env.NATS_URL || "nats://127.0.0.1:4222" });
  const sc = StringCodec();
  const sub = nc.subscribe("arena.invoke");
  (async () => {
    for await (const m of sub) {
      const req = JSON.parse(sc.decode(m.data));
      const res = await compete(req.cnf, req.spec);
      nc.publish("arena.result", sc.encode(JSON.stringify(res)));
    }
  })();
}
```

---

## 9) Proactive Recipes (Examples)

### A) “Build a docs site”
- Plan: scaffold Docusaurus, write homepage, add CI, deploy to GitHub Pages
- Competition: fast draft (Mistral) → refine (GPT‑4.1) → structure (Claude) → judge blend
- Verify: `npm run build`, link checker, spellcheck
- Execute: write files, init repo, push branch, open PR

### B) “Write an integration blueprint”
- Research: web queries; extract into CNF artifacts
- Generate: two providers produce; judge compares for completeness, citations
- Verify: validate JSON schemas present, lint markdown

---

## 10) Security & Safety
- **Redaction Rules:** secrets, API keys, PII removed before cross‑provider share
- **Model‑specific disclaimers:** opt‑in for sending artifacts to external providers
- **Quotas:** per‑provider token/time budgets
- **Human‑in‑the‑loop:** approval checkpoints per TaskGraph phase

---

## 11) Setup & Run

### Env
```
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export GOOGLE_API_KEY=...
export XAI_API_KEY=...
export MISTRAL_API_KEY=...
export COHERE_API_KEY=...
export NATS_URL=nats://127.0.0.1:4222
```

### Install (inside CommandCenter repo)
```
cd /Users/danielconnolly/Projects/CommandCenter
mkdir -p tools/ai-arena
# copy this scaffold into tools/ai-arena
pnpm -C tools/ai-arena install
pnpm -C tools/ai-arena build
pnpm hub:tools:refresh
```

### Invoke via Mesh
```
# Publish an arena request (example)
node -e '(
 async()=>{
  const { connect,StringCodec }=await import("nats");
  const nc=await connect({servers:process.env.NATS_URL});
  const sc=StringCodec();
  const cnf={sessionId:"demo",messages:[{role:"user",content:"Draft a README for AI Arena"}]};
  const spec={providers:[{name:"openai",model:"gpt-4.1"},{name:"anthropic",model:"claude-3.7"}],rubric:{keywords:["install","usage","license"]}};
  nc.publish("arena.invoke",sc.encode(JSON.stringify({cnf,spec})));
 })()'
```

---

## 12) Roadmap (Phase 0 → 3)
- **Phase 0 (this scaffold):** CNF, NATS bridge, minimal compete/judge
- **Phase 1:** Full adapters (OpenAI/Anthropic/Google/xAI/Mistral), CNF compression/redaction, HTTP API, MCP server
- **Phase 2:** Debate/Jury modes, LLM‑based judges, rubric designer, richer traces, artifact store
- **Phase 3:** Proactive Executor with guardrails, Git/FS tools, CI hooks, policy enforcement

---

## 13) License & Compliance
- MIT by default; configurable. Provider TOS respected. Local opt‑out for cross‑provider data transfer.

---

## 14) Notes
- This is **standalone**; can run outside the hub via CLI/HTTP, and registers into CommandCenter via manifest.  
- Replace stub judges with strong LLM‑judges and add factual‑verification tools when web access is enabled in the hub.

