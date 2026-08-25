/**
 * VENTANA `f6-24` — el coste de F-6 sobre las partes que `agregado-23` §12.6 dejó sin medir.
 *
 * Esta herramienta ES el pre-registro ejecutable: los tres predicados que deciden qué se
 * adjudica y cómo viven AQUÍ, commiteados ANTES de mirar un solo report
 * ([[preregistro-como-commit-propio]], [[cifra-sin-sonda-commiteada]]). Si al correr aparece un
 * BUG, se arregla el bug y se DECLARA; lo que no se toca es el criterio.
 *
 *   node re/tools/f6_ventana24.mjs <dirBrazoH> <dirBrazoRev> [parte…]
 *
 * Cada dir es un `ESPEJO_OUT` con `<parte>.report.json` y `<parte>.transcript.json`.
 *
 * ── POR QUÉ EL CRIBADO NO ES EL `Δ` NETO (corrección del lead, y es el defecto que esta misma
 *    acta documentó en `beats-combate` §11.4): en `ad06-g34` el neto era `+5` y por dentro eran
 *    `+8 / −3`. Un neto CERO no dice «no se movió nada», dice «lo que se movió se canceló» — y
 *    esas son justo las partes que nadie volvería a mirar. El filtro es el CHURN.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 1 — CHURN (el cribado de la fase 1)
// ───────────────────────────────────────────────────────────────────────────────────────

/** Clave de identidad de un bloque para el join entre brazos. El `ocrLn` es lo ÚNICO estable:
 *  el índice de bloque se desplaza en cuanto un segmento emite un bloque más. */
const key = (b) => b.ocrLn;

/**
 * CHURN de un segmento: cuántos `ocrLn` cambian de `verdict` o de `class` entre los dos brazos,
 * MÁS los que existen en un brazo y no en el otro. Por diferencia de conjuntos, no por posición
 * ([[emparejar-por-linea-no-es-emparejar]]).
 *
 * Un segmento con churn 0 es un segmento IDÉNTICO bloque a bloque; cualquier otra cosa entra a
 * fase 2, **aunque su `matched` y su `comparable` sean los mismos en los dos brazos**.
 */
export function churnSegmento(blocksH, blocksRev) {
  const h = new Map((blocksH ?? []).map((b) => [key(b), b]));
  const r = new Map((blocksRev ?? []).map((b) => [key(b), b]));
  let n = 0;
  for (const [k, b] of h) {
    const o = r.get(k);
    if (!o) n++;
    else if (b.verdict !== o.verdict || b.class !== o.class) n++;
  }
  for (const k of r.keys()) if (!h.has(k)) n++;
  return n;
}

/** CHURN de una parte = suma del de sus segmentos + los segmentos que sólo existen en un brazo
 *  (un segmento ausente es churn máximo: no se puede comparar y hay que mirarlo). */
export function churnParte(repH, repRev) {
  const h = new Map(repH.segments.map((s) => [s.id, s]));
  const r = new Map(repRev.segments.map((s) => [s.id, s]));
  let total = 0;
  const porSegmento = [];
  for (const [id, s] of h) {
    const o = r.get(id);
    const c = o ? churnSegmento(s.blocks, o.blocks) : (s.blocks?.length ?? 0);
    if (c > 0) porSegmento.push({ id, churn: c, ausenteEnRev: !o });
    total += c;
  }
  for (const [id, s] of r) if (!h.has(id)) { const c = s.blocks?.length ?? 0; porSegmento.push({ id, churn: c, ausenteEnH: true }); total += c; }
  return { total, porSegmento };
}

// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 2 — ¿la pérdida es de VEREDICTO (real) o de CLASE (sale del denominador)?
// ───────────────────────────────────────────────────────────────────────────────────────

const CASA = new Set(["match", "covered"]);

/**
 * Clasifica lo que le pasa a UN bloque al pasar del brazo viejo (`Rev`) al nuevo (`H`).
 * Dirección fijada a propósito: la pregunta de la ventana es «qué COSTÓ F-6», así que el
 * brazo de referencia es `Rev` (sin F-6) y el medido es `H` (main, con F-6).
 *
 *  · `perdida-veredicto` — casaba y ya no, y el bloque SIGUE siendo comparable ⇒ pérdida REAL.
 *  · `sale-del-denominador` — casaba y ya no, pero además cambió de CLASE a un veredicto que no
 *    es `divergent` (los buckets `combat-rng`, `sala-diferida`, `presentacion`…) ⇒ el bloque
 *    salió del denominador. NO se lee como absolución por sí solo: hay que pasarle el predicado 3.
 *  · `ganancia` — no casaba y ahora sí.
 *  · `igual` — ni una cosa ni otra.
 */
