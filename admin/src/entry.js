import React from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteView } from "@blocknote/mantine";
import {
  FormattingToolbar,
  FormattingToolbarController,
  BasicTextStyleButton,
  CreateLinkButton,
  FileCaptionButton,
  FileReplaceButton,
  FileDeleteButton,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { renderPreviewDocument } from "../../assets/markdown.mjs";
import { openStorage } from "./storage.js";
import {
  createEditor,
  parseDocument,
  serializeDocument,
  legacyCompatible,
  legacyMarkdown,
  splitFrontmatter,
} from "./document.js";
import { github, repoKey, digest, decodeText } from "./github.js";

const $ = (id) => document.getElementById(id),
  h = React.createElement;
const stored = (k, f = "") => {
  try {
    return localStorage.getItem(k) || f;
  } catch {
    return f;
  }
};
const remember = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const slugify = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
const config = () => ({
  owner: $("owner").value.trim(),
  repo: $("repo").value.trim(),
  branch: $("branch").value.trim() || "main",
  siteUrl: $("siteUrl").value.trim().replace(/\/$/, ""),
});
for (const k of ["owner", "repo", "branch", "siteUrl"])
  if (stored("bn." + k)) $(k).value = stored("bn." + k);
let token = stored("bn.token"),
  authChecked = "",
  storage,
  active,
  editor;
let revision = 0,
  savedRevision = 0,
  saveQueue = Promise.resolve(),
  saveTimer,
  loading = true,
  busy = false,
  transitioning = false,
  assetBusy = 0,
  navVersion = 0,
  openController,
  listController,
  viewBlocks = "";
let lastArchived = null,
  reviewSnapshot = null,
  previewTheme = "light",
  liveTimer,
  liveChecks = 0,
  lastImageId = null;
const urls = new Map(),
  volatileAssets = new Map();
const say = (text) => {
  $("status").textContent = text;
};
const action =
  (fn) =>
  async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      say(error.message || String(error));
      if ($("reviewDialog").open)
        $("reviewStatus").textContent = error.message || String(error);
    }
  };
const on = (id, fn, event = "click") =>
  $(id).addEventListener(event, action(fn));
const snapshot = () => structuredClone(active);
const filename = (d) =>
  `${d.date || today()}-${d.slug || slugify(d.title) || "untitled"}.md`;
const pathFor = (d) => d.path || `blog/posts/${filename(d)}`;
const articleURL = (d) =>
  new URL(
    `/blog/${pathFor(d).split("/").pop().replace(/\.md$/, "")}/`,
    d.config?.siteUrl || config().siteUrl,
  ).href;
const frontmatter = (d, isDraft) =>
  `---\ntitle: ${(d.title || "Untitled").trim().replace(/\s*\n\s*/g, " ")}\ndescription: ${(d.dek || "").trim().replace(/\s*\n\s*/g, " ")}\ndate: ${d.date || today()}\ndraft: ${isDraft}\n---\n\n`;
const backupSource = (d) =>
  d.pristine && d.originalSource != null
    ? d.originalSource
    : frontmatter(d, true) + (d.markdown || "").trimEnd() + "\n";
const publicationState = (d) =>
  d.unpublishedChanges
    ? "Unpublished changes"
    : d.attempt?.state === "live"
      ? "Live"
      : d.attempt?.state === "accepted"
        ? "Publishing"
        : d.attempt?.state === "attention"
          ? "Needs attention"
          : "Draft";
