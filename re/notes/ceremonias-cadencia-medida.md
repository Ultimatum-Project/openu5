# Cadencia MEDIDA de dos ceremonias del original, y la animación en el sitio

Carril `careo-ceremonias`, 2026-08-25. **Esto es una MEDIDA, no una adjudicación**: dice
qué hace el original en un testigo concreto y qué hace el port hoy. La decisión sobre las
constantes Clase C que salen tocadas es del lead (§4).

Testigo: walkthrough de Lord Fenton (33 episodios, 854×480 a 30 fps; el corpus que ya usa
`fenton-piloto.md`). Muestreo del vídeo con la caja calibrada `(0,-1,855,481)` + NEAREST,
que es lo único que recupera el búfer 320×200 sin destruir el detalle de 1 px.

---

## 1. Aparición del campamento — tren de pulsos de inversión (OUTSUBS camp_results)

Instrumento: brillo medio del viewport nativo (x8..183, y8..183) por fotograma; umbral
derivado de las dos modas del propio tramo. La separación entre modas es de ~195 niveles
(p10≈28, p90≈223), así que el ON/OFF no es un juicio: es bimodal por construcción.

**Dos instancias independientes, en dos episodios distintos:**

| instancia | pulsos ON (ms) | huecos interiores (ms) | miembros vivos |
|---|---|---|---|
| ep02 t=256,0 | 4567 · 4567 · 4567 | 867 · 867 | 3 |
| ep12 t=1314,3 | 4600 · 4567 · 4533 · 4567 | (10300) · 867 · 900 | 4 |

- **`nº de pulsos = miembros vivos` queda CORROBORADO en vivo** (3 y 4), que es lo que
  `skin/fiel/apparition.ts` ya deriva del bucle por miembro 0x07fb.
- La duración del pulso se repite en 7 muestras dentro de **±33 ms = 1 fotograma**.
- El hueco de 10300 ms de ep12 no es la ceremonia: cae donde el original imprime la arenga
  de subida de nivel (el `>` de la consola cambia en ese tramo).

**Port hoy** (`APPARITION_INVERT_MS = 2200`, `APPARITION_GAP_MS = 450`), medido con el
MISMO instrumento sobre una captura densa a 60 fps: pulsos 2202 · 2219 · 2196, huecos
436 · 448. Es decir **0,48× el pulso y 0,51× el hueco del testigo LF**.

Suelo de ruido del instrumento: dos corridas idénticas del port dan 2205 · 2198 · 2215 y
438 · 453 ⇒ dispersión ±12 ms. La distancia al testigo (≈2400 ms por pulso) es 200× ese
suelo.

## 2. Cruce de puerta lunar — escalera de etapas (kernel_moongate_enter 0x48a8)

Ceremonia de naturaleza distinta: no toca la paleta, anima la GEOMETRÍA. Instrumento
propio: nº de filas del tile de la puerta que siguen siendo cuerpo macizo (EGA 9), por
fotograma. El bucle del original es descendente (0x4912-0x492b: blit parcial
`0x1112(anim,5,5)` + delay + `dec [0x5887]`).

| medida | testigo LF (ep21 t≈115,97–117,60) | port hoy |
|---|---|---|
| escalones 16→0 | 15 | 15 |
| monótona decreciente | sí | sí |
| ms por etapa (mediana) | **100** | **62** (`MOONGATE_TRANSIT_STAGE_MS`) |
| cierre completo | **1633 ms** | **900 ms** |

La FORMA coincide (careada fotograma a fotograma: el rectángulo mengua por arriba y acaba
en una franja baja antes de desaparecer, en los dos). Lo que difiere es la cadencia.
El muestreo del vídeo a 30 fps cuantiza la etapa a ±33 ms: las alturas 12 y 7 caen dentro
de escalones de 200/233 ms — dos etapas cada uno, consistente con 100 ms/etapa.

## 3. 🔴 El original SÍ anima tiles en el sitio (sobremundo y pueblos con agua)

`fenton-piloto.md` y el método de ch01 concluyeron que «Ultima V avanza los tiles por
turno; entre turnos la pantalla es una imagen fija; no hace falta filtro de fase». Eso es
cierto donde se midió (interior de una choza) y **falso en el sobremundo y en los pueblos
con agua**. Medido sobre ep02, ventanas de 6,0 s a 30 fps, umbral >24 por píxel y ≥20 px
por tile:

| ventana | tiles con cambio | máx. cambios en un tile | fotogramas con eco de consola |
|---|---|---|---|
| t=344 (sobremundo con mar) | 39 / 121 | 52 (8,7/s) | 11 |
| t=700 (pueblo con fuente) | 24 / 121 | 56 (9,3/s) | 14 |
| t=1000 (control, sin candidato) | 3 / 121 | 21 (3,5/s) | 16 |

**El argumento no depende de que la ventana esté «quieta»**, que es donde la medida
anterior se quedaba corta: 52 cambios en un tile frente a 11 fotogramas en los que la
consola cambia ⇒ al menos 41 cambios ocurrieron **sin turno**. La ventana de control da
3 tiles, así que no es ruido del códec.

Consecuencia para cualquier careo de pantalla: en el sobremundo, **dos capturas del mismo
estado difieren en los tiles de agua por FASE**. Se midió también en el port (28 tiles /
2198 px entre dos corridas idénticas), así que la fase hay que enmascararla o casarla.

## 4. Lo que esto NO dice

- **No adjudica las constantes Clase C del port.** Las tres cifras de la aparición no
  concuerdan entre sí: el port lleva 2200 ms, el comentario de `apparition.ts` cita su
  propio testigo en «≈2,75 s», y LF mide 4567 ms. Antes de mover nada hay que decidir qué
  testigo manda: la velocidad de una captura de DOSBox depende de los ciclos configurados,
  y los tres testigos son capturas distintas. Que las DOS ceremonias midan el mismo
  sentido (port ~2× y ~1,8× más rápido que LF) es un indicio de causa común, no una prueba.
- ~~**No hay cita de asm para la cadencia**, y no puede haberla: el `delay(2)` del cierre y
  el pareado de la aparición no son derivables byte-exactos (es justo por lo que están
  marcados Clase C).~~ 🔴 **FALSO PARA EL CIERRE, y lo corrige `cadencia-delay-pit.md`
  (carril `cadencia-asm`, 26-08):** `delay(n)` 0x20fa **no es un bucle de CPU** — engancha
  INT 1Ch (`int 21h/25h` @0x2133), su handler 0x2159 hace `inc word [0x5448]` y 0x2138
  espera al contador. El binario **no reprograma el canal 0 del PIT en ninguno de los 28
  ficheros**, así que el tick es el del BIOS (18,2065 Hz) y el `delay(2)` @0x4924 son
  **2 ticks = 109,85 ms**; el cierre, **30 ticks = 1647,76 ms**. La cita existe, la
  cadencia del cruce ES derivable byte-exacta, y **los 1633 ms medidos aquí eran los
  correctos**: quien estaba mal era el port (900 ms). *Sigue siendo cierto para la
  APARICIÓN*, que cuelga de `tone_sweep` 0x2192, un busy-wait calibrado a la CPU cuyo
  cuerpo exterior NO está calibrado ⇒ no tiene duración en ms. Lo que el asm SÍ fija
  —nº de pulsos = miembros vivos, escalera descendente 15→1, forma del blit parcial—
  coincide en los dos lados.
