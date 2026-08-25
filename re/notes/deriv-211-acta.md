# ACTA #211 — el «+1» del spawn del pozo se lo lleva la X, y el port coloca el caballo en otra casilla

Pieza 3 del encargo triple. Rama `re/deriv-219`, base `67696ac6`; `main` al abrir la pieza:
`3dad9615`. Antecedente: `re/notes/derivaciones-152-acta.md` §2, que dejó el eje **sin
firmar** («⚠ Lo que NO firmo: cuál de los ejes se lleva el más uno»).

**Titular en tres**: (a) el eje es la **X** — el registro queda en **(party_x + 1,
party_y, g_floor)**; (b) la identidad de los campos no se apoya en ninguna convención
supuesta: **el índice de hueco ancla el mapeo** de pushes a ranuras; (c) el careo sale
**divergente**: el port barre N,E,S,O buscando casilla transitable y el binario **no barre
ni comprueba nada**, con lo que en el caso típico el caballo aparece en **otra casilla**.

---

## 1. Primero, el enunciado corregido

La tarjeta dice «el cuerpo de ULTIMA.EXE 0x3A74 escribe el campo +2 con el 3er argumento
MÁS UNO». El `+1` **no está en el cuerpo de 0x3A74**: ese cuerpo es un volcado limpio de
seis bytes sin aritmética. El `inc` está en el **llamador**, LOOKOBJ `0x013c`. Es una
compresión del enunciado, no un error de fondo, pero conviene decirlo para que nadie
busque el `inc` donde no está.

Cuerpo de `0x3A74` (`ret 0xe` = 7 palabras):

| offset | instrucción | ranura |
|---|---|---|
| 3a78 | `mov si, word ptr [bp + 4]` | ★ el ÍNDICE de hueco |
| 3a7b | `mov cl, 3` / `shl si, cl` | registro de **8 bytes** |
| 3a82 | `mov byte ptr [si + 0x5c5a], al` ← `[bp+0x10]` | +0 |
| 3a89 | `mov byte ptr [si + 0x5c5b], al` ← `[bp+0xe]` | +1 |
| 3a90 | `mov byte ptr [si + 0x5c5c], al` ← `[bp+0xc]` | +2 |
| 3a97 | `mov byte ptr [si + 0x5c5d], al` ← `[bp+0xa]` | +3 |
| 3a9e | `mov byte ptr [si + 0x5c5e], al` ← `[bp+8]` | +4 |
| 3aa5 | `mov byte ptr [si + 0x5c5f], al` ← `[bp+6]` | +5 |

## 2. ★ El ancla que hace innecesario suponer la convención

