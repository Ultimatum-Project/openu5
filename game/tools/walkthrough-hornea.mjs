/**
 * HORNEADO del PAQUETE DE SAVES DEL WALKTHROUGH — los `.u5gam` numerados + su README.
 *
 * Uso:
 *   node --import tsx game/tools/walkthrough-hornea.mjs <dir-de-salida>
 *
 * ── QUÉ PRODUCE ─────────────────────────────────────────────────────────────────────────
 *   <dir>/NN-<slug>.u5gam   — 21 ficheros, el formato que come el dropzone de /jugar
 *   <dir>/README.md         — la tabla del recorrido, en español
 *
 * ── 🔴 EL DESTINO TIENE QUE ESTAR FUERA DEL REPO, Y EL SCRIPT LO EXIGE ───────────────────
 * Misma guarda —y por la misma razón medida— que `demo-byo/momentos/hornea.mjs`: los 4192 B de
 * cada `.u5gam` llevan dentro el roster de 16 registros extraído del `INIT.GAM` de EA (nombres,
 * cifras y equipo de los compañeros). CLAUDE.md REGLA 4 lo prohíbe en ficheros tracked, y el
 * autor de aquel script ya se encontró los bytes en `git status` listos para colarse por haber
 * apuntado a `.claude/` «porque es temporal». Aquí para el script, no el acuerdo.
 *
 * ── 🔴 EL ZIP NO SE EMITE SI UN SAVE NO CARGA ───────────────────────────────────────────
 * El encargo lo dice y aquí es EJECUTABLE, no una promesa: cada parada se hornea, se vuelve a
 * leer con `importNativeSave` —o sea por la MISMA ruta que recorre el dropzone del jugador— y
 * se carean sus campos contra el diseño. Si una sola falla, el proceso sale ≠0 y no escribe el
 * README. Un save que no se probó cargando no entra al paquete, y la forma de garantizarlo es
 * que el productor no sepa producir el paquete sin la comprobación.
 *
 * ⚠ ESTO NO SUSTITUYE AL TEST. Lo de aquí es un careo de CAMPOS (¿llegó el oro? ¿la posición?);
 * lo que EJECUTA los comandos del juego —que la alfombra embarque, que el sello se abra, que la
 * puerta mágica ceda— vive en `game/tests/walkthrough-saves.test.ts`, por la misma razón que
 * los momentos tienen sus dos predicados separados: que el tile sea el correcto y que el
 * comando funcione son dos afirmaciones distintas.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { construyeRecorrido, componeParada } from "../src/walkthrough/recorrido.js";
import { momentoPorId } from "../src/momentos/defs.js";
import { componeMomento } from "../src/momentos/compone.js";
import { exportNativeSave, importNativeSave, SAVED_GAM_SIZE } from "../src/core/saveNative.js";
/**
 * 🔴 LA MARCA Y EL LECTOR DEL SOBRE SE IMPORTAN DE `core/u5gam.ts`, QUE ES DONDE VIVE EL
 * FORMATO — y esta línea corrige un defecto real de la primera versión de este script.
 *
 * Aquí había un `const MARCA = "U5PARTIDA1\n"` propio, «verbatim de exporta.ts». Era la TERCERA
 * copia del formato, escrita justo mientras #229 medía a qué lleva la segunda: el panel del
 * juego no reconocía el `.u5gam` porque su discriminante era `/\.gam$/i` —que NO casa con
 * `.u5gam`, el carácter antes de «gam» es un `5`— y el fichero moría con un «Import failed.»
 * genérico. O sea que el paquete entero fallaba la importación POR LA VÍA PRINCIPAL, y mi
 * verificación no lo veía porque medía el lector de `/byo`, que sí funcionaba.
 *
 * El día que la marca cambie, un escritor con copia propia no da error: emite ficheros que el
 * lector canónico lee como «sin sobre» — o sea partidas SIN trama, SIN diario y SIN objetos del
 * mundo, con pinta de buenas. Un solo sitio escribe el formato; este script lo CONSUME.
 */
