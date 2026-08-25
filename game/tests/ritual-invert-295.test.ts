/**
 * #295 — LA INVERSIÓN SOSTENIDA DEL «WELL DONE» DEL ALTAR, de punta a punta.
 *
 * Lo que sella este fichero es la cadena entera del efecto que el usuario echaba en falta:
 * el core la EMITE en el sitio del binario, la ventana se DERIVA de los barridos (cero ms de
 * vídeo), el conductor la SOSTIENE y la retira, y la primitiva sabe pintar en el otro
 * espacio de coordenadas (el de la piel shader, que compone en píxeles de dispositivo).
 *
 * MUTANTES CORRIDOS (los cinco, con su resultado real):
 *   · M1 — quitar `events.push({kind:"ritual-invert"})` de la rama WELL DONE
 *     → **MATA 3** («el WELL DONE emite…», «…en el ORDEN del binario», «…y el sfx»).
 *   · M2 — emitir `ritual-invert` también en la rama ORDAINED (el error de creer que el
 *     negativo es «del rito» y no de ESTA rama; el vídeo da 6/6 en WELL DONE y 0 en ordained)
 *     → **MATA 1** («las otras dos ramas NO invierten»).
 *   · M3 — `wellDoneInvertWindowMs` devolviendo UNA mitad en vez de dos (el error de copiar
 *     la forma del jingle pareado, que sí tiene delay+dur) → **MATA 1** (la razón 2×).
 *   · M4 — `invertRect` ignorando sus argumentos y pintando el rect EGA fijo (= el error que
 *     la ficha #295 declara como restricción 1: llamar a la primitiva a ciegas desde el
 *     compose del shader) → **MATA 2** (los dos del rect arbitrario).
 *   · M5 — `RitualInvert.run` sin el `setTimeout` (monta y no retira: el negativo eterno)
 *     → **MATA 1** («la ventana se cierra sola»).
 *
 * 🔴 LO QUE ESTE FICHERO **NO** GUARDA, y se dice para que nadie lo suponga guardado: la
 * PRECEDENCIA inversión-antes-de-cortina dentro de `paintScene` de cada piel. Las dos la
 * respetan por lectura (y el docblock de cada una la declara), pero los dos pintados viven
 * dentro de métodos privados que exigen atlas y canvas reales; un aserto sobre el TEXTO del
 * fichero sería una guarda de prosa, no de la propiedad (la avería de #251). Lo que sí hay
 * es la CAPTURA MIRADA en las dos pieles, adjunta al commit.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { SHRINE_TILE, type ShrineData } from "../src/core/world/shrines.js";
import { VIEWPORT_INTERIOR, invertRect, fillViewportInterior } from "../src/skin/fiel/frame.js";
import { wellDoneInvertWindowMs, quakeDurationMs, renderCue } from "../src/skin/fiel/speaker.js";
import { RitualInvert } from "../src/ui/ritual-invert.js";
import { planTurnPhase } from "../src/skin/turn-phase.js";

// ── Fixture: un santuario con la lección del Codex YA aprendida y la quest ACTIVA, que es
//    la única combinación que lleva a la rama WELL DONE (`shrineMode` → "quest-complete").
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

/** `learned` = bit del Codex (0x58ce) · `quest` = bit de misión (0x58cc), por virtud 0. */
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

/** Corre el rito completo de Honesty y devuelve los eventos de la RESOLUCIÓN. */
function ritoDeHonestidad(learned: boolean, quest: boolean): GameEvent[] {
  const game = new Game(
    {} as ExtractedInitialState, makeWorld(), gameData, makeState(learned, quest),
  );
  game.enter();
  return game.submitShrineVisit("Honesty", ["Ahm", "Ahm", "Ahm"]);
}

const idx = (evs: GameEvent[], p: (e: GameEvent) => boolean): number => evs.findIndex(p);

