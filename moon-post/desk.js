"use strict";

const byId = id => document.getElementById(id);
const storeKey = "charles-moon-post/" + MOON.edition;
const debriefs = [
  "A uses the clerk’s voice with a 0.54-second break after “door.” B uses a different voice in one pass. Both deliver all eight words.",
  "Both readings score one edit. In A, “fairy” first appears in Whisper’s transcript. In B, the instruction to use the noon ferry was already in the script.",
  "These readings use the same voice at different speeds. Whisper writes “right” for “write” in both. Only B asks for a blue return label."
];
let sheet = blankSheet();
let localSaving = true;
let startingNote = "";
try {
  const stored = localStorage.getItem(storeKey);
  if (stored) sheet = restoreSheet(stored);
} catch (error) {
  startingNote = "The saved session could not be loaded. You can restore a downloaded answer file.";
}

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function saveLocal() {
  try {
    localStorage.setItem(storeKey, JSON.stringify(sheet));
    localSaving = true;
  } catch (error) {
    localSaving = false;
  }
  byId("save-status").textContent = localSaving ? "Saved in this browser. Take a JSON copy to keep or move your answers." :
    "Browser storage is unavailable here. Save an answer file to keep your work.";
}

function player(clip, label, onComplete) {
  const box = node("div", undefined, "player");
  const audio = node("audio");
  audio.id = "audio-" + clip.id;
  audio.preload = "metadata";
  audio.src = "audio/" + clip.id + ".wav";
  audio.setAttribute("aria-label", label + " recording");
  const toggle = node("button", undefined, "play");
  toggle.type = "button";
  toggle.dataset.play = clip.id;
  const icon = node("span", undefined, "playicon");
  icon.setAttribute("aria-hidden", "true");
  toggle.append(icon);
  const wave = node("div", undefined, "signal");
  const bars = clip.waveform.map(value => {
    const bar = node("i");
    bar.setAttribute("aria-hidden", "true");
    bar.style.height = Math.max(2, value / 3.1) + "px";
    wave.append(bar);
    return bar;
  });
  const seek = node("input");
  seek.type = "range";
  seek.min = "0";
  seek.max = String(clip.seconds);
  seek.step = "0.05";
  seek.value = "0";
  seek.setAttribute("aria-label", "Seek within " + label);
  seek.addEventListener("input", () => {
    if (audio.readyState >= 1) audio.currentTime = Number(seek.value);
  });
  wave.append(seek);
  const clock = node("span", undefined, "duration");
  clock.setAttribute("aria-hidden", "true");
  const message = node("p", undefined, "status");
  message.setAttribute("role", "status");
  function refresh() {
    const playing = !audio.paused && !audio.ended;
    const current = audio.currentTime || 0;
    toggle.dataset.playing = String(playing);
    const action = playing ? "Pause" : audio.ended ? "Replay" : "Play";
    toggle.setAttribute("aria-label", action + " " + label);
    toggle.title = action + " " + label;
    seek.value = String(current);
    seek.setAttribute("aria-valuetext", current.toFixed(1) + " of " + clip.seconds.toFixed(1) + " seconds");
    clock.textContent = current ? current.toFixed(1) + " / " + clip.seconds.toFixed(1) + "s" : clip.seconds.toFixed(1) + "s";
    bars.forEach((bar, i) => bar.classList.toggle("past", i / bars.length < current / clip.seconds));
  }
  toggle.addEventListener("click", async () => {
    if (!audio.paused) { audio.pause(); return; }
    try {
      message.textContent = "";
      if (audio.ended) audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      audio.controls = true;
      message.textContent = "Try the browser’s audio controls to play this file.";
    }
  });
  audio.addEventListener("ended", () => {
    let coverage = 0;
    for (let i = 0; i < audio.played.length; i++) coverage += audio.played.end(i) - audio.played.start(i);
    if (coverage >= clip.seconds - 0.18) onComplete();
    else message.textContent = "Play this clip from the beginning to finish the first listen.";
    refresh();
  });
  for (const event of ["play", "pause", "loadedmetadata", "timeupdate", "seeked"]) audio.addEventListener(event, refresh);
  audio.addEventListener("error", () => { message.textContent = "This audio file could not be opened. Keep the audio folder beside index.html."; });
  refresh();
  box.append(toggle, wave, clock, audio);
  const group = node("div");
  group.append(box, message);
  return group;
}

function renderReference() {
  const area = byId("reference-player");
  area.querySelector("audio")?.pause();
  area.replaceChildren(player(MOON.reference, "reference voice", () => {
    sheet.referencePlayed = true;
    update();
    saveLocal();
  }));
  byId("reference-text").querySelector("p").textContent = sheet.referencePlayed ? MOON.reference.script : "";
}

