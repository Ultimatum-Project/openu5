/**
 * ICONOS DE ARTEFACTO recortados del atlas de tiles DEL USUARIO — CHUNK PEREZOSO.
 *
 * A3, el remate del bloque de tarjetas ricas. La corona, el cetro, el amuleto, los tres
 * shards y la caja de sándalo dejan de ser sólo una palabra en un chip y salen con SU
 * gráfico de 1988 — el de la copia del visitante, no uno nuestro.
 *
 * 🔴 MISMA REGLA QUE EL MINIMAPA, y por eso vive al lado suyo: el atlas sale de
 * `/assets/tiles-ega.png`, que el extractor generó desde el `TILES.16` del visitante y
 * dejó en SU Cache Storage. Aquí no viaja ni un byte del juego. Sin caché no hay icono y
 * el chip de texto se queda solo — que es exactamente como estaba la tarjeta antes.
 *
 * 🔴 Y NO SE PUEDE IMPORTAR ESTÁTICAMENTE desde `main.ts`, por la MISMA razón que
 * `minimapa.ts`: arrastra `core/tiles` → `core/data/TileData.json` (458 KB) contra un
 * bundle eager de ~92 KB. Se entra por `import("./iconos.js")` y sólo cuando hay una
 * tarjeta con artefactos que ilustrar.
 * ⚠️ Comparte ese árbol con `minimapa.ts`, así que rollup emite la tabla UNA vez en un
 * chunk compartido — y la sonda lo exige (`la tabla vive en UN chunk perezoso, no en
 * ninguno ni en dos`). Si algún día se rompiera esa compartición, ese aserto lo dirá.
 *
 * ── POR QUÉ EL CHIP DE TEXTO NO SE VA ────────────────────────────────────────────────
 * Un tile es 16×16 px de 1988. A ese tamaño, un cetro y un amuleto son dos manchas
 * doradas: el rótulo es lo que dice CUÁL. El icono acompaña, no sustituye — y de paso eso
 * hace que el caso «sin caché» no sea una degradación, sino la misma tarjeta con una cosa
 * menos.
 */
import { TILE_INFO } from "../../game/src/core/tiles.js";

/** Columnas del atlas: `tilesToAtlasRgba(tiles, 32)` en `extractor/src/pipeline.ts`. */
const COLS = 32;
/** Lado de un tile en píxeles (TILES.16). */
const PX = 16;
const RUTA = "/assets/tiles-ega.png";

/**
 * Clave del artefacto (la que usa `partidas.ts`) → NOMBRE del tile en `TileData.json`.
 *
 * 🔴 EL ÍNDICE NO SE ESCRIBE AQUÍ, SE BUSCA POR NOMBRE. «La corona es el 437» sería un
 * número mágico que nadie puede comprobar de un vistazo y, lo que es peor, que al quedarse
 * rancio NO daría error: daría EL ICONO EQUIVOCADO — un cetro donde el chip dice corona.
 * Con la búsqueda por nombre, un cambio de tabla da `null` y la tarjeta cae al chip de
 * texto, que es el fallback correcto.
 *
 * 🔴 PERO ESA DEFENSA NO CUBRE ELEGIR MAL EL NOMBRE, y aquí pasó: la caja estaba mapeada a
 * `"Box"` = tile **175**, y el objeto del juego es el **270 `ItemSandalwoodBox`** (lo dicen
 * `core/data/InventoryDetails.json` — `WoodenBox → ItemSprite 270` — y
 * `core/npc/manager.ts:138`). «Box» es el rótulo del objeto en el MENÚ DE USAR
 * (`core/usePicker.ts:58`), no el nombre de su tile. Resolver por nombre protege de que el
 * índice se MUEVA; no protege de que el nombre sea el de otra cosa.
 * ⇒ LA REGLA QUE FALTABA: **el nombre se toma de la tabla que asocia OBJETO→SPRITE, no de
 * la que asocia OBJETO→RÓTULO.** Las siete filas de aquí abajo están cotejadas una a una
 * contra `InventoryDetails.json`, y la sonda lo vuelve a cotejar en cada corrida
 * («el mapa de iconos concuerda con InventoryDetails»), que es donde tiene que vivir el
 * control: cruzar dos fuentes en tiempo de build cuesta cero bytes de bundle.
 * (Censo al arreglarlo: 6 de las 7 ya eran correctas; sólo la caja estaba mal.)
 *
 * Los TRES shards comparten tile: en el juego el nombre del shard vive en el objeto, no
 * en el gráfico. Las tres claves apuntan al mismo y el chip dice cuál — inventar tres
 * iconos distintos sería inventarse tres gráficos.
 */
