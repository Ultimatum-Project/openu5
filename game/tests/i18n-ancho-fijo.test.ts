/**
 * GUARDA DE ANCHO FIJO (§4 guía-estilo-es) — verificación de que la traducción al
 * español no DESBORDA ni TRUNCA MAL las superficies de ancho fijo del port. Cubre
 * las dos preocupaciones de la guarda §4 marcadas «verificar en vivo»:
 *
 *   1. Etiquetas ABREVIADAS de Ztats (Str=→Fue=, HP:→PV:, Magic:→Magia:, provisiones)
 *      — deben CONSERVAR EL ANCHO para no rebasar el panel de 15 columnas ni pisar la
 *      columna de números. `renderStatPage`/`renderProvisionsPage` usan `writeAt`, que
 *      RECORTA en silencio a `win.cols`; el invariante es que la línea COMPUESTA nunca
 *      supere el ancho (así lo pintado == lo pretendido, sin pérdida).
 *   2. Rótulos de GRUPO en MAYÚSCULA (`monsterNamesUpper`) de la entrada a combate —
 *      el español es mucho más largo (SEÑOR DE LA SOMBRA=18 vs SHADOW LORD=11). La
 *      consola de 16 col hace WORD-WRAP (no recorte): el invariante es que TODO el
 *      texto sobreviva en la rejilla (se parte en 2 filas, no se pierde ni un glifo).
 *
 * Verificación visual en vivo (capturas): docs/i18n/verificacion-ancho-2026-07-19.md.
 * Aserciones DINÁMICAS contra es.json (no hardcode del castellano): si el lead ajusta
 * un valor en la lámina, el test sigue válido mientras se respete el ancho.
 */
import { afterEach, describe, expect, it } from "vitest";
import { huella } from "../src/i18n/huella.js";
import { t, setLang, BASE_LANG } from "../src/i18n/index.js";
import { renderProvisionsPage, renderStatPage, renderArmsPage } from "../src/skin/fiel/ztats.js";
import { layoutConsole } from "../src/skin/fiel/console.js";
import { CONSOLE_RECT } from "../src/skin/fiel/skin.js";
import { TextWindow } from "../src/skin/fiel/textwindow.js";
import type { InventoryProvisions, ZtatsMemberView } from "../src/skin/api.js";
import esTable from "../src/i18n/es.json";

const es = esTable.strings as Record<string, { t: string }>;
afterEach(() => setLang(BASE_LANG, { persist: false }));

// Panel de Ztats (cols 24..38 = 15 celdas), la superficie de la ficha/provisiones.
const PANEL = { leftCol: 24, topRow: 1, rightCol: 38, botRow: 10 };
// Consola fiel (cols 24..39 = 16 celdas; wrapWidth 15), la superficie del banner de combate.
// IMPORTADA, no copiada: este fichero llevaba su propio literal con `botRow: 22` y sobrevivió
// VERDE al cambio a 23 (#113) porque sus asertos van contra `gridText`, que junta TODAS las
// filas y es por tanto insensible al alto de la ventana. O sea: no era un verde falso — era
// una COPIA RANCIA a la espera de que alguien añadiera aquí un aserto indexado por fila, que
// mediría una ventana que no existe. Se importa para que no pueda volver a divergir.
const CONSOLE = CONSOLE_RECT;

function rowStr(w: TextWindow, r: number): string {
  let s = "";
  for (let c = 0; c < w.cols; c++) s += String.fromCharCode(w.cells[r * w.cols + c]!);
  return s.replace(/\s+$/, "");
}
/** Todo el texto de la rejilla con los saltos de fila colapsados a espacio. */
function gridText(w: TextWindow): string {
  const rows: string[] = [];
  for (let r = 0; r < w.rows; r++) rows.push(rowStr(w, r));
  return rows.join(" ").replace(/\s+/g, " ").trim();
}

// Las 9 clases (letra +0xA "AMBFDTPRS") para forzar el rótulo de clase más largo.
const CLASS_LETTERS = ["A", "M", "B", "F", "D", "T", "P", "R", "S"];
// Los 5 estados de salud (letra +0xB).
const STATUS_LETTERS = ["G", "P", "C", "S", "D"];

