# Las tres preguntas AV del ritual del Shadowlord — y por qué la del temblor NO es un problema de duración

Carril `shadowlord-av-243` · rama `re/shadowlord-av-243` · **2026-08-13**.
**SHA de main al abrir el worktree: `7aad9163`.**

Ficha #243, reporte del usuario del 13-08 viendo la escena del ritual (deploys #26/#27).
Tres preguntas contra el ORIGINAL. Las tres tienen respuesta; **ninguna de las tres es lo
que la pregunta suponía**, y una de ellas destapa que el port no tiene el defecto que
parecía.

Convención de este acta: los `call` de overlay se resuelven al kernel restando **0x4080**
(delta confirmado por TRES overlays independientes — CAST `0x6212`→`0x2192`, CMDS `0x6212`,
TALK `0x842e`→`0x43ae` en `audio-202.md` §1).

---

## Resumen de los tres veredictos con su grado

| # | pregunta | veredicto | grado |
|---|---|---|---|
| 1 | ¿anima al Shadowlord parado? | **NO** — y el port ya es fiel | **DERIVADO** (enumeración del dominio del reloj) |
| 2 | ¿la destrucción se difumina? | **NO** — son 7 explosiones sobre la celda; el dissolve existe y es de la APARICIÓN | **DERIVADO**; el orden objeto↔explosión, **NO establecido** (§2.3) |
| 3 | ¿el temblor dura mientras suena? | En 1988 **no puede no durar**: el rugido ES el bucle de dibujo | **DERIVADO** + port **MEDIDO** (~~5,83 s~~ → **6,60 s** de cola, §3.3) |

---

## 1. El Shadowlord parado NO se anima — y el dominio del reloj es una ENUMERACIÓN, no un grep

### 1.1 El reloj maestro y sus cinco bucles

`advance_tile_anim_frames` (`ULTIMA.EXE:0x44b8`), cuerpo entero leído. Escribe la tabla de
remapeo `[si + 0xb11e]` (la que el disasm imprime como `[si - 0x4ee2]`) en **cinco bucles
con cotas literales**, y ésos son todos los que hay:

```
44bf: si=0xd4 … 44d3: cmp si,0xd8  jl   ; ciclo 0xd4→0xd8 (wrap a 0xd4)
44dc: si=0xd8 … 44f0: cmp si,0xdc  jl   ; ciclo 0xd8→0xdc (wrap a 0xd8)
44f9: test [0x6a7e],1  je 0x4548         ; ── compuerta &1 ──
4500: si=0x80 … 4509: cmp si,0x84  jl   ; XOR 1 (toggle de pares)
4512: si=0xec … 4526: cmp si,0xf0  jl   ; ciclo 0xec→0xf0 (wrap a 0xec)
452f: test [0x6a7e],2  je 0x4548         ; ── compuerta &2 ──
4536: si=0xfa … 453f: cmp si,0xfe  jl   ; XOR 1 (toggle de pares)
4548: inc byte ptr [0x6a7e]              ; el contador de las dos compuertas
```

Identidad de esos tiles (careada contra `TILE_INFO` del port, ejecutándolo):

| rango | tiles |
|---|---|
| `0x80-0x83` | TortureChair1 · TortureTable2 · TortureTableWithBody1/2 |
| `0xd4-0xd7` | Waterfall1..4 |
| `0xd8-0xdb` | Fountain1..4 |
| `0xec-0xef` | SnakeSign1..4 |
| `0xfa-0xfd` | Clock1/2 · **Bellows1/2** |

★★ **Todo BANCO BAJO. El reloj maestro no toca jamás un sprite de actor.** Esto no es una
ausencia encontrada grepeando (que sería refutable por un canal que no vi): es el
**recuento de los propios límites de sus bucles**, todos literales inmediatos.

### 1.2 🔴 LA TRAMPA: `0xFC` es el Shadowlord Y es el fuelle, en DOS BANCOS DISTINTOS

El reloj SÍ togglea `0xfa-0xfd`. Y `0xFC` es exactamente el byte que el objeto Shadowlord
lleva en la tabla `0x5c5a` (`CMDS.OVL:0x1192`/`0x11d5` lo escriben; `CAST.OVL:0x16c1` lo
compara). Quien junte esas dos frases concluye que **el original parpadea al Shadowlord cada
~220 ms** — que es lo contrario de la verdad.

Son dos espacios de numeración:

- **banco bajo `0xFC`** = `Bellows1`, el fuelle del herrero. Es lo que el reloj togglea.
- **banco alto `0x1FC`** = `ShadowLord1`. Es el sprite que se pinta.

