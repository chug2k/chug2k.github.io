const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pathToFileURL } = require("node:url");

module.exports = async function verifyLesson({ root, base, model, context }) {
  const { lessonSlug, lessonPath, templateUrl, renderLesson } =
    await import(pathToFileURL(path.join(root, "assets/lesson-copy.mjs")));
  const original = await fs.readFile(path.join(root, lessonPath), "utf8");
  const template = await fs.readFile(path.join(root, templateUrl.slice(1)), "utf8");
  const publicPath = "/blog/" + lessonSlug + "/";
  const direct = base + "/admin/?edit=what-is-an-agent";
  const draftStore = model();
  const live = { source: original, writes: 0 };
  const blob = () => createHash("sha1").update("blob " + Buffer.byteLength(live.source) + "\0" + live.source).digest("hex");
  const sentence = "The ferry starts its shift when the tide changes.";
  const nextSentence = "A dispatcher decides which pier needs a boat.";
  const contexts = [];
  async function device(options) {
    const c = await context(draftStore, options);
    contexts.push(c);
    await c.route("https://fonts.**/*", (r) => r.abort());
    await c.route("**/admin/api/github/**", async (route) => {
      const req = route.request(), u = new URL(req.url());
      const reply = (body, status = 200) => route.fulfill({ json: body, status });
      if (u.pathname.endsWith("/validate")) return reply({ login: "fixture" });
      if (u.pathname.endsWith("/list")) return reply([{ path: lessonPath, name: path.basename(lessonPath) }]);
      if (u.pathname.endsWith("/read")) {
        assert.equal(u.searchParams.get("path"), lessonPath);
        return reply({ sha: blob(), content: Buffer.from(live.source).toString("base64") });
      }
      const b = req.postDataJSON();
      assert.equal(b.path, lessonPath);
      if (b.sha !== blob()) return reply({ error: "The source changed. Load latest.", conflict: true }, 409);
      live.source = Buffer.from(b.content, "base64").toString();
      live.writes++;
      return reply({ sha: blob() });
    });
    await c.route(base + publicPath + "**", async (route) => {
      const body = live.source.split(/\n---\n/).slice(1).join("\n---\n").trimStart();
      return route.fulfill({ contentType: "text/html", body: await renderLesson(template, {
        title: "What is an agent?", description: "Fixture", body,
        source_sha256: createHash("sha256").update(live.source).digest("hex"),
      }) });
    });
    return c;
  }
  const canvas = (p) => p.frameLocator("#lessonFrame");
  const lead = (p) => canvas(p).locator('[data-passage="standfirst"]');
  const saved = (p) => p.waitForFunction(() => document.querySelector("#status")?.textContent === "Saved to cloud");
  try {
    const desktop = await device({ viewport: { width: 1280, height: 850 } });
    const p = await desktop.newPage();
    p.on("dialog", (d) => d.accept());
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto(direct);
    await lead(p).waitFor({ state: "visible" });
    const reader = await desktop.newPage();
    await reader.goto(base + publicPath);
    assert.equal(await lead(p).innerText(), await reader.locator(".standfirst").innerText());
    await reader.close();
    assert.equal(await p.locator("#markdownSource").isVisible(), false);
    assert.equal(await p.locator("#editor").isVisible(), false);
    assert.equal(await canvas(p).locator("[contenteditable=true]").count(), 187);
    if (process.env.LESSON_SCREENSHOTS) await p.screenshot({ path: path.join(process.env.LESSON_SCREENSHOTS, "desktop.png") });
    await lead(p).fill(sentence);
    await p.reload({ waitUntil: "domcontentloaded" }); // before the one-second network debounce
    await lead(p).waitFor({ state: "visible" });
    assert.equal(await lead(p).innerText(), sentence);
    await saved(p);
    await lead(p).evaluate((el) => {
      el.focus();
      const range = el.ownerDocument.createRange();
      range.setStart(el.firstChild, 4);
      range.setEnd(el.firstChild, 9);
      const selection = el.ownerDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await p.getByRole("button", { name: "Bold", exact: true }).click();
    await saved(p);
    assert.equal(live.source, original);

    const phone = await device({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const q = await phone.newPage();
    await q.goto(direct);
    await lead(q).waitFor({ state: "visible" });
    assert.equal(await lead(q).innerText(), sentence);
    assert.equal(await lead(q).locator("strong,b").innerText(), "ferry");
    assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.env.LESSON_SCREENSHOTS) await q.screenshot({ path: path.join(process.env.LESSON_SCREENSHOTS, "phone.png") });
    await q.locator("#lessonSection").selectOption("1");
    const passage = canvas(q).locator('[data-passage="judgment-03"]');
    await passage.fill(nextSentence);
    await passage.press("End");
    await passage.press("Enter");
    await q.keyboard.insertText("A second paragraph belongs here.");
    await saved(q);
    await q.getByRole("button", { name: "Preview", exact: true }).click();
    const preview = q.frameLocator("#previewFrame");
    assert.equal(await preview.locator(".standfirst").innerText(), sentence);
    await preview.getByText("A second paragraph belongs here.", { exact: true }).waitFor();
    await preview.getByRole("button", { name: /Advance 1 day/i }).first().click();
    await preview.locator("#toy-swept").filter({ hasText: /^40$/ }).waitFor({ timeout: 12000 });
    assert.equal(live.writes, 0);
    await q.getByRole("button", { name: "Back to writing" }).click();
    await lead(q).fill(sentence + " Twice.");
    await saved(q);
    await q.getByRole("button", { name: "Preview", exact: true }).click();
    await q.getByRole("button", { name: "Publish changes" }).click();
    await q.waitForFunction(() => document.querySelector("#reviewStatus")?.textContent.includes("exact revision is published"), undefined, { timeout: 20000 });
    assert.equal(live.writes, 1);
    const published = await phone.newPage();
    await published.goto(base + publicPath);
    assert.equal(await published.locator(".standfirst").innerText(), sentence + " Twice.");
    assert.equal(await published.locator("[contenteditable=true]").count(), 0);
    assert.equal(await published.locator("section.reveal").count(), 13);
    assert.equal(await published.locator("p").filter({ hasText: "A second paragraph belongs here." }).count(), 1);
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
};
