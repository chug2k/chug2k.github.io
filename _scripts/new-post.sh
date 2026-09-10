#!/bin/bash
# Scaffold a new blog post: ./_scripts/new-post.sh "A working title"
# Creates blog/YYYY-MM-DD-slug/index.html from _template.html,
# prepends an entry to blog/index.html, appends an <item> to feed.xml.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TITLE="${1:-Untitled post}"
DATE="$(date +%F)"
DISPLAY="$(date +"%B %-d, %Y")"
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]/ /g' | tr -s ' ' '-' | sed 's/^-//;s/-$//' | cut -c1-60 | sed 's/-$//')"
DIR="$ROOT/blog/$DATE-$SLUG"
DESC="A short post: $TITLE"

if [ -e "$DIR" ]; then echo "exists: $DIR"; exit 1; fi
mkdir -p "$DIR"
sed -e "s#__TITLE__#$TITLE#g" -e "s#__SLUG__#$DATE-$SLUG#g" \
    -e "s#__DATE__#$DATE#g" -e "s#__DISPLAY_DATE__#$DISPLAY#g" \
    -e "s#__DESCRIPTION__#$DESC#g" \
    "$ROOT/blog/_template.html" > "$DIR/index.html"

python3 - "$DATE-$SLUG" "$TITLE" "$DESC" "$DATE" "$DISPLAY" <<'EOF'
import sys, re
slug, title, desc, iso, disp = sys.argv[1:]
root = __import__("pathlib").Path("_scripts").resolve().parent
idx = root / "blog/index.html"
t = idx.read_text()
card = f'''  <a class="section-card" href="/blog/{slug}/">
    <div class="meta">{disp}</div>
    <h2>{title} →</h2>
    <p>{desc}</p>
  </a>
'''
t = t.replace("  <main id=\"main\">\n", "  <main id=\"main\">\n" + card, 1)
idx.write_text(t)

feed = root / "feed.xml"
f = feed.read_text()
import email.utils, datetime
pub = email.utils.format_datetime(datetime.datetime.fromisoformat(iso + "T09:00:00+00:00"))
item = f'''<item>
<title>{title}</title>
<link>https://clpanic.com/blog/{slug}/</link>
<guid>https://clpanic.com/blog/{slug}/</guid>
<pubDate>{pub}</pubDate>
<description>{desc}</description>
</item>
'''
f = f.replace("</channel>", item + "</channel>", 1)
feed.write_text(f)
print("updated blog/index.html + feed.xml")
EOF
echo "created $DIR/index.html"
echo "next: edit it, run python3 _scripts/build-sitemap.py, commit on a branch."
