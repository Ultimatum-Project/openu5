/**
 * EXTRACTOR DE MISSES DE ANCLA por RÉPLICA — sonda de la ventana `anclas-f4`.
 *
 *   node re/tools/anclas_misses.mjs <dirR1> [dirR2] [etiqR1] [etiqR2]
 *
 * `anchorsMissed` es un contador MEZCLADO (ver `censo_anclas_f4.mjs`). Un agregado que sube
 * no dice QUÉ falló, y con un contador que varía entre corridas del mismo árbol el agregado
 * no dice ni siquiera si algo falló de verdad. Esta sonda hace dos cosas:
 *
 *  (1) CLASIFICA cada miss por su línea de log en `segments[].resyncs`, que es lo único que
 *      distingue los tres canales:
 *        canal 1  `ANCHOR-MISS '<sees>' …`                       → feature ausente (geometría)
 *        canal 2a `NPC-ANCHOR-MISS '<match>' …`                  → NPC ausente
 *        canal 2b `NPC-TALK '<match>' … NO enganchó la tienda …` → shopOpen=false (enganche)
 *      La suma por parte se CUADRA contra `anchorsMissed` del propio report; si no cuadra, la
 *      sonda lo dice en vez de callarse (un canal nuevo no debe pasar por «resto»).
 *
 *  (2) Con dos dirs, PAREA las réplicas y parte los misses en ESTABLES (fallan en las dos) y
 *      FLIPANTES (fallan en una). La clave de identidad es `(parte, segmento, canal, sujeto,
 *      ordinal)` — el ordinal desempata dos anclas del mismo `match` en el mismo segmento
 *      (`ad06-g34` lleva dos `shop:Healer`), que si no colapsarían en una.
 *      También reporta, por segmento, si `matched`/`comparable` se movieron entre réplicas:
 *      es lo que permite decir si el ruido de anclas y el de conformidad son el MISMO.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const RE_FACE = /^ANCHOR-MISS '([^']*)'/;
const RE_NPC_AUSENTE = /^NPC-ANCHOR-MISS '([^']*)'/;
const RE_NPC_TIENDA = /^NPC-TALK '([^']*)'.*NO enganchó la tienda/;

/**
 * El canal 2b (`shopOpen=false`) es A SU VEZ un bucket de dos causas, y el testigo que las
 * separa NO es el contador: es lo que el PORT imprimió en ese tramo.
 *
 *   2b-VACIA  el (T)alk SÍ se ejecutó y cayó en una celda sin nadie → el port emite
 *             «Funny, no response!» (`main.ts:2394-2395`, la rama `!game.talkTarget(dir)`)
 *   2b-TRAGADA el (T)alk NUNCA llegó al despachador de mapa (un modo vivo se comió la 't':
 *             combate sin resolver, picker, prompt) → el port NO llega a imprimir «Talk-»
 *
 * Meterlas en el mismo saco es lo que hace ilegible el contador: la primera se arregla
 * mirando DÓNDE se planta la party; la segunda, mirando en qué MODO está el juego.
 */
function causa2b(seg) {
  const texto = (seg.blocks ?? []).map((b) => b.snippet ?? "").join(" | ");
  if (/Funny, no response/.test(texto)) return "2b-VACIA";
  if (/Talk-/.test(texto)) return "2b-?";
  return "2b-TRAGADA";
}

/** Clasifica las líneas de `resyncs` de un segmento en misses con canal y sujeto. */
export function clasificarMisses(resyncs) {
  const out = [];
  for (const linea of resyncs ?? []) {
    let m;
    if ((m = RE_FACE.exec(linea))) out.push({ canal: "1-feature", sujeto: m[1] });
    else if ((m = RE_NPC_AUSENTE.exec(linea))) out.push({ canal: "2a-npc", sujeto: m[1] });
    else if ((m = RE_NPC_TIENDA.exec(linea))) out.push({ canal: "2b-tienda", sujeto: m[1] });
  }
  // ordinal por (canal, sujeto) dentro del segmento: dos anclas iguales no colapsan en una
  const vistos = new Map();
  for (const x of out) {
    const k = `${x.canal}|${x.sujeto}`;
    const n = (vistos.get(k) ?? 0) + 1;
    vistos.set(k, n);
    x.ord = n;
  }
  return out;
}

export function cargarReplica(dir) {
  if (!existsSync(dir)) throw new Error(`no existe: ${dir}`);
  const ficheros = readdirSync(dir).filter((f) => f.endsWith(".report.json")).sort();
  // Un dir VACÍO leería como «cero misses» y sería un verde sin dientes: una corrida que no
  // llegó a escribir nada no es una corrida limpia. Se aborta en vez de reportar 0.
  if (ficheros.length === 0) throw new Error(`sin reports: ${dir} — 0 ficheros .report.json (¿la corrida no llegó a escribir?)`);
  const partes = new Map();
  for (const f of ficheros) {
    const parte = basename(f).replace(".report.json", "");
    const rep = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const misses = [];
    const segs = new Map();
    for (const s of rep.segments ?? []) {
      segs.set(s.id, { matched: s.matched, comparable: s.comparable, anchorsMissed: s.anchorsMissed ?? 0 });
      const c2b = causa2b(s);
      for (const x of clasificarMisses(s.resyncs)) misses.push({ parte, seg: s.id, ...x, causa: x.canal === "2b-tienda" ? c2b : x.canal });
    }
    partes.set(parte, { rep, misses, segs, anchorsMissed: rep.anchorsMissed ?? 0, anchorsResolved: rep.anchorsResolved ?? 0 });
  }
  return partes;
}

