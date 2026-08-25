/**
 * ARNÉS del NOMBRE DEL SITIO en las superficies que enseñan una partida guardada.
 *
 * Vuelca observaciones como JSON en stdout; quien asevera es `re/tools/test_nombres_lugar.py`.
 * El arnés NO asevera, para que no pueda aprobarse a sí mismo: si revienta no hay JSON y el
 * pytest se pone rojo por AUSENCIA de datos, que es la única «no medido» que vale.
 *
 * ── QUÉ MIDE, Y POR QUÉ ASÍ ─────────────────────────────────────────────────────────────
 * 1. LA DERIVACIÓN. `game/src/core/location-display.ts` lleva una tabla de nombres ya
 *    derivados porque hay consumidores sin extracción cargada. Una tabla escrita a mano es
 *    una FOTO, y una foto caduca. Aquí se RE-DERIVA en cada corrida desde las tres fuentes
 *    (el pool `locationNames` de `game/assets/data.json`, los nombres que `momentos.json`
 *    ya publica, y los identificadores de `extractor/src/data/locations.ts`) y se carea
 *    entrada por entrada. Quien edite un nombre a mano en la tabla, sin tocar la fuente,
 *    pone esto rojo con el id y los dos textos delante.
 * 2. LAS DOS SUPERFICIES, PINTADAS DE VERDAD bajo jsdom: la lista de guardados del juego
 *    (`game/src/ui/savepanel.ts`, la del reporte del usuario) y la tarjeta de `/byo`
 *    (`demo-byo/src/partidas.ts`). Se lee el TEXTO QUE QUEDA EN EL DOM, no el retorno de un
 *    helper: el defecto reportado era exactamente un texto en pantalla.
 * 3. EL PRODUCTOR. `skin/coreview.ts locationName()` es de donde salía el identificador con
 *    guiones bajos. Se construye un `Game` de verdad dentro del palacio y se lee
 *    `snapshot().locationName`.
 *
 * ── EL CASO DE COMPATIBILIDAD ES UN CASO DE PRIMERA ─────────────────────────────────────
 * Las dos superficies se miden con DOS partidas: una GUARDADA ANTES DEL FIX (con
 * `Palace_of_Blackthorn` literalmente dentro del índice, que es lo que hay hoy en el
 * navegador del usuario) y una guardada DESPUÉS. Si el remapeo viviera sólo en el productor,
 * la primera seguiría rota y esto lo diría.
 *
 * ── CONTROL DE NO-VACUIDAD ──────────────────────────────────────────────────────────────
 * Un aserto «el DOM no dice Palace_of_Blackthorn» pasa también con el DOM vacío, con la
 * tarjeta sin pintar y con el arnés midiendo el nodo equivocado. Por eso cada superficie
 * publica además `<superficie>_control`: el texto de una partida cuyo sitio NO se remapea
 * («Britannia»), que TIENE que seguir apareciendo. Si el pintado no ocurre, el control
 * también desaparece y el pytest lo caza.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const leeJson = (rel) => JSON.parse(readFileSync(resolve(RAIZ, rel), "utf8"));

// ── DOM antes de importar nada que lo toque al cargarse ────────────────────────────────
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://openu5.test/byo",
});
// `navigator` NO se copia: el de node es de sólo lectura y asignarlo revienta. Da igual —
// el resolvedor de idioma consulta `window.navigator`, que sí es el de jsdom
// (misma nota que `verifica-transferencia.mjs:45`).
for (const k of ["window", "document", "localStorage", "HTMLElement", "Node", "Event",
  "KeyboardEvent", "CustomEvent", "DOMException", "Blob", "getComputedStyle"]) {
  if (dom.window[k] !== undefined) globalThis[k] = dom.window[k];
}

const {
  LOCATION_DISPLAY_NAMES,
  LOCATION_SLUGS,
  LOCATIONS_SIN_NOMBRE_EN_EL_ORIGINAL,
  legibleLocationName,
  locationDisplayName,
  poolIndexForLocation,
  titleCaseLocation,
} = await import("../../game/src/core/location-display.js");
const { SAVES_INDEX_KEY } = await import("../../game/src/core/save-keys.js");

const obs = {};

// ══ 1. LA DERIVACIÓN, RE-HECHA ════════════════════════════════════════════════════════
const pool = leeJson("game/assets/data.json").locationNames;
const momentos = leeJson("demo-byo/public/momentos/momentos.json");

/** Nombres EN que la galería de momentos ya publica, indexados por su forma normalizada. */
const publicadosPorMomentos = momentos.map((m) => m.lugar.en);

