# Barrido de consumidores de las primitivas gráficas (tarea #72)

**Carril:** `barrido-72` · **Rama:** `re/barrido-gfx-72` · **Fecha:** 2026-07-28
(§0-§7 = tarea #72; el **ANEXO #79** al final CORRIGE cifras de §2 y §3 — ver aviso).

> ⚠️ **AVISO DE LECTURA.** Las §§1-7 se escribieron cuando yo creía que la familia
> gráfica tenía CINCO primitivas y 157 call-sites. Son **OCHO** y **238**. Donde §2 dice
> «44 %» hay que leer **29,0 %**, y donde §3.1 dice que el cotejo A-vs-B cubre «los 23
> overlays» hay que añadir **«y el kernel»** (en #72 NO lo cubría). Todo ello medido y
> explicado en el ANEXO #79. Las adjudicaciones de §4-§5 **no cambian**.
**Instrumento re-ejecutable:** `re/tools/gfx_consumers.py` (modos `--check`, `--args`,
`--annex`, `--bounds`; los cuatro con EXIT 0 en esta rama).
**Cambios en `game/src`: CERO.** Este documento es censo + adjudicación + tickets.

---

## 0. Resultado en una línea

**No aparece un segundo zodíaco.** De los 69 call-sites de `plot`/`hline`/`vline`,
los 8 grupos consumidores que tienen equivalente en el port son **FIELES en el eje**
(4 adjudicados aquí + 3 ya verificados antes + el zodíaco arreglado por #70); los
4 restantes **no tienen calco** en el port y están declarados como huecos.

Lo que sí sale, y es lo que justifica la tarea: **el defecto del zodíaco no fue mala
suerte, fue la primitiva rara** — y el encargo cubría **29 %** de la superficie de
dibujo vectorial real. Ver §2, §6 y el ANEXO #79.

---

## 1. La convención, derivada del cuerpo entero

> **Para CITAR la convención usa [`gfx-arg-convention.md`](gfx-arg-convention.md)** (T2,
> fuente única y corta). Esta sección es la derivación; aquélla es la ficha citable.

`ret N` en las tres = limpieza por el callee = **PASCAL** ⇒ los args se apilan de
izquierda a derecha ⇒ el **primer push es el desplazamiento MÁS ALTO**.

| primitiva | offset | `ret` | args (bp) | registros |
|---|---|---|---|---|
| `plot` | `0x0C64` | 4 | `[bp+6]`, `[bp+4]` | AX→`[0x52CC]`, BX→`[0x52CE]` |
| `hline` | `0x0C9C` | 6 | `[bp+8]`, `[bp+6]`, `[bp+4]` | AX, BX, CX→`[0x52CC]` |
| `vline` | `0x0CF2` | 6 | `[bp+8]`, `[bp+6]`, `[bp+4]` | AX (+`mov cx,ax`), BX, DX→`[0x52CE]` |

Discriminadores de eje (cuerpo de los recortadores, no inferidos del dibujo):

- `0x0CCD` (recorte de `hline`) ordena `ax≤cx` y compara **AX y CX** contra `0x13F`=319
  y contra el par de ventana `[0x52D0]`/`[0x52D2]`. **BX no se toca en absoluto.**
- `0x0D2B` (recorte de `vline`) compara **BX y DX** contra `0x00C7`=199 y contra el par
  `[0x52D4]`/`[0x52D6]`.
- `0x08CA` (recorte de `plot`) acota **AX** contra el par de las X de `hline` y **BX**
  contra el par de las Y de `vline`.

⇒ **`plot(x, y)` · `hline(x0, y, x1)` · `vline(x, y0, y1)`. La X va siempre primero.**

### 1.1 Control de eje con DATOS REALES (independiente del análisis de registros)

La pantalla es 320×200, luego **un inmediato > 199 no puede ser una Y**. `--bounds`
recorre los argumentos que son inmediatos literales de los call-sites del corpus
(las tres del encargo + las cinco hermanas; 238 en total tras #79):

- con el convenio derivado: **0 violaciones**;
- con el convenio **transpuesto**: **19 violaciones** (el control negativo corre en la
  misma invocación; si no discriminase, `--bounds` devuelve exit 1).

El control muerde porque hay constantes grandes en juego: `0x107`=263, `0x137`=311 y
`0x138`=312 (chrome del panel derecho, ULTIMA.EXE `0x4dea`/`0x4e50`) caerían en
posición-Y bajo el convenio invertido. Es una confirmación del convenio que **no
depende** de haber leído bien los recortadores.

---

## 2. ★ Hallazgo estructural: TRES órdenes de argumentos en la misma familia

Leyendo el cuerpo de las **hermanas** del kernel (fuera del encargo, mismo riesgo):

- **`0x0B10` `line`** `ret 8` — `[bp+a]`=AX `[bp+8]`=BX `[bp+6]`=CX `[bp+4]`=DX.
  `0x0B2D` escribe `[0x52CC]`=CX y `[0x52CE]`=DX, y despacha al driver **`0x39` — el
  MISMO de `hline` — si BX==DX**, a `0x3C` (el de `vline`) si AX==CX y a `0x30` (el de
  `plot`) si ambos ⇒ **(AX,CX) son X y (BX,DX) son Y**.
- **`0x0B86` `fill_rect`** `ret 8` — mismos cuatro registros; recortador `0x08E6` acota
  AX y CX contra 319 y BX y DX contra 199 ⇒ idéntico.

```
plot      (x,  y)                — 2 args
hline     (x0, y,  x1)           — X, Y, X   ← LA RARA
vline     (x,  y0, y1)           — X, Y, Y
line      (x0, y0, x1, y1)       — intercalada
fill_rect (x0, y0, x1, y1)       — intercalada
```

**`hline` es la única de las OCHO que mete la Y EN MEDIO** — y es exactamente la que
se leyó al revés en las dos fuentes que contaminaron el zodíaco. El defecto tiene
causa de familia, no de descuido puntual.

**Consecuencia de alcance** (⚠️ CIFRAS SUPERADAS — ver ANEXO #79 §A1): esta sección
declaró 88 call-sites de anexo y una cobertura del 44 %. El censo cerrado da **169 de
anexo** y **69/238 = 29,0 %**, porque faltaban tres primitivas (`line_to 0x0F90`,
`fill_rect2 0x0AA6`, `fill_rect_op 0x0ACE`) y dos de ellas eran invisibles para el
barrido lineal. Módulos que no aparecían con las tres del encargo: OUTSUBS, SHOPPES,
ENDGAME, CAST2, SHOPPES3, FONT — **y además** TOWN, BLCKTHRN y CMDS.

Dos medidas de por qué importa, halladas durante el careo:

1. La **gema de overworld** dibuja sus puntos con `plot` (censado) pero **todas** sus
   líneas de celda con `line 0x0B10` (fuera del censo) — 22 de los 69. Un barrido de
   solo-las-tres declararía «la gema no dibuja líneas».
2. La **retícula de apuntado de combate** (ULTIMA.EXE `0x5813`+, `g_cmb_aim_x/y`) no
   usa ninguna de las tres: sale entera por las hermanas.

---

## 3. Censo (`gfx_consumers.py`, `--check` EXIT 0)

| módulo | base near-call | plot `0x0C64` | hline `0x0C9C` | vline `0x0CF2` | near-calls al kernel |
|---|---|---|---|---|---|
| ULTIMA.EXE | `0x0000` | 0 | 8 | 3 | 716 |
| TOWN.OVL | `0x81d0` | 0 | 0 | 0 | 154 |
| MAINOUT.OVL | `0x81d0` | 0 | 0 | 0 | 201 |
| DUNGEON.OVL | `0x81d0` | 10 | 6 | 1 | 188 |
| INTRO.OVL | `0x81c0` | 1 | 0 | 0 | 561 |
| FLAMES.OVL | `0xa290` | 0 | 0 | 0 | 0 (degenerado, ver §3.2) |
| NPC.OVL | `0xa290` | 0 | 0 | 0 | 15 |
| COMBAT.OVL | `0xa290` | 0 | 0 | 0 | 160 |
| BLCKTHRN.OVL | `0xa290` | 0 | 0 | 0 | 135 |
| LOOKOBJ.OVL | `0xa290` | 22 | 0 | 8 | 184 |
| DNGLOOK.OVL | `0xa290` | 4 | 0 | 0 | 108 |
| OUTSUBS.OVL | `0xa290` | 0 | 0 | 0 | 71 |
| SHOPPES.OVL | `0xa290` | 0 | 0 | 0 | 231 |
| ENDGAME.OVL | `0xa290` | 0 | 0 | 0 | 114 |
| SJOG.OVL | `0xbf80` | 0 | 0 | 0 | 231 |
| CMDS.OVL | `0xbf80` | 0 | 0 | 0 | 236 |
| CAST.OVL | `0xbf80` | 2 | 0 | 0 | 275 |
| TALK.OVL | `0xbf80` | 0 | 0 | 0 | 123 |
| CAST2.OVL | `0xe1e0` | 0 | 0 | 0 | 188 |
| ZSTATS.OVL | `0xe1e0` | 0 | 0 | 0 | 163 |
| COMSUBS.OVL | `0xe1e0` | 4 | 0 | 0 | 95 |
| SHOPPES2.OVL | `0xe1e0` | 0 | 0 | 0 | 156 |
| SHOPPES3.OVL | `0xe1e0` | 0 | 0 | 0 | 110 |
| FONT.OVL | `0xe1e0` | 0 | 0 | 0 | 84 |
| **TOTAL** | | **43** | **14** | **12** | |

### 3.1 Cómo se resuelve un call-site

Los `.asm` de los overlays llevan direcciones **file-relativas** y sus near-calls
apuntan al espacio CS común de 64 K:
`kernel = (target_file_rel + base) & 0xFFFF`, con
`base = load_seg*16 − cabecera_reloc` (`dispatch_table.overlay_near_call_base`, fuente
única — nada copiado a mano; las bases de la tabla salen de ahí, incluida la de
INTRO.OVL que es `0x81C0` y no `0x81D0` por sus 2 reubicaciones).
Capstone imprime el target en forma **plana** (`call 0x69d4`) o **envuelta**
(`call 0xffff82de`); las dos se normalizan con `& 0xFFFF`.

**Dos instrumentos independientes, y coinciden:** (A) barrido del texto del `.asm`
commiteado — stream ya decodificado, inmune a los bytes `0xE8` que caen dentro de
datos o inmediatos; (B) barrido de bytes `E8 rel16` sobre el `.OVL` crudo. `--check`
compara A vs B: **iguales en los 23 overlays**. ⚠️ En #72 `crosscheck` devolvía `None`
para ULTIMA.EXE (`near_calls_to_kernel` sólo acepta overlays), así que **el kernel quedó
con UN SOLO instrumento** pese a lo que afirma este párrafo. Cerrado en #79: hoy A==B
cubre los 23 overlays **y el kernel**, para las ocho primitivas.

### 3.2 Los ceros, con control positivo

Cada cero se imprime **junto a su número de near-calls al kernel resueltos**: 16 de
los 17 ceros son **ceros MEDIDOS** (154..236 llamadas resueltas ⇒ el escáner ve el
módulo y no encuentra primitivas).

**FLAMES.OVL** se declara aparte como **DEGENERADO por cuerpo entero**, no como cero
ciego. Fichero de 32 B, 17 de código:

```
0000 push bp / mov bp,sp / push si / push di / push ds
0006 call 0xe          <- INTRA-overlay (0xe < 0x20 = tamaño del fichero)
0009 pop ds / pop di / pop si / pop bp / ret
000e pop ax / push ax / ret
```

Cero near-calls fuera del fichero. Se separa para que la alarma de «cero ciego» siga
siendo una alarma de verdad en los otros 22 overlays.

### 3.3 Sensibilidad

LOOKOBJ.OVL sale con `plot=22`, `vline=8`: incluye los call-sites conocidos del
zodíaco (`0x01d8`/`0x0211`/`0x0240` del glifo estrella, `0x040a` del campo de 80
estrellas, y los 8 `vline` del conector `0x0286`..`0x035d`). El control positivo pasa.

---

## 4. Los 12 grupos consumidores y sus veredictos

| # | grupo | ASM | sites | equivalente en el port | veredicto |
|---|---|---|---|---|---|
| A | chrome del panel derecho | ULTIMA.EXE `0x4d76`/`0x4dea`/`0x4e50` | 7 h + 2 v | `skin/fiel/frame.ts` | **FIEL** (antecedente, re-confirmado por §1.1) |
| B | recuadro del combatiente ACTIVO | ULTIMA.EXE `0x56ac` @`57e5`/`57f2` | 1 h + 1 v (×4 pasadas) | `skin/fiel/combat.ts` `strokeActiveBox` | **FIEL** (§4.1) |
| C | goteo de estalactita | DUNGEON `0x145c` | 1 h + 1 v + 1 p | `skin/fiel/dungeon-decor.ts` `dripRects` | **FIEL** (antecedente) |
| D | destello del esqueleto | DUNGEON `0x150a` @`162f`-`165c` | 4 h | `dungeon-decor.ts` `glintRects` | **FIEL** (§4.2) |
| E | chorro procedural de la FUENTE 3D | DUNGEON `0x1786` | 9 p | — | **SIN-EQUIVALENTE** (§5, ticket ya abierto) |
| F | chispas de CAMPO MÁGICO 3D | DUNGEON `0x127e` | 1 h (en bucle) | — | **SIN-EQUIVALENTE** (§5, ticket ya abierto) |
| G | zodíaco del catalejo | LOOKOBJ `0x01ac`/`0x024c`/`0x03ea` | 4 p + 8 v | `core/world/zodiac-view.ts` + `skin/fiel/zodiac.ts` | **ARREGLADO por #70** |
| H | gema de overworld/pueblo | LOOKOBJ `0x0a9c`…`0x10fc` | 18 p | `skin/fiel/gemmap-overworld.ts` | **FIEL** (§4.3, 7 comprobaciones) |
| I | fuente del gem de MAZMORRA | DNGLOOK `0x0340` @`0x048e` | 4 p | `skin/fiel/gemmap.ts` (declarado Clase-C) | **SIN-CALCO, ya declarado** (§5) |
| J | abanico del hechizo de línea | CAST `0x1bb0` | 2 p | `skin/fiel/combat.ts` `traceSprayRays` | **FIEL** (§4.4) |
| K | estallido de impacto | COMSUBS `0x0f4a` | 4 p | `skin/fiel/combat.ts` `paintStarburst` | **NO-DECIDIBLE por eje** (§5) |
| L | semillas del flood-fill de INTRO | INTRO `0x0050` | 1 p | — | **SIN-EQUIVALENTE / NO-DECIDIBLE** (§5) |

Suma: A 9 + B 2 + C 3 + D 4 + E 9 + F 1 + G 12 + H 18 + I 4 + J 2 + K 4 + L 1 =
**69** ✓ (cuadra con el censo, y cuadra por módulo: ULTIMA.EXE 9+2 = 8 h + 3 v;
DUNGEON 3+4+9+1 = 10 p + 6 h + 1 v; LOOKOBJ 12+18 = 22 p + 8 v).

*(B son 2 call-sites, no 8: el marco completo sale de un bucle doble sobre esos dos
mismos `call` — 2 pasadas exteriores × 2 valores de `si`.)*

> ## ⛔ RETRACTADA — la «precisión de rótulo» de §4 era FALSA (corregida en #79 §A9)
>
> Esta sección decía que «chrome `0x4daa`/`0x4efc`» no eran entradas de rutina y que las
> rutinas «que los contienen» eran `0x4d76` y `0x4e50`. **Es al revés: el antecedente
> tenía razón y yo no.** `0x4DAA` (9 llamadas), `0x4EFC` (5) y `0x4E20` (6) son rutinas
> REALES, autocontenidas y que terminan en `ret` — sólo que **SIN MARCO DE PILA**, y mi
> atribución las buscaba por `push bp; mov bp,sp`. Ver §A9.

### 4.1 B — Recuadro del ACTIVO en combate (`0x56ac`) — **FIEL**

`0x56ac` redibuja la arena 11×11 (`si`,`di` 0..10) y luego, si `g_location > 0x7f`,
`g_unk_589f` conmuta (parpadeo) y `g_cmb_actor != 0xff`, calcula

```
X0 = (byte[actor*8 + 0xBA1A] << 4) + 8      ; 0x5780-0x578d
Y0 = (byte[actor*8 + 0xBA1B] << 4) + 8      ; 0x5790-0x579b   (el byte SIGUIENTE)
```

y ejecuta un bucle doble: exterior `[bp-6]` ∈ {0,1} (`0x5800`-`0x5807`), interior
`si` con paso 14 mientras `si < 15` ⇒ `si` ∈ {0,14}. Por iteración:

```
hline(x0 = X0,            y  = Y0 + bp6 + si, x1 = X0 + 0x0F)   ; 0x57e5
vline(x  = X0 + bp6 + si, y0 = Y0,            y1 = Y0 + 0x0F)   ; 0x57f2
```

⇒ marco de **línea doble**: filas {0,1} y {14,15}, columnas {0,1} y {14,15}, cada
banda a lo **ancho/alto completo** de las 16 px.

El port (`strokeActiveBox`) pinta cuatro `fillRect`: `(px,py,TILE,2)`,
`(px,py+TILE−2,TILE,2)`, `(px,py,2,TILE)`, `(px+TILE−2,py,2,TILE)`. **Casa exacto**, y
el comentario de cabecera ya cita `0x5779-0x5807` con la asignación de ejes correcta.

### 4.2 D — Destello del esqueleto (`0x150a`) — **FIEL**

Bajo `g_dng_wall_variant == 3`, nibble alto `0xC0` y `rand(0,0x40) < 4`, cuatro hlines
de inmediatos (`0x1623`-`0x165c`), color `[0x13ae]+8`:

```
hline(0x5c, 0x57, 0x5d)   hline(0x5b, 0x58, 0x5d)
hline(0x61, 0x57, 0x62)   hline(0x61, 0x58, 0x63)
```

⇒ dos manchitas a `x`≈91-99, `y`∈{87,88}. `dungeon-decor.ts::glintRects` las tiene
como `{x:0x5c,y:0x57,w:2,h:1}`, `{x:0x5b,y:0x58,w:3,h:1}`, `{x:0x61,y:0x57,w:2,h:1}`,
`{x:0x61,y:0x58,w:3,h:1}` — **byte a byte**, con la cita al lado de cada rect.

### 4.3 H — Gema de overworld/pueblo (`0x0a9c`…`0x10fc`) — **FIEL**

`0x10fc` recorre `di` (fila) 0..31 × `si` (columna) 0..31 y llama
`0xf7e(tile, si, di)`; `0x0a9c` fija `g_cmb_scratch_x = arg1*4 + 0x20` y
`g_cmb_scratch_y = arg2*4 + 0x20` (celda de 4×4 px anclada en (32,32)). El marcador de
la party entra por `0x1181`: `push [bp+6]` (= `party_x − chunk_origin_x`),
`push [bp+4]` (= la Y) ⇒ **el primer argumento es la X** por una vía distinta de los
recortadores.

Los 18 `plot` como desplazamiento `(dx,dy)` dentro de la celda, contra el port:

| rama ASM | plots | `(dx,dy)` del binario | port (`drawCell`) | ✓ |
|---|---|---|---|---|
| `0x0abe` (cat 1, hierba) | `0ad1 0ae0 0aef 0b00` | (1,0) (1,2) (3,1) (3,3) | `QUAD_DOTS` = (1,0)(3,1)(1,2)(3,3) | ✓ mismo conjunto |
| `0x0cd0` (cat 9, bosque) | `0ce0 0cee` | (2,1) (0,3) | `px(2,1)` + `px(0,3)` | ✓ |
| `0x0cf4` (cat 10, costa/río) | `0d8d 0da2 0db7 0dce` | (1,0) (3,1) (1,2) (3,3) | `QUAD_DOTS` en ese orden con `dx = 8,4,2,1` | ✓ orden incluido |
| `0x0dda` (cat 11, agua) | `0e00 0e11` | (0,0) (2,2) | `px(0,0)` + `px(2,2)` | ✓ |
| `0x0e16` (cat 13, pantano) | `0e29 0e38 0e65 0e76` | (1,0) (3,1) (0,2) (2,3) | verdes (1,0)(3,1) + azules (0,2)(2,3) | ✓ colores incluidos |
| `0x0e7a` (cat 16, muesca de codo) | `0f54` (4 ramas) | 0x22→(1,2) 0x23→(1,1) 0x24→(2,1) 0x25→(2,2) | `ROAD_CORNER_NOTCH` idéntico | ✓ |
| `0x101e` (cat 12, agua profunda) | `104a` | (2,2) | `px(2,2)` | ✓ |

**Nota de método:** las cuatro muescas de codo salen de **un solo** `call` (`0x0f54`)
al que llegan cuatro caminos distintos (`0x0f48`, `0x0f5a`, `0x0f66`, `0x0f6e`, todos
por `jmp`). El extractor automático de `--args` sólo ve el camino de caída, y por eso
esas cuatro se leyeron **a mano**. Ver §7.

### 4.4 J — Abanico del hechizo de línea (CAST `0x1bb0`) — **FIEL**

`0x1bb0(x=[bp+8], y=[bp+6], color=[bp+4])`: guarda `8 ≤ arg ≤ 0xb6` en los DOS ejes
(no discrimina por sí sola), luego `plot(x, y)` y `plot(x+1, y)` ⇒ **par de píxeles
horizontal**; después `0x1c03 test byte ptr [bp+6], 1` ⇒ el corte de LOS mira la
paridad del **segundo** argumento, la Y.

El port: `traceSprayRays` corta con `(y & 1) === 1 && opaque(x >> 4, y >> 4)` (mismo
argumento, misma paridad, y **después** de empujar el punto, como el original), y
pinta cada punto con `ctx.fillRect(VIEWPORT.x + pt.x, VIEWPORT.y + pt.y, 2, 1)` — 2 px
de **ancho**, 1 de alto. Es el par `(x,y)+(x+1,y)`. **FIEL**, incluido el detalle de
que la anchura del rayo va en X sea cual sea la dirección del disparo.

---

## 5. Los que NO se pueden adjudicar por eje (y por qué)

- **E — `0x1786`, chorro de la fuente 3D (9 plots).** Cuatro formas seleccionadas por
  `[bp+6]` ∈ 0..3 y tablas de pares en `0x2ea4`/`0x2ed4`/`0x2ef2`/`0x2f0a`; cada punto
  se dibuja **espejado**: `plot(d, y)` y `plot(0xBE − d, y)` (y las variantes
  `d+0x48`/`0x76−d`, `d+0x50`/`0x6e−d`, `d+0x58`/`0x66−d`, todas con suma `0xBE`=190 ⇒
  simetría sobre **x = 95**). El port **no lo calca**: la fuente sale del sprite de
  ITEMS.16 sin chorro. Ticket ya abierto en `dungeon-decor-mazmorra.md` §6.2.
  *No es adjudicable por eje porque no hay contraparte que comparar.*
- **F — `0x127e`, chispas de campo mágico 3D (1 hline en bucle).** Segmentos
  horizontales de longitud y posición aleatorias por tablas `0x2e42`-`0x2e5a`, color
  por sub-tipo (`0x1292`: `g_unk_13b6+8` / `13b4` / `13ae`). El port mantiene una
  primitiva geométrica. Hueco ya catalogado (`dungeon-decor-mazmorra.md` §6.4 y
  `auditoria-general-cierre-20260727.md`).
- **I — DNGLOOK `0x0340` @`0x048e`, fuente del gem de mazmorra (4 plots).** El glifo
  de la fuente es **vector** (4 `line 0x0B10` + 4 `plot`), no un carácter del font;
  `gemmap.ts` lo declara explícitamente «aquí se aproxima con primitiva (Clase C: el
  trazo exacto es vector)». **Hueco DECLARADO, no defecto.** Si alguien lo calca, la
  forma derivada es: líneas `y=Y+4 x∈[X+1,X+6]`, `y=Y+5 x∈[X+2,X+5]`, `y=Y+6`
  `x∈[X+1,X+2]` y `x∈[X+5,X+6]`; gotas `plot(X+1,Y+2)` y `plot(X+2,Y+1)` en
  `[0x13b2]+8` = 9 azul brillante.
- **K — COMSUBS `0x0f4a`, estallido de impacto (4 plots).** El port **sí** tiene
  equivalente (`paintStarburst`) pero **no es un calco de estas tablas**: genera la
  estrella analíticamente con `|cos(4θ)|` a partir de una medición píxel a píxel del
  frame del original. Además la silueta de 8 puntas tiene **simetría de orden 4**, así
  que **una transposición sería indetectable por forma**. Veredicto honesto:
  **NO-DECIDIBLE por eje**; queda como ticket de calco literal si alguna vez interesa
  (las coordenadas del binario son `x = t1[b]·escalaX + [bp+0xe]`,
  `y = t2[b]·escalaY + [bp+0xc]`, con escalas **independientes** por eje — que el port
  no modela).
- **L — INTRO `0x0050`, semillas del flood-fill (1 plot).** Rutina de relleno con pila
  explícita (`0x55a6`..`0x6606`); el único `plot` marca el píxel semilla. Se invoca
  cuatro veces con constantes: `(44,68)`, `(64,94)`, `(78,143)`, `(105,167)`. Sin
  contraparte en el port (la intro va por bitmap). **SIN-EQUIVALENTE.**

---

## 6. Tickets propuestos

| id | qué | prioridad sugerida | por qué |
|---|---|---|---|
| **T1** | ~~Extender el barrido a las hermanas~~ — **HECHO en #79** (y eran 169 sites en 15 módulos, no 88 en 12). Lo que queda vive en T8/T9 del anexo | ✔ | Es el 56 % restante de la superficie vectorial y comparte el riesgo. El instrumento ya lo censa (`--annex`) y ya valida el eje (`--bounds`); falta la adjudicación contra el port. Empezar por la **retícula de apuntado de combate** (ULTIMA.EXE `0x5813`+) y por las **líneas de celda de la gema** (LOOKOBJ, 22 sites), que sí tienen contraparte. |
| **T2** | **Fijar la convención en un sitio único y citable** — las cinco firmas con su `ret N` y su recortador, y el aviso de que `hline` es la única con la Y en medio | ALTA | Barata y es la profilaxis directa del defecto: las dos fuentes que contaminaron el zodíaco se equivocaron *cada una a su manera* porque no había una firma canónica que citar. |
| **T3** | Calcar el **chorro de la fuente 3D** (`0x1786`) | MEDIA | Ticket preexistente (`dungeon-decor-mazmorra.md` §6.2); este barrido aporta la simetría exacta (espejo sobre x=95, suma `0xBE`) y los 9 call-sites. |
| **T4** | Calcar las **chispas de campo mágico 3D** (`0x127e`) | MEDIA | Ticket preexistente §6.4; hoy el port pinta primitiva de reserva. |
| **T5** | Calcar el **glifo vector de la fuente** en el gem de mazmorra (DNGLOOK `0x048e`) | BAJA | Clase-C declarado en `gemmap.ts`; §5 deja la forma ya derivada, así que el calco es mecánico. |
| **T6** | Calco literal del **estallido de impacto** (COMSUBS `0x0f4a`) con sus tablas y sus **dos escalas independientes** | BAJA | Hoy es una aproximación analítica; el eje no es auditable mientras la forma sea 4-simétrica. |

**No se propone ningún ticket de transposición.** Ése era el objetivo de la tarea y el
resultado es negativo, con los controles del §1.1 y §3 respaldando que el negativo es
una medición y no una ceguera.

---

## 7. Límites declarados de este barrido

1. **Sólo near-calls DIRECTOS.** `call word ptr [..]` / `lcall` no se resuelven; se
   descartan explícitamente en `_call_target`. No he encontrado ninguna llamada
   indirecta a las primitivas, pero el barrido no puede probarlo.
2. **El extractor de argumentos de `--args` lee sólo el camino de caída.** Cuando
   varios caminos convergen en el mismo `call` (la muesca de codo del camino,
   LOOKOBJ `0x0f54`, con cuatro ramas) o cuando hay un `call` dentro de la ventana de
   pushes (LOOKOBJ `0x040a`, el campo de 80 estrellas: el segundo argumento sale de
   `rand_range`), el extractor lo **marca como incompleto** y esos call-sites se han
   leído a mano. Los dos casos del corpus están adjudicados en §4.3 y por #70.
3. **`--bounds` sólo mira argumentos que son inmediatos literales**. Tras #79 son **381**
   sobre los 238 call-sites de las ocho primitivas, y las 381 caen dentro de cota (con el
   convenio transpuesto, 19 no). Los argumentos que vienen de tablas o de variables no
   aportan cota y quedan fuera del control. (Esta línea decía «159 de ~460», cifras del
   corpus de cinco primitivas.)
4. **El anexo está censado pero NO adjudicado** — ver T1. Decir «no hay más ejes
   cruzados» sería falso: lo correcto es «no hay más en el **29 %** barrido»
   (esta línea decía 44 % — cifra superada, ver ANEXO #79 §A1).
5. Los `.DRV` (CGA/EGA/HER/T1K) quedan fuera por construcción: son los drivers de
   vídeo, viven en otro espacio y el kernel entra en ellos por
   `lcall [g_snd_driver_fn]`, nunca por near-call. Contienen la *implementación*, no
   consumidores.

---

# ANEXO — tarea #79 (T1+T2): la familia COMPLETA y qué queda por adjudicar

**T2 entregada** como fichero aparte: [`gfx-arg-convention.md`](gfx-arg-convention.md).

## A1. La familia es de OCHO primitivas, no de tres — enumeración CERRADA

Dejé de descubrirlas de una en una y las cerré **por construcción**: una primitiva
geométrica es una rutina del kernel que fija `g_snd_driver_fn` a una entrada de dibujo
(`0x30` plot, `0x33` line, `0x39` hline, `0x3c` vline, `0x3f` fill, `0x42`, `0x18`
raster-op) **o** que delega en el núcleo común `0x0B2D`. Con los prólogos ocultos ya
corregidos (§A2) el conjunto es cerrado:

| rutina | `ret` | call-sites | qué es |
|---|---|---|---|
| `0x0C64` | 4 | 43 | `plot(x, y)` |
| `0x0C9C` | 6 | 14 | `hline(x0, y, x1)` ⚠ la de la Y en medio |
| `0x0CF2` | 6 | 12 | `vline(x, y0, y1)` |
| `0x0B10` | 8 | 69 | `line(x0, y0, x1, y1)` — despacha a plot/hline/vline según el caso |
| `0x0F90` | 4 | 22 | `line_to(x, y)` ⚠ **sin origen: lo toma del cursor** |
| `0x0B86` | 8 | 19 | `fill_rect(x0, y0, x1, y1)` |
| `0x0AA6` | 8 | 45 | `fill_rect2(x0, y0, x1, y1)` — 2ª entrada al MISMO driver `0x3F` (`clc` vs `stc`) |
| `0x0ACE` | 0xC | 14 | `fill_rect_op(op0, op1, x0, y0, x1, y1)` — driver `0x18` |
| | | **238** | **superficie VECTORIAL total** |

Y **dos miembros de la familia SIN coordenadas**, que por eso no cuentan como superficie:
`0x0BAE` (`ret 2`, 14 llamadas, driver `0x42`) es un fijador de **estado** — un solo
argumento, ningún x/y; y `0x16BA` (`ret 2`, **380** llamadas, driver `0x3F`) es el
**impresor de font**, que dibuja en el cursor.

> **La cifra de cobertura de #72, corregida por tercera y última vez: 69/238 = 29,0 %.**
> Declaré 44 %, luego 38,5 %, y lo cerrado es **29,0 %**. La diferencia con las dos
> anteriores no es de precisión sino de método: este denominador está **demostrado por
> construcción**, no estimado. El veredicto de #72 («cero transpuestos en lo barrido») no
> cambia; su alcance sí.

## A2. ★ Por qué fui a ciegas: 35 prólogos OCULTOS en el `.asm` commiteado

Patrón `00 55 8B EC` — un byte de relleno justo antes de un prólogo. El barrido lineal
se come el `55 8b` como `add byte ptr [di-0x75], dl` y **la rutina deja de existir como
entidad en el `.asm`**. En ULTIMA.EXE hay **35**, de las que 22 se llaman desde el propio
kernel:

```
03a0 0402 0442 0496 0a70 0ace 0bae 0be4 0e94 0f2a 0f46 0f6e 0f90 0fdc 102e
1044 1068 10e0 1140 1674 16ba 1cca 1fa0 207e 2092 20fa 223c 22c0 2316 6f9e
6fbc 6ff0 7040 7200 7234
```

Consecuencias medidas:

- Dos de las ocho primitivas (`line_to 0x0F90` y `fill_rect_op 0x0ACE`) estaban ahí.
- Rutinas que el proyecto **ya usa y ya citó**: `0x16BA` (380 llamadas — el impresor de
  font que cita `gemmap.ts`), `0x0A70` (25 — el `setcolor`), y **`0x0F46` y `0x1CCA`, las
  dos protagonistas de la tarea #71**. No afirmo que #71 esté mal: digo que sus dos
  sujetos viven donde el `.asm` no muestra el límite de rutina, y conviene comprobarlo.
- **Cualquier barrido que enumere rutinas por `push bp; mov bp,sp` sobre estos `.asm`
  tiene 35 agujeros.** Ticket propuesto: T7.

## A3. Adjudicado en esta tanda (el orden que pidió el lead)

- **Retícula de apuntado de combate — ULTIMA.EXE `0x56ac` @`5896`/`58b0`/`58c4`/`58db`
  (4 `line` + 2 `line_to`): FIEL.** Bucle exterior `[bp-6]∈{0,1}` (sube la fila 6→9) ×
  interior `[bp-8]∈{0,1}` (desplaza la columna), con `line_to` cerrando cada esquina
  desde donde quedó el cursor. Blanco en filas {6,9} tramos `x` 2..6 y 9..13, y columnas
  {6,9} tramos `y` 2..6 y 9..13. `strokeAimReticle` pinta exactamente esos ocho tramos, y
  su comentario ya describe bien la estructura de los dos bucles.

  **Verificación de SECUENCIA (no de conjunto).** `line_to` tiene estado, así que comparar
  el CONJUNTO de tramos no basta: el orden puede cambiar el dibujo. Aquí sí basta, y por
  una razón concreta, no por suerte — los blancos ocupan **filas y columnas {6, 9}** y los
  negros **{5, 7, 8, 10}**: los dos conjuntos son **DISJUNTOS**, luego ningún negro puede
  pisar un blanco y el resultado es independiente del orden. La cadena real es, por cada
  una de las 4 pasadas: `line(si, fila, di, fila)` en BLANCO → `line_to(di, [bp-0x16])`
  (que arranca en `(di, fila)`, donde lo dejó la anterior) → `setcolor(0)` → tres negros.
  El `line_to` blanco es el que cierra la esquina, y sólo dibuja la vertical correcta
  porque hereda el extremo del `line` inmediatamente anterior.

  **Divergencia DECLARADA que conviene mirar (ticket T11).** Los ocho tramos NEGROS no son
  decorativos: `setcolor(0)` + `line` sobre la arena **borra terreno**, dejando un halo
  negro de aislamiento alrededor de la cruz (filas 5,7,8,10 y columnas 5,7,8,10). El port
  los omite deliberadamente («la arena asoma por los huecos»). Sobre fondo negro daría
  igual; sobre terreno texturado **no**. Es una divergencia declarada y razonada, no un
  descuido, pero es visual y no la he podido resolver sin testigo.
- **Gema de overworld, las 22 `line` + los rellenos: FIEL.** Esta vez el mapeo
  categoría→handler sale de la **jump-table real** (`0x109e`, 8 entradas para cats 0-7;
  las cats 8-16 van por comparaciones en `0x0f9d`-`0x10ae`), no de adivinar rangos:

  | cat | handler | geometría del binario | port `drawCell` |
  |---|---|---|---|
  | 2·3·7·15 | `0x0b04`/`0x0fc6`/`0x0ffc`/`0x108c` | `fill_rect2(X, Y, X+3, Y+3)` | `fill(color)` ✓ |
  | 4 | `0x0b60` | filas 0 y 3 a lo ancho | `hline(0,0,3)`+`hline(3,0,3)` ✓ |
  | 5 | `0x0b98` | filas 1 y 2, `x` 1..2 | `hline(1,1,2)`+`hline(2,1,2)` ✓ |
  | 6 | `0x0bd0` | filas 0,3 + columnas 0,3 (`y` 1..2) | marco hueco ✓ |
  | 8 | `0x0c36` | filas 0,1 `x`0..1 + filas 2,3 `x`2..3 | dos bloques 2×2 en diagonal ✓ |
  | 9 | `0x0c9c` | filas 0 y 2 a lo ancho | `hline(0,0,3)`+`hline(2,0,3)` ✓ |
  | 14 | `0x1056` | columnas 1 y 2 | `vline(1,0,3)`+`vline(2,0,3)` ✓ |
  | 16 | `0x0e7a` | centro 2×2 rojo + aristas arriba/derecha/abajo/izquierda | mismo orden de bits 8/4/2/1 ✓ |
  | — | `0x11b3` | `fill_rect(X, Y, X+3, Y+3)` = marcador de party | `fillRect(bx,by,CELL,CELL)` ✓ |

- **Código muerto encontrado:** LOOKOBJ `0x0b28` (dos `vline` en columnas 0 y 2) **no
  tiene ni un caller** y no está en la jump-table. Es un estilo de celda que se cayó del
  original — no un hueco del port.

## A4. Triaje del resto: IDENTIFICADO, **no adjudicado**

Los 169 call-sites del anexo se agrupan en **32 rutinas**. Adjudicar las 32 con el
estándar de cuerpo entero no cabía en esta tanda, así que quedan **identificadas y
declaradas pendientes** — no adjudicadas a ojo. Las de mayor valor primero:

| grupo | sites | qué es | por qué importa |
|---|---|---|---|
| ~~ULTIMA.EXE `0x637e`~~ | 22 | **chrome estático de pantalla completa** | ✔ **ADJUDICADO FIEL** — ver §A6 |
| DNGLOOK `0x0284` | 8 | franjas multicolor del **campo mágico** del gem de mazmorra | `gemmap.ts` ya lo declara aproximado |
| DNGLOOK `0x0340` | 6 | glifo vector de la **fuente** del gem | hueco ya declarado en #72 §5 |
| COMSUBS `0x0f4a` | 8 | **estallido de impacto** (las líneas, además de los 4 plots de #72) | sigue siendo NO-DECIDIBLE por simetría de orden 4 |
| INTRO ×7 rutinas | 31 | efectos de la intro (incluye 8 `fill_rect_op` en `0x072e`) | la intro del port va por bitmap |
| CAST2 ×3 | 7 | destellos de hechizo | — |
| SHOPPES/SHOPPES3/OUTSUBS/TOWN/BLCKTHRN/CMDS/ENDGAME | 14 | fondos de panel de tienda y diálogo | geometría de rectángulo, riesgo de eje bajo |
| FONT ×2 | 7 | cajas del render de fuente | — |
| resto ULTIMA.EXE ×11 | 16 | paneles y barras sueltas del kernel | — |

**Aviso de método sobre A4**: para acelerar el careo de `0x637e` escribí un simulador de
pila que evaluaba los `push` y devolvía los rects. Devolvió `fill_rect2(0,0,319,319)` y
`line(125,125,125,184)` — imposibles en una pantalla de 200 de alto. **Lo cazó el propio
control de cotas de §1.1 aplicado a mi instrumento**, no a los datos. No he reportado esos
rects y `0x637e` queda sin adjudicar: un extractor que falla su propio control no sirve
para adjudicar, y arreglarlo bajo prisa era la vía directa a una cifra inventada.

## A5. Tickets nuevos

| id | qué | prioridad |
|---|---|---|
| **T7** | **Prólogos ocultos**: enseñar a `disasm.py` (o a los consumidores) el patrón `00 55 8B EC` y re-censar las 35 rutinas invisibles de ULTIMA.EXE; comprobar si toca a #71 (`0x0F46`, `0x1CCA`) | **ALTA** — invalida silenciosamente cualquier enumeración por prólogo |
| ~~**T8**~~ | ~~Carear `0x637e` contra `skin/fiel/frame.ts`~~ — **HECHO, §A6: FIEL** | ✔ |
| **T9** | Adjudicar las **29** rutinas restantes del anexo (§A4; eran 30, `0x637e` sale por T8) | MEDIA |
| **T10** | `line_to` tiene ESTADO: auditar que ningún consumidor portado reordene llamadas encadenadas. **Criterio derivado en §A3**: si los conjuntos de píxeles de cada color son DISJUNTOS, el orden es irrelevante y basta comparar conjuntos; si se solapan, hay que comparar secuencias | MEDIA |
| **T11** | Retícula de apuntado: el original **borra terreno** con 8 tramos negros de aislamiento (filas/cols 5,7,8,10) que el port omite por decisión declarada. Resolver con testigo visual | MEDIA |

## A6. T8 cerrado — chrome de pantalla `0x637e`: **FIEL**, y el port iba por delante

Con un extractor **validado antes de usarlo** (§A7), los 22 call-sites salen coherentes y
con **cero violaciones de cota**. Careo contra `skin/fiel/frame.ts`:

**7 barras** (`fill_rect2 0x0AA6`, color `g_unk_13b2`) — las siete casan **exactas** con
`FRAME_FILLS`, cada una con su offset ya anotado en el port:
`(0,0,319,6)` `(0,185,191,191)` `(0,0,6,191)` `(185,0,191,191)` `(313,0,319,87)`
`(192,80,312,87)` `(192,57,312,63)`. Más el borrado previo a pantalla completa
`fill_rect2(0,0,319,199)` en color 0, que el port hace con
`ctx.fillRect(0,0,SCREEN_W,SCREEN_H)`.

**14 tramos** (`line` ×4 + `line_to` ×10, color `g_unk_13b0`) = **cuatro polilíneas
CERRADAS**, y aquí es donde el estado de `line_to` importa de verdad:

| polilínea | cadena del binario | resultado |
|---|---|---|
| borde del viewport | `line(7,7,7,184)` → `line_to(184,184)` → `line_to(184,7)` → `line_to(7,7)` | rectángulo (7,7)-(184,184) |
| L del panel | `line(191,191,191,87)` → `line_to(319,87)` | ángulo |
| caja superior | `line(191,7,312,7)` → `(312,56)` → `(191,56)` → `(191,7)` | rectángulo |
| caja inferior | `line(191,63,312,63)` → `(312,80)` → `(191,80)` → `(191,63)` | rectángulo |

**El port resuelve las cadenas BIEN**: cada entrada `point` de `FRAME_SEGMENTS` lleva sus
DOS extremos, con el origen heredado del tramo anterior — exactamente la semántica de
`line_to`. Los 14 tramos coinciden uno a uno.

> **Nota honesta que corrige mi propio relato.** La cabecera de `frame.ts` **ya
> documentaba** `point(x,y) = kernel 0x0F90` y **ya explicaba** que «continúa la polilínea
> desde el último extremo», y **ya identificaba** el relleno como `0x0AA6` y no `0x0B86`.
> Es decir: la séptima primitiva y su estado, que yo presenté en #79 como hallazgo, **ya
> estaban escritos en el port** desde antes. Mi censo no los tenía porque el instrumento
> partía de las tres primitivas del encargo y de un `.asm` con el prólogo oculto — pero
> **la respuesta ya estaba en el repo y no la crucé**. Es el mismo patrón que el carril
> lote-mecánica-54 («en 6 de 7 el port ya tenía la respuesta sin usarla»): **cruzar el
> repo antes que el binario**, incluso cuando el trabajo es de RE.

## A7. El extractor de A6, y por qué esta vez sí

El de §A4 devolvía valores imposibles. La causa **no era el modelo de pila**: era que mi
regex de inmediatos exigía prefijo `0x`, y **capstone imprime los inmediatos pequeños en
DECIMAL** (`mov ax, 6`), así que el registro conservaba el valor anterior y salía
`fill_rect2(0,0,319,319)` en vez de `(0,0,319,6)`. (El mismo detalle que el `_IMM` de
`--bounds` sí contemplaba con `(0x[0-9a-f]+|\d+)` — de ahí que aquel control estuviera
bien y éste no.)

Dos guardas antes de dar por bueno un número, y las dos son re-ejecutables:

1. **Validación contra VERDAD CONOCIDA**: el extractor se corre primero sobre el destello
   del esqueleto (DUNGEON `0x150a`), cuyos 4 `hline` están adjudicados byte a byte desde
   #72 y cableados en `dungeon-decor.ts`. Si no reproduce `(0x5c,0x57,0x5d)`
   `(0x5b,0x58,0x5d)` `(0x61,0x57,0x62)` `(0x61,0x58,0x63)`, no se usa.
2. **Control de cotas sobre su propia salida**: cero argumentos fuera de 320×200.

La primera versión pasaba (1) y fallaba (2) — por eso (2) hace falta aunque (1) pase: un
caso de verdad conocida sin inmediatos decimales no ejercita el defecto.

## A8. T9, primera tanda por módulos

### A8.1 ★ `fill_rect 0x0B86` es, casi siempre, «limpia el viewport» — 14 sites, **FIEL**

Extraídos con el extractor de §A7 (re-validado antes de cada uso; cero violaciones de
cota), **14 de los 19** call-sites de `fill_rect` llevan la **misma tupla literal**:

```
fill_rect(8, 8, 183, 183)
```

en **cinco overlays distintos**: DUNGEON `@0496` `@04aa` · OUTSUBS `@08aa` ·
SHOPPES `@13c1` `@1403` `@1438` · ENDGAME `@0778` · CAST2 `@0031` `@007a` `@0bcd`
`@0c41` `@0dbd` `@0dd4` `@0deb`.

`(8,8)-(183,183)` es exactamente el **viewport de juego**: 176×176 px. El port declara
`VIEWPORT = { x: 8, y: 8, tile: 16, tiles: 11 }` → `8 + 16·11 − 1 = 183` en los dos ejes.
**Coincide al píxel**, así que los 14 quedan **FIEL** de un tirón: todo overlay que
necesita blanquear la ventana del mapa lo hace con este mismo rectángulo, y el port usa
ese mismo rectángulo en `paintGemMapOverworld` y compañía.

Los 5 restantes de `fill_rect`: LOOKOBJ `@11b3` (marcador de party, ya FIEL en §A3),
SHOPPES3 ×3 `(198, 40, 305, …)` y ULTIMA.EXE `@2a4a` `(192, …, 311, …)` — paneles, con
algún argumento que no es inmediato ⇒ **pendientes**, no adjudicados.

### A8.2 Campo mágico del gem de mazmorra (DNGLOOK `0x0284`, 8 `line`): **el port es MÁS fiel de lo que declara**

Cuerpo entero: `[bp+6]`=X, `[bp+4]`=Y de la celda (8×8 en el gem de mazmorra). Ocho
`line` horizontales, `x` de **X+1 a X+6**, filas Y+0…Y+7, en **cuatro pares de color**:

| filas | color | EGA |
|---|---|---|
| 0, 1 | `g_unk_13b6 + 8` | 13 magenta claro |
| 2, 3 | `g_unk_13ae + 8` | 12 rojo claro |
| 4, 5 | `g_unk_13b2 + 8` | 9 azul claro |
| 6, 7 | `g_unk_13b4 + 8` | 10 verde claro |

El port (`gemmap.ts`) tiene `FIELD_STRIPES = [0xd, 0xc, 0x9, 0xa]` — **los cuatro colores
exactos y en el mismo orden de arriba abajo** — y `paintField` reparte
`band = cell / 4`, que con `cell = 8` da **bandas de 2 px, exactas**.

⇒ La etiqueta «**Clase C: el patrón exacto es vector**» que lleva `gemmap.ts`
**subestima lo que ya está bien**: colores, orden y alturas son literales. La **única**
divergencia es el **sangrado horizontal de 1 px** — el binario pinta `x ∈ [X+1, X+6]`
(6 px dentro de una celda de 8) y el port rellena la celda entera. Ticket **T12**:
retirar/estrechar la etiqueta Clase-C y añadir el sangrado; es una línea de código y una
de comentario.

### A8.3 Estado de T9

Adjudicado en esta tanda: **15 call-sites** (los 14 del viewport + los 8 del campo
mágico cuentan como 2 grupos; sites: 14 + 8 = 22). Quedan **~24 rutinas** del anexo sin
adjudicar, entre ellas las que el extractor no resuelve por venir de registros (INTRO ×7,
FONT `0x04a4` parcial, SHOPPES3, ULTIMA.EXE `@2a4a`) — para ésas hace falta lectura de
cuerpo, que es lo que consume el tiempo.

| ticket nuevo | qué | prioridad |
|---|---|---|
| ~~**T12**~~ | ~~`gemmap.ts` `paintField`~~ **HECHO**: sangrado de `cell/8` a cada lado (el `X+1`/`X+6` de 0x0284, extremos inclusivos) + las TRES declaraciones Clase-C del campo retiradas (docblock de fichero, comentario de las franjas y el del call-site). Test nuevo `gem-field-inset.test.ts`, mutante verificado | — |

## A9. ★ Segunda forma de fallar de la atribución por prólogo: rutinas SIN MARCO

Al carear el último bloque del kernel estuve a punto de reportar que la cita del port para
`0x4DEA` era falsa: `skin.ts` la describe como `set_active_window(0); set_cursor(0x1e,0x0a);
draw_box_edge(►); putchar; draw_box_edge(◄)`, y mi extracción decía que `0x4DEA` pintaba una
barra azul y una regla blanca. **El equivocado era yo, y el port tenía razón.**

Cuerpo entero de `0x4DEA` (`ret 2`, termina en `0x4E1C`): es EXACTAMENTE lo que dice el
port — guarda `[0x5386]`, `0x1B94(0)`, `0x1BF2(0x1E, 0x0A)`, `0x4C2A`, `0x16BA([bp+4])`,
`0x4CCE`, restaura. **No toca ni una primitiva gráfica.** La barra azul la pinta
**`0x4E20`**, que es OTRA rutina que empieza justo después.

**Por qué se me coló:** `0x4E20` **no tiene prólogo** — no usa marco de pila, empieza
directamente con `push [g_unk_13b2]` y acaba en un `ret` liso. Mi atribución de call-sites a
rutinas busca `push bp; mov bp,sp`, así que **no la ve como rutina** y le cuelga su cuerpo a
la anterior con prólogo.

Es un **segundo modo de fallo**, distinto del de §A2 (#80): allí el prólogo EXISTÍA pero un
byte de relleno lo desalineaba; aquí **no hay prólogo en absoluto**. Los dos rompen la misma
suposición y ninguno avisa.

**Las tres rutinas SIN MARCO del chrome, con su geometría y sus llamadas** (barrido de bytes
`E8` sobre todo el corpus):

| rutina | llamadas | qué pinta |
|---|---|---|
| `0x4DAA` | **9** | `fill_rect2(240, 81, 263, 86)` azul + `hline(240, 80, 263)` + `hline(240, 87, 263)` blancas — plaquita de 24×8 en el panel derecho |
| `0x4E20` | **6** | `fill_rect2(192, 0, 311, 6)` azul + `hline(192, 7, 311)` blanca — banda superior del panel |
| `0x4EFC` | **5** | `vline(191, 56, 63)` + `vline(312, 56, 63)` blancas + `fill_rect2(192, 56, 311, 63)` negro — banda separadora |

⇒ **`0x4daa` y `0x4efc` eran los nombres CORRECTOS** de dos de los tres pintores de chrome
sin marco, y mi «corrección» de §4 los degradó a «bloques dentro de otra rutina». Queda
retractada arriba.

**Lección, que es la misma de #80 con otra cara:** antes de decir que una dirección «no es
una rutina», comprueba que **termina en `ret` y que alguien la llama**. Las dos pruebas son
baratas y las dos habrían evitado esto. `0x4DAA` tiene **nueve** call-sites: no era un
bloque suelto ni por asomo.

**Y el aviso de proceso:** esta retractación existe porque el careo con el port me obligó a
mirar. Si el port no hubiera tenido su cita de `0x4DEA`, mi atribución errónea habría pasado
sin ruido. **La contraparte no sólo se audita: también audita.**

### A9.1 Cuántas son — medida, no anécdota

Criterio re-ejecutable: primera instrucción **no-`nop`** después de un `ret`, que **no** sea
`push bp`, y que **alguien llame** (barrido de bytes `E8` sobre el corpus entero, con la base
por overlay). En ULTIMA.EXE:

- **136** bloques candidatos a rutina sin marco;
- de ellos, **42 están REALMENTE LLAMADOS** — ésas son rutinas de pleno derecho que la
  enumeración por prólogo **no ve**;
- **control positivo**: los tres pintores de chrome salen con sus cifras
  (`0x4DAA` 9 · `0x4E20` 6 · `0x4EFC` 5), y entre las demás aparecen piezas que este mismo
  documento lleva citando todo el rato — **`0x08E6`** (8 llamadas, el recortador de
  `line`/`fill_rect`) y **`0x0B2D`** (2, el núcleo común de `line`/`line_to`).

⚠ Mi primer conteo dio **36** porque el candidato se buscaba en la instrucción
inmediatamente posterior al `ret`, y `0x4E20` y `0x4EFC` van precedidas de un `nop` de
relleno — es decir, **el propio caso que estaba investigando se me escapaba del contador**.
Saltando el relleno son 42. Lo dejo escrito porque la cifra sin el ajuste parecía perfectamente
razonable.

⇒ Sumado a los **35** prólogos ocultos por el byte de relleno (§A2 / #80), la enumeración por
prólogo de ULTIMA.EXE tiene **dos** familias de agujeros por causas distintas. Material para
#80; no lo trabajo yo.

## A10. T9 tanda 2 — la API COMPARTIDA de bandas del panel (ULTIMA.EXE), re-atribuida

Con los límites de rutina corregidos (181 prólogos incl. los ocultos + 42 sin marco = 223),
los **58** sites gfx de ULTIMA.EXE se reparten en 15 rutinas, y **cuatro de las cinco que
pintan las bandas del panel NO tienen marco de pila** — por eso §4 las había fundido con sus
vecinas. Geometría (extractor validado, cero violaciones de cota) y llamadas medidas por
barrido de bytes `E8` sobre el corpus entero:

| rutina | llam. | qué hace | quién la llama |
|---|---|---|---|
| `0x4DAA` ⬦ | 9 | plaquita: `fill_rect2(240,81,263,86)` azul + `hline(240,80,263)` + `hline(240,87,263)` blancas | ZSTATS ×8, CAST ×1 |
| `0x4E20` ⬦ | 6 | banda superior: `fill_rect2(192,0,311,6)` azul + `hline(192,7,311)` blanca | kernel, SHOPPES, CMDS, CAST, ZSTATS ×2 |
| `0x4E50` | 6+ | la MISMA banda pero **PARTIDA**: dos medias barras y dos medias reglas con el corte por argumento (deja hueco para un rótulo) | kernel, SHOPPES, CMDS, CAST, ZSTATS ×5 |
| `0x4EFC` ⬦ | 5 | banda separadora — **BORRA**: `vline(191,56,63)` + `vline(312,56,63)` blancas + `fill_rect2(192,56,311,63)` **negro** | CMDS, CAST, ZSTATS ×2, SHOPPES3 |
| `0x4F3C` ⬦ | 7 | la misma banda — **PINTA**: `fill_rect2(191,57,312,62)` + `hline(192,56,311)` + `hline(192,63,311)` | kernel, SHOPPES, CMDS, CAST, ZSTATS ×2, SHOPPES3 |

⬦ = sin marco de pila. `0x4EFC` y `0x4F3C` son un **par borra/pinta** de la misma banda, y
`0x4E20`/`0x4E50` son la variante entera y la partida de la banda superior.

**Qué son, entonces:** la **API compartida de repintado de bandas** que usan los overlays de
UI (ZSTATS, CAST, CMDS, SHOPPES, SHOPPES3) cuando cambian el contenido del panel derecho.
Encaja con la regla ya registrada de que el chrome compartido se censa en TODOS los overlays.

**Careo con el port — NO ADJUDICABLE en esta tanda, y por qué.** `frame.ts` modela el marco
**estático** (`0x637E`, ya FIEL en §A6) y `skin.ts` tiene overlays de banda concretos
(`drawScrollArrowBand` calca `0x4DEA`). Pero el port **no tiene una capa equivalente de
repintado dinámico**: pinta el marco una vez y compone encima. Decidir si eso es un hueco
exige saber **cuándo** el original llama a cada painter — es decir, el contexto de los 33
call-sites en cinco overlays —, y eso es una tarea de flujo de UI, no de geometría.
**Declarado pendiente**, con la geometría y los llamantes ya derivados para quien la coja.

**Nota de alcance sobre §A6:** que `0x637E` sea FIEL **no** implica que el chrome entero lo
sea. `0x637E` es el marco inicial; estas cinco son los repintados. La adjudicación de §A6
cubre lo primero y no dice nada de lo segundo.

## A11. T9 tanda 3 — mazmorra, placas de rótulo y los que quedan

### A11.1 ★ El pasillo 3D se espeja con UNA operación ráster, no rodaja a rodaja

`dng_draw_view` (DUNGEON `0x1A90`) hace, en este orden:

```
fill_rect2   (  8,  8, 183, 183)      ; limpia el viewport (el literal de §A8.1)
fill_rect2   ( 96, 14, 175, 178)      ; borra la MITAD DERECHA
fill_rect_op (1, 0, 16, 14, 175, 178) ; op de RÁSTER sobre x∈[16,175], y∈[14,178]
```

`96` es exactamente el eje de espejo que el port documenta («mitad izquierda normal en
`96−ancho`, mitad derecha espejada en `X=96`»), y `y=14` es su `Y=14`. ⇒ el original
**compone la mitad izquierda y luego ESPEJA el bloque entero de una vez** con
`fill_rect_op`, mientras el port blitea cada rodaja y espeja las del lado derecho una a una.

**Mismo resultado esperado, mecanismo distinto** — y por eso el careo pieza a pieza no
aplica aquí: no hay 28 llamadas que emparejar con 28 rodajas, hay **una**. Lo que sí se
puede comparar es la **caja**: el ASM opera sobre `y ∈ [14, 178]` = **165 px de alto**,
mientras `dungeon.ts` declara «altura nativa **164**, Y=14». Lo dejé como ticket **T13** con
la sospecha de una «discrepancia de UNA fila».

> ★ **T13 CERRADO por EQUIVALENCIA — y la discrepancia era MÍA** (`caja-espejo-93.md`). Las
> dos cifras no miden lo mismo. **165 es la extensión de las operaciones RÁSTER**: la esquina
> del relleno es INCLUSIVA, derivado del contador del driver EGA y corroborado porque
> `(8, 8, 183, 183)` da los 176 del viewport, el mismo número que el port obtiene por otra
> vía. **164 es la altura del ARTE**, medida en `dungeon-persp.json`: las 3 variantes tienen
> sus 26 rects a `h=164` exacto, y ese asset se extrajo de los `DNG*.16` de EA ⇒ el arte del
> ORIGINAL también mide 164. La fila 178 sale NEGRA en los dos (limpiada antes de todo, y el
> espejo copia negro sobre negro). ⚠ La trampa es generalizable: comparaba una caja de
> esquina INCLUSIVA contra una coordenada de ARISTA de canvas, y esa mezcla desvía 1 px
> *cualquier* careo geométrico de este anexo, siempre en el mismo sentido.

`0x03D6` hace la misma operación sobre otra caja: `fill_rect_op(1, 0, 40, 14, 150, 178)`
(x∈[40,150]) — vista más estrecha, probablemente otra profundidad o el visor de feature.

### A11.2 Dos versiones de la placa de rótulo, con una fila de diferencia

Tres rutinas pintan la **misma pareja de placas** (arriba sobre el viewport, abajo bajo él):

| rutina | placa superior | regla | placa inferior | regla |
|---|---|---|---|---|
| kernel `0x4A84` | `fill_rect2(40, 0, 152, **6**)` | `line(40,7,152,7)` | — | — |
| DUNGEON `0x0332` | `fill_rect2(40, 0, 152, **7**)` | `line(40,7,152,7)` | `fill_rect2(48,185,152,191)` | `line(48,184,152,184)` |
| kernel `0x2E96` | — | — | `fill_rect2(48,185,152,191)` | `line(48,184,152,184)` |

Las inferiores de DUNGEON y del kernel son **idénticas**. Las superiores difieren en **una
fila**: el kernel rellena hasta `y=6` y DUNGEON hasta `y=7`, **pisando su propia regla**.
No sé si es intencional (la regla se redibuja justo después, así que no se ve) o un desliz
del original; lo dejo **medido y sin veredicto**.

### A11.3 Lo que queda, y por qué no lo cierro aquí

- ~~**SHOPPES3 `0x04E6`** y **kernel `0x2A28`**: argumentos no-inmediatos, pendientes.~~
  **LEÍDOS y adjudicados en §A13** — son barras de resalte de fila.
- **INTRO ×7 rutinas (31 sites)**: la intro del port va por **bitmap**, así que el careo
  geométrico no tiene con qué emparejarse. Es el candidato más claro a
  **SIN-EQUIVALENTE por diseño**, pero eso hay que *declararlo* leyendo, no suponerlo.
- ~~**FONT `0x04A4` / `0x0B0A`**: parecen un banco de pruebas sin uso en juego.~~
  **HIPÓTESIS REFUTADA en §A12.3** — son puntos de ENTRADA del overlay y sólo las llama
  INTRO. Menos mal que iba etiquetada como hipótesis.
- **DNGLOOK `0x0340`** (Clase-C ya declarada en #72 §5) y **COMSUBS `0x0F4A`**
  (NO-DECIDIBLE por simetría de orden 4) siguen como estaban.

| ticket nuevo | qué | prioridad |
|---|---|---|
| ~~**T13**~~ | ~~Caja del pasillo 3D: la fila de diferencia~~ **CERRADO por EQUIVALENCIA** — 165 es la caja RÁSTER (esquina inclusiva) y 164 la altura del ARTE, medida y común a los dos lados; la 178 es negra en ambos | — |

## A12. T9 tanda 4 — INTRO y FONT: la intro NO es todo bitmap

### A12.1 `INTRO 0x04E0`: **FIEL**, y el port lo tenía con la cita exacta

Es una **polilínea cerrada**, el cuarto caso de la cadena `line`+`line_to`:
`line(7,127,312,127)` → `line_to(312,192)` → `line_to(7,192)` → `line_to(7,127)` =
rectángulo **(7,127)-(312,192)**.

`intro.ts` declara `INTRO_PANEL_WHITE = { x0: 7, y0: 127, x1: 312, y1: 192 }` citando
«`draw_menu_border` (**0x056f-0x05a0**)» — y mis cuatro call-sites caen en `0x057F`, `0x058A`,
`0x0595`, `0x05A0`, **dentro de ese rango**. Coincidencia exacta de geometría y de cita.
**FIEL.**

⇒ Corrige mi propia suposición de §A11.3: **la intro del port NO es «todo bitmap»**. Modela
la geometría vectorial del panel y al menos esta pieza es literal. Yo la había clasificado
como «candidato más claro a SIN-EQUIVALENTE por diseño» — y lo dejé como suposición
explícita precisamente porque no la había leído. Al leerla, era lo contrario.

### A12.2 `INTRO 0x1E62`: la MISMA figura, más pequeña, y **no la encuentro en el port**

Idéntica cadena de cuatro tramos sobre **(7,159)-(312,184)**. En `intro.ts` sólo existe
`INTRO_PANEL_WHITE` (la de §A12.1); **no hay constante ni código con 159/184**. Candidato a
hueco → ticket **T14**. No lo llamo hueco cerrado porque no he rastreado quién invoca
`0x1E62`: podría ser una pantalla que el port no reproduce por otra vía.

### A12.3 ★ FONT `0x04A4`/`0x0B0A`: mi hipótesis del «banco de pruebas» era FALSA

En §A11.3 escribí que **parecían** un banco de pruebas del overlay sin uso en juego, y dejé
apuntado que faltaba ver quién las llamaba. Comprobado, y es lo contrario:

- Las dos son **PUNTOS DE ENTRADA del overlay**, alcanzables desde el kernel por los stubs
  `0x7CDA` (→`0x04A4`) y `0x7CCE` (→`0x0B0A`).
- Sus **únicos** llamantes son **INTRO.OVL** (2 y 1 llamadas). No son código muerto ni de
  prueba: son **parte del flujo de intro**.
- Pintan `fill_rect2(120,120,199,126)` + `line(120,127,199,127)` y su gemela con `x1=200`.
  El `y 120..126` azul + regla blanca en `y=127` casa con lo que `intro.ts` describe como
  «GRUESO del panel (azul ~6 px + blanco, y121-127)» ⇒ son **trozos** del panel de intro.

**Diferencia de modelo, medida:** el port pinta el panel como **un rect de ancho completo**
(`INTRO_PANEL = (0,120)-(319,199)`); el binario lo pinta **a trozos** y éstos cubren sólo
`x ∈ [120,199]` y `x ∈ [120,200]`. Si los demás trozos teselan el resto, el resultado es el
mismo; **no lo he comprobado** y por eso no hay veredicto.

### A12.4 El resto de INTRO, identificado

`0x043E` barras inferiores partidas `(8,193,…,199)` y `(…,193,311,199)` con reglas en
`y=192` — mismo patrón «entera / partida» que la banda superior de §A10. `0x05B0`
`fill_rect_op(1,0,0,0,319,100)` = op de ráster sobre la mitad superior. `0x072E` seis
`fill_rect_op` sobre **franjas verticales estrechas** (`x` 152-159, 136-143, y los bordes
`y=63`/`y=199` de `x∈[144,175]`) = el efecto de **cortinilla** de la intro. `0x0986`
`fill_rect2(0,140,319,199)` + `fill_rect_op` sobre la misma caja. Geometría derivada;
**careo no hecho** — la cortinilla y las cinemáticas son animación, no rectángulos estáticos.

| ticket nuevo | qué | prioridad |
|---|---|---|
| ~~**T14**~~ | ~~Segunda orla de menú~~ **CERRADO, NO es hueco de chrome** (§A14.2): no es una orla de menú sino el marco de la pantalla de IMPORTAR PERSONAJE DE ULTIMA IV, y el port declara ese flujo sin portar en `faithful-intro.ts:1448`. Geometría derivada y guardada por si se porta | — |

## A13. T9 tanda 5 — los dos últimos pendientes: barras de RESALTE de fila

Leídos de cuerpo, porque el extractor no los resolvía (los argumentos vienen de registros):

- **kernel `0x2A28(row)`**: `si = row << 3`, luego
  `fill_rect(192, si+8, 311, si+15)` en `g_unk_13b0` (blanco) ⇒ **banda de 8 px alineada a la
  rejilla de caracteres**, ancho completo del panel derecho, en la fila `row`.
- **SHOPPES3 `0x04E6`**: `di` arranca en **40** y los tres `fill_rect(198, di, 305, di+7)`
  se disparan al moverse la selección, con `di` avanzando **±8** (`sub di,8` al subir,
  `add di,8` al bajar) ⇒ la **misma idea**, 108 px de ancho, en la lista de la tienda.

Ambas son **barras de selección de fila**. Con esto la cola declarada de T9 queda sin
pendientes: todo está adjudicado, o declarado no-adjudicable con su motivo.

### A13.1 ⚠ Matiz de alcance sobre §A8.1 (los 14 «limpia el viewport»)

Al leer estas dos apareció algo que acota mi propia adjudicación de §A8.1. `fill_rect 0x0B86`
se usa **para las dos cosas**: 14 rectángulos del tamaño del viewport **y** estas barras de
resalte. Y lo que hace visualmente **no lo decide la primitiva**: el modo de escritura lo fija
**aparte** `0x0C22` (entrada de driver `0x0F`) — es lo que `gemmap-overworld.ts` documenta al
decir que «`0x6992` conmuta el modo — 1 para la rejilla, 0=XOR para el marcador»
(`0x6992` + base LOOKOBJ = `0x0C22`).

⇒ **Lo que §A8.1 demuestra es que los 14 comparten el RECTÁNGULO del viewport al píxel**, y
eso es lo que hace FIEL la geometría. **La palabra «limpia» supone modo de copia**, y ese modo
**no lo he trazado** en ninguno de los 14 call-sites. Si alguno corre en XOR, ahí no limpia:
invierte. La geometría se sostiene; el verbo va acotado.

> ★★ **T15 RESUELTO — y el verbo cae** (`verbo-limpia-97.md`). Trazado el conmutador: **51
> call-sites** (45 de overlay + 6 del kernel), que van en **pares** 1↔0. **Ninguna de las 14
> rutinas fija el modo antes de su relleno** —OUTSUBS, SHOPPES y CAST2 no lo conmutan en
> NINGÚN punto, y la única que sí lo toca (`endgame_main`) lo hace DESPUÉS— ⇒ el modo ahí es
> **AMBIENTE**. Y el ambiente **no es derivable**: la mayoría de rutinas terminan dejando 0
> mientras `blink` restaura 1, o sea los setters se contradicen sobre cuál es el reposo.
> ⇒ **«limpia» no se sostiene para ninguno de los 14**; la geometría sigue intacta. ★ Indicio
> fuerte del verbo CONTRARIO: las 14 rutinas son todas EFECTOS (campo eléctrico, aparición de
> campamento, destello del sanador, ceremonia del Códice, visita al santuario…) y llaman al
> relleno 2 o 3 veces cada una — la forma de un DESTELLO por XOR, no de un borrado. Se deja
> como lectura probable y no como veredicto porque se apoya en NOMBRES del ledger. Lo cierra
> un testigo de un fotograma (§6 del acta).

*(Descartado de camino: la diferencia `stc`/`clc` entre `0x0B86` y `0x0AA6` **no** es el
XOR — el XOR viene de `0x0C22`. Qué distingue exactamente el acarreo sigue **sin derivar**;
no lo afirmo.)*

| ticket nuevo | qué | prioridad |
|---|---|---|
| **T15** | Trazar el modo de escritura (`0x0C22`) vigente en los 14 call-sites de `fill_rect(8,8,183,183)`: ¿copia o XOR? Acota el verbo de §A8.1 | BAJA |

## A14. T14 rastreado — la orla pequeña **SÍ es alcanzable**, y dos veces estuve a punto de decir lo contrario

**Cadena de alcanzabilidad** (todo en espacio FILE de INTRO, saltos `E8`/`E9`/`EB` y
límites de rutina con los bloques sin marco incluidos):

```
0x1E62  (orla pequeña (7,159)-(312,184))
   ← call-site 0x2024   [bloque SIN MARCO]
   ← call-site 0x1544   en rutina 0x132A
   ← call-site 0x0FA3   en rutina 0x0986  ★ ENTRADA POR STUB
```

`0x0986` es **`intro_main_controller`** — la misma rutina que `intro.ts` cita en su
cabecera. ⇒ La orla pequeña **NO es rama muerta**: cuelga del controlador principal de la
intro. **T14 sigue vivo** como candidato a hueco del port, que sólo tiene la orla grande.

### A14.1 ⚠ Dos barridos míos daban «código muerto», y los dos eran falsos

El veredicto cómodo aquí era «rama muerta, cerrar el ticket». Estuve a punto de darlo **dos
veces**, con dos defectos distintos de mi propio instrumento:

1. **Espacios de direcciones mezclados.** El primer barrido recorría todo el corpus
   calculando `(target + base) & 0xFFFF` —espacio kernel— y lo comparaba contra `0x2024`,
   que es un offset **file-relativo de INTRO**. Nunca podían coincidir ⇒ «NADIE».
2. **Subir por el call-site en vez de por su rutina.** El segundo preguntaba quién llama a
   `0x1544`, que es un offset **dentro** de una rutina. Nadie llama a un punto medio ⇒
   «NADIE» otra vez.

**Los dos errores empujaban a la MISMA conclusión falsa, y era la que cerraba el ticket.**
Sólo cayeron por insistir con el control: la orla GRANDE `0x04E0` —que ya sabía viva por
§A12.1— tiene **dos** call-sites, así que un método que devolviera «nadie llama a nada»
estaba roto. **El control positivo de una pieza conocida-viva es lo que distingue “no lo
encuentro” de “no existe”**, y aquí lo que fallaba no eran los datos sino mis dos consultas.

### A14.2 ★ T14 CERRADO — no es un hueco del CHROME: es el marco de un FLUJO ya declarado sin portar

Faltaba la mitad de la pregunta: *qué pantalla* es esa orla. La cadena de A14 lo dice si se
resuelve cada eslabón a su rutina en vez de quedarse en el offset:

| offset | rutina contenedora | estado |
|---|---|---|
| `0x1E62` | `draw_bottom_box_frame_40x5` | IDENT |
| `0x2024` | **`draw_transfer_frame` (importación de U4)** | IDENT |
| `0x1544` | `character_sheet` (0x132a, 2808 B) | IDENT |
| `0x0FA3` | `intro_main_controller` (0x0986, 1680 B) | IDENT |

⇒ La orla pequeña `(7,159)-(312,184)` es **el marco de la pantalla de importar un personaje
de Ultima IV**, colgada de la hoja de personaje. No es una «segunda orla de menú».

Y el port **ya declara ese flujo como no portado**, con su nombre y en el sitio que decide:

> `game/src/ui/faithful-intro.ts:1448` — `case "stay": // Transfer from Ultima IV — el clon
> no importa U4 (Clase C)`, que vuelve al menú sin efecto.

⇒ **No es un hueco de la capa de chrome.** El port tiene la entrada de menú y no el flujo; la
orla que le falta es una CONSECUENCIA de esa decisión ya tomada y declarada, no un
rectángulo que se haya olvidado de pintar. Si alguna vez se porta la importación de U4, la
geometría está aquí derivada y no hay que volver a buscarla.

⚠ Nota de encuadre, que es lo que casi me hace fallar otra vez: el ticket preguntaba «¿es
hueco?» y yo tenía la alcanzabilidad medida desde A14 — con eso solo se puede responder «la
rutina se ejecuta», que **no** es lo mismo que «al port le falta algo». Lo que discrimina es
la IDENTIDAD de la pantalla, y esa estaba a un `frontier.json` de distancia.

Regla para el rastreo de alcanzabilidad, que resume los dos fallos: **un solo espacio de
direcciones, y subir siempre a la ENTRADA de la rutina contenedora — nunca preguntar por el
offset del call-site.** Y terminar en una entrada por stub o en «sin llamantes», no en medio.
