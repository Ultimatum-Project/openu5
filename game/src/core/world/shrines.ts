/**
 * Santuarios de las 8 virtudes de Ultima V — reglas EXACTAS del binario DOS.
 *
 * Dos handlers distintos del original:
 *  - Santuario VIVO (CAST2.OVL 0x0966 `shrine_visit`): con la party EN la casilla de
 *    un santuario en pie, lo dispara el (E)nter — NO el paso. cmd_enter
 *    (MAINOUT 0x08de) casa el tile 0x19 (0x9da→0x936) y llama `0xfffff89a` → CAST2
 *    0x0e76, que despacha a 0x0966 en 0x106c. (El disparo ON-STEP era divergencia del
 *    port, retirada en F2-T6 con testigo P09; esta cabecera se quedó sin barrer hasta
 *    #194. Ver world/shrine-ceremonies.ts `runShrineCeremony` y game.ts `enter`.)
 *    Primera visita activa la quest y muestra el mantra;
 *    visitas posteriores completan la quest (sube atributo + karma) o aceptan
 *    una donación (+1 karma por cada 100 de oro).
 *  - Restaurar santuario DESTRUIDO (CMDS.OVL 0x1202 `shrine_restore`): un
 *    Shadowlord puede destruir un santuario (bit alto de g_shrine_destroyed).
 *    Meditar tecleando la virtud + el mantra ×3, estando en la casilla exacta,
 *    lo restaura.
 *
 * 🔴 RNG — ESTA LÍNEA DECÍA «NINGUNA de las dos mecánicas consume RNG (0 `call rand_range`
 * en los handlers)» Y ERA FALSA: medía PROFUNDIDAD 1 y estaba escrita como total. Cierto
 * que ningún destino directo de `shrine_visit` (CAST2 0x0966) es un thunk de azar — los 13
 * lo son de kernel y ninguno tira. Pero **completar una quest de santuario SÍ mueve el
 * stream**: la rama COMPLETAR QUEST llama en `0x0c88` a `screen_shake_fx` (kernel 0x3072),
 * que contiene CUATRO `call rand_range` (0x30b4/0x30e8/0x3119/0x314c) y los cuatro DENTRO
 * de bucles ⇒ no es una tirada. La cifra exacta NO está acotada aquí a propósito: ese
 * cuerpo es de otra fila del ledger. Lo que sí está medido es el hecho.
 * (Derivado leyendo el cuerpo entero de `shrine_visit`, 2026-08-07.)
 * Datos: virtudes/mantras/coords en DATA.OVL (data.json: virtues[], mantras[],
 * shrineX[], shrineY[]); banderas de atributo en DATA.OVL 0x4B7E/0x4B86/0x4B8E.
 * Citas asm en re/notes/shrines.md.
 */
import type { CharacterState, GameState } from "../state.js";

/** Número de santuarios / virtudes. */
export const SHRINE_COUNT = 8;

/** Karma es un byte con clamp 0..0x63 (99) en cada escritura (CAST2 0x0b95/0x0c8b). */
export const KARMA_MAX = 0x63;
/** Los atributos del Avatar topan en 0x1E (30) al subir por quest (CAST2 0x0cb1). */
const ATTR_MAX = 0x1e;

