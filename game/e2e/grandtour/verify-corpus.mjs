/**
 * F3-T1 — VERIFICADOR ESTÁTICO DEL CORPUS (`verify:corpus`).
 *
 * USO:  node game/e2e/grandtour/verify-corpus.mjs
 *
 * QUÉ HACE. Cruza cada hecho de `corpus.json` contra los assets extraídos
 * (`game/assets/`), ejecutando los `checks[]` declarativos de cada hecho. Barato y
 * sin navegador → entra en `verify:all` (spec §4). Detecta a la vez bugs del
 * extractor y walkthroughs imprecisos: si un hecho afirma que Malifora enseña
 * FALLAX en Moonglow y el asset no lo respalda, ROJO con la cita.
 *
 * QUÉ NO HACE. No juega el juego. Los hechos `verify:["e2e"]` (o cuyos `checks`
 * están vacíos) se DIFIEREN al capítulo del tour que los prueba jugando; aquí sólo
 * se reportan como "diferido a e2e", nunca fallan.
 *
 * PREDICADOS SOPORTADOS (`check.type`):
 *   dataArrayContains {array,value}  — data.json[array] contiene value (case-insens.)
 *   dataArrayLength   {array,length} — data.json[array].length === length
 *   dataArrayIndexEquals {array,index,value}
 *                                     — data.json[array][index] === value. Ancla el PRECIO BASE
 *                                       exacto de un ítem/tienda (index = id de equipo, etc.).
 *   dungeonExists     {name}         — maps/dungeons.json tiene esa mazmorra
 *   locationExists    {name}         — maps/smallmaps.json tiene esa localización (slug)
 *   npcTeachesWord    {teacher,word} — un NPC de nombre `teacher` en algún TLK
 *                                       entrega `word` (literal, o vía op Rune en una
 *                                       respuesta con keyword word/power/moon/rune/stone)
 *   npcAnswerContains {npc,contains}  — SÓLO el texto visible (nodos `text`, sin ops) de
 *                                       CUALQUIER respuesta/greeting/job/label del NPC
 *                                       contiene `contains` (case-insens.). Ancla la línea
 *                                       byte-textual exacta que verá el jugador → detecta
 *                                       truncado/corrupción del extractor, más fino que el
 *                                       mero `includes(word)` de npcTeachesWord.
 *   npcHasKeyword     {npc,keyword}   — el NPC responde a `keyword` (aparece en el array
 *                                       `keywords` de alguna qa, de raíz o de label). Ancla
 *                                       la tecla EXACTA que el capítulo del tour debe teclear.
 *   stringPoolContains {pool,value}   — algún string del pool `data.stringPools[name==pool]`
 *                                       contiene `value` (case-insens.). Ancla mensajes de
 *                                       runtime byte-exactos (ritual de shard, uso de regalia…)
 *                                       que no viven en un array plano de data.json.
 *   npcPlacedInLocation {dialogNumber,location}
 *                                     — la localización `location` de `npcs.json` coloca a un
 *                                       NPC con ese `dialogNumber`. FALSABILIZA la asignación de
 *                                       pueblo (antes inferida por rango de índice TLK). Towns
 *                                       towne.json: Moonglow=1 Britain=2 Jhelom=3 Yew=4 Minoc=5
 *                                       Trinsic=6 SkaraBrae=7 NewMagincia=8.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "..", "assets");
const readJson = (rel) =>
  JSON.parse(readFileSync(join(ASSETS, rel), "utf8").replace(/^﻿/, ""));

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const norm = (s) => String(s).toLowerCase().trim();

const data = readJson("data.json");
const dungeons = readJson("maps/dungeons.json");
const smallmaps = readJson("maps/smallmaps.json");
const npcPlacements = readJson("npcs.json");
const talk = {
  towne: readJson("talk/towne.json"),
  castle: readJson("talk/castle.json"),
  dwelling: readJson("talk/dwelling.json"),
  keep: readJson("talk/keep.json"),
};

const recName = (r) =>
  (r.name ?? [])
    .filter((s) => s.kind === "text")
    .map((s) => s.text)
    .join("")
    .trim();

const WORD_KEYWORDS = ["word", "powe", "moon", "rune", "ston"];

function npcTeachesWord(teacher, word) {
  for (const recs of Object.values(talk)) {
    for (const r of recs) {
      if (!norm(recName(r)).includes(norm(teacher))) continue;
      const blob = JSON.stringify(r);
      if (blob.includes(word)) return true; // palabra literal en el registro
      // Entrega vía op Rune junto a una keyword de "word of power".
      const qaSets = [
        ...(r.qa ?? []),
        ...(r.labels ?? []).flatMap((l) => l.qa ?? []),
      ];
      for (const qa of qaSets) {
        const kws = (qa.keywords ?? []).join(" ");
        const hasKw = WORD_KEYWORDS.some((k) => kws.includes(k));
        const hasRune = JSON.stringify(qa.answer ?? []).includes("Rune");
        if (hasKw && hasRune) return true;
      }
      // Rune op en cualquier respuesta de label (Goeth: keywords invertidas).
      for (const l of r.labels ?? []) {
        for (const qa of l.qa ?? []) {
          if (JSON.stringify(qa.answer ?? []).includes("Rune")) return true;
        }
      }
    }
  }
  return false;
}

// Texto VISIBLE (solo nodos kind==="text") de una lista de nodos de diálogo.
const flatText = (nodes) =>
  (nodes ?? [])
    .filter((n) => n && n.kind === "text")
    .map((n) => n.text)
    .join("");

// Recorre todos los NPC de nombre `npc` y aplica `fn(record)` hasta que devuelva true.
function anyNpc(npc, fn) {
  for (const recs of Object.values(talk)) {
    for (const r of recs) {
      if (!norm(recName(r)).includes(norm(npc))) continue;
      if (fn(r)) return true;
    }
  }
  return false;
}

// Todas las respuestas (answer arrays) de un registro: qa de raíz + qa de cada label.
const allAnswers = (r) => [
  ...(r.qa ?? []).flatMap((qa) => qa.answer ?? []),
  ...(r.labels ?? []).flatMap((l) => (l.qa ?? []).flatMap((qa) => qa.answer ?? [])),
];

// Todos los keywords declarados por un registro (qa de raíz + qa de label).
const allKeywords = (r) => [
  ...(r.qa ?? []).flatMap((qa) => qa.keywords ?? []),
  ...(r.labels ?? []).flatMap((l) => (l.qa ?? []).flatMap((qa) => qa.keywords ?? [])),
];

function npcAnswerContains(npc, contains) {
  const needle = norm(contains);
  return anyNpc(npc, (r) => {
    const blobs = [
      flatText(r.greeting),
      flatText(r.job),
      flatText(r.description),
      ...allAnswers(r).map(flatText),
      ...(r.labels ?? []).map((l) => flatText(l.initialLine)),
    ];
    return blobs.some((b) => norm(b).includes(needle));
  });
}

function npcHasKeyword(npc, keyword) {
  const k = norm(keyword);
  return anyNpc(npc, (r) => allKeywords(r).some((kw) => norm(kw) === k));
}

function npcPlacedInLocation(dialogNumber, location) {
  const slots = npcPlacements[String(location)];
  if (!Array.isArray(slots)) return false;
  return slots.some((s) => s && s.dialogNumber === dialogNumber);
}

function stringPoolContains(poolName, value) {
  const pools = Array.isArray(data.stringPools) ? data.stringPools : [];
  const pool = pools.find((p) => p && p.name === poolName);
  if (!pool || !Array.isArray(pool.strings)) return false;
  const needle = norm(value);
  return pool.strings.some((s) => norm(s).includes(needle));
}

function runCheck(c) {
  switch (c.type) {
    case "dataArrayContains": {
      const arr = data[c.array];
      if (!Array.isArray(arr)) return `data.json:${c.array} no es un array`;
      return arr.some((v) => norm(v) === norm(c.value))
        ? null
        : `data.json:${c.array} no contiene "${c.value}"`;
    }
    case "dataArrayLength": {
      const arr = data[c.array];
      if (!Array.isArray(arr)) return `data.json:${c.array} no es un array`;
      return arr.length === c.length
        ? null
        : `data.json:${c.array}.length = ${arr.length}, esperado ${c.length}`;
    }
    case "dataArrayIndexEquals": {
      const arr = data[c.array];
      if (!Array.isArray(arr)) return `data.json:${c.array} no es un array`;
      return arr[c.index] === c.value
        ? null
        : `data.json:${c.array}[${c.index}] = ${arr[c.index]}, esperado ${c.value}`;
    }
    case "dungeonExists":
      return dungeons.some((d) => norm(d.name) === norm(c.name))
        ? null
        : `mazmorra "${c.name}" ausente de maps/dungeons.json`;
    case "locationExists":
      return smallmaps.some((l) => slug(l.name) === slug(c.name))
        ? null
        : `localización "${c.name}" ausente de maps/smallmaps.json`;
    case "npcTeachesWord":
      return npcTeachesWord(c.teacher, c.word)
        ? null
        : `ningún NPC "${c.teacher}" enseña "${c.word}" en los TLK`;
    case "npcAnswerContains":
      return npcAnswerContains(c.npc, c.contains)
        ? null
        : `ningún NPC "${c.npc}" dice el texto "${c.contains}" en los TLK`;
    case "npcHasKeyword":
      return npcHasKeyword(c.npc, c.keyword)
        ? null
        : `el NPC "${c.npc}" no responde al keyword "${c.keyword}" en los TLK`;
    case "stringPoolContains":
      return stringPoolContains(c.pool, c.value)
        ? null
        : `data.stringPools:${c.pool} no contiene el string "${c.value}"`;
    case "npcPlacedInLocation":
      return npcPlacedInLocation(c.dialogNumber, c.location)
        ? null
        : `npcs.json: la localización ${c.location} no coloca al NPC dialogNumber ${c.dialogNumber}`;
    default:
      return `tipo de check desconocido: ${c.type}`;
  }
}

const corpus = JSON.parse(
  readFileSync(join(HERE, "corpus.json"), "utf8").replace(/^﻿/, "")
);

let failed = 0;
let deferred = 0;
let checked = 0;
const lines = [];
for (const fact of corpus.facts) {
  const checks = fact.checks ?? [];
  if (checks.length === 0) {
    deferred++;
    lines.push(`  ⏭  ${fact.id.padEnd(16)} diferido a e2e (verify: ${JSON.stringify(fact.verify)})`);
    continue;
  }
  const errs = [];
  for (const c of checks) {
    checked++;
    const err = runCheck(c);
    if (err) errs.push(err);
  }
  if (errs.length) {
    failed++;
    lines.push(`  ❌ ${fact.id.padEnd(16)} ${errs.length}/${checks.length} checks FALLAN:`);
    for (const e of errs) lines.push(`       · ${e}`);
  } else {
    lines.push(`  ✓  ${fact.id.padEnd(16)} ${checks.length} checks OK`);
  }
}

console.log(`verify:corpus — ${corpus.facts.length} hechos, ${checked} checks estáticos`);
console.log(lines.join("\n"));
console.log(
  `Resumen: ${corpus.facts.length - failed - deferred} verdes · ${failed} rojos · ${deferred} diferidos a e2e`
);
if (failed) {
  console.error(`\n${failed} hecho(s) del corpus no cruzan contra los assets. Ver arriba.`);
  process.exit(1);
}
