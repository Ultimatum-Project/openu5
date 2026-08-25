/**
 * ARNÉS de la FICHA RICA de una partida en `/byo`.
 *
 * Mismo contrato que `verifica-tarjeta.mjs`, y por las mismas razones: ejecuta las funciones
 * REALES de `demo-byo/src/tarjeta-rica.ts` (las que se envían al navegador, importadas del
 * fichero) sobre estados SINTÉTICOS y vuelca lo observado como JSON en stdout. Aquí no se
 * asevera nada — quien juzga es `re/tools/test_byo_tarjeta_rica.py`, que además está en la
 * batería. Si este fichero revienta, no hay JSON y el pytest se pone rojo por ausencia de
 * datos, que es la única forma honesta de «no medido» en una ruta de medición.
 *
 * ── POR QUÉ NO HAY `localStorage` AQUÍ (y en el otro arnés sí) ───────────────────────────
 * `fichaRica()` toma el estado YA PARSEADO, no un `id`. El almacén no entra en su contrato,
 * así que montarlo sería atrezo. `leeDetalle()` sí lo necesitaba porque leer del almacén ES
 * su trabajo.
 *
 * ── NI UNA CADENA DE EA ─────────────────────────────────────────────────────────────────
 * Los estados llevan sólo la FORMA medida (roster de 16 con `partyStatus`, bytes de fase en
 * su rango crudo, bitmaps del tamaño real). Los nombres son de una letra: el material de EA
 * no viaja en ficheros tracked (CLAUDE.md REGLA 4).
 */
import {
  caidos,
  economia,
  esDeNoche,
  esFaseLatcheada,
  fichaRica,
  grupo,
  lunas,
  lunaSvgPath,
  nombreEquipo,
  reloj,
  trama,
  transporte,
} from "../src/tarjeta-rica.js";
import { leeDetalle } from "../src/partidas.js";
import { SAVE_SLOT_PREFIX } from "../../game/src/core/save-keys.js";

const obs = {};

/** Un registro del roster. `unido` = viaja con el Avatar (`partyStatus` 0). */
function pj(nombre, unido, extra = {}) {
  return { name: nombre, status: "G", partyStatus: unido ? 0 : 0xff, ...extra };
}

/** Roster COMPLETO de 16, con los `n` primeros unidos. Es la forma medida en los saves. */
function roster(n, extras = {}) {
  return "ABCDEFGHIJKLMNOP".split("").map((l, i) => pj(l, i < n, extras[i] ?? {}));
}

// ── LUNAS: el byte es CRUDO y su fase es `valor - 0x30` ──────────────────────────────────
// 🔴 EL CASO QUE MOTIVA TODO ESTO: un campo PRESENTE pero fuera de rango. El estado inicial
// del port trae los dos bytes a 0x00 (`init.gam` +0x2DF/+0x2E0), y un lector que sólo mirara
// «¿está?» calcularía 0 - 0x30 = LA FASE −48 y la pintaría. Se observa el par entero.
obs.lunas_latcheadas = lunas({ feluccaPhase: 52, trammelPhase: 54 }); // 0x34/0x36 → 4 y 6
obs.lunas_ausentes = lunas({}) ?? null;
obs.lunas_cero_crudo = lunas({ feluccaPhase: 0, trammelPhase: 0 }) ?? null; // ← la fase −48
obs.lunas_fuera_de_rango_alto = lunas({ feluccaPhase: 0x38, trammelPhase: 0x38 }) ?? null;
obs.lunas_borde_bajo = lunas({ feluccaPhase: 0x30, trammelPhase: 0x30 }); // fase 0 legítima
obs.lunas_borde_alto = lunas({ feluccaPhase: 0x37, trammelPhase: 0x37 }); // fase 7 legítima
// El PAR se exige entero: una latcheada y otra no ⇒ ninguna (conducta de `latchedMoonPhases`).
obs.lunas_media = lunas({ feluccaPhase: 52 }) ?? null;
obs.fase_predicado = {
  cero: esFaseLatcheada(0),
  x2f: esFaseLatcheada(0x2f),
  x30: esFaseLatcheada(0x30),
  x37: esFaseLatcheada(0x37),
  x38: esFaseLatcheada(0x38),
  ausente: esFaseLatcheada(undefined),
  texto: esFaseLatcheada("52"),
};

