// Run: npm ci --prefix admin && node admin/tests/writer.cjs
// Serves the checkout read-only on an ephemeral port. All GitHub requests are mocked.
const assert = require("node:assert/strict"),
  http = require("node:http"),
  path = require("node:path"),
  fs = require("node:fs/promises"),
  crypto = require("node:crypto");
const { chromium, devices } = require("playwright");
const { unzipSync, strFromU8 } = require("fflate");
const root = path.resolve(__dirname, "../.."),
  out = path.join(__dirname, "../test-results");
let browser, server, base;
const failures = [];
let total = 0;
const gitsha = (bytes) =>
  crypto
    .createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
let png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
async function db(p) {
  return p.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("clpanic-writing-room", 1);
        r.onsuccess = () => {
          const d = r.result,
            q = d.transaction("drafts").objectStore("drafts").getAll();
          q.onsuccess = () => {
            resolve(q.result);
            d.close();
          };
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
async function ready(p) {
  await p.waitForFunction(() => window.writerBoot?.ready);
}
async function saved(p) {
  await p.waitForFunction(() =>
    /Saved|recovery copy/.test(document.querySelector("#status").textContent),
  );
}
async function menu(p) {
  if ((await p.locator("#moreMenu").getAttribute("open")) === null)
    await p.locator("#moreMenu > summary").click();
}
async function newDraft(p) {
  await menu(p);
  await p.locator("#newBtn").click();
}
async function toggle(p) {
  const visible = await p.locator("#sourceBox").isVisible();
  await p.locator("#modeBtn").click();
  await p.waitForFunction(
    (was) =>
      document.querySelector("#sourceBox").hidden === was &&
      !document.querySelector("#app").disabled,
    visible,
  );
}
async function source(p, title = "Fixture", body = "A complete article.") {
  await p.locator("#title").fill(title);
  await p.locator("#dek").fill("A useful summary.");
  if (!(await p.locator("#sourceBox").isVisible())) await toggle(p);
  await p.locator("#markdownSource").fill(body);
  await saved(p);
}
async function download(p) {
  await menu(p);
  const event = p.waitForEvent("download");
  await p.locator("#downloadBtn").click();
  return fs.readFile(await (await event).path());
}
async function signin(p) {
  await menu(p);
  await p.locator("#connectBtn").click();
  await p.locator("#tokenInput").fill("mock-token");
  await p.locator("#signinBtn").click();
  await p.waitForFunction(() => !document.querySelector("#signedIn").hidden);
}
async function review(p) {
  await p.locator("#reviewBtn").click();
  await p.locator("#reviewDialog").waitFor({ state: "visible" });
}
async function publish(p) {
  await review(p);
  await p.locator("#publishBtn").click();
  await p.waitForFunction(
    () => !document.querySelector("#publishBtn").disabled,
  );
}
async function imported(p, body, name = "2026-10-12-imported.md") {
  await p
    .locator("#importFile")
    .setInputFiles({
      name,
      mimeType: "text/markdown",
      buffer: Buffer.from(body),
    });
  await p.waitForFunction(
    () =>
      document.querySelector("#title").value === "Imported" &&
      !document.querySelector("#importFile").value,
  );
  await p.locator("[contenteditable=true]").waitFor();
}
const post = (body) =>
  "---\ntitle: Imported\ndescription: A useful summary.\ndate: 2026-10-12\ndraft: true\n---\n\n" +
  body;
async function setup(options = {}) {
  const c = await browser.newContext({
    acceptDownloads: true,
    ...options.context,
  });
  c.setDefaultTimeout(8000);
  const model = {
    files: new Map(),
    writes: [],
    drop: null,
    denied: 0,
    repoAllowed: true,
    delay: null,
    live: false,
    liveMismatch: false,
    ...options.model,
  };
  const errors = [];
  await c.route("https://api.github.com/**", async (r) => {
    try {
      const req = r.request(),
        u = new URL(req.url()),
        method = req.method(),
        json = (value, status = 200) =>
          r.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(value),
          });
      if (options.custom && (await options.custom(r, model, json))) return;
      if (model.denied) return json({ message: "Denied" }, model.denied);
      if (u.pathname === "/user") return json({ login: "mock-author" });
      const prefix = "/repos/chug2k/chug2k.github.io";
      if (u.pathname === prefix)
        return json({ permissions: { push: model.repoAllowed } });
      if (!u.pathname.startsWith(prefix + "/contents/"))
        return json({ message: "Unexpected mock path" }, 404);
      const file = decodeURIComponent(
        u.pathname.slice((prefix + "/contents/").length),
      );
      if (method === "PUT") {
        const data = req.postDataJSON(),
          bytes = Buffer.from(data.content, "base64"),
          previous = model.files.get(file);
        model.writes.push({ file, data, bytes });
        if (model.failPut) return json({ message: "Conflict" }, model.failPut);
        if (previous && data.sha !== previous.sha)
          return json({ message: "Conflict" }, 409);
        const record = { bytes, sha: gitsha(bytes) };
        model.files.set(file, record);
        if (model.drop && model.drop(file)) {
          model.drop = null;
          await r.abort("failed");
          return;
        }
        return json({ content: { sha: record.sha } }, 201);
      }
      if (model.delay && file === model.delay.path) await model.delay.gate;
      if (file === "blog/posts")
        return json(
          [...model.files.keys()]
            .filter((k) => k.startsWith("blog/posts/"))
            .map((k) => ({ name: k.split("/").pop(), path: k })),
        );
      const record = model.files.get(file);
      if (!record) return json({ message: "Not found" }, 404);
      return json({
        sha: record.sha,
        encoding: record.bytes.length > 1024 * 1024 ? "none" : "base64",
        content:
          record.bytes.length > 1024 * 1024
            ? ""
            : record.bytes.toString("base64"),
      });
    } catch (e) {
      errors.push(e);
      await r.fulfill({ status: 500, json: { message: "Mock error" } });
    }
  });
  await c.route("https://github.com/**", (r) =>
    r.fulfill({ status: 200, body: "Mock GitHub. No credentials or writes." }),
  );
  await c.route("**/blog/*/?writer_revision=*", async (r) => {
    const hash = new URL(r.request().url()).searchParams.get("writer_revision");
    await r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta name="article-source-sha256" content="${model.live ? (model.liveMismatch ? "older" : hash) : "older"}"><p>Mock live page</p>`,
    });
  });
  if (options.before) await options.before(c, model);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e));
  await p.goto(base + "/admin/");
  if (!options.noReady) await ready(p);
  return {
    p,
    c,
    model,
    errors,
    async close() {
      await c.close();
      assert.deepEqual(
        errors.map((e) => e.message),
        [],
      );
    },
  };
}
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
  server = http.createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://local").pathname,
      );
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep)) throw Error("Invalid path");
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".mjs": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  const imagePage = await browser.newPage();
  await imagePage.setContent(
    '<div style="background:#ca5429;width:10px;height:10px"></div>',
  );
  png = await imagePage.screenshot({
    clip: { x: 0, y: 0, width: 16, height: 16 },
  });
  await imagePage.close();
  await test("unrelated drafts and same-draft divergence survive concurrent tabs", async () => {
    const s = await setup(),
      { p, c } = s;
    await source(p, "Original", "Original body.");
    const q = await c.newPage();
    await q.goto(base + "/admin/");
    await ready(q);
    await newDraft(p);
    await source(p, "Only A", "A new draft.");
    await q.locator("#title").fill("Tab B original");
    await saved(q);
    let rows = await db(p);
    assert(rows.some((d) => d.title === "Only A"));
    await p.reload();
    await ready(p);
    await p.locator("#draftsBtn").click();
    await p
      .locator(".draft-open")
      .filter({ hasText: "Tab B original" })
      .click();
    await p.locator("#title").fill("Version A");
    await saved(p);
    await q.locator("#markdownSource").fill("Divergent B body.");
    await saved(q);
    rows = await db(p);
    assert(rows.some((d) => d.title === "Version A"));
    assert(
      rows.some((d) => d.markdown === "Divergent B body." && d.recoveryLabel),
    );
    await q.reload();
    await ready(q);
    assert((await db(q)).some((d) => d.markdown === "Divergent B body."));
    await s.close();
  });
  await test("startup is inert until ready; failed module exposes retry", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const s = await setup({
      noReady: true,
      before: async (c) =>
        c.route("**/app.js?*", async (r) => {
          await gate;
          await r.continue();
        }),
    });
    assert.equal(await s.p.locator("#title").isDisabled(), true);
    await s.p.locator("body").click({ position: { x: 20, y: 20 } });
    await s.p.keyboard.type("Cannot be discarded");
    assert.equal(await s.p.locator("#title").inputValue(), "");
    release();
    await ready(s.p);
    await s.close();
    const f = await setup({
      noReady: true,
      before: async (c) => c.route("**/app.js?*", (r) => r.abort("failed")),
    });
    await f.p.locator("#retryBoot").waitFor({ state: "visible" });
    assert.match(
      await f.p.locator("#bootStatus").innerText(),
      /could not load/,
    );
    assert.equal(await f.p.locator("#title").isDisabled(), true);
    await f.close();
  });
  await test("slow remote open cannot steal later navigation", async () => {
    let release;
    const gate = new Promise((r) => (release = r));
    const name = "blog/posts/2026-10-12-remote.md",
      bytes = Buffer.from(post("Remote body."));
    const s = await setup({
      model: {
        files: new Map([[name, { bytes, sha: gitsha(bytes) }]]),
        delay: { path: name, gate },
      },
    });
    await source(s.p, "Local", "Local body");
    await s.p.getByText("Existing articles", { exact: true }).click();
    await s.p.locator("#postlist button").click();
    await s.p.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.startsWith("Loading article"),
    );
    await newDraft(s.p);
    await s.p.locator("#title").fill("New intent");
    release();
    await saved(s.p);
    await s.p.waitForTimeout(300);
    assert.equal(await s.p.locator("#title").inputValue(), "New intent");
    await s.close();
  });
  await test("visual table and excerpt round-trip with exact initial download", async () => {
    const s = await setup(),
      body =
        "Opening.\n\n<!--more-->\n\n| Paddle | Price |\n| --- | --- |\n| Foam | $100 |\n\nClosing.\n",
      full = post(body);
    await imported(s.p, full);
    assert.equal((await download(s.p)).toString(), full);
    assert.equal(await s.p.locator("[data-content-type=table]").count(), 1);
    assert.equal(
      await s.p.locator("[data-content-type=excerptBreak]").count(),
      1,
    );
    await toggle(s.p);
    await toggle(s.p);
    assert.equal(await s.p.locator("#sourceBox").isVisible(), false);
    const cell = s.p.locator("table td p").first();
    await cell.fill("Carbon");
    await saved(s.p);
    const text = (await download(s.p)).toString();
    assert.match(text, /Carbon/);
    assert.match(text, /<!--more-->/);
    await review(s.p);
    const frame = s.p.frameLocator("#previewFrame");
    assert.equal(await frame.locator("table").count(), 1);
    assert.equal(await frame.locator("td").first().innerText(), "Carbon");
    await s.p.screenshot({ path: path.join(out, "table-preview.png") });
    await s.close();
  });
  await test("supported rich Markdown; unsupported alignment/references/code preserved", async () => {
    const s = await setup(),
      rich =
        "A [link](https://example.org/?a=1&b=2), **bold**, *italic*, ~~strike~~.\n\n- Parent\n  - Child\n\n- [x] Done\n- [ ] Later\n\n## Heading\n\n```js\n  const x = 1;\n    x++;\n```\n";
    await imported(s.p, post(rich));
    await toggle(s.p);
    await toggle(s.p);
    await review(s.p);
    const f = s.p.frameLocator("#previewFrame");
    assert.equal(
      await f.locator("a").filter({ hasText: "link" }).getAttribute("href"),
      "https://example.org/?a=1&b=2",
    );
    assert.equal(await f.locator("li ul").count(), 1);
    assert.equal(await f.locator("s,del").count(), 1);
    assert.equal(await f.locator("input[type=checkbox]").count(), 2);
    assert.match(
      await f.locator("pre code").innerText(),
      /  const x = 1;\n    x\+\+;/,
    );
    await s.p.locator("#closeReview").click();
    await imported(
      s.p,
      post(
        "Change this paragraph.\n\n| Item | Price |\n| --- | ---: |\n| A | 12 |\n\nA [reference][ref].\n\n[ref]: https://example.org/\n",
      ),
    );
    assert(
      (await s.p.locator("[data-content-type=preservedSource]").count()) >= 1,
    );
    assert.equal(await s.p.locator("[data-content-type=table]").count(), 1);
    await s.p
      .locator("[data-content-type=paragraph] .bn-inline-content")
      .first()
      .fill("Changed paragraph.");
    await saved(s.p);
    const exported = (await download(s.p)).toString();
    assert.match(exported, /---:/);
    assert.match(exported, /\[reference\]\[ref\]/);
    assert.match(exported, /\[ref\]: https:\/\/example.org\//);
    await s.close();
  });
  await test("photos stay local, survive reload, export complete ZIP and restore", async () => {
    const s = await setup();
    await source(s.p, "Photo draft", "Photo story.");
    await toggle(s.p);
    await s.p
      .locator("#photoFile")
      .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await s.p.locator("img.bn-visual-media").waitFor();
    await saved(s.p);
    assert.equal(s.model.writes.length, 0);
    await s.p.reload();
    await ready(s.p);
    await s.p.waitForFunction(
      () =>
        document.querySelector("img.bn-visual-media")?.complete &&
        document.querySelector("img.bn-visual-media")?.naturalWidth > 0,
    );
    const archive = await download(s.p),
      files = unzipSync(archive);
    assert(files["article.md"]);
    assert(Object.keys(files).some((n) => n.startsWith("blog/assets/")));
    assert(!strFromU8(files["article.md"]).includes("blob:"));
    await s.p
      .locator("#importFile")
      .setInputFiles({
        name: "backup.zip",
        mimeType: "application/zip",
        buffer: archive,
      });
    await s.p.waitForFunction(
      () => document.querySelector("#status").textContent === "Imported backup",
    );
    assert.equal(s.model.writes.length, 0);
    assert(
      (await db(s.p)).filter((d) => d.title === "Photo draft").length >= 2,
    );
    await s.close();
  });
  await test("401 reconnect, transient auth retained, permissions denied", async () => {
    const s = await setup();
    await source(s.p);
    await signin(s.p);
    s.model.denied = 401;
    await publish(s.p);
    await s.p.locator("#tokenInput").waitFor({ state: "visible" });
    assert.equal(
      await s.p.evaluate(() => localStorage.getItem("bn.token")),
      "",
    );
    assert.equal(s.model.writes.length, 0);
    assert((await db(s.p)).some((d) => d.markdown === "A complete article."));
    s.model.denied = 0;
    await signin(s.p);
    s.model.denied = 503;
    await s.p.reload();
    await ready(s.p);
    await s.p.waitForFunction(() =>
      document.querySelector("#authError").textContent.includes("503"),
    );
    assert.equal(
      await s.p.evaluate(() => localStorage.getItem("bn.token")),
      "mock-token",
    );
    await s.close();
    const f = await setup({ model: { repoAllowed: false } });
    await menu(f.p);
    await f.p.locator("#connectBtn").click();
    await f.p.locator("#tokenInput").fill("mock-token");
    await f.p.locator("#signinBtn").click();
    await f.p.waitForFunction(() =>
      document.querySelector("#authError").textContent.includes("cannot write"),
    );
    assert.equal(
      await f.p.evaluate(() => localStorage.getItem("bn.token")),
      null,
    );
    await f.close();
  });
  await test("accepted lost response reconciles once; exact digest alone confirms Live", async () => {
    const s = await setup({
      model: { drop: () => true, live: true, liveMismatch: true },
    });
    await source(s.p, "Published fixture", "The exact revision.");
    await signin(s.p);
    await s.p.locator("#connectionDrawer details summary").click();
    await s.p.locator("#siteUrl").fill(base);
    await s.p.locator("#siteUrl").blur();
    await publish(s.p);
    assert.equal(s.model.writes.length, 1);
    let d = (await db(s.p)).find((d) => d.title === "Published fixture");
    assert.equal(d.attempt.state, "accepted");
    assert(d.sha);
    assert.equal(await s.p.locator("#reloadBtn").isVisible(), true);
    assert.equal(
      d.attempt.hash,
      crypto.createHash("sha256").update(s.model.writes[0].bytes).digest("hex"),
    );
    await s.p.locator("#closeReview").click();
    await publish(s.p);
    assert.equal(s.model.writes.length, 1);
    await s.p.locator("#closeReview").click();
    s.model.liveMismatch = false;
    await s.p.locator("#checkLiveBtn").click();
    await s.p.waitForFunction(() =>
      document.querySelector("#status").textContent.startsWith("Live"),
    );
    d = (await db(s.p)).find((d) => d.title === "Published fixture");
    assert.equal(d.attempt.state, "live");
    await s.p.locator("#title").fill("Changed after live");
    await saved(s.p);
    assert.equal(
      (await db(s.p)).find((d) => d.title === "Changed after live")
        .unpublishedChanges,
      true,
    );
    await s.close();
  });
  await test("409 keeps draft and exposes recovery; no false acceptance", async () => {
    const s = await setup({ model: { failPut: 409 } });
    await source(s.p);
    await signin(s.p);
    await publish(s.p);
    assert.match(await s.p.locator("#reviewStatus").innerText(), /changed/);
    await s.p.locator("#closeReview").click();
    assert.equal(await s.p.locator("#reloadBtn").isVisible(), true);
    assert.equal(await s.p.locator("#checkLiveBtn").isVisible(), false);
    const d = (await db(s.p)).find((d) => d.title === "Fixture");
    assert.equal(d.attempt.state, "attention");
    assert(!d.attempt.acceptedAt);
    assert.equal(d.markdown, "A complete article.");
    await s.close();
  });
  await test("metadata-only large asset response reconciles and publishes assets first", async () => {
    const s = await setup({
      model: { drop: (file) => file.startsWith("blog/assets/") },
    });
    await source(s.p, "Large photo", "Photo story.");
    await toggle(s.p);
    const large = Buffer.concat([png, Buffer.alloc(1100000)]);
    await s.p
      .locator("#photoFile")
      .setInputFiles({
        name: "large.png",
        mimeType: "image/png",
        buffer: large,
      });
    await s.p.locator("img.bn-visual-media").waitFor();
    await saved(s.p);
    await signin(s.p);
    await publish(s.p);
    assert.equal(s.model.writes.length, 2);
    assert(s.model.writes[0].file.startsWith("blog/assets/"));
    assert(s.model.writes[1].file.startsWith("blog/posts/"));
    assert((await db(s.p)).some((d) => d.attempt?.acceptedAt));
    await s.close();
  });
  await test("migration retains original storage, archive/undo, accessible mobile controls", async () => {
    const legacy = {
      id: "legacy",
      title: "Legacy draft",
      dek: "Summary",
      date: "2026-10-12",
      markdown: "Legacy body.",
      sourceMode: true,
    };
    const s = await setup({
      context: { ...devices["iPhone 13"] },
      before: async (c) =>
        c.addInitScript((value) => {
          if (!localStorage.getItem("seeded")) {
            localStorage.setItem(
              "bn.drafts.v1",
              JSON.stringify({ legacy: value }),
            );
            localStorage.setItem("bn.activeDraft", "legacy");
            localStorage.setItem("seeded", "1");
          }
        }, legacy),
    });
    assert.equal(await s.p.locator("#title").inputValue(), "Legacy draft");
    assert(await s.p.evaluate(() => localStorage.getItem("bn.drafts.v1")));
    await s.p.locator("#draftsBtn").click();
    await s.p
      .getByRole("button", { name: "Archive Legacy draft", exact: true })
      .click();
    await s.p.locator("#undoArchive").click();
    assert.equal(
      (await db(s.p)).find((d) => d.id === "legacy").archived,
      false,
    );
    await toggle(s.p);
    for (const width of [320, 375, 414, 768]) {
      await s.p.setViewportSize({ width, height: 812 });
      await s.p.evaluate(() => scrollTo(0, 0));
      assert.equal(
        await s.p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      const height = await s.p
        .locator(".bar")
        .evaluate((e) => e.getBoundingClientRect().height);
      assert(height < 110, `Header ${width}: ${height}`);
      await s.p.screenshot({ path: path.join(out, `mobile-${width}.png`) });
    }
    await s.p.setViewportSize({ width: 320, height: 480 });
    await s.p
      .getByRole("textbox", { name: "Article body", exact: true })
      .click();
    await s.p.keyboard.press("Meta+a");
    await s.p.waitForTimeout(200);
    assert.equal(
      await s.p.getByRole("button", { name: "Underline", exact: true }).count(),
      0,
    );
    assert.equal(
      await s.p.getByRole("button", { name: "Colors", exact: true }).count(),
      0,
    );
    await s.p.screenshot({ path: path.join(out, "mobile-keyboard-space.png") });
    await s.close();
  });

  await test("all three published Vol.2 tables remain editable and retain alignment", async () => {
    const s = await setup(),
      full = await fs.readFile(
        path.join(
          root,
          "blog/posts/2026-10-11-power-foam-paddle-buying-guide-vol-2.md",
        ),
        "utf8",
      );
    await s.p
      .locator("#importFile")
      .setInputFiles({
        name: "2026-10-11-vol2.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(full),
      });
    await s.p.waitForFunction(
      () =>
        !document.querySelector("#importFile").value &&
        document.querySelector("#editor table"),
    );
    assert.equal(await s.p.locator("#editor table").count(), 3);
    assert.equal((await download(s.p)).toString(), full);
    const cell = s.p.locator("#editor table").first().locator("td p").first();
    await cell.fill("Edited comparison row");
    await saved(s.p);
    await toggle(s.p);
    const md = await s.p.locator("#markdownSource").inputValue();
    assert.match(md, /---:/);
    assert.match(md, /Edited comparison row/);
    await toggle(s.p);
    assert.equal(await s.p.locator("#editor table").count(), 3);
    await s.p.reload();
    await ready(s.p);
    assert.equal(await s.p.locator("#editor table").count(), 3);
    await s.close();
  });
  await test("failed save retains latest in-memory download and original source recovery", async () => {
    const s = await setup();
    const original = post("Original source.\n");
    await imported(s.p, original);
    await s.p
      .locator("[data-content-type=paragraph] p")
      .first()
      .fill("An actual edit.");
    await saved(s.p);
    assert(
      (await db(s.p)).some(
        (d) => d.pristine && d.originalSource === original && d.recoveryLabel,
      ),
    );
    await s.p.evaluate(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (v, ...args) {
        if (this.name === "drafts")
          throw new DOMException("Full", "QuotaExceededError");
        return put.call(this, v, ...args);
      };
    });
    await s.p
      .locator("[data-content-type=paragraph] p")
      .first()
      .fill("Latest unsaved work.");
    await s.p.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("Couldn’t save"),
    );
    assert.match((await download(s.p)).toString(), /Latest unsaved work/);
    assert(
      !(await db(s.p)).some((d) => d.markdown?.includes("Latest unsaved work")),
    );
    await s.close();
  });
  await test("uncertain publication survives reload and idempotent retry", async () => {
    const s = await setup({
      model: { drop: () => true },
      custom: async (r, m, json) => {
        if (
          m.failReads &&
          m.writes.length &&
          r.request().method() === "GET" &&
          r.request().url().includes("/contents/blog/posts/")
        ) {
          await json({ message: "Temporary outage" }, 503);
          return true;
        }
      },
    });
    await source(s.p, "Uncertain article", "Keep this exact story.");
    await signin(s.p);
    s.model.failReads = true;
    await publish(s.p);
    let d = (await db(s.p)).find((d) => d.title === "Uncertain article");
    assert.equal(d.attempt.state, "attention");
    assert(!d.attempt.acceptedAt);
    assert.equal(s.model.writes.length, 1);
    await s.p.reload();
    await ready(s.p);
    assert.equal(await s.p.locator("#checkLiveBtn").isVisible(), false);
    assert.equal(await s.p.locator("#reloadBtn").isVisible(), true);
    s.model.failReads = false;
    await publish(s.p);
    assert.equal(s.model.writes.length, 1);
    d = (await db(s.p)).find((d) => d.title === "Uncertain article");
    assert(d.attempt.acceptedAt);
    await s.close();
  });
  await test("published photo backup imports as a new identity and can republish", async () => {
    const s = await setup();
    await source(s.p, "Original photo post", "A photo.");
    await toggle(s.p);
    await s.p
      .locator("#photoFile")
      .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
    await s.p.locator("img.bn-visual-media").waitFor();
    await saved(s.p);
    await signin(s.p);
    await publish(s.p);
    await s.p.locator("#closeReview").click();
    const archive = await download(s.p);
    await s.p
      .locator("#importFile")
      .setInputFiles({
        name: "backup.zip",
        mimeType: "application/zip",
        buffer: archive,
      });
    await s.p.waitForFunction(
      () => !document.querySelector("#importFile").value,
    );
    await s.p.locator("#title").fill("Restored photo post");
    await saved(s.p);
    const imported = (await db(s.p)).find(
      (d) => d.title === "Restored photo post",
    );
    assert.equal(imported.sha, null);
    assert.equal(imported.path, null);
    await publish(s.p);
    assert.equal(
      s.model.writes.filter((w) => w.file.startsWith("blog/assets/")).length,
      1,
    );
    assert.equal(
      s.model.writes.filter((w) => w.file.startsWith("blog/posts/")).length,
      2,
    );
    await s.close();
  });
  await test("paste and drop photos are local; invalid files explain the problem", async () => {
    const s = await setup();
    await s.p.locator("#title").fill("Pasted photos");
    await s.p
      .getByRole("textbox", { name: "Article body", exact: true })
      .click();
    await s.p.locator("[contenteditable=true]").evaluate(
      (el, data) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([Uint8Array.from(data)], "pasted.png", {
            type: "image/png",
          }),
        );
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: transfer,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [...png],
    );
    await s.p.locator("img.bn-visual-media").waitFor();
    await saved(s.p);
    assert.equal(s.model.writes.length, 0);
    await s.p.locator("[contenteditable=true]").evaluate(
      (el, data) => {
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([Uint8Array.from(data)], "dropped.png", {
            type: "image/png",
          }),
        );
        el.dispatchEvent(
          new DragEvent("drop", {
            dataTransfer: transfer,
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 300,
          }),
        );
      },
      [...png],
    );
    await s.p.waitForFunction(
      () => document.querySelectorAll("img.bn-visual-media").length === 2,
    );
    await saved(s.p);
    assert.equal(s.model.writes.length, 0);
    await s.p
      .locator("#photoFile")
      .setInputFiles({
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("not an image"),
      });
    await s.p.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("not a supported photo"),
    );
    await s.close();
  });

  await test("original blocks-only legacy drafts preserve body and unsupported-style backup", async () => {
    const old = {
      title: "Original old editor",
      dek: "Summary",
      date: "2026-10-12",
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Body from the original editor.",
              styles: { underline: true },
            },
          ],
        },
      ],
    };
    const s = await setup({
      before: async (c) =>
        c.addInitScript((value) => {
          if (!localStorage.getItem("seeded")) {
            localStorage.setItem("bn.draft", JSON.stringify(value));
            localStorage.setItem("seeded", "1");
          }
        }, old),
    });
    assert.match(
      await s.p.locator("#editor").innerText(),
      /Body from the original editor/,
    );
    assert.match(await s.p.locator("#sourceNotice").innerText(), /older draft/);
    const zip = unzipSync(await download(s.p));
    assert.match(strFromU8(zip["article.md"]), /Body from the original editor/);
    assert(
      JSON.parse(strFromU8(zip["draft.json"])).legacyBlocks[0].content[0].styles
        .underline,
    );
    assert(await s.p.evaluate(() => localStorage.getItem("bn.draft")));
    await s.close();
  });

  await test("import disables composing before file reading and restores controls", async () => {
    const s = await setup();
    await source(s.p, "Previous draft", "Previous body.");
    await s.p.evaluate(() => {
      const read = File.prototype.text;
      File.prototype.text = function () {
        return new Promise((resolve) => {
          window.finishImport = () => read.call(this).then(resolve);
        });
      };
    });
    await s.p
      .locator("#importFile")
      .setInputFiles({
        name: "2026-10-12-imported.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(post("Imported body.")),
      });
    await s.p.waitForFunction(() => typeof window.finishImport === "function");
    assert.equal(await s.p.locator("#title").isDisabled(), true);
    await s.p.keyboard.type("Must not be lost");
    await s.p.evaluate(() => window.finishImport());
    await s.p.waitForFunction(() => !document.querySelector("#app").disabled);
    assert.equal(await s.p.locator("#title").inputValue(), "Imported");
    assert(
      (await db(s.p)).some(
        (d) => d.title === "Previous draft" && d.markdown === "Previous body.",
      ),
    );
    await s.close();
  });
  await test("action menus dismiss after selection, outside clicks, and Escape", async () => {
    const s = await setup();
    await menu(s.p);
    await s.p.locator("#connectBtn").click();
    assert.equal(await s.p.locator("#moreMenu").getAttribute("open"), null);
    await menu(s.p);
    await s.p.locator("#title").click();
    assert.equal(await s.p.locator("#moreMenu").getAttribute("open"), null);
    await s.p.locator("#insertMenu > summary").click();
    await s.p.keyboard.press("Escape");
    assert.equal(await s.p.locator("#insertMenu").getAttribute("open"), null);
    assert.equal(await s.p.locator("#insertMenu > summary").evaluate(el => el === document.activeElement), true);
    await s.close();
  });
  await browser.close();
  await new Promise((r) => server.close(r));
  console.log(
    `${failures.length ? "FAIL" : "PASS"}: ${total - failures.length}/${total} browser regressions`,
  );
  if (failures.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error(e);
  await browser?.close();
  server?.close();
  process.exitCode = 1;
});
