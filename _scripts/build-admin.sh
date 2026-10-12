#!/bin/bash
# Reproducible, local editor bundle. The shared article renderer stays external.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$ROOT/admin/package.json" "$ROOT/admin/package-lock.json" "$WORK/"
cd "$WORK"
npm ci --omit=dev --no-audit --no-fund --cache "${npm_config_cache:-$WORK/npm-cache}"
export NODE_PATH="$WORK/node_modules"
./node_modules/.bin/esbuild "$ROOT/admin/src/entry.js" \
  --bundle --minify --format=esm --external:../../assets/markdown.mjs --outfile="$ROOT/admin/app.js"
./node_modules/.bin/esbuild "$ROOT/admin/src/editor.css" \
  --bundle --minify --conditions=style,browser,module,default,import \
  --loader:.woff=empty --loader:.woff2=file '--asset-names=fonts/[name]' \
  --outfile="$ROOT/admin/app.css"
python3 - "$ROOT/admin" <<'PY'
from pathlib import Path
import hashlib, re, sys
root=Path(sys.argv[1]); html=(root/'index.html').read_text()
fingerprint=hashlib.sha256((root/'app.js').read_bytes()).hexdigest()[:16]
html=re.sub(r"app\.js\?v=[a-zA-Z0-9_]+",'app.js?v='+fingerprint,html)
for name in ('app.css','writer.css'):
    version=hashlib.sha256((root/name).read_bytes()).hexdigest()[:16]
    html=re.sub(re.escape('./'+name)+r'(?:\?v=[a-zA-Z0-9_]+)?','./'+name+'?v='+version,html)
(root/'index.html').write_text(html)
PY
printf 'Rebuilt admin bundle and content fingerprints.\n'
