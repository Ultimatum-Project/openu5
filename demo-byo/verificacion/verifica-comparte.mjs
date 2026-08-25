/**
 * ARNÉS del ENLACE COMPARTIDO (`comparte.ts`) y de las INSIGNIAS de progreso (`insignias.ts`).
 *
 * Ejecuta las funciones REALES que se envían al navegador —importadas de los ficheros, no
 * reimplementadas— y vuelca lo observado como JSON en stdout. Quien asevera es
 * `re/tools/test_byo_comparte.py`.
 *
 * ── POR QUÉ EL ARNÉS NO ASEVERA ─────────────────────────────────────────────────────────
 * La misma razón que en `verifica-tarjeta.mjs`: para que no pueda aprobarse a sí mismo. Aquí
 * sólo se PRODUCEN observaciones; el juicio vive en el pytest, que está en la batería. Si esto
 * revienta, no hay JSON y el pytest se pone rojo por ausencia de datos.
 *
 * ── POR QUÉ SE PUEDE CORRER SIN NAVEGADOR ───────────────────────────────────────────────
 * Porque las dos piezas que se miden son PURAS por diseño y eso fue una decisión, no una
 * suerte: `decideLlegada` recibe el catálogo y `hayCopia` en vez de leerlos, y el predicado de
 * `insignias` recibe el índice y las aperturas en vez de ir al almacén. Lo único que necesita
 * un `Storage` es la lectura/escritura del sello, y se le pone uno en memoria (igual que
 * `verifica-tarjeta.mjs`) para probar la función que se envía, con sus `JSON.parse` y sus
 * guardas dentro, y no una versión paralela.
 *
 * ── CERO MATERIAL DE EA ─────────────────────────────────────────────────────────────────
 * Los índices de aquí son cabeceras sintéticas con nombres de una letra. Un `SaveMeta` real no
 * lleva material de EA (es la CABECERA, no el estado), pero tampoco hace falta ninguno: lo que
 * se mide es un predicado sobre `provenance`, `momentoId` y `timestamp`.
 */
import { pathToFileURL } from "node:url";

// ── DE DÓNDE SE IMPORTAN LOS DOS MÓDULOS, y por qué es un argumento ─────────────────────
// Por defecto, los ficheros REALES que se envían al navegador. `--comparte`/`--insignias`
// apuntan a otra copia, y es como el pytest corre los MUTANTES: escribe el fichero con una
// línea cambiada y vuelve a pedir las mismas observaciones. Así el mutante muta EL MÓDULO —
// no una reimplementación paralela dentro del arnés, que es lo que haría que los mutantes
// murieran contra un código que no es el que corre en producción.
function fuente(bandera, pordefecto) {
  const i = process.argv.indexOf(bandera);
  return i >= 0 && process.argv[i + 1]
    ? pathToFileURL(process.argv[i + 1]).href
    : new URL(pordefecto, import.meta.url).href;
}

const { decideLlegada, enlaceDeMomento, momentoDeLaUrl } = await import(
  fuente("--comparte", "../src/comparte.ts")
);
const { CLAVE_APERTURAS, borraAperturas, insignias, leeAperturas, marcaApertura } =
  await import(fuente("--insignias", "../src/insignias.ts"));

/** `Storage` mínimo en memoria: sólo lo que `insignias.ts` toca. */
function montaAlmacen() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
    /** No es del interfaz `Storage`: lo usa el arnés para plantar contenido corrupto. */
    __crudo: m,
  };
}

/** Una cabecera de partida NORMAL (guardado a mano o autoguardado). */
const propia = (id, timestamp) => ({ id, name: "P", timestamp, turns: 1, locationName: "L" });
/** La cabecera que siembra un momento (`installMomentoSave` → `provenance: 'momento'`). */
const deMomento = (momentoId, timestamp) => ({
  id: momentoId,
  name: "M",
  timestamp,
  turns: 0,
  locationName: "L",
  provenance: "momento",
  momentoId,
});

