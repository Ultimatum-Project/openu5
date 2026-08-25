/**
 * SALUDOS DE TIENDA (carril saludos-shoppe) — derivación COMPLETA en
 * `re/notes/shoppe-greetings-witness.md` (testigos batch-1/2 + adenda-3 del lead).
 *
 * Emisor original: SHOPPES.OVL 0x01b6 —
 *   01b7  putchar '"'                       ; comilla de apertura
 *   01c1  rand(0,3)                         ; kernel 0x7E02 [= CS 0x2092 rand_range], stream VIVO, POR VISITA
 *   01cc  bx=[0xb116]; shl 3                ; tipo de tienda ×8 (4 word-ptrs por tipo)
 *   01d4  push [bx+var·2+DS 0x3b2a]         ; tabla 2D [tipo][variante] → offset SHOPPE.DAT
 *   01d8  call 0x017a                       ; carga registro + IMPRIME expandiendo $/#/@
 *
 * La tabla DS 0x3b2a (DATA.OVL fileoff 0x3b3a) se ha verificado AQUÍ byte a byte contra
 * SHOPPE.DAT: cada offset decomprimido casa con la entrada de `game/assets/shoppe.json`
 * anotada abajo (careo por contenido, 7 tipos × 4 variantes). El HERRERO (tipo 0) tiene
 * la fila a CERO en esa tabla: su saludo NO va por 0x01b6 sino por su propia entrada
 * (SHOPPES 0x12b2): DS 0x8018 `"Good @, and welcome to #!"` + DS 0x8036 `\n$ says,\n"`
 * + rand(0,1) sobre DS 0x3d46 → {0x7f48, 0x7f70} + DS 0x8042 `" ` (strings fijas en
 * SHOP_UI, no en shoppe.json).
 *
 * Expansión de placeholders (expansor SHOPPES 0x005b):
 *   `$` = nombre del tendero · `#` = nombre de la tienda · `@` = parte del día por
 *   g_hour (SHOPPES 0x00d8-0x00fa: <12 → morning · <18 → afternoon · resto → evening;
 *   palabras DATA.OVL 0x7836/0x783e/0x7848 — solo esas 3).
 *
 * RULING de paridad RNG (lead, 2026-07-22): FIEL-TOTAL — la variante consume el rand
 * VIVO del port (mismo stream que la merma post-compra), con ventana de re-sello de la
 * cadena grandtour afectada.
 */
import type { ShopType } from "./shops.js";

/**
 * Índices en `shoppe.json` de las 4 plantillas de saludo por tipo (tabla 2D DS 0x3b2a,
 * verificada offset→contenido contra SHOPPE.DAT). El Blacksmith NO está (fila 0x0000×4
 * en la tabla original = vía propia 0x12b2, ver cabecera).
 */
export const SHOPPE_GREETING_INDEX: Partial<Record<ShopType, readonly [number, number, number, number]>> = {
  Barkeeper: [57, 58, 59, 60], //     SHOPPE.DAT 3436/3494/3545/3604
  HorseSeller: [92, 93, 94, 95], //   SHOPPE.DAT 5265/5345/5395/5463
  Shipwright: [105, 106, 107, 108], //SHOPPE.DAT 5783/5848/5904/5965
  MagicSeller: [127, 128, 129, 130], //SHOPPE.DAT 6759/6826/6885/6949
  GuildMaster: [148, 149, 150, 151], //SHOPPE.DAT 8034/8082/8145/8230
  Healer: [165, 166, 167, 168], //    SHOPPE.DAT 8764/8819/8875/8927
  InnKeeper: [174, 175, 176, 177], // SHOPPE.DAT 9188/9242/9308/9365
};

/**
 * PITCH de habitación de la posada por ciudad (F2-T2 espejo) — REST SHOPPES3
 * 0x00d5: `push word [g_unk_b114·2 + DS 0x4e6e]; call print_shoppe (0x9dd6)`.
 * La tabla DS 0x4e6e (DATA.OVL fileoff 0x4e7e) trae 6 punteros al buffer de
 * SHOPPE.DAT: [0x25d0, 0x2600, 0x2641, 0x2641, 0x2667, 0x26a7] → registros
 * 186..190 de shoppe.json (Skara Brae y loc 20 COMPARTEN el 188). `%` = precio
 * (rate·party con haggle, g_unk_b118). Orden = SHOP_TOWNES.InnKeeper
 * [2,3,7,20,22,24]; el testigo (aulddragon P05, King's Ransom Inn = Buccaneer's
 * Den) casa con el 190 («…space in the common area for % gp.»).
 */
export const INN_PITCH_INDEX = [186, 187, 188, 188, 189, 190] as const;
/** Registro «…all ye plan to do is SLEEP…» — LEAVE con party de 1 (SHOPPES3 0x2d5, ptr 0x26e8). */
export const INN_ALONE_INDEX = 191;
/** Registro «Whaddya think this is, a morgue?…» — LEAVE de un miembro muerto (0x368, ptr 0x2723). */
export const INN_CORPSE_INDEX = 192;

