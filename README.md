# Charles Lee’s blog & workshop

A static site at [clpanic.com](https://clpanic.com). Markdown posts, one project catalog, and shared HTML templates. The browser writing room needs no local tools. Local builds use Python 3 and Node.js 22 or newer; the Markdown renderer is bundled in the repository, so no package installation is needed for normal builds or previews.

## Write a post

Open the [writing room](https://clpanic.com/admin/), also linked as **Write** in the site footer. Add a title, a short summary, and your article. **Insert / Format** gives you headings, lists, tables, photos, and an excerpt break; you can also type `/` or select text to format it.

- Sign in with the account allowed for this writing room: `cl@clpanic.com`. Cloudflare Access protects `/admin` and its API.
- Drafts and photos save privately in Cloudflare. **Saved to cloud** means the server has acknowledged the save. Open the same writing room on another device to continue. Conflicting edits are kept as separate recovery copies.
- **New post** keeps your current draft. **Download backup** and **Import draft** export and restore a complete draft, including photos. Original browser drafts are copied into the cloud on first sign-in; their local originals remain available for recovery.
- Add photos from your device, clipboard, or a hosted URL. Uploaded photos stay private until you publish. Add useful alt text and an optional caption using the image controls.
- **Preview & publish** shows the article using the same layout and Markdown renderer as the live site. Review the title, date, and destination, then choose **Publish now**. The date orders articles; it does not schedule publication.
- **Account** shows the signed-in author and sync status. Publishing credentials are held by the server; there is no token to paste into each browser.
- **Existing articles** opens a private working copy. Publishing updates the original URL. **Load latest** fetches the GitHub version and keeps your previous copy.

Publishing uploads the photos and article, then GitHub rebuilds the site. Allow a minute or two. The editor only confirms **Live** after the served article matches the saved source; **Check again** retries that check. A local preview may be unable to check the live site across domains, in which case use the live-site link. If a network response is lost, retrying reconciles the saved GitHub copy before writing again.

The editor preserves source sections that cannot safely round-trip through visual editing. Those sections show as preserved Markdown blocks and remain editable in **Markdown** mode. Tables and excerpt breaks have visual editing support. Opening an article alone does not rewrite its source. If a connection drops, the latest working text and pending save are kept on the device and retried. Do not clear browser storage while a save is pending; download a backup before leaving if you cannot reconnect. A fresh page needs a connection and a valid sign-in to open the cloud library.

Cloud infrastructure and deployment instructions are in [cloud/README.md](cloud/README.md). The cloud Worker and Access application must be configured before deploying this version of the editor.

### Write in a local Markdown file

```sh
./_scripts/new-post.sh "A working title"
python3 _scripts/serve.py
```

The first command creates `blog/posts/YYYY-MM-DD-a-working-title.md` with `draft: true`. The second serves a local preview at `http://127.0.0.1:8000`. It includes drafts, rebuilds when you refresh after an edit, and keeps preview HTML in a temporary directory. It does not modify published pages. Stop it with Ctrl-C.

Edit the Markdown file:

```markdown
---
title: A working title
description: One sentence explaining why this is worth reading.
date: 2026-10-11
draft: true
---

Start with what happened.

# What I tried

# What I learned
```

The title becomes the page heading. In the body, `#` becomes a section heading, `##` a subsection, and `###` a smaller heading. Paragraphs, bold, emphasis, strikethrough, links, images, code blocks, quotes, nested lists, checklists, and pipe tables are supported. Raw HTML is displayed as text. Preview and publication use the same bundled Markdown renderer and article template.

Tables use ordinary Markdown and scroll horizontally on small screens. Colons in the separator row set column alignment; use `\|` for a literal pipe inside a cell.

```markdown
| Paddle | Price | Best for |
| --- | ---: | --- |
| **Spitfire** | $109.99 | Budget power |
| **Jelly Bean 2** | $169.99 | Touch and resets |
```

The homepage shows opening paragraphs from the actual article (up to four paragraphs, stopping after roughly 120 words). Add `<!--more-->` on its own line where you want an exact excerpt break; that marker is hidden on the full article.

Put photos in `blog/assets/<post-name>/` and refer to them as `![A useful description](/blog/assets/<post-name>/photo.jpg)`.

## Publish from a local file

1. Change `draft: true` to `draft: false`.
2. Build and check:

   ```sh
   python3 _scripts/build-blog.py
   python3 _scripts/build-sitemap.py
   python3 _scripts/check-site.py
   ```

3. Review your changes, commit the source and generated HTML, and push to `main`.

The newest published post automatically leads the homepage. The homepage, writing archive, and sitemap update with it. The homepage shows the eight newest articles in one list, combining Markdown posts and standalone pieces by date; projects live on their own page. The existing GitHub Pages setup serves the generated HTML. The **Render site** workflow also rebuilds when you change posts, templates, the catalog, scripts, or assets, then requests a Pages build after the bot commit.

Posts without a `draft` field remain published for compatibility with the browser editor. Dates order posts; a future date is **not** a scheduling mechanism. Leave unfinished posts as drafts. Drafts are excluded from production pages and sitemap. Changing a previously published post to draft replaces its generated page with a noindex unavailable notice on the next build; the original Markdown stays intact.

This is a public repository: Markdown committed here is public even when marked as a draft. Keep genuinely private drafts outside the repository.

The local workflow uses your existing Git access and needs no editor token.

## Update projects or navigation

| Change | Edit |
| --- | --- |
| Write or edit a post | `blog/posts/*.md` |
| Add a project, change its description or links | `content/catalog.json` |
| Add an older standalone article | Add its `date` and opening `excerpt` paragraphs to `writing` in `content/catalog.json` |
| Change the introduction | `_templates/home.html` |
| Change the About page | `_templates/about.html` |
| Shared header, footer, metadata | `_templates/base.html` and `_scripts/site_builder.py` |
| Post layout | `blog/_template.html` |
| Colors, typography, spacing | `assets/site.css` |
| Character artwork and generation prompt | `assets/images/` |

Standalone articles use their first repository commit dates (June 2026) for the chronology. Their excerpts are drawn from the existing articles and can be edited in the catalog.

Run `python3 _scripts/build-blog.py` after editing sources. Avoid editing generated `index.html` files; the next build replaces them. Existing standalone guides, experiments, and video pages retain their own layouts and URLs.

If you change the Markdown implementation (`_scripts/markdown-renderer.js`) or article template (`blog/_template.html`), rebuild the shared renderer with `bash _scripts/build-markdown.sh` before building the site. That maintenance command installs its pinned build packages in a temporary folder and produces `assets/markdown.mjs`; normal writing does not require it. GitHub’s Render site workflow rebuilds it automatically. The writer loads that same module so formatting cannot drift between its preview and the published article.

## A publishing habit that fits this site

Aim for one useful post a week, even if it is short. There are three natural recurring subjects: **things I built**, **things I tried**, and **things I changed my mind about**. A specific incident is a stronger opening than an introduction to a whole topic.

An easy structure: what I wanted → what I tried → the surprising part → what I’d do differently. Include one real screenshot, photograph, or example when it helps. Keep the jokes in your voice; a good observation is enough.

The existing workbench already has post ideas: what failed in phone-based pickleball analysis, how to evaluate a cloned voice, and how a MIDI arrangement starts to feel less mechanical. Write those when you have something specific to show. New posts appear at the top automatically; the project collection stays on its own page.

## Checks

```sh
python3 -m unittest discover -s _scripts/tests
python3 _scripts/check-site.py
```

The first exercises publication, drafts, metadata, and build determinism in temporary directories. The second validates the generated site's local links, assets, page structure, and sitemap XML.

For writing-room changes:

```sh
bash _scripts/build-admin.sh
npm ci --prefix admin
cd admin
npx playwright install chromium
npm test
```

The browser suites start temporary servers and use fresh browser storage. All cloud and GitHub calls are mocked, so tests do not publish articles or need credentials. The original editor regressions explicitly enable local storage only on loopback; separate cloud tests exercise cross-device saves, photos, migration, offline recovery, and expired sessions through the real browser adapter. `npm ci --prefix cloud && npm test --prefix cloud` exercises authentication and actual SQLite/R2 bindings inside the Workers runtime. GitHub Actions runs both suites. Rebuild the admin bundle after editing `admin/src/`, `admin/writer.css`, or its dependencies; the build also updates the page's cache fingerprints.
