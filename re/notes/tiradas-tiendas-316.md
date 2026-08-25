# Las 17 tiradas de RNG de las tiendas (#316) — censo re-derivado y adjudicación sitio a sitio

Ficha #316: «el binario tira 17 veces en las tiendas y el port CERO» (censo del carril de
#315, citado en su merge `be375c81`; alcance fijado por el addendum del acta del rumor,
commit `f0bbcdd2`: UNA de 17 confirmada —la del rumor, #320— y dieciséis NI confirmadas NI
refutadas). Esta acta re-deriva la población entera con instrumento, adjudica las 16
restantes una a una contra el binario Y contra el port, y cierra la ficha.

Un carril anterior (`medicion-316`, 17-08) reportó al lead la misma conclusión de conjunto,
pero su informe no dejó acta en el repo; aquí **todo está re-medido**, no citado de oídas
(protocolo de estado MEDIDO). El resultado coincide con aquel informe y queda, por fin,
durable y con citas.

## 1. La población, re-derivada con instrumento (no heredada)

`rand_range` vive en el kernel en `ULTIMA.EXE:0x2092`. Los overlays lo llaman con `call`
NEAR directo (universo CS único, `re/tools/dispatch_table.py` cabecera §2), así que el
censo correcto es `dispatch_table.near_calls_to_kernel(ovl, 0x2092)` — nunca grep del
destino crudo, que lleva el sesgo de banda (`SHOPPES.OVL` banda `0xA290` imprime el call
como `0x7e02`; `SHOPPES2/3` banda `0xE1E0`, como `0x3eb2`).

```
SHOPPES.OVL  → 14 sitios: 0x01ad 0x01c5 0x021a 0x0244 0x0a1f 0x0a8f 0x0b73
                          0x0ef3 0x0f7d 0x121d 0x1280 0x12d4 0x1314 0x1329
SHOPPES2.OVL →  3 sitios: 0x03fc 0x0493 0x063d
SHOPPES3.OVL →  0 sitios
TOTAL: 17 — el cardinal de la ficha, reproducido.
```

Controles del censo:

- **Positivo**: `SHOPPES2:0x063d` es exactamente la tirada del rumor que #320 derivó y
  cerró (`rumor-taberna-320.md §4`) — el instrumento encuentra lo ya acreditado.
- **Anti-verde-hueco**: el mismo instrumento sobre las OTRAS rutinas de RNG del kernel
  (`rand0 0x3aae`, `rand30 0x3abe`, `srand 0x207e`, `rng_seed_from_dos_clock 0x2056`) da
  **cero** sitios en los tres overlays ⇒ el único RNG de las consolas de tienda es
  `rand_range`, y la población de 17 es completa, no una lista escogida.
- `SHOPPES3.OVL` (posada) con 0 sitios es consistente con que el censo original contara 17
  sólo entre `SHOPPES` y `SHOPPES2`.

