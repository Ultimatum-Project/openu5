# CAREO DE PRECIOS DEL ESPEJO — guild −954 / inn −22 / helm +36 (ADJUDICADO 2026-07-25)

Pregunta del carril: el port cobraba **395/gema** donde el LP (aulddragon) pagó **318/gema**
(954 = 3×318) en el guild de New Magincia (Braunam, part05). ¿Fórmula mal calcada (sapo real)
o deriva de instrumento?

## Veredicto: LA FÓRMULA DEL PORT ES EL CALCO EXACTO — deriva de INSTRUMENTO (INT del avatar)

**Fórmula del port** (`game/src/core/shops/shops.ts:55` `shopBuyPrice`):
`compra = base + ⌊base·(100 − 3·INT)/100⌋` (término interno truncado hacia 0, luego +base).

**Derivación** (re/notes/shops.md §0.1, §3):
- `buy_price_adjust` **SHOPPES:0x02D8-0x0318** (`__lmul` 0x61B2 / `__ldiv` 0x6110, DOS pasos).
- Guild: **SHOPPES.OVL:0x04A2 → 0x02BA**, stat = INT del negociador **0x02F4** (`record+0x0E`).
- Tabla `guildPrices` **DS 0x3BEA** (4 words/town): town0 New Magincia = [190 keys, **255 gems**, 12 torches].
- Venta: `sell_one_item` **SHOPPES:0x0E76** → `⌊3·INT·base/100⌋ + 1`.

**Aritmética adjudicadora** (base gems 255):
| INT | precio | quién |
|----|--------|------|
| 15 | 255 + ⌊255·55/100⌋ = 255+140 = **395** | plantilla INIT de la cadena (Min 15/15/15) |
| 25 | 255 + ⌊255·25/100⌋ = 255+63 = **318** | avatar del LP |

**Triangulación del INT del LP = 25** (tres beats independientes, exactos los tres):
1. Gems 318 (arriba).
2. Posada Buccaneer's Den −22: rate 3 (DS 0x4DBC idx5) × party 6 = 18 → 18+⌊18·25/100⌋ = **22**.
3. Venta Leather Helm 12 (Iolo's Bows): base 15 (equipmentBasePrices[0]) → ⌊3·25·15/100⌋+1 = **12**.

Corroboración del corpus: la creación del LP es **conversión de Ultima IV** (part01 OCR
~1460-1530: «Ultima IV», «converted», STR: 25 / DEX: 25, «now 25(30)») ⇒ avatar 25/25/25.
La cadena del espejo bootea con la plantilla INIT (15/15/15) ⇒ el precio difiere por
NEGOCIADOR, no por fórmula. **No hay sapo.**

## Instrumento aplicado (rama e2e/espejo-tour)

- Op de arnés **`seedInt`** (clase seedGold): siembra `characters[0].intelligence = 25` antes
  de los beats de transacción anclados (part04 venta, part05 guild). Los checkpoints partNN
  posteriores heredan INT 25 (más fiel al LP).
- Resultado en cadena (SOFT, 2026-07-25): guild **−954 EXACTO** (gems 0→12, lote +4×3 fiel,
  0x0381) y venta Gwenneth **+36 EXACTO** (3×12). `ledgerDeltas match:true` en ambos.
- Gwenneth ADJUDICADA: **Blacksmith de Britain** (npcs.json loc2 slot1 `dialogNumber` 129 =
  0x81); el «d133=MagicSeller» del relevo anterior era una mala lectura.
- La hipótesis «la party ya lleva gemas y el guild rechaza» quedó **FALSIFICADA** (checkpoint
  part04: gems=0). La causa real del delta-0 eran MODOS VIVOS dejados por `typed` de
  conversaciones no-conectadas (getstring de Yell, picker de Ready) que se tragaban la `t`
  del resync: blindado con Escape×2 pre-Talk + verificación `__u5test.shopOpen()` + no
  fabricar teclas de la transacción si la tienda no engancha.

## Recomendación al lead (no aplicada)

Si se quiere paridad de stats de TODA la cadena (combate incluido), sembrar 25/25/25 en el
boot de part01 (junto a `normalizeAvatarName`) y re-correr la cadena entera; hoy el seed es
por-beat (mínimo cambio, deltas verdes).
