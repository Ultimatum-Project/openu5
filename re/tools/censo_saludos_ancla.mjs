#!/usr/bin/env node
/**
 * CENSO de los bloques que la palanca `shopGreetingLottery` retira del denominador
 * (ventana `comparador-bandas`; pre-registro §2.2).
 *
 * El predicado es ESTRUCTURAL: `derive-anchors` deriva cada ancla de mercader DEL PROPIO BLOQUE
 * DEL SALUDO (`{kind:"npc", match:"shop:<Tipo>", ocrLn: b.ocrLn}`), así que basta el JOIN por
 * `ocrLn` dentro del segmento. Ni umbrales ni literales del juego.
 *
 * ★ El BLACKSMITH se cuenta APARTE y NO se captura: no pasa por el `rand(0,3)` de SHOPPES.OVL
 *   0x01b6 (su fila de la tabla DS 0x3b2a está a cero; saluda por vía propia 0x12b2 con plantilla
 *   FIJA), así que su saludo SÍ es adjudicable. Excluirlo borraría material bueno.
 *
 *   node re/tools/censo_saludos_ancla.mjs [dirDeRutas ...]
 *     (por defecto: game/e2e/espejo-tour/routes-ad y .../routes)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Los 7 tipos CON fila de pool. Se leen de la tabla del port para que no puedan divergir de él.
const src = readFileSync(join(REPO, "game/src/core/shops/shoppe-greetings.ts"), "utf8");
const tabla = src.slice(src.indexOf("SHOPPE_GREETING_INDEX"), src.indexOf("INN_PITCH_INDEX"));
const POOL = new Set([...tabla.matchAll(/^\s{2}(\w+):\s*\[/gm)].map((m) => m[1]));
if (POOL.size !== 7) {
  console.error(`🔴 PARO: leí ${POOL.size} tipos con pool y esperaba 7 — la tabla ha cambiado de forma.`);
  process.exit(2); // jamás seguir con una tabla vacía: daría un censo de 0 en falso
}

const dirs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["game/e2e/espejo-tour/routes-ad", "game/e2e/espejo-tour/routes"];

for (const rel of dirs) {
  const dir = join(REPO, rel);
  let bloques = 0, anclas = 0, sinBloque = 0, cap = 0, herrero = 0;
  const porTipo = {}, porParte = {};
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const parte = f.replace(/\.route\.json$|\.json$/, "");
    for (const seg of JSON.parse(readFileSync(join(dir, f), "utf8")).segments ?? []) {
      bloques += (seg.expect ?? []).length;
      const lns = new Set((seg.expect ?? []).map((b) => b.ocrLn));
      for (const op of seg.script ?? []) {
        const a = op.anchor;
        if (!a || a.kind !== "npc" || typeof a.match !== "string" || !a.match.startsWith("shop:")) continue;
        anclas++;
        if (!lns.has(a.ocrLn)) { sinBloque++; continue; }
        const tipo = a.match.slice(5);
        porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
        if (POOL.has(tipo)) { cap++; porParte[parte] = (porParte[parte] ?? 0) + 1; } else herrero++;
      }
    }
  }
  console.log(`\ncorpus: ${rel}`);
  console.log(`  bloques 'expect' TOTALES ................. ${bloques}`);
  console.log(`  anclas shop:* ........................... ${anclas}  (sin bloque en su ocrLn: ${sinBloque})`);
  console.log(`  CAPTURADOS (7 tipos con pool rand(0,3)) . ${cap}   = ${((100 * cap) / (bloques || 1)).toFixed(3)} % del corpus`);
  console.log(`  NO capturados (Blacksmith, saludo FIJO) . ${herrero}`);
  console.log(`  por tipo: ${Object.entries(porTipo).sort().map(([k, v]) => `${k}:${v}`).join(" · ") || "—"}`);
  console.log(`  por parte (capturados): ${Object.entries(porParte).map(([k, v]) => `${k}:${v}`).join(" · ") || "—"}`);
}
