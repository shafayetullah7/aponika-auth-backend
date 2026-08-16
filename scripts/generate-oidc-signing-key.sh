#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYS_DIR="${ROOT_DIR}/keys"
KEY_FILE="${KEYS_DIR}/oidc-signing.pem"

mkdir -p "${KEYS_DIR}"

if [[ -f "${KEY_FILE}" ]]; then
  echo "Key already exists: ${KEY_FILE}"
  echo "Delete it first or choose another path."
  exit 1
fi

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "${KEY_FILE}"
chmod 600 "${KEY_FILE}"

echo "Generated OIDC signing key:"
echo "  ${KEY_FILE}"
echo
echo "Add to .env:"
echo "  OIDC_JWKS_PRIVATE_KEY_PATH=${KEY_FILE}"
