import { encode64 } from "./github.js";

export async function cloudRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/admin/api/${path}`, {
      ...options,
      credentials: "same-origin",
      redirect: "error",
      signal: options.signal || AbortSignal.timeout(25000),
      headers: { "X-Writer-Request": "1", ...options.headers },
    });
  } catch {
    throw new Error(
      "Cloud save is waiting for a connection. Your latest writing is kept on this device; reconnect or sign in again.",
    );
  }
  if (response.status === 401 || response.status === 403)
    throw Object.assign(
      new Error("Sign in again to sync. Your local recovery copy is safe."),
      { auth: true },
    );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(
        body.error ||
          `Cloud request failed (${response.status}). Retry shortly.`,
      ),
      { conflict: body.conflict },
    );
  }
  if (options.binary) return response;
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Object.assign(new Error("Sign in again to sync your writing."), {
      auth: true,
    });
  return response.json();
}
const post = (path, body) =>
  cloudRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const cloudGithub = () => ({
  validate: async () => (await cloudRequest("github/validate")).login,
  list: (signal) => cloudRequest("github/list", { signal }),
  read: (path, signal) =>
    cloudRequest(`github/read?path=${encodeURIComponent(path)}`, { signal }),
  ensureWrite: ({ path, bytes, sha }) =>
    post("github/write", {
      path,
      sha,
      ...(path.startsWith("blog/posts/") ? { content: encode64(bytes) } : {}),
    }),
});

// The browser is a recovery cache. A save only resolves after both its photos
// and draft have been acknowledged by the server. Requests survive reloads,
// and exact retries use durable server receipts to avoid duplicate forks.
export async function openCloudStorage(local, session, report = () => {}) {
  const prefix = `cloud:${session.user.email}:`,
    pendingPrefix = `${prefix}pending:`;
  const listeners = new Set();
  const channel = new BroadcastChannel("clpanic-cloud-drafts");
  channel.onmessage = (event) => listeners.forEach((fn) => fn(event.data));
  const emit = (id) => {
    channel.postMessage({ id });
    listeners.forEach((fn) => fn({ id, local: true }));
  };
  // A duplicated browser tab inherits sessionStorage. Give each page its own
  // identity; reload recovery scans the durable outbox, so no reuse is needed.
  const tabId = crypto.randomUUID();
  if (!navigator.locks)
    throw new Error(
      "This browser cannot safely sync drafts. Open the writing room in a current browser.",
    );
  const lock = (id, fn) => navigator.locks.request(id, fn);
  const cache = async (draft) =>
    local.metaPut({ id: `${prefix}draft:${draft.id}`, draft });
  const upload = async (id) => {
    if (await local.metaGet(`${prefix}photo:${id}`)) return;
    const asset = await local.getAsset(id);
    if (!asset) {
      await api.getAsset(id);
      return;
    }
    await cloudRequest(`assets/${encodeURIComponent(id)}`, {
      method: "PUT",
      binary: true,
      headers: { "Content-Type": asset.type, "X-Asset-Path": asset.path },
      body: asset.blob,
    });
    await local.metaPut({ id: `${prefix}photo:${id}`, uploaded: true });
  };
  async function send(record) {
    const rememberRecovery = (draft) => {
      try {
        if (localStorage.getItem("bn.activeDraft") === record.originalId)
          localStorage.setItem("bn.activeDraft", draft.id);
      } catch {}
    };
    let result;
    // A pending request may have been accepted before the connection was lost.
    // Reconcile that exact request before sending newer working text.
    if (record.pending) {
      for (const id of record.pending.draft.assetIds || []) await upload(id);
      result = await post("drafts", record.pending);
      await cache(result.draft);
      if (
        JSON.stringify(record.working) === JSON.stringify(record.pending.draft)
      ) {
        await local.metaDelete(record.id);
        rememberRecovery(result.draft);
        emit(result.draft.id);
        return result;
      }
      record.working.id = result.draft.id;
      record.working.revision = result.draft.revision;
      if (result.conflict) {
        record.working.recoveryOf = result.draft.recoveryOf;
        record.working.recoveryLabel = result.draft.recoveryLabel;
        record.conflict = true;
      }
      record.baseRevision = result.draft.revision;
      record.pending = null;
      await local.metaPut(record);
    }
    for (const id of record.working.assetIds || []) await upload(id);
    record.pending = {
      draft: record.working,
      baseRevision: record.baseRevision,
      mutationId: crypto.randomUUID(),
    };
    await local.metaPut(record);
    result = await post("drafts", record.pending);
    result.conflict ||= !!record.conflict;
    await cache(result.draft);
    await local.metaDelete(record.id);
    rememberRecovery(result.draft);
    emit(result.draft.id);
    return result;
  }
  const api = {
    cloud: true,
    async stage(value, baseRevision = 0) {
      const id = `${pendingPrefix}${tabId}:${value.id}`;
      await lock(id, async () => {
        const previous = await local.metaGet(id);
        await local.metaPut({
          ...previous,
          id,
          originalId: previous?.originalId || value.id,
          working: structuredClone(value),
          baseRevision: previous?.baseRevision ?? baseRevision,
        });
      });
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async list() {
      const drafts = await cloudRequest("drafts");
      for (const draft of drafts) await cache(draft);
      return drafts;
    },
    get(id) {
      return cloudRequest(`drafts/${encodeURIComponent(id)}`);
    },
    async save(value, baseRevision = 0) {
      const id = `${pendingPrefix}${tabId}:${value.id}`;
      return lock(id, async () => {
        const previous = await local.metaGet(id);
        const record = {
          ...previous,
          id,
          originalId: previous?.originalId || value.id,
          working: structuredClone(value),
          baseRevision: previous?.baseRevision ?? baseRevision,
        };
        // Persist the latest text before any network request, including newer
        // edits made while an earlier request is uncertain.
        await local.metaPut(record);
        report("Saving to cloud…");
        try {
          return await send(record);
        } catch (error) {
          report(error.message);
          throw error;
        }
      });
    },
    async copy(value, label) {
      return (
        await this.save(
          {
            ...structuredClone(value),
            id: crypto.randomUUID(),
            revision: 0,
            recoveryOf: value.id,
            recoveryLabel: label,
            archived: false,
          },
          0,
        )
      ).draft;
    },
    async putAsset(asset) {
      await local.putAsset(asset);
      // Keep composing after an upload failure. save() first journals the
      // current article, then retries every photo before acknowledging it.
      try {
        await upload(asset.id);
      } catch (error) {
        report("Photo upload pending. " + error.message);
      }
      return asset;
    },
    async getAsset(id) {
      const existing = await local.getAsset(id);
      if (existing) return existing;
      const response = await cloudRequest(`assets/${encodeURIComponent(id)}`, {
        binary: true,
      });
      const value = {
        ...JSON.parse(
          decodeURIComponent(response.headers.get("X-Writer-Asset")),
        ),
        blob: await response.blob(),
      };
      await local.putAsset(value);
      await local.metaPut({ id: `${prefix}photo:${id}`, uploaded: true });
      return value;
    },
    async recover() {
      for (const entry of await local.metaList(pendingPrefix)) {
        await lock(entry.id, async () => {
          const record = await local.metaGet(entry.id);
          if (record) await send(record);
        });
      }
    },
    async migrate(read) {
      await local.migrate(read);
      await this.recover();
      for (const draft of await local.list()) {
        const marker = `${prefix}import:${draft.id}`;
        await lock(marker, async () => {
          let migration = await local.metaGet(marker);
          if (migration?.cloudId) return;
          // Stable import operation makes an interrupted migration replayable.
          const recordId = `${pendingPrefix}import:${draft.id}`;
          let record = await local.metaGet(recordId);
          if (!migration) {
            const working = {
              ...draft,
              assetIds: draft.assetIds || [],
              revision: 0,
              recoveryLabel: draft.recoveryLabel || "Imported from this device",
            };
            migration = {
              id: marker,
              request: {
                draft: working,
                baseRevision: 0,
                mutationId: crypto.randomUUID(),
              },
            };
            await local.metaPut(migration);
          }
          if (!record) {
            record = {
              id: recordId,
              originalId: draft.id,
              working: migration.request.draft,
              baseRevision: 0,
              pending: migration.request,
            };
            await local.metaPut(record);
          }
          const result = await send(record);
          await local.metaPut({ id: marker, cloudId: result.draft.id });
        });
      }
    },
  };
  return api;
}
