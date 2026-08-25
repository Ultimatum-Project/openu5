/**
 * FASE 3h — MEDICIÓN, con el censo de clases YA CERRADO por la guarda de colisiones.
 *
 * Respeta el contrato del runner (verificado en 3f, 18/18 reportes reproducidos): los segmentos
 * `skip:"pendiente-runner"` no llevan diff, y la métrica de PARTE es sólo smallmap (el interior
 * va aparte por el ruling de la Fase 3).
 *
 * Mide las tres cosas que el pre-registro exige:
 *   P1  conformidad de `part09-18`  (banda pre-registrada 5-15%)
 *   P3  CANARIO `part01-06` — OCR limpio, perfil validado: si se mueve >0,5 puntos, el plegado
 *       está FABRICANDO matches donde el comparador ya acertaba
 *   AA  AUTO-ABSOLUCIÓN PROBADA: ¿algún bloque casa con el transcript del port VACÍO?
 *
 *   npx tsx game/e2e/espejo-tour/tools/medir-3h.ts [--dir .espejo-lp1] [--canario DIR]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadRoute, diffSegment, ROUTES_DIR } from "../runner";
import { LP1_PROFILE, LP1_LATE_PROFILE, LP1_TARDIO_PROFILE, type OcrProfile } from "../ocr-profile";

/**
 * ⚠ LÍNEA BASE = `LP1_LATE_PROFILE` (el perfil de 3f, YA EN MAIN), **no** `LP1_PROFILE`.
 *
 * Defecto de instrumento cazado en la primera corrida: `LP1_TARDIO_PROFILE` extiende el de 3f
 * (lleva `lateRecognizers: true`), así que comparar contra la identidad mezcla DOS palancas —
 * los reconocedores de 3f, que RETIRAN del denominador, y el plegado de 3h, que SUBE el
 * numerador. Con esa mezcla el canario «fallaba» por +0,69 puntos… con el numerador INTACTO
 * (125→125): la subida era denominador de 3f, no fabricación de 3h. Misma disciplina que
 * `AD_PRE3C_PROFILE`/`AD_PRE3D_PROFILE`: se mide contra el estado inmediatamente anterior.
 */
const ANTES = LP1_LATE_PROFILE;

interface M { comparable: number; matched: number; blocks: number }
const zero = (): M => ({ comparable: 0, matched: 0, blocks: 0 });
const pct = (m: M): number => (m.comparable ? (m.matched / m.comparable) * 100 : 0);
const show = (m: M): string => `${pct(m).toFixed(1).padStart(5)}% (${String(m.matched).padStart(5)}/${String(m.comparable).padEnd(5)})`;

/** Mide una lista de partes con un perfil. Devuelve smallmap (la métrica de parte). */
function medir(parts: string[], dir: string, profile: OcrProfile): { total: M; vacios: number } {
  const total = zero();
  let vacios = 0; // matches con transcript del port VACÍO (auto-absolución PROBADA)
  for (const part of parts) {
    if (!existsSync(join(dir, `${part}.transcript.json`))) continue;
    const route = loadRoute(part, ROUTES_DIR);
    const tr = JSON.parse(readFileSync(join(dir, `${part}.transcript.json`), "utf8")) as Record<string, string[]>;
    for (const seg of route.segments) {
      if (seg.skip != null) continue;
      const lines = tr[seg.id];
      if (!lines) continue;
      const d = diffSegment(seg, lines, profile);
      if (lines.length === 0) vacios += d.matched;
      if (seg.openedBy) continue; // interior aparte
      total.comparable += d.comparable;
      total.matched += d.matched;
      total.blocks += d.blocks.length;
    }
  }
  return { total, vacios };
}

function main(): void {
  const argv = process.argv.slice(2);
  let dir = ".espejo-lp1";
  let canarioDir = ".espejo-3c-lp1";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i]!;
    else if (argv[i] === "--canario") canarioDir = argv[++i]!;
  }
  const has = (d: string): string[] =>
    existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".transcript.json")).map((f) => f.replace(".transcript.json", "")).sort() : [];

  const todas = has(dir);
  const G = todas.filter((p) => /^part(09|1[0-8])$/.test(p)); // el grupo de la predicción P1

  console.log("=== P1 · part09-18 (banda pre-registrada 5-15%) ===");
  const gBase = medir(G, dir, ANTES);
  const gLate = medir(G, dir, LP1_TARDIO_PROFILE);
  console.log(`  identidad lp1        ${show(medir(G, dir, LP1_PROFILE).total)}   (contexto: antes de 3f)`);
  console.log(`  ANTES (3f, en main)  ${show(gBase.total)}`);
  console.log(`  DESPUÉS (lp1-tardío) ${show(gLate.total)}`);
  console.log(`  Δ = ${(pct(gLate.total) - pct(gBase.total)).toFixed(1)} puntos · numerador ${gBase.total.matched} → ${gLate.total.matched} (+${gLate.total.matched - gBase.total.matched})`);

  console.log("\n=== part07-24 (las 18, contexto) ===");
  const tBase = medir(todas, dir, ANTES);
  const tLate = medir(todas, dir, LP1_TARDIO_PROFILE);
  console.log(`  ANTES ${show(tBase.total)}   DESPUÉS ${show(tLate.total)}`);

  console.log("\n=== por PARTE (part09-18) ===");
  for (const p of G) {
    const b = medir([p], dir, ANTES);
    const l = medir([p], dir, LP1_TARDIO_PROFILE);
    console.log(`  ${p}  ${show(b.total)} → ${show(l.total)}   Δ ${(pct(l.total) - pct(b.total)).toFixed(1)} pts`);
  }

  console.log("\n=== P3 · CANARIO part01-06 (OCR limpio; umbral de FRACASO: >0,5 puntos) ===");
  const canario = has(canarioDir);
  if (canario.length === 0) {
    console.log(`  ⚠ SIN MATERIAL en ${canarioDir} — el canario NO se puede correr`);
  } else {
    const cBase = medir(canario, canarioDir, ANTES);
    const cLate = medir(canario, canarioDir, LP1_TARDIO_PROFILE);
    const delta = pct(cLate.total) - pct(cBase.total);
    console.log(`  material disponible: ${canario.join(", ")}  (${canario.length} de las 6 previstas)`);
    console.log(`  ANTES ${show(cBase.total)}   DESPUÉS ${show(cLate.total)}`);
    console.log(`  Δ = ${delta.toFixed(2)} puntos  ⇒  ${Math.abs(delta) > 0.5 ? "★ FRACASO POR CANARIO (el plegado fabrica)" : "canario OK (≤0,5)"}`);
  }

  console.log("\n=== AA · AUTO-ABSOLUCIÓN PROBADA (matches con transcript del port VACÍO) ===");
  console.log(`  tardío: ${gLate.vacios + (medir(todas, dir, LP1_TARDIO_PROFILE).vacios - gLate.vacios)} en las 18 partes  ⇒  ${tLate.vacios === 0 ? "0 · limpio" : "★ ABORTA LA FASE"}`);
}

main();
