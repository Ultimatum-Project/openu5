/**
 * #329 — El gate del CURSOR: las esperas de tecla del rito NO son modales.
 *
 * REPORTE DEL USUARIO (jugando el deploy #34): durante el rito el juego se queda quieto
 * pidiendo una tecla y el cursor está APAGADO, así que parece colgado.
 *
 * DERIVACIÓN (CAST2.OVL + kernel, disasm en re/disasm/):
 *  · Las once esperas del rito (#294) llaman `getkey_with_redraw`. El destino se resuelve
 *    con la regla de banda —NO leyendo `0x448c` crudo en ULTIMA.EXE.asm, que aterriza en
 *    una rutina ajena con cuerpo plausible—: CAST2 va en la banda 4, base 0xE1E0, luego
 *    `(0x448c + 0xE1E0) mod 0x10000` = `ULTIMA.EXE:0x266c`. Coincide con la resolución ya
 *    sellada en re/notes/agregado-23-acta.md:198.
 *  · `0x266c` NO es un bloqueo mudo: es un BUCLE DE SONDEO. Por iteración sin tecla salta
 *    al redibujo (`0x269a call 0x5910`), y `0x267a` arma `[0x5891]=0xFF` cuando
 *    `g_unk_52c8==2`. En 1988 la pantalla SIGUE ANIMADA mientras espera.
 *  ⇒ El motor está esperando una tecla DEL JUGADOR, que es exactamente lo que el cursor
 *    significa. Apagarlo es lo que fabrica la apariencia de cuelgue.
 *
 * Este fichero prueba el predicado, no el cableado: `refreshAwaiting` vive dentro de
 * `boot()` (main.ts), que no se exporta — de ahí la extracción a `ui/awaiting-gate.ts`.
 */
import { describe, expect, it } from "vitest";
import {
  type AwaitingGateFlags,
  isModalOpen,
  PROMPT_TYPES_CURSOR_ON_LIVE_ROW,
  promptCursorOnLiveRow,
} from "../src/ui/awaiting-gate.js";
import type { PendingPrompt } from "../src/ui/prompt-manager.js";

/** Todas las banderas en reposo: nada abierto, nada paceado. */
function idle(): AwaitingGateFlags {
  return {
    promptOpen: false,
    talkActive: false,
    shopOpen: false,
    camping: false,
    sleeping: false,
    refuging: false,
    endgamePacing: false,
    trollSneaking: false,
    shrineScenePacing: false,
    blackthornScenePacing: false,
    shrineKeyWaiting: false,
    combatPacing: false,
    selectorVisible: false,
  };
}

/**
 * Los doce estados que SÍ apagan el cursor, EN CRUDO (no derivados del sujeto: si alguien
 * borra una rama del OR, esta lista sigue exigiéndola; #324 añadió `blackthornScenePacing`).
 * `shrineKeyWaiting` no está aquí a propósito — es el sujeto de #329 y tiene su propio
 * bloque abajo.
 */
const MODAL_FLAGS = [
  "promptOpen",
  "talkActive",
  "shopOpen",
  "camping",
  "sleeping",
  "refuging",
  "endgamePacing",
  "trollSneaking",
  "shrineScenePacing",
  "blackthornScenePacing", // #324: segmento de la escena de la captura (avanza solo)
  "combatPacing",
  "selectorVisible",
] as const satisfies readonly (keyof AwaitingGateFlags)[];

