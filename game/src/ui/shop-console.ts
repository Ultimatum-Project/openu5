/**
 * Tienda por CONSOLA (piel fiel/shader) — calca el MECANISMO del binario: el mercader
 * es una CONVERSACIÓN dentro del marco EGA (no una ventana). Se entra por (T)alk
 * (SHOPPES*.OVL, ret 2 del dispatcher), el mercader saluda y ofrece un menú POR TECLA
 * impreso por `print_string` (0x1850); la selección de ítem/miembro va por letra en la
 * misma consola, y el resultado sale como línea de consola. EXCEPCIÓN derivada (T-004b):
 * el flujo SELL del herrero SÍ pinta una ventana en el panel — la ventana «Arms» de
 * `list_wares` (SHOPPES.OVL 0x0c80), lista paginada de 5 filas `N-Abbrev` con selección
 * por ↑/↓ + Enter (ver `openSellPicker`/`deps.openArmsPicker`). El `ShopPanel` DOM queda
 * EXCLUSIVO de la piel dev (mismo patrón que talk-console y el fix de viewgem #76).
 * censo-ui-flujos §3.
 *
 * FIDELIDAD: la MECÁNICA (precios/stock/servicios) es byte-fiel y vive en
 * `core/shops/shops.ts` — este módulo NO la reimplementa, sólo la conduce llamando a
 * EXACTAMENTE las mismas funciones que el `ShopPanel` DOM (mismas mutaciones de estado
 * ⇒ los sellos byte-idénticos del Grand Tour se conservan). Lo que se calca aquí es la
 * PRESENTACIÓN (verbo del menú por tecla). El SALUDO aleatorio 1-de-4 con `$`/`#`/`@`
 * YA es fiel (carril saludos-shoppe: emitGreeting, derivación completa en
 * re/notes/shoppe-greetings-witness.md; rand del stream VIVO por ruling FIEL-TOTAL).
 * La DESPEDIDA aleatoria 1-de-4 también es fiel (carril i18n-restos: emitFarewell,
 * emisor SHOPPES 0x0202, tablas DS 0x3b6a/0x3baa según compra; derivación en
 * shoppe-greetings.ts), y el herrero calca la PAUSA por tecla de su saludo (getkey
 * 0x83dc, fase "blacksmith-pause"). La CHARLA del sell-flow del herrero también es
 * fiel (carril sell-chatter: prompt/What-else/Good-bye 1-de-4 de las tablas DS
 * 0x3d2e/0x3d3e/0x3d36 + growls DS 0x7f20; derivación y testigo goodbye.png en
 * shoppe-greetings.ts — ver sellStart/pickSell/sellExit), y la OFERTA por ítem con su
 * Deal? Y/N también (carril sell-offers: sell_one_item 0x0e76, plantilla rand(0,7)
 * shoppe.json[49..56] con %=precio &=nombre + Y/N fiel — ver pickSell/dealYes/dealNo;
 * derivación en shoppe-greetings.ts § BLACKSMITH_SELL_OFFER_INDEX). El flujo BUY del
 * herrero es fiel ENTERO (carril buy-herrero: dispatcher rama 'B' 0x1306 + bucle
 * 0x0b30 + buy_one_item 0x09ac — eco Buy + charla 1-de-4 ×2, lista `letra...Nombre`
 * largo-<13/corto SIN precio, pitch por-ítem shoppe.json[8..48] con %=precio, Y/N,
 * Sold!/a-tope-con-pausa/echado-sin-oro, epílogo Anything-else con género — ver
 * buyStart/renderBuyList/pickBuy/buyDealYes/buyDealNo; derivación en
 * shoppe-greetings.ts § FLUJO BUY). El layout fino restante (retrato en el viewport,
 * temas de taberna por-ciudad) sigue Clase C → requiere testigo.
 */
import type { Game } from "../core/game.js";
import { partyMembers, effectiveName } from "../core/party.js";
import {
  blacksmithStock,
  buyEquipment,
  buyGuildItem,
  buyRations,
  buyReagent,
  rumorKeywordIndex,
  payRumor,
  RUMOR_INPUT_MAX,
  buyShip,
  buyTavernRound,
  buyWine,
  equipmentBuyPrice,
  equipmentSellPrice,
  guildPrice,
  healerHeal,
  healerPrices,
  horsePrice,
  innAt,
  innGuestCount,
  innLeave,
  innMonthlyRate,
  innPickup,
  innPickupPrice,
  innRest,
  innRestPrice,
  rationPrice,
  reagentGrantQty,
  reagentPriceAt,
  sellEquipment,
  shipwrightPrice,
  winePrice,
  type GuildItem,
  type HealerService,
  type ShipKind,
  type ShoppeKeeperInfo,
  type ShopType,
  type TavernRoundResult,
} from "../core/shops/shops.js";
import {
  DRUNK_CUP_GATE,
  DRUNK_TIMER_TURNS,
  GUILD_GRANT,
  HORSE_PRICES,
  RUMOR_BROKE_INDEX,
  RUMOR_FORM_INDEX,
  RUMOR_PRICES,
  RUMOR_PRICE_PITCH_INDEX,
  WINE_MENU_LINES,
  WINE_NAMES,
  shopTownIndex,
} from "../core/shops/shop-tables.js";
import {
  BLACKSMITH_BUY_ASKS,
  BLACKSMITH_BUY_BROKE,
  BLACKSMITH_BUY_EXCLAIMS,
  BLACKSMITH_BUY_INTROS,
  BLACKSMITH_BUY_PITCH_INDEX,
  BLACKSMITH_BUY_WHICH,
  BLACKSMITH_SELL_BYES,
  BLACKSMITH_SELL_MORE,
  BLACKSMITH_SELL_OFFER_INDEX,
  BLACKSMITH_SELL_PROMPTS,
  GUILD_BROKE_INDEX,
  GUILD_EASTEREGG_INDEX,
  GUILD_PITCH_INDEX,
  HEALER_SORRY_INDEX,
  INN_PICKUP_BROKE_INDEX,
  HORSE_PITCH_INDEX,
  INN_ALONE_INDEX,
  INN_CORPSE_INDEX,
  INN_PITCH_INDEX,
  SHIP_CHEAT_INDEX,
  TAVERN_KEYS,
  TAVERN_MENU_INDEX,
  TAVERN_MEAGRE_INDEX,
  TAVERN_MENU_REVISIT_INDEX,
  TAVERN_RATIONS_PITCH_INDEX,
  TAVERN_SCRAPS_INDEX,
  TAVERN_SUBTYPE,
  TAVERN_SUBTYPE_WINE,
  SHIP_ELSE_INDEX,
  SHIP_MENU_INDEX,
  SHIP_PITCH_FRIGATE_INDEX,
  SHIP_PITCH_SKIFF_INDEX,
  SHIP_SOLD_INDEX,
  SHIP_TAKE_INDEX,
  MAGIC_SELLER_BROKE_INDEX,
  MAGIC_SELLER_PITCH_INDEX,
  SHOPPE_FAREWELL_NO_PURCHASE,
  SHOPPE_FAREWELL_PURCHASE,
  SHOPPE_GREETING_INDEX,
  expandShoppeTemplate,
  partOfDayWord,
} from "../core/shops/shoppe-greetings.js";
import { SHOP_UI } from "../core/world/cmd-strings.js";
import { quoteOpen, t, tf } from "../i18n/index.js";
import type { ShopData } from "./shop.js";
import inventoryDetails from "../core/data/InventoryDetails.json";
import shortEquipNames from "../core/data/shortEquipNames.json";
import longEquipNames from "../core/data/longEquipNames.json";
import sellOfferNames from "../core/data/sellOfferNames.json";

interface ArmamentEntry {
  ItemName: string;
}

/** Nombres de equipo por índice Equipment (Armament[0] = BareHands, luego 0..47). */
const EQUIPMENT_NAMES: string[] = (
  (inventoryDetails as { Armament: ArmamentEntry[] }).Armament ?? []
)
  .slice(1)
  .map((a) => a.ItemName.replace(/([a-z])([A-Z])/g, "$1 $2"));

/**
 * Nombres CORTOS de equipo por equipId (DATA.OVL DS 0x1962 → 0x1972, «Cloth/Main
 * Gauch/Thrwng Axe/Sht. Sword…»), los que imprime la fila `N-Abbrev` de la ventana
 * «Arms» de venta (`list_wares` SHOPPES.OVL 0x0c80, T-004b).
 */
const SHORT_EQUIP_NAMES: string[] = (shortEquipNames as { names: string[] }).names;

/**
 * Nombres LARGOS de equipo por equipId (DATA.OVL DS 0x17f6 → 0x1806, «Leather Helm/
 * Spiked Shield/Ring of Invisibility…»): los que imprime la fila de la lista BUY del
 * herrero (SHOPPES.OVL 0x0bcc) cuando miden <13 (0x0be7 `cmp ax,0xd`; con 13+ la fila
 * usa el CORTO 0x1962). Dump byte a byte (carril buy-herrero).
 */
const LONG_EQUIP_NAMES: string[] = (longEquipNames as { names: string[] }).names;

/**
 * Nombres de ítem para el `&` de las OFERTAS de venta (`sell_one_item` SHOPPES 0x0eda:
 * `[0xab00] = [item·2+DS 0x3cce] || [item·2+DS 0x17f6]` — tabla de override «Cloth
 * suit»/«Two-Handed Sword»/«Invisibility Ring»… con fallback al nombre largo de
 * equipo; DATA.OVL fileoff = DS+0x10). El JSON es el merge ya resuelto de ambas
 * tablas, 48 filas por equipId (derivación en shoppe-greetings.ts).
 */
const SELL_OFFER_NAMES: string[] = (sellOfferNames as { names: string[] }).names;

/**
 * Nombres de reactivo de la LISTA del Magic Seller — tabla DS 0x3c20 (fileoff
 * 0x3c30) → strings DS 0x79b4-0x7a00, dump byte a byte: la fila 7 es «Mandrake»
 * a secas (DS 0x7a00), NO «Mandrake Root» (divergencia C2-menor del espejo P08 E05).
 */
const REAGENT_NAMES = [
  "Sulfur Ash", "Ginseng", "Garlic", "Spider Silk",
  "Blood Moss", "Black Pearl", "Nightshade", "Mandrake",
];

/** Letras a..z para las listas de selección por tecla. */
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Opción de la lista/menú actual, para el arnés (`__u5test.shopConsole`). */
export interface ShopConsoleOption {
  key: string;
  label: string;
  /** Índice de personaje (listas de miembros: curandero / posada). */
  idx?: number;
}

/** Instantánea de estado que consume el arnés del Grand Tour (mode-aware). */
export interface ShopConsoleSnapshot {
  type: ShopType;
  phase: string;
  options: ShopConsoleOption[];
}

/** Fila que la venta del herrero manda a la ventana «Arms» (nombre CORTO + cuenta). */
export interface ShopArmsRowInput {
  /** Abreviatura de la tabla 0x1972 (`shortEquipNames.json`), p.ej. "Main Gauch". */
  name: string;
  /** Cuenta del inventario (`equipmentQuantities[equipId]`). */
  qty: number;
}

export interface ShopConsoleDeps {
  game: Game;
  shopData: ShopData;
  info: ShoppeKeeperInfo | null;
  /**
   * Pool de textos de SHOPPE.DAT (`/assets/shoppe.json`, corpus extraído — material
   * de EA, viaja como asset en runtime, JAMÁS como literal tracked). Las 4 plantillas
   * de saludo por tipo se indexan con `SHOPPE_GREETING_INDEX` (tabla DS 0x3b2a).
   * null si el asset no está (extractor sin correr): se degrada al encabezado previo.
   */
  shoppeTexts: readonly string[] | null;
  /** Imprime una línea por la consola del marco EGA (hud.message → pushConsole). */
  message(text: string): void;
  /** Refresca el marcador de oro/HUD tras una transacción (hud.refresh). */
  refreshGold(): void;
  /** (Re)arma el prompt de TECLA cruda de la tienda (pendingPrompt {type:"shop"}). */
  armKey(): void;
  /** Arma un getstring de consola para una sub-entrada de texto (keyword del rumor). */
  armText(prefix: string, max: number, resolve: (text: string) => void): void;
  /** Cierra la tienda y devuelve el control al mapa. */
  close(): void;
  /**
   * Emite un cue de sonido lógico por el bus de la vista (task #3). ÚNICO sonido
   * de tienda del binario: el jingle del servicio del CURANDERO (SHOPPES rutina
   * 0x13b0, 6 tone_sweep lineales), cuyos únicos callers son las ramas C/H/R
   * 0x1611/0x1684/0x16eb tras EJECUTARSE el servicio (pago OK / gratis loc 5 /
   * caridad Skara Brae). SHOPPES2/3 y el resto de flujos (Sold! del herrero,
   * reactivos, gremio, establo, posada) NO llaman al speaker — mudos, fiel.
   * Opcional: el arnés/paneles legacy no lo cablean. Presentación pura (0 RNG).
   */
  sfx?(id: "shop-transaction"): void;
  /**
   * Picker de miembro sobre el ROSTER (kernel select 0x8bfe, llamado por el picker
   * del curandero SHOPPES 0x137c con party>1). SIN prompt propio (el prompt
   * `"Who needs my aid?" ` DS 0x805a lo imprime la consola antes). main.ts lo
   * cablea a `pickMember("")` (cursor de roster en inverso, cancel → onCancel).
   */
  pickMember(onSelect: (charIdx: number) => void, onCancel: () => void): void;
  /**
   * Abre la ventana «GUEST REGISTER» de la posada (#283, SHOPPES3 0x052a-0x06c7) en la
   * piel: caja de 15×9 enmarcada carácter a carácter sobre el panel derecho, cabeceras
   * `    GUEST` / `  REGISTER:` y barra XOR sobre el huésped resaltado. ↑/↓/←/→ mueven,
   * Enter Y ESPACIO eligen (`onPick` con el índice DENTRO de `guests`), ESC cancela
   * (`onCancel`). main.ts la implementa publicando `InnRegisterView` (patrón
   * `openArmsPicker`); es AUTORITATIVA sobre pendingPrompt mientras está abierta.
   * OPCIONAL: sin ella la consola cae a la lista de letras previa a #283.
   */
  openInnRegister?(
    guests: readonly string[],
    onPick: (index: number) => void,
    onCancel: () => void,
  ): void;
  /**
   * Abre la ventana «Arms» del flujo SELL del herrero (`list_wares` SHOPPES.OVL
   * 0x0c80, T-004b) en la piel: ventana enmarcada en el panel derecho con banner
   * ►Arms◄, lista paginada de 5 filas `N-Abbrev`, barra de selección en inverso y
   * banda ▲/▼/↕. ↑/↓ mueven, Enter elige (`onPick` con el ÍNDICE de la fila),
   * Space/ESC cancelan (`onCancel`). main.ts la implementa publicando
   * `ReadyPickerView` variante "shop" (patrón `openMixReagentPicker`); es
   * AUTORITATIVA sobre pendingPrompt mientras está abierta.
   */
  openArmsPicker(
    rows: readonly ShopArmsRowInput[],
    onPick: (index: number) => void,
    onCancel: () => void,
  ): void;
}

/**
 * Conductor de la conversación de tienda por consola. `start()` saluda + imprime el
 * menú y arma el prompt de tecla; `key(k)` despacha la tecla cruda según la fase y el
 * tipo de mercader. Es AUTORITATIVO sobre `pendingPrompt` a través de `deps.armKey`/
 * `deps.armText`/`deps.close` (como el picker de Ready/party-select).
 */
export class ShopConsole {
  private readonly game: Game;
  private readonly data: ShopData;
  private readonly type: ShopType;
  private readonly info: ShoppeKeeperInfo | null;
  private phase = "menu";
  private options: ShopConsoleOption[] = [];
  /** g_cups_served (0xBD20): servicios de comida+bebida de ESTA visita (gate borrachera ==3). */
  private served = 0;
  /**
   * ¿Hubo compra en la visita? = el flag corrido que cada flujo del binario empuja a la
   * despedida 0x0202 (di/[bp-6] en SHOPPES 0x04f7/0x07b3/0x09a0: 0 al entrar, 1 tras un
   * pago con éxito). Elige la tabla de despedida (0x3b6a sin compra / 0x3baa con compra).
   * Para SHOPPES2/3 (taberna/astillero/posada) el arg no se ha trazado sitio a sitio:
   * se aplica la MISMA semántica (pago con éxito ⇒ 1) — aproximación documentada.
   */
  private purchased = false;
  /**
   * HERRERO: su arg de despedida es el ÚLTIMO resultado de flujo (si, SHOPPES 0x12b2):
   * 0 inicial · retorno del flujo de compra 0xb30 (1 si compró ≥1 en esa sesión, 0x133b)
   * · 0xffff tras el flujo de VENTA (0x135d) ⇒ despedida SILENCIOSA (0x0202 sin ramas).
   */
  private blacksmithFlow: "none" | "buy" | "sell" = "none";
  /** ¿Compró ≥1 en la sesión de compra actual del herrero? (retorno de 0xb30, [bp-8]). */
  private boughtInBuy = false;
  /**
   * ¿El herrero te ECHÓ por no poder pagar? (`buy_one_item` 0x0a7b→di=-1: el bucle
   * 0x0b30 termina con -1 y el dispatcher pasa -1 a la despedida 0x0202 → SILENCIO,
   * como la venta). Sólo vive en la sesión de compra del herrero.
   */
  private buyThrownOut = false;
  /** Compra pendiente del Y/N del pitch (`buy_one_item` 0x0a3a: ítem + precio §0.1 ya
   *  en g_shop_accum, a la espera de 'Y'/'N'). Sólo vive en fase "buy-deal". */
  private pendingBuy: { equipId: number; price: number } | null = null;
  /** Venta pendiente del Deal? Y/N (`sell_one_item` 0x0f0c: ítem elegido + precio ya
   *  calculado en g_shop_accum, a la espera de 'Y'/'N'). Sólo vive en fase "sell-deal". */
  private pendingSell: { equipId: number; price: number } | null = null;
  /** Compra de reactivo pendiente del `Is this thy need?" ` Y/N (`buy_one_reagent`
   *  0x5eb). Sólo vive en fase "reagent-deal". */
  private pendingReagent: { slot: number; price: number; qty: number } | null = null;
  /** Compra de gremio pendiente del `Interested?" ` Y/N (`buy_one_guild` 0x33d). */
  private pendingGuild: { item: GuildItem; price: number } | null = null;
  /** Precio del caballo pendiente del `Deal?" ` Y/N (SHOPPES 0x906). */
  private pendingHorse: { price: number } | null = null;
  /** Servicio del curandero elegido en el nature-of-need (fase "healer-*"). */
  private healerService: HealerService | null = null;
  /** Miembro + precio pendientes del `Wilt thou pay?" ` Y/N (0x146a). */
  private pendingHeal: { idx: number; price: number } | null = null;
  /** Miembro elegido en el Leave de la posada, a la espera del Y/N (F2-T2). */
  private pendingInnLeave: number | null = null;
  /** Nave pitcheada a la espera del «Wilt thou take it?» (F2-T3, SHOPPES2 0x8a8). */
  private pendingShip: { kind: ShipKind; town: number } | null = null;
  /** Índice de clave de rumor con precio ya anunciado, a la espera del Y/N (#320). */
  private pendingRumor: number | null = null;
  /** [0xbd18]: algo servido en la sesión de taberna — gate del chat + pool de despedida (F2-T10). */
  private tavernServed = false;
  /**
   * ¿El mercader te ECHÓ (retorno -1 → despedida 0x202 en SILENCIO)? Generaliza el
   * caso del herrero a las cadenas nuevas: reactivos (shoppe[147] «Thou profaneth…»,
   * 0x617), gremio (shoppe[163] «Death comes…», 0x36e) y establo («…afford to feed
   * it!», 0x942). El curandero NO echa (su sorry 0x14ce devuelve 1 → sigue el flujo).
   */
  private thrownOut = false;

