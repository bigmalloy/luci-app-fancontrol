#!/bin/bash
# build-apk-docker.sh
# Compiles luci-app-fancontrol as a proper OpenWrt 25+ APK using the OpenWrt SDK in Docker

set -e

PKG="luci-app-fancontrol"
OPENWRT_VER="25.12.0-rc5"
ARCH="aarch64_cortex-a53"
SDK_IMAGE="openwrt/sdk:${ARCH}-${OPENWRT_VER}"

echo "================================================"
echo " Building ${PKG} APK for OpenWrt ${OPENWRT_VER}"
echo " Target: ${ARCH} (GL-iNet Beryl AX / MT3000)"
echo "================================================"
echo ""

if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker is not running."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "${SCRIPT_DIR}/output"

PRIVATE_KEY="${SCRIPT_DIR}/keys/luci-fancontrol-signing.pem"
PUBLIC_KEY="${SCRIPT_DIR}/keys/luci-fancontrol-signing.pub"

if [ ! -f "${PRIVATE_KEY}" ]; then
  echo "ERROR: Signing key not found at ${PRIVATE_KEY}"
  echo "Run ./generate-key.sh first."
  exit 1
fi

HOST_UID="$(id -u)"
HOST_GID="$(id -g)"

PRIVATE_KEY_P8="${SCRIPT_DIR}/keys/luci-fancontrol-signing-p8.pem"
if [ ! -f "${PRIVATE_KEY_P8}" ]; then
  echo "Converting key to PKCS#8 format for adbsign..."
  openssl pkcs8 -topk8 -nocrypt -in "${PRIVATE_KEY}" -out "${PRIVATE_KEY_P8}"
fi

docker run --rm \
  -v "${SCRIPT_DIR}:/pkg-src:ro" \
  -v "${SCRIPT_DIR}/output:/output" \
  -v "${PRIVATE_KEY_P8}:/signing-key/key-build-p8:ro" \
  -v "${PUBLIC_KEY}:/signing-key/luci-fancontrol-signing.pub:ro" \
  --user root \
  -e HOST_UID="${HOST_UID}" \
  -e HOST_GID="${HOST_GID}" \
  "${SDK_IMAGE}" \
  /bin/bash -c '
    set -e

    SDK_DIR="/builder"
    cd "$SDK_DIR"

    echo "--- Setting up package ---"
    mkdir -p package/luci-app-fancontrol/files
    cp /pkg-src/openwrt-feed/Makefile package/luci-app-fancontrol/Makefile
    cp /pkg-src/openwrt-feed/files/* package/luci-app-fancontrol/files/

    echo "--- Updating feeds ---"
    ./scripts/feeds update -a 2>&1 | tail -5
    ./scripts/feeds install -a 2>&1 | tail -5

    echo "--- Configuring ---"
    make defconfig 2>&1 | tail -3
    echo "CONFIG_PACKAGE_luci-app-fancontrol=m" >> .config
    make defconfig 2>&1 | tail -3

    echo "--- Compiling ---"
    make package/luci-app-fancontrol/compile V=s 2>&1 | tail -30

    echo "--- Copying output ---"
    find bin/ -name "luci-app-fancontrol*" -type f | tee /tmp/found.txt
    cat /tmp/found.txt | xargs -I{} cp {} /output/

    echo "--- Signing APK with adbsign ---"
    /builder/staging_dir/host/bin/apk --allow-untrusted adbsign \
      --sign-key /signing-key/key-build-p8 \
      /output/luci-app-fancontrol-*.apk

    echo "--- Verifying signature ---"
    /builder/staging_dir/host/bin/apk verify \
      --keys-dir /signing-key \
      /output/luci-app-fancontrol-*.apk

    chown "${HOST_UID}:${HOST_GID}" /output/luci-app-fancontrol*
    ls -lh /output/
  '

echo ""
echo "================================================"
ls -lh "${SCRIPT_DIR}/output/"luci-app-fancontrol* 2>/dev/null && \
  echo "Success!" || echo "No output - check errors above"
echo "================================================"
echo ""
echo "Install on OpenWrt 25+:"
echo "  scp -O output/luci-app-fancontrol-*.apk root@192.168.1.1:/tmp/"
echo "  apk add /tmp/luci-app-fancontrol-*.apk"
echo ""
echo "NOTE: Router must have your public key installed in /etc/apk/keys/"
echo "  (one-time: scp -O keys/luci-fancontrol-signing.pub root@192.168.1.1:/etc/apk/keys/)"