El propio binario lo dice: el mismo objeto cuyo byte es `0xfc` (`CMDS 0x11d5`) se pasa a la
rutina de dissolve como **`0x1fc`** (`CMDS 0x11c6: mov ax, 0x1fc`). El byte del objeto se
expande al banco alto para dibujarse.

★★ **Dos tablas indexadas por el mismo número no son la misma tabla.** Aquí el número
coincide, el rango del reloj lo incluye, y la conclusión sale invertida. Familia de
[[grep-por-mi-direccion-no-por-el-concepto]].

### 1.3 El segundo canal: la resolución de tile tampoco lo anima

`ULTIMA.EXE:0x51b8` (la rutina que resuelve el tile mostrado por celda, `ret 0xa`) tiene un
brazo de **frame ALEATORIO POR REPINTADO**: `0x51a0` devuelve `rand_range(0,3)` — y `0`
fijo si `[g_time_spell]==0x54`, o sea el hechizo de tiempo **congela la animación**. Ese
brazo lo alcanzan exactamente:

| tile | base del frame |
|---|---|
| `0x84` | `0x51a0()+0x60` |
| `0x85` | `0x51a0()+0x64` |
| `0x90` (si el vecino es 0x9b/0x9c) | `0x51a0()+0x38` |
| `0x92` (si el vecino es 0x9a/0x9c) | `0x51a0()+0x34` |
| `0x9d`, `0x9e` | `0x51a0()+0x3c` |
| `0x93` | `(tile & 3) + 0x30` — determinista, **no** aleatorio |

**`0xFC` no está.** Cae al default `0x5370`, que escribe `[bp+4]` (el tile) sin tocar.

⇒ Ni el reloj maestro ni el resolutor de tile animan al Shadowlord.

### 1.4 Qué hace el port, y por qué está BIEN

El Shadowlord **sí tiene cuatro frames**: `0x1FC-0x1FF` = `ShadowLord1..4`. Ejecutando
`buildAnimGroups()` del port sobre su propio `TILE_INFO`:

```
tile 0x1fc  ShadowLord1  isPartOfAnimation=true  animationIndex=0  grupo={base:508,size:4,divisor:2,perTurn:true}
… 0x1fd/0x1fe/0x1ff idem, animationIndex 1/2/3
```

`perTurn:true` = el frame lo mueve **el contador de TURNOS del mundo**, no el reloj de
render. Es uno de los **49** grupos del banco alto con esa marca.

⇒ **Respuesta a la pregunta 1:** en el original un Shadowlord quieto, con el jugador sin
hacer nada, **no mueve los brazos**. Tiene cuatro fases y avanzan **una por turno**. Lo que
el usuario observó es fiel. El modelo del port (`render/tileanim.ts`) ya es el correcto, y
su docblock ya citaba el testigo previo del DOSBox del usuario («un actor QUIETO NO cicla a
~110 ms; Avatar: 1 cambio en 13 s de reposo»). Este acta le añade la derivación por
enumeración, que antes estaba enunciada como «los sprites de actor NO están en él» sin el
recuento.

**Lo que este acta NO establece:** que el port *efectivamente* avance el frame del
Shadowlord en cada turno del mundo vivo. La tabla de grupos es correcta; el cableado
`animatedFrame(tile, phase, groups, personTurn)` lo vigila el test nuevo (§5).

---

## 2. La destrucción: SIETE explosiones, ningún difuminado — y el dissolve existe en OTRO sitio

### 2.1 El bucle, con su cardinal

`CAST.OVL:0x16e1-0x16fa`:

```
16e1: mov word ptr [bp - 2], 7
16e6: mov si, 7
16e9: al=[g_party_x] ; push
16ef: al=[g_party_y] ; dec ax ; push        ; ← la celda del Shadowlord, (x, y−1)
16f4: call 0x75a2                            ; explosion_fx_at_cell
16f7: dec si
16f8: je 0x1708                              ; ⇒ SIETE vueltas
16fa: jmp 0x16e9
1708: … los escritos de estado                ; DESPUÉS del bucle
```

`explosion_fx_at_cell` = `ULTIMA.EXE:0x3522`: blitea el tile 0 (`TileData` lo llama
`Explosion`) vía `0x10e0`, luego `noise_burst(2000, 3000, 10)` (`0x223c`), luego
`viewport_redraw` (`0x5910`).

⇒ **No hay dissolve, no hay difuminado, no hay desvanecido por pasos.** Hay siete
fotogramas de explosión sobre la casilla, y después el estado se escribe.

### 2.2 ★ Y NO es que el motor no sepa difuminar

La **APARICIÓN** urbana del Shadowlord sí usa un dissolve. `CMDS.OVL:0x11c6-0x11d2`:

```
11c6: mov ax, 0x1fc ; push      ; el sprite
11ca: mov ax, 5     ; push
11ce: mov ax, 3     ; push
11d2: call 0x50e8               ; → kernel 0x1068
```

`ULTIMA.EXE:0x1068` es un bucle `di = 0 … 0x100` con **dos llamadas al driver gráfico por
vuelta** (`lcall [g_snd_driver_fn]`, función 0x66) y un `viewport_redraw` (`0x5910`) cada 8
vueltas (`test di,7`). Doscientos cincuenta y seis pasos = **un dissolve por puntos**,
pariente del de la portada de #211.

★★ Que el original no difumine la destrucción es una **elección**, no una carencia. Ese
matiz cambia el veredicto de #201: no es «al original le faltaba presupuesto para un
fundido», es que la muerte del Shadowlord es una explosión y su llegada es una materialización.

### 2.3 ⚠ Lo que NO he establecido: si el sprite sigue bajo las explosiones

Entre el gate y el bucle hay dos llamadas:

```
16d6: push word ptr [g_cmb_scratch_x]   ; [0x5876]
16da: call 0xffffbb9e
16dd: push ax
16de: call 0xffffbb92
```

`shadowlord-ritual.md` las rotula «coords de pantalla». **No lo he verificado y no lo
relayo como hecho**: `0xbb9e`/`0xbb92` caen en la **tabla de thunks** del kernel
(`ULTIMA.EXE:0x7b12`/`0x7b1e` son `lcall 0x72e,0x2ec` + `ljmp 0:0x8280`/`0:0x82ee`), cuyo
destino real exige el mapa de carga de overlays — bloqueado por la clase de #81.

⇒ Que el original **mantenga el sprite del Shadowlord debajo de las siete explosiones** es
lo que **sugiere el orden del código** (los escritos de estado van después), pero **no está
establecido**: si una de esas dos llamadas retira el objeto, el orden real sería otro. Un
testigo en DOSBox lo cerraría; **no lo he obtenido** (§4).

### 2.4 Lado port — RE-MEDIDO, porque la cifra heredada era de otro vídeo

La ficha decía «el port lo quita en 1 fotograma (f223→f224 medido por winds-fixes-2)». Esa
medición **no es de este vídeo**: el fix de #201 aterrizó en `2efc66c8` el **12-08 14:39** y
`partida-astaroth.mp4` se renderizó el **13-08 10:22**. Re-medido por mí sobre el vídeo de
hoy (12 fps, 749 fotogramas), RMSE del viewport (recorte 700×700+30+30) contra el fotograma
anterior:

| fotograma | RMSE | lectura |
|---|---|---|
| f206-f216 | ~5e-05 | quieto |
| **f217** | **0,0409** | **el Shadowlord desaparece** |
| f218 | 0,0035 | — |
| f219 … f248 | 0,212 alternando | **la sacudida** (30 fotogramas ≈ 2,5 s) |
| f252-f253 | 0,264 | cola |

Y mirando los recortes de la celda: en **f216** está el Shadowlord (figura azul encapuchada);
en **f217** ya está la Llama y **no se pinta ninguna explosión encima**.

⇒ El cardinal «1 fotograma» sobrevive, pero **la causa no es la que se suponía**. El evento
`cell-explosion` SÍ se emite (`use-tools.ts:113`, `bursts:7`). Lo que pasa es que
`removeShadowlordAt` + `map-changed` (`use-tools.ts:129-130`) se aplican **con el mismo
lote**, así que toda la coreografía se pinta sobre un mapa donde el Shadowlord ya no está —
y la explosión, aunque se dibuje, cae sobre una celda que ya muestra la Llama. En el binario
el orden es el inverso: primero los siete fotogramas, luego el estado.

**Límite del instrumento:** `partida-astaroth.mp4` **no tiene pista de audio** (`ffprobe`
sólo lista un stream de vídeo) y lo produce el GRABADOR, no la piel viva. Vale como testigo
del ORDEN y de la DURACIÓN visual; **no** vale como testigo del audio ni, sin más, del
render vivo.

---

## 3. La sincronía: el rugido ES el bucle de dibujo, y el port no tiene el temblor corto

### 3.1 Por qué en 1988 el sonido NO PUEDE durar más que el temblor

`screen_shake_fx` (`ULTIMA.EXE:0x3072`), cuerpo entero. Contador externo `[bp-6] = 8`, y por
pasada **cuatro** bucles de `si` con paso 3 entre 8 y 0xb3 (58 iteraciones cada uno):

