#!/bin/bash
# Rebuild the /admin/ writing-room bundle from admin/src/.
# The editor (BlockNote + React) is bundled locally with esbuild so the
# admin page has zero runtime CDN dependencies: no import maps, no
# cross-package duplication bugs, no network-filter surprises.
#
# Usage (from repo root):
#   ./_scripts/build-admin.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
npm init -y >/dev/null 2>&1
npm i --no-audit --no-fund \
  esbuild \
  react@19.2.8 react-dom@19.2.8 \
  @blocknote/core@0.54.2 @blocknote/react@0.54.2 @blocknote/mantine@0.54.2 \
  @mantine/core @mantine/hooks
export NODE_PATH="$WORK/node_modules"
./node_modules/.bin/esbuild "$ROOT/admin/src/entry.js" \
  --bundle --minify --format=esm --outfile="$ROOT/admin/app.js"
./node_modules/.bin/esbuild "$ROOT/admin/src/editor.css" \
  --bundle --minify --conditions=style,browser,module,default,import \
  --loader:.woff=empty --loader:.woff2=file '--asset-names=fonts/[name]' \
  --outfile="$ROOT/admin/app.css"
echo "rebuilt admin/app.js + admin/app.css"
