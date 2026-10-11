"""Exercise author-facing publishing behavior against isolated source/output trees."""
from pathlib import Path
import importlib.util
import shutil
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
import site_builder

spec = importlib.util.spec_from_file_location("blog_builder", SCRIPTS / "build-blog.py")
blog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(blog)


class PublishingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "source"
        self.output = Path(self.temp.name) / "public"
        self.posts = self.root / "blog/posts"
        self.posts.mkdir(parents=True)
        for name in ("_templates", "content"):
            shutil.copytree(site_builder.ROOT / name, self.root / name)
        self.original_root = site_builder.ROOT
        self.original_posts = blog.POSTS_DIR
        site_builder.ROOT = self.root
        blog.POSTS_DIR = self.posts

    def tearDown(self):
        site_builder.ROOT = self.original_root
        blog.POSTS_DIR = self.original_posts
        self.temp.cleanup()

    def post(self, slug, title, *, draft=None, body="A useful observation."):
        flag = f"draft: {str(draft).lower()}\n" if draft is not None else ""
        path = self.posts / f"{slug}.md"
        path.write_text(f"---\ntitle: {title}\ndescription: Notes on {title}.\ndate: {slug[:10]}\n{flag}---\n\n{body}\n")
        return path

    def test_publication_updates_home_and_archive_but_excludes_drafts(self):
        self.post("2026-10-01-first", "First transmission")  # Existing editor: no draft field.
        self.post("2026-10-02-second", "Second transmission", draft=False)
        self.post("2026-10-03-secret", "Unfinished transmission", draft=True)
        blog.main(self.output)
        home = (self.output / "index.html").read_text()
        archive = (self.output / "blog/index.html").read_text()
        self.assertLess(home.index("Second transmission"), home.index("First transmission"))
        self.assertIn("First transmission", archive)
        for text in (home, archive):
            self.assertNotIn("Unfinished transmission", text)
            self.assertNotIn("feed.xml", text)
        self.assertFalse((self.output / "blog/2026-10-03-secret/index.html").exists())
        self.assertFalse((self.output / "feed.xml").exists())

    def test_preview_includes_draft_with_noindex_and_does_not_publish_it(self):
        self.post("2026-10-03-draft", "A draft", draft=True)
        blog.main(self.output, include_drafts=True)
        preview = (self.output / "blog/2026-10-03-draft/index.html").read_text()
        self.assertIn('name="robots" content="noindex,nofollow"', preview)
        self.assertIn("Local preview", preview)
        self.assertIn("A draft", (self.output / "index.html").read_text())
        self.assertFalse((self.root / "blog/2026-10-03-draft/index.html").exists())

    def test_homepage_limits_recent_posts_and_archive_keeps_older_posts(self):
        for day in range(1, 11):
            self.post(f"2026-10-{day:02}-post", f"Article {day:02}")
        blog.main(self.output)
        home = (self.output / "index.html").read_text()
        archive = (self.output / "blog/index.html").read_text()
        self.assertIn("Article 10", home)
        self.assertIn("Article 03", home)
        self.assertNotIn("Article 02", home)
        self.assertIn("All posts →", home)
        self.assertIn("Article 01", archive)
        self.assertNotIn("More articles", home)

    def test_posts_and_standalone_articles_share_one_chronology(self):
        self.post("2026-06-18-middle", "June notebook entry")
        self.post("2026-06-01-older", "Older notebook entry")
        blog.main(self.output)
        for path in ("index.html", "blog/index.html"):
            page = (self.output / path).read_text()
            self.assertLess(page.index("Shrinking YouTube Music"), page.index("June notebook entry"))
            self.assertLess(page.index("June notebook entry"), page.index("Lottie vs Remotion"))
            self.assertLess(page.index("Lottie vs Remotion"), page.index("Older notebook entry"))

    def test_homepage_excerpt_uses_article_body_and_respects_explicit_break(self):
        body = "The **opening** paragraph.\n\nA second paragraph.\n\n<!--more-->\n\nThe rest of the story."
        self.post("2026-10-01-post", "An article", body=body)
        blog.main(self.output)
        home = (self.output / "index.html").read_text()
        self.assertIn("The <strong>opening</strong> paragraph.", home)
        self.assertIn("A second paragraph.", home)
        self.assertNotIn("The rest of the story.", home)
        article = (self.output / "blog/2026-10-01-post/index.html").read_text()
        self.assertIn("The rest of the story.", article)
        self.assertNotIn("&lt;!--more--&gt;", article)
        default = blog.render_excerpt("One.\n\nTwo.\n\nThree.\n\nFour.\n\nFive.")
        self.assertIn("Four.", default)
        self.assertNotIn("Five.", default)

    def test_withdrawing_published_post_replaces_stale_body(self):
        self.post("2026-10-01-post", "Public then withdrawn", body="Unique original body.")
        blog.main(self.output)
        self.post("2026-10-01-post", "Public then withdrawn", draft=True, body="Unique original body.")
        blog.main(self.output)
        result = (self.output / "blog/2026-10-01-post/index.html").read_text()
        self.assertNotIn("Unique original body", result)
        self.assertIn("noindex", result)
        self.assertIn("isn’t currently published", result)
        self.assertTrue((self.posts / "2026-10-01-post.md").exists())

    def test_rebuilding_is_deterministic_and_metadata_is_escaped(self):
        self.post("2026-10-01-post", 'A "quote" & <experiment>', body="A literal {{TITLE}} placeholder.")
        blog.main(self.output)
        first = {str(p): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        blog.main(self.output)
        second = {str(p): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        self.assertEqual(first, second)
        content = (self.output / "blog/2026-10-01-post/index.html").read_text()
        self.assertIn("A &quot;quote&quot; &amp; &lt;experiment&gt;", content)
        self.assertIn("A literal {{TITLE}} placeholder.", content)

    def test_invalid_frontmatter_fails_before_writing(self):
        path = self.post("2026-10-01-post", "Broken metadata")
        path.write_text(path.read_text().replace("date: 2026-10-01", "date: 2026-99-01"))
        with self.assertRaises(ValueError):
            blog.main(self.output)
        self.assertFalse(self.output.exists())

    def test_dashes_in_title_do_not_end_frontmatter(self):
        self.post("2026-10-01-post", "A thought --- continued", body="The whole article.")
        blog.main(self.output)
        article = (self.output / "blog/2026-10-01-post/index.html").read_text()
        self.assertIn("A thought --- continued", article)
        self.assertIn("The whole article.", article)


if __name__ == "__main__":
    unittest.main()
