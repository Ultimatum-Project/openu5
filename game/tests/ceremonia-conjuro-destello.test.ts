/**
 * EL PORT NO DESTELLA AL CONJURAR — la ceremonia `CAST2.OVL:0x0000` y sus cuatro vías.
 *
 * SÍNTOMA MEDIDO (carril `destello-conjuro`, careo denso propio con
 * `tools/careo-visual/captura-densa-hechizo.pw.ts`, 60 fps sobre el canvas lógico 320×200,
 * puerto propio 5271, TODO en la misma sesión):
 *
 *   (U)se pergamino An Tym  →  bimodal, separación **182,5** niveles, pulso **2937 ms**
 *                              contra los 2945 que el propio port DERIVA para idx 7
 *   (C)ast VAS LOR          →  separación **0,1** — SIN BIMODALIDAD
 *   (C)ast MANI («Success!»)→  separación **0,1** — SIN BIMODALIDAD
 *   (U)se poción amarilla   →  separación **0,1** — SIN BIMODALIDAD
 *
 * El An Tym es el CONTROL POSITIVO del instrumento: sin él, «no hay destello» en las otras
 * tres no probaría nada. (Reproduce, con instrumento y sesión propios, lo que midió el
 * carril `ceremonias-serie` en `re/notes/ceremonia-de-conjuro-cast2-0000.md` §4: 192,3 y
 * 2949 ms. Las dos medidas coinciden en el veredicto y difieren dentro del suelo del
 * instrumento.)
 *
 * ── LO QUE GUARDA ESTE FICHERO ───────────────────────────────────────────────────────
 *
 * 1. La DERIVACIÓN (`core/magic/ceremony.ts`), con los esperados EN CRUDO del volcado.
 * 2. Que `main.ts` EMITE la ceremonia en las siete bocas donde el binario la hace. Es la
 *    mitad que estaba en ROJO: `main.ts` sólo la emitía para los pergaminos 2/3/7.
 *
 * `main.ts` no es importable (es el entry del navegador), así que la parte 2 lee su fuente
 * y la trocea por anclas literales — el mismo gesto que `cast-onwho-consumidores.test.ts`,
 * y con la misma propiedad: si alguien mueve el bloque, el ancla desaparece y el aserto
 * grita en vez de pasar en vacío.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CEREMONY_INDEX_MAX,
  SCROLL_CEREMONY_INDEX,
  SPELLS_WITHOUT_CEREMONY,
  VAS_REL_POR_PHASE_CEREMONY_INDEX,
  VAS_REL_POR_SPELL_INDEX,
  castCeremonyIndex,
  castCeremonyIndexOrNull,
  potionCeremonyIndex,
  scrollCeremonyIndex,
} from "../src/core/magic/ceremony.js";
import { timeSpellFlashWindowMs } from "../src/skin/fiel/speaker.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const main = readFileSync(join(HERE, "..", "src", "main.ts"), "utf8");

/** Sub-bloque de `main.ts` entre dos anclas literales. */
function block(from: string, to: string): string {
  const a = main.indexOf(from);
  expect(a, `ancla ausente en main.ts: ${from}`).toBeGreaterThanOrEqual(0);
  const b = main.indexOf(to, a + from.length);
  expect(b, `ancla de cierre ausente en main.ts: ${to}`).toBeGreaterThan(a);
  return main.slice(a, b);
}

/**
 * ¿Este bloque DISPARA la ceremonia? Las siete bocas la emiten por los dos emisores con
 * nombre (`emitCeremony` para un índice ya derivado, `emitCastCeremony` para un hechizo);
 * se acepta también el `emitSfx` crudo del cue para que el aserto no se rompa el día que
 * alguien vuelva a la forma literal.
 */
