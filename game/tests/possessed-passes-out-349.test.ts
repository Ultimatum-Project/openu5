/**
 * #349 — «<nombre> passes out!»: el gate que corre ANTES de «BATTLE IS LOST!».
 *
 * REPORTE DEL USUARIO (16-08, Doom L3): el combate se dio por perdido con Iolo 58G y
 * Geoffrey 90G VIVOS. Derivación completa en `Combat.collapsePossessed` y en
 * re/notes/combat.md §2.1: COMBAT:0x0cca NO imprime la derrota cuando el bando party se
 * vacía con enemigos vivos — llama a `SJOG.OVL:0x21CE`, que DERRIBA a un poseído
 * («passes out!», DS 0x8f56), le quita la posesión, le desequipa la Espada del Caos
 * (kernel 0x6e60) y lo duerme (kernel 0x68ae); el bucle SIGUE (`inc ax / jne 0xd08`).
 * Sólo con −1 (ningún poseído) se alcanza 0x0cda «BATTLE IS LOST!».
 *
 * Los wisps de Doom POSEEN (flag 0x4000 `possessCharm`), así que la vía es alcanzable
 * exactamente donde el usuario la encontró.
 *
 * ★ POR QUÉ ESTOS TESTS CONDUCEN TURNOS EN VEZ DE FIJAR EL ESTADO A MANO. Con el bando
 * party ya vacío, `currentUnit` devuelve null (`over` corta el barrido) y NINGÚN método
 * público vuelve a llamar al bucle: un test que fije los status y luego «pase turno»
 * mide una lista de eventos VACÍA y pasaría verde con el gate desconectado. El estado
 * sólo se ENTRA por una transición —muerte (`kill`), salida por el borde o posesión—, y
 * es ahí donde el gate vive. Se conduce, pues, la transición real.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  createNewGame,
  type ExtractedInitialState,
  type GameState,
} from "../src/core/state.js";
import {
  buildEnemyDefs,
  type EnemyDef,
  type AdditionalEnemyFlag,
  type EnemyDataInput,
} from "../src/core/combat/enemies.js";
import {
  Combat,
  type CombatMapData,
  type PartyCombatant,
  type CombatEvent,
  type Combatant,
} from "../src/core/combat/combat.js";
import { WEAPON_CHAOS_SWORD } from "../src/core/combat/formulas.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");
const combatMaps = load<CombatMapData[]>("../assets/maps/combatmaps.json");
const defs: EnemyDef[] = buildEnemyDefs(data, additionalFlags);

function byName(name: string): EnemyDef {
  const d = defs.find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}
function freshState(): GameState {
  const state = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  for (const c of state.characters) {
    c.currentHp = 999;
    c.maxHp = 999;
  }
  return state;
}
function party(state: GameState): PartyCombatant[] {
  return state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
}
function mk(state: GameState): Combat {
  return new Combat({
    map: combatMaps[0]!,
    entryDirection: "east",
    party: party(state),
    enemies: [{ def: byName("Giant Spider"), count: 2 }],
    seed: 777,
    state,
    defenseValues: data.defenseValues,
  });
}
function players(c: Combat): Combatant[] {
  return c.combatants.filter((x) => x.kind === "player");
}
/** El nombre que imprime `Combat.nameOf`: el del roster, con "Avatar" de reserva. */
function nombreDe(state: GameState, charIdx: number): string {
  return state.characters[charIdx]!.name || "Avatar";
}
/**
 * Conduce como la UI: enemigos y poseídos por IA, PJ normales pasan. Devuelve los textos.
 * `pararAlDesmayo` corta EN el desmayo — sin eso el bucle sigue, los enemigos rematan al
 * dormido y `wakeUp` (kernel 0x6800) le limpia el flag 8: un test de estado que no pare ahí
 * mide el estado de DESPUÉS y sale rojo por medir tarde, no por el fix.
 */
