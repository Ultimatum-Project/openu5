/**
 * ARNÉS de la lectura de una partida para su TARJETA en `/byo`.
 *
 * Ejecuta las funciones REALES de `demo-byo/src/partidas.ts` (las mismas que corren en el
 * navegador, importadas del fichero, no reimplementadas) sobre estados SINTÉTICOS, y vuelca
 * lo observado como JSON en stdout. Quien asevera es `re/tools/test_byo_tarjeta.py`.
 *
 * ── POR QUÉ EL ARNÉS NO ASEVERA ─────────────────────────────────────────────────────────
 * Para que no pueda aprobarse a sí mismo. Aquí sólo se PRODUCEN observaciones; el juicio
 * vive en el pytest, que además está en la batería de aterrizaje y por tanto corre solo. Si
 * este fichero revienta, no hay JSON y el pytest se pone rojo por ausencia de datos — que es
 * la única condición de «no medido» que vale en una ruta de medición.
 *
 * ── POR QUÉ LOS ESTADOS SON SINTÉTICOS Y NO SAVES REALES ────────────────────────────────
 * Los tres defectos se MIDIERON sobre dos partidas reales (ver
 * `docs/publicacion/web/BRAINSTORM-tarjetas-partida.md` §0), pero un `GameState` real lleva
 * dentro material derivado de EA —nombres de los compañeros, tablas de objeto, coordenadas—
 * y ése no viaja en ficheros tracked (CLAUDE.md REGLA 4). Los estados de aquí llevan sólo la
 * FORMA que se midió (roster de 16 con `partyStatus`, `floor` 0xFF, `questFlags` de trama) y
 * ni una cadena del juego: nombres de una letra.
 *
 * ── POR QUÉ HAY UN `localStorage` DE MENTIRA ────────────────────────────────────────────
 * `leeDetalle(id)` lee del almacenamiento porque ése es su trabajo. Se le pone un `Storage`
 * en memoria en vez de partir la función en dos para poder probarla: así lo que se prueba es
 * la función que se envía, con su `JSON.parse` y sus guardas dentro, y no una versión
 * paralela que podría divergir de la de producción sin que nadie se enterase.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SAVE_SLOT_PREFIX } from "../../game/src/core/save-keys.js";
import { leeDetalle } from "../src/partidas.js";

/** `Storage` mínimo en memoria: sólo lo que `leeDetalle` y `save-keys` tocan. */
function montaAlmacen() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
  return m;
}

const almacen = montaAlmacen();

/** Mete un estado en el almacén bajo un id y devuelve lo que la tarjeta leería de él. */
function tarjetaDe(id, estado) {
  almacen.set(SAVE_SLOT_PREFIX + id, JSON.stringify(estado));
  return leeDetalle(id);
}

/** Un registro del roster. `unido` = viaja con el Avatar (`partyStatus` 0). */
function pj(nombre, unido, status = "G") {
  return { name: nombre, status, partyStatus: unido ? 0 : 0xff };
}

/** Roster COMPLETO de 16, con los `n` primeros unidos. Es la forma medida en los saves. */
function roster(n, statuses = {}) {
  const letras = "ABCDEFGHIJKLMNOP".split("");
  return letras.map((l, i) => pj(l, i < n, statuses[i] ?? "G"));
}

const obs = {};

// ── grupo: el roster son 16 SIEMPRE; el grupo es quien lleva partyStatus 0 ───────────────
// El caso que estaba roto: 16 registros, 3 unidos. La tarjeta decía 16.
obs.grupo_roster16_unidos3 = tarjetaDe("g1", { characters: roster(3) }).grupo;
// Uno de los tres MUERTO: sigue viajando contigo, sigue contando.
obs.grupo_con_un_muerto = tarjetaDe("g2", { characters: roster(3, { 1: "D" }) }).grupo;
// Tope de 6 (party.ts:9 MAX_PARTY): un roster entero unido no da 16.
obs.grupo_los16_unidos = tarjetaDe("g3", { characters: roster(16) }).grupo;
// RECÍPROCA de independencia: `partySize` mentiroso NO mueve la cifra — se cuenta el
// CONJUNTO, no se lee el contador (y aquí nadie ha pasado por `assertValidState`).
obs.grupo_partySize_mentiroso = tarjetaDe("g4", { characters: roster(3), partySize: 99 }).grupo;
// Y el grupo de una partida en la que sólo está el Avatar es 1, no 16.
obs.grupo_solo_avatar = tarjetaDe("g5", { characters: roster(1) }).grupo;
// Sin `characters` no se inventa un cero: el campo no se pinta.
obs.grupo_sin_characters = tarjetaDe("g6", { gold: 10 }).grupo ?? null;

