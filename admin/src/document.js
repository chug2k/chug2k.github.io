import {
  BlockNoteEditor,
  BlockNoteSchema,
  createBlockSpec,
  defaultBlockSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import MarkdownIt from "markdown-it";
import { renderMarkdown } from "../../assets/markdown.mjs";

const excerptBreak = createBlockSpec(
  { type: "excerptBreak", propSchema: {}, content: "none" },
  {
    render() {
      const dom = document.createElement("div");
      dom.className = "excerpt-break";
      dom.textContent = "Excerpt ends here";
      dom.setAttribute("aria-label", "Excerpt break");
      return { dom };
    },
  },
)();
const preservedSource = createBlockSpec(
  {
    type: "preservedSource",
    propSchema: { source: { default: "" } },
    content: "none",
  },
  {
    render(block) {
      const dom = document.createElement("div");
      dom.className = "preserved-source";
      const label = document.createElement("strong");
      label.textContent = "Preserved Markdown";
      const hint = document.createElement("p");
      hint.textContent =
        "This section is kept exactly. Use Markdown to edit it.";
      const pre = document.createElement("pre");
      pre.textContent = block.props.source;
      dom.append(label, hint, pre);
      return { dom };
    },
  },
)();
const allowed = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
  "divider",
  "table",
  "image",
];
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...Object.fromEntries(allowed.map((k) => [k, defaultBlockSpecs[k]])),
    excerptBreak,
    preservedSource,
  },
  styleSpecs: Object.fromEntries(
    ["bold", "italic", "strike", "code"].map((k) => [k, defaultStyleSpecs[k]]),
  ),
});
export const createEditor = (options) =>
  BlockNoteEditor.create({
    ...options,
    schema,
    domAttributes: {
      editor: { "aria-label": "Article body", "aria-multiline": "true" },
    },
    initialContent: [{ type: "paragraph", content: "" }],
  });
let legacyConverter;
export async function legacyMarkdown(blocks) {
  legacyConverter ||= BlockNoteEditor.create();
  return legacyConverter.blocksToMarkdownLossy(blocks);
}
const parser = new MarkdownIt({ html: true });
const opaque = (source) => ({ type: "preservedSource", props: { source } });

