/**
 * ARNÉS de LLEVARSE UNA PARTIDA (descargar / traer) y del RÉGIMEN LIMPIO del popover.
 *
 * Corre las funciones REALES de `demo-byo/src/exporta.ts` y `demo-byo/src/popover-replay.ts`
 * —las mismas que se envían al navegador, importadas del fichero— y vuelca lo observado como
 * JSON en stdout. Quien asevera es `re/tools/test_byo_transferencia.py`.
 *
 * ── POR QUÉ EL ARNÉS NO ASEVERA ─────────────────────────────────────────────────────────
 * Mismo contrato que `verifica-tarjeta.mjs`: para que no pueda aprobarse a sí mismo. Aquí
 * sólo se PRODUCEN observaciones; el juicio vive en el pytest, que está en la batería de
 * aterrizaje. Si esto revienta no hay JSON y el pytest se pone rojo por ausencia de datos —
 * la única condición de «no medido» que vale en una ruta de medición.
 *
 * ── TODO SINTÉTICO, NI UN BYTE DE EA ────────────────────────────────────────────────────
 * Un `.gam` de una partida real lleva el roster de 16 registros de Ultima V, que JAMÁS entra
 * en un fichero tracked (CLAUDE.md REGLA 4). El estado de aquí se construye con
 * `createNewGame` sobre un `ExtractedInitialState` inventado: nombres de una palabra que no
 * son de nadie, cifras redondas y una plantilla a ceros.
 */
import { createNewGame } from "../../game/src/core/state.js";
import { exportNativeSave, SAVED_GAM_SIZE } from "../../game/src/core/saveNative.js";
import { SAVES_INDEX_KEY, SAVE_SLOT_PREFIX } from "../../game/src/core/save-keys.js";
import { JSDOM } from "jsdom";

/** ¿Se tuvo que poner el sustituto de `<dialog>`? Viaja al informe: es una parcialidad. */
let obsSustituto = false;

/**
 * ── UN NAVEGADOR DE MENTIRA, Y ENTERO ───────────────────────────────────────────────────
 * 🔴 NO BASTA CON UN `localStorage` DE JUGUETE, y costó un rojo averiguarlo: `exporta.ts`
 * llama a `txt()` para los rótulos de un `.gam` sin sobre, y `txt()` resuelve el idioma con
 * `idiomaActual()`, que lee de `window` (`game/src/web/arranque.ts:90`). O sea que la parte
 * «pura» del módulo toca el DOM por una rama que no se ve desde su firma. Con jsdom se mide
 * el fichero TAL CUAL SE ENVÍA en vez de una versión suya sin esa rama — que es justo lo que
 * un almacén de mentira habría escondido.
 *
 * `url` NO es decorativo: jsdom se niega a dar `localStorage` en un origen opaco
 * (`about:blank`), y sin él `persistence.ts` no puede escribir el índice.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://openu5.test/byo",
  pretendToBeVisual: true,
});
const w = dom.window;
// `navigator` NO se copia: node ya trae el suyo y es de sólo lectura. Da igual — el
// resolvedor de idioma consulta `window.navigator`, que sí es el de jsdom.
for (const k of ["window", "document", "localStorage", "HTMLElement", "Node",
  "Event", "KeyboardEvent", "CustomEvent", "HTMLDialogElement", "getComputedStyle",
  "DOMException", "Blob"]) {
  if (w[k] !== undefined) globalThis[k] = w[k];
}
// 🔴 LOS TEMPORIZADORES NO SE SUSTITUYEN, y esto costó un rojo de los que engañan: con
// `globalThis.setTimeout = w.setTimeout.bind(w)`, el `setTimeout` de jsdom se llama a SÍ
// MISMO (por dentro usa el global) y revienta con «Maximum call stack size exceeded». El
// síntoma no apuntaba aquí: salía como `installImportedSave` devolviendo `{ok:false,
// reason:"unknown"}` —o sea «este navegador no deja guardar»— porque `putSave` envuelve la
// escritura en un try/catch. Un fallo del ARNÉS disfrazado de fallo del SUJETO.
// Los de node valen: `popover-replay.ts` usa el global, no el de `window`.

/**
 * ⚠ PARCIALIDAD DECLARADA: jsdom 29.1.1 NO implementa `<dialog>` (`showModal` no existe).
 * Se le pone el sustituto MÍNIMO de abajo, y con él este arnés NO mide —ni pretende— el
 * cierre nativo con Escape, la trampa de foco ni el `::backdrop`: eso lo pone el navegador
 * y se mira en `verifica-estados.mjs`, que corre fuera de la batería. Lo que sí queda
 * medido aquí es TODO lo que este módulo añade: la clase del régimen, el encendido y el
 * apagado por temporizador, el foco inicial, y que nadie intercepte la tecla Escape.
 */
