# #296 — El sueño en CAMA apaga el interior de la ventana de juego: `set_color(0)` + `fill_rect(8,8,0xb7,0xb7)`

Fecha: 2026-08-14. Carril `efectos-mundo-2`. Sujeto: **el binario** (CMDS.OVL) y el calco.
No re-litiga el bucle: lo continúan `cama-241-acta.md` §1 y `sueno-cama-249.md` §10, que lo
leyeron desde `0x0631`. Lo que faltaba estaba **tres instrucciones más arriba**.

## 1. Las dos llamadas que nadie había citado

Verbatim de `re/disasm/CMDS.OVL.asm`, entre el «Zzzzzzz...» y la entrada al bucle:

```
060d: b81e42            mov ax, 0x421e        ; DS 0x421e = "Zzzzzzz...\n"
0610: 50                push ax
0611: e8bc52            call 0x58d0           ; print
0614: 2bc0              sub ax, ax            ; ★ 0
0616: 50                push ax
0617: e8d644            call 0x4af0           ; ★ set_color(0)
061a: b80800            mov ax, 8
061d: 50                push ax               ; x0 = 8
061e: 50                push ax               ; y0 = 8
061f: b8b700            mov ax, 0xb7
0622: 50                push ax               ; x1 = 0xb7 (183)
0623: 50                push ax               ; y1 = 0xb7
0624: e8ff44            call 0x4b26           ; ★ fill_rect(8,8,0xb7,0xb7)
0627: a07f58            mov al, byte ptr [g_hour]   ; …y aquí empieza lo ya leído
```

`0x4af0`/`0x4b26` son las mismas primitivas que el chrome de la pantalla
(`paint_screen_frame`, kernel `0x637e`; el port las tiene calcadas con sus offsets en
`skin/fiel/frame.ts`). El rectángulo `(8,8)-(183,183)` es **el interior de la ventana de
juego**: 176×176 px = 11×11 tiles de 16. La caja del borde que lo rodea es `(7,7)-(184,184)`
(`0x645c`-`0x6477`), o sea que el relleno **no toca el marco**.

## 2. Por qué el negro dura toda la noche

Porque el bucle de sueño (`0x0634`-`0x068d`, leído en las dos actas hermanas) **no vuelve a
tocar el interior de la ventana**. Su cuerpo, por vuelta:

| offset | qué |
|---|---|
| `0x0634` | `push 1 / call 0x617a` → `delay_ticks_int1c(1)` (kernel `0x20FA`) — **un tick** |
| `0x0647` | `advance_clock(10)` — diez minutos |
| `0x0664` | transición día/noche si la hora cruza 20 o 5 |
| `0x0671` / `0x0674` | `call 0x6b68` / `call 0x6980` — repintado **de panel**, no del viewport |
| `0x0677` | snap de NPCs (TOWN `0x1694`) |
| `0x0688` | gate `find_object_at_xy` → «Thrown out of bed!» |

⇒ **se pinta UNA vez y aguanta**. Y de la geometría se sigue, sin necesidad de mirar un
vídeo, qué queda FUERA del apagón: la banda celeste vive en la fila 0 (`set_cursor(6,0)`
@`0x4b53`, y = 0..7) y la de vientos en la fila 23 (y = 184), las dos por encima y por
debajo del rango 8..183.

## 3. La cadencia del sueño está en el ASM, pero sólo en FOTOGRAMAS

El `push 1` de `0x0634` es el número de ticks de INT 1Ch por paso de diez minutos: **seis
esperas por hora dormida**. Eso es lo derivado. Pasarlo a milisegundos NO lo es: el paso
real del original es «un tick **más** lo que cueste el repintado de `0x0671`/`0x0674`», y
ese coste no está en el binario. Es la misma estructura que en la escena del santuario
refutó por 2,22× el supuesto «un fotograma = un tick ≈ 55 ms» (ver `SHRINE_SCENE_UNIT_MS`
en `main.ts`). ⇒ en el clon, 55 ms/paso es **el suelo derivado**, declarado Clase C en
`ui/bed-sleep.ts`, y se recalibra ahí si aparece un testigo de vídeo del sueño en cama.

## 4. El dato que hace ALCANZABLE la escena, medido sobre los assets

Barridas las 32 small maps de `game/assets/maps/smallmaps.json`: **264 casillas LeftBed
(0xAB)**. Es exactamente la población que `cama-241-acta.md` §A2 midió para el `+1` ciego
del epílogo — dos instrumentos independientes, la misma cifra.

## 5. Lo que este acta NO toca

- La **hora de destino** (`sub …, 0x17`, el «despierta una hora tarde» al envolver por
  medianoche) sigue siendo #249: cambia cuánto dura el sueño y mueve el stream.
- La **acampada** es otra rutina (kernel `0x3C9A`) y no ejecuta este `fill_rect`; si apaga
  o no su viewport es #303, y este acta no aporta evidencia sobre ella.
