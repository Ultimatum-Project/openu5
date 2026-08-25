/**
 * Determinismo del stream vivo (Fase 1.1, Task 1): `reseed()` sustituye al viejo
 * `setEncounterRng`. El juego ya NO tiene tres fuentes de RNG separadas; consume
 * un único `OriginalRng` vivo (game.ts liveRng). El test NO se debilita: pasa de
 * contar llamadas a un fn inyectado a exigir determinismo end-to-end (dos Games
 * con la misma semilla y las mismas acciones acaban en el MISMO estado), que es
 * la propiedad de fidelidad real (deliberate-divergences §2). Reglas de RNG puras
 * en tests/loops.test.ts; cableado de bucles en tests/loops-integration.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { DoorManager, DOOR_TILES } from "../src/core/world/doors.js";

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar(), makeChar({ name: "Iolo" })],
    partySize: 2,
    activeCharacter: 0,
    food: 100,
    // hora 2 (noche 00:00-04:59) sobre tile montaña → spawn_threshold máximo (5).
    time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 2,
  };
  return { ...base, ...over } as GameState;
}

/** Overworld de tile montaña (9) bajo la party → base 2 del spawn_threshold. */
function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 9),
  );
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };

/** combatResources mínimo: basta con que exista para entrar en el bloque de spawn. */
const combatResources: CombatResources = {
  combatMaps: [],
  enemyDefs: [],
  attackValues: [],
  attackRangeValues: [],
  defenseValues: [],
};

function makeGame(s: GameState = makeState()): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, s, {
    combatResources,
  });
}

describe("Game.reseed (determinismo del stream vivo)", () => {
  /** Overworld 256×256 de hierba (5, walkable) para que los pasos avancen. */
  function grassWorld(): WorldData {
    const overworld = Array.from({ length: 256 }, () =>
      Array.from({ length: 256 }, () => 5),
    );
    return { overworld, underworld: overworld, smallMaps: new Map() };
  }
  const grassGame = (over: Partial<GameState> = {}): Game =>
    new Game({} as ExtractedInitialState, grassWorld(), gameData, makeState(over), {
      combatResources,
    });

  it("dos Games con la misma semilla y las mismas acciones acaban en el mismo estado", () => {
    const snapshot = (g: Game): string =>
      JSON.stringify({
        pos: g.state.position,
        hour: g.state.time.hour,
        min: g.state.time.minute,
        gold: g.state.gold,
        hp: g.state.characters.map((c) => c.currentHp),
        turns: g.state.turnsSinceStart,
      });
    const play = (seed: number): string => {
      const g = grassGame({ food: 0 }); // comida 0 → Starving! ejercita el housekeeping
      g.reseed(seed);
      for (let i = 0; i < 30; i++) g.move(i % 2 ? "east" : "south");
      return snapshot(g);
    };
    // Reproducible: misma semilla ⇒ misma órbita (viento→housekeeping→spawn, todo
    // por el mismo OriginalRng vivo). Es la aceptación (d) del contrato de F.2.
    expect(play(4242)).toBe(play(4242));
  });

  it("el stream vivo alimenta el housekeeping (comida 0 daña con la misma seed)", () => {
    const game = grassGame({ food: 0 });
    game.reseed(777);
    const hp0 = game.state.characters[0]!.currentHp;
    for (let i = 0; i < 40; i++) game.move(i % 2 ? "north" : "west");
    // Con comida 0, el hambre (rand(1,8)/miembro en cada cambio de hora) reduce HP;
    // el daño lo tira el stream vivo, no una fuente aparte.
    expect(game.state.characters[0]!.currentHp).toBeLessThan(hp0);
  });
});

