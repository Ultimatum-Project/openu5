# `ULTIMA.EXE:0x4f7c advance_clock` — el reloj, entero

`[0x4f7c, 0x51a0)` = **548 B declarados = 548 B reales**. `ret 2` en `0x519c` + `nop` de
relleno. Línea EN `0x4f7c`. **No es contenedor**, y el detector se corrió **sobre la
IMAGEN** (`fileoff = start + 0x800`), no sobre el listado: arranca con `55 8b ec`, **cero**
prólogos internos, y el último `ret` cierra el span. *(El listado no puede ver lo que le
falta; para una fila decapitada también diría «ningún prólogo».)*

Prioridad del lead: *el reloj toca a TODA medición de paridad de la casa, así que una
lectura apurada aquí no da un error contenido — da una base falsa para todo lo demás.*

---

## 1. 🔴 CONSUME RNG, y con REINTENTO SIN TOPE

`0x500c` `call 0x2092 rand_range` con `push 1; push 8` ⇒ en orden de push `(min, max)` =
**1..8**. Vive **dentro del bloque de CAMBIO DE DÍA** (`0x4ff5-0x504f`), que sólo corre
cuando la hora envuelve:

```
4ff5  [bp-4] = 0                      ; índice de slot, 3 slots
4ffa  si byte[bx+0x58c8] >= 0x80  -> saltar este slot (ya fijado)
5004  di = rand_range(min=1, max=8)   ; ← LA TIRADA
5011  si di == g_location  -> di = 0
501c  bucle si=0..2: si byte[si+0x58c8] == cx -> cx = 0   ; anti-colisión
5037  or di,di / je 0x5004            ; ← SI QUEDÓ 0, VUELVE A TIRAR (sin tope)
503e  byte[bx+0x58c8] = di
5048  siguiente slot, hasta 3
```

⇒ **el número de tiradas es ≥ 3 y NO tiene cota superior**, y depende de `g_location` y de
los valores ya escritos. Es la misma familia que la ficha **#31** (rechazo que reinicia sin
tope, consumo dependiente del estado). Para paridad esto importa el doble: **el cambio de
día lo cruza cualquier partida**, así que el desalineamiento no es de un subsistema, es
global.

⚠️ **No firmo qué SON los 3 slots de `0x58c8`.** Los valores son 1..8 y se evitan entre sí
y con `g_location`, lo que sugiere destinos/localizaciones distintas — pero **sugerir no es
medir**, y no he abierto a sus consumidores.

## 2. Dos hechizos de tiempo, con efectos DISTINTOS

```
4f8d  g_time_spell == 0x51  ->  sar [bp+4],1   y si queda 0, se fuerza a 1
4fa6  g_time_spell == 0x54  ->  SALTA la suma entera
```

- **`0x51` ⇒ el tiempo corre a la MITAD** (con suelo de 1 minuto: nunca se congela del todo).
- **`0x54` ⇒ el reloj NO avanza** — y ojo, salta la suma **y los dos decrementos** de
  `byte_sub_saturating` de `0x4fb4`/`0x4fbe`, así que **tampoco se consumen antorcha ni luz**.

## 3. 🔴 Con `delta == 0` se salta el avance pero **NO** el recálculo de luz

`0x4f88` salta a **`0x50a1`**, que es exactamente la entrada del bloque de iluminación. Un
clon que haga `if (delta === 0) return` pierde la actualización de luz. Es la clase de
divergencia que no rompe ningún test y se ve en pantalla.

## 4. La cascada, y el calendario que cuadra solo

```
minuto > 0x3b  ->  −0x3c · byte_sub_saturating(0x588c, 1) · inc g_hour
hora   > 0x17  ->  hora = 0 · BLOQUE DE DÍA (§1) · inc g_day
día    > 0x1c  ->  [0x585a]=[0x5859]=[0x5858]=[0x57b2]=0 · g_day=1 · [0x5959]=0
                   + roster 0x55bf..0x57bf stride 0x20: inc byte[si] con tope 0x19
mes    > 0x0d  ->  mes = 1 · inc g_year
```

**28 días × 13 meses = 364.** El calendario britanniano sale de las dos cotas y **cuadra
solo** — es el ancla legible que valida que estoy leyendo los campos correctos, no una
coincidencia numérica.

## 5. La luz: dos rampas que son la MISMA tabla, una al revés

```
50a1  g_light_level >= 0x33  ->  no toca nada
50b3  g_location==0x19 · g_floor>0x7f · hora<5 · hora>0x13  ->  nivel = 2
50d6  hora == 5     ->  bx = g_minute/10          ; AMANECER
50f4  hora == 0x13  ->  bx = (0x3b − g_minute)/10 ; ANOCHECER = índice INVERTIDO
50ea  nivel = byte[bx + 0x6a80]
5110  resto         ->  nivel = 0x32
```

Tabla volcada de `DATA.OVL` (DS `0x6a80` ⇒ fileoff `+0x10`): **`02 05 0a 14 22 31`** — seis
pasos de diez minutos, monótona, y el último (`0x31` = 49) justo por debajo del día pleno
(`0x32` = 50). **La misma tabla sirve para el alba y para el ocaso porque el índice del
ocaso está espejado**; quien porte esto con dos tablas está inventando una.

