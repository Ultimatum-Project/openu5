/**
 * ★★ EL LP GUARDA EL **ECO**, NO LA PULSACIÓN — y el runner lo re-tecleaba literal.
 *
 * El getstring RÚNICO de Cast/Mix (CAST2.OVL:0x00de, tabla `DATA.OVL DS:0x1b7a`) se teclea
 * por INICIAL y ECOA la sílaba entera en mayúsculas: pulsar `D` pinta `DES`, pulsar `P`
 * pinta `POR`. El OCR del walkthrough sólo ve la fila de eco, así que la ruta guarda
 * `typed: "DES POR"` cuando lo que el jugador PULSÓ fue `D`,`P`.
 *
 * El runner del espejo (`typeAnswer`) manda ese `typed` con `keyboard.type(...)` tal cual, y
 * `typedSinkClass` clasifica el prompt `rune` como sumidero `word` — o sea que la guarda de
 * sumidero lo deja pasar. Pero DENTRO del prompt rúnico el **ESPACIO es la tecla de ENVÍO**
 * (`prompt-manager.ts:142`, réplica del 0x0d/0x20 → done del binario). Así que "DES POR" no
 * lanza Des Por: envía las iniciales `DES` = Des·Ex·Sanct, que no es ningún hechizo
 * (`No effect!`), y las tres letras restantes `P`,`O`,`R` caen sobre el MAPA como comandos
 * sueltos — exactamente el envenenamiento nº1 que la guarda de sumidero existe para evitar.
 *
 * Población: **623** `typed` de eco rúnico en las 49 rutas (462 multi-sílaba), no los 5
 * `DES POR` de la tarjeta. Sonda: `game/e2e/espejo-tour/tools/censo-runa.mjs`.
 *
 * Este fichero fija las dos mitades:
 *  1. EL DEFECTO, conducido sobre el prompt REAL (no una maqueta): tecleando el eco literal.
 *  2. EL ARREGLO: `runeInitialsFromEcho` invierte el eco a las pulsaciones, y conducido con
 *     ESO el mismo prompt sí resuelve el hechizo del testigo.
 *  3. CONTROLES: lo que NO es eco rúnico (keyword de conversación) se deja intacto, y el
 *     round-trip es total sobre las 24 sílabas de la tabla.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PromptManager } from "../src/ui/prompt-manager.js";
import {
  buildSpellDefs,
  matchSpellByInitials,
  type MagicDefsJson,
  type SpellsDataJson,
} from "../src/core/magic/spells.js";
import { runeInitialsFromEcho, conductTypedOp } from "../e2e/espejo-tour/runner";
import type { PendingPrompt } from "../src/ui/prompt-manager.js";
import type { Page } from "@playwright/test";

function readJson<T>(url: string): T {
  const path = fileURLToPath(new URL(url, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
const SPELL_DEFS = buildSpellDefs(
  readJson<MagicDefsJson>("../src/core/data/MagicDefinitions.json"),
  readJson<SpellsDataJson>("../assets/data.json"),
);

/** Las 24 sílabas de `DS:0x1b7a` con su inicial ('J'/'O' tienen puntero NULL). */
const TABLA: ReadonlyArray<readonly [string, string]> = [
  ["A", "AN"], ["B", "BET"], ["C", "CORP"], ["D", "DES"], ["E", "EX"], ["F", "FLAM"],
  ["G", "GRAV"], ["H", "HUR"], ["I", "IN"], ["K", "KAL"], ["L", "LOR"], ["M", "MANI"],
  ["N", "NOX"], ["P", "POR"], ["Q", "QUAS"], ["R", "REL"], ["S", "SANCT"], ["T", "TYM"],
  ["U", "UUS"], ["V", "VAS"], ["W", "WIS"], ["X", "XEN"], ["Y", "YLEM"], ["Z", "ZU"],
];

function nuevoPrompt(): { pm: PromptManager; enviado: () => string | null } {
  const pm = new PromptManager({ hud: { echoSetLast: () => {} } });
  let enviado: string | null = null;
  pm.current = {
    type: "rune",
    prefix: ":",
    initials: "",
    syllables: [],
    max: 4,
    submit: (initials) => {
      enviado = initials;
    },
  };
  return { pm, enviado: () => enviado };
}

