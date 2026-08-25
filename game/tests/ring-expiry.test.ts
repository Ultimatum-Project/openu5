/**
 * EXPIRACIÓN DE ANILLOS — `party_anim_build` ULTIMA.EXE 0x6936, bloque 0x69F0-0x6A4B
 * (#54 pieza 13, derivación de la tarea #67 en `re/notes/ring-expiry-derivation.md`).
 *
 * Las cuatro cosas que el binario fija y que aquí se sellan una por una:
 *  - SÓLO los anillos **42 y 44**; el **43 (Protección) EXENTO** — hay dos `cmp`
 *    (0x69f0 `0x2a`, 0x6a02 `0x2c`) y ninguno es 0x2b.
 *  - **rand(0,15)** (`push 0` / `push 0xf` @0x6a13-0x6a16) disparando con **=== 11**
 *    (`cmp ax,0xb` @0x6a20). NO `=== 0`: ése es el hermano de EQUIPAR (0x995e).
 *  - El anillo se **DESTRUYE** (`unequip_item` 0x6e60 → `mov byte [si],0xff`), no vuelve
 *    al inventario.
 *  - **RNG CONDICIONADO**: el gate 0x6a0d («¿lleva anillo?») está ANTES del `call
 *    rand_range`, así que un party sin 42/44 NO consume stream.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  rollRingExpiry,
  unequipItemById,
  EQUIPMENT_NOTHING,
  RING_INVIS,
  RING_PROTECTION,
  RING_REGEN,
} from "../src/core/equip.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

/** Estado con el miembro 0 llevando `ring` (o nada). */
function stateWithRing(ring: number): GameState {
  const st = createNewGame(initial);
  st.characters[0]!.ring = ring;
  return st;
}
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const enemyData = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const addFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(enemyData, addFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: enemyData.defenseValues,
};

/** Game con UN miembro que lleva `ring`, en overworld de hierba, semilla fija. */
function gameConRing(ring: number): Game {
  const st = createNewGame(initial);
  st.characters = [st.characters[0]!];
  st.partySize = 1;
  st.characters[0]!.ring = ring;
  st.position = { location: 0, floor: 0, x: 100, y: 100 };
  const ow = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  const world: WorldData = { overworld: ow, underworld: ow, smallMaps: new Map() };
  const g = new Game({} as ExtractedInitialState, world, gameData, st, { combatResources });
  g.reseed(4242);
  return g;
}

/** rand que devuelve SIEMPRE `v` y cuenta cuántas veces se le llamó. */
function fixedRand(v: number): ((lo: number, hi: number) => number) & { calls: number[][] } {
  const calls: number[][] = [];
  const f = (lo: number, hi: number): number => {
    calls.push([lo, hi]);
    return v;
  };
  return Object.assign(f, { calls });
}

describe("rollRingExpiry — la tirada (0x69F0-0x6A23)", () => {
  it("★ dispara con 11 y SÓLO con 11 (`cmp ax,0xb`), no con 0", () => {
    for (let v = 0; v <= 15; v++) {
      const st = stateWithRing(RING_INVIS);
      const got = rollRingExpiry(st, fixedRand(v));
      expect(got.length).toBe(v === 11 ? 1 : 0);
    }
    // El 0 merece aserto propio: es el valor del hermano de EQUIPAR (0x995e) y
    // confundirlos es la trampa de esta zona del binario.
    expect(rollRingExpiry(stateWithRing(RING_INVIS), fixedRand(0))).toEqual([]);
  });

  it("el rango es rand(0,15) — 16 salidas, no 0..16 ni 1..16", () => {
    const r = fixedRand(11);
    rollRingExpiry(stateWithRing(RING_INVIS), r);
    expect(r.calls).toEqual([[0, 15]]); // push 0 @0x6a13 / push 0xf @0x6a16
  });

  it("anillos 42 y 44 expiran; ★ el 43 (Protección) está EXENTO", () => {
    expect(rollRingExpiry(stateWithRing(RING_INVIS), fixedRand(11))).toHaveLength(1);
    expect(rollRingExpiry(stateWithRing(RING_REGEN), fixedRand(11))).toHaveLength(1);
    expect(rollRingExpiry(stateWithRing(RING_PROTECTION), fixedRand(11))).toEqual([]);
  });

  it("★ RNG CONDICIONADO: sin anillo 42/44 NO se consume ni una tirada", () => {
    // El gate 0x6a0d está ANTES del `call rand_range`. Esto es lo que garantiza que un
    // party sin esos anillos deje el stream INTACTO — sellarlo por conteo de llamadas,
    // no por el resultado, porque el resultado sería el mismo con el gate mal puesto.
    const r = fixedRand(11);
    const st = createNewGame(initial);
    for (const c of st.characters) c.ring = EQUIPMENT_NOTHING;
    expect(rollRingExpiry(st, r)).toEqual([]);
    expect(r.calls).toEqual([]); // CERO llamadas al rand
  });

  it("el MUERTO ('D') se salta (0x69e1) pero el DORMIDO ('S') SÍ entra", () => {
    const dead = stateWithRing(RING_INVIS);
    dead.characters[0]!.status = "D";
    const rDead = fixedRand(11);
    expect(rollRingExpiry(dead, rDead)).toEqual([]);
    expect(rDead.calls).toEqual([]); // ni siquiera tira

    const asleep = stateWithRing(RING_INVIS);
    asleep.characters[0]!.status = "S";
    expect(rollRingExpiry(asleep, fixedRand(11))).toHaveLength(1); // el binario sólo mira 'D'
  });
});

