/**
 * #192 (D4) — la ronda de comida de la taberna COBRA Y NO DA NADA (SHOPPES2 0x0140-0x01C8).
 *
 * ★★ EL PRODUCTOR DE `[0xbd1a]`, que era la PRECONDICIÓN que #182 dejó nombrada, está en
 * `SHOPPES2.OVL:0x0000` (`ret 2`, un arg = precio por cabeza):
 *
 * ```
 * 0008-0013: pone a CERO g_shop_accum(0xb118), g_alive_b(0xbd1c) y g_alive_a(0xbd1a)
 * 0016: al = g_party_size / 001d: je 0x54          ← party vacía: el bucle no corre
 * 0022: si = 0x55b3                                 ← base del roster, stride 0x20
 * 0030: cmp byte ptr [si], 0x44                     ← ¿estado 'D' (muerto)?
 * 0033: je 0x3e                                     ← ★ muerto: NO cuenta
 * 0035: inc dx (g_alive_b) / 0036: inc di (g_alive_a)
 * 0037: ax = [bp+4] / 003a: add word ptr [g_shop_accum], ax   ← coste += precio_por_cabeza
 * 0049: [g_alive_a] = di · 004d: [g_alive_b] = dx
 * ```
 *
 * ⇒ **`g_alive_a` (0xBD1A) es el NÚMERO DE MIEMBROS VIVOS**, y `g_shop_accum` el coste
 * total = precio_por_cabeza × vivos. El propio `re/ledger/globals.json` YA los tenía
 * nombrados `g_alive_a` / `g_alive_b` / `g_shop_accum`: la respuesta llevaba en el repo
 * desde antes de que la seña de #174 los llamara «el contador de rondas».
 *
 * ★ ESO CIERRA LA ADJUDICACIÓN QUE #182 DEJÓ ABIERTA. El gate de la ronda es
 * `014a: cmp word ptr [g_alive_a], 0` / `014f: je 0x1c4`, o sea que las dos ramas se
 * reparten así:
 *   · **con AL MENOS UN VIVO** (todo juego normal) → rama de COMIDA: `add_word_capped`
 *     y el PLATO. NUNCA incrementa `g_cups_served`.
 *   · **con la party ENTERA MUERTA** (g_alive_a == 0) → `01c4: inc [g_cups_served]`, y
 *     nada más. Es el único camino a esa rama.
 * La CONCLUSIÓN de la seña original («en el original nunca incrementa») era correcta; su
 * MECANISMO («un contador gateado al revés») no. El dominio queda acotado, que es lo que
 * #182 exigía antes de tocar nada.
 *
 * LOS TRES DEFECTOS DEL PORT, con su cita:
 *  1. **No da la comida.** `0151-015d: push 0x57a8 (=&g_food) / push [g_alive_a] /
 *     push 0x270f / call 0x5d34` → CS 0x3F14 `add_word_capped` ⇒ **+1 de comida POR
 *     MIEMBRO VIVO**, con tope 9999. `buyTavernRound` sólo resta oro.
 *  2. **No pinta el plato**, y son DOS orientaciones con tiles DISTINTOS y en ORDEN:
 *     primero el NORTE (`0160-0173`: `get_tile_ptr(x, y-1)`; si el tile es 0x95 escribe
 *     **0x9b**), y SÓLO si ahí no hay mesa, el SUR (`0194-01a7`: (x, y+1) → **0x9a**).
 *     Luego `018e: call 0x7730` → CS 0x5910 `viewport_redraw`.
 *  3. **El contador se incrementa en la rama CONTRARIA.** `shop-console.ts:2234` hace
 *     `this.served += 1` citando «g_cups_served++ (0x01C4)» — pero 0x01C4 es el destino
 *     del `je` de party-entera-muerta.
 *
 * RESOLUCIÓN DE LAS LLAMADAS — con la base del overlay, no leyendo el operando crudo
 * (`base SHOPPES2 = 0xE1E0`, `dispatch_table.overlay_near_call_base`). Verificado con
 * TRES controles positivos que caen en rutinas ya identificadas por actas anteriores:
 * `0x3670 → CS 0x1850 print_string` · `0x34da → CS 0x16ba putchar` ·
 * `0x7730 → CS 0x5910 viewport_redraw`. Sin la base, `0x5d34` «resolvía» a
 * `vis_buffer_build` y `0x7730` a `overlay_loader_fatal_abort` — nombres plausibles de
 * leer y completamente falsos.
 *
 * TERRENO VOLÁTIL (#119/#121): el plato se escribe por PUNTERO (`get_tile_ptr`), que es
 * el mismo canal que la puerta destrabada y la lava ⇒ `setVolatileTerrain`, no una capa
 * persistida.
 */