import { U5GAM_MARKER, readU5gamEnvelope, isU5gamName } from "../src/core/u5gam.js";
/**
 * LOS DOS CONSUMIDORES DEL FICHERO, y se verifican los dos porque son caminos distintos:
 *   · `importNativeSaveFiles` — el PANEL DEL JUEGO (`ui/savepanel.ts`), que es por donde el
 *     usuario va a cargar este paquete. Devuelve `sidecarSource` (`envelope`/`none`/`file`),
 *     así que el veredicto se DERIVA de lo que pasó en vez de suponerse.
 *   · `leeFichero` — la landing `/byo`, que además pasa la ventana por `validaVentana`: cinco
 *     predicados sobre bytes CRUDOS (grupo 1..6, el Avatar en el grupo, su nombre ASCII, mes
 *     1-12, día 1-31, hora y minuto en rango) que ninguna otra comprobación de aquí hace.
 */
import { importNativeSaveFiles } from "../src/core/persistence.js";
import { leeFichero } from "../../demo-byo/src/exporta.js";
/**
 * 🔴 LAS RUTAS DE `/byo` QUE COMPONEN UN MENSAJE SON INALCANZABLES DESDE NODE, y sin esto el
 * careo sólo sabe observar la rama feliz.
 *
 * Medido sembrando la marca divergente: `leeFichero` no devolvía `{ok:false, motivo}` — el
 * proceso MORÍA con `ReferenceError: window is not defined` en `arranque.ts:159`. Todo lo que
 * `exporta.ts` rotula (el motivo de un rechazo, el nombre por defecto de una partida sin
 * sobre) pasa por `txt()` → `idiomaActual()` → `window`, que en node no existe. El mutante SÍ
 * enrojecía, pero el diagnóstico que imprimía mandaba a mirar el entorno de ejecución en vez
 * del fichero rechazado: un rojo que se lee como avería del arnés.
 *
 * 🔴 Y LA COSTURA LIMPIA NO SIRVE AQUÍ, medido antes de conformarme con el remedio sucio:
 * `idioma.ts` exporta `congelaIdioma` justamente para no depender de `window`, pero llamarla
 * desde este fichero NO llega a `exporta.ts` — tsx instancia `idioma.ts` DOS VECES (una para
 * este `.mjs`, otra para el grafo `.ts`), así que hay dos `congelado` distintos. Comprobado en
 * el mismo proceso y a una línea de distancia: mi `txt()` devolvía «Partida importada» y el de
 * `exporta.ts` explotaba. Un `import` compartido NO garantiza estado compartido cuando cruzas
 * la frontera de módulos del cargador.
 *
 * Así que se instala un `window` mínimo SÓLO alrededor de la llamada, y se retira siempre: no
 * puede quedarse puesto porque cualquier otro consumidor que pregunte `typeof window` cambiaría
 * de rama a mitad del horneado.
 */
function conVentana(fn) {
  const habia = "window" in globalThis;
  if (!habia) globalThis.window = { navigator: { language: "es-ES" } };
  try {
    return fn();
  } finally {
    if (!habia) delete globalThis.window;
  }
}

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const destino = process.argv[2];
if (!destino) {
  console.error("uso: walkthrough-hornea.mjs <dir-de-salida-FUERA-del-repo>");
  process.exit(2);
}
if (resolve(destino).startsWith(RAIZ + "/")) {
  console.error(
    `El destino apunta DENTRO del repo (${resolve(destino)}).\n` +
      "Cada .u5gam lleva los 4192 B con el roster extraído de INIT.GAM de EA: material que\n" +
      "CLAUDE.md REGLA 4 prohíbe en ficheros tracked. Usa un directorio gitignored o del sistema.",
  );
  process.exit(2);
}

