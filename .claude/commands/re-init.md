---
name: re-init
description: Update USS infrastructure without losing project docs or memory
---

When the user types /re-init, perform these actions:

1. Say "🔄 Updating USS infrastructure (preserving your docs and memory)..."

2. **Backup current state**:
   ```bash
   # Create safety backup
   cp -r .claude .claude.backup.$(date +%s)
   ```

3. **Update USS commands**:
   ```bash
   USS_TEMPLATES="/Users/danielconnolly/Projects/universal-session-system/templates"

   # Update /start command
   cp "$USS_TEMPLATES/commands/start.md" .claude/commands/start.md

   # Update /end command
   cp "$USS_TEMPLATES/commands/end.md" .claude/commands/end.md

   # Update /init-project command
   cp "$USS_TEMPLATES/commands/init-project.md" .claude/commands/init-project.md

   # Update /re-init command (this command itself!)
   cp "$USS_TEMPLATES/commands/re-init.md" .claude/commands/re-init.md
   ```

4. **Update session scripts**:
   ```bash
   # Update session management scripts
   cp "$USS_TEMPLATES/session-start" ./session-start
   cp "$USS_TEMPLATES/session-end" ./session-end
   cp "$USS_TEMPLATES/session-status" ./session-status
   cp "$USS_TEMPLATES/session-memory" ./session-memory
   cp "$USS_TEMPLATES/session-last" ./session-last
   chmod +x session-*
   ```

5. **Update infrastructure scripts** (cleanup):
   ```bash
   # Update cleanup script
   cp "$USS_TEMPLATES/cleanup.sh" .claude/cleanup.sh
   chmod +x .claude/cleanup.sh
   ```

6. **PRESERVE (do NOT touch)**:
   - ✅ `docs/PROJECT.md` - Your project context
   - ✅ `docs/CURRENT_SESSION.md` - Your session notes
   - ✅ `docs/ROADMAP.md` - Your roadmap
   - ✅ `docs/TECHNICAL.md` - Your technical docs
   - ✅ `.claude/memory.md` - Your memory
   - ✅ `.claude/logs/` - Your session logs

7. **Report what was updated**:
   ```
   ✅ USS Re-initialization Complete!

   Updated:
   - /start, /end, /init-project commands
   - session-* scripts
   - cleanup.sh and rotate-memory.sh

   Preserved:
   - All docs/* files
   - .claude/memory.md
   - .claude/logs/

   Backup created at: .claude.backup.[timestamp]
   ```

8. Say "✅ USS infrastructure updated! Your docs and memory are preserved."

**Key differences from /init-project:**
- `/init-project` = Full initialization (creates new docs from templates)
- `/re-init` = Infrastructure update only (preserves your content)

**When to use:**
- Use `/re-init` to get latest USS features without losing project context
- Use `/init-project` only for brand new projects or complete reset