import { afterEach, describe, expect, it } from "vitest";
import { buyTavernRound, tavernAliveWord, tavernRoundPrice } from "../src/core/shops/shops.js";
import { SHOP_UI, TAVERN_ALIVE_WORD } from "../src/core/world/cmd-strings.js";
import { quoteOpen, setLang, t } from "../src/i18n/index.js";
import type { CharacterState, GameState } from "../src/core/state.js";

/**
 * Literales con su cita, SIN importar nada que el fix cree
 * (`failing-first-import-trap`): el tile de mesa y los dos platos salen del asm.
 */
const TABLE = 0x95; // 0170 / 01a4: cmp byte ptr [bx], 0x95
const PLATE_N = 0x9b; // 0185: mov byte ptr [bx], 0x9b   (mesa al NORTE)
const PLATE_S = 0x9a; // 01b9: mov byte ptr [bx], 0x9a   (mesa al SUR)
const FOOD_CAP = 0x270f; // 0159: mov ax, 0x270f  (= 9999)

function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "T", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10, currentHp: 50, maxHp: 60,
    exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  } as CharacterState;
}

function makeState(chars: CharacterState[], gold = 500, food = 100): GameState {
  return {
    characters: chars, partySize: chars.length, activeCharacter: 0,
    gold, food, karma: 50,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 0 },
    position: { location: 2, floor: 0, x: 5, y: 5 },
  } as GameState;
}

/** Índice de pueblo con Barkeeper: el 0 sirve para el arnés (precio > 0, comprobado). */
const TOWN = 0;

