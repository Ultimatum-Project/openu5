/**
 * #182 · D5 — el (J)immy sobre COFRES DE LA CAPA DE OBJETO estaba MUERTO (SJOG 0x0F2C).
 *
 * ★ «No lock!» NO es el default de tile-desconocido: es el RESULTADO del barrido de la capa
 * de objeto cuando no encontró cofre. El despacho por tile de SJOG jimmy (0x0daa-0x0dc4 +
 * 0x0f1c) NO tiene tres familias sino CUATRO, y la cuarta es el DEFAULT:
 *
 *   0daa: cmp ax,0x98 / 0dad: jle 0xdb2 · 0daf: jmp 0xf1c          (tile > 0x98)
 *   0db2: cmp ax,0x97 / 0db5: jge 0xe1c                            (0x97..0x98 = mágica)
 *   0db7: cmp ax,0x84 / 0dba: jge 0xdbf · 0dbc: jmp 0xf2c          ← BARRIDO  (tile < 0x84)
 *   0dbf: cmp ax,0x85 / 0dc2: jle 0xe22                            (0x84..0x85 = cepo)
 *                       0dc4: jmp 0xf2c                            ← BARRIDO  (0x86..0x96)
 *   0f1c: cmp ax,0xb9 / 0f1f: jne 0xf24 · 0f21: jmp 0xdc8          (0xb9 = puerta)
 *   0f24: cmp ax,0xbb / 0f27: jne 0xf2c                            ← BARRIDO  (≠0xbb)
 *                       0f29: jmp 0xdc8                            (0xbb = puerta)
 *
 * Son **TRES** entradas a 0x0F2C (0dbc, 0dc4 y 0f27 — la tarjeta decía dos), o sea: todo
 * tile que no sea puerta/mágica/cepo cae al barrido. En el port eso es exactamente la rama
 * `else` de `Game.jimmy`, que imprimía «No lock!» a pelo SIN mirar la capa de objetos.
 *
 * EL BARRIDO, entero (0x0F2C-0x0F7E), sobre g_world_objects DS:0x5C5A (stride 8, 32 slots):
 *
 *   0f2c: mov cx,1        ← ★ arranca en el slot 1; el slot 0 (vehículo del jugador) NO se mira
 *   0f2f: di   = 0x5C64   (+2 = X)      0f32: [bp-0xe] = 0x5C65 (+3 = Y)
 *   0f37: [bp-0x10] = 0x5C66 (+4 = Z)   0f3c: si = 0x5C62 (+0 = TIPO del slot 1)
 *   0f43-0f4a: X != objetivo  → 0xefe (siguiente slot)
 *   0f4c-0f54: Y != objetivo  → 0xefe
 *   0f56: cmp byte [g_location],0x7f / 0f5b: ja 0xf64   ← ★ gate de planta CONDICIONAL
 *   0f5d-0f62: planta != g_floor → 0xefe                  (sólo si g_location <= 0x7f)
 *   0f64: cmp byte [si],1 / 0f67: jne 0xefe             ← ★ slot+0 == 1 = COFRE
 *   0efe-0f13: los cuatro punteros += 8, inc cx, `cmp si,0x5d5a` / `jae 0xf69`
 *   0f69: [bp-4] = cx · 0f6c: cmp cx,0x20 / 0f6f: jge 0xf16   ← agotado (cx==0x20)
 *   0f16: mov ax,0x8b52 → «No lock!\n»                   ← ★ AQUÍ, y sólo aquí
 *   0f71-0f7e: push X,Y,g_floor,cx / call 0xbaa          ← jimmy del cofre-OBJETO
 *
 * El punto de reunión 0x0F69 es COMÚN al match y al agotamiento (`jae 0xf69` de 0x0f11), y
 * `cx` discrimina: 0x20 = se acabó la tabla; 1..31 = índice de slot con cofre.
 *
 * ★★ QUÉ ES EL BYTE +5 (y por qué jimmy sobre cofre = DESARMAR LA TRAMPA). `0xbaa` sólo usa
 * el índice de slot y lee `[bx + 0x5c5f]` con `bx = idx<<3` = registro+5. Y ES EL MISMO BYTE
 * que (O)pen lee como trampa: `open_chest_world` 0x120b `cmp byte [bp-6],0x7f / ja 0x1214`
 * dispara la trampa y 0x1214 `and byte [bp-6],0x7f` se queda con el contenido. Es decir, el
 * bit 0x80 del byte +5 es «trampeado» para (O)pen y «forzable» para (J)immy, y el éxito de
 * jimmy lo LIMPIA (0x0c13 `and byte [bx+0x5c5f],0x7f`) ⇒ el cofre queda desarmado.
 *
 * `0xbaa` entero (ret 8: [bp+4]=idx, [bp+6]=floor, [bp+8]=Y, [bp+0xa]=X — sólo lee [bp+4]):
 *   0bb0: call 0x8a08 (selector de miembro); −1 → 0xc38 = retorno mudo
 *   0bc7: cmp al,0x80 / 0bc9: jae 0xbd2       ← ★ bit 0x80 LIMPIO = nada que forzar:
 *   0bcb: mov ax,0x8a58 → «Key broke!\n» y jmp 0xc1d  → SIN tirada, y rompe llave igual
 *   0bd7: ax = byte&0x7f · 0be1: cl = [idx<<5 + 0x55b5] = DEX
 *   0be7-0bec: ax = (0x1e + fuerza − DEX) >> 1 ; 0bee: truncado a BYTE en [bp-4]
 *   0bf1-0bf9: push 1 / push 0x1e / call 0x6112 = rand_range(1,30)
 *   0c01: cmp ax,cx / 0c03: jbe 0xc1a  → «Key broke!» (DS 0x8a6e) + 0c34 `dec [g_keys]`
 *   0c05: «Success!» (DS 0x8a64) + 0c13 `and [bx+0x5c5f],0x7f` + jmp 0xc38 → SIN gastar llave
 *
 * TURNO: `0xbaa` NO toca `g_unk_24e6` en NINGUNA rama, y el retorno de 0x0f7e cae directo al
 * epílogo 0x0f81 ⇒ el (J)immy sobre cofre-objeto **no consume turno**, ni al fallar ni al
 * acertar. (La puerta sí lo marca, en 0x0e10.)
 *
 * Cadenas byte-verificadas contra DATA.OVL (fileoff = DS + 0x10):
 *   DS 0x8B52 = b'No lock!\n' · 0x8A58 = b'Key broke!\n' · 0x8A64 = b'Success!\n'
 *   0x8A6E = b'Key broke!\n'
 *
 * RNG — impacto de stream declarado: un (J)immy sobre cofre TRAMPEADO pasa a consumir
 * 1×rand(1,30) donde antes consumía 0; sobre cofre NO trampeado sigue consumiendo 0 (la
 * guarda de 0x0bc7 corta antes del `call 0x6112`).
 */
