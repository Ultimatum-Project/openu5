# Kernel sweep — BARRIDO lote 3 (task #16)

> Lectura instrucción-a-instrucción del tercer lote de nivel A del kernel
> (`re/coverage-depth.md` §8bis "composición del lote 3"). Convención idéntica a los
> lotes 1-2: offsets `0xNNNN` = offset de imagen del kernel en `re/disasm/ULTIMA.EXE.asm`
> (CS-relativo). `[0xNNNN]` = global **DS = DATA.OVL** (`fileoff = DS_off + 0x10`).
> No re-deriva lo ya hecho: enlaza. Scout: lote 3.

## 0. TL;DR — hallazgos que cambian el mapa

1. **`0x4552` = intérprete de BYTECODE de animación de tiles/actores — NUEVO consumidor
   de RNG en la ruta de tick.** No es un handler de comando (corrige la hipótesis de
   `coverage-depth §4 #5` / §3 #17). Recorre los 32 registros de actor de `0x5c5a` (8 B/
   reg) y avanza una máquina de estados por-registro guiada por una **tabla de programas
   de 16 B en `DS:0x1b18`** (indexada vía `DS:0x1bc8`). Sus opcodes 5/6 y una rama de
   arranque **rolan `rand_range(0,0xff)` (`0x2092`)** para transiciones probabilísticas
   → **tercer consumidor de RNG en render/tick** tras `0x6936` (lote1) y `0x6bc2`
   (lote2). Ver §1. **Candidato a fila en `deliberate-divergences.md`.**

2. **Los otros 3 "handlers de dispatcher" del lote NO son handlers de comando** — no hay
   mecánica oculta en ninguno:
   - `0x0586` = **crt0 de Borland**: `exit()` + parser de línea de comandos (`_setargv`).
   - `0x0734` = cluster de runtime C: `_setenvp` + **checksum anti-tamper** (§2.3) +
     `ltoa` + shift largo + `sbrk` (`int21 4A`).
   - `0x2726` = **renderer de una línea del panel de party** (nombre/HP/status/marcadores).

3. **Corrección de nombre en el ledger: `0x16ba` NO es `kernel_look_prep` — es `putchar`**
   (emisor de un glifo; ya documentado como tal en `ui-text-layer.md §4`). Todas las
   llamadas del lote (`push <char>; call 0x16ba`) lo confirman. Renombrado. Ver §3.

4. **Corrección a `kernel-sweep-2.md §6`: `0x3aae` NO es "el draw de frames" de
   `render_animated_tile` — es `rand0(n)=rand_range(0,n)`** (ya bien nombrado en el
   ledger como `kernel_rand0`). El bucle de `0x6bc2` que "dibuja frames" en realidad
   **rola** frames con `0x3aae`. Ver §5.

5. **`0x35ec` NO es "Talk exterior"** (hipótesis de `coverage-depth §8bis`). Es el
   **prompt de dirección genérico** (`prompt_direction`): loop de getkey que devuelve un
   delta `(dx,dy)` en `g_cmb_scratch_x/y` y el nombre de la dirección. Ver §4.

6. **`0x223c` = ráfaga de ruido/warble del PC-speaker** (hermana de `pcspeaker_tone_sweep`
   `0x2192`). Usa un **LCG LOCAL de sonido en `[0x545c]`** (`ror3`+`xor 0x9248`) para
   modular la frecuencia — **NO toca el stream de RNG del juego** (`g_rng`/`0x2092`).
   Insumo SFX task #3. Ver §6.

7. **`0x4a84` = tira de cielo sol+lunas** (`render_sky_strip`): compone 12 glifos con el
   `*` del sol por hora y 2 fases de luna desde la **tabla de fases `DS:0x1ed8`** (2 B/día
   = Trammel/Felucca). Sin RNG. Insumo piel fiel + moongates. Ver §7.

---

## 1. `0x4552` — `anim_script_tick` (intérprete de bytecode de animación)  `[0x4552, 0x4702)`  ⚠ RNG en tick

Bucle sobre `[bp-0xe]` = índice de actor 0..0x1f (32). Por actor:
- `reg = 0x5c5a + (idx<<3)` (`[bp-6]`); si `[reg]==0` (slot vacío) → siguiente.
- `[bp-0xa] = [reg+6] & 0xf` (nibble bajo = **contador/timer**); `[bp-0x12] = [reg+6]>>4`
  (nibble alto = **PC del programa de animación**).
