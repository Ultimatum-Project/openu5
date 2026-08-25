// @vitest-environment jsdom
/**
 * BOTONERA DE COMBATE — la lista táctil contra el bucle de turno de COMBAT.OVL.
 *
 * Origen: reporte del usuario jugando en táctil (08-08): «en ataque sólo se ven dos
 * botones, Pass y Attack, y no se pueden usar los otros — Use, Ready, etc.».
 *
 * La arena NO pasa por el despachador del kernel (`kernel_cmd_dispatch` 0x3178):
 * COMBAT.OVL tiene su PROPIO bucle de turno (0x0838) con su propia tabla de nombres.
 * Por eso el censo de WORLD_BUTTONS (hecho contra el kernel) no dice nada de este
 * contexto, y por eso la tabla de abajo se derivó aparte, tecla a tecla, del árbol de
 * comparaciones + las dos jump tables inline:
 *
 *   · 0x0ABE  `sub ax,0x42; cmp 7; jmp cs:[bx-0x52a2]`  → tabla de 8 words en 0x0ACE,
 *     teclas B..I  (CS = fileoff + 0xA290, así que base 0x10000-0x52a2 = 0xAD5E → 0x0ACE).
 *   · 0x0AE8  `sub ax,0x4b; cmp 6; jmp cs:[bx-0x5278]`  → tabla de 7 words en 0x0AF8,
 *     teclas K..Q.
 *   · Compares sueltos para J, A, Esc, 1..4, 0x13, R, V, S, T, U, W, X, Y, Z, 0xFC,
 *     Espacio y los dígitos.
 *
 * El árbol da TRES clases, no dos — y la del medio es la que hace falta para no meter
 * la trampa inversa de #71 (un clon «fiel» que AÑADE una orden que el original rechaza
 * diverge tanto como uno que la quita):
 *
 *   ACEPTADA  — el handler hace el trabajo (o lo delega a su overlay).
 *   RECHAZADA — el handler existe y su único efecto es imprimir el nombre del comando
 *               más un rechazo y pitar, vía el funnel SJOG.OVL:0x1F26 (`print
 *               strPtr` @0x1F29, luego code 1→DS 0x8f12 `" what?"`, 2→DS 0x8f1a
 *               `"-Not here"`, 3→DS 0x8f24 `"-Funny, no response!"`, y `ret 1` =
 *               re-prompt sin consumir turno).
 *   DESCONOCIDA — «D-What?»/«W-What?» (0x0A3A/0x0A8E) o el «What?» de 0x0AB7.
 *
 * Este fichero es el candado de la lista táctil contra esa derivación, en dos planos:
 * QUÉ ÓRDENES declara `COMBAT_BUTTONS` (lógica pura, primer describe) y que esos
 * botones se MONTEN y EMITAN su tecla al tocarlos (jsdom, segundo describe) — porque
 * «la entrada existe en el array» no es «el jugador puede pulsarla», que es justo lo
 * que reportó el usuario. Lo que NO mide es estilo ni layout.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { COMBAT_BUTTONS, UTIL_BUTTONS, TouchControls } from "../src/ui/touch.js";
import type { Game } from "../src/core/game.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_TS = join(HERE, "..", "src", "main.ts");

/** Una orden del bucle de turno de combate, tal como la despacha COMBAT.OVL:0x0838. */
interface CombatOrder {
  /** Tecla tal como la ve el port (`KeyboardEvent.key`). */
  key: string;
  /** Código que compara el binario (AL tras `sub ah,ah` en 0x0848). */
  code: number;
  /** Nombre humano. */
  name: string;
  /** Offset del handler en COMBAT.OVL (fileoff). */
  handler: number;
  /** Adónde va: rutina real, o el funnel de rechazo. */
  destino: string;
}

/**
 * LAS ACEPTADAS. Cada fila: tecla → handler en COMBAT.OVL → destino resuelto.
 * Los seis que pasan por el funnel de acción 0x0544 (Get/Jimmy/Open/Ready/Search/Use)
 * comparten el gate `test byte [g_cmb_actor*8 - 0x45ea], 0x80` de 0x0557: si el
 * combatiente activo no es del party, «Can't!» (DS 0x6d98) y re-prompt. Para un PJ
 * pasa y se ejecuta la rutina del overworld, la MISMA (stubs resueltos con
 * `re/tools/dispatch_table.py`).
 */
