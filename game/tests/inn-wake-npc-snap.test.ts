/**
 * #158 — SNAP de los NPCs a su horario al DESPERTAR en la posada.
 *
 * EL ORIGINAL (SHOPPES3.OVL), instrucción a instrucción:
 *
 *   01f4: 75d4        jne 0x1ca         ; fin del bucle de la noche (g_hour == 6)
 *   01f6: b8514e      mov ax, 0x4e51    ; DATA.OVL file 0x4e61 = b'Morning!\n'
 *   01fa: e87334      call 0x3670       ; print_string
 *   01fd: e8ae96      call 0xffff98ae   ; ★ el snap, JUSTO DESPUÉS del mensaje
 *   0200: c746f80000  mov word ptr [bp - 8], 0
 *
 * Destino resuelto con el instrumento: SHOPPES3 está en la BANDA 4 (near_call_base
 * 0xe1e0) ⇒ crudo 0x98ae → CS 0x7a8e, dentro de la banda de stubs [0x7a16,0x81c6);
 * `re/tools/dispatch_table.py stubs()[0x7a8e]` = Stub(overlay='TOWN.OVL',
 * entry_file_off=5780) = **TOWN.OVL:0x1694 npc_activate_all_town**.
 *
 * TOWN.OVL:0x1694 pone a cero los 32 slots (0x16a2-0x16b9) y recoloca a cada NPC con
 * horario (`0x16c9 cmp byte [si+0x659e],0`) en la x/y/z del tramo que toca a `g_hour`
 * (`0x16d1` + `call 0xfffff966`, luego `[bx+0x5d61]/[bx+0x5d64]/[bx+0x5d67]`).
 *
 * DOS NIVELES, a propósito (el defecto clásico es sellar la lógica y dejar el cableado
 * muerto): (1) el MECANISMO sobre el NpcManager real con los assets reales; (2) el
 * CABLEADO y su ORDEN en el conductor de la posada.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import type { Game as GameClass, GameData } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;
const npcData = readJson<Record<number, NpcSlot[]>>("npcs.json");
const init = readJson<ExtractedInitialState>("initial-state.json");
const BRITAIN = 2;

function stateAt(hour: number): GameState {
  const s = createNewGame(init);
  s.position.location = BRITAIN;
  s.time.hour = hour;
  s.time.minute = 0;
  return s;
}

/**
 * Party en una cama de Britain a las 6:00, con el `NpcManager` de los assets REALES.
 * Sirve para contar snaps por hora dormida (#241). Mundo sintético: lo que se mide es el
 * número de llamadas al snap, no el terreno.
 */
async function bedGame(): Promise<{ game: InstanceType<typeof GameClass> }> {
  const { Game } = await import("../src/core/game.js");
  const state = stateAt(6);
  state.position = { location: BRITAIN, floor: 0, x: 5, y: 5 };
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 4));
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(BRITAIN, { id: BRITAIN, name: "Britain", floors: [{ z: 0, tiles }] });
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 4));
  const world: WorldData = { overworld: ow, underworld: ow, smallMaps };
  const gameData: GameData = {
    locationsX: Array.from({ length: 32 }, () => 250),
    locationsY: Array.from({ length: 32 }, () => 250),
    locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
  };
  return { game: new Game(init, world, gameData, state, { npcManager: new NpcManager(npcData) }) };
}

describe("#158 (1) MECANISMO — el snap recoloca a los NPC en el tramo de la hora", () => {
  it("las posiciones de las 21:00 y las 06:00 NO son las mismas (si no, el test no mediría nada)", () => {
    // CONTROL DE INSTRUMENTO: sin este contraste, un snap que no hiciera nada pasaría.
    const night = new NpcManager(npcData);
    night.enterMap(BRITAIN, stateAt(21));
    const morning = new NpcManager(npcData);
    morning.enterMap(BRITAIN, stateAt(6));
    const key = (m: NpcManager): string =>
      [...m.npcsAt(BRITAIN, 0), ...m.npcsAt(BRITAIN, 1)]
        .sort((a, b) => a.slot - b.slot)
        .map((n) => `${n.slot}:${n.x},${n.y},${n.z}`)
        .join("|");
    expect(key(night)).not.toBe(key(morning));
  });

  it("un NPC DESPLAZADO a mano vuelve a su puesto de las 06:00 tras el snap", () => {
    const mgr = new NpcManager(npcData);
    const state = stateAt(6);
    mgr.enterMap(BRITAIN, state);
    const target = [...mgr.npcsAt(BRITAIN, 0), ...mgr.npcsAt(BRITAIN, 1)].sort(
      (a, b) => a.slot - b.slot,
    )[0]!;
    const home = { slot: target.slot, x: target.x, y: target.y, z: target.z };

    // Simula la noche: el NPC se quedó donde estaba a las 21:00 (una casilla lejos).
    target.x = (target.x + 7) % 32;
    target.y = (target.y + 5) % 32;

    // El snap del despertar (TOWN 0x1694 = enterMap en el port).
    mgr.enterMap(BRITAIN, state);

    const after = [...mgr.npcsAt(BRITAIN, 0), ...mgr.npcsAt(BRITAIN, 1)].find(
      (n) => n.slot === home.slot,
    )!;
    expect({ x: after.x, y: after.y, z: after.z }).toEqual({ x: home.x, y: home.y, z: home.z });
  });

  it("el snap NO consume RNG (ni 0x1694 ni enterMap tiran rand)", () => {
    // Importa para el stream: #122 declaró el impacto de la NOCHE; el snap añade CERO.
    const mgr = new NpcManager(npcData);
    let rolls = 0;
    mgr.setRng({ next: () => (rolls++, 0), getSeed: () => 0 } as never);
    mgr.enterMap(BRITAIN, stateAt(6));
    expect(rolls).toBe(0);
  });
});

