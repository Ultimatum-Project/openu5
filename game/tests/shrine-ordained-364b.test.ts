/**
 * Ficha #364-b · la MELODÍA del ORDAINED (`CAST2.OVL:0x0adb-0x0b02`).
 *
 * Tras el «Return again when thy Quest is done!» (print 0x0ac3) la rama ORDAINED de
 * `shrine_visit` (0x0a81) toca SIETE notas: un bucle con UNA llamada a `tone` (0x3fb2 →
 * kernel 0x2192) por iteración y los cinco argumentos leídos de CUATRO tablas paralelas
 * de 7 words en DS (avance de 2 en 2, tope `cmp si,0x4c1e` @0x0afe):
 *   `inc`=[0x4be6+2i] · `delay`=1 (@0x0add) · `count`=[0x4bf4+2i] · `start`=[0x4c02+2i]
 *   · `step`=[0x4c10+2i].
 * Los VALORES viven en DATA.OVL (fileoff = DS+0x10, mapeo con control positivo en
 * `re/notes/siembra-objetos-cbt-353.md` §3) y aquí van como ESPERADOS EN CRUDO — los
 * 7×4 words literales del volcado, no leídos del código bajo prueba.
 *
 * La rama NO invierte NI sacude (sin 0x2890/0x29a6/0x4e92: sale por `jmp 0xd16` @0x0b04
 * al flash común del rito) ⇒ hay cue y NO hay `ritual-invert` ni `quake`. Y sólo suena
 * en ORDAINED: WELL DONE lleva su propio cue (shrine-well-done), la donación emite sólo
 * el prompt, y las salidas de fallo/vacía no pasan por 0x0ac6.
 *
 * MUTANTE CORRIDO (sobre fixture verde, restaurado después):
 *   · M1 — quitar `events.push(sfxEvent("shrine-ordained"))` de la rama → MATA
 *     (adyacencia al print + id + el esperado en crudo de shrine-key-wait.test.ts).
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { SHRINE_TILE, type ShrineData } from "../src/core/world/shrines.js";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, DS_STRINGS } from "./ds-strings-fixture.js";
import {
  renderCue,
  ORDAINED_INC,
  ORDAINED_COUNT,
  ORDAINED_START,
  ORDAINED_STEP,
} from "../src/skin/fiel/speaker.js";

const SHRINES: ShrineData = {
  virtues: ["Honesty", "Compassion", "Valour", "Justice", "Sacrifice", "Honor", "Spirituality", "Humility"],
  mantras: ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"],
  shrineX: [101, 0, 0, 0, 0, 0, 0, 0],
  shrineY: [100, 0, 0, 0, 0, 0, 0, 0],
};

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 101, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
    ...over,
  } as GameState;
}

function makeWorld(): WorldData {
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  overworld[100]![101] = SHRINE_TILE;
  return { overworld, underworld: overworld, smallMaps: new Map() };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  shrines: SHRINES,
};

function makeGame(over: Partial<GameState> = {}): Game {
  return new Game({} as ExtractedInitialState, makeWorld(), gameData, makeState(over));
}

/** Entra al santuario y responde el interrogatorio; devuelve los eventos del visit. */
function visita(over: Partial<GameState>, virtue = "Honesty", mantras = ["Ahm", "Ahm", "Ahm"]): GameEvent[] {
  const game = makeGame(over);
  game.enter();
  return game.submitShrineVisit(virtue, mantras);
}

describeConAssets([DS_STRINGS], "#364-b · la melodía suena en ORDAINED, en el sitio del binario", () => {
  conDsStrings();
  it("el cue va PEGADO detrás del «Return again» (0x0ac3 print → 0x0adb bucle)", () => {
    const out = visita({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 });
    const iMsg = out.findIndex(
      (e) => e.kind === "message" && e.text === "\n\"Return again when thy Quest is done!\"\n",
    );
    expect(iMsg, "control positivo: sin el print el aserto de adyacencia sería vacuo").toBeGreaterThanOrEqual(0);
    expect(out[iMsg + 1]).toMatchObject({ kind: "sfx", sfx: { id: "shrine-ordained" } });
  });

  it("SIN inversión ni sacudida: la rama no llama a 0x2890/0x29a6/0x4e92", () => {
    const out = visita({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 });
    // Control positivo primero: la rama se recorrió y el cue está.
    expect(out.some((e) => e.kind === "sfx" && e.sfx?.id === "shrine-ordained")).toBe(true);
    expect(out.some((e) => e.kind === "ritual-invert")).toBe(false);
    expect(out.some((e) => e.kind === "quake")).toBe(false);
  });
});

