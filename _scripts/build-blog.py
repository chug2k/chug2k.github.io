#!/usr/bin/env python3
"""Build the static blog, homepage, project catalog, library, and About page.

Use new-post.sh to create a draft; serve.py to preview it without writing published
HTML; then set draft: false and run this script to build. Python stdlib + Node.js.
Node.js runs the shared, prebundled Markdown renderer.
Edit blog/posts/*.md, content/catalog.json, and _templates/ rather than generated HTML.
"""
from __future__ import annotations
import hashlib
import json
import subprocess
import math
import re
from pathlib import Path
from datetime import datetime
from site_builder import page, render_hubs, write_page

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
    source = path.read_bytes()
    text = source.decode("utf-8")
    meta: dict[str, str] = {}
    body = text
    frontmatter = re.match(r"\A---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|\Z)", text)
    if frontmatter:
        for line in frontmatter.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip().lower()] = v.strip()
        body = text[frontmatter.end():].lstrip("\n")
    slug = path.stem  # YYYY-MM-DD-slug
    m = re.match(r"(\d{4}-\d{2}-\d{2})-(.+)", slug)
    file_date = m.group(1) if m else ""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*", slug):
        raise ValueError(f"{path.name}: use YYYY-MM-DD-slug.md with lowercase letters, numbers, and hyphens")
    for field in ("title", "description"):
        if not meta.get(field):
            raise ValueError(f"{path.name}: missing {field} in frontmatter")
    post_date = meta.get("date", file_date)
    datetime.strptime(post_date, "%Y-%m-%d")
    if meta.get("draft", "false").lower() not in ("true", "false"):
        raise ValueError(f"{path.name}: draft must be true or false")
    return {
        "draft": meta.get("draft", "false").lower() == "true",
        "slug": slug,
        "title": meta.get("title", slug),
        "description": meta.get("description", ""),
        "date": meta.get("date", file_date),
        "body": body,
        "source_sha256": hashlib.sha256(source).hexdigest(),
    }


def render_requests(requests):
    """Use the exact Markdown/template implementation used by the writer preview."""
    if not requests:
        return []
    try:
        result = subprocess.run(
            ["node", str(ROOT / "_scripts/render-markdown.mjs")],
            input=json.dumps(requests), text=True, capture_output=True, check=True, timeout=30,
        )
    except FileNotFoundError as exc:
        raise ValueError("Install Node.js 22 or newer to build the blog. No npm install is needed.") from exc
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise ValueError(f"Markdown rendering failed: {getattr(exc, 'stderr', '') or exc}") from exc
    return json.loads(result.stdout)


def render_markdown(body: str) -> str:
    return render_requests({"mode": "markdown", "body": body})


def read_time_minutes(body: str) -> str:
    words = len(re.findall(r"\S+", body))
    return f"{max(1, math.ceil(words / 200))} min"


def render_excerpt(body: str) -> str:
    return render_requests({"mode": "excerpt", "body": body})


def main(output: Path = ROOT, include_drafts: bool = False) -> int:
    all_posts = [parse_post(p) for p in sorted(POSTS_DIR.glob("*.md"))]
    posts = [p for p in all_posts if include_drafts or not p["draft"]]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    for post in posts:
        post["url"] = f'/blog/{post["slug"]}/'
        post["display_date"] = display_date(post["date"])
        post["read_time"] = read_time_minutes(post["body"])

    rendered = render_requests([{"mode": "template"}] + [
        request for post in posts for request in (
            {"mode": "excerpt", "body": post["body"]}, {"mode": "post", "post": post},
        )
    ])
    if rendered.pop(0) != TEMPLATE:
        raise ValueError("The article template changed. Run bash _scripts/build-markdown.sh before building.")
    for index, post in enumerate(posts):
        post["excerpt_html"], post["article_html"] = rendered[index * 2:index * 2 + 2]

    # Validate the catalog before producing any article files.
    render_hubs(posts, output, preview=include_drafts)
    for post in posts:
        markup = page(post["title"] + " — Charles Lee", post["description"], post["url"],
                      post["article_html"], active="writing", article=True,
                      extra_head=(f'<meta property="article:published_time" content="{post["date"]}">'
                                  f'<meta name="article-source-sha256" content="{post["source_sha256"]}">'),
                      preview=include_drafts)
        write_page(output, post["url"], markup)

    # A previously published post switched to draft must stop serving its old body.
    # Keep the route with a noindex notice; never delete an author's files or assets.
    if not include_drafts:
        for post in all_posts:
            if post["draft"] and (output / "blog" / post["slug"] / "index.html").exists():
                path = f'/blog/{post["slug"]}/'
                write_page(output, path, page("Post unavailable — Charles Lee", "This post is not currently published.", path,
                    '<header class="page-heading"><h1>Transmission interrupted.</h1><p>This post isn’t currently published.</p><a href="/blog/">Back to writing →</a></header>',
                    active="writing", extra_head='<meta name="robots" content="noindex,nofollow">'))

    print(f"Rendered {len(posts)} post(s), homepage, writing, projects, library, and about" + (" (preview)" if include_drafts else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
