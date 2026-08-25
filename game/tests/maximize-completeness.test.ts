/**
 * GUARDA DE COMPLETITUD de "Maximizar todo" respecto a los ÍTEMS ESPECIALES.
 *
 * El estado del juego modela la posesión de ítems especiales como banderas booleanas en
 * tres objetos: `specialItems` (catalejo, HMS Cape, sextante, reloj, badge, caja),
 * `lbArtifacts` (Amuleto/Corona/Cetro) y `shards` (esquirlas del Codex), más el flag
 * `grapple` (garfio). "Maximizar todo" debe otorgarlos TODOS.
 *
 * Este test es la GUARDA: construye el estado por la FÁBRICA REAL (`createNewGame`) desde
 * un `ExtractedInitialState` TIPADO (si el modelo gana un ítem especial nuevo, el literal
 * de init de abajo deja de compilar hasta que alguien lo añada), corre `maximizeState`, y
 * asevera que CADA clave de los tres objetos quedó en `true`. Así, un ítem especial nuevo
 * que nadie sume a `grantSpecialItems` rompe este test (por la iteración de claves) o la
 * compilación (por el literal tipado). El estado es la fuente de verdad, no una lista.
 */
import { describe, expect, it } from "vitest";
import { createNewGame, type ExtractedInitialState, type CharacterState } from "../src/core/state.js";
import { maximizeState, grantSpecialItems } from "../src/debug/shortcuts.js";

function makeChar(name: string): CharacterState {
  return {
    name,
    gender: 0x0b,
    class: "A",
    status: "G",
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    currentMp: 0,
    currentHp: 10,
    maxHp: 10,
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

/**
 * Init COMPLETO y tipado. Todos los ítems especiales arrancan en `false` (o el default de
 * la fábrica) para que el test demuestre que `maximizeState` los ENCIENDE. El tipado de
 * `ExtractedInitialState` obliga a enumerar cada sub-campo → un ítem nuevo rompe aquí.
 */
function makeInit(): ExtractedInitialState {
  return {
    characters: [makeChar("Avatar"), makeChar("Iolo")],
    food: 0,
    gold: 0,
    keys: 0,
    gems: 0,
    torches: 0,
    skullKeys: 0,
    grapple: false,
    magicCarpets: 0,
    specialItems: {
      spyglass: false,
      hmsCape: false,
      sextant: false,
      pocketWatch: false,
      blackBadge: false,
      woodenBox: false,
    },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: Array.from({ length: 48 }, () => 0),
    spellQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    moonstones: Array.from({ length: 8 }, () => ({ x: 0, y: 0, buried: false, z: 0, location: 0xff })),
    partySize: 2,
    year: 139,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    karma: 0,
    turnsSinceStart: 0,
    activeCharacter: 0,
    location: 0,
    floor: 0,
    x: 0,
    y: 0,
    torchTurns: 0,
    npcDead: Array.from({ length: 32 }, () => []),
    npcMet: Array.from({ length: 32 }, () => []),
  };
}

/** Los tres objetos de posesión booleana del estado (fuente de la enumeración). */
function possessionObjects(state: ReturnType<typeof createNewGame>): Record<string, boolean>[] {
  return [
    state.specialItems as unknown as Record<string, boolean>,
    state.lbArtifacts as unknown as Record<string, boolean>,
    state.shards as unknown as Record<string, boolean>,
  ];
}

describe("Maximizar todo — guarda de completitud de ítems especiales", () => {
  it("otorga TODAS las banderas de specialItems / lbArtifacts / shards (enumeradas del estado)", () => {
    const state = createNewGame(makeInit());
    maximizeState(state);

    let checked = 0;
    for (const obj of possessionObjects(state)) {
      const keys = Object.keys(obj);
      expect(keys.length).toBeGreaterThan(0); // no-vacuo: hay banderas que comprobar
      for (const key of keys) {
        expect(obj[key], `posesión no otorgada: ${key}`).toBe(true);
        checked++;
      }
    }
    // Suma de claves conocidas hoy (6 + 3 + 3). Si el modelo crece, la cifra sube y el
    // literal tipado de makeInit fuerza a enumerarlo → el test sigue siendo total.
    expect(checked).toBeGreaterThanOrEqual(12);
  });

  it("otorga el garfio (grapple)", () => {
    const state = createNewGame(makeInit());
    expect(state.grapple).toBe(false);
    maximizeState(state);
    expect(state.grapple).toBe(true);
  });

  it("grantSpecialItems por sí solo enciende todo lo enumerable sin tocar otros campos", () => {
    const state = createNewGame(makeInit());
    state.gold = 42; // un campo NO de posesión: debe quedar intacto
    grantSpecialItems(state);
    for (const obj of possessionObjects(state)) {
      for (const key of Object.keys(obj)) expect(obj[key]).toBe(true);
    }
    expect(state.grapple).toBe(true);
    expect(state.gold).toBe(42); // grantSpecialItems no toca recursos
  });
});
