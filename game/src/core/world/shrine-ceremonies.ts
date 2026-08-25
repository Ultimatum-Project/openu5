/**
 * SANTUARIOS — ceremonias y prompts (CAST2 0x0966/0x0d24/0x0e76 + CMDS 0x1202 +
 * MAINOUT 0x0C8A) — extraídos de la clase Game (lote 2 del refactor de monolitos,
 * patrón TRAMO 3/ARQ-3): guardián del Codex, trigger on-step del santuario
 * destruido, ceremonia al (E)nter (visita/Codex/profecía final), interrogatorio
 * virtud+mantra×3, restauración y donación. El MOTOR puro (shrineMode/
 * shrineShowMantra/shrineCompleteQuest/shrineCodexLesson/shrineDonate/
 * shrineRestore/shrineVisitCheck…) ya vivía en world/shrines.ts; aquí va la
 * ORQUESTACIÓN con contexto estrecho. Game delega (fachada, firmas intactas) y
 * posee el holder de prompts pendientes. Comentarios-cita ÍNTEGROS.
 */
import type { GameState } from "../state.js";
import type { GameEvent } from "../game.js";
import { tf } from "../../i18n/index.js";
import { sfxEvent } from "../sfx.js";
import {
  shrineMode,
  shrineShowMantra,
  shrineCompleteQuest,
  shrineCodexLesson,
  shrineDonate,
  shrineRestore,
  shrineVisitCheck,
  shrineIndexAt,
  BROKEN_SHRINE_TILE,
  type ShrineData,
} from "./shrines.js";
import {
  buildShrineEnterScript,
  buildShrineExitScript,
  type ShrineSceneKind,
  type ShrineSceneTiles,
} from "./shrine-scene.js";

/**
 * Página del Codex por virtud (índice 0-7 = orden del quest-bitmap): las 8 LECCIONES
 * LARGAS anti-virtud, records 20-27 de MISCMSG.DAT (offsets de fichero 0x4ab-0x6bb). El
 * binario imprime `'"' + tabla_offsets[virtud] + '"\n\n'` (CAST2 0x0d81-0x0d98: char 0x22
 * → print_string 0x3670 del buffer 0xb21e+off → DS 0x95e6 `"\n\n`); la tabla es DS 0x4b6e
 * = DATA.OVL fileoff 0x4b7e (`0x0d8d mov ax,[bx+0x4b6e]`), relativa al buffer 0xb21e que
 * carga MISCMSG desde el offset de fichero 0x3ab. Byte-exactas del fichero (con sus `\n`
 * internos), con las comillas y el "\n\n" de cierre del kernel incluidos.
 * ⚠️ La tabla VECINA DS 0x4b5e (fileoff 0x4b6e) apunta a los records CORTOS 12-19, que
 * pertenecen SOLO al mandato ORDAINED (ver ORDAINED_PAGES) — usarlos aquí era el
 * off-by-0x10 `codex-lesson-swap` (texto equivocado en pantalla, auditoría 47896cfc).
 */
const CODEX_PAGES: readonly string[] = [
  '"A dishonest life brings\nunto thee temporary gain, but forsakes\nthe permanent."\n\n', // 0 Honestidad — MISCMSG 0x04ab (0x4b6e[0]=0x100)
  '"Only a\ndetested life\nowes its\npleasures to another\'s pain."\n\n', // 1 Compasión — 0x04f9
  '"Those who fear to try, know\nnot their\nlimits and thus know not themselves."\n\n', // 2 Valor — 0x0534
  '"Those who inflict injustice upon others, cannot expect fair treatment unto themselves."\n\n', // 3 Justicia — 0x057f
  '"None live alone, save\nthey who will\nnot share their fortune with those around them."\n\n', // 4 Sacrificio — 0x05d6
  '"It is the guilt, not the guillotine,\nthat\nconstitutes the shame."\n\n', // 5 Honor — 0x062a
  '"To forsake one\'s inner being is to abandon thy hopes for thyself and thy world."\n\n', // 6 Espiritualidad — 0x066b
  '"Pride is a vice, which Pride itself inclines one to find in others, and overlook in oneself."\n\n', // 7 Humildad — 0x06bb
];

/**
 * Frases del mandato ORDAINED (records CORTOS 12-19 de MISCMSG.DAT, tabla CAST2 DS 0x4b5e
 * = DATA.OVL fileoff 0x4b6e; `0x0aaa mov ax,[bx+0x4b5e]`): el ordained las compone como
 * `…learn <frase>` + DS 0x9598 (`"\n`), SIN envoltorio de comillas propio (la comilla de
 * cierre viaja en 0x9598 y la de apertura en el record 0x7b9). Derivado T-003 (yt-careo
 * §T-003). Tabla PROPIA, separada de CODEX_PAGES (que son las lecciones largas 20-27).
 */
const ORDAINED_PAGES: readonly string[] = [
  "the failing of Dishonesty!", // 0 Honestidad — MISCMSG 0x03ab (0x4b5e[0]=0x00)
  "of the heart of a cruel soul!", // 1 Compasión — 0x03c6
  "the failing of a life without Valour!", // 2 Valor — 0x03e4
  "the weakness of the Unjust!", // 3 Justicia — 0x040a
  "the failing of unwilling Sacrifice!", // 4 Sacrificio — 0x0426
  "the darkness of Dishonor!", // 5 Honor — 0x044a
  "the neglect of one's Spirit!", // 6 Espiritualidad — 0x0464
  "the weakness of a life consumed by Pride!", // 7 Humildad — 0x0481
];

/**
 * Frase ORDAINED de la virtud `v`, CRUDA (inglés): se interpola como ARG de `tf()`, que ya
 * pasa cada arg-string por `t()` — la key de es.json es la frase pelada, sin envoltorio.
 */
function ordainedPage(v: number): string {
  return ORDAINED_PAGES[v] ?? "";
}

/**
 * ★ #294 — ESPERA DE TECLA del rito. `call 0x448c` de CAST2 resuelve (banda 0xE1E0) al
 * kernel `getkey_with_redraw` 0x266c: bucle BLOQUEANTE 0x267f-0x269f sobre el poll 0x2032
 * que llama a 0x5910 (redibujo del viewport) mientras espera y no sale hasta que la tecla
 * es distinta de 0. Devuelve una tecla **ARBITRARIA**.
 * 🔴 CORRECCIÓN DE CORPUS que hace falta para leer esto: `agregado-23-acta.md:197` la llama
 * «getYN 0x448c, sólo lee Y/N». Es falso DE LA RUTINA — el filtro Y/N lo pone el LLAMADOR,
 * y el control vive en este mismo overlay: 0x0b6a envuelve la MISMA llamada en un bucle
 * `cmp ax,0x30`/`cmp ax,0x39` para quedarse sólo con dígitos (la donación), gesto que no
 * tendría sentido si la rutina ya filtrase. Quien lea la cita vieja concluirá que aquí no
 * puede haber una espera de tecla genérica — y por tanto que el reporte del usuario
 * («¿no hay que darle al Enter tanto en shrines como en Codex?») es imposible.
 * ⚠ CADA llamada devuelve un OBJETO NUEVO a propósito: el despachador de `main.ts` corta el
 * turno con `events.slice(events.indexOf(e) + 1)`, que es identidad por REFERENCIA — un
 * marcador compartido entre los nueve sitios del Códice cortaría siempre por el primero.
 * Sin constante de reloj: es espera de TECLA, no de temporizador. NO se calibra con vídeo.
 */
