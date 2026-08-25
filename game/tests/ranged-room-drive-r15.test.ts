/**
 * ITERACIÓN RANGED (feature #44-2ª) — FASE 1: drive del MOTOR VIVO para UNA sala
 * ranged (r15 de Deceit = combatmaps[31], la sala de spawn del ascenso de ch16).
 *
 * Objetivo: ¿puede la party de ch15 (3 con el miembro 1 muerto) GANAR r15
 * (Troll + 2 Ettin + 2 Dragon; los Dragon GATEAN Daemons) con una POLÍTICA
 * determinista del motor vivo (combat.ts), y es DETERMINISTA ×2 bajo seed-0?
 * Resultado MEDIDO del port (fase 2): NO — pierde en ~33 turnos, con un Daemon
 * gateado poseyendo a un miembro.
 *
 * Ese NO es un BASELINE DEL PORT, no un veredicto de fidelidad, y la razón está dos
 * líneas más abajo: el resolver es un arnés scripted (generalización del
 * `dungeonResolveRoomCombat` melé-only), NO calco — el binario no tiene auto-combate.
 * Una política de arnés que pierde no dice qué haría un jugador humano en el original;
 * decía «la respuesta FIEL» y se contradecía con su propio descargo (barrido
 * prosa-autofiel t3).
 *
 * Este fichero es el PRIMER LADRILLO del resolver ranged (Fase 2 lo generaliza a N
 * salas + presupuesto de recursos; Fase 3 revive ch16 con él).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Combat, type CombatMapData, type Dir8 } from "../src/core/combat/combat.js";
import { buildEnemyDefs, type AdditionalEnemyFlag, type EnemyDataInput } from "../src/core/combat/enemies.js";
import { importNativeSave, type SaveSidecar } from "../src/core/saveNative.js";
import { partyMembers } from "../src/core/party.js";
import { characterWeapons } from "../src/core/equip.js";
import type { GameState } from "../src/core/state.js";

function load<T>(rel: string): T {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}
function loadBin(rel: string): Uint8Array {
  const path = fileURLToPath(new URL(rel, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

type DataJson = EnemyDataInput & {
  defenseValues: number[];
  spellAttackRange: number[];
  attackValues: number[];
  attackRangeValues: number[];
};

const data = load<DataJson>("../assets/data.json");
const additional = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const enemyDefs = buildEnemyDefs(data, additional);
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const R15_INDEX = 31; // 16 (Britannia) + Deceit(orden 0)*16 + sala 15
const R15 = combatMaps[R15_INDEX]!;

const gam = loadBin("../e2e/grandtour/saves/ch15.gam");
const sidecar = load<SaveSidecar>("../e2e/grandtour/saves/ch15.sidecar.json");

function freshParty(): { state: GameState; party: ReturnType<typeof buildParty> } {
  const state = importNativeSave(gam, sidecar);
  return { state, party: buildParty(state) };
}
function buildParty(state: GameState) {
  return partyMembers(state).map((rec) => ({
    charIdx: state.characters.indexOf(rec),
    record: rec,
    weapons: characterWeapons(rec, data.attackValues, data.attackRangeValues),
  }));
}

const DELTA: Record<Dir8, { dx: number; dy: number }> = {
  north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 }, east: { dx: 1, dy: 0 }, west: { dx: -1, dy: 0 },
  ne: { dx: 1, dy: -1 }, nw: { dx: -1, dy: -1 }, se: { dx: 1, dy: 1 }, sw: { dx: -1, dy: 1 },
};
const cheb = (ax: number, ay: number, bx: number, by: number): number =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Política determinista del jugador (función pura del estado del combate). */
function drivePlayer(combat: Combat, cur: { id: number; x: number; y: number; charIdx?: number }): void {
  const enemies = combat.combatants.filter((c) => c.kind === "enemy" && c.status === "active");
  if (enemies.length === 0) { combat.playerPass(); return; }
  const REACH = 1; // party de ch15: armas melé
  // 1) Si hay un enemigo a alcance (Chebyshev ≤ REACH), ataca al de menor HP.
  const inReach = enemies
    .filter((e) => cheb(cur.x, cur.y, e.x, e.y) <= REACH)
    .sort((a, b) => a.hp - b.hp || a.y - b.y || a.x - b.x);
  if (inReach[0]) { combat.playerAttack(inReach[0].x, inReach[0].y); return; }
  // 2) Si no, avanza hacia el enemigo más CERCANO, probando movimientos en orden de
  //    preferencia (diagonal → ejes) y detectando bloqueo por posición sin cambio.
  const target = [...enemies].sort((a, b) =>
    cheb(cur.x, cur.y, a.x, a.y) - cheb(cur.x, cur.y, b.x, b.y) || a.hp - b.hp || a.y - b.y || a.x - b.x,
  )[0]!;
  const dx = Math.sign(target.x - cur.x);
  const dy = Math.sign(target.y - cur.y);
  const tries: Dir8[] = [];
  const GRID = 11;
  // guarda IN-GRID: nunca proponer un paso que salga del tablero (playerMove al borde
  // dispara playerEscape = HUIDA — envenenaría el desenlace). Solo pasos interiores.
  const push = (ddx: number, ddy: number): void => {
    const nx = cur.x + ddx, ny = cur.y + ddy;
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) return;
    const d = dirFor(ddx, ddy);
    if (d) tries.push(d);
  };
  push(dx, dy);                       // diagonal directa
  if (Math.abs(target.x - cur.x) >= Math.abs(target.y - cur.y)) { push(dx, 0); push(0, dy); }
  else { push(0, dy); push(dx, 0); }
  push(dx, -dy); push(-dx, dy);       // rodeos laterales
  for (const dir of tries) {
    const before = `${cur.x},${cur.y}`;
    combat.playerMove(dir);
    const me = combat.combatants.find((c) => c.id === cur.id);
    if (me && `${me.x},${me.y}` !== before) return; // se movió → turno consumido
    // si no se movió, playerMove no consumió turno (movimiento inválido); prueba otra.
  }
  combat.playerPass(); // encajonado: pasa (consume turno, evita bucle)
}
function dirFor(dx: number, dy: number): Dir8 | null {
  for (const [name, d] of Object.entries(DELTA) as [Dir8, { dx: number; dy: number }][]) {
    if (d.dx === dx && d.dy === dy) return name;
  }
  return null;
}