obs.pool_cardinal = pool.length;
obs.huecos = [...LOCATIONS_SIN_NOMBRE_EN_EL_ORIGINAL];

/**
 * Careo de la tabla congelada contra la re-derivación. Cada fila lleva su PROCEDENCIA para
 * que el rojo diga no sólo «difiere» sino «difiere de QUÉ fuente».
 */
obs.careo = [];
for (let id = 1; id <= 32; id++) {
  const idx = poolIndexForLocation(id);
  const enTabla = LOCATION_DISPLAY_NAMES[id];
  let esperado, fuente;
  if (idx >= 0) {
    esperado = titleCaseLocation(pool[idx]);
    fuente = `DATA.OVL locationNames[${idx}] = ${JSON.stringify(pool[idx])}`;
  } else if (publicadosPorMomentos.includes(enTabla)) {
    esperado = enTabla;
    fuente = "momentos.json (nombre ya publicado por el proyecto)";
  } else {
    esperado = LOCATION_SLUGS[id].replace(/_/g, " ");
    fuente = `de-slug de ${LOCATION_SLUGS[id]} (el original no nombra este sitio)`;
  }
  obs.careo.push({ id, enTabla, esperado, fuente, casa: enTabla === esperado });
}

/** Los identificadores COPIADOS, careados contra el fichero del extractor. */
const locTs = readFileSync(resolve(RAIZ, "extractor/src/data/locations.ts"), "utf8");
const delExtractor = Object.fromEntries(
  [...locTs.matchAll(/\{\s*id:\s*(\d+),\s*name:\s*"([^"]+)"/g)].map((m) => [
    Number(m[1]),
    m[2],
  ]),
);
obs.slugs_del_extractor_leidos = Object.keys(delExtractor).length;
obs.slugs_que_no_casan = Object.entries(LOCATION_SLUGS)
  .filter(([id, slug]) => delExtractor[Number(id)] !== slug)
  .map(([id, slug]) => ({ id: Number(id), enTabla: slug, enExtractor: delExtractor[Number(id)] }));

/** Control independiente: las 8 mazmorras del pool, contra los nombres del parser. */
const dngTs = readFileSync(resolve(RAIZ, "extractor/src/parsers/dungeon.ts"), "utf8");
const dngNombres = [...dngTs.matchAll(/\{\s*location:\s*\d+,\s*name:\s*"([^"]+)"/g)].map(
  (m) => m[1],
);
obs.mazmorras_titlecase = pool.slice(27).map(titleCaseLocation);
obs.mazmorras_del_parser = dngNombres;

/** La trampa del apóstrofo, medida sobre las TRES entradas del pool que la instancian. */
obs.apostrofos = pool.filter((n) => n.includes("'")).map((n) => titleCaseLocation(n));

/** El pool VIVO manda sobre la foto: un DATA.OVL distinto da un nombre distinto.
 *  🔴 El testigo altera la entrada 1 (la de Britain, id 2) y no la 0: alterar una entrada
 *  que la location medida no lee habría dado el mismo verde con el pool ignorado. */
obs.pool_vivo_manda = locationDisplayName(2, pool.map((n, i) => (i === 1 ? "OTRA COSA" : n)));
obs.sin_pool_cae_en_la_tabla = locationDisplayName(2, undefined);
obs.hueco_ignora_el_pool = locationDisplayName(18, pool);

/** `legibleLocationName` sobre lo que hay guardado hoy y sobre lo que no debe tocar. */
obs.legible = {
  slug_del_reporte: legibleLocationName("Palace_of_Blackthorn"),
  slug_con_apostrofo: legibleLocationName("Serpents_Hold"),
  slug_con_articulo: legibleLocationName("Lycaeum"),
  ya_legible: legibleLocationName("Palace of Blackthorn"),
  britannia: legibleLocationName("Britannia"),
  underworld: legibleLocationName("Underworld"),
  mazmorra_con_planta: legibleLocationName("Deceit · L2 · N"),
  desconocido_con_guion_bajo: legibleLocationName("Un_Sitio_Que_No_Existe"),
};

