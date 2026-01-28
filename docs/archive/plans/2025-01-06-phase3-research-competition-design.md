# Phase 3: Research-Augmented Competition Design

**Date:** 2025-01-06
**Status:** Approved
**Phase:** 3 - Research-Augmented Competition

## Overview

Phase 3 extends AI Arena's competition capabilities with research tools, enabling AIs to search the web, analyze codebases, and cite sources during competitive tasks. This phase focuses on **research and planning competitions** - NOT autonomous task execution.

### Core Capabilities

1. **Research Tools** - Web search, codebase search, documentation lookup
2. **File Outputs** - AIs write artifacts for comparison (with path allowlists)
3. **Citation Tracking** - Validate and score source quality
4. **Enhanced Competition Modes** - Multi-round debate, Jury, Cascade, Critic-Refine

### Key Principles

- **Research-focused**: Information gathering and analysis, not code execution
- **Hybrid research**: Orchestrated (shared) + tool-based (AI-controlled)
- **Balanced guardrails**: Read-only actions auto-execute, writes require allowlist validation
- **Citation validation**: Verify URLs, file paths, and source accessibility

## Architecture

### 1. Two-Tier Research System

#### Orchestrated Research (Competition-level)
- Runs once before competition starts
- Shared baseline context for all participants
- Reduces duplicate work and token costs
- Configured via `initialResearch` in competition config

**Example:**
```yaml
competition:
  mode: jury
  initialResearch:
    web:
      - "React 19 new features"
      - "React Server Components best practices"
    codebase:
      - pattern: "*.tsx"
        query: "useState"
```

#### Tool-based Research (AI-controlled)
- Each AI calls research tools during their turn
- Personalized deep-dives based on strategy
- Enables differentiation between competitors
- All calls logged in trace for judging

**Benefits:**
- Orchestrated research = efficiency (shared baseline)
- Tool-based research = strategic advantage (targeted investigation)
- Easy to cache orchestrated results
- Flexible for all competition modes

### 2. Core Components

```
src/
  research/
    orchestrator.ts       # Manages orchestrated research phase
    tools.ts              # Research tool implementations
    validator.ts          # Citation validation
  artifacts/
    store.ts              # File writing with allowlist
  competition/
    modes/
      jury.ts             # N providers, M judges
      cascade.ts          # Tiered escalation
      critic-refine.ts    # Critique + revision
    enhancedDebate.ts     # Multi-round with research
```

## Research Tools

### Tool Specifications

#### 1. `research.web(query, maxResults?)`
**Purpose:** Search the web for information

**Implementation:**
- Uses Brave Search API (via MCP)
- Fallback to WebSearch tool if MCP unavailable
- Cached for 1 hour (avoid duplicate queries)

**Returns:**
```typescript
{
  results: [
    {
      title: string,
      snippet: string,
      url: string,
      timestamp: string
    }
  ]
}
```

**Guardrails:**
- Max 10 queries per AI per competition
- 10 second timeout per query
- Results truncated to 50KB max

#### 2. `research.codebase(query, filePattern?)`
**Purpose:** Search local files/codebase

**Implementation:**
- Uses ripgrep for fast text search
- Glob patterns for file filtering
- Path validation against allowlist

**Returns:**
```typescript
{
  results: [
    {
      filePath: string,
      lineNumber: number,
      context: string,  // 3 lines before/after
      match: string
    }
  ]
}
```

**Guardrails:**
- Max 20 searches per AI per competition
- Only search within allowed paths (from policy)
- Results limited to 100 matches

#### 3. `research.docs(url)`
**Purpose:** Fetch and parse documentation

**Implementation:**
- HTTP fetch with markdown conversion
- Extract sections and links
- Content sanitization

**Returns:**
```typescript
{
  content: string,
  sections: string[],
  links: string[],
  fetchedAt: string
}
```

**Guardrails:**
- Max 5 fetches per AI per competition
- 10 second timeout per fetch
- Content truncated to 50KB max
- Only HTTPS URLs allowed

### File Writing

#### `artifact.write(path, content)`
**Purpose:** Save outputs for comparison

**Implementation:**
- Path validation against allowlist (from `policies/validation-policy.json`)
- Default allowed: `artifacts/[sessionId]/[providerId]/[filename]`
- Size and extension validation

**Guardrails:**
- Path must match allowlist patterns
- Max file size: 10MB
- Allowed extensions: `.md`, `.txt`, `.json`, `.yaml`, `.csv`
- Overwrite requires explicit flag

