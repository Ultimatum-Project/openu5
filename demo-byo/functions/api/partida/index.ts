/**
 * `POST /api/partida` — SUBIR una repetición a la tabla de récords.
 *
 * Vive en `partida/index.ts` (y no en `partida.ts`) porque su hermano `[id].ts` necesita
 * el DIRECTORIO: la ruta de un directorio es su `index`, y las dos formas a la vez —un
 * fichero `partida.ts` y una carpeta `partida/`— compiten por el mismo prefijo.
 *
 * Pages Function. La lógica que se puede probar sin red vive en `../../src/records-*.ts`;
 * aquí queda lo que es HTTP: método, tamaño del cuerpo, códigos y cabeceras.
 *
 * ── LAS CUATRO PUERTAS, EN ESTE ORDEN Y POR ESTE MOTIVO ──────────────────────────────
 *   1. MÉTODO      — sólo POST. El resto, 405 (no 404: la ruta existe).
 *   2. TAMAÑO      — antes de leer nada, `content-length`; y después, el cuerpo REAL
 *                    medido en bytes, porque la cabecera la escribe el cliente y puede
 *                    mentir. Un endpoint público sin tope de tamaño es la primera de las
 *                    dos cosas que el diseño llama no-opcionales (§«Aceptar subidas
 *                    públicas trae dos cosas»).
 *   3. FRECUENCIA  — la segunda: `limitaFrecuencia`, por IP con sal y por hora.
 *   4. FORMA       — `validaRecord`, default-deny. Es la guarda EA-limpia; su porqué
 *                    completo está en la cabecera de `records-formato.ts`.
 *
 * 🔴 EL CONSENTIMIENTO NO SE COMPRUEBA AQUÍ, Y NO ES UN OLVIDO: vive en el navegador
 * (`permiteGuardarPartida`, game/src/web/consentimiento.ts) porque es ahí donde se puede
 * cumplir la promesa que hace el aviso — «sin permiso no se envía NADA». Un permiso
 * comprobado en el servidor llegaría tarde por definición: la petición ya se hizo. El
 * cliente no ofrece el botón sin permiso (`records.ts`) y ésa es la puerta real.
 *
 * ⚠ Lo que este endpoint SÍ garantiza es la otra mitad: aunque alguien llame a mano con
 * `curl`, no puede meter aquí un byte del juego, porque no hay campo donde quepa.
 */
import { validaRecord, LIMITES } from "../../../src/records-formato.js";
import {
  error,
  guardaRecord,
  json,
  limitaFrecuencia,
  type EntornoRecords,
} from "../../../src/records-servidor.js";

interface Contexto {
  request: Request;
  env: EntornoRecords;
}

export async function onRequest({ request, env }: Contexto): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("método no permitido", { status: 405, headers: { allow: "POST" } });
  }
  const tipo = request.headers.get("content-type") ?? "";
  if (!tipo.toLowerCase().includes("application/json")) {
    return error(415, "el cuerpo tiene que ser application/json");
  }
  // Cabecera primero: descarta lo enorme sin traerlo a memoria…
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > LIMITES.MAX_BYTES) {
    return error(413, `cuerpo de ${declarado} B; el tope es ${LIMITES.MAX_BYTES} B`);
  }
  // …y el cuerpo real después, porque la cabecera la pone quien llama.
  const crudo = await request.arrayBuffer();
  if (crudo.byteLength > LIMITES.MAX_BYTES) {
    return error(413, `cuerpo de ${crudo.byteLength} B; el tope es ${LIMITES.MAX_BYTES} B`);
  }

  const frenado = await limitaFrecuencia(env, request);
  if (frenado) return frenado;

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(new TextDecoder().decode(crudo));
  } catch {
    return error(400, "el cuerpo no es JSON válido");
  }
  const v = validaRecord(cuerpo);
  if (!v.ok) return error(400, v.motivo);

  const id = await guardaRecord(env, v.record);
  // 201 + Location: el récord es un recurso nuevo y tiene URL propia. El cliente la usa
  // tal cual para «ver repetición», sin componerla por su cuenta.
  return json({ id, url: `/api/partida/${id}` }, 201, { location: `/api/partida/${id}` });
}
