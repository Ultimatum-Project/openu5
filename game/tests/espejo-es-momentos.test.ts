/**
 * CAREO DE MOMENTOS ÚNICOS — espejo ES «Jugando a Ultima V [COMPLETADO]» (Fuente D,
 * tren #121; acta: re/notes/espejo-es-momentos-careo.md).
 *
 * NATURALEZA DEL TESTIGO (declarada): los bloques del espejo ES son ASR de YouTube
 * sobre el HABLA del jugador, no texto del juego. El careo es de CONDUCTA narrada
 * («se multiplican», «hemos muerto todos y sigo jugando», «no puede beber»), NUNCA
 * de strings del ASR. Los esperados de texto de abajo salen del DISASM/DATA.OVL
 * (en crudo, con cita), no del subtítulo.
 *
 * Cada bloque cita su momento como Ep+mm:ss (URL ?t= en el acta). Los dos primeros
 * son el CONTROL POSITIVO del encargo: momentos que los fixes recién aterrizados
 * (#114 gargolas-residuales, #122 blackthorn-captura, #125 blackthorn-deposito)
 * deben reproducir hoy.
 */
import { readFileSync } from "node:fs";
import { huella } from "../src/i18n/huella.js";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildEnemyDefs,
  decodeAbilities,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
  type EnemyDef,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatEvent,
  type CombatMapData,
  type PartyCombatant,
} from "../src/core/combat/combat.js";
import { NpcManager, type NpcSlot } from "../src/core/npc/manager.js";
import { DoorManager } from "../src/core/world/doors.js";
import { DungeonState } from "../src/core/dungeon/dungeon.js";
import { arenaForActorAttack, CombatMapIndex } from "../src/core/combat/encounters.js";
import { weaponBaseDamage, applyDefense, CombatRng } from "../src/core/combat/formulas.js";
import type { OriginalRng } from "../src/core/rng-original.js";
import {
  matchYellName,
  summonShadowlord,
  castShardIntoFlame,
  FLAME_X,
  FLAME_Y,
  FLAME_LOCATION,
  FLAME_FLOOR,
  SHADOWLORD_TILE,
} from "../src/core/quest/ritual.js";
import {
  blackthornCapture,
  runInterrogation,
  partyConsciousState,
  partyRefuge,
  REFUGE_KARMA_FLOOR,
  LOC_BLACKTHORN,
  LOC_LORD_BRITISH,
} from "../src/core/world/blackthorn.js";
import { jimmyLock } from "../src/core/world/commands.js";
import { tileInfo } from "../src/core/tiles.js";
import {
  Game,
  type CombatResources,
  type GameData,
  type GameSystems,
} from "../src/core/game.js";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import type { WorldData } from "../src/core/world/map.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const npcData = load<Record<number, NpcSlot[]>>("../assets/npcs.json");
const defByIndex = (i: number): EnemyDef => {
  const d = buildEnemyDefs(data, additionalFlags)[i];
  if (!d) throw new Error(`enemigo ${i} ausente`);
  return d;
};

/**
 * RNG-cebo que DELATA todo consumo: un CombatRng REAL cuyo generador interior
 * lanza en `next()`. Los asertos «sin tirada» (glass sword) lo usan de testigo:
 * si la fórmula tirara un rand, el test explota con el mensaje del cebo.
 */
const forbiddenRng = new CombatRng({
  next: () => {
    throw new Error("rand consumido donde el asm no tira");
  },
} as unknown as OriginalRng);

function char(status: string, over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "T",
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
    ...over,
  } as CharacterState;
}

function stub(fields: Partial<GameState>): GameState {
  return {
    version: 1,
    gold: 0,
    keys: 0,
    karma: 0,
    food: 0,
    partySize: (fields.characters ?? []).length,
    characters: [],
    position: { location: 0, floor: 0, x: 0, y: 0 },
    transport: "foot",
    time: { year: 139, month: 1, day: 1, hour: 12, minute: 30 },
    ...fields,
  } as GameState;
}

// ───────────────────────────────────────────────────────────────────────────
// C1 · CONTROL POSITIVO #114 — Ep17 8:18/8:56: las gárgolas de la azotea del
// Palacio atacan y «cada vez que golpeo las gárgolas se multiplican».
// El port de hoy: vía hostileNpcAttack/townAttackCommit (game.ts, TOWN 0x09BC,
// testigo citado en su docblock = ESTE vídeo) + divideOnHit en combate
// (combat.ts:2260, «{} divides!»).
// ───────────────────────────────────────────────────────────────────────────
describe("C1 · gárgolas del Palacio que se multiplican al golpearlas (Ep17 8:18-8:56)", () => {
  it("la GÁRGOLA (def 30) lleva divideOnHit — flag 0x1000 del bitmap [144,0]=0x9000 en crudo", () => {
    // Esperado EN CRUDO desde data.json (copia del binario), no desde el sujeto:
    expect(data.enemyFlags[30]).toEqual([144, 0]); // 0x9000: bludgeons+divideOnHit
    expect(defByIndex(30).abilities.divideOnHit).toBe(true);
  });
  it("niega el error Y afirma el rasgo: la RATA (def 20) NO divide — el rasgo no es universal", () => {
    expect(defByIndex(20).abilities.divideOnHit).toBe(false);
  });
  it("el catálogo (tile-0x40)/4 de 0x6150 lleva el tile de gárgola urbana 0xB8 al def 30", () => {
    expect((0xb8 - 0x40) >> 2).toBe(30); // la regla que townAttackCommit aplica
  });
});

