# FONT.OVL — motor cinemático compartido (Task 3.12)

Overlay #11, 3744 B (0xEA0), load_seg 0x0e1e. 10 funciones + 9 bytes de ceros;
catálogo completo `re/tools/font_catalog.py` (ledger 100%). Corte acordado
(`.superpowers/sdd/task-3.13-sjog-font-reconciliation.md`): **Task 3.11** = 3 funcs
de la gitana ([0x0998, 0x0E52)); **Task 3.12** = el motor cinemático compartido
([0x0000, 0x0998) + [0x0E52, fin), 7 funcs). El overlay lo comparten INTRO y ENDGAME.

## Funciones del motor (Task 3.12)

| off | nombre | qué hace |
|---|---|---|
| 0x0000 | render_justified_text | render de texto con **justificación completa** — §Justif |
| 0x02a2 | draw_scene_cell | blit de una celda de escena (tile [0x6608+row*32+col], frame [0x6688]) |
| 0x02fc | scene_tick | un frame del animador: marquee (0xbd26/27/28) + 7 fases de tono |
| 0x0418 | load_scene | carga escena idx (tabla [0x515c+idx*2]; copia 0x13 filas a 0x6608) |
| 0x04a4 | font_scene_init | init de escena (g_unk_52be=0x10) |
| 0x0e52 | blit_text_buffer | vuelca el buffer de texto (rep movsw, 0x1800 words) |
| 0x0e7b | glyph_scene_helper | helper de glifo/escena |

## Justificación (render_justified_text @0x0000) — asm-directo

- Ventana de texto = globals g_unk_5146(izq)/514c(der)/5150-5152(banda)/5156(pen X)/
  5158(pen Y). Ancho de línea = der − izq.
- Anchos de glifo proporcionales `[DS 0x50ca + char]`; espacio = `[0x5154]`.
- Control: `'{'` (0x7b) = +0xF de sangría; `'_'` (0x5f) = break suave (ancho 0).
- Break-scan (0x0050–0x00a0): acumula anchos hasta que el siguiente espacio excede
  el ancho, o `\n`/NUL; registra el último espacio como punto de corte.
- Justify (0x0136–0x0167): `remainder = ancho − anchoNatural`; se reparte entre los
  N espacios vía `idiv N` — cada espacio recibe `remainder/N` extra, con el resto
  decreciente (front-loaded). La última línea / `\n` / NUL NO se justifican.
- Emit (0x01d1): por glifo, **en este orden de `push`** — `push [bp+6]` (el handle de
  recurso que el llamador pasó, no se usa para maquetar) · `push char−0x20` ·
  `push penX` · `push penY` · `call 0x2e64`. El destino NO está en FONT (el overlay
  son 0xEA0 B): es kernel por el wrap de carga `+0xe1e0` ⇒ `(0x2e64+0xe1e0) & 0xffff`
  = **`ULTIMA.EXE:0x1044 drv_sel4e_wrapper`**, que es `ret 8` y coloca los cuatro en
  `ax`=handle, `bx`=índice de glifo, `si`=penX, `di`=penY.
  ⚠️ El listado de arriba es el ORDEN DE `PUSH`; en orden de argumento C es el inverso.
- **Dos índices distintos y ninguno declarado**: el GLIFO va por `char − 0x20`
  (0x01dc) y la ANCHURA por el char CRUDO (`[bx+0x50ca]`, 0x01f3). Avance de pluma =
  `anchura + 1`.
- 🔴 **`_` es un GUIÓN BLANDO, no una marca muda.** En emisión (0x01c4) se salta entero:
  ni pinta ni avanza. Pero si la línea ROMPE en un `_`, 0x021a–0x0236 pinta el glifo
  `0xd` (= `0xd+0x20` = `0x2d` = `-`) en la pluma. Segunda vía independiente: la anchura
  que el retroceso suma al elegir ese corte sale del byte ABSOLUTO `[0x50f7]` (0x00a9),
  y `0x50ca + 0x2d = 0x50f7` = la entrada de `-` de la misma tabla.
- 🔴 **El clip NO para el bucle, sólo el dibujo.** `cmp [0x5158],0xc0 / jge` en los DOS
  sitios de emisión (0x01c9 glifo, 0x021f guión) salta la llamada y CAE en el avance de
  pluma. El único corte del bucle exterior es el NUL (0x0281). Un texto largo se sigue
  maquetando invisible por debajo de y=0xc0 hasta el fin de cadena: sin paginar, sin
  truncar, sin esperar tecla.
- 🔴 **La columna se re-elige EN CADA SALTO DE LÍNEA**, no una vez al entrar: 0x0243–
  0x025c repite literalmente la comparación de la cabecera con la pluma YA bajada +9 px,
  y 0x0264–0x0275 re-siembra `[0x5156]` con el margen nuevo y recalcula el ancho de
  línea. Es el mecanismo por el que el texto FLUYE ALREDEDOR DEL ARTE. Asimetría que va
  con ello: la cabecera NO re-siembra `[0x5156]` (guarda el desfase en `[bp−2]`) ⇒ la
  PRIMERA línea arranca donde el llamador dejó la pluma; las demás, en el margen.
- El carácter de corte se SALTA (0x0278 `inc [bp−0xc]`) salvo el NUL, que sale por
  0x0210/0x0218 sin avanzar línea ni pintar guión. Interlineado = 9 px (0x023e).
- Paréntesis de render-target: `push 1; call 0x2a42` en la cabecera (0x000b) y
  `push 0; call 0x2a42` en la cola (0x0294) — `0x2a42+0xe1e0 & 0xffff` = `0x0c22`
  `gfx_select_render_target_sel0f`. Toda la rutina pinta con el SEL 0x0f a 1.
- Cuerpo ENTERO leído (0x0000–0x02a1, 674 B, `ret 4`); el corte cuadra al byte con
  `font_draw_viewport_cell` en 0x02a2. Cita de cierre en `re/ledger/frontier-manual.json`
  (`FONT.OVL:0`, nota `font-luz-cierre-0x0000`).

## Animador de escena (scene_tick @0x02fc) — MEDIUM

Marquee horizontal (0xbd26/0xbd27 rebotan entre bordes, 0xbd28 flip de dirección)
+ ciclo de 7 fases (0x515a) que cambia un tono en las fases 0 y 4 vía 0x40e0; 0x405c
suena un tono fijo si scene id (0xbd29)==2. El mapeo de tonos es data-driven → ⚠️.

## Aportación al clon

El motor de render justificado / animador de escena es de PRESENTACIÓN (pixel-exact
del pergamino/intro). El clon no reproduce el layout pixel-a-pixel; el TEXTO exacto
del endgame lo entrega `quest/endgame.ts` (Task 3.12). Los anchos de glifo (DS 0x50ca)
y el motor quedan documentados; su port pixel-exacto es de Task F/UI.