/**
 * DESPEDIDAS DE TIENDA — emisor SHOPPES.OVL **0x0202** (derivado en este carril,
 * instrucción a instrucción):
 *
 *   0206  cmp [bp+4],0 / 0230  cmp [bp+4],1   ; arg = ¿compró el cliente?
 *   020c/0236  print DS 0x7854 / 0x7858       ; ambas = `\n\n"` (comilla de apertura)
 *   021a/0244  rand(0,3)                      ; kernel 0x7E02 [= CS 0x2092 rand_range], stream VIVO, POR SALIDA
 *   0221/024b  bx=[0xb116]; shl 3             ; tipo de tienda ×8
 *   0229  push [bx+var·2 + DS **0x3b6a**]     ; arg=0 (SIN compra)  → tabla A
 *   0253  push [bx+var·2 + DS **0x3baa**]     ; arg=1 (CON compra)  → tabla B
 *   0257  call 0x017a                         ; carga registro SHOPPE.DAT + imprime
 *   0266-0274  newline condicional + print DS 0x785c = `says $.\n` (call 0x26, expande $)
 *   (arg ∉ {0,1} — p.ej. -1 tras la VENTA del herrero, 0x135d — no imprime NADA)
 *
 * Las DOS tablas (DATA.OVL fileoff 0x3b7a / 0x3bba) se verificaron AQUÍ offset→registro
 * contra SHOPPE.DAT (mismo método que la de saludos): 8 tipos × 4 variantes, y a
 * diferencia del saludo el HERRERO SÍ tiene fila (registros 0-3 / 4-7). El contenido
 * confirma la semántica del arg: tabla A = despedidas de despecho («Thanks for
 * nothing!»…), tabla B = amables («Come again!»…); el CURANDERO tiene la MISMA fila en
 * ambas ([169-172]) — coherente con que su flujo (0x171e) pasa arg=1 constante.
 *
 * RESOLUCIÓN de la tabla ambigua **0x3d36** (¿despedida? decía el disasm del herrero):
 * NO es la tabla de despedidas. DS 0x3d36 (fileoff 0x3d46) = 8 punteros a strings DS
 * («Good-bye...», «Mayhap another time...», «Godspeed...», «Fare thee well...» +
 * 4 variantes de «What else … sell?») — es la CHARLA del sub-flujo de VENTA del herrero
 * (emisor 0x126x, rand(0,3) sobre las 4 primeras), tras la cual la salida pasa
 * arg=-1 a 0x0202 (despedida SILENCIOSA). Ambas cosas se calcan: la charla en los
 * pools BLACKSMITH_SELL_* de abajo (carril sell-chatter) y el arg=-1 en emitFarewell.
 */
export const SHOPPE_FAREWELL_NO_PURCHASE: Record<ShopType, readonly [number, number, number, number]> = {
  Blacksmith: [0, 1, 2, 3], //     SHOPPE.DAT 0/17/56/67
  Barkeeper: [61, 62, 63, 64], //  SHOPPE.DAT 3652/3689/3717/3745
  HorseSeller: [96, 97, 98, 99], //SHOPPE.DAT 5530/5556/5566/5577
  Shipwright: [109, 110, 111, 112], // SHOPPE.DAT 6024/6043/6087/6098
  MagicSeller: [131, 132, 133, 134], //SHOPPE.DAT 7009/7027/7056/7080
  GuildMaster: [152, 153, 154, 155], //SHOPPE.DAT 8287/8312/8326/8347
  Healer: [169, 170, 171, 172], // SHOPPE.DAT 8990/9020/9054/9089
  InnKeeper: [178, 179, 180, 181], // SHOPPE.DAT 9458/9484/9504/9529
};

export const SHOPPE_FAREWELL_PURCHASE: Record<ShopType, readonly [number, number, number, number]> = {
  Blacksmith: [4, 5, 6, 7], //     SHOPPE.DAT 87/100/118/131
  Barkeeper: [65, 66, 67, 68], //  SHOPPE.DAT 3772/3790/3811/3828
  HorseSeller: [100, 101, 102, 103], // SHOPPE.DAT 5610/5643/5659/5687
  Shipwright: [113, 114, 115, 116], //  SHOPPE.DAT 6118/6151/6173/6194
  MagicSeller: [135, 136, 137, 138], // SHOPPE.DAT 7103/7130/7157/7183
  GuildMaster: [156, 157, 158, 159], // SHOPPE.DAT 8379/8410/8430/8462
  Healer: [169, 170, 171, 172], // fila IDÉNTICA a la tabla A (única del corpus)
  InnKeeper: [182, 183, 184, 185], // SHOPPE.DAT 9577/9604/9634/9662
};

/**
 * CHARLA DEL SELL-FLOW DEL HERRERO (carril sell-chatter, 2026-07-22) — derivación
 * instrucción a instrucción del flujo de venta SHOPPES.OVL **0x0f64** (entrada desde
 * el dispatcher del herrero 0x12b2: rama 'S' @0x1352 imprime el eco DS 0x804e
 * `Sell\n\n"` y llama 0xf64; al volver si=0xffff @0x135d ⇒ 0x0202 arg=-1 silencioso
 * y la SESIÓN TERMINA — 0x133d sale con 'B'/'S'/Space, no vuelve al menú):
 *
 *   0f6c  call 0xc58                        ; ¿algo que vender? (escaneo g_equip_qty
 *                                           ;   DS 0x57c0, 48 slots) — ANTES de rand
 *   0f73  (si no) jmp 0x12a2 → print DS 0x7f20 `Thou hast nothing to sell!"\n
 *         growls $.\n` (call 0x26, expande $) y ret (sin despedida propia)
 *   0f7d  rand(0,3) → print [DS 0x3d2e][r]  ; prompt de APERTURA 1-de-4 (abajo)
 *   0f8b  print DS 0x7ef0 `" `              ; cierra la comilla del eco 0x804e
 *   0f92  ventana «Arms» (título DS 0x7ef4) + picker list_wares 0xc80
 *   11ea  Enter/Space → sell_one_item 0xe76 (oferta rand(0,7) + Deal? Y/N); si
 *         devuelve ≠0 (munición usada 0x1b/0x1d, DS 0x7d32) → salida SILENCIOSA
 *         ([bp-0x10] suprime el epílogo). Tras venta: si 0xc58==0 → salida; si no
 *   120f  print DS 0x7f06 `\n\n"` + rand(0,3) → [DS 0x3d3e][r] («What else…»
 *         1-de-4) + DS 0x7f0a `" ` y vuelve al picker
 *   1266  SALIDA (ESC o sin-restos): print DS 0x7f0e `\n\n"` + rand(0,3) →
 *         [DS 0x3d36][r] («Good-bye…» 1-de-4) + DS 0x7f12 `"\n`; y SOLO si queda
 *         algo vendible (call 0xc58 @0x1295) la atribución DS 0x7f16 `says $.\n`
 *         (tras vender el ÚLTIMO ítem el Good-bye sale SIN atribución).
 *
 * Strings verificadas byte a byte contra DATA.OVL (fileoff = DS+0x10). Testigo de
 * careo: frame goodbye.png (aulddragon P05 ~25:40, Buccaneers Booty/Kitiara) =
 * `"Show me what ye got..."` (variante 2 de 0x3d2e) + `"Good-bye..."\nsays Kitiara.`
 * (variante 0 de 0x3d36 + 0x7f16) — EMITIDA-EXACTA. El rand es del stream VIVO
 * (kernel 0x7E02 [= CS 0x2092 rand_range]; ruling paridad FIEL-TOTAL 2026-07-22).
 */
