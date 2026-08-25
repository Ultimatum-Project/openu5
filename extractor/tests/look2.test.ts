import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLook2 } from "../src/parsers/look2.js";
import { U5_DIR } from "./helpers.js";

const look2 = parseLook2(new Uint8Array(readFileSync(`${U5_DIR}/LOOK2.DAT`)));

describe("parseLook2 (LOOK2.DAT de Ultima V)", () => {
  it("cubre los 512 tiles del set", () => {
    expect(look2.length).toBe(512);
  });

  it("describe el terreno básico del overworld", () => {
    expect(look2[1]).toBe("deep water");
    expect(look2[2]).toBe("water");
    expect(look2[5]).toBe("grass");
    expect(look2[12]).toBe("mountains");
  });

  it("describe objetos-tile con su artículo ya incluido", () => {
    // Los slots-objeto del .NPC que el bug describía como "citizen": su tile de
    // atlas = type + 0x100. Chest type=1 → 257, corpse type=30 → 286, etc.
    expect(look2[257]).toBe("a chest"); // Chest
    expect(look2[286]).toBe("a corpse"); // DeadBody
    expect(look2[283]).toBe("an odd rug"); // Carpet2
    expect(look2[270]).toBe("a sandalwood box"); // ItemSandalwoodBox
  });

  it("describe a los NPC humanos por su tile de atlas", () => {
    expect(look2[368]).toBe("a guard"); // type 112
    expect(look2[344]).toBe("a jester"); // type 88
    expect(look2[340]).toBe("a merchant"); // type 84
    expect(look2[336]).toBe("a villager"); // type 80
  });

  it("los tiles sin descripción real llevan el marcador 'x' del original", () => {
    // Marcador literal del fichero para tiles sin frase (p.ej. 256).
    expect(look2[256]).toBe("x");
  });
});