// Compare the semantic article DOM, tolerating whitespace and list marker choice.
// A section that cannot survive the round trip stays opaque instead of being lost.
function comparable(source) {
  const root = document.createElement("div");
  root.innerHTML = renderMarkdown(source);
  for (const el of root.querySelectorAll("*")) {
    const tableAlignment = [...el.classList].find((c) =>
      /^table-align-(left|center|right)$/.test(c),
    );
    for (const attr of [...el.attributes])
      if (
        !["href", "src", "alt", "checked", "start", "style", "align"].includes(
          attr.name,
        )
      )
        el.removeAttribute(attr.name);
    if (tableAlignment && tableAlignment !== "table-align-left")
      el.setAttribute("data-column-alignment", tableAlignment);
  }
  const inline = {
    STRONG: "bold",
    B: "bold",
    EM: "italic",
    I: "italic",
    S: "strike",
    DEL: "strike",
    CODE: "code",
  };
  const walk = (n, context = {}) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = context.code
        ? n.textContent
        : n.textContent.replace(/\s+/g, " ");
      if (
        !text.trim() &&
        ["DIV", "UL", "OL", "TABLE", "THEAD", "TBODY", "TR"].includes(
          n.parentElement?.nodeName,
        )
      )
        return [];
      return [[text, Object.entries(context).sort()]];
    }
    if (inline[n.nodeName])
      return [...n.childNodes].flatMap((c) =>
        walk(c, { ...context, [inline[n.nodeName]]: true }),
      );
    if (n.nodeName === "A")
      return [...n.childNodes].flatMap((c) =>
        walk(c, { ...context, href: n.getAttribute("href") }),
      );
    const children = [...n.childNodes].flatMap((c) => walk(c, context));
    return [
      [
        n.nodeName,
        [...(n.attributes || [])].map((a) => [a.name, a.value]).sort(),
        children,
      ],
    ];
  };
  return JSON.stringify(walk(root));
}
export async function parseDocument(editor, source) {
  const env = {},
    lines = source.split("\n"),
    tokens = parser.parse(source, env),
    spans = [];
  for (const token of tokens)
    if (token.level === 0 && token.map) {
      const last = spans.at(-1);
      if (!last || token.map[0] >= last[1]) spans.push(token.map);
    }
  const result = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    const gap = lines.slice(cursor, start).join("\n");
    if (gap.trim()) result.push(opaque(gap));
    const part = lines.slice(start, end).join("\n");
    cursor = end;
    if (part.trim() === "<!--more-->") {
      result.push({ type: "excerptBreak" });
      continue;
    }
    if (env.references && part.includes("[") && !/^\s*(```|~~~)/.test(part)) {
      result.push(opaque(part));
      continue;
    }
    if (/^\s*</m.test(part) && !/^\s*(```|~~~)/.test(part)) {
      result.push(opaque(part));
      continue;
    }
    try {
      const blocks = await editor.tryParseMarkdownToBlocks(part);
      if (blocks.length === 1 && blocks[0].type === "table") {
        const dom = document.createElement("div");
        dom.innerHTML = renderMarkdown(part);
        const alignments = [...dom.querySelectorAll("thead th")].map((th) =>
          th.classList.contains("table-align-right")
            ? "right"
            : th.classList.contains("table-align-center")
              ? "center"
              : "left",
        );
        for (const row of blocks[0].content.rows)
          row.cells = row.cells.map((cell, i) => ({
            type: "tableCell",
            content: Array.isArray(cell) ? cell : cell.content,
            props: {
              backgroundColor: "default",
              textColor: "default",
              ...(cell.props || {}),
              textAlignment: alignments[i] || "left",
            },
          }));
      }
      const exported = await serializeDocument(editor, blocks);
      if (blocks.length && comparable(part) === comparable(exported))
        result.push(...blocks);
      else result.push(opaque(part));
    } catch {
      result.push(opaque(part));
    }
  }
  const tail = lines.slice(cursor).join("\n");
  if (tail.trim()) result.push(opaque(tail));
  return result.length ? result : [{ type: "paragraph", content: "" }];
}
export async function serializeDocument(editor, blocks) {
  const output = [],
    ordinary = [];
  async function flush() {
    if (ordinary.length) {
      output.push((await editor.blocksToMarkdownLossy(ordinary)).trimEnd());
      ordinary.length = 0;
    }
  }
  for (const block of blocks) {
    if (block.type === "excerptBreak" || block.type === "preservedSource") {
      await flush();
      output.push(
        block.type === "excerptBreak" ? "<!--more-->" : block.props.source,
      );
    } else if (block.type === "table") {
      await flush();
      const lines = (await editor.blocksToMarkdownLossy([block]))
        .trimEnd()
        .split("\n");
      const cells = block.content.rows[0]?.cells || [];
      if (lines.length > 1)
        lines[1] =
          "| " +
          cells
            .map((cell) =>
              cell.props?.textAlignment === "right"
                ? "---:"
                : cell.props?.textAlignment === "center"
                  ? ":---:"
                  : "---",
            )
            .join(" | ") +
          " |";
      output.push(lines.join("\n"));
    } else if (block.type === "image" && block.props.caption) {
      await flush();
      const copy = structuredClone(block);
      copy.props.caption = "";
      output.push((await editor.blocksToMarkdownLossy([copy])).trimEnd());
      // A plain caption paragraph is intentional and survives the public Markdown renderer.
      output.push(block.props.caption.replace(/[\\*_`[\]<>]/g, "\\$&"));
    } else ordinary.push(block);
  }
  await flush();
  return output.join("\n\n").trimEnd() + "\n";
}
export function legacyCompatible(blocks) {
  const inspect = (b) =>
    allowed.includes(b.type) &&
    !b.props?.isToggleable &&
    (!b.props?.textAlignment || b.props.textAlignment === "left") &&
    (!b.props?.textColor || b.props.textColor === "default") &&
    (!b.props?.backgroundColor || b.props.backgroundColor === "default") &&
    (Array.isArray(b.content)
      ? b.content.every(
          (i) =>
            !i.styles ||
            Object.keys(i.styles).every((s) =>
              ["bold", "italic", "strike", "code"].includes(s),
            ),
        )
      : true) &&
    (!b.children || b.children.every(inspect));
  return blocks?.every(inspect);
}
export function allImages(blocks) {
  return blocks.flatMap((b) => [
    ...(b.type === "image" ? [b] : []),
    ...allImages(b.children || []),
  ]);
}
export function splitFrontmatter(source) {
  const meta = {},
    m = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return [meta, source];
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i >= 0)
      meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return [meta, source.slice(m[0].length).replace(/^\r?\n/, "")];
}
