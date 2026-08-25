/**
 * Runner de paridad de SANTUARIOS / MANTRAS / POZO / MOONGATES (Task 3.8):
 * reproduce el core del clon (world/shrines.ts, world/wishingwell.ts,
 * world/moongates.ts) para cruzarlo contra el modelo asm-derivado en Python
 * (re/tools/shrines_parity.py). Mismo patrón que transport-run.ts / npc-run.ts.
 *
 * Ninguna mecánica consume RNG: la paridad es de VALOR determinista.
 *
 * Escenario JSON como único argumento CLI, con `kind`:
 *   "moongate": {day, hour, minute, moonstones:[{x,y,buried,z}]}
 *       → {teleported, phase?, x?, y?, z?, reason?}
 *   "donation": {gold, karma, cycles}     → {accepted, gold, karma, cost}
 *   "quest":    {virtue, karma, str, dex, int}
 *       → {karma, str, dex, int, attrs:[...]}
 *   "restore":  {virtue, typedVirtue, typedMantras:[3], x, y}  → {restored}
 *   "wish":     {gold, wish, location}     → {kind, gold}
 *
 * Salida: una línea JSON a stdout. Errores por stderr, exit 1.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { CharacterState, GameState } from "../state.js";
import {
  activeGatePhase,
  moongateDestination,
  isMidnightGateEdge,
} from "../world/moongates.js";
import {
  shrineMode,
  shrineShowMantra,
  shrineCodexLesson,
  shrineDonate,
  shrineCompleteQuest,
  shrineRestore,
  type ShrineData,
} from "../world/shrines.js";
import { wishingWell } from "../world/wishingwell.js";

declare const process: {
  argv: string[];
  stderr: { write(chunk: string): void };
  exit(code?: number): never;
};

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");
function shrineData(): ShrineData {
  const d = JSON.parse(readFileSync(`${ASSETS}/data.json`, "utf-8")) as {
    virtues: string[];
    mantras: string[];
    shrineX: number[];
    shrineY: number[];
  };
  return { virtues: d.virtues, mantras: d.mantras, shrineX: d.shrineX, shrineY: d.shrineY };
}
function moonPhasesRaw(): number[] {
  return (JSON.parse(readFileSync(`${ASSETS}/data.json`, "utf-8")) as { moonPhases: number[] })
    .moonPhases;
}

function stub(fields: Partial<GameState>): GameState {
  return { gold: 0, karma: 0, ...fields } as GameState;
}

interface Moonstone {
  x: number;
  y: number;
  buried: boolean;
  z: number;
  location: number;
}

/**
 * El escenario llega por `JSON.parse(argv[2])`, así que la interfaz `Moonstone` de arriba
 * es una PROMESA QUE NADIE COMPRUEBA: `tsc` tipa el parseo, no el fichero.
 *
 * 🔴 Y el campo que se cae es el que decide. `buried` y `location` son las DOS CARAS del
 * MISMO byte del `.GAM` (`DS 0x5840` = `.GAM +0x29a`; `buried ⇔ location != 0xFF` —
 * saveNative.ts:374 al leer y :892 al escribir), pero cada consumidor lee una: el modelo
 * Python de `shrines_parity.predict_moongate` mira `buried` y `moonstoneDestination`
 * (calco de `ULTIMA.EXE:0x47fd cmp byte [bx+0x5840],0xff`) mira `location`. Con el campo
 * AUSENTE, `undefined === 0xff` es `false` ⇒ una piedra con `buried:false` se lee como
 * ENTERRADA y la puerta teleporta a una piedra que llevas en la mochila.
 *
 * No es hipotético: es el rojo que `test_shrines_parity[moongate-dug-up]` llevaba desde
 * `44a31faa` (19-08), cuando #352 cambió el centinela de `buried` a `location` y los siete
 * escenarios —escritos antes de que #143a/`bd00b433` diera el campo a la piedra— se
 * quedaron sin él. Los otros seis pasaban POR CASUALIDAD: todas sus piedras son
 * `buried:true` y `undefined !== 0xff` acierta por el lado bueno.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * ★★ EL DEFECTO ES DE ESTE FIXTURE, NO DEL JUEGO — Y ESTÁ MEDIDO, NO INFERIDO (25-08).
 * ════════════════════════════════════════════════════════════════════════════════════
 * La pregunta que hay que separar antes de asustarse: ¿un jugador con una piedra lunar en
 * la mochila acaba HOY teletransportado donde no debe? Medido sobre el `Game` REAL, por
 * `move()` —la ruta del jugador, no este runner— con día 15 a las 22:00 (fase activa = 4 =
 * Minoc) y el party al oeste de la puerta de Britain:
 *
 *   EXP0 · CONTROL POSITIVO, nada en la mochila ... pisa y va a (166,19). El instrumento
 *          SÍ sabe ver un teleport; sin esto, el «no teleporta» de EXP1 no valdría nada.
 *   EXP1 · PRODUCCIÓN: `digUpMoonstone(st,166,19,0)` deja `buried=false, location=0xFF`;
 *          pisar la puerta de Britain deja al party QUIETO en (96,102). Es exactamente el
 *          binario (0x47fd `cmp …,0xff` → 0x4804 `sub ax,ax` = fracaso sin tocar estado).
 *   EXP2 · Par CONTRADICTORIO fabricado A MANO (`buried=false` y `location` intacto):
 *          teleporta a la piedra de la MOCHILA. El modo de fallo existe…
 *   EXP3 · …pero NO es alcanzable. El ciclo completo (inicial → desenterrar → re-enterrar
 *          en otra localización) deja las 8 piedras coherentes, y las CUATRO vías por las
 *          que un estado entra al juego traen el par sincronizado por construcción:
 *          `initial-state.json` (8/8 con `location`, 8/8 coherentes), `parseSaveWindow`
 *          (las dos caras salen del MISMO byte `gam[0x29a+i]`), la escritura de vuelta
 *          (`saveNative:892`, `m.buried ? m.location : 0xff`) y los cinco escritores de
 *          `.buried` del árbol, que mueven las dos a la vez. `demo-byo` sólo LEE.
 *
 * ⇒ Veredicto: (a) FIXTURE. El port es fiel y la conducta de juego es correcta — de hecho
 *   ya tenía su testigo de producción, verde y con control: `moongates.test.ts` «pisar una
 *   puerta con la piedra ACTIVA en la mochila: cierra, suena y NO teleporta» + el CONTROL
 *   de al lado. Lo que faltaba era que el fixture de paridad describiera un estado POSIBLE.
 *   EXP2 es justo la razón de que abajo se ABORTE en vez de rellenar: el día que alguna vía
 *   nueva produzca el par a medias, se quiere un error con nombre, no un teleport callado.
 *
 * Por eso el runner ABORTA en vez de completar el campo a la callada: un default aquí
 * volvería a hacer pasar al escenario incompleto, que es exactamente el fallo que se está
 * cerrando. Y comprueba las DOS caras contra el convenio del binario, no sólo la presencia:
 * un escenario que las contradiga describe un estado que el códec no puede escribir.
 */
