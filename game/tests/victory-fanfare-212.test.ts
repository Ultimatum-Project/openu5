/**
 * #212 — EL «VICTORY!» SUENA (DOS TONOS) Y EL JUEGO ESPERA MIENTRAS SUENA.
 *
 * REPORTE DEL USUARIO (13-08, jugando): al acabar una batalla el ORIGINAL hace sonar dos
 * tonos y hay una PAUSA mientras suenan; el port no tenía ni el sonido ni la pausa.
 *
 * DERIVACIÓN (`re/disasm/COMBAT.OVL.asm`, `combat_main_loop`, base 0xA290; cuerpo leído):
 *
 *   0cf6: b8006f      mov ax, 0x6f00       ; DS 0x6f00 = "\nVICTORY!\n"
 *   0cf9: 50          push ax
 *   0cfa: e8c368      call 0x75c0          ; print
 *   0cfd: c606a35801  mov byte [g_cmb_victory_flag], 1
 *   0d02: e8d393      call 0xffffa0d8      ; → ULTIMA.EXE:0x4368  sfx_victory_fanfare
 *   0d05: e87e6b      call 0x7886          ; → ULTIMA.EXE:0x1b16  vaciado del búfer de teclado
 *   0d08: fe069e58    inc byte [g_cmb_actor] ; …y el bucle SIGUE (la victoria no cierra nada)
 *
 * Los dos `call` son near-calls resueltos con la regla de banda de la casa
 * (`(i + 3 + rel + base) & 0xFFFF`, base COMBAT 0xA290 — `re/tools/censo_ausencias_llamadores.py:62`):
 *   0x0d02 → (0x0d05 + 0x93d3 − 0x10000 + 0xA290) & 0xFFFF = 0x4368
 *   0x0d05 → (0x0d08 + 0x6b7e + 0xA290) & 0xFFFF = 0x1b16
 *
 * Y los dos cuerpos, leídos en `ULTIMA.EXE.asm`:
 *   0x4368-0x43ac  3× tone_sweep(4600,1,10800,300,6) + 1× tone_sweep(6100,1,21600,300,3), `ret`
 *   0x1b16-0x1b37  `mov dx,0x40 ; mov ds,dx ; mov [0x1a],0x1e ; mov [0x1c],0x1e`
 *                  = cabeza y cola del búfer de teclado de la BIOS al MISMO valor = VACIADO
 *
 * ⚠ NO ERA UN CUE NUEVO: `victory-fanfare` (la misma rutina 0x4368) ya estaba portado desde
 * #201 para la cola del ritual del shard (CAST.OVL:0x1759). Lo que faltaba era CABLEARLO al
 * otro llamador del binario. `sfx-catalog.md` §3.5 ya nombraba a COMBAT.OVL:0x0d02.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type CombatEvent,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { sfxForCombatEvent } from "../src/core/sfx.js";
import {
  SFX_CATALOG,
  SpeakerSynth,
  BLOCKING_CUES,
  CHAINED_CUES,
  cueDurationMs,
  incToHz,
  samplesToMs,
  wellDoneInvertWindowMs,
  type ToneSeg,
} from "../src/skin/fiel/speaker.js";
import { CombatPacer, type PacerCombat, type PacerEvent } from "../src/ui/combat-pacer.js";
import { fakeAudioCtx } from "./helpers/fake-audio-ctx.js";

// ── Testigo REAL del mensaje ──────────────────────────────────────────────────
// El predicado del cue es el texto "VICTORY!". Una cadena inventada en el test haría pasar
// el aserto con el juego mudo, así que el texto se toma del MOTOR: se pelea una batalla de
// verdad y se lee lo que `Combat` emite. (Mismo fixture que `combat-victory-linger.test.ts`.)

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");

function freshState(): GameState {
  return createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
}
function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}

/** Pelea hasta limpiar el bando enemigo y devuelve TODOS los eventos emitidos. */
function fightToVictory(): CombatEvent[] {
  const state = freshState();
  const combat = new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Spider"), count: 1 }],
    seed: 12345,
    state,
    defenseValues: data.defenseValues,
  });
  const evs: CombatEvent[] = [];
  let ticks = 0;
  while (!combat.victory && ticks++ < 300) {
    const cur = combat.currentUnit;
    if (!cur) break;
    if (cur.kind === "enemy" || cur.charmed) {
      evs.push(...combat.tickEnemyTurns());
      continue;
    }
    const foe = combat.combatants.find((c) => c.kind === "enemy" && c.status === "active");
    const dist = foe ? Math.max(Math.abs(cur.x - foe.x), Math.abs(cur.y - foe.y)) : Infinity;
    evs.push(...(foe && dist <= 1 ? combat.playerAttack(foe.x, foe.y) : combat.playerPass()));
  }
  if (!combat.victory) throw new Error("el fixture no llegó a la victoria");
  return evs;
}

