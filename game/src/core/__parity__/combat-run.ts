/**
 * Runner de paridad de COMBATE (Task 3.2). Reconstruye un combate desde la
 * instantánea del oráculo DOSBox (registros DS:0xBA14 + roster) y lo
 * reproduce con un RNG TRAZADOR: en cada tirada k comprueba que el motor
 * pide el mismo rango (lo, hi) que registró el binario, se siembra con la
 * semilla observada antes de esa tirada (los consumos no modelados del
 * binario no desalinean así los valores) y captura la trayectoria de HP.
 *
 * Entrada (argv[2], JSON):
 *   { seed, food, roster: [{name,status,str,dex,int,hp,maxHp,defense}],
 *     records: [{slot,kind,flags,hp,speed,ref,obj,counter,x,y}],
 *     trace: [{lo,hi,seed}] }
 * Salida (stdout): { rolls, mismatches, partyHpAtRoll, finalPartyHp,
 *                    finalEnemies, food }
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createNewGame, type ExtractedInitialState } from "../state.js";
import { OriginalRng } from "../rng-original.js";
import {
  Combat,
  type CombatMapData,
  type PartyCombatant,
} from "../combat/combat.js";
import {
  buildEnemyDefs,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../combat/enemies.js";
import { buildSpellDefs, type MagicDefsJson } from "../magic/spells.js";
import { castSpell } from "../magic/cast.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

interface TraceEntry {
  lo: number;
  hi: number;
  seed: number;
}

interface RecordIn {
  slot: number;
  kind: "player" | "enemy";
  flags: number;
  hp: number;
  speed: number;
  ref: number;
  obj: number;
  counter: number;
  x: number;
  y: number;
}

interface RosterIn {
  name: string;
  status: string;
  str: number;
  dex: number;
  int: number;
  hp: number;
  maxHp: number;
  defense: number;
}

interface Input {
  /** "trace" (por defecto) o "free" (órbita completa del RNG). */
  mode?: string;
  seed: number;
  food: number;
  roster: RosterIn[];
  records: RecordIn[];
  trace: TraceEntry[];
  /** Slot (binario) del combatiente cuyo turno espera input en el snapshot. */
  actorSlot?: number;
  /** Modo free: mapa real del combate (11×11 tiles U5) y bitmap de tiles
   *  bloqueados a pie (32 bytes, bit LSB-first = tile bloqueado). */
  arena?: number[][];
  passBitmap?: number[];
  /** Modo free: semilla final observada en el binario (condición de paro). */
  targetSeed?: number;
  /** Modo SUBSEQ: el clon corre libre desde `seed` y registra TODAS sus
   *  tiradas (semilla+rango+estado); el comparador casa la traza (muestreo
   *  con posibles pérdidas por lecturas del pty) como SUBSECUENCIA por
   *  semilla. Robusto a los drops de captura sin debilitar la aserción. */
  subseq?: boolean;
  /** Modo subseq: nº máximo de tiradas a producir (cubrir la traza). */
  subseqCap?: number;
  /**
   * Fixture combat+spells (#44): en el PRIMER turno del PJ actor (el del
   * `actorSlot`), en vez de pasar, LANZA este hechizo — `castSpell` corre el
   * dispatcher sobre `combat.rng` (mismo stream) y `playerCast` aplica el efecto
   * (terremoto/línea/ataque). Así la traza incluye las tiradas del hechizo
   * (rand30 del saving + daño) para casarlas contra el oráculo. `spellIndex` =
   * índice 0..47; `aimX/aimY` = celda apuntada (proyectil/línea). Las cantidades
   * mezcladas / MP / nivel se fuerzan permisivos en el replay (los gates exactos
   * los fija el snapshot del oráculo; lo que se valida es el ORDEN de tiradas). */
  castAction?: { spellIndex: number; aimX?: number; aimY?: number };
}

const HERE_DIR = dirname(fileURLToPath(import.meta.url));
const spellDefs = buildSpellDefs(
  JSON.parse(
    readFileSync(resolve(HERE_DIR, "../data/MagicDefinitions.json"), "utf8").replace(/^﻿/, ""),
  ) as MagicDefsJson,
);

class StopReplay extends Error {}

/** RNG que corre LIBRE y registra cada tirada (modo subseq). La semilla
 *  registrada es la de ANTES de la tirada (== g_rng_seed del binario en ese
 *  punto): el comparador casa la traza por esa semilla. */
