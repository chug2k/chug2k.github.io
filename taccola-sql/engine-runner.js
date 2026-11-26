"use strict";
// This function is serialized into an isolated Worker so file:// editions can run SQLite.
function sqliteSession(){
  self.onmessage=async ({data})=>{
    let db;
    try{
      const bytes=Uint8Array.from(atob(data.binary),char=>char.charCodeAt(0));
      const SQL=await initSqlJs({wasmBinary:bytes});
      db=new SQL.Database();
      for(const [name,table] of Object.entries(data.tables)){
        const columns=table.columns.map((s,i)=>s+" "+table.types[i]).join(",");
        db.run("CREATE TABLE "+name+" ("+columns+")");
        const insert=db.prepare("INSERT INTO "+name+" VALUES ("+table.columns.map(()=>"?").join(",")+")");
        try{for(const row of table.rows) insert.run(row);}finally{insert.free();}
      }
      db.run("PRAGMA query_only=ON");
      function read(sql){
        let columns=null;const rows=[];
        // Iterate SQLite's prepared statements so comments and quoted semicolons work.
        for(const statement of db.iterateStatements(sql)){
          if(columns) throw Error("Run one query at a time.");
          columns=statement.getColumnNames();
          if(!columns.length) throw Error("Use a read-only query that returns columns.");
          while(statement.step()){
            if(rows.length===60) throw Error("This query returned over 60 rows. Narrow it to the case records.");
            const row=statement.get();
            if(row.some(cell=>typeof cell==="string" && cell.length>2000 || cell instanceof Uint8Array))
              throw Error("Choose short text or numeric case records for the evidence table.");
            rows.push(row);
          }
        }
        if(!columns) throw Error("Enter a SQL query first.");
        return {columns,rows};
      }
      const reference=read(data.answer),nearby=data.plausible?read(data.plausible):null;
      self.postMessage({result:read(data.sql),reference,nearby});
    }catch(e){self.postMessage({error:e.message});}
    finally{if(db)db.close();}
  };
}
const runnerUrl=URL.createObjectURL(new Blob([window.BELL_ENGINE.runtime,"\n;(",sqliteSession.toString(),")();"],{type:"text/javascript"}));
let activeRun=null;
function cancelQuery(){
  if(!activeRun)return;
  activeRun.finish({cancelled:true});
}
function queryCase(sql,level){
  cancelQuery();
  return new Promise(resolve=>{
    const worker=new Worker(runnerUrl);
    const finish=value=>{
      clearTimeout(timer);worker.terminate();if(activeRun?.worker===worker)activeRun=null;resolve(value);
    };
    const timer=setTimeout(()=>finish({error:"This query took too long. Narrow the search and run it again."}),4000);
    activeRun={worker,finish};
    worker.onerror=e=>{e.preventDefault();finish({error:"SQLite could not finish this query. Try a smaller query."});};
    worker.onmessage=({data})=>finish(data);
    worker.postMessage({sql,tables:window.BELL_TABLES,answer:level.answer,plausible:level.plausible,binary:window.BELL_ENGINE.binary});
  });
}
