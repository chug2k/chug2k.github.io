"use strict";

const scenes = {
  radio: "Tess was proud of the radio she had fixed. When the customer reached for it, she wanted him to hear it play. He left the shop with the radio under his arm.",
  concert: "The chairs had been stacked after the concert. Lin felt sad that her sister was leaving the orchestra. She helped her sister carry the cello out to the car.",
  own: ""
};
const get = id => document.getElementById(id);
const fields = ["before", "revision", "inference", "clue"];
const prefix = "clpanic.revision-desk.1.";
const memory = new Map();
let persistent = true;
let scene;

function read(key) {
  if (persistent) {
    try { return localStorage.getItem(prefix + key); }
    catch { persistent = false; }
  }
  return memory.get(key) ?? null;
}

function write(key, value) {
  memory.set(key, value);
  if (persistent) {
    try { localStorage.setItem(prefix + key, value); }
    catch { persistent = false; }
  }
}

function saveMessage() {
  get("saved").textContent = persistent
    ? "Saved in this browser"
    : "Kept in this tab. Download your drafts to keep a copy.";
}

function controls() {
  get("copy").hidden = !get("before").value.trim() || !!get("revision").value.trim();
}

function openScene(next) {
  scene = Object.hasOwn(scenes, next) ? next : "radio";
  get("scene").value = scene;
  get("before").readOnly = scene !== "own";
  get("before").placeholder = scene === "own" ? "Paste the scene you want to revise." : "";
  for (const id of fields) {
    const key = scene + "." + id;
    const value = id === "before" && scene !== "own" ? scenes[scene] : read(key) ?? "";
    get(id).value = value;
    memory.set(key, value);
  }
  get("feedback").replaceChildren();
  write("active", scene);
  controls();
  if (persistent) get("saved").textContent = "Saves as you type";
  else saveMessage();
}

function storeField(id) {
  write(scene + "." + id, get(id).value);
  get("feedback").replaceChildren();
  controls();
  saveMessage();
}

get("scene").addEventListener("change", () => openScene(get("scene").value));
for (const id of fields) {
  get(id).addEventListener("input", () => storeField(id));
  get(id).addEventListener("blur", () => {
    if (id === "before" && scene !== "own") return;
    const saved = read(scene + "." + id);
    if (saved !== null && saved !== get(id).value) {
      get(id).value = saved;
      get("feedback").replaceChildren();
      controls();
    }
  });
}
// Separate field keys let two tabs save different parts of the same scene.
window.addEventListener("storage", event => {
  const key = prefix + scene + ".";
  if (!event.key?.startsWith(key)) return;
  const id = event.key.slice(key.length);
  if (!fields.includes(id) || (id === "before" && scene !== "own")) return;
  memory.set(scene + "." + id, event.newValue ?? "");
  if (document.activeElement !== get(id)) {
    get(id).value = event.newValue ?? "";
    get("feedback").replaceChildren();
    controls();
  }
});

get("copy").addEventListener("click", () => {
  get("revision").value = get("before").value;
  storeField("revision");
  get("revision").focus();
});

get("quote").addEventListener("click", () => {
  const field = get("revision");
  const selected = field.value.slice(field.selectionStart, field.selectionEnd).trim();
  if (selected) {
    get("clue").value = selected;
    storeField("clue");
    get("clue").focus();
  } else {
    get("feedback").textContent = "Select the words in your revision first, or type them into the clue field.";
    field.focus();
  }
});

get("check").addEventListener("click", () => {
  const before = get("before").value.trim(), revision = get("revision").value.trim();
  const idea = get("inference").value.trim(), clue = get("clue").value.trim();
  const message = get("feedback");
  if (!before) message.textContent = "Add the original scene so you can compare the two versions.";
  else if (!revision || revision.replace(/\s+/gu, " ") === before.replace(/\s+/gu, " "))
    message.textContent = "Change a line in the revision. Give the character something to do in that final moment.";
  else if (!idea) message.textContent = "Write what a stranger might infer from your revision.";
  else if (!clue || !revision.includes(clue))
    message.textContent = "Choose exact words from the revised passage. You can select the phrase and use the button above.";
  else {
    const mark = document.createElement("mark");
    mark.textContent = clue;
    message.replaceChildren("The revision contains “", mark, "”. You read it as “", idea,
                            "”. What else could another reader make of those words?");
  }
});

get("download").addEventListener("click", () => {
  const title = get("scene").selectedOptions[0].text;
  const text = [title, "First draft", get("before").value, "Revision", get("revision").value,
    "What a reader might infer", get("inference").value, "Words that give the clue", get("clue").value].join("\n\n") + "\n";
  const url = URL.createObjectURL(new Blob([text], {type: "text/plain;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = "revision-" + scene + ".txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
});

if (location.protocol === "file:") document.querySelector("footer a").hidden = true;
openScene(read("active"));
