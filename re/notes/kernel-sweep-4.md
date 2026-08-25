# Kernel sweep — BARRIDO lote 4 · EL CIERRE DEL NIVEL A (task #16)

> Lectura instrucción-a-instrucción del **último** lote de nivel A del kernel
> (`re/coverage-depth.md` §8ter "composición del lote 4"). Convención idéntica a los
> lotes 1-3: offsets `0xNNNN` = offset de imagen del kernel en `re/disasm/ULTIMA.EXE.asm`
> (CS-relativo). `[0xNNNN]` = global **DS = DATA.OVL** (`fileoff = DS_off + 0x10`).
> No re-deriva lo ya hecho: enlaza. Scout: lote 4. **Con este lote el nivel A del kernel
> queda en 0.**
>
> ⚠ **Nota de desensamblado:** casi todas las funciones `55 8bec` de este lote aparecen
> en el `.asm` precedidas por un byte `00` que capstone funde en un `add [di-0x75],dl`
> espurio en la línea `NNNN-1: 00558b`. El prólogo real empieza en el offset del ledger;
> es artefacto de barrido lineal, no código.

## 0. TL;DR — hallazgos que cambian el mapa

1. **`0x51b8 tile_interact` = resolvedor de tile en tiempo de render (auto-tiling), y
   CONSUME `g_rng`.** No es un "dispatcher de interacción" de gameplay (push/open): es el
   paso que, por cada celda del viewport, decide el tile FINAL a estampar según el tile
   base y sus vecinos (x±1) — fusiona bordes de costa/muro/puente y elige la **fase de
   animación** vía el helper `0x51a0`, que hace **`rand_range(0,3)` (`call 0x2092`)**
   salvo congelación (`g_time_spell==0x54`). Es el **6.º consumidor de RNG en la ruta de
   render/tick** tras `0x6936`, `0x6bc2`, `0x4552`, `0x3072`, `0x2f62`. Mismo veredicto
   task #17. Ver §1. **Fila nueva en `deliberate-divergences.md`.**

2. **`0x44b8 advance_tile_anim_frames` = el reloj MAESTRO de animación de terreno, y es
   DETERMINISTA.** Cicla la tabla de remapeo de tiles `DS:0x4ee2` (la que lee
   `viewport_compose`): ciclos de 4 frames (agua `0xd4..d7`, `0xd8..db`, `0xec..ef`) y
   toggles de 2 frames gateados por el contador de fase `[0x6a7e]` (campos de fuerza
   `0x80..83`, `0xfa..fd`). **Sin RNG.** Es la contraparte determinista global del
   bytecode por-actor RNG de `0x4552`. Lo llama `anim_script_tick` (`0x4552`) al final de
   cada tick. Ver §2.

3. **`0x400c kernel_ring_regen` (ya nombrado) consume `g_rng` por turno.** Recorre el
   party; para cada miembro no-muerto con el **ANILLO equipado** `[0x55c5]==0x2c` rola
   **`rand_range(0,7)`** y con resultado `==7` (≈1/8) llama `0x3f14`
   (`kernel_counter_add_i16`, +1 HP en `[0x55b8]`) y marca `g_unk_a9fa=1`. Es un
   **consumidor de RNG de GAMEPLAY por turno**, no de render. **RESUELTO (oráculo
   2026-07-18):** `[0x55c5]` es el byte de **anillo equipado** (`0x2c`=44=Ring of
   Regeneration), NO un "status secundario"; la etiqueta `ring_regen` es correcta (regen
   de HP con el anillo). Tres callers (mundo/combate/camp) cableados en el port. Ver §3.

4. **`0x0402 = memchr`** (scan de byte en buffer). Es el helper que usa el colector de
   emisores `emitter_collect_and_flood` (`0x5e4a`) para probar pertenencia de un tile en
   la tabla de emisores `DS:0x6a9a`, y `tile_predicate_6a86` (`0x5dfe`) contra `0x6a86`.
   Confirma que la comprobación "¿este tile emite luz?" es una búsqueda lineal en tabla.
   Ver §4.

5. **Los 4 parciales de lotes previos quedan CERRADOS** (`0x51b8`, `0x6794`, `0x3776`,
   `0x1068`, `0x20fa`): ninguno esconde mecánica de comando; el único con conducta nueva
   es `tile_interact` (punto 1). Ver §1 y §5.