```
309b: … call 0x71ca          ; re-blit del viewport con offset (modo 2)
30ac: push 0x13 ; push 0x96
30b4: call 0x2092            ; rand_range(min=19, max=150)
30b8: call 0x22e2            ; set_tone(esa frecuencia)
30bb: add si,3 / cmp si,0xb3 / jle
…  (×4 bucles: 0x71ca ↑, 0xace ↑, 0x7200 ↓, 0xace ↓)
315d: dec word ptr [bp - 6] / jne  ⇒ OCHO pasadas
3168: push 0 ; call 0xc22
316e: call 0x230e            ; ← speaker_off
```

⇒ **8 × 4 × 58 = 1.856 iteraciones**, cada una con un `rand_range` y un `set_tone`.

Las dos piezas que cierran el argumento:

- **`set_tone` (`0x22e2`) NO BLOQUEA.** Su cuerpo entero es: si `[0xa9ce]` (bandera de
  sonido) está activa, `div` de `0x1234de` entre la frecuencia → dos `out 0x42` (el divisor
  del PIT) y `in/or 3/out 0x61` (abrir la compuerta). Y `ret`. **Programa el tono y se va.**
- **La salida apaga el altavoz.** `0x316e: call 0x230e` — y `0x230e` es
  `in al,0x61 / and al,0xfc / out 0x61,al / ret`, el inverso exacto del `or al,3` de
  `set_tone`. 🔴 El disasm lo imprime **desalineado** (`230d: add ah,ah / 230f: popaw …`,
  clase #9); re-decodificado desde `0x230e` los bytes `e4 61 24 fc e6 61 c3` no son ambiguos.

★★ **Por tanto el rugido del temblor no es un sonido que acompañe al temblor: es el temblor.**
Un hilo, una frecuencia nueva por paso de dibujo (aleatoria entre **19 y 150 Hz** — un
retumbo grave), y la compuerta se cierra al salir del bucle. El sonido dura *exactamente* lo
que dura la sacudida, **por construcción, no por convenio**. Y todo lo demás del ritual
—los 920 `tone_sweep` del barrido, los `noise_burst` de cada explosión, la fanfarria— son
bucles de **espera activa** ejecutados en secuencia. No hay mezclador ni canal paralelo.

⇒ **«El temblor acaba y la música sigue mucho más» es estructuralmente imposible en el
original.**

### 3.2 🔴 Y de paso: el temblor CONSUME RNG. `shadowlord-ritual.md:7` es falsa transitivamente

Esa nota dice: «**SIN RNG.** Ni la convocatoria … ni el ritual … tiran el rand del juego …
Ninguno es el RNG (kernel 0x2092). Por eso NO hay escenario de paridad de RNG para esta task».

La primera mitad es cierta **de los `call` directos** de `0x15b4`. La conclusión no lo es:
`screen_shake_fx` **llama a `rand_range`** (`0x2092`, que muta `g_rng_seed` en `0x5420`)
**1.856 veces por invocación**, y el ritual la invoca **tres** (`0x169d`/`0x16a0`/`0x16a3`)
⇒ **5.568 tiradas**.

Dos agravantes:

1. **Se consumen con el sonido APAGADO.** La bandera `[0xa9ce]` se comprueba **dentro** de
   `set_tone`, no antes del `rand_range`. Clase de #94 («la bandera de sonido condiciona
   sólo el tono»).
2. `noise_burst` (`0x223c`) usa un **LFSR propio** en `[0x545c]`, no `g_rng_seed` — así que
   las explosiones **no** mueven el stream. Sólo el temblor.

★★ Es una instancia más de **#33: en el binario dibujar no es sólo-lectura**. Y el sesgo que
la escondió es de manual: se leyó la lista de `call` de la rutina del ritual y ninguno *era*
el RNG — pero **no se siguió el grafo de llamadas**. Familia de
[[leer-en-orden-de-fichero-supone-la-caida]].

**No lo arreglo yo** (no toco el consumo de stream desde un carril de presentación): queda
medido, con su cardinal, para quien abra la ventana.

### 3.3 El port, medido con SU PROPIO catálogo

Corriendo `SFX_CATALOG` (`skin/fiel/speaker.ts`), `quake.ts` y `world-fx.ts` del árbol
`7aad9163` y sumando `seg.ms` — no aritmética a mano:

```
AUDIO   shard-sweep     = 7130,0 ms
        quake           =  930,0 ms
        victory-fanfare = 2092,5 ms
VISUAL  QUAKE_PULSES=8 · periodo 117 ms · 1 invocación = 936 ms
        sacudida del ritual (3 quakes ⇒ 3×8 pulsos) = 2808 ms
        explosión (preDelay 3×55 + 7×60)            =  585 ms
```