function markChanged() {
  if (loading || !active) return;
  active.pristine = false;
  if (active.attempt?.acceptedAt) active.unpublishedChanges = true;
  revision++;
  say("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 250);
  updateWords();
}
function updateWords() {
  const value = active?.markdown || "";
  $("words").textContent = value.trim()
    ? `${value.trim().split(/\s+/).length} words`
    : "";
}
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
async function capture(d = snapshot()) {
  if (d.bodyDirty && !d.sourceMode) {
    d.markdown = await serializeDocument(editor, d.blocks);
    d.bodyDirty = false;
  }
  return d;
}
function persist() {
  clearTimeout(saveTimer);
  saveQueue = saveQueue
    .catch(() => false)
    .then(async () => {
      if (!active || loading || savedRevision === revision) return true;
      const target = active,
        version = revision;
      try {
        const value = await capture();
        for (const id of value.assetIds || [])
          if (volatileAssets.has(id)) {
            await storage.putAsset(volatileAssets.get(id));
            volatileAssets.delete(id);
          }
        if (
          value.originalSource &&
          !value.pristine &&
          !value.sourceBackupMade
        ) {
          const [meta, body] = splitFrontmatter(value.originalSource);
          await storage.copy(
            {
              ...value,
              title: meta.title || value.title,
              dek: meta.description || value.dek,
              date: meta.date || value.date,
              markdown: body,
              blocks: null,
              sourceMode: true,
              bodyDirty: false,
              pristine: true,
            },
            `Original source before editing · ${new Date().toLocaleString()}`,
          );
          value.sourceBackupMade = true;
          target.sourceBackupMade = true;
        }
        const result = await storage.save(value, target.revision || 0);
        if (active === target) {
          active.id = result.draft.id;
          active.revision = result.draft.revision;
          active.updatedAt = result.draft.updatedAt;
          active.recoveryOf = result.draft.recoveryOf;
          active.recoveryLabel = result.draft.recoveryLabel;
          if (revision === version) {
            active.markdown = value.markdown;
            active.bodyDirty = false;
          }
          savedRevision = version;
          remember("bn.activeDraft", active.id);
          if (result.conflict) {
            $("sourceNotice").hidden = false;
            $("sourceNotice").textContent =
              "Another tab saved a different version. Both versions are safe in My drafts; you are editing a recovery copy.";
            say("Saved a recovery copy — another tab changed this draft.");
          } else if (revision === version) say("Saved on this device");
        }
        await renderDrafts();
        return true;
      } catch (error) {
        say(
          "Couldn’t save on this device. Download backup keeps your latest writing and photos.",
        );
        return false;
      }
    });
  return saveQueue;
}
async function flushRequired() {
  if (!(await persist()))
    throw new Error(
      "Your latest changes could not be saved. Download a backup before leaving this draft, then retry saving.",
    );
}
function safeToNavigate() {
  if (busy || assetBusy || loading || transitioning)
    throw new Error(
      "Wait for the current operation to finish. Your draft is still open.",
    );
}
function transition(value) {
  transitioning = value;
  $("app").disabled = value;
  $("sheet").inert = value || busy;
}
function cancelOpen() {
  navVersion++;
  openController?.abort();
  openController = null;
  clearTimeout(liveTimer);
  return navVersion;
}
function modeUI() {
  $("editor").hidden = active.sourceMode;
  $("sourceBox").hidden = !active.sourceMode;
  $("markdownSource").value = active.markdown || "";
  $("modeBtn").textContent = active.sourceMode ? "Visual editor" : "Markdown";
  $("insertMenu").hidden = active.sourceMode;
  $("reloadBtn").hidden = !active.path && !active.attempt?.path;
  updateWords();
  contextTools();
}
async function installDraft(d, nav = navVersion) {
  loading = true;
  $("sheet").inert = true;
  try {
    d = structuredClone(d);
    if (d.markdown == null && d.blocks?.length)
      d.markdown = await legacyMarkdown(d.blocks);
    let blocks;
    if (
      d.blocks?.length &&
      !d.sourceMode &&
      (!d.legacy || legacyCompatible(d.blocks))
    )
      blocks = d.blocks;
    else blocks = await parseDocument(editor, d.markdown || "");
    if (nav !== navVersion) return;
    active = {
      ...d,
      config: d.config || config(),
      sourceMode: !!d.sourceMode,
      assetIds: d.assetIds || [],
      blocks,
      bodyDirty: false,
    };
    if (
      d.legacyBlocks ||
      (d.legacy && d.blocks?.length && !legacyCompatible(d.blocks))
    ) {
      active.legacyBlocks = d.legacyBlocks || d.blocks;
      $("sourceNotice").textContent =
        "This older draft used formatting this editor cannot publish. Its original editor data is preserved in Download backup. Review the preview before publishing.";
      $("sourceNotice").hidden = false;
    } else {
      $("sourceNotice").hidden = !d.recoveryLabel;
      $("sourceNotice").textContent = d.recoveryLabel || "";
    }
    editor.replaceBlocks(editor.document, blocks);
    viewBlocks = JSON.stringify(editor.document);
    active.blocks = editor.document;
    for (const [id, key] of [
      ["title", "title"],
      ["dek", "dek"],
      ["date", "date"],
      ["slug", "slug"],
    ])
      $(id).value = active[key] || (id === "date" ? today() : "");
    for (const id of ["title", "dek"]) autoGrow($(id));
    revision = 0;
    savedRevision = 0;
    remember("bn.activeDraft", active.id);
    modeUI();
    publicationUI();
    say(d.recoveryLabel || "Saved on this device");
    window.scrollTo({ top: 0 });
  } finally {
    if (nav === navVersion) {
      loading = false;
      $("sheet").inert = busy;
    }
  }
}
async function openDraft(id) {
  safeToNavigate();
  transition(true);
  try {
    const nav = cancelOpen();
    await flushRequired();
    const d = await storage.get(id);
    if (d && nav === navVersion) await installDraft(d, nav);
  } finally {
    transition(false);
  }
}
async function newDraft() {
  safeToNavigate();
  transition(true);
  try {
    const nav = cancelOpen();
    await flushRequired();
    const d = (
      await storage.save(
        {
          id: crypto.randomUUID(),
          title: "",
          dek: "",
          date: today(),
          slug: "",
          markdown: "",
          blocks: [],
          config: config(),
          sourceMode: false,
          assetIds: [],
          pristine: false,
        },
        0,
      )
    ).draft;
    if (nav === navVersion) {
      await installDraft(d, nav);
      $("title").focus();
    }
    await renderDrafts();
  } finally {
    transition(false);
    $("title").focus();
  }
}
async function renderDrafts() {
  const list = $("draftlist"),
    search = $("draftSearch").value.toLowerCase(),
    show = $("showArchived").checked;
  const drafts = (await storage.list())
    .filter(
      (d) =>
        (show || !d.archived) &&
        `${d.title} ${d.recoveryLabel || ""}`.toLowerCase().includes(search),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  list.replaceChildren();
  for (const d of drafts) {
    const li = document.createElement("li"),
      open = document.createElement("button"),
      meta = document.createElement("small"),
      archive = document.createElement("button");
    open.type = "button";
    open.className = "draft-open";
    open.textContent = d.title || "Untitled draft";
    open.disabled = busy;
    if (d.id === active?.id) open.setAttribute("aria-current", "true");
    meta.textContent = [
      d.archived ? "Archived" : publicationState(d),
      d.recoveryLabel,
      new Date(d.updatedAt).toLocaleString(),
    ]
      .filter(Boolean)
      .join(" · ");
    open.append(meta);
    open.onclick = action(() => openDraft(d.id));
    archive.type = "button";
    archive.textContent = d.archived ? "Restore" : "Archive";
    archive.setAttribute(
      "aria-label",
      `${archive.textContent} ${d.title || "untitled draft"}`,
    );
    archive.disabled = busy;
    archive.onclick = action(async () => {
      safeToNavigate();
      await flushRequired();
      const latest = await storage.get(d.id);
      latest.archived = !latest.archived;
      const result = await storage.save(latest, latest.revision);
      if (active.id === d.id) {
        active.archived = result.draft.archived;
        active.revision = result.draft.revision;
      }
      lastArchived = latest.archived ? d.id : null;
      $("undoNotice").hidden = !lastArchived;
      await renderDrafts();
    });
    li.append(open, archive);
    list.append(li);
  }
  if (!drafts.length)
    list.textContent = search ? "No matching drafts." : "No drafts here yet.";
}
async function preserveBeforeConversion() {
  if (active.pristine || active.originalSource) {
    await storage.copy(
      await capture(),
      `Before visual conversion · ${new Date().toLocaleString()}`,
    );
    active.originalSource = null;
    active.pristine = false;
  }
}
async function switchMode() {
  safeToNavigate();
  transition(true);
  const nav = cancelOpen(),
    target = active;
  try {
    await flushRequired();
    if (nav !== navVersion || active !== target) return;
    loading = true;
    $("sheet").inert = true;
    if (active.sourceMode) {
      await preserveBeforeConversion();
      const blocks = await parseDocument(editor, active.markdown);
      if (nav !== navVersion || active !== target) return;
      editor.replaceBlocks(editor.document, blocks);
      active.blocks = editor.document;
      viewBlocks = JSON.stringify(editor.document);
      active.sourceMode = false;
    } else {
      active.markdown = (await capture()).markdown;
      active.sourceMode = true;
    }
    active.bodyDirty = false;
    modeUI();
  } finally {
    loading = false;
    transition(false);
  }
  markChanged();
  await persist();
}
function onEditorChange() {
  if (loading || active?.sourceMode || !active) return;
  const blocks = editor.document,
    signature = JSON.stringify(blocks);
  if (signature === viewBlocks) return;
  viewBlocks = signature;
  active.blocks = blocks;
  active.bodyDirty = true;
  markChanged();
  contextTools();
}
function contextTools() {
  if (!active || active.sourceMode) {
    $("tableTools").hidden = true;
    $("imageTools").hidden = true;
    return;
  }
  let b;
  try {
    b = editor.getTextCursorPosition().block;
  } catch {
    return;
  }
  $("tableTools").hidden = b.type !== "table";
  $("imageTools").hidden = b.type !== "image";
  if (b.type === "image" && lastImageId !== b.id) {
    lastImageId = b.id;
    $("imageAlt").value = b.props.name || "";
    $("imageCaption").value = b.props.caption || "";
  }
  if (b.type !== "image") lastImageId = null;
}
function insert(type) {
  if (active.sourceMode) return;
  const current = editor.getTextCursorPosition().block;
  const value = { type };
  if (type === "heading") value.props = { level: 1 };
  if (type === "table")
    value.content = {
      type: "tableContent",
      headerRows: 1,
      rows: [
        { cells: ["Column 1", "Column 2", "Column 3"] },
        { cells: ["", "", ""] },
      ],
    };
  if (["excerptBreak", "image", "divider"].includes(type)) value.props = {};
  if (current.type === "paragraph" && !current.content?.length)
    editor.updateBlock(current, value);
  else
    editor.insertBlocks(
      [value, { type: "paragraph", content: "" }],
      current,
      "after",
    );
  $("insertMenu").open = false;
  editor.focus();
  contextTools();
}
function tableEdit(kind) {
  const b = editor.getTextCursorPosition().block;
  if (b.type !== "table") return;
  const content = structuredClone(b.content),
    rows = content.rows,
    columns = rows[0].cells.length;
  if (kind === "addRow")
    rows.push({
      cells: Array.from({ length: columns }, (_, i) => ({
        type: "tableCell",
        props: {
          backgroundColor: "default",
          textColor: "default",
          textAlignment: rows[0].cells[i].props?.textAlignment || "left",
        },
        content: [],
      })),
    });
  if (kind === "addColumn") rows.forEach((r) => r.cells.push([]));
  if (kind === "removeRow" && rows.length > 1) rows.pop();
  if (kind === "removeColumn" && columns > 1)
    rows.forEach((r) => r.cells.pop());
  editor.updateBlock(b, { content });
  editor.focus();
}
async function localPhoto(file) {
  if (!active) throw new Error("Open a draft first.");
  const target = active;
  assetBusy++;
  try {
    if (!file.size || file.size > 8 * 1024 * 1024)
      throw new Error("Choose a JPG, PNG, WebP, or GIF up to 8 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type =
      bytes[0] === 255 && bytes[1] === 216
        ? "image/jpeg"
        : bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          ? "image/png"
          : String.fromCharCode(...bytes.slice(0, 3)) === "GIF"
            ? "image/gif"
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
                String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
              ? "image/webp"
              : null;
    if (!type)
      throw new Error(
        "This file is not a supported photo. Choose JPG, PNG, WebP, or GIF.",
      );
    const blob = new Blob([bytes], { type });
    const bitmap = await createImageBitmap(blob);
    const pixels = bitmap.width * bitmap.height;
    bitmap.close();
    if (pixels > 40000000)
      throw new Error(
        "This photo is too large to edit comfortably. Resize it below 40 megapixels.",
      );
    let total = blob.size;
    for (const id of target.assetIds || []) {
      const a = await asset(id);
      total += a?.blob.size || 0;
    }
    if (total > 40 * 1024 * 1024)
      throw new Error(
        "This draft already has 40 MB of photos. Resize photos or split the article.",
      );
    const id = crypto.randomUUID(),
      ext = type.split("/")[1].replace("jpeg", "jpg"),
      name = `${id.slice(0, 8)}-${slugify(file.name.replace(/\.[^.]+$/, "")) || "photo"}.${ext}`;
    const value = {
      id,
      path: `blog/assets/${target.id}/${name}`,
      name: file.name,
      type,
      blob,
      createdAt: Date.now(),
    };
    volatileAssets.set(id, value);
    target.assetIds = [...new Set([...(target.assetIds || []), id])];
    try {
      await storage.putAsset(value);
      volatileAssets.delete(id);
    } catch {
      say(
        "Photo is only in memory: storage is full. Download backup before closing this page.",
      );
    }
    markChanged();
    return "/" + value.path;
  } finally {
    assetBusy--;
  }
}
async function asset(id) {
  return volatileAssets.get(id) || (await storage.getAsset(id));
}
async function resolvePhoto(url) {
  for (const id of active?.assetIds || []) {
    const a = await asset(id);
    if (a && url === "/" + a.path) {
      if (!urls.has(id)) urls.set(id, URL.createObjectURL(a.blob));
      return urls.get(id);
    }
  }
  return url;
}
async function selectPhotos(files) {
  for (const file of files) {
    const url = await localPhoto(file);
    const current = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [
        { type: "image", props: { url, name: "", caption: "" } },
        { type: "paragraph", content: "" },
      ],
      current,
      "after",
    );
  }
  await persist();
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
async function download() {
  await persist();
  const d = await capture();
  if (d.assetIds?.length || d.legacyBlocks) {
    const files = {
      "article.md": strToU8(backupSource(d)),
      "draft.json": strToU8(
        JSON.stringify({ ...d, bodyDirty: false }, null, 2),
      ),
      "RESTORE.txt": strToU8(
        "Import this ZIP in the writing room to restore the draft and photos. To use it in the repository, keep the blog/assets folder and place article.md in blog/posts with its dated filename. No files in this backup have been published automatically.\n",
      ),
    };
    for (const id of d.assetIds || []) {
      const a = await asset(id);
      if (!a)
        throw new Error(
          "A local photo is missing. Restore its backup before exporting this draft.",
        );
      files[a.path] = new Uint8Array(await a.blob.arrayBuffer());
    }
    downloadBlob(
      new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
      filename(d).replace(/\.md$/, ".zip"),
    );
    say("Downloaded a complete draft backup, including photos.");
  } else {
    downloadBlob(
      new Blob([backupSource(d)], { type: "text/markdown;charset=utf-8" }),
      filename(d),
    );
    say("Downloaded your latest writing.");
  }
}
async function importDraft(file) {
  if (!file) return;
  safeToNavigate();
  transition(true);
  try {
    const nav = cancelOpen();
    await flushRequired();
    let d;
    if (file.name.endsWith(".zip")) {
      if (file.size > 60 * 1024 * 1024)
        throw new Error("This backup is too large. The limit is 60 MB.");
      let expanded = 0;
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => {
          expanded += entry.originalSize;
          if (expanded > 70 * 1024 * 1024)
            throw new Error("This backup expands beyond 70 MB.");
          return (
            entry.name === "draft.json" ||
            entry.name === "article.md" ||
            /^blog\/assets\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(entry.name)
          );
        },
      });
      if (!files["draft.json"] || !files["article.md"])
        throw new Error("This ZIP is not a writing-room backup.");
      const old = JSON.parse(strFromU8(files["draft.json"]));
      d = {
        ...old,
        id: crypto.randomUUID(),
        revision: 0,
        recoveryLabel: "Imported backup",
        path: null,
        sha: null,
        attempt: null,
        publishedAt: null,
        unpublishedChanges: false,
        sourceBackupMade: false,
        config: config(),
        pristine: true,
        originalSource: strFromU8(files["article.md"]),
        assetIds: [],
        archived: false,
      };
      const [, body] = splitFrontmatter(d.originalSource);
      d.markdown = body;
      d.blocks = null;
      d.sourceMode = false;
      // Old asset IDs are replaced; paths stay stable so the Markdown remains exact.
      for (const [path, bytes] of Object.entries(files))
        if (path.startsWith("blog/assets/")) {
          if (bytes.length > 8 * 1024 * 1024)
            throw new Error("A photo in this backup exceeds 8 MB.");
          const id = crypto.randomUUID(),
            ext = path.split(".").pop().toLowerCase(),
            type = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
              gif: "image/gif",
            }[ext];
          if (!type)
            throw new Error("This backup contains an unsupported asset.");
          await storage.putAsset({
            id,
            path,
            name: path.split("/").pop(),
            type,
            blob: new Blob([bytes], { type }),
            createdAt: Date.now(),
          });
          d.assetIds.push(id);
        }
    } else {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Choose a Markdown article smaller than 2 MB.");
      const source = await file.text(),
        [meta, body] = splitFrontmatter(source),
        m = file.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
      d = {
        id: crypto.randomUUID(),
        title: meta.title || file.name.replace(/\.md$/, ""),
        dek: meta.description || "",
        date: meta.date || m?.[1] || today(),
        slug: m?.[2] || "",
        markdown: body,
        originalSource: source,
        pristine: true,
        sourceMode: false,
        config: config(),
        assetIds: [],
      };
    }
    const saved = (await storage.save(d, 0)).draft;
    if (nav === navVersion) await installDraft(saved, nav);
    await renderDrafts();
  } finally {
    transition(false);
    $("importFile").value = "";
  }
}
function expired(usedToken) {
  if (token !== usedToken) return;
  token = "";
  authChecked = "";
  remember("bn.token", "");
  showAuth();
  $("authError").textContent =
    "Your connection expired or was revoked. Paste a new token to reconnect.";
  connect();
}
function client(c = config(), t = token) {
  return github(c, t, expired);
}
function showAuth() {
  const connected = !!token;
  $("signedOut").hidden = connected;
  $("signedIn").hidden = !connected;
  $("connectBtn").textContent = connected
    ? "GitHub connection"
    : "Connect GitHub";
}
function connect() {
  if ($("reviewDialog").open) $("reviewDialog").close();
  $("connectionDrawer").open = true;
  $("connectionDrawer").scrollIntoView({ behavior: "smooth" });
  if (!token) $("tokenInput").focus({ preventScroll: true });
}
async function checkAuth() {
  const c = config(),
    t = token;
  const login = await client(c, t).validate();
  if (token === t && repoKey(c) === repoKey(config())) {
    authChecked = repoKey(c);
    $("userLogin").textContent = login;
    showAuth();
  }
  return login;
}
async function refreshPosts() {
  listController?.abort();
  listController = new AbortController();
  const controller = listController,
    list = $("postlist"),
    c = config();
  list.textContent = "Loading articles…";
  try {
    const files = await client(c).list(controller.signal);
    if (controller !== listController) return;
    list.replaceChildren();
    for (const file of files) {
      const li = document.createElement("li"),
        button = document.createElement("button");
      button.type = "button";
      button.className = "draft-open";
      button.textContent = file.name.replace(/\.md$/, "");
      button.disabled = busy;
      button.onclick = action(() => openPost(file.path));
      li.append(button);
      list.append(li);
    }
    if (!files.length) list.textContent = "No articles in this repository.";
  } catch (error) {
    if (controller === listController && !controller.signal.aborted)
      list.textContent = error.message;
  }
}
async function openPost(path, latest = false) {
  safeToNavigate();
  const nav = cancelOpen();
  await flushRequired();
  const c = config();
  if (!latest) {
    const existing = (await storage.list())
      .filter(
        (d) =>
          !d.archived &&
          d.path === path &&
          repoKey(d.config || {}) === repoKey(c),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (existing && nav === navVersion) {
      await installDraft(existing, nav);
      return;
    }
  }
  const controller = new AbortController();
  openController = controller;
  say("Loading article… You can keep writing.");
  const data = await client(c).read(path, controller.signal);
  if (nav !== navVersion) return;
  if (!data)
    throw new Error(
      "This article is no longer at that GitHub path. Your local draft is unchanged.",
    );
  if (!data.content)
    throw new Error(
      "This source is too large to open through GitHub Contents. Download it from GitHub and import it here.",
    );
  const source = decodeText(data.content),
    [meta, body] = splitFrontmatter(source),
    m = path.match(/(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  // Save anything typed while the read was pending before replacing the screen.
  transition(true);
  try {
    await flushRequired();
    if (nav !== navVersion) return;
    const d = (
      await storage.save(
        {
          id: crypto.randomUUID(),
          title: meta.title || "",
          dek: meta.description || "",
          date: meta.date || m?.[1] || today(),
          slug: m?.[2] || "",
          markdown: body,
          originalSource: source,
          pristine: true,
          path,
          sha: data.sha,
          config: c,
          sourceMode: false,
          assetIds: [],
          recoveryLabel: latest
            ? "Latest GitHub copy · compare with your previous draft"
            : "",
        },
        0,
      )
    ).draft;
    if (nav === navVersion) {
      await installDraft(d, nav);
      say(
        latest
          ? "Latest GitHub copy opened. Your previous version remains in My drafts."
          : "Opened a local working copy.",
      );
    }
    await renderDrafts();
  } finally {
    transition(false);
  }
}
function validate(d) {
  if (!d.title?.trim() || !d.dek?.trim() || !d.markdown?.trim())
    throw new Error(
      "Add a title, a short summary, and some writing before publishing.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
    !Number.isFinite(Date.parse(d.date)) ||
    new Date(d.date).toISOString().slice(0, 10) !== d.date
  )
    throw new Error("Choose a valid article date in Publication details.");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(d.slug || slugify(d.title)))
    throw new Error(
      "Set a URL name using lowercase letters, numbers, and hyphens in Publication details.",
    );
  const site = new URL(d.config?.siteUrl || config().siteUrl);
  if (!["https:", "http:"].includes(site.protocol))
    throw new Error("Choose an HTTP or HTTPS live site URL.");
}
async function preview() {
  safeToNavigate();
  transition(true);
  try {
    const nav = cancelOpen(),
      target = active;
    await persist();
    const d = await capture();
    if (nav !== navVersion || active !== target) return;
    d.config = d.path ? d.config : config();
    reviewSnapshot = d;
    $("reviewMeta").replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `${d.title || "Untitled"} · ${d.date || today()}`;
    const dest = document.createElement("p");
    dest.textContent = `Destination: ${articleURL(d)}`;
    const description = document.createElement("p");
    description.textContent = d.dek || "Add a short summary before publishing.";
    const hint = document.createElement("p");
    hint.textContent =
      "Publishing is immediate. The article date does not schedule publication.";
    $("reviewMeta").append(summary, description, dest, hint);
    $("publishBtn").textContent = d.path ? "Update article now" : "Publish now";
    $("reviewStatus").textContent =
      "Review your article. Local photos are uploaded only when you publish.";
    await refreshPreview();
    $("reviewDialog").showModal();
  } finally {
    transition(false);
  }
}
async function refreshPreview() {
  const d = reviewSnapshot;
  if (!d) return;
  let markup = renderPreviewDocument({
    title: d.title || "Untitled",
    description: d.dek || "",
    date: d.date || today(),
    body: d.markdown,
    url: articleURL(d),
    baseUrl: location.origin + "/",
    theme: previewTheme,
  });
  const doc = new DOMParser().parseFromString(markup, "text/html");
  for (const img of doc.querySelectorAll("img"))
    img.setAttribute("src", await resolvePhoto(img.getAttribute("src")));
  $("previewFrame").srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
}
function setBusy(value) {
  busy = value;
  $("sheet").inert = value;
  $("drawer").inert = value;
  for (const id of [
    "newBtn",
    "importBtn",
    "downloadBtn",
    "modeBtn",
    "reviewBtn",
    "draftsBtn",
    "connectBtn",
    "publishBtn",
  ])
    $(id).disabled = value;
  $("closeReview").disabled = value;
}
function publicationUI() {
  const a = active?.attempt;
  $("reloadBtn").hidden = !active?.path && !a?.path;
  $("publishedLink").hidden = !a?.acceptedAt;
  $("checkLiveBtn").hidden = !a?.acceptedAt;
  if (a?.acceptedAt) {
    $("publishedLink").href = a.url;
    $("publishedLink").textContent =
      a.state === "live" ? "Open article ↗" : "Check live site ↗";
  }
}
async function publish() {
  if (busy) return;
  const target = active,
    nav = navVersion;
  await flushRequired();
  const d = await capture();
  if (active !== target || nav !== navVersion) return;
  validate(d);
  if (d.path && repoKey(d.config) !== repoKey(config()))
    throw new Error(
      "This article belongs to a different repository. Restore its repository settings before publishing.",
    );
  if (!token) {
    say(
      "Connect this browser to GitHub to publish. Your draft and photos are saved.",
    );
    connect();
    return;
  }
  setBusy(true);
  let accepted = false;
  try {
    const c = d.path ? d.config : config(),
      api = client(c);
    active.config = c;
    $("reviewStatus").textContent = "Checking GitHub access…";
    await api.validate();
    // Reconcile a previous uncertain request before allowing a newer revision.
    if (
      active.attempt &&
      ["sending", "attention"].includes(active.attempt.state) &&
      active.attempt.source
    ) {
      const prior = active.attempt;
      if (repoKey(prior.config) !== repoKey(c))
        throw new Error(
          "Restore the repository settings used by the pending publication before retrying.",
        );
      const remote = await api.read(prior.path);
      if (remote?.content && decodeText(remote.content) === prior.source) {
        active.path = prior.path;
        active.sha = remote.sha;
      } else if (remote && remote.sha !== prior.baseSha)
        throw new Error(
          "The pending publication differs from GitHub. Load latest to compare; your draft is safe.",
        );
    }
    const source = frontmatter(d, false) + d.markdown.trimEnd() + "\n",
      path = active.path || pathFor(d),
      hash = await digest(source);
    active.attempt = {
      path,
      source,
      hash,
      baseSha: active.sha || null,
      config: c,
      url: new URL(
        `/blog/${path.split("/").pop().replace(/\.md$/, "")}/`,
        c.siteUrl,
      ).href,
      state: "sending",
      startedAt: Date.now(),
    };
    revision++;
    await flushRequired(); // Durable intent exists before any remote write, including photos.
    let count = 0;
    const referenced = [];
    for (const id of active.assetIds || []) {
      const a = await asset(id);
      if (a && d.markdown.includes("/" + a.path)) referenced.push(a);
      else if (!a)
        throw new Error(
          "A draft photo is missing. Restore the complete backup before publishing.",
        );
    }
    for (const a of referenced) {
      $("reviewStatus").textContent =
        `Uploading photo ${++count} of ${referenced.length}…`;
      await api.ensureWrite({
        path: a.path,
        bytes: new Uint8Array(await a.blob.arrayBuffer()),
        message: `Add photo for ${d.title}`,
      });
    }
    $("reviewStatus").textContent = "Sending article to GitHub…";
    const result = await api.ensureWrite({
      path,
      bytes: source,
      sha: active.sha,
      message: `${active.sha ? "Edit" : "New"} post: ${d.title}`,
    });
    active.path = path;
    active.sha = result.sha;
    active.attempt.state = "accepted";
    active.attempt.acceptedAt = Date.now();
    active.unpublishedChanges = false;
    active.config = c;
    revision++;
    await flushRequired();
    accepted = true;
    $("reviewStatus").textContent =
      "GitHub has your article. Waiting for this exact revision to reach the live site.";
    say("Publishing — waiting for the live revision.");
    publicationUI();
    liveChecks = 0;
    await checkLive(false);
    await refreshPosts();
  } catch (error) {
    if (active.attempt) {
      active.attempt.state = "attention";
      active.attempt.error = error.message;
      revision++;
      await persist();
    }
    $("reviewStatus").textContent = error.message;
    say(error.message);
    publicationUI();
    await refreshPosts();
  } finally {
    setBusy(false);
    await renderDrafts();
    if (accepted && !$("reviewDialog").open)
      say(
        active.attempt.state === "live"
          ? "Live — this exact revision is published."
          : "Publishing — use Check again to verify the live revision.",
      );
  }
}
async function checkLive(manual = true) {
  clearTimeout(liveTimer);
  const d = active,
    a = d?.attempt;
  if (!a?.url || !a.hash || !a.acceptedAt) {
    say(
      "Publication is not confirmed. Preview and publish again to safely reconcile the saved attempt.",
    );
    return;
  }
  if (new URL(a.url).origin !== location.origin) {
    say(
      "GitHub accepted the article. Open the live site to check publication; this preview cannot verify another origin.",
    );
    $("reviewStatus").textContent = $("status").textContent;
    publicationUI();
    return;
  }
  try {
    const r = await fetch(
      `${a.url}${a.url.includes("?") ? "&" : "?"}writer_revision=${a.hash}`,
      { cache: "no-store", signal: AbortSignal.timeout(12000) },
    );
    const html = r.ok ? await r.text() : "";
    const found = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector('meta[name="article-source-sha256"]')?.content;
    if (active !== d || active.attempt?.hash !== a.hash) return;
    if (found === a.hash) {
      a.state = "live";
      a.liveAt = Date.now();
      revision++;
      await persist();
      if (active !== d) return;
      say(
        d.unpublishedChanges
          ? "The previous revision is live. This draft has unpublished changes."
          : "Live — this exact revision is published.",
      );
      $("reviewStatus").textContent = $("status").textContent;
      publicationUI();
      await renderDrafts();
      return;
    }
    say("Publishing — this revision is not live yet. Check again shortly.");
  } catch {
    if (active !== d || active.attempt?.hash !== a.hash) return;
    say(
      "Could not check the live site. Your GitHub commit is saved; use Check again.",
    );
  }
  if (active !== d || active.attempt?.hash !== a.hash) return;
  $("reviewStatus").textContent = $("status").textContent;
  if (!manual && ++liveChecks < 12)
    liveTimer = setTimeout(() => action(() => checkLive(false))(), 10000);
  else if (!manual) {
    a.state = "attention";
    a.error =
      "The live revision has not appeared yet. Check again or inspect the site build.";
    revision++;
    await persist();
    say(a.error);
  }
  publicationUI();
}

storage = await openStorage();
await storage.migrate((k) => stored(k));
editor = createEditor({ uploadFile: localPhoto, resolveFileUrl: resolvePhoto });
function Toolbar() {
  return h(
    FormattingToolbar,
    null,
    ...["bold", "italic", "strike", "code"].map((style) =>
      h(BasicTextStyleButton, { key: style, basicTextStyle: style }),
    ),
    h(CreateLinkButton, { key: "link" }),
    h(FileCaptionButton, { key: "caption" }),
    h(FileReplaceButton, { key: "replace" }),
    h(FileDeleteButton, { key: "delete" }),
  );
}
createRoot($("editor")).render(
  h(
    BlockNoteView,
    {
      editor,
      theme: "light",
      onChange: onEditorChange,
      onSelectionChange: contextTools,
      formattingToolbar: false,
      slashMenu: false,
      sideMenu: false,
      tableHandles: false,
    },
    h(FormattingToolbarController, { formattingToolbar: Toolbar }),
    h(SuggestionMenuController, {
      triggerCharacter: "/",
      getItems: async (query) =>
        [
          ...getDefaultReactSlashMenuItems(editor).filter(
            (item) => !item.key?.startsWith("toggle"),
          ),
          {
            title: "Excerpt break",
            subtext: "End the homepage introduction here",
            aliases: ["more", "excerpt"],
            group: "Basic blocks",
            onItemClick: () => insert("excerptBreak"),
          },
        ].filter((item) =>
          [item.title, ...(item.aliases || [])].some((t) =>
            t.toLowerCase().includes(query.toLowerCase()),
          ),
        ),
    }),
  ),
);
for (const [id, key] of [
  ["title", "title"],
  ["dek", "dek"],
  ["date", "date"],
  ["slug", "slug"],
])
  on(
    id,
    () => {
      active[key] = $(id).value;
      if (["title", "dek"].includes(id)) autoGrow($(id));
      markChanged();
    },
    "input",
  );
on(
  "markdownSource",
  () => {
    active.markdown = $("markdownSource").value;
    active.blocks = null;
    active.bodyDirty = false;
    markChanged();
  },
  "input",
);
for (const id of ["addRow", "addColumn", "removeRow", "removeColumn"])
  on(id, () => tableEdit(id));
for (const id of ["imageAlt", "imageCaption"])
  on(
    id,
    () => {
      if (lastImageId)
        editor.updateBlock(lastImageId, {
          props: { [id === "imageAlt" ? "name" : "caption"]: $(id).value },
        });
    },
    "input",
  );
for (const button of document.querySelectorAll("[data-insert]"))
  button.onclick = action(() => insert(button.dataset.insert));
for (const button of document.querySelectorAll("[data-style]")) {
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.onclick = () => {
    editor.toggleStyles({ [button.dataset.style]: true });
    editor.focus();
    $("insertMenu").open = false;
  };
}
on("linkBtn", () => {
  const url = prompt("Link URL (https://…)");
  if (url) {
    if (!/^https?:\/\//i.test(url))
      throw new Error("Use an HTTP or HTTPS link.");
    editor.createLink(url, editor.getSelectedText() || url);
  }
  $("insertMenu").open = false;
});
on("photoBtn", () => $("photoFile").click());
on(
  "photoFile",
  async () => {
    await selectPhotos([...$("photoFile").files]);
    $("photoFile").value = "";
  },
  "change",
);
on("modeBtn", switchMode);
on("newBtn", newDraft);
on("downloadBtn", download);
on("importBtn", () => $("importFile").click());
on("importFile", () => importDraft($("importFile").files[0]), "change");
on("draftsBtn", () => {
  $("draftsDrawer").open = true;
  $("draftsDrawer").scrollIntoView({ behavior: "smooth" });
  $("draftSearch").focus({ preventScroll: true });
});
on("draftSearch", renderDrafts, "input");
on("showArchived", renderDrafts, "change");
on("undoArchive", async () => {
  if (!lastArchived) return;
  const d = await storage.get(lastArchived);
  d.archived = false;
  const r = await storage.save(d, d.revision);
  if (active.id === d.id) {
    active.archived = false;
    active.revision = r.draft.revision;
  }
  lastArchived = null;
  $("undoNotice").hidden = true;
  await renderDrafts();
});
on("connectBtn", connect);
on("signinBtn", async () => {
  const t = $("tokenInput").value.trim();
  if (!t) return;
  $("signinBtn").disabled = true;
  $("authError").textContent = "";
  try {
    const c = config(),
      login = await github(c, t, () => {}).validate();
    token = t;
    remember("bn.token", t);
    authChecked = repoKey(c);
    $("userLogin").textContent = login;
    $("tokenInput").value = "";
    showAuth();
    say(
      "Connected. Repository access checked; GitHub enforces token permissions when publishing.",
    );
    await refreshPosts();
  } catch (error) {
    $("authError").textContent = error.message;
  } finally {
    $("signinBtn").disabled = false;
  }
});
on("signoutBtn", () => {
  token = "";
  authChecked = "";
  remember("bn.token", "");
  showAuth();
  say("Disconnected. Drafts and photos remain on this device.");
});
for (const k of ["owner", "repo", "branch", "siteUrl"])
  on(
    k,
    () => {
      remember("bn." + k, $(k).value.trim());
      authChecked = "";
      cancelOpen();
      refreshPosts();
    },
    "change",
  );
on("refreshPosts", refreshPosts);
on("reloadBtn", () => openPost(active.path || active.attempt.path, true));
on("reviewBtn", preview);
on("closeReview", () => $("reviewDialog").close());
on("publishBtn", publish);
on("checkLiveBtn", () => checkLive(true));
on("desktopPreview", () => {
  $("previewFrame").style.maxWidth = "100%";
});
on("mobilePreview", () => {
  $("previewFrame").style.maxWidth = "375px";
});
on("themePreview", async () => {
  previewTheme = previewTheme === "light" ? "dark" : "light";
  $("themePreview").textContent =
    previewTheme === "light" ? "Dark preview" : "Light preview";
  await refreshPreview();
});
$("reviewDialog").addEventListener("cancel", (e) => {
  if (busy) e.preventDefault();
});
// Action menus should not remain over the editor or publication controls.
for (const id of ["moreMenu", "insertMenu"]) {
  const menu = $(id);
  menu.addEventListener("click", (event) => {
    if (event.target.closest("button")) menu.open = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
      event.preventDefault();
    }
  });
}
window.addEventListener("resize", () => {
  for (const id of ["title", "dek"]) autoGrow($(id));
});
window.addEventListener("beforeunload", (e) => {
  if (revision !== savedRevision || busy || assetBusy) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});
new ResizeObserver((entries) => {
  document.documentElement.style.setProperty(
    "--header-height",
    entries[0].target.getBoundingClientRect().height + "px",
  );
}).observe(document.querySelector(".bar"));
storage.onChange(async (message) => {
  await renderDrafts();
  if (!message.local && message.id === active?.id)
    say(
      "Another tab updated this draft. Your next edit will keep both versions.",
    );
});
const drafts = await storage.list(),
  id = stored("bn.activeDraft");
let initial =
  drafts.find((d) => d.id === id && !d.archived) ||
  drafts
    .filter((d) => !d.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
if (!initial)
  initial = (
    await storage.save(
      {
        id: crypto.randomUUID(),
        title: "",
        dek: "",
        date: today(),
        slug: "",
        markdown: "",
        sourceMode: false,
        assetIds: [],
        config: config(),
        pristine: false,
      },
      0,
    )
  ).draft;
await installDraft(initial);
await renderDrafts();
showAuth();
$("app").disabled = false;
$("app").inert = false;
$("app").setAttribute("aria-busy", "false");
$("bootStatus").hidden = true;
window.writerBoot.ready = true;
refreshPosts();
if (token)
  checkAuth().catch((error) => {
    $("authError").textContent = error.message;
    say(error.message);
  });