6. **El grueso del lote es plumbing puro:** ~20 wrappers de una línea sobre el driver de
   vídeo `lcall [0x5350]` (cada uno fija un selector y llama), la familia de C-runtime de
   enteros largos de Borland (`lmul/ldiv/lshl/ltoa`), I/O de fichero DOS y predicados de
   coordenada del viewport. Cero mecánica oculta. Ver §6-§8.

---

## 1. `0x51b8` — `tile_interact` (resolvedor de tile de render + auto-tiling)  `[0x51b8, 0x5394)`  ret 0xa  ⚠ RNG

**CIERRE del parcial de lote 2.** Args: `(tile=[bp+4], x=[bp+6], y=[bp+8], row=[bp+0xa],
colbase=[bp+0xc])`. `0x4402` = `kernel_map_tile_ptr` (puntero al byte de tile del mapa en
(x,y)).

**Clasificación de entrada** (`0x51be`): decide si el tile-objeto `[bp+4]` recibe
resolución contextual (cae a `0x51e9`) o **estampado directo** (`jmp 0x5370`):
- `==0x1c`, `0x12..0x15`, `>=0x40`, `0x28..0x2b` → resolución especial.
- resto (`<0x12`, `0x16..0x27`, `0x2c..0x3f`) → estampado directo.

**Rama de estampado directo** (`0x5370`): escribe `[bp+4]` en la rejilla visible
`[colbase + row*16 - 0x539c]` y limpia el overlay `[colbase + row*32 - 0x54fe]=0`.

**Rama especial** (`0x51e9`): fetch del tile base bajo el objeto (`0x4402(x,y)` → `[bp-2]`)
y **switch grande sobre ese tile base**:
- `0xec`/`0x0a` → return sin cambio.
- `0x57` → estampa `0x38` en el overlay.
- `0x6a`/`0x6b` → según nibbles de `[bp+4]`, return o directo.
- `[bp+4]>=0x80` → estampado directo.
- **auto-tiling de bordes** (agua/costa/muro): para tiles base `0x84`/`0x85`/`0x90`/`0x92`
  /`0x93`/`0x9d`/`0x9e`/`0xab`/`0xc8`/`0xc9` mira los **vecinos a y±1** (`0x4402(x, y±1)`) y
  elige el tile de conexión final (`+0x60`/`+0x64`/`+0x34`/`+0x38`/`+0x3c`/`+0x30`, o un
  valor fijo `0x17`/`0x18`/`0x1a`/`0x30`/`0x32`), **sumando la fase de animación de
  `0x51a0`**.

  > 🔴 **ERRATA CORREGIDA (cola-mundo, 2026-08-07).** Esta línea decía «vecinos a **x±1**»
  > y son **y±1 — VERTICALES**. El eje se resuelve abriendo `get_tile_ptr 0x4402`: su
  > `[bp+4]` es el que lleva `shl 5` y se resta contra `g_chunk_origin_y`, y su `[bp+6]`
  > contra `g_chunk_origin_x` ⇒ `0x4402([bp+4]=y, [bp+6]=x)`. Los call-sites de `0x51b8`
  > hacen `push [bp+8]; push [bp+6]`, así que el ÚLTIMO empujado (`[bp+6]` del llamador)
  > cae en el `[bp+4]` del callee = **y**. Segundo testigo, de otra naturaleza: la
  > escritura retroactiva de `0x534e` mete `0x9e` en la **fila−1** del overlay, geometría
  > que sólo cierra si la sonda es vertical. La misma errata estaba en la cita del ledger
  > de la fila y se corrigió allí a la vez.
  > También se ajusta la lista de tiles base: `0x9a`/`0x9b`/`0x9c` aparecen SÓLO como
  > valores de VECINO comparados, nunca como caso del switch — el «`0x9a..0x9e`» de antes
  > mezclaba las dos poblaciones.

**⚠ El consumidor de RNG — `0x51a0`** `[0x51a0, 0x51b8)` (helper leaf, no es entrada de
ledger propia; vive en la cola de la función previa):
```
0x51a0: if (g_time_spell == 0x54) return 0;      ; congelado (gema/hechizo)
        else return rand_range(0, 3);            ; push 0; push 3; call 0x2092
```
→ **`tile_interact` rola `g_rng` una vez por cada tile animado de borde que resuelve** en
la composición del viewport. Es difuso (depende de cuántos tiles de costa/agua animada hay
en pantalla). **6.º consumidor de RNG en render.** Caller: `0x55fe` (dentro de
`paint_world_layer_A`, el painter de la capa de mundo). **Fila nueva en divergences.**

