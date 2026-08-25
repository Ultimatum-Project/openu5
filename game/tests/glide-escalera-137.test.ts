/**
 * Ficha #137 — el barrido del speaker (`pcspeaker_glide`, ULTIMA.EXE 0x43ae) NUNCA llega
 * a su frecuencia nominal, y el port hacía una rampa limpia que SÍ llegaba.
 *
 * La forma REAL, leída del cuerpo (re/disasm/ULTIMA.EXE.asm:7424-7459):
 *   · inc = trunc16(((fin − inicio) · paso) / total)   — imul GUARDA SÓLO ax (0x43c2/0x43c5:
 *     la parte alta de dx:ax se descarta y 0x43cb `cwd` re-deriva el signo del low word),
 *     idiv trunca hacia CERO (0x43cc).
 *   · bucle `mientras di < total { set_tone(si); delay(1, paso); si += inc; di += paso }`
 *     (0x43d8-0x43ef, corte `jl` FIRMADO en 0x43ef).
 *   · `fin` ([bp+8]) NO se compara NUNCA: sólo entra en el cálculo del incremento. El último
 *     divisor escrito al PIT (0x22e2: div 0x1234DE → out 0x42 ×2) RETIENE hasta el gate OFF
 *     (0x43f7 call 0x230e = and al,0xfc; out 0x61) — la frecuencia final efectiva es
 *     inicio + inc·(vueltas−1), no la nominal.
 *
 * TODOS los esperados de frecuencia van EN CRUDO: derivados A MANO de los argumentos del
 * call-site y la aritmética del cuerpo, nunca calculados desde el código del port (la
 * memoria del proyecto: el aserto que calcula su esperado desde el sujeto es tautológico).
 *
 * Testigos derivados en detalle (re/notes/barrido-137-acta.md):
 *   · OUTSUBS.OVL.asm:462-470 (@0x0482-0x0492): glide(2500→800, 1, 300)
 *     inc = trunc(−1700/300) = −5 · 300 vueltas · último tono 2500 − 5·299 = **1005 Hz**
 *     (nominal 800: desvío +205 Hz, el peor del corpus).
 *   · MAINOUT.OVL.asm:1745-1753 (@0x112b-0x113b): glide(660→150, 40, 7800)
 *     inc = trunc(−20400/7800) = −2 · 195 vueltas · último tono 660 − 2·194 = **272 Hz**
 *     (nominal 150: desvío +122 Hz — más de una octava por encima de lo pedido).
 */
import { describe, expect, it } from "vitest";
import {
  SFX_CATALOG,
  SpeakerSynth,
  glide,
  renderCue,
  type SfxSeg,
} from "../src/skin/fiel/speaker.js";

type Tone = Extract<SfxSeg, { kind: "tone" }>;

function lastStep(seg: Tone): number | undefined {
  return seg.steps?.[seg.steps.length - 1];
}