- `[bp-2] = [reg+0] & 0xfc` (tile base alineado a 4).
- `idx_scr = ([bp-2]-0x34)>>2`; `[bp-0xc] = DS:[idx_scr + 0x1bc8]` (id de programa);
  `[bp-0x10] = 0x1b18 + ([bp-0xc]<<4)` (**base del programa de 16 B en `DS:0x1b18`**).
- si `[bp-0xa]==0xf` → siguiente. Si `[bp-0xa]!=0` → **decrementa el timer** y reescribe
  `[reg+6]` (espera). Si `[bp-0xa]==0` (timer expirado) → **ejecuta el opcode**:
  - guardas: si `[reg+1]∈{0,0x1d,0x1e}` → siguiente; si `[bp-2]<0x34` o `∈{0xe8,0xb4}` →
    siguiente; si `[bp-2]∈{0x5c,0xa8}` → ejecuta directo; **si no → `rand_range(0,0xff)`;
    sólo continúa si `>=0x80`** (moneda 50% ⇒ el tile parpadea aleatoriamente).
  - lee el opcode `op = DS:[[bp-0x12] + [bp-0x10]]` (byte del programa en el PC). Si
    `op>7` → es un **delay**: `timer = op-0x80`, avanza PC. Si `op∈0..7` → **jump-table
    `cs:[0x46c2]`** (8 entradas):
    - `0` → PC=0 (reinicia el programa).
    - `1..4` → `[reg+1] = tile_base + op - 1` (**muestra el frame op-1**); avanza PC.
    - `5` → `rand_range(0,0xff)`; si `>=0x40` avanza PC, si no reinicia frame `[reg+1]=[reg]`
      y pone `timer=6` (**bifurcación aleatoria 75/25**).
    - `6` → `rand_range(0,0xff)`; si `>=0xc0` avanza PC, si no PC=0 (**bifurcación 75/25**).
    - `7` → PC=2.
  - reescribe `[reg+6] = (PC<<4) | timer`.
- Al terminar los 32: `call 0x44b8` (kernel_fn_44b8, helper de anim) y `call 0x6fd6`.

**Semántica:** es el **animador de tiles/criaturas por bytecode** clásico de U5 (banderas
ondeando, agua, fuentes, antorchas titilando). Cada *tipo* de tile tiene un programa de
16 B en `DS:0x1b18`; cada actor guarda su PC+timer empaquetados en `[reg+6]`. **Consume
RNG del juego** en 3 sitios (guarda de parpadeo 0x4625, opcodes 5/6 en 0x466d/0x469f).
Es el **3.er consumidor de RNG en la ruta de render/tick** — más difuso que `0x6bc2`
(depende de qué tiles animados haya en pantalla y su fase). Fila candidata en
`deliberate-divergences.md`. Caller: `0x5941` (dentro del pipeline de refresco de vista).
Tablas: `DS:0x1bc8` (tile→id de programa), `DS:0x1b18` (programas de 16 B).

---

## 2. Los 3 clusters de runtime C (NO handlers de comando)

### 2.1 `0x0586` — `crt0_exit_and_argv`  `[0x0586, 0x0734)`
Dos rutinas fundidas por el particionador:
- `0586-05a5`: **`exit()`** — `0x55d(0xfc)` (flush/cleanup), llama el vector `[0x52b6]`
  (lista de _atexit_) si no es nulo, `0x55d(0xff)` (terminate).
- `05a6-0733`: **`_setargv`** — parsea la cola de línea de comandos del PSP (`PSP:0x81`),
  con reglas de comillas/backslash idénticas a la CRT de Borland, cuenta args, reserva
  `argv[]` en la pila y copia. Boilerplate; sin lógica de juego.

### 2.2 `0x0734` — `crt0_env_and_libc`  `[0x0734, 0x0878)` (cluster)
- `0734-07a1`: **`_setenvp`** — copia el bloque de entorno (seg en `PSP:0x2c`), saltando
  la entrada que empieza por `';C'` (`0x433b`).
- `07a2-07c3`: **checksum anti-tamper** — XOR de 0x42 bytes desde `DS:0` `^0x55`; si ≠0
  llama `exit(1)` (`0x586`→`0x55d(1)`). (protección de integridad de arranque).