**Y es más fuerte que «la misma tabla»: es el MISMO SITIO DE CARGA.** La rama del ocaso
no tiene `mov al,[bx+0x6a80]` propio — calcula su índice y hace `510e: jmp 0x50ea`, que
salta DENTRO de la rama del amanecer para compartir esa instrucción exacta. En el binario
no existe un segundo `mov` sobre esa tabla, así que no hay dónde meter una segunda tabla
aunque uno quisiera. (Detalle menor: el alba divide con `div cl` de 8 bits y el ocaso con
`div cx` de 16; el resultado coincide en todo el rango 0..59.)

## 5-bis. PORT-CHECK — el clon tiene UNA tabla, y espejada igual ✅

Comprobado abriendo el fichero, no por grep (carril `re/font-luz`, 07-08). El bloque de
luz **NO está dentro de `advanceClock`**: vive en `lightLevel()`, una función exportada
aparte del mismo fichero — buscarlo dentro de `advanceClock` es la forma de no
encontrarlo.

| binario | clon | cita |
|---|---|---|
| tabla `DS 0x6a80` = `02 05 0a 14 22 31` | `SUNRISE_LIGHT_RAMP = [2, 5, 10, 20, 34, 49]` | `game/src/core/world/survival.ts:122` |
| alba `bx = g_minute/10` (0x50dd) | `SUNRISE_LIGHT_RAMP[Math.floor(minute / 10)]` | `game/src/core/world/survival.ts:522` |
| ocaso `bx = (0x3b − g_minute)/10` (0x50fb) | `SUNRISE_LIGHT_RAMP[Math.floor((59 - minute) / 10)]` | `game/src/core/world/survival.ts:524` |
| noche `hora<5 ∨ hora>0x13` ⇒ 2 (0x50c1/0x50c8) | `hour < 5 \|\| hour > 19` ⇒ `2` | `game/src/core/world/survival.ts:519` |
| día ⇒ `0x32` (0x5110) · suelos `0x12` / `0x0a` | `0x32` · `0x12` / `0x0a` | `game/src/core/world/survival.ts:526,528,529` |

**Veredicto: UNA sola tabla, y el ocaso la indexa espejado. Nadie ha inventado una
segunda.** Los seis valores y los dos índices son literalmente los del binario. La tabla
se re-volcó de la imagen de EA como control independiente del número que circula por las
notas: `DATA.OVL` fileoff `0x6a90` ⇒ `02 05 0a 14 22 31`. ✅

⚠️ **Lo único flojo es el NOMBRE, y es justo el que induce el error que esta sección
existe para evitar.** La constante se llama `SUNRISE_LIGHT_RAMP` y su docstring
(`survival.ts:121`) dice sólo «Rampa de luz del **amanecer** (5:00-5:59)», sin mencionar
que la línea 524 la usa también para el ocaso. Quien busque la rampa del atardecer por
nombre (`SUNSET`, `DUSK`) no encuentra nada y **añade una tabla**. El código es fiel; la
etiqueta invita a romperlo. Renombre sugerido (no aplicado — este carril no toca
`game/src`): `DAY_TWILIGHT_LIGHT_RAMP`, con la docstring diciendo las dos direcciones.

Suelos, después: `g_light_spell_mins != 0` fuerza mínimo `0x12`; `g_torch_mins != 0` fuerza
mínimo `0x0a`. Y son **los mismos dos contadores** que `0x4fb4`/`0x4fbe` decrementan con
`byte_sub_saturating(0x58a7 / 0x58a6, delta)` — o sea, el reloj los gasta y los lee en la
misma pasada. Si el nivel cambió respecto al de entrada (`[bp-8]`) ⇒ `g_unk_24e6 = 1`.

## 6. Cambio de hora

`0x514a`: si `g_hour != g_prev_hour` (guardado en `0x4fa0`, **antes** de cualquier suma):

- si `g_location < 0x21` **y** `g_floor < 0x80` ⇒ `draw_sky_strip` (`0x4a84`);
- reloj de 12 h en `[0x5884]`: hora 0 ⇒ **12** · hora > 12 ⇒ hora − 12 · si no ⇒ hora.

Y al final, si `0 < g_location < 0x21` ⇒ `clock_driver_notify` (`0x71aa`).

---

## 7. Lo que NO he leído YO — con el estado del ledger al lado

| rutina | ¿la he leído YO? | ledger |
|---|---|---|
| `ULTIMA.EXE:0x3f36` `byte_sub_saturating` | no | ✅ `verified=true` |
| `ULTIMA.EXE:0x2092` `rand_range` | sí, en otro carril de esta noche | ✅ `verified=true` |
| `ULTIMA.EXE:0x2900` `draw_status_panel` | no | ✅ `verified=true` |
| `ULTIMA.EXE:0x4a84` `draw_sky_strip` | no | ✅ `verified=true` |
| `ULTIMA.EXE:0x71aa` `clock_driver_notify` | no | ✅ `verified=true` |

**Ninguna de las cinco la he abierto salvo `rand_range`**, y ninguna afirmación de arriba
depende de sus cuerpos: lo medido es **qué se les pasa y desde dónde**.

**Sin grado TESTIGO**: no he corrido el original bajo DOSBox para esta fila.
