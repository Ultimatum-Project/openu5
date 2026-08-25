/**
 * #364-c — FUENTE RÚNICA A MITAD DE FILA: modelo de consola POR-TRAMO (`segments`).
 *
 * El binario conmuta text_set_font (kernel 0x1c9e) ENTRE caracteres de la misma fila
 * en TRES clases de consola (censo re/notes/consola-fuente-por-tramo-364c.md):
 *   1. ALAKAZAM de la donación — CAST2 0x0ba1/0x0baf: set_font(1)·"ALAKAZAM"(DS 0x95aa)·
 *      set_font(0)·"!\n"(DS 0x95b4).
 *   2. Scroll pickup — SJOG 0x15e7/0x15fd: "A scroll: "(0x8ce0) + nombre rúnico
 *      0x41ac[(qty)&7] en font 1 + "!\n"(0x8cec).
 *   3. Habla rúnica de TALK — 0x4fc-0x55e: fuente decidida POR CARÁCTER con el bit 7
 *      (el port la partía en TRES filas con un flushLine() por toggle).
 *
 * El modelo por-FILA (`ConsoleLine.rune`) no podía representar ninguna: este fichero
 * fija el modelo por-TRAMO de punta a punta (printer → coreview → productores) y las
 * REGRESIONES: las filas homogéneas rinden BYTE-IGUAL que el modelo por-fila anterior
 * (mismas `ConsoleLine` exactas, mismos planos cells/cellRune — los planos SON la
 * entrada íntegra del blit fiel `blitConsoleWindow`, que elige fuente por celda).
 *
 * Esperados EN CRUDO: los textos de TALK salen de game/assets/talk/towne.json
 * (Malifora, qa "mant") tal como están en el asset; los del scroll, de la tabla
 * SCROLL_CODES (DS 0x41AC verbatim); el ALAKAZAM, de DS 0x95aa/0x95b4.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { describeSiViaja } from "./assets-opcionales.js";
import { TextWindow, type WindowRect } from "../src/skin/fiel/textwindow.js";
import {
  consoleLinesToRows,
  layoutConsole,
  withTurnSeparatorsRich,
} from "../src/skin/fiel/console.js";
import { CoreViewImpl } from "../src/skin/coreview.js";
import type { ConsoleLine, ConsoleSegment } from "../src/skin/api.js";
import { lootItemName, lootItemSegments } from "../src/core/world/commands.js";
import { Conversation, type TalkScript, type DialogueOutput } from "../src/core/dialogue/conversation.js";
import type { Game } from "../src/core/game.js";

const RECT: WindowRect = { leftCol: 0, topRow: 0, rightCol: 15, botRow: 3 }; // 16×4 (consola fiel)

/** Fila `r` de la rejilla como string (trim derecha de blancos). */
function rowText(win: TextWindow, r: number): string {
  let s = "";
  for (let c = 0; c < win.cols; c++) s += String.fromCharCode(win.cells[r * win.cols + c]!);
  return s.replace(/ +$/, "");
}

/** Flags rúnicos de la fila `r` recortados al largo de su texto. */
function rowRunes(win: TextWindow, r: number, len: number): number[] {
  return Array.from(win.cellRune.slice(r * win.cols, r * win.cols + len));
}

// ─────────────────────────────────────────────────────────────────────────────
// A · printStringSegments — la variante por-carácter del printer (careo T6)
// ─────────────────────────────────────────────────────────────────────────────