// ── LA LUNA DIBUJADA ─────────────────────────────────────────────────────────────────────
// Se observa el `d` de las ocho fases. Lo que el aserto mira NO es «hay una cadena» —eso
// pasaría con cualquier cosa— sino la geometría: nueva vacía, llena cerrada, y el cuarto con
// terminador RECTO (rx = 0), que es lo que distingue una luna dibujada de un círculo.
obs.luna_paths = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((f) => [f, lunaSvgPath(f)]));
// Fuera de rango se normaliza al ciclo de 8 en vez de reventar o pintar cualquier cosa.
obs.luna_ciclo = { f8: lunaSvgPath(8), f0: lunaSvgPath(0), fneg: lunaSvgPath(-1), f7: lunaSvgPath(7) };

// ── ECONOMÍA: el CERO es un dato y la AUSENCIA no ────────────────────────────────────────
// La partida recién empezada medida tenía `gems`, `skullKeys` y `magicCarpets` a 0: un
// `if (x)` los habría borrado los tres y habría dejado media bolsa sin pintar.
obs.eco_llena = economia({
  gold: 200, food: 39, keys: 1, gems: 0, torches: 4, skullKeys: 3, magicCarpets: 0, torchTurns: 0,
});
obs.eco_vacia = economia({});
obs.eco_cero_presente = economia({ gold: 0 });
// Basura tipada: un campo que no es número no se cuela como si lo fuera.
obs.eco_basura = economia({ gold: "200", food: null, keys: NaN, gems: 7 });

// ── EL GRUPO: la LISTA, y el roster son 16 SIEMPRE ───────────────────────────────────────
obs.grupo_tres = grupo(roster(3, {
  0: { name: "A", level: 2, currentHp: 44, maxHp: 60, class: "A" },
  1: { name: "B", status: "D", currentHp: 0, maxHp: 60, level: 2, class: "F" },
  2: { name: "C", level: 3, currentHp: 73, maxHp: 90, class: "B" },
}));
obs.grupo_caidos = caidos(obs.grupo_tres);
obs.grupo_los16 = grupo(roster(16)).length; // tope MAX_PARTY = 6
obs.grupo_sin_characters = grupo(undefined);
obs.grupo_solo_avatar = grupo(roster(1)).length;
// Un miembro sin nivel/hp no inventa ceros: esas claves NO salen.
obs.grupo_pelado = grupo([{ name: "A", status: "G", partyStatus: 0 }]);

// ── RECÍPROCA CONTRA `partidas.ts`: dos lectores del MISMO hecho no pueden divergir ──────
// 🔴 `tamanoGrupo()` (partidas.ts) y `grupo()` (aquí) son DOS calcos del mismo predicado del
// juego (`party.ts:171`). Calcados por separado, se separan: uno se arregla y el otro no, y
// la misma tarjeta acaba diciendo «grupo de 4» encima de una lista de 3. Se carean sobre los
// mismos testigos. `leeDetalle` necesita el almacén, así que aquí sí se monta uno.
{
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  const testigos = {
    tres: roster(3),
    uno: roster(1),
    los16: roster(16),
    con_muerto: roster(3, { 1: { status: "D" } }),
    // `partySize` mentiroso: ninguno de los dos lo lee, así que ninguno se mueve.
    partySize_falso: roster(3),
  };
  const careo = {};
  for (const [nombre, chars] of Object.entries(testigos)) {
    const st = { characters: chars, ...(nombre === "partySize_falso" ? { partySize: 99 } : {}) };
    m.set(SAVE_SLOT_PREFIX + nombre, JSON.stringify(st));
    careo[nombre] = { deLista: grupo(chars).length, deContador: leeDetalle(nombre).grupo };
  }
  obs.careo_grupo = careo;
}

