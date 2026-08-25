/**
 * HORNEADO DE LOS TRES `SAVED.GAM` DEL CICLO DEL SANTUARIO — nativos, 4192 B, para el ORIGINAL.
 *
 * Uso:
 *   node --import tsx game/tools/shrine-saves-hornea.mjs <dir-de-salida-FUERA-del-repo>
 *
 * ── QUÉ PRODUCE ─────────────────────────────────────────────────────────────────────────────
 *   shrine-1-antes.gam    — ante el santuario, sin quest y sin lección del Codex
 *   shrine-2-mantra.gam   — mantra cantado: Sacred Quest ACTIVA (bit 0 de 0x326)
 *   shrine-3-codex.gam    — vuelta del Codex: quest activa + lección aprendida (bit 0 de 0x328)
 *   shrine-2b-ante-codice.gam — EXTRA (ver §4): con la quest activa, ante el Codex
 *   LEEME.md              — el guion de uso en DOSBox
 *
 * Son `.gam` PELADOS, no `.u5gam`: el consumidor es el ULTIMA.EXE de 1988, que sólo sabe leer
 * los 4192 B. Todo lo que este ciclo necesita cabe DENTRO de la ventana (§2), así que aquí no
 * se pierde nada por no llevar sobre — a diferencia del paquete del walkthrough, cuyos flags de
 * trama sí viven en el sidecar.
 *
 * ── 🔴 EL DESTINO TIENE QUE ESTAR FUERA DEL REPO, Y EL SCRIPT LO EXIGE ──────────────────────
 * Misma guarda y misma razón que `walkthrough-hornea.mjs`: los 4192 B llevan dentro el roster
 * de 16 registros extraído del `INIT.GAM` de EA (nombres y cifras de los compañeros en claro).
 * CLAUDE.md REGLA 4 lo prohíbe en ficheros tracked.
 *
 * ═══ §1. QUÉ SANTUARIO, Y POR QUÉ NO ES EL DE LA COMPASIÓN ══════════════════════════════════
 *
 * El encargo dejaba elegir entre Honestidad y Compasión, «el más accesible». No es una
 * preferencia: está MEDIDO en `walkthrough/recorrido.ts:136-143` con el `isPassable` del port
 * sobre `maps/overworld.json` — componente conexa a pie desde la casilla de cada santuario:
 *
 *     Honestidad 364 · **Compasión 1** · Valor 9 · Justicia 15566 · … · Humildad 246
 *
 * El de COMPASIÓN es una isla de UNA CELDA: a pie no hay un solo movimiento legal. ⇒ Honestidad
 * (virtud 0, mantra «Ahm», (233,66)). El índice y las coordenadas se DERIVAN de `data.json` en
 * ejecución, no se escriben aquí.
 *
 * ═══ §2. LOS DOS BYTES QUE HACEN EL CICLO, Y SU CITA ════════════════════════════════════════
 *
 * El `SAVED.GAM` es un volcado verbatim de 4192 B de DGROUP desde `DS 0x55A6`
 * (`re/notes/save-window-writer.md` §1-§3) ⇒ `file_offset = DS − 0x55A6`.
 *
 *   | campo                     | DS       | .GAM   | escritor en el binario                  |
 *   |---------------------------|----------|--------|-----------------------------------------|
 *   | `g_shrine_quest_bitmap`   | `0x58CC` | `0x326`| `CAST2.OVL 0x0a88  or [0x58cc], al`     |
 *   | `g_shrine_visited_bitmap` | `0x58CE` | `0x328`| `CAST2.OVL 0x0d7d  or [0x58ce], al`     |
 *
 * La correspondencia DS↔fichero de estas DOS filas está VERIFICADA EN VIVO contra la RAM del
 * original en `re/notes/trama-flags-227.md` §5.1 (tabla `shrineQ 0x58cc → +0x326` y
 * `shrineV 0x58ce → +0x328`, ambas «IGUAL» fichero↔RAM), por dos mecanismos sin parentesco que
 * coinciden en la base `0x55A6`.
 *
 * ★★ Y AQUÍ LA PREMISA DEL ENCARGO SE CORRIGE: pedía escribir los bytes de la quest A MANO
 * «porque saveNative manda la trama al sidecar». Eso es cierto de los TRES campos de Shadowlord
 * (#238), pero **NO de los dos del santuario**: `saveNative.ts:73-74` ya declara
 * `SHRINE_QUEST_OFFSET = 0x326` / `SHRINE_VISITED_OFFSET = 0x328` y los escribe nativos en
 * `:834-835` y los relee en `:902-903`. ⇒ el exportador del port YA es la vía correcta para
 * este ciclo, y escribir los bytes por fuera sería una segunda copia del formato. Lo que este
 * script sí hace es COMPROBAR el byte crudo en el fichero (§5), que es la mitad que faltaba.
 *
 * ═══ §3. LA GEOMETRÍA DEL (E)NTER — «adyacente» era falso ═══════════════════════════════════
 *
 * 🔴 El encargo pedía la party «de pie ADYACENTE a un santuario … lista para (E)ntrar». Es
 * falso, y el discriminante está en el código de las dos caras:
 *   · binario: `cmd_enter` (MAINOUT 0x08de) casa el tile BAJO el grupo (0x9da→0x936) y despacha
 *     a `shrine_visit` (CAST2 0x0966), que empareja el party contra las 8 coords.
 *   · port: `game.ts:6037` — `tile === SHRINE_TILE && shrineIndexAt(pos.x, pos.y)`, o sea el
 *     tile EN LA POSICIÓN del grupo.
 * ⇒ el (E)nter dispara con la party **ENCIMA** de la casilla del santuario. Adyacente no hace
 * nada. Las tres partidas se siembran en (233,66), la casilla misma.
 *
 * ═══ §4. POR QUÉ LOS TRES COMPARTEN CASILLA Y RELOJ — y el EXTRA ════════════════════════════
 *
 * Las tres se siembran en la MISMA casilla, con el MISMO reloj y la MISMA mochila. Así el único
 * eje que se mueve entre ellas son los dos bytes de §2, y el careo en DOSBox mide el CICLO y no
 * la posición: el mismo (E)nter desde el mismo sitio da tres desenlaces distintos. El script lo
 * exige como aserto de bytes (§5c), no como intención.
 *
 * 🔴 Y UN HALLAZGO QUE EL ENCARGO NO PREVEÍA, medido con el propio `shrineMode` del port:
 * las partidas 1 y 2 son OBSERVACIONALMENTE IDÉNTICAS al (E)ntrar. `shrineMode`
 * (`world/shrines.ts:111`) ramifica PRIMERO por el bit del Codex y sólo después por la quest
 * (binario: `0x0a74 test g_shrine_visited` ANTES de `0x0b10 test g_shrine_quest`), así que con
 * `visited = 0` las dos dan `show-mantra`. La quest de la 2 ya está puesta y volver a entrar la
 * re-pone (idempotente, `or`). ⇒ grabar la 2 EN EL SANTUARIO da la misma escena que la 1; lo
 * que distingue a la 2 es el byte, no la pantalla.
 *
 * Por eso se hornea un CUARTO fichero, `shrine-2b-ante-codice.gam`: la misma partida 2 pero
 * ante la celda del Codex (la única con `CODEX_TILE = 0x11` del sobremundo, barrida aquí).
 * Ahí la quest activa SÍ es observable — es su consumidor: `shrineCodexLesson`
 * (`world/shrines.ts:177`, CAST2 0x0d24) busca la virtud de índice más bajo con quest activa y
 * marca su bit de lección. Es el eslabón que convierte la 2 en la 3.
 *
 * ⚠ Las tres alfombras de la mochila NO son adorno: Honestidad (componente 364) y el Codex
 * (componente 39) están en componentes DISTINTAS — a pie no se va de una a la otra. La alfombra
 * es el transporte del peregrinaje (`use-tools.ts:188`, CAST 0x188b), igual que en el paquete
 * del walkthrough.
 *
 * ═══ §5. LO QUE SE VERIFICA ANTES DE EMITIR ═════════════════════════════════════════════════
 *
 *   (a) VUELTA POR EL CÓDEC: cada `.gam` se relee con `importNativeSave` —la misma función que
 *       recorre el dropzone— y se carean posición y los dos bitmaps contra el diseño.
 *   (b) EL BYTE CRUDO EN EL FICHERO: se lee `gam[0x326]` / `gam[0x328]` directamente de los
 *       bytes emitidos y se compara con lo esperado. Es lo que el original va a leer; (a) sólo
 *       demuestra que el port se entiende consigo mismo.
 *   (c) EL CONTROL POSITIVO Y NEGATIVO A LA VEZ — el diff byte a byte entre las partidas: el
 *       conjunto de offsets que difieren entre la 1 y la 2 tiene que ser EXACTAMENTE {0x326}, y
 *       entre la 2 y la 3 EXACTAMENTE {0x328}. Un diff vacío delataría que el campo no llegó al
 *       fichero (el verde hueco); un diff más ancho, que se movió algo que no era el ciclo.
 *   (d) EL TESTIGO NO ESTÁ ELEGIDO PARA PASAR: la recompensa de completar la quest de
 *       Honestidad es +1 INTELIGENCIA (`SHRINE_INT_FLAG[0] = 1`, DATA.OVL 0x4B8E) con tope 30
 *       (`ATTR_MAX`, CAST2 0x0cb1). Si el Avatar llegara ya a 30, la partida 3 no enseñaría
 *       nada y parecería rota. Se exige `< 30` y se imprime el valor.
 *   (e) #136 DECLARADO Y MEDIDO: `writeEnemyTable` limpia los slots 1..23 al exportar. Aquí no
 *       hay `worldObjects`, así que la limpieza es la que es — se MIDE cuántos slots del
 *       `init.gam` cambian y se imprime, en vez de suponer que «a pie da igual».
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { componeParada } from "../src/walkthrough/recorrido.js";
import { exportNativeSave, importNativeSave, SAVED_GAM_SIZE } from "../src/core/saveNative.js";
import { shrineMode, SHRINE_INT_FLAG, CODEX_TILE } from "../src/core/world/shrines.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const destino = process.argv[2];
if (!destino) {
  console.error("uso: shrine-saves-hornea.mjs <dir-de-salida-FUERA-del-repo>");
  process.exit(2);
}
if (resolve(destino).startsWith(RAIZ + "/")) {
  console.error(
    `El destino apunta DENTRO del repo (${resolve(destino)}).\n` +
      "Cada .gam lleva los 4192 B con el roster extraído de INIT.GAM de EA: material que\n" +
      "CLAUDE.md REGLA 4 prohíbe en ficheros tracked. Usa un directorio gitignored o del sistema.",
  );
  process.exit(2);
}

// ── LOS DATOS DE LA EXTRACCIÓN, LEÍDOS EN EJECUCIÓN ─────────────────────────────────────────
const assets = join(RAIZ, "game", "assets");
const data = JSON.parse(readFileSync(join(assets, "data.json"), "utf8"));
const init = JSON.parse(readFileSync(join(assets, "initial-state.json"), "utf8"));
const plantilla = new Uint8Array(readFileSync(join(assets, "init.gam")));
const overworld = JSON.parse(readFileSync(join(assets, "maps", "overworld.json"), "utf8"));

/** Los dos offsets de §2. Se re-declaran aquí SÓLO para el careo de byte crudo de §5b. */
const OFF_QUEST = 0x326; // g_shrine_quest_bitmap   DS 0x58CC  (trama-flags-227.md §5.1)
const OFF_VISITED = 0x328; // g_shrine_visited_bitmap DS 0x58CE  (trama-flags-227.md §5.1)