**Semántica final:** NO es "interacción de gameplay". Es el **auto-tiler + selector de
fase** de la capa de mundo — insumo directo de la piel fiel (define cómo conectan visualmente
costas/muros/puentes y su titileo), y una fuente de desalineación de rand-stream si el clon
lo portara ingenuamente.

---

## 2. `0x44b8` — `advance_tile_anim_frames` (reloj maestro de animación de terreno)  `[0x44b8, 0x4552)`  DETERMINISTA

Muta la **tabla de remapeo de tiles `DS:0x4ee2`** (la que indexa `viewport_compose` como
`[tile-0x4ee2]`), avanzando varios ciclos de frame:
- tiles `0xd4..0xd7`: `inc`, wrap `0xd8→0xd4` (ciclo 4-frame; agua).
- tiles `0xd8..0xdb`: `inc`, wrap `0xdc→0xd8` (ciclo 4-frame).
- **si `[0x6a7e]&1`**: tiles `0x80..0x83`: `xor bit0` (toggle 2-frame; campo de fuerza).
- tiles `0xec..0xef`: `inc`, wrap `0xf0→0xec` (ciclo 4-frame).
- **si `[0x6a7e]&2`**: tiles `0xfa..0xfd`: `xor bit0` (toggle 2-frame).
- `inc [0x6a7e]` (contador de fase global; sus bits bajos gatean los toggles).

**Sin RNG.** Confirma que la animación GLOBAL de terreno es un reloj de contadores
determinista (por tabla), y que el RNG sólo entra en (a) el bytecode por-actor `0x4552` y
(b) la selección de fase de borde `0x51a0` (§1). Caller: `anim_script_tick` (`0x4552`) lo
llama al terminar sus 32 actores.

---

## 3. `0x400c` — `kernel_ring_regen` (RESUELTO 2026-07-18: es regen de HP por Anillo)

