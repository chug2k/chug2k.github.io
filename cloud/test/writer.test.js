import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject, reset } from "cloudflare:test";
import { beforeAll, beforeEach, afterEach, expect, test, vi } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { gitBlobSha } from "../../admin/src/github.js";
import worker from "../src/index.js";

let keys, jwk, fetchMock;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
});
beforeEach(async () => {
  await reset();
  fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).endsWith("/cdn-cgi/access/certs"))
      return Response.json({ keys: [jwk] });
    throw new Error("Unexpected network access in test");
  });
});
afterEach(() => vi.restoreAllMocks());
const token = (overrides = {}) =>
  new SignJWT({ email: "cl@clpanic.com", ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(env.ACCESS_ISSUER)
    .setAudience(env.ACCESS_AUD)
    .setSubject("author")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(keys.privateKey);
async function request(
  path,
  { method = "GET", body, jwt, headers = {}, raw, bindings = env } = {},
) {
  const r = new Request(`https://clpanic.com/admin/api/${path}`, {
    method,
    headers: {
      "Cf-Access-Jwt-Assertion": jwt === null ? "" : jwt || (await token()),
      Origin: "https://clpanic.com",
      "X-Writer-Request": "1",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(method === "GET" ? {} : { body: raw || JSON.stringify(body) }),
  });
  return worker.fetch(r, bindings);
}
const draft = (id = crypto.randomUUID(), title = "Hello") => ({
  id,
  title,
  markdown: "My draft",
  assetIds: [],
});
const save = (value, baseRevision = 0, mutationId = crypto.randomUUID()) =>
  request("drafts", {
    method: "POST",
    body: { draft: value, baseRevision, mutationId },
  });

test("requires a valid Access signature and the one allowed email", async () => {
  expect((await request("session", { jwt: null })).status).toBe(401);
  expect((await request("session", { jwt: "forged" })).status).toBe(401);
  expect(
    (
      await request("session", {
        jwt: await token({ email: "someone@example.com" }),
      })
    ).status,
  ).toBe(403);
  const result = await request("session");
  expect(result.status).toBe(200);
  expect((await result.json()).user.email).toBe("cl@clpanic.com");
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(
    (
      await request("session", {
        bindings: { ...env, ACCESS_AUD: "other-app" },
      })
    ).status,
  ).toBe(401);
  expect(
    (await request("session", { bindings: { ...env, ACCESS_ISSUER: "" } }))
      .status,
  ).toBe(503);
});
test("rejects cross-site and oversized writes before touching storage", async () => {
  const body = {
    draft: draft(),
    baseRevision: 0,
    mutationId: crypto.randomUUID(),
  };
  expect(
    (
      await request("drafts", {
        method: "POST",
        body,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request("drafts", {
        method: "POST",
        body,
        headers: { "X-Writer-Request": "" },
      })
    ).status,
  ).toBe(403);
  expect(
    (await save({ ...draft(), markdown: "x".repeat(1024 * 1024) })).status,
  ).toBe(413);
  expect(await (await request("drafts")).json()).toEqual([]);
});
test("concurrent stale saves preserve both devices and exact retries do not fork again", async () => {
  const value = draft();
  const first = await (await save(value)).json();
  const [a, b] = await Promise.all([
    save({ ...first.draft, title: "Device A" }, 1),
    save({ ...first.draft, title: "Device B" }, 1),
  ]);
  const values = await Promise.all([a.json(), b.json()]);
  expect(values.filter((v) => v.conflict)).toHaveLength(1);
  const all = await (await request("drafts")).json();
  expect(all.map((v) => v.title).sort()).toEqual(["Device A", "Device B"]);
  const mutation = crypto.randomUUID();
  const lost = await (
    await save({ ...first.draft, title: "Uncertain" }, 1, mutation)
  ).json();
  const retry = await (
    await save({ ...first.draft, title: "Uncertain" }, 1, mutation)
  ).json();
  expect(retry).toEqual(lost);
  expect(
    (await save({ ...first.draft, title: "Changed" }, 1, mutation)).status,
  ).toBe(409);
  expect(await (await request("drafts")).json()).toHaveLength(3);
});
test("drafts, historical revisions and replay receipts survive object eviction", async () => {
  const stub = env.LIBRARIES.getByName(env.ALLOWED_EMAIL);
  const value = draft(),
    mutation = crypto.randomUUID();
  const first = await (await save(value, 0, mutation)).json();
  await save({ ...first.draft, title: "Next revision" }, 1);
  await evictDurableObject(stub);
  expect((await stub.get(value.id)).revision).toBe(2);
  expect(await (await save(value, 0, mutation)).json()).toEqual(first);
  const history = await runInDurableObject(
    stub,
    (_, state) =>
      state.storage.sql.exec("SELECT COUNT(*) AS count FROM revisions").one()
        .count,
  );
  expect(history).toBe(2);
  expect(await env.LIBRARIES.getByName("another-library").list()).toEqual([]);
});
test("old exact retries still reconcile after bounded revision history is pruned", async () => {
  const value = draft(),
    mutationId = crypto.randomUUID();
  const first = await (await save(value, 0, mutationId)).json();
  const library = env.LIBRARIES.getByName(env.ALLOWED_EMAIL);
  for (let revision = 1; revision <= 101; revision++) {
    const id = crypto.randomUUID();
    await library.save({
      draft: { ...value, title: `Revision ${revision + 1}` },
      baseRevision: revision,
      mutationId: id,
      fingerprint: id,
    });
  }
  const history = await runInDurableObject(
    library,
    (_, state) =>
      state.storage.sql.exec("SELECT COUNT(*) AS count FROM revisions").one()
        .count,
  );
  expect(history).toBe(100);
  expect(await (await save(value, 0, mutationId)).json()).toEqual(first);
  expect((await library.get(value.id)).revision).toBe(102);
});
test("photos are private, durable, immutable and required before draft acknowledgement", async () => {
  const id = crypto.randomUUID(),
    value = { ...draft(), assetIds: [id] };
  expect((await save(value)).status).toBe(409);
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  const headers = {
    "Content-Type": "image/png",
    "X-Asset-Path": `blog/assets/${value.id}/photo.png`,
  };
  expect(
    (await request(`assets/${id}`, { method: "PUT", headers, raw: bytes }))
      .status,
  ).toBe(200);
  expect(
    (await request(`assets/${id}`, { method: "PUT", headers, raw: bytes }))
      .status,
  ).toBe(200);
  const restoredId = crypto.randomUUID();
  expect(
    (
      await request(`assets/${restoredId}`, {
        method: "PUT",
        headers,
        raw: bytes,
      })
    ).status,
  ).toBe(200);
  expect((await save({ ...draft(), assetIds: [restoredId] })).status).toBe(200);
  expect(
    (
      await request(`assets/${id}`, {
        method: "PUT",
        headers,
        raw: new Uint8Array([...bytes, 4]),
      })
    ).status,
  ).toBe(409);
  expect((await save(value)).status).toBe(200);
  expect((await request(`assets/${id}`, { jwt: null })).status).toBe(401);
  const result = await request(`assets/${id}`);
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes);
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(
    (
      await request(`assets/${crypto.randomUUID()}`, {
        method: "PUT",
        headers,
        raw: "<svg></svg>",
      })
    ).status,
  ).toBe(415);
});
test("server publishing is constrained to this blog and never exposes its credential", async () => {
  expect(
    (
      await request("github/write", {
        method: "POST",
        body: { path: ".github/workflows/evil.yml", content: "YWJj" },
      })
    ).status,
  ).toBe(403);
  expect((await request("github/read?path=README.md")).status).toBe(403);
  const session = await (await request("session")).text();
  expect(session).not.toContain(env.GITHUB_TOKEN);
  expect(
    (await request("github/list", { bindings: { ...env, GITHUB_TOKEN: "" } }))
      .status,
  ).toBe(503);
});
test("expired JWTs and signatures from another key cannot access drafts", async () => {
  const expired = await new SignJWT({ email: env.ALLOWED_EMAIL })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(env.ACCESS_ISSUER)
    .setAudience(env.ACCESS_AUD)
    .setSubject("author")
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(keys.privateKey);
  expect((await request("drafts", { jwt: expired })).status).toBe(401);
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({ email: env.ALLOWED_EMAIL })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(env.ACCESS_ISSUER)
    .setAudience(env.ACCESS_AUD)
    .setSubject("author")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(other.privateKey);
  expect((await request("drafts", { jwt: forged })).status).toBe(401);
});
test("publication reconciles an accepted GitHub write with a lost response", async () => {
  const path = "blog/posts/2026-11-06-fixture.md",
    content = btoa("A complete article"),
    sha = await gitBlobSha(new TextEncoder().encode("A complete article"));
  let remote = null,
    writes = 0;
  fetchMock.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/cdn-cgi/access/certs"))
      return Response.json({ keys: [jwk] });
    const suffix = options.method === "PUT" ? "" : "?ref=main";
    expect(String(url)).toBe(
      `https://api.github.com/repos/chug2k/chug2k.github.io/contents/${path}${suffix}`,
    );
    expect(options.headers.Authorization).toBe("Bearer mock-github-token");
    expect(options.headers["User-Agent"]).toBe("clpanic-writing-room");
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      expect(body.branch).toBe("main");
      remote = { content: body.content, sha };
      writes++;
      throw new Error("Response lost after accepted commit");
    }
    return remote ? Response.json(remote) : new Response(null, { status: 404 });
  });
  const r = await request("github/write", {
    method: "POST",
    body: { path, content },
  });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ sha, reconciled: true });
  expect(
    (await request("github/write", { method: "POST", body: { path, content } }))
      .status,
  ).toBe(200);
  expect(writes).toBe(1);
});
