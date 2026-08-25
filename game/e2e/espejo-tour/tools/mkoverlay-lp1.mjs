#!/usr/bin/env node
/**
 * #85 — RESTAURACIÓN del generador de overlays del corpus LP1 (aulddragon, part01-24).
 *
 * ## Por qué existe este fichero
 *
 * Los overlays de LP1 (`routes/overlays/partNN.json`) declaran en su `entry.note`
 * «Generado offline (mkoverlay)» — pero **ese generador NUNCA estuvo versionado**:
 * `git log --all -- '*mkoverlay*'` sólo conoce `mkoverlay-ad.mjs` (corpus LP2, commit
 * 0fe1f4ee). El productor de la capa overlay de LP1 se perdió, y por eso al regenerar
 * las rutas en #77 sus decisiones quedaron desalineadas **sin forma de reponerlas**.
 *
 * Esto NO es re-adjudicación a mano: las decisiones de esa capa son MECÁNICAS (salida de
 * un clasificador), no juicios caso por caso. Re-emitirlas a mano sería peor que
 * regenerarlas, porque el clasificador documenta señales que un humano mirando marcas
 * reproduce mal — su propia cabecera avisa de que **`klimb` y los nombres de mazmorra en
 * diálogo dan FALSOS POSITIVOS**. (Comprobado: al abrir #85 yo estaba a punto de
 * clasificar por `klimb`.)
 *
 * ## Qué es exactamente
 *
 * El MISMO algoritmo de `mkoverlay-ad.mjs`, con su máquina de estado de interior
 * (documentada allí como «lección del espejo-1»), aplicado a `routes/`:
 *
 *   · costura `dungeon-enter` ABRE interior;
 *   · `enter` de pueblo/castillo/shrine = evidencia de SUPERFICIE ⇒ cierra interior
 *     (cubre el warp de muerte al castillo de LB);
 *   · `exit` estando dentro: "Britannia" cierra · "Underworld" **también cierra** (#32:
 *     emerger a la otra capa es salir del interior igual que emerger a Britannia) ·
 *     sin evidencia, CONSERVADOR (sigue dentro);
 *   · "Entering room.." fuera de interior = entrada de mazmorra que el OCR se comió;
 *   · interior ⇒ `skip:"pendiente-runner"` (el runner lo atraviesa nav-only,
 *     runner.ts:1761 `navOnly = seg.skip != null`);
 *   · combate de superficie ⇒ `policy:"auto"`.
 *
 * ## Diferencias declaradas frente al de LP2 (no son mejoras: son des-LP2-ización)
 *
 *   1. Sin `RECRUITS` ni `PARTY_ASSERT`: son censos del LP2 y no aplican aquí.
 *   2. **`entry` y `ledger` NO se generan: se PRESERVAN del overlay existente**, y de
 *      `entry.note` sólo se reescribe la coletilla de conteo. Esa prosa es específica de
 *      LP1 y no me consta derivada — copiarla habría sido fabricar.
 *
 *      🔴 **Y SÓLO ESOS DOS.** `segments` se RECONSTRUYE entero (`{ ...prev, segments }`,
 *      abajo), así que **`--write` DESTRUYE toda la curación manual por segmento** que este
 *      generador no re-emite. Su vocabulario es {skip, note, policy, anchor} y nada más.
 *      Medido en #43 sobre los 24 overlays commiteados (main cc4a3b8a), lo que se pierde:
 *      **67 ops de overlay → 0** (incluidos los DOS ÚNICOS `anchor.expectDelta` del proyecto
 *      entero —part04-g03 sell/Blacksmith +36 y part05-g05 buy/GuildMaster −954— y los 3
 *      `recruit`), 25 `calib`, 9 `ctx`, 7 `enter`, 1 `expectClass`, 1 `carryover`.
 *      A nivel de RUTA, tras `curate.mjs`: ops de overlay 74 → 7, `expectDelta` 2 → 0.
 *      Antes de correr `--write`, preservar esas claves o el ledger queda DESARMADO en silencio.
 *
 *      ⚠ Y §Diferencias 1 («sin RECRUITS: son censos del LP2 y no aplican aquí») **es falsa
 *      contra el artefacto**: los overlays de LP1 llevan 3 ops `recruit`. La afirmación
 *      describe el diseño del script, no el corpus que debe reproducir.
 *   3. Cadena de checkpoints `partNN-1` en vez de `adNN-1` (ya viene en el `entry`
 *      preservado; aquí no se toca).
 *   4. ★ **El estado de interior NO cruza episodios**: se REINICIA en cada parte. En LP2
 *      sí cruza («ad09 acaba dentro de Destard; ad10 arranca ahí»), y arrastrarlo aquí
 *      fue mi primer intento — el CONTROL lo refutó: con arrastre, part17/18 salían con
 *      10 y 22 skip frente a los 7 y 14 del overlay original, porque part16 termina
 *      dentro de la mazmorra. Sin arrastre reproduce los originales EXACTOS. No es una
 *      elección de diseño mía: es el comportamiento que los artefactos de LP1 exigen,
 *      y encaja con el corpus (aulddragon sale de la mazmorra entre episodios; el LP2,
 *      mazmorra-céntrico, no).
 *
 * ## Control positivo de la restauración — ★ Y SU ALCANCE EXACTO
 *
 * Alimentado con las rutas PRE-#77 (árbol 3544217a) reproduce los overlays originales
 * **176/176 decisiones**, part09-18. Es la prueba de que esto restaura y no reinventa;
 * sin ese control, «genera skips plausibles» no habría valido nada.
 *
 * ⚠ **PERO EL CONTROL CUBRE part07-18 Y SOLO LAS DECISIONES.** No extrapolar:
 *
 *   · **part19-24: NO es fiel.** Medido (#89): part19-g14 y part20-g21 pierden su `skip`,
 *     y part20/part22 pierden TODOS sus `policy:auto` (4→0 y 2→0) porque este generador
 *     los cree interior donde el original veía superficie. Falta al menos una regla de
 *     CIERRE que no he derivado. **Regenerar part19-24 con esto cambiaría 6+ decisiones
 *     en silencio.** Si hace falta, derivar primero la regla y re-validar contra los
 *     overlays commiteados, como se hizo con part09-18.
 *
 *     ★★ #32 — ESA REGLA DE CIERRE ERA LA ASIMETRÍA Underworld/Britannia, y ya está puesta.
 *     Con ella el generador recupera los `policy:auto` perdidos **por identidad**: emite
 *     exactamente part20-g12/g14/g16/g18 y part22-g08/g10, los mismos ids del artefacto
 *     original (6/6). Lo que NO arregla: el desfase de `skip` sigue —part19-24 cambiaría 14
 *     decisiones respecto del commiteado, y AD otras 41—, así que **part19-24 sigue sin
 *     punto fijo y sigue sin regenerarse**. Detalle y cifras en re/notes/gen-root-32-acta.md.
 *   · **El texto de las `note` NO está validado**, solo la CLASE de decisión
 *     (skip/policy/nota). `snippet()` no es byte-fiel al original: sobre part07/08 las
 *     notas cambian («Get-West Nothing to get!» → «Get-s») sin que cambie ni una decisión.
 *     Por eso #89 decidió NO regenerar part07/08 solo para corregir el nombre del
 *     productor en su prosa: el beneficio era cosmético y el coste, churn no validado.
 *
 * Regla práctica: este generador es de fiar donde su salida se ha careado contra el
 * artefacto commiteado. Fuera de ahí es una hipótesis, no una herramienta.
 *
 * Uso:  node e2e/espejo-tour/tools/mkoverlay-lp1.mjs part09 part10 … [--write] [--diff]
 *       (sin --write sólo informa; nunca pisa un overlay salvo --write)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { segAnchor } from "./anchor.mjs";
import { mergePatch } from "./overlay-merge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES = join(HERE, "..", "routes");
const OVERLAYS = join(ROUTES, "overlays");

// ¿ejecutado como CLI, o importado por un test? El driver de abajo sólo corre en el primer
// caso — sin esta guarda, importar el módulo para fijar el clasificador (#32) dispararía el
// `process.exit(2)` de «uso:» y el test moriría sin llegar a su primer assert.
const IS_CLI = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const DIFF = args.includes("--diff");
const parts = args.filter((a) => !a.startsWith("--"));

// Señales del clasificador — IDÉNTICAS a mkoverlay-ad.mjs (tolerantes al ruido OCR).
const SHADOWLORD_RE = /DOTH|SURROUND|HATRED|FALSEHOOD|COWARDICE/;
const ROOM_RE = /enter[il1|\]]ng room/i;
const UNDERWORLD_RE = /underw[o0]r[l1|\]i]d/i;
const BRITANNIA_RE = /br[il1|\]]tann/i;

const segTexts = (seg, n = 8) => (seg.expect ?? []).slice(0, n).map((b) => b.text).join(" ");
const snippet = (seg) =>
  ((seg.script ?? []).find((op) => op.todo)?.todo ?? seg.expect?.[0]?.text ?? "").slice(0, 60);

/**
 * Reescribe SOLO la coletilla de conteo de entry.note, preservando el resto — y de paso
 * corrige el nombre del productor.
 *
 * #89: la prosa decía «Generado offline (mkoverlay)», y ese nombre es un FANTASMA — el
 * script nunca estuvo versionado. Restaurar el productor como `mkoverlay-lp1.mjs` sin
 * tocar la prosa dejaba el artefacto señalando a un productor inexistente: el mismo
 * defecto de #85, sobreviviendo a su propio arreglo. Aquí se nombra al productor REAL.
 */
