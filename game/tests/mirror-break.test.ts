/**
 * #217 — ROMPER EL ESPEJO con (A)ttack. `TOWN.OVL town_attack_cmd` 0x09e6, rama
 * 0x0a4f-0x0a8a: si la celda objetivo lleva el tile 0x9D (espejo), la rutina escribe
 * **0x9F al mapa vivo** (0x0a5f), imprime DS 0x26f2 = "Broken!\n" (0x0a62), lanza el
 * barrido de 18 `noise_burst` (0x0a69-0x0a80), pide repintado (0x0a85) y RETORNA
 * (`jmp 0xb79`) sin caer al resto del ataque. Familia #33.
 *
 * Todos los esperados van EN CRUDO (literales del binario), nunca calculados desde el
 * sujeto: el mutante que invierta el mapeo de tiles o el texto tiene que enrojecer por
 * los DOS lados del expect.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type CombatResources, type GameData } from "../src/core/game.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import type { CombatMapData } from "../src/core/combat/combat.js";
import type { WorldData } from "../src/core/world/map.js";
import { SFX_CATALOG, type NoiseSeg } from "../src/skin/fiel/speaker.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

// Los TRES tiles de la familia, EN CRUDO. Acreditados por la tabla de (L)ook del
// original (assets/look2.json, índices 157/158/159): "a mirror" · "a tired adventurer"
// (el REFLEJO, que pinta el renderizador ULTIMA.EXE 0x5339, nunca está en el mapa) ·
// "a broken mirror".
const MIRROR = 0x9d;
const REFLECTION = 0x9e;
const BROKEN = 0x9f;

const TOWN_LOC = 2;
const MX = 15; // celda del espejo
const MY = 15;

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

/** Party a pie EN PUEBLO, justo al oeste del espejo: (A)ttack east apunta a (15,15). */
function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    characters: [makeChar({ name: "" }), makeChar({ name: "Iolo" })],
    partySize: 2, activeCharacter: 0, food: 100,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 0 },
    turnsSinceStart: 0, position: { location: TOWN_LOC, floor: 0, x: MX - 1, y: MY },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
  };
  return { ...base, ...over } as GameState;
}

/** Pueblo 32×32 de hierba con `cell` en (15,15); overworld de hierba con `cell` en (99,100). */
function makeWorld(cell: number): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
  overworld[100]![99] = cell; // misma celda objetivo, pero en SOBREMUNDO
  overworld[100]![120] = 0x13; // ENTERABLE_TILES[1]: la entrada del pueblo, para enter()
  const townTiles = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
  townTiles[MY]![MX] = cell;
  const smallMaps = new Map([
    [TOWN_LOC, { id: TOWN_LOC, name: "Test Town", floors: [{ z: 0, tiles: townTiles }] }],
  ]);
  return { overworld, underworld: overworld, smallMaps };
}

// La entrada del pueblo en el sobremundo, para que `enter()` sepa re-entrar en la
// prueba de recarga (mismo idiom que doors.test.ts).
const locationsX: number[] = [];
const locationsY: number[] = [];
locationsX[TOWN_LOC - 1] = 120;
locationsY[TOWN_LOC - 1] = 100;
const gameData: GameData = { locationsX, locationsY, locationNames: [] };
const combatResources: CombatResources = {
  combatMaps,
  enemyDefs: buildEnemyDefs(data, additionalFlags),
  attackValues: [],
  attackRangeValues: [],
  defenseValues: data.defenseValues,
};

function makeGame(cell = MIRROR, s: GameState = makeState()): { g: Game; st: GameState } {
  const g = new Game({} as ExtractedInitialState, makeWorld(cell), gameData, s, {
    combatResources,
  });
  g.reseed(4242);
  return { g, st: s };
}

