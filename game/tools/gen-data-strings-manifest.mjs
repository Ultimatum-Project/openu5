/**
 * GENERADOR del manifiesto de procedencia del corpus de datos (i18n F0a).
 *
 * Produce `tests/fixtures/data-strings-manifest.json`: cada SUPERFICIE del corpus
 * de assets extraídos (≈5.130 strings) con su PROCEDENCIA POR ORIGEN (binario
 * fuente + parser + cadena de extracción + cita re/notes), su CUBO (L/M/X), sus
 * conteos y un HASH de contenido (detector de deriva). No cita [D/V/C/Q] por-string
 * (inviable a esa escala; el anti-fabricación por-string ya lo da el corpus).
 *
 * La procedencia es FUNCIÓN PURA del id de superficie (por familia), así que la
 * regeneración es reproducible: correr este script tras un cambio LEGÍTIMO del
 * extractor reescribe conteos+hash sin perder la procedencia. El test
 * `data-strings-manifest.test.ts` valida el fichero commiteado contra los assets.
 *
 * Uso:  node tools/gen-data-strings-manifest.mjs        # reescribe el fixture
 *       node tools/gen-data-strings-manifest.mjs --check # sale ≠0 si hay deriva
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildCorpusBySurface, surfaceHash, wordCount } from "./i18n-corpus.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "tests", "fixtures", "data-strings-manifest.json");

/**
 * Procedencia por FAMILIA de superficie (binario fuente + parser + cadena + cita).
 * Fuente: extractor/src/cli.ts (qué binario lee cada salida) + los parsers (que
 * citan el offset DS 0x…) + re/notes donde existan.
 */
