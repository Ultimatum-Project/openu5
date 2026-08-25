# Goal §2 «frontera sin INFER ni sin-ID» — MEDIDO: un eje ya está a CERO y el otro son TRES

Fecha: 2026-07-30. Estado: **medición + 2 de las 3 derivadas por lectura**; la 3ª acotada.

## 1. El encuadre estaba inflado

El goal pide la frontera «sin INFER ni sin-ID». Medido sobre `re/ledger/frontier.json`
(885 rutinas), los dos ejes están en sitios muy distintos:

| eje | estado |
|---|---|
| **sin-ID** | **CERO.** El `summary` declara `unnamed_routines: 0` y `placeholder_names: 0`, y un barrido propio por patrón de nombre-marcador (`sub_/fn_/routine_/unk_`) confirma 0. **Este eje ya está cumplido.** |
| **INFER** | **TRES.** No hay ninguna con status exacto `INFER`; hay 3 con `INFER-game`, todas con `deferred_reason: game-leaf-pending-B`. |

Reparto de status: `IDENT` 719 · `driver` 163 · `INFER-game` 3. Y `unexplained: 0`.

⚠ Ojo con el filtro: buscar `status == "INFER"` da **0**, que se lee como «no queda ninguna»
y es falso — el valor real es `INFER-game`. Prefijo, no igualdad.

## 2. Las TRES, y dos de ellas quedan derivadas aquí

### 2.1 `ULTIMA.EXE 0x6f90` (14 B, depth E) — es un `strlen` de manual

Cuerpo entero, verbatim:

```
6f90: 32c0        xor al, al          ; buscar el terminador 0
6f92: b9ffff      mov cx, 0xffff      ; sin tope efectivo
6f95: 8bdf        mov bx, di          ; guarda el puntero de entrada
6f97: f2ae        repne scasb         ; avanza ES:DI hasta el 0
6f99: 2bfb        sub di, bx          ; longitud + 1 (DI quedó UNA pasada el 0)
6f9b: 4f          dec di              ; ⇒ longitud SIN el terminador
6f9c: c3          ret
```

Entrada `ES:DI`, salida en `DI`. No hay ninguna ambigüedad: el nombre que ya lleva es
exacto y **no queda nada pendiente**. Su condición de «leaf-pending-B» se explica sola: no
tiene marco de pila y los argumentos entran por REGISTRO, así que la vía de análisis por
prólogo/argumentos no la alcanzaba — la familia de [[asm-prologos-ocultos-pad-byte]].

### 2.2 `FONT.OVL 0x0e7b` (37 B, depth B) — restaura pantalla desde el búfer, y hay PAR

```
0e7e: 56 57 1e             push si / di / ds
0e81: 8b360c52   mov si, word ptr [0x520c]   ; ORIGEN = el búfer
0e85: 33ff       xor di, di                  ; destino offset 0
0e87: 8e065453   mov es, word ptr [0x5354]   ; destino SEGMENTO, de una global
0e8b: 0e 1f      push cs / pop ds            ; ★ el búfer vive en el segmento del OVERLAY
0e8d: b90018     mov cx, 0x1800              ; 6144 words = 12288 bytes
0e90: f3a5       rep movsw
```

La DIRECCIÓN —que es lo único que el nombre afirma— se cierra por el **hermano**: en
`FONT.OVL 0x0e58` la misma global `[0x520c]` se carga en **DI** (`0e65`), o sea como
DESTINO ⇒ ese guarda, y éste (que la carga en **SI**) restaura. Par simétrico, nombre
correcto. `[0x5354]` tiene **un solo escritor** en todo el corpus (`ULTIMA.EXE 0x0f3b`).

**Lo que NO afirmo**: qué es exactamente el área de 12288 bytes. La derivé como magnitud,
no como geometría, y no la voy a bautizar sin cita.

### 2.3 `CAST.OVL 0x05dc` (368 B, depth B) — la única de verdad abierta

`in_por_blink_teleport`. Es diez veces más grande que las otras dos y su evidencia ya
apunta a callees resueltos por stub hacia COMBAT (`dng_enter_room` y otro en `0x120e`).
**Queda como la ÚNICA con trabajo real**; no la despacho de paso.

## 3. Estado del ítem del goal, sin adornar

- eje **sin-ID**: **cumplido** (0/885).
- eje **INFER**: de 3 quedan **1** con derivación pendiente; las otras dos están leídas
  enteras aquí y no tienen nada que derivar.

⚠ **NO toco `frontier.json`.** El fichero se GENERA desde `routine-census.json`, cuya
regeneración está vetada por #84 (ctx pegajoso de `build_name_seeds`): editar el status a
mano crearía una discrepancia que la siguiente regeneración borraría en silencio. La
promoción de estas dos a `IDENT` va **con la ventana de instrumento de #84**, y esta acta
es su insumo — la derivación ya no hay que rehacerla.

