/**
 * #143 · MECÁNICA DEL CORPSER — «dragged under!» + «ARGH!» + «regurgitated!» son UN solo
 * mecanismo, unido por el BIT 4 de `g_combat_actor_records+2` (0xBA14, stride 8).
 *
 * No son dos huecos de mensaje: es un ciclo de estado con tres sitios y sólo tres. Censo
 * mecánico de los 52 accesos a record+2 (displacement 0x45ea) en los 25 binarios — el bit 4
 * lo tocan EXACTAMENTE tres instrucciones:
 *
 *   · SET   COMSUBS 0x03E0  `or  byte ptr [si - 0x45ea], 4`
 *   · TEST  COMBAT  0x07D7  `test byte ptr [bx - 0x45ea], 4`
 *   · CLEAR COMBAT  0x1CC9  `and byte ptr [si - 0x45ea], 0xfb`
 *
 * (1) SET — COMSUBS 0x0312, rama del golpe NO letal a un miembro del party.
 *     0x03A4 `test [bp-2], 0x80` = la víctima es del party; 0x03AA descarta atacante 0xFF;
 *     0x03B8 `cmp byte ptr [bx - 0x45e9], 0x2d` = el ATACANTE es tipo 0x2D. ⚠ El 0x2D es
 *     índice de `monsterNamesUpper[45]` = "CORPSERS" (verificado contra data.json), NO
 *     TileData[0x2d] (=WheatInField) — el gotcha que la tarjeta ya traía pagado.
 *     Si cuadra: DS 0x9A10 « dragged under!\n» + sonido + `or [rec+2],4`. Si no: DS 0x9A22
 *     « hit!\n», que es lo ÚNICO que el port emitía.
 *
 * (2) TEST — COMBAT 0x07D7, a la CABEZA del turno del actor y ANTES del bit 8 (sueño,
 *     0x080A). Con el bit puesto: DS 0x6DC0 «ARGH!\n» + sonido + `call 0x1c66` + el turno
 *     se CONSUME (0x0830 `[bp-4]=1` → jmp 0x7ba). O sea: estar arrastrado = perder el turno.
 *
 * (3) CLEAR — COMBAT 0x1C66, la tirada de escape que 0x07DE invoca:
 *       1c72: call 0x982e            → kernel 0x3ABE = `max(1, rand0(0x3C) >> 1)` ∈ [1,30]
 *       1c75: cl = [si - 0x45eb]     → record+1 = la VELOCIDAD de iniciativa (`Combatant.speed`)
 *       1c7b: cmp cx, ax / jbe 0x1ce0 → speed <= tirada ⇒ FALLA en SILENCIO, sigue preso
 *       1cac: DS 0x6F5E « regurgitated!\n» (precedido del NOMBRE) + sonido
 *       1cc9: `and [rec+2], 0xfb`    → LIBRE
 *     ★ El kernel 0x3ABE ya estaba portado y derivado: `CombatRng.rand30()` (formulas.ts),
 *     el mismo helper que el daño de ÁCIDO de las trampas. Control positivo del cuerpo.
 *
 * IMPACTO DE STREAM: una tirada `rand0(0x3C)` por turno perdido (la del escape). El port
 * consumía CERO — el ciclo entero era inexistente.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  CORPSER_TYPE,
  type Combatant,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}

const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

const freshState = (): GameState =>
  createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));

const allDefs = (): EnemyDef[] => buildEnemyDefs(data, additionalFlags);
const defByIndex = (i: number): EnemyDef => {
  const d = allDefs().find((e) => e.index === i);
  if (!d) throw new Error(`sin enemigo con index ${i}`);
  return d;
};

function soloParty(state: GameState): PartyCombatant[] {
  state.characters[0]!.currentHp = 200;
  state.characters[0]!.maxHp = 200;
  return [{ charIdx: 0, record: state.characters[0]!, weapons: [{ attack: 10, range: 1 }] }];
}

function mkCombat(enemyIndex: number): Combat {
  const state = freshState();
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: soloParty(state),
    enemies: [{ def: defByIndex(enemyIndex), count: 1 }],
    seed: 1234,
    state,
    defenseValues: data.defenseValues,
  });
}

const texts = (evs: { text?: string }[]): string[] =>
  evs.map((e) => e.text).filter((t): t is string => t !== undefined);

/** Deja al PJ como unidad activa (los tests del repo ciclan con pass/tick). */
function advanceToPlayerTurn(combat: Combat): Combatant {
  for (let i = 0; i < 200; i++) {
    const cur = combat.currentUnit;
    if (cur && cur.kind === "player") return cur;
    combat.tickEnemyTurns();
  }
  throw new Error("no se alcanzó el turno del PJ");
}

