/**
 * #325 — LA CARTA DE VINOS: el emisor que faltaba (SHOPPES2.OVL 0x0286-0x036f).
 *
 * Las CUATRO cadenas de la carta llevaban meses extraídas y traducidas en el corpus
 * i18n y no las emitía NADIE: `renderWineList` imprimía seis rótulos compuestos
 * (`A) Rose — 18 gp`) sin cabecera, sin prompt y sin eco, y `pickWine` sólo el
 * `\nEnjoy!"` del final. El jugador jamás veía la carta del original.
 *
 * Derivación (cuerpo leído entero, direcciones del disasm; DATA.OVL fileoff = DS + 0x10):
 *
 *   0x0200  putchar([g_shop2_type + DS 0x4c24])   eco de la letra de la opción 2
 *   0x020a  gate de borrachera (`cmp [g_cups_served],3`) — ANTES del discriminante
 *   0x027c  `cmp byte ptr [bx+0x4c24], 0x57` ('W')  → sólo el subtipo 1 tiene carta (#21)
 *   0x0286  DS 0x9b76  '"Our wine list,\n'
 *   0x028d  call 0x00ac                            sir / milady (ranura 0, `== 0x0b`)
 *   0x0290  DS 0x9b88  '.\n\n'
 *   0x0294..0x02be  las SEIS líneas verbatim (DS 0x9b8c/9b9e/9bb0/9bc2/9bd4/9be6)
 *   0x02c1  DS 0x9bfa  'Thy choice?" '
 *   0x02c8  getkey ─┬─ ESPACIO      → 0x02d2 dos `\n` + registro 89 + **ret 2**
 *                   ├─ fuera A..F   → 0x02c8 RE-LEE en silencio (sin re-imprimir)
 *                   └─ A..F         → 0x0302 eco letra + DS 0x9c08 + trato + '.'
 *   0x032a  `cmp [bx*2 + DS 0x4c48], ax` / `jle`   precio ≤ oro → compra
 *   0x0330  DS 0x9c20 + nombre + '.' + '\n' → **ret 1** = ECHADO sin despedida
 *   0x035d  `sub [g_gold]` · merma 0x9dfa · `inc [g_cups_served]` · DS 0x9c40 · dos `\n`
 *
 * RNG: CERO tiradas en todo el tramo. Los únicos `call` son el impresor de cadenas
 * (0x3670), `putchar` (0x34da), el getkey (0x448c), el trato por género (0x00ac), el
 * impresor de registros (0xffff9dd6) y la merma de la Falsedad (0xffff9dfa) — esta
 * última SÍ tira `rand(1,64)` con Faulinei en el pueblo, pero ya estaba cableada
 * (`drainOnPurchase`) y no la mueve este cambio. ⇒ SIN ventana de sellos.
 *
 * Los esperados van EN CRUDO: son los bytes de DATA.OVL, no se construyen desde las
 * constantes del port (`t()` es identidad estricta en 'en', así que el literal inglés
 * del corpus es lo que sale por el canal).
 */
import { describe, expect, it } from "vitest";
import type { Game } from "../src/core/game.js";
import type { ShoppeKeeperInfo } from "../src/core/shops/shops.js";
import { ShopConsole, type ShopConsoleDeps } from "../src/ui/shop-console.js";
import type { ShopData } from "../src/ui/shop.js";

const POOL: string[] = Array.from({ length: 200 }, (_, i) => `T${i}"`);
POOL[70] = "Cheese or Wines?"; // menú del subtipo 1 (DS 0x4d56[1] → shoppe.json 70)
POOL[89] = '\n\n"Well! Our meagre stock must not be good enough for thee!"\n';

