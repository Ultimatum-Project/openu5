/**
 * Carril shop-saludo — el SELECTOR DE VARIANTE del saludo de tienda (ficha F4-g de
 * `re/notes/anclas-f4-acta.md`; adjudicación en `re/notes/shop-saludo-acta.md`).
 *
 * `shoppe-greetings.test.ts` fija la FORMA de la tabla (7 tipos × 4) pero NADA fija
 * QUÉ elige la variante. Sin eso, «arreglar» F4-g clavando una variante (para que el
 * port emita la misma que grabó el LP en tal bloque) deja todos los tests en verde.
 * Este fichero cierra ese hueco contra el binario.
 *
 * ASM — emisor SHOPPES.OVL **0x01b6** (`re/disasm/SHOPPES.OVL.asm:201-216`):
 *   01b7  mov ax,0x22 / push / call 0x742a   ; putchar '"'
 *   01be  sub ax,ax / push                   ; lo = 0
 *   01c1  mov ax,3 / push / call 0x7e02      ; hi = 3 → rand_range(0,3), stream VIVO
 *   01c8  mov si,ax / shl si,1               ; variante ×2 (word)
 *   01cc  mov bx,[0xb116] / mov cl,3 / shl bx,cl  ; TIPO de tienda ×8 (4 words/fila)
 *   01d4  push [bx+si+0x3b2a]                ; tabla 2D [tipo][variante]
 *   01d8  call 0x17a                         ; carga el registro y lo imprime
 *
 * El ÚNICO dato que entra en la variante es el rand. `[0xb116]` (TALK.OVL:0x0122-0x0125,
 * `mov ax,[bp+4] / sub ax,0x81 / mov [0xb116],ax`) elige la FILA, no la columna: no hay
 * hora, ni ciudad, ni contador de visitas, ni identidad del tendero en el camino.
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShopType, ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { SHOPPE_GREETING_INDEX } from "../src/core/shops/shoppe-greetings.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

/** Pool sintético: el registro i se reconoce por su texto `T<i>"` (las plantillas
 *  reales son asset de EA, gitignored). */
const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);

interface Harness {
  console: ShopConsole;
  lines: string[];
  rands: number[];
  randCalls: Array<[number, number]>;
}

function makeHarness(type: ShopType, hour = 9): Harness {
  const lines: string[] = [];
  const rands: number[] = [];
  const randCalls: Array<[number, number]> = [];
  const state = {
    time: { hour, minute: 0 },
    position: { location: 2, floor: 0, x: 0, y: 0 },
    characters: [{ intelligence: 15, name: "Avatar", status: "G", partyStatus: 0 }],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: 100,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number, hi: number): number => {
      randCalls.push([lo, hi]);
      return rands.length ? rands.shift()! : lo;
    },
    shopPostPurchaseDrain: () => {},
    // El ESTABLO escanea el hueco ANTES de saludar (SHOPPES 0x07cb, antes del
    // 0x08be): sin hueco no hay saludo NI rand. Aquí siempre hay sitio.
    stableSpotFree: () => true,
  } as unknown as Game;
  const deps: ShopConsoleDeps = {
    game,
    shopData: {
      equipmentBasePrices: [],
      weaponsSoldByMerchants: [],
      healPrices: [10, 10, 10, 10, 10, 10, 10],
      curePrices: [10, 10, 10, 10, 10, 10, 10],
      resurrectPrices: [50, 50, 50, 50, 50, 50, 50],
    } as unknown as ShopData,
    info: { keeperName: "Keeper", shopName: "Shoppe" } as ShoppeKeeperInfo,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: () => {},
    close: () => {},
    sfx: () => {},
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  return { console: new ShopConsole(type, deps), lines, rands, randCalls };
}

/** Tipos que saludan por 0x01b6 (los 7 de la tabla; el Blacksmith va por 0x12b2). */
const TIPOS = Object.keys(SHOPPE_GREETING_INDEX) as ShopType[];

describe("selector de variante del saludo (SHOPPES 0x01b6) — F4-g", () => {
  it("la variante es EL RAND: cada r∈{0,1,2,3} emite el registro [tipo][r] de la tabla", () => {
    for (const type of TIPOS) {
      const fila = SHOPPE_GREETING_INDEX[type]!;
      for (let r = 0; r < 4; r++) {
        const h = makeHarness(type);
        h.rands.push(r);
        h.console.start();
        expect(h.lines.join("\n"), `${type} r=${r}`).toContain(`T${fila[r]}"`);
      }
    }
  });

  it("las CUATRO variantes de cada tipo son alcanzables y DISTINTAS entre sí", () => {
    for (const type of TIPOS) {
      const emitidos = new Set<string>();
      for (let r = 0; r < 4; r++) {
        const h = makeHarness(type);
        h.rands.push(r);
        h.console.start();
        emitidos.add(h.lines.join("\n"));
      }
      // Si alguien clavara la variante (p.ej. `[0]` fijo para «casar con el LP»),
      // este set colapsaría a 1 y el test se pondría rojo nombrando el tipo.
      expect(emitidos.size, `${type} debe emitir 4 saludos distintos`).toBe(4);
    }
  });

  it("consume UNA sola tirada, y es rand(0,3) — no rand(1,4) ni dos tiradas", () => {
    const h = makeHarness("Healer");
    h.console.start();
    expect(h.randCalls).toEqual([[0, 3]]);
  });

  it("la HORA no entra en el selector: mismo r → mismo registro a las 9 y a las 20", () => {
    const fila = SHOPPE_GREETING_INDEX.Healer!;
    for (let r = 0; r < 4; r++) {
      const manana = makeHarness("Healer", 9);
      const noche = makeHarness("Healer", 20);
      manana.rands.push(r);
      noche.rands.push(r);
      manana.console.start();
      noche.console.start();
      expect(manana.lines.join("\n")).toContain(`T${fila[r]}"`);
      expect(noche.lines.join("\n")).toContain(`T${fila[r]}"`);
    }
  });

  it("el TIPO elige la FILA (bx=[0xb116]<<3), no la columna: mismo r → registros distintos", () => {
    const porTipo = TIPOS.map((type) => {
      const h = makeHarness(type);
      h.rands.push(2);
      h.console.start();
      return h.lines.join("\n");
    });
    expect(new Set(porTipo).size).toBe(TIPOS.length);
  });

  it("POR VISITA, no por tendero: el MISMO tendero saluda distinto en dos visitas", () => {
    // Es el mecanismo que produce el testigo del propio corpus del espejo —
    // Regina (curandera de Minoc) saluda 7 veces con las variantes 0 y 3, dos de
    // ellas DENTRO DE LA MISMA PARTE (ad04 ln1198=var0 / ln3488=var3). Ver
    // `re/tools/censo_saludos_tienda.py`.
    const fila = SHOPPE_GREETING_INDEX.Healer!;
    const visita1 = makeHarness("Healer");
    visita1.rands.push(0);
    visita1.console.start();
    const visita2 = makeHarness("Healer");
    visita2.rands.push(3);
    visita2.console.start();
    expect(visita1.lines.join("\n")).toContain(`T${fila[0]}"`);
    expect(visita2.lines.join("\n")).toContain(`T${fila[3]}"`);
    expect(visita1.lines.join("\n")).not.toBe(visita2.lines.join("\n"));
  });
});