**Ya nombrado en el ledger**; lo leí porque el mandato lo listó ("usado por status
effect y emitter-scan") y `0x6794` lo llama. `[0x400c, 0x4080)`. Recorre `g_party_size`
miembros (status primario `si=0x55b3`, **byte de ANILLO equipado** `di=0x55c5`, stride
`0x20`):
- si status primario `[si]=='D'`(0x44, muerto) → cuenta pero no actúa (la guarda es
  `cmp [si],0x44; je`, luego `cmp [di],0x2c; jne` → salta).
- si `[di]==0x2c` → **`rand_range(0,7)`**; si `==7` (≈1/8) → llama
  `0x3f14 (kernel_counter_add_i16)` con el registro de personaje (`[bp-8]=0x55b8`,
  ptr en `[bp-0xa]=0x55ba`) y marca `g_unk_a9fa=1`.

**MISLABEL CORREGIDO** (oráculo 2026-07-18): `[0x55c5]` NO es un "status secundario" —
es el **byte del ANILLO EQUIPADO** del miembro, y `0x2c` = **44 = Ring of Regeneration**
(mismo id que `Equipment.RingRegeneration`; en el `.gam` el anillo vive en `char_rec+0x1d`).
`0x3f14` escribe `[0x55b8]` = **HP del personaje** (+1, cap maxHp). ⇒ la etiqueta
`ring_regen` es CORRECTA: **con el Anillo de Regeneración equipado, 1/8 por invocación
regenera +1 HP**. El clon ya lo portaba bien (`game/src/core/world/survival.ts`
`ringRegenSweep`, `RING_OF_REGENERATION=44`). Es un consumidor de `g_rng` de GAMEPLAY
con TRES callers (mundo `0x2bca`, combate `0x6794→0x67f6`, camp `0x0207`) → los tres
cableados en `survival.ts`/`game.ts`/`combat/combat.ts`.

**RING 42 = Anillo de Invisibilidad (RESUELTO + implementado 2026-07-18):** el MISMO
`0x6794` (status-pass de combate, bucle `0x6b52` sobre `g_party_size`) comprueba ANTES
otro anillo — `0x67bf: cmp [charIdx*0x20+0x55c5],0x2a` → con **`0x2a`=42 (Ring of
Invisibility)**:
- `or [combatant+2],0x10` = **flag de INVISIBILIDAD** — el MISMO bit `0x10` que pone el
  hechizo Sanct Lor (`invisibilitySelf`) y que **limpia Wis Quas** (`0x074c`) y **respeta
  el targeting enemigo** (`0x1867`: los enemigos NO-Shadowlord saltan a los invisibles).
- `[charIdx*0x08+0x5c5b]=0x1d` = el **tile de RENDER** del actor (array `0x5c5b` stride 8,
  la misma que `0x6800` lee para pintar; `0x1d` = sprite del invisible) — Clase C de
  RENDER, ya cubierto por la capa de piel del port (`combatant.invisible`).
Es PASIVO y por-pase → invisible durante todo el combate. **Cobertura del port ANTES:
`RING_INVIS=0x2a` estaba DEFINIDO en `equip.ts` pero SIN cablear → el anillo no hacía
nada** (hueco gemelo del ring 44). **Cableado ahora**: `combat/combat.ts` `placePlayers`
fija `invisible: record.ring===RING_INVIS` al montar la arena (cubre el 1er turno; el
mecanismo de invisibilidad ya existía por Sanct Lor). Sellos: 0 portadores del ring 42 en
los 14 `.gam` → 0 impacto. Sin RNG (la invisibilidad no tira dados).

---

## 4. Cierre de parciales restantes (sin mecánica oculta)

- **`0x6794 kernel_actor_ring_effects`** `[0x6794, 0x6800)` ret 2 — **CERRADO.** Actor de
  combate `0xba14+(idx<<3)`; si activo (`[+2]&0x80`) y no `[+2]&0x28`: **anillo equipado**
  del personaje en `0x55c5+([+3]<<5)`. `0x2a` (42, Invisibility) → tile `0x1d` en
  `0x5c5b+([+4]<<3)` + `[+2]|=0x10`; `0x2c` (44, Regeneration) → `call 0x400c(idx)`
  (`kernel_ring_regen`, §3). Aplica los pasivos del anillo por turno.
  *Corregido 2026-07-28: este bullet arrastraba la lectura vieja («status»,
  envenenado/dormido) que la §MISLABEL de ESTE MISMO fichero ya había retirado — la nota
  se contradecía a sí misma. Adjudicado por cuerpo en #76 2/2.*
- **`0x3776 find_object_near_party`** `[0x3776, 0x3868)` — **CERRADO.** Escanea 32 registros
  de 8 B desde `DS:0x5d52` (tipo `+0`, x `+2`=`0x5d54`, y `+3`=`0x5d55`, floor `+4`=`0x5d56`)
  buscando tipo `[bp+4]` con `|dx|<6 && |dy|<6` en el `g_floor` actual (distancias por `abs`
  vía `not/inc`). Devuelve el índice de slot (0..31) o `0xffff`. Delta en `[bp-2]/[bp-4]`.
- **`0x1068 fx_tile_fizzle_in`** `[0x1068, 0x10e0)` ret 6 — **CERRADO.** (nombre corregido por
  renombres-59; era `fx_screen_wipe`.) Bucle `di` 0..0x100:
  despacha 2× el selector de vídeo `0x66` (blit con `stc`, ventana `[0x52bc]/[0x52be]`);
  cada 8 pasos tick (`0x5910`) o, si `g_location==0x42`, poll interrumpible (`0x81ba(1)`,
  aborta si devuelve ≠0). Revelado LFSR de UN tile, interrumpible. NO es un wipe de pantalla:
  el barrido de una REGIÓN es la rama `clc` del mismo selector, y su único llamador es
  `fx_rect_dissolve 0x0f46` (frontera-29, #71). ★ Y OJO A LA CUENTA: los ticks de `0x5910` son
  **31**, no 32 — `di` va de 2 en 2 y la salida `cmp di,0x100` se evalúa ANTES del `test di,7`.
- **`0x20fa delay_via_timer`** `[0x20fa, 0x216c)` — **CERRADO.** Instala ISR **INT 1Ch** en
  `cs:0x2159` (que hace `inc [0x5448]` en DS=0xf64) vía `int21 35/25`, busy-waita hasta
  `[0x5448] >= [0x544a]=[bp+4]` tics, restaura el vector viejo. Salta el wait si `[bp+4]==1`
  y la calibración `[0x5356]<=0xf0` (máquina lenta). Wait cronometrado (~`N`/18.2 s).
- **`0x402 memchr`** `[0x0402, 0x0426)` — scan de byte: `(buf=[bp+4], byte=[bp+6],
  count=[bp+8])` → puntero al 1.er match o `NULL` (`repne scasb`). Usado por
  `emitter_collect_and_flood` sobre `DS:0x6a9a` y por `tile_predicate_6a86` (§7) sobre
  `0x6a86`. **La prueba de "tile emisor de luz" es una búsqueda lineal en tabla.**

---

## 5. Cluster de estado/combate `0x4xxx` (placeholders)

- **`0x4368 pcspeaker_sfx_warble`** `[0x4368, 0x43ae)` — SFX enlatado: 3× `pcspeaker_tone_sweep`
  (`0x2192`, band `0x2a30`, cnt `0x12c`, step 6) + 1× (band `0x5460`, step 3). Efecto de
  sonido fijo (alarma/warble). Insumo task #3. Sin RNG (el barrido `0x2192` es determinista).
- **`0x44b8 advance_tile_anim_frames`** — §2.
- **`0x4be8 draw_framed_panel`** `[0x4be8, 0x4c2a)` — CUERPO ENTERO LEIDO 0x4be8-0x4c28
  (`ret` en 0x4c28, `nop` de relleno, siguiente prólogo en 0x4c2a = start+66 EXACTO).
  **SALVA la ventana actual** (`ax = [0x5386]` → `[bp-2]`), selecciona la ventana 0
  (`0x1b94(0)`), y si NO gema/underworld (`g_location!=0x19 && g_floor<0x80`):
  `gotoxy(col=5, fila=0)`, `draw_box_edge_left` (`0x4c2a`), imprime glifo `DS:0xa3e2`,
  `draw_box_edge_right` (`0x4cce`); **y en los DOS caminos RESTAURA la ventana salvada**
  (`0x4c1f push [bp-2]; call 0x1b94`). Chrome de la piel fiel.

  > 🔴 **DOS ARREGLOS (cola-mundo, 2026-08-07), leídos del cuerpo:**
  > 1. **`gotoxy(0,5)` estaba INVERTIDO.** El sitio empuja `5` y luego `0`, y en
  >    `0x1bf2` el `[bp+4]` (último empujado) va a `[si+4]` y el `[bp+6]` a `[si+5]`.
  >    Qué campo es cuál lo fija `putchar`: el manejador de **LF** hace `inc [si+5]`
  >    (0x1742) y el de **CR** hace `[si+4]=0` (0x1745) ⇒ **+5 = FILA, +4 = COLUMNA**;
  >    lo corrobora la comprobación de cotas de `0x1bf2` (col vs 0x27=39, fila vs
  >    0x18=24, o sea 40×25). Luego la llamada es **`gotoxy(columna=5, fila=0)`**.
  > 2. **Faltaba el salvar/restaurar de la ventana**, que es lo que hace que la rutina
  >    NO tenga efecto lateral sobre el estado de ventana del llamador. Un port que
  >    seleccione la 0 y no restaure deja la ventana cambiada al salir.
  >
  > ⚠️ Lo que SÍ estaba bien y no se toca: el gate `g_location!=0x19 && g_floor<0x80`
  > (bytes `80 3e 93 58 19` y `80 3e 95 58 80`) y el rango de la fila.
- **`0x4c2a draw_box_edge_left`** `[0x4c2a, 0x4cce)` — pinta la decoración de borde IZQUIERDO
  de una caja de ventana: rect de ventana `0x535e+winidx*8` → coords píxel (`col*8`,`row*8`),
  color `g_unk_13b2`, glifo `putchar(2)` (`0x16ba`) + 2 líneas (`0xb10`). Insumo piel fiel.
- **`0x4cce draw_box_edge_right`** `[0x4cce, 0x4d76)` — espejo del anterior para el borde
  DERECHO (glifo `putchar(1)`, offsets `+2/+7`).

Todos sin RNG.

---

## 6. Familia de wrappers del driver de vídeo `lcall [0x5350]` (una línea c/u)

Cada uno fija `g_snd_driver_fn` (= `[0x5350]`, el **driver de VÍDEO**) a un selector y hace
`lcall`. Insumo plumbing de la piel fiel; ninguno con RNG ni lógica de juego.

| off | nombre | args | selector | qué hace |
|---|---|---|---|---|
| `0x0b86` | `gfx_rect_sel3f` | 4 | 0x3f | `call 0x8e6` + blit/rect |
| `0x0bfc` | `gfx_blit_sel63` | 5 | 0x63 | blit 5-param |
| `0x0c22` | `gfx_cmd_sel0f` | 1 | 0x0f | cmd 1-arg |
| `0x0c3c` | `gfx_set_clip_rect2` | 4 | — | fija clip `[0x52d0..0x52d6]` (2.º rect) |
| `0x0c64` | `gfx_moveto` | 2 | 0x30 | pen pos `[0x52cc]/[0x52ce]` + clip `0x8ca` |
| `0x0d4c` | `gfx_cmd_sel4b` | 5 | 0x4b | cmd 5-arg |
| `0x0f2a` | `gfx_query_sel6` | 0 | 0x06 | query → `[0x5354]` |
| `0x0f46` | `gfx_blit_sel66` | 4 | 0x66 | blit `clc` (base del wipe) |
| `0x0f6e` | `gfx_cmd_sel1b` | 2 | 0x1b | cmd condicional (si a≠b) |
| `0x102e` | `gfx_cmd_sel5a` | 0 | 0x5a | cmd sin args |
| `0x1044` | `gfx_blit_sel4e` | 4 | 0x4e | blit 4-param (drawer de fila centrada) |
| `0x1140` | `gfx_cmd_sel6f` | 0 | 0x6f | pasa timing `[0x5356]` |
| `0x6f9e` | `gfx_cmd_sel6c_p3` | 1 | 0x6c | cmd `[bp+4]+3` |
| `0x6fbc` | `gfx_cmd_sel6c` | 1 | 0x6c | cmd 1-arg |
| `0x6fd6` | `gfx_cmd_sel60_font` | 0 | 0x60 | pasa ptr de fuente `[0x539c]`, `clc` |

**Wrappers con lookup de recurso** (`0x125d` = find en tabla; en fallo disparan el hook far
`[0x5394]`): `0x0bae` `gfx_query_sel42` (sel 0x42), `0x0fae` `resource_lookup_0fae` (ret
handle), `0x0ff4` `resource_op_sel48` (sel 0x48).

---

## 7. Predicados de coordenada/tile y gráficos derivados (placeholders)

- **`0x3f6e test_tile_property`** `[0x3f6e, 0x3fb4)` ret 4 — lee el overlay `[colbase+row*32
  -0x54fe]` y **prueba un bit** del tile en el bitmap de 32 B `DS:0x6a14` (`mask 0x80>>(v&7)`,
  byte `v>>3`). Devuelve 1/0. Propiedad por-tile (bloqueo/borde). Sin RNG.
- **`0x3fb4 screen_to_viewport_cell`** `[0x3fb4, 0x400c)` ret 4 — pixel (a,b)∈[8,0xb7] →
  celda `(b-8)/16, (a-8)/16` en `g_cmb_scratch_x/y`; `-1` si fuera. Targeting/ratón.
- **`0x6d82 cell_in_viewport`** `[0x6d82, 0x6da8)` ret 4 — 1 si `0<=a<=10 && 0<=b<=10`
  (celda dentro del viewport 11×11), si no 0.
- **`0x5dfe tile_predicate_6a86`** `[0x5dfe, 0x5e4a)` ret 4 — para 5 tiles especiales
  (`0x4a/0x4b/0xba/0xbb/0x98`, puertas/rejas) devuelve `[bp+4]==1`; para el resto,
  **membership** del tile `[bp+6]` en la tabla de 19 `DS:0x6a86` vía `memchr` (`0x402`).
  Predicado de paso/propiedad de tile.
- **`0x39cc set_map_tile`** `[0x39cc, 0x39fc)` ret 6 — si outdoor (`0<g_location<0x21`) y
  `tile!=0`: escribe `tile` en `kernel_map_tile_ptr(x,y)`. Setter de celda de mapa.
- **`0x3a74 set_actor_record`** `[0x3a74, 0x3aae)` ret 0xe — vuelca 6 bytes (`[bp+0x10..
  bp+6]`) en el registro de actor `0x5c5a+(idx<<3)` (+0=tile,+1=tile2,+2=x,+3=y,+4,+5).
- **`0x2fa6 party_set_poisoned`** `[0x2fa6, 0x2fd0)` ret 2 — si slot `<g_party_size` y status
  `[0x55b3+slot*32]!='D'`: pone `'P'`(0x50, envenenado) + `status_redraw` (`0x2900`).
- **`0x3522 fx_impact_at_cell`** `[0x3522, 0x3564)` ret 4 — en outdoor convierte (x,y) a
  viewport-relativo (−party+5), `blit_tile(x,y,0)` (`0x10e0`), ruido (`0x223c` band 0xa) +
  `refresh_view` (`0x5910`). Efecto de impacto/golpe en una casilla.

---

## 8. Plumbing puro: C-runtime, texto, DOS I/O (placeholders)

**C-runtime de enteros largos (Borland) y stdio de arranque** — boilerplate:
- `0x02f4 crt0_cexit` (flush de buffers de stream `0xa9bc`/`0x6ada` vía `0x37d`, cae en exit).
- `0x030b exit_process` (`_exit`: flush stream `0x6ada`, cierra handles abiertos de la tabla
  `0x528e`, `int21 4C` con el código `[bp+4]`).
- `0x0426 ltoa_entry` (long→ASCII con radix; salta al `ltoa` compartido en `0x7d6`).
- `0x0442 lmul32` (multiplicación larga 32-bit).
- `0x0476 lshl_assign` (`*ptr <<= n` sobre un long lvalue vía `0x82a`).
- `0x0496 ldiv32` (división larga con signo; maneja signos y el lazo shift/div).
- `0x0532 lookup_message_string` (busca id `[bp+4]` en la tabla `{id,str}` `DS:0xa452`).
- `0x055d write_message_stderr` (imprime el string del id `[bp+4]` a stderr, `int21 40` bx=2).
- `0x0be4`/`0x0fdc `dos_free_seg` (`int21 49` sobre el segmento `[bp+4]`).

**Detección/config de vídeo de arranque:**
- `0x0e94 select_video_params` — resuelve `g_unk_52c8` (código de adaptador) desde los flags
  de override de argv (`[0x52ba]`C / `[0x52ef]`E / `[0x52f3]`? / `[0x52f1]`T) y configura los
  parámetros de driver. (`0xde0 detect_video_adapter` es su fuente, ya en lote3.)
- `0x0d72 draw_centered_7rows` — limpia pantalla (fill 0..319×0..199) y dibuja 7 strings
  centrados horizontalmente (tablas de ancho `DS:0x5306` / ptr `DS:0x5314`) vía `gfx_blit_sel4e`.

**Teclado / drive / fichero DOS:**
- `0x1b16 flush_kbd_buffer` (resetea la cola BIOS `0040:001A`/`001C` a 0x1E vía `0x1b24`).
- `0x16a6 dos_get_drive_letter` (`int21 19` → `'A'+n`).
- `0x1674 probe_file_openable` (abre `int21 3D` y cierra `3E`: test de existencia; en fallo
  hook far).
- `0x7234 file_read_seek` (open `[bp+0xa]`, seek `[bp+4]` `int21 42`, read `[bp+6]` B a
  `[bp+8]` `3F`, close; en fallo hook far). I/O de recurso/overlay.
- `0x7296 file_write_create` (create `[bp+8]` `int21 3C`, write `[bp+4]` B de `[bp+6]` `40`,
  close). I/O de guardado.

**Capa de texto (insumo piel fiel, tasks #18/#19):**
- `0x1cee text_get_row` (byte `[ventana+5]`) · `0x1f12 text_get_col` (byte `[ventana+4]`).

  > 🔴 **ERRATA CORREGIDA (cola-mundo, 2026-08-07): los NOMBRES estaban CRUZADOS.** Los
  > offsets siempre fueron correctos —`0x1cee` lee `[si+5]` y `0x1f12` lee `[si+4]`, con
  > `si = [0x539a]`— pero la etiqueta de cada uno era la del otro. Qué campo es fila y
  > cuál columna lo discrimina `putchar` sin ambigüedad: **LF** (`0x0a`) hace
  > `inc [si+5]` en 0x1742 y **CR** (`0x0d`) hace `[si+4]=0` en 0x1745 ⇒ **+5 = FILA,
  > +4 = COLUMNA**. Segundo testigo independiente: `0x1bf2` acota `[si+4]+[si+0]` contra
  > 0x27 (39) y `[si+5]+[si+1]` contra 0x18 (24), que es una pantalla de 40×25.
  > Es la MISMA clase que la errata de `gotoxy` de §5: dos etiquetas intercambiadas sobre
  > offsets correctos — ningún control numérico las caza, porque los números cuadran.
- `0x1f26 text_set_bg_attr` (nibble de color de fondo `[0x53ab]` + byte de ventana `+6`).
- `0x1f4e text_scroll_region` (scroll de la ventana `[bp+4]` filas; sel 0x27; `0x1f77`
  desempaqueta el rect de ventana a píxeles `<<3 +7`).
- `0x1d02 load_font_slot` (aloja un banco de fuente/gfx en el slot `[bp+4]` de la tabla de
  segmentos de fuente `DS:0x539c`, vía `0x1654`/`0x15c6`/`0x160e`; en fallo hook far).

**Sonido / delays / stub:**
- `0x22c0 pcspeaker_beep` (tono `[bp+6]` + delay `[bp+4]` + stop; SFX task #3).
- `0x20c8 delay_calibrated` (busy-wait; `[0x5356]` desplazado por la clase de velocidad
  `[bp+6]`→tabla `0x5426`, `[bp+4]` iteraciones). Delay por-paso de `anim_step_dda`.
- `0x2316 noop_stub` (`push bp; mov bp,sp; sub sp,6; mov sp,bp; pop bp; ret` — función vacía).

---

## 9. Cierre del mandato — qué queda del BARRIDO TOTAL (task #16)

**Nivel A del kernel = 0.** Los 4 lotes vaciaron las 130 `kernel_fn_*` iniciales
(15+17+41+57). Lo que resta del mandato "100% derivado" **no está en el kernel**:

1. **`INTRO.OVL` (task #13)** — el único overlay con B *genuino* grande sin derivar
   (intro/título/gitana, ~131 KB de overlay pero pocas funciones B). Es render/escena, no
   reglas. **La pieza mayor pendiente.**
   <!-- [PROSA-AUTOFIEL t4 (2026-07-27): REFUTADA POR UNA NOTA POSTERIOR, y nunca anotada
   aquí. `re/notes/intro-ovl-map.md:74-80` (25-07, siete días después de esta) dice
   literalmente: «INTRO.OVL NO era el "único gap grande": ya estaba disasm+catalogado; el
   gap grande de código sin tocar son los .DRV, y son de bajo valor». O sea que ni «el
   único» ni «la pieza mayor pendiente» siguen siendo ciertos. El hueco vivo son los 4
   `*.DRV` (~36 KB), que asm-frontier-plan.md §F1 ya clasifica como bajo valor porque el
   port no reimplementa hardware de vídeo. Texto histórico conservado. -->
2. **B genuinos de render de overlay** (§2 de coverage-depth): `LOOKOBJ` (gem/peer),
   `DNGLOOK` (raster 3D de mazmorra), `TOWN` (colocación de NPC), `npc_build_vismap`
   (`NPC.OVL`, posible LOS). Prioridad media, todos render/UI.
3. **Verificación censo vs. directorio del juego** — cruzar las 629 funciones del ledger
   contra un inventario de los binarios reales (¿toda función invocada por overlay resuelve
   a una entrada del censo? el spike #15 ya cerró el falso "2.º segmento"; falta el chequeo
   simétrico de que no hay entradas de overlay sin cuerpo derivado).
4. **`los_flood_fill` (`0x5a28`) — lectura interna dedicada** sigue pendiente (su semántica
   gruesa está en E1-S2 PASS, pero el algoritmo interno instrucción-a-instrucción no se ha
   derivado en ningún lote; queda como el único C "por subsistema, no por cuerpo" del kernel).

**Consumidores de RNG — censo actualizado tras el lote 4** (para task #17 / #20):
- *Render/tick (el clon los OMITE, veredicto Clase 3):* `0x6936` (flash status), `0x6bc2`
  (frame de tile animado), `0x4552` (bytecode de anim), `0x3072` (beep del flash),
  `0x2f62` (randomizer de sprite), **`0x51b8`/`0x51a0` (fase de auto-tiling) — NUEVO**.
- *Gameplay/turno (el clon SÍ los necesita para paridad):* `0x400c` `kernel_ring_regen`
  (`rand(0,7)` por miembro afligido) — **verificar semántica y etiqueta** (§3).
