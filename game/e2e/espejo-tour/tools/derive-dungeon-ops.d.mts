/**
 * Declaraciones de tipos para derive-dungeon-ops.mjs (paso OFFLINE de la FASE 3a). El tool corre
 * como node plano (sin build); este sidecar da tipos a los unit tests, igual que
 * derive-anchors.d.mts.
 */

/** Dirección del prompt «Dir-» del (S)earch/(L)ook 3D (DS 0x84f2/0x84fa/0x8500/0x8508). */
export type DngDir = "ahead" | "here" | "left" | "right";

/** Op de interior que el runner sabe conducir por teclas reales del pasillo (ver runDungeonOp). */
export interface DngOp {
  dng: string;
  dir?: string;
}

/** Entrada del vocabulario CERRADO del pasillo: eco canónico del port → op. */
export interface VocabEntry {
  echo: string;
  words: number;
  op: DngOp;
}

export const DUNGEON_VOCAB: readonly VocabEntry[];
export const DUNGEON_RESULTS: readonly string[];
export const MIN_SIM: number;
export const MIN_MARGIN: number;

/** Pliega a `[a-z]` los sumideros de OCR del corpus (0/6/c→o, 1/l/|/]/[/!→i, 5/8/g→s, v/y→u). */
export function foldEcho(s: unknown): string;

/** Tokens legibles del eco: retira la segunda pasada fantasma (comillas internas) y `~:>`. */
export function echoTokens(text: unknown): string[];

/** Distancia de edición (Levenshtein) entre dos strings. */
export function editDistance(a: string, b: string): number;

/** Similitud normalizada 0..1 sobre el alfabeto plegado. */
export function echoSim(a: string, b: string): number;

/**
 * #55 — la COLA de roster que sigue al eco reconocido, o null si no la hay. Sonda de AUDITORÍA
 * del artefacto: no pasa por el guarda de `matchDungeonEcho`, así que un censo escrito sobre
 * ella no se absuelve solo.
 */
export function rosterTailOf(text: unknown): string | null;

/**
 * #66 — ops a las que el guarda de cola-de-roster NO se aplica, por ruling del lead. Van por
 * segmento + `ocrLn` (el literal NO es único en el corpus).
 */
export const ROSTER_TAIL_DEFERRED: ReadonlyArray<{
  seg: string;
  ocrLn: number;
  ticket: string;
  dng: string;
}>;

/**
 * Casa el encabezado de un `todo` contra el vocabulario cerrado (umbral + margen), o null.
 * `allowRosterTail` levanta SÓLO el guarda de #55 (para las diferidas de `ROSTER_TAIL_DEFERRED`).
 */
export function matchDungeonEcho(
  text: unknown,
  opts?: { allowRosterTail?: boolean },
): { op: DngOp; echo: string; sim: number; consumed: number } | null;

/** Dirección del prompt «Dir-» si es legible en el beat; null si no (no se inventa). */
export function dirFromEcho(text: unknown): DngDir | null;

/**
 * ¿pasillo puro, MIXTO (pasillo + sala: se abre desde 3c), sala PURA (sin pasillo que conducir)
 * o no clasificable?
 */
export function classifyDungeonSegment(seg: {
  script?: ReadonlyArray<Record<string, unknown>>;
  expect?: ReadonlyArray<{ text?: string }>;
}): { kind: "corridor" | "mixed" | "room-combat" | "unclear"; navHits: number; roomHits: number };

/**
 * #54 — LA FAMILIA DE LA RE-LECTURA FANTASMA. Estaba ENTERA fuera del sidecar (las cuatro), así
 * que los unit tests que las tocan corrían sin tipos y el `.d.mts` mentía por omisión sobre la
 * superficie del módulo. Se declaran las cuatro juntas a propósito: declarar sólo una deja la
 * familia incompleta y el hueco vuelve a ser invisible al siguiente censo.
 */

/** ¿Lleva el texto la firma de segunda pasada (comilla interna, `/[^\s"]"[^\s"]/`)? */
export const hasGhostSignature: (s: unknown) => boolean;

/** Quita los tokens de re-lectura, igual que `stripGhostPass` de `ocr-profile.ts`. */
export function stripGhostTokens(text: unknown): string;

/**
 * ¿El residuo tras el strip es SÓLO el eco del comando, sin contenido de juego? Se mide por
 * palabras alfabéticas de ≥4 letras que no pertenezcan al propio eco reconocido.
 *
 * ⚠ La entrega 2 (`0a3ffd5e`) cambió los DOS lados de esa medida y este sidecar no se enteró:
 * las palabras se pliegan con `foldBare` (= `FOLD` + `a↔u`, LOCAL a esta comparación — el `FOLD`
 * compartido NO se toca) y las que no tienen VOCAL se descartan como ruido de la cola fantasma.
 */