describe("#295 · el core EMITE la inversión donde la emite el binario", () => {
  it("CONTROL POSITIVO: el fixture llega de verdad a la rama WELL DONE", () => {
    const evs = ritoDeHonestidad(true, true);
    expect(
      evs.some((e) => e.kind === "message" && e.text?.includes("WELL DONE")),
      "sin esto los tres asertos de abajo serían vacuos por no entrar en la rama",
    ).toBe(true);
  });

  it("el WELL DONE emite `ritual-invert` (0x0c34 set_color + 0x0c41 rect XOR)", () => {
    const evs = ritoDeHonestidad(true, true);
    expect(evs.filter((e) => e.kind === "ritual-invert")).toHaveLength(1);
  });

  it("va en el ORDEN del binario: DESPUÉS del «WELL DONE» (0x0c29) y ANTES de los atributos", () => {
    const evs = ritoDeHonestidad(true, true);
    const iTexto = idx(evs, (e) => e.kind === "message" && !!e.text?.includes("WELL DONE"));
    const iInv = idx(evs, (e) => e.kind === "ritual-invert");
    const iAttr = idx(evs, (e) => e.kind === "message" && /^\w+ \+1\n$/.test(e.text ?? ""));
    expect(iInv).toBeGreaterThan(iTexto); // 0x0c29 < 0x0c41
    expect(iAttr, "el original imprime «Strength +1» CON el viewport ya invertido")
      .toBeGreaterThan(iInv); // 0x0c41 < 0x0c9c
  });

  it("y arrastra el sfx de los DOS barridos (0x0c44-0x0c85), inmediatamente detrás", () => {
    const evs = ritoDeHonestidad(true, true);
    const iInv = idx(evs, (e) => e.kind === "ritual-invert");
    expect(evs[iInv + 1]).toMatchObject({ kind: "sfx", sfx: { id: "shrine-well-done" } });
  });

  it("las otras DOS ramas del VISIT no invierten (ordained; donación = sólo el prompt)", () => {
    // ORDAINED: sin la lección del Codex. DONACIÓN: con lección y SIN quest — el visit
    // emite sólo `shrine-donate-prompt`; la inversión de la donación vive en el ÉXITO de
    // `submitDonation` (#364, CAST2 0x0bc3-0x0bcd), sellada en prompts-donation.test.ts.
    for (const [learned, quest] of [[false, false], [true, false]] as const) {
      const evs = ritoDeHonestidad(learned, quest);
      expect(
        evs.some((e) => e.kind === "ritual-invert"),
        `rama learned=${learned} quest=${quest}`,
      ).toBe(false);
    }
  });
});

describe("#295/#355 · la VENTANA sale del asm (barridos + sacudida), no de un cronómetro", () => {
  it("es la duración de los DOS tramos espejo del cue MÁS la sacudida de 0x0c88 (#355)", () => {
    // #355: el tramo 0x0c41 (rect XOR) → 0x0d1a (kernel_flash) lleva SEIS llamadas, no dos
    // (acta #345 §6): los dos barridos (0x0c57/0x0c79), la sacudida (0x0c88 call 0x4e92 →
    // kernel 0x3072) y tres print_string condicionales sin constante de reloj. La ventana
    // corta (solo barridos) dejaba el trueno encadenado sonando FUERA del negativo.
    const segs = renderCue({ id: "shrine-well-done" });
    expect(segs, "los dos bucles de 0x0c44 y 0x0c66").toHaveLength(2);
    const total = segs.reduce((a, s) => a + s.ms, 0);
    expect(wellDoneInvertWindowMs()).toBeCloseTo(total + quakeDurationMs(), 6);
    expect(segs[0]!.ms, "las dos mitades son iguales: mismos cinco args salvo `si`")
      .toBeCloseTo(segs[1]!.ms, 6);
  });

  it("y EN CRUDO: 6.277,5 ms — la derivación no puede recalcularse desde el sujeto", () => {
    // Barridos: 2 tramos × 460 iteraciones (si de 0x7d0 a 0x61a8, paso 0x32) × tone
    // count 0x96 ⇒ 920 × 150 × 0,93/24 ms = 5.347,5 ms. Sacudida (cue `quake`, tri-banda
    // Clase C de #29): 8 pulsos × ((300+220+200)·1,5 + 80·24) muestras = 24.000 × 0,93/24
    // = 930 ms. Prints de atributo (0x0cba/0x0cdb/0x0cfc): 0 ms (sin constante de reloj).
    // Total 5.347,5 + 930 = 6.277,5 ms. La CORTA (5.347,5 = solo barridos) es el mutante.
    expect(wellDoneInvertWindowMs()).toBeCloseTo(6277.5, 6);
  });

  it("y es una ventana REAL, no cero (el rect XOR suelto dura hasta el flash de 0x0d1a)", () => {
    expect(wellDoneInvertWindowMs()).toBeGreaterThan(0);
  });
});

