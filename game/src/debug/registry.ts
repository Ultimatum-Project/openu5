/**
 * REGISTRO de secciones del menú debug. Declara QUÉ se puede editar; el panel
 * (panel.ts) lo pinta. Cada campo es un {label, get, set, widget}; añadir uno
 * nuevo = una entrada más aquí. TODAS las escrituras pasan por `DebugApi` (única
 * superficie de mutación, cero-rand).
 */
import type { WorldData } from "../core/world/map.js";
import type {
  ArtifactKey,
  DebugApi,
  EquipSlotField,
  QuantityArray,
  ShardKey,
  SpecialItemKey,
  WorldNumberArray,
} from "./debugApi.js";
import { UNDERWORLD_FLOOR } from "./debugApi.js";
import type { DebugField, DebugSection, SelectOption } from "./types.js";
import { buildTeleportMap } from "./teleportMap.js";
import { openTeleportPicker } from "./teleportPicker.js";
import {
  monthsAtInnField,
  worldTimeExtraFields,
  historyFlagFields,
  buildSaveEditorSections,
} from "./saveEditorSections.js";
import { ts } from "../i18n/shell.js";
import inventoryDetails from "../core/data/InventoryDetails.json";

interface ItemEntry {
  ItemName: string;
}
const NAMES = inventoryDetails as {
  Reagent: ItemEntry[];
  Armament: ItemEntry[];
  Spell: ItemEntry[];
  Item: ItemEntry[];
};

/** Letras de clase (record +0xA, "AMBFDTPRS" — Avatar/Mage/Bard/Fighter/…). */
const CLASS_LETTERS = ["A", "M", "B", "F", "D", "T", "P", "R", "S"];
/** Letras de estado (record +0xB). */
const STATUS_LETTERS: SelectOption[] = [
  { label: "Good (G)", value: "G" },
  { label: "Poisoned (P)", value: "P" },
  { label: "Charmed (C)", value: "C" },
  { label: "Sleeping (S)", value: "S" },
  { label: "Dead (D)", value: "D" },
];
const GENDER_OPTIONS: SelectOption[] = [
  { label: "Male (0x0B)", value: 0x0b },
  { label: "Female (0x0C)", value: 0x0c },
];
const WIND_OPTIONS: SelectOption[] = [
  { label: "Calm", value: 0 },
  { label: "North", value: 1 },
  { label: "South", value: 2 },
  { label: "East", value: 3 },
  { label: "West", value: 4 },
];
const TRANSPORT_OPTIONS: SelectOption[] = [
  { label: "Foot", value: "foot" },
  { label: "Horse", value: "horse" },
  { label: "Carpet", value: "carpet" },
  { label: "Skiff", value: "skiff" },
  { label: "Ship", value: "ship" },
];
const MONTHS = ["", "Deep Winter", "Awakening", "Time of Sowing", "Season of Sun", "Time of Harvest", "Fruitful Winter"];

/** Opciones de equipo: id → nombre de Armament, más "Nada" (0xFF). */
function equipOptions(): SelectOption[] {
  const opts: SelectOption[] = [{ label: "— none (0xFF)", value: 0xff }];
  NAMES.Armament.forEach((a, i) => opts.push({ label: `${i}: ${a.ItemName}`, value: i }));
  return opts;
}

/** Campos numéricos por-ítem para un array de cantidades, etiquetados por nombre. */
function quantityFields(
  api: DebugApi,
  array: QuantityArray,
  labels: ItemEntry[],
): DebugField[] {
  return labels.map((entry, idx) => ({
    widget: "number" as const,
    label: `${idx}: ${entry.ItemName}`,
    min: 0,
    max: 99,
    get: () => api.state()[array][idx] ?? 0,
    set: (v: number) => api.setQuantity(array, idx, v),
  }));
}

