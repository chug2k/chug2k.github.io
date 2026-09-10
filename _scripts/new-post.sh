#!/bin/bash
# Scaffold a new blog post: ./_scripts/new-post.sh "A working title"
# Creates blog/posts/YYYY-MM-DD-slug.md, then renders the site.
# (Or skip the terminal entirely: write at /admin/ in the browser.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TITLE="${1:-Untitled post}"
DATE="$(date +%F)"
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]/ /g' | tr -s ' ' '-' | sed 's/^-//;s/-$//' | cut -c1-60 | sed 's/-$//')"
FILE="$ROOT/blog/posts/$DATE-$SLUG.md"

if [ -e "$FILE" ]; then echo "exists: $FILE"; exit 1; fi
cat > "$FILE" <<EOF
---
title: $TITLE
description: One-line summary for cards, meta tags, and RSS.
date: $DATE
---

Start writing here. Delete this line.

## A section

Short paragraphs. One idea each. **Bold**, *italic*, \`code\`,
[links](https://example.com), quotes:

> Something worth quoting.

- a list
- of things
EOF
python3 "$ROOT/_scripts/build-blog.py"
python3 "$ROOT/_scripts/build-sitemap.py"
echo "created $FILE"
echo "next: edit it, rebuild with python3 _scripts/build-blog.py, commit on a branch."