// ── posición: `floor` tiene que LLEGAR, que es la mitad del defecto del mapa ─────────────
// `leeDetalle` copiaba location/x/y y TIRABA `floor`, así que quien elige mapa no tenía con
// qué elegir. Sin este par, el arreglo de `rutaDelMapa` sería correcto y no serviría de nada.
const brit = tarjetaDe("p1", { position: { location: 0, floor: 0, x: 78, y: 41 } }).posicion;
const under = tarjetaDe("p2", { position: { location: 0, floor: 255, x: 129, y: 128 } }).posicion;
obs.pos_britannia = brit;
obs.pos_underworld = under;
// Save tan viejo que no traiga `floor`: 0 (sobremundo), no `undefined` colándose al mapa.
obs.pos_sin_floor = tarjetaDe("p3", { position: { location: 0, x: 5, y: 6 } }).posicion;
// Un pueblo NO es un mapa grande: la tarjeta lleva la posición, pero no habrá minimapa.
obs.pos_pueblo = tarjetaDe("p4", { position: { location: 13, floor: 0, x: 1, y: 2 } }).posicion;

// ── Shadowlords: la MUERTE vive en questFlags, no en shadowlordLocs ─────────────────────
/** Los tres flags de muerte, en el formato exacto de `quest/shadowlords.ts:52`. */
const MUERTOS = {
  "shadowlord-dead:falsehood": true,
  "shadowlord-dead:hatred": true,
  "shadowlord-dead:cowardice": true,
};
const sl = (id, estado) => tarjetaDe(id, estado).shadowlords.puntos;

// EL CASO QUE ESTABA MAL: final de juego real — los tres muertos y `shadowlordLocs` AUSENTE
// (es su estado normal: el port no mantiene ese campo). Salía «aún no aparecen».
obs.sl_final_de_juego = sl("s1", { questFlags: MUERTOS });
// Partida recién empezada: sin flags y sin locs. No se afirma nada de la trama.
obs.sl_partida_nueva = sl("s2", { questFlags: {} });
// Uno solo destruido: los otros dos siguen sin rastro, no «vivos en una ciudad».
obs.sl_uno_destruido = sl("s3", { questFlags: { "shadowlord-dead:hatred": true } });
// PRECEDENCIA: el flag GANA a un byte de posición rancio. Un destruido no está en una ciudad.
obs.sl_flag_gana_al_byte = sl("s4", { questFlags: MUERTOS, shadowlordLocs: [3, 0x90, 7] });
// Y con locs poblado y NINGÚN muerto, se sigue leyendo dónde anda cada uno (rama heredada).
obs.sl_locs_sin_muertos = sl("s5", { questFlags: {}, shadowlordLocs: [3, 0x90, 0xff] });
// El orden es el canónico 0=falsehood 1=hatred 2=cowardice: se mata al del MEDIO y tiene que
// salir en el medio. Sin esto, una tabla reordenada pasaría todos los asertos de arriba.
obs.sl_orden = sl("s6", { questFlags: { "shadowlord-dead:hatred": true }, shadowlordLocs: [3, 3, 3] });

