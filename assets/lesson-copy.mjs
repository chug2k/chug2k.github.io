import { renderMarkdown, renderInline } from "./markdown.mjs?v=lesson-inline-1";

export const lessonSlug = "2026-11-25-what-is-an-agent";
export const lessonPath = "blog/posts/" + lessonSlug + ".md";
export const templateUrl = "/assets/lessons/what-is-an-agent.template.txt";
const marker = /^<!-- passage: ([a-z0-9-]+) -->[ \t]*\r?$/gm;
const slot = /<!--copy:([a-z0-9-]+):(flow|inline):([0-9a-f]{20})-->([\s\S]*?)<!--\/copy-->/g;
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]);

export function readPassages(body) {
  const entries = [...body.matchAll(marker)];
  if (!entries.length || body.slice(0, entries[0].index).trim())
    throw new Error("The lesson manuscript could not be read.");
  const passages = new Map();
  for (const [i, entry] of entries.entries()) {
    if (passages.has(entry[1])) throw new Error("Repeated lesson passage: " + entry[1]);
    passages.set(entry[1], body.slice(entry.index + entry[0].length, entries[i+1]?.index ?? body.length).trim());
  }
  return passages;
}

export function writePassages(passages) {
  return [...passages].map(([key, value]) => "<!-- passage: " + key + " -->\n" + value)
    .join("\n\n") + "\n";
}

async function fingerprint(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash).slice(0, 10), (n) => n.toString(16).padStart(2, "0")).join("");
}

// Only the trusted template supplies markup for the interactive exercises.
// Authored prose is rendered by the same HTML-escaping Markdown engine as other posts.
export async function renderLesson(template, post, { editing = false } = {}) {
  const passages = readPassages(post.body);
  const slots = [...template.matchAll(slot)];
  const keys = new Set(slots.map((m) => m[1]));
  if (slots.length !== keys.size || keys.size !== passages.size || [...keys].some((k) => !passages.has(k)))
    throw new Error("This manuscript and lesson layout have different passages. Reload the latest lesson before publishing.");
  const contents = await Promise.all(slots.map(async ([, key, kind, originalHash, original]) => {
    const value = passages.get(key);
    // Keep the original typography, attribution markup and line breaks until a passage is edited.
    let markup = original;
    if (await fingerprint(value) !== originalHash)
      markup = (kind === "flow" ? renderMarkdown(value) : renderInline(value)).trimEnd();
    if (!editing) return markup;
    const tag = kind === "flow" ? "div" : "span";
    return `<${tag} data-passage="${key}" data-kind="${kind}">${markup}</${tag}>`;
  }));
  const metadata = { TITLE: post.title, DESCRIPTION: post.description, REVISION: post.source_sha256 || "" };
  let index = 0;
  return template.replace(/\{\{LESSON_(TITLE|DESCRIPTION|REVISION)\}\}/g, (_, key) => escape(metadata[key]))
    .replace(slot, () => contents[index++]);
}