/**
 * Conduce el prompt EXACTAMENTE como lo hace el runner: `keyboard.type(text)` es una
 * pulsación por carácter (incluido el espacio), y después un `Enter`. Devuelve las
 * iniciales enviadas y las letras que SOBRARON (las que cayeron fuera del prompt, es
 * decir sobre el mapa como comandos).
 */
function tecleaComoElRunner(text: string): { enviadas: string | null; sobrantes: string } {
  const { pm, enviado } = nuevoPrompt();
  let sobrantes = "";
  for (const ch of text) {
    if (pm.current === null) {
      sobrantes += ch; // el prompt ya se cerró: esta tecla cae sobre el MAPA
      continue;
    }
    pm.handleKey({ key: ch, preventDefault: () => {} } as unknown as KeyboardEvent);
  }
  if (pm.current !== null) {
    pm.handleKey({ key: "Enter", preventDefault: () => {} } as unknown as KeyboardEvent);
  }
  return { enviadas: enviado(), sobrantes };
}

const DES_POR = 22;

describe("eco rúnico del LP — EL DEFECTO (testigo del corpus)", () => {
  it("★ teclear el eco «DES POR» NO lanza Des Por: envía DES (ningún hechizo) y suelta «POR» sobre el mapa", () => {
    const r = tecleaComoElRunner("DES POR");
    // El ESPACIO envía: sólo llegaron D(es), E(x), S(anct).
    expect(r.enviadas).toBe("DES");
    expect(matchSpellByInitials(SPELL_DEFS, "DES")).toBe(-1); // → "No effect!"
    // Y las tres letras de después ya no tienen prompt donde caer.
    expect(r.sobrantes).toBe("POR");
  });

  it("★ el daño no es exclusivo de los multi-sílaba: «MANI» (118 ops del corpus) envía M·A·N·I", () => {
    const r = tecleaComoElRunner("MANI");
    expect(r.enviadas).toBe("MANI"); // Mani·An·Nox·In, cuatro sílabas
    expect(matchSpellByInitials(SPELL_DEFS, "MANI")).toBe(-1);
  });

  it("CONTROL: pulsar lo que el jugador pulsó DE VERDAD (D,P) sí resuelve Des Por", () => {
    const r = tecleaComoElRunner("DP");
    expect(r.enviadas).toBe("DP");
    expect(matchSpellByInitials(SPELL_DEFS, "DP")).toBe(DES_POR);
    expect(r.sobrantes).toBe("");
  });
});

describe("eco rúnico del LP — EL ARREGLO (runeInitialsFromEcho)", () => {
  it("★ invierte el eco del testigo ad24-g03 / ad17-g11 a sus pulsaciones", () => {
    expect(runeInitialsFromEcho("DES POR")).toBe("DP");
  });

  it("★ conducido con la inversa, el MISMO prompt resuelve Des Por (índice 22)", () => {
    const traducido = runeInitialsFromEcho("DES POR");
    expect(traducido).not.toBeNull();
    const r = tecleaComoElRunner(traducido!);
    expect(r.enviadas).toBe("DP");
    expect(matchSpellByInitials(SPELL_DEFS, r.enviadas!)).toBe(DES_POR);
    expect(r.sobrantes).toBe("");
  });

  it("las formas COMPLETAS más pobladas del corpus resuelven a un hechizo REAL tras la inversa", () => {
    // Formas del LP con su frecuencia en las 49 rutas (sonda `tools/censo-runa.mjs`).
    for (const forma of ["MANI", "IN POR", "VAS MANI", "AN NOX", "AN GRAV", "GRAV POR", "IN WIS", "DES POR"]) {
      const ini = runeInitialsFromEcho(forma);
      expect(ini, forma).not.toBeNull();
      expect(matchSpellByInitials(SPELL_DEFS, ini!), forma).toBeGreaterThanOrEqual(0);
    }
  });

  it("★ el eco TRUNCADO se traduce igual pero NO es hechizo — y eso es material del LP, no del arreglo", () => {
    // 105 de los 623 ops de eco rúnico son PREFIJOS: el OCR leyó la fila de eco a medio
    // teclear. «IN VAS POR» (20 ops) es el prefijo de In Vas Por Ylem (el terremoto).
    // La inversa sigue siendo correcta —IVP son las teclas que había pulsadas—, sólo que
    // ese hechizo no existe. Lo que el arreglo SÍ compra aquí es que ya no se derraman
    // letras sobre el mapa: hoy «IN VAS POR» envía `IN` y suelta `VAS POR` como comandos.
    expect(runeInitialsFromEcho("IN VAS POR")).toBe("IVP");
    expect(matchSpellByInitials(SPELL_DEFS, "IVP")).toBe(-1);
    const hoy = tecleaComoElRunner("IN VAS POR");
    expect(hoy.enviadas).toBe("IN");
    expect(hoy.sobrantes).toBe("VAS POR"); // ← el derrame que el arreglo elimina
  });

  it("round-trip TOTAL sobre las 24 sílabas de DS:0x1b7a", () => {
    for (const [inicial, silaba] of TABLA) {
      expect(runeInitialsFromEcho(silaba), silaba).toBe(inicial);
    }
  });

  it("tolera el ruido de caja y de espacios del OCR", () => {
    expect(runeInitialsFromEcho("des por")).toBe("DP");
    expect(runeInitialsFromEcho("  IN   VAS  POR ")).toBe("IVP");
  });
});

