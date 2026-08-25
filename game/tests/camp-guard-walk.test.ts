/**
 * PASEO DEL VIGÍA de acampada — reductor puro `campGuardWalk`
 * (`CS CMDS.OVL:0x0000 camp_sleep_scene`, tramo 0x0337-0x03e8).
 *
 * Lo que se blinda aquí no es sólo «a qué celda va», sino **cuántas tiradas gasta y en
 * qué orden**: eso es lo que mueve el stream y lo que un test de posiciones no ve. Por
 * eso el arné registra CADA llamada al rand (rangos incluidos) y los casos afirman sobre
 * esa lista, no sólo sobre la celda resultante.
 *
 * El defecto que sustituye: el port paseaba entre DOS celdas fijas por paridad de la hora,
 * sin tirar dados — derivado de una muestra corta de vídeo congelada como regla (ficha #61).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  campGuardWalk, campSleepStep, CAMP_ARENA_MAX, CAMP_STEPS_PER_HOUR, CAMP_STEP_MINUTES,
  BED_STEP_MINUTES, BED_STEPS_PER_HOUR, CAMP_FIRE_CELL,
} from "../src/core/world/camp.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { buildEnemyDefs, type AdditionalEnemyFlag, type EnemyDataInput } from "../src/core/combat/enemies.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { RandFn } from "../src/core/world/survival.js";
import type { WorldData } from "../src/core/world/map.js";

/**
 * RNG guionizado: devuelve los valores dados EN ORDEN y APUNTA cada llamada con su rango.
 * Si el código pide más tiradas de las guionizadas, revienta — así una tirada de más no
 * pasa por «valor por defecto», que es como se cuelan los consumos fantasma.
 */
function scriptedRand(values: number[]) {
  const calls: { min: number; max: number; out: number }[] = [];
  let i = 0;
  const rand = (min: number, max: number): number => {
    if (i >= values.length) throw new Error(`rand() de MÁS: llamada ${i + 1}, guion de ${values.length}`);
    const out = values[i++]!;
    calls.push({ min, max, out });
    return out;
  };
  return { rand, calls };
}

const libre = () => true;
const ocupado = () => false;
const centro = { col: 5, row: 5 };

describe("campGuardWalk — la moneda de movimiento (0x034a: sólo el 2 mueve)", () => {
  it.each([0, 1, 3])("con %i NO se mueve y NO tira la segunda (una sola tirada)", (v) => {
    const { rand, calls } = scriptedRand([v]);
    expect(campGuardWalk(centro, rand, libre)).toEqual(centro);
    expect(calls).toHaveLength(1); // ← la clave: NO se tira la dirección
    expect(calls[0]).toEqual({ min: 0, max: 3, out: v });
  });

  it("con 2 SÍ se mueve y tira la SEGUNDA — dos tiradas, ambas rand(0..3)", () => {
    const { rand, calls } = scriptedRand([2, 2]); // mover, dirección ESTE
    expect(campGuardWalk(centro, rand, libre)).toEqual({ col: 6, row: 5 });
    expect(calls).toEqual([
      { min: 0, max: 3, out: 2 }, // movimiento
      { min: 0, max: 3, out: 2 }, // dirección
    ]);
  });
});

describe("campGuardWalk — las CUATRO ortogonales, una a una", () => {
  const casos: [number, string, { col: number; row: number }][] = [
    [0, "NORTE (dec y, 0x0382)", { col: 5, row: 4 }],
    [1, "SUR (inc y, 0x03d8)", { col: 5, row: 6 }],
    [2, "ESTE (inc x, 0x03de)", { col: 6, row: 5 }],
    [3, "OESTE (dec x, 0x03e4)", { col: 4, row: 5 }],
  ];
  it.each(casos)("dirección %i = %s", (dir, _nombre, esperada) => {
    const { rand } = scriptedRand([2, dir]);
    expect(campGuardWalk(centro, rand, libre)).toEqual(esperada);
  });

  it("las cuatro son DISTINTAS entre sí (ninguna pareja aliasa)", () => {
    const destinos = [0, 1, 2, 3].map((d) => {
      const { rand } = scriptedRand([2, d]);
      return JSON.stringify(campGuardWalk(centro, rand, libre));
    });
    expect(new Set(destinos).size).toBe(4);
  });
});