// ── qué MAPA se elige ────────────────────────────────────────────────────────────────────
const { rutaDelMapa, pintaMinimapa, MARCA_VISOR_TILES } = await import("../src/minimapa.js");
/**
 * Lo que pide el VISOR, tomado del MÓDULO y no copiado aquí. Si se copiara el número, este
 * fichero mediría la sonda contra sí misma: la razón marca/tile saldría la que yo escribí,
 * no la que el pintor usa.
 */
const VISOR = { escala: 3, marca: { tiles: MARCA_VISOR_TILES } };
obs.ruta_floor0 = rutaDelMapa(0, 0);
obs.ruta_floor255 = rutaDelMapa(0, 0xff);
// Un INTERIOR ya no es «ningún mapa»: es el fichero de los mapas pequeños (#112).
obs.ruta_interior = rutaDelMapa(13, 0);
// Plantas de un mapa grande que no son el Underworld (no las hay hoy, pero el predicado
// es `=== 0xFF`, no `!== 0`): cualquier otra cosa es Britannia, nunca «ninguno».
obs.ruta_floor1 = rutaDelMapa(0, 1);

// ── Y QUE DOS TARJETAS DE MUNDOS DISTINTOS NO COMPARTAN MAPA ─────────────────────────────
// Ésta es la recíproca que importa: `leeMapa` memoizaba en UNA ranura, así que con dos mapas
// la primera tarjeta pintada habría fijado el mapa de todas. Se pintan dos seguidas —primero
// Britannia, después el Underworld— y se mira el color del píxel de cada una: si comparten
// caché, el segundo sale con el terreno del primero.
//
// Los dos mapas de mentira son uniformes y de tiles DISTINTOS, para que el color los separe.
// Los colores NO se escriben aquí: salen de `tile-colors.ts`, el mismo módulo que pinta en
// producción — así el aserto no puede pasar por una tabla propia que haya divergido. Medidos:
// tile 1 → #1a4a8a y tile 4 → #4d5a2a. Lo que el aserto exige es que sean DISTINTOS, no cuáles
// son: la identidad de cada color es cosa de `tile-colors.ts` y cambiarla no es una regresión
// de esta pantalla.
function mapaUniforme(tile) {
  return Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => tile));
}
// 🔴 Y LOS MAPAS PEQUEÑOS SON LOS DE VERDAD, no un uniforme. Aquí no vale un sintético: lo
// que #112 tiene que demostrar es que se pinta UN INTERIOR REAL de la extracción del
// visitante — con su `id`, su planta con signo y su relieve. Un `mapaUniforme` daría un
// lienzo de UN color y el aserto de «no degenerado» sería imposible de escribir sin trampa.
// Es el MISMO fichero que consume el juego (`game/assets/maps/smallmaps.json`), leído de
// disco y servido por la caché de mentira igual que lo serviría la Cache Storage.
const leeAsset = (rel) =>
  JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../game/assets/" + rel), "utf8"));