**Example allowlist** (`policies/validation-policy.json`):
```json
{
  "artifacts": {
    "allowedPaths": [
      "artifacts/**",
      "output/**"
    ],
    "blockedPaths": [
      "src/**",
      "node_modules/**",
      ".git/**"
    ],
    "maxFileSize": 10485760,
    "allowedExtensions": [".md", ".txt", ".json", ".yaml", ".csv"]
  }
}
```

## Competition Modes

### 1. Multi-round Debate (Enhanced)

**Extension of Phase 2 debate:**
- Configurable rounds (default: 3, was 2)
- Research tools available between rounds
- Each AI sees opponent's arguments + citations

**Flow:**
1. Orchestrated research (shared baseline)
2. Round 1: Both AIs respond with research
3. Round 2: Both see opponent's R1 + can research more
4. Round 3: Final arguments
5. Judge scores all rounds + cumulative

**Config:**
```yaml
mode: debate
providers: [openai:gpt-4, anthropic:claude-3-5-sonnet]
rounds: 3
enableResearch: true
```

### 2. Jury Mode (New)

**N providers compete, M judges score:**
- N AIs research and write proposals independently
- Each can use research tools strategically
- M judge models score using rubric
- Highest average score wins

**Flow:**
1. Orchestrated research (shared baseline)
2. Each provider generates proposal + research
3. All write artifacts to separate directories
4. Judges score each proposal against rubric
5. Aggregate scores, select winner

**Rubric includes:**
- `research_quality` - depth and breadth of sources
- `citation_validity` - % of citations verified
- `argument_strength` - logic and evidence integration
- `completeness` - addresses all aspects of prompt
- `clarity` - writing quality and organization

**Config:**
```yaml
mode: jury
providers: [openai:gpt-4, anthropic:claude-3-5-sonnet, google:gemini-2.0-flash, xai:grok-2]
judges:
  - provider: openai:gpt-4o
    weight: 1.0
  - provider: anthropic:claude-3-5-sonnet
    weight: 1.0
rubric:
  research_quality: 0.3
  citation_validity: 0.2
  argument_strength: 0.3
  completeness: 0.1
  clarity: 0.1
enableResearch: true
```

### 3. Cascade Mode (New)

**Start cheap, escalate to quality:**
- Tiered provider list (cheap → expensive)
- Research cached and reused across tiers
- Stop when score ≥ threshold OR max tier reached

**Flow:**
1. Orchestrated research once (shared across tiers)
2. Tier 1 (cheap model) generates + uses research tools
3. Judge scores → if ≥ threshold, done
4. Else: Tier 2 (better model) with cached research
5. Repeat until threshold met or max tier

**Use case:** Cost optimization while maintaining quality

**Config:**
```yaml
mode: cascade
providerTiers:
  - provider: openai:gpt-4o-mini
    threshold: 7.0
  - provider: openai:gpt-4
    threshold: 8.5
  - provider: anthropic:claude-3-5-sonnet
    threshold: null  # final tier, no threshold
judge: openai:gpt-4o
enableResearch: true
```

### 4. Critic-Refine Mode (New)

**Iterative improvement through critique:**
- One AI generates proposal with research
- Critic AI reviews and identifies weaknesses
- Original AI refines based on critique

**Flow:**
1. Orchestrated research (shared baseline)
2. Provider generates proposal + research
3. Writes artifact: `artifacts/[sessionId]/original.md`
4. Critic receives proposal + citations
5. Critic identifies weak citations, logic gaps
6. Writes artifact: `artifacts/[sessionId]/critique.md`
7. Provider sees critique, refines proposal
8. Writes artifact: `artifacts/[sessionId]/refined.md`
9. Judge scores original vs refined

**Config:**
```yaml
mode: critic-refine
provider: anthropic:claude-3-5-sonnet
critic: openai:gpt-4
judge: google:gemini-2.0-flash
enableResearch: true
```

## Citation Validation

### CNF Schema Extension

New field in CNF:
```typescript
interface CNF {
  // ... existing fields
  citations: Citation[]
}

interface Citation {
  id: string           // Unique citation ID
  source: "web" | "codebase" | "docs"
  url?: string         // For web/docs
  filePath?: string    // For codebase
  lineNumber?: number  // For codebase
  snippet: string      // Quoted evidence
  claimedBy: string    // Provider ID
  addedAt: string      // Timestamp
}
```

### CitationValidator

**Validation rules:**

1. **Web citations:**
   - Send HEAD request to URL
   - Check HTTP 200-299 response
   - Mark as `broken` if 404/timeout

2. **Codebase citations:**
   - Verify file path exists
   - Check line number is valid
   - Verify snippet matches file content

