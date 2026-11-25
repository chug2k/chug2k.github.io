"use strict";

const byId = (id) => document.getElementById(id);
const sourceLines = byId("loop-source").textContent.split("\n");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, action) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function decisionsFor(run) {
  const requests = run.frames.filter((frame) => frame.kind === "Model request");
  const firstRead = run.frames.find((frame) => frame.kind === "Tool result");
  const first = requests[0];
  const second = requests[1];
  return [
    {
      name: "Ask the model",
      question: "What should we send with the prompt?",
      setup: "Two files on disk",
      context: "The task names both files. So far, only the program has access to them.",
      input: run.prompt, through: 5, alternateLine: 2, alternateCode: "tools = []",
      choices: [
        {
          label: "Just the prompt", detail: "It already knows the filenames.",
          action: "Send the written task with an empty list of tools.",
          title: "The model has to ask for the numbers.",
          outcome: "The filenames identify the inputs. Without a file reader, the model has no way to open them. Here is one possible reply.",
          message: "I can't open local files here. Please paste the numbers.", image: "model-stuck"
        },
        {
          label: "The prompt and two tools", detail: "Let it request a file read or write.", correct: true,
          action: "Send the prompt and descriptions of read_file and write_file to the model.",
          title: "The first reply has two parts.",
          outcome: "The model sends a sentence and a tool request in the same reply. Both files are still unopened.",
          message: first.detail, packet: first.packet, image: "model"
        }
      ]
    },
    {
      name: "Check the reply",
      question: "The reply has words and a tool request. Are we done?",
      setup: "One reply, two parts",
      context: "A sentence arrived with a request to open morning.txt.",
      input: first.detail, inputPacket: first.packet, through: 8, alternateLine: 6, alternateCode: "    if reply.text:",
      choices: [
        {
          label: "Yes, it replied", detail: "Print its words and stop.",
          action: "Check for any text. The sentence passes that check, so Python prints it and breaks out of the loop.",
          title: "The program stops before the first read.",
          outcome: "The learner gets a promise to read. Nobody opened either input or created total.txt.",
          message: first.detail, image: "model-stuck"
        },
        {
          label: "No, it asked for a tool", detail: "Stop only when no tools are requested.", correct: true,
          action: "Check the reply’s list of tool calls. This reply has a call, so Python skips print and break.",
          title: "The reader has work to do.",
          outcome: "The program keeps the request to open morning.txt. A final reply with an empty list of tool calls will take the stop branch.",
          packet: first.packet, image: "program"
        }
      ]
    },
    {
      name: "Run the tool",
      question: "How do we turn that read_file request into a number?",
      setup: "A request is waiting",
      context: "Python has a function name and an argument. The input files are still unopened.",
      input: "The model asked the program to open morning.txt.", inputPacket: first.packet,
      through: 10, alternateLine: 10, alternateCode: "        result = call.arguments",
      choices: [
        {
          label: "Run the requested function", detail: "The program opens the file.", correct: true,
          action: "Dispatch read_file with morning.txt as its argument.",
          title: "The program reads the first number.",
          outcome: "The reader returns the character 2 followed by a newline. Python holds those two bytes in result. The model is waiting to receive them.",
          packet: firstRead.packet, image: "program-working"
        },
        {
          label: "Use the tool request itself", detail: "The model already returned some data.",
          action: "Copy the request’s arguments into result. The file reader never runs.",
          title: "The program still has only a filename.",
          outcome: "The name tells Python which file to open. It needs to run read_file to get the number inside.",
          packet: JSON.stringify(first.tool.arguments), image: "model-stuck"
        }
      ]
    },
    {
      name: "Send the result back",
      question: "We have the number 2. How does the model get it?",
      setup: "Python is holding the result",
      context: "The reader has returned 2 and a newline. The model’s read request is still waiting for an answer.",
      input: "Python has the contents of morning.txt.", inputPacket: firstRead.packet,
      through: 11, alternateLine: 11, alternateCode: "        print(result)",
      choices: [
        {
          label: "Print it on screen", detail: "We can see the tool worked.",
          action: "Print the value in the program’s console, where a person can read it.",
          title: "The console gets 2. The model is still waiting.",
          outcome: "The next model input still has an unanswered read_file request. Python must attach the result to that request in the conversation.",
          packet: "Console output  2", image: "model-stuck"
        },
        {
          label: "Add it to the conversation", detail: "The next model call receives it.", correct: true,
          action: "Append a tool message with the result and the matching request ID. Loop back to line 4 and send the accumulated conversation.",
          title: "The model asks for the other file.",
          outcome: "The next turn receives the original prompt, the earlier reply, and the tool message carrying 2. Here is the next recorded reply.",
          message: second.detail, packet: second.packet, image: "model-reading"
        }
      ]
    }
  ];
}

