/**
 * Ciclo de vida del PromptManager (ui/prompt-manager.ts) — TRAMO 2 del refactor
 * estructural (auditoría MANT-1/ARQ-2): el prompt vivo (`pendingPrompt`, 9 tipos)
 * y su reductor de teclas eran un closure de boot() inimportable. Cubre por
 * UNIDAD la semántica de getkey/getstring/getnum del binario:
 *   · yesno (Flow 2): Y/N, ESC IGNORADO; yesno-esc (Flow 1): ESC=N;
 *   · digit (Flow 3): '0'-'9'; con cancelKeys, Space/ESC resuelven 0 (Camp);
 *   · text (getstring 0x7b9c): eco vivo, Enter envía, Backspace-en-vacío/ESC cancelan;
 *   · number (getnum 0x7c1e): sólo dígitos, vacío→0, tope max;
 *   · rune (CAST2 0x00de): sílabas por inicial, J/O rechazadas, ESC envía vacío;
 *   · party-select / ready-picker / shop: reenvío CRUDO al conductor autoritativo;
 *   · toda tecla se CONSUME con prompt vivo (getkey modal re-lee).
 */
import { describe, it, expect } from "vitest";
import { PromptManager } from "../src/ui/prompt-manager.js";

function makePm() {
  const echoes: string[] = [];
  const pm = new PromptManager({ hud: { echoSetLast: (t) => echoes.push(t) } });
  return { pm, echoes };
}

function key(k: string): KeyboardEvent {
  let prevented = false;
  return {
    key: k,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  } as unknown as KeyboardEvent;
}

describe("PromptManager — base modal", () => {
  it("sin prompt: handleKey devuelve false y no toca nada", () => {
    const { pm } = makePm();
    expect(pm.handleKey(key("y"))).toBe(false);
    expect(pm.current).toBe(null);
  });

  it("con prompt vivo: TODA tecla se consume (getkey modal re-lee)", () => {
    const { pm } = makePm();
    let resolved: boolean | null = null;
    pm.current = { type: "yesno", resolve: (y) => (resolved = y) };
    expect(pm.handleKey(key("x"))).toBe(true); // no válida → consumida, prompt sigue
    expect(pm.current).not.toBe(null);
    expect(resolved).toBe(null);
  });
});

describe("PromptManager — yesno / yesno-esc", () => {
  it("yesno (Flow 2): Y resuelve true, N false, ESC IGNORADO", () => {
    const { pm } = makePm();
    const got: boolean[] = [];
    pm.current = { type: "yesno", resolve: (y) => got.push(y) };
    pm.handleKey(key("Escape"));
    expect(pm.current).not.toBe(null); // ESC ignorado
    pm.handleKey(key("y"));
    expect(got).toEqual([true]);
    expect(pm.current).toBe(null);
    pm.current = { type: "yesno", resolve: (y) => got.push(y) };
    pm.handleKey(key("N"));
    expect(got).toEqual([true, false]);
  });

  it("yesno-esc (Flow 1): ESC = N", () => {
    const { pm } = makePm();
    const got: boolean[] = [];
    pm.current = { type: "yesno-esc", resolve: (y) => got.push(y) };
    pm.handleKey(key("Escape"));
    expect(got).toEqual([false]);
    expect(pm.current).toBe(null);
  });

  it("el resolve puede re-armar OTRO prompt (re-entrada segura)", () => {
    const { pm } = makePm();
    pm.current = {
      type: "yesno",
      resolve: () => {
        pm.current = { type: "digit", resolve: () => {} };
      },
    };
    pm.handleKey(key("y"));
    expect(pm.current?.type).toBe("digit"); // el null previo no pisó al nuevo
  });
});

describe("PromptManager — digit (Flow 3, getkey crudo)", () => {
  it("'0'-'9' resuelve; letras ignoradas; sin cancelKeys ESC/Space ignorados", () => {
    const { pm } = makePm();
    const got: number[] = [];
    pm.current = { type: "digit", resolve: (n) => got.push(n) };
    pm.handleKey(key(" "));
    pm.handleKey(key("Escape"));
    pm.handleKey(key("a"));
    expect(pm.current).not.toBe(null);
    pm.handleKey(key("7"));
    expect(got).toEqual([7]);
  });

  it("cancelKeys (Camp 0x3dd6): Space y ESC resuelven 0", () => {
    const { pm } = makePm();
    const got: number[] = [];
    pm.current = { type: "digit", cancelKeys: true, resolve: (n) => got.push(n) };
    pm.handleKey(key(" "));
    expect(got).toEqual([0]);
  });

  // El 2º parámetro del resolve es el CARÁCTER CRUDO, que es lo que ecoa el original
  // (kernel 0x3dc6 `putchar [bp-2]`). Los tres caminos de cancelación colapsan al MISMO
  // n=0 y por tanto el número no puede distinguirlos: sin el crudo, Espacio (que el
  // original ecoa) y ESC (que el original ni decodifica) serían indistinguibles y uno de
  // los dos acabaría ecoando algo inventado. "" = nada que ecoar.
  it("el resolve entrega el CARÁCTER: dígito → su propio char", () => {
    const { pm } = makePm();
    const got: [number, string][] = [];
    pm.current = { type: "digit", resolve: (n, k) => got.push([n, k]) };
    pm.handleKey(key("7"));
    expect(got).toEqual([[7, "7"]]);
  });

  it("🔴 Space y ESC resuelven el MISMO 0 pero con crudo DISTINTO (' ' vs '')", () => {
    const conEspacio: [number, string][] = [];
    const pmA = makePm().pm;
    pmA.current = { type: "digit", cancelKeys: true, resolve: (n, k) => conEspacio.push([n, k]) };
    pmA.handleKey(key(" "));
    expect(conEspacio).toEqual([[0, " "]]);

    const conEsc: [number, string][] = [];
    const pmB = makePm().pm;
    pmB.current = { type: "digit", cancelKeys: true, resolve: (n, k) => conEsc.push([n, k]) };
    pmB.handleKey(key("Escape"));
    expect(conEsc).toEqual([[0, ""]]); // ESC no existe en el getkey del original ⇒ sin eco
  });
});

