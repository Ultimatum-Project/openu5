/**
 * F1.12 — regenerador del manifiesto de strings aprobados.
 *
 * USO:  cd game && node tools/gen-string-manifest.mjs
 *
 * Usa el MISMO extractor que la guarda (`extract-user-strings.mjs`) y RECONCILIA con
 * `tests/fixtures/approved-strings.json`:
 *   - PRESERVA la cita de cada string ya presente (fuente de verdad hand-mantenida).
 *     Una entrada YA presente se preserva AUNQUE `isTechnical` la filtre: las keys
 *     técnicas del manifiesto (p.ej. las comillas de tienda, DS 0x7854) están citadas
 *     a mano y el filtro sólo aplica a lo NUEVO (auditoría G9: antes se barrían en
 *     silencio y ni salían en el conteo).
 *   - AÑADE cada string nuevo con cita "[?] TODO: clasificar (…)" — que el test
 *     `tests/string-manifest.test.ts` RECHAZA hasta que la sustituyas por una clase
 *     real [D]/[V]/[C]/[Q] con su cita.
 *   - RETIRA las entradas que ya no aparecen en el código (huérfanas) y LISTA cada
 *     key retirada (auditoría G9: el operador debe poder auditar qué barrió).
 * Strings sin contenido alfabético (vacíos, pura interpolación) se saltan al AÑADIR.
 *
 * Este tool NO decide clasificaciones: sólo mantiene el manifiesto en espejo con el
 * código y marca lo nuevo para adjudicación humana. El JSON es la fuente de verdad.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractUserStrings, isTechnical, shellFiles } from "./extract-user-strings.mjs";

const TODO = "[?] TODO: clasificar (cita re/notes|re/verified|deliberate-divergences § | ⚠ Clase C)";

/**
 * Reconciliación PURA (exportada para el test de la guarda G9):
 *   prev (manifiesto actual) × live (Map/Set de strings extraídos) →
 *   { next, added, removed }
 * Reglas:
 *   - key en prev ∧ en live → se preserva (cita intacta), SIN filtro isTechnical
 *     (una entrada del manifiesto está citada por definición).
 *   - key en live ∧ no en prev → entra con cita TODO, salvo isTechnical.
 *   - key en prev ∧ no en live → huérfana: se retira y se DEVUELVE en `removed`.
 */
export function reconcileManifest(prev, live) {
  const liveKeys = new Set(live.keys ? [...live.keys()] : [...live]);
  const next = {};
  const added = [];
  // Nuevas + preservadas, ordenadas (localeCompare, como el manifiesto en disco).
  const candidates = new Set([...liveKeys].filter((s) => prev[s] !== undefined || !isTechnical(s)));
  for (const s of [...candidates].sort((a, b) => a.localeCompare(b))) {
    if (prev[s] !== undefined) next[s] = prev[s];
    else {
      next[s] = TODO;
      added.push(s);
    }
  }
  const removed = Object.keys(prev).filter((k) => !liveKeys.has(k));
  return { next, added, removed };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const CORE = join(HERE, "..", "src", "core");
  const SHELL = shellFiles(join(HERE, "..", "src")); // main.ts + conductores ui/ (F0b hueco b + TRAMO 1)
  const MANIFEST = join(HERE, "..", "tests", "fixtures", "approved-strings.json");

  const prev = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  const live = extractUserStrings(CORE, SHELL);
  const { next, added, removed } = reconcileManifest(prev, live);

  writeFileSync(MANIFEST, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Manifiesto: ${Object.keys(next).length} entradas | +${added.length} nuevas (TODO) | -${removed.length} huérfanas retiradas`,
  );
  // G9: cada key retirada se LISTA (antes: sólo el conteo — imposible auditar el barrido).
  for (const k of removed) console.log(`  - retirada: ${JSON.stringify(k)}\t(era: ${prev[k]})`);
  if (added.length > 0) console.log("  → completa las citas TODO antes de commitear (el test las rechaza).");
}