/**
 * Banderas de qué atributo sube cada santuario al completar su quest, índice =
 * virtud 0..7. Volcado directo del binario DATA.OVL (DS 0x4B7E/0x4B86/0x4B8E →
 * fileoff 0x4B8E/0x4B96/0x4B9E). El cruce de paridad las revalida contra DATA.OVL.
 *
 * ★ #330(C) — VERIFICADAS BYTE A BYTE contra `original/u5/ultima5/DATA.OVL` (48.464 B).
 * Las tres filas de abajo son los bytes crudos de esos tres offsets, sin transformar.
 * El reporte del usuario del 15-08 («¿está bien el +1 de inteligencia?») queda cerrado
 * CONFIRMADO, y de paso corrige la pregunta: **no hay «el» premio.** El binario consulta
 * las TRES tablas seguidas (CAST2 0x0c9c / 0x0cbd / 0x0cde, `cmp byte [bx+tabla],0` con
 * `bx` = índice de santuario) y sube CADA atributo cuya bandera valga ≠0 ⇒ un santuario
 * puede subir uno, dos o TRES, y otro ninguno:
 *     0 Honesty      → INT              4 Sacrifice → STR+DEX
 *     1 Compassion   → DEX              5 Honor     → STR+INT
 *     2 Valor        → STR              6 Spirituality → STR+DEX+INT (los tres)
 *     3 Justice      → DEX+INT          7 Humility  → NINGUNO
 * Es la composición clásica de las virtudes sobre los tres principios (Verdad=INT,
 * Amor=DEX, Valor=STR), y sale de los DATOS, no de la lore. Humildad no sube atributo
 * pero cobra karma DOBLE (0x0cff `cmp [bp-8],7` → segundo `+3`), que es justo la rama
 * que `shrineCompleteQuest` tiene abajo.
 * Los rótulos también son verbatim: DS 0x95B8/0x95C6/0x95D4 (→ fileoff +0x10) son
 * `"Strength +1\n"`, `"Dexterity +1\n"`, `"Intelligence +1\n"`, y el `\n` va DENTRO.
 * El tope 0x1E lo escriben los tres `mov byte [g_party_records+N],0x1e` (0x0cb1/0x0cd2/
 * 0x0cf3), y el sujeto es el AVATAR: los tres destinos son `g_party_records+12/13/14`
 * SIN índice, o sea el registro 0 (+12 STR, +13 DEX, +14 INT en el roster de 32 B).
 * 🔴 Y el handler del CÓDICE (CAST2 0x0d24-0x0e76) NO toca atributos ni karma — censado
 * con control positivo (mismo predicado sobre `shrine_visit` da 18 aciertos, sobre el
 * handler del Códice da 0). Quien busque el «+1» del Códice no lo encontrará: el premio
 * es del SANTUARIO al entregar la misión, y el Códice sólo enseña la página.
 */
export const SHRINE_STR_FLAG: readonly number[] = [0, 0, 1, 0, 1, 1, 1, 0];
export const SHRINE_DEX_FLAG: readonly number[] = [0, 1, 0, 1, 1, 0, 1, 0];
export const SHRINE_INT_FLAG: readonly number[] = [1, 0, 0, 1, 0, 1, 1, 0];

/** Virtud especial de Espiritualidad (coord centinela 0,0 → Codex/Underworld). */
const SPIRITUALITY = 6;
/** Humildad da +3 karma EXTRA al completar su quest (CAST2 0x0cff). */
export const HUMILITY = 7;
/** Todas las 8 lecciones del Codex aprendidas → ceremonia final (CAST2 0x0da2). */
const ALL_VIRTUES_VISITED = 0xff;

/** Tile de santuario que se repinta al restaurar uno destruido (CMDS 0x12a2). */
export const SHRINE_TILE = 0x19;
/** Tile Codex (CAST2 0x0e76: si el tile bajo el party es 0x11 → peregrinaje al Codex). */
export const CODEX_TILE = 0x11;
/** Tile de un santuario DESTRUIDO por un Shadowlord (se repinta a SHRINE_TILE al restaurar). */
export const BROKEN_SHRINE_TILE = 0x1a;

/** Datos de santuario extraídos de DATA.OVL (data.json). */
export interface ShrineData {
  /** Nombres de virtud, índice 0..7 (DATA.OVL 0x0B98). */
  virtues: string[];
  /** Mantras, índice 0..7 (DATA.OVL 0x0BE0). */
  mantras: string[];
  /** X overworld de cada santuario (DATA.OVL 0x1F7E). */
  shrineX: number[];
  /** Y overworld de cada santuario (DATA.OVL 0x1F86). */
  shrineY: number[];
}

const clampKarma = (k: number): number => (k > KARMA_MAX ? KARMA_MAX : k);

