/**
 * Extractor CANÓNICO del diálogo de una ciudad/keep para i18n (F3).
 *
 * GUARDA contra el bug off-by-one (i18n Yew, 2026-07-18): el juego resuelve el
 * diálogo por `npcIndex` (registry.ts: `new Map(file.map(s => [s.npcIndex, s]))`,
 * get(loc, dn) = byIdx.get(dn)), pero en TODOS los ficheros talk la POSICIÓN de
 * array ≠ npcIndex (pos = npcIndex − 1). Indexar por `file[dn]` sale desplazado uno
 * y omite silenciosamente el NPC de npcIndex más bajo (el anti-fab no lo caza).
 *
 * Este módulo resuelve SIEMPRE por npcIndex (nunca por posición), así los NPCs
 * pertenecen al loc pedido POR CONSTRUCCIÓN — el bug no puede recurrir usándolo.
 * ASSERTA que cada dialogNumber resuelve (npcIndex == dn) y expone, como
 * DIAGNÓSTICO no-bloqueante, los lugares que citan los NPCs (la "mezcla imposible"
 * de dos keeps distintos fue el síntoma que delató el bug; un solo loc real no
 * debería declararse hogar de dos keeps — pero las MENCIONES de lore a otros keeps
 * son legítimas, así que es aviso a ojo, no throw).
 *
 * Uso: `node tools/city-dialogue.mjs <loc>` vuelca {npc: [segmentos]}.
 * API: `cityDialogue(loc)` → { master, npcs, total, placesMentioned }.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "assets");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** locs 1-8=towne, 9-16=dwelling, 17-24=castle, 25-32=keep (registry.masterForLocation). */
export function masterForLocation(loc) {
  if (loc >= 1 && loc <= 8) return "towne";
  if (loc >= 9 && loc <= 16) return "dwelling";
  if (loc >= 17 && loc <= 24) return "castle";
  if (loc >= 25 && loc <= 32) return "keep";
  return null;
}

/** Nombre visible de un NPC (para diagnóstico/agrupación). */
function npcName(e) {
  return (e.name || []).filter((t) => t.kind === "text").map((t) => t.text).join("").trim();
}

/** Recorre TODOS los tokens kind:"text" con letra (name/desc/greeting/job/bye + qa +
 *  labels[].{initialLine, defaultAnswers, qa} — árboles anidados incluidos). */
function walkText(node, out) {
  if (Array.isArray(node)) {
    for (const x of node) walkText(x, out);
  } else if (node && typeof node === "object") {
    if (node.kind === "text" && /[A-Za-z]/.test(node.text || "")) out.push(node.text);
    for (const k of Object.keys(node)) if (k !== "kind") walkText(node[k], out);
  }
}

export function cityDialogue(loc) {
  const master = masterForLocation(loc);
  if (!master) throw new Error(`loc ${loc} sin master (fuera de 1-32)`);
  const file = readJson(join(ASSETS, "talk", `${master}.json`));
  const npcsData = readJson(join(ASSETS, "npcs.json"));
  const byIdx = new Map();
  for (const e of file) if (e && e.npcIndex != null) byIdx.set(e.npcIndex, e);

  const slots = npcsData[String(loc)];
  if (!slots) throw new Error(`npcs.json no tiene loc ${loc}`);
  const dnums = [...new Set(slots.map((s) => s.dialogNumber).filter((n) => n > 0))].sort((a, b) => a - b);

  const npcs = {};
  const keepNames = new Set(); // para el check de "mezcla imposible"
  for (const dn of dnums) {
    const e = byIdx.get(dn);
    if (!e) continue; // dn sin entrada (tiendas/sistema): se salta, no es diálogo
    // GUARDA 1: nunca por posición — comprobamos que el resuelto ES por npcIndex.
    if (e.npcIndex !== dn) throw new Error(`GUARDA: dn ${dn} resolvió a npcIndex ${e.npcIndex} (¿indexado por posición?)`);
    const segs = [];
    walkText(e, segs);
    npcs[npcName(e) || `dn${dn}`] = [...new Set(segs)];
    // DIAGNÓSTICO (no-bloqueante): lugares citados, por si delatan un off-by-one.
    for (const s of segs) {
      const m = s.match(/\b(Lycaeum|Empath Abbey|Serpent'?s Hold|Bordermarch|Stonegate)\b/);
      if (m) keepNames.add(m[1]);
    }
  }
  const total = new Set(Object.values(npcs).flat()).size;
  return { master, loc, npcs, total, placesMentioned: [...keepNames] };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const loc = Number(process.argv[2]);
  if (!loc) {
    console.error("uso: node tools/city-dialogue.mjs <loc>");
    process.exit(1);
  }
  const { master, npcs, total } = cityDialogue(loc);
  console.error(`loc ${loc} (${master}): ${Object.keys(npcs).length} NPCs, ${total} segmentos únicos`);
  console.log(JSON.stringify(npcs, null, 2));
}