// ── TRAMA: la muerte vive en questFlags, y los bitmaps ausentes NO son ceros ─────────────
const MUERTOS = {
  "shadowlord-dead:falsehood": true,
  "shadowlord-dead:hatred": true,
  "shadowlord-dead:cowardice": true,
};
obs.trama_final = trama({
  questFlags: { ...MUERTOS, "word-spoken:40": true, "search:1": true, "search:2": true },
  shrineDestroyed: [0, 0, 0, 0, 0, 0, 0, 0],
  dungeonRoomsCleared: new Array(14).fill(0),
  npcMet: new Array(128).fill(0),
  moonstones: new Array(8).fill({ buried: true }),
});
// 🔴 LA PARTIDA NUEVA: los bitmaps AUSENTES tienen que salir `undefined`, no 0. Un «0 de 8
// santuarios destruidos» sobre un campo que no está es un dato inventado con pinta de dato.
obs.trama_nueva = trama({ questFlags: {} });
obs.trama_sin_questflags = trama({});
// Un santuario destruido de verdad (bit 0x80) sí se cuenta.
obs.trama_un_santuario = trama({ questFlags: {}, shrineDestroyed: [0, 0x80, 0, 0, 0, 0, 0, 0] });
// Y los bits que NO son 0x80 no cuentan como destruido.
obs.trama_bit_ajeno = trama({ questFlags: {}, shrineDestroyed: [0x7f, 0, 0, 0, 0, 0, 0, 0] });
obs.trama_salas = trama({ questFlags: {}, dungeonRoomsCleared: [0xff, 0x01, ...new Array(12).fill(0)] });
// Un flag a `false` NO cuenta: `questFlags` guarda booleanos, y sólo `true` es un hecho.
obs.trama_flag_false = trama({ questFlags: { "shadowlord-dead:hatred": false, "search:1": false } });
obs.trama_moonstones = trama({
  questFlags: {},
  moonstones: [{ buried: true }, { buried: false }, { buried: true }],
});

// ── RELOJ Y NOCHE ────────────────────────────────────────────────────────────────────────
obs.reloj_ok = reloj({ time: { year: 139, month: 4, day: 8, hour: 10, minute: 8 } });
obs.reloj_sin_hora = reloj({ time: { year: 139, month: 4, day: 8 } }) ?? null;
obs.reloj_sin_time = reloj({}) ?? null;
// Medianoche es hora 0 y ES de noche: un `if (hora)` la habría dado por día.
obs.noche = Object.fromEntries(
  [0, 4, 5, 12, 19, 20, 23].map((h) => [h, esDeNoche({ hora: h, minuto: 0 })]),
);
obs.noche_sin_reloj = esDeNoche(undefined);

// ── TRANSPORTE ───────────────────────────────────────────────────────────────────────────
obs.transporte_pie = transporte({ transport: "foot" });
obs.transporte_barco = transporte({ transport: "ship" });
obs.transporte_ausente = transporte({}) ?? null;
// Un valor que no es de los cinco no se cuela como si lo fuera.
obs.transporte_invento = transporte({ transport: "dragon" }) ?? null;

// ── LA FICHA ENTERA ──────────────────────────────────────────────────────────────────────
// El caso «partida nueva», que es el que verá casi todo el que llegue a `/byo`: se comprueba
// que NO aparecen claves inventadas.
obs.ficha_nueva = fichaRica({
  gold: 150, karma: 75, food: 63, keys: 2, gems: 0, torches: 4,
  characters: roster(1, { 0: { name: "A", level: 2, currentHp: 20, maxHp: 20, class: "A" } }),
  time: { year: 139, month: 4, day: 5, hour: 10, minute: 41 },
  transport: "foot",
  questFlags: {},
});
obs.ficha_nueva_claves = Object.keys(obs.ficha_nueva).sort();
obs.ficha_avanzada = fichaRica({
  gold: 200, food: 39, keys: 1, skullKeys: 3, torches: 4,
  feluccaPhase: 52, trammelPhase: 54,
  characters: roster(3, {
    0: { name: "A", level: 2, currentHp: 44, maxHp: 60, class: "A" },
    1: { name: "B", status: "D", currentHp: 0, maxHp: 60 },
    2: { name: "C", level: 3, currentHp: 73, maxHp: 90 },
  }),
  time: { year: 139, month: 4, day: 8, hour: 22, minute: 8 },
  transport: "foot",
  questFlags: MUERTOS,
});
obs.ficha_avanzada_claves = Object.keys(obs.ficha_avanzada).sort();