/** Prompt de apertura del flujo Sell, rand(0,3) — tabla DS 0x3d2e → {0x7db4, 0x7dda, 0x7df8, 0x7e10}. */
export const BLACKSMITH_SELL_PROMPTS = [
  "Which item wouldst thou like to sell?",
  "What dost thou wish to sell?",
  "Show me what ye got...",
  "What dost thou have for me to buy?",
] as const;

/** Charla tras cada venta (con restos), rand(0,3) — tabla DS 0x3d3e → {0x7e76, 0x7e92, 0x7eae, 0x7ed0}. */
export const BLACKSMITH_SELL_MORE = [
  "What else can ye offer me?",
  "What else hath ye to sell?",
  "What else doth thou wish to sell?",
  "What other arms wilt thou sell?",
] as const;

/** Good-bye del flujo Sell, rand(0,3) — tabla DS 0x3d36 → {0x7e34, 0x7e40, 0x7e58, 0x7e64}. */
export const BLACKSMITH_SELL_BYES = [
  "Good-bye...",
  "Mayhap another time...",
  "Godspeed...",
  "Fare thee well...",
] as const;

/**
 * OFERTAS de venta del herrero (carril sell-offers) — `sell_one_item` SHOPPES.OVL
 * **0x0e76**, derivación instrucción a instrucción:
 *
 *   0e7d  cmp [bp+4],0x1b / 0x1d            ; munición usada (Arrows/Quarrels) →
 *         print DS 0x7d32 `\n\n"We don't deal in used ammunition!"\ngrowls $.\n`
 *         (call 0x26 expande $) y RET 1 — el caller (0x11f6) sale del flujo con el
 *         epílogo Good-bye SUPRIMIDO ([bp-0x10]≠0 @0x126c)
 *   0e96  print DS 0x7d64 `\n\n"`           ; comilla de apertura de la oferta
 *   0ea2  cmp equipmentBasePrices[item],0   ; base 0 → DS 0x7d8c `That, I cannot buy
 *         from thee."\nsays $.` y ret 0 (inalcanzable en el port: sellableIds filtra)
 *   0eac  §0.2: g_shop_accum (0xb118) = ⌊3·INT·base/100⌋+1  ; = equipmentSellPrice
 *   0eda  [0xab00] = [item·2+DS 0x3cce] || [item·2+DS 0x17f6]  ; nombre para `&`
 *         (tabla de OVERRIDE con 0x0000 casi en toda fila — «Cloth suit», «Two-Handed
 *         Sword», «Invisibility Ring»… — con fallback al nombre largo de equipo;
 *         volcada mergeada en `data/sellOfferNames.json`, DATA.OVL fileoff DS+0x10)
 *   0eec  rand(0,7)                         ; kernel 0x7E02 [= CS 0x2092 rand_range], stream VIVO, POR OFERTA
 *   0efa  print [r·2 + DS 0x3cbe]+0xa65e    ; plantilla: la tabla DS 0x3cbe (DATA.OVL
 *         fileoff 0x3cce) = 8 fileoffs de SHOPPE.DAT {0xbc0,0xbff,0xc2e,0xc55,0xca1,
 *         0xce8,0xd12,0xd3d} residentes en 0xb21e (rebase +0xa65e); careo por
 *         contenido → shoppe.json[49..56] EN ESE ORDEN. El print es el expansor 0x26:
 *         `%` = itoa(g_shop_accum) @0x00fc — EL PRECIO recién calculado — y `&` =
 *         [0xab00] @0x0122 (el nombre de arriba)
 *   0f05  print DS 0x7d68 `\n\nDeal?" `     ; prompt Y/N
 *   0f0c  getkey 0x83dc en BUCLE hasta 'Y' (0x59) o 'N' (0x4e) — Space/ESC se RE-LEEN
 *   'N' → print DS 0x7d72 `No` (0x75c0 crudo, sin expandir) y ret 0
 *   'Y' → print DS 0x7d76 `Yes\n\n"Done!"\nsays $.` (call 0x26 expande $) +
 *         gold += precio cap 9999 (kernel 0x9c84 [= CS 0x3f14 → ULTIMA.EXE:0x3f14]) + qty[item] −= 1 (kernel 0x9ca6 [= CS 0x3f36 → ULTIMA.EXE:0x3f36])
 *
 *   Caller (0x11f6-0x1232), tras ret 0 (Y y N por IGUAL): si 0xc58==0 (nada vendible)
 *   → salida con Good-bye; si quedan restos → re-lista (0xc80) + What-else 1-de-4
 *   (BLACKSMITH_SELL_MORE) — ya calcado en pickSell/afterDeal.
 *
 * Strings fijas verificadas byte a byte contra DATA.OVL (fileoff = DS+0x10); el rand
 * es del stream VIVO (ruling paridad FIEL-TOTAL 2026-07-22, mismo que el saludo).
 */