- `07ca-0828`: **`ltoa`/formato de entero** con radix en `cx` (signo, dígitos, reverse,
  ajuste `+0x27` para base>10).
- `0829-0834`: helper de shift largo `dx:ax << cl`.
- `0835-0876`: **`sbrk`/resize de heap** (`int21 AH=4A`, `[0x520e]`=fin de heap,
  `[0x5214]`=brk actual).

### 2.3 `0x2726` — `party_roster_draw_line`  `[0x2726, 0x2884)`  ret 2
Dibuja **una fila del panel de party** (arg `[bp+4]` = slot 0..n):
- `set_cursor(0, slot)` (`0x1bf2`).
- si `slot >= g_party_size` → rellena 0xf espacios y sale (slot vacío).
- marcador de objetivo de combate (`0xfd`) si en combate (`g_location>0x7f`) y el actor
  `g_cmb_actor` (tabla `0xba14`, 8 B/reg, `[+2]&0x80`, `[+3]==slot`) apunta a este slot.
- imprime el **nombre** desde el registro de personaje `0x55a8 + (slot<<5)` (`0x1850`),
  padded a col 9 (longitud vía `0x216c`).
- marcador de personaje activo (`g_active_char`): glifo `0x1a` salvo status `D`/`S`.
- **HP** desde `[rec+0x10]` (`0x55b8`) como número de 4 dígitos justificado (`0x1a3e`).
- **letra de status** desde `[rec+0xb]` (`0x55b3`), con variantes de combate.
**Insumo piel fiel:** layout del panel de party (registro `0x55a8`, stride 0x20: nombre
`+0`, status `+0xb`, HP `+0x10`; glifos marcadores `0xfd/0x1a`).

---

## 3. Primitivas de texto/blit leaf (piel fiel)

- **`0x16ba` = `putchar`** (⚠ el ledger decía `kernel_look_prep` — **incorrecto**).
  Emite un glifo: maneja `\n`(0xa)/`\r`(0xd), lee la ventana en `[0x539a]`, doble ancho
  si `[0x52c8]==3`, seg de fuente `[0x5398]`. Ya derivado en `ui-text-layer.md §4`.
  Renombrado en el ledger a `putchar`.
- **`0x1bf2` = `text_gotoxy`** (`set_cursor`)  `[0x1bf2, 0x1c22)`  ret 4. Fija el cursor
  de texto `(a=[bp+4], b=[bp+6])` sumando el origen de ventana `[0x539a]`, con clamp a
  `0x27×0x18` (39×24). Escribe `[si+4]/[si+5]`.
- **`0x1cca` = `text_set_color`**  `[0x1cca, 0x1cee)`  ret 2. `[bp+4]&0xf` → color de
  primer plano `[0x53aa]` y nibble bajo de `[si+6]` (atributo del cursor).
- **`0x10e0` = `blit_tile`**  `[0x10e0, 0x1112)`  ret 6. Blit de tile/sprite
  `(x=[bp+4], y=[bp+6], id=[bp+8])`: carga la ventana de recorte `[0x52bc..0x52c2]` y
  despacha `lcall [0x5350]` con **selector de vídeo 0x51**. Es un blitter leaf de
  `viewport_compose` (§3 lote2).
- **`0x1112` = `blit_tile_anim`**  `[0x1112, 0x1140)`  ret 6. Igual con `stc` (carry) y
  **selector 0x60** + `g_location` en bl → variante para el tile de **fuego animado
  `0xdc`** (el otro blitter de `viewport_compose`).
- **`0x0f90` = `plot_point`**  `[0x0f90, 0xfae)`  ret 4. Dibuja en la posición
  `[0x52cc]/[0x52ce]` con `clc`, `call 0xb2d` (blit de bajo nivel). Primitiva de píxel/
  cursor de `paint_screen_frame`.

---

## 4. `0x35ec` — `prompt_direction` (input de una dirección)  `[0x35ec, 0x368e)`

`g_cmb_scratch_x/y` (`0x5876`/`0x5878`) = 0. Loop: `0x266c` (getkey_with_redraw) hasta
tecla válida. Traduce:
- `3` → str `0xa2a6`, `y--` (Norte)  · `4` → str `0xa2ae`, `y++` (Sur)
- `1` → str `0xa2b6`, `x--` (Oeste)  · `2` → str `0xa2bc`, `x++` (Este)
- `0x1b`(ESC)/`0x20`(espacio) → str `0xa2a0`, devuelve 0 (cancelar/pasar).
Devuelve 1 (dirección elegida, delta en `g_cmb_scratch_x/y`) o 0 (cancelar). Es el
**"¿en qué dirección?"** genérico (Push/Open/Jimmy/Klimb/etc.). Strings de dirección en
`DS:0xa2a0..0xa2bc`. Caller: `0x33d0`.