// ══ 2. LAS DOS SUPERFICIES, PINTADAS ══════════════════════════════════════════════════
const VIEJA = {
  id: "save-vieja",
  name: "Antes del fix",
  timestamp: 1_754_600_000_000,
  turns: 4,
  locationName: "Palace_of_Blackthorn", // exactamente lo que hay en el índice del usuario
};
const NUEVA = {
  id: "save-nueva",
  name: "Despues del fix",
  timestamp: 1_754_600_001_000,
  turns: 5,
  locationName: "Palace of Blackthorn",
};
const CONTROL = {
  id: "save-control",
  name: "Control",
  timestamp: 1_754_600_002_000,
  turns: 6,
  locationName: "Britannia", // no se remapea: si desaparece, es que no se pintó nada
};
const INDICE = [VIEJA, NUEVA, CONTROL];
localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(INDICE));

// ── 2a. La lista de guardados del JUEGO (la del reporte) ───────────────────────────────
{
  const { SavePanel } = await import("../../game/src/ui/savepanel.js");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const panel = new SavePanel(host, {
    onLoad() {},
    onMessage() {},
    onAnalyticsEvent() {},
  });
  panel.show({ characters: [], turnsSinceStart: 4 }, "Palace of Blackthorn");
  const metas = [...panel.rootEl.querySelectorAll(".save-slot-meta")].map((n) => n.textContent);
  obs.savepanel_lineas = metas;
  obs.savepanel_control = metas.some((t) => t.includes("Britannia"));
}

// ── 2b. La tarjeta de /byo ─────────────────────────────────────────────────────────────
{
  const { pintaPartidas } = await import("../src/partidas.js");
  const raiz = document.createElement("div");
  document.body.appendChild(raiz);
  // `miniaturas` es OBLIGATORIO desde el merge de replay-thumbs (5ad18b98). Con
  // `repeticiones: []` el bucle que lo lee no corre y omitirlo pasaría por SUERTE;
  // se pasa el Map de verdad para que este arnés mida el contrato de hoy y no el de ayer.
  pintaPartidas(
    raiz,
    { partidas: INDICE, repeticiones: [], miniaturas: new Map() },
    false,
    () => {},
  );
  const metas = [...raiz.querySelectorAll(".guardado__meta")].map((n) => n.textContent);
  obs.byo_lineas = metas;
  obs.byo_control = metas.some((t) => t.includes("Britannia"));
}