// ── LOS DATOS DE LA EXTRACCIÓN, LEÍDOS EN EJECUCIÓN ─────────────────────────────────────
const assets = join(RAIZ, "game", "assets");
const data = JSON.parse(readFileSync(join(assets, "data.json"), "utf8"));
const init = JSON.parse(readFileSync(join(assets, "initial-state.json"), "utf8"));
const plantilla = new Uint8Array(readFileSync(join(assets, "init.gam")));
const overworld = JSON.parse(readFileSync(join(assets, "maps", "overworld.json"), "utf8"));

/**
 * La celda del Codex: la ÚNICA con `CODEX_TILE = 0x11` en el sobremundo — se BARRE, no se
 * escribe (ver la cabecera de `recorrido.ts`). Y se exige que sea única: si el barrido
 * devolviera dos, la parada 11 estaría eligiendo una de dos sin decirlo.
 */
const CODEX_TILE = 0x11;
function localizaCodex() {
  const hits = [];
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) if (overworld[y][x] === CODEX_TILE) hits.push({ x, y });
  }
  if (hits.length !== 1) {
    throw new Error(
      `el barrido del sobremundo encontró ${hits.length} celdas con CODEX_TILE 0x11 y se esperaba UNA: ` +
        JSON.stringify(hits),
    );
  }
  return hits[0];
}

const recorrido = construyeRecorrido({
  shrineX: data.shrineX,
  shrineY: data.shrineY,
  virtues: data.virtues,
  mantras: data.mantras,
  locationsX: data.locationsX,
  locationsY: data.locationsY,
  wordsOfPower: data.wordsOfPower,
  codex: localizaCodex(),
});

/**
 * El `GameState` de una parada, venga de un momento legendario o sea nueva.
 *
 * 🔴 LAS PARADAS-MOMENTO NO LLEVAN COPIA DE SU PARCHE: se resuelve aquí, contra `defs.ts`. Si
 * mañana un momento corrige su casilla —como ya les pasó al 6 y al 7 cuando se midió que
 * estaban encerrados—, este paquete la sigue sin que nadie lo toque.
 */
function estadoDe(parada) {
  if (parada.momento) {
    const def = momentoPorId(parada.momento);
    if (!def) throw new Error(`parada ${parada.n}: no existe el momento ${parada.momento}`);
    if (!def.estado) throw new Error(`parada ${parada.n}: el momento ${parada.momento} no tiene estado`);
    return componeMomento(def, init);
  }
  if (!parada.estado) throw new Error(`parada ${parada.n}: sin momento y sin estado`);
  return componeParada(parada.estado, init);
}

/**
 * Los bytes del `.u5gam`: los 4192 B del `.gam` + la marca + el sobre JSON con el SIDECAR.
 *
 * 🔴 EL SIDECAR ES LA MITAD DEL SAVE QUE EL `.GAM` NO SABE LLEVAR, y por eso el paquete es
 * `.u5gam` y no `.gam` pelado: `questFlags` (los tres Shadowlords muertos, las palabras dichas),
 * `worldObjects` y el resto no tienen celda en el formato de 1988. Mandar sólo los 4192 B no da
 * un fichero peor — da una partida DISTINTA y con pinta de buena, que es lo que `exporta.ts`
 * declara en su cabecera con las dos formas del defecto ya medidas en este repositorio.
 */
function componeFichero(state, meta) {
  const { gam, sidecar } = exportNativeSave(state, plantilla);
  if (gam.length !== SAVED_GAM_SIZE) {
    throw new Error(`el .gam salió de ${gam.length} B y son ${SAVED_GAM_SIZE}`);
  }
  const sobre = { formato: "openu5-partida", version: 1, meta, sidecar };
  const cola = new TextEncoder().encode(U5GAM_MARKER + JSON.stringify(sobre));
  const out = new Uint8Array(gam.length + cola.length);
  out.set(gam, 0);
  out.set(cola, gam.length);
  return { bytes: out, gam, sidecar };
}

