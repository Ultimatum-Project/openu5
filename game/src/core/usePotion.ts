/**
 * Bebedor de POCIONES (8 colores) — MODELO PURO del `cmd_use_item` → potion drinker
 * (CAST.OVL 0x135a). Deriva la tabla color→efecto, la aleatoriedad (1/16 fiasco +
 * 1/16 otro color), el consumo y los ecos EXACTOS de DATA.OVL. Cada regla cita su
 * offset en `re/notes/potions-scrolls.md` (jump-table @file 0x1520 verificada byte a
 * byte contra `original/u5/play/CAST.OVL`).
 *
 * Reparto: este módulo resuelve el EFECTO sobre un PJ objetivo + el eco; el consumo
 * del ítem y el picker de PJ los orquesta el llamador (main.ts), como el original
 * (consumo ANTES del target-select en 0x136a; selChar en 0x138e). Fuera de combate
 * (único caso del (U)se, loc<=0x7f) las de combate (Purple/Black) no surten efecto.
 */
import type { CharacterState } from "./state.js";
import type { CombatRng } from "./combat/formulas.js";
import { applyMani, applyCure, applyAwaken, applyPoison, applySleep } from "./magic/cast.js";
import { TILE_INVISIBLE } from "./world/transport.js";

/** Nombres de color (name-table DATA.OVL DS 0x067c). Orden = índice de poción 0-7. */
export const POTION_COLORS = ["Blue", "Yellow", "Red", "Green", "Orange", "Purple", "Black", "White"] as const;

/**
 * REVELADO de la poción BLANCA (#326) — CAST2.OVL 0x046c (compartido con Wis An
 * Ylem #319, que le hace TAIL): VEINTE fotogramas (`mov si, 0x14` en 0x049d) con la
 * ventana 11×11 ENTERA visible — 0x5d0a llamado con radio -1 (0x0473 `push -1`),
 * cuya rama 5d45/5d8f-5df3 SE SALTA el flood y copia el TILE CRUDO de cada celda
 * (rayos X: salas selladas incluidas) — y un viewport_redraw final que restaura
 * (0x04ba). Cada vuelta espera UN tick de int 1c (0x04b0 `push 1` → delay_ticks
 * 0x20fa) ≈ 55 ms.
 * MUDA: la rama de la poción (CAST.OVL 0x151b) llama SIN el `push 6` del jingle;
 * ese cue es del hechizo, no de ella. Las CONSTANTES viven UNA sola vez
 * (unificación de la confluencia #319+#326): `DEATH_VISION_FRAMES = 0x14` en
 * magic/cast.ts y `PAUSE_UNIT_MS = 55` en skin/world-fx.ts; el paceo (modal, con
 * `revealing`) en main.ts (`runMapReveal`) sobre `CoreViewImpl.revealViewport`.
 */

export interface PotionOutcome {
  /** Eco a imprimir tras "Potion\n" (vacío = sin línea de efecto, fiel al binario). */
  message: string;
  /** true = el efecto se aplicó (para SFX/telemetría; el binario no ecoa el éxito uniformemente). */
  ok: boolean;
  /** Color cuyo EFECTO se aplicó tras la reroll (puede diferir del consumido). */
  effectiveColor: number;
}

/**
 * Reroll del bebedor (CAST.OVL 0x13a8-0x13cd): `rand(0,15)==0` fuerza color 4
 * (Orange=dormir, el "fiasco 1/15" del clue book); `==1` reroll a color aleatorio
 * `rand(0,7)`; resto → color original. `randRange` = 0x2092 (0x6112) inclusivo.
 */
export function rerollPotionColor(color: number, rng: CombatRng): number {
  const r = rng.randRange(0, 0x0f); // 0x13a8: rand(0,15)
  if (r === 0) return 4; // 0x13b2: fuerza Orange (dormir)
  if (r === 1) return rng.randRange(0, 7); // 0x13c0: efecto de OTRO color
  return color;
}

/**
 * Aplica el efecto de la poción de color `effectiveColor` sobre `target` en la
 * ubicación `location` (jump-table CAST.OVL 0x13db). Fuera de combate el (U)se
 * siempre pasa por aquí; las de combate no surten efecto y ecoan el aviso fiel.
 * NO consume ni rerollea (eso lo hace el llamador / `rerollPotionColor`).
 */
