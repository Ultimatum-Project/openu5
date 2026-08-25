/**
 * El PESTILLO del refuge no puede absorber los death-checks siguientes.
 *
 * Derivado del binario (leído en re/disasm, no citado de oídas):
 *
 *   ULTIMA.EXE 0x39fc `party_conscious_state` — recorre los `g_party_size` registros
 *     desde 0x55b3 en pasos de 0x20: devuelve 0 si alguno es 'G' (0x47, 0x3a28) o 'P'
 *     (0x50, 0x3a2d); cuenta los 'S' (0x53, 0x3a44) y al final `0x3a64 mov ax,1` si hay
 *     dormidos, `0x3a6a mov ax,0xffff` = -1 si no hay ni conscientes ni dormidos.
 *
 *   MAINOUT.OVL 0x0aa2 `call` → (dispatch_table: near_call_base 0x81d0) kernel 0x39fc.
 *     El chequeo vive en la CABECERA del bucle exterior (prólogo 0x0a84), y el back-edge
 *     del bucle `0x0d1a jmp 0xa8f` vuelve JUSTO ANTES de él ⇒ se comprueba EN CADA
 *     iteración, pase lo que pase en la anterior. `0x0ac2 cmp word ptr [bp-6], -1` /
 *     `0x0ac6 jne 0xb00`: si es -1 NO sigue el turno, cae en la rama del refuge.
 *
 *   La rama llama en 0x0af0 al stub kernel 0x7a5e → BLCKTHRN.OVL fileoff 2320 = 0x0910
 *     `party_refuge`, que es SÍNCRONA (revive en 0x0b54-0x0bb3 + muta en 0x0bfd-0x0c4d),
 *     y al volver `0x0af3 mov word ptr [bp-0xa],1` hace SALIR al bucle (0x0d14/0x0d18).
 *
 * ⇒ INVARIANTE DEL BINARIO: una party 100% muerta NO puede jugar otro turno. No hay
 * pestillo ni mutación diferida.
 *
 * El port parte la escena en dos (emitir guión → la piel lo pacea → `resolveRefuge`
 * muta), lo cual es fiel mientras el consumidor coopere: main.ts BLOQUEA el input
 * mientras corre la escena (`refuging`, main.ts:1033), así que ahí nunca se re-entra.
 * Pero el guard `if (this.refugePending) return []` absorbía TODOS los death-checks
 * posteriores, así que un consumidor que reciba el evento y no lo pacee (arneses que
 * llaman al core en crudo y descartan los eventos) dejaba la party muerta para el resto
 * de la sesión. Medido en los replays del espejo: part10 pasa 107 s y encaja 19
 * "BATTLE IS LOST!" con los seis muertos sin que el rescate vuelva a disparar.
 *
 * La firma en BYTES del rescate es `0x0c40 cmp word ptr [g_food], 0` /
 * `0x0c47 mov word ptr [g_food], 0x3f` — comida a 63 si estaba a cero.
 */
import { describe, expect, it } from "vitest";
import type {
  CharacterState,
  ExtractedInitialState,
  GameState,
} from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

// Esperados EN CRUDO, tomados del disasm (NO importados del código bajo prueba):
const CASTILLO_LB = 0x11; // BLCKTHRN 0x0c09 `mov byte ptr [g_location], 0x11`
const COMIDA_REPUESTA = 0x3f; // BLCKTHRN 0x0c47 `mov word ptr [g_food], 0x3f`
const KARMA_SUELO = 0x4b; // BLCKTHRN 0x0c04 `mov byte ptr [g_karma], 0x4b`
const XY_DESPERTAR = 0x0a; // BLCKTHRN 0x0c1a/0x0c1d `mov [g_party_y]/[g_party_x], al` (al=0xa)
const HORA_DESPERTAR = 6; // BLCKTHRN 0x0c31 `cmp byte ptr [g_hour], 6`

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff,
    shield: 0xff, ring: 0xff, amulet: 0xff, partyStatus: 0,
    ...over,
  };
}
const dead = (name: string): CharacterState =>
  makeChar({ name, status: "D", currentHp: 0 });

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [dead("Avatar"), dead("Iolo")],
    partySize: 2,
    activeCharacter: 0,
    food: 0,
    karma: 10,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 100, y: 100 }, // overworld (MAINOUT)
    transport: "foot",
    torchTurns: 3,
    torches: 2,
    prevHour: 8,
    lightSpellMins: 4,
    timeSpell: undefined,
  };
  return { ...base, ...over } as GameState;
}

