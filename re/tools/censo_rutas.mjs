import { readFileSync } from "node:fs";
const rows=[];
for (let i=1;i<=24;i++){
  const id=String(i).padStart(2,"0");
  let r; try{ r=JSON.parse(readFileSync(process.argv[2]+`/part${id}.route.json`,"utf8")); }catch(e){ continue; }
  const segs=r.segments||r.segs||[];
  const c={todo:0,nav:0,key:0,typed:0,gap:0,other:0};
  let tot=0;
  for(const s of segs) for(const op of (s.script||[])){
    tot++;
    const k=Object.keys(op)[0];
    if(k in c) c[k]++; else c.other++;
  }
  rows.push({part:`part${id}`,segs:segs.length,ops:tot,todo:c.todo,pct:tot?(100*c.todo/tot):0,nav:c.nav,key:c.key,typed:c.typed,gap:c.gap,other:c.other});
}
console.log("part    segs   ops   todo   %todo   nav   key  typed   gap  other");
for(const r of rows) console.log(`${r.part}  ${String(r.segs).padStart(5)} ${String(r.ops).padStart(5)} ${String(r.todo).padStart(6)}  ${r.pct.toFixed(1).padStart(5)}% ${String(r.nav).padStart(5)} ${String(r.key).padStart(5)} ${String(r.typed).padStart(6)} ${String(r.gap).padStart(5)} ${String(r.other).padStart(5)}`);