  constructor(type: ShopType, private deps: ShopConsoleDeps) {
    this.game = deps.game;
    this.data = deps.shopData;
    this.type = type;
    this.info = deps.info;
  }

  snapshot(): ShopConsoleSnapshot {
    return { type: this.type, phase: this.phase, options: this.options };
  }

  /** Saludo del mercader + menú inicial, y arma el prompt de tecla. */
  start(): void {
    // ESTABLO: el escaneo de hueco va ANTES del saludo (SHOPPES 0x7cb-0x86a); sin
    // hueco imprime DS 0x7a48 y SALE (0x83e→0x9a3) SIN saludo NI despedida.
    if (this.type === "HorseSeller" && !this.game.stableSpotFree()) {
      this.deps.message(t(SHOP_UI.stablesClosed));
      this.deps.close();
      return;
    }
    const greeted = this.emitGreeting();
    if (greeted && this.type !== "Blacksmith") {
      // GATE Y/N del saludo (C4): los 7 tipos no-herrero saludan con plantillas que
      // TERMINAN en pregunta y leen Y/N antes de su menú — MagicSeller (SHOPPES
      // 0x772), GuildMaster (0x4b6), Healer (0x1510), HorseSeller (0x8d1),
      // Barkeeper (SHOPPES2 0x688), Shipwright (SHOPPES2 0xad4) e InnKeeper
      // (SHOPPES3 0x9ab). 'N' (y Space, salvo el curandero que lo RE-LEE) ecoa
      // `No` y va a la despedida 0x202; 'Y' entra al flujo del tipo (greetYes).
      this.phase = "greet-yn";
      this.setOptions([
        { key: "y", label: "Yes" },
        { key: "n", label: "No" },
      ]);
      this.deps.armKey();
      return;
    }
    if (greeted && this.type === "Blacksmith") {
      // PACING fiel (SHOPPES 0x12c3): tras el welcome DS 0x8018 el binario hace un
      // getkey 0x83dc que DESCARTA la tecla — la atribución `$ says,` y la pregunta
      // Buy/Sell (rand 1-de-2, 0x12d4) salen al pulsar CUALQUIER tecla. La fase
      // "blacksmith-pause" reproduce esa pausa (el rand(0,1) se consume al continuar,
      // mismo orden de stream que el original).
      this.phase = "blacksmith-pause";
      this.setOptions([]);
      this.deps.armKey();
      return;
    }
    this.renderMenu();
    this.deps.armKey();
  }

  /**
   * SALUDO fiel al entrar (carril saludos-shoppe; derivación completa en
   * re/notes/shoppe-greetings-witness.md + adenda-3). 7 tipos de tabla: comilla de
   * apertura (putchar 0x22, SHOPPES 0x01b7) + plantilla
   * `shoppe.json[SHOPPE_GREETING_INDEX[tipo][rand(0,3)]]` con `$`/`#`/`@` expandidos
   * (emisor 0x01b6). Herrero: vía propia 0x12b2 (welcome DS 0x8018 + `\n$ says,\n"`
   * DS 0x8036 + pregunta rand(0,1) DS 0x7f48/0x7f70 + cierre DS 0x8042). El rand es
   * del stream VIVO (`Game.shopGreetingRand`, ruling paridad FIEL-TOTAL 2026-07-22).
   *
   * i18n: plantilla y piezas fijas pasan por t() AQUÍ, ANTES de expandir (el choke
   * de pushConsole no alcanza compuestos); la palabra de `@` también (keys
   * 'morning'/'afternoon'/'evening' de es.json). En 'en', t() es identidad.
   *
   * Devuelve false (SIN consumir rand) si faltan nombres o el pool del asset: se
   * degrada al encabezado previo `${shop}` + `${keeper} says:` (edge solo-port).
   */
  private emitGreeting(): boolean {
    const keeper = this.info?.keeperName?.trim();
    const shop = this.info?.shopName?.trim();
    if (!keeper || !shop) return this.legacyHeader();
    const day = t(partOfDayWord(this.game.state.time.hour));
    if (this.type === "Blacksmith") {
      // Sólo el welcome (DS 0x8018): la atribución + pregunta salen tras el getkey de
      // pacing (0x12c3) — ver blacksmithContinue(); el rand(0,1) se consume ALLÍ.
      this.deps.message(expandShoppeTemplate(t(SHOP_UI.blacksmithWelcome), { keeper, shop, day }));
      return true;
    }
    const indices = SHOPPE_GREETING_INDEX[this.type];
    const pool = this.deps.shoppeTexts;
    if (!indices || !pool) return this.legacyHeader();
    const template = pool[indices[this.game.shopGreetingRand(0, 3)]!];
    if (!template) return this.legacyHeader();
    // t() también en la comilla de APERTURA (putchar 0x22): en ES abre «, como cierra » el template.
    this.deps.message(t(SHOP_UI.greetQuoteOpen) + expandShoppeTemplate(t(template), { keeper, shop, day }));
    return true;
  }

  /**
   * Continuación del saludo del herrero tras la tecla de pacing (SHOPPES 0x12c6-0x12e6):
   * `\n$ says,\n"` (DS 0x8036) + pregunta 1-de-2 (rand(0,1) del stream VIVO sobre la
   * tabla DS 0x3d46 → 0x7f48/0x7f70) con su cierre `" ` (DS 0x8042 en el literal), y
   * entra al menú Buy/Sell. La tecla que despierta se DESCARTA (getkey 0x83dc).
   */
  private blacksmithContinue(): void {
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    const ask = this.game.shopGreetingRand(0, 1) === 0 ? SHOP_UI.blacksmithAsk1 : SHOP_UI.blacksmithAsk2;
    this.deps.message(expandShoppeTemplate(t(SHOP_UI.blacksmithSays), { keeper, shop, day }) + t(ask));
    this.phase = "menu";
    this.setOptions([
      { key: "b", label: "Buy" },
      { key: "s", label: "Sell" },
    ]);
    this.deps.armKey();
  }

  /** Piezas de expansión ($/#/@) del tendero actual, para los compuestos de plantilla. */
  private expandCtx(): { keeper: string; shop: string; day: string } {
    return {
      keeper: this.info?.keeperName?.trim() ?? "",
      shop: this.info?.shopName?.trim() ?? "",
      day: t(partOfDayWord(this.game.state.time.hour)),
    };
  }

  /**
   * GATE Y/N tras el saludo (C4) — y re-usos del mismo getkey: el epílogo del
   * curandero («Is there any other way…» → 0x1507, fase "healer-again") y el de
   * la posada («Is there anything more…» → SHOPPES3 0x9ab, fase "inn-again").
   * 'N' ecoa `No` y despide; 'Y' entra al flujo del tipo; Space cuenta como 'N'
   * en todos MENOS el curandero (su getkey 0x1510 sólo acepta Y/N y RE-LEE el
   * resto); cualquier otra tecla se re-lee.
   */
  private greetGateKey(key: string, raw: string): void {
    const isSpace = raw === " " || raw === "Spacebar";
    if (key === "y") {
      this.greetYes();
      return;
    }
    const healerish = this.type === "Healer";
    if (key === "n" || (isSpace && !healerish)) {
      this.deps.message(t(SHOP_UI.reagentNo));
      this.leave();
    }
    // otras teclas (ESC incluido): el getkey del binario re-lee
  }

  /** Rama 'Y' del gate de saludo: eco de la tecla + entrada al flujo del tipo. */
  private greetYes(): void {
    switch (this.type) {
      case "MagicSeller":
        // SHOPPES 0x789: eco DS 0x7a2c `Yes\n\n"Fine! We sell:\n\n` + lista 0x666.
        this.deps.message(SHOP_UI.reagentsSell);
        this.renderReagentList();
        this.deps.armKey();
        return;
      case "GuildMaster":
        // SHOPPES 0x4cd: eco DS 0x7916 `Yes\n\n"We sell:\n\n` + lista 0x3f6.
        this.deps.message(SHOP_UI.guildYes);
        this.renderGuildList();
        this.deps.armKey();
        return;
      case "Healer":
        // SHOPPES 0x1526-0x154d: eco `Yes\n\n` + services (DS 0x80aa, crudo con \n
        // final) + `says $.\n\n"What is the nature of thy need?" ` (DS 0x80da).
        this.deps.message(
          t(SHOP_UI.healerGateYes) +
            t(SHOP_UI.healer) + "\n" +
            expandShoppeTemplate(t(SHOP_UI.healerSaysNature), this.expandCtx()),
        );
        this.phase = "healer-need";
        this.setOptions([
          { key: "c", label: "Cure" },
          { key: "h", label: "Heal" },
          { key: "r", label: "Resurrect" },
        ]);
        this.deps.armKey();
        return;
      case "HorseSeller": {
        // SHOPPES 0x8f1-0x903: eco `Yes\n\n"` (DS 0x7a62) + pitch shoppe.json[104]
        // (fileoff 0x1643, `%`=precio) + `\n\nDeal?" ` (DS 0x7a6a).
        const town = shopTownIndex("HorseSeller", this.game.state.position.location);
        const price = town < 0 ? 0 : horsePrice(HORSE_PRICES[town] ?? 0, this.intel());
        const template = this.deps.shoppeTexts?.[HORSE_PITCH_INDEX];
        if (!template) {
          this.renderMenu(); // degradación sin pool: menú pre-carril
          this.deps.armKey();
          return;
        }
        this.deps.message(
          t(SHOP_UI.horseYesOpen) +
            expandShoppeTemplate(t(template), { ...this.expandCtx(), price: String(price) }) +
            t(SHOP_UI.sellDealPrompt), // `\n\nDeal?" ` — mismos bytes que DS 0x7a6a
        );
        this.pendingHorse = { price };
        this.phase = "horse-deal";
        this.setOptions([
          { key: "y", label: "Yes" },
          { key: "n", label: "No" },
        ]);
        this.deps.armKey();
        return;
      }
      case "Barkeeper":
        // SHOPPES2 0x6aa: eco `Yes\n\n"` (DS 0x9f92) + REGISTRO-menú por subtipo
        // (tabla DS 0x4d56 → shoppe.json 69..72) + `" ` (F2-T10, banco saldado).
        this.tavernMenu(false);
        return;
      case "Shipwright":
        // SHOPPES2 0xae6: eco `Yes` (DS 0xa008) + flujo F/S (0x8a8): menú fiel =
        // registro SHOPPE.DAT ptr 0x18eb → shoppe.json[119] (F2-T3, banco saldado).
        this.deps.message(t(SHOP_UI.shipYes));
        this.shipMenu();
        return;
      case "InnKeeper":
        // SHOPPES3 0x8f8-0x922: eco `Yes` (DS 0x5062) + `\n\n$ asks,\n"Art thou
        // here to Pick up or Leave a companion, or to Rest for the night?" `
        // (DS 0x5066+0x508e, expansor $).
        this.deps.message(
          t(SHOP_UI.innYes) + expandShoppeTemplate(t(SHOP_UI.innMenu), this.expandCtx()),
        );
        this.phase = "menu";
        this.setOptions([
          { key: "r", label: "Rest" },
          { key: "l", label: "Leave" },
          { key: "p", label: "Pick up" },
        ]);
        this.deps.armKey();
        return;
      default:
        this.renderMenu();
        this.deps.armKey();
    }
  }

  /**
   * Rama 'Y' del `Deal?" ` del establo (SHOPPES 0x924-0x981): eco `Yes!` (DS
   * 0x7a78) y:
   *   · sin oro (0x932): `\n\n"Thou couldst not afford to feed it!"\nyells $.\n`
   *     (DS 0x7a7e+0x7a9e) → despedida 0x202 arg=-1 (SILENCIO).
   *   · pago (0x94a): gold−= + merma 0x19a (0x951) + spawn del caballo + repaint
   *     → despedida 0x202 arg=1. La mecánica es la MISMA `game.stableHorse`
   *     (escaneo+compra+merma+colocación); sus mensajes QoL se sustituyen por
   *     los ecos fieles.
   */
  private horseDealYes(): void {
    const sale = this.pendingHorse;
    this.pendingHorse = null;
    if (!sale) return;
    const s = this.game.state;
    if (s.gold < sale.price) {
      this.deps.message(
        t(SHOP_UI.horseYesExcl) + expandShoppeTemplate(t(SHOP_UI.horseBroke), this.expandCtx()),
      );
      this.thrownOut = true;
      this.leave();
      return;
    }
    this.deps.message(t(SHOP_UI.horseYesExcl));
    const town = shopTownIndex("HorseSeller", s.position.location);
    const goldBefore = s.gold;
    for (const ev of this.game.stableHorse(town, this.intel())) {
      void ev; // mensajes QoL del core suprimidos: los ecos fieles ya salieron
    }
    this.markPurchase(s.gold < goldBefore);
    this.deps.refreshGold();
    this.leave(); // la montura queda en el mundo; despedida 0x202 arg=1
  }

  // ── Curandero: cadena fiel (SHOPPES 0x14f8/0x137c/0x146a) ───────────────────

  /** Nature-of-need (0x1550-0x1594): C/H/R eligen servicio; Space/CR → `Nothing`
   *  (DS 0x81c0) y la sesión acaba con la despedida (arg=1 constante, 0x171e). */
  private healerNeedKey(key: string, raw: string): void {
    if (raw === " " || raw === "Spacebar" || raw === "Enter") {
      this.deps.message(t(SHOP_UI.healerNothing));
      this.leave();
      return;
    }
    const service: HealerService | null =
      key === "c" ? "cure" : key === "h" ? "heal" : key === "r" ? "resurrect" : null;
    if (!service) return; // el getkey del binario re-lee (0x1568)
    const echo =
      service === "cure" ? SHOP_UI.healerCuring
        : service === "heal" ? SHOP_UI.healerHealing
          : SHOP_UI.healerResurrectEcho;
    this.deps.message(t(echo));
    this.healerService = service;
    this.healerPickMember();
  }

  /**
   * Picker de miembro (0x137c): party de 1 → miembro 0 SIN prompt (0x1382); si
   * no, `\n\n"Who needs my aid?" ` (DS 0x805a) + select de roster (kernel
   * 0x8bfe); cancel → `No one` (DS 0x8072) y epílogo.
   */
  private healerPickMember(): void {
    const s = this.game.state;
    if (s.partySize <= 1) {
      this.healerMemberChosen(0);
      return;
    }
    this.deps.message(t(SHOP_UI.healerWho));
    this.deps.pickMember(
      (idx) => this.healerMemberChosen(idx),
      () => {
        this.deps.message(t(SHOP_UI.healerNoOne));
        this.healerEpilogue();
      },
    );
  }