const msgs = (ev: ReturnType<Game["attack"]>): string[] =>
  ev.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("#217 — (A)ttack sobre el espejo: TOWN 0x0a4f-0x0a8a", () => {
  it("escribe 0x9F AL MAPA, dice «Broken!», suena y pide repintado", () => {
    const { g } = makeGame();
    // CONTROL POSITIVO: el espejo está ahí ANTES. Sin esto, «se rompió» pasaría verde
    // sobre un fixture que nunca tuvo espejo.
    expect(g.activeMap.tileAt(MX, MY), "el fixture SÍ tiene espejo").toBe(MIRROR);

    const ev = g.attack("east");

    expect(g.activeMap.tileAt(MX, MY), "0x0a5f `mov byte [bx],0x9f`").toBe(BROKEN);
    expect(msgs(ev)).toEqual(["Broken!\n"]); // 0x0a62, DS 0x26f2 EN CRUDO
    expect(ev.some((e) => e.kind === "sfx" && e.sfx?.id === "mirror-break")).toBe(true);
    expect(ev.some((e) => e.kind === "map-changed")).toBe(true); // 0x0a85 `or [g_unk_24e6],2`
  });

  it("RETORNA ahí: no cae al resto del ataque («Nothing to attack!»)", () => {
    const { g } = makeGame();
    // El `jmp 0xb79` de 0x0a8a. Un port que sólo AÑADIERA el mensaje sin cortar el
    // camino emitiría los dos.
    expect(msgs(g.attack("east"))).not.toContain("Nothing to attack!\n");
  });

  it("★ NO hay restauración 0x9F→0x9D: el espejo roto se queda roto", () => {
    // MUTANTE que este aserto mata: «restaurar al salir» / «el segundo golpe repara».
    // Negativo MEDIDO sobre los 28 .asm del corpus: ninguna instrucción del binario
    // escribe 0x9d en forma alguna (control positivo del mismo censo: sí encuentra las
    // escrituras de 0x9f aquí y de 0x9e en el renderizador).
    const { g } = makeGame();
    g.attack("east");
    expect(g.activeMap.tileAt(MX, MY)).toBe(BROKEN);

    const ev2 = g.attack("east"); // segundo golpe sobre la MISMA celda
    expect(g.activeMap.tileAt(MX, MY), "sigue roto").toBe(BROKEN);
    expect(msgs(ev2), "ya no es 0x9D ⇒ cae al resto del ataque").not.toContain("Broken!\n");
  });

  it("★ SÓLO en pueblo/interior: el ataque de SOBREMUNDO no tiene rama de espejo", () => {
    // MUTANTE que mata: quitar el gate de `location` y romper espejos en MAINOUT.
    // `MAINOUT cmd_attack` 0x06ec no compara 0x9d en ningún punto (censo del inmediato
    // sobre los 28 .asm: los únicos sitios son TOWN 0x0a4f y el renderizador 0x5339).
    const st = makeState({ position: { location: 0, floor: 0, x: 100, y: 100 } });
    const { g } = makeGame(MIRROR, st);
    expect(g.activeMap.tileAt(99, 100), "hay espejo bajo la celda objetivo").toBe(MIRROR);
    const ev = g.attack("west");
    expect(msgs(ev)).not.toContain("Broken!\n");
    expect(g.activeMap.tileAt(99, 100), "intacto en sobremundo").toBe(MIRROR);
  });

  it("★ el REFLEJO 0x9E no es un espejo: atacarlo no rompe nada", () => {
    // MUTANTE que mata: gatear con un RANGO (`>= 0x9d`) en vez del `cmp ... 0x9d`
    // EXACTO de 0x0a4f. 0x9E es «a tired adventurer», lo pinta el renderizador y no
    // vive en el mapa; un rango se lo tragaría.
    const { g } = makeGame(REFLECTION);
    const ev = g.attack("east");
    expect(msgs(ev)).not.toContain("Broken!\n");
    expect(g.activeMap.tileAt(MX, MY)).toBe(REFLECTION);
  });

  it("★ CERO RNG: romper el espejo no desplaza el stream vivo", () => {
    // La rama sólo llama a get_tile_ptr, print_string y noise_burst, y `noise_burst`
    // sortea con su PRNG LOCAL [0x545c], no con `rand_range`. ⇒ sin ventana de sellos.
    const { g } = makeGame();
    const antes = g.liveSeed();
    g.attack("east");
    expect(g.liveSeed(), "el stream no se movió").toBe(antes);
  });

  it("★ TERRENO VOLÁTIL: el 0x9F no sobrevive a la recarga del mapa", () => {
    // Misma vida útil que la puerta desmagificada de (U)se Skull Key: el binario
    // escribe en el búfer de mapa vivo y TOWN 0x0408 lo repuebla al recargar. La
    // persistencia al GUARDAR es la discusión del sidecar #227/#238, no de aquí.
    const { g, st } = makeGame();
    g.attack("east");
    expect(g.activeMap.tileAt(MX, MY)).toBe(BROKEN);
    expect(Object.keys(st.mapOverrides ?? {}), "no entra en la capa del save").toEqual([]);
    st.position = { location: 0, floor: 0, x: 120, y: 100 } as GameState["position"];
    g.enter(); // sale y vuelve a entrar = carga de mapa por la vía pública
    expect(st.position.location, "se re-entró de verdad").toBe(TOWN_LOC);
    expect(g.activeMap.tileAt(MX, MY), "el .DAT vuelve entero").toBe(MIRROR);
  });
});

