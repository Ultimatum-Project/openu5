/**
 * Runner de paridad de COMANDOS SUELTOS (Task 3.9). Reproduce en el core del
 * clon una acción RNG-rica de CMDS/SJOG (Klimb-garfio, Jimmy, trampa de cofre,
 * botín de cofre mundo/mazmorra, Ignite) partiendo de una semilla del RNG EXACTO
 * del kernel, y emite el estado observable + la semilla final. El lado DOSBox
 * siembra la misma semilla y lee los mismos globales, de modo que el STREAM de
 * rand y el estado deben calcar.
 *
 * Entrada (argv[2], JSON): { seed, action, ...campos }
 *   action: "klimb" | "jimmy" | "trap" | "loot" | "dungeonLoot" | "ignite"
 * Salida (stdout, última línea): objeto por acción (ver más abajo).
 */
import type { CharacterState, GameState } from "../state.js";
import { OriginalRng } from "../rng-original.js";
import type { RandFn } from "../world/survival.js";
import { igniteTorch } from "../world/survival.js";
import {
  chestLoot,
  chestTrap,
  dungeonChestLoot,
  jimmyLock,
  klimbGrapple,
  type LockKind,
} from "../world/commands.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

interface MemberIn {
  dex?: number;
  hp?: number;
  maxHp?: number;
  status?: string;
  name?: string;
}

function char(r: MemberIn): CharacterState {
  return {
    name: r.name ?? "",
    gender: 0x0b,
    class: "F",
    status: r.status ?? "G",
    strength: 15,
    dexterity: r.dex ?? 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: r.hp ?? 30,
    maxHp: r.maxHp ?? 30,
    exp: 0,
    level: 1,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
  };
}

function partyOut(members: CharacterState[]) {
  return members.map((c) => ({ hp: c.currentHp, status: c.status }));
}

function main(): void {
  const input = JSON.parse(process.argv[2] ?? "{}") as Record<string, unknown>;
  const seed = Number(input.seed ?? 0);
  const rng = new OriginalRng(seed);
  const rand: RandFn = (lo, hi) => rng.next(lo, hi);
  let out: Record<string, unknown>;

  switch (input.action) {
    case "klimb": {
      const members = ((input.members as MemberIn[]) ?? []).map(char);
      const res = klimbGrapple(members, rand);
      out = { falls: res.falls, messages: res.messages, party: partyOut(members) };
      break;
    }
    case "jimmy": {
      const res = jimmyLock(
        {
          kind: input.kind as LockKind,
          tile: Number(input.tile ?? 0),
          dex: Number(input.dex ?? 15),
          floor: Number(input.floor ?? 0),
          location: Number(input.location ?? 0),
        },
        rand,
      );
      out = {
        success: res.success,
        keyBroke: res.keyBroke,
        newTile: res.newTile,
        message: res.message,
      };
      if (res.freed !== undefined) out.freed = res.freed;
      if (res.karmaDelta !== undefined) out.karmaDelta = res.karmaDelta;
      break;
    }
    case "trap": {
      const members = ((input.members as MemberIn[]) ?? []).map(char);
      // g_party_size: los escenarios que no lo declaran son «todo el roster va en el
      // grupo» (que es lo que valía antes de acotar) — mismo default en cmds_parity.py.
      const partySize = Number(input.partySize ?? members.length);
      const res = chestTrap(
        Number(input.location ?? 0),
        Number(input.opener ?? 0),
        members,
        rand,
        partySize,
      );
      out = { type: res.type, message: res.message, party: partyOut(members) };
      break;
    }
    case "loot": {
      const grants = chestLoot(Number(input.contents ?? 0), rand);
      out = { grants };
      break;
    }
    case "dungeonLoot": {
      const grants = dungeonChestLoot(Number(input.floor ?? 0), rand);
      out = { grants };
      break;
    }
    case "ignite": {
      const state = {
        version: 1,
        torches: Number(input.torches ?? 1),
        torchTurns: Number(input.torchTurns ?? 0),
        position: { location: Number(input.location ?? 0), floor: 0, x: 0, y: 0 },
      } as unknown as GameState;
      const message = igniteTorch(state, rand);
      out = { torchTurns: state.torchTurns, torches: state.torches, message };
      break;
    }
    default:
      process.stderr.write(`acción desconocida: ${String(input.action)}\n`);
      process.exit(1);
  }

  out.seedAfter = rng.getSeed();
  process.stdout.write(JSON.stringify(out) + "\n");
}

main();