const ACEPTADAS: CombatOrder[] = [
  { key: "a", code: 0x41, name: "Attack", handler: 0x08e0, destino: "COMSUBS.OVL:0x0D96" },
  { key: "c", code: 0x43, name: "Cast", handler: 0x08f0, destino: "gate 0x08f0 → CAST.OVL:0x0DBA" },
  { key: "g", code: 0x47, name: "Get", handler: 0x096a, destino: "funnel 0x0544 code0 → SJOG.OVL:0x18CE" },
  { key: "j", code: 0x4a, name: "Jimmy", handler: 0x097a, destino: "funnel 0x0544 code1 → SJOG.OVL:0x0D4A" },
  { key: "k", code: 0x4b, name: "Klimb", handler: 0x0984, destino: "SJOG.OVL:0x1D6A" },
  { key: "o", code: 0x4f, name: "Open", handler: 0x098a, destino: "funnel 0x0544 code2 → SJOG.OVL:0x1374" },
  { key: "p", code: 0x50, name: "Push", handler: 0x0994, destino: "CMDS.OVL:0x161A" },
  { key: "r", code: 0x52, name: "Ready", handler: 0x09a2, destino: "funnel 0x0544 code3 → ZSTATS.OVL:0x1296" },
  { key: "s", code: 0x53, name: "Search", handler: 0x09ac, destino: "funnel 0x0544 code4 → SJOG.OVL:0x095C" },
  { key: "u", code: 0x55, name: "Use", handler: 0x09b6, destino: "funnel 0x0544 code5 → CAST.OVL:0x1792" },
  { key: "y", code: 0x59, name: "Yell", handler: 0x09c0, destino: "CMDS.OVL:0x1418" },
  { key: "z", code: 0x5a, name: "Ztats", handler: 0x09ce, destino: "ZSTATS.OVL:0x0A3A" },
  { key: " ", code: 0x20, name: "Pass", handler: 0x09e2, destino: 'print DS 0x6e60 "Pass\\n"' },
  { key: "Escape", code: 0x1b, name: "Flee", handler: 0x09dc, destino: "CMDS.OVL:0x17EC" },
];

/**
 * LAS RECHAZADAS. Todas por el funnel SJOG.OVL:0x1F26 con su código de rechazo. El
 * binario las CONOCE (tienen handler y nombre propio en la tabla de COMBAT.OVL) y aun
 * así no dejan hacer nada en la arena — que es exactamente por qué no pueden aparecer
 * en la botonera: un botón que sólo puede producir «-Not here» es una orden inventada.
 */
const RECHAZADAS: CombatOrder[] = [
  { key: "b", code: 0x42, name: "Board", handler: 0x0a2c, destino: "funnel 0x1F26 code1 «Board what?»" },
  { key: "e", code: 0x45, name: "Enter", handler: 0x0a4a, destino: "funnel 0x1F26 code2 «Enter-Not here»" },
  { key: "f", code: 0x46, name: "Fire", handler: 0x0a54, destino: "funnel 0x1F26 code2 «Fire-Not here»" },
  { key: "h", code: 0x48, name: "Hole up", handler: 0x0a5a, destino: "funnel 0x1F26 code2 «Hole up-Not here»" },
  { key: "i", code: 0x49, name: "Ignite torch", handler: 0x0a60, destino: "funnel 0x1F26 code2 «Ignite torch-Not here»" },
  { key: "l", code: 0x4c, name: "Look", handler: 0x0a66, destino: "funnel 0x1F26 code2 «Look-Not here»" },
  { key: "m", code: 0x4d, name: "Mix", handler: 0x0a6c, destino: "funnel 0x1F26 code2 «Mix-Not here»" },
  { key: "n", code: 0x4e, name: "New order", handler: 0x0a72, destino: "funnel 0x1F26 code2 «New order-Not here»" },
  { key: "q", code: 0x51, name: "Quit", handler: 0x0a78, destino: "funnel 0x1F26 code2 «Quit-Not here»" },
  { key: "t", code: 0x54, name: "Talk", handler: 0x0a7e, destino: "funnel 0x1F26 code3 «Talk-Funny, no response!»" },
  { key: "v", code: 0x56, name: "View", handler: 0x0a88, destino: "funnel 0x1F26 code2 «View-Not here»" },
  { key: "x", code: 0x58, name: "X-it", handler: 0x0a94, destino: "funnel 0x1F26 code1 «X-it what?»" },
];