describe("campGuardWalk — guarda 1: el tablero de once (0..10, 0x038e)", () => {
  it("desde la fila 0 hacia el NORTE se queda quieto (row −1 fuera)", () => {
    const { rand, calls } = scriptedRand([2, 0]);
    expect(campGuardWalk({ col: 5, row: 0 }, rand, libre)).toEqual({ col: 5, row: 0 });
    expect(calls).toHaveLength(2); // las DOS tiradas ya están gastadas
  });

  it("desde la columna 10 hacia el ESTE se queda quieto (col 11 fuera)", () => {
    const { rand } = scriptedRand([2, 2]);
    expect(campGuardWalk({ col: CAMP_ARENA_MAX, row: 5 }, rand, libre))
      .toEqual({ col: CAMP_ARENA_MAX, row: 5 });
  });

  it("🔴 el 10 es VÁLIDO: entrar EN el borde se permite (la guarda es 0..10, no 0..9)", () => {
    const { rand } = scriptedRand([2, 2]);
    expect(campGuardWalk({ col: 9, row: 5 }, rand, libre)).toEqual({ col: CAMP_ARENA_MAX, row: 5 });
  });

  it("🔴 el 0 es VÁLIDO: entrar EN el borde bajo se permite", () => {
    const { rand } = scriptedRand([2, 0]);
    expect(campGuardWalk({ col: 5, row: 1 }, rand, libre)).toEqual({ col: 5, row: 0 });
  });
});

describe("campGuardWalk — guarda 2: casilla libre (0x03a6) y el NO-RE-TIRAR", () => {
  it("casilla ocupada ⇒ se queda quieto", () => {
    const { rand } = scriptedRand([2, 1]);
    expect(campGuardWalk(centro, rand, ocupado)).toEqual(centro);
  });

  it("🔴 al fallar la guarda NO busca otra dirección: exactamente 2 tiradas, no más", () => {
    const { rand, calls } = scriptedRand([2, 1]); // si re-tirara, el guion reventaría
    campGuardWalk(centro, rand, ocupado);
    expect(calls).toHaveLength(2);
  });

  it("la guarda se consulta con la celda DESTINO, no con la de origen", () => {
    const vistas: [number, number][] = [];
    const { rand } = scriptedRand([2, 1]); // SUR → (5,6)
    campGuardWalk(centro, rand, (c, r) => {
      vistas.push([c, r]);
      return true;
    });
    expect(vistas).toEqual([[5, 6]]);
  });

  it("la guarda de BORDE corta ANTES que la de ocupación (fuera no se pregunta)", () => {
    let preguntas = 0;
    const { rand } = scriptedRand([2, 0]);
    campGuardWalk({ col: 5, row: 0 }, rand, () => {
      preguntas++;
      return true;
    });
    expect(preguntas).toBe(0);
  });
});

describe("campGuardWalk — no muta la celda de entrada", () => {
  it("la celda original queda intacta tras un movimiento", () => {
    const origen = { col: 5, row: 5 };
    const { rand } = scriptedRand([2, 2]);
    const destino = campGuardWalk(origen, rand, libre);
    expect(origen).toEqual({ col: 5, row: 5 });
    expect(destino).not.toBe(origen);
  });
});