class LoggingRng extends OriginalRng {
  readonly log: { seed: number; lo: number; hi: number }[] = [];
  onBefore: (() => void) | null = null;

  constructor(seed: number) {
    super(seed);
  }

  override next(lo: number, hi: number): number {
    this.onBefore?.();
    this.log.push({ seed: this.getSeed(), lo, hi });
    return super.next(lo, hi);
  }
}

/** RNG que reproduce la traza del binario (ver docstring del módulo). */
class TracingRng extends OriginalRng {
  armed = false;
  i = 0;
  readonly mismatches: {
    i: number;
    wantLo: number;
    wantHi: number;
    gotLo: number;
    gotHi: number;
  }[] = [];
  onRoll: (() => void) | null = null;

  constructor(private readonly trace: TraceEntry[]) {
    super(0);
  }

  override next(lo: number, hi: number): number {
    if (!this.armed) return super.next(lo, hi);
    if (this.i >= this.trace.length) throw new StopReplay();
    const e = this.trace[this.i]!;
    if (e.lo !== lo || e.hi !== hi) {
      this.mismatches.push({ i: this.i, wantLo: e.lo, wantHi: e.hi, gotLo: lo, gotHi: hi });
    }
    this.onRoll?.();
    this.seed(e.seed); // alinea con la semilla observada ANTES del roll
    this.i++;
    return super.next(lo, hi);
  }
}

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
const readJson = <T>(p: string): T =>
  JSON.parse(readFileSync(`${ASSETS}/${p}`, "utf-8")) as T;

/** Mapa desde la arena real: celdas bloqueadas → tile -1 (no transitable
 *  para el motor), transitables → tile 5 (Grass). El bitmap del kernel
 *  (DS:0x54D4) marca con bit=1 los tiles bloqueados a pie. */
function arenaMap(arena: number[][], passBitmap: number[]): CombatMapData {
  // Orden de bits EXACTO de kernel_pass_on_foot (kernel 0x2BD4, 2bda-2bf4):
  // máscara = 0x80 >> (tile & 7) (MSB-first); bit a 1 = tile BLOQUEADO.
  const blocked = (t: number): boolean =>
    ((passBitmap[t >> 3]! >> (7 - (t & 7))) & 1) === 1;
  const tiles = arena.map((row) => row.map((t) => (blocked(t) ? -1 : 5)));
  const starts = [{ x: 5, y: 5 }];
  const units = Array.from({ length: 16 }, (_, i) => ({
    sprite: 0,
    x: i % 11,
    y: Math.floor(i / 11) + 8,
  }));
  return {
    index: -1,
    territory: "parity",
    name: "parity",
    tiles,
    playerStarts: { east: starts, west: starts, north: starts, south: starts },
    units,
    triggers: [],
  };
}

function syntheticMap(): CombatMapData {
  // Tablero abierto: tile 5 (Grass, transitable). El combate de la choza no
  // tiene obstáculos en juego; la ocupación la dan los propios combatientes.
  const row = (): number[] => new Array(11).fill(5);
  const tiles: number[][] = [];
  for (let y = 0; y < 11; y++) tiles.push(row());
  const starts = [{ x: 5, y: 5 }];
  // 16 slots de map-unit de relleno: la posición real se parchea después
  // desde los registros del binario.
  const units = Array.from({ length: 16 }, (_, i) => ({
    sprite: 0,
    x: i % 11,
    y: Math.floor(i / 11) + 8,
  }));
  return {
    index: -1,
    territory: "parity",
    name: "parity",
    tiles,
    playerStarts: { east: starts, west: starts, north: starts, south: starts },
    units,
    triggers: [],
  };
}

