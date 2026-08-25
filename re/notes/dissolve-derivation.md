# Dissolve (fn37 / page-dissolve 0x0d72) — derivación byte-exacta desde EGA.DRV

Carril transiciones (2026-07-18). Desbloqueado por lote-D §2 (caller = cartas de historia
del attract). El oráculo confirmó el CALLER pero no volcó la tabla; aquí se EXTRAE del
binario `original/u5/ultima5/EGA.DRV` por desensamblado directo (mismo método que la tabla
de polinomios 0x254d del fizzle), byte-a-byte. Delta binario: **file = addr** (segmento
plano; verificado con `[cs:(w-2)*2 + 0x254d]` del fizzle → poly[2]=0x0003 @addr 0x254d).

## Mecanismo (desensamblado EGA.DRV, origin 0)

Es un **melt por SCANLINES** del bloque de texto centrado (las "7 líneas centradas" del
0x0d72), no un wipe de filas de texto. El driver:

- `0x1de0 mov ax,0x1e8c; mov [0x1b71],ax` — cursor = tabla en **addr 0x1e8c**.
- read_byte `0x1d90`: lee `[cursor]`, incrementa cursor.
- Primer byte = **nº de niveles** (`[0x1b25]` = 7).
- Por nivel (`0x1dd9`): lee 3 params (`0x1da0`) → `[0x1b29]=srcOffset`, `[0x1b27]=startRow`,
  `[0x1b2b]=count`; luego `0x1db6` lee 1 byte de LONGITUD y fija base=cursor, avanza cursor
  `length` bytes → el bloque de `order` de ese nivel.
- Pasada DOWN `0x1d13`: índice = length-1, DECRECE; `order[i]==0xff` → `transition_step`
  (revela un lote) y decrementa el contador de lotes (`[0x1b23]=6`); si no, `flag[order[i]]=1`.
- Pasada UP `0x1d54`: índice = 1, CRECE; `flag[order[i]]=0` (pase inverso).
- `transition_step 0x1c93`: cuenta flags, y en 2 MITADES con `delay` (busy-wait `0x1c24`,
  Clase-C) COPIA (`0x1bf3`, desde el buffer fuente `ds:[0x202]` a 0xa000) las scanlines
  flag=1 y BORRA (`0x1bda`) las flag=0, usando la tabla de offsets de vídeo `[cs:row*2+0x72]`
  (rellenada en runtime → NO estática; irrelevante para canvas: la scanline absoluta =
  `startRow + rowIndex`).
- Bucle principal `0x1e04`: por nivel alterna `[0x1b1d]` (dirección de mapeo de scanline
  top↓/bottom↑) y ejecuta pasada down + up; corta con tecla (`int 21 ah=6` → `[0x1b7b]`).
- Segunda tabla en **addr 0x1f4b** (ruta de cierre `0x1e68`): mismo formato, limpieza final.

⇒ Para el port (canvas), lo BYTE-EXACTO es el **orden de revelado de scanlines**: 7 bandas
anidadas y expansivas (startRow 75→46, count 3→61) que cubren **filas 46..106** (el bloque
de 7 líneas centrado), cada una con su secuencia `order` de índices intra-banda + marcadores
de lote 0xff. La MECÁNICA de planos EGA y el reparto en 2 mitades con delay son artefactos
de hardware/tiempo → cadencia Clase-C (la aceptada). `visualLfsr`/scramble NO interviene aquí
(eso es el moongate, fn32).

## Tabla 1 (addr 0x1e8c) — 7 bandas, extraída verbatim

srcOffset acumula counts (0,3,10,21,41,73,118). Cada `order` tiene ~6-8 lotes (0xff):

