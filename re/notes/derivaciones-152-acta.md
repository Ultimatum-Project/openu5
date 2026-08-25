# ACTA #152 — los 3 call-sites de `mapOverrides` sin censar de #119, leídos POR EL PUNTERO

Carril de DERIVACIÓN PURA: se adjudica, no se arregla. Rama `re/derivaciones-152`, base
`994d4fc2`; `main` al abrir la pieza estaba en `f4951017`. Cero ficheros de `game/src`
tocados.

El criterio es el de #119 y NO se re-deriva: el canal lo decide **el puntero que se
escribe**, no el nombre de la mecánica. Los dos canales conocidos:

| canal | cómo se reconoce | destino | vida |
|---|---|---|---|
| terreno VOLÁTIL | la escritura pide el puntero a `tile_addr` = ULTIMA.EXE **0x4402** | búfer de terreno vivo | muere en cada carga de mapa; FUERA de la ventana del save |
| OBJETO persistente | la escritura calcula un puntero dentro de la tabla **DS:0x5C5A** (32 entradas x 8 B) | tabla de objetos | DENTRO de la ventana del save |

Este carril encuentra que **uno de los tres no cae en ninguno de los dos**: cae en un
TERCER búfer, `g_dng_map` DS:0x595A.

---

## 0. Veredicto de las tres, en una tabla

