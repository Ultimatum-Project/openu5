/**
 * F3-T1 — GENERADOR DEL MANIFIESTO DE COBERTURA DEL GRAND TOUR.
 *
 * USO:  node game/e2e/grandtour/manifest.gen.mjs   (regenera manifest.json)
 *       import { buildManifest } from ".../manifest.gen.mjs"  (guarda CI)
 *
 * QUÉ HACE. Recorre los assets extraídos (`game/assets/`, regenerables con
 * `npm run extract`) más los ficheros de datos ya en el árbol y emite
 * `manifest.json`: la lista de ítems de contenido que el Grand Tour (F3) recorre,
 * agrupados en las categorías de la spec `2026-07-15-grand-tour-espejo.md §1.1`.
 * Cada ítem lleva `{ id, category, name, source, reachableBy }`: `name` es la
 * etiqueta humana (autoría de capítulos + informe de cobertura de ch19), `source`
 * cita el asset del que se derivó, `reachableBy` es el capítulo que lo marca al
 * pasar (null hasta que exista).
 *
 * ALCANCE DE COBERTURA (declaración honesta — no "enumera TODO"). El manifiesto
 * cubre el contenido MECÁNICAMENTE ENUMERABLE de los assets: los 32 small-maps y
 * sus plantas, los 2 mapas 256×256 (over/underworld) como unidades, las 8
 * mazmorras + sus celdas especiales por tipo, las 16 arenas de combate nombradas,
 * los guiones TLK, tiendas, hechizos, enemigos, equipo, pociones, reactivos,
 * santuarios, moongates, la tríada shard/llama/shadowlord, artefactos, señales,
 * comandos A-Z, los hitos de endgame y los "recuerdos" nombrados (pozo, cárcel,
 * tesoro, victoria), y los objetos buscables (searchObjects). NO enumera: cada
 * casilla transitable de los overworld/underworld (se cubren como 2 unidades-mapa,
 * no tile a tile), ni variantes de spawn/combate por hora — fuera del criterio de
 * "cobertura de contenido conocido". Un hueco alcanzable se clasifica en el triage
 * (spec §5); el cierre de ch19 asserta `covered === manifest` o enumera el hueco.
 *
 * ANTI-DERIVA. `manifest.json` va COMMITEADO (ch19 lo importa como oráculo) y la
 * guarda `game/tests/grandtour-manifest.test.ts` lo regenera y falla si difiere,
 * más assert de conteo por categoría (spec §1.1). Mismo patrón que
 * `gen-string-manifest.mjs` + su test.
 *
 * FUENTES ASM (categorías sin asset-JSON limpio). Comandos A-Z (jump-table
 * 0x3178), la tríada shard/llama/shadowlord (shadowlord-ritual.md 0x1728/0x1682/
 * 0x444a), los hitos de endgame (endgame.md) y los "recuerdos" nombrados (spec §19
 * + re/notes) se generan de la ESTRUCTURA fija que esas notas fijan, citando la
 * nota — no de contenido tecleado a discreción.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "..", "assets");
const CORE_DATA = join(HERE, "..", "..", "src", "core", "data");
const OUT = join(HERE, "manifest.json");

const readAsset = (rel) =>
  JSON.parse(readFileSync(join(ASSETS, rel), "utf8").replace(/^﻿/, ""));
const readCore = (rel) =>
  JSON.parse(readFileSync(join(CORE_DATA, rel), "utf8").replace(/^﻿/, ""));

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Clases de celda "especial" de mazmorra (nibble alto, `re/notes/dungeon.md §0.2`). */
const DUNGEON_CELL_CLASSES = {
  chest: [0x4],
  fountain: [0x5],
  trap: [0x6],
  field: [0x8],
  room: [0xa, 0xf],
};

