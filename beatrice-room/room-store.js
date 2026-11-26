'use strict';

const RoomStore=(()=>{
  const classroom=document.documentElement.dataset.mode==='classroom';
  const choices=['Finch','Kite','Wren'],moods=['Ready','Unsure','Need a minute'],durations=[15,60,300];
  const fields=['id','duration','phase','alias','mood','plan','reflection','deadline','closedBy','rev'];
  const fail=s=>{throw Error(s);};
  function token(n){return Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');}
  function fresh(duration){
    if(!durations.includes(duration))fail('Choose one of the planning windows.');
    return {id:token(4).toUpperCase(),fac:token(20),learner:token(20),duration,phase:'lobby',alias:'',mood:'',plan:'',reflection:'',deadline:0,closedBy:'',rev:0};
  }
  function view(s,role,now){
    const result=Object.fromEntries(fields.map(k=>[k,s[k]]));
    if(role==='facilitator')result.learnerKey=s.learner;
    return {room:result,role,serverNow:now};
  }
  function expire(s,now){
    if(s.phase==='planning' && now>=s.deadline){s.phase='reflection';s.closedBy='timer';s.rev++;return true;}
    return false;
  }
  function clean(value,required=true){
    if(typeof value!=='string' || value.length>1500 || (required&&!value.trim()))fail('Use 1 to 1,500 characters for this entry.');
    return value.trim();
  }
  function apply(s,role,action,data,now){
    const gate=(r,...phases)=>{if(role!==r || !phases.includes(s.phase))fail('This action is unavailable in the current phase.');};
    switch(action){
      case 'join':
        gate('learner','lobby');
        if(!choices.includes(data.value))fail('Choose a rehearsal call sign.');
        if(s.alias && data.value!==s.alias)fail('This room already has a learner.');
        s.alias=data.value;break;
      case 'checkin':
        gate('facilitator','lobby');if(!s.alias)fail('The learner must join first.');
        s.phase='checkin';break;
      case 'mood':
        gate('learner','checkin');if(!moods.includes(data.value))fail('Choose a check-in answer.');
        s.mood=data.value;s.phase='planning';s.deadline=now+s.duration*1000;break;
      case 'plan':
        gate('learner','planning','reflection');s.plan=clean(data.value);break;
      case 'reflect':
        gate('facilitator','planning');s.phase='reflection';s.closedBy='facilitator';break;
      case 'finish':
        gate('learner','reflection');s.reflection=clean(data.value);if(data.plan)s.plan=clean(data.plan);s.phase='complete';break;
      default: fail('Unknown room action.');
    }
    s.rev++;
  }
  let dbPromise;
  function database(){
    if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open('clpanic-beatrice-rooms-v1',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('rooms',{keyPath:'id'});
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(Error('Browser room storage is unavailable. Open the classroom kit using its local host.'));
    });
    return dbPromise;
  }
  async function localCreate(duration){
    const s=fresh(duration),db=await database();await new Promise((resolve,reject)=>{
      const tx=db.transaction('rooms','readwrite');tx.oncomplete=resolve;tx.onabort=()=>reject(Error('Could not save this room. Try again.'));tx.objectStore('rooms').add(s);
    });
    return {id:s.id,key:s.fac,role:'facilitator'};
  }
  async function localRoom(link,action,data){
    const db=await database();return new Promise((resolve,reject)=>{
      let result,problem;
      const tx=db.transaction('rooms','readwrite'),store=tx.objectStore('rooms');const query=store.get(link.id);
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(problem || Error('Room storage is unavailable.'));
      query.onsuccess=()=>{
        try{
          const s=query.result;
          if(!s || (link.role==='facilitator'?s.fac:s.learner)!==link.key)fail('Open this room in the browser profile that created it. For two devices, use a classroom-host learner link.');
          const now=Date.now(),changed=expire(s,now);
          if(action)apply(s,link.role,action,data,now);
          if(changed||action)store.put(s);result=view(s,link.role,now);
        }catch(e){problem=e;tx.abort();}
      };
    });
  }
  async function api(path,method,payload,key){
    const url=new URL('./api/rooms'+path,location.href),headers={};
    if(key)headers.Authorization='Bearer '+key;
    if(payload)headers['Content-Type']='application/json';
    let res;try{res=await fetch(url,{method,headers,cache:'no-store',body:payload?JSON.stringify(payload):undefined});}
    catch{fail('The classroom host is unreachable. Check the connection and retry.');}
    const body=await res.json();
    if(!res.ok)fail(body.error || 'The host could not open the room.');return body;
  }
  return {classroom,choices,moods,
    create:duration=>classroom?api('','POST',{duration}):localCreate(duration),
    open:(link,action=null,data={})=>classroom?api('/'+link.id,action?'POST':'GET',action?{action,...data}:null,link.key):localRoom(link,action,data)
  };
})();

