/**
 * Tablas EXACTAS de las tiendas, derivadas del binario (SHOPPES.OVL /
 * SHOPPES2.OVL / SHOPPES3.OVL + DATA.OVL). Cada tabla cita su offset DS y el
 * fileoff dentro de DATA.OVL (fileoff = DS + 0x10). Son las tablas que el
 * extractor de assets todavía no vuelca a data.json; se embeben aquí con la
 * misma convención que HEALING_TOWNES en shops.ts.
 *
 * Fuente: re/notes/shops.md (Task 3.6). NO son aproximaciones de Redux.
 */

/**
 * shoppeKeeperTownes — DS 0x23CA, 8 listas stride 0x10 (draft §8). Cada valor
 * es un número de enum Location; su POSICIÓN 0-based en la lista es el
 * `g_unk_b114` que el kernel pasa a la tienda (índice dentro del tipo). Las
 * tablas de precio por-ciudad de abajo se indexan por esa posición.
 */
export const SHOP_TOWNES: Record<string, number[]> = {
  Blacksmith: [2, 3, 4, 5, 6, 17, 24, 26, 32], // idx0 DS 0x23CA (9 herreros)
  Barkeeper: [1, 2, 3, 4, 8, 19, 22, 24, 30], // idx1 DS 0x23DA (9 tabernas)
  HorseSeller: [6, 20, 22, 30], // idx2 DS 0x23EA (4 caballerizas)
  Shipwright: [3, 5, 21, 24], // idx3 DS 0x23FA (4 astilleros)
  MagicSeller: [1, 4, 7, 23, 30], // idx4 DS 0x240A (5 reactivos)
  GuildMaster: [8, 22, 24], // idx5 DS 0x241A (3 gremios)
  Healer: [5, 6, 7, 21, 23, 30, 31], // idx6 DS 0x242A (7 curanderos)
  InnKeeper: [2, 3, 7, 20, 22, 24], // idx7 DS 0x243A (6 posadas)
};

/** Posición 0-based de `location` dentro de la lista de su tipo, o -1. */
export function shopTownIndex(shopType: string, location: number): number {
  return (SHOP_TOWNES[shopType] ?? []).indexOf(location);
}

// ---------------------------------------------------------------------------
// GuildMaster — guildPrices DS 0x3BEA, 4 words/town [keys, gems, torches, ?]
// (la 4ª col no la lee 0x02BA). 3 gremios usados = SHOP_TOWNES.GuildMaster.
// El grant es por LOTE fijo: keys +3, gems +4, torches +5 (cap 99).
// ---------------------------------------------------------------------------
export const GUILD_PRICES: number[][] = [
  [190, 255, 12], // town0 New Magincia (8)
  [160, 200, 11], // town1 Paws (22)
  [185, 225, 25], // town2 Buccaneer's Den (24)
  [170, 150, 20], // town3 (fila presente en la tabla, sin ciudad asignada)
];
/** Cantidad concedida por compra de gremio, por ítem (keys/gems/torches). */
export const GUILD_GRANT = [3, 4, 5] as const;

// ---------------------------------------------------------------------------
// HorseSeller — transportPrices DS 0x3C30, 4 words. Precio-base a INT=0 en el
// binario (Redux guarda 2×). Ajuste por INT (haggle). SHOP_TOWNES.HorseSeller.
// ---------------------------------------------------------------------------
export const HORSE_PRICES = [100, 130, 160, 190] as const;

// ---------------------------------------------------------------------------
// Shipwright (SHOPPES2.OVL) — F DS 0x4D66, S DS 0x4D6E; coords de muelle
// X DS 0x4D76 / Y DS 0x4D7A. SHOP_TOWNES.Shipwright = [3,5,21,24].
// ---------------------------------------------------------------------------
export const FRIGATE_PRICES = [600, 753, 650, 700] as const;
export const SKIFF_PRICES = [200, 175, 125, 100] as const;
export const SHIP_DOCK_X = [39, 151, 79, 138] as const;
export const SHIP_DOCK_Y = [221, 21, 109, 159] as const;
/** Precio fijo de una nave de reemplazo cuando ya posees fragata (flag 0x6605). */
export const SHIP_REPLACEMENT_PRICE = 10000;

// ---------------------------------------------------------------------------
// Barkeeper / taberna (SHOPPES2.OVL) — SHOP_TOWNES.Barkeeper (9 towns).
// ---------------------------------------------------------------------------
/**
 * Precio por cabeza de la ronda de comida, por-ciudad. Tabla DS 0x4C36 de 9 WORDS
 * (file 0x4C46: `03 00 04 00 05 00 …`), byte-exacta contra este array; la usa
 * SHOPPES2. [t#57: la cita era correcta; se le añade el volcado y el ancho de campo,
 * que es lo que faltaba para no tener que re-derivarla.]
 */
