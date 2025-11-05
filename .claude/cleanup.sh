#!/bin/bash
# Smart cleanup that detects project type

echo "  🧹 Running cleanup..."

# Detect project type and clean accordingly
if [ -f "package.json" ]; then
    # Node.js project
    rm -rf node_modules/.cache 2>/dev/null || true
    rm -rf .next .turbo .parcel-cache 2>/dev/null || true
    echo "  ✓ Cleaned Node.js artifacts"
elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    # Python project
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf .pytest_cache .mypy_cache 2>/dev/null || true
    echo "  ✓ Cleaned Python artifacts"
elif [ -f "Cargo.toml" ]; then
    # Rust project
    rm -rf target/debug target/release 2>/dev/null || true
    echo "  ✓ Cleaned Rust artifacts"
elif [ -f "go.mod" ]; then
    # Go project
    go clean -cache 2>/dev/null || true
    echo "  ✓ Cleaned Go artifacts"
fi

# Universal cleanup
rm -f .DS_Store Thumbs.db *~ 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

# Repository hygiene checks
if git diff --cached | grep -E "console\.(log|debug)|debugger" > /dev/null 2>&1; then
    echo "  ⚠️  Debug statements found"
fi

if git diff | grep -iE "api.?key|password|secret|token" > /dev/null 2>&1; then
    echo "  ⚠️  Potential secrets detected"
fi

echo "  ✓ Cleanup complete"
