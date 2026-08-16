#!/usr/bin/env bash
# Automated checks for BYTE_FORGE_OIDC_PILOT.md §3 (auth platform only).
# Browser login + token exchange still require oidc-pkce-token-exchange.sh.
set -euo pipefail

ISSUER="${OIDC_ISSUER:-http://localhost:3010}"

echo "== Pilot §3 automated prerequisites =="
echo "Issuer: $ISSUER"
echo

fail() {
  echo "FAIL: $1"
  exit 1
}

pass() {
  echo "PASS: $1"
}

# Health
code=$(curl -sS -o /tmp/aponika-health.json -w "%{http_code}" "$ISSUER/health" 2>/dev/null || echo "000")
[[ "$code" == "200" ]] || fail "GET /health returned $code (is aponika-auth-backend running?)"
pass "GET /health"

# Discovery
code=$(curl -sS -o /tmp/aponika-discovery.json -w "%{http_code}" "$ISSUER/.well-known/openid-configuration" 2>/dev/null || echo "000")
[[ "$code" == "200" ]] || fail "OpenID discovery returned $code"
grep -q '"authorization_endpoint"' /tmp/aponika-discovery.json || fail "discovery missing authorization_endpoint"
grep -q '"token_endpoint"' /tmp/aponika-discovery.json || fail "discovery missing token_endpoint"
pass "OpenID discovery"

# JWKS
code=$(curl -sS -o /tmp/aponika-jwks.json -w "%{http_code}" "$ISSUER/jwks" 2>/dev/null || echo "000")
[[ "$code" == "200" ]] || fail "JWKS returned $code"
grep -q '"keys"' /tmp/aponika-jwks.json || fail "JWKS missing keys"
pass "JWKS"

# Protected route without token
code=$(curl -sS -o /dev/null -w "%{http_code}" "$ISSUER/api/v1/example/protected" 2>/dev/null || echo "000")
[[ "$code" == "401" ]] || fail "example/protected without token expected 401, got $code"
pass "example/protected rejects missing Bearer"

echo
echo "Automated checks passed."
echo "Manual steps: run scripts/oidc-pkce-token-exchange.sh (§3a–3d) and record in FEATURE_SIGNOFF.md."