function scoreScale(axis, reading, frozen) {
  const field = node("fieldset", undefined, "scale-block");
  const groupId = reading.id + "-" + axis.key;
  const legend = node("legend", axis.label + " for Reading " + reading.id.slice(-1).toUpperCase(), "sr-only");
  const description = node("div");
  description.append(node("strong", axis.label), node("span", axis.anchors, "anchor"));
  const options = node("div", undefined, "scores");
  for (let n = 1; n <= 5; n++) {
    const input = node("input");
    input.type = "radio";
    input.id = groupId + "-" + n;
    input.name = groupId;
    input.value = String(n);
    input.checked = reading[axis.key] === n;
    input.disabled = frozen;
    input.setAttribute("aria-label", String(n) + " of 5 for " + axis.label.toLowerCase());
    input.addEventListener("change", () => {
      reading[axis.key] = n;
      update();
      saveLocal();
    });
    const label = node("label");
    label.append(input, node("span", String(n)));
    options.append(label);
  }
  field.append(legend, description, options);
  return field;
}

function readingCard(clip, answer, j, frozen) {
  const card = node("article", undefined, "reading");
  const name = "Reading " + LETTERS[j];
  card.setAttribute("aria-label", name);
  const head = node("div", undefined, "reading-head");
  const mark = node("span", LETTERS[j], "letter");
  mark.setAttribute("aria-hidden", "true");
  const tag = node("span", answer.played ? "Played" : "", "status-tag");
  tag.id = "tag-" + clip.id;
  head.append(mark, node("h3", name), tag);
  const note = node("details", undefined, "ear-note");
  if (answer.heard) note.open = true;
  const summary = node("summary", "Write what you heard (optional)");
  const label = node("label", "Your first transcription");
  const field = node("input");
  field.type = "text";
  field.id = "heard-" + clip.id;
  field.maxLength = 250;
  field.autocomplete = "off";
  field.value = answer.heard;
  field.readOnly = frozen;
  label.htmlFor = field.id;
  field.addEventListener("input", () => { answer.heard = field.value; saveLocal(); });
  note.append(summary, label, field);
  card.append(head, player(clip, name, () => {
    answer.played = true;
    tag.textContent = "Played";
    update();
    saveLocal();
  }), ...RUBRIC.map(axis => scoreScale(axis, answer, frozen)), note);
  return card;
}

function addTerm(list, term, value) {
  list.append(node("dt", term), node("dd", value));
}

function editsRow(title, score) {
  const p = node("p", undefined, "diff-line");
  p.append(node("strong", title));
  if (!score.changes.length) p.append(document.createTextNode("All words match."));
  else score.changes.forEach(change => p.append(node("span", describeEdit(change), "change")));
  return p;
}

function resultCard(clip, answer, round, j) {
  const article = node("article", undefined, "result");
  article.append(node("h4", "Reading " + LETTERS[j]),
    node("p", "Your ratings · Naturalness " + answer.naturalness + "/5 · Voice similarity " + answer.similarity + "/5", "metric"));
  const list = node("dl");
  addTerm(list, "Synthesis script", clip.script);
  addTerm(list, "Whisper transcript", clip.whisper);
  article.append(list, editsRow("Order to script", clip.order_to_script),
    editsRow("Transcription WER · " + scoreText(clip.script_to_whisper), clip.script_to_whisper),
    node("p", "Dispatch WER (order to Whisper) · " + scoreText(clip.order_to_whisper), "metric"));
  if (answer.heard.trim()) {
    const yours = node("p", undefined, "diff-line");
    yours.append(node("strong", "Your first transcription"), document.createTextNode(answer.heard));
    article.append(yours, node("p", "Your WER " + scoreText(learnerScore(round.target, answer.heard)), "metric"));
  }
  return article;
}

function renderEnclosure() {
  const answer = sheet.rounds[sheet.active], round = MOON.rounds[sheet.active];
  byId("enclosure").hidden = !answer.open;
  byId("written-title").textContent = answer.open ? round.target : "";
  byId("results").replaceChildren();
  byId("choices").replaceChildren();
  byId("reason").value = answer.reason;
  byId("debrief").textContent = "";
  if (!answer.open) return;
  byId("results").append(...round.readings.map((clip, j) => resultCard(clip, answer.readings[j], round, j)));
  byId("debrief").textContent = debriefs[sheet.active];
  byId("decision-question").textContent = round.question;
  byId("choices").className = "options";
  for (const choice of CHOICES) {
    const option = node("input");
    option.type = "radio";
    option.name = "dispatch-choice";
    option.value = choice;
    option.checked = answer.choice === choice;
    option.addEventListener("change", () => { answer.choice = choice; update(); saveLocal(); });
    const label = node("label");
    label.append(option, node("span", choice));
    byId("choices").append(label);
  }
}