const problemas = [];
const falla = (quien, campo, esperado, obtenido) =>
  problemas.push(`${quien}: ${campo} — esperado ${JSON.stringify(esperado)}, obtenido ${JSON.stringify(obtenido)}`);

// ── LA VIRTUD: DERIVADA de data.json, no escrita ────────────────────────────────────────────
const VIRTUD = data.virtues.indexOf("Honesty");
if (VIRTUD < 0) throw new Error(`data.json.virtues no trae «Honesty»: ${JSON.stringify(data.virtues)}`);
const SX = data.shrineX[VIRTUD];
const SY = data.shrineY[VIRTUD];
const BIT = 1 << VIRTUD;

// El tile de la casilla tiene que ser SHRINE_TILE, o el (E)nter de §3 no despacha.
if (overworld[SY][SX] !== 0x19) {
  throw new Error(`(${SX},${SY}) no es santuario: tile 0x${overworld[SY][SX].toString(16)}, se esperaba 0x19`);
}

// ── LA CELDA DEL CODEX: la ÚNICA con 0x11, y se EXIGE que sea única ─────────────────────────
const codexHits = [];
for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) if (overworld[y][x] === CODEX_TILE) codexHits.push({ x, y });
}
if (codexHits.length !== 1) {
  throw new Error(`el barrido encontró ${codexHits.length} celdas con CODEX_TILE 0x11 y se esperaba UNA`);
}
const CODEX = codexHits[0];