export function clasificaBloque(bRev, bH) {
  if (!bRev || !bH) return "solo-en-un-brazo";
  const antes = CASA.has(bRev.verdict);
  const ahora = CASA.has(bH.verdict);
  if (antes && !ahora) return bRev.class !== bH.class && bH.verdict !== "divergent" ? "sale-del-denominador" : "perdida-veredicto";
  if (!antes && ahora) return "ganancia";
  return "igual";
}

// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 3 — ¿el port corría un combate SUYO en el brazo viejo?
// ───────────────────────────────────────────────────────────────────────────────────────

const RE_CONFLICT = /\*{2,}\s*C[O0]NFLICT\s*\*{2,}/i;
const RE_ATTACKED = /^\s*Attacked!\s*$/i;

/** Normaliza un nombre de bicho para comparar port contra OCR: mayúsculas, sin puntuación, y
 *  sin la `S` final (el port dice `ORCS` en el banner y `Orc` en las líneas de tirada). */
export function folddBicho(s) {
  const t = String(s).toUpperCase().replace(/[^A-Z ]/g, "").trim();
  return t.endsWith("S") ? t.slice(0, -1) : t;
}

/**
 * ★★ EL PREDICADO QUE SALVÓ `ad01` de publicar un −17 mal partido, escrito como código y no como
 * prosa (exigencia del lead).
 *
 * Devuelve, para UN segmento y UN brazo:
 *   · `sin-combate`      — el port no entró en combate en ese brazo.
 *   · `combate-propio`   — el port peleó Y el bicho que nombra su banner NO aparece en el texto
 *                          que el corpus espera para ese segmento ⇒ es un encuentro del PORT, y
 *                          los bloques que casan contra él son BILLETES DE LOTERÍA.
 *   · `combate-del-lp`   — el port peleó y el bicho SÍ aparece en el corpus ⇒ el material tiene
 *                          contraparte; no se adjudica como lotería por esta vía.
 *   · `combate-sin-bicho`— el port peleó pero el banner no da un nombre legible ⇒ **NO ADJUDICABLE**
 *                          y se declara. No se adivina ([[no-adjudicable-aqui-no-es-no-adjudicable]]).
 *
 * El banner es la línea NO VACÍA anterior al `*** CONFLICT ***` (así lo imprime el port:
 * `Attacked!` / `      ORCS` / `*** CONFLICT ***`); si no hay `CONFLICT`, la siguiente no vacía
 * tras un `Attacked!`.
 */
export function combateDelPort(transcriptSeg, expectTextos) {
  const t = (transcriptSeg ?? []).map((x) => String(x));
  let bicho = null;
  const iC = t.findIndex((l) => RE_CONFLICT.test(l));
  if (iC >= 0) {
    for (let i = iC - 1; i >= 0 && iC - i <= 3; i--) {
      const l = t[i].trim();
      if (l && !RE_ATTACKED.test(l)) { bicho = l; break; }
    }
  } else {
    const iA = t.findIndex((l) => RE_ATTACKED.test(l));
    if (iA < 0) return { veredicto: "sin-combate", bicho: null };
    for (let i = iA + 1; i < t.length && i - iA <= 3; i++) {
      const l = t[i].trim();
      if (l) { bicho = l; break; }
    }
  }
  if (!bicho) return { veredicto: "combate-sin-bicho", bicho: null };
  const f = folddBicho(bicho);
  if (f.length < 3) return { veredicto: "combate-sin-bicho", bicho };
  const corpus = folddBicho((expectTextos ?? []).join(" "));
  // palabra COMPLETA: `ORC` no debe casar dentro de `TORCH`
  const enCorpus = new RegExp(`(^| )${f}S?( |$)`).test(corpus);
  return { veredicto: enCorpus ? "combate-del-lp" : "combate-propio", bicho };
}

// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 4 — el ledger de las partes SELLADAS, que se comprueba SIEMPRE
// ───────────────────────────────────────────────────────────────────────────────────────

/** Partes con delta de ledger SELLADO que caen dentro de la ventana. Su comprobación NO depende
 *  del cribado: [[deltas-sellados-descansan-en-el-reloj]] — la conformidad puede SUBIR mientras
 *  el sello se rompe (`ad06-g34`: +5 bloques y `220 ✓ → 212 ✗`), así que ninguna de las dos
 *  cifras absuelve a la otra. */
