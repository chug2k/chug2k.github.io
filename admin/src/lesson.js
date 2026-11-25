import { readPassages, writePassages, renderLesson, templateUrl } from "../../assets/lesson-copy.mjs";

let templatePromise;
function template() {
  if (!templatePromise) {
    templatePromise = fetch(templateUrl, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load the lesson layout. Reopen the lesson to retry.");
        return r.text();
      })
      .catch((error) => { templatePromise = null; throw error; });
  }
  return templatePromise;
}

const editStyles = [
  ".reveal{opacity:1!important;transform:none!important;transition:none!important}",
  "[data-passage]{outline:1px solid transparent;outline-offset:3px;border-radius:2px;cursor:text}",
  "[data-passage]:hover{outline-color:#b9a78d}",
  "[data-passage]:focus{outline:2px solid #ac492d;background:#fffcf5}",
  "[data-passage]:empty::after{content:'\\00a0'}",
  "[data-passage][data-kind=flow]{min-height:1em}",
  "html{scroll-behavior:auto!important}",
].join("\n");

// Only formatting is exported. Pasted markup, element attributes and scripts
// never become part of an authored passage.
function plain(value) {
  return value.replace(/\u00a0/g, " ").replace(/([\\\x60*_[\]<>~|&#!])/g, "\\$1")
    .replace(/(^|\n)(\s*)([-+>]|\d+[.)])(?=\s)/g, (_, line, space, mark) =>
      line + space + mark.replace(/.$/, (c) => "\\" + c));
}
function mark(value, delimiter) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return value.slice(0, value.indexOf(trimmed)) + delimiter + trimmed + delimiter + value.slice(value.indexOf(trimmed) + trimmed.length);
}
function markdownOf(node, flow) {
  if (node.nodeType === Node.TEXT_NODE) return plain(node.nodeValue);
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.localName;
  if (tag === "br") return "\\\n";
  if (tag === "code") {
    const value = node.textContent;
    const longest = Math.max(0, ...(value.match(/\x60+/g) || []).map((m) => m.length));
    const fence = String.fromCharCode(96).repeat(longest + 1);
    const pad = longest || /^\s|\s$/.test(value) ? " " : "";
    return fence + pad + value + pad + fence;
  }
  let value = [...node.childNodes].map((child) => markdownOf(child, flow)).join("");
  if (tag === "strong" || tag === "b" || /^(bold|[7-9]00)$/.test(node.style?.fontWeight)) value = mark(value, "**");
  if (tag === "em" || tag === "i" || node.style?.fontStyle === "italic") value = mark(value, "*");
  if (tag === "a") {
    const href = node.getAttribute("href") || "";
    if (/^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(href))
      value = "[" + value + "](<" + href.replace(/[<>\s\\]/g, (c) => encodeURIComponent(c)) + ">)";
  }
  if (["p", "div", "li"].includes(tag)) {
    const sep = flow ? "\n\n" : "\\\n";
    return sep + value + sep;
  }
  return value;
}

export async function lessonMarkup(draft, editing = false) {
  return renderLesson(await template(), {
    body: draft.markdown, title: draft.title, description: draft.dek,
  }, { editing });
}

// This canvas keeps the public lesson's typography. In editing mode scripts
// are absent and each authored passage gets its own native editing host.
export async function prepareLesson(draft, onChange) {
  const markup = await lessonMarkup(draft, true);
  const doc = new DOMParser().parseFromString(markup, "text/html");
  doc.querySelectorAll("script, iframe, object, embed, video, link[rel=preconnect]").forEach((el) => el.remove());
  doc.querySelectorAll("button, input, select, textarea").forEach((el) => { el.disabled = true; });
  doc.querySelectorAll("[data-passage]").forEach((el) => {
    el.contentEditable = "true";
    el.spellcheck = true;
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-multiline", "true");
    el.setAttribute("aria-label", el.textContent.trim().slice(0, 72) || "Lesson passage");
  });
  const style = doc.createElement("style");
  style.textContent = editStyles;
  doc.head.append(style);
  const passages = readPassages(draft.markdown);
  return (frame, navigation, formatButtons) => {
    const fieldOf = (node) => (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest("[data-passage]");
    formatButtons.forEach((button) => { button.disabled = true; });
    navigation.disabled = true;
    frame.onload = () => {
      const page = frame.contentDocument;
      if (!page?.querySelector("[data-passage]")) return;
      const sections = [...page.querySelectorAll("header.masthead, section.reveal, body > footer")];
      const heading = (section, index) => section.querySelector("h2")?.textContent.trim() ||
        (index === 0 ? "Opening" : "Closing");
      navigation.replaceChildren(...sections.map((section, i) => new Option(heading(section, i), String(i))));
      navigation.disabled = false;
      navigation.onchange = () => {
        const section = sections[Number(navigation.value)];
        section.scrollIntoView({ block: "start" });
        section.querySelector("[data-passage]")?.focus({ preventScroll: true });
      };
      function write(field) {
        const flow = field.dataset.kind === "flow";
        const text = [...field.childNodes].map((child) => markdownOf(child, flow)).join("")
          .replace(/\n{3,}/g, "\n\n").trim();
        if (passages.get(field.dataset.passage) === text) return;
        passages.set(field.dataset.passage, text);
        field.setAttribute("aria-label", field.textContent.trim().slice(0, 72) || "Lesson passage");
        onChange(writePassages(passages));
      }
      page.addEventListener("input", (event) => {
        const field = fieldOf(event.target);
        if (field) write(field);
      });
      page.addEventListener("beforeinput", (event) => {
        if (event.inputType === "insertParagraph" && fieldOf(event.target)?.dataset.kind === "inline") {
          event.preventDefault();
          page.execCommand("insertLineBreak");
        }
      });
      page.addEventListener("paste", (event) => {
        if (!fieldOf(event.target)) return;
        event.preventDefault();
        page.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      });
      page.addEventListener("drop", (event) => event.preventDefault());
      page.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link) return;
        event.preventDefault();
        const href = link.getAttribute("href");
        if (href?.startsWith("#") && !fieldOf(link)) page.getElementById(href.slice(1))?.scrollIntoView();
      });
      let range;
      page.addEventListener("selectionchange", () => {
        const selection = page.getSelection();
        if (!selection?.rangeCount) return;
        const candidate = selection.getRangeAt(0);
        const field = fieldOf(candidate.commonAncestorContainer);
        if (field) range = candidate.cloneRange();
        formatButtons.forEach((button) => { button.disabled = !field; });
      });
      for (const button of formatButtons) {
        button.onpointerdown = (event) => event.preventDefault();
        button.onclick = () => {
          if (!range || !fieldOf(range.commonAncestorContainer)) return;
          frame.contentWindow.focus();
          const selection = page.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          page.execCommand(button.dataset.format);
        };
      }
    };
    frame.srcdoc = "<!doctype html>" + doc.documentElement.outerHTML;
  };
}
