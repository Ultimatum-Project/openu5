# ACTA — BOLSA #40: la poda EJECUTADA y una premisa que era FALSA

> Carril `bolsas-tickets`, rama **`re/bolsas-tickets`**, base main **`cc4a3b8a`**.
> Origen: `gold-string-36-acta.md` §3 y `gold-string-barrido.md`.

---

## 0. VEREDICTO

| tarjeta | veredicto |
|---|---|
| **Poda de `buyProvisions`** | **PROCEDE — y EJECUTADA.** El acta decía la verdad, y se verifica por CENSO de globales, no sólo por leer dos rutinas |
| **Los 2 rechazos de `sellEquipment` «sin transcripción»** | 🔴 **PREMISA FALSA: la transcripción YA EXISTE, y completa.** Y al comprobar por qué había duda salió algo mayor: **una divergencia de conducta VIVA** declarada como «esquina sin ruta real» |

---

## 1. Poda de `buyProvisions` — EJECUTADA

### 1.1 Lo que la hace procedente no es la lectura de dos rutinas: es el CENSO

`gold-string-36-acta.md` dice que no hay mercader de provisiones y que las dos mercancías
tienen vía propia. Verificado, y **ampliado al censo de las dos globales** sobre los 28
overlays — que es lo que convierte «no lo he visto» en «no existe»:

| global | escritores en contexto de TIENDA | los demás escritores |
|---|---|---|
| `g_food` (DS 0x57a8) | `SHOPPES2.OVL 0x0453,` — `add_capped(+25/unidad, tope 0x270f)` vía `0x5d34` | `TALK.OVL 0x0682,` (dar, ±1) · `TALK.OVL 0x120b,` (resta al dar) · `SJOG.OVL 0x152b,` (loot) · `BLCKTHRN.OVL 0x0c47,` (`mov word ptr [g_food], 0x3f`, la cárcel) |
| antorchas (DS 0x57ae) | `SHOPPES.OVL 0x03c2,` — lote FIJO **+5**, cap 99 | ídem familia de dar/loot |

**Ni `SHOPPES3.OVL` ni `TOWN.OVL` tocan ninguna de las dos: cero referencias.**

★ Y el criterio decisivo, que el acta de origen no formula así: **ninguna rutina del
binario suma una cantidad LIBRE por un precio LIBRE.** Las tres vías reales son de lote
FIJO (+25/unidad, +5, +1 por miembro). La firma `buyProvisions(state, kind, qty, price)`
**no calcaba nada** — no es que estuviera desconectada, es que no tenía original.

Censo de consumidores: **cero llamadas en `game/src`**; sólo tests.

### 1.2 Lo ejecutado

- `game/src/core/shops/shops.ts`: fuera `ProvisionKind` + docblock + cuerpo (33 líneas), y
  fuera el `import { addByteCapped, addWordCapped }` que quedaba **muerto** (sus dos únicos
  usos eran los de la función; dejarlo habría saltado en lint).
  En su lugar queda un comentario con el CENSO y las citas, para que la poda no se
  reproponga a ciegas ni se revierta por olvido.
- Tests retirados: `shops.test.ts` (3 `it` + import), `gold-string-36.test.ts` (1 `it` +
  import). Eran los 4 que el acta anunciaba.
- `game/tests/comilla-literal.test.ts`: la entrada `"Anything else?"` del mapa
  `ADJUDICADOS` citaba «shops.ts:712 buyProvisions». El mapa está indexado **por TEXTO**,
  no por `fichero:línea`, así que **la clave sobrevive** (la sigue produciendo
  `buyRations`) — pero la prosa quedaba mintiendo por partida doble (la función ya no
  existe, y el `:712` era rancio: estaba en `:759`). Actualizada.

### 1.3 Verificación

```
npx tsc --noEmit                                                   EXIT=0
vitest shops.test.ts + gold-string-36.test.ts + comilla-literal    72 passed
```

