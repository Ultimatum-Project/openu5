#!/usr/bin/env node
/**
 * CENSO DE LO OBSERVABLE — ¿qué campos del ESTADO nos da realmente el corpus del espejo?
 *
 * Existe porque la re-siembra (`../resiembra.ts`) sólo puede sembrar lo que el ORIGINAL
 * diga, y «el OCR ya nos da oro, comida, fecha y roster» era una premisa que nadie había
 * medido. Este censo la mide, campo a campo, sobre las rutas curadas.
 *
 * 🔴 TODO CAMPO SALE CON SU CONTROL POSITIVO AL LADO. Un censo que da 0 se lee como «el
 * corpus no lo trae» cuando también puede significar «mi patrón está mal» — y aquí casi
 * todos los campos dan 0, así que sin control el censo entero sería indistinguible de un
 * instrumento roto. El control es una frase SINTÉTICA con el formato que el campo tendría
 * si el corpus lo trajese: si el detector no casa ni con su propio control, la fila sale
 * marcada `DETECTOR-ROTO` y no se puede leer como ausencia.
 *
 * Uso:
 *   node e2e/espejo-tour/tools/censo-observable.mjs            # corpus LP1 (routes/)
 *   node e2e/espejo-tour/tools/censo-observable.mjs --ad       # corpus AD  (routes-ad/)
 *   node e2e/espejo-tour/tools/censo-observable.mjs --json
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const AD = process.argv.includes("--ad");
const JSON_OUT = process.argv.includes("--json");
const DIR = join(HERE, "..", AD ? "routes-ad" : "routes");

/**
 * Los campos del estado que una re-siembra querría. Cada uno con:
 *  · `re`      — detector sobre el texto OCR de un bloque `expect`;
 *  · `control` — frase sintética con el formato que tendría en el corpus si estuviera;
 *  · `que`     — qué mide de verdad un acierto (SALDO vs DELTA vs ECO DE ORDEN: la
 *                distinción que decide si el campo sirve para sembrar o no).
 */
const CAMPOS = [
  {
    id: "oro-saldo",
    que: "SALDO de oro (lo que haría falta para sembrar)",
    re: /\bgold\s*[:=]\s*\d|\b\d+\s*gold\s+(remain|left|in purse)/i,
    control: "Gold: 1046",
  },
  {
    id: "oro-delta",
    que: "DELTA de oro (loot/compra) — NO es un saldo",
    re: /\bgold!|\d+\s*gold\b|go\]d/i,
    control: "Thou dost find gold!",
  },
  {
    id: "comida",
    que: "SALDO de comida",
    re: /\bfood\s*[:=]\s*\d|\b\d+\s*food\s+(remain|left)/i,
    control: "Food: 26",
  },
  {
    id: "fecha",
    que: "fecha del calendario del juego",
    re: /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,3}\b|\bday\s+\d+\b/i,
    control: "4-8-139",
  },
  {
    id: "hora",
    // ★ EL ÚNICO CAMPO NUMÉRICO DE ESTADO QUE EL CORPUS SÍ TRAE, y no por el panel: el LP
    // usa el RELOJ DE BOLSILLO («Use item: Watch → The pocket watch reads 2:06 AM.»), que
    // imprime la hora EN LA CONSOLA. Es dato del original, utilizable — pero llega a mitad
    // de parte, no en la entrada, y hoy `entryClock` lo pisa con la hora canónica 10:00.
    que: "hora — SÓLO vía reloj de bolsillo (Use item: Watch), nunca por el panel",
    re: /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,
    control: "10:00 AM",
  },
  {
    id: "hp-por-miembro",
    que: "HP de un miembro (el campo que decide si está a punto de morir)",
    re: /\b(hp|hits?)\s*[:=]?\s*\d{1,3}\s*\/\s*\d{1,3}\b/i,
    control: "Iolo HP: 79/90",
  },
  {
    id: "estado-por-miembro",
    que: "letra de estado G/P/D/S del panel",
    re: /\b[A-Z][a-z]{2,8}\s+[GPDS]\s+\d{1,3}\b/,
    control: "Shamino G 60",
  },
  {
    id: "nivel",
    que: "nivel / experiencia",
    re: /\blevel\s*[:=]?\s*\d|\bexp\.?\s*[:=]\s*\d/i,
    control: "Level: 5",
  },
  {
    id: "muerte",
    que: "muerte de un miembro o de la party (guard de frontera de la re-siembra)",
    re: /darkness engulfs|\bis dead\b|hath died|has fallen|\bslain\b|battle is lost/i,
    control: "An unending darkness engulfs thee...",
  },
  {
    id: "transporte",
    // ★ EL HALLAZGO DE LA VALIDACIÓN DE LA RE-SIEMBRA: el transporte SÍ está en la consola
    // («Boarded!», «Fly», «Ride», «Xit»), y es el campo que de verdad decidía. En part22 el
    // original CRUZA EL SUBMUNDO EN ALFOMBRA («Use item Item: Carpet Boarded!», «Fly Fast»)
    // y el replay lo cruza A PIE («Very slow!», «Slow progress!») → tres emboscadas y wipe.
    que: "TRANSPORTE (Board/Fly/Ride/Xit) — observable, y el campo que decidió en part22",
    re: /\bBoarded!|\bFly\b|\bRide\b|\bXit\b|\bBoard\b/i,
    control: "Use item Item: Carpet Boarded!",
  },
  {
    id: "a-pie-lento",
    que: "marcha A PIE por terreno lento (el reverso: delata que NO se va montado)",
    re: /Very slow!|Slow progress!/i,
    control: "Very slow!",
  },
  {
    id: "veneno",
    que: "envenenamiento nombrando al miembro (estado parcial, no saldo)",
    re: /\b\w+ is poisoned\b/i,
    control: "Min is poisoned",
  },
];

