#!/usr/bin/env node
/**
 * ESPEJO-2 — generador de overlays mínimos para el corpus AD (LP2, Alex Diener, 25 eps).
 *
 * Produce `routes-ad/overlays/adNN.json` (consumidos por curate.mjs --routes routes-ad):
 *
 *   · entry: cadena de checkpoints ad01(fresh, avatar "Barnabas") → ad02..ad25.
 *   · CLASIFICACIÓN mazmorra-interior con las señales FIABLES (lección del espejo-1:
 *     klimb y nombres-de-mazmorra-en-diálogo dan falsos positivos):
 *       - costura `dungeon-enter` (eco ">Enter dungeon/cave/mine") ABRE interior;
 *       - "Entering room.." confirma interior (sala de combate .CBT);
 *       - el interior se CIERRA solo con evidencia de superficie: enter de
 *         pueblo/castillo/shrine (imposible desde dentro; cubre el warp de muerte a
 *         LB castle), "Exit to Britannia" — o, desde #32, "Underworld" en una costura de
 *         SALIDA: emerger a la otra capa deja a la party en un mapa GRANDE, no en una
 *         mazmorra, así que cierra igual que Britannia. ⚠ Los overlays commiteados son
 *         ANTERIORES a ese fix (y también al ledger de 50272e28): regenerar cambiaría 41
 *         decisiones. Ver re/notes/gen-root-32-acta.md antes de correr con --force.
 *     Los segmentos interiores se marcan [SKIP:pendiente-runner] — AD es
 *     mazmorra-céntrico: MUCHO más skip que aulddragon es lo esperado (esos SKIP se
 *     abren cuando el runner aprenda salas).
 *   · recruits del LP2 por el op {recruit} sancionado (tabla RECRUITS, censo por
 *     banners de combate "X, armed with" + beats de join del OCR).
 *   · falso-enter Shadowlord ("... DOTH SURROUND THEE") → ctx overworld restaurado.
 *   · combates de superficie → policy:auto.
 *
 * NO cura interacciones de tienda (calibración Fase B con puerto). Idempotente sobre
 * los borradores del segmentador; no pisa un overlay existente salvo --force.
 *
 * 🔴 **`--force` DESTRUYE la curación manual por segmento.** `overlay.segments` se construye
 * desde cero, y el vocabulario que este generador re-emite es {skip, note, policy, insertOps
 * de RECRUITS, ctx/enter/seam del falso-enter}. Medido en #43 sobre los 25 overlays
 * commiteados (main cc4a3b8a): se pierden **los 3 ops `dismiss`** (ad05 Julia, ad13 Jaana,
 * ad21 Iolo), 12 `enter` (las marcas `{underworld:true}` de E-23/#23), 1 `ctx` y 1 `seam`
 * (el falso-enter de ad08-g15). A nivel de RUTA, tras `curate.mjs`: ops `dismiss` 3 → 0.
 * ★ Es AUTO-REFUTANTE: la regeneración reescribe los 25 `ledger.note` para que digan «los
 * SWAPS usan el op `dismiss`, que EXISTE y está cableado en ad05/ad13/ad21» mientras BORRA
 * ese op de ad05/ad13/ad21.
 * ★★ Y la preservación OBVIA (conservar las claves que el generador no emite) **sigue
 * perdiendo uno**: `ad13-g21` lleva el `recruit` y el `dismiss` en el MISMO array
 * `insertOps`, así que una fusión por CLAVE lo reemplaza entero. Hay que fusionar
 * `insertOps` ENTRADA A ENTRADA. Medido: 3 → 2 con fusión por clave, 3 → 3 sólo por entrada.
 *
 * Uso:  node e2e/espejo-tour/tools/mkoverlay-ad.mjs [adNN ...] [--force]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mergePatch } from "./overlay-merge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES = join(HERE, "..", "routes-ad");
const OVERLAYS = join(ROUTES, "overlays");

// ¿ejecutado como CLI, o importado por un test? Sin esta guarda, importar el módulo para fijar
// el clasificador (#32) recorrería ad01..ad25 y —con --force en argv— reescribiría overlays.
const IS_CLI = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

/** Joins del LP2 (censo: banners de combate por episodio + beat de join en el OCR).
 *  Party base del arranque fresh: Barnabas (avatar) + Iolo + Shamino. */