export function applyPotionEffect(
  target: CharacterState,
  effectiveColor: number,
  rng: CombatRng,
  location: number,
): PotionOutcome {
  const inCombat = location > 0x7f; // >=0x80 = mapa de combate
  switch (effectiveColor) {
    case 0: // Blue — despierta 'S'→'G' (0x13e0). Éxito/fallo SIN línea de efecto.
      return { message: "", ok: applyAwaken(target), effectiveColor };
    case 1: { // Yellow — cura parcial applyMani (0x142a → CAST2 0x03c2). Eco sólo si curó>0.
      const healed = applyMani(target, rng) > 0;
      return { message: healed ? "Healed!" : "", ok: healed, effectiveColor }; // DS 0x470e
    }
    case 2: // Red — cura veneno 'P'→'G' (0x1448).
      return applyCure(target)
        ? { message: "Poison cured!", ok: true, effectiveColor } // DS 0x4717
        : { message: "", ok: false, effectiveColor };
    case 3: // Green — ENVENENA 'G'→'P' (0x1460).
      return applyPoison(target)
        ? { message: "POISONED!", ok: true, effectiveColor } // DS 0x4726
        : { message: "", ok: false, effectiveColor };
    case 4: // Orange — DUERME 'G'→'S' (0x1478).
      return applySleep(target)
        ? { message: "Slept!", ok: true, effectiveColor } // DS 0x4731
        : { message: "", ok: false, effectiveColor };
    case 5: // Purple — SÓLO combate "Poof!" (0x14a0). Fuera → aviso fiel.
      return inCombat
        ? { message: "Poof!", ok: true, effectiveColor } // DS 0x4739
        : { message: "\nNo noticeable effect now!", ok: false, effectiveColor }; // DS 0x474c
    case 6: // Black — SÓLO combate "Invisible!" (0x14dc). Fuera → aviso fiel.
      return inCombat
        ? { message: "Invisible!", ok: true, effectiveColor } // DS 0x4740
        : { message: "\nNo noticeable effect now!", ok: false, effectiveColor };
    case 7: // White — reveal overworld/pueblo (0x1514). Fuera de <0x21 → aviso fiel.
      // El reveal (CAST2 0x046c) es cosmético (sin cambio de estado ni línea de
      // efecto); eco vacío = fiel (el binario no imprime línea). PORTADO en #326:
      // con ok=true el llamador (main.ts) arranca `runMapReveal` — 20 fotogramas de
      // ventana entera visible (DEATH_VISION_FRAMES × PAUSE_UNIT_MS) y MUDO (sin jingle).
      return location < 0x21
        ? { message: "", ok: true, effectiveColor }
        : { message: "\nNo noticeable effect now!", ok: false, effectiveColor };
    default:
      return { message: "", ok: false, effectiveColor };
  }
}

/** Subconjunto del Combatant que toca la sincronización de poción en combate. */
export interface PotionCombatTarget {
  hp: number;
  sleeping: boolean;
  invisible: boolean;
  renderTile?: number;
}

/**
 * Sincroniza el Combatant del bebedor tras aplicar la poción en la arena (efectos de
 * combate REALES, CAST.OVL rama combate): HP (Yellow), sueño (Orange/Blue), y los dos
 * efectos SÓLO-combate — Black (6) invisible (flag 0x10, CAST 0x14dc) y Purple (5)
 * polimorfia a rata (tile 0x90, CAST 0x14a0). Ninguno expira (persiste hasta fin de
 * combate). Ver re/notes/combat-use-potions.md.
 */
export function applyPotionCombatSync(
  cur: PotionCombatTarget,
  recordHp: number,
  recordStatus: string,
  effectiveColor: number,
  ok: boolean,
): void {
  cur.hp = recordHp; // Yellow curó → refleja el HP del record en la arena
  cur.sleeping = recordStatus === "S"; // Orange durmió / Blue despertó
  // Black: `or [si-0x45ea],0x10` (flag) Y `mov [di+1],al` con al=0x1d + la cola compartida
  // `0x1510 mov [bx],al` — el tile de RENDER también, o el bebedor sigue viéndose.
  if (ok && effectiveColor === 6) {
    cur.invisible = true;
    cur.renderTile = TILE_INVISIBLE;
  }
  // Purple (rata): `mov al,0x90` + la MISMA cola ⇒ mismo campo, última escritura gana.
  if (ok && effectiveColor === 5) cur.renderTile = 0x90;
}
