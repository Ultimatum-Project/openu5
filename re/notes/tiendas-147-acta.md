# ACTA — tarea #147, FASE DE FIX: las 3 tiendas dejan de fabricar

Carril `tiendas-147`, rama `fix/tiendas-147` (retenida; aterriza el lead).
Precedente: el CENSO de #147 y el careo de `'\nEnjoy!"'` del carril `enjoy-146`.

## 0. Qué se arregla y qué NO

ARREGLADO (cadenas, con derivación propia de cuerpo entero):
- `buyWine` → DS 0x9c40 `'\nEnjoy!"'`
- `buyReagent` → DS 0x7988 en éxito, DS 0x792c en tope
- `buyGuildItem` → DS 0x78a0 `'\n"Sold!"\nsays $.\n\n"What else, \n'` (TERCERA frase)
- «Here thou art!» RETIRADA de `es.json` y de `approved-strings.json`

DECLARADO Y NO ARREGLADO (mecánica, tarjeta propia — ver §4):
- el gate de tope de `buyGuildItem` NO EXISTE en el binario
- «Thou canst carry no more!» es una SEGUNDA fabricación, viva aún en 2 sitios

## 1. Método y control de la medida

Los cuerpos se leyeron enteros del disasm, no por ventanas:

| Overlay | Rango | Flujo |
|---|---|---|
| SHOPPES.OVL | 0x02ba-0x03d9 | compra de un lote del gremio |
| SHOPPES.OVL | 0x03f6-0x0498 | listado y despacho de letra del gremio |
| SHOPPES.OVL | 0x04a2-0x04ff | entrada y gate del gremio |
| SHOPPES.OVL | 0x0546-0x064b | compra de reactivos |
| SHOPPES2.OVL | 0x0340-0x0378 | compra de una copa |

Cada cadena se verificó **byte a byte contra `DATA.OVL`**, no contra el port. El sesgo
`fileoff = DS + 0x10` no se supuso: se MIDIÓ sobre un ancla única (`\n"I thank thee!"…`)
y luego se comprobó que las otras siete caen en `DS + 0x10` **exacto** y con
**una sola ocurrencia** cada una. Control negativo dentro del mismo barrido:
`Here thou art!` da **0 ocurrencias** en DATA.OVL — la misma búsqueda que localiza las
ocho localiza cero de la fabricada, así que el cero no es del instrumento.

Cross-check independiente: las tres cadenas que cableé YA tenían entrada `[D]` en
`approved-strings.json` con los offsets `fileoff 0x7998 / 0x793c / 0x78b0`, que
coinciden con mis medidas hechas sin mirarlas.

## 2. Las tres derivaciones

### (a) VINO — `SHOPPES2` 0x0352-0x036c
```
0x035d  sub  [g_gold], ax        ; cobro
0x0361  call 0x9dfa              ; merma post-compra
0x0364  inc  [0xbd20]            ; g_cups_served
0x0368  mov  ax, 0x9c40 / push / call 0x3670   ; ← impresor
```
`DS 0x9c40` = `'\nEnjoy!"'` (file 0x9c50). ÚNICO emisor: los otros tres call-sites que
la historia citaba (ENDGAME 0x0783, SHOPPES 0x140e/0x1422) empujan 0x9c40 como NÚMERO
40000 al barrido de sonido 0x7f02 — hallazgo de `enjoy-146`, aquí solo reutilizado.

### (b) HERBOLARIO — `SHOPPES` 0x0546-0x0644
```
0x0546  cmp byte [bx+0x5850], 0x63   ; TOPE 99 — el gate SÍ existe
0x0550  push 0x792c / call 0x75c0    ; '\n\n"Thou canst not carry any more!"\n\n'
0x0557  call 0x83dc                  ; getkey de pausa, y RET sin cobrar
...
0x061c  sub [g_gold] / call 0x19a / call 0x8670
0x0637  call 0x9c60                  ; add_byte_capped(&reagents[i], qty, 0x63)
0x063d  push 0x7988 / call 0x26      ; ← expansor de `$`
0x0644  push 0x79a2 / call 0x75c0    ; '"Anything else?\n\n'
```
El mensaje de tope del port («Thou canst carry no more!») **no es una re-puntuación**
de la cadena real: es otra oración (*canst NOT carry ANY more*).