describe("#217 — el barrido del cristal: TOWN 0x0a69-0x0a80", () => {
  it("★ son 18 ráfagas de RUIDO con la BANDA 2000→19000, no una rampa de tonos", () => {
    // MUTANTE que mata: portar `si` como FRECUENCIA (rampa limpia de 18 tonos) en vez
    // de como TECHO DE BANDA del noise_burst — la trampa de #137 en su forma más pura.
    // Esperado EN CRUDO: la lista literal de las 18 bandas del bucle
    // `si = 0x7d0; si += 0x3e8; while si < 0x4e20`.
    const segs = SFX_CATALOG["mirror-break"]!();
    expect(segs).toHaveLength(18);
    expect(segs.every((s) => s.kind === "noise"), "RUIDO, no tonos").toBe(true);

    // Cada ráfaga sortea `dur/step` = 0x78/0x28 = 3 frecuencias dentro de [100, banda].
    const bandas = [
      2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
      11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000,
    ];
    for (const [i, banda] of bandas.entries()) {
      const seg = segs[i] as NoiseSeg;
      expect(seg.freqs, `ráfaga ${i}: 0x78/0x28 = 3 tonos`).toHaveLength(3);
      for (const f of seg.freqs) {
        expect(f, `ráfaga ${i}: sorteo dentro de [100, ${banda}]`).toBeLessThanOrEqual(banda);
        expect(f).toBeGreaterThanOrEqual(100);
      }
    }

    // 🔴 Y el barrido SUBE DE VERDAD. Sin este aserto, un mutante de BANDA CONSTANTE
    // (18 × noiseBurst(0x28,0x78,0x7d0)) pasaría TODO lo de arriba: 18 ráfagas, ruido,
    // 3 tonos, y cada tono ≤ su banda nominal — porque «≤ 19000» lo cumple también
    // quien nunca pasa de 2000. El expect anterior aquí comparaba `bandas[17]/bandas[0]`,
    // que es aritmética sobre MIS PROPIOS literales y no toca al sujeto: tautológico.
    // El discriminante real es que alguna frecuencia SUPERE la banda de la primera
    // ráfaga — con banda constante 2000 eso es IMPOSIBLE POR CONSTRUCCIÓN (cota dura
    // del sorteo, no estadística). El falso ROJO exigiría que los 27 sorteos de las
    // nueve últimas ráfagas (bandas 11000-19000) cayeran todos bajo 2000: ~1e-27.
    const todas = segs.flatMap((s) => (s as NoiseSeg).freqs);
    expect(Math.max(...todas), "alguna frecuencia pasa de la banda de la 1ª ráfaga")
      .toBeGreaterThan(bandas[0]!);
  });
});