/** Tríada de la trama (tabla `re/notes/shadowlord-ritual.md`, DS 0x1728/0x1682/0x444a). */
const TRINITY = [
  { shard: "Falsehood", flame: "Truth", shadowlord: "Faulinei" },
  { shard: "Hatred", flame: "Love", shadowlord: "Astaroth" },
  { shard: "Cowardice", flame: "Courage", shadowlord: "Nosfentor" },
];

/** Hitos canónicos del endgame (`re/notes/endgame.md`, ENDGAME.OVL). */
const ENDGAME_BEATS = [
  { id: "endgame-veramocor", name: "Aprender VERAMOCOR con el Codex" },
  { id: "endgame-doom-floor8", name: "Descender a Doom planta 8" },
  { id: "endgame-rescue-lb", name: "Rescatar a Lord British" },
];

/** "Recuerdos" nombrados (spec §1.1 #19 + re/notes/{town-klimb,blackthorn,endgame}). */
const MEMORY_BEATS = [
  { id: "memory-beat-wishing-well", name: "Pozo de los deseos", source: "re/notes/town-klimb.md" },
  { id: "memory-beat-blackthorn-jail", name: "Cárcel del Palacio de Blackthorn", source: "re/notes/blackthorn.md" },
  { id: "memory-beat-lb-treasure", name: "Tesoro de Lord British", source: "re/notes/endgame.md" },
  { id: "memory-beat-victory", name: "Victoria (final del juego)", source: "re/notes/endgame.md" },
];

/** Los 2 mapas 256×256 que el tour camina (el Amuleto vive en el Underworld). */
const WORLD_MAPS = [
  { id: "map-overworld", name: "Overworld (Britannia)", source: "maps/overworld.json" },
  { id: "map-underworld", name: "Underworld", source: "maps/underworld.json" },
];