### (c) GREMIO — `SHOPPES` 0x02ba-0x03d9 · ★ la única derivación nueva
```
0x0361  cmp [g_gold], ax             ; ÚNICO rechazo previo al cobro
0x0374  sub [g_gold], ax / call 0x19a / call 0x8670
0x0381  switch(item): 0→(0x57ac,+3) 1→(0x57ad,+4) 2→(0x57ae,+5), todos call 0x9c60 tope 0x63
0x03a6  push 0x78a0 / call 0x26      ; ← expansor de `$`: '\n"Sold!"\nsays $.\n\n"What else, \n'
0x03ad  cmp byte [di], 0xc → 0x78c0 `m'lady` : 0x78c8 `m'lord`
0x03d3  push 0x78d0 / call 0x75c0    ; '?\n\n'
```
La predicción del encargo («no supongas que es la del herbolario ni la del vino») se
cumple: es una TERCERA frase. El sufijo de género y la cola los compone el call-site,
no el core — igual que ya hacía la vía CON pool.

## 3. El `$` (plantilla de hablante)

`reagentThanks` y `guildSold` llevan `says $.`; el binario los imprime por 0x26 (el
expansor) y no por 0x75c0 (el impresor llano) — la distinción está EN EL ASM, no
supuesta. El `$` es el nombre del tendero. No inventé vía: **calqué la existente**,
`expandShoppeTemplate(t(…), {keeper, shop, day})`, que ya usaban `reagentDealYes`
(shop-console.ts:1745) y `guildDealYes` (:1851).

## 4. ⚠ DOS DIVERGENCIAS NUEVAS, DECLARADAS Y NO ARREGLADAS

### 4a. El gate de tope del gremio es FABRICADO
Leído el cuerpo entero de `buy_one_guild` y sus dos callers (0x03f6, 0x04a2), **no hay
ningún `cmp … 0x63` previo al cobro**. Con 99 llaves el original COBRA y el
`add_byte_capped` se come el lote. `shops.ts:buyGuildItem` tiene un `if (>= CAP_99)
return {ok:false}` que no existe en el binario, con un mensaje que tampoco existe.

NO lo toco: quitarlo es cambio de MECÁNICA, no de cadena, y el encargo acota el fix a
lo derivado en el eje de las frases. Re-sellé su test como **DETECTOR** con la historia
dentro (`shops.test.ts`, «[detector] con 99 ya en mano el PORT no compra (el binario
sí: gate fabricado)») — antes se leía como un veredicto de fidelidad. **Es la decisión
de este acta que el lead puede querer revertir.**

### 4b. «Thou canst carry no more!» es una SEGUNDA fabricación
Cero ocurrencias en DATA.OVL, misma búsqueda que sí encuentra las ocho reales. El
binario tiene la oración correcta DOS veces, y las dos ya estaban aprobadas en el
repo con su offset:
- `DS 0x792c` `'\n\n"Thou canst not carry any more!"\n\n'` — reactivo (SHOPPES 0x0550)
- `DS 0x7b76` `'\n"Thou canst not carry any more!"\n'` — equipo (SHOPPES 0x0a65,
  gate `cmp [si+0x57c0],0x63`, + DS 0x7b9a por el expansor + getkey)

#147 cableó la del reactivo. Quedan VIVAS en `buyEquipment` (shops.ts:544, 4ª tienda,
fuera del alcance de esta tarea) y en el gate fabricado del gremio (§4a). La clave NO
se retira del catálogo mientras haya emisores: retirarla ahora pondría la guarda roja
con razón. Su entrada en `approved-strings.json` queda anotada con el hallazgo.

**El género de #147 no era de una cadena: era de DOS.** Y la nueva se destapó por el
mismo control negativo, no por sospecha.

## 5. Efecto en el censo de huérfanos (para el ledger — NO edito orphan-strings.json)

`'\nEnjoy!"'` estaba en `es.json` **traducida y huérfana** (nadie la emitía, porque el
vino decía la fabricada). El cableado la SACA de huérfana. Las otras tres ya las
emitía la vía con pool, así que no mueven el censo.

Quien re-censa debe poner `estado: RESUELTO` en la entrada de `'\nEnjoy!"'`.
No he tocado `orphan-strings.json`.

