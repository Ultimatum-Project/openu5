/**
 * #241 — «Thrown out of bed!» : el SNAP horario + el test de casilla PROPIA dentro del
 * bucle de sueño en cama de pueblo (CMDS.OVL CS:0x0552). Eslabón derivado en #230
 * (`re/notes/eslabon-230-acta.md`); esto sella el CABLEADO.
 *
 * EL BUCLE DEL BINARIO, instrucción a instrucción (entra por `jmp 0x63b`):
 * ```
 *   0634  push 1 / call 0x617a          ; delay de fotograma (ULTIMA.EXE 0x20FA)
 *   063b  cmp si, g_hour / je 0x692     ; ¿hora de destino? → sale
 *   0647  push 0xa / call 0xffff8ffc    ; advance_clock(10)  = ULTIMA.EXE 0x4F7C
 *   0677  call 0xffffbb0e               ; ★ SNAP → TOWN.OVL 0x1694
 *   067a  push g_party_x / 0680 g_party_y / 0684 g_floor
 *   0688  call 0x770e                   ; ★ GATE = ULTIMA.EXE 0x368E find_object_at_xy
 *   068b  or ax,ax / je 0x634           ; 0 ⇒ otra vuelta ; ≠0 ⇒ cae
 *   068f  mov si,0xffff → 069d print DS 0x422a b'Thrown out of bed!\n'
 * ```
 * ⇒ ORDEN por paso: **reloj → snap → gate**, y el acierto TERMINA el sueño (0x068f no
 * vuelve a 0x0634). El port da un paso de 1 h donde el binario da seis de 10 min
 * (cadencia = Clase C declarada en `camp.ts::bedSleep`).
 *
 * POR QUÉ EL SNAP HACE ALCANZABLE AL GATE (#230 §1): TOWN 0x1694 llama a TOWN 0x1726, que
 * en 0x182f/0x1836/0x183d escribe X/Y/Z del tramo horario en `[si+0x5c5c]/[5d]/[5e]` =
 * `g_world_objects` 0x5C5A campos +2/+3/+4 — LOS MISMOS que 0x368E compara (0x36b1/0x36bb/
 * 0x36cf). El snap de la hora N puede meter a un NPC en tu casilla y el gate lo ve en esa
 * MISMA vuelta.
 *
 * LA FIXTURE NO ES DEGENERADA (género #187): el NPC del horario EXISTE en los datos, se
 * COLOCA de verdad, y cada bloque lleva su aserción de precondición — sin ellas, un snap
 * que no hiciera nada y un gate cableado a `false` pasarían los negativos igual.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Game, type GameData } from "../src/core/game.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import type { SmallMapFloor, SmallMapLocation, WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const initial = load<ExtractedInitialState>("../assets/initial-state.json");

const THROWN = "Thrown out of bed!\n"; // DS 0x422a = DATA.OVL fileoff 0x423a, bytes verificados
const LOC = 2; // pueblo cualquiera (g_location 0x01-0x20 ⇒ el gate SÍ compara planta, 0x36c0)
const BX = 5, BY = 5; // la cama: casilla del party
const FAR: [number, number] = [10, 10];

/**
 * Horario de UN NPC con VENTANA DE UNA HORA sobre la casilla del party.
 *
 * `times` = [0, 8, 9, 9] con `scheduleIndex` (NPC.OVL 0x12E0, port en core/time.ts):
 *   hora 7 → idx 0 (lejos) · hora 8 → idx 1 (SOBRE la cama) · hora 9 → idx 2 (lejos)
 * Esa ventana de una sola hora es lo que hace el test DISCRIMINANTE del ORDEN: con
 * snap→gate el mensaje sale en la hora 8; con gate→snap el gate vería la posición que
 * dejó el snap de la hora 7 (lejos) y a la hora 9 el NPC ya se ha ido ⇒ NUNCA saltaría.
 */
function slotVentana(onBed: [number, number], z: [number, number, number] = [0, 0, 0]): NpcSlot {
  return {
    slot: 1,
    aiTypes: [0, 0, 0],
    x: [FAR[0], onBed[0], FAR[0]],
    y: [FAR[1], onBed[1], FAR[1]],
    z,
    times: [0, 8, 9, 9],
    type: 0x12, // persona (no cae en npcSlotObjectKind ⇒ va al NpcManager)
    dialogNumber: 0,
  };
}

