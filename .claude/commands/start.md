---
name: start
description: Start a work session with smart context loading
---

When the user types /start, perform these actions:

**FIRST: Invoke Core Skills** (MANDATORY - DO NOT SKIP)
- Use Skill tool to invoke: `using-superpowers`
- Use Skill tool to invoke: `context-management`
- These establish mandatory workflows and prevent rationalization
- WAIT for skills to load before proceeding

1. Say "🚀 Starting development session..."

2. **Load Current Context** (not full memory):
   - Read `docs/CURRENT_SESSION.md` if it exists (always < 1000 tokens)
   - If not found, read last 100 lines of `.claude/memory.md`
   - This prevents token overflow issues

3. **Show Project Status**:
   - Display key info from `docs/PROJECT.md` if it exists
   - Otherwise show git status and project structure

4. **Git Status**:
   - Current branch
   - Uncommitted changes (first 10 files)
   - Recent commits (last 3)

5. **Check for TODOs**:
   - Scan codebase for TODO/FIXME comments
   - Show first 5 found

6. **Memory Health Check**:
   - Check `.claude/memory.md` size
   - If > 500 lines, note that rotation will happen on /end
   - Remind about search-conversations for older history

7. Report: "✅ Session started! Ready to work."

**Key improvements:**
- MANDATORY skills invocation (prevents bypassing superpowers)
- Reads CURRENT_SESSION.md first (small, current)
- Avoids reading huge memory files
- Shows memory health proactively
