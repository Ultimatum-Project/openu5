/**
 * CORRIDA #45 — discriminador F1 v2: COBERTURA DEL RESULTADO, no del eco del comando.
 *
 * DEFECTO MEDIDO EN LA v1 (declarado, no silenciado): el bloque típico del LP es
 * «eco del comando + resultado» («0pen-North 0pened!»). El eco es la parte LARGA, así que la
 * cobertura contra el transcript la domina el ECO: un bloque sale con cov=0,86 porque el port
 * dijo «Open-North», aunque su RESULTADO fuese el contrario («Nothing to open!» en vez de
 * «Opened!»). Con la v1, 134 divergentes pasaban el listón F1 y el racimo mayor (18×
 * «0pen-North 0pened!») era ENTERAMENTE deriva de posición: el port abre donde hay puerta y
 * dice «Nothing to open!» donde no la hay — y de hecho DICE «Opened!» en los segmentos donde
 * la party sí está delante de una puerta (control positivo dentro de la propia salida).
 *
 * v2: se RETIRA el eco de comando de cabecera y se mide la cobertura de lo que queda. Un bloque
 * cuyo resto no llega a `MIN_REST` no lleva información más allá del eco ⇒ NO PUEDE ser
 * evidencia de nada sobre el port, ni a favor ni en contra: sale del conjunto candidato.
 *
 *   npx tsx cobertura-divergentes.ts <dirTranscripts> [part...]
 *
 * #117 lo parametrizó por CORPUS para el careo doble-testigo LP1↔AD: las rutas salen del prefijo
 * de la parte y el perfil de `ESPEJO_OCR` (default `lp1-tardio`). El default reproduce #45 dígito
 * a dígito — part09-18: 904/1349/49,4%/9,0% · part07-18: 1038/1632/8,8% —, que es el control
 * positivo de que la parametrización es inerte sobre el material viejo.
 *   ESPEJO_OCR=ad npx tsx cobertura-divergentes.ts <dirTranscriptsAD>
 *   COBERTURA_JSON=<ruta>  vuelca los candidatos F1 para cruzarlos entre espejos
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR, ROUTES_AD_DIR } from "../runner";
import { collapseWith, stripGhostPass, coverageRatio, profileFor } from "../ocr-profile";

const dir = process.argv[2];
if (!dir) {
  console.error("uso: npx tsx cobertura-divergentes.ts <dirTranscripts> [partNN…]");
  process.exit(2);
}
const only = process.argv.slice(3);
/** Corpus por PREFIJO de la parte (misma regla que `calib-offline.ts`): `adNN` → routes-ad,
 *  `partNN` → routes. Sin esto el careo del espejo-2 leería las rutas del espejo-1. */
const routesFor = (part: string): string => (part.startsWith("ad") ? ROUTES_AD_DIR : ROUTES_DIR);
/** Perfil por `ESPEJO_OCR`; el default `lp1-tardio` conserva byte a byte la corrida #45. */
const PROF = profileFor(process.env.ESPEJO_OCR ?? "lp1-tardio");
const MIN_TILE = 4;
const MIN_REST = 12; // caracteres colapsados de RESULTADO exigidos para admitir el bloque

/** Eco de comando de cabecera: «0pen-North», «Search-West», «Look-East», «Klimb-Up»…
 *  ⚠ Se retira sobre el texto CRUDO: `collapseWith` borra guiones y espacios, así que un
 *  recorte hecho después del colapso no casa nunca (defecto de mi v2a, medido y corregido). */
const ECHO = /^\s*[A-Za-z]*-(North|South|East|West|Up|Down)\b[\s.!]*/;

const parts = (only.length
  ? only
  : readdirSync(dir).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", ""))
).sort();

let medibles = 0, sinResto = 0;
const cands: Array<{ part: string; seg: string; ocrLn: number; cov: number; rest: string; text: string; snippet: string }> = [];
const buckets = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];
const counts = new Array(buckets.length - 1).fill(0);