if (typeof w.HTMLDialogElement?.prototype?.showModal !== "function") {
  w.HTMLDialogElement = w.HTMLDialogElement ?? class {};
  const proto = w.HTMLElement.prototype;
  proto.showModal = function () { this.open = true; this.setAttribute("open", ""); };
  proto.close = function () {
    this.open = false;
    this.removeAttribute("open");
    this.dispatchEvent(new w.Event("close"));
  };
  obsSustituto = true;
}

// Los módulos se importan DESPUÉS del navegador de mentira: varios resuelven cosas de
// `window` en el primer uso y alguno podría hacerlo al cargarse.
const {
  componeFichero,
  nombreDeFichero,
  leeFichero,
  instalaFichero,
  preparaDescarga,
  montaTransferencia,
} = await import("../src/exporta.js");
const { txt, congelaIdioma } = await import("../src/idioma.js");

/** Las ranuras que hay ahora mismo en el almacén (contadas, no supuestas). */
const ranuras = () =>
  Object.keys(w.localStorage).filter((k) => k.startsWith(SAVE_SLOT_PREFIX)).length;
const indiceCrudo = () => w.localStorage.getItem(SAVES_INDEX_KEY);

const obs = {};

// ══ EL ESTADO SINTÉTICO ═══════════════════════════════════════════════════════════════════

function pj(nombre, unido) {
  return {
    name: nombre, gender: 0x0b, class: "A", status: "G", strength: 20, dexterity: 18,
    intelligence: 22, currentMp: 15, currentHp: 100, maxHp: 100, exp: 1000, level: 3,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: unido ? 0 : 0xff,
  };
}

function initSintetico() {
  return {
    characters: [pj("Testigo", true), pj("Segundo", true), pj("Tercero", true),
      ...Array.from({ length: 13 }, (_, i) => pj(`Slot${i}`, false))],
    food: 500, gold: 4242, keys: 3, gems: 7, torches: 12, skullKeys: 1, grapple: true,
    magicCarpets: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    spellQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    moonstones: Array.from({ length: 8 }, (_, i) => ({ x: i, y: 0, buried: true, z: 0 })),
    partySize: 3, year: 139, month: 4, day: 5, hour: 8, minute: 35, karma: 75,
    turnsSinceStart: 100, activeCharacter: 0, location: 0, floor: 0, x: 80, y: 90,
    torchTurns: 40,
    npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
    npcMet: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
  };
}

/**
 * ★ EL TESTIGO INSTANCIA LA DIFERENCIA DONDE EXISTE. El estado lleva a propósito TRES campos
 * que el SAVED.GAM de 1988 NO puede guardar y que sólo viajan en el sobre: una bandera de
 * trama (los Shadowlords muertos, que es la que sale mal en la tarjeta si se pierde), un
 * objeto del mundo (la clase de la ficha #106) y el diario. Sin ellos, el test de la ida y
 * vuelta pasaría igual con el sobre BORRADO — sería verde por el testigo, no por el código.
 */
function estadoConSidecar() {
  const s = createNewGame(initSintetico());
  s.questFlags = { "shadowlord-dead:falsehood": true, "shadowlord-dead:hatred": true };
  s.worldObjects = [{ kind: "frigate", x: 20, y: 130, floor: 0 }];
  s.journal = [{ turn: 7, text: "una linea de diario" }];
  return s;
}

const PLANTILLA = new Uint8Array(SAVED_GAM_SIZE); // a ceros: sin extracción, ver `plantilla()`
const META = { name: "Mi partida", locationName: "Britannia", turns: 100, timestamp: 1_754_600_000_000 };