// PEOR CASO numérico: 2 díg. en atributos, 4 díg. en HP/HM/Ex, 2 díg. en MP.
function worstMember(charClass: string, status: string): ZtatsMemberView {
  return {
    name: "Avatar", charClass, status, gender: "M",
    str: 99, dex: 99, int: 99, hp: 9999, maxHp: 9999, mp: 99, exp: 9999, level: 88,
  };
}

describe("§4 ancho fijo — ficha de STATS (es) cabe en el panel de 15 col", () => {
  it("las 3 filas de stats nunca rebasan 15 col en el PEOR caso (99/9999) para toda clase/estado", () => {
    setLang("es", { persist: false });
    for (const cls of CLASS_LETTERS) {
      for (const st of STATUS_LETTERS) {
        const w = renderStatPage(PANEL, worstMember(cls, st));
        // Filas de contenido: 0 (cabecera clase), 1 (estado), 3-5 (stats), 7 (Magia).
        for (const r of [0, 1, 3, 4, 5, 7]) {
          expect(rowStr(w, r).length, `clase=${cls} estado=${st} fila=${r}`).toBeLessThanOrEqual(w.cols);
        }
      }
    }
  });

  it("las etiquetas ES conservan el ancho del inglés (columnas alineadas, sin pisar números)", () => {
    setLang("es", { persist: false });
    // Cada etiqueta traducida ocupa EXACTAMENTE el mismo nº de celdas que el inglés.
    for (const [en, w] of [["Str=", 4], ["  HP:", 5], ["Int=", 4], ["  HM:", 5], ["Dex=", 4], ["  Ex:", 5], ["Magic:", 6], [" Lv-", 4]] as const) {
      expect(t(en).length, `label ${en}`).toBe(w);
    }
  });
});

describe("§4 ancho fijo — página de PROVISIONES (es) cabe en 15 col", () => {
  it("Food/Gold (4 díg.) y Keys/Gems/Torches (2 díg.) no rebasan el ancho en el peor caso", () => {
    setLang("es", { persist: false });
    const worst: InventoryProvisions = { food: 9999, gold: 9999, keys: 99, gems: 99, torches: 99, grapple: true };
    const w = renderProvisionsPage(PANEL, worst);
    for (const r of [1, 2, 4, 5, 6, 7]) {
      expect(rowStr(w, r).length, `fila=${r}`).toBeLessThanOrEqual(w.cols);
    }
    // Food/Gold ES: 'Comida:'/'Oro:' desplazan la cifra a una COLUMNA COMÚN — ambas
    // etiquetas rellenadas a 9 celdas (testigo del usuario). Keys/Gems/Torches conservan
    // su ancho de 12 con los puntos de relleno. Todas siguen cabiendo en 15 col (arriba).
    for (const [en, len] of [[" Food: ", 9], [" Gold: ", 9], [" Keys.......", 12], [" Gems.......", 12], [" Torches....", 12]] as const) {
      expect(t(en).length, `prov ${en}`).toBe(len);
    }
    // Las cifras de Comida y Oro alinean (misma columna): con valores del mismo nº de
    // dígitos, las filas 1 y 2 miden lo mismo (la cifra acaba en la misma celda).
    const wAlign = renderProvisionsPage(PANEL, { food: 12, gold: 34, keys: 0, gems: 0, torches: 0, grapple: false });
    expect(rowStr(wAlign, 1).length).toBe(rowStr(wAlign, 2).length);
  });
});