describe("eco rúnico del LP — CONTROLES NEGATIVOS (lo que NO se debe tocar)", () => {
  it("★ una keyword de conversación NO es eco rúnico: devuelve null (se teclea literal)", () => {
    // Si esto tradujera, el arreglo rompería las 290 «BYE» / 230 «YES» / 156 «NAME» del corpus.
    for (const palabra of ["BYE", "YES", "NAME", "BARNABAS", "BLACKTHORN", "COUNCIL", "SHADOWLORDS"]) {
      expect(runeInitialsFromEcho(palabra), palabra).toBeNull();
    }
  });

  it("★ una MEZCLA (una sílaba válida + una palabra que no lo es) NO se traduce a medias", () => {
    expect(runeInitialsFromEcho("IN BARNABAS")).toBeNull();
    expect(runeInitialsFromEcho("DES PUR")).toBeNull(); // «PUR» es ruido OCR, no sílaba
  });

  it("★ la cadena vacía no es eco rúnico", () => {
    expect(runeInitialsFromEcho("")).toBeNull();
    expect(runeInitialsFromEcho("   ")).toBeNull();
  });
});

/**
 * ★★ SELLADO DEL CABLEADO (no sólo de la lógica).
 *
 * La función pura ya estaba fijada, pero el `if (sink === "rune")` del runner vivía sin
 * red: si se perdía en un refactor, el replay volvía a teclear el eco entero y las 623 ops
 * se envenenaban **sin un solo rojo** — el modo de fallo silencioso de
 * «lógica sellada, cableado sin sellar».
 *
 * Aquí se conduce `conductTypedOp` (el cableado REAL, extraído del bucle de guion) contra
 * un `Page` de mentira cuyo teclado alimenta el `PromptManager` **de producción**. Lo que
 * se mide NO es el valor que devuelve la función: es **lo que le llega al juego**, o sea
 * las iniciales con las que se resuelve `submit` del getstring rúnico. Un mutante en
 * cualquiera de los dos eslabones (clasificar `rune` como `word`, o quitar la rama de
 * traducción) tiene que ponerlo rojo.
 */
interface JuegoFalso {
  /** Iniciales con las que se resolvió el getstring rúnico (lo que recibe el juego). */
  recibido: string | null;
  /** Teclas que cayeron FUERA del prompt: sobre el mapa, como comandos sueltos. */
  alMapa: string;
}