Línea de tiempo desde T=0, en el orden que emite `use-tools.ts` y con la regla de encadenado
de `playSegs` (`shard-sweep` y `victory-fanfare` están en el conjunto `BLOCKING`):

```
audio  : shard-sweep [0, 7130] → victory-fanfare [7130, 9223]
audio  : quake-sfx (NO bloqueante) [0, 930]
visual : sacudida [0, 2808] → explosión [2808, 3393]

⇒ VISUAL acaba en 3393 ms · AUDIO acaba en 9223 ms
⇒ COLA DE AUDIO SOLA = 5830 ms (5,83 s)
```

🔴 **CORREGIDO POR MEDICIÓN (16-08, shadowfx-243).** La cifra ~~**5,83 s**~~ era una
PREDICCIÓN derivada del catálogo; el vídeo del usuario, medido a los **60 fps NATIVOS** de
la grabación (`shadowlord-fx-243.md` §1.2), da **6,60 s** de cola real (audio termina en
11,03 s · último movimiento de pantalla en 4,43 s). Sale MÁS que lo predicho porque la
coreografía dura MENOS de lo que este bloque supone. La cifra vieja se deja a la vista, no
se borra: la diferencia predicho↔medido es el dato.
⚠️ Y en el relevo al lead circuló un **6,9 s** intermedio: salió del primer muestreo a
**10 fps**, que aliasa el parpadeo de 60 ms. La cifra buena es **6,60 s**; 6,9 no se cita.

**Ésa es la queja del usuario, con su magnitud.**

★★ **Y el diagnóstico se invierte respecto al enunciado de la ficha.** No es que el temblor
sea corto ni que el audio se pase de largo: **las duraciones del port son razonables y el
audio está en FASE equivocada.** En el binario el barrido de 7,13 s es lo **primero** de
`use_shard_at_flame` (`0x15dd-0x162a`) y **bloquea**; todo lo visual ocurre después. El port
lo arranca en el **mismo instante** que la sacudida, así que la coreografía entera cabe
dentro del barrido y lo que queda sonando son los 3,7 s finales del barrido más los 2,1 s de
la fanfarria.