export const TAVERN_ROUND_PRICE = [3, 4, 5, 3, 2, 5, 3, 4, 5] as const;
/** Precios de la carta de vinos (Rose/Claret/Sauterne/Muscatel/Moselle/Chablis). DS 0x4C48. */
export const WINE_PRICES = [18, 192, 79, 30, 275, 98] as const;
export const WINE_NAMES = [
  "Rose", "Claret", "Sauterne", "Muscatel", "Moselle", "Chablis",
] as const;
/**
 * Las SEIS líneas de la carta, VERBATIM del pool de DATA.OVL (#325). No se componen
 * a partir de `WINE_NAMES` + `WINE_PRICES`: en el binario son seis cadenas enteras y
 * seis `push`/`call 0x3670` consecutivos (SHOPPES2 0x0294 · 0x029b · 0x02a2 · 0x02a9 ·
 * 0x02b0 · 0x02b7 · 0x02be), con el relleno de puntos y el ancho de campo ya dentro del
 * dato. Reconstruirlas costaría inventar el `padStart` que el original no tiene, y el
 * primer nombre largo lo delataría.
 *
 * DS 0x9b8c · 0x9b9e · 0x9bb0 · 0x9bc2 · 0x9bd4 · 0x9be6 (fileoff = DS + 0x10). La
 * última cierra con `\n\n` — es la que separa la carta del `Thy choice?" `.
 *
 * ⚠ Van SIN traducir a propósito (misma decisión que `WINE_NAMES`): el relleno de puntos
 * es tipografía de ancho fijo y no hay entrada en el corpus i18n para estas seis. Lo que
 * SÍ está traducido es la cabecera, el prompt y el eco (`SHOP_UI.wine*`).
 *
 * El precio impreso en cada línea y `WINE_PRICES[i]` son DOS datos distintos del binario
 * (la cadena y la tabla DS 0x4C48); que coincidan lo comprueba un test, no este comentario.
 */
export const WINE_MENU_LINES = [
  "a) Rose.......18\n",
  "b) Claret....192\n",
  "c) Sauterne...79\n",
  "d) Muscatel...30\n",
  "e) Moselle...275\n",
  "f) Chablis....98\n\n",
] as const;
/** Base de raciones (haggle por INT), por-ciudad. DS 0x4C54. */
export const RATION_BASE = [10, 15, 20, 25, 30, 25, 20, 25, 30] as const;
/** Gate de copas antes del aviso de borrachera. */
export const DRUNK_CUP_GATE = 3;
/** Timer de borrachera al aceptar la 3ª copa (turnos). [0x5957]=0x19. */
export const DRUNK_TIMER_TURNS = 0x19;
/** Comida concedida por unidad de ración comprada. */
export const RATION_FOOD_PER_UNIT = 25;

/**
 * 26 keywords de rumor y su precio. DS 0x4C74 (punteros) / 0x4D10 (precios).
 * El barkeeper vende UN rumor por visita (gate `bd18==0`).
 *
 * 🔴 LAS CLAVES SON DE CUATRO LETRAS, no palabras completas (#320). Este array
 * llevaba «honesty/compassion/…» y el binario guarda `hone/comp/valo/…`: los 26
 * punteros de `DS 0x4C74` apuntan a `DS 0x9CD4` con **stride 6** (4 letras + NUL
 * + relleno), leído byte a byte de DATA.OVL. La diferencia NO es cosmética — con
 * el matcher del binario (ver `rumorKeywordIndex`, SHOPPES2 0x0568-0x05a4) la
 * clave es una SUBCADENA de lo tecleado, así que «honeymoon» compra el rumor de
 * `hone` y «the crown» el de `crow`; con palabras completas y `startsWith` al
 * revés, ninguna de las dos casa. La palabra que el jugador tiene en la cabeza va
 * en el comentario, que es donde no puede mentirle al código.
 */