/** Pega al enemigo al PJ y cicla turnos hasta que un golpe suyo produzca texto. */
function enemyStrikesPlayer(combat: Combat): string[] {
  const player = combat.combatants.find((c) => c.kind === "player")!;
  const foe = combat.combatants.find((c) => c.kind === "enemy")!;
  foe.x = player.x + 1;
  foe.y = player.y;
  const out: string[] = [];
  for (let i = 0; i < 400 && out.length === 0; i++) {
    const cur = combat.currentUnit;
    const evs = cur && cur.kind === "player" ? combat.playerPass() : combat.tickEnemyTurns();
    for (const t of texts(evs)) {
      if (/dragged under!|hit!|killed!/.test(t)) out.push(t);
    }
    foe.x = player.x + 1; // se mantiene adyacente aunque intente moverse
    foe.y = player.y;
  }
  return out;
}

/** Como enemyStrikesPlayer pero devuelve TODOS los eventos del golpe con texto de daño. */
function enemyStrikesPlayerEvents(combat: Combat): { kind: string; text?: string; dragged?: boolean }[] {
  const player = combat.combatants.find((c) => c.kind === "player")!;
  const foe = combat.combatants.find((c) => c.kind === "enemy")!;
  foe.x = player.x + 1;
  foe.y = player.y;
  for (let i = 0; i < 400; i++) {
    const cur = combat.currentUnit;
    const evs = cur && cur.kind === "player" ? combat.playerPass() : combat.tickEnemyTurns();
    if (evs.some((e) => e.text !== undefined && /dragged under!|hit!|killed!/.test(e.text))) {
      return evs as { kind: string; text?: string; dragged?: boolean }[];
    }
    foe.x = player.x + 1;
    foe.y = player.y;
  }
  throw new Error("el enemigo nunca conectó un golpe con texto");
}

