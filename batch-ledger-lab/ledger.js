"use strict";

const byId=id=>document.getElementById(id);
const currency=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
const amount=cents=>currency.format(cents/100);
const quantity=n=>n.toLocaleString("en-US");
const draftPrefix="batch-ledger-practice.1.";
const fallback=new Map();
let sheetId="candles", journal=[], staged=null, busy=false, loadPass=0;
let inMemory=false, draftStorage=true, broadcaster;

function element(tag, text, cls) {
  const node=document.createElement(tag);
  if (text !== undefined) node.textContent=text;
  if (cls) node.className=cls;
  return node;
}
function notify(text) {byId("notice").textContent=text;}
function storageLabel() {
  byId("storage-note").textContent=inMemory || !draftStorage
    ? "Some browser storage is unavailable. Export your ledger before closing this tab."
    : "Practice data stays in this browser.";
}
function openDatabase() {
  return new Promise(resolve=>{
    try {
      const request=indexedDB.open("batch-ledger-practice",1);
      request.onupgradeneeded=()=>request.result.createObjectStore("journals");
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
      request.onsuccess=()=>resolve(request.result);
    } catch {resolve(null);}
  }).then(db=>{inMemory=!db; storageLabel();return db;});
}
const database=openDatabase();

async function readJournal(key) {
  const db=await database;
  if (!db) return fallback.get(key)||[];
  return new Promise((resolve,reject)=>{
    const request=db.transaction("journals").objectStore("journals").get(key);
    request.onsuccess=()=>resolve(request.result||[]);
    request.onerror=()=>reject(Error("The saved ledger could not be read. Reload to try again."));
  });
}
async function writeJournal(key,version,action,inputs) {
  const apply=entries=>{
    if (entries.length!==version) throw Error("Another tab changed the ledger. Check stock again before posting or reversing.");
    return action==="post" ? BatchCost.post(BatchCost.cases[key],entries,inputs) : BatchCost.reverse(entries);
  };
  const db=await database;
  if (!db) {
    const entry=apply(fallback.get(key)||[]); fallback.set(key,entry); return entry;
  }
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction("journals","readwrite");
    const store=transaction.objectStore("journals");
    const req=store.get(key);
    let result,problem;
    req.onsuccess=()=>{
      try {result=apply(req.result||[]);store.put(result,key);}
      catch (e) {problem=e;transaction.abort();}
    };
    transaction.oncomplete=()=>resolve(result);
    transaction.onabort=()=>reject(problem || Error("Stock was not changed. Retry after your browser can save."));
    transaction.onerror=()=>{};
  });
}
function draft(key) {
  let values;
  try {values=JSON.parse(localStorage.getItem(draftPrefix+key));}
  catch {draftStorage=false;storageLabel();}
  return Array.isArray(values) && values.length===5 && values.every(v=>typeof v==="string"||typeof v==="number") ? values : BatchCost.cases[key].initial;
}
function inputs() {return ["output","goods0","scrap0","goods1","scrap1"].map(id=>byId(id).value);}
function rememberDraft() {
  try {localStorage.setItem(draftPrefix+sheetId,JSON.stringify(inputs()));}
  catch {draftStorage=false;storageLabel();}
}
function makeInputs() {
  const scenario=BatchCost.cases[sheetId], values=draft(sheetId);
  byId("brief").textContent=scenario.brief; byId("output").value=values[0];
  byId("materials").replaceChildren(...scenario.lots.map((lot,i)=>{
    const row=element("tr"),name=element("th",lot.name+" ("+lot.unit+")");
    name.scope="row";row.append(name);
    ["goods","scrap"].forEach((key,j)=>{
      const cell=element("td"),input=element("input");
      input.type="number";input.min=0;input.max=100000;input.step=1;input.required=true;
      input.inputMode="numeric";input.id=key+i;
      input.setAttribute("aria-label",lot.name+" "+(j?"scrap":"in finished goods")+" in "+lot.unit);
      input.value=values[1+i*2+j];cell.append(input);row.append(cell);
    });
    return row;
  }));
}
function line(dl,name,val) {
  const row=element("div");row.append(element("dt",name),element("dd",val));dl.append(row);
}
function update() {
  const scenario=BatchCost.cases[sheetId], posted=BatchCost.active(journal);
  for (const key of Object.keys(BatchCost.cases)) byId(key).setAttribute("aria-pressed",String(key===sheetId));
  byId("fields").disabled=!!posted || busy;byId("preview").hidden=!!posted;byId("preview").disabled=busy;
  byId("undo").hidden=!posted;byId("reverse").disabled=busy;
  if(posted) {
    byId("output").value=posted.batch.output;
    posted.batch.lines.forEach((row,i)=>{byId("goods"+i).value=row.goods;byId("scrap"+i).value=row.scrap;});
  }
  const receipt=posted?.batch||staged?.batch;
  byId("preview-panel").hidden=!receipt;
  byId("post").hidden=!!posted;byId("post").disabled=busy||!staged;
  if(receipt) {
    byId("receipt-title").textContent=posted?"Posted cost":"Cost preview";
    const dl=byId("cost-lines");dl.replaceChildren();receipt.lines.forEach((item,i)=>line(dl,scenario.lots[i].name+" · "+quantity(item.used)+" "+scenario.lots[i].unit,amount(item.cents)));
    byId("total").textContent=amount(receipt.total);byId("per-unit").textContent=amount(receipt.total/receipt.output);
    byId("rounding").textContent="Average for "+quantity(receipt.output)+" "+scenario.item+", rounded to the nearest cent.";
  }
  const stock=BatchCost.balance(scenario,journal);
  byId("stock-state").textContent=posted?"After posting run "+posted.run+".":"At the opening balance.";
  byId("lots").replaceChildren(...stock.map((item,i)=>{
    const lot=scenario.lots[i],box=element("div",undefined,"lot"),head=element("div",undefined,"lot-head");
    head.append(element("strong",lot.name),element("span",quantity(item.quantity)+" "+lot.unit));
    const track=element("div",undefined,"track"),fill=element("div",undefined,"fill");
    track.setAttribute("aria-hidden","true");fill.style.width=(100*item.quantity/lot.quantity)+"%";track.append(fill);
    const foot=element("p",amount(item.cents)+" remains from "+quantity(lot.quantity)+" "+lot.unit+" at "+amount(lot.cents)+".","lot-foot");
    box.append(head,track,foot);return box;
  }));
  byId("events").replaceChildren(...journal.map(e=>{
    const row=element("li");
    row.append(element("strong",(e.type==="posted"?"Posted":"Reversed")+" run "+e.run),element("small",amount(e.batch.total)+(e.type==="posted"?" to ":" returned from ")+e.batch.output+" "+scenario.item));
    return row;
  }));
  byId("empty-history").hidden=journal.length>0;byId("download").hidden=!journal.length;
}
async function openCase(key) {
  if (busy) return;
  const turn=++loadPass;
  sheetId=key;staged=null;busy=true;journal=[];
  makeInputs();notify("");update();
  try {const saved=await readJournal(key);if(turn===loadPass) journal=saved;}
  catch(e) {notify(e.message);}
  finally {if(turn===loadPass){busy=false;update();}}
}
async function sync(key) {
  if(key!==sheetId || busy) return;
  const turn=loadPass,version=journal.length;
  try {
    const newer=await readJournal(key);
    if(turn!==loadPass || busy || newer.length<=Math.max(version,journal.length)) return;
    journal=newer;staged=null;notify("The stock and movement history were updated in another tab.");update();
  } catch(e) {notify(e.message);}
}
async function commit(action) {
  if(busy || (action==="post" && !staged)) return;
  const key=sheetId,version=action==="post"?staged.version:journal.length,values=staged?.inputs;
  busy=true;update();
  try {
    journal=await writeJournal(key,version,action,values);staged=null;
    notify(action==="post"?"Batch posted. The quantities and cents have moved out of stock.":"Reversed. Both lots have their opening quantities and cents again.");
    broadcaster?.postMessage(key);
  } catch(e) {
    try {journal=await readJournal(key);} catch {}
    staged=null;notify(e.message);
  } finally {busy=false;update();}
}
byId("sheet").addEventListener("submit",e=>{
  e.preventDefault();
  if(busy || BatchCost.active(journal))return;
  const values=inputs().map(Number);
  try {
    const batch=BatchCost.calculate(BatchCost.cases[sheetId],values);staged={inputs:values,batch,version:journal.length};
    notify("Preview ready. Stock has not moved.");update();byId("receipt-title").scrollIntoView({block:"nearest"});
  } catch(e) {staged=null;notify(e.message);update();}
});
byId("sheet").addEventListener("input",()=>{staged=null;rememberDraft();notify("");update();});
for(const key of Object.keys(BatchCost.cases))byId(key).addEventListener("click",()=>{
  if (busy || sheetId === key) return;
  try {history.replaceState(null,"","#"+key);} catch {}
  openCase(key);
});
byId("post").addEventListener("click",()=>commit("post"));
byId("reverse").addEventListener("click",()=>commit("reverse"));
byId("download").addEventListener("click",()=>{
  const bytes=BatchCost.csv(BatchCost.cases[sheetId],journal);
  const url=URL.createObjectURL(new Blob([bytes],{type:"text/csv;charset=utf-8"})),link=element("a");
  link.href=url;link.download=sheetId+"-ledger.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
});
try {broadcaster=new BroadcastChannel("batch-ledger-practice");broadcaster.onmessage=e=>sync(e.data);} catch {}
window.addEventListener("focus",()=>sync(sheetId));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync(sheetId);});
if(location.protocol==="file:")byId("offline").hidden=true;
openCase(Object.hasOwn(BatchCost.cases,location.hash.slice(1))?location.hash.slice(1):"candles");