const DATOS = leeAsset("data.json");
const SMALLMAPS = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../game/assets/maps/smallmaps.json"), "utf8"),
);
const SIRVE = {
  "/assets/maps/overworld.json": mapaUniforme(1),
  "/assets/maps/underworld.json": mapaUniforme(4),
  "/assets/maps/smallmaps.json": SMALLMAPS,
  // `data.json` REAL: de aquí salen `locationsX/locationsY`, la tabla que sitúa cada sitio en
  // el sobremundo (la misma que consulta `locationAt`).
  "/assets/data.json": DATOS,
};
const pedidas = [];
globalThis.caches = {
  open: async () => ({
    match: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      const ruta = url.replace(/^https?:\/\/[^/]+/, "");
      pedidas.push(ruta);
      const m = SIRVE[ruta];
      return m ? { json: async () => m } : undefined;
    },
  }),
};
globalThis.Request = class {
  constructor(url) {
    this.url = url;
  }
};
// Canvas de mentira: sólo lo que `pintaMinimapa` toca. Devuelve los píxeles para poder
// mirarlos — un canvas que no guardara nada dejaría el aserto sin objeto.
//
// 🔴 SABE `drawImage`, Y HAY QUE DECIR POR QUÉ. El pintor tiene dos caminos: volcado directo
// (`putImageData`) cuando hay 1 px de lienzo por tile, y lienzo intermedio + `drawImage`
// cuando hay que ampliar. Los INTERIORES van SIEMPRE por el segundo (32 tiles en 256 px = 8
// px/tile), así que un stub sin `drawImage` los reventaría — o peor, con un `drawImage() {}`
// vacío devolvería un canvas de píxeles NULOS y el aserto de «no degenerado» leería un mapa
// perfectamente pintado como si fuera negro. Copia los píxeles del origen: es lo mínimo que
// hace falta modelar para que lo que se mide sea lo que el pintor produce.
// ⚠️ Y `strokeRect` NO PUEDE SEGUIR SIENDO UN CUERPO VACÍO: la MARCA se dibuja con dos
// `strokeRect`, así que un stub que los tira al suelo deja el tamaño de la marca fuera de
// todo lo que este fichero puede medir — que es precisamente donde se escondió el defecto
// del popup (una marca de 1/5 de casilla, con la suite entera en verde). Se apuntan los
// trazos y su grosor; la EXTENSIÓN pintada es `lado + grosor`, porque el trazo va a caballo
// del camino (mitad dentro, mitad fuera).
globalThis.document = {
  createElement: () => {
    let pixeles = null;
    const trazos = [];
    const cv = {
      width: 0,
      height: 0,
      getContext: () => {
        let grosor = 1;
        return {
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (img) => void (pixeles = img.data),
          drawImage: (src) => void (pixeles = src.__pixeles),
          fillRect() {},
          strokeRect: (x, y, w, h) => void trazos.push({ x, y, w, h, grosor }),
          set imageSmoothingEnabled(_v) {},
          set fillStyle(_v) {},
          set strokeStyle(_v) {},
          set lineWidth(v) {
            grosor = v;
          },
        };
      },
      get __pixeles() {
        return pixeles;
      },
      get __trazos() {
        return trazos;
      },
    };
    return cv;
  },
};

/**
 * La EXTENSIÓN de la marca en píxeles de lienzo, y CUÁNTO TILE es eso.
 *
 * 🔴 LA RAZÓN, NO LA EXTENSIÓN PELADA, es lo que este fichero observa — el aserto absoluto
 * («la marca mide 5») es el que se quedó rancio: se derivó para el mapa grande, donde el
 * tile son 3 px, y siguió pasando en verde cuando el mismo visor empezó a pintar interiores,
 * donde el tile son 24. Una cifra en píxeles de lienzo no dice NADA sin decir de qué mapa es.
 * La razón marca÷tile sí: es la misma propiedad en los dos mapas y no caduca al cambiar la
 * escala ni el tamaño del mapa.
 *
 * El tile se deriva de la SALIDA (`ancho / lado`), no de la fórmula de `porTile`: copiar la
 * fórmula aquí compararía el pintor con una segunda copia de sí mismo.
 */
function mideMarca(cv, lado) {
  const t = cv.__trazos;
  if (t.length === 0) return null;
  const extension = Math.max(...t.map((r) => r.w + r.grosor));
  const tile = cv.width / lado;
  return {
    extension: Math.round(extension * 1000) / 1000,
    tile,
    // El LIENZO entero, para poder expresar la marca como FRACCIÓN de lo que se muestra —
    // que es la magnitud en la que el suelo de visibilidad está derivado (14 de 256). Una
    // extensión suelta no distingue «grande porque el lienzo es grande» de «grande».
    lienzo: cv.width,
    razon: Math.round((extension / tile) * 1000) / 1000,
    // El HUECO del anillo (claro interior por donde se ve la casilla señalada): lado − grosor
    // del trazo más ancho. Es la cifra de la que sale `MARCA_VISOR_TILES`, así que se mide.
    hueco: Math.round(Math.min(...t.map((r) => r.w - r.grosor)) * 1000) / 1000,
  };
}