const RECRUITS = {
  ad01: [{ name: "Gwenno", afterOcrLn: 2030, note: "Iolo's Bows, Britain: ':YES … Iolo and I both thank thee!' (OCR 2024-2032) → party 4" }],
  ad02: [{ name: "Jaana", afterOcrLn: 6100, note: "Yew: el diálogo del join es ilegible en el OCR de ep02 (prefijo de línea corrupto); ancla = primer 'Player: Jaana' (OCR 6100) → party 5" }],
  ad03: [{ name: "Julia", afterOcrLn: 1085, note: "Post-resurrección: 'Shall I join with thee now?' :YES 'At last, we begin anew!' (OCR 1079-1092, Player: Julia) → party 6" }],
  ad05: [{ name: "Mariah", afterOcrLn: 3390, note: "Lycaeum: 'My wounds are mostly healed. Shall I join with thee now?' :YES (OCR 3384-3397). REQUIERE dismiss previo de Julia (op inexistente — calibración Fase B; sin él, joinByName no-op con party llena)" }],
  ad13: [{ name: "Geoffrey", afterOcrLn: 2690, note: "Jhelom: 'I would like to join thee, wilt thou have me?' :YES ''Tis indeed a great honor!' (OCR 2686-2694). REQUIERE dismiss previo de Jaana (calibración)" }],
  ad23: [{ name: "Johne", afterOcrLn: 400, note: "Underworld (naufragio): 'Might I join thee?' :YES (OCR 392-408, Player: Johne). Beat DENTRO de segmento [SKIP] — el recruit se activa cuando el runner aprenda interiores; REQUIERE dismiss previo de Iolo (salió en ep21/22)" }],
};

/** partySize asertable (solo mientras el modelo de party del port puede seguir al LP:
 *  a partir de ad05 los swaps pasan por el op `dismiss`. Ese op EXISTE y está cableado,
 *  pero es arnés de ESTADO (innLeave del core), no la baja por el flujo real de posada
 *  — ticket T-INN-LEAVE-REAL; por eso de ad05 en adelante es nota, no assert). */
const PARTY_ASSERT = { ad01: 4, ad02: 5, ad03: 6, ad04: 6 };

const SHADOWLORD_RE = /DOTH|SURROUND|HATRED|FALSEHOOD|COWARDICE/;
const ROOM_RE = /enter[il1|\]]ng room/i;
const UNDERWORLD_RE = /underw[o0]r[l1|\]i]d/i;
const BRITANNIA_RE = /br[il1|\]]tann/i;

/** Textos "tempranos" de un segmento (todos/expect) para sondear señales de transición. */
function segTexts(seg, n = 8) {
  const out = [];
  for (const b of seg.expect ?? []) {
    out.push(b.text);
    if (out.length >= n) break;
  }
  return out.join(" ");
}

function snippet(seg) {
  const t = (seg.script ?? []).find((op) => op.todo)?.todo ?? (seg.expect?.[0]?.text ?? "");
  return t.slice(0, 60);
}

/**
 * Máquina de estado de interior — un paso, PURA, para poder fijarla por unidad (#32).
 *
 * Gemela de `stepInterior` en mkoverlay-lp1.mjs, con UNA diferencia declarada: aquí no existe
 * la regla #89 («Underworld» en superficie ABRE interior), porque el estado de este generador
 * CRUZA episodios y no le hace falta. Por eso el fix de la costura de salida basta con la rama
 * del `if`, mientras que en LP1 sin su guarda propia sería inerte.
 *
 * Devuelve `falseEnter` en vez de tocar el patch: el falso-enter de Shadowlord NO toca el estado.
 */
