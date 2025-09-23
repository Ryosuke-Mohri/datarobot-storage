#!/usr/bin/env sh

# Auto-detect package manager and install dependencies
if command -v apk >/dev/null 2>&1; then
    # Wolfi/Alpine Linux with apk
    apk update && apk add --no-cache libreoffice
elif command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu with apt
    apt-get update && apt-get install -y --no-install-recommends libreoffice libreoffice-java-common libgtk2.0-dev
    apt-get clean
else
    echo "Unsupported package manager. This script supports APK (Wolfi/Alpine) and APT (Debian/Ubuntu) only."
    exit 1
fi

# Install Python and uv
python3 -m pip install --no-cache-dir pipx
PIPX_GLOBAL_BIN_DIR=/usr/bin python3 -m pipx install --global uv
export UV_CACHE_DIR=.uv
uv sync
