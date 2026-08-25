/**
 * Flujo END-TO-END del diálogo de (H)ole up & camp a nivel de DRIVER (el pegamento
 * que main.ts cablea a hud/view/pendingPrompt/sleep). Blinda la regresión reportada
 * EN VIVO: H → horas → "Wilt thou set a watch?" → Y → **debe** aparecer "Who will
 * stand guard?" + armarse el picker `party-select` + colocarse el cursor de la flecha
 * → en el 1er miembro; luego mover/elegir hasta dormir. Antes el driver era una closure
 * inline de main.ts (sólo cubierta por E2E); ahora es unit-testable.
 *
 * Arnés: un espía captura print()/setSelectCursor()/setPrompt()/startSleep(); "teclear"
 * = invocar el resolve/onKey del prompt armado, exactamente como hace el bucle de
 * teclas de main.ts (pendingPrompt.resolve / .onKey). Máquina real (campPrompt.ts).
 */
import { describe, expect, it } from "vitest";
import {
  driveCampPrompt,
  type CampArmedPrompt,
  type CampPromptDriverDeps,
} from "../src/core/campPromptDriver.js";
import { campPromptStart, type CampPromptCtx } from "../src/core/campPrompt.js";

/** Party de 3 despiertos (Avatar/Shamino 'G' válidos, Iolo 'P' no válido guardia). */
function makeCtx(): CampPromptCtx {
  const names = ["Avatar", "Shamino", "Iolo"];
  return {
    watchCount: 3,
    partySize: 3,
    isValidGuard: (idx) => idx === 0 || idx === 1, // 0,1 'G'; 2 'P'
  };
}

/** Espía de sinks + helper para "teclear" contra el prompt actualmente armado. */
function harness(ctx: CampPromptCtx = makeCtx()) {
  const prints: string[] = [];
  const inline: string[] = [];
  const cursors: (number | null)[] = [];
  const sleeps: { hours: number; guardIdx: number }[] = [];
  let prompt: CampArmedPrompt = null;
  const deps: CampPromptDriverDeps = {
    print: (t) => prints.push(t),
    // Sink SEPARADO a propósito: `printInline` va a `hud.messageAppend` (continúa la fila
    // viva) y `print` a `hud.message` (abre fila propia). Un espía único no distinguiría
    // el eco pegado al prompt del eco en su propia línea, que es justo el defecto.
    printInline: (t) => inline.push(t),
    setSelectCursor: (idx) => cursors.push(idx),
    setPrompt: (p) => { prompt = p; },
    ctx: () => ctx,
    startSleep: (hours, guardIdx) => sleeps.push({ hours, guardIdx }),
  };
  // "Teclas" que REPLICAN el bucle de main.ts (pendingPrompt): dígito/yesno resuelven,
  // party-select reenvía la tecla cruda al picker. Fidelidad al PORT (main.ts), que es
  // circular: este arnés no deriva nada del binario, sólo imita al despachador vivo.
  // El bucle de teclas de main.ts entrega el número Y el carácter crudo: el eco del
  // original es del CARÁCTER (0x3dc6), y Espacio/'0'/ESC colapsan todos a n=0 — sin el
  // crudo no se pueden distinguir, y ecoan distinto.
  const typeDigit = (n: number, raw = String(n)): void => {
    if (prompt?.type !== "digit") throw new Error(`prompt no es digit: ${prompt?.type}`);
    prompt.resolve(n, raw);
  };
  const typeYesNo = (yes: boolean): void => {
    if (prompt?.type !== "yesno") throw new Error(`prompt no es yesno: ${prompt?.type}`);
    prompt.resolve(yes);
  };
  const pickerKey = (key: string): void => {
    if (prompt?.type !== "party-select") throw new Error(`prompt no es party-select: ${prompt?.type}`);
    prompt.onKey(key);
  };
  return {
    prints, inline, cursors, sleeps,
    promptType: () => prompt?.type ?? null,
    start: () => driveCampPrompt(campPromptStart(), deps),
    typeDigit, typeYesNo, pickerKey,
  };
}

