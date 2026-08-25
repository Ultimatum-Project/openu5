# Acta #325 — La CARTA DE VINOS de la taberna: derivación completa y cableado

Sujeto: `CS SHOPPES2.OVL 0x0286-0x036f` (la rama `'W'` de la opción 2 de la taberna),
cuerpo leído entero. Cadenas verificadas byte a byte contra `DATA.OVL` con la
convención del repo (`fileoff = DS + 0x10`). Complementa `asm-shoppes-acta.md` §40-42,
que leyó el mismo cuerpo y midió el discriminante `'W'` (#21) pero **no transcribió las
emisiones**: ése es exactamente el hueco que esta acta cierra.

## 1. La premisa de la ficha, corregida en dos puntos

La ficha #325 (del censo `paridad-contenido-censo.md` E08) decía *«cuatro emisiones sin
NINGÚN emisor en `game/src`»*. Medido sobre el árbol de hoy:

1. **Emisor de la CARTA sí había** — `renderWineList()` (`ui/shop-console.ts`) existía y
   se alcanzaba. Lo que no existía era la emisión de **esas cadenas**: imprimía seis
   rótulos COMPUESTOS (`A) Rose — 18 gp`, hechos con `WINE_NAMES` + `winePrice`) y ni
   cabecera, ni trato por género, ni prompt, ni eco de la elección. La ficha acierta en
   el desenlace (el jugador no ve la carta del original) y se queda corta en el
   diagnóstico: no es «falta el emisor», es «hay un emisor que emite otra cosa».
2. **El denominador «9 de 10 tabernas» está RANCIO.** Son **9 tabernas** en total
   (`DS 0x23da` = `1 2 3 4 8 19 22 24 30`) y el subtipo 1 aparece UNA vez, así que la
   cifra viva es **1 con carta y 8 con ronda de la casa**. La corrección ya estaba hecha
   en main (`shoppe-greetings.ts`, `TAVERN_SUBTYPE` de 9 entradas, con su razón escrita);
   la ficha arrastraba el «10» del array con la décima entrada inalcanzable.

## 2. El flujo, instrucción a instrucción

La opción 2 del menú es **la BEBIDA**, no «el vino»: la carta es uno de sus dos
desenlaces (§41 del acta hermana). Orden real:

| dir | qué hace |
|---|---|
| `0x0200` | `putchar([g_shop2_type + DS 0x4c24])` — **eco de la letra de la opción** |
| `0x020a` | gate de borrachera `cmp [g_cups_served], 3` (ANTES del discriminante) |
| `0x027c` | `cmp byte ptr [bx+0x4c24], 0x57` (`'W'`) → carta; si no, `0x0372` ronda de la casa |
| `0x0286` | `DS 0x9b76` `"Our wine list,\n` |
| `0x028d` | `call 0x00ac` — trato por género: ranura 0 (Avatar), `== 0x0b` → `sir`, si no `milady` |
| `0x0290` | `DS 0x9b88` `.\n\n` |
| `0x0294`-`0x02be` | las SEIS líneas de la carta, cadenas ENTERAS |
| `0x02c1` | `DS 0x9bfa` `Thy choice?" ` |
| `0x02c8` | `getkey` |
| `0x02ce` | Espacio → `0x02d2` dos `putchar('\n')` + registro `0x1413` (índice 89) + **ret 2** |
| `0x02f6`/`0x02fc` | fuera de `'A'`..`'F'` → `jb`/`ja 0x02c8` = **vuelve a leer sin re-imprimir** |
| `0x0302`-`0x0319` | eco de la letra + `DS 0x9c08` + trato por género + `putchar('.')` |
| `0x032a` | `cmp word ptr [bx*2 + DS 0x4c48], ax` / `jle 0x352` — compra si precio ≤ oro |
| `0x0330`-`0x034f` | `DS 0x9c20` + nombre (`DS 0xAAFE`) + `'.'` + `'\n'` → **ret 1** = echado |
| `0x035d`-`0x036f` | `sub [g_gold]` · merma `0xffff9dfa` · `inc [g_cups_served]` · `DS 0x9c40` · cola `0x02d2` |

Las seis líneas, verbatim (y la tabla de precios `DS 0x4C48` a su lado):

| DS | cadena | `DS 0x4C48` |
|---|---|---|
| `0x9b8c` | `a) Rose.......18\n` | 18 |
| `0x9b9e` | `b) Claret....192\n` | 192 |
| `0x9bb0` | `c) Sauterne...79\n` | 79 |
| `0x9bc2` | `d) Muscatel...30\n` | 30 |
| `0x9bd4` | `e) Moselle...275\n` | 275 |
| `0x9be6` | `f) Chablis....98\n\n` | 98 |

Son **dos datos distintos del binario** (la cadena lleva el precio dentro con relleno de
puntos; la tabla es la que cobra). Que coincidan lo comprueba un test, no esta tabla.

★ **La carta se lista en minúscula y el gate acepta MAYÚSCULA.** El `cmp` de `0x02f6`/
`0x02fc` es contra `0x41`/`0x46`, o sea el `getkey` (`0x448c`) entrega mayúscula y el
`putchar` del eco (`0x0308`) imprime ese byte. No es una divergencia: es que el rótulo
de la carta y el byte comparado no tienen por qué coincidir en caja.

★ **La cola `0x02d2` es COMPARTIDA** entre el Espacio y el `Enjoy!`: los dos imprimen
dos saltos de línea, y el `cmp [bp-2],0x20` de `0x02e0` es lo único que decide si además
sale el registro 89. Quien porte sólo una de las dos ramas se deja los `\n` de la otra.

## 2-bis. El AVISO DE BORRACHERA (`0x0211`-`0x0260`) — la cuarta emisión

El inventario de la ficha nombra CUATRO cadenas, y la cuarta no es ninguna de las de la
carta: es el aviso de borrachera. Son **CINCO piezas**, todas en el corpus y todas
traducidas, y el clon **no emitía ninguna** — aplicaba el castigo en silencio.

| dir | DS | cadena |
|---|---|---|
| `0x0211` | `0x9b22` | `\n\n"I beg thy\npardon, ` |
| `0x0218` | — | `call 0x00ac` → `sir` / `milady` |
| `0x021b` | `0x9b38` | `,"\nsays ` |
| `0x0222` | `0xAAFE` | el nombre del tendero |
| `0x0229` | `0x9b42` | `.\n"But haven't\nye had enough\nto drink?" ` |
| `0x023a` | `0x9b6c` | `Yes\n\n` — eco de `'Y'` |
| `0x024c` | `0x9b72` | `No!` — eco de `'N'` |

Gate: `cmp word ptr [g_cups_served], 3` / `jne 0x26f` — **exactamente 3**, no «3 o más».
Y está en `0x020a`, o sea **antes** del discriminante `'W'` de `0x027c`: pertenece a la
opción de BEBIDA y cubre la carta Y la ronda de la casa.

Desenlaces:
- **`Y`** → `Yes\n\n` y `sub ax,ax` = **retorno 0**. No sirve, no cobra, no castiga —
  pero **cuenta como servicio**: desbloquea el chat y elige la despedida «con compra».
  Es el hermano del §30.2 del curandero, y el contrapunto exacto del retorno **2** del
  Espacio en la carta, que NO cuenta.
- **`N`** → `No!`, `[g_drunk_timer] = 0x19` (25 turnos), `karma −1` con suelo 0, y
  **continúa** a servir.
- cualquier otra tecla → `jne 0x230`, vuelve a leer (Espacio y ESC incluidos).

🔴 **Y una propiedad DERIVADA que ninguna prueba de este flujo puede respaldar.** El
«`Y` cuenta como servicio» es cierto en el binario (`sub ax,ax` = ret 0) y está
cableado así en el port — pero **es inobservable en el espacio alcanzable**: su única
consecuencia sería marcar `[0xbd18]`, y para llegar al aviso hacen falta TRES servicios
previos que ya lo marcaron. Medido con mutante: cambiar ese `true` por `false`
**sobrevive a la suite entera**. Queda escrito aquí y en el test para que nadie
escriba un aserto que pasaría igual con el código roto — y para que quien encuentre
una vía de alcanzar el contador en 3 sin servicios previos sepa que ahí hay algo que
probar. (Lo que sí se prueba: la rama `Y` no cobra, no castiga y no despliega carta.)

★ **Dónde estaba en el clon, y por qué importaba.** Dentro de `buyWine`, o sea al
COMPRAR, con una COPIA inline en `tavernHouseRound`. Tres consecuencias medidas:
(a) las cinco cadenas no se emitían y el Y/N no existía; (b) retirarse de la carta con
Espacio salía gratis, cuando en 1988 el castigo ya se había aplicado; (c) el gate estaba
duplicado, porque en el binario es UNO. Hoy es `ShopConsole.drinkDrunkGate`, un solo
sitio, y `buyWine` queda como puro tramo de pago.

## 3. RNG — CERO tiradas, sin ventana

Censo de `call` en `0x0286`-`0x037b`: impresor de cadenas (`0x3670`), `putchar`
(`0x34da`), `getkey` (`0x448c`), trato por género (`0x00ac`), impresor de registros
(`0xffff9dd6`) y merma de la Falsedad (`0xffff9dfa`). **Ninguno es `rand_range`.** La
única tirada del vecindario es la de la merma (`rand(1,64)` con Faulinei en el pueblo),
que ya estaba cableada en el port (`drainOnPurchase`) y que este cambio no toca ni
reordena. ⇒ **el cableado NO mueve el stream y no necesita ventana de sellos.**

## 4. Lo que se cambió en el port

- `core/shops/shop-tables.ts` — `WINE_MENU_LINES`, las seis líneas verbatim.
- `core/world/cmd-strings.ts` — `wineListOpen` · `wineListAfterName` · `wineThyChoice` ·
  `wineFineChoice` · `wineCantPay`. Las cuatro traducibles ya estaban en `es.json`; no
  se añade ninguna clave nueva al corpus.
- `core/shops/shoppe-greetings.ts` — `TAVERN_MEAGRE_INDEX = 89`.
- `ui/shop-console.ts` — `honorific()`, `renderWineList()` reescrito, `wineWithdraw()`
  nuevo (Espacio), `pickWine()` con eco + rama de sin-oro fiel, y el eco de la letra de
  la opción 2 en `tavernMenuKey`.

Dos conductas del clon que este cambio CORRIGE, además del texto:

- **El Espacio salía de la taberna.** Caía en el gate global de Espacio/Escape de
  `key()`; en el binario vuelve al «Anything else for thee?» con ret 2.
- **Sin oro te dejaba dentro con una frase fabricada.** `buyWine` devolvía
  `"Thou canst afford only..."` (cero ocurrencias en `DATA.OVL`) y el flujo seguía en la
  taberna; el binario imprime `DS 0x9c20` y **te echa sin despedida** (ret 1).

## 5. Residuos DECLARADOS (medidos aquí, fuera del alcance de #325)

1. **El eco de la letra falta en las opciones 1 y 4.** `0x01d8` (comida, `DS 0x4c1e`) y
   `0x0516` (chat, `DS 0x4c30`) hacen el mismo `putchar` de su letra que `0x0200`, y el
   clon sólo lo hace en raciones (`0x0388`) y —desde este commit— en la bebida. Es una
   clase de 4 con 2 sin portar.
2. **El gate de borrachera está en otro sitio.** El binario lo aplica en `0x020a`, al
   ELEGIR la bebida; el clon lo tiene dentro de `buyWine`, o sea al COMPRAR. Sólo se
   nota retirándose con Espacio teniendo el contador exactamente en 3: el original ya
   habría cobrado el karma −1 y el timer 25, el clon no. Mover el gate obliga a tocar
   `buyWine` y sus dos tests de `shops.test.ts`; se deja fichado en vez de hacerlo de
   paso. (El Y/N interactivo del propio gate sigue sin modelarse, como ya declaraba
   `tavernHouseRound`.)
3. Las seis líneas van **sin traducir**, igual que `WINE_NAMES`: el relleno de puntos es
   tipografía de ancho fijo y no hay entrada en el corpus i18n para ellas.

4. 🔴 **PUNTO CIEGO DE LA GUARDA ANTI-FABRICACIÓN, con su cifra y su contradicción.**
   Las **seis** líneas de la carta son texto que el jugador LEE y salen de `game/src/core/`,
   y `string-manifest.test.ts` **no las ve**: viven en `WINE_MENU_LINES` (shop-tables.ts) y
   se emiten en un bucle sobre la constante IMPORTADA — indirección cross-módulo, que el
   extractor declara fuera de alcance. Medido en las DOS direcciones:
   · sin ellas en el manifiesto → la guarda pasa (no las echa de menos);
   · añadidas a mano → la guarda **enrojece** declarándolas huérfanas (6 entradas «ya no
     existen en el código»), porque el test-espejo exige que el manifiesto sea reflejo
     EXACTO de lo que el extractor ve.
   ⇒ La cabecera del propio test dice «un string así se declara a mano en el manifiesto»
   y **su predicado ejecutable lo prohíbe**. No es una excusa para no cubrirlas: es una
   contradicción entre el flujo documentado y la guarda, y afecta a toda cadena
   user-facing que llegue por constante importada. Se entrega como ficha aparte — tocarlo
   es arquitectura del extractor, ajena a #325.
