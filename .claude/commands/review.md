---
name: review
description: Analyze workflow setup and suggest improvements
---

When the user types /review, perform this workflow analysis:

## Workflow Review

Analyze the current project setup and provide actionable suggestions.

### 1. Check Project Configuration

**AGENTS.md Analysis:**
- Read AGENTS.md and assess:
  - Is the "Current Focus" section up to date?
  - Are the build/test/run commands documented?
  - Is the architecture section helpful?
- Suggest specific improvements if needed

**CLAUDE.md Check:**
- Verify it references AGENTS.md
- Check if CLAUDE.local.md exists for personal notes

### 2. Git Status Review

- Check for uncommitted changes
- Note if there are many uncommitted files (suggest committing)
- Check current branch

### 3. Context Health

- Estimate current context usage
- Suggest `/clear` if context seems cluttered
- Note if this is a long-running session

### 4. Documentation Check

- Check docs/plans/ for any stale plans
- Suggest archiving completed plans
- Note any TODOs in code that might need attention

### 5. Output Format

Provide a brief summary:

```
📊 Workflow Review for [project-name]

✅ Good:
- [what's working well]

⚠️ Suggestions:
- [specific actionable improvements]

📝 Quick Actions:
- [ ] [immediate action 1]
- [ ] [immediate action 2]
```

Keep the review **concise and actionable** - no more than 15 lines total.
Focus on the most impactful 2-3 suggestions, not exhaustive analysis.

If everything looks good, just say:
```
✅ Workflow looks healthy! No issues found.
Tip: Use /clear before starting your next task.
```