export function isBareEcho(raw: unknown, matchedFrom: unknown): boolean;

/** ¿Es la op ya casada a `m` una RE-LECTURA fantasma de `prev`? Las CINCO condiciones necesarias. */
export function isGhostReread(
  m: { op: DngOp; echo: string; sim: number; consumed: number },
  raw: string,
  ocrLn: number | undefined,
  prev: { dng?: string; from?: string; ocrLn?: number } | null | undefined,
): boolean;

/** ¿Es `id` una MAZMORRA del port (33..40 = 0x21..0x28, el rango de SJOG.OVL 0x137a)? */
export function isDungeonLoc(id: unknown): boolean;

/** Convierte los `todo` de interior en ops `{dng}` (idempotente); devuelve script + censo. */
export function deriveDungeonOps(seg: { id?: string; script?: ReadonlyArray<Record<string, unknown>> }): {
  script: Array<Record<string, unknown>>;
  stats: {
    converted: number;
    kept: number;
    pendingGem: number;
    divergenceCandidate: number;
    needDirSkipped: number;
    /**
     * #54 — ops RETIRADAS por re-lectura fantasma. Faltaba en este sidecar desde que #54 la
     * añadió: `deriveDungeonOps` la devuelve, pero cualquier `.ts` que la leyera no compilaba
     * (así se destapó, midiendo los latentes E-2). ⚠ Es un contador de DETECCIONES, no de
     * escrituras: `enrichPart` sólo procesa `ctx` `dungeon`/`post-combat`, así que lo que dispara
     * en otros `ctx` no llega al artefacto (`re/notes/latentes-e2-acta.md` §1).
     */
    ghostReread: number;
    /** #66 — ops de cola-de-roster CONSERVADAS por estar en `ROSTER_TAIL_DEFERRED`. */
    rosterTailDeferred: number;
  };
};

/** Costura de entrada de un segmento (subconjunto que la resolución de mazmorra necesita). */
export interface SegEnterLike {
  loc?: number | null;
  banner?: string;
  overworld?: boolean;
  shrine?: string;
  dungeon?: boolean;
  carryover?: boolean;
  dungeonFrom?: string;
}
export interface RouteLike {
  segments?: ReadonlyArray<{ id?: string; ctx?: string; enter?: SegEnterLike }>;
}

/** Mazmorra de un `ctx:"dungeon"`: banner propio → precedente → única de la ruta, o null. */
export function resolveSegmentDungeon(route: RouteLike, segIndex: number): { id: number; how: string } | null;

/** ¿Declara este segmento que la party está FUERA de la mazmorra (salida/santuario/otro banner)? */
export function leavesDungeon(seg: { enter?: SegEnterLike } | undefined): boolean;

/**
 * FASE 3d — mazmorra de un `post-combat` por retroceso ESTRICTO: para en cuanto un segmento
 * declara una salida (`leavesDungeon`), y no acepta el atajo «única mazmorra de la ruta».
 */
export function resolveDungeonForPostCombat(route: RouteLike, segIndex: number): { id: number; how: string } | null;

/**
 * Las TRES RANURAS NEUTRAS del `ctx` — las costuras que NO declaran dónde está la party
 * (`post-combat` ← VICTORY, `resume` ← acampada, `start` ← arranque de episodio). Es el dominio
 * del escritor además de `ctx:"dungeon"`. Ver el JSDoc del `.mjs`.
 */
export const CTX_NEUTRO: ReadonlySet<string>;

/**
 * Desambigua las DOS causas que `resolveDungeonForPostCombat` devuelve como el mismo `null`:
 * `fuera` (se cruzó una salida, o no hay nada detrás ⇒ no es interior) e `indeterminable`
 * (la visita existe pero su costura `dungeon-enter` no dejó una loc 33..40 ⇒ es interior y lo
 * que falta es el ID). Sólo la segunda merece razón declarada, y ninguna de las dos se deriva.
 */
export function neutralInteriorProbe(
  route: RouteLike,
  segIndex: number,
): { kind: "dentro"; id: number; how: string } | { kind: "indeterminable"; desde: string | undefined; banner: string | null } | { kind: "fuera" };

/**
 * ★★ El enriquecedor PURO sobre el objeto (MUTA `route`, no toca disco). Existe para que un
 * guarda pueda preguntar «¿está este corpus en el PUNTO FIJO del derivador?» sin escribir los
 * ficheros: correr el CLI desde un test bloquearía el RPC de vitest (`spawnSync`) y además
 * contaminaría a cualquier otro carril que esté midiendo sobre el mismo árbol.
 */
export function enrichRoute(
  route: unknown,
  opts?: { open?: boolean },
): { rows: Array<Record<string, unknown>>; total: Record<string, number> };