/** `insignias()` a objeto plano, para que viaje por JSON. */
function vistas(indice, aperturas) {
  const out = {};
  for (const [id, v] of insignias(indice, aperturas)) out[id] = v;
  return out;
}

// ── CATÁLOGO SINTÉTICO ────────────────────────────────────────────────────────────────
// Dos entradas y de clases distintas a propósito: con sólo disponibles, la rama
// `proximamente` no se recorrería y el arnés no podría distinguirla de `abre`.
const CATALOGO = [
  { id: "momento-01", disponible: true },
  { id: "momento-02", disponible: false },
];

const obs = {};

// ══ COMPARTE ═══════════════════════════════════════════════════════════════════════════
obs.urls = {
  simple: momentoDeLaUrl("?momento=momento-07"),
  conOtros: momentoDeLaUrl("?fetchsrc=/home/alguien/u5&momento=momento-07"),
  vacia: momentoDeLaUrl(""),
  sinParametro: momentoDeLaUrl("?fetchsrc=/home/alguien/u5"),
  // Formas que NO son un id del catálogo: un dígito, una ruta y una etiqueta.
  unDigito: momentoDeLaUrl("?momento=momento-7"),
  ruta: momentoDeLaUrl("?momento=../../etc/passwd"),
  marcado: momentoDeLaUrl("?momento=<b>x</b>"),
  parametroVacio: momentoDeLaUrl("?momento="),
};

obs.enlaces = {
  // El caso que motiva el filtrado: la query de quien copia lleva una ruta de SU disco.
  tiraLaQuery: enlaceDeMomento(
    "momento-07",
    "https://openu5.org/byo?fetchsrc=/home/alguien/ultima5&debug=1#abajo",
  ),
  // Desarrollo: origen y puerto se conservan, que es lo que hace útil el enlace ahí.
  conservaOrigen: enlaceDeMomento("momento-03", "http://localhost:5199/byo.html"),
  // Re-compartir desde un enlace ya compartido no acumula parámetros.
  noDuplica: enlaceDeMomento("momento-07", "https://openu5.org/byo?momento=momento-01"),
};

/** Los ocho casos de llegada, con los DOS controles del orden de comprobaciones. */
obs.llegadas = {
  sinParametro: decideLlegada(null, CATALOGO, true),
  catalogoVacio: decideLlegada("momento-01", [], true),
  desconocido: decideLlegada("momento-99", CATALOGO, true),
  // CONTROL DEL ORDEN: sin copia Y con id desconocido gana «desconocido». Si ganara
  // «sinCopia», mandaríamos a extraer los 31 ficheros por un enlace que no va a funcionar.
  desconocidoSinCopia: decideLlegada("momento-99", CATALOGO, false),
  proximamente: decideLlegada("momento-02", CATALOGO, true),
  // CONTROL DEL ORDEN, el gemelo: un momento que aún no existe no se destraba extrayendo.
  proximamenteSinCopia: decideLlegada("momento-02", CATALOGO, false),
  sinCopia: decideLlegada("momento-01", CATALOGO, false),
  abre: decideLlegada("momento-01", CATALOGO, true),
};

