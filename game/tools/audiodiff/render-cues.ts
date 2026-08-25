/**
 * Renderiza CADA cue del catálogo del port a un WAV + emite una tabla de
 * métricas (duración ms, rango de frecuencias por segmento). Es el LADO PORT del
 * audio-diff: lo que el comparador contrasta contra el ground-truth del original.
 *
 *   npx tsx game/tools/audiodiff/render-cues.ts [outDir]
 *
 * Salida: <outDir>/<cue>.wav por cada SfxId + <outDir>/port-metrics.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SFX_CATALOG, renderCue } from "../../src/skin/fiel/speaker.js";
import type { SfxId } from "../../src/core/sfx.js";
import { renderSegs, toWav } from "./offline-speaker.js";

const SR = 44100;

interface SegMetric { kind: string; f0: number; f1: number; ms: number; }
interface CueMetric {
  id: string; totalMs: number; nSegs: number; segs: SegMetric[];
  fMin: number; fMax: number;
}

function metricsFor(id: SfxId): CueMetric {
  const segs = renderCue({ id });
  let fMin = Infinity, fMax = 0, totalMs = 0;
  const sm: SegMetric[] = segs.map((s) => {
    let f0 = 0, f1 = 0;
    if (s.kind === "tone") { f0 = s.f0; f1 = s.f1; }
    else if (s.kind === "noise") { f0 = Math.min(...s.freqs); f1 = Math.max(...s.freqs); }
    if (s.kind !== "silence") { fMin = Math.min(fMin, f0, f1); fMax = Math.max(fMax, f0, f1); }
    totalMs += s.ms;
    return { kind: s.kind, f0: Math.round(f0), f1: Math.round(f1), ms: +s.ms.toFixed(3) };
  });
  return { id, totalMs: +totalMs.toFixed(2), nSegs: segs.length, segs: sm,
    fMin: Number.isFinite(fMin) ? Math.round(fMin) : 0, fMax: Math.round(fMax) };
}

function main() {
  const outDir = process.argv[2] ?? join(HERE(), "out");
  mkdirSync(outDir, { recursive: true });
  const ids = Object.keys(SFX_CATALOG) as SfxId[];
  const metrics: CueMetric[] = [];
  for (const id of ids) {
    const segs = renderCue({ id });
    const pcm = renderSegs(segs, { sampleRate: SR });
    writeFileSync(join(outDir, `${id}.wav`), toWav(pcm, SR));
    metrics.push(metricsFor(id));
  }
  writeFileSync(join(outDir, "port-metrics.json"),
    JSON.stringify({ sampleRate: SR, cues: metrics }, null, 2));
  // Tabla legible a stdout.
  console.log("cue".padEnd(24), "ms".padStart(9), "segs".padStart(5),
    "fMin".padStart(7), "fMax".padStart(7));
  for (const m of metrics) {
    console.log(m.id.padEnd(24), String(m.totalMs).padStart(9),
      String(m.nSegs).padStart(5), String(m.fMin).padStart(7),
      String(m.fMax).padStart(7));
  }
  console.log(`\n${ids.length} cues -> ${outDir}`);
}

function HERE(): string {
  return new URL(".", import.meta.url).pathname;
}

main();