/** Nombres del roster del LP (evidencia de PRESENCIA, el único estado que el corpus da). */
const NOMBRES = AD
  ? ["Bar", "Shamino", "Iolo", "Mariah", "Jaana", "Gwenno"]
  : ["Min", "Shamino", "Iolo", "Jaana", "Julia", "Gwenno"];

function rutas() {
  if (!existsSync(DIR)) {
    console.error(`censo-observable: no existe ${DIR} (routes/ está FUERA del índice desde #376: cópialo del principal)`);
    process.exit(2);
  }
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".route.json"))
    .sort();
}

const partes = [];
const vehiculos = {}; // pasos de navegación por vehículo DECLARADO en la ruta
for (const f of rutas()) {
  const d = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const textos = d.segments.flatMap((s) => (s.expect ?? []).map((b) => b.text ?? ""));
  // ★★ EL OBSERVABLE DE ESTADO MEJOR CUBIERTO DE TODO EL CORPUS, y estaba a la vista:
  // cada op de navegación lleva `v` = el VEHÍCULO con el que el LP dio ese paso, plegado
  // del verbo OCR por `tools/segment.mjs` (`VEH_SPELLINGS`: fly/ride/head/row). O sea que
  // el corpus observa el transporte en el 100% de los pasos... y el runner NO LEE `v`
  // (sus DOS bucles de nav, `runner.ts:3212-3217` y `:3486-3494`, sólo pulsan la flecha:
  // `run.m` aparece dos veces en el árbol y `run.v` cero). Ver `re/notes/espejo-resiembra.md`.
  for (const s of d.segments) {
    for (const op of s.script ?? []) {
      for (const r of op.nav ?? []) {
        const v = r.v ?? "?";
        vehiculos[v] = (vehiculos[v] ?? 0) + (r.n ?? 0);
      }
    }
  }
  const enters = d.segments.filter((s) => s.enter && (s.enter.loc != null || s.enter.banner)).length;
  const porCampo = {};
  for (const c of CAMPOS) porCampo[c.id] = textos.filter((t) => c.re.test(t)).length;
  const menciones = {};
  for (const n of NOMBRES) {
    const re = new RegExp(`\\b${n}\\b`);
    menciones[n] = textos.filter((t) => re.test(t)).length;
  }
  partes.push({ parte: d.part, bloques: textos.length, enters, porCampo, menciones });
}

