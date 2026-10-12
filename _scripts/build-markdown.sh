#!/bin/bash
# Rebuild the shared browser/Node renderer. No install is required to use it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
npm init -y >/dev/null 2>&1
npm i --no-audit --no-fund esbuild@0.28.2 markdown-it@15.0.2 markdown-it-task-lists@2.1.1
export NODE_PATH="$WORK/node_modules"
./node_modules/.bin/esbuild "$ROOT/_scripts/markdown-renderer.js" --bundle --minify --format=esm \
  --loader:.html=text --outfile="$ROOT/assets/markdown.mjs"
python3 - "$WORK/node_modules" "$ROOT/assets/markdown-LICENSE.txt" <<'PY'
from pathlib import Path
import sys
root, dest = map(Path, sys.argv[1:])
licenses = []
for path in sorted(root.glob('*/LICENSE*')):
    if path.is_file():
        licenses.append(f'{path.parent.name}\n{"=" * 50}\n{path.read_text()}')
dest.write_text('\n\n'.join(licenses))
PY
