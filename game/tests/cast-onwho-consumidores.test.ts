/**
 * In Mani Corp NO RESUCITABA fuera de combate — y la guarda de CLASE que lo caza.
 *
 * SÍNTOMA MEDIDO (carril de vídeos, sonda en vivo sobre el (C)ast de exterior): el
 * hechizo se consumía (99→98) y el maná se cobraba (30→22 = círculo 8), pero no salía
 * el prompt «On who: » y el compañero seguía muerto. `cast.ts` case 42 SÍ devolvía
 * `{kind:"resurrect"}`; el hueco estaba en el consumidor: `main.ts doCast` tenía rama
 * para `healTarget`/`cure`/`awaken` y NO para `resurrect` (y `doDungeonCast` lo dejaba
 * caer en su `else`, que sólo cobra el turno).
 *
 * ── LA POBLACIÓN, DERIVADA DEL BINARIO (no de la lista de ramas del port) ──────────
 *
 * El dispatcher del Cast salta por la jump table `CAST.OVL:0x1146` (48 words; entrada
 * n = word en `0x1146 + 2n`, y `fileoff = word − 0xBF80`, base de carga de CAST.OVL).
 * Control positivo de la lectura: la entrada 0 da `0xcea0 − 0xBF80 = 0x0f20`, que es el
 * handler de In Lor que el port ya citaba, y la tabla termina justo en `0x11a6`, el TAIL
 * común (`0x1146 + 48·2 = 0x11a6`).
 *
 * Los hechizos con OBJETIVO-PJ son exactamente los que alcanzan el picker «On who: »
 * (`CAST2.OVL:0x009e`, vía thunk `0xffffc1aa` → stub `0x812a`; resuelto con
 * `re/tools/dispatch_table.py`, no leído en crudo del residente). Barrido de las 48
 * entradas, mirando la primera instrucción de cada handler:
 *
 *   idx  2  handler 0x0f3c  →  call 0x0114  → «On who: » @0x011c   (An Zu → awaken)
 *   idx  3  handler 0x0f46  →  call 0x01ae  → «On who: » @0x01b5   (An Nox → cure)
 *   idx  4  handler 0x0f4c  →  call 0x01fa  → «On who: » @0x0200   (Mani → heal parcial)
 *   idx 27  handler 0x103a  →  call 0x08ac  → «On who: » @0x08b3   (Vas Mani → heal full)
 *   idx 42  handler 0x10ec  →  «On who: » @0x10ec DIRECTO          (In Mani Corp → resurrect)
 *
 * y NINGUNA otra de las 48. Cinco entradas, cuatro `CastEffect.kind` del port. La quinta
 * —la que faltaba— es la de este fichero.
 *
 * ⚠ Corrige de paso una atribución del comentario de `ui/pickers.ts`, que listaba
 * «resurrect 0x08b3/0x10ec»: `0x08b3` es el «On who: » de **Vas Mani** (lo llama el
 * handler 0x103a = idx 27), no el de la resurrección. El de resurrect es sólo `0x10ec`.
 *
 * ── EL DISCRIMINANTE DE LA VÍA: el flag de la llamada al aplicador ────────────────
 *
 *   CAST.OVL:0x10ec (Cast)      : call «On who: » · push idx · push **0** · call CAST2:0x05e0
 *   CAST.OVL:0x12e6 (pergamino) : call «On who: » · push idx · push **1** · call CAST2:0x05e0
 *
 * y dentro de `CAST2.OVL:0x05e0` ese flag es `[bp+4]`, leído en `0x0604 cmp word [bp+4],0`
 * / `0x0608 je 0x0611`: con 1 imprime DS 0x953c = `b'Not dead!\n'` cuando el objetivo no
 * está muerto; con 0 calla y deja hablar al TAIL (`jmp 0x11a6` desde 0x10fc) —
 * «Success!» (DS 0x4656) / «Failed!» (DS 0x4660). Por eso la vía del CAST no imprime ni
 * «Not dead!» ni «Resurrection!» (DS 0x46d2, del lector de pergaminos, `0x12e6`→`0x1350`).
 *
 * ── Y EL RESIDUO DE `resolve_command_char` QUE ESTE FICHERO **REFUTA** ─────────────
 *
 * `re/notes/resolve-command-char-178c-acta.md` §4 dejó abierto que en MAZMORRA el
 * lanzador saldría de `g_cmb_actor` sin preguntar (`ULTIMA.EXE:0x4995 cmp
 * [g_location],0x80` / `0x499a jbe`). Es falso, y la propia tabla de ventanas lo dice:
 * la máscara DS 0x1C90 reparte cuatro bits (8 exterior · 4 pueblo · 2 mazmorra · 1
 * combate) y el gate `CAST.OVL:0x0e74` sólo prueba el bit 2 cuando `0x21 ≤ g_location`,
 * mientras que el bit 1 se prueba en `0x0e2c` con `g_location > 0x7f`. Un hechizo con
 * máscara 0x02 (Uus Por, Des Por) sería INCASTABLE si en mazmorra `g_location` valiera
 * 0xFF. ⇒ en el pasillo de mazmorra `g_location` ∈ 0x21..0x28 ⇒ el `jbe` de 0x499a toma
 * la vía que PREGUNTA. La rama de `g_cmb_actor` es de COMBATE, y ahí el port ya no
 * pregunta (toma el actor del turno). Los dos asertos del final fijan las dos mitades.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { buildSpellDefs, type MagicDefsJson, type SpellDef } from "../src/core/magic/spells.js";
import { castSpell, applyResurrect, type CastEffect } from "../src/core/magic/cast.js";
import { TIME_PERMITTED_BITS } from "../src/core/magic/tables.js";
import { CombatRng } from "../src/core/combat/formulas.js";
import { OriginalRng } from "../src/core/rng-original.js";

const HERE = dirname(fileURLToPath(import.meta.url));
function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(HERE, rel), "utf8").replace(/^﻿/, "")) as T;
}
const defs: SpellDef[] = buildSpellDefs(readJson<MagicDefsJson>("../src/core/data/MagicDefinitions.json"));
const init = readJson<ExtractedInitialState>("../assets/initial-state.json");
const main = readFileSync(join(HERE, "..", "src", "main.ts"), "utf8");

/**
 * Las CINCO entradas de la jump table `CAST.OVL:0x1146` que alcanzan «On who: »
 * (`CAST2.OVL:0x009e`). Literales del volcado — nada importado del port.
 */
