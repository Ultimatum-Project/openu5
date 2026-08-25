import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Ruta relativa ANCLADA al árbol del arnés (ver la nota larga en `censo166.mjs`).
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SITIO = resolve(RAIZ, process.argv[2]);
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".json":"application/json",".woff2":"font/woff2",".webp":"image/webp",".jpg":"image/jpeg",".xml":"application/xml",".txt":"text/plain"};
const srv=createServer(async(req,res)=>{let r=decodeURIComponent(req.url.split("?")[0]);if(r.endsWith("/"))r+="index.html";const f=join(SITIO,r);if(!existsSync(f)){res.writeHead(404);res.end();return;}res.writeHead(200,{"content-type":MIME[extname(f)]??"application/octet-stream"});res.end(await readFile(f));});
await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));
const P=srv.address().port;
const nav=await chromium.launch();
for (const vp of [{n:"390x844",width:390,height:844},{n:"1280x800",width:1280,height:800},{n:"390x668 (SE)",width:390,height:668}]) {
  const ctx=await nav.newContext({viewport:{width:vp.width,height:vp.height}});
  const pg=await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${P}/index.html`,{waitUntil:"networkidle"});
  await pg.waitForTimeout(400);
  const o=await pg.evaluate(()=>{
    const p=document.getElementById("openu5-consentimiento");
    const vh=window.innerHeight;
    const btns=[...p.querySelectorAll("button.act")].map(b=>{
      const r=b.getBoundingClientRect();
      return {texto:(b.textContent||"").trim().slice(0,24), top:Math.round(r.top), bottom:Math.round(r.bottom),
              dentroDelViewport: r.top>=0 && r.bottom<=vh};
    });
    const pr=p.getBoundingClientRect();
    return {vh, panelTop:Math.round(pr.top), panelAlto:Math.round(pr.height),
            scrollInternoDelPanel: p.scrollHeight - p.clientHeight, botones:btns};
  });
  console.log(vp.n, JSON.stringify(o,null,1));
  await ctx.close();
}
await nav.close(); srv.close();