```
L0 srcOff=0   startRow=75 count=3  order= ff ff ff 01 ff ff ff ff 00 02 ff
L1 srcOff=3   startRow=72 count=7  order= ff ff 01 05 ff ff 02 04 ff ff 03 ff 00 06 ff
L2 srcOff=10  startRow=71 count=11 order= ff ff 02 08 ff 03 07 ff 01 09 ff 04 06 ff 05 ff 00 0a ff
L3 srcOff=21  startRow=66 count=20 order= ff 04 0f ff 01 07 0c 12 ff 05 0e ff 02 08 0b 11 ff 03 06 0d 10 ff 09 0a ff 00 13 ff
L4 srcOff=41  startRow=60 count=32 order= ff 07 18 ff 02 0c 13 1d ff 03 08 0d 12 17 1c ff 01 06 0b 14 19 1e ff 04 09 0e 11 16 1b ff 05 0a 0f 10 15 1a ff 00 1f ff
L5 srcOff=73  startRow=53 count=45 order= ff 04 0b 12 1a 21 28 ff 01 08 0f 13 24 2b ff 06 0d 14 18 1f 26 ff 03 0a 11 16 1b 22 29 ff 02 05 09 0c 10 13 19 1c 20 23 27 2a ff 07 0e 15 17 1e 25 ff 00 2c ff
L6 srcOff=118 startRow=46 count=61 order= ff 1c 17 12 0d 08 03 20 25 2a 2f 34 39 ff 1a 15 10 0b 06 01 22 27 2c 31 36 3b ff 1d 18 13 0e 09 04 1f 24 29 2e 33 38 ff 1b 16 11 0c 07 02 21 26 2b 30 35 3a ff 19 0f 05 23 2d 37 ff 1e 28 32 14 0a ff 00 3c ff
```

**Quirk del binario (verificado, NO es typo):** la banda L5 repite el índice `0x13`=19 y
OMITE el `0x1d`=29 → la scanline 53+29=82 no la revela L5, pero la cubre L6 (46..106, solapa).
Inofensivo (la copia de scanline es idempotente). Se conserva verbatim y se fija en el test
como prueba de que el volcado es byte-exacto (`dissolve.test.ts`).

## Fidelidad de FLUJO — DERIVADO (opción (a) del lead, doble fuente, 2026-07-18)

CONCLUSIÓN: el dissolve **NO tiene destino fiel en las cartas de historia del intro** — no
hay ninguna carta de 7-líneas-con-melt en el intro fiel que reproducir. El caller "cartas de
historia" de lote-D §2 no corresponde a ninguna superficie VISIBLE del intro.

**Fuente 1 — ULTIMA.EXE (confirmación + trazado):** el 0x0d72 (file 0x800+0x0d72) ES el
page-dissolve, byte-exacto: `push bp;…; push 0,0,0x13f,0xc7; call clear`; LOOP si=0..6 con
`di=0x5306`(anchos), `[bp-8]=0x5314`(alturas), `X=(0x140−ancho)/2` centrado, `call 0x1044`
por línea, texto = `[bp+4]` (arg del caller). PERO **0 callers directos en ULTIMA.EXE** →
caller INDIRECTO (overlay), como avisaba lote-D §2. La superficie concreta queda sin pinchar
estáticamente (haría falta captura RUNTIME del oráculo de QUÉ hay en pantalla al picar 0x0d72,
o escanear los .OVL por far-calls al kernel — diferido).

**Fuente 2 — empírico (video-P + refs de intro):** el attract del original es
logos→"Lord British"→título(fuego)→**escena de IMAGEN "The Summoning"** (cuarto top-down)→menú
(video-P f001–f097; `intro-cards/ATTRACT_FULL_ORIGINAL.png` confirma la escena de imagen). NO
aparece ninguna carta de 7 líneas de texto con melt en el ciclo. La RE previa del intro
(`intro-attract-loop.md`, `intro-ovl-map.md`) coincide: attract = título+figuras+escena+menú;
"Ultima V Introduction" = The Summoning = 21 escenas STORY1.16 (`play_introduction 0x14e`),
TODAS composiciones de IMAGEN (types 0-6 en intro-scenes.json = variantes de blit, ninguna es
carta de texto puro). ⇒ La presentación de story del port (`renderStoryScene`, imágenes) YA
es fiel; no sustituyó cartas de texto por escenas.

