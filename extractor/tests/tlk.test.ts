import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { U5_DIR } from "./helpers.js";
import {
  extractCompressedWords,
  parseTlkFile,
  parseTlkFileWithStats,
  type ScriptLine,
  type TalkScript,
} from "../src/parsers/tlk.js";

const readData = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(U5_DIR, name)));

const compressedWords = extractCompressedWords(readData("DATA.OVL"));

const TLK_FILES = ["TOWNE.TLK", "CASTLE.TLK", "KEEP.TLK", "DWELLING.TLK"] as const;

/** Concatena sólo los items de texto de una línea (para aserciones legibles). */
function lineText(line: ScriptLine): string {
  return line
    .filter((it): it is { kind: "text"; text: string } => it.kind === "text")
    .map((it) => it.text)
    .join("")
    .trim();
}

function scriptName(s: TalkScript): string {
  return lineText(s.name);
}

/** Todo el texto plano de un script (líneas fijas + respuestas). */
function allText(s: TalkScript): string {
  const lines: ScriptLine[] = [
    s.name,
    s.description,
    s.greeting,
    s.job,
    s.bye,
    ...s.qa.flatMap((q) => q.answer),
    ...s.labels.flatMap((l) => [
      l.initialLine,
      ...l.defaultAnswers,
      ...l.qa.flatMap((q) => q.answer),
    ]),
  ];
  return lines.map(lineText).join(" ");
}

describe("extractCompressedWords", () => {
  it("devuelve el diccionario de palabras comprimidas del TLK", () => {
    // 118 palabras en la base MS-DOS de U5. Primeras 5: the, thou, of, to, and.
    expect(compressedWords.length).toBe(118);
    expect(compressedWords.length).toBeGreaterThan(100);
    expect(compressedWords.slice(0, 5)).toEqual(["the", "thou", "of", "to", "and"]);
  });
});

