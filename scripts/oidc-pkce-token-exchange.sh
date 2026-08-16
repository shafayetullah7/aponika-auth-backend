#!/usr/bin/env bash
set -euo pipefail

# Manual PKCE authorization_code + token exchange against local issuer.
# Prerequisites: backend on :3010, seeded `byte-forge-web` client, logged-in user session cookies optional for browser flow.

ISSUER="${OIDC_ISSUER:-http://localhost:3010}"
CLIENT_ID="${OIDC_CLIENT_ID:-byte-forge-web}"
REDIRECT_URI="${OIDC_REDIRECT_URI:-http://localhost:3000/auth/callback}"
RESOURCE="${OIDC_DEFAULT_RESOURCE:-http://localhost:3005}"

VERIFIER="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
CHALLENGE="$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
STATE="$(openssl rand -hex 8)"
NONCE="$(openssl rand -hex 8)"

AUTH_URL="${ISSUER}/auth?client_id=${CLIENT_ID}&redirect_uri=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${REDIRECT_URI}'))")&response_type=code&scope=openid%20profile%20email&code_challenge=${CHALLENGE}&code_challenge_method=S256&state=${STATE}&nonce=${NONCE}"

cat <<EOF
1) Open this URL in a browser (log in on auth frontend if prompted):

${AUTH_URL}

2) After redirect, copy the \`code\` query param from the callback URL and run:

CODE='<paste-code-here>' \\
VERIFIER='${VERIFIER}' \\
ISSUER='${ISSUER}' \\
CLIENT_ID='${CLIENT_ID}' \\
REDIRECT_URI='${REDIRECT_URI}' \\
bash -c 'curl -sS -X POST "\$ISSUER/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  --data-urlencode "grant_type=authorization_code" \\
  --data-urlencode "client_id=\$CLIENT_ID" \\
  --data-urlencode "redirect_uri=\$REDIRECT_URI" \\
  --data-urlencode "code=\$CODE" \\
  --data-urlencode "code_verifier=\$VERIFIER" | jq'

3) Verify access_token JWT against JWKS:

ACCESS_TOKEN='<paste-access-token>' \\
ISSUER='${ISSUER}' \\
RESOURCE='${RESOURCE}' \\
bash -c 'curl -sS "\$ISSUER/jwks" | jq . > /tmp/aponika-jwks.json && \\
  node -e "const {createLocalJWKSet,jwtVerify}=require(\\\"jose\\\"); const fs=require(\\\"fs\\\"); (async()=>{const jwks=JSON.parse(fs.readFileSync(\\\"/tmp/aponika-jwks.json\\\",\\\"utf8\\\")); const key=createLocalJWKSet(jwks); const {payload}=await jwtVerify(process.env.ACCESS_TOKEN,key,{issuer:process.env.ISSUER,audience:process.env.RESOURCE}); console.log(payload);})();"'

EOF
