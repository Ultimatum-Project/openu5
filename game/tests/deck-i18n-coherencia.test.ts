/**
 * COHERENCIA i18n del deck móvil (lote i18n-deck 2026-07-24): el botón debe decir
 * EXACTAMENTE el vocablo que la consola ecoará al pulsarlo — los rótulos ES del
 * deck (capa ts() del shell) se contrastan contra el ECO CANÓNICO del corpus
 * es.json (el calco del binario). La tecla sintetizada NO se toca (funcionalidad
 * intacta): sólo se asevera el rótulo.
 *
 * Doble candado por comando:
 *   (a) el corpus es.json sigue traduciendo el ECO con ese vocablo (si un carril
 *       de i18n re-adjudica un término, este test lo AVISA aquí);
 *   (b) el deck (ts() en 'es') rotula con el MISMO vocablo.
 */
import { readFileSync } from "node:fs";
import { huella } from "../src/i18n/huella.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setLang } from "../src/i18n/index.js";
import { ts } from "../src/i18n/shell.js";
import {
  WORLD_BUTTONS,
  DUNGEON_BUTTONS,
  COMBAT_BUTTONS,
  UTIL_BUTTONS,
  MODE_SEGMENTS,
} from "../src/ui/touch.js";

const here = dirname(fileURLToPath(import.meta.url));
const corpus = (
  JSON.parse(readFileSync(join(here, "..", "src", "i18n", "es.json"), "utf8")) as {
    strings: Record<string, { t: string }>;
  }
).strings;

/** Vocablo del eco del corpus (clave es.json) → primera palabra del término ES. */
function corpusTerm(echoKey: string): string {
  const e = corpus[huella(echoKey)];
  expect(e, `el corpus es.json tiene el eco ${JSON.stringify(echoKey)}`).toBeTruthy();
  // Se recorta el decorado del eco (guiones/puntos/saltos): queda el vocablo.
  return e!.t.split(/[-.…\n]/)[0]!.trim();
}

/** label del deck → [clave del ECO en es.json, forma esperada del rótulo]. La forma
 *  del botón es el INFINITIVO del vocablo del eco (mismo término; p.ej. el eco de
 *  Pass conjuga 'Aguardáis' — lemma AGUARDAR). */
const MAP: Record<string, { echo: string; label: string }> = {
  "Talk": { echo: "Talk-", label: "Hablar" },
  "Open": { echo: "Open-", label: "Abrir" },
  "Look": { echo: "Look", label: "Mirar" },
  "Get": { echo: "Get-", label: "Coger" },
  "Search": { echo: "Search-", label: "Buscar" }, // era «Srch»: el EN se completó (portrait-paridad)
  "Jimmy": { echo: "Jimmy-", label: "Forzar" },
  "Klimb": { echo: "Klimb-", label: "Trepar" },
  "Cast": { echo: "Cast...\n", label: "Lanzar" },
  "Mix": { echo: "Mix", label: "Mezclar" },
  "Ready": { echo: "Ready...\n\n", label: "Prestar" },
  "Use": { echo: "Use item", label: "Usar" },
  "Board": { echo: "Board", label: "Abordar" },
  "Enter": { echo: "Enter", label: "Entrar" },
  "Xit": { echo: "X-it ", label: "Salir" },
  "Push": { echo: "Push-", label: "Empujar" },
  "Yell": { echo: "Yell ", label: "Vocear" },
  "Fire": { echo: "Fire-", label: "Disparar" },
  "Hole up": { echo: "Hole up", label: "Acampar" },
  "Ztats": { echo: "Z-stats...\n", label: "Z-perfil" },
  // Sin pictograma desde el 02-08 (petición del usuario). La clave que consume el botón es
  // la MISMA que la de la referencia de comandos del drawer — comprobado aquí: si alguien
  // la re-adjudica a otro término, este candado lo dice.
  "Attack": { echo: "Attack-", label: "Atacar" },
  "Pass": { echo: "Pass", label: "Aguardar" },
  // Comandos añadidos al deck por el CENSO DEL DESPACHADOR (28-07): no tenían vía
  // táctil. Mismo doble candado que el resto — el botón dice el vocablo que la consola
  // ecoará (New Order→«Nuevo Orden», View a gem!→«¡Ver una gema!», Quit:→«Dejar:»).
  // ~~Quit:→«Abandonar:»~~ — RE-APUNTADO (#209, acta-209-171-decisiones.md): «Abandonar»
  // era el único cizallado por ancho de PALABRA del deck de dos pistas (−7 px partido,
  // −12 px clásico); eco es.json y rótulo cambian JUNTOS a «Dejar» (par acoplado, regla
  // del deck). Este doble candado es justo el que impide cambiar uno sin el otro.
  "New order": { echo: "New Order", label: "Nuevo orden" },
  "View gem": { echo: "View a gem!\n", label: "Ver gema" },
  "Quit": { echo: "Quit:", label: "Dejar" },
};