// ══ INSIGNIAS ══════════════════════════════════════════════════════════════════════════
obs.marcas = {
  // Añadido y nada más: el momento está sembrado, nadie lo ha abierto.
  soloAnadido: vistas([deMomento("momento-01", 1000)], {}),

  // 🔴 EL CONTROL QUE REFUTA EL CRITERIO DEL ENCARGO. El momento se RE-AÑADE después de
  // haberlo abierto, así que su `timestamp` (3000) es posterior a la apertura (2000) — que es
  // literalmente lo que decía «timestamp de guardado posterior a la instalación». No hay
  // ninguna otra partida en el índice. Un predicado escrito sobre esa frase diría «jugado»;
  // el de aquí tiene que decir que no.
  reanadirNoEsJugar: vistas([deMomento("momento-01", 3000)], { "momento-01": 2000 }),

  // El caso positivo: abrió el 01 y después el juego guardó (a mano o por `map-changed`).
  aperturaLuegoPartida: vistas(
    [deMomento("momento-01", 1000), propia("save-abc", 3000)],
    { "momento-01": 2000 },
  ),
  // La partida es ANTERIOR a la apertura: no puede venir de ella.
  partidaAnterior: vistas(
    [deMomento("momento-01", 1000), propia("save-abc", 1500)],
    { "momento-01": 2000 },
  ),
  // El autoguardado cuenta igual que el manual: es el mismo hecho por el otro canal.
  autosaveCuenta: vistas([propia("autosave-2", 3000)], { "momento-01": 2000 }),

  // ATRIBUCIÓN: dos momentos abiertos, UNA partida después del segundo. Sólo el segundo.
  atribucionAlUltimo: vistas([propia("save-abc", 4000)], {
    "momento-01": 1000,
    "momento-07": 3000,
  }),
  // Y al revés: la partida cae ENTRE las dos aperturas, así que es del primero.
  atribucionAlPrimero: vistas([propia("save-abc", 2000)], {
    "momento-01": 1000,
    "momento-07": 3000,
  }),

  // Sin aperturas no hay «jugado» por muchas partidas que haya: el índice no dice de dónde
  // vienen, y ése es justo el hueco que la apertura viene a llenar.
  partidasSinApertura: vistas([propia("save-abc", 5000), propia("autosave-1", 6000)], {}),
  // Borrada la ranura del momento, «añadido» se cae solo (no se persiste en ningún sitio),
  // pero lo que ya se jugó se sigue sabiendo: son dos hechos distintos.
  borradoElMomento: vistas([propia("save-abc", 3000)], { "momento-01": 2000 }),
};

// ══ EL SELLO ═══════════════════════════════════════════════════════════════════════════
const alm = montaAlmacen();
obs.sello = {};
obs.sello.vacio = leeAperturas(alm);
marcaApertura("momento-01", 1111, alm);
marcaApertura("momento-07", 2222, alm);
obs.sello.trasDos = leeAperturas(alm);
obs.sello.clave = CLAVE_APERTURAS;
obs.sello.claveEnAlmacen = [...alm.__crudo.keys()];
// Re-abrir el mismo momento SUSTITUYE, no acumula: interesa la última.
marcaApertura("momento-01", 3333, alm);
obs.sello.trasReabrir = leeAperturas(alm);
borraAperturas(alm);
obs.sello.trasBorrar = leeAperturas(alm);
obs.sello.claveTrasBorrar = [...alm.__crudo.keys()];

// Contenido que NO es lo que esperamos: nada de esto puede lanzar ni colarse.
const roto = montaAlmacen();
roto.__crudo.set(CLAVE_APERTURAS, "{{{no es json");
obs.sello.corrupto = leeAperturas(roto);
roto.__crudo.set(CLAVE_APERTURAS, '["una","lista"]');
obs.sello.lista = leeAperturas(roto);
roto.__crudo.set(CLAVE_APERTURAS, '{"momento-01":"2000","momento-07":3000,"momento-09":null}');
obs.sello.valoresSucios = leeAperturas(roto);

// Un almacén que LANZA en todo (modo privado con cookies bloqueadas): ni lectura ni escritura
// ni borrado pueden propagar la excepción — la pantalla tiene que pintarse igual.
const bloqueado = {
  getItem() { throw new Error("bloqueado"); },
  setItem() { throw new Error("bloqueado"); },
  removeItem() { throw new Error("bloqueado"); },
  key: () => null,
  length: 0,
};
obs.sello.bloqueadoLee = leeAperturas(bloqueado);
obs.sello.bloqueadoEscribe = marcaApertura("momento-01", 1, bloqueado);
borraAperturas(bloqueado); // si lanzara, no habría JSON y el pytest lo diría
obs.sello.bloqueadoBorraSinLanzar = true;

process.stdout.write(JSON.stringify(obs, null, 2));