/**
 * ÓRDENES ACEPTADAS QUE EL MOTOR DEL PORT AÚN NO TIENE EN LA ARENA (hueco declarado).
 * VACÍO desde el carril fix-121 (ficha #121): el hueco J/S/P/Y que este censo
 * declaraba quedó CERRADO — los cuatro se despachan en handleCombatKey y llevan botón
 * (derivación en re/notes/combat-commands.md §J/S/P/Y; RNG: Jimmy rand(0,29)
 * puerta/cepo y rand(1,30) cofre trampeado; Search rand(1,30) con cofre y la cadena
 * de restos de SJOG:0x01f2 con sangre 0x1F; Push/Yell cero). El centinela de abajo
 * se INVIRTIÓ: ahora exige que los cuatro SIGAN despachados y con botón — si un
 * refactor los pierde, este fichero vuelve a rojo. La lista se conserva por si un
 * hueco de motor NUEVO necesita declararse (misma maquinaria, dos sentidos).
 */
const HUECO_DE_MOTOR: { key: string; name: string; rng: string }[] = [];

/** Las cuatro del hueco CERRADO por fix-121: el centinela positivo las vigila. */
const CERRADAS_121: { key: string; name: string }[] = [
  { key: "j", name: "Jimmy" },
  { key: "s", name: "Search" },
  { key: "p", name: "Push" },
  { key: "y", name: "Yell" },
];

/** Órdenes con vía táctil FIJA fuera de la rejilla contextual (no necesitan botón). */
const VIA_FIJA = new Map<string, string>([
  ["Escape", "UTIL_BUTTONS «Esc»"],
  [" ", "UTIL_BUTTONS «Space» (además del botón Pass)"],
]);

/** El cuerpo de `handleCombatKey`, recortado del fuente por sus dos extremos. */
function cuerpoHandleCombatKey(): string {
  const src = readFileSync(MAIN_TS, "utf8");
  const ini = src.indexOf("const handleCombatKey = (ev: KeyboardEvent): void => {");
  expect(ini, "no se encontró la declaración de handleCombatKey en main.ts").toBeGreaterThan(-1);
  // Cierre de la arrow function al MISMO nivel de indentación (4 espacios); todo lo
  // anidado dentro cierra más adentro.
  const fin = src.indexOf("\n    };\n", ini);
  expect(fin, "no se encontró el cierre de handleCombatKey").toBeGreaterThan(ini);
  return src.slice(ini, fin);
}

/** ¿Despacha `handleCombatKey` esta letra? Misma forma para preguntar y para negar. */
function despachaLetra(cuerpo: string, letra: string): boolean {
  return new RegExp(`key\\.toLowerCase\\(\\)\\s*===\\s*"${letra}"`).test(cuerpo);
}

