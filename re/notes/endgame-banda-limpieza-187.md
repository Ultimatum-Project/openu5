# El paso de página del desenlace LIMPIA la pantalla entera — derivación byte a byte (#187)

> Adjudica las 4 divergencias catalogadas de #176 (`historia_1/2/3/5`, `expect: FAIL` en
> `game/tools/pixeldiff/endgame-cases.json`): el arnés visual del 11-08 vio en la
> REFERENCIA restos multicolores de la página anterior con la pantalla quieta, el port
> pinta limpio, y quedó sin derivar si el binario limpia o no la banda de texto al pasar
> de página. **Veredicto: LIMPIA — pantalla completa, en cada página, antes de componer
> la siguiente.** Las 4 divergencias son defecto de la REFERENCIA (la grabación), no del
> port. Autoridad: asm verbatim (`re/disasm/ENDGAME.OVL.asm`, `ULTIMA.EXE.asm`,
> `EGA.DRV.asm`). Resolución de near-calls con base 0xa290 (nivel 2,
> `overlay-load-layout.md`), la misma regla con la que `endgame-derivation.md` §F.3
> resolvió el fizzle.

---

## 1. El bucle de páginas del compositor (ENDGAME.OVL fn 0x0000, 0x0077-0x01ac)

`endgame-derivation.md` §C derivó las TABLAS del compositor (arte, titulares, bandas de
texto, offsets de END.DAT). Lo que faltaba es el RÉGIMEN del bucle. Leído entero, por
página i (var `[bp-6]`, 0..5):

| offset ENDGAME.OVL | código | resolución | qué hace |
|---|---|---|---|
| 0x004e-0x0053 | `sub ax,ax; push ax; call 0x7904` | 0x7904+0xa290 → **ULTIMA.EXE 0x1B94** | `select_window(0)` — UNA vez, antes del bucle |
| 0x0077-0x00a6 | tabla 0x3df4 | — | carga/renueva el `.16` de arte si cambia (0x691e/0x6954) |
| 0x00a8-0x00ac | `push 1; call 0x6992` | → **0x0C22** = SEL 0x0f fn5 | render-target := **BACKBUFFER** |
| **0x00b4-0x00b8** | **`push 0xff; call 0x742a`** | → **0x16BA `putchar`** | **`putchar(0xFF)` = CLEAR de la ventana activa (§2)** |
| 0x00bb-0x00fa | gate 0x3e06 | — | titulares TEXT.16 (pág 0: subs 0+4 en (216,0)/(152,28); pág 3 @0x01c4: subs 5+0 en (224,0)/(176,0)) |
| 0x00fc-0x0114 | `call 0x6abc(h,sub,x,y,0)` | → 0x0D4C | blit del arte de la página |
| 0x0117-0x0157 | tablas 0x3da6-0x3de8 → g5146-g5158 | — | rects de las DOS bandas de texto |
| 0x015a-0x0175 | `0xffff82de` + `0xffffda56` | — | lee la página de END.DAT (buf 0xb21e, 0x7d0 B) y la pinta justificada en las bandas |
| 0x0178-0x0183 | `cmp [bp-6],0; je 0x185; call 0x7ace; je 0x17e` | 0x7ace → **0x1D5E** (poll `int 16h/ah=1`, ret 0 sin tecla) | páginas 1-5: **espera tecla ANTES del present** (pág 0 no espera: viene del fizzle a negro) |
| 0x0185-0x018c | `push 1; push 0; call 0x6cde` | → **0x0F6E** | **PRESENT backbuffer→pantalla (§4)** |
| 0x01a3-0x01ac | `inc [bp-6]; cmp 6; jmp 0x77` | — | siguiente página |

⇒ Régimen de doble búfer puro: mientras la página i-1 sigue VISIBLE (durante la espera
de tecla), la i se compone off-screen **empezando por un clear**, y se presenta entera.

## 2. `putchar(0xFF)` es un fill del rect COMPLETO de la ventana activa

