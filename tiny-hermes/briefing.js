'use strict';

const $ = id => document.getElementById(id);
const KEY = 'clpanic.tiny-hermes.briefing.v1';
const preferences = {blockers:'Blockers first, with owners',ready:'Ready work first, with owners'};
const steps = {
  read:'Read all three current project notes.',
  format:'Apply the saved ordering and owner preference in under 100 words.',
  cite:'Attach the source note and revision to each line.'
};
const procedure = ['read','format','cite'];
const sets = [
  [{name:'Atlas',owner:'Maya',state:'Blocked',fact:'Map approval is pending.'},
   {name:'Beacon',owner:'Nori',state:'Ready',fact:'The lantern prototype is ready for testing.'},
   {name:'Cedar',owner:'Leo',state:'Blocked',fact:'The sensor library is missing.'}],
  [{name:'Atlas',owner:'Maya',state:'Ready',fact:'The map has been approved.'},
   {name:'Beacon',owner:'Nori',state:'Blocked',fact:'The test rig needs a replacement cell.'},
   {name:'Cedar',owner:'Leo',state:'Blocked',fact:'The sensor library is missing.'}]
];
const blank=()=>({edition:0,pref:null,skill:null,minute:540,nextSession:1,job:null,last:null,outbox:[]});
let state=blank(), storageOK=true;
function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved && [0,1].includes(saved.edition) && Number.isSafeInteger(saved.minute) && Number.isSafeInteger(saved.nextSession) && Array.isArray(saved.outbox))state=saved;
  } catch {storageOK=false;}
}
function save() {
  try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}
}
function message(s){$('message').textContent=s+(storageOK?'':' Browser storage is unavailable. Download the comparison to keep it.');}
function time(t){
  const days=Math.floor(t/1440), hours=Math.floor(t/60)%24, mins=t%60;
  return (days?'Day '+(days+1)+' · ':'')+String(hours).padStart(2,'0')+':'+String(mins).padStart(2,'0');
}
const version = edition => edition===0?'morning notes':'updated notes';
const labelEdition = e => (e?'Revision B':'Revision A')+' · '+version(e);
function readNotes(edition){return sets[edition].map(n=>({...n}));}
function lineFor(n,owner){return n.name+' — '+n.fact+(owner?' Owner: '+n.owner+'.':'');}
function baseline(notes){return notes.map(n=>lineFor(n,false));}
function newRun(trigger) {
  const pref=state.pref, savedRoutine=Array.isArray(state.skill);
  const actions=savedRoutine ? state.skill : ['read','format'];
  const trace=['Started session '+state.nextSession+' with zero previous messages.',
    pref?'Read saved preference: '+preferences[pref]+'.':'Checked memory: no preference saved.',
    savedRoutine?'Loaded saved procedure: '+actions.map(op=>steps[op]).join(' '):'Used the built-in three-note formatter.'];
  let notes=[], ordered=[], lines=[];
  for (const op of actions) {
    if (op==='read') {
      notes=readNotes(state.edition);
      trace.push(...notes.map(n=>'Read '+n.name+' · '+labelEdition(state.edition)+' · '+n.state.toLowerCase()+'.'));
    } else if (op==='format') {
      const first=pref==='ready'?'Ready':'Blocked';
      ordered=pref ? [...notes.filter(n=>n.state===first),...notes.filter(n=>n.state!==first)] : notes;
      lines=ordered.map(n=>lineFor(n,!!pref));
    } else if (op==='cite') {
      lines=lines.map((line,i)=>line+' ['+ordered[i].name+'/'+(state.edition?'B':'A')+']');
      trace.push('Attached the matching source note and revision to each line.');
    }
  }
  trace.push('Wrote '+lines.join(' ').split(/\s+/).length+' words to '+(trigger==='schedule'?'the local outbox.':'the comparison.'));
  return {id:state.nextSession++,trigger,at:state.minute,edition:state.edition,pref,procedure:savedRoutine,
    before:baseline(notes),after:lines,trace};
}
function el(tag,txt,className=''){
  const n=document.createElement(tag);n.textContent=txt;if(className)n.className=className;return n;
}
function paragraphs(where,lines){where.replaceChildren(...lines.map(s=>el('p',s)));}
function render(){
  const notes=readNotes(state.edition), roll=state.last;
  $('edition').textContent=labelEdition(state.edition);
  $('notes').replaceChildren(...notes.map(n=>{
    const row=el('div','','note'),left=el('div',''),right=el('div','');
    left.append(el('h3',n.name),el('span',n.state,'tag '+(n.state==='Ready'?'ready':'')));
    right.append(el('p',n.fact),el('small','Owner · '+n.owner));row.append(left,right);return row;
  }));
  $('update').textContent=state.edition?'Restore morning notes':'Apply note update';
  $('memory').textContent=state.pref?'Saved memory · '+preferences[state.pref]+' · under 100 words.':'Memory is empty. The first briefing follows note order.';
  $('forget').disabled=!state.pref;
  $('routine').replaceChildren(...(state.skill || procedure).map(op=>el('li',steps[op])));
  $('save-skill').disabled=!!state.skill;
  $('skill-state').textContent=state.skill?'Procedure saved in this browser.':'This is the lesson’s preset procedure.';
  $('before-label').textContent=labelEdition(roll?.edition ?? state.edition)+' · source order';
  paragraphs($('before'),roll?.before ?? baseline(notes));
  $('after-label').textContent=roll?'Session '+roll.id+' · '+(roll.pref?preferences[roll.pref]:'empty memory')+' · '+time(roll.at):'Waiting for a fresh session';
  paragraphs($('after'),roll?.after ?? ['Choose Save preference, then Start fresh session to compare the same three notes.']);
  $('trace').replaceChildren(...(roll?.trace ?? ['Start a fresh session to record its inputs.']).map(s=>el('li',s)));
  $('download').disabled=!roll;
  $('time').textContent=time(state.minute);$('job').textContent=state.job?'One briefing due at '+time(state.job.due)+'.':'No pending job.';
  $('schedule').disabled=!!state.job;
  $('outbox').replaceChildren();
  if(!state.outbox.length){$('outbox').textContent='Empty. Scheduled briefings appear here.';}
  else for(const r of [...state.outbox].reverse()){
    const d=document.createElement('details');d.className='outentry';const sum=el('summary',time(r.at)+' · Session '+r.id+' · '+labelEdition(r.edition));
    const text=el('div','');paragraphs(text,r.after);d.append(sum,text);$('outbox').append(d);
  }
}
function commit(s){save();render();message(s);}
$('save-pref').onclick=()=>{state.pref=$('preference').value;commit('Preference saved for future sessions.');};
$('forget').onclick=()=>{state.pref=null;commit('Saved preference cleared. Existing briefings retain their original inputs.');};
$('save-skill').onclick=()=>{state.skill=[...procedure];commit('Procedure saved for future sessions.');};
$('update').onclick=()=>{state.edition=1-state.edition;commit(labelEdition(state.edition)+' loaded. Start a fresh session to read this revision.');};
$('run').onclick=()=>{state.last=newRun('manual');commit('Fresh session '+state.last.id+' completed.');};
$('schedule').onclick=()=>{if(state.job)return;state.job={due:state.minute+1};commit('One briefing scheduled on the simulated clock.');};
$('advance').onclick=()=>{
  state.minute++;
  if(state.job && state.job.due<=state.minute){
    state.last=newRun('schedule');state.outbox.push(state.last);if(state.outbox.length>30)state.outbox.shift();
    state.job=null;commit('The due job wrote one briefing to the outbox.');
  }else commit('Clock advanced. No briefing due.');
};
function comparisonText(r){
  return ['Tiny Hermes · briefing comparison','Deterministic browser lesson · simulated time '+time(r.at),
    'Session '+r.id+' · '+labelEdition(r.edition),'Trigger · '+(r.trigger==='schedule'?'simulated schedule':'manual fresh session'),
    '', 'BEFORE MEMORY',...r.before,'','FRESH SESSION',...r.after,'','RUN TRACE',...r.trace,
    '', 'SOURCES',...readNotes(r.edition).map(n=>n.name+' | '+n.state+' | '+n.owner+' | '+n.fact),''].join('\n');
}
$('download').onclick=()=>{
  const r=state.last;if(!r)return;
  const blob=new Blob([comparisonText(r)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='tiny-hermes-session-'+r.id+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  message('Comparison and run trace downloaded.');
};
load();if(state.pref)$('preference').value=state.pref;render();
if(!storageOK)message('Running in this tab.');