describe("fix-quakeshake · la sacudida VISUAL va SERIALIZADA tras los barridos (0x0c88 tras el jg de 0x0c83)", () => {
  // En CAST2 la sacudida (0x0c88 call 0x4e92 → kernel 0x3072, que dibuja Y suena) corre
  // DESPUÉS de que el `jg 0xc69` cierre el segundo barrido: un solo hilo, serializado por
  // construcción. El port partía la propiedad en dos: el AUDIO ya iba encadenado
  // (`CHAINED_CUES`, #345) pero la QuakeShake VISUAL arrancaba en t=0 de la ventana —
  // solapada con el arranque de la inversión en vez de ocupar su hueco final. El reloj del
  // skin es `planTurnPhase` (#208): `applyTurnFx` dispara `quake.trigger(now + quakeStartMs)`.
  it("EN CRUDO sobre el lote REAL del core: quakeStartMs = 5.347,5 ms (los dos barridos de 0x0c44-0x0c85)", () => {
    // 5.347,5 = 920 tonos × 150·0,93/24 — el esperado va en crudo, no recalculado del sujeto.
    const plan = planTurnPhase(ritoDeHonestidad(true, true));
    expect(plan.quakes, "control positivo: el lote lleva la sacudida de 0x0c88").toBe(1);
    expect(plan.quakeStartMs).toBeCloseTo(5347.5, 6);
  });

  it("la sacudida cae DENTRO del negativo y lo CIERRA: t0 + sacudida = 6.277,5 ms en crudo", () => {
    // El binario restaura (0x0d1a kernel_flash) DESPUÉS de la sacudida; #355 dimensionó la
    // ventana como barridos + sacudida, así que la sacudida serializada acaba EXACTO en el
    // cierre — ni un ms de temblor sobre pantalla ya restaurada.
    const plan = planTurnPhase(ritoDeHonestidad(true, true));
    expect(plan.quakeStartMs + quakeDurationMs()).toBeCloseTo(6277.5, 6);
    expect(plan.quakeStartMs + quakeDurationMs()).toBeCloseTo(wellDoneInvertWindowMs(), 6);
  });

  it("el rumble sigue ALINEADO a su sacudida (misma t0 = 5.347,5): la proyección coincide con el tail que ya tenía", () => {
    // Antes del fix la proyección decía 0 y el agendado real (tail de CHAINED_CUES) 5.347,5:
    // dos relojes en desacuerdo. Ahora `sfxLeadMs` del cue `quake` = quakeStartMs, y el
    // compose por MAX del agendado no lo mueve (max(5347,5, 5347,5)).
    const evs = ritoDeHonestidad(true, true);
    const plan = planTurnPhase(evs);
    const iQuakeSfx = evs.findIndex((e) => e.kind === "sfx" && e.sfx?.id === "quake");
    expect(iQuakeSfx, "control positivo: el lote lleva el cue del rumble").toBeGreaterThan(-1);
    expect(plan.sfxLeadMs[iQuakeSfx]).toBeCloseTo(5347.5, 6);
  });
});

