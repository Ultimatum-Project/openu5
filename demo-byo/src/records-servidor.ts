/**
 * PIEZAS DEL SERVIDOR de la tabla de récords: bindings, respuestas, límite de frecuencia
 * y las cuatro consultas de D1. **Sólo lo importan las Pages Functions**
 * (`demo-byo/functions/api/*`), nunca el bundle de la landing.
 *
 * Vive en `src/` y no dentro de `functions/` por la razón documentada de Pages: en
 * `functions/` el enrutado es POR FICHERO, así que todo lo que va ahí es una RUTA. El
 * código compartido se importa desde fuera (`pages/functions/module-support`: «import
 * { greeting } from "../src/greeting.ts"»). Que el proyecto de Pages sea `demo-byo/` es lo
 * que hace que ese import relativo funcione tal cual en el despliegue.
 *
 * ── EL SERVIDOR NO SABE JUGAR, Y ESO ES EL DISEÑO ────────────────────────────────────
 * No hay aquí ni una línea que intente decidir si un récord es cierto: verificarlo exige
 * ejecutar el motor, y ejecutarlo exige los datos de EA, que este servidor no tiene ni
 * tendrá (decisión D5 del diseño). Guarda, ordena y sirve; la verificación es entre pares.
 */
import {
  LIMITES,
  canonizaRecord,
  idDeRecord,
  sha256Hex,
  type RecordSubida,
} from "./records-formato.js";

/**
 * ── LOS TIPOS DE LOS BINDINGS, ESCRITOS AQUÍ Y NO IMPORTADOS ─────────────────────────
 * Son la porción de `@cloudflare/workers-types` que este código usa, y nada más. Se
 * escriben en vez de añadir la dependencia por dos razones: `npx tsc` sobre `demo-byo`
 * comprueba `src/` (este fichero) y no debería exigir un paquete de tipos de servidor para
 * validar una landing; y así queda escrito EXACTAMENTE qué superficie del binding se usa
 * —`get`/`put` y `prepare/bind/run/all`—, que es lo que hay que sustituir para probarlo
 * sin red (los dobles de `records-endpoints.test.ts` implementan justo esto).
 */
export interface KvRecords {
  get(clave: string): Promise<string | null>;
  put(clave: string, valor: string, opciones?: { expirationTtl?: number }): Promise<void>;
}
export interface D1Sentencia {
  bind(...args: unknown[]): D1Sentencia;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results?: T[] }>;
}
export interface D1Records {
  prepare(sql: string): D1Sentencia;
}

/**
 * Los dos bindings. Se declaran en `demo-byo/wrangler.toml` y se crean a mano UNA vez
 * (los pasos exactos están en ese fichero).
 */
export interface EntornoRecords {
  /** KV: el registro completo, `rec:<id>` → JSON canónico. */
  RECORDS_KV: KvRecords;
  /** D1: el índice ordenable. KV no sabe ordenar por turnos; de ahí las dos piezas. */
  RECORDS_DB: D1Records;
  /**
   * Sal del hash de IP del limitador. Secreto de despliegue (`wrangler pages secret put`).
   * Sin ella el limitador SIGUE funcionando pero guardaría un hash de IP sin sal, que es
   * reversible por fuerza bruta sobre 2^32 direcciones: eso es un dato personal guardado,
   * justo lo que este proyecto no hace. Sin sal ⇒ no se limita por IP y se dice en el log.
   */
  RECORDS_SAL?: string;
}

/** Fila del índice tal y como sale a la tabla. Es lo que la web pinta. */
export interface FilaTabla {
  id: string;
  alias: string;
  baseId: string;
  anclaHash: string;
  motor: string;
  turnos: number;
  teclas: number;
  /** LO QUE DIJO QUIEN SUBIÓ. Ver `records-formato.ts`. */
  desenlaceReclamado: boolean;
  creado: number;
}

export function json(datos: unknown, status = 200, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cabeceras },
  });
}

/** Error con el MOTIVO dentro. Un 400 sin motivo obliga a adivinar y se adivina mal. */
export function error(status: number, motivo: string): Response {
  return json({ error: motivo }, status);
}

/**
 * ── LÍMITE DE FRECUENCIA ─────────────────────────────────────────────────────────────
 * Contador por IP-con-sal y hora, en KV con `expirationTtl`: la clave se borra sola y no
 * hay nada que limpiar ni nada que quede guardado del visitante pasada la hora.
 *
 * 🔴 LA IP NO SE GUARDA NUNCA — ni en KV ni en D1. Lo que se guarda es
 * `SHA-256(sal + ip)`, y la sal es un secreto del despliegue: sin ella, un hash de IP se
 * revierte probando las 2^32 direcciones en un rato. Con sal, la clave del contador no es
 * un dato personal recuperable.
 *
 * Devuelve `null` si se puede seguir, o la respuesta 429 si no.
 */
