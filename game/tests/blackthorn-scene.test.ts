/**
 * #324 — ESCENA de la CAPTURA de Blackthorn (BLCKTHRN.OVL 0x060e + anim_vm 0x00be).
 *
 * Los ESPERADOS van EN CRUDO, derivados a mano del disasm y de los bytecodes de
 * DATA.OVL (parseados con el intérprete de 0x00be, ver re/notes y el docblock del
 * módulo), NUNCA re-computados desde el sujeto:
 *  · asientos: tabla DS 0x1F0A (fila por numLiving) × DS 0x1F42/0x1F48 (x/y por código)
 *  · guardias: (4,10)/(6,10) → guion 0x3702 → (1,9)/(9,9) → 0x370E → A en (1,5)
 *  · aviso 0x36DA: el compañero acaba en la mesa (5,7) [cruce con el plot 0x82@229],
 *    A vuelve a (1,5), B monta el reloj 0xE9@(5,9) y vuelve a (9,9)
 *  · escalada: ronda 1 → 0xEB (0x05DA), ronda 2 → 0xE8 (0x05E2); 0xEA inalcanzable
 *  · final 0x369E: puerta (0,4) 0x44→0xBB, el Avatar sale a (0,2), todos removidos
 *
 * La rejilla del test es SINTÉTICA (ceros): las posiciones y el orden de eventos no
 * dependen del contenido del mapa — el careo mapa↔tablas (grilletes 0x85 en los seis
 * asientos) vive en shrine-scene.test.ts, que sí lee el asset. Suite PURA.
 */
import { describe, expect, it } from "vitest";
import type { CharacterState, GameState } from "../src/core/state.js";
import type { GameEvent } from "../src/core/game.js";
import {
  blackthornOnStage,
  buildBlackthornEntryScript,
  buildBlackthornExitScript,
  buildFinaleScript,
  buildGuardReleaseScript,
  buildHourglassScript,
  buildSacrificeScript,
  buildThroneMountScript,
  buildBlackoutIntroScript,
  buildWarningScript,
  initCaptureScene,
  sacrificeVictimCell,
  type CaptureFigure,
  type CaptureSceneState,
} from "../src/core/world/blackthorn-scene.js";
import {
  runCaptureScene,
  submitInterrogationResponse,
  type CaptureCtx,
  type CaptureSceneHolder,
  type InterrogationHolder,
} from "../src/core/world/blackthorn-capture.js";

function char(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test",
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 20,
    dexterity: 20,
    intelligence: 20,
    currentMp: 10,
    currentHp: 50,
    maxHp: 60,
    exp: 0,
    level: 2,
    monthsAtInn: 0,
    helmet: 0xff,
    armor: 0xff,
    weapon: 0xff,
    shield: 0xff,
    ring: 0xff,
    amulet: 0xff,
    partyStatus: 0,
    ...over,
  };
}

function stub(fields: Partial<GameState>): GameState {
  return {
    version: 1,
    gold: 0,
    keys: 5,
    karma: 40,
    food: 100,
    partySize: (fields.characters ?? []).length,
    characters: [],
    position: { location: 0x12, floor: 0, x: 5, y: 5 },
    transport: "foot",
    time: { year: 139, month: 1, day: 1, hour: 12, minute: 30 },
    ...fields,
  } as GameState;
}

const MANTRAS = ["Ahm", "Mu", "Ra", "Beh", "Cah", "Summ", "Om", "Lum"];
const VIRTUES = [
  "Honesty",
  "Compassion",
  "Valour",
  "Justice",
  "Sacrifice",
  "Honor",
  "Spirituality",
  "Humility",
];

/** Rejilla sintética 11×11 (el contenido no participa en estos asertos). */
const TILES: number[][] = Array.from({ length: 11 }, () => Array<number>(11).fill(0));

function makeCtx(chars: CharacterState[], withTiles = true) {
  const pending: InterrogationHolder = { current: null };
  const scene: CaptureSceneHolder = { current: null };
  const state = stub({ characters: chars });
  const ctx: CaptureCtx = {
    state,
    pending,
    shrines: { virtues: VIRTUES, mantras: MANTRAS },
    ...(withTiles ? { captureTiles: TILES, scene } : {}),
  };
  return { ctx, pending, scene, state };
}

