#!/usr/bin/env python3
"""Build sitemap.xml from core pages + v/*/meta.json + blog posts.

Usage: python3 _scripts/build-sitemap.py
Scans v/<slug>/ for meta.json, blog/*/index.html for dated slugs,
plus a static list of top-level pages. Writes sitemap.xml at root.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://clpanic.com"

STATIC = [
    ("/", "weekly", "1.0"),
    ("/blog/", "weekly", "0.9"),
    ("/making/", "monthly", "0.8"),
    ("/v/", "weekly", "0.8"),
    ("/unhurried-guide/", "monthly", "0.7"),
    ("/japan-2025/", "yearly", "0.6"),
    ("/earth/", "yearly", "0.6"),
    ("/verdict-cl-v-kj/", "yearly", "0.6"),
    ("/lottie-vs-remotion/", "monthly", "0.6"),
    ("/youtube-music-3mb/", "monthly", "0.6"),
    ("/paddle-buying-guide-2026/", "monthly", "0.7"),
    ("/user-guide/", "monthly", "0.6"),
    ("/ocud3/", "monthly", "0.5"),
]

def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> int:
    urls: list[tuple[str, str, str, str]] = []
    today = date.today().isoformat()
    for path, freq, pri in STATIC:
        p = ROOT / path.strip("/")
        lm = today
        idx = p / "index.html" if path != "/" else ROOT / "index.html"
        if idx.exists():
            import datetime
            ts = datetime.datetime.fromtimestamp(idx.stat().st_mtime).date().isoformat()
            lm = ts
        urls.append((f"{BASE}{path}", lm, freq, pri))

    v_dir = ROOT / "v"
    if v_dir.exists():
        for sub in sorted(v_dir.iterdir()):
            if not sub.is_dir():
                continue
            meta = sub / "meta.json"
            if not meta.exists():
                continue
            try:
                m = json.loads(meta.read_text())
            except json.JSONDecodeError:
                continue
            lm = str(m.get("published") or m.get("date") or today)[:10]
            if not re.match(r"\d{4}-\d{2}-\d{2}", lm):
                lm = today
            urls.append((f"{BASE}/v/{sub.name}/", lm, "monthly", "0.5"))

    blog_dir = ROOT / "blog"
    if blog_dir.exists():
        for sub in sorted(blog_dir.iterdir(), reverse=True):
            if not sub.is_dir():
                continue
            idx = sub / "index.html"
            if not idx.exists():
                continue
            m = re.match(r"(\d{4}-\d{2}-\d{2})", sub.name)
            lm = m.group(1) if m else today
            urls.append((f"{BASE}/blog/{sub.name}/", lm, "monthly", "0.7"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    seen = set()
    for loc, lm, freq, pri in urls:
        if loc in seen:
            continue
        seen.add(loc)
        lines.append("  <url>")
        lines.append(f"    <loc>{esc(loc)}</loc>")
        lines.append(f"    <lastmod>{esc(lm)}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{pri}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    out = ROOT / "sitemap.xml"
    out.write_text("\n".join(lines) + "\n")
    print(f"wrote {out} ({len(seen)} urls)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