function world(): WorldData {
  const mk = (): number[][] => Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 4));
  const floors: SmallMapFloor[] = [
    { z: 0, tiles: mk() },
    { z: 1, tiles: mk() },
  ];
  const smallMaps = new Map<number, SmallMapLocation>();
  smallMaps.set(LOC, { id: LOC, name: "Test", floors });
  const ow = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 4));
  return { overworld: ow, underworld: ow, smallMaps };
}
const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 250),
  locationsY: Array.from({ length: 32 }, () => 250),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

interface Arnes {
  game: Game;
  state: GameState;
  npcManager: NpcManager;
}

/** Party dormida en la cama de (BX,BY), planta 0, a las 6:00. */
function arnes(slots: NpcSlot[], hour = 6): Arnes {
  const state = createNewGame(initial);
  state.position = { location: LOC, floor: 0, x: BX, y: BY };
  state.time.hour = hour;
  state.time.minute = 0;
  const npcManager = new NpcManager(slots.length > 0 ? { [LOC]: slots } : {});
  const game = new Game(initial, world(), gameData, state, { npcManager });
  return { game, state, npcManager };
}

const textos = (evs: ReturnType<Game["bedSleep"]>): string[] =>
  evs.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("#241 (1) PRECONDICIONES de la fixture — que no sea degenerada (#187)", () => {
  it("el NPC del horario EXISTE y el snap lo COLOCA en la casilla de la cama a las 8", () => {
    const { npcManager, state } = arnes([slotVentana([BX, BY])]);
    state.time.hour = 8;
    npcManager.enterMap(LOC, state);
    expect(
      npcManager.npcAt(LOC, 0, BX, BY),
      "sin esto la fixture no probaría nada: el gate no tendría a quién encontrar",
    ).not.toBeNull();
  });

  it("CONTRASTE: a las 7 el MISMO NPC NO está en la cama (la ventana es de una hora)", () => {
    const { npcManager, state } = arnes([slotVentana([BX, BY])]);
    state.time.hour = 7;
    npcManager.enterMap(LOC, state);
    expect(npcManager.npcAt(LOC, 0, BX, BY), "hora 7 ⇒ scheduleIndex 0 ⇒ lejos").toBeNull();
    expect(npcManager.npcAt(LOC, 0, FAR[0], FAR[1]), "y está en su puesto lejano").not.toBeNull();
  });
});

describe("#241 (2) el GATE: casilla PROPIA, y el snap corre ANTES en la MISMA vuelta", () => {
  it("★ el NPC que el horario mete en tu casilla te echa de la cama (0x0688 → 0x069d)", () => {
    const { game } = arnes([slotVentana([BX, BY])]);
    expect(
      textos(game.bedSleep(5)),
      "0x0688 find_object_at_xy(g_party_x,g_party_y,g_floor) != 0 ⇒ 0x068f ⇒ print DS 0x422a",
    ).toContain(THROWN);
  });

  it("★ DISCRIMINA EL ORDEN: salta en la hora 8, la única en que el NPC está encima", () => {
    // Si el gate corriera ANTES del snap vería la colocación de la hora 7 (lejos) y a la
    // hora 9 el NPC ya se habría ido ⇒ el mensaje no saldría nunca. Que salga, y que salga
    // con el reloj en 8, sólo es compatible con snap→gate dentro de la misma iteración.
    const { game, state } = arnes([slotVentana([BX, BY])]);
    game.bedSleep(5);
    expect(state.time.hour, "0x0647 advance_clock va ANTES del snap de 0x0677").toBe(8);
  });

  it("★ el sueño TERMINA ahí: no se duermen las 5 horas pedidas (0x068f no vuelve a 0x0634)", () => {
    const { game, state } = arnes([slotVentana([BX, BY])]);
    game.bedSleep(5);
    expect(state.time.hour, "durmiendo las 5 enteras desde las 6 sería la hora 11").not.toBe(11);
    expect(state.time.hour).toBe(8);
  });

  it("★ ADYACENTE NO cuenta (#149): el gate compara la terna del party, no una vecina", () => {
    // El género de #149: justificar con la geometría equivocada. Los tres args de 0x368E
    // son (g_party_x, g_party_y, g_floor) empujados en 0x067a/0x0680/0x0684.
    const { game, state } = arnes([slotVentana([BX + 1, BY])]);
    expect(textos(game.bedSleep(5)), "vecino del este ⇒ ninguna comparación casa").not.toContain(
      THROWN,
    );
    expect(state.time.hour, "y duerme las 5 horas enteras").toBe(11);
  });

  it("★ OTRA PLANTA no cuenta: el tercer arg es g_floor (0x36cf cmp con [bp+4])", () => {
    const { game, state } = arnes([slotVentana([BX, BY], [1, 1, 1])]);
    expect(textos(game.bedSleep(5)), "z=1 con el party en z=0 ⇒ 0x36d2 jne").not.toContain(THROWN);
    expect(state.time.hour).toBe(11);
  });
});