export function buildRegistry(api: DebugApi, world: WorldData): DebugSection[] {
  // Personaje seleccionado en la sección Party (estado del registro; los get/set
  // lo leen vivo, así el cambio de selección re-apunta los campos al re-render).
  let selChar = 0;
  const char = () => api.state().characters[selChar];

  // Opciones de teletransporte por localización (small maps cargables 1..32) +
  // overworld/underworld. Las mazmorras (33..40) NO se listan aquí: su entrada
  // real (enterDungeon) consume RNG — fuera del contrato cero-rand de v1.
  const locOptions: SelectOption[] = [
    { label: "0: Britannia (overworld)", value: 0 },
    { label: "0: Underworld", value: -1 }, // -1 sentinel → floor 0xFF
  ];
  for (const [id, loc] of [...world.smallMaps.entries()].sort((a, b) => a[0] - b[0])) {
    locOptions.push({ label: `${id}: ${loc.name}`, value: id });
  }
  let selLoc: number = 0;
  let selFloor = 0;
  const floorsFor = (locValue: number): SelectOption[] => {
    if (locValue <= 0) return [{ label: "0", value: 0 }];
    const loc = world.smallMaps.get(locValue);
    return (loc?.floors ?? [{ z: 0 }]).map((f) => ({ label: `${f.z}`, value: f.z }));
  };

  // Mazmorras (loc 33..40): entrada por el flujo REAL (game.enterDungeon), NO
  // cero-rand. Lista tomada de game.dungeons (location + name); vacía si no cargaron.
  const dungeons = api.game.dungeons ?? [];
  const dungeonOptions: SelectOption[] = dungeons
    .slice()
    .sort((a, b) => a.location - b.location)
    .map((d) => ({ label: `${d.location}: ${d.name}`, value: d.location }));
  let selDungeon: number = dungeonOptions[0] ? Number(dungeonOptions[0].value) : 33;

  // Botones de un click ARRIBA DEL TODO. Todos escriben DIRECTO en game.state (cero-rand,
  // vía la fachada) y refrescan el panel. Los topes y el "mejor" salen de datos/modelo
  // (ver debug/shortcuts.ts para cada fuente), nada cableado a mano.
  const shortcuts: DebugSection = {
    id: "shortcuts",
    title: "Atajos",
    fields: [
      {
        widget: "button",
        label: "Maximizar todo",
        hint: "Party (HP/MP/stats/nivel/estado) + recursos + inventario a sus topes + TODOS los ítems especiales (garfio, regalía LB, esquirlas, catalejo/sextante/reloj/badge/caja/HMS Cape). Cero-rand.",
        run: () => api.maximizeAll(),
      },
      {
        widget: "button",
        label: "Mejor equipo para todos",
        hint: "Equipa a cada miembro con el mejor ítem por slot (mayor ataque/defensa de los datos; regla de 2 manos). Cero-rand.",
        run: () => api.bestEquipAll(),
      },
      {
        widget: "button",
        label: "Party completo al máximo",
        hint: "Llena el party con miembros reales del roster (hasta 6) y aplica maximizar + mejor equipo. Cero-rand.",
        run: () => api.maxPartyAll(),
      },
    ],
  };

  const teleport: DebugSection = {
    id: "teleport",
    title: "Teletransporte",
    custom: () => buildTeleportMap(api, world),
    fields: [
      {
        widget: "button",
        testId: "u5-teleport-open",
        label: ts("Open map picker…"),
        hint: ts(
          "Large point-and-click map: overworld (zoom/pan), cities & castles by floor, and full dungeon floors. Click a cell to teleport.",
        ),
        run: () => openTeleportPicker(api, world),
      },
      {
        widget: "select",
        label: "Localización",
        options: locOptions,
        get: () => selLoc,
        set: (v) => {
          selLoc = Number(v);
          selFloor = 0;
        },
      },
      {
        widget: "select",
        label: "Planta",
        options: [], // dinámico: se rellena en el panel vía disabled? — usamos get/set
        get: () => selFloor,
        set: (v) => {
          selFloor = Number(v);
        },
        hint: "Plantas disponibles según la localización elegida.",
      },
      {
        widget: "button",
        label: "Ir a la localización",
        run: () => {
          if (selLoc === -1) api.goToLocation(0, UNDERWORLD_FLOOR);
          else if (selLoc === 0) api.goToLocation(0, 0);
          else api.goToLocation(selLoc, selFloor);
        },
      },
      {
        widget: "select",
        label: "Mazmorra",
        options: dungeonOptions.length ? dungeonOptions : [{ label: "(sin datos)", value: 0, disabled: true }],
        get: () => selDungeon,
        set: (v) => {
          selDungeon = Number(v);
        },
        disabled: () => dungeonOptions.length === 0,
      },
      {
        widget: "button",
        label: "Entrar mazmorra (flujo real)",
        danger: true,
        hint: "Entrada REAL de la mazmorra — puede consumir RNG del stream (no cero-rand).",
        run: () => {
          if (dungeonOptions.length) api.enterDungeon(selDungeon);
        },
        disabled: () => dungeonOptions.length === 0,
      },
      {
        widget: "text",
        label: "Posición actual (loc:floor x,y)",
        get: () => {
          const p = api.state().position;
          return `${p.location}:${p.floor} ${p.x},${p.y}`;
        },
        set: () => {
          /* read-only */
        },
        disabled: () => true,
      },
    ],
  };
  // La lista de plantas del select "Planta" depende de selLoc; el panel la lee de
  // `options`, así que la re-generamos como getter con un Proxy simple: en su
  // lugar exponemos una función que el panel invoca. Para mantener el modelo
  // declarativo, sustituimos options por un getter dinámico.
  Object.defineProperty(teleport.fields![1], "options", {
    get: () => floorsFor(selLoc),
  });

  const party: DebugSection = {
    id: "party",
    title: "Party",
    fields: [
      {
        widget: "select",
        label: "Personaje",
        options: api.state().characters.map((c, i) => ({ label: `${i + 1}: ${c.name}`, value: i })),
        get: () => selChar,
        set: (v) => {
          selChar = Number(v);
        },
      },
      numField(api, "Tamaño de party", () => api.state().partySize, (v) => api.setResource("partySize", v), 1, 6),
      numField(api, "Personaje activo (idx)", () => api.state().activeCharacter, (v) => api.setResource("activeCharacter", v), 0, 255),
      {
        widget: "text",
        label: "Nombre",
        get: () => char()?.name ?? "",
        set: (v) => api.setCharacterText(selChar, "name", v),
      },
      {
        widget: "select",
        label: "Género",
        options: GENDER_OPTIONS,
        get: () => char()?.gender ?? 0x0b,
        set: (v) => api.setCharacterNumber(selChar, "gender", Number(v)),
      },
      {
        widget: "select",
        label: "Clase",
        options: CLASS_LETTERS.map((l) => ({ label: l, value: l })),
        get: () => char()?.class ?? "A",
        set: (v) => api.setCharacterText(selChar, "class", String(v)),
      },
      {
        widget: "select",
        label: "Estado",
        options: STATUS_LETTERS,
        get: () => char()?.status ?? "G",
        set: (v) => api.setCharacterText(selChar, "status", String(v)),
      },
      numField(api, "HP", () => char()?.currentHp, (v) => api.setCharacterNumber(selChar, "currentHp", v), 0, 9999),
      numField(api, "HP máx", () => char()?.maxHp, (v) => api.setCharacterNumber(selChar, "maxHp", v), 0, 9999),
      numField(api, "MP", () => char()?.currentMp, (v) => api.setCharacterNumber(selChar, "currentMp", v), 0, 99),
      numField(api, "Nivel", () => char()?.level, (v) => api.setCharacterNumber(selChar, "level", v), 1, 8),
      numField(api, "Experiencia", () => char()?.exp, (v) => api.setCharacterNumber(selChar, "exp", v), 0, 9999),
      numField(api, "Fuerza (máx 30 — >35 wrapea el scheduler, audit-byte-wrap)", () => char()?.strength, (v) => api.setCharacterNumber(selChar, "strength", v), 1, 30),
      numField(api, "Destreza (máx 30 — >35 wrapea el scheduler, audit-byte-wrap)", () => char()?.dexterity, (v) => api.setCharacterNumber(selChar, "dexterity", v), 1, 30),
      numField(api, "Inteligencia (máx 30 — >35 wrapea el scheduler, audit-byte-wrap)", () => char()?.intelligence, (v) => api.setCharacterNumber(selChar, "intelligence", v), 1, 30),
      numField(api, "partyStatus (0=party,0xFF=no unido)", () => char()?.partyStatus, (v) => api.setCharacterNumber(selChar, "partyStatus", v), 0, 255),
      monthsAtInnField(api, () => selChar),
      ...equipSlotFields(api, () => selChar),
    ],
  };

  const resources: DebugSection = {
    id: "resources",
    title: "Recursos",
    fields: [
      numField(api, "Oro", () => api.state().gold, (v) => api.setResource("gold", v), 0, 9999),
      numField(api, "Comida", () => api.state().food, (v) => api.setResource("food", v), 0, 9999),
      numField(api, "Llaves", () => api.state().keys, (v) => api.setResource("keys", v), 0, 99),
      numField(api, "Gemas", () => api.state().gems, (v) => api.setResource("gems", v), 0, 99),
      numField(api, "Antorchas", () => api.state().torches, (v) => api.setResource("torches", v), 0, 99),
      numField(api, "Skull keys", () => api.state().skullKeys, (v) => api.setResource("skullKeys", v), 0, 99),
      numField(api, "Alfombras mágicas", () => api.state().magicCarpets, (v) => api.setResource("magicCarpets", v), 0, 99),
      numField(api, "Karma", () => api.state().karma, (v) => api.setResource("karma", v), 0, 99),
      {
        widget: "checkbox",
        label: "Grapple (gancho)",
        get: () => !!api.state().grapple,
        set: (v) => api.setFlag("grapple", v),
      },
    ],
  };

  const worldClock: DebugSection = {
    id: "world",
    title: "Mundo / Reloj",
    fields: [
      numField(api, "Año", () => api.state().time.year, (v) => api.setClock("year", v), 0, 999),
      {
        widget: "select",
        label: "Mes",
        options: MONTHS.map((m, i) => ({ label: `${i}: ${m || "—"}`, value: i })).slice(1),
        get: () => api.state().time.month,
        set: (v) => api.setClock("month", Number(v)),
      },
      numField(api, "Día", () => api.state().time.day, (v) => api.setClock("day", v), 1, 28),
      numField(api, "Hora", () => api.state().time.hour, (v) => api.setClock("hour", v), 0, 23),
      numField(api, "Minuto", () => api.state().time.minute, (v) => api.setClock("minute", v), 0, 59),
      {
        widget: "select",
        label: "Viento",
        options: WIND_OPTIONS,
        get: () => api.state().wind ?? 0,
        set: (v) => api.setWind(Number(v)),
      },
      {
        widget: "select",
        label: "Transporte",
        options: TRANSPORT_OPTIONS,
        get: () => api.state().transport,
        set: (v) => api.setTransport(v as never),
      },
      numField(api, "Turnos desde el inicio", () => api.state().turnsSinceStart, (v) => api.setResource("turnsSinceStart", v), 0, 999999),
      numField(api, "Minutos de antorcha", () => api.state().torchTurns, (v) => api.setResource("torchTurns", v), 0, 999),
      ...worldTimeExtraFields(api),
    ],
  };

  // Bandera de trama a marcar/desmarcar por nombre (questFlags es un Record libre;
  // no se puede enumerar como campos estáticos, así que se edita por nombre).
  let flagName = "";
  const plot: DebugSection = {
    id: "plot",
    title: "Trama / Quest",
    fields: [
      {
        widget: "button",
        testId: "u5-endgame-kill-sl",
        label: "Endgame: matar Shadowlords (HISTORIA)",
        hint: "Marca los 3 questFlags 'shadowlord-dead' (falsehood/hatred/cowardice) = los 3 Shadowlords destruidos. Es PROGRESO DE HISTORIA (separado de 'Maximizar todo'). Con la regalía puesta deja el estado listo para el desenlace de Doom (#179: se dispara por ABSORCIÓN en la celda cm127, no por planta). Cero-rand.",
        run: () => api.killShadowlords(),
      },
      ...SPECIAL_ITEMS.map(({ key, label }) =>
        checkboxField(label, () => !!api.state().specialItems[key], (v) => api.setSpecialItem(key, v)),
      ),
      ...SHARDS.map(({ key, label }) =>
        checkboxField(label, () => !!api.state().shards[key], (v) => api.setShard(key, v)),
      ),
      ...ARTIFACTS.map(({ key, label }) =>
        checkboxField(label, () => !!api.state().lbArtifacts[key], (v) => api.setLbArtifact(key, v)),
      ),
      numField(api, "shrineQuestBitmap", () => api.state().shrineQuestBitmap ?? 0, (v) => api.setOptionalNumber("shrineQuestBitmap", v), 0, 255),
      numField(api, "shrineVisitedBitmap", () => api.state().shrineVisitedBitmap ?? 0, (v) => api.setOptionalNumber("shrineVisitedBitmap", v), 0, 255),
      numField(api, "shadowlordSummoned", () => api.state().shadowlordSummoned ?? 0, (v) => api.setOptionalNumber("shadowlordSummoned", v), 0, 255),
      numField(api, "shadowlordDoomBits", () => api.state().shadowlordDoomBits ?? 0, (v) => api.setOptionalNumber("shadowlordDoomBits", v), 0, 255),
      ...worldArrayFields(api, "shadowlordLocs", 3, "shadowlordLocs"),
      ...worldArrayFields(api, "shrineDestroyed", 8, "shrineDestroyed"),
      // Enumeración TOTAL de flags de historia: familias conocidas (word-spoken×8,
      // shadowlord-dead×3, in-doom, game-won) + blackthorn + toda clave viva no cubierta
      // (raw + «sin derivar»). Ver saveEditorSections.historyFlagFields.
      ...historyFlagFields(api),
      { widget: "text", label: "Bandera (nombre)", get: () => flagName, set: (v: string) => { flagName = v; } },
      { widget: "button", label: "Marcar bandera TRUE", run: () => { if (flagName) api.setQuestFlag(flagName, true); } },
      { widget: "button", label: "Marcar bandera FALSE", run: () => { if (flagName) api.setQuestFlag(flagName, false); } },
      {
        widget: "text",
        label: "Banderas activas",
        disabled: () => true,
        get: () => Object.entries(api.state().questFlags ?? {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "(ninguna)",
        set: () => {},
      },
    ],
  };

  const moonstones: DebugSection = {
    id: "moonstones",
    title: "Moonstones",
    fields: (api.state().moonstones ?? []).flatMap((_, i) => [
      numField(api, `#${i} x`, () => api.state().moonstones?.[i]?.x, (v) => api.setMoonstoneField(i, "x", v), 0, 255),
      numField(api, `#${i} y`, () => api.state().moonstones?.[i]?.y, (v) => api.setMoonstoneField(i, "y", v), 0, 255),
      checkboxField(`#${i} enterrada`, () => !!api.state().moonstones?.[i]?.buried, (v) => api.setMoonstoneField(i, "buried", v)),
      numField(api, `#${i} z (0=Brit,0xFF=Under)`, () => api.state().moonstones?.[i]?.z, (v) => api.setMoonstoneField(i, "z", v), 0, 255),
    ]),
  };

  const invReagents: DebugSection = {
    id: "inv-reagents",
    title: "Inventario · Reactivos",
    fields: quantityFields(api, "reagentQuantities", NAMES.Reagent),
  };
  const invEquip: DebugSection = {
    id: "inv-equip",
    title: "Inventario · Equipo (stock)",
    fields: quantityFields(api, "equipmentQuantities", NAMES.Armament.slice(0, 48)),
  };
  const invSpells: DebugSection = {
    id: "inv-spells",
    title: "Inventario · Hechizos",
    fields: quantityFields(api, "spellQuantities", NAMES.Spell.slice(0, 48)),
  };
  const invConsum: DebugSection = {
    id: "inv-consumables",
    title: "Inventario · Pociones / Pergaminos",
    fields: [
      ...quantityFields(api, "potionQuantities", potionLabels()),
      ...quantityFields(api, "scrollQuantities", scrollLabels()),
    ],
  };

  return [
    shortcuts,
    teleport,
    party,
    resources,
    worldClock,
    plot,
    ...buildSaveEditorSections(api, world),
    moonstones,
    invReagents,
    invEquip,
    invSpells,
    invConsum,
  ];
}

const SPECIAL_ITEMS: { key: SpecialItemKey; label: string }[] = [
  { key: "spyglass", label: "Spyglass" },
  { key: "hmsCape", label: "HMS Cape plans" },
  { key: "sextant", label: "Sextant" },
  { key: "pocketWatch", label: "Pocket watch" },
  { key: "blackBadge", label: "Black badge" },
  { key: "woodenBox", label: "Wooden box" },
];
const SHARDS: { key: ShardKey; label: string }[] = [
  { key: "falsehood", label: "Shard · Falsehood" },
  { key: "hatred", label: "Shard · Hatred" },
  { key: "cowardice", label: "Shard · Cowardice" },
];
const ARTIFACTS: { key: ArtifactKey; label: string }[] = [
  { key: "amulet", label: "LB · Amulet" },
  { key: "crown", label: "LB · Crown" },
  { key: "sceptre", label: "LB · Sceptre" },
];

/** Campo checkbox breve. */
function checkboxField(label: string, get: () => boolean, set: (v: boolean) => void): DebugField {
  return { widget: "checkbox", label, get, set };
}

/** Campos numéricos por-elemento de un array de trama (shrineDestroyed/shadowlordLocs). */
function worldArrayFields(
  api: DebugApi,
  field: WorldNumberArray,
  len: number,
  label: string,
): DebugField[] {
  return Array.from({ length: len }, (_, i) => ({
    widget: "number" as const,
    label: `${label}[${i}]`,
    min: 0,
    max: 255,
    get: () => (api.state()[field] as number[] | undefined)?.[i] ?? 0,
    set: (v: number) => api.setWorldArrayElement(field, i, v),
  }));
}

/** Azúcar para un campo numérico con getter tolerante a undefined. */
function numField(
  _api: DebugApi,
  label: string,
  get: () => number | undefined,
  set: (v: number) => void,
  min?: number,
  max?: number,
): DebugField {
  return { widget: "number", label, min, max, get: () => get() ?? 0, set };
}

const EQUIP_SLOTS: { slot: EquipSlotField; label: string }[] = [
  { slot: "helmet", label: "Casco" },
  { slot: "armor", label: "Armadura" },
  { slot: "weapon", label: "Arma (mano A)" },
  { slot: "shield", label: "Escudo (mano B)" },
  { slot: "ring", label: "Anillo" },
  { slot: "amulet", label: "Amuleto" },
];

function equipSlotFields(api: DebugApi, selChar: () => number): DebugField[] {
  const options = equipOptions();
  return EQUIP_SLOTS.map(({ slot, label }) => ({
    widget: "select" as const,
    label: `Equipo · ${label}`,
    options,
    get: () => api.state().characters[selChar()]?.[slot] ?? 0xff,
    set: (v: number | string) => api.setEquipSlot(selChar(), slot, Number(v)),
  }));
}

/** Pociones: el juego modela 8 slots (potionQuantities); nombres por color estándar de U5. */
function potionLabels(): ItemEntry[] {
  return ["Blue", "Yellow", "Red", "Green", "Orange", "Purple", "Black", "White"].map((c) => ({
    ItemName: `Potion ${c}`,
  }));
}
/** Pergaminos: 8 slots (scrollQuantities); nombres por hechizo de pergamino de U5. */
function scrollLabels(): ItemEntry[] {
  return ["Vas Lor", "Rel Hur", "In Sanct", "In An", "In Quas Wis", "Kal Xen", "In Mani Corp", "An Tym"].map((s) => ({
    ItemName: `Scroll ${s}`,
  }));
}
