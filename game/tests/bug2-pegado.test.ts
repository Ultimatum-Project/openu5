/**
 * BUG 2 — «la UI del juego no sale pegada al lado» (carril `bug2-app`).
 *
 * QUÉ SE SELLA AQUÍ. La regla que deja de repartir el sobrante del hueco central y pega el
 * juego al raíl A. La GEOMETRÍA que resulta (hueco raíl↔juego = 0 en 852×330 franja 0, y el
 * espejo con el ⇄) no se finge en jsdom: se midió en navegador con
 * `tools/mobile-fixes/medir-pegado.ts` y las once escenas están en `re/notes/bug2-app-acta.md`.
 * Lo que sí es propiedad del TEXTO —y por tanto se puede sellar aquí— es dónde vive la regla,
 * a quién alcanza y a quién NO alcanza.
 *
 * 🔴 LOS DOS ASERTOS QUE NO SON DECORACIÓN, porque cada uno mata un fix que «funciona» en la
 * escena que uno mira y es mudo en otra que el jugador alcanza con un toque:
 *   · LAS TRES CLASES. El contenedor visible depende del LAYOUT, no de la orientación: con el
 *     botón ▤ en clásico se ve `.faithful-skin` (o `.shader-skin`) con este mismo CSS vivo.
 *     Medido, esa combinación daba 34 px por lado — MÁS que los 18,2 del informe. La lista se
 *     comprueba contra un CENSO del código, no contra sí misma (§«censo»).
 *   · EL HIJO DIRECTO. La piel alojada por el envoltorio partido cuelga de un host de 0×0 con
 *     su canvas aparcado en (−160,−100); un selector de descendiente la alcanzaría.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { layoutOriginalCss, layoutApaisadoCss } from "../src/skin/portrait/deck-ancho.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LAND = layoutApaisadoCss();
const ORIG = layoutOriginalCss();

/** Las reglas del CSS como pares (selector, cuerpo), con los comentarios ya fuera. */
function reglas(css: string): { sel: string; cuerpo: string }[] {
  const out: { sel: string; cuerpo: string }[] = [];
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const bloque of limpio.split("}")) {
    const i = bloque.indexOf("{");
    if (i < 0) continue;
    const sel = bloque.slice(0, i).trim();
    if (!sel) continue;
    out.push({ sel, cuerpo: bloque.slice(i + 1).trim() });
  }
  return out;
}

/** Reglas cuyo selector nombra alguna de las tres clases de contenedor de piel. */
function reglasDePiel(css: string): { sel: string; cuerpo: string }[] {
  return reglas(css).filter((r) => /-skin\b/.test(r.sel) && r.sel.includes("#app"));
}

const PIEL_BASE = reglasDePiel(LAND).filter((r) => !r.sel.includes('data-pad-side="right"'));
const PIEL_ESPEJO = reglasDePiel(LAND).filter((r) => r.sel.includes('data-pad-side="right"'));