Handler en `ULTIMA.EXE:0x17bb-0x17f1` (cuerpo de `putchar 0x16ba`):

```
17bb: mov [si+4],0 / 17bf: mov [si+5],0   ; cursor a (0,0)
17c3-17ca: al = [si+6] >> 4               ; color := nibble ALTO del attr (= FONDO, §3)
17cc: SEL 0x2d (set_color)
17d6: call 0x1f77                          ; window_bounds: rect en px (celdas ×8, x1/y1 +7)
17d9: clc / 17da: SEL 0x3f                 ; fill_rect(ax,bx,cx,dx) con el color puesto
17e4-17ed: restaura [0x52da] via SEL 0x2d
```

Y las dos primitivas respetan el render-target backbuffer: `EGA.DRV` fn21 (SEL 0x3f,
fill) en `0x11a8-0x11b3` (`[si+0x1e]≠0 → es = cs:[0x202]`), fn31 (SEL 0x5d, glifo) en
`0x19ef → 0x1ac0` (ídem).

## 3. El color del fill es el FONDO de la ventana (polaridad derivada del blit)

`ui-text-layer.md` §6 rotula `set_color 0x1f26` como «color fg»; el blit dice otra cosa
y aquí la polaridad es carga-portante, así que se deriva del cuerpo (`EGA.DRV` fn31,
SEL 0x5d, entrada 0x19d2, colores en `bl=dl=[0x53aa]`, `bh=dh=[0x53ab]`, cargados por
putchar en `ULTIMA.EXE:0x16f4-0x16f8`):

- pasadas con **bit-mask = ~glifo** (`0x1a17`/`0x1a37`, `not ah`) escriben el color
  **bh = [0x53ab]** en los píxeles de FONDO;
- pasadas con **bit-mask = glifo** (`0x1a5e`/`0x1a7c`, sin invertir) escriben
  **bl = [0x53aa]** en los píxeles de TINTA.

`select_window 0x1b94` reparte el attr `[si+6]`: nibble BAJO → `[0x53aa]` (tinta),
nibble ALTO → `[0x53ab]` (fondo) (`0x1bb4-0x1bc6`). ⇒ el `[si+6]>>4` del handler 0xFF
es el color de **FONDO**: `putchar(0xFF)` = «pinta la ventana entera de su color de
fondo + cursor a casa». (Corolario no explotado aquí: `0x1f26` escribe ese nibble ALTO
— configura el FONDO, no la tinta; la tinta corriente la escribe `0x1cd9`.)

## 4. La ventana activa es la 0 = pantalla entera, y su fondo es negro

- Init `ULTIMA.EXE:0x1184-0x11ad`: los 4 descriptores de `0x535e` nacen
  `(0,0,0x27,0x18)` con **attr 0x0f** (tinta 0xF blanca, fondo 0x0 NEGRO). Bounds vía
  `0x1f77`: `(0,0)-(0x27·8+7, 0x18·8+7)` = **(0,0)-(319,199)**.
- Censo de reconfiguradores (`dispatch_table.near_calls_to_kernel(<ovl>, 0x1c22)`,
  **27 sitios en 6 overlays**: DUNGEON 2, INTRO 11, SHOPPES 2, CMDS 2, ZSTATS 10,
  SHOPPES3 2): todos los sitios in-game configuran la **ventana 1** (panel,
  `(0x18,1,0x26|0x27,6|9)`) salvo dos con índice 0 — INTRO `0xce3` (ventana de trabajo
  del arranque, restaurada por la terna `0xd00-0xd2e`, `consola-ancla-113.md` §1) y
  DUNGEON `0x1088` (banner con left/top de tabla), que **se restaura a
  `(0,0,0x27,0x18)` en `0x10c6-0x10d3`, misma rutina, camino incondicional**.
- `ENDGAME.OVL` no toca ni rect ni colores: **0** llamadas a `set_text_window 0x1c22`
  (`grep 'call 0x7992'` = 0) y **0** a `0x1f26` (`grep 'call 0x7c96'` = 0).
