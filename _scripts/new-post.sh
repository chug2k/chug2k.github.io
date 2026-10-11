#!/bin/bash
# Create a draft: ./_scripts/new-post.sh "A working title"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/_scripts/new-post.py" "$@"