/** ¿La quest del santuario `v` está activa? (bit v de g_shrine_quest_bitmap). */
function shrineQuestActive(state: GameState, v: number): boolean {
  return ((state.shrineQuestBitmap ?? 0) & (1 << v)) !== 0;
}

/**
 * ¿El Codex ya enseñó la lección de la virtud `v`? (bit v de
 * g_shrine_visited_bitmap). OJO: NO es "he pisado el santuario" — el único
 * escritor de 0x58CE es el Shrine of the Codex (CAST2 0x0d7d), no shrine_visit.
 */
export function shrineCodexLearned(state: GameState, v: number): boolean {
  return ((state.shrineVisitedBitmap ?? 0) & (1 << v)) !== 0;
}

/** ¿El santuario `v` está destruido por un Shadowlord? (bit alto de g_shrine_destroyed[v]). */
export function shrineDestroyed(state: GameState, v: number): boolean {
  return (((state.shrineDestroyed ?? [])[v] ?? 0) & 0x80) !== 0;
}

/** Modo de interacción de `shrine_visit` según los bitmaps (CAST2 0x0a74-0x0b18). */
export type ShrineMode = "show-mantra" | "quest-complete" | "donation";

/**
 * Decide el modo de una visita a un santuario VIVO, ANTES de mutar nada.
 * El binario ramifica PRIMERO por el bit del Codex (0x0a74 test g_shrine_visited)
 * y sólo después por la quest (0x0b10 test g_shrine_quest):
 *  - Codex NO aprendido           → "show-mantra"  (muestra mantra + fija la quest)
 *  - Codex aprendido + quest activa → "quest-complete"
 *  - Codex aprendido + sin quest    → "donation"
 * El flujo real es: santuario (fija quest) → peregrinaje al Codex (fija visited)
 * → volver al santuario (completa la quest, recompensa).
 */
export function shrineMode(state: GameState, v: number): ShrineMode {
  if (!shrineCodexLearned(state, v)) return "show-mantra";
  return shrineQuestActive(state, v) ? "quest-complete" : "donation";
}

/**
 * Visita a un santuario cuya lección aún no enseñó el Codex (CAST2 0x0a81):
 * fija (idempotente) el bit de quest y devuelve el texto que imprime el original
 * (virtud + mantra). **NO toca el bit del Codex** (0x58CE) — eso lo hace sólo el
 * Shrine of the Codex. La descripción de la quest se gestiona fuera (DATA.OVL).
 */
export function shrineShowMantra(
  state: GameState,
  v: number,
  data: ShrineData,
): { virtue: string; mantra: string } {
  state.shrineQuestBitmap = (state.shrineQuestBitmap ?? 0) | (1 << v);
  return { virtue: data.virtues[v] ?? "", mantra: data.mantras[v] ?? "" };
}

/**
 * Comparador del interrogatorio (CAST2 0x09e3/0x0a43 → thunk 0xffff8d3e = kernel
 * **0x6f1e**, F2-T5): búsqueda de SUBSTRING **case-insensitive** — needle = la
 * palabra canónica (tabla 0x4b3e virtudes / 0x1f5e mantras), haystack = lo
 * TECLEADO (buffer 0xbd08). El kernel upcasea AMBOS lados al vuelo (0x6f5f-0x6f6b
 * `cmp 0x60; jle` + `and 0x5f`, tras `and ax,0x7f7f`) y devuelve la posición o
 * -1; needle más largo que el input → -1 (0x6f3b). ⇒ «COMPASSION» (el LP) y
 * «xxCompassionyy» PASAN; «Comp» falla. NO es igualdad exacta (el `===` previo
 * era divergencia — espejo S4).
 */
function shrineWordMatches(canonical: string, typed: string): boolean {
  if (canonical.length === 0) return false;
  return typed.toUpperCase().includes(canonical.toUpperCase()); // kernel 0x6f1e
}