// La consecuencia OBSERVABLE que el port no daba: desde una ranura del anillo, el conjunto
// alcanzable en una hora son las CUATRO ortogonales libres — no dos celdas fijas. Es lo que
// el usuario reportó (el vigía sólo iba y venía) y lo que la ficha #61 midió.
describe("campGuardWalk — conjunto alcanzable en UNA hora", () => {
  it("desde el centro con todo libre: las 4 ortogonales, y ninguna diagonal", () => {
    const alcanzables = [0, 1, 2, 3].map((d) => {
      const { rand } = scriptedRand([2, d]);
      return campGuardWalk(centro, rand, libre);
    });
    expect(alcanzables).toEqual([
      { col: 5, row: 4 }, { col: 5, row: 6 }, { col: 6, row: 5 }, { col: 4, row: 5 },
    ]);
    for (const c of alcanzables) {
      expect(Math.abs(c.col - centro.col) + Math.abs(c.row - centro.row)).toBe(1);
    }
  });

  it("3 de cada 4 horas el vigía NO se mueve (y gasta 1 sola tirada)", () => {
    const quietos = [0, 1, 3].filter((v) => {
      const { rand } = scriptedRand([v]);
      return campGuardWalk(centro, rand, libre) === centro;
    });
    expect(quietos).toHaveLength(3);
  });
});

// ═══ INTEGRACIÓN: que el paseo esté CABLEADO al tick por hora ════════════════════════
// Los 20 casos de arriba prueban el REDUCTOR, y aun así tres mutantes del CABLEADO
// SOBREVIVIERON a toda la batería: «no llamar nunca al paseo» (= el port de main),
// «tirar también sin vigía» y «tirar ANTES de la emboscada». Ninguno los veía porque
// ningún test miraba a `campSleepStep`. Esto lo cierra: mismo RNG guionizado, ahora sobre
// el paso de UNA HORA, afirmando el ORDEN y el NÚMERO de tiradas del paso completo.
describe("campSleepStep — el paseo, CABLEADO al tick por hora", () => {
  /** Ctx mínimo: lo justo para que el paso corra (reloj + party) con rand observable. */
  function ctxCon(rand: (min: number, max: number) => number, libre = true) {
    return {
      state: {
        time: { year: 139, month: 3, day: 5, hour: 10, minute: 0 },
        characters: [{ currentHp: 10, maxHp: 10, status: "G" }],
        partySize: 1,
        position: { location: 0 },
      },
      rand,
      dungeonState: null,
      enemyDefs: undefined,
      refugeKarmaMessages: [],
      campCellFree: () => libre,
      mapTileWithOverrides: () => 5,
      snapNpcsToSchedule: () => {},
      objectOrNpcAt: () => false,
      runContextTurn: () => [],
      startCombat: () => [],
    } as unknown as Parameters<typeof campSleepStep>[0];
  }

  /**
   * Guion con RELLENO INERTE: los valores dados se consumen en orden y, agotados, todo
   * devuelve 1 — que es inerte en las DOS tiradas de este paso (moneda 1 ≠ 2 ⇒ el vigía no
   * se mueve; emboscada 1 ≠ 0 ⇒ no salta). Antes el relleno era 0 y el guion prefijaba un
   * 63 asumiendo que la emboscada iba PRIMERO; con la hora partida en doce, la emboscada es
   * la ÚLTIMA y un relleno de 0 la disparaba sola. El relleno tiene que ser inerte, no
   * «cualquier cosa».
   */
  function guionSinEmboscada(extra: number[]) {
    const calls: { min: number; max: number; out: number }[] = [];
    let i = 0;
    const rand = (min: number, max: number): number => {
      const out = extra[i++] ?? 1; // 1 = inerte en moneda y en emboscada
      calls.push({ min, max, out });
      return out;
    };
    return { rand, calls };
  }

  // 🔴 EL ORDEN CAMBIÓ CON #67, y lo decidió el binario, no la comodidad: dentro de UNA
  // HORA van primero los DOCE PASOS de 5' (cada uno con su paseo) y AL FINAL la tirada de
  // emboscada del cruce. Lo fija `camp-ambush`: al cortar por emboscada el reloj ya ha
  // avanzado esa hora (+1 h), lo que sólo puede pasar si los pasos corrieron ANTES.
  // La versión anterior de este caso exigía la emboscada primero — era correcta cuando la
  // hora era UN paso de 60', y quedó obsoleta al partirla en doce.
  it("🔴 CON vigía: los 12 paseos van ANTES y la emboscada del cruce va AL FINAL", () => {
    const { rand, calls } = guionSinEmboscada([]);
    campSleepStep(ctxCon(rand), 0, 5, { col: 5, row: 5 });
    const rangos = calls.map((c) => `${c.min}..${c.max}`);
    expect(rangos.filter((r) => r === "0..63")).toHaveLength(1); // UNA emboscada por hora
    expect(rangos[rangos.length - 1]).toBe("0..63"); // y es la ÚLTIMA
    // DOCE monedas, ni una más ni una menos, y el 12 va LITERAL: escrito como
    // `CAMP_STEPS_PER_HOUR` el caso se inocula solo — un mutante que ponga la cadencia a
    // 1 paso de 60' mueve la constante Y el aserto a la vez, y el test lo aplaude.
    expect(rangos.filter((r) => r === "0..3")).toHaveLength(12);
  });

  it("🔴 SIN vigía: el paso NO gasta ni una tirada del paseo (0x0337 se salta el bloque)", () => {
    const { rand, calls } = guionSinEmboscada([]);
    const r = campSleepStep(ctxCon(rand), 0, 5, null);
    expect(calls.map((c) => `${c.min}..${c.max}`)).toEqual(["0..63"]); // sólo la emboscada
    expect(r.guardCell).toBeNull();
  });

  it("🔴 el paseo SE LLAMA de verdad: con vigía hay 12 tiradas más que sin él", () => {
    const conVigia = guionSinEmboscada([]);
    campSleepStep(ctxCon(conVigia.rand), 0, 5, { col: 5, row: 5 });
    const sinVigia = guionSinEmboscada([]);
    campSleepStep(ctxCon(sinVigia.rand), 0, 5, null);
    // 12 monedas de más (una por paso de 5'); ninguna saca 2 con el relleno inerte, así
    // que no hay tiradas de dirección — el delta es exactamente la cadencia.
    expect(conVigia.calls.length - sinVigia.calls.length).toBe(12); // literal, ver arriba
  });

  it("una hora sin ningún 2: 12 monedas + 1 emboscada, y el vigía QUIETO", () => {
    const { rand, calls } = guionSinEmboscada([]); // relleno inerte: ninguna saca 2
    const r = campSleepStep(ctxCon(rand), 0, 5, { col: 5, row: 5 });
    expect(calls).toHaveLength(13); // 12 monedas + la emboscada (literal, ver arriba)
    expect(r.guardCell).toEqual({ col: 5, row: 5 });
  });

  it("la guarda de casilla ocupada llega desde el ctx (campCellFree) y frena el paso", () => {
    const { rand } = guionSinEmboscada([2, 2]);
    const r = campSleepStep(ctxCon(rand, /*libre*/ false), 0, 5, { col: 5, row: 5 });
    expect(r.guardCell).toEqual({ col: 5, row: 5 });
  });
});