describe("PromptManager — text (getstring de consola)", () => {
  it("teclea con eco vivo, Enter envía el buffer", () => {
    const { pm, echoes } = makePm();
    let word = "";
    pm.current = { type: "text", prefix: ":", buffer: "", max: 4, resolve: (w) => (word = w) };
    pm.handleKey(key("a"));
    pm.handleKey(key("b"));
    expect(echoes).toEqual([":a", ":ab"]);
    pm.handleKey(key("c"));
    pm.handleKey(key("d"));
    pm.handleKey(key("e")); // max=4: la 5ª se ignora
    pm.handleKey(key("Enter"));
    expect(word).toBe("abcd");
    expect(pm.current).toBe(null);
  });

  it("Backspace borra (eco reescrito); en vacío CANCELA; ESC cancela dejando el prefijo", () => {
    const { pm, echoes } = makePm();
    let cancelled = 0;
    pm.current = {
      type: "text", prefix: ":", buffer: "", max: 8,
      resolve: () => {}, cancel: () => cancelled++,
    };
    pm.handleKey(key("h"));
    pm.handleKey(key("Backspace"));
    expect(echoes).toEqual([":h", ":"]);
    pm.handleKey(key("Backspace")); // vacío → cancela
    expect(cancelled).toBe(1);
    expect(pm.current).toBe(null);
    pm.current = {
      type: "text", prefix: ":", buffer: "", max: 8,
      resolve: () => {}, cancel: () => cancelled++,
    };
    pm.handleKey(key("Escape"));
    expect(cancelled).toBe(2);
    expect(echoes[echoes.length - 1]).toBe(":"); // eco sin cursor colgando
  });
});

describe("PromptManager — number (getnum 0x7c1e)", () => {
  it("sólo dígitos hasta max; Enter con vacío envía 0; letras ignoradas", () => {
    const { pm, echoes } = makePm();
    const got: number[] = [];
    pm.current = { type: "number", prefix: "How much? ", buffer: "", max: 2, submit: (n) => got.push(n) };
    pm.handleKey(key("x"));
    pm.handleKey(key("9"));
    pm.handleKey(key("9"));
    pm.handleKey(key("9")); // max=2: ignorada
    expect(echoes).toEqual(["How much? 9", "How much? 99"]);
    pm.handleKey(key("Enter"));
    expect(got).toEqual([99]);
    pm.current = { type: "number", prefix: "How much? ", buffer: "", max: 2, submit: (n) => got.push(n) };
    pm.handleKey(key("Enter")); // vacío → 0 (Mix lo trata como abortar, 0x1b71)
    expect(got).toEqual([99, 0]);
  });
});

describe("PromptManager — rune (CAST2 0x00de)", () => {
  it("iniciales → sílabas ecoadas; J/O rechazadas; Enter/Space envían; ESC envía vacío", () => {
    const { pm, echoes } = makePm();
    const got: string[] = [];
    pm.current = { type: "rune", prefix: "Spell: ", initials: "", syllables: [], max: 4, submit: (i) => got.push(i) };
    pm.handleKey(key("i"));
    pm.handleKey(key("j")); // J sin runa → rechazada (0x00fa)
    pm.handleKey(key("l"));
    expect(echoes[echoes.length - 1]).toBe("Spell: IN LOR");
    pm.handleKey(key("Backspace"));
    expect(echoes[echoes.length - 1]).toBe("Spell: IN");
    pm.handleKey(key("Enter"));
    expect(got).toEqual(["I"]);
    pm.current = { type: "rune", prefix: "Spell: ", initials: "", syllables: [], max: 4, submit: (i) => got.push(i) };
    pm.handleKey(key("Escape")); // ESC = di:=0 → vacío ("None!")
    expect(got).toEqual(["I", ""]);
  });
});

describe("PromptManager — reenvío CRUDO a conductores autoritativos", () => {
  it("party-select / ready-picker / shop reciben la tecla tal cual y gestionan el prompt", () => {
    const { pm } = makePm();
    for (const type of ["party-select", "ready-picker", "shop"] as const) {
      const keys: string[] = [];
      pm.current = { type, onKey: (k) => keys.push(k) };
      pm.handleKey(key("ArrowDown"));
      pm.handleKey(key("Enter"));
      expect(keys).toEqual(["ArrowDown", "Enter"]);
      expect(pm.current?.type).toBe(type); // el manager NO lo cierra (autoritativo el conductor)
      pm.current = null;
    }
  });
});