### 1.4 Un aviso para el que lea `docs/auditorias/auditoria-general-30-07.md:204`

Esa línea lista `buyProvisions` entre «los 15 refutados que no deben re-proponerse». **No
contradice esta poda**: el motivo anotado allí es *«los caps viven en `counters.ts` y sí
gobiernan las compras»*, que refuta la tesis «los caps son código muerto» — otra cosa. Lo
dejo escrito porque el próximo que cruce las dos líneas por el NOMBRE llegará a la
conclusión contraria (`ledger-cita-por-numero-de-tarjeta`, versión por nombre de función).

---

## 2. 🔴 `sellEquipment`: la premisa de la tarjeta es FALSA

La tarjeta pide *«leer el ASM, transcribir y sellar»* los 2 rechazos «sin transcripción».
**Ya estaban transcritos, en dos sitios independientes**: `shoppe-greetings.ts:167-202`
(instrucción a instrucción, con ambas cadenas, offsets y retorno) y `frontier.json:13619`.
Lo que sí sigue vivo es otra cosa: `shops.ts` devuelve dos `message` **fabricados**, y
`approved-strings.json` los tiene clasificados `[C] «texto sin transcripción»` —
**clasificación RANCIA**.

### 2.1 Rechazo 1 — munición usada. `SHOPPES.OVL 0x0e76,` entrada, `0x0e7d,` guarda

```
0e7d: 837e041b          cmp word ptr [bp + 4], 0x1b
0e81: 7406              je 0xe89
0e83: 837e041d          cmp word ptr [bp + 4], 0x1d
0e87: 750d              jne 0xe96
0e89: b8327d            mov ax, 0x7d32
0e8d: e896f1            call 0x26          ; EXPANSOR ($ = tendero)
0e90: b80100            mov ax, 1          ; ★ RET 1
0e93: e9c700            jmp 0xf5d          ; epílogo directo: sin precio ni tirada
```

DS **0x7d32** (fileoff 0x7d42) = `\n\n"We don't deal in used ammunition!"\ngrowls $.\n`.
`AX = 1` es el ÚNICO retorno no-cero de la rutina, y el llamador lo usa para **suprimir el
epílogo Good-bye entero** (`0x126c,`). **La UI ya lo calca** (`shop-console.ts:1617`), con
test — el fabricado de `shops.ts` es inalcanzable.

### 2.2 Rechazo 2 — `0x0ea2,`. ★ Y NO es «sin stock»

```
0e96: b8647d mov ax, 0x7d64 / 0e9a: e82367 call 0x75c0   ; se imprime SIEMPRE, ANTES de la guarda
0e9d: 8b7604 mov si, [bp+4] / 0ea0: d1e6 shl si, 1
0ea2: 83bc823a00        cmp word ptr [si + 0x3a82], 0    ; ★ PRECIO BASE == 0
0ea7: 7503 jne 0xeac / 0ea9: e9a800 jmp 0xf54
0f54: b88c7d mov ax, 0x7d8c / 0f58: e8cbf0 call 0x26 / 0f5b: 2bc0 sub ax, ax   ; RET 0
```

Emisión real = DS 0x7d64 + DS 0x7d8c = `\n\n"That, I cannot buy from thee."\nsays $.`

