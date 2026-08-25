# intro-av-211-derivacion.md — la INTRO: dissolve del subtítulo, cadencia de la demo y sonido

Carril `intro-av-211` (ficha #211, 2026-08-13). Reporte del usuario con grabaciones del
ORIGINAL sobre tres detalles AV de la intro. Lo que sigue separa **lo derivado del binario**
de **lo medido en grabación**, porque en esta ficha la distinción decidió el veredicto: dos
de los tres puntos NO son constantes del juego.

Testigos (material EA, `original/av-referencia/` gitignored — no viajan):
`reportes/intro-detalles-2026-08-13.mov` (34,3 s, MUDO) y
`reportes/intro-detalles-audio-2026-08-13.mov` (24,0 s, con audio real).

---

## 1. El subtítulo «Warriors of Destiny» son DOS dissolves, no uno — DIVERGENCIA REAL

Medido fotograma a fotograma (geometría EGA→pantalla `x0=32, y0=42, escala 4`):

| etapa | intervalo | duración |
|---|---|---|
| dissolve del LOGO `ultima:0` | 1,217 → 4,167 s | **2,950 s** |
| subtítulo etapa 1 — FUEGO, letras recortadas en NEGRO | 4,217 → 10,233 s | **6,016 s** |
| subtítulo etapa 2 — LETRAS a BLANCO | 10,292 → 16,242 s | **5,950 s** |

Las dos etapas son secuenciales: la segunda arranca justo cuando la primera satura
(fuego 99,67 % en t=10,233; las letras pasan de 1,43 % a 2,28 % en el fotograma siguiente).
Reparto 50,3 % / 49,7 %.

**Control que lo separa del ojo:** con la máscara de letras derivada DEL ASSET (no del vídeo),
en t=10,233 los píxeles-de-letra tienen luminancia media **111,9** contra **306,5** del fuego
(2,7× más oscuros) y en el asentado t=19,967 esos MISMOS píxeles valen **713,5**.

**Criterio de clase, mandado por el asset:** `ultima:1` es EGA **opaco entero** (censo sobre
`game/assets/intro-pics.png`: 32,4 % negro puro · 14,3 % blanco puro · resto rojos/amarillos)
⇒ la clase se decide por COLOR, no por alpha. El negro del asset se excluye del presupuesto de
la etapa 1 porque la intro pinta `#000000` detrás (`skin/fiel/intro.ts:473`): revelarlo es
indistinguible de no revelarlo, y contarlo haría que el fuego «acabase» antes de llenarse.

⇒ **Calcado** en `ui/faithful-intro.ts` (`tickTitle` pasa de 3 a 4 etapas) con la partición
pura en `skin/fiel/introAnim.ts` (`dissolveIndices`). La 2ª grabación confirma la cifra por
otra vía: subtítulo completo 5,775 → 17,79 = **12,02 s** frente a 6,016+5,950 = 12,0 s.

---

## 2. La CORTINILLA del cuarto de la demo — el port ya la tenía bien

`FONT.OVL` `scene_tick` (0x02fc), verbatim:

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
0392: cmp byte [0xbd28],1 ; sbb ax,ax ; neg ax ; mov [0xbd28],al   ⇒ alterna 0↔1
```

⇒ `[0xbd26]`/`[0xbd27]` son las columnas **izquierda y derecha** (no origen y cuenta): se
abre UNA COLUMNA POR LADO y el pestillo `[0xbd28]` la deja avanzar **un tick sí y otro no**.
Medido: centro fijo en EGA x≈160, anchos 1,3,5…15 columnas de 16 px en 8 estados
(18,192 → 19,750 s, 7 avances de 0,2226 s de media).
El port lo tenía CALCADO ya (`skin/fiel/demo-scene.ts:272-277`, `revToggle`).

Esto **retira** la línea de `dissolve-derivation.md` que decía «NO hay cortina en el intro»:
era falsa. El motor de escena vive en FONT.OVL y es FONT quien lleva la demo del attract; de
«INTRO no llama a scene_tick» se saltó a «no hay cortina», que es otro sujeto —
**el dueño del código no es el dueño de la pantalla**.

---

## 3. 🔴 La CADENCIA de la demo NO es una constante del binario

Es el hallazgo que invirtió el veredicto de esta ficha. Medido en grabación: la chimenea se
repinta cada **0,108 s** (mediana de 130 intervalos) y la cortinilla avanza cada **0,2226 s**
— ambos ≈2× el tic del INT 1Ch (54,925 ms). Parecía un ×2 que calcar. **No lo es.**

Resuelto con `re/tools/dispatch_table.py` (base por overlay; FONT.OVL = `0xe1e0`, la misma de
#110). Control positivo que acredita la base: `call 0x405c` → kernel **`0x223c` = `noise_burst`**
y `call 0x40e0` → **`0x22c0` = `beep`**, que son las primitivas ya documentadas de ese sitio.

- `call 0x3b7e` → kernel **`0x1d5e`**: NO es el waiter, es el **poll de teclado**
  (`int 0x16 ah=1` + `int 21 ah=6`, retorna al instante). Es el «abortar si hay tecla».
- El waiter real es `pause(n)` = kernel **`0x20fa`**, y sí es por TIC:
  ```
  2119-211e: int 21 ah=35 al=1c   ; GET vector INT 1Ch
  212a-2135: int 21 ah=25 al=1c   ; SET vector -> handler propio en cs:0x2159
  2113:      mov word [0x5448],0  ; contador = 0
  2138: mov ax,[0x5448] ; 213b: cmp ax,[0x544a] ; 213f: jb 0x2138   ; gira hasta n
  2159: sti … 2162: lea si,[0x5448] … 2166: inc word ptr [si]        ; el ISR del tic
  ```
- **PERO `scene_tick` llama `pause(1)`, no `pause(2)`** (`0x03b0-0x03b4`), y con `n==1` la
  espera **se salta entera** en máquina rápida:
  ```
  2103: cmp ax,1 ; 2106: jne 0x2110
  2108: cmp word [g_snd_delay_calib],0xf0
  210e: jle 0x2152        ; y 0x2152 es SÓLO el epílogo (pop×4; ret 2)
  ```
  `g_snd_delay_calib` (0x5456) se acumula en un bucle de calibración de velocidad
  (`0x2242` lo pone a 0, `0x2293 add [0x5456],cx`): en máquina rápida el valor es grande.

⇒ **El original NO tiene cadencia fija para esta demo**: el nominal es 1 tic y en máquina
rápida es 0 + coste de pintado. Los ~110 ms de la grabación son **tiempo de render de
DOSBox-X a 3000 cycles/ms**, no del binario. El port, que usa 1 tic
(`DEMO_MS_PER_FRAME = 1000/18,2065`), **ya era fiel al nominal**; aplicar el ×2 habría
encodeado un artefacto del emulador. Por la misma razón NO se tocan `titleDissolveMs`,
`subtitleDissolveMs` ni las duraciones de las dos etapas: son render, no constantes.

🔴 **Trampa de razonamiento que esto deja escrita** (mía, confesada): argumenté que «dos
magnitudes independientes caen en 1,97 y 4,05 tics ⇒ el ×2 es del juego». El cuanto SÍ es el
tic — pero **un cuanto reconocido no dice CUÁNTOS cuantos pone cada actor**: el `pause` pone
1 (o 0) y el resto lo pone el pintado. Hermana de
«una cota por debajo del valor medido vigila el umbral, no el valor».

---

## 4. El SONIDO de la intro — existe, y el emisor NO está en los overlays

La 1ª grabación era **silencio digital** (272.374 muestras, max abs 0). La 2ª sí tiene audio
(528.701 muestras, max abs 3777). Energía por banda **en dB sobre el fondo del propio vídeo**:

| ventana | 20-300 Hz | 300-1k | 1k-3k | 3k-8k |
|---|---|---|---|---|
| FONDO previo | 0 | 0 | 0 | 0 |
| LOGO (2,85-5,60 s) | +23,2 | +28,1 | +38,8 | **+45,1** |
| SUBT etapa FUEGO (5,85-11,75) | +8,9 | +9,1 | +10,3 | **+14,6** |
| SUBT etapa LETRAS (11,90-17,75) | +11,4 | +10,2 | +11,6 | **+16,6** |
| ASENTADO (18,1-23,8) | +0,8 | −2,7 | −5,0 | −0,2 |

Los dos sonidos existen y están ACOTADOS por la animación; la fila «asentado» es el control
que prueba que no es una propiedad de la grabación entera. **El crepitar corre por las DOS
etapas** (dentro de ~2 dB), no sólo por el fuego — quien lo cablee como cue de la etapa 1 lo
pondría mal.

**Censo de primitivas de sonido** (`dispatch_table.near_calls_to_kernel`), con controles:

| overlay | set_tone 0x22e2 | beep 0x22c0 | glide 0x43ae | noise_burst 0x223c |
|---|---|---|---|---|
| **INTRO.OVL** | — | — | — | — |
| **FLAMES.OVL** | — | — | — | — |
| FONT.OVL *(control)* | — | 1 (`0x403`) | — | 2 (`0x3ca`, `0x88d`) |
| CMDS.OVL *(control)* | — | — | 3 | — |
| COMBAT.OVL *(control)* | — | — | 4 | 2 |

Y por puerto crudo: `out 0x42/0x43/0x61` = 13 en ULTIMA.EXE, **0** en INTRO/FLAMES/FONT;
AdLib `0x388` = 1 en ULTIMA.EXE, 0 en los overlays.

⇒ Con 12 sitios de control disparando, el cero de INTRO/FLAMES es **ausencia real**. El
emisor vive en el KERNEL (preámbulo de arranque) o en la música AdLib — **sin identificar**,
ficha #220. **NO se cabló nada**: no hay derivación del emisor, y llamar «barrido» a lo que
el espectro no separa sería fabricar (además de duplicar criterio con #137).

🔴 **Cepo de instrumento que esta ficha deja avisado:** los overlays **no** llaman a las
primitivas de sonido por su dirección de kernel — van por **thunk local**. Un censo que
busque `0x22c0/0x22e2/0x223c/0x43ae` dentro de un `.OVL` dará **CERO SIEMPRE**, también donde
sí hay sonido. Se resuelve con `dispatch_table`, no con grep.

---

## 5. Párrafo para una posible entrada de /diferencias (decisión del lead y del usuario)

> **La demo de la portada corre «más rápida» en OpenU5 — y la comparación no es contra una
> constante del juego.**
> En el binario, cada fotograma de la demo de portada llama a `pause(1)`: una espera de **un
> tic del temporizador (INT 1Ch, 54,9 ms)** implementada instalando un manejador propio del
> tic y girando hasta que el contador llega a 1 (`FONT.OVL` scene_tick `0x03b0`–`0x03b4` →
> kernel `pause` `0x20fa`, ISR en `0x2159`). OpenU5 usa exactamente esa cadencia nominal.
> Lo que el jugador compara, en cambio, es contra el original **corriendo en un emulador**, y
> ahí intervienen dos cosas que no son del juego: el **coste de pintado** de cada fotograma se
> suma a la espera, y —esto es lo llamativo— con `n==1` la espera **se salta entera** en
> máquinas rápidas, por una comprobación de calibración de velocidad (`0x2108`:
> `cmp [g_snd_delay_calib],0xf0` / `jle` → epílogo). Medido sobre una grabación en DOSBox-X a
> 3000 cycles/ms, la demo del original avanza **≈2× más lenta** que su propio nominal.
> Es decir: **el original no tiene una cadencia fija para esta demo** — depende de la máquina,
> por diseño de 1988. No hay una «velocidad correcta» que calcar, así que OpenU5 se queda en el
> nominal derivado del binario. La diferencia que se percibe es real, y su causa es el
> emulador, no el port.

Frase mínima que aguanta sola: *«el original no tiene cadencia fija para la demo: depende de
la velocidad de la máquina; OpenU5 usa el nominal del binario»*.

---

## 6. Cabos declarados

- **#220** — identificar el emisor de los dos sonidos leyendo el preámbulo de arranque del
  kernel (candidatos: kernel vs música AdLib). No bloquea nada de esta ficha.
- **#221** — la puerta vitest de la batería nombra ficheros UNO A UNO. Al medirlo, este carril
  descubrió que su propia guarda NO estaba dentro: la cifra del momento fue **14 nombrados de
  424 existentes** (hoy 18 de 428 tras añadir el de esta ficha). Población pendiente de
  adjudicar.
- `g_snd_delay_calib` en la máquina del usuario **no se ha medido** (haría falta oráculo). Lo
  derivado y no dependiente de eso: el `pause` vale 1 tic como techo nominal, nunca 2.