## 4. ★ La tercera TAMBIÉN se deriva — y trae mecánica con número

El blink de In Por — ficha ya existente del ledger, `CAST.OVL` 0x05dc. Leída su rama de mazmorra entera
(`0x05dc-0x067f`), verbatim del disasm:

**(a) El gate de entrada es el de #184 — con una PRECISIÓN que me corrige.**

```
05e9: 803e93587f  cmp byte ptr [g_location], 0x7f
05ee: 7703        ja 0x5f3        ; > 0x7f ⇒ MAZMORRA, esta rama
05f0: e98d00      jmp 0x680       ; si no, la otra
```

Es exactamente el umbral de la regla «`g_location` ≥ 0x80» que #184 cerró — **corroboración
independiente**, en otro overlay.

⚠ **Pero yo llamé a esta rama «de MAZMORRA» y es impreciso.** El port la etiqueta
«COMBATE» (`magic/blink.ts`, cabecera), y su cuerpo le da la razón: usa `g_cmb_actor` y
escribe en la tabla de actores de combate. Las dos etiquetas NO se contradicen —las salas
de mazmorra SON escenas de combate, y por eso alcanzan esta rama: al entrar en sala se
escribe 0xFF—, pero la buena es **«la rama de ESCENA DE COMBATE»**, y la mazmorra es un
caso que entra por ahí, no el nombre de la rama. Corregido sin borrar lo anterior.

**(b) Hay un GATE que ABORTA el blink, y nadie lo tenía fichado.**

```
060b: f606a15802  test byte ptr [g_unk_58a1], 2
0610: 7408        je 0x61a
0612: c746f60000  mov word ptr [bp - 0xa], 0   ; ⇒ devuelve FALLO
0617: e92901      jmp 0x743
```

El bit de valor **2** de esa global hace que el hechizo falle **antes de intentar nada**.
★ Es la MISMA global cuyo bit de valor 4 adjudicó #275 (`blindOrRoom`, hoy un placeholder
fijo a `false` en el port) — o sea el mismo byte lleva al menos dos banderas distintas, y
ésta no está en ninguna nota.

**(c) ★★ El blink hace hasta SIETE intentos, y si ninguno vale, falla.**

```
0621: 2bff        sub di, di            ; contador
0630: e8e3b8      call ...              ; propone una casilla
0633: 0bc0/7509   or ax,ax / jne        ; ¿propuesta válida?
0637: 47          inc di
0638: 83ff07      cmp di, 7             ; ★ SIETE
063b: 7d3c        jge 0x679             ; agotado ⇒ sale con fallo
0640..064b:       push tile + scratch_x + scratch_y / call (test de destino)
064e: 0bc0/74e5   or ax,ax / je 0x637   ; destino malo ⇒ otro intento
0652-0671:        ESCRIBE scratch_x/y en DOS sitios (tabla de actores ×8 y el
                  registro de 0x5C5A en +2/+3)
0674:             marca ÉXITO
```

El «7» es un **inmediato literal**, no una inferencia. Y la doble escritura confirma por
tercera vía lo de #229: aquí `g_cmb_scratch_x/y` son **ABSOLUTOS**, porque se copian tal
cual como coordenadas del actor.

⇒ **Las TRES quedan derivadas.** El eje «INFER» del goal §2 no tiene ya ninguna rutina con
trabajo de lectura pendiente; lo único que resta es la promoción de status, que va con la
ventana de #84 por lo dicho en §3.

**Cola nueva que sale de aquí** (no la despacho, la dejo nombrada y con su cita):
1. ¿Modela el port el **tope de 7 intentos** del blink en mazmorra, o reintenta hasta
   encontrar hueco? Si no lo modela, es divergencia de mecánica Y de stream RNG.
2. El **bit 2 de `g_unk_58a1`** no tiene ficha ni consumidor conocido en el port —
   hermano del bit 4 de #275.


## 5. ★ Y del «7» sale una DIVERGENCIA REAL con el port

Careado contra el clon (`core/combat/combat.ts`, `castBlink`):

```ts
private castBlink(caster: Combatant): void {
  const cell = randomAdjacentCell(caster.x, caster.y, this.crng);
  if (this.isWalkable(cell.x, cell.y) && !this.occupantAt(cell.x, cell.y)) { … }
}
```

**Un solo intento.** Si la celda propuesta no vale, el lanzador NO se mueve y ahí acaba.
El original prueba **hasta siete** (§4c) y sólo falla si las siete salen mal.

⇒ Divergencia por **dos ejes a la vez**:
1. **Mecánica**: el blink del original acierta MUCHO más a menudo; el del port falla en
   cuanto la primera propuesta está ocupada o es intransitable.
