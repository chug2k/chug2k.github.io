#!/usr/bin/env python3
"""Render blog posts from Markdown to static HTML. Zero dependencies (stdlib only).

Authoring workflow:
    ./_scripts/new-post.sh "A working title"   # creates blog/posts/YYYY-MM-DD-slug.md
    # ... edit the .md file ...
    python3 _scripts/build-blog.py              # renders posts + index + feed
    python3 _scripts/build-sitemap.py           # refresh sitemap

Source format (blog/posts/<date>-<slug>.md):
    ---
    title: My post
    description: One-line summary for cards, meta tags, RSS.
    date: 2026-09-10
    ---
    Markdown body...

Supported Markdown: headings (# -> h2, ## -> h3, ### -> h4), paragraphs,
**bold**, *italic*, `code`, fenced code blocks, [links](url), ![img](src),
> quotes, -/* bullets, 1. numbered lists, --- rules.

This script regenerates (all committed to git — GitHub Pages serves them):
    blog/<slug>/index.html   one page per post
    blog/index.html           reverse-chron card list
    feed.xml                  RSS 2.0
"""
from __future__ import annotations
import html
import math
import re
from pathlib import Path
from datetime import datetime, timezone
from email.utils import format_datetime

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "blog" / "posts"
TEMPLATE = (ROOT / "blog" / "_template.html").read_text()

_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"]


def display_date(iso: str) -> str:
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso)
    if not m:
        return iso
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return f"{_MONTHS[mo]} {d}, {y}" if 1 <= mo <= 12 else iso


def parse_post(path: Path) -> dict:
    text = path.read_text()
    meta: dict[str, str] = {}
    body = text
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            for line in text[3:end].strip().splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip().lower()] = v.strip()
            body = text[end + 3:].lstrip("\n")
    slug = path.stem  # YYYY-MM-DD-slug
    m = re.match(r"(\d{4}-\d{2}-\d{2})-(.+)", slug)
    file_date = m.group(1) if m else ""
    return {
        "slug": slug,
        "title": meta.get("title", slug),
        "description": meta.get("description", ""),
        "date": meta.get("date", file_date),
        "body": body,
    }


def render_inline(text: str) -> str:
    """Escape HTML, then apply inline Markdown. Order matters."""
    out = html.escape(text, quote=False)
    # Stash `code` spans first so * inside code isn't treated as emphasis.
    codes: list[str] = []

    def stash(m: re.Match) -> str:
        codes.append(f"<code>{m.group(1)}</code>")
        return "\x00" + str(len(codes) - 1) + "\x00"

    def unstash(m: re.Match) -> str:
        return codes[int(m.group(1))]

    out = re.sub(r"`([^`\n]+)`", stash, out)
    out = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)",
                 lambda m: f'<img src="{html.escape(m.group(2))}" alt="{m.group(1)}" loading="lazy">', out)
    out = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",
                 lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\*([^*\n]+)\*", r"<em>\1</em>", out)
    out = re.sub(r"\x00(\d+)\x00", unstash, out)
    return out


def render_markdown(body: str) -> str:
    lines = body.splitlines()
    out: list[str] = []
    para: list[str] = []
    in_fence = False
    fence_lang = ""
    fence_buf: list[str] = []
    list_tag = ""  # "ul" | "ol" | ""

    def flush_para():
        if para:
            out.append("    <p>" + " ".join(render_inline(l.strip()) for l in para) + "</p>")
            para.clear()

    def close_list():
        nonlocal list_tag
        if list_tag:
            out.append(f"    </{list_tag}>")
            list_tag = ""

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            if not in_fence:
                flush_para()
                close_list()
                in_fence = True
                fence_lang = stripped[3:].strip()
                fence_buf = []
            else:
                code = html.escape("\n".join(fence_buf))
                cls = f' class="language-{html.escape(fence_lang)}"' if fence_lang else ""
                out.append(f"    <pre><code{cls}>{code}</code></pre>")
                in_fence = False
            continue
        if in_fence:
            fence_buf.append(line)
            continue
        if not stripped:
            flush_para()
            close_list()
            continue
        if stripped in ("---", "***"):
            flush_para()
            close_list()
            out.append("    <hr>")
            continue
        h = re.match(r"(#{1,3})\s+(.*)", stripped)
        if h:
            flush_para()
            close_list()
            level = len(h.group(1)) + 1  # # -> h2 (h1 is the post title)
            out.append(f"    <h{level}>{render_inline(h.group(2))}</h{level}>")
            continue
        if stripped.startswith(">"):
            flush_para()
            close_list()
            quote = re.sub(r"^>\s?", "", stripped)
            out.append(f"    <blockquote><p>{render_inline(quote)}</p></blockquote>")
            continue
        ul = re.match(r"[-*]\s+(.*)", stripped)
        ol = re.match(r"\d+[.)]\s+(.*)", stripped)
        if ul or ol:
            flush_para()
            tag = "ul" if ul else "ol"
            item = (ul or ol).group(1)  # type: ignore[union-attr]
            if list_tag != tag:
                close_list()
                out.append(f"    <{tag}>")
                list_tag = tag
            out.append(f"      <li>{render_inline(item)}</li>")
            continue
        para.append(line)
    flush_para()
    close_list()
    return "\n".join(out) + ("\n" if out else "")