function update() {
  const answer = sheet.rounds[sheet.active];
  const played = Number(sheet.referencePlayed) + answer.readings.filter(r => r.played).length;
  const scores = answer.readings.reduce((n, r) => n + Number(!!r.naturalness) + Number(!!r.similarity), 0);
  byId("reveal").disabled = !readyToOpen(answer, sheet.referencePlayed);
  byId("reveal").textContent = answer.open ? "Review the dispatch" : "Open the dispatch";
  byId("gate").textContent = answer.open ? "First-listen scores filed." : played === 3 && scores === 4 ?
    "Ready. Open the written order." : played + "/3 clips heard · " + scores + "/4 scores. Hear the reference and both readings to the end.";
  byId("reference-text").hidden = !sheet.referencePlayed;
  if (sheet.referencePlayed) byId("reference-text").querySelector("p").textContent = MOON.reference.script;
  byId("next").disabled = !filed(answer);
  byId("next").textContent = sheet.active === MOON.rounds.length - 1 ? "See my worksheet" : "Next dispatch";
  byId("decision-status").textContent = filed(answer) ? "Decision saved." : "Choose a reading and add a reason.";
  const done = sheet.rounds.filter(filed).length;
  byId("progress").textContent = done + " of " + MOON.rounds.length + " dispatches filed.";
  byId("report").disabled = !sheet.rounds.every(filed);
  for (const [i, button] of Array.from(byId("round-nav").children).entries()) {
    const complete = filed(sheet.rounds[i]);
    button.dataset.done = String(complete);
    button.setAttribute("aria-label", "Dispatch " + (i + 1) + ", " + MOON.rounds[i].title + (complete ? ", filed" : ""));
    if (sheet.active === i) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
}

function renderRound() {
  document.querySelectorAll("audio").forEach(audio => audio.pause());
  const round = MOON.rounds[sheet.active], answer = sheet.rounds[sheet.active];
  byId("round-count").textContent = "Dispatch 0" + (sheet.active + 1) + " of 0" + MOON.rounds.length;
  byId("dispatch-title").textContent = round.title;
  byId("readings").replaceChildren(...round.readings.map((clip, j) => readingCard(clip, answer.readings[j], j, answer.open)));
  renderEnclosure();
  update();
}

function visitRound(index) {
  sheet.active = index;
  renderRound();
  saveLocal();
  byId("dispatch-title").focus();
}

function exportFile(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], {type}));
  const link = node("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

for (const [index] of MOON.rounds.entries()) {
  const button = node("button", String(index + 1));
  button.type = "button";
  button.addEventListener("click", () => visitRound(index));
  byId("round-nav").append(button);
}
document.addEventListener("play", event => {
  if (event.target.tagName === "AUDIO") document.querySelectorAll("audio").forEach(audio => {
    if (audio !== event.target) audio.pause();
  });
}, true);
byId("reveal").addEventListener("click", () => {
  const round = sheet.rounds[sheet.active];
  if (!readyToOpen(round, sheet.referencePlayed)) return;
  round.open = true;
  renderRound();
  saveLocal();
  byId("written-title").focus();
});
byId("reason").addEventListener("input", () => {
  sheet.rounds[sheet.active].reason = byId("reason").value;
  update();
  saveLocal();
});
byId("next").addEventListener("click", () => {
  if (!filed(sheet.rounds[sheet.active])) return;
  if (sheet.active + 1 < MOON.rounds.length) visitRound(sheet.active + 1);
  else byId("sheet-title").focus();
});
byId("save").addEventListener("click", () => {
  exportFile("moon-post-answers.json", JSON.stringify(sheet, null, 2) + "\n", "application/json");
  byId("save-status").textContent = "Answer file prepared. Keep it to restore your listening notes.";
});
byId("report").addEventListener("click", () => {
  if (sheet.rounds.every(filed)) exportFile("moon-post-worksheet.md", sheetMarkdown(sheet), "text/markdown;charset=utf-8");
});
byId("restore").addEventListener("click", () => byId("answer-file").click());
byId("answer-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 64000) throw Error("File too large");
    const restored = restoreSheet(await file.text());
    sheet = restored;
    renderReference();
    renderRound();
    saveLocal();
    byId("save-status").textContent = "Answers restored. Dispatch " + (sheet.active + 1) + " is open in the listening desk.";
  } catch (error) {
    byId("save-status").textContent = "Couldn’t restore this file. Choose a JSON answer file from this edition.";
  }
  event.target.value = "";
});
byId("reset").addEventListener("click", () => {
  sheet = blankSheet();
  byId("reference-text").open = false;
  document.querySelector(".reset").open = false;
  renderReference();
  visitRound(0);
});
renderReference();
renderRound();
if (!startingNote) saveLocal();
else byId("save-status").textContent = startingNote;