function keyWait(): GameEvent {
  return { kind: "shrine-key-wait" };
}

/**
 * CEREMONIA FINAL DE LAS 8 VIRTUDES (CAST2 0x0dac-0x0e5b), disparada dentro de la
 * lectura del Codex cuando las 8 lecciones quedan aprendidas (0x58CE==0xFF, gate
 * 0x0da2). Secuencia byte-exacta tras las 3 ráfagas de "viento" (0x0dac-0x0dee: TRES
 * sacudidas de pantalla vía kernel 0x3072 — la primitiva de terremoto; ya portadas
 * como `{kind:"quake"}`+rumble, ver el bloque `if (r.ceremony)`):
 *   1) "A STRANGE WIND…"  (MISCMSG 0x0900, buffer 0xb773) — fuente IBM.CH.
 *   2) "Thou dost read:\n\n" (DS 0x95ea → DATA.OVL 0x95fa) — fuente IBM.CH.
 *   3) 4 páginas de la PROFECÍA (MISCMSG 0x092a/0x097c/0x09b7/0x0a2b, buffers
 *      0xb79d/0xb7ef/0xb82a/0xb89e), cada una impresa con la FUENTE 1 RÚNICA
 *      (RUNES.CH): el binario conmuta `set_font(1)` (0x3abe, kernel 0x1c9e) antes
 *      de cada `print_string` y restaura `set_font(0)` después (0x0e02-0x0e5b). El
 *      original pagina con un getkey (0x448c) entre páginas — el port las vuelca al
 *      log de consola como el resto de la narración (paginación = Clase C).
 * Los bytes de la profecía llevan las RUNAS codificadas TAL CUAL las almacena el
 * fichero (@=separador, [=TH, ^=EA, _=ST, ]=NG, o=punto): la fuente RÚNICA las pinta
 * como glifos rúnicos (font-runes.png replica RUNES.CH byte a byte). Descifradas
 * revelan la Palabra de Poder VERAMOCOR. NO se traducen (son runas/Palabra, no prosa).
 * El binario NO fija ningún flag "VERAMOCOR conocida": el jugador debe recordarla; el
 * único write de estado (el bit visitado) ya lo hizo shrineCodexLesson (0x0d7d).
 */
/**
 * Nº de ráfagas de "viento" de la ceremonia final del Codex (CAST2 0x0dac-0x0dee):
 * TRES iteraciones del bloque redibujo+sacudida (0x2890/0x29a6/0x4e92). El 0x4e92 es
 * la primitiva de terremoto residente (kernel 0x3072); ver el bloque `if (r.ceremony)`.
 */
const CEREMONY_WIND_GUSTS = 3;
const CEREMONY_WIND = "A STRANGE WIND CAUSES THE PAGE TO TURN!\n\n"; // MISCMSG 0x0900 (0xb773)
const CEREMONY_READ = "Thou dost read:\n\n"; // DS 0x95ea → DATA.OVL 0x95fa
const CEREMONY_PROPHECY_PAGES: readonly string[] = [
  "BEYOND@SHAMES\nEGRESS@IN@[E\nCENTRE@OF@[E\nUNDERWORLD@[ERE IS@A@PLACE@OF\nDARKNESSo\n\n", // MISCMSG 0x092a (0xb79d)
  "BEYOND@[IS\nDARKNESS@LIES\n[E@GATE@TO@[E\nCORE@OF@[E\nWORLDo\n\n", // MISCMSG 0x097c (0xb7ef)
  "WHEN@[OU@ART\nR^DY@[OU@MU_\nCALL@FOR[\nVERAMOCOR@TO UNLOCK@[E@GATE\nAND@VENTURE@PA_\nE[ER^L@WARDS\nAND@_^LERS@OF\nSOULSo\n\n", // MISCMSG 0x09b7 (0xb82a)
  "[AT@WHICH@[E\nWORLD@HA[@LO_\nAWAITS@[Y@COMI]o\n\n", // MISCMSG 0x0a2b (0xb89e)
];

// (sin `pendingShrine`: no hay prompt "Meditate?" que dejar pendiente. El campo que
// aquí se describía —«meditación pendiente de respuesta Y/N», con su `kind`— fue
// RETIRADO con el yes/no fabricado, y su docblock sobrevivió al campo hasta #194.
// Las tres afirmaciones de aquel texto están muertas: no hay Y/N (el dispatch CAST2
// 0x0e76 no tiene getkey antes del `call 0x966`/`call 0xd24`), la ceremonia NO se
// decide al pisar (cuelga del (E)nter: cmd_enter 0x9da→0x936 / 0x91c→0x986 →
// 0xfffff89a) y no queda nada que «confirmar». Ver runShrineCeremony y enter().)
/** Prompts de santuario pendientes (los posee Game; el módulo los arma/consume). */
export interface ShrinePendingHolder {
  /** Interrogatorio de visita pendiente (CAST2 0x09c1 getstring + bucle 0x0a0c). */
  visit: { virtue: number } | null;
  /**
   * Restauración de santuario destruido pendiente (CMDS.OVL 0x1202, F1.4). Se arma al
   * pisar el tile BrokenShrine 0x1a (checkShrineEntry) y la resuelve submitShrineRestore
   * con la virtud + mantra×3 tecleados. Los getkeys de texto (0x1216/0x124f) son crudos
   * → no tocan el stream vivo. null fuera del flujo.
   */
  restore: { virtue: number; x: number; y: number } | null;
  /**
   * Escena MONTADA (#277): qué mapa de MISCMAPS está en pantalla mientras dura el rito,
   * o `null` fuera de él. Espeja el estado del wrapper CAST2 0x0e76 entre 0x0ea4
   * (`g_location = 0xFF`) y 0x10e7 (restaura la localización). Lo pone `runShrineCeremony`
   * y lo quita el evento de SALIDA, que se emite en cada rama terminal del rito.
   */
  scene: ShrineSceneKind | null;
}

/** Contexto estrecho de las ceremonias de santuario (lo arma Game.shrineCtx()). */
export interface ShrineCtx {
  state: GameState;
  /** Datos de santuario (virtudes/mantras/coords), `data.shrines`; undefined en mocks. */
  shrines: ShrineData | undefined;
  pending: ShrinePendingHolder;
  /** Tile del mapa activo (activeMap.tileAt). */
  tileAt(x: number, y: number): number;
  /**
   * Rejillas 11×11 de MISCMAPS.DAT para la ESCENA (#277), `shrine-scene.json` del
   * extractor. `undefined` sin asset (mocks, tests de sólo texto): entonces NO se emite
   * escena y el rito degrada al flujo de texto de siempre — nunca rompe el turno.
   */
  scenes?: Readonly<Record<ShrineSceneKind, ShrineSceneTiles>> | undefined;
}

/**
 * Evento de ENTRADA de la escena (#277), o `null` si no hay asset. Monta el mapa propio y
 * pone al Avatar caminando desde (5,10) hasta arrodillarse ante el altar — el bloque que
 * CAST2 0x0e76 corre ANTES de llamar a shrine_visit/codex (0x106c/0x1072).
 */
