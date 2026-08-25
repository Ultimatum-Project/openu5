/**
 * Cabo de #179 — el CUE de sonido de la absorción del desenlace (SJOG `absorb` 0x1ea4).
 *
 * DERIVACIÓN (careo de este carril, 20-08, sobre re/disasm/SJOG.OVL.asm:3150-3203 con
 * `dispatch_table.overlay_near_call_base(SJOG)` = 0xBF80 y CINCO resoluciones-control
 * coherentes con destinos ya acreditados del corpus — 0x766c→0x35EC prompt_direction ·
 * 0x6340→0x22C0 beep (#161) · stub 0x7e66→SJOG 0x1EA4 (absorb mismo) · 0x7d9a→COMSUBS
 * 0x0094 · 0x7d82→COMBAT 0x1236):
 *
 *   · El absorb emite **UN SOLO TONO**, no dos. El «tono corto (0x573a, arg 0xa)» que
 *     el acta #179 §3 listaba como primer sonido queda REFUTADO: SJOG `call 0x573a`
 *     resuelve a ULTIMA.EXE **0x16BA = putchar** (gate `dl≤0x7f` + ramas 0x0a/0x0d +
 *     glifo por driver de vídeo; el MISMO call+arg que #161 ya adjudicó en el funnel
 *     0x1f4b como «putchar('\n') — NO es una pausa»). `push 0xa` es el '\n' INICIAL de
 *     «\n<nombre> is absorbed!\n» — texto, no sonido.
 *   · El tono real: SJOG 0x1ef8-0x1f08 `push 0x4b0; push 0x7d0; push 1; push 0x28;
 *     call 0x842e` → ULTIMA.EXE **0x43AE = pcspeaker_glide** (mismo orden de push que
 *     el testigo waterfall OUTSUBS 0x0482-0x0492: start, end, step, total) =
 *     **glide(1200→2000, paso 1, total 0x28=40)** — byte-idéntico a la tupla de
 *     combat-escape (SJOG 0x1c37) y ring-vanishes (ZSTATS 0xe42).
 *   · Posición: el glide va DETRÁS del print del mensaje (0x1ef5 print «is absorbed!»
 *     → 0x1f08 glide), contiguo en el mismo beat, sin ventana visual entre medias ⇒ la
 *     posición por defecto de `routeCombatSfx` (cue al llegar el message) es la fiel y
 *     NO hace falta `sfxLeadMs` (#208). Tampoco es bloqueante ni encadenado (familia de
 *     combat-escape, fuera de BLOCKING_CUES/CHAINED_CUES).
 *
 * Esperados EN CRUDO (derivados A MANO del asm, nunca del código del port):
 *   glide(0x4b0=1200 → 0x7d0=2000, paso 1, total 0x28=40) ⇒ inc = trunc(800·1/40) = 20 ·
 *   40 vueltas · primer tono 1200 · segundo 1220 · último 1200 + 20·39 = **1980 Hz**
 *   (la nominal 2000 nunca se escribe — ficha #137).
 *
 * MUTANTES discriminantes (corridos a mano sobre el fixture verde, restaurados):
 *   · M1 — quitar la rama «is absorbed!» de `sfxForCombatEvent` → matan los tests 1 y 2
 *     (el flujo real no deriva cue y el predicado devuelve null).
 *   · M2 — tupla equivocada en el catálogo (copiar la de torch-borrowed 800→2000,1,50)
 *     → mata el test 3 (steps.length 50≠40, steps[0] 800≠1200, último 1976≠1980).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import { Combat, type CombatMapData, type PartyCombatant } from "../src/core/combat/combat.js";
import { sfxForCombatEvent } from "../src/core/sfx.js";
import {
  BLOCKING_CUES,
  CHAINED_CUES,
  renderCue,
  type SfxSeg,
} from "../src/skin/fiel/speaker.js";

type Tone = Extract<SfxSeg, { kind: "tone" }>;

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
type DataJson = EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] };
const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs: EnemyDef[] = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const CM127 = 127; // la celda de LB (Doom sala 15) — la única celda absorbente del juego

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function party(state: GameState): PartyCombatant[] {
  const members = state.characters.filter((c) => c.partyStatus === 0);
  for (const c of members) {
    c.level = 8;
    c.maxHp = 240;
    c.currentHp = 240;
    c.status = "G";
  }
  return members.map((record) => ({
    charIdx: state.characters.indexOf(record),
    record,
    weapons: [{ attack: 40, range: 5 }],
  }));
}
function celda(): Combat {
  const state = freshState();
  return new Combat({
    map: combatMaps[CM127]!,
    entryDirection: "south",
    party: party(state),
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed: 0,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
    roomCombat: true,
  });
}

describe("cabo #179 — el cue del absorb (SJOG 0x1f08 glide 0x4b0→0x7d0,1,0x28)", () => {
  it("1 · FLUJO REAL: la absorción en cm127 deriva EXACTAMENTE un cue, y es combat-absorbed", () => {
    const c = celda();
    const cur = c.currentUnit!;
    expect(cur.kind).toBe("player");
    cur.x = 5;
    cur.y = 3;
    const evs = c.playerMove("north"); // → (5,2) con el alma en (5,1): absorbe
    expect(cur.status).toBe("absorbed");
    // El texto REAL emitido por maybeAbsorb (tf «{} is absorbed!») debe disparar el
    // predicado — cierra el hueco tautológico de hardcodear el texto en el test 2.
    const cues = evs
      .map((e) =>
        sfxForCombatEvent({ kind: e.kind, text: (e as { text?: string }).text }),
      )
      .filter((x) => x !== null);
    expect(cues).toEqual([{ id: "combat-absorbed" }]);
  });

  it("2 · PREDICADO: «<nombre> is absorbed!» suena; los vecinos y los casi-iguales no", () => {
    expect(sfxForCombatEvent({ kind: "message", text: "Shamino is absorbed!" })).toEqual({
      id: "combat-absorbed",
    });
    // Sin el cierre «!» no es la cadena del binario (DS 0x8f02 = « is absorbed!\n»).
    expect(sfxForCombatEvent({ kind: "message", text: "Shamino is absorbed" })).toBeNull();
    // Un `kind` no-message con ese texto no suena (el cue nace del print, 0x1ef5→0x1f08).
    expect(sfxForCombatEvent({ kind: "moved", text: "Shamino is absorbed!" })).toBeNull();
    // Vecinos intactos (control de que la rama nueva no se come a las de al lado).
    expect(sfxForCombatEvent({ kind: "message", text: "Escape!" })).toEqual({
      id: "combat-escape",
    });
    expect(sfxForCombatEvent({ kind: "message", text: "VICTORY!" })).toEqual({
      id: "victory-fanfare",
    });
  });

  it("3 · CATÁLOGO en crudo: glide(1200→2000,1,40) — 40 escalones, 1200/1220…1980 (#137)", () => {
    const segs = renderCue({ id: "combat-absorbed" });
    expect(segs.length).toBe(1); // UN tono: el «tono corto» 0x573a(0xa) era putchar('\n')
    const seg = segs[0] as Tone;
    expect(seg.kind).toBe("tone");
    const steps = seg.steps!;
    expect(steps.length).toBe(40); // total=0x28, paso=1 ⇒ 40 vueltas
    expect(steps[0]).toBe(1200); // 0x4b0 — primer set_tone antes del incremento
    expect(steps[1]).toBe(1220); // inc = trunc((2000−1200)·1/40) = 20
    expect(steps[steps.length - 1]).toBe(1980); // 1200 + 20·39; la nominal 0x7d0 nunca se escribe
    expect(seg.f1).toBe(1980);
  });

  it("4 · FASE: ni bloqueante ni encadenado — el glide va contiguo tras el print (0x1ef5→0x1f08)", () => {
    expect(BLOCKING_CUES.has("combat-absorbed")).toBe(false);
    expect(CHAINED_CUES.has("combat-absorbed")).toBe(false);
  });
});
