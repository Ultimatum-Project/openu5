# Acta #145 — la «familia multi-mensaje» de la posada NO estaba repartida: son OCHO cadenas y las ocho del (P)ick up

Carril `deriva-3`, segundo tramo. Rama `re/deriva-3` sobre `main` @`91779a93` (+ el commit de #137).

**Veredicto: ficha CIERTA, y la medida la ACOTA.** La tarjeta hablaba de «familia de cadenas
de posada/tienda multi-mensaje sin portar» sin población. Censada la posada entera, el hueco
no está repartido por el flujo: es **un solo sub-flujo, el (P)ick up**, y son **8 de 37**.
Portado, con el discriminador de impresores de `generos-b-194-t2-acta.md` §9.1 como guía.

---

## 1. El censo (población COMPLETA, no muestra)

Barrido de `SHOPPES3.OVL` —el overlay de la posada— por el patrón `mov ax,imm` → `push` →
`call`, resolviendo cada `imm` contra `DATA.OVL`: **37 emisiones con cadena**. Para cada una,
¿la cita el port en `game/src`?

| resultado | nº |
|---|---|
| CITADA en el port | 29 |
| **SIN CITA** | **8** |

Y las 8 caen todas entre `0x04e6` y `0x0893`, que es exactamente el cuerpo del (P)ick up:

| DS | offset | cadena | impresor |
|---|---|---|---|
| 0x4f57 | 0x04fb | `\n\nOne must first be left behind!\n\n` | llano `0x3670` |
| 0x4f7a | 0x050c | `\n\n"No one here is from thy party!"\nsays $.\n\n` | **expansor** `0x9d8e` |
| 0x4fa7 | 0x051f | `\n\n"Who will\ncheck out?" ` | llano |
| 0x4fc0 | 0x05dd | `    GUEST` | llano |
| 0x4fca | 0x05ef | `  REGISTER:\n\n` | llano |
| 0x4fd8 | 0x06c8 | `No one\n\n` | llano |
| 0x5028 | 0x0888 | `I hope thou hast found thy stay enjoyable,"\n` | llano |
| 0x5055 | 0x088f | `says $.\n\n` | **expansor** |

★ **Control de que el instrumento no da ceros uniformes**: 29 de 37 SÍ salen citadas, y el
contraste por CONTENIDO (no sólo por offset) confirma las 8: sus textos no aparecen en
`game/src`. Dos de ellos —`GUEST`/`REGISTER:` y `I hope thou hast found thy stay
enjoyable,"`— sí están en `es.json`, **traducidos y revisados**: son huérfanas del detector
#47/#86 esperando a su emisor, que es lo que este carril les da.

## 2. ★ El patrón que da nombre a la familia, leído entero

```
0789  mov ax,0x4fe1 / push / call 0xffff9d8e   ; `\n\n"That will be % gold, please."\n\n"`
0793  cmp [g_gold],ax / jge 0x7ac              ; ← el precio se imprime ANTES de mirar el oro
085f  mov ax,0x5005                            ; envenenado: `Thy friend has died, by the way."\n`
0888  mov ax,0x5028                            ; sano:       `I hope thou hast found thy stay enjoyable,"\n`
088b  push ax / call 0x3670                    ; ← las dos ramas convergen AQUÍ
088f  mov ax,0x5055 / push / call 0xffff9d8e   ; `says $.\n\n`
```

La comilla de APERTURA la pone `0x4fe1` (que **termina** en `\n\n"`) y la de CIERRE viene
dentro del fragmento siguiente; la atribución va en un tercer `push`/`call`. Trocear así es
del binario, no del port, y el troceo tiene una razón MECÁNICA: `0x3670` es el impresor llano
y `0xffff9d8e` el que expande `$` (posadero) y `%` (número). Los fragmentos sin marcador
pueden ir por el llano; los que lo llevan, no. Es el discriminador de §9.1 de
`generos-b-194-t2-acta.md` visto desde el lado de la posada.

## 3. Lo que la lectura completa aportó, y la ficha no decía

1. **★ Con UN SOLO huésped no hay ni prompt ni registro.** `0x0516 cmp [bp-2],1 / jg 0x51f`:
   con `count <= 1` salta a `0x70c`, que llama al selector con índice 0 y cobra directamente.
   El port abría siempre su lista.
2. **★ Sin oro NO hay cadena de DATA.OVL**: `0x0799 mov ax,0x275a / call 0xffff9dd6`.
   `0x9dd6` no es un puntero DS — con la base de near-call de SHOPPES3 (`0xE1E0`) resuelve al
   stub `0x7FB6` → `SHOPPES.OVL:0x017a`, o sea el lector de registros de SHOPPE.DAT; con eso `0x275a` es un
   **offset de fichero de SHOPPE.DAT**, y el registro que empieza ahí es el **índice 193**:
   `Unfortunately, thou dost not possess the necessary funds!\nGUARDS!"\nsays $.`
   El port emitía `"Thou hast not the gold!"`, que **no está en el binario**.
   **CONTROL del mapeo offset→índice** (barrido de SHOPPE.DAT por registros terminados en
   NUL: 195, los mismos que `shoppe.json`): reproduce los DOS offsets ya curados en
   `shoppe-greetings.ts` — `HORSE_PITCH_INDEX` 104 → `0x1643` y `HEALER_SORRY_INDEX` 173 →
   `0x23AB`. 2/2.
3. **Y esa rama CIERRA la sesión.** `0x07a3 mov [bp+4],0xFFFF` ⇒ en el bucle de menú
   (`0x098f`→`0x97f`→`0x95f`) marca `[bp-2]=1` ⇒ **se salta el epílogo** «Is there anything
   more…» y va directo a la despedida, CS 0x9c8. El port volvía al epílogo.
4. **`"Welcome back!"` era una FABRICACIÓN.** Su hermano real es DS 0x5028.

## 4. ★★ Y desbloquea lo que #155 había DEVUELTO — porque el bloqueo era del SITIO, no del dato

`generos-b-194-t2-acta.md` §9.2 declaró `\n\n"No one here is from thy party!"\nsays $.\n\n`
**no adjudicable**: para calcarla hace falta el nombre del posadero en el punto de emisión, y
`innPickup(state, buyerIdx, memberIdx, location)` no lo recibe. Correcto — **y la conclusión
no era que no se pudiera, sino que no se podía AHÍ**.

El binario corre esa guarda en `0x0506`, **antes** de abrir el registro; en el port ese punto
es el conductor de consola, que sí tiene `this.info.keeperName` y ya usa
`expandShoppeTemplate` para exactamente esto (`innBrokeScreams` del Rest, `shipYells`,
`healerSaysNature`). Movida la guarda al call-site —con el precedente exacto de
`innRoomAvailable`, que ya duplica en la consola el helper `0x002c`— la cadena se emite
verbatim con su atribución. **Lección de método: antes de archivar «no adjudicable», mirar si
el binario evalúa la guarda en una capa donde el dato SÍ está.**

## 5. El arreglo

- `core/world/cmd-strings.ts` — bloque `innPickup*` en `SHOP_UI` (8 claves con su DS).
- `core/shops/shoppe-greetings.ts` — `INN_PICKUP_BROKE_INDEX = 193` con la derivación del
  stub y su control.
- `core/shops/shops.ts` — `innPickup` devuelve el fragmento FIEL (DS 0x5028 en vez del
  fabricado) y un `died` que le dice al call-site cuál de los dos hermanos salió.
- `ui/shop-console.ts` — `innPickupStart` (las tres puertas en el orden del binario, incluido
  el atajo de un solo huésped) e `innPickupMember` (la terna del cobro, el registro 193 y el
  cierre de sesión sin epílogo).
- `tests/fixtures/approved-strings.json` — 6 altas con clase `[D]` y cita, baja de
  `"Welcome back!"`, y la entrada `says $.\n\n` pasa a nombrar sus **dos** productores
  (DS 0x7b9a y DS 0x5055), que tienen los mismos bytes.
- `i18n/es.json` — baja de la traducción huérfana de `"Welcome back!"`. Las seis claves
  nuevas **ya estaban** traducidas y revisadas.

## 6. Verificación

`tests/inn-pickup-145.test.ts`, 9 casos. **ORDEN HONESTO: aquí NO hubo failing-first** — se
derivó, se implementó y luego se selló; el sustituto es la mutación, y una de ellas cambió el
resultado del carril:

| mutante | rojos |
|---|---|
| N1 — quitar las tres puertas y volver al prompt genérico | **7 de 9** |
| N2 — imprimir el precio DESPUÉS del chequeo de oro | 1 (el del orden) |
| N3 — devolver otra vez `"Welcome back!"` | **0 → 1** (ver abajo) |
| N4 — no emitir el tercer mensaje (`says $.`) | 2 (las dos ramas de la terna) |

★★ **N3 NO MATABA, y eso encontró un hueco de sello.** Los siete tests de consola siguieron
verdes al restaurar la fabricación, porque la consola emite el fragmento desde `SHOP_UI` —el
patrón de la casa: el núcleo devuelve el texto, el catálogo lo traduce, igual que
`innRest`/`innMorning`— y por ahí **el `message` del núcleo no lo lee nadie**. El mutante
moría de pie. Se añadió el caso que llama a `innPickup` directamente y sella los dos
fragmentos y el `died`; con él, N3 pasa a matar. Familia
[[campo-que-nadie-lee-no-es-instrumento]]: el sello va DONDE VIVE EL VALOR, no donde es
cómodo mirarlo.

También hay un control discriminante explícito para el atajo de un huésped: «no sale el
prompt» sería verde con una consola que no tuviera prompt, así que el caso hermano con DOS
huéspedes exige verlo SALIR.

**Suite**: `tsc --noEmit` limpio; suite completa desde `game/` **319 ficheros / 4046 tests
verdes**. Las DOS guardas de fabricación mordieron durante el trabajo y se atendieron, no se
silenciaron: `string-manifest` exigió clase+cita para las 6 altas y la retirada de la entrada
huérfana; `i18n-manifest` cazó que la traducción de `"Welcome back!"` se quedaba sin canon
inglés.

## 7. Residuos DECLARADOS

1. **El REGISTRO DE HUÉSPEDES enmarcado NO se porta.** En CS 0x052a-0x06c7 el binario pinta una ventana
   carácter a carácter (`putchar` de los tiles de marco 0x10-0x17, bucles de 13 y de 8) con
   la cabecera `    GUEST` + `  REGISTER:\n\n`. La consola usa su lista de opciones.
   Divergencia de **PRESENTACIÓN**, no de cadena: las dos cadenas de la cabecera siguen sin
   emisor y siguen traducidas en `es.json` esperándolo. Tarjeta propia.
2. **`g_alive_b` (0xbd1c)** — el selector de frase de `0x006a` (2/3/4/5/6 → cadenas
   distintas) que `tavern-192-acta.md` §7.2 mandó a esta familia: es de la TABERNA
   (SHOPPES2), no de la posada, y su población no se ha censado aquí. Queda abierta.
3. **`"Thou hast not the gold!"`** sobrevive en los otros seis call-sites de `shops.ts`.
   Sólo se ha adjudicado el de la posada; los otros seis no se han medido.
4. **El eco de la tecla `P`**: el binario hace `putchar` de la letra antes de entrar
   (patrón de `R`/`L`). No se ha comprobado si la consola lo emite; no entra en el censo de
   cadenas porque es un `putchar`, no un `push`/`call` de DATA.OVL — y ése es justo el punto
   ciego que describe [[puntuacion-por-putchar-corpus-ciego]].