---

## 5. `0x3aae` — `rand0` (ya nombrado; corrige `kernel-sweep-2 §6`)

`0x3aae` = `rand_range(0, [bp+4])` (`push 0; push n; call 0x2092`). Ya está bien nombrado
en el ledger (`kernel_rand0`). La nota `kernel-sweep-2 §6` lo llamó "el draw de frames"
de `render_animated_tile`; en realidad ese bucle **rola** el frame con `rand0`, no dibuja.
Sin cambios de ledger; sólo corrección documental.

---

## 6. `0x223c` — `pcspeaker_noise_burst` (ruido/warble)  `[0x223c, 0x22c0)`  ret 6

Hermana de `pcspeaker_tone_sweep` (`0x2192`, lote2). Args `(band=[bp+4], dur=[bp+6],
step=[bp+8])`. Por ciclo:
- gate del speaker on (`in 0x61 | 3; out 0x61`) si `g_unk_a9ce` (sonido on).
- **LCG local de sonido**: `[0x545c] = ((([0x545c]+0x9248) ror 3) ^ 0x9248) + 0x11`.
- mapea el valor a `[0x64, band]` (`div (band-0x64+1); +0x64`) y programa **PIT ch2**
  (`0x34de12 / freq → out 0x42`). Delay software calibrado por `[0x5356]` (de `0x1158`).
- acumula `step` en `[0x5456]` hasta `>= dur`; al terminar, gate off (`and 0xfc`).

**Ruido pseudoaleatorio** dentro de una banda de frecuencia (efecto de estática/daño/
trueno). **El PRNG está en `[0x545c]`, exclusivo del sonido — NO consume `g_rng`.** Cero
impacto en orden-de-rands del juego. Insumo SFX task #3.

---

## 7. `0x4a84` — `render_sky_strip` (tira sol + lunas)  `[0x4a84, 0x4be8)`

Sólo en exterior/pueblo (`g_location < 0x21`). Compone una **tira de 12 glifos** (buffer
local `[bp-0x10]`, inicializado a espacios):
- **sol `*`(0x2a)** en la posición `0x11 - g_hour` (si ∈[0,12)).
- **luna 1** (fase = `DS:[g_day*2 + 0x1ed8]`, `[0x5885]`) en `8 - g_hour` (wrap +24).
- **luna 2** (fase = `DS:[g_day*2 + 0x1ed9]`, `[0x5886]`) en `2 - g_hour` (wrap +24).
- imprime la tira carácter a carácter (`text_set_color 0x1cca` con `g_unk_13ba`/`13b8`
  para el sol, `putchar 0x16ba`). Rama alternativa (gema/underworld: `g_location==0x19`
  o `g_floor>=0x80`) dibuja con `fill_rect`/`line`.

Sin RNG. **Tabla de fases de luna `DS:0x1ed8` (2 B/día = Trammel/Felucca).** Insumo piel
fiel (indicador de cielo) y mecánica de moongates. Caller: `0x5161`.

---

## 8. Bloque 2 del lote — UI de entrada, efectos y detección de hardware

### 8.1 `0x2d7a` — `select_party_member` (picker interactivo)  `[0x2d7a, 0x2e8c)`  ret 2
Loop de selección del "¿con qué personaje?". La lista "Ztats/Ready/Give/etc." es
ILUSTRATIVA del USO del picker, **no** son callers de kernel distintos — grafo de llamadas
real (verificado con `grep 'call 0x2d7a\|call 0x2e8e'` sobre el ASM completo):
- `0x2d7a` ← único `call` desde `0x2e91` (dentro del wrapper `0x2e8e`, que empuja arg 0).
- `0x2e8e` ← exactamente DOS sitios en el kernel: `0x3eac` (vigía del camp) y `0x4a09`
  (dentro de `0x4989`, un picker de más alto nivel que valida estado 'G'/'P' y hace prompt).