3. **Docs citations:**
   - Validate URL accessibility
   - Optional: content hash verification

**Returns:**
```typescript
{
  valid: number,        // Count of verified citations
  broken: number,       // Count of inaccessible citations
  unverifiable: number, // Count unable to verify
  details: [
    { citationId: string, status: "valid"|"broken"|"unverifiable", reason?: string }
  ]
}
```

## Judging Enhancements

### Heuristic Judges (New Criteria)

1. **Citation count:**
   - Score based on number of citations (diminishing returns)
   - Formula: `min(10, citations.length * 2)`

2. **Citation diversity:**
   - Bonus for using multiple source types
   - `(uniqueSources / 3) * 10` where sources = web, codebase, docs

3. **Broken link penalty:**
   - Deduct points for invalid citations
   - Formula: `10 - (brokenCitations * 2)`

4. **Research depth:**
   - Score based on research tool usage
   - Balance: too few = shallow, too many = unfocused

### LLM Judge Enhancements

**Enhanced prompt includes:**
- All competitor artifacts (can read files)
- Citation lists with validation status
- Rubric with weighted criteria
- Research tool usage logs

**Example judge prompt:**
```
You are judging a research competition. Evaluate each proposal based on:

1. Research Quality (30%): Depth, breadth, and relevance of sources
2. Citation Validity (20%): Are sources accessible and credible?
3. Argument Strength (30%): Logic, evidence integration, persuasiveness
4. Completeness (10%): Addresses all aspects of the prompt
5. Clarity (10%): Writing quality and organization

Proposals available:
- artifacts/session-123/provider-openai/proposal.md
- artifacts/session-123/provider-anthropic/proposal.md

Citations:
- Provider openai: 8 citations (7 valid, 1 broken)
- Provider anthropic: 12 citations (12 valid, 0 broken)

Score each proposal 1-10 per criterion, then calculate weighted average.
```

## HTTP API

### New Endpoints

#### `POST /compete/jury`
Run jury mode competition.

**Request:**
```json
{
  "prompt": "Research and propose architecture for real-time collaboration",
  "providers": ["openai:gpt-4", "anthropic:claude-3-5-sonnet", "google:gemini-2.0-flash"],
  "judges": [
    { "provider": "openai:gpt-4o", "weight": 1.0 },
    { "provider": "anthropic:claude-3-5-sonnet", "weight": 1.0 }
  ],
  "rubric": {
    "research_quality": 0.3,
    "citation_validity": 0.2,
    "argument_strength": 0.3,
    "completeness": 0.1,
    "clarity": 0.1
  },
  "enableResearch": true,
  "initialResearch": {
    "web": ["real-time collaboration patterns", "CRDT vs OT"]
  }
}
```

**Response:**
```json
{
  "winner": "anthropic:claude-3-5-sonnet",
  "scores": [
    { "provider": "openai:gpt-4", "score": 7.8, "breakdown": {...} },
    { "provider": "anthropic:claude-3-5-sonnet", "score": 8.5, "breakdown": {...} },
    { "provider": "google:gemini-2.0-flash", "score": 7.2, "breakdown": {...} }
  ],
  "artifacts": {
    "openai:gpt-4": ["artifacts/session-123/openai/proposal.md"],
    "anthropic:claude-3-5-sonnet": ["artifacts/session-123/anthropic/proposal.md"],
    "google:gemini-2.0-flash": ["artifacts/session-123/google/proposal.md"]
  },
  "citations": {
    "openai:gpt-4": { "valid": 7, "broken": 1, "unverifiable": 0 },
    "anthropic:claude-3-5-sonnet": { "valid": 12, "broken": 0, "unverifiable": 0 },
    "google:gemini-2.0-flash": { "valid": 5, "broken": 0, "unverifiable": 2 }
  },
  "trace": "artifacts/session-123/trace.jsonl"
}
```

#### `POST /compete/cascade`
Run cascade mode competition.

**Request:**
```json
{
  "prompt": "Analyze performance bottlenecks in Node.js event loop",
  "providerTiers": [
    { "provider": "openai:gpt-4o-mini", "threshold": 7.0 },
    { "provider": "openai:gpt-4", "threshold": 8.5 },
    { "provider": "anthropic:claude-3-5-sonnet", "threshold": null }
  ],
  "judge": "openai:gpt-4o",
  "enableResearch": true
}
```

