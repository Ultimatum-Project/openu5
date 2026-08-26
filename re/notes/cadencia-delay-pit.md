# Las tres primitivas de temporización del binario, y cuál de ellas SÍ da milisegundos

Carril `cadencia-asm`, 2026-08-26. Adjudica la ficha **G1** de `ceremonias-cadencia-medida.md`
(«el port corre dos ceremonias al ~0,5× del testigo»). Citas = `re/disasm/*.asm` + offset.

**Resultado en una línea:** de las dos ceremonias medidas, **una es derivable byte-exacta y el
port la tenía mal** (cruce de puerta lunar: 1647,8 ms, el port ponía 900), y **la otra no es
derivable en ms por construcción** (aparición: un busy-wait calibrado a la CPU). El vídeo del
testigo **no** va lento: sobre el fenómeno derivable cae a −0,21 %.

---

## 1. Las tres primitivas

| rutina | qué es | ¿da ms? |
|---|---|---|
| `delay(n)` **0x20fa** | espera **n ticks de INT 1Ch** | **SÍ, exacto** |
| `run_n_frames(n)` **0x3ae6** | n × (`call 0x5910` render + `delay(1)`) | sólo su cota inferior |
| `pcspeaker_tone_sweep(a0..a4)` **0x2192** | busy-wait **calibrado a la CPU** | **NO** |

### 1.1 `delay(n)` 0x20fa — es un contador de ticks del PIT, no un bucle de CPU

```
2100: mov ax, [bp+4]                     ; n
2103: cmp ax,1 / 2108: cmp [g_snd_delay_calib],0xf0 / 210e: jle 0x2152
                                         ; n==1 en máquina lenta ⇒ NO espera
2110: mov [0x544a], ax                   ; objetivo = n
2113: mov [0x5448], 0                    ; contador = 0
211a-211e: int 21h/35h AL=1Ch            ; guarda el vector de INT 1Ch
212d-2135: int 21h/25h AL=1Ch → cs:0x2159 ; instala handler propio
2138: mov ax,[0x5448] / cmp ax,[0x544a] / jb 0x2138   ; espera activa
2141-214f: restaura el vector
2159: sti / … / 2166: inc word ptr [si]  ; handler: [0x5448]++
```

**INT 1Ch es el tick del BIOS y el binario NO reprograma el canal 0 del PIT.** Censo sobre los
**28** `.asm`: cero `out 0x43,·` y cero `out 0x40,·`; los únicos puertos con inmediato son
**0x42** (14, tono del altavoz) y **0x61** (19, compuerta del altavoz). Los 272 `out dx, al` no
pueden tocar el PIT: los únicos cuatro `mov dx, 0x4[0-3]` del corpus son
`ULTIMA.EXE 0x1b25` (`mov ds,dx` — **segmento 0x40 = BDA**, vacía la cola de teclado escribiendo
40:1A/40:1C) y tres de `T1K.DRV` (0x1705/0x1827/0x1848, zancada de un bucle de blit, sin `out`
detrás). *Control positivo del censo*: el mismo patrón encuentra los 0x42/0x61 y los 272
`out dx,al` del driver EGA.

⇒ **1 tick = 65536/1193182 s = 54,9254 ms**, y `delay(n)` = **n ticks**, en milisegundos y
**independiente de la máquina**. En un bucle, el enganche se sincroniza con el tick, así que el
PERIODO es exactamente n ticks mientras el trabajo del cuerpo quepa en uno.

### 1.2 `tone_sweep` 0x2192 — calibrado a la CPU, y por eso NO da ms

```
2198: mov ax,[g_snd_delay_calib] / cmp ax,0x64 / jge 21a4 / xor ax,ax   ; calib<100 ⇒ 0
21a4: mov cl,0x18 / div cl        ; interior = calib/24
21a9: mov [0x5454], ax
21b8: mov cx,[bp+8]               ; ← EL CONTADOR DEL BUCLE EXTERIOR es a2
21df: dec word [0x5452] / jne     ; retardo interior, a3 × interior decrementos
21ed: loop 0x21c4                 ; (rama muda) · 222c: loop 0x21f1 (rama audible)
```

