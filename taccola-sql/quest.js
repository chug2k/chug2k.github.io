"use strict";
const quest=window.BELL_QUEST,tables=window.BELL_TABLES;
const storeKey="clpanic.taccola.rain-bell.v1";
const el=id=>document.getElementById(id);
function tag(name,text,cls){const item=document.createElement(name);if(text!==undefined)item.textContent=text;if(cls)item.className=cls;return item;}
const newState=()=>({level:0,earned:0,entries:quest.map(level=>({draft:level.starter,hints:0,submission:null}))});
let state=newState(),token=0,busy=false;
try{
  const saved=JSON.parse(localStorage.getItem(storeKey));
  if(saved && Number.isInteger(saved.earned) && saved.earned>=0 && saved.earned<=3 &&
      Number.isInteger(saved.level)&&saved.level>=0&&saved.level<=Math.min(saved.earned,2)&&
      Array.isArray(saved.entries)&&saved.entries.length===quest.length&&saved.entries.every(e=>
        e && typeof e.draft==="string" && Number.isInteger(e.hints) && e.hints>=0 && e.hints<=2 &&
        (!e.submission || (typeof e.submission.sql==="string" && typeof e.submission.title==="string" &&
        Array.isArray(e.submission.columns)&&Array.isArray(e.submission.rows)&&e.submission.rows.every(Array.isArray))))) state=saved;
}catch{}
function save(){try{localStorage.setItem(storeKey,JSON.stringify(state));}catch{}}
function mark(title,message,tone="warn",correct=false){return {title,message,tone,correct};}
function grade(index,result,reference,nearby){
  const level=quest[index],names=result.columns.map(k=>k.toLowerCase());
  const positions=level.columns.map(k=>names.indexOf(k));
  if(positions.includes(-1)) return mark("Missing columns","Return "+level.columns.join(" and ")+". The table below shows what your SQL actually returned.");
  if(names.length!==positions.length) return mark("Extra columns","Keep only "+level.columns.join(" and ")+" in the result.");
  if(!result.rows.length) return mark("No evidence yet","The query returned no rows. Check the filters against the table guide.");
  const toKey=row=>JSON.stringify(row);
  const actual=new Set(result.rows.map(row=>toKey(positions.map(i=>row[i]))));
  const expected=new Set(reference.rows.map(toKey));
  if(actual.size!==result.rows.length) return mark("Repeated evidence","A record appears more than once. Return each distinct piece of evidence once.");
  const inside=[...actual].every(x=>expected.has(x));
  if(inside && actual.size===expected.size) return mark(["Route recorded","Tie recorded","Bell recovered"][index],level.success,"good",true);
  if(inside){
    if(index===1) return mark("Tie cut short","Both rooms share the highest bronze strength. Keep every room with that strength.");
    return mark("Incomplete lead","You have "+actual.size+" of "+expected.size+" records. Look for the rest before closing this clue.");
  }
  if(nearby && actual.size>1){
    const possible=new Set(nearby.rows.map(toKey));
    if([...actual].every(x=>possible.has(x)) && [...expected].every(x=>actual.has(x)))
      return mark("Unresolved tie","More than one case fits part of Rill’s description. Apply both the wax seal and the cord color.");
  }
  return mark("Wrong trail","At least one returned record falls outside this clue. Compare its room, shift or markings with Rill’s note.","wrong");
}
function tableView(columns,rows,label){
  const scroll=tag("div",undefined,"table-scroll");scroll.tabIndex=0;scroll.setAttribute("aria-label",label);
  const t=tag("table");t.setAttribute("aria-label",label);
  const tr=t.createTHead().insertRow();columns.forEach(c=>{const th=tag("th",c);th.scope="col";tr.append(th);});
  const body=t.createTBody();for(const row of rows){const tr=body.insertRow();for(const cell of row)tr.insertCell().textContent=cell===null?"NULL":String(cell);}
  scroll.append(t);return scroll;
}
function renderGuide(name){
  const t=tables[name];el("register-select").value=name;el("table-note").textContent=t.note;
  el("schema").textContent=t.columns.map((col,i)=>col+" "+t.types[i]).join(" · ");
  el("table-preview").replaceChildren(tableView(t.columns,t.rows,name+" register"));
}
function renderBook(){
  el("progress").textContent=state.earned+" of 3 clues recorded";
  el("chapters").replaceChildren(...quest.map((level,i)=>{
    const b=tag("button");b.type="button";b.disabled=i>state.earned;
    b.append(tag("span",String(i+1).padStart(2,"0"),"stepnum"),level.name);
    if(i===state.level)b.setAttribute("aria-current","step");
    b.setAttribute("aria-label",level.name+(i>state.earned?", locked":i<state.earned?", recorded":""));
    b.onclick=()=>navigate(i);return b;
  }));
  el("journal").replaceChildren(...quest.slice(0,state.earned).map(q=>tag("li",q.journal)));
}
function renderFinding(){
  const entry=state.entries[state.level],report=entry.submission;
  const current=report && report.sql===entry.draft;
  el("finding").hidden=!current;
  if(!current)return;
  el("finding").dataset.tone=report.tone;el("finding-title").textContent=report.title;
  el("finding-message").textContent=report.message;
  const out=el("output");out.replaceChildren();
  if(report.columns.length){
    out.append(tag("div",report.rows.length+(report.rows.length===1?" row returned":" rows returned"),"count"),
      tableView(report.columns,report.rows,"SQL result"));
  }
  el("next").hidden=!report.correct || state.level===quest.length-1;
}
function renderHint(){
  const n=state.entries[state.level].hints;el("hintbox").hidden=n===0;
  el("hintbox").textContent=n ? "Rill’s hint "+n+" of 2 · "+quest[state.level].hints[n-1]:"";
  el("hint").disabled=n>=2;
}
function render(){
  const level=quest[state.level],entry=state.entries[state.level];
  renderBook();el("chapter").textContent="Clue "+(state.level+1)+" of 3";
  el("heading").textContent=level.heading;el("voice").textContent=level.voice;el("ask").textContent=level.ask;
  el("required").replaceChildren(...level.columns.map(c=>tag("code",c)));
  el("sql").value=entry.draft;el("worked-code").textContent=level.answer;el("worked").open=false;
  el("activity").textContent="";el("run").disabled=false;renderHint();renderFinding();renderGuide(level.table);
}
function stop(){token++;cancelQuery();busy=false;el("run").disabled=false;el("activity").textContent="";}
function navigate(i){
  if(i<0 || i>=quest.length || i>state.earned)return;
  stop();state.level=i;save();render();el("heading").focus();
}
function onEdit(){
  if(busy)stop();
  const entry=state.entries[state.level];entry.draft=el("sql").value;save();
  el("activity").textContent=entry.submission && entry.submission.sql!==entry.draft ? "Query edited. Run it to check the result.":"";
  renderFinding();
}
async function run(){
  if(busy)return;
  const index=state.level,level=quest[index],entry=state.entries[index];
  const sql=el("sql").value;entry.draft=sql;save();
  const id=++token;busy=true;el("run").disabled=true;el("activity").textContent="Reading the registers…";el("finding").hidden=true;
  let reply;
  try{
    reply=sql.trim()?await queryCase(sql,level):{error:"Enter a SQL query first."};
  }catch(e){reply={error:"SQLite could not start in this browser. "+e.message};}
  if(id!==token || reply.cancelled)return;
  busy=false;el("run").disabled=false;el("activity").textContent="";
  const verdict=reply.error?mark("SQL error",reply.error,"wrong"):grade(index,reply.result,reply.reference,reply.nearby);
  entry.submission={sql,...verdict,columns:reply.result?.columns || [],rows:reply.result?.rows || []};
  if(verdict.correct)state.earned=Math.max(state.earned,index+1);
  save();renderBook();renderFinding();
}
for(const name of ["slips","readings","crates","rooms"])el("register-select").add(new Option(name,name));
el("register-select").onchange=e=>renderGuide(e.target.value);
el("sql").oninput=onEdit;
el("sql").onkeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();run();}};
el("run").onclick=run;
el("hint").onclick=()=>{const e=state.entries[state.level];e.hints=Math.min(2,e.hints+1);save();renderHint();};
el("next").onclick=()=>navigate(state.level+1);
el("load").onclick=()=>{el("sql").value=quest[state.level].answer;onEdit();el("sql").focus();};
el("restart").onclick=()=>{
  stop();state=newState();save();el("restart-menu").open=false;render();el("heading").focus();
};
if(location.protocol==="file:")el("download").replaceWith(tag("span","Offline edition"));
render();