/** Reloj y mochila COMPARTIDOS por las cuatro — ver §4 (el único eje que se mueve son los bytes). */
const RELOJ = { year: 139, month: 8, day: 12, hour: 10, minute: 30 };
const MOCHILA = {
  food: 200, gold: 450, keys: 5, gems: 2, torches: 8, skullKeys: 1, magicCarpets: 3,
  scrollQuantities: [1, 1, 1, 1, 1, 1, 1, 1],
  potionQuantities: [1, 1, 1, 1, 1, 1, 1, 1],
  reagentQuantities: [6, 6, 6, 6, 6, 6, 6, 6],
};
const COMUN = {
  time: RELOJ,
  party: [0, 1, 2, 3, 4, 5],
  transport: "foot",
  transportTile: 0x1c, // g_transport_tile de a pie (state.ts:618)
  karma: 50,
  mochila: MOCHILA,
  shards: { falsehood: false, hatred: false, cowardice: false },
  lbArtifacts: { amulet: false, crown: false, sceptre: false },
  specialItems: { blackBadge: false, woodenBox: false },
};

const EN_SANTUARIO = { location: 0, floor: 0, x: SX, y: SY };
const ANTE_CODEX = { location: 0, floor: 0, x: CODEX.x, y: CODEX.y };

const PARTIDAS = [
  {
    fichero: "shrine-1-antes.gam",
    rotulo: "1 · ANTES — ante el santuario, nada hecho",
    parche: { ...COMUN, position: EN_SANTUARIO, shrineQuestBitmap: 0, shrineVisitedBitmap: 0 },
    modo: "show-mantra",
    quest: 0,
    visited: 0,
  },
  {
    fichero: "shrine-2-mantra.gam",
    rotulo: "2 · MANTRA — Sacred Quest de la Honestidad ACTIVA",
    parche: { ...COMUN, position: EN_SANTUARIO, shrineQuestBitmap: BIT, shrineVisitedBitmap: 0 },
    modo: "show-mantra", // ← §4: SÍ, el mismo que la 1. Es el hallazgo, no una errata.
    quest: BIT,
    visited: 0,
  },
  {
    fichero: "shrine-3-codex.gam",
    rotulo: "3 · CODEX — lección aprendida, de vuelta al santuario",
    parche: { ...COMUN, position: EN_SANTUARIO, shrineQuestBitmap: BIT, shrineVisitedBitmap: BIT },
    modo: "quest-complete",
    quest: BIT,
    visited: BIT,
  },
  {
    fichero: "shrine-2b-ante-codice.gam",
    rotulo: "2b · EXTRA — la misma quest activa, pero ANTE EL CODEX",
    parche: { ...COMUN, position: ANTE_CODEX, shrineQuestBitmap: BIT, shrineVisitedBitmap: 0 },
    modo: "show-mantra", // el modo del SANTUARIO; ante el Codex despacha por otra rama (§4)
    quest: BIT,
    visited: 0,
  },
];

