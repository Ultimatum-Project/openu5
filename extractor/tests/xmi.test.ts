import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { xmiToMidi } from "../src/audio/xmi2midi.js";
import { U5_DIR } from "./helpers.js";

const UPGRADE = `${U5_DIR}/upgrade`;

describe("xmiToMidi", () => {
  it("convierte todos los .XMI del parche comunitario a MIDI válido", () => {
    const xmis = readdirSync(UPGRADE).filter((f) => f.endsWith(".XMI"));
    expect(xmis.length).toBe(15);
    for (const name of xmis) {
      const midis = xmiToMidi(new Uint8Array(readFileSync(`${UPGRADE}/${name}`)));
      expect(midis.length, name).toBeGreaterThanOrEqual(1);
      for (const midi of midis) {
        // Header MThd + longitud 6 + formato 0
        expect(Array.from(midi.subarray(0, 4)), name).toEqual([0x4d, 0x54, 0x68, 0x64]);
        expect(midi.length, name).toBeGreaterThan(100);
      }
    }
  });

  it("U5THEME produce una canción con eventos de nota", () => {
    const [midi] = xmiToMidi(
      new Uint8Array(readFileSync(`${UPGRADE}/U5THEME.XMI`)),
    );
    // Busca al menos un Note On (0x9n con velocidad > 0) en el track
    let noteOns = 0;
    for (let i = 22; i < midi!.length - 2; i++) {
      if ((midi![i]! & 0xf0) === 0x90 && midi![i + 2]! > 0) noteOns++;
    }
    expect(noteOns).toBeGreaterThan(50);
  });
});
