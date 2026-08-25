/**
 * AUDIO-DIFF (task #56) — guarda de calibración del speaker fiel.
 *
 * Comprueba que la SÍNTESIS del port coincide con el GROUND-TRUTH DERIVADO del
 * disasm + anclado por el oráculo, con números y tolerancias explícitas. El
 * "truth" se computa aquí de FORMA INDEPENDIENTE (fórmulas de la ley de hardware,
 * NO llamando a los helpers del port) para que sea una verificación real, no una
 * tautología. Si alguien re-toca las constantes de calibración, este test falla.
 *
 * Ley (ver cabecera de speaker.ts y re/notes/audio-diff-calibration.md):
 *   duración = paramCount · innerCount · t_dec ; innerCount por primitiva:
 *     sweep floor(C/24) · noise C>>4 · beep/glide C  (C=[0x5356], oráculo=1308)
 *   U = C·t_dec = 0.93 ms  (task #72: cascada real ultima_001.wav, burst 3.46 ms /
 *   (60·81); antes 1.10 ms del oráculo ±13 %) → todo sale de U.
 *   pitch: sweep=(inc/65536)·SR (SR=24000/U); beep/glide=Hz exacto del PIT (=arg).
 */
import { describe, it, expect } from "vitest";
import { renderCue, beep, glide, noiseBurst, toneSweep } from "../src/skin/fiel/speaker.js";

const U = 0.93; // DELAY_UNIT_MS (ancla WAV real, task #72; era 1.10 oráculo)
const SR = 24000 / U; // 25806 Hz
const NOISE_MS = (dur: number) => (dur * U) / 16; // inner C>>4
const SWEEP_MS = (count: number, delay: number) => (count * delay * U) / 24; // inner C/24
const BEEP_MS = (dur: number) => dur * U; // inner C
const GLIDE_MS = (total: number) => total * U; // inner C (delay(step,1))
const GAP_MS = (count: number) => count * U; // delay(count,1): inner C
const sweepF0 = (inc: number) => (inc / 65536) * SR;

/** Tolerancia: 1% (redondeos de floor del inner) salvo donde se indique. */
const near = (got: number, want: number, tolPct = 1) =>
  expect(Math.abs(got - want)).toBeLessThanOrEqual((want * tolPct) / 100 + 1e-6);