const totalBloques = partes.reduce((a, p) => a + p.bloques, 0);
const totalEnters = partes.reduce((a, p) => a + p.enters, 0);
const filas = CAMPOS.map((c) => {
  const n = partes.reduce((a, p) => a + p.porCampo[c.id], 0);
  const partesCon = partes.filter((p) => p.porCampo[c.id] > 0).length;
  return {
    campo: c.id,
    que: c.que,
    bloques: n,
    partesCon,
    detectorVivo: c.re.test(c.control),
    control: c.control,
  };
});
const nombresFila = NOMBRES.map((n) => ({
  nombre: n,
  bloques: partes.reduce((a, p) => a + p.menciones[n], 0),
  partesCon: partes.filter((p) => p.menciones[n] > 0).length,
}));

if (JSON_OUT) {
  console.log(JSON.stringify({ corpus: AD ? "ad" : "lp1", totalBloques, totalEnters, filas, nombresFila, partes }, null, 2));
  process.exit(0);
}

console.log(`CENSO DE LO OBSERVABLE — corpus ${AD ? "AD (routes-ad)" : "LP1 (routes)"}`);
console.log(`${partes.length} partes · ${totalBloques} bloques expect · ${totalEnters} costuras enter con loc/banner\n`);
console.log("campo                 bloques  partes  detector  qué mide");
console.log("─".repeat(100));
for (const f of filas) {
  const det = f.detectorVivo ? "  ok    " : " ROTO ✗ ";
  console.log(`${f.campo.padEnd(20)} ${String(f.bloques).padStart(7)}  ${String(f.partesCon).padStart(2)}/${partes.length}  ${det}  ${f.que}`);
}
const rotos = filas.filter((f) => !f.detectorVivo);
console.log(
  rotos.length
    ? `\n🔴 ${rotos.length} DETECTOR(ES) ROTO(S): su 0 NO se puede leer como ausencia — ${rotos.map((r) => r.campo).join(", ")}`
    : `\n✓ los ${filas.length} detectores casan con su control positivo: los ceros de arriba SÍ son ausencias del corpus`,
);
const totalPasos = Object.values(vehiculos).reduce((a, n) => a + n, 0);
const noPie = totalPasos - (vehiculos.walk ?? 0);
console.log(
  `\nTRANSPORTE por op de navegación (campo \`v\`, plegado del verbo OCR por segment.mjs) — ` +
    `cobertura 100% de los pasos:`,
);
for (const [v, n] of Object.entries(vehiculos).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v.padEnd(6)} ${String(n).padStart(6)} pasos  (${((100 * n) / totalPasos).toFixed(1)}%)`);
}
console.log(
  `  ⇒ ${noPie} de ${totalPasos} pasos (${((100 * noPie) / totalPasos).toFixed(1)}%) los dio el LP MONTADO/VOLANDO. ` +
    `El runner los da todos A PIE: no lee \`v\` (runner.ts:3212-3217 y :3486-3494).`,
);
console.log("\nPRESENCIA por nombre (bloques que lo mencionan) — el único estado que el corpus sí da:");
for (const n of nombresFila) {
  console.log(`  ${n.nombre.padEnd(9)} ${String(n.bloques).padStart(5)} bloques en ${n.partesCon}/${partes.length} partes`);
}
console.log("\npor parte:");
console.log("parte    bloques  enters  " + NOMBRES.map((n) => n.slice(0, 4).padStart(5)).join(" ") + "   muertes");
for (const p of partes) {
  console.log(
    `${p.parte.padEnd(8)} ${String(p.bloques).padStart(7)}  ${String(p.enters).padStart(6)}  ` +
      NOMBRES.map((n) => String(p.menciones[n]).padStart(5)).join(" ") +
      `   ${p.porCampo.muerte}`,
  );
}