2. **Stream RNG**: el original consume entre 1 y 7 tiradas del generador; el port consume
   exactamente 1. Cualquier cosa que dependa del stream detrás de un blink se desalinea.

⚠ Lo que NO afirmo: que el generador de candidatas del original sea «adyacente». El port lo
llama `randomAdjacentCell`, pero la rutina que propone la casilla en el binario es un callee
que **no he leído** — la adyacencia es afirmación del port, no derivación mía. Antes de
calcar el bucle de 7 hay que leer ese callee, porque el tope y el generador se portan juntos
o no se portan.

## 6. ★★ La precondición de §5 se RESUELVE — y el port no falla en el conteo: falla en la GEOMETRÍA

En §5 dejé como precondición leer el callee que propone la casilla, porque «adyacente» era
afirmación del port y no derivación mía. Leído (`COMBAT.OVL 0x120e`, cuerpo entero, verbatim):

```
120e: b80f00      mov ax, 0xf
1211: 50          push ax
1212: e80986      call ...                      ; tirada con tope 15
1215: a37658      mov word ptr [g_cmb_scratch_x], ax
1218: b80f00      mov ax, 0xf
121b: 50          push ax
121c: e8ff85      call ...                      ; SEGUNDA tirada
121f: a37858      mov word ptr [g_cmb_scratch_y], ax
1222: 833e76580a  cmp word ptr [g_cmb_scratch_x], 0xa
1227: 7f05        jg 0x122e                     ; x > 10 ⇒ rechaza
1229: 3d0a00      cmp ax, 0xa
122c: 7e04        jle 0x1232                    ; y <= 10 ⇒ ACEPTA
122e: 2bc0        sub ax, ax                    ; 0 = rechazo
1232: b80100      mov ax, 1                     ; 1 = acepta
```

⇒ **Coordenadas ABSOLUTAS al azar en 0..15, aceptadas sólo si x ≤ 10 y y ≤ 10** — es decir
**una celda cualquiera de la arena de 11×11**. **NO es adyacente al lanzador.** El nombre
`randomAdjacentCell` del port describe otra cosa.

### Lo que esto cambia respecto de §5

| | original (derivado) | port |
|---|---|---|
| destino | celda al azar de **toda la arena 11×11** | una casilla **vecina** |
| intentos | hasta **7** | **1** |
| tiradas de RNG | **2 por intento** ⇒ **2..14** | las de `randomAdjacentCell` |

El fallo grande **no es el tope de 7**: es que el hechizo teletransporta **a cualquier punto
del campo** y el port sólo lo mueve una casilla. El «7» es consecuencia — con ~31 % de
rechazo por eje hacen falta varios intentos para caer dentro del 11×11.

★ Y esto **desbloquea** la precondición que yo mismo había puesto: el generador ya está
derivado, así que el tope y el generador **se pueden portar juntos**, que era la condición.
La tarjeta #286 pasa de «bloqueada por lectura» a **ejecutable**.

⚠ Lo que sigue SIN derivar (y hay que leerlo antes de tocar código): qué hace exactamente la
rutina de tirada con el argumento 15 —si devuelve 0..15 o 1..15 cambia el borde— y el
`call` de test de destino que el llamante hace en CAST 0x064b — el que decide si la celda
elegida vale.
Sin esos dos, el conteo de tiradas es una COTA, no una cifra.

## 7. El borde queda fijado — y lo fija la propia arena

Resuelto el primero de los dos huecos de §6. La tirada del generador es `rand0`, ficha
IDENT del kernel en 0x3AAE, y su cuerpo entero es un envoltorio de UN argumento:

```
3aae: 55        push bp
3aaf: 8bec      mov bp, sp
3ab1: 2bc0      sub ax, ax        ; ★ el otro extremo es CERO, literal
3ab3: 50        push ax
3ab4: ff7604    push word ptr [bp + 4]
3ab7: e8d8e5    call 0x2092       ; el generador de dos extremos
3abb: c20200    ret 2
```

(Resuelto con `near_calls_to_kernel`, que confirma que **los dos** call-sites del generador
—`COMBAT 0x1212` y `0x121c`— caen aquí.)

⇒ La tirada va **entre 0 y 15**, y la ventana de aceptación es **0..10**: exactamente
**once** valores por eje. **11 × 11 = la arena.** Que el número de valores aceptados coincida
al dedo con el tamaño del campo es corroboración independiente de que el borde está bien
leído — no hace falta adjudicar aquí si el generador de dos extremos incluye el 15, porque
ese extremo cae del lado RECHAZADO en los dos casos.

Queda **un** hueco de los dos: el test de destino que el llamante hace en `CAST` 0x064b.
Ése decide si la celda elegida es pisable, y sin él el consumo de RNG sigue siendo una COTA
(2..14) y no una cifra.

