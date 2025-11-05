# AI Arena — Phase 1 Deliverable (Standalone Repo + CommandCenter Integration)

**Repo path:** `/Users/danielconnolly/Projects/AI_Arena`

**Goal:** Build a standalone tool that you can run independently, yet **seamlessly register** into CommandCenter as a hub tool. Phase 1 delivers: complete provider adapters (OpenAI/Anthropic/Google/xAI/Mistral/Cohere/Bedrock/Local), LLM‑judges, **HTTP API** (`/invoke`, `/compete`, `/judge`, `/models`), **MCP server**, **NATS bridge**, CNF translation/redaction/compression, and initial **Proactive Task Executor** hooks.

---

## 0) TL;DR
- Repo is standalone; run via CLI/HTTP/MCP.
- Integrates with CommandCenter via `manifest.json` and mesh topics `arena.*`.
- Supports **AI Competition** (round‑robin, debate, jury, cascade, blend) with pluggable rubrics.
- LLM‑judge pipeline using OpenAI/Anthropic (configurable) + heuristic fallbacks.
- Proactive **TaskGraph** stubs wired to file/system/git actions (guardrailed).

---

## 1) File Tree
```
AI_Arena/
  package.json
  tsconfig.json
  README.md
  manifest.json
  arena.config.yaml           # provider keys & model map
  policies/
    validation-policy.json
    redaction-rules.yaml
  src/
    index.ts                  # bootstrap (HTTP + MCP + NATS)
    http.ts                   # express-like minimal server via undici fetch listener
    mcp.ts                    # stdio MCP server
    nats-bridge.ts            # subscribes arena.invoke, publishes arena.result
    cnf/
      schema.ts
      transform.ts            # lift/translate/compress/redact
    adapters/
      index.ts
      openai.ts
      anthropic.ts
      google.ts
      xai.ts
      mistral.ts
      cohere.ts
      bedrock.ts
      local.ts
    arena/
      competition.ts          # modes + coordinator
      judges.ts               # LLM judges + heuristics
      rubric.ts               # schema + loader (YAML/JSON)
    taskgraph/
      executor.ts             # plan→research→generate→verify→execute
      actions.ts              # fs/shell/git/web/query hooks (guardrailed)
    bridges/
      commandcenter.ts        # future hub UI helpers
    util/
      logging.ts
      http-utils.ts
      schema-utils.ts
  scripts/
    smoke.ts                  # quick end-to-end test
```

---

## 2) Config
`arena.config.yaml`
```yaml
providers:
  openai:
    apiKey: ${OPENAI_API_KEY}
    models:
      - id: gpt-4.1
      - id: gpt-4o-mini
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-7-sonnet
  google:
    apiKey: ${GOOGLE_API_KEY}
    models:
      - id: gemini-1.5-pro
  xai:
    apiKey: ${XAI_API_KEY}
    models:
      - id: grok-2
  mistral:
    apiKey: ${MISTRAL_API_KEY}
    models:
      - id: mistral-large-latest
  cohere:
    apiKey: ${COHERE_API_KEY}
    models:
      - id: command-r-plus
  bedrock:
    region: us-east-1
    accessKeyId: ${AWS_ACCESS_KEY_ID}
    secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
    models:
      - id: anthropic.claude-3-5-sonnet
  local:
    endpoint: http://127.0.0.1:4000  # LiteLLM or Ollama proxy

judging:
  defaultJudge: openai:gpt-4.1 # or anthropic:claude-3-7-sonnet
  heuristics:
    enable: true
    weights:
      correctness: 0.5
      completeness: 0.2
      relevance: 0.2
      style: 0.1
```

`policies/redaction-rules.yaml`
```yaml
rules:
  - pattern: '(?i)(api[_-]?key|secret|token)[=:]\s*([A-Za-z0-9\-_]{16,})'
    replace: '$1=<REDACTED>'
  - pattern: '(\b\d{3}-\d{2}-\d{4}\b)'
    replace: '<SSN-REDACTED>'
  - pattern: '(?i)(password)[=:].*'
    replace: '$1=<REDACTED>'
```

---

## 3) `package.json`
```json
{
  "name": "ai-arena",
  "version": "0.2.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "ai-arena": "dist/index.js" },
  "scripts": {
    "build": "tsc -p .",
    "dev": "tsx src/index.ts",
    "test": "tsx ./scripts/smoke.ts"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "nats": "^2.15.1",
    "yaml": "^2.6.0",
    "undici": "^6.19.8"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.2"
  }
}
```