/** Los cues que el port derivaría de una tanda de eventos (el mismo camino de `main.ts`). */
const cuesOf = (evs: readonly CombatEvent[]): string[] =>
  evs
    .map((e) => sfxForCombatEvent(e as { kind: string; text?: string }))
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => c.id);

describe("#212 · el cue (COMBAT.OVL:0x0d02 → ULTIMA.EXE:0x4368)", () => {
  it("una batalla ganada DE VERDAD emite la fanfarria — el texto sale del motor", () => {
    const evs = fightToVictory();
    // Control positivo del testigo: el mensaje existe y es el del binario, byte a byte.
    expect(evs.filter((e) => e.kind === "message" && e.text === "VICTORY!")).toHaveLength(1);
    expect(cuesOf(evs)).toContain("victory-fanfare");
  });

  it("la fanfarria suena UNA vez (el latch g_cmb_victory_flag 0x58A3 es único)", () => {
    expect(cuesOf(fightToVictory()).filter((id) => id === "victory-fanfare")).toHaveLength(1);
  });

  it("la DERROTA no la emite — 0x0cda salta a 0x0cbc sin pasar por 0x0d02", () => {
    // La rama de "\nBATTLE IS LOST!" (DS 0x6eee) NO llama a 0x4368. Es el discriminante que
    // separa «suena al ganar» de «suena al acabar el combate», que no es lo mismo.
    expect(sfxForCombatEvent({ kind: "message", text: "BATTLE IS LOST!" })).toBeNull();
  });

  it("el predicado es el texto EXACTO, no un prefijo", () => {
    expect(sfxForCombatEvent({ kind: "message", text: "VICTORY! (almost)" })).toBeNull();
  });
});

describe("#212 · los DOS TONOS del reporte (0x4368, cuerpo leído)", () => {
  const segs = () => SFX_CATALOG["victory-fanfare"]() as ToneSeg[];

  it("son CUATRO barridos: 3 iguales + 1 distinto (0x438b ×3 en bucle, 0x43a5 suelto)", () => {
    const s = segs();
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual(s[1]);
    expect(s[1]).toEqual(s[2]);
    expect(s[3]).not.toEqual(s[2]);
  });

  it("son DOS pitches, y el ÚLTIMO ES MÁS AGUDO — no «más grave», como decía la nota", () => {
    // 🔴 Ésta es la corrección de corpus que trae #212. `sfx-catalog.md` §3.5/§6 y el
    // comentario de `speaker.ts` decían «una final más grave (mitad de incremento)». Bajo el
    // modelo de tono de esta casa el pitch sale de `inc` — 4600 → 6100 SUBE. Lo que se parte
    // por la mitad es `step` (6→3), que mueve el DUTY y no el tono. La nota confundió los dos
    // argumentos. Que sean dos pitches distintos y no cuatro es LO QUE EL USUARIO OYÓ.
    const s = segs();
    const pitches = [...new Set(s.map((t) => t.f0))];
    expect(pitches).toHaveLength(2);
    expect(s[0]!.f0).toBeCloseTo(incToHz(4600), 6);
    expect(s[3]!.f0).toBeCloseTo(incToHz(6100), 6);
    expect(s[3]!.f0).toBeGreaterThan(s[0]!.f0); // AGUDO, no grave
  });

  it("la última dura el DOBLE (count 10800 → 21600), y el total es el de la pausa", () => {
    const s = segs();
    expect(s[3]!.ms).toBeCloseTo(2 * s[0]!.ms, 6);
    // La duración se deriva de los `count` del asm, no de un número escrito a mano.
    const esperado = 3 * samplesToMs(10800, 1) + samplesToMs(21600, 1);
    expect(cueDurationMs({ id: "victory-fanfare" })).toBeCloseTo(esperado, 6);
  });
});