// ── EL CAREO: cada save se RELEE y se compara con lo que la parada afirma ────────────────
//
// El conjunto de campos careados no es una lista de deseos: son los que el README PROMETE al
// jugador (dónde estás, cuántos sois, qué llevas, qué parte de la trama está hecha). Un campo
// que el README no menciona no se carea aquí; uno que menciona y no se careara sería una
// promesa sin predicado.
const problemas = [];
const filas = [];

for (const parada of recorrido) {
  const disenado = estadoDe(parada);
  const meta = {
    name: `${String(parada.n).padStart(2, "0")} · ${parada.titulo.es}`,
    locationName: parada.lugar.es,
    turns: disenado.turnsSinceStart ?? 0,
    timestamp: Date.now(),
    provenance: "walkthrough",
  };
  const { bytes, gam, sidecar } = componeFichero(disenado, meta);

  // ★ LA VUELTA POR EL CÓDEC, que es lo que convierte esto en una prueba y no en un eco: se
  // lee lo que se ESCRIBIÓ, por la misma función que usa el dropzone del jugador.
  const leido = importNativeSave(gam, sidecar);
  const falla = (campo, esperado, obtenido) =>
    problemas.push(`${String(parada.n).padStart(2, "0")}-${parada.slug}: ${campo} — diseñado ${JSON.stringify(esperado)}, releído ${JSON.stringify(obtenido)}`);

  const pd = disenado.position;
  const pl = leido.position;
  if (pd.location !== pl.location || pd.floor !== pl.floor || pd.x !== pl.x || pd.y !== pl.y) {
    falla("posición", pd, pl);
  }
  for (const campo of ["gold", "food", "keys", "gems", "torches", "skullKeys", "magicCarpets", "partySize"]) {
    if (disenado[campo] !== leido[campo]) falla(campo, disenado[campo], leido[campo]);
  }
  for (const campo of ["shrineQuestBitmap", "shrineVisitedBitmap"]) {
    if ((disenado[campo] ?? 0) !== (leido[campo] ?? 0)) falla(campo, disenado[campo], leido[campo]);
  }
  for (const k of ["falsehood", "hatred", "cowardice"]) {
    if (disenado.shards[k] !== leido.shards[k]) falla(`shards.${k}`, disenado.shards[k], leido.shards[k]);
  }
  for (const k of ["amulet", "crown", "sceptre"]) {
    if (disenado.lbArtifacts[k] !== leido.lbArtifacts[k]) {
      falla(`lbArtifacts.${k}`, disenado.lbArtifacts[k], leido.lbArtifacts[k]);
    }
  }
  // Los flags de trama viven en el SIDECAR: si el sobre no viajara, aquí saldría el hueco.
  const qd = disenado.questFlags ?? {};
  const ql = leido.questFlags ?? {};
  for (const k of Object.keys(qd)) {
    if (qd[k] !== ql[k]) falla(`questFlags[${k}]`, qd[k], ql[k]);
  }

  const nombre = `${String(parada.n).padStart(2, "0")}-${parada.slug}.u5gam`;

  // ── (a) EL DISCRIMINANTE DE NOMBRE del panel del juego. Es el que estaba ROTO (#229):
  // `/\.gam$/i` no casa con `.u5gam`, y el fichero ni siquiera llegaba al parser.
  if (!isU5gamName(nombre)) falla("isU5gamName", true, false);

  // ── (b) EL LECTOR CANÓNICO del sobre, el que comparten los DOS consumidores.
  const sobreLeido = readU5gamEnvelope(bytes);
  if (sobreLeido.kind !== "ok") falla("readU5gamEnvelope", "ok", sobreLeido.kind);

  // ── (c) EL CAMINO DEL PANEL DEL JUEGO — por donde el usuario va a cargar esto. El
  // veredicto se DERIVA de `sidecarSource`: «envelope» es la única respuesta que dice que el
  // sobre viajó; «none» sería la partida SIN trama con pinta de buena.
  const porElPanel = await importNativeSaveFiles(new File([bytes], nombre));
  if (porElPanel.sidecarSource !== "envelope") {
    falla("panel del juego · sidecarSource", "envelope", porElPanel.sidecarSource);
  }
  if (porElPanel.state.position.x !== pd.x || porElPanel.state.position.y !== pd.y) {
    falla("panel del juego · posición", pd, porElPanel.state.position);
  }

  // ── (d) EL CAMINO DE /byo, que además corre `validaVentana` sobre bytes CRUDOS.
  const lectura = conVentana(() => leeFichero(bytes));
  if (!lectura.ok) {
    falla("leeFichero", "aceptado", `RECHAZADO motivo=${lectura.motivo} detalle=${lectura.detalle ?? "-"}`);
  } else if (lectura.degradado !== null) {
    falla("leeFichero", "sin degradación", `DEGRADADO=${lectura.degradado}`);
  }

  // ── (e) EL CONTROL NEGATIVO, y sin él los cuatro de arriba no valen: un lector que dijera
  // «ok» SIEMPRE los pasaría todos. Se rompe el JSON del sobre de ESTE fichero (un byte
  // dentro de la cola, detrás de la marca) y se exige que los dos lectores lo NOTEN — `bad`
  // en el canónico y `none` (degradado) en el panel. Si alguno lo diera por bueno, estaría
  // metiendo en la partida un sidecar que el códec no sabe leer.
  {
    const roto = new Uint8Array(bytes);
    roto[SAVED_GAM_SIZE + U5GAM_MARKER.length + 2] = 0x00; // dentro del JSON, tras la marca
    const kind = readU5gamEnvelope(roto).kind;
    if (kind !== "bad") falla("control negativo · readU5gamEnvelope(sobre roto)", "bad", kind);
    const degradado = await importNativeSaveFiles(new File([roto], nombre));
    if (degradado.sidecarSource !== "none") {
      falla("control negativo · panel con sobre roto", "none", degradado.sidecarSource);
    }
    /**
     * El TERCER lector sobre el mismo fichero roto. Aquí el predicado NO es «rechaza»: los
     * 4192 B de la ventana siguen intactos y `validaVentana` mira bytes CRUDOS, así que `/byo`
     * tiene derecho a aceptarla — lo que NO puede es leerla como una partida ÍNTEGRA, porque
     * el sidecar (trama, diario, objetos del mundo) se ha quedado por el camino. Lo que se
     * exige es que el defecto sea VISIBLE por alguno de sus dos canales.
     *
     * MEDIDO con un save del paquete truncado a la ventana pelada: `/byo` devuelve
     * `ok=true` con `degradado="sin-sobre"`. O sea que de las dos ramas que este aserto
     * admite, la que se ejerce hoy es la SEGUNDA — queda escrito para que nadie lea el
     * `||` como una duda sobre cuál ocurre.
     */
    const lecturaRota = conVentana(() => leeFichero(roto));
    if (lecturaRota.ok && lecturaRota.degradado === null) {
      falla(
        "control negativo · /byo con sobre roto",
        "rechazado o degradado",
        "ACEPTADO COMO ÍNTEGRO",
      );
    }
  }

  writeFileSync(join(destinoAbs(), nombre), bytes);
  filas.push({ parada, state: leido, bytes: bytes.length });
}

