"""Shared page layout and curated catalog. No runtime or third-party packages."""
from __future__ import annotations

import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def template(name: str, **values: str) -> str:
    source = (ROOT / "_templates" / name).read_text()
    # Single-pass substitution keeps literal {{tokens}} in articles intact.
    return re.sub(r"\{\{([A-Z_]+)\}\}", lambda m: values[m[1]], source)


def safe_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in ("", "https", "http") or (not parts.scheme and not value.startswith("/")) or value.startswith("//"):
        raise ValueError(f"Catalog URL must be a root-relative path or HTTP(S) URL: {value!r}")
    return escape(value)


def page(title: str, description: str, path: str, content: str, *, active: str = "", article: bool = False, extra_head: str = "", preview: bool = False) -> str:
    nav = "".join(f'<a href="{url}"' + (' aria-current="page"' if key == active else '') + f'>{label}</a>' for key, label, url in [
        ("writing", "Blog", "/"), ("projects", "Projects", "/making/"), ("about", "About", "/about/")])
    return template("base.html", TITLE=escape(title), DESCRIPTION=escape(description), PATH=escape(path),
                    NAV=nav, CONTENT=content, OG_TYPE="article" if article else "website",
                    EXTRA_HEAD=extra_head + ('<meta name="robots" content="noindex,nofollow">' if preview else ''),
                    PREVIEW_BANNER='<div class="preview-banner">Local preview · includes drafts · not published</div>' if preview else '')


def write_page(output: Path, path: str, markup: str) -> None:
    dest = output / path.strip("/") / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(line.rstrip() for line in markup.splitlines()) + "\n")


def reading_row(item: dict, *, post: bool = False) -> str:
    meta = item.get("display_date", item.get("kind", "Project"))
    if post:
        meta = f'<time datetime="{escape(item["date"])}">{escape(meta)}</time> · {escape(item["read_time"])} read'
        if item.get("draft"):
            meta += ' · <strong>Draft</strong>'
    else:
        meta = escape(meta)
    return (f'<article class="writing-row"><div class="row-meta">{meta}</div><div>'
            f'<h3><a href="{safe_url(item["url"])}">{escape(item["title"])}</a></h3>'
            f'<p>{escape(item["description"])}</p></div><span class="row-arrow" aria-hidden="true">↗</span></article>')


def project_card(item: dict, *, full: bool = False) -> str:
    secondary = (f'<a class="text-link" href="{safe_url(item["secondary_url"])}">{escape(item["secondary_label"])} ↗</a>' if item.get("secondary_url") else '')
    image = (f'<img class="project-image" src="{safe_url(item["image"])}" alt="{escape(item["image_alt"])}" width="640" height="480" loading="lazy">' if item.get("image") and full else '')
    detail = f'<p>{escape(item["detail"])}</p>' if full else ''
    return (f'<article class="project-card {"case-study" if full else ""}">{image}<div class="project-copy">'
            f'<p class="project-medium">{escape(item["medium"])}</p><h3>{escape(item["title"])}</h3>'
            f'<p>{escape(item["description"])}</p>{detail}<div class="project-links">'
            f'<a class="text-link" href="{safe_url(item["url"])}">{escape(item["link_label"])} →</a>{secondary}</div></div></article>')


def blog_entry(item: dict) -> str:
    meta = escape(item.get("kind", "Article"))
    if item.get("date"):
        published = date.fromisoformat(item["date"])
        label = f'{published:%B} {published.day}, {published.year}'
        meta = f'<time datetime="{escape(item["date"])}">{label}</time>'
        if item.get("read_time"):
            meta += f' · {escape(item["read_time"])} read'
        elif item.get("kind"):
            meta += f' · {escape(item["kind"])}'
        if item.get("draft"):
            meta += ' · <strong>Draft</strong>'
    excerpt = item.get("excerpt_html") or ''.join(f'<p>{escape(p)}</p>' for p in item.get("excerpt", [item["description"]]))
    return (f'<article class="blog-entry"><p class="row-meta">{meta}</p>'
            f'<h2><a href="{safe_url(item["url"])}">{escape(item["title"])}</a></h2>'
            f'<div class="entry-excerpt prose">{excerpt}</div>'
            f'<a class="text-link" href="{safe_url(item["url"])}">Continue reading <span aria-hidden="true">→</span>'
            f'<span class="sr-only">: {escape(item["title"])}</span></a></article>')


def render_hubs(posts: list[dict], output: Path, *, preview: bool = False) -> None:
    catalog = json.loads((ROOT / "content" / "catalog.json").read_text())
    # Validate every destination before rendering; broken internal paths are checked separately.
    def validate(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key.endswith("url") or key == "image":
                    if item:
                        safe_url(item)
                else:
                    validate(item)
        elif isinstance(value, list):
            for item in value:
                validate(item)
    validate(catalog)
    articles = sorted([*posts, *catalog['writing']], key=lambda item: item.get('date', ''), reverse=True)
    home = template("home.html", ARTICLES=''.join(blog_entry(p) for p in articles[:8]) or '<p>No articles yet.</p>',
                    ARCHIVE_LINK='<a class="text-link archive-link" href="/blog/">All posts →</a>' if len(articles) > 8 else '')
    write_page(output, '/', page('Charles Lee — Blog', 'Software, AI, pickleball, and whatever I take apart next. Articles and build notes by Charles Lee.', '/', home, active='writing', preview=preview))
    writing = template('writing.html', ARTICLES=''.join(blog_entry(p) for p in articles) or '<p>No articles yet.</p>')
    write_page(output, '/blog/', page('Writing — Charles Lee', 'Build notes, essays, and useful rabbit holes. What I tried, what broke, and what I learned.', '/blog/', writing, active='writing', preview=preview))
    bench = ''.join(f'<article><span class="bench-status">{escape(p["status"])}</span><h3>{escape(p["title"])}</h3><p>{escape(p["description"])}</p><p class="row-meta">{escape(p["notes"])}</p></article>' for p in catalog['bench'])
    projects = template('projects.html', PROJECTS=''.join(project_card(p, full=True) for p in catalog['projects']),
                        APPS=''.join(reading_row(p) for p in catalog['apps']), BENCH=bench, BENCH_COUNT=str(len(catalog['bench'])))
    write_page(output, '/making/', page('Projects — Charles Lee', 'Selected apps, interactive stories, and experiments with AI, with build notes and working demos.', '/making/', projects, active='projects', preview=preview))
    collections = ''
    for item in catalog['collections']:
        links = ''.join(f'<a class="text-link" href="{safe_url(p["url"])}">{escape(p["title"])} →</a>' for p in item.get('links', []))
        collections += f'<article class="collection"><h3>{escape(item["title"])}</h3><p>{escape(item["description"])}</p><div class="link-stack"><a class="text-link" href="{safe_url(item["url"])}">{escape(item["link_label"])} →</a>{links}</div></article>'
    library = template('library.html', COLLECTIONS=collections, EXPERIMENTS=''.join(reading_row(p) for p in catalog['experiments']))
    write_page(output, '/library/', page('Library — Charles Lee', 'Video notes, pickleball guides, travel, and the other corners of this site.', '/library/', library, preview=preview))
    write_page(output, '/about/', page('About — Charles Lee', 'I make small things and write them up. A few places to start, and how I work.', '/about/', template('about.html'), active='about', preview=preview))
