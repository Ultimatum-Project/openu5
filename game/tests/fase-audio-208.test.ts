/**
 * #208 — LA FASE AUDIO↔VISUAL DE CLASE: el audio puede esperar hitos VISUALES.
 *
 * LO QUE #243 DEJÓ MEDIDO Y SIN ARREGLAR (`re/notes/shadowlord-fx-243.md` §9.3): tras
 * cablear que lo visual espere al audio (`planTurnPhase`, ex-`planVisualPhase`), el canal
 * inverso seguía sordo — `playSegs` encadenaba bloqueante-tras-bloqueante SIN consultar la
 * fase visual, y la fanfarria del ritual entraba ~3,4 s ANTES de lo debido:
 *
 *   binario : barrido [0, 7,13] → sacudida → explosiones → fanfarria [~10,5 → ~12,6]
 *   port pre: barrido [0, 7,13] → fanfarria [7,13 → 9,22]   (sonaba SOBRE la sacudida)
 *
 * La DERIVACIÓN del orden es la de siempre (cuerpos leídos, actas #201/#243):
 *   CAST 0x15dd-0x162a  barrido (920 tone_sweep)          = 7130 ms   (catálogo)
 *   CAST 0x169d/a0/a3   screen_shake_fx ×3 (kernel 0x3072) = 2808 ms  (3×8×117, quake.ts)
 *   CAST 0x16aa+0x16f4  pause(3) + explosion ×7            =  585 ms  (3×55 + 7×60, world-fx)
 *   CAST 0x1759         sfx_victory_fanfare (0x4368)       — DESPUÉS de todo lo anterior
 * En 1988 esa serialización es GRATIS: un solo hilo y cada primitiva gira hasta acabar.
 * En el port la regla es UNA y vive en `planTurnPhase`: el MISMO recorrido que decide el
 * `leadMs` de cada visual proyecta también el de cada cue (`sfxLeadMs`), y el bus
 * (`notifyTurn` → `onSfx` → `SpeakerAudio.play`) lo lleva hasta el agendado.
 *
 * Los esperados van EN CRUDO (7130 · 9938 · 10523): un esperado recalculado desde las
 * mismas fuentes que el sujeto sería tautológico.
 */
import { describe, expect, it } from "vitest";
import type { Game, GameEvent } from "../src/core/game.js";
import type { SfxCue, SfxId } from "../src/core/sfx.js";
import { planTurnPhase } from "../src/skin/turn-phase.js";
import { SpeakerSynth } from "../src/skin/fiel/speaker.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import { useShard, type UseToolsCtx } from "../src/core/endgame/use-tools.js";
import {
  FLAME_X,
  FLAME_Y,
  FLAME_LOCATION,
  FLAME_FLOOR,
  SHADOWLORD_TILE,
} from "../src/core/quest/ritual.js";
import type { GameState } from "../src/core/state.js";
import { fakeAudioCtx } from "./helpers/fake-audio-ctx.js";

const sfx = (id: SfxId) => ({ kind: "sfx" as const, sfx: { id } });
const quake = { kind: "quake" as const };
const explosion = {
  kind: "cell-explosion" as const,
  cellFx: { dx: 0, dy: -1, bursts: 7, preDelayUnits: 3, underTile: 252 },
};

/** Los leads de los eventos sfx del lote, en su orden (proyección de `sfxLeadMs`). */
const leadsDeSfx = (events: readonly GameEvent[]): number[] => {
  const plan = planTurnPhase(events);
  return events.flatMap((e, i) => (e.kind === "sfx" && e.sfx ? [Math.round(plan.sfxLeadMs[i]!)] : []));
};