describe("#295 · la primitiva sabe pintar en el espacio de coordenadas del shader", () => {
  /** `ctx` de mentira que apunta el rect pedido, el modo de composición y el color. */
  function ctxEspia(): {
    ctx: CanvasRenderingContext2D;
    llamadas: { x: number; y: number; w: number; h: number; op: string; fill: string }[];
  } {
    const llamadas: { x: number; y: number; w: number; h: number; op: string; fill: string }[] = [];
    const fake = {
      globalCompositeOperation: "source-over",
      fillStyle: "#000000",
      save() {},
      restore() {},
      fillRect(x: number, y: number, w: number, h: number) {
        llamadas.push({
          x, y, w, h,
          op: String(fake.globalCompositeOperation),
          fill: String(fake.fillStyle),
        });
      },
    };
    return { ctx: fake as unknown as CanvasRenderingContext2D, llamadas };
  }

  it("`invertRect` pinta el rect QUE SE LE DA, no el rect EGA cableado", () => {
    const e = ctxEspia();
    // Un viewport de dispositivo plausible (×4 con el chrome del shader delante).
    invertRect(e.ctx, 32, 32, 704, 704);
    expect(e.llamadas).toHaveLength(1);
    expect(e.llamadas[0]).toMatchObject({ x: 32, y: 32, w: 704, h: 704 });
  });

  it("…y con OTRO rect distinto da OTRO resultado (el control que separa dar de ignorar)", () => {
    const e = ctxEspia();
    invertRect(e.ctx, 5, 7, 11, 13);
    expect(e.llamadas[0]).toMatchObject({ x: 5, y: 7, w: 11, h: 13 });
    expect(e.llamadas[0]!.op, "sigue siendo el mismo gesto: `difference` con blanco")
      .toBe("difference");
    expect(e.llamadas[0]!.fill).toBe("#ffffff");
  });

  it("`fillViewportInterior` usa EL MISMO rect que la inversión (de-dup de la cortina #296)", () => {
    const e = ctxEspia();
    fillViewportInterior(e.ctx, "#000000");
    expect(e.llamadas[0]).toMatchObject({
      x: VIEWPORT_INTERIOR.x, y: VIEWPORT_INTERIOR.y,
      w: VIEWPORT_INTERIOR.w, h: VIEWPORT_INTERIOR.h,
    });
    expect(e.llamadas[0]!.op, "opaco, no `difference`: es relleno, no XOR").toBe("source-over");
    expect(e.llamadas[0]!.fill).toBe("#000000");
  });
});

describe("#295 · el CONDUCTOR sostiene el estado y lo retira solo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Espía del `setRitualInvert` de la vista, con la traza de valores en orden. */
  const espiaVista = (): { view: { setRitualInvert(on: boolean): void }; traza: boolean[] } => {
    const traza: boolean[] = [];
    return { view: { setRitualInvert: (on) => void traza.push(on) }, traza };
  };

  it("monta la inversión al arrancar y NO la retira todavía", () => {
    vi.useFakeTimers();
    const { view, traza } = espiaVista();
    new RitualInvert({ view, sceneMs: (ms) => ms }).run(1000);
    expect(traza).toEqual([true]);
  });

  it("la ventana se CIERRA SOLA al agotarse (= el `kernel_flash(10)` de 0x0d1a)", () => {
    vi.useFakeTimers();
    const { view, traza } = espiaVista();
    new RitualInvert({ view, sceneMs: (ms) => ms }).run(1000);
    vi.advanceTimersByTime(999);
    expect(traza, "control: un ms antes sigue invertido").toEqual([true]);
    vi.advanceTimersByTime(1);
    expect(traza).toEqual([true, false]);
  });

  it("`reset` desmonta la inversión (cargar partida a mitad del rito no deja el negativo pegado)", () => {
    vi.useFakeTimers();
    const { view, traza } = espiaVista();
    const ctl = new RitualInvert({ view, sceneMs: (ms) => ms });
    ctl.run(1000);
    ctl.reset();
    expect(traza).toEqual([true, false]);
    vi.advanceTimersByTime(5000);
    expect(traza, "y el temporizador cancelado no vuelve a hablar").toEqual([true, false]);
  });

  it("bajo AUTOMATIZACIÓN (unidad 0) drena síncrono — degradación declarada, no un fallo", () => {
    const { view, traza } = espiaVista();
    new RitualInvert({ view, sceneMs: () => 0 }).run(1000);
    expect(traza).toEqual([true, false]);
  });
});
