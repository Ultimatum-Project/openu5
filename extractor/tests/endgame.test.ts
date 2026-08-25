import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseEndgameScene,
  parseEndgameArts,
  SCENE_SEEK,
  SCENE_LEN,
} from "../src/parsers/endgame-scene.js";
import {
  parseEndgameNarration,
  parseEndgameDialogue,
  NARRATION_SEEKS,
} from "../src/parsers/endgame-msg.js";
import { U5_DIR } from "./helpers.js";

const read = (name: string) => new Uint8Array(readFileSync(`${U5_DIR}/${name}`));

/**
 * Datos de la secuencia final de Ultima V (task #20). Valores derivados+citados en
 * .superpowers/sdd/brief-endgame.md + re/notes/endgame.md; verificados contra los
 * bytes reales de MISCMAPS.DAT / END.DAT / ENDMSG.DAT.
 */
describe("parseEndgameScene (MISCMAPS.DAT[528:704] — sala 11×11)", () => {
  const scene = parseEndgameScene(read("MISCMAPS.DAT"));

  it("seek/len/dimensiones = valores del asm (ENDGAME 0x066b)", () => {
    expect(SCENE_SEEK).toBe(528);
    expect(SCENE_LEN).toBe(176);
    expect(scene.tiles.length).toBe(11);
    expect(scene.tiles.every((r) => r.length === 11)).toBe(true);
  });

  it("la primera fila es borde de muro 0x4d con esquinas transparentes 0xff", () => {
    // 528: ff ff 4d 4d 4d 4d 4d 4d 4d ff ff
    expect(scene.tiles[0]).toEqual([0xff, 0xff, 0x4d, 0x4d, 0x4d, 0x4d, 0x4d, 0x4d, 0x4d, 0xff, 0xff]);
  });

  it("el interior tiene suelo 0x44 y mobiliario derivado (cama, espejo, estantería)", () => {
    const flat = scene.tiles.flat();
    expect(flat).toContain(0x44); // suelo
    expect(flat).toContain(0x9d); // espejo
    expect(flat).toContain(0xab); // cama
    expect(flat).toContain(0xac);
    expect(flat).toContain(0x5c); // estantería
    expect(flat).toContain(0x5d);
    expect(flat).toContain(0xbf); // cocina/estufa
  });

  it("descarta el relleno 0x00 del stride (cols 11-15) — sin ceros en la rejilla útil", () => {
    // El interior nunca es tile 0 (todo es muro/suelo/mobiliario); el 0x00 era relleno.
    expect(scene.tiles.flat().every((t) => t !== 0)).toBe(true);
  });
});

describe("parseEndgameArts (END1/END2/ENDSC.16 — láminas EGA de las pantallas de historia, GAP 6)", () => {
  const arts = parseEndgameArts(read);

  it("END1.16 = 3 sub-imágenes (casa del Avatar) con las dims del fichero", () => {
    const end1 = arts.find((a) => a.name === "end1")!;
    expect(end1.images.length).toBe(3);
    expect(end1.images.map((im) => [im.width, im.height])).toEqual([
      [167, 124],
      [191, 90],
      [192, 95],
    ]);
  });

  it("END2.16 = 3 sub-imágenes (The Dream / trono de Blackthorn)", () => {
    const end2 = arts.find((a) => a.name === "end2")!;
    expect(end2.images.length).toBe(3);
    expect(end2.images.map((im) => [im.width, im.height])).toEqual([
      [173, 98],
      [157, 90],
      [153, 110],
    ]);
  });

  it("ENDSC.16 = 1 lámina grande (fondo del pergamino) 260×168", () => {
    const endsc = arts.find((a) => a.name === "endsc")!;
    expect(endsc.images.length).toBe(1);
    expect([endsc.images[0]!.width, endsc.images[0]!.height]).toEqual([260, 168]);
  });

  it("todas las láminas son EGA válido (índices 0-15) y caben en pantalla (≤320×200)", () => {
    expect(arts.map((a) => a.name)).toEqual(["end1", "end2", "endsc"]);
    for (const a of arts) {
      for (const im of a.images) {
        expect(im.width).toBeGreaterThan(0);
        expect(im.width).toBeLessThanOrEqual(320);
        expect(im.height).toBeLessThanOrEqual(200);
        expect(im.pixels.length).toBe(im.width * im.height);
        expect(im.pixels.every((p) => p >= 0 && p <= 15)).toBe(true);
      }
    }
  });
});

describe("parseEndgameNarration (END.DAT — 6 páginas de epílogo)", () => {
  const nar = parseEndgameNarration(read("END.DAT"));

  it("6 páginas, con los seeks del asm (tabla DGROUP 0x3dca)", () => {
    expect(nar.pages.length).toBe(6);
    expect(nar.seeks).toEqual([...NARRATION_SEEKS]);
    expect(nar.seeks).toEqual([0, 424, 956, 1530, 2280, 2932]);
  });

  it("página 0 = el regreso al círculo de piedras y la casa desierta", () => {
    expect(nar.pages[0]).toContain("wooded path");
    expect(nar.pages[0]).toContain("circle of stones");
    expect(nar.pages[0]).toContain("long-deserted house");
  });

  it("página 1 = el famoso 'TV, stereo y muebles desaparecidos'", () => {
    expect(nar.pages[1]).toContain("TV set, stereo, and living-room furniture");
    expect(nar.pages[1]).toContain("Quest of the Avatar is not yet at an end");
  });

  it("páginas 3-5 = la sala del trono de Blackthorn y su destierro por el gate rojo", () => {
    expect(nar.pages[3]).toContain("throne room of Blackthorn's palace");
    expect(nar.pages[4]).toContain("I offer thee a choice");
    expect(nar.pages[5]).toContain("Orb of the Moons");
    expect(nar.pages[5]).toContain("Blackthorn steps through the gate and is gone");
  });

  it("limpia los guiones discrecionales '_' (une sílabas: 'weather', no 'weath_er')", () => {
    expect(nar.pages.join("\n")).not.toContain("_");
    expect(nar.pages[0]).toContain("weather");
  });
});

describe("parseEndgameDialogue (ENDMSG.DAT — diálogo del trono + fork)", () => {
  const dlg = parseEndgameDialogue(read("ENDMSG.DAT"));

  it("11 registros no vacíos (12 fragmentos NUL menos la cola)", () => {
    expect(dlg.records.length).toBe(11);
  });

  it("abre con Lord British y la pregunta de la caja", () => {
    expect(dlg.records[0]).toContain("Lord British says:");
    expect(dlg.records[0]).toContain("Well met,");
    expect(dlg.records[1]).toContain("Didst thou bring my box?");
  });

  it("rama de la caja (final bueno): el Orb of the Moons y 'Our worlds await!'", () => {
    const box = dlg.records.join("\n");
    expect(box).toContain("Lord British carefully opens the box");
    expect(box).toContain("the power of the Orb of the Moons");
    expect(box).toContain("Our worlds await!");
  });

  it("final alternativo (sin caja): 'pull up a chair … we shall be here a while'", () => {
    const last = dlg.records[dlg.records.length - 1]!;
    expect(last).toContain("pull up a chair");
    expect(last).toContain("We shall be here a while");
  });

  it("conserva el '\\n' del formato de diálogo (no lo colapsa como la narración)", () => {
    expect(dlg.records[0]).toContain("\n");
  });
});