describe("Game.open — tile real vía base+overrides, SIN sustituto de puerta-abierta", () => {
  // Regresión detectada en la review de #47: al pasar open() a leer `activeMap`
  // (que aplica `doors.effectiveTile`), reabrir una puerta ya abierta dentro de su
  // ventana de N turnos leía el sustituto de suelo (68) y daba "Nothing to open!"
  // en vez de "Opened!"+refresh. `Game.open()` nunca tuvo cobertura por el pipeline
  // real (npc.test sólo prueba DoorManager.open() aislado). El fix: open() lee
  // base+mapOverrides sin effectiveTile (`mapTileWithOverrides`).
  const REGULAR_DOOR = DOOR_TILES.regular; // 184 / 0xB8

  /** Overworld de hierba (5, walkable) con una puerta regular en (px+1, py). */
  function doorWorld(px: number, py: number): WorldData {
    const overworld = Array.from({ length: 256 }, () =>
      Array.from({ length: 256 }, () => 5),
    );
    overworld[py]![px + 1] = REGULAR_DOOR; // vecino ESTE de la party
    return { overworld, underworld: overworld, smallMaps: new Map() };
  }
  const doorGame = (world: WorldData): Game =>
    new Game({} as ExtractedInitialState, world, gameData, makeState({ food: 100 }), {
      combatResources,
      doors: new DoorManager(),
    });

  const opened = (evs: ReturnType<Game["open"]>): boolean =>
    evs.some((e) => e.kind === "message" && e.text === "Opened!");
  const nothing = (evs: ReturnType<Game["open"]>): boolean =>
    evs.some((e) => e.kind === "message" && e.text === "Nothing to open!");

  it("reabrir una puerta ya abierta refresca (sigue dando 'Opened!', no 'Nothing to open!')", () => {
    const g = doorGame(doorWorld(100, 100)); // party en (100,100), puerta ESTE (101,100)
    const first = g.open("east");
    expect(opened(first)).toBe(true);
    // La puerta sigue abierta (effectiveTile=68) pero open() lee el tile REAL (184):
    // vuelve a "Opened!" y openAt refresca turnsLeft — NO "Nothing to open!".
    const second = g.open("east");
    expect(opened(second)).toBe(true);
    expect(nothing(second)).toBe(false);
  });

  it("open() ve una puerta que sólo existe en una capa de override, NO en el mapa base (#47)", () => {
    // Base ESTE = hierba (5, sin puerta); la puerta sólo existe en una capa por encima.
    // ⚠ La premisa original decía «simula Search(reveal)→Jimmy(destrabar)»: eso ya NO es
    // cierto — desde #119 tanda 2 esas dos mecánicas escriben en el canal VOLÁTIL de
    // terreno (son escrituras por el puntero de tile_addr en el binario), no en
    // `mapOverrides`. Lo que este test cubre es que `open()` lee POR ENCIMA del mapa
    // base; se ejercitan las DOS capas para que ninguna se quede sin cubrir.
    const g = doorGame(doorWorld(200, 200));
    g.state.position.x = 50;
    g.state.position.y = 50; // celda base SIN puerta
    g.setMapOverride(51, 50, REGULAR_DOOR);
    expect(opened(g.open("east"))).toBe(true);
  });

  it("open() ve una puerta del canal VOLÁTIL de terreno (lo que Search+Jimmy producen hoy, #119)", () => {
    const g = doorGame(doorWorld(200, 200));
    g.state.position.x = 50;
    g.state.position.y = 50;
    g.setVolatileTerrain(51, 50, REGULAR_DOOR);
    expect(opened(g.open("east"))).toBe(true);
    expect(Object.keys(g.state.mapOverrides ?? {})).toEqual([]); // no tocó lo persistido
  });
});

