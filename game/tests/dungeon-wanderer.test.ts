/**
 * Monstruo ERRANTE de mazmorra 3D + arena procedural del combate de pasillo.
 * Derivación completa con citas: re/notes/dungeon-wanderer.md (DUNGEON.OVL
 * 0x0134/0x0252/0x07E2/0x0B7E/0x1D4A; DNGLOOK.OVL 0x0D3E/0x0C6C/0x0B9E/0x0AEE/
 * 0x097E/0x0A48/0x117E; tablas DATA.OVL verificadas DS+0x10).
 */
import { describe, it, expect } from "vitest";
import {
  respawnWanderer,
  spawnWandererPos,
  moveWanderer,
  ambushDirection,
  inactiveWanderer,
  buildCorridorCombatMap,
  corridorTilesFor,
  WANDERER_INACTIVE,
  WANDERER_BANK_TYPES,
  WANDERER_BANK_ATTRS,
  type WandererState,
  type CellTypeAt,
} from "../src/core/dungeon/wanderer.js";
import {
  DungeonState,
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import type { OriginalRng } from "../src/core/rng-original.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
function freshState(over: Partial<GameState> = {}): GameState {
  const s = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  return Object.assign(s, over);
}

/** rand guionizado: devuelve la secuencia en orden y FALLA si se consume de más. */
function seqRand(values: number[]): { rand: (lo: number, hi: number) => number; used: () => number } {
  let i = 0;
  return {
    rand: (lo: number, hi: number): number => {
      if (i >= values.length) throw new Error(`rand agotado (${i})`);
      const v = values[i++]!;
      if (v < lo || v > hi) throw new Error(`rand[${i - 1}]=${v} fuera de [${lo},${hi}]`);
      return v;
    },
    used: () => i,
  };
}

const openGrid: CellTypeAt = () => CellType.Nothing;
const wallGrid: CellTypeAt = () => CellType.Wall;

function mkWanderer(over: Partial<WandererState> = {}): WandererState {
  return { ...inactiveWanderer(), type: 0x14, bank: 0, floor: 0, x: 4, y: 4, prevX: 4, prevY: 4, ...over };
}

describe("respawn del errante (DUNGEON 0x0134 + spawn 0x0252)", () => {
  it("rand(0,7) elige banco → tipo (0x173C) y attr (0x1744); spawn en off=rand(0,63)", () => {
    // banco 5 = Gremlin 0x19 attr 0x60; off 27 → x=3,y=3 (party en 1,1: ni fila ni columna).
    const { rand, used } = seqRand([5, 27]);
    const w = respawnWanderer(0, 1, 1, openGrid, rand);
    expect(w.type).toBe(0x19);
    expect(w.attr).toBe(0x60);
    expect(w.bank).toBe(5);
    expect([w.x, w.y]).toEqual([3, 3]);
    expect([w.prevX, w.prevY]).toEqual([3, 3]);
    expect(w.hidden).toBe(false);
    expect(used()).toBe(2);
  });

  it("veto de FILA y COLUMNA de la party (0x02b1-0x02c3: x==px O y==py rechaza)", () => {
    // party (3,1): off 27 (x3==px), off 12 (x4,y1==py), off 18 (x2,y2 OK).
    const { rand } = seqRand([0, 27, 12, 18]);
    const w = respawnWanderer(0, 3, 1, openGrid, rand);
    expect([w.x, w.y]).toEqual([2, 2]);
  });

  it("celdas no-spawn (hi≥6 salvo 0x7) se rechazan; 8 fallos → INACTIVO (0x0310)", () => {
    const { rand, used } = seqRand([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const w = respawnWanderer(0, 7, 7, wallGrid, rand);
    expect(w.type).toBe(WANDERER_INACTIVE);
    expect(w.x).toBe(0xff);
    expect(used()).toBe(9); // banco + 8 intentos
  });

  it("spawn permitido sobre escaleras/cofre/fuente/OpenChest (hi<6 ó ==7)", () => {
    const grid: CellTypeAt = (_f, x, _y) => (x === 2 ? CellType.OpenChest : CellType.Wall);
    const w = mkWanderer({ type: 0x14 });
    const { rand } = seqRand([18]); // off 18 → x=2,y=2
    expect(spawnWandererPos(w, 0, 7, 7, grid, rand)).toBe(true);
  });

  it("araña/slime (0x16/0x18): rand(0,99)>0x30 → OCULTO (51%, 0x02d6-0x02f3)", () => {
    const oculto = respawnWanderer(0, 1, 1, openGrid, seqRand([2, 27, 49]).rand);
    expect(oculto.type).toBe(0x16);
    expect(oculto.hidden).toBe(true);
    const visible = respawnWanderer(0, 1, 1, openGrid, seqRand([4, 27, 48]).rand);
    expect(visible.type).toBe(0x18);
    expect(visible.hidden).toBe(false);
    // Los tipos sin roll no consumen el rand extra.
    const rata = seqRand([0, 27]);
    respawnWanderer(0, 1, 1, openGrid, rata.rand);
    expect(rata.used()).toBe(2);
  });

  it("tablas banco→tipo/attr calcadas (DATA.OVL 0x173C/0x1744)", () => {
    expect(WANDERER_BANK_TYPES).toEqual([0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1c, 0x1b]);
    expect(WANDERER_BANK_ATTRS).toEqual([0x60, 0xa0, 0x00, 0x90, 0x80, 0x60, 0x00, 0x00]);
  });
});

describe("movimiento del errante (DUNGEON 0x07E2)", () => {
  it("rand(0,3) elige dir N/E/S/W (tablas 0x24D6/0x24DE) y se mueve", () => {
    const w = mkWanderer();
    const moved = moveWanderer(w, 0, 0, openGrid, seqRand([0]).rand);
    expect(moved).toBe(false);
    expect([w.x, w.y]).toEqual([4, 3]); // norte
    expect([w.prevX, w.prevY]).toEqual([4, 4]);
  });

  it("WRAP del destino: >7→0 y <0→7 (0x0858-0x087f)", () => {
    const w = mkWanderer({ x: 7, y: 0, prevX: 7, prevY: 0 });
    moveWanderer(w, 3, 3, openGrid, seqRand([1]).rand); // este desde x=7
    expect(w.x).toBe(0);
    const w2 = mkWanderer({ x: 4, y: 0, prevX: 4, prevY: 0 });
    moveWanderer(w2, 3, 3, openGrid, seqRand([0]).rand); // norte desde y=0
    expect(w2.y).toBe(7);
  });

  it("rechaza trampa (0x6), campo (0x8) y ≥0xA; 8 fallos → quieto (0x08e4)", () => {
    const grid: CellTypeAt = (_f, x, y) => {
      if (x === 4 && y === 3) return CellType.Trap;
      if (x === 5 && y === 4) return CellType.MagicField;
      if (x === 4 && y === 5) return CellType.Room;
      return CellType.Wall; // (3,4) muro
    };
    const w = mkWanderer();
    const { rand, used } = seqRand([0, 1, 2, 3, 0, 1, 2, 3]);
    expect(moveWanderer(w, 0, 0, grid, rand)).toBe(false);
    expect([w.x, w.y]).toEqual([4, 4]); // no se movió
    expect(used()).toBe(8);
  });

  it("pisar a la party exige rand(0,7)==1; al lograrlo REVIERTE y devuelve true (0x08be/0x092a)", () => {
    // party al norte (4,3). Gate falla (0!=1) → cuenta intento; luego dir sur (2) mueve normal.
    const w = mkWanderer();
    const fail = seqRand([0, 0, 2]);
    expect(moveWanderer(w, 4, 3, openGrid, fail.rand)).toBe(false);
    expect([w.x, w.y]).toEqual([4, 5]);
    // Gate acierta: mueve sobre la party → revert a prev y ataca.
    const w2 = mkWanderer();
    expect(moveWanderer(w2, 4, 3, openGrid, seqRand([0, 1]).rand)).toBe(true);
    expect([w2.x, w2.y]).toEqual([4, 4]); // revertido (nunca ocupa la celda de la party)
  });

  it("Reaper (0x1B) NO se mueve ni consume rand (0x0810)", () => {
    const w = mkWanderer({ type: 0x1b });
    const { rand, used } = seqRand([]);
    expect(moveWanderer(w, 0, 0, openGrid, rand)).toBe(false);
    expect(used()).toBe(0);
    expect([w.x, w.y]).toEqual([4, 4]);
  });

  it("inactivo → no-op", () => {
    const w = inactiveWanderer();
    expect(moveWanderer(w, 0, 0, openGrid, seqRand([]).rand)).toBe(false);
  });
});

describe("dirección de la emboscada (DUNGEON 0x0b90-0x0bd0, wrap &7)", () => {
  it("desde la posición PREVIA: E→1, W→3, S→2, else 0", () => {
    expect(ambushDirection(mkWanderer({ prevX: 4, prevY: 3 }), 3, 3)).toBe(1); // al este
    expect(ambushDirection(mkWanderer({ prevX: 2, prevY: 3 }), 3, 3)).toBe(3); // al oeste
    expect(ambushDirection(mkWanderer({ prevX: 3, prevY: 4 }), 3, 3)).toBe(2); // al sur
    expect(ambushDirection(mkWanderer({ prevX: 3, prevY: 2 }), 3, 3)).toBe(0); // norte
  });
  it("wrap &7 en los bordes (monstruo en 0, party en 7)", () => {
    expect(ambushDirection(mkWanderer({ prevX: 0, prevY: 3 }), 7, 3)).toBe(1);
  });
});

describe("arena procedural del pasillo (DNGLOOK 0x0D3E/0x0C6C/0x0B9E)", () => {
  const build = (over: Partial<Parameters<typeof buildCorridorCombatMap>[0]> = {}, rands?: number[]) =>
    buildCorridorCombatMap(
      {
        floorTile: 0x05,
        wallTile: 0x4d,
        sides: ["wall", "wall", "wall", "wall"],
        partyCellType: 0,
        facing: "north",
        monsterType: 0x14,
        maxPerMap: 10,
        ...over,
      },
      seqRand(rands ?? [...Array(16).fill(0), 1]).rand,
    );

  it("suelo 11×11 + muros filas/cols 1 y 9 + esquinas del anillo en negro", () => {
    const m = build();
    expect(m.tiles[5]![4]).toBe(0x05);
    expect(m.tiles[1]![5]).toBe(0x4d);
    expect(m.tiles[9]![5]).toBe(0x4d);
    expect(m.tiles[5]![1]).toBe(0x4d);
    expect(m.tiles[5]![9]).toBe(0x4d);
    expect(m.tiles[0]![0]).toBe(0xff);
    expect(m.tiles[10]![10]).toBe(0xff);
  });

  it("lado PASABLE abre el tramo 2-8 (0x0AEE); puerta/sala abre 3-7 (0x0A48); muro ciega el borde (0x097E)", () => {
    const m = build({ sides: ["open", "wall", "doorway", "wall"] });
    for (let i = 2; i <= 8; i++) expect(m.tiles[1]![i]).toBe(0x05); // norte abierto
    expect(m.tiles[9]![2]).toBe(0x4d); // sur: 2 sigue muro
    for (let i = 3; i <= 7; i++) expect(m.tiles[9]![i]).toBe(0x05); // sur doorway 3-7
    for (let i = 0; i < 11; i++) {
      expect(m.tiles[i]![10]).toBe(0xff); // este ciego → borde negro
      expect(m.tiles[i]![0]).toBe(0xff); // oeste ciego
    }
    expect(m.tiles[5]![9]).toBe(0x4d); // muro este intacto
  });

  it("FEATURE de la celda al centro (tabla 0x244A): escalera/cofre/fuente", () => {
    expect(build({ partyCellType: CellType.LadderUp }).tiles[5]![5]).toBe(0xc8);
    expect(build({ partyCellType: CellType.LadderDown }).tiles[5]![5]).toBe(0xc9);
    expect(build({ partyCellType: CellType.LadderUpDown }).tiles[5]![5]).toBe(0xc8);
    expect(build({ partyCellType: CellType.Chest }).tiles[5]![5]).toBe(0xdc);
    expect(build({ partyCellType: CellType.Fountain }).tiles[5]![5]).toBe(0xd8);
    expect(build({ partyCellType: CellType.Nothing }).tiles[5]![5]).toBe(0x05);
  });

  it("party SOBRE puerta (0xE): tapones del marco en los lados muro 0 y 3 (0x0a1b-0x0a3c)", () => {
    const m = build({ partyCellType: CellType.NormalDoor });
    expect(m.tiles[2]![5]).toBe(0x4d);
    expect(m.tiles[8]![5]).toBe(0x4d);
    expect(m.tiles[5]![2]).toBe(0x4d);
    expect(m.tiles[5]![8]).toBe(0x4d);
  });

  it("playerStarts calcados: E x∈{6..8}, W x∈{2..4}, S y∈{6..8}, N y∈{2..4} (tablas 0x245E-0x2470)", () => {
    const m = build();
    expect(m.playerStarts.east.map((p) => p.x)).toEqual([6, 7, 7, 8, 8, 8]);
    expect(m.playerStarts.west.map((p) => p.x)).toEqual([4, 3, 3, 2, 2, 2]);
    expect(m.playerStarts.south.map((p) => p.y)).toEqual([6, 7, 7, 8, 8, 8]);
    expect(m.playerStarts.north.map((p) => p.y)).toEqual([4, 3, 3, 2, 2, 2]);
  });

  it("enemigos DELANTE de la party por facing (tablas espejadas 0x2476-0x24A6)", () => {
    const north = build({}, [...Array(16).fill(0), 1]);
    expect(north.units.every((u) => u.y <= 4)).toBe(true);
    const south = build({ facing: "south" }, [...Array(16).fill(0), 1]);
    expect(south.units.every((u) => u.y >= 6)).toBe(true);
    const east = build({ facing: "east" }, [...Array(16).fill(0), 1]);
    expect(east.units.every((u) => u.x >= 6)).toBe(true);
  });

  // ⚠ CORREGIDO por la ficha #20. Este test decía «max 16 y max 8 = conteo FIJO
  // SIN rand (0x0f79)» y sembraba sólo 16 tiradas — o sea que fijaba como
  // invariante, y con cita, justo el defecto: saltarse la tirada del conteo.
  // La lectura del CUERPO ENTERO (asm100 tanda 19, sellada en el ledger) dice otra
  // cosa: `rand_range(byte[tipo*8+0x13c2], 1)` se tira SIEMPRE y, cuando el byte
  // vale 8 ó 0x10, el resultado se SOBRESCRIBE con el tope. Lo fijo es el CONTEO,
  // no el consumo. Ver «coste de RNG del encuentro de pasillo» más abajo.
  it("conteo = rand(1,maxPerMap); con max 8/16 el conteo es fijo pero la tirada SE GASTA", () => {
    // rata max 10: 16 rands de barajado + 1 de conteo (=3).
    const rata = build({}, [...Array(16).fill(0), 3]);
    expect(rata.units.length).toBe(3);
    // murciélago max 16: 16 del barajado + la del conteo, que se tira y se descarta.
    const seq = seqRand([...Array(16).fill(0), 2]);
    const bate = buildCorridorCombatMap(
      { floorTile: 5, wallTile: 0x4d, sides: ["wall", "wall", "wall", "wall"], partyCellType: 0, facing: "north", monsterType: 0x15, maxPerMap: 16 },
      seq.rand,
    );
    expect(bate.units.length).toBe(16); // el 2 se descarta: manda el tope
    expect(seq.used()).toBe(17); // pero la tirada SÍ se consumió
  });

  it("sprite del tipo = 0x40 + tipo·4 (≡ 320+idx·4 tras el +0x100 de fixedFromMap)", () => {
    const m = build({}, [...Array(16).fill(0), 1]);
    expect(m.units[0]!.sprite).toBe(0x40 + 0x14 * 4);
  });

  it("tiles por mazmorra (DUNGEON 0x0e86-0x0e9f): metal/ladrillo en Deceit/Wrong/Covetous, hierba/roca en el resto", () => {
    expect(corridorTilesFor(33)).toEqual({ floorTile: 0x45, wallTile: 0x4f });
    expect(corridorTilesFor(36)).toEqual({ floorTile: 0x45, wallTile: 0x4f });
    expect(corridorTilesFor(37)).toEqual({ floorTile: 0x45, wallTile: 0x4f });
    expect(corridorTilesFor(34)).toEqual({ floorTile: 0x05, wallTile: 0x4d });
    expect(corridorTilesFor(40)).toEqual({ floorTile: 0x05, wallTile: 0x4d });
  });
});

describe("integración DungeonState (bloqueo, attack, gates de tiempo)", () => {
  function synthDungeon(cells: { f?: number; x: number; y: number; cell: DungeonCell }[] = []): DungeonData {
    const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 }))),
    );
    for (const c of cells) floors[c.f ?? 0]![c.y]![c.x] = c.cell;
    return { location: 33, name: "Synth", floors };
  }
  function mkPos(over: Partial<DungeonPos> = {}): DungeonPos {
    return { dungeon: 33, floor: 0, x: 3, y: 3, facing: "north", ...over };
  }
  const stubRng = (value: number): OriginalRng => ({ next: () => value }) as unknown as OriginalRng;
  const throwRng = (): OriginalRng =>
    ({
      next: () => {
        throw new Error("rand consumido bajo An Tym");
      },
    }) as unknown as OriginalRng;

  function withWanderer(ds: DungeonState, x: number, y: number): void {
    ds.wanderer = mkWanderer({ x, y, prevX: x, prevY: y, floor: ds.pos.floor });
  }

  it("paso hacia el errante → 'Blocked!' sin mover (dng_move 0x067c, DS 0x2D23)", () => {
    const ds = new DungeonState([synthDungeon()], mkPos({ facing: "north" }), stubRng(5));
    withWanderer(ds, 3, 2);
    const evs = ds.forward(freshState());
    expect(evs.map((e) => e.text)).toEqual(["Advance\n", "Blocked!"]);
    expect(ds.pos.y).toBe(3);
  });

  it("(A)ttack con el errante ENCARADO (&7) → combate de pasillo; si no, 'What?' (0x1D4A)", () => {
    const ds = new DungeonState([synthDungeon()], mkPos({ facing: "north" }), stubRng(5));
    withWanderer(ds, 3, 2);
    const evs = ds.attack();
    expect(evs[0]!.text).toBe("Attack\n");
    expect(evs[1]).toMatchObject({ kind: "combat-corridor", corridorCause: "attack" });
    ds.pos.facing = "south";
    const miss = ds.attack();
    expect(miss.map((e) => e.text)).toEqual(["Attack\n", "What?\n"]);
  });

  it("(A)ttack con wrap &7: errante en y=7, party en y=0 mirando norte (0x1d72)", () => {
    const ds = new DungeonState([synthDungeon()], mkPos({ x: 3, y: 0, facing: "north" }), stubRng(5));
    withWanderer(ds, 3, 7);
    expect(ds.attack()[1]).toMatchObject({ kind: "combat-corridor" });
  });

  it("An Tym ('T') CONGELA al errante: turnTick no consume rand de movimiento (gate di, 0x0F34)", () => {
    const ds = new DungeonState([synthDungeon()], mkPos(), throwRng());
    withWanderer(ds, 6, 6);
    const st = freshState({ timeSpell: "T" });
    expect(ds.turnTick(st)).toEqual([]);
    expect([ds.wanderer.x, ds.wanderer.y]).toEqual([6, 6]);
  });

  it("Quickness ('Q') alterna turnos del mundo (di^=1, 0x0F25)", () => {
    const ds = new DungeonState([synthDungeon()], mkPos(), stubRng(2));
    withWanderer(ds, 6, 6);
    const st = freshState({ timeSpell: "Q" });
    ds.turnTick(st); // toggle 0→1: el mundo avanza (mueve con rand=2 → sur)
    expect([ds.wanderer.x, ds.wanderer.y]).toEqual([6, 7]);
    ds.turnTick(st); // toggle 1→0: congelado
    expect([ds.wanderer.x, ds.wanderer.y]).toEqual([6, 7]);
  });

  it("emboscada por turnTick: mensaje + GIRO al atacante + evento (0x0B7E)", () => {
    // Errante al ESTE de la party (4,3), party mirando norte. stubRng(1): dir rand=1
    // (oeste... no: 1=este→(5,3)? — con rand fijo 1: dir 1 = ESTE se aleja). Usamos
    // rng guionizado: dir 3 (oeste, hacia party) + gate 1 → ataque.
    const seq = [3, 1];
    let i = 0;
    const rng = { next: (lo: number) => seq[i++] ?? lo } as unknown as OriginalRng;
    const ds = new DungeonState([synthDungeon()], mkPos({ facing: "north" }), rng);
    withWanderer(ds, 4, 3);
    const evs = ds.turnTick(freshState());
    expect(evs[0]!.text).toBe("Attacked from the east!");
    expect(ds.pos.facing).toBe("east");
    expect(evs.some((e) => e.kind === "combat-corridor" && e.corridorCause === "ambush")).toBe(true);
    // El errante NO ocupa la celda de la party (revert).
    expect([ds.wanderer.x, ds.wanderer.y]).toEqual([4, 3]);
  });

  it("emboscada de FRENTE (dir==facing): mensaje corto 'Attacked!' sin giro (0x0bd5)", () => {
    // Errante al NORTE de la party (3,2), party mirando norte: dir sur (2) lo lleva
    // a la party; ambushDirection desde prev (3,2) → 0 (norte) == facing → sin giro.
    const seq = [2, 1];
    let i = 0;
    const rng = { next: (lo: number) => seq[i++] ?? lo } as unknown as OriginalRng;
    const ds = new DungeonState([synthDungeon()], mkPos({ facing: "north" }), rng);
    withWanderer(ds, 3, 2);
    const evs = ds.turnTick(freshState());
    expect(evs[0]!.text).toBe("Attacked!");
    expect(ds.pos.facing).toBe("north");
  });

  it("respawn en cambio de planta (0x1CDB): magicChangeLevel re-arma el errante", () => {
    const ds = new DungeonState([synthDungeon()], mkPos(), stubRng(0));
    ds.wanderer = inactiveWanderer();
    const evs = ds.magicChangeLevel(freshState(), 1);
    expect(evs.some((e) => e.kind === "floor-changed")).toBe(true);
    // stubRng(0): banco 0 (rata), off 0 → spawn en (0,0); party (3,3) ✓ ni fila ni
    // columna. El MISMO turno corre on_enter (0x0F84) → el errante ya se mueve:
    // dir 0 (norte) con wrap y=0→7 deja (0,7) y prev=(0,0). Cadencia calcada.
    expect(ds.wanderer.type).toBe(0x14);
    expect([ds.wanderer.x, ds.wanderer.y]).toEqual([0, 7]);
    expect([ds.wanderer.prevX, ds.wanderer.prevY]).toEqual([0, 0]);
    expect(ds.wanderer.floor).toBe(1);
  });
});