describe("audio-diff: duración del port == ley derivada (ancla WAV real U=0.93ms)", () => {
  it("BUMP move-blocked = beep(0xa5,0xc8): 186 ms @ 165 Hz (era 2560 ms, 11.6× de más)", () => {
    const s = renderCue({ id: "move-blocked" })[0]!;
    near(s.ms, BEEP_MS(0xc8)); // 200·0.93 = 186
    expect(s.ms).toBeCloseTo(186, 0);
    // ⚠ El kind es PRECONDICIÓN, no rama (auditoría ronda 2): si una regresión lo
    // cambiara, los asertos de Hz de abajo dejarían de correr EN SILENCIO y el test
    // seguiría verde sin medir lo que su título promete. Se asevera antes de usarlo.
    expect(s.kind).toBe("tone");
    if (s.kind === "tone") {
      expect(s.f0).toBe(165); // PIT directo → Hz EXACTO (0xa5)
      expect(s.f0).toBe(s.f1);
    }
  });

  it("PASO move-step = burst + hueco 18.6ms + burst: dos clics 'tk‥tk' (no un blip)", () => {
    const segs = renderCue({ id: "move-step" });
    expect(segs.length).toBe(3); // burst, silence(delay 0x14), burst
    near(segs[0]!.ms, NOISE_MS(25)); // 25·0.93/16 = 1.45
    near(segs[1]!.ms, GAP_MS(0x14)); // delay(0x14,1)=20·0.93 = 18.6 ms (WAV real: hueco 16.8–18.7)
    near(segs[2]!.ms, NOISE_MS(25));
    expect(segs[1]!.kind).toBe("silence");
  });

  it("CAÑONAZO cannon-fire = glide(total=300): 279 ms (era 960 ms, 2.9× de más)", () => {
    const s = renderCue({ id: "cannon-fire" })[0]!;
    near(s.ms, GLIDE_MS(300)); // 300·0.93 = 279
    expect(s.ms).toBeCloseTo(279, 0);
    expect(s.kind).toBe("tone"); // precondición aseverada (ver nota de arriba)
    if (s.kind === "tone") {
      expect(s.f0).toBe(1000); // glide: Hz exactos (PIT), primer set_tone
      // #137: el barrido CORTA ANTES de la nominal (fin no se compara en 0x43ae):
      // inc = trunc(−800·5/300) = −13, 60 vueltas ⇒ último tono 1000 − 13·59 = 233 Hz.
      expect(s.f1).toBe(233);
    }
  });

  it("escape/anillo = glide(total=40): 44 ms", () => {
    near(renderCue({ id: "combat-escape" })[0]!.ms, GLIDE_MS(40));
    near(renderCue({ id: "ring-vanishes" })[0]!.ms, GLIDE_MS(40));
  });

  it("combate combat-hit = noise_burst(dur=3000): ~174 ms", () => {
    near(renderCue({ id: "combat-hit" })[0]!.ms, NOISE_MS(3000)); // 3000·0.93/16 = 174.4
  });

  it("casting cast-spell = 3×sweep(count=10800)+sweep(21600): ~2093 ms", () => {
    const want = 3 * SWEEP_MS(10800, 1) + SWEEP_MS(21600, 1);
    const got = renderCue({ id: "cast-spell" }).reduce((a, s) => a + s.ms, 0);
    near(got, want);
  });

  it("moongate = sweep(count=30000): ~1163 ms @ f0=(0x170c/65536)·SR", () => {
    const s = renderCue({ id: "moongate" })[0]!;
    near(s.ms, SWEEP_MS(30000, 1)); // 30000·0.93/24 = 1162.5
    expect(s.kind).toBe("tone"); // precondición aseverada (ver nota de arriba)
    if (s.kind === "tone") near(s.f0, sweepF0(0x170c), 2);
  });

  it("AMBIENTE fuente/cascada = noise_burst cortos (0x4102 clases 3/2)", () => {
    // ambient-fountain NB(10,30,25000): dur=30 → 30·0.93/16 ≈ 1.74 ms de siseo agudo.
    near(renderCue({ id: "ambient-fountain" })[0]!.ms, NOISE_MS(30));
    // ambient-waterfall NB(20,60,10000): dur=60 → 60·0.93/16 ≈ 3.49 ms (WAV real: 3.46 ms).
    near(renderCue({ id: "ambient-waterfall" })[0]!.ms, NOISE_MS(60));
  });

  it("AMBIENTE reloj = beep(3000/2000,3): tic/tac @ Hz exactos (0x4102 clase 1)", () => {
    const tic = renderCue({ id: "ambient-clock-tick" })[0]!;
    const tac = renderCue({ id: "ambient-clock-tock" })[0]!;
    near(tic.ms, BEEP_MS(3)); // 3·0.93 = 2.79 ms
    near(tac.ms, BEEP_MS(3));
    if (tic.kind === "tone") expect(tic.f0).toBe(3000); // beep: PIT directo → Hz exacto
    if (tac.kind === "tone") expect(tac.f0).toBe(2000);
    // campanada de la hora = sweep(count=2000): ~77.5 ms.
    near(renderCue({ id: "ambient-clock-chime" })[0]!.ms, SWEEP_MS(2000, 1));
  });

  it("las primitivas base cumplen la ley con sus params crudos", () => {
    near(beep(0xa5, 0xc8).ms, BEEP_MS(0xc8));
    near(glide(1000, 200, 5, 300).ms, GLIDE_MS(300));
    near(noiseBurst(1, 25, 1000).ms, NOISE_MS(25));
    near(toneSweep(0x170c, 1, 30000, 2000, 2).ms, SWEEP_MS(30000, 1));
    near(toneSweep(0x2648, 1, 28000, 1000, 2).f0, sweepF0(0x2648), 2);
  });
});
