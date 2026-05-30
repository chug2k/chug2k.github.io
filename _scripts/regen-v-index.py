#!/usr/bin/env python3
"""Regenerate v/index.html from v/*/meta.json.

Each summary in v/<slug>/ ships a meta.json. This script reads all of them,
renders a filterable + sortable index (newest first by default), and also
writes v/tags.json — the canonical tag vocabulary (with counts) so the
youtube-summary skill can reuse existing tags instead of inventing new ones.

Filtering and sorting are 100% client-side JS over data-* attributes on each
card: no per-tag pages, no build step, works on GitHub Pages + custom domain.

Usage:
    python3 _scripts/regen-v-index.py
"""
from __future__ import annotations
import json
import html
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V_DIR = ROOT / "v"

_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"]


def fmt_date(value) -> str:
    """'2026-05-24' -> 'May 24, 2026'."""
    digits = str(value or "").strip().replace("-", "")
    if len(digits) == 8 and digits.isdigit():
        y, m, dd = int(digits[:4]), int(digits[4:6]), int(digits[6:8])
        if 1 <= m <= 12:
            return f"{_MONTHS[m]} {dd}, {y}"
    return str(value or "")


def fmt_views(n) -> str:
    try:
        n = int(n)
    except (TypeError, ValueError):
        return ""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1_000:
        return f"{n/1_000:.1f}K".replace(".0K", "K")
    return str(n)

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
  margin: 0 0 36px;
  max-width: 560px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  font-family: "Inter", sans-serif;
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--rule);
}
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  font-family: "Inter", sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip .count { opacity: 0.6; margin-left: 5px; font-weight: 400; }
.sort {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}
.sort select {
  font-family: "Inter", sans-serif;
  font-size: 13px;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 6px;
  padding: 5px 8px;
  cursor: pointer;
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
.entry p { margin: 0 0 12px; font-size: 15px; color: var(--muted); }
.entry .tags { display: flex; flex-wrap: wrap; gap: 6px; }
.entry .tag {
  font-family: "Inter", sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 2px 9px;
}
.empty, .noresults {
  font-family: "Inter", sans-serif;
  color: var(--muted);
  font-size: 15px;
  padding: 24px;
  border: 1px dashed var(--rule);
  border-radius: 10px;
  text-align: center;
}
.noresults { display: none; }
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← chug2k</a>
  <div class="eyebrow">Video summaries</div>
  <h1>Field notes from talks I watched</h1>
  <p class="lede">Each page distills a video into a teach-quickly format: TL;DR, sections with screenshots at key moments, pull quotes, and Q&amp;A highlights.</p>
"""

TEMPLATE_TAIL = """  <div class="noresults" id="noresults">No summaries match that filter.</div>
</div>
<script>
(function () {
  var grid = document.getElementById("grid");
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".entry"));
  var chips = Array.prototype.slice.call(document.querySelectorAll(".chip"));
  var noresults = document.getElementById("noresults");
  var sortSel = document.getElementById("sort");
  var activeTag = "";  // "" = all

  function applyFilter() {
    var shown = 0;
    cards.forEach(function (c) {
      var tags = (c.getAttribute("data-tags") || "").split(" ");
      var ok = !activeTag || tags.indexOf(activeTag) !== -1;
      c.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    noresults.style.display = shown ? "none" : "block";
  }

  function applySort() {
    var mode = sortSel.value;
    var sorted = cards.slice().sort(function (a, b) {
      if (mode === "date-desc") return b.dataset.date.localeCompare(a.dataset.date);
      if (mode === "date-asc")  return a.dataset.date.localeCompare(b.dataset.date);
      if (mode === "dur-desc")  return (+b.dataset.duration) - (+a.dataset.duration);
      if (mode === "dur-asc")   return (+a.dataset.duration) - (+b.dataset.duration);
      if (mode === "title")     return a.dataset.title.localeCompare(b.dataset.title);
      return 0;
    });
    sorted.forEach(function (c) { grid.appendChild(c); });
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var tag = chip.getAttribute("data-tag");
      activeTag = (tag === activeTag) ? "" : tag;
      chips.forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-tag") === activeTag);
      });
      applyFilter();
    });
  });
  sortSel.addEventListener("change", applySort);
})();
</script>
</body>
</html>
"""


def render_entry(meta: dict, slug: str) -> str:
    kind = html.escape(meta.get("kind", "Talk"))
    duration = meta.get("duration_minutes")
    duration_part = f"· {duration} min " if duration else ""
    disp_date = meta.get("video_date") or meta.get("date", "")
    date_str = fmt_date(disp_date)
    views = meta.get("views")
    views_part = f" · {fmt_views(views)} views" if fmt_views(views) else ""
    title = html.escape(meta.get("title", slug))
    desc = html.escape(meta.get("description", ""))
    tags = meta.get("tags") or []
    data_tags = html.escape(" ".join(tags))
    tags_html = ""
    if tags:
        chips = "".join(f'<span class="tag">{html.escape(t)}</span>' for t in tags)
        tags_html = f'    <div class="tags">{chips}</div>\n'
    return (
        f'  <a class="entry" href="/v/{html.escape(slug)}/"'
        f' data-tags="{data_tags}" data-date="{html.escape(disp_date)}"'
        f' data-duration="{duration or 0}" data-title="{html.escape(meta.get("title", slug).lower())}">\n'
        f'    <div class="meta">{kind} {duration_part}· {html.escape(date_str)}{html.escape(views_part)}</div>\n'
        f'    <h2>{title}</h2>\n'
        f'    <p>{desc}</p>\n'
        f'{tags_html}'
        f'  </a>\n'
    )


def render_controls(tag_counts: Counter) -> str:
    # "All" chip, then tags by frequency (desc) then alpha
    chips = ['<button class="chip active" data-tag="">All</button>']
    for tag, n in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        chips.append(f'<button class="chip" data-tag="{html.escape(tag)}">'
                     f'{html.escape(tag)}<span class="count">{n}</span></button>')
    sort = (
        '<div class="sort"><label for="sort">Sort</label>'
        '<select id="sort">'
        '<option value="date-desc">Newest</option>'
        '<option value="date-asc">Oldest</option>'
        '<option value="dur-desc">Longest</option>'
        '<option value="dur-asc">Shortest</option>'
        '<option value="title">Title A–Z</option>'
        '</select></div>'
    )
    return f'  <div class="controls">\n    <div class="chips">{"".join(chips)}</div>\n    {sort}\n  </div>\n'


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

    tag_counts: Counter = Counter()
    for m in entries:
        for t in (m.get("tags") or []):
            tag_counts[t] += 1

    controls = render_controls(tag_counts) if entries else ""
    cards = "".join(render_entry(m, m["_slug"]) for m in entries)
    grid = f'  <div id="grid">\n{cards}  </div>\n'
    if not entries:
        grid = ('  <div id="grid"></div>\n'
                '  <div class="empty">No summaries yet. Run the youtube-summary skill to generate one.</div>\n')

    out = V_DIR / "index.html"
    out.write_text(TEMPLATE_HEAD + controls + grid + TEMPLATE_TAIL)

    # canonical tag vocabulary for the skill to reuse (most-used first)
    tags_out = {t: n for t, n in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))}
    (V_DIR / "tags.json").write_text(json.dumps(
        {"tags": tags_out, "entries": len(entries)}, indent=2) + "\n")

    print(f"wrote {out} ({len(entries)} entries, {len(tag_counts)} tags) + tags.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