describe("Camp / Hole-up (H) — kernel_camp_holeup 0x3C9A", () => {
  const msgs = (evs: ReturnType<Game["camp"]>): string[] =>
    evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

  it("contexto a pie sobre hierba → ok (no barco)", () => {
    const g = makeGame(); // party en tile 9 (montaña, no agua) a pie
    expect(g.campContext()).toEqual({ ok: true, ship: false });
  });

  it("contexto sobre agua (tile 1..3) → 'On land or ship!'", () => {
    const g = makeGame(); // party en (100,100)
    g.setMapOverride(100, 100, 2); // agua bajo la party (tile 2)
    expect(g.campContext()).toEqual({ ok: false, message: "On land or ship!\n\n" });
  });

  it("contexto en vehículo no-barco (a caballo) → 'On foot!'", () => {
    const st = makeState({ transport: "horse" });
    const g = makeGame(st);
    expect(g.campContext()).toEqual({ ok: false, message: "On foot!\n" });
  });

  it("contexto DENTRO de pueblo/castillo (loc 0x01-0x20) → 'Hole up- Only in bed!' (inTown)", () => {
    // Bug reportado: el port permitía acampar dentro de un sitio. El original (kernel 0x3288)
    // sólo llama a camp con g_location==0 o >0x20; para 0x01-0x20 imprime "Hole up- Only in
    // bed!" (0xa170+0xa17a) y cobra turno. Comprobado a pie en un dwelling.
    const g = makeGame(makeState({ position: { location: 1, floor: 0, x: 15, y: 15 } }));
    g.setMapOverride(15, 15, 0x44); // suelo (no cama) bajo la party
    expect(g.campContext()).toEqual({ ok: false, message: "Hole up- Only in bed!\n", inTown: true });
  });

  it("mismo dwelling en el LÍMITE loc 0x20 → sigue rechazando en pueblo", () => {
    const g = makeGame(makeState({ position: { location: 0x20, floor: 0, x: 15, y: 15 } }));
    g.setMapOverride(15, 15, 0x44); // suelo (no cama)
    expect(g.campContext()).toEqual({ ok: false, message: "Hole up- Only in bed!\n", inTown: true });
  });

  it("DENTRO de pueblo SOBRE una cama (tile 0xAB LeftBed) → dormir en cama (bed:true), NO rechazo", () => {
    // Bug del fix del gate: rechazaba TODO en pueblo, incluida la cama. El original
    // (0x329c 0x32b9 `cmp 0xab; je`) sobre LeftBed → dormir (CMDS 0x0552). Reportado por
    // el usuario ("no me deja dormir en cama"). 0xAB es LeftBed, NO casco de barco.
    const g = makeGame(makeState({ position: { location: 1, floor: 0, x: 15, y: 15 } }));
    g.setMapOverride(15, 15, 0xab); // LeftBed bajo la party
    expect(g.campContext()).toEqual({ ok: true, ship: false, bed: true });
  });

  it("bedSleep pasa N horas SIN curación (0x0552 no llama al helper 0x0400) + 'Zzzzzzz...'", () => {
    const g = makeGame(makeState({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, prevHour: 2 }));
    g.state.characters[0]!.currentHp = 10;
    g.state.characters[0]!.maxHp = 50;
    const evs = g.bedSleep(3);
    expect(msgs(evs)).toContain("Zzzzzzz...\n");
    expect(g.state.time.hour).toBe(5); // 2 + 3 horas
    expect(g.state.characters[0]!.currentHp).toBe(10); // dormir en cama NO cura
  });

  it("el rechazo de pueblo SÍ cobra turno (0x31ee, [bp-2]=1 por defecto)", () => {
    const st = makeState({
      position: { location: 1, floor: 0, x: 15, y: 15 },
      time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, prevHour: 2,
    });
    const g = makeGame(st);
    const evs = g.campReject("Hole up- Only in bed!\n");
    expect(msgs(evs)).toContain("Hole up- Only in bed!\n");
    expect(g.state.time.minute).toBeGreaterThan(0); // turno de pueblo cobrado
  });

  it("el rechazo de contexto SÍ cobra el turno (0x3ee5) — el reloj avanza", () => {
    const st = makeState({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, prevHour: 2 });
    const g = makeGame(st);
    const evs = g.campReject("On foot!\n");
    expect(msgs(evs)).toContain("On foot!\n");
    // runContextTurn cobra el coste de exterior (2 min) → el reloj avanza.
    expect(g.state.time.minute).toBeGreaterThan(0);
  });

  it("camp(N) hace pasar N horas de reloj y emite 'Party rested!' (Zzzzzz una vez)", () => {
    const st = makeState({ time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 }, prevHour: 2 });
    const g = makeGame(st);
    g.reseed(1234);
    const evs = g.camp(3, -1);
    expect(g.state.time.hour).toBe(5); // 2 + 3 horas
    expect(g.state.time.minute).toBe(0);
    expect(msgs(evs)).toContain("Party rested!\n");
    // La curación (helper 0x0400) corre UNA vez por acampada → un solo "Zzzzzz...".
    expect(msgs(evs).filter((m) => m === "Zzzzzz...\n\n")).toHaveLength(1);
  });

  it("camp cura a la party dañada (HP sube) salvo al de guardia", () => {
    const st = makeState({
      // exp 150 = coherente con nivel 2 (levelForExp(150)=2) → el camp NO sube de
      // nivel, aislando la curación (rand 1,63) y el skip del de guardia.
      characters: [
        makeChar({ currentHp: 10, maxHp: 99, level: 2, exp: 150 }),
        makeChar({ name: "Iolo", currentHp: 10, maxHp: 99, level: 2, exp: 150 }),
      ],
      partySize: 2,
    });
    const g = makeGame(st);
    g.reseed(2); // seed 2 → el gate del 25% NO cruza (aísla el heal parcial 0x046e + skip guardia)
    // camp(1): N−1 = 0 rolls de emboscada (CMDS 0x021d) → el stream que llega al
    // helper 0x0400 es idéntico al pre-#8, así la semilla original sigue válida.
    g.camp(1, 1); // miembro 1 = guardia
    expect(g.state.characters[0]!.currentHp).toBeGreaterThan(10); // curado (heal parcial)
    expect(g.state.characters[1]!.currentHp).toBe(10); // guardia: intacto (sin aparición)
  });

  it("camp CON evento (gate<25) sube de nivel + cura + 'An apparition!' (OUTSUBS 0x0658)", () => {
    // Avatar con exp para nivel 3 (250 → floor/100=2 → nivel 3). El level-up ocurre AL
    // ACAMPAR y SÓLO dentro de la aparición gateada al 25% (no en el diálogo de LB).
    const st = makeState({
      characters: [makeChar({ level: 2, exp: 250, currentHp: 10, maxHp: 60 })],
      partySize: 1,
      time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
      prevHour: 2,
    });
    const g = makeGame(st);
    g.reseed(1); // seed 1 → el gate del 25% CRUZA → corre camp_results (la aparición)
    // camp(1): 0 rolls de emboscada (N−1=0) → mismo stream al helper 0x0400 que pre-#8.
    const evs = g.camp(1, -1);
    const out = msgs(evs);
    expect(g.state.characters[0]!.level).toBe(3); // subió al acampar
    expect(g.state.characters[0]!.maxHp).toBe(90); // 30·3 SET
    expect(g.state.characters[0]!.currentHp).toBe(90); // cura a tope del nuevo nivel
    expect(out).toContain("An apparition!\n"); // apertura de la aparición
    expect(out.some((m) => m.includes("Thou art now level 3, and"))).toBe(true);
  });

  it("camp CON evento pero SIN exp: aparición cura+status='G' pero SIN arenga de level-up", () => {
    // Gate cruza (aparición) pero exp insuficiente → "An apparition!" y cura total,
    // sin "Hail"/level-up. Envenenado → la aparición lo cura a 'G' (0x0828).
    const st = makeState({
      characters: [makeChar({ level: 2, exp: 150, status: "P", currentHp: 20, maxHp: 60 })],
      partySize: 1,
      time: { year: 139, month: 4, day: 7, hour: 2, minute: 0 },
      prevHour: 2,
    });
    const g = makeGame(st);
    g.reseed(1); // seed 1 → el gate CRUZA
    // camp(1): 0 rolls de emboscada (N−1=0) → mismo stream al helper 0x0400 que pre-#8.
    const out = msgs(g.camp(1, -1));
    expect(out).toContain("An apparition!\n");
    expect(g.state.characters[0]!.level).toBe(2); // sin cambio de nivel
    expect(g.state.characters[0]!.currentHp).toBe(60); // cura total de la aparición
    expect(g.state.characters[0]!.status).toBe("G"); // veneno curado
    expect(out.some((m) => m.includes("Thou art now level"))).toBe(false); // sin arenga
  });

  it("camp SIN evento (gate>=25): nada de aparición, pero el rand del gate se consume igual", () => {
    const st = makeState({
      characters: [makeChar({ level: 2, exp: 150 })], // floor(150/100)=1 → sigue nivel 2
      partySize: 1,
    });
    const g = makeGame(st);
    g.reseed(2); // seed 2 → el gate NO cruza
    const before = g.liveSeed();
    const out = msgs(g.camp(2, -1));
    expect(g.state.characters[0]!.level).toBe(2);
    expect(out).not.toContain("An apparition!\n");
    // El gate (rand(0,99)) se tira igual aunque no cruce → el stream vivo avanzó.
    expect(g.liveSeed()).not.toBe(before);
  });

  it("campWatchCount cuenta despiertos (G/P), no dormidos/muertos", () => {
    const st = makeState({
      characters: [
        makeChar({ status: "G" }),
        makeChar({ status: "P" }),
        makeChar({ status: "S" }),
        makeChar({ status: "D" }),
      ],
      partySize: 4,
    });
    const g = makeGame(st);
    expect(g.campWatchCount()).toBe(2); // G + P
  });
});

