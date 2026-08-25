#!/usr/bin/env node
/**
 * CENSO de los «BILLETES DE LOTERÍA» del espejo — ficha F-5 de `re/notes/fichas-f1f2-acta.md`.
 *
 * QUÉ CUENTA: bloques `expect` de clase CURADA (cualquier clase que no sea `auto` — en la
 * práctica `exact`, la que `tools/segment.mjs` pone en la LÍNEA DE CORTE del combate) cuyo
 * texto es un desenlace de combate (`VICTORY!` / `BATTLE IS LOST!`), en segmentos NO
 * skipeados (los skipeados no se ejecutan: [[skip-vive-en-dos-capas-manda-el-route]]).
 *
 * POR QUÉ IMPORTA: esos bloques sólo casan si el port está EN un combate ganado/perdido en
 * ese punto, y los encuentros del overworld son RNG del port («difieren por diseño», README
 * del carril). Si casa suma +1/+1; si no, `combatOverridesCuratedClass` lo saca de
 * `comparable` y suma 0/0. Es decir: su aportación a la conformidad es una LOTERÍA, no una
 * medida de fidelidad — y un delta A/B de ±1..±2 alojado en un segmento de combate puede ser
 * exactamente eso. Medido en vivo: el 100 % del `−1/−1` de `ad20` entre los brazos M y B es
 * UN solo billete (`ad20-g14`, ocrLn 7116).
 *
 * OJO — esto es un censo de POBLACIÓN, no de billetes premiados: dice cuántos hay expuestos
 * al RNG, no cuántos casan hoy. Saber lo segundo exige una corrida del corpus entero.
 *
 *   node re/tools/censo_desenlaces_curados.mjs [dirDeRutas]   # default: routes-ad
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = process.argv[2] ?? join(ROOT, "game", "e2e", "espejo-tour", "routes-ad");

// Los dos desenlaces que `segment.mjs` promueve a clase curada al cortar el combate.
// 🔴 CORREGIDO (ventana `comparador-bandas`): el patrón era /(VICTORY|BATTLE\s+IS\s+L)/i y NO
// casaba NI UN `VICT0RY!` — el OCR de AD escribe la O como CERO, y `/i` pliega mayúsculas, no
// glifos. El censo salía por eso «27 en AD, todos BATTLE IS L0ST!»: la mitad de la población de
// F-5 era invisible. Se prueba sobre el texto de-corrupto (0→o, [/]→l, 1→l), que es la misma
// normalización que el comparador usa para PROBAR patrones (`ocrFriendly`).
const ocrFriendly = (x) => String(x ?? "").replace(/0/g, "o").replace(/[[\]]/g, "l").replace(/1/g, "l");
const DESENLACE = /(VICTORY|BATTLE\s+IS\s+L)/i;

const porParte = {};
const billetes = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".route.json")).sort()) {
  const route = JSON.parse(readFileSync(join(dir, f), "utf8"));
  for (const seg of route.segments ?? []) {
    if (seg.skip) continue; // el runner no lo ejecuta ⇒ no está expuesto
    for (const b of seg.expect ?? []) {
      const cls = b.class ?? "auto";
      if (cls === "auto") continue; // la clase `auto` no es curada: no es un billete
      if (!DESENLACE.test(ocrFriendly(b.text))) continue;
      billetes.push({ parte: route.part, seg: seg.id, ocrLn: b.ocrLn, class: cls, text: b.text });
      porParte[route.part] = (porParte[route.part] ?? 0) + 1;
    }
  }
}

const segs = new Set(billetes.map((b) => b.seg));
console.log(`corpus: ${dir}`);
console.log(`BILLETES (desenlace de combate en clase CURADA, segmentos vivos): ${billetes.length}`);
console.log(`  en ${segs.size} segmentos de ${Object.keys(porParte).length} partes`);
console.log(`  por parte: ${Object.entries(porParte).map(([p, n]) => `${p}:${n}`).join(" · ")}`);
console.log("");
for (const b of billetes) console.log(`  ${b.seg.padEnd(12)} ocrLn=${String(b.ocrLn).padEnd(6)} class=${b.class.padEnd(6)} ${JSON.stringify(b.text)}`);