describe("#364-c A · TextWindow.printStringSegments (flags por carácter)", () => {
  it("fila mixta ALAKAZAM+!: una fila, fuente por celda (CAST2 0xba5/0xbb2)", () => {
    const win = new TextWindow(RECT);
    win.printStringSegments([
      { text: "ALAKAZAM", rune: true },
      { text: "!", rune: false },
    ]);
    expect(rowText(win, 0)).toBe("ALAKAZAM!");
    // 8 celdas rúnicas + el "!" latino EN LA MISMA FILA (el cabo era que caía a otra).
    expect(rowRunes(win, 0, 9)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0]);
    expect(win.curRow).toBe(0); // no bajó de fila
  });

  it("REGRESIÓN: tramos homogéneos ≡ printString con runeMode por línea (byte-igual)", () => {
    for (const rune of [true, false]) {
      const legacy = new TextWindow(RECT);
      legacy.runeMode = rune;
      legacy.printString("Very long prophecy words");
      const seg = new TextWindow(RECT);
      seg.printStringSegments([{ text: "Very long prophecy words", rune }]);
      expect(Array.from(seg.cells)).toEqual(Array.from(legacy.cells));
      expect(Array.from(seg.cellRune)).toEqual(Array.from(legacy.cellRune));
      expect([seg.curRow, seg.curCol]).toEqual([legacy.curRow, legacy.curCol]);
    }
  });

  it("T6: fila EXACTA de 16 + espacio consumido no desalinea los flags del tramo rúnico", () => {
    // "AAAAAAAAAAAAAAAA" llena la fila (capacidad = wrapWidth+1 = 16, cota inclusive
    // 0x18dc); el espacio siguiente lo CONSUME el kernel (0x19bc) sin emitir glifo.
    // El índice de flags avanza CON el delimitador consumido: las "BB" rúnicas caen
    // en la fila 1 con SUS flags, no con los del espacio saltado.
    const win = new TextWindow(RECT);
    win.printStringSegments([
      { text: "AAAAAAAAAAAAAAAA ", rune: false },
      { text: "BB", rune: true },
    ]);
    expect(rowText(win, 0)).toBe("AAAAAAAAAAAAAAAA");
    expect(rowRunes(win, 0, 16)).toEqual(new Array(16).fill(0));
    expect(rowText(win, 1)).toBe("BB");
    expect(rowRunes(win, 1, 2)).toEqual([1, 1]);
    expect(win.curRow).toBe(1); // sin fila en blanco intercalada (careo T6)
  });

  it("word-wrap indiferente a la fuente: la palabra rúnica salta ENTERA como una latina", () => {
    // "chanting " (9) + "FALLAX" (6 runas) = 15 → cabe; con "chanting lo" + FALLAX
    // no cabría y saltaría entera — misma métrica en ambos casos (8 px monoespaciados).
    const win = new TextWindow(RECT);
    win.printStringSegments([
      { text: "he chanted ", rune: false }, // 11 celdas
      { text: "FALLAX", rune: true }, // 6 → 17 > 16: la palabra salta entera
    ]);
    expect(rowText(win, 0)).toBe("he chanted");
    expect(rowText(win, 1)).toBe("FALLAX");
    expect(rowRunes(win, 1, 6)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("el espacio DENTRO del tramo rúnico marca su celda rúnica (bit 7 del binario)", () => {
    const win = new TextWindow(RECT);
    win.printStringSegments([
      { text: "x ", rune: false },
      { text: "AHM ", rune: true },
      { text: "!", rune: false },
    ]);
    expect(rowText(win, 0)).toBe("x AHM !");
    //                          x  ␣  A  H  M  ␣  !
    expect(rowRunes(win, 0, 7)).toEqual([0, 0, 1, 1, 1, 1, 0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B · CoreViewImpl.pushConsoleSegments — el modelo (aritmética #108 intacta)
// ─────────────────────────────────────────────────────────────────────────────

/** CoreView de consola pura (el constructor tolera Games-mock parciales). */
function makeView(): { view: CoreViewImpl; lines: () => ConsoleLine[] } {
  const view = new CoreViewImpl({} as unknown as Game);
  let captured: ConsoleLine[] = [];
  view.subscribe({ onConsole: (l) => (captured = l as ConsoleLine[]) });
  return { view, lines: () => captured };
}

describe("#364-c B · pushConsoleSegments (modelo por-tramo)", () => {
  it("REGRESIÓN forma exacta: homogéneo latino = {text,kind}; homogéneo rúnico = {text,kind,rune}", () => {
    const a = makeView();
    a.view.pushConsoleSegments([{ text: "Pass\n", rune: false }]);
    expect(a.lines()).toEqual([{ text: "Pass", kind: "message" }]); // sin campos extra

    const b = makeView();
    b.view.pushConsoleSegments([{ text: "VILIS\n", rune: true }]);
    expect(b.lines()).toEqual([{ text: "VILIS", kind: "message", rune: true }]);
  });

  it("PARIDAD #108 con pushConsole: mismos textos de fila para el mismo flujo con \\n", () => {
    const legacy = makeView();
    legacy.view.pushConsole("A scroll: VL!\nMore\n\nEnd", "message");
    const seg = makeView();
    seg.view.pushConsoleSegments([
      { text: "A scroll: ", rune: false },
      { text: "VL", rune: true },
      { text: "!\nMore\n\nEnd", rune: false },
    ]);
    expect(seg.lines().map((l) => l.text)).toEqual(legacy.lines().map((l) => l.text));
    expect(seg.lines().map((l) => l.kind)).toEqual(legacy.lines().map((l) => l.kind));
  });

  it("fila MIXTA: segments compactos + INVARIANTE text === concat(segments)", () => {
    const { view, lines } = makeView();
    view.pushConsoleSegments([
      { text: "A scroll: ", rune: false },
      { text: "VL", rune: true },
      { text: "!\n", rune: false },
    ]);
    const l = lines();
    expect(l.length).toBe(1);
    expect(l[0]!.text).toBe("A scroll: VL!");
    expect(l[0]!.rune).toBeUndefined(); // la fuente vive en los tramos, no en la fila
    expect(l[0]!.segments).toEqual([
      { text: "A scroll: ", rune: false },
      { text: "VL", rune: true },
      { text: "!", rune: false },
    ]);
    expect(l[0]!.segments!.map((s) => s.text).join("")).toBe(l[0]!.text);
  });

  it("messageAppend sobre fila mixta conserva el invariante (tramo latino se extiende)", () => {
    const { view, lines } = makeView();
    view.pushConsoleSegments([
      { text: "A", rune: true },
      { text: "b", rune: false },
    ]);
    view.messageAppend("c");
    const l = lines()[lines().length - 1]!;
    expect(l.text).toBe("Abc");
    expect(l.segments).toEqual([
      { text: "A", rune: true },
      { text: "bc", rune: false }, // compactado con el tramo latino final
    ]);
  });

  it("messageAppend latino sobre fila RÚNICA cerrada materializa los tramos (antes heredaba el flag)", () => {
    const { view, lines } = makeView();
    view.pushConsole("VILIS", "message", true);
    view.messageAppend("!");
    const l = lines()[0]!;
    expect(l.text).toBe("VILIS!");
    expect(l.segments).toEqual([
      { text: "VILIS", rune: true },
      { text: "!", rune: false },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C · Cadena fiel completa: ConsoleLine → filas → layoutConsole → planos del blit
// ─────────────────────────────────────────────────────────────────────────────

describe("#364-c C · layoutConsole con segments (planos cells/cellRune del blit)", () => {
  const toPlanes = (
    consoleLines: readonly ConsoleLine[],
  ): { win: TextWindow } => {
    const rich = withTurnSeparatorsRich(consoleLinesToRows(consoleLines));
    const win = layoutConsole(
      RECT,
      rich.map((r) => r.text),
      rich.map((r) => r.rune),
      rich.map((r) => r.signCells),
      rich.map((r) => r.segments),
    );
    return { win };
  };

  it("REGRESIÓN byte-igual: fila toda-runa y fila toda-latín SIN segments rinden como siempre", () => {
    // El caso previo al cambio (profecía por-fila + prosa): mismos planos EN CRUDO.
    const { win } = toPlanes([
      { text: "VILIS", kind: "message", rune: true },
      { text: "Hello", kind: "message" },
    ]);
    expect(rowText(win, 2)).toBe("VILIS"); // anchorBottom deja el par en las 2 últimas filas
    expect(rowRunes(win, 2, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(rowText(win, 3)).toBe("Hello");
    expect(rowRunes(win, 3, 5)).toEqual([0, 0, 0, 0, 0]);
  });

  it("fila mixta del modelo: el plano cellRune conmuta DENTRO de la fila", () => {
    const { win } = toPlanes([
      {
        text: "A scroll: VL!",
        kind: "message",
        segments: [
          { text: "A scroll: ", rune: false },
          { text: "VL", rune: true },
          { text: "!", rune: false },
        ],
      },
    ]);
    expect(rowText(win, 3)).toBe("A scroll: VL!");
    //                              A  ␣  s  c  r  o  l  l  :  ␣  V  L  !
    expect(rowRunes(win, 3, 13)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
  });

  it("eco con bullet ►: el bullet entra como TRAMO latino y no desplaza los flags", () => {
    const { win } = toPlanes([
      {
        text: "ab",
        kind: "echo",
        segments: [
          { text: "a", rune: true },
          { text: "b", rune: false },
        ],
      },
    ]);
    // ► (0x02) + "ab": el flag rúnico cae en la celda de la "a", no corrido.
    expect(win.cells[3 * win.cols]!).toBe(0x02);
    expect(rowRunes(win, 3, 3)).toEqual([0, 1, 0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D · Productores (mutante: revertir cada migración enrojece su aserto)
// ─────────────────────────────────────────────────────────────────────────────

describe("#364-c D2 · scroll pickup (SJOG 0x15dc-0x1604, tabla DS 0x41AC)", () => {
  it("lootItemSegments(4,q): 'A scroll: ' latín + código rúnico + '!' latín (censo 0x41ac)", () => {
    // q=0 → VL (Vas Lor) y q=7 → AT (An Tym): extremos de la tabla DS 0x41AC.
    expect(lootItemSegments(4, 0)).toEqual([
      { text: "A scroll: ", rune: false },
      { text: "VL", rune: true },
      { text: "!", rune: false },
    ]);
    expect(lootItemSegments(4, 7)).toEqual([
      { text: "A scroll: ", rune: false },
      { text: "AT", rune: true },
      { text: "!", rune: false },
    ]);
    // Invariante con el nombre por-fila (el historial no cambia).
    expect(lootItemSegments(4, 0)!.map((s) => s.text).join("")).toBe(lootItemName(4, 0));
  });

  it("sin tramos fuera del scroll: planos del Cape (quality 0xFF) y otros ids", () => {
    expect(lootItemSegments(4, 0xff)).toBeUndefined(); // HMS Cape plans (0x15cd)
    expect(lootItemSegments(2, 50)).toBeUndefined(); // gold
    expect(lootItemSegments(13, 2)).toBeUndefined(); // torches
  });
});

describe("#364-c D2-bis · cableado del evento: (G)et de un scroll emite los tramos", () => {
  it("game.get sobre botín {id:4} → message con text por-fila Y segments (SJOG 0x15e7)", async () => {
    // Fixture mínimo estilo chest-object.test.ts: party en Paws (3,22), scroll-suelo al N.
    const { Game } = await import("../src/core/game.js");
    const PAWS = 0x16;
    const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
    const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
    const world = {
      overworld,
      underworld: overworld,
      smallMaps: new Map([[PAWS, { id: PAWS, name: "Paws", floors: [{ z: 0, tiles }] }]]),
    };
    const state = {
      version: 1,
      characters: [
        {
          name: "Avatar", gender: 0x0b, class: "A", status: "G",
          strength: 20, dexterity: 20, intelligence: 20,
          currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
          helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
          partyStatus: 0,
        },
      ],
      partySize: 1, activeCharacter: 0,
      food: 100, gold: 0, keys: 0, gems: 0, torches: 2, karma: 50,
      time: { year: 139, month: 4, day: 7, hour: 8, minute: 35 },
      turnsSinceStart: 0,
      position: { location: PAWS, floor: 0, x: 3, y: 22 },
      transport: "foot", torchTurns: 0,
      questFlags: {}, journal: [],
      equipmentQuantities: new Array(48).fill(0),
      spellQuantities: new Array(48).fill(0),
      scrollQuantities: new Array(8).fill(0),
      potionQuantities: new Array(8).fill(0),
      reagentQuantities: new Array(8).fill(0),
      worldObjects: [
        // Pieza de botín-suelo: scroll q=0 → VL (Vas Lor), tabla DS 0x41AC.
        { location: PAWS, floor: 0, x: 3, y: 21, tile: 0x48, kind: "loot", loot: { id: 4, category: "scroll", qty: 0 } },
      ],
    };
    const gameData = {
      locationsX: Array.from({ length: 32 }, () => 250),
      locationsY: Array.from({ length: 32 }, () => 250),
      locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const game = new Game({} as never, world as never, gameData as never, state as never);
    const events = game.get("north");
    const msg = events.find((e) => e.kind === "message" && e.text === "A scroll: VL!");
    expect(msg, "control positivo: el (G)et nombró la pieza").toBeTruthy();
    // El MUTANTE de este aserto: quitar `segments` del push de game.ts:5553 → rojo.
    expect(msg!.segments).toEqual([
      { text: "A scroll: ", rune: false },
      { text: "VL", rune: true },
      { text: "!", rune: false },
    ]);
  });
});

// El bloque D3 conduce la charla con el GUION REAL (`assets/talk/towne.json`), que no
// viaja al repositorio público. Los otros 16 tests del fichero no leen assets y siguen
// dentro de `test:pure`: partir el fichero costaría uno nuevo, acotar el bloque no.
describeSiViaja(["game/assets/talk/towne.json"], "#364-c D3 · habla rúnica de TALK (0x4fc-0x55e, por carácter)", () => {
  function loadTalk(file: string): TalkScript[] {
    const path = fileURLToPath(new URL(`../assets/talk/${file}.json`, import.meta.url));
    return JSON.parse(readFileSync(path, "utf8")) as TalkScript[];
  }
  function findNpc(file: string, name: string): TalkScript {
    const script = loadTalk(file).find((s) => {
      const first = s.name[0];
      return first && first.kind === "text" && first.text.trim() === name;
    });
    if (!script) throw new Error(`NPC ${name} no encontrado en ${file}.json`);
    return script;
  }
  const onlyLines = (out: DialogueOutput[]): Extract<DialogueOutput, { kind: "line" }>[] =>
    out.filter((o): o is Extract<DialogueOutput, { kind: "line" }> => o.kind === "line");

  it("Malifora 'mant': «…chanting AHM !» en UNA línea con sus tramos (asset towne.json en crudo)", () => {
    // Datos CRUDOS del asset (towne.json, qa "mant"): text "I see an honest man
    // chanting  " · Rune · text "AHM " · Rune · text "!". Hoy-antes: 3 líneas.
    const convo = new Conversation(findNpc("towne", "Malifora"), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
    });
    convo.start();
    const out = convo.input("mant");
    const chant = onlyLines(out).filter((l) => l.text.includes("chanting"));
    expect(chant.length).toBe(1); // UNA fila — el flushLine() por toggle la partía en tres
    const line = chant[0]!;
    // La respuesta viaja entrecomillada (speech 0x4da): apertura en el primer tramo
    // latino, cierre pegado al último ("!") antes de los saltos finales.
    expect(line.text).toBe('"I see an honest man chanting  AHM !"');
    expect(line.segments).toEqual([
      { text: '"I see an honest man chanting  ', rune: false },
      { text: "AHM ", rune: true },
      { text: '!"', rune: false },
    ]);
    // Ninguna otra línea de la respuesta lleva la palabra suelta (no quedó partida).
    expect(onlyLines(out).some((l) => l.text.trim() === "AHM")).toBe(false);
  });

  it("control del reparto por segmentos en consola: la línea de Malifora cae en UNA fila fiel", () => {
    const { view, lines } = (() => {
      const view = new CoreViewImpl({} as unknown as Game);
      let captured: ConsoleLine[] = [];
      view.subscribe({ onConsole: (l) => (captured = l as ConsoleLine[]) });
      return { view, lines: () => captured };
    })();
    const convo = new Conversation(findNpc("towne", "Malifora"), {
      avatarName: "Avatar",
      npcKnowsAvatar: false,
    });
    convo.start();
    const out = convo.input("mant");
    for (const o of out) {
      if (o.kind === "line" && o.text.trim().length > 0) {
        if (o.segments) view.pushConsoleSegments(o.segments, "message");
        else view.pushConsole(o.text, "message", o.rune);
      }
    }
    const mixed = lines().filter((l) => l.segments);
    expect(mixed.length).toBe(1);
    expect(mixed[0]!.text).toBe('"I see an honest man chanting  AHM !"');
    expect(mixed[0]!.segments!.map((s) => s.text).join("")).toBe(mixed[0]!.text);
  });
});