**Recomendación:** NO cablear el dissolve al intro (no hay superficie fiel que calcar). El
módulo queda como primitiva pura landada (fase 1, byte-exacta) esperando un caller VISIBLE
confirmado. Candidatos reales del 0x0d72 (7 líneas centradas, pantalla limpia): "Story So Far"
/ recap, muerte/game-over, u otra pantalla de texto — a pinchar con captura runtime del oráculo.
Mientras, el carril pivota al moongate-scramble (tiene superficie visible confirmada).

### Hipótesis "0x0d72 = paginación del texto de escena" (intro-i18n) — REFUTADA por estática

Dato de intro-i18n: el port TRUNCA el texto de escena (16/21 desbordan la banda); el original
lo PAGINABA. Hipótesis: las cartas 0x0d72 son esa paginación. **NO se sostiene:** son DOS
mecanismos DISTINTOS.
- El texto de las 21 escenas lo pinta `play_introduction` con el thunk FONT **`0xfb26`
  (texto PROPORCIONAL)**, y el revelado de escena es una **CORTINA por columnas** (`0xbd26`)
  — ver `intro-summoning-scene-engine.md:94-98,29`. Los ÚNICOS thunks INTRO→FONT son
  `0xfb26`/`0xfb0e`/`0xfb1a`; **no hay 0x0d72 en el camino del intro**.
- El 0x0d72 es texto MONOESPACIADO (`call 0x1044` por línea) de 7 líneas FIJAS con clear de
  pantalla completa — incompatible con una escena que mantiene su lámina + banda de texto
  proporcional.
⇒ La TRUNCACIÓN del texto de escena es un bug real del port, pero se arregla en el motor de
escena (paginar el texto proporcional `0xfb26` con tecla) — dominio del carril de escenas/
intro-i18n, NO un cableado del melt 0x0d72. El melt sigue sin superficie confirmada. video-P
NO captura la Introduction narrada (muestra la DEMO del cuarto del attract + menú), así que no
zanja la paginación por imagen; pero la estática la zanja: escena = proporcional, no el melt.

#### CORRECCIÓN (carril intro-i18n, 2026-07-18) — lo que el ASM dice EN REALIDAD

Esta sección arrastraba dos residuos que NO se sostienen contra el ASM/empírico (el «el
original PAGINABA» era una SUPOSICIÓN tomada de la hipótesis inicial de intro-i18n, nunca
derivada; y la «cortina 0xbd26» está MAL CITADA — vive en el scene_tick del ENDGAME, que INTRO
no invoca, per `intro-summoning-scene-engine.md:94`). Lo derivado con citas:

- **NO hay paginación.** `play_introduction` (INTRO.OVL 0x14e) lee el registro STORY.DAT ENTERO
  (`0x0321 call 0xa3ae`), lo pinta de UNA vez (`0x032b call 0xfb26`) y espera UNA tecla por
  escena (`0x0334-033c`); no hay bucle de trozos. `render_justified_text` (FONT.OVL 0x0000) NO
  tiene keypress/clear interno — sólo el clip `cmp [g_unk_5158],0xc0` (`0x01c9`/`0x021f`).
