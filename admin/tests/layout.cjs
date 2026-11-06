// Run: npm ci --prefix admin && node admin/tests/layout.cjs
// Layout and accessibility checks for the writing-room shell. Serves the
// checkout read-only on an ephemeral port, boots the production (cloud) code
// path against an in-memory /admin/api mock, and refuses every GitHub request.
// Screenshots go to admin/test-results/layout/ (or LAYOUT_SHOTS).
const assert = require("node:assert/strict"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../.."),
  out = process.env.LAYOUT_SHOTS || path.join(__dirname, "../test-results/layout");
const failures = [];
let total = 0,
  browser,
  server,
  base,
  posts = [];

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const body = `Foam cores changed how the ball leaves the face this year.

<!--more-->

## What changed

| Paddle | Core | Price |
| --- | --- | ---: |
| Example one | Foam | $250 |
| Example two | Polymer | $180 |

A closing paragraph with **bold** and *italic* text.
`;

function cloudMock(model) {
  return async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname.slice("/admin/api/".length);
    const json = (value, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (p === "session")
      return json({
        user: { email: "cl@clpanic.com", name: "Charles" },
        config: { owner: "chug2k", repo: "chug2k.github.io", branch: "main", siteUrl: base },
        publishing: true,
      });
    if (p === "github/list") return json(posts);
    if (p === "drafts" && req.method() === "GET") return json([...model.drafts.values()]);
    if (p.startsWith("drafts/")) return json(model.drafts.get(decodeURIComponent(p.slice(7))) || null);
    if (p === "drafts" && req.method() === "POST") {
      const b = req.postDataJSON(),
        latest = model.drafts.get(b.draft.id);
      const d = { ...b.draft, revision: (latest?.revision || 0) + 1, updatedAt: Date.now() };
      model.drafts.set(d.id, d);
      return json({ draft: d, conflict: false });
    }
    if (p.startsWith("assets/")) return json({ uploaded: true });
    return json({ error: "Unexpected mock path" }, 404);
  };
}

// LAYOUT_APP_JS=/path/to/app.js checks an unbuilt bundle without touching admin/app.js.
async function routeBundle(c) {
  if (process.env.LAYOUT_APP_JS)
    await c.route("**/admin/app.js?*", async (r) =>
      r.fulfill({ contentType: "text/javascript", body: await fs.readFile(process.env.LAYOUT_APP_JS) }),
    );
}

async function setup({ viewport = { width: 1440, height: 900 }, touch = false, seed = true, before } = {}) {
  const c = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  c.setDefaultTimeout(8000);
  const model = { drafts: new Map() };
  if (seed) {
    const now = Date.now();
    for (const [i, title] of [
      "Why power foam paddles feel different",
      "Notes from the October tournament",
      "A long working title that keeps going so the sidebar has to truncate it cleanly",
    ].entries())
      model.drafts.set(`seed-${i}`, {
        id: `seed-${i}`,
        title,
        dek: i ? "" : "A field guide to the October paddles.",
        date: "2026-11-06",
        slug: "",
        markdown: i ? "" : body,
        blocks: null,
        sourceMode: false,
        assetIds: [],
        revision: 1,
        updatedAt: now - i * 3600_000,
      });
  }
  const errors = [];
  await c.route("**/admin/api/**", cloudMock(model));
  await c.route(/https:\/\/(api\.)?github\.com\//, (r) => r.abort("blockedbyclient"));
  await routeBundle(c);
  if (before) await before(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/admin/");
  await p.waitForFunction(() => window.writerBoot?.ready);
  // Until entry.js imports layout.js, load it the way the bundle will.
  if (!(await p.evaluate(() => !!window.writerLayout)))
    await p.addScriptTag({
      type: "module",
      content: "import { initWriterLayout } from '/admin/src/layout.js'; initWriterLayout();",
    });
  await p.waitForFunction(() => document.documentElement.dataset.layout === "ready");
  return {
    p,
    c,
    model,
    errors,
    async close() {
      await c.close();
      assert.deepEqual(errors, []);
    },
  };
}
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });
const visible = (p, sel) => p.locator(sel).isVisible();
const box = (p, sel) => p.locator(sel).evaluate((e) => e.getBoundingClientRect().toJSON());
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log("PASS", name);
  } catch (e) {
    failures.push(name);
    console.error("FAIL", name, e.stack);
  }
}

