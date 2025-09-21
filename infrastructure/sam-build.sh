#!/usr/bin/env bash
set -euo pipefail

# Determine repository root based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infrastructure"

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "[sam-build] Installing root dependencies to make esbuild available..." >&2
  (cd "$ROOT_DIR" && npm install)
fi

export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
cd "$INFRA_DIR"

sam build "$@"