describe("Game.checkMoongate — hook de PRESENTACIÓN del cruce", () => {
  /** Overworld de hierba (5, walkable) para que el paso avance. */
  function grassWorld(): WorldData {
    const overworld = Array.from({ length: 256 }, () =>
      Array.from({ length: 256 }, () => 5),
    );
    return { overworld, underworld: overworld, smallMaps: new Map() };
  }

  it("pisar una moongate activa de noche llama al hook ANTES de teleportar (party aún en el origen)", () => {
    const moonPhases = new Array(56).fill(0x30); // día 7 → Felucca 0 (bytes 0x30)
    const gd: GameData = {
      locationsX: [],
      locationsY: [],
      locationNames: [],
      moonPhases,
    };
    const moonstones = [
      { x: 50, y: 50, z: 0, buried: true, location: 0 }, // fase 0 (activa día 7 madrugada) → DESTINO
      { x: 101, y: 100, z: 0, buried: true, location: 0 }, // fase 1: la puerta que se PISA (al este)
      ...Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0, buried: false, location: 0 })),
    ];
    const st = makeState({
      position: { location: 0, floor: 0, x: 100, y: 100 },
      moonstones,
    });
    const g = new Game({} as ExtractedInitialState, grassWorld(), gd, st, {
      combatResources,
    });
    // El hook se dispara cuando el party YA está sobre la puerta (101,100) y aún NO
    // ha teleportado: capturamos la posición vista por el hook.
    let seenAtHook: { x: number; y: number } | null = null;
    g.setMoongateTransitHook(() => {
      seenAtHook = { x: g.state.position.x, y: g.state.position.y };
    });
    g.move("east"); // pisa la moongate → hook → teleport
    expect(seenAtHook).toEqual({ x: 101, y: 100 }); // origen (sobre la puerta), pre-teleport
    expect(g.state.position).not.toMatchObject({ x: 101, y: 100 }); // teleportó
  });

  it("edge de medianoche (00:00-00:09): anima el cierre (hook con teleport=false) pero NO teleporta", () => {
    // kernel_moongate_enter 0x48a8: la disolución+cierre (0x1068/0x4912-0x492b) corre
    // ANTES del check 0x494d; sólo el teleport (0x47f4) queda tras el gate. Antes el
    // port salía por el edge ANTES del hook → no animaba nada. Ahora sí.
    const moonPhases = new Array(56).fill(0x30); // día 7 → Felucca 0
    const gd: GameData = {
      locationsX: [],
      locationsY: [],
      locationNames: [],
      moonPhases,
    };
    const moonstones = [
      { x: 50, y: 50, z: 0, buried: true, location: 0 }, // fase 0 (activa) → sería el destino
      { x: 101, y: 100, z: 0, buried: true, location: 0 }, // fase 1: la puerta que se PISA (al este)
      ...Array.from({ length: 6 }, () => ({ x: 0, y: 0, z: 0, buried: false, location: 0 })),
    ];
    const st = makeState({
      position: { location: 0, floor: 0, x: 100, y: 100 },
      moonstones,
      // 00:00 → tras el paso (coste base 2) sigue en 00:02, dentro del edge <00:0A.
      time: { year: 139, month: 4, day: 7, hour: 0, minute: 0 },
      prevHour: 0,
    });
    const g = new Game({} as ExtractedInitialState, grassWorld(), gd, st, {
      combatResources,
    });
    let teleportFlag: boolean | null = null;
    g.setMoongateTransitHook((teleport) => {
      teleportFlag = teleport;
    });
    g.move("east"); // pisa la moongate en el edge de medianoche
    expect(teleportFlag).toBe(false); // el hook corrió, señalando "sin teleport"
    expect(g.state.position).toMatchObject({ x: 101, y: 100 }); // NO teleportó: sigue sobre la puerta
  });
});