export function stepInterior(seg, texts, state) {
  let { inInterior, why } = state;
  let falseEnter = false;

  // --- transiciones de la máquina interior (señales fiables) ---
  if (seg.seam === "dungeon-enter") {
    inInterior = true;
    why = "entrada-dng";
  } else if (seg.seam === "enter" && (seg.ctx === "smallmap" || seg.ctx === "shrine")) {
    const banner = seg.enter?.banner ?? "";
    // falso enter: aviso de Shadowlord en overworld leído como banner — NO toca la máquina
    if (seg.enter?.loc == null && SHADOWLORD_RE.test(banner)) falseEnter = true;
    else inInterior = false; // evidencia de superficie (incluye warp de muerte a LB castle)
  } else if (seg.seam === "exit" && inInterior) {
    // ★ #32: emerger al Underworld TAMBIÉN es salir del interior — la party queda en un mapa
    // GRANDE (location 0, floor 0xFF), no en una mazmorra. Antes esta rama sólo anotaba el
    // motivo y dejaba `inInterior` en true; esa asimetría con Britannia es la que marcaba las
    // costuras de salida al Underworld como interior.
    if (BRITANNIA_RE.test(texts)) inInterior = false;
    else if (UNDERWORLD_RE.test(texts)) {
      inInterior = false;
      why = "underworld";
    } else why = "exit-ambiguo-dng"; // conservador: sin evidencia de superficie, sigue interior
  }
  if (!inInterior && ROOM_RE.test(texts)) {
    // "Entering room.." fuera de interior = entrada de mazmorra que el OCR se comió
    inInterior = true;
    why = "sala-combate";
  }
  if (inInterior) {
    if (ROOM_RE.test(texts)) why = "sala-combate";
    else if (UNDERWORLD_RE.test(texts)) why = "underworld";
  }
  return { inInterior, why, falseEnter };
}

/** El estado interior CRUZA episodios (ad09 acaba dentro de Destard; ad10 arranca ahí):
 *  mkoverlay recibe el estado final del episodio anterior y devuelve el suyo. */