// --- Coste de RNG del encuentro de mazmorra (ficha #20) ---------------------
//
// `build_first_person_11x11` (DNGLOOK.OVL:0x0d3e) es el COMPOSITOR DEL ENCUENTRO —
// sus dos únicos llamadores son `dng_ambush` (DUNGEON:0x0c43) y `dng_attack`
// (DUNGEON:0x1da5). Su coste de rand está sellado en el ledger:
//   fase (G): Fisher-Yates COMPLETO de 16 words — `arr[i]=i`, y para i=0..15
//     `r = rand_range(0,0xf)` + `swap(arr[i],arr[r])` ⇒ **16 tiradas EXACTAS**.
//   fase (H): `rand_range(byte[tipo*8+0x13c2], 1)` **SIEMPRE**, más un
//     `rand_range(0,7)` si `g_unk_58a1 & 4` ⇒ total **17 ó 18** por encuentro.
//
// ★ LA TRAMPA: si ese byte de tope vale 8 ó 0x10, el resultado de la tirada se
// PISA con el propio tope — el tamaño del grupo es fijo, pero **la tirada se gasta
// igual**. Es una tirada CONSUMIDA cuyo resultado se descarta: cuenta para el
// STREAM aunque no para el juego. Saltársela desincroniza el RNG justo al entrar
// en combate de mazmorra, que es de donde cuelga la semilla del combate entero.
describe("coste de RNG del encuentro de pasillo (ficha #20)", () => {
  const buildWith = (maxPerMap: number, seq: ReturnType<typeof seqRand>) =>
    buildCorridorCombatMap(
      {
        floorTile: 0x05,
        wallTile: 0x4d,
        sides: ["wall", "wall", "wall", "wall"],
        partyCellType: 0,
        facing: "north",
        monsterType: 0x14,
        maxPerMap,
      },
      seq.rand,
    );

  it("tope 8: la tirada del conteo SE GASTA aunque el tope la pise (17, no 16)", () => {
    const seq = seqRand([...Array(16).fill(0), 3]); // 16 barajado + 1 conteo
    const m = buildWith(8, seq);
    expect(seq.used()).toBe(17); // con el defecto: 16 (se salta la tirada)
    expect(m.units.length).toBe(8); // el 3 se DESCARTA: manda el tope
  });

  it("tope 16: idem — tirada gastada, conteo fijo", () => {
    const seq = seqRand([...Array(16).fill(0), 2]);
    const m = buildWith(16, seq);
    expect(seq.used()).toBe(17); // con el defecto: 16
    expect(m.units.length).toBe(16);
  });

  it("CONTROL — tope 10 (ni 8 ni 16): 17 tiradas y el conteo SÍ manda", () => {
    const seq = seqRand([...Array(16).fill(0), 4]);
    const m = buildWith(10, seq);
    expect(seq.used()).toBe(17); // este caso ya era correcto ANTES del fix
    expect(m.units.length).toBe(4);
  });

  it("el barajado son 16 tiradas EXACTAS de rand(0,15) (Fisher-Yates completo)", () => {
    const seq = seqRand([...Array(16).fill(15), 1]);
    buildWith(10, seq);
    expect(seq.used()).toBe(17);
  });
});
