"use strict";
const byId = id => document.getElementById(id);
const countKey = "sammys-bork-meter.total.v1";
const shiftKey = "sammys-bork-meter.shift.v1";
const soundKey = "sammys-bork-meter.sound.v1";
const words = ["BORK!", "AWOO!", "BOOF!", "YIP!", "ARF!", "HECKIN BORK!", "MEGA BORK!!"];
const treatLine = "YES. it is always treat time. sammy verified this legally.";
const dispatches = [
  "a leaf moved. case closed.", "the entire block has been informed.",
  "suspicious breeze. handled it.", "one extremely legal treat, please.",
  "false alarm. still counts as science.", "i have notified my other ear."
];
let persistent = true;
let shiftSaved = true;
function read(key, session = false) {
  try { return (session ? window.sessionStorage : window.localStorage).getItem(key); }
  catch { if (session) shiftSaved = false; else persistent = false; return null; }
}
function write(key, value, session = false) {
  try { (session ? window.sessionStorage : window.localStorage).setItem(key, String(value)); }
  catch { if (session) shiftSaved = false; else persistent = false; }
}
function numberFrom(raw) { return typeof raw === "string" && /^\d{1,120}$/.test(raw) ? BigInt(raw) : 0n; }
function readTotal() { return numberFrom(read(countKey) ?? read("borks")); }
let total = readTotal();
let shift = numberFrom(read(shiftKey, true));
let soundOn = read(soundKey) === "on";
let lastWord = -1;
let animationTimer;
let audio;
function drawDog(barking) {
  const ctx = byId("dog").getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 130, 76);
  const ink = "#293b29", shadow = "#587349", fur = "#779259", cream = "#d7e5ac";
  const rect = (x,y,w,h,c) => { ctx.fillStyle = c; ctx.fillRect(x,y,w,h); };
  function poly(color, coords) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i=0; i<coords.length; i+=2) {
      if (i) ctx.lineTo(coords[i], coords[i+1]); else ctx.moveTo(coords[i], coords[i+1]);
    }
    ctx.closePath(); ctx.fill();
  }
  // A distant fence and two clouds stay still while Sammy lifts his nose.
  rect(0,62,130,1,fur); rect(4,65,14,1,fur); rect(100,65,21,1,fur);
  for (let x=2;x<130;x+=13) { rect(x,48,1,13,fur); rect(x-1,48,3,1,fur); }
  rect(0,52,130,1,fur);
  for (const [x,y] of [[9,12],[110,21]]) {
    rect(x,y+2,12,1,fur); rect(x+3,y,5,1,fur); rect(x+8,y+1,3,1,fur);
  }
  ctx.save();
  if (barking) ctx.translate(0,-2);
  poly(ink,[18,43,14,41,10,34,12,28,16,31,21,36,29,36,29,43]);
  poly(cream,[13,32,16,34,19,38,23,39,20,41,16,39]);
  poly(ink,[20,40,26,34,50,32,62,31,66,25,67,10,71,8,79,21,86,21,94,7,98,8,98,28,101,34,112,37,113,42,108,46,100,47,96,53,88,56,83,58,82,68,72,68,72,59,64,58,61,66,54,66,54,59,37,58,34,67,24,67,24,60,19,57,16,50]);
  poly(shadow,[28,51,69,51,65,58,59,59,59,64,56,64,57,57,31,56]);
  poly(fur,[19,47,23,40,31,36,60,34,65,30,69,21,69,12,77,25,86,24,95,11,95,28,98,35,110,38,109,42,99,45,92,52,83,56,80,64,75,65,75,57,69,54,39,55,33,58,31,64,26,64,27,57,22,54]);
  poly(cream,[78,25,82,27,84,34,89,38,96,39,101,37,110,39,107,43,97,44,92,50,86,52,82,58,79,64,76,64,77,53,74,49,79,47,76,43,82,40,78,35]);
  poly(shadow,[70,14,75,23,71,22]); poly(shadow,[94,15,91,25,87,26]);
  rect(74,32,3,3,ink); rect(90,31,3,3,ink); rect(74,32,1,1,cream); rect(90,31,1,1,cream);
  rect(106,37,5,3,ink); rect(101,41,6,1,ink); rect(104,40,1,2,ink);
  if (barking) { rect(99,43,9,3,ink); rect(101,45,4,2,cream); }
  poly(cream,[23,49,28,52,39,52,44,50,47,51,54,53,64,53,67,51,71,54,68,56,38,55,32,59,30,63,27,63,29,56,24,54]);
  rect(28,64,4,1,cream); rect(76,65,5,1,cream); rect(21,46,3,2,cream);
  ctx.restore();
}
function render() {
  byId("count").textContent = total.toLocaleString("en-US");
  byId("count").classList.toggle("long-count", total > 99999999n);
  byId("session").textContent = shift.toLocaleString("en-US") + (shift === 1n ? " bork" : " borks");
  byId("undo").disabled = shift < 1n || total < 1n;
  byId("sound").textContent = soundOn ? "Sound on" : "Sound off";
  byId("sound").setAttribute("aria-pressed", String(soundOn));
  byId("storage-note").textContent = !persistent ? "Browser storage is unavailable. This patrol lasts until you close or reload the page." :
    !shiftSaved ? "Total saved in this browser. This shift lasts until you reload the page." :
    "Total saved in this browser. This shift belongs to this tab.";
}
function forecasts() {
  const date = new Date(), hour = date.getHours();
  byId("mailman").textContent = hour >= 10 && hour <= 15 ? "EXTREME. MAILMAN HOURS. STAY VIGILANT." :
    hour >= 6 && hour < 10 ? "ELEVATED. mailman could strike early." :
    "low. but sammy borks anyway. just in case.";
  byId("sploot").textContent = ["100% chance of full sploot", "partial side-sploot expected by 3pm",
    "reverse sploot warning in effect", "sploot conditions: PERFECT"][date.getDay() % 4];
}
function playBark() {
  if (!soundOn) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    const start = audio.currentTime;
    for (const offset of [0, 0.105]) {
      const node = audio.createOscillator(), gain = audio.createGain(), filter = audio.createBiquadFilter();
      node.type = "sawtooth"; filter.type = "bandpass"; filter.frequency.value = 760;
      node.frequency.setValueAtTime(155, start+offset); node.frequency.exponentialRampToValueAtTime(64, start+offset+.09);
      gain.gain.setValueAtTime(.0001, start+offset); gain.gain.exponentialRampToValueAtTime(.16, start+offset+.012);
      gain.gain.exponentialRampToValueAtTime(.0001, start+offset+.09);
      node.connect(filter).connect(gain).connect(audio.destination);
      node.start(start+offset); node.stop(start+offset+.1);
    }
  } catch { /* The visual reaction still works on browsers without audio. */ }
}
function flashBork() {
  const next = (lastWord + 1 + Math.floor(Math.random() * (words.length - 1))) % words.length;
  lastWord = next;
  const bubble = byId("callout");
  bubble.textContent = words[next]; bubble.hidden = false;
  byId("bork").classList.add("pressed");
  drawDog(true);
  clearTimeout(animationTimer);
  animationTimer = setTimeout(() => {
    bubble.hidden = true; byId("bork").classList.remove("pressed"); drawDog(false);
  }, 620);
}
function changeCount(bark) {
  // Serialize same-origin tabs where Web Locks are available. Each action
  // re-reads the stored total so another tab's patrol is included.
  function change() {
    if (persistent) total = readTotal();
    if (bark) {
      total++; shift++;
      const milestone = total % 100n === 0n;
      byId("reaction").textContent = milestone ? total.toLocaleString("en-US") + " BORKS!! sammy is SO proud of u" :
        dispatches[Number((shift - 1n) % BigInt(dispatches.length))];
      byId("treat").textContent = milestone ? byId("reaction").textContent : treatLine;
      flashBork();
    } else {
      if (!shift || !total) { render(); return; }
      total--; shift--;
      byId("reaction").textContent = "one bork retracted. officially a hiccup.";
      byId("treat").textContent = treatLine;
      clearTimeout(animationTimer); byId("callout").hidden = true;
      byId("bork").classList.remove("pressed"); drawDog(false);
    }
    write(countKey, total); write(shiftKey, shift, true); render();
    byId("announce").textContent = byId("reaction").textContent + " Total " + total + ".";
  }
  if (navigator.locks?.request) navigator.locks.request(countKey, change).catch(change);
  else change();
}
byId("bork").addEventListener("click", () => { playBark(); changeCount(true); });
byId("undo").addEventListener("click", () => changeCount(false));
byId("sound").addEventListener("click", () => {
  soundOn = !soundOn; write(soundKey, soundOn ? "on" : "off"); render(); playBark();
});
window.addEventListener("storage", event => {
  if (event.key === countKey || event.key === null) { total = readTotal(); render(); }
});
window.addEventListener("focus", forecasts);
if (location.protocol === "file:") byId("portable").textContent = "Offline edition";
drawDog(false); forecasts(); render();