// ══ 3. EL PRODUCTOR: coreview dentro del palacio ══════════════════════════════════════
{
  const { Game } = await import("../../game/src/core/game.js");
  const { CoreViewImpl } = await import("../../game/src/skin/coreview.js");
  const BT = 18; // Palace_of_Blackthorn
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const overworld = Array.from({ length: 256 }, () =>
    Array.from({ length: 256 }, () => 5),
  );
  const world = {
    overworld,
    underworld: overworld,
    // El `name` del mapa pequeño SIGUE siendo el identificador de máquina, y a propósito:
    // lo que se mide es que el productor ya NO lo usa como nombre de pantalla.
    smallMaps: new Map([[BT, { id: BT, name: "Palace_of_Blackthorn", floors: [{ z: 0, tiles }] }]]),
  };
  const estado = {
    characters: [
      {
        name: "A", gender: 0x0b, class: "A", status: "G",
        strength: 20, dexterity: 20, intelligence: 20,
        currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
        helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
        partyStatus: 0,
      },
    ],
    partySize: 1, activeCharacter: 0, food: 100, gold: 150,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    turnsSinceStart: 4,
    position: { location: BT, floor: 0, x: 5, y: 5 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12,
  };
  const combatResources = {
    combatMaps: [], enemyDefs: [], attackValues: [], attackRangeValues: [], defenseValues: [],
  };
  const conPool = new Game({}, world, { locationsX: [], locationsY: [], locationNames: pool }, structuredClone(estado), { combatResources });
  const sinPool = new Game({}, world, { locationsX: [], locationsY: [], locationNames: [] }, structuredClone(estado), { combatResources });
  obs.coreview_palacio_con_pool = new CoreViewImpl(conPool).snapshot().locationName;
  obs.coreview_palacio_sin_pool = new CoreViewImpl(sinPool).snapshot().locationName;

  // CONTROL del productor: un sitio que SÍ está en el pool, para que el verde de arriba no
  // pueda venir de que el pool no se consulta nunca.
  const YEW = 4;
  const worldYew = {
    overworld,
    underworld: overworld,
    smallMaps: new Map([[YEW, { id: YEW, name: "Yew", floors: [{ z: 0, tiles }] }]]),
  };
  const estadoYew = { ...structuredClone(estado), position: { location: YEW, floor: 0, x: 5, y: 5 } };
  const gYew = new Game({}, worldYew, { locationsX: [], locationsY: [], locationNames: pool }, estadoYew, { combatResources });
  obs.coreview_pool_consultado = new CoreViewImpl(gYew).snapshot().locationName;
  const gYewOtro = new Game(
    {},
    worldYew,
    { locationsX: [], locationsY: [], locationNames: pool.map((n, i) => (i === 3 ? "TEJO" : n)) },
    structuredClone(estadoYew),
    { combatResources },
  );
  obs.coreview_pool_alterado = new CoreViewImpl(gYewOtro).snapshot().locationName;
}

// ── 4. EL PRODUCTOR QUE ESCRIBE (#132) ───────────────────────────────────────────────────
// 🔴 EL §3 DE ARRIBA VIGILA EL CALCO QUE NO GUARDA. `coreview.locationName()` alimenta la
// PIEL; el que va dentro de `SaveMeta.locationName` —y de ahí al sobre `.u5gam` y al nombre
// del fichero descargado— es `mapName` de `main.ts`, que no aparecía en ningún test. Los dos
// terminaban en el MISMO respaldo escrito dos veces, así que el testigo puesto sobre uno no
// decía nada del otro. Desde #132 los dos llaman a `mapDisplayName`, y esto lo ejercita
// sobre TODAS las locations alcanzables en vez de sobre una elegida.
{
  const { mapDisplayName, LOCATION_SLUGS, OVERWORLD_LOCATION } = await import(
    "../../game/src/core/location-display.js"
  );
  // El respaldo devuelve el identificador de máquina del extractor SI se le deja: se le
  // pasa a propósito en todas las llamadas, para que un id que el pool no cubra tenga de
  // dónde sacar la cadena mala. Si el remapeo se cayera, saldría aquí.
  const slugDe = (id) => () => LOCATION_SLUGS[id];
  obs.productor_todas = Object.fromEntries(
    Object.keys(LOCATION_SLUGS)
      .map(Number)
      .map((id) => [id, mapDisplayName(id, 0, pool, slugDe(id))]),
  );
  obs.productor_sin_pool = Object.fromEntries(
    Object.keys(LOCATION_SLUGS)
      .map(Number)
      .map((id) => [id, mapDisplayName(id, 0, undefined, slugDe(id))]),
  );
  obs.productor_sobremundo = {
    britannia: mapDisplayName(OVERWORLD_LOCATION, 0, pool, () => undefined),
    underworld: mapDisplayName(OVERWORLD_LOCATION, 0xff, pool, () => undefined),
  };
  // EL CASO QUE MOTIVA EL CABO: una location que el pool NO cubre y cuyo mapa pequeño trae
  // el identificador con guion bajo. Antes salía crudo hacia el guardado.
  obs.productor_id_desconocido = mapDisplayName(200, 0, pool, () => "Palace_of_Blackthorn");
  obs.productor_id_desconocido_sin_slug = mapDisplayName(200, 0, pool, () => undefined);
  // CONTROL DE NO-VACUIDAD: que el respaldo se CONSULTA de verdad. Un id desconocido con un
  // slug inventado tiene que salir por él; si no, los verdes de arriba no probarían nada.
  obs.productor_respaldo_consultado = mapDisplayName(200, 0, pool, () => "Sitio_De_Prueba");
}

process.stdout.write(JSON.stringify(obs, null, 2) + "\n");
