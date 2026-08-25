/**
 * Lector de PERGAMINOS (8 scrolls) — MODELO PURO del `cmd_use_item` → scroll reader
 * (CAST.OVL 0x11de). Legibles por CUALQUIERA: sin gate de maná/reagente/nivel/clase.
 * Deriva mapping scroll→efecto, magnitudes, consumo y ecos EXACTOS de DATA.OVL. Cada
 * regla cita su offset en `re/notes/potions-scrolls.md` (jump-table @file 0x1340).
 *
 * OJO magnitudes: el scroll NO es "castear sin maná" — usa las MISMAS globales que el
 * Cast pero con valores DISTINTOS (luz 240 vs 255, protección 100 turnos vs 20, negate
 * 20 vs 10, time-stop 20 vs 10). Los efectos GLOBALES se aplican aquí sobre `state`;
 * los interactivos (Rel Hur dirección, In Mani Corp resurrección) y los cosméticos
 * (In Quas Wis reveal) los resuelve el llamador vía `followup`.
 *
 * Reparto: el consumo del scroll (0x11ec, ANTES de todo) lo hace el llamador (main.ts),
 * como el original. Vía (U)se el juego nunca está en combate (loc<=0x7f), así que
 * Kal Xen Corp (summon, sólo combate) SIEMPRE da "Not here!" y no requiere el summon.
 */
import type { GameState } from "./state.js";
import { WIND_CALM, WIND_NORTH, WIND_SOUTH, WIND_EAST, WIND_WEST } from "./world/wind.js";
import type { Direction } from "./world/movement.js";

/** Etiquetas del picker (== `ui/ztats.ts` SCROLL_NAMES). Orden = índice de scroll 0-7. */
export const SCROLL_NAMES = [
  "Vas Lor", "Rel Hur", "In Sanct", "In An", "In Quas Wis", "Kal Xen", "In Mani Corp", "An Tym",
] as const;

/** Seguimiento interactivo/cosmético que el llamador resuelve tras el eco. */
export type ScrollFollowup =
  | { kind: "none" }
  | { kind: "windDir" } // Rel Hur: getdir → set_wind si overworld (loc<0x21)
  | { kind: "resurrect" } // In Mani Corp: pickMember + applyResurrect
  | { kind: "reveal" } // In Quas Wis: reveal de mapa (cosmético, Clase-C)
  | { kind: "summonDaemon" }; // Kal Xen Corp: summon en combate (inalcanzable vía (U)se)

export interface ScrollResult {
  /** Líneas de eco a imprimir tras "Scroll\n\n", en orden. */
  messages: string[];
  followup: ScrollFollowup;
}

/** Dirección → código de viento (wind.ts: 0=Calm,1=N,2=S,3=E,4=W). */
export function windForDirection(dir: Direction): number {
  switch (dir) {
    case "north": return WIND_NORTH;
    case "south": return WIND_SOUTH;
    case "east": return WIND_EAST;
    case "west": return WIND_WEST;
    default: return WIND_CALM;
  }
}

/**
 * Lee el pergamino `idx` (0-7) en la ubicación `location`, aplicando los efectos
 * GLOBALES sobre `state`. Devuelve las líneas de eco y el `followup` interactivo.
 * Jump-table CAST.OVL 0x1205 (verificada @file 0x1340). NO consume (lo hace el caller).
 */
export function readScroll(state: GameState, idx: number, location: number): ScrollResult {
  const messages: string[] = [];
  switch (idx) {
    case 0: // Vas Lor — luz 240 (0xF0), MÁS que el Cast (255). CAST2 0x08ea.
      state.lightSpellMins = 0xf0;
      messages.push("Light!"); // DS 0x4673
      return { messages, followup: { kind: "none" } };
    case 1: // Rel Hur — getdir → viento (sólo overworld). CAST2 0x0306/0x040a.
      messages.push("Wind change!"); // DS 0x467b
      return { messages, followup: { kind: "windDir" } };
    case 2: // In Sanct — protección 'P' 100 turnos (Cast: 20). CAST2 0x08f8.
      state.timeSpell = "P";
      state.timeSpellTurns = 0x64;
      messages.push("Protection!"); // DS 0x4689
      return { messages, followup: { kind: "none" } };
    case 3: // In An — negate magic 'N' 20 turnos (Cast: 10).
      state.timeSpell = "N";
      state.timeSpellTurns = 0x14;
      messages.push("Negate magic!"); // DS 0x4696
      return { messages, followup: { kind: "none" } };
    case 4: // In Quas Wis — "View!" siempre; combate → "Not here!"; si no, reveal.
      messages.push("View!"); // DS 0x46a5
      if (location > 0x7f) {
        messages.push("Not here!"); // DS 0x46ac
        return { messages, followup: { kind: "none" } };
      }
      return { messages, followup: { kind: "reveal" } };
    case 5: // Kal Xen Corp — SÓLO combate; fuera → "Not here!" (siempre vía (U)se).
      messages.push("Summon Daemon!"); // DS 0x46b7
      if (location <= 0x7f) {
        messages.push("Not here!"); // DS 0x46c7
        return { messages, followup: { kind: "none" } };
      }
      return { messages, followup: { kind: "summonDaemon" } };
    case 6: // In Mani Corp — resurrección; en combate → "Not here!".
      messages.push("Resurrection!"); // DS 0x46d2
      if (location >= 0x80) {
        messages.push("Not here!"); // DS 0x46e1
        return { messages, followup: { kind: "none" } };
      }
      return { messages, followup: { kind: "resurrect" } };
    case 7: // An Tym — time-stop 'T' 20 turnos (Cast: 10); loc 0x1d/0x28 → "No effect!".
      if (location === 0x1d || location === 0x28) {
        messages.push("No effect!"); // DS 0x46ec
        return { messages, followup: { kind: "none" } };
      }
      state.timeSpell = "T";
      state.timeSpellTurns = 0x14;
      messages.push("Negate time!"); // DS 0x46f8
      return { messages, followup: { kind: "none" } };
    default:
      return { messages, followup: { kind: "none" } };
  }
}