describe("ficha #137 — glide 0x43ae: escalera real, corte temprano, nominal inalcanzada", () => {
  it("TESTIGO 1 · waterfall-fall (OUTSUBS 0x0492): 300 escalones y último tono 1005 Hz, no 800", () => {
    const seg = SFX_CATALOG["waterfall-fall"]()[0] as Tone;
    expect(seg.kind).toBe("tone");
    expect(seg.steps).toBeDefined();
    expect(seg.steps!.length).toBe(300); // total=300, paso=1 ⇒ 300 vueltas
    expect(seg.steps![0]).toBe(2500); // primer set_tone = inicio, antes del incremento
    expect(seg.steps![1]).toBe(2495); // segunda vuelta: 2500 + (−5)
    expect(lastStep(seg)).toBe(1005); // 2500 − 5·299 — la nominal 800 NUNCA se escribe
    expect(seg.f1).toBe(1005); // f1 = frecuencia final EFECTIVA (la que el PIT retiene)
  });

  it("TESTIGO 2 · glide(660→150, 40, 7800) (MAINOUT 0x113b/0x12a6): 195 escalones y último tono 272 Hz", () => {
    const seg = glide(660, 150, 40, 7800);
    expect(seg.steps!.length).toBe(195); // 7800/40 vueltas
    expect(seg.steps![0]).toBe(660);
    expect(seg.steps![1]).toBe(658); // inc = trunc(−20400/7800) = −2 (exacto −2,62: truncado)
    expect(lastStep(seg)).toBe(272); // 660 − 2·194 — nominal 150 jamás alcanzada (+122 Hz)
    expect(seg.f1).toBe(272);
  });

  it("la CLASE: los cuatro combos restantes del corpus estático, finales en crudo", () => {
    // cannon-fire = glide(1000→200,5,300): inc=trunc(−4000/300)=−13 · 60 vueltas · 1000−13·59
    expect(lastStep(renderCue({ id: "cannon-fire" })[0] as Tone)).toBe(233);
    // combat-escape/ring-vanishes = glide(1200→2000,1,40): inc=20 · 40 vueltas · 1200+20·39
    expect(lastStep(renderCue({ id: "combat-escape" })[0] as Tone)).toBe(1980);
    expect(lastStep(renderCue({ id: "ring-vanishes" })[0] as Tone)).toBe(1980);
    // dungeon-fail/torch-borrowed = glide(800→2000,1,50): inc=24 · 50 vueltas · 800+24·49
    expect(lastStep(renderCue({ id: "dungeon-fail" })[0] as Tone)).toBe(1976);
    expect(lastStep(renderCue({ id: "torch-borrowed" })[0] as Tone)).toBe(1976);
  });

  it("la duración NO se mueve con el fix: waterfall-fall sigue en ~279 ms (300·24/SR)", () => {
    const seg = SFX_CATALOG["waterfall-fall"]()[0] as Tone;
    expect(seg.ms).toBeCloseTo(279, 0); // vueltas·paso = 300·1 = total: misma ley que antes
  });

  it("barrido MUDO (DUNGEON 0x1483 con n≥3): total negativo ⇒ jl firmado no da ni una vuelta", () => {
    const seg = glide(3200, 3500, 1, -4); // total = 20 − 8·3 = −4
    expect(seg.steps).toEqual([]);
    expect(seg.ms).toBe(0);
  });

  it("CAMINO de síntesis: un solo oscilador, escalera por setValueAtTime, CERO rampas", () => {
    const sets: [number, number][] = [];
    const ramps: [number, number][] = [];
    const oscs: { started: number; stopped: number }[] = [];
    const param = (rec: boolean) => ({
      setValueAtTime(v: number, t: number) {
        if (rec) sets.push([v, t]);
      },
      linearRampToValueAtTime(v: number, t: number) {
        if (rec) ramps.push([v, t]);
      },
      exponentialRampToValueAtTime() {},
      value: 0,
    });
    const ctx = {
      currentTime: 0,
      destination: {},
      createOscillator() {
        const rec = { started: -1, stopped: -1 };
        oscs.push(rec);
        return {
          type: "sine",
          frequency: param(true),
          connect() {},
          start(t: number) {
            rec.started = t;
          },
          stop(t: number) {
            rec.stopped = t;
          },
        };
      },
      createGain() {
        return { gain: param(false), connect() {} };
      },
    } as unknown as AudioContext;
    new SpeakerSynth(ctx).play({ id: "waterfall-fall" });
    expect(oscs).toHaveLength(1); // la escalera vive en UN oscilador (el gate no se cierra entre vueltas)
    expect(ramps).toHaveLength(0); // sin linearRamp: el PIT salta de divisor en divisor
    expect(sets).toHaveLength(300);
    expect(sets[0]![0]).toBe(2500);
    expect(sets[sets.length - 1]![0]).toBe(1005); // lo último escrito RETIENE hasta el gate OFF
    // Los escalones son equiespaciados y crecientes en el tiempo (delay(1,paso) constante).
    for (let i = 1; i < sets.length; i++) expect(sets[i]![1]).toBeGreaterThan(sets[i - 1]![1]);
  });
});
