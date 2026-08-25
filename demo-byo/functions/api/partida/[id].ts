/**
 * `GET /api/partida/:id` — DESCARGAR el registro completo de un récord.
 *
 * Es la pieza que hace verificable la tabla: cualquiera se baja el registro y lo reproduce
 * con SU copia. Sin este endpoint la tabla sería una lista de cifras que hay que creerse,
 * que es justo lo que el proyecto no quiere ser (decisión D5 del diseño).
 *
 * 🔴 DEVUELVE EL MISMO TEXTO QUE SE VALIDÓ, byte a byte — el JSON canónico que guardó
 * `guardaRecord`, no una re-serialización. Si el servidor volviera a serializar el objeto,
 * el orden de claves podría cambiar y con él el hash: quien comprobara la huella del
 * fichero descargado obtendría otra cosa y no sabría por qué.
 *
 * El id es el hash del contenido ⇒ el recurso es INMUTABLE y se puede cachear para siempre.
 */
import { error, leeRecord, type EntornoRecords } from "../../../src/records-servidor.js";

interface Contexto {
  request: Request;
  env: EntornoRecords;
  params: { id?: string | string[] };
}

export async function onRequest({ request, env, params }: Contexto): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("método no permitido", { status: 405, headers: { allow: "GET" } });
  }
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  if (!id) return error(400, "falta el id");
  const cuerpo = await leeRecord(env, id);
  if (cuerpo === null) return error(404, "no hay ningún récord con ese id");
  return new Response(cuerpo, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