/** Figura de un slot en un snapshot (o undefined si no está). */
function fig(figures: readonly CaptureFigure[] | undefined, slot: number) {
  return figures?.find((f) => f.slot === slot);
}

/** Última posición conocida de un slot recorriendo los beats de un guion. */
function lastFig(beats: { figures?: readonly CaptureFigure[] }[], slot: number) {
  let out: CaptureFigure | undefined;
  let seen = false;
  for (const b of beats) {
    if (b.figures) {
      const f = fig(b.figures, slot);
      out = f;
      seen = true;
      if (!f) out = undefined;
    }
  }
  return { present: seen ? out !== undefined : undefined, at: out };
}

describe("#324 asientos de la party (DS 0x1f0a/0x1f42/0x1f48 + tiles por clase 0x1ade)", () => {
  it("party de 2: Avatar (3,5) y compañero (7,5), tiles por clase", () => {
    const s = initCaptureScene(["A", "B"]);
    expect(s.objects[0]).toEqual({ x: 3, y: 5, tile: 0x14c, visible: true });
    expect(s.objects[1]).toEqual({ x: 7, y: 5, tile: 0x144, visible: true });
    expect(s.objects[2]).toBeNull();
  });
  it("party de 6: los cuatro restantes en la fila de celdas y=1 (códigos 3,2,1,0)", () => {
    const s = initCaptureScene(["A", "M", "F", "B", "A", "A"]);
    const seats = s.objects.slice(0, 6).map((o) => o && [o.x, o.y]);
    // fila numLiving=6 de 0x1f0a = [4,5,3,2,1,0] → (3,5),(7,5),(10,1),(9,1),(1,1),(0,1)
    expect(seats).toEqual([
      [3, 5],
      [7, 5],
      [10, 1],
      [9, 1],
      [1, 1],
      [0, 1],
    ]);
    expect(s.objects[1]?.tile).toBe(0x140); // M → Wizard1
    expect(s.objects[2]?.tile).toBe(0x148); // F → Fighter1
  });
});

