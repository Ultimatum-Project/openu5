/**
 * Runner de paridad de GUARDIAS / CÁRCEL / BLACKTHORN (Task 3.10). Reproduce el
 * core del clon (world/blackthorn.ts) para cruzarlo contra el modelo asm-derivado
 * en Python (re/tools/blackthorn_parity.py). Mismo patrón que shrines-run.ts.
 *
 * Salvo la merma de la Falsedad (rand del kernel), todas las mecánicas son
 * deterministas → la paridad es de VALOR, no de stream.
 *
 * Escenario JSON como único argumento CLI, con `kind`:
 *   "conscious":  {party:["G","S",...]}                     → {state}
 *   "trigger":    {location, party}                          → {triggers}
 *   "pickShrine": {shrineDestroyed:[8]}                      → {shrine}
 *   "interrogate":{numLiving, subj, mantra, responses[], karma, party?}
 *        → {outcome, shrineCeded, sacrificed, rewardedWithLife, clockMinutes,
 *           roundsAsked, karmaAfter, partySizeAfter, shrineByteAfter}
 *   "capture":    {party, shrineDestroyed, keys, gold, responses[], mantras[]}
 *        → {shrine, outcome?, location, x, y, keys, transportTile, partySizeAfter}
 *   "refuge":     {party, karma, food}
 *        → {revived, foodRefilled, karmaAfter, location, floor, x, y, transportTile, hour, food}
 *   "merma":      {shadowlordLocs:[3], location, gold, roll}  → {drained, goldAfter}
 *   "guard":      {location, party, response, agree, gold}    → {kind, ret, goldTaken, goldAfter}
 *   "guardArms":  {party, npcs:[{slot,type,aiTypes,times,dialogNumber,dx,dy,dz}]}
 *        → {armedByHour:[24 bool]}   — #64, el ARMADO del slot [0x65bf] hora a hora
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { CharacterState, GameState } from "../state.js";
import { checkBlackthornCapture, type CaptureCtx } from "../world/blackthorn-capture.js";
import { instalaDsStrings, type DsStrings } from "../data/ds-strings.js";
import type { NpcManager, NpcRuntime } from "../npc/manager.js";
import {
  blackthornCapture,
  blackthornCaptureTriggers,
  guardDemand,
  partyConsciousState,
  partyRefuge,
  pickInterrogationShrine,
  postPurchaseGoldDrain,
  runInterrogation,
  TIME_SPELL_BADGE,
} from "../world/blackthorn.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

function char(status: string, name = ""): CharacterState {
  return {
    name,
    gender: 0x0b,
    class: "A",
    status,
    strength: 15,
    dexterity: 15,
    intelligence: 15,
    currentMp: 0,
    currentHp: status === "D" ? 0 : 30,
    maxHp: 30,
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

function stub(fields: Partial<GameState>): GameState {
  return {
    version: 1,
    gold: 0,
    keys: 0,
    karma: 0,
    food: 0,
    partySize: 0,
    characters: [],
    position: { location: 0, floor: 0, x: 0, y: 0 },
    transport: "foot",
    time: { year: 139, month: 1, day: 1, hour: 12, minute: 0 },
    ...fields,
  } as GameState;
}

function partyFrom(statuses: string[]): CharacterState[] {
  return statuses.map((s, i) => char(s, `M${i}`));
}

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");

// Mensajes del búfer DS 0xB21E (FICHA β): en el juego los instala el arranque tras
// `fetchJson`; aquí no hay arranque, así que este runner —que ejercita la ESCENA de
// captura, no sólo el motor puro— los instala desde el mismo `game/assets` del que ya
// lee `data.json`. Sin esto, `guardArms` revienta al pintar el monólogo del trono.
instalaDsStrings(
  JSON.parse(readFileSync(`${ASSETS}/ds-strings.json`, "utf-8")) as DsStrings,
);

function mantrasFromData(): string[] {
  return (JSON.parse(readFileSync(`${ASSETS}/data.json`, "utf-8")) as { mantras: string[] }).mantras;
}

type Runner = (spec: Record<string, unknown>) => unknown;

const RUNNERS: Record<string, Runner> = {
  conscious: (s) => {
    const chars = partyFrom((s.party as string[]) ?? []);
    const st = stub({ characters: chars, partySize: chars.length });
    return { state: partyConsciousState(st) };
  },
  trigger: (s) => {
    const chars = partyFrom((s.party as string[]) ?? []);
    const st = stub({
      characters: chars,
      partySize: chars.length,
      position: { location: Number(s.location ?? 0), floor: 0, x: 0, y: 0 },
    });
    return { triggers: blackthornCaptureTriggers(st) };
  },
  pickShrine: (s) => {
    const st = stub({ shrineDestroyed: (s.shrineDestroyed as number[]) ?? [] });
    return { shrine: pickInterrogationShrine(st) };
  },
  interrogate: (s) => {
    const statuses = (s.party as string[]) ?? ["G", "G", "G"];
    const chars = partyFrom(statuses);
    const st = stub({
      characters: chars,
      partySize: chars.length,
      karma: Number(s.karma ?? 50),
      shrineDestroyed: new Array(8).fill(0),
    });
    const subj = Number(s.subj ?? 0);
    const res = runInterrogation(
      st,
      Number(s.numLiving ?? statuses.filter((x) => x !== "D").length),
      subj,
      String(s.mantra ?? ""),
      (s.responses as string[]) ?? [],
    );
    return {
      outcome: res.outcome,
      shrineCeded: res.shrineCeded,
      sacrificed: res.sacrificed,
      rewardedWithLife: res.rewardedWithLife,
      clockMinutes: res.clockMinutes,
      roundsAsked: res.roundsAsked,
      karmaAfter: st.karma,
      partySizeAfter: st.partySize,
      shrineByteAfter: (st.shrineDestroyed ?? [])[subj] ?? 0,
    };
  },
  capture: (s) => {
    const chars = partyFrom((s.party as string[]) ?? ["G", "G", "G"]);
    const st = stub({
      characters: chars,
      partySize: chars.length,
      keys: Number(s.keys ?? 5),
      gold: Number(s.gold ?? 100),
      karma: Number(s.karma ?? 50),
      shrineDestroyed: (s.shrineDestroyed as number[]) ?? new Array(8).fill(0),
      position: { location: 0, floor: 0, x: 0, y: 0 },
    });
    const res = blackthornCapture(
      st,
      (s.responses as string[]) ?? [],
      (s.mantras as string[]) ?? mantrasFromData(),
    );
    return {
      shrine: res.shrine,
      outcome: res.interrogation?.outcome ?? null,
      location: st.position.location,
      x: st.position.x,
      y: st.position.y,
      keys: st.keys,
      transportTile: st.transportTile,
      partySizeAfter: st.partySize,
      karmaAfter: st.karma,
    };
  },
  refuge: (s) => {
    const chars = partyFrom((s.party as string[]) ?? ["D", "D", "D"]);
    const st = stub({
      characters: chars,
      partySize: chars.length,
      karma: Number(s.karma ?? 20),
      food: Number(s.food ?? 0),
      position: { location: Number(s.location ?? 6), floor: 0, x: 5, y: 5 },
      time: { year: 139, month: 1, day: 1, hour: Number(s.hour ?? 12), minute: 30 },
    });
    const res = partyRefuge(st);
    return {
      revived: res.revived,
      foodRefilled: res.foodRefilled,
      karmaAfter: st.karma,
      location: st.position.location,
      floor: st.position.floor,
      x: st.position.x,
      y: st.position.y,
      transportTile: st.transportTile,
      hour: st.time.hour,
      food: st.food,
      allAlive: st.characters.every((c) => c.status !== "D"),
    };
  },
  merma: (s) => {
    const st = stub({
      gold: Number(s.gold ?? 100),
      shadowlordLocs: (s.shadowlordLocs as number[]) ?? [],
      position: { location: Number(s.location ?? 0), floor: 0, x: 0, y: 0 },
    });
    const drained = postPurchaseGoldDrain(st, Number(s.roll ?? 0));
    return { drained, goldAfter: st.gold };
  },
  guard: (s) => {
    const chars = partyFrom((s.party as string[]) ?? ["G"]);
    const st = stub({
      characters: chars,
      partySize: chars.length,
      gold: Number(s.gold ?? 100),
      position: { location: Number(s.location ?? 0), floor: 0, x: 0, y: 0 },
      // #277: el gate del Palacio (TALK 0x02a4 `cmp [g_time_spell],0x1d`) es la Black
      // Badge PUESTA. Sin este campo el escenario NO PODÍA armar la rama del password:
      // el clon caía siempre por `jmp 0x216` y el careo salía rojo contra un modelo
      // que ignoraba el gate.
      timeSpell: s.badge ? TIME_SPELL_BADGE : undefined,
    });
    const res = guardDemand(st, String(s.response ?? ""), Boolean(s.agree));
    return { kind: res.kind, ret: res.ret, goldTaken: res.goldTaken, goldAfter: st.gold };
  },
  /**
   * #64 — ARMADO del slot `[0x65bf]`, hora a hora. Entra por
   * `checkBlackthornCapture`, que es el camino REAL: pasa por `palaceGuards()` (donde
   * el port aplica `scheduleIndex`) y por `palaceGuardAdjacent`/`armaElSlot`. NO se
   * reconstruye aquí el mapeo hora→aiType a propósito: hacerlo cruzaría el modelo
   * contra una copia del cableado en vez de contra el cableado.
   *
   * Las otras puertas quedan FIJAS (loc 0x12, party del spec, sin insignia y sin capa
   * de prompt) para que la única variable libre sea el armado. Estado NUEVO por hora:
   * la escena de captura muta el estado, y reutilizarlo contaminaría la hora siguiente.
   */
  guardArms: (s) => {
    const npcs = (s.npcs as Record<string, unknown>[]) ?? [];
    const armedByHour: boolean[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const chars = partyFrom((s.party as string[]) ?? ["G"]);
      const st = stub({
        characters: chars,
        partySize: chars.length,
        position: { location: 0x12, floor: 0, x: 5, y: 5 },
        time: { year: 139, month: 1, day: 1, hour, minute: 0 },
      });
      const runtimes = npcs.map((n) => ({
        slot: Number(n.slot ?? 0),
        type: Number(n.type ?? 0x70),
        dialogNumber: Number(n.dialogNumber ?? 0xff),
        aiTypes: n.aiTypes as [number, number, number],
        times: n.times as [number, number, number, number],
        x: st.position.x + Number(n.dx ?? 0),
        y: st.position.y + Number(n.dy ?? 0),
        z: st.position.floor + Number(n.dz ?? 0),
      })) as unknown as NpcRuntime[];
      const mgr = {
        setRng() {}, enterMap() {}, tick() {},
        npcsAt: (loc: number, floor: number) =>
          loc === 0x12 ? runtimes.filter((n) => n.z === floor) : [],
        npcAt: () => null,
      } as unknown as NpcManager;
      const ctx: CaptureCtx = {
        state: st,
        npcManager: mgr,
        shrines: { mantras: mantrasFromData() },
        pending: { current: null },
      };
      armedByHour.push(checkBlackthornCapture(ctx) !== null);
    }
    return { armedByHour };
  },
};

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write("uso: blackthorn-run.ts '<json>'\n");
    process.exit(1);
  }
  const spec = JSON.parse(arg) as { kind: string } & Record<string, unknown>;
  const runner = RUNNERS[spec.kind];
  if (!runner) {
    process.stderr.write(`kind desconocido: ${spec.kind}\n`);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(runner(spec)) + "\n");
}

main();
