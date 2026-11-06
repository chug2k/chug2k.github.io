import { DurableObject } from "cloudflare:workers";

// One library per verified author. Compare-and-save, recovery forks and replay
// receipts commit together; an interrupted response can safely be retried.
export class WriterLibrary extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(id, revision));
      CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS asset_refs (id TEXT PRIMARY KEY, path TEXT NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS asset_refs_path ON asset_refs(path);
      INSERT OR IGNORE INTO asset_refs SELECT * FROM assets;
    `);
  }
  list() {
    return this.ctx.storage.sql
      .exec("SELECT value FROM drafts")
      .toArray()
      .map((r) => JSON.parse(r.value));
  }
  get(id) {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM drafts WHERE id = ?", id)
      .toArray()[0];
    return row ? JSON.parse(row.value) : null;
  }
  save({ draft: input, baseRevision, mutationId, fingerprint }) {
    return this.ctx.storage.transactionSync(() => {
      const previous = this.ctx.storage.sql
        .exec("SELECT * FROM receipts WHERE id = ?", mutationId)
        .toArray()[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          return {
            error:
              "This save identifier was already used for different content.",
            status: 409,
          };
        const receipt = JSON.parse(previous.result);
        // The fingerprint proves this is the exact original input. Keep only
        // the server-assigned fields in receipts, not another full article.
        return receipt.draft
          ? receipt
          : {
              draft: { ...input, ...receipt.metadata },
              conflict: receipt.conflict,
            };
      }
      if (input.assetIds.some((id) => !this.getAsset(id)))
        return {
          error: "A photo has not finished uploading. Retry saving.",
          status: 409,
        };
      const latest = this.get(input.id);
      const conflict = latest
        ? latest.revision !== baseRevision
        : baseRevision !== 0;
      const draft = { ...input };
      if (conflict) {
        draft.id = crypto.randomUUID();
        draft.recoveryOf = input.id;
        draft.recoveryLabel =
          "Another device edited this draft · both copies kept";
        draft.archived = false;
      }
      draft.revision = conflict ? 1 : (latest?.revision || 0) + 1;
      draft.updatedAt = Date.now();
      const value = JSON.stringify(draft);
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO drafts VALUES (?, ?, ?)",
        draft.id,
        draft.revision,
        value,
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO revisions VALUES (?, ?, ?)",
        draft.id,
        draft.revision,
        value,
      );
      const result = { draft, conflict };
      this.ctx.storage.sql.exec(
        "DELETE FROM revisions WHERE id = ? AND revision <= ?",
        draft.id,
        draft.revision - 100,
      );
      const metadata = Object.fromEntries(
        [
          "id",
          "revision",
          "updatedAt",
          "recoveryOf",
          "recoveryLabel",
          "archived",
        ]
          .filter((key) => draft[key] !== undefined)
          .map((key) => [key, draft[key]]),
      );
      this.ctx.storage.sql.exec(
        "INSERT INTO receipts VALUES (?, ?, ?)",
        mutationId,
        fingerprint,
        JSON.stringify({ metadata, conflict }),
      );
      return result;
    });
  }
  getAsset(id) {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM asset_refs WHERE id = ?", id)
      .toArray()[0];
    return row ? JSON.parse(row.value) : null;
  }
  assetAtPath(path) {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM asset_refs WHERE path = ? LIMIT 1", path)
      .toArray()[0];
    return row ? JSON.parse(row.value) : null;
  }
  registerAsset(asset) {
    return this.ctx.storage.transactionSync(() => {
      const previous = this.getAsset(asset.id) || this.assetAtPath(asset.path);
      if (previous) {
        if (previous.digest !== asset.digest || previous.path !== asset.path)
          return {
            error:
              "This photo identifier is already used by a different photo.",
            status: 409,
          };
        if (previous.id === asset.id) return previous;
        // ZIP restore creates new local IDs but keeps Markdown image paths.
        // Alias identical bytes safely; never replace an existing path's image.
        asset = { ...previous, id: asset.id };
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO asset_refs VALUES (?, ?, ?)",
        asset.id,
        asset.path,
        JSON.stringify(asset),
      );
      return asset;
    });
  }
}
