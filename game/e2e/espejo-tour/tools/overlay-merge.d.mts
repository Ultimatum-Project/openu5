/**
 * Declaraciones de tipos para overlay-merge.mjs (fusión de patch regenerado sobre curación
 * manual). El tool corre como node plano (sin build); este sidecar da tipos a los unit tests,
 * igual que mkoverlay-lp1.d.mts.
 */

/** Una entrada de `insertOps`: un ancla por `ocrLn` y las ops que se insertan ahí. */
export interface InsertBlock {
  afterOcrLn: number;
  /** `"first"`: detrás de la PRIMERA racha que cumple el ancla, en vez de la última (#43 r3). */
  at?: "first";
  ops: Record<string, unknown>[];
}

/**
 * Patch de overlay para UN segmento.
 *
 * `false` es el TOMBSTONE (#43 ruling 2): «QUITA esta clave». No es exclusivo de `skip` —
 * `applyPatchKeys` lo honra en TODA clave de `PATCHABLE`—, así que los tipos lo admiten en todas
 * ellas. `anchor` queda fuera: es la HUELLA (#85), no una clave patchable.
 *
 * ⚠ `calib` es el caso degenerado: al ser booleana, un `calib: false` NO puede significar «vale
 * false», sólo «quítala». `seam: null`, en cambio, sí es un VALOR legítimo.
 */
export interface Patch {
  skip?: string | false;
  note?: string | false;
  policy?: string | false;
  anchor?: string;
  ctx?: string | false;
  enter?: Record<string, unknown> | false;
  seam?: string | null | false;
  calib?: boolean;
  insertOps?: InsertBlock[];
  [k: string]: unknown;
}

/**
 * Fusiona dos listas de `insertOps` por `afterOcrLn`, deduplicando ops por identidad estable.
 * Conserva el orden de anclas de `prev` y añade detrás las que sólo trae `next`.
 */
export function mergeInsertOps(prev?: InsertBlock[], next?: InsertBlock[]): InsertBlock[];

/**
 * Índice en el que aterriza un bloque `insertOps` anclado en `afterOcrLn` (#43 ruling 3).
 *
 * Por defecto conserva el barrido HISTÓRICO hacia atrás con `ocrLn ?? 0` — conceptualmente un
 * defecto (un `nav` sin `ocrLn` corta el barrido), pero es la conducta que los artefactos
 * encodan: reproduce 13 de los 14 bloques commiteados de LP1. `at: "first"` es el opt-in
 * explícito para anclar detrás de la PRIMERA racha que cumple.
 */
export function insertAt(
  out: { ocrLn?: number | null }[],
  afterOcrLn: number,
  at?: "first" | undefined,
): number;

/** Claves del segmento que el overlay puede fijar, en el orden en que `curate.mjs` las aplica. */
export const PATCHABLE: readonly string[];

/**
 * Aplica un patch sobre un segmento de ruta con LAS DOS POLARIDADES (#43 ruling 2):
 * clave ausente = «no opino» · `false` = TOMBSTONE («quítala») · cualquier otro valor = asignar.
 * `seam: null` es un VALOR legítimo, no un tombstone. Muta `seg` y lo devuelve.
 */
export function applyPatchKeys<T extends Record<string, unknown>>(
  seg: T,
  patch?: Patch,
  keys?: readonly string[],
): T;

/**
 * Patch regenerado sobre el curado a mano: `gen` manda en lo que emite, `prev` sobrevive en lo
 * que no, e `insertOps` se fusiona ENTRADA A ENTRADA (fusionar por clave pierde el `dismiss` de
 * `ad13-g21`, que comparte array con el `recruit`).
 */
export function mergePatch(prev?: Patch, gen?: Patch): Patch;

/** Un segmento de ruta tal y como lo ve la reconciliación (las claves PATCHABLE + el guion). */
export interface Segmento {
  id: string;
  script?: Record<string, unknown>[];
  expect?: Record<string, unknown>[];
  skip?: string | false;
  [k: string]: unknown;
}