// ══ IDA Y VUELTA ══════════════════════════════════════════════════════════════════════════

const estado = estadoConSidecar();
const fichero = componeFichero(estado, META, PLANTILLA);
obs.tam_fichero = fichero.length;
obs.tam_gam = SAVED_GAM_SIZE;

// El prefijo del fichero ES el `.gam` que emite el códec, byte a byte. Si esto falla, la
// promesa «lo que se descarga es un SAVED.GAM nativo» es falsa.
const gamSolo = exportNativeSave(estado, PLANTILLA).gam;
obs.prefijo_es_el_gam_del_codec = igual(fichero.subarray(0, SAVED_GAM_SIZE), gamSolo);

// IDA Y VUELTA: fichero → estado → fichero. Los bytes tienen que salir IDÉNTICOS.
const vuelta = leeFichero(fichero);
obs.vuelta_ok = vuelta.ok;
obs.vuelta_degradado = vuelta.ok ? vuelta.degradado : "(rechazado)";
obs.vuelta_meta = vuelta.ok ? vuelta.meta : null;
if (vuelta.ok) {
  const rehecho = componeFichero(vuelta.state, vuelta.meta, PLANTILLA);
  obs.ida_vuelta_gam_identico = igual(rehecho.subarray(0, SAVED_GAM_SIZE), fichero.subarray(0, SAVED_GAM_SIZE));
  obs.ida_vuelta_fichero_identico = igual(rehecho, fichero);
  // 🔴 EL SOBRE NO ES IDÉNTICO EN LA PRIMERA VUELTA, Y NO ES UN DEFECTO: `importNativeSave`
  // pasa por `createNewGame`, que MATERIALIZA los opcionales que el estado de origen tenía
  // en `undefined` (`openDoors: []`, `mapOverrides: {}`, `overworldEnemies: []`…). El
  // sidecar de la segunda pasada los lleva escritos y el de la primera no: mismo estado,
  // más explícito. Lo que sí tiene que cumplirse —y es lo que se mide— es que a partir de
  // ahí sea PUNTO FIJO: la tercera pasada da exactamente la segunda. Sin esta observación,
  // «no idéntico» se leería como pérdida.
  const otra = leeFichero(rehecho);
  obs.punto_fijo_desde_la_segunda = otra.ok && igual(componeFichero(otra.state, otra.meta, PLANTILLA), rehecho);
  // Los tres campos que SÓLO viajan en el sobre.
  obs.vuelta_questflags = vuelta.state.questFlags?.["shadowlord-dead:falsehood"] === true;
  obs.vuelta_worldobjects = (vuelta.state.worldObjects ?? []).length;
  obs.vuelta_journal = (vuelta.state.journal ?? []).length;
  // Y uno que viaja en los BYTES, de control: si esto fallara, el fallo no sería del sobre.
  obs.vuelta_oro = vuelta.state.gold;
}

// El `.gam` PELADO: los mismos 4192 B sin cola. Entra, pero sin lo del sobre — y lo DICE.
const pelado = fichero.slice(0, SAVED_GAM_SIZE);
const vp = leeFichero(pelado);
obs.pelado_ok = vp.ok;
obs.pelado_degradado = vp.ok ? vp.degradado : "(rechazado)";
obs.pelado_questflags = vp.ok ? Object.keys(vp.state.questFlags ?? {}).length : null;
obs.pelado_worldobjects = vp.ok ? (vp.state.worldObjects ?? []).length : null;
obs.pelado_oro = vp.ok ? vp.state.gold : null; // los bytes del .gam SÍ llegan
obs.pelado_lugar = vp.ok ? vp.meta.locationName : null;

// SOBRE ROTO: la marca está pero el JSON no parsea. Degrada, NO rechaza.
const roto = concat(pelado, new TextEncoder().encode("U5PARTIDA1\n{esto no es json"));
const vr = leeFichero(roto);
obs.sobre_roto_ok = vr.ok;
obs.sobre_roto_degradado = vr.ok ? vr.degradado : "(rechazado)";