function shrineSceneEnter(ctx: ShrineCtx, kind: ShrineSceneKind): GameEvent | null {
  const tiles = ctx.scenes?.[kind];
  if (!tiles) return null;
  ctx.pending.scene = kind;
  return { kind: "shrine-scene", shrineScene: buildShrineEnterScript(kind, tiles) };
}

/**
 * Evento de SALIDA de la escena: se levanta, desanda el sendero y desaparece (0x1075-
 * 0x10bd). Va en CADA rama TERMINAL del rito — el original lo corre en el retorno del
 * wrapper, así que toda salida de la ceremonia pasa por aquí. `null` si no había escena
 * montada (sin asset, o rama que no venía del (E)nter).
 */
function shrineSceneExit(ctx: ShrineCtx): GameEvent | null {
  const kind = ctx.pending.scene;
  if (!kind) return null;
  const tiles = ctx.scenes?.[kind];
  ctx.pending.scene = null;
  if (!tiles) return null;
  return { kind: "shrine-scene", shrineScene: buildShrineExitScript(kind, tiles) };
}

/**
 * Guardián del Shrine of the Codex (MAINOUT 0x0C8A): al pisar (0xE9,0xEB) en el
 * overworld (floor 0, loc 0), con una Sacred Quest activa (shrineQuestBitmap ≠ 0)
 * puedes pasar; si no, "Passage denied!" y el guardián te empuja 1 al sur (0x0CCC
 * inc g_party_y). Strings de DATA.OVL DS+0x10 0x2B6E/0x2B7E/0x2BA1. SIN RNG — por
 * eso vive aquí (en move, tras el paso) y NO en el esqueleto de outdoorTurn, que
 * modela sólo el consumo de RNG del bucle. El puente/pantano/underworld-hazard
 * (que SÍ consumen RNG) los corre outdoorTurn en el orden exacto de turn.ts.
 */
export function applyShrineGuardian(ctx: ShrineCtx, events: GameEvent[]): void {
  const pos = ctx.state.position;
  if (pos.floor === 0 && pos.x === 0xe9 && pos.y === 0xeb) {
    // F2-T9 (espejo): la comilla de APERTURA es la string DS 0x2b6b (`\n"`),
    // impresa SIEMPRE antes de ambas ramas (0x0ca6, bytes verificados) — el
    // port emitía `Pass, Seeker!"` sin abrirla. Cierra dentro de 0x2b6e
    // (`Pass, Seeker!"\n`) o de 0x2ba1 (`Passage denied!"\n`).
    if (ctx.state.shrineQuestBitmap) {
      events.push({ kind: "message", text: '\n"Pass, Seeker!"\n' }); // 0x2b6b + 0x2b6e
    } else {
      events.push({ kind: "message", text: '\n"Thou art not upon a Sacred Quest!\n' }); // 0x2b6b + 0x2b7e
      events.push({ kind: "message", text: 'Passage denied!"\n' }); // 0x2ba1
      pos.y = (pos.y + 1) & 0xff; // 0x0CCC inc g_party_y
    }
  }
}

/**
 * El ÚNICO trigger on-step que queda: el santuario DESTRUIDO (CMDS 0x1202). Hermano de
 * checkMoongate/checkLocationEntry — sólo overworld, floor 0; empareja la casilla con la
 * tabla de santuarios (shrineIndexAt) y deja pedido el prompt de restauración.
 *   - tile BrokenShrine 0x1a → shrine-restore-prompt (submitShrineRestore).
 * ⚠ El santuario VIVO y el Codex ya NO entran por aquí: cuelgan del (E)nter (cmd_enter
 * MAINOUT 0x08de → 0x936/0x986 → CAST2 0x0e76), y el disparo AL PISAR era divergencia del
 * port, RETIRADA en F2-T6 con testigo P09. Ver `runShrineCeremony` abajo.
 * Esta cabecera decía «AL PISAR» y enumeraba las ramas de tile 0x11/0x19 que el cuerpo ya
 * no tiene, contradiciendo al comentario de tres líneas más abajo: `d609e94c` corrigió la
 * cabecera HERMANA (`runShrineCeremony`) y dejó ésta rancia — el género de #194, en la
 * mitad que su eje A no ve (#239).
 * Sin RNG, sin turno. Cita: re/notes/shrines.md §2, .superpowers/sdd/scout-shrines.md.
 */
export function checkShrineEntry(ctx: ShrineCtx, events: GameEvent[]): void {
  const pos = ctx.state.position;
  if (pos.location !== 0 || pos.floor !== 0) return;
  const shrines = ctx.shrines;
  if (!shrines) return;
  const tile = ctx.tileAt(pos.x, pos.y);
  // (F2-T6: la ceremonia de santuario VIVO y del Codex ya NO corre al pisar —
  // cuelga del (E)nter, cmd_enter 0x936/0x986 → 0xf89a; ver enter(). Aquí sólo
  // queda el trigger on-step del santuario DESTRUIDO (restore, CMDS 0x1202).)
  if (tile === BROKEN_SHRINE_TILE) {
    // Santuario destruido por un Shadowlord (CMDS 0x1202): no medita — pide teclear
    // virtud + mantra×3 (submitShrineRestore). shrineIndexAt garantiza la coord exacta.
    const v = shrineIndexAt(shrines, pos.x, pos.y);
    if (v < 0) return;
    ctx.pending.restore = { virtue: v, x: pos.x, y: pos.y };
    events.push({ kind: "shrine-restore-prompt" });
    return;
  }
}

/**
 * Corre la ceremonia de santuario/Codex. La DISPARA el (E)nter, no el paso: cmd_enter
 * (MAINOUT 0x08de) casa los tiles 0x19/0x11 (0x9da→0x936 / 0x91c→0x986) y llama
 * `0xfffff89a`, que entra por CAST2 0x0e76; ése lee el tile bajo la party (0x0e83-0x0e96,
 * puntero 0x6222) y despacha directo a shrine_visit 0x0966 / codex 0x0d24 (0x106c/0x1072).
 * ⚠ El disparo ON-STEP era divergencia del port, RETIRADA en F2-T6 con testigo P09
 * («>Enter the shrine of Compassion» ANTES de «Thou dost approach…»): hoy
 * `checkShrineEntry` sólo conserva el trigger del santuario DESTRUIDO. Este docblock
 * decía «AL PISAR» doce líneas debajo del comentario que ya lo desmentía (#194).
 * NO hay prompt "Meditate?" (Y/N): el disasm del
 * dispatch 0x0e76 NO tiene getkey (0x448c) antes del `call 0x966`/`call 0xd24` — el
 * yes/no "Wilt thou meditate?" era FABRICADO por el clon (texto inexistente en el
 * binario + paso inexistente; cita re/notes/shrines.md §2.2). g_location=0xFF suspende
 * el world-turn durante la ceremonia (0 turnos, 0 RNG). Según el estado:
 *   - Codex (peregrinaje): shrineCodexLesson marca la lección de la virtud de índice más
 *     bajo con quest activa; sin quest → sin efecto. Ceremonia final (8/8) DIFERIDA a
 *     endgame (⚠ 0x0dac-0x0e5b fuera de F1.4).
 *   - Santuario vivo, por shrineMode:
 *       · show-mantra → muestra virtud + mantra y fija la quest (shrineShowMantra).
 *       · donation    → emite shrine-donate-prompt (todo el flujo ya vive de F1.3).
 *       · quest-complete → shrineCompleteQuest (−quest, +3 karma [+3 Humildad], +1 attr
 *         del Avatar cap 30) y ecoa "<Attr> +1" (CAST2 0x0c9c-0x0cde).
 * Textos de Codex/quest DERIVADOS de MISCMSG.DAT (cargada en buffer 0xb21e desde el offset
 * de fichero 0x3ab; tabla de offsets DATA.OVL 0x4b6e). La ceremonia final de las 8
 * virtudes (VERAMOCOR, MISCMSG 0x0900+) YA está portada: profecía en fuente rúnica
 * (CEREMONY_*), disparada por r.ceremony. Ver el bloque `if (r.ceremony)` abajo.
 */