describe("camp flow — el picker de guardia aparece tras Y (regresión en vivo)", () => {
  it("H → 3 → Wilt thou set a watch? → Y → Who will stand guard? + picker + cursor 0", () => {
    const h = harness();
    h.start();
    expect(h.promptType()).toBe("digit"); // "For how many hours?"
    expect(h.prints).toContain("For how many hours? (1-9) ");

    h.typeDigit(3);
    expect(h.promptType()).toBe("yesno"); // watch, party de 3 despiertos
    expect(h.prints).toContain("\nWilt thou set a watch? "); // \n inicial fiel (0xa348)

    h.typeYesNo(true); // ← la tecla Y del reporte
    // EL BUG: tras Y no aparecía ni el texto ni el picker. Aquí lo exigimos:
    expect(h.prints).toContain("Who will stand guard? ");
    expect(h.promptType()).toBe("party-select"); // picker interactivo armado
    expect(h.cursors.at(-1)).toBe(0); // flecha → colocada en el 1er miembro
    expect(h.sleeps).toHaveLength(0); // aún no duerme
  });

  it("picker: flecha baja mueve el cursor y RE-arma el party-select (sigue navegable)", () => {
    const h = harness();
    h.start(); h.typeDigit(3); h.typeYesNo(true);
    h.pickerKey("ArrowDown");
    expect(h.promptType()).toBe("party-select"); // sigue abierto
    expect(h.cursors.at(-1)).toBe(1); // cursor movido a Shamino
    expect(h.sleeps).toHaveLength(0);
  });

  it("elegir un guardia 'G' (Enter sobre el cursor) → duerme con ese guardia", () => {
    const h = harness();
    h.start(); h.typeDigit(3); h.typeYesNo(true);
    h.pickerKey("Enter"); // confirma el cursor 0 (Avatar, 'G')
    expect(h.sleeps).toEqual([{ hours: 3, guardIdx: 0 }]);
    expect(h.promptType()).toBeNull(); // prompt cerrado al dormir
    expect(h.cursors.at(-1)).toBeNull(); // cursor del picker retirado
  });

  it("elegir por número directo (2 → Shamino 'G') → duerme con guardia 1", () => {
    const h = harness();
    h.start(); h.typeDigit(3); h.typeYesNo(true);
    h.pickerKey("2");
    expect(h.sleeps).toEqual([{ hours: 3, guardIdx: 1 }]);
  });

  it("guardia NO 'G' (Iolo, idx 2) → None posted! y duerme sin guardia", () => {
    const h = harness();
    h.start(); h.typeDigit(3); h.typeYesNo(true);
    h.pickerKey("3"); // Iolo, status 'P'
    expect(h.prints).toContain("None posted!\n\n");
    expect(h.sleeps).toEqual([{ hours: 3, guardIdx: -1 }]);
  });
});

describe("camp flow — watch N y sin watch", () => {
  it("Y watch=N → duerme sin guardia, sin picker", () => {
    const h = harness();
    h.start(); h.typeDigit(3);
    h.typeYesNo(false);
    expect(h.promptType()).toBeNull();
    expect(h.sleeps).toEqual([{ hours: 3, guardIdx: -1 }]);
  });

  it("party con <2 despiertos: horas → duerme directo (sin prompt de watch)", () => {
    const oneAwake: CampPromptCtx = {
      watchCount: 1, partySize: 3,
      isValidGuard: () => false,
    };
    const h = harness(oneAwake);
    h.start(); h.typeDigit(5);
    expect(h.promptType()).toBeNull(); // NO watch
    expect(h.sleeps).toEqual([{ hours: 5, guardIdx: -1 }]);
  });

  it("horas '0' → cancela sin dormir ni prompt", () => {
    const h = harness();
    h.start(); h.typeDigit(0);
    expect(h.promptType()).toBeNull();
    expect(h.sleeps).toHaveLength(0);
  });
});

