"use strict";
const lessons={
  shelf:{
    name:"Signal shelf",
    brief:"Stand the mast, receiver and lamp on the same bottom edge. The first and last pieces touch the inset guides, with equal space between the three.",
    parts:[["Mast","M","part-a"],["Receiver","R","part-b"],["Lamp","L","part-c"]],
    start:"display: flex;\njustify-content: flex-start;\nalign-items: flex-start;",
    answer:"display: flex;\njustify-content: space-between;\nalign-items: flex-end;",
    hint:"In a flex row, justify-content distributes space horizontally. Align-items moves the pieces vertically. A fixed gap can fit one width and miss the other."
  },
  drawer:{
    name:"Swatch drawer",
    brief:"File the four ink swatches in a two-by-two drawer. Give the columns equal room and center each swatch in its own cell.",
    parts:[["Moss","Moss","chip-a"],["Clay","Clay","chip-b"],["Iris","Iris","chip-c"],["Gold","Gold","chip-d"]],
    start:"display: grid;\ngrid-template-columns: 1fr 2fr;\ngrid-template-rows: 1fr 1fr;\nplace-items: start;",
    answer:"display: grid;\ngrid-template-columns: 1fr 1fr;\ngrid-template-rows: 1fr 1fr;\nplace-items: center;",
    hint:"Grid tracks divide the available room. Two equal fractional columns share it evenly. Place-items sets alignment along both axes inside each cell."
  }
};
const properties=("display flex-direction flex-wrap flex-flow justify-content align-items align-content justify-items place-content place-items "+
  "gap row-gap column-gap grid-template-columns grid-template-rows grid-auto-columns grid-auto-rows grid-auto-flow").split(" ");