- ~~**NO hay cortina en el intro** (0xbd26 = scene_tick 0x02fc del ENDGAME; INTRO no lo llama).~~
  🔴 **RETIRADA (carril intro-av-211, #211, 2026-08-13): esta línea es FALSA y mandaba a buscar
  algo que SÍ existe.** La cortina de `0xbd26` es el revelado del cuarto de la DEMO DE PORTADA
  («The Summoning» del attract), visible en `intro-detalles-2026-08-13.mov` y ya calcada en el
  port (`skin/fiel/demo-scene.ts:272-277`). Derivación byte-exacta en `FONT.OVL` `scene_tick`:
  ```
  0345: mov al,[0xbd26]      ; columna IZQUIERDA
  034a: mov [bp-4],ax
  0350: …pinta la columna [bp-4]…
  0371: inc word ptr [bp-4]
  0374: mov al,[0xbd27]      ; columna DERECHA
  0379: cmp [bp-4],ax
  037c: jbe 0x350            ; for col = [bd26] .. [bd27] INCLUSIVE
  037e: cmp byte [0xbd26],ah ; ah=0 ⇒ si izquierda==0, cortina abierta: no avanza
  0382: je 0x392
  0384: cmp byte [0xbd28],ah ; pestillo: si 0, este tick NO avanza
  0388: je 0x392
  038a: dec byte [0xbd26]    ; izquierda −1
  038e: inc byte [0xbd27]    ; derecha  +1   ⇒ EXPANSIÓN SIMÉTRICA
  0392: cmp byte [0xbd28],1 ; 0397: sbb ax,ax ; 0399: neg ax ; 039b: mov [0xbd28],al
  ```
  ⇒ `[0xbd26]`/`[0xbd27]` son las columnas izquierda/derecha (no un origen y una cuenta), se
  abren UNA COLUMNA POR LADO, y el pestillo `[0xbd28]` alterna 0↔1 cada `scene_tick` ⇒ avanza
  **un tick sí y otro no**. El vídeo lo confirma: centro fijo en EGA x≈160 y anchos de 1,3,5…15
  columnas de 16 px en 8 estados.
  **Por qué se escribió mal:** `intro-summoning-scene-engine.md:94` dice que INTRO no invoca el
  `scene_tick` — cierto, pero el motor de escena vive en **FONT.OVL** y es FONT quien lleva la
  demo del attract (`intro-splash-anim-audit.md §1`). De «INTRO no lo llama» se saltó a «no hay
  cortina en el intro», que es un sujeto distinto: el dueño del código no es el dueño de la
  pantalla.
- **El original NO trunca**: `orig_E_intro_iolo_story.png` = escena 16 (126 palabras) COMPLETA
  fluyendo full-width → columna → full-width; `orig_E_intro_shadowlords.png` = escena 10, texto
  arriba del arte. El único límite es el clip a penY≥0xc0 (=192).
⇒ La truncación del port NO es «falta de paginación» sino **regiones de texto DEMASIADO
PEQUEÑAS** en `summoning-layout.ts` (caja junto al arte en vez de pantalla completa + arte como
exclusión). Fix aterrizado: región full-screen + `carton` como exclusión de flujo (el
`drawWrappedAround` ya reproducía el resultado). Medidor `game/tools/measure-summoning.mjs`:
0/21 desbordan (EN y ES). El melt 0x0d72 sigue sin superficie confirmada (esto no lo cambia).

## Traza fn32 COMPLETA (2026-07-18, park del carril — persistido por el lead)

Los 3 bucles de EGA.DRV usan EL MISMO scramble 0x9248 (= core/transition/visualLfsr.ts,
byte-exacto). Difieren en el consumo del valor:
- **0x1fac** ruido-de-tile: rellena buffer de dither (loop cx=0x20, estampa `al` en 9
  posiciones/celda, si+=4) — patrón de dissolve para UNA tile.
- **0x27c0** audio: div-range a [100,) → frecuencia PIT (out 0x42) + delay = WARBLE del
  moongate. ⚠ El moongate del original SUENA — cobertura de audio del port a auditar.
- **0x2a07** pantalla: plotea píxeles en orden de scramble (dx&7 bit, dx>>3 byte, máscara
  [cs:bx+0x246]) — fizzle de pantalla completa por planos.
- **@0x24d6** = wrapper de PLOT planar (→0x1637 dirección de píxel), destino común.

MOONGATE (pendiente, bloque fresco): reveal = DISSOLVE por scramble de la tile 0xDC 16×16;
`anim` 1..15 = PROGRESO (umbral de píxeles revelados), NO altura de rect (el rect-desde-abajo
de moongate.ts es infiel confirmado). Falta: (1) pinchar cuál de 0x1fac/0x2a07 aplica la
puerta + cómo anim umbraliza (traza del handler fn-0x60/0x1112); (2) reescribir moongate.ts
con visualLfsr proporcional a anim; (3) validar vs video-K.
