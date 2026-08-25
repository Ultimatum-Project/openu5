/**
 * ESC en el getstring de CONVERSACIÓN — régimen FIEL del kernel (carril
 * blackthorn-esc, pregunta del usuario 24-08: «¿qué pasa en 1988 si pulso ESC
 * al What is thy name?»).
 *
 * DERIVACIÓN (kernel getstring ULTIMA.EXE 0x3b1c — el 0x7b9c que empuja TALK
 * 0x0a2c-0x0a37 con (0xbcf8, max 0xf), resuelto vía dispatch_table: base
 * TALK=0xBF80 ⇒ 0x3b1c, bolsa-39-acta §citas):
 *   · 0x3b7c `cmp si,0xd` / 0x3b7f `jne 0x3b30` — la ÚNICA salida es CR;
 *   · 0x3b4e `cmp si,0x1b`: ESC con buffer no vacío BORRA lo tecleado (0x3b57
 *     repinta con 0x1fa0, 0x3b5b `sub di,di`) y con vacío es no-op (0x3b53/55)
 *     — en ambos casos el bucle SIGUE leyendo. ESC jamás envía ni cancela;
 *   · 0x3b3f `or di,di` / 0x3b41 `je` — Backspace con buffer vacío se ignora.
 * ⇒ En 1988 NO hay salida por ESC de una conversación: en el trono de Blackthorn
 * (label 4, re-pregunta sin contador) el jugador queda RETENIDO hasta dar un
 * nombre del grupo. El ESC-cancelaba del port era una válvula divergente.
 *
 * El control negativo fija que los getstrings SIN `escKernel` (Yell overworld,
 * rumor de taberna) conservan su cancelación declarada: la retirada de la
 * válvula es de la CONVERSACIÓN, no un barrido de la clase entera.
 */
import { describe, it, expect } from "vitest";
import { PromptManager, type PendingPrompt } from "../src/ui/prompt-manager.js";

type TextPrompt = Extract<PendingPrompt, { type: "text" }>;

function armText(opts: { escKernel?: boolean }): {
  pm: PromptManager;
  ecos: string[];
  resuelto: () => string | null;
  cancelado: () => boolean;
} {
  const ecos: string[] = [];
  const pm = new PromptManager({ hud: { echoSetLast: (s: string) => ecos.push(s) } });
  let resuelto: string | null = null;
  let cancelado = false;
  const p: TextPrompt = {
    type: "text",
    prefix: ":",
    buffer: "",
    max: 0xf, // TALK.OVL 0x0a33
    resolve: (t) => {
      resuelto = t;
    },
    cancel: () => {
      cancelado = true;
    },
    ...(opts.escKernel ? { escKernel: true } : {}),
  };
  pm.current = p;
  return { pm, ecos, resuelto: () => resuelto, cancelado: () => cancelado };
}

function tecla(pm: PromptManager, key: string): void {
  pm.handleKey({ key, preventDefault: () => {} } as unknown as KeyboardEvent);
}

describe("getstring de conversación (escKernel) — ESC calca 0x3b4e-0x3b5d", () => {
  it("ESC con texto tecleado BORRA la línea y el prompt SIGUE vivo", () => {
    const h = armText({ escKernel: true });
    for (const c of "Ava") tecla(h.pm, c);
    tecla(h.pm, "Escape");
    expect(h.pm.current).not.toBeNull(); // el bucle sigue (0x3b5d jmp 0x3b7c → not CR → 0x3b30)
    expect((h.pm.current as TextPrompt).buffer).toBe(""); // 0x3b5b sub di,di
    expect(h.ecos.at(-1)).toBe(":"); // la línea repintada al prefijo pelado (0x1fa0)
    expect(h.cancelado()).toBe(false);
    expect(h.resuelto()).toBeNull();
  });

  it("ESC con buffer vacío es no-op (0x3b53/0x3b55) — ni envía ni cancela", () => {
    const h = armText({ escKernel: true });
    tecla(h.pm, "Escape");
    expect(h.pm.current).not.toBeNull();
    expect(h.cancelado()).toBe(false);
    expect(h.resuelto()).toBeNull();
  });

  it("Backspace con buffer vacío se ignora (0x3b3f/0x3b41)", () => {
    const h = armText({ escKernel: true });
    tecla(h.pm, "Backspace");
    expect(h.pm.current).not.toBeNull();
    expect(h.cancelado()).toBe(false);
  });

  it("tras el ESC se puede teclear y SOLO CR envía: «Ava»+ESC+«Avatar»+Enter → resolve(«Avatar»)", () => {
    const h = armText({ escKernel: true });
    for (const c of "Ava") tecla(h.pm, c);
    tecla(h.pm, "Escape");
    for (const c of "Avatar") tecla(h.pm, c);
    tecla(h.pm, "Enter");
    expect(h.resuelto()).toBe("Avatar"); // lo tecleado ANTES del ESC no contamina
    expect(h.pm.current).toBeNull();
    expect(h.cancelado()).toBe(false);
  });

  it("Enter con línea vacía envía \"\" — la salida de 1988 (AskName 0x0ea4 «If you say so...»)", () => {
    const h = armText({ escKernel: true });
    tecla(h.pm, "Enter");
    expect(h.resuelto()).toBe("");
    expect(h.pm.current).toBeNull();
  });
});

describe("control negativo — el getstring SIN escKernel conserva su cancelación declarada", () => {
  it("ESC cancela (semántica Yell/rumor intacta)", () => {
    const h = armText({});
    for (const c of "Hum") tecla(h.pm, c);
    tecla(h.pm, "Escape");
    expect(h.pm.current).toBeNull();
    expect(h.cancelado()).toBe(true);
    expect(h.resuelto()).toBeNull();
  });

  it("Backspace en vacío cancela (semántica previa intacta)", () => {
    const h = armText({});
    tecla(h.pm, "Backspace");
    expect(h.pm.current).toBeNull();
    expect(h.cancelado()).toBe(true);
  });
});