function drive(c: Combat, opts: { maxTurns?: number; pararAlDesmayo?: boolean } = {}): string[] {
  const { maxTurns = 200, pararAlDesmayo = false } = opts;
  const out: string[] = [];
  for (let t = 0; t < maxTurns && !c.over; t++) {
    const cur = c.currentUnit;
    if (!cur) break;
    const evs: CombatEvent[] = cur.kind === "enemy" || cur.charmed ? c.tickEnemyTurns() : c.playerPass();
    for (const e of evs) if ("text" in e && e.text) out.push(e.text);
    if (pararAlDesmayo && out.some((t2) => t2.includes("passes out!"))) break;
  }
  return out;
}
/**
 * Escenario del reporte: UN poseído en pie, UN compañero a punto de caer y el resto
 * muerto. Al morir el compañero el bando party queda vacío con el poseído vivo.
 */
function escenarioReporte(state: GameState, c: Combat): { poseido: Combatant; ultimo: Combatant } {
  const ps = players(c);
  if (ps.length < 3) throw new Error(`el arnés necesita ≥3 miembros de party, tiene ${ps.length}`);
  ps[0]!.charmed = true;
  ps[1]!.hp = 1;
  for (let i = 2; i < ps.length; i++) ps[i]!.status = "dead";
  return { poseido: ps[0]!, ultimo: ps[1]! };
}