function destinoAbs() {
  const d = resolve(destino);
  mkdirSync(d, { recursive: true });
  return d;
}

if (problemas.length > 0) {
  console.error(`El paquete NO se emite: ${problemas.length} careo(s) fallidos.`);
  for (const p of problemas) console.error(` · ${p}`);
  process.exit(1);
}

// ── EL README ───────────────────────────────────────────────────────────────────────────
//
// Se GENERA de las mismas paradas que se hornearon: una tabla escrita a mano al lado de un
// generador es una segunda copia que puede divergir del paquete que acompaña, y este repositorio
// tiene el precedente medido de un catálogo que su propio generador revertía.
function readme() {
  const L = [];
  L.push("# Paquete de partidas — el walkthrough de Ultima V en 21 paradas", "");
  L.push(
    "Una serie numerada de partidas para recorrer el juego de principio a fin sin tener que jugarlo entero.",
    "Cada fichero es una foto del juego en un punto concreto, con el grupo y el equipo que corresponden a esa altura.",
    "",
  );
  L.push("## Cómo se cargan", "");
  L.push(
    "1. Abre la pantalla de juego y busca la zona de importar partida.",
    "2. Arrastra ahí el `.u5gam` que quieras (o pulsa para elegirlo).",
    "3. La partida aparece en tu lista de guardadas con su número delante, así que la lista se ordena sola.",
    "",
    "Puedes cargarlos en cualquier orden y volver a uno anterior cuando quieras: son independientes.",
    "",
  );
  L.push("## El recorrido", "");
  L.push("| # | Dónde estás | Qué probar | Qué debería pasar |");
  L.push("|---|---|---|---|");
  for (const { parada } of filas) {
    const n = String(parada.n).padStart(2, "0");
    L.push(
      `| **${n}** ${escapa(parada.titulo.es)}<br>*${escapa(parada.lugar.es)}* | ${escapa(parada.queProbar)} | ${escapa(parada.queDeberiaPasar)} |`,
    );
  }
  L.push("");
  L.push("## El equipo, parada a parada", "");
  L.push(
    "**Las seis reservas suben o se quedan igual, nunca bajan** — oro, comida, llaves, gemas, antorchas y skull keys.",
    "Es lo que hace que el paquete se pueda jugar en orden sin la sensación de que algo se ha perdido por el camino.",
    "",
    "Las otras dos columnas sí se mueven en los dos sentidos, y por razones distintas:",
    "",
    "- **El grupo baja a cinco entre la 13 y la 17.** Esas cinco partidas son los momentos legendarios que ya están publicados en la galería, y allí se eligió un grupo de cinco para esas escenas. Aquí se reutilizan tal cual en vez de hacer una segunda versión de la misma partida: preferimos que el paquete y la galería enseñen exactamente lo mismo.",
    "- **Las alfombras sólo aparecen en el peregrinaje.** No son un regalo: tres de los ocho santuarios están en islas, y el de la Compasión es una única casilla rodeada de agua. Son la herramienta de ese tramo y de ningún otro.",
    "",
  );
  L.push("| # | Grupo | Oro | Comida | Llaves | Gemas | Antorchas | Skull keys | Alfombras |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const { parada, state } of filas) {
    L.push(
      `| ${String(parada.n).padStart(2, "0")} | ${state.partySize} | ${state.gold} | ${state.food} | ${state.keys} | ${state.gems} | ${state.torches} | ${state.skullKeys} | ${state.magicCarpets} |`,
    );
  }
  L.push("");
  L.push("## Tres cosas que conviene saber", "");
  L.push(
    "- **No hay desenlace.** La última parada te deja encima de la boca del Doom con todo lo que el rescate pide en la mano. Lo que pasa al bajar no está en el paquete, a propósito.",
    "- **Tres santuarios están en islas.** El de la Compasión es literalmente una casilla rodeada de agua: a pie no hay ni un movimiento posible. Por eso esas partidas llevan alfombras mágicas — pulsa (U)se y elige la alfombra para salir de ahí.",
    "- **El pasadizo del clavicémbalo no se guarda.** Es estado de sesión: al cargar la partida 17 el muro vuelve a estar puesto y hay que tocar la melodía otra vez. No es un fallo del paquete.",
    "",
  );
  return L.join("\n") + "\n";
}

const escapa = (s) => String(s).replace(/\|/g, "\\|");

writeFileSync(join(destinoAbs(), "README.md"), readme());

const bytesTotal = filas.reduce((a, f) => a + f.bytes, 0);
console.log(`paquete OK — ${filas.length} partidas verificadas, ${bytesTotal} B en total`);
console.log(`destino: ${destinoAbs()}`);