for (const part of parts) {
  const f = join(dir, `${part}.transcript.json`);
  if (!existsSync(f)) continue;
  const tr = JSON.parse(readFileSync(f, "utf8")) as Record<string, string[]>;
  const route = loadRoute(part, routesFor(part));
  for (const seg of route.segments) {
    const lines = tr[seg.id];
    if (!lines) continue;
    const d = diffSegment(seg, lines, PROF);
    const T = lines.map((l) => collapseWith(l.replace(/^[>›]\s*/, ""), PROF)).join("");
    for (const b of d.blocks) {
      if (b.verdict !== "divergent") continue;
      const src = seg.expect.find((e) => e.ocrLn === b.ocrLn);
      if (!src) continue;
      const crudo = stripGhostPass(src.text).replace(/\d+/g, "");
      const rest = collapseWith(crudo.replace(ECHO, ""), PROF);
      if (rest.length < MIN_REST) { sinResto++; continue; }
      const r = coverageRatio(rest, T, MIN_TILE);
      let i = buckets.findIndex((x, k) => k < buckets.length - 1 && r >= x && r < (buckets[k + 1] ?? Infinity));
      if (i < 0) i = counts.length - 1;
      counts[i] = (counts[i] ?? 0) + 1;
      medibles++;
      // el snippet va ENTERO: el recorte a 110 chars de aquí era la segunda mitad del defecto
      // de métrica declarado en corrida-ad-resultado.md §4.4 — dejaba fuera el desenlace de
      // las familias largas justo en la herramienta que se usa para leerlas.
      if (r >= 0.5) cands.push({ part, seg: seg.id, ocrLn: b.ocrLn, cov: r, rest, text: src.text.slice(0, 100), snippet: (b as { snippet?: string }).snippet ?? "" });
    }
  }
}

console.log(`bloques divergentes DESCARTADOS por no llevar resultado más allá del eco (<${MIN_REST} chars): ${sinResto}`);
console.log(`bloques divergentes con RESULTADO medible: ${medibles}\n`);
console.log(`===== HISTOGRAMA DE COBERTURA DEL RESULTADO (perfil ${PROF.id}) =====`);
for (let i = 0; i < counts.length; i++) {
  const c = counts[i] ?? 0;
  const p = medibles ? (100 * c) / medibles : 0;
  const lo = (buckets[i] ?? 0).toFixed(2), hi = (buckets[i + 1] ?? 1).toFixed(2);
  console.log(`  ${lo}–${hi}  ${String(c).padStart(6)}  ${p.toFixed(1).padStart(5)}%  ${"#".repeat(Math.round(p / 2))}`);
}
const bajos = (counts[0] ?? 0) + (counts[1] ?? 0);
console.log(`\nRESULTADO con cobertura <0,10 (F3 «el port no lo dijo»): ${bajos}/${medibles} = ${medibles ? ((100 * bajos) / medibles).toFixed(1) : "—"}%`);
console.log(`RESULTADO con cobertura ≥0,50 (F1 candidato): ${cands.length}/${medibles} = ${medibles ? ((100 * cands.length) / medibles).toFixed(1) : "—"}%`);

/** Volcado de los candidatos F1 a JSON (`COBERTURA_JSON=<ruta>`) para cruzarlos entre espejos.
 *  Aditivo: no toca ni una línea de la salida por consola. */
if (process.env.COBERTURA_JSON) {
  writeFileSync(process.env.COBERTURA_JSON, JSON.stringify(cands, null, 1));
}

const fam = new Map<string, typeof cands>();
for (const c of cands) {
  const k = c.rest.slice(0, 30);
  if (!fam.has(k)) fam.set(k, []);
  fam.get(k)!.push(c);
}
console.log(`\n===== FAMILIAS F1 v2 (racimo ≥3 = umbral pre-registrado) =====`);
for (const [k, v] of [...fam.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
  console.log(`\n[${v.length}×]${v.length >= 3 ? " ★RACIMO" : ""} resto=«${k}»`);
  for (const c of v.slice(0, 2)) console.log(`   ${c.part}/${c.seg} ocrLn=${c.ocrLn} cov=${c.cov.toFixed(2)}\n     LP  : ${c.text}\n     PORT: ${c.snippet}`);
}