// ── La PAUSA ──────────────────────────────────────────────────────────────────

interface Stub extends PacerCombat {
  over: boolean;
  currentUnit: { kind: string; charmed?: boolean } | null;
}
function stubCombat(): Stub {
  const c: Stub = {
    over: false,
    currentUnit: { kind: "player" }, // sin tanda enemiga pendiente: aísla la pausa
    tickEnemyTurnStep: () => [] as readonly PacerEvent[],
    tickEnemyTurns: () => [] as readonly PacerEvent[],
  };
  return c;
}
function harness(beatMs: number) {
  const keys: string[] = [];
  const pacer = new CombatPacer({
    beatMs,
    combat: () => stubCombat(),
    combatOut: () => {},
    endCombat: () => {},
    hudRefresh: () => {},
    refreshAwaiting: () => {},
    handleKey: (k) => keys.push(k),
  });
  return { pacer, keys };
}

describe("#212 · la pausa bloqueante (la fanfarria ES el reloj)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const MS = cueDurationMs({ id: "victory-fanfare" });

  it("mientras suena, el pacer está OCUPADO (cursor apagado, teclas encoladas)", () => {
    const { pacer } = harness(400);
    expect(pacer.pacing).toBe(false);
    pacer.armBlockingPause(MS);
    expect(pacer.pacing).toBe(true);
    vi.advanceTimersByTime(MS - 1);
    expect(pacer.pacing).toBe(true); // sigue sonando: el juego no ha vuelto
    vi.advanceTimersByTime(2);
    expect(pacer.pacing).toBe(false);
  });

  it("🔴 las teclas de la pausa se TIRAN (0x1b16), no se re-entregan como en la tanda", () => {
    // El discriminante de esta espera. La tanda enemiga ENCOLA y DRENA («jamás se pierde una
    // tecla», cabecera de combat-pacer.ts) porque ahí el binario no toca el búfer BIOS. Aquí
    // 0x0d05 lo VACÍA: lo tecleado durante la fanfarria se pierde. Si alguien «arregla» esto
    // drenando la cola por simetría con la tanda, este aserto lo para.
    const { pacer, keys } = harness(400);
    pacer.armBlockingPause(MS);
    pacer.enqueue("a");
    pacer.enqueue("b");
    expect(pacer.queued).toBe(2);
    vi.advanceTimersByTime(MS + 1);
    expect(pacer.queued).toBe(0);
    expect(keys).toEqual([]); // vaciadas, NO re-entregadas
  });

  it("MUTANTE: sacar el cue del acotamiento deja de esperar", () => {
    // El acotamiento vive en `BLOCKING_CUES` y `main.ts` sólo arma la pausa para sus miembros.
    // Se reproduce aquí el gate del composition root: si el cue no está en la lista, no hay
    // pausa. Retirar `victory-fanfare` de `BLOCKING_CUES` pone rojo el primer aserto.
    const { pacer } = harness(400);
    const arm = (id: string) => {
      if (BLOCKING_CUES.has(id)) pacer.armBlockingPause(cueDurationMs({ id } as never));
    };
    arm("victory-fanfare");
    expect(pacer.pacing).toBe(true);
    vi.advanceTimersByTime(MS + 1);

    // Y el otro lado del mutante: un cue NO acotado no para el juego (es el mismo alcance
    // declarado que vigila el test de #206 sobre el encadenado de audio).
    expect(BLOCKING_CUES.has("combat-hit")).toBe(false);
    arm("combat-hit");
    expect(pacer.pacing).toBe(false);
  });

  it("bajo automatización (beatMs 0) NO hay pausa — el flujo síncrono queda intacto", () => {
    // Misma razón que el beat 0 de la tanda: los drivers pulsan sondeando estado y una espera
    // real re-ordenaría sus teclas → drift de digests del grand-tour.
    const { pacer } = harness(0);
    pacer.armBlockingPause(MS);
    expect(pacer.pacing).toBe(false);
  });

  it("es idempotente: dos armados seguidos no encadenan dos esperas", () => {
    const { pacer } = harness(400);
    pacer.armBlockingPause(MS);
    pacer.armBlockingPause(MS);
    vi.advanceTimersByTime(MS + 1);
    expect(pacer.pacing).toBe(false);
  });
});

