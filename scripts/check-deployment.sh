#!/bin/bash

# Quick script to check Vercel deployment status

echo "🔍 Checking Vercel Deployment Status..."
echo ""

cd "$(dirname "$0")"

# Try to check deployments
echo "Attempting to list deployments..."
npx vercel ls --limit 5 2>&1 | head -30

echo ""
echo "📋 Alternative: Check dashboard at https://vercel.com/dashboard"
echo "   Look for latest commit: $(git log -1 --oneline | cut -d' ' -f1)"

