# El campo `+0` del registro vivo de NPC — la máquina, sus 19 escritores y sus 5 consumidores

Carril `re/invisible-12` · 2026-08-06 · sobre main `d0542dac`.

Convención de redacción, igual que las actas hermanas: los nombres de rutina y de global
van en tabla o en backticks aislados y nunca pegados a un desplazamiento; los
desplazamientos van en la forma `FICHERO.OVL:0x…`, que el sembrador de identidades no
puede leer como propuesta de nombre.

**Encargo:** derivar la máquina de estados detrás del campo `+0` que `npc_can_move` consulta
para decidir si un NPC puede pisar una silla (ficha #37). **NO se bautiza el campo**: qué
significa sigue sin adjudicarse, y esta ficha añade motivos para no adjudicarlo aún.

**Veredicto en una línea:** el `+0` **no es una propiedad del NPC**, es una **clasificación
de SEIS casos de la relación entre la planta del NPC, la planta de su destino de horario y
la planta VISIBLE**, recalculada cuando cambia la ranura de horario. La regla de la silla
**no es una regla de sillas**: es «déjale pisar la silla al que no tiene transición de
planta pendiente», y sale del mismo campo por el que pasan otras cuatro decisiones.

---

## 1. Grado de lectura, sitio por sitio

Para que nadie herede como leído lo que sólo está localizado:

| tramo | estado |
|---|---|
| `NPC.OVL:0x0938-0x0a47` (la máquina) | **LEÍDO ENTERO**, instrucción a instrucción |
| `NPC.OVL:0x0b9e-0x0c4e` (el predicado de movimiento) | **LEÍDO ENTERO** (ficha #37) |
| `NPC.OVL:0x00d6-0x019c` (el cargador) | **LEÍDO ENTERO** |
| `NPC.OVL:0x0e9c-0x0f0b`, `0x0f68-0x0f90`, `0x107a-0x109b`, `0x10e3-0x1120` | **LEÍDOS** como tramos, no la rutina entera que los contiene |
| `NPC.OVL:0x0d00-0x1264` (el despachador que los aloja) | **LOCALIZADO**, no leído entero. Su cabecera sí: `0x0d24-0x0d2f` es una tabla de salto de 8 entradas sobre `sched[slot][schedIdx]` |
| `NPC.OVL:0x12e0`, que devuelve la ranura de horario | **LOCALIZADO**, cuerpo NO leído. Todo lo que sigue lo trata como caja negra que devuelve un índice |
| `TOWN.OVL:0x00e3`, `TOWN.OVL:0x0352`, `CMDS.OVL:0x110f` | **LOCALIZADOS** por el censo; contexto NO leído |
| `NPC.OVL:0x0b40-0x0b6e` (el consumidor del 3) | **LEÍDO** el tramo del gate, no la rutina entera |

## 2. Las dos tablas — y por qué hay que citar la base

Hay **dos** tablas por-NPC de paso 16, separadas por `0x200` (= 32 ranuras × 16 B):

| base | qué es | ¿el port la tiene? |
|---|---|---|
| `0x5D5E` | el HORARIO (leído del fichero de NPC) | **SÍ** (`aiTypes`/`x`/`y`/`z`/`times`) |
| `0x5F5E` | el registro VIVO de runtime | **NO** |

El campo de esta ficha es el `+0` del **vivo**, y `npc_can_move` lo lee como
`word [slot*16 + 0x5F5E]` (`NPC.OVL:0x0c00`). Decir «el registro de 16 B del NPC» sin la
base no identifica ninguna de las dos.

Campos del vivo tocados por lo leído aquí: `+0` (esta ficha) · `+2` X · `+4` Y · `+6` Z ·
`+0xC` ranura de objeto de mundo · `+0xE` índice de ranura de horario.

## 3. La máquina — `NPC.OVL:0x0938`, cuerpo entero

Argumentos: `[bp+6]` ranura de NPC, `[bp+4]` el valor contra el que se comparan las cuatro
marcas de tiempo del horario (`0x096a`, campo `+0xC` del registro de horario, recorrido con
el bucle `0x0964`-`0x0a38`, cuatro vueltas).

Con la marca casada, `0x097d` llama a la resolución de ranura y guarda el índice en `di`.
A partir de ahí, **dos caminos**:

**(a) La ranura NO ha cambiado** (`0x0982`: `+0xE` del vivo == `di`) ⇒ `0x0987` escribe **1**.
Y aun habiendo cambiado, si la posición ya coincide con la del horario en las tres
coordenadas (`0x099b`/`0x09a5`/`0x09ad` contra `+2`/`+4`/`+6` del vivo) ⇒ `0x09ba` escribe
**1** también.

**(b) La ranura HA cambiado** ⇒ clasificación por plantas, `0x09cc`-`0x0a28`. Es una
**partición completa y disjunta de seis casos**, con `Z_npc` = `+6` del vivo, `Z_dest` = la
planta de la ranura NUEVA del horario (`[bx+di+9]`) y `V` = la planta visible (`g_floor`):

| valor | condición | dónde se escribe |
|---:|---|---|
| **8** | `Z_npc ≠ V` **y** `Z_dest ≠ V` | `NPC.OVL:0x09de` |
| **2** | `Z_npc = V` **y** `Z_dest = V` | `NPC.OVL:0x09f6` |
| **6** | `Z_npc = V`, `Z_dest > V` | `NPC.OVL:0x0a04` |
| **7** | `Z_npc = V`, `Z_dest < V` | `NPC.OVL:0x0a0c` |
| **4** | `Z_npc > V` (⇒ `Z_dest = V`) | `NPC.OVL:0x0a1c` |
| **5** | `Z_npc < V` (⇒ `Z_dest = V`) | `NPC.OVL:0x0a24` |

Las implicaciones entre paréntesis no son suposición: la rama de `4`/`5` sólo se alcanza
después del gate de `NPC.OVL:0x09ec`, con `Z_npc ≠ V`, y habiendo pasado por `0x09d4` y `0x09dc`, que ya descartaron el
caso «ninguna de las dos es `V`» mandándolo al **8**.

> ★ **El valor 5 no estaba en el enunciado del encargo** (que listaba 0/1/2/4/6/7/8).
> Existe, en `NPC.OVL:0x0a24`, y es la mitad inferior del par 4/5.

**Confirmado lo que el encargo pedía confirmar:** la rama que da **2** exige las dos plantas
iguales a la visible. Y **no hay más caminos al 2 dentro de esta rutina** — es el único
`mov` de 2 en `0x0938`-`0x0a47`.

## 4. Censo de ESCRITORES — 19 sitios, 3 overlays

No son dos. Por valor:

| valor | sitios |
|---:|---|
| 0 | `NPC.OVL:0x016c`, para la ranura vacía, en el cargador |
| 1 | `NPC.OVL:0x011b` · `0x0987` · `0x09ba` · `0x0ef7` · `0x108c` · `TOWN.OVL:0x0352` · `CMDS.OVL:0x110f` |
| 2 | `NPC.OVL:0x09f6` · `NPC.OVL:0x0e9f` |
| 3 | `NPC.OVL:0x0f8c` |
| 4 | `NPC.OVL:0x0a1c` |
| 5 | `NPC.OVL:0x0a24` |
| 6 | `NPC.OVL:0x0a04` · `NPC.OVL:0x1112` |
| 7 | `NPC.OVL:0x0a0c` · `NPC.OVL:0x111d` |
| 8 | `NPC.OVL:0x09de` |
| (variable) | `TOWN.OVL:0x00e3`, dentro de un bucle que escribe el mismo `ax` en `+0`/`+2`/`+4`/`+6`/`+0xA` — **contexto no leído**; por la forma parece borrado, y lo digo como parece, no como medido |

**Escritores de 2: exactamente DOS**, los que el encargo decía, y **no hay un tercero** —
comprobado con el predicado de la forma de puntero pelado (`mov word ptr [bx], 2` /
`mov word ptr [si], 2`) sobre el fichero entero, no sólo con la forma de desplazamiento
literal. Pero **6 y 7 tienen dos escritores cada uno**, y el segundo de cada par
(`0x1112`/`0x111d`) vive en otra rutina y decide por el mismo criterio de planta
(`0x1109`, comparación de `[bx+si+0x5d67]` contra `g_floor`).

## 5. Censo de CONSUMIDORES — 5 sitios, y ninguno es «pasabilidad»

Esto es lo que más pesa para no bautizar el campo:

| sitio | compara contra | contexto |
|---|---|---|
| `NPC.OVL:0x0b58` | **3** | dentro de una rutina que acaba de leer un tile del mapa vivo y lo compara con `0xC8`/`0xC9` |
| `NPC.OVL:0x0c00` | **2** | el predicado de movimiento — **la silla** |
| `NPC.OVL:0x0ea6` | **6** y **7** | en el despachador |
| `NPC.OVL:0x0f01` | **2** | en el despachador |
| `NPC.OVL:0x10ef` | **3** | en el despachador |

**Cuatro de los cinco están en el despachador de comportamiento**, y los valores que
consultan son justo los de transición de planta. ⇒ el sujeto del campo son las
**transiciones de planta**, y el efecto sobre la silla es **una consulta más**, no su
propósito. Leer «los de clase 2 se sientan» habría sido inventar: **2** no dice nada de
sentarse, dice que ni el NPC ni su destino salen de la planta visible.

## 6. Consecuencia para el port (ficha #37)

Ya estaba dicho y esta lectura lo endurece: el `+0` **no se puede sacar de los datos**
porque no es un dato. Reproducir «`== 2`» exige la máquina de §3 **más** el segundo
escritor de 2 (`0x0e9f`, en un camino distinto), y el port no modela ni el registro vivo ni
la noción de «planta visible» para NPCs fuera de la planta actual.

Y **el campo no se puede portar a medias**: cinco consumidores, cuatro de ellos ajenos a la
silla. Portarlo sólo para la silla dejaría los otros cuatro sin comparar.

## 7. Lo que esta ficha NO hace

- **No bautiza el campo.** Con seis valores, dos de ellos con dos escritores en rutinas
  distintas, y cinco consumidores repartidos, cualquier nombre corto sería una tesis.
- **No lee la rutina de `NPC.OVL:0x12e0`**, la que devuelve la ranura de horario. Todo el §3 la trata como
  caja negra: si devolviera algo distinto de un índice, la lectura de la máquina cambiaría.
- **No lee el despachador entero** (`0x0d00`-`0x1264`): sólo los cuatro tramos del §1. Puede
  haber más consumidores del `+0` dentro de él por formas de puntero que mi predicado no
  cubra — el censo del §5 es **cota inferior**, no cierre.
- **No lee el contexto de los tres escritores de fuera de este fichero** (`TOWN.OVL` ×2,
  `CMDS.OVL` ×1).
- **No toca el port.** No hay cambio de comportamiento en esta rama.

## 8. Cabo de instrumento, para el corpus

Al censar el desplazamiento de la tabla sobre todos los `.asm`, el fichero del kernel devolvió
una fila cuyo primer número es una DIRECCIÓN DE CÓDIGO y cuyo segundo número es la etiqueta
de destino de un `loop`, no un desplazamiento de dato. **No es una referencia a la tabla: es una DIRECCIÓN DE CÓDIGO**
que casa con el patrón. Es la misma familia que el falso positivo de un hex dentro de una
cadena base64 en el clon: **un hex desnudo no sólo colisiona con homónimos de otro overlay
— colisiona con código y con datos.** El discriminante barato es exigir la forma de
desplazamiento (`[reg + 0x5f5e]`) y descartar las columnas de dirección.