describe("Game.setActivePlayer (dígitos = Set Active Player, kernel 0x4080)", () => {
  const party = (): GameState =>
    makeState({
      characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" }), makeChar({ name: "Gorn" })],
      partySize: 3,
      activeCharacter: 0,
      position: { location: 1, floor: 0, x: 15, y: 15 }, // pueblo: Invalid no corre world_turn
    });

  it("dígito 1 → índice 0 (Avatar); nombre vacío cae a 'Avatar' (feedback usuario)", () => {
    const g = makeGame(party());
    const ev = g.setActivePlayer(1); // '1' → index 0
    expect(g.state.activeCharacter).toBe(0);
    expect(ev.map((e) => e.text)).toEqual(["Avatar"]); // no vacío
  });

  it("dígito N → índice N-1; imprime el nombre del miembro", () => {
    const g = makeGame(party());
    expect(g.setActivePlayer(2).map((e) => e.text)).toEqual(["Iolo"]);
    expect(g.state.activeCharacter).toBe(1);
    expect(g.setActivePlayer(3).map((e) => e.text)).toEqual(["Gorn"]);
    expect(g.state.activeCharacter).toBe(2);
  });

  it("dígito 0 → 'None!' + g_active_char = 0xFF", () => {
    const g = makeGame(party());
    expect(g.setActivePlayer(0).map((e) => e.text)).toEqual(["None!"]);
    expect(g.state.activeCharacter).toBe(0xff);
  });

  it("fuera de rango (index >= partySize) → 'Invalid!', activo sin cambiar", () => {
    const g = makeGame(party()); // partySize 3
    expect(g.setActivePlayer(4).map((e) => e.text)).toEqual(["Invalid!"]); // '4' → index 3
    expect(g.state.activeCharacter).toBe(0);
  });

  it("miembro muerto ('D') → 'Invalid!', no se hace activo", () => {
    const g = makeGame(
      makeState({
        characters: [makeChar({ name: "A" }), makeChar({ name: "Dead", status: "D" })],
        partySize: 2,
        activeCharacter: 0,
        position: { location: 1, floor: 0, x: 15, y: 15 },
      }),
    );
    expect(g.setActivePlayer(2).map((e) => e.text)).toEqual(["Invalid!"]);
    expect(g.state.activeCharacter).toBe(0);
  });
});