export const PARTES_SELLADAS = { ad06: "ad06-g34", ad09: "ad09-g04", ad21: "ad21-g26" };

/** ¿Se movió algún delta de ledger entre brazos? Compara el array ENTERO, no sólo el sellado:
 *  un delta que APARECE o DESAPARECE también es un movimiento. */
export function ledgerSeMueve(repH, repRev) {
  const a = JSON.stringify(repRev.ledger?.ledgerDeltas ?? []);
  const b = JSON.stringify(repH.ledger?.ledgerDeltas ?? []);
  return a !== b ? { movido: true, rev: a, h: b } : { movido: false };
}


// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 5 — DENOMINADOR NO CONDUCIDO (censo, corrección del lead)
// ───────────────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 EL PREDICADO QUE **NO** SE USA, Y POR QUÉ — se deja escrito para que nadie lo re-proponga.
 *
 * Mi primera idea fue «comparables en ventanas donde el port NO EMITIÓ NADA». **Está en la capa
 * equivocada** y lo cazó el lead: ese predicado mezcla dos cosas OPUESTAS.
 *   (i) el arnés no pulsó nada ⇒ el port no tuvo ocasión ⇒ el bloque no es comparable;
 *   (ii) el arnés condujo BIEN y el port se quedó CALLADO ⇒ el bloque **sí** es comparable y es
 *        un fallo REAL de fidelidad — de los que el espejo existe para encontrar.
 * Las dos producen «el port no emitió». Retirar por ahí se llevaría por delante los fallos del
 * port, **y retirar SUBE el porcentaje**: un instrumento que se absuelve justo donde más duele.
 * [[medir-en-la-capa-equivocada]].
 *
 * El discriminante vive en el lado del **ARNÉS**: qué ops del guion NO llegó a pulsar. Y además
 * captura la forma que el otro proxy no ve —el segmento que emite 2 líneas contra 300 bloques—
 * porque **no mira cuánto salió, mira cuánto se intentó**.
 *
 * ⚠ VOCABULARIO, y es normativo para el acta: «NO CONDUCIDO» significa **el instrumento no pulsó
 * lo que hacía falta**, y sólo eso. Un bloque que el port pudo haber ganado y perdió **no** es no
 * conducido: es PERDIDO. Confundirlos es el error de arriba con otro nombre.
 */

/** Ops del guion que el arnés NO condujo, con sus tres componentes SEPARADOS (un número mezclado
 *  no deja ver cuál manda, y son mecanismos distintos: corpus sin convertir · gate de sala ·
 *  typed sin sumidero). */
export function opsNoConducidas(seg) {
  const todos = seg.todosSkipped ?? 0;
  const sala = seg.salaOpsSkipped ?? 0;
  const typed = seg.typedSkipped ?? 0;
  return { todos, sala, typed, total: todos + sala + typed };
}

/** Fracción del guion que el arnés no condujo. `opsTotales` viene del CORPUS (largo del script),
 *  no del report: es el denominador honesto de «cuánto se intentó». `null` si no se conoce. */
export function fraccionNoConducida(seg, opsTotales) {
  if (!opsTotales) return null;
  return Math.min(1, opsNoConducidas(seg).total / opsTotales);
}

/** BANDAS pre-registradas de la curva. No es un umbral: es una curva, para que la respuesta no
 *  dependa de dónde puse el corte. */
export const BANDAS_NO_CONDUCIDO = [0.9, 0.75, 0.5, 0.25, 0];

/**
 * CURVA del denominador por fracción no conducida: cuántos `comparable` cuelgan de segmentos con
 * ≥90 % de ops no conducidas, ≥75 %, etc. Acumulada y descendente.
 * `opsPorSegmento` = mapa id → nº de ops del script en el CORPUS.
 */
export function curvaDenominador(rep, opsPorSegmento) {
  const filas = BANDAS_NO_CONDUCIDO.map((b) => ({ banda: b, segmentos: 0, comparable: 0, matched: 0 }));
  let sinDato = { segmentos: 0, comparable: 0 };
  for (const s of rep.segments) {
    const f = fraccionNoConducida(s, opsPorSegmento?.[s.id]);
    if (f === null) { sinDato.segmentos++; sinDato.comparable += s.comparable; continue; }
    for (const fila of filas) if (f >= fila.banda) { fila.segmentos++; fila.comparable += s.comparable; fila.matched += s.matched; }
  }
  return { filas, sinDato, totalComparable: rep.comparable, totalMatched: rep.matched };
}