// ═══ CADENCIA: los DOS números, escritos como LITERALES ═══════════════════════════════
// Un aserto escrito contra la CONSTANTE (`toBe(CAMP_STEPS_PER_HOUR)`) se inocula solo: el
// mutante que devuelve la cadencia a «un paso de 60'» mueve la constante Y el aserto en el
// mismo gesto, y el test lo aplaude. Aquí van los números del binario, a pelo.
describe("cadencia de los bucles de dormir — 5'/12 el camp, 10'/6 la cama", () => {
  it("camp: CINCO minutos por paso, DOCE pasos por hora (CMDS 0x0314 `push 5`)", () => {
    expect(CAMP_STEP_MINUTES).toBe(5);
    expect(CAMP_STEPS_PER_HOUR).toBe(12);
  });

  it("cama: DIEZ minutos por paso, SEIS por hora (CMDS 0x0647 `push 0xa`)", () => {
    expect(BED_STEP_MINUTES).toBe(10);
    expect(BED_STEPS_PER_HOUR).toBe(6);
  });

  it("🔴 son DISTINTAS: un solo número para las dos metería en una la cadencia de la otra", () => {
    expect(CAMP_STEP_MINUTES).not.toBe(BED_STEP_MINUTES);
    expect(CAMP_STEPS_PER_HOUR).not.toBe(BED_STEPS_PER_HOUR);
  });

  it("las dos cierran la hora exacta (60 min): el total de reloj no cambia, el muestreo sí", () => {
    expect(CAMP_STEP_MINUTES * CAMP_STEPS_PER_HOUR).toBe(60);
    expect(BED_STEP_MINUTES * BED_STEPS_PER_HOUR).toBe(60);
  });
});