export function buildManifest() {
  const data = readAsset("data.json");
  const smallmaps = readAsset("maps/smallmaps.json");
  const dungeons = readAsset("maps/dungeons.json");
  const combatmaps = readAsset("maps/combatmaps.json");
  const signs = readAsset("signs.json");
  const talk = {
    towne: readAsset("talk/towne.json"),
    castle: readAsset("talk/castle.json"),
    dwelling: readAsset("talk/dwelling.json"),
    keep: readAsset("talk/keep.json"),
  };
  // Nombres de los 48 slots de equipo: InventoryDetails.json "Armament" (49 ítems;
  // el índice 0 = BareHands es el slot "sin arma", los inventariables son 1..48).
  const armament = readCore("InventoryDetails.json").Armament;

  /** @type {{id:string,category:string,name:string,source:string,reachableBy:null}[]} */
  const items = [];
  const seen = new Set();
  const add = (category, id, name, source) => {
    if (seen.has(id)) throw new Error(`manifest: id duplicado "${id}" (${category})`);
    if (!name) throw new Error(`manifest: name vacío en "${id}" (${category})`);
    seen.add(id);
    items.push({ id, category, name: String(name), source, reachableBy: null });
  };

  // 1. Localizaciones small-map (32) — maps/smallmaps.json
  for (const loc of smallmaps) {
    add("location", `location-${loc.id}-${slug(loc.name)}`, loc.name, "maps/smallmaps.json");
  }

  // 2. Plantas por localización (z-levels a pisar) — maps/smallmaps.json (floors[])
  for (const loc of smallmaps) {
    for (const fl of loc.floors) {
      add("floor", `floor-${loc.id}-z${fl.z}`, `${loc.name} z${fl.z}`, "maps/smallmaps.json");
    }
  }

  // 3. Mazmorras (8) — maps/dungeons.json
  for (const dg of dungeons) {
    add("dungeon", `dungeon-${slug(dg.name)}`, dg.name, "maps/dungeons.json");
  }

  // 4. Words of Power (8) — data.json:wordsOfPower
  for (const w of data.wordsOfPower) {
    add("word-of-power", `word-${slug(w)}`, w, "data.json:wordsOfPower");
  }

  // 5. Celdas/salas especiales de mazmorra (por tipo presente) — maps/dungeons.json
  for (const dg of dungeons) {
    const types = new Set();
    for (const floor of dg.floors)
      for (const row of floor) for (const cell of row) types.add(cell.type);
    for (const [cls, tset] of Object.entries(DUNGEON_CELL_CLASSES)) {
      if (tset.some((t) => types.has(t)))
        add("dungeon-cell", `cell-${slug(dg.name)}-${cls}`, `${dg.name}: ${cls}`, "maps/dungeons.json");
    }
  }

  // 6. NPCs con diálogo (135) — talk/{towne,castle,dwelling,keep}.json
  for (const [cat, recs] of Object.entries(talk)) {
    for (const r of recs) {
      const name = (r.name ?? [])
        .filter((s) => s.kind === "text")
        .map((s) => s.text)
        .join("")
        .trim();
      if (!name) continue; // registro sin nombre = slot vacío, no conversable
      add("npc", `npc-${cat}-${r.npcIndex}-${slug(name)}`, name, `talk/${cat}.json`);
    }
  }

  // 7. Tiendas (46) — data.json:storeNames (nombres propios de cada SHOPPE)
  data.storeNames.forEach((name, i) => {
    add("shop", `shop-${i}-${slug(name)}`, name, "data.json:storeNames");
  });

  // 8. Hechizos (48) — data.json:spells
  data.spells.forEach((name, i) => {
    add("spell", `spell-${i}-${slug(name)}`, name, "data.json:spells");
  });

  // 9. Tipos de enemigo (48) — data.json:enemyStats (48 slots, 2 eras)
  data.enemyStats.forEach((_, i) => {
    const upper = data.monsterNamesUpper[i];
    const name = upper && upper !== "x" ? upper : data.monsterNamesMixed[i] ?? `Enemy ${i}`;
    add("enemy", `enemy-${i}-${slug(upper ?? name)}`, name, "data.json:enemyStats");
  });

  // 10. Objetos de equipo (48, con nombre) — data.json:equipIndexes + InventoryDetails Armament
  data.equipIndexes.forEach((_, i) => {
    const name = armament[i + 1]?.ItemName ?? `Equip ${i}`;
    add("equipment", `equip-${i}-${slug(name)}`, name, "data.json:equipIndexes+InventoryDetails.Armament");
  });

  // 11. Pociones (8) — data.json:potions
  data.potions.forEach((color, i) => {
    add("potion", `potion-${i}-${slug(color)}`, `${color} Potion`, "data.json:potions");
  });

  // 12. Reactivos (8) — data.json:reagents
  data.reagents.forEach((name, i) => {
    add("reagent", `reagent-${i}-${slug(name)}`, name, "data.json:reagents");
  });

  // 13. Santuarios + mantras (8) — data.json:virtues/mantras
  data.virtues.forEach((virtue, i) => {
    const mantra = data.mantras[i] ?? "";
    add("shrine", `shrine-${i}-${slug(virtue)}`, `${virtue} (${mantra})`, "data.json:virtues+mantras");
  });

  // 14. Moongates (fases lunares) — data.json:moonPhases (8 tiles-fase distintos)
  const phases = [...new Set(data.moonPhases)].sort((a, b) => a - b);
  for (const phase of phases) {
    add("moongate", `moongate-phase-${phase}`, `Fase lunar ${phase}`, "data.json:moonPhases");
  }

  // 15. Shards / Llamas / Shadowlords (3+3+3) — data.json:shards + shadowlord-ritual.md
  for (const t of TRINITY) {
    add("shard", `shard-${slug(t.shard)}`, `Shard of ${t.shard}`, "data.json:shards");
    add("flame", `flame-${slug(t.flame)}`, `Flame of ${t.flame}`, "re/notes/shadowlord-ritual.md");
    add("shadowlord", `shadowlord-${slug(t.shadowlord)}`, t.shadowlord, "re/notes/shadowlord-ritual.md");
  }

  // 16. Artefactos de trama y objetos únicos (11) — data.json:specialItemNames(+2)
  data.specialItemNames.forEach((name) => {
    add("artifact", `artifact-${slug(name)}`, name, "data.json:specialItemNames");
  });
  data.specialItemNames2.forEach((name) => {
    add("artifact", `artifact-${slug(name)}`, name, "data.json:specialItemNames2");
  });

  // 17. Señales/signos (79) — signs.json
  signs.forEach((sign) => {
    const firstLine = String(sign.text ?? "").split("\n").map((l) => l.trim()).find(Boolean);
    const name = firstLine || `Señal @loc${sign.location} (${sign.x},${sign.y})`;
    add("sign", `sign-${sign.location}-${sign.x}-${sign.y}`, name, "signs.json");
  });

  // 18. Comandos A-Z (26) — jump-table 0x3178 (re/notes/command-dispatch.md)
  for (let c = 0; c < 26; c++) {
    const letter = String.fromCharCode(97 + c);
    add("command", `command-${letter}`, `Comando ${letter.toUpperCase()}`, "re/notes/command-dispatch.md");
  }

  // 19. Endgame — secuencia canónica (re/notes/endgame.md)
  for (const beat of ENDGAME_BEATS) {
    add("endgame", beat.id, beat.name, "re/notes/endgame.md");
  }

  // 20. Contenido "recuerdo" nombrado (spec §1.1 #19) — hitos narrativos concretos.
  for (const beat of MEMORY_BEATS) {
    add("memory-beat", beat.id, beat.name, beat.source);
  }

  // 21. Objetos buscables (102) — data.json:searchObjects (sin centinelas x=y=233).
  data.searchObjects.forEach((o, i) => {
    if (o.x === 233 && o.y === 233) return;
    add(
      "memory-object",
      `search-${i}-loc${o.location}-${o.x}-${o.y}`,
      `Objeto oculto #${o.id} @loc${o.location} (${o.x},${o.y})`,
      "data.json:searchObjects"
    );
  });

  // 22. Los 2 mapas 256×256 (overworld/underworld) como unidades del tour.
  for (const m of WORLD_MAPS) {
    add("map", m.id, m.name, m.source);
  }

  // 23. Arenas de combate nombradas (16) — maps/combatmaps.json
  for (const cm of combatmaps) {
    const name = cm.name;
    if (!name || ["", "?", "placeholder"].includes(name)) continue;
    add("combat-arena", `arena-${cm.index}-${slug(name)}`, name, "maps/combatmaps.json");
  }

  return items;
}

