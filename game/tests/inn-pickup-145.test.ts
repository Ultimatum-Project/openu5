/**
 * #145 · POSADA — (P)ick up: la familia MULTI-MENSAJE (SHOPPES3.OVL 0x04e6).
 *
 * La ficha decía «familia de cadenas de posada/tienda multi-mensaje sin portar». Medido
 * sobre el overlay entero (37 emisiones con cadena en SHOPPES3), las que no tenían NI UNA
 * cita en `game/src` eran **ocho, y las ocho de este único sub-flujo**: el Pick up.
 *
 * ```
 * 04f4  cmp [g_party_size],6 / jne          → DS 0x4f57 `\n\nOne must first be left behind!\n\n`
 * 0506  cmp [bp-2],0 / jne                  → DS 0x4f7a `\n\n"No one here is from thy party!"
 *                                              \nsays $.\n\n`  (impresor CON expansor, 0x9d8e)
 * 0516  cmp [bp-2],1 / jg 0x51f             → ★ con UN huésped SALTA a 0x70c: ni prompt ni registro
 * 051f  DS 0x4fa7 `\n\n"Who will\ncheck out?" ` + registro enmarcado + picker
 * 06c8  ESC en el registro                  → DS 0x4fd8 `No one\n\n`
 * 0789  DS 0x4fe1 `\n\n"That will be % gold, please."\n\n"`   ← ANTES de mirar el oro
 * 0793  cmp [g_gold],ax / jge               → sin oro: `print_shoppe(0x275a)` = shoppe.json[193]
 *                                              y [bp+4]=0xFFFF ⇒ despedida SIN epílogo
 * 085f/0888  DS 0x5005 (envenenado) | DS 0x5028 (sano)   ← cierran la comilla de 0x4fe1
 * 088f  DS 0x5055 `says $.\n\n`                          ← y la atribución va APARTE
 * ```
 *
 * ★ EL PATRÓN QUE DA NOMBRE A LA FAMILIA: la comilla de apertura la pone un mensaje y la
 * de cierre otro. `\n\n"That will be % gold, please."\n\n"` **termina** en `\n\n"`, y esa
 * comilla la cierra el fragmento siguiente. Trocear así es del binario, no del port: son
 * `push`/`call` distintos, y de hecho por impresores distintos (0x3670 llano vs 0x9d8e con
 * expansor `$`/`%`), que es el discriminador derivado en `generos-b-194-t2-acta.md` §9.1.
 *
 * ⚠ Lo que estos tests NO cubren: el REGISTRO DE HUÉSPEDES enmarcado (0x052a-0x06c7, dibujo
 * carácter a carácter con la cabecera DS 0x4fc0 `    GUEST` + DS 0x4fca `  REGISTER:\n\n`).
 * La consola usa su lista de opciones — divergencia de PRESENTACIÓN, no de cadena.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { GameState } from "../src/core/state.js";
import { innPickup, type ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
/** El registro REAL de «sin fondos» del Pick up (SHOPPE.DAT fileoff 0x275a). */
POOL[193] = "Unfortunately, thou dost not possess the necessary funds!\nGUARDS!\"\nsays $.\n";

interface Char {
  name: string;
  status: string;
  partyStatus: number;
  intelligence: number;
  gender?: number;
  class?: string;
  currentHp?: number;
  maxHp?: number;
  currentMp?: number;
  monthsAtInn?: number;
}

const BRITAIN = 2; // posada townIndex 0, rate 2