// ═══ EL CABLEADO EN `Game`: la GUARDA 2 y el paseo de la vía ATÓMICA ══════════════════
// Los casos de arriba corren sobre el reductor puro y sobre `campSleepStep` con un ctx de
// juguete (`campCellFree: () => libre`), así que NINGUNO ve el cableado real. Dos mutantes
// lo demostraron sobreviviendo a la batería entera:
//   · quitar la inyección de `campCellFree` en `Game` (⇒ el vigía atraviesa la hoguera,
//     los muros de roca y a sus compañeros dormidos);
//   · no enhebrar la celda en la vía atómica `camp()` (⇒ 12 tiradas MENOS por hora que la
//     vía que conduce la piel, con el mismo vigía).
// Estos casos usan un `Game` de verdad, con la arena CampFire cargada de combatmaps.json.
describe("cableado del paseo en Game — arena CampFire real", () => {
  const load = <T,>(rel: string): T =>
    JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
  const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
  const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
  const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

  /** Arena CampFire (índice 0): formación SUR y las casillas que este bloque discrimina. */
  const FORMACION = [
    { col: 6, row: 6 }, { col: 4, row: 4 }, { col: 6, row: 4 },
    { col: 4, row: 6 }, { col: 5, row: 3 }, { col: 3, row: 5 },
  ];
  const ROCA = { col: 6, row: 3 }; // LargeRockWall (77), intransitable a pie

  function makeChar(over: Partial<CharacterState> = {}): CharacterState {
    return {
      name: "Test", gender: 0x0b, class: "A", status: "G",
      strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
      currentHp: 30, maxHp: 60, exp: 150, level: 2, monthsAtInn: 0,
      helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
      partyStatus: 0, ...over,
    };
  }

  function makeState(over: Partial<GameState> = {}): GameState {
    return {
      characters: [makeChar(), makeChar({ name: "Iolo" })],
      partySize: 2, activeCharacter: 0, food: 100, gold: 100,
      // hora 8 + ≤3 h: no cruza medianoche ⇒ advanceClock no consume rand y las únicas
      // tiradas del paso son las del paseo y la emboscada.
      time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
      turnsSinceStart: 0,
      position: { location: 0, floor: 0, x: 100, y: 100 },
      transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
      ...over,
    } as GameState;
  }

  function makeGame(s: GameState = makeState()): Game {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
    const combatResources: CombatResources = {
      combatMaps, enemyDefs: buildEnemyDefs(data, additionalFlags),
      attackValues: [], attackRangeValues: [], defenseValues: data.defenseValues,
    };
    return new Game({} as ExtractedInitialState, world, gameData, s, { combatResources });
  }

  /** Sustituye el stream vivo (precedente: camp-ambush.test.ts / prompts-troll.test.ts). */
  function patchRng(g: Game, fn: RandFn): void {
    (g as unknown as { liveRng: { next: RandFn } }).liveRng.next = fn;
  }

  /**
   * Guion de UN intento de paseo en la dirección `dir` y luego INERTE (moneda 1 ≠ 2). La
   * emboscada devuelve 1 (≠ 0, no salta). Cualquier otra tirada devuelve su mínimo.
   */
  function unIntento(g: Game, dir: number): void {
    const orden = [2, dir];
    let i = 0;
    patchRng(g, (lo, hi) => {
      if (lo === 0 && hi === 63) return 1;
      if (lo === 0 && hi === 3) return orden[i++] ?? 1;
      return lo;
    });
  }

  /** Un paso de hora con el vigía `guardIdx` puesto a mano en `celda`, dirección `dir`. */
  function pasear(g: Game, celda: { col: number; row: number }, dir: number, guardIdx: number) {
    unIntento(g, dir);
    return g.campSleepStep(0, 2, celda, guardIdx).guardCell;
  }

  it("la formación de la arena es la que estos casos suponen (si cambia, cambian ellos)", () => {
    const g = makeGame();
    expect(FORMACION.map((_, i) => g.campGuardStartCell(i))).toEqual(FORMACION);
    expect(g.campGuardStartCell(-1)).toBeNull(); // sin vigía no hay celda de arranque
  });

  it("🔴 la HOGUERA bloquea el paseo (guarda 2 vía campCellFree)", () => {
    // (5,4) → SUR = (5,5) = CAMP_FIRE_CELL. Sin la inyección de `campCellFree` el vigía
    // se planta encima del fuego.
    expect(pasear(makeGame(), { col: 5, row: 4 }, /*S*/ 1, 1)).toEqual({ col: 5, row: 4 });
    expect(CAMP_FIRE_CELL).toEqual({ col: 5, row: 5 });
  });

  it("control positivo: desde la MISMA celda hacia el NORTE sí se mueve (la casilla está libre)", () => {
    // Sin este control, el caso de arriba pasaría igual con el paseo roto del todo.
    expect(pasear(makeGame(), { col: 5, row: 4 }, /*N*/ 0, 1)).toEqual({ col: 5, row: 3 });
  });

  it("🔴 el TERRENO intransitable bloquea (LargeRockWall 77 en la arena)", () => {
    expect(pasear(makeGame(), { col: 5, row: 3 }, /*E*/ 2, 1)).toEqual({ col: 5, row: 3 });
    expect(pasear(makeGame(), { col: 5, row: 3 }, /*O*/ 3, 1)).toEqual({ col: 4, row: 3 }); // control
  });

  it("🔴 un COMPAÑERO DORMIDO bloquea su casilla de formación", () => {
    // (5,6) → ESTE = (6,6) = puesto del miembro 0. Con el vigía = miembro 1, está ocupada.
    expect(pasear(makeGame(), { col: 5, row: 6 }, /*E*/ 2, 1)).toEqual({ col: 5, row: 6 });
  });

  it("…y el vigía NO se estorba A SÍ MISMO: con guardIdx=0 esa misma casilla está libre", () => {
    expect(pasear(makeGame(), { col: 5, row: 6 }, /*E*/ 2, 0)).toEqual({ col: 6, row: 6 });
  });

  it("un MUERTO no ocupa: no se le coloca en la escena", () => {
    const g = makeGame(makeState({
      characters: [makeChar({ status: "D" }), makeChar({ name: "Iolo" })], partySize: 2,
    }));
    expect(pasear(g, { col: 5, row: 6 }, /*E*/ 2, 1)).toEqual({ col: 6, row: 6 });
  });

  it("la roca de control es de verdad intransitable (si la arena cambia, este caso avisa)", () => {
    const g = makeGame();
    const tiles = g.combatArenaTiles(0)!;
    expect(tiles[ROCA.row]![ROCA.col]).toBe(77);
    expect(tiles[CAMP_FIRE_CELL.row]![CAMP_FIRE_CELL.col]).toBe(179); // CampFire
  });
});