function destinoAbs() {
  const d = resolve(destino);
  mkdirSync(d, { recursive: true });
  return d;
}

const horneadas = [];

for (const p of PARTIDAS) {
  const disenado = componeParada(p.parche, init);
  const { gam, sidecar } = exportNativeSave(disenado, plantilla);

  if (gam.length !== SAVED_GAM_SIZE) falla(p.fichero, "tamaño", SAVED_GAM_SIZE, gam.length);

  // (a) LA VUELTA POR EL CÓDEC — con el sobre que emitió el exportador.
  const leido = importNativeSave(gam, sidecar);
  const pd = disenado.position;
  const pl = leido.position;
  if (pd.location !== pl.location || pd.floor !== pl.floor || pd.x !== pl.x || pd.y !== pl.y) {
    falla(p.fichero, "posición (round-trip)", pd, pl);
  }
  if ((leido.shrineQuestBitmap ?? 0) !== p.quest) {
    falla(p.fichero, "shrineQuestBitmap (round-trip)", p.quest, leido.shrineQuestBitmap);
  }
  if ((leido.shrineVisitedBitmap ?? 0) !== p.visited) {
    falla(p.fichero, "shrineVisitedBitmap (round-trip)", p.visited, leido.shrineVisitedBitmap);
  }

  /**
   * (a-bis) ★★ LA MISMA LECTURA **SIN SOBRE** — y es la que de verdad prueba lo que se entrega.
   *
   * El fichero que va a DOSBox son los 4192 B pelados: no hay sidecar al otro lado. Un careo
   * hecho sólo con el sobre del exportador demostraría que el port se entiende consigo mismo y
   * pasaría IGUAL si los dos bitmaps viajaran por el sidecar — que es exactamente el defecto de
   * los tres campos de Shadowlord (#238). Con un sobre VACÍO, si los bitmaps sobreviven es
   * porque están en la ventana. Es el control que separa «nativo» de «parece nativo».
   */
  const sinSobre = { version: 1, qol: { journal: [] }, gameState: { transport: "foot", questFlags: {} } };
  const pelado = importNativeSave(gam, sinSobre);
  if ((pelado.shrineQuestBitmap ?? 0) !== p.quest) {
    falla(p.fichero, "shrineQuestBitmap SIN SOBRE", p.quest, pelado.shrineQuestBitmap);
  }
  if ((pelado.shrineVisitedBitmap ?? 0) !== p.visited) {
    falla(p.fichero, "shrineVisitedBitmap SIN SOBRE", p.visited, pelado.shrineVisitedBitmap);
  }
  if (pelado.position.x !== pd.x || pelado.position.y !== pd.y) {
    falla(p.fichero, "posición SIN SOBRE", pd, pelado.position);
  }

  // (b) EL BYTE CRUDO — lo que el ULTIMA.EXE de 1988 va a leer
  if (gam[OFF_QUEST] !== p.quest) falla(p.fichero, `byte crudo 0x${OFF_QUEST.toString(16)}`, p.quest, gam[OFF_QUEST]);
  if (gam[OFF_VISITED] !== p.visited) {
    falla(p.fichero, `byte crudo 0x${OFF_VISITED.toString(16)}`, p.visited, gam[OFF_VISITED]);
  }

  // El MODO que el ciclo va a tomar, medido con el predicado del port (no leído a ojo).
  const modo = shrineMode(leido, VIRTUD);
  if (modo !== p.modo) falla(p.fichero, "shrineMode", p.modo, modo);

  horneadas.push({ ...p, gam, leido });
}

