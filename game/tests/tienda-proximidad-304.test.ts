/**
 * FICHA #304 — **el TENDERO abre su tienda porque te plantas a su lado**, sin (T)alk.
 *
 * Es la parte (b) de #315 y la hermana de #301: el MISMO fast-path de proximidad
 * (`NPC.OVL 0x06e4`, manhattan==1 + aiType 4/5 + dlgNum!=0 → marcador 0x74 → `npc_engine`
 * `TOWN 0x13ce` → `TALK 0x031E`), pero con un `dlgNum` de la familia `0x80..0xFC`. El
 * despachador es UNO: reparte por `dlgNum` DESPUÉS de que lo llame quien sea, así que la
 * rama de tienda (0x03e4) es alcanzable por las DOS vías. Derivación entera en
 * `re/notes/tienda-proximidad-304.md`.
 *
 * ── EL ORDEN, que es lo que este fichero guarda de verdad ─────────────────────────────
 *   03e7/03fa  gate horario (paridad del índice de tramo) → si falla, 0x0406 el RECHAZO
 *   0401       call 0xe6 …
 *   00ed         … y AHÍ DENTRO la guarda del caballo (#170)
 * ⇒ a un tendero fuera de tramo se le oye «Come see me at my shoppe…» **aunque llegues
 * montado**: el insulto del caballo vive detrás de un gate que no has pasado. Invertir
 * las dos condiciones es el mutante M3 de abajo.
 *
 * ── LO QUE NO SE PUEDE GUARDAR DESDE AQUÍ, dicho antes de que nadie lea el verde de más ──
 * 🔴 La CONSOLA de la tienda vive en `boot()` (main.ts, #237): este fichero llega hasta el
 * evento `npc-initiates-shop` y no un paso más. Que la UI abra la consola correcta lo
 * sostienen (a) el aserto de FUENTE del final y (b) que el manejador use el mismo
 * `SHOP_TYPES`/`startShopConsole` que la vía de (T)alk. Es un predicado sobre TEXTO y por
 * tanto frágil (familia #251); se declara como lo que es.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import type { NpcManager, NpcRuntime } from "../src/core/npc/manager.js";
import { TalkScriptRegistry } from "../src/core/dialogue/registry.js";
import { SHOP_CLOSED_MESSAGE, shopIsOpen } from "../src/core/world/shop-hours.js";
import { scheduleIndex } from "../src/core/time.js";

/** Britain: pueblo genérico (≠ 0x12 Palacio, ≠ 5 Minoc). */
const TOWN = 2;
/** MagicSeller — el tendero del careo de #265/#315: loc 1 slot 2, aiTypes [0,4,1]. */
const DLG_MAGIC = 0x85;
/** HorseSeller: la ÚNICA excepción de la guarda del caballo (TALK 0x00f6). */
const DLG_HORSE = 0x83;
/** Los cuatro `times[]` del MagicSeller de Moonglow, tal cual salen del .NPC. */
const TIMES_MAGIC = [17, 11, 21, 23];
/** Con esos tiempos: 12 h → índice 1 (impar ⇒ ABIERTO); 18 h → índice 0 (⇒ CERRADO). */
const HORA_ABIERTO = 12;
const HORA_CERRADO = 18;
/** Montura: `and al,0xfe / cmp al,0x12` (TALK 0x00f0) — 0x12/0x13 y nada más. */
const TILE_MONTADO = 0x12;
/**
 * 🔴 TERNA SINTÉTICA, y hace falta decir por qué: los 14 tenderos reales llevan su
 * aiType 4 **sólo en el tramo 1**, que es justo el impar ⇒ arman el fast-path
 * exactamente cuando su tienda está ABIERTA, y la rama de rechazo **no es alcanzable
 * por proximidad con los datos de hoy** (medido en el bloque de POBLACIÓN de abajo, con
 * su control positivo). Con la terna real, todo aserto sobre el rechazo saldría verde
 * por no llegar nunca — el verde de la puerta cerrada. Estos casos ponen el 4 también
 * en los tramos PARES para instanciar la diferencia DONDE EXISTE: la conducta que
 * describen es la del binario (y la que el pestillo de #84 haría alcanzable de verdad).
 */
const AI_SIEMPRE_ALERTA: [number, number, number] = [4, 4, 4];

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}

function makeState(hour: number): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 0, karma: 40,
    time: { year: 139, month: 4, day: 7, hour, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 5 },
    transport: "foot", prevHour: hour,
    npcDead: Array.from({ length: 32 }, () => []),
    npcMet: Array.from({ length: 32 }, () => []),
  } as unknown as GameState;
}