function main(): void {
  const raw = process.argv[2];
  if (!raw) throw new Error("uso: tsx combat-run.ts '<payload JSON>'");
  const input = JSON.parse(raw) as Input;

  const data = readJson<EnemyDataInput & { defenseValues: number[]; spellAttackRange: number[] }>(
    "data.json",
  );
  const additional = JSON.parse(
    readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../data/AdditionalEnemyFlags.json"),
      "utf-8",
    ),
  ) as AdditionalEnemyFlag[];
  const enemyDefs = buildEnemyDefs(data, additional);

  // Estado base + roster del oráculo.
  const state = createNewGame(readJson<ExtractedInitialState>("initial-state.json"));
  state.food = input.food;
  input.roster.forEach((r, i) => {
    const ch = state.characters[i];
    if (!ch) throw new Error(`roster[${i}] sin registro base`);
    ch.status = r.status;
    ch.strength = r.str;
    ch.dexterity = r.dex;
    ch.intelligence = r.int;
    ch.currentHp = r.hp;
    ch.maxHp = r.maxHp;
  });

  const playerRecs = input.records.filter((r) => r.kind === "player");
  const enemyRecs = input.records.filter((r) => r.kind === "enemy");

  const party: PartyCombatant[] = playerRecs.map((rec) => ({
    charIdx: rec.ref,
    record: state.characters[rec.ref]!,
    weapons: [{ id: 0xff, attack: 1, range: 1 }], // este escenario solo pasa turno
  }));

  const free = input.mode === "free";
  const subseq = input.subseq === true;
  const traceRng = new TracingRng(input.trace);
  const logRng = subseq ? new LoggingRng(input.seed) : null;
  const rng = traceRng;
  const combat = new Combat({
    map: free && input.arena && input.passBitmap
      ? arenaMap(input.arena, input.passBitmap)
      : syntheticMap(),
    entryDirection: "east",
    party,
    enemies: enemyRecs.map((rec) => ({ def: enemyDefs[rec.ref]!, count: 1 })),
    seed: input.seed,
    state,
    spellAttackRange: data.spellAttackRange,
    enemyDefs,
  });
  // Sustituye el RNG interno por el trazador (o el logger en modo subseq;
  // los rolls del setup ya ocurrieron en el binario ANTES de la instantánea).
  (combat.rng as unknown as { rng: OriginalRng }).rng = logRng ?? rng;

  // Parchea los combatientes con la instantánea EXACTA del binario
  // (posición, HP, velocidad y countdown de iniciativa, flags).
  const ordered = [...playerRecs, ...enemyRecs];
  ordered.forEach((rec, i) => {
    const c = combat.combatants[i];
    if (!c) throw new Error(`combatants[${i}] ausente`);
    c.x = rec.x;
    c.y = rec.y;
    c.speed = rec.speed;
    c.counter = rec.counter;
    c.sleeping = (rec.flags & 8) !== 0;
    c.charmed = (rec.flags & 1) !== 0;
    c.invisible = (rec.flags & 0x10) !== 0;
    if (c.kind === "enemy") {
      c.hp = rec.hp;
    } else {
      c.defense = input.roster[rec.ref]?.defense ?? 0;
    }
  });
  // El snapshot se toma con el turno de `actorSlot` YA ABIERTO (esperando
  // input, countdown ya recargado): se retoma la iniciativa desde ahí.
  const actorIdx = ordered.findIndex((rec) => rec.slot === input.actorSlot);
  if (actorIdx >= 0) {
    (combat as unknown as { currentActor: unknown }).currentActor =
      combat.combatants[actorIdx];
    (combat as unknown as { scanIdx: number }).scanIdx =
      (actorIdx + 1) % ordered.length;
  } else {
    (combat as unknown as { scanIdx: number }).scanIdx = 0;
  }

  // Turno del PJ: LANZA el hechizo del fixture en el primer turno del actor
  // (una vez), o pasa. `castSpell` corre sobre el MISMO `combat.rng` (stream
  // compartido) → sus tiradas entran en la traza a validar.
  let castFired = false;
  const drivePlayer = (): void => {
    const ca = input.castAction;
    const cur = combat.currentUnit;
    if (ca && !castFired && cur && cur.kind === "player" && cur.charIdx !== undefined) {
      castFired = true;
      const rec = state.characters[cur.charIdx]!;
      // Gates permisivos (el snapshot del oráculo fija los exactos; se valida el orden).
      state.spellQuantities[ca.spellIndex] = Math.max(state.spellQuantities[ca.spellIndex] ?? 0, 99);
      rec.currentMp = Math.max(rec.currentMp, 99);
      rec.level = Math.max(rec.level, 8);
      const r = castSpell(
        state,
        rec,
        spellDefs[ca.spellIndex]!,
        { location: 0, inCombat: true },
        combat.rng,
      );
      const aim = ca.aimX !== undefined && ca.aimY !== undefined
        ? { x: ca.aimX, y: ca.aimY }
        : null;
      combat.playerCast(r.effect, aim);
      return;
    }
    combat.playerPass();
  };

  if (free) {
    rng.seed(input.seed);
  }
  const partyHpAtRoll: number[][] = [];
  const enemiesAtRoll: { slot: number; hp: number; x: number; y: number }[][] = [];
  const partyHpNow = (): number[] =>
    state.characters.slice(0, input.roster.length).map((c) => c.currentHp);
  const slotOf = new Map<number, number>();
  ordered.forEach((rec, i) => slotOf.set(i, rec.slot));
  const enemiesNow = (): { slot: number; hp: number; x: number; y: number }[] =>
    combat.combatants
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.kind === "enemy" && slotOf.has(i) &&
        c.status !== "dead" && c.status !== "fled")
      .map(({ c, i }) => ({ slot: slotOf.get(i)!, hp: c.hp, x: c.x, y: c.y }));

  // ---- Modo SUBSEQ: corre libre y registra cada tirada (seed+rango+estado) ----
  if (subseq) {
    logRng!.onBefore = () => {
      partyHpAtRoll.push(partyHpNow());
      enemiesAtRoll.push(enemiesNow());
    };
    const cap = input.subseqCap ?? 300;
    let guard = 0;
    while (logRng!.log.length < cap && guard++ < 20000) {
      if (combat.over) break;
      const cur = combat.currentUnit;
      if (!cur) break;
      if (cur.kind === "player" && !cur.charmed) {
        drivePlayer();
      } else {
        combat.tickEnemyTurns();
      }
    }
    console.log(
      JSON.stringify({
        subseq: true,
        rolls: logRng!.log, // [{seed,lo,hi}] en orden
        partyHpAtRoll, // estado ANTES de cada tirada (alineado con rolls)
        enemiesAtRoll,
        finalPartyHp: partyHpNow(),
        food: state.food,
      }),
    );
    return;
  }

  rng.onRoll = () => {
    partyHpAtRoll.push(partyHpNow());
    enemiesAtRoll.push(enemiesNow());
  };
  rng.armed = !free;

  let actions = 0;
  let seedMatched = false;
  const seedTrace: number[] = [];
  const rollTags: string[] = [];
  if (free) {
    // Log de diagnóstico: semilla ANTES de cada tirada + actor y rango
    // (se compara con la secuencia observada en el binario).
    const origNext = rng.next.bind(rng);
    let lastActor = "";
    rng.next = (lo: number, hi: number): number => {
      seedTrace.push(rng.getSeed());
      partyHpAtRoll.push(partyHpNow());
      enemiesAtRoll.push(enemiesNow());
      const hp = state.characters.slice(0, input.roster.length)
        .map((c) => `${c.currentHp}${c.status}`).join("/");
      rollTags.push(`${lastActor} rand(${lo},${hi}) hp=${hp}`);
      return origNext(lo, hi);
    };
    const target = input.targetSeed ?? -1;
    seedMatched = rng.getSeed() === target;
    while (!seedMatched && actions < 3000 && !combat.over) {
      const cur = combat.currentUnit;
      if (!cur) break;
      lastActor = `${cur.kind}#${cur.id}@${cur.x},${cur.y}`;
      if (cur.kind === "player" && !cur.charmed) {
        drivePlayer();
      } else {
        combat.tickEnemyTurns();
      }
      actions++;
      seedMatched = rng.getSeed() === target;
    }
  } else {
    try {
      let guard = 0;
      while (rng.i < input.trace.length && guard++ < 4000) {
        if (combat.over) break;
        const cur = combat.currentUnit;
        if (!cur) break;
        if (cur.kind === "player" && !cur.charmed) {
          drivePlayer();
        } else {
          combat.tickEnemyTurns();
        }
      }
    } catch (err) {
      if (!(err instanceof StopReplay)) throw err;
    }
  }

  const finalEnemies = enemiesAtRoll.length > 0
    ? enemiesAtRoll[enemiesAtRoll.length - 1]!
    : enemiesNow();

  console.log(
    JSON.stringify({
      rolls: rng.i,
      mismatches: rng.mismatches,
      partyHpAtRoll,
      enemiesAtRoll,
      finalPartyHp: partyHpNow(),
      finalEnemies: free ? enemiesNow() : finalEnemies,
      food: state.food,
      actions,
      seedMatched,
      finalSeed: rng.getSeed(),
      seedTrace,
      rollTags,
    }),
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`combat-run: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}