export function runShrineCeremony(
  ctx: ShrineCtx,
  pending: { kind: "visit"; virtue: number } | { kind: "codex" },
): GameEvent[] {
  const events: GameEvent[] = [];
  const shrines = ctx.shrines;
  if (!shrines) return events;

  if (pending.kind === "codex") {
    // Aproximación (rutina de ENTRADA CAST2 0x0e76, print 0x0f69-0x0f78): con tile==0x11
    // (#281, corregido 17-08 — decía «loc==0x11»: el 0x0f69 compara [bp-4], el TILE bajo
    // la party que call 0x6222 devolvió en 0x0e8d, NO g_location — que 0x0ea4 acaba de
    // poner a 0xFF; loc 0x11 sería el castillo de LB. Como ya decía el docblock de arriba.)
    // imprime el buffer 0xb8f9 = MISCMSG 0xa86. Va ANTES del despacho a codex (0x1072
    // call 0xd24) — también en la vía sin quest (el trap 0x0d64 se imprime después).
    events.push({ kind: "message", text: "\nThe Codex of Ultimate Wisdom lies before thee..." }); // MISCMSG 0xa86 (buf 0xb8f9)
    // ESCENA (#277): la cámara del Codex (MISCMAPS.DAT[352:528]) + los 7 pasos hasta el
    // atril. Va DESPUÉS de la línea de aproximación, como el binario (print 0x0f69 antes
    // del bucle de caminata 0x1053). ⚠ Clase C declarada: el censo de URNAS de abajo lo
    // imprime el original ENTRE la colocación (0x0f89) y la bajada (0x103c); aquí sale
    // tras la bajada, porque el guion de entrada es una sola pieza. Sólo orden de un
    // bloque de texto dentro de la escena — ni estado ni RNG.
    const enterCodex = shrineSceneEnter(ctx, "codex");
    if (enterCodex) events.push(enterCodex);
    // Urnas de compañeros perdidos (0x0fa4-0x1037, SOLO tile==0x11 — cmp [bp-4],0x11 en
    // 0x0fa4, mismo discriminante de TILE que la aproximación; #281): recorre los records
    // 1..15 del roster (nombres DS 0x55c8+0x20k) y con partyStatus (+0x1F, DS 0x55e7+0x20k)
    // == 0x7f — el marcador que deja sacrifice_member (BLCKTHRN 0x04c2: byte final del
    // slot = 0x7f) — imprime DS 0x9624 + (1: DS 0x9636 / >1: DS 0x9648) + nombre + 0x0a.
    const urns = ctx.state.characters
      .slice(1, 16)
      .filter((c) => c.partyStatus === 0x7f && c.name.length > 0)
      .map((c) => c.name);
    if (urns.length > 0) {
      events.push({ kind: "message", text: "\n\nThou dost see\n" }); // DS 0x9624 (fileoff 0x9634)
      events.push({
        kind: "message",
        text: urns.length === 1 ? "an urn marked:\n\n" : "urns marked:\n\n", // DS 0x9636 / 0x9648
      });
      for (const n of urns) events.push({ kind: "message", text: `${n}\n` }); // nombre + char 0x0a (0x101f)
    }
    // ★ #294 — el handler del Códice (`call 0xd24` desde 0x1072) ABRE con espera de tecla
    // (0x0d2b) y reparte sus dos líneas fijas entre las otras dos (0x0d35/0x0d3f): aquí es
    // ESPERA-luego-IMPRIME, al revés que el santuario (0x0a9b/0x0abc, imprime-luego-espera).
    // Son los tres primeros de los NUEVE del handler.
    events.push(keyWait()); // 0x0d2b
    // Secuencia real del Codex (CAST2 0x0d2e/0x0d38/0x0d81-0x0d98): dos líneas fijas + la
    // página de la virtud entre comillas. Todo desde MISCMSG.DAT (cargado en buffer 0xb21e
    // desde el offset de fichero 0x3ab; verificado por la longitud de la tabla DATA.OVL 0x4b6e).
    events.push({ kind: "message", text: "\nThe book is open to the page thou dost seek!\n\n" }); // 0x0d2e: 0xb703 → MISCMSG 0x0890
    events.push(keyWait()); // 0x0d35
    events.push({ kind: "message", text: "Upon the hallowed page thou dost read:\n\n" }); // 0x0d38: 0xb733 → MISCMSG 0x08c0
    events.push(keyWait()); // 0x0d3f
    // 🔴 ORDEN CORREGIDO POR #294 (y es un cambio de CONDUCTA, no de comentario): las dos
    // líneas de arriba se imprimen ANTES de buscar la virtud — el barrido del quest-bitmap
    // empieza en 0x0d42, DESPUÉS de los tres `call 0x448c`. El port las tenía detrás del
    // `return` de la trampa, así que la rama SIN quest activa salía a pelo con «HOW DID YOU
    // GET HERE?» y ninguna de las dos. En el original la trampa de dev llega DEBAJO de las
    // dos líneas normales, con sus tres esperas de tecla delante. Cablear las esperas sin
    // corregir el orden habría dejado tres teclas sin nada que separar en esa rama.
    const r = shrineCodexLesson(ctx.state); // el bit visitado se escribe en 0x0d7d, tras los prints
    if (r.virtue === null) {
      // Sin quest activa: el binario imprime el mensaje-trampa de dev (CAST2 0x0d64 → buffer
      // 0xb75c → MISCMSG.DAT 0x08e9). NO "naught to teach thee" (era placeholder fabricado).
      // ⚠ Esta rama salta a 0x0e5e (`jmp` de 0x0d6b) = el RET: NO lleva espera detrás.
      events.push({ kind: "message", text: "HOW DID YOU GET HERE?\n" });
      const exitTrap = shrineSceneExit(ctx);
      if (exitTrap) events.push(exitTrap);
      return events;
    }
    events.push({ kind: "message", text: CODEX_PAGES[r.virtue]! }); // 0x0d81-0x0d9c: putchar '"' + lección larga (tabla DS 0x4b6e = fileoff 0x4b7e, recs 20-27) + DS 0x95e6 `"\n\n`
    events.push({ kind: "party-changed" });
    events.push(keyWait()); // 0x0d9f — CUARTA espera. El gate de la ceremonia (0x0da2) va DETRÁS: sin las 8 virtudes, ésta es la última
    if (r.ceremony) {
      // Ceremonia final de las 8 virtudes (CAST2 0x0dac-0x0e5b). El "viento" que abre
      // la profecía (0x0dac-0x0dee) NO es un FX inventado: son TRES iteraciones de un
      // mismo bloque (redibujo de la ventana de juego + SACUDIDA). Cada bloque llama:
      //   · 0x2890(g_unk_13ae/13b0)  — setup de región de pantalla (intro-demo-scene.md)
      //   · 0x29a6(8,8,0xb7,0xb7)    — recompone/redibuja esa ventana
      //   · 0x4e92                    — near-call de banda 4 (base 0xe1e0) → kernel
      //     RESIDENTE 0x3072, la PRIMITIVA DE TERREMOTO (blit-shift vertical + rumble
      //     de tonos aleatorios), la MISMA del clavicémbalo / palabra de poder / sismo
      //     del Underworld. Confirmado en quake-harpsichord.md §6.3 (lista los 3 sitios
      //     0x0dc0/0x0dd7/0x0dee como callers de 0x3072).
      //     🔴 EN CAST2 LOS CALLERS DE 0x3072 SON CUATRO, NO TRES (censado 2026-08-07 al
      //     leer el cuerpo entero de `shrine_visit`): 0x0dc0/0x0dd7/0x0dee son los TRES de
      //     esta ceremonia, y falta **0x0c88**, dentro de la rama COMPLETAR QUEST de
      //     `shrine_visit` (CAST2 0x0966). No cambia nada de este bloque — lo anoto porque
      //     la lista de tres se ha citado como si fuera el censo del overlay, y no lo es.
      //     Consecuencia que sí importa y vive en shrines.ts: 0x3072 tiene cuatro
      //     `call rand_range` en bucles ⇒ ese cuarto caller MUEVE EL STREAM.
      // Se porta con el mismo par de presentación que el sismo del Underworld:
      // `{kind:"quake"}` (la piel lo enruta a su QuakeShake) + `sfxEvent("quake")` (el
      // rumble). TRES veces = las tres ráfagas.
      // 🔴 ~~El redibujo previo (0x2890/0x29a6) es plumbing del original (recompone la
      // ventana antes de cada sacudida); la piel ya repinta cada frame, así que no necesita
      // evento propio.~~ — FALSO, y era la avería que auto-justificaba la omisión (#295,
      // 14-08). `0x2890` es `set_color(c)` y `0x29a6` es el `rect(8,8,0xb7,0xb7)` con `stc`,
      // o sea la MISMA inversión XOR del viewport que el WELL DONE de abajo: los tres pares
      // 0x0db3/0x0dca/0x0de1 BRACKETAN las tres sacudidas alternando `g_unk_13ae` y
      // `g_unk_13b0`. Lo que le falta al port aquí no es la sacudida, es el bracket.
      // ~~🔴 Y SIGUE SIN CABLEARSE~~ — CABLEADO (fix-codice, 19-08), tras abrirse la
      // DOBLE cerradura con #299 (2026-08-19):
      //   (1) ~~el valor de arranque de `g_unk_13ae` no está acreditado (#305, oráculo)~~
      //       #305 DERIVADA EN ESTÁTICO: único escritor de `g_unk_13ae`/`g_unk_13b0` en el
      //       corpus disasm = INTRO.OVL 0x09f4/0x09fa (rama EGA/Tandy) — 13ae=4, 13b0=0xF;
      //       corroborado vivo en otros tiempos por #297 (rojo del catalejo) y #295 (15 del
      //       WELL DONE). Derivación: game/tests/healer-flash.test.ts (cabecera).
      //   (2) ~~el modelo de render del port no puede expresarlo (#317)~~ EXISTE:
      //       `skin/fiel/palette-xor.ts` (XOR de índice EGA contra la LUT, estrenado por el
      //       destello del curandero #299 en las dos pieles).
      // El cableado (patrón healerFlash): cada quake de la ceremonia lleva el marcador
      // `xorBracket` — la piel arranca con él su `CodexWindFlash` (máscaras ACUMULADAS
      // 4 → 11 → 15, una ventana por ráfaga, skin/fiel/invert-flash.ts; pintor
      // `paletteXorViewportInterior` en la fiel y `paletteXorRect` en el compose del
      // shader). El residuo p^15 del tercer rect lo restaura en 1988 el redibujo del
      // primer keywait (0x0df8 → getkey_with_redraw 0x266c) y aquí la caducidad de la
      // tercera ventana. La CADENCIA entre ráfagas sigue siendo
      // Clase C: la piel renderiza la ráfaga como una sacudida sostenida.
      // ⚠ El GATE de este bracket en el binario es `0x0da2 cmp [g_shrine_visited_bitmap],0xff`
      // (+ `0x0da9 jmp 0xe5e`): sin los OCHO santuarios visitados no corre. `r.ceremony` del
      // port sale de `shrineCodexLesson`, que es el mismo predicado sobre el mismo bitmap
      // — careado, equivalente, y por eso NO se toca aquí.
      for (let i = 0; i < CEREMONY_WIND_GUSTS; i++) {
        // `xorBracket`: la ráfaga va ENVUELTA por su par set_color+rect XOR (0x0db3/
        // 0x0dca/0x0de1) — el marcador con que la piel arranca el CodexWindFlash.
        events.push({ kind: "quake", xorBracket: true }); // kernel 0x3072 (sacudida, CAST2 0x0dc0/0dd7/0dee)
        events.push(sfxEvent("quake")); // rumble de la primitiva 0x3072
      }
      // Tras el viento: "A STRANGE WIND…" (IBM) + "Thou dost read:" (IBM) + las 4 páginas
      // de la profecía impresas con la FUENTE RÚNICA (`rune: true` → set_font(1),
      // 0x0e02-0x0e5b). Ver CEREMONY_* arriba. Sin flag de estado (VERAMOCOR es la Palabra
      // que el jugador debe recordar; el bit visitado ya se fijó en shrineCodexLesson).
      events.push({ kind: "message", text: CEREMONY_WIND }); // 0x0df1: MISCMSG 0x0900
      // ★ #294 — las CINCO esperas restantes del handler. El «viento» y la línea de
      // apertura NO se separan entre sí (0x0df8 va entre ellas, y 0x0dfb-0x0e0d imprimen
      // «Thou dost read:» + la PRIMERA página seguidas): la espera cae ANTES de la línea
      // de apertura, y luego UNA POR PÁGINA rúnica.
      events.push(keyWait()); // 0x0df8
      events.push({ kind: "message", text: CEREMONY_READ }); // 0x0dfb: DS 0x95ea
      for (let i = 0; i < CEREMONY_PROPHECY_PAGES.length; i++) {
        // Cada página es set_font(1) → print_string → set_font(0) → TECLA
        // (0x0e02-0x0e16 · 0x0e19-0x0e2d · 0x0e30-0x0e44 · 0x0e47-0x0e5b).
        events.push({ kind: "message", text: CEREMONY_PROPHECY_PAGES[i]!, rune: true });
        events.push(keyWait()); // 0x0e16 / 0x0e2d / 0x0e44 / 0x0e5b
      }
    }
    // La lectura del Codex es TERMINAL (no abre prompt): aquí se desmonta la escena —
    // levantarse + desandar el sendero + explanada vacía (CAST2 0x1075-0x10bd).
    const exitCodex = shrineSceneExit(ctx);
    if (exitCodex) events.push(exitCodex);
    return events;
  }

  const v = pending.virtue;
  // T-003 corpus (re-derivación CAST2 shrine_visit 0x0966): el INTERROGATORIO va PRIMERO
  // — kneel (anim 0x6c + print 0xb58b) → virtud tecleada → Mantra ×3 — y SOLO tras el
  // match se ramifica por bitmaps (ordained/quest-complete/donación). El antiguo
  // "show-mantra" (imprimir virtud+mantra) era MISDERIVACIÓN de 0x0a81 (esa dirección
  // es la rama ordained). Cita completa: re/notes/yt-careo-tickets.md §T-003.
  ctx.pending.visit = { virtue: v };
  // Aproximación (rutina de ENTRADA CAST2 0x0e76, print 0x0f69-0x0f78): con tile!=0x11
  // (#281: TILE de call 0x6222, no g_location — ver la nota gemela de la rama codex)
  // imprime el buffer 0xb8cc = MISCMSG 0xa59, ANTES del despacho a shrine_visit (0x106c
  // call 0x966), cuyo primer print es el kneel 0x718.
  events.push({ kind: "message", text: "\nThou dost approach the tranquil Shrine...\n\n" }); // MISCMSG 0xa59 (buf 0xb8cc)
  // ESCENA (#277): la explanada del santuario (MISCMAPS.DAT[176:352]) + los 4 pasos por el
  // sendero + el tile de arrodillado. Va ENTRE las dos líneas porque ése es el orden del
  // binario: la aproximación se imprime en el wrapper (0x0f69, antes de la caminata
  // 0x1053) y el kneel es el PRIMER print de shrine_visit (0x09ac), inmediatamente
  // después de escribir el tile 0x6c en 0x09a1 — que es el último beat del guion.
  const enterVisit = shrineSceneEnter(ctx, "shrine");
  if (enterVisit) events.push(enterVisit);
  events.push({ kind: "message", text: "...and thou dost kneel before the Altar.\n\n" }); // MISCMSG 0x718 (buf 0xb58b)
  events.push({ kind: "shrine-visit-prompt" });
  return events;
}