(async () => {
  await fs.mkdir(out, { recursive: true });
  posts = (await fs.readdir(path.join(root, "blog/posts")))
    .filter((n) => n.endsWith(".md"))
    .sort()
    .reverse()
    .slice(0, 6)
    .map((name) => ({ name, path: `blog/posts/${name}` }));
  server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep)) throw Error("Invalid path");
      res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
      res.end(await fs.readFile(file));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });

  await test("desktop: docked sidebar collapses, reopens, and remembers", async () => {
    const s = await setup(),
      { p } = s;
    await p.locator(".draft-open").first().waitFor();
    assert.equal(await visible(p, "#drawer"), true);
    assert.equal(await visible(p, "#draftsBtn"), false);
    for (const title of ["Why power foam", "Notes from the October", "A long working title"])
      assert.equal(await p.locator("#draftlist .draft-open", { hasText: title }).count(), 1);
    await p.locator(".draft-open", { hasText: "Why power foam" }).click();
    await p.waitForFunction(() => document.querySelector("#title").value.startsWith("Why power"));
    await p.locator("[data-content-type=table]").waitFor();
    await p.locator("#postsDrawer > summary").click();
    await p.locator("#postlist .draft-open").first().waitFor();
    await shot(p, "desktop");
    // The status line never pushes the bar past one row.
    assert((await box(p, ".topbar")).height <= 56);
    await p.locator("#drawer").hover();
    await p.locator("#sidebarClose").click();
    assert.equal(await visible(p, "#drawer"), false);
    assert.equal(await p.evaluate(() => document.activeElement.id), "draftsBtn");
    assert.equal(await p.evaluate(() => localStorage.getItem("writer.sidebar")), "closed");
    await shot(p, "desktop-collapsed");
    await p.evaluate(() => scrollTo(0, 300));
    const before = await p.evaluate(() => scrollY);
    // A real pointer press: Playwright's own scroll-into-view would move a sticky bar.
    const opener = await box(p, "#draftsBtn");
    await p.mouse.click(opener.x + opener.width / 2, opener.y + opener.height / 2);
    assert.equal(await visible(p, "#drawer"), true);
    assert.equal(await p.evaluate(() => document.activeElement.id), "draftSearch");
    await p.waitForTimeout(700);
    assert.equal(await p.evaluate(() => scrollY), before, "opening drafts must not scroll the article");
    await p.keyboard.press("Control+Backslash");
    assert.equal(await visible(p, "#drawer"), false);
    await p.reload();
    await p.waitForFunction(() => document.documentElement.dataset.sidebar === "closed");
    assert.equal(await visible(p, "#drawer"), false);
    await s.close();
  });

  await test("desktop: account popover, menus, keyboard", async () => {
    const s = await setup(),
      { p } = s;
    await p.locator("#connectBtn").click();
    assert.equal(await visible(p, "#accountMenu .account-menu"), true);
    assert.equal(await p.locator("#cloudUserEmail").innerText(), "cl@clpanic.com");
    assert.equal(await visible(p, "#connectionDrawer"), false, "token form stays hidden in production");
    assert.equal(await visible(p, "#cloudSignOut"), true);
    assert.equal(await p.locator("#cloudSignIn").getAttribute("href"), "/admin/");
    assert.match(await p.locator("#accountMenu .account-note").innerText(), /Only Publish changes the blog/);
    const panel = await box(p, "#accountMenu .account-menu");
    assert(panel.top >= 0 && panel.bottom <= 900, JSON.stringify(panel));
    await shot(p, "desktop-account");
    await p.locator("#connectBtn").click();
    assert.equal(await visible(p, "#accountMenu .account-menu"), false);
    await p.locator("#connectBtn").click();
    await p.keyboard.press("Escape");
    assert.equal(await visible(p, "#accountMenu .account-menu"), false);
    assert.equal(await p.evaluate(() => document.activeElement.id), "connectBtn");
    await p.locator("#connectBtn").click();
    await p.locator("#title").click();
    assert.equal(await visible(p, "#accountMenu .account-menu"), false);
    // Insert menu: keyboard opens it and arrows move through the items.
    await p.locator("#insertMenu > summary").focus();
    await p.keyboard.press("ArrowDown");
    assert.equal(await p.locator("#insertMenu").getAttribute("open"), "");
    assert.equal(await p.evaluate(() => document.activeElement.dataset.insert), "paragraph");
    await p.keyboard.press("ArrowUp");
    assert.equal(await p.evaluate(() => document.activeElement.id), "linkBtn");
    await shot(p, "desktop-insert");
    await p.keyboard.press("Escape");
    assert.equal(await p.locator("#insertMenu").getAttribute("open"), null);
    await s.close();
  });

  await test("desktop: table and image tools, Markdown mode, preview dialog", async () => {
    const s = await setup(),
      { p } = s;
    await p.locator(".draft-open", { hasText: "Why power foam" }).click();
    await p.locator("[data-content-type=table] td").first().waitFor();
    const tableBefore = await box(p, "[data-content-type=table]");
    await p.locator("[data-content-type=table] td p").first().click();
    await p.locator("#tableTools").waitFor();
    const tableAfter = await box(p, "[data-content-type=table]");
    assert.equal(tableAfter.top, tableBefore.top, "showing table tools must not move the article");
    const tools = await box(p, "#tableTools");
    assert(tools.bottom <= 900 && tools.top >= tableAfter.bottom, JSON.stringify(tools));
    await shot(p, "desktop-table-tools");
    await p.locator("#modeBtn").click();
    await p.locator("#sourceBox").waitFor();
    assert.equal(await visible(p, "#insertMenu"), false);
    assert.equal(await p.locator("#modeBtn").innerText(), "Visual editor");
    await shot(p, "desktop-markdown");
    await p.locator("#reviewBtn").click();
    await p.locator("#reviewDialog").waitFor();
    const publish = await box(p, "#publishBtn");
    assert(publish.bottom <= 900 && publish.top > 0);
    await p.locator("#mobilePreview").click();
    assert.equal(await p.locator("#mobilePreview").getAttribute("aria-pressed"), "true");
    assert.equal(await p.locator("#desktopPreview").getAttribute("aria-pressed"), "false");
    await p.waitForTimeout(300);
    await shot(p, "desktop-review");
    await p.locator("#closeReview").click();
    await s.close();
  });

  for (const width of [320, 375, 414, 768]) {
    await test(`${width}px touch: drawer, top bar, no overflow, editor clear`, async () => {
      const height = width === 320 ? 640 : width === 768 ? 1024 : 860;
      const s = await setup({ viewport: { width, height }, touch: true }),
        { p } = s;
      await p.locator(".draft-open").first().waitFor({ state: "attached" });
      assert.equal(await visible(p, "#drawer"), false);
      assert.equal(await noOverflow(p), true);
      const bar = await box(p, ".topbar");
      assert(bar.height < 110, `top bar ${bar.height}`);
      for (const sel of ["#draftsBtn", "#insertMenu > summary", "#modeBtn", "#reviewBtn", "#moreMenu > summary"]) {
        const b = await box(p, sel);
        assert(b.height >= 44 && b.width >= 44, `${sel} ${b.width}x${b.height}`);
        assert(b.right <= width && b.left >= 0, `${sel} off screen`);
        const lines = await p
          .locator(sel)
          .evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
        assert(lines <= 2, `${sel} wraps`);
      }
      await p.locator("#title").fill("Why power foam paddles feel different");
      await p.locator("#dek").fill("A field guide to the October paddles.");
      await p.getByRole("textbox", { name: "Article body", exact: true }).click();
      await p.keyboard.type("Foam cores changed the feel of the game this year.");
      const editor = await box(p, "#editor [contenteditable=true]");
      assert(editor.top >= bar.bottom, "editor starts below the top bar");
      await p.evaluate(() => scrollTo(0, 0));
      await p.waitForTimeout(150);
      await shot(p, `mobile-${width}`);
      // Drawer opens below the bar, takes focus, and closes on Escape.
      await p.locator("#draftsBtn").click();
      assert.equal(await visible(p, "#drawer"), true);
      assert.equal(await p.locator("#draftsBtn").getAttribute("aria-expanded"), "true");
      assert.equal(await p.evaluate(() => document.querySelector("#sheet .doc").inert), true);
      const drawer = await box(p, "#drawer");
      assert(drawer.top >= bar.bottom - 1 && drawer.right <= width);
      await p.waitForTimeout(350);
      assert.equal(await noOverflow(p), true);
      await shot(p, `mobile-${width}-drawer`);
      await p.keyboard.press("Escape");
      assert.equal(await visible(p, "#drawer"), false);
      assert.equal(await p.evaluate(() => document.activeElement.id), "draftsBtn");
      // A second press on the bar button closes; the scrim closes; a choice closes.
      await p.locator("#draftsBtn").click();
      await p.locator("#draftsBtn").click();
      assert.equal(await visible(p, "#drawer"), false);
      await p.locator("#draftsBtn").click();
      await p.locator(".scrim").click({ position: { x: width - 10, y: 400 } });
      assert.equal(await visible(p, "#drawer"), false);
      await p.locator("#draftsBtn").click();
      await p.locator(".draft-open", { hasText: "Notes from" }).click();
      assert.equal(await visible(p, "#drawer"), false);
      await p.waitForFunction(() => document.querySelector("#title").value.startsWith("Notes from"));
      // Top-bar actions work while the drawer is open and close it.
      await p.locator("#draftsBtn").click();
      await p.locator("#modeBtn").click();
      await p.locator("#sourceBox").waitFor();
      assert.equal(await visible(p, "#drawer"), false);
      await p.locator("#modeBtn").click();
      await p.locator("#sourceBox").waitFor({ state: "hidden" });
      // Menus stay inside the screen.
      await p.locator("#insertMenu > summary").click();
      const menu = await box(p, "#insertMenu .menu");
      assert(menu.left >= 0 && menu.right <= width && menu.bottom <= height + 1, JSON.stringify(menu));
      await shot(p, `mobile-${width}-insert`);
      await p.locator("#insertMenu > summary").click();
      // Account popover inside the drawer.
      await p.locator("#draftsBtn").click();
      await p.locator("#connectBtn").click();
      const panel = await box(p, "#accountMenu .account-menu");
      assert(panel.top >= bar.bottom - 1 && panel.right <= width, JSON.stringify(panel));
      await shot(p, `mobile-${width}-account`);
      await p.keyboard.press("Escape");
      await p.keyboard.press("Escape");
      assert.equal(await visible(p, "#drawer"), false);
      // Preview dialog keeps Publish in reach.
      await p.locator("#reviewBtn").click();
      await p.locator("#reviewDialog").waitFor();
      const publish = await box(p, "#publishBtn");
      assert(publish.bottom <= height && publish.top >= 0, JSON.stringify(publish));
      assert.equal(await noOverflow(p), true);
      await p.waitForTimeout(300);
      await shot(p, `mobile-${width}-review`);
      await p.locator("#closeReview").click();
      await s.close();
    });
  }

  await test("boot failure keeps the error detail and offers sign-in", async () => {
    for (const [label, handler, pattern] of [
      ["auth", (r) => r.fulfill({ status: 401, contentType: "application/json", body: "{}" }), /Sign in again to sync/],
      ["offline", (r) => r.abort("failed"), /waiting for a connection/],
    ]) {
      const c = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
      await c.route("**/admin/api/**", handler);
      await c.route(/https:\/\/(api\.)?github\.com\//, (r) => r.abort("blockedbyclient"));
      await routeBundle(c);
      const p = await c.newPage();
      await p.goto(base + "/admin/");
      await p.locator("#retryBoot").waitFor({ state: "visible" });
      const text = await p.locator("#bootStatus").innerText();
      assert.match(text, /could not load/);
      assert.match(text, pattern);
      assert.equal(await p.locator("#bootSignIn").isVisible(), true);
      assert.equal(await p.locator("#bootSignIn").getAttribute("href"), "/admin/");
      assert.equal(await noOverflow(p), true);
      const card = await box(p, "#bootStatus");
      assert(card.left >= 0 && card.right <= 375 && card.bottom <= 812, JSON.stringify(card));
      await shot(p, `boot-${label}`);
      await c.close();
    }
  });

  await test("drawer layout falls back to in-flow without layout.js", async () => {
    const c = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    await c.route("**/admin/api/**", cloudMock({ drafts: new Map() }));
    await c.route(/https:\/\/(api\.)?github\.com\//, (r) => r.abort("blockedbyclient"));
    const p = await c.newPage();
    await p.goto(base + "/admin/");
    await p.waitForFunction(() => window.writerBoot?.ready);
    if (await p.evaluate(() => !!window.writerLayout)) {
      await c.close();
      return; // entry.js already initialises layout.js; nothing to check.
    }
    assert.equal(await noOverflow(p), true);
    await p.locator("#draftsBtn").click();
    await p.waitForTimeout(600);
    const drawer = await box(p, "#drawer");
    assert(drawer.top < 812 && drawer.bottom > 0, "drafts scrolled into view");
    assert.equal(await p.locator("#sidebarClose").isVisible(), false);
    await c.close();
  });

  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(`${failures.length ? "FAIL" : "PASS"}: ${total - failures.length}/${total} layout checks`);
  if (failures.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error(e);
  await browser?.close();
  server?.close();
  process.exitCode = 1;
});