`g_snd_delay_calib` se mide **al arrancar** (0x11b4-0x120b): engancha INT 1Ch, cuenta cuántas
vueltas de `inc [mem]/cmp [mem],0/je` caben en **un tick**, y escala el crudo por `×18/750`.
Sólo el retardo INTERIOR queda calibrado; **el coste del cuerpo exterior no**, y escala con la
velocidad de la máquina. Por eso el barrido dura lo que dura **el host**, no lo que dice el asm.
En los **44** sitios de `tone_sweep` del corpus **a3 (bp+0xa) vale 1 sin excepción**: la única
variable de duración es a2.

## 2. Cruce de puerta lunar — DERIVABLE, y el port lo tenía mal

`kernel_moongate_enter` 0x48a8. Único bucle de animación, y es descendente:

```
490d: mov byte [g_moongate_anim], 0x0f          ; 15 etapas
4912: … call 0x1112                              ; blit parcial(anim,5,5)
4920: mov ax,2 / push ax / 4924: call 0x20fa     ; delay(2)
4927: dec byte [g_moongate_anim] / 492b: jne 0x4912
```

No hay otra entrada al bucle: los únicos saltos que aterrizan en 0x48ca..0x4912 son el `je 0x48ca`
del propio prólogo y el `jne 0x4912` de la cola.

⇒ **etapa = 2 ticks = 109,85 ms · cierre = 15 × 2 = 30 ticks = 1647,76 ms.**

### 2.1 Careo con el corpus Lord Fenton — TRES cruces independientes

Instrumento: nº de filas con cuerpo de puerta (EGA 9) en la celda (5,5), fotograma a fotograma a
30 fps sobre la caja calibrada `(0,-1,855,481)` + NEAREST.

| cruce | 16→15 | 1→0 | cierre | vs 1647,76 |
|---|---|---|---|---|
| ep21 | 115,967 | 117,600 | **1633,3 ms** | −0,88 % |
| ep12 | 820,033 | 821,700 | **1666,7 ms** | +1,15 % |
| ep27 | 1406,000 | 1407,633 | **1633,3 ms** | −0,88 % |
| **media** | | | **1644,4 ms** | **−0,21 %** |

Los 15 intervalos de cada cruce alternan **100 y 133 ms (11 y 4 en ep21)**, que es exactamente lo
que produce muestrear un periodo real de 109,85 ms en rejilla de 33,3 ms (109,85/33,3 = 3,295 ⇒
70,5 % de tres fotogramas y 29,5 % de cuatro; esperados 10,6 y 4,4). La cuantización, y no un
desajuste, explica el resto.

**⇒ El testigo LF es un oráculo de TIEMPO válido: sobre el único fenómeno derivable del corpus,
−0,21 % en la media de tres.** El port ponía `MOONGATE_TRANSIT_STAGE_MS = 60` (cierre 900 ms) =
**0,55×**, calibrado sobre `moongate-animacion-viaje.mov`, que medía «15 etapas en 0,6-0,9 s».
**Ese testigo es el que estaba mal.** Corregido a 2 ticks; la constante deja de ser Clase C.

## 3. Aparición del campamento — NO derivable, y las tres cifras son tres máquinas

El pulso de inversión es el hueco entre el `rect_XOR(8,8,0xb7,0xb7)` (OUTSUBS 0x08aa) y el primer
render posterior (`run_n_frames(1)` @0x08d5); lo único que hay en medio es
`tone_sweep(1, 0x9c4, **0xea60**, 1, 0x157c)` @0x08c1 — **a2 = 60000**.

Medido: durante los 4567 ms de pulso el viewport está **congelado del todo** (0 píxeles
cambiados fotograma a fotograma, brillo constante 223,2 en ep02 t=256,0), que es la firma exacta
de un bucle sin llamada de render. La campanilla previa (`a2 = 0x1388 = 5000`, @0x0896) mide
≈467 ms junto con su render — coherente con la razón **12:1** que impone a2.