describe("#349 — el poseído se DESMAYA y el combate sigue", () => {
  it("al vaciarse el bando party con un poseído en pie sale «X passes out!», NO la derrota", () => {
    const state = freshState();
    const c = mk(state);
    const { poseido, ultimo } = escenarioReporte(state, c);
    const textos = drive(c, { pararAlDesmayo: true });
    expect(textos).toContain(`${nombreDe(state, ultimo.charIdx!)} killed!`);
    expect(textos).toContain(`${nombreDe(state, poseido.charIdx!)} passes out!`);
    expect(textos).not.toContain("BATTLE IS LOST!");
    expect(c.over).toBe(false); // 0x0cca `jne 0xd08`: el bucle SIGUE
    expect(poseido.charmed).toBe(false); // 0x21eb `and byte[si],0xfe`
  });

  it("el derribado queda DORMIDO: flag 8, status 'S' del roster y tile de actor 0x1E", () => {
    const state = freshState();
    const c = mk(state);
    const { poseido } = escenarioReporte(state, c);
    drive(c, { pararAlDesmayo: true });
    expect(poseido.sleeping).toBe(true); // 0x68e1 `or byte[bx+2],8`
    expect(state.characters[poseido.charIdx!]!.status).toBe("S"); // 0x68de `mov byte[si],0x53`
    expect(poseido.renderTile).toBe(0x1e); // 0x68ee `mov byte[bx+0x5c5b],0x1e`
  });

  it("le DESEQUIPA la Espada del Caos (kernel 0x6e60 con item 0x23)", () => {
    const state = freshState();
    state.characters[0]!.weapon = WEAPON_CHAOS_SWORD;
    const c = mk(state);
    const { poseido } = escenarioReporte(state, c);
    expect(poseido.charIdx).toBe(0);
    expect(state.characters[0]!.weapon).toBe(WEAPON_CHAOS_SWORD); // control POSITIVO: estaba puesta
    drive(c, { pararAlDesmayo: true });
    expect(state.characters[0]!.weapon).toBe(0xff); // 0x6e80 `mov byte[si],0xff`
  });

  it("cuando ya NO queda ningún poseído, la derrota sí llega («BATTLE IS LOST!»)", () => {
    const state = freshState();
    const c = mk(state);
    const { poseido } = escenarioReporte(state, c);
    drive(c, { pararAlDesmayo: true }); // primer desmayo: cae dormido y el combate sigue
    expect(c.over).toBe(false);
    // Al derribado le queda un soplo. Cuando caiga, el bando party vuelve a vaciarse pero
    // YA NO hay poseído: 0x21CE devuelve −1 y esta vez sí se llega a 0x0cda.
    poseido.hp = 1;
    const textos2 = drive(c);
    expect(c.over).toBe(true);
    expect(c.victory).toBe(false);
    expect(textos2.filter((t) => t.includes("passes out!"))).toHaveLength(0);
    expect(poseido.charmed).toBe(false);
  });

  it("la otra puerta: si el último NO poseído SALE ANDANDO, el desmayo llega igual", () => {
    // El gate vive en DOS sitios porque hay dos transiciones que vacían el bando: la muerte
    // (`kill`) y el fin de turno (`advanceTurn`, por el que pasa la salida por el borde y la
    // posesión recién echada). Este caso ejerce el SEGUNDO — sin él, quitar la llamada de
    // `advanceTurn` no pondría rojo nada.
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    ps[0]!.charmed = true;
    for (let i = 2; i < ps.length; i++) ps[i]!.status = "dead";
    const superviviente = ps[1]!;
    // Conduce hasta que le toque al superviviente y sácalo por el borde.
    let salio = false;
    const textos: string[] = [];
    for (let t = 0; t < 200 && !c.over && !salio; t++) {
      const cur = c.currentUnit;
      if (!cur) break;
      if (cur === superviviente) {
        for (const dir of ["north", "south", "east", "west"] as const) {
          const evs = c.playerEscape(dir);
          for (const e of evs) if ("text" in e && e.text) textos.push(e.text);
          if (superviviente.status === "fled") {
            salio = true;
            break;
          }
        }
        if (!salio) textos.push(...drive(c, { maxTurns: 1 }));
      } else {
        textos.push(...drive(c, { maxTurns: 1 }));
      }
    }
    expect(salio).toBe(true); // testigo: la transición que se quería ejercer OCURRIÓ
    expect(textos.some((t) => t.includes("passes out!"))).toBe(true);
    expect(c.over).toBe(false);
    expect(ps[0]!.charmed).toBe(false);
  });

  it("con DOS poseídos cae UNO por turno y es el de slot MÁS BAJO (el barrido para al primero)", () => {
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    expect(ps.length).toBeGreaterThanOrEqual(3); // hacen falta 2 poseídos + 1 que caiga
    ps[0]!.charmed = true;
    ps[1]!.charmed = true;
    ps[2]!.hp = 1;
    for (let i = 3; i < ps.length; i++) ps[i]!.status = "dead";
    const textos = drive(c, { pararAlDesmayo: true });
    expect(textos.filter((t) => t.includes("passes out!"))).toHaveLength(1);
    expect(ps[0]!.charmed).toBe(false); // 0x21db arranca en si=0xBA16 y PARA en el 1º que casa
    expect(ps[1]!.charmed).toBe(true); // el segundo espera a que el bando se vuelva a vaciar
  });

  it("SIN poseídos el gate no estorba: el bando party vacío cierra en derrota a la primera", () => {
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    ps[0]!.hp = 1;
    for (let i = 1; i < ps.length; i++) ps[i]!.status = "dead";
    const textos = drive(c);
    expect(textos.some((t) => t.includes("passes out!"))).toBe(false);
    expect(c.over).toBe(true);
    expect(c.victory).toBe(false);
  });

  it("el que SALIÓ por el borde NO es rescatado: sigue siendo derrota (el port ya era FIEL)", () => {
    // COMBAT:0x1236 con índice negativo BORRA el registro (rec[2]=0) y SJOG:0x1B6C salta
    // los slots a cero (0x1b81 `cmp byte[si],0; je`): un huido no lleva bit0, así que
    // 0x21CE no lo encuentra. Ésta es la mitad del reporte que NO se toca.
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    ps[0]!.status = "fled";
    ps[1]!.status = "fled";
    ps[2]!.hp = 1;
    for (let i = 3; i < ps.length; i++) ps[i]!.status = "dead";
    const textos = drive(c);
    expect(textos.some((t) => t.includes("passes out!"))).toBe(false);
    expect(c.over).toBe(true);
    expect(c.victory).toBe(false);
    expect(ps[0]!.hp).toBeGreaterThan(0); // siguen VIVOS fuera del tablero, como en la foto
  });

  it("un poseído YA MUERTO conserva su 'D' (exención 0x68d9) pero SÍ se anuncia y SÍ se libera", () => {
    // kernel 0x68ae abre con `cmp byte[si],0x44; je` al epílogo: sobre un roster ya 'D' no
    // toca NADA (ni status ni flag 8). Lo de ARRIBA en 0x21CE sí corre: bit0 fuera, nombre
    // impreso, espada desequipada. En el binario esto cuesta un turno y al siguiente vuelve
    // a mirar — por eso el muerto-poseído gasta un «passes out!» sin quedarse en pie.
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    ps[0]!.charmed = true;
    ps[0]!.status = "dead";
    state.characters[ps[0]!.charIdx!]!.status = "D";
    ps[1]!.hp = 1;
    for (let i = 2; i < ps.length; i++) ps[i]!.status = "dead";
    const textos = drive(c, { pararAlDesmayo: true });
    expect(textos.some((t) => t.includes("passes out!"))).toBe(true);
    expect(state.characters[ps[0]!.charIdx!]!.status).toBe("D"); // NO pasa a 'S'
    expect(ps[0]!.sleeping).toBe(false); // el flag 8 tampoco se pone
    expect(ps[0]!.charmed).toBe(false); // pero el bit0 SÍ se limpia (0x21eb va antes)
  });

  it("con la party viva en el tablero el gate no dispara (control negativo con testigo)", () => {
    const state = freshState();
    const c = mk(state);
    const ps = players(c);
    ps[0]!.charmed = true;
    const textos = drive(c, { maxTurns: 6 });
    expect(ps.filter((p) => p.status === "active" && !p.charmed).length).toBeGreaterThan(0);
    expect(textos.some((t) => t.includes("passes out!"))).toBe(false);
    expect(ps[0]!.charmed).toBe(true);
  });
});