// ───────────────────────────────────────────────────────────────────────────────────────
// PREDICADO 6 — MARGEN AL BORDE DE HORARIO (§A2 del pre-registro)
// ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Horas a las que un NPC CAMBIA de tramo de horario. Se deriva de `scheduleIndex` —el port
 * EXACTO de `schedule_index` (NPC.OVL:0x12E0) que vive en `censo_sombra_mercader.mjs`— y NO se
 * re-deriva aquí: reutilizar el primitivo del binario es lo que impide que esta magnitud sea una
 * opinión. `scheduleIndex` se pasa como argumento para no duplicar el port ni acoplar módulos.
 */
export function fronterasHorario(times, scheduleIndexFn) {
  const f = [];
  for (let h = 0; h < 24; h++) {
    const prev = (h + 23) % 24;
    if (scheduleIndexFn(times, h) !== scheduleIndexFn(times, prev)) f.push(h);
  }
  return f;
}

/**
 * MARGEN en minutos de juego entre un reloj y la frontera de horario más cercana, en CUALQUIERA
 * de los dos sentidos (antes o después) y con vuelta por medianoche. `null` si el NPC no tiene
 * frontera (horario constante: nunca cambia de tramo, así que no hay borde que cruzar).
 *
 * ⚠ El mínimo se toma sobre el CÍRCULO de 24 h: un reloj a las 23:50 está a 10 min de una
 * frontera a las 00:00, no a 23 h 50. Un `Math.abs` sin la vuelta daría el número grande y
 * declararía «margen de sobra» justo en el caso peor.
 */
export function margenAFrontera(hour, minute, fronteras) {
  if (!fronteras || fronteras.length === 0) return null;
  const t = hour * 60 + minute;
  let best = Infinity;
  for (const h of fronteras) {
    const d = Math.abs(t - h * 60);
    best = Math.min(best, d, 24 * 60 - d);
  }
  return best;
}

// ───────────────────────────────────────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────────────────────────────────────

function leer(dir, parte, tipo) {
  const p = join(dir, `${parte}.${tipo}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

function main() {
  const [dirH, dirRev, ...partes] = process.argv.slice(2);
  if (!dirH || !dirRev) {
    console.error("uso: node re/tools/f6_ventana24.mjs <dirBrazoH> <dirBrazoRev> [parte…]");
    process.exit(2);
  }
  let pasan = 0;
  const filas = [];
  for (const parte of partes) {
    const rh = leer(dirH, parte, "report");
    const rr = leer(dirRev, parte, "report");
    if (!rh || !rr) { filas.push({ parte, estado: "PENDIENTE" }); continue; }
    const ch = churnParte(rh, rr);
    const led = ledgerSeMueve(rh, rr);
    const dm = rh.matched - rr.matched;
    const dc = rh.comparable - rr.comparable;
    if (ch.total > 0) pasan++;
    filas.push({
      parte,
      rev: `${rr.matched}/${rr.comparable}`,
      h: `${rh.matched}/${rh.comparable}`,
      dm,
      dc,
      churn: ch.total,
      segs: ch.porSegmento.length,
      sellada: PARTES_SELLADAS[parte] ?? "",
      ledger: led.movido ? "🔴 MOVIDO" : "igual",
      fase2: ch.total > 0 ? "SÍ" : "no",
    });
  }
  for (const f of filas) {
    if (f.estado) { console.log(`${f.parte.padEnd(8)} ${f.estado}`); continue; }
    console.log(
      `${f.parte.padEnd(8)} Rev ${f.rev.padEnd(11)} H ${f.h.padEnd(11)} Δm=${String(f.dm).padStart(4)} Δc=${String(f.dc).padStart(4)}` +
        `  churn=${String(f.churn).padStart(4)} (${f.segs} seg)  fase2=${f.fase2.padEnd(3)}` +
        (f.sellada ? `  SELLADA(${f.sellada}) ledger=${f.ledger}` : ""),
    );
  }
  console.log(`\npartes que pasan a FASE 2: ${pasan} / ${filas.filter((f) => !f.estado).length}`);
  if (pasan > 8) console.log("🔴 REGLA DE PARADA del pre-registro: churn>0 en más de 8 partes → PARAR y avisar al lead antes de la fase 2.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