export const BLACKSMITH_SELL_OFFER_INDEX = [49, 50, 51, 52, 53, 54, 55, 56] as const;

/**
 * FLUJO BUY DEL HERRERO (carril buy-herrero) — derivación instrucción a instrucción
 * del dispatcher (SHOPPES.OVL **0x12b2**, rama 'B' @0x1306) y del bucle de compra
 * (**0x0b30**) + `buy_one_item` (**0x09ac**):
 *
 *   1306  print DS 0x8046 `Buy\n\n"`          ; eco de la tecla + comilla de apertura
 *   1314  rand(0,3) → print [DS 0x3d4a][r]    ; exclamación 1-de-4 (BUY_EXCLAIMS)
 *   1329  rand(0,3) → print [DS 0x3d52][r]    ; presentación 1-de-4 (BUY_INTROS)
 *   1338  call 0xb30(charIdx)                 ; bucle de compra; su retorno va a la
 *         despedida general 0x0202 (0=sin compra, 1=compró ≥1, -1=echado → silencio)
 *
 * Bucle 0x0b30 (por pasada de lista):
 *   0b40  print DS 0x7c44 `\n\n`
 *   0b49  stock = weaponsSoldByMerchants[g_b114][0..7] (DS 0x3ae2, 0xFF=fin)
 *   0bcc  por ítem: putchar('a'+slot) + DS 0x7c48 `...` + NOMBRE — largo (tabla DS
 *         0x17f6) si strlen<13 (0x0be7 `cmp ax,0xd`), CORTO (tabla DS 0x1962) si no
 *   0b65  putchar '\n' + rand(0,3) → print [DS 0x3cb6][r]  ; pregunta 1-de-4
 *         (BUY_WHICH) + DS 0x7c4c `" `
 *   0b8b  getkey: 'A'+i válido → eco MINÚSCULA ('a'+i, 0x0ba1) + buy_one_item;
 *         ESC/Space → sale devolviendo el flag acumulado; otra tecla → re-lee
 *         (0x0c3c, SIN re-listar). Tras cada buy_one_item con retorno ≠ -1 →
 *         RE-LISTA entera (0x0c49 → 0x0b40, consume otro rand del BUY_WHICH).
 *
 * buy_one_item 0x09ac(prev, equipId, charIdx):
 *   09be  precio = §0.1 (base DS 0x3a82 + INT [charIdx·0x20+0x55b6]) → g_b118
 *   0a07  print DS 0x7b5e `\n\n"` + registro SHOPPE.DAT[[equipId·2+DS 0x3c48]]
 *         (loader 0x017a + expansor: `%` = itoa(g_b118) = EL PRECIO) — el PITCH
 *         por-ítem (BLACKSMITH_BUY_PITCH_INDEX)
 *   0a1f  print DS 0x7b62 `\n\n` + rand(0,3) → [DS 0x3ca6][r] (BUY_ASKS) + 0x7b66 `" `
 *   0a3a  getkey en BUCLE hasta 'Y'/'N' (Space/ESC se RE-LEEN):
 *   'N' → print DS 0x7b6a `No\n\n` → epílogo
 *   'Y' → print DS 0x7b70 `Yes\n`; luego:
 *     · qty==99 (0x0a5e): DS 0x7b76 `\n"Thou canst not carry any more!"\n` + DS
 *       0x7b9a `says $.\n\n` (expande $) + GETKEY DE PAUSA (0x0a73) → epílogo
 *     · gold<precio (0x0a7b): DS 0x7ba4 `\n"` + rand(0,3) → [DS 0x3cae][r]
 *       (BUY_BROKE) + DS 0x7ba8 `"\nyells $.\n` → retorno -1: el bucle 0x0b30
 *       TERMINA (0x0bc3→0x0c28) y el dispatcher pasa -1 a 0x0202 → despedida
 *       SILENCIOSA (te echan de la tienda)
 *     · pago (0x0aaa): gold -= precio; merma 0x019a; repinta panel 0x8670 (=kernel
 *       0x2900 roster+F/G+fecha); grant +1 cap 99 — salvo MUNICIÓN 0x1b/0x1d:
 *       qty=99 directo (0x0ac1, lote lleno); print DS 0x7bb4 `\nSold!\n` → epílogo
 *   Epílogo (0x0af2, salvo retorno -1): DS 0x7bbc `"Anything else,\n` + cola según
 *   el flag ACUMULADO de la sesión (di): sin compra aún → DS 0x7bdc `then?`; con
 *   compra → por GÉNERO del negociador ([charIdx·0x20+0x55b1]==0x0c hembra → DS
 *   0x7bce `milady?`; si no DS 0x7bd6 `sir?`). Después, re-lista.
 *
 * Strings verificadas byte a byte contra DATA.OVL (fileoff = DS+0x10); la tabla
 * DS 0x3c48 (fileoff 0x3c58) careada offset→registro contra SHOPPE.DAT (mismo
 * método que saludos/despedidas). El rand es del stream VIVO
 * (kernel 0x7E02 [= CS 0x2092 rand_range];
 * ruling paridad FIEL-TOTAL 2026-07-22, mismo que saludo/despedida/ofertas).
 */
