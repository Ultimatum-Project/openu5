/**
 * FICHA #301 — **el NPC ARRANCA su conversación por quedarse ADYACENTE, sin (T)alk.**
 *
 * Reporte del usuario con vídeo del espejo (LordFenton part 7, cap. «Operation Sneak
 * past that guard on the roof»): el guardia del TEJADO del castillo de Lord British
 * interpela al grupo sin que el jugador pulse nada más que la dirección.
 *
 * ── EL MECANISMO (derivación entera en re/notes/npc-interpela-por-adyacencia-301.md) ──
 *   NPC.OVL 0x06e4  `dist_manhattan(party, npc) == 1` (0x0723; la distancia es
 *                   `|dx|+|dy|` SIN envolvimiento, 0x06a0 — la DIAGONAL vale 2 y NO
 *                   dispara) + aiType > 3 (0x0728) + dlgNum != 0 (0x0740)
 *                   → marcador 0x74 ('t' de talk, en ASCII) y `[0x65bf] = idx`
 *   TOWN.OVL 0x1352 `npc_engine` lo consume al cerrar el turno y en 0x13ce llama a
 *   TALK.OVL 0x031E `talk_converse_dispatch(idx)`, que con `0 < dlgNum < 0x80` toma
 *                   `run_scripted_conversation` (0x0396) y **devuelve 0 SIEMPRE**
 *                   (0x3a3→0x38e): corre la conversación ENTERA y no captura a nadie.
 *
 * 🔴 LO QUE ESTABA MAL, y por qué se lee como un no-op: `guard-encounters.ts` modelaba
 * el RETORNO (0 = sin captura) con un `return null` y TIRABA EL EFECTO, que es la
 * conversación. El comentario de aquella línea ya decía que el binario «corre su TLK y
 * devuelve 0» — la prosa estaba bien y el código se quedaba con la mitad.
 *
 * ── POBLACIÓN CENSADA (el test la recalcula abajo, no la cita de memoria) ─────────────
 * 33 NPC tienen aiType 4 o 5 en algún tramo horario. Partición: **13** con dlgNum 0xFF
 * (el guardia hardcodeado del Palacio, ya cableado desde F2-T4) + **6** con conversación
 * guionizada (`0 < dlgNum < 0x80`, los de ESTA ficha) + **14** TENDEROS
 * (`0x80..0xFC`, cuya rama abre tienda sin (T)alk → **ficha #304**, fuera de alcance).
 * Control de la partición: 13 + 6 + 14 = 33, y ninguna clase se solapa.
 * Los dos instrumentos coinciden: el censo por BYTES sobre los cuatro `.NPC` y el censo
 * sobre `game/assets/npcs.json` (salida del extractor) dan la misma partición.
 *
 * ★ El gate NO es una lista de slots: es el PREDICADO `dlgNum < 0x80`, y vive en
 * `Game.talkScriptFor` — el MISMO objeto que sirve al comando (T)alk. Por eso un `.NPC`
 * re-extraído no deja esta guarda rancia: cambia la población, no el predicado.
 *
 * ── RNG (ventana concedida por el lead el 2026-08-14) ─────────────────────────────────
 * La conversación consume la moneda de autopresentación (TALK 0x1153) **sólo en la
 * PRIMERA conversación con ese NPC** (gate `test_npc_met`, 0x113e). PREDICCIÓN ANCLADA:
 * *sólo se desplaza el stream en la PRIMERA intercepción de cada NPC no conocido; la
 * segunda intercepción del mismo NPC consume 0.* El último test de este fichero la
 * comprueba contando tiradas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData, type GameEvent } from "../src/core/game.js";
import type { SmallMapLocation, WorldData } from "../src/core/world/map.js";
import type { NpcManager, NpcRuntime } from "../src/core/npc/manager.js";
import { TalkScriptRegistry } from "../src/core/dialogue/registry.js";
import type { TalkScript } from "../src/core/dialogue/conversation.js";
import { PALACE_GUARD_TYPE } from "../src/core/world/blackthorn.js";

/** Britain: pueblo genérico (≠ 0x12 Palacio, ≠ 5 Minoc) — vive en el fichero TOWNE. */
const TOWN = 2;
/** dlgNum del guardia del TEJADO en los datos: loc 17 slot 27, tile 0x70, aiTypes [0,4,0]. */
const DLG_TEJADO = 8;