interface RunResult {
  outcome: "VICTORY" | "LOST" | "TIMEOUT";
  turns: number;
  finalSeed: number;
  partyHp: number[];
  partyStatus: string[];
  partyCharmed: boolean[];
  partyCharIdx: (number | undefined)[];
  rosterStatus: string[];
}
function runOnce(seed: number, entryDirection: "north" | "south" | "east" | "west"): RunResult {
  const { state, party } = freshParty();
  const combat = new Combat({
    map: R15,
    entryDirection,
    party,
    enemies: { fixedFromMap: true, defs: enemyDefs },
    seed,
    state,
    defenseValues: data.defenseValues,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
  });
  // Cap de turnos de seguridad: con over-by-bando (fase 2) el combate CONVERGE solo (LOST
  // en ~33 turnos), ya sin el FANTASMA Shamino que antes impedía el `over` natural. El cap
  // queda como guarda anti-bucle, no como muleta del desenlace.
  let turns = 0;
  while (!combat.over && turns++ < 800) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "player" && cur.status === "active" && !cur.charmed) {
      drivePlayer(combat, cur);
    } else {
      combat.tickEnemyTurns();
    }
  }
  const players = combat.combatants.filter((c) => c.kind === "player");
  return {
    outcome: combat.victory ? "VICTORY" : combat.over ? "LOST" : "TIMEOUT",
    turns,
    finalSeed: combat.finalSeed,
    partyHp: players.map((c) => c.hp),
    partyStatus: players.map((c) => c.status),
    partyCharmed: players.map((c) => c.charmed),
    partyCharIdx: players.map((c) => c.charIdx),
    rosterStatus: state.characters.slice(0, 3).map((c) => c.status),
  };
}