| call-site del port | canal DERIVADO en el binario | ¿se mueve de `mapOverrides`? |
|---|---|---|
| `game.ts:3011` `applyFieldSpell` | **g_dng_map DS:0x595A** (ni terreno ni objeto) | ★ NO — el destino que hoy modela no existe; ver §1, es una re-adjudicación de mecánica, no un movimiento de capa |
| `game.ts:5449` `spawnWishHorse` | **tabla de objetos DS:0x5C5A** vía ULTIMA.EXE 0x3A74 | NO — persiste, igual que el caballo comprado (#119 T5), y ahora POR DERIVACIÓN PROPIA |
| `shrine-ceremonies.ts:402` | **terreno volátil** vía `tile_addr` ULTIMA.EXE 0x4402 | ★ SÍ — es la 14ª del canal volátil |

---

## 1. `applyFieldSpell` — el campo mágico NO escribe terreno: escribe el MAPA DE MAZMORRA

### 1.1 La rutina, entera

Handler único de In Flam Grav / In Nox Grav / In Zu Grav / In Sanct Grav:
**`re/disasm/CAST.OVL.asm` 0x004c**, `ret 2` (un argumento word = el tipo de campo).

| offset | instrucción | lectura |
|---|---|---|
| 004c | `push bp` … `sub sp, 8` | prólogo |
| 0054 | `cmp byte ptr [g_location], 0x80` | ★ el discriminador |
| 0059 | `jb 0x5e` | por debajo de 0x80 → rama de MAPA |
| 005b | `jmp 0xec` | 0x80 o más (combate) → rama de ARMA |
| 005e | `cmp word ptr [bp + 4], 3` | el arg 3 pide efecto 4, el resto efecto 3 |
| 006e | `call 0xffffc186` | resuelto → stub a CAST2.OVL (efecto audiovisual) |
| 0071 | `mov al, byte ptr [g_dng_facing]` | ★ el rumbo lo da la variable de MAZMORRA |
| 007a | `mov ax, word ptr [si + 0x24d6]` | delta de un eje, tabla indexada por rumbo x2 |
| 007e | `mov cl, byte ptr [g_party_x]` | |
| 0084 | `add ax, cx` | |
| 0086 | `and ax, 7` | ★ envoltura a 8 — geometría de mazmorra, no de mapa |
| 008c | `mov ax, word ptr [si + 0x24de]` | delta del otro eje, misma indexación |
| 0090 | `mov cl, byte ptr [g_party_y]` | |
| 0096 | `and ax, 7` | |
| 00a5 | `mov bl, byte ptr [g_floor]` | |
| 00ad | `shl bx, cl` con `cl = 6` | planta x 64 = una planta por bloque de 8x8 |
| 00af | `mov al, byte ptr [bx + di + 0x595a]` | ★ LEE la celda de `g_dng_map` |
| 00b8 | `test byte ptr [bp - 8], 0xf7` | GATE: sólo si todo salvo el bit 3 está a cero |
| 00bc | `je 0xc6` | celda no vacía → no siembra y devuelve 0 |
| 00c6 | `mov al, byte ptr [bp - 8]` + `and al, 8` | conserva el bit 3 de lo que había |
| 00ce | `or al, byte ptr [bx + 0x4596]` | ★ el valor de campo, de la tabla de 4 bytes |
| 00e6 | `mov byte ptr [bx + si + 0x595a], al` | ★★ **ESCRIBE en `g_dng_map`** |
| 00ec | `mov bx, word ptr [bp + 4]` | (rama de combate) |
| 00ef | `mov al, byte ptr [bx + 0x4592]` | tabla de arma-hechizo |
| 00f3 | `mov byte ptr [g_cmb_weapon], al` | |
| 0100 | `call 0xffffc14a` | resuelto → stub a COMSUBS.OVL (aplicador de combate) |

La rama de combate **no escribe ningún mapa**: fija el arma y delega. La otra rama es la
única escritura de mapa de todo el handler, y su destino es `g_dng_map`.

### 1.2 Los cuatro llamadores, completos

Todos dentro del despachador de hechizos de CAST.OVL (tabla de salto en 0x0f1a,
`jmp word ptr cs:[bx - 0x2f3a]`, acotada por `cmp ax, 0x2f` / `jbe` en 0x0f0f):

| offset | arg empujado | hechizo |
|---|---|---|
| 0f96 | `sub ax, ax` = 0 | In Flam Grav |
| 0f9e | `mov ax, 1` | In Nox Grav |
| 0fa4 | `mov ax, 2` | In Zu Grav |
| 0fcc | `mov ax, 3` | In Sanct Grav |

Los cuatro convergen en 0x0f98 `push ax` / 0x0f99 `call 0x4c`. La correspondencia
arg 0..3 es EXACTAMENTE la que el port calcula en `cast.ts:149`.

### 1.3 El gate de contexto dice lo mismo, por una vía independiente

El despachador exige, ANTES de llegar al handler, un bit de la tabla DS:0x1C90 elegido
por la ubicación (`re/disasm/CAST.OVL.asm`):

| offset | condición | bit exigido | contexto |
|---|---|---|---|
| 0e1a | `cmp byte ptr [g_location], 0` / `jne` | 0e24 exige 8 | exterior |
| 0e2c | `cmp byte ptr [g_location], 0x7f` / `jbe` | 0e36 exige 1 | combate |
| 0e74 | `cmp byte ptr [g_location], 0x21` / `jae` | 0e7e exige 4 | pueblo |
| 0e86 | (resto: 0x21 a 0x7f) | 0e89 exige 2 | mazmorra |

Si el bit falta, 0x0e90 pone el resultado a cero y 0x0e9b imprime el rechazo. Los bytes
REALES de la tabla, leídos del binario y no de la prosa (`DATA.OVL`, la ventana de datos
va desplazada 16 bytes respecto al desplazamiento DS — ver §4):

`0e 01 0f 0f 0f 05 0f 01 08 08 01 0f 0e 01 03 03 03 09 03 0f 03 02 02 01 01 05 05 0f 01 0f 01 01 0f 0c 01 01 01 01 01 0e 01 01 0e 01 01 01 0e 0f`

Las entradas 14, 15, 16 y 20 valen las cuatro **3** = combate mas mazmorra. **El bit de
exterior está a cero y el de pueblo también.** O sea: la rama no-combate de 0x004c sólo
es alcanzable con la ubicación en el rango de mazmorra, que es justo el contexto en el
que `g_dng_facing`, `g_floor` y la envoltura a 8 tienen sentido. Las dos lecturas se
sostienen la una a la otra.

### 1.4 La tabla de valores de campo tiene UN SOLO lector en todo el corpus

`grep` sobre los 28 `.asm`: los desplazamientos 0x4596 y 0x4592 aparecen **dos veces en
total**, las dos dentro de 0x004c (0x00ce y 0x00ef). No hay ninguna otra rutina en el
binario que lea la tabla de tiles de campo. ⇒ **no existe una siembra de campo de
exterior**: el estampado de 5 celdas del port no tiene productor en el binario.

Controles positivos del instrumento, en la misma corrida y con el mismo `grep`:
`0xab02` → 6 líneas, `0x595a` → 51 líneas, `- 0x54fe` → 25 líneas. El instrumento mide.

### 1.5 Consecuencia de CAPA, que es lo que pedía la tarjeta

`g_dng_map` está fichado en el ledger como **dentro de la ventana de SAVED.GAM**, y el
acervo ya tiene que la salida de mazmorra no lo limpia. ⇒ el campo sembrado en mazmorra
es **PERSISTENTE**, ni volátil ni objeto. La capa que el port usa hoy (`mapOverrides`,
persistida) resulta ser la de vida CORRECTA por accidente, sobre el búfer EQUIVOCADO y
en el contexto equivocado.

### 1.6 ⚠ Choque con un testigo, declarado y NO resuelto por este carril

`re/notes/field-duration-witness.md` afirma haber casteado In Flam Grav **en exterior**
en el oráculo (2026-07-18) y haber visto el campo. Con la tabla de §1.3 leída del
binario, ese cast debería haber sido rechazado. Las dos cosas no pueden ser verdad.

Lo que este carril PUEDE aportar sin volver a montar el oráculo:

- el ancla del testigo es DS:0xb19e, y ese desplazamiento tiene **cero** referencias en
  los 28 `.asm`, ni como literal (`0xb19e`, `0xb1a0`, 0 líneas) ni como desplazamiento
  con signo (`- 0x4e6x`, 0 líneas) — con los tres controles positivos de §1.4 en la misma
  corrida. Nadie escribe ahí por literal; sea lo que sea, se alcanza por puntero
  calculado, así que la atribución «registro de tiles de campo» del testigo no está
  sostenida por ninguna cita.
- el contenido que el testigo reporta en 0xb19e es la secuencia ASCENDENTE de los cuatro
  tipos, y la tabla de campo del binario NO está en ese orden (§4). Un registro escrito
  por el cast tendría el tipo casteado, no los cuatro en orden.

No se retira el testigo: retirar pide una corrida nueva del oráculo, que no es de este
carril. Queda como **conflicto vivo con tarjeta**, y con la carga de la prueba movida:
hoy el binario tiene cita y el testigo no.

> ✅ **RESUELTO EL 2026-08-20 (ficha #138, `remap-anim-b11e-castillo-138.md`).** Las dos
> sospechas de este § quedan CONFIRMADAS con cita: `0xb19e` se alcanza por índice de tile
> sobre la base DS:0xB11E (`[si - 0x4ee2]` — por eso el grep de literales dio cero), es la
> tabla-remap de animación de tiles, y la «secuencia ASCENDENTE de los cuatro tipos» es su
> contenido-IDENTIDAD, escrito por INTRO.OVL 0x0993 en el arranque — no por el cast. Las
> celdas del compositor eran el Castillo de Britannia (el party del testigo estaba en su
> puerta, (86,107)). El razonamiento de este § («un registro escrito por el cast tendría
> el tipo casteado, no los cuatro en orden») señalaba bien.

---

## 2. El spawn del deseo — OBJETO, y el «0x97e4» de la cabecera del port es un OPERANDO

### 2.1 La cadena

`re/disasm/LOOKOBJ.OVL.asm`, dentro del manejador del pozo de los deseos (rutina que
empieza en 0x0042, `ret 6`):

| offset | instrucción | lectura |
|---|---|---|
| 0102 | `cmp byte ptr [g_location], 0x16` / `je` | sólo en dos ubicaciones |
| 0109 | `cmp byte ptr [g_location], 0x1f` / `je` | la segunda |
| 012c | `call 0xffff9654` | busca hueco; el resultado va a `[bp - 0x10]` |
| 0132 | `mov ax, 0x10` | el tile del caballo |
| 0135 | `push ax` | campo +0 |
| 0136 | `push ax` | campo +1 |
| 0137 | `mov al, byte ptr [bp + 8]` + `inc ax` + `push ax` | ★ campo +2, con **más uno** |
| 013e | `mov al, byte ptr [bp + 6]` + `push ax` | campo +3 |
| 0144 | `mov al, byte ptr [bp + 4]` + `push ax` | campo +4 |
| 0148 | `sub ax, ax` + `push ax` | campo +5 = 0 |
| 014b | `push word ptr [bp - 0x10]` | el hueco |
| 014e | `call 0xffff97e4` | la escritura |

### 2.2 El callee, resuelto con el instrumento (no a ojo)

`resolve_near_call` con la base de near-call de LOOKOBJ.OVL leída del propio
`code_files()` (0xa290) da: **ULTIMA.EXE 0x3A74**, tipo `kernel`. Su cuerpo:

| offset | instrucción |
|---|---|
| 3a74 | `push bp` / `mov bp, sp` |
| 3a78 | `mov si, word ptr [bp + 4]` |
| 3a7b | `mov cl, 3` / `shl si, cl` |
| 3a82 | `mov byte ptr [si + 0x5c5a], al` |
| 3a89 | `mov byte ptr [si + 0x5c5b], al` |
| 3a90 | `mov byte ptr [si + 0x5c5c], al` |
| 3a97 | `mov byte ptr [si + 0x5c5d], al` |
| 3a9e | `mov byte ptr [si + 0x5c5e], al` |
| 3aa5 | `mov byte ptr [si + 0x5c5f], al` |
| 3aab | `ret 0xe` |

Siete palabras de argumento (`ret 0xe`) = los siete `push` de §2.1, y el primero es el
índice de hueco, que se multiplica por ocho y se suma a la base de la tabla. ⇒ la
escritura **es en la tabla de objetos DS:0x5C5A**, exactamente el otro canal.

★ **Defecto de cita del port, adjudicado**: `game.ts:5443` llama a esto
«kernel_spawn_object 0x97e4». `0x97e4` es el **operando crudo del near-call**, no un
desplazamiento del kernel; el desplazamiento es **0x3A74**. Es la familia de #188 y del
control de resolución: un operando sin resolver da un nombre plausible y falso. La cita
correcta es LOOKOBJ.OVL 0x014e → ULTIMA.EXE 0x3A74.

### 2.3 Veredicto y lo que además queda derivado

**NO se mueve.** DS:0x5C5A cae dentro de la ventana del save ⇒ persiste, igual que el
caballo comprado de #119 T5. Y esta vez la clasificación no se apoya en analogía con el
caballo ni en la prosa del port: se apoya en el cuerpo de 0x3A74.

Además cae, en parte, la Clase C que el propio port declara abierta en `game.ts:5439`
(«lo que queda por derivar es el ALGORITMO exacto de coord»): los parámetros son los
campos del registro de objeto, y el campo +2 recibe **el tercer argumento del llamador
MÁS UNO** mientras +3 y +4 lo reciben tal cual. El port, en cambio, barre N, E, S, O
buscando la primera casilla transitable. Son algoritmos distintos.

⚠ **Lo que NO firmo**: cuál de los ejes se lleva el «más uno». Que +2 sea X y +3 sea Y
viene de la anotación de #119 T5 sobre SHOPPES, no de una lectura hecha aquí; de esa
tripleta lo único DERIVADO es +4 = planta (lo escribe leyendo `g_floor`). Con el
historial de transposiciones de la casa, dejar «X+1» escrito sin leer un consumidor de
+2/+3 sería fabricar. Queda como tarjeta.

---

## 3. El repintado del santuario — TERRENO VOLÁTIL, la 14ª

`re/disasm/CMDS.OVL.asm`, cola del restaurar-santuario:

| offset | instrucción | lectura |
|---|---|---|
| 1293 | `and byte ptr [bx + 0x58d8], 0x7f` | apaga el bit alto del registro del santuario |
| 1298 | `mov ax, 0x4482` / `call 0x58d0` | imprime el texto de éxito |
| 129f | `call 0x70f2` | |
| 12a2 | `push word ptr [bp + 6]` | primer argumento de coordenada |
| 12a5 | `push word ptr [bp + 4]` | segundo |
| 12a8 | `call 0x8482` | ★ el helper |
| 12ab | `mov bx, ax` | el PUNTERO devuelto |
| 12ad | `mov byte ptr [bx], 0x19` | ★★ escribe el tile del santuario POR EL PUNTERO |
| 12b0 | `or byte ptr [g_unk_24e6], 2` | |
| 12b8 | `mov ax, 0xa` / `call 0x573a` | rama de fallo: sólo el salto de línea |

`resolve_near_call` sobre CMDS.OVL (base 0xbf80) da `0x8482` → **ULTIMA.EXE 0x4402**, que
es el mismo `tile_addr` de las trece escrituras ya movidas por #119. La cadena es
idéntica a la del cañón (CMDS 0x0d29) hasta en la forma: pedir puntero, escribir por él.

⇒ **TERRENO VOLÁTIL. Se mueve.** Y con una consecuencia de juego concreta y falsable: el
santuario restaurado **vuelve a estar profanado al reentrar en el mapa**, porque el búfer
de terreno se relee del disco en cada carga (medido en vivo en #121). Hoy el port lo deja
en `mapOverrides` y por tanto lo guarda para siempre.

Verificación cruzada gratis: el texto en DS 0x4482 leído del binario es
`"\n\nThe Shrine is\nrestored!\n"`, byte a byte el que el port ya emite — así que el
call-site del port y el tramo de ASM que estoy leyendo son el mismo sitio, y no me he
equivocado de rutina.

---

## 4. La ventana de datos va desplazada 16 bytes, y eso se ancló con tres testigos

Los desplazamientos DS de este acta se leyeron del fichero de datos con un desfase de
16 bytes. No es una suposición heredada; se fijó con tres anclas independientes que
tenían que cuadrar a la vez:

| ancla | esperado (fuente independiente) | leído con el desfase |
|---|---|---|
| tabla de ventana temporal DS:0x1C90 | las 48 entradas que el port ya publica en `magic/tables.ts` | idénticas, byte a byte |
| tabla de arma-hechizo DS:0x4592 | `[0x35, 0x33, 0x34, 0x36]` | idéntica |
| tabla de tile de campo DS:0x4596 | `[0x82, 0x81, 0x80, 0x83]` | idéntica |

Y el propio port ya lo tenía escrito en otro sitio: el docblock de
`shrine-ceremonies.ts` dice «DS+0x10 → DATA.OVL». Cuarta concordancia.

★ Nota de método, porque el primer intento salió mal: con el desfase puesto a 20 en vez
de 16, las tres tablas seguían «apareciendo» — la de armas devolvía los valores de la de
tiles, y la de ventana temporal devolvía la misma serie empezada cuatro entradas más
adelante. Un solo ancla habría firmado un desfase falso con aspecto de acierto. Lo que
lo descartó fue exigir que las TRES cuadraran con el MISMO número.

---

## 5. Lo que este carril NO ha hecho

- No se ha tocado `game/src`. Los dos movimientos que la derivación pide (el santuario al
  canal volátil; el campo mágico a su re-adjudicación entera) son trabajo de otro carril.
- No se ha vuelto a correr el oráculo, así que el choque de §1.6 queda abierto.
- No se ha derivado qué significan los tres bits bajos que la rutina de campo respeta y
  machaca en `g_dng_map` — eso es la pieza siguiente de este mismo encargo.