/** Color RGB del píxel (0,0) del canvas que devuelve `pintaMinimapa`. */
async function colorDe(floor) {
  const cv = await pintaMinimapa(0, 200, 200, floor); // lejos de (0,0): la marca roja no lo pisa
  if (!cv || !cv.__pixeles) return null;
  const p = cv.__pixeles;
  return [p[0], p[1], p[2]];
}

// ── LOS RÓTULOS EXISTEN EN LOS DOS IDIOMAS ──────────────────────────────────────────────
// 🔴 `txt()` DEVUELVE LA CLAVE CUANDO NO LA ENCUENTRA (`idioma.ts:285`, `if (!m) return id`).
// O sea que una clave que falte no da error: PINTA `slTodosDestruidos` en la tarjeta, en
// crudo, y sólo lo ve quien mire esa tarjeta en ese idioma. Este commit introduce claves
// nuevas y retira una, así que se comprueban todas las que la tarjeta pide para el chip.
//
// Se llama a `txt()` NO se hace grep sobre la tabla: lo que importa es qué SALE. (Y por eso
// `idiomaActual()` se sustituye — vive en `arranque.js` y necesita `window`; lo que se está
// comprobando es la TABLA y el `txt`, no de dónde sale el idioma.)
{
  const mod = await import("../src/idioma.js");
  const claves = [
    "slTodosDestruidos",
    "slSinRastro",
    "slRotulo",
    "sl_destruido",
    "sl_ciudad",
    "sl_fuera",
    "sl_sin_rastro",
  ];
  const rotulos = {};
  // ⚠ EL IDIOMA HAY QUE CONDUCIRLO DE VERDAD. Mi primer intento puso un `window` de adorno y
  // las DOS columnas salieron en inglés: `idiomaActual()` (arranque.ts:90-103) cae a
  // `win.navigator.language` y, sin navigator, devuelve "en" — con lo que `txt` resolvía por
  // `m[lang] ?? m.en` y la fila «es» habría dado un VERDE VACUO, comprobando el inglés dos
  // veces y llamándolo español. Se conduce por `navigator.language`, y el aserto de abajo
  // exige que las dos filas SALGAN DISTINTAS: eso es lo que prueba que el idioma se movió.
  for (const [lang, idioma] of [["es", "es-ES"], ["en", "en-US"]]) {
    globalThis.window = { navigator: { language: idioma } };
    for (const c of claves) {
      const salida = mod.txt(c);
      // `salida === c` = la clave no está en la tabla y `txt` la devolvió tal cual.
      rotulos[`${lang}:${c}`] = salida === c ? null : salida;
    }
  }
  obs.rotulos_sl = rotulos;
}

// ── EL INTERIOR REAL (ficha #112) ───────────────────────────────────────────────────────
// Momento 06: Palacio de Blackthorn, `location` 18, PLANTA 3, casilla (15,14). No es un caso
// inventado — son los valores exactos del def (`game/src/momentos/defs.ts:556`), o sea lo que
// una tarjeta de verdad le va a pedir a esta función.
/**
 * Mide un lienzo del pintor: tamaño, colores distintos y HUELLA del contenido.
 *
 * 🔴 LA HUELLA ES IMPRESCINDIBLE Y LO VI MIDIENDO: la planta 3 de Blackthorn y su SÓTANO dan
 * los mismos 5 colores, así que un aserto sobre el número de colores los da por iguales y no
 * puede detectar que el pintor esté ignorando la planta. Lo que distingue dos mapas es el
 * CONTENIDO, y por eso viaja un hash de todos los píxeles — barato y sensible a un solo tile.
 */
