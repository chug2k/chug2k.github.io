import React from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";

const $ = (id) => document.getElementById(id);
const status = $("status"), publishBtn = $("publishBtn");
const enc = new TextEncoder(), dec = new TextDecoder();
const b64encode = (s) => {
  const bytes = enc.encode(s); let result = "";
  for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(result);
};
const b64decode = (s) => dec.decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const slugify = t => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-+$/, "");
const stored = (key, fallback = "") => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const newId = () => crypto.randomUUID();
let drafts = {}, activeId = stored("bn.activeDraft"), currentPath = null, currentSha = null;
let markdown = "", sourceMode = false, loading = true, busy = false, changeVersion = 0;
let authToken = stored("bn.token"), currentRepo = "", hasChanges = false;
try { drafts = JSON.parse(stored("bn.drafts.v1", "{}")); if (!drafts || Array.isArray(drafts)) drafts = {}; } catch { drafts = {}; }
for (const key of ["owner", "repo", "branch"]) if (stored("bn." + key)) $(key).value = stored("bn." + key);
const repoKey = () => ["owner", "repo", "branch"].map(key => $(key).value.trim()).join("/");
const editor = BlockNoteEditor.create({ initialContent: [{ type: "paragraph", content: "" }] });
createRoot($("editor")).render(React.createElement(BlockNoteView, { editor, theme: "light", onChange }));

