/**
 * Definiciones de hechizos de Ultima V — núcleo puro (sin DOM, sin UI).
 *
 * Fuente de verdad: `data/MagicDefinitions.json` (49 entradas con reagentes
 * booleanos, círculo, tipo, tiempo permitido, target y descripción). El orden
 * canónico de los hechizos es el enum `SpellWords` de Ultima5Redux
 * (MagicReference.cs L106-158): In_Lor=0x24A ... Nox. Ese índice (0..48) es la
 * posición en `GameState.spellQuantities` (offsets 0x24A.. del save original);
 * los 48 primeros están respaldados por el array de 48 slots, Nox (índice 48)
 * queda fuera y es incastable (TimePermitted "never").
 */

/** Una entrada cruda de MagicDefinitions.json. */
export interface MagicDefRaw {
  Spell: string;
  SulfurAsh: boolean;
  Ginseng: boolean;
  Garlic: boolean;
  SpiderSilk: boolean;
  BloodMoss: boolean;
  BlackPearl: boolean;
  NightShade: boolean;
  MandrakeRoot: boolean;
  Circle: number;
  Type: string;
  SimpleDescription: string;
  SimilarFunction: string;
  TimePermitted: string;
  Gold: number;
  RawGoldReagents: string;
  SpellTargetType: string;
  SpellSubType: string;
}

export type MagicDefsJson = Record<string, MagicDefRaw>;

/** Sólo los campos de data.json que este módulo necesita (nombres para mensajes). */
export interface SpellsDataJson {
  reagents: string[];
  spells: string[];
  spellRunes: string[];
}

export interface SpellDef {
  key: string;
  name: string;
  syllables: string[];
  circle: number;
  type: string;
  reagents: number[];
  timePermitted: "peace" | "combat" | "dungeon" | string;
  targetType: string;
  mpCost: number;
  description: string;
  index: number;
}

/**
 * Orden canónico del enum `SpellWords` (= índice en spellQuantities). Coincide con
 * el orden de inserción de MagicDefinitions.json, pero se declara explícito para no
 * depender del orden de iteración del JSON.
 */
const SPELL_WORDS_ORDER: readonly string[] = [
  "In_Lor", "Grav_Por", "An_Zu", "An_Nox", "Mani", "An_Ylem", "An_Sanct", "An_Xen_Corp",
  "Rel_Hur", "In_Wis", "Kal_Xen", "In_Xen_Mani", "Vas_Lor", "Vas_Flam", "In_Flam_Grav",
  "In_Nox_Grav", "In_Zu_Grav", "In_Por", "An_Grav", "In_Sanct", "In_Sanct_Grav", "Uus_Por",
  "Des_Por", "Wis_Quas", "In_Bet_Xen", "An_Ex_Por", "In_Ex_Por", "Vas_Mani", "In_Zu",
  "Rel_Tym", "In_Vas_Por_Ylem", "Quas_An_Wis", "In_An", "Wis_An_Ylem", "An_Xen_Ex",
  "Rel_Xen_Bet", "Sanct_Lor", "Xen_Corp", "In_Quas_Xen", "In_Quas_Wis", "In_Nox_Hur",
  "In_Quas_Corp", "In_Mani_Corp", "Kal_Xen_Corp", "In_Vas_Grav_Corp", "In_Flam_Hur",
  "Vas_Rel_Por", "An_Tym", "Nox",
];

/**
 * Orden de los 8 reagentes tal como aparecen como booleanos en cada hechizo y
 * como slots en `GameState.reagentQuantities` (SulfurAsh..MandrakeRoot).
 */
const REAGENT_FLAG_KEYS: readonly (keyof MagicDefRaw)[] = [
  "SulfurAsh", "Ginseng", "Garlic", "SpiderSilk", "BloodMoss", "BlackPearl", "NightShade", "MandrakeRoot",
];

/** Índice del último hechizo respaldado por spellQuantities (48 slots, 0..47). */
export const MAX_TRACKED_SPELL_INDEX = 47;

/**
 * Construye las 49 definiciones de hechizo a partir del JSON de magia. `dataJson`
 * se acepta para futuras necesidades (validación de nombres/runas); las sílabas se
 * derivan del propio nombre del hechizo ("In Lor" → ["In","Lor"]).
 */
