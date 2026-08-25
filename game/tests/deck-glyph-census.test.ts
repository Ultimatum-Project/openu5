/**
 * CENSO DE GLIFOS del deck táctil (auditoría UI/UX móvil 2026-07-25, ítem TOFUS).
 *
 * La familia del deck es `"Courier New", monospace` (index.html `.touch-btn`): sólo
 * unos pocos pictogramas se pintan de verdad ahí. Las 84 capturas de la auditoría
 * (original/av-referencia/mobile-audit-20260725/) dieron el veredicto glifo a glifo:
 *
 *   VERIFICADOS (se leen): ⛶ ☰ ⇄ ⏎ ⌫ ⚔ ◧ ⚙ 🌐 🔥 ▲ ◀ ▶ ▼ y el guion – de «A–Z».
 *   PROSCRITOS: «⯐» U+2BD0 = .notdef (cuadro vacío: el modo ACTIVO se anunciaba con
 *   un tofu) y «⌨» U+2328 = cae a fuente de símbolos y se pinta a ~7 px (borrón).
 *
 * Este test es el candado: ningún rótulo del deck (base inglesa NI su traducción ES
 * por ts()) puede llevar un carácter fuera de la lista blanca, y los dos proscritos
 * no vuelven ni al código fuente de la capa táctil. Lógica PURA (sin DOM).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getLang, setLang } from "../src/i18n/index.js";
import { ts } from "../src/i18n/shell.js";
import {
  WORLD_BUTTONS,
  DUNGEON_BUTTONS,
  COMBAT_BUTTONS,
  UTIL_BUTTONS,
  MODE_SEGMENTS,
  SHEET_ACTIVATORS,
  AZ_ACTIVATOR,
} from "../src/ui/touch.js";

/** Codepoints no-ASCII con render VERIFICADO en las capturas de la auditoría. */
const VERIFIED = new Set(
  [
    0x2013, // – guion de «A–Z»
    0x21c4, // ⇄ cambiar el pad de lado
    0x232b, // ⌫ retroceso del QWERTY
    0x23ce, // ⏎ enter
    0x25b2, 0x25b6, 0x25bc, 0x25c0, // ▲ ▶ ▼ ◀ cruceta
    0x25e7, // ◧ piel
    0x2630, // ☰ menú del shell
    // ⚔ y 🔥 siguen en la lista aunque desde el 02-08 NINGÚN rótulo los use: el usuario
    // pidió quitar los iconos de «Atacar» y «Antorcha». Esta lista es un VEREDICTO DE
    // RENDER de la auditoría del 25-07 («se leen en la familia del deck»), no un censo de
    // uso — sacarlos afirmaría lo contrario de lo que se midió. Quien vigila el uso es el
    // candado de rótulos de `portrait-deck-a4.test.ts`.
    0x2694, // ⚔ atacar (VERIFICADO; sin uso desde el 02-08)
    0x2699, // ⚙ sistema
    0x26f6, // ⛶ pantalla completa
    0x1f310, // 🌐 idioma
    0x1f525, // 🔥 antorcha (VERIFICADO; sin uso desde el 02-08 — ver nota del ⚔)
    // ✓/✗ de los activadores Sí/No (iteración A2 del usuario, 27-07): VERIFICADOS por
    // medición de render en la familia del deck («Courier New», 12 px) — bitmap con
    // tinta propia (20/35 px) DISTINTO del .notdef y avance monoespaciado intacto
    // (7,22 px, igual que ⏎). Medido en Chromium-emulación iPhone 13 (carril
    // portrait-cont); pendiente el contraste en dispositivo físico como el del 25-07.
    0x2713, // ✓ sí
    0x2717, // ✗ no
  ].map(Number),
);

/** Glifos PROSCRITOS por la auditoría (tofu / ilegibles en la familia del deck). */
const BANNED: [number, string][] = [
  [0x2bd0, "⯐ (U+2BD0, .notdef = cuadro vacío)"],
  [0x2328, "⌨ (U+2328, se pinta a ~7 px: ilegible)"],
];

/** Letras acentuadas/signos del castellano: siempre legibles (texto, no pictograma). */
function isSpanishText(cp: number): boolean {
  if (cp === 0xa1 || cp === 0xbf) return true; // ¡ ¿
  return cp >= 0xc0 && cp <= 0x17f; // Latin-1 supplement + Latin Extended-A
}

