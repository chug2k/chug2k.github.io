#!/usr/bin/env python3
"""Create a Markdown draft without publishing placeholder content."""
import argparse
from datetime import date
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("title", help="A working title, in quotes")
    args = parser.parse_args()
    title = " ".join(args.title.split())
    if not title:
        parser.error("Give the post a title")
    normalized = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")[:60].rstrip("-") or "new-post"
    today = date.today().isoformat()
    path = ROOT / "blog" / "posts" / f"{today}-{slug}.md"
    try:
        with path.open("x") as f:
            f.write(f"---\ntitle: {title}\ndescription: Add a sentence about what the reader will get.\ndate: {today}\ndraft: true\n---\n\nStart with what happened.\n\n# What I tried\n\n# What I learned\n")
    except FileExistsError:
        parser.error(f"Already exists: {path.relative_to(ROOT)}")
    print(f"Created draft: {path.relative_to(ROOT)}")
    print("Preview: python3 _scripts/serve.py")
    print("Publish: change draft to false, build, then commit and push.")


if __name__ == "__main__":
    main()
