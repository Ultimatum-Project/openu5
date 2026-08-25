# La rama `0xec`: DE DÓNDE sale la basura. Es el marco del CARGADOR DE OVERLAYS

> ## ⛔ PREMISA RETIRADA (#54 tanda 2, 28-07) — **NO HAY BASURA**
>
> Toda esta nota cuelga de que «la rutina nunca escribe esos 4 bytes». **Es falso.** Los
> escribe `DNGLOOK.OVL 0x1273-0x128c`: `rand(0,7)` CUATRO veces contra la tabla `DS 0x385e`
> (`DATA.OVL` fileoff 0x386e = `14 15 16 22 21 18 1f 18`), y el consumo `0x12ee-0x12f7` lee
> `pool[tile & 3]`. Es el «Random enemy groups» del wiki. La refutación por cuerpo, con el
> censo de aristas que la vuelve firme, está en [dnglook-117e-body.md](dnglook-117e-body.md) §2
> y [0xec-mecanismo-derivado.md](0xec-mecanismo-derivado.md) §1. Mecanismo **cableado** en
> `game/src/core/combat/combat.ts::rollEcGroupPool`.
>
> **★ Y un segundo error, en el §1**: «un único stub, un único llamador» sólo vale para el
> thunk PLINK86. Hay un **SEGUNDO llamador** que no pasa por él —`DUNGEON.OVL dng_enter_room
> 0x00b1-0x00b9`: `mov al,[bp+4] / push ax / mov ax,3 / push ax / call 0xfffffa6e`— y **pasa
> `arg1 = 3`**, no el `arg1 = 2` de `ULTIMA.EXE 0x6059`. Los dos entran por ramas distintas
> del gate `0x1248-0x1264` (`arg1 < 3` pasa siempre; `arg1 == 3` exige `arg2 > 0xef`), así que
> la diferencia **no es cosmética**: es justo lo que la tarjeta **#73** tiene abierto.
>
> Lo que de esta nota SIGUE EN PIE es la aritmética de pila y la identificación del stub
> `0x7c3e` → `0x117E` por la regla de banda. Se conserva por eso; no como explicación del 0xEC.

**Pregunta del lead**: la rama `0xec` de `DNGLOOK 0x12ea` coloca el remolino usando `si` = 4 bytes de
pila que la rutina nunca escribe. **¿Esa basura es DETERMINISTA?**

## 1. El punto de entrada es ÚNICO y con argumentos FIJOS

- `ULTIMA.EXE 0x6059: call 0x7c3e` — **el único `call 0x7c3e` de todo el desensamblado**.
- El stub `0x7c3e` es el formato PLINK86 de 12 bytes: `lcall 0x72e:0x2ec` (asegura overlay
  cargado) · `dw 0x000a` (overlay 10) · **`ljmp 0:0xb40e`**.
- Y la regla de banda cierra el círculo **al revés**: `0xb40e − near_call_base(DNGLOOK) 0xa290 =
  **0x117E**`. Es nuestra rutina.
- **`ljmp 0:0xb40e` aparece UNA sola vez** en el binario ⇒ **un único stub, un único llamador**.

Argumentos, fijos por construcción (`6052: sub ax,ax / push` + `6055: mov ax,2 / push`):
`[bp+6] = 0`, `[bp+4] = 2`.

⇒ **La profundidad de pila en la que corre `0x117E` es FIJA.** `SS:(bp−6)` es siempre la misma
dirección. Eso hace la pregunta del lead bien planteada: no es «basura aleatoria», es «un byte
concreto de la pila, escrito por lo último que pasó por ahí».

## 2. Y lo último que pasa por ahí es EL CARGADOR DE OVERLAYS

Aritmética de la pila, con `S` = `sp` del llamador antes de empujar:

| paso | sp |
|---|---|
| `push ax` ×2 (los 2 args) | `S−4` |
| `call 0x7c3e` (NEAR, 2 bytes de retorno) | `S−6` |
| stub: **`lcall 0x72e:0x2ec`** (far, 4 bytes) | `S−10` ← **el cargador corre aquí y MÁS ABAJO** |
| el cargador retorna (`retf`) | `S−6` |
| stub: `ljmp 0:0xb40e` (no empuja) | `S−6` |
| `0x117e: push bp` | `S−8`, y **`bp = S−8`** |
| `sub sp, 0x20` | `S−40` |

⇒ **`bp−6 = S−14`** y **`bp−3 = S−11`**. Ambos **por debajo de `S−10`** ⇒ **caen DENTRO de la
región que acababa de usar el cargador de overlays PLINK86** (`0x72e:0x2ec`) para su propio marco.

**Los 4 bytes que el remolino usa como índice son restos del CARGADOR DE OVERLAYS.**

## 3. Por qué eso NO es una respuesta tranquilizadora

El cargador PLINK86 no hace lo mismo cada vez: su primer trabajo es **comprobar si el overlay ya
está residente** (flag `0x8000` del registro de overlay, `re/tools/dispatch_table.py`
`overlay_table()`). Dos caminos muy distintos:

- **overlay YA cargado** → camino corto, sale casi inmediatamente;
- **overlay NO cargado** → lee del disco (`+10` offset, `+14` tamaño en párrafos), con toda la
  maquinaria de E/S y sus marcos anidados.

⇒ **Muy probablemente el valor DIFIERE según si DNGLOOK ya estaba residente.** Es decir: entrar dos
veces a la MISMA sala podría colocar el remolino con índices distintos, según lo que hubiera pasado
antes con la memoria de overlays. **El original sería no-determinista en ese punto** — y esa es la
peor de las respuestas para calcarlo.

**NO lo afirmo**: la aritmética de la pila está medida y el único llamador está probado, pero **el
camino interno del cargador no lo he trazado**. Es hipótesis derivada, no derivación cerrada.

## 4. El experimento que lo cierra (spec para el lote de oráculos)

Lo que hay que observar en DOSBox, **exactamente**:

> Punto de ruptura en **`DNGLOOK` file-offset `0x12f7`** (`mov al,[bx-6]`; en CS del overlay =
> `0xa290+0x12f7`). En cada parada, volcar **`SS:(BP−6) .. SS:(BP−3)`** (4 bytes) + el sprite crudo
> (`[BP−8]`) + `BP`.
>
> **Corridas mínimas (3)**:
> 1. Entrar a una sala con familia `0xec` **con DNGLOOK recién cargado** (primera entrada tras
>    arrancar/tras usar otro overlay que lo expulse).
> 2. Volver a entrar **a la misma sala** sin salir de la mazmorra (DNGLOOK ya residente).
> 3. Entrar a **otra** sala con `0xec` en la misma sesión.
>
> **Lectura**: si los 4 bytes son IGUALES en las tres ⇒ determinista, y ese valor es la tabla real
> a calcar. Si (1) difiere de (2) ⇒ **depende del estado de carga del overlay** ⇒ el original no es
> determinista ahí y el port debe declarar divergencia en vez de calcar.

Sala candidata para el probe: **combatmap 65 (Covetous r1)**, que tiene 6 unidades `sprite 237` y 1
`236` — la familia entera en un solo tablero.

## 5. Qué hacer mientras tanto (y por qué NO bloquea)

Nada. El `%4` conservado en `combat.ts` **ya descarta 236-239**, así que **ninguna unidad `0xec`
entra hoy al roster** y el comportamiento del port no cambia hasta que esto se derive. La
divergencia está declarada en el código con sus dos citas. Es el estado honesto: **sabemos que
divergimos, sabemos exactamente dónde, y no fabricamos la regla que nos falta.**
