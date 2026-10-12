// Each write compares its base revision inside one IndexedDB transaction.
// Stale writers fork instead of replacing a newer version, including other tabs.
const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const finished = (tx) => {
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () =>
      reject(tx.error || new Error("Storage transaction failed"));
    tx.onerror = () => {};
  });
  done.catch(() => {}); // A failed request may reject before its transaction aborts.
  return done;
};
export async function openStorage() {
  const req = indexedDB.open("clpanic-writing-room", 1);
  req.onupgradeneeded = () => {
    const db = req.result;
    db.createObjectStore("drafts", { keyPath: "id" });
    db.createObjectStore("assets", { keyPath: "id" });
    db.createObjectStore("meta", { keyPath: "id" });
  };
  const db = await request(req);
  db.onversionchange = () => db.close();
  const channel =
    typeof BroadcastChannel === "function"
      ? new BroadcastChannel("clpanic-drafts")
      : null;
  const listeners = new Set();
  channel?.addEventListener("message", (e) =>
    listeners.forEach((fn) => fn(e.data)),
  );
  const notify = (id) => {
    channel?.postMessage({ id });
    listeners.forEach((fn) => fn({ id, local: true }));
  };
  return {
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async list() {
      return request(db.transaction("drafts").objectStore("drafts").getAll());
    },
    async get(id) {
      return request(db.transaction("drafts").objectStore("drafts").get(id));
    },
    async save(value, baseRevision = 0) {
      const tx = db.transaction("drafts", "readwrite"),
        done = finished(tx),
        store = tx.objectStore("drafts");
      const latest = await request(store.get(value.id));
      const conflict = !!latest && latest.revision !== baseRevision;
      const draft = structuredClone(value);
      if (conflict) {
        draft.id = crypto.randomUUID();
        draft.recoveryOf = value.id;
        draft.recoveryLabel = `Concurrent edit · ${new Date().toLocaleString()}`;
        draft.archived = false;
      }
      draft.revision = conflict ? 1 : (latest?.revision || 0) + 1;
      draft.updatedAt = Date.now();
      store.put(draft);
      await done;
      notify(draft.id);
      return { draft, conflict };
    },
    async copy(value, label) {
      const copy = structuredClone(value);
      copy.id = crypto.randomUUID();
      copy.revision = 0;
      copy.recoveryOf = value.id;
      copy.recoveryLabel = label;
      copy.archived = false;
      return (await this.save(copy, 0)).draft;
    },
    async putAsset(asset) {
      const tx = db.transaction("assets", "readwrite"),
        done = finished(tx);
      tx.objectStore("assets").put(asset);
      await done;
      return asset;
    },
    async getAsset(id) {
      return request(db.transaction("assets").objectStore("assets").get(id));
    },
    async migrate(read) {
      const rawMap = read("bn.drafts.v1"),
        rawSingle = read("bn.draft");
      const tx = db.transaction(["drafts", "meta"], "readwrite"),
        done = finished(tx);
      const meta = tx.objectStore("meta"),
        drafts = tx.objectStore("drafts");
      if (!(await request(meta.get("legacy-import-v1")))) {
        let values = [];
        try {
          const map = JSON.parse(rawMap || "{}");
          if (map && typeof map === "object" && !Array.isArray(map))
            values = Object.entries(map).map(([id, d]) => ({ ...d, id }));
        } catch {}
        try {
          const single = JSON.parse(rawSingle || "null");
          if (single && typeof single === "object")
            values.push({
              ...single,
              id: "legacy-single-draft",
              recoveryLabel: "Recovered from the original editor",
            });
        } catch {}
        for (const value of values) {
          if (!value.id || (await request(drafts.get(value.id)))) continue;
          drafts.put({
            ...value,
            revision: 1,
            updatedAt: value.updatedAt || Date.now(),
            legacy: true,
          });
        }
        // Both source strings and the original localStorage keys remain available.
        meta.put({
          id: "legacy-import-v1",
          rawMap,
          rawSingle,
          migratedAt: Date.now(),
        });
      }
      await done;
    },
  };
}
