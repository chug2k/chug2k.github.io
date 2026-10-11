#!/usr/bin/env python3
"""Preview generated pages (including drafts) without changing published HTML."""
from __future__ import annotations

import argparse
import importlib
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import runpy
import tempfile
from urllib.parse import unquote, urlsplit
import site_builder

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="clpanic-preview-") as folder:
        output = Path(folder)
        previous = None

        def rebuild():
            nonlocal previous
            sources = [*ROOT.glob("blog/posts/*.md"), *ROOT.glob("_templates/*.html"),
                       *ROOT.glob("content/*.json"), ROOT / "blog/_template.html", ROOT / "_scripts/build-blog.py",
                       ROOT / "_scripts/site_builder.py"]
            snapshot = tuple((str(p), p.stat().st_mtime_ns) for p in sorted(sources))
            if snapshot != previous:
                importlib.reload(site_builder)
                build = runpy.run_path(str(ROOT / "_scripts/build-blog.py"))
                build["main"](output=output, include_drafts=True)
                previous = snapshot

        class Handler(SimpleHTTPRequestHandler):
            def do_GET(self):
                parts = Path(unquote(urlsplit(self.path).path)).parts
                if any(part.startswith(".") for part in parts) or any(part in ("_scripts", "_templates", "content", "posts") for part in parts):
                    self.send_error(404)
                    return
                try:
                    rebuild()
                except (ValueError, KeyError) as exc:
                    self.send_error(500, "Preview build failed", str(exc))
                    return
                super().do_GET()

            def translate_path(self, path):
                local = Path(super().translate_path(path)).relative_to(ROOT)
                generated = output / local
                return str(generated if generated.exists() else ROOT / local)

            def list_directory(self, path):
                self.send_error(404)
                return None

            def end_headers(self):
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Robots-Tag", "noindex, nofollow")
                super().end_headers()

            def __init__(self, *a, **kw):
                super().__init__(*a, directory=str(ROOT), **kw)

        rebuild()
        print(f"Preview: http://{args.host}:{args.port} (drafts included; refresh after editing)", flush=True)
        try:
            HTTPServer((args.host, args.port), Handler).serve_forever()
        except KeyboardInterrupt:
            print("\nPreview stopped.")


if __name__ == "__main__":
    main()