// El eco del dígito de horas, VISTO POR EL DRIVER — reporte del usuario con captura del
// original. Lo que se blinda aquí no es "que haya eco" sino POR QUÉ SINK sale: el eco tiene
// que ir por `printInline` (→ `hud.messageAppend`, continúa la fila de "For how many
// hours? (1-9) ") y NO por `print` (→ `hud.message`, que abre fila propia porque
// `pushConsole` arranca en columna 0 a propósito, coreview.ts:542). Un eco emitido por el
// sink equivocado sale en su propia línea: parece arreglado en un log aplanado y sigue roto
// en pantalla.
describe("camp flow — eco del dígito por el sink INLINE (kernel 0x3dc6)", () => {
  it("el dígito se ecoa por printInline, no por print", () => {
    const h = harness();
    h.start();
    expect(h.prints).toEqual(["For how many hours? (1-9) "]);
    h.typeDigit(3, "3");
    expect(h.inline).toEqual(["3"]); // pegado al prompt
    expect(h.prints).not.toContain("3"); // y NO como fila suelta
  });

  it("el eco precede al prompt del watch (orden del binario: 0x3dc6 antes de 0x3e32)", () => {
    const h = harness();
    h.start();
    h.typeDigit(7, "7");
    expect(h.inline).toEqual(["7"]);
    expect(h.prints).toEqual(["For how many hours? (1-9) ", "\nWilt thou set a watch? "]);
  });

  it("🔴 cancelar con ESPACIO ecoa igual y NO duerme (el eco precede al test 0x3dd6)", () => {
    const h = harness();
    h.start();
    h.typeDigit(0, " ");
    expect(h.inline).toEqual([" "]);
    expect(h.sleeps).toHaveLength(0);
    expect(h.promptType()).toBeNull();
  });

  it("ESC cancela SIN eco (no está decodificado en el getkey del original)", () => {
    const h = harness();
    h.start();
    h.typeDigit(0, "");
    expect(h.inline).toEqual([]);
    expect(h.sleeps).toHaveLength(0);
  });

  it("elegir guardia NO ecoa nombre por ningún sink (el picker devuelve índice, no imprime)", () => {
    const h = harness();
    h.start(); h.typeDigit(8, "8");
    h.typeYesNo(true);
    h.pickerKey("Enter"); // confirma cursor 0 = Avatar ('G')
    expect(h.sleeps).toEqual([{ hours: 8, guardIdx: 0 }]);
    expect(h.prints.join("|")).not.toContain("Avatar");
    expect(h.inline.join("|")).not.toContain("Avatar");
  });
});

// El eco de la respuesta al watch, VISTO POR EL DRIVER. Misma familia y mismo mecanismo que
// el eco del dígito: el prompt acaba en espacio sin `\n` y la respuesta continúa esa fila.
describe("camp flow — eco de Yes/No por el sink INLINE (0xa368/0xa362)", () => {
  it("Y → 'Yes' sale inline, y 'Who will stand guard? ' abre su propia fila", () => {
    const h = harness();
    h.start(); h.typeDigit(3, "3");
    h.typeYesNo(true);
    expect(h.inline).toEqual(["3", "Yes"]);
    expect(h.prints).toEqual([
      "For how many hours? (1-9) ",
      "\nWilt thou set a watch? ",
      "Who will stand guard? ",
    ]);
  });

  it("N → 'No' inline y a dormir, sin filas de más", () => {
    const h = harness();
    h.start(); h.typeDigit(3, "3");
    h.typeYesNo(false);
    expect(h.inline).toEqual(["3", "No"]);
    expect(h.prints).toEqual(["For how many hours? (1-9) ", "\nWilt thou set a watch? "]);
    expect(h.sleeps).toEqual([{ hours: 3, guardIdx: -1 }]);
  });
});