/** Una `routes/<part>.route.json` cargada. */
export interface Ruta {
  segments: Segmento[];
  [k: string]: unknown;
}

/** Un `routes/overlays/<part>.json` cargado. */
export interface Overlay {
  segments?: Record<string, Patch>;
  [k: string]: unknown;
}

/** Un campo que una regeneración se llevaría por delante. */
export interface CampoPerdido {
  segId: string;
  clave: string;
  enRuta: unknown;
  enOverlay?: unknown;
  motivo: "BORRADO" | "PISADO";
}

/**
 * Diff de las claves PATCHABLE entre dos rutas, emparejando segmentos por `id`. Base del
 * cinturón de escritura de `apply-ledger-overlay.mjs` y de `camposEnRiesgo`. No mira el guion.
 */
export function camposPerdidos(antes: Ruta, despues: Ruta, keys?: readonly string[]): CampoPerdido[];

/**
 * Contrato del cinturón de `apply-ledger-overlay.mjs --claves`: `BORRADO` es FATAL siempre
 * (nombrar un segmento autoriza a FIJARLE claves, nunca a quitárselas) y sólo un `PISADO` de un
 * segmento NOMBRADO, con `claves` activo, se DECLARA y se aplica.
 */
export function clasificarPerdidas(
  perdidas: readonly CampoPerdido[],
  opts?: { segIds?: readonly string[]; claves?: boolean },
): { fatales: CampoPerdido[]; declarados: CampoPerdido[] };

/**
 * Qué campos perdería o pisaría una regeneración de `route` desde `overlay`. Aplica la MISMA
 * `applyPatchKeys` que `curate.mjs` sobre una copia — no es una réplica de curate, es curate.
 * `rancios`: ids que curate saltará por huella desalineada (#85); reportarlos sería falso positivo.
 */
export function camposEnRiesgo(
  route: Ruta,
  overlay?: Overlay,
  opts?: { rancios?: ReadonlySet<string> },
): CampoPerdido[];

/**
 * Claves que el CINTURÓN de escritura vigila: todas las que los segmentos de `ruta` llevan hoy,
 * menos `script`/`expect` (que el productor reconstruye por contrato) e `id` (clave de
 * emparejamiento). NO es `PATCHABLE`: se deriva del corpus para no quedarse atrás, y es completa
 * por construcción — una clave que no está en `antes` no puede perderse.
 */
export function clavesVigiladas(ruta: Ruta): string[];

/** Un ancla (o una clave suya) que una pasada sobre el GUION se llevaría por delante. */
export interface AnclaPerdida {
  segId: string;
  /** Índice del op dentro de `seg.script`; `-1` cuando el emparejamiento no fue posible. */
  opIndex: number;
  /** Sólo en `motivo: "CAMPO"`: la clave del ancla que se pierde (p. ej. `expectDelta`). */
  clave?: string;
  enRuta: unknown;
  enOverlay?: unknown;
  motivo: "BORRADA" | "CAMPO" | "GUION REDIMENSIONADO" | "SEGMENTO PERDIDO";
}

/**
 * Cinturón de la capa del GUION: anclas que `antes` lleva y `despues` no. Es la hermana de
 * `camposPerdidos` para el escritor que sólo toca `op.anchor` — `clavesVigiladas` EXCLUYE
 * `script`, así que aquel cinturón da 0 aunque la pasada destruya un ancla (medido sobre
 * `part04-g03`, `expectDelta:+36`). Empareja segmentos por `id` y ops por índice; un cambio de
 * VALOR en una clave que sigue estando no se reporta (es el productor re-derivando).
 */
export function anclasPerdidas(antes: Ruta, despues: Ruta): AnclaPerdida[];

/**
 * Ops `src:"overlay*"` de la ruta cuyo ancla `ocrLn` ya no existe en el overlay: `curate` retira
 * la familia entera y las repone desde `insertOps`, así que ésas se irían sin ruido.
 */
export function opsDeOverlayHuerfanas(
  route: Ruta,
  overlay?: Overlay,
): { segId: string; ocrLn: unknown; op: Record<string, unknown> }[];