function makeWorld(): WorldData {
  const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 5));
  const loc: SmallMapLocation = { id: TOWN, name: "Britain", floors: [{ z: 0, tiles }] };
  const overworld = Array.from({ length: 256 }, () => Array.from({ length: 256 }, () => 5));
  return { overworld, underworld: overworld, smallMaps: new Map([[TOWN, loc]]) };
}

const gameData: GameData = {
  locationsX: Array.from({ length: 32 }, () => 100),
  locationsY: Array.from({ length: 32 }, () => 100),
  locationNames: Array.from({ length: 32 }, (_, i) => `Loc${i + 1}`),
};

interface TenderoSpec {
  dialogNumber: number;
  /** Terna del .NPC. Por defecto la del MagicSeller: sólo el tramo 1 (impar) es 4. */
  aiTypes?: [number, number, number];
  times?: number[];
  /** Desplazamiento respecto al grupo. Por defecto (1,0) = ADYACENTE al este. */
  d?: [number, number];
  /** Byte de transporte del grupo (TALK 0x00f0). Por defecto a pie. */
  transportTile?: number;
}

function npcManagerCon(s: GameState, spec: TenderoSpec): NpcManager {
  const [dx, dy] = spec.d ?? [1, 0];
  const npc = {
    slot: 2,
    type: 0x20,
    dialogNumber: spec.dialogNumber,
    // 🔴 COPIA, y es obligatoria desde que el port normaliza el aiType (TALK 0x0354):
    // `AI_SIEMPRE_ALERTA` y `TIMES_MAGIC` son constantes de MÓDULO, así que pasarlas por
    // referencia hacía que el primer test que abordara al tendero dejara la terna
    // compartida en [1,4,4] y los siguientes corrieran sobre un fixture ya mutado —
    // tres rojos que parecían del código y eran del arnés. `NpcManager.enterMap` hace
    // esta misma copia (manager.ts `aiTypes: [...s.aiTypes]`); el arnés la replica.
    aiTypes: [...(spec.aiTypes ?? [0, 4, 1])],
    times: [...(spec.times ?? TIMES_MAGIC)],
    x: s.position.x + dx,
    y: s.position.y + dy,
    z: s.position.floor,
  } as unknown as NpcRuntime;
  return {
    setRng() {}, enterMap() {}, tick() {}, arrestAlarm() {},
    npcsAt: (loc: number, floor: number) =>
      loc === s.position.location && floor === npc.z ? [npc] : [],
    npcAt: (loc: number, floor: number, x: number, y: number) =>
      loc === s.position.location && floor === npc.z && x === npc.x && y === npc.y ? npc : null,
  } as unknown as NpcManager;
}

/** Contador de tiradas: el instrumento de la sonda de RNG del último bloque. */
function juego(
  spec: TenderoSpec,
  hour = HORA_ABIERTO,
): { game: Game; state: GameState; npc: NpcRuntime; tiradas: () => number } {
  const state = makeState(hour);
  if (spec.transportTile !== undefined) {
    (state as unknown as { transportTile: number }).transportTile = spec.transportTile;
  }
  let n = 0;
  const manager = npcManagerCon(state, spec);
  const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, state, {
    npcManager: manager,
    talkScripts: new TalkScriptRegistry({ towne: [], dwelling: [], castle: [], keep: [] }),
    rand: (max: number, min: number) => {
      n++;
      return min;
    },
  } as never);
  const [dx, dy] = spec.d ?? [1, 0];
  const npc = manager.npcAt(
    state.position.location,
    state.position.floor,
    state.position.x + dx,
    state.position.y + dy,
  )!;
  return { game, state, npc, tiradas: () => n };
}