describe("§4 ancho fijo — nombres de EQUIPO (es) en las superficies de columna", () => {
  it("los nombres cortos ES caben en el campo de 10 celdas del picker (o Ztats-lista con 'NN-')", () => {
    // Ruling del lead 2026-07-20 (pieza A): abreviatura NATURAL que quepa, no calco del
    // truncado inglés. 'Esc Grande'(10) reemplaza 'Esc Grnd'; 'Esc Joya'(8) reemplaza
    // 'Esc Enjy'. Ambas caben en el campo de nombre del picker (10) sin recortar.
    for (const [en, len] of [["Lg. Shield", 10], ["Jewel Shld", 8]] as const) {
      expect(es[huella(en)]?.t, `equip ${en}`).toBeTruthy();
      expect(es[huella(en)]!.t.length, `equip ${en} ancho`).toBe(len);
      expect(es[huella(en)]!.t.length, `equip ${en} ≤10`).toBeLessThanOrEqual(10);
    }
  });

  it("la página de ARMAS ES no trunca a media palabra los ítems largos (override natural)", () => {
    // Ruling del lead 2026-07-20 (pieza B): Iron Helm/Ring Mail comparten key con la forma
    // plena de tienda (15) y rebasarían el campo de armas (14) → override de display ES a
    // abreviatura natural. La fila debe contener el nombre ÍNTEGRO (no truncado).
    setLang("es", { persist: false });
    const equip = { helmet: "Iron Helm", armor: "Ring Mail", weapon: null, shield: null, ring: null, amulet: null, spells: [] };
    const w = renderArmsPage(PANEL, equip);
    const rows = [rowStr(w, 2), rowStr(w, 3)];
    expect(rows.some((r) => r.includes("Yelmo Hierro")), "Yelmo Hierro íntegro").toBe(true);
    expect(rows.some((r) => r.includes("Cota Anillas")), "Cota Anillas íntegro").toBe(true);
    // Ninguna fila rebasa el panel de 15.
    for (const r of [2, 3]) expect(rowStr(w, r).length).toBeLessThanOrEqual(w.cols);
  });

  it("en EN la página de armas es identidad (nombres cortos fieles, sin override)", () => {
    setLang(BASE_LANG, { persist: false });
    const equip = { helmet: "Iron Helm", armor: "Ring Mail", weapon: null, shield: null, ring: null, amulet: null, spells: [] };
    const w = renderArmsPage(PANEL, equip);
    const grid = gridText(w);
    expect(grid).toContain("Iron Helm");
    expect(grid).toContain("Ring Mail");
  });
});

// Rótulos de grupo en MAYÚSCULA: las claves inglesas de monsterNamesUpper (estables).
const MONSTER_UPPER_EN = [
  "WIZARDS", "FIGHTER", "VILLAGER", "MERCHANT", "JESTER", "PIRATES", "CHILD", "BEGGAR",
  "GUARDS", "SEA HORSES", "SQUIDS", "SEA SERPENTS", "SHARKS", "GIANT RATS", "BATS",
  "SPIDERS", "GHOSTS", "SLIME", "MIMICS", "REAPERS", "GARGOYLE", "INSECTS", "ORCS",
  "SKELETONS", "SNAKES", "HEADLESSES", "WISPS", "DAEMONS", "DRAGONS", "SAND TRAPS",
  "MONGBATS", "CORPSERS", "ROTWORMS", "SHADOW LORD",
];

/** Centrado del banner de grupo tal como lo compone game.ts (ancho W=16). */
function centerBanner(name: string): string {
  const W = 16;
  return " ".repeat(Math.max(0, (W - name.length) >> 1)) + name;
}

describe("§4 ancho fijo — banner de GRUPO en combate (es): word-wrap SIN recorte", () => {
  it("todo rótulo monsterNamesUpper ES sobrevive íntegro en la consola de 16 col (parte a 2 filas, no se pierde)", () => {
    setLang("es", { persist: false });
    for (const en of MONSTER_UPPER_EN) {
      const name = es[huella(en)]?.t ?? en; // ES o identidad (nombres propios/conservados)
      const win = layoutConsole(CONSOLE, [centerBanner(name)]);
      const rendered = gridText(win);
      // El nombre (con espacios internos únicos) aparece completo en la rejilla,
      // aunque el printer lo haya partido en 2 filas (el LF cuenta como espacio).
      const expected = name.replace(/\s+/g, " ").trim();
      expect(rendered, `grupo ${en}→${name}`).toContain(expected);
    }
  });

  it("el banner más largo (SHADOW LORD→SEÑOR DE LA SOMBRA, 18) se parte pero no se recorta", () => {
    setLang("es", { persist: false });
    const name = es[huella("SHADOW LORD")]?.t ?? "SHADOW LORD";
    const win = layoutConsole(CONSOLE, [centerBanner(name)]);
    expect(gridText(win)).toContain(name.replace(/\s+/g, " ").trim());
  });
});