/** Exclamación al pulsar 'B', rand(0,3) — tabla DS 0x3d4a → {0x7fb2, 0x7fbe, 0x7fca, 0x7fd8}. */
export const BLACKSMITH_BUY_EXCLAIMS = [
  "Very good!\n",
  "Excellent!\n",
  "Fine, fine!\n",
  "But of course!\n",
] as const;

/** Presentación de la lista, rand(0,3) — tabla DS 0x3d52 → {0x7fe8, 0x7ff2, 0x7ffc, 0x800c}. */
export const BLACKSMITH_BUY_INTROS = [
  "We have:",
  "We stock:",
  "Thou canst buy:",
  "We've got:",
] as const;

/** Pregunta tras la lista, rand(0,3) — tabla DS 0x3cb6 → {0x7be2, 0x7bf8, 0x7c18, 0x7c30}. */
export const BLACKSMITH_BUY_WHICH = [
  "What may I show thee?",
  "Which wouldst thou like to see?",
  "What is thine interest?",
  "Which would ye see?",
] as const;

/** Pregunta tras el pitch, rand(0,3) — tabla DS 0x3ca6 → {0x7ab6, 0x7acc, 0x7ae0, 0x7aec}. */
export const BLACKSMITH_BUY_ASKS = [
  "Wouldst thou buy one?",
  "Wilt thou take it?",
  "Wish ye it?",
  "May I get one for thee?",
] as const;

/** Insulto sin oro, rand(0,3) — tabla DS 0x3cae → {0x7b04, 0x7b28, 0x7b48, 0x7b54}. */
export const BLACKSMITH_BUY_BROKE = [
  "Can't pay?! Out with ye, orc-face!",
  "What be ye trying to pull? OUT!",
  "OUT, SLIME!",
  "BEAT IT!",
] as const;

/**
 * PITCH por equipId → índice en `shoppe.json` (tabla DS 0x3c48, fileoff 0x3c58:
 * 48 words = OFFSETS de registro en SHOPPE.DAT; careo offset→índice con el mapa
 * de arranques del StringList — los registros 8..48 en orden, con huecos 0x0000 en
 * los equipId que NINGÚN herrero surte: 8, 15, 35, 39-41; el 47 apunta fuera del
 * chunk, también fuera de stock — DS 0x3ae2 no contiene ninguno de ellos). `%` en
 * la plantilla = el precio ya regateado (itoa de g_b118, expansor @0x00fc).
 */
export const BLACKSMITH_BUY_PITCH_INDEX: readonly (number | null)[] = [
  8, 9, 10, 11, 12, 13, 14, 15, // equip 0-7: yelmos + escudos (7=Magic Shield → [15] "Shield of the Magi")
  null, 16, 17, 18, 19, 20, 21, null, // 8=Jewel Shield y 15=Mystic Armour sin registro (offset 0x0000)
  22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, null, 41, 42, 43, null, // 35=Chaos Swrd, 39=Glass Swrd sin registro
  null, null, 44, 45, 46, 47, 48, null, // 40/41=Jeweled/Mystic Swrd sin registro; 47=Ankh fuera de rango
];

/**
 * CADENA DE COMPRA DEL MAGIC SELLER (carril cadenas-presentacion) — derivación
 * instrucción a instrucción del bucle de lista (SHOPPES.OVL **0x666**) y de
 * `buy_one_reagent` (**0x502**):
 *
 *   0675  load_chunk("SHOPPE.DAT", fileoff 0x1a67, len 0x5dc → buf 0xb21e)
 *         ; precarga el chunk de pitches (rebase buf−fileoff = +0x97b7)
 *   0691  filas: putchar('A'+i) + `...` (DS 0x7a16) + nombre [DS 0x3c20][slot]
 *         + '\n' — sólo slots con precio [town·8+slot+DS 0x3a32] ≠ 0
 *   06da  print DS 0x7a1a `\nThy interest?" ` + getkey: ESC(0x1b)/CR(0xd)/
 *         Space(0x20) → SALE devolviendo el flag acumulado; 'A'..'E' →
 *         buy_one_reagent 0x502; otra tecla → re-lee en silencio. Tras cada
 *         retorno 0/1 la lista SE RE-IMPRIME entera (0x736 → 0x688→0x691);
 *         retorno -2 (letra sin slot) re-lee SIN re-listar; retorno -1 SALE.
 *
 * buy_one_reagent 0x502(prev, letterIdx, charIdx):
 *   0520  letra → slot: recorre los 8 slots contando sólo los surtidos
 *   0549  qty[slot] (DS 0x5850) == 0x63 → print DS 0x792c `\n\n"Thou canst not
 *         carry any more!"\n\n` + GETKEY DE PAUSA (0x557, descarta) y ret prev
 *   0560  §0.1 precio → g_b118; cantidad [slot+DS 0x3a5a] → [0xb11a] (el `^`)
 *   05b8  print DS 0x7952 `\n\n"` + PITCH shoppe.json[139+slot] (expansor 0x26:
 *         `%`=precio @0x00fc, `^`=cantidad @0x0114) + DS 0x7956 ` Is this thy
 *         need?" ` (+ `\n:` DS 0x796c si la columna 0x7c82 > 12 — presentación
 *         física de wrap, NO modelada: el canal de consola es de líneas lógicas)
 *   05eb  getkey en BUCLE hasta 'Y'/'N' (Space/ESC se RE-LEEN):
 *   'N' → print DS 0x7970 `No\n\n"What else?\n\n` y ret prev → re-lista
 *   'Y' → print DS 0x7982 `Yes\n`; gold<precio → print shoppe.json[147]
 *         (`\n"Thou profaneth my shoppe with thy empty purse! OUT!"\nsnarls $.\n`,
 *         registro del chunk @0xb6e2 = fileoff 0x1f2b, expansor $) y ret -1 →
 *         la sesión TERMINA con despedida 0x202 arg=-1 (SILENCIO);
 *         pago (0x61c) → gold−=precio + merma 0x19a + repaint 0x8670 + grant
 *         qty cap 0x63 (kernel 0x9c60 [= CS 0x3ef0 → ULTIMA.EXE:0x3ef0]) + print DS 0x7988 `\n"I thank thee!"\n
 *         says $.\n` (expansor) + DS 0x79a2 `"Anything else?\n\n` y ret 1.
 *
 * La tabla DS 0x3c10 (fileoff 0x3c20) = 8 fileoffs de SHOPPE.DAT {0x1c1c,0x1c7c,
 * 0x1cda,0x1d3b,0x1d8d,0x1dee,0x1e4e,0x1ebd}, careados por contenido →
 * shoppe.json[139..146] EN ORDEN de slot. SIN rands: el pitch va por slot.
 */
