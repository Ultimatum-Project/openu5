# `input_string` y el par `draw_box_edge_*` — tres cuerpos del kernel, y dos fichas adjudicadas

Derivación de `ULTIMA.EXE:0x3b1c`, `0x4c2a` y `0x4cce` (130 + 164 + 168 = 462 B). Las tres
citas de cuerpo viven en `re/ledger/frontier-manual.json`, nota
`mainout-cuerpos-3b1c-4c2a-4cce`. Aquí va lo que trasciende a las tres filas.

## 1. `input_string` (0x3b1c) — el tope y el búfer NO son de la rutina

`ret 4` = dos argumentos: **`[bp+4]` = el TOPE**, **`[bp+6]` = el BÚFER**. La cita anterior
llevaba el interrogante literal («hasta el máximo de `[bp+?]`»); queda resuelto.

Lo que sí es de la rutina:

| | |
|---|---|
| salida del bucle | **sólo CR (0x0d)** |
| borrado de 1 | **dos códigos: 8 y 1** |
| ESC (0x1b) | borra la línea entera y **sigue en el bucle** |
| rango aceptado | 0x20..0x7f |
| eco | sólo del carácter ACEPTADO |
| terminador | `buf[di] = 0`, y di puede valer el tope ⇒ **el búfer necesita tope+1 bytes** |
| longitud | **no se devuelve**; `ax` sale con el viejo `g_kbd_buffer_on` |

🔴 **ESC no cancela.** Un port que lo trate como «abortar entrada» añade un camino que el
original no tiene. Es la forma inversa de la trampa de `cmd_xit`: no falta un rechazo,
sobra una salida.

## 2. Ficha #28 adjudicada — y la cota es del SITIO, no de la rutina

La ficha afirmaba, sin haber leído esta rutina, «búfer de entrada `DS 0xBCF8`, tope 15».

**Las dos cifras son CORRECTAS** para el sitio que la ficha tenía en mente —
`TALK.OVL:0x0a37` empuja `0xbcf8` y `0xf`, y el orden cuadra con el cuerpo (último
empujado = `[bp+4]` = el tope). Ahora están DERIVADAS, no heredadas.

🔴 **Pero el otro call-site de TALK usa otros valores**: `TALK.OVL:0x02d2` empuja
`lea ax,[bp-0x10]` (búfer de PILA) y `0xe` (**tope 14**). ⇒ «15» es la cota de la entrada
de PALABRA CLAVE, no de `input_string` ni siquiera de TALK.OVL. Quien porte «el tope de la
entrada de texto es 15» generaliza una cota de un sitio a diez.

**Censo de call-sites: 10, en 7 overlays** — BLCKTHRN 0x0301 · CAST2 0x09c9/0x0a1b · CMDS
0x121e/0x125e/0x1467 · LOOKOBJ 0x0092 · SHOPPES2 0x0543 · TALK 0x02d2/0x0a37. **De los 8
que no abrí no afirmo ni tope ni búfer.**

## 3. 🔴 Tercera instancia de la ficha del grep — y esta vez con el número

`grep 'call 0x3b1c'` sobre `ULTIMA.EXE.asm` da **CERO** con diez llamadores vivos. El cero
es un artefacto de la codificación (cada overlay codifica el near-call con el crudo de SU
banda), no un hecho del binario. La resolución correcta es
`re/tools/callers_por_banda.py`, y su **control positivo obligatorio salió VERDE** (el grep
pierde 3 de 3 en el par de #158) antes de que me creyera ningún resultado.

## 4. El par `draw_box_edge_*` — «espejo byte-a-byte» es FALSO

Las dos son `ret` **pelado** = cero argumentos: todo sale del descriptor de ventana activa
(`0x535e + [0x5386]*8`). La cabeza es idéntica. Lo demás **no**:

| | izquierda 0x4c2a | derecha 0x4cce |
|---|---|---|
| tamaño | 164 B | **168 B** |
| registros salvados | si | **si + di** |
| offsets en X | {0, +5} | **{+2, +7}** |
| glifo (`putchar`) | carácter **2** | carácter **1** |

Los offsets **ni coinciden ni son simétricos respecto a un centro**: es la misma FORMA con
geometría distinta, y el `di` extra existe porque la derecha necesita dos offsets vivos a
la vez. La cita vieja decía «espejo byte-a-byte del anterior» — corregida.

## 5. Ficha #33 confirmada en dos sitios más, con un matiz que la amplía

«En el binario DIBUJAR NO ES SÓLO-LECTURA»: la pareja escribe el estado de color global
(`text_set_fg_color` con el color de chrome `[0x13b2]`, `set_color`, `gfx_set_color_sel2d`)
**y además mueve el cursor de texto**, porque emite su glifo con `putchar` — el mismo
`0x16ba` que usa `input_string` para el eco.

🔴 **Y el «restaura» del final no es un save/restore.** La cola re-asigna `atributo & 0xf`
y `atributo >> 4` (`sar`, con signo), donde `atributo = desc[6]` = **el del DESCRIPTOR**,
no el color que hubiera vivo al entrar. Si el llamador tenía un color distinto del del
descriptor, la rutina **se lo deja cambiado**. Un port que lo modele como «guarda y
restaura» reproduce el caso común y falla justo en el que diverge.

## 6. Lo que NO he medido

- Los cuerpos de `getkey_with_redraw` (0x266c), `text_backspace_n` (0x1fa0) y `putchar`
  (0x16ba) — las tres `verified`, y ninguna afirmación de arriba depende de sus cuerpos.
- **El mapeo x/y de `gfx_draw_line`**: `0xb10` es un envoltorio que coloca los 4 args en
  ax/bx/cx/dx y cae en el despachador `0x0b2d`, que no he abierto. Lo medido son los
  cuatro VALORES empujados y su orden, no cuál es x1 y cuál y1.
- Los 8 call-sites de `input_string` fuera de TALK: censados, no abiertos.
