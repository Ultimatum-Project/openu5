/** Tipos del veredicto de los cinco sellos (`veredicto_sellos.mjs`), para que el gate de
 *  tipos de `game/` pueda importarlo desde `tests/sellos-puerta.test.ts` sin `any` implícito.
 *  El .mjs es la fuente; esto sólo declara su superficie pública. */

/** Un sello: el segmento, en qué parte y corpus vive, y su delta PUBLICADO por el acta. */
export interface Sello {
  parte: string;
  corpus: "ad" | "lp1";
  /** el valor de las actas que cerraron el delta — NO el del corpus */
  esperado: number;
  /**
   * El sello está ROTO HOY por una causa YA ADJUDICADA. El `esperado` NO se re-basa (eso
   * consagraría el defecto y pondría la puerta roja el día que se arregle); la rotura viva se
   * anota aquí para que el veredicto pueda distinguir «sigue siendo la conocida» de «hay una
   * NUEVA encima», y para que se retire sola cuando el sello vuelva a pagar.
   */
  roturaConocida?: {
    /** el valor que da HOY, medido y declarado */
    got: number;
    causa: string;
    /** la ficha donde vive la adjudicación */
    ficha: string;
    /**
     * `YYYY-MM-DD` — hasta cuándo se TOLERA (la puerta no bloquea, sólo grita). Vencida, el
     * sello vuelve a BLOQUEAR aunque el valor siga siendo el conocido. Sin este campo la
     * rotura se tolera indefinidamente, que es como «conocida» se vuelve permiso permanente.
     */
    caduca?: string;
  };
}

export const SELLOS: Record<string, Sello>;

/** Partes que hay que correr para cubrir los cinco sellos, cada una con su corpus. */
export function partesNecesarias(): Array<{ parte: string; corpus: "ad" | "lp1" }>;

export type EstadoSello =
  | "INTACTO"
  /** el port dio otro número (o el contador es ilegible) */
  | "ROTO"
  /** el CORPUS espera algo distinto de lo publicado: el verde no sería comparable */
  | "PORTERIA-MOVIDA"
  /** la parte corrió pero el segmento no armó la transacción */
  | "AUSENTE"
  /** la parte no está en los reports: el sello NO se ha medido */
  | "SIN-CORRER"
  /** roto por la causa YA adjudicada y DENTRO de caducidad: NO bloquea, pero no es verde */
  | "ROTO-CONOCIDO"
  /** la rotura sigue siendo la conocida pero su caducidad VENCIÓ: vuelve a bloquear */
  | "ROTO-CONOCIDO-CADUCADO"
  /** roto con un valor que NO es ni el publicado ni el conocido: hay algo NUEVO encima */
  | "ROTO-NUEVO";

export interface FilaSello extends Sello {
  seg: string;
  estado: EstadoSello;
  got: number | null;
  expected: number | null;
  ok: boolean;
  /**
   * ¿Debe PARAR el aterrizaje? Distinto de `ok`: una rotura registrada dentro de caducidad es
   * `ok: false` (no es verde) y `bloquea: false` (no acusa a este diff). Default DENY: si no
   * se declara, todo lo que no está `ok` bloquea.
   */
  bloquea: boolean;
  /** días que le quedan a la caducidad (negativo = vencida); null si no la hay */
  diasCaducidad?: number | null;
  /** cuántas corridas se han visto para este sello */
  replicas: number;
  detalle?: string;
  /** la línea `LEDGER-DELTA txn: …` del PROPIO runner, copiada sin reclasificar */
  linea?: string | null;
}

/**
 * Veredicto PURO. `reports` = `Map<parte, report | report[]>` — un array son RÉPLICAS de la
 * misma parte. Devuelve una fila por sello de la tabla, haya corrido lo que haya corrido.
 */
export function veredicto(
  reports: Map<string, unknown>,
  /** se INYECTA para que los tests de caducidad no dependan del reloj de pared */
  hoy?: Date,
  /**
   * la TABLA de sellos. Default = `SELLOS` (producción). Se inyecta sólo en tests: desde que
   * murió la última `roturaConocida` viva (`ad06-g34`, 2026-08-05), la maquinaria del EXIT 5
   * no tiene ningún caso real que la ejercite, y atarla a la tabla de producción obligaría a
   * MANTENER UNA DEUDA ABIERTA para poder probarla.
   */
  sellos?: Record<string, Sello>,
): { filas: FilaSello[]; ok: boolean; bloquea: boolean };

/**
 * Carga los `*.report.json` de uno o VARIOS dirs (un dir por réplica), EXCLUYENDO los
 * anteriores a `desde` (guarda de procedencia).
 */
export function cargar(
  dirs: string | readonly string[],
  desde: Date,
): { reports: Map<string, unknown>; rancios: string[] };
