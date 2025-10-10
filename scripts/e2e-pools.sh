#!/bin/bash
set -euo pipefail

# Script to run end-to-end tests for the pools API

API_BASE="${API_BASE:-http://localhost:3001}"
COOKIE_JAR="${COOKIE_JAR:-cookie.txt}"
COOKIE_JAR_USER2="${COOKIE_JAR_USER2:-cookie2.txt}"

# Helper function to print success messages
print_success() {
  echo "✔ $1"
}

# 1. Login as testuser1
echo "--- Logging in as testuser1 ---"
curl -s -c "$COOKIE_JAR" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser1@example.com", "password": "password123"}' > /dev/null
USER1_ID=$(curl -s -b "$COOKIE_JAR" "$API_BASE/auth/me" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "User 1 ID: $USER1_ID"
print_success "Logged in as testuser1"

# 2. Login as testuser2
echo "\n--- Logging in as testuser2 ---"
curl -s -c "$COOKIE_JAR_USER2" -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser2@example.com", "password": "password123"}' > /dev/null
USER2_ID=$(curl -s -b "$COOKIE_JAR_USER2" "$API_BASE/auth/me" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "User 2 ID: $USER2_ID"
print_success "Logged in as testuser2"

# 3. Create a new pool
echo "\n--- Creating a new pool ---"
CREATE_RESPONSE=$(curl -s -b "$COOKIE_JAR" -X POST "$API_BASE/pools" \
  -H "Content-Type: application/json" \
  -d '{"name": "E2E Test Pool", "volumeGallons": 12000, "sanitizerType": "chlorine", "surfaceType": "pebble"}' \
  -w '\n%{http_code}')
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | tail -n1)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed '$d')
POOL_ID=$(echo "$CREATE_BODY" | sed -n 's/.*"poolId":"\([^"]*\)".*/\1/p')

if [ "$CREATE_STATUS" -ne 201 ] || [ -z "${POOL_ID:-}" ]; then
  echo "Error: Failed to create pool. Status $CREATE_STATUS"
  echo "Response body: $CREATE_BODY"
  exit 1
fi

echo "Created pool with ID: $POOL_ID"
print_success "Pool created"

# 4. List pools and verify creation
echo "\n--- Listing pools ---"
curl -s -b "$COOKIE_JAR" "$API_BASE/pools" | grep -q "$POOL_ID"
print_success "Verified pool in list"

# 5. Fetch the pool by ID
echo "\n--- Fetching pool by ID ---"
curl -s -b "$COOKIE_JAR" "$API_BASE/pools/$POOL_ID" | grep -q "$POOL_ID"
print_success "Fetched pool successfully"

# 6. Patch the pool
echo "\n--- Patching the pool ---"
curl -s -b "$COOKIE_JAR" -X PATCH "$API_BASE/pools/$POOL_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Renamed E2E Pool"}' | grep -q "Renamed E2E Pool"
print_success "Patched pool successfully"

# 7. Member management
echo "\n--- Testing member management ---"
# Verify owner is a member
curl -s -b "$COOKIE_JAR" "$API_BASE/pools/$POOL_ID/members" | grep -q "$USER1_ID"
print_success "Owner is a member"

# Add user2 as a member
curl -s -b "$COOKIE_JAR" -X POST "$API_BASE/pools/$POOL_ID/members" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER2_ID\", \"role\": \"member\"}" > /dev/null
print_success "Added user2 as a member"

# Update user2's role
curl -s -b "$COOKIE_JAR" -X PUT "$API_BASE/pools/$POOL_ID/members/$USER2_ID" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}' > /dev/null
print_success "Updated user2's role to admin"

# Remove user2
curl -s -b "$COOKIE_JAR" -X DELETE "$API_BASE/pools/$POOL_ID/members/$USER2_ID"
print_success "Removed user2 from pool"

# 8. Delete the pool
echo "\n--- Deleting the pool ---"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X DELETE "$API_BASE/pools/$POOL_ID")
if [ "$STATUS_CODE" -ne 204 ]; then
  echo "Error: Expected status code 204 but got $STATUS_CODE"
  exit 1
fi
print_success "Pool deleted successfully"

# 9. Verify deletion
echo "\n--- Verifying pool deletion ---"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$API_BASE/pools/$POOL_ID")
if [ "$STATUS_CODE" -ne 404 ]; then
  echo "Error: Expected status code 404 but got $STATUS_CODE"
  exit 1
fi
print_success "Verified pool is gone (404)"

echo "\n🎉 All tests passed!"
exit 0