// ══ LA VISTA: se PINTA de verdad, bajo jsdom ══════════════════════════════════════════════
//
// 🔴 SE MONTA UN DOM DE VERDAD Y SE LEE EL ÁRBOL RESULTANTE. Un aserto sobre el objeto que
// devuelve `fichaRica()` no dice nada de lo que se ve: los tres defectos que motivaron el
// fichero hermano eran datos correctos mal presentados, o al revés. Aquí se pregunta al DOM.
{
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!doctype html><body></body>");
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;

  const { seccionRica } = await import("../src/tarjeta-rica-vista.js");

  // Traductor ESPÍA: devuelve la clave marcada y APUNTA cuál se pidió. La lista de claves es
  // el contrato que la integración tiene que cumplir en `idioma.ts`, y sale de la vista.
  const pedidas = new Set();
  const t = (clave, vars) => {
    pedidas.add(clave);
    const v = vars ? " " + Object.values(vars).join("/") : "";
    return `«${clave}»${v}`;
  };

  const AVANZADA = fichaRica({
    gold: 200, food: 39, keys: 1, gems: 0, torches: 4, skullKeys: 3, magicCarpets: 0,
    feluccaPhase: 52, trammelPhase: 54,
    characters: roster(3, {
      0: { name: "A", level: 2, currentHp: 44, maxHp: 60, class: "A" },
      1: { name: "B", status: "D", currentHp: 0, maxHp: 60, level: 2 },
      2: { name: "C", level: 3, currentHp: 73, maxHp: 90 },
    }),
    time: { year: 139, month: 4, day: 8, hour: 22, minute: 8 },
    transport: "foot",
    questFlags: { ...MUERTOS, "word-spoken:40": true },
    shrineDestroyed: [0, 0x80, 0, 0, 0, 0, 0, 0],
    moonstones: new Array(8).fill({ buried: true }),
  });

  const sec = seccionRica(AVANZADA, t);
  obs.vista_es_details = sec ? sec.tagName.toLowerCase() : null;
  obs.vista_tiene_summary = sec ? sec.firstElementChild.tagName.toLowerCase() : null;
  obs.vista_bloques = sec ? [...sec.querySelectorAll(".ficha-bloque__titulo")].map((n) => n.textContent) : [];
  obs.vista_pjs = sec ? [...sec.querySelectorAll(".ficha-pj")].map((n) => n.textContent) : [];
  obs.vista_caido = sec ? sec.querySelectorAll(".ficha-pj--caido").length : -1;
  // La barra del muerto tiene que estar a 0%, no ausente y no a tope.
  obs.vista_barras = sec ? [...sec.querySelectorAll(".ficha-pj__barra-luz")].map((n) => n.style.width) : [];
  // Las dos lunas DIBUJADAS: un <path> de luz por luna (fase 4 y 6, las dos con luz).
  obs.vista_lunas_svg = sec ? sec.querySelectorAll(".ficha-luna__svg").length : -1;
  obs.vista_lunas_luz = sec ? sec.querySelectorAll(".ficha-luna__luz").length : -1;
  obs.vista_lunas_d = sec ? [...sec.querySelectorAll(".ficha-luna__luz")].map((n) => n.getAttribute("d")) : [];
  // Las claves de icono que la bolsa deja preparadas para colgar el tile.
  obs.vista_iconos = sec ? [...sec.querySelectorAll("[data-icono]")].map((n) => n.dataset.icono) : [];

  // 🔴 ADITIVIDAD: la seccion NO toca nada mas. Se cuenta el documento ANTES y DESPUES de
  // construirla; tiene que seguir vacio hasta que alguien haga el appendChild.
  obs.vista_documento_intacto = dom.window.document.body.childElementCount;

  // EQUIPO por personaje: los NOMBRES de lo que se lleva puesto (DATA.OVL DS 0x1962), con el
  // cardinal de ranuras ocupadas en el `title`.
  //
  // 🔴 LOS SEIS IDS DEL PRIMER TESTIGO ESTÁN ELEGIDOS PARA QUE LA TABLA IMPORTE. DATA.OVL
  // tiene DOS tablas de nombres sobre el MISMO índice (la corta 0x1962 y la larga 0x17f6), y
  // 15 de las 48 entradas son IDÉNTICAS en las dos («Chain Coif», «Dagger», «Ankh»…). Un
  // testigo armado con esas quince pasaría igual de verde leyendo la tabla EQUIVOCADA: el
  // aserto no instanciaría la diferencia donde existe. Los seis de aquí difieren TODOS entre
  // las dos tablas —3 Spkd. Helm/Spiked Helm · 15 Myst. Armr/Mystic Armour · 35 Chaos
  // Swrd/Sword of Chaos · 4 Sm. Shield/Small Shield · 42 Inv. Ring/Ring of Invisibility ·
  // 45 Am/Turning/Amulet/Turning—, así que cambiar de tabla mueve las seis a la vez. Y cada
  // uno va en la ranura que le toca por la tabla de TIPOS (DS 0x1a7e), no en una cualquiera.
  const EQ = seccionRica(
    fichaRica({
      characters: [
        { name: "E", status: "G", partyStatus: 0, helmet: 3, armor: 15, weapon: 35,
          shield: 4, ring: 42, amulet: 45 },
        // Ninguna ranura en el registro ⇒ la linea NO se pinta (no «0/6», no «sin equipo»).
        { name: "F", status: "G", partyStatus: 0 },
        // Las seis vacias ⇒ «sin equipo», que es un dato MEDIDO y si se pinta.
        { name: "G", status: "G", partyStatus: 0, helmet: 0xff, armor: 0xff, weapon: 0xff,
          shield: 0xff, ring: 0xff, amulet: 0xff },
        // PARCIAL: 2 de 6, para que el orden del registro y el salto de las vacias se vean.
        { name: "H", status: "G", partyStatus: 0, helmet: 0xff, armor: 9, weapon: 0xff,
          shield: 0xff, ring: 0xff, amulet: 47 },
        // 🔴 ID FUERA DE LA TABLA (51 > 47): la ranura ESTÁ ocupada —el cardinal la cuenta—
        // pero no hay nombre que dar. Se calla en vez de inventar. Sin este testigo, quitar
        // la guarda de rango dejaria pasar un `undefined` a la lista pintada.
        { name: "I", status: "G", partyStatus: 0, helmet: 51, armor: 0xff, weapon: 16,
          shield: 0xff, ring: 0xff, amulet: 0xff },
      ],
      questFlags: {},
    }),
    t,
  );
  obs.vista_equipo = EQ ? [...EQ.querySelectorAll(".ficha-pj__equipo")].map((n) => n.textContent) : [];
  // El cardinal no desaparece: se va al `title`. Se observa aparte para que un aserto pueda
  // exigir que la linea de «I» diga 2 ranuras aunque solo nombre una.
  obs.vista_equipo_title = EQ
    ? [...EQ.querySelectorAll(".ficha-pj__equipo")].map((n) => n.getAttribute("title"))
    : [];

  // Y los DATOS detras de esa vista, sin DOM de por medio.
  obs.equipo_datos = grupo([
    { name: "E", status: "G", partyStatus: 0, helmet: 3, armor: 15, weapon: 35,
      shield: 4, ring: 42, amulet: 45 },
    { name: "F", status: "G", partyStatus: 0 },
    { name: "G", status: "G", partyStatus: 0, helmet: 0xff, armor: 0xff, weapon: 0xff,
      shield: 0xff, ring: 0xff, amulet: 0xff },
    { name: "I", status: "G", partyStatus: 0, helmet: 51, armor: 0xff, weapon: 16,
      shield: 0xff, ring: 0xff, amulet: 0xff },
  ]).map((m) => ({ nombre: m.nombre, equipados: m.equipados ?? null, equipo: m.equipo ?? null }));

  // `nombreEquipo` sobre los bordes de la tabla y sobre lo que no es un id. Los dos extremos
  // (0 y 47) van porque un off-by-one en cualquiera de las dos puntas es invisible en medio.
  obs.nombre_equipo = {
    primero: nombreEquipo(0) ?? null,
    ultimo: nombreEquipo(47) ?? null,
    centinela: nombreEquipo(0xff) ?? null,
    pasado_el_final: nombreEquipo(48) ?? null,
    negativo: nombreEquipo(-1) ?? null,
    fraccion: nombreEquipo(3.5) ?? null,
    texto: nombreEquipo("3") ?? null,
    ausente: nombreEquipo(undefined) ?? null,
  };

  // LA INSIGNIA de partida en curso.
  const { insigniaEnCurso } = await import("../src/tarjeta-rica-vista.js");
  const ins = insigniaEnCurso(t);
  obs.insignia_texto = ins.textContent;
  obs.insignia_clase = ins.className;
  obs.insignia_title = ins.title;

  // 🔴 EL TESTIGO QUE FALTABA: un miembro SIN `maxHp` y otro con `maxHp: 0`. Sin estos dos,
  // quitar la guarda `maxHp > 0` no cambiaba NADA observable —todos los testigos de arriba
  // traen denominador sano— y el mutante sobrevivia: el aserto no instanciaba la diferencia
  // donde existe. Con `maxHp` ausente no hay fraccion posible; con 0, `hp/0` da Infinity y el
  // recorte a 100 pinta LA BARRA LLENA sobre alguien sin salud modelada.
  const RAROS = seccionRica(
    fichaRica({
      characters: [
        { name: "S", status: "G", partyStatus: 0, currentHp: 5 },
        { name: "T", status: "G", partyStatus: 0, currentHp: 5, maxHp: 0 },
        { name: "U", status: "G", partyStatus: 0, currentHp: 9, maxHp: 10 },
      ],
      questFlags: {},
    }),
    t,
  );
  obs.vista_barras_raras = RAROS ? [...RAROS.querySelectorAll(".ficha-pj__barra-luz")].map((n) => n.style.width) : [];
  obs.vista_hp_raros = RAROS ? [...RAROS.querySelectorAll(".ficha-pj__hp")].map((n) => n.textContent) : [];

  // PARTIDA NUEVA: sin lunas, sin bitmaps. El bloque «Mundo» no puede traer un par de discos
  // negros (se leerian como dos lunas nuevas MEDIDAS) ni la trama un «0 de 8» inventado.
  const NUEVA = fichaRica({
    gold: 150, food: 63, keys: 2, gems: 0, torches: 4,
    characters: roster(1, { 0: { name: "A", level: 2, currentHp: 20, maxHp: 20, class: "A" } }),
    time: { year: 139, month: 4, day: 5, hour: 10, minute: 41 },
    transport: "foot",
    questFlags: {},
  });
  const secN = seccionRica(NUEVA, t);
  obs.vista_nueva_lunas = secN ? secN.querySelectorAll(".ficha-luna__svg").length : -1;
  obs.vista_nueva_filas = secN ? [...secN.querySelectorAll(".ficha-fila__rotulo")].map((n) => n.textContent) : [];
  obs.vista_nueva_bloques = secN ? [...secN.querySelectorAll(".ficha-bloque__titulo")].map((n) => n.textContent) : [];

  // UNA PARTIDA SIN NADA: la seccion no existe, en vez de un desplegable vacio que promete.
  // UNA PARTIDA SIN NADA: la seccion NO EXISTE, en vez de un desplegable vacio que promete
  // informacion y no la da. Se construye desde `fichaRica()` sobre un estado PELADO, no a
  // mano: un objeto escrito aqui podria no ser producible por el lector real.
  const PELADA = fichaRica({});
  obs.vista_pelada_ficha = PELADA;
  obs.vista_pelada_es_null = seccionRica(PELADA, t) === null;

  // ── LA PARTIDA EN CURSO: el maximo por timestamp, RE-DERIVADO ─────────────────────────
  // 🔴 El testigo llega DESORDENADO a proposito. Hoy `leeInventario()` entrega la lista ya
  // ordenada, asi que un `[0]` pelado acertaria — pero es una precondicion que el modulo no
  // controla, y con ella rota la tarjeta señalaria como «en curso» una que no es la que
  // Journey Onward recargaria.
  const { idEnCurso } = await import("../src/tarjeta-rica.js");
  obs.en_curso_desordenado = idEnCurso([
    { id: "a", timestamp: 100 },
    { id: "b", timestamp: 300 },
    { id: "c", timestamp: 200 },
  ]);
  obs.en_curso_ordenado = idEnCurso([
    { id: "b", timestamp: 300 },
    { id: "c", timestamp: 200 },
    { id: "a", timestamp: 100 },
  ]);
  obs.en_curso_vacio = idEnCurso([]);
  // Un registro sin timestamp no puede ganar: se salta, y gana el mayor de los sanos.
  obs.en_curso_sin_timestamp = idEnCurso([
    { id: "roto" },
    { id: "c", timestamp: 200 },
    { id: "a", timestamp: 100 },
  ]);

  // EL CONTRATO DE i18n: el conjunto EXACTO de claves que la vista pide.
  obs.vista_claves = [...pedidas].sort();
}

process.stdout.write(JSON.stringify(obs, null, 1) + "\n");