function retallyNote(note, skips, combats) {
  note = note.replace(/Generado offline \(mkoverlay\)/g, "Generado offline (mkoverlay-lp1.mjs)");
  const tail = ` ${skips} segmentos [SKIP:pendiente-runner] (interior de mazmorra: klimb/gema/sala — el runner los honra en Fase B), ${combats} combates policy:auto.`;
  const cut = note.search(/;?\s*\d+ segmentos \[SKIP:/);
  return (cut >= 0 ? note.slice(0, cut).replace(/;\s*$/, "") : note.replace(/\s*$/, "")) + ";" + tail;
}

/**
 * Máquina de estado de interior — un paso, PURA, para poder fijarla por unidad (#32).
 *
 * Estaba escrita en línea dentro del bucle de `mkoverlay`, duplicada casi carácter a carácter
 * en `mkoverlay-ad.mjs`. Esa duplicación es lo que dejó vivir la asimetría Britannia/Underworld
 * en los dos sitios a la vez; extraerla no cambia una sola decisión (verificado por bytes sobre
 * los 24 overlays) pero la deja testeable sin ejecutar el generador entero.
 *
 * Devuelve `falseEnter` en vez de tocar el patch: el falso-enter de Shadowlord NO toca el estado.
 */
export function stepInterior(seg, texts, state) {
  let { inInterior, why } = state;
  let falseEnter = false;

  if (seg.seam === "dungeon-enter") {
    inInterior = true;
    why = "entrada-dng";
  } else if (seg.seam === "enter" && (seg.ctx === "smallmap" || seg.ctx === "shrine")) {
    const banner = seg.enter?.banner ?? "";
    if (seg.enter?.loc == null && SHADOWLORD_RE.test(banner)) falseEnter = true;
    else inInterior = false;
  } else if (seg.seam === "exit" && inInterior) {
    // ★ #32: emerger al Underworld TAMBIÉN es salir del interior. La party queda en un mapa
    // GRANDE, sólo que en la otra capa (location 0, floor 0xFF) — no en una mazmorra. Antes
    // esta rama sólo anotaba el motivo y dejaba `inInterior` en true, y esa asimetría con
    // Britannia es la que marcaba las 16 costuras de salida al Underworld como interior.
    if (BRITANNIA_RE.test(texts)) inInterior = false;
    else if (UNDERWORLD_RE.test(texts)) {
      inInterior = false;
      why = "underworld";
    } else why = "exit-ambiguo-dng";
  }
  if (!inInterior && ROOM_RE.test(texts)) {
    inInterior = true;
    why = "sala-combate";
  }
  // ★ #89: «Underworld» fuera de interior ABRE interior. En LP2 esta regla no hace falta
  // porque su estado CRUZA episodios y al Underworld se llega desde una mazmorra ya
  // abierta; aquí, al reiniciar en cada parte (§Diferencias 4), un episodio que ARRANCA
  // ya caído en el Underworld se quedaba en superficie. Las dos diferencias con LP2 están
  // ligadas: sin arrastre, esta regla es la que lo compensa.
  // Descubierta al correr el generador FUERA del rango que validé (part19-24): part19-g01
  // dice «Falling into underworld!!» y su nota original es «[SKIP:…] underworld».
  //
  // ★★ #32 — la guarda `seam !== "exit"` NO es cosmética: sin ella el fix de la costura de
  // salida es INERTE. Esta regla vuelve a poner `inInterior = true` en el MISMO segmento que
  // la costura acaba de cerrar, porque su texto contiene «Underworld!». Comprobado por bytes:
  // arreglar sólo la rama del `if` de arriba produce overlays IDÉNTICOS a los de antes.
  //
  // Y tiene que ser la COSTURA, no una bandera de «la rama acaba de disparar»: la rama está
  // gateada por `&& inInterior`, así que en una SEGUNDA costura de salida consecutiva (caso
  // real: part19-g10 tras part19-g09) no llega a dispararse y la bandera no la cubriría. Una
  // costura de salida nunca es una caída DENTRO, se haya disparado la rama o no.
  //
  // El caso que la regla #89 existe para cubrir (part19-g01, «Falling into underworld!!»)
  // tiene `seam: null`, así que excluir las costuras de salida no lo toca. En mkoverlay-ad.mjs
  // esta regla no existe (su estado CRUZA episodios) y allí basta con la rama del `if`.
  if (!inInterior && seg.seam !== "exit" && UNDERWORLD_RE.test(texts)) {
    inInterior = true;
    why = "underworld";
  }
  if (inInterior) {
    if (ROOM_RE.test(texts)) why = "sala-combate";
    else if (UNDERWORLD_RE.test(texts)) why = "underworld";
  }
  return { inInterior, why, falseEnter };
}

function mkoverlay(part, carry) {
  const routePath = join(ROUTES, `${part}.route.json`);
  const ovPath = join(OVERLAYS, `${part}.json`);
  const route = JSON.parse(readFileSync(routePath, "utf8"));
  const prev = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : {};

  let inInterior = carry.inInterior;
  let why = carry.inInterior ? `${carry.why}-arrastre-${carry.from}` : "";
  let skips = 0;
  let combats = 0;
  const segments = {};

  for (const seg of route.segments ?? []) {
    const patch = {};
    const texts = segTexts(seg);

    const step = stepInterior(seg, texts, { inInterior, why });
    ({ inInterior, why } = step);
    if (step.falseEnter) {
      const banner = seg.enter?.banner ?? "";
      patch.ctx = "overworld";
      patch.enter = { overworld: true };
      patch.seam = null;
      patch.note = `falso-enter (aviso Shadowlord en overworld, no banner de location): "${banner.slice(0, 50)}"`;
    }

    // ★ #43 — TERRITORIO YA ADJUDICADO: una costura marcada `enter.underworld` la decidió #23
    // segmento a segmento, sobre un eje que este clasificador NO modela — si el predecesor es
    // costura de mazmorra el resync de salida puede dispararse (clase A, se des-skipea), y si la
    // party ya está en location 0 no se dispara y NADA garantiza su celda, así que el skip se
    // CONSERVA (clase B). El clasificador sólo sabe «esto no es interior» y, sin esta guarda,
    // arrasaba las 8 de clase B: medido, las 8 que perdían el skip eran exactamente ad15-g14,
    // ad20-g08/09/10, ad23-g04, ad24-g31, part17-g07 y part19-g10. Aquí NO se opina del skip
    // (ni true ni tombstone): manda lo que el overlay ya declare.
    if (seg.enter?.underworld) {
      patch.note = `costura Underworld ADJUDICADA por #23 (el skip lo decide su clase, no el clasificador). ${snippet(seg)}`;
      if (why === "entrada-dng") why = "interior-dng";
    } else if (inInterior && seg.openedBy) {
      // ★ #43 — `openedBy` y `skip` son MUTUAMENTE EXCLUYENTES. Un segmento que el runner ABRE
      // (fase 3e/E-3) es justamente uno que NO debe atravesarse nav-only. El clasificador de
      // interiores es anterior a `openedBy` y no lo conocía, así que marcaba estos segmentos
      // como pendientes del runner cuando el runner ya los conduce.
      // DERIVADO del corpus, no elegido: de los 104 segmentos con `openedBy` de los dos corpus
      // (LP1 15, AD 89), CERO llevan `skip` en las rutas commiteadas. Sin esta regla, re-curar
      // con polaridad explícita les ponía el skip a los 104 y sacaba 10.277 bloques del
      // denominador — exactamente al revés de lo que la ventana venía a hacer.
      patch.skip = false;
      patch.note = `interior ABIERTO por el runner (openedBy: ${seg.openedBy}) — ${why}. ${snippet(seg)}`;
      if (why === "entrada-dng") why = "interior-dng";
    } else if (inInterior) {
      patch.skip = "pendiente-runner";
      patch.note = `[SKIP:pendiente-runner] ${why}. ${snippet(seg)}`;
      skips++;
      if (why === "entrada-dng") why = "interior-dng";
    } else if (seg.ctx === "combat") {
      // #43 ruling 2: POLARIDAD EXPLÍCITA. El clasificador ha decidido que esto NO es interior,
      // y esa decisión tiene que viajar. `skip: false` es un TOMBSTONE («quítalo»), distinto de
      // la clave AUSENTE («no opino»): sin él, `curate.mjs` —que sólo asigna lo que el patch
      // trae— no puede levantar un skip que ya está en la ruta, y las bajas del fix de #32 se
      // quedaban en el overlay sin llegar nunca al artefacto que el runner lee.
      patch.skip = false;
      patch.policy = "auto";
      patch.note = patch.note ?? `Combate overworld/naval (RNG no-comparable, policy:auto). ${snippet(seg)}`;
      combats++;
    } else {
      patch.skip = false; // ídem: decisión explícita de «no es interior» (ver arriba)
      if (!patch.note) {
        const s = snippet(seg);
        if (s) patch.note = s;
      }
    }

    // HUELLA (#85): permite a curate.mjs detectar que la clave dejó de corresponder.
    // #43 ruling 1: el patch generado se FUSIONA sobre el curado a mano en vez de pisarlo. Sin
    // esto, `--write` borraba los dos únicos `anchor.expectDelta` del proyecto y los 3 recruit.
    // Un segmento con curación previa sobrevive aunque el generador no opine nada de él.
    const prevPatch = prev.segments?.[seg.id];
    if (Object.keys(patch).length) segments[seg.id] = mergePatch(prevPatch ?? {}, { ...patch, anchor: segAnchor(seg) });
    else if (prevPatch) segments[seg.id] = prevPatch;
  }

  // entry y ledger PRESERVADOS (ver §Diferencias 2); sólo se re-cuenta la coletilla.
  const overlay = { ...prev, segments };
  if (overlay.entry?.note) overlay.entry = { ...overlay.entry, note: retallyNote(overlay.entry.note, skips, combats) };

  return { overlay, skips, combats, carry: { inInterior, why, from: part } };
}

if (IS_CLI && !parts.length) {
  console.error("uso: mkoverlay-lp1.mjs partNN [partNN …] [--write] [--diff]");
  process.exit(2);
}

// ★ SIN arrastre entre episodios (ver §Diferencias 4): cada parte arranca en superficie.
const carry = { inInterior: false, why: "", from: "" };
for (const part of IS_CLI ? parts : []) {
  const prevOv = existsSync(join(OVERLAYS, `${part}.json`))
    ? JSON.parse(readFileSync(join(OVERLAYS, `${part}.json`), "utf8"))
    : { segments: {} };
  const before = Object.values(prevOv.segments ?? {});
  const r = mkoverlay(part, carry);
  // (r.carry se ignora a propósito: sin arrastre)
  const bSkip = before.filter((v) => v.skip).length;
  const bPol = before.filter((v) => v.policy).length;
  console.log(
    `${part}: skip ${bSkip} -> ${r.skips} · policy:auto ${bPol} -> ${r.combats} · claves ${before.length} -> ${Object.keys(r.overlay.segments).length}${r.carry.inInterior ? "  [sale DENTRO de interior]" : ""}`,
  );
  if (DIFF) {
    for (const [k, v] of Object.entries(r.overlay.segments)) {
      const b = prevOv.segments?.[k];
      const was = b?.skip ? "skip" : b?.policy ? "policy" : b ? "nota" : "—";
      const now = v.skip ? "skip" : v.policy ? "policy" : "nota";
      if (was !== now) console.log(`    ${k}: ${was} -> ${now}${v.skip ? ` (${v.note.match(/\] (\S+)\./)?.[1]})` : ""}`);
    }
  }
  if (WRITE) writeFileSync(join(OVERLAYS, `${part}.json`), JSON.stringify(r.overlay, null, 2) + "\n");
}
if (IS_CLI && !WRITE) console.log("\n(dry-run: nada escrito — repetir con --write)");
