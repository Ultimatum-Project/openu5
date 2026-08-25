/**
 * GUARDA DE COMPLETITUD del editor de save del menú debug.
 *
 * El editor debe poder tocar TODO lo que el save persiste. El universo de campos = las
 * claves de la interfaz `GameState` (el códec saveNative.ts lee/escribe sobre ella). Este
 * test EXTRAE esas claves del CÓDIGO FUENTE (`state.ts`) — no de un estado runtime, cuyos
 * campos OPCIONALES estarían ausentes y harían la guarda vacua — y exige que cada una esté
 * clasificada: o CUBIERTA por el editor (COVERED_STATE_KEYS) o EXCLUIDA con razón
 * documentada (EXCLUDED_STATE_KEYS). Un campo nuevo en GameState sin clasificar → test
 * ROJO, forzando la decisión «¿sección nueva o allowlist?». Bidireccional: una clave
 * clasificada que ya no exista en GameState (typo/borrado) también rompe.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  COVERED_STATE_KEYS,
  EXCLUDED_STATE_KEYS,
  STORY_FLAG_FAMILIES,
} from "../src/debug/saveEditorSections.js";

/** Extrae las claves de nivel superior de la interfaz GameState del fuente state.ts. */
function gameStateKeys(): string[] {
  const src = readFileSync(fileURLToPath(new URL("../src/core/state.ts", import.meta.url)), "utf8");
  const start = src.indexOf("export interface GameState {");
  if (start < 0) throw new Error("no se encontró la interfaz GameState en state.ts");
  const body = src.slice(start, src.indexOf("\n}", start));
  // Campos con indentación de EXACTAMENTE 2 espacios (los anidados van a 4 → se excluyen).
  return [...body.matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]!);
}

describe("Editor de save — guarda de completitud de campos", () => {
  const keys = gameStateKeys();

  it("extrae un conjunto no trivial de claves de GameState", () => {
    expect(keys.length).toBeGreaterThan(40); // ~63 hoy; sanity de que el parseo funcionó
    expect(keys).toContain("characters");
    expect(keys).toContain("questFlags");
    expect(keys).toContain("dungeonRoomsCleared");
  });

  it("TODA clave de GameState está CUBIERTA o EXCLUIDA (campo nuevo sin clasificar → rojo)", () => {
    const classified = new Set<string>([...COVERED_STATE_KEYS, ...EXCLUDED_STATE_KEYS.keys()]);
    const unclassified = keys.filter((k) => !classified.has(k));
    expect(unclassified, `campos de GameState sin clasificar en el editor: ${unclassified.join(", ")}`).toEqual([]);
  });

  it("ninguna clave clasificada es fantasma (existe en GameState) ni está en ambos conjuntos", () => {
    const gsKeys = new Set(keys);
    for (const k of COVERED_STATE_KEYS) {
      expect(gsKeys.has(k), `COVERED contiene una clave inexistente en GameState: ${k}`).toBe(true);
      expect(EXCLUDED_STATE_KEYS.has(k), `clave en COVERED y EXCLUDED a la vez: ${k}`).toBe(false);
    }
    for (const k of EXCLUDED_STATE_KEYS.keys()) {
      expect(gsKeys.has(k), `EXCLUDED contiene una clave inexistente en GameState: ${k}`).toBe(true);
    }
  });

  it("cada exclusión lleva una razón documentada no vacía", () => {
    for (const [k, reason] of EXCLUDED_STATE_KEYS) {
      expect(reason.length, `exclusión sin razón: ${k}`).toBeGreaterThan(3);
    }
  });

  it("las familias de flag de HISTORIA están enumeradas (word-spoken×8, shadowlord-dead×3, singletons)", () => {
    expect(STORY_FLAG_FAMILIES.wordSpoken).toHaveLength(8); // mazmorras 33..40
    expect(STORY_FLAG_FAMILIES.wordSpoken).toContain("word-spoken:33");
    expect(STORY_FLAG_FAMILIES.wordSpoken).toContain("word-spoken:40");
    expect(STORY_FLAG_FAMILIES.shadowlordDead).toEqual([
      "shadowlord-dead:falsehood",
      "shadowlord-dead:hatred",
      "shadowlord-dead:cowardice",
    ]);
    expect(STORY_FLAG_FAMILIES.singletons).toEqual(["in-doom", "game-won"]);
  });
});
