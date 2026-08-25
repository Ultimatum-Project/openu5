/**
 * SAVE IN-TOWN TRAS `npc_clear_slot` — cierre del residuo acotado del tren #122
 * (declarado en `NpcManager.clearSlot`, clase del .GAM nativo #227/#238).
 *
 * Derivación (crudo TOWN.OVL 0x00B0-0x0110, leído instrucción a instrucción):
 * `npc_clear_slot` escribe TODO dentro de la ventana persistida del save
 * (0x55A6..0x6605 = 4192 B = el fichero SAVED.GAM entero; acta
 * re/notes/npc-maquina-caminata-acta.md §4.2):
 *   - 0x00d3-0x00e3: palabra de presencia y campos del registro VIVO a 0
 *     (`mov [si+0x5f5e],ax`..`[si+0x5f68]` con ax=0) — el «presente» que
 *     `cmp word [0x5f5e+si*16],0` chequea en todos los recorridos;
 *   - 0x00e7-0x00f9: el registro-objeto de 8 B en 0x5C5A+idx*8 a 0;
 *   - 0x00fd-0x0105: los 3 primeros bytes del HORARIO 0x5D5E+idx*16 a 0;
 *   - 0x010c: flag de activo `[bx+0x659e]=0`.
 * La carga de partida restaura esa ventana VERBATIM y NO relee el .NPC (el .NPC
 * sólo se recarga al ENTRAR al mapa) ⇒ en el binario un save in-town tras el clear
 * conserva la ranura VACÍA al load; el monstruo sólo revive re-entrando al pueblo.
 *
 * El port espeja la ventana en `state.npcWalk` (espejo del bloque, #108). El residuo
 * era doble: (a) el overlay de restore de `enterMap` re-creaba el runtime desde
 * npcData y sólo sobreescribía los presentes — el cleared revivía antes de hora; y
 * (b) `clearSlot` no sincronizaba npcWalk (esperaba al tick) — un save entre el
 * clear y el tick llevaba el slot todavía presente. Los esperados van EN CRUDO
 * (presencia/ausencia de la ranura 2), no derivados corriendo el sujeto.
 */
import { describe, expect, it } from "vitest";
import type { GameState } from "../src/core/state.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { OriginalRng } from "../src/core/rng-original.js";

// El arnés no necesita mapa ni ticks: la observable es presencia/ausencia de la
// ranura en la lista viva y en su espejo persistido `state.npcWalk`.

function gameState(hour: number): GameState {
  return {
    version: 1,
    position: { location: 7, floor: 0, x: 0, y: 0 },
    time: { year: 139, month: 1, day: 1, hour, minute: 0 },
    turnsSinceStart: 0,
    npcDead: [],
  } as unknown as GameState;
}

function slot(over: Partial<NpcSlot>): NpcSlot {
  return {
    slot: 1,
    aiTypes: [0, 0, 0],
    x: [5, 20, 5],
    y: [5, 20, 5],
    z: [0, 0, 0],
    times: [8, 12, 18, 22],
    type: 112,
    dialogNumber: 0,
    ...over,
  };
}

/** Pueblo con una persona (slot 1) y una «gárgola» hostil (slot 2, tile 0xb8). */
function makeManager(): NpcManager {
  const persona = slot({ slot: 1 });
  const gargola = slot({ slot: 2, type: 0xb8, x: [9, 9, 9], y: [9, 9, 9] });
  return new NpcManager({ 7: [persona, gargola] }, new OriginalRng(1));
}

describe("clearSlot + save in-town (npc_clear_slot TOWN 0x00B0 escribe en la ventana 0x55A6..0x6605)", () => {
  it("clearSlot sincroniza npcWalk INMEDIATAMENTE (0x00d3-0x010c: la escritura es directa, no al tick)", () => {
    const mgr = makeManager();
    const st = gameState(8);
    mgr.enterMap(7, st);
    // control positivo: antes del clear, la ranura 2 está en el espejo
    expect(st.npcWalk!.slots.map((s) => s.slot)).toEqual([1, 2]);
    mgr.clearSlot(7, 2, st);
    // sin NINGÚN tick de por medio: el espejo ya no lleva la ranura 2
    expect(st.npcWalk!.slots.map((s) => s.slot)).toEqual([1]);
  });

  it("load in situ: la ranura vaciada NO existe (la ventana se restaura verbatim, sin releer el .NPC)", () => {
    const mgr = makeManager();
    const st = gameState(8);
    mgr.enterMap(7, st);
    mgr.clearSlot(7, 2, st);
    // «carga de partida»: manager nuevo, restore=true — como el binario, la ranura
    // sigue vacía (presencia [0x5F5E+2*16]==0 viajó en el .GAM)
    const mgr2 = makeManager();
    mgr2.enterMap(7, st, true);
    expect(mgr2.npcsAt(7, 0).map((n) => n.slot)).toEqual([1]);
    // y el espejo re-sincronizado tampoco la resucita
    expect(st.npcWalk!.slots.map((s) => s.slot)).toEqual([1]);
  });

  it("re-ENTRAR al mapa recarga el .NPC: el monstruo revive (control positivo de la resurrección fiel)", () => {
    const mgr = makeManager();
    const st = gameState(8);
    mgr.enterMap(7, st);
    mgr.clearSlot(7, 2, st);
    // entrada fresca (sin restore) = recarga del .NPC: la gárgola vuelve
    const mgr3 = makeManager();
    mgr3.enterMap(7, st);
    expect(mgr3.npcsAt(7, 0).map((n) => n.slot)).toEqual([1, 2]);
  });

  it("save viejo SIN npcWalk: restore no borra nada (compat declarada, re-deriva por horario)", () => {
    const st = gameState(8);
    st.npcWalk = null;
    const mgr = makeManager();
    mgr.enterMap(7, st, true);
    expect(mgr.npcsAt(7, 0).map((n) => n.slot)).toEqual([1, 2]);
  });
});