async function pintaYMide(location, x, y, floor, opts) {
  const cv = await pintaMinimapa(location, x, y, floor, opts);
  if (!cv) return null;
  const p = cv.__pixeles;
  if (!p) return { ancho: cv.width, alto: cv.height, colores: 0, huella: null };
  const col = new Set();
  let h = 2166136261; // FNV-1a de 32 bits: no es criptografía, es un discriminante
  for (let i = 0; i < p.length; i += 4) {
    col.add(`${p[i]},${p[i + 1]},${p[i + 2]}`);
    for (let k = 0; k < 3; k++) {
      h ^= p[i + k];
      h = Math.imul(h, 16777619);
    }
  }
  return { ancho: cv.width, alto: cv.height, colores: col.size, huella: (h >>> 0).toString(16) };
}
obs.interior_blackthorn = await pintaYMide(18, 15, 14, 3);
// El VISOR pide lo mismo con `escala: 3`: tiene que dar un lienzo 3× — así el popup de un
// interior hereda el zoom del de sobremundo sin una rama propia.
obs.interior_blackthorn_visor = await pintaYMide(18, 15, 14, 3, VISOR);

// ── LA MARCA DEL VISOR, EN UNIDADES DE CASILLA ──────────────────────────────────────────
// Las DOS vistas que el popup de un interior enseña a la vez, medidas con el MISMO régimen:
// la de dentro (mapa de 32, tile de 24 px de lienzo) y la de Britannia (mapa de 256, tile de
// 3). Que las dos den la MISMA razón es la propiedad; con la unidad vieja daban 0,208 y 1,667
// —ocho veces— y sólo una de las dos estaba bien.
obs.marca_visor = {
  tiles_pedidos: MARCA_VISOR_TILES,
  dentro: mideMarca(await pintaMinimapa(18, 15, 14, 3, VISOR), 32),
  britannia: mideMarca(await pintaMinimapa(0, 60, 90, 0, VISOR), 256),
  // La TARJETA no entra en este régimen y se mide para que se vea que NO cambió: su marca
  // se dimensiona contra el suelo de píxeles de PANTALLA (14 px de lienzo, aserto en
  // `verifica-estados.mjs`), no contra el tile. Son dos regímenes, no uno mal aplicado.
  tarjeta_britannia: mideMarca(await pintaMinimapa(0, 60, 90, 0), 256),
  tarjeta_interior: mideMarca(await pintaMinimapa(18, 15, 14, 3), 32),
  // 🔴 EL RÉGIMEN `{ px }` A UNA ESCALA QUE NINGÚN LLAMANTE USA HOY, y por eso está aquí:
  // sin esta observación, `{ px }` sólo se ejerce a escala 1, donde el suelo vale 14 y
  // coincide con la cifra pedida. Un mutante que aplicara el suelo TAMBIÉN a `{ px }`
  // sobrevivía (medido: M5) porque no había entrada que los separase. `{ px }` significa
  // «tantos píxeles de LIENZO», y eso no depende de la escala: es el contrato, y ésta es
  // la única llamada que puede verlo.
  px_a_escala_3: mideMarca(await pintaMinimapa(0, 60, 90, 0, { escala: 3, marca: { px: 14 } }), 256),
};
// 🔴 LA PLANTA DISCRIMINA. Blackthorn tiene cinco (-1..3) y son mapas DISTINTOS: si el pintor
// ignorara `floor` —o lo tomara como índice en vez de por `z`— las dos llamadas darían el
// mismo lienzo y nadie se enteraría. Se pide el SÓTANO del mismo sitio y se comparan.
obs.interior_blackthorn_sotano = await pintaYMide(18, 15, 14, -1);
// Un sitio que NO está en `smallmaps.json` (mazmorra, loc 40): sigue sin mapa, y eso es
// correcto — la RECÍPROCA que impide que «ahora se pinta todo» sea la lectura del cambio.
obs.mazmorra = await pintaYMide(40, 15, 14, 0);
// Y una planta que ese sitio no tiene: Iolo's Hut sólo tiene la 0.
obs.planta_inexistente = await pintaYMide(13, 15, 15, 7);

