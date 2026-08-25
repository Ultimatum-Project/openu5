/**
 * #171 · Los `floor >= 0x80` LITERALES del port — residuo declarado de #150.
 *
 * EL DEFECTO. El binario lee `g_floor` como BYTE SIN SIGNO (`cmp byte ptr
 * [g_floor],0x80 / jae`), donde el sótano vale 0xFF. En el clon `position.floor` es un
 * número CON SIGNO: el Underworld sí es 0xFF, pero **los sótanos de pueblo/castillo son
 * z = −1** (`smallmaps.json`). Por eso `floor >= 0x80` escrito literal es FALSO para −1
 * y deja pasar justo el caso que el gate venía a cerrar. `isBelowGround` enmascara a
 * byte, como ya hacía `lightLevel` desde antes.
 *
 * AUDITORÍA DE LOS SEIS SITIOS (uno a uno, con su veredicto):
 *
 *   DEFECTO REAL, arreglado + probado aquí
 *     · endgame/use-tools.ts  useSpyglass  — `location >= 0x21 || floor >= 0x80`.
 *       En un sótano `location` es la del pueblo (1-0x20) ⇒ el 1er término es falso, y
 *       el 2º también con −1 ⇒ el catalejo FUNCIONABA bajo tierra. El original dice
 *       "Not here!".
 *     · skin/coreview.ts:1568  banda de VIENTOS  — mismo perfil: se veía en el sótano.
 *     · skin/coreview.ts:1593  banda de LUNAS/astro — ídem.
 *
 *   NO ES DEFECTO, y por qué (declarado, no supuesto)
 *     · endgame/use-tools.ts  useSextant — `floor > 0x7f || location !== 0`. El término
 *       de localización YA excluye todo pueblo/castillo, que es donde viven los sótanos;
 *       con location 0 los únicos pisos son 0 y 0xFF, y 0xFF > 0x7f evalúa bien. El
 *       término de piso es redundante, no roto.
 *     · world/loops/spawn.ts  spawnThreshold — INALCANZABLE con −1. Cadena:
 *       `runContextTurn` (envuelve en `if (loc === 0)`), `runNavalTurn` y
 *       `resolveTrollToll` → `outdoorWorldTurn` → `rollSpawnGate` → aquí.
 *     · combat/encounters.ts  tileToMonsterId — mismo argumento: su único caller de
 *       producción cuelga del picker de `outdoorWorldTurn`.
 */
import { describe, expect, it } from "vitest";
import { isBelowGround } from "../src/core/world/survival.js";
import { useSpyglass } from "../src/core/endgame/use-tools.js";
import type { GameState } from "../src/core/state.js";

describe("#171 (1) isBelowGround — el `cmp byte [g_floor],0x80 / jae` del binario", () => {
  it("★ SÓTANO z = −1 → true (es el caso que el literal `>= 0x80` fallaba)", () => {
    expect(isBelowGround(-1)).toBe(true);
    // Y la prueba de que el literal NO lo cogía, que es lo que motiva la función:
    expect(-1 >= 0x80).toBe(false);
  });
  it("UNDERWORLD 0xFF → true", () => {
    expect(isBelowGround(0xff)).toBe(true);
  });
  it("superficie y plantas altas (0..3) → false", () => {
    for (const z of [0, 1, 2, 3]) expect(isBelowGround(z)).toBe(false);
  });
  it("la frontera está en 0x80 exacto", () => {
    expect(isBelowGround(0x7f)).toBe(false);
    expect(isBelowGround(0x80)).toBe(true);
  });
});

/** Estado mínimo para el gate del catalejo: sólo mira position + time. */
function ctxAt(location: number, floor: number) {
  const state = {
    position: { location, floor, x: 5, y: 5 },
    time: { year: 139, month: 4, day: 7, hour: 22, minute: 0 }, // de noche: pasa el 2º gate
  } as unknown as GameState;
  return { state, rand: () => 0 } as unknown as Parameters<typeof useSpyglass>[0];
}
const said = (evs: ReturnType<typeof useSpyglass>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("#171 (2) useSpyglass — el gate de piso, con el sótano dentro", () => {
  it("★ SÓTANO de castillo (location 17, floor −1) → «Not here!»", () => {
    // El caso que el literal dejaba pasar: mismo sótano de Lord British donde jugó la
    // sonda #121. Antes de este fix, el catalejo funcionaba bajo tierra.
    expect(said(useSpyglass(ctxAt(17, -1)))).toContain("Not here!");
  });
  it("UNDERWORLD (location 0, floor 0xFF) → «Not here!» (ya funcionaba)", () => {
    expect(said(useSpyglass(ctxAt(0, 0xff)))).toContain("Not here!");
  });
  it("MAZMORRA (location >= 0x21) → «Not here!» por el otro término", () => {
    expect(said(useSpyglass(ctxAt(0x21, 0)))).toContain("Not here!");
  });
  it("CONTROL NEGATIVO: exterior (location 0, floor 0) NO cae en «Not here!»", () => {
    // Sin este control, un gate que dijera «Not here!» SIEMPRE también pasaría los de
    // arriba: es lo que separa medir el gate de medir un return fijo.
    expect(said(useSpyglass(ctxAt(0, 0)))).not.toContain("Not here!");
  });
  it("CONTROL NEGATIVO: planta ALTA de pueblo (location 2, floor 1) tampoco", () => {
    expect(said(useSpyglass(ctxAt(2, 1)))).not.toContain("Not here!");
  });
});