export const MAGIC_SELLER_PITCH_INDEX = [139, 140, 141, 142, 143, 144, 145, 146] as const;
/** Registro del sin-oro del Magic Seller (chunk 0xb6e2 = SHOPPE.DAT 0x1f2b). */
export const MAGIC_SELLER_BROKE_INDEX = 147;

/**
 * CADENA DEL GREMIO (carril cadenas-presentacion) — derivación de la entrada
 * (SHOPPES.OVL **0x4a2**), la lista (**0x3f6**) y `buy_one_guild` (**0x2ba**):
 *
 *   04b1  saludo 0x1b6 (pool 148-151, termina en pregunta) + getkey:
 *         'N'/Space → print DS 0x7928 `No` + despedida 0x202(flag);
 *         'Y' → print DS 0x7916 `Yes\n\n"We sell:\n\n` + lista 0x3f6
 *   040d  lista: DS 0x78d4 `a.........Keys\n` + 0x78e4 `b.........Gems\n` +
 *         0x78f4 `c......Torches\n\n` + 0x7906 `Thy concern?" ` + getkey:
 *         Space/ESC → sale con el flag; 'A'-'C' → eco de la letra en MINÚSCULA
 *         (putchar al|0x20, 0x445) + 0x2ba; 'D' → registro shoppe.json[164]
 *         (`d\n\n"That offer was for a limited time only.\n\n`, fileoff 0x2215,
 *         easter-egg con el eco DENTRO del registro) y RE-LISTA; otra → re-lee.
 *         Tras cada 0x2ba con ret 0/1 → RE-LISTA (0x46e→0x404→0x40d); -1 sale.
 *
 * buy_one_guild 0x2ba(prev, item, charIdx):
 *   02e5  §0.1 precio → g_b118; print DS 0x786e `\n\n"` + PITCH shoppe.json
 *         [160+item] (fileoffs tabla DS 0x3c0a = {0x212d,0x216c,0x21b9}, `%`=
 *         precio) + DS 0x7872 `\n\nInterested?" ` + getkey Y/N (otras re-leen):
 *   'N' → print DS 0x7882 `No\n\n"What else, then?\n\n` y ret prev → re-lista
 *   'Y' → print DS 0x789a `Yes\n`; gold<precio → registro shoppe.json[163]
 *         (`\n"Death comes in many ways to those who cheat the Guild!"\n warns
 *         $.\n`, fileoff 0x21e6) y ret -1 → despedida SILENCIOSA; pago (0x374)
 *         → gold−= + merma 0x19a + repaint + grant (keys+3/gems+4/torches+5,
 *         cap 0x63) + print DS 0x78a0 `\n"Sold!"\nsays $.\n\n"What else, \n`
 *         (expansor $) + género del negociador ([charIdx·0x20+0x55b1]==0x0c →
 *         DS 0x78c0 `m'lady` / DS 0x78c8 `m'lord`) + DS 0x78d0 `?\n\n` y ret 1.
 */
export const GUILD_PITCH_INDEX = [160, 161, 162] as const;
export const GUILD_BROKE_INDEX = 163;
export const GUILD_EASTEREGG_INDEX = 164;

/**
 * CADENA DEL ESTABLO (HorseSeller) — derivación de SHOPPES.OVL **0x7be**:
 *   07cb  escaneo de establo (4 desplazamientos DS 0x3c38/0x3c40, tile ∈
 *         {0x44,0x45,0x05} y celda libre); sin hueco → DS 0x7a48 `The stables
 *         are closed.\n` y SALE (0x9a3) SIN saludo NI despedida
 *   086e  §0.1 precio [town·2+DS 0x3c30] → g_b118; SALUDO 0x1b6 (@0x8be, pool
 *         92-95, termina en pregunta) + getkey: 'N'/Space → print DS 0x7ab2
 *         `No` → despedida 0x202(0); 'Y' → print DS 0x7a62 `Yes\n\n"` + PITCH
 *         shoppe.json[104] (fileoff 0x1643 vía 0x17a, `%`=precio) + DS 0x7a6a
 *         `\n\nDeal?" ` + getkey Y/N en bucle (otras re-leen):
 *   'N' → print DS 0x7a74 `No` → despedida 0x202(0)
 *   'Y' → print DS 0x7a78 `Yes!`; gold<precio → DS 0x7a7e `\n\n"Thou couldst
 *         not afford to ` + DS 0x7a9e `feed it!"\nyells $.\n` (expansor) →
 *         despedida arg=-1 (SILENCIO); pago (0x94a) → gold−= + merma 0x19a
 *         (0x951) + spawn del caballo (tile 0x10) + repaint → despedida 0x202(1).
 */
export const HORSE_PITCH_INDEX = 104;

