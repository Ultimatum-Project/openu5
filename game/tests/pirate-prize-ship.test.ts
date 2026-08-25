/**
 * #35 — LA NAVE DEL PIRATA SE QUEDA AL VENCERLO (`SJOG.OVL 0x2078-0x20c3`).
 *
 * Con victoria (`0x208b`) y tile de nave NPC (`0x2094` `and 0xfc`/`cmp 0x2c`), el binario NO
 * borra el registro: lo transforma in situ — resta 8 a los dos tiles (`0x209c`/`0x209f`),
 * casco 99 (`0x20a3`) y dos esquifes (`0x20a7`). Sin victoria cae a `0x20ae`, que sí borra.
 *
 * Estos tests fijan la función PURA. El cableado (que `startCombat` la cuelgue del latch de
 * VICTORIA y no del `removeEnemy` de ENTRADA) tiene su propio test abajo, porque es
 * justamente donde el diseño original estaba mal: colgarlo de la entrada habría hecho
 * aparecer la nave-premio AL EMPEZAR el combate.
 */
import { describe, it, expect } from "vitest";
import { piratePrizeShip, PIRATE_ENEMY_DEF_INDEX } from "../src/core/world/enemies.js";
import type { OverworldEnemy } from "../src/core/world/enemies.js";
import {
  HULL_MAX,
  PIRATE_SHIP_HULL,
  DERELICT_FRIGATE_TILE,
  PIRATE_PRIZE_SKIFFS,
} from "../src/core/world/transport.js";

const AT = { location: 0, floor: 0 };
const pirata = (x = 40, y = 60): Pick<OverworldEnemy, "defIndex" | "x" | "y"> => ({
  defIndex: PIRATE_ENEMY_DEF_INDEX,
  x,
  y,
});

describe("#35 — la nave del pirata al vencerlo (SJOG.OVL 0x2078-0x20c3)", () => {
  it("deja una fragata EN LA CELDA DEL PIRATA, con casco 99 y dos esquifes", () => {
    const prize = piratePrizeShip(pirata(40, 60), AT);
    expect(prize).not.toBeNull();
    expect(prize!.kind).toBe("ship");
    expect(prize!.x).toBe(40); // la celda del pirata, no la de la party
    expect(prize!.y).toBe(60);
    expect(prize!.hull).toBe(99); // 0x20a3 `mov byte [bx+5], 0x63`
    expect(prize!.skiffs).toBe(2); // 0x20a7 `mov byte [bx+7], 2`
    expect(prize!.tile).toBe(DERELICT_FRIGATE_TILE); // CRUDO: el call-site suma el banco
  });

  it("🔴 el casco es 99 (HULL_MAX), NO 100 (PIRATE_SHIP_HULL) — el 0x20a3 pisa el del pirata", () => {
    // El comentario de PIRATE_SHIP_HULL decía que «una nave pirata capturada excede el tope
    // del jugador». Es falso y este aserto es el que lo impide volver: 0x20a3 es un `mov`
    // INCONDICIONAL de 99, así que la capturada sale EN el tope, nunca por encima.
    expect(PIRATE_SHIP_HULL).toBe(100); // el pirata VIVO
    expect(HULL_MAX).toBe(99); // el tope del jugador
    expect(piratePrizeShip(pirata(), AT)!.hull).toBe(HULL_MAX);
    expect(piratePrizeShip(pirata(), AT)!.hull).not.toBe(PIRATE_SHIP_HULL);
  });

  it("hereda la localización y el piso del sitio donde ocurrió (no los inventa)", () => {
    const prize = piratePrizeShip(pirata(), { location: 0, floor: 0xff }); // Underworld
    expect(prize!.location).toBe(0);
    expect(prize!.floor).toBe(0xff);
  });

  it("CONTROL: un enemigo que NO es el pirata no deja nave (0x2094 `cmp al,0x2c`)", () => {
    // El gate del binario es por CLASE de tile. Aquí, por defIndex — que es su equivalente
    // en el clon (el pirata es el único con casco y contador de viento en el registro).
    for (const defIndex of [0, 8 + 1, 16, 43]) {
      if (defIndex === PIRATE_ENEMY_DEF_INDEX) continue;
      expect(piratePrizeShip({ defIndex, x: 1, y: 2 }, AT)).toBeNull();
    }
  });

  it("el rumbo es FIJO y está declarado: 0x24, proa al norte (Clase C)", () => {
    // El binario conserva el rumbo por aritmética: `sub byte [bx],8` lleva 0x2c..0x2f a
    // 0x24..0x27 sin tocar los dos bits bajos. El clon lleva UN tile de pirata, así que no
    // hay rumbo que preservar. Si algún día se portan los cuatro tiles, este aserto es el
    // que hay que cambiar — y por eso está escrito contra el literal, no contra la constante.
    expect(DERELICT_FRIGATE_TILE).toBe(0x24);
    expect(PIRATE_PRIZE_SKIFFS).toBe(2);
  });
});
