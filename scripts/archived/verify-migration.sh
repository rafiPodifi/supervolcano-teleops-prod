#!/bin/bash

# Quick Migration Verification Script
# Helps verify the migration ran successfully

echo "🔍 Verifying Organizations Migration..."
echo ""

DEPLOYMENT_URL="${1:-}"

if [ -z "$DEPLOYMENT_URL" ]; then
  read -p "Enter your Vercel deployment URL: " DEPLOYMENT_URL
fi

DEPLOYMENT_URL="${DEPLOYMENT_URL%/}"

echo "📍 Checking deployment: $DEPLOYMENT_URL"
echo ""

# Check if organizations endpoint is accessible
echo "1️⃣ Checking organizations endpoint..."
ORG_RESPONSE=$(curl -s "${DEPLOYMENT_URL}/api/admin/organizations" 2>&1)

if echo "$ORG_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ Organizations endpoint is accessible"
  
  # Count organizations
  ORG_COUNT=$(echo "$ORG_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('organizations', [])))" 2>/dev/null || echo "?")
  echo "   📊 Found $ORG_COUNT organization(s)"
else
  echo "   ⚠️  Organizations endpoint check failed"
  echo "   Response: $ORG_RESPONSE"
fi

echo ""
echo "2️⃣ Manual Verification Steps:"
echo ""
echo "   → Open Firestore Console"
echo "   → Check 'organizations' collection exists"
echo "   → Should see: sv:internal, oem:demo-org"
echo ""
echo "   → Check 'users' collection"
echo "   → Verify organizationId fields are prefixed"
echo ""
echo "3️⃣ Test the UI:"
echo ""
echo "   → Go to: ${DEPLOYMENT_URL}/admin/users"
echo "   → Click 'Create User'"
echo "   → Test organization dropdowns"
echo ""
echo "✅ Migration verification complete!"
echo ""

