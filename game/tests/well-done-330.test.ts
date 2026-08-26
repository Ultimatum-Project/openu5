/**
 * #330 — LOS TRES BRAZOS DEL REPORTE DEL USUARIO DEL 15-08 sobre el rito en el deploy #34:
 * el TRUENO mudo (A), la inversión que se ve YA FUERA del santuario (B), y el «+1» (C).
 *
 * Los tres caen en el MISMO tramo, `shrine_visit` rama quest-completa (CAST2 0x0c18-0x0d1a),
 * y por eso van juntos aquí en vez de repartidos.
 *
 * 🔴 El fixture está DUPLICADO de `ritual-invert-295.test.ts` a propósito, no por descuido:
 * importar de un `.test.ts` ejecuta SU SUITE ENTERA dentro de ésta y contamina el cardinal
 * de la batería (#240, 80 tests fantasma medidos). Duplicar 30 líneas de fixture es el
 * precio conocido de no comprar eso.
 *
 * MUTANTES CORRIDOS sobre la base YA COMMITEADA (04f89878), con su resultado REAL — y tres
 * de las cinco predicciones salieron mal, así que van las dos cifras:
 *   · M1 — quitar el `events.push({kind:"quake"})` de la rama WELL DONE (= volver al estado
 *     que el usuario reportó: trueno MUDO) → predicho 3, **MATA 3**.
 *   · M2 — emitir el quake ANTES del `ritual-invert` (el orden plausible «primero el trueno,
 *     luego el negativo», que el binario NO tiene: 0x0c41 va antes que 0x0c88)
 *     → predicho 1, **MATA 2**.
 *   · M3 — `reset()` que NO limpia la continuación → predicho 1, **MATÓ 0**. 🔴 El fallo era
 *     MÍO, no del código: el aserto original («reset + avanzar el reloj, ¿corrió?») es VACUO
 *     porque `reset` hace `clearTimeout` y la continuación no corre AUNQUE no se limpie — el
 *     mutante era PUNTO FIJO del testigo elegido. Reescrito para instanciar la diferencia
 *     donde EXISTE (un rito posterior que sí restaura), **MATA 1**.
 *   · M4 — `restore()` sin disparar la continuación (= el bug original: la salida no se
 *     desaparca nunca) → predicho 2, **MATA 3**.
 *   · M5 — Humildad (v=7) subiendo STR y Espiritualidad (v=6) perdiendo INT
 *     → predicho 2, **MATA 8** (las tablas crudas, la composición y la emisión, a la vez).
 *
 * 🔴 LO QUE ESTE FICHERO **NO** GUARDA: que la inversión se vea DURANTE los barridos y no
 * después — eso es reloj de pared del navegador y aquí se prueba la ESTRUCTURA (que la
 * salida cuelga de la restauración). La cifra que motivó el fix (5.347,5 ms de ventana
 * contra 2.251 ms de escena de salida) está en la nota, medida, no aquí.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import {
  SHRINE_TILE,
  SHRINE_STR_FLAG,
  SHRINE_DEX_FLAG,
  SHRINE_INT_FLAG,
  type ShrineData,
} from "../src/core/world/shrines.js";
import { RitualInvert } from "../src/ui/ritual-invert.js";
import { describeConAssets } from "./assets-opcionales.js";
import { conDsStrings, DS_STRINGS } from "./ds-strings-fixture.js";

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

function makeState(learned: boolean, quest: boolean): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 1000, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
    turnsSinceStart: 0,
    position: { location: 0, floor: 0, x: 101, y: 100 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 8,
    shrineVisitedBitmap: learned ? 1 : 0,
    shrineQuestBitmap: quest ? 1 : 0,
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

function ritoDeHonestidad(learned: boolean, quest: boolean): GameEvent[] {
  const game = new Game(
    {} as ExtractedInitialState, makeWorld(), gameData, makeState(learned, quest),
  );
  game.enter();
  return game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
}

const idx = (evs: GameEvent[], p: (e: GameEvent) => boolean): number => evs.findIndex(p);

// ─────────────────────────────────────────────────────────────────────────────────────
describeConAssets([DS_STRINGS], "#330(A) · el TRUENO del WELL DONE (0x0c88 → kernel 0x3072 screen_shake_fx)", () => {
  conDsStrings();
  it("CONTROL POSITIVO: el fixture entra de verdad en la rama WELL DONE", () => {
    const evs = ritoDeHonestidad(true, true);
    expect(
      evs.some((e) => e.kind === "message" && e.text?.includes("WELL DONE")),
      "sin esto los asertos de abajo serían vacuos por no entrar en la rama",
    ).toBe(true);
  });

  it("emite la sacudida UNA vez — es el CUARTO caller de 0x3072, y estaba mudo", () => {
    const evs = ritoDeHonestidad(true, true);
    expect(evs.filter((e) => e.kind === "quake")).toHaveLength(1);
    // fix-codice, CONTROL NEGATIVO del emisor: el quake del WELL DONE (0x0c88) NO lleva
    // el marcador `xorBracket` — su inversión es el régimen SUELTO de `ritual-invert`
    // (0x0c41), no los pares 0x0db3/0x0dca/0x0de1 de la ceremonia final.
    expect(evs.find((e) => e.kind === "quake")!.xorBracket).toBeUndefined();
  });

  it("con su rumble detrás: el tono ES la sacudida, no un sonido que la acompañe", () => {
    const evs = ritoDeHonestidad(true, true);
    const iQ = idx(evs, (e) => e.kind === "quake");
    expect(evs[iQ + 1]).toMatchObject({ kind: "sfx", sfx: { id: "quake" } });
  });

  it("va DESPUÉS de la inversión y de los barridos, y ANTES de los atributos (0x0c41 < 0x0c88 < 0x0c9c)", () => {
    const evs = ritoDeHonestidad(true, true);
    const iInv = idx(evs, (e) => e.kind === "ritual-invert");
    const iSweep = idx(evs, (e) => e.kind === "sfx" && e.sfx?.id === "shrine-well-done");
    const iQuake = idx(evs, (e) => e.kind === "quake");
    const iAttr = idx(evs, (e) => e.kind === "message" && /^\w+ \+1\n$/.test(e.text ?? ""));
    expect(iQuake).toBeGreaterThan(iInv); // 0x0c41 rect XOR  <  0x0c88 call
    expect(iQuake).toBeGreaterThan(iSweep); // 0x0c44-0x0c85 barridos  <  0x0c88
    expect(iAttr, "el «Strength +1» se imprime DESPUÉS de la sacudida (0x0c9c)")
      .toBeGreaterThan(iQuake);
  });

  it("las ramas que NO son quest-completa no truenan (control negativo de los dos gates)", () => {
    for (const [learned, quest] of [[false, false], [true, false]] as const) {
      const evs = ritoDeHonestidad(learned, quest);
      expect(
        evs.some((e) => e.kind === "quake"),
        `rama learned=${learned} quest=${quest}`,
      ).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe("#330(B) · la salida del santuario cuelga de la RESTAURACIÓN (0x0d1a), no de un reloj paralelo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Conductor con vista de mentira y `sceneMs` identidad (ventana real, no automatización). */
  function makeCtl(): { ctl: RitualInvert; estados: boolean[] } {
    const estados: boolean[] = [];
    const ctl = new RitualInvert({
      view: { setRitualInvert: (on: boolean) => void estados.push(on) },
      sceneMs: (ms: number) => ms,
    });
    return { ctl, estados };
  }

  it("la continuación NO corre mientras la inversión está montada", () => {
    vi.useFakeTimers();
    const { ctl } = makeCtl();
    let salidas = 0;
    ctl.run(5000);
    ctl.whenRestored(() => void salidas++);
    vi.advanceTimersByTime(4999);
    expect(salidas, "la escena de salida no puede empezar con el viewport aún invertido")
      .toBe(0);
  });

  it("y corre EXACTAMENTE al restaurar (el `ret` de 0x0d1a va justo antes de la caminata)", () => {
    vi.useFakeTimers();
    const { ctl, estados } = makeCtl();
    let salidas = 0;
    ctl.run(5000);
    ctl.whenRestored(() => void salidas++);
    vi.advanceTimersByTime(5000);
    expect(salidas).toBe(1);
    expect(estados, "monta y desmonta, en ese orden").toEqual([true, false]);
  });

  it("bajo automatización (ventana 0) la salida corre EN EL ACTO: e2e y digests no se mueven", () => {
    const estados: boolean[] = [];
    const ctl = new RitualInvert({
      view: { setRitualInvert: (on: boolean) => void estados.push(on) },
      sceneMs: () => 0, // navigator.webdriver
    });
    let salidas = 0;
    ctl.whenRestored(() => void salidas++);
    ctl.run(5000);
    expect(salidas, "con ventana 0 el desmontaje es síncrono y arrastra la continuación").toBe(1);
    expect(ctl.inverted, "y no queda temporizador: el despachador no aparca nada").toBe(false);
  });

  it("`reset()` DESCARTA la continuación, y se ve en el rito SIGUIENTE (no en el propio reset)", () => {
    // 🔴 Este aserto estaba VACUO en su primera forma («reset + avanzar el reloj, ¿corrió?»):
    // `reset` hace `clearTimeout`, así que la continuación no corre AUNQUE no se limpie — el
    // mutante «reset no limpia» pasaba en verde, medido. La diferencia sólo EXISTE cuando
    // después hay OTRO rito: sin la limpieza, la continuación rancia del rito abandonado se
    // dispara al restaurar el nuevo, montando la escena de salida del santuario equivocado.
    vi.useFakeTimers();
    const { ctl } = makeCtl();
    let salidasRancias = 0;
    let salidasNuevas = 0;
    ctl.run(5000);
    ctl.whenRestored(() => void salidasRancias++);
    ctl.reset(); // cargar partida a mitad del rito
    expect(ctl.inverted, "el viewport queda limpio de inmediato").toBe(false);

    ctl.run(5000); // rito NUEVO, sin registrar continuación
    vi.advanceTimersByTime(5000);
    expect(salidasRancias, "la continuación del rito abandonado NO puede revivir").toBe(0);

    ctl.run(5000); // y el mecanismo sigue vivo para quien sí la registre
    ctl.whenRestored(() => void salidasNuevas++);
    vi.advanceTimersByTime(5000);
    expect(salidasNuevas, "CONTROL POSITIVO: sin esto lo de arriba sería vacuo").toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe("#330(C) · el premio NO es «+1 inteligencia»: depende del santuario, y puede ser 0 o 3", () => {
  // ESPERADOS EN CRUDO — los bytes de DATA.OVL fileoff 0x4B8E/0x4B96/0x4B9E (DS 0x4B7E/
  // 0x4B86/0x4B8E + 0x10), transcritos a mano desde el volcado, NO derivados del sujeto.
  it("las tres tablas son los bytes del binario, verbatim", () => {
    expect([...SHRINE_STR_FLAG]).toEqual([0, 0, 1, 0, 1, 1, 1, 0]);
    expect([...SHRINE_DEX_FLAG]).toEqual([0, 1, 0, 1, 1, 0, 1, 0]);
    expect([...SHRINE_INT_FLAG]).toEqual([1, 0, 0, 1, 0, 1, 1, 0]);
  });

  it("Honestidad (v=0) sube SÓLO inteligencia — el caso que el usuario vio", () => {
    const evs = ritoDeHonestidad(true, true);
    const attrs = evs.filter((e) => e.kind === "message" && /^\w+ \+1\n$/.test(e.text ?? ""));
    expect(attrs.map((e) => e.text)).toEqual(["Intelligence +1\n"]);
  });

  it("Espiritualidad (v=6) sube LOS TRES y Humildad (v=7) NINGUNO", () => {
    const suma = (v: number): number =>
      (SHRINE_STR_FLAG[v] ?? 0) + (SHRINE_DEX_FLAG[v] ?? 0) + (SHRINE_INT_FLAG[v] ?? 0);
    expect(suma(6), "Spirituality = Verdad+Amor+Valor").toBe(3);
    expect(suma(7), "Humility no sube atributo; cobra karma DOBLE (0x0cff)").toBe(0);
  });

  it("los rótulos llevan su `\\n` dentro, como DS 0x95B8/0x95C6/0x95D4", () => {
    const evs = ritoDeHonestidad(true, true);
    const attr = evs.find((e) => e.kind === "message" && /\+1\n$/.test(e.text ?? ""));
    expect(attr?.text).toBe("Intelligence +1\n");
  });
});