/**
 * Resuelve el interrogatorio de la visita a santuario VIVO (T-003; CAST2 0x09d6-0x0b18).
 * Fallo (virtud o cualquier mantra) → «Thine thoughts are unfocused.» (0xb5de) y fin.
 * Match → ramifica por bitmaps como el binario: visited-clear → ORDAINED (0x0a81: fija
 * quest-bit + Altar speaks + sacred Quest con página del Codex + Return again);
 * visited+quest → quest-complete (WELL DONE, ya cableado); visited sin quest → donación.
 */
export function submitShrineVisit(
  ctx: ShrineCtx,
  typedVirtue: string,
  typedMantras: string[],
): GameEvent[] {
  const events: GameEvent[] = [];
  const pending = ctx.pending.visit;
  ctx.pending.visit = null;
  const shrines = ctx.shrines;
  if (!pending || !shrines) return events;
  const v = pending.virtue;
  // #275 — ENTRADA VACÍA = SALIR DEL RITO, EN SILENCIO. El binario comprueba el buffer de
  // entrada ANTES de compararlo: `cmp byte [0xbd08], 0` en CAST2 0x09cc (virtud) y 0x0a1e
  // (cada uno de los tres mantras), y en los dos casos salta a 0x0d1d — que está DESPUÉS
  // del `call 0x5906` de 0x0d1a, así que la salida vacía se lleva por delante hasta el
  // flash final: no imprime nada en absoluto. «Thine thoughts are unfocused.» (0xb5de)
  // vive en OTRA rama (0x0a62), la de mantra equivocado, y sólo se alcanza con el buffer
  // NO vacío. El port hacía caer la cadena vacía en el camino de fallo del core y por eso
  // hablaba donde el original calla.
  if (typedVirtue.length === 0 || typedMantras.some((m) => m.length === 0)) {
    const exitEmpty = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
    if (exitEmpty) events.push(exitEmpty);
    return events;
  }
  if (!shrineVisitCheck(v, typedVirtue, typedMantras, shrines)) {
    events.push({ kind: "message", text: "\n\nThine thoughts are unfocused.\n" }); // MISCMSG 0x76b (buf 0xb5de)
    const exitFail = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
    if (exitFail) events.push(exitFail);
    return events;
  }
  const mode = shrineMode(ctx.state, v);
  if (mode === "show-mantra") {
    // Rama ORDAINED (0x0a81-0x0b04): fija el bit de quest (shrineShowMantra conserva la
    // transición de estado; sus textos ya no se imprimen) + secuencia byte-exacta.
    shrineShowMantra(ctx.state, v, shrines);
    events.push({ kind: "message", text: "\n\nThe Altar speaks and a Quest is ordained! " }); // 0x0a8c: MISCMSG 0x78c (buf 0xb5ff)
    // ★ #294 — las DOS esperas de tecla de `shrine_visit` (0x0a9b y 0x0abc) parten esta rama
    // en TRES bloques. Aquí es IMPRIME-luego-ESPERA (al revés que el Códice). Son las únicas
    // dos de todo 0x0966-0x0d23: la rama de QUEST COMPLETA (WELL DONE) no lleva ninguna.
    // ⚠ Clase C declarada: entre el print y la primera espera el binario pone al Avatar DE
    // PIE (0x0a93-0x0a98 escriben el tile 0x1c en `g_char_anim_states[0..1]`), o sea que en
    // 1988 se levanta MIENTRAS habla el altar. En el port el levantarse vive en el guion de
    // SALIDA (`buildShrineExitScript`, #277), que corre al final de la rama. Sólo cambia
    // CUÁNDO se ve el cambio de tile dentro de la misma escena: ni estado ni RNG.
    events.push(keyWait()); // 0x0a9b
    events.push({
      kind: "message",
      // COMPUESTO → tf() en call-site (choke i18n); 0x0a9e-0x0ab9: MISCMSG 0x7b9 (buf 0xb62c) + página [0x4b5e[v]] + DS 0x9598 `"\n`
      text: tf("\n\n\"'Tis now thy sacred Quest to go unto the Codex and learn {}\"\n", ordainedPage(v)),
    });
    events.push(keyWait()); // 0x0abc
    events.push({ kind: "message", text: "\n\"Return again when thy Quest is done!\"\n" }); // 0x0abf: MISCMSG 0x7f6 (buf 0xb669)
    // ★ #364-b — la MELODÍA del ORDAINED, pegada detrás del último print como en el binario:
    // el bucle de 7 notas (0x0ac6-0x0b02) arranca justo tras el print de 0x0ac3, una llamada
    // a `tone` (0x3fb2) por nota con los cinco args de las tablas DS 0x4be6/0x4bf4/0x4c02/
    // 0x4c10 (valores en la piel, leídos de DATA.OVL). SIN inversión NI sacudida: la rama no
    // llama a 0x2890/0x29a6/0x4e92 — sale por `jmp 0xd16` (@0x0b04) al flash común del rito.
    // Por eso aquí hay cue y NO hay `ritual-invert` ni `{kind:"quake"}`.
    events.push(sfxEvent("shrine-ordained")); // 0x0adb-0x0b02: las 7 notas
    const exitOrdained = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
    if (exitOrdained) events.push(exitOrdained);
    return events;
  }
  if (mode === "donation") {
    events.push({ kind: "shrine-donate-prompt" }); // flujo completo cableado en F1.3
    return events;
  }
  // quest-complete
  const avatar = ctx.state.characters[0]!;
  const { attrs } = shrineCompleteQuest(ctx.state, v, avatar);
  // ★ #294 — NEGATIVO SOSTENIDO: esta rama (0x0c18-0x0d1a) **no lleva ni un `call 0x448c`**.
  // El censo del overlay son 15 llamadas y ninguna cae en este tramo (las de al lado son
  // 0x0abc, en ORDAINED, y 0x0d2b, ya dentro del handler del Códice). Aquí el original NO
  // espera nada: imprime, barre el altavoz y sale. Quien «complete la simetría» metiendo una
  // espera entre el WELL DONE y los «+1» estaría inventando una pausa que 1988 no tiene.
  // "WELL DONE!" del Altar (CAST2 0x0c29 → buffer 0xb6d7 → MISCMSG.DAT 0x0864). SIN nombre de
  // virtud (el "The Quest of {} is complete!" era placeholder fabricado con interpolación).
  events.push({ kind: "message", text: "\n\nA thunderous voice booms:\n\n\"WELL DONE!\"\n\n" });
  // ★ #295 — NEGATIVO SOSTENIDO del viewport, en el orden EXACTO del binario:
  //   0x0c29 print("WELL DONE!")  ·  0x0c34 set_color([g_unk_13b0]=15)  ·  0x0c41 rect XOR
  //   0x0c44-0x0c85 los DOS barridos de altavoz  ·  0x0c88 call 0x4e92  ·  texto  ·
  //   0x0d1a kernel_flash(10) ← lo que RESTAURA el viewport.
  // La inversión va DESPUÉS del texto en el binario y aquí también, y NO lleva duración: es
  // estado, y la ventana la mide `ui/ritual-invert.ts` con los barridos de la línea
  // siguiente MÁS la sacudida de 0x0c88 (#355 — el flash de 0x0d1a llega DETRÁS de ella).
  events.push({ kind: "ritual-invert" }); // 0x0c34 set_color + 0x0c41 rect XOR
  events.push(sfxEvent("shrine-well-done")); // 0x0c44-0x0c85: 920 tonos, dos tramos espejo
  // ★ #330(A) — EL TRUENO DEL WELL DONE, cableado. `0x0c88 call 0x4e92` es el CUARTO caller
  // del kernel `0x3072` = `screen_shake_fx`, LA MISMA rutina que las tres ráfagas de la
  // ceremonia del Códice de arriba (0x0dc0/0x0dd7/0x0dee) — no un efecto distinto. Por eso
  // se emite con el MISMO par que allí, y no con un cue nuevo. ~~Sin cablear porque movería
  // el stream~~ — la premisa era correcta del BINARIO y falsa del PORT (ver abajo).
  //
  // RNG — ADJUDICADO, y el PRNG es el DEL JUEGO, no el de audio. `0x3072` llama a
  // `rand_range` (`0x2092`), que muta `g_rng_seed` en `0x5420`: NO es el LFSR propio de
  // `noise_burst` (`0x223c`, estado en `0x545c`) que dejó a #217 sin ventana. Cardinal
  // REHECHO leyendo el cuerpo entero, como exigía #300 (su derivador avisó de que ninguna
  // de las dos cifras en circulación era firme):
  //     `[bp-6]=8` (0x3090) → OCHO pasadas del bucle externo (`dec`/`jne` en 0x315d)
  //     × CUATRO bucles internos por pasada (0x3098 ↑, 0x30c9 ↑, 0x30fd ↓, 0x312d ↓)
  //     × 58 iteraciones cada uno (`si` de 8 a 0xb3 paso 3 ⇒ ⌊171/3⌋+1)
  //     = 8 × 4 × 58 = 1.856 tiradas por invocación.
  // Eso RECONCILIA las dos cuentas que #300 daba por irreconciliables: las «~58×2» del
  // derivador eran los bucles internos SIN el anidamiento (le faltaban dos de los cuatro y
  // el ×8 externo), y las 1.856 de #249 son exactamente esta cifra. Son la misma rutina y
  // la misma aritmética.
  //
  // ⇒ NO ABRE VENTANA, y la razón es de ALCANCE, no de tamaño: el port NO CALCA ese consumo
  // en NINGUNO de los cuatro sitios. `{kind:"quake"}` es presentación pura (la piel lo enruta
  // a su QuakeShake) y las tres ráfagas del Códice ya corren a RNG CERO desde que se
  // cablearon. Este cuarto sitio hereda la MISMA divergencia ya declarada — no estrena una
  // clase nueva ni cambia el stream del port respecto a ayer. Lo que se DECLARA (doctrina de
  // #329: el consumo del original se declara, no se completa) es que en 1988 este WELL DONE
  // mueve el stream 1.856 tiradas y aquí cero.
  events.push({ kind: "quake" }); // 0x0c88 call 0x4e92 → kernel 0x3072 screen_shake_fx
  events.push(sfxEvent("quake")); // el rumble ES la sacudida: un tono por banda dibujada
  // Nombre específico (no "LABEL" genérico) para poder allowlistarlo en el extractor de la
  // guarda anti-fab (DISPLAY_CONSTS) sin footgun de colisión — carril guard-hardening.
  const SHRINE_ATTR_LABELS = { strength: "Strength", dexterity: "Dexterity", intelligence: "Intelligence" } as const;
  // Formas byte-exactas CON \n final (DS 0x95b8/0x95c6/0x95d4 → DATA.OVL 0x95c8/0x95d6/0x95e4, DS+0x10).
  for (const a of attrs) events.push({ kind: "message", text: `${SHRINE_ATTR_LABELS[a]} +1\n` }); // CAST2 0x0c9c-0x0cde
  events.push({ kind: "party-changed" });
  const exitComplete = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
  if (exitComplete) events.push(exitComplete);
  return events;
}