describe("FASE 1 — drive vivo de r15 (Deceit spawn del ascenso)", () => {
  // VEREDICTO (seed-0, entrada norte, política melé-close determinista) — RE-CARACTERIZADO
  // tras la FASE 2 del combate fiel (over-by-bando + posesión A3 + sin fantasma-Shamino):
  //  · El drive del motor vivo es DETERMINISTA ×2 (finalSeed + HP/estado idénticos).
  //  · La party FIEL de ch15 (Avatar hp40 + Shamino MUERTO status'D' **hp0** + Iolo hp67)
  //    PIERDE r15 y el combate CONVERGE a LOST (antes: TIMEOUT a 800 enmascarado por el
  //    fantasma). Mecánica fiel end-to-end: los 2 **Dragon** del mapa GATEAN Daemons
  //    (gatesInDaemon); con Shamino ya truly-dead (hp0, el fix de seedDelve-salta-'D' que
  //    re-selló ch15.gam) el bando PARTY se vacía → over-by-bando cierra LOST.
  //  · El viejo veredicto («2 reales mueren, fantasma enmascara TIMEOUT») era artefacto de
  //    las DOS infidelidades que la fase 2 cerró (fantasma-Shamino + fin de combate por kind).
  //
  // ★ RE-BASELINE #7 (#54 tanda 2, pieza 14 — grupo aleatorio 0xEC). CAUSA DECLARADA, y es
  // de STREAM, no de esta sala: cablear la familia `0xEC` añade las CUATRO tiradas que el
  // original hace al montar toda escena de sala (`DNGLOOK.OVL 0x1273-0x128c`, `rand(0,7)` ×4
  // contra DS 0x385e). **cm31 no contiene ni una unidad 0xEC** —medido: 5 unidades, sprites
  // 228/204/204/220/220— así que su ROSTER no cambia en absoluto; lo que cambia es por dónde
  // camina el RNG a partir del montaje. Números: finalSeed 17753 → **3206**, 33 → **29**
  // turnos, y el superviviente charmed desaparece (los 3 mueren, ninguno poseído).
  //
  // Lo que NO cambia, y es lo que este detector sostiene de verdad: el determinismo ×2 y el
  // desenlace ESTRUCTURAL (LOST por over-by-bando, no TIMEOUT). Los HP/charm/turnos concretos
  // nunca fueron afirmaciones de fidelidad —son la caracterización del port bajo un seed— y
  // por eso este fichero es un DETECTOR: su rojo dice «el port cambió», y aquí cambió por una
  // razón derivada y nombrada. Es también la prueba de lo frágil que es a cualquier cambio de
  // stream aguas arriba (la lección de ch26).
  //
  // ★ RE-BASELINE #8 (#356 — el roster-'D' NO entra al combate). CAUSA DERIVADA del binario
  // (kernel 0x6936 @0x69e1 `cmp byte [slot*32+0x55b3],0x44` → salta el spawn 0x6506; nota
  // re/notes/muertos-combate-entrada-356.md): Shamino ('D' de entrada en ch15.gam) ya no
  // recibe registro de combate — antes entraba como combatiente "dead" (el resto del
  // fantasma que la fase 2 dejó a medias). El STREAM está INTACTO —medido: finalSeed 3206,
  // 29 turnos, LOST, byte-idénticos pre/post— porque ni el skip ni la entrada consumen
  // rand; solo la POBLACIÓN cambia: los arrays pasan de 3 a 2 (Avatar + Iolo). El aserto
  // se ENDURECE: ausencia de Shamino en la arena (charIdx [0,2]) y su 'D' intacto en el
  // roster tras la corrida.
  it("es DETERMINISTA ×2 y caracteriza el desenlace (seed 0)", { timeout: 30_000 }, () => {
    const a = runOnce(0, "north");
    const b = runOnce(0, "north");
    // eslint-disable-next-line no-console
    console.log("R15 DRIVE:", JSON.stringify({ a, b }, null, 2));
    // 1) DETERMINISMO: dos corridas byte-idénticas (finalSeed + desenlace + HP/estado/charm).
    expect(b).toEqual(a);
    // 2) El combate CONVERGE a LOST (over-by-bando), no a TIMEOUT enmascarado.
    expect(a.outcome).toBe("LOST");
    // 3) BASELINE MEDIDO del port (no veredicto de fidelidad): con el stream post-0xEC la
    //    party entera cae y nadie queda poseído. El aserto se conserva porque es lo que hace
    //    de detector; si vuelve a moverse, se re-adjudica nombrando la causa, como aquí.
    //    Post-#356 la arena tiene DOS combatientes-PJ: Shamino ('D') no entra (fiel).
    expect(a.partyCharIdx).toEqual([0, 2]); // ausencia derivada, no hueco de índices
    expect(a.partyStatus).toEqual(["dead", "dead"]);
    expect(a.partyCharmed).toEqual([false, false]);
    expect(a.rosterStatus).toEqual(["D", "D", "D"]); // Shamino sigue 'D': nadie lo tocó
    expect(a.finalSeed).toBe(3206);
  });
});