const EMITE_CEREMONIA = /emit(?:Cast)?Ceremony\(|emitSfx\(\{\s*id:\s*"time-spell"/;

// ════════════════════════════════════════════════════════════════════════════════════
// 1. LA DERIVACIÓN — esperados EN CRUDO del volcado, nada calculado desde el sujeto
// ════════════════════════════════════════════════════════════════════════════════════

describe("el índice de `CAST2.OVL:0x0000` en cada vía (derivado del asm)", () => {
  it("el gate del argumento es `< 9` (0x0005 cmp word ptr [bp+4], 9)", () => {
    expect(CEREMONY_INDEX_MAX).toBe(8);
  });

  /**
   * Los NUEVE hechizos que el corpus de vídeo mide en `ceremonia-de-conjuro-cast2-0000.md`
   * §3, con su círculo COPIADO de esa tabla (no calculado aquí). Incluye las TRES parejas
   * discriminantes —índices que se separan hasta 5 posiciones y dan el mismo círculo— que
   * son las que distinguen «el índice es el círculo» de «el índice es el nº de hechizo».
   */
  const TESTIGOS_MEDIDOS: readonly (readonly [string, number, number])[] = [
    ["MANI", 4, 1],
    ["AN NOX", 3, 1],
    ["VAS LOR", 12, 3],
    ["IN POR", 17, 3],
    ["UUS POR", 21, 4],
    ["VAS MANI", 27, 5],
    ["AN XEN EX", 34, 6],
    ["IN VAS POR YLEM", 30, 6],
    ["VAS REL POR", 46, 8],
  ];

  it("(C)ast: el índice es el CÍRCULO — los nueve testigos medidos en vídeo", () => {
    for (const [nombre, idx, circulo] of TESTIGOS_MEDIDOS) {
      expect(castCeremonyIndex(idx), `${nombre} (hechizo ${idx})`).toBe(circulo);
    }
  });

  it("las TRES parejas discriminantes: índices distintos, MISMO índice de ceremonia", () => {
    // Si la ceremonia dependiera del nº de hechizo, estos pares diferirían.
    expect(castCeremonyIndex(4)).toBe(castCeremonyIndex(3)); // MANI / AN NOX
    expect(castCeremonyIndex(12)).toBe(castCeremonyIndex(17)); // VAS LOR / IN POR (Δ 5)
    expect(castCeremonyIndex(34)).toBe(castCeremonyIndex(30)); // AN XEN EX / IN VAS POR YLEM
    // …y un círculo de diferencia SÍ separa (la otra mitad del discriminante).
    expect(castCeremonyIndex(12)).not.toBe(castCeremonyIndex(21));
  });

  it("los 48 hechizos caben bajo el gate `< 9` (0 → 1 … 47 → 8)", () => {
    expect(castCeremonyIndex(0)).toBe(1);
    expect(castCeremonyIndex(47)).toBe(8);
    for (let i = 0; i < 48; i++) {
      const n = castCeremonyIndex(i);
      expect(n, `hechizo ${i}`).toBeGreaterThanOrEqual(1);
      expect(n, `hechizo ${i}`).toBeLessThanOrEqual(CEREMONY_INDEX_MAX);
    }
  });

  /**
   * Los SIETE sin ceremonia, EN CRUDO: tres arma-hechizo (handlers 0x0f32/0x0f90/0x10a4 →
   * `CAST.OVL:0x0032` → COMSUBS) y cuatro abanicos de línea (→ `0x104e` → `0x1f60`).
   */
  it("los siete hechizos SIN ceremonia son las dos familias con sonido propio", () => {
    expect([...SPELLS_WITHOUT_CEREMONY].sort((a, b) => a - b)).toEqual([1, 13, 28, 37, 40, 44, 45]);
    for (const i of [1, 13, 37]) expect(castCeremonyIndexOrNull(i), `arma-hechizo ${i}`).toBeNull();
    for (const i of [28, 40, 44, 45]) expect(castCeremonyIndexOrNull(i), `abanico ${i}`).toBeNull();
    // y los 41 restantes sí la hacen
    let conCeremonia = 0;
    for (let i = 0; i < 48; i++) if (castCeremonyIndexOrNull(i) !== null) conCeremonia++;
    expect(conCeremonia).toBe(41);
  });

  it("Vas Rel Por: literal 8 en `0x0d2d`, y el sitio es el gate de FASE, no el (C)ast", () => {
    expect(VAS_REL_POR_SPELL_INDEX).toBe(46);
    expect(VAS_REL_POR_PHASE_CEREMONY_INDEX).toBe(8);
    // El literal del asm coincide con el círculo — pero el disparo es UNO solo.
    expect(castCeremonyIndex(VAS_REL_POR_SPELL_INDEX)).toBe(VAS_REL_POR_PHASE_CEREMONY_INDEX);
  });

  it("(U)se poción: el índice es el COLOR (`0x139b push word ptr [bp+4]`)", () => {
    for (let c = 0; c <= 7; c++) expect(potionCeremonyIndex(c)).toBe(c);
    expect(potionCeremonyIndex(7)).toBeLessThanOrEqual(CEREMONY_INDEX_MAX);
  });

  /**
   * La tabla de pergaminos EN CRUDO (jump table `0x1205`, tabla en el offset 0x1340).
   * 🔴 La entrada 4 es In Quas Wis con literal 4 — NO «Kal Xen Corp», que es la 5 y no
   * llama a la ceremonia por ninguna de sus dos ramas.
   */
  it("(U)se pergamino: cinco de los ocho, con sus literales", () => {
    expect(SCROLL_CEREMONY_INDEX).toEqual([0, null, 2, 3, 4, null, null, 7]);
    expect(scrollCeremonyIndex(0), "Vas Lor (0x121b sub ax,ax)").toBe(0);
    expect(scrollCeremonyIndex(4), "In Quas Wis (0x1290 mov ax,4)").toBe(4);
    expect(scrollCeremonyIndex(5), "Kal Xen Corp — sin ceremonia").toBeNull();
    expect(scrollCeremonyIndex(1), "Rel Hur — sin ceremonia").toBeNull();
    expect(scrollCeremonyIndex(6), "In Mani Corp — sin ceremonia").toBeNull();
  });

  it("todo índice emitido cae bajo el gate `< 9` de la rutina", () => {
    const todos = [
      ...Array.from({ length: 48 }, (_, i) => castCeremonyIndexOrNull(i)),
      ...Array.from({ length: 8 }, (_, c) => potionCeremonyIndex(c)),
      ...SCROLL_CEREMONY_INDEX,
      VAS_REL_POR_PHASE_CEREMONY_INDEX,
    ].filter((n): n is number => n !== null);
    for (const n of todos) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(CEREMONY_INDEX_MAX);
      // y la piel sabe darle ventana a cada uno (sin esto el destello sería de 0 ms)
      expect(timeSpellFlashWindowMs(n).dur, `ventana del índice ${n}`).toBeGreaterThan(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════
// 2. 🔴 LOS ASERTOS QUE ESTABAN EN ROJO — las siete bocas de `main.ts`
// ════════════════════════════════════════════════════════════════════════════════════

describe("`main.ts` dispara la ceremonia en las siete bocas del binario", () => {
  const BOCAS: readonly (readonly [string, string, string])[] = [
    // rótulo, ancla de apertura, ancla de cierre
    ["(C)ast exterior/pueblo", "const doCast = (): void => {", "const doDungeonCast = (): void => {"],
    ["(C)ast en MAZMORRA", "const doDungeonCast = (): void => {", "\n    const SHORT_EQUIP_NAMES"],
    ["(C)ast en COMBATE", "// (C)ast en COMBATE (CAST.OVL)", 'if (key.toLowerCase() === "u") {'],
    ["gate de FASE de Vas Rel Por", "const gatePrompt = t(GATE_TRAVEL_PROMPT)", "const doCast = (): void => {"],
    ["(U)se pergamino", 'hud.messageAppend("Scroll"); // "Scroll\\n\\n" (DS 0x466a) → "Item: Scroll"\n', 'if (a.kind === "potion") {'],
    ["(U)se poción", 'if (a.kind === "potion") {', 'if (a.kind === "shard") {'],
    ["(U)se poción en ARENA", "const applyCombatPotion", "// (U)se de PERGAMINO en la arena"],
  ];

  for (const [rotulo, desde, hasta] of BOCAS) {
    it(`emite el cue de la ceremonia: ${rotulo}`, () => {
      expect(block(desde, hasta)).toMatch(EMITE_CEREMONIA);
    });
  }

  /**
   * ★★ CONTROL POSITIVO DEL PREDICADO. Un `toMatch` que casara con todo daría los siete
   * verdes con el bug intacto. Se instancia la diferencia donde existe: el (U)se de la LLAVE
   * DE CALAVERA es una boca del MISMO picker que la poción y el pergamino, y en el binario
   * no toca `CAST2:0x0000` (`CAST.OVL:0x18dd` es un getdir). Tiene que salir NO.
   */
  it("el predicado sabe decir que NO: la llave de calavera no hace ceremonia", () => {
    const skull = block('if (a.kind === "skullKey") {', 'if (a.kind === "scroll") {');
    expect(skull.length).toBeGreaterThan(80); // el bloque existe y no está vacío
    expect(skull).not.toMatch(EMITE_CEREMONIA);
  });

  it("el (C)ast deriva el índice, no lo cablea (los tres bloques pasan el hechizo)", () => {
    for (const [rotulo, desde, hasta] of BOCAS.slice(0, 3)) {
      expect(block(desde, hasta), rotulo).toMatch(/emitCastCeremony\(def\.index\)/);
    }
  });

  /**
   * Y el emisor del (C)ast hace las DOS cosas que el asm manda: consultar la tabla (que ya
   * excluye a los siete sin ceremonia) y sacar a Vas Rel Por, cuya ceremonia vive en el gate
   * de fase. Sin esta segunda mitad, Vas Rel Por destellaría dos veces.
   */
  it("`emitCastCeremony` deriva el círculo y excluye a Vas Rel Por", () => {
    const emisor = block("const emitCastCeremony = ", "const hud = {");
    expect(emisor).toMatch(/castCeremonyIndexOrNull\(/);
    expect(emisor).toMatch(/VAS_REL_POR_SPELL_INDEX/);
  });

  it("los pergaminos ya NO llevan la lista 2/3/7 cableada", () => {
    const scroll = block(
      'hud.messageAppend("Scroll"); // "Scroll\\n\\n" (DS 0x466a) → "Item: Scroll"\n',
      'if (a.kind === "potion") {',
    );
    expect(scroll).toMatch(/scrollCeremonyIndex\(/);
    expect(scroll, "el predicado cableado 2/3/7 se va con la tabla derivada").not.toMatch(
      /idx === 2 \|\| idx === 3 \|\| idx === 7/,
    );
  });
});