function autogrow(el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
function filename() { return `${$("date").value || today()}-${$("slug").value.trim() || slugify($("title").value) || "untitled"}.md`; }
function frontmatter(draft = true) {
  const singleLine = value => value.trim().replace(/\s*\n\s*/g, " ");
  return `---\ntitle: ${singleLine($("title").value) || "Untitled"}\ndescription: ${singleLine($("dek").value)}\ndate: ${$("date").value || today()}\ndraft: ${draft}\n---\n\n`;
}
function updatePreview() {
  $("words").textContent = markdown.trim() ? `${markdown.trim().split(/\s+/).length} words` : "";
  $("mdPreview").textContent = frontmatter() + markdown;
}
function renderDrafts() {
  const list = $("draftlist"); list.replaceChildren();
  for (const draft of Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt)) {
    const li = document.createElement("li"), button = document.createElement("button"), date = document.createElement("span");
    button.className = "link"; button.type = "button"; button.disabled = busy;
    button.textContent = draft.title || "Untitled draft";
    if (draft.id === activeId) button.setAttribute("aria-current", "true");
    button.addEventListener("click", async () => { await flush(); await loadDraft(draft.id); });
    date.className = "d"; date.textContent = draft.publishedAt ? "Published copy" : "Draft";
    li.append(button, date); list.append(li);
  }
  if (!list.children.length) list.textContent = "Your drafts will appear here as you write.";
}
function saveDraft() {
  if (loading || !activeId) return;
  const draft = { id: activeId, title: $("title").value, dek: $("dek").value, date: $("date").value, slug: $("slug").value,
    blocks: sourceMode ? null : editor.document, markdown, sourceMode, path: currentPath, sha: currentSha,
    repo: currentRepo, updatedAt: Date.now(), publishedAt: drafts[activeId]?.publishedAt || null };
  drafts[activeId] = draft; hasChanges = true;
  try {
    localStorage.setItem("bn.drafts.v1", JSON.stringify(drafts)); localStorage.setItem("bn.activeDraft", activeId);
    localStorage.removeItem("bn.draft");
    status.textContent = "Saved on this device"; hasChanges = false;
  } catch { status.textContent = "Couldn’t save on this device. Download a backup."; }
  renderDrafts(); updatePreview();
}
async function onChange() {
  if (loading || sourceMode) return;
  const version = ++changeVersion, id = activeId;
  const result = await editor.blocksToMarkdownLossy(editor.document);
  if (loading || version !== changeVersion || id !== activeId || sourceMode) return;
  markdown = result; saveDraft();
}
async function flush() {
  ++changeVersion;
  markdown = sourceMode ? $("markdownSource").value : await editor.blocksToMarkdownLossy(editor.document);
  saveDraft();
}
function setModeUI() {
  $("editor").hidden = sourceMode; $("sourceBox").hidden = !sourceMode;
  $("modeBtn").textContent = sourceMode ? "Visual editor" : "Markdown";
  $("markdownSource").value = markdown;
}
async function loadDraft(id) {
  const draft = drafts[id]; if (!draft) return;
  loading = true; ++changeVersion; activeId = id; $("publishedLink").hidden = true;
  $("title").value = draft.title || ""; $("dek").value = draft.dek || "";
  $("date").value = draft.date || today(); $("slug").value = draft.slug || "";
  currentPath = draft.path || null; currentSha = draft.sha || null; currentRepo = draft.repo || repoKey();
  $("reloadBtn").hidden = !currentPath;
  markdown = draft.markdown || ""; sourceMode = !!draft.sourceMode;
  try {
    const blocks = draft.blocks?.length ? draft.blocks : await editor.tryParseMarkdownToBlocks(markdown);
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph", content: "" }]);
    if (!sourceMode) markdown = await editor.blocksToMarkdownLossy(editor.document);
  } catch { sourceMode = true; }
  setModeUI(); for (const el of [$("title"), $("dek")]) autogrow(el);
  loading = false; saveDraft(); window.scrollTo({ top: 0 });
}
async function newDraft() {
  await flush();
  const id = newId(); drafts[id] = { id, date: today(), repo: repoKey(), updatedAt: Date.now() };
  await loadDraft(id); $("title").focus();
}
for (const el of [$("title"), $("dek")]) el.addEventListener("input", () => { autogrow(el); saveDraft(); });
for (const id of ["slug", "date"]) $(id).addEventListener("input", saveDraft);
$("markdownSource").addEventListener("input", () => { markdown = $("markdownSource").value; saveDraft(); });
$("newBtn").addEventListener("click", newDraft);
$("draftsBtn").addEventListener("click", () => { $("draftsDrawer").open = true; $("draftsDrawer").scrollIntoView({ behavior: "smooth" }); });
$("modeBtn").addEventListener("click", async () => {
  await flush();
  if (sourceMode) {
    // Keep source-only constructs intact instead of silently dropping them in a lossy conversion.
    if (/<!--more-->|^\s*\|/m.test(markdown)) { status.textContent = "This article has an excerpt break or table. Keep editing in Markdown to preserve it."; return; }
    loading = true;
    try { const blocks = await editor.tryParseMarkdownToBlocks(markdown); editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph", content: "" }]); sourceMode = false; }
    catch { status.textContent = "Couldn’t switch to Visual. Your Markdown is unchanged."; return; }
    finally { loading = false; }
  } else sourceMode = true;
  setModeUI(); saveDraft();
});
$("downloadBtn").addEventListener("click", async () => {
  await flush(); const url = URL.createObjectURL(new Blob([frontmatter() + markdown.trim() + "\n"], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename(); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async () => {
  const file = $("importFile").files[0]; if (!file) return;
  await flush(); const [meta, body] = splitFrontmatter(await file.text()); const id = newId();
  const match = file.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  drafts[id] = { id, title: meta.title || file.name.replace(/\.md$/, ""), dek: meta.description || "", date: meta.date || match?.[1] || today(), slug: match?.[2] || "", markdown: body, sourceMode: true, repo: repoKey(), updatedAt: Date.now() };
  await loadDraft(id); $("importFile").value = "";
});
window.addEventListener("beforeunload", e => { if (hasChanges || busy) { e.preventDefault(); e.returnValue = ""; } });

const api = (path, opts = {}) => fetch(`https://api.github.com/repos/${encodeURIComponent($("owner").value.trim())}/${encodeURIComponent($("repo").value.trim())}${path}`, {
  ...opts, headers: { Accept: "application/vnd.github+json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), "Content-Type": "application/json", ...opts.headers }
});
let listVersion = 0;
async function refreshList() {
  const version = ++listVersion, list = $("postlist"); list.textContent = "Loading posts…";
  try {
    const r = await api(`/contents/blog/posts?ref=${encodeURIComponent($("branch").value.trim() || "main")}`);
    if (!r.ok) throw new Error(r.status === 404 ? "No posts found." : `Couldn’t load posts (${r.status}). Try connecting GitHub.`);
    const files = (await r.json()).filter(f => f.name.endsWith(".md")).sort((a,b) => b.name.localeCompare(a.name));
    if (version !== listVersion) return; list.replaceChildren();
    if (!files.length) list.textContent = "No published posts yet.";
    for (const file of files) {
      const li = document.createElement("li"), button = document.createElement("button");
      button.className = "link"; button.type = "button"; button.textContent = file.name.replace(/\.md$/, ""); button.disabled = busy;
      button.addEventListener("click", () => openPost(file.path)); li.append(button); list.append(li);
    }
  } catch (error) { if (version === listVersion) list.textContent = error.message; }
}
function splitFrontmatter(text) {
  const meta = {}, match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return [meta, text];
  for (const line of match[1].split(/\r?\n/)) { const i = line.indexOf(":"); if (i !== -1) meta[line.slice(0,i).trim().toLowerCase()] = line.slice(i+1).trim(); }
  return [meta, text.slice(match[0].length).replace(/^\n+/, "")];
}
async function openPost(path, latest = false) {
  await flush();
  const existing = Object.values(drafts).filter(d => d.path === path && d.repo === repoKey()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (existing && !latest) { await loadDraft(existing.id); status.textContent = "Opened your saved copy"; return; }
  status.textContent = "Loading article…";
  try {
    const r = await api(`/contents/${path}?ref=${encodeURIComponent($("branch").value.trim() || "main")}`);
    if (!r.ok) throw new Error(`Couldn’t load article (${r.status})`);
    const data = await r.json(), [meta, body] = splitFrontmatter(b64decode(data.content));
    const match = path.match(/blog\/posts\/(\d{4}-\d{2}-\d{2})-(.+)\.md$/), id = newId();
    // Existing Markdown remains exact until the author deliberately chooses Visual.
    drafts[id] = { id, title: meta.title || "", dek: meta.description || "", date: meta.date || match?.[1] || today(), slug: match?.[2] || "", markdown: body, sourceMode: true, path, sha: data.sha, repo: repoKey(), updatedAt: Date.now() };
    await loadDraft(id); status.textContent = latest ? "Opened the latest GitHub version. Your previous copy is still in My drafts." : "Editing existing article · Markdown preserved";
  } catch (error) { status.textContent = error.message; }
}
$("reloadBtn").addEventListener("click", () => {
  if (currentPath && currentRepo === repoKey()) openPost(currentPath, true);
  else { status.textContent = "Restore this article’s repository settings to load its latest version."; connect(); }
});
function connect() { $("connectionDrawer").open = true; $("connectionDrawer").scrollIntoView({ behavior: "smooth" }); if (!authToken) $("tokenInput").focus({ preventScroll: true }); }
$("connectBtn").addEventListener("click", connect);
function showAuthState() {
  $("signedOut").hidden = !!authToken; $("signedIn").hidden = !authToken;
  $("connectBtn").textContent = authToken ? "GitHub connected" : "Connect GitHub";
}
function setAuth(token) {
  authToken = (token || "").trim();
  try { if (authToken) localStorage.setItem("bn.token", authToken); else localStorage.removeItem("bn.token"); } catch {}
  showAuthState(); refreshList();
}
async function validateToken(token) {
  const r = await fetch("https://api.github.com/user", { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(r.status === 401 ? "GitHub rejected that token. Check it and try again." : `Couldn’t connect to GitHub (${r.status}).`);
  $("userLogin").textContent = (await r.json()).login;
}
$("signinBtn").addEventListener("click", async () => {
  const token = $("tokenInput").value.trim(); if (!token) return;
  $("authError").textContent = ""; $("signinBtn").disabled = true;
  try { await validateToken(token); $("tokenInput").value = ""; setAuth(token); status.textContent = "GitHub connected. Ready to publish."; }
  catch(error) { $("authError").textContent = error.message; }
  finally { $("signinBtn").disabled = false; }
});
$("signoutBtn").addEventListener("click", () => { setAuth(""); $("userLogin").textContent = ""; status.textContent = "Disconnected. Your drafts are still here."; });
for (const key of ["owner", "repo", "branch"]) $(key).addEventListener("change", () => {
  try { localStorage.setItem("bn." + key, $(key).value.trim()); } catch {}
  refreshList();
});
function setBusy(value) {
  busy = value; publishBtn.disabled = value; $("sheet").inert = value;
  for (const id of ["newBtn", "importBtn", "downloadBtn", "modeBtn", "connectBtn", "reloadBtn"]) $(id).disabled = value;
  $("drawer").inert = value;
}
publishBtn.addEventListener("click", async () => {
  await flush();
  if (!$("title").value.trim() || !$("dek").value.trim() || !markdown.trim()) { status.textContent = "Add a title, a short summary, and some writing first."; return; }
  const date = $("date").value, slug = $("slug").value.trim() || slugify($("title").value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) { status.textContent = "Choose a valid date."; return; }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) { status.textContent = "Use lowercase letters, numbers, and hyphens in the URL name."; return; }
  if (currentPath && currentRepo !== repoKey()) { status.textContent = "This article belongs to a different repository. Restore its connection settings before publishing."; connect(); return; }
  if (!authToken) { status.textContent = "Connect GitHub once to publish. Your draft is saved."; connect(); return; }
  setBusy(true); status.textContent = "Sending article to GitHub…";
  const title = $("title").value.trim(), branch = $("branch").value.trim() || "main";
  try {
    const path = currentPath || `blog/posts/${filename()}`;
    if (!currentPath) {
      const check = await api(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
      if (check.ok) throw new Error("An article already uses this URL. Open it from Existing articles, or choose a different URL name.");
      if (check.status !== 404) throw new Error(`Couldn’t check the article URL (${check.status}). Nothing was published.`);
    }
    const r = await api(`/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: `${currentSha ? "Edit" : "New"} post: ${title}`, content: b64encode(frontmatter(false) + markdown.trim() + "\n"), branch, ...(currentSha ? {sha: currentSha} : {}) }) });
    if (r.status === 409 || r.status === 422) throw new Error("GitHub couldn’t accept this version. Your draft is safe here. Use Load latest to check for changes; it keeps your current copy in My drafts.");
    if (!r.ok) throw new Error(`GitHub returned ${r.status}. Check that the token can write to this repository.`);
    const data = await r.json(); currentPath = path; currentSha = data.content.sha; currentRepo = repoKey();
    $("reloadBtn").hidden = false;
    drafts[activeId].publishedAt = Date.now(); saveDraft();
    const url = new URL(`/blog/${path.split("/").pop().replace(/\.md$/, "")}/`, "https://clpanic.com");
    $("publishedLink").href = url.href; $("publishedLink").hidden = false;
    status.textContent = "Sent to GitHub. The site is rebuilding."; refreshList();
  } catch (error) { status.textContent = error.message; }
  finally { setBusy(false); renderDrafts(); }
});

// Migrate the old single-draft editor without losing its last saved post.
if (!Object.keys(drafts).length) {
  try { const legacy = JSON.parse(stored("bn.draft", "null")); if (legacy) { activeId = newId(); drafts[activeId] = { ...legacy, id: activeId, repo: repoKey(), updatedAt: Date.now() }; } } catch {}
}
if (!drafts[activeId]) activeId = Object.keys(drafts)[0] || newId();
if (!drafts[activeId]) drafts[activeId] = { id: activeId, date: today(), repo: repoKey(), updatedAt: Date.now() };
await loadDraft(activeId); publishBtn.disabled = false; showAuthState();
if (authToken) {
  try { await validateToken(authToken); }
  catch (error) { status.textContent = error.message; setAuth(""); }
}
refreshList();