function mkoverlay(part, carry, write) {
  const route = JSON.parse(readFileSync(join(ROUTES, `${part}.route.json`), "utf8"));
  const n = Number(part.slice(2));
  // #43 ruling 1: se LEE el overlay existente para fusionar sobre su curación manual. Sin esto,
  // `--force` borraba los 3 `dismiss` (ad05/ad13/ad21) y las 12 marcas `enter.underworld` de
  // E-23 — y encima dejaba el artefacto AUTO-REFUTANTE, porque el `ledger.note` regenerado
  // afirma que ese mismo op `dismiss` existe y está cableado justo en esos tres episodios.
  const ovPath = join(OVERLAYS, `${part}.json`);
  const prev = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : { segments: {} };
  const overlay = {
    entry:
      n === 1
        ? {
            boot: "fresh",
            normalizeAvatarName: "Barnabas",
            note:
              "ESPEJO-2 (LP Alex Diener). Arranque partida NUEVA (intro+gitana = ruido OCR sin panel al principio de ep01). Avatar del LP = 'Barnabas' (5238 hits OCR); normalizado por arnés como en espejo-1. Party base Barnabas+Iolo+Shamino.",
          }
        : {
            checkpoint: `ad${String(n - 1).padStart(2, "0")}`,
            entryClock: { hour: 10, minute: 0 },
            note: `Encadena del checkpoint de ad${String(n - 1).padStart(2, "0")}. Hora canónica de arneses 10:00. Generado offline (mkoverlay-ad).`,
          },
    segments: {},
  };
  if (n === 2)
    overlay.entry.note +=
      " OJO: el OCR de ep02 tiene el primer carácter de cada eco corrupto — el input-log de movimiento es IRRECUPERABLE (0 pasos nav); el episodio depende de resync por costuras (calibración).";

  let inInterior = carry.inInterior;
  let why = carry.inInterior ? `${carry.why}-arrastre-${carry.from}` : "";
  let skips = 0;
  let combats = 0;
  for (const seg of route.segments) {
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

    // --- marcado ---
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
      // ★ #43 — `openedBy` y `skip` son MUTUAMENTE EXCLUYENTES: el runner ya conduce este
      // segmento (fase 3e/E-3), así que atravesarlo nav-only sería tirar lo que E-3 abrió.
      // Derivado del corpus: de los 89 segmentos con `openedBy` de AD, CERO llevan `skip` en las
      // rutas commiteadas. Ver el comentario largo en mkoverlay-lp1.mjs.
      patch.skip = false;
      patch.note = `interior ABIERTO por el runner (openedBy: ${seg.openedBy}) — ${why}. ${snippet(seg)}`;
      if (why === "entrada-dng") why = "interior-dng";
    } else if (inInterior) {
      patch.skip = "pendiente-runner";
      patch.note = `[SKIP:pendiente-runner] ${why}. ${snippet(seg)}`;
      skips++;
      if (why === "entrada-dng") why = "interior-dng";
    } else if (seg.ctx === "combat") {
      // #43 ruling 2: POLARIDAD EXPLÍCITA — `skip: false` es un TOMBSTONE («quítalo»), no la
      // clave ausente («no opino»). Ver el comentario largo en mkoverlay-lp1.mjs.
      patch.skip = false;
      patch.policy = "auto";
      patch.note = patch.note ?? `Combate overworld/naval (RNG no-comparable, policy:auto). ${snippet(seg)}`;
      combats++;
    } else {
      patch.skip = false;
      if (!patch.note) {
        const s = snippet(seg);
        if (s) patch.note = s;
      }
    }

    // --- recruits anclados por ocrLn dentro de este segmento ---
    for (const r of RECRUITS[part] ?? []) {
      if (r.afterOcrLn >= seg.ocr.from && r.afterOcrLn <= seg.ocr.to) {
        patch.insertOps = [...(patch.insertOps ?? []), { afterOcrLn: r.afterOcrLn, ops: [{ recruit: r.name }] }];
        patch.note = `${patch.note ? patch.note + " · " : ""}RECRUIT ${r.name}: ${r.note}`;
      }
    }

    const prevPatch = prev.segments?.[seg.id];
    if (Object.keys(patch).length) overlay.segments[seg.id] = mergePatch(prevPatch ?? {}, patch);
    else if (prevPatch) overlay.segments[seg.id] = prevPatch;
  }

  overlay.entry.note += ` ${skips} segmentos [SKIP:pendiente-runner], ${combats} combates policy:auto.`;
  overlay.ledger = {
    note:
      "Party del LP2: Barnabas+Iolo+Shamino (fresh) → +Gwenno(ad01) +Jaana(ad02) +Julia(ad03) | Julia→Mariah(ad05) | Jaana→Geoffrey(ad13) | Iolo sale(ad21/22) +Johne(ad23, Underworld). Los SWAPS usan el op `dismiss`, que EXISTE y está cableado en ad05/ad13/ad21 (runner.dismissCompanion → hook __u5test.innLeave → core/shops.innLeave, calco de SHOPPES3 0x02AE-0x047D). Sigue siendo INTERINO: es arnés de ESTADO, no la baja jugada por el flujo real de posada (ticket T-INN-LEAVE-REAL). Oro/comida via ledger numérico del runner, no se asertan.",
    assert: PARTY_ASSERT[part] != null ? { partySize: PARTY_ASSERT[part] } : {},
  };

  if (write) {
    mkdirSync(OVERLAYS, { recursive: true });
    const out = join(OVERLAYS, `${part}.json`);
    if (existsSync(out) && !FORCE) {
      console.error(`${out} ya existe — usa --force para regenerar`);
    } else {
      writeFileSync(out, JSON.stringify(overlay, null, 2) + "\n");
      console.log(`${part}: overlay con ${Object.keys(overlay.segments).length} patches (${skips} skip, ${combats} combat-auto)`);
    }
  }
  return { inInterior, why: why.replace(/-arrastre-.*$/, ""), from: part };
}

// SIEMPRE se recorre la cadena entera (el arrastre de interior exige el orden ad01..ad25);
// `only` restringe solo QUÉ overlays se escriben.
//
// Bajo la guarda de CLI: importar este módulo para fijar el clasificador por unidad (#32) no
// debe leer el directorio de rutas ni, mucho menos, escribir overlays.
if (IS_CLI) {
  const all = readdirSync(ROUTES)
    .filter((f) => f.endsWith(".route.json"))
    .map((f) => f.replace(".route.json", ""))
    .sort();
  let carry = { inInterior: false, why: "", from: "boot" };
  for (const p of all) carry = mkoverlay(p, carry, only.length === 0 || only.includes(p));
}
