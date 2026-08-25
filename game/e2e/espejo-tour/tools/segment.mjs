#!/usr/bin/env node
/**
 * WALKTHROUGH-ESPEJO — segmentador de OCR-logs (Fase A, herramienta de generación).
 *
 * Convierte un OCR-log de un episodio del LP de aulddragon
 * (`original/av-referencia/yt/clips/full-part-logs/partNN.ocrlog.txt`, gitignored)
 * en el ESQUELETO de un guion reproducible `routes/partNN.route.json` como lista de
 * SEGMENTOS TIPADOS con COSTURA explícita (diseño ratificado por el usuario):
 *
 *   · SEGMENTO = {ctx, enter (entrada-esperada), script, expect, exit (salida-esperada)}.
 *     Cada costura (entrada/salida de pueblo, combate, camp) es punto de RESINCRONIZACIÓN
 *     natural y frontera de re-corrida (bisección de derivas).
 *   · el SPAM de movimiento (>North / >Ride East / >Fly North / >Head West…) es el
 *     INPUT-LOG del humano y va al `script` como pasos crudos RLE ({"nav":[…]}) — fuente
 *     PRIMARIA de navegación (replay-por-inputs; el pather de nav.ts es SOLO fallback de
 *     resincronización). Ecos ilegibles por OCR → {"gap":N} (JAMÁS se inventan pasos).
 *   · las KEYWORDS tecleadas por el LP (líneas «:NAME», «Mantra:SUMM»…) se capturan como
 *     {"typed":"NAME"} (el estado más largo de cada racha de tecleo progresivo).
 *   · diálogos/tiendas/prompts = PARÉNTESIS no-movimiento: el resto de texto queda como
 *     {"todo":"…"} en el script (ancla de curación) y como bloque `expect` (evidencia).
 *   · combates = paréntesis con política propia (ctx "combat", cerrado por VICTORY /
 *     BATTLE IS LOST); la resincronización post-combate la hace el runner.
 *
 * El fichero generado es un BORRADOR: la curación (convertir `todo`→acciones, fijar
 * `resync`, clases de expect) se hace A MANO (ver README.md). No pisa un route.json
 * existente salvo --force.
 *
 * Uso:  node e2e/espejo-tour/tools/segment.mjs <ocrlog> <partNN> [--from N] [--force]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** location id del juego (1-based, espacio del .GAM) por banner. Castillos/keeps 14-18
 *  sin nombre en DATA.OVL; dungeons 33-40. Verificado contra locationsX/Y de data.json
 *  (Deceit id 33 = (240,73), Paws id 22 = (98,145)) y F2-T1. */
const LOC_BY_BANNER = {
  MOONGLOW: 1, BRITAIN: 2, JHELOM: 3, YEW: 4, MINOC: 5, TRINSIC: 6,
  "SKARA BRAE": 7, "NEW MAGINCIA": 8, FOGSBANE: 9, STORMCROW: 10, GREYHAVEN: 11,
  WAVEGUIDE: 12, "IOLO'S HUT": 13, "WEST BRITANNY": 19, "NORTH BRITANNY": 20,
  "EAST BRITANNY": 21, PAWS: 22, COVE: 23, "BUCCANEER'S DEN": 24, ARARAT: 25,
  BORDERMARCH: 26, FARTHING: 27, WINDEMERE: 28, STONEGATE: 29, "THE LYCAEUM": 30,
  "EMPATH ABBEY": 31, "SERPENT'S HOLD": 32, DECEIT: 33, DESPISE: 34, DESTARD: 35,
  WRONG: 36, COVETOUS: 37, SHAME: 38, HYTHLOTH: 39, DOOM: 40,
};

/** Normalización difusa compartida con el runner (confusiones OCR l/I/1/]/[/|→i, 0/O→o). */
export const fuzz = (s) =>
  s
    .toLowerCase()
    .replace(/[1l|\]\[!]/g, "i")
    .replace(/[0o]/g, "o")
    .replace(/[^a-z]/g, "");

