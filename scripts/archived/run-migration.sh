#!/bin/bash

# Organizations Migration Runner
# Usage: ./run-migration.sh [DEPLOYMENT_URL]

set -e

DEPLOYMENT_URL="${1:-}"

if [ -z "$DEPLOYMENT_URL" ]; then
  echo "❌ Please provide your Vercel deployment URL"
  echo ""
  echo "Usage:"
  echo "  ./run-migration.sh https://your-app.vercel.app"
  echo ""
  echo "Or set it interactively:"
  read -p "Enter your Vercel deployment URL: " DEPLOYMENT_URL
fi

# Remove trailing slash if present
DEPLOYMENT_URL="${DEPLOYMENT_URL%/}"

MIGRATION_URL="${DEPLOYMENT_URL}/api/admin/migrate/add-organizations"

echo "🚀 Running Organizations Migration..."
echo "📍 URL: $MIGRATION_URL"
echo ""

# Run the migration
echo "⏳ Executing migration..."
RESPONSE=$(curl -s "$MIGRATION_URL")

# Check if response contains success
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Migration completed successfully!"
  echo ""
  echo "📊 Results:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
  echo "❌ Migration may have failed or returned unexpected response:"
  echo "$RESPONSE"
  exit 1
fi

echo ""
echo "✅ Next steps:"
echo "   1. Check Firestore Console → organizations collection"
echo "   2. Verify users have prefixed organizationIds"
echo "   3. Test the organization dropdowns in /admin/users"
echo ""