def read_time_minutes(body: str) -> str:
    words = len(re.findall(r"\S+", body))
    return f"{max(1, math.ceil(words / 200))} min"


INDEX_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notebook — Charles Lee</title>
<meta name="description" content="Short, dated posts on what I'm building, reading, and changing my mind about.">
<link rel="canonical" href="https://clpanic.com/blog/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Charles Lee">
<meta property="og:title" content="Notebook — Charles Lee">
<meta property="og:description" content="Short, dated posts on what I'm building, reading, and changing my mind about.">
<meta property="og:url" content="https://clpanic.com/blog/">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="Charles Lee — blog" href="/feed.xml">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js" defer></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="wrap">
  <div class="topbar">
    <a class="home" href="/">← chug2k</a>
    <nav aria-label="Sections"><a href="/#writing">Writing</a><a href="/making/">Making</a><a href="/blog/">Blog</a><a href="/v/">Videos</a></nav>
    <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode">☾ Dark</button>
  </div>
  <div class="eyebrow">Notebook</div>
  <h1>Short posts, newest first</h1>
  <p class="lede">What I'm building, reading, and changing my mind about. <a href="/feed.xml" style="color:var(--accent)">RSS</a> available.</p>
  <main id="main">
"""

INDEX_TAIL = """  </main>
  <footer>
    <div class="foot-nav"><a href="/">Home</a><a href="/feed.xml">RSS</a><a href="/making/">Making</a><a href="/v/">Videos</a></div>
    Built with Claude Code. Source at <a href="https://github.com/chug2k/chug2k.github.io">github.com/chug2k/chug2k.github.io</a>.
  </footer>
</div>
</body>
</html>
"""


def fill(template: str, post: dict, content_html: str) -> str:
    return (template
            .replace("{{TITLE}}", html.escape(post["title"]))
            .replace("{{DESCRIPTION}}", html.escape(post["description"]))
            .replace("{{SLUG}}", post["slug"])
            .replace("{{DATE_ISO}}", post["date"])
            .replace("{{DATE_DISPLAY}}", display_date(post["date"]))
            .replace("{{READ_TIME}}", read_time_minutes(post["body"]))
            .replace("{{CONTENT}}", content_html.rstrip()))


def main() -> int:
    posts = [parse_post(p) for p in sorted(POSTS_DIR.glob("*.md"))]
    posts.sort(key=lambda p: p["date"], reverse=True)

    for post in posts:
        content_html = render_markdown(post["body"])
        dest = ROOT / "blog" / post["slug"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(fill(TEMPLATE, post, content_html))

    # index
    parts = [INDEX_HEAD]
    year = None
    for post in posts:
        y = post["date"][:4]
        if y != year:
            year = y
            parts.append(f'  <div class="section-h">{html.escape(y)}</div>\n')
        parts.append(
            f'  <a class="section-card" href="/blog/{post["slug"]}/">\n'
            f'    <div class="meta">{html.escape(display_date(post["date"]))}</div>\n'
            f'    <h2>{html.escape(post["title"])} →</h2>\n'
            f'    <p>{html.escape(post["description"])}</p>\n'
            f'  </a>\n')
    parts.append(INDEX_TAIL)
    (ROOT / "blog" / "index.html").write_text("".join(parts))

    # feed
    items = []
    for post in posts:
        try:
            dt = datetime.fromisoformat(post["date"] + "T09:00:00+00:00")
        except ValueError:
            dt = datetime.now(timezone.utc)
        items.append(
            "<item>\n"
            f"<title>{html.escape(post['title'])}</title>\n"
            f"<link>https://clpanic.com/blog/{post['slug']}/</link>\n"
            f"<guid>https://clpanic.com/blog/{post['slug']}/</guid>\n"
            f"<pubDate>{format_datetime(dt)}</pubDate>\n"
            f"<description>{html.escape(post['description'])}</description>\n"
            "</item>")
    feed = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
            "<channel>\n"
            "<title>Charles Lee — notebook</title>\n"
            "<link>https://clpanic.com/blog/</link>\n"
            "<description>Short, dated posts on what I'm building, reading, and changing my mind about.</description>\n"
            "<language>en</language>\n"
            '<atom:link href="https://clpanic.com/feed.xml" rel="self" type="application/rss+xml"/>\n'
            + "\n".join(items) + "\n</channel>\n</rss>\n")
    (ROOT / "feed.xml").write_text(feed)

    print(f"rendered {len(posts)} post(s) + index + feed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