/**
 * Resuelve la restauración de un santuario destruido (CMDS.OVL 0x1202 `shrine_restore`,
 * F1.4). Requiere, TODO simultáneamente: virtud tecleada == data.virtues[v], mantra×3 ==
 * data.mantras[v] y coord exacta del santuario (ya garantizada por pendingRestore). Si
 * acierta, shrineRestore limpia el bit alto de g_shrine_destroyed[v] — y con eso basta:
 * el compose por frame (OUTSUBS.OVL 0x0178) repinta 0x19 desde el bitmap (#212; el
 * repintado inmediato del binario, CMDS 0x12a2/0x12ad vía tile_addr, es VOLÁTIL).
 * Un solo fallo → sin efecto. Sin RNG: los getkeys de texto (0x1216/0x124f) son crudos →
 * no tocan el stream vivo.
 * Strings de resultado DERIVADAS (CMDS.OVL, DS+0x10 → DATA.OVL): éxito DS 0x4482 =
 * "\n\nThe Shrine is\nrestored!\n" (0x1298); fallo (0x1278 `or di,di`→0x12b8) imprime
 * SÓLO un salto de línea (`mov ax,0xa; call print_char`), SIN texto — el "Nothing
 * happens." era FABRICADO. Los prompts "Upon what virtue…"/"Mantra:" los recoge la UI.
 */
