/**
 * AUDITORÍA «byte-wrap / rango no esperado» (re/notes/audit-byte-wrap.md) —
 * tests de las DIVERGENCIAS corregidas: sitios donde el binario opera la resta
 * `CONST − stat` en 16-bit y la parte con `shr` (shift SIN SIGNO), de modo que
 * un stat editado fuera de rango (DEX/INT > 30-ish) WRAPEA a un umbral enorme
 * (comportamiento absurdo pero FIEL), mientras el port usaba `>>` con signo
 * (umbral negativo → el comportamiento CONTRARIO). Hermanos del quirk DEX-99
 * de iniciativa (combat-rats-cycle.test.ts).
 *
 * Citas (re/disasm/):
 *  - SJOG 0x0BAA jimmy cofre-objeto: 0x0be7 `sub ax,cx` (word) / 0x0bec `d1e8
 *    shr ax,1` / 0x0bee `mov [bp-4],al` (trunca a BYTE) / 0x0bfc-0x0c03 cmp
 *    word roll vs byte re-extendido.
 *  - SJOG 0x0C3E jimmy cofre-mazmorra: 0x0ca0-0x0ca6 `sub/add/shr` word,
 *    umbral WORD [bp-4] (0x0ca8), cmp 0x0cf1 `jle` = roll ≤ umbral FALLA.
 *  - SJOG 0x02EA trap-check: ambas ramas convergen en 0x0330 `d1e8 shr ax,1`;
 *    rama no-atrapada 0x0311-0x0314 `sub ax,0x1e; neg ax` (= 30−stat, word).
 *  - SJOG 0x0646 search de mazmorra: umbral 0x06c5-0x06cf `shl/sub/add/shr`
 *    word (0x06cf `d1e8`), guardado WORD (0x06d1).
 *  - MAINOUT 0x1B3E peaje troll: toll = 0x63 − 3·STR en WORD CON SIGNO
 *    (0x1b5e-0x1b65 `shl/add/sub/neg`); el prompt corre SIEMPRE tras el fallo
 *    de DEX y el pago 0x1ba9 `sub g_gold,ax` con toll negativo SUMA oro
 *    (gate de solvencia 0x1bb2 `jge` con signo). Ver prompts-troll.test.ts
 *    para el flujo completo con STR 99.
 */
import { describe, it, expect } from "vitest";
import { jimmyLock } from "../src/core/world/commands.js";
import { trapThreshold, trapCheck } from "../src/core/world/traps.js";
import { trollToll } from "../src/core/world/loops/hazards.js";
import {
  DungeonState,
  CellType,
  type DungeonCell,
  type DungeonData,
  type DungeonPos,
} from "../src/core/dungeon/index.js";
import type { OriginalRng } from "../src/core/rng-original.js";
import {
  createNewGame,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function freshState(over: Partial<GameState> = {}): GameState {
  const s = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  return Object.assign(s, over);
}

/** RNG stub con secuencia determinista (firma next(lo,hi) del OriginalRng). */
function seqRng(values: number[]): OriginalRng {
  const q = [...values];
  return { next: () => q.shift() ?? 0 } as unknown as OriginalRng;
}

const synthDungeon = (
  cells: { f?: number; x: number; y: number; cell: DungeonCell }[],
): DungeonData => {
  const floors: DungeonCell[][][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ type: CellType.Nothing, sub: 0 })),
    ),
  );
  for (const c of cells) floors[c.f ?? 0]![c.y]![c.x] = c.cell;
  return { location: 33, name: "Synth", floors };
};

const mkPos = (over: Partial<DungeonPos> = {}): DungeonPos => ({
  dungeon: 33,
  floor: 0,
  x: 3,
  y: 3,
  facing: "north",
  ...over,
});

describe("jimmy cofre-objeto (SJOG 0x0BAA): umbral 16-bit shr + trunc a byte", () => {
  const rand = (lo: number, _hi: number): number => (lo === 1 ? 30 : 0); // roll máx

  it("DEX legítima (≤30): sin wrap — roll 30 > umbral → Success!", () => {
    // tile 0x8a: bit 0x80 = cerrado, dificultad 10. (10−20+30)>>1 = 10 < 30.
    const r = jimmyLock({ kind: "chestObject", tile: 0x8a, dex: 20 }, rand);
    expect(r.success).toBe(true);
  });

  it("DEX 99 editada: el original WRAPEA (umbral 0xE2=226) → 'Key broke!' SIEMPRE, ni con roll 30", () => {
    // (10−99+30)&0xffff = 0xffc5; shr → 0x7fe2; AL → 0xe2 = 226 ≥ roll 30.
    const r = jimmyLock({ kind: "chestObject", tile: 0x8a, dex: 99 }, rand);
    expect(r.success).toBe(false);
    expect(r.keyBroke).toBe(true);
    expect(r.message).toBe("Key broke!\n");
  });
});