**Las tres cifras:**

| cifra | qué es | veredicto |
|---|---|---|
| **4567 ms** | pulso medido en LF (7 muestras, ep02 y ep12, ±33 ms) | real, **en la máquina de LF** |
| **≈2750 ms** | testigo que cita `apparition.ts` | real, en **otra** máquina |
| **2200 ms** | `APPARITION_INVERT_MS` del port | tercera máquina / redondeo |

No hay contradicción que resolver: **`tone_sweep` no tiene una duración en ms**, tiene una
duración por host. Las tres cifras son tres capturas de DOSBox distintas y el asm no arbitra
entre ellas. La constante **sigue siendo Clase C, ahora con el motivo MEDIDO** en vez de supuesto.

### 3.1 🔴 Cabo abierto: el barrido no es lineal en a2 entre ceremonias

Dentro de la aparición la razón 12:1 (chord/campanilla) se cumple. **Entre ceremonias, no.** En
**ep12**, con la misma sesión y la misma rutina:

- aparición t=1314,4: `a2 = 60000` → **≈4500 ms** de congelación
- cruce t≈820,0: `a2 = 30000` (@0x48e5, `tone_sweep(2,0x7d0,0x7530,1,0x170c)`) → **≲200 ms**

El prólogo del cruce (0x48ca `run_n_frames(1)` + 0x48e5 barrido + 0x48fe `fx_tile_fizzle_in` +
0x490a `run_n_frames(1)`) cabe entero en ≤200 ms en los TRES cruces: en ep27 el compositor sigue
repintando cada ~167 ms hasta 200 ms antes del descenso, y en ep12 hasta 33 ms antes. Un
congelado de los 2283 ms que exigiría la proporción sería inconfundible y **no está**.

Es decir: *duration ∝ a2* vale dentro de una llamada y **falla** entre estas dos. Queda algo sin
identificar que modula `tone_sweep` (candidatos no descartados: la rama muda/audible por
`g_unk_a9ce` y el coste del `in/out 0x61` bajo emulación; `[0x5454]` recalculado en cada llamada).
**No lo resuelvo aquí, y lo dejo dicho como medida, no como teoría.** El instrumento que lo
cerraría ya existe en el repo: los puntos de ruptura de código + contador de ticks BIOS en
dosbox-x headless de `audio-diff-calibration.md` (que así midió `0x20c8(200,1)` = 219,7 ms = 4
ticks), apuntados a 0x2192.

## 4. Lo que esto cambia, y lo que no

- **Cambia** `MOONGATE_TRANSIT_STAGE_MS`: 60 → 2 ticks (109,85 ms). Censo de consumidores:
  **uno** en tiempo de ejecución (`skin/fiel/skin.ts:2936`). La ventana de captura del careo denso
  (`CAREO_REC_MS = 8000`) sigue cubriendo el cierre largo. No hay constante compartida detrás: el
  error era de UN testigo, no de una calibración común — el resto del port ya usa el tick de
  54,9 ms correctamente (`PAUSE_UNIT_MS`, `ANIM_TICK_MS`, `DEMO_MS_PER_FRAME = 1000/18,2065`).
- **No cambia** `MOONGATE_STAGE_MS = 32` (ambiente): el original avanza esa etapa **una por pase
  del compositor** (0x4775/0x4786), que no es un tick — sigue Clase C (ficha G7).
- **No cambia** `MOONGATE_DEPART_HOLD_MS = 650` ni las constantes de la aparición: dependen de
  `tone_sweep`, y §3.1 dice que hoy no sabemos convertirlo a ms.
- **Refuta** la hipótesis «la captura del testigo va lenta»: sobre el fenómeno cuya duración fija
  el asm, el vídeo cae a −0,21 %. Y **refuta** también «una causa común a las dos ceremonias»: son
  primitivas distintas, y sólo una de las dos estaba mal.