**Identidad de la tabla, comprobada** (el paso barato que #217 §11.1 dejó por escrito):
`0x3a82` aparece **exactamente 3 veces** en todo `SHOPPES.OVL` — `0x09be,` (precio de
COMPRA), `0x0ea2,` (esta guarda) y `0x0ebf,` (`mul`, precio de VENTA). Es una tabla de
WORDs indexada `item*2`. **El stock vive en otro sitio y es de BYTEs**
(`0x0f43,` `add ax, 0x57c0` + `sub_byte`). No son la misma cosa.

### 2.3 ★ Lo que de verdad estaba escondido en esta tarjeta

**(a) El port implementa una guarda que NO es la del binario.** `shops.ts` cita `0x0EA2` en
su docblock y a continuación comprueba **stock** (`equipmentQuantities <= 0`), no precio
base. Y con su firma actual **no puede** implementar la del binario: recibe `price` ya
calculado, y `price` nunca es 0 (el `0x0ed6, inc ax` lo deja en ≥1 aun con base 0).

**(b) El binario NO tiene guarda de stock ahí, y no la necesita**: el listador
(`0x0c58,`/`0x0c80,`) ya filtra por cantidad (`0x0c61,`). El `<= 0` del port es defensa
propia, no calco.

**(c) 🔴 «Esquina sin ruta real» es FALSO.** `shop-console.ts:907` declara que la
divergencia sólo se daría «si TODO el equipo poseído fuese invendible». No: `sellableIds()`
**oculta la fila** cuando `basePrices[id] <= 0`, mientras el binario **la lista y contesta
con DS 0x7d8c**. Hay **7 ítems con base 0** en la tabla real: Jewel Shield (0x08), Mystic
Armour (0x0f), Sword of Chaos (0x23), Glass Sword (0x27), Jeweled Sword (0x28), Mystic
Sword (0x29), Ankh (0x2f). Basta llevar una Glass Sword y un puñal para entrar en la rama.
**Es divergencia de conducta VIVA, no una esquina.**

### 2.4 ★ EJECUTADO (#57, ruling del lead: «es DERIVACIÓN, no política»)

El lead resolvió con el criterio madre: **si el binario lista los 7 ítems, el port debe
listarlos**. Ejecutado, y el aviso que traía el ruling —*«calca el FLUJO ENTERO, no sólo la
lista»*— resultó ser lo que más rendía. Flujo completo de `sell_one_item`, leído entero:

```
0e7d  guarda munición 0x1b/0x1d  -> DS 0x7d32, RET 1   (la sesión CIERRA)
0e96  print DS 0x7d64 `\n\n"`                          (ANTES de la guarda siguiente)
0ea2  guarda base==0             -> DS 0x7d8c, RET 0   (la sesión SIGUE)
0eac  precio = (3·INT·base)/100 + 1        (0x6110 __ldiv, 0x0ed6 inc ax)
0eec  rand(0,7) -> frase de regateo
0f05  print DS 0x7d68 `\n\nDeal?" `
0f0c  getkey Y/N en bucle
0f2a  'Y' -> DS 0x7d76 + add_word_capped(g_gold, precio, 0x270f) + sub_byte(qty)
```

⇒ Tres cosas que sólo se ven leyendo el flujo y no la lista:
1. **NO hay «How much?» en la venta** (esa pregunta es del Mix y de las raciones). El lead
   preguntaba por ella: no existe en este camino.
2. **La guarda de base 0 va ANTES del precio y ANTES del `rand(0,7)`** ⇒ ese camino **no
   consume tirada**. Un arreglo que sólo añadiera la fila y dejara el rechazo después del
   rand habría desincronizado el stream.
3. ★★ **Los dos rechazos NO son simétricos**: munición devuelve **1** y CIERRA la sesión;
   base 0 devuelve **0** y la sesión **SIGUE**, re-listando como la `'N'`. Es la diferencia
   observable que distingue las dos ramas, y es lo que fija el control del test.

**Lo aplicado**: `sellableIds()` deja de filtrar por precio y filtra sólo por CANTIDAD
(calco de `0x0c61,`); `pickSell` gana la guarda de base 0 **en su posición del binario**
(tras la de munición, tras la comilla de apertura, antes del precio) y sale por
`afterDeal()`, que es el camino del ret 0. Cadena nueva `SHOP_UI.sellCannotBuy` = DS 0x7d8c.

**Failing-first, medido**: `expected [ 'Lg. Shield' ] to have a length of 2 but got 1` — la
fila de la Glass Sword no llegaba a la ventana. El arnés no capturaba las filas del picker
(las tiraba en `_rows`), así que **la población de la lista no era medible**: se extendió
para capturarlas, que es la mitad del arreglo.

**Erratas de prosa corregidas, las dos que sostenían el hueco**: `shop-console.ts` decía
«esquina sin ruta real … si TODO el equipo poseído fuese invendible» (falso: basta llevar
UNO), y `shops.ts` atribuía su guarda de STOCK a la del PRECIO BASE. No son la misma cosa: la de
precio, 0x0ea2, compara el **precio base** (`[si + 0x3a82]`, WORDs, `item*2`) y el stock vive en
`0x57c0` como BYTEs. El binario **no tiene guarda de stock** en `sell_one_item` porque el
listador ya filtra por cantidad; el `<= 0` del port queda como **defensa propia declarada**,
no como calco — y por eso NO hubo que tocar el «aserto deliberado» de `shops.test.ts`, que
sigue verde: ejercita el núcleo por una vía que el binario no alcanza.

### 2.5 Por qué NO se arregló en la primera pasada

Cambiar `sellableIds()` para listar los base-0 **cambia conducta de UI** y arrastra una
decisión de política: quitar además el `<= 0` de `shops.ts` pondría rojo
`shops.test.ts:417` («sin stock … `.ok === false`»), que es un aserto deliberado. Eso es
una tarjeta con failing-first propio, no un residuo de bolsa. **Queda levantada, con el
test ya diseñado** (arnés `startSell()` de `shop-farewell.test.ts`, `basePrices` con
`[0x27]=0`, y el aserto que hoy FALLA: la lista tiene 2 filas, no 1).

Higiene documental que arrastra, también sin tocar: `shop-console.ts:1639` dice «siguen sin
transcripción del binario» y es falso; `approved-strings.json:381`/`:629` piden
reclasificación de `[C]` a fabricación-con-hermano-fiel-identificado.

## 3. Lo que este acta NO hace

- **No cambia conducta de venta** (§2.4): la divergencia queda declarada con su población
  (7 ítems), su mecanismo (`sellableIds()`) y su test diseñado.
- **No reclasifica** `approved-strings.json`: tocar el fixture sin el arreglo de conducta
  sería mover la etiqueta y dejar el hecho.
- ~~**No borra** los `message` fabricados de `shops.ts`~~ → **HECHO** (§2.6), tras el ruling
  del lead sobre #57.

## 2.6 Residuo CERRADO: los dos `message` fabricados y sus etiquetas rancias

Los dos rechazos de `sellEquipment` devolvían texto FABRICADO y `approved-strings.json` los
tenía clasificados —los dos, con la misma frase— como
`[C] re/notes/shops.md — línea de mercader (mecánica [D], texto sin transcripción)`.
Rancio en los dos casos, y por motivos DISTINTOS:

| literal | por qué la etiqueta mentía |
|---|---|
| `"I cannot buy that!"` | **sí hay transcripción**: la frase real es DS 0x7d32, y la emite el call-site (`pickSell`, gate 0x0e7d). El literal del núcleo era fabricación, y su rama es además INALCANZABLE desde la UI |
| `"Thou hast none to sell!"` | más fuerte: **el binario no tiene esta guarda**, así que no hay frase que transcribir. El listador (`0x0c61,`) hace la rama imposible |

⇒ los dos `message` pasan a **`""`** (patrón de #36) con su cita escrita al lado, y sus
entradas salen del manifiesto (873 → 871) y del corpus `es.json` (10 líneas, edición
quirúrgica). Ningún test asertaba sobre ellos —sólo sobre `.ok`—, así que la poda no movió
un solo verde: **98 passed** en los cuatro ficheros que los tocaban.

⚠ Corregida también la prosa de `shop-console.ts`, que decía que los dos rechazos «siguen
sin transcripción del binario» **y** atribuía el segundo a la guarda de precio — dos
erratas en una sola oración: la guarda de PRECIO BASE, 0x0ea2, ya está calcada en
`pickSell` por #57, y no es la de stock.
