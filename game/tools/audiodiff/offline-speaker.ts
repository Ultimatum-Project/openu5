/**
 * RENDER OFFLINE del speaker del port (task #56) — sin navegador.
 *
 * Reproduce EXACTAMENTE la síntesis de `SpeakerSynth.scheduleSeg` (skin/fiel/
 * speaker.ts) en un buffer PCM, para poder medir el sonido del port con el mismo
 * comparador que mide el ground-truth del original. NO reimplementa el catálogo:
 * importa `renderCue`/`SFX_CATALOG` reales, así el WAV es el sonido del port.
 *
 * Fidelidad al SpeakerSynth: onda cuadrada por segmento, rampa lineal de
 * frecuencia f0→f1 (tono) o conmutación por pasos iguales (ruido), y la MISMA
 * envolvente trapezoidal (PEAK_GAIN, EDGE_S). Si el navegador y esto divergen,
 * es un bug del render, no del catálogo.
 */
import type { SfxSeg } from "../../src/skin/fiel/speaker.js";

/** Espejo de las constantes privadas de SpeakerSynth (speaker.ts §capa audio). */
export const PEAK_GAIN = 0.12;
export const EDGE_S = 0.004;
/** Puerta casi instantánea del ruido (espejo de NOISE_EDGE_S, task #72-re). */
export const NOISE_EDGE_S = 0.0002;
/** Paso-bajo del ruido = rolloff del cono (espejo de NOISE_LOWPASS_HZ, task #72-re). */
export const NOISE_LOWPASS_HZ = 2100;
/** Paso-alto del ruido = acoplamiento AC (espejo de NOISE_HIGHPASS_HZ, task #72-re). */
export const NOISE_HIGHPASS_HZ = 20;

/**
 * NOTA DE FIDELIDAD (task #72-re): este render offline es una APROXIMACIÓN del sonido
 * real. La salida AUTORITATIVA (lo que oye el usuario) es la del NAVEGADOR, cuyo
 * `OscillatorNode` "square" es BANDA-LIMITADO (repica en las transiciones) mientras que
 * aquí el cuadrado es crudo. Por eso el navegador suena algo más brillante que este WAV
 * aun con filtros idénticos. La calibración de NOISE_LOWPASS_HZ se hizo contra la
 * captura real del navegador (OfflineAudioContext), no contra este render. Los filtros
 * de abajo SÍ espejan los BiquadFilter de Web Audio (RBJ de 2 polos, Q=1) para acercar
 * lo posible; el A/B para el oído del usuario se genera desde el navegador.
 */

/** Biquad RBJ genérico (Direct Form I) aplicado in-place a un tramo del buffer. */
function biquad(
  buf: Float32Array, from: number, to: number,
  b0: number, b1: number, b2: number, a1: number, a2: number,
): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = from; i < to; i++) {
    const x0 = buf[i]!;
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    buf[i] = y0;
  }
}

/** Paso-bajo RBJ de 2 polos (Q=1), espejo del BiquadFilter "lowpass" de Web Audio. */
function lowpass2(buf: Float32Array, from: number, to: number, fc: number, sr: number): void {
  const w0 = (2 * Math.PI * fc) / sr, cw = Math.cos(w0), alpha = Math.sin(w0) / 2; // Q=1
  const a0 = 1 + alpha;
  biquad(buf, from, to, (1 - cw) / 2 / a0, (1 - cw) / a0, (1 - cw) / 2 / a0,
    (-2 * cw) / a0, (1 - alpha) / a0);
}

/** Paso-alto RBJ de 2 polos (Q=1), espejo del BiquadFilter "highpass" de Web Audio. */
function highpass1(buf: Float32Array, from: number, to: number, fc: number, sr: number): void {
  const w0 = (2 * Math.PI * fc) / sr, cw = Math.cos(w0), alpha = Math.sin(w0) / 2; // Q=1
  const a0 = 1 + alpha;
  biquad(buf, from, to, (1 + cw) / 2 / a0, -(1 + cw) / a0, (1 + cw) / 2 / a0,
    (-2 * cw) / a0, (1 - alpha) / a0);
}