const TILE_DE: Record<string, string> = {
  corona: "Crown",
  cetro: "Sceptre",
  amuleto: "Amulet",
  shardFalsedad: "Shard",
  shardOdio: "Shard",
  shardCobardia: "Shard",
  caja: "ItemSandalwoodBox",
  // ── LA BOLSA (ficha rica) ──────────────────────────────────────────────────────────
  // Mismas siete líneas de arriba y misma regla: el nombre sale de la tabla OBJETO→SPRITE
  // (`InventoryDetails.json`), NUNCA del rótulo del menú, y la sonda de
  // `verifica-estados.mjs` vuelve a cruzar cada fila contra ella en cada corrida.
  oro: "ItemMoney", // Gold → 258
  comida: "ItemFood", // Food → 271
  llaves: "ItemKey", // Keys → 263
  gemas: "ItemGem", // Gems → 264
  antorchas: "ItemTorch", // Torches → 269
  // ⚠ LAS LLAVES DE CALAVERA COMPARTEN GRÁFICO CON LAS NORMALES, y no es un descuido mío:
  // `InventoryDetails` da `SkullKeys → 263`, el MISMO sprite que `Keys`. En 1988 no había
  // un tile aparte. Mismo caso que los tres shards: el icono no distingue y el rótulo sí,
  // que es justo por lo que el chip de texto no se va (ver cabecera).
  calaveras: "ItemKey", // SkullKeys → 263, igual que Keys
  alfombras: "Carpet2", // Carpet → 283
  // 🔴 EL GARFIO (`grapple`) SE QUEDA SIN ICONO A PROPÓSITO. `InventoryDetails` le da
  // `ItemSprite: 12`, y el tile 12 es **`SmallMountains`** — o sea, montañitas de terreno,
  // no un garfio. Poner la fila habría pintado un trozo de paisaje junto al rótulo
  // «garfio» y habría pasado la sonda en VERDE, porque la sonda cruza mi elección contra
  // `InventoryDetails` y ahí los dos dirían 12. La regla de la cabecera protege de que el
  // índice se MUEVA y de elegir el nombre de otra tabla; NO protege de que la propia tabla
  // del juego traiga un sprite que no ilustra el objeto. Se declara y se deja fuera.
};

/** Índice del tile cuyo nombre es exactamente `nombre`, o `null`. Resuelto una vez. */
const indices = new Map<string, number | null>();
function tileLlamado(nombre: string): number | null {
  const visto = indices.get(nombre);
  if (visto !== undefined) return visto;
  let idx: number | null = null;
  for (let i = 0; i < TILE_INFO.length; i++) {
    if (TILE_INFO[i]?.name === nombre) {
      idx = i;
      break;
    }
  }
  indices.set(nombre, idx);
  return idx;
}

/**
 * El atlas del usuario, memoizado. `null` si no hay caché, si el navegador no da
 * `createImageBitmap`, o si el PNG no se puede decodificar. Se guarda la PROMESA: las
 * tarjetas piden a la vez y comparten una sola lectura en vuelo.
 */
let atlas: Promise<ImageBitmap | null> | undefined;
function leeAtlas(): Promise<ImageBitmap | null> {
  atlas ??= (async () => {
    try {
      if (!("caches" in globalThis) || typeof createImageBitmap !== "function") return null;
      // A la CACHÉ por su nombre, no a la red: /byo puede ejecutarse antes de que el SW
      // controle la página (mismo criterio que `minimapa.ts`).
      const cache = await caches.open("u5-assets-v1");
      const res = await cache.match(new Request(RUTA));
      if (!res) return null;
      return await createImageBitmap(await res.blob());
    } catch {
      return null; // sin extracción, en modo privado o con el PNG a medias: sin icono
    }
  })();
  return atlas;
}

/**
 * El icono de un artefacto, o `null` si no se puede.
 *
 * Sale a 16×16 REALES y lo escala el CSS con `image-rendering: pixelated`: el tile es lo
 * que es, y agrandarlo con interpolación lo convierte en una mancha.
 */
export async function pintaIcono(clave: string): Promise<HTMLCanvasElement | null> {
  const nombre = TILE_DE[clave];
  if (!nombre) return null;
  const idx = tileLlamado(nombre);
  if (idx === null) return null;
  const img = await leeAtlas();
  if (!img) return null;
  const sx = (idx % COLS) * PX;
  const sy = Math.floor(idx / COLS) * PX;
  // 🔴 El atlas del visitante podría ser MÁS PEQUEÑO que el índice si su TILES.16 lo es.
  // Recortar fuera del bitmap no lanza: da un lienzo TRANSPARENTE, que junto al chip se
  // leería como «este artefacto no tiene icono porque no lo tienes». Mejor `null`.
  if (sx + PX > img.width || sy + PX > img.height) return null;
  const cv = document.createElement("canvas");
  cv.width = PX;
  cv.height = PX;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, PX, PX, 0, 0, PX, PX);
  return cv;
}