/** Conteos esperados por categoría — la guarda CI los asserta (spec §1.1 + fusión). */
export const EXPECTED_COUNTS = {
  location: 32,
  floor: 64,
  dungeon: 8,
  "word-of-power": 8,
  "dungeon-cell": 21,
  npc: 135,
  shop: 46,
  spell: 48,
  enemy: 48,
  equipment: 48,
  potion: 8,
  reagent: 8,
  shrine: 8,
  moongate: 8,
  shard: 3,
  flame: 3,
  shadowlord: 3,
  artifact: 11,
  sign: 79,
  command: 26,
  endgame: 3,
  "memory-beat": 4,
  "memory-object": 102,
  map: 2,
  "combat-arena": 16,
};

// Ejecutado como script → escribe manifest.json.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const items = buildManifest();
  writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");
  const byCat = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] ?? 0) + 1;
  console.log(`manifest.json: ${items.length} ítems en ${Object.keys(byCat).length} categorías`);
  for (const [cat, n] of Object.entries(byCat)) {
    const exp = EXPECTED_COUNTS[cat];
    const flag = exp !== undefined && exp !== n ? `  ⚠ esperado ${exp}` : "";
    console.log(`  ${cat.padEnd(16)} ${String(n).padStart(4)}${flag}`);
  }
}
