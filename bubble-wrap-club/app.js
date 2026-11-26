"use strict";
const $ = id => document.getElementById(id);
const cols = 7, count = 42;
const key = "bubble-wrap-club.v1.";
const sheet = $("sheet");
const buttons = [];
const sealed = new Set();
let focused = 0, dragging = null, previousPoint = null, audio;
let timer = 0, replayFrame = 0, replayPosition = null, runningReplay = false;
let durable = true, sessionAvailable = true;
function stored(name, tab = false) {
  try { return JSON.parse((tab ? sessionStorage : localStorage).getItem(key + name)); }
  catch { return null; }
}
function persist(name, value, tab = false) {
  try { (tab ? sessionStorage : localStorage).setItem(key + name, JSON.stringify(value)); }
  catch { if (tab) sessionAvailable = false; else durable = false; }
}
const blank = () => ({started:null, misses:0, order:[]});
function checked(value, needsFull = false) {
  if (!value || !Array.isArray(value.order) || value.order.length > count || (needsFull && value.order.length !== count)) return null;
  if (!Number.isSafeInteger(value.misses) || value.misses < 0) return null;
  if (!value.order.length) return !needsFull && value.started === null && value.misses === 0 ? blank() : null;
  if (!Number.isSafeInteger(value.started) || value.started < 0) return null;
  const seen = new Set();
  let time = 0;
  for (const p of value.order) {
    if (!p || !Number.isInteger(p.i) || p.i < 0 || p.i >= count || seen.has(p.i) ||
        !Number.isSafeInteger(p.t) || p.t < time || (!seen.size && p.t !== 0)) return null;
    seen.add(p.i); time = p.t;
  }
  return value;
}
let lastRun = checked(stored("last"), true);
let run = checked(stored("current", true)) || lastRun || blank();
let best = stored("clean-best");
if (!Number.isSafeInteger(best) || best < 0) best = null;
let loud = stored("sound") === true;
function currentMilliseconds() {
  if (!run.order.length) return 0;
  const previous = run.order[run.order.length - 1].t;
  return run.order.length === count ? previous : Math.max(previous, Date.now() - run.started);
}
const timeText = ms => (ms / 1000).toFixed(2) + " s";
const locationName = index => "Row " + String.fromCharCode(65 + Math.floor(index / cols)) + ", column " + (index % cols + 1);
const rate = () => run.order.length ? Math.round(100 * run.order.length / (run.order.length + run.misses)) + "%" : "—";
function printCode() {
  let hash = 2166136261;
  for (const c of JSON.stringify([run.order, run.misses])) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
}
function setMark(index, popped) {
  const b = buttons[index];
  b.dataset.popped = String(popped);
  b.setAttribute("aria-pressed", String(popped));
  b.setAttribute("aria-label", locationName(index) + (popped ? ", popped" : ", sealed"));
}
function aim(index, move = false) {
  buttons[focused].tabIndex = -1; focused = index; buttons[index].tabIndex = 0;
  if (move) buttons[index].focus({preventScroll:true});
}
function sound() {
  if (!loud) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state === "suspended") audio.resume().catch(()=>{});
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    osc.frequency.setValueAtTime(370 + Math.random() * 120, now); osc.frequency.exponentialRampToValueAtTime(70, now + .065);
    gain.gain.setValueAtTime(.09, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .08);
    osc.connect(gain).connect(audio.destination); osc.start(now); osc.stop(now + .085);
  } catch { /* Sound is optional. */ }
}
function stopReplay() {
  cancelAnimationFrame(replayFrame); runningReplay = false; replayPosition = null;
  for (let i = 0; i < count; i++) { buttons[i].dataset.current = "false"; setMark(i, sealed.has(i)); }
  $("replay").textContent = "Replay run";
  $("grid-mode").textContent = "7 across × 6 down";
  $("replay-status").textContent = "";
}
function renderSlip() {
  const n = run.order.length, done = n === count;
  $("pops").textContent = n + " / " + count;
  $("stock").textContent = done ? "Sheet complete" : count - n + " sealed";
  $("accuracy").textContent = rate(); $("misses").textContent = String(run.misses);
  $("time").textContent = timeText(currentMilliseconds());
  $("slip-title").textContent = done ? "That’s a wrap!" : n ? "On the clock." : "Ready to pop.";
  $("blurb").textContent = done ? (run.misses ? "Sheet cleared. Try another route or chase a miss-free run." : "Clean sheet. Every press found a fresh pocket of air.") :
    n ? "The timer runs from first pop to last. Each repeat press costs accuracy." :
    "Start anywhere. Swipe a row in one stroke, or aim for 42 hits in 42 presses.";
  $("ticket-tag").textContent = done ? "BW–" + printCode().slice(0,6) : n ? "IN PROGRESS" : "UNSTAMPED";
  $("best").textContent = best === null ? "A clean sheet earns a personal time to beat." : "Best clean sheet on this device · " + timeText(best);
  $("finish-actions").hidden = !done;
  $("view-last").hidden = !lastRun || n !== 0;
  $("sound").textContent = loud ? "Sound on" : "Sound off"; $("sound").setAttribute("aria-pressed",String(loud));
  $("storage-note").textContent = !durable || !sessionAvailable ? "Storage is limited in this browser. A finished run can still be saved as a PNG." :
    "Runs and souvenirs stay on this device.";
  clearInterval(timer);
  if (n && !done) timer = setInterval(()=>{ if(!document.hidden) $("time").textContent=timeText(currentMilliseconds()); },85);
}
function useRun(next, focusGrid = false) {
  run = next; sealed.clear();
  for (const pop of run.order) sealed.add(pop.i);
  stopReplay(); renderSlip();
  if (focusGrid) {
    aim(0,true);
    if (matchMedia("(max-width:700px)").matches) sheet.scrollIntoView({block:"center"});
  }
}
function finish() {
  lastRun = run; persist("last",run);
  if (run.misses === 0) {
    const previous = stored("clean-best");
    if (Number.isSafeInteger(previous) && previous >= 0) best = best === null ? previous : Math.min(best,previous);
    best = best === null ? currentMilliseconds() : Math.min(best,currentMilliseconds());
    persist("clean-best",best);
  }
  $("announce").textContent = "That’s a wrap! " + rate() + " accuracy. Time " + timeText(currentMilliseconds()) + ".";
  renderSlip();
  $("slip-title").focus({preventScroll:true});
  if (matchMedia("(max-width:700px)").matches) $("slip-title").scrollIntoView({block:"center",behavior:"instant"});
}
function press(index, dragged = false) {
  if (run.order.length === count) return;
  if (sealed.has(index)) {
    if (dragged) return;
    run.misses++;
    $("announce").textContent = locationName(index) + " already popped. Miss " + run.misses + ".";
  } else {
    const now = Date.now();
    if (run.started === null) run.started = now;
    const prev = run.order.length ? run.order[run.order.length-1].t : 0;
    run.order.push({i:index, t:Math.max(prev,now - run.started)});
    sealed.add(index); setMark(index,true);
    buttons[index].classList.add("tapped");
    setTimeout(()=>buttons[index].classList.remove("tapped"),240);
    sound();
    $("announce").textContent = run.order.length + " of 42 popped.";
  }
  persist("current",run,true);
  if (run.order.length === count) finish(); else renderSlip();
}
for (let i=0; i<count; i++) {
  const b = document.createElement("button");
  b.type="button"; b.className="bubble"; b.dataset.index=String(i); b.tabIndex = i===0 ? 0 : -1;
  buttons.push(b); sheet.append(b);
}
function indexFrom(target) {
  const b = target?.closest?.(".bubble");
  return b && sheet.contains(b) ? Number(b.dataset.index) : null;
}
sheet.addEventListener("pointerdown",e=>{
  const i=indexFrom(e.target);
  if (i===null || e.button!==0 || dragging!==null || run.order.length===count) return;
  e.preventDefault(); dragging=e.pointerId; previousPoint={x:e.clientX,y:e.clientY};
  sheet.setPointerCapture?.(e.pointerId); aim(i); press(i);
});
sheet.addEventListener("pointermove",e=>{
  if (dragging!==e.pointerId || !previousPoint) return;
  const dx=e.clientX-previousPoint.x, dy=e.clientY-previousPoint.y;
  const gap=Math.max(6,buttons[0].getBoundingClientRect().width/3);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/gap));
  for(let s=1;s<=steps;s++){
    const x=previousPoint.x+dx*s/steps, y=previousPoint.y+dy*s/steps;
    const i=indexFrom(document.elementFromPoint(x,y));
    if(i!==null) press(i,true);
  }
  previousPoint={x:e.clientX,y:e.clientY};
});
function endDrag(e) { if (e.pointerId === dragging) {dragging=null;previousPoint=null;} }
for (const event of ["pointerup","pointercancel","lostpointercapture"]) sheet.addEventListener(event,endDrag);
sheet.addEventListener("click",e=>{
  // Touch and mouse use pointerdown; keyboard and assistive activation produce a detail-zero click.
  const i=indexFrom(e.target); if(e.detail===0 && i!==null){aim(i);press(i);}
});
sheet.addEventListener("focusin",e=>{const i=indexFrom(e.target); if(i!==null)aim(i);});
sheet.addEventListener("keydown",e=>{
  const i=indexFrom(e.target); if(i===null)return;
  const col=i%cols;
  const next={ArrowLeft:col>0?i-1:i,ArrowRight:col<cols-1?i+1:i,ArrowUp:i>=cols?i-cols:i,
    ArrowDown:i+cols<count?i+cols:i,Home:e.ctrlKey?0:i-col,End:e.ctrlKey?count-1:i-col+cols-1}[e.key];
  if(next!==undefined){e.preventDefault();aim(next,true);}
  else if ((e.key===" " || e.key==="Enter") && e.repeat) e.preventDefault();
});
function replayAt(n) {
  const previous = replayPosition === null ? -1 : replayPosition;
  if (previous < 0 || previous > n) {
    for(let i=0;i<count;i++){ setMark(i,false);buttons[i].dataset.current="false"; }
  } else if(previous > 0) buttons[run.order[previous-1].i].dataset.current="false";
  const start=previous<0||previous>n?0:previous;
  for(let j=start;j<n;j++)setMark(run.order[j].i,true);
  if(n>0)buttons[run.order[n-1].i].dataset.current="true";
  replayPosition=n;
  $("grid-mode").textContent="Run replay · "+n+" / 42";
  if (!n) return;
  const p=run.order[n-1];
  $("replay-status").textContent=(n===count?"Replay complete. ":"")+"Pop "+n+" of 42 · "+locationName(p.i)+" · "+timeText(p.t);
}
function startReplay() {
  if (run.order.length!==count)return;
  if(runningReplay){stopReplay();return;}
  stopReplay();replayAt(0);runningReplay=true;$("replay").textContent="Stop replay";
  const start=performance.now(), speed=Number($("speed").value);
  function frame(now) {
    const elapsed=(now-start)*speed;
    let n=replayPosition;
    while(n<count && run.order[n].t<=elapsed)n++;
    if(n!==replayPosition)replayAt(n);
    if(n===count){runningReplay=false;$("replay").textContent="Replay run";return;}
    replayFrame=requestAnimationFrame(frame);
  }
  frame(start);
}
$("replay").addEventListener("click",startReplay);
$("speed").addEventListener("change",()=>{if(runningReplay){stopReplay();startReplay();}});
$("step").addEventListener("click",()=>{
  if(run.order.length!==count)return;
  cancelAnimationFrame(replayFrame);runningReplay=false;$("replay").textContent="Replay run";
  if(replayPosition===null || replayPosition===count){stopReplay();replayAt(0);}
  replayAt(replayPosition+1);
});
$("fresh").addEventListener("click",()=>{useRun(blank(),true);persist("current",run,true);$("announce").textContent="Fresh sheet. 42 bubbles sealed.";});
$("view-last").addEventListener("click",()=>{if(lastRun){useRun(lastRun);persist("current",run,true);$("slip-title").focus();}});
$("sound").addEventListener("click",()=>{loud=!loud;persist("sound",loud);renderSlip();sound();});
$("card").addEventListener("click",()=>{
  if(run.order.length!==count)return;
  const canvas=document.createElement("canvas");canvas.width=1000;canvas.height=590;
  const c=canvas.getContext("2d");
  c.fillStyle="#f7f3e7";c.fillRect(0,0,1000,590);
  c.fillStyle="#182c3e";c.fillRect(38,34,924,6);
  c.font="bold 18px monospace";c.fillText("REWRAP / BUBBLE WRAP CLUB",40,78);
  c.textAlign="right";c.fillText("BW–"+printCode(),960,78);c.textAlign="left";
  c.font="bold 74px Georgia, serif";c.fillText("That’s a wrap!",37,186);
  c.font="24px sans-serif";c.fillText("A local founding-member souvenir",40,230);
  c.fillStyle="#194d70";c.font="bold 40px monospace";c.fillText(rate()+" accuracy",40,333);c.fillText(timeText(currentMilliseconds()),40,390);
  c.fillStyle="#182c3e";c.font="22px sans-serif";c.fillText("42 pops   /   "+run.misses+(run.misses===1?" miss":" misses"),40,447);
  const cx=i=>641+(i%cols)*43,cy=i=>178+Math.floor(i/cols)*43;
  c.strokeStyle="#9ab8b7";c.lineWidth=3;c.beginPath();
  run.order.forEach((p,j)=>j?c.lineTo(cx(p.i),cy(p.i)):c.moveTo(cx(p.i),cy(p.i)));c.stroke();
  run.order.forEach((p,j)=>{
    c.beginPath();c.fillStyle=j===0?"#183c59":j===count-1?"#923d26":"#c0d8d4";
    c.arc(cx(p.i),cy(p.i),16,0,2*Math.PI);c.fill();
    c.fillStyle=j===0||j===count-1?"#fff":"#233c49";c.font="bold 12px monospace";c.textAlign="center";c.fillText(String(j+1),cx(p.i),cy(p.i)+4);
  });
  c.textAlign="left";c.fillStyle="#182c3e";c.font="16px monospace";c.fillText("Your pop order, first to last",613,449);
  c.fillRect(40,506,920,2);c.font="18px Georgia, serif";c.fillText("Bubble Wrap Club · Packed on this device",40,552);
  canvas.toBlob(blob=>{
    if(!blob){$("replay-status").textContent="Could not create the card. Try saving again.";return;}
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="bubble-wrap-"+printCode().toLowerCase()+".png";
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $("announce").textContent="Souvenir PNG ready.";
  },"image/png");
});
if(location.protocol==="file:")$("portable").textContent="Offline edition";
useRun(run);
