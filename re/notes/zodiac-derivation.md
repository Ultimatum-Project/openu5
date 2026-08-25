# Zodíaco del catalejo — derivación del ASM (LOOKOBJ.OVL)

**Carril:** fiel (flota del lead) · **Fecha:** 2026-07-18 · **Rama:** `fiel/zodiac`.
**★ CORREGIDA 2026-07-28 (tarea #70, rama `fix/zodiaco-transpuesto`):** la versión del 18-07
tenía los EJES INTERCAMBIADOS en todo el bloque de dibujo (y el port la calcó así). Los
INMEDIATOS eran correctos; lo que estaba mal era qué push es la X. Ver §«Orden de ejes» y
§«Errata» al final: la nota se delataba sola (usaba como x la tabla que ella misma etiqueta
«row», y el recorte que transcribía acota el argumento que sale de la tabla de COLUMNA).

## Orden de ejes — DERIVADO (no inferido del dibujo)

Las dos primitivas del kernel toman la **X primero**, y eso se deriva sin mirar la figura:

- `plot` = LOOKOBJ `0x69d4` → base near-call `0xa290` → ULTIMA.EXE **`0x0c64`**. Hace `ret 4`
  (limpieza por el callee ⇒ PASCAL ⇒ los args se apilan de izquierda a derecha y `[bp+6]` es el
  PRIMER push). `0x0c6a`: `mov ax,[bp+6]` → `[0x52cc]`; `0x0c6d`: `mov bx,[bp+4]` → `[0x52ce]`.
- **`[0x52cc]` es X y `[0x52ce]` es Y**, por tres vías independientes:
  1. `draw_hline` `0x0c9c` escribe en `[0x52cc]` su CX, y su recortador `0x0ccd` normaliza
     `ax≤cx` y compara **AX y CX contra `0x13f`=319** = X máxima de 320.
  2. `draw_vline` `0x0cf2` escribe en `[0x52ce]` su DX, y su recortador `0x0d2b` compara
     **BX y DX contra `0xc7`=199** = Y máxima de 200. (Además `0x0d01 mov cx,ax` = `x1=x0`,
     que es lo que define una vertical.)
  3. El recortador de `plot` (`0x08ca`) acota **AX** contra el par de ventana `[0x52d0]/[0x52d2]`
     — el MISMO par que usa el recorte de hline para las X — y **BX** contra `[0x52d4]/[0x52d6]`,
     el mismo par que usa el de vline para las Y.
- ⇒ `plot(x, y)` con la x primero; `draw_vline(x, y0, y1)` con la x primera.

Esto encaja con el cierre de nombres de `0x4daa`/`0x4efc` (main `3943fe00`): la convención del
driver es `(ax,bx,cx,dx) = (x0,y0,x1,y1)`.

Deriva instrucción a instrucción el render de la vista celeste (catalejo nocturno /
(L)ook al cielo de noche) para portarlo a la piel fiel. Autoridad = ASM
(`LOOKOBJ.OVL`, disasm capstone 16-bit propio; NO había `.asm` commiteado). Cosmético
puro (cero gameplay); confirma el veredicto de `witness-catalejo.md` (zodíaco decorativo,
sin mecánica de predicción cometa/planeta).

## Flujo — `look_sky` (LOOKOBJ 0x0366)

- **Gate día/noche:** `g_hour (0x587f)`: `6 ≤ h < 0x12(18)` → "the sun!" + daño (rama día,
  ya portada). Si no → rama NOCHE (0x3aa).
- **Noche:**
  1. ~~Limpia el buffer de la ventana (0x3b4-0x3d3) y pinta el backdrop negro del viewport
     (`0xffffb41c`, 0x3dd).~~ ★ **CORREGIDO 2026-08-14 (tarea #297):** entre las dos cosas hay
     UNA INSTRUCCIÓN que esta nota se saltó, y con ella se perdió un elemento visible entero
     (el port lleva meses sin pintar el trípode). Lo que hace el tramo, entero:
     - `0x3b6-0x3d3` limpia el búfer de tiles de la ventana: `lea di,[si-0x54fe]` ⇒ base
       **`0xAB02`** (`g_vis_buffer`), 11 filas de STRIDE `0x20` con 11 bytes útiles cada una
       (`mov cx,5` + `repne stosw` + `stosb`), `add si,0x20` hasta `cmp si,0x160` (=352=11×32).
       El valor escrito es `0xFFFF` ⇒ las 121 celdas quedan a **tile `0xFF` = `BlackSquare`**.
       El «backdrop negro» NO es un fill: son 121 tiles negros.
     - `0x3d8` **`mov byte ptr [g_vis_buffer+325], 0x59`** — la instrucción perdida. `325 =
       10·0x20 + 5` ⇒ **fila 10, columna 5** (abajo del todo, columna central de las 11), y el
       tile `0x59` es **`Telescope`**: el TRÍPODE del catalejo. Es el único de los 121 que no
       es negro.
     - `0x3dd` `call 0xffffb41c` **no pinta un backdrop**: es `viewport_compose`
       (`0xb41c + 0xa290 = 0x156ac` ⇒ ULTIMA.EXE **`0x56ac`**, el compositor 11×11 de
       `kernel-sweep-2.md §3`), que recorre ese mismo búfer `0xAB02` y bliteatile a tile. Por
       eso el orden importa: el trípode se compone ANTES de que 0x3ea empiece a `plot`ear las
       80 estrellas, y una estrella puede caer encima de él.
     Cableado en `skin/fiel/zodiac.ts` (`TELESCOPE_TILE`/`ROW`/`COL` + el blit) con 4 tests y
     mutantes; confirmado contra la captura del original
     (`av-referencia/reportes/spyglass-cielo-nocturno-297.jpeg`).
  2. **Campo de 80 estrellas de fondo** (0x3ea-0x40e): color = `g_13b2 + 8`. Bucle si=80:
     `plot( rand_range(9, 0xb6=182), rand_range(9, 0xac=172) )` — el primer push (0x3fd) es la
     **X** y el segundo (0x409) la **Y**. ⇒ 80 píxeles sueltos, x∈[9,182], y∈[9,172].
  3. **Constelación del zodíaco de 8 signos** (0x410-0x4e7): bucle i=0..7. Para cada signo:
     - `x = (tabla_3750[i] +1)*8 + …` (COLUMNA, rotada por fecha) · `y = tabla_3758[i]*8 + …`
       (FILA, fija por signo). Cada signo es un «planeta» que corre por su PISTA horizontal.
     - `draw_zodiac_star(col_ajustada+1, tabla_3758[i])` (0x1ac) — glifo estrella. El primer
       push (0x4a9) es `col+1`; el segundo (0x4ac) es la fila.
     - Para cada Shadowlord s (0..2): si `g_shadowlord_locs[0x58C8 + s] == i+1` →
       `draw_zodiac_lines(col, tabla_3758[i])` (0x24c) — ★ **con `col`, no `col+1`**: `0x4b0`
       hace `dec word ptr [bp-6]` entre las dos llamadas ⇒ la línea nace **8 px a la izquierda**
       del origen de la estrella. Dibuja el conector SÓLO si un
       Shadowlord está en la ciudad del signo. (La constelación MARCA a los Shadowlords; es
       display de estado ya existente, no predicción.)
  4. ~~Espera tecla (0x4ee-0x4f9, `0x78a8` = getkey en bucle) → vuelve.~~
     ★ **CORREGIDO 2026-08-15 (tarea #321):** este paso arrancaba en `0x4ee` y se dejaba
     fuera la instrucción de ANTES — misma clase de omisión que la del trípode en el paso 1,
     y por eso se anota igual (tachado, no borrado). El tramo entero:
     - `0x4ea` `mov ax, 0x72fa` + `push` + `call 0x75c0` = **imprime DS `0x72fa`**, que es
       `"the night sky! "` (leído de DATA.OVL en fileoff `0x730a` = DS+0x10; **ojo: `0x730a`
       leído como DIRECCIÓN DS es `" PM.\n"`**, otra cadena del mismo dispatch — las dos
       convenciones colisionan justo aquí). La frase va **DESPUÉS** de pintar, no antes.
     - `0x4ee-0x4f9` espera tecla (`0x78a8` = getkey en bucle) → vuelve.
  5. **El catalejo NO es la única puerta a esta vista.** `look_dispatch` (0x0502) despacha
     `0x0558 cmp si,0x59` → `0x055d call 0x366` **sin más gate que el tile**: un (L)ook al
     tile 0x59 (el TELESCOPIO) de noche entra por aquí. Son los DOS emisores del binario, y
     el port sólo tenía el del catalejo hasta #321 (censo #278 fila C23). Alcance medido en
     los datos del port: **TRES** tiles 0x59 en todo el juego (Moonglow 17,13 · Skara Brae
     16,14 · castillo de Lord British planta z=3 16,14) y CERO en overworld/underworld/
     mazmorras.

## Tablas (DATA.OVL, fileoff = DS + 0x10; verificadas)

- `tabla_3750` (col por signo) @f0x3760 = **[18, 2, 8, 15, 11, 6, 4, 2]**
- `tabla_3758` (row por signo) @f0x3768 = **[18, 17, 15, 13, 11, 8, 5, 1]**
- `tabla_3760` (anillo de 21 slots válidos para la rotación) @f0x3770 =
  `[0,0,0,0,1,0,0,0, 0,0,0,1,0,0,0,0, 0,0,1,0,0]` (1 = slot ocupado).

**Posiciones base (fecha de referencia, sin rotar) — centro visual de la estrella:**
```
i : (x = (col+1)*8+8 , y = row*8+8)
0 : (160, 152)   1 : ( 32, 144)   2 : ( 80, 128)   3 : (136, 112)
4 : (104,  96)   5 : ( 64,  72)   6 : ( 48,  48)   7 : ( 32,  16)
```
La Y sale monótona (152, 144, 128, 112, 96, 72, 48, 16): las 8 pistas son horizontales y no se
cruzan; lo que se mueve con el calendario es la X de cada planeta sobre su pista.

## Glifo ESTRELLA — `draw_zodiac_star(colArg, rowArg)` (0x1ac, EXACTO)

Color = `g_13b0`. Con `SX = colArg*8` (primer arg, `[bp+6]`) y `Y = rowArg*8` (segundo,
`[bp+4]`), plotea:
- `(SX+6, Y+8)` (0x01cd) · bloque 3×3 `(SX+7..9, Y+7..9)` (0x0208) · `(SX+10, Y+8)` (0x0233).
- ⇒ cuadrado 3×3 con una antena a cada **LADO** (izquierda y derecha), centro ≈ `(SX+8, Y+8)`.
- Recorte: `SX+si ≤ 0xb0` en el 3×3 y `SX ≤ 0xad` en la antena derecha ⇒ píxel x ≤ 183 en
  ambos casos = el borde derecho de la ventana del mapa (x∈[8,183]). El recorte acota la
  coordenada que sale de la tabla de COLUMNA — la única que puede desbordar (rota por 0..21,
  hasta x=186), mientras la de FILA nunca pasa de 18 ⇒ 153. Con los ejes cambiados el recorte
  sería CÓDIGO MUERTO: eso, por sí solo, ya delata la transposición.

## Glifo LÍNEA — `draw_zodiac_lines(colArg, rowArg)` (0x24c, EXACTO)

Color = `g_13ae`. **8 VLINES en columnas contiguas** (`draw_vline(x, y0, y1)` = 0x6a62 → kernel
0x0cf2), con `LX = colArg*8` (`[bp-2]`, primer push de las tres) y `Y = rowArg*8` (`[bp-4]`,
los otros dos):
```
x+5 : y 10..12    x+6 : y 10..12    x+7 : y  8..12    x+8 : y  8..12
x+9 : y  6..10    x+10: y  6..10    x+11: y  5.. 8    x+12: y  5.. 7
```
⇒ un trazo diagonal **↗** (de abajo-izquierda a arriba-derecha) que entra en el signo por su
lado izquierdo — el "conector" de constelación. Guardas: `[bp-2] > 2` en las tres primeras (sólo
dispara con col=0, y recorta justo los píxeles x=5,6,7, fuera de la ventana que empieza en 8) y
`[bp-2] ≤ 0xaf/0xae/0xad/0xac/0xab` en las cinco últimas (todas = `LX+dx ≤ 0xb7`=183). ⇒ el
conjunto de guardas equivale EXACTAMENTE a recortar a la ventana x∈[8,183].

## Rotación por fecha — DERIVADA + CABLEADA (rama `fiel/zodiac-rot`)

La **rueda del zodíaco** (0x41a-0x48d) YA está cableada (antes Clase-C). Derivación final:

- **Referencia (epoch) = ARRANQUE del juego = 4-5-139** (`año%100==0x27(39), mes 4, día 5`).
- **Calendario = 13 meses × 28 días** (rollover día 0→28 con mes−−; mes 0→13 con año−−).
- Cada día transcurrido desde la referencia, cada signo baja **UNA posición VÁLIDA** de su
  anillo: `col` decrementa con wrap 0→21 saltando los slots `tabla_3760[i*22+col]==0`.
- **`tabla_3760` es POR SIGNO: 8 × 22 bytes** (no un anillo único; el índice es `[bp-0x16]=
  i*0x16 + col`). Las columnas válidas por signo (verificadas @f0x3770):
  - signo0: {4,11,18} (3 slots → cicla cada 3 días · el más LENTO)
  - signo1: {2,7,11,15,20} (5) · signo2: {2,5,8,11,14,17,20} (7)
  - signo3: {1,3,5,7,9,11,13,15,17,19,21} (11) · signo4: {0,2,4,6,8,9,11,13,14,16,18,19,21} (13)
  - signo5: {1,2,3,5,6,7,9,10,11,12,13,15,16,17,19,20,21} (17) · signo6: 19 slots
  - signo7: TODAS las 22 (se mueve a diario · el más RÁPIDO)
  ⇒ 8 «planetas» a velocidades distintas (nº de slots válidos = periodo). Cada `tabla_3750[i]`
  es un slot válido (comprobado).
- **Mapeo calendario DOS↔port = IDENTIDAD**: `state.time.year/month/day` = el `.gam` byte a
  byte; el año del juego es 139 → `año%100=39` = la referencia. Sin ambigüedad de epoch.
- Cableado en `core/world/zodiac-view.ts` (`daysSinceEpoch` + `rotatedColumn`), test unit de
  fecha→columna en `tests/zodiac-view.test.ts`, captura de dos fechas en
  `av-referencia/shader-evolution/zodiac/rot-compare.png`.

## Clase-C restante (documentado, NO fabricado)

1. ~~**Índices EGA exactos** de `g_13b0` (estrella), `g_13ae` (línea), `g_13b2+8` (fondo): se
   fijan en DS por código no volcado. El port usa blancos/gris fieles del EGA (estrella y
   fondo blanco brillante 0x0F; línea gris 0x07) — Clase-C hasta un volcado de paleta.~~
   ★ **CERRADO 2026-08-14 (tarea #297): los tres, EN TIEMPO DE `look_sky`.** No hizo falta
   volcar la paleta: la **captura del original** en esta misma pantalla
   (`av-referencia/reportes/spyglass-cielo-nocturno-297.jpeg`) enseña los tres colores a la vez.
   - `g_13b0` (estrella del signo) = **EGA 15, blanco** — ya era el valor del port (`colors.border`,
     live-read); la captura lo confirma y coincide con el `g_unk_13b0 = 15` que firmó #295.
   - `g_13ae` (línea conectora) = **EGA 4, ROJO**. El port pintaba `#8a8a8a` gris: los dos
     conectores de la captura son inequívocamente rojos.
   - `g_13b2 + 8` (80 estrellas de fondo) = **EGA 9, azul claro**, no blanco. Aquí no hacía
     falta ni la captura: `g_13b2` es el color del MARCO (EGA 1, azul), que el port ya tenía
     leído, y `0x03e3` le suma 8 ⇒ 9. La propia derivación lo predecía y el port cableaba
     `#ffffff` en contra. Cableado como SUMA sobre el índice del marco, no como literal.
   🔴 **Alcance de este cierre: `look_sky` y sólo `look_sky`.** `g_13ae`/`g_13b0` son variables
   VIVAS que otras rutinas leen en otros momentos; la ficha **#305** pregunta por su valor en
   tiempo de CURANDERO (SHOPPES.OVL 0x13b0) y esta captura no dice nada de eso.
2. **RNG exacto** de las 80 estrellas: depende del stream vivo del binario (no reproducible
   estáticamente). El port siembra 80 posiciones en el mismo rango — distribución fiel,
   posición no byte-idéntica (cosmético).

## ★ Errata de la versión del 2026-07-18 (qué estaba mal y por qué)

Tres defectos, todos del mismo origen: **el orden de argumentos de las primitivas gfx se leyó
mal** (el mismo defecto de cita de `0x0c9c` que frontera-29 corrigió en su rama).

1. **Ejes intercambiados** en todo el bloque de dibujo (estrella, línea, campo de estrellas y
   tabla de posiciones base). La nota se contradecía sola dos veces: usaba como x la tabla que
   ella misma etiqueta «row», y transcribía un recorte que acota el argumento que sale de la
   tabla de columna. Efecto en el port: constelación reflejada en la diagonal, antenas de la
   estrella giradas 90°, conector en sentido contrario.
2. **`draw_zodiac_lines` documentada como 8 hlines** cuando `0x6a62` es `draw_vline`
   (kernel 0x0cf2, con `mov cx,ax` = x1=x0). Los inmediatos de los 8 segmentos eran correctos:
   lo que cambia es que el índice que avanza 5→12 es la X y los pares son el tramo de Y.
3. **El `dec` de `0x4b0` no estaba recogido**: la nota pasaba la misma columna a los dos
   glifos, y el port dibujaba el conector 8 px desplazado respecto del binario.

Corregido en el port por la tarea #70 (`core/world/zodiac-view.ts`: `starX`/`lineX`/`y` en vez
de `ox`/`oy`; `skin/fiel/zodiac.ts`: VLINES). Tests: `game/tests/zodiac-view.test.ts`
(re-adjudicado) y `game/tests/fiel-zodiac.test.ts` (nuevo, fija los píxeles del signo 0).
