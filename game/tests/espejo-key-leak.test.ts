/**
 * F1 — EL KEY-LEAK DEL GETSTRING (guarda del fix; acta `re/notes/espejo-ad-cabos-ad.md`
 * §1.b.2/§4-F1, confirmando la ficha §4.2 de `tecleos-parciales-fix.md`).
 *
 * ## El defecto que fija
 *
 * Los ops `key` del guion se enviaban INCONDICIONALMENTE (`pressKey`), sin el careo de
 * sumidero que los `typed` sí tienen. Cuando el juego abre un getstring que el guion no
 * condujo (la captura de Blackthorn en ad12-g34: divergencia de localización →
 * interrogatorio inesperado), las teclas de COMANDO programadas entran como TEXTO:
 * `:okootYES` (o/k/t de Open/Klimb/Talk) → 4 respuestas ≠ mantra → péndulo. El runner
 * fabricaba una vía que el LP no condujo — y el careo de la vía de ad12 se adjudicó
 * ARTEFACTO por esto (acta §1.b).
 *
 * ## El criterio sellado
 *
 * Un op `key` es SIEMPRE comando de mapa, elección de picker/tienda o respuesta Y/N —
 * NUNCA letra de getstring (las respuestas de getstring viajan como `typed`, por diseño
 * del segmentador). Se retiene SÓLO ante un prompt ACUMULADOR (`text`/`number`/`rune`,
 * los únicos que tragan la tecla como texto); a TODOS los consumidores por tecla
 * (yesno/digit/pickers/getkey/shop y el mapa) se envía como siempre — ese es el control
 * positivo: las conducciones legítimas del corpus no se mueven.
 *
 * Como en `espejo-rune-echo.test.ts`, aquí se conduce `conductKeyOp` (el cableado REAL)
 * contra un `Page` de mentira cuyo teclado alimenta el `PromptManager` DE PRODUCCIÓN:
 * lo que se mide es lo que le LLEGA al juego, no el valor de retorno. Un mutante en
 * cualquiera de los dos eslabones (quitar el careo, o retener de más) se pone rojo.
 */
import { describe, expect, it } from "vitest";
import { PromptManager } from "../src/ui/prompt-manager.js";
import type { PendingPrompt } from "../src/ui/prompt-manager.js";
import { conductKeyOp } from "../e2e/espejo-tour/runner";
import type { Page } from "@playwright/test";

interface JuegoFalso {
  /** Texto/iniciales con que se resolvió un getstring (null = no se resolvió). */
  recibido: string | null;
  /** Respuesta de un prompt yesno (null = sin contestar). */
  yes: boolean | null;
  /** Teclas que llegaron a un picker (`onKey`). */
  picker: string;
  /** Teclas que cayeron SIN prompt vivo: sobre el MAPA, como comandos. */
  alMapa: string;
}

type Arma = "text" | "number" | "rune" | "yesno" | "ready-picker" | null;

function pageFalsa(arma: Arma): { page: Page; juego: JuegoFalso; pm: PromptManager } {
  const juego: JuegoFalso = { recibido: null, yes: null, picker: "", alMapa: "" };
  const pm = new PromptManager({ hud: { echoSetLast: () => {} } });
  if (arma === "text") {
    pm.current = { type: "text", prefix: ":", buffer: "", max: 15, resolve: (t) => { juego.recibido = t; } };
  } else if (arma === "number") {
    pm.current = { type: "number", prefix: ":", buffer: "", max: 2, submit: (n) => { juego.recibido = String(n); } };
  } else if (arma === "rune") {
    pm.current = {
      type: "rune", prefix: ":", initials: "", syllables: [], max: 4,
      submit: (initials) => { juego.recibido = initials; },
    };
  } else if (arma === "yesno") {
    pm.current = { type: "yesno", resolve: (yes) => { juego.yes = yes; } };
  } else if (arma === "ready-picker") {
    pm.current = { type: "ready-picker", onKey: (k) => { juego.picker += k; } };
  }
  const pulsa = (k: string): void => {
    const dom = k === "Space" ? " " : k; // playwright "Space" llega al DOM como " "
    if (pm.current === null) {
      if (dom.length === 1) juego.alMapa += dom;
      return;
    }
    pm.handleKey({ key: dom, preventDefault: () => {} } as unknown as KeyboardEvent);
  };
  const page = {
    locator: () => ({ count: async () => 0 }),
    // `conductKeyOp` pasa una closure que sólo lee `window.__u5test.promptType`: se
    // ejecuta aquí con ese `window` de mentira, para no duplicar su lógica en el test.
    evaluate: async (fn: () => unknown) => {
      const g = globalThis as unknown as { window?: unknown };
      const previo = g.window;
      g.window = { __u5test: { promptType: () => (pm.current as PendingPrompt | null)?.type ?? null } };
      try {
        return fn();
      } finally {
        g.window = previo;
      }
    },
    keyboard: {
      type: async (text: string) => { for (const ch of text) pulsa(ch); },
      press: async (k: string) => pulsa(k),
    },
    waitForTimeout: async () => {},
  } as unknown as Page;
  return { page, juego, pm };
}