**Response:**
```json
{
  "selectedTier": 1,
  "provider": "openai:gpt-4",
  "score": 8.6,
  "response": "...",
  "artifacts": ["artifacts/session-123/openai-gpt4/analysis.md"],
  "citations": { "valid": 9, "broken": 0, "unverifiable": 1 },
  "tiersAttempted": [
    { "tier": 0, "provider": "openai:gpt-4o-mini", "score": 6.5, "belowThreshold": true },
    { "tier": 1, "provider": "openai:gpt-4", "score": 8.6, "metThreshold": true }
  ],
  "trace": "artifacts/session-123/trace.jsonl"
}
```

#### `POST /compete/critic-refine`
Run critic-refine mode competition.

**Request:**
```json
{
  "prompt": "Design a caching strategy for distributed systems",
  "provider": "anthropic:claude-3-5-sonnet",
  "critic": "openai:gpt-4",
  "judge": "google:gemini-2.0-flash",
  "enableResearch": true
}
```

**Response:**
```json
{
  "original": {
    "response": "...",
    "artifact": "artifacts/session-123/original.md",
    "citations": { "valid": 6, "broken": 1, "unverifiable": 0 }
  },
  "critique": {
    "response": "...",
    "artifact": "artifacts/session-123/critique.md",
    "issues": ["Weak citation for CAP theorem", "Missing Redis comparison"]
  },
  "refined": {
    "response": "...",
    "artifact": "artifacts/session-123/refined.md",
    "citations": { "valid": 10, "broken": 0, "unverifiable": 0 }
  },
  "scores": {
    "original": 7.2,
    "refined": 8.8,
    "improvement": 1.6
  },
  "trace": "artifacts/session-123/trace.jsonl"
}
```

#### `POST /debate` (Enhanced)
Enhanced from Phase 2 with research support.

**New query params:**
- `?rounds=3` - Number of debate rounds
- `?enableResearch=true` - Enable research tools

**Response additions:**
```json
{
  // ... existing fields
  "citations": {
    "provider1": { "valid": 8, "broken": 0, "unverifiable": 1 },
    "provider2": { "valid": 6, "broken": 1, "unverifiable": 0 }
  },
  "researchCalls": {
    "provider1": { "web": 5, "codebase": 3, "docs": 2 },
    "provider2": { "web": 4, "codebase": 2, "docs": 1 }
  }
}
```

#### `POST /research` (New - Testing/Debugging)
Direct research tool access for testing.

**Request:**
```json
{
  "type": "web",
  "query": "TypeScript generics best practices",
  "maxResults": 5
}
```

**Response:**
```json
{
  "type": "web",
  "results": [
    { "title": "...", "snippet": "...", "url": "..." }
  ],
  "cached": false,
  "timestamp": "2025-01-06T10:30:00Z"
}
```

## Configuration

### `arena.config.yaml` Additions

```yaml
research:
  enabled: true
  cacheResults: true
  cacheDuration: 3600  # seconds (1 hour)

  quotas:
    maxWebSearches: 10      # per AI per competition
    maxCodebaseSearches: 20
    maxDocsLookups: 5

  timeouts:
    webSearch: 10000        # milliseconds
    codebaseSearch: 5000
    docsLookup: 10000

  limits:
    maxResultsPerCall: 50
    maxContentSize: 51200   # 50KB

artifacts:
  baseDir: "artifacts"
  sessionPattern: "[sessionId]/[providerId]"

  allowedPaths:
    - "artifacts/**"
    - "output/**"

  blockedPaths:
    - "src/**"
    - "node_modules/**"
    - ".git/**"

  maxFileSize: 10485760     # 10MB
  allowedExtensions:
    - .md
    - .txt
    - .json
    - .yaml
    - .csv

citations:
  validation:
    enabled: true
    checkWebUrls: true
    checkCodebasePaths: true
    timeoutMs: 5000

  scoring:
    validWeight: 1.0
    brokenPenalty: -2.0
    unverifiablePenalty: -0.5
```

## MCP Server Additions

New MCP tools:

1. **`ai_arena_compete_jury`**
   - Inputs: prompt, providers[], judges[], rubric, enableResearch
   - Returns: winner, scores, artifacts, citations, trace

2. **`ai_arena_compete_cascade`**
   - Inputs: prompt, providerTiers[], judge, enableResearch
   - Returns: selectedTier, score, artifacts, citations, trace

3. **`ai_arena_compete_critic_refine`**
   - Inputs: prompt, provider, critic, judge, enableResearch
   - Returns: original, critique, refined, scores, trace

4. **Enhanced: `ai_arena_debate`**
   - Add inputs: rounds, enableResearch
   - Add outputs: citations, researchCalls

## NATS Integration

### Enhanced Trace Events

Existing topics: `arena.invoke`, `arena.trace`, `arena.result`

