#!/bin/bash

# install-and-commit.sh
# Wrapper script that runs pnpm install and automatically commits package.json and pnpm-lock.yaml
# Usage: ./scripts/install-and-commit.sh [pnpm install args...]

set -e

echo "📦 Running pnpm install..."
pnpm install "$@"

# Check if package files changed
if git diff --quiet package.json pnpm-lock.yaml; then
  echo "✅ No changes to package files"
else
  echo "📝 Package files changed, committing..."

  # Stage package files
  git add package.json pnpm-lock.yaml

  # Create commit message
  if [ -n "$1" ]; then
    # If package name provided, use it in commit message
    PACKAGE_NAME=$(echo "$1" | sed 's/@.*//' | sed 's/^.*\///')
    COMMIT_MSG="chore: Update pnpm-lock.yaml after installing $PACKAGE_NAME"
  else
    COMMIT_MSG="chore: Update pnpm-lock.yaml after pnpm install"
  fi

  # Commit
  git commit -m "$COMMIT_MSG" || {
    echo "⚠️  Commit failed (might be no changes or already committed)"
    exit 0
  }

  echo "✅ Committed package files"
  echo "💡 Don't forget to push: git push"
fi

echo "✅ Done!"