function exigirParParaLaPiedra(m: Moonstone, i: number): void {
  if (typeof m.location !== "number") {
    throw new Error(
      `moonstone ${i}: falta el campo \`location\` (el byte DS 0x5840 / .GAM +0x29a). ` +
        `Sin él el centinela 0x47fd (\`location === 0xff\`) lee la piedra como ENTERRADA ` +
        `sea cual sea \`buried\`. Escribe 0xFF si está en la mochila, o la localización ` +
        `donde se enterró (0 = sobremundo).`,
    );
  }
  if (m.buried !== (m.location !== 0xff)) {
    throw new Error(
      `moonstone ${i}: \`buried\`=${m.buried} contradice \`location\`=0x${m.location
        .toString(16)
        .padStart(2, "0")}. Son las DOS CARAS del mismo byte: buried ⇔ location != 0xFF.`,
    );
  }
}

function runMoongate(spec: {
  day: number;
  hour: number;
  minute: number;
  moonstones: Moonstone[];
}): unknown {
  // Reproduce EXACTAMENTE la ruta de Game.checkMoongate llamando a las funciones
  // reales del clon (activeGatePhase / isMidnightGateEdge / moongateDestination).
  spec.moonstones.forEach(exigirParParaLaPiedra);
  const time = { year: 139, month: 1, day: spec.day, hour: spec.hour, minute: spec.minute };
  const state = stub({ moonstones: spec.moonstones });
  const raw = moonPhasesRaw();
  const phase = activeGatePhase(time, raw, state);
  if (phase === null) return { teleported: false, reason: "daylight" };
  if (isMidnightGateEdge(time)) return { teleported: false, reason: "midnight-edge" };
  const dest = moongateDestination(state, time, raw);
  if (!dest) return { teleported: false, reason: "in-inventory" };
  return { teleported: true, phase, x: dest.x, y: dest.y, z: dest.z };
}

