#!/bin/bash

# Quick Vercel Deployment Status Check

echo "🔍 Checking deployment status..."
echo ""

# Check if latest commit is on GitHub
LATEST_COMMIT=$(git log --oneline -1 | cut -d' ' -f1)
echo "✅ Latest local commit: $LATEST_COMMIT"

# Check GitHub for latest commit
echo "📡 Checking GitHub..."
GITHUB_COMMIT=$(curl -s "https://api.github.com/repos/Chrisvolcano/supervolcano-teleops/commits?per_page=1" | grep -o '"sha":"[^"]*"' | head -1 | cut -d'"' -f4 | head -c 8)
echo "✅ Latest GitHub commit: $GITHUB_COMMIT"

if [ "$LATEST_COMMIT" = "$GITHUB_COMMIT" ]; then
  echo ""
  echo "✅ Commits are synced!"
  echo ""
  echo "🔍 Next steps to check Vercel:"
  echo "   1. Visit: https://vercel.com/dashboard"
  echo "   2. Find project: supervolcano-teleoperator-portal"
  echo "   3. Check 'Deployments' tab for commit $LATEST_COMMIT"
  echo ""
  echo "⏱️  Typical deployment time: 2-5 minutes"
else
  echo ""
  echo "⚠️  Commits may not be synced yet"
  echo "   Local:  $LATEST_COMMIT"
  echo "   GitHub: $GITHUB_COMMIT"
fi

echo ""
echo "📋 Quick Links:"
echo "   • Vercel Dashboard: https://vercel.com/dashboard"
echo "   • GitHub Repo: https://github.com/Chrisvolcano/supervolcano-teleops"
echo ""

