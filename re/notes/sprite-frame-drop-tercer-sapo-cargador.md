# TERCER SAPO DEL CARGADOR, CONFIRMADO: el port TIRA las unidades cuyo sprite es un FRAME ≠ 0

**Encargo del lead**: «¿cómo deriva el original el tipo desde el sprite: tabla con paso 4 exigiendo
resto 0, o desplazamiento que tolera frames?»

**Respuesta: DESPLAZAMIENTO. Y no existe ninguna comprobación de resto en el binario.**

## La cita

`DNGLOOK.OVL`, el bucle de unidades que ya trazamos para el sapo `(0,0)` (el filtro `sprite == 0`
vive en `0x12ab`). Cuatro instrucciones más abajo está la derivación:

```
12ab: 0ac0        or al, al
12ad: 7503        jne 0x12b2
12af: e9d300      jmp 0x1385          ; sprite == 0 → saltar (el filtro ya conocido)
12b2: 3c40        cmp al, 0x40
12b4: 720f        jb  0x12c5          ; sprite < 0x40 → tipo 2 (no-enemigo)
12b6: 24fc        and al, 0xfc
12b8: 3cb4        cmp al, 0xb4
12ba: 7409        je  0x12c5          ; familia 0xb4 → tipo 2
12bc: 8a46f8      mov al, byte [bp-8]
12bf: 24fc        and al, 0xfc
12c1: 3ce8        cmp al, 0xe8
12c3: 750d        jne 0x12d2          ; familia 0xe8 (CAMPOS 0xE8-0xEB) → tipo 2
12d2: c746ee0000  mov word [bp-0x12], 0   ; ← tipo 0 = ENEMIGO
12d7: 8a46f8      mov al, byte [bp-8]     ;   sprite CRUDO, sin enmascarar
12dc: 2d4000      sub ax, 0x40
12df: d1e8        shr ax, 1
12e1: d1e8        shr ax, 1               ; ★ índice = (sprite − 0x40) >> 2
12e3: 8bf0        mov si, ax
```

**`(sprite − 0x40) >> 2`.** Desplazamiento puro sobre el sprite **crudo**: los 2 bits bajos
(el frame de animación) **se descartan al derivar el tipo, pero NO invalidan la unidad**.

**El mismo idioma, segunda cita independiente**: `COMBAT.OVL 0x185a-0x185f`
(`sub ax,0x40 / shr ax,1 / shr ax,1`), sobre el byte leído del roster `[bx + 0x5c5a]`.

**Y el negativo, barrido**: `and al,3` / `test al,3` / `and ax,3` **no aparecen ni una vez** en
`DNGLOOK.OVL.asm` ni en `COMBAT.OVL.asm`. **No hay rechazo por resto en ninguna parte.**

## El remate: el original USA los 2 bits bajos, y justo en la familia de #65

Cuatro instrucciones después de derivar el tipo:

```
12e5: 8a46f8      mov al, byte [bp-8]
12e8: 24fc        and al, 0xfc
12ea: 3cec        cmp al, 0xec
12ec: 7510        jne 0x12fe
12ee: 8a5ef8      mov bl, byte [bp-8]
12f1: 81e30300    and bx, 3            ; ★ los 2 bits bajos COMO ÍNDICE
12f5: 03dd        add bx, bp
12f7: 8a47fa      mov al, byte [bx-6]  ;   tabla local de 4 entradas
12fc: 8bf0        mov si, ax
```

**`0xec = 236`, y `236 = 0x40 + 43*4` = el sprite base del `Whirpool1` (i=43) — exactamente la
familia que puebla `#65`.** Para 236..239 el original **lee los 2 bits bajos como índice** de una
tabla de 4 entradas. Es la prueba más fuerte posible de que el frame **es dato con significado**, no
un sprite inválido: el binario lo *desreferencia*.

## El defecto en el port

`game/src/core/combat/combat.ts:667-673`:

```ts
private spriteToEnemyIndex(adjusted: number): number | null {
  if (adjusted === PIRATE_SHIP_SPRITE) return 8;
  if (adjusted < ENEMY_SPRITE_BASE || adjusted > ENEMY_SPRITE_MAX) return null;
  const off = adjusted - ENEMY_SPRITE_BASE;
  if (off % ENEMY_SPRITE_STRIDE !== 0) return null;   // ★ SIN CONTRAPARTIDA EN EL BINARIO
  return off / ENEMY_SPRITE_STRIDE;
}
```