// SOBRE DE OTRA VERSIÓN: JSON válido con la marca delante, pero no es lo nuestro.
const ajeno = concat(pelado, new TextEncoder().encode('U5PARTIDA1\n{"formato":"otra-cosa","version":9}'));
const va = leeFichero(ajeno);
obs.sobre_ajeno_ok = va.ok;
obs.sobre_ajeno_degradado = va.ok ? va.degradado : "(rechazado)";

// SOBRE con la ENVOLTURA buena y el SIDECAR con forma equivocada. `importNativeSave` lo
// copiaría sin preguntar y dejaría `questFlags` en `undefined` y `transport` con una cadena
// que nadie espera; y el validador de después NO mira ninguno de esos campos. Tres formas:
for (const [nombre, cuerpo] of [
  ["sidecar_cadena", '{"formato":"openu5-partida","version":1,"sidecar":"hola"}'],
  ["sidecar_sin_gamestate", '{"formato":"openu5-partida","version":1,"sidecar":{"qol":{"journal":[]}}}'],
  ["sidecar_diario_no_es_lista", '{"formato":"openu5-partida","version":1,"sidecar":{"qol":{"journal":7},"gameState":{}}}'],
]) {
  const f = concat(pelado, new TextEncoder().encode("U5PARTIDA1\n" + cuerpo));
  const l = leeFichero(f);
  obs[nombre + "_ok"] = l.ok;
  obs[nombre + "_degradado"] = l.ok ? l.degradado : "(rechazado)";
}
// CONTROL: un sidecar MÍNIMO PERO SANO sí se acepta como sobre bueno — si no, la guarda de
// arriba estaría rechazando por «no es idéntico al mío» y no por «no tiene la forma».
{
  const f = concat(pelado, new TextEncoder().encode(
    'U5PARTIDA1\n{"formato":"openu5-partida","version":1,"meta":{"name":"N","locationName":"L","turns":1,"timestamp":1},"sidecar":{"qol":{"journal":[]},"gameState":{"transport":"foot","questFlags":{}}}}'));
  const l = leeFichero(f);
  obs.sidecar_minimo_ok = l.ok;
  obs.sidecar_minimo_degradado = l.ok ? l.degradado : "(rechazado)";
  obs.sidecar_minimo_nombre = l.ok ? l.meta.name : null;
}

// ══ RECHAZOS ══════════════════════════════════════════════════════════════════════════════
// Cada uno rompe UN invariante del formato, uno a uno, sobre un fichero por lo demás bueno:
// es la forma de saber que el predicado que lo caza es el que se cree y no otro.

obs.rechazo_corto = motivo(leeFichero(new Uint8Array(1000)));
obs.rechazo_vacio = motivo(leeFichero(new Uint8Array(0)));
obs.rechazo_ceros = motivo(leeFichero(new Uint8Array(SAVED_GAM_SIZE))); // 4192 B de nada
obs.rechazo_grupo_0 = motivo(leeFichero(conByte(pelado, 0x2b5, 0)));
obs.rechazo_grupo_7 = motivo(leeFichero(conByte(pelado, 0x2b5, 7)));
obs.rechazo_avatar_fuera = motivo(leeFichero(conByte(pelado, 0x02 + 0x1f, 0xff)));
obs.rechazo_nombre_basura = motivo(leeFichero(conByte(pelado, 0x02, 0x01)));
obs.rechazo_mes_0 = motivo(leeFichero(conByte(pelado, 0x2d7, 0)));
obs.rechazo_mes_13 = motivo(leeFichero(conByte(pelado, 0x2d7, 13)));
obs.rechazo_dia_0 = motivo(leeFichero(conByte(pelado, 0x2d8, 0)));
obs.rechazo_hora_24 = motivo(leeFichero(conByte(pelado, 0x2d9, 24)));
obs.rechazo_minuto_60 = motivo(leeFichero(conByte(pelado, 0x2db, 60)));
// CONTROL NEGATIVO del validador: un byte que NO es de los que se miran no puede rechazar.
// Sin esto, un validador que dijera «no» a cualquier cambio pasaría los once de arriba.
obs.control_byte_indiferente = motivo(leeFichero(conByte(pelado, 0x400, 0xaa)));
// Y el otro control: un fichero de 4191 B es corto; uno de 4192 B bueno, no.
obs.control_4191 = motivo(leeFichero(pelado.slice(0, SAVED_GAM_SIZE - 1)));