function pageFalsa(prompt: "rune" | "text" | "ready-picker" | null): { page: Page; juego: JuegoFalso } {
  const juego: JuegoFalso = { recibido: null, alMapa: "" };
  const pm = new PromptManager({ hud: { echoSetLast: () => {} } });
  if (prompt === "rune") {
    pm.current = {
      type: "rune", prefix: ":", initials: "", syllables: [], max: 4,
      submit: (initials) => { juego.recibido = initials; },
    };
  } else if (prompt === "text") {
    pm.current = {
      type: "text", prefix: ":", buffer: "", max: 15,
      resolve: (t) => { juego.recibido = t; },
    };
  } else if (prompt === "ready-picker") {
    pm.current = { type: "ready-picker", onKey: () => {} };
  }
  const pulsa = (k: string): void => {
    if (pm.current === null) {
      if (k.length === 1) juego.alMapa += k; // sin prompt vivo: cae sobre el MAPA
      return;
    }
    pm.handleKey({ key: k, preventDefault: () => {} } as unknown as KeyboardEvent);
  };
  // Sólo los miembros de `Page` que el conductor toca (locator/evaluate/keyboard/waitFor).
  const page = {
    locator: () => ({ count: async () => 0 }),
    // `typedSinkClass` pasa una closure que sólo lee `window.__u5test`: se ejecuta aquí
    // con ese `window` de mentira, para no duplicar su lógica en el test.
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
  return { page, juego };
}

describe("eco rúnico del LP — EL CABLEADO SELLADO (conductTypedOp sobre el PromptManager real)", () => {
  it("★★ con un prompt RÚNICO vivo, al juego le llegan las INICIALES (DP), no el eco — y NADA cae al mapa", async () => {
    const { page, juego } = pageFalsa("rune");
    const resyncs: string[] = [];
    const out = await conductTypedOp(page, "DES POR", resyncs);

    // Lo que importa no es el retorno, es lo que RECIBIÓ el juego:
    expect(juego.recibido).toBe("DP");
    expect(matchSpellByInitials(SPELL_DEFS, juego.recibido!)).toBe(DES_POR);
    expect(juego.alMapa).toBe(""); // cero derrame de comandos
    expect(out).toEqual({ skipped: false, runeTranslated: true, typed: "DP" });
  });

  it("★★ y el contrafactual: sin la inversa el juego habría recibido «DES» con «POR» al mapa", () => {
    // Mismo prompt, conducido a mano con el eco literal (lo que hacía el runner antes).
    const r = tecleaComoElRunner("DES POR");
    expect(r.enviadas).toBe("DES");
    expect(r.sobrantes).toBe("POR");
    // Es decir: el aserto de arriba SÓLO puede pasar si el cableado traduce.
  });

  it("★ un prompt de TEXTO (keyword de conversación) NO se traduce: llega la palabra entera", async () => {
    const { page, juego } = pageFalsa("text");
    const out = await conductTypedOp(page, "BARNABAS", []);
    expect(juego.recibido).toBe("BARNABAS");
    expect(out.runeTranslated).toBe(false);
  });

  it("★ sin sumidero vivo el `typed` se descarta y NO llega nada al juego (guarda intacta)", async () => {
    const { page, juego } = pageFalsa(null);
    const out = await conductTypedOp(page, "DES POR", []);
    expect(out.skipped).toBe(true);
    expect(out.typed).toBeNull();
    expect(juego.recibido).toBeNull();
    expect(juego.alMapa).toBe(""); // no se pulveriza sobre el mapa
  });

  it("★ ante un picker de UN CARÁCTER se PURGA y se descarta (guarda intacta)", async () => {
    const { page, juego } = pageFalsa("ready-picker");
    const resyncs: string[] = [];
    const out = await conductTypedOp(page, "DES POR", resyncs);
    expect(out.skipped).toBe(true);
    expect(juego.recibido).toBeNull();
    expect(resyncs.some((r) => r.includes("picker de UN CARÁCTER"))).toBe(true);
  });

  it("★ eco rúnico que NO casa sílabas: se teclea literal y se DECLARA en resyncs", async () => {
    const { page } = pageFalsa("rune");
    const resyncs: string[] = [];
    const out = await conductTypedOp(page, "DES PUR", resyncs); // «PUR» = ruido OCR
    expect(out.runeTranslated).toBe(false);
    expect(out.typed).toBe("DES PUR");
    expect(resyncs.some((r) => r.includes("no es eco de sílabas"))).toBe(true);
  });
});