function runFlow(spec: {
  virtue: number;
  questBitmap?: number;
  visitedBitmap?: number;
  action: "mode" | "show-mantra" | "codex" | "complete";
}): unknown {
  const st = stub({
    karma: 50,
    shrineQuestBitmap: spec.questBitmap ?? 0,
    shrineVisitedBitmap: spec.visitedBitmap ?? 0,
  });
  const v = spec.virtue;
  if (spec.action === "mode") return { mode: shrineMode(st, v) };
  if (spec.action === "show-mantra") {
    shrineShowMantra(st, v, shrineData());
    return {
      questBitmap: st.shrineQuestBitmap ?? 0,
      visitedBitmap: st.shrineVisitedBitmap ?? 0,
      mode: shrineMode(st, v),
    };
  }
  if (spec.action === "codex") {
    const r = shrineCodexLesson(st);
    return {
      virtue: r.virtue,
      questBitmap: st.shrineQuestBitmap ?? 0,
      visitedBitmap: st.shrineVisitedBitmap ?? 0,
      ceremony: r.ceremony,
    };
  }
  // complete
  shrineCompleteQuest(st, v, { strength: 15, dexterity: 15, intelligence: 15 } as CharacterState);
  return {
    questBitmap: st.shrineQuestBitmap ?? 0,
    visitedBitmap: st.shrineVisitedBitmap ?? 0,
    mode: shrineMode(st, v),
  };
}

function runDonation(spec: { gold: number; karma: number; cycles: number }): unknown {
  const st = stub({ gold: spec.gold, karma: spec.karma });
  const r = shrineDonate(st, spec.cycles);
  return { accepted: r.accepted, gold: st.gold, karma: st.karma, cost: r.cost };
}

function runQuest(spec: {
  virtue: number;
  karma: number;
  str: number;
  dex: number;
  int: number;
}): unknown {
  const st = stub({ karma: spec.karma, shrineQuestBitmap: 1 << spec.virtue });
  const avatar = {
    strength: spec.str,
    dexterity: spec.dex,
    intelligence: spec.int,
  } as CharacterState;
  const r = shrineCompleteQuest(st, spec.virtue, avatar);
  return {
    karma: st.karma,
    str: avatar.strength,
    dex: avatar.dexterity,
    int: avatar.intelligence,
    attrs: r.attrs,
  };
}

function runRestore(spec: {
  virtue: number;
  typedVirtue: string;
  typedMantras: string[];
  x: number;
  y: number;
}): unknown {
  const st = stub({ shrineDestroyed: (() => {
    const a = new Array(8).fill(0);
    a[spec.virtue] = 0x80;
    return a;
  })() });
  const r = shrineRestore(st, spec.virtue, spec.typedVirtue, spec.typedMantras, spec.x, spec.y, shrineData());
  return { restored: r.restored, destroyedAfter: st.shrineDestroyed?.[spec.virtue] ?? 0 };
}

function runWish(spec: { gold: number; wish: string; location: number }): unknown {
  const st = stub({ gold: spec.gold, position: { location: spec.location, floor: 0, x: 0, y: 0 } });
  const r = wishingWell(st, spec.wish);
  return { kind: r.kind, gold: st.gold };
}

const RUNNERS: Record<string, (spec: never) => unknown> = {
  moongate: runMoongate as (spec: never) => unknown,
  donation: runDonation as (spec: never) => unknown,
  quest: runQuest as (spec: never) => unknown,
  restore: runRestore as (spec: never) => unknown,
  wish: runWish as (spec: never) => unknown,
  flow: runFlow as (spec: never) => unknown,
};

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write("uso: shrines-run.ts '<json>'\n");
    process.exit(1);
  }
  const spec = JSON.parse(arg) as { kind: string };
  const runner = RUNNERS[spec.kind];
  if (!runner) {
    process.stderr.write(`kind desconocido: ${spec.kind}\n`);
    process.exit(1);
  }
  const out = runner(spec as never);
  console.log(JSON.stringify(out));
}

main();
