/**
 * CARGA OPCIONAL DE ASSETS EXTRAÍDOS — para tests que sólo pueden correr con la copia
 * del juego del propio usuario.
 *
 * 🔴 EL DEFECTO QUE ORIGINA ESTE FICHERO (medido el 2026-08-05, corriendo el génesis
 * público POR PRIMERA VEZ): `game/assets/` NO viaja al repositorio público —son datos
 * derivados del binario de EA y esa exclusión es correcta y no se toca— pero dos tests
 * lo importaban con un `import … from "../assets/npcs.json"` ESTÁTICO. Resultado: el
 * árbol público **no compilaba**. `npx tsc --noEmit` sobre el repo recién clonado daba
 * **2 errores TS2307** antes de que nadie escribiera una línea.
 *
 * Y eso no es un rojo cualquiera: `tsc` es lo PRIMERO que corre quien clona un proyecto
 * que se presenta como «reimplementación verificable». Un repositorio cuyo argumento es
 * la comprobabilidad y que no pasa su propia comprobación **invierte el argumento**, que
 * es exactamente lo que ya nos pasó con el enlace roto de la portada.
 *
 * LA SOLUCIÓN NO ES SACAR LOS TESTS DEL REPO PÚBLICO. Esconderlos dejaría al lector sin
 * ver qué se comprueba, que es justo lo que fue a mirar. Se cargan en TIEMPO DE
 * EJECUCIÓN: con los ficheros presentes (nuestro árbol) corren igual que siempre; sin
 * ellos (el público) el test se salta con un motivo legible.
 *
 * ⚠️ Un `skip` es indistinguible de un verde en el recuento, así que `describeConAssets`
 * IMPRIME el motivo por consola la primera vez. Un test que no corre y no lo dice es la
 * forma más barata de perder cobertura sin enterarse.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

// 🔴 `fileURLToPath(new URL(<rel>, import.meta.url))` NO SE PUEDE USAR AQUÍ, y su modo de
// fallo no nombra la causa. Vite reescribe el patrón `new URL(<literal>, import.meta.url)`
// como REFERENCIA A UN ASSET; en `environment: node` la reescritura resuelve a un `file:`
// y todo parece bien, pero en los ficheros `// @vitest-environment jsdom` la transformación
// es la WEB y el mismo literal sale como `http://localhost:3000/assets` → `fileURLToPath`
// lanza `TypeError: The URL must be of scheme file` señalando ESTE fichero, en carga de
// módulo, con lo que el test importador cae ENTERO sin decir por qué (medido el 25-08 con
// `dungeon-botonera`, que es jsdom). `dirname(fileURLToPath(import.meta.url))` + `join`
// hace lo mismo sin tocar el patrón que Vite intercepta.
const AQUI = dirname(fileURLToPath(import.meta.url));

/** Raíz de `game/assets` resuelta desde este fichero (no desde el cwd, que varía). */
const RAIZ_ASSETS = join(AQUI, "..", "assets") + "/";

/** Raíz del REPOSITORIO (game/tests → game → raíz), por la misma razón. */
const RAIZ_REPO = join(AQUI, "..", "..") + "/";

/** ¿Está el asset extraído disponible en este árbol? */
export function hayAsset(nombre: string): boolean {
  return existsSync(RAIZ_ASSETS + nombre);
}

/**
 * Lee un asset extraído. Lanza si no está: el llamador debe haber comprobado con
 * `hayAsset` o estar dentro de un `describeConAssets`. Fallar ruidosamente es
 * deliberado — devolver `{}` daría tests verdes sobre datos vacíos.
 */
export function leeAsset<T = unknown>(nombre: string): T {
  const ruta = RAIZ_ASSETS + nombre;
  if (!existsSync(ruta)) {
    throw new Error(
      `falta ${nombre}: este test necesita los assets extraídos de TU copia del juego ` +
        `(game/assets/). No viajan al repositorio público — ver docs/publicacion.`,
    );
  }
  return JSON.parse(readFileSync(ruta, "utf8")) as T;
}

let avisado = false;

/**
 * `describe` que se SALTA (con motivo visible) cuando falta algún asset requerido.
 * En nuestro árbol corre exactamente igual que un `describe` normal.
 */
export function describeConAssets(
  requeridos: readonly string[],
  titulo: string,
  cuerpo: () => void,
): void {
  const faltan = requeridos.filter((a) => !hayAsset(a));
  if (faltan.length === 0) {
    describe(titulo, cuerpo);
    return;
  }
  if (!avisado) {
    avisado = true;
    // eslint-disable-next-line no-console
    console.warn(
      `\n⚠️  Tests SALTADOS por falta de assets extraídos (${faltan.join(", ")}).\n` +
        `   Es lo esperado en el repositorio público: game/assets/ sale de TU copia del\n` +
        `   juego y no se distribuye. Con los ficheros presentes, estos tests corren.\n`,
    );
  }
  describe.skip(`${titulo} [SALTADO: faltan ${faltan.join(", ")}]`, cuerpo);
}