/**
 * PREDICCIÓN ANCLADA (condición del lead para la tanda propia, 16-08).
 *
 * El fix no consume RNG por sí mismo, pero cambia CUÁNDO termina un combate: en el
 * escenario del reporte el port cerraba y ahora sigue, así que ese combate consume tiradas
 * que antes no consumía. Estos esperados son CRUDOS, medidos sobre el estado PRE-GATE del
 * escenario C con `seed: 777`, y su función es que cualquier movimiento futuro del stream
 * en esta vía SE VEA — no que sea correcto por ser el actual.
 *
 * ⚠ NO son un oráculo del binario: son la FOTO del port en el commit que introduce el gate.
 * Si un cambio legítimo los mueve, se re-anclan CON su razón escrita, no se «ajustan».
 */
describe("#349 — predicción anclada del stream (esperados EN CRUDO, semilla 777)", () => {
  it("el escenario C con semilla 777 recorre exactamente esta traza hasta el desmayo", () => {
    const state = freshState();
    const c = mk(state);
    expect(c.rngSeed).toBe(59515); // semilla PRE-GATE, tras construir la arena
    escenarioReporte(state, c);
    const textos = drive(c, { pararAlDesmayo: true });
    expect(textos).toEqual([
      "Pass",
      "Pass",
      "Shamino grazed!",
      "Pass",
      "Pass",
      "Shamino killed!",
      "Avatar passes out!",
    ]);
    expect(c.rngSeed).toBe(12419); // semilla EN el desmayo
    expect(c.over).toBe(false);
  });

  it("y el tramo que ANTES NO EXISTÍA (10 turnos pasado el cierre viejo) llega a esta semilla", () => {
    // Éste es el trozo de stream que el fix AÑADE: antes del gate el combate cerraba en el
    // desmayo y estas tiradas no se hacían. Anclarlo es lo que hace visible el cambio.
    const state = freshState();
    const c = mk(state);
    escenarioReporte(state, c);
    drive(c, { pararAlDesmayo: true });
    let extra = 0;
    for (let k = 0; k < 10 && !c.over; k++) {
      const cur = c.currentUnit;
      if (!cur) break;
      extra++;
      if (cur.kind === "enemy" || cur.charmed) c.tickEnemyTurns();
      else c.playerPass();
    }
    expect(extra).toBe(10); // testigo: los 10 turnos OCURRIERON (si cerrara, serían menos)
    expect(c.rngSeed).toBe(59367);
    expect(c.over).toBe(false);
  });
});