function noisy(l) {
  if (!l.trim()) return true;
  let ok = 0;
  for (const c of l) if (/[\w '".,!?:;\-()>$#*\]]/.test(c)) ok++;
  return ok / l.length < 0.7;
}

/**
 * FASE 3g — PLEGADO DEL CORPUS TARDÍO, usado **SÓLO** por el reconocedor de movimiento.
 *
 * `fuzz` (arriba) queda INTACTA a propósito: la comparten las anclas de costura, las keywords
 * tecleadas y la clasificación de texto, y ampliarla movería la semántica de todo eso. Este
 * plegado vive aquí y no sale de `MOVE_RE`.
 *
 * Las confusiones son las MEDIDAS en el censo de divergentes de part09-18 (fase 3f):
 * `v`/`y`→u (Nvrth, F]v) · `g`/`8`→s (Eagt, 8outh) · `6`/`c`→o (Wcgt, Hcad) · i-class.
 * ⚠ El `8` hay que plegarlo ANTES del `replace(/[^a-z]/g,"")` de `fuzz`, que lo BORRABA: por eso
 * «8outh» ni siquiera llegaba como «south» — llegaba como «outh».
 */
const moveFuzz = (s) =>
  s
    .toLowerCase()
    .replace(/[1l|\]\[!]/g, "i")
    .replace(/[0o6c]/g, "o")
    .replace(/[vy]/g, "u")
    .replace(/[g8]/g, "s")
    .replace(/[^a-z]/g, "");

/**
 * ORTOGRAFÍAS OBSERVADAS en el LP, por destino. Es una tabla de DATOS (auditable y ampliable),
 * no un regex a mano: el reconocedor se construye plegando estas formas con `moveFuzz`, así que
 * lo que se declara es «esto lo vi escrito así en el corpus», y el plegado hace el resto.
 */
const MOVE_SPELLINGS = {
  north: ["north", "nortn", "Nvrth", "N6rEh"],
  south: ["south", "soutn", "sovth", "8outh", "8vuth", "gouth", "gvuth", "8ovth"],
  east: ["east", "eost", "fost", "Eagt", "Eact", "Eugt", "Iagt", "lact"],
  west: ["west", "wesl", "Wegt", "Wcgt", "Wcst", "Wcct", "Wrgt", "Wrst"],
};
const VEH_SPELLINGS = {
  ride: ["ride", "riae", "Rlde"],
  fly: ["fly", "fiy", "F]y", "F]v"],
  head: ["head", "heod", "heaa", "Hcad", "Heud"],
  row: ["row", "Rvw", "Rov"],
};
/** forma plegada → destino canónico (el «DIR_FIX»/«VEH_FIX» de 3g, generado de la tabla). */
const buildFold = (table) => {
  const m = {};
  for (const [canon, forms] of Object.entries(table)) for (const f of forms) m[moveFuzz(f)] = canon;
  return m;
};
const DIR_FOLD = buildFold(MOVE_SPELLINGS);
const VEH_FOLD = buildFold(VEH_SPELLINGS);
const alt = (m) => Object.keys(m).sort((a, b) => b.length - a.length).join("|");
const MOVE_RE = new RegExp(`^(${alt(VEH_FOLD)})?(${alt(DIR_FOLD)})$`);

export function classify(raw) {
  const l = raw.trim();
  if (noisy(l)) return { t: "noise" };
  const stripped = l.replace(/^[>›}\]]+\s*/, "");
  // keyword tecleada (":NAME", ":J0Bs"…) o mantra ("Mantra:SUMM")
  const kw = /^:{1,2}([A-Z0-9' ]{2,})/.exec(stripped) ?? /^Mantra:([A-Z0-9]{1,})/.exec(stripped);
  // el strip de cola PRESERVA 0/1 finales: son letras del jugador (O/I) que curate.mjs
  // normaliza después — «:KAIK0» debe quedar KAIK0→KAIKO, no KAIK (ad_ep12:6442-44)
  if (kw) return { t: "typed", s: kw[1].replace(/[^A-Z01' ]+$/g, "").trim(), mantra: stripped.startsWith("Mantra:") };
  const m = MOVE_RE.exec(moveFuzz(stripped));
  if (m) {
    const dir = DIR_FOLD[m[2]] ?? m[2];
    const veh = m[1] ? (VEH_FOLD[m[1]] ?? m[1]) : "walk";
    if (["north", "south", "east", "west"].includes(dir)) return { t: "move", dir, veh };
  }
  return { t: "text", s: stripped, echo: /^[>›]/.test(l) };
}

/** Anclas de COSTURA (sobre fuzz de la línea). */
const ANCHORS = [
  [/^entertowne/, "enter"],
  [/^enterviiiage/, "enter"],
  [/^entervijjage/, "enter"],
  [/^entercastie/, "enter"],
  [/^enteriighthouse/, "enter"],
  [/^enterthe$/, "enter"], // wrap: "Enter the / Castle of Lord British!" / "shrine of X"
  [/^enter$/, "enter"], // wrap: ">Enter / lighthouse / STORMCROW"
  [/^exitto$/, "exit"],
  [/confiict/, "combat"],
  [/^victory/, "victory"],
  [/^battieisiost/, "defeat"],
  [/^partyrested/, "camp-end"],
  [/^morning$/, "inn-morning"],
];
export const anchorKind = (s) => {
  const f = fuzz(s);
  for (const [re, kind] of ANCHORS) if (re.test(f)) return kind;
  return null;
};

// --------------------------------------------------------- rachas de tecleo (fix #7.2)
/**
 * PLEGADO de confusiones OCR para comparar LECTURAS DE UNA MISMA LÍNEA DE ENTRADA.
 * Clases MEDIDAS sobre los `typed` del corpus AD (ad_ep12.ocrlog.txt, líneas citadas):
 *   · {0,O,V,U,Y,B}→O — JVB/JOB (6350-51), HVMILITY (1892), :UES/:YES (3933-35),
 *     GRAV P0R/PVR (621/626), :VAk/:VAR de BARNABAS (5177-79, B leída como V)
 *   · {E,F}→E — DANGFR/DANGER (4190/4196), BYF (4791), BFLONGTNGS (3389)
 *   · {1,I,L,T}→I — VTSTTORS/VISITORS (5475/5479), HUMILITK (1879)
 * El plegado es DELIBERADAMENTE agresivo: sólo se usa DENTRO de una candidata a racha
 * (misma getstring), nunca para clasificar texto.
 */
export const typedFold = (s) =>
  s
    .toUpperCase()
    .replace(/[0OVUYB]/g, "O")
    .replace(/[EF]/g, "E")
    .replace(/[1ILT]/g, "I")
    .replace(/[^A-Z]/g, "");

/**
 * PROMPTS de getstring OBSERVADOS en el corpus (tabla de DATOS, como MOVE_SPELLINGS).
 * Un prompt legible entre dos lecturas `typed` = el juego pidió OTRA respuesta: frontera
 * DURA de racha (así :T0LL/:T0LL con «Your interest?» entre medias —3399/3404— quedan
 * como DOS respuestas reales, y los 3 GRAV POR de g09 no se funden: «Spell name:» 997).
 */
const PROMPT_SPELLINGS = [
  "You respond", // ad_ep12:5896, 3877 — diálogo Y/N
  "Your interest", // ad_ep12:2842 — keyword de diálogo
  "What is thy name", // ad_ep12:5174-75 (envuelto en dos líneas: cubre el prefijo)
  "What is it", // ad_ep12:5967 — password de Blackthorn
  "Yell what", // lf30 (fenton-curacion §3.1)
  "Spell name", // ad_ep12:620, 997
  "On who", // part22:831 — el target del cast separa :MANI (Johne) de :VAS MANI (Gwenno)
  "Player", // part22:828/834 — cabecera de turno de cast/Z-stats: el tecleo anterior quedó confirmado
  "Mantra", // prompt de mantra VACÍO «Mantra:;» (1882); con texto clasifica como typed
];
const PROMPT_FUZZ = PROMPT_SPELLINGS.map(fuzz);
export const isPrompt = (s) => {
  const f = fuzz(s);
  if (f.length < 4) return false;
  return PROMPT_FUZZ.some((p) => f.startsWith(p) || (p.startsWith(f) && f.length >= 6));
};

/** Distancia de edición con techo (strings cortos: DP simple). */
const editDistanceLe = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++)
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
};

/**
 * ¿La lectura `s` continúa la racha cuya mejor lectura es `bestS`?
 *   · "ident": el MISMO texto crudo — casi siempre una RE-RESPUESTA real (los :YES
 *     consecutivos de 5226/5231/5241 son tres respuestas al interrogatorio, y los
 *     Mantra:LUM del altar son re-preguntas del santuario) ⇒ sólo funde a distancia 1.
 *   · "prog": progresión/variante de la MISMA línea de entrada — prefijo, substring
 *     (:REL dentro de :VAS REL P0R, izquierda perdida por el OCR), fold igual
 *     (DANGFR≡DANGER) o distancia de edición pequeña sobre el fold (BELONGIONG↔BELONGING).
 */
function rachaRelation(bestS, bestFold, s, fold) {
  if (s === bestS) return "ident";
  if (!fold.length || !bestFold.length) return null;
  if (fold === bestFold) return "prog";
  if (
    fold.startsWith(bestFold) ||
    bestFold.startsWith(fold) ||
    fold.includes(bestFold) ||
    bestFold.includes(fold)
  )
    return "prog";
  const tol = 1 + (Math.min(fold.length, bestFold.length) >> 2);
  if (editDistanceLe(fold, bestFold, tol)) return "prog";
  return null;
}

/** Glifos que el OCR mete donde el jugador no tecleó (V por O/U, K/F de cola): desempate
 *  entre lecturas de igual longitud — DANGER gana a DANGFR, J0B a JVB. `0`/`1` NO cuentan:
 *  curate.mjs ya los corrige (0→O/1→I), así que :GRAV P0R debe ganar a :GRAV PVR. */
const SUSPICIOUS_RE = /[VKF]/g;
export const suspicious = (s) => (s.match(SUSPICIOUS_RE) ?? []).length;

/**
 * ¿La lectura `b` (posterior en el log) es mejor testigo del estado FINAL del tecleo que
 * la actual `a`? — más larga; a igual longitud, no-más-sospechosa (y en empate gana la
 * TARDÍA); y el caso del FANTASMA DE CURSOR: si `b` es `a` menos su último carácter, el
 * glifo del cursor se leyó como letra en `a` y la lectura limpia posterior manda
 * (`:AHMN;`→`:AHM` en ad_ep12:6789-91 — AHM es el mantra; AHMN, el cursor).
 */
export const betterReading = (b, a) =>
  b.length > a.length ||
  (b.length === a.length && suspicious(b) <= suspicious(a)) ||
  (b.length === a.length - 1 && a.startsWith(b));

/** Ventanas EN LÍNEAS DE OCR, derivadas del corpus (casos citados en el docblock de
 *  computeRachaGroups). */
const W_PROG = 10; // :GRAV P0R(982)→:GRAV PVR(991) es un redibujo a d=9
const W_IDENT = 1; // crudo idéntico casi siempre es RE-RESPUESTA real: los :YES de
// 5226/5231/5241, los Mantra:LUM del altar, :T0LL re-preguntado, y el reintento tras
// keyword fallida (:L0RD/:L0RD en ad_ep05:3174-76, con el «I cannot help thee» entre
// medias y el prompt MUTILADO — un W_IDENT de 2 lo fundía y perdía una respuesta real).
// Sólo funde frames duplicados adyacentes.
const W_ABSORB = 2; // :UN0(5248) absorbida por :IMPE(5249): basura corta pre-racha

/**
 * COLAPSO DE RACHAS DE TECLEO tolerante a huecos — el arreglo del cabo §7.2 de
 * `espejo-ad-salud` (adjudicado en `fenton-curacion` §3.1 como defecto de ESTE fichero).
 *
 * El plegado anterior exigía ADYACENCIA en `deduped` Y PREFIJO, y ambas se rompen
 * cuando el OCR pierde fotogramas: cada lectura parcial salía como un `typed` propio y
 * el arnés la tecleaba como respuesta completa (ad12-g32: VA·VAR·BARN·BARNABAS = cuatro
 * respuestas donde el LP dio una, y «BARN» a «SPEAK UNTO ME THE MANTRA, NOW!» le cuesta
 * a Shamino la guillotina — espejo-ad-regeneracion §5).
 *
 * Recorre los eventos clasificados y agrupa las lecturas de una misma getstring:
 *   · FRONTERAS de racha: prompt legible (PROMPT_SPELLINGS), eco de comando (`>…`),
 *     movimiento/gap, ancla de costura, cambio de clase typed↔mantra.
 *   · DENTRO de la ventana y sin frontera: funde si `rachaRelation` reconoce la lectura
 *     (texto no-eco entre medias es TRANSPARENTE: son redibujos del panel).
 *   · el GANADOR de cada grupo es la lectura MÁS LARGA (desempate: menos glifos
 *     sospechosos; después la MÁS TARDÍA = estado final del tecleo).
 *   · «dos respuestas REALES consecutivas distintas NO se funden»: lo garantizan la
 *     incompatibilidad del fold (NAME(6349)/JOB(6350) a d=1 sobreviven separadas), la
 *     ventana W_IDENT para texto idéntico (los tres :YES del interrogatorio) y la
 *     frontera de prompt (los :T0LL re-preguntados).
 *
 * Devuelve TODOS los grupos (también los unitarios) con `members`, `winner` y
 * `absorbed` (racha corta de basura tragada por la siguiente: se descarta entera).
 */
export function computeRachaGroups(events) {
  const groups = [];
  let racha = null; // { g, bestS, bestFold, lastLn, mantra }
  const start = (e, fold, extraMembers = []) => {
    const g = { members: [...extraMembers, e], winner: e, absorbed: false };
    groups.push(g);
    racha = { g, bestS: e.s, bestFold: fold, lastLn: e.ln, mantra: !!e.mantra };
  };
  for (const e of events) {
    if (e.t === "typed") {
      const fold = typedFold(e.s);
      if (racha && racha.mantra === !!e.mantra) {
        const d = e.ln - racha.lastLn;
        const rel = rachaRelation(racha.bestS, racha.bestFold, e.s, fold);
        if (rel && d <= (rel === "ident" ? W_IDENT : W_PROG)) {
          racha.g.members.push(e);
          if (betterReading(e.s, racha.g.winner.s)) {
            racha.g.winner = e;
            racha.bestS = e.s;
            racha.bestFold = fold;
          }
          racha.lastLn = e.ln;
          continue;
        }
        // longitud SIN dígitos: «:UN0» (basura de 2 letras + 0) se absorbe, pero un
        // «:YES» real (3 letras) o un «:KAIK0» (4) jamás — sólo basura ultracorta pegada
        if (!rel && racha.g.winner.s.replace(/[0-9]/g, "").length <= 2 && d <= W_ABSORB) {
          // la racha anterior es basura corta (:UN0) pegada al arranque de ésta: se traga
          const prev = groups.pop();
          prev.absorbed = true;
          start(e, fold, []);
          racha.g.members.unshift(...prev.members);
          continue;
        }
      }
      start(e, fold);
      continue;
    }
    if (e.t === "text") {
      if (e.echo || isPrompt(e.s) || anchorKind(e.s)) racha = null;
      continue;
    }
    racha = null; // move / gap: la línea de entrada quedó confirmada
  }
  return groups;
}

/** Entrada REAL a mazmorra: el eco del comando ">Enter dungeon/cave/mine" (tolerante a
 *  OCR: "Entcr mine", "Enter m[ne"). Es la señal FIABLE de descenso — a diferencia del
 *  nombre de mazmorra suelto (aparece como PISTA DE RUNA / PALABRA DE PODER en diálogo
 *  de NPC: "the rune ... upon the entrance of the dungeon Deceit!", "Word of power for
 *  the dungeon Wrong is MPHOM!") y del Klimb (también sube LADDERS de edificio en pueblos
 *  y montañas en overworld). Abre una costura dungeon-enter → ctx "dungeon". */
const DUNGEON_ENTER_RE = /^ent[ce]r(d[uv]?n[gc]|cave|m[il]?ne)/;

// --------------------------------------------------------------------------- parse
/** Clasifica el ocrlog (desde la línea FROM, 1-based) en eventos con nº de línea. */
export function buildEvents(lines, FROM = 1) {
  const events = [];
  let gapRun = 0;
  for (let i = FROM - 1; i < lines.length; i++) {
    const ln = i + 1;
    const c = classify(lines[i] ?? "");
    if (c.t === "noise") {
      gapRun++;
      continue;
    }
    if (c.t === "move" && gapRun > 2 && events.length && events[events.length - 1].t === "move")
      events.push({ ln, t: "gap", n: gapRun });
    gapRun = 0;
    events.push({ ln, ...c });
  }
  return events;
}

/** Eco de DESMONTE bajo `fuzz` (">X-it skiff!" → "xitskiff"). Clase F4 del acta
 *  `espejo-ad-cabos-ad.md` §2.b: la única familia de ecos de comando que el LP repite
 *  LEGÍTIMAMENTE a pocas líneas (desmontar, re-embarcar, volver a desmontar). */
const XIT_FUZZ_RE = /^xit/;
/** Eco que RECUPERA transporte: ">Board <veh>" / ">Get-<dir>" (la alfombra se recoge con
 *  Get). Tras uno de éstos, un ">X-it" repetido es una orden NUEVA, no un redibujo. */
const REBOARD_FUZZ_RE = /^(board|get)/;
/** Lectura CANÓNICA de un eco X-it — el MISMO predicado con el que `curate.mjs:98`
 *  (`todoToOps`) emite la op `x`: si esta cabeza no casa, el eco conservado NO parirá op
 *  aunque sea el testigo del desmonte. Cambiarla aquí exige carear curate. */
const XIT_CANON_RE = /^>?\s*X-it /i;

// dedupe difuso de redibujados (ventana 6) para texto; keywords: colapso de rachas de
// tecleo TOLERANTE A HUECOS (computeRachaGroups — antes exigía adyacencia+prefijo y cada
// fotograma perdido del OCR paría un `typed` fantasma; ver docblock del colapso)
//
// ★★ F4 (`espejo-ad-cabos-ad.md` §2.b) — el dedupe existe para REDIBUJOS del panel: el OCR
// re-lee líneas que SIGUEN pintadas, y esas re-lecturas caen cerca de la original. La
// ventana son 6 TEXTOS y los eventos `move`/`typed` no la purgan A PROPÓSITO (un redibujo
// puede llegar con moves intercalados: ad_ep16:3278→3281 tiene DOS moves entre medias y ES
// redibujo — purgar por move lo resucitaría). Lo que la ventana sola no sabe distinguir es
// la RE-ORDEN REAL: el LP desmonta, re-embarca y vuelve a desmontar, y el segundo ">X-it"
// idéntico moría como redibujo (se comió el «>X-it skiff!» de ad_ep03:2212, LEGIBLE en el
// crudo — censo de 5 caídas reales en §2.b del acta). Dos remedios, ambos acotados a la
// clase MEDIDA (ecos X-it):
//   1. un eco >Board/>Get CONSERVADO marca `reboardLn`: un X-it repetido cuya copia
//      conservada es ANTERIOR al re-embarque es orden nueva → se conserva (ad03@2212,
//      ad05@514). Los dos redibujos legítimos del censo (ad10@2277, ad16@3281) no llevan
//      Board/Get entre medias y SIGUEN dedupeados.
//   2. si el redibujo trae la lectura CANÓNICA y la conservada estaba MANGLED, el testigo
//      legible manda: se sube la lectura al evento conservado (ad19@2325 «>X-lt shlp!»
//      envenenaba la op; ad19@3166, ad23@246). El redibujo sigue cayendo: sólo cambia QUÉ
//      lectura sobrevive, como `betterReading` en las rachas de tecleo.
export function dedupeEvents(events) {
  const rachas = computeRachaGroups(events);
  const dropLn = new Set();
  const winnerS = new Map(); // primera línea del grupo → texto ganador
  for (const g of rachas) {
    const keep = g.members[0].ln;
    for (const m of g.members) if (m.ln !== keep) dropLn.add(m.ln);
    winnerS.set(keep, g.winner.s);
  }
  const deduped = [];
  const recent = []; // { n: fuzz, ln: línea del texto CONSERVADO, idx: índice en deduped }
  let reboardLn = -1; // línea del último eco >Board/>Get conservado (recupera transporte)
  for (const e of events) {
    if (e.t === "typed") {
      if (dropLn.has(e.ln)) continue;
      const s = winnerS.get(e.ln) ?? e.s;
      deduped.push(s === e.s ? e : { ...e, s });
      continue;
    }
    if (e.t !== "text") {
      deduped.push(e);
      continue;
    }
    const n = fuzz(e.s);
    const hit = n.length > 2 ? recent.findIndex((r) => r.n === n) : -1;
    if (hit !== -1) {
      const r = recent[hit];
      const esXit = !!e.echo && XIT_FUZZ_RE.test(n);
      if (!(esXit && r.ln < reboardLn)) {
        // Redibujo: cae — pero si trae la lectura canónica y la conservada no, el
        // testigo legible sube al evento conservado (remedio 2; la ln original se queda).
        if (esXit && XIT_CANON_RE.test(e.s) && !XIT_CANON_RE.test(deduped[r.idx].s))
          deduped[r.idx] = { ...deduped[r.idx], s: e.s };
        recent.splice(hit, 1);
        recent.push(r);
        continue;
      }
      // Re-orden REAL post-reembarque (remedio 1): la copia vieja deja el sitio a ésta.
      recent.splice(hit, 1);
    }
    if (e.echo && REBOARD_FUZZ_RE.test(n)) reboardLn = e.ln;
    deduped.push(e);
    recent.push({ n, ln: e.ln, idx: deduped.length - 1 });
    if (recent.length > 6) recent.shift();
  }
  return deduped;
}

// --------------------------------------------------------------------------- segmenta
export function segmentEvents(deduped, FROM, totalLines) {
const segs = [];
let ctx = "start"; // el curador fija el ctx real de arranque (checkpoint/boot)
let cur = { ctx, fromLn: FROM, script: [], expect: [] };
let blk = null;
const flushBlk = () => {
  if (blk && blk.text.trim()) {
    cur.expect.push({ text: blk.text.trim(), ocrLn: blk.ln, class: "auto" });
    cur.script.push({ todo: blk.text.trim().slice(0, 60), ocrLn: blk.ln });
  }
  blk = null;
};
const pushMove = (dir, veh) => {
  let tail = cur.script[cur.script.length - 1];
  if (!tail || !tail.nav) {
    tail = { nav: [] };
    cur.script.push(tail);
  }
  const last = tail.nav[tail.nav.length - 1];
  if (last && last.m === dir && last.v === veh) last.n++;
  else tail.nav.push({ m: dir, v: veh, n: 1 });
};
const cut = (ln, newCtx, seam) => {
  flushBlk();
  cur.toLn = ln - 1;
  if (cur.script.length || cur.expect.length) segs.push(cur);
  ctx = newCtx;
  cur = { ctx, fromLn: ln, seam, script: [], expect: [] };
};

/** Busca una location conocida CONTENIDA en el banner acumulado (tolera prefijos como
 *  "lighthouse" / "Castle of" y colas de ruido). Caso especial: LB Castle (id 17, sin
 *  nombre en DATA — banner del LP: "Castle of Lord British"). */
function resolveBanner(norm) {
  if (norm.includes("LORD BRITISH")) return { loc: 17, banner: "CASTLE OF LORD BRITISH" };
  const sh = /SHRINE OF ([A-Z]{3,})/.exec(norm);
  if (sh) return { loc: null, banner: `SHRINE OF ${sh[1]}`, shrine: true };
  if (norm.includes("SHRINE")) return null; // sigue acumulando hasta ver la virtud
  for (const [k, v] of Object.entries(LOC_BY_BANNER)) if (norm.includes(k)) return { loc: v, banner: k };
  return null;
}

let pendingEnter = null; // tras ancla "enter": acumula el banner (hasta 3 líneas)
for (const e of deduped) {
  if (pendingEnter !== null && e.t === "text") {
    // eco redibujado del propio "Enter …" (pueblo o mazmorra): ignóralo sin consumir intento
    if (anchorKind(e.s) === "enter" || DUNGEON_ENTER_RE.test(fuzz(e.s))) continue;
    // el OCR confunde 0↔O / 1↔I dentro de banners ("M00NGL0W")
    const clean = e.s.replace(/0/g, "O").replace(/1/g, "I").replace(/[^A-Za-z' ]/g, " ");
    pendingEnter.banner = (pendingEnter.banner + " " + clean).replace(/\s+/g, " ").trim();
    pendingEnter.tries++;
    const norm = pendingEnter.banner.toUpperCase();
    const hit = resolveBanner(norm);
    if (hit) {
      const isDng = pendingEnter.dungeon || (hit.loc != null && hit.loc >= 33);
      cut(pendingEnter.ln, hit.shrine ? "shrine" : isDng ? "dungeon" : "smallmap", isDng ? "dungeon-enter" : "enter");
      cur.enter = hit.shrine
        ? { shrine: hit.banner }
        : { loc: hit.loc, banner: hit.banner, ...(isDng ? { dungeon: true } : {}) };
      pendingEnter = null;
    } else if (pendingEnter.tries >= 3) {
      const isDng = pendingEnter.dungeon;
      cut(pendingEnter.ln, isDng ? "dungeon" : "smallmap", isDng ? "dungeon-enter" : "enter");
      cur.enter = { loc: null, banner: norm, ...(isDng ? { dungeon: true } : {}) };
      pendingEnter = null;
    }
    continue;
  }
  if (e.t === "move") {
    flushBlk();
    pushMove(e.dir, e.veh);
    continue;
  }
  if (e.t === "gap") {
    cur.script.push({ gap: e.n, ocrLn: e.ln });
    continue;
  }
  if (e.t === "typed") {
    flushBlk();
    cur.script.push(e.mantra ? { typedMantra: e.s, ocrLn: e.ln } : { typed: e.s, ocrLn: e.ln });
    continue;
  }
  if (DUNGEON_ENTER_RE.test(fuzz(e.s))) {
    // costura de ENTRADA a mazmorra (comando Enter dungeon/cave/mine): el banner del
    // nombre (DECEIT/DESPISE/SHAME…) o loc:null si no legible tras 3 líneas.
    pendingEnter = { ln: e.ln, banner: "", tries: 0, dungeon: true };
    continue;
  }
  const kind = anchorKind(e.s);
  if (kind === "enter") {
    pendingEnter = { ln: e.ln, banner: "", tries: 0, dungeon: false };
    continue;
  }
  if (kind === "exit") {
    cut(e.ln, "overworld", "exit");
    cur.enter = { overworld: true };
    continue;
  }
  if (kind === "combat") {
    cut(e.ln, "combat", "combat");
    continue;
  }
  if (kind === "victory" || kind === "defeat") {
    // el bloque de combate incluye su línea de cierre; el segmento siguiente
    // vuelve al contexto anterior al combate (resync del runner)
    if (blk) flushBlk();
    cur.expect.push({ text: e.s, ocrLn: e.ln, class: "exact" });
    cut(e.ln + 1, "post-combat", kind);
    continue;
  }
  if (kind === "camp-end" || kind === "inn-morning") {
    cur.expect.push({ text: e.s, ocrLn: e.ln, class: "exact" });
    cut(e.ln + 1, ctx === "combat" ? ctx : "resume", kind);
    continue;
  }
  if (blk && (e.echo || e.ln - blk.lastLn > 3 || blk.lines >= 6)) flushBlk();
  if (!blk) blk = { text: "", ln: e.ln, lastLn: e.ln, lines: 0 };
  blk.text += (blk.text ? " " : "") + e.s;
  blk.lastLn = e.ln;
  blk.lines++;
}
flushBlk();
cur.toLn = totalLines;
segs.push(cur);
return segs;
}

// --------------------------------------------------------------------------- CLI
function main() {
  const [, , ocrPath, partId, ...rest] = process.argv;
  if (!ocrPath || !partId) {
    console.error("uso: segment.mjs <ocrlog.txt> <partNN> [--from N] [--force] [--routes <dir>]");
    process.exit(2);
  }
  const FROM = rest.includes("--from") ? Number(rest[rest.indexOf("--from") + 1]) : 1;
  const FORCE = rest.includes("--force");
  /** --routes <dir>: directorio de rutas alternativo (corpus paralelo, p.ej. routes-ad
   *  del LP2 de Alex Diener). Relativo a e2e/espejo-tour/ salvo ruta absoluta. */
  const routesArg = rest.includes("--routes") ? rest[rest.indexOf("--routes") + 1] : "routes";
  const ROUTES = routesArg.startsWith("/") ? routesArg : join(HERE, "..", routesArg);

  const lines = readFileSync(ocrPath, "utf8").split("\n");
  const segs = segmentEvents(dedupeEvents(buildEvents(lines, FROM)), FROM, lines.length);

  const route = {
    part: partId,
    source: ocrPath.replace(/^.*\/(full-part-logs[^/]*)\//, "$1/"),
    generated: "e2e/espejo-tour/tools/segment.mjs — BORRADOR, curar a mano (README §formato)",
    entry: { checkpoint: null, entryClock: { hour: 10, minute: 0 } },
    segments: segs.map((s, i) => ({
      id: `${partId}-g${String(i + 1).padStart(2, "0")}`,
      ctx: s.ctx,
      seam: s.seam ?? null,
      ...(s.enter ? { enter: s.enter } : {}),
      ocr: { from: s.fromLn, to: s.toLn },
      script: s.script,
      expect: s.expect,
    })),
  };

  mkdirSync(ROUTES, { recursive: true });
  const out = join(ROUTES, `${partId}.route.json`);
  if (existsSync(out) && !FORCE) {
    console.error(`${out} ya existe — usa --force para regenerar (pisa la curación!)`);
    process.exit(1);
  }
  writeFileSync(out, JSON.stringify(route, null, 2) + "\n");
  const moves = route.segments.reduce(
    (a, s) => a + s.script.reduce((b, op) => b + (op.nav ? op.nav.reduce((c, n) => c + n.n, 0) : 0), 0),
    0,
  );
  console.log(
    `${out}: ${route.segments.length} segmentos, ${moves} pasos de nav, ` +
      `${route.segments.reduce((a, s) => a + s.expect.length, 0)} bloques expect`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
