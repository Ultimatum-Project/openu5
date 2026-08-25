/**
 * F1.8-T1 — Teclas de salida rápida de la matriz de comandos (scout-dispatch.md):
 * Space (Pass, kernel 0x31F4), P (Push, CMDS 0x161A), N (New Order, CMDS 0x0DDC)
 * e I (Ignite torch, CMDS 0x0D98) en overworld/pueblo.
 *
 * Estos tests fijan la CONVENCIÓN DE TURNO de cada una a nivel de motor (`Game`):
 *  - Pass: cobra turno SIEMPRE (0x31F4 devuelve 1 → el bucle cobra el coste).
 *  - Push: cobra turno SÓLO en éxito (0x1798 setea g_unk_24e6; el fallo sale sin
 *    tocarlo — cmds.md §3).
 *  - New Order: ACCIÓN LIBRE, no cobra turno (0x0DDC no setea g_unk_24e6 —
 *    cmds.md §2).
 *  - Ignite: cobra turno también al fallar ("None owned!"), como el dispatcher que
 *    devuelve "consumido" por defecto (kernel-survival §3; ya cubierto en dungeon,
 *    aquí se fija el camino overworld).
 *
 * El wiring tecla→método vive en main.ts y se ejercita por los e2e
 * (game/e2e/easy-keys.spec.ts). Aquí se prueba el motor con un `Game` real.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";

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
    characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" }), makeChar({ name: "Shamino" })],
    partySize: 3,
    activeCharacter: 0,
    food: 100,
    // Hora 8 (pleno día) → sin re-roll de medianoche ni encuentros forzados.
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 },
    transport: "foot",
    torchTurns: 0,
    torches: 2,
    prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const combatResources: CombatResources = {
  combatMaps: [],
  enemyDefs: [],
  attackValues: [],
  attackRangeValues: [],
  defenseValues: [],
};

/**
 * Overworld 256×256 de un tile base, con parches opcionales por coordenada. tile
 * 5 (hierba, clase 0 normal) por defecto → paso sin coste extra de terreno.
 */
function makeWorld(base = 5, patches: [number, number, number][] = []): WorldData {
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => base),
  );
  for (const [x, y, t] of patches) overworld[y]![x] = t;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

function makeGame(s: GameState, world: WorldData = makeWorld()): Game {
  const g = new Game({} as ExtractedInitialState, world, gameData, s, { combatResources });
  g.reseed(4242); // stream vivo determinista
  return g;
}

const minutesOf = (g: Game): number => g.state.time.hour * 60 + g.state.time.minute;

describe("Pass (Space, kernel 0x31F4) — cobra turno SIEMPRE", () => {
  it("NO ecoa desde el core (el eco es del despachador) y avanza el reloj 2 min sin mover al party", () => {
    const g = makeGame(makeState());
    const before = minutesOf(g);
    const pos = { ...g.state.position };
    const ev = g.pass();
    // El nombre del comando lo imprime el DESPACHADOR antes de saltar al handler
    // (0x31F4 → 0x3210 `mov ax,0xa134` → 0x33ea `call print_string`), no el handler:
    // el call-site de main.ts lo ecoa con hud.echo(CMD_STRINGS.pass) = "Pass\n". Antes
    // el core empujaba aquí un `{kind:"message", text:"Pass"}` propio — sin el prompt
    // «>» y sin el `\n`, así que pulsar Espacio varias veces apilaba líneas pegadas
    // (QA usuario móvil 28-07). Ver tests/cmd-echo-dispatcher.test.ts.
    expect(ev.some((e) => e.kind === "message" && e.text === "Pass")).toBe(false);
    // El party NO se mueve (Pass ≠ move).
    expect(g.state.position.x).toBe(pos.x);
    expect(g.state.position.y).toBe(pos.y);
    // Coste base del exterior = 2 min (MAINOUT 0xC39).
    expect(minutesOf(g)).toBe(before + 2);
  });

  it("en pueblo (loc≠0) cobra 1 min", () => {
    const g = makeGame(makeState({ position: { location: 2, floor: 0, x: 15, y: 15 } }));
    const before = minutesOf(g);
    g.pass();
    expect(minutesOf(g)).toBe(before + 1);
  });
});