// ══ EL NOMBRE DEL FICHERO ═════════════════════════════════════════════════════════════════

obs.nombre = nombreDeFichero(estado, META);
obs.nombre_con_signos = nombreDeFichero(estado, { ...META, locationName: "Serpent's Hold / B1" });
obs.nombre_sin_lugar = nombreDeFichero(estado, { ...META, locationName: "" });

// ══ EL ÍNDICE NO SE TOCA SI EL FICHERO NO VALE ════════════════════════════════════════════

obs.indice_antes = indiceCrudo();
const malo = instalaFichero(new Uint8Array(SAVED_GAM_SIZE));
obs.instala_malo_ok = malo.ok;
obs.indice_tras_rechazo = indiceCrudo();
obs.ranuras_tras_rechazo = ranuras();

const bueno = instalaFichero(fichero);
obs.instala_bueno_ok = bueno.ok;
obs.instala_bueno_degradado = bueno.ok ? bueno.degradado : null;
obs.ranuras_tras_exito = ranuras();
const indice = JSON.parse(indiceCrudo() ?? "[]");
obs.indice_tras_exito = indice.map((m) => ({ name: m.name, locationName: m.locationName, turns: m.turns }));

// La procedencia de un momento SOBREVIVE al traslado; su `momentoId` NO (es el id de OTRA
// ranura, en el navegador que lo sembró).
const ficheroMomento = componeFichero(estado, { ...META, provenance: "momento" }, PLANTILLA);
const bm = instalaFichero(ficheroMomento);
const indice2 = JSON.parse(indiceCrudo() ?? "[]");
const filaMomento = indice2.find((m) => m.id === (bm.ok ? bm.id : ""));
obs.momento_provenance = filaMomento?.provenance ?? null;
obs.momento_momentoId = filaMomento?.momentoId ?? null;
// Y dos importaciones del MISMO fichero dan DOS ranuras, no una pisada: la segunda copia es
// una partida distinta desde el momento en que se juega.
const bm2 = instalaFichero(fichero);
obs.dos_importaciones_dan_dos_ranuras =
  bueno.ok && bm2.ok && bueno.id !== bm2.id &&
  ranuras() === 3; // bueno + momento + esta segunda copia (el rechazado no dejó nada)

// ══ LA DESCARGA: DE UNA RANURA DEL ALMACÉN A LOS BYTES DEL FICHERO ════════════════════════
// 🔴 Este bloque existe POR UN MUTANTE. Antes se llamaba a `componeFichero` con una cabecera
// hecha a mano aquí, y el mutante que borraba el viaje de `provenance` SOBREVIVÍA: la línea
// que construye la cabecera desde el `SaveMeta` de la ranura no la ejecutaba nadie. Ahora se
// entra por `preparaDescarga`, que es el camino de verdad (menos el `click()`).
{
  const idx = JSON.parse(indiceCrudo() ?? "[]");
  const fila = idx[0]; // la partida que se instaló arriba, con su id real
  const listo = await preparaDescarga(fila);
  obs.descarga_hay_fichero = !!listo;
  obs.descarga_nombre = listo?.nombre ?? null;
  const l = listo ? leeFichero(listo.bytes) : null;
  obs.descarga_relee_ok = l?.ok ?? null;
  obs.descarga_relee_meta = l?.ok ? l.meta : null;
  obs.descarga_relee_questflags = l?.ok ? l.state.questFlags?.["shadowlord-dead:falsehood"] === true : null;

  // La MISMA ruta con una partida de procedencia «momento»: la insignia tiene que estar en la
  // cabecera del fichero que sale.
  const filaMom = idx.find((m) => m.provenance === "momento") ?? indice2.find((m) => m.provenance === "momento");
  const listoMom = filaMom ? await preparaDescarga(filaMom) : null;
  const lm = listoMom ? leeFichero(listoMom.bytes) : null;
  obs.descarga_provenance = lm?.ok ? (lm.meta.provenance ?? null) : "(no se pudo)";
  obs.descarga_momentoId = lm?.ok ? (lm.meta.momentoId ?? null) : "(no se pudo)";

  // Una ranura que no existe no produce fichero (ni lanza).
  obs.descarga_de_ranura_fantasma = await preparaDescarga({ ...fila, id: "no-existe" });
}

