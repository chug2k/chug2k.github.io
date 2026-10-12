export const encode64 = (data) => {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
export const decode64 = (text) =>
  Uint8Array.from(atob(text.replace(/\s/g, "")), (c) => c.charCodeAt(0));
export const decodeText = (text) => new TextDecoder().decode(decode64(text));
export const digest = async (bytes) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes,
      ),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function gitBlobSha(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`),
    blob = new Uint8Array(header.length + bytes.length);
  blob.set(header);
  blob.set(bytes, header.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", blob))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export const repoKey = (c) => `${c.owner}/${c.repo}/${c.branch}`;
export function github(config, token, onExpired) {
  // Capture all configuration and credentials once for the entire operation.
  const c = { ...config },
    base = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  async function api(path, options = {}) {
    const timeout = AbortSignal.timeout(20000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    const r = await fetch(path.startsWith("https:") ? path : base + path, {
      ...options,
      signal,
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (r.status === 401) {
      onExpired?.(token);
      throw new Error(
        "Your GitHub connection expired or was revoked. Reconnect to continue; your draft is safe.",
      );
    }
    return r;
  }
  async function read(path, signal) {
    const r = await api(
      `/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(c.branch)}`,
      { signal },
    );
    if (r.status === 404) return null;
    if (!r.ok)
      throw new Error(
        `Could not read GitHub (${r.status}). Try again when the connection is available.`,
      );
    return r.json();
  }
  return {
    read,
    async validate() {
      const user = await api("https://api.github.com/user");
      if (!user.ok)
        throw new Error(
          `GitHub is unavailable (${user.status}). Your connection has not been removed.`,
        );
      const r = await api("");
      if (!r.ok)
        throw new Error(
          `Cannot access this repository (${r.status}). Check the selected repository and token permissions.`,
        );
      const repository = await r.json();
      if (!repository.permissions?.push)
        throw new Error(
          "This connection cannot write to the selected repository. Give the token Contents: Read and write access to this repository.",
        );
      return (await user.json()).login;
    },
    async list(signal) {
      const files = await read("blog/posts", signal);
      return Array.isArray(files)
        ? files
            .filter((f) => f.name.endsWith(".md"))
            .sort((a, b) => b.name.localeCompare(a.name))
        : [];
    },
    async ensureWrite({ path, bytes, sha, message }) {
      const expected = encode64(bytes),
        blobSha = await gitBlobSha(bytes);
      const same = (remote) =>
        remote?.sha === blobSha ||
        remote?.content?.replace(/\s/g, "") === expected;
      const before = await read(path);
      if (same(before)) return { sha: before.sha, reconciled: true };
      if (before && (!sha || before.sha !== sha))
        throw Object.assign(
          new Error(
            "The GitHub copy is different. Load latest to compare it with your saved draft; both copies will be kept.",
          ),
          { conflict: true },
        );
      if (!before && sha)
        throw Object.assign(
          new Error(
            "The GitHub article was moved or removed. Your draft is safe. Load latest before publishing.",
          ),
          { conflict: true },
        );
      try {
        const r = await api(
          `/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
          {
            method: "PUT",
            body: JSON.stringify({
              message,
              content: expected,
              branch: c.branch,
              ...(sha ? { sha } : {}),
            }),
          },
        );
        if (!r.ok)
          throw Object.assign(
            new Error(
              r.status === 409 || r.status === 422
                ? "GitHub changed during publishing. Load latest to compare; your draft is safe."
                : r.status === 403
                  ? "GitHub refused this write (403). Check token expiration, repository selection, Contents: Read and write permission, and branch rules; reconnect or retry when access is restored."
                  : `GitHub could not save this file (${r.status}). Check write permission and retry.`,
            ),
            { conflict: r.status === 409 || r.status === 422 },
          );
        const data = await r.json();
        return { sha: data.content.sha, reconciled: false };
      } catch (error) {
        // A timeout can mean the commit succeeded. Read and compare before retrying.
        try {
          const after = await read(path);
          if (same(after)) return { sha: after.sha, reconciled: true };
        } catch {}
        throw error;
      }
    },
  };
}