describe("Push (P, CMDS 0x161A) — cobra turno SÓLO en éxito", () => {
  it("sin objeto empujable delante: 'Won't budge!\\n' (DS 0x4559, CON '!') y NO avanza el reloj", () => {
    // Party en (100,100); al ESTE (101,100) hierba (5) = no empujable.
    const g = makeGame(makeState());
    const before = minutesOf(g);
    const ev = g.push("east");
    // #289: la cadena fiel del gate 1 (cmds.md §3 paso 1) lleva '!' y '\n' —
    // DS 0x4559 «Won't budge!\n» (approved-strings, arena fix-121).
    expect(ev.some((e) => e.kind === "message" && e.text === "Won't budge!\n")).toBe(true);
    expect(minutesOf(g)).toBe(before); // fallo → sin turno (cmds.md §3)
  });

  it("empuje válido: 'Pushed!\\n' (0x1548, DS 0x4547), desliza el cañón REORIENTADO y cobra el turno", () => {
    // Cañón (0xB4) al ESTE de la party y suelo de relleno (0x45) tras él.
    const g = makeGame(
      makeState(),
      makeWorld(5, [
        [101, 100, 0xb4], // fuente: cañón (empujable)
        [102, 100, 0x45], // destino: relleno de cañón → desliza
      ]),
    );
    const before = minutesOf(g);
    const ev = g.push("east");
    expect(ev.some((e) => e.kind === "message" && e.text === "Pushed!\n")).toBe(true);
    // #289 · reorientación 0x1575→0x1504: clase cañón (0xB4&0xFC==0xB4) rota su
    // facing a la dirección del empuje — E(1,0) ⇒ índice +1 ⇒ 0xB5 EN CRUDO
    // (== CANNON_E de cannon.test.ts:27, misma convención por otra fuente).
    expect(g.activeMap.tileAt(102, 100)).toBe(0xb5);
    // La fuente queda con el relleno de cañón 0x45 (swap src↔dest, 0x1573).
    expect(g.activeMap.tileAt(101, 100)).toBe(0x45);
    // El party avanza a la celda que ocupaba el cañón.
    expect(g.state.position.x).toBe(101);
    // Éxito → cobra el turno (2 min exterior).
    expect(minutesOf(g)).toBe(before + 2);
  });

  it("tirón (0x15B0): party sobre fill 0x44 → 'Pulled!\\n' (DS 0x4550) y el mueble llega con facing XOR 2", () => {
    // Silla facing-S (0x92) al ESTE; detrás hierba (≠fill) → NO desliza; el
    // party pisa suelo 0x44 (==fill de mueble) → TIRA (cmds.md §3 paso 3).
    const g = makeGame(
      makeState(),
      makeWorld(5, [
        [100, 100, 0x44], // celda del party: suelo == fill → habilita el pull
        [101, 100, 0x92], // fuente: silla (clase 0x90, empujable)
      ]),
    );
    const before = minutesOf(g);
    const ev = g.push("east");
    expect(ev.some((e) => e.kind === "message" && e.text === "Pulled!\n")).toBe(true);
    // #289 · reorientación del TIRÓN (0x15dd→0x1504 con flip=1): E ⇒ índice
    // 1^2 = 3 ⇒ 0x90+3 = 0x93 EN CRUDO (mira al lado CONTRARIO que al empujar).
    expect(g.activeMap.tileAt(100, 100)).toBe(0x93);
    // La fuente queda con el suelo del party (swap, 0x15db).
    expect(g.activeMap.tileAt(101, 100)).toBe(0x44);
    // El party avanza a la celda que ocupaba la silla.
    expect(g.state.position.x).toBe(101);
    expect(minutesOf(g)).toBe(before + 2); // éxito → turno
  });

  it("ni desliza ni tira: 'Won't budge\\n' (DS 0x4567, SIN '!') — cadena DISTINTA de 0x4559", () => {
    // Silla empujable pero: detrás hierba (≠fill 0x44) y party sobre hierba
    // (≠fill) → gate 4 de cmds.md §3. La cadena del binario NO lleva '!'
    // (approved-strings: «Cadena DISTINTA de 0x4559, no un typo»).
    const g = makeGame(makeState(), makeWorld(5, [[101, 100, 0x92]]));
    const before = minutesOf(g);
    const ev = g.push("east");
    expect(ev.some((e) => e.kind === "message" && e.text === "Won't budge\n")).toBe(true);
    expect(ev.some((e) => e.kind === "message" && e.text === "Won't budge!\n")).toBe(false);
    expect(minutesOf(g)).toBe(before); // fallo → sin turno
  });

  it("clase SIN facing (mesa 0xA5): desliza SIN reorientar (0x157f salta la llamada)", () => {
    // 0xA5&0xFC == 0xA4 ∉ {0x90, 0xB4} → conserva su tile tal cual.
    const g = makeGame(
      makeState(),
      makeWorld(5, [
        [101, 100, 0xa5], // mesa (empujable, sin familia de facing)
        [102, 100, 0x44], // destino: fill de suelo → desliza
      ]),
    );
    g.push("east");
    expect(g.activeMap.tileAt(102, 100)).toBe(0xa5); // intacta
  });
});

