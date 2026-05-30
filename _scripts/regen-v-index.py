#!/usr/bin/env python3
"""Regenerate v/index.html from v/*/meta.json.

Each summary in v/<slug>/ ships a meta.json. This script reads all of them,
sorts by date (newest first), and renders the index. Style matches the
existing magazine-warm aesthetic of the blog.

Usage:
    python3 _scripts/regen-v-index.py
"""
from __future__ import annotations
import json
import html
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V_DIR = ROOT / "v"

TEMPLATE_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Video summaries — chug2k</title>
<style>
:root {
  --bg: #f5f1e8;
  --paper: #faf7f0;
  --ink: #1a1816;
  --muted: #6b655c;
  --rule: #d9d2c3;
  --accent: #cc5429;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Charter", "Georgia", serif;
  font-size: 18px;
  line-height: 1.55;
  color: var(--ink);
  background: var(--bg);
}
.wrap { max-width: 760px; margin: 0 auto; padding: 64px 24px; }
.back {
  font-family: "Inter", sans-serif;
  font-size: 13px;
  color: var(--muted);
  text-decoration: none;
  display: inline-block;
  margin-bottom: 32px;
}
.back:hover { color: var(--accent); }
.eyebrow {
  font-family: "Inter", sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 18px;
}
h1 {
  font-family: "Inter", sans-serif;
  font-size: 40px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
}
.lede {
  font-size: 19px;
  color: var(--muted);
  margin: 0 0 48px;
  max-width: 560px;
}
.entry {
  display: block;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 22px 26px;
  margin: 16px 0;
  text-decoration: none;
  color: var(--ink);
}
.entry:hover { border-color: var(--accent); }
.entry h2 {
  font-family: "Inter", sans-serif;
  font-size: 19px;
  line-height: 1.3;
  margin: 0 0 6px;
}
.entry .meta {
  font-family: "Inter", sans-serif;
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.entry p { margin: 0; font-size: 15px; color: var(--muted); }
.empty {
  font-family: "Inter", sans-serif;
  color: var(--muted);
  font-size: 15px;
  padding: 24px;
  border: 1px dashed var(--rule);
  border-radius: 10px;
  text-align: center;
}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← chug2k</a>
  <div class="eyebrow">Video summaries</div>
  <h1>Field notes from talks I watched</h1>
  <p class="lede">Each page distills a video into a teach-quickly format: TL;DR, sections with screenshots at key moments, pull quotes, and Q&amp;A highlights.</p>
"""

TEMPLATE_TAIL = """</div>
</body>
</html>
"""


def render_entry(meta: dict, slug: str) -> str:
    kind = html.escape(meta.get("kind", "Talk"))
    duration = meta.get("duration_minutes")
    duration_part = f"· {duration} min " if duration else ""
    date = meta.get("date", "")
    year = date.split("-")[0] if date else ""
    title = html.escape(meta.get("title", slug))
    desc = html.escape(meta.get("description", ""))
    return (
        f'  <a class="entry" href="/v/{html.escape(slug)}/">\n'
        f'    <div class="meta">{kind} {duration_part}· {html.escape(year)}</div>\n'
        f'    <h2>{title}</h2>\n'
        f'    <p>{desc}</p>\n'
        f'  </a>\n'
    )


def main() -> int:
    entries = []
    for sub in V_DIR.iterdir():
        if not sub.is_dir():
            continue
        meta_path = sub / "meta.json"
        if not meta_path.exists():
            print(f"skip {sub.name}: no meta.json")
            continue
        try:
            meta = json.loads(meta_path.read_text())
        except json.JSONDecodeError as e:
            print(f"skip {sub.name}: bad meta.json ({e})")
            continue
        meta["_slug"] = sub.name
        entries.append(meta)

    entries.sort(key=lambda m: m.get("date", ""), reverse=True)

    body = "".join(render_entry(m, m["_slug"]) for m in entries)
    if not entries:
        body = '  <div class="empty">No summaries yet. Run the youtube-summary skill to generate one.</div>\n'

    out = V_DIR / "index.html"
    out.write_text(TEMPLATE_HEAD + body + TEMPLATE_TAIL)
    print(f"wrote {out} ({len(entries)} entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