describe("#324 guiones del VM (bytecodes DATA.OVL, posiciones derivadas a mano)", () => {
  it("entrada (0x3702): guardias (4,10)/(6,10) → (1,9)/(9,9); Blackthorn 0x116→0x178 en (5,5)", () => {
    const s = initCaptureScene(["A", "B"]);
    const script = buildBlackthornEntryScript(s);
    // beep_delay(8) de 0x07ed: ocho pisadas de 2 fotogramas.
    for (let i = 0; i < 8; i++) {
      expect(script.beats[i]).toMatchObject({ frames: 2, footstep: true });
    }
    // Colocación de guardias (write_object_record 0x07f4/0x080c).
    expect(fig(script.beats[8]?.figures, 6)).toMatchObject({ x: 4, y: 10, tile: 0x170 });
    expect(fig(script.beats[8]?.figures, 7)).toMatchObject({ x: 6, y: 10, tile: 0x170 });
    // Tras el guion: N y 3× W/E — apostados tras los prisioneros.
    expect(lastFig(script.beats, 6).at).toMatchObject({ x: 1, y: 9 });
    expect(lastFig(script.beats, 7).at).toMatchObject({ x: 9, y: 9 });
    // Materialización: círculo sagrado + barrido, luego Blackthorn, pausa(8).
    const symbol = script.beats.find((b) => b.sfx === "blackthorn-materialize");
    expect(fig(symbol?.figures, 8)).toMatchObject({ x: 5, y: 5, tile: 0x116 });
    const last = script.beats[script.beats.length - 1]!;
    expect(fig(last.figures, 8)).toMatchObject({ x: 5, y: 5, tile: 0x178 });
    expect(last.frames).toBe(8);
    expect(blackthornOnStage(s)).toBe(true);
  });

  it("suelta (0x370e): pausa(11) y el guardia A acaba en (1,5)", () => {
    const s = initCaptureScene(["A", "B"]);
    buildBlackthornEntryScript(s);
    const script = buildGuardReleaseScript(s);
    expect(script.beats[0]).toMatchObject({ frames: 11 });
    expect(lastFig(script.beats, 6).at).toMatchObject({ x: 1, y: 5 });
  });

  it("aviso (0x36da): el compañero acaba OCULTO en la mesa (5,7), A vuelve a (1,5), B monta 0xE9@(5,9) y vuelve", () => {
    const s = initCaptureScene(["A", "B"]);
    buildBlackthornEntryScript(s);
    buildGuardReleaseScript(s);
    const script = buildWarningScript(s);
    expect(script.beats[0]).toMatchObject({ frames: 22 });
    const patches = script.beats.filter((b) => b.patch).map((b) => b.patch);
    // plot 0x82@(5,7) y plot 0xE9@(5,9), en ese orden (bytes 06 82 05 07 · 06 e9 05 09).
    expect(patches).toEqual([
      { x: 5, y: 7, tile: 0x82 },
      { x: 5, y: 9, tile: 0xe9 },
    ]);
    // El objeto del compañero se borra (op 9) pero sus coords QUEDAN en (5,7).
    expect(s.objects[1]).toMatchObject({ x: 5, y: 7, visible: false });
    expect(s.objects[6]).toMatchObject({ x: 1, y: 5 });
    expect(s.objects[7]).toMatchObject({ x: 9, y: 9 });
  });

  it("escalada: ronda 1 → 0xEB, ronda 2 → 0xE8; 0 y 3 no tienen tile (0xEA es inalcanzable)", () => {
    expect(buildHourglassScript(1)?.beats[0]?.patch).toEqual({ x: 5, y: 9, tile: 0xeb });
    expect(buildHourglassScript(2)?.beats[0]?.patch).toEqual({ x: 5, y: 9, tile: 0xe8 });
    expect(buildHourglassScript(0)).toBeNull();
    expect(buildHourglassScript(3)).toBeNull();
  });

  it("sacrificio (0x03ae): pausa(10) + sirena del péndulo + mesa 0x80; la celda de la explosión sigue al slot 1", () => {
    // SIN aviso: la víctima sigue en su asiento (7,5).
    const s1 = initCaptureScene(["A", "B"]);
    expect(sacrificeVictimCell(s1)).toEqual({ x: 7, y: 5 });
    const script = buildSacrificeScript(s1);
    expect(script.beats[0]).toMatchObject({ frames: 10 });
    expect(script.beats[1]?.sfx).toBe("shard-sweep"); // misma familia (0xa50,1,0xc8,si,0)
    expect(script.beats[2]?.patch).toEqual({ x: 5, y: 7, tile: 0x80 });
    expect(s1.objects[1]?.visible).toBe(false);
    // CON aviso previo: la víctima ya está en la mesa (5,7).
    const s2 = initCaptureScene(["A", "B"]);
    buildBlackthornEntryScript(s2);
    buildGuardReleaseScript(s2);
    buildWarningScript(s2);
    expect(sacrificeVictimCell(s2)).toEqual({ x: 5, y: 7 });
  });

  it("final (0x369e): puerta oeste 0x44→0xBB, el Avatar sale a (0,2), Blackthorn y guardias removidos", () => {
    const s = initCaptureScene(["A", "B"]);
    buildBlackthornEntryScript(s);
    buildGuardReleaseScript(s);
    const script = buildFinaleScript(s);
    expect(script.dismount).toBe(true);
    const patches = script.beats.filter((b) => b.patch).map((b) => b.patch);
    expect(patches).toEqual([
      { x: 0, y: 4, tile: 0x44 }, // la puerta se abre (BrickFloor)
      { x: 0, y: 4, tile: 0xbb }, // y se cierra (LockedDoorView)
    ]);
    expect(s.objects[0]).toMatchObject({ x: 0, y: 2, visible: true }); // el corredor NO
    expect(s.objects[6]?.visible).toBe(false);
    expect(s.objects[7]?.visible).toBe(false);
    expect(s.objects[8]?.visible).toBe(false);
    expect(blackthornOnStage(s)).toBe(false);
    // beep_delay(6) final: las seis pisadas que se alejan.
    const tail = script.beats.slice(-6);
    for (const b of tail) expect(b).toMatchObject({ frames: 2, footstep: true });
  });

  it("salida de Blackthorn (0x3716): pausa(4), E, S×5, removido", () => {
    const s = initCaptureScene(["A", "B"]);
    buildBlackthornEntryScript(s);
    const script = buildBlackthornExitScript(s);
    expect(script.dismount).toBe(true);
    expect(script.beats[0]).toMatchObject({ frames: 4 });
    expect(s.objects[8]).toMatchObject({ x: 6, y: 10, visible: false });
  });

  it("apagón (0x0672-0x06ae) y montaje (0x06b9-0x07d1): pausas y arrastres en crudo", () => {
    const intro = buildBlackoutIntroScript();
    expect(intro.blackout).toBe(true);
    expect(intro.beats[0]).toMatchObject({ frames: 2 }); // pausa(2) de 0x0672
    expect(intro.beats.slice(1)).toHaveLength(5); // 5 arrastres {delay 5 ticks + pisada}
    for (const b of intro.beats.slice(1)) expect(b).toMatchObject({ frames: 5, footstep: true });
    const s = initCaptureScene(["A", "B"]);
    const mount = buildThroneMountScript(s, TILES);
    expect(mount.blackout).toBe(true);
    expect(mount.tiles).toBe(TILES);
    expect(mount.beats.slice(0, 18)).toHaveLength(18); // 18 arrastres (sonido ON)
    for (const b of mount.beats.slice(0, 18)) expect(b).toMatchObject({ frames: 5, footstep: true });
    const last = mount.beats[18]!;
    expect(last.mount).toBe(true);
    expect(last.frames).toBe(0x10); // la pausa(0x10) de 0x07d1
    expect(fig(last.figures, 0)).toMatchObject({ x: 3, y: 5 });
  });
});