- Control observacional del fondo negro: los dos instantes de historia que SÍ pasan el
  careo (`historia_0`, `historia_4`) tienen el fondo negro igual en ambos lados.

## 5. El present es una copia COMPLETA — nada de la página anterior sobrevive

`0x6cde` → wrapper `ULTIMA.EXE:0x0F6E` (`0x0f74-0x0f84`: si from≠to → SEL 0x1b) →
`EGA.DRV` fn9 `0x098a`: con `(ax=1,bx=0)` toma `stc; call 0x772` → camino STC
`0x814-0x839`: **4 planos × 0xfa0 words** (= 4 × 8000 B = 320×200) del segmento de
backbuffer `cs:[0x202]` a 0xA000. Sin rects, sin condiciones.

## Veredicto

**El original LIMPIA.** Cada página del desenlace se compone sobre un fill uniforme
negro de (0,0)-(319,199) y se presenta con una copia total. No existe en el binario
ningún camino por el que un píxel de la página i-1 aparezca en un frame estable de la
página i — ni en la banda de texto ni en ninguna otra parte.

### Adjudicación de las 4 divergencias de #176

Las franjas multicolores (azul/magenta/cian/verde, mitad baja, estabilidad 1,0000) que
el arnés midió en la referencia de `historia_1/2/3/5` **no pueden ser conducta del
binario**: son un defecto de la GRABACIÓN (`endgame-victoria-box-20260721.mov`). El
port, que pinta cada página limpia, es **FIEL**. El mecanismo del artefacto de la
grabación (códec, captura, emulador de origen) NO se deriva de aquí y queda como
hipótesis sin adjudicar — lo derivado es que el binario no lo produce.

- Los `expect: FAIL` **se quedan**: el arnés compara contra esa misma grabación y la
  diferencia de píxeles es real. Lo que cambia es la ADJUDICACIÓN.
- 🔴 La prosa `divergencia_catalogada` de los 4 casos de `endgame-cases.json` («NO está
  hecho DERIVAR…») queda RANCIA con esta acta, y **no se re-apunta en este carril a
  propósito**: la guarda G6 de `re/tools/test_endgame_visual.py` sella el sha1 del
  manifiesto con los veredictos medidos, y re-sellar a mano sin re-medir es
  exactamente el fraude que esa guarda existe para cazar. El testigo `.mov` no está en
  esta máquina (vive en el MacBook, gitignored). **Pendiente diferido, con el texto ya
  preparado abajo**: en la máquina del testigo, pegar el texto en los 4 casos y correr
  `python3 endgame_visual.py --extract-ref` + captura `@endgame` +
  `endgame_visual.py --write` para re-sellar.

Texto preparado para los 4 `divergencia_catalogada`:

> DIVERGENCIA ADJUDICADA (#187): defecto de la REFERENCIA. El binario LIMPIA la
> pantalla entera al pasar de página — ENDGAME.OVL fn 0x0000 hace por página
> `putchar(0xFF)` (0x00b4, = fill (0,0)-(319,199) al fondo negro de la ventana 0,
> ULTIMA.EXE 0x17bb-0x17f1 + 0x1f77) sobre el backbuffer y presenta con copia total
> (0x0185 → 0x0F6E → EGA.DRV 0x814). Los restos multicolores de la mitad baja son de
> la grabación; el port, que pinta limpio, es FIEL. Derivación:
> re/notes/endgame-banda-limpieza-187.md. `expect: FAIL` se queda porque la
> comparación sigue siendo contra esa grabación.

### Sin cambio de conducta en el port

El port ya hace lo que el binario: `paintEndgameStory`
(`game/src/skin/fiel/endgame-frame.ts:350-351`, cita VERIFICADA en este carril) abre
cada página con `fillRect(0,0,320,200)` negro — el calco exacto del `putchar(0xFF)`
sobre la ventana 0.
No se toca código de juego, no hay estreno en rojo que estrenar ni captura nueva que
mirar: el careo visual vigente (7 PASS, 4 FAIL esperados) no se mueve.