- `0x4989` NO tiene `call` cercano → se invoca por far-call desde el dispatch de un overlay
  (CMDS.OVL). Los handlers de Ztats/Ready/Give viven en los overlays y entran al picker por
  esa puerta. ⇒ **no falta ningún caller "Give" en el binario**; el picker es genérico y
  compartido. (Que el comando (G)ive del PORT use bien el picker compartido es cuestión del
  lado-port, no una laguna del ASM.)

Mecánica del loop:
- si en combate resalta el actor activo (`0x2a28`); dibuja cabecera con `0x4e50(str 0x5554)`.
- `0x266c` (getkey): `'1'..'6'` (acotado por `g_party_size`) → selecciona miembro;
  teclas 1/2/3/4 → mueve la selección (`0x3f54`/`0x3f14` prev/next); Enter/espacio/`'0'`
  → confirma; ESC → cancela (`0xffff`). `0x2a28` = resalta/borra el retrato del miembro.
- devuelve el índice elegido en ax. Entrada estándar, sin mecánica oculta.

### 8.2 `0x4e50` — `ui_draw_boxed_string` (cluster: string enmarcado + 2 painters)  `[0x4e50, 0x4f7c)`
- `4e50-4ef8` (ret 2): centra un string `[bp+4]` por su longitud (`0x216c`, centro=0x1e),
  dibuja fondo/bordes (`fill_rect 0xaa6`, `line 0xc9c`) y lo imprime (`0x1850`), con
  `0x4c2a`/`0x4cce` (decoración de caja). Colores `g_unk_13b0/13b2`.
- `4efc` y `4f3c`: dos **painters de bordes/esquinas de caja** leaf (fundidos por el
  particionador) con coords literales (`0xbf/0x38/0x137`). Insumo piel fiel.

### 8.3 `0x3b9e` — `input_number` (campo numérico)  `[0x3b9e, 0x3c98)`  ret 2
Lee un número de teclado (máx `[bp+4]` dígitos, cap 5):
- `0x266c`; dígitos `'0'..'9'` → buffer `[bp-6]` + eco (`putchar`); `+`/`-` como signo
  inicial; backspace (tecla 8/1) → borra (`0x1fa0`); ESC → limpia; Enter → fin.
- convierte con **tabla de valor posicional `DS:0x6a0a`** (potencias de 10): Σ dígito×`[si]`.
  Aplica signo. Devuelve el valor. Es el prompt "¿cuánto?" (cantidad/oro).

### 8.4 `0x3072` — `fx_flash_border` (efecto AV de borde: barrido + beep aleatorio)  `[0x3072, 0x3176)`  ⚠ RNG
Recorre el **perímetro del viewport** (`si` 8→0xb3 en los 4 lados) dibujando barras con
los painters `gfx_bar_sweep_rev/fwd` (`0x71ca`/`0x7200`, sel 0x27) y `0xace`, **y emite un
tono de PC-speaker de pitch aleatorio `rand_range(0x13,0x96)` (`0x2092`) por segmento vía
`pcspeaker_set_tone 0x22e2`** (⚠ **corrección: `0x22e2` es sonido, NO color EGA**). Repite
8 veces (`[bp-6]`). Es un **efecto audiovisual de pantalla completa** (sizzle de hechizo/
moongate/daño). **Consume `g_rng`** (~perímetro×8 tiradas para el pitch) pero es un efecto
discreto disparado por evento con el estado congelado, no un tick por turno. Menor
prioridad de paridad que `0x4552`/`0x6bc2`, pero anótese.

### 8.5 `0x3776` — `find_object_near_party` (scan espacial)  `[0x3776, 0x3868)`  — parcial
Itera 0x1f (31) registros de 8 B desde `DS:0x5d52` (tipo `[+0]`, x `[+2]`=`0x5d54`, y
`[+3]`=`0x5d55`, floor `[+4]`=`0x5d56`) buscando uno del tipo `[bp+4]` a distancia ≤6 de
`g_party_x/y` en el `g_floor` actual. Devuelve índice o `0xffff`. Es el localizador de un
objeto/actor activo cercano al party (tabla de objetos `0x5d52`). Derivación parcial
(aritmética de distancia clara; salidas exactas por confirmar).