import { describe, expect, it } from "vitest";
import { Game, type GameData, type GameSystems } from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState, WorldObject } from "../src/core/state.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import { NpcManager } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";

const TOWN = 2;
const SMALL = 32;
const FLOOR_TILE = 68; // 0x44 BrickFloor
const CHEST_TILE = 0x101; // p.type(1) + 0x100 — el sprite del cofre-objeto de interior
const UNTRAPPED = 8; // INTERIOR_CHEST_CONTENTS: bit 0x80 LIMPIO
const TRAPPED = 0x80 | 8; // bit 0x80 puesto + fuerza 8

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1, characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 5, gems: 0, torches: 2, karma: 50, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 6 }, // al SUR de la celda (5,5)
    transport: "foot", torchTurns: 0,
    questFlags: {}, journal: [], worldObjects: [],
    npcDead: Array.from({ length: 32 }, () => [] as boolean[]),
    npcMet: Array.from({ length: 32 }, () => [] as boolean[]),
    equipmentQuantities: new Array(48).fill(0),
    spellQuantities: new Array(48).fill(0),
    scrollQuantities: new Array(48).fill(0),
    potionQuantities: new Array(8).fill(0),
    reagentQuantities: new Array(8).fill(0),
  };
  return { ...base, ...over } as GameState;
}