describe("bug 2 — el juego pegado al raíl A", () => {
  it("la regla EXISTE y pega el juego al principio del hueco (raíl A a la izquierda)", () => {
    expect(PIEL_BASE.length).toBeGreaterThan(0);
    for (const r of PIEL_BASE) {
      expect(r.cuerpo).toMatch(/justify-content:\s*flex-start\s*!important/);
    }
  });

  it("EL ESPEJO (⇄) invierte el lado: con el raíl A a la derecha, el juego al final", () => {
    expect(PIEL_ESPEJO.length).toBeGreaterThan(0);
    for (const r of PIEL_ESPEJO) {
      expect(r.cuerpo).toMatch(/justify-content:\s*flex-end\s*!important/);
    }
    // Sin este aserto, un fix cableado a `flex-start` pasaría la escena por defecto y dejaría
    // el juego pegado al raíl EQUIVOCADO en cuanto el usuario toca el ⇄.
    for (const r of PIEL_ESPEJO) {
      expect(r.cuerpo).not.toMatch(/flex-start/);
    }
  });

  it("🔴 CENSO — la regla nombra TODOS los contenedores de piel que se centran, no sólo el del informe", () => {
    // El censo sale del CÓDIGO de las pieles, no de una lista escrita a mano: si mañana
    // aparece una cuarta piel con el mismo patrón (`className = "x-skin"` + `cssText` con
    // `justify-content:center`), este test se pone rojo NOMBRÁNDOLA en vez de dejar la regla
    // muda sobre ella.
    const FUENTES = [
      "../src/skin/fiel/skin.ts",
      "../src/skin/portrait/skin.ts",
      "../src/skin/shader/skin.ts",
      "../src/skin/dev/skin.ts",
    ];
    const censo = new Set<string>();
    for (const f of FUENTES) {
      let src: string;
      try {
        src = readFileSync(join(HERE, f), "utf8");
      } catch {
        continue; // piel jubilada: no es un fallo del carril
      }
      for (const m of src.matchAll(/className\s*=\s*"([a-z0-9-]+-skin)"/g)) {
        const clase = m[1]!;
        // El host de la piel alojada (`*-skin-src`) no cuenta: es de 0×0 y no se ve.
        if (clase.endsWith("-skin-src")) continue;
        // Sólo cuentan los que se CENTRAN: son los únicos que este fix tiene que desplazar.
        // Se BARREN LOS COMENTARIOS de la ventana antes de mirar: entre el `className` de
        // `portrait/skin.ts` y su `cssText` hay ocho líneas de comentario, y con la ventana
        // contándolas la piel del informe se quedaba FUERA de su propio censo.
        const cola = src
          .slice(m.index ?? 0, (m.index ?? 0) + 1600)
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        if (/justify-content:\s*center/.test(cola) && /width:\s*100%/.test(cola)) censo.add(clase);
      }
    }
    expect(censo.size).toBeGreaterThanOrEqual(3);

    const nombradas = new Set<string>();
    for (const r of reglasDePiel(LAND)) {
      for (const m of r.sel.matchAll(/\.([a-z0-9-]+-skin)\b/g)) nombradas.add(m[1]!);
    }
    // Cada piel del censo tiene que estar en la regla BASE **y** en la del ESPEJO: cubrir una
    // sola de las dos deja al ⇄ centrando esa piel.
    for (const clase of censo) {
      expect(nombradas, `la piel .${clase} se centra y la regla no la nombra`).toContain(clase);
      expect(PIEL_BASE.some((r) => r.sel.includes(`.${clase}`)), `.${clase} falta en la regla BASE`).toBe(true);
      expect(PIEL_ESPEJO.some((r) => r.sel.includes(`.${clase}`)), `.${clase} falta en el ESPEJO`).toBe(true);
    }
  });

  it("🔴 HIJO DIRECTO — ningún selector alcanza la piel ALOJADA (canvas aparcado en −160,−100)", () => {
    for (const r of reglasDePiel(LAND)) {
      for (const parte of r.sel.split(",")) {
        const s = parte.trim();
        if (!/-skin\b/.test(s)) continue;
        expect(s, `selector de descendiente: «${s}»`).toMatch(/#app\s*>\s*\.[a-z0-9-]+-skin/);
      }
    }
  });

  it("el `!important` sigue siendo NECESARIO: las tres pieles centran INLINE", () => {
    // Si un día dejaran de hacerlo, el `!important` sobraría — y eso hay que enterarse, no
    // heredarlo. Es el mismo motivo por el que existe el censo de arriba.
    for (const f of ["../src/skin/fiel/skin.ts", "../src/skin/portrait/skin.ts", "../src/skin/shader/skin.ts"]) {
      const src = readFileSync(join(HERE, f), "utf8");
      expect(src, `${f} ya no centra inline: revisar si el !important sigue haciendo falta`).toMatch(
        /cssText[\s\S]{0,400}justify-content:\s*center/,
      );
    }
  });

  it("🔴 EL VERTICAL ES INALCANZABLE POR CONSTRUCCIÓN, no por convenio", () => {
    // El contenedor de la piel es el MISMO objeto en las dos orientaciones. Lo que separa una
    // de otra es que TODO selector de este CSS lleva `[data-orient="landscape"]`; el aserto
    // recorre las reglas en vez de fiarse de que la nueva lo lleve.
    for (const r of reglas(LAND)) {
      for (const parte of r.sel.split(",")) {
        const s = parte.trim();
        if (!s || s.startsWith("@")) continue;
        expect(s, `selector sin ancla de orientación: «${s}»`).toContain('[data-orient="landscape"]');
      }
    }
    // Y el CSS del VERTICAL no toca el reparto de ninguna piel.
    expect(reglasDePiel(ORIG)).toHaveLength(0);
  });

  it("el eje VERTICAL se deja intacto a propósito (los 132,8 px del SE son otra decisión)", () => {
    // La banda de abajo del iPhone SE rotado es sobrante de ALTO y la gobierna `align-items`.
    // Este carril no la toca; si alguien mete un `align-items` aquí, que sea con su propia
    // medición y su propia acta, no de rebote.
    for (const r of reglasDePiel(LAND)) {
      expect(r.cuerpo, `esta regla toca el eje vertical: «${r.cuerpo}»`).not.toMatch(/align-items/);
    }
  });
});