/**
 * #158 (2º call-site) — dormir en CAMA de pueblo también snapea.
 *
 * Encontrado corrigiendo el instrumento: buscar los BYTES crudos `call 0xffff98ae` en los
 * 30 `.asm` devuelve UN caller (SHOPPES3) y es un CERO EN FALSO POR BANDA — el mismo
 * destino se codifica distinto en cada overlay según su `near_call_base`. Resolviendo
 * `(crudo + base) & 0xFFFF == 0x7a8e` salen DOS:
 *
 *   SHOPPES3.OVL CS:0x01fd   crudo 0xffff98ae + base 0xe1e0   (posada)
 *   CMDS.OVL     CS:0x0677   crudo 0xffffbb0e + base 0xbf80   (cama de pueblo)
 *
 * `CMDS.OVL CS:0x0552` es la rutina del prompt "For how many hours? " (DS 0x4209).
 *
 * ⚠ CORRECCIÓN DE ESTA ACTA (#241): aquí ponía «el snap va justo TRAS su bucle de horas»,
 * y el bucle dice lo contrario. El `je 0x634` de 0x068d salta HACIA ATRÁS, a la cabeza del
 * bucle, así que 0x0677 queda DENTRO y corre una vez POR PASO — que es lo que hace
 * alcanzable «Thrown out of bed!» (#230). El cableado vive ahora en el bucle de
 * `camp.ts::bedSleep` vía el ctx (`snapNpcsToSchedule`), no en `Game.bedSleep`.
 * El camp de INTEMPERIE (kernel 0x3C9A) NO lo llama.
 */
describe("#158 (2) el 2º call-site: dormir en cama de pueblo (CMDS CS:0x0677)", () => {
  it("★ el snap corre UNA VEZ POR PASO DE 10 MINUTOS — 6 por hora dormida (CMDS 0x0677)", async () => {
    // Medida de CONDUCTA, no de texto fuente: la versión anterior de este test exigía el
    // literal `wakeSnapNpcs` en el cuerpo de `Game.bedSleep`, y ese literal era compatible
    // con la llamada ÚNICA y tardía que #241 tuvo que corregir. Contar las llamadas
    // distingue las dos cosas; el nombre del método no.
    //
    // 🔴 ESTE CASO PINABA LA CADENCIA VIEJA, y su TÍTULO era la trampa. Decía «UNA VEZ POR
    // HORA dormida» citando `0x068d je 0x634` como autoridad — pero ese `je` es la ARISTA
    // DE VUELTA del bucle: acredita QUE HAY BUCLE, no CUÁNTO DURA LA VUELTA. La vuelta son
    // DIEZ MINUTOS (`0x064b advance_clock` con argumento 10; el cuerpo del reloj suma
    // MINUTOS) ⇒ 6 vueltas por hora, y el snap (0x0677, `npc_activate_all_town`) cuelga de
    // la vuelta, incondicional: los dos caminos previos convergen en 0x0667 y de ahí a
    // 0x0677 es línea recta.
    //
    // ★ DE DÓNDE SALIÓ EL ERROR, que es lo que hay que recordar: en ese bucle SÍ hay algo
    // gateado por hora —el transformador de tiles de pueblo (0x0664), tras el `cmp` de hora
    // de 0x0656— y está TRES INSTRUCCIONES ANTES del snap. Quien escribió esto acertó la
    // cadencia y la colgó de la LLAMADA EQUIVOCADA. (Adjudicado por asm-shoppes-5 leyendo
    // el cuerpo, a petición de este carril y sin buscar confirmarlo.)
    const { Game } = await import("../src/core/game.js");
    const proto = Game.prototype as unknown as { wakeSnapNpcs: () => void };
    const orig = proto.wakeSnapNpcs;
    let snaps = 0;
    proto.wakeSnapNpcs = function (this: unknown): void {
      snaps++;
      orig.call(this);
    };
    try {
      const { game } = await bedGame();
      game.bedSleep(4);
      expect(snaps, "4 horas × 6 pasos de 10' = 24 snaps (0x0677 cuelga de la VUELTA)").toBe(24);
      snaps = 0;
      const otro = await bedGame();
      otro.game.bedSleep(1);
      expect(snaps, "y 1 hora ⇒ 6 (control: el número sigue a los PASOS, no a las horas)").toBe(6);
    } finally {
      proto.wakeSnapNpcs = orig;
    }
    // 20s: monta DOS partidas y duerme 8+1 horas simuladas — 1,7-7,3s medidos según carga
    // de la máquina (dos rojos de artefacto-de-carga el 31-07 con el presupuesto default de 5s).
  }, 20000);

  it("el método del snap existe y es el MISMO para los dos despertares", async () => {
    const { Game } = await import("../src/core/game.js");
    const proto = Game.prototype as unknown as Record<string, unknown>;
    expect(typeof proto.wakeSnapNpcs).toBe("function");
    // Y no quedan restos del nombre viejo, específico de posada.
    expect(proto).not.toHaveProperty("innWakeSnapNpcs");
  });
});