/**
 * EL CABLEADO, no sólo la lógica (lección bindTap: «lógica sellada ≠ cableado sellado»).
 *
 * ★ POR QUÉ SE SELLA POR CONSUMO DE RNG Y NO POR EL MENSAJE: lo intenté primero buscando
 * una semilla que hiciera salir «A ring has vanished!» a través de `startCombat`, y
 * barriendo 500 semillas NO salió ninguna. Instrumentando el call-site se ve el porqué:
 * en ese punto del stream el primer `rand(0,15)` vale casi siempre lo mismo (4 para las
 * semillas 72/100/7; 6 para la 999), o sea que la posición está prácticamente saturada y
 * el 11 no aparece por semilla. El cableado SÍ funciona —con tres tiradas consumidas
 * antes, la semilla 999 dispara— pero anclar el test a una semilla concreta sería
 * anclarlo a un artefacto del stream, no a la conducta.
 *
 * Así que se sella lo que de verdad se afirma: **que el call-site CORRE y que el gate
 * está antes del rand**. Se mide con `liveSeed()`, que es el `g_rng_seed` del stream: si
 * la tirada ocurre, la semilla avanza; si el gate la corta, no se mueve.
 */
describe("★ CABLEADO vivo: el call-site corre y el gate condiciona el stream", () => {
  // ⚠ AQUÍ HABÍA UN TERCER ASERTO Y LO RETIRÉ. Decía «con anillo 42 el arranque CONSUME
  // una tirada» comparando `liveSeed()` antes y después de `startCombat`. Pasaba... y
  // seguía pasando con el call-site ARRANCADO, porque `startCombat` consume otras tiradas
  // igualmente: medía «el combate usa el RNG», no «la expiración tiró». No podía fallar
  // por la razón que decía. Lo que discrimina es el DIFERENCIAL con/sin anillo, que es el
  // aserto de abajo — comprobado retirando el call-site: cae ése y sólo ése.
  it("★ control NEGATIVO: SIN anillo 42/44, el arranque NO consume ninguna", () => {
    // Éste es el aserto que sostiene «RNG CONDICIONADO» — y el que caería si alguien
    // moviera el gate 0x6a0d por detrás del `call rand_range`.
    const conRing = gameConRing(RING_INVIS);
    const sinRing = gameConRing(EQUIPMENT_NOTHING);
    const a0 = conRing.liveSeed();
    const b0 = sinRing.liveSeed();
    expect(a0).toBe(b0); // misma semilla de partida
    conRing.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
    sinRing.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
    // El que NO lleva anillo termina en una semilla DISTINTA del que sí: exactamente una
    // tirada de diferencia. Si el gate estuviera mal, ambos acabarían igual.
    expect(sinRing.liveSeed()).not.toBe(conRing.liveSeed());
  });

  // Este NO discrimina el cableado (con el call-site fuera también pasa, porque entonces
  // nadie tira): discrimina la EXENCIÓN. Si alguien metiera el 43 entre los que expiran
  // estando el call-site puesto, `prot` tiraría y `nada` no, y caería. Dicho para que no
  // se lea como un sello del cableado, que no lo es.
  it("el anillo de PROTECCIÓN (43) tampoco consume: está exento", () => {
    const prot = gameConRing(RING_PROTECTION);
    const nada = gameConRing(EQUIPMENT_NOTHING);
    prot.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
    nada.startCombat({ slot: 0, defIndex: 0, tile: 0x94, water: false, x: 100, y: 100 });
    expect(prot.liveSeed()).toBe(nada.liveSeed()); // idénticos ⇒ ninguno tiró
  });
});

describe("unequipItemById — el desequipado (0x6E60)", () => {
  it("★ DESTRUYE el anillo: slot a 0xFF y NADA vuelve al inventario", () => {
    const st = stateWithRing(RING_INVIS);
    const before = st.equipmentQuantities[RING_INVIS] ?? 0;
    expect(unequipItemById(st, 0, RING_INVIS)).toBe("ring");
    expect(st.characters[0]!.ring).toBe(EQUIPMENT_NOTHING); // 0x6e80
    expect(st.equipmentQuantities[RING_INVIS] ?? 0).toBe(before); // no vuelve al pack
  });

  it("si el item no está equipado, devuelve null y no toca nada", () => {
    const st = stateWithRing(EQUIPMENT_NOTHING);
    expect(unequipItemById(st, 0, RING_INVIS)).toBeNull();
    expect(st.characters[0]!.ring).toBe(EQUIPMENT_NOTHING);
  });
});