describe("botonera de combate — contra el bucle de turno de COMBAT.OVL:0x0838", () => {
  it("las tres clases del árbol son disjuntas y no se pisan (integridad de la tabla)", () => {
    const keys = [...ACEPTADAS, ...RECHAZADAS].map((o) => o.key);
    expect(new Set(keys).size, "una tecla en dos clases a la vez").toBe(keys.length);
    const codes = [...ACEPTADAS, ...RECHAZADAS].map((o) => o.code);
    expect(new Set(codes).size, "dos órdenes con el mismo código de tecla").toBe(codes.length);
    // Las letras del binario son mayúsculas (AL vale 0x41..0x5A); el port las compara
    // en minúscula. La tabla guarda la minúscula, así que el código y la tecla tienen
    // que casar o una de las dos columnas está mal transcrita.
    for (const o of [...ACEPTADAS, ...RECHAZADAS]) {
      if (o.key.length === 1 && o.key >= "a" && o.key <= "z") {
        expect(o.code, `${o.name}: la tecla «${o.key}» no casa con 0x${o.code.toString(16)}`).toBe(
          o.key.toUpperCase().charCodeAt(0),
        );
      }
    }
  });

  it("NINGÚN botón de combate ofrece una orden que el binario RECHAZA en la arena", () => {
    // La trampa inversa de #71: añadir una orden que el original no acepta es tanta
    // divergencia como quitarla. Todas éstas SÍ están en WORLD_BUTTONS — el error
    // natural es reutilizar aquella lista.
    const rechazadas = new Map(RECHAZADAS.map((o) => [o.key, o]));
    for (const def of COMBAT_BUTTONS) {
      const mala = rechazadas.get(def.key.toLowerCase());
      expect(
        mala,
        `el botón «${def.label}» (tecla «${def.key}») ofrece una orden que COMBAT.OVL ` +
          `rechaza: handler 0x${mala?.handler.toString(16)} → ${mala?.destino}`,
      ).toBeUndefined();
    }
  });

  it("NINGÚN botón de combate ofrece una tecla que el binario no reconoce", () => {
    const aceptadas = new Set(ACEPTADAS.map((o) => o.key));
    for (const def of COMBAT_BUTTONS) {
      const k = def.key.length === 1 ? def.key.toLowerCase() : def.key;
      expect(
        aceptadas.has(k),
        `el botón «${def.label}» manda «${def.key}», que no está en el árbol de 0x0838 ` +
          `(caería en el «What?» de 0x0AB7)`,
      ).toBe(true);
    }
  });

  it("NINGÚN botón de combate ofrece una orden que el MOTOR del port no atiende", () => {
    // El botón muerto: la tecla es legal en el binario, así que los dos asertos de
    // arriba la dejan pasar — pero `handleCombatKey` no la despacha, y el botón se
    // hunde sin efecto. Es la clase que más se parece a trabajo hecho.
    const hueco = new Map(HUECO_DE_MOTOR.map((h) => [h.key, h]));
    for (const def of COMBAT_BUTTONS) {
      const muerto = hueco.get(def.key.toLowerCase());
      expect(
        muerto,
        `el botón «${def.label}» manda «${def.key}», que el binario acepta pero el motor ` +
          `del port NO resuelve en combate: el botón no haría nada. Implementa la orden ` +
          `primero (RNG: ${muerto?.rng})`,
      ).toBeUndefined();
    }
  });

  it("toda orden ACEPTADA que el motor del port ya resuelve TIENE vía táctil", () => {
    // Éste es el aserto que el reporte del usuario habría puesto en rojo: con la lista
    // vieja (Attack + Pass) faltaban Cast, Use, Ready, Get, Open, Klimb y Ztats.
    const cuerpo = cuerpoHandleCombatKey();
    const conBoton = new Set(COMBAT_BUTTONS.map((b) => (b.key.length === 1 ? b.key.toLowerCase() : b.key)));
    const enUtil = new Set(UTIL_BUTTONS.map((b) => b.key));
    const hueco = new Set(HUECO_DE_MOTOR.map((h) => h.key));

    const faltan: string[] = [];
    for (const o of ACEPTADAS) {
      if (hueco.has(o.key)) continue; // hueco de MOTOR declarado — su propio test lo vigila
      if (conBoton.has(o.key) || enUtil.has(o.key) || VIA_FIJA.has(o.key)) continue;
      faltan.push(`${o.name} («${o.key}», COMBAT.OVL 0x${o.handler.toString(16)} → ${o.destino})`);
    }
    expect(faltan, `órdenes de combate sin ninguna vía táctil: ${faltan.join(" · ")}`).toEqual([]);
    // Y la Ztats, que no la sirve handleCombatKey sino el keyHandler de CAPTURA de la
    // piel fiel: se comprueba que el botón existe, porque el cuerpo de arriba no la
    // nombra y un lector podría creerla un descuido.
    expect(conBoton.has("z"), "falta el botón Ztats (lo sirve skin/fiel/skin.ts:2338)").toBe(true);
    expect(despachaLetra(cuerpo, "z")).toBe(false); // no está aquí — y no debe estarlo
  });

  it("el hueco de MOTOR J/S/P/Y está CERRADO (fix-121): los cuatro se despachan y tienen botón", () => {
    const cuerpo = cuerpoHandleCombatKey();
    // CONTROL primero: la misma sonda tiene que ENCONTRAR las letras de siempre.
    // Sin esto, un refactor del despachador dejaría los asertos de abajo cayendo por
    // un falso negativo de FORMA en vez de por una pérdida real.
    for (const letra of ["a", "c", "u", "r", "k", "g", "o"]) {
      expect(
        despachaLetra(cuerpo, letra),
        `sonda MUERTA: handleCombatKey ya no despacha «${letra}» con la forma esperada ` +
          `— revisa el recorte y la expresión antes de fiarte de los asertos`,
      ).toBe(true);
    }
    // El centinela INVERTIDO (antes negaba el despacho; fix-121 lo cerró): los cuatro
    // comandos siguen despachados Y con botón. Si un refactor pierde uno, rojo aquí.
    const conBoton = new Set(COMBAT_BUTTONS.map((b) => (b.key.length === 1 ? b.key.toLowerCase() : b.key)));
    for (const h of CERRADAS_121) {
      expect(
        despachaLetra(cuerpo, h.key),
        `${h.name} («${h.key}») ha DEJADO de despacharse en combate: el cierre de #121 ` +
          `se ha perdido (re/notes/combat-commands.md §J/S/P/Y)`,
      ).toBe(true);
      expect(
        conBoton.has(h.key),
        `${h.name} («${h.key}») se despacha pero ha perdido su botón en COMBAT_BUTTONS`,
      ).toBe(true);
    }
    // Y la maquinaria del hueco sigue viva para el próximo que se declare.
    for (const h of HUECO_DE_MOTOR) {
      expect(
        despachaLetra(cuerpo, h.key),
        `${h.name} («${h.key}») YA se despacha en combate: el hueco de motor está cerrado, ` +
          `así que le toca botón en COMBAT_BUTTONS (RNG: ${h.rng})`,
      ).toBe(false);
    }
  });

  it("Ready SÍ es una orden legal de combate en U5 (la duda explícita del reporte)", () => {
    // No es una opinión de jugador: 'R' = 0x52 tiene su compare en COMBAT.OVL 0x0ADE
    // (`cmp ax,0x52; jne; jmp 0x9a2`), el handler 0x09A2 empuja DS 0x6e2e
    // «Ready...\n\n» y el code 3 al funnel de ACCIÓN 0x0544, que despacha al stub
    // 0x7E4E → ZSTATS.OVL:0x1296. No pasa por el funnel de rechazo 0x1F26.
    const ready = ACEPTADAS.find((o) => o.name === "Ready");
    expect(ready).toBeDefined();
    expect(ready!.handler).toBe(0x09a2);
    expect(ready!.destino).toContain("ZSTATS.OVL:0x1296");
    expect(RECHAZADAS.some((o) => o.name === "Ready")).toBe(false);
    expect(COMBAT_BUTTONS.some((b) => b.label === "Ready" && b.key === "r")).toBe(true);
  });
});