/** Taberna de subtipo 1 = ciudad 19 (la ÚNICA con carta, TAVERN_SUBTYPE[5] === 1). */
function makeHarness(over: { gold?: number; karma?: number; gender?: number } = {}) {
  const lines: string[] = [];
  const texts: string[] = []; // getstrings abiertos (el del rumor: discrimina [0xbd18])
  let closed = false;
  const state = {
    time: { year: 139, month: 4, day: 7, hour: 9, minute: 0 },
    position: { location: 19, floor: 0, x: 3, y: 3 },
    characters: [
      { name: "P0", status: "G", partyStatus: 0, intelligence: 15, gender: over.gender ?? 0x0b },
    ],
    partySize: 1,
    equipmentQuantities: new Array(48).fill(0),
    gold: over.gold ?? 500,
    food: 100,
    karma: over.karma ?? 50,
    drunkTurns: undefined as number | undefined,
  };
  const game = {
    state,
    shopGreetingRand: (lo: number) => lo,
    shopPostPurchaseDrain: () => {},
  } as unknown as Game;
  const deps: ShopConsoleDeps = {
    game,
    shopData: { equipmentBasePrices: [], weaponsSoldByMerchants: [] } as unknown as ShopData,
    info: { keeperName: "Tika", shopName: "Wayfarer" } as ShoppeKeeperInfo,
    shoppeTexts: POOL,
    message: (t) => lines.push(t),
    refreshGold: () => {},
    armKey: () => {},
    armText: (prefix) => {
      texts.push(prefix);
    },
    close: () => {
      closed = true;
    },
    openArmsPicker: () => {},
    pickMember: () => {},
  };
  const console_ = new ShopConsole("Barkeeper", deps);
  console_.start();
  console_.key("y"); // gate del saludo → menú fiel
  lines.length = 0;
  return { console: console_, lines, texts, state, closed: () => closed };
}

describe("#325 — la carta que el original despliega (SHOPPES2 0x0286-0x02c8)", () => {
  it("la tecla de bebida ECOA su letra y despliega cabecera + trato + seis líneas + prompt", () => {
    const h = makeHarness();
    h.console.key("w");
    const all = h.lines.join("");
    // 0x0200: `putchar` suelto de la letra, SIN los `\n\n` del de raciones (0x0398).
    expect(h.lines[0]).toBe("W");
    // 0x0286 + 0x028d + 0x0290, en ese orden y pegados.
    expect(all).toContain('"Our wine list,\nsir.\n\n');
    // Las SEIS, verbatim y EN ORDEN (una sola aserción para que el orden cuente).
    expect(all).toContain(
      "a) Rose.......18\n" +
        "b) Claret....192\n" +
        "c) Sauterne...79\n" +
        "d) Muscatel...30\n" +
        "e) Moselle...275\n" +
        "f) Chablis....98\n\n",
    );
    expect(all).toContain('Thy choice?" ');
    // …y el prompt es lo ÚLTIMO que se emite (0x02c1 justo antes del getkey 0x02c8).
    expect(h.lines[h.lines.length - 1]).toBe('Thy choice?" ');
    expect(h.console.snapshot().phase).toBe("wine-list");
  });

  it("el trato por género sale de la ranura 0: `!= 0x0b` ⇒ milady (0x00c3)", () => {
    const h = makeHarness({ gender: 0x0c });
    h.console.key("w");
    expect(h.lines.join("")).toContain('"Our wine list,\nmilady.\n\n');
  });

  it("elegir 'a': eco EN MAYÚSCULA + `Ah, a fine choice,` + trato + '.' y cobro de 18", () => {
    const h = makeHarness({ gold: 500 });
    h.console.key("w");
    h.lines.length = 0;
    h.console.key("a");
    const all = h.lines.join("");
    // 0x0302-0x0319: el getkey del binario entrega mayúscula y `putchar` la imprime.
    expect(all).toContain('A\n\n"Ah, a fine\nchoice, sir.');
    // 0x0368 + la cola compartida 0x02d2 (dos `putchar('\n')`).
    expect(all).toContain('\nEnjoy!"\n\n');
    expect(h.state.gold).toBe(500 - 18); // DS 0x4c48[0]
    // Servida ⇒ epílogo con el flag de servicio puesto (0x791).
    expect(h.console.snapshot().phase).toBe("tavern-again");
  });

  it("una tecla fuera de 'a'..'f' RE-LEE en silencio: ni emite ni cambia de fase (0x02f6/0x02fc)", () => {
    const h = makeHarness();
    h.console.key("w");
    h.lines.length = 0;
    h.console.key("z");
    expect(h.lines).toEqual([]);
    expect(h.console.snapshot().phase).toBe("wine-list");
    expect(h.state.gold).toBe(500);
  });

  it("ESPACIO se RETIRA (ret 2): registro 89, NO sale de la taberna y NO desbloquea el chat", () => {
    const h = makeHarness();
    h.console.key("w");
    h.lines.length = 0;
    h.console.key(" ");
    const all = h.lines.join("");
    expect(all).toContain("\n\n"); // 0x02d2 + 0x02d9
    expect(all).toContain('\n\n"Well! Our meagre stock must not be good enough for thee!"\n');
    expect(h.closed()).toBe(false); // NO es el Espacio-global de salida
    expect(h.state.gold).toBe(500); // no se cobra nada
    expect(h.console.snapshot().phase).toBe("tavern-again");
    // ret 2 ⇒ [0xbd18] intacto: tras la re-visita el Chat sigue mudo. Se mide por el
    // getstring del rumor, no por la fase — las dos ramas del epílogo dejan la MISMA.
    h.console.key("y"); // menú de re-visita
    h.console.key("t"); // tecla de chat del subtipo 1
    expect(h.texts).toEqual([]);
  });

  it("sin oro: `CAN'T PAY? Beat it!` yells <tendero>. y te ECHAN sin despedida (ret 1)", () => {
    const h = makeHarness({ gold: 10 }); // Rose vale 18
    h.console.key("w");
    h.lines.length = 0;
    h.console.key("a");
    const all = h.lines.join("");
    expect(all).toContain('A\n\n"Ah, a fine\nchoice, sir.'); // el eco va ANTES del gate de oro
    expect(all).toContain('"\n\n"CAN\'T PAY?\nBeat it!"\nyells Tika.\n');
    expect(h.state.gold).toBe(10); // no cobra
    expect(h.closed()).toBe(true);
    // Echado = salida 0x7dc SIN despedida: no se emite ningún registro del pool.
    expect(all).not.toContain('"Anything else\nfor thee?" ');
  });

  it("la tecla de bebida en un subtipo que NO es 'W' NO despliega carta (ronda de la casa)", () => {
    // Control de la guarda de #21 dentro de este fichero: sin él, un emisor de carta
    // que ignorase el subtipo pasaría todos los asertos de arriba igual.
    const h = makeHarness();
    // El subtipo 1 usa 'w'; en el 0 la tecla de bebida es 'a'. Con la ciudad 19 la 'a'
    // no es tecla de menú, así que basta con comprobar que sólo 'w' abre la carta.
    h.console.key("a");
    expect(h.console.snapshot().phase).toBe("tavern-menu");
    expect(h.lines.join("")).not.toContain('"Our wine list,');
  });

  it("el precio impreso en cada línea CUADRA con la tabla DS 0x4c48 que cobra", () => {
    // Dos datos distintos del binario (la cadena y la tabla): si divergieran, la carta
    // anunciaría un precio y el `sub [g_gold]` cobraría otro.
    const declarados = [18, 192, 79, 30, 275, 98];
    for (let i = 0; i < 6; i += 1) {
      const h = makeHarness({ gold: 1000 });
      h.console.key("w");
      h.console.key("abcdef"[i]!);
      expect(1000 - h.state.gold).toBe(declarados[i]);
    }
  });
});

