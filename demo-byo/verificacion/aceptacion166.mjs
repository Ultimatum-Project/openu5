import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Rutas relativas ANCLADAS al árbol del arnés (ver la nota larga en `censo166.mjs`): con
// `resolve()` pelado, este arnés dejó sus tres PNG del después en la raíz del checkout
// principal del usuario por haberse invocado desde otro `cwd`.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SITIO=resolve(RAIZ, process.argv[2]), SAL=resolve(RAIZ, process.argv[3]);
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".json":"application/json",".woff2":"font/woff2",".webp":"image/webp",".jpg":"image/jpeg",".xml":"application/xml",".txt":"text/plain"};
const srv=createServer(async(q,r)=>{let u=decodeURIComponent(q.url.split("?")[0]);if(u.endsWith("/"))u+="index.html";const f=join(SITIO,u);if(!existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{"content-type":MIME[extname(f)]??"application/octet-stream"});r.end(await readFile(f));});
await new Promise(ok=>srv.listen(0,"127.0.0.1",ok)); const P=srv.address().port;
const nav=await chromium.launch();

// ══ N — EL SUELO DE (A), EN UNA SOLA DEFINICIÓN ═══════════════════════════════════════════
// Cuántos PÍXELES del contenido EN FLUJO caen por debajo del borde SUPERIOR de la barra
// pegajosa, que es la que los tapa. Sustituye a `scrollHeight − clientHeight` como suelo
// desde el 12-08: aquel mezclaba el sesgo del `margin-bottom:-22px` de la barra (infla sin
// ocultar nada) con la oclusión de verdad, y se ponía a cero cuando uno compensaba al otro.
//
// 🔴 VA EN UNA FUNCIÓN Y NO COPIADA EN DOS SITIOS porque el mutante de más abajo la reusa
// TAL CUAL. Un control que mide con un predicado y una guarda que decide con otro no prueba
// nada sobre la guarda que corre: sólo prueba que el predicado del control sabe fallar.
const mideN = () => {
  const p = document.getElementById("openu5-consentimiento");
  p.scrollTop = 0;
  const barra = p.querySelector(".btns").getBoundingClientRect();
  // Sólo lo que está EN FLUJO: la ✕ es `absolute` (vive arriba, no la tapa nadie) y la
  // propia barra es `sticky` — contarla sería medirla contra su propio borde y dar siempre
  // su alto. Se excluye por clase ADEMÁS de por posición: si algún día deja de ser sticky,
  // lo que tiene que pasar es que la guarda siga midiendo lo mismo, no que se autoacuse.
  const flujo = [...p.querySelectorAll(".cnt > *")].filter((n) => {
    const pos = getComputedStyle(n).position;
    return (pos === "static" || pos === "relative") && !n.classList.contains("btns");
  });
  let N = 0, culpable = "";
  for (const n of flujo) {
    const excede = Math.round(n.getBoundingClientRect().bottom - barra.top);
    if (excede > N) { N = excede; culpable = n.tagName.toLowerCase() + (n.className ? `.${String(n.className).trim().split(/\s+/).join(".")}` : ""); }
  }
  return { N, culpable, censados: flujo.length };
};
// La siembra del mutante: un bloque alto JUSTO ANTES de la barra, que es donde empuja al
// resto del contenido por debajo de ella. Se pone y se quita en la misma página.
const siembra = () => {
  const p = document.getElementById("openu5-consentimiento");
  const d = document.createElement("div");
  d.id = "mutante166"; d.style.height = "200px";
  p.querySelector(".btns").before(d);
};
const retira = () => document.getElementById("mutante166")?.remove();
for (const vp of [{n:"390x668-SE",width:390,height:668},{n:"390x844",width:390,height:844},{n:"1280x800",width:1280,height:800}]) {
  const ctx=await nav.newContext({viewport:{width:vp.width,height:vp.height}, locale:"es-ES"});
  const pg=await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${P}/index.html`,{waitUntil:"networkidle"});
  await pg.waitForTimeout(500);
  const o=await pg.evaluate(()=>{
    const p=document.getElementById("openu5-consentimiento");
    const pr=p.getBoundingClientRect();
    // "Visible SIN scroll interno" = con el panel en scrollTop 0, el elemento cae DENTRO
    // de la caja visible del panel.
    p.scrollTop=0;
    // 🔴 «Visible» NO es «dentro de la caja del panel»: la barra pegajosa de botones OCUPA
    // la franja de abajo y TAPA lo que caiga debajo de su borde superior. La primera
    // versión de esta sonda ignoraba eso y firmó CUMPLE con el segundo interruptor
    // escondido tras la barra — lo vi en la captura, no en el número. El techo real es el
    // borde SUPERIOR de la barra.
    const barra=p.querySelector(".btns").getBoundingClientRect();
    // DOS predicados, porque son dos preguntas: el CONTENIDO tiene que caber por encima
    // de la barra (que lo tapa), y la BARRA tiene que caber en el panel (vive dentro de
    // ella). Un único predicado da el veredicto invertido para uno de los dos grupos:
    // con el techo del panel firma CUMPLE con el interruptor escondido tras la barra, y
    // con el techo de la barra declara invisibles a los propios botones.
    const sobreLaBarra=(n)=>{const r=n.getBoundingClientRect();
      return r.top>=pr.top-1 && r.bottom<=Math.min(pr.bottom, barra.top)+1;};
    const enLaBarra=(n)=>{const r=n.getBoundingClientRect();
      return r.top>=pr.top-1 && r.bottom<=pr.bottom+1 && r.top>=0 && r.bottom<=innerHeight+1;};
    const dentro=sobreLaBarra;
    const q=(s)=>p.querySelector(s);
    const labels=[...p.querySelectorAll(".nivel label")];
    const btns=[...p.querySelectorAll("button.act")];
    return {
      panelAlto:Math.round(pr.height), pctVp:+(pr.height/innerHeight).toFixed(3),
      scrollInterno:p.scrollHeight-p.clientHeight,
      titular: dentro(q("h2")),
      frase:   dentro(q(".cnt > p")),
      interruptor1: labels[0]?dentro(labels[0]):null,
      interruptor2: labels[1]?dentro(labels[1]):null,
      boton1: enLaBarra(btns[0]), boton2: enLaBarra(btns[1]),
      botonesConFondo: getComputedStyle(p.querySelector(".btns")).backgroundColor,
      botonesSticky: getComputedStyle(p.querySelector(".btns")).position,
      detallesPlegados: [...p.querySelectorAll("details.mas")].map(d=>d.open),
      // Longitud de la prosa del 1er detalle. 🔴 OJO A LO QUE **NO** DICE: `.det` está en el
      // DOM abierto o cerrado, así que esta cifra vale LO MISMO en los dos estados. Acredita
      // que la prosa EXISTE, no que se pueda LEER. Quien quiera lo segundo, la condición (C)
      // se mide abajo con la ALTURA, que es lo que sí discrimina.
      textoDelDetalle: (p.querySelector("details.mas .det")?.textContent||"").trim().length,
    };
  });
  // EL SUELO. `N` entra en el AND desde el 12-08: la condición (A) del encargo no era «se ven
  // estos seis elementos» sino «no queda contenido oculto», y los seis booleanos de arriba son
  // una MUESTRA de esa condición, no la condición. Con ellos solos, tres viewports firmaron
  // CUMPLE mientras el pie se metía bajo la barra. `N` cierra por lo que hay, no por lo
  // enumerado. Muere con el mutante de más abajo, que corre en cada corrida.
  const base = await pg.evaluate(mideN);
  // CONTROL DE POBLACIÓN: un barrido vacío da `N = 0` y verde con el panel entero escondido.
  // En flujo hay CINCO (h2, la frase, el desplegable de intro, .niveles y .pie): la ✕ es
  // absolute y la barra se excluye a propósito.
  if (base.censados < 5) {
    console.error(`ABORTA (${vp.n}): el barrido de (A) censó ${base.censados} elementos en flujo, se esperaban ≥5 — N=0 sería vacuo.`);
    process.exitCode = 3;
  }
  const ok = o.titular&&o.frase&&o.interruptor1&&o.interruptor2&&o.boton1&&o.boton2&&base.N===0;
  console.log(`${vp.n.padEnd(11)} panel=${String(o.panelAlto).padStart(4)}px (${(o.pctVp*100).toFixed(1)}% vp) · titular=${o.titular} frase=${o.frase} int1=${o.interruptor1} int2=${o.interruptor2} btn1=${o.boton1} btn2=${o.boton2} · N=${base.N}px${base.N ? ` (${base.culpable})` : ""} ⇒ ${ok?"CUMPLE":"NO CUMPLE"}`);
  console.log(`            sticky=${o.botonesSticky} fondo=${o.botonesConFondo} · detalles plegados=${JSON.stringify(o.detallesPlegados)} · prosa del 1º=${o.textoDelDetalle} caracteres`);
  // 🔴 ESTA CIFRA NO ES EL SUELO Y LLEVA SU ETIQUETA PEGADA. `scrollHeight − clientHeight` fue
  // el suelo de (A) hasta el 12-08 y se RETIRÓ como instrumento. La razón, MEDIDA hoy en los
  // tres viewports en vez de supuesta: la cifra SUMA DOS COSAS, y ninguna de las dos es
  // contenido escondido al visitante.
  //   · La COLA DEL MARGEN NEGATIVO de la barra. `.btns` lleva `margin-bottom:-22px` para
  //     apoyarse en el fondo real del panel, y lo que sobra de ese −22 contra el
  //     `padding-bottom` de `.cnt` cuenta como desbordamiento sin tapar nada. Medido: 4 px en
  //     móvil (padding 18) y 0 px en escritorio (padding 22) — o sea 22 − padding, exacto en
  //     los dos regímenes. Por eso NO es una constante y quien espere ~22 leerá mal la línea.
  //   · Lo que el contenido excede del TOPE de 45vh. En el SE: 312 de contenido contra 300 de
  //     tope = 8 px, que con los 4 de arriba dan los 12 que se imprimen. Y lo que asoma por
  //     ahí es la propia barra pegajosa con su cola, no prosa: `N = 0` en ese mismo viewport.
  // O sea que ni sus positivos ni sus ceros significaban lo que parecía. Se sigue IMPRIMIENDO
  // en vez de borrarse porque sus dos sumandos son geometría real del panel (un cambio en el
  // relleno de `.cnt` o en el tope se ve aquí antes que en ningún sitio), y se etiqueta EN LA
  // PROPIA LÍNEA porque quien lea la salida se encuentra «12px» al lado de «N=0px» y, sin la
  // etiqueta, lee una contradicción donde hay dos magnitudes distintas. La condición la
  // decide N.
  console.log(`            diagnóstico (NO es el suelo · magnitud retirada): scrollHeight−clientHeight = ${o.scrollInterno}px — cola del margen de la barra + exceso sobre el tope de 45vh, no contenido oculto`);
  if (SAL) await pg.screenshot({path:`${SAL}/despues__${vp.n}.png`});

  // ── MUTANTE DE (A): la siembra que TIENE que enrojecer el veredicto ──────────────────────
  // 🔴 Va DENTRO del arnés y corre SIEMPRE, no una vez a mano el día que se escribió. Un suelo
  // `N === 0` sobre un panel que ya cumple es indistinguible de un suelo que no sabe fallar
  // —el verde vacuo de siempre—, y la forma de distinguirlos es que el instrumento se rompa a
  // sí mismo en cada corrida y compruebe que lo nota. Va DESPUÉS de la captura para que la
  // foto de referencia sea la del panel de verdad.
  await pg.evaluate(siembra);
  const conSiembra = await pg.evaluate(mideN);
  await pg.evaluate(retira);
  const trasRetirar = await pg.evaluate(mideN);
  const mutanteMuere = conSiembra.N > 0 && trasRetirar.N === base.N;
  console.log(`            mutante de (A): con 200px sembrados N=${conSiembra.N}px (${conSiembra.culpable||"—"}) · retirada la siembra N=${trasRetirar.N}px ⇒ ${mutanteMuere?"MUERE (el suelo sabe fallar)":"SOBREVIVE — EL SUELO NO VIGILA NADA"}`);
  if (!mutanteMuere) {
    console.error(`ABORTA (${vp.n}): el mutante de (A) sobrevive — N no se movió al sembrar 200px, o no volvió a ${base.N} al retirarlos.`);
    process.exitCode = 3;
  }

  // ── CONDICIÓN (C): «Ver detalles» REVELA la prosa, y sólo si lo pides ────────────────
  // Va DESPUÉS de la captura a propósito: la foto de referencia tiene que enseñar el panel
  // como lo ve quien llega, y a partir de aquí lo manipulamos.
  // 🔴 DOS PREDICADOS CIEGOS DESCARTADOS ANTES DE LLEGAR A ÉSTE, y conviene que consten
  // porque los dos PARECÍAN medir lo que la condición pide:
  //   1) `textContent.length` — `.det` está en el DOM abierto o cerrado, así que la longitud
  //      vale lo mismo en los dos estados. Ciego por construcción.
  //   2) `getBoundingClientRect().height` — Chromium apaga el contenido de un `<details>`
  //      cerrado con `content-visibility:hidden`, y el rect de un descendiente de un subárbol
  //      así devuelve la geometría **PRESERVADA**, no ceros. Medí 96 px con `open:false` y
  //      canté «no se pliega» sobre un panel que se pliega perfectamente (lo desmintió la
  //      CAPTURA). ⇒ «alto > 0» NO prueba que algo se vea.
  // Los dos canales de abajo viven FUERA del subárbol apagado, que es lo que los salva:
  //   · `checkVisibility({contentVisibilityAuto})` responde explícitamente por el apagado.
  //   · `scrollHeight` DEL PANEL es una magnitud del ANCESTRO: si al abrir entra contenido,
  //     crece. No puede leer geometría preservada de un hijo porque no mira al hijo.
  const medirDetalle = () => pg.evaluate(() => {
    const p = document.getElementById("openu5-consentimiento");
    const d = p.querySelector("details.mas");
    const det = d.querySelector(".det");
    return {
      abierto: d.open,
      seVe: det.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }),
      altoDelPanel: p.scrollHeight,
    };
  });
  const plegado = await medirDetalle();
  await pg.click("#openu5-consentimiento details.mas > summary");
  await pg.waitForTimeout(200);
  const abierto = await medirDetalle();
  const crecio = abierto.altoDelPanel - plegado.altoDelPanel;
  const revela = !plegado.abierto && !plegado.seVe && abierto.abierto && abierto.seVe && crecio > 0;
  console.log(`            (C) detalle: plegado abierto=${plegado.abierto} seVe=${plegado.seVe} → tras pulsar abierto=${abierto.abierto} seVe=${abierto.seVe} · el panel crece ${crecio}px ⇒ ${revela?"REVELA":"NO REVELA"}`);
  // CONTROL DE NO-VACUIDAD: un detalle que se declara abierto y no añade NI UN PÍXEL al panel
  // es el fallo que (C) teme — «abierto» y nada que leer. No puede salir como verde.
  if (abierto.abierto && crecio === 0) {
    console.error(`ABORTA (${vp.n}): el detalle abre y el panel no crece ni un píxel.`);
    process.exitCode = 3;
  }
  if (!ok || !revela) process.exitCode = process.exitCode || 2;
  await ctx.close();
}
await nav.close(); srv.close();
