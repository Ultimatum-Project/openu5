/**
 * Las DOS exenciones de invisibilidad al elegir objetivo — COMBAT.OVL 0x0D30, 0db7-0dcb.
 *
 * ```
 * 0db7  cmp byte ptr [g_unk_5894], 0x28   ← EXENCIÓN A (localización)
 * 0dbc  je 0xdcd ─────────────────────────┐
 * 0dc1  cmp byte ptr [bx + 3], 0x2f       │ ← EXENCIÓN B (Shadowlord)
 * 0dc5  je 0xdcd ─────────────────────────┤
 * 0dc7  test byte ptr [si + 2], 0x10      │ ← EL test: bit de invisible
 * 0dcb  jne 0xe10                         │   invisible ⇒ candidato DESCARTADO
 * 0dcd  ...  ←───────────────────────────-┘   convergencia: el candidato SIGUE vivo
 * ```
 *
 * Las dos exenciones saltan al MISMO destino, salteándose el test. El port llevaba sólo
 * la B; este fichero fija LAS DOS y —lo que importa— fija que **cada una es suficiente
 * por separado**, que es lo que un `&&` mal escrito rompería sin que nada más chille.
 *
 * ⚠ Sobre la fuente de la localización: el binario compara la COPIA SOMBRA `g_unk_5894`,
 * no `g_location`, porque al entrar en combate guarda-y-anula (ULTIMA.EXE 0x5fa8-0x5fb4).
 * El port no modela esa anulación (ficha #41), así que su `position.location` hace de
 * copia. Si algún día se porta 0x5fb4, estos tests siguen pasando pero la exención A
 * moriría en el juego real — por eso el comentario del fix lleva su aviso.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
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
  type Combatant,
  type PartyCombatant,
} from "../src/core/combat/combat.js";

function load<T>(rel: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")) as T;
}
const data = load<EnemyDataInput & { defenseValues: number[] }>("../assets/data.json");
const additionalFlags = load<AdditionalEnemyFlag[]>("../src/core/data/AdditionalEnemyFlags.json");

const SHADOWLORD_TYPE = 0x2f;
const LOC_EXEMPT = 0x28; // el de 0db7
const LOC_NOT_EXEMPT = 0x22; // otra mazmorra cualquiera: control del literal

function byName(name: string): EnemyDef {
  const d = buildEnemyDefs(data, additionalFlags).find((e) => e.name === name);
  if (!d) throw new Error(`enemigo no encontrado: ${name}`);
  return d;
}

/** Arena 11×11 abierta con dos slots. */
function openField(): CombatMapData {
  const tiles = Array.from({ length: 11 }, () => Array.from({ length: 11 }, () => 5));
  const s = {
    east: [{ x: 0, y: 5 }],
    west: [{ x: 0, y: 5 }],
    south: [{ x: 0, y: 5 }],
    north: [{ x: 0, y: 5 }],
  };
  return {
    index: 996,
    territory: "britannia",
    name: "SyntheticInvisField",
    tiles,
    playerStarts: s,
    units: [
      { sprite: 0, x: 10, y: 5 },
      { sprite: 0, x: 10, y: 9 },
    ],
    triggers: [],
  };
}

/** Monta un combate en `location` y devuelve el enemigo atacante + un objetivo de party. */
function makeCombat(location: number, enemyName = "Orc"): {
  combat: Combat;
  enemy: Combatant;
  target: Combatant;
} {
  const state: GameState = createNewGame(load<ExtractedInitialState>("../assets/initial-state.json"));
  if (state.position) state.position.location = location;
  const party: PartyCombatant[] = state.characters
    .filter((c) => c.partyStatus === 0)
    .map((record, i) => ({ charIdx: i, record, weapons: [{ attack: 10, range: 1 }] }));
  const combat = new Combat({
    map: openField(),
    entryDirection: "east",
    party,
    enemies: [{ def: byName(enemyName), count: 1 }],
    seed: 11,
    state,
    defenseValues: data.defenseValues,
  });
  const enemy = combat.combatants.find((c) => c.kind === "enemy")!;
  const target = combat.combatants.find((c) => c.kind === "player")!;
  return { combat, enemy, target };
}

/** `selectTarget` es privado: se invoca por reflexión para aislar EL filtro. */
function pick(combat: Combat, actor: Combatant): Combatant | null {
  return (combat as unknown as { selectTarget(c: Combatant): Combatant | null }).selectTarget(actor);
}

/**
 * Hace invisibles a TODOS los objetivos posibles, para que el filtro sea lo único que
 * decide. (Primer intento: dejar uno solo «vivo» poniendo `hp = 0` a los demás — no
 * sirve: `isActive` mira `status`, no `hp`, así que seguían siendo candidatos y el
 * arnés medía otra cosa. Se deja anotado porque el fallo era del arnés, no del fix.)
 */
function allTargetsInvisible(combat: Combat): void {
  for (const c of combat.combatants) {
    if (c.kind === "player") c.invisible = true;
  }
}

describe("invisibilidad al elegir objetivo — las DOS exenciones (COMBAT 0x0D30 0db7-0dcb)", () => {
  it("SIN exención: un objetivo invisible se descarta (el test de 0dc7 manda)", () => {
    const { combat, enemy, target } = makeCombat(LOC_NOT_EXEMPT);
    allTargetsInvisible(combat);
    expect(pick(combat, enemy)).toBeNull();
  });

  it("★ EXENCIÓN A (0db7, loc 0x28): el invisible SÍ es objetivo", () => {
    const { combat, enemy, target } = makeCombat(LOC_EXEMPT);
    allTargetsInvisible(combat);
    expect(pick(combat, enemy)).not.toBeNull();
  });

  it("★ EXENCIÓN B (0dc1, Shadowlord): sigue INTACTA fuera de la loc exenta", () => {
    // Control de no-regresión de la exención que ya estaba portada: se comprueba en una
    // localización NO exenta, así que sólo la B puede salvar al candidato.
    const { combat, enemy, target } = makeCombat(LOC_NOT_EXEMPT);
    allTargetsInvisible(combat);
    expect(pick(combat, enemy)).toBeNull(); // sin ser Shadowlord: descartado
    enemy.enemyDef = { ...(enemy.enemyDef ?? {}), index: SHADOWLORD_TYPE } as EnemyDef;
    expect(pick(combat, enemy)).not.toBeNull(); // como Shadowlord: lo ve
  });

  it("cada exención basta POR SEPARADO (un `&&` mal escrito rompería una sola)", () => {
    // A sin B
    const a = makeCombat(LOC_EXEMPT);
    allTargetsInvisible(a.combat);
    expect(a.enemy.enemyDef?.index).not.toBe(SHADOWLORD_TYPE); // el arnés mide lo que cree
    expect(pick(a.combat, a.enemy)).not.toBeNull();

    // B sin A
    const b = makeCombat(LOC_NOT_EXEMPT);
    allTargetsInvisible(b.combat);
    b.enemy.enemyDef = { ...(b.enemy.enemyDef ?? {}), index: SHADOWLORD_TYPE } as EnemyDef;
    expect(pick(b.combat, b.enemy)).not.toBeNull();
  });

  it("la exención A es del literal 0x28, no de «estar en mazmorra»", () => {
    // 0x22 es mazmorra igualmente (banda 0x21..0x28) y NO exime: fija que el port no
    // ensanchó la condición a la banda entera.
    const { combat, enemy, target } = makeCombat(0x22);
    allTargetsInvisible(combat);
    expect(pick(combat, enemy)).toBeNull();
  });
});