describe("New Order (N, CMDS 0x0DDC) — ACCIÓN LIBRE, sin turno", () => {
  it("intercambia dos miembros y NO avanza el reloj", () => {
    const g = makeGame(makeState());
    const before = minutesOf(g);
    const iolo = g.state.characters[1];
    const shamino = g.state.characters[2];
    const ev = g.newOrder(1, 2);
    expect(ev.some((e) => e.kind === "party-changed")).toBe(true);
    expect(g.state.characters[1]).toBe(shamino);
    expect(g.state.characters[2]).toBe(iolo);
    expect(minutesOf(g)).toBe(before); // acción libre (cmds.md §2)
  });

  it("mover al Avatar (idx 0) sale con ' must lead!' y sin turno", () => {
    const g = makeGame(makeState());
    const before = minutesOf(g);
    const ev = g.newOrder(0, 2);
    expect(ev.some((e) => e.kind === "message" && /must lead!/.test(e.text ?? ""))).toBe(true);
    expect(minutesOf(g)).toBe(before);
  });
});

describe("Ignite (I, CMDS 0x0D98) — overworld: consume antorcha, luz mín 240, cobra turno", () => {
  it("con antorchas: enciende (torchTurns=240) y avanza el reloj", () => {
    const g = makeGame(makeState({ torches: 2, torchTurns: 0 }));
    const before = minutesOf(g);
    const ev = g.ignite();
    // ÉXITO sin resultado impreso: "Torch ignited!" era fabricado; el binario solo ecoa
    // ">Ignite torch!" en el dispatch (main.ts). #77.
    expect(ev.some((e) => e.kind === "message" && e.text === "Torch ignited!")).toBe(false);
    expect(g.state.torches).toBe(1); // gasta 1
    // Fuera de mazmorra: g_torch_mins = 240 FIJO (kernel-survival §3). El paso del
    // turno (2 min) lo descuenta → 238.
    expect(g.state.torchTurns).toBe(240 - 2);
    expect(minutesOf(g)).toBe(before + 2);
  });

  it("sin antorchas: 'None owned!' pero IGUAL cobra el turno", () => {
    const g = makeGame(makeState({ torches: 0, torchTurns: 0 }));
    const before = minutesOf(g);
    const ev = g.ignite();
    expect(ev.some((e) => e.kind === "message" && e.text === "None owned!")).toBe(true);
    // ⚠ INFERENCIA, no hecho (review F1.8-T1): el cobro de turno en la rama FALLO
    // no es verificable con el asm disponible (cmd_ignite 0x0D98 no toca g_unk_24e6
    // en ninguna rama; el dispatcher ignora el AX de I; el punto MAINOUT
    // retorno→advance_clock está sin medir). Sólo el ÉXITO está runtime-verificado
    // (04-torch-ignite-town). Este assert fija la CONDUCTA ACTUAL del clon (turno
    // por el default "consumido" del dispatcher) = Clase C en
    // re/deliberate-divergences.md §3 ("¿Cobra turno el Ignite-FALLO?"). Si el
    // oráculo DOSBox lo refuta (reloj sin delta con 0 antorchas), corregir aquí con
    // excepción documentada (rama sin turno).
    expect(minutesOf(g)).toBe(before + 2);
  });
});