Cada sitio verificado en el disasm: los 14 de `SHOPPES.OVL` son `call 0x7e02` con sus dos
`push` de rango delante, y los 3 de `SHOPPES2.OVL` son `call 0x3eb2` ídem (orden de push
min→max, ficha #76 re-derivada en el ledger: fila `CAST.OVL:0x05b4`).

## 2. La tabla de las 17, sitio a sitio

Rutinas de `re/ledger/frontier.json` (las 8 implicadas, todas `verified`). Línea del
`.asm` = fichero generado `re/disasm/*.asm`. «Port» = consumidor vivo medido; todos tiran
de `Game.shopGreetingRand` (= `this.rand`, el stream VIVO — `game/src/core/game.ts:4522`)
salvo la merma, que recibe `this.rand` por parámetro (`game.ts:4511`).

| # | sitio (línea .asm) | rutina | tirada | tabla DS | qué elige | port (fichero:línea) | testigo (test) | veredicto |
|---|---|---|---|---|---|---|---|---|
| 1 | `SHOPPES:0x01ad` (196) | `shop_falsehood_gold_theft` | `rand(1,0x40)` | — | merma de oro de la Falsedad, suelo 0 | `core/shops/shops.ts:1267-1272` (`postPurchaseDrain`, gate ANTES del rand) | `merma-live.test.ts:110,146` | REFUTADA |
| 2 | `SHOPPES:0x01c5` (209) | `shop_print_random_greeting` | `rand(0,3)` | `0x3B2A` 2D (`g_shoppe_id2<<3`) | saludo 1-de-4 por tipo | `ui/shop-console.ts:433` | `shop-saludo-selector.test.ts:91,118` | REFUTADA |
| 3 | `SHOPPES:0x021a` (247) | `shop_print_random_farewell` | `rand(0,3)` | `0x3B6A` 2D | despedida 1-de-4, pool SIN compra (arg 0) | `ui/shop-console.ts:2977` (pool por `arg`) | `shop-farewell.test.ts:149` | REFUTADA |
| 4 | `SHOPPES:0x0244` (265) | `shop_print_random_farewell` | `rand(0,3)` | `0x3BAA` 2D | despedida 1-de-4, pool CON compra (arg 1) | `ui/shop-console.ts:2977` (mismo sitio, pool `arg===1`) | `shop-farewell.test.ts:161` | REFUTADA |
| 5 | `SHOPPES:0x0a1f` (1103) | `blacksmith_buy_item` | `rand(0,3)` | `0x3CA6` | pregunta 1-de-4 del pitch | `ui/shop-console.ts:1628` | `shop-buy-flow.test.ts:155` | REFUTADA |
| 6 | `SHOPPES:0x0a8f` (1147) | `blacksmith_buy_item` | `rand(0,3)` | `0x3CAE` | insulto 1-de-4 sin oro | `ui/shop-console.ts:1676` (con pool) y `:1603` (degradación sin pool — ramas EXCLUYENTES, una tirada por evento) | `shop-buy-flow.test.ts:251` · `gold-string-36.test.ts` | REFUTADA |
| 7 | `SHOPPES:0x0b73` (1241) | `blacksmith_list_wares_and_buy` | `rand(0,3)` | `0x3CB6` | pregunta 1-de-4 tras la lista | `ui/shop-console.ts:907` | `shop-buy-flow.test.ts:127` | REFUTADA |
| 8 | `SHOPPES:0x0ef3` (1630) | `blacksmith_sell_item` | `rand(0,7)` | `0x3CBE` (+`0xA65E`) | oferta 1-de-8 de la venta | `ui/shop-console.ts:1766` | `shop-farewell.test.ts:283,296` | REFUTADA |
| 9 | `SHOPPES:0x0f7d` (1692) | `blacksmith_sell_window` | `rand(0,3)` | `0x3D2E` | prompt de apertura de venta | `ui/shop-console.ts:964` | `shop-farewell.test.ts:230` | REFUTADA |
| 10 | `SHOPPES:0x121d` (1973) | `blacksmith_sell_window` | `rand(0,3)` | `0x3D3E` | re-pregunta tras cada venta | `ui/shop-console.ts:1848` | `shop-farewell.test.ts:237` | REFUTADA |
| 11 | `SHOPPES:0x1280` (2011) | `blacksmith_sell_window` | `rand(0,3)` | `0x3D36` | despedida propia del sell-flow | `ui/shop-console.ts:1011` | `shop-farewell.test.ts:251,265` | REFUTADA |
| 12 | `SHOPPES:0x12d4` (2051) | `blacksmith_shop_entry` | `rand(0,1)` | `0x3D46` | pregunta Buy/Sell 1-de-2 | `ui/shop-console.ts:450` (`blacksmithContinue`, tras la pausa de pacing) | `shop-farewell.test.ts:130-145` (aserta `randCalls === [[0,1]]`) | REFUTADA |
| 13 | `SHOPPES:0x1314` (2078) | `blacksmith_shop_entry` | `rand(0,3)` | `0x3D4A` | exclamación 1-de-4 al elegir Buy | `ui/shop-console.ts:871` | `shop-buy-flow.test.ts:115` | REFUTADA |
| 14 | `SHOPPES:0x1329` (2087) | `blacksmith_shop_entry` | `rand(0,3)` | `0x3D52` | presentación 1-de-4 («We have:»…) | `ui/shop-console.ts:872` | `shop-buy-flow.test.ts:115` | REFUTADA |
| 15 | `SHOPPES2:0x03fc` (422) | `tavern_buy_rations` | `rand(0,6)` | `0x4C66` | pitch 1-de-7 de las raciones | `ui/shop-console.ts:2750` | `tavern-flow.test.ts:111` | REFUTADA |
| 16 | `SHOPPES2:0x0493` (482) | `tavern_buy_rations` | `rand(0,1)`+1 | — | limosna de comida (1-2, tope 9999) | `ui/shop-console.ts:2787` | `tavern-flow.test.ts:177` | REFUTADA |
| 17 | `SHOPPES2:0x063d` (657) | `tavern_buy_rumor` | `rand(0,3)` | `0x4D44` | formulación 1-de-4 del rumor | `ui/shop-console.ts:2882` | `shops.test.ts` (`RUMOR_FORM_INDEX`) | **CONFIRMADA** (heredada, #320) |

**Qué significa el veredicto.** Cada «afirmación» de la ficha tiene dos mitades: «el
binario tira aquí» y «el port no». La primera mitad queda CONFIRMADA en los 17 sitios
(columna sitio/tirada/tabla, leída del disasm con los push delante). La segunda es la que
se adjudica: en los dieciséis sitios restantes es **FALSA** — el port consume una tirada
equivalente (mismo rango, mismo punto del flujo, mismo stream vivo) — así que las 16
quedan **REFUTADAS**. La única donde la ficha acertaba era la del rumor (#17), que #320
confirmó y cerró portándola. ⇒ **#316 queda adjudicada entera: 1 CONFIRMADA (y ya
corregida) + 16 REFUTADAS (nada que corregir).**

## 3. Por qué el censo original vio «port CERO» con 16 consumidores vivos

Los dieciséis consumidores existen desde los carriles saludos-shoppe / buy-herrero /
sell-chatter / F2-T10 (fechas en los propios ficheros), es decir, **antes de nacer la
ficha**. El censo del port de #315 no los vio porque miden el consumo buscando al
consumidor directo del stream, y aquí TODOS los sitios de tienda pasan por el wrapper
`shopGreetingRand` (y la merma por `postPurchaseDrain`): la vista filtrada por el patrón
del instrumento leyó lo envuelto como inexistente. Es la clase documentada en la memoria
del proyecto como «la vista filtrada por lo mío lee lo ajeno como inexistente» — la ficha
nació de un instrumento con la población mal delimitada, no de una divergencia del port.

## 4. Paridad de consumo (por qué 16 sitios asm ↔ 15 sitios port no es un desajuste)

- Sitios 3+4 comparten UN sitio del port (`:2977`): en el binario son dos `call` en ramas
  mutuamente excluyentes de `0x0202` (arg 0 → tabla `0x3B6A`; arg 1 → `0x3BAA`; arg fuera
  de {0,1} → silencio SIN tirada). El port hace una tirada y elige la tabla por el mismo
  arg — **mismo consumo: una tirada por despedida impresa, cero en la silenciosa**
  (docblock de `emitFarewell`, `shop-console.ts:2950-2953`, ya lo declaraba).
- Sitio 6 tiene DOS sitios en el port (`:1603`/`:1676`): ramas excluyentes (degradación
  sin pool vs vía con pool) — una tirada por evento en ambas, como el único sitio del asm.
- Todo lo demás es 1↔1. Las degradaciones sin pool/nombres NO consumen (los tests de
  `sin pool` lo asertan), y en el binario ese camino no existe — divergencia sólo
  alcanzable sin assets, ya declarada en los docblocks de cada emisor.

## 5. RNG — ventana

**Cero cambios de código en este cierre** ⇒ ninguna tirada se añade, quita o mueve.
No hay ventana que declarar.

## 6. Lo que esta acta NO cubre

- **No re-lee los cuerpos** de las 8 rutinas: usa las lecturas selladas de
  `asm-shoppes-acta.md` (§§15/19/29/32/33) y `rumor-taberna-320.md`, y verifica en el
  disasm sólo el entorno inmediato de cada `call` (los dos push del rango y la tabla DS
  consumida) — que es lo que la adjudicación necesita.
- **El careo dinámico de conteo por flujo** (sonda sobre `liveRng` contando tiradas por
  interacción completa, port vs derivación) queda como residuo opcional de baja prioridad
  — mismo residuo que declaró el informe de `medicion-316`. Los tests citados asertan
  secuencias exactas de `randCalls` en los flujos del herrero y las despedidas, que es la
  mitad más sensible.
- **El ORDEN global de consumo entre tiendas distintas** no se re-carea aquí: cada flujo
  aserta el suyo y todos comparten `this.rand`.
