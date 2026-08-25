/**
 * F1.12 — GUARDA CI ANTI-FABRICACIÓN (gate de cierre de Fase 1).
 *
 * QUÉ HACE. Extrae —vía AST de TypeScript— TODO string user-facing de
 * `game/src/core/` y exige que CADA UNO tenga una entrada en el manifiesto de
 * strings aprobados (`tests/fixtures/approved-strings.json`), con su clasificación
 * y cita. Un string user-facing NUEVO sin entrada → ROJO.
 *
 * SINKS + INDIRECCIÓN. La extracción vive en `tools/extract-user-strings.mjs`
 * (compartida con el regenerador para no desincronizar). Cubre los sinks `text:` y
 * `message:`, los `.push()` sobre builders de mensajes y los array-literales de
 * mensajes, RESOLVIENDO referencias a consts/arrays LOCALES del módulo (≥1 nivel):
 * `const X="…"; text:X`, `text: ARR[i]`, `lines.push(HEADER + NAME[i])` afloran sus
 * literales. Esto cierra la evasión por const que destapó el review (p.ej. ritual.ts).
 * FUERA DE ALCANCE (declarado): indirección cross-módulo, construcción dinámica
 * (concatenación con variables no-const, `.map/.join`), y builders con nombre de var
 * fuera de la lista `messages/lines/events/segments/out/log/warnings`. Un string así
 * se declara a mano en el manifiesto (el barrido inverso `re/inverse-coverage.md` lo
 * cubre). Ver la cabecera del extractor para el detalle.
 *
 * POR QUÉ. El barrido inverso demostró que los controles previos verifican SÓLO hacia
 * adelante; ninguno caza un literal FABRICADO que nadie derivó (raíz de "citizen of
 * Britannia" y del "royal chest"). Esta guarda cierra ese hueco: es el control
 * port→asm permanente.
 *
 * CÓMO AÑADIR UN STRING LEGÍTIMO:
 *   1. Añade tu entrada a `tests/fixtures/approved-strings.json`:
 *        "<string exacto>": "[CLASE] cita"
 *      CLASE ∈ [D] derivado (re/notes|re/verified|DS 0x…) · [V] divergencia declarada
 *      (deliberate-divergences §) · [C] plausible-original sin transcripción (F2) ·
 *      [Q] QoL/placeholder honesto. Los template-literals se normalizan (`${…}`→`{}`).
 *   2. NUNCA la clase [F] (fabricación): un [F] se corrige, no se aprueba.
 *   3. Strings sin contenido alfabético (vacíos, pura interpolación) se saltan.
 *   Atajo: `node tools/gen-string-manifest.mjs` añade los nuevos con cita TODO (que
 *   este test rechaza hasta completarla) y retira los huérfanos. El JSON manda.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractUserStrings, isTechnical, shellFiles } from "../tools/extract-user-strings.mjs";
import approved from "./fixtures/approved-strings.json";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");
const SHELL = shellFiles(join(HERE, "..", "src")) as string[]; // main.ts + conductores ui/ (F0b + TRAMO 1)
const manifest = approved as Record<string, string>;

describe("F1.12 guarda anti-fabricación — strings user-facing del core + shell", () => {
  const live = extractUserStrings(CORE, SHELL) as Map<string, string>;

  it("todo string user-facing del core está en el manifiesto con cita", () => {
    const missing: string[] = [];
    for (const [text, loc] of live) {
      if (isTechnical(text)) continue;
      if (!(text in manifest)) missing.push(`  ${loc}\t${JSON.stringify(text)}`);
    }
    if (missing.length > 0) {
      throw new Error(
        `\n${missing.length} string(s) user-facing SIN respaldo en approved-strings.json:\n` +
          missing.join("\n") +
          `\n\nCada literal de mensaje debe declararse con clase + cita. ` +
          `Ver cabecera de tests/string-manifest.test.ts (flujo de mantenimiento).\n`,
      );
    }
    expect(missing).toEqual([]);
  });

  it("el manifiesto no tiene entradas huérfanas (mirror exacto del código)", () => {
    const liveTexts = new Set([...live.keys()]);
    const stale = Object.keys(manifest).filter((k) => !liveTexts.has(k));
    if (stale.length > 0) {
      throw new Error(
        `\n${stale.length} entrada(s) del manifiesto ya no existen en el código ` +
          `(retíralas de approved-strings.json):\n` +
          stale.map((s) => "  " + JSON.stringify(s)).join("\n") +
          "\n",
      );
    }
    expect(stale).toEqual([]);
  });

  it("el manifiesto NUNCA contiene una fabricación [F]", () => {
    const fabricated = Object.entries(manifest)
      .filter(([, cite]) => cite.trimStart().startsWith("[F]"))
      .map(([s]) => s);
    expect(fabricated).toEqual([]);
  });

  it("toda entrada del manifiesto lleva una clase reconocida [D]/[V]/[C]/[Q]", () => {
    const bad = Object.entries(manifest)
      .filter(([, cite]) => !/^\s*\[[DVCQ]\]/.test(cite))
      .map(([s, cite]) => `${JSON.stringify(s)} → ${JSON.stringify(cite)}`);
    expect(bad).toEqual([]);
  });
});
