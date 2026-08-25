/**
 * DRIVER del picker de miembro fiel `select_party_member` (kernel 0x2d7a) para los
 * comandos que eligen un PJ del party (Ready, Cast, Swap, Heal/Cure/Awaken…). Conduce
 * la máquina pura `selectPartyMember` contra sinks del entorno (consola, cursor del
 * roster, prompt de teclas). Extraído de `main.ts` para hacerlo TESTEABLE sin DOM —
 * gemelo de `campPromptDriver` (el guardia del Camp comparte la MISMA primitiva 0x2d7a).
 *
 * El marcador es el CANDIDATO en VÍDEO INVERSO + la flecha `→` en el activo (dictamen
 * del vídeo del camp); la piel lo pinta leyendo `selectCursor` del snapshot. Sustituye
 * al popup DOM: el original elige sobre el ROSTER, no abre lista aparte.
 *
 * Teclas (vía `selectPartyMemberKey`): flechas mueven el cursor (wrap), 1-N eligen
 * directo, Enter/Space/0 confirman el cursor, ESC cancela (sin selección). NO valida el
 * miembro — eso es del caller (p.ej. Ready puede exigir vivo).
 */
import { selectPartyMemberKey } from "./selectPartyMember.js";

/** Prompt de teclas que el picker arma (subconjunto del `pendingPrompt` de main). */
export interface PartySelectPrompt {
  type: "party-select";
  onKey: (key: string) => void;
}

/** Sinks del entorno (main.ts los cablea a hud/view/pendingPrompt/game). */
export interface PartyMemberPickerDeps {
  /** Imprime el título del prompt en la consola (main: `hud.message`). */
  print(text: string): void;
  /** Publica el cursor del roster (o `null` al cerrar) — la piel lo pinta en inverso. */
  setSelectCursor(idx: number | null): void;
  /** Arma (o limpia con `null`) el prompt de teclas activo (main: asigna `pendingPrompt`). */
  setPrompt(prompt: PartySelectPrompt | null): void;
  /** `g_party_size` vivo — acota cursor/selección. */
  partySize(): number;
  /** Miembro confirmado (índice 0-based en el party = índice de personaje). */
  onSelect(index: number): void;
  /** ESC → cancelado sin selección (opcional). */
  onCancel?(): void;
}

/**
 * Arranca el picker: imprime el título, coloca el cursor en el 1er miembro y arma las
 * teclas. Cada movimiento re-arma (repinta la fila inversa); elegir/cancelar cierra
 * (limpia cursor + prompt) y notifica al caller. AUTORITATIVO sobre el prompt+cursor
 * mientras está abierto.
 */
export function startPartyMemberPicker(
  title: string,
  deps: PartyMemberPickerDeps,
): void {
  // Título VACÍO = sin línea de prompt impresa (sólo la banda ►Select:◄ del roster). El
  // binario NO imprime prompt para el target-select del Cast (heal/cure/…, un cursor de
  // roster sin texto — lote cast-echo); los callers con prompt real (Ztats/Ready) lo pasan.
  if (title) deps.print(title);
  let cursor = 0;
  const close = (): void => {
    deps.setSelectCursor(null);
    deps.setPrompt(null);
  };
  const arm = (): void => {
    deps.setSelectCursor(cursor);
    deps.setPrompt({
      type: "party-select",
      onKey: (key) => {
        const res = selectPartyMemberKey({ cursor }, key, deps.partySize());
        if (res.kind === "move") {
          cursor = res.cursor;
          arm();
        } else if (res.kind === "select") {
          close();
          deps.onSelect(res.index);
        } else if (res.kind === "close") {
          close();
          deps.onCancel?.();
        }
        // ignore → sigue armado (getkey re-lee)
      },
    });
  };
  arm();
}
