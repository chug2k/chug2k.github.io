#!/usr/bin/env python3
"""Build the static blog, homepage, project catalog, library, and About page.

Use new-post.sh to create a draft; serve.py to preview it without writing published
HTML; then set draft: false and run this script to build. Python stdlib only.
Edit blog/posts/*.md, content/catalog.json, and _templates/ rather than generated HTML.
"""
from __future__ import annotations
import html
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
    text = path.read_text()
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


def table_cells(line: str) -> list[str]:
    """Split a pipe row, keeping escaped pipes inside their cells."""
    text = line.strip()
    cells, cell = [], []
    i = 0
    while i < len(text):
        if text[i] == "\\" and i + 1 < len(text) and text[i + 1] in "\\|":
            cell.append(text[i + 1])
            i += 2
            continue
        if text[i] == "|":
            cells.append("".join(cell).strip())
            cell = []
        else:
            cell.append(text[i])
        i += 1
    cells.append("".join(cell).strip())
    if text.startswith("|"):
        cells.pop(0)
    # A delimiter at the end leaves an empty final segment; an escaped pipe does not.
    if text.endswith("|") and cells[-1] == "":
        cells.pop()
    return cells


def table_alignments(line: str) -> list[str]:
    cells = table_cells(line)
    if not cells or not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
        return []
    return ["center" if cell.startswith(":") and cell.endswith(":") else
            "right" if cell.endswith(":") else "left" for cell in cells]


def render_markdown(body: str) -> str:
    lines = body.splitlines()
    out: list[str] = []
    para: list[str] = []
    in_fence = False
    fence_lang = ""
    fence_buf: list[str] = []
    list_tag = ""  # "ul" | "ol" | ""
    skip_until = 0
    section_title = "Article"

    def flush_para():
        if para:
            out.append("    <p>" + " ".join(render_inline(l.strip()) for l in para) + "</p>")
            para.clear()

    def close_list():
        nonlocal list_tag
        if list_tag:
            out.append(f"    </{list_tag}>")
            list_tag = ""

    for index, line in enumerate(lines):
        if index < skip_until:
            continue
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
        if "|" in line and index + 1 < len(lines):
            headers = table_cells(line)
            alignments = table_alignments(lines[index + 1])
            if alignments and len(headers) == len(alignments):
                flush_para()
                close_list()
                label = html.escape(f"{section_title} table", quote=True)
                out.append(f'    <div class="table-scroll" role="region" aria-label="{label}" tabindex="0">')
                out.append("      <table><thead><tr>")
                for cell, align in zip(headers, alignments):
                    out.append(f'        <th scope="col" class="table-align-{align}">{render_inline(cell)}</th>')
                out.append("      </tr></thead><tbody>")
                end = index + 2
                while end < len(lines) and "|" in lines[end] and not re.match(r"\s*(?:```|#{1,6}\s|>\s|[-*]\s|\d+[.)]\s)", lines[end]):
                    cells = table_cells(lines[end])
                    cells = (cells + [""] * len(headers))[:len(headers)]
                    out.append("        <tr>")
                    for cell, align in zip(cells, alignments):
                        out.append(f'          <td class="table-align-{align}">{render_inline(cell)}</td>')
                    out.append("        </tr>")
                    end += 1
                out.append("      </tbody></table>\n    </div>")
                out.append('    <p class="table-hint">Scroll sideways to compare all columns.</p>')
                skip_until = end
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
            section_title = h.group(2)
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


def render_excerpt(body: str) -> str:
    """Use the opening paragraphs, or an author's explicit <!--more--> break."""
    if '<!--more-->' in body:
        return render_markdown(body.split('<!--more-->', 1)[0])
    paragraphs = []
    words = 0
    for paragraph in re.findall(r'<p>.*?</p>', render_markdown(body), flags=re.S):
        if '<img ' in paragraph:
            continue
        paragraphs.append(paragraph)
        words += len(re.sub(r'<[^>]*>', '', paragraph).split())
        if words >= 120 or len(paragraphs) >= 4:
            break
    return '\n'.join(paragraphs)


def fill(template: str, post: dict, content_html: str) -> str:
    return (template
            .replace("{{TITLE}}", html.escape(post["title"]))
            .replace("{{DESCRIPTION}}", html.escape(post["description"]))
            .replace("{{SLUG}}", post["slug"])
            .replace("{{DATE_ISO}}", post["date"])
            .replace("{{DATE_DISPLAY}}", display_date(post["date"]))
            .replace("{{READ_TIME}}", read_time_minutes(post["body"]))
            .replace("{{CONTENT}}", content_html.rstrip()))


def main(output: Path = ROOT, include_drafts: bool = False) -> int:
    all_posts = [parse_post(p) for p in sorted(POSTS_DIR.glob("*.md"))]
    posts = [p for p in all_posts if include_drafts or not p["draft"]]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    for post in posts:
        post["url"] = f'/blog/{post["slug"]}/'
        post["display_date"] = display_date(post["date"])
        post["read_time"] = read_time_minutes(post["body"])
        post["excerpt_html"] = render_excerpt(post["body"])

    # Validate the catalog before producing any article files.
    render_hubs(posts, output, preview=include_drafts)
    for post in posts:
        content_html = render_markdown(post["body"].replace('<!--more-->', ''))
        markup = page(post["title"] + " — Charles Lee", post["description"], post["url"],
                      fill(TEMPLATE, post, content_html), active="writing", article=True,
                      extra_head=f'<meta property="article:published_time" content="{post["date"]}">',
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