describe("jimmy cofre-mazmorra (SJOG 0x0C3E): umbral 16-bit shr, word", () => {
  const rand = (_lo: number, _hi: number): number => 30;

  it("DEX legítima (≤30): umbral pequeño → desarma con roll alto", () => {
    // floor 0: (0−20+30)>>1 = 5 < 30 → éxito.
    const r = jimmyLock({ kind: "dungeonChest", tile: 0x43, dex: 20, floor: 0 }, rand);
    expect(r.success).toBe(true);
  });

  it("DEX 99 editada: umbral 32733 → 'Key broke!' SIEMPRE (planta 0)", () => {
    // (0−99+30)&0xffff = 0xffbb; >>>1 = 0x7fdd = 32733 ≥ cualquier roll.
    const r = jimmyLock({ kind: "dungeonChest", tile: 0x43, dex: 99, floor: 0 }, rand);
    expect(r.success).toBe(false);
    expect(r.keyBroke).toBe(true);
  });
});

describe("trap-check de cofre (SJOG 0x02EA): umbral 16-bit shr en ambas ramas", () => {
  it("INT legítima: umbrales sin wrap (30→0 no-atrapado; diff 20/INT 20 → 15)", () => {
    expect(trapThreshold(0x00, 30)).toBe(0);
    expect(trapThreshold(0x80 | 0x14, 20)).toBe(15);
  });

  it("INT 99 editada, no atrapado: (30−99) wrapea a 32733 → la percepción FALLA SIEMPRE", () => {
    expect(trapThreshold(0x00, 99)).toBe(0x7fdd); // ((30−99)&0xffff)>>>1
    // !success && !trapped → falso positivo "a trap!" incluso con roll 30.
    const r = trapCheck({ difficulty: 0x00, perceptionStat: 99, roll: 30 });
    expect(r.success).toBe(false);
    expect(r.message).toBe("a trap!\n");
  });

  it("INT 99 editada, atrapado diff 20: wrap → nunca identifica la trampa", () => {
    expect(trapThreshold(0x80 | 0x14, 99)).toBeGreaterThan(30);
    const r = trapCheck({ difficulty: 0x80 | 0x14, perceptionStat: 99, roll: 30 });
    expect(r.success).toBe(false);
    expect(r.message).toBe("no trap!\n"); // !success && trapped → no la ve
  });
});

describe("search de mazmorra (SJOG 0x0646): umbral 16-bit shr, word (0x06cf)", () => {
  const chestAhead = () =>
    synthDungeon([{ x: 3, y: 2, cell: { type: CellType.Chest, sub: 3 } }]);

  it("DEX legítima 30, planta 0: umbral 0 → roll 30 > 0 → 'No trap'", () => {
    const ds = new DungeonState([chestAhead()], mkPos(), seqRng([30]));
    const st = freshState({ torchTurns: 10 });
    st.characters[0]!.dexterity = 30;
    const texts = ds
      .search(st, { searcherIdx: 0 })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(texts).toContain("No trap");
  });

  it("DEX 99 editada: umbral 32733 → NUNCA 'No trap' (clasifica trampa siempre)", () => {
    // roll1=30 ≤ 32733 → rama trampa; roll2=2 (<4) → 'A simple trap'.
    const ds = new DungeonState([chestAhead()], mkPos(), seqRng([30, 2]));
    const st = freshState({ torchTurns: 10 });
    st.characters[0]!.dexterity = 99;
    const texts = ds
      .search(st, { searcherIdx: 0 })
      .filter((e) => e.kind === "message")
      .map((e) => e.text);
    expect(texts).not.toContain("No trap");
    expect(texts).toContain("A simple trap");
  });
});

describe("peaje del troll (MAINOUT 0x1B3E): toll 16-bit CON SIGNO, sin gate de signo", () => {
  it("rango legítimo: STR 30 → 9; STR 20 → 39", () => {
    expect(trollToll(30)).toBe(9);
    expect(trollToll(20)).toBe(39);
  });

  it("STR editada ≥ 33: toll 0 o NEGATIVO (0x1b62-0x1b65 sub/neg word) — pagar REGALA oro", () => {
    expect(trollToll(33)).toBe(0);
    expect(trollToll(34)).toBe(-3);
    expect(trollToll(99)).toBe(-198);
  });
});