La tarjeta pedía verificar «por el MECANISMO (último push cae en bp+4)», acordándose del
zodíaco transpuesto (#70). El mecanismo aquí es mejor que una convención: **hay un
argumento cuyo papel es inconfundible**. El último push del llamador (`0x014b push word
ptr [bp - 0x10]`) es el **hueco libre** que devuelve la llamada de `0x012c`, y el callee lo
lee en `[bp+4]` y lo multiplica por ocho para indexar la tabla. Ningún otro argumento
podría estar ahí. ⇒ **los pushes caen en offsets DESCENDENTES**, y el push k-ésimo va a
`[bp + 0x10 − 2(k−1)]`.

Con eso, la secuencia del llamador se lee sin ambigüedad:

| offset | push | ranura del registro |
|---|---|---|
| 0135 | `mov ax, 0x10` / `push ax` | +0 |
| 0136 | `push ax` (el mismo 0x10) | +1 |
| 013c-013d | `inc ax` / `push ax`, con `al = [bp+8]` | ★ **+2, con el más uno** |
| 0143 | `push ax`, con `al = [bp+6]` | +3 |
| 0147 | `push ax`, con `al = [bp+4]` | +4 |
| 014a | `sub ax, ax` / `push ax` | +5 = 0 |
| 014b | `push word ptr [bp - 0x10]` | el ÍNDICE (ancla) |

## 3. Los ejes: +2 = X, +3 = Y — dos testigos independientes y cero contraejemplos

**Testigo A — el consumidor que los pasa a `tile_addr`.** ULTIMA.EXE:

| offset | instrucción |
|---|---|
| 61b1-61b6 | `mov si, [bp+4]` / `shl si, 3` |
| 61b8 | `mov al, byte ptr [si + 0x5c5c]` (+2) |
| 61be | `push ax` |
| 61bf | `mov al, byte ptr [si + 0x5c5d]` (+3) |
| 61c3 | `push ax` |
| 61c4 | `call 0x4402` |

`tile_addr` es `ret 4` (dos palabras) ⇒ el primer push cae en `[bp+6]`. Y su cuerpo
**aparea los dos slots con las dos globales de origen de chunk**, sin margen de duda:

| offset | instrucción |
|---|---|
| 4427-4430 | `mov ax, [bp+6]` / `mov cl, [g_chunk_origin_x]` / `sub ax, cx` |
| 4438-443f | `mov ax, [bp+4]` / `mov cl, [g_chunk_origin_y]` / `sub ax, cx` |

⇒ `[bp+6]` = X, `[bp+4]` = Y ⇒ **+2 = X, +3 = Y**. (Corrobora la rama ≥0x80 del mismo
`tile_addr`, `[bp+4]<<5 + [bp+6]`, que es fila×32 + columna.)

**Testigo B — la aritmética contra la party, en MAINOUT y cuatro veces.** El patrón es
`campo − coordenada de la party`, en pares adyacentes:

| +2 contra `g_party_x` | +3 contra `g_party_y` |
|---|---|
| 11f6 / 11fa | 1203 / 1207 |
| 1331 / 1335 | 135a / 1360 |
| 13f3 / 13f7 | 1400 / 1404 |
| 14f8 / 14fe | 1523 / 1529 |

**Contraejemplos: CERO.** Barrido del corpus entero (18 ficheros `.asm`) buscando `+2`
apareado con `g_party_y` o `+3` con `g_party_x`: los dos únicos aciertos aparentes del
primer patrón son **otra global** —`g_char_anim_states+2`, que vive en la dirección
absoluta 0x5C5C y el desensamblador imprime **por símbolo**— y no son accesos indexados a
la tabla (`[si + 0x5c5c]`). ★ Nota de instrumento: el mismo literal `5c5c` es **dos cosas**
en este corpus, y un censo que no distinga el **modo de direccionamiento** las mezcla.

## 4. Y el llamador empuja las coordenadas LITERALES

No hay que adivinar qué es `[bp+8]`. El único llamador del handler del pozo (LOOKOBJ
`0x0042`, `ret 6`) es `0x0579`, y empuja:

| offset | instrucción | ranura del handler |
|---|---|---|
| 056b-0570 | `mov al, byte ptr [g_party_x]` / `push ax` | `[bp+8]` |
| 0571-0574 | `mov al, byte ptr [g_party_y]` / `push ax` | `[bp+6]` |
| 0575-0578 | `mov al, byte ptr [g_floor]` / `push ax` | `[bp+4]` |
| 0579 | `call 0x42` | |

⇒ **VEREDICTO: el registro queda en (party_x + 1, party_y, g_floor)**. El «+1» se lo lleva
la **X**: una casilla al **este**. Y de paso **corrobora por lectura propia** el `+4 =
planta` que #152 daba por derivado: aquí se ve el `g_floor` empujado literalmente.

★ Y no hay test de nada: el binario **no barre direcciones** y **no comprueba
transitabilidad**. Coloca en esa casilla y punto.

## 5. Careo con el port — DIVERGE

`game.ts::spawnWishHorse` barre `[[0,-1],[1,0],[0,1],[-1,0]]` (N, E, S, O) y coge la
primera casilla con `tileInfo(t).walkable`. Dos divergencias, no una:

1. **La casilla.** El primer candidato del port es el **NORTE**; el binario coloca al
   **ESTE**. En el caso típico (norte transitable) el caballo aparece en **otra casilla**.
2. **El test.** El port exige `walkable`; el binario no comprueba nada, así que en el
   original el caballo puede quedar sobre una casilla no transitable.

Lo que **sí** coincide: el tile (`WISH_SPAWN_TILE = TILE_HORSE = 0x10` contra el `mov
ax,0x10` de `0x0132`) y el gate de localización (`[0x16, 0x1f]` contra `0x0102-0x010e`).

Y sigue en pie la divergencia de **capa** de #152: el original escribe en la tabla de
**objetos** DS:0x5C5A (que persiste) y el port en la capa de **terreno** vía
`mapOverride`.

## 6. Defecto de cita, corregido (familia #188)

`game.ts` llamaba al callee «`kernel_spawn_object 0x97e4`». `0x97e4` es el **operando
crudo** del near-call, no un desplazamiento del kernel; el callee es **ULTIMA.EXE 0x3A74**
`set_actor_record`. Corregido en la cabecera de `spawnWishHorse` y en las **dos** filas de
`re/deliberate-divergences.md` que arrastraban el mismo nombre (§3 y la tabla de
alcanzabilidad), que además declaraban el algoritmo de coord como **pendiente** — prosa
rancia desde este acta.

## 7. Lo que NO se ha hecho

- **No se ha tocado la lógica** de `spawnWishHorse`: es fix de mecánica ⇒ **tarjeta #227**
  con relevo. Ahí quedan apuntadas las dos decisiones separadas (la casilla, que es
  barata; y el test de transitabilidad, que conviene mirar con testigo antes de retirar,
  porque el port podría estar apoyándose en esa garantía en otro sitio, p. ej. `(B)oard`).
- **Sin oráculo.** Nada de esto se ha visto en DOSBox; todo es lectura de binario.
- **No se ha derivado** qué son `+0`/`+1` más allá de que ambos reciben `0x10` aquí (el
  layout del registro está fichado en `re/notes/native-persist-enemies.md`).

## 8. Predicciones falsables

- **P4**: pedir «Horse» en Paws con la party pegada a un muro por el **este** hace que el
  caballo aparezca **sobre el muro** (o simplemente en esa casilla) en el original, y en el
  port aparecerá al norte o en otra casilla transitable.
- **P5**: en el original el caballo del pozo **sobrevive** a guardar y recargar (está en la
  tabla de objetos, dentro de la ventana del save), y no depende de `mapOverrides`.