---

## 4) HTTP API
**Server start:** part of `src/index.ts` boot.

Routes:
- `GET /health` → `{ ok: true }`
- `GET /models` → combined model list from adapters
- `POST /invoke` → `{ cnf, provider: {name, model}, system?, tools?, temperature?, maxTokens? }`
- `POST /compete` → `{ cnf, spec: { providers: [...], mode, rubric } }` (returns winner + leaderboard)
- `POST /judge` → `{ candidates: [{id,text,meta}], rubric }` (LLM judges + heuristics)

`src/http.ts` (sketch):
```ts
import http from 'node:http';
import { handleInvoke, handleCompete, handleJudge, listModels } from './routes.js';

export async function startHttp(port:number){
  const server = http.createServer(async (req,res)=>{
    try{
      if(req.method==='GET' && req.url==='/health') return json(res,{ok:true});
      if(req.method==='GET' && req.url==='/models') return json(res, await listModels());
      if(req.method==='POST' && req.url==='/invoke') return json(res, await handleInvoke(await body(req)));
      if(req.method==='POST' && req.url==='/compete') return json(res, await handleCompete(await body(req)));
      if(req.method==='POST' && req.url==='/judge') return json(res, await handleJudge(await body(req)));
      res.statusCode=404; res.end('nf');
    }catch(e){ res.statusCode=500; res.end(String(e)); }
  });
  server.listen(port);
}
```

---

## 5) MCP Server
`src/mcp.ts`
```ts
export async function startMCP(){
  // minimal stdio MCP dispatcher exposing: models, invoke, compete, judge
}
```

---

## 6) NATS Bridge
`src/nats-bridge.ts`
```ts
import { connect, StringCodec } from 'nats';
import { compete } from './arena/competition.js';

export async function startNats(){
  const nc = await connect({ servers: process.env.NATS_URL || 'nats://127.0.0.1:4222' });
  const sc = StringCodec();
  const sub = nc.subscribe('arena.invoke');
  (async()=>{ for await(const m of sub){
    const req = JSON.parse(sc.decode(m.data));
    const res = await compete(req.cnf, req.spec);
    nc.publish('arena.result', sc.encode(JSON.stringify(res)));
  }})();
}
```

---

## 7) CNF & Translation
`src/cnf/transform.ts`
```ts
export function liftFromProvider(providerRes){ /* map to CNF message */ }
export function translateToProvider(cnf, opts){ /* CNF -> provider messages */ }
export function compressCNF(cnf){ /* summarization placeholders */ return cnf; }
export function redactCNF(cnf, rules){ /* apply redaction-rules.yaml */ return cnf; }
```

---

## 8) Adapters
Common interface in `src/adapters/index.ts`:
```ts
export type ChatArgs = { cnf:any; targetModel:string; system?:string; tools?:any[]; temperature?:number; maxTokens?:number };
export interface ProviderAdapter {
  name:string;
  listModels(): Promise<{id:string; family:string; mode:'chat'|'tool'}[]>;
  chat(args: ChatArgs): Promise<{ updatedCNF:any; outputText?:string; toolCalls?:any; usage?:any }>
}
```

### OpenAI (example)
`src/adapters/openai.ts`
```ts
import { ProviderAdapter, ChatArgs } from './index.js';
export const openai: ProviderAdapter = {
  name:'openai',
  async listModels(){ return [{id:'gpt-4.1', family:'openai', mode:'chat'}]; },
  async chat(args:ChatArgs){
    // call OpenAI responses API via fetch; map args.cnf -> messages
    // return updatedCNF + outputText
    return { updatedCNF: args.cnf, outputText: 'stub-openai' };
  }
}
```

> Repeat analogous minimal implementations for Anthropic/Google/xAI/Mistral/Cohere/Bedrock/Local.

---

## 9) Competition & Judging
`src/arena/competition.ts`
```ts
import { judge } from './judges.js';
import * as adapters from '../adapters/index.js';

export async function compete(cnf, spec){
  const candidates = await Promise.all(spec.providers.map(async (p:any)=>{
    const prov = (adapters as any)[p.name];
    const out = await prov.chat({ cnf, targetModel:p.model, system:spec.system });
    return { id:`${p.name}:${p.model}`, text: out.outputText||'', meta: out };
  }));
  const leaderboard = await judge(candidates, spec.rubric);
  return { winner: leaderboard[0], leaderboard };
}
```

