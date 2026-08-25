/** Tipos del detector de alcance (`alcance_sellos.mjs`), para que el gate de tipos de `game/`
 *  pueda importarlo desde `tests/sellos-puerta.test.ts` sin `any` implícito.
 *  El .mjs es la fuente; esto sólo declara su superficie pública. */

/** Puntos de entrada del arnés: lo que playwright carga para correr una parte del espejo. */
export const ENTRADAS: readonly string[];

/** Datos que el arnés lee POR RUTA (ningún cierre de imports los alcanza). */
export const DATOS: ReadonlyArray<{ glob: string; porque: string }>;

/** Ficheros que gobiernan cómo se construye/sirve/configura la corrida. */
export const CONFIG: readonly string[];

export type Tramo = "T1 ARNÉS-CÓDIGO" | "T2 ARNÉS-DATOS" | "T3 PORT";

/** Cierre transitivo de imports desde `entradas` (rutas relativas a `raiz`). */
export function cierreDeImports(
  raiz: string,
  entradas: readonly string[],
): { ficheros: Set<string>; sinResolver: string[] };

/** Clasifica UN fichero cambiado; `null` = fuera de alcance. */
export function clasifica(
  fichero: string,
  opts: { cierre: Set<string>; soloArnes: boolean },
): { tramo: Tramo; porque: string } | null;

export function analiza(
  raiz: string,
  ficheros: readonly string[],
  opts?: { soloArnes?: boolean },
): {
  dentro: Array<{ fichero: string; tramo: Tramo; porque: string }>;
  fuera: string[];
  cierre: Set<string>;
  sinResolver: string[];
};

/**
 * Normaliza un rango de commits a semántica de MERGE-BASE (tres puntos). Dos puntos compara los
 * dos árboles y mezcla lo que cambió main: da falsos positivos y, peor, FALSOS NEGATIVOS.
 */
export function normalizaRango(rango: string): { rango: string; aviso: string | null };

/**
 * Guarda de PROCEDENCIA para las listas que llegan sin rango (`--stdin`, `--ficheros`), que es
 * por donde `normalizaRango` no pasa. Devuelve los ficheros que NO están en
 * `merge-base(HEAD, ref)..HEAD` ni sucios en el árbol — es decir, los que vienen de otro trabajo.
 * `comprobable: false` cuando no hay `ref` con la que sacar merge-base: entonces NO acusa.
 */
export function auditaProcedencia(
  raiz: string,
  ficheros: readonly string[],
  ref?: string,
): { comprobable: boolean; base: string | null; ajenos: string[] };