const ONWHO_ENTRIES = [
  { idx: 2, handler: 0x0f3c, onWhoAt: 0x011c, kind: "awaken" },
  { idx: 3, handler: 0x0f46, onWhoAt: 0x01b5, kind: "cure" },
  { idx: 4, handler: 0x0f4c, onWhoAt: 0x0200, kind: "healTarget" },
  { idx: 27, handler: 0x103a, onWhoAt: 0x08b3, kind: "healTarget" },
  { idx: 42, handler: 0x10ec, onWhoAt: 0x10ec, kind: "resurrect" },
] as const;

/** Sub-bloque de `main.ts` entre dos anclas literales (el fichero no es importable). */
function block(from: string, to: string): string {
  const a = main.indexOf(from);
  expect(a, `ancla ausente en main.ts: ${from}`).toBeGreaterThanOrEqual(0);
  const b = main.indexOf(to, a + from.length);
  expect(b, `ancla de cierre ausente en main.ts: ${to}`).toBeGreaterThan(a);
  return main.slice(a, b);
}
const DO_CAST = block("const doCast = (): void => {", "const doDungeonCast = (): void => {");
const DO_DUNGEON_CAST = block("const doDungeonCast = (): void => {", "\n    const SHORT_EQUIP_NAMES");
const COMBAT_CAST = block("// (C)ast en COMBATE (CAST.OVL)", 'if (key.toLowerCase() === "u") {');
const USE_SCROLL = block('hud.messageAppend("Scroll")', 'if (a.kind === "potion") {');

function castable(idx: number): { state: GameState; def: SpellDef } {
  const state = createNewGame(init);
  state.spellQuantities[idx] = 5;
  for (const c of state.characters) {
    c.level = 8; // ≥ círculo máximo (idx 42 ⇒ 42/6+1 = 8)
    c.currentMp = 30;
  }
  const def = defs.find((d) => d.index === idx);
  if (!def) throw new Error(`sin SpellDef para el índice ${idx}`);
  return { state, def };
}
function effectOf(idx: number, location: number): CastEffect | null {
  const { state, def } = castable(idx);
  const r = castSpell(state, state.characters[0]!, def, { location, inCombat: false }, new CombatRng(new OriginalRng(0x1234)));
  expect(r.ok, `el gate rechazó el índice ${idx} en loc 0x${location.toString(16)}: ${r.message}`).toBe(true);
  return r.effect;
}