/** Lemma del rótulo (sin glifo decorativo) para comparar con el vocablo del eco. */
function lemma(label: string): string {
  return label.replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñZ]+/u, "").trim();
}

/** ¿mismo término? (infinitivo del botón vs forma del eco: prefijo común ≥4). */
function sameTerm(a: string, b: string): boolean {
  const norm = (x: string): string => x.toLowerCase();
  const [x, y] = [norm(a), norm(b)];
  if (x === y) return true;
  const n = Math.min(4, x.length, y.length);
  return x.slice(0, n) === y.slice(0, n);
}

describe("deck móvil: rótulos ES = vocablo del eco del corpus", () => {
  beforeAll(() => setLang("es", { persist: false }));
  afterAll(() => setLang("en", { persist: false }));

  for (const [deckLabel, spec] of Object.entries(MAP)) {
    it(`«${deckLabel}» rotula «${spec.label}» (eco ${JSON.stringify(spec.echo)})`, () => {
      // (a) el corpus sigue usando este vocablo para el eco.
      const term = corpusTerm(spec.echo);
      expect(
        sameTerm(lemma(spec.label), lemma(term)),
        `vocablo del corpus «${term}» ↔ rótulo «${spec.label}»`,
      ).toBe(true);
      // (b) el deck rotula EXACTAMENTE la forma esperada.
      expect(ts(deckLabel)).toBe(spec.label);
    });
  }

  it("todos los comandos del deck (3 contextos) están cubiertos por el mapa o son shell puro", () => {
    // «Chest» SALE de la lista con el censo de mazmorra del 16-08: el botón pasa a
    // rotularse «Open», que es el vocablo del binario (DS 0xa1ce) y ya está en el MAP.
    const shellOnly = new Set(["Map", "Save", "Drink", "Torch"]);
    for (const def of [...WORLD_BUTTONS, ...DUNGEON_BUTTONS, ...COMBAT_BUTTONS]) {
      const covered = def.label in MAP || shellOnly.has(def.label);
      expect(covered, `comando «${def.label}» sin adjudicación i18n`).toBe(true);
      // Y en ES ningún rótulo queda en inglés crudo (ts() devuelve algo distinto o
      // el label es glifo/identidad deliberada).
      if (shellOnly.has(def.label)) {
        expect(ts(def.label)).not.toBe(def.label);
      }
    }
  });

  it("modo/útil traducidos (Move/Sí-No/Espacio); teclas sintetizadas INTACTAS", () => {
    expect(ts("Move")).toBe("Mover");
    expect(ts("Yes/No")).toBe("Sí/No");
    expect(ts("Yes")).toBe("Sí");
    expect(ts("Space")).toBe("Espacio");
    // Activadores de hoja de la fila útil (iteración A2, 27-07): icono + texto.
    expect(ts("✓/✗ Yes/No")).toBe("✓/✗ Sí/No");
    expect(ts("123 Numbers")).toBe("123 Números");
    expect(ts("ABC")).toBe("ABC");
    // La TECLA no cambia jamás con el idioma (regla del lote): el mapeo label→key
    // es fijo — spot-check de los delicados.
    expect(WORLD_BUTTONS.find((b) => b.label === "Push")!.key).toBe("p");
    expect(WORLD_BUTTONS.find((b) => b.label === "Ztats")!.key).toBe("z");
    expect(UTIL_BUTTONS.find((b) => b.label === "Space")!.key).toBe(" ");
    expect(COMBAT_BUTTONS.find((b) => b.label === "Pass")!.key).toBe(" ");
    expect(MODE_SEGMENTS).toHaveLength(4);
  });
});