// (d) EL TESTIGO NO ESTÁ ELEGIDO PARA PASAR — el +1 de INT tiene que caber bajo el tope 30
const avatar = horneadas[0].leido.characters[0];
const SUBE_INT = SHRINE_INT_FLAG[VIRTUD] === 1;
if (SUBE_INT && avatar.intelligence >= 30) {
  falla("shrine-3", "margen del +1 de INT (tope 30)", "< 30", avatar.intelligence);
}

// (c) EL DIFF BYTE A BYTE — control positivo y negativo en el mismo gesto
function offsetsQueDifieren(a, b) {
  const out = [];
  for (let i = 0; i < SAVED_GAM_SIZE; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}
const hex = (xs) => "{" + xs.map((n) => "0x" + n.toString(16)).join(", ") + "}";

const d12 = offsetsQueDifieren(horneadas[0].gam, horneadas[1].gam);
if (d12.length !== 1 || d12[0] !== OFF_QUEST) {
  falla("diff 1↔2", "offsets que difieren", hex([OFF_QUEST]), hex(d12));
}
const d23 = offsetsQueDifieren(horneadas[1].gam, horneadas[2].gam);
if (d23.length !== 1 || d23[0] !== OFF_VISITED) {
  falla("diff 2↔3", "offsets que difieren", hex([OFF_VISITED]), hex(d23));
}

// (e) #136 MEDIDO, no supuesto: cuántos bytes del pool de objetos 1..23 mueve el exportador
const OBJ_BASE = 0x6b4;
const OBJ_SLOT = 8;
const slotsTocados = [];
for (let n = 1; n <= 23; n++) {
  const ini = OBJ_BASE + n * OBJ_SLOT;
  for (let k = 0; k < OBJ_SLOT; k++) {
    if (plantilla[ini + k] !== horneadas[0].gam[ini + k]) {
      slotsTocados.push(n);
      break;
    }
  }
}

if (problemas.length > 0) {
  console.error(`NO se emite nada: ${problemas.length} careo(s) fallidos.`);
  for (const p of problemas) console.error(` · ${p}`);
  process.exit(1);
}

for (const h of horneadas) writeFileSync(join(destinoAbs(), h.fichero), h.gam);
writeFileSync(join(destinoAbs(), "LEEME.md"), leeme());

console.log(`santuario de ${data.virtues[VIRTUD]} (virtud ${VIRTUD}) en (${SX},${SY}), mantra «${data.mantras[VIRTUD]}»`);
console.log(`Codex en (${CODEX.x},${CODEX.y})`);
console.log(`diff 1↔2 = ${hex(d12)} · diff 2↔3 = ${hex(d23)}   (control: exactamente un byte cada uno)`);
console.log(`INT del Avatar = ${avatar.intelligence} (tope 30) ⇒ el +1 de la partida 3 es observable`);
console.log(`#136 · slots 1..23 del pool que el exportador mueve respecto de init.gam: ${slotsTocados.length === 0 ? "NINGUNO" : slotsTocados.join(",")}`);
console.log(`${horneadas.length} partidas emitidas en ${destinoAbs()}`);

// ── EL LEEME ────────────────────────────────────────────────────────────────────────────────
function leeme() {
  const v = data.virtues[VIRTUD];
  const m = data.mantras[VIRTUD];
  const L = [];
  L.push(`# El ciclo del santuario de ${v} — tres partidas para el ORIGINAL`, "");
  L.push(
    `Tres \`SAVED.GAM\` nativos (4192 B) del santuario de **${v}** en **(${SX},${SY})**, mantra **«${m}»**.`,
    "Están hechos para cargarse en el ULTIMA.EXE de 1988 bajo DOSBox y grabar el ciclo completo.",
    "",
  );
  L.push("## Cómo se cargan", "");
  L.push(
    "1. Haz copia de tu `SAVED.GAM` actual (el juego sólo tiene una ranura).",
    "2. Copia el `.gam` que quieras al directorio de juego **renombrándolo a `SAVED.GAM`**.",
    "3. Arranca el juego y elige *Journey Onward*.",
    "",
    "Las cuatro parten del mismo sitio, la misma fecha y la misma mochila: entre la 1, la 2 y la 3",
    "**sólo cambia un byte**, que es justo el que lleva el ciclo.",
    "",
  );
  L.push("## Las partidas", "");
  L.push("| Fichero | Dónde estás | Qué hacer | Qué debería pasar |");
  L.push("|---|---|---|---|");
  L.push(
    `| \`shrine-1-antes.gam\` | Encima del santuario de ${v} | Pulsa **(E)nter**. Te pide la virtud y el mantra ×3 | Aceptas escribiendo \`${v}\` y \`${m}\` tres veces: el santuario recita su lección y **encomienda la Sacred Quest** |`,
  );
  L.push(
    `| \`shrine-2-mantra.gam\` | El mismo sitio, con la quest YA activa | Pulsa **(E)nter** otra vez | **La misma escena que la 1** — y eso es lo correcto: mientras el Codex no te haya enseñado la lección, el santuario sólo sabe recitar el mantra. Lo que cambió está en el byte, no en la pantalla |`,
  );
  L.push(
    `| \`shrine-2b-ante-codice.gam\` | Ante el **Codex**, con la quest activa | Pulsa **(E)nter** | Aquí sí se ve la quest: el Codex **enseña la lección de ${v}** — es el paso que convierte la 2 en la 3 |`,
  );
  L.push(
    `| \`shrine-3-codex.gam\` | De vuelta encima del santuario | Pulsa **(E)nter** y responde igual | Ahora **completa la quest**: +3 de karma y **+1 de inteligencia** al Avatar (con temblor de pantalla) |`,
  );
  L.push("");
  L.push("## Tres cosas que conviene saber", "");
  L.push(
    "- **Hay que estar ENCIMA de la casilla, no al lado.** El (E)nter mira el tile bajo el grupo; desde la casilla contigua no ocurre nada.",
    `- **Las tres alfombras son el transporte, no un regalo.** El santuario de ${v} y el Codex están en zonas del mapa que no se comunican a pie. Pulsa (U)se y elige la alfombra para moverte entre ellos.`,
    "- **Un solo byte separa la 1 de la 2** (y otro la 2 de la 3). Si cargas las tres y ves la misma escena en la 1 y la 2, no es un fallo del paquete: es la mecánica del original.",
    "",
  );
  return L.join("\n") + "\n";
}