describe("#241 (3) CONTROL NEGATIVO: horario que no coloca a nadie encima", () => {
  it("★ duerme las horas pedidas ENTERAS y sin mensaje", () => {
    const { game, state } = arnes([slotVentana(FAR)]);
    const evs = game.bedSleep(5);
    expect(textos(evs), "el gate devuelve 0 en las 5 vueltas ⇒ 0x068d je 0x634").not.toContain(
      THROWN,
    );
    expect(textos(evs), "y el 'Zzzzzzz...' de 0x060d sigue saliendo").toContain("Zzzzzzz...\n");
    expect(state.time.hour, "6 + 5 = 11").toBe(11);
  });

  it("★ sin NINGÚN NPC en el mapa tampoco salta (control del cableado vacío)", () => {
    const { game, state } = arnes([]);
    expect(textos(game.bedSleep(5))).not.toContain(THROWN);
    expect(state.time.hour).toBe(11);
  });
});

describe("#241 (4) la tabla del binario lleva OBJETOS Y actores en la MISMA lista", () => {
  it("★ un objeto del mundo en tu casilla también dispara el gate (objects.md:16)", () => {
    // 0x368E barre `g_world_objects` 0x5C5A, donde el binario guarda las dos poblaciones;
    // el port las tiene separadas (`state.worldObjects` / NpcManager) y el predicado
    // equivalente consulta LAS DOS. Sin esta mitad el gate sería ciego a los objetos.
    const { game, state } = arnes([slotVentana(FAR)]);
    state.worldObjects = [
      { location: LOC, floor: 0, x: BX, y: BY, tile: 257, kind: "chest" },
      ...(state.worldObjects ?? []),
    ];
    expect(textos(game.bedSleep(5)), "slot con +2/+3/+4 == la terna ⇒ ax = byte +0 != 0").toContain(
      THROWN,
    );
    // 🔴 ANTES esperaba hora 7 — o sea UN PASO DE 60'. Pinaba la cadencia vieja: el bucle
    // de cama avanza de DIEZ EN DIEZ minutos (CMDS 0x064b `advance_clock` con arg 10, y el
    // cuerpo del reloj suma MINUTOS), 6 vueltas por hora. Saltar «en la primera vuelta»
    // significa que han pasado DIEZ MINUTOS, no una hora: la hora ni siquiera rueda.
    expect(state.time.hour, "salta en la 1ª vuelta ⇒ la hora aún NO rueda").toBe(6);
    expect(state.time.minute, "y la vuelta son 10 minutos, no 60").toBe(10);
  });

  it("★ el MISMO objeto en la casilla de al lado NO dispara (control de la geometría)", () => {
    const { game, state } = arnes([slotVentana(FAR)]);
    state.worldObjects = [
      { location: LOC, floor: 0, x: BX + 1, y: BY, tile: 257, kind: "chest" },
      ...(state.worldObjects ?? []),
    ];
    expect(textos(game.bedSleep(5))).not.toContain(THROWN);
    expect(state.time.hour).toBe(11);
  });
});

/**
 * #250 — EL EPÍLOGO de 0x0692, común a las DOS salidas del bucle.
 *
 *   06a4-06cc  por miembro: 'S'(0x53) → 'G'(0x47)
 *   06d5  fe069658  inc byte ptr [g_party_x]     ; sales de la cama un paso al ESTE
 *   06d9  c606e62401 mov [g_unk_24e6], 1          ; marca de repintado (#228, no portada)
 *   06de  fe065c5c  inc byte ptr [0x5C5C]        ; el MISMO +1 en el espejo del slot 0
 *
 * ★ 0x06de NO es una tercera escritura. El disasm lo etiqueta `g_char_anim_states+2`, pero
 * 0x5C5A+2 = 0x5C5C = campo +2 del SLOT 0 de la tabla de objetos, y TOWN 0x160d-0x161c y
 * ULTIMA.EXE 0x53a6-0x53b5 copian ahí `g_party_x`/`g_party_y`/`g_floor` ⇒ el slot 0 es el
 * registro del PROPIO party (por eso 0x368E empieza en el slot 1). El port tiene UNA
 * representación de la posición, así que el +1 se aplica UNA vez.
 */
