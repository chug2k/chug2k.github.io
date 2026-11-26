'use strict';

const $ = id => document.getElementById(id);
const STORE = 'clpanic.subtitle-desk.v1';
const LIMIT = 359999999;
const RATE = 16000;
const pitches = [392, 494, 587];
const sample = [
  {id:1, start:250, end:1250, text:'Antenna ready.'},
  {id:2, start:2000, end:3200, text:'Trạm gió đã nghe rõ.'},
  {id:3, start:3600, end:4800, text:'Signal received.\nHẹn gặp lại.'}
];
const cloneSample = () => ({name:'Dawn radio check', cues:sample.map(c => ({...c}))});
let sheet = cloneSample(), selected = 1, previous = null, audio = null, playback = null, pendingPlay = 0, storageOK = true;
let frame = 0, selectedForm = null;
function validCue(c) {
  return c && Number.isInteger(c.start) && Number.isInteger(c.end) && c.start >= 0 && c.start < c.end && c.end <= LIMIT &&
    typeof c.text === 'string' && c.text.trim() && !/\n\s*\n/.test(c.text);
}
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.name === 'string' && Array.isArray(s.cues) && s.cues.length <= 2000 && s.cues.every(validCue)) {
      sheet = {name:s.name, cues:s.cues.map((c,i) => ({...c,id:i+1}))};
      selected = sheet.cues[s.selectedIndex]?.id ?? null;
    }
  } catch { storageOK = false; }
}
const ordered = () => [...sheet.cues].sort((a,b) => a.start-b.start || a.id-b.id);
const current = () => sheet.cues.find(c => c.id === selected);
const maxEnd = cues => cues.reduce((n,c) => Math.max(n,c.end),0);
const serial = n => String(n).padStart(2,'0');
const sec = ms => (ms / 1000).toFixed(3);
function stamp(ms, full = false) {
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60, f = String(ms % 1000).padStart(3,'0');
  return (full || h ? serial(h)+':' : '') + serial(m)+':'+serial(s)+(full ? ',' : '.')+f;
}
function say(text) { $('message').textContent = text; }
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify({...sheet,selectedIndex:sheet.cues.findIndex(c=>c.id===selected)}));
    storageOK = true;
  } catch { storageOK = false; }
  $('save-state').textContent = storageOK ? 'Applied cues are saved in this browser.' : 'Browser storage is unavailable. Use Export SRT to keep your work.';
}
function conditions(cues) {
  let gap=0, end=0, overlap=0;
  cues.forEach((c,i) => {
    gap += Math.max(0,c.start-end);
    end = Math.max(c.end,end);
    if (i+1<cues.length && c.end>cues[i+1].start) overlap++;
  });
  return {gap, overlap};
}
const newID = () => sheet.cues.reduce((n,c) => Math.max(n,c.id),0)+1;
function markChange() { previous={sheet:structuredCopy(sheet), selected}; stop(); }
function structuredCopy(data) { return JSON.parse(JSON.stringify(data)); }
function showForm() {
  const c=current();
  $('edit-form').hidden=!c;
  $('solo').disabled=!c;
  $('edit-title').textContent=c ? 'Edit cue '+serial(ordered().findIndex(x=>x.id===c.id)+1) : 'Edit cue';
  if(c) {
    $('start').value=sec(c.start); $('end').value=sec(c.end); $('line').value=c.text;
    selectedForm={start:$('start').value,end:$('end').value,text:c.text};
  } else selectedForm=null;
}
function changedForm() {
  return selectedForm && ($('start').value!==selectedForm.start || $('end').value!==selectedForm.end || $('line').value!==selectedForm.text);
}
function ensureApplied() {
  if (!changedForm()) return true;
  if (!$('edit-form').reportValidity()) return false;
  return applyForm();
}
function choose(id) {
  if(!ensureApplied()) return;
  stop(); selected=id; render();
}
function render() {
  const cues=ordered(), length=maxEnd(cues), {gap,overlap}=conditions(cues);
  $('track-name').textContent=sheet.name;
  $('total').textContent='of '+stamp(length);
  $('stats').textContent=cues.length+' '+(cues.length===1?'cue':'cues')+' · '+sec(gap)+' s silence · '+overlap+' '+(overlap===1?'overlap':'overlaps');
  $('trim').disabled=!overlap; $('undo').disabled=!previous;
  $('play').disabled=!cues.length; $('srt').disabled=!cues.length; $('wav').disabled=!cues.length;
  $('cues').replaceChildren(); $('segments').replaceChildren(); $('scale').replaceChildren();
  const buttons=document.createDocumentFragment(), segments=document.createDocumentFragment();
  for(let t=0;t<=4;t++) {
    const tick=document.createElement('span'); tick.textContent=sec(Math.round(length*t/4)).replace(/\.?0+$/,'')+'s';
    if(t===0 || !length) tick.textContent='0s';
    $('scale').append(tick);
  }
  cues.forEach((c,i) => {
    const num=serial(i+1), row=document.createElement('button');
    row.className='cue'; row.setAttribute('aria-pressed',String(c.id===selected));
    for(const [name,value] of [['cue-no',num],['cue-name',c.text],['cue-range',sec(c.start)+'–'+sec(c.end)]]) {
      const span=document.createElement('span'); span.className=name; span.textContent=value; row.append(span);
    }
    row.title='Edit cue '+num; row.onclick=()=>choose(c.id); buttons.append(row);
    const b=document.createElement('button'); b.className='segment'; b.dataset.tone=i%3; b.textContent=num;
    b.style.left=(100*c.start/length)+'%'; b.style.width=(100*(c.end-c.start)/length)+'%'; b.style.top=(i%2?17:5)+'px';
    b.setAttribute('aria-pressed',String(c.id===selected)); b.setAttribute('aria-label','Select timeline cue '+num); b.onclick=()=>choose(c.id); segments.append(b);
  });
  if(!cues.length) $('cues').textContent='No cues yet. Choose Add cue or import an SRT.';
  $('cues').append(buttons); $('segments').append(segments);
  showForm(); setClock(0,[],false); persist();
}
function applyForm() {
  const c=current(); if(!c) return false;
  const start=Math.round($('start').valueAsNumber*1000), end=Math.round($('end').valueAsNumber*1000);
  const text=$('line').value.replace(/\r/g,'').trim();
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>LIMIT) {
    $('end').setCustomValidity('End must be later than start and below 100 hours.'); $('end').reportValidity(); $('end').setCustomValidity('');return false;
  }
  if(!text || /\n\s*\n/.test(text)) {
    $('line').setCustomValidity('Enter subtitle text. Keep lines of the same cue together without blank lines.'); $('line').reportValidity(); $('line').setCustomValidity('');return false;
  }
  markChange(); Object.assign(c,{start,end,text}); render(); say('Cue applied.'); return true;
}
$('edit-form').onsubmit=e=>{e.preventDefault();applyForm();};
$('add').onclick=()=>{
  if(!ensureApplied()) return;
  const start=maxEnd(sheet.cues)+250;
  if(sheet.cues.length>=2000 || start+1000>LIMIT) {say('The editor supports 2,000 cues and times below 100 hours.');return;}
  markChange(); selected=newID(); sheet.cues.push({id:selected,start,end:start+1000,text:'New subtitle'}); render(); $('line').focus(); $('line').select(); say('Cue added.');
};
$('remove').onclick=()=>{markChange();sheet.cues=sheet.cues.filter(c=>c.id!==selected);selected=ordered()[0]?.id ?? null;render();say('Cue removed.');};
$('undo').onclick=()=>{if(!previous)return;stop();sheet=previous.sheet;selected=previous.selected;previous=null;render();say('Previous edit restored.');};
$('trim').onclick=()=>{
  if(!ensureApplied())return;
  const cues=ordered(), overlaps=cues.filter((c,i)=>i+1<cues.length && c.end>cues[i+1].start);
  if(!overlaps.length)return;
  if(cues.some((c,i)=>i+1<cues.length && c.start===cues[i+1].start)){say('Two cues share a start. Move one start before trimming.');return;}
  markChange();
  cues.slice(0,-1).forEach((c,i)=>{c.end=Math.min(c.end,cues[i+1].start);}); render(); say('Trimmed '+overlaps.length+' '+(overlaps.length===1?'cue':'cues')+' to the following start.');
};
function readTime(str) {
  const m=/^(\d{1,2}):([0-5]\d):([0-5]\d)[,.](\d{1,3})$/.exec(str);
  if(!m)throw Error('Use an SRT timestamp such as 00:00:01,250.');
  return (Number(m[1])*3600+Number(m[2])*60+Number(m[3]))*1000 + Number(m[4].padEnd(3,'0'));
}
function parseSrt(input) {
  if(input.length>2*1024*1024)throw Error('Choose an SRT under 2 MiB.');
  const clean=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!clean)throw Error('Enter at least one SRT cue.');
  const blocks=clean.split(/\n[ \t]*\n+/);
  if(blocks.length>2000)throw Error('Import up to 2,000 cues at a time.');
  return blocks.map((block,i)=>{
    try {
      const lines=block.split('\n');if(/^\s*\d+\s*$/.test(lines[0]))lines.shift();
      const times=lines.shift().trim().split(/\s*-->\s*/);
      if(times.length!==2)throw Error('Expected start --> end.');
      const c={id:i+1,start:readTime(times[0]),end:readTime(times[1]),text:lines.join('\n').trim()};
      if(!validCue(c))throw Error('Enter text and an end later than the start.');
      return c;
    } catch(err){throw Error('Cue '+(i+1)+': '+err.message);}
  });
}
function replaceSheet(next) {markChange();sheet=next;selected=ordered()[0]?.id??null;render();}
function importText(raw,name) {
  try {
    const cues=parseSrt(raw);replaceSheet({name,cues});$('import-msg').textContent='Imported '+cues.length+' cues.';say('Imported '+cues.length+' cues.');
  } catch(err) {$('import-msg').textContent=err.message+' Current sheet kept.'; say('Import needs attention.');}
}
$('open-import').onclick=()=>{$('importer').open=true;$('importer').scrollIntoView({block:'start'});$('paste').focus({preventScroll:true});};
$('import-text').onclick=()=>importText($('paste').value,'Imported subtitles');
$('file').onchange=async e=>{
  const file=e.target.files[0]; if(!file)return;
  try {
    if(file.size>2*1024*1024)throw Error('Choose an SRT under 2 MiB.');
    const str=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());importText(str,file.name.replace(/\.srt$/i,'') || 'Imported subtitles');
  } catch { $('import-msg').textContent='Choose a readable UTF-8 SRT under 2 MiB. Current sheet kept.'; }
  e.target.value='';
};
$('sample').onclick=()=>{replaceSheet(cloneSample());$('import-msg').textContent='Radio example loaded.';say('Radio example loaded.');};
function setClock(t,active,playing) {
  $('clock').textContent=stamp(t);const end=timelineEnd || 1;$('needle').style.left='calc('+Math.min(100,t/end*100)+'% - 1px)';
  $('signal').textContent=playing?(active.length?'On air':'Silent gap'):'Tone preview';
  $('caption').textContent=playing?(active.length?active.map(c=>c.text).join('\n'):'Silence'):'One pitch per cue';
}
let timelineEnd=0;
function stop() {
  pendingPlay++; cancelAnimationFrame(frame);
  if(playback)for(const osc of playback.oscs){try{osc.stop();}catch{}}
  playback=null;$('play').textContent='▷ Preview timeline';$('play').setAttribute('aria-label','Preview timeline');
  $('solo').textContent='Audition cue'; setClock(0,[],false);
}
async function play(solo) {
  if(playback){stop();return;}
  if(!ensureApplied())return;
  const run=++pendingPlay;
  try {
    const Ctx=window.AudioContext || window.webkitAudioContext;
    if(!Ctx)throw Error();
    audio=audio || new Ctx(); await audio.resume();
    if(run!==pendingPlay)return;
    const cues=ordered(); timelineEnd=maxEnd(cues);
    const target=solo?current():null, from=target?target.start:0, to=target?target.end:timelineEnd;
    const tracks=target?[target]:cues, origin=audio.currentTime+0.045, oscs=[];
    playback={oscs};
    for(const c of tracks){
      const begin=origin+(c.start-from)/1000, end=origin+(c.end-from)/1000, fade=Math.min(.008,(end-begin)/2);
      const osc=audio.createOscillator(), gain=audio.createGain();osc.frequency.value=pitches[cues.indexOf(c)%pitches.length];
      gain.gain.setValueAtTime(0,begin);gain.gain.linearRampToValueAtTime(.12,begin+fade);
      gain.gain.setValueAtTime(.12,end-fade);gain.gain.linearRampToValueAtTime(0,end);
      osc.connect(gain).connect(audio.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(begin);osc.stop(end);oscs.push(osc);
    }
    $('play').textContent='■ Stop preview';$('play').setAttribute('aria-label','Stop preview');
    if(solo)$('solo').textContent='Stop audition';
    function tick(){
      const t=from+Math.max(0,Math.floor((audio.currentTime-origin)*1000));
      if(t>=to){stop();setClock(to,[],false);say(solo?'Cue audition finished.':'Timeline preview finished.');return;}
      setClock(t,tracks.filter(c=>c.start<=t && t<c.end),true); frame=requestAnimationFrame(tick);
    }
    tick();
  } catch {stop();say('Audio could not start. Try Preview timeline again or export the tone WAV.');}
}
$('play').onclick=()=>play(false);$('solo').onclick=()=>play(true);
function download(blob,name) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('srt').onclick=()=>{
  if(!ensureApplied())return;
  const body=ordered().map((c,i)=>[String(i+1),stamp(c.start,true)+' --> '+stamp(c.end,true),c.text].join('\n')).join('\n\n')+'\n';
  download(new Blob([body.replace(/\n/g,'\r\n')],{type:'application/x-subrip;charset=utf-8'}),'subtitle-desk.srt');say('UTF-8 SRT exported.');
};
function makeWave(cues) {
  const samples=Math.ceil(maxEnd(cues)*RATE/1000), pcm=new Float32Array(samples);
  cues.forEach((c,i)=>{
    const first=Math.round(c.start*RATE/1000),last=Math.round(c.end*RATE/1000),len=last-first,fade=Math.min(RATE*.008,len/2);
    for(let n=0;n<len;n++)pcm[first+n]+=.12*Math.min(1,n/fade,(len-n)/fade)*Math.sin(2*Math.PI*pitches[i%3]*n/RATE);
  });
  const buf=new ArrayBuffer(44+samples*2),d=new DataView(buf);
  const tag=(s,at)=>{for(let i=0;i<s.length;i++)d.setUint8(at+i,s.charCodeAt(i));};
  tag('RIFF',0);d.setUint32(4,buf.byteLength-8,true);tag('WAVE',8);tag('fmt ',12);d.setUint32(16,16,true);d.setUint16(20,1,true);
  d.setUint16(22,1,true);d.setUint32(24,RATE,true);d.setUint32(28,RATE*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);tag('data',36);d.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i++)d.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);
  return new Blob([buf],{type:'audio/wav'});
}
$('wav').onclick=()=>{
  if(!ensureApplied())return;const cues=ordered();
  if(maxEnd(cues)>600000){say('Tone WAV supports tracks up to 10 minutes. The full track can be exported as SRT.');return;}
  download(makeWave(cues),'subtitle-desk-tones.wav');say('16 kHz mono tone WAV exported.');
};
load(); timelineEnd=maxEnd(sheet.cues); render();