describe("#364-b · las OTRAS ramas del visit no tocan la melodía (negativos con control)", () => {
  const sinOrdained = (out: GameEvent[]) =>
    out.some((e) => e.kind === "sfx" && e.sfx?.id === "shrine-ordained");

  it("WELL DONE (visited+quest): su sfx es shrine-well-done, no la melodía", () => {
    const out = visita({ shrineVisitedBitmap: 0x01, shrineQuestBitmap: 0x01 });
    // Control positivo del negativo: la rama SÍ corrió (su propio cue está).
    expect(out.some((e) => e.kind === "sfx" && e.sfx?.id === "shrine-well-done")).toBe(true);
    expect(sinOrdained(out)).toBe(false);
  });

  it("DONACIÓN (visited sin quest): sólo el prompt, sin sfx alguno", () => {
    const out = visita({ shrineVisitedBitmap: 0x01, shrineQuestBitmap: 0 });
    expect(out.some((e) => e.kind === "shrine-donate-prompt")).toBe(true); // control positivo
    expect(out.some((e) => e.kind === "sfx")).toBe(false);
  });

  it("mantra EQUIVOCADO (0x0a62 «unfocused» → 0x0d1d): sin sfx", () => {
    const out = visita({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 }, "Honesty", ["Ahm", "nope", "Ahm"]);
    expect(out.some((e) => e.kind === "message" && e.text?.includes("unfocused"))).toBe(true); // control positivo
    expect(out.some((e) => e.kind === "sfx")).toBe(false);
  });

  it("entrada VACÍA (#275, 0x09cc → 0x0d1d): nada de nada", () => {
    const out = visita({ shrineVisitedBitmap: 0, shrineQuestBitmap: 0 }, "", ["Ahm", "Ahm", "Ahm"]);
    expect(out.filter((e) => e.kind === "sfx")).toEqual([]);
  });
});

describe("#364-b · las CUATRO tablas de DATA.OVL, esperadas EN CRUDO", () => {
  // Volcado independiente (python struct sobre DATA.OVL, control positivo del mapeo
  // DS→fileoff en siembra-objetos-cbt-353.md §3) — NO leído del código bajo prueba.
  it("inc (DS 0x4be6 → fo 0x4bf6): las 7 words literales", () => {
    expect([...ORDAINED_INC]).toEqual([0x0ce4, 0x0f55, 0x0f55, 0x0f55, 0x0f55, 0x0e74, 0x0f55]);
  });
  it("count (DS 0x4bf4 → fo 0x4c04): las 7 words literales", () => {
    expect([...ORDAINED_COUNT]).toEqual([0x1b58, 0x1770, 0x0bb8, 0x0bb8, 0x0bb8, 0x0bb8, 0x1f40]);
  });
  it("start (DS 0x4c02 → fo 0x4c12): las 7 words literales", () => {
    expect([...ORDAINED_START]).toEqual([0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x03e8, 0x01f4]);
  });
  it("step (DS 0x4c10 → fo 0x4c20): las 7 words literales", () => {
    expect([...ORDAINED_STEP]).toEqual([0x09, 0x0a, 0x15, 0x15, 0x15, 0x15, 0x08]);
  });
});

describe("#364-b · el cue renderiza las 7 notas con pitch y duración EN CRUDO", () => {
  it("7 segmentos de tono, Hz y ms literales (modelo de la casa: pitch=incToHz, dur=count)", () => {
    const segs = renderCue({ id: "shrine-ordained" });
    expect(segs).toHaveLength(7);
    // EN CRUDO (no desde el sujeto): SR = 24000/0.93 = 25806,451612903225 Hz;
    // f = inc/65536·SR · ms = count·1000/SR. Calculadas fuera del port (python).
    const expected: Array<[hz: number, ms: number]> = [
      [1299.458165, 271.25], // inc 0x0ce4, count 0x1b58
      [1545.567666, 232.5], // inc 0x0f55, count 0x1770
      [1545.567666, 116.25], // inc 0x0f55, count 0x0bb8
      [1545.567666, 116.25], // inc 0x0f55, count 0x0bb8
      [1545.567666, 116.25], // inc 0x0f55, count 0x0bb8
      [1456.968246, 116.25], // inc 0x0e74, count 0x0bb8
      [1545.567666, 310.0], // inc 0x0f55, count 0x1f40
    ];
    segs.forEach((s, i) => {
      expect(s.kind, `nota ${i + 1}`).toBe("tone");
      if (s.kind !== "tone") return;
      expect(s.f0, `pitch nota ${i + 1}`).toBeCloseTo(expected[i]![0], 4);
      expect(s.f1, `pitch constante nota ${i + 1}`).toBeCloseTo(expected[i]![0], 4);
      expect(s.ms, `duración nota ${i + 1}`).toBeCloseTo(expected[i]![1], 6);
    });
    // Total EN CRUDO: 33000 counts / SR = 1.278,75 ms.
    expect(segs.reduce((a, s) => a + s.ms, 0)).toBeCloseTo(1278.75, 6);
  });
});