describe("#250 el EPÍLOGO: salir de la cama mueve al ESTE (0x06d5)", () => {
  it("★ tras dormir entero, la party acaba en x+1", () => {
    const { game, state } = arnes([slotVentana(FAR)]);
    game.bedSleep(3);
    expect(state.position.x, "0x06d5 `inc byte ptr [g_party_x]`").toBe(BX + 1);
    expect(state.position.y, "sólo la X: no hay `inc` de g_party_y en el epílogo").toBe(BY);
  });

  it("★ y también al ser ECHADO: el epílogo de 0x0692 es COMÚN a las dos salidas", () => {
    const { game, state } = arnes([slotVentana([BX, BY])]);
    const evs = game.bedSleep(5);
    expect(textos(evs), "precondición: esta corrida sale por la interrupción").toContain(THROWN);
    expect(state.position.x, "0x068f cae en 0x0692, que sigue hasta 0x06d5").toBe(BX + 1);
  });

  it("★ el +1 se aplica UNA vez, no dos (0x06de es el ESPEJO, no un segundo paso)", () => {
    // Control anti-regresión del hallazgo: si alguien leyera `inc [g_char_anim_states+2]`
    // como una segunda escritura de posición y la portara, la party andaría DOS casillas.
    const { game, state } = arnes([slotVentana(FAR)]);
    game.bedSleep(1);
    expect(state.position.x - BX, "una sola casilla").toBe(1);
  });

  it("★ el ciclo 'G'→'S'→'G' es identidad, y el que NO estaba sano se queda como estaba", () => {
    // 0x05f5 sólo pasa 'G'(0x47) a 'S'(0x53), y 0x06ba sólo devuelve 'S' a 'G' ⇒ un 'P'
    // envenenado atraviesa el sueño intacto. Sin este caso, un port que hiciera
    // «todos a 'G' al despertar» pasaría el test del miembro sano y CURARÍA al envenenado.
    const { game, state } = arnes([slotVentana(FAR)]);
    state.partySize = 2;
    state.characters[0]!.status = "G";
    state.characters[1]!.status = "P";
    game.bedSleep(2);
    expect(state.characters[0]!.status, "el sano vuelve de 'S' a 'G'").toBe("G");
    expect(state.characters[1]!.status, "el envenenado NO se cura durmiendo").toBe("P");
  });
});

describe("#241 (5) STREAM: el snap POR HORA no mueve el RNG", () => {
  /** Cuenta pasos del generador vivo durante una acción (método: delta contra el gemelo). */
  function tiradas(a: Arnes, run: (g: Game) => void): number {
    let n = 0;
    const live = (a.game as unknown as { liveRng: { next: (lo: number, hi: number) => number } })
      .liveRng;
    const orig = live.next.bind(live);
    live.next = (lo: number, hi: number): number => (n++, orig(lo, hi));
    run(a.game);
    return n;
  }

  it("★ bedSleep sin cruzar medianoche: 0 tiradas con snap en CADA hora", () => {
    const a = arnes([slotVentana(FAR)]);
    expect(tiradas(a, (g) => g.bedSleep(5)), "#158 midió 0 para UNA llamada; aquí son 5").toBe(0);
  });

  it("★ cruzando medianoche: EXACTAMENTE las mismas 7 que sin el snap (baseline #241)", () => {
    // CONTROL NO DEGENERADO: con tres Shadowlords sueltos (<0x80) el rollover de día SÍ
    // tira (survival.ts relocateShadowlordsAtMidnight, 0x4FF5). Medido en main ANTES de
    // cablear el snap: 7. Si el snap por hora tirase, este número subiría.
    const a = arnes([slotVentana(FAR)], 20);
    a.state.shadowlordLocs = [1, 2, 3];
    expect(tiradas(a, (g) => g.bedSleep(6))).toBe(7);
  });

  it("CONTROL DE SENSIBILIDAD del contador: mide de verdad (si no, el 0 no valdría)", () => {
    const a = arnes([slotVentana(FAR)], 20);
    a.state.shadowlordLocs = [1, 2, 3];
    expect(tiradas(a, (g) => g.bedSleep(6)) > 0, "el mismo instrumento cuenta > 0 aquí").toBe(true);
  });
});