const supported=new Set(properties);
const widths=[240,440],storageKey="clpanic.layout-workbench.v1";
const el=id=>document.getElementById(id);
function parse(source){
  let body=source.replace(/\/\*[\s\S]*?\*\//g,"").trim();
  const wrapped=body.match(/^\.stage\s*\{([^{}]*)\}\s*$/);
  if(wrapped) body=wrapped[1];
  if(/[{}]/.test(body)) throw Error("Enter declarations for .stage. Remove extra selectors or braces.");
  const declarations=body.split(";").map(s=>s.trim()).filter(Boolean);
  if(!declarations.length) throw Error("Enter at least one layout declaration.");
  const rules=[];
  for(const declaration of declarations){
    const colon=declaration.indexOf(":");
    if(colon<1) throw Error("A declaration needs a property, a colon and a value.");
    const property=declaration.slice(0,colon).trim().toLowerCase();
    const value=declaration.slice(colon+1).trim();
    if(!supported.has(property)) throw Error("“"+property+"” is outside this container editor. See Editable properties.");
    if(!CSS.supports(property,value)) throw Error("The browser cannot apply “"+value+"” to "+property+".");
    if(property==="display" && !["flex","grid","block","inline-flex","inline-grid"].includes(value))
      throw Error("Use flex, grid or block display in this exercise.");
    rules.push([property,value]);
  }
  return rules;
}
function applyRules(stage,rules){
  for(const p of properties) stage.style.removeProperty(p);
  for(const [p,v] of rules) stage.style.setProperty(p,v);
}
function makeStage(id, parent){
  const stage=document.createElement("div");stage.className="stage";stage.dataset.side=id;parent.append(stage);return stage;
}
const rigs=widths.map(width=>{
  const target=makeStage("target",el("measure-rig")),mine=makeStage("mine",el("measure-rig"));
  for(const stage of [target,mine]) stage.style.width=width+"px";
  return {width,target,mine};
});
const state={layout:"shelf",width:matchMedia("(max-width:620px)").matches?240:440,records:{}};
for(const [id,lesson] of Object.entries(lessons)) state.records[id]={applied:lesson.start,draft:lesson.start};
try{
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if(saved && Object.hasOwn(lessons,saved.layout)){
    state.layout=saved.layout;if(widths.includes(saved.width)) state.width=saved.width;
    for(const id of Object.keys(lessons)){
      const record=saved.records?.[id];if(!record || typeof record.draft!=="string") continue;
      try{parse(record.applied);state.records[id]={applied:record.applied,draft:record.draft};}catch{}
    }
  }
}catch{}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
function pieces(stage,parts){
  stage.replaceChildren(...parts.map(([name,label,kind])=>{
    const piece=document.createElement("div"),caption=document.createElement("span");
    piece.className="piece "+kind;piece.title=name;piece.setAttribute("aria-label",name);caption.textContent=label;
    piece.append(caption);return piece;
  }));
}
function rects(stage){
  const board=stage.getBoundingClientRect();
  return Array.from(stage.children, piece=>{
    const r=piece.getBoundingClientRect();
    return [r.left-board.left,r.top-board.top,r.width,r.height];
  });
}
function measurements(){
  return rigs.map(({width,target,mine})=>{
    const expected=rects(target),actual=rects(mine);
    const deltas=expected.map((r,index)=>r.map((value,axis)=>value-actual[index][axis]));
    const maxes=deltas.map(diff=>Math.max(...diff.map(Math.abs)));
    return {width,deltas,maxes,matched:maxes.filter(n=>n<=1).length,max:Math.max(...maxes)};
  });
}
function renderGrade(){
  const lesson=lessons[state.layout],n=lesson.parts.length,results=measurements();
  const both=lesson.parts.filter((_,i)=>results.every(r=>r.maxes[i]<=1)).length;
  const grade=el("grade");grade.classList.toggle("good",both===n);
  grade.textContent=both===n ? "Matched at both widths." : both+" of "+n+" pieces match at both widths.";
  el("scores").replaceChildren(...results.map(r=>{
    const tr=document.createElement("tr");tr.dataset.testWidth=String(r.width);
    if(r.matched===n) tr.className="pass";
    for(const text of [r.width+" px",r.matched+" / "+n,(Math.round(r.max*10)/10)+" px"]){
      const td=document.createElement("td");td.textContent=text;tr.append(td);
    }
    return tr;
  }));
  const active=results.find(r=>r.width===state.width);
  const index=active.maxes.findIndex(v=>v>1);
  if(index<0) el("hint-offset").textContent="Every piece lines up in the "+state.width+" px preview.";
  else{
    const [dx,dy,dw,dh]=active.deltas[index];
    const px=n=>(Math.round(Math.abs(n)*10)/10)+" px";
    const steps=[];
    if(Math.abs(dx)>1) steps.push(px(dx)+(dx>0?" right":" left"));
    if(Math.abs(dy)>1) steps.push(px(dy)+(dy>0?" down":" up"));
    if(Math.abs(dw)>1) steps.push(px(dw)+(dw>0?" wider":" narrower"));
    if(Math.abs(dh)>1) steps.push(px(dh)+(dh>0?" taller":" shorter"));
    el("hint-offset").textContent=lesson.parts[index][0]+" needs to move or resize by "+steps.join(" and ")+" at "+state.width+" px.";
  }
}
function scalePreviews(){
  for(const id of ["target","mine"]){
    const frame=el(id+"-frame"),stage=el(id);
    const scale=Math.min(1,frame.clientWidth/state.width);
    stage.style.width=state.width+"px";stage.style.transform="scale("+scale+")";
    frame.style.height=Math.ceil(152*scale+2)+"px";
  }
}
function refresh(){
  const lesson=lessons[state.layout],record=state.records[state.layout];
  const target=parse(lesson.answer),mine=parse(record.applied);
  for(const pair of [{target:el("target"),mine:el("mine")},...rigs]){
    for(const [stage,rules] of [[pair.target,target],[pair.mine,mine]]){
      pieces(stage,lesson.parts);applyRules(stage,rules);
    }
  }
  el("name").textContent=lesson.name;el("brief").textContent=lesson.brief;
  el("code").value=record.draft;el("solution").textContent=lesson.answer;el("hint").textContent=lesson.hint;
  for(const b of document.querySelectorAll("button[data-layout]")) b.setAttribute("aria-pressed",String(b.dataset.layout===state.layout));
  for(const b of document.querySelectorAll("button[data-width]")) b.setAttribute("aria-pressed",String(Number(b.dataset.width)===state.width));
  scalePreviews();renderGrade();
}
function clearError(){el("error").hidden=true;el("error").textContent="";el("code").removeAttribute("aria-invalid");}
function apply(){
  const field=el("code"),record=state.records[state.layout];record.draft=field.value;save();
  try{parse(field.value);}catch(e){
    el("error").textContent=e.message+" The last applied layout is still on screen.";el("error").hidden=false;
    field.setAttribute("aria-invalid","true");return;
  }
  record.applied=field.value;save();clearError();refresh();
}
el("allowed").textContent=properties.join(", ");
el("apply").onclick=apply;
el("code").oninput=()=>{state.records[state.layout].draft=el("code").value;clearError();save();};
el("code").onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();apply();}};
el("load").onclick=()=>{
  state.records[state.layout].draft=lessons[state.layout].answer;el("code").value=lessons[state.layout].answer;
  clearError();save();el("code").focus();
};
el("reset").onclick=()=>{
  const start=lessons[state.layout].start;state.records[state.layout]={applied:start,draft:start};
  clearError();save();refresh();
};
for(const b of document.querySelectorAll("button[data-layout]")) b.onclick=()=>{
  state.layout=b.dataset.layout;el("help").open=false;clearError();save();refresh();
};
for(const b of document.querySelectorAll("button[data-width]")) b.onclick=()=>{
  state.width=Number(b.dataset.width);save();refresh();
};
if(location.protocol==="file:"){const text=document.createElement("small");text.textContent="Offline edition";el("download").replaceWith(text);}
refresh();
new ResizeObserver(scalePreviews).observe(el("target-frame"));
