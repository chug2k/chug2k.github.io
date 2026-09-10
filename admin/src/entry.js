import React from "react";
import { createRoot } from "react-dom/client";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";

const $ = (id) => document.getElementById(id);
const status = $("status"), wordsEl = $("words"), publishBtn = $("publishBtn");

const enc = new TextEncoder(), dec = new TextDecoder();
const b64encode = (s) => {
  const b = enc.encode(s); let r = "";
  for (let i = 0; i < b.length; i += 0x8000) r += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(r);
};
const b64decode = (s) => dec.decode(Uint8Array.from(atob(s.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim().replace(/\s+/g, "-").slice(0, 60).replace(/-+$/, "");

/* ---------- GitHub sign-in (personal access token, stored in this browser) ----------
   Needs contents:read+write on the repo. Paste once per browser — you stay
   signed in until you sign out. Get one at
   github.com/settings/tokens (fine-grained, this repo only). */

const editor = BlockNoteEditor.create({ initialContent: [{ type: "paragraph", content: "" }] });
createRoot($("editor")).render(React.createElement(BlockNoteView, { editor, theme: "light", onChange }));

let currentPath = null;   // blog/posts/<file>.md when editing an existing post
let currentSha = null;
let markdown = "";
let authToken = "";

try { authToken = localStorage.getItem("bn.token") || ""; } catch (e) {}

$("date").value = today();
for (const k of ["owner", "repo", "branch"]) {
  const v = localStorage.getItem("bn." + k);
  if (v) $(k).value = v;
}

function autogrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
for (const el of [$("title"), $("dek")]) {
  el.addEventListener("input", () => { autogrow(el); saveDraft(); });
  autogrow(el);
}
$("slug").addEventListener("input", saveDraft);
$("date").addEventListener("input", saveDraft);
for (const k of ["owner", "repo", "branch"])
  $(k).addEventListener("change", () => {
    localStorage.setItem("bn." + k, $(k).value.trim());
    refreshList();
  });

async function onChange() {
  markdown = await editor.blocksToMarkdownLossy(editor.document);
  const words = markdown.split(/\s+/).filter(Boolean).length;
  wordsEl.textContent = words ? words + " words" : "";
  $("mdPreview").textContent = frontmatter() + markdown;
  saveDraft();
  status.textContent = "draft saved locally · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function saveDraft() {
  try {
    localStorage.setItem("bn.draft", JSON.stringify({
      title: $("title").value, dek: $("dek").value,
      date: $("date").value, slug: $("slug").value,
      blocks: editor.document, path: currentPath, sha: currentSha,
    }));
  } catch (e) {}
}

function restoreDraft() {
  try {
    const d = JSON.parse(localStorage.getItem("bn.draft") || "null");
    if (!d) return false;
    $("title").value = d.title || ""; $("dek").value = d.dek || "";
    $("date").value = d.date || today(); $("slug").value = d.slug || "";
    currentPath = d.path || null; currentSha = d.sha || null;
    if (d.blocks && d.blocks.length) editor.replaceBlocks(editor.document, d.blocks);
    for (const el of [$("title"), $("dek")]) autogrow(el);
    return true;
  } catch (e) { return false; }
}

function frontmatter() {
  const title = $("title").value.trim() || "Untitled";
  const date = $("date").value.trim() || today();
  const slug = $("slug").value.trim() || slugify(title);
  return `---\ntitle: ${title}\ndescription: ${$("dek").value.trim()}\ndate: ${date}\n---\n\n`;
}
const filename = () => {
  const date = $("date").value.trim() || today();
  const slug = $("slug").value.trim() || slugify($("title").value.trim() || "untitled");
  return `${date}-${slug}.md`;
};

const api = (path, opts = {}) => {
  const [owner, repo] = [$("owner").value.trim(), $("repo").value.trim()];
  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
};

async function refreshList() {
  const list = $("postlist");
  if (!authToken) { list.innerHTML = "<li class='d'>sign in with GitHub below to see posts</li>"; return; }
  const branch = $("branch").value.trim() || "main";
  const r = await api(`/contents/blog/posts?ref=${encodeURIComponent(branch)}`);
  if (!r.ok) { list.innerHTML = `<li class='d'>couldn't list posts (${r.status})</li>`; return; }
  const files = (await r.json()).filter((f) => f.name.endsWith(".md")).reverse();
  list.innerHTML = "";
  if (!files.length) list.innerHTML = "<li class='d'>no posts yet</li>";
  for (const f of files) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.className = "link"; b.type = "button"; b.textContent = f.name.replace(/\.md$/, "");
    b.addEventListener("click", () => openPost(f.path));
    const d = document.createElement("span"); d.className = "d";
    d.textContent = (f.name.match(/^\d{4}-\d{2}-\d{2}/) || [""])[0];
    li.append(b, d); list.append(li);
  }
}

function splitFrontmatter(text) {
  const meta = {};
  let body = text;
  if (text.startsWith("---")) {
    const end = text.indexOf("---", 3);
    if (end !== -1) {
      for (const line of text.slice(3, end).trim().split("\n")) {
        const i = line.indexOf(":");
        if (i !== -1) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      body = text.slice(end + 3).replace(/^\n+/, "");
    }
  }
  return [meta, body];
}

async function openPost(path) {
  status.textContent = "loading…";
  const r = await api(`/contents/${path}?ref=${encodeURIComponent($("branch").value.trim() || "main")}`);
  if (!r.ok) { status.textContent = `load failed (${r.status})`; return; }
  const data = await r.json();
  const [meta, body] = splitFrontmatter(b64decode(data.content));
  const m = path.match(/blog\/posts\/(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  $("title").value = meta.title || "";
  $("dek").value = meta.description || "";
  $("date").value = meta.date || (m ? m[1] : today());
  $("slug").value = (m ? m[2] : "");
  currentPath = path; currentSha = data.sha;
  try {
    const blocks = await editor.tryParseMarkdownToBlocks(body);
    editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph", content: "" }]);
  } catch (e) {
    editor.replaceBlocks(editor.document, [{ type: "paragraph", content: "Couldn't parse post body — see Markdown preview." }]);
  }
  for (const el of [$("title"), $("dek")]) autogrow(el);
  await onChange();
  status.textContent = "editing " + path.split("/").pop();
  window.scrollTo({ top: 0 });
}

$("newBtn").addEventListener("click", () => {
  $("title").value = ""; $("dek").value = "";
  $("date").value = today(); $("slug").value = "";
  currentPath = null; currentSha = null;
  editor.replaceBlocks(editor.document, [{ type: "paragraph", content: "" }]);
  onChange();
  $("title").focus();
});

publishBtn.addEventListener("click", async () => {
  const title = $("title").value.trim();
  if (!title || !editor.document.length) { status.textContent = "needs a title and some words first"; return; }
  if (!authToken) { status.textContent = "sign in with GitHub below first"; return; }
  publishBtn.disabled = true;
  status.textContent = "publishing…";
  try {
    const branch = $("branch").value.trim() || "main";
    const md = frontmatter() + (await editor.blocksToMarkdownLossy(editor.document)).trim() + "\n";
    let path = currentPath || `blog/posts/${filename()}`;
    let sha = currentSha;
    if (!sha) {
      const check = await api(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
      if (check.ok) sha = (await check.json()).sha;
    }
    const r = await api(`/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `${sha ? "Edit" : "New"} post: ${title}`, content: b64encode(md), branch, ...(sha ? { sha } : {}),
      }),
    });
    if (!r.ok) throw new Error(`GitHub said ${r.status}: ${(await r.text()).slice(0, 200)}`);
    // Renamed file? delete the old one.
    if (currentPath && currentPath !== path) {
      await api(`/contents/${currentPath}`, {
        method: "DELETE",
        body: JSON.stringify({ message: `Rename post to ${path}`, sha: currentSha, branch }),
      });
    }
    currentPath = path;
    currentSha = (await r.json()).content.sha;
    localStorage.removeItem("bn.draft");
    status.textContent = "published — live in a minute or two ✓";
    refreshList();
  } catch (e) {
    status.textContent = "publish failed: " + e.message;
  }
  publishBtn.disabled = false;
});

$("editor").addEventListener("click", () => editor.focus());

/* ---------- GitHub sign-in ---------- */

function showAuthState(state) {
  // state: "out" | "in"
  $("signedOut").hidden = state !== "out";
  $("signedIn").hidden = state !== "in";
}

function setAuth(token) {
  authToken = (token || "").trim();
  try {
    if (authToken) localStorage.setItem("bn.token", authToken);
    else localStorage.removeItem("bn.token");
  } catch (e) {}
  if (authToken) { showAuthState("in"); refreshList(); }
  else {
    showAuthState("out");
    $("userLogin").textContent = "";
    refreshList();
  }
}

async function validateStoredToken() {
  if (!authToken) { showAuthState("out"); refreshList(); return; }
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${authToken}` },
    });
    if (!r.ok) throw new Error(String(r.status));
    $("userLogin").textContent = (await r.json()).login;
    showAuthState("in");
  } catch (e) {
    setAuth(""); // dead token — back to sign-in
    status.textContent = "that token didn't work — sign in again";
    return;
  }
  refreshList();
}

$("signinBtn").addEventListener("click", async () => {
  const token = $("tokenInput").value.trim();
  if (!token) return;
  $("authError").textContent = "";
  $("signinBtn").disabled = true;
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(r.status === 401 ? "GitHub rejected that token (401)" : `GitHub said ${r.status}`);
    $("userLogin").textContent = (await r.json()).login;
    $("tokenInput").value = "";
    setAuth(token);
    status.textContent = "signed in ✓";
  } catch (e) {
    $("authError").textContent = "Sign-in failed: " + e.message;
  }
  $("signinBtn").disabled = false;
});

$("signoutBtn").addEventListener("click", () => {
  setAuth("");
  status.textContent = "signed out";
});

restoreDraft();
await onChange();
publishBtn.disabled = false;
status.textContent = "ready";
validateStoredToken();