## 6. Gates (leídos por separado, sin pipe)

| Gate | Resultado |
|---|---|
| `npx vitest run` (game/ completo) | **EXIT 0** — 284 ficheros, 3659 pasan, 1 skip |
| `npx tsc --noEmit` | **EXIT 0** |
| `pytest re/tools/test_frontier.py test_seed_gate.py` | ver §7 |

**Failing-first: SÍ, y por rama.** Los 4 asertos nuevos se escribieron antes de tocar
`shops.ts` y los 4 fallaron con `expected 'Here thou art!' to be …` (vino, éxito de
reactivo, tope de reactivo, gremio). Ningún valor de aserción preexistente se cambió.

## 7. Predicciones falsables que deja este acta

1. Si alguien quita el gate fabricado del gremio (§4a), el test detector se pone ROJO
   y **eso será correcto**: es la señal de que el port cambió, no de que se rompió.
2. Comprar en el gremio con 99 llaves en el original DEBE cobrar oro y no dar nada.
   Es falsable con oráculo en vivo; si el original NO cobra, mi lectura de 0x02ba está
   mal y §4a se retira.
3. `buyEquipment` a 99 debe imprimir `DS 0x7b76` (un `\n` a cada lado), NO la variante
   de dos `\n` del reactivo. Si al portarlo alguien usa `reagentFull`, se equivoca de
   copia. → **CUMPLIDA en la tanda 2** (§9), y la trampa era real: son dos copias
   distintas de la misma frase y el aserto la fija por su puntuacion.

---

# TANDA 2 — el resto de la tabla de pares del acta de main

Encargo ampliado del lead: las 3 tiendas eran 3 sintomas de UNO — `shops.ts` ignoraba
la tabla derivada entera de `cmd-strings.ts`. Aqui van los pares restantes, leidos y
adjudicados **uno a uno**.

## 8. ★ El expansor de `$`, derivado UNA vez (se reusa en tres pares)

El lead pregunta si el nombre del tendero lo imprime la rutina de `$` del TLK o va
inline. **Ninguna de las dos.** Es un formateador PROPIO de SHOPPES, `CS 0x0026`, que
monta el resultado en el buffer DS 0xb7fa y al final (CS 0x014a-0x016e) lo vuelca sobre
el origen y lo imprime con el impresor llano `CS 0x75c0`. Su tabla de tokens:

| token | fuente | derivado en |
|---|---|---|
| `#` | DS 0xaafc — nombre de la TIENDA | CS 0x0056 |
| `$` | DS 0xaafe — nombre del TENDERO | CS 0x00d0 |
| `@` | franja horaria por `g_hour`: DS 0x7826 si < 0x0c, DS 0x782e si < 0x12, DS 0x7838 si no | CS 0x00d8 |
| `%` | itoa de DS 0xb118 — el PRECIO | CS 0x00fc |
| `^` | itoa de DS 0xb11a — la CANTIDAD | CS 0x0114 |
| `&` | DS 0xab00 | CS 0x0122 |
| `*` | DS 0xac62 | CS 0x012a |
| byte >= 0x80 | espacio + tabla de palabras DS 0x23ea[c*2] | CS 0x00ab |

★ La precision que importa: la ULTIMA fila **es** la compresion por sustitucion de
palabra del `.TLK`. O sea que el formateador de tiendas no «usa la rutina del TLK» ni
la ignora: **incorpora el mismo descompresor** y le anade los tokens de tienda. Por eso
un mismo literal puede llevar `$` y palabras comprimidas a la vez.

Consecuencia para el port: `expandShoppeTemplate(t(...), {keeper, shop, day, price, qty})`
cubre `$`, `#`, `@`, `%` y `^`. Los tokens `&` y `*` NO tienen consumidor en el port; no
aparecen en ninguna de las cadenas de esta tarea, asi que no se tocan (declarado).

## 9. Pares CABLEADOS en la tanda 2 (cinco), cada uno con su cuerpo leido