/**
 * #325 — EL AVISO DE BORRACHERA, la CUARTA emisión (SHOPPES2 0x0211-0x0260).
 *
 * Las CINCO piezas estaban extraídas y traducidas y NO las emitía nadie: el clon
 * aplicaba el karma −1 y el timer de 25 turnos EN SILENCIO desde dentro de `buyWine`
 * (o sea al COMPRAR) y no modelaba el Y/N. En el binario el gate está en `0x020a`, al
 * ELEGIR la bebida y ANTES del discriminante `'W'` de `0x027c`.
 *
 * El contador se arma COMPRANDO de verdad tres copas — no inyectando `served`: así el
 * test ejercita también el `inc [g_cups_served]` de 0x0364 que lo alimenta.
 */
function tresCopas(h: ReturnType<typeof makeHarness>): void {
  for (let i = 0; i < 3; i += 1) {
    h.console.key("w"); // opción de bebida → carta (subtipo 'W')
    h.console.key("a"); // Rose, 18
    h.console.key("y"); // «Anything else for thee?» → menú de re-visita
  }
}

describe("#325 — el aviso de borrachera y su Y/N (SHOPPES2 0x0211-0x0260)", () => {
  it("con el contador EXACTAMENTE en 3, la bebida emite las CINCO piezas y espera tecla", () => {
    const h = makeHarness({ gold: 1000, karma: 50 });
    tresCopas(h);
    h.lines.length = 0;
    h.console.key("w"); // la CUARTA vez
    const all = h.lines.join("");
    expect(all).toContain("W"); // 0x0200: el eco de la letra va ANTES del gate
    expect(all).toContain('\n\n"I beg thy\npardon, sir,"\nsays Tika.\n"But haven\'t\nye had enough\nto drink?" ');
    expect(h.console.snapshot().phase).toBe("tavern-drunk-gate");
    // El gate NO castiga por sí solo: el karma cae en la rama 'N' (0x0260).
    expect(h.state.karma).toBe(50);
    // Y NO ha desplegado la carta todavía (el discriminante 'W' vive DETRÁS).
    expect(all).not.toContain('"Our wine list,');
  });

  it("'N': eco `No!`, timer 25 y karma −1 — y CONTINÚA a la carta (0x024c-0x0260)", () => {
    const h = makeHarness({ gold: 1000, karma: 50 });
    tresCopas(h);
    h.console.key("w");
    h.lines.length = 0;
    h.console.key("n");
    const all = h.lines.join("");
    expect(all).toContain("No!");
    expect(h.state.drunkTurns).toBe(25); // [g_drunk_timer] = 0x19
    expect(h.state.karma).toBe(49); // byte_sub_saturating(&karma, 1)
    expect(all).toContain('"Our wine list,'); // sigue a servir
    expect(h.console.snapshot().phase).toBe("wine-list");
  });

  it("'Y': eco `Yes\\n\\n`, NO sirve ni cobra — pero CUENTA COMO SERVICIO (ret 0)", () => {
    const h = makeHarness({ gold: 1000, karma: 50 });
    tresCopas(h);
    const goldTrasTres = h.state.gold;
    h.console.key("w");
    h.lines.length = 0;
    h.console.key("y");
    const all = h.lines.join("");
    expect(all).toContain("Yes\n\n");
    expect(h.state.gold).toBe(goldTrasTres); // ni una moneda
    expect(h.state.karma).toBe(50); // ni castigo
    expect(h.state.drunkTurns).toBeUndefined();
    expect(all).not.toContain('"Our wine list,'); // no despliega la carta
    expect(h.console.snapshot().phase).toBe("tavern-again");

    // 🔴 LO QUE ESTE TEST NO PUEDE PROBAR, Y POR QUÉ. El binario devuelve 0 en esta
    // rama, o sea CUENTA COMO SERVICIO (§41). Su consecuencia observable sería marcar
    // `[0xbd18]` — chat desbloqueado y despedida «con compra». Pero para LLEGAR al
    // aviso hacen falta TRES servicios previos, que ya lo marcaron: en el espacio de
    // estados ALCANZABLE, `tavernEpilogue(true)` y `(false)` son indistinguibles aquí.
    // Medido, no supuesto: el mutante que cambia el `true` por `false` en esta rama
    // SOBREVIVE a la suite entera. Se deja el `true` porque es lo que dice el binario,
    // y se declara que NINGUNA prueba de este flujo lo respalda — el aserto que lo
    // fingiera pasaría con el código roto. Lo que sí se prueba arriba es lo que sí
    // difiere: ni oro, ni karma, ni carta.
  });

  it("cualquier otra tecla RE-LEE: ni sale de la taberna ni resuelve el aviso (0x026d)", () => {
    const h = makeHarness({ gold: 1000, karma: 50 });
    tresCopas(h);
    h.console.key("w");
    h.lines.length = 0;
    h.console.key(" "); // Espacio: el gate global lo trataría como salida
    h.console.key("z");
    expect(h.lines).toEqual([]);
    expect(h.closed()).toBe(false);
    expect(h.console.snapshot().phase).toBe("tavern-drunk-gate");
  });

  it("con el contador en 4 NO vuelve a avisar: es `== 3`, no `>= 3` (0x020a `jne`)", () => {
    const h = makeHarness({ gold: 1000, karma: 50 });
    tresCopas(h);
    h.console.key("w");
    h.console.key("n"); // pasa el aviso y sirve la 4ª → contador 4
    h.console.key("a");
    h.console.key("y");
    h.lines.length = 0;
    h.console.key("w"); // la QUINTA
    const all = h.lines.join("");
    expect(all).not.toContain("But haven't");
    expect(all).toContain('"Our wine list,'); // va directo a la carta
    expect(h.state.karma).toBe(49); // el −1 de antes, sin re-castigo
  });
});