describe("#143 · el Corpser y el bit 4 (COMSUBS 0x03E0 / COMBAT 0x07D7 / 0x1CC9)", () => {
  it("★ el tipo 0x2D es CORPSERS por NOMBRE, no por TileData (el gotcha de la tarjeta)", () => {
    expect(CORPSER_TYPE).toBe(0x2d);
    const names = (data as unknown as { monsterNamesUpper: string[] }).monsterNamesUpper;
    expect(names[45]).toBe("CORPSERS"); // 45 == 0x2D
    expect(defByIndex(CORPSER_TYPE).name.toUpperCase()).toContain("CORPSER");
  });

  describe("(1) SET — el golpe no letal de un Corpser a un PJ", () => {
    it("dice «dragged under!» (DS 0x9A10) en vez de «hit!» y ENCIENDE el bit", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = combat.combatants.find((c) => c.kind === "player")!;
      const hits = enemyStrikesPlayer(combat);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((t) => t.includes("dragged under!"))).toBe(true);
      expect(hits.some((t) => t.includes(" hit!"))).toBe(false);
      expect(player.draggedUnder).toBe(true);
    });

    it("CONTROL POSITIVO: un enemigo NO-Corpser deja el « hit!» de siempre y NO el bit", () => {
      const combat = mkCombat(0); // rata: mismo camino, otro tipo ⇒ 0x03B8 no cruza
      const player = combat.combatants.find((c) => c.kind === "player")!;
      const hits = enemyStrikesPlayer(combat);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((t) => t.includes(" hit!"))).toBe(true);
      expect(hits.some((t) => t.includes("dragged under!"))).toBe(false);
      expect(player.draggedUnder).toBe(false);
    });
  });

  describe("(2)+(3) TEST y CLEAR — el turno perdido y la tirada de escape", () => {
    it("con el bit puesto el turno se PIERDE con «ARGH!» y la tirada FALLA en silencio", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.speed = 1; // speed <= tirada (mín. 1) ⇒ `jbe 0x1ce0`: nunca escapa

      const evs = combat.playerMove("north");

      expect(texts(evs)).toContain("ARGH!"); // DS 0x6DC0
      expect(texts(evs).some((t) => t.includes("regurgitated"))).toBe(false);
      expect(player.draggedUnder).toBe(true); // sigue preso
    });

    it("con speed > tirada ESCAPA: «regurgitated!» (DS 0x6F5E) y el bit se APAGA", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.speed = 31; // rand30() ∈ [1,30] ⇒ speed > tirada SIEMPRE

      const evs = combat.playerMove("north");

      expect(texts(evs)).toContain("ARGH!");
      expect(texts(evs).some((t) => t.includes("regurgitated!"))).toBe(true);
      expect(player.draggedUnder).toBe(false); // 0x1CC9 `and ...,0xfb`
    });

    it("el ARGH va ANTES que el sueño: el bit 4 se comprueba antes del 8 (0x07D7 < 0x080A)", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.sleeping = true;
      player.speed = 1;

      const evs = combat.playerMove("north");

      expect(texts(evs)).toContain("ARGH!");
      expect(texts(evs)).not.toContain("Zzzzz..."); // el bit 4 gana
    });

    it("IMPACTO DE STREAM: el turno arrastrado consume UNA tirada (rand0(0x3C))", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.speed = 1;

      const before = combat.rngSeed;
      combat.playerMove("north");
      expect(combat.rngSeed).not.toBe(before);
    });

    it("CONTROL: un turno NO arrastrado (pass) no consume la tirada del escape", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = false;
      const before = combat.rngSeed;
      combat.playerPass();
      expect(combat.rngSeed).toBe(before);
    });
  });

  // ★ #328 — la REALIMENTACIÓN VISUAL del arrastre, que #143 dejó sin portar:
  // COMSUBS 0x03ED `mov byte ptr [bx+0x5c5b], 0` = render-tile 0 (la víctima
  // DESAPARECE bajo el corpser; 0 es el valor de «ranura sin nada que pintar» con
  // que se inicializa la tabla — TOWN 0x0fed / FONT 0x08b1) y el escape la
  // RESTAURA: COMBAT 0x1cd8-0x1cdc `al ← [di+0x5c5a]; [di+0x5c5b] ← al` (+1 ← +0).
  describe("(#328) render-tile 0: la víctima desaparece y el escape la restaura", () => {
    it("el golpe del Corpser escribe renderTile 0 (COMSUBS 0x03ED) y marca `dragged` en el evento", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = combat.combatants.find((c) => c.kind === "player")!;
      const evs = enemyStrikesPlayerEvents(combat);
      expect(player.renderTile).toBe(0); // 0x03ED — el esperado en crudo: CERO, no undefined
      const attacked = evs.find((e) => e.text?.includes("dragged under!"));
      expect(attacked?.dragged).toBe(true); // señal para la pausa 0x3AE6(4) de la presentación
    });

    it("CONTROL POSITIVO: el golpe de una rata NO toca renderTile ni marca `dragged`", () => {
      const combat = mkCombat(0);
      const player = combat.combatants.find((c) => c.kind === "player")!;
      const evs = enemyStrikesPlayerEvents(combat);
      expect(player.renderTile).toBeUndefined();
      expect(evs.every((e) => e.dragged === undefined)).toBe(true);
    });

    it("el escape («regurgitated!») restaura el tile: +1 ← +0 (COMBAT 0x1cd8-0x1cdc)", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.renderTile = 0; // estado que deja el golpe (0x03ED)
      player.speed = 31; // rand30() ∈ [1,30] ⇒ escapa SIEMPRE
      const evs = combat.playerMove("north");
      expect(texts(evs).some((t) => t.includes("regurgitated!"))).toBe(true);
      // El port modela el par base/render con UN solo campo (decisión #356):
      // restaurar +1 ← +0 es volver al sprite de clase = limpiar el override.
      expect(player.renderTile).toBeUndefined();
    });

    it("el escape FALLIDO no restaura: sigue bajo tierra con renderTile 0", () => {
      const combat = mkCombat(CORPSER_TYPE);
      const player = advanceToPlayerTurn(combat);
      player.draggedUnder = true;
      player.renderTile = 0;
      player.speed = 1; // speed <= tirada ⇒ nunca escapa
      combat.playerMove("north");
      expect(player.draggedUnder).toBe(true);
      expect(player.renderTile).toBe(0);
    });
  });
});