El port ya tiene la maquinaria del encadenado (`SpeakerSynth.BLOCKING` + `tail`, arreglo de
#206). Lo que le falta es que **los eventos VISUALES consulten esa cola** — hoy sólo el
audio espera al audio. Eso es superficie compartida y hermano directo de **#208**; queda
adjudicado al lead y **no lo toco desde aquí**.

### 3.4 Regalo para #212 — la fanfarria, con sus cuatro llamadas

`sfx_victory_fanfare` = `ULTIMA.EXE:0x4368`, cuerpo leído:

```
436f: si = 3
4377:   tone_sweep(inc 0x11f8=4600, delay 1, count 0x2a30=10800, start 0x12c=300, step 6)
438e:   dec si / jne  ⇒ ×3
4391:   tone_sweep(inc 0x17d4=6100, delay 1, count 0x5460=21600, start 0x12c=300, step 3)
```

Tres llamadas iguales y una cuarta distinta. Eso es el «dos tonos» del reporte del usuario
en #212 — **y el «dos» lo pone `inc`, no el recuento de pasos**.

🔴 **Aquí me equivoqué DOS VECES en la primera redacción, y las dos por lo mismo: leer un
titular sin su ámbito.**

- Escribí que «lo que cambia entre los dos es el timbre, no la nota», razonando desde el
  titular de #201 («el pitch de `tone_sweep` es CONSTANTE»). Eso es cierto **dentro de una
  llamada** y falso **entre dos**.
- Y llamé a la cuarta «la del doble de pasos» como si eso explicara el segundo tono. **No lo
  explica y va medio invertido**: lo que se dobla es `count` (10800→21600 = la DURACIÓN) y
  `step` se PARTE por la mitad (6→3). Ninguno de los dos produce un tono distinto.

Lo que produce los dos tonos es `inc`, y el pitch es `incToHz(inc)`. Calculado con el propio
`incToHz` del port:

| llamada | `inc` | pitch | duración | `step` (duty) |
|---|---|---|---|---|
| 0x4377 ×3 | `0x11f8` | **1811,4 Hz** | 419 ms c/u | 6 |
| 0x4391 ×1 | `0x17d4` | **2402,0 Hz** | 837 ms | 3 |

⇒ son **DOS PITCHES**, y el segundo además dura el doble. Lo confirma por su cuenta el carril
de #212, cerrada mientras yo escribía esto (`2a44c759`): **dos lecturas independientes del
mismo cuerpo, y los cuatro `tone_sweep` coinciden exactos** — control real, no eco. Y el error
que yo repetí es exactamente el que `sfx-catalog.md` §3.5 llevaba escrito (confundir `step`
con `inc`) y que #212 corrigió con aserto.

★★ **Un invariante con ÁMBITO («el pitch es constante») copiado sin su ámbito («por llamada»)
invierte la conclusión.** Es la misma forma de error que §1.2 —donde el número coincide en dos
bancos— en otro sitio: en los dos casos lo que falla no es el dato, es el alcance sobre el que
se afirma.

---

## 4. 🔴 El testigo en DOSBox: NO OBTENIDO, y no lo presento como negativo

El encargo pedía capturar el ritual en una instancia headless propia. **No lo he hecho**, y
lo declaro en vez de sustituirlo por una inferencia:

- Para **(1)** la derivación es una enumeración cerrada (§1.1) y existe además un testigo
  previo, independiente y ajeno a este acta: el vídeo-C citado en `render/tileanim.ts:41-47`.
  Un testigo nuevo confirmaría, no decidiría.
- Para **(3)** el veredicto es estructural (§3.1): un testigo no puede refutar que un solo
  hilo con `speaker_off` a la salida no deja cola.
- Para **(2)** el testigo **sí decidiría** el único cabo abierto: si el sprite del Shadowlord
  sigue visible bajo las siete explosiones (§2.3). **Ése es el testigo que falta.**

🔴 **Corrección de este §4 respecto a su primera redacción: «no disponible» habría sido
FALSO.** `dosbox-x` **está instalado** (`/Applications/dosbox-x.app/Contents/MacOS/dosbox-x`,
y `oracle.py` ya lo resuelve), y **el arranque del oráculo se probó y FUNCIONA en esta máquina**
(`oracle.available() = True`; `oracle.boot()` completó — el probe sólo falló después, al pedir
yo un atributo con el nombre equivocado). Así que el testigo no está bloqueado por el entorno.
Lo que falta es el **estado de partida**: no hay en `original/u5/saves-lib/` ningún escenario
con la party en una Llama, con el shard y el Shadowlord convocado, y fabricarlo es el
sub-proyecto que `trama-flags-227` §5.3 intentó dos veces sin obtenerlo.

**Receta exacta para quien lo retome** (no es una idea, es el experimento que cierra §2.3):
sembrar el estado con `Session.write_mem_gameseg` sobre las direcciones ya derivadas
—`0x57b6+idx` shard, `0x58c8+idx` locs, `0x58cb` convocado, la posición (ver la corrección de
abajo) y la entrada de tile `0xFC` en la tabla de objetos `0x5c5a`—, armar `arm_code_bp` en el
cuerpo de `explosion_fx_at_cell` (`ULTIMA.EXE:0x3522`), y en cada uno de los **siete** disparos
leer la tabla de objetos. **Si el objeto `0xFC` sigue ahí en los siete, el sprite está debajo y
el orden del port es la divergencia; si desaparece antes, lo hacen los dos thunks de §2.3.** Es
una lectura de RAM, no de píxeles: no depende de la captura ni de la paleta.

🔴 **CORRECCIÓN DE ESTA RECETA (14-08, al ejecutarla): la posición NO se siembra moviendo al
party.** Esta receta decía «party x/y/location/floor» y quien la siga al pie de la letra
teletransporta al grupo a la sala de la Llama escribiendo las globales — pero **escribir
`g_location` no recarga el mapa**: deja el mapa cargado sin relación con la localización que
declaran las globales, y todo lo que lea terreno a partir de ahí (el `viewport_redraw` de cada
explosión, entre otros) trabaja sobre un estado que no existe en ninguna partida real.
Lo que hace el testigo, y es lo que hay que copiar: **se mueven las CUATRO TABLAS de posición
del ritual** —`DS 0x4882` (X), `0x4886` (Y), `0x488a` (loc), `0x488e` (piso), indexadas por
`shardIdx`— para que apunten a donde el party YA está. El gate de `CAST.OVL:0x1635-0x1650`
compara las globales **CONTRA** esas tablas, así que mover la tabla y mover al party son
equivalentes **PARA EL GATE** — y sólo para él: la equivalencia va acotada a propósito, porque
el party no se mueve y el mapa cargado sigue siendo coherente consigo mismo.
⚠ Si el veredicto sale RARO (ni sprite-debajo limpio ni desaparición limpia), la primera
hipótesis rival es que **otro lector de `0x4882-0x488f` participe en el ritual** (epicentro del
temblor, celda de las explosiones): censar sus lectores ANTES de adjudicar un veredicto extraño
a la mecánica. Herramienta ejecutable: `re/tools/shadowlord_witness_probe.py`.

### 4.1 🔴 PRIMERA CORRIDA DEL TESTIGO (14-08): **NEGATIVA, y el fallo es del INSTRUMENTO**

El testigo se construyó y **corrió entero** contra el oráculo. **NO produjo veredicto**: el
ritual no llegó a ejecutarse. Se registra en vez de re-intentarlo en silencio, porque el modo
de fallo es reutilizable.

Lo que la corrida SÍ acredita (los dos controles pasaron):

| control | resultado |
|---|---|
| NEGATIVO — tabla de objetos antes de sembrar | **ningún** 0xFC ✓ |
| POSITIVO — tras sembrar | 0xFC en ranura **2**: `FC FC 0F 19 FF 00 00 00` (x=15, y=25, piso=0xFF) ✓ |

Y lo que delata el fallo — el estado DESPUÉS de 900 pausas de reloj:

```
disparos observados: 0 de 7      (el bucle agotó su presupuesto de 900 ticks)
g_shards[0]           = 0x01     ← el shard NO se consumió  (0x1710 nunca corrió)
g_shadowlord_locs[0]  = 0x11     ← NO es 0xFF               (0x170b nunca corrió)
ranura 2 = FC FF 0F 19 FF 00 30 00   ← el objeto SIGUE ahí, pero +1 y +6 cambiados
```

⇒ el ritual **no alcanzó ni la rama de destrucción ni las explosiones**.

🔴 **La causa es el PICKER, y es una trampa de instrumento que merece nombre.** La sonda
derivaba las pulsaciones leyendo la tabla extendida de poseídos (`0xB9EE`) — que dio TRECE
objetos: `00 02 03 05 06 08 09 0A 0E 0F 11 1D 23`. El shard `0x1D` es el **duodécimo**, así
que la sonda pulsó `'2'` **once veces**. Eso da por supuesto que el cursor arranca sobre el
**primer** poseído; pero `item_picker_loop` **ancla el cursor a la fila 4** y desliza la lista
por debajo (`asm-town-zstats-acta.md` §53.1). Si el cursor no arranca en la fila 1, once
pulsaciones **se pasan del final** y la lista topa en el ÚLTIMO poseído, que aquí es
`0x23` = el **reloj de bolsillo** — cuyo handler (`CAST.OVL:0x1ad4`) imprime la hora y vuelve.
Un objeto usado, ningún efecto, ningún cambio de estado: exactamente lo observado.
★★ **Derivar la NAVEGACIÓN no es derivar la SELECCIÓN.** La tabla de poseídos se leyó bien; lo
que estaba sin medir era *dónde empieza el cursor*, y eso convierte una cuenta correcta en una
elección equivocada sin que nada avise.

**Remedio adoptado (elimina la clase entera, no el caso):** poner a CERO todas las fuentes de
la tabla extendida menos el shard —scrolls `0x5820+i`, pociones `0x5828+i`, piedras lunares
`0x5840+i`, `0x57B0/B1/B3/B4/B5` y `0x57BA..0x57BF`, leídas del cuerpo de
`build_extended_item_table` (ZSTATS.OVL:0x099a-0x0a35)— para que el picker tenga **UNA SOLA
FILA**. Con una fila no hay navegación que derivar: ENTER elige lo único que hay.

**Otra hipótesis que la corrida ya DESCARTA**, y conviene dejarla cerrada: no es que el
overlay recargue las tablas. Las cuatro viven en DATA.OVL (comprobado sobre el fichero, con la
fórmula `fileoff = DS+0x10`: `4892:0f0f0f · 4896:090310 · 489A:1e1f20 · 489E:0201ff`), que se
carga una vez y no se repone por comando.

★★ Siguiendo la lección de `trama-flags-227.md` §5.3: **un testigo no intentado se declara
NO OBTENIDO, no se convierte en «no hacía falta».** Aquí hace falta para un cabo concreto y
está nombrado.

---

## 5. Qué debería hacer el port

1. **(2) — el orden.** `removeShadowlordAt` + `map-changed` deben ocurrir **después** de que
   la coreografía se haya pintado, no antes de que empiece.
   🔴 **MEDIDO: NO es local a `use-tools.ts`, aunque lo parezca — y no basta con mover la
   línea 129 más abajo en la función.** `removeShadowlordAt` (`use-tools.ts:477`, llamador
   único en :129) **muta `ctx.state.worldObjects` de forma SÍNCRONA**, y la piel pinta desde el
   snapshot del estado ya commiteado; los `GameEvent` que devuelve `useShard` se consumen
   DESPUÉS, con la retirada ya hecha. Reordenar dentro del array de eventos no cambia nada:
   lo que hay que diferir es la MUTACIÓN, no la posición del evento.
   Las dos formas reales, las dos cruzan superficie:
   - **(i)** que el evento `cell-explosion` lleve el tile que debe seguir viéndose bajo la
     ráfaga, y lo pinte `WorldFxLayer` en los fotogramas en que no blitea (ya alterna:
     `world-fx.ts:110-111`, «el original re-pinta entre blits»);
   - **(ii)** un mecanismo de mutación diferida en el core, que hoy no existe (`pauseUnits`
     es pacing de mensajes, no aplazamiento de estado).
   ⇒ **Queda sin implementar y con la medición escrita.** La premisa «una línea local» era
   mía y del encargo; medirla la refuta.
2. **(3) — la fase.** La coreografía visual debe esperar al `tail` de los cues bloqueantes,
   igual que ya lo hace el audio entre sí. **Toca el speaker ⇒ adjudicado a #208.**
   > ✅ Las DOS direcciones cerradas: la visual la cableó #243 (`planVisualPhase`) y la de
   > audio el carril fix-208 (19-08, `planTurnPhase.sfxLeadMs` en `skin/turn-phase.ts`).
   > La advertencia de abajo sigue VIVA: la puerta del lado del JUEGO no entró (es #212).
   🔴 Y una advertencia PARA #208, derivada por el carril de #212 y relayada aquí porque
   afecta a lo que ahí se implemente: **el encadenado de `playSegs` NO produce la pausa del
   original.** `BLOCKING` encadena audio contra audio en el reloj del `AudioContext`, pero el
   bucle del juego sigue aceptando teclas. En 1988 la pausa sale de que la fanfarria **bloquea
   el hilo** y de que al terminar el binario **VACÍA el búfer de teclado de la BIOS**
   (`COMBAT 0x0d05` → `ULTIMA.EXE:0x1b16`: cabeza=cola=0x1e — lo tecleado durante la fanfarria
   **se tira**, no se drena). ⇒ la fase del ritual necesitará **también** una puerta del lado
   del JUEGO, no sólo el encadenado del lado del audio.
3. **(1) — nada que arreglar.** El modelo ya es fiel. Sí conviene una guarda de que los
   cuatro frames del Shadowlord siguen siendo un grupo `perTurn` (§6), porque hoy eso
   depende de que `TILE_INFO` no cambie y nadie lo vigila.
4. **Comentario RANCIO a retirar** — `use-tools.ts:131-147`. El bloque «LO QUE FALTA DE LA
   COREOGRAFÍA, Y POR QUÉ NO ESTÁ» enumera pausa, sacudida ×3 y explosión ×7 como ausentes.
   **Las líneas 106-113 del mismo fichero las emiten.** Quedó del estado anterior al fix de
   #201 y contradice a su propio código veinte líneas más arriba.

## 6. Testigos y guardas de este acta

- `test_shadowlord_anim_243.py` / la guarda equivalente: el grupo de animación del sprite
  `0x1FC` es de **tamaño 4**, base **508**, y **`perTurn`** — con mutante: si alguien mueve
  `SPRITE_BANK` o marca el grupo como reloj-de-render, la guarda cae.
- La enumeración del dominio del reloj (§1.1) se **re-extrae del disasm** en vez de
  transcribirse, para que no pueda quedar rancia si `0x44b8` se regenera.

## 7. Ventana de RNG

**Ninguna por parte de este acta**: no toco código que consuma RNG. Pero §3.2 **abre** una:
quien implemente la fidelidad del temblor tiene que decidir qué hace con las 5.568 tiradas
por ritual, y eso mueve el stream de cualquier medición que cruce la escena.

## 8. Limitaciones declaradas

- **El orden objeto↔explosión en el original NO está establecido** (§2.3): los thunks
  `0xbb9e`/`0xbb92` no resueltos, clase #81. Lo que sí está: las siete explosiones y que los
  escritos de estado van después de ellas.
- **El testigo en DOSBox no se intentó** (§4).
- El vídeo del port **no lleva audio** y lo produce el grabador, no la piel viva (§2.4): las
  cifras de audio del §3.3 salen del **catálogo del port**, no de una grabación.
- La cifra `1.856` de §3.1 es aritmética sobre cotas literales leídas
  (8 × 4 × ⌊(0xb3−8)/3⌋+1); **no** la he contado ejecutando.
- `shadowlord-ritual.md` queda con su §«SIN RNG» **refutada por este acta** (§3.2). No la
  edito: es de otro carril y la corrección va aquí, nombrada.