function makeHarness(chars: Char[], gold = 1000) {
  const lines: string[] = [];
  let closed = false;
  const state = {
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
    position: { location: BRITAIN, floor: 0, x: 3, y: 3 },
    characters: chars,
    partySize: chars.filter((c) => c.partyStatus === 0).length,
    equipmentQuantities: new Array(48).fill(0),
    gold,
    torchTurns: 0,
    reagentPatchFoundDay: [0, 0, 0],
    skullTreeFoundDay: 0,
  };
  const game = {
    state,
    shopGreetingRand: () => 0,
    shopPostPurchaseDrain: () => {},
    wakeSnapNpcs: () => {},
    innSleepUntilMorning: () => {},
  } as unknown as Game;
  const deps: ShopConsoleDeps = {
    game,
    shopData: { equipmentBasePrices: [], weaponsSoldByMerchants: [] } as unknown as ShopData,
    info: { keeperName: "Ransack", shopName: "Inn" } as ShoppeKeeperInfo,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: () => {},
    close: () => {
      closed = true;
    },
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  const console_ = new ShopConsole("InnKeeper", deps);
  console_.start();
  console_.key("y"); // gate 'Y' → menú R/L/P
  lines.length = 0;
  return { console: console_, lines, state, closed: () => closed };
}

const ch = (name: string, over: Partial<Char> = {}): Char => ({
  name,
  status: "G",
  partyStatus: 0,
  intelligence: 15,
  gender: 0x0b,
  class: "A",
  currentHp: 10,
  maxHp: 30,
  currentMp: 0,
  ...over,
});
/** Hospedado en Britain: `partyStatus === location`. */
const guest = (name: string, over: Partial<Char> = {}): Char =>
  ch(name, { partyStatus: BRITAIN, monthsAtInn: 1, ...over });

const EPILOGO = '"Is there\nanything more\nI can do for\nthee?" '; // DS 0x50bd

describe("#145 · las TRES puertas previas al registro (0x04f4 / 0x0506 / 0x0516)", () => {
  it("party de 6 → DS 0x4f57 VERBATIM, con sus `\\n\\n` de apertura y cierre", () => {
    const party = Array.from({ length: 6 }, (_, i) => ch(`P${i}`));
    const h = makeHarness([...party, guest("Shamino")]);
    h.console.key("p");
    expect(h.lines).toContain("\n\nOne must first be left behind!\n\n");
    expect(h.lines.join("|"), "0x0502 vuelve al bucle de menú ⇒ epílogo").toContain(EPILOGO);
  });

  it("sin huéspedes → DS 0x4f7a CON su atribución expandida (impresor 0x9d8e)", () => {
    const h = makeHarness([ch("Avatar")]);
    h.console.key("p");
    expect(h.lines).toContain('\n\n"No one here is from thy party!"\nsays Ransack.\n\n');
  });

  it("★ UN solo huésped: NI prompt NI registro — 0x0516 `jg` no se toma y cae a 0x70c", () => {
    const h = makeHarness([ch("Avatar"), guest("Shamino")]);
    h.console.key("p");
    const all = h.lines.join("|");
    expect(all, "el prompt del registro NO se emite").not.toContain("check out?");
    expect(all, "y se cobra directamente").toContain("gold, please.");
  });

  it("CONTROL DISCRIMINANTE: con DOS huéspedes sí sale el prompt DS 0x4fa7", () => {
    // Sin este caso, «no sale el prompt» sería verde con una consola que no lo tuviera.
    const h = makeHarness([ch("Avatar"), guest("Shamino"), guest("Iolo")]);
    h.console.key("p");
    const all = h.lines.join("|");
    expect(all).toContain('\n\n"Who will\ncheck out?" ');
    expect(all, "y NO cobra todavía").not.toContain("gold, please.");
    expect(h.console.snapshot().phase).toBe("inn-pickup");
  });
});

describe("#145 · la TERNA del cobro (0x0789 → 0x085f|0x0888 → 0x088f)", () => {
  it("huésped SANO: precio + `stay enjoyable,\"` + `says $.`, en ese orden y sin fabricación", () => {
    const h = makeHarness([ch("Avatar"), guest("Shamino")]);
    h.console.key("p");
    const i = h.lines.findIndex((l) => l.includes("gold, please."));
    expect(i, "el mensaje del precio existe").toBeGreaterThanOrEqual(0);
    // Britain rate 2 → mensual 2·10 = 20, haggle INT 15 (+55%) = 31, × 1 mes.
    expect(h.lines[i]).toBe('\n\n"That will be 31 gold, please."\n\n"');
    expect(h.lines[i + 1]).toBe('I hope thou hast found thy stay enjoyable,"\n');
    expect(h.lines[i + 2]).toBe("says Ransack.\n\n");
    expect(h.lines.join("|"), "el fabricado `Welcome back!` ya no existe").not.toContain(
      "Welcome back",
    );
    expect(h.state.gold).toBe(1000 - 31);
    expect(h.state.partySize).toBe(2);
  });

  it("huésped ENVENENADO: el fragmento del medio es el hermano DS 0x5005", () => {
    const h = makeHarness([ch("Avatar"), guest("Shamino", { status: "P" })]);
    h.console.key("p");
    const i = h.lines.findIndex((l) => l.includes("gold, please."));
    expect(h.lines[i + 1]).toBe('Thy friend has died, by the way."\n');
    expect(h.lines[i + 2], "la atribución es la MISMA en las dos ramas (convergen en 0x088b)").toBe(
      "says Ransack.\n\n",
    );
    expect(h.state.characters[1]!.status).toBe("D");
  });

  it("★ sin oro: el PRECIO se imprime igual (0x0789 precede a 0x0793) y la sesión CIERRA", () => {
    const h = makeHarness([ch("Avatar"), guest("Shamino")], 5);
    h.console.key("p");
    const all = h.lines.join("|");
    expect(all, "el precio va ANTES del chequeo de oro").toContain(
      '\n\n"That will be 31 gold, please."\n\n"',
    );
    expect(all, "shoppe.json[193], que cierra la comilla y trae su propio says").toContain(
      "Unfortunately, thou dost not possess the necessary funds!\nGUARDS!\"\nsays Ransack.\n",
    );
    expect(all, "[bp+4]=0xFFFF ⇒ 0x9c8 despedida, sin «anything more»").not.toContain(EPILOGO);
    expect(h.closed(), "la sesión se cierra").toBe(true);
    expect(h.state.gold, "y no cobra").toBe(5);
  });

  it("★ el NÚCLEO puro devuelve el fragmento fiel, no el fabricado", () => {
    // POR QUÉ ESTE CASO EXISTE, y qué lección lo trajo: al mutar `innPickup` para que
    // volviera a devolver `"Welcome back!"`, los SIETE tests de arriba siguieron verdes.
    // La consola emite el fragmento desde `SHOP_UI` (patrón de la casa: el core devuelve
    // el texto, el catálogo lo traduce — igual que `innRest`/`innMorning`), así que el
    // `message` del núcleo no lo lee nadie por ahí y el mutante moría de pie. El sello
    // tiene que ir DONDE VIVE EL VALOR. Familia `campo-que-nadie-lee-no-es-instrumento`.
    const roster = [ch("Avatar"), guest("Shamino")] as unknown as GameState["characters"];
    const st = { characters: roster, partySize: 1, gold: 1000, position: { location: BRITAIN } };
    const sano = innPickup(st as unknown as GameState, 0, 1, BRITAIN);
    expect(sano.message, "DS 0x5028 (0x0888)").toBe('I hope thou hast found thy stay enjoyable,"\n');
    expect(sano.died).toBe(false);

    const roster2 = [ch("Avatar"), guest("Iolo", { status: "P" })] as unknown as GameState["characters"];
    const st2 = { characters: roster2, partySize: 1, gold: 1000, position: { location: BRITAIN } };
    const muerto = innPickup(st2 as unknown as GameState, 0, 1, BRITAIN);
    expect(muerto.message, "DS 0x5005 (0x085f)").toBe('Thy friend has died, by the way."\n');
    expect(muerto.died).toBe(true);
  });

  it("ESC en el registro → DS 0x4fd8 `No one\\n\\n`, sin cobrar", () => {
    const h = makeHarness([ch("Avatar"), guest("Shamino"), guest("Iolo")]);
    h.console.key("p");
    h.console.key("");
    expect(h.lines).toContain("No one\n\n");
    expect(h.lines.join("|"), "y NO es el `Nobody\\n\\n` del Leave").not.toContain("Nobody\n\n");
    expect(h.state.gold).toBe(1000);
  });
});