describe("parseTlkFile", () => {
  // Nº real de scripts por fichero (contrastados con los datos originales).
  const EXPECTED_SCRIPTS: Record<(typeof TLK_FILES)[number], number> = {
    "TOWNE.TLK": 48,
    "CASTLE.TLK": 40,
    "KEEP.TLK": 32,
    "DWELLING.TLK": 15,
  };

  it("los 4 ficheros parsean sin lanzar y con scripts > 0", () => {
    for (const f of TLK_FILES) {
      const scripts = parseTlkFile(readData(f), compressedWords);
      expect(scripts.length).toBe(EXPECTED_SCRIPTS[f]);
      expect(scripts.length).toBeGreaterThan(0);
    }
  });

  it("todo script tiene las 5 líneas fijas y un name no vacío", () => {
    for (const f of TLK_FILES) {
      const scripts = parseTlkFile(readData(f), compressedWords);
      for (const s of scripts) {
        expect(Array.isArray(s.name)).toBe(true);
        expect(Array.isArray(s.description)).toBe(true);
        expect(Array.isArray(s.greeting)).toBe(true);
        expect(Array.isArray(s.job)).toBe(true);
        expect(Array.isArray(s.bye)).toBe(true);
        expect(scriptName(s).length).toBeGreaterThan(0);
      }
    }
  });

  it("el total de opcodes Unknown es < 1% de los items (2 de 14717 = 0.014%)", () => {
    let unknown = 0;
    let items = 0;
    for (const f of TLK_FILES) {
      const res = parseTlkFileWithStats(readData(f), compressedWords);
      unknown += res.unknownOps;
      items += res.totalItems;
    }
    // Valores reales observados: 2 Unknown (en Annon y Gruman de TOWNE) sobre 14717 items.
    expect(unknown).toBe(2);
    expect(items).toBe(14717);
    expect(unknown / items).toBeLessThan(0.01);
  });

  it("Thrud (mercenario de Serpent's Hold) está en KEEP.TLK con su Q&A", () => {
    // NOTA / DESVIACIÓN respecto a la pista de la tarea: Thrud NO está en TOWNE.TLK
    // sino en KEEP.TLK (Serpent's Hold es un "keep"), que es lo canónicamente
    // correcto. Tampoco tiene la keyword "dawn" (ver test siguiente).
    const scripts = parseTlkFile(readData("KEEP.TLK"), compressedWords);
    const thrud = scripts.find((s) => scriptName(s) === "Thrud");
    expect(thrud).toBeDefined();
    expect(lineText(thrud!.job)).toContain("infamous mercenary");
    const keywords = thrud!.qa.flatMap((q) => q.keywords);
    expect(keywords).toContain("infa");
  });

  it("la keyword 'dawn' existe en CASTLE.TLK (guardias del castillo)", () => {
    // La keyword "dawn" pertenece a los NPCs del castillo de Lord British
    // (Thentis, Joshua, Leof, Vigil), no a Thrud.
    const scripts = parseTlkFile(readData("CASTLE.TLK"), compressedWords);
    const withDawn = scripts.filter((s) =>
      s.qa.some((q) => q.keywords.some((k) => k.toLowerCase() === "dawn")),
    );
    expect(withDawn.length).toBeGreaterThan(0);
    expect(withDawn.map(scriptName)).toContain("Thentis");
  });

  it("Goeth está en TOWNE.TLK y habla con palabras invertidas", () => {
    const scripts = parseTlkFile(readData("TOWNE.TLK"), compressedWords);
    const goeth = scripts.find((s) => scriptName(s) === "Goeth");
    expect(goeth).toBeDefined();
    expect(goeth!.npcIndex).toBe(15);
    // job real: "Looking rof something, I am." — "rof" = "for" al revés.
    const text = allText(goeth!);
    expect(text).toContain("rof");
    expect(text.toLowerCase()).toContain("tsol"); // "lost" invertido
  });

  it("un greeting conocido es texto inglés legible (Zachariah, TOWNE)", () => {
    const scripts = parseTlkFile(readData("TOWNE.TLK"), compressedWords);
    const zachariah = scripts.find((s) => scriptName(s) === "Zachariah");
    expect(zachariah).toBeDefined();
    // Greeting real: "Welcome, <AvatarsName>, in these dark times."
    const greeting = lineText(zachariah!.greeting);
    expect(greeting).toContain("Welcome");
    expect(greeting).toContain("dark times");
    // El nombre del Avatar se inserta vía opcode, no como texto basura.
    expect(zachariah!.greeting.some((it) => it.kind === "op" && it.op === "AvatarsName")).toBe(true);
  });

  it("Gold captura la cantidad y Change el item como data numérica", () => {
    // Barrido general: cualquier op Gold debe tener data numérica de 3 dígitos
    // y cualquier Change debe tener data (byte de item).
    let goldSeen = 0;
    let changeSeen = 0;
    for (const f of TLK_FILES) {
      const scripts = parseTlkFile(readData(f), compressedWords);
      for (const s of scripts) {
        const allLines: ScriptLine[] = [
          s.name,
          s.description,
          s.greeting,
          s.job,
          s.bye,
          ...s.qa.flatMap((q) => q.answer),
          ...s.labels.flatMap((l) => [
            l.initialLine,
            ...l.defaultAnswers,
            ...l.qa.flatMap((q) => q.answer),
          ]),
        ];
        for (const line of allLines) {
          for (const it of line) {
            if (it.kind === "op" && it.op === "Gold") {
              goldSeen++;
              expect(typeof it.data).toBe("number");
            }
            if (it.kind === "op" && it.op === "Change") {
              changeSeen++;
              expect(typeof it.data).toBe("number");
            }
          }
        }
      }
    }
    // Debe existir al menos un Gold en los datos (NPCs que dan oro a caridad).
    expect(goldSeen).toBeGreaterThan(0);
  });
});
