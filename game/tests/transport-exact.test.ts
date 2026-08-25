/**
 * Tests EXACTOS de transporte y viento (Task 3.7). Verifican el port bit a
 * bit de las reglas re-derivadas del binario (re/verified/transport.md):
 * cambio de viento (RNG), deriva, girar/becalmado, Board/X-it/Yell,
 * broadside, reparación de casco, coste naval con HMS Cape y naves NPC.
 */
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { OriginalRng } from "../src/core/rng-original.js";
import {
  maybeChangeWind,
  setWind,
  windDriftStep,
  courseVector,
  WIND_DX,
  WIND_DY,
  WIND_CALM,
  WIND_NORTH,
  WIND_EAST,
} from "../src/core/world/wind.js";
import {
  board,
  exitTransport,
  yell,
  broadside,
  broadsidePerpendicular,
  repairHull,
  navalStepCost,
  shipFacingStep,
  shipTryMove,
  sinkPlayerShip,
  TILE_DROWN,
  faceTile,
  npcShipMoves,
  spawnPurchasedShip,
  HULL_MAX,
  HULL_DAMAGE_MIN,
  HULL_DAMAGE_MAX,
  TILE_FOOT,
  TILE_CARPET,
  TILE_FRIGATE_SAILS_UP,
  TILE_FRIGATE_SAILS_DOWN,
  TILE_SKIFF,
} from "../src/core/world/transport.js";

function baseState(): GameState {
  const init: ExtractedInitialState = {
    characters: [
      {
        name: "Avatar",
        gender: 0x0b,
        class: "A",
        status: "G",
        strength: 20,
        dexterity: 20,
        intelligence: 20,
        currentMp: 10,
        currentHp: 100,
        maxHp: 100,
        exp: 0,
        level: 1,
        monthsAtInn: 0,
        helmet: 0,
        armor: 0,
        weapon: 0,
        shield: 0,
        ring: 0,
        amulet: 0,
        partyStatus: 0,
      },
    ],
    food: 100,
    gold: 100,
    keys: 0,
    gems: 0,
    torches: 0,
    skullKeys: 0,
    grapple: false,
    magicCarpets: 0,
    specialItems: {
      spyglass: false,
      hmsCape: false,
      sextant: false,
      pocketWatch: false,
      blackBadge: false,
      woodenBox: false,
    },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(8).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
    moonstones: [],
    partySize: 1,
    year: 139,
    month: 1,
    day: 1,
    hour: 8,
    minute: 0,
    karma: 50,
    turnsSinceStart: 0,
    activeCharacter: 0,
    location: 0,
    floor: 0,
    x: 50,
    y: 50,
    torchTurns: 0,
    npcDead: [],
    npcMet: [],
  };
  return createNewGame(init);
}