/**
 * Registro «charity cases» del CURANDERO — SHOPPES.OVL 0x14ce `call 0x17a
 * (fileoff 0x23ab)` → shoppe.json[173] (`\n\n"I am truly sorry, but we cannot
 * accept charity cases."\nsays $.`). Ver la derivación completa del flujo del
 * curandero en shop-console.ts (entrada 0x14f8 + picker 0x137c + pago 0x146a).
 */
export const HEALER_SORRY_INDEX = 173;

/**
 * Registro «sin fondos» del PICK UP de la posada — SHOPPES3.OVL 0x0799
 * `mov ax,0x275a / push / call 0xffff9dd6`. `0x9dd6` NO es un puntero DS: con la base
 * de near-call de SHOPPES3 (0xE1E0) resuelve al stub del kernel 0x7FB6 →
 * `SHOPPES.OVL:0x017a` = `print_shoppe(fileoff)`, que hace seek+read de 0x5DC bytes
 * sobre SHOPPE.DAT y los imprime. O sea `0x275a` es un **file offset**, y el
 * registro que empieza ahí es el índice **193**: `Unfortunately, thou dost not
 * possess the necessary funds!\nGUARDS!"\nsays $.` (expansor `$`).
 *
 * CONTROL del mapeo offset→índice (barrido de SHOPPE.DAT por registros terminados en
 * NUL, 195 = los 195 de `shoppe.json`): reproduce los DOS offsets ya curados en este
 * fichero — `HORSE_PITCH_INDEX` 104 → 0x1643 y `HEALER_SORRY_INDEX` 173 → 0x23AB.
 *
 * ⚠ El port emitía aquí `"Thou hast not the gold!"`, que **no está en el binario**.
 * Y la comilla de cierre del registro la abre el mensaje anterior (`innPickupPay`,
 * DS 0x4fe1, que acaba en `\n\n"`) — el binario imprime el precio ANTES de mirar el
 * oro (0x0789 precede a 0x0793). Familia multi-mensaje de #145.
 */
export const INN_PICKUP_BROKE_INDEX = 193;

/**
 * Palabra de parte-del-día para `@` (tabla DATA.OVL 0x7836; umbrales SHOPPES
 * 0x00d8-0x00fa sobre g_hour 0x587f). En idioma ≠ en, el call-site la pasa por t().
 */