const clave = (x) => `${x.parte}|${x.seg}|${x.canal}|${x.sujeto}|${x.ord}`;

function main() {
  const [dirA, dirB, etiqA = "R1", etiqB = "R2"] = process.argv.slice(2);
  const A = cargarReplica(dirA);

  // ── (1) clasificación + CUADRE contra el contador del report
  for (const [etiq, M] of dirB ? [[etiqA, A], [etiqB, cargarReplica(dirB)]] : [[etiqA, A]]) {
    const porCanal = { "1-feature": 0, "2a-npc": 0, "2b-tienda": 0 };
    const porCausa = { "2b-VACIA": 0, "2b-TRAGADA": 0, "2b-?": 0 };
    let contador = 0;
    const descuadres = [];
    for (const [parte, p] of M) {
      contador += p.anchorsMissed;
      for (const x of p.misses) {
        porCanal[x.canal]++;
        if (x.canal === "2b-tienda") porCausa[x.causa]++;
      }
      if (p.misses.length !== p.anchorsMissed) descuadres.push(`${parte}: log ${p.misses.length} ≠ anchorsMissed ${p.anchorsMissed}`);
    }
    const suma = Object.values(porCanal).reduce((a, b) => a + b, 0);
    console.log(`\n### ${etiq} — ${M.size} partes · anchorsMissed(report) = ${contador} · misses clasificados = ${suma}`);
    console.log(`  canal 1 feature ausente: ${porCanal["1-feature"]}  ·  canal 2a NPC ausente: ${porCanal["2a-npc"]}  ·  canal 2b tienda no engancha: ${porCanal["2b-tienda"]}`);
    console.log(`  dentro del 2b, por TESTIGO DEL PORT: celda VACÍA («Funny, no response!») ${porCausa["2b-VACIA"]}  ·  Talk TRAGADO (sin «Talk-») ${porCausa["2b-TRAGADA"]}  ·  indeterminado ${porCausa["2b-?"]}`);
    if (descuadres.length) console.log(`  ⚠ DESCUADRE (canal no clasificado): ${descuadres.join(" · ")}`);
    for (const [parte, p] of M) {
      if (!p.misses.length && !p.anchorsMissed) continue;
      console.log(`  ${parte.padEnd(6)} ${String(p.anchorsMissed).padStart(2)} miss / ${String(p.anchorsResolved).padStart(2)} resueltas — ${p.misses.map((x) => `${x.seg}:${x.sujeto}${x.ord > 1 ? `#${x.ord}` : ""}[${x.causa}]`).join(" ")}`);
    }
  }
  if (!dirB) return;

  // ── (2) pareado de réplicas: estables vs flipantes
  const B = cargarReplica(dirB);
  const pareadas = [...A.keys()].filter((p) => B.has(p)).sort();
  const soloA = [...A.keys()].filter((p) => !B.has(p));
  const soloB = [...B.keys()].filter((p) => !A.has(p));
  if (soloA.length || soloB.length) console.log(`\n⚠ FUERA DEL PAREADO — sólo ${etiqA}: ${soloA.join(" ") || "(ninguna)"} · sólo ${etiqB}: ${soloB.join(" ") || "(ninguna)"}`);

  const mA = new Map(), mB = new Map();
  for (const p of pareadas) { for (const x of A.get(p).misses) mA.set(clave(x), x); for (const x of B.get(p).misses) mB.set(clave(x), x); }
  const estables = [...mA.keys()].filter((k) => mB.has(k)).sort();
  const soloEnA = [...mA.keys()].filter((k) => !mB.has(k)).sort();
  const soloEnB = [...mB.keys()].filter((k) => !mA.has(k)).sort();

  console.log(`\n### PAREADO ${etiqA} vs ${etiqB} — ${pareadas.length} partes`);
  console.log(`  ESTABLES (fallan en las DOS): ${estables.length}`);
  for (const k of estables) console.log(`    ${k}`);
  console.log(`  FLIPANTES: ${soloEnA.length + soloEnB.length}  (sólo ${etiqA}: ${soloEnA.length} · sólo ${etiqB}: ${soloEnB.length})`);
  for (const k of soloEnA) console.log(`    sólo ${etiqA}  ${k}`);
  for (const k of soloEnB) console.log(`    sólo ${etiqB}  ${k}`);

  // ── (3) ¿el ruido de anclas y el de conformidad son el MISMO? por segmento
  console.log(`\n### SEGMENTOS: misses y matched/comparable entre réplicas`);
  console.log(`  segmento      ${etiqA.padEnd(14)} ${etiqB.padEnd(14)} Δmiss  Δmatched Δcomparable`);
  let filas = 0;
  for (const p of pareadas) {
    const sa = A.get(p).segs, sb = B.get(p).segs;
    for (const [id, a] of sa) {
      const b = sb.get(id);
      if (!b) { console.log(`  ${id.padEnd(12)} AUSENTE en ${etiqB}`); filas++; continue; }
      const dMiss = b.anchorsMissed - a.anchorsMissed, dM = b.matched - a.matched, dC = b.comparable - a.comparable;
      if (!dMiss && !dM && !dC) continue;
      console.log(`  ${id.padEnd(12)}  ${`${a.anchorsMissed}✗ ${a.matched}/${a.comparable}`.padEnd(14)} ${`${b.anchorsMissed}✗ ${b.matched}/${b.comparable}`.padEnd(14)} ${String(dMiss).padStart(5)} ${String(dM).padStart(9)} ${String(dC).padStart(11)}`);
      filas++;
    }
  }
  if (!filas) console.log(`  (ninguno: las dos réplicas son IDÉNTICAS en misses y en conformidad)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