export const RUMOR_KEYWORDS = [
  "hone", "comp", "valo", "just", "sacr", "hono", // honesty compassion valor justice sacrifice honor
  "spir", "humi", "dece", "desp", "dest", "wron", // spirituality humility deceit despise destard wrong
  "cove", "sham", "hyth", "crow", "scep", "amul", // covetous shame hythloth crown sceptre amulet
  "fals", "hatr", "cowa", "astr", "oppr",         // falsehood hatred cowardice astronomy oppression
  "brit", "resi", "unde",                         // britannia resist undead
] as const;
export const RUMOR_PRICES = [
  50, 75, 50, 50, 75, 75, 25, 50, 100, 150, 75, 150, 75, 100, 100, 200,
  200, 200, 250, 250, 250, 100, 50, 50, 200, 100,
] as const;
/**
 * SUJETO del chisme por clave — `[idx*2 + DS 0x4CA8]` → `[DS 0xAB00]`, la ranura
 * de token `&` del expansor (SHOPPES2 0x061d-0x0621; §48 de asm-shoppes-acta).
 * 26 punteros a `DS 0x9D70`…, transcritos de DATA.OVL.
 */
export const RUMOR_SUBJECTS = [
  "Malik", "Greyson", "Trian", "Jeremy", "Rew", "Gruman",
  "Saul", "Shirita", "Malifora", "Annon", "Trian", "Felespar",
  "the mother of Rew", "Sindar", "Kaiko", "Terrance", "Greymarch",
  "Simon and Tessa", "Shalineth", "a daemon", "Lord Malone", "Zachariah",
  "Tactus", "a daemon", "Terrance", "Jotham",
] as const;
/**
 * LUGAR del chisme: la indirección es DOBLE — `[[idx + DS 0x4CDC]*2 + DS 0x4CF6]`
 * → `[DS 0xAC62]`, ranura del token `*` (SHOPPES2 0x0624-0x0633). `DS 0x4CDC` son
 * 26 BYTES (el `barKeepGossipMap` del catálogo DATA.OVL) que mapean clave → una de
 * las 13 plazas de `DS 0x4CF6`; leer la segunda tabla con el índice de CLAVE la
 * desborda (las entradas 13..25 de esa zona ya son otra tabla).
 */
export const RUMOR_GOSSIP_MAP = [
  0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4,
  5, 7, 1, 3, 9, 11, 10, 12, 0, 4, 10, 1, 8,
] as const;
export const RUMOR_PLACES = [
  "Moonglow", "Britain", "Jhelom", "Yew", "Minoc", "Trinsic", "Skara Brae",
  "New Magincia", "a lighthouse south of Britain", "a hidden mountain keep",
  "the desert", "the Lycaeum", "Serpent's Hold",
] as const;
/**
 * Formulación 1-de-4 del chisme — `rand_range(3,0)` sobre `DS 0x4D44`
 * (SHOPPES2 0x0636-0x0644). Los cuatro punteros `0x13a2/0x13ae/0x13d9/0x13f3`
 * caen en registros CONSECUTIVOS de SHOPPE.DAT; el mapeo ptr→índice es el mismo
 * orden monótono del búfer que usan las anclas del astillero (§SHIP de este
 * fichero), verificado con esas seis anclas como controles positivos.
 * El orden IMPORTA: es el que indexa la tirada (0 → 85, 3 → 88).
 */
export const RUMOR_FORM_INDEX = [85, 86, 87, 88] as const;
/** «Well now, my memory on that subject is a bit hazy… % gold crowns…» — ptr 0x134E (0x05b2). */
export const RUMOR_PRICE_PITCH_INDEX = 84;
/** «,\nI must attend my PAYING customers!"\nsays $.\n» — ptr 0x146A, rama sin oro (0x0600). */
export const RUMOR_BROKE_INDEX = 91;

// ---------------------------------------------------------------------------
// InnKeeper (SHOPPES3.OVL) — SHOP_TOWNES.InnKeeper (6 posadas).
// ---------------------------------------------------------------------------
/** Unidad de tarifa base por posada. DS 0x4D7E. Rest = rate·party; Leave/Pickup = rate·10. */
export const INN_RATE = [2, 3, 2, 3, 2, 3] as const;
/** Capacidad (nº máximo de huéspedes hospedados). DS 0x4DC4. */
export const INN_CAPACITY = [3, 4, 3, 2, 2, 2] as const;
/**
 * Coordenada de la cama a la que teletransporta el descanso. = innBedsX/Y de data.json.
 * DOS TABLAS de 6 bytes indexadas por posada, byte-exactas contra DATA.OVL, con su
 * consumidor: SHOPPES3 0x0164 `mov al,[bx + 0x4e7a]` → g_party_x y 0x016b
 * `mov al,[bx + 0x4e80]` → g_party_y. [t#57: la cita era CORRECTA; se le añade la
 * derivación porque no la tenía.]
 */
export const INN_ROOM_X = [21, 15, 25, 20, 27, 7] as const; // tabla DS 0x4E7A
export const INN_ROOM_Y = [10, 7, 9, 1, 6, 26] as const; // tabla DS 0x4E80