| flujo | emisor | cadena | forma |
|---|---|---|---|
| `buyEquipment` paga | CS 0x0ad9 | DS 0x7bb4 `'\nSold!\n'` | directo |
| `buyEquipment` a tope | CS 0x0a65 | DS 0x7b76 | directo, atribucion aparte |
| `sellEquipment` | CS 0x0f2a | DS 0x7d76 `'Yes\n\n"Done!"\nsays $.'` | directo, con `$` |
| `buyHorse` sin oro | CS 0x0934 + CS 0x093b | DS 0x7a7e + DS 0x7a9e | dos impresores, UNA oracion |
| `buyTavernRound` | CS 0x01c8 | DS 0x9b16 `'\nEnjoy!"\n\n'` | directo |

Notas de lectura que NO son obvias:

- **La copia importa.** `'Thou canst not carry any more!'` esta DOS veces en DATA.OVL y
  no son intercambiables: DS 0x792c (reactivo) lleva dos saltos a cada lado y DS 0x7b76
  (equipo) lleva uno. El aserto de cada una fija su puntuacion.
- **El eco horneado.** DS 0x7d76 empieza por `Yes\n\n`: el eco de la tecla va DENTRO del
  literal de DATA.OVL, no lo antepone el call-site. Mismo patron ya aceptado en
  `guildYes` y `horseYesExcl`, asi que el core devuelve el literal entero.
- **`buyHorse` con oro** ya devolvia `Yes!`, que es DS 0x7a78 (CS 0x0924) — fiel de
  antes; solo se le pone la cita.
- **Dos «Enjoy» distintos.** El vino es DS 0x9c40 y la ronda de comida DS 0x9b16: la
  segunda cierra con `\n\n`. Son dos entradas separadas con dos emisores separados.

## 10. Par DECLARADO y NO forzado: la POSADA

`innRest` devolvia `'Welcome back!'`. El binario (SHOPPES3 0x011a-0x0145) emite, tras
cobrar, una cadena de TRES piezas: DS 0x4e13 `'"Have a pleasant\nnight, '` + la palabra
de genero (DS 0x4e2c `milady` / DS 0x4e33 `sir`, elegida por `cmp [bp+6],0xc`) +
DS 0x4e37 `'!"\nsays $.\n\n'` por el expansor. Y despues siguen el irse a la cama, el
paso de la noche y los avisos de los que mueren durmiendo.

Es el caso «EPILOGO MULTI-MENSAJE» exacto del encargo: **el original emite varios donde
el port devuelve uno**, y la primera pieza aislada (`'"Have a pleasant\nnight, '`) es un
fragmento colgando que termina en coma y no se sostiene solo. Cablearlo obligaria a que
el core compusiera tres piezas mas el genero. **NO lo fuerzo.** Va a la tarjeta de
diseno. Seña para retomarlo: la capa de UI YA compone las tres piezas correctamente
(`innPleasant` + `innGenderWord()` + `innPleasantClose`), asi que el trabajo pendiente
es decidir quien es el dueno de la composicion, no derivar nada mas.

## 11. Hueco NUEVO destapado al cablear el caballo (declarado, no arreglado)

En la via FIEL del establo, el bucle de eventos de `stableHorse` esta **suprimido**
(`void ev; // mensajes QoL del core suprimidos`). Con el core devolviendo ya la cadena
fiel, esa supresion deja de ser inocua: si no hay oro, el binario SI imprime
DS 0x7a7e + DS 0x7a9e y el port no imprime nada. No lo destapo relajando la supresion
porque el mismo bucle reemitiria el `Yes!` que ese call-site ya ecoa dos lineas antes
(doble eco) — hace falta discriminar por evento, que es diseno. La OTRA via del establo
si relaya, y ahi si se ha cableado la expansion del `$`.

## 12. Efecto en los catalogos (tanda 2)

- ALTA en `approved-strings.json`: `'\nEnjoy!"\n\n'` (DS 0x9b16). Las otras cuatro ya
  tenian entrada `[D]` porque la via con pool las emitia.
- BAJA en `approved-strings.json` Y en `es.json` (la guarda de manifiesto las declaro
  huerfanas al dejar de emitirse, y esa guarda es un espejo exacto): `A pleasure doing
  business!`, `Enjoy!` y `Thou couldst not afford to feed it!`.
