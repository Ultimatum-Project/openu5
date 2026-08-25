/**
 * CONSENTIMIENTO DE DOS NIVELES — modelo PURO (sin DOM, sin red, sin globals).
 *
 * Diseño: docs/superpowers/specs/2026-08-04-lanzamiento-e-instrumentacion-design.md
 * (carril 1). Dos permisos SEPARADOS, los dos APAGADOS por defecto:
 *
 *   1. «Analítica anónima»  — visitas, procedencia, embudo del BYO.
 *   2. «Guardar mi partida» — el registro de teclas (repetición + tabla de récords).
 *      Se presenta como FUNCIÓN DEL JUEGO, no como analítica: se ofrece algo a
 *      cambio del permiso.
 *
 * 🔴 EL INVARIANTE DE ESTE MÓDULO: **sin decisión = sin permiso**. `leer()` devuelve
 * `null` cuando el visitante todavía no ha elegido (o cuando lo guardado está
 * corrupto o es de una versión anterior del aviso), y TODOS los predicados de
 * permiso toman `Consentimiento | null` y contestan `false` al `null`. Así, un
 * fallo de lectura (JSON roto, localStorage bloqueado, cuota llena, versión nueva
 * del aviso) cae SIEMPRE del lado de no enviar nada — nunca del lado contrario.
 *
 * Estamos en la UE: el consentimiento es previo, explícito y revocable
 * (`revocar()` borra la elección y devuelve al estado «sin decidir»).
 */

/** Los dos niveles, con su nombre de campo. Ampliarlo obliga a subir VERSION. */
export type Nivel = "analitica" | "partida";
export const NIVELES: readonly Nivel[] = ["analitica", "partida"] as const;

/**
 * Versión del AVISO, no del código. Súbela cuando cambie QUÉ se envía o para qué:
 * un consentimiento guardado con versión distinta se descarta y se vuelve a pedir
 * (es exactamente lo que exige un consentimiento informado — lo informado cambió).
 */
export const VERSION_CONSENTIMIENTO = 1;

/** Clave en localStorage. Mismo prefijo que el resto del sitio (`openu5-lang`…). */
export const CLAVE_CONSENTIMIENTO = "openu5-consentimiento";

export interface Consentimiento {
  readonly version: number;
  readonly analitica: boolean;
  readonly partida: boolean;
  /** ISO-8601 del momento de la elección (prueba de cuándo se dio). */
  readonly fecha: string;
}

/** La elección del usuario, sin los metadatos que pone el propio módulo. */
export interface Eleccion {
  readonly analitica: boolean;
  readonly partida: boolean;
}

/** Lo mínimo de `Storage` que usamos — inyectable, para poder probarlo sin DOM. */
export interface AlmacenSimple {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

/** Estado de arranque: los dos niveles apagados. NO es un consentimiento dado. */
export const TODO_APAGADO: Eleccion = { analitica: false, partida: false };

/**
 * Lee la elección guardada. `null` = SIN DECIDIR ⇒ sin permiso para nada.
 *
 * Devuelve `null` (y no lanza) ante cualquier anomalía: almacén inaccesible
 * (Safari en privado lanza al leer), JSON inválido, forma inesperada, o versión
 * del aviso distinta de la vigente.
 */
export function leerConsentimiento(almacen: AlmacenSimple | null | undefined): Consentimiento | null {
  if (!almacen) return null;
  let crudo: string | null;
  try {
    crudo = almacen.getItem(CLAVE_CONSENTIMIENTO);
  } catch {
    return null; // almacén bloqueado ⇒ sin decisión ⇒ no se envía nada
  }
  if (!crudo) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const c = obj as Record<string, unknown>;
  if (c["version"] !== VERSION_CONSENTIMIENTO) return null; // aviso caducado: se re-pregunta
  if (typeof c["analitica"] !== "boolean" || typeof c["partida"] !== "boolean") return null;
  return {
    version: VERSION_CONSENTIMIENTO,
    analitica: c["analitica"],
    partida: c["partida"],
    fecha: typeof c["fecha"] === "string" ? c["fecha"] : "",
  };
}

/**
 * Guarda la elección (incluida la de RECHAZAR todo, que también es una decisión y
 * evita volver a preguntar). Devuelve lo que queda vigente en memoria aunque el
 * almacén falle: la sesión respeta la elección aunque no se pueda persistir.
 */
export function guardarConsentimiento(
  almacen: AlmacenSimple | null | undefined,
  eleccion: Eleccion,
  ahora: Date = new Date(),
): Consentimiento {
  const c: Consentimiento = {
    version: VERSION_CONSENTIMIENTO,
    analitica: eleccion.analitica === true,
    partida: eleccion.partida === true,
    fecha: ahora.toISOString(),
  };
  try {
    almacen?.setItem(CLAVE_CONSENTIMIENTO, JSON.stringify(c));
  } catch {
    /* cuota llena / modo privado: la elección vale igual en esta sesión */
  }
  return c;
}

/** Revoca: borra la elección y devuelve al estado «sin decidir» (todo apagado). */
export function revocarConsentimiento(almacen: AlmacenSimple | null | undefined): void {
  try {
    almacen?.removeItem(CLAVE_CONSENTIMIENTO);
  } catch {
    /* no hay nada que hacer y no debe romper la página */
  }
}

/** ¿Se puede enviar UN SOLO byte de analítica? Sin decisión ⇒ NO. */
export function permiteAnalitica(c: Consentimiento | null | undefined): boolean {
  return c?.analitica === true;
}

/** ¿Se puede subir el registro de teclas de la partida? Sin decisión ⇒ NO. */
export function permiteGuardarPartida(c: Consentimiento | null | undefined): boolean {
  return c?.partida === true;
}

/** La elección vigente como formulario (para pintar las casillas del panel). */
export function eleccionVigente(c: Consentimiento | null | undefined): Eleccion {
  return c ? { analitica: c.analitica, partida: c.partida } : TODO_APAGADO;
}
