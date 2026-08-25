/**
 * `select_party_member` — picker interactivo de miembro del party (kernel 0x2d7a,
 * `re/notes/kernel-sweep-3.md §8.1`). COMPARTIDO en el binario por Ztats/Ready/Give y
 * el guardia del Camp (0x2e8e→0x2d7a). Componente PURO y REUSABLE: modela sólo el
 * CURSOR y la lógica de teclas; el marcador visual (el CANDIDATO en VÍDEO INVERSO
 * —negativo—, más la flecha `→` que se queda en el ACTIVO) lo pinta la piel leyendo
 * `selectCursor` del snapshot. CORREGIDO por el vídeo del camp (CAMP.mov): el inverso
 * NO es combat-exclusive, es el marcador del picker; el `01-select-player.png` de Ztats
 * mostraba la → del activo, no el cursor. La piel ya lo pinta (skin.ts / roster.ts).
 *
 * Teclas (get_extended_key 0x266c; códigos de flecha 1-4 = Izq/Dcha/Arr/Abj,
 * `command-dispatch.md`):
 *  - flechas (Izq/Arr = prev `0x3f54`, Dcha/Abj = next `0x3f14`) → MUEVE el cursor (wrap).
 *  - '1'..'N' (N = `partySize`) → selección DIRECTA de ese miembro (acotado por party).
 *  - Enter (0x0d) / Space (0x20) → confirma el cursor actual (`0x2e58`/`0x2e62`).
 *  - ESC (0x1b) → cancela, `[bp-2] = 0xffff` = -1 (`0x2e5d`->`0x2e50`).
 *  - * '0' (0x30) NO es un confirmar (#280). `0x2e67 cmp ax,0x30 / je 0x2e3e`, y allí
 *    `0x2e3e cmp word ptr [bp+4],0 / je 0x2e19`: con el PRIMER ARGUMENTO a cero la tecla
 *    se IGNORA, y sólo si el llamador la habilita devuelve `[bp-2] = 0xfffe` = **-2**, un
 *    tercer código de salida distinto de -1, nunca «el cursor actual». Los DOS consumidores
 *    de este módulo (`campPrompt`, `ui/pickers`) entran por `select_party_member_default`
 *    (CS `0x2e8e`: `sub ax,ax / push ax / call 0x2d7a`) => argumento CERO => **ignorar** es
 *    lo fiel. (El otro llamador del binario, `ZSTATS.OVL:0x0000`, REENVÍA su propio
 *    argumento -`0x0035 push word ptr [bp+4]`-; qué vale ahí y qué significa el -2 para él
 *    NO está derivado, y la piel `skin/fiel/ztats.ts` tiene su propia copia del set, así
 *    que este módulo no la gobierna.)
 *  - teclas > '7' (0x37) -> descartadas por el filtro de cabeza `0x2dcf`, sin llegar al
 *    resto de comparaciones.
 *  - resto → ignora (getkey re-lee).
 *
 * NO valida el miembro (p.ej. status 'G' para guardia): eso es del CALLER — el picker
 * sólo devuelve el índice elegido (0-based) o cancela. El camp lo interpreta luego
 * (miembro no válido o cancelar → "None posted!", 0x3ecd).
 */

export interface SelectPartyMemberState {
  /** Índice (0-based) del miembro bajo el cursor (con la flecha `→`). */
  cursor: number;
}

export type SelectPartyMemberResult =
  | { kind: "move"; cursor: number } // el cursor se movió; sigue el picker abierto
  | { kind: "select"; index: number } // miembro confirmado (0-based)
  | { kind: "close" } // ESC → -1
  | { kind: "ignore" }; // tecla no reconocida (re-lee)

const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp", "Left", "Up"]);
const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", "Right", "Down"]);
const CONFIRM_KEYS = new Set(["Enter", " ", "Spacebar"]); // sin '0': ver cabecera (#280)

/** Cursor inicial del picker (0 = primer miembro, como el binario). */
export function selectPartyMemberStart(cursor = 0): SelectPartyMemberState {
  return { cursor };
}

/**
 * Procesa una tecla cruda (`event.key`). `partySize` acota el rango. Devuelve el
 * efecto; en "move" el caller actualiza el estado y sigue esperando; en "select"/"close"
 * el picker se cierra.
 */
export function selectPartyMemberKey(
  state: SelectPartyMemberState,
  key: string,
  partySize: number,
): SelectPartyMemberResult {
  if (partySize <= 0) return { kind: "ignore" };
  if (PREV_KEYS.has(key)) {
    return { kind: "move", cursor: (state.cursor + partySize - 1) % partySize };
  }
  if (NEXT_KEYS.has(key)) {
    return { kind: "move", cursor: (state.cursor + 1) % partySize };
  }
  if (/^[1-9]$/.test(key)) {
    const idx = Number(key) - 1; // '1'..'N' → 0..N-1
    return idx < partySize ? { kind: "select", index: idx } : { kind: "ignore" };
  }
  if (CONFIRM_KEYS.has(key)) return { kind: "select", index: state.cursor };
  if (key === "Escape") return { kind: "close" };
  return { kind: "ignore" };
}