const kindsOf = (events: GameEvent[]): string[] => events.map((e) => e.kind);

describe("#324 orquestación: el chorro partido en beats (runCaptureScene)", () => {
  it("con rejilla: mensajes intercalados con segmentos y DOS esperas de tecla (0x0894/0x08cd)", () => {
    const { ctx } = makeCtx([char({ name: "Avatar" }), char({ name: "Iolo", class: "B" })]);
    const events = runCaptureScene(ctx);
    expect(kindsOf(events)).toEqual([
      "message", // venda (0x0652)
      "blackthorn-scene", // apagón + 5 arrastres
      "message", // drag (0x06b0)
      "blackthorn-scene", // 18 arrastres + montaje de la sala
      "message", // chained (0x07dc)
      "blackthorn-scene", // pausa(0x32)
      "message", // Footsteps! (0x07ea)
      "blackthorn-scene", // guardias + Blackthorn
      "message", // saludo (0x087f)
      "shrine-key-wait", // 0x0894
      "message", // GUARD! (0x0897)
      "blackthorn-scene", // guion 0x370e
      "message", // rec11 (0x08c6)
      "shrine-key-wait", // 0x08cd
      "blackthorn-interrogation-prompt",
    ]);
    // El holder queda armado con la party sentada.
    expect(ctx.scene?.current?.objects[0]).toMatchObject({ x: 3, y: 5 });
  });

  it("sin rejilla (asset ausente): el chorro previo intacto — 7 mensajes + prompt, cero eventos nuevos", () => {
    const { ctx } = makeCtx([char({ name: "Avatar" }), char({ name: "Iolo" })], false);
    const events = runCaptureScene(ctx);
    expect(kindsOf(events)).toEqual([
      "message",
      "message",
      "message",
      "message",
      "message",
      "message",
      "message",
      "blackthorn-interrogation-prompt",
    ]);
  });
});