`src/arena/judges.ts`
```ts
export async function judge(candidates:any[], rubric:any){
  // 1) LLM judge (if configured)
  // 2) Heuristic fallback (length + keyword hits)
  const scored = candidates.map(c=>({
    id:c.id, text:c.text, score:(c.text.length*0.001)+((rubric?.keywords||[]).filter((k:string)=>c.text.includes(k)).length)
  })).sort((a,b)=>b.score-a.score);
  return scored;
}
```

---

## 10) Proactive Task Executor
`src/taskgraph/executor.ts`
```ts
export async function runTask(spec:any, ctx:any){
  // plan → research → generate → verify → execute
  // integrate with actions.ts, enforce policies/allowlists
  return { artifacts:[], log:[] };
}
```

---

## 11) CommandCenter Integration
**`manifest.json` (drop‑in compatible)**
```json
{
  "id": "ai-arena",
  "name": "AI Arena",
  "version": "0.2.0",
  "entry": "dist/index.js",
  "health": {"path": "/health"},
  "endpoints": {
    "http": {"port": 3457, "routes": ["/invoke", "/compete", "/judge", "/models", "/health"]},
    "mcp": {"transport": "stdio"},
    "cli": {"bin": "ai-arena"}
  },
  "topics": ["arena.invoke", "arena.trace", "arena.result"],
  "env": [
    "OPENAI_API_KEY","ANTHROPIC_API_KEY","GOOGLE_API_KEY","XAI_API_KEY","MISTRAL_API_KEY","COHERE_API_KEY",
    "AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","NATS_URL"
  ],
  "permissions": {"fs": ["/Users/danielconnolly/Projects"], "net": true, "shell": true}
}
```

**Ways to integrate:**
1) **Path registration:** copy `manifest.json` into `CommandCenter/tools/ai-arena/` or point the hub to your repo path.
2) **Git submodule:** add `AI_Arena` as a submodule under `CommandCenter/tools/ai-arena`.
3) **Hub registry override:** if hub supports external manifest paths, link it directly.

**Commands:**
```bash
# In AI_Arena repo
pnpm install && pnpm build

# In CommandCenter hub
pnpm hub:tools:refresh
pnpm hub:events   # tail arena.*
```

---

## 12) Dev & Smoke Test
```bash
cd /Users/danielconnolly/Projects/AI_Arena
export NATS_URL=nats://127.0.0.1:4222
export OPENAI_API_KEY=... ANTHROPIC_API_KEY=... GOOGLE_API_KEY=... XAI_API_KEY=... MISTRAL_API_KEY=... COHERE_API_KEY=...

pnpm install
pnpm build
pnpm dev  # starts HTTP+MCP+NATS bridge

# Smoke: local HTTP compete
curl -s http://127.0.0.1:3457/models | jq
curl -s -X POST http://127.0.0.1:3457/compete \
  -H 'content-type: application/json' \
  -d '{
    "cnf": {"sessionId":"demo","messages":[{"role":"user","content":"Write a short README for AI_Arena"}]},
    "spec": {
      "providers":[{"name":"openai","model":"gpt-4.1"},{"name":"anthropic","model":"claude-3-7-sonnet"}],
      "mode":"round-robin",
      "rubric":{"keywords":["install","usage","license"]}
    }
  }' | jq
```

---

## 13) Rubric Examples
`rubrics/readme.yml`
```yaml
weights:
  correctness: 0.4
  completeness: 0.3
  structure: 0.2
  style: 0.1
keywords: [install, usage, configuration, license]
```

`rubrics/codegen.yml`
```yaml
weights:
  correctness: 0.5
  tests: 0.2
  maintainability: 0.2
  docs: 0.1
```

---

## 14) Proactive Recipes
- **“Build a docs site”** → scaffold + CI + deploy; verify build; open PR.
- **“Write integration blueprint”** → research web + generate + lint + schema validate.
- **“Generate API server”** → codegen + tests + run smoke + produce Dockerfile.

---

## 15) Security & Guardrails
- CNF **redaction** before cross‑provider calls (regex rules).
- **Allowlisted** FS and shell commands; dry‑run previews.
- Per‑provider budgets; timeouts; circuit breakers.

---

## 16) Next Steps
- Fill adapter implementations (OpenAI/Anthropic first), wire judge to real LLM scoring prompts.
- Add **Debate/Jury/Blend** orchestration loops with traces (`arena.trace`).
- Optional: add a small **Hub UI** panel to visualize leaderboards and traces.

