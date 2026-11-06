import { authenticate } from "./auth.js";
import { github, digest, decode64 } from "../../admin/src/github.js";
export { WriterLibrary } from "./library.js";

const config = Object.freeze({
  owner: "chug2k",
  repo: "chug2k.github.io",
  branch: "main",
  siteUrl: "https://clpanic.com",
});
const identifier = /^[a-zA-Z0-9_-]{1,100}$/;
const postPath = /^blog\/posts\/\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/;
const photoPath =
  /^blog\/assets\/[a-zA-Z0-9_-]{1,100}\/[a-zA-Z0-9_.-]{1,160}\.(?:jpe?g|png|gif|webp)$/i;
const JSON_LIMIT = 1024 * 1024;
const PHOTO_LIMIT = 8 * 1024 * 1024;
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
async function boundedBody(request, limit) {
  if (Number(request.headers.get("content-length")) > limit)
    fail("This file is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      fail("This file is too large.", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function bodyJSON(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail("Send JSON.", 415);
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, JSON_LIMIT)),
    );
  } catch (error) {
    if (error.status) throw error;
    fail("Invalid JSON.");
  }
}
function imageType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "image/png";
  const head = new TextDecoder().decode(bytes.slice(0, 12));
  if (/^GIF8[79]a/.test(head)) return "image/gif";
  if (head.startsWith("RIFF") && head.endsWith("WEBP")) return "image/webp";
  fail("Use a JPEG, PNG, GIF or WebP photo.", 415);
}
function validateDraft(body) {
  if (
    !body ||
    typeof body !== "object" ||
    !body.draft ||
    !identifier.test(body.draft.id || "") ||
    !identifier.test(body.mutationId || "") ||
    !Number.isSafeInteger(body.baseRevision) ||
    body.baseRevision < 0
  )
    fail("Invalid draft save.");
  if (
    !Array.isArray(body.draft.assetIds) ||
    body.draft.assetIds.length > 100 ||
    body.draft.assetIds.some((id) => !identifier.test(id))
  )
    fail("Invalid draft photos.");
  for (const field of ["title", "dek", "markdown"])
    if (
      body.draft[field] !== undefined &&
      typeof body.draft[field] !== "string"
    )
      fail("Invalid article content.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (
        url.origin !== "https://clpanic.com" ||
        !(url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
      )
        return json({ error: "Not found." }, 404);
      const user = await authenticate(request, env);
      if (!url.pathname.startsWith("/admin/api/")) {
        if (!["GET", "HEAD"].includes(request.method))
          return json({ error: "Method not allowed." }, 405);
        // A route subrequest goes to the existing GitHub Pages origin. Never
        // forward the private Access session or cookies to that origin.
        const headers = new Headers(request.headers);
        headers.delete("Cf-Access-Jwt-Assertion");
        headers.delete("Cookie");
        headers.delete("Authorization");
        const upstream = await fetch(
          new Request(request, { headers, redirect: "manual" }),
        );
        const response = new Response(upstream.body, upstream);
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "same-origin");
        return response;
      }
      if (!["GET", "POST", "PUT"].includes(request.method))
        return json({ error: "Method not allowed." }, 405);
      if (
        request.method !== "GET" &&
        (request.headers.get("Origin") !== url.origin ||
          request.headers.get("X-Writer-Request") !== "1")
      )
        return json({ error: "Open the writing room to make changes." }, 403);
      const library = env.LIBRARIES.getByName(user.email);
      const path = url.pathname.slice("/admin/api/".length);
      if (path === "session" && request.method === "GET")
        return json({ user, config, publishing: !!env.GITHUB_TOKEN });
      if (path === "drafts" && request.method === "GET")
        return json(await library.list());
      if (path === "drafts" && request.method === "POST") {
        const body = await bodyJSON(request);
        validateDraft(body);
        // The library checks photo references in the same transaction as the
        // save, avoiding a separate network round trip per image.
        const result = await library.save({
          ...body,
          fingerprint: await digest(JSON.stringify(body)),
        });
        return json(result, result.status || 200);
      }
      if (path.startsWith("drafts/") && request.method === "GET") {
        const id = path.slice(7);
        if (!identifier.test(id)) fail("Invalid draft.");
        const draft = await library.get(id);
        return json(draft, draft ? 200 : 404);
      }
      if (path.startsWith("assets/")) {
        const id = path.slice(7);
        if (!identifier.test(id)) fail("Invalid photo.");
        if (request.method === "GET") {
          const metadata = await library.getAsset(id);
          if (!metadata) return json({ error: "Photo not found." }, 404);
          const object = await env.PHOTOS.get(metadata.key);
          if (!object)
            return json(
              { error: "Photo storage is unavailable. Retry shortly." },
              503,
            );
          const { key, ...publicMetadata } = metadata;
          return new Response(object.body, {
            headers: {
              "Content-Type": metadata.type,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
              "X-Writer-Asset": encodeURIComponent(
                JSON.stringify(publicMetadata),
              ),
            },
          });
        }
        if (request.method === "PUT") {
          const assetPath = request.headers.get("X-Asset-Path");
          if (!photoPath.test(assetPath || "")) fail("Invalid photo path.");
          const bytes = await boundedBody(request, PHOTO_LIMIT);
          const type = imageType(bytes),
            hash = await digest(bytes);
          const previous = await library.getAsset(id);
          if (previous) {
            if (previous.digest !== hash || previous.path !== assetPath)
              fail("Photo identity conflict.", 409);
            return json({ id, uploaded: true });
          }
          const atPath = await library.assetAtPath(assetPath);
          if (atPath) {
            if (atPath.digest !== hash)
              fail(
                "Photo path conflict. The original photo has been kept.",
                409,
              );
            const result = await library.registerAsset({ ...atPath, id });
            return result.error
              ? json(result, result.status)
              : json({ id, uploaded: true });
          }
          const key = `${await digest(user.email)}/${id}/${hash}`;
          await env.PHOTOS.put(key, bytes, {
            httpMetadata: { contentType: type },
          });
          const result = await library.registerAsset({
            id,
            path: assetPath,
            name: assetPath.split("/").pop(),
            type,
            key,
            digest: hash,
            size: bytes.length,
            createdAt: Date.now(),
          });
          return result.error
            ? json(result, result.status)
            : json({ id, uploaded: true });
        }
      }
      if (path.startsWith("github/")) {
        if (!env.GITHUB_TOKEN)
          fail(
            "Publishing is not connected yet. Your drafts are saved in the cloud.",
            503,
          );
        const api = github(
          config,
          env.GITHUB_TOKEN,
          () => {
            fail(
              "The server's GitHub publishing connection expired. Your cloud drafts are safe; renew the publishing token to continue.",
              503,
            );
          },
          { "User-Agent": "clpanic-writing-room" },
        );
        if (path === "github/validate" && request.method === "GET")
          return json({ login: await api.validate() });
        if (path === "github/list" && request.method === "GET")
          return json(await api.list());
        if (path === "github/read" && request.method === "GET") {
          const target = url.searchParams.get("path");
          if (!postPath.test(target || "") && !photoPath.test(target || ""))
            fail("This path is not an article or photo.", 403);
          return json(await api.read(target));
        }
        if (path === "github/write" && request.method === "POST") {
          const body = await bodyJSON(request);
          let bytes;
          if (postPath.test(body.path || "")) {
            if (typeof body.content !== "string") fail("Missing article.");
            bytes = decode64(body.content);
          } else if (photoPath.test(body.path || "")) {
            const asset = await library.assetAtPath(body.path);
            if (!asset) fail("Upload the photo before publishing.", 409);
            const object = await env.PHOTOS.get(asset.key);
            if (!object)
              fail("The photo could not be loaded. Retry publishing.", 503);
            bytes = new Uint8Array(await object.arrayBuffer());
          } else
            fail("Publishing is limited to blog articles and photos.", 403);
          if (body.sha && !/^[a-f0-9]{40}$/.test(body.sha))
            fail("Invalid article revision.");
          const result = await api.ensureWrite({
            path: body.path,
            bytes,
            sha: body.sha,
            message: `Writing room: update ${body.path}`,
          });
          return json(result);
        }
      }
      return json({ error: "Not found." }, 404);
    } catch (error) {
      // Never log request bodies, authorization headers or article text.
      const status = error.status || (error.conflict ? 409 : 502);
      return json(
        {
          error:
            status < 500 || error.status === 503
              ? error.message
              : "Cloud storage or publishing is temporarily unavailable. Your local recovery copy is safe; retry shortly.",
          conflict: !!error.conflict,
        },
        status,
      );
    }
  },
};
