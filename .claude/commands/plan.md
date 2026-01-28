---
name: plan
description: Create a structured work plan for complex tasks
---

When the user types /plan $ARGUMENTS, create a structured work plan:

## Create Work Plan: $ARGUMENTS

### Instructions

1. **Think deeply** about the task: "$ARGUMENTS"
   - Use extended thinking to consider approaches
   - Identify potential challenges
   - Break into concrete steps

2. **Create plan file** at `docs/plans/[descriptive-name].md` with this structure:

```markdown
# Plan: [Task Name]

**Created**: [date]
**Status**: 🟡 In Progress

## Goal
[One sentence describing the end state]

## Approach
[2-3 sentences on the chosen approach and why]

## Steps

- [ ] Step 1: [specific action]
- [ ] Step 2: [specific action]
- [ ] Step 3: [specific action]
...

## Risks & Mitigations
- Risk: [potential issue] → Mitigation: [how to handle]

## Definition of Done
- [ ] [concrete acceptance criteria]
- [ ] Tests passing
- [ ] Changes committed

## Notes
[Any additional context or decisions made]
```

3. **Update AGENTS.md** "Current Focus" section to reference this plan

4. **Report back** with:
   - Plan file location
   - Summary of steps
   - Suggested first action

### Usage Examples

- `/plan refactor auth system` - Creates docs/plans/refactor-auth.md
- `/plan add stripe integration` - Creates docs/plans/stripe-integration.md
- `/plan fix performance issues` - Creates docs/plans/performance-fix.md

### After Planning

Once the plan is created, you can:
1. Use `/clear` to reset context
2. Tell Claude to "read docs/plans/[name].md and continue"
3. This preserves the plan while giving Claude fresh context
