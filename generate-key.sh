#!/bin/bash
# generate-key.sh
# Generates an RSA signing key pair for luci-app-fancontrol APK packages.
# Run once. Keep keys/luci-fancontrol-signing.pem private — never commit it.
# Install keys/luci-fancontrol-signing.pub on each router to trust your packages.

set -e

KEYS_DIR="$(cd "$(dirname "$0")" && pwd)/keys"
PRIVATE_KEY="${KEYS_DIR}/luci-fancontrol-signing.pem"
PUBLIC_KEY="${KEYS_DIR}/luci-fancontrol-signing.pub"

mkdir -p "${KEYS_DIR}"

if [ -f "${PRIVATE_KEY}" ]; then
  echo "Key already exists at ${PRIVATE_KEY}"
  echo "Delete it first if you want to regenerate."
  exit 1
fi

echo "Generating RSA-2048 signing key pair..."
openssl genrsa -out "${PRIVATE_KEY}" 2048
openssl rsa -in "${PRIVATE_KEY}" -pubout -out "${PUBLIC_KEY}"
chmod 600 "${PRIVATE_KEY}"

echo ""
echo "Keys generated:"
echo "  Private: ${PRIVATE_KEY}  (keep secret)"
echo "  Public:  ${PUBLIC_KEY}"
echo ""
echo "Install the public key on your router (one-time):"
echo "  scp -O ${PUBLIC_KEY} root@192.168.1.1:/etc/apk/keys/"
echo ""
echo "After that, APKs built with build-apk-docker.sh install without --allow-untrusted."