function showFiles(container, files, readNames) {
  const rows = ["morning.txt", "afternoon.txt", "total.txt"].map((name) => {
    const row = element("div");
    const opened = readNames.includes(name);
    const written = name === "total.txt" && Object.hasOwn(files, name);
    let state = "Unopened";
    if (name === "total.txt") state = written ? "Written" : "Not created";
    if (opened) state = "Read";
    const value = element("dd", written ? "written" : opened ? "read" : "", state);
    if (written || opened) value.append(element("code", "", JSON.stringify(files[name])));
    row.append(element("dt", "", name), value);
    return row;
  });
  container.replaceChildren(...rows);
}

function startBuild(sum) {
  const decisions = decisionsFor(sum);
  const initial = sum.frames[0];
  const afterRead = sum.frames.find((frame) => frame.kind === "Tool result");
  let stage = 0;
  let choice = null;
  let beatsShown = 0;
  let playing = false;
  let timeout;

  const step = button("", "primary", () => {
    playing = false;
    advance();
  });
  const pause = button("", "plain-button", () => {
    playing = !playing;
    updateFeedback();
  });
  const proceed = button("", "primary", () => {
    if (stage + 1 === decisions.length) finish();
    else { stage += 1; showDecision(true); }
  });
  const retry = button("Try the other choice", "primary", () => {
    const alternative = decisions[stage].choices.findIndex((answer) => answer !== choice);
    byId("choices").children[alternative].focus();
  });
  const again = button("Replay this choice", "plain-button", () => {
    beatsShown = 1;
    playing = false;
    updateFeedback();
    byId("result-title").focus();
  });
  byId("feedback-controls").append(step, pause, proceed, retry, again);

  function route(done = false) {
    Array.from(document.querySelectorAll(".route li")).forEach((node, index) => {
      node.classList.toggle("done", done || index < stage);
      if (!done && index === stage) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
    });
  }

  function showCode() {
    const current = decisions[stage];
    const previous = stage > 0 ? decisions[stage - 1].through : 0;
    const end = choice ? current.through : previous;
    const lines = sourceLines.slice(0, end);
    const alternate = choice && !choice.correct ? current.alternateLine : 0;
    if (alternate) lines[alternate - 1] = current.alternateCode;
    const code = byId("build-code");
    code.replaceChildren();
    let delay = 0;
    lines.forEach((text, i) => {
      if (i) code.append("\n");
      const line = element("span", "code-line");
      line.dataset.number = String(i + 1);
      line.classList.toggle("new", i >= previous);
      line.classList.toggle("alternate", i + 1 === alternate);
      if (i >= previous) {
        const ink = element("span", "typed", text);
        const duration = text.length * 5;
        ink.style.setProperty("--characters", String(text.length));
        ink.style.animationDelay = delay + "ms";
        ink.style.animationDuration = duration + "ms";
        delay += duration;
        line.append(ink);
      } else {
        line.textContent = text;
      }
      code.append(line);
    });
    byId("code-state").textContent = alternate ? "Illustrated variant" : "Python";
    byId("editor-code").hidden = !end;
    byId("empty-code").hidden = Boolean(end);
  }

  function messageCard(message, packet, imageName) {
    const card = element("div", "reply");
    if (imageName) {
      const image = element("img");
      image.src = "illustrations/" + imageName + ".webp";
      image.alt = "";
      image.width = image.height = 60;
      card.append(image);
    }
    const copy = element("div");
    if (message) copy.append(element("q", "", message));
    if (packet) copy.append(element("code", "", packet));
    card.append(copy);
    return card;
  }

  function beat(label, text) {
    const row = element("li", "beat");
    row.append(element("h4", "", label), element("p", "", text));
    return row;
  }

  function updateFeedback() {
    clearTimeout(timeout);
    const decision = decisions[stage];
    const done = beatsShown === 3;
    const kind = choice.correct ? "good" : "wrong";
    byId("result-panel").dataset.kind = kind;
    byId("origin").className = "label feedback-origin";
    byId("origin").dataset.kind = kind;
    byId("origin").textContent = choice.correct ? "From the recorded sum run" : "Illustrated alternative";
    byId("result-title").textContent = done ? choice.title : decision.name;

    const beats = element("ol", "beats");
    const input = beat("Input", decision.input);
    if (decision.inputPacket) input.append(messageCard(null, decision.inputPacket));
    beats.append(input);
    if (beatsShown >= 2) beats.append(beat("Action", choice.action));
    if (done) {
      const result = beat("Result", choice.outcome);
      result.append(messageCard(choice.message, choice.packet, choice.image));
      beats.append(result);
    }
    byId("result").replaceChildren(beats);
    const fileState = stage === 3 || (stage === 2 && choice.correct && done) ? afterRead : initial;
    showFiles(byId("build-files"), fileState.files, fileState.read);
    const active = document.activeElement;
    step.hidden = done;
    step.textContent = beatsShown === 1 ? "Show action →" : "Show result →";
    pause.hidden = done || reducedMotion.matches;
    pause.textContent = playing ? "Pause steps" : "Play steps";
    proceed.hidden = !done || !choice.correct;
    proceed.textContent = stage === 3 ? "Finish the loop →" : "Next decision →";
    retry.hidden = !done || Boolean(choice.correct);
    again.hidden = !done;
    if (done) {
      playing = false;
      Array.from(byId("choices").children).forEach((node) => {
        if (node.getAttribute("aria-pressed") === "true") node.dataset.outcome = kind;
      });
      if (active === step || active === pause) (choice.correct ? proceed : retry).focus();
    } else if (playing && !document.hidden && !reducedMotion.matches) {
      timeout = window.setTimeout(advance, 2300);
    }
    byId("status").textContent = done ? choice.title + " " + choice.outcome :
      beatsShown === 2 ? "Action. " + choice.action : "Input. " + decision.input;
  }

  function advance() {
    if (!choice || beatsShown >= 3) return;
    beatsShown += 1;
    updateFeedback();
  }

  function choose(index) {
    choice = decisions[stage].choices[index];
    beatsShown = 1;
    playing = !reducedMotion.matches && !document.hidden;
    Array.from(byId("choices").children).forEach((node, i) => {
      node.setAttribute("aria-pressed", String(i === index));
      delete node.dataset.outcome;
    });
    byId("reset").disabled = false;
    showCode();
    updateFeedback();
    const atPhoneWidth = window.matchMedia("(max-width: 760px)").matches;
    byId(atPhoneWidth ? "editor-code" : "result-title").focus();
  }

  function showDecision(focus) {
    clearTimeout(timeout);
    choice = null;
    beatsShown = 0;
    playing = false;
    const decision = decisions[stage];
    byId("step-label").textContent = "Decision " + (stage + 1) + " of 4 · " + decision.name;
    byId("question").textContent = decision.question;
    byId("choices").replaceChildren(...decision.choices.map((answer, i) => {
      const node = button("", "choice", () => choose(i));
      node.setAttribute("aria-pressed", "false");
      node.append(element("strong", "", answer.label), element("small", "", answer.detail));
      return node;
    }));
    byId("reset").disabled = stage === 0;
    byId("previous-decision").hidden = stage === 0;
    byId("feedback-controls").replaceChildren(step, pause, proceed, retry, again);
    [step, pause, proceed, retry, again].forEach((control) => { control.hidden = true; });
    byId("origin").className = "label";
    byId("origin").textContent = stage === 0 ? "Before the first call" : "Before this choice";
    byId("result-title").textContent = decision.setup;
    byId("result").replaceChildren(element("p", "context", decision.context));
    if (stage === 1) byId("result").append(messageCard(decision.input, decision.inputPacket, "model"));
    const fileState = stage === 3 ? afterRead : initial;
    showFiles(byId("build-files"), fileState.files, fileState.read);
    showCode();
    route();
    byId("status").textContent = "";
    if (focus) byId("question").focus();
  }

  function finish() {
    clearTimeout(timeout);
    playing = false;
    route(true);
    byId("step-label").textContent = "Four decisions complete";
    byId("question").textContent = "Your eleven-line loop is ready.";
    byId("choices").replaceChildren();
    byId("previous-decision").hidden = true;
    byId("origin").textContent = "Next turn";
    byId("result-title").textContent = "Can the same code finish the job?";
    byId("result").replaceChildren(element("p", "context", "The model just asked for afternoon.txt. Follow the recording through the second read, the write, and the reply that finally stops the loop."));
    const link = element("a", "primary", "Follow the recording ↓");
    link.href = "#recordings";
    byId("feedback-controls").replaceChildren(link);
    byId("question").focus();
  }

  byId("reset").addEventListener("click", () => { stage = 0; showDecision(true); });
  byId("previous-decision").addEventListener("click", () => { stage -= 1; showDecision(true); });
  reducedMotion.addEventListener("change", () => {
    if (!choice || beatsShown === 3) return;
    if (reducedMotion.matches) playing = false;
    updateFeedback();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden || !playing) return;
    playing = false;
    updateFeedback();
  });
  byId("build-prompt").textContent = sum.prompt;
  showDecision(false);
  byId("build-controls").hidden = false;
}