// ═══ TIRADAS POR HORA de una acampada ENTERA, y las DOS vías sobre el mismo stream ════
describe("camp() atómico — 12 monedas por hora + N−1 emboscadas, y el mismo stream que la piel", () => {
  const load = <T,>(rel: string): T =>
    JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
  const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
  const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
  const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

  function makeChar(over: Partial<CharacterState> = {}): CharacterState {
    return {
      name: "Test", gender: 0x0b, class: "A", status: "G",
      strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
      currentHp: 30, maxHp: 60, exp: 150, level: 2, monthsAtInn: 0,
      helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
      partyStatus: 0, ...over,
    };
  }

  function makeGame(): Game {
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
    const combatResources: CombatResources = {
      combatMaps, enemyDefs: buildEnemyDefs(data, additionalFlags),
      attackValues: [], attackRangeValues: [], defenseValues: data.defenseValues,
    };
    const s = {
      characters: [makeChar(), makeChar({ name: "Iolo" })],
      partySize: 2, activeCharacter: 0, food: 100, gold: 100,
      time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
      turnsSinceStart: 0,
      position: { location: 0, floor: 0, x: 100, y: 100 },
      transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
    } as GameState;
    return new Game({} as ExtractedInitialState, world, gameData, s, { combatResources });
  }

  /**
   * Rand determinista POR RANGO que además ANOTA la secuencia de rangos pedidos. Es la
   * forma de comparar dos vías: si consumen el mismo stream, piden los mismos rangos en el
   * mismo orden. `mover=true` hace que el vigía intente moverse en CADA paso (2 tiradas
   * por paso en vez de 1) — así la comparación no se apoya en el camino barato.
   */
  function grabar(g: Game, mover: boolean) {
    const rangos: string[] = [];
    (g as unknown as { liveRng: { next: RandFn } }).liveRng.next = (lo, hi) => {
      rangos.push(`${lo}..${hi}`);
      if (lo === 0 && hi === 63) return 1; // emboscada: nunca acierta
      if (lo === 0 && hi === 3) return mover ? 2 : 1; // moneda/dirección del paseo
      if (lo === 0 && hi === 99) return 50; // gate de la aparición: no cruza
      return lo;
    };
    return rangos;
  }

  it("🔴 camp(3) CON vigía: 36 monedas (12 por hora) y 2 emboscadas (N−1)", () => {
    const g = makeGame();
    const rangos = grabar(g, /*mover*/ false); // relleno inerte ⇒ 1 tirada por paso
    g.camp(3, 0);
    expect(rangos.filter((r) => r === "0..3")).toHaveLength(36); // 3 h × 12 pasos
    expect(rangos.filter((r) => r === "0..63")).toHaveLength(2); // N−1 cruces
  });

  it("🔴 camp(3) SIN vigía: CERO tiradas del paseo (0x0337 se salta el bloque entero)", () => {
    const g = makeGame();
    const rangos = grabar(g, false);
    g.camp(3, -1);
    expect(rangos.filter((r) => r === "0..3")).toHaveLength(0);
    expect(rangos.filter((r) => r === "0..63")).toHaveLength(2); // la emboscada sigue igual
  });

  it("🔴 la vía ATÓMICA y la que conduce la PIEL consumen EL MISMO stream", () => {
    // Es la promesa que el docblock de `camp()` lleva escrita. Sin el paseo enhebrado en la
    // vía atómica era FALSA por 12 tiradas/hora, y ningún test se ponía rojo.
    const atomico = makeGame();
    const rangosA = grabar(atomico, /*mover*/ true);
    atomico.camp(3, 0);

    const pasoAPaso = makeGame();
    const rangosB = grabar(pasoAPaso, /*mover*/ true);
    let celda = pasoAPaso.campGuardStartCell(0);
    for (let h = 0; h < 3; h++) {
      const paso = pasoAPaso.campSleepStep(h, 3, celda, 0);
      celda = paso.guardCell;
      if (paso.ambush) break;
    }
    pasoAPaso.campWake(0);

    expect(rangosB).toEqual(rangosA);
    // …y NO por vacuidad: con `mover` el paseo gasta 2 tiradas por paso (moneda+dirección).
    expect(rangosA.filter((r) => r === "0..3")).toHaveLength(72); // 3 h × 12 pasos × 2
    // El reloj también coincide: las dos duermen las 3 h enteras.
    expect(pasoAPaso.state.time.hour).toBe(atomico.state.time.hour);
    expect(atomico.state.time.hour).toBe(11);
  });
});
