/**
 * Fixture canónico del codec nativo — EXTRAÍDO DE `save-native.test.ts` (ficha #240).
 *
 * 🔴 POR QUÉ VIVE AQUÍ Y NO EN UN `.test.ts`: importar un símbolo DESDE un fichero
 * `*.test.ts` evalúa su módulo entero, y con él sus `describe()`, DENTRO de la suite del
 * importador — los tests del fichero importado se cuentan OTRA VEZ bajo otro nombre de
 * fichero. Medido el 14-08 sobre main 1870c124: 80 tests fantasma (los 40 de
 * `save-native.test.ts` contados una vez más en `party-roster-contiguity.test.ts` y otra
 * en `save-native-enemies.test.ts`). Un cardinal inflado por duplicación es un cardinal
 * que no puede usarse como suelo de nada.
 *
 * La regla que deja esto cerrado no es «acuérdate»: es que el fixture viva en un fichero
 * que el patrón de colección de vitest (`*.{test,spec}.ts`) NO recoge. `tests/helpers/`
 * ya existía para eso (`import-guard-lib.ts`).
 *
 * ⚠️ FIXTURE ANTI-DRIFT (compartido con `extractor/tests/savegame.test.ts`).
 * Está construido para que el serializer del GAME y el del EXTRACTOR produzcan bytes
 * IDÉNTICOS: posición (0,0) → obj0 sync no cambia nada sobre plantilla en blanco;
 * extras (transportTile/prevHour/shrine bitmaps) UNDEFINED → ninguno los escribe;
 * turnsSinceStart < 256 → el u8 del game y el u16 del extractor coinciden (0x2E6=0).
 * Si editas este fixture, edita EL MISMO en la otra suite o el sha divergirá.
 */
import type { CharacterState, ExtractedInitialState } from "../../src/core/state.js";

export function canonicalInit(): ExtractedInitialState {
  const ch = (over: Partial<CharacterState> = {}): CharacterState => ({
    name: "", gender: 0x0b, class: "A", status: "G", strength: 0, dexterity: 0,
    intelligence: 0, currentMp: 0, currentHp: 0, maxHp: 0, exp: 0, level: 0,
    monthsAtInn: 0, helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff,
    amulet: 0xff, partyStatus: 0, ...over,
  });
  return {
    characters: [
      ch({ name: "Avatar", strength: 20, currentHp: 100, maxHp: 100, exp: 1234, level: 3 }),
      ...Array.from({ length: 15 }, () => ch({ partyStatus: 0xff })),
    ],
    food: 500, gold: 4242, keys: 3, gems: 7, torches: 12, skullKeys: 1, grapple: true,
    magicCarpets: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
    equipmentQuantities: Array.from({ length: 48 }, (_, i) => i % 5),
    spellQuantities: Array.from({ length: 48 }, () => 0),
    scrollQuantities: Array.from({ length: 8 }, () => 0),
    potionQuantities: Array.from({ length: 8 }, () => 0),
    reagentQuantities: Array.from({ length: 8 }, () => 0),
    moonstones: Array.from({ length: 8 }, (_, i) => ({ x: i, y: 0, buried: true, z: 0, location: 0 })),
    partySize: 1, year: 139, month: 4, day: 5, hour: 8, minute: 35, karma: 75,
    turnsSinceStart: 100, activeCharacter: 0xff, location: 13, floor: 0, x: 0, y: 0,
    torchTurns: 40,
    npcDead: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
    npcMet: Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => false)),
  };
}