function startRecordings(runs) {
  const picker = byId("record-picker");
  const previous = byId("previous-frame");
  const next = byId("next-frame");
  let run;
  let at;
  const rewind = button("Replay from start", "secondary", () => {
    at = 0;
    render();
    byId("event-title").focus();
  });
  next.after(rewind);

  function render(announce = true) {
    const frame = run.frames[at];
    const last = at === run.frames.length - 1;
    const line = frame.kind === "Stop" ? 8 : frame.kind === "Tool result" ? 10 : 4;
    byId("event-label").textContent = frame.kind + " · Recorded event " + frame.event;
    byId("event-title").textContent = frame.title;
    byId("event-detail").textContent = frame.detail;
    byId("event-packet").textContent = frame.packet;
    byId("event-line").textContent = "Loop line " + line;
    byId("event-code").textContent = sourceLines[line - 1].trimStart();
    showFiles(byId("record-files"), frame.files, frame.read);
    const outcome = byId("check-outcome");
    outcome.hidden = !last;
    outcome.textContent = run.id === "sum" ? "The output contains exactly two bytes, 5 and a newline (hex 35 0a)." :
      "Only morning.txt was read. Both input files kept their original contents. No output file was created.";
    byId("frame-count").textContent = "Event " + (at + 1) + " of " + run.frames.length;
    const active = document.activeElement;
    previous.disabled = at === 0;
    next.disabled = last;
    rewind.hidden = !last;
    if ((last && active === next) || (at === 0 && active === previous)) byId("event-title").focus();
    if (announce) byId("status").textContent = byId("frame-count").textContent + ". " + frame.title + ". " + frame.detail + " " + frame.packet;
  }

  function select(announce = true) {
    run = runs.find((item) => item.id === picker.value);
    at = 0;
    byId("record-stats").textContent = run.turns + " model turns · " + run.tools + (run.tools === 1 ? " tool call · " : " tool calls · ") + run.elapsedSeconds.toFixed(3) + " s recorded";
    render(announce);
  }
  picker.addEventListener("change", () => select());
  previous.addEventListener("click", () => { if (at > 0) { at -= 1; render(); } });
  next.addEventListener("click", () => { if (at < run.frames.length - 1) { at += 1; render(); } });
  select(false);
  byId("replay").hidden = false;
}

async function loadLesson() {
  const note = byId("load-note");
  note.hidden = false;
  note.textContent = "Loading the two saved runs…";
  try {
    const response = await fetch("recorded-excerpts.json");
    if (!response.ok) throw new Error("Recording data unavailable");
    const data = await response.json();
    startBuild(data.runs.find((run) => run.id === "sum"));
    startRecordings(data.runs);
    note.hidden = true;
  } catch {
    note.replaceChildren(document.createTextNode("The recording data could not be loaded. "), button("Try again", "plain-button", loadLesson));
    const offline = element("a", "", "Download the offline replay");
    offline.href = "agents-101-replay.zip";
    note.append(" or ", offline, ".");
  }
}

loadLesson();