New trace event types:
```json
{ "event": "research.started", "tool": "web_search", "query": "...", "timestamp": "..." }
{ "event": "research.completed", "tool": "web_search", "results": 5, "cached": false }
{ "event": "research.cached", "tool": "web_search", "query": "...", "cacheAge": 1200 }
{ "event": "citation.added", "citationId": "cit-123", "source": "web", "url": "..." }
{ "event": "citation.validated", "citationId": "cit-123", "status": "valid" }
{ "event": "artifact.written", "path": "artifacts/.../proposal.md", "size": 4096 }
{ "event": "artifact.rejected", "path": "src/index.ts", "reason": "blocked path" }
```

## Implementation Plan Overview

### Phase 3A: Research Infrastructure (Week 1)
- ResearchOrchestrator
- Research tools (web, codebase, docs)
- Tool caching
- Citation tracking in CNF
- Basic guardrails

### Phase 3B: Artifact Management (Week 1-2)
- ArtifactStore with allowlist validation
- File writing tool
- Path resolution and security
- Policy file loading

### Phase 3C: Competition Modes (Week 2-3)
- Multi-round debate enhancement
- Jury mode
- Cascade mode
- Critic-refine mode

### Phase 3D: Judging & Validation (Week 3-4)
- CitationValidator
- Enhanced heuristic judges
- LLM judge prompt updates
- Rubric enhancements

### Phase 3E: API & Integration (Week 4)
- HTTP endpoints
- MCP tools
- NATS trace events
- Config file loading
- Documentation and examples

## Success Criteria

✅ **Research capabilities:**
- [ ] AIs can search web, codebase, and docs during competition
- [ ] Orchestrated research reduces duplicate queries
- [ ] Research results cached appropriately
- [ ] All research calls logged in trace

✅ **File outputs:**
- [ ] AIs write artifacts to allowlist paths only
- [ ] Path validation prevents unauthorized writes
- [ ] Artifacts preserved for judging
- [ ] Size and extension limits enforced

✅ **Competition modes:**
- [ ] Multi-round debate supports 3+ rounds with research
- [ ] Jury mode runs N providers with M judges
- [ ] Cascade mode escalates through tiers
- [ ] Critic-refine mode produces original + critique + refined

✅ **Citation validation:**
- [ ] Web URLs verified for accessibility
- [ ] Codebase paths validated
- [ ] Citation validity scored in judging
- [ ] Broken citations penalized

✅ **Integration:**
- [ ] HTTP API endpoints working
- [ ] MCP tools registered
- [ ] NATS trace events published
- [ ] Config file loaded and validated

✅ **Quality:**
- [ ] >80% test coverage for new modules
- [ ] Integration tests for all competition modes
- [ ] Guardrails prevent unauthorized actions
- [ ] Documentation and examples complete

## Testing Strategy

### Unit Tests
- ResearchOrchestrator (orchestrated + tool-based research)
- Research tools (mocked web/file access)
- CitationValidator (various URL/path scenarios)
- ArtifactStore (allowlist validation)
- Competition modes (mocked providers)

### Integration Tests
- Full jury competition with 3 providers
- Cascade escalation through tiers
- Critic-refine workflow
- Multi-round debate with research
- Citation validation end-to-end

### Smoke Tests (Optional - Live APIs)
- Real web search via Brave API
- Real codebase search on test repo
- Real LLM judges scoring
- Real artifact file writes

## Security Considerations

1. **Path traversal prevention:**
   - Resolve all paths to absolute
   - Check against allowlist AFTER resolution
   - Block `..` and symlinks

2. **Content size limits:**
   - Truncate large research results
   - Reject oversized file writes
   - Prevent memory exhaustion

3. **Rate limiting:**
   - Per-AI quotas on research calls
   - Per-competition token budgets
   - Timeouts on all external calls

4. **Input validation:**
   - Sanitize URLs before fetching
   - Validate file patterns (no shell injection)
   - Escape paths in system calls

5. **Audit logging:**
   - Log all policy violations
   - Log all file writes
   - Log all research calls
   - Traces stored for review

## Future Enhancements (Phase 4+)

- **Advanced research tools:**
  - Database queries
  - API exploration
  - Vector search over embeddings

- **Collaborative research:**
  - AIs share research cache
  - Build on each other's findings

- **Research quality metrics:**
  - Source credibility scoring
  - Bias detection
  - Fact-checking integration

- **UI visualization:**
  - Research graph visualization
  - Citation network display
  - Artifact comparison view

---

**Approved:** 2025-01-06
**Implementation Start:** TBD
**Estimated Timeline:** 4 weeks