function provenanceFor(id) {
  // TLK: diálogos por fichero maestro (texto L + keywords M), dict de DATA.OVL.
  const tlk = id.match(/^talk\/(\w+)\.json#(text|keywords)$/);
  if (tlk) {
    const MASTER = tlk[1].toUpperCase();
    return {
      source: [`${MASTER}.TLK`, "DATA.OVL"],
      parser: "extractor/src/parsers/tlk.ts",
      chain: `${MASTER}.TLK (bloques comprimidos) → parseTlkFile + diccionario talkCompressedWords (DATA.OVL) → NPCs {name/description/greeting/job/bye + qa[keywords,answer]}`,
      cite: "extractor/src/parsers/tlk.ts · re/notes/dataovl-strings.md (talkCompressedWords)",
    };
  }
  // data.json (DATA.OVL): display-nouns, tokens de mecánica, diccionario, pools.
  if (id.startsWith("data.json#")) {
    return {
      source: ["DATA.OVL"],
      parser: "extractor/src/parsers/dataovl.ts",
      chain: `DATA.OVL → parseDataOvl → ${id.slice("data.json#".length)}`,
      cite: "extractor/src/parsers/dataovl.ts · re/notes/dataovl-strings.md · re/notes/dataovl-tables.md",
    };
  }
  const FILE = {
    "story.json": { source: ["STORY.DAT"], parser: "extractor/src/parsers/story.ts", cite: "extractor/src/parsers/story.ts" },
    "signs.json": { source: ["SIGNS.DAT", "DATA.OVL"], parser: "extractor/src/parsers/signs.ts", cite: "extractor/src/parsers/signs.ts" },
    "shoppe.json": { source: ["SHOPPE.DAT", "DATA.OVL"], parser: "extractor/src/parsers/shoppe.ts", cite: "extractor/src/parsers/shoppe.ts (dict talkCompressedWords)" },
    "look2.json": { source: ["LOOK2.DAT"], parser: "extractor/src/parsers/look2.ts", cite: "extractor/src/parsers/look2.ts · re/notes/lookobj.md" },
    "intro-scenes.json": { source: ["DATA.OVL", "STORY.DAT"], parser: "extractor/src/parsers/intro-scenes.ts", cite: "extractor/src/parsers/intro-scenes.ts" },
    "questions.json": { source: ["QUESTION.DAT"], parser: "extractor/src/parsers/questions.ts", cite: "extractor/src/parsers/questions.ts (gitana: narración L + elección de virtud M)" },
    // Superficie del endgame (carril cadenas-presentacion: cierra el blind-spot
    // `i18n-corpus-sin-endgame` — ENDMSG.DAT era el único .DAT de texto sin superficie).
    "endgame.json": { source: ["ENDMSG.DAT"], parser: "extractor/src/parsers/endgame-msg.ts", cite: "extractor/src/parsers/endgame-msg.ts · re/notes/endgame-derivation.md" },
  };
  // ds-strings.json (FICHA β, carril cadenas-segmento-d): los mensajes que el original
  // carga al búfer DS 0xB21E. Son DOS superficies porque el motor no imprime el record
  // pelado — lo ENVUELVE—, y la clave de es.json es la huella de lo que recibe `t()`:
  //   · #records  — los 64 registros crudos, tal cual salen del fichero del usuario.
  //   · #composed — las formas que el port EMITE (comillas, `{}?"`, `\n\n`). Su careo
  //     contra los sitios reales del port vive en `tests/ds-strings-compuestas.test.ts`.
  if (id === "ds-strings.json#records" || id === "ds-strings.json#composed") {
    const compuesta = id.endsWith("#composed");
    return {
      source: ["KARMA.DAT", "MISCMSG.DAT", "ENDMSG.DAT"],
      parser: "extractor/src/parsers/ds-strings.ts",
      chain: compuesta
        ? "KARMA/MISCMSG/ENDMSG.DAT → ds-strings.ts → registros NUL → composición del port (comilla + record + comilla, record + virtud + `?\"`, …)"
        : "KARMA/MISCMSG/ENDMSG.DAT → ds-strings.ts → registros NUL en orden de fichero",
      cite: "extractor/src/parsers/ds-strings.ts · re/notes/acta-ficha-beta-ds-strings.md",
    };
  }
  // demo-scene.json#titles (auditoría G8, inventario de mundo-cerrado): los títulos
  // de capítulo del attract-demo — único texto user-facing del fichero (el resto es
  // mapas/bytecode del guion, numérico).
  if (id === "demo-scene.json#titles") {
    return {
      source: ["MISCMAPS.DAT"],
      parser: "extractor/src/parsers/demo-scene.ts",
      chain: "MISCMAPS.DAT → demo-scene.ts → titles («The Summoning»/«The Journey»/«The Arrival»/«The Welcoming»)",
      cite: "extractor/src/parsers/demo-scene.ts · re/notes/demo-scene-data.md",
    };
  }
  if (FILE[id]) {
    const p = FILE[id];
    return { source: p.source, parser: p.parser, chain: `${p.source[0]} → ${p.parser.split("/").pop()} → ${id}`, cite: p.cite };
  }
  throw new Error(`Sin regla de procedencia para la superficie «${id}» — añádela a provenanceFor()`);
}

const CUBE_DESC = {
  L: "traducible libre (texto de juego)",
  M: "mecánica (INPUT del jugador: keyword/sílaba/mantra — alias, no traducir a ciegas)",
  X: "técnico (nombre de fichero/código/basura binaria — NO traducir)",
  "L+M": "mixto (texto libre + una elección mecánica)",
};

function build() {
  const surfaces = buildCorpusBySurface().map((s) => {
    const uniq = [...new Set(s.strings.map((x) => x.normalize("NFC")))];
    return {
      id: s.id,
      cube: s.cube,
      ...provenanceFor(s.id),
      strings: uniq.length,
      words: wordCount(uniq),
      hash: surfaceHash(s.strings),
    };
  });
  const totals = {};
  for (const s of surfaces) {
    totals[s.cube] ??= { surfaces: 0, strings: 0, words: 0 };
    totals[s.cube].surfaces++;
    totals[s.cube].strings += s.strings;
    totals[s.cube].words += s.words;
  }
  return {
    version: 1,
    note:
      "Procedencia POR ORIGEN del corpus de datos extraídos (i18n F0). Cada superficie = " +
      "fichero/pool fuente con su cadena de extracción + hash de contenido (deriva). " +
      "Regenera: node tools/gen-data-strings-manifest.mjs. Valida: tests/data-strings-manifest.test.ts. " +
      "Normalización del hash: strings con ≥1 letra → NFC → sin recortar → dedup+orden (code-unit) → " +
      "JSON.stringify → sha256. Ver docs/i18n/data-strings-manifest.md.",
    cubes: CUBE_DESC,
    totals,
    surfaces,
  };
}

const manifest = build();
if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current.trim() !== JSON.stringify(manifest, null, 2).trim()) {
    console.error("DERIVA: el manifiesto commiteado ≠ el recomputado. Corre: node tools/gen-data-strings-manifest.mjs");
    process.exit(1);
  }
  console.log("OK — manifiesto al día.");
} else {
  writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`✔ ${manifest.surfaces.length} superficies → ${OUT}`);
  console.log("totales:", JSON.stringify(manifest.totals));
}
