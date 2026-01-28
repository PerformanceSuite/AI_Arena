---
name: help
description: Show workflow tips and available commands
---

When the user types /help, display this information:

# 🚀 Modern Claude Code Workflow

## Session Management

| Command | Use When |
|---------|----------|
| `claude` | Start fresh session |
| `claude --continue` (or `cc`) | Continue today's work |
| `claude --resume` (or `cr`) | Pick from recent sessions |
| `/clear` | **Use frequently** between distinct tasks |
| `Escape` | Interrupt Claude |
| `Double-Escape` | Edit your last message |

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/help` | This guide |
| `/init` | Initialize new project with AGENTS.md |
| `/review` | Get workflow improvement suggestions |
| `/plan [topic]` | Create a structured work plan |
| `/logs` | View/manage agent sandbox logs |
| `/clear` | Clear context (native - use often!) |
| `/memory` | Open memory files in editor |

## Recommended Workflow

```
Explore → Plan → Implement → Commit → Clear
```

1. **Explore**: "Read the auth files, don't write code yet"
2. **Plan**: "Think hard about how to refactor this" (triggers extended thinking)
3. **Implement**: Execute the plan
4. **Commit**: `git commit` frequently
5. **Clear**: `/clear` before next task

## Extended Thinking Keywords

Use these words to trigger deeper reasoning:
- `"think"` - Light thinking
- `"think hard"` - Medium thinking  
- `"think harder"` - Deep thinking
- `"ultrathink"` - Maximum thinking budget

## Key Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Project instructions (edit this!) |
| `CLAUDE.md` | Claude-specific config (references AGENTS.md) |
| `GEMINI.md` | Gemini-specific config (references AGENTS.md) |
| `docs/plans/` | Store complex work plans here |
| `CLAUDE.local.md` | Your personal notes (gitignored) |

## Multi-Project Work

```bash
# Add another project's files to context
claude --add-dir ../other-project

# Or mid-session
/add-dir ~/Projects/shared-libs
```

## Tips

- Be specific upfront to reduce back-and-forth
- Commit after each successful change
- Use `/clear` between unrelated tasks
- Write plans to files for complex multi-step work
- Press `Shift+Tab` twice for Plan Mode (safe analysis)
- Use `modernize` command to update any project

---
*Run `/review` for personalized workflow suggestions*
