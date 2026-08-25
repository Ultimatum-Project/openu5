/**
 * AUDITORÍA G7 + ARQ-7 — DEMOSTRACIÓN de los cierres del skin-import-guard sobre
 * un árbol SINTÉTICO. Cada caso de este fichero era una EVASIÓN VERDE con el
 * guard previo (one-hop + exención por basename + regex sólo-comillas):
 *
 *   1. TRANSITIVIDAD  piel → ui → core (runtime): el guard viejo sólo miraba el
 *      primer salto → verde. Ahora: violación con la cadena completa.
 *   2. BASENAME       `skin/<sub>/coreview.ts`: el guard viejo eximía por
 *      basename → CUALQUIER fichero llamado coreview.ts leía core en runtime en
 *      silencio. Ahora: sólo la ruta exacta `skin/coreview.ts` es el puente.
 *   3. TEMPLATE       `import(\`../core/x.js\`)`: la regex vieja sólo casaba
 *      comillas → el dinámico con backticks era invisible. Ahora: casa.
 *   4. OPACO          `import(\`../core/${x}.js\`)` (o argumento no-literal):
 *      inanalizable estáticamente → ROJO conservador (antes: invisible).
 *
 * Y los NO-cambios (sanidad de que el guard no sobre-dispara):
 *   - `import type` del core desde piel sigue permitido.
 *   - pasar por el adaptador real `skin/coreview.ts` sigue permitido.
 *   - alcanzar core/tiles.ts TRANSITIVAMENTE vía render/ (metadatos que la
 *     Regla C sanciona) sigue permitido; DIRECTO desde piel sigue prohibido.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { skinRuleBViolations } from "./helpers/import-guard-lib.js";

let ROOT: string; // src/ sintético

function writeTree(files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(ROOT, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "u5-guard-synth-"));
  writeTree({
    // núcleo mínimo
    "core/game.ts": "export const engine = 1;\n",
    "core/tiles.ts": "export const TILE = 1;\n",
    // adaptador real (puente sancionado)
    "skin/coreview.ts": 'import { engine } from "../core/game.js";\nexport const view = engine;\n',
    // render con el carve-out de metadatos (Regla C)
    "render/tileanim.ts": 'import { TILE } from "../core/tiles.js";\nexport const anim = TILE;\n',
    // ui intermedia que toca el motor en runtime
    "ui/helper.ts": 'import { engine } from "../core/game.js";\nexport const h = engine;\n',
    // ── EVASIONES (verdes con el guard viejo) ──
    "skin/evil-transitive.ts": 'import { h } from "../ui/helper.js";\nexport const e = h;\n', // vía 1
    "skin/sub/coreview.ts": 'import { engine } from "../../core/game.js";\nexport const c = engine;\n', // vía 2
    "skin/evil-template.ts": 'export const p = import(`../core/game.js`);\n', // vía 3
    "skin/evil-opaque.ts": 'const m = "game";\nexport const p = import(`../core/${m}.js`);\n', // vía 3b
    // ── USOS SANCIONADOS (deben seguir verdes) ──
    "skin/good-type.ts": 'import type { engine } from "../core/game.js";\nexport type T = typeof engine;\n',
    "skin/good-bridge.ts": 'import { view } from "./coreview.js";\nexport const b = view;\n',
    "skin/good-metadata.ts": 'import { anim } from "../render/tileanim.js";\nexport const g = anim;\n',
  });
});

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("G7/ARQ-7 — demostración sintética de los cierres del skin-import-guard", () => {
  it("caza las 4 evasiones y respeta los usos sancionados", () => {
    const violations = skinRuleBViolations(ROOT);
    const byFile = (f: string) => violations.filter((v) => v.file === f);

    // Vía 1: piel → ui → core en runtime (el guard viejo: verde).
    expect(byFile("skin/evil-transitive.ts").length, "transitiva no cazada").toBeGreaterThan(0);
    expect(byFile("skin/evil-transitive.ts")[0]!.detail).toContain("ui/helper.ts");

    // Vía 2: coreview.ts por basename en subdirectorio (el guard viejo: exento).
    expect(byFile("skin/sub/coreview.ts").length, "basename-coreview no cazado").toBeGreaterThan(0);

    // Vía 3: import(`…`) template sin sustituciones (el guard viejo: invisible).
    expect(byFile("skin/evil-template.ts").length, "template-dinámico no cazado").toBeGreaterThan(0);

    // Vía 3b: import dinámico OPACO (con ${…}) → rojo conservador.
    expect(byFile("skin/evil-opaque.ts").length, "dinámico opaco no cazado").toBeGreaterThan(0);
    expect(byFile("skin/evil-opaque.ts")[0]!.detail).toContain("OPACO");

    // Sancionados: cero violaciones.
    for (const good of ["skin/good-type.ts", "skin/good-bridge.ts", "skin/good-metadata.ts"]) {
      expect(byFile(good), `${good} no debería violar`).toEqual([]);
    }
  });

  it("el import DIRECTO piel→core en runtime sigue siendo rojo (no se relajó)", () => {
    writeFileSync(
      join(ROOT, "skin/evil-direct.ts"),
      'import { TILE } from "../core/tiles.js";\nexport const d = TILE;\n',
    );
    const violations = skinRuleBViolations(ROOT).filter((v) => v.file === "skin/evil-direct.ts");
    // Incluso core/tiles (metadato permitido TRANSITIVAMENTE vía render) es rojo
    // si la piel lo importa DIRECTO en runtime: la puerta es el contrato/adaptador.
    expect(violations.length).toBeGreaterThan(0);
    rmSync(join(ROOT, "skin/evil-direct.ts"));
  });
});
