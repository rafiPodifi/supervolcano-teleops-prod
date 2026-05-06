#!/bin/bash

# SuperVolcano Robot API Test Script
# Usage: ./test.sh

API_KEY="<YOUR_ROBOT_API_KEY>"
BASE_URL="https://supervolcano-teleops.vercel.app/api/robot"

echo "═══════════════════════════════════════"
echo "SuperVolcano Robot API Test"
echo "═══════════════════════════════════════"
echo ""

echo "1. Testing connection..."
curl -X GET "$BASE_URL/health" \
  -H "X-Robot-API-Key: $API_KEY" \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""

echo "2. Getting all locations..."
curl -X GET "$BASE_URL/locations" \
  -H "X-Robot-API-Key: $API_KEY" \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""

echo "3. Getting jobs at Isaac's House..."
LOCATION_ID="bd577ffe-d733-4002-abb8-9ea047c0f326"
curl -X GET "$BASE_URL/locations/$LOCATION_ID/jobs" \
  -H "X-Robot-API-Key: $API_KEY" \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""

echo "4. Getting all jobs (limit 5)..."
curl -X GET "$BASE_URL/jobs?limit=5" \
  -H "X-Robot-API-Key: $API_KEY" \
  -w "\n\nHTTP Status: %{http_code}\n"
echo ""

echo "═══════════════════════════════════════"
echo "Test Complete!"
echo "═══════════════════════════════════════"