/**
 * Gate del INTERROGATORIO de la visita a santuario (T-003 corpus, re-derivado de CAST2
 * shrine_visit 0x0966): virtud TECLEADA (getstring 0xbd08, compare 0xffff8d3e contra la
 * tabla 0x4b3e[v], 0x09d6) Y mantra ×3 (bucle 0x0a0c, compare contra mantra[v] 0x1f5e).
 * Un solo fallo → «Thine thoughts are unfocused.» (0x0a5e→print 0xb5de). Comparación
 * = kernel 0x6f1e (substring case-insensitive, `shrineWordMatches` — F2-T5; coherente
 * con `mantraMatches` de blackthorn.ts, kernel gemelo 0x216c/0x2032). NO muta estado —
 * el bit de quest lo pone shrineShowMantra en la rama ordained (0x0a81/0x0a88), que el
 * caller invoca SOLO tras pasar este gate con visited-bit clear.
 */
export function shrineVisitCheck(
  v: number,
  typedVirtue: string,
  typedMantras: string[],
  data: ShrineData,
): boolean {
  const virtueOk = shrineWordMatches(data.virtues[v] ?? "", typedVirtue);
  const mantraOk =
    typedMantras.length === 3 &&
    typedMantras.every((m) => shrineWordMatches(data.mantras[v] ?? "", m));
  return virtueOk && mantraOk;
}

/**
 * Peregrinaje al Shrine of the Codex (CAST2 0x0d24, despachado desde 0x0e76
 * cuando el tile pisado es 0x11). Busca la virtud de índice MÁS BAJO con quest
 * activa (0x0d47-0x0d58), marca su bit del Codex (0x0d7d `or [0x58CE]`) y devuelve
 * qué lección se enseñó. Si las 8 lecciones quedan aprendidas (0x58CE==0xFF,
 * gate 0x0da2) señala la ceremonia final de las 8 virtudes. Si no hay ninguna
 * quest activa devuelve virtue=null (0x0d64, sin efecto). Sin RNG.
 */
export function shrineCodexLesson(state: GameState): { virtue: number | null; ceremony: boolean } {
  const quest = state.shrineQuestBitmap ?? 0;
  let v = -1;
  for (let i = 0; i < SHRINE_COUNT; i++) {
    if (quest & (1 << i)) {
      v = i;
      break;
    }
  }
  if (v < 0) return { virtue: null, ceremony: false };
  state.shrineVisitedBitmap = (state.shrineVisitedBitmap ?? 0) | (1 << v);
  const ceremony = (state.shrineVisitedBitmap & 0xff) === ALL_VIRTUES_VISITED;
  return { virtue: v, ceremony };
}

/**
 * Donación al santuario (CAST2 0x0b1d): `cycles` es un dígito 0..9 tecleado.
 *  - n==0 → NO-OP (0x0b2d: `sub si,0x30`/`jne` → sale sin donar, `jmp 0xd1d`).
 *    ⚠ ESTO DESCRIBE EL ORIGINAL, NO ESTA FUNCIÓN. Aquí `n <= 0` devuelve
 *    `{accepted:false, cost:0}` sin emitir texto; quien emite es el ceremonial, que saca
 *    "0 gp" con el cero delante (shrine-ceremonies.ts, la rama de dígito '0').
 *    🔴 REFUTADO 2026-08-07: aquí se leía «imprime " gp"», o sea que al original le
 *    faltaría el número. Cae al leer el cuerpo entero de `shrine_visit` (CAST2.OVL:2406).
 *    El eco del dígito sale ANTES de la bifurcación (`0x0b26 push si; call putchar`), así
 *    que la pantalla del original saca "0 gp" y NO le falta número: se había leído la
 *    cadena DS 0x959c (= " gp\n") aislada de su contexto de emisión. El defecto REAL es
 *    otro y es peor — la rama del cero termina la visita sin donar, sin karma y sin
 *    re-preguntar, mientras la de «no te llega el oro» sí re-pregunta en bucle. Registro
 *    §1.8, los dos espejos.
 *    Se anota porque este comentario llegó a citarse como prueba de que el port
 *    calcaba el bug — describía la conducta AJENA y callaba la propia. Registro §1.8.
 *  - 100·n > oro → "not enough" (0x0b52), no cobra ni sube karma (el original
 *    re-pregunta en bucle; el re-prompt lo cablea game.submitDonation en F1.3,
 *    y el TRIGGER de meditación que lo dispara va a F1.4).
 *  - si no → cobra 100·n y da +n karma (clamp 99).
 * Devuelve si la donación se aplicó.
 */