export function buildSpellDefs(magicDefsJson: MagicDefsJson, _dataJson?: SpellsDataJson): SpellDef[] {
  const defs: SpellDef[] = [];
  SPELL_WORDS_ORDER.forEach((key, index) => {
    const raw = magicDefsJson[key];
    if (!raw) throw new Error(`MagicDefinitions.json no contiene el hechizo "${key}"`);

    const reagents: number[] = [];
    REAGENT_FLAG_KEYS.forEach((flag, rIndex) => {
      if (raw[flag] === true) reagents.push(rIndex);
    });

    defs.push({
      key,
      name: raw.Spell,
      syllables: raw.Spell.split(" ").filter((s) => s.length > 0),
      circle: raw.Circle,
      type: raw.Type,
      reagents,
      timePermitted: raw.TimePermitted,
      targetType: raw.SpellTargetType,
      // FIDELITY: en Ultima V el coste de maná al lanzar = círculo del hechizo.
      mpCost: raw.Circle,
      description: raw.SimpleDescription,
      index,
    });
  });
  return defs;
}

/** Busca un hechizo por sus sílabas (case-insensitive). Devuelve null si no existe. */
export function findSpellBySyllables(defs: SpellDef[], syllables: string[]): SpellDef | null {
  const target = syllables.map((s) => s.toLowerCase()).join(" ");
  for (const def of defs) {
    if (def.syllables.map((s) => s.toLowerCase()).join(" ") === target) return def;
  }
  return null;
}

/**
 * Runas por INICIAL — entrada TECLEADA del nombre de hechizo (Cast/Mix).
 *
 * El original NO scrollea una lista: el jugador teclea la INICIAL de cada sílaba
 * y el motor ecoa la palabra rúnica completa en MAYÚSCULAS. La rutina es
 * `CAST2.OVL:0x00de` (getstring rúnico), a la que Cast (`CAST.OVL:0x0de9`) y Mix
 * (`CMDS.OVL:0x1b0d`) llaman vía el thunk de overlay `call 0xffffc10e`
 * (raw 0xc10e + base de carga CAST/CMDS 0xBF80 = imagen CS 0x808e, un stub
 * `lcall 0x072e:0x02ec` con selector 0x12 → `ljmp 0:0xe2be` = CAST2 base 0xE1E0
 * + 0x00de). Tabla exacta extraída de DATA.OVL DS:0x1b7a (indexada por ASCII·2):
 * 'J' y 'O' tienen puntero NULL y por eso la rutina las RECHAZA (0x00fa/0x0101).
 * Ver `re/notes/cast-input.md`.
 */
const RUNE_SYLLABLE_BY_INITIAL: Readonly<Record<string, string>> = {
  A: "AN", B: "BET", C: "CORP", D: "DES", E: "EX", F: "FLAM", G: "GRAV", H: "HUR",
  I: "IN", K: "KAL", L: "LOR", M: "MANI", N: "NOX", P: "POR", Q: "QUAS", R: "REL",
  S: "SANCT", T: "TYM", U: "UUS", V: "VAS", W: "WIS", X: "XEN", Y: "YLEM", Z: "ZU",
};

/**
 * Palabra rúnica en MAYÚSCULAS para una tecla (A-Z). Devuelve `null` si la letra
 * no tiene runa ('J'/'O', y cualquier no-letra) — el motor original la ignora.
 */
export function runeSyllableForInitial(letter: string): string | null {
  return RUNE_SYLLABLE_BY_INITIAL[letter.toUpperCase()] ?? null;
}

/**
 * Empareja las INICIALES tecleadas con un hechizo, replicando el matcher del
 * binario (CAST2.OVL 0x01e2-0x02fc): ordena las iniciales y las compara contra la
 * tabla de hechizos DS:0x1c30 (48 entradas, iniciales PRE-ORDENADAS), así que el
 * emparejamiento es INDEPENDIENTE DEL ORDEN ("IL" y "LI" → In Lor). Devuelve el
 * índice de hechizo (0..47) o -1 si no hay hechizo (retorno -2 del binario, "No
 * effect!"). El caller distingue la cadena VACÍA (retorno -1, "None!") antes de
 * llamar. Nox (índice 48) NO está en la tabla 0x1c30 → incastable.
 */
export function matchSpellByInitials(defs: SpellDef[], initials: string): number {
  const key = initials.toUpperCase().split("").sort().join("");
  if (key.length === 0) return -1;
  for (const def of defs) {
    if (def.index > MAX_TRACKED_SPELL_INDEX) continue; // Nox (48): fuera de DS:0x1c30
    const spellKey = def.syllables.map((s) => s[0]!.toUpperCase()).sort().join("");
    if (spellKey === key) return def.index;
  }
  return -1;
}