describe("#329 — gate del cursor de consola", () => {
  it("en reposo no hay modal: el cursor queda encendido", () => {
    expect(isModalOpen(idle())).toBe(false);
  });

  // El NEGATIVO que pide la ficha: el fix de #329 no puede haber apagado la regla general.
  // Uno a uno, porque un `some()` sobre el conjunto pasaría con once de las doce ramas.
  for (const flag of MODAL_FLAGS) {
    it(`\`${flag}\` sola sigue APAGANDO el cursor`, () => {
      expect(isModalOpen({ ...idle(), [flag]: true })).toBe(true);
    });
  }

  it("la espera de tecla del rito NO es modal: el cursor sigue encendido (#329)", () => {
    expect(isModalOpen({ ...idle(), shrineKeyWaiting: true })).toBe(false);
  });

  it("un modal REAL simultáneo manda: el rito no puede abrir fila ► bajo un prompt", () => {
    // Durante el rito hay prompts encadenados (#302). Mientras uno esté abierto no se
    // abre la fila ► de comando nuevo. ~~«él gestiona el input y el cursor de consola
    // debe seguir apagado»~~ — TACHADO (cabo #341 §7.2): el binario SÍ parpadea el
    // cursor durante el prompt (0x1b38 dentro del getkey 0x266c; testigo Fenton
    // lf29/lf30/lf31), pero lo hace en la FILA VIVA del prompt, no en una fila ►
    // nueva — ese cursor va por `promptCursorOnLiveRow` (bloque de abajo). Lo que este
    // aserto guarda es la fila ►, y sigue siendo correcto.
    expect(isModalOpen({ ...idle(), shrineKeyWaiting: true, promptOpen: true })).toBe(true);
  });

  it("`endgamePacing` NO se armoniza con el rito por simetría", () => {
    // Guarda contra un futuro «igualemos los dos pacers»: el desenlace espera con OTRA
    // rutina (`getkey 0x83dc`, sin cuerpo derivado) y alterna con fases por temporizador
    // donde no se espera nada del jugador. Los dos juntos siguen dando modal.
    expect(isModalOpen({ ...idle(), endgamePacing: true, shrineKeyWaiting: true })).toBe(true);
  });

  it("las trece banderas están PARTIDAS: doce modales y exactamente una que no lo es", () => {
    // 🔴 Este aserto nació VACUO y lo cazó el mutante: contaba `Object.keys(idle())`
    // contra 12, o sea su propio fixture contra sí mismo — añadir una bandera a la
    // interfaz lo dejaba en VERDE. Quien caza esa mutación es `tsc` (medido: rompe en
    // main.ts:1702 y en el `idle()` de aquí, TS2345 + TS2741), y la batería lo corre.
    // Lo que este aserto aporta es lo que tsc NO mira: que cada bandera del fixture esté
    // CLASIFICADA. Una bandera nueva compila en cuanto la añades a los dos sitios, y a
    // partir de ahí cae aquí hasta que declares de qué lado del gate está.
    const flags = Object.keys(idle());
    const sinClasificar = flags.filter(
      (f) => !MODAL_FLAGS.includes(f as (typeof MODAL_FLAGS)[number]) && f !== "shrineKeyWaiting",
    );
    expect(sinClasificar).toEqual([]);
    // #324 añadió `blackthornScenePacing` (modal): 13 banderas, 12 modales + 1 espera.
    expect(flags.length).toBe(13);
    expect(MODAL_FLAGS.length).toBe(12);
  });
});

/**
 * Cabo #341 §7.2 (carril cursor-getkey) — el cursor ANIMADO de la fila viva del prompt.
 *
 * DERIVACIÓN (re/notes/getkey-cursor-derivacion.md): el bucle del getkey del kernel
 * (`ULTIMA.EXE:0x266c`) llama a `poll_key_blink_cursor` (`0x267f call 0x1b38`) en CADA
 * iteración: putchar de `[0x5390]+[0x540c]` en la posición de texto actual, borrado con
 * espacio al llegar la tecla. El cursor es del BUCLE DE ESPERA, no del print del prompt
 * ⇒ los 100 call-sites de 0x266c parpadean todos. TESTIGO (Lord Fenton, animación
 * verificada por diff de fotogramas): lf29@1656 «:▓» (rúnico), lf30@374 «To phase: ▓»
 * (getkey), lf31@1253 «Player: ▓» (party-select).
 */
describe("cabo #341 §7.2 — cursor en la fila viva de TODO prompt de consola", () => {
  // El esperado EN CRUDO (no derivado del sujeto): la población que espera por 0x266c
  // en la consola. Si alguien poda un tipo del set del gate, este aserto enrojece.
  const ESPERADOS = [
    "yesno-esc",
    "yesno",
    "digit",
    "party-select",
    "text",
    "number",
    "rune",
    "getkey",
    "shop",
  ] as const;

  it("la población del cursor es EXACTAMENTE la clase que espera por 0x266c", () => {
    expect([...PROMPT_TYPES_CURSOR_ON_LIVE_ROW]).toEqual([...ESPERADOS]);
  });

  for (const t of ESPERADOS) {
    it(`\`${t}\` mantiene el cursor en la fila viva`, () => {
      expect(promptCursorOnLiveRow(t)).toBe(true);
    });
  }

  it("`ready-picker` queda FUERA: su ola ya la pinta la rama readyPicker de showWave", () => {
    // (fiel/skin.ts) — incluirlo aquí no cambiaría nada visible y firmaría una
    // derivación de item_page_controller (0x0f2e) que no se hizo.
    expect(promptCursorOnLiveRow("ready-picker")).toBe(false);
  });

  it("sin prompt (null) el cursor lo gobierna isModalOpen, no este canal", () => {
    expect(promptCursorOnLiveRow(null)).toBe(false);
  });

  it("todo tipo de PendingPrompt está CLASIFICADO (cursor sí / exclusión documentada)", () => {
    // Guarda de exhaustividad en DOS capas. La de tipos: si `PendingPrompt` gana un
    // tipo nuevo, `Faltan` deja de ser `never` y tsc rompe AQUÍ hasta que se clasifique
    // (la batería corre tsc). La de runtime: la partición suma exacta.
    type Clasificados = (typeof ESPERADOS)[number] | "ready-picker";
    type Faltan = Exclude<PendingPrompt["type"], Clasificados>;
    const _exhaustivo: Faltan extends never ? true : never = true;
    void _exhaustivo;
    expect(ESPERADOS.length).toBe(9); // 9 con cursor + 1 exclusión = los 10 tipos
  });
});
