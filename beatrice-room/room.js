'use strict';

const $=id=>document.getElementById(id);
const {classroom}=RoomStore;
const scope=classroom?'Classroom host · two devices on the same trusted network.':'Same-browser rehearsal · keep both views in tabs of this browser profile.';
const promptText='Which paper bridge holds the most coins? Plan a fair test. Name one thing to vary, one thing to keep the same and one thing to measure.';
const phases={lobby:'Waiting room',checkin:'Check-in',planning:'Planning',reflection:'Reflection',complete:'Complete'};
const resumeKey='clpanic.beatrice.'+(classroom?'classroom':'rehearsal')+'.host';
const volatile=new Map();
let link=null,room=null,syncing=false,saving=false,offset=0,networkProblem=false;
const invite=$('open-learner'),copyButton=$('copy-learner'),actions=document.querySelector('.room-actions');
function put(key,value){volatile.set(key,value);try{localStorage.setItem(key,value);}catch{}}
function get(key){try{return localStorage.getItem(key) ?? volatile.get(key) ?? '';}catch{return volatile.get(key) || '';}}
function remove(key){volatile.delete(key);try{localStorage.removeItem(key);}catch{}}
function node(tag,text='',className=''){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;}
function msg(t){$('message').textContent=t;}
function href(l){const u=new URL(location.href);u.hash=new URLSearchParams({room:l.id,view:l.role,key:l.key}).toString();return u.href;}
function readLink(){
  if(!location.hash || location.hash==='#')return null;
  const h=new URLSearchParams(location.hash.slice(1));const id=h.get('room'),role=h.get('view'),key=h.get('key');
  if(!/^[A-F0-9]{8}$/.test(id||'') || !['learner','facilitator'].includes(role) || !/^[a-f0-9]{40}$/.test(key||''))throw Error('The room link is incomplete. Open the full link from the facilitator.');
  return {id,role,key};
}
function show(name){for(const id of ['landing','room','failed'])$(id).hidden=id!==name;}
function unavailable(e){show('failed');$('fail-reason').textContent=e.message;document.title='Room unavailable · Beatrice';}
function draftKey(field){return 'clpanic.beatrice.draft.'+link.id+'.'+link.key+'.'+field;}
function onBoard(s){return s.phase==='planning' || s.phase==='reflection';}
function updateClock(){
  const clock=$('countdown');if(!clock||!room||room.phase!=='planning')return;
  const seconds=Math.max(0,Math.ceil((room.deadline-Date.now()-offset)/1000));
  const text=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  if(clock.textContent!==text)clock.textContent=text;
  if(!seconds)sync();
}
function topic(parent){parent.append(node('h2','The paper bridge study'),node('p',promptText));}
function clockBox(parent){const out=node('output','','clock');out.id='countdown';out.setAttribute('aria-label','Planning time remaining');out.setAttribute('aria-live','off');parent.append(out);}
function button(text,id,fn,style=''){
  const b=node('button',text,style);b.id=id;b.type='button';b.onclick=fn;return b;
}
function followState(response,origin){
  if(link!==origin)return;
  offset=response.serverNow-Date.now();
  if(response.role && response.role!==link.role){unavailable(Error('This link has the wrong role. Open the original room link.'));return;}
  if(room && response.room.rev<room.rev)return;
  if(!room||room.rev!==response.room.rev){
    room=response.room;renderRoom();
  }
}
async function sync(){
  if(!link || syncing||saving)return;
  const origin=link;syncing=true;
  try{
    const data=await RoomStore.open(origin);if(link!==origin)return;
    followState(data,origin);if(networkProblem){networkProblem=false;msg('Connected to the room.');}
  }catch(e){
    if(link!==origin)return;
    if(!room)unavailable(e);else {networkProblem=true;msg(e.message);}
  }finally{syncing=false;}
}
async function act(action,data={},clearFields=[]){
  if(saving||!link)return;
  const origin=link;saving=true;
  try{
    const response=await RoomStore.open(origin,action,data);if(origin!==link)return;
    for(const [field,submitted] of clearFields) if(get(draftKey(field)).trim()===submitted.trim())remove(draftKey(field));
    followState(response,origin);
    msg(action==='plan'?'Plan saved to the shared record.':action==='finish'?'Reflection saved to the shared record.':'');
    try{bus?.postMessage(origin.id);}catch{}
  }catch(e){msg(e.message);}
  finally{saving=false;sync();}
}
function inputBlock(form,field,label,initial){
  const id=field+'-input',lab=node('label',label);lab.htmlFor=id;const t=node('textarea');t.id=id;t.maxLength=1500;t.rows=3;
  const draft=get(draftKey(field));t.value=draft || initial || '';
  t.oninput=()=>put(draftKey(field),t.value);form.append(lab,t);return t;
}
function planForm(parent){
  const form=node('form'),t=inputBlock(form,'plan','Your plan',room.plan),b=node('button','Save plan');
  b.type='submit';b.id='save-plan';form.onsubmit=e=>{e.preventDefault();if(!t.value.trim()){t.setCustomValidity('Write a plan first.');t.reportValidity();t.setCustomValidity('');return;}act('plan',{value:t.value},[['plan',t.value]]);};
  form.append(b);parent.append(form);return t;
}
function receipt(){
  const lines=['Beatrice Room · session record','Room '+room.id,'Mode · '+(classroom?'Classroom host':'Same-browser rehearsal'),'Phase · '+phases[room.phase],
    'Exercise · The paper bridge study',promptText,'Planning window · '+room.duration+' seconds','Learner call sign · '+room.alias,
    'Check-in · '+room.mood,'Reflection opened by · '+room.closedBy,'','PLAN',room.plan || '(No plan recorded.)','','REFLECTION',room.reflection,''];
  const a=node('a'),url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));a.href=url;a.download='beatrice-'+room.id+'.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function facilitator(card){
  if(room.phase==='lobby'){
    card.append(node('h2',room.alias?room.alias+' joined the room':'Invite the learner'),
      node('p',room.alias?'Open the check-in when both views are ready.':classroom?'Open the learner link on the second device. Keep this facilitator view on the host or another device.':'Open the learner view in a second tab. Choose a call sign there, then return here.'));
    const box=node('div','','btns');box.append(invite,copyButton);card.append(box);
    const b=button('Open check-in','open-checkin',()=>act('checkin'),'primary');b.disabled=!room.alias;const row=node('div','','btns');row.append(b);card.append(row);
  }else if(room.phase==='checkin'){
    card.append(node('h2','Waiting for '+room.alias),node('p','The learner chooses how they feel about planning the study. Their answer starts the timer.'));
  }else if(room.phase==='planning'){
    topic(card);clockBox(card);card.append(node('p','The learner can save a plan here. Reflection opens when the timer reaches zero.','help'),
      button('Open reflection now','early',()=>act('reflect'),'primary'));
  }else if(room.phase==='reflection'){
    card.append(node('h2','Time to look back'),node('p','The learner can finish their plan and reflect on what they learned. Both contributions will appear in the room notes.'));
  }else completed(card);
}
function completed(card){
  card.append(node('h2','Session complete'),node('p','The shared record contains the check-in, plan and reflection. It is available after reload.'),
    button('Download session','download-session',receipt,'primary'));
}
function learner(card){
  if(room.phase==='lobby' && !room.alias){
    card.append(node('h2','Join the exercise'),node('p','Pick a fictional call sign for this learner seat.'));
    const form=node('form'),lab=node('label','Learner call sign');lab.htmlFor='alias';const select=node('select');select.id='alias';
    for(const value of RoomStore.choices){const opt=node('option',value);opt.value=value;select.append(opt);}
    const b=node('button','Join room','primary');b.type='submit';b.id='join';form.append(lab,select,b);form.onsubmit=e=>{e.preventDefault();act('join',{value:select.value});};card.append(form);
  }else if(room.phase==='lobby'){
    const status=node('h2',room.alias+' has joined');status.id='learner-status';card.append(status,node('p','Keep this tab open. The facilitator will open the check-in.'));
  }else if(room.phase==='checkin'){
    card.append(node('h2','How are you feeling about the exercise?'),node('p','Your answer starts the planning timer.'));
    const div=node('div','','choices');RoomStore.moods.forEach((m,i)=>div.append(button(m,'mood-'+i,()=>act('mood',{value:m}),i===0?'primary':'')));card.append(div);
  }else if(room.phase==='planning'){
    topic(card);clockBox(card);planForm(card);
  }else if(room.phase==='reflection'){
    card.append(node('h2','What did you learn from planning the test?'),node('p','Name one choice you would keep or change next time.'));
    const editor=node('details');editor.append(node('summary',room.plan?'Review your plan':'Add your plan'));const plan=planForm(editor);card.append(editor);
    const form=node('form'),t=inputBlock(form,'reflection','Your reflection',room.reflection);t.required=true;
    const b=node('button','Finish reflection','primary');b.type='submit';b.id='finish';form.append(b);
    form.onsubmit=e=>{e.preventDefault();if(!t.value.trim()){t.setCustomValidity('Write a reflection first.');t.reportValidity();t.setCustomValidity('');return;}
      act('finish',{value:t.value,plan:plan.value},[['reflection',t.value],['plan',plan.value]]);
    };card.append(form);
  }else completed(card);
}
function renderRoom(){
  show('room');
  const role=link.role,host=role==='facilitator';
  $('role-title').textContent=host?'Facilitator view':'Learner view';
  $('phase-title').textContent=phases[room.phase];$('room-code').textContent=room.id;$('scope-line').textContent=scope;
  document.title=phases[room.phase]+' · '+(host?'Facilitator':'Learner')+' · Beatrice Room';
  const stages=['checkin','planning','reflection','complete'],idx=stages.indexOf(room.phase);
  [...$('steps').children].forEach((li,i)=>{li.className=i<idx?'past':'';if(i===idx)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  actions.append(invite,copyButton);invite.hidden=copyButton.hidden=!host;
  if(host){invite.href=href({id:room.id,role:'learner',key:room.learnerKey});}
  const card=$('action-card');card.replaceChildren();if(host)facilitator(card);else learner(card);
  const rec=$('record');rec.replaceChildren();
  const pairs=[['Learner',room.alias||'Waiting to join'],['Check-in',room.mood||'Awaiting a response'],['Planning window',room.duration+' seconds']];
  if(onBoard(room)||room.phase==='complete')pairs.push(['Plan',room.plan||'No plan saved yet']);
  if(room.phase==='reflection'||room.phase==='complete')pairs.push(['Reflection opened by',room.closedBy==='timer'?'Planning timer':'Facilitator'],['Reflection',room.reflection||'Awaiting reflection']);
  for(const [k,v] of pairs)rec.append(node('dt',k),node('dd',v));
  updateClock();
}
copyButton.onclick=async()=>{
  const target=invite.href;
  try{await navigator.clipboard.writeText(target);msg('Learner link copied.');}
  catch{const t=node('textarea');t.value=target;t.setAttribute('aria-label','Learner link to copy');actions.append(t);t.focus();t.select();try{if(!document.execCommand('copy'))throw Error();t.remove();msg('Learner link copied.');}catch{msg('Select and copy the learner link shown above.');}}
};
function route(){
  try{link=readLink();}catch(e){link=null;unavailable(e);return;}
  room=null;msg('');
  if(link){sync();return;}
  show('landing');document.title='Beatrice Room';
  const last=get(resumeKey),resume=$('resume');resume.hidden=!last;
  if(last)resume.href=last;
}
$('mode-description').append(node('strong',classroom?'Classroom host':'Same-browser rehearsal'),
  document.createTextNode(classroom?'Use the host’s LAN address to pair two devices. The classroom host stores this room on its own computer.':'Open facilitator and learner views in two tabs of the same browser profile. The classroom kit pairs two devices on a local network.'));
$('create-form').onsubmit=async e=>{
  e.preventDefault();$('create').disabled=true;
  try{const created=await RoomStore.create(Number($('duration').value));const address=href(created);put(resumeKey,address);location.hash=new URL(address).hash;}
  catch(err){msg(err.message);}finally{$('create').disabled=false;}
};
let bus=null;try{bus=new BroadcastChannel('clpanic.beatrice.events.v1');bus.onmessage=e=>{if(link?.id===e.data)sync();};}catch{}
window.addEventListener('hashchange',route);window.addEventListener('pageshow',()=>{if(link)sync();});
window.addEventListener('visibilitychange',()=>{if(!document.hidden && link)sync();});
setInterval(()=>{if(link)sync();},850);setInterval(updateClock,180);route();