// ══ LAS CLAVES DE IDIOMA DE CADA MOTIVO ═══════════════════════════════════════════════════
// 🔴 El aviso se compone con `"importaRechazo_" + motivo`, y `txt()` DEVUELVE LA PROPIA CLAVE
// cuando no la encuentra: una clave mal escrita no da error, saca «importaRechazo_x» en
// pantalla. El compilador no ve este acoplamiento; esto sí.
obs.claves_i18n = {};
for (const m of ["corto", "no-es-partida", "codec", "almacen"]) {
  const clave = "importaRechazo_" + m;
  obs.claves_i18n[clave] = txt(clave, { detalle: "X" }) !== clave;
}
for (const clave of ["importaHecho", "importaHechoSinSobre", "importaHechoSobreRoto",
  "partidaDescargar", "importaNombrePorDefecto", "importaLugarDesconocido"]) {
  obs.claves_i18n[clave] = txt(clave) !== clave;
}

// ══ QUE SE ENCUENTREN (#229) ══════════════════════════════════════════════════════════════
// 🔴 EL REPORTE DEL USUARIO FUE «en /byo no hay export ni import» CON LA MAQUINARIA MONTADA Y
// VISIBLE: lo que faltaba no era el control, eran las PALABRAS con las que se busca y el
// SITIO donde se mira. Los tres asertos de abajo son lo que ese reporte pedía y ningún test
// anterior miraba — todo lo demás de este arnés mide que la transferencia FUNCIONA, no que
// se ENCUENTRE. Se mide sobre el DOM que monta la función de verdad, en los DOS idiomas.
obs.descubrimiento = mideElDescubrimiento();

function mideElDescubrimiento() {
  const r = {};
  for (const lang of ["es", "en"]) {
    congelaIdioma(lang);
    // La raíz imita lo que pinta `partidas.ts`: la sección de partidas (con su modificador,
    // que es el ancla) y detrás la de repeticiones. Sin la segunda no se podría distinguir
    // «se insertó en medio» de «se apendizó al final», que es justo el defecto.
    const raiz = w.document.createElement("div");
    raiz.innerHTML =
      '<section class="guardados guardados--partidas">' +
      '<ul class="guardados__lista"><li class="guardado" data-partida="slot-1">' +
      '<div class="guardado__info"></div></li></ul></section>' +
      '<section class="guardados guardados--repeticiones"></section>';
    montaTransferencia(raiz, [
      { id: "slot-1", name: "N", timestamp: 1, turns: 1, locationName: "L" },
    ]);
    const clases = [...raiz.children].map((n) => n.className);
    const titulo = raiz.querySelector(".importa .guardados__titulo")?.textContent ?? "";
    r[lang] = {
      // (1) ORDEN: el bloque va DETRÁS de partidas y DELANTE de repeticiones.
      orden: clases,
      importa_tras_partidas: clases.indexOf("importa") === 1,
      // (2) LAS PALABRAS que la gente busca, en el título del bloque.
      titulo,
      // (3) La EXPORTACIÓN se nombra aunque no haya ningún botón que mirar: el texto del
      //     bloque la explica, y el botón por tarjeta sigue estando.
      texto_bloque: raiz.querySelector(".importa")?.textContent ?? "",
      hay_boton_descarga: raiz.querySelectorAll(".guardado__descarga").length,
    };
  }
  // Y el CONTROL de que la lista vacía —el navegador recién estrenado, que es el caso del
  // reporte— sigue nombrando las dos operaciones aunque no exista ni una tarjeta.
  congelaIdioma("es");
  const vacia = w.document.createElement("div");
  vacia.innerHTML = '<section class="guardados guardados--partidas"></section>';
  montaTransferencia(vacia, []);
  r.sin_partidas_texto = vacia.querySelector(".importa")?.textContent ?? "";
  r.sin_partidas_botones = vacia.querySelectorAll(".guardado__descarga").length;
  congelaIdioma(null);
  return r;
}