describe("#212 · el acotamiento son DOS listas ANIDADAS (reescrito por #345)", () => {
  // 🔴 ESTE BLOQUE CAMBIÓ DE CONTRATO A PROPÓSITO, no por una regresión. Hasta #345 afirmaba
  // que el audio y la pausa leían LA MISMA lista, y era correcto entonces: en 1988 encadenar
  // y pausar son la misma cosa porque el audio ES el reloj (un hilo, cada primitiva gira
  // hasta acabar). En el PORT resultaron ser dos propiedades con ALCANCES distintos, y
  // unirlas obligaba a comprar la pausa para tener el encadenado: meter el `quake` del WELL
  // DONE en la lista única habría congelado el juego 930 ms y tirado las teclas encoladas en
  // CADA terremoto del juego (clavicémbalo, palabra de poder, In Vas Por Ylem, catarata).
  // Lo que sustituye a la identidad NO es «nada»: es el ANIDAMIENTO. Si alguien vuelve a
  // separarlas en dos listas sin relación, o mete un cue en la de pausa creyendo que sólo
  // encadena, estos tres asertos lo cazan.
  it("el audio lee CHAINED_CUES (no una tercera copia suelta)", () => {
    const priv = (SpeakerSynth as unknown as { BLOCKING: unknown }).BLOCKING;
    expect(priv).toBe(CHAINED_CUES);
  });

  it("BLOCKING ⊆ CHAINED: todo lo que PAUSA el juego encadena también el audio", () => {
    // El anidamiento es la invariante que sustituye a la identidad. Sin él, un cue podría
    // pausar el juego sin encadenar su audio — pausa y sonido discrepando, que es justo lo
    // que el aserto de identidad existía para impedir.
    for (const id of BLOCKING_CUES) expect(CHAINED_CUES.has(id)).toBe(true);
  });

  it("las dos listas son las declaradas, con nombre", () => {
    // `BLOCKING_CUES` NO crece: su docblock dice «con nombre y razón, nunca de rebote», y
    // #345 lo respetó — los dos cues del WELL DONE entran sólo en la de encadenado.
    expect([...BLOCKING_CUES].sort()).toEqual(["shard-sweep", "victory-fanfare"]);
    expect([...CHAINED_CUES].sort()).toEqual([
      "quake",
      "shard-sweep",
      "shrine-well-done",
      "victory-fanfare",
    ]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// #345 — EL TRUENO DEL WELL DONE SUENA **DETRÁS** DEL TONO DEL ALTAR (el EFECTO, no la lista)
//
// El bloque de arriba prueba la PERTENENCIA de los dos cues a `CHAINED_CUES`. Eso es el
// MEDIO, no el efecto: un `CHAINED_CUES` verde no prueba que el trueno suene en orden — tener
// fix no es estar vigilado. Lo que sigue interroga el AGENDADO REAL de `SpeakerSynth` con un
// `AudioContext` de mentira que apunta los `start`/`stop` de cada oscilador.
//
// LA DERIVACIÓN, que es lo que fija el orden: en CAST2 los dos barridos del altar ocupan
// 0x0c44-0x0c85 y la sacudida (`call 0x4e92`) está en 0x0c88, DESPUÉS del `jl` que cierra los
// barridos, en un solo hilo — están SERIALIZADAS por construcción. El port las arrancaba las
// DOS en `currentTime`, y el trueno (930 ms, −28,6 dBFS) quedaba 21,1 dB por debajo del tono
// del altar (5.347,5 ms, −20,0 dBFS) en la banda de éste: el «no oigo nada» del 16-08.
//
// 🔴 EL CONTROL QUE HACE FALTA es que el retraso venga del ENCADENADO y no de otra cosa: un
// `quake` suelto tiene que arrancar en 0. Sin ese control, un `quake` que empezase tarde por
// cualquier motivo (o un cue con silencio de cabecera) haría pasar el aserto principal.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("#345 · el ENCADENADO del WELL DONE, medido en el agendado (CAST2 0x0c44-0x0c85 → 0x0c88)", () => {
  /** Duraciones MEDIDAS del catálogo, en crudo — no recalculadas desde el sujeto del aserto. */
  const WELL_DONE_S = 5.3475; // 5.347,5 ms = los dos barridos del altar
  const QUAKE_S = 0.93; //      930 ms = la sacudida

  it("★ el `quake` arranca EN el final del `shrine-well-done`, no en el mismo instante", () => {
    const { ctx, started, stopped } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shrine-well-done" });
    const tras = started.length;
    const colaDelAltar = Math.max(...stopped);
    synth.play({ id: "quake" });

    // (a) el tono del altar SÍ empieza en 0: el primero de la cadena no espera a nadie.
    expect(started[0]).toBe(0);
    // (b) su cola cae donde dice el catálogo, en crudo.
    expect(colaDelAltar).toBeCloseTo(WELL_DONE_S, 3);
    // (c) y el trueno arranca AHÍ, no en 0 — que es el defecto que reportó el usuario.
    expect(started[tras]).toBeCloseTo(WELL_DONE_S, 3);
    expect(started[tras]).toBeGreaterThan(0);
  });

  it("★ CONTROL: un `quake` SUELTO arranca en 0 — el retraso lo pone el encadenado, no el cue", () => {
    const { ctx, started } = fakeAudioCtx();
    new SpeakerSynth(ctx).play({ id: "quake" });
    expect(started[0]).toBe(0);
  });

  it("★ el trueno ENTERO se DESPLAZA, no se recorta: el mismo cue medido en los dos regímenes", () => {
    // 🔴 POR QUÉ ESTO NO SE CAREA CONTRA `cueDurationMs("quake")` (= 930 ms): los 8 pulsos del
    // `quake` acaban en `silence(80)`, y un segmento de silencio AVANZA EL RELOJ SIN AGENDAR
    // OSCILADOR (`scheduleSeg` retorna antes de crearlo) — así que no deja `stop` y la cola
    // observable son 855,6 ms, no 930. Medirlo contra la duración de catálogo daba 6,2031
    // frente a 6,2775 y parecía un fallo del encadenado cuando es una propiedad del doble.
    // La medida buena es DIFERENCIAL: el MISMO cue suelto y encadenado, y su diferencia tiene
    // que ser exactamente el tono del altar. Sin el fix esa diferencia sería CERO (solapados).
    const solo = fakeAudioCtx();
    new SpeakerSynth(solo.ctx).play({ id: "quake" });
    const colaSuelta = Math.max(...solo.stopped);

    const enc = fakeAudioCtx();
    const synth = new SpeakerSynth(enc.ctx);
    synth.play({ id: "shrine-well-done" });
    synth.play({ id: "quake" });

    expect(Math.max(...enc.stopped) - colaSuelta).toBeCloseTo(WELL_DONE_S, 3);

    // Y NADA se pierde por el camino: la corrida encadenada agenda los segmentos del altar
    // MÁS los del trueno, sin recortar ninguno. (El primer aserto mide el DESPLAZAMIENTO; éste
    // mide la POBLACIÓN — un encadenado que se comiera segmentos pasaría el de arriba.)
    const altar = fakeAudioCtx();
    new SpeakerSynth(altar.ctx).play({ id: "shrine-well-done" });
    expect(enc.stopped.length).toBe(altar.stopped.length + solo.stopped.length);
  });

  // ════════════════════════════════════════════════════════════════════════════════════════
  // #355 · LA VENTANA DEL NEGATIVO CUBRE LA CADENA ENTERA: el trueno suena DENTRO.
  //
  // El defecto (acta #345 §6): `wellDoneInvertWindowMs` medía SOLO los dos barridos, pero el
  // tramo del asm entre el rect XOR (0x0c41) y el `kernel_flash(10)` que restaura (0x0d1a)
  // lleva SEIS llamadas — barridos (0x0c57/0x0c79), la sacudida (0x0c88 `call 0x4e92` →
  // kernel 0x3072) y tres `print_string` condicionales (0x0cba/0x0cdb/0x0cfc, sin constante
  // de reloj). Con la ventana corta, el `quake` encadenado (#345) arrancaba en t=5.347,5 ms
  // = EXACTAMENTE el cierre de la ventana: trueno sobre pantalla ya restaurada.
  //
  // MUTANTE CORRIDO (ventana corta: `wellDoneInvertWindowMs` sin `+ quakeDurationMs()`)
  // sobre fixture sano → predicho 4, **MATA 5**: los DOS de abajo + los DOS de
  // ritual-invert-295 (el estructural barridos+sacudida TAMBIÉN muere, no solo el crudo)
  // + el par cruzado de prompts-donation. 55/60 verdes con el mutante, 60/60 sin él.
  // ════════════════════════════════════════════════════════════════════════════════════════
  it("★ #355 · ventana = altar + trueno, EN CRUDO (6.277,5 ms) — no recalculada del sujeto", () => {
    // 5.347,5 (920 tonos × 0x96·0,93/24) + 930 (8 pulsos × 3.000 muestras × 0,93/24) + 0
    // (prints sin reloj) = 6.277,5 ms. Las dos parcelas, en las constantes CRUDAS de arriba.
    expect(wellDoneInvertWindowMs() / 1000).toBeCloseTo(WELL_DONE_S + QUAKE_S, 6);
    expect(wellDoneInvertWindowMs()).toBeCloseTo(6277.5, 6);
  });

  it("★ #355 · el trueno encadenado ARRANCA y ACABA antes de que la ventana se cierre", () => {
    const { ctx, started, stopped } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shrine-well-done" });
    const tras = started.length;
    synth.play({ id: "quake" });
    const ventanaS = wellDoneInvertWindowMs() / 1000;
    // Arranca DENTRO — con la ventana corta arrancaba EXACTAMENTE en el cierre (igualdad),
    // y `toBeLessThan` la mata: es el aserto de ORDEN trueno-antes-de-restaurar.
    expect(started[tras]!, "el trueno debe empezar con el viewport aún en negativo")
      .toBeLessThan(ventanaS);
    // Y su último oscilador agendado también acaba dentro. (El `silence(80)` de cola no
    // agenda oscilador ⇒ esto es cota INFERIOR de la cadena; la igualdad exacta
    // ventana = catálogo entero, silencio incluido, la sella el aserto en crudo de arriba.)
    expect(Math.max(...stopped)).toBeLessThanOrEqual(ventanaS);
  });

  it("★ el encadenado NO se derrama a los cues de fuera de la lista (alcance declarado)", () => {
    // `combat-hit` no está en `CHAINED_CUES`: tras el tono del altar sigue arrancando YA. Si
    // alguien «arreglara» esto encadenando TODO, el juego se volvería un cuello de botella de
    // audio — y este aserto lo para.
    const { ctx, started } = fakeAudioCtx();
    const synth = new SpeakerSynth(ctx);
    synth.play({ id: "shrine-well-done" });
    const tras = started.length;
    expect(CHAINED_CUES.has("combat-hit"), "control del alcance").toBe(false);
    synth.play({ id: "combat-hit" });
    expect(started[tras]).toBe(0);
  });
});
