/**
 * Render a TRAIN of an ambient cue the way the game actually plays it: the cue is
 * re-fired once per BIOS tick (54.925 ms), with the persistent noise PRNG evolving
 * between bursts. This is the true port output to A/B against the real waterfall/
 * fountain captures (a single-shot render does not show the repetition texture).
 *
 *   tsx render-train.ts <cueId> <nTicks> <outWav>
 */
import { writeFileSync } from "node:fs";
import { renderCue } from "../../src/skin/fiel/speaker.js";
import type { SfxId } from "../../src/core/sfx.js";
import { renderSegs, toWav } from "./offline-speaker.js";

const SR = 44100;
const TICK_MS = 54.925;

const id = process.argv[2] as SfxId;
const nTicks = parseInt(process.argv[3] ?? "60", 10);
const out = process.argv[4] ?? "train.wav";

const tickSamples = Math.round((TICK_MS / 1000) * SR);
const total = new Float32Array(tickSamples * nTicks);
for (let k = 0; k < nTicks; k++) {
  const segs = renderCue({ id }); // PRNG state persists across calls (module-level)
  const pcm = renderSegs(segs, { sampleRate: SR });
  const at = k * tickSamples;
  for (let i = 0; i < pcm.length && at + i < total.length; i++) total[at + i] = pcm[i]!;
}
writeFileSync(out, toWav(total, SR));
console.log(`${id} x${nTicks} @ ${TICK_MS}ms -> ${out} (${(total.length / SR).toFixed(2)}s)`);
