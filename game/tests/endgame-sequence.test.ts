/**
 * H1 del carril endgame-visual: el EMISOR de `endgameSequence` (core).
 *
 * Calca el patrón RefugeScript (game.ts buildRefugeScript): el core emite un GUIÓN PURO
 * de beats ORDENADOS por FASE; la piel los pacea (modal, tecla por beat) y difiere la
 * mutación terminal. Las fases mapean 1:1 a las piezas derivadas del disasm:
 *   greenScene=GAP2, dialogue=GAP3, orbMoongate=GAP4, dissolve=GAP5, story*=GAP6,
 *   scroll=GAP7, terminal*=GAP9. El fork victoria/stranded lo decide la caja (woodenBox)
 *   como el binario (ENDGAME 0x08b9/0x08c2); llega ya resuelto en `ending`.
 *
 * H1b: la fase `dialogue` se expande en un beat por PÁGINA de ENDMSG.DAT (inyectadas como
 * datos; byte-exacto → choke i18n de la piel), con el fork por rama (guion table GAP 3):
 *   beats 1-2 siempre (records 0,1); rama Yes/victoria = records 3-9; rama No/stranded =
 *   record 2 (2ª pregunta) → record 10 (terminal «pull up a chair»). La auto-respuesta
 *   Yes/No (DATA.OVL DS 0x84b4/0x84ba) va en `beat.reply` para que la piel la localice.
 */
import { describe, it, expect } from "vitest";
import { buildEndgameScript, type EndgamePhase, type EndgameText } from "../src/core/endgame/sequence.js";

/** Datos sintéticos para probar la ESTRUCTURA sin acoplar al texto real: 11 diálogos + 6 páginas. */
const TEXT: EndgameText = {
  dialogue: Array.from({ length: 11 }, (_, i) => `rec${i}`),
  narration: Array.from({ length: 6 }, (_, i) => `page${i}`),
};

const dialogueMessages = (ending: "victory" | "stranded") =>
  buildEndgameScript(ending, TEXT)
    .beats.filter((b) => b.phase === "dialogue")
    .map((b) => b.message);

describe("buildEndgameScript — espina de fases (H1)", () => {
  it("victoria (con caja): recorre TODAS las fases en orden, termina en freeze", () => {
    const script = buildEndgameScript("victory", TEXT);
    expect(script.ending).toBe("victory");
    const phases = script.beats.map((b) => b.phase);
    const firstOf = (p: EndgamePhase) => phases.indexOf(p);
    const order: EndgamePhase[] = [
      "greenScene",
      "dialogue",
      "orbMoongate",
      "dissolve",
      "storyHouse",
      "storyDream",
      "scroll",
      "terminalFreeze",
    ];
    for (const p of order) expect(firstOf(p), `falta fase ${p}`).toBeGreaterThanOrEqual(0);
    const firsts = order.map(firstOf);
    expect(firsts, "las fases no están en orden canónico").toEqual([...firsts].sort((a, b) => a - b));
    expect(phases[phases.length - 1]).toBe("terminalFreeze");
  });

  it("stranded (sin caja): green + diálogo + prisión jugable; SIN moongate/dissolve/story/scroll", () => {
    const script = buildEndgameScript("stranded", TEXT);
    expect(script.ending).toBe("stranded");
    const phases = new Set(script.beats.map((b) => b.phase));
    expect(phases.has("greenScene")).toBe(true);
    expect(phases.has("dialogue")).toBe(true);
    expect(phases.has("terminalPrison")).toBe(true);
    for (const p of ["orbMoongate", "dissolve", "storyHouse", "storyDream", "scroll", "terminalFreeze"] as const) {
      expect(phases.has(p), `stranded no debe tener ${p}`).toBe(false);
    }
    expect(script.beats[script.beats.length - 1]!.phase).toBe("terminalPrison");
  });

  it("todo beat declara su fase; los delays son no-negativos", () => {
    for (const ending of ["victory", "stranded"] as const) {
      for (const beat of buildEndgameScript(ending, TEXT).beats) {
        expect(beat.phase).toBeTruthy();
        if (beat.delayUnits !== undefined) expect(beat.delayUnits).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("buildEndgameScript — expansión del diálogo por rama (H1b, guion GAP 3)", () => {
  it("victoria: páginas 1-2 + rama Yes (records 0,1,3,4,5,6,7,8,9), SIN el record 2/10 de la rama No", () => {
    expect(dialogueMessages("victory")).toEqual([
      "rec0",
      "rec1",
      "rec3",
      // F2-T8: entre opens-the-box (rec 3) y An-artifact (rec 4) va la string
      // ESTÁTICA DS 0x84cc (ENDGAME.OVL 0x0925, beep 0x28 + paceo) — P24:1647.
      "\n\nHe says:\n\n",
      "rec4",
      "rec5",
      "rec6",
      "rec7",
      "rec8",
      "rec9",
    ]);
  });

  it("stranded: páginas 1-2 + 2ª pregunta (record 2) + terminal (record 10), SIN la rama Yes", () => {
    expect(dialogueMessages("stranded")).toEqual(["rec0", "rec1", "rec2", "rec10"]);
  });

  it("la auto-respuesta Yes/No va en beat.reply del beat «You reply:», localizable por la piel", () => {
    const vic = buildEndgameScript("victory", TEXT).beats.filter((b) => b.phase === "dialogue");
    const str = buildEndgameScript("stranded", TEXT).beats.filter((b) => b.phase === "dialogue");
    expect(vic[1]).toMatchObject({ message: "rec1", reply: "Yes" });
    // En stranded, tanto la 1ª (record 1) como la 2ª pregunta (record 2) auto-responden No.
    expect(str[1]).toMatchObject({ message: "rec1", reply: "No" });
    expect(str[2]).toMatchObject({ message: "rec2", reply: "No" });
  });
});

describe("buildEndgameScript — pantallas de historia por página END.DAT (H1c, GAP 6)", () => {
  const story = (phase: "storyHouse" | "storyDream") =>
    buildEndgameScript("victory", TEXT)
      .beats.filter((b) => b.phase === phase)
      .map((b) => b.message);

  it("storyHouse (END1.16) = páginas 0-1 (círculo/casa desierta + «TV, stereo… no yet at an end»)", () => {
    expect(story("storyHouse")).toEqual(["page0", "page1"]);
  });

  it("storyDream (END2.16) = páginas 2-5 (dormir → sueño → trono de Blackthorn → gate rojo)", () => {
    expect(story("storyDream")).toEqual(["page2", "page3", "page4", "page5"]);
  });

  it("stranded NO tiene pantallas de historia (ni páginas de narración)", () => {
    const strandedNarration = buildEndgameScript("stranded", TEXT).beats.filter(
      (b) => b.phase === "storyHouse" || b.phase === "storyDream",
    );
    expect(strandedNarration).toHaveLength(0);
  });
});