describe("los CINCO hechizos de «On who: » (jump table CAST.OVL:0x1146) y sus consumidores", () => {
  it("el dispatcher del port clasifica los cinco índices como el binario", () => {
    for (const e of ONWHO_ENTRIES) {
      expect(effectOf(e.idx, 0)?.kind, `idx ${e.idx} (handler 0x${e.handler.toString(16)})`).toBe(e.kind);
    }
  });

  // 🔴 EL ASERTO QUE ESTABA EN ROJO. Con `resurrect` sin rama, el efecto llegaba a
  // `doCast` y se caía por el final de la cadena de `else if` sin hacer nada.
  it("(C)ast de EXTERIOR/PUEBLO consume las CUATRO clases de objetivo-PJ", () => {
    const sinRama = [...new Set(ONWHO_ENTRIES.map((e) => e.kind))].filter(
      (k) => !DO_CAST.includes(`fx.kind === "${k}"`),
    );
    expect(sinRama, "efectos de «On who: » que doCast NO consume").toEqual([]);
  });

  it("(C)ast de MAZMORRA también: DS 0x1C90[42] = 0x0e lleva el bit 0x02", () => {
    expect(TIME_PERMITTED_BITS[42]).toBe(0x0e); // crudo de DATA.OVL fileoff 0x1ca0 + 42
    expect(TIME_PERMITTED_BITS[42]! & 0x02).toBe(0x02); // bit MAZMORRA puesto
    expect(TIME_PERMITTED_BITS[42]! & 0x01).toBe(0); // y bit COMBATE quitado
    const sinRama = [...new Set(ONWHO_ENTRIES.map((e) => e.kind))].filter(
      (k) => !DO_DUNGEON_CAST.includes(`fx.kind === "${k}"`),
    );
    expect(sinRama, "efectos de «On who: » que doDungeonCast NO consume").toEqual([]);
    // Y el efecto REALMENTE sale del dispatcher con la location de mazmorra (0x21..0x28).
    expect(effectOf(42, 0x21)?.kind).toBe("resurrect");
  });

  it("la vía del CAST no imprime «Not dead!» ni «Resurrection!» (flag 0 de @0x10f0)", () => {
    // El tail 0x11a6 es lo ÚNICO que habla: DS 0x4656 / DS 0x4660, verbatim de DATA.OVL.
    // Se mira el CÓDIGO de la rama, sin comentarios (que sí nombran las dos cadenas
    // ajenas para explicar por qué NO están) y acotada hasta el siguiente `} else`.
    for (const src of [DO_CAST, DO_DUNGEON_CAST]) {
      const code = src.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
      const a = code.indexOf('fx.kind === "resurrect"');
      expect(a).toBeGreaterThanOrEqual(0);
      const b = code.indexOf("} else", a);
      const rama = code.slice(a, b > a ? b : undefined);
      expect(rama).toContain('"Success!" : "Failed!"');
      expect(rama).toContain("applyResurrect(");
      expect(rama).toContain("pickCastTarget(");
      expect(rama).not.toContain("Not dead!");
      expect(rama).not.toContain("Resurrection!");
    }
  });

  // CASO CONTRARIO 1: la resurrección por PERGAMINO (CAST.OVL:0x12e6, flag **1**) ya
  // funcionaba y NO comparte el tail — sigue con su propia cadena y sin Success!/Failed!.
  it("la vía del PERGAMINO sigue intacta y separada (@0x12e6 → 0x1350)", () => {
    expect(USE_SCROLL).toContain('fu.kind === "resurrect"');
    expect(USE_SCROLL).toContain("applyResurrect");
    expect(USE_SCROLL).not.toContain('"Success!" : "Failed!"');
  });

  // CASO CONTRARIO 2: en COMBATE los cuatro ya se resolvían juntos; no se toca.
  it("la vía de COMBATE conserva las cuatro clases en un solo predicado", () => {
    for (const k of new Set(ONWHO_ENTRIES.map((e) => e.kind))) {
      expect(COMBAT_CAST, `combate sin ${k}`).toContain(`fx.kind === "${k}"`);
    }
  });

  // CASO CONTRARIO 3: el aplicador no cambia — sólo resucita a los 'D' (CAST2:0x05fd
  // `cmp byte [bx + 0x55b3], 0x44`), y con cualquier otro estado devuelve 0 ⇒ «Failed!».
  it("applyResurrect sigue exigiendo estado 'D' (0x44) y deja HP=1", () => {
    const g = createNewGame(init);
    const c = g.characters[1]!;
    c.status = "G";
    expect(applyResurrect(c, g.karma)).toBe(false);
    c.status = "D";
    expect(applyResurrect(c, g.karma)).toBe(true);
    expect(c.status).toBe("G");
    expect(c.currentHp).toBe(1); // CAST2:0x062d `mov word [bx+0x10], 1`
  });
});

describe("residuo (4) del acta 178c — REFUTADO: la rama de g_cmb_actor es SÓLO de combate", () => {
  // La cota que lo decide, en crudo de DATA.OVL (fileoff 0x1ca0 + idx): Uus Por (21) y
  // Des Por (22) valen 0x02 = SÓLO mazmorra. El gate CAST.OVL:0x0e74 prueba ese bit
  // únicamente con `g_location >= 0x21`, y el 0x0e2c manda a la rama de combate todo
  // `g_location > 0x7f`. Si en mazmorra `g_location` fuese 0xFF (como decía la ficha),
  // los dos hechizos de mazmorra por excelencia serían incastables.
  it("Uus Por / Des Por tienen máscara 0x02: SÓLO mazmorra, sin bit de combate", () => {
    expect(TIME_PERMITTED_BITS[21]).toBe(0x02);
    expect(TIME_PERMITTED_BITS[22]).toBe(0x02);
  });

  it("en mazmorra el port PREGUNTA (vía jbe de 0x499a), como el binario", () => {
    expect(DO_DUNGEON_CAST).toContain("pickCaster(");
  });

  it("en combate el port NO pregunta: el lanzador es el actor del turno (= g_cmb_actor)", () => {
    expect(COMBAT_CAST).not.toContain("pickCaster(");
    expect(COMBAT_CAST).not.toContain("pickCommandChar(");
    expect(COMBAT_CAST).toContain("cur.charIdx");
  });
});