/** Un turno de mundo con el NPC ya colocado (mismo disparador que #301). */
const turno = (game: Game): GameEvent[] => game.confirmTownExit(false);
const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);
const textos = (events: GameEvent[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text ?? "");

describe("#304 — el tendero abre tienda por PROXIMIDAD (TALK 0x031E rama 0x03e4)", () => {
  it("EN SU TRAMO: la intercepción abre la tienda, y el evento NOMBRA al tendero", () => {
    const { game, npc } = juego({ dialogNumber: DLG_MAGIC });
    const ev = turno(game);
    expect(kinds(ev)).toContain("npc-initiates-shop");
    const e = ev.find((x) => x.kind === "npc-initiates-shop");
    expect(e?.initiatesShop?.npc.dialogNumber).toBe(DLG_MAGIC);
    // ★ y es EL MISMO OBJETO que devuelve la búsqueda por celda: una vía, un interlocutor.
    // Si alguien duplica la búsqueda de NPC, esto deja de ser identidad y pasa a ser
    // igualdad estructural — que es justo lo que no queremos.
    //
    // 🔴 El testigo NO puede ser `game.talkTarget("east")`, y el motivo es de diseño, no
    // de fontanería: `talkScriptFor` devuelve null para todo `dlgNum >= 0x80` (game.ts,
    // el gate de #315) ⇒ para un TENDERO vale siempre `undefined`, y el aserto pasaría
    // comparando `undefined` con `undefined` en cuanto el evento dejara de emitirse.
    // Es un verde que no depende del sujeto: cambiarlo por la búsqueda por celda es lo
    // que lo hace capaz de fallar.
    expect(e?.initiatesShop?.npc).toBe(npc);
  });

  it("FUERA DE TRAMO: no abre — emite las DOS cadenas del rechazo (DS 0x9196 + 0x91c4)", () => {
    const { game } = juego({ dialogNumber: DLG_MAGIC, aiTypes: AI_SIEMPRE_ALERTA }, HORA_CERRADO);
    const ev = turno(game);
    expect(kinds(ev)).not.toContain("npc-initiates-shop");
    expect(textos(ev)).toContain(SHOP_CLOSED_MESSAGE);
  });

  it("M1 — el gate es el de #315, no una copia: el índice de tramo manda en las dos horas", () => {
    // El testigo INSTANCIA la diferencia: mismo NPC, mismos datos, dos horas — una a cada
    // lado de la paridad. Un mutante que quite el `if (!shopIsOpen(...))` mata el rechazo;
    // uno que lo NIEGUE mata la apertura. Ninguno de los dos sobrevive a este par.
    expect(scheduleIndex(TIMES_MAGIC, HORA_ABIERTO)).toBe(1);
    expect(scheduleIndex(TIMES_MAGIC, HORA_CERRADO)).toBe(0);
    expect(shopIsOpen({ times: TIMES_MAGIC }, HORA_ABIERTO)).toBe(true);
    expect(shopIsOpen({ times: TIMES_MAGIC }, HORA_CERRADO)).toBe(false);
  });

  it("M2 — MONTADO y en tramo: el insulto del caballo, y la tienda NO se abre", () => {
    const { game } = juego({ dialogNumber: DLG_MAGIC, transportTile: TILE_MONTADO });
    const ev = turno(game);
    expect(kinds(ev)).not.toContain("npc-initiates-shop");
    expect(textos(ev)).toContain('A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n');
  });

  it("★ M3 — MONTADO y FUERA de tramo: se oye la TIENDA CERRADA, NO el insulto del caballo", () => {
    // Éste es el aserto de ORDEN, y el único que muere si alguien pone la guarda del
    // caballo delante del gate horario: las dos condiciones fallan a la vez y sólo el
    // orden del binario decide cuál habla (0x03e7 antes de `call 0xe6`, 0x00ed dentro).
    // `AI_SIEMPRE_ALERTA` NO es decoración: con la terna real el fast-path no arma a
    // HORA_CERRADO (aiTypes[0]=0) y el turno saldría VACÍO — el aserto no fallaría por
    // el orden sino por no llegar. Es la misma razón que el bloque de ALCANZABILIDAD.
    const { game } = juego(
      { dialogNumber: DLG_MAGIC, aiTypes: AI_SIEMPRE_ALERTA, transportTile: TILE_MONTADO },
      HORA_CERRADO,
    );
    const t = textos(turno(game));
    expect(t).toContain(SHOP_CLOSED_MESSAGE);
    expect(t.join("")).not.toContain("HORSE OUT OF HERE");
  });

  it("la excepción 0x83 (HorseSeller) atiende A CABALLO — y por esta vía también", () => {
    const { game } = juego({ dialogNumber: DLG_HORSE, transportTile: TILE_MONTADO });
    expect(kinds(turno(game))).toContain("npc-initiates-shop");
  });

  it("la DIAGONAL no dispara: el fast-path exige manhattan 1 (NPC.OVL 0x0723)", () => {
    const { game } = juego({ dialogNumber: DLG_MAGIC, d: [1, 1] });
    expect(kinds(turno(game))).not.toContain("npc-initiates-shop");
  });

  it("aiType 4/5 sigue siendo condición: con la terna a 3 el turno no arma NADA", () => {
    const { game } = juego({ dialogNumber: DLG_MAGIC, aiTypes: [3, 3, 3] });
    const k = kinds(turno(game));
    expect(k).not.toContain("npc-initiates-shop");
    expect(k).not.toContain("guard-arrest-prompt"); // la trampa que cazó #301
    expect(k).not.toContain("guard-tribute-prompt");
  });

  it("★ FRONTERAS del reparto por dlgNum: sólo 0x80..0xFC entra en la rama de tienda", () => {
    // Barrido sobre los dos bordes derivados (0x0396 `jge 0x3a6` abajo; 0xFD/0xFE/0xFF
    // con handler propio arriba). Con `aiTypes` todo-4 para que el fast-path arme siempre
    // y lo único que decida sea el número.
    const entra = (dlg: number): boolean => {
      const { game } = juego({ dialogNumber: dlg, aiTypes: [4, 4, 4], times: [0, 0, 0, 0] });
      // times todo-cero ⇒ índice 0 ⇒ CERRADO: la firma de «entró en la rama» es el
      // rechazo, que ningún otro dlgNum puede producir. (El aserto NO usa la apertura,
      // que exigiría además estar en tramo.)
      return textos(turno(game)).includes(SHOP_CLOSED_MESSAGE);
    };
    for (const dlg of [0, 1, 8, 0x7f, 0xfd, 0xfe, 0xff]) {
      expect(entra(dlg), `dlgNum 0x${dlg.toString(16)} NO es tendero`).toBe(false);
    }
    for (const dlg of [0x80, 0x81, 0x85, 0x88, 0xfc]) {
      expect(entra(dlg), `dlgNum 0x${dlg.toString(16)} SÍ es tendero`).toBe(true);
    }
  });
});

describe("#304 — la NORMALIZACIÓN del aiType (TALK 0x0354): la tienda se abre UNA vez", () => {
  /**
   * El prólogo de `talk_converse_dispatch` degrada el aiType 4 a 1 EN LA TABLA VIVA
   * (0x0350 `cmp byte[si],cl` con cl=4 → 0x0354 `mov byte[si],1`), y el 4 es justo lo
   * que arma el fast-path de NPC.OVL 0x06e4 (0x0728 `jle 3`). Degradarlo DESARMA el
   * disparador, que es por lo que en 1988 el tendero no te vuelve a abordar.
   *
   * Sin esto la mecánica no es una mecánica sino un CEPO — medido en este árbol antes
   * del fix: `npc-initiates-shop` en el turno 1 Y en el turno 2 con la party quieta.
   */
  it("★ dos turnos pegado al tendero: abre en el PRIMERO y NO en el segundo", () => {
    const { game } = juego({ dialogNumber: DLG_MAGIC });
    expect(kinds(turno(game))).toContain("npc-initiates-shop");
    // Esperado EN CRUDO: el segundo turno no emite NADA. Un mutante que quite el
    // `mov byte[si],1` devuelve ["npc-initiates-shop"] y muere aquí.
    expect(kinds(turno(game))).toEqual([]);
  });

  it("y el aiType del tramo queda en 1 — el VALOR, no su ausencia de efecto", () => {
    const { game, npc } = juego({ dialogNumber: DLG_MAGIC });
    expect(npc.aiTypes[scheduleIndex(TIMES_MAGIC, HORA_ABIERTO)]).toBe(4); // antes
    turno(game);
    expect(npc.aiTypes[scheduleIndex(TIMES_MAGIC, HORA_ABIERTO)]).toBe(1); // 0x0354
    // …y los OTROS tramos intactos: el binario escribe UN byte, el del tramo vivo.
    expect(npc.aiTypes).toEqual([0, 1, 1]);
  });

  it("★ el aiType 5 NO se normaliza: el `cmp` es con 4, y es IGUALDAD", () => {
    // Testigo que instancia la diferencia donde existe: mismo escenario, aiType 5 en el
    // tramo vivo. El 5 arma el fast-path igual (0x0728 `jle 3` lo deja pasar) pero
    // 0x0350 no casa ⇒ sigue abordando en el turno 2. Un mutante que normalice `>= 4`
    // en vez de `=== 4` mata este aserto.
    const { game, npc } = juego({ dialogNumber: DLG_MAGIC, aiTypes: [0, 5, 1] });
    expect(kinds(turno(game))).toContain("npc-initiates-shop");
    expect(npc.aiTypes[1]).toBe(5);
    expect(kinds(turno(game))).toContain("npc-initiates-shop");
  });

  it("★ el RECHAZO fuera de tramo TAMBIÉN normaliza: 0x0348 va ANTES de 0x03e7", () => {
    // El prólogo corre antes del reparto por dlgNum, así que el tendero cerrado te
    // suelta su «Come see me…» UNA vez y deja de abordarte. Éste es el aserto que mata
    // al mutante que mueve la normalización DENTRO de la rama de apertura.
    const { game, npc } = juego(
      { dialogNumber: DLG_MAGIC, aiTypes: AI_SIEMPRE_ALERTA },
      HORA_CERRADO,
    );
    expect(textos(turno(game))).toContain(SHOP_CLOSED_MESSAGE);
    expect(npc.aiTypes[scheduleIndex(TIMES_MAGIC, HORA_CERRADO)]).toBe(1);
    expect(kinds(turno(game))).toEqual([]);
  });

  /**
   * 🔴 MUTANTE IMPOSIBLE EN ESTA GUARDA, y se declara en vez de fingirlo: «la
   * normalización NO corre por la rama del marcador 0x61 (hostil)». En el binario es
   * cierto —`npc_engine` 0x13a4 no entra en `talk_converse_dispatch`— pero aquí no hay
   * mutante que lo pueda violar: esa rama exige `aiType >= 6` y la normalización sólo
   * toca el 4, así que los dos conjuntos son DISJUNTOS por construcción y cualquier
   * mutante deja el aserto verde. Lo que sí guarda la separación es el orden del
   * código (el `return` del arresto va ANTES), y quien la rompa lo verá en los tests
   * de arresto de `blackthorn`, no aquí.
   */
});

describe("#304 — RNG: sonda PROPIA sobre la vía de proximidad (no heredada del censo #316)", () => {
  /**
   * #316 midió el consumo de las TIENDAS (17 sitios en el binario, 0 en el port) y predijo
   * «cero tiradas» para esta vía. La predicción se adjudica AQUÍ, con el contador del
   * arnés, porque la población de tiradas de `npc_tick_all` es OTRA que la de la consola:
   * lo que se mide es el TURNO ENTERO de la intercepción, no la tienda.
   *
   * Lo que este contador NO alcanza: la consola de la tienda (vive en `boot()`). Para esa
   * mitad el dato sigue siendo el censo de #316 (`shop.ts`/`shop-console.ts` sin ninguna
   * llamada al RNG, y su único import a un módulo consumidor es `import type`).
   */
  it("abrir la tienda por proximidad consume CERO tiradas", () => {
    const { game, tiradas } = juego({ dialogNumber: DLG_MAGIC });
    expect(kinds(turno(game))).toContain("npc-initiates-shop"); // el turno hizo su trabajo…
    expect(tiradas()).toBe(0); // …y no tocó el stream
  });

  it("y el RECHAZO fuera de tramo tampoco: la condición nueva no estrena ocasiones", () => {
    // Terna sintética por el mismo motivo que M3: el rechazo por proximidad no es
    // alcanzable con los datos de hoy (bloque de ALCANZABILIDAD), así que sin ella este
    // aserto mediría un turno que no entra en la rama.
    const { game, tiradas } = juego(
      { dialogNumber: DLG_MAGIC, aiTypes: AI_SIEMPRE_ALERTA },
      HORA_CERRADO,
    );
    expect(textos(turno(game))).toContain(SHOP_CLOSED_MESSAGE);
    expect(tiradas()).toBe(0);
  });
});

/**
 * ⚠ Lee `game/assets/npcs.json`, SALIDA DEL EXTRACTOR: gitignored y servido por symlink
 * (clase #307). Su ausencia no es propiedad del commit ⇒ se salta con razón nombrada.
 */
const NPCS_JSON = new URL("../assets/npcs.json", import.meta.url);
const hayExtraccion = ((): boolean => {
  try { readFileSync(NPCS_JSON); return true; } catch { return false; }
})();

describe.skipIf(!hayExtraccion)("#304 — POBLACIÓN y ALCANZABILIDAD, medidas sobre la extracción", () => {
  interface NpcDato { slot: number; aiTypes: number[]; times: number[]; dialogNumber: number }
  const porPueblo = JSON.parse(readFileSync(NPCS_JSON, "utf8")) as Record<string, NpcDato[]>;
  const tenderos = Object.values(porPueblo)
    .flat()
    .filter((n) => n && n.dialogNumber >= 0x80 && n.dialogNumber <= 0xfc);
  const conAi45 = tenderos.filter((n) => n.aiTypes.some((a) => a === 4 || a === 5));

  /** Horas del día en las que ESE tendero arma el fast-path (aiType 4/5 en su tramo). */
  const horasQueArman = (n: NpcDato): number[] =>
    Array.from({ length: 24 }, (_, h) => h).filter((h) => {
      const ai = n.aiTypes[scheduleIndex(n.times, h)] ?? 0;
      return ai === 4 || ai === 5;
    });

  it("los 14 de la ficha, y todos entran por la rama de tienda de 0x031E", () => {
    expect(conAi45).toHaveLength(14);
    expect(conAi45.every((n) => n.dialogNumber >= 0x80 && n.dialogNumber <= 0xfc)).toBe(true);
  });

  it("★ la intercepción MUERDE: los 14 arman en horas reales (167 horas-NPC en total)", () => {
    // Suelo anti-verde-hueco: sin esto, un fast-path que no armara nunca dejaría verde
    // todo lo de arriba y el juego sin la mecánica. Cada uno de los 14 arma en ALGUNA
    // hora y ninguno en las 24.
    const horas = conAi45.map((n) => horasQueArman(n).length);
    expect(Math.min(...horas)).toBeGreaterThan(0);
    expect(Math.max(...horas)).toBeLessThan(24);
    expect(horas.reduce((a, b) => a + b, 0)).toBe(167);
  });

  it("🔴 el RECHAZO por esta vía es HOY INALCANZABLE en los 14 — y se declara, no se tapa", () => {
    // Medición, no opinión: el MISMO `scheduleIndex` elige el aiType del fast-path Y la
    // paridad del gate, así que un tendero cuyo 4/5 viva sólo en tramos IMPARES arma
    // exactamente cuando su tienda está abierta. Barrido de 14 NPC × 24 h: cero horas en
    // las que la intercepción arme con la tienda cerrada.
    //
    // ⚠ ALCANCE de esta negativa (ventana declarada): vale para el MODELO DEL PORT, donde
    // el índice se recomputa en cada consulta. En el binario las dos lecturas pueden
    // discrepar por el PESTILLO de #84 (el índice ALMACENADO en `rt+0xe` sólo se refresca
    // en la transición horaria) — y ahí sí es alcanzable, en el turno de la transición.
    // Por eso el rechazo se cablea igual: es la conducta derivada, no código muerto.
    const conRechazo = conAi45.flatMap((n) =>
      horasQueArman(n).filter((h) => !shopIsOpen(n, h)).map((h) => `${n.dialogNumber}@${h}`),
    );
    expect(conRechazo).toEqual([]);

    // CONTROL POSITIVO — el predicado de arriba SABE encontrar el caso cuando existe:
    // el mismo barrido sobre un tendero sintético con aiType 4 en un tramo PAR lo saca.
    const sintetico: NpcDato = {
      slot: 99, dialogNumber: 0x85, aiTypes: [4, 0, 4], times: TIMES_MAGIC,
    };
    const controlado = horasQueArman(sintetico).filter((h) => !shopIsOpen(sintetico, h));
    expect(controlado.length).toBeGreaterThan(0);
  });
});

describe("#304 — el CALL-SITE de la UI (predicado de FUENTE, declarado frágil)", () => {
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

  it("el manejador del evento abre la MISMA consola que (T)alk, con el MISMO SHOP_TYPES", () => {
    const desde = main.indexOf('e.kind === "npc-initiates-shop"');
    expect(desde).toBeGreaterThan(0); // el ancla existe: si el refactor la mueve, ROJO
    const hasta = main.indexOf("}", main.indexOf("startShopConsole(shopType", desde));
    const rama = main.slice(desde, hasta);
    expect(rama).toContain("SHOP_TYPES[npc.dialogNumber]");
    expect(rama).toContain("shoppeKeeperAt(");
    expect(rama).toContain("startShopConsole(shopType");
  });

  it("y el gate horario NO se re-teclea en la UI: en esta vía vive en el core", () => {
    // La otra mitad del «una pieza, dos llamadores»: si alguien copiara aquí el gate,
    // habría dos sitios donde equivocarse. El de (T)alk lo guarda tienda-gate-horario-315.
    const desde = main.indexOf('e.kind === "npc-initiates-shop"');
    const hasta = main.indexOf("startShopConsole(shopType", desde);
    expect(main.slice(desde, hasta)).not.toContain("shopIsOpen");
  });
});