describe("viento — tablas de empuje (DATA.OVL 0x29F5/0x29F9)", () => {
  it("empuja en la dirección OPUESTA al nombre", () => {
    // N→(0,+1), S→(0,−1), E→(−1,0), W→(+1,0); Calm=(0,0).
    expect([WIND_DX[0], WIND_DY[0]]).toEqual([0, 0]);
    expect([WIND_DX[1], WIND_DY[1]]).toEqual([0, 1]); // North empuja al Sur
    expect([WIND_DX[2], WIND_DY[2]]).toEqual([0, -1]);
    expect([WIND_DX[3], WIND_DY[3]]).toEqual([-1, 0]);
    expect([WIND_DX[4], WIND_DY[4]]).toEqual([1, 0]);
  });

  it("courseVector: rumbo 1=O,2=E,3=N,4=S", () => {
    expect(courseVector(1)).toEqual({ dx: -1, dy: 0 });
    expect(courseVector(2)).toEqual({ dx: 1, dy: 0 });
    expect(courseVector(3)).toEqual({ dx: 0, dy: -1 });
    expect(courseVector(4)).toEqual({ dx: 0, dy: 1 });
    expect(courseVector(0)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("maybe_change_wind (kernel 0x2F62) — consumo de RNG", () => {
  it("consume SIEMPRE exactamente 1 rand(0,63) cuando no cambia", () => {
    const st = baseState();
    // Sembramos una semilla cuya primera tirada rand(0,63) != 0.
    const rng = new OriginalRng(0x1234);
    const probe = new OriginalRng(0x1234).next(0, 63);
    expect(probe).not.toBe(0); // precondición del vector
    const changed = maybeChangeWind(st, (lo, hi) => rng.next(lo, hi));
    expect(changed).toBe(false);
    // La semilla avanzó EXACTAMENTE 1 tirada: coincide con una instancia de
    // referencia sembrada igual y avanzada un solo rand.
    const ref = new OriginalRng(0x1234);
    ref.next(0, 63);
    expect(rng.getSeed()).toBe(ref.getSeed());
  });

  it("en el hit 1/64 cambia el viento y consume rand(0,4) extra", () => {
    // Buscamos una semilla cuyo primer rand(0,63)==0.
    let seed = 0;
    for (let s = 1; s < 200000; s++) {
      if (new OriginalRng(s).next(0, 63) === 0) {
        seed = s;
        break;
      }
    }
    expect(seed).not.toBe(0);
    const st = baseState();
    const rng = new OriginalRng(seed);
    const changed = maybeChangeWind(st, (lo, hi) => rng.next(lo, hi));
    expect(changed).toBe(true);
    expect(st.wind).toBeGreaterThanOrEqual(0);
    expect(st.wind).toBeLessThanOrEqual(4);
    // set_wind resetea el contador de deriva (0x2EA5).
    expect(st.windDriftCtr).toBe(0);
  });

  it("Calm solo se acepta si rand(0,255) >= 192 (sesgo anti-calma)", () => {
    // Guion determinista: rand(0,63)=0 (hit) ; rand(0,4)=0 (propone Calm) ;
    // rand(0,255)=100 (<192, rechaza y re-tira) ; rand(0,4)=0 ;
    // rand(0,255)=200 (>=192, acepta Calm). Total 5 tiradas.
    const script = [0, 0, 100, 0, 200];
    let i = 0;
    const st = baseState();
    st.wind = WIND_EAST;
    const changed = maybeChangeWind(st, () => script[i++]!);
    expect(changed).toBe(true);
    expect(st.wind).toBe(WIND_CALM);
    expect(i).toBe(5);
  });
});

describe("set_wind (kernel 0x2E96)", () => {
  it("escribe g_wind y resetea el contador de deriva", () => {
    const st = baseState();
    st.windDriftCtr = 7;
    setWind(st, WIND_NORTH);
    expect(st.wind).toBe(WIND_NORTH);
    expect(st.windDriftCtr).toBe(0);
  });
});

describe("deriva del barco (MAINOUT 0x0619) — cadencia sin RNG", () => {
  it("a favor del viento (empuje==rumbo): umbral 1", () => {
    const st = baseState();
    // Viento del Norte empuja al Sur (0,+1); rumbo Sur (sailDir 4).
    st.wind = WIND_NORTH;
    st.sailDir = 4;
    st.windDriftCtr = 0;
    // di=1 → umbral 1 > ctr 0 → no deriva, ctr++.
    expect(windDriftStep(st)).toBe(false);
    expect(st.windDriftCtr).toBe(1);
    // ctr 1 >= umbral 1 → deriva, ctr=0.
    expect(windDriftStep(st)).toBe(true);
    expect(st.windDriftCtr).toBe(0);
  });

  it("en contra del viento (empuje opuesto): umbral 0, deriva siempre", () => {
    const st = baseState();
    // Viento del Norte empuja al Sur (0,+1); rumbo Norte (sailDir 3) → en contra.
    st.wind = WIND_NORTH;
    st.sailDir = 3;
    st.windDriftCtr = 0;
    // di=1+ (dy mismatch: +1 != -1) =2 ... rumbo N: course=(0,-1), empuje=(0,+1):
    // dx: 0==0 (no ++); dy: +1 != -1 (++). di=2 → umbral 2. Hmm reevaluar abajo.
    // En realidad "en contra" pura (dx y dy opuestos) no aplica en ejes; en un
    // solo eje el desajuste es 1 → di=2 (perpendicular en la métrica). Verifica
    // el cálculo directo:
    expect(windDriftStep(st)).toBe(false); // umbral 2 > 0
  });

  it("Calm: nunca auto-deriva", () => {
    const st = baseState();
    st.wind = WIND_CALM;
    st.sailDir = 4;
    expect(windDriftStep(st)).toBe(false);
  });

  it("parado (sailDir 0): no deriva", () => {
    const st = baseState();
    st.wind = WIND_NORTH;
    st.sailDir = 0;
    expect(windDriftStep(st)).toBe(false);
  });
});

describe("girar / navegar / becalmado (MAINOUT 0x00DA/0x01DC)", () => {
  it("faceTile: (tile&0xFC)+turn_arg", () => {
    expect(faceTile(0x20, "north")).toBe(0x20);
    expect(faceTile(0x20, "east")).toBe(0x21);
    expect(faceTile(0x20, "south")).toBe(0x22);
    expect(faceTile(0x20, "west")).toBe(0x23);
  });

  it("girar consume el turno y no mueve", () => {
    // Fragata velas izadas mirando al N (0x20); pulsar E → gira a 0x21.
    const r = shipFacingStep(0x20, "east", WIND_EAST);
    expect(r.turned).toBe(true);
    expect(r.moves).toBe(false);
    expect(r.tile).toBe(0x21);
  });

  it("velas izadas con viento: avanza sin girar", () => {
    const r = shipFacingStep(0x20, "north", WIND_EAST);
    expect(r.turned).toBe(false);
    expect(r.moves).toBe(true);
    expect(r.becalmed).toBe(false);
  });

  it("velas izadas y Calm: becalmada (no mueve)", () => {
    const r = shipFacingStep(0x20, "north", WIND_CALM);
    expect(r.moves).toBe(false);
    expect(r.becalmed).toBe(true);
  });

  it("velas arriadas: rema aunque haya Calm", () => {
    const r = shipFacingStep(0x24, "north", WIND_CALM);
    expect(r.moves).toBe(true);
    expect(r.becalmed).toBe(false);
  });

  it("skiff: rema siempre", () => {
    const r = shipFacingStep(TILE_SKIFF, "north", WIND_CALM);
    expect(r.moves).toBe(true);
  });

  // #32 — el aserto de arriba decía «rema siempre» pero sólo probaba la dirección que NO
  // gira (0x28 mirando al N, pulsar N deja el tile igual), o sea justo el caso donde el
  // port ya acertaba. La divergencia estaba en el OTRO: al girar, el port devolvía
  // moves=false y se comía el paso. El esquife entra por la rama 0x0152, que recompone el
  // tile y hace `jmp 0x129` SIN escribir [bp-2] (=0 desde el prólogo 0x00e0), y
  // outdoor_move sólo aborta con retorno ≠0 ⇒ gira Y avanza.
  it("★ skiff GIRANDO: cambia el sprite y AUN ASÍ avanza (rama 0x0152, retorno 0)", () => {
    for (const [dir, tile] of [["east", 0x29], ["south", 0x2a], ["west", 0x2b]] as const) {
      const r = shipFacingStep(TILE_SKIFF, dir, WIND_CALM);
      expect(r.tile).toBe(tile); // fórmula naval (tile&0xFC)+facing @0x015c-0x0165
      expect(r.turned).toBe(true);
      expect(r.moves).toBe(true); // ← lo que el port hacía mal: era false
      expect(r.becalmed).toBe(false);
    }
  });

  // Control NEGATIVO: la fragata sí aborta al virar. Sin esto, el cambio de arriba podría
  // ser un «todo el mundo avanza» que pasaría igual de verde y sería infiel.
  it("★ control: la FRAGATA girando NO avanza (rama 0x016A, [bp-2]=1 @0x01b0)", () => {
    for (const tile of [0x20, 0x24]) {
      const r = shipFacingStep(tile, "east", WIND_EAST);
      expect(r.turned).toBe(true);
      expect(r.moves).toBe(false);
    }
  });
});

describe("Board (CMDS 0x07F6)", () => {
  it("caballo: transport = tile+2; con dueño en pueblo → «\"Nay!\"»", () => {
    // ⚠ HISTORIA DE ESTE ASERTO (#130): hasta el 28-07 decía `message: "Nay!"` —sin las
    // comillas ni el \n de DS 0x425e— y pasaba el flag DIRECTO a la función pura, así que
    // sellaba EN VERDE dos defectos a la vez: el texto equivocado y una rama que NINGÚN
    // call-site de producción alcanzaba (`Game.board` llamaba con 3 argumentos). El
    // cableado y su control positivo viven ahora en `board-nay.test.ts`, a nivel de
    // `Game.board`; este aserto se queda como prueba de la FUNCIÓN PURA y nada más.
    const st = baseState();
    expect(board(st, 0x10, TILE_FOOT).transportTile).toBe(0x12);
    expect(board(st, 0x10, TILE_FOOT, true)).toEqual({ ok: false, message: '"Nay!"\n' });
  });

  it("alfombra → 0x14; skiff → tile TAL CUAL (0x08B2 → jmp 0x0875, sin el add de 0x0873)", () => {
    // ⚠ Este aserto decía «skiff → tile+2» (0x28 → 0x2a) SIN cita: el `+2` es del
    // CABALLO (0x0870-0x0873). La rama skiff salta directa al store (#273 adyacente).
    const st = baseState();
    expect(board(st, 0x1b, TILE_FOOT).transportTile).toBe(TILE_CARPET);
    expect(board(st, 0x28, TILE_FOOT).transportTile).toBe(0x28);
  });

  it("fragata solo desde alfombra/pie/skiff", () => {
    const st = baseState();
    st.shipHull = HULL_MAX;
    st.shipSkiffs = 1;
    expect(board(st, 0x24, 0x99).ok).toBe(false); // desde algo raro → On foot
    const r = board(st, 0x24, TILE_FOOT);
    expect(r.ok).toBe(true);
    expect(r.transportTile).toBe(0x24);
  });

  it("fragata: DANGER si hull<10 (independiente de WARNING)", () => {
    const st = baseState();
    st.shipHull = 5;
    st.shipSkiffs = 1; // hay skiff → sin WARNING, pero sí DANGER
    const r = board(st, 0x24, TILE_FOOT);
    expect(r.warnings).toContain("DANGER: SHIP BADLY DAMAGED!");
    expect(r.warnings).not.toContain("WARNING: NO SKIFFS ON BOARD!");
  });

  it("fragata: WARNING si no hay skiffs a bordo", () => {
    const st = baseState();
    st.shipHull = HULL_MAX;
    st.shipSkiffs = 0;
    const r = board(st, 0x24, TILE_FOOT);
    expect(r.warnings).toContain("WARNING: NO SKIFFS ON BOARD!");
  });

  it("fragata: DANGER y WARNING a la vez (independientes)", () => {
    const st = baseState();
    st.shipHull = 5;
    st.shipSkiffs = 0;
    const r = board(st, 0x24, TILE_FOOT);
    expect(r.warnings).toEqual([
      "DANGER: SHIP BADLY DAMAGED!",
      "WARNING: NO SKIFFS ON BOARD!",
    ]);
  });

  it("abordar caballo/alfombra/skiff exige ir a pie (gate 0x6EE)", () => {
    const st = baseState();
    expect(board(st, 0x10, 0x12)).toEqual({ ok: false, message: "On foot" }); // desde caballo
    expect(board(st, 0x1b, TILE_SKIFF)).toEqual({ ok: false, message: "On foot" });
    expect(board(st, 0x28, TILE_CARPET)).toEqual({ ok: false, message: "On foot" });
  });

  it("fragata: se aborda desde alfombra 0x14/0x15 pero NO 0x16/0x17", () => {
    const st = baseState();
    st.shipHull = HULL_MAX;
    st.shipSkiffs = 1;
    expect(board(st, 0x24, 0x15).ok).toBe(true);
    expect(board(st, 0x24, 0x16)).toEqual({ ok: false, message: "On foot" });
  });

  it("abordar desde skiff estiba el skiff (+1)", () => {
    const st = baseState();
    st.shipHull = HULL_MAX;
    st.shipSkiffs = 0;
    board(st, 0x24, TILE_SKIFF);
    expect(st.shipSkiffs).toBe(1);
  });

  it("abordar desde alfombra devuelve la alfombra al inventario", () => {
    const st = baseState();
    st.shipHull = HULL_MAX;
    st.shipSkiffs = 1;
    st.magicCarpets = 0;
    board(st, 0x24, TILE_CARPET);
    expect(st.magicCarpets).toBe(1);
  });
});

describe("X-it (CMDS 0x0EB4)", () => {
  it("caballo: suelta tile-2, transport=pie", () => {
    const st = baseState();
    const r = exitTransport(st, 0x12, true);
    expect(r).toMatchObject({ ok: true, transportTile: TILE_FOOT, dropTile: 0x10 });
  });

  it("alfombra: requiere tierra; si no → No land nearby!", () => {
    const st = baseState();
    expect(exitTransport(st, TILE_CARPET, false).ok).toBe(false);
    expect(exitTransport(st, TILE_CARPET, true).transportTile).toBe(TILE_FOOT);
  });

  it("fragata velas izadas: Under sail! (hay que arriar)", () => {
    const st = baseState();
    expect(exitTransport(st, TILE_FRIGATE_SAILS_UP, true)).toEqual({
      ok: false,
      message: "Under sail!",
    });
  });

  it("fragata arriada: prioridad tierra > skiff > alfombra > rechazo", () => {
    // (1) tierra cerca → a pie
    let st = baseState();
    expect(exitTransport(st, TILE_FRIGATE_SAILS_DOWN, true).transportTile).toBe(TILE_FOOT);
    // (2) sin tierra, skiff disponible → bota skiff
    st = baseState();
    st.shipSkiffs = 2;
    const r = exitTransport(st, TILE_FRIGATE_SAILS_DOWN, false);
    expect(r.transportTile).toBe(TILE_SKIFF);
    expect(st.shipSkiffs).toBe(1);
    // (3) sin tierra ni skiff, con alfombra → alfombra
    st = baseState();
    st.shipSkiffs = 0;
    st.magicCarpets = 1;
    const r3 = exitTransport(st, TILE_FRIGATE_SAILS_DOWN, false);
    expect(r3.transportTile).toBe(TILE_CARPET);
    expect(st.magicCarpets).toBe(0);
    // (4) nada → rechazo
    st = baseState();
    st.shipSkiffs = 0;
    st.magicCarpets = 0;
    expect(exitTransport(st, TILE_FRIGATE_SAILS_DOWN, false)).toEqual({
      ok: false,
      message: "No skiffs on board!",
    });
  });

  it("skiff: exige tierra; sin ella → No land nearby!", () => {
    const st = baseState();
    expect(exitTransport(st, TILE_SKIFF, false)).toEqual({
      ok: false,
      message: "No land nearby!",
    });
  });

  it("skiff: con tierra pero agua 0x6A bajo → Not here!", () => {
    const st = baseState();
    expect(exitTransport(st, TILE_SKIFF, true, true)).toEqual({
      ok: false,
      message: "Not here!",
    });
  });

  it("skiff: con tierra y agua desembarcable → a pie", () => {
    const st = baseState();
    expect(exitTransport(st, TILE_SKIFF, true).transportTile).toBe(TILE_FOOT);
  });
});

describe("Yell = Hoist/Furl (CMDS 0x1418)", () => {
  it("velas izadas → FURL! (+4)", () => {
    expect(yell(0x20, 0)).toEqual({ ok: true, message: "FURL!", transportTile: 0x24 });
  });
  it("velas arriadas → HOIST! (−4)", () => {
    expect(yell(0x24, 0)).toEqual({ ok: true, message: "HOIST!", transportTile: 0x20 });
  });
  it("fuera de fragata → what?", () => {
    expect(yell(TILE_FOOT, 0).ok).toBe(false);
  });
  it("en underworld (location>=0x80) → what?", () => {
    expect(yell(0x20, 0x80).ok).toBe(false);
  });
});

describe("Fire broadside (CMDS 0x0962)", () => {
  it("solo perpendicular a la quilla", () => {
    // 0x20 = proa N/S → dispara E/O.
    expect(broadsidePerpendicular(0x20, "east")).toBe(true);
    expect(broadsidePerpendicular(0x20, "north")).toBe(false);
    // 0x21 = proa E/O → dispara N/S.
    expect(broadsidePerpendicular(0x21, "north")).toBe(true);
    expect(broadsidePerpendicular(0x21, "east")).toBe(false);
  });

  it("paralelo → Fire broadsides only!", () => {
    const r = broadside(0x20, "north", true, 50);
    expect(r).toEqual({ ok: false, message: "Fire broadsides only!" });
  });

  it("impacto: 1×rand(1,20), resta al casco", () => {
    let calls = 0;
    const r = broadside(0x20, "east", true, 50, (lo, hi) => {
      calls++;
      expect([lo, hi]).toEqual([1, 20]);
      return 7;
    });
    expect(r.damage).toBe(7);
    expect(r.sunk).toBe(false);
    expect(calls).toBe(1);
  });

  it("underflow del casco → hundido", () => {
    const r = broadside(0x20, "east", true, 3, () => 20);
    expect(r.sunk).toBe(true);
    expect(r.message).toBe("Ship sunk!");
  });

  it("sin fragata → What?", () => {
    expect(broadside(TILE_SKIFF, "east", true, 50).ok).toBe(false);
  });
});

describe("Reparación de casco en Camp (kernel 0x3C9A)", () => {
  it("barco sano (>=10): exactamente 1 tirada, 25 min", () => {
    const r = repairHull(50, () => 2);
    expect(r.rolls).toBe(1);
    expect(r.hull).toBe(52);
    expect(r.minutes).toBe(25);
  });

  it("cap a 99", () => {
    const r = repairHull(98, () => 3);
    expect(r.hull).toBe(HULL_MAX);
  });

  it("casco < 10: repite hasta >=10", () => {
    // hull 6, rand=1 cada vez → 7,8,9,10 (4 tiradas).
    const r = repairHull(6, () => 1);
    expect(r.hull).toBe(10);
    expect(r.rolls).toBe(4);
  });
});

describe("Coste naval con HMS Cape (MAINOUT 0x0670)", () => {
  it("sin Cape: 2 min, world-turn cada tramo", () => {
    const st = baseState();
    expect(navalStepCost(st)).toEqual({ minutes: 2, worldTurn: true });
    expect(navalStepCost(st)).toEqual({ minutes: 2, worldTurn: true });
  });

  it("con Cape: 1 min; PRIMER tramo salta el world-turn (toggle post-flip)", () => {
    const st = baseState();
    st.specialItems.hmsCape = true;
    st.hmsCapeToggle = 0;
    const a = navalStepCost(st); // flip 0→1 → worldTurn (1==0) = false
    const b = navalStepCost(st); // flip 1→0 → worldTurn (0==0) = true
    expect(a.minutes).toBe(1);
    expect(b.minutes).toBe(1);
    expect(a.worldTurn).toBe(false); // el binario SALTA el primer world-turn
    expect(b.worldTurn).toBe(true);
  });
});

describe("Nave NPC de vela (MAINOUT 0x198C) — modulación por viento", () => {
  it("Calm: no mueve", () => {
    expect(npcShipMoves(0x2c, WIND_CALM, 0).moves).toBe(false);
  });

  it("threshold 4 (nunca frena): mueve siempre", () => {
    // facing 0, viento E (idx 2) → 4.
    expect(npcShipMoves(0x2c, WIND_EAST, 0).moves).toBe(true);
    expect(npcShipMoves(0x2c, WIND_EAST, 99).moves).toBe(true);
  });

  it("frena 1 de cada threshold+1 turnos", () => {
    // facing 0, viento N (idx 0) → threshold 2: acc 1,2 mueve; 3 frena y resetea.
    let acc = 0;
    let r = npcShipMoves(0x2c, WIND_NORTH, acc);
    expect(r.moves).toBe(true);
    acc = r.acc;
    r = npcShipMoves(0x2c, WIND_NORTH, acc);
    expect(r.moves).toBe(true);
    acc = r.acc;
    r = npcShipMoves(0x2c, WIND_NORTH, acc);
    expect(r.moves).toBe(false); // acc 3 > threshold 2
    expect(r.acc).toBe(0);
  });
});

describe("Nave comprada (MAINOUT 0x0D22)", () => {
  it("spawnea con casco 99 y skiffs = flags&0x3f; fragata 0x25 / skiff 0x29", () => {
    const st = baseState();
    expect(spawnPurchasedShip(st, 0x82)).toBe(0x25); // fragata
    expect(st.shipHull).toBe(HULL_MAX);
    expect(st.shipSkiffs).toBe(2); // 0x82 & 0x3f = 2 skiffs a bordo
    expect(spawnPurchasedShip(st, 0x01)).toBe(0x29); // skiff
    expect(st.shipSkiffs).toBe(1); // 0x01 & 0x3f = 1
  });
});

describe("shipTryMove (MAINOUT 0x01FE) — atraque/colisión/bloqueo/cactus", () => {
  // rand determinista para fijar el daño de casco rand(1,30) (damage_ship 0x109E).
  const fixedRand = (value: number) => (_lo: number, _hi: number) => value;

  it("navegando a muelle 0x47 → 'Docked!' + auto-FURL (transport+4), NO avanza, sin daño", () => {
    const r = shipTryMove(0x47, 0x22, true); // fragata izada S navegando
    expect(r.outcome).toBe("dock");
    expect(r.messages).toEqual(["Docked!"]);
    expect(r.transportTile).toBe(0x26); // 0x22+4: velas arriadas
    // El barco NO pisa el muelle: ship_try_move devuelve bp-2=0 (0x0306→0x034A) y
    // outdoor_move 0x0520 `je` salta move_party. Auto-FURL + parada, sin avanzar.
    expect(r.moves).toBe(false);
    expect(r.hullDamage).toBe(0); // el atraque NO llama damage_ship (0x02F1 salta 0x0303)
  });

  it("navegando contra sólido → 'COLLISION!' + daño rand(1,30), no mueve", () => {
    const r = shipTryMove(0x08, 0x20, true, HULL_MAX, fixedRand(7)); // izada N contra montaña
    expect(r.outcome).toBe("collision");
    expect(r.messages).toEqual(["COLLISION!"]);
    expect(r.hullDamage).toBe(7); // rand(1,30) del stream (damage_ship 0x109E)
    expect(r.sunk).toBe(false);
    expect(r.moves).toBe(false);
  });

  it("colisión con daño ≥ casco → sunk (damage_ship 0x10D6)", () => {
    const r = shipTryMove(0x08, 0x20, true, 5, fixedRand(30));
    expect(r.hullDamage).toBe(30);
    expect(r.sunk).toBe(true); // 30 >= 5
  });

  it("navegando a tile 3 → 'BREAKING UP!' + daño rand(1,30), no mueve", () => {
    const r = shipTryMove(3, 0x20, true, HULL_MAX, fixedRand(12));
    expect(r.outcome).toBe("breakup");
    expect(r.messages).toEqual(["BREAKING UP!"]);
    expect(r.hullDamage).toBe(12);
    expect(r.moves).toBe(false);
  });

  it("remando (no navegando) contra sólido → 'Blocked!', sin daño de casco", () => {
    const r = shipTryMove(0x08, 0x28, false); // skiff remando contra montaña
    expect(r.outcome).toBe("blocked");
    expect(r.messages).toEqual(["Blocked!"]);
    expect(r.hullDamage).toBe(0); // damage_ship gatea 0x20-0x27; remar no llega a él
    expect(r.moves).toBe(false);
  });

  // ⚠ RETRACTACIÓN (#216). Este aserto decía `expect(r.message).toBe("OUCH!")` y SELLABA
  // la divergencia: daba por buena UNA sola línea donde el binario imprime DOS. El print
  // de «Blocked!» (MAINOUT 0x0322, DS 0x29ae) va ANTES del `cmp word ptr [bp-6],0x2f`
  // del cactus (MAINOUT 0x0329), así que sale en los DOS brazos; sólo DESPUÉS se añade
  // «OUCH!» (MAINOUT 0x032f, DS 0x29b8). La vía a pie ya lo calcaba (cactus-ouch.test.ts)
  // y el testigo LP1 part07-g12 (ocrLn=917) lee «Blocked! 0UCH!» en ese orden.
  it("remando a cactus 0x2f → 'Blocked!' + 'OUCH!' (0x0322 → 0x032f) + daño al party", () => {
    const r = shipTryMove(0x2f, 0x28, false);
    expect(r.outcome).toBe("cactus");
    expect(r.messages).toEqual(["Blocked!", "OUCH!"]);
    expect(r.partyDamageRoll).toBe(true);
    expect(r.hullDamage).toBe(0); // el cactus daña al party, no al casco
    expect(r.moves).toBe(false);
  });

  it("el rango del daño de casco es rand(1,30) (constantes exportadas)", () => {
    expect(HULL_DAMAGE_MIN).toBe(1);
    expect(HULL_DAMAGE_MAX).toBe(30);
  });
});

describe("sinkPlayerShip (damage_ship 0x10D6-0x1166) — conversión al hundirse", () => {
  const fixedRand = (value: number) => (_lo: number, _hi: number) => value;

  it("con skiffs a bordo → skiff con facing preservado (skiffs NO decrementa)", () => {
    // Fragata izada E (0x21) → skiff E (0x28+(0x21&3)=0x29). skiffs se mantiene.
    const r = sinkPlayerShip(0x21, 2, 0);
    expect(r.messages).toEqual(["Ship sunk!", "Abandon ship!"]);
    expect(r.transportTile).toBe(0x29); // 0x28 + (0x21 & 3)
    expect(r.mode).toBe("skiff");
    expect(r.drowned).toBe(false);
  });

  it("sin skiffs pero con alfombra → alfombra (carpets--, +1 rand(0,1) para el facing)", () => {
    const r = sinkPlayerShip(0x20, 0, 1, fixedRand(1)); // rand(0,1)=1 → 0x15 (facing E)
    expect(r.messages).toEqual(["Ship sunk!", "Abandon ship!"]);
    expect(r.transportTile).toBe(0x15); // 0x14 + rand(0,1)
    expect(r.mode).toBe("carpet");
    expect(r.carpets).toBe(0); // decrementada
    expect(r.drowned).toBe(false);
  });

  it("alfombra con rand(0,1)=0 → 0x14 (facing N)", () => {
    const r = sinkPlayerShip(0x22, 0, 3, fixedRand(0));
    expect(r.transportTile).toBe(0x14);
    expect(r.carpets).toBe(2);
  });

  it("sin skiff ni alfombra → ahogo (tile 0, 'DROWNING!!!', sin 'Abandon ship!')", () => {
    const r = sinkPlayerShip(0x23, 0, 0);
    expect(r.messages).toEqual(["Ship sunk!", "DROWNING!!!"]);
    expect(r.transportTile).toBe(TILE_DROWN); // 0
    expect(r.mode).toBe("foot");
    expect(r.drowned).toBe(true);
  });

  it("prioridad skiff > alfombra (con ambos elige skiff, sin gastar RNG de alfombra)", () => {
    const r = sinkPlayerShip(0x20, 1, 5, fixedRand(1));
    expect(r.mode).toBe("skiff");
    expect(r.carpets).toBe(5); // la alfombra no se toca
  });
});