/**
 * Y EL CABLEADO, que es cosa distinta de la lista: que la rejilla CONMUTE a combate y
 * que cada botón emita de verdad su tecla. Sin esto el fichero sellaría un array —
 * «existe la entrada» no es «el jugador puede pulsarla», que es literalmente lo que
 * reportó el usuario. Mismo patrón jsdom que `touch-tapgate-wiring.test.ts`.
 */
function stubBrowserGaps(): void {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("coarse"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!("ResizeObserver" in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
    globalThis.ResizeObserver = (window as unknown as { ResizeObserver: typeof ResizeObserver })
      .ResizeObserver;
  }
}

/** Monta el deck con el juego EN COMBATE y devuelve el contenedor de la rejilla. */
function deckEnCombate(): HTMLElement {
  stubBrowserGaps();
  document.body.innerHTML = "";
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  // `refresh()` sólo lee estos dos campos para elegir la rejilla (touch.ts:1180).
  const game = { combat: {}, dungeonState: null } as unknown as Game;
  const deck = new TouchControls(parent, game);
  deck.refresh();
  return parent;
}

/** Teclas que el deck emite en `window` durante `fn`. */
function teclasDurante(fn: () => void): string[] {
  const vistas: string[] = [];
  const on = (e: Event): void => void vistas.push((e as KeyboardEvent).key);
  window.addEventListener("keydown", on);
  try {
    fn();
  } finally {
    window.removeEventListener("keydown", on);
  }
  return vistas;
}

function tap(el: Element): void {
  el.dispatchEvent(new MouseEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }));
  el.dispatchEvent(new MouseEvent("pointerup", { clientX: 10, clientY: 10, bubbles: true }));
}

describe("botonera de combate — el CABLEADO, no sólo la lista", () => {
  it("en combate la rejilla monta EXACTAMENTE los botones de COMBAT_BUTTONS", () => {
    const parent = deckEnCombate();
    const montados = [...parent.querySelectorAll<HTMLElement>(".touch-cmd")].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(montados).toEqual(COMBAT_BUTTONS.map((b) => b.label));
  });

  it("cada botón de combate EMITE su tecla al tocarlo (incluidos los siete nuevos)", () => {
    const parent = deckEnCombate();
    const botones = [...parent.querySelectorAll<HTMLElement>(".touch-cmd")];
    expect(botones).toHaveLength(COMBAT_BUTTONS.length);
    botones.forEach((btn, i) => {
      const esperada = COMBAT_BUTTONS[i]!.key;
      expect(teclasDurante(() => tap(btn)), `el botón «${COMBAT_BUTTONS[i]!.label}» no emitió su tecla`).toEqual([
        esperada,
      ]);
    });
  });
});