export function submitShrineRestore(
  ctx: ShrineCtx,
  typedVirtue: string,
  typedMantras: string[],
): GameEvent[] {
  const events: GameEvent[] = [];
  const pending = ctx.pending.restore;
  ctx.pending.restore = null;
  const shrines = ctx.shrines;
  if (!pending || !shrines) return events;
  const r = shrineRestore(
    ctx.state, pending.virtue, typedVirtue, typedMantras, pending.x, pending.y, shrines,
  );
  if (!r.restored) {
    events.push({ kind: "message", text: "\n" }); // fallo: sólo salto de línea (CMDS 0x12b8 `mov ax,0xa`), sin texto
    return events;
  }
  // #212: el repintado inmediato del binario (CMDS 0x12a2/0x12ad, escritura por tile_addr
  // ULTIMA.EXE 0x4402) es VOLÁTIL — muere al recargar el mapa. La persistencia REAL es el
  // bitmap g_shrine_destroyed (roster+0x332, .GAM), y el compose por frame (OUTSUBS.OVL
  // 0x0178, game.ts tileAt) ya repinta 0x19/0x1a desde ese bitmap: con el bit limpio, el
  // tile vuelve solo. El mapOverride persistente que había aquí era un NO-OP (el mapa
  // estático ya guarda 0x19) que sólo ensuciaba el save.
  events.push({ kind: "message", text: "\n\nThe Shrine is\nrestored!\n" }); // CMDS 0x1298 → DS 0x4482 (DATA.OVL 0x4492)
  events.push({ kind: "map-changed" });
  return events;
}

