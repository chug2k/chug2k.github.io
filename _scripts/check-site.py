#!/usr/bin/env python3
"""Check generated page structure, local links/assets, and sitemap."""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = []
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.headings += 1
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])
        if tag == "img" and "alt" not in attrs:
            raise ValueError("Image is missing alt text")


def main():
    files = [ROOT / p for p in ("index.html", "blog/index.html", "making/index.html", "about/index.html", "library/index.html")]
    files += list(ROOT.glob("blog/*/index.html"))
    errors = []
    checked = 0
    for file in files:
        doc = Document()
        try:
            doc.feed(file.read_text())
        except (ValueError, FileNotFoundError) as exc:
            errors.append(f"{file.relative_to(ROOT)}: {exc}")
            continue
        if doc.headings != 1:
            errors.append(f"{file.relative_to(ROOT)}: expected one h1, got {doc.headings}")
        if len(doc.ids) != len(set(doc.ids)):
            errors.append(f"{file.relative_to(ROOT)}: duplicate IDs")
        for href in doc.links:
            url = urlsplit(href)
            if url.scheme or url.netloc:
                continue
            path = (ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/") else file.parent / unquote(url.path)
            if not url.path:
                path = file
            if path.is_dir():
                path /= "index.html"
            checked += 1
            if not path.exists():
                errors.append(f"{file.relative_to(ROOT)}: missing {href}")
            elif url.fragment and path.suffix == ".html":
                target = Document()
                target.feed(path.read_text())
                if unquote(url.fragment) not in target.ids:
                    errors.append(f"{file.relative_to(ROOT)}: missing anchor {href}")
    for url in re.findall(r'url\([\"\']?([^\)\"\']+)', (ROOT / "assets/site.css").read_text()):
        if url.startswith("/") and not (ROOT / url.lstrip("/")).exists():
            errors.append(f"assets/site.css: missing {url}")
    for name in ("sitemap.xml",):
        try:
            ET.parse(ROOT / name)
        except (ET.ParseError, FileNotFoundError) as exc:
            errors.append(f"{name}: {exc}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Checked {len(files)} pages, {checked} local links/assets, fonts, and sitemap")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