## 8. ~~El último hueco NO se cierra~~ — LA CONTRADICCIÓN ERA MÍA (corregido en §9)

Seguido el `call` del llamante en `CAST` 0x064b. La evidencia del ledger lo resuelve por
stub a `COMBAT.OVL` 0x0000, cuyo cuerpo empieza así (verbatim):

```
0008: 837e060a  cmp word ptr [bp + 6], 0xa     ; y > 10 ⇒ fuera
000c: 7f12      jg 0x20
000e: 837e040a  cmp word ptr [bp + 4], 0xa     ; x > 10 ⇒ fuera
0012: 7f0c      jg 0x20
0014..001e:                                    ; y < 0 / x < 0 ⇒ fuera
0020: b80100    mov ax, 1                      ; ★ FUERA devuelve 1
0026..0039:     lee el tile en (x,y) y lo pasa a un test de pasabilidad
```

Eso es un **«¿está bloqueada esta celda?»**, y de paso da la **tercera** corroboración
independiente del 11×11 (acota 0..10 en los dos ejes, igual que §6 y §7).

⚠ **Pero la polaridad choca con el llamante.** En `CAST`:

```
064e: 0bc0      or ax, ax
0650: 74e5      je 0x637        ; ax == 0 ⇒ OTRO INTENTO
0652: …                          ; ax != 0 ⇒ ÉXITO, escribe las coordenadas
```

⇒ el llamante trata **`ax != 0` como éxito**, y la rutina de arriba devuelve **1 justo
cuando la celda está FUERA de la arena**. Leídas las dos juntas, el blink aceptaría las
celdas imposibles y reintentaría con las buenas: **absurdo**.

**Conclusión honesta: la resolución del callee por stub NO es de fiar aquí, o he leído mal
la polaridad de uno de los dos lados.** No adjudico ninguna de las dos posibilidades. Lo que
NO voy a hacer es elegir la lectura que me conviene para cerrar el hueco — es exactamente la
forma de fabricar un veredicto.

⇒ **#286 queda ejecutable en su parte grande** (destino = arena entera, §6, con tres
corroboraciones del 11×11) y **bloqueada en el conteo de tiradas** hasta resolver este par.
La señal de que algo falla —una polaridad que hace absurdo el comportamiento— vale más
apuntada que forzada.


## 9. ★ CORRECCIÓN de §8: no había contradicción — comparé una rama INALCANZABLE

§8 se quedó a una lectura de distancia y sacó una alarma falsa. Lo que faltaba:

**(a) La rama de «fuera de la arena» NO se alcanza desde este llamante.** El bucle es:

```
0630: call …           ; el GENERADOR
0633: 0bc0 / 7509      ; ax != 0 ⇒ ir al test de destino
0640..064b:            ; test de destino
064e: 0bc0 / 74e5      ; ax == 0 ⇒ contar intento y reintentar
```

El generador ya **filtra** fuera-de-rango (§6: acepta sólo x≤10 y y≤10) **antes** de que se
llame al test. Así que el `mov ax, 1` del test para coordenadas fuera de la arena es código
al que este llamante no llega nunca. Comparar ESE retorno con la semántica del llamante fue
mi error: es una rama muerta *para este sitio*, viva para otros.

**(b) La rama que SÍ se alcanza devuelve 0, y encaja.** La cola del test:

```
003c: 0bc0      or ax, ax        ; ¿pasa el test de pasabilidad del tile?
003e: 7503      jne 0x43         ; sí ⇒ sigue comprobando
0040: e90101    jmp 0x144
0144: 2bc0      sub ax, ax       ; ★ NO pisable ⇒ devuelve 0
014b: c20600    ret 6            ; (3 args, coherente con los 3 push del llamante)
```

⇒ **tile no pisable → 0 → el llamante reintenta.** Exactamente lo que tiene que pasar. No
hay absurdo, no hay stub mal resuelto, y el `ret 6` confirma los 3 argumentos que el
llamante empuja.

### Lo que esto deja

- El bloqueo de §5/§8 **se disuelve**: el consumo es **2 tiradas por intento** (§6) con
  **tope 7** (§4c) ⇒ **2..14 por lanzamiento**, y ahora sí como cifra derivada y no como
  cota tomada por miedo.
- ⚠ Sigue sin adjudicar —y no hace falta para #286— **por qué** el test devuelve 1 fuera de
  rango y 0 para no-pisable, que son polaridades opuestas para «ahí no puedes ir». Eso es
  asunto de sus OTROS llamantes, no de éste.

★ La lección, que es la que vale: **una «contradicción» puede ser un artefacto de mirar una
rama que el flujo real no toca**. Antes de declarar que dos piezas se contradicen hay que
comprobar que el camino que las une existe. Aquí lo escribí como bloqueo y era un espejismo
de una lectura incompleta.