// ───────────────────────────────────────────────────────────────────────────
// C2 · CONTROL POSITIVO #122/#125 — Ep16→17: la captura de Blackthorn. El LP
// despierta PRESO («Por qué dice que somos un prisionero», 18:56), sin llaves
// («Cómo escapo», 13:52), en la celda del sótano.
// ───────────────────────────────────────────────────────────────────────────
describe("C2 · captura de Blackthorn: celda del sótano y coste de UN compañero (Ep17)", () => {
  it("#125: el depósito deja a la party en el Palacio (0x12), planta -1 (g_floor=0xff), (10,7), sin llaves, a pie", () => {
    const st = stub({
      characters: [char("G"), char("G")],
      keys: 7,
      shrineDestroyed: [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], // sin interrogatorio
      position: { location: 0x12, floor: 3, x: 2, y: 2 },
    } as Partial<GameState>);
    const r = blackthornCapture(st, [], []);
    expect(r.shrine).toBeNull();
    expect(st.position.location).toBe(LOC_BLACKTHORN);
    expect(st.position.floor).toBe(-1); // BLCKTHRN 0x08e7: g_floor=0xff = sótano/celda (#125)
    expect(st.position.x).toBe(0x0a);
    expect(st.position.y).toBe(0x07);
    expect(st.keys).toBe(0); // «Cómo escapo» — la captura confisca las llaves
    expect(st.transport).toBe("foot");
  });
  it("#122: el interrogatorio fallado con party>1 cobra UN compañero (péndulo, ronda 4)", () => {
    // Roster NATIVO de 16 records — la ventana SAVED.GAM entera, como todo estado real
    // (`parseSaveWindow` siempre da 16): 3 en party + 13 fuera (partyStatus 0xff). El
    // fixture viejo de 3 records codificaba el modelo PRE-save-residuos (roster = solo
    // party, sacrificado ELIMINADO): desde el aparcamiento del slot 15 (BLCKTHRN
    // 0x046c-0x04d4, tren #135) `characters[15] = víctima` sobre un array de 3 lo
    // estiraba a 16 con huecos y el `toHaveLength(2)` refutaba EN FALSO una conducta
    // que es la del binario. Se asierta la conducta DERIVADA entera, sin aflojar el
    // coste (sigue cobrando EXACTAMENTE uno).
    const roster = [
      char("G", { name: "Avatar", partyStatus: 0 }),
      char("G", { name: "Iolo", partyStatus: 0 }),
      char("G", { name: "Shamino", partyStatus: 0 }),
      ...Array.from({ length: 13 }, (_, i) => char("G", { name: `PJ${i + 3}`, partyStatus: 0xff })),
    ];
    const st = stub({ characters: roster, partySize: 3, karma: 50 } as Partial<GameState>);
    const r = runInterrogation(st, 3, 0, "Ahm", ["no", "no", "no", "no"]);
    expect(r.outcome).toBe("pendulum");
    expect(r.sacrificed).toBe(1); // el coste inevitable que #122 probó del binario
    // (los dos carriles convergieron aquí: fix-c2-esc y el arrastre de save-residuos de
    // espejo-es-fotogramas asertaban el mismo aparcamiento — queda el superconjunto)
    expect(st.partySize).toBe(2); // lo que el length-2 del fixture viejo codificaba de verdad
    expect(st.characters.filter((c) => c.partyStatus === 0)).toHaveLength(2); // en party: 2
    // Ventana nativa INTACTA: 16 records y DENSOS (filter salta huecos — con el fixture
    // corto de 3 esto daría 3, no 16: es el detector de la trampa del array esparcido).
    expect(st.characters).toHaveLength(16);
    expect(st.characters.filter(Boolean)).toHaveLength(16);
    // El aparcamiento (0x04c2-0x04cf): la víctima es el 2º VIVO (nunca el Avatar) y su
    // record ENTERO viaja al slot 15 con el byte final [0x57A7]=0x7f.
    expect(st.characters[15]!.name).toBe("Iolo");
    expect(st.characters[15]!.partyStatus).toBe(0x7f);
    // Y la compactación corre TODOS los slots (0x04ab-0x04c0 hasta 0x57a8): el último
    // relleno (PJ15) queda en el 14.
    expect(st.characters[14]!.name).toBe("PJ15");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U1 · ÚNICO — Ep26 42:21-43:26 (y Ep29 49:42, Ep31 60:27): la ceremonia
// entera: decir el nombre → aparece → esperar → usar el Shard → «la perdición
// de Astaroth ha caído» (= doom message del binario). Sólo este espejo la
// ejercita TRES veces y narra el desenlace; el careo de texto va contra
// CAST.OVL/DATA.OVL en crudo.
// ───────────────────────────────────────────────────────────────────────────
describe("U1 · convocatoria + Shard = doom (Ep26 43:26, Ep29 49:42, Ep31 60:27)", () => {
  it("ASTAROTH convoca al idx 1 (odio) y el SL cae en y-2 (CMDS 0x1030)", () => {
    expect(matchYellName("ASTAROTH")).toBe(1);
    const r = summonShadowlord({
      word: "astaroth",
      partyY: FLAME_Y[1]!,
      alive: [true, true, true],
      shadowlordPresent: false,
    });
    expect(r).toEqual({ ok: true, idx: 1, spawnDy: 2 });
  });
  it("con el SL presente al norte, el Shard del Odio en la Llama del Amor obra el doom (CAST 0x15b4)", () => {
    const r = castShardIntoFlame({
      shardIdx: 1,
      partyX: FLAME_X[1]!,
      partyY: FLAME_Y[1]!,
      location: FLAME_LOCATION[1]!, // 31 = Empath Abbey
      floor: FLAME_FLOOR[1]!,
      tileAbove: SHADOWLORD_TILE,
      summonedIdx: 1,
    });
    expect(r.destroyed).toBe(true);
    // Esperado EN CRUDO (DATA.OVL 0x483b/0x4861/0x4874) — la «perdición…ha caído» del LP:
    expect(r.lines).toContain("\nThe doom of the Shadowlord Astaroth is wrought!\n");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U2 · ÚNICO — Ep26 44:32: tras el doom, el LP vuelve a decir el nombre y
// mide el NEGATIVO: «el [grito] sin efecto — astarot ha desaparecido».
// Ningún otro espejo re-convoca a un Shadowlord destruido.
// ───────────────────────────────────────────────────────────────────────────
describe("U2 · re-convocatoria tras el doom → No effect! (Ep26 44:32)", () => {
  it("con alive[1]=false la convocatoria falla con el string de CMDS 0x1076→0x11f4", () => {
    const r = summonShadowlord({
      word: "ASTAROTH",
      partyY: 9,
      alive: [true, false, true],
      shadowlordPresent: false,
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("\nNo effect!\n"); // DS 0x443c en crudo
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U3 · ÚNICO — Ep26 34:06/36:19 y 52:48: combate DIRECTO contra un Shadowlord
// («Estoy encerrado en el reino de los Shadow lords») y la espada de cristal
// que lo despacha de UN golpe («toma espadazo de cristal… Shadow lord se ha
// ido»). Los otros espejos jamás combatieron a un SL (AD lo declara verbatim;
// LP1: «the shadow lords aren't even coming out»).
// ───────────────────────────────────────────────────────────────────────────
describe("U3 · combate contra el Shadowlord: arena-plano y espada de cristal (Ep26 34:06/36:19/52:48)", () => {
  it("todo combate contra criatura 0xFC cae en la arena Psychedelic (ULTIMA.EXE 0x6150 §2b) — el «reino» del LP", () => {
    expect(arenaForActorAttack(0x08, 0xfc, 0x1c, 0)).toBe(CombatMapIndex.Psychedelic);
  });
  it("glass sword = 99 fijo + shatter SIN tirada (COMBAT 0x12d8) y 99 ignora armadura (0x1323)", () => {
    const roll = weaponBaseDamage(0x27, 0, forbiddenRng); // el cebo delataría un rand
    expect(roll).toEqual({ base: 0x63, shattered: true });
    expect(applyDefense(0x63, defByIndex(47).armour, forbiddenRng)).toBe(0x63);
  });
  it("el SHADOW LORD (def 47) tiene EXACTAMENTE 99 hp en crudo — un espadazo de cristal lo tumba justo", () => {
    expect(data.enemyStats[47]![5]).toBe(99); // esperado en crudo de data.json
    expect(defByIndex(47).hp).toBe(99);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U4 · ÚNICO — Ep15 23:45→38:11 y Ep23 53:28→58:01: wipe TOTAL de la party y
// el LP SIGUE JUGANDO (los otros espejos restauran save). Lo que narra —
// «hemos muerto todos», luego «una aparición de los British» — es el REFUGE
// de BLCKTHRN 0x0910: no hay game-over; LB aparece y la party despierta
// revivida en su castillo.
// ───────────────────────────────────────────────────────────────────────────
describe("U4 · party-wipe → refuge de Lord British y continuación (Ep15 23:45, Ep23 53:28)", () => {
  it("todo el grupo muerto = party_conscious_state -1 (kernel 0x39fc): el disparo del refuge", () => {
    expect(partyConsciousState(stub({ characters: [char("D"), char("D")] }))).toBe(-1);
  });
  it("partyRefuge revive al grupo a full HP y lo despierta en LB (0x11, planta 1, (10,10)), 6:00, karma suelo 75", () => {
    const st = stub({
      characters: [char("D"), char("D"), char("D")],
      karma: 12,
      food: 0,
      position: { location: 0x21, floor: 5, x: 3, y: 3 }, // murió en mazmorra (Ep23: sala del wisp)
    });
    const r = partyRefuge(st);
    expect(r.revived).toBe(3);
    expect(st.characters.every((c) => c.status === "G" && c.currentHp === c.maxHp)).toBe(true);
    expect(st.position.location).toBe(LOC_LORD_BRITISH);
    expect(st.position.floor).toBe(1);
    expect(st.position.x).toBe(0x0a);
    expect(st.position.y).toBe(0x0a);
    expect(st.karma).toBe(REFUGE_KARMA_FLOOR); // 75 (0x0bfd)
    expect(st.time.hour).toBe(6);
    expect(st.food).toBe(0x3f); // estaba a 0 → 63 (0x0c3f)
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U5 · ÚNICO — Ep19 49:52: el LP intenta que el MUERTO beba de la fuente
// («no puede beber de la Fuente… pensaba a lo mejor puede resucitar») y el
// juego lo rechaza. LOOKOBJ 0x0162: estado 'D'/'S' → «Incapacitated!»
// (DS 0x72ce); la rama vive en main.ts:2336-2338 (piel). Aquí se carea que
// la clave user-facing EXISTE y está traducida (lo que el jugador ES vio).
// ───────────────────────────────────────────────────────────────────────────
describe("U5 · el muerto no bebe de la fuente (Ep19 49:52)", () => {
  it("«Incapacitated!» es clave del corpus i18n (es.json) — la rama D/S de LOOKOBJ 0x018f-0x019a", () => {
    const es = load<{ strings: Record<string, { t: string }> }>("../src/i18n/es.json");
    // #380: la tabla se indexa por la HUELLA del inglés, no por el inglés.
    expect(Object.keys(es.strings)).toContain(huella("Incapacitated!"));
    expect((es.strings[huella("Incapacitated!")]?.t ?? "").length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U6 · ÚNICO — Ep17 4:20/25:11: forzar las cadenas de un prisionero del
// Palacio lo libera y SUBE el karma («con esto me sube el Karma a 92»).
// SJOG 0x0E22: éxito en pueblo → libera + «"I thank thee!"» + karma+2.
// ───────────────────────────────────────────────────────────────────────────
describe("U6 · liberar al prisionero sube el karma (Ep17 4:20/25:11)", () => {
  it("jimmyLock kind=prisoner con éxito en pueblo: freed + karmaDelta 2 + gratitud DS 0x8b36 en crudo", () => {
    const r = jimmyLock(
      { kind: "prisoner", tile: 0x84, dex: 30, location: 0x12 },
      () => 0, // rand(0,29)=0 < DEX ⇒ éxito determinista
    );
    expect(r.success).toBe(true);
    expect(r.freed).toBe(true);
    expect(r.karmaDelta).toBe(2); // 0x0ED3 add_capped(&g_karma, 2, 0x63)
    expect(r.message).toBe('\n"I thank thee!"\n'); // DATA.OVL fileoff 0x8b46 VERBATIM
  });
});

// ───────────────────────────────────────────────────────────────────────────
// U7 · ÚNICO — Ep11 1:47-2:49: caída al Underworld por la CASCADA yendo EN
// ALFOMBRA, sin perderla. ASR verbatim del bloque (subs/11-*[10].srt 1:50-2:20):
// «si uso la alfombra voladora en la cascada puedo No oh … he caído en el mundo
// subterráneo … maldición tengo una alfombra voladora Cómo vuelvo para arriba …
// Up No» — cae, CONSERVA la alfombra y no hay Up de vuelta.
//
// ★ DIVERGENCIA D1 — CERRADA (carril catarata-transporte; ficha en el acta §4).
// El binario comprueba en DOS sitios del BUCLE EXTERIOR de MAINOUT (back-edge
// 0x0d1a jmp 0xa8f — TODO transporte):
//   · SITIO A (0x05b2): vecino-sur `g_vis_tile_south`, en la ENTRADA de
//     tick_and_getkey (0x0598, llamada 0x0b14 en CADA iteración, antes de leer
//     tecla); al disparar, `falls` corre y la rutina devuelve «tecla» 0 →
//     handler 0x0af8 (sin reloj ni world-turn) → re-comprueba = CASCADA.
//   · SITIO B (0x0d05): tile BAJO la party `[bp-0x10]` (get_tile_ptr 0x4402
//     sobre (x,y) exactos), al cierre de todo turno CONSUMIDO ([bp-8]≠0,
//     gate 0x0c30) — también en turnos SIN paso.
// El port lo cableaba sólo en la vía NAVAL; hoy los dos sitios corren en
// runContextTurn (game.ts checkWaterfall/checkWaterfallUnder — población
// derivada en su docblock). La alfombra se conserva porque `falls` (OUTSUBS
// 0x0458) sólo OCULTA g_transport_tile durante el daño (0x049d guarda /
// 0x04fa-0x04fd restaura).
//
// (Era `it.fails` como trinquete de la divergencia; el fix lo hizo enrojecer y
// aquí queda promovido a `it`, como dictaba el acta.)
// ───────────────────────────────────────────────────────────────────────────
describe("U7 · cascada en alfombra: cae al Underworld CON la alfombra (Ep11 1:47)", () => {
  const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
  const makeWorld = (): WorldData => {
    const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5)); // 5 = Grass (tile 4 es LENTO, clase «Slow progress!»)
    overworld[137]![54] = 0xd4; // LA catarata-entrada (54,137)
    return { overworld, underworld: overworld, smallMaps: new Map() };
  };
  it("FIEL (D1 cerrada): en alfombra, F-A-L-L-S + Falling into underworld!! con la alfombra preservada", () => {
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0, x: 54, y: 135 },
      transport: "carpet",
      transportTile: 0x14, // alfombra
      magicCarpets: 1,
      torches: 0,
      torchTurns: 0,
      prevHour: 12,
      wind: 0,
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      questFlags: {},
      worldObjects: [],
      specialItems: {
        spyglass: false,
        hmsCape: false,
        sextant: false,
        pocketWatch: false,
        blackBadge: false,
        woodenBox: false,
      },
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const game = new Game({} as ExtractedInitialState, makeWorld(), gameData, st, {});
    const evs = game.move("south"); // (54,136); vecino-sur = catarata
    const texts = evs.filter((e) => e.kind === "message").map((e) => (e as { text?: string }).text);
    expect(texts).toContain("F-A-L-L-S!!!\n"); // DS 0x39b5
    expect(texts).toContain("Falling into underworld!!\n"); // DS 0x39c3
    expect(st.position.floor).toBe(0xff);
    expect(st.transport).toBe("carpet"); // 0x049d/0x04fa-0x04fd: preservada — el LP la conserva
  });
  it("CONTROL POSITIVO de la divergencia: el MISMO tablero con esquife SÍ cae (la vía naval está cableada)", () => {
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0, x: 54, y: 135 },
      transport: "skiff",
      transportTile: 0x2a,
      torches: 0,
      torchTurns: 0,
      prevHour: 12,
      wind: 0,
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      questFlags: {},
      worldObjects: [],
      specialItems: {
        spyglass: false,
        hmsCape: false,
        sextant: false,
        pocketWatch: false,
        blackBadge: false,
        woodenBox: false,
      },
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const world = makeWorld();
    // Bajo el esquife: agua (tile 1) en la columna de la catarata, para que navegue.
    for (let y = 130; y <= 140; y++) world.overworld[y]![54] = 1;
    world.overworld[137]![54] = 0xd4;
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const texts = game
      .move("south")
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text?: string }).text);
    expect(texts).toContain("F-A-L-L-S!!!\n");
    expect(st.position.floor).toBe(0xff);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// N1-N5 — los cinco NO-REPRO-SIN-FOTOGRAMAS del acta §5, adjudicados MIRANDO
// los fotogramas (carril espejo-es-fotogramas: tramos re-bajados por goteo y
// borrados; frames en original/av-referencia/yt/jugando-es/momentos/, gitignored).
// El testigo ya NO es ASR: es imagen — los strings citados abajo salieron del
// LOG EN PANTALLA de los frames y se carearon contra DATA.OVL/disasm en crudo.
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// N2 · Stonegate: los «SLs dormidos en sus habitaciones» (Ep22 5:18/15:37/19:55).
// Frames: la entrada imprime los TRES «An air of <X> doth surround thee...»
// (cubierto por shadowlord-urban.test.ts: Stonegate = los tres vivos, orden
// 2→1→0); los sprites «dormidos» son los TRES residentes 0xFC del .NPC de la
// loc 29 (estáticos, ai=0) y quien «se despierta» y ataca es el DAEMON 0xD8
// (ai=4) — el log del combate de los frames dice «Daemon barely wounded! …
// Daemon killed! VICTORY!», nunca Shadow Lord. VEREDICTO: FIEL (la nota previa
// del acta confundía el sistema URBANO —que sí excluye Stonegate— con los
// residentes del .NPC, que el port hidrata con el dato real).
// ───────────────────────────────────────────────────────────────────────────
describe("N2 · Stonegate: 3 SLs residentes del .NPC + daemon hostil (Ep22 5:18/15:37/19:55)", () => {
  const stonegate = (): NpcSlot[] => {
    const slots = npcData[29];
    if (!slots) throw new Error("npcs.json sin loc 29");
    return slots.filter((s) => s.type !== 0);
  };

  it("el .NPC de Stonegate (loc 29) siembra EN CRUDO 3×0xFC en sus «habitaciones» + 0xD8 + 4×0x94 + cetro 0xB6", () => {
    const sg = stonegate();
    const byType = (t: number): NpcSlot[] => sg.filter((s) => s.type === t);
    // Los tres Shadowlords residentes, simétricos — las «habitaciones» del LP.
    expect(byType(0xfc).map((s) => [s.x[0], s.y[0]])).toEqual([
      [5, 15],
      [15, 5],
      [25, 15],
    ]);
    // …y ESTÁTICOS (aiTypes 0 = fixed): «dormidos» = no se mueven de su celda.
    for (const s of byType(0xfc)) expect(s.aiTypes).toEqual([0, 0, 0]);
    // El que ataca en los frames: UN daemon, ai=4 en las tres franjas.
    expect(byType(0xd8)).toHaveLength(1);
    expect(byType(0xd8)[0]!.aiTypes).toEqual([4, 4, 4]);
    // 4 murciélagos (los «bats de Stonegate» del docblock de hostileNpcAttack).
    expect(byType(0x94)).toHaveLength(4);
    // Y el cetro (slot 9, objeto plot 0xB6 — TOWN 0x1253 lo RETIRA sólo si se porta).
    expect(byType(0xb6).map((s) => s.slot)).toEqual([9]);
  });

  it("NpcManager.enterMap(29) hidrata los 8 ACTORES — los 0xFC residentes NO se filtran", () => {
    const mgr = new NpcManager(npcData);
    const st = stub({
      characters: [char("G")],
      activeCharacter: 0,
      npcDead: [],
      npcMet: [],
      position: { location: 29, floor: 0, x: 15, y: 30 },
    } as Partial<GameState>);
    mgr.enterMap(29, st);
    const sg = mgr.npcsAt(29, 0);
    expect(sg).toHaveLength(8); // 3 SL + 1 daemon + 4 bats (el cetro va por objectPlacements)
    expect(sg.filter((n) => (n.type & 0xff) === 0xfc)).toHaveLength(3);
    expect(sg.filter((n) => (n.type & 0xff) === 0xd8)).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// N3 · «atacando cuerpo a cuerpo le has dado a Yana» (Ep18 55:44). Frames: el
// log real es «…armed with Magic Axe: >Attack-Aim! / Bat missed! / Jaana
// grazed!» (…hasta «Jaana killed!») — NO era melé: era un arma A DISTANCIA
// apuntada, y el golpe a la compañera es el SCATTER del fallo (COMSUBS:0x0822
// 0852-0870): el proyectil aterriza en una celda aleatoria ADYACENTE AL
// OBJETIVO (reintenta si es la del tirador) y golpea CON DAÑO COMPLETO a quien
// esté allí. «Lo tienes justo al lado» del LP = Jaana adyacente al murciélago.
// VEREDICTO: FIEL — la vía está portada en Combat.attackWith; este test la
// INSTANCIA donde la diferencia existe (compañera adyacente al objetivo).
// ───────────────────────────────────────────────────────────────────────────
describe("N3 · fuego amigo del fallo a distancia (Ep18 55:44)", () => {
  it("el disparo FALLADO scatterea a celda adyacente al objetivo y golpea a la compañera (COMSUBS 0x0822 0852-0870)", () => {
    // Fallo DETERMINISTA: umbral (defStat−atkStat+30)/2 = (99−3+30)/2 = 63 > 30
    // ⇒ rand30() nunca alcanza (COMBAT 0x14D6 154d-1566): toda tirada es miss.
    const dodgy: EnemyDef = {
      ...defByIndex(21), // Bat — el enemigo del momento
      dex: 99,
      damage: 1,
      hp: 60,
      doesNotMove: true, // congela al objetivo en su esquina entre turnos
      attackRange: 1,
      abilities: decodeAbilities(0), // sin veneno/divide/etc.: el aserto es del scatter
    };
    const st = stub({
      characters: [
        char("G", { name: "Reinhart", dexterity: 3 }),
        char("G", { name: "Jaana", dexterity: 3, currentHp: 60, maxHp: 60 }),
        char("G", { name: "Iolo", dexterity: 3, currentHp: 60, maxHp: 60 }),
        char("G", { name: "Shamino", dexterity: 3, currentHp: 60, maxHp: 60 }),
      ],
      activeCharacter: 0,
    } as Partial<GameState>);
    const party: PartyCombatant[] = st.characters.map((record, i) => ({
      charIdx: i,
      record,
      // Sólo el tirador lleva arma a distancia; el resto, melé (no dispara nadie más).
      weapons: [i === 0 ? { attack: 10, range: 3 } : { attack: 10, range: 1 }],
    }));
    const combat = new Combat({
      map: combatMaps[0]!,
      entryDirection: "south",
      party,
      enemies: [{ def: dodgy, count: 1 }],
      seed: 777,
      state: st,
      defenseValues: data.defenseValues,
    });
    // Geometría del momento: objetivo en la ESQUINA (0,0) — sus únicas celdas
    // adyacentes válidas son (0,1)/(1,0)/(1,1) y las ocupan las compañeras ⇒ el
    // scatter (que reintenta fuera de rejilla y la celda del tirador) SÓLO puede
    // caer en una compañera. Tirador a distancia 2, dentro del alcance 3.
    const byName = (n: string) =>
      combat.combatants.find(
        (c) => c.kind === "player" && st.characters[c.charIdx!]?.name === n,
      )!;
    const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
    enemy.x = 0;
    enemy.y = 0;
    byName("Jaana").x = 0;
    byName("Jaana").y = 1;
    byName("Iolo").x = 1;
    byName("Iolo").y = 0;
    byName("Shamino").x = 1;
    byName("Shamino").y = 1;
    const shooter = byName("Reinhart");
    shooter.x = 0;
    shooter.y = 2;
    // Avanza la iniciativa hasta el turno del tirador (el bat no se mueve y su
    // melé de daño 1 no tumba a nadie con 60 hp).
    const evs: CombatEvent[] = [];
    let guard = 0;
    while (combat.currentUnit?.id !== shooter.id && guard++ < 40) {
      if (combat.currentUnit?.kind === "enemy") evs.push(...combat.tickEnemyTurns());
      else evs.push(...combat.playerPass());
    }
    expect(combat.currentUnit?.id).toBe(shooter.id);
    const shot = combat.playerAttack(0, 0);
    // El aserto del momento: una COMPAÑERA (player ≠ tirador) recibe el golpe del
    // disparo del tirador — attackWith(strike) emite `attacked hit:true` con ella
    // de target («Jaana hit!»/«… grazed!» del log de los frames).
    const friendly = shot.filter(
      (e) =>
        e.kind === "attacked" &&
        (e as { actorId?: number }).actorId === shooter.id &&
        (e as { hit?: boolean }).hit === true &&
        combat.combatants.find((c) => c.id === (e as { targetId?: number }).targetId)?.kind ===
          "player",
    );
    expect(friendly).toHaveLength(1);
    // Control del instrumento: el objetivo declarado NO fue golpeado (el miss es real).
    expect(
      shot.some(
        (e) => e.kind === "attacked" && (e as { targetId?: number }).targetId === enemy.id,
      ),
    ).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// N4 · «hemos perdido la batalla… estamos en el mundo subterráneo» (Ep30 57:01).
// Frames: NO fue una derrota por muerte — el log real es «>Klimb-Down! /
// Escape! / BATTLE IS LOST! / Exit to Underworld!»: el último miembro huyó por
// la ESCALERA de la sala (L8) con enemigos vivos. La cadena entera está portada
// (Combat.playerKlimbEscape + game.endCombat escapeFloorDelta + exitDungeonTo);
// las piezas 0xC8/0xC9/grate y los deltas ya tienen suite propia
// (combat-klimb-grate.test.ts, refuge-live.test.ts E3c-2). Lo que NINGUNA
// cubría es el CASO FRONTERA del LP: piso 7 + delta +1 = nf 8 ⇒ salir al
// UNDERWORLD (game.ts branch nf>=8 → exitDungeonTo(true), DUNGEON 0x1E10).
// VEREDICTO: FIEL — y este test fija la frontera exacta que el LP midió.
// ───────────────────────────────────────────────────────────────────────────
describe("N4 · Klimb-Down en sala de L8 con enemigos vivos → BATTLE IS LOST! + Exit to Underworld! (Ep30 57:01)", () => {
  it("piso 7 + escapeFloorDelta +1 = nf 8 ⇒ BATTLE IS LOST! + Exit to Underworld! + floor 0xFF", () => {
    const gameData: GameData = {
      locationsX: Array.from({ length: 40 }, () => 100),
      locationsY: Array.from({ length: 40 }, () => 100),
      locationNames: [],
    };
    const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const st = stub({
      characters: [char("G")],
      activeCharacter: 0,
      position: { location: 0x21, floor: 7, x: 1, y: 1 },
      worldObjects: [],
      questFlags: {},
      // hydrateUnderworldPlot (OUTSUBS 0x0566) corre al emerger al Underworld y
      // lee los flags de shards/amuleto para decidir qué re-sembrar.
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
    } as Partial<GameState>);
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const floors = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ type: 0, sub: 0 }))),
    );
    (game as unknown as { dungeonState: DungeonState }).dungeonState = new DungeonState(
      [{ location: 0x21, name: "Deceit", floors }],
      { dungeon: 0x21, floor: 7, x: 1, y: 1, facing: "south" },
    );
    // Combate de sala ya huido por la escalera↓ (la mecánica del Klimb-escape en sí
    // tiene suite propia; aquí va el PUENTE con el caso frontera del LP).
    (game as unknown as { combat: unknown }).combat = {
      victory: false,
      finalSeed: 1,
      escapeFloorDelta: 1, // Klimb-Down! (0xC9)
      lastEscapeBorder: null,
      collectSpoils: () => ({ gold: 0 }),
      combatants: [{ kind: "player", charIdx: 0, status: "fled", hp: 5 }],
    };
    const ev = game.endCombat();
    const texts = ev.filter((e) => e.kind === "message").map((e) => (e as { text?: string }).text);
    expect(texts).toContain("BATTLE IS LOST!"); // COMBAT.OVL 0x0cda, DS 0x6eee
    expect(texts).toContain("Exit to Underworld!"); // DUNGEON 0x1d31, DS 0x6c8e
    expect(ev.some((e) => e.kind === "dungeon-exited")).toBe(true);
    expect(st.position.floor).toBe(0xff); // el Underworld
    expect(game.dungeonState).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// N5 · «cuando mato a una gárgola se convierte en piedra y no puedo pasar…
// no puedo destruir las piedras» (Ep30 44:10/46:33). Frames: en la sala L8
// aparece un MONTÓN DE PIEDRAS donde muere cada gárgola (dif. entre frames
// t2645→t2655 con el log «Gargoyle killed! ×2»). Derivado del ASM — muerte de
// enemigo, COMBAT.OVL 0x1574:
//   16fb: cmp byte [bx+3], 0x1e        ; def index 30 = GARGOYLE
//   1701-1707: push x / push y / call 0xa172   ; puntero a la celda del MAPA
//   170c: mov byte [bx], 0x4c          ; ⇒ tile 0x4C (roca baja) EN EL SUELO
//   170f: jmp 0x171f                   ; …saltando cofre/sangre: SIN botín
// 0x4C = SMALL_ROCK_WALL (game.ts:796): intransitable a pie (en pueblo sólo se
// cruza ENCARAMÁNDOSE con K, y el combate no tiene ese Klimb) e indestructible
// — exactamente el «no puedo pasar / no puedo destruir» del LP. El port hace
// dropLoot genérico (cofre/sangre en lootLayer, celda transitable): DIVERGENCIA
// D2 (ficha §4 del acta).
// ───────────────────────────────────────────────────────────────────────────
describe("N5 · la gárgola muerta deja roca 0x4C que bloquea (Ep30 44:10/46:33)", () => {
  /** Pelea 1-PJ (arma 99 fija = un golpe mata; base 0x63 no consume rand) vs `def` hasta victoria. */
  function killOne(def: EnemyDef): { combat: Combat; died: { x: number; y: number } } {
    const st = stub({
      characters: [char("G", { name: "Reinhart", dexterity: 25, currentHp: 90, maxHp: 90 })],
      activeCharacter: 0,
    } as Partial<GameState>);
    const party: PartyCombatant[] = st.characters.map((record, i) => ({
      charIdx: i,
      record,
      weapons: [{ attack: 99, range: 1 }],
    }));
    const combat = new Combat({
      map: combatMaps[0]!,
      entryDirection: "south",
      party,
      enemies: [{ def, count: 1 }],
      seed: 4242,
      state: st,
      defenseValues: data.defenseValues,
    });
    const evs: CombatEvent[] = [];
    let ticks = 0;
    while (!combat.victory && ticks++ < 400) {
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
    const died = evs.find((e) => e.kind === "died") as { x: number; y: number } | undefined;
    if (!died) throw new Error("sin evento died");
    return { combat, died: { x: died.x, y: died.y } };
  }

  it("FIEL (D2): al morir la gárgola, el SUELO de la celda pasa a 0x4C y NO hay cofre/sangre", () => {
    const gargoyle = defByIndex(30); // catálogo (0xB8-0x40)/4 = 30, tile 440 (los frames)
    const { combat, died } = killOne(gargoyle);
    // 170c: mov [bx],0x4c — la roca queda EN EL MAPA de la arena (mapTiles es la rejilla viva)…
    expect(combat.mapTiles[died.y]![died.x]).toBe(0x4c);
    // …y 170f salta el roll de botín: ni cofre ni sangre en la celda (lootTiles vacía ahí).
    expect(combat.lootTiles().some((l) => l.x === died.x && l.y === died.y)).toBe(false);
  });

  it("FIEL (D2) — la CONDUCTA narrada, no sólo el número: la celda petrificada NO se pisa a pie", () => {
    // El LP no dice «0x4C»: dice «no puedo pasar». El aserto de arriba fija el BYTE del
    // crudo; éste instancia lo que el byte PROVOCA, y por el mismo predicado que consulta
    // el mover de combate para la party (`tilePassableFor` con isPlayer ⇒ `info.walkable`).
    const { combat, died } = killOne(defByIndex(30));
    expect(tileInfo(combat.mapTiles[died.y]![died.x]!).walkable).toBe(false);
    // CONTROL NEGATIVO en la MISMA celda-función: donde muere la RATA el suelo sigue
    // siendo el del mapa y SÍ se pisa ⇒ el bloqueo es del def 30, no del hecho de morir.
    const rata = killOne(defByIndex(20));
    expect(tileInfo(rata.combat.mapTiles[rata.died.y]![rata.died.x]!).walkable).toBe(true);
  });

  it("CONTROL POSITIVO: una RATA muerta deja botín normal (cofre/sangre) y el suelo NO cambia", () => {
    const rat = defByIndex(20); // Rat(20)→400 — sin caso especial en 0x16c0/0x16fb
    expect(rat.abilities.noCorpse || rat.abilities.disappearsOnDeath).toBe(false);
    const { combat, died } = killOne(rat);
    expect(combat.mapTiles[died.y]![died.x]).not.toBe(0x4c);
    expect(combat.lootTiles().some((l) => l.x === died.x && l.y === died.y)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// N1 · el SL «arrebata» el cetro y «lo devuelve a Stonegate» (Ep26 34:38/37:26/
// 54:23). Frames: el robo NO es un gesto de combate — al trabarse el combate
// contra el SL el log dice «Attacked! SHADOW LORD / The Sceptre is reclaimed!
// *** CONFLICT ***», y tras la VICTORIA («shattered! Shadow Lord vanishes!
// VICTORY!») el cetro NO vuelve: la party regresa a Stonegate a por él.
// Derivación (cierra la ficha I1 del acta): el portador está en el KERNEL,
// enter_combat_vs_actor (ULTIMA.EXE 0x6150), rama SL del switch de arena:
//   61f3: cmp [bp-8],0xfc / 61fa: arena=0xa    ; Psychedelic (ya portado)
//   61ff: cmp byte [g_sceptre],0 / je …        ; ¿se porta el cetro?
//   6209-620d: push 0xa406 / call print        ; «The Sceptre is reclaimed!»
//   6210-6221: tone_sweep(0xfd2,1,0xfde8,1,1)  ; el sweep del arrebato
//   6224: mov byte [g_sceptre],0               ; ⇒ el cetro se pierde AL ENTRAR
// El censo-cero de I1 (grep 0x57b5) era CIEGO: la dirección está SIMBOLIZADA
// (`g_sceptre`) en los .asm — el control 0x57b6 casaba porque los shards no lo
// están. Y la «devolución»: el cetro es PERENNE en el .NPC de Stonegate (slot
// 9) y TOWN 0x1253-0x1265 lo RETIRA al cargar sólo si g_sceptre≠0 ⇒ con el
// cetro arrebatado, re-aparece solo. El port tiene la arena y el teleport del
// SL, y el gate de re-siembra (hydrateInteriorObjects sobre lbArtifacts.
// sceptre) — le falta la RAMA DEL ARREBATO: DIVERGENCIA D3 (ficha §4).
// ───────────────────────────────────────────────────────────────────────────
describe("N1 · combate contra el SL portando el cetro: The Sceptre is reclaimed! (Ep26 34:38)", () => {
  const TOWN_LOC = 2;
  function makeTownGame(sceptre: boolean): { g: Game; st: GameState } {
    const overworld = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
    const townTiles = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
    const world: WorldData = {
      overworld,
      underworld: overworld,
      smallMaps: new Map([
        [TOWN_LOC, { id: TOWN_LOC, name: "Test Town", floors: [{ z: 0, tiles: townTiles }] }],
      ]),
    };
    const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
    const combatResources: CombatResources = {
      combatMaps,
      enemyDefs: buildEnemyDefs(data, additionalFlags),
      attackValues: [],
      attackRangeValues: [],
      defenseValues: data.defenseValues,
    };
    // Un Shadowlord URBANO adyacente al este de la party (15,15) — tile 0xFC.
    const slSlot: NpcSlot = {
      slot: 1,
      aiTypes: [0, 0, 0],
      x: [16, 16, 16],
      y: [15, 15, 15],
      z: [0, 0, 0],
      times: [0, 8, 16, 24],
      type: 0xfc,
      dialogNumber: 0,
    };
    const npcManager = new NpcManager({ [TOWN_LOC]: [slSlot] });
    const st = stub({
      characters: [char("G", { name: "Reinhart", dexterity: 25 })],
      activeCharacter: 0,
      position: { location: TOWN_LOC, floor: 0, x: 15, y: 15 },
      npcDead: [],
      npcMet: [],
      worldObjects: [],
      questFlags: {},
      lbArtifacts: { amulet: false, crown: false, sceptre },
    } as Partial<GameState>);
    const systems: GameSystems = { npcManager, doors: new DoorManager(), combatResources };
    const g = new Game({} as ExtractedInitialState, world, gameData, st, systems);
    npcManager.enterMap(TOWN_LOC, st);
    return { g, st };
  }

  /**
   * Un Game sobre el .NPC REAL de Stonegate (npcs.json loc 29, el mismo dato que censa N2:
   * el cetro es el objeto 0xB6 de la ranura 9) que COMPARTE el estado con el del arrebato.
   * Sirve para ejercitar la otra mitad de D3 — la retirada condicional de TOWN 0x1253-0x1265
   * al CARGAR la localidad — sin re-fabricar el dato a mano.
   */
  function stonegateGame(st: GameState): Game {
    const flat = Array.from({ length: 256 }, () => Array<number>(256).fill(5));
    const world: WorldData = { overworld: flat, underworld: flat, smallMaps: new Map() };
    const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
    return new Game({} as ExtractedInitialState, world, gameData, st, {
      npcManager: new NpcManager(npcData),
      doors: new DoorManager(),
    });
  }

  it("FIEL (D3): con el cetro encima, trabar combate contra el SL lo ARREBATA (kernel 0x61ff-0x6229)", () => {
    const { g, st } = makeTownGame(true);
    const ev = g.attack("east");
    // El combate arranca (la mitad ya portada)…
    expect(ev.some((e) => e.kind === "combat-started")).toBe(true);
    // …y el arrebato del binario: el print de DS 0xa406 + g_sceptre=0.
    const texts = ev.filter((e) => e.kind === "message").map((e) => (e as { text?: string }).text);
    expect(texts).toContain("The Sceptre is reclaimed!\n"); // DS 0xa406 (routine-census)
    expect(st.lbArtifacts.sceptre).toBe(false); // 6224: mov [g_sceptre],0
    // ORDEN, que es la mitad del testigo: los fotogramas del Ep26 34:38 muestran
    // «SHADOW LORD / The Sceptre is reclaimed! / *** CONFLICT ***», y ése es el orden
    // del binario — 0x6150 imprime nombre (0x619c) y reclamación (0x6209) ANTES de ceder
    // a run_combat_encounter (0x633a → 0x5f86), que es quien saca el banner DS 0xa438.
    // Sin este aserto, la línea podría caer detrás del CONFLICT y `toContain` no lo vería.
    expect(texts.map((t) => t!.trim())).toEqual([
      "SHADOW LORD",
      "The Sceptre is reclaimed!",
      "*** CONFLICT ***",
    ]);
  });

  it("FIEL (D3) — la otra mitad, la que el LP llama «lo devuelve a Stonegate»: sin flag, el .NPC lo re-siembra", () => {
    // No hay vía de devolución en el binario: el cetro es PERENNE en la ranura 9 del .NPC
    // de la loc 0x1d y TOWN 0x1253-0x1265 lo RETIRA al cargar SÓLO si `g_sceptre != 0`.
    // Con el flag ya a 0 por el arrebato, entrar a Stonegate lo hace re-aparecer solo.
    const SG = 29; // loc 0x1d — la que nombra el `cmp byte [g_location],0x1d` de 0x1253
    // 1) el arrebato de arriba, sobre ESTE estado: deja g_sceptre a 0.
    const { g, st } = makeTownGame(true);
    g.attack("east");
    expect(st.lbArtifacts.sceptre).toBe(false);
    // 2) …y con ese MISMO estado se «entra» a Stonegate: el cetro vuelve a estar ahí.
    const sgGame = stonegateGame(st);
    sgGame.hydrateInteriorObjects(SG);
    const cetroAt = (): unknown[] =>
      (st.worldObjects ?? []).filter(
        (o) => o.location === SG && o.kind === "plot" && o.plotItem === "sceptre",
      );
    expect(cetroAt()).toHaveLength(1); // 0x125f `je 0x1268`: sin cetro, no se retira
    // CONTROL NEGATIVO — el gate es el FLAG, no la localidad ni la ranura: portándolo, la
    // MISMA entrada NO lo siembra (0x1261 `push 9 / call 0xb0`). Sin él, el aserto de
    // arriba pasaría igual con la retirada rota en cualquiera de los dos sentidos.
    st.lbArtifacts.sceptre = true;
    sgGame.hydrateInteriorObjects(SG);
    expect(cetroAt()).toHaveLength(0);
  });

  it("CONTROL POSITIVO: sin cetro, el (A)ttack al SL urbano traba combate SIN arrebato — la vía de entrada funciona", () => {
    const { g, st } = makeTownGame(false);
    const ev = g.attack("east");
    expect(ev.some((e) => e.kind === "combat-started")).toBe(true);
    expect(st.lbArtifacts.sceptre).toBe(false);
    expect(g.combat).not.toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// D1 · POBLACIÓN de los dos sitios del check — esperados en crudo (MAINOUT
// 0x05b2 sitio A / 0x0d05 sitio B; derivación completa en el docblock de
// game.ts checkWaterfall). Censo de mapas reales que fija los casos:
//   superficie: 3 cataratas, nortes 0x60/0x63/0x64 (WaterStream — sólo esquife/
//   alfombra los ocupan); underworld: 116 cataratas, con nortes pisables A PIE
//   (hierba 5 en (188,57)) y columnas espaciadas de 2 en 2 (x=192: y=18,20,22…)
//   = el paso exacto del +2 de falls ⇒ la cascada del sitio A es real en 1988.
// ───────────────────────────────────────────────────────────────────────────
describe("D1 · población del trigger de catarata (MAINOUT 0x05b2 / 0x0d05)", () => {
  const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
  const flat = (): number[][] => Array.from({ length: 256 }, () => Array<number>(256).fill(5));

  it("FRAGATA (remando): el sitio A tira de la nave — todo transporte, no sólo esquife", () => {
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0, x: 54, y: 135 },
      transport: "ship",
      transportTile: 0x26, // fragata ARRIADA rumbo sur (0x24+2) → rema como el esquife
      prevHour: 12,
      wind: 0,
      shards: { falsehood: false, hatred: false, cowardice: false },
      lbArtifacts: { amulet: false, crown: false, sceptre: false },
      questFlags: {},
      worldObjects: [],
      specialItems: {
        spyglass: false,
        hmsCape: false,
        sextant: false,
        pocketWatch: false,
        blackBadge: false,
        woodenBox: false,
      },
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const overworld = flat();
    for (let y = 130; y <= 140; y++) overworld[y]![54] = 1; // agua profunda (navegable)
    overworld[137]![54] = 0xd4;
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const texts = game
      .move("south")
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text?: string }).text);
    expect(texts).toContain("F-A-L-L-S!!!\n"); // DS 0x39b5
    expect(st.position.floor).toBe(0xff); // (0x36,0x8a) → underworld @0x0515
    expect(st.transport).toBe("ship"); // 0x049d/0x04fa-0x04fd preserva el transporte
  });

  it("A CABALLO y SIN PASO: el sitio B (0x0d05, tile BAJO la party) corre en el cierre de un turno Pass", () => {
    // El gate del cierre es `[bp-8]≠0` = turno CONSUMIDO (0x0c30), no «hubo paso»:
    // Pass (kernel 0x31F4 devuelve 1) entra al bloque y 0x0d05 lee la PROPIA casilla.
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0, x: 10, y: 10 }, // plantado SOBRE la catarata
      transport: "horse",
      transportTile: 0x10,
      prevHour: 12,
      wind: 0,
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const overworld = flat();
    overworld[10]![10] = 0xd4;
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const texts = game
      .pass()
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text?: string }).text);
    expect(texts).toContain("F-A-L-L-S!!!\n");
    expect(st.position.y).toBe(12); // los dos party_move_by_delta(+1 sur) de 0x046e/0x047f
    expect(st.position.floor).toBe(0); // (10,12) ≠ (0x36,0x8a): sin entrada al underworld
    expect(st.transport).toBe("horse"); // preservado (0x049d/0x04fa-0x04fd)
  });

  it("A PIE en el UNDERWORLD: el sitio A corre con g_floor=0xff (el único gate del crudo es g_location==0, 0x0b0a)", () => {
    // Geometría del mapa real: hierba (5) en (188,57) con catarata en (188,58).
    // El paso va hacia el ESTE (no hacia la catarata) y el tirón cae igual: el
    // sitio A corre en la entrada del siguiente tick_and_getkey, mire donde mire
    // el jugador.
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0xff, x: 187, y: 57 },
      transport: "foot",
      prevHour: 12,
      wind: 0,
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const underworld = flat();
    underworld[58]![188] = 0xd4; // la catarata de (188,58) del mapa real
    const world: WorldData = { overworld: flat(), underworld, smallMaps: new Map() };
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const texts = game
      .move("east") // (188,57): hierba, paso legal a pie
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text?: string }).text);
    expect(texts).toContain("F-A-L-L-S!!!\n");
    expect(st.position).toMatchObject({ x: 188, y: 59, floor: 0xff }); // +2 al sur, sigue en underworld
    expect(st.transport).toBe("foot");
  });

  it("CASCADA del sitio A: columna espaciada de 2 en 2 encadena tirones sin turno entre medias (retorno-tecla-0 → 0x0af8)", () => {
    const st = stub({
      characters: [char("G", { dexterity: 31 })],
      activeCharacter: 0,
      position: { location: 0, floor: 0, x: 5, y: 17 },
      transport: "carpet",
      transportTile: 0x14,
      magicCarpets: 1,
      prevHour: 12,
      wind: 0,
      turnsSinceStart: 0,
    } as Partial<GameState>);
    const overworld = flat();
    overworld[19]![5] = 0xd4; // el patrón del underworld real (x=192: y=18,20,22…)
    overworld[21]![5] = 0xd4;
    overworld[23]![5] = 0xd4;
    const world: WorldData = { overworld, underworld: overworld, smallMaps: new Map() };
    const game = new Game({} as ExtractedInitialState, world, gameData, st, {});
    const texts = game
      .move("south") // (5,18); vecino-sur = 1ª catarata
      .filter((e) => e.kind === "message")
      .map((e) => (e as { text?: string }).text);
    expect(texts.filter((t) => t === "F-A-L-L-S!!!\n")).toHaveLength(3); // tres tirones encadenados
    expect(st.position.y).toBe(24); // 18 → 20 → 22 → 24
    expect(st.transport).toBe("carpet");
  });
});
