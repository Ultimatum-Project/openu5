/**
 * `GET /api/tabla` — LA TABLA de récords, del mejor al peor.
 *
 * Parámetros (todos opcionales):
 *   · `base`   — id de momento. Sin él, la tabla mezcla arranques distintos, que es
 *                comparar cosas que no se comparan; el cliente siempre lo manda.
 *   · `limite` — filas (1..50, por defecto 20).
 *   · `desde`  — cursor `"<turnos>:<creado>"`, la última fila de la página anterior.
 *
 * 🔴 CADA FILA VIAJA CON LO QUE HACE FALTA PARA COMPROBARLA —`anclaHash`, `baseId`,
 * `motor`— y no sólo con la cifra. Una tabla que publica «412 turnos» y nada más pide que
 * te la creas; ésta dice de qué partida arranca, con qué motor y con qué huella, y el
 * registro entero está a un clic en `/api/partida/:id`.
 *
 * 🔴 Y `desenlaceReclamado` LLEVA EL «RECLAMADO» HASTA EL JSON. El servidor no puede
 * comprobar que la partida llegara al final —no tiene el motor ni los datos de EA—, así que
 * el nombre del campo dice de quién es la afirmación. Un `desenlace: true` a secas se
 * leería como un hecho verificado por el servidor.
 */
import { error, json, listaTabla, PAGINA_MAX, type EntornoRecords } from "../../src/records-servidor.js";

interface Contexto {
  request: Request;
  env: EntornoRecords;
}

export async function onRequest({ request, env }: Contexto): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("método no permitido", { status: 405, headers: { allow: "GET" } });
  }
  const url = new URL(request.url);
  const base = url.searchParams.get("base") ?? undefined;
  if (base !== undefined && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(base)) {
    return error(400, "base no es un id de momento");
  }
  const limiteCrudo = url.searchParams.get("limite");
  const limite = limiteCrudo === null ? undefined : Number(limiteCrudo);
  if (limite !== undefined && (!Number.isFinite(limite) || limite < 1)) {
    return error(400, `limite tiene que ser un entero entre 1 y ${PAGINA_MAX}`);
  }
  let desde: { turnos: number; creado: number } | undefined;
  const cursor = url.searchParams.get("desde");
  if (cursor !== null) {
    const m = /^(\d{1,12}):(\d{1,15})$/.exec(cursor);
    if (!m) return error(400, "desde no es un cursor «turnos:creado»");
    desde = { turnos: Number(m[1]), creado: Number(m[2]) };
  }

  const filas = await listaTabla(env, { baseId: base, limite, desde });
  const ultima = filas[filas.length - 1];
  return json(
    {
      filas,
      // El cursor lo compone el SERVIDOR y no el cliente: así el orden y su clave viven en
      // un solo sitio. `null` = no hay más (o no se sabe si hay más, que para paginar es lo
      // mismo: la página siguiente saldrá vacía y ya está).
      siguiente: ultima ? `${ultima.turnos}:${ultima.creado}` : null,
    },
    200,
    // 30 s de caché en el borde: una tabla de récords no necesita ser de este segundo, y
    // así una portada compartida no dispara una consulta a D1 por visita.
    { "cache-control": "public, max-age=30" },
  );
}