export function shrineDonate(
  state: GameState,
  cycles: number,
): { accepted: boolean; cost: number } {
  const n = cycles | 0;
  if (n <= 0) return { accepted: false, cost: 0 };
  const cost = 100 * n;
  if (cost > state.gold) return { accepted: false, cost };
  state.gold -= cost;
  state.karma = clampKarma(state.karma + n);
  return { accepted: true, cost };
}

/**
 * Completar la quest de un santuario vivo (CAST2 0x0c18): desactiva la quest,
 * +3 karma (+3 extra si es Humildad) y sube 1 el atributo del Avatar que marque
 * la bandera del santuario (STR/DEX/INT, cap 30). Devuelve los atributos subidos.
 */
export function shrineCompleteQuest(
  state: GameState,
  v: number,
  avatar: CharacterState,
): { attrs: ("strength" | "dexterity" | "intelligence")[] } {
  state.shrineQuestBitmap = (state.shrineQuestBitmap ?? 0) & ~(1 << v);
  state.karma = clampKarma(state.karma + 3);
  const attrs: ("strength" | "dexterity" | "intelligence")[] = [];
  if (SHRINE_STR_FLAG[v]) {
    avatar.strength = Math.min(ATTR_MAX, avatar.strength + 1);
    attrs.push("strength");
  }
  if (SHRINE_DEX_FLAG[v]) {
    avatar.dexterity = Math.min(ATTR_MAX, avatar.dexterity + 1);
    attrs.push("dexterity");
  }
  if (SHRINE_INT_FLAG[v]) {
    avatar.intelligence = Math.min(ATTR_MAX, avatar.intelligence + 1);
    attrs.push("intelligence");
  }
  if (v === HUMILITY) state.karma = clampKarma(state.karma + 3);
  return { attrs };
}

/**
 * Restaurar un santuario destruido (CMDS.OVL 0x1202 `shrine_restore`). Requiere,
 * TODO simultáneamente:
 *   - la virtud tecleada == data.virtues[v]  (strcmp 0xaf9e; si distingue
 *     mayúsculas es pregunta abierta de oráculo — el clon compara exacto),
 *   - el mantra tecleado (×3) == data.mantras[v] en las 3 veces,
 *   - estar en la casilla exacta del santuario v (shrineX[v]==x && shrineY[v]==y).
 * Si acierta, limpia el bit alto de g_shrine_destroyed[v] y devuelve el tile a
 * repintar (0x19). Un solo fallo → sin efecto.
 */
export function shrineRestore(
  state: GameState,
  v: number,
  typedVirtue: string,
  typedMantras: string[],
  x: number,
  y: number,
  data: ShrineData,
): { restored: boolean; tile?: number } {
  const virtueOk = typedVirtue === data.virtues[v];
  const mantraOk = typedMantras.length === 3 && typedMantras.every((m) => m === data.mantras[v]);
  const coordOk = data.shrineX[v] === x && data.shrineY[v] === y;
  if (!(virtueOk && mantraOk && coordOk)) return { restored: false };
  const arr = (state.shrineDestroyed ??= []);
  arr[v] = (arr[v] ?? 0) & 0x7f;
  return { restored: true, tile: SHRINE_TILE };
}

/**
 * Índice de virtud (0..7) del santuario cuya coord overworld coincide con (x,y), o -1.
 * El binario empareja el party contra las 8 coords (CAST2 0x0966); el sentinel de
 * Spirituality (0,0) nunca casa en juego (su casilla es agua, no santuario). Sin RNG.
 */
export function shrineIndexAt(data: ShrineData, x: number, y: number): number {
  for (let v = 0; v < SHRINE_COUNT; v++) {
    if (data.shrineX[v] === x && data.shrineY[v] === y) return v;
  }
  return -1;
}
