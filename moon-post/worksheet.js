"use strict";

const RUBRIC = [
  { key: "naturalness", label: "Naturalness", anchors: "1 stilted · 5 fluid" },
  { key: "similarity", label: "Voice similarity", anchors: "1 unlike clerk · 5 close" }
];
const CHOICES = ["Reading A", "Reading B", "Tie"];
const SCHEMA = "moon-post-answers-2";
const LETTERS = ["A", "B"];

function blankSheet() {
  return {
    schema: SCHEMA, edition: MOON.edition, active: 0, referencePlayed: false,
    rounds: MOON.rounds.map(round => ({
      open: false, choice: "", reason: "",
      readings: round.readings.map(clip => ({
        id: clip.id, played: false, naturalness: null, similarity: null, heard: ""
      }))
    }))
  };
}

function readyToOpen(round, referencePlayed) {
  return referencePlayed && round.readings.every(r => r.played && r.naturalness && r.similarity);
}

function filed(round) {
  return round.open && CHOICES.includes(round.choice) && round.reason.trim().length > 0;
}

function restoreSheet(text) {
  const input = JSON.parse(text);
  const result = blankSheet();
  const fail = () => { throw Error("This file does not match this edition’s worksheet."); };
  if (!input || input.schema !== SCHEMA || input.edition !== MOON.edition ||
      !Number.isInteger(input.active) || !MOON.rounds[input.active] ||
      typeof input.referencePlayed !== "boolean" || !Array.isArray(input.rounds) ||
      input.rounds.length !== result.rounds.length) fail();
  result.active = input.active;
  result.referencePlayed = input.referencePlayed;
  result.rounds.forEach((round, i) => {
    const raw = input.rounds[i];
    if (!raw || typeof raw.open !== "boolean" || !["", ...CHOICES].includes(raw.choice) ||
        typeof raw.reason !== "string" || raw.reason.length > 900 ||
        !Array.isArray(raw.readings) || raw.readings.length !== round.readings.length) fail();
    round.readings.forEach((r, j) => {
      const sample = raw.readings[j];
      if (!sample || sample.id !== r.id || typeof sample.played !== "boolean" ||
          typeof sample.heard !== "string" || sample.heard.length > 250) fail();
      r.played = sample.played;
      r.heard = sample.heard;
      for (const axis of RUBRIC) {
        const value = sample[axis.key];
        if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5)) fail();
        r[axis.key] = value;
      }
    });
    if (raw.open && !readyToOpen(round, result.referencePlayed)) fail();
    if (!raw.open && (raw.choice || raw.reason)) fail();
    round.open = raw.open;
    round.choice = raw.choice;
    round.reason = raw.reason;
  });
  return result;
}

function wordList(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
}

function learnerScore(target, heard) {
  const left = wordList(target), right = wordList(heard);
  let prior = Array.from({length: right.length + 1}, (_, j) => j);
  for (let i = 0; i < left.length; i++) {
    const row = [i + 1];
    right.forEach((word, j) => {
      row.push(Math.min(row[j] + 1, prior[j + 1] + 1, prior[j] + Number(left[i] !== word)));
    });
    prior = row;
  }
  return {errors: prior[right.length], words: left.length};
}

function scoreText(score) {
  const rate = Number((100 * score.errors / score.words).toFixed(2));
  return rate + "% (" + score.errors + "/" + score.words + " words)";
}

function describeEdit(edit) {
  const [type, before, after] = edit;
  if (type === "deletion") return "Omitted “" + before + "”";
  if (type === "insertion") return "Added “" + after + "”";
  return "“" + before + "” became “" + after + "”";
}

function editText(score) {
  return score.changes.length ? score.changes.map(describeEdit).join(", ") : "All words match";
}

function sheetMarkdown(state) {
  const lines = ["# The Moon Post", "", "Listening worksheet · " + MOON.edition, "",
    "Ratings use a 1–5 scale. The dispatch score compares each written order with Whisper’s transcription."];
  let naturalness = 0, similarity = 0, count = 0;
  MOON.rounds.forEach((round, index) => {
    const answer = state.rounds[index];
    lines.push("", "## " + (index + 1) + ". " + round.title, "", "Written order — " + round.target);
    round.readings.forEach((clip, j) => {
      const r = answer.readings[j];
      naturalness += r.naturalness;
      similarity += r.similarity;
      count++;
      lines.push("", "### Reading " + LETTERS[j], "",
        "- Naturalness " + r.naturalness + "/5 · Voice similarity " + r.similarity + "/5",
        "- Synthesis script — " + clip.script, "- Whisper transcript — " + clip.whisper,
        "- Order → Whisper — " + scoreText(clip.order_to_whisper) + ". " + editText(clip.order_to_whisper) + ".",
        "- Order → script — " + editText(clip.order_to_script) + ".",
        "- Script → Whisper — " + editText(clip.script_to_whisper) + ".");
      if (r.heard.trim()) lines.push("- My first transcription — " + r.heard.trim(),
        "- Order → my transcription — " + scoreText(learnerScore(round.target, r.heard)));
    });
    lines.push("", "My choice — " + answer.choice, "", "My reason — " + answer.reason.trim());
  });
  lines.push("", "## Across six readings", "",
    "- Written orders → Whisper — " + scoreText(MOON.totals.order_to_whisper),
    "- Written orders → synthesis scripts — " + scoreText(MOON.totals.order_to_script),
    "- Synthesis scripts → Whisper — " + scoreText(MOON.totals.script_to_whisper),
    "- My mean naturalness — " + (naturalness / count).toFixed(2) + "/5",
    "- My mean voice similarity — " + (similarity / count).toFixed(2) + "/5", "",
    "The night clerk is a separate reference clip. The word totals cover the six candidate readings.", "");
  return lines.join("\n");
}