### 8.6 `0x38e4` — `find_monster_priority` + `0x3868` `find_monster_by_type_range`  `[0x38e4, 0x39cc)` / `[0x3868, 0x38e4)`
**Corrección: NO es spawn — es SELECCIÓN de un monstruo YA en pantalla** (targeting/turno).
- `0x3868` = itera 0x17 (23) registros de 8 B desde `DS:0x5c62` (tabla de actores en
  pantalla: tipo `[+0]`, x `[+2]`=`0x5c64`, y `[+3]`=`0x5c65`) buscando el primero cuyo
  tipo ∈ `[[bp+8],[bp+6]]`, `!=0xb5`, y (si `[bp+4]` flag) dentro de la ventana 11×11
  (`[+2]-g_party_x+5 ≤0xa` y análogo en y). Devuelve el índice (cx) o 0.
- `0x38e4` llama `0x3868` en **cascada por prioridad** de rangos de tipo:
  `(1,0xf,1)`→`(1,0xff,0x80)`→`(1,0x11,0x10)`→`(1,0x7f,0x30)` y luego sin flag de cercanía,
  parando en el primer acierto. Es el **selector de objetivo/monstruo por clase** (p.ej.
  el "quién actúa / a quién apunta"), no un spawner. Nombres corregidos en el ledger.

### 8.7 `0xde0` — `detect_video_adapter`  `[0xde0, 0xe94)`
Prueba de hardware de vídeo: lee el byte de modelo en `F000:FFFE` (`0xfd/0xff/0xfc`),
escanea la ROM `A000` por firma, `int 10h AH=12/BL=10` (detect EGA), `int 10h AH=0F`
(modo actual), y el puerto de estado `0x3ba` (Hercules). Fija el **código de adaptador en
`[0x52c8]`** (=`g_unk_52c8`, el mismo flag que `putchar` lee para doble ancho ==3) y
`[0x52ca]`. Determina qué `.DRV` de display se usa. Boilerplate de arranque.

---

## 9. Bloque 3 del lote — familia de primitivas de texto/gfx/sonido (leaves)

Primitivas leaf que sostienen todo lo derivado arriba y en los lotes 1-2 (insumo directo
piel fiel / SFX). Todas sin RNG salvo indicación.

- **`0x216c` = `strlen`**  `[0x216c, 0x2192)` ret 2. Cuenta bytes hasta `\0`; deja el
  puntero-fin en `[bp+4]`, longitud en ax.
- **`0x1b94` = `text_select_window`**  `[0x1b94, 0x1bf2)` ret 2. Selecciona 1 de las 4
  window-rects (`0x535e`, stride 8) → `[0x5386]`=idx, `[0x539a]`=ptr; desempaqueta color/
  atributo (`[0x53aa]/[0x53ab]`) y flags (`[0x53a4]/[0x53a6]/[0x53a8]`) del byte +6/+7.
  `0x1b94(0)` resetea a la ventana de texto principal.
- **`0x1c9e` = `text_set_font`**  `[0x1c9e, 0x1cca)` ret 2. `[bp+4]`(0..3) indexa la tabla
  de fuentes `DS:0x539c` → `[0x5398]`=seg de fuente, `[0x5388]`=idx.