describe("Klimb-con-garfio en el overworld (CMDS 0x1C20)", () => {
  const SMALL_MOUNTAIN = 12; // 0x0C — único escalable (1c8e: cmp 0xc)
  const TALL_MOUNTAIN = 13; // 0x0D — intransitable (1c84: cmp 0xd)
  const GRASS = 5;

  type Evs = ReturnType<Game["klimb"]>;
  const texts = (evs: Evs): string[] =>
    evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");
  const asksDir = (evs: Evs): boolean =>
    evs.some((e) => e.kind === "needs-direction" && e.command === "klimb");
  const moved = (evs: Evs): boolean => evs.some((e) => e.kind === "moved");

  /** Party a pie con garfio en (100,100); el ESTE (101,100) es `east` (dx=+1). */
  const grappleGame = (over: Partial<GameState> = {}): Game =>
    makeGame(makeState({ grapple: true, transport: "foot", food: 100, ...over }));

  it("sin garfio (g_grapple=0) → 'With what?' y NO pide dirección (1c28)", () => {
    const g = grappleGame({ grapple: false });
    const evs = g.klimb();
    expect(texts(evs)).toEqual(["With what?"]);
    expect(asksDir(evs)).toBe(false);
  });

  it("a caballo (g_transport_tile≠0x1c) → 'On foot!' aun con garfio (1c3a)", () => {
    const g = grappleGame({ transport: "horse" });
    const evs = g.klimb();
    expect(texts(evs)).toEqual(["On foot!"]);
    expect(asksDir(evs)).toBe(false);
  });

  it("con garfio y a pie, sin dirección → PIDE dirección (getdir 0x766c), sin mensaje ni turno", () => {
    const g = grappleGame();
    const evs = g.klimb();
    expect(asksDir(evs)).toBe(true);
    expect(texts(evs)).toEqual([]); // el bug previo emitía "What?" aquí
    expect(g.state.position).toEqual({ location: 0, floor: 0, x: 100, y: 100 });
  });

  it("dirección a montaña pequeña (12) → la party CRUZA sobre ella y consume turno (1cfc)", () => {
    const g = grappleGame();
    g.reseed(1); // rolls deterministas; la party cruza pase lo que pase con las tiradas
    g.setMapOverride(101, 100, SMALL_MOUNTAIN);
    const min0 = g.state.time.minute;
    const evs = g.klimb("east");
    expect(moved(evs)).toBe(true);
    expect(g.state.position.x).toBe(101);
    expect(g.state.time.minute).not.toBe(min0); // outdoorTurn (coste base 2 min)
  });

  it("montaña ALTA (13) → 'Impassable!', sin cruzar ni turno (1c84)", () => {
    const g = grappleGame();
    g.setMapOverride(101, 100, TALL_MOUNTAIN);
    const min0 = g.state.time.minute;
    const evs = g.klimb("east");
    expect(texts(evs)).toEqual(["Impassable!"]);
    expect(g.state.position.x).toBe(100); // no cruza
    expect(g.state.time.minute).toBe(min0); // sin turno
  });

  it("tile no-montaña (hierba 5) → 'Not climbable!', sin cruzar ni turno (1c8e)", () => {
    const g = grappleGame();
    g.setMapOverride(101, 100, GRASS);
    const evs = g.klimb("east");
    expect(texts(evs)).toEqual(["Not climbable!"]);
    expect(g.state.position.x).toBe(100);
  });

  it("cancelar el getdir en el overworld NO cobra turno (1c4d, ≠ pueblo)", () => {
    const g = grappleGame();
    const min0 = g.state.time.minute;
    const evs = g.klimbCancel();
    expect(texts(evs)).toEqual([]);
    expect(g.state.time.minute).toBe(min0); // sin passtime, a diferencia del klimb de pueblo
  });
});
