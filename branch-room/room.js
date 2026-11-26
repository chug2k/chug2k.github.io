"use strict";
const ROOM = window.PRINT_ROOM;
const feature = "feature/last-entry";
const sign = "desk/door-sign.txt";
const key = "clpanic.branch-room.v1";
const initial = {base:"main", checked:false, merged:false, view:"changes", branch:feature, file:sign};
let state = {...initial};
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved && ["main","develop"].includes(saved.base) && ["changes","files","log"].includes(saved.view)
      && Object.hasOwn(ROOM.trees,saved.branch)) {
    state = {...initial, base:saved.base, checked:saved.checked === true, merged:saved.merged === true,
             view:saved.view, branch:saved.branch, file:typeof saved.file === "string" ? saved.file : sign};
    if (state.merged) Object.assign(state, {base:"develop", checked:true});
  }
} catch {}
const el = id => document.getElementById(id);
function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function save() { try { localStorage.setItem(key,JSON.stringify(state)); } catch {} }
function comparison() { return state.merged ? ROOM.merged.review : ROOM.comparisons[state.base]; }
function tree(branch) { return state.merged && branch === "develop" ? ROOM.merged.develop : ROOM.trees[branch]; }
function renderRail() {
  const names = state.merged ? [["main"],[],["develop",feature]] : [["main"],["develop"],[feature]];
  el("rail").replaceChildren(...ROOM.log.map((entry,i) => {
    const item = node("li");
    item.append(node("span",entry.slice(0,7),"hash"));
    for (const ref of names[i]) item.append(node("span",ref,"pointer"));
    return item;
  }));
}
function renderReview() {
  const merged = state.merged;
  const held = state.checked && state.base === "main";
  el("base").value = state.base;
  el("base").disabled = merged;
  el("check").hidden = merged;
  el("merge").hidden = merged || !state.checked || held;
  el("status").textContent = merged ? "Merged" : held ? "Changes requested" : state.checked ? "Reviewed" : "Open";
  const notice = el("notice");
  notice.hidden = !state.checked;
  notice.classList.toggle("hold",held);
  if (merged) notice.textContent = "Merged into develop. Staging admits visitors until 17:30. The production sign still reads 17:00.";
  else if (held) notice.textContent = "Hold the review. The indigo workshop appears in this change. Choose develop as the review base to leave the workshop out.";
  else if (state.checked) notice.textContent = "Ready for develop. Only the door sign changes, from 17:00 to 17:30. You can merge this review.";
  else notice.textContent = "";
  for (const tab of document.querySelectorAll("[data-view]")) tab.setAttribute("aria-pressed",String(tab.dataset.view === state.view));
}
function renderFiles(files, diff) {
  const paths = Object.keys(files);
  const chosen = paths.includes(state.file) ? state.file : paths[0];
  const split = node("div",undefined,"split");
  const list = node("div",undefined,"filelist");
  const display = node("div",undefined,"source");
  display.setAttribute("aria-label",chosen);
  for (const path of paths) {
    const button = node("button",path,"filepick");
    button.type = "button"; button.setAttribute("aria-pressed",String(path === chosen));
    button.onclick = () => {
      state.file = path; save(); renderPanel();
      document.querySelector(".filepick[aria-pressed=true]")?.focus({preventScroll:true});
    };
    list.append(button);
  }
  const lines = files[chosen].split("\n");
  if (diff) {
    const start = lines.findIndex(line=>line.startsWith("@@"));
    for (const line of lines.slice(start+1)) display.append(node("pre",line || " ",line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : ""));
  } else display.append(node("pre",files[chosen]));
  split.append(list,display);
  el("panel").append(split);
}
function renderPanel() {
  const panel = el("panel"); panel.replaceChildren();
  if (state.view === "log") {
    panel.append(node("p","Commits reachable from " + feature + ", oldest first.","meta"));
    const list = node("ol",undefined,"commitlist");
    for (const line of ROOM.log) {
      const item = node("li"); item.append(node("code",line.slice(0,7)),line.slice(8)); list.append(item);
    }
    panel.append(list); return;
  }
  if (state.view === "files") {
    const label = node("label","Browse branch","branch-chooser"), select = node("select");
    select.id = "browse"; label.htmlFor = select.id;
    for (const branch of Object.keys(ROOM.trees)) select.add(new Option(branch,branch));
    select.value = state.branch;
    select.onchange = () => {state.branch=select.value; save(); renderPanel(); el("browse").focus({preventScroll:true});};
    label.append(select); panel.append(label);
    renderFiles(tree(state.branch),false); return;
  }
  const view = comparison();
  const count = Object.keys(view.diffs).length, commits = view.commits.length;
  const summary = count + (count === 1 ? " changed file" : " changed files") + " · " + commits + (commits === 1 ? " commit" : " commits");
  panel.append(node("p",summary,"meta"));
  if (count) renderFiles(view.diffs,true);
  else {
    const receipt = node("div",undefined,"receipt");
    for (const branch of ["main","develop"]) {
      const cell = node("div"); cell.append(node("code",branch),node("strong",tree(branch)[sign].split("\n")[1]));
      receipt.append(cell);
    }
    panel.append(receipt);
  }
}
function render() { renderRail(); renderReview(); renderPanel(); }
el("base").addEventListener("change",e=>{state.base=e.target.value;state.checked=false;state.view="changes";state.file=sign;save();render();});
el("check").addEventListener("click",()=>{state.checked=true;save();render();});
el("merge").addEventListener("click",()=>{
  if (!state.checked || state.base !== "develop" || state.merged) return;
  Object.assign(state,{merged:true,view:"changes",branch:"develop",file:sign});save();render();
  document.querySelector("[data-view='changes']").focus({preventScroll:true});
});
for (const tab of document.querySelectorAll("[data-view]")) tab.onclick=()=>{state.view=tab.dataset.view;save();render();};
el("restart").onclick=()=>{state={...initial};save();render();el("base").focus();};
if (location.protocol === "file:") el("download").replaceWith(node("span","Offline edition","eyebrow"));
render();