describe("#208 · el plan proyecta la fase del AUDIO (sfxLeadMs) del MISMO recorrido", () => {
  it("la fanfarria del ritual espera a barrido + sacudida + explosión: 10.523 ms", () => {
    // 10523 = 7130 (CAST 0x15dd-0x162a) + 2808 (0x169d…, 3×8×117) + 585 (0x16aa pause(3)
    // ×55 + 0x16f4 explosión ×7 ×60). El destino del binario: fanfarria [~10,5 → ~12,6]
    // (fx-243 §9.3). El valor pre-#208 era 7130 (solo el tail de audio) — 3,4 s antes.
    const lote = [sfx("shard-sweep"), quake, quake, quake, sfx("quake"), explosion, sfx("victory-fanfare")];
    expect(leadsDeSfx(lote)).toEqual([0, 7130, 10523]);
  });

  it("el rumble NO espera a su propia sacudida — es su otra mitad (kernel 0x3072): 7130, no 9938", () => {
    // `screen_shake_fx` ES el sonido Y la sacudida (acta av-243 §3.1: un hilo, una
    // frecuencia por paso de dibujo, compuerta cerrada al salir). El port lo parte en
    // {kind:"quake"} + cue "quake", y la regla de fase los REUNIFICA: el cue se alinea con
    // el ARRANQUE de la ventana. El mutante que este aserto mata: tratar al rumble como a
    // cualquier cue posterior a un visual lo empujaría al FINAL de la ventana (9938).
    const lote = [sfx("shard-sweep"), quake, quake, quake, sfx("quake"), explosion];
    expect(leadsDeSfx(lote)).toEqual([0, 7130]);
  });

  it("★ ALCANCE: el sismo del Underworld y el clavicémbalo quedan donde estaban (leads 0)", () => {
    // Sismo (MAINOUT 0x0a76) y clavicémbalo (TOWN 0x0e9e): par {quake, cue} sin nada
    // delante → lead 0. Si esto dejara de dar ceros, la fase habría movido a media
    // población de audio del juego.
    expect(leadsDeSfx([quake, sfx("quake"), { kind: "map-changed" as const }])).toEqual([0]);
  });

  it("★ fix-quakeshake: el WELL DONE SÍ mueve fase — el tono del altar empuja sacudida y rumble a 5.347,5", () => {
    // CAST2 0x0c44-0x0c85 → 0x0c88: los barridos del altar GIRAN hasta acabar y la sacudida
    // (kernel 0x3072) corre detrás, en un solo hilo. Hasta fix-quakeshake este caso daba
    // [0, 0] («encadena por tail, no por fase»): el AUDIO ya salía serializado por el tail
    // de CHAINED_CUES pero la QuakeShake VISUAL — que lee quakeStartMs, no el tail —
    // arrancaba en t=0, solapada con el arranque del negativo. El predicado de fase es
    // ahora CHAINED_CUES (todo cue serializado en el binario empuja), y la proyección del
    // rumble coincide con el agendado que ya tenía (compose por MAX: no se mueve el audio).
    expect(leadsDeSfx([sfx("shrine-well-done"), quake, sfx("quake")])).toEqual([0, 5348]);
    expect(planTurnPhase([sfx("shrine-well-done"), quake, sfx("quake")]).quakeStartMs).toBeCloseTo(5347.5, 6);
  });

  it("la explosión también AVANZA el reloj para lo que la sigue (CAST 0x16f4 bloquea)", () => {
    // Sin fanfarria detrás nada lo observaría; con ella, quitar el avance deja 9938.
    const conExplosion = leadsDeSfx([sfx("shard-sweep"), explosion, sfx("victory-fanfare")]);
    expect(conExplosion).toEqual([0, 7715]); // 7130 + 585, sin sacudida en medio
  });

  it("sobre el lote REAL de useShard — el plan y el emisor no pueden divergir", () => {
    const IDX = 0; // falsehood / Faulinei
    const x = FLAME_X[IDX]!;
    const y = FLAME_Y[IDX]!;
    const location = FLAME_LOCATION[IDX]!;
    const floor = FLAME_FLOOR[IDX]!;
    const state = {
      position: { x, y, location, floor },
      questFlags: {},
      shards: { falsehood: true, hatred: true, cowardice: true },
      shadowlordLocs: [0, 0, 0],
      shadowlordDoomBits: 0,
      shadowlordSummoned: IDX,
      npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
      worldObjects: [{ tile: SHADOWLORD_TILE, location, floor, x, y: y - 1 }],
    } as unknown as GameState;
    const ctx = {
      state,
      dungeonState: null,
      rand: () => 0,
      mapTileWithOverrides: () => 0,
      setMapOverride: () => {},
      setVolatileTerrain: () => {},
      syncTransportFromTile: () => {},
    } as unknown as UseToolsCtx;
    expect(leadsDeSfx(useShard(ctx, "falsehood"))).toEqual([0, 7130, 10523]);
  });
});

describe("#208 · el speaker AGENDA con la espera (playSegs + leadMs)", () => {
  it("play(fanfarria, 10523) arranca en 10,523 s — no en el tail del barrido (7,13)", () => {
    const { ctx, started } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shard-sweep" });
    const tras = started.length;
    synth.play({ id: "victory-fanfare" }, 10523);
    expect(started[tras]).toBeCloseTo(10.523, 3);
  });

  it("el lead y el tail se componen por MAX, no se suman (dos esperas del mismo hecho)", () => {
    // Con un lead MENOR que el tail manda el tail (la conducta de #206 no retrocede).
    const { ctx, started } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shard-sweep" }); // tail = 7,13
    const tras = started.length;
    synth.play({ id: "victory-fanfare" }, 1000);
    expect(started[tras]).toBeCloseTo(7.13, 2);
  });

  it("sin lead, nada cambia: la fanfarria encadena en el tail como desde #206", () => {
    const { ctx, started } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shard-sweep" });
    const tras = started.length;
    synth.play({ id: "victory-fanfare" });
    expect(started[tras]).toBeCloseTo(7.13, 2);
  });
});

describe("#208 · el bus LLEVA la espera (notifyTurn → onSfx(cue, leadMs))", () => {
  const view = () => new CoreViewImpl({} as unknown as Game);

  it("notifyTurn publica cada cue del lote con SU lead del plan", () => {
    const v = view();
    const got: [string, number | undefined][] = [];
    v.subscribe({ onSfx: (c: SfxCue, leadMs?: number) => got.push([c.id, leadMs]) });
    v.notifyTurn([sfx("shard-sweep"), quake, quake, quake, sfx("quake"), explosion, sfx("victory-fanfare")]);
    expect(got.map(([id]) => id)).toEqual(["shard-sweep", "quake", "victory-fanfare"]);
    expect(got.map(([, l]) => Math.round(l ?? -1))).toEqual([0, 7130, 10523]);
  });

  it("emitSfx directo (combate, casting) sigue publicando lead 0 — su lote no existe", () => {
    const v = view();
    const got: (number | undefined)[] = [];
    v.subscribe({ onSfx: (_c: SfxCue, leadMs?: number) => got.push(leadMs) });
    v.emitSfx({ id: "combat-hit" });
    expect(got).toEqual([0]);
  });
});
