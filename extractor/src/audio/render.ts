/**
 * Render de música: XMI → MIDI (xmi2midi.ts) → WAV (fluidsynth) → OGG (ffmpeg).
 * Requiere `fluidsynth` y `ffmpeg` en PATH y el soundfont en extractor/vendor/.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { xmiToMidi } from "./xmi2midi.js";
import { TRACKS } from "./tracklist.js";

const SOUNDFONT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../vendor/GeneralUser-GS.sf2",
);

export function checkAudioToolchain(): string[] {
  const missing: string[] = [];
  for (const tool of ["fluidsynth", "ffmpeg"]) {
    try {
      execFileSync("which", [tool], { stdio: "pipe" });
    } catch {
      missing.push(tool);
    }
  }
  if (!existsSync(SOUNDFONT)) missing.push(`soundfont (${SOUNDFONT})`);
  return missing;
}

export function renderXmiToOgg(xmiPath: string, oggPath: string): void {
  const midis = xmiToMidi(new Uint8Array(readFileSync(xmiPath)));
  const midi = midis[0];
  if (!midi) throw new Error(`Sin canciones en ${xmiPath}`);
  const work = join(tmpdir(), `u5-audio-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const midPath = join(work, "song.mid");
  const wavPath = join(work, "song.wav");
  try {
    writeFileSync(midPath, midi);
    execFileSync(
      "fluidsynth",
      ["-ni", "-F", wavPath, "-r", "44100", SOUNDFONT, midPath],
      { stdio: "pipe" },
    );
    mkdirSync(dirname(oggPath), { recursive: true });
    execFileSync(
      "ffmpeg",
      ["-y", "-i", wavPath, "-c:a", "libvorbis", "-q:a", "5", oggPath],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Renderiza todas las pistas del tracklist a `outDir`. */
export function renderAllMusic(srcUpgradeDir: string, outDir: string): void {
  const missing = checkAudioToolchain();
  if (missing.length > 0) {
    throw new Error(
      `Toolchain de audio incompleto, falta: ${missing.join(", ")}. ` +
        `Instala con: brew install fluid-synth ffmpeg; soundfont: ver extractor/vendor/README`,
    );
  }
  for (const track of TRACKS) {
    const src = join(srcUpgradeDir, track.xmi);
    if (!existsSync(src)) {
      console.warn(`  ⚠ falta ${track.xmi}, se omite ${track.out}`);
      continue;
    }
    renderXmiToOgg(src, join(outDir, track.out));
    console.log(`  ♪ ${track.xmi} → ${track.out}`);
  }
}