function makeChar(): CharacterState {
  return {
    name: "Avatar", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20,
    currentMp: 10, currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0,
  } as CharacterState;
}

function makeState(): GameState {
  return {
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, keys: 0, gems: 0, torches: 0, karma: 40,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 35 },
    turnsSinceStart: 0,
    position: { location: TOWN, floor: 0, x: 5, y: 5 },
    transport: "foot", prevHour: 12,
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

/** Script TLK mínimo: sólo hace falta que EXISTA con ese npcIndex. */
function script(npcIndex: number): TalkScript {
  const linea = [{ kind: "text" as const, text: "a big, mean, nasty, ugly guard!" }];
  return {
    npcIndex, name: linea, description: linea, greeting: linea, job: linea, bye: linea,
    qa: [], labels: [],
  };
}

interface NpcSpec {
  dialogNumber: number;
  aiTypes?: [number, number, number];
  /** Desplazamiento respecto al grupo. Por defecto (1,0) = ADYACENTE al este. */
  d?: [number, number];
}

/** Un NPC colocado respecto al grupo, con el `dialogNumber`/`aiType` que se instancie. */
function npcManagerCon(s: GameState, spec: NpcSpec): NpcManager {
  const [dx, dy] = spec.d ?? [1, 0];
  const npc = {
    slot: 27,
    type: PALACE_GUARD_TYPE,
    dialogNumber: spec.dialogNumber,
    aiTypes: spec.aiTypes ?? [4, 4, 4],
    times: [0, 0, 0, 0],
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

/** Registro con los scripts que se le pidan (por dialogNumber) en el fichero TOWNE. */
function registryCon(indices: number[]): TalkScriptRegistry {
  return new TalkScriptRegistry({
    towne: indices.map(script), dwelling: [], castle: [], keep: [],
  });
}

function juego(spec: NpcSpec, scripts = [DLG_TEJADO]): { game: Game; state: GameState } {
  const state = makeState();
  const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, state, {
    npcManager: npcManagerCon(state, spec),
    talkScripts: registryCon(scripts),
  });
  return { game, state };
}

/** Un turno de mundo con el NPC ya colocado. */
const turno = (game: Game): GameEvent[] => game.confirmTownExit(false);
const kinds = (events: GameEvent[]): string[] => events.map((e) => e.kind);

describe("#301 — el NPC interpela por ADYACENCIA (npc_engine TOWN 0x13ce → TALK 0x031E)", () => {
  it("guardia con conversación de datos (dlgNum 8) ADYACENTE: arranca la conversación", () => {
    const { game } = juego({ dialogNumber: DLG_TEJADO });
    const ev = turno(game);
    expect(kinds(ev)).toContain("npc-initiates-talk");
    // El evento NOMBRA al interlocutor: la UI resuelve su script y abre la consola de (T)alk.
    const e = ev.find((x) => x.kind === "npc-initiates-talk");
    expect(e?.initiatesTalk?.npc.dialogNumber).toBe(DLG_TEJADO);
  });

  it("CONTROL POSITIVO: el guardia hardcodeado (0xFF) sigue dando su demanda, no conversación", () => {
    const { game } = juego({ dialogNumber: 0xff });
    const k = kinds(turno(game));
    expect(k).toContain("guard-tribute-prompt"); // F2-T4 intacto
    expect(k).not.toContain("npc-initiates-talk");
  });

  it("la DIAGONAL no dispara: manhattan 2, y el fast-path exige 1 (0x0723 `cmp ax,1`)", () => {
    const { game } = juego({ dialogNumber: DLG_TEJADO, d: [1, 1] });
    expect(kinds(turno(game))).not.toContain("npc-initiates-talk");
  });

  it("aiType 3 no arma el slot: `cmp [bp-2],3 / jle` sale al bucle de movimiento (0x0728)", () => {
    // 🔴 Este aserto EMPEZÓ siendo `not.toContain("npc-initiates-talk")` a secas y el
    // mutante que borra el gate de aiType SOBREVIVIÓ: sin gate, un aiType 3 con tile de
    // guardia cae en la rama del marcador 0x61 y emite `guard-arrest-prompt` — o sea que
    // el aserto pasaba por la razón EQUIVOCADA (no salía conversación… porque salía un
    // ARRESTO). Lo que hay que exigir es lo que hace el binario: con aiType <= 3 el
    // fast-path no escribe `[0x65bf]` JAMÁS, así que el turno no arma NADA.
    const { game } = juego({ dialogNumber: DLG_TEJADO, aiTypes: [3, 3, 3] });
    const k = kinds(turno(game));
    expect(k).not.toContain("npc-initiates-talk");
    expect(k).not.toContain("guard-arrest-prompt");
    expect(k).not.toContain("guard-tribute-prompt");
  });

  it("TENDERO (dlgNum 0x84): NO entra por aquí — su rama es el gate horario, ficha #304", () => {
    const { game } = juego({ dialogNumber: 0x84 }, [DLG_TEJADO, 0x84]);
    expect(kinds(turno(game))).not.toContain("npc-initiates-talk");
  });

  it("dlgNum 0 no arma nada (gate 0x0740 `cmp word [bx+0xa],0 / je`)", () => {
    const { game } = juego({ dialogNumber: 0 });
    expect(kinds(turno(game))).not.toContain("npc-initiates-talk");
  });

  it("sin script en el .TLK no se abre nada (el registro manda, no el número)", () => {
    const { game } = juego({ dialogNumber: DLG_TEJADO }, [/* registro VACÍO */]);
    expect(kinds(turno(game))).not.toContain("npc-initiates-talk");
  });

  it("★ el PREDICADO es UNO: la intercepción dispara exactamente donde (T)alk resuelve script", () => {
    // Barrido sobre la frontera del gate. Si alguien duplica el predicado en la vía de
    // intercepción, estas dos columnas dejan de coincidir en algún dlgNum.
    for (const dlg of [0, 1, 8, 0x7f, 0x80, 0x84, 0xfc, 0xfd, 0xfe]) {
      const { game } = juego({ dialogNumber: dlg }, [0, 1, 8, 0x7f, 0x80, 0x84, 0xfc, 0xfd, 0xfe]);
      const npc = game.talkTarget("east")?.npc ?? null;
      const porTalk = npc !== null; // lo que ve el comando (T)alk
      const porAdyacencia = kinds(turno(game)).includes("npc-initiates-talk");
      expect(porAdyacencia, `dlgNum 0x${dlg.toString(16)}`).toBe(porTalk);
    }
  });
});

/**
 * ⚠ Este bloque lee `game/assets/npcs.json`, que es SALIDA DEL EXTRACTOR: gitignored y
 * servido por symlink. O sea que su rojo NO es una propiedad del commit — es la clase que
 * la ficha **#307** acaba de abrir. Para no añadir un cuarto caso mudo a esa clase, el
 * bloque se SALTA con razón nombrada si el fichero no está, en vez de fallar como si el
 * árbol estuviera roto. Con la extracción presente (el caso de la batería y de cualquier
 * dev con /byo montado) el censo corre y vigila de verdad.
 */
const NPCS_JSON = new URL("../assets/npcs.json", import.meta.url);
const hayExtraccion = ((): boolean => {
  try { readFileSync(NPCS_JSON); return true; } catch { return false; }
})();

describe.skipIf(!hayExtraccion)(
  "#301 — POBLACIÓN: la partición de los aiType 4/5 por clase de dialogNumber",
  () => {
  /** Censo VIVO sobre la extracción, no una cifra copiada. */
  function censo(): { total: number; hardcoded: number; guionizados: number; tenderos: number; seis: string[] } {
    const data = JSON.parse(readFileSync(NPCS_JSON, "utf8")) as Record<string, NpcSlotJson[]>;
    let total = 0, hardcoded = 0, tenderos = 0;
    const seis: string[] = [];
    for (const [loc, slots] of Object.entries(data)) {
      for (const s of slots) {
        if (!s.aiTypes.some((a) => a === 4 || a === 5)) continue;
        total++;
        if (s.dialogNumber === 0xff) hardcoded++;
        else if (s.dialogNumber > 0 && s.dialogNumber < 0x80) seis.push(`${loc}:${s.slot}`);
        else if (s.dialogNumber >= 0x80 && s.dialogNumber <= 0xfc) tenderos++;
      }
    }
    return { total, hardcoded, guionizados: seis.length, tenderos, seis: seis.sort() };
  }
  interface NpcSlotJson { slot: number; aiTypes: number[]; dialogNumber: number }

  it("33 con aiType 4/5 = 13 hardcodeados + 6 guionizados + 14 tenderos (partición exacta)", () => {
    const c = censo();
    expect(c.total).toBe(33);
    expect(c.hardcoded).toBe(13);
    expect(c.guionizados).toBe(6);
    expect(c.tenderos).toBe(14);
    // El control que hace de esto una PARTICIÓN y no tres cifras que casualmente suman:
    expect(c.hardcoded + c.guionizados + c.tenderos).toBe(c.total);
  });

  it("los SEIS guionizados son los de esta ficha, con el del tejado (loc 17 slot 27) dentro", () => {
    expect(censo().seis).toEqual(["1:11", "17:27", "18:16", "25:1", "29:4", "5:9"].sort());
  });
  },
);

describe("#301 — RNG: la predicción anclada de la ventana (2026-08-14)", () => {
  /**
   * «Sólo se desplaza el stream en la PRIMERA intercepción de cada NPC no conocido; la
   * segunda intercepción del mismo NPC consume 0.» El binario gatea la moneda de
   * autopresentación con `test_npc_met` (TALK 0x113e-0x1143) y con el NPC ya conocido
   * NI SIQUIERA llega al `call` de 0x1153.
   *
   * ⚠ El «met» lo marca el reto de AskName —`mark_npc_met` (TALK 0xd42) tiene UN solo
   * llamador, 0x0f02, dentro del handler de AskName—, no el saludo ni la moneda. Como
   * las DOS vías (comando (T)alk e intercepción) convergen en `talk_converse_dispatch`,
   * el momento del marcado es el MISMO por construcción: no hay divergencia que declarar.
   * El clon lo calca (`conversation.ts`, `AskName` → `this.met = true`).
   */
  it("la conversación de la intercepción es la MISMA del (T)alk ⇒ mismo consumo, no uno nuevo", () => {
    const { game } = juego({ dialogNumber: DLG_TEJADO });
    const porAdyacencia = turno(game);
    const e = porAdyacencia.find((x) => x.kind === "npc-initiates-talk");
    // El core no fabrica texto ni tira dados: sólo nombra al NPC. Todo el consumo (incluida
    // la moneda de autopresentación) vive en la Conversation que abre la UI, que es la
    // misma instancia que sirve al comando (T)alk sobre ese mismo NPC.
    expect(e?.initiatesTalk?.npc).toBe(game.talkTarget("east")?.npc);
    expect(porAdyacencia.filter((x) => x.kind === "message")).toHaveLength(0);
  });
});