/**
 * Resuelve el prompt de donación de santuario (CAST2 0x0B1D, shrines.md:159).
 * `n` = dígito tecleado (getkey crudo 0x448c: NO consume el stream vivo).
 *   - n≤0 → "0 gp" (el eco del dígito + DS 0x959c) y sale sin donar, sin karma y SIN
 *     re-preguntar — el defecto real del original, calcado. 🔴 Esta línea decía
 *     «NO-OP: " gp"», que es la lectura REFUTADA el 2026-08-07 (el `putchar` de 0x0b26 va
 *     ANTES de la bifurcación) y además se contradecía con la línea de nueve más abajo de
 *     este mismo bloque, que ya decía que el eco lleva el "0" delante. Manda el código.
 *   - 100·n > oro → "not enough" (0xb6b9) + RE-EMITE el prompt: la recursión es
 *     el bucle del original (0xb5f→0xb63), que re-pide un dígito sin cobrar.
 *   - si alcanza → shrineDonate (world/shrines.ts): gold−=100·n, karma+=n
 *     (clamp 99). NO se duplica la regla — se delega en la función pura.
 * El eco del dígito va embebido en el texto del resultado ("300 gp" incluye el
 * "3"; "0 gp" incluye el "0"), como los flujos Y/N no ecoan la tecla aparte.
 *
 * Strings DERIVADAS: el eco "<n>00 gp\n\n" (DS 0x95a2) se imprime SIEMPRE tras teclear el
 * dígito, ANTES del gate de oro (CAST2 0x0b40); el dígito '0' corta con "0 gp\n" (DS 0x959c,
 * 0x0b2f). Sin oro → "Thou hast not that much gold!" (MISCMSG.DAT 0x0846 / buffer 0xb6b9,
 * 0x0b52) + re-prompt. Éxito → "ALAKAZAM!\n" (DS 0x95aa "ALAKAZAM" + 0x95b4 "!\n", 0x0ba8/0x0bb5)
 * + inversión XOR sostenida + dos barridos espejo (#364, bloque en el cuerpo). Las salidas
 * SIN efecto (n=0, oro insuficiente) NI invierten NI suenan — espejo del asm.
 * (MISCMSG cargado en el buffer 0xb21e desde el offset de fichero 0x3ab.)
 */
export function submitDonation(ctx: ShrineCtx, n: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (n <= 0) {
    events.push({ kind: "message", text: "0 gp\n" }); // dígito '0' + " gp\n" (DS 0x959c), sale sin donar
    const exitZero = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
    if (exitZero) events.push(exitZero);
    return events;
  }
  const res = shrineDonate(ctx.state, n);
  events.push({ kind: "message", text: `${res.cost} gp\n\n` }); // eco "<n>00 gp\n\n" (DS 0x95a2), SIEMPRE antes del gate (0x0b40)
  if (!res.accepted) {
    events.push({ kind: "message", text: "Thou hast not that much gold!" }); // MISCMSG.DAT 0x0846 (buffer 0xb6b9)
    events.push({ kind: "shrine-donate-prompt" }); // re-pregunta (bucle 0x0b5f del original)
    return events;
  }
  // ★ #364-c (CABO CERRADO): el binario imprime "ALAKAZAM" con set_font(1) y vuelve a
  // font 0 SOLO para el "!\n" (0x0ba1/0x0baf `call 0x3abe` con ax=1/ax=0) — cambio de
  // fuente A MITAD DE FILA. El modelo de consola ya es POR-TRAMO (`segments`,
  // coreview.pushConsoleSegments → printStringSegments): la palabra viaja rúnica y el
  // "!" latino EN LA MISMA FILA, calcando el par de tramos del binario. `text` conserva
  // la concatenación (historial/e2e/espejo). Contexto: re/notes/shrine-donation-364.md.
  events.push({
    kind: "message",
    text: "ALAKAZAM!\n", // éxito (DS 0x95aa "ALAKAZAM" + 0x95b4 "!\n")
    segments: [
      { text: "ALAKAZAM", rune: true }, // DS 0x95aa, impreso bajo set_font(1) (0x0ba1)
      { text: "!\n", rune: false }, // DS 0x95b4, tras volver a font 0 (0x0baf)
    ],
  });
  // ★ #364 — PARIDAD AV de la rama 0x0b1d, calcada del patrón WELL DONE de arriba (#295):
  // el binario, tras el texto, invierte el viewport y lo SOSTIENE con los dos barridos:
  //   0x0bbc push [g_unk_13b0] / 0x0bc0 call 0x2890   ; set_color
  //   0x0bc3-0x0bcd push 8,8,0xb7,0xb7 / call 0x29a6  ; rect XOR ⇒ INVIERTE (suelto)
  //   0x0bd0-0x0c0f los DOS barridos espejo            ; tone(0xa8c,1,0xc8,si,0) ×920
  //   0x0c14 jmp 0xd16 → kernel_flash(10)              ; RESTAURA
  // SIN sacudida: aquí no hay `call 0x4e92` (a diferencia de 0x0c88 en el WELL DONE).
  // `ritual:"donation"` le dice a la piel de qué par de barridos derivar la ventana
  // (count 0xc8, no el 0x96 del WELL DONE). La inversión NO corta el bucle de eventos y la
  // salida de escena de abajo se serializa detrás de la restauración (main.ts, #330(B)).
  events.push({ kind: "ritual-invert", ritual: "donation" }); // 0x0bc0 set_color + 0x0bcd rect XOR
  events.push(sfxEvent("shrine-donation")); // 0x0bd0-0x0c0f: 920 tonos, dos tramos espejo
  events.push({ kind: "party-changed" }); // oro/karma cambiaron
  const exitDonated = shrineSceneExit(ctx); // rama terminal → se desmonta la escena (#277)
  if (exitDonated) events.push(exitDonated);
  return events;
}