// ══ EL RÉGIMEN LIMPIO DEL POPOVER (jsdom) ═════════════════════════════════════════════════

obs.popover = await mideElPopover();

async function mideElPopover() {
  const { abreReplay } = await import("../src/popover-replay.js");
  const r = {};
  try {
    abreReplay("rep-1", "Mi repeticion");
  } catch (e) {
    return { error: String(e) };
  }
  const dlg = w.document.querySelector("dialog.replay-modal");
  const barra = dlg?.querySelector(".replay-modal__barra");
  const cerrar = barra?.querySelector(".replay-modal__cerrar");
  r.sustituto_de_dialog = obsSustituto;
  r.hay_dialogo = !!dlg;
  r.dialogo_modal = dlg?.open === true;
  // El régimen: la barra lleva la clase que la apaga, y la de mostrar sale y entra sola.
  r.barra_tiene_regimen = barra?.classList.contains("replay-modal__barra--limpia") ?? null;
  r.barra_visible_al_abrir = barra?.classList.contains("mostrada") ?? null;
  // El foco inicial NO está en el botón: si lo estuviera, `:focus-within` dejaría la barra
  // encendida desde la apertura y el popover abriría con el cromo puesto.
  r.foco_inicial_es_el_dialogo = w.document.activeElement === dlg;
  r.foco_inicial_es_el_boton = w.document.activeElement === cerrar;
  // El botón de cerrar sigue siendo un BOTÓN de verdad y sigue siendo enfocable.
  r.cerrar_es_boton = cerrar?.tagName ?? null;
  cerrar?.focus();
  r.cerrar_enfocable = w.document.activeElement === cerrar;

  // Escape: nadie se lo come. Este módulo no pone escuchadores de teclado, y si alguien
  // añadiera uno con `preventDefault` el `<dialog>` dejaría de cerrarse con Escape — que es
  // la única forma en que ESTE código puede romperlo (el cierre lo hace el navegador).
  const esc = new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  cerrar?.dispatchEvent(esc);
  r.escape_no_interceptado = esc.defaultPrevented === false;

  // AUTO-APAGADO: se espera de verdad al temporizador. Es la propiedad entera («se aparta
  // sola»), y comprobar sólo que la clase existe habría pasado verde con el `setTimeout`
  // borrado.
  await new Promise((res) => w.setTimeout(res, 2600));
  r.barra_apagada_tras_esperar = barra?.classList.contains("mostrada") === false;

  // Y VUELVE con el ratón. Se emite sobre el DIÁLOGO porque es donde vive el escuchador:
  // un `pointermove` dentro del iframe no cruza al documento padre (ver la cabecera del
  // módulo), y por eso mirar la partida no la enciende.
  dlg?.dispatchEvent(new w.Event("pointermove", { bubbles: true }));
  r.barra_vuelve_con_raton = barra?.classList.contains("mostrada") ?? null;
  // Y con el DEDO, que no genera movimiento.
  await new Promise((res) => w.setTimeout(res, 2600));
  r.barra_apagada_otra_vez = barra?.classList.contains("mostrada") === false;
  dlg?.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  r.barra_vuelve_con_dedo = barra?.classList.contains("mostrada") ?? null;

  // El evento `close` —por el que pasan el botón, el fondo Y el Escape— desmonta del todo.
  dlg?.dispatchEvent(new w.Event("close"));
  r.tras_close_dialogo_fuera = w.document.querySelector("dialog.replay-modal") === null;
  r.tras_close_iframes = w.document.querySelectorAll("iframe").length;
  return r;
}

// ══ utilidades ════════════════════════════════════════════════════════════════════════════

function igual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function concat(a, b) {
  const o = new Uint8Array(a.length + b.length);
  o.set(a, 0);
  o.set(b, a.length);
  return o;
}
/** Copia con UN byte cambiado. Cada rechazo rompe un invariante y sólo uno. */
function conByte(base, off, valor) {
  const c = base.slice();
  c[off] = valor;
  return c;
}
/** `null` si el fichero fue ACEPTADO; el motivo si no. */
function motivo(l) {
  return l.ok ? null : l.motivo;
}

process.stdout.write(JSON.stringify(obs, null, 1));