y su llamador (`combat.ts:648-654`) hace `if (idx === null) continue;` ⇒ **la unidad se pierde
entera**. `sprite 237` → `493 − 320 = 173`, `173 % 4 = 1` ⇒ **descartada**.

**Impacto medido en `#65` (combatmap posición 65): 6 de 16 unidades tiradas**, todas remolinos
`sprite 237`, en `(5,1) (4,2) (2,1) (6,8) (2,8) (4,9)`. El port instancia 7 enemigos donde el
original instancia **13**.

## Alcance y consecuencias

- **Es el TERCER sapo del mismo cargador**: `(0,0)` (task #17, extractor) · éste (`%4`, core) ·
  y ambos **tocan determinismo** — menos combatientes = otro orden de iniciativa y **otro consumo
  de RNG**, así que el arreglo mueve digests igual que la merma de la Falsedad.
- **Refuerza la pista de `#65`**: si el veredicto se calcula con `enemiesAlive === 0`, pasar de 7 a
  13 «enemigos» (6 más de 0 HP y 0 daño) empeora la contabilidad, no la mejora. El DEADEND de #65
  sigue apuntando a arnés, ahora con más razón.
- **Barrido pendiente**: cuántas unidades pierde el port en las 128 posiciones, no sólo en la 65.

## Honestidad sobre lo que NO he pinchado

He confirmado **el idioma** (dos citas) y **la ausencia de test de resto** (barrido negativo), pero
**no he localizado la instrucción exacta donde el `.CBT` vuelca sus 16 slots al roster de combate**.
Para acusar al filtro no hace falta —el filtro es quien debe traer cita y no la tiene— pero lo dejo
dicho para que nadie lo lea como más de lo que es.

---

## BARRIDO DE LAS 128 POSICIONES — y una coincidencia que hay que mirar

```
unidades no-cero: 1573 · DESCARTADAS por el %4: 72 · salas afectadas: 13/128
peores: pos18:12/16 · pos50:8/16 · pos68:7/16 · pos66:6/16 · pos65:6/16 ·
        pos64:6/16 · pos74:5/16 · pos54:5/10 · pos69:4/16 · pos49:4/9 · pos67:3/16 · pos72:3/14
```

**Ocho de las trece son de COVETOUS** (base 64): posiciones 64,65,66,67,68,69,72,74 = r0,r1,r2,r3,
r4,r5,r8,r10. Y la peor de todas, `pos18` (Deceit r2), **pierde 12 de 16 unidades**.

**★ Los DOS flips de Covetous que seguían sin explicar están en la lista:**

| sala | unidades tiradas | estado |
|---|---|---|
| **pos64 = r0 = `#64`** | **6 de 16** | el outlier 3v3 ch24-vs-ch24b |
| **pos74 = r10 = `#74`** | **5 de 16** | el flip «sin diferencia de tablas» |

**No** afirmo que esto explique el split ch24/ch24b: el descarte es **determinista**, idéntico en
los dos capítulos, así que por sí solo no puede producir dos veredictos distintos con la misma
entrada. Lo que sí dice, y es grave: **los veredictos de `#64` y `#74` se calcularon sobre un
tablero equivocado** — con 6 y 5 combatientes de menos. Adjudicar cualquiera de los dos antes de
arreglar el cargador es adjudicar sobre datos incompletos.

Lo mismo vale para el digest entero de ch24: **8 de sus 16 salas** están afectadas.

---

# ⚠ CORRECCIÓN AL PREPARAR EL FIX: mi dirección era la EQUIVOCADA

Al medir QUÉ sprites tira el `%4` (paso previo a escribir el fix), el cuadro se da la vuelta.

## Los sprites descartados no son monstruos

```
sprite 235 x12  → i=42  PoisonField/x   stats = TODO CERO
sprite 237 x56  → i=43  Whirpool1/x     stats = TODO CERO
sprite 238 x3   → i=43  Whirpool1/x
sprite 239 x1   → i=43  Whirpool1/x
```

Los vecinos de tabla son monstruos de verdad (`i=41 Troll` `[18,17,9,4,15,15,4,15]`,
`i=44 MongBat` `[10,30,15,4,20,20,16,5]`). **Las ranuras 42 y 43 son PLACEHOLDERS**: nombre
`.../x` (= sin nombre mostrable, la rama `disp === "x"` de `enemyName`) y **stats todo a cero**.
No son enemigos: son **familias de sprite de TERRENO/OBJETO** que caen dentro del rango.

Y `235 & 0xfc = 0xe8` ⇒ **`235` pertenece a la familia que el binario excluye explícitamente**
(`DNGLOOK 0x12c1: cmp al,0xe8 / jne` → type 2 = NO enemigo). Concuerda con la nota de campos ya
existente: `0xE8`=veneno, `0xE9`=sueño, `0xEA`=daño (`COMBAT 0x1b1e`).

## Consecuencia: el `%4` es un PARCHE ACCIDENTAL, y lo que está roto es otra cosa

| sprite | binario | port HOY | veredicto |
|---|---|---|---|
| `232` (0xe8, campo) | **NO enemigo** (type 2) | **enemigo 42** (pasa el `%4`) | ★ **DEFECTO, 26 casos** |
| `235` (0xe8, campo) | **NO enemigo** | descartado por el `%4` | correcto **por accidente** |
| `236` (0xec, remolino) | rama especial `0x12ea` | enemigo 43 | **sin resolver** |
| `237-239` (0xec) | rama especial `0x12ea` | descartados por el `%4` | **sin resolver** |

**Un fix «desplaza en vez de exigir resto 0» habría METIDO 12 campos de veneno como combatientes.**
Retiro mi propuesta de fix de una línea; era incorrecta y la di por buena antes de mirar el dato.

## ★ Y esto reabre #65 con causa RAÍZ EN EL CORE, no en el arnés

Los «6 remolinos con 0 HP» de `#65` **no deberían existir como combatientes**. Si no lo fueran, la
sala tendría **1 enemigo real (el Ghost, `CanPassThroughWalls`)** y sería ganable. Con ellos,
`enemiesAlive === 0` es inalcanzable ⇒ **DEADEND por contabilidad**.

<!-- [MOVILIDAD t#27, 07-27 — re/notes/redux-flags-movilidad-barrido.md] El hallazgo de este
documento (los remolinos de 0 HP son combatientes fabricados por el cargador ⇒ DEADEND por
contabilidad) NO depende del flag y queda EN PIE. Lo que hay que retirar es el «y **sería
ganable**»: se apoya en que el Ghost alcanzaría a la party por `CanPassThroughWalls`, y ese campo es
CÓDIGO MUERTO en el port — nadie lo lee, ningún enemigo cruza muros. Que quede 1 enemigo real NO
implica ganabilidad: hay que JUGARLA. El mecanismo real del binario es la clase de movimiento
(kernel 0x2C4C, clase 4 = atraviesa muros) y a quién aplica no está derivado ⇒ probe #30. -->


⇒ La pista que di como «de ARNÉS» es en realidad **defecto del core**: el port fabrica
combatientes a partir de sprites de objeto. Mismo síntoma, culpable distinto — y esta vez el
culpable es nuestro.

## Lo que BLOQUEA escribir el fix

La rama `0x12ea` (familia `0xec`) pone tipo 0 (**enemigo**) y luego **sobrescribe `si` con
`[bp-6 + (sprite & 3)]`** — una tabla local de 4 entradas cuya inicialización **no he localizado**
(no está en el rango del bucle). Sin saber qué contiene, no sé si el remolino acaba siendo
combatiente, objeto, o efecto.

**No escribo el fix hasta resolver eso.** Escribirlo ahora sería exactamente el error que acabo de
cometer: decidir la dirección antes de leer el dato.

---

# La tabla de `0x12ea`: NO EXISTE. La vía DNGLOOK es un callejón (resultado negativo, acotado)

Encargo: averiguar qué contiene la tabla de 4 entradas que la rama `0xec` (remolino) usa para
sobrescribir `si`, y así saber qué es el remolino para el original.

**Resultado: esos 4 bytes NUNCA se escriben. La rama lee pila sin inicializar.**

## Lo medido

La función que contiene el bucle es `0x117e`, y es **la última del overlay** (el fichero acaba en
`0x13ae`): 218 instrucciones, `sub sp, 0x20`.

- **Escrituras a `[bp-6..bp-3]`: CERO.** Barrido por ENCODING, no por texto —
  `(88|89|8a|8b|c6|c7) 46 f[abcd]` (mod=01, rm=110 `[bp+disp8]`, disp `-6..-3`) — 0 aciertos en
  todo `0x117e..0x13ae`. Los locales que la función sí usa son `bp-2, -0xa, -0xc, -0xe, -0x16,
  -0x18, -0x1e, -0x20`.
- **`lea`: CERO** en las 218 instrucciones. **`push bp`/`push sp` como dirección: ninguno**
  (el único `push bp` es el del prólogo). ⇒ nadie puede recibir un puntero a ese local y
  rellenarlo desde fuera.
- Los marcos de los `call` viven **por debajo de `sp`** (`sp = bp − 0x20`), así que tampoco lo
  pisan.

## Detalle de codificación que conviene dejar escrito

```
12ee: 8a5ef8    mov bl, byte [bp-8]     ; sólo BL
12f1: 81e30300  and bx, 3               ; máscara de PALABRA → limpia BH ⇒ bx = sprite & 3
12f5: 03dd      add bx, bp
12f7: 8a47fa    mov al, byte [bx-6]     ; EA = bp + (sprite&3) − 6
```

`[bx+disp]` **usa DS por defecto**, no SS (sólo las formas con BP van a SS). Aquí da igual porque
el binario es **modelo small (DS == SS)** — el mismo segmento —, pero la distinción importa para no
leer mal otras citas: **no todo `[bx]` cerca de un `bp` es pila.**

## Qué se concluye y qué NO

- **NO puedo derivar de aquí qué es el remolino para el original.** La rama no aporta información:
  su valor es basura de pila.
- **NO declaro «bug del original»**: lo más probable es que en esta rutina de DNGLOOK ese valor
  acabe siendo irrelevante para esa familia (el `si` se pasa al `call 0xffffc276` y el llamado
  puede ignorarlo según el tipo). Afirmar un bug del original con esta evidencia sería el mismo
  salto que ya he tenido que retirar dos veces hoy.
- **La vía correcta es la otra**: el volcado `.CBT` → **roster de combate**. Anclas ya localizadas:
  el roster vive en **`0x5c5a`, stride 8** (`shl si,3`), y `COMBAT.OVL 0x1256-0x12a8` es su rutina
  de **BORRADO** (pone a 0 los 6 campos `0x5c5a..0x5c5f`), no la de carga. La carga es lo que falta.

**El fix del `%4`/familias sigue BLOQUEADO**, ahora por una razón mejor acotada: no es que no haya
mirado, es que la vía que parecía tenerla no la tiene.

---

# La vía del roster: DNGLOOK 0x1291 **SÍ ES** el cargador — y retiro lo de «pila sin inicializar»

## 1. CONFIRMADO: `ULTIMA.EXE 0x60EC` carga el registro `.CBT`

```
60fc: mov ax, 0x160     ; ★ 352 = tamaño del registro .CBT
6100: imul word [bp+4]  ; × índice de combatmap  → offset en el fichero
60f8: mov ax, 0xad14    ; destino del registro
6104: call 0x256e       ; lectura
```

Confirma de paso el tamaño 352 y que **el índice es posicional** ([[combatmap-index-array-position]]).
Luego copia 16 X (`0xaddf` = fila 6 col 11) y 16 Y (`0xadff` = fila 7 col 11) a `0x1704`/`0x1714`.

## 2. CONFIRMADO: el bucle de `DNGLOOK 0x1291` es EL CARGADOR DE UNIDADES

Lo tapaba exactamente el patrón del que avisó el lead: **constantes plegadas con desplazamiento
negativo**. Resueltas contra la base `0xad14`:

| instrucción | dirección | offset | significado |
|---|---|---|---|
| `12a4: mov al,[bx-0x524c]` | `0xadb4` | 160 | **fila 5, col 0 → SPRITE** |
| `1305: mov al,[bx-0x522c]` | `0xadd4` | 192 | **fila 6, col 0 → X** |
| `130f: mov al,[bx-0x520c]` | `0xadf4` | 224 | **fila 7, col 0 → Y** |

Es **exactamente** el layout de filas que usa el port. Y el bucle arranca con `0x10` (16 slots) en
`[bp-0xe]`/`[bp-0x20]`. ⇒ **La clasificación de `0x12b2-0x12e3` ES la autoridad** sobre qué acaba
siendo combatiente:

```
sprite == 0            → saltar
sprite < 0x40          → tipo 2 (NO enemigo)
(sprite & 0xfc)==0xb4  → tipo 2 (NO enemigo)
(sprite & 0xfc)==0xe8  → tipo 2 (NO enemigo)   ← los CAMPOS
resto                  → tipo 0 (ENEMIGO), índice = (sprite−0x40)>>2
```

## 3. ⚠ RETIRO «la rama 0xec lee pila sin inicializar»

Al comprobar el balance escritura/lectura de los locales por encoding:

| local | escrituras | lecturas |
|---|---|---|
| `bp-0x10` | **0** | 1 (`129b: mov di,[bp-0x10]`) |
| `bp-0x14` | **0** | 1 (`129e: mov si,[bp-0x14]`) |
| `bp-6` | 0 | 0 (sólo vía `[bx-6]`) |

**TRES locales leídos y nunca escritos.** Uno podría ser una rareza del original; tres es la firma
de un **listado incompleto o mal sincronizado**, no de un binario que lee basura. Mi conclusión
anterior no se sostiene: lo correcto es «**no puedo leerlo con este desensamblado**», no «no existe».

**Consecuencia**: la rama `0xec` (remolino) sigue **sin resolver**, pero el siguiente paso ya no es
buscar más — es **conseguir un desensamblado fiable de `0x117e-0x13ae`** (re-desensamblar ese rango
con sincronización correcta). Y el `%4` sigue bloqueado sólo por esa rama: las familias `0xb4` y
`0xe8` ya están derivadas y **bastan para el 26-casos del `0xe8`**.

---

# RE-DESENSAMBLADO: el listado era BUENO. Mi retirada era el error — la lectura sin inicializar es REAL

Re-desensamblado con capstone 5.0.7 (16-bit), barrido lineal desde el prólogo conocido `0x117e`
(`55 8bec 83ec20`, verificado contra el binario) hasta el final del fichero (`0x13b0`).
Mapeo dirección↔offset **1:1** (comprobado en dos puntos).

**Resultado: 218 instrucciones en los DOS listados, MISMOS límites, divergencia CERO.**
`old − new = ∅`, `new − old = ∅`. **El `.asm` del repo es correcto en este rango.**

## Entonces, ¿por qué tres locales leídos-y-nunca-escritos?

Porque mi heurística mezclaba dos cosas distintas. Verificado en el listado nuevo:

| local | lectura | siguiente escritura del REGISTRO destino | usos intermedios | qué es |
|---|---|---|---|---|
| `bp-0x10` | `129b: mov di,[bp-0x10]` | `131b: mov di, ax` | **ninguno** | **CARGA MUERTA** |
| `bp-0x14` | `129e: mov si,[bp-0x14]` | `12e3: mov si, ax` | **ninguno** | **CARGA MUERTA** |
| `bp-6..-3` | `12f7: mov al,[bx-6]` | — | — | **lectura REAL sin inicializar** |

Dos son **ruido del compilador** (carga a un registro que se sobrescribe antes de usarse).
Sólo una es una lectura de verdad.

⇒ **Mi «tres locales = listado mal sincronizado» fue un FALSO POSITIVO**, y la retirada que hice
sobre esa base queda anulada: **la rama `0xec` SÍ lee pila sin inicializar**, como dije al principio.

Y el cierre es sólido: `add bx, bp` (`0x12f5`) es la **ÚNICA** instrucción de toda la función que
mete una dirección de marco en un registro (barrido: no hay `lea`, no hay `mov reg,bp`, el único
`push bp` es el del prólogo) ⇒ **nada puede escribir esos 4 bytes**, ni dentro ni desde fuera.

## La heurística, corregida

> Un local leído-y-nunca-escrito **no** es señal de listado corrupto por sí solo: primero hay que
> descartar la **carga muerta** (¿se sobrescribe el registro destino antes de cualquier uso?). Sólo
> las lecturas que SÍ se usan cuentan como señal — y aun entonces, **la vía de verificación no es
> inferir sobre el listado: es re-desensamblar y diffear los límites de instrucción.**

Coste de la lección: dos mensajes y una retirada innecesaria. Valor: el detector queda con la
condición que le faltaba, y el `.asm` del repo queda **verificado** en este rango en vez de
sospechoso.

## Lo que sigue igual

`0xec` (remolino) sin resolver, y ahora **por una razón derivada, no por sospecha de la fuente**: el
original lee 4 bytes que nadie escribe. Antes de llamarlo bug del original falta lo único que puede
decidirlo: **qué hace `call 0xffffc276` con el `si` que recibe** cuando el tipo es 0. Si lo ignora
para esta familia, la lectura es inocua y el remolino simplemente no se coloca como combatiente —
que es justo lo que el port necesita saber.

---

# `0xffffc276` resuelto → `0x6506`. Y la respuesta al either/or: **el llamado USA `si`**

## Regla de banda, aplicada ANTES de abrir nada

```
near_call_base(DNGLOOK) = 0xa290
destino crudo           = 0xc276
(0xa290 + 0xc276) & 0xFFFF = 0x6506      ← por debajo de la banda de stubs (0x7A16-0x81C6)
                                            ⇒ rutina directa del kernel en ULTIMA.EXE
```

**Verificado**: `0x6506` es un prólogo real — `55 / 8bec / 83ec20` (`push bp; mov bp,sp; sub sp,0x20`).

## Mapeo de argumentos CONFIRMADO por el propio código

El call-site empuja `si, tipo, X, Y, floor` ⇒ `[bp+4]=floor, [bp+6]=Y, [bp+8]=X, [bp+0xa]=tipo,
[bp+0xc]=si`. Lo confirma la rutina: **`[bp+0xa]` se compara contra exactamente `2` y `0`**
(`651d: cmp word [bp+0xa],2` · `6526: cmp word [bp+0xa],0`) — los dos únicos valores que DNGLOOK
mete en `[bp-0x12]`. El mapeo no es supuesto: encaja por los literales.

## La respuesta a la pregunta del lead: **NO lo ignora — lo USA**

`[bp+0xc]` (= `si`) se lee en varias rutas:

```
653f: mov ax, [bp+0xc]   /  6542: shl ax,3  /  6549: add ax,0x13bd   ; tabla stride 8
6558: mov ax, [bp+0xc]   /  655b: shl ax,5  /  6562: add ax,0x55b3   ; tabla stride 32
663e: mov al, [bp+0xc]                                               ; y también en la otra rama
```

⇒ **La lectura sin inicializar de la familia `0xec` NO es inocua.** Se cruzó el puente que el lead
dejó planteado: el original coloca usando un parámetro que nadie escribió.

Dato corroborante: para `tipo == 0` la rutina hace `[bp-8] = 6` (`652c`) y luego escanea ranuras
de actor desde ahí (`6577: bx = di<<3` sobre `[bx-0x45ea]` = **`0xBA16`** = `0xBA14 + 2`, el campo
+2 de la tabla de actores) ⇒ **las ranuras 0-5 son la party y los enemigos empiezan en la 6.**

## ⚠ Y AQUÍ ME PARO: no derivo esta rutina a fragmentos

Mi primera lectura fue **incorrecta** y la cazo antes de reportarla como resultado: leí
`6523: jmp 0x6625` y lo tomé por «tipo 2 ⇒ sale sin colocar». **Falso.** `0x6625` no es la salida:

```
6625: cmp word [bp-6], -1      ; [bp-6] vale 0xffff (puesto en 6518) ⇒ no salta
662b: cmp word [bp+0xa], 2
662f: je 0x6634                ; tipo 2 → SIGUE, no sale
6634: sub si,si / 6636: ... / 663e: mov al,[bp+0xc]
```

La rutina llega al menos hasta `0x674c` (~600 bytes) y ramifica por `tipo` en **dos** sitios
distintos. **Leer media rutina y clasificarla entera es exactamente el error que ya he cometido dos
veces hoy** (0x12DE, DNGLOOK 0x117E). No lo hago una tercera.

**Estado**: la pregunta binaria («¿usa `si`?») está contestada —**sí**—. La clasificación completa
por `tipo` (qué acaba colocado y cómo) **exige leer `0x6506-0x674c` entera**, y eso es lo siguiente.
Hasta entonces **no afirmo qué hace el original con los campos `0xe8`**, aunque el port sí tiene un
defecto claro por otra vía (convierte sprites de objeto en combatientes con stats a cero).

---

# `0x6506-0x674c` LEÍDA ENTERA: la clasificación, derivada. Dos tablas, no una

La rutina tiene **dos fases** y ésa es la clave que los fragmentos escondían.

## FASE 1 — ranura de ACTOR (`0xba14`, stride 8). Sólo tipos 0 y 1

```
650e: [bp-8]=0 · [bp-4]=0 · [bp-6]=0xffff
651d: cmp [bp+0xa],2 / jne / jmp 0x6625     ; ★ tipo 2 SE SALTA LA FASE 1 ENTERA
6526: cmp [bp+0xa],0 / jne / [bp-8]=6       ; ★ tipo 0 (enemigo) arranca en la ranura 6
6531: [bp-4]=[bp-8] ; if >= 0x20 → 0x6625   ; 32 ranuras
6577: bx=di<<3 ; cmp [bx-0x45ea],0          ; -0x45ea = 0xBA16 = actor[di].+2
6582:   != 0 → 0x66e6: inc di ; < 0x20 → reintenta ; si no, sale
6587: si = di<<3 + 0xba14                   ; puntero a la ranura
658f: [bp-6] = di                           ; ranura tomada (deja de ser -1)
65c5: cmp [bp+0xa],0 / jne 0x660d           ; bloque de ENEMIGO:
65cb:   [si+0] = [ [bp+0xc]<<3 + 0x13c1 ]   ;   dato de tabla por ÍNDICE DE MONSTRUO
65d2:   push 7 / call 0x3aae                ;   ★ RNG (kernel rand0) → di, −4
65e0:   al = rand−4 + [ idx<<3 + 0x13bd ] ; [si+1]=al ; clamp a 0x1e
65f1:   [si+5] = 0x24 − [si+1] ; [si+2] = 0x40
65fd:   if idx==8 || idx==9 → [si+2] = 0x20
660d: [si+3] = [bp+0xc]  ← ★ EL ÍNDICE DE MONSTRUO
6613: [si+6] = X   ·  6619: [si+7] = Y
```

⇒ **Las ranuras 0-5 son la party; los enemigos entran desde la 6.** Y la creación de un enemigo
**consume RNG** (`call 0x3aae`, rand(0..7)−4 sobre un valor base de tabla) — dato que importa para
el determinismo: **cada unidad de más o de menos mueve el stream.**

## FASE 2 — entrada en la tabla de OBJETOS (`0x5c5a`, stride 8, 32 entradas). TODOS los tipos

```
6634: si=0 ; [bp-0x14]=[[bp-2]]
663e: al=[bp+0xc] ; shl al,1 ; shl al,1 ; add al,0x40   ; ★ sprite = (índice<<2)+0x40
664a: di=0x5c5a … campos 0x5c5b/0x5c5c/0x5c5d/0x5c5e/0x5c5f/0x5c61
667d: cmp byte [di],0 → libre? si no, 0x671c: avanza 8 y si<0x20 reintenta
6685: cx==0 (ENEMIGO) → actor.[+4]=si ; [di] = sprite RECONSTRUIDO
669a: cx==1            → actor.[+4]=si
66a6: cx==2 (OBJETO)   → [[bp-0xa]] = [[bp-0xc]] = [bp+0xc]  ← ★ el sprite CRUDO
66bb: +0x5c5c=X · +0x5c5d=Y · +0x5c5e=floor · +0x5c61=0xff
66d9: cx==0 → +0x5c5f=[bp-0x14]  ; si no → +0x5c5f=[bp+0xc]
```

## LAS TRES CONCLUSIONES

**1. `tipo 2` NO es «no se coloca»: es «se coloca como OBJETO, no como COMBATIENTE».** Salta la
fase 1 entera (`0x6523`) ⇒ **nunca recibe ranura de actor en `0xba14`** ⇒ **no es combatiente**,
pero sí entra en la tabla `0x5c5a` con su **sprite CRUDO** (`66a6-66b8`), con X/Y/floor.
⇒ **Los CAMPOS (`0xE8-0xEB`), la familia `0xb4` y los sprites `<0x40` son OBJETOS.**
**El port los convierte en combatientes (sprite 232 → enemigo 42, 26 casos). DEFECTO CONFIRMADO.**

**2. El original NORMALIZA el frame él mismo.** `663e-6647` reconstruye el sprite como
`(índice << 2) + 0x40` — **el frame de animación se pierde por diseño**. Combinado con
`(sprite−0x40)>>2` a la entrada: el original hace sprite→índice→sprite-base y **trata `237` igual
que `236`**. ⇒ **el `%4` del port, que TIRA la unidad, no tiene ninguna base: la unidad existe y es
del mismo tipo que su frame 0.** DEFECTO CONFIRMADO (60 casos de la familia `0xec` + 12 del `0xe8`,
éstos ya cubiertos por el punto 1).

**3. Crear un enemigo CONSUME RNG** (`65d2: push 7 / call 0x3aae`). Cualquier cambio en el número de
unidades **mueve el stream de combate**. Esto ratifica el aviso: los veredictos de las 13 salas
afectadas (r0/r10 incluidos) están calculados sobre otro stream, no sólo sobre otro tablero.

## Lo que sigue abierto (y ya no bloquea el fix)

La rama `0xec` de DNGLOOK (`12ea-12fc`) sustituye el índice por la lectura sin inicializar. Con la
rutina entera leída sé **para qué se usa** ese índice (tabla `0x13bd`/`0x13c1` de stats, campo `+3`
del actor, y el sprite reconstruido), pero **no de dónde sale el valor**. Queda como **residual
acotado**: no impide derivar los puntos 1 y 2, que son los que gobiernan el fix.

---

# EL FIX, ESCRITO — y su ALCANCE recortado por el dato

## Lo que entra

**Exclusión de los tipos-2 del roster** (`combat.ts`, `isArenaObjectSprite` + guarda en el bucle
de unidades de mazmorra). Cita: `DNGLOOK 0x12b2/0x12b8/0x12c1` + `ULTIMA.EXE 0x651d`.
Retira **14 combatientes falsos** (sprite 232 → «enemigo 42 `PoisonField/x`», stats todo a cero).
Añadida también la guarda `sprite === 0` explícita (`DNGLOOK 0x12ab`), que antes se conseguía
de rebote por el chequeo de rango.

## Lo que NO entra, y por qué el dato lo decide

La normalización de frame **queda fuera**, contra mi propia propuesta de hace un rato. Razón,
medida sobre los 128 combatmaps:

```
familia 0xe8: 232 ×14 · 235 ×12      ← excluidos por FAMILIA (fix actual)
familia 0xec: 236 ×84 · 237 ×56 · 238 ×3 · 239 ×1
familia 0xb4: NINGUNA aparición
sprites > 252: NINGUNO
```

**El 100% de las unidades con frame≠0 son o de la familia `0xe8` (235, ya excluida por familia) o
de la familia `0xec` (237/238/239 = 60 unidades).** Es decir: **retirar el `% 4` no tendría ni un
solo efecto derivado** — todo su impacto caería sobre la familia `0xec`, cuya rama de DNGLOOK
(`0x12ea-0x12fc`) sustituye el índice por la lectura sin inicializar. Haría aparecer **60
combatientes `Whirpool/x` de stats CERO** sobre base no derivada — justo el patrón que provoca el
DEADEND-por-contabilidad de `#65`.

⇒ El `% 4` se queda, **con la divergencia DECLARADA en el código** (cita del desplazamiento
`0x12dc` y del recompuesto `0x663e`) y guarda que impide silenciarla. Ticket abierto: resolver
`0xec`.

## Gates

`tsc --noEmit` **EXIT=0** · guardas nuevas `tests/cbt-unit-classification.test.ts` **10/10** ·
gate acotado combate/salas (`combat`, `combat-exact`, `fiel-combat`, `room-entry`, `room-triggers`,
`conquer-room-plates`, `dungeon-room-cleared`, `ranged-room-drive-r15`, `combat-seed`)
**9 ficheros / 114 tests VERDES**.

## TICKET SEPARADO (petición del lead): la SIEMBRA de objetos-campo

La fase 2 (`0x6634-0x674c`) demuestra que el original **coloca los tipos-2 en la tabla de objetos
`0x5c5a`** con sprite CRUDO, X, Y y planta. El port, además de meterlos en el roster (lo que este
fix corrige), **no los siembra como objetos** — ~~y `combat.ts:599` descarta también los objetos-campo
`0x70` del `.CBT`~~ [TACHADO 2026-08-23, carril cargador-ticket-amplio: cita de port FALSA —
`71a3d20a:game/src/core/combat/combat.ts:599` es `sleeping: false` (un literal de `makeEnemy`), y
ningún `combat*.ts` de ese árbol ni `extractor/src/parsers/combatmap.ts` filtra nada `0x70` del
`.CBT`. El sprite `0x70` de fila 5 no es un campo: es el GUARDIA — tipo 0, índice `(0x70−0x40)>>2
= 12` = GUARDS, que el port crea igual que el binario. Derivación completa:
`cargador-ticket-amplio-0xb4-0xe8-0x70.md` §4]. ⇒ **las arenas del port están más vacías que las del
original en ~~las dos categorías~~ la categoría de objetos sembrados.** Esto convierte en DERIVACIÓN
el supuesto viejo de `[[arena-fields-encoding]]`
(campos In*Grav `0xE8-0xEB` sin modelar). **No lo toca este fix**: es alcance propio, con esta cita.
