/**
 * Luz en la vista 3D de mazmorra. Deriva EXACTA de DUNGEON.OVL (render
 * `dng_render_corridor` 0x1A90 + el raycast 0x1B0C). Cita en `re/notes/dungeon.md
 * §3` y el gate/loop verificados en `re/disasm/DUNGEON.OVL.asm`.
 */
import type { GameState } from "../state.js";

/**
 * Profundidad de celdas visibles en la vista 3D delante del jugador.
 *
 * GATE DE LUZ (DUNGEON:0x1AD6-0x1AE4): `si g_light_spell_mins==0 Y
 * g_torch_mins==0 → jmp 0x1BBE` — salta TODO el raycast → oscuridad total (0).
 * Con CUALQUIERA de los dos > 0 se raytraza; el gate NO distingue antorcha de
 * hechizo In Lor/Vas Lor, así que ambos dan la MISMA profundidad.
 *
 * PROFUNDIDAD = 4 (no 3): el bucle del rayo (0x1B0C `sub si,si` … 0x1B8A
 * `cmp si,4; jge`) marcha `si = 0,1,2,3` y para en `si>=4` → 4 celdas. El
 * renderer (dungeon3d.ts) ya lleva 5 marcos anidados (FRAME) preparados para
 * esta profundidad.
 */
export function visibleDepth(state: GameState): number {
  const lit = (state.lightSpellMins ?? 0) > 0 || (state.torchTurns ?? 0) > 0;
  return lit ? 4 : 0;
}

/**
 * True si el jugador está a oscuras: sin antorcha encendida NI hechizo de luz
 * activo (el mismo gate doble de 0x1AD6). Útil para "darkness." de Look/Search.
 */
export function isDark(state: GameState): boolean {
  return (state.lightSpellMins ?? 0) <= 0 && (state.torchTurns ?? 0) <= 0;
}