export interface RenderOpts {
  sampleRate: number; // p.ej. 44100
}

/** Renderiza una lista de segmentos a PCM float32 mono (mismo encadenado que playSegs). */
export function renderSegs(segs: readonly SfxSeg[], opts: RenderOpts): Float32Array {
  const sr = opts.sampleRate;
  const totalS = segs.reduce((acc, s) => acc + Math.max(0.001, s.ms / 1000), 0);
  const n = Math.max(1, Math.ceil(totalS * sr));
  const out = new Float32Array(n);
  let t0 = 0;
  for (const seg of segs) {
    const dur = Math.max(0.001, seg.ms / 1000);
    renderOneSeg(seg, t0, dur, out, sr);
    t0 += dur;
  }
  return out;
}

/** Frecuencia instantánea de un segmento en el instante local `u` (0..dur). */
function segFreqAt(seg: SfxSeg, u: number, dur: number): number {
  if (seg.kind === "tone") {
    if (seg.f1 === seg.f0) return seg.f0;
    return seg.f0 + (seg.f1 - seg.f0) * (u / dur); // rampa lineal (linearRampToValueAtTime)
  }
  if (seg.kind !== "noise" || seg.freqs.length === 0) return 0;
  // ruido: conmuta en pasos iguales por la lista de freqs (setValueAtTime).
  const stepDur = dur / seg.freqs.length;
  const i = Math.min(seg.freqs.length - 1, Math.floor(u / stepDur));
  return seg.freqs[i]!;
}

/** Envolvente trapezoidal idéntica a scheduleSeg (borde EDGE_S tono / NOISE_EDGE_S ruido). */
function envAt(u: number, dur: number, edgeS: number): number {
  const edge = Math.min(edgeS, dur / 2);
  if (u < edge) return (PEAK_GAIN * u) / edge;
  if (u > dur - edge) return (PEAK_GAIN * (dur - u)) / edge;
  return PEAK_GAIN;
}

function renderOneSeg(seg: SfxSeg, t0: number, dur: number, out: Float32Array, sr: number): void {
  if (seg.kind === "silence") return; // hueco: deja los ceros
  const start = Math.floor(t0 * sr);
  const count = Math.max(1, Math.round(dur * sr));
  const isNoise = seg.kind === "noise";
  const edgeS = isNoise ? NOISE_EDGE_S : EDGE_S;
  let phase = 0; // fase acumulada para integrar la frecuencia variable
  const last = Math.min(out.length, start + count);
  for (let i = 0; i < count && start + i < out.length; i++) {
    const u = i / sr;
    const f = segFreqAt(seg, u, dur);
    phase += (2 * Math.PI * f) / sr;
    // onda CUADRADA (osc.type="square"); el RUIDO es UNIPOLAR (0/+1 = gate monopolo
    // del altavoz, WaveShaper [0,0,1] en el navegador), los tonos son bipolares (±1).
    const sq = Math.sin(phase) >= 0 ? 1 : isNoise ? 0 : -1;
    out[start + i] = sq * envAt(u, dur, edgeS);
  }
  // El ruido: acopla AC (paso-alto) y rolloff del cono (paso-bajo), en ese orden
  // (espejo de la cadena shaper→gain→highpass→lowpass de SpeakerSynth).
  if (isNoise) {
    highpass1(out, start, last, NOISE_HIGHPASS_HZ, sr);
    lowpass2(out, start, last, NOISE_LOWPASS_HZ, sr);
  }
}

/** Empaqueta PCM float32 [-1,1] mono como WAV PCM 16-bit. */
export function toWav(pcm: Float32Array, sampleRate: number): Buffer {
  const numSamples = pcm.length;
  const buf = Buffer.alloc(44 + numSamples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + numSamples * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}