describe("key-leak — LA RETENCIÓN (getstring acumulador vivo)", () => {
  it("★★ con un getstring de TEXTO vivo (la captura de ad12), la tecla de comando se RETIENE: nada llega al buffer ni al mapa", async () => {
    const { page, juego, pm } = pageFalsa("text");
    const resyncs: string[] = [];
    const out = await conductKeyOp(page, "o", resyncs);
    expect(out).toEqual({ sent: false, heldBy: "text" });
    expect((pm.current as { buffer: string }).buffer).toBe(""); // ni una letra en el getstring
    expect(juego.recibido).toBeNull();
    expect(juego.alMapa).toBe("");
    expect(resyncs.some((r) => r.includes("key-leak"))).toBe(true); // retención DECLARADA
  });

  it("★★ y el contrafactual: sin el careo, o/k/o/o/t habrían entrado como texto (el «:okoot…» del acta)", async () => {
    // Mismo prompt, conducido como el runner de ANTES (pressKey incondicional).
    const { page, pm } = pageFalsa("text");
    for (const k of ["o", "k", "o", "o", "t"]) await (page as unknown as { keyboard: { press: (k: string) => Promise<void> } }).keyboard.press(k);
    expect((pm.current as { buffer: string }).buffer).toBe("okoot");
    // Es decir: el aserto de arriba SÓLO puede pasar si el cableado retiene.
  });

  it("★ con el prompt RÚNICO vivo, el ESPACIO se retiene (habría ENVIADO el hechizo a medias)", async () => {
    const { page, juego } = pageFalsa("rune");
    const out = await conductKeyOp(page, " ", []);
    expect(out).toEqual({ sent: false, heldBy: "rune" });
    expect(juego.recibido).toBeNull(); // sin submit fabricado
  });

  it("★ con un getstring NUMÉRICO vivo, también se retiene", async () => {
    const { page, juego } = pageFalsa("number");
    const out = await conductKeyOp(page, "y", []);
    expect(out).toEqual({ sent: false, heldBy: "number" });
    expect(juego.recibido).toBeNull();
  });
});

describe("key-leak — CONTROL POSITIVO (las keys legítimas siguen llegando)", () => {
  it("★★ sin prompt vivo la tecla va al MAPA como comando (la población grande: 12.000+ ops del corpus)", async () => {
    const { page, juego } = pageFalsa(null);
    const out = await conductKeyOp(page, "o", []);
    expect(out).toEqual({ sent: true, heldBy: null });
    expect(juego.alMapa).toBe("o");
  });

  it("★★ un prompt YESNO vivo consume la 'y' como respuesta (los 334 ops 'y' del corpus)", async () => {
    const { page, juego } = pageFalsa("yesno");
    const out = await conductKeyOp(page, "y", []);
    expect(out.sent).toBe(true);
    expect(juego.yes).toBe(true);
  });

  it("★ un picker de UN CARÁCTER consume la tecla como elección (overlays ArrowDown/Enter del corpus)", async () => {
    const { page, juego } = pageFalsa("ready-picker");
    const out = await conductKeyOp(page, "b", []);
    expect(out.sent).toBe(true);
    expect(juego.picker).toBe("b");
  });
});