- **`0x1fa0` = `text_erase_chars`**  `[0x1fa0, 0x2032)` ret 2. Borra `[bp+4]` caracteres
  hacia atrás: por cada uno espacio (`putchar`) + retroceso de cursor (`0x1cee` get-ROW +
  `text_gotoxy`). Backspace de `input_number`. ★ CORREGIDO (frontera-29, #71): decía «`0x1cee`
  get-col». `0x1cee` lee `[si+5]` y `get_col 0x1f12` lee `[si+4]`; el clamp de `text_gotoxy`
  (0x27=39 columnas contra 0x18=24 filas) fija que `[si+4]` es COLUMNA y `[si+5]` es FILA. Lo
  confirma el consumidor: en `0x2012-0x201a` empuja `[bp-0xa]` (= ancho de ventana) como columna
  y `0x1cee()-1` como fila, que es el wrap del backspace en columna 0. El ledger ya lo tenía
  bien (`text_get_row`); el fallo era de esta línea.
- **`0xc9c` = `draw_hline`**  `[0xc9c, 0xcf2)` ret 6. Horizontal `(x0=[bp+8], y=[bp+6],
  x1=[bp+4])`; recorta contra ventana `[0x52c4]/[0x52d0]/[0x52d2]` y 320px; **selector 0x39**.
  ★ **CORREGIDO EN SITIO (frontera-29, 2026-07-28).** Esta línea decía `(x0=[bp+4],
  x1=[bp+6], y=[bp+8])`, que pone la Y donde va una X. El discriminador es el recortador
  `0x0ccd`: ordena `ax` contra `cx` y compara **los dos** contra `0..0x13f` (319 = X máxima)
  sin tocar `bx` jamás ⇒ `ax=[bp+8]` y `cx=[bp+4]` son los dos extremos de la MISMA X, y
  `bx=[bp+6]` es la Y. Control positivo ajeno al dibujo: el borrado de pantalla completa de
  `0x0d8c`/`0x638a` pushea `(0, 0, 0x13f, 0xc7)` a `gfx_fill_rect`, cada valor exactamente en
  el límite de SU eje. Este error se propagó a la ficha del ledger de `0xc9c` (que lo copió
  mal de otra manera: `x1=[bp+6], y=[bp+4]`) y a la de `0x4e20`, que por él llamaba «banda
  INFERIOR» a lo que es la banda SUPERIOR. Las tres quedan corregidas.
- **`0xcf2` = `draw_vline`**  `[0xcf2, 0xd4c)` ret 6. Vertical `(x=[bp+8], y0=[bp+6],
  y1=[bp+4])`; hace `mov cx, ax` (x1=x0, que es lo que define una vertical) y recorta contra
  `[0x52d4]/[0x52d6]` y 200px (`0xc7`); **selector 0x3c**. La firma ya estaba bien en la ficha
  del ledger; se explicita aquí porque la de al lado no lo estaba.
- **`0xace` = `gfx_line_styled`**  `[0xace, 0xb10)` ret 0xc. Línea genérica 6 args
  `(x0,y0,x1,y1,f1,f2)`, `call 0x8e6` + **selector 0x18**; `f1/f2`(0/1/2) = estilo.
- **`0x71ca` = `gfx_bar_sweep_rev`** `[0x71ca, 0x7200)` / **`0x7200` = `gfx_bar_sweep_fwd`**
  `[0x7200, 0x7234)`, ret 0xa, **selector 0x27**. Barra de 5 args; `0x71ca` niega la
  longitud (sentido inverso). Painters del barrido de `fx_flash_border`.
- **`0x22e2` = `pcspeaker_set_tone`** (+ `0x230e` = `pcspeaker_stop`)  `[0x22e2, 0x2316)`
  ret 2. Si sonido on (`g_unk_a9ce`): programa **PIT ch2** con divisor `0x34de12/[bp+4]`
  (`out 0x42`) y abre el gate (`out 0x61 |3`). `0x230e` cierra el gate (`and 0xfc`).
  Tercera pieza SFX del PC-speaker (con `0x2192` sweep y `0x223c` noise). Insumo task #3.

---

## 10. Bloque 4 del lote — entrada de texto, matcher de keywords, clip y timing

- **`0x3b1c` = `input_string`**  `[0x3b1c, 0x3b9c)`  ret 4. Lee una línea a un buffer
  `(maxlen=[bp+4], buf=[bp+6])`: desactiva el eco de `g_kbd_buffer_on`, loop `0x266c`;
  backspace (8/1) borra (`text_erase_chars`), ESC limpia, imprimible `0x1f<c<0x80` hasta
  maxlen → guarda+eco (`putchar`), Enter termina y NUL-termina. Devuelve longitud. Es la
  entrada de texto (nombre del avatar, "Say" a un NPC).
- **`0x6f1e` = `stristr`** (+ `0x6f90` = `strlen` interno)  `[0x6f1e, 0x6f9e)`  ret 4.
  Búsqueda de subcadena **case-insensitive** de `needle=[bp+6]` en `haystack=[bp+4]`
  (máscara `0x7f`, uppercase `and 0x5f`). Devuelve la posición del match o `0xffff`. Es
  el **matcher de palabras clave de conversación** (TALK: casa la entrada del jugador
  contra las respuestas del NPC).
- **`0x1c22` = `text_set_window_rect`** (+ `0x1c5b` clamp)  `[0x1c22, 0x1c9e)`  ret 0xa.
  Fija el rect de recorte `(l,t,r,b)` de la ventana `idx=[bp+0xc]` (0..3) en `0x535e+idx*8`,
  con clamp a `0..0x27 / 0..0x18` (39×24) y swap si está invertido.
- **`0x1068` = `fx_tile_fizzle_in`**  `[0x1068, 0x10e0)`  ret 6  — parcial. (nombre corregido
  por renombres-59; era `fx_screen_wipe`. El barrido de REGIÓN es `fx_rect_dissolve 0x0f46`.) Bucle de 256
  (`di` 0..0x100) que despacha 2× el **selector de vídeo 0x66** (blit con `stc` y ventana
  `[0x52bc]/[0x52be]`) por iteración; cada 8 pasos hace tick (`0x5910`) o, si
  `g_location==0x42`, poll interrumpible (`0x81ba`). Es una **transición/wipe de pantalla**
  interrumpible. Nombre provisional.
- **`0x20fa` = `delay_via_timer`** (+ ISR fundido en `0x2159`)  `[0x20fa, 0x216c)`  — parcial.
  Instala un handler de **INT 1Ch** (guarda el vector viejo con `int21 AH=35`, pone el
  nuevo con `AH=25` apuntando a `cs:0x2159`) para un **wait/animación cronometrada** por
  tics de timer; `[0x544a]`=modo, `[0x5448]`=contador, gateado por la calibración
  `[0x5356]` (de `0x1158`). Es el idle de bajo nivel (lo llama `poll_key_blink_cursor`).

---

## 11. Bloque 5 del lote — status de actor, entrada, y helpers de runtime

- **`0x6794` = `actor_status_effect_tick`**  `[0x6794, 0x6800)`  ret 2  — toca estado.
  Para el actor de combate `[bp+4]<<3 + 0xba14`, si activo (`[+2]&0x80`) y no `[+2]&0x28`:
  lee el **ANILLO equipado** del personaje `[+3]<<5 + 0x55c5`. Si anillo==`0x2a` (42,
  Ring of Invisibility) → escribe tile `0x1d` en `[+4]<<3 + 0x5c5b` y marca `[+2]|=0x10`
  (invisible); si anillo==`0x2c` (44, Ring of Regeneration) → `call 0x400c`
  (`kernel_ring_regen`). Aplica los PASIVOS del anillo por turno de combate.
  *Corregido 2026-07-28: la lectura original («status», envenenado/dormido) era un
  mislabel — 0x55c5 es el byte de anillo (kernel-sweep-4 §MISLABEL, oráculo 18-07;
  cuerpo releído en #76 2/2: la rama 0x2c llama a ring_regen). Renombrada
  `kernel_actor_ring_effects`.*
- **`0x1e38` = `input_string_raw`**  `[0x1e38, 0x1eac)`  ret 4. Idéntica a `input_string`
  (§10) pero usa **`poll_key_timed 0x1dda`** en vez de `getkey_with_redraw` — variante sin
  el redibujo modal. Mismos args `(maxlen, buf)`.
- **`0x1dda` = `poll_key_timed`**  `[0x1dda, 0x1e38)`  ret 2. Sondea la tecla llamando
  `poll_key_blink_cursor 0x1b38` hasta `[bp+4]` veces; si `[bp+4]>1` fuerza `[0x5356]=0x1f4`
  (override de velocidad de blink) y lo restaura al salir. getch con contador de repetición.
- **`0x4d76` = `strchr_index`** (+ painter fundido `0x4daa`)  `[0x4d76, 0x4dea)`  ret 4.
  Busca el char `[bp+4]` en el string `[bp+6]`, devuelve el índice (o el del `\0`). El
  tramo `0x4daa` es un painter de borde leaf (`fill_rect`+`draw_hline`, coords `0x50/0x51/
  0x56/0x57`, x `0x107`).
- **`0x4dea` = `draw_char_boxed`** (+ painter `0x4e20`)  `[0x4dea, 0x4e50)`  ret 2. Imprime
  un char `[bp+4]` en posición enmarcada (`text_select_window`, `gotoxy(0xa,0x1e)`, deco
  `0x4c2a`/`0x4cce`, `putchar`). `0x4e20` = painter de borde leaf (x `0xc0`).
- **`0x3a0` = `udivmod32`**  `[0x3a0, 0x402)`  ret 8. División larga sin signo de 32 bits
  (dividendo `[bp+4]:[bp+6]`, divisor `[bp+8]:[bp+0xa]`) → cociente dx:ax. Runtime C de
  Borland. Boilerplate.