// El REPARTO de los colores del interior: cuánta superficie se lleva el más abundante. Un
// plano cuyo color mayoritario ocupe casi todo es «no degenerado» según el conteo de colores
// y una mancha según los ojos — la cota de arriba no distingue esos dos casos y ésta sí.
obs.interior_reparto = await (async () => {
  const cv = await pintaMinimapa(18, 15, 14, 3);
  const p = cv.__pixeles;
  const cuenta = new Map();
  for (let i = 0; i < p.length; i += 4) {
    const k = `${p[i]},${p[i + 1]},${p[i + 2]}`;
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const total = p.length / 4;
  const orden = [...cuenta.values()].sort((a, b) => b - a);
  return { celdas: total, mayoritario: orden[0] / total, colores: orden.length };
})();

// ── LA PALETA DISTINGUE MURO DE SUELO (#112) ────────────────────────────────────────────
// `defaultTileColor` nació para el SOBREMUNDO, donde no hay paredes, y en un plano de interior
// el orden de sus reglas dejó de ser inocuo: `StoneBrickWall` casaba por «brick» y salía del
// MISMO color que `BrickFloor`. Se comprueba sobre los tiles REALES, resolviendo sus nombres
// con la misma tabla que usa el pintor — no sobre una lista de números escrita aquí.
{
  const { TILE_INFO } = await import("../../game/src/core/tiles.js");
  const { defaultTileColor } = await import("../../game/src/core/tile-colors.js");
  const clase = (pred) => {
    const s = new Set();
    for (let i = 0; i < 256; i++) {
      const n = (TILE_INFO[i]?.name ?? "").toLowerCase();
      if (n && pred(n)) s.add(defaultTileColor(i));
    }
    return [...s];
  };
  obs.paleta = {
    muros: clase((n) => n.includes("wall")),
    suelos: clase((n) => n.includes("floor") && !n.includes("wall")),
  };
  // Y CUÁNTO de la superficie de los interiores estaba afectado, para que la cifra del
  // arreglo se recalcule sola en vez de quedarse en el mensaje de un commit.
  let muroComoSuelo = 0, plantas = 0;
  for (const sitio of SMALLMAPS) for (const f of sitio.floors) {
    let hay = false;
    for (const fila of f.tiles) for (const tl of fila) {
      const n = (TILE_INFO[tl]?.name ?? "").toLowerCase();
      if (n.includes("wall") && obs.paleta.suelos.includes(defaultTileColor(tl))) { muroComoSuelo++; hay = true; }
    }
    if (hay) plantas++;
  }
  obs.paleta.celdasMuroComoSuelo = muroComoSuelo;
  obs.paleta.plantasAfectadas = plantas;
}

// ── LA COORDENADA DEL LUGAR SALE DE LA TABLA, NO DE UNA CONSTANTE (enmienda #112) ───────
// Se compara contra el fichero de la extracción leído POR OTRO CAMINO (aquí, con `readFileSync`)
// y no contra un literal escrito en el aserto: si el número viviera en el test, el test pasaría
// igual con la función devolviendo esa constante — que es exactamente lo que la enmienda
// prohíbe. `location - 1` porque el id es 1-based (`locationAt` devuelve `i + 1`).
{
  const { coordenadaDelLugar } = await import("../src/minimapa.js");
  const esperado = (loc) => ({ x: DATOS.locationsX[loc - 1], y: DATOS.locationsY[loc - 1] });
  obs.coordenada = {
    blackthorn: await coordenadaDelLugar(18),
    blackthorn_tabla: esperado(18),
    iolo: await coordenadaDelLugar(13),
    iolo_tabla: esperado(13),
    // El mapa GRANDE no «está» en ningún sitio: es el sitio. Sin esta recíproca, una función
    // que devolviera siempre algo pondría una marca de lugar sobre una partida de sobremundo.
    sobremundo: await coordenadaDelLugar(0),
    // Y la tabla tiene 40 entradas: una location fuera de rango no inventa coordenada.
    fuera_de_rango: await coordenadaDelLugar(99),
  };
}

obs.color_britannia = await colorDe(0);
obs.color_underworld = await colorDe(0xff); // ← con UNA ranura de caché, salía igual al de arriba
obs.color_britannia_otra_vez = await colorDe(0); // y volver no lo contamina
obs.rutas_pedidas = pedidas;

process.stdout.write(JSON.stringify(obs, null, 1) + "\n");
