/**
 * AUDIO del demo de la intro (carril de audio) — wiring de los SFX del cine-guion a
 * SpeakerAudio + el AMBIENTE de cascada tile-driven (requisito verbatim del usuario:
 * "que los sonidos de la catarata suenen como en el juego"). El wiring vive en
 * ui/faithful-intro.ts (DOM); aquí se validan las piezas PURAS: el gate de cascada
 * (frameHasWaterfall), que el demo REAL contiene cascada, y que los cues del mapeo
 * DemoSfx→SfxId existen en el catálogo de speaker.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildDemoFrames, frameHasWaterfall, frameAmbientTiles } from "../src/skin/fiel/demo-scene.js";
import { SFX_CATALOG, renderCue } from "../src/skin/fiel/speaker.js";

describe("gate de cascada del demo (frameHasWaterfall = motor 0x416c modo 2, &0xfc==0xd4)", () => {
  it("acepta la familia Waterfall 0xd4–0xd7 (y su banco alto 0x1d4…), rechaza el resto", () => {
    for (const t of [0xd4, 0xd5, 0xd6, 0xd7, 0x1d4, 0x1d7]) {
      expect(frameHasWaterfall([0, t, 0])).toBe(true);
    }
    // 0xd8 (fuente), 0x00, y -1 (celda oculta por la cortina) NO disparan cascada.
    expect(frameHasWaterfall([0xd8, 0x00, 5])).toBe(false);
    expect(frameHasWaterfall([-1, -1])).toBe(false);
    expect(frameHasWaterfall([])).toBe(false);
  });
});

describe("familias de tile de ambiente (frameAmbientTiles = escáner 0x416c)", () => {
  it("clasifica Waterfall 0xd4–0xd7, Fountain 0xd8–0xdb, Clock 0xfa/0xfb; ignora el resto y -1", () => {
    expect(frameAmbientTiles([0xd4])).toEqual({ waterfall: true, fountain: false, clock: false });
    expect(frameAmbientTiles([0xd8])).toEqual({ waterfall: false, fountain: true, clock: false });
    expect(frameAmbientTiles([0xfa])).toEqual({ waterfall: false, fountain: false, clock: true });
    expect(frameAmbientTiles([0xfb, 0x1d5])).toEqual({ waterfall: true, fountain: false, clock: true });
    expect(frameAmbientTiles([0x00, 0x05, -1])).toEqual({ waterfall: false, fountain: false, clock: false });
  });
});

describe("el demo REAL contiene ambiente (si no, nunca sonaría)", () => {
  it("tiene frames con CASCADA (The Arrival) y con RELOJ (mismo motor 0x416c)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const data = JSON.parse(readFileSync(join(dir, "../assets/demo-scene.json"), "utf8"));
    const frames = buildDemoFrames(data);
    expect(frames.some((f) => frameHasWaterfall(f.tiles))).toBe(true);
    expect(frames.some((f) => frameAmbientTiles(f.tiles).clock)).toBe(true);
  });
});

describe("cues del mapeo DemoSfx→SfxId (thunder/chime/summon) existen y suenan", () => {
  // El mapeo vive en faithful-intro (DEMO_SFX_CUE): thunder→intro-thunder, chime→intro-chime,
  // summon→intro-summon (params byte-citados FONT.OVL). Aquí se garantiza que los 3 destinos
  // + la cascada son cues reales del catálogo y renderizan segmentos (no cues fantasma).
  for (const id of [
    "intro-thunder", "intro-chime", "intro-summon",
    "ambient-waterfall", "ambient-fountain", "ambient-clock-tick", "ambient-clock-tock",
  ] as const) {
    it(`el cue "${id}" está en el catálogo y produce segmentos`, () => {
      expect(SFX_CATALOG[id]).toBeDefined();
      expect(renderCue({ id }).length).toBeGreaterThan(0);
    });
  }
  it("intro-thunder es una ráfaga de RUIDO (FONT 0x3ca noise_burst)", () => {
    const segs = renderCue({ id: "intro-thunder" });
    expect(segs[0]?.kind).toBe("noise");
  });
});