describe("#324 orquestación: rondas del interrogatorio", () => {
  function begin(chars: CharacterState[]) {
    const made = makeCtx(chars);
    runCaptureScene(made.ctx);
    return made;
  }

  it("primer fallo: rec7 · guion 0x36da · rec8 · espera de tecla (0x053f) · siguiente pregunta", () => {
    const { ctx } = begin([char({ name: "Avatar" }), char({ name: "Iolo" })]);
    const events = submitInterrogationResponse(ctx, "wrong");
    expect(kindsOf(events)).toEqual([
      "message", // rec7 warning
      "blackthorn-scene", // 0x36da: el compañero a la mesa + reloj de arena
      "message", // rec8 + nombre + die!
      "shrine-key-wait", // 0x053f
      "blackthorn-interrogation-prompt",
    ]);
  });

  it("fallos 2º y 3º: la arena cae (0xEB, luego 0xE8) antes de la pregunta", () => {
    const { ctx } = begin([char({ name: "Avatar" }), char({ name: "Iolo" })]);
    submitInterrogationResponse(ctx, "wrong");
    const round1 = submitInterrogationResponse(ctx, "wrong");
    expect(kindsOf(round1)).toEqual(["blackthorn-scene", "blackthorn-interrogation-prompt"]);
    expect(round1[0]?.blackthornScene?.beats[0]?.patch).toEqual({ x: 5, y: 9, tile: 0xeb });
    const round2 = submitInterrogationResponse(ctx, "wrong");
    expect(round2[0]?.blackthornScene?.beats[0]?.patch).toEqual({ x: 5, y: 9, tile: 0xe8 });
  });

  it("péndulo (4º fallo): rec4 · sacrificio · explosión en la MESA (dx 0, dy 2) · sliced · tecla · rec6 · salida 0x3716 · depósito", () => {
    const { ctx, scene } = begin([char({ name: "Avatar" }), char({ name: "Iolo" })]);
    submitInterrogationResponse(ctx, "wrong");
    submitInterrogationResponse(ctx, "wrong");
    submitInterrogationResponse(ctx, "wrong");
    const events = submitInterrogationResponse(ctx, "wrong");
    expect(kindsOf(events)).toEqual([
      "message", // rec4: el péndulo cae
      "blackthorn-scene", // pausa(10) + sirena + mesa 0x80
      "cell-explosion", // kernel 0x3522 sobre las coords del slot 1
      "message", // «\n\nIolo is sliced in half! »
      "shrine-key-wait", // 0x04f6
      "message", // rec6 treachery
      "blackthorn-scene", // 0x3716: Blackthorn se va (0x08d9)
      "map-changed",
      "party-changed",
    ]);
    // La víctima ya estaba en la mesa (5,7) tras el aviso → dx = 0, dy = 2.
    const fx = events.find((e) => e.kind === "cell-explosion");
    expect(fx?.cellFx).toEqual({ dx: 0, dy: 2, bursts: 1, preDelayUnits: 0 });
    const exit = events.filter((e) => e.kind === "blackthorn-scene")[1];
    expect(exit?.blackthornScene?.dismount).toBe(true);
    expect(scene.current).toBeNull(); // holder limpio tras el depósito
  });

  it("traición con party>1 (acierto en ronda 0): merciful · sacrificio · explosión en el ASIENTO (dx 2, dy 0) · tecla · final 0x369e · depósito", () => {
    const { ctx } = begin([char({ name: "Avatar" }), char({ name: "Iolo" })]);
    const events = submitInterrogationResponse(ctx, "Ahm"); // mantra de Honesty
    expect(kindsOf(events)).toEqual([
      "message", // rec5 merciful death
      "blackthorn-scene", // sacrificio
      "cell-explosion",
      "shrine-key-wait", // 0x0510
      "blackthorn-scene", // 0x369e (incluye la salida de Blackthorn)
      "map-changed",
      "party-changed",
    ]);
    const fx = events.find((e) => e.kind === "cell-explosion");
    expect(fx?.cellFx).toEqual({ dx: 2, dy: 0, bursts: 1, preDelayUnits: 0 });
    const finale = events.filter((e) => e.kind === "blackthorn-scene")[1];
    expect(finale?.blackthornScene?.dismount).toBe(true);
  });

  it("Avatar solo que falla: a la mazmorra · tecla · final 0x369e · depósito (sin sacrificio)", () => {
    const { ctx } = begin([char({ name: "Avatar" })]);
    const events = submitInterrogationResponse(ctx, "wrong");
    expect(kindsOf(events)).toEqual([
      "message", // rec10 to the dungeon
      "shrine-key-wait", // 0x0510
      "blackthorn-scene", // 0x369e
      "map-changed",
      "party-changed",
    ]);
    expect(events.some((e) => e.kind === "cell-explosion")).toBe(false);
  });
});