- SIGUE VIVA `Thou canst carry no more!` — su ULTIMO emisor es el gate fabricado del
  gremio (§4a). Cuando ese gate caiga, la clave sale de los dos catalogos y con ella la
  segunda fabricacion del §4b. `buyEquipment`, que era su otro emisor, ya no la usa.

## 13. Asertos RE-SELLADOS en la tanda 2 (ninguno borrado)

Tres sellaban la prosa vieja y se re-sellan con la historia dentro y la mecanica
intacta: `shop-buy-flow.test.ts` (degradacion de compra), `shop-farewell.test.ts`
(degradacion de venta) y el de `buyHorse` sin oro en `shops.test.ts`. Este ultimo ya
existia, asi que el aserto nuevo de la tanda se retiro para no duplicar cobertura: se
re-sella el original en su sitio.

---

# TAREA 153 — cae el GATE FABRICADO del gremio, y con el la segunda fabricacion

El lead ratifica la lectura del §4a y abre la tarjeta con su propio failing-first. Esto
YA NO es un cambio de cadena: es mecanica ECONOMICA.

## 14. La ausencia, medida sobre el overlay ENTERO (no por ventana)

En la tanda 1 declare que la cadena del gremio no tiene gate de tope tras leer los tres
cuerpos. Antes de tocar mecanica lo he convertido en un control CENSAL: en **todo**
`SHOPPES.OVL` existen exactamente **DOS** comparaciones contra 0x63, y ninguna cae en la
cadena del gremio ni toca sus globales.

| emisor | global | flujo |
|---|---|---|
| CS 0x0549 | DS 0x5850 | tope de reactivos |
| CS 0x0a5e | DS 0x57c0 | tope de equipo |

Las globales del gremio son DS 0x57ac, DS 0x57ad y DS 0x57ae, y no aparecen en ninguna
comparacion. La diferencia con la declaracion anterior importa: antes la ausencia se
apoyaba en «he leido estos tres cuerpos y no lo vi»; ahora se apoya en «el overlay entero
tiene dos, y son estas dos». Un `grep` que devuelve DOS aciertos es su propio control
positivo — si el patron fallara, no habria encontrado tambien las que si existen.

## 15. Lo que cambia de comportamiento

Retirado el `if (>= CAP_99) return {ok:false}` de `buyGuildItem`. Con 99 en mano el port
ahora **cobra** y el `Math.min` que ya modelaba el add_byte_capped satura, o sea que el
jugador paga y no recibe nada — que es lo que hace el original. El gate inventado era
mecanica economica que **protegia al jugador de un cobro real**: no era prosa de mas,
era dinero de menos.

`buyGuildItem` queda con un solo rechazo, el de oro, igual que CS 0x0361.

## 16. El aserto invertido A PROPOSITO (no es una rotura)

El detector del §4a se pone rojo con el fix, y eso ERA el diseno. Se re-escribe en su
forma derivada conservando la historia entera de sus tres vidas en el comentario: nacio
sellando la ausencia de compra como si fuera fidelidad, la tanda 1 lo re-sello como
DETECTOR del baseline del port, y aqui pasa a medir lo derivado (cobra, y el tope se come
el lote). Failing-first: el aserto nuevo fallo con `expected false to be true` ANTES de
tocar `shops.ts`.

## 17. ★ La segunda fabricacion, fuera de los dos catalogos

Al caer el gate, «Thou canst carry no more!» se queda **sin un solo emisor** en el port, y
la guarda de manifiesto —que es un espejo exacto— lo canto sola en el mismo pase: «1
entrada del manifiesto ya no existe en el codigo». Retirada de `approved-strings.json` y
de `es.json`. La frase REAL del binario sigue en el catalogo con sus dos copias y sus dos
citas: DS 0x792c (reactivo) y DS 0x7b76 (equipo).

Con esto **las dos fabricaciones del capitulo estan fuera**: la que motivo la tarjeta y la
que cazo el control negativo. El patron #130 se respeta en las dos — fuera la fabricada,
se conserva la fiel.

## 18. Prediccion falsable que deja este fix

Comprar en el gremio con 99 llaves en el original DEBE descontar oro y no dar nada. Es
comprobable con oraculo en vivo y es el unico punto donde este fix puede caerse: si el
original NO cobra, mi lectura de CS 0x02ba esta mal, el gate habria que devolverlo y la
seccion 14 se retira entera.