/**
 * ═══ MATERIAL QUE NO VIAJA, EN GENERAL (no sólo `game/assets/`) ═══════════════════════
 *
 * `describeConAssets` cubre un caso: assets extraídos. Pero el criterio de `test:pure` NO
 * es «sin assets» sino «sin NINGÚN fichero que la whitelist del génesis deje fuera»
 * (`vitest.pure.config.ts`, cabecera). Fuera de la whitelist hay además:
 *   · `original/` (la copia del juego del usuario y su material A/V de referencia)
 *   · `re/disasm/*.asm` (el EA-material check del génesis los prohíbe explícitamente)
 *   · `docs/mejoras/`, `docs/publicacion/` (proceso interno)
 *   · `game/e2e/{grandtour,espejo-tour}/saves/` (checkpoints en formato SAVED.GAM de 1988)
 *
 * 🔴 EL PROBLEMA QUE ESTE HELPER RESUELVE Y `existsSync` A SECAS NO. Un `skipIf(!existe)`
 * es correcto en el árbol público y **PELIGROSO en el nuestro**: en un worktree con la
 * receta de symlinks de la REGLA 2 incompleta, el material tampoco está, y el test se
 * saltaría EN SILENCIO justo en el árbol donde su ausencia es un defecto que hay que
 * arreglar. Los dos árboles se distinguen y las dos ausencias son cosas distintas:
 *
 *   ausencia + árbol PÚBLICO  ⇒ SKIP con motivo visible (es lo esperado y correcto)
 *   ausencia + árbol PRIVADO  ⇒ **UN ROJO** que nombra la REGLA 2 (tu receta está coja)
 *
 * ★ EL DISCRIMINANTE ES `docs/publicacion/`, y no es una heurística: ese directorio es el
 *   ENSAMBLADOR del génesis y está excluido de su propia whitelist POR DISEÑO
 *   (`genesis-publico.sh`, bloque «EXCLUIDOS deliberadamente»), así que no puede existir
 *   en el árbol público. Y es tracked, así que existe en TODO checkout privado —
 *   incluido el worktree recién abierto al que le falten todos los symlinks, que es
 *   precisamente el caso que hay que poder distinguir.
 */
export const ARBOL_PUBLICO = !existsSync(RAIZ_REPO + "docs/publicacion");

/** Las rutas (relativas a la RAÍZ del repo) que no están en este árbol. */
export function faltanFicheros(rutas: readonly string[]): string[] {
  return rutas.filter((r) => !existsSync(RAIZ_REPO + r));
}

/**
 * `describe` para un bloque que necesita material que NO viaja al repositorio público.
 * Con el material presente corre exactamente igual que un `describe` normal.
 *
 * `rutas` van RELATIVAS A LA RAÍZ del repo (`original/…`, `re/disasm/X.asm`,
 * `game/assets/…`, `docs/mejoras/…`) — la misma forma en que las nombra la whitelist del
 * génesis, para que se puedan carear a ojo contra ella.
 *
 * 🔴 LO QUE ESTE HELPER **NO** PROTEGE, Y SE LEE COMO QUE SÍ (medido el 25-08, carril
 * `corpus-sintetico-espejo`, con una sonda de dos `describe`): **`describe.skip` EJECUTA su
 * cuerpo al recolectar** — registra los `it` como saltados, pero el callback corre igual. Así
 * que un `readFileSync`/`readdirSync` del material que falta puesto DENTRO del cuerpo de un
 * `describeSiViaja` (o de un `describe` normal) sigue lanzando ENOENT en el árbol público, y
 * tumba el FICHERO ENTERO en colección — incluidos los `it` puros que no tocaban nada. El
 * envoltorio no difiere la lectura: sólo decide si los `it` corren.
 * ⇒ La lectura del material va SIEMPRE dentro del callback de un `it`, o en una función
 * perezosa (memoizada) invocada desde dentro. Es la misma clase de defecto que la lectura en
 * carga de módulo, un nivel más abajo, y engaña más porque el `describeSiViaja` de al lado
 * parece haberse hecho cargo.
 */
export function describeSiViaja(
  rutas: readonly string[],
  titulo: string,
  cuerpo: () => void,
): void {
  const faltan = faltanFicheros(rutas);
  if (faltan.length === 0) {
    describe(titulo, cuerpo);
    return;
  }
  if (ARBOL_PUBLICO) {
    if (!avisado) {
      avisado = true;
      // eslint-disable-next-line no-console
      console.warn(
        `\n⚠️  Tests SALTADOS por falta de material que no se distribuye (${faltan.join(", ")}).\n` +
          `   Es lo esperado en el repositorio público. Con los ficheros presentes, corren.\n`,
      );
    }
    describe.skip(`${titulo} [SALTADO: no viaja al público — ${faltan.join(", ")}]`, cuerpo);
    return;
  }
  // Árbol PRIVADO: la ausencia es un defecto del árbol, y se cobra como UN rojo que
  // nombra la causa — no como N rojos por aserto que imitan una regresión propia
  // (REGLA 2: «el enlace que falta no aborta, DEGRADA»).
  describe(titulo, () => {
    it(`❌ FALTA material local: ${faltan.join(", ")}`, () => {
      throw new Error(
        `Falta ${faltan.join(", ")} en un árbol PRIVADO (existe docs/publicacion/).\n` +
          `Esto NO es el repositorio público: es tu receta de symlinks de la REGLA 2 ` +
          `incompleta. Son CUATRO symlinks + los .asm UNO A UNO + las TRES copias de ` +
          `espejo-tour. Un skip aquí sería un verde vacuo.`,
      );
    });
  });
}

