/**
 * LOS DOS CORPUS DEL ESPEJO, VISTOS DESDE LOS TESTS — y la frontera entre ellos.
 *
 * ── EL PROBLEMA QUE ESTE FICHERO NOMBRA ──────────────────────────────────────────────────
 * `game/e2e/espejo-tour/routes{,-ad,-lf}/` llevan la prosa TLK de EA verbatim en sus bloques
 * `expect[].text` (#376: 17.030 palabras en 1.677 rachas de ≥8 palabras). Están fuera del
 * índice desde entonces y, desde el tren #145, el génesis tampoco los copia. Consecuencia
 * medida: **17 ficheros de test** salieron del CI del repositorio público — y al abrirlos uno
 * a uno resultó que **la mayoría de sus bloques no examina la prosa, sino el CURADOR**.
 *
 * ── LA FRONTERA, QUE ES LO ÚNICO QUE HAY QUE DECIDIR AL ESCRIBIR UN TEST DEL ESPEJO ──────
 *   · ¿Lo que asiertas es una propiedad de la HERRAMIENTA o del FORMATO? («un segmento con
 *     `skip` planifica nav-only», «una costura de salida al Underworld cierra el interior»,
 *     «re-derivar no mueve un byte», «el `insertOps` aterriza en este índice») ⇒ va contra
 *     `SINT_DIR`, corre en TODAS partes y **no se excluye de `test:pure`**.
 *   · ¿Lo que asiertas es un hecho del CORPUS REAL? (un cardinal calibrado —63 campos, 2637
 *     claves, 310 ops—, una lista de ids por identidad, un `ocrLn` concreto, un importe del
 *     LP) ⇒ va contra `routes/`/`routes-ad/` y se envuelve en `describeCorpusReal`, que lo
 *     SALTA con motivo visible en el árbol público y lo corre en el nuestro.
 *
 * 🔴 El error a evitar es el simétrico del que se arreglaba: mover un censo del corpus real al
 * sintético NO recupera cobertura, la FALSIFICA. El esperado lo escribiríamos nosotros en el
 * mismo fichero que el sujeto, y el aserto pasaría con la herramienta rota.
 * [[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]
 */
import { describeSiViaja } from "./assets-opcionales";
export { ROUTES_DIR, ROUTES_AD_DIR, ROUTES_SINT_DIR } from "../e2e/espejo-tour/runner";

/**
 * Las rutas (relativas a la RAÍZ del repo, como las nombra la whitelist del génesis) de los
 * DOS corpus reales. Un bloque que lea cualquiera de los dos las pide LAS DOS: la causa que se
 * declara es «el corpus del espejo no viaja», no «falta este directorio concreto».
 */
export const CORPUS_REAL = [
  "game/e2e/espejo-tour/routes",
  "game/e2e/espejo-tour/routes-ad",
] as const;

/**
 * `describe` de un bloque cuyo SUJETO es el corpus REAL del espejo. En nuestro árbol corre
 * igual que un `describe`; en el público se salta nombrando el motivo; en un worktree privado
 * con la receta de symlinks coja da UN rojo que nombra la REGLA 2 (no N rojos por aserto que
 * imitan una regresión propia). Todo eso lo hace ya `describeSiViaja`: esto sólo le fija la
 * lista de rutas para que no se copie mal en cada fichero.
 */
export function describeCorpusReal(titulo: string, cuerpo: () => void): void {
  describeSiViaja(CORPUS_REAL, titulo, cuerpo);
}

/** Las seis partes del corpus SINTÉTICO, en orden de cadena. Escritas EN CRUDO y no leídas del
 *  directorio a propósito: un test cuyo denominador sale del propio sujeto pasa en vacío el día
 *  que el directorio se vacíe. [[un-censo-nunca-lleva-2-dev-null]] */
export const PARTES_SINT = [
  "sint01",
  "sint02",
  "sint03",
  "sint04",
  "sint05",
  "sint06",
] as const;