/**
 * Mundo con el castillo de LB (0x11) mapeado: el rescate ATERRIZA ahí. Con
 * `bloqueado`, todo el overworld es montaña (0x0c) salvo la casilla del party, así que
 * cualquier paso rebota con «Blocked!».
 */
function makeWorld(bloqueado = false): WorldData {
  const suelo = bloqueado ? 0x0c : 5;
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => suelo));
  overworld[100]![100] = 5;
  const floors = [1, 0].map((z) => ({
    z,
    tiles: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5)),
  }));
  const castillo: SmallMapLocation = { id: CASTILLO_LB, name: "Lord British", floors };
  return {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[CASTILLO_LB, castillo]]),
  };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

const makeGame = (
  s: GameState = makeState(),
  opts: { bloqueado?: boolean } = {},
): Game =>
  new Game({} as ExtractedInitialState, makeWorld(opts.bloqueado), gameData, s);

const hasRefuge = (ev: readonly GameEvent[]): boolean =>
  ev.some((e) => e.kind === "refuge");
const vivos = (g: Game): number =>
  g.state.characters.filter((c) => c.status !== "D").length;

describe("refuge — el pestillo no absorbe los death-checks siguientes (MAINOUT 0x0aa2 en la cabecera del bucle)", () => {
  it("consumidor que DESCARTA el guión: el turno siguiente APLICA el rescate (firma comida=63)", () => {
    const game = makeGame();

    // Turno 1: se emite el guión y —fiel— NO se muta nada (la piel pacea la escena con
    // el roster todavía caído).
    const t1 = game.move("east");
    expect(hasRefuge(t1)).toBe(true);
    expect(vivos(game)).toBe(0);
    expect(game.state.position.location).toBe(0);
    expect(game.state.food).toBe(0);

    // Turno 2 SIN `resolveRefuge`: en el binario este turno no puede existir con la
    // party muerta. El death-check de la cabecera (0x0aa2) vuelve a verla a -1 y el
    // rescate se aplica. Sin el fix, el pestillo lo absorbe y esto sigue 0/2.
    game.move("west");

    expect(vivos(game)).toBe(2);
    expect(game.state.food).toBe(COMIDA_REPUESTA); // 63 — la firma en bytes (0x0c47)
    expect(game.state.position.location).toBe(CASTILLO_LB); // 17
    expect(game.state.position.floor).toBe(1); // 0x0c0e
    expect(game.state.position.x).toBe(XY_DESPERTAR); // 10
    expect(game.state.position.y).toBe(XY_DESPERTAR); // 10
    expect(game.state.transport).toBe("foot"); // 0x0c13
    expect(game.state.karma).toBe(KARMA_SUELO); // 75
    expect(game.state.time.hour).toBe(HORA_DESPERTAR); // 6
    expect(game.state.time.minute).toBe(0);
    expect(game.state.characters.every((c) => c.currentHp === c.maxHp)).toBe(true);
  });

  it("la party muerta NO encadena turnos (part10: 107 s y 19 'BATTLE IS LOST!')", () => {
    const game = makeGame();
    // Un consumidor que descarta TODOS los eventos, como el arnés del espejo.
    const emitido: boolean[] = [];
    for (let t = 0; t < 6; t++) {
      emitido.push(hasRefuge(game.move(t % 2 ? "west" : "east")));
    }
    // El guión se emite UNA vez (turno 1) y en el turno 2 se aplica el rescate; a partir
    // de ahí la party está viva y no vuelve a haber death-check positivo.
    expect(emitido).toEqual([true, false, false, false, false, false]);
    // Lo que importa: tras 6 turnos la party NO sigue muerta. Sin el fix: 0.
    expect(vivos(game)).toBe(2);
    expect(game.state.food).toBe(COMIDA_REPUESTA);
    expect(game.state.position.location).toBe(CASTILLO_LB);
  });

  it("CASO CONTRARIO (hoy verde, no romper): el consumidor COOPERANTE conserva la escena en dos tiempos", () => {
    const game = makeGame();

    // Turno 1: emite y NO muta — el roster debe seguir CAÍDO durante la escena.
    expect(hasRefuge(game.move("east"))).toBe(true);
    expect(vivos(game)).toBe(0);
    expect(game.state.position.location).toBe(0);
    expect(game.state.karma).toBe(10); // sin suelo todavía
    expect(game.state.food).toBe(0);

    // La piel termina la escena y resuelve: mutación completa, con la firma comida=63.
    const res = game.resolveRefuge();
    expect(vivos(game)).toBe(2);
    expect(game.state.food).toBe(COMIDA_REPUESTA);
    expect(game.state.position.location).toBe(CASTILLO_LB);
    expect(game.state.karma).toBe(KARMA_SUELO);
    expect(res.some((e) => e.kind === "map-changed")).toBe(true);
    expect(res.some((e) => e.kind === "party-changed")).toBe(true);
  });

  it("tras resolver, el death-check calla: party viva ⇒ no re-emite ni re-muta", () => {
    const game = makeGame();
    game.move("east");
    game.resolveRefuge();
    const hora = game.state.time.hour;

    const ev = game.move("east");
    expect(hasRefuge(ev)).toBe(false);
    expect(vivos(game)).toBe(2);
    expect(game.state.position.location).toBe(CASTILLO_LB);
    // No se re-aplica la mutación (el reloj no vuelve a saltar a las 6:00 desde otra hora).
    expect(game.state.time.hour).toBe(hora);
  });

  it("paso BLOQUEADO: el death-check corre igual (0x0d14 → back-edge 0x0d1a → cabecera 0x0aa2)", () => {
    // Overworld TODO montaña (tile 0x0c) salvo la casilla del party ⇒ todo paso rebota
    // con «Blocked!». El binario salta puertas/NPCs y el world-turn final (0xC30→0xD14)
    // pero NO el death-check, porque 0x0d14 devuelve el bucle a su cabecera. Sin esto,
    // una party muerta contra una pared no se rescataría jamás.
    const game = makeGame(makeState(), { bloqueado: true });

    const t1 = game.move("east");
    expect(t1.some((e) => e.kind === "message" && e.text === "Blocked!")).toBe(true);
    expect(game.state.position.x).toBe(100); // no se movió: el paso rebotó
    expect(hasRefuge(t1)).toBe(true); // el death-check corrió IGUAL

    game.move("east"); // 2º turno sin resolver ⇒ se aplica el rescate
    expect(vivos(game)).toBe(2);
    expect(game.state.food).toBe(COMIDA_REPUESTA); // 63
    expect(game.state.position.location).toBe(CASTILLO_LB); // 17
  });

  it("control: party VIVA no dispara nada (party_conscious_state = 0, 0x3a28 'G')", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar" }), dead("Iolo")] }),
    );
    expect(hasRefuge(game.move("east"))).toBe(false);
    expect(game.state.position.location).toBe(0);
    expect(game.state.food).toBe(0); // sin rescate no hay reposición
  });

  it("control: party DORMIDA devuelve 1, no -1 (0x3a44 'S' → 0x3a64 mov ax,1)", () => {
    const game = makeGame(
      makeState({ characters: [makeChar({ name: "Avatar", status: "S" }), dead("Iolo")] }),
    );
    expect(hasRefuge(game.move("east"))).toBe(false);
    expect(game.state.food).toBe(0);
  });
});
