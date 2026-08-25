# #97 (T15) — El verbo de §A8.1: «limpia» NO se sostiene, y lo probable es lo CONTRARIO

Fecha: 2026-07-30. Estado: **el ticket se responde**, con un veredicto más fuerte que el que
pedía — y con el experimento decisivo nombrado, no ejecutado.

## 1. Lo que preguntaba

§A13.1 acotó §A8.1: los 14 call-sites que comparten la tupla del viewport quedan FIEL **en
geometría**, pero «limpia» supone **modo de copia**, y el modo lo fija aparte el conmutador
del kernel `0x0C22`. Nadie había trazado el modo en esos 14.

## 2. Censo del conmutador: 51 sitios, y el patrón es un PAR

`near_calls_to_kernel` sobre los 24 overlays + lectura directa del kernel:
**45 de overlay + 6 del kernel = 51**. El argumento entra por `ax`, y los inmediatos son
**1** (copia) y **0** (XOR) — con 5 de `0xFF` y 1 de `0xC7` sueltos en INTRO/FONT.

Lo que se ve al agrupar por rutina es que **van en pares**: se pone un modo, se dibuja, se
pone el otro. Ejemplos verbatim del censo (offset y rutina en celdas separadas):

| overlay | rutina | sitios |
|---|---|---|
| BLCKTHRN | `party_refuge` | `0966`=1 `097f`=0 `0bc8`=1 `0bed`=0 |
| DNGLOOK | `load_wall_variant_gfx` | `1115`=1 `1128`=0 |
| DUNGEON | `dng_render_corridor` | `1aa1`=1 `1bce`=0 |
| LOOKOBJ | `gem_view_32x32` | `111c`=1 `117e`=0 |
| kernel | `screen_shake_fx` | `3088`=1 `316b`=0 |
| kernel | `draw_7_centered_rows` | `0d83`=1 `0dd2`=0 |
| kernel | `blink` | `23ce`=**0** `24ef`=**1** ← ★ AL REVÉS |

## 3. ★ Ninguna de las 14 rutinas que «limpian» toca el modo

Cruzados los 14 call-sites contra el censo del conmutador, resolviendo cada uno a su rutina
contenedora:

| overlay | rutina | ¿conmuta el modo? |
|---|---|---|
| DUNGEON | `dng_electric_field` (×2) | NO |
| OUTSUBS | `camp_apparition_levelup` | NO |
| SHOPPES | `healer_light_flash_fx` (×3) | NO |
| ENDGAME | `endgame_main` | sí, pero **DESPUÉS** (sus dos conmutaciones están en `0a4c`/`0a6a`, y el relleno en `0778`) |
| CAST2 | `time_spell_jingle_xor_flash` (×2) | NO |
| CAST2 | `shrine_visit` (×2) | NO |
| CAST2 | `codex_read_lesson_ceremony` (×3) | NO |

Y OUTSUBS, SHOPPES y CAST2 **no conmutan el modo en NINGÚN punto del overlay**.
⇒ En los 14, el modo es **AMBIENTE**: el que dejó puesto quien corrió antes.

## 4. Y el ambiente NO es derivable estáticamente: los setters se CONTRADICEN

La mayoría de las rutinas terminan dejando **0**, pero `blink` hace lo contrario: pone 0,
parpadea y **restaura 1**. O sea unas asumen que el reposo es 1 y otras lo dejan en 0. **No
hay un valor de reposo único que se pueda leer del binario**, y por tanto el modo en los 14
no se puede fijar sin ejecutar.

## 5. VEREDICTO

**«Limpia» no se sostiene para ninguno de los 14** — no porque se haya demostrado lo
contrario, sino porque el modo ahí es ambiente y el ambiente es indeterminado (§3+§4). La
geometría de §A8.1 **sigue en pie** y no se toca: los 14 comparten el rectángulo del
viewport al píxel.

★ **Y hay indicio fuerte de que el verbo correcto es el OPUESTO.** Mirando *qué son* las 14
rutinas —`dng_electric_field`, `camp_apparition_levelup`, `healer_light_flash_fx`,
`time_spell_jingle_xor_flash`, `shrine_visit`, `codex_read_lesson_ceremony`— **ninguna es un
repintado de mapa: todas son EFECTOS**, y cada una llama al relleno **2 o 3 veces**, que es
la forma de un destello (invertir / restaurar). Con modo XOR, rellenar el viewport entero
**invierte la pantalla**, y hacerlo dos veces la deja igual: eso *es* un fogonazo.

⚠ Ese indicio se apoya en NOMBRES del ledger, que son testimonio de quien fichó la rutina,
no derivación mía — y uno de ellos ya contiene la palabra `xor`, con lo que citarlo como
prueba sería circular. Por eso lo dejo como **lectura probable**, no como veredicto: la pata
que sí es mía y sí es independiente es §3+§4 (nadie fija el modo, y el reposo no es único).

## 6. Lo que lo cerraría

Un **testigo**: en el original, disparar uno de los efectos (el destello del sanador es el
más accesible) y mirar si el viewport se pone NEGRO un instante —copia— o se **INVIERTE**
—XOR—. Es una observación de un fotograma y adjudica el verbo de los 14 de una vez.
Mientras tanto, §A8.1 debe leerse como **«los 14 rellenan el rectángulo del viewport»**, sin
verbo, que es lo único que el binario sostiene por sí solo.