export function partOfDayWord(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Sustitución de placeholders del expansor de SHOPPE.DAT (SHOPPES 0x005b):
 *  `$`=tendero, `#`=tienda, `@`=parte del día (ya resuelta/traducida), y para las
 *  ofertas de venta del herrero (0x0e76) `%`=precio (itoa de g_shop_accum, expansor
 *  @0x00fc), `^`=cantidad (itoa de [0xb11a], expansor @0x0114 — la usa el pitch de
 *  reactivos 0x502) y `&`=nombre del ítem ([0xab00], @0x0122) — opcionales: sólo se
 *  sustituyen si el call-site los pasa (los saludos/despedidas no los llevan). */
export function expandShoppeTemplate(
  template: string,
  subst: {
    keeper: string; shop: string; day: string;
    price?: string; item?: string; qty?: string; place?: string;
  },
): string {
  let out = template;
  // `&`/`%`/`^`/`*` ANTES que `$`/`#`/`@`: un nombre de ítem jamás contiene placeholders,
  // pero el orden calca el expansor (que resuelve cada código al vuelo, sin re-scan).
  if (subst.item !== undefined) out = out.replaceAll("&", subst.item);
  if (subst.price !== undefined) out = out.replaceAll("%", subst.price);
  if (subst.qty !== undefined) out = out.replaceAll("^", subst.qty);
  // `*` = 0x2a → [DS 0xAC62], el LUGAR del chisme. Sexta ranura de la familia de
  // tokens (§50.1 de asm-shoppes-acta, que la dejó explícitamente sin comprobar en
  // el clon); su ÚNICO escritor en los 28 .asm es la fila del rumor (#320).
  if (subst.place !== undefined) out = out.replaceAll("*", subst.place);
  return out
    .replaceAll("$", subst.keeper)
    .replaceAll("#", subst.shop)
    .replaceAll("@", subst.day);
}

/**
 * ASTILLERO (F2-T3 espejo) — registros SHOPPE.DAT del flujo de venta SHOPPES2
 * 0x08a8, mapeados ptr→índice por orden monótono del buffer (mismo método que las
 * tablas de saludo/despedida; testigo AD Ep01 «The Oaken Oar» casa 117/118/119/126):
 *  0x18eb→119 menú «We sell ocean-going Frigates…» (emisión 0x8c5)
 *  0x183e→117 pitch fragata «These stout-hearted vessels…For % gold…» (0x982)
 *  0x188c→118 pitch skiff «Skiffs allow thee…Ours cost % gp each.» (0xa1d)
 *  0x1a50→126 «\n\nWilt thou\ntake it?" » (0x989/0xa24)
 *  0x198e→122 «What? Cheat me, will ye? OUT!» (pago sin oro, helper 0x7e2@0x7ed)
 *  0x19ab→123 «Sold! Thou canst take delivery at the docks…» (entrega 0x80e@0x81a)
 *  0x19da→124 «\n\nWill there be anything else, » (0x84c; + sir/milady + '?" ')
 * Sin cablear (flota existente, g_ship_flags 0x6605 sin estado vivo — banco):
 *  0x19f2→125 reemplazo con fragata · 0x193b→120 skiff-a-bordo · 0x195f→121 2º skiff.
 */
export const SHIP_MENU_INDEX = 119;
export const SHIP_PITCH_FRIGATE_INDEX = 117;
export const SHIP_PITCH_SKIFF_INDEX = 118;
export const SHIP_TAKE_INDEX = 126;
export const SHIP_CHEAT_INDEX = 122;
export const SHIP_SOLD_INDEX = 123;
export const SHIP_ELSE_INDEX = 124;

/**
 * TABERNA (F2-T10 espejo) — el menú NO es una string fija: es un REGISTRO
 * SHOPPE.DAT por SUBTIPO de taberna, con TECLAS por subtipo (SHOPPES2 0x066c):
 *  - subtipo = DS 0x4d4c[townIndex Barkeeper] (bd16 @0x676): [0,0,0,2,3,1,0,2,0,0]
 *  - menú inicial = ptr [DS 0x4d56 + sub·2] (@0x6b9): 0xf09/0xf5a/0xf9e/0xfdf →
 *    shoppe.json 69..72 («What'll it be… roast Mutton, a tankard of Ale, or
 *    Rations…» / Wines-Cheese / Rum-Boar / Stout-Fruits-Provisions)
 *  - menú de RE-VISITA = ptr [DS 0x4d5e + sub·2] (@0x7c7): 0x1042/0x109a/0x10ea/
 *    0x1146 → shoppe.json 73..76 («Shall I bring thee more Ale or roast Mutton,
 *    or wouldst thou rather just Chat?…»)
 *  - teclas por subtipo (columnas DS 0x4c1e/0x4c24/0x4c2a/0x4c30 @0x6fa-0x750):
 *    ronda M/C/B/F · vino A/W/R/S · raciones R/·/·/P (subtipos 1-2 SIN raciones)
 *    · chat C/T/H/A (gated a [0xbd18]≠0 = ya servido, 0x756).
 * El testigo (aulddragon P04, Tika/Wayfarer = Britain, subtipo 0) casa 69+73.
 */
/**
 * Subtipo por taberna — `DS 0x4d4c[townIndex Barkeeper]` (0x676 lo carga en `bd16`).
 *
 * 🔴 SON NUEVE, no diez. Este array llevaba una DÉCIMA entrada que el binario no
 * tiene como taberna: la lista de tabernas `DS 0x23da` son 9 ciudades
 * (`1 2 3 4 8 19 22 24 30`, y a continuación bytes 0 de relleno), así que
 * `shopTownIndex("Barkeeper", …)` sólo puede devolver −1..8 y la entrada 9 era
 * INALCANZABLE. No cambiaba ninguna conducta —por eso duró—, pero sí el
 * DENOMINADOR: contando el array salían «10 tabernas» y contando la tabla de
 * ciudades salen 9. Con el subtipo 1 apareciendo UNA vez (índice 5 → ciudad 19),
 * la cifra de la carta de vinos es **1 de 9** (y 8 con ronda de la casa), no
 * «1 de 10». Verificado leyendo DATA.OVL: lista de tabernas y tabla de subtipos.
 */
export const TAVERN_SUBTYPE = [0, 0, 0, 2, 3, 1, 0, 2, 0] as const;
export const TAVERN_MENU_INDEX = [69, 70, 71, 72] as const;
export const TAVERN_MENU_REVISIT_INDEX = [73, 74, 75, 76] as const;
export const TAVERN_KEYS = [
  { round: "m", wine: "a", rations: "r", chat: "c" },
  { round: "c", wine: "w", rations: "", chat: "t" },
  { round: "b", wine: "r", rations: "", chat: "h" },
  { round: "f", wine: "s", rations: "p", chat: "a" },
] as const;
/**
 * ★ ÚNICO subtipo con CARTA DE VINOS (#21). La columna `wine` de arriba es la letra
 * de la opción 2 leída de `DS 0x4c24[subtipo]` — `a`(Ale) `w`(Wines) `r`(Rum)
 * `s`(Stout)—, y `SHOPPES2 0x027c` la compara contra `0x57` = `'W'`: sólo entonces
 * hay lista de seis vinos. En los otros tres subtipos el mismo camino cae en 0x0372
 * y sirve una RONDA DE LA CASA (1 pieza de oro por miembro vivo, facturada con la
 * frase de la cuenta). Con `TAVERN_SUBTYPE` (9 entradas, ver arriba) el 1 aparece
 * UNA vez ⇒ **1 taberna con carta y 8 con ronda**, sobre las 9 del juego.
 */
export const TAVERN_SUBTYPE_WINE = 1;
/**
 * Pitch de raciones: rand(0,6) del stream VIVO (wrapper 0x3eb2 @0x3fb) sobre la
 * tabla ptr DS 0x4c66 → shoppe.json 77..83 (% = precio con haggle). El testigo
 * P04 casa el 79 («We buy our dried beef in large quantities…25 servings for %
 * gold!»).
 */
export const TAVERN_RATIONS_PITCH_INDEX = [77, 78, 79, 80, 81, 82, 83] as const;
/** «"I will give thee some table scraps! Now go!"\norders $.\n» — sin oro NI comida (<3), ptr 0x143f @0x49f. */
export const TAVERN_SCRAPS_INDEX = 90;
/**
 * «"Well! Our meagre stock must not be good enough for thee!"» — RETIRARSE de la carta
 * de vinos con ESPACIO (#325). SHOPPES2 0x02e9 empuja el ptr `0x1413` al impresor de
 * registros (0xffff9dd6) y devuelve **2**: el cliente se fue sin pedir, así que el
 * epílogo NO marca `[0xbd18]` — el Chat sigue cerrado y la despedida sale del pool
 * «sin compra». Es el ÚNICO sitio del que sale el retorno 2 de esta fila.
 * Índice 89 de los 195 registros de SHOPPE.DAT (el 90 es el de las sobras, arriba).
 */
export const TAVERN_MEAGRE_INDEX = 89;