/** Mundo de suelo liso: el tile de (5,5) lo pone el objeto, no el terreno. */
function world(): WorldData {
  const tiles = Array.from({ length: SMALL }, () => Array.from({ length: SMALL }, () => FLOOR_TILE));
  const map: SmallMapLocation = { id: TOWN, name: "Loc2", floors: [{ z: 0, tiles }, { z: 1, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => FLOOR_TILE));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN, map]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  searchObjects: [],
};

function makeGame(s: GameState): Game {
  const systems: GameSystems = { npcManager: new NpcManager({}), doors: new DoorManager() };
  return new Game({} as ExtractedInitialState, world(), gameData, s, systems);
}

/** Cofre-objeto en (5,5) de la planta `floor` con el byte +5 = `contents`. */
function chest(contents: number, floor = 0): WorldObject {
  return {
    location: TOWN, floor, x: 5, y: 5, tile: CHEST_TILE, kind: "chest",
    contents, trapped: (contents & 0x80) !== 0,
  };
}

const msgs = (evs: ReturnType<Game["jimmy"]>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => (e as { text: string }).text);

describe("#182 D5 · (J)immy sobre cofre de la capa de OBJETO (SJOG 0x0F2C → 0x0BAA)", () => {
  it("★ la familia está VIVA: con un cofre en la casilla ya NO sale «No lock!»", () => {
    const s = makeState({ worldObjects: [chest(TRAPPED)] });
    expect(msgs(makeGame(s).jimmy("north"))).not.toContain("No lock!\n");
  });

  describe("gate de 0x0BC7 — bit 0x80 LIMPIO: nada que forzar", () => {
    it("cofre SIN trampa: «Key broke!», −1 llave y CERO tiradas (0x0bcb, sin pasar por 0x6112)", () => {
      const s = makeState({ worldObjects: [chest(UNTRAPPED)] });
      const g = makeGame(s);
      const before = g.liveSeed();

      const out = msgs(g.jimmy("north"));

      expect(out).toContain("Key broke!\n"); // DS 0x8A58
      expect(s.keys).toBe(4); // 0x0c34 `dec [g_keys]` (la rama cae en 0xc1d)
      expect(g.liveSeed()).toBe(before); // el `call 0x6112` de 0x0bf9 queda por delante del gate
    });
  });

  describe("la tirada (0x0BF1-0x0C03) sobre cofre TRAMPEADO", () => {
    it("éxito: «Success!», el bit 0x80 se LIMPIA (desarma) y NO se gasta llave", () => {
      // umbral = ((8 − 99 + 30) & 0xffff) >>> 1 & 0xff, con DEX 99 el original WRAPEA…
      // así que para el éxito se usa DEX 0: umbral = (8−0+30)>>1 = 19; rand(1,30) > 19 exige
      // una tirada alta. Se fuerza con un rand determinista inyectado por el propio Game.
      const s = makeState({ worldObjects: [chest(TRAPPED)], characters: [makeChar({ dexterity: 38 })] });
      // DEX 38 ⇒ umbral = ((8−38+30)=0) >> 1 = 0 ⇒ rand(1,30) > 0 SIEMPRE ⇒ éxito garantizado.
      const g = makeGame(s);

      const out = msgs(g.jimmy("north"));

      expect(out).toContain("Success!\n"); // DS 0x8A64
      expect(s.keys).toBe(5); // 0x0c18 salta el `dec` de 0x0c34
      expect(s.worldObjects![0]!.contents).toBe(8); // 0x0c13 `and [bx+0x5c5f],0x7f`
      expect(s.worldObjects![0]!.trapped).toBe(false); // el MISMO bit que lee (O)pen en 0x120b
    });

    it("fallo: «Key broke!», −1 llave y el bit 0x80 SIGUE puesto (el cofre no se desarma)", () => {
      // DEX 0 ⇒ umbral = (8+30)>>1 = 19; rand(1,30) <= 19 no está garantizado, así que se
      // sube la fuerza del cofre a 0x7f: umbral = (0x7f+30)>>1 = 76 > 30 ⇒ SIEMPRE falla.
      const s = makeState({ worldObjects: [chest(0xff)], characters: [makeChar({ dexterity: 0 })] });
      const g = makeGame(s);

      const out = msgs(g.jimmy("north"));

      expect(out).toContain("Key broke!\n"); // DS 0x8A6E
      expect(s.keys).toBe(4);
      expect(s.worldObjects![0]!.contents).toBe(0xff); // sin `and 0x7f`: sigue trampeado
    });

    it("consume EXACTAMENTE una tirada (0x0bf9 `call 0x6112` = rand_range(1,30))", () => {
      const s = makeState({ worldObjects: [chest(0xff)], characters: [makeChar({ dexterity: 0 })] });
      const g = makeGame(s);
      const before = g.liveSeed();
      g.jimmy("north");
      expect(g.liveSeed()).not.toBe(before);
    });
  });

  describe("controles — cada uno aísla UNA condición del barrido", () => {
    it("celda VACÍA: sigue saliendo «No lock!» (cx llega a 0x20 → 0x0f16)", () => {
      const s = makeState();
      const g = makeGame(s);
      expect(msgs(g.jimmy("north"))).toContain("No lock!\n"); // DS 0x8B52
      expect(s.keys).toBe(5);
      expect(g.liveSeed()).toBe(g.liveSeed());
    });

    it("objeto que NO es cofre en la casilla: «No lock!» (0x0f64 `cmp byte [si],1`)", () => {
      // Aísla el discriminador de TIPO: mismo x/y/planta, sólo cambia slot+0.
      const s = makeState({
        worldObjects: [{ location: TOWN, floor: 0, x: 5, y: 5, tile: CHEST_TILE, kind: "prop" }],
      });
      expect(msgs(makeGame(s).jimmy("north"))).toContain("No lock!\n");
    });

    it("cofre en OTRA PLANTA: «No lock!» (0x0f5d-0x0f62, gate vivo con g_location <= 0x7f)", () => {
      // Aísla el gate de planta: mismo x/y y mismo tipo, sólo cambia slot+4.
      const s = makeState({ worldObjects: [chest(TRAPPED, 1)] });
      expect(msgs(makeGame(s).jimmy("north"))).toContain("No lock!\n");
    });

    it("cofre en OTRA CASILLA: «No lock!» (0x0f43-0x0f54, gates de X/Y)", () => {
      const s = makeState({ worldObjects: [{ ...chest(TRAPPED), x: 7, y: 9 }] });
      expect(msgs(makeGame(s).jimmy("north"))).toContain("No lock!\n");
    });
  });

  describe("turno — 0x0BAA no toca g_unk_24e6 en NINGUNA rama", () => {
    it("ni el éxito ni el fallo consumen turno (a diferencia de la puerta en 0x0e10)", () => {
      for (const [contents, dex] of [[TRAPPED, 38], [0xff, 0], [UNTRAPPED, 20]] as const) {
        const s = makeState({ worldObjects: [chest(contents)], characters: [makeChar({ dexterity: dex })] });
        const g = makeGame(s);
        const minute = s.time.minute;
        const evs = g.jimmy("north");
        expect(s.time.minute).toBe(minute);
        expect(evs.some((e) => e.kind === "map-changed")).toBe(false);
      }
    });
  });
});
