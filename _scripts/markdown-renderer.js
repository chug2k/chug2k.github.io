// The browser preview and static build share this renderer and article template.
import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import postTemplate from "../blog/_template.html";
export const articleTemplate = postTemplate;

const md = new MarkdownIt({ html: false, linkify: false, typographer: false }).use(taskLists);
const escape = value => md.utils.escapeHtml(String(value ?? ""));

md.core.ruler.after("inline", "article-semantics", state => {
  let section = "Article";
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (token.type === "heading_open") section = state.tokens[i + 1]?.content || "Article";
    if (token.type === "heading_open" || token.type === "heading_close") {
      token.tag = `h${Math.min(6, Number(token.tag.slice(1)) + 1)}`;
    }
    if (token.type === "table_open") token.meta = { label: `${section} table` };
    if (token.type === "th_open" || token.type === "td_open") {
      const align = token.attrGet("style")?.match(/text-align:(left|right|center)/)?.[1] || "left";
      token.attrs = (token.attrs || []).filter(([name]) => name !== "style");
      if (token.type === "th_open") token.attrSet("scope", "col");
      token.attrSet("class", `table-align-${align}`);
    }
  }
});

md.renderer.rules.table_open = (tokens, idx) =>
  `<div class="table-scroll" role="region" aria-label="${escape(tokens[idx].meta.label)}" tabindex="0">\n<table>\n`;
md.renderer.rules.table_close = () =>
  '</table>\n</div>\n<p class="table-hint">Scroll sideways to compare all columns.</p>\n';
const imageRule = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, ...args) => {
  tokens[idx].attrSet("loading", "lazy");
  return imageRule(tokens, idx, ...args);
};

// Excerpt markers are authoring blocks. A marker inside a code example is text.
function excerptParts(source) {
  const sections = [[]];
  let fence = null;
  for (const line of String(source || "").split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    }
    if (!fence && /^ {0,3}<!--more-->[ \t]*$/.test(line)) sections.push([]);
    else sections.at(-1).push(line);
  }
  return sections.map(lines => lines.join("\n"));
}

export function renderMarkdown(body) {
  return md.render(excerptParts(body).join("\n\n"));
}

export function renderExcerpt(body) {
  const parts = excerptParts(body);
  if (parts.length > 1) return md.render(parts[0]);
  // Only top-level prose contributes to the automatic homepage excerpt.
  const tokens = md.parse(String(body || ""), {}), paragraphs = [];
  let words = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "paragraph_open" || tokens[i].level !== 0) continue;
    const inline = tokens[i + 1];
    if (inline?.children?.some(token => token.type === "image")) continue;
    const paragraph = md.renderer.render(tokens.slice(i, i + 3), md.options, {});
    paragraphs.push(paragraph);
    words += (inline?.content.trim().match(/\S+/g) || []).length;
    if (words >= 120 || paragraphs.length === 4) break;
  }
  return paragraphs.join("");
}

export function renderPost({ title = "Untitled", description = "", date = "", body = "", url = "/blog/preview/" } = {}) {
  const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  const displayDate = when && Number.isFinite(when.getTime())
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(when)
    : date;
  const values = {
    TITLE: escape(title), DESCRIPTION: escape(description), SLUG: escape(url.split("/").filter(Boolean).at(-1)),
    DATE_ISO: escape(date), DATE_DISPLAY: escape(displayDate),
    READ_TIME: `${Math.max(1, Math.ceil((body.match(/\S+/g) || []).length / 200))} min`,
    CONTENT: renderMarkdown(body).trimEnd(),
  };
  return postTemplate.replace(/\{\{([A-Z_]+)\}\}/g, (token, key) => values[key] ?? token);
}

export function renderPreviewDocument({ baseUrl = "https://clpanic.com/", theme = "light", ...post } = {}) {
  const base = new URL(baseUrl);
  if (!["https:", "http:"].includes(base.protocol)) throw new Error("Preview requires an HTTP site URL.");
  return `<!doctype html>
<html lang="en" data-theme="${theme === "dark" ? "dark" : "light"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><base href="${escape(base.href)}">
<title>${escape(post.title || "Article preview")}</title><link rel="stylesheet" href="/assets/site.css">
</head><body><div class="site-shell"><main>${renderPost(post)}</main></div></body></html>`;
}