  /**
   * Validez + pitch + pago del servicio (ramas C/H/R 0x1596/0x1622/0x169a):
   *   · no procede (cure sin 'P' / heal muerto o a tope / resurrect sin 'D') →
   *     `\n\n"Thou hast no need of this art!"\nsays $.` (DS 0x3d5a) y epílogo.
   *   · location 5 y servicio C/H (0x15e5/0x1655): `\n\n"` + `Receive now the
   *     Light!"` (DS 0x8112/0x8154) GRATIS (sin pago NI merma) y ejecuta.
   *   · resto: `\n\n"` + pitch del servicio + `for % gold.\n\nWilt thou\npay?" `
   *     (DS 0x807a) → fase "healer-pay".
   */
  private healerMemberChosen(idx: number): void {
    const s = this.game.state;
    const service = this.healerService;
    if (!service) return;
    const rec = s.characters[idx];
    if (!rec) return;
    const needs =
      service === "cure" ? rec.status === "P"
        : service === "heal" ? rec.status !== "D" && rec.currentHp < rec.maxHp
          : rec.status === "D";
    if (!needs) {
      this.deps.message(expandShoppeTemplate(t(SHOP_UI.healerNoNeed), this.expandCtx()));
      this.healerEpilogue();
      return;
    }
    const prices = healerPrices(s.position.location, this.data.healPrices, this.data.curePrices, this.data.resurrectPrices);
    if (!prices) return;
    const price = prices[service];
    if (s.position.location === 5 && service !== "resurrect") {
      // GRATIS (Minoc, location 5): sin pago ni merma — sólo el efecto. La rama
      // salta DIRECTA al jingle (0x15f3 jmp 0x1611 / 0x1663 jmp 0x1684): el
      // servicio gratuito también suena.
      this.deps.message(t(SHOP_UI.farewellQuoteOpen) + t(SHOP_UI.healerLight));
      healerHeal(s, idx, service, 0);
      this.deps.sfx?.("shop-transaction"); // SHOPPES 0x13b0 vía 0x1611/0x1684
      this.deps.refreshGold();
      this.healerEpilogue();
      return;
    }
    const pitch =
      service === "cure" ? SHOP_UI.healerCurePitch
        : service === "heal" ? SHOP_UI.healerHealPitch
          : SHOP_UI.healerResPitch;
    this.deps.message(
      t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x810e/0x8150/0x8188
        t(pitch) +
        expandShoppeTemplate(t(SHOP_UI.healerPay), { ...this.expandCtx(), price: String(price) }),
    );
    this.pendingHeal = { idx, price };
    this.phase = "healer-pay";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del `Wilt thou pay?" ` (0x1482 + 0x14b9-0x14f0): eco `Yes` (DS
   * 0x8098) y:
   *   · oro suficiente: cobra + merma 0x19a (0x14ed) y ejecuta (la MISMA
   *     `healerHeal` del core: gold−= + status/HP).
   *   · sin oro: si precio ≤ 100 Y location == 7 (Skara Brae, 0x14c2-0x14cc) →
   *     CARIDAD (servicio gratis, sin merma); si no → registro shoppe.json[173]
   *     («…we cannot accept charity cases.» says $, fileoff 0x23ab) y NADA se
   *     ejecuta (ret 1 = declinado). En TODOS los casos sigue el epílogo.
   */
  private healerPayYes(): void {
    const pend = this.pendingHeal;
    this.pendingHeal = null;
    const service = this.healerService;
    if (!pend || !service) return;
    const s = this.game.state;
    this.deps.message(t(SHOP_UI.healerPayYes));
    if (s.gold >= pend.price) {
      const r = healerHeal(s, pend.idx, service, pend.price);
      this.drainOnPurchase(r.ok);
      this.markPurchase(r.ok);
      // Jingle del servicio (SHOPPES 0x13b0): el pago-con-éxito hace que 0x146a
      // retorne 0 y la rama C/H/R llama al jingle (0x1611/0x1684/0x16eb) antes
      // de aplicar el efecto. Presentación pura, 0 RNG.
      if (r.ok) this.deps.sfx?.("shop-transaction");
      this.deps.refreshGold();
    } else if (pend.price <= 100 && s.position.location === 7) {
      healerHeal(s, pend.idx, service, 0); // caridad: sin pago ni merma
      this.deps.sfx?.("shop-transaction"); // caridad (0x14c2-0x14cc) ⇒ ret 0 ⇒ jingle
      this.deps.refreshGold();
    } else {
      const sorry = this.deps.shoppeTexts?.[HEALER_SORRY_INDEX];
      if (sorry) this.deps.message(expandShoppeTemplate(t(sorry), this.expandCtx()));
    }
    this.healerEpilogue();
  }

  /**
   * Epílogo tras CADA resolución (0x15a8-0x15c2): repaint (0x8670) + `\n\n"Is
   * there any other way in which I may\naid thee?" ` (DS 0x81c8+0x81f2) y vuelta
   * al MISMO gate Y/N del saludo (0x1507): 'Y' re-imprime services+nature, 'N'
   * despide (arg=1 constante, 0x171e).
   */
  private healerEpilogue(): void {
    this.healerService = null;
    this.deps.refreshGold();
    this.deps.message(t(SHOP_UI.healerAnyOther));
    this.phase = "healer-again";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /** Encabezado pre-carril (degradación sin datos del asset): `${shop}` + `${keeper} says:`. */
  private legacyHeader(): boolean {
    const keeper = this.info?.keeperName?.trim();
    const shop = this.info?.shopName?.trim();
    if (shop) this.deps.message(`${shop}`);
    if (keeper) this.deps.message(`${keeper} says:`);
    return false;
  }

  private intel(): number {
    return this.game.state.characters[0]?.intelligence ?? 15;
  }

  private setOptions(opts: ShopConsoleOption[]): void {
    this.options = opts;
  }

  /** Imprime el prompt de menú del tipo de mercader y fija sus opciones. */
  private renderMenu(): void {
    this.phase = "menu";
    const s = this.game.state;
    switch (this.type) {
      case "Blacksmith":
        this.deps.message(SHOP_UI.blacksmith);
        this.setOptions([
          { key: "b", label: "Buy" },
          { key: "s", label: "Sell" },
        ]);
        break;
      case "MagicSeller":
        // Vía DEGRADADA (sin asset de saludos): framing T-004 + lista `<A-E>...<Nombre>`
        // + `Thy interest?" ` (SHOPPES 0x75e→0x666; testigo LP P08). Con saludo, la
        // entrada normal pasa por la fase greet-yn de start() y NO por aquí.
        this.deps.message(SHOP_UI.reagentsSell);
        this.renderReagentList();
        return;
      case "GuildMaster":
        this.deps.message(SHOP_UI.guild);
        this.renderGuildList();
        return;
      case "Healer": {
        // TICKET-002 del corpus yt: el original imprime la forma COMPLETA con atribución
        // (DS 0x80aa: `"We have powers to Cure, Heal, or Resurrect."` + `says $.` DS 0x80da,
        // comillas DENTRO del literal). El acortado SHOP_UI.healer era divergencia sin ruling.
        // [CORREGIDO t#57: decía 0x80bb, que es el FILEOFF (0x80ba) más uno y parte `"|We`.
        //  Los offsets buenos son los de la línea 475 de este mismo fichero — SHOPPES
        //  0x1542/0x1549 los empuja seguidos.]
        this.deps.message(SHOP_UI.healer);
        const healerName = this.info?.keeperName?.trim();
        // tf(): el compuesto "says Pendra." no casa key en el choke t() de pushConsole
        // (fuga i18n cerrada en el carril i18n-restos; en 'en' tf es identidad).
        if (healerName) this.deps.message(tf(SHOP_UI.healerSays, healerName));
        this.setOptions([
          { key: "c", label: "Cure" },
          { key: "h", label: "Heal" },
          { key: "r", label: "Resurrect" },
        ]);
        break;
      }
      case "InnKeeper":
        this.deps.message(SHOP_UI.inn);
        this.setOptions([
          { key: "r", label: "Rest" },
          { key: "l", label: "Leave" },
          { key: "p", label: "Pick up" },
        ]);
        break;
      case "Barkeeper":
        this.tavernMenu(false);
        return;
      case "HorseSeller": {
        const town = shopTownIndex("HorseSeller", s.position.location);
        const price = town < 0 ? 0 : horsePrice(HORSE_PRICES[town] ?? 0, this.intel());
        this.deps.message(`${SHOP_UI.horse} (${price} gp)`);
        this.setOptions([{ key: "y", label: `A steed — ${price} gp` }]);
        break;
      }
      case "Shipwright":
        this.shipMenu();
        return;
    }
  }

  // ── Herrero ────────────────────────────────────────────────────────────────
  private blacksmithTownIndex(location: number): number {
    const order = [2, 3, 4, 5, 6, 17, 24, 26, 32];
    return order.indexOf(location);
  }

  /** Stock del herrero de esta ciudad (weaponsSoldByMerchants[town], DS 0x3ae2). */
  private buyStock(): number[] {
    const town = this.blacksmithTownIndex(this.game.state.position.location);
    return town >= 0 ? blacksmithStock(town, this.data.weaponsSoldByMerchants) : [];
  }

  /**
   * ENTRADA del flujo BUY del herrero (dispatcher 0x12b2, rama 'B' @0x1306; derivación
   * completa en shoppe-greetings.ts § FLUJO BUY): eco `Buy\n\n"` (DS 0x8046) +
   * exclamación 1-de-4 (rand(0,3), tabla DS 0x3d4a) + presentación 1-de-4 (rand(0,3),
   * tabla DS 0x3d52), y la lista (bucle 0xb30). Ambos rand del stream VIVO.
   */
  private buyStart(): void {
    this.deps.message(
      t(SHOP_UI.buyEcho) +
        t(BLACKSMITH_BUY_EXCLAIMS[this.game.shopGreetingRand(0, 3)]!) +
        t(BLACKSMITH_BUY_INTROS[this.game.shopGreetingRand(0, 3)]!),
    );
    this.renderBuyList();
  }

  /**
   * LISTA de compra (bucle 0xb30 @0x0b40-0x0b85): `\n\n` (DS 0x7c44) + una fila por
   * ítem del stock — `letra...Nombre` (putchar 'a'+slot + DS 0x7c48 `...` + nombre
   * LARGO 0x17f6 si mide <13, CORTO 0x1962 si no; SIN precio — el precio sólo sale en
   * el pitch) — + `\n` + pregunta 1-de-4 (rand(0,3) del stream VIVO, tabla DS 0x3cb6)
   * + `" ` (DS 0x7c4c). Se RE-IMPRIME entera (con OTRO rand) tras cada pitch resuelto
   * (0x0c49 → 0x0b40). El snapshot `options` conserva las etiquetas largas con precio
   * para el arnés e2e (presentación del arnés, no del original).
   */
  private renderBuyList(): void {
    this.phase = "buy-list";
    const stock = this.buyStock();
    const opts: ShopConsoleOption[] = [];
    const lines: string[] = [];
    stock.forEach((equipId, i) => {
      const base = this.data.equipmentBasePrices[equipId] ?? 0;
      const price = equipmentBuyPrice(base, this.intel());
      const long = LONG_EQUIP_NAMES[equipId] ?? EQUIPMENT_NAMES[equipId] ?? `Equip ${equipId}`;
      // Regla del binario (0x0be7 `cmp ax,0xd`): nombre largo si strlen<13, corto si no.
      // La regla mide el nombre EN del binario (los datos); el display pasa por t()
      // (display-nouns; identidad en 'en' y para nombres sin traducir).
      const display = long.length < 13 ? long : (SHORT_EQUIP_NAMES[equipId] ?? long);
      opts.push({ key: LETTERS[i]!, label: `${t(long)} — ${price} gp` });
      lines.push(`${LETTERS[i]!}...${t(display)}`);
    });
    this.setOptions(opts);
    // `\n\n` (0x7c44) tras el texto previo = una línea en blanco antes de las filas.
    this.deps.message("\n" + lines.join("\n"));
    this.deps.message(
      "\n" + // putchar '\n' (0x0b65) — línea en blanco entre lista y pregunta
        t(BLACKSMITH_BUY_WHICH[this.game.shopGreetingRand(0, 3)]!) +
        t(SHOP_UI.sellQuoteClose), // `" ` — mismos bytes que DS 0x7c4c
    );
  }

  /**
   * Ids de equipo VENDIBLES (poseídos con base > 0), en orden de equipId ascendente —
   * el orden en que `list_wares` recorre la tabla de equipo poseído (0x57c0). Mismo
   * orden para las filas de la ventana «Arms», el snapshot del arnés y el mapeo
   * índice→equipId de la venta.
   */
  private sellableIds(): number[] {
    const s = this.game.state;
    const ids: number[] = [];
    s.equipmentQuantities.forEach((qty, equipId) => {
      if (qty <= 0) return; // 0x0c61 `cmp byte ptr [si + 0x57c0], 0` — el ÚNICO filtro
      ids.push(equipId);
    });
    return ids;
  }

  /**
   * ENTRADA del flujo SELL del herrero (SHOPPES 0x0f64; charla derivada en
   * shoppe-greetings.ts, carril sell-chatter). El dispatcher (0x1352) imprime el eco
   * `Sell\n\n"` (DS 0x804e); el flujo comprueba PRIMERO si hay algo que vender
   * (0xc58 @0x0f6c, ANTES de tirar rand): sin nada, `Thou hast nothing to sell!"\n
   * growls $.` (DS 0x7f20) y la sesión TERMINA (0x133d no vuelve al menú; la
   * despedida general 0x0202 va con arg=-1 @0x135d = silencio, que leave() ya calca).
   * Con género: prompt de apertura 1-de-4 (rand(0,3) del stream VIVO, tabla DS
   * 0x3d2e) + cierre `" ` (DS 0x7ef0) y la ventana «Arms» (T-004b).
   *
   * NOTA 0xc58: el binario escanea las 48 casillas de equipo SIN filtro de precio, y
   * `sellableIds` hace ya lo mismo — sólo filtra por CANTIDAD (0x0c61). Los rechazos
   * por ítem (munición 0x1b/0x1d @0x0e7d, base 0 @0x0ea2) son de `sell_one_item`
   * 0x0e76 y están los dos calcados en `pickSell`.
   *
   * 🔴 ERRATA CORREGIDA (#57). Esto decía que `sellableIds` excluía base<=0 y que sólo
   * divergía «si TODO el equipo poseído fuese invendible (esquina sin ruta real)».
   * Era FALSO por partida doble: el filtro escondía la FILA de cualquier ítem de base
   * 0 —mientras el binario la LISTA y contesta con DS 0x7d8c—, y no hacía falta que
   * todo el equipo fuese invendible: basta llevar UNO. Y no es esquina: hay **7 ítems
   * con base 0** en la tabla real (fileoff 0x3a92, 48 words) — 0x08 Jewel Shield,
   * 0x0f Mystic Armour, 0x23 Sword of Chaos, 0x27 Glass Sword, 0x28 Jeweled Sword,
   * 0x29 Mystic Sword, 0x2f Ankh. Sellado en `shop-farewell.test.ts`.
   */
  private sellStart(): void {
    this.phase = "sell-list";
    if (this.sellableIds().length === 0) {
      const keeper = this.info?.keeperName?.trim() ?? "";
      const shop = this.info?.shopName?.trim() ?? "";
      const day = t(partOfDayWord(this.game.state.time.hour));
      this.deps.message(t(SHOP_UI.sellEcho) + expandShoppeTemplate(t(SHOP_UI.sellNothing), { keeper, shop, day }));
      this.leave();
      return;
    }
    this.deps.message(
      t(SHOP_UI.sellEcho) +
        t(BLACKSMITH_SELL_PROMPTS[this.game.shopGreetingRand(0, 3)]!) +
        t(SHOP_UI.sellQuoteClose),
    );
    this.openSellPicker();
  }

  /**
   * Ventana «Arms» del flujo SELL (T-004b): en vez del volcado por letras a consola,
   * la lista se pinta en el panel (`deps.openArmsPicker`) con fila `N-Abbrev` (nombre
   * corto 0x1972, SIN precio — el original no lo imprime ahí) y selección por ↑/↓ +
   * Enter. El snapshot `options` conserva las etiquetas largas con precio para el
   * arnés e2e (mismo orden que las filas de la ventana). Cancelar (Space/ESC) SALE
   * del flujo con su Good-bye propio (`sellExit`; dispatcher 0x133d — la vuelta al
   * menú del encargo T-004b quedó superada por esta derivación).
   */
  private openSellPicker(): void {
    const s = this.game.state;
    const sellable = this.sellableIds();
    const opts: ShopConsoleOption[] = sellable.map((equipId, i) => {
      const price = equipmentSellPrice(this.data.equipmentBasePrices[equipId] ?? 0, this.intel());
      const name = EQUIPMENT_NAMES[equipId] ?? `Equip ${equipId}`;
      return { key: LETTERS[i]!, label: `${t(name)} (×${s.equipmentQuantities[equipId]}) — ${price} gp` };
    });
    this.setOptions(opts);
    const rows: ShopArmsRowInput[] = sellable.map((equipId) => ({
      name: SHORT_EQUIP_NAMES[equipId] ?? EQUIPMENT_NAMES[equipId] ?? `Equip ${equipId}`,
      qty: s.equipmentQuantities[equipId] ?? 0,
    }));
    this.deps.openArmsPicker(
      rows,
      (index) => this.pickSell(index),
      () => this.sellExit(),
    );
  }

  /**
   * SALIDA del flujo SELL (epílogo SHOPPES 0x1266-0x12a8): `\n\n"` (DS 0x7f0e) +
   * Good-bye 1-de-4 (rand(0,3) del stream VIVO, tabla DS 0x3d36) + `"\n` (DS 0x7f12);
   * la atribución `says $.` (DS 0x7f16) SOLO si aún queda algo vendible (0xc58
   * @0x1295 — tras vender el ÚLTIMO ítem el Good-bye sale sin ella; testigo
   * goodbye.png: «"Good-bye..." says Kitiara.»). Después la sesión TERMINA con la
   * despedida general en silencio (0x0202 arg=-1 @0x135d) — leave() lo calca vía
   * blacksmithFlow==='sell'.
   */
  private sellExit(): void {
    this.deps.message(
      t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7f0e
        t(BLACKSMITH_SELL_BYES[this.game.shopGreetingRand(0, 3)]!) +
        t(SHOP_UI.sellByeClose),
    );
    const keeper = this.info?.keeperName?.trim();
    if (keeper && this.sellableIds().length > 0) this.deps.message(tf(SHOP_UI.healerSays, keeper));
    this.leave();
  }

  // ── Reactivos ────────────────────────────────────────────────────────────────
  private renderReagentList(): void {
    this.phase = "reagent-list";
    const s = this.game.state;
    const town = shopTownIndex("MagicSeller", s.position.location);
    const opts: ShopConsoleOption[] = [];
    for (let slot = 0; slot < 8; slot++) {
      const price = town < 0 ? null : reagentPriceAt(town, slot, this.intel(), this.data.reagentBasePrices);
      if (price === null) continue;
      opts.push({ key: LETTERS[opts.length]!, label: t(REAGENT_NAMES[slot] ?? `Reagent ${slot}`) });
    }
    this.setOptions(opts);
    // Fila fiel `A...Ginseng` (SHOPPES 0x6ac-0x6ce: letra + separador `...` DATA.OVL
    // 0x7a26 + nombre); la letra se muestra en MAYÚSCULA como el original (0x41+i).
    for (const o of opts) this.deps.message(`${o.key.toUpperCase()}...${o.label}`);
    this.deps.message(SHOP_UI.reagentInterest); // `\nThy interest?" ` (0x7a2a) — prompt de letra
  }

  // ── Gremio ────────────────────────────────────────────────────────────────
  private renderGuildList(): void {
    this.phase = "guild-list";
    const s = this.game.state;
    const town = shopTownIndex("GuildMaster", s.position.location);
    // GUARDA DEFENSIVA INALCANZABLE (sin i18n): el diálogo de gremio sólo se abre por (T)alk
    // a un NPC GuildMaster, que en los datos SÓLO existe en SHOP_TOWNES.GuildMaster → town≥0
    // siempre aquí. Cross-check ShoppeKeeperMap×SHOP_TOWNES (los 8 tipos, 0 fuera de lista);
    // ruling del lead: EXENTA. "No wares for sale here." no es del binario (el original no
    // pondría mercader donde no hay tienda).
    if (town < 0) {
      this.deps.message("No wares for sale here.");
      this.setOptions([]);
      return;
    }
    // Lista FIEL (SHOPPES 0x40d-0x426): tres filas fijas `a.........Keys` /
    // `b.........Gems` / `c......Torches` (DS 0x78d4/0x78e4/0x78f4) + prompt
    // `Thy concern?" ` (DS 0x7906). Las etiquetas con precio quedan en el snapshot
    // `options` para el arnés e2e (presentación del arnés, no del original).
    const names: Array<[GuildItem, string]> = [[0, "Keys"], [1, "Gems"], [2, "Torches"]];
    const opts: ShopConsoleOption[] = names.map(([item, name], i) => {
      const price = guildPrice(town, item, this.intel());
      return { key: LETTERS[i]!, label: `${t(name)} (×${GUILD_GRANT[item]}) — ${price} gp` };
    });
    this.setOptions(opts);
    this.deps.message(t(SHOP_UI.guildRowKeys) + t(SHOP_UI.guildRowGems) + t(SHOP_UI.guildRowTorches) + t(SHOP_UI.guildConcern));
  }

  // ── Astillero (F2-T3 espejo; SHOPPES2 0x08a8, testigo AD Ep01 ~3120) ─────────

  /**
   * MENÚ del astillero (SHOPPES2 0x8c5): registro SHOPPE.DAT ptr 0x18eb →
   * shoppe.json[119] «\n\n"We sell ocean-\ngoing Frigates\nand small, light\n
   * Skiffs.\n\nWhich would ye\nlike to see?" ». El getkey (0x448c @0x8cc):
   * F/S → pitch; ESC/Space → salida (farewell); OTRA tecla → RE-IMPRIME el menú
   * (0xaa9 → 0x8c5).
   */
  private shipMenu(): void {
    const rec = this.deps.shoppeTexts?.[SHIP_MENU_INDEX];
    if (rec) this.deps.message(expandShoppeTemplate(t(rec), this.expandCtx()));
    this.phase = "ship-menu";
    this.setOptions([
      { key: "f", label: "Frigate" },
      { key: "s", label: "Skiff" },
    ]);
    this.deps.armKey();
  }

  /**
   * PITCH por tipo (SHOPPES2 0x8f0 frigate / 0x9d4 skiff): eco `F\n\n`/`S\n\n`
   * (DS 0x9fe4/0x9ffa) + registro del pitch (ptr 0x183e → shoppe.json[117]
   * «These stout-hearted vessels…For % gold…» / ptr 0x188c → [118] «Skiffs allow
   * thee…Ours cost % gp each.») + «\n\nWilt thou\ntake it?" » (ptr 0x1a50 →
   * [126]). % = precio por-ciudad con haggle (DS 0x4d66/0x4d6e @0x940/0x9db).
   * ⚠ Ramas de FLOTA EXISTENTE sin cablear (g_ship_flags 0x6605 no modelado como
   * estado vivo): reemplazo con fragata (ptr 0x19f2 → [125], cobra 10000 @0x927),
   * skiff-a-bordo (ptr 0x193b → [120]) y 2º skiff sin nave (ptr 0x195f → [121]) —
   * banco declarado (ver buyShip).
   */
  private shipPitch(kind: ShipKind): void {
    const s = this.game.state;
    const town = shopTownIndex("Shipwright", s.position.location);
    if (town < 0) return;
    this.deps.message(t(kind === "frigate" ? SHOP_UI.shipEchoF : SHOP_UI.shipEchoS));
    const price = shipwrightPrice(town, kind, this.intel());
    const pitch = this.deps.shoppeTexts?.[kind === "frigate" ? SHIP_PITCH_FRIGATE_INDEX : SHIP_PITCH_SKIFF_INDEX];
    const take = this.deps.shoppeTexts?.[SHIP_TAKE_INDEX];
    const ctx = { ...this.expandCtx(), price: String(price) };
    this.deps.message(
      (pitch ? expandShoppeTemplate(t(pitch), ctx) : "") +
        (take ? expandShoppeTemplate(t(take), ctx) : ""),
    );
    this.pendingShip = { kind, town };
    this.phase = "ship-take";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama \'Y\' del «Wilt thou take it?" » (0x9a8/0xa47): eco `Yes\n\n` (DS
   * 0x9ff0/0x9ffe) + pago (helper 0x7e2: `gold < precio` → registro ptr 0x198e →
   * shoppe.json[122] «What? Cheat me, will ye? OUT!» + `yells $.` DS 0x9fc2, marca
   * [0xbd22] → SIN despedida) y entrega (helper 0x80e: registro ptr 0x19ab →
   * [123] «Sold! Thou canst take delivery at the docks outside the city!» + nave
   * al MUELLE (DS 0x4d76/0x4d7a) + cobro + «\n\nWill there be anything else, » +
   * sir/milady + `?" ` (ptr 0x19da → [124] + DS 0x9fcc/0x9fd4/0x9fd8) → Y = menú
   * de nuevo (0x8c5) / N = despedida).
   */
  private shipTakeYes(): void {
    this.deps.message(t(SHOP_UI.shipTakeYes));
    const pending = this.pendingShip;
    this.pendingShip = null;
    if (!pending) return;
    const s = this.game.state;
    const r = buyShip(s, pending.town, pending.kind, this.intel());
    if (!r.ok) {
      const cheat = this.deps.shoppeTexts?.[SHIP_CHEAT_INDEX];
      this.deps.message(
        (cheat ? expandShoppeTemplate(t(cheat), this.expandCtx()) : "") +
          "\n" + expandShoppeTemplate(t(SHOP_UI.shipYells), this.expandCtx()),
      );
      this.thrownOut = true; // [0xbd22]=1 → salida SIN despedida (0xb07)
      this.leave();
      return;
    }
    this.markPurchase(true); // [0xbd24]=1 (0x840) → pool de despedida con compra
    this.deps.refreshGold();
    if (r.dockX !== undefined && r.dockY !== undefined) {
      this.game.spawnDockShip(r.dockX, r.dockY, pending.kind === "frigate" ? 0x82 : 0x40, 0);
    }
    const sold = this.deps.shoppeTexts?.[SHIP_SOLD_INDEX];
    if (sold) this.deps.message(expandShoppeTemplate(t(sold), this.expandCtx()));
    const anyElse = this.deps.shoppeTexts?.[SHIP_ELSE_INDEX];
    // Género del comprador (0x85a; el binario compara el byte+9 con 0x46 en esta
    // rama — el clon unifica con el criterio 0x0c del resto de flujos).
    const gw = this.innGenderWord();
    this.deps.message(
      (anyElse ? expandShoppeTemplate(t(anyElse), this.expandCtx()) : "") + gw + t(SHOP_UI.shipElseClose),
    );
    this.phase = "ship-else";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  // ── Curandero / posada: listas de miembros ──────────────────────────────────
  private renderHealMemberList(service: HealerService): void {
    this.phase = `heal-${service}`;
    const s = this.game.state;
    const opts: ShopConsoleOption[] = [];
    partyMembers(s).forEach((member) => {
      const idx = s.characters.indexOf(member);
      opts.push({ key: LETTERS[opts.length]!, label: `${effectiveName(member.name)}`, idx });
    });
    this.setOptions(opts);
    this.deps.message(SHOP_UI.whom);
    for (const o of opts) this.deps.message(`${o.key}) ${o.label}`);
  }

  /**
   * (P)ick up — SHOPPES3 0x04e6. El binario corre TRES puertas antes de abrir el
   * registro de huéspedes, y este método las calca en su orden:
   *
   * ```
   * 04f4  cmp [g_party_size],6 / jne 0x506 → DS 0x4f57 `\n\nOne must first be
   *                                          left behind!\n\n` y epílogo
   * 0506  cmp [bp-2],0 / jne 0x516        → DS 0x4f7a `\n\n"No one here is from thy
   *                                          party!"\nsays $.\n\n` (expansor) y epílogo
   * 0516  cmp [bp-2],1 / jg 0x51f         → ★ con UN solo huésped SALTA a 0x70c: ni
   *                                          prompt ni registro, lo coge directamente
   * 051f  DS 0x4fa7 `\n\n"Who will\ncheck out?" ` + el REGISTRO enmarcado + picker
   * ```
   *
   * Las dos primeras llevan atribución o texto verbatim que el núcleo puro no puede
   * componer (no tiene el nombre del posadero), así que se emiten aquí — mismo patrón
   * que `innBrokeScreams` en el Rest. #145.
   *
   * 🔴 ~~⚠ NO portado: el REGISTRO es una ventana ENMARCADA … La consola usa su lista de
   * opciones. Divergencia de PRESENTACIÓN.~~ **RANCIO desde #283** y contradicho por el
   * código que documenta: cuarenta líneas más abajo este mismo método llama a
   * `openInnRegister`, y el comentario de ahí ya dice que el registro «NO se lista por
   * consola». La ventana enmarcada SÍ está portada (`skin/fiel/innRegister.ts`, con el
   * marco 15×9 y las cabeceras `    GUEST` / `  REGISTER:\n\n` DS 0x4fc0/0x4fca del
   * tramo 0x04e6-0x06c7). La lista de letras por consola es hoy la DEGRADACIÓN, la que
   * corre cuando la piel no ofrece `openInnRegister`, no el camino. Se conserva tachado
   * porque la frase llegó a citarse como declaración de divergencia vigente.
   */
  private innPickupStart(): void {
    const s = this.game.state;
    const location = s.position.location;
    const guests = s.characters
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => c.partyStatus === location);
    if (s.partySize >= 6) {
      this.deps.message(t(SHOP_UI.innPickupFull)); // 0x04fb
      this.innEpilogue();
      return;
    }
    if (guests.length === 0) {
      this.deps.message(expandShoppeTemplate(t(SHOP_UI.innPickupNobody), this.expandCtx())); // 0x050c
      this.innEpilogue();
      return;
    }
    if (guests.length === 1) {
      this.innPickupMember(guests[0]!.idx); // 0x0516 `jg` NO tomado → 0x70c, sin prompt
      return;
    }
    // El prompt SALE ANTES de abrir la ventana (0x051f `print DS 0x4fa7` precede al
    // `select_text_window(1)` de 0x0526), y va a la CONSOLA, no al panel.
    this.deps.message(t(SHOP_UI.innWhoCheckOut)); // DS 0x4fa7 (0x051f)
    if (!this.deps.openInnRegister) {
      // Degradación declarada (paneles legacy / arnés sin piel): lista de letras por
      // consola, la presentación PREVIA a #283. La conducta de cobro es la misma.
      this.phase = "inn-pickup";
      const opts: ShopConsoleOption[] = guests.map(({ c, idx }, i) => ({
        key: LETTERS[i]!,
        label: `${c.name || "friend"}`,
        idx,
      }));
      this.setOptions(opts);
      for (const o of opts) this.deps.message(`${o.key}) ${o.label}`);
      return;
    }
    // #283 — ventana ENMARCADA en el panel derecho, como 1988: los nombres se pintan
    // ahí (0x05fb) y la barra XOR (0x064d) los recorre; el registro NO se lista por
    // consola. La ventana es autoritativa sobre el prompt mientras está abierta.
    this.phase = "menu";
    this.deps.openInnRegister(
      guests.map(({ c }) => c.name || "friend"),
      (i) => {
        const g = guests[i];
        if (g) this.innPickupMember(g.idx);
      },
      () => {
        // ESC (0x06c8): `No one\n\n` y salida sin cobrar; el epílogo lo pone el bucle
        // de menú, igual que en la vía de letras.
        this.deps.message(t(SHOP_UI.innPickupNoOne));
        this.innEpilogue();
      },
    );
  }

  /** Trato por género — `call 0x00ac`, ranura 0 (Avatar), `== 0x0b → sir`. */
  private honorific(): string {
    return t(this.game.state.characters[0]?.gender === 0x0b ? SHOP_UI.tavernSir : SHOP_UI.tavernMilady);
  }

  /**
   * CARTA DE VINOS (#325) — SHOPPES2 0x0286-0x02c8, en el ORDEN del binario:
   *   0x0286 `"Our wine list,\n` · 0x028d trato por género · 0x0290 `.\n\n`
   *   0x0294-0x02be las SEIS líneas VERBATIM · 0x02c1 `Thy choice?" ` · 0x02c8 getkey.
   *
   * Antes esto imprimía una lista FABRICADA (`A) Rose — 18 gp`, seis líneas compuestas
   * con `WINE_NAMES` + `winePrice`) y ni cabecera ni prompt: las cuatro cadenas del
   * original estaban extraídas y traducidas en el corpus y no las emitía nadie. Las
   * `options` siguen existiendo porque son el contrato del despacho de tecla y de los
   * arneses; lo que se imprime ya no sale de ellas.
   */
  private renderWineList(): void {
    this.phase = "wine-list";
    this.setOptions(
      WINE_NAMES.map((name, w) => ({
        key: LETTERS[w]!,
        label: `${t(name)} — ${winePrice(w)} gp`, // rótulo INTERNO (a11y/arneses), no se imprime
      })),
    );
    this.deps.message(t(SHOP_UI.wineListOpen) + this.honorific() + t(SHOP_UI.wineListAfterName));
    for (const line of WINE_MENU_LINES) this.deps.message(line);
    this.deps.message(t(SHOP_UI.wineThyChoice));
  }

  /**
   * ESPACIO en la carta (0x02ce `cmp al,0x20` → 0x02d2): dos `putchar('\n')` y el
   * registro 89 de SHOPPE.DAT, con retorno **2** = «me echo atrás sin pedir». El
   * epílogo NO marca el flag de servicio, así que el Chat sigue cerrado.
   *
   * Vive aquí y no en el gate global de Espacio/Escape de `key()` porque en el binario
   * este Espacio NO sale de la taberna: vuelve al «Anything else for thee?».
   */
  private wineWithdraw(): void {
    this.deps.message("\n\n"); // 0x02d2 + 0x02d9
    const rec = this.deps.shoppeTexts?.[TAVERN_MEAGRE_INDEX];
    if (rec) this.deps.message(expandShoppeTemplate(t(rec), this.expandCtx()));
    this.tavernEpilogue(false); // ret 2 → [0xbd18] intacto
  }

  /** Índice de personaje asociado a una opción de lista de miembros. */
  private optionIdx(opt: ShopConsoleOption | undefined): number | null {
    return opt && typeof opt.idx === "number" ? opt.idx : null;
  }

  /**
   * Merma de la Falsedad tras un pago (`shop_falsehood_gold_theft`, SHOPPES.OVL 0x019a):
   * con Faulinei en el pueblo roba `rand(1,64)` con suelo 0, en silencio.
   *
   * ★ ALCANCE CORREGIDO 2026-07-25 — derivación en `re/notes/falsedad-merma-tiendas.md` ★
   * Este comentario decía: «SÓLO … SHOPPES.OVL; NO en taberna/posada/astillero (SHOPPES2/3)»,
   * apoyado en `use-merchants.md:132` («los pagos de SHOPPES2 van a kernel 0x9dfa [= CS 0x7fda → SHOPPES.OVL:0x019a], no a
   * 0x19a»). **Son la misma rutina**: SHOPPES2/3 están en la BANDA 4 (near_call_base
   * `0xe1e0`), luego `(0xe1e0 + 0x9dfa) & 0xFFFF = 0x7FDA` = stub kernel→overlay →
   * SHOPPES.OVL `0x019A`. Pasan por el stub porque desde otra banda no pueden llamar directo.
   *
   * El binario tiene **11** call-sites (5 en SHOPPES.OVL + 4 en SHOPPES2 + 2 en SHOPPES3);
   * el port tenía 9. Se añaden los de taberna y posada. **NO se añade el rumor del
   * tabernero** (`SHOPPES2 0x0508`): hace `sub [g_gold]` y **NO** llama a la merma, mientras
   * su gemelo estructural `0x0846` sí — el binario distingue pagar por CHISME de pagar por
   * CONSUMICIÓN, y un flag «merma en todo pago de taberna» fabricaría ahí.
   *
   * Tampoco las VENTAS: el único abono de oro (`SHOPPES.OVL 0x0f3d`,
   * `add_capped(&g_gold, precio, 9999)`) no lleva merma detrás.
   */
  private drainOnPurchase(ok: boolean): void {
    if (ok) this.game.shopPostPurchaseDrain();
  }

  /** Marca la visita como CON compra (flag de la despedida 0x0202; ver `purchased`). */
  private markPurchase(ok: boolean): void {
    if (!ok) return;
    this.purchased = true;
    if (this.type === "Blacksmith" && this.blacksmithFlow === "buy") this.boughtInBuy = true;
  }

  // ── Despacho de tecla ────────────────────────────────────────────────────────
  key(k: string): void {
    const raw = k;
    const key = k.length === 1 ? k.toLowerCase() : k;
    // Y/N del saludo del MagicSeller (SHOPPES 0x772-0x7a9): 'Y' = eco DS 0x7a2c
    // (`Yes\n\n"Fine! We sell:`) + lista de reactivos (0x666); 'N'/Space = eco `No`
    // (DS 0x7a44) + despedida (0x202). El getkey del binario RE-LEE cualquier otra
    // tecla (solo acepta Y/N/espacio — ESC incluido en la re-lectura), por eso esta
    // fase va ANTES del gate global de salida por Space/Escape.
    // Pausa de pacing del herrero (getkey 0x83dc): CUALQUIER tecla continúa (el binario
    // la descarta — Space/ESC incluidos), por eso va ANTES del gate global de salida.
    if (this.phase === "blacksmith-pause") {
      this.blacksmithContinue();
      return;
    }
    // Deal? Y/N de la oferta de venta (`sell_one_item` 0x0f0c-0x0f18): el getkey del
    // binario RE-LEE cualquier tecla que no sea 'Y'/'N' — Space/ESC INCLUIDOS — por
    // eso esta fase va ANTES del gate global de salida.
    if (this.phase === "sell-deal") {
      if (key === "y") this.dealYes();
      else if (key === "n") this.dealNo();
      return;
    }
    // Y/N del pitch de COMPRA (`buy_one_item` 0x0a3a-0x0a54): mismo getkey en bucle —
    // Space/ESC se RE-LEEN, por eso va ANTES del gate global de salida.
    if (this.phase === "buy-deal") {
      if (key === "y") this.buyDealYes();
      else if (key === "n") this.buyDealNo();
      return;
    }
    // PAUSA del aviso a-tope (`buy_one_item` 0x0a73, getkey que DESCARTA la tecla —
    // Space/ESC incluidos): cualquier tecla imprime el epílogo y re-lista (0x0af2 +
    // 0x0c49 → 0x0b40). Antes del gate global por lo mismo.
    if (this.phase === "buy-full-pause") {
      this.deps.message(this.buyEpilogue());
      this.renderBuyList();
      this.deps.armKey();
      return;
    }
    if (this.phase === "greet-yn" || this.phase === "healer-again" || this.phase === "inn-again") {
      this.greetGateKey(key, raw);
      return;
    }
    // Y/N del `Is this thy need?" ` del reactivo (`buy_one_reagent` 0x5eb): el getkey
    // RE-LEE cualquier tecla que no sea Y/N (Space/ESC incluidos) — antes del gate global.
    if (this.phase === "reagent-deal") {
      if (key === "y") this.reagentDealYes();
      else if (key === "n") this.reagentDealNo();
      return;
    }
    // Y/N del `Interested?" ` del gremio (`buy_one_guild` 0x33d): mismo getkey en bucle.
    if (this.phase === "guild-deal") {
      if (key === "y") this.guildDealYes();
      else if (key === "n") this.guildDealNo();
      return;
    }
    // Y/N del `Deal?" ` del establo (SHOPPES 0x906-0x912): mismo getkey en bucle.
    if (this.phase === "horse-deal") {
      if (key === "y") this.horseDealYes();
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.leave(); }
      return;
    }
    // Y/N del «Anything else for thee?» de la taberna (SHOPPES2 0x7a1: re-lee
    // hasta Y/N): N → `No` + despedida; Y → menú de RE-VISITA (0x7b8).
    if (this.phase === "tavern-again") {
      if (key === "y") this.tavernMenu(true);
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.leave(); }
      return;
    }
    // Y/N del «Fair 'nuff?" » del rumor (SHOPPES2 0x05c2-0x05d7: el getkey re-lee
    // hasta Y/N). 'N' ecoa `No\n\n` y CUENTA como servicio (devuelve 0, §47).
    if (this.phase === "rumor-deal") {
      if (key === "y") this.rumorDealYes();
      else if (key === "n") {
        this.pendingRumor = null;
        this.deps.message(t(SHOP_UI.rumorNo));
        this.tavernEpilogue(true);
      }
      return;
    }
    // Y/N del «Wilt thou take it?" » del astillero (SHOPPES2 0x992/0xa2e: el
    // getkey re-lee hasta Y/N — Space/ESC incluidos) — antes del gate global.
    if (this.phase === "ship-take") {
      if (key === "y") this.shipTakeYes();
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.leave(); }
      return;
    }
    // Y/N del «Will there be anything else?» del astillero (0x876): Y → menú de
    // nuevo (0x8c5); N → despedida. El getkey re-lee otras teclas.
    if (this.phase === "ship-else") {
      if (key === "y") { this.deps.message(t(SHOP_UI.innYes)); this.shipMenu(); }
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.leave(); }
      return;
    }
    // Y/N del `Wilt thou take it?" ` del descanso de posada (SHOPPES3 0xe9): el
    // getkey 0x9d82 re-lee hasta Y/N — antes del gate global de salida.
    if (this.phase === "inn-rest-take") {
      if (key === "y") this.innRestYes();
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.leave(); }
      return;
    }
    // Y/N del `Wilt thou take it?" ` del Leave de posada (SHOPPES3 0x3c2): idem.
    if (this.phase === "inn-leave-take") {
      if (key === "y") this.innLeaveYes();
      else if (key === "n") {
        this.deps.message(t(SHOP_UI.reagentNo));
        this.pendingInnLeave = null;
        this.innEpilogue();
      }
      return;
    }
    // Y/N del `Wilt thou pay?" ` del curandero (0x1478-0x14a0): getkey en bucle.
    if (this.phase === "healer-pay") {
      if (key === "y") this.healerPayYes();
      else if (key === "n") { this.deps.message(t(SHOP_UI.reagentNo)); this.healerEpilogue(); }
      return;
    }
    // Nature-of-need del curandero (0x1550-0x1568): acepta C/H/R/Space/CR; otras re-leen.
    if (this.phase === "healer-need") {
      this.healerNeedKey(key, raw);
      return;
    }
    // PAUSA del aviso a-tope del reactivo (`buy_one_reagent` 0x557, getkey que
    // DESCARTA la tecla): cualquier tecla re-lista (ret → 0x688→0x691).
    if (this.phase === "reagent-full-pause") {
      this.renderReagentList();
      this.deps.armKey();
      return;
    }
    // Y/N del aviso de borrachera (0x0236-0x026d): el getkey RE-LEE cualquier otra
    // tecla — Space/ESC incluidos —, por eso va ANTES del gate global de salida.
    if (this.phase === "tavern-drunk-gate") {
      this.drunkGateKey(key);
      return;
    }
    // ESPACIO en la carta de vinos (0x02ce): NO sale de la taberna — imprime el
    // registro 89 y vuelve al epílogo con ret 2 (#325). Va ANTES del gate global.
    if (this.phase === "wine-list" && (raw === " " || raw === "Spacebar")) {
      this.wineWithdraw();
      this.deps.armKey();
      return;
    }
    // Espacio / Escape = salir (despedida). El Enter en una lista se ignora —
    // salvo en la lista de reactivos, donde el binario TAMBIÉN sale con CR (0x6f0).
    if (raw === " " || raw === "Spacebar" || raw === "Escape" ||
        (raw === "Enter" && this.phase === "reagent-list")) {
      this.leave();
      return;
    }
    switch (this.phase) {
      case "menu":
        this.menuKey(key);
        return;
      case "buy-list":
        this.pickBuy(key);
        return;
      // "sell-list" no llega aquí: mientras la ventana «Arms» está abierta, el prompt
      // lo posee su picker (deps.openArmsPicker) y las teclas van a su reductor (el
      // cancel del picker sale por sellExit con el Good-bye propio del flujo). Sin
      // nada vendible la sesión ya se cerró en sellStart (growls DS 0x7f20).
      case "reagent-list":
        this.pickReagent(key);
        return;
      case "guild-list":
        this.pickGuild(key);
        return;
      case "tavern-menu":
        this.tavernMenuKey(key);
        return;
      case "ship-menu":
        // F/S → pitch; OTRA tecla → re-imprime el menú (0xaa9 → 0x8c5).
        if (key === "f") this.shipPitch("frigate");
        else if (key === "s") this.shipPitch("skiff");
        else this.shipMenu();
        return;
      case "wine-list":
        this.pickWine(key);
        return;
      case "heal-heal":
      case "heal-cure":
      case "heal-resurrect":
        this.pickHealMember(key);
        return;
      case "inn-pickup":
        this.pickInnPickup(key);
        return;
    }
  }

  private menuKey(key: string): void {
    const s = this.game.state;
    switch (this.type) {
      case "Blacksmith":
        // Cada flujo re-arranca el flag de sesión (0xb30 entra con [bp-8]=0); entrar a
        // VENTA deja si=0xffff al salir (0x135d) → despedida silenciosa (emitFarewell).
        // Buy: eco+charla 1-de-4 ×2 (rama 'B' @0x1306) y la lista (buyStart arma).
        if (key === "b") { this.blacksmithFlow = "buy"; this.boughtInBuy = false; this.buyThrownOut = false; this.buyStart(); this.deps.armKey(); }
        // Sell: sellStart ARMA ella misma (la ventana «Arms» toma el prompt vía
        // openArmsPicker; sin nada vendible imprime el growls DS 0x7f20 y CIERRA).
        // No llamar armKey aquí: pisaría el prompt del picker.
        else if (key === "s") { this.blacksmithFlow = "sell"; this.sellStart(); }
        return;
      case "MagicSeller":
        this.pickReagent(key);
        return;
      case "GuildMaster":
        this.pickGuild(key);
        return;
      case "Shipwright":
        return;
      case "Healer":
        if (key === "c") { this.renderHealMemberList("cure"); this.deps.armKey(); }
        else if (key === "h") { this.renderHealMemberList("heal"); this.deps.armKey(); }
        else if (key === "r") { this.renderHealMemberList("resurrect"); this.deps.armKey(); }
        return;
      case "InnKeeper":
        // SHOPPES3 0x92b-0x945: R → 0x0072 (rest), L → 0x02ae (leave), P → 0x04e6.
        if (key === "r") { this.innRestStart(); }
        else if (key === "l") { this.innLeaveStart(); }
        else if (key === "p") { this.innPickupStart(); this.deps.armKey(); }
        return;
      case "Barkeeper":
        return; // el menú fiel vive en la fase "tavern-menu" (F2-T10)
      case "HorseSeller":
        if (key === "y") { this.buyHorse(); }
        else if (key === "n") { this.leave(); }
        return;
      default:
        void s;
    }
  }

  /**
   * PITCH del ítem elegido (letra válida @0x0b98 → eco MINÚSCULA 0x0ba1 +
   * `buy_one_item` 0x09ac): `\n\n"` (DS 0x7b5e) + registro SHOPPE.DAT de la tabla DS
   * 0x3c48 por equipId (BLACKSMITH_BUY_PITCH_INDEX; `%` = precio §0.1 ya calculado)
   * + `\n\n` (DS 0x7b62) + pregunta 1-de-4 (rand(0,3) del stream VIVO, tabla DS
   * 0x3ca6) + `" ` (DS 0x7b66). Queda pendiente del Y/N (fase "buy-deal"; el getkey
   * del binario re-lee cualquier otra tecla). Tecla inválida: se RE-LEE en silencio
   * (0x0c3c, sin re-listar) — el `return` sin eco ya lo calca.
   *
   * Degradación sin pool (patrón emitGreeting/pickSell): compra DIRECTA como antes
   * del carril (mensaje del core), SIN consumir el rand de la pregunta.
   */
  private pickBuy(key: string): void {
    const opt = this.options.find((o) => o.key === key);
    if (!opt) return;
    const idx = this.options.indexOf(opt);
    const equipId = this.buyStock()[idx];
    if (equipId === undefined) return;
    const price = equipmentBuyPrice(this.data.equipmentBasePrices[equipId] ?? 0, this.intel());
    const pool = this.deps.shoppeTexts;
    const pitchIdx = BLACKSMITH_BUY_PITCH_INDEX[equipId];
    const template = pool && pitchIdx != null ? pool[pitchIdx] : undefined;
    if (!template) {
      const r = buyEquipment(this.game.state, equipId, price);
      // ★ El sin-oro de la ARMERÍA es la ÚNICA de las cuatro degradaciones que se
      // puede emitir ENTERA sin pool: sus cuatro piezas son literales de DATA.OVL
      // (DS 0x7ba4 + tabla DS 0x3cae + DS 0x7ba8), no registros de SHOPPE.DAT. Se
      // calca igual que la rama con pool (buyDealYes), rand incluido, y con el ret
      // −1 de 0x0aa4 que ECHA de la tienda con despedida silenciosa. #36.
      if (!r.ok && r.reason === "gold") {
        this.deps.message(
          t(SHOP_UI.buyBrokeOpen) +
            t(BLACKSMITH_BUY_BROKE[this.game.shopGreetingRand(0, 3)]!) +
            expandShoppeTemplate(t(SHOP_UI.buyBrokeYells), this.expandCtx()),
        );
        this.buyThrownOut = true; // despedida 0x0202 con arg=-1 → silencio
        this.leave();
        return;
      }
      // Éxito y tope-99: el core SÍ devuelve la cadena DERIVADA (#147 tanda 2); el
      // `$` se expande por la misma vía que la rama con pool.
      this.deps.message(expandShoppeTemplate(t(r.message), this.expandCtx()));
      this.drainOnPurchase(r.ok);
      this.markPurchase(r.ok);
      this.deps.refreshGold();
      this.renderBuyList();
      this.deps.armKey();
      return;
    }
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    this.deps.message(
      opt.key + // eco de la letra en minúscula (putchar 0x61+slot, 0x0ba1)
        t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7b5e
        expandShoppeTemplate(t(template), { keeper, shop, day, price: String(price) }) +
        "\n\n" + // DS 0x7b62 (rodaja técnica sin letras)
        t(BLACKSMITH_BUY_ASKS[this.game.shopGreetingRand(0, 3)]!) +
        t(SHOP_UI.sellQuoteClose), // `" ` — mismos bytes que DS 0x7b66
    );
    this.pendingBuy = { equipId, price };
    this.phase = "buy-deal";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del pitch (`buy_one_item` 0x0a57-0x0ae0): eco `Yes\n` (DS 0x7b70) y las
   * TRES salidas del binario, decididas por la MISMA transacción del core
   * (buyEquipment, mecánica byte-fiel intacta — `reason` sólo etiqueta el fallo):
   *   · cap (qty==99, 0x0a5e): aviso DS 0x7b76 + `says $.\n\n` (0x7b9a) y GETKEY DE
   *     PAUSA (0x0a73) → fase "buy-full-pause" (cualquier tecla → epílogo+re-lista).
   *   · sin oro (0x0a7b): `\n"` (0x7ba4) + insulto 1-de-4 (rand(0,3) del stream VIVO,
   *     tabla DS 0x3cae) + `"\nyells $.\n` (0x7ba8) y la SESIÓN TERMINA con la
   *     despedida 0x0202 en SILENCIO (retorno -1 @0x0aa4 → 0x135d).
   *   · pago (0x0aaa): gold−=precio + merma 0x019a + repinta panel (0x8670=kernel
   *     0x2900; aquí refreshGold) + grant (+1 cap 99; munición 0x1b/0x1d → 99 directo,
   *     0x0ac1 — dentro de buyEquipment) + `\nSold!\n` (0x7bb4) → epílogo + re-lista.
   */
  private buyDealYes(): void {
    const sale = this.pendingBuy;
    this.pendingBuy = null;
    if (!sale) return;
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    const r = buyEquipment(this.game.state, sale.equipId, sale.price);
    if (!r.ok && r.reason === "cap") {
      this.deps.message(
        t(SHOP_UI.buyYes) +
          t(SHOP_UI.buyFull) +
          expandShoppeTemplate(t(SHOP_UI.buyFullSays), { keeper, shop, day }),
      );
      this.phase = "buy-full-pause";
      this.setOptions([]);
      this.deps.armKey();
      return;
    }
    if (!r.ok) {
      this.deps.message(
        t(SHOP_UI.buyYes) +
          t(SHOP_UI.buyBrokeOpen) +
          t(BLACKSMITH_BUY_BROKE[this.game.shopGreetingRand(0, 3)]!) +
          expandShoppeTemplate(t(SHOP_UI.buyBrokeYells), { keeper, shop, day }),
      );
      this.buyThrownOut = true; // despedida 0x0202 con arg=-1 → silencio
      this.leave();
      return;
    }
    this.drainOnPurchase(true);
    this.markPurchase(true);
    this.deps.refreshGold();
    this.deps.message(t(SHOP_UI.buyYes) + t(SHOP_UI.buySold) + this.buyEpilogue());
    this.renderBuyList();
    this.deps.armKey();
  }

  /**
   * Rama 'N' del pitch (0x0a40): eco `No\n\n` (DS 0x7b6a) + epílogo (0x0af2) y
   * re-lista (0x0c49 → 0x0b40, con su rand de pregunta).
   */
  private buyDealNo(): void {
    this.pendingBuy = null;
    this.deps.message(t(SHOP_UI.buyNo) + this.buyEpilogue());
    this.renderBuyList();
    this.deps.armKey();
  }

  /**
   * Epílogo del pitch (`buy_one_item` 0x0af2-0x0b22): `"Anything else,\n` (DS 0x7bbc)
   * + cola por el flag ACUMULADO de la sesión (di): sin compra aún → `then?` (0x7bdc);
   * con compra → por género del negociador (record +0x09 @0x55b1: 0x0c hembra →
   * `milady?` 0x7bce; si no `sir?` 0x7bd6). El negociador es characters[0] (mismo
   * supuesto que intel(); re/notes/shops.md §10).
   */
  private buyEpilogue(): string {
    const tail = !this.boughtInBuy
      ? t(SHOP_UI.buyThen)
      : this.game.state.characters[0]?.gender === 0x0c
        ? t(SHOP_UI.buyMilady)
        : t(SHOP_UI.buySir);
    return t(SHOP_UI.buyAnythingElse) + tail;
  }

  /**
   * OFERTA del tendero al elegir un ítem (Enter en la ventana «Arms») — `sell_one_item`
   * SHOPPES 0x0e76 (carril sell-offers; derivación completa en shoppe-greetings.ts
   * § BLACKSMITH_SELL_OFFER_INDEX). Reconstruye el mismo orden que `openSellPicker`
   * para mapear índice → equipId; el CÁLCULO del precio no cambia
   * (`equipmentSellPrice` = §0.2, byte-fiel — es el g_shop_accum que la plantilla
   * interpola en `%`). La VENTA ya no es directa: queda pendiente del Deal? Y/N
   * (fase "sell-deal", ver dealYes/dealNo).
   *
   * Munición usada (Arrows 0x1b / Quarrels 0x1d, gate 0x0e7d): growls DS 0x7d32 y la
   * sesión CIERRA (ret 1 → el caller sale con el Good-bye del epílogo SUPRIMIDO,
   * [bp-0x10]≠0 @0x126c; la despedida general 0x0202 ya va en silencio por
   * blacksmithFlow==='sell'). SIN consumir el rand de la oferta (el gate va antes).
   */
  private pickSell(index: number): void {
    const equipId = this.sellableIds()[index];
    if (equipId === undefined) return;
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    if (equipId === 0x1b || equipId === 0x1d) {
      this.deps.message(expandShoppeTemplate(t(SHOP_UI.sellAmmo), { keeper, shop, day }));
      this.leave();
      return;
    }
    // PRECIO BASE 0 (0x0ea2). Va AQUÍ y no antes: el binario lo comprueba DESPUÉS del
    // gate de munición (0x0e7d) y DESPUÉS de imprimir la comilla de apertura (0x0e96),
    // pero ANTES del precio (0x0eac) y del rand de la oferta (0x0eec) — por eso este
    // camino no consume tirada. Y devuelve 0 (0x0f5b), no 1: la sesión NO se cierra,
    // se re-lista por `afterDeal` igual que la 'N'. Las dos ramas de rechazo de
    // `sell_one_item` difieren justo en eso.
    if ((this.data.equipmentBasePrices[equipId] ?? 0) <= 0) {
      this.deps.message(
        t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7d64 (0x0e96)
          expandShoppeTemplate(t(SHOP_UI.sellCannotBuy), { keeper, shop, day }), // DS 0x7d8c
      );
      this.afterDeal();
      return;
    }
    const price = equipmentSellPrice(this.data.equipmentBasePrices[equipId] ?? 0, this.intel());
    // 0x0eec rand(0,7) del stream VIVO → plantilla shoppe.json[49..56] (tabla DS
    // 0x3cbe); `%` = precio, `&` = nombre (tabla 0x3cce||0x17f6). t() ANTES de
    // expandir (choke de pushConsole no alcanza compuestos); nombre también por t()
    // (display-nouns; identidad si falta). Degradación (patrón emitGreeting): sin
    // pool NO se consume rand y la venta es DIRECTA como antes del carril (mensaje
    // del core); con pool corto (asset roto) ídem tras el rand.
    const pool = this.deps.shoppeTexts;
    const template = pool
      ? pool[BLACKSMITH_SELL_OFFER_INDEX[this.game.shopGreetingRand(0, 7)]!]
      : undefined;
    if (!template) {
      const r = sellEquipment(this.game.state, equipId, price);
      // Degradación sin pool: cadena DERIVADA del core (#147 tanda 2) con el `$`
      // expandido como en la rama con pool (dealYes). Aquí la cita SÍ cubre lo que
      // se emite de verdad: la VENTA no tiene rama de oro (entra oro, no sale), así
      // que la fabricación de #36 no pasa por este sitio.
      //
      // 🔴 ERRATA CORREGIDA. Esto decía que los dos rechazos de `sell_one_item`
      // «siguen sin transcripción del binario». Era FALSO: la de munición está
      // transcrita instrucción a instrucción en `shoppe-greetings.ts` y en el ledger,
      // y se emite aquí arriba (DS 0x7d32, gate 0x0e7d). Y el segundo rechazo NO es
      // «Thou hast none to sell!` en 0x0ea2: 0x0ea2 es la guarda de PRECIO BASE 0
      // (DS 0x7d8c), que ya se calca en `pickSell`; el de stock no existe en el
      // binario. Los dos `message` fabricados del núcleo quedaron VACIADOS.
      this.deps.message(expandShoppeTemplate(t(r.message), this.expandCtx()));
      this.deps.refreshGold();
      this.afterDeal();
      return;
    }
    const item = t(SELL_OFFER_NAMES[equipId] ?? EQUIPMENT_NAMES[equipId] ?? `Equip ${equipId}`);
    this.deps.message(
      t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7d64 (0x0e96)
        expandShoppeTemplate(t(template), { keeper, shop, day, price: String(price), item }) +
        t(SHOP_UI.sellDealPrompt), // `\n\nDeal?" ` DS 0x7d68 (0x0f05)
    );
    this.pendingSell = { equipId, price };
    this.phase = "sell-deal";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del Deal? (`sell_one_item` 0x0f2a-0x0f4b): eco DS 0x7d76
   * `Yes\n\n"Done!"\nsays $.` (call 0x26 expande $) y la venta EJECUTA — gold +=
   * precio cap 9999 (kernel 0x9c84 [= CS 0x3f14 → ULTIMA.EXE:0x3f14]) + qty[item] −= 1 (kernel 0x9ca6 [= CS 0x3f36 → ULTIMA.EXE:0x3f36]): la MISMA
   * `sellEquipment` del core de siempre (su mensaje QoL se sustituye por el eco fiel).
   */
  private dealYes(): void {
    const sale = this.pendingSell;
    this.pendingSell = null;
    if (!sale) return;
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    this.deps.message(expandShoppeTemplate(t(SHOP_UI.sellDealYes), { keeper, shop, day }));
    sellEquipment(this.game.state, sale.equipId, sale.price);
    this.deps.refreshGold();
    this.afterDeal();
  }

  /**
   * Rama 'N' (`sell_one_item` 0x0f20): eco `No` (DS 0x7d72, print crudo 0x75c0, sin
   * expansión) y NO vende — el caller sigue por el MISMO epílogo que la venta
   * (ret 0 @0x11f6): What-else + re-lista (`afterDeal`).
   */
  private dealNo(): void {
    this.pendingSell = null;
    this.deps.message(t(SHOP_UI.reagentNo)); // «No» — mismos bytes que DS 0x7d72
    this.afterDeal();
  }

  /**
   * Continuación del caller tras el Deal (SHOPPES 0x11fa-0x1232, para 'Y' y 'N' por
   * IGUAL): si ya no queda nada vendible (0xc58==0) el flujo SALE (Good-bye sin
   * atribución, `sellExit`); si queda, re-abre la ventana con filas frescas (0xc80)
   * y charla `\n\n"` (DS 0x7f06) + «What else…» 1-de-4 (rand(0,3) del stream VIVO,
   * tabla DS 0x3d3e) + `" ` (DS 0x7f0a) — emisor 0x120f-0x122f.
   */
  private afterDeal(): void {
    if (this.sellableIds().length === 0) {
      this.sellExit();
      return;
    }
    this.phase = "sell-list"; // la ventana re-abierta vuelve a poseer el prompt
    this.openSellPicker();
    this.deps.message(
      t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7f06
        t(BLACKSMITH_SELL_MORE[this.game.shopGreetingRand(0, 3)]!) +
        t(SHOP_UI.sellQuoteClose),
    );
  }

  /**
   * CADENA DE COMPRA del reactivo (C2/diff-1; derivación completa en
   * shoppe-greetings.ts § MAGIC_SELLER_PITCH_INDEX — `buy_one_reagent` SHOPPES
   * 0x502). Letra válida → cap-99 (0x549: aviso DS 0x792c + getkey de PAUSA) o
   * PITCH del slot (`\n\n"` + shoppe.json[139+slot] con `%`=precio `^`=cantidad
   * + ` Is this thy need?" `) y fase "reagent-deal" (Y/N en bucle). SIN rands:
   * el pitch va por slot. Tecla inválida: re-lee en silencio (ret -2, 0x536).
   *
   * Degradación sin pool (patrón emitGreeting): compra DIRECTA como antes del
   * carril (mensaje del core).
   */
  private pickReagent(key: string): void {
    const opt = this.options.find((o) => o.key === key);
    if (!opt) return;
    const s = this.game.state;
    const town = shopTownIndex("MagicSeller", s.position.location);
    if (town < 0) return;
    // Reconstruye el orden (slots con precio) para mapear la letra → slot.
    const slots: number[] = [];
    for (let slot = 0; slot < 8; slot++) {
      if (reagentPriceAt(town, slot, this.intel(), this.data.reagentBasePrices) !== null) slots.push(slot);
    }
    const idx = this.options.indexOf(opt);
    const slot = slots[idx];
    if (slot === undefined) return;
    const price = reagentPriceAt(town, slot, this.intel(), this.data.reagentBasePrices)!;
    const qty = reagentGrantQty(town, slot, this.data.reagentQuantities);
    const pool = this.deps.shoppeTexts;
    const template = pool ? pool[MAGIC_SELLER_PITCH_INDEX[slot]!] : undefined;
    if (!template) {
      const r = buyReagent(s, slot, qty, price);
      // Sin oro: registro 147 (0x0610, chunk 0xb6e2 = fileoff 0x1f2b) y ret −1
      // (0x0617) que ECHA. A diferencia de la armería el texto es un registro del
      // POOL, así que por esta vía (degradada, sin pool) NO EXISTE: se echa en
      // silencio. Mismo criterio que reagentDealYes/shipTakeYes — cuando el
      // registro no está, no se dice nada; jamás se rellena el hueco. #36.
      if (!r.ok && r.reason === "gold") {
        const broke = this.deps.shoppeTexts?.[MAGIC_SELLER_BROKE_INDEX];
        if (broke) this.deps.message(expandShoppeTemplate(t(broke), this.expandCtx()));
        this.thrownOut = true; // ret −1 → despedida 0x202 arg=-1 (silencio)
        this.leave();
        return;
      }
      // Éxito y tope-99: cadena DERIVADA del core (#147), con el `$` del `says $.`
      // expandido por la MISMA vía que la rama con pool.
      this.deps.message(expandShoppeTemplate(t(r.message), this.expandCtx()));
      this.drainOnPurchase(r.ok);
      this.markPurchase(r.ok);
      this.deps.refreshGold();
      this.deps.armKey();
      return;
    }
    // Cap 99 ANTES del pitch (0x549 sobre g_reagents DS 0x5850): aviso + getkey de
    // pausa que DESCARTA la tecla (0x557) y re-lista.
    if ((s.reagentQuantities[slot] ?? 0) >= 0x63) {
      this.deps.message(t(SHOP_UI.reagentFull));
      this.phase = "reagent-full-pause";
      this.setOptions([]);
      this.deps.armKey();
      return;
    }
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(s.time.hour));
    this.deps.message(
      t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x7952
        expandShoppeTemplate(t(template), { keeper, shop, day, price: String(price), qty: String(qty) }) +
        t(SHOP_UI.reagentNeed), // ` Is this thy need?" ` DS 0x7956
    );
    this.pendingReagent = { slot, price, qty };
    this.phase = "reagent-deal";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del `Is this thy need?" ` (0x600-0x64a): eco `Yes\n` (DS 0x7982) y:
   *   · sin oro (0x60a): registro shoppe.json[147] (`Thou profaneth my shoppe…
   *     OUT!" snarls $.`, chunk 0xb6e2 = fileoff 0x1f2b) y ret -1 → la sesión
   *     TERMINA con la despedida 0x202 en SILENCIO (te echan).
   *   · pago (0x61c): gold−= + merma 0x19a + repaint + grant cap 99 (0x9c60) +
   *     `\n"I thank thee!"\nsays $.\n` (DS 0x7988) + `"Anything else?\n\n`
   *     (DS 0x79a2) y RE-LISTA (el caller 0x736 → 0x691).
   * La transacción es la MISMA `buyReagent` del core (mecánica intacta).
   */
  private reagentDealYes(): void {
    const sale = this.pendingReagent;
    this.pendingReagent = null;
    if (!sale) return;
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(this.game.state.time.hour));
    const r = buyReagent(this.game.state, sale.slot, sale.qty, sale.price);
    if (!r.ok) {
      const broke = this.deps.shoppeTexts?.[MAGIC_SELLER_BROKE_INDEX];
      this.deps.message(
        t(SHOP_UI.buyYes) + (broke ? expandShoppeTemplate(t(broke), { keeper, shop, day }) : ""),
      );
      this.thrownOut = true; // ret -1 → despedida 0x202 arg=-1 (silencio)
      this.leave();
      return;
    }
    this.drainOnPurchase(true);
    this.markPurchase(true);
    this.deps.refreshGold();
    this.deps.message(
      t(SHOP_UI.buyYes) +
        expandShoppeTemplate(t(SHOP_UI.reagentThanks), { keeper, shop, day }) +
        t(SHOP_UI.reagentAnythingElse),
    );
    this.renderReagentList();
    this.deps.armKey();
  }

  /** Rama 'N' (0x5f5): eco `No\n\n"What else?\n\n` (DS 0x7970) y re-lista. */
  private reagentDealNo(): void {
    this.pendingReagent = null;
    this.deps.message(t(SHOP_UI.reagentDealNo));
    this.renderReagentList();
    this.deps.armKey();
  }

  /**
   * CADENA DE COMPRA del gremio (derivación en shoppe-greetings.ts §
   * GUILD_PITCH_INDEX — SHOPPES 0x3f6 + `buy_one_guild` 0x2ba): letra a-c → eco
   * en MINÚSCULA (putchar al|0x20, 0x445) + `\n\n"` + pitch shoppe.json[160+item]
   * (`%`=precio) + `\n\nInterested?" ` y fase "guild-deal". 'D' → easter-egg
   * shoppe.json[164] (el eco `d` va DENTRO del registro) y re-lista (0x478).
   * Tecla inválida: re-lee en silencio. Degradación sin pool: compra directa.
   */
  private pickGuild(key: string): void {
    const s = this.game.state;
    const town = shopTownIndex("GuildMaster", s.position.location);
    if (town < 0) return;
    const pool = this.deps.shoppeTexts;
    if (key === "d" && pool?.[GUILD_EASTEREGG_INDEX] && this.phase === "guild-list") {
      const keeper = this.info?.keeperName?.trim() ?? "";
      const shop = this.info?.shopName?.trim() ?? "";
      const day = t(partOfDayWord(s.time.hour));
      this.deps.message(expandShoppeTemplate(t(pool[GUILD_EASTEREGG_INDEX]!), { keeper, shop, day }));
      this.renderGuildList();
      this.deps.armKey();
      return;
    }
    const opt = this.options.find((o) => o.key === key);
    if (!opt) return;
    const item = this.options.indexOf(opt) as GuildItem;
    const price = guildPrice(town, item, this.intel());
    const template = pool ? pool[GUILD_PITCH_INDEX[item]!] : undefined;
    if (!template) {
      const r = buyGuildItem(s, town, item, this.intel());
      // Sin oro: registro 163 (0x0367 + print_shoppe 0x17a) y ret −1 (0x036e) que
      // ECHA. Registro del POOL, igual que reactivos: sin pool no hay texto y se
      // echa en silencio. #36.
      if (!r.ok && r.reason === "gold") {
        const broke = this.deps.shoppeTexts?.[GUILD_BROKE_INDEX];
        if (broke) this.deps.message(expandShoppeTemplate(t(broke), this.expandCtx()));
        this.thrownOut = true;
        this.leave();
        return;
      }
      // Éxito: cadena DERIVADA del core (#147), con el `$` expandido por la misma
      // vía que la rama con pool (guildDealYes).
      this.deps.message(expandShoppeTemplate(t(r.message), this.expandCtx()));
      this.drainOnPurchase(r.ok);
      this.markPurchase(r.ok);
      this.deps.refreshGold();
      this.deps.armKey();
      return;
    }
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(s.time.hour));
    this.deps.message(
      key + // eco de la letra en minúscula (0x445)
        t(SHOP_UI.farewellQuoteOpen) + // `\n\n"` — mismos bytes que DS 0x786e
        expandShoppeTemplate(t(template), { keeper, shop, day, price: String(price) }) +
        t(SHOP_UI.guildInterested), // `\n\nInterested?" ` DS 0x7872
    );
    this.pendingGuild = { item, price };
    this.phase = "guild-deal";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del `Interested?" ` (0x357-0x3d9): eco `Yes\n` (DS 0x789a) y:
   *   · sin oro (0x367): registro shoppe.json[163] («Death comes in many ways to
   *     those who cheat the Guild!» warns $, fileoff 0x21e6) y ret -1 → despedida
   *     0x202 SILENCIOSA (te echan).
   *   · pago (0x374): gold−= + merma 0x19a + repaint + grant (keys+3/gems+4/
   *     torches+5 cap 0x63 — la MISMA `buyGuildItem` del core) + `\n"Sold!"\n
   *     says $.\n\n"What else, \n` (DS 0x78a0) + `m'lady`/`m'lord` por género del
   *     negociador ([0x55b1]==0x0c; characters[0], supuesto intel()) + `?\n\n`
   *     (DS 0x78d0) y RE-LISTA (0x46e→0x40d).
   */
  private guildDealYes(): void {
    const sale = this.pendingGuild;
    this.pendingGuild = null;
    if (sale === null) return;
    const s = this.game.state;
    const town = shopTownIndex("GuildMaster", s.position.location);
    if (town < 0) return;
    const keeper = this.info?.keeperName?.trim() ?? "";
    const shop = this.info?.shopName?.trim() ?? "";
    const day = t(partOfDayWord(s.time.hour));
    const r = buyGuildItem(s, town, sale.item, this.intel());
    if (!r.ok) {
      const broke = this.deps.shoppeTexts?.[GUILD_BROKE_INDEX];
      this.deps.message(
        t(SHOP_UI.buyYes) + (broke ? expandShoppeTemplate(t(broke), { keeper, shop, day }) : ""),
      );
      this.thrownOut = true; // ret -1 (0x36e) → despedida silenciosa
      this.leave();
      return;
    }
    this.drainOnPurchase(true);
    this.markPurchase(true);
    this.deps.refreshGold();
    const genderTail = s.characters[0]?.gender === 0x0c ? t(SHOP_UI.guildMlady) : t(SHOP_UI.guildMlord);
    this.deps.message(
      t(SHOP_UI.buyYes) +
        expandShoppeTemplate(t(SHOP_UI.guildSold), { keeper, shop, day }) +
        genderTail +
        t(SHOP_UI.guildQtail),
    );
    this.renderGuildList();
    this.deps.armKey();
  }

  /** Rama 'N' (0x347): `No\n\n"What else, then?\n\n` (DS 0x7882) y re-lista. */
  private guildDealNo(): void {
    this.pendingGuild = null;
    this.deps.message(t(SHOP_UI.guildDealNo));
    this.renderGuildList();
    this.deps.armKey();
  }

  /**
   * ELECCIÓN en la carta (SHOPPES2 0x02f6-0x036f), calcada en orden (#325):
   *   0x02f6/0x02fc  fuera de `'A'`..`'F'` → `jb/ja 0x02c8` = VUELVE A LEER, sin
   *                  re-imprimir la carta (aquí: `if (!opt) return`).
   *   0x0302-0x0319  eco de la letra + `\n\n"Ah, a fine\nchoice, ` + trato + `.`
   *   0x032a         `cmp [bx+0x4c48], ax` / `jle` → compra si precio ≤ oro
   *   0x0330-0x034f  sin oro: `"…CAN'T PAY? Beat it!" yells <tendero>.` y ret 1 =
   *                  te ECHAN (salida 0x7dc SIN despedida), igual que la ronda.
   *   0x035d-0x036f  con oro: `sub [g_gold]`, merma (0x9dfa), `inc [g_cups_served]`,
   *                  `\nEnjoy!"` y la cola compartida 0x02d2 = dos `putchar('\n')`.
   *
   * El eco va en MAYÚSCULA porque el gate del binario compara contra 0x41..0x46 y el
   * `putchar` de 0x0308 imprime el byte tal como lo dejó el getkey; el despacho de
   * `key()` ya nos lo entrega en minúscula. Misma convención que `tavernRationsChain`.
   *
   * ⚠ RESIDUO DECLARADO (no es de esta ficha): el gate de borrachera del binario vive
   * en 0x020a, ANTES del discriminante `'W'`, así que allí el karma −1 y el timer 25 se
   * aplican al ELEGIR la bebida — también si luego te retiras con Espacio. En el clon
   * siguen dentro de `buyWine`, o sea al COMPRAR. Sólo se nota retirándose con el
   * contador exactamente en 3.
   */
  private pickWine(key: string): void {
    const opt = this.options.find((o) => o.key === key);
    if (!opt) return; // 0x02f6/0x02fc: tecla fuera de rango → re-lee en silencio
    const w = this.options.indexOf(opt);
    // Eco (0x0302-0x0319): letra + cadena + trato por género + putchar('.').
    this.deps.message(
      key.toUpperCase() +
        t(SHOP_UI.wineFineChoice) +
        this.honorific() +
        SHOP_UI.tavernPriceClose, // putchar '.' (0x0315) — puntuación, no se traduce
    );
    // El gate de borrachera ya pasó en `drinkDrunkGate` (0x020a), antes de la carta.
    const r = buyWine(this.game.state, w);
    if (!r.ok) {
      // 0x0330: DS 0x9c20 (abre cerrando la comilla del eco) + nombre + `.` + `\n`,
      // y ret 1 ⇒ ECHADO sin despedida. Antes esto imprimía «Thou canst afford
      // only...» —fabricada, cero ocurrencias en DATA.OVL— y seguía en la taberna.
      this.deps.message(
        t(SHOP_UI.wineCantPay) + (this.info?.keeperName?.trim() ?? "") + SHOP_UI.tavernPriceClose + "\n",
      );
      this.deps.refreshGold();
      this.thrownOut = true;
      this.leave();
      return;
    }
    this.markPurchase(true);
    this.served += 1;
    this.drainOnPurchase(true); // SHOPPES2 0x0361 (tras `sub [g_gold]` 0x035d)
    // El éxito es DS 0x9c40 `\nEnjoy!"` (SHOPPES2 0x0368), no la frase fabricada
    // que había antes (#147). Sin plantilla de hablante: esta cadena no lleva `$`.
    // Detrás va la cola COMPARTIDA 0x02d2 (dos `putchar('\n')`), la misma por la que
    // sale el Espacio — por eso `wineWithdraw` también los emite.
    this.deps.message(t(r.message) + "\n\n");
    this.deps.refreshGold();
    // F2-T10: servida la copa, el flujo vuelve por el epílogo de la taberna
    // (SHOPPES2 0x767 — el vino es una de las 4 teclas del menú fiel).
    this.tavernEpilogue(true);
  }

  /**
   * Vía DEGRADADA del curandero (sin pool de saludos → `renderMenu` → `heal-*`).
   * La cadena FIEL vive en `healerNeedKey`/`healerMemberChosen`/`healerPayYes`;
   * aquí sólo queda el picker plano de antes del carril.
   *
   * ★ Pero el sin-oro NO es sólo un texto: el binario corre ANTES la CARIDAD
   * (0x14c2 `cmp ax,0x64 / jg 0x14ce` + 0x14c7 `cmp [g_location],7 / je 0x14da`),
   * y con precio ≤ 100 en Skara Brae HACE el servicio gratis. Sólo si no aplica
   * imprime el registro 173 (0x14ce) y devuelve DECLINADO — sin echar de la
   * tienda, a diferencia de armería/reactivos/gremio. Se calcan las dos cosas;
   * el registro es del POOL, así que por esta vía no hay texto. #36.
   */
  private pickHealMember(key: string): void {
    const opt = this.options.find((o) => o.key === key);
    const idx = this.optionIdx(opt);
    if (idx === null) return;
    const service = this.phase.slice("heal-".length) as HealerService;
    const s = this.game.state;
    const prices = healerPrices(s.position.location, this.data.healPrices, this.data.curePrices, this.data.resurrectPrices);
    if (!prices) return;
    const price = prices[service];
    let r = healerHeal(s, idx, service, price);
    if (!r.ok && r.reason === "gold") {
      if (price <= 100 && s.position.location === 7) {
        r = healerHeal(s, idx, service, 0); // caridad: sin pago ni merma
      } else {
        const sorry = this.deps.shoppeTexts?.[HEALER_SORRY_INDEX];
        if (sorry) this.deps.message(expandShoppeTemplate(t(sorry), this.expandCtx()));
        this.renderMenu(); // declinado: sigue el epílogo, no se echa
        this.deps.armKey();
        return;
      }
    } else {
      this.deps.message(t(r.message));
    }
    this.drainOnPurchase(r.ok);
    this.markPurchase(r.ok);
    this.deps.refreshGold();
    this.renderMenu();
    this.deps.armKey();
  }

  private pickInnPickup(key: string): void {
    const opt = this.options.find((o) => o.key === key);
    const idx = this.optionIdx(opt);
    if (idx === null) {
      // ESC/Space en el registro (0x06c8 `cmp ax,0x1b`): DS 0x4fd8 `No one\n\n`, sel=0
      // y salida por 0x0715 sin cobrar — el epílogo lo pone el bucle de menú.
      this.deps.message(t(SHOP_UI.innPickupNoOne));
      this.innEpilogue();
      return;
    }
    this.innPickupMember(idx);
  }

  /**
   * Cobro y desenlace del Pick up (SHOPPES3 0x0715-0x0896) — la TERNA multi-mensaje de
   * #145, en el orden del binario:
   *
   * 1. `0x0789` DS 0x4fe1 `\n\n"That will be % gold, please."\n\n"` (expansor `%`), que
   *    **se imprime ANTES de mirar el oro** (0x0793) y deja una comilla ABIERTA;
   * 2. sin oro (`0x0799`): registro 193 de SHOPPE.DAT vía `print_shoppe` — que cierra esa
   *    comilla y lleva su propio `says $.` — y `[bp+4]=0xFFFF`, que en el bucle de menú
   *    (0x098f→0x97f→0x95f) marca `[bp-2]=1` ⇒ **sin epílogo: la sesión se despide**;
   * 3. pagando: el motor mueve el roster y devuelve el fragmento hermano que toque
   *    (`died` ⇒ DS 0x5005, si no DS 0x5028), y `0x088f` remata con DS 0x5055 `says $.`.
   */
  private innPickupMember(idx: number): void {
    const s = this.game.state;
    const location = s.position.location;
    const inn = innAt(location);
    const buyerIdx = s.characters.findIndex((c) => c.partyStatus === 0);
    const buyer = s.characters[buyerIdx];
    const rec = s.characters[idx];
    if (!inn || !buyer || !rec) return;
    const months = Math.max(1, rec.monthsAtInn ?? 0); // 0x0725-0x0732: mínimo 1
    const price = innPickupPrice(inn, buyer.intelligence, months);
    this.deps.message(
      expandShoppeTemplate(t(SHOP_UI.innPickupPay), { ...this.expandCtx(), price: String(price) }),
    );
    if (s.gold < price) {
      const broke = this.deps.shoppeTexts?.[INN_PICKUP_BROKE_INDEX];
      if (broke) this.deps.message(expandShoppeTemplate(t(broke), this.expandCtx()));
      this.leave(); // [bp+4]=0xFFFF → 0x9c8 despedida, SIN «anything more»
      return;
    }
    const r = innPickup(s, buyerIdx, idx, location);
    this.markPurchase(r.ok);
    this.drainOnPurchase(r.ok); // SHOPPES3 0x07b3 (tras `sub [g_gold]` 0x07af)
    this.deps.message(t(r.died ? SHOP_UI.innPickupDied : SHOP_UI.innPickupEnjoy));
    this.deps.message(expandShoppeTemplate(t(SHOP_UI.innPickupSays), this.expandCtx()));
    this.deps.refreshGold();
    this.innEpilogue();
  }

  /**
   * Epílogo de la posada tras Leave/Pickup (SHOPPES3 0x992-0x9a2): `"Is there\n
   * anything more\nI can do for\nthee?" ` (DS 0x50bd) y vuelta al gate Y/N
   * (0x9ab: 'Y' → `Yes` + re-menú 0x917; 'N'/Space → `No` + despedida 0x9c8).
   */
  private innEpilogue(): void {
    this.deps.message(t(SHOP_UI.innMore));
    this.phase = "inn-again";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /** Palabra de género del Avatar (g_party_records+9): 0x0c → 'milady', si no 'sir'. */
  private innGenderWord(): string {
    const avatar = this.game.state.characters[0];
    return avatar?.gender === 0x0c ? t(SHOP_UI.innMilady) : t(SHOP_UI.innSir);
  }

  /**
   * Chequeo de aforo compartido de Rest/Leave (SHOPPES3 helper 0x002c): imprime
   * '\n\n' (DS 0x4d84) y, si los huéspedes alcanzan la capacidad de la posada
   * (tabla DS 0x4dc4), la disculpa `"I am sorry,\n` + sir/milady + `, but we\n
   * have no room\navailable."\n\n` (DS 0x4d87/0x4d95/0x4d9c/0x4da0) y ret 0.
   */
  private innRoomAvailable(): boolean {
    const s = this.game.state;
    const inn = innAt(s.position.location);
    if (!inn) return false;
    if (innGuestCount(s, s.position.location) >= inn.capacity) {
      this.deps.message(t(SHOP_UI.innSorry) + this.innGenderWord() + t(SHOP_UI.innSorryClose));
      return false;
    }
    return true;
  }

  /** INT del negociador (primer miembro en la party), como el resto de precios. */
  private innBuyerIdx(): number {
    return this.game.state.characters.findIndex((c) => c.partyStatus === 0);
  }

  /**
   * (R)est — SHOPPES3 0x0072, cadena FIEL (F2-T2, testigo aulddragon P05 ~2440):
   * eco 'R' (putchar 0x52 @0x7a) → aforo (helper 0x2c; llena → disculpa + epílogo,
   * ret -2 → 0x992) → `"` (putchar 0x22 @0x8e) + PITCH por-posada (tabla DS 0x4e6e
   * → shoppe.json[INN_PITCH_INDEX], % = rate·party con haggle @0x95-0xd1) +
   * `\nWilt thou take\nit?" ` (DS 0x4dca) → Y/N (fase "inn-rest-take").
   */
  private innRestStart(): void {
    this.deps.message("R"); // eco de la tecla (putchar 0x52)
    if (!this.innRoomAvailable()) { this.innEpilogue(); return; }
    const s = this.game.state;
    const inn = innAt(s.position.location)!;
    const buyer = s.characters[this.innBuyerIdx()];
    const price = innRestPrice(inn, s.partySize, buyer?.intelligence ?? 0);
    const pitch = this.deps.shoppeTexts?.[INN_PITCH_INDEX[inn.townIndex] ?? -1];
    const body = pitch
      ? expandShoppeTemplate(t(pitch), { ...this.expandCtx(), price: String(price) })
      : "";
    this.deps.message(t(SHOP_UI.greetQuoteOpen) + body + t(SHOP_UI.innWiltTake));
    this.phase = "inn-rest-take";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del `Wilt thou take it?" ` del descanso (SHOPPES3 0xf6-0x29c):
   *  · sin oro (0x102): `"Highwaymen!\nCheap, at that!\nOUT!" ` + `screams\n$.\n`
   *    (DS 0x4de3/0x4e07) → sesión fuera (despedida).
   *  · pago (0x11d): cobra + `"Have a pleasant\nnight, ` + sir/milady + `!"\nsays
   *    $.\n\n` (DS 0x4e13/0x4e2c/0x4e33/0x4e37) → party a la CAMA (tablas DS
   *    0x4e7a/0x4e80 @0x160) → `Zzzzzz....\n\n` (0x4e44) → reloj hasta las 6:00
   *    (bucle 0x1ca-0x1f4) → `Morning!\n` (0x4e51) → curación por miembro (HP=max,
   *    MP por clase; envenenado MUERE: '\n'+nombre+' has\npassed away.\n' DS
   *    0x4e5b) → un paso fuera de la cama (inc g_party_x @0x28b) → despedida.
   */
  private innRestYes(): void {
    this.deps.message(t(SHOP_UI.innYes)); // eco del getkey Y/N (0x9d82)
    const s = this.game.state;
    const location = s.position.location;
    const inn = innAt(location)!;
    const buyerIdx = this.innBuyerIdx();
    const buyer = s.characters[buyerIdx];
    const price = innRestPrice(inn, s.partySize, buyer?.intelligence ?? 0);
    if (s.gold < price) {
      this.deps.message(
        t(SHOP_UI.innBroke) + expandShoppeTemplate(t(SHOP_UI.innBrokeScreams), this.expandCtx()),
      );
      this.leave(); // 0x116 → ret → sesión fuera
      return;
    }
    // Nombres que morirán durmiendo (status 'P'), ANTES de que el motor los mate.
    const dying = s.characters
      .filter((c) => c.partyStatus === 0 && c.status === "P")
      .map((c) => c.name || "friend");
    const r = innRest(s, buyerIdx, location); // motor: cobra + cura + P→D
    this.markPurchase(r.ok);
    this.drainOnPurchase(r.ok); // SHOPPES3 0x0121 (tras `sub [g_gold]` 0x011d)
    this.deps.message(
      t(SHOP_UI.innPleasant) + this.innGenderWord() +
        expandShoppeTemplate(t(SHOP_UI.innPleasantClose), this.expandCtx()),
    );
    // A la cama (0x160-0x172) y la noche pasa (reloj hasta las 6:00, 0x1ca-0x1f4).
    if (r.roomX !== undefined && r.roomY !== undefined) {
      s.position.x = r.roomX;
      s.position.y = r.roomY;
    }
    this.deps.message(t(SHOP_UI.innZzz));
    // La noche corre el RELOJ DEL JUEGO, no aritmética de calendario: `advance_clock`
    // por pasos (12×5 + N×9) con antorcha, re-sorteo de Shadowlords a medianoche y
    // la capa horaria de reja/puente a las 20:00 y las 5:00 (bucle 0x1b5-0x1f4).
    // Antes se llamaba a `advanceMinutes`, que sólo movía el calendario (#122).
    this.game.innSleepUntilMorning();
    this.deps.message(t(SHOP_UI.innMorning));
    // #158: SNAP de los NPC a su horario, en el orden EXACTO del binario — SHOPPES3
    // 0x01fa imprime «Morning!» (DS 0x4e51) y 0x01fd llama acto seguido al stub 0x7a8e
    // → TOWN.OVL:0x1694 `npc_activate_all_town`. Va DESPUÉS del mensaje, no dentro de
    // innSleepUntilMorning, porque ése es el orden del original. Sin RNG.
    this.game.wakeSnapNpcs();
    for (const name of dying) this.deps.message("\n" + name + t(SHOP_UI.innPassedAway));
    s.position.x += 1; // 0x28b: un paso fuera de la cama
    this.deps.refreshGold();
    this.leave(); // ret -1 → [bp-2]=1 → despedida (0x9c8)
  }

  /**
   * (L)eave — SHOPPES3 0x02ae, cadena FIEL (F2-T2, testigo aulddragon P19 ~350):
   * eco 'L' → aforo (helper 0x2c) → party de 1 → shoppe.json[191] («…SLEEP for a
   * month or so? Not in my inn!», ptr 0x26e8 @0x2d5) y sesión fuera → si no,
   * bucle `$ asks,\n"Who will\nstay?" ` (DS 0x4e86 @0x306) + select de roster
   * (0x4cae, mismo picker que el curandero).
   */
  private innLeaveStart(): void {
    this.deps.message("L"); // eco de la tecla (putchar 0x4c)
    if (!this.innRoomAvailable()) { this.innEpilogue(); return; }
    const s = this.game.state;
    if (s.partySize <= 1) {
      const alone = this.deps.shoppeTexts?.[INN_ALONE_INDEX];
      if (alone) this.deps.message(expandShoppeTemplate(t(alone), this.expandCtx()));
      this.leave(); // ret -1 → despedida
      return;
    }
    this.innLeaveAsk();
  }

  private innLeaveAsk(): void {
    this.deps.message(expandShoppeTemplate(t(SHOP_UI.innWhoStay), this.expandCtx()));
    this.deps.pickMember(
      (idx) => this.innLeaveChosen(idx),
      () => {
        this.deps.message(t(SHOP_UI.innNobody)); // DS 0x4ea0 (0x318)
        this.innEpilogue(); // ret -2 → epílogo 0x992
      },
    );
  }

  /**
   * Miembro elegido (SHOPPES3 0x32f-0x3d5): el Avatar no se queda (`Thy friend[s]
   * will not leave thee!` DS 0x4eac/0x4eb7 + re-pregunta 0x486→0x301); un muerto →
   * shoppe.json[192] («…a morgue?…», ptr 0x2723) y sesión fuera; si no, tarifa
   * mensual (rate·10 con haggle @0x378-0x3a9) + `"The rate for\nour most
   * comfortable room will be ` + `% gold per month, due at check-out.` + `\nWilt
   * thou take\nit?" ` (DS 0x4ecf/0x4f00/0x4f24) → Y/N (fase "inn-leave-take").
   */
  private innLeaveChosen(idx: number): void {
    const s = this.game.state;
    if (idx === 0) {
      this.deps.message(t(s.partySize > 2 ? SHOP_UI.innFriendsWont : SHOP_UI.innFriendWont));
      this.innLeaveAsk(); // bucle 0x486 → 0x301
      return;
    }
    const rec = s.characters[idx];
    if (!rec) return;
    if (rec.status === "D") {
      const corpse = this.deps.shoppeTexts?.[INN_CORPSE_INDEX];
      if (corpse) this.deps.message(expandShoppeTemplate(t(corpse), this.expandCtx()));
      this.leave(); // ret -1 → despedida
      return;
    }
    const inn = innAt(s.position.location)!;
    const buyer = s.characters[this.innBuyerIdx()];
    const monthly = innMonthlyRate(inn, buyer?.intelligence ?? 0);
    this.deps.message(
      t(SHOP_UI.innRateOpen) +
        expandShoppeTemplate(t(SHOP_UI.innRateMonthly), {
          ...this.expandCtx(),
          price: String(monthly),
        }) +
        t(SHOP_UI.innWiltTake),
    );
    this.pendingInnLeave = idx;
    this.phase = "inn-leave-take";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Rama 'Y' del `Wilt thou take it?" ` del Leave (SHOPPES3 0x3d8-0x47d): marca
   * partyStatus=location + monthsAtInn=0 + party−1 (motor `innLeave`, calco de
   * 0x40c-0x472) y agradece: `"I thank thee."\nsays $.\n\n` (DS 0x4f3d) →
   * epílogo «Is there anything more…» (ret 1 → 0x992).
   */
  private innLeaveYes(): void {
    this.deps.message(t(SHOP_UI.innYes)); // eco del getkey Y/N
    const idx = this.pendingInnLeave;
    this.pendingInnLeave = null;
    if (idx === null) return;
    const s = this.game.state;
    const r = innLeave(s, idx, s.position.location);
    if (r.ok) {
      this.deps.message(expandShoppeTemplate(t(SHOP_UI.innThank), this.expandCtx()));
    }
    this.innEpilogue();
  }

  /** Subtipo de taberna (bd16 = DS 0x4d4c[townIndex], SHOPPES2 0x676). */
  private tavernSubtype(): number {
    const town = shopTownIndex("Barkeeper", this.game.state.position.location);
    return town < 0 ? 0 : (TAVERN_SUBTYPE[town] ?? 0);
  }

  /**
   * MENÚ de la taberna (F2-T10; SHOPPES2 0x6aa/0x7b8): `Yes\n\n"` (DS 0x9f92 =
   * 0x9fba) + registro por subtipo (inicial 69..72 / re-visita 73..76) + `" `.
   * Teclas por subtipo (TAVERN_KEYS); el chat/rumor sólo tras servir algo
   * ([0xbd18] @0x756). Space/ESC/CR → despedida (0x6e8-0x6f2 → 0x664).
   */
  private tavernMenu(revisit: boolean): void {
    const sub = this.tavernSubtype();
    const idx = (revisit ? TAVERN_MENU_REVISIT_INDEX : TAVERN_MENU_INDEX)[sub] ?? -1;
    const rec = this.deps.shoppeTexts?.[idx];
    this.deps.message(
      t(SHOP_UI.tavernYesOpen) +
        (rec ? expandShoppeTemplate(t(rec), this.expandCtx()) : "") +
        t(SHOP_UI.sellQuoteClose),
    );
    this.phase = "tavern-menu";
    const k = TAVERN_KEYS[sub]!;
    const opts: ShopConsoleOption[] = [
      { key: k.round, label: "Round" },
      { key: k.wine, label: "Wine" },
    ];
    if (k.rations) opts.push({ key: k.rations, label: "Rations" });
    opts.push({ key: k.chat, label: "Chat" });
    this.setOptions(opts);
    this.deps.armKey();
  }

  /** Despacho de tecla del menú fiel (SHOPPES2 0x6f4-0x788; otra tecla RE-LEE). */
  private tavernMenuKey(key: string): void {
    const sub = this.tavernSubtype();
    const k = TAVERN_KEYS[sub]!;
    if (key === k.round) { this.tavernRound(); return; }
    if (key === k.wine) {
      // 0x0200-0x0207: la opción 2 ECOA SU PROPIA LETRA (`putchar [bx+0x4c24]`) antes
      // de todo lo demás — un `putchar` suelto, sin los `\n\n` que sí lleva el de
      // raciones (0x0398-0x03a3). Vale para las DOS ramas de abajo, igual que en el
      // binario, porque está delante del discriminante `'W'` de 0x027c. ⚠ Las opciones
      // 1 (comida, 0x01d8) y 4 (chat, 0x0516) ecoan la suya IGUAL y el clon todavía no
      // lo hace: medido en este carril, fuera del alcance de #325.
      this.deps.message(key.toUpperCase());
      // 0x020a: el GATE DE BORRACHERA va aquí, ANTES del discriminante `'W'` de 0x027c,
      // así que alcanza a las DOS ramas de la bebida. Dispara con el contador
      // EXACTAMENTE en 3 (`cmp word ptr [g_cups_served], 3` / `jne 0x26f`).
      if (this.served === DRUNK_CUP_GATE) { this.drinkDrunkGate(); return; }
      this.drinkAfterGate();
      return;
    }
    if (k.rations && key === k.rations) { this.tavernRationsChain(); return; }
    if (key === k.chat) {
      // 0x756: chat/rumor GATED a [0xbd18]≠0 (ya servido); si no, la tecla se ignora.
      if (this.tavernServed) this.tavernRumor();
      return;
    }
  }

  /**
   * AVISO DE BORRACHERA (#325) — `SHOPPES2 0x0211-0x0260`, la CUARTA emisión de la
   * ficha y la que el clon no emitía en absoluto: aplicaba el karma −1 y el timer de
   * 25 turnos EN SILENCIO, desde dentro de `buyWine`, y no modelaba el Y/N.
   *
   * Aquí se emite entero (cinco piezas, todas del corpus) y se espera tecla:
   *   `\n\n"I beg thy\npardon, ` + trato + `,"\nsays ` + tendero + `.\n"But haven't…" `
   *
   * Vive en el despacho de la BEBIDA y no en `buyWine` porque el binario lo pone en
   * `0x020a`, antes del discriminante `'W'` — con el gate en el pago, retirarse de la
   * carta con Espacio salía gratis, y la ronda de la casa necesitaba su propia copia
   * inline (la tenía: `tavernHouseRound` la duplicaba).
   */
  private drinkDrunkGate(): void {
    this.deps.message(
      t(SHOP_UI.drunkPardon) + //                       DS 0x9b22 (0x0211)
        this.honorific() + //                           call 0x00ac (0x0218)
        t(SHOP_UI.drunkSays) + //                       DS 0x9b38 (0x021b)
        (this.info?.keeperName?.trim() ?? "") + //       [DS 0xAAFE] (0x0222)
        t(SHOP_UI.drunkEnough), //                      DS 0x9b42 (0x0229)
    );
    this.phase = "tavern-drunk-gate";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Y/N del aviso (0x0236-0x026d). El getkey RE-LEE cualquier tecla que no sea Y/N.
   *
   * ★ `Y` devuelve **0** (0x0241 `sub ax,ax`), o sea CUENTA COMO SERVICIO: desbloquea
   * el chat y elige la despedida «con compra» — sin haber servido nada ni cobrado una
   * moneda. Es el hermano exacto del §30.2 del curandero, y la asimetría con el
   * retorno 2 del Espacio en la carta (que NO cuenta): el valor de retorno es el único
   * canal por el que el bucle de menú sabe si hubo transacción.
   */
  private drunkGateKey(key: string): void {
    if (key === "y") {
      this.deps.message(t(SHOP_UI.drunkYes)); // DS 0x9b6c
      this.tavernEpilogue(true); //              ret 0 ⇒ marca [0xbd18]
      return;
    }
    if (key !== "n") return; // 0x026d `jne 0x230` — vuelve a leer
    // 0x024c-0x0260: eco `No!`, timer 25 (`[g_drunk_timer] = 0x19`) y karma −1 con
    // suelo 0 (`byte_sub_saturating`, kernel 0x3F36). Y CONTINÚA a servir.
    this.deps.message(t(SHOP_UI.drunkNo)); //   DS 0x9b72
    this.game.state.drunkTurns = DRUNK_TIMER_TURNS;
    this.game.state.karma = Math.max(0, this.game.state.karma - 1);
    this.drinkAfterGate();
  }

  /**
   * ★ #21 — discriminante `0x027c` `cmp byte ptr [bx + 0x4c24], 0x57` (`'W'`) / `je
   * 0x286`: LA CARTA DE VINOS SÓLO EXISTE EN EL SUBTIPO 'W'. La opción 2 no es
   * «vino», es LA BEBIDA. Con 'W' despliega la carta de seis (0x286-0x2c8); con
   * 'A'/'R'/'S' salta a `0x372`, que hace `g_alive_a = 0` y llama a la cuenta 0x00dc =
   * una RONDA DE LA CASA a 1 pieza por vivo (0x026f `mov ax,1` antes del acumulador),
   * sin lista y sin elegir. El clon enrutaba a la carta SIN mirar el subtipo, y como el
   * 1 aparece UNA sola vez en `TAVERN_SUBTYPE`, ofrecía vinos en 8 de las 9 tabernas.
   * (El propio fichero se contradecía: su docblock cita los menús reales —Ale, Rum,
   * Stout— y a la vez llamaba «vino» a toda la columna.)
   */
  private drinkAfterGate(): void {
    if (this.tavernSubtype() === TAVERN_SUBTYPE_WINE) {
      this.renderWineList();
      this.deps.armKey();
      return;
    }
    this.tavernHouseRound();
  }

  /**
   * Epílogo tras servir (SHOPPES2 0x78b-0x7d8): si el servicio NO devolvió 2
   * ([bp-4], p.ej. el «Hrumph.» de cantidad 0) marca [0xbd18]=1 (desbloquea el
   * chat y elige el pool de despedida) y pregunta `"Anything else\nfor thee?" `
   * (DS 0x9f9a): N → `No` + despedida (0x664); Y → `Yes\n\n"` + menú de
   * RE-VISITA (tabla DS 0x4d5e) + `" ` y vuelta al despacho.
   */
  private tavernEpilogue(servedNow: boolean): void {
    if (servedNow) {
      this.tavernServed = true; // [0xbd18]=1 (0x791)
      this.markPurchase(true);
    }
    this.deps.message(t(SHOP_UI.tavernAnythingElse));
    this.phase = "tavern-again";
    this.setOptions([
      { key: "y", label: "Yes" },
      { key: "n", label: "No" },
    ]);
    this.deps.armKey();
  }

  /**
   * Ronda de comida (0x700 → 0x1d2): sin oro el barkeep te ECHA (ret≠0 → salida
   * 0x7dc SIN despedida); servida → contador de copas + epílogo.
   */
  private tavernRound(): void {
    const s = this.game.state;
    const town = shopTownIndex("Barkeeper", s.position.location);
    if (town < 0) return;
    // Las DOS mesas candidatas (0x0160 norte / 0x0194 sur): el núcleo decide cuál,
    // con el norte PRIMERO. `buyTavernRound` no toca el mapa — devuelve el plato.
    const { x, y } = s.position;
    // Lectura DEFENSIVA del mapa: el plato es presentación opcional y hay arneses
    // (falsedad-drain-scope) que ejercitan la ronda con un `Game` de doble sin mapa.
    // Sin mapa no hay mesa que mirar ⇒ no hay plato; la comida y el oro no dependen
    // de esto. El binario siempre tiene mapa: esto acota al clon, no modela una rama.
    const map = this.game.activeMap as { tileAt(x: number, y: number): number } | undefined;
    const r = buyTavernRound(s, town, {
      north: map?.tileAt(x, y - 1) ?? 0,
      south: map?.tileAt(x, y + 1) ?? 0,
    });
    this.emitTavernPriceLine(r);
    // Servida = DS 0x9b16 `\nEnjoy!"\n\n` (SHOPPES2 0x01c8), no la fija «Enjoy!» que
    // había antes (#147 tanda 2). Sin plantilla de hablante: no lleva `$`.
    this.deps.message(t(r.message));
    this.deps.refreshGold();
    if (!r.ok) {
      this.thrownOut = true; // «CAN'T PAY? Beat it!» → salida sin despedida
      this.leave();
      return;
    }
    if (r.plate) {
      // 0x0185 / 0x01b9 escriben por PUNTERO (get_tile_ptr CS 0x4402) ⇒ terreno
      // VOLÁTIL (#119/#121), y 0x018e repinta (viewport_redraw CS 0x5910).
      this.game.setVolatileTerrain(x, y + r.plate.dy, r.plate.tile);
      // ⚠ El repintado explícito de 0x018e (viewport_redraw CS 0x5910) NO se emite:
      // `ShopConsoleDeps` no tiene canal de refresco de mapa y el viewport está tapado
      // por la consola de tienda mientras dura la sesión — al salir se redibuja solo.
      // Declarado como no-portado, no como equivalente.
    }
    // ★ #192: el `inc [g_cups_served]` de 0x01C4 es el destino del `je` de
    // `g_alive_a == 0` — la rama de PARTY ENTERA MUERTA, no la de comida. Antes esto
    // incrementaba SIEMPRE, y el aviso de vino («haven't ye had enough?») saltaba tras
    // 3 servicios combinados en vez de tras 3 COPAS.
    if (r.countsAsService) this.served += 1;
    this.drainOnPurchase(true); // SHOPPES2 0x0147 (tras `sub [g_gold]` 0x0143)
    this.tavernEpilogue(true);
  }

  /**
   * ANUNCIO DE PRECIO de la taberna (SHOPPES2 0x00dc-0x0111) — va PRIMERO y en las
   * DOS ramas, porque en el binario precede al gate de oro de 0x0114: el tabernero
   * canta el precio y sólo después te echa. Traducido por PIEZA (el compuesto no es
   * key del corpus), igual que el afford-only. Ficha #17: el clon no emitía esta
   * línea en absoluto — el `Enjoy!"` posterior cerraba una comilla sin abrir.
   *
   * Lo emiten los DOS llamadores de la cuenta, que es justo lo que hace el binario:
   * la comida (0x0140) y la ronda de la casa de la bebida (0x0372) entran ambas en
   * `0x00dc`. Antes de #21 esto vivía inline en `tavernRound`, con un solo llamador.
   */
  private emitTavernPriceLine(r: TavernRoundResult): void {
    this.deps.message(
      quoteOpen() + // putchar '"' (0x00dc) — emisión SEPARADA, como en el binario
        t(SHOP_UI.tavernThatWillBe) + // DS 0x9ace (0x00e3)
        String(r.priceLine.cost) + // print_number (0x00ea)
        t(SHOP_UI.tavernGoldForThe) + // DS 0x9adc (0x00f9)
        (r.priceLine.aliveWord ? t(r.priceLine.aliveWord) : "") + // 0x0100 → 0x006a
        t(SHOP_UI.tavernOfYe) + // DS 0x9aec (0x0103)
        t(r.priceLine.sir ? SHOP_UI.tavernSir : SHOP_UI.tavernMilady) + // 0x010a → 0x00ac
        SHOP_UI.tavernPriceClose, // putchar '.' (0x010d) — puntuación, no se traduce
    );
  }

  /**
   * RONDA DE LA CASA — la opción 2 en los subtipos que NO son `'W'` (#21).
   * `SHOPPES2 0x0372`: `mov word ptr [g_alive_a], 0` + `call 0xdc`, y devuelve tal
   * cual lo que devuelva la cuenta (la cola no reasigna `ax`). O sea la MISMA
   * rutina de la comida, en su modo «esto no es una comida»: cobra 1 pieza por
   * miembro vivo con la frase del anuncio de precio, no da comida, no pone plato,
   * y cuenta una copa.
   *
   * El GATE DE BORRACHERA ya pasó cuando se llega aquí: vive en `0x020a`, ANTES del
   * discriminante `'W'` de `0x027c`, así que es `drinkDrunkGate` quien lo aplica para
   * las DOS ramas (#325). Esta función llevaba su propia COPIA inline, porque cuando
   * nació el gate estaba dentro de `buyWine` y esta rama no pasaba por ahí; con el
   * gate en su sitio del binario la copia sobra y se retira.
   */
  private tavernHouseRound(): void {
    const s = this.game.state;
    const town = shopTownIndex("Barkeeper", s.position.location);
    if (town < 0) return;
    // `houseRound = true`: precio 1/cabeza y `g_alive_a = 0`. Sin `adjacent` porque
    // esta rama no llega nunca al colocador de plato (vive tras el `je` contrario).
    const r = buyTavernRound(s, town, undefined, true);
    this.emitTavernPriceLine(r);
    this.deps.message(t(r.message));
    this.deps.refreshGold();
    if (!r.ok) {
      this.thrownOut = true; // «CAN'T PAY? Beat it!» (ret 1) → salida SIN despedida
      this.leave();
      return;
    }
    if (r.countsAsService) this.served += 1; // `inc [g_cups_served]` 0x01c4
    this.drainOnPurchase(true); // merma de Faulinei tras el `sub [g_gold]` (0x0147)
    this.tavernEpilogue(true);
  }

  /**
   * Cadena de RACIONES (F2-T10; SHOPPES2 0x380, testigo aulddragon P04): eco de
   * la tecla + `\n\n` (0x394-0x3a3) + `"` + PITCH 1-de-7 (rand(0,6) del stream
   * VIVO @0x3fb, shoppe.json 77..83, % = precio con haggle 0x3ac-0x3ea) +
   * `\n\nHow many wouldst\nthou like?" ` (DS 0x9c4a) + cantidad (getstring
   * numérico de 2 dígitos, 0x59be).
   */
  private tavernRationsChain(): void {
    const s = this.game.state;
    const town = shopTownIndex("Barkeeper", s.position.location);
    if (town < 0) return;
    const k = TAVERN_KEYS[this.tavernSubtype()]!;
    this.deps.message(k.rations.toUpperCase() + "\n\n"); // putchar tecla + 0xa 0xa
    const price = rationPrice(town, this.intel());
    const pitchIdx = TAVERN_RATIONS_PITCH_INDEX[this.game.shopGreetingRand(0, 6)] ?? -1;
    const pitch = this.deps.shoppeTexts?.[pitchIdx];
    this.deps.message(
      t(SHOP_UI.greetQuoteOpen) +
        (pitch
          ? expandShoppeTemplate(t(pitch), { ...this.expandCtx(), price: String(price) })
          : "") +
        t(SHOP_UI.tavernHowMany),
    );
    this.deps.armText("", 2, (txt) => this.tavernRationsQty(txt, town));
  }

  /**
   * Cantidad tecleada (SHOPPES2 0x418-0x4fe): 0 → `\n\n"Hrumph."` (ret 2, NO
   * desbloquea el chat) + epílogo; compra en bucle unidad a unidad (motor
   * `buyRations`: para en el tope de comida 9999 @0x462). Sin oro a mitad:
   *  - 0 unidades y comida<3 → limosna `rand(0,1)+1` de comida (stream VIVO
   *    @0x493) + «I will give thee some table scraps! Now go!» orders $ (reg. 90)
   *    → ECHADO (ret 1, salida sin despedida);
   *  - 0 unidades y comida>=3 → «Thou hast neither gold nor need! Out!» yells
   *    <tendero> (DS 0x9c7a/0x9ca4/0x9cac) → ECHADO;
   *  - parcial → `"Thou canst\nafford only ` + N + `!"\n\n` (0x9cb0/0x9cca) +
   *    epílogo (servido).
   */
  private tavernRationsQty(txt: string, town: number): void {
    const s = this.game.state;
    const qty = Number.parseInt(txt.trim(), 10) || 0;
    if (qty <= 0) {
      this.deps.message(t(SHOP_UI.tavernHrumph));
      this.tavernEpilogue(false); // ret 2 → [0xbd18] intacto
      return;
    }
    const r = buyRations(s, town, this.intel(), qty);
    this.deps.refreshGold();
    if (r.bought < qty && !r.full) {
      if (r.bought === 0) {
        if (s.food < 3) {
          s.food = Math.min(9999, s.food + this.game.shopGreetingRand(0, 1) + 1); // 0x493
          const scraps = this.deps.shoppeTexts?.[TAVERN_SCRAPS_INDEX];
          if (scraps) this.deps.message(expandShoppeTemplate(t(scraps), this.expandCtx()));
        } else {
          this.deps.message(
            t(SHOP_UI.tavernNoNeed) +
              t(SHOP_UI.tavernYells) +
              (this.info?.keeperName?.trim() ?? "") +
              ".\n",
          );
        }
        this.thrownOut = true; // ret 1 → salida 0x7dc SIN despedida
        this.leave();
        return;
      }
      this.deps.message(t(SHOP_UI.tavernAffordOnly) + String(r.bought) + t(SHOP_UI.tavernAffordClose));
      this.tavernEpilogue(true);
      return;
    }
    // SHOPPES2 0x04fb: la merma va SÓLO en esta rama (0x4f4). La de «afford only»
    // (0x04e9) sale sin mermar — el binario distingue las dos salidas.
    this.drainOnPurchase(true);
    this.tavernEpilogue(true); // todo comprado (o tope de comida) — 0x4f4
  }

  /**
   * RUMOR DE TABERNA (#320) — SHOPPES2 0x0508, cuerpo entero leído; derivación y
   * transcripción de las seis tablas en re/notes/rumor-taberna-320.md.
   *
   * El clon cobraba al acertar la clave y contestaba la cadena LITERAL
   * «Rumor has it...», que no existe en el binario. La secuencia real es:
   * pregunta (`Of what wouldst thou hear my lore, sir?`) → getstring de 15 →
   * clave casada → ANUNCIO DEL PRECIO (registro 84 con `%`) + «Fair 'nuff?» →
   * Y/N. Sólo la `Y` con oro cobra, y entonces publica el chisme: formulación
   * `1-de-4` (`rand_range(3,0)` sobre `DS 0x4D44`) con `&` = sujeto
   * (`DS 0x4CA8`) y `*` = lugar (`DS 0x4CF6` vía el mapa de `DS 0x4CDC`).
   *
   * 🔴 MUEVE EL STREAM: la tirada de la formulación no existía en el clon. Es
   * del stream VIVO (`shopGreetingRand`, mismo ruling FIEL-TOTAL que el saludo y
   * el pitch de raciones), y se consume UNA vez por rumor PAGADO — nunca en las
   * ramas `N`, sin-oro ni clave-fallada. Ventana declarada en el merge.
   */
  private tavernRumor(): void {
    const ask = t(SHOP_UI.rumorAskOpen) + t(SHOP_UI.rumorAsk) + this.innGenderWord()
      + t(SHOP_UI.rumorRespond);
    this.deps.message(ask);
    // Clave por getstring de consola (`input_string` DS 0xBCF8, 15 caracteres @0x0543).
    this.deps.armText("Ask about-", RUMOR_INPUT_MAX, (typed) => {
      this.deps.message(t(SHOP_UI.rumorAfterInput));
      const idx = rumorKeywordIndex(typed);
      // Buffer VACÍO → devuelve 0 sin preguntar más: la única vía de escape, y
      // CUENTA como servicio (0x054d-0x0559).
      if (!typed.trim()) { this.tavernEpilogue(true); return; }
      // Sin coincidencia el binario NO sale por tecla: re-imprime y vuelve al
      // prompt (0x0591 → jmp 0x52a). Aquí eso es re-armar el mismo getstring.
      if (idx < 0) { this.deps.message(t(SHOP_UI.rumorUnknown)); this.tavernRumor(); return; }
      const pitch = this.deps.shoppeTexts?.[RUMOR_PRICE_PITCH_INDEX];
      const price = RUMOR_PRICES[idx]!;
      this.deps.message(
        (pitch ? expandShoppeTemplate(t(pitch), { ...this.expandCtx(), price: String(price) }) : "")
          + t(SHOP_UI.rumorFairNuff),
      );
      this.pendingRumor = idx;
      this.phase = "rumor-deal";
      this.setOptions([
        { key: "y", label: "Yes" },
        { key: "n", label: "No" },
      ]);
      this.deps.armKey();
    });
  }

  /**
   * Rama `Y` del «Fair 'nuff?» (0x05e6-0x0659). Sin oro: «"Sorry, » + sir/milady +
   * registro 91, y devuelve 1 (0x05f6-0x060a). Pagando: descuenta, publica el
   * chisme con la formulación sorteada, y cierra con `\nsays ` + tendero + `.\n\n`.
   * Las DOS ramas caen en el epílogo — el `0` y el `1` cuentan igual como servicio.
   */
  private rumorDealYes(): void {
    this.deps.message(t(SHOP_UI.rumorYes));
    const idx = this.pendingRumor;
    this.pendingRumor = null;
    if (idx === null) { this.tavernEpilogue(true); return; }
    const r = payRumor(this.game.state, idx);
    if (!r.ok) {
      const broke = this.deps.shoppeTexts?.[RUMOR_BROKE_INDEX];
      this.deps.message(
        t(SHOP_UI.rumorSorry) + this.innGenderWord()
          + (broke ? expandShoppeTemplate(t(broke), this.expandCtx()) : ""),
      );
      this.tavernEpilogue(true);
      return;
    }
    this.markPurchase(true);
    this.deps.refreshGold();
    const form = this.deps.shoppeTexts?.[RUMOR_FORM_INDEX[this.game.shopGreetingRand(0, 3)]!];
    const ctx = { ...this.expandCtx(), item: r.subject!, place: r.place! };
    this.deps.message(
      (form ? expandShoppeTemplate(t(form), ctx) : "")
        + t(SHOP_UI.rumorSays) + ctx.keeper + t(SHOP_UI.rumorSaysClose),
    );
    // F2-T10: el chat vuelve por el epílogo (SHOPPES2 0x767 — tecla del menú).
    this.tavernEpilogue(true);
  }

  private buyHorse(): void {
    const s = this.game.state;
    const town = shopTownIndex("HorseSeller", s.position.location);
    if (town < 0) { this.deps.message("No horses for sale here."); this.leave(); return; }
    const goldBefore = s.gold;
    for (const ev of this.game.stableHorse(town, this.intel())) {
      // El mensaje de «sin oro» del core es ahora la cadena DERIVADA con `$` (#147
      // tanda 2, DS 0x7a7e + DS 0x7a9e): se expande como en el resto de la consola.
      if (ev.kind === "message" && ev.text)
        this.deps.message(expandShoppeTemplate(t(ev.text), this.expandCtx()));
    }
    this.markPurchase(s.gold < goldBefore); // pago con éxito = oro descontado
    this.deps.refreshGold();
    this.leave(); // la montura queda en el mundo; cierra para verla
  }

  private leave(): void {
    this.emitFarewell();
    this.deps.close();
  }

  /**
   * DESPEDIDA fiel al salir — emisor SHOPPES 0x0202 (derivación en shoppe-greetings.ts):
   * `\n\n"` (DS 0x7854/0x7858) + registro `shoppe.json[tabla][rand(0,3)]` (tabla 0x3b6a
   * sin compra / 0x3baa con compra, expandido $/#/@ por 0x017a→0x005b) + atribución
   * `says $.` (DS 0x785c, misma string que healerSays). El rand es del stream VIVO
   * (`shopGreetingRand`, mismo ruling FIEL-TOTAL que el saludo). HERRERO tras VENDER:
   * arg=-1 (si=0xffff, 0x135d) → 0x0202 no imprime nada (su adiós es la charla del
   * sell-flow 0x3d36, ~~Clase C sin portar~~ **RETIRADO #327**: los cuatro pools de esa
   * charla (BLACKSMITH_SELL_{PROMPTS,MORE,BYES,OFFER_INDEX}) están definidos en
   * shoppe-greetings.ts y se EMITEN en este mismo fichero, ~1900 líneas más arriba.
   * El arg=-1 → 0x0202 silencioso de la primera mitad SÍ es correcto).
   *
   * Degradación sin pool/nombres (edge solo-port, patrón legacyHeader): la fija
   * "Come again!" de siempre, SIN consumir rand.
   *
   * ★ #19 REFUTADA COMO DIVERGENCIA — el `purchased ? 1 : 0` de abajo NO se
   * excepciona para el curandero, y la razón está MEDIDA, no supuesta.
   *
   * Lo que el binario hace es cierto: `healer_shop_entry` (SHOPPES.OVL 0x14f8, 568 B)
   * tiene UN SOLO `ret` —el de 0x1729, censadas todas las salidas de [0x14f8,0x1730)—
   * y se llega a él sólo por la convergencia `0x171e: mov ax,1 / push ax / call 0x202`.
   * El 1 es un inmediato del CÓDIGO: de los cinco call-sites de 0x0202 en SHOPPES.OVL
   * (0x04f7, 0x07b3, 0x09a0, 0x1370, 0x1722) los otros cuatro empujan `di`/`si`/
   * `[bp-0x10]` y sólo éste empuja una constante. Decir `N` en la puerta
   * (0x153f `jmp 0x171e`) pide igualmente el pool «con compra».
   *
   * 🔴 PERO ES INOBSERVABLE, y por eso aquí no se calca: las dos tablas de despedida
   * del CURANDERO son LA MISMA. Leídos los punteros en DATA.OVL (fileoff 0x3b7a
   * tabla A / 0x3bba tabla B, fila `shoppe_id2 = 6` ⇒ +0x30), las cuatro palabras
   * salen `0x231e · 0x233c · 0x235e · 0x2381` en AMBAS — el único tipo de los ocho
   * con la fila repetida (los otros siete difieren en las cuatro). ⇒ pool 0 y pool 1
   * imprimen los MISMOS cuatro registros, y la rama que eligiéramos no cambia ni un
   * byte de salida. Un `if (type === "Healer") arg = 1` sería código sin testigo
   * posible: cualquier aserto que lo cubriera pasaría también con el `if` borrado.
   * La afirmación del acta (asm-shoppes §30.2) de que «los dos pools son textos
   * distintos» es la parte que cae; el resto de su lectura del ASM aguanta.
   *
   * PARIDAD DE STREAM (comprobada por si algún día dejan de ser la misma fila): el
   * arg no cambia CUÁNTAS veces se tira — 0x0202 hace un `rand_range` en la rama 0
   * (0x021a) y otro en la rama 1 (0x0244), uno en cada una. Cambiaría la TABLA, nunca
   * el consumo.
   */
  private emitFarewell(): void {
    const arg: -1 | 0 | 1 =
      this.type === "Blacksmith"
        ? this.blacksmithFlow === "sell" || this.buyThrownOut
          ? -1 // venta (0x135d) o echado sin oro (0xb30 devuelve -1, 0x0aa4) → silencio
          : this.blacksmithFlow === "buy" && this.boughtInBuy
            ? 1
            : 0
        : this.thrownOut
          ? -1 // echado (ret -1 de reactivos 0x617 / gremio 0x36e / establo 0x942) → silencio
          : this.purchased
            ? 1
            : 0;
    if (arg === -1) return; // 0x0202 con arg fuera de {0,1}: silencio
    const keeper = this.info?.keeperName?.trim();
    const shop = this.info?.shopName?.trim();
    const pool = this.deps.shoppeTexts;
    const indices = (arg === 1 ? SHOPPE_FAREWELL_PURCHASE : SHOPPE_FAREWELL_NO_PURCHASE)[this.type];
    if (!keeper || !shop || !pool || !indices) {
      this.deps.message(SHOP_UI.farewell);
      return;
    }
    const template = pool[indices[this.game.shopGreetingRand(0, 3)]!];
    if (!template) {
      this.deps.message(SHOP_UI.farewell);
      return;
    }
    const day = t(partOfDayWord(this.game.state.time.hour));
    // t() también en la comilla de APERTURA (DS 0x7854/0x7858): en ES abre «, cierra » el template.
    this.deps.message(t(SHOP_UI.farewellQuoteOpen) + expandShoppeTemplate(t(template), { keeper, shop, day }));
    this.deps.message(tf(SHOP_UI.healerSays, keeper)); // `says $.` DS 0x785c (0x0202:0x0274)
  }
}
