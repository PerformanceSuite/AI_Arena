#!/bin/bash
# Auto-rotate memory to prevent token overflow

MEMORY_FILE=".claude/memory.md"
ARCHIVE_DIR=".claude/memory_archive"
MAX_LINES=500

if [ -f "$MEMORY_FILE" ]; then
    LINE_COUNT=$(wc -l < "$MEMORY_FILE")
    
    if [ $LINE_COUNT -gt $MAX_LINES ]; then
        echo "  ℹ Rotating memory (${LINE_COUNT} lines > ${MAX_LINES})"
        
        mkdir -p "$ARCHIVE_DIR"
        ARCHIVE_FILE="$ARCHIVE_DIR/memory_$(date +%Y%m%d_%H%M%S).md"
        
        # Archive old content
        head -n $((LINE_COUNT - MAX_LINES)) "$MEMORY_FILE" > "$ARCHIVE_FILE"
        
        # Keep header and recent entries
        head -n 20 "$MEMORY_FILE" > "$MEMORY_FILE.tmp"
        echo -e "\n_Previous sessions archived to: $ARCHIVE_FILE_\n" >> "$MEMORY_FILE.tmp"
        tail -n $MAX_LINES "$MEMORY_FILE" >> "$MEMORY_FILE.tmp"
        
        mv "$MEMORY_FILE.tmp" "$MEMORY_FILE"
        echo "  ✓ Memory rotated to $ARCHIVE_FILE"
    fi
fi