export async function limitaFrecuencia(env: EntornoRecords, req: Request): Promise<Response | null> {
  const ip = req.headers.get("CF-Connecting-IP");
  if (!ip || !env.RECORDS_SAL) return null; // sin sal no se limita: ver el porqué en el tipo
  const hora = Math.floor(Date.now() / 3_600_000);
  const clave = `rl:${(await sha256Hex(env.RECORDS_SAL + ip)).slice(0, 32)}:${hora}`;
  const previo = Number((await env.RECORDS_KV.get(clave)) ?? "0");
  if (previo >= LIMITES.MAX_SUBIDAS_HORA) {
    return error(429, `máximo ${LIMITES.MAX_SUBIDAS_HORA} subidas por hora`);
  }
  // TTL 2 h y no 1: el cubo es por hora de reloj, así que la clave de la hora en curso
  // tiene que sobrevivir hasta el final de ESA hora aunque se cree en su último minuto.
  await env.RECORDS_KV.put(clave, String(previo + 1), { expirationTtl: 7200 });
  return null;
}

/**
 * GUARDA un récord ya validado. Devuelve su id.
 *
 * 🔴 PRIMERO KV, DESPUÉS D1, y el orden no es indiferente: si falla el segundo paso queda
 * un registro en KV que nadie lista —invisible, inofensivo, y recuperable—. Al revés
 * quedaría una FILA EN LA TABLA cuyo «ver repetición» da 404: una fila que promete algo que
 * no está. De los dos estados a medias se elige el que no miente.
 *
 * El id es el hash del contenido canónico ⇒ subir dos veces lo mismo es idempotente: mismo
 * id, `put` que reescribe lo mismo, `INSERT OR IGNORE` que no duplica.
 */
export async function guardaRecord(env: EntornoRecords, r: RecordSubida): Promise<string> {
  const id = await idDeRecord(r);
  const cuerpo = canonizaRecord(r);
  await env.RECORDS_KV.put(`rec:${id}`, cuerpo);
  await env.RECORDS_DB.prepare(
    `INSERT OR IGNORE INTO records
       (id, alias, base_tipo, base_id, ancla_hash, motor, turnos, teclas,
        desenlace_reclamado, bytes, creado, identidad_tipo, identidad_sub)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'anonima', NULL)`,
  )
    .bind(
      id,
      r.alias,
      r.base.tipo,
      r.base.id,
      r.anclaHash,
      r.motor,
      r.lastTurn,
      r.count,
      r.desenlaceReclamado ? 1 : 0,
      new TextEncoder().encode(cuerpo).length,
      Date.now(),
    )
    .run();
  return id;
}

/** Tope de filas por página. Un `limite` mayor se recorta a esto, no se rechaza. */
export const PAGINA_MAX = 50;

/**
 * LISTA el índice, del mejor récord al peor.
 *
 * El orden es `turnos ASC` —menos turnos, mejor récord— y desempata por antigüedad: entre
 * dos partidas del mismo número de turnos gana la que llegó antes, que es la convención de
 * cualquier tabla y no exige inventar un criterio.
 *
 * PAGINACIÓN POR CLAVE (`desde`), no por OFFSET: con OFFSET, una subida nueva entre dos
 * páginas desplaza la ventana y el visitante ve una fila repetida o se salta otra. El
 * cursor es el par (turnos, creado) de la última fila servida, que es exactamente el orden.
 */
export async function listaTabla(
  env: EntornoRecords,
  opciones: { baseId?: string; limite?: number; desde?: { turnos: number; creado: number } },
): Promise<FilaTabla[]> {
  const limite = Math.min(Math.max(1, Math.floor(opciones.limite ?? 20)), PAGINA_MAX);
  const campos =
    "id, alias, base_id, ancla_hash, motor, turnos, teclas, desenlace_reclamado, creado";
  const cond: string[] = [];
  const args: unknown[] = [];
  if (opciones.baseId) {
    cond.push("base_id = ?");
    args.push(opciones.baseId);
  }
  if (opciones.desde) {
    cond.push("(turnos > ? OR (turnos = ? AND creado > ?))");
    args.push(opciones.desde.turnos, opciones.desde.turnos, opciones.desde.creado);
  }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const sql = `SELECT ${campos} FROM records ${where} ORDER BY turnos ASC, creado ASC LIMIT ?`;
  const res = await env.RECORDS_DB.prepare(sql)
    .bind(...args, limite)
    .all<Record<string, unknown>>();
  return (res.results ?? []).map((f) => ({
    id: String(f["id"]),
    alias: String(f["alias"]),
    baseId: String(f["base_id"]),
    anclaHash: String(f["ancla_hash"]),
    motor: String(f["motor"]),
    turnos: Number(f["turnos"]),
    teclas: Number(f["teclas"]),
    desenlaceReclamado: Number(f["desenlace_reclamado"]) === 1,
    creado: Number(f["creado"]),
  }));
}

/** El registro completo de un récord, tal y como se guardó. `null` si no existe. */
export async function leeRecord(env: EntornoRecords, id: string): Promise<string | null> {
  if (!/^[0-9a-f]{20}$/.test(id)) return null; // ni se consulta: no es un id nuestro
  return env.RECORDS_KV.get(`rec:${id}`);
}