describe("#192 D4 · la ronda de taberna (SHOPPES2 0x0140-0x01C8)", () => {
  it("el arnés mide lo que cree: el precio por cabeza del pueblo 0 NO es cero", () => {
    // Sin esto, «cobra el coste correcto» sería verde con precio 0 — control degenerado.
    expect(tavernRoundPrice(TOWN, 1)).toBeGreaterThan(0);
  });

  describe("★ la comida: add_word_capped(&g_food, g_alive_a, 9999) — 0x0151-0x015d", () => {
    it("suma +1 de comida POR MIEMBRO VIVO", () => {
      const s = makeState([makeChar(), makeChar(), makeChar()], 500, 100);
      const r = buyTavernRound(s, TOWN);
      expect(r.ok).toBe(true);
      expect(s.food).toBe(103); // 3 vivos ⇒ +3
    });

    it("★ los MUERTOS no cuentan — ni para la comida ni para el coste (0x0030 cmp 0x44)", () => {
      // Aísla el discriminador: mismo tamaño de party, sólo cambia el estado de uno.
      const vivos = makeState([makeChar(), makeChar(), makeChar()], 500, 100);
      const conMuerto = makeState([makeChar(), makeChar(), makeChar({ status: "D" })], 500, 100);
      const oroVivos = vivos.gold, oroMuerto = conMuerto.gold;

      buyTavernRound(vivos, TOWN);
      buyTavernRound(conMuerto, TOWN);

      expect(vivos.food).toBe(103); // 3 vivos
      expect(conMuerto.food).toBe(102); // 2 vivos: el 'D' no come
      expect(oroVivos - vivos.gold).toBe(tavernRoundPrice(TOWN, 3));
      expect(oroMuerto - conMuerto.gold).toBe(tavernRoundPrice(TOWN, 2)); // ni paga por él
    });

    it("la suma va CAPADA a 9999 (el 0x270f del tercer push)", () => {
      const s = makeState([makeChar(), makeChar()], 500, FOOD_CAP - 1);
      buyTavernRound(s, TOWN);
      expect(s.food).toBe(FOOD_CAP); // 9998 + 2 = 10000 → capa a 9999
    });

    it("sin oro NO cobra y NO da comida (el gate 0x0114-0x011b va ANTES de 0x0140)", () => {
      const s = makeState([makeChar(), makeChar()], 0, 100);
      const r = buyTavernRound(s, TOWN);
      expect(r.ok).toBe(false);
      expect(s.gold).toBe(0);
      expect(s.food).toBe(100); // ni una unidad
    });
  });

  describe("★ el PLATO: dos orientaciones, con el NORTE primero (0x0160 antes que 0x0194)", () => {
    // La geometría es una decisión pura; se prueba a través del resultado de la ronda,
    // que es quien la expone al llamador (el mapa lo escribe el conductor con
    // setVolatileTerrain, canal de puntero #119).
    it("con mesa al NORTE el plato es 0x9b y va al norte", () => {
      const s = makeState([makeChar()], 500, 100);
      const r = buyTavernRound(s, TOWN, { north: TABLE, south: TABLE });
      // Con mesa en AMBOS lados gana el NORTE: es el orden del asm, y es lo que
      // distingue esta derivación de un port que mirase sólo una dirección.
      expect(r.plate).toEqual({ dy: -1, tile: PLATE_N });
    });

    it("sin mesa al norte pero SÍ al sur, el plato es 0x9a y va al sur", () => {
      const s = makeState([makeChar()], 500, 100);
      const r = buyTavernRound(s, TOWN, { north: 0x44, south: TABLE });
      expect(r.plate).toEqual({ dy: 1, tile: PLATE_S });
    });

    it("sin mesa 0x95 en ninguno de los dos, NO se escribe nada", () => {
      const s = makeState([makeChar()], 500, 100);
      const r = buyTavernRound(s, TOWN, { north: 0x44, south: 0x44 });
      expect(r.plate).toBeUndefined();
    });
  });

  describe("★ el CONTADOR: 0x01C4 es la rama de party ENTERA MUERTA, no la de comida", () => {
    it("con algún vivo la ronda NO cuenta como servicio (0x014a je 0x1c4 no se toma)", () => {
      const s = makeState([makeChar(), makeChar()], 500, 100);
      expect(buyTavernRound(s, TOWN).countsAsService).toBe(false);
    });

    it("con la party ENTERA MUERTA sí cuenta, y NO da comida ni plato (única vía a 0x01C4)", () => {
      const s = makeState([makeChar({ status: "D" }), makeChar({ status: "D" })], 500, 100);
      const r = buyTavernRound(s, TOWN, { north: TABLE, south: TABLE });
      expect(r.countsAsService).toBe(true);
      expect(s.food).toBe(100); // g_alive_a == 0 ⇒ el add_word_capped no corre
      expect(r.plate).toBeUndefined();
    });
  });

  /**
   * ★ #17 — EL ANUNCIO DE PRECIO (SHOPPES2 0x00dc-0x0111), que el clon NO EMITÍA.
   *
   * La ficha decía «el port calca el hueco de EA». No lo calcaba: **no emitía la frase**,
   * así que el hueco ni podía darse. Composición del binario, en orden:
   *   0x00dc putchar('"') · 0x00e3 DS 0x9ace 'That will be ' · 0x00ea print_number(precio)
   *   0x00f9 DS 0x9adc ' gold for the ' · 0x0100 call 0x006a (la palabra del nº de vivos)
   *   0x0103 DS 0x9aec ' of ye,\n' · 0x010a call 0x00ac (sir/milady) · 0x010d putchar('.')
   *
   * `print_alive_count_word` (0x006a) conmuta 2..6 y con 1 CAE AL `ret` DE 0x00aa sin
   * imprimir ⇒ el original saca «gold for the  of ye,» con DOBLE ESPACIO cuando el Avatar
   * viaja solo. Aquí se arregla con «one» (directriz: bug claro del original ⇒ arreglar y
   * registrar); el resto es transcripción.
   */
  describe("★ #17 · el anuncio de precio y la palabra del nº de vivos (0x006a)", () => {
    it("transcribe two..six como el switch del binario (0x006d-0x0084)", () => {
      // Literales del asm, NO importados de la tabla que el fix crea (failing-first-import-trap).
      expect([2, 3, 4, 5, 6].map(tavernAliveWord)).toEqual(["two", "three", "four", "five", "six"]);
    });

    it("🔧 con UN vivo emite «one» — el hueco de EA (0x00aa ret) ARREGLADO", () => {
      expect(tavernAliveWord(1)).toBe("one");
    });

    it("con 0 vivos NO inventa palabra: cae al ret como el binario (caso degenerado declarado)", () => {
      expect(tavernAliveWord(0)).toBe("");
    });

    it("el anuncio viaja en las DOS ramas — también sin oro (va ANTES del gate de 0x0114)", () => {
      const rico = makeState([makeChar(), makeChar()], 500, 100);
      expect(buyTavernRound(rico, TOWN).priceLine.aliveWord).toBe("two");
      const pobre = makeState([makeChar(), makeChar()], 0, 100);
      const r = buyTavernRound(pobre, TOWN);
      expect(r.ok).toBe(false); // te echa…
      expect(r.priceLine.aliveWord).toBe("two"); // …pero ya había cantado el precio
      expect(r.priceLine.cost).toBe(tavernRoundPrice(TOWN, 2));
    });

    it("el trato sale de la ranura 0 (bx = 0<<5) con polaridad `== 0x0b → sir`", () => {
      // El Avatar es la ranura 0 y el compañero lleva OTRO género: si el port leyera el
      // slot equivocado, este caso lo delata.
      const varon = makeState([makeChar({ gender: 0x0b }), makeChar({ gender: 0x0c })]);
      expect(buyTavernRound(varon, TOWN).priceLine.sir).toBe(true);
      const dama = makeState([makeChar({ gender: 0x0c }), makeChar({ gender: 0x0b })]);
      expect(buyTavernRound(dama, TOWN).priceLine.sir).toBe(false);
      // ⚠ CUALQUIER byte que no sea 0x0b cae en «milady», no sólo el 0x0c (0x00c8 jne).
      const raro = makeState([makeChar({ gender: 0x00 })]);
      expect(buyTavernRound(raro, TOWN).priceLine.sir).toBe(false);
    });
  });
});