function offenders(label: string): string[] {
  const bad: string[] = [];
  for (const ch of label) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 || VERIFIED.has(cp) || isSpanishText(cp)) continue;
    bad.push(`${ch} (U+${cp.toString(16).toUpperCase()})`);
  }
  return bad;
}

const ALL_LABELS = [
  ...MODE_SEGMENTS.map((s) => s.label),
  ...WORLD_BUTTONS.map((b) => b.label),
  ...DUNGEON_BUTTONS.map((b) => b.label),
  ...COMBAT_BUTTONS.map((b) => b.label),
  ...UTIL_BUTTONS.map((b) => b.label),
  // Formas CORTAS de la fila útil dentro de la cruceta (A4, 27-07 noche): son rótulos que
  // el jugador VE, así que entran en el censo con los demás.
  ...UTIL_BUTTONS.flatMap((b) => (b.padLabel ? [b.padLabel] : [])),
  // Activadores de hoja de la fila útil (A2): censados igual que el resto — la tabla
  // se exportó precisamente para que estos rótulos no queden fuera del candado.
  ...SHEET_ACTIVATORS.map((b) => b.label),
  AZ_ACTIVATOR.label,
];

describe("censo de glifos del deck (auditoría móvil 2026-07-25)", () => {
  it("ningún rótulo INGLÉS lleva un glifo fuera de la lista blanca", () => {
    for (const label of ALL_LABELS) {
      expect(offenders(label), `rótulo «${label}» con glifo no verificado`).toEqual([]);
    }
  });

  describe("bajo 'es'", () => {
    let prev: string;
    beforeAll(() => {
      prev = getLang();
      setLang("es");
    });
    afterAll(() => setLang(prev));

    it("ningún rótulo TRADUCIDO reintroduce un glifo no verificado", () => {
      for (const label of ALL_LABELS) {
        const es = ts(label);
        expect(offenders(es), `rótulo ES «${es}» (de «${label}») con glifo no verificado`).toEqual(
          [],
        );
      }
    });
  });

  it("la barra de modo se anuncia con PALABRAS (el modo activo ya no es un tofu)", () => {
    expect(MODE_SEGMENTS.map((s) => s.label)).toEqual(["Move", "A–Z", "123", "Yes/No"]);
  });

  // ── CENSO-DE-CLASE (#178): la población de ALL_LABELS se carea contra el FUENTE ────
  // ALL_LABELS enumera tablas exportadas (SIETE hoy). Ese cableado es la clase de #178:
  // una tabla NUEVA de botones (una fila naval, una hoja más) quedaría fuera del candado
  // de glifos sin poner nada en rojo — el censo diría «limpio» con media población. Este
  // control deriva la población de la única fuente que no puede quedarse atrás, el propio
  // touch.ts: todo literal `label:`/`padLabel:` del fichero tiene que estar cubierto por
  // ALL_LABELS. Y con su SUELO: si el extractor deja de casar (comillas simples, template
  // literal, renombre del campo), el conjunto colapsa y lo dice la cifra, no el silencio.
  it("censo-de-clase #178: todo literal label:/padLabel: del fuente está en ALL_LABELS", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "src", "ui", "touch.ts"), "utf8");
    const enFuente = [...src.matchAll(/\b(?:label|padLabel):\s*"([^"\\]*)"/g)].map((m) => m[1]!);
    // SUELO del extractor — población medida al escribir esto: ver el aserto de abajo.
    expect(enFuente.length, "el extractor de labels colapsó (¿cambió el quoting?)").toBeGreaterThanOrEqual(60);
    const censados = new Set(ALL_LABELS);
    const fuera = [...new Set(enFuente)].filter((l) => !censados.has(l));
    expect(
      fuera,
      "rótulos declarados en touch.ts que el censo de glifos NO cubre — si has añadido " +
        "una tabla de botones nueva, súmala a ALL_LABELS (y sus rótulos pasan por la " +
        "lista blanca de glifos como los demás)",
    ).toEqual([]);
  });

  it("los glifos proscritos no vuelven al código de la capa táctil ni al shell i18n", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const rel of [
      join("src", "ui", "touch.ts"),
      join("src", "i18n", "shell.ts"),
    ]) {
      const src = readFileSync(join(here, "..", rel), "utf8");
      for (const [cp, desc] of BANNED) {
        expect(src.includes(String.fromCodePoint(cp)), `${rel} reintroduce ${desc}`).toBe(false);
      }
    }
  });
});
