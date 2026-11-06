// Browser storage uses real IndexedDB/Web Locks. The remote HTTP service is
// mocked here; cloud/test exercises the actual Worker/SQLite/R2 implementation.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");
const { unzipSync, strFromU8 } = require("fflate");
const root = path.resolve(__dirname, "../..");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);
let browser, server, base;
function model() {
  return {
    drafts: new Map(),
    receipts: new Map(),
    assets: new Map(),
    saves: 0,
    offline: false,
    drop: false,
    denied: false,
  };
}
async function context(m) {
  const c = await browser.newContext();
  await c.route("**/admin/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname.slice("/admin/api/".length);
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (m.offline) return route.abort("failed");
    if (m.denied) return json({ error: "Expired session" }, 401);
    if (p === "session")
      return json({
        user: { email: "cl@clpanic.com", name: "Charles" },
        config: {
          owner: "chug2k",
          repo: "chug2k.github.io",
          branch: "main",
          siteUrl: base,
        },
        publishing: true,
      });
    if (p === "github/list") return json([]);
    if (p === "drafts" && req.method() === "GET")
      return json([...m.drafts.values()]);
    if (p.startsWith("drafts/")) return json(m.drafts.get(p.slice(7)) || null);
    if (p === "drafts" && req.method() === "POST") {
      const b = req.postDataJSON(),
        fingerprint = JSON.stringify(b);
      let result;
      if (m.receipts.has(b.mutationId)) {
        const previous = m.receipts.get(b.mutationId);
        if (previous.fingerprint !== fingerprint)
          return json({ error: "Mutation changed" }, 409);
        result = previous.result;
      } else {
        if (b.draft.assetIds.some((id) => !m.assets.has(id)))
          return json({ error: "Photo missing" }, 409);
        const latest = m.drafts.get(b.draft.id),
          conflict = latest
            ? latest.revision !== b.baseRevision
            : b.baseRevision !== 0;
        const d = {
          ...b.draft,
          revision: conflict ? 1 : (latest?.revision || 0) + 1,
          updatedAt: Date.now(),
        };
        if (conflict)
          Object.assign(d, {
            id: crypto.randomUUID(),
            recoveryOf: b.draft.id,
            recoveryLabel: "Both copies kept",
            archived: false,
          });
        m.drafts.set(d.id, d);
        result = { draft: d, conflict };
        m.receipts.set(b.mutationId, { fingerprint, result });
        m.saves++;
      }
      if (m.drop) {
        m.drop = false;
        return route.abort("failed");
      }
      return json(result);
    }
    if (p.startsWith("assets/")) {
      const id = p.slice(7);
      if (req.method() === "PUT") {
        m.assets.set(id, {
          bytes: req.postDataBuffer(),
          id,
          path: req.headers()["x-asset-path"],
          type: req.headers()["content-type"],
        });
        return json({ uploaded: true });
      }
      const a = m.assets.get(id);
      if (!a) return json({ error: "Missing" }, 404);
      return route.fulfill({
        body: a.bytes,
        headers: {
          "content-type": a.type,
          "x-writer-asset": encodeURIComponent(
            JSON.stringify({ id, path: a.path, type: a.type }),
          ),
        },
      });
    }
    return json({ error: "Unexpected mock path" }, 404);
  });
  return c;
}
async function harness(c) {
  const p = await c.newPage();
  await p.goto(base + "/cloud-test");
  await p.evaluate(async () => {
    const { openStorage } = await import("/admin/src/storage.js");
    const { openCloudStorage, cloudRequest } =
      await import("/admin/src/cloud.js");
    window.local = await openStorage();
    window.cloud = await openCloudStorage(local, await cloudRequest("session"));
    window.value = (id, title = "Fixture") => ({
      id,
      title,
      markdown: "Body",
      assetIds: [],
    });
  });
  return p;
}
async function run(name, fn) {
  try {
    await fn();
    console.log("PASS " + name);
  } catch (error) {
    console.error("FAIL " + name, error);
    process.exitCode = 1;
  }
}
(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://fixture").pathname,
      );
      if (pathname === "/cloud-test") {
        res.setHeader("Content-Type", "text/html");
        return res.end("<!doctype html><title>Cloud storage tests</title>");
      }
      const target = path.resolve(
        root,
        "." + pathname + (pathname.endsWith("/") ? "index.html" : ""),
      );
      if (!target.startsWith(root + path.sep)) throw new Error("Invalid path");
      const types = {
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".html": "text/html",
        ".css": "text/css",
        ".woff2": "font/woff2",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(target)] || "application/octet-stream",
      );
      res.end(await fs.readFile(target));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  await run("drafts and private photos open on a separate device", async () => {
    const m = model(),
      a = await context(m),
      b = await context(m),
      p = await harness(a),
      q = await harness(b);
    await p.evaluate(
      async (bytes) => {
        await cloud.putAsset({
          id: "photo",
          path: "blog/assets/post/photo.png",
          type: "image/png",
          blob: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        });
        await cloud.save({ ...value("post"), assetIds: ["photo"] }, 0);
      },
      [...png],
    );
    assert.equal((await q.evaluate(() => cloud.list()))[0].title, "Fixture");
    assert.deepEqual(
      await q.evaluate(async () => [
        ...new Uint8Array(
          await (await cloud.getAsset("photo")).blob.arrayBuffer(),
        ),
      ]),
      [...png],
    );
    await q.evaluate(async () => {
      const d = await cloud.get("post");
      d.title = "Device B";
      await cloud.save(d, d.revision);
    });
    assert.equal(m.drafts.get("post").title, "Device B");
    await a.close();
    await b.close();
  });
  await run("two devices preserve conflicting edits", async () => {
    const m = model(),
      a = await context(m),
      b = await context(m),
      p = await harness(a),
      q = await harness(b);
    const d = await p.evaluate(
      async () => (await cloud.save(value("same"), 0)).draft,
    );
    await p.evaluate(() => localStorage.setItem("bn.activeDraft", "same"));
    await q.evaluate(() => localStorage.setItem("bn.activeDraft", "same"));
    const results = await Promise.all([
      p.evaluate((d) => cloud.save({ ...d, title: "A" }, d.revision), d),
      q.evaluate((d) => cloud.save({ ...d, title: "B" }, d.revision), d),
    ]);
    assert.deepEqual([...m.drafts.values()].map((d) => d.title).sort(), [
      "A",
      "B",
    ]);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("bn.activeDraft")),
      results[0].draft.id,
    );
    assert.equal(
      await q.evaluate(() => localStorage.getItem("bn.activeDraft")),
      results[1].draft.id,
    );
    await a.close();
    await b.close();
  });
  await run(
    "lost response plus newer text recovers after reload without duplicate drafts",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      const d = await p.evaluate(
        async () => (await cloud.save(value("retry"), 0)).draft,
      );
      m.drop = true;
      await assert.rejects(
        p.evaluate(
          (d) =>
            cloud.save(
              { ...d, title: "Accepted but response lost" },
              d.revision,
            ),
          d,
        ),
      );
      m.offline = true;
      await assert.rejects(
        p.evaluate(
          (d) => cloud.save({ ...d, title: "Newest offline text" }, d.revision),
          d,
        ),
      );
      m.offline = false;
      await p.close();
      const q = await harness(c);
      await q.evaluate(() => cloud.recover());
      assert.equal(m.drafts.size, 1);
      assert.equal(m.drafts.get("retry").title, "Newest offline text");
      assert.equal(m.drafts.get("retry").revision, 3);
      await q.evaluate(() => cloud.recover());
      assert.equal(m.saves, 3);
      await c.close();
    },
  );
  await run(
    "legacy migration keeps originals and uploads once across reloads",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      await p.evaluate(async () => {
        localStorage.setItem(
          "bn.drafts.v1",
          JSON.stringify({ old: { title: "Old draft", markdown: "Original" } }),
        );
        await cloud.migrate((k) => localStorage.getItem(k));
        await cloud.migrate((k) => localStorage.getItem(k));
      });
      assert.equal(m.drafts.size, 1);
      assert.equal(m.saves, 1);
      assert.equal(
        await p.evaluate(async () => (await local.list())[0].title),
        "Old draft",
      );
      await c.close();
    },
  );
  await run(
    "simultaneous tabs recover one pending request exactly once",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      m.drop = true;
      await assert.rejects(p.evaluate(() => cloud.save(value("once"), 0)));
      const q = await harness(c);
      await Promise.all([
        p.evaluate(() => cloud.recover()),
        q.evaluate(() => cloud.recover()),
      ]);
      assert.equal(m.saves, 1);
      assert.equal(m.drafts.size, 1);
      assert.equal(
        await p.evaluate(
          async () =>
            (await local.metaList("cloud:cl@clpanic.com:pending:")).length,
        ),
        0,
      );
      await c.close();
    },
  );
  await run("expired login keeps unsynced text for recovery", async () => {
    const m = model(),
      c = await context(m),
      p = await harness(c);
    m.denied = true;
    await assert.rejects(
      p.evaluate(() => cloud.save(value("expired", "Do not lose this"), 0)),
      /Sign in again/,
    );
    assert.equal(
      await p.evaluate(
        async () =>
          (await local.metaList("cloud:cl@clpanic.com:pending:"))[0].working
            .title,
      ),
      "Do not lose this",
    );
    m.denied = false;
    await p.evaluate(() => cloud.recover());
    assert.equal(m.drafts.get("expired").title, "Do not lose this");
    await c.close();
  });
  await run(
    "an offline photo does not prevent durable recovery of the latest article text",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      m.offline = true;
      await p.evaluate(
        async (bytes) => {
          await cloud.putAsset({
            id: "offline-photo",
            path: "blog/assets/offline/photo.png",
            type: "image/png",
            blob: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          });
        },
        [...png],
      );
      await assert.rejects(
        p.evaluate(() =>
          cloud.save(
            {
              ...value("offline", "Text written with a photo offline"),
              assetIds: ["offline-photo"],
            },
            0,
          ),
        ),
      );
      m.offline = false;
      await p.close();
      const q = await harness(c);
      await q.evaluate(() => cloud.recover());
      assert.equal(
        m.drafts.get("offline").title,
        "Text written with a photo offline",
      );
      assert.deepEqual(m.assets.get("offline-photo").bytes, png);
      await c.close();
    },
  );
  await run(
    "latest article is journaled before a prerequisite cloud write can fail",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      const d = await p.evaluate(
        async () => (await cloud.save(value("original"), 0)).draft,
      );
      m.offline = true;
      await p.evaluate(async (d) => {
        await cloud.stage(
          { ...d, title: "Latest before source backup" },
          d.revision,
        );
        try {
          await cloud.copy(d, "Original source");
        } catch {}
      }, d);
      await p.close();
      m.offline = false;
      const q = await harness(c);
      await q.evaluate(() => cloud.recover());
      assert.equal(
        m.drafts.get("original").title,
        "Latest before source backup",
      );
      assert.equal(m.drafts.size, 2);
      await c.close();
    },
  );
  await run(
    "a failed sign-in still lets the author export unsynced writing and photos",
    async () => {
      const m = model(),
        c = await context(m),
        p = await harness(c);
      m.offline = true;
      await p.evaluate(
        async (bytes) => {
          await cloud.putAsset({
            id: "rescue-photo",
            path: "blog/assets/rescue/photo.png",
            type: "image/png",
            blob: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
          });
        },
        [...png],
      );
      await assert.rejects(
        p.evaluate(() =>
          cloud.save(
            {
              ...value("rescue", "Recover my latest writing"),
              assetIds: ["rescue-photo"],
            },
            0,
          ),
        ),
      );
      await p.close();
      m.offline = false;
      m.denied = true;
      const q = await c.newPage();
      await q.goto(base + "/admin/");
      const button = q.locator("#bootRecovery button");
      await button.waitFor({ state: "visible" });
      const download = q.waitForEvent("download");
      await button.click();
      const files = unzipSync(await fs.readFile(await (await download).path()));
      assert.equal(
        JSON.parse(strFromU8(files["draft.json"])).title,
        "Recover my latest writing",
      );
      assert.deepEqual(Buffer.from(files["blog/assets/rescue/photo.png"]), png);
      assert.equal(await q.locator("#title").isDisabled(), true);
      await c.close();
    },
  );
  await run(
    "the real editor saves to cloud and opens on another device without a PAT",
    async () => {
      const m = model(),
        c = await context(m),
        p = await c.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "/admin/");
      await p.waitForFunction(() => window.writerBoot?.ready);
      await p.locator("#title").fill("A cloud article");
      await p.waitForFunction(
        () =>
          document.querySelector("#status").textContent === "Saved to cloud",
      );
      const second = await context(m),
        q = await second.newPage();
      await q.goto(base + "/admin/");
      await q.waitForFunction(() => window.writerBoot?.ready);
      assert.equal(await q.locator("#title").inputValue(), "A cloud article");
      assert.equal(
        await q.evaluate(() => localStorage.getItem("bn.token")),
        null,
      );
      assert.deepEqual(errors, []);
      await c.close();
      await second.close();
    },
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await new Promise((resolve) =>
      server ? server.close(resolve) : resolve(),
    );
  });