/**
 * #17 (COLA) — EL ANUNCIO DE PRECIO SE EMITÍA MEDIO EN INGLÉS BAJO `es`.
 *
 * La frase la componen SEIS piezas y el conductor las traduce una a una
 * (`shop-console.emitTavernPriceLine`). Cinco estaban en el corpus ES desde que se
 * extrajo DATA.OVL; la del medio —la PALABRA DEL NÚMERO DE VIVOS que produce
 * `tavernAliveWord`— no estaba, así que `t()` caía a su fallback (la identidad) y
 * salía «Serán 12 de oro por two de vosotros, señor.». MEDIDO corriendo la ruta
 * bajo `es` antes de tocar nada, no inferido de leer el código.
 *
 * El REACTIVO que hace no-vacuo al aserto: el corpus SÍ tenía `One`..`Six` en
 * MAYÚSCULA (otra tabla del binario) y `t()` distingue caja — tenerlas no ayudaba
 * en nada a esta frase, que las pide en minúscula.
 */
describe("#17 cola — la línea de precio se traduce ENTERA bajo `es`", () => {
  const linea = (n: number): string =>
    quoteOpen() +
    t(SHOP_UI.tavernThatWillBe) +
    "12" +
    t(SHOP_UI.tavernGoldForThe) +
    t(tavernAliveWord(n)) +
    t(SHOP_UI.tavernOfYe) +
    t(SHOP_UI.tavernSir) +
    SHOP_UI.tavernPriceClose;

  afterEach(() => setLang("en")); // el calco es el suelo: se restituye siempre

  it("ES: ninguna pieza queda en inglés, para los seis tamaños de party alcanzables", () => {
    setLang("es");
    const palabra: Record<number, string> = {
      1: "uno",
      2: "dos",
      3: "tres",
      4: "cuatro",
      5: "cinco",
      6: "seis",
    };
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(linea(n)).toBe(`«Serán 12 de oro por ${palabra[n]} de vosotros,\nseñor.`);
      // Reactivo: la palabra INGLESA no puede sobrevivir dentro de la frase española.
      const ingles = n === 1 ? "one" : TAVERN_ALIVE_WORD[n]!;
      expect(linea(n), `vivos=${n}: la palabra del número quedó sin traducir`).not.toContain(ingles);
    }
  });

  it("EN sigue siendo la IDENTIDAD ESTRICTA (`t()` no toca el calco)", () => {
    setLang("en");
    expect(linea(3)).toBe('"That will be 12 gold for the three of ye,\nsir.');
  });
});
