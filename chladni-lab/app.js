"use strict";
const $ = id => document.getElementById(id);
const model = globalThis.ChladniPlate;
const key = "chladni-lab.trial.v1";
const defaults = {seed:0x5052495a, a:150, b:720, prediction:null, revealed:false};
const labels = {fewer:"fewer",same:"the same number of",more:"more"};
const validDial = n => Number.isInteger(n) && n >= 0 && n <= 1000 && n % 5 === 0;
function restore() {
  try {
    const v=JSON.parse(localStorage.getItem(key));
    if (!v || !Number.isInteger(v.seed) || v.seed < 0 || v.seed > 0xffffffff || !validDial(v.a) || !validDial(v.b)) return {...defaults};
    const prediction = Object.hasOwn(labels,v.prediction) ? v.prediction : null;
    return {seed:v.seed,a:v.a,b:v.b,prediction,revealed:v.revealed===true && !!prediction && v.a!==v.b};
  } catch { return {...defaults}; }
}
let state = restore(), left, right, animating = false, animationId = 0, queued = 0, storageWorks = true;
const seedText = () => state.seed.toString(16).padStart(8,"0").toUpperCase();
function store() {
  try { localStorage.setItem(key,JSON.stringify(state)); }
  catch { storageWorks=false; }
}
function setSeedLabel() {
  $("seed").textContent = "Plate " + seedText() + " · 3,000 grains per setting" +
    (storageWorks ? "" : " · browser storage unavailable");
}
const wordCount = n => n + (n === 1 ? " crossing" : " crossings");
const format = n => n.toLocaleString("en-US");
function readPlate(p, id, settled) {
  p.draw($("plate-"+id),settled);
  $("phase-"+id).textContent=settled?"Settled":animating?"Settling":"Loose sand";
  const reading=settled ? wordCount(p.roots.length)+" on the guide" : animating ? "Sand is settling…" : "Loose sand · awaiting prediction";
  $("reading-"+id).textContent=reading;
  $("plate-"+id).setAttribute("aria-label","Plate "+id.toUpperCase()+", dial "+p.dial+". "+reading+
    (settled?". The sand gathers along light-colored nodal lines.":"."));
}
function dialLabels() {
  for(const id of ["a","b"]){
    const mode=model.modeFor(state[id]);
    $("dial-"+id).value=state[id];
    $("value-"+id).textContent=state[id];
    $("params-"+id).textContent="n "+mode.n.toFixed(2)+"  ·  m "+mode.m.toFixed(2);
  }
}
function relative() {
  return right.roots.length === left.roots.length ? "same" : right.roots.length > left.roots.length ? "more" : "fewer";
}
function observation() {
  const feedback=$("feedback");
  if(animating) {feedback.textContent="The grains are moving away from the strongest vibration.";return;}
  if(!state.revealed) {feedback.textContent="The same starting grains are scattered over both plates. A is already settled.";return;}
  const a=left.roots.length,b=right.roots.length, winner=relative();
  const match=state.prediction===winner, lead=document.createElement("strong");
  lead.textContent=match?"Your prediction matched. ":"You predicted "+labels[state.prediction]+" crossings. ";
  const result="A shows "+wordCount(a)+" and B shows "+wordCount(b)+". ";
  const quiet="After settling, "+format(left.quiet())+" grains on A and "+format(right.quiet())+" on B are near a quiet line.";
  feedback.replaceChildren(lead,document.createTextNode(result+quiet));
}
function controls() {
  const equal=state.a===state.b;
  $("choices").disabled=state.revealed || equal;
  document.querySelectorAll('input[name="prediction"]').forEach(el=>{el.checked=el.value===state.prediction;});
  $("reveal").disabled=!state.prediction || state.revealed || equal || !!queued;
  $("reveal").textContent=animating?"Settling…":state.revealed?"Plate B revealed":"Reveal plate B";
  $("save").disabled=!state.revealed || animating || !!queued;
  $("hint").textContent=equal?"Choose two different dial settings to compare.":
    state.revealed?"Change a dial or swap the modes to predict again.":
    state.prediction?"Prediction recorded. Reveal the second plate.":"Choose a prediction to reveal the sand.";
  setSeedLabel();
}
function build() {
  queued=0; cancelAnimationFrame(animationId); animating=false;
  if(!left || left.seed!==state.seed || left.dial!==state.a) {
    left=model.prepare(state.seed,state.a); left.advance(model.steps);
  }
  if(!right || right.seed!==state.seed || right.dial!==state.b || (!state.revealed && right.frame)) right=model.prepare(state.seed,state.b);
  if(state.revealed)right.advance(model.steps);
  readPlate(left,"a",true);readPlate(right,"b",state.revealed);
  $("plate-b").setAttribute("aria-busy","false");
  dialLabels();controls();observation();
}
function prepareAgain() {
  state.prediction=null;state.revealed=false;animating=false;
  cancelAnimationFrame(animationId);cancelAnimationFrame(queued);
  dialLabels();store();queued=requestAnimationFrame(build);controls();
  $("phase-b").textContent="Loose sand";$("reading-b").textContent="Loose sand · awaiting prediction";
  observation();
}
for(const id of ["a","b"]){
  $("dial-"+id).addEventListener("input",e=>{state[id]=Number(e.target.value);prepareAgain();});
}
$("choices").addEventListener("change",e=>{
  if(state.revealed || state.a===state.b || !Object.hasOwn(labels,e.target.value))return;
  state.prediction=e.target.value;store();controls();
});
function finishReveal() {
  animating=false;right.advance(model.steps);readPlate(right,"b",true);
  $("plate-b").setAttribute("aria-busy","false");controls();observation();
}
$("reveal").addEventListener("click",()=>{
  if(!state.prediction || state.revealed || state.a===state.b || queued)return;
  state.revealed=true;store();
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){finishReveal();return;}
  animating=true;$("plate-b").setAttribute("aria-busy","true");
  controls();observation();
  function frame() {
    right.advance(5);
    if(right.frame>=model.steps){finishReveal();return;}
    readPlate(right,"b",false);animationId=requestAnimationFrame(frame);
  }
  frame();
});
$("swap").addEventListener("click",()=>{[state.a,state.b]=[state.b,state.a];prepareAgain();});
$("new-plate").addEventListener("click",()=>{
  const sample=new Uint32Array(1);
  if(window.crypto?.getRandomValues)window.crypto.getRandomValues(sample);
  else sample[0]=Math.floor(Math.random()*4294967296);
  state.seed=sample[0]===state.seed?(sample[0]+1)>>>0:sample[0];prepareAgain();
});
$("save").addEventListener("click",()=>{
  if(!state.revealed || animating || queued)return;
  const out=document.createElement("canvas");out.width=1240;out.height=856;
  const c=out.getContext("2d");
  c.fillStyle="#f3f1e9";c.fillRect(0,0,out.width,out.height);c.fillStyle="#202623";c.fillRect(34,31,1172,3);
  c.font="55px Georgia,serif";c.fillText("The Chladni Table",33,100);
  c.font="18px monospace";c.fillText("PLATE "+seedText()+"  /  TWO MODELED SETTINGS",35,137);
  for(const [p,id,x] of [[left,"A",35],[right,"B",641]]){
    c.fillStyle="#202623";c.font="bold 22px monospace";c.fillText(id+"   DIAL "+p.dial+"   /   "+wordCount(p.roots.length).toUpperCase(),x,184);
    c.drawImage($("plate-"+id.toLowerCase()),x,205,520,520);
    c.font="17px monospace";c.fillText("n "+p.mode.n.toFixed(2)+"   m "+p.mode.m.toFixed(2)+"   /   "+format(p.quiet())+" quiet grains",x,752);
  }
  c.font="22px Georgia,serif";c.fillText("You predicted "+labels[state.prediction]+" crossings. B produced "+labels[relative()]+" crossings.",35,800);
  c.font="16px monospace";c.fillStyle="#344f50";c.fillText("Cyan dots mark midline crossings. Unitless model after Prízrak’s original Chladni Table.",35,834);
  out.toBlob(blob=>{
    if(!blob){$("hint").textContent="The image could not be prepared. Try saving again.";return;}
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="chladni-"+seedText().toLowerCase()+"-"+state.a+"-"+state.b+".png";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $("hint").textContent="Comparison PNG prepared. Your two figures and prediction are in the image.";
  },"image/png");
});
if(location.protocol==="file:")$("portable").textContent="Offline edition";
build();
