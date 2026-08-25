# ACTA #220 — la escritura de vuelta es OBSERVABLE: se DECLARA en el docblock y se abre tarjeta de mecánica

Pieza 2 del encargo triple. Rama `re/deriv-219`, base `67696ac6`; `main` al abrir la pieza:
`3dad9615`. Precondición: `re/notes/deriv-219-acta.md` (pieza 1, commit `17705ea9`).

**Titular**: la tarjeta ofrecía dos salidas —«inobservable ⇒ declararla» y «observable ⇒
tarjeta»— y el binario elige la segunda. Pero la clase peligrosa que la tarjeta nombra
(«una omisión que nadie ha escrito») **no se arregla con la tarjeta**: se arregla
escribiéndola. Así que se han hecho **las dos cosas**: la omisión queda **declarada con su
derivación** en el docblock de `visibility.ts` (prosa, cero lógica tocada) y la **decisión
de portarla o no** queda en tarjeta de mecánica con relevo.

---

## 1. Por qué NO es benigna: el veredicto de la pieza 1 en una línea

`0x5d0a` **sí** repone `g_vis_buffer` (121 celdas a 0xFF, 5d17-5d31), pero **sólo corre en
la rama de recálculo**. El repintado tiene **dos** ramas, repartidas por `g_unk_24e6`
(595e), y la otra —la incremental, 5992-59f4— recorre las mismas 121 celdas y **sólo
reescribe las que valen CERO** (59ad). Los ceros los pone el pase de luces (5b89) en el
**mismo fotograma**, 60 bytes antes. ⇒ **consumidor vivo**. Derivación completa en
`deriv-219-acta.md` §5-§7.

## 2. Lo que el port hace hoy, dicho sin adornos

`computeVisibleWindow` es una **función pura** de `(lightLevel, terrain)`: recalcula
siempre, no guarda estado entre fotogramas y devuelve una máscara booleana. El original
mantiene un **búfer de tiles con estado**, lo recalcula entero sólo cuando la bandera lo
pide, y en los demás fotogramas hace un refresco parcial guiado por las marcas del pase de
luces.

No son la misma forma de cálculo. Y la diferencia **no** es «el port se olvidó de una
línea»: es que el port modela el **resultado en régimen de recálculo** y el original tiene
**dos regímenes**.

## 3. Dirección de la divergencia — medida, no supuesta

En los fotogramas incrementales el original **revela algunas celdas más** (las marcadas a
cero se rellenan con terreno crudo, sin test de radio ni de opacidad). El port, que no las
revela, **se queda corto**. Eso respeta la regla dura #2 (nunca revelar más que el
original) y es la razón por la que esto **no es un bug de fidelidad urgente** sino una
divergencia declarada.

★ Ojo con el sentido de la lectura: **«conservador» no quiere decir «correcto»**. Quiere
decir que el error tiene signo conocido. Quien porte esto no debe leer §3 como una
absolución.

### 🔴 Addendum del 14-08 (luz-antorchas-252) — lo que se refuta y lo que NO

Lo escrito arriba sobre ESTE mecanismo (los fotogramas incrementales) sigue en pie y no se
toca: ahí el original revela de más y el port se queda corto. Lo que queda **REFUTADO POR
MEDICIÓN** es la lectura GLOBAL que el paréntesis «(nunca revelar más que el original)»
invita a hacer, y que viajó desde aquí al docblock de `visibility.ts` como propiedad del
port entero. Careado contra un modelo del pase de la party transcrito de 0x5A28
(`game/tests/visibility-original-referencia.test.ts`, con sus controles):

- El port revelaba **hasta 3824 celdas·posición MÁS** que el original (sótano de LB, luz 2;
  Cove 3683) — y eso **antes** de #252, o sea que la generalización nunca fue cierta.
- La causa es OTRA omisión, hermana de las dos de esta acta y con el signo AL REVÉS: fuera
  del radio de la party, 5c29 exige que el **PADRE** de la celda esté en 0xAD14, y el port
  acepta de puente cualquier celda del disco. Ficha **#256**, a decidir junto con §2/§3.

⇒ Regla de uso de esta acta: §3 describe el signo del error **de su mecanismo**, no del
port. Una dirección declarada sólo cubre lo que se midió para declararla.

## 4. Qué se ha escrito en `visibility.ts` (prosa; cero lógica)

1. **El selector de modo**, que #189 §7.3 dejó derivado y listo: `[bp-0x20e]` no se pasa,
   nace a cero (5a48) y sube a uno (5a62) sólo con el centinela `0xff91` (5a57), que además
   se sustituye por cero (5a5d). Con eso los dos `cmp` del cuerpo dejan de parecer
   arbitrarios. Y el **argumento muerto** `[bp+6]=32`, con el `shl` de 5 cableado que sí
   manda.
2. **El nombre de `0xAD14` corregido**: no es «buffer de fuentes de luz» (eso nombra la
   entrada), su contenido son las **celdas iluminadas** del chunk 32×32, con la convención
   «cero = no iluminada» que fija el post-pase 5f65-5f78. Más los **dos dueños excluyentes
   por fase** de #219, con sus tres citas.
3. **La reciprocidad**, que el docblock omitía: la consulta de 5c19-5c45 va en un sentido y
   la escritura de 5b89 en el otro.
4. **Bloque NO MODELADO Y DECLARADO** (apunta a la **tarjeta #225**) con (a) la escritura
   de vuelta y su función real
   (marca de visitado por emisor, con la re-siembra de 5f23-5f3d que la hace legible), (b)
   el protocolo de dos ramas que la vuelve observable, y la dirección de la divergencia.
5. **Recorte adicional, ahora medido**: el barrido de emisores del original es de **chunk
   entero 32×32** (5e72-5ee9), no de la ventana 11×11 — así que la aproximación que el port
   ya declaraba deja fuera emisores de hasta 3 casillas por fuera cuyo halo sí entraría.

## 5. Lo que NO se ha hecho, y por qué

- **No se ha portado nada.** Modelar (a) exige portar (b) —el protocolo de dos ramas y el
  estado del búfer entre fotogramas—, y eso es un cambio de **arquitectura de render**, no
  de docblock. Carril de derivación: se adjudica, no se arregla.
- **No hay testigo.** La predicción P1 de la pieza 1 (parche revelado con forma de halo en
  coordenadas locales) **no** se ha visto en DOSBox. Va en la tarjeta como precondición.
- **No se ha tocado la lógica de `computeVisibleWindow`**, ni sus aproximaciones vigentes.

## 6. ★ ALCANCE OBSERVABLE — qué se ve mal, y cuándo (encargo del lead)

Hasta aquí «observable» sólo quería decir «tiene consumidor». El lead pidió la otra mitad:
**cuándo** ocurre y **qué** se vería. Las dos se derivan, y no hace falta oráculo para
acotarlas.

### 6.1 Cuándo: desde el SEGUNDO repintado de cualquier secuencia multi-fotograma

La bandera `g_unk_24e6` decide la rama, y el repintado **la consume** (`0x598a mov byte
ptr [g_unk_24e6], 0`). Con eso, dentro de una misma secuencia de repintados **sólo el
primero** puede tomar la rama de recálculo: **todos los siguientes van por la
incremental**, hasta que algún escritor la vuelva a poner.

Y hay secuencias así, no es un caso rebuscado. `0x5910` tiene **siete** llamadores; dos de
ellos son **bucles de repintado** identificados en el ledger:

| rutina | offset | qué hace |
|---|---|---|
| `fx_tile_fizzle_in` | 0x1068 | `di` recorre 0..0x100 (dos `inc di` por vuelta) y **cada 8 vueltas** llama a `0x5910` en `0x10d0` (gate `cmp [g_location], 0x42` en 0x10bb) ⇒ hasta **32 repintados** por llamada, con `lcall [g_snd_driver_fn]` intercalado |
| `beep_ticks` | 0x3ae6 | `si = [bp+4]` y por cada tick: `0x3b07 call 0x5910` + `0x3b0e call 0x20fa` ⇒ **un repintado por tick**, `n` ticks |

⇒ en un `fx_tile_fizzle_in` completo, **31 de los 32 fotogramas** pasan por la rama
incremental. Y `0x48fe` llama a `fx_tile_fizzle_in(5, 5, 0xdc)` justo después de poner
`g_transport_tile = 0x16` y justo antes de `beep_ticks(1)` — es la **entrada de moongate**.

### 6.2 Qué: un parche de terreno crudo con la forma del halo del ÚLTIMO emisor, estampado en la casilla de la PARTY

En cada repintado incremental, `0x59ad-0x59dc` reescribe **con terreno crudo** —sin test de
radio y sin test de opacidad— las celdas que valen cero; y las que valen cero son las que
el flood del **último** emisor **examinó** (superconjunto de las iluminadas: incluye el
perímetro que miró y descartó por radio). Con dos consecuencias geométricas derivadas:

1. **La posición está mal.** El índice del borrado no lleva el origen (`0x5b83-0x5b89` usa
   `(a<<5)+b`), y el flood siembra su semilla en el par **(5,5)** (`0x5a69-0x5a82`), que es
   el emisor. En la ventana de la party, `(5,5)` es **la casilla de la party**. ⇒ el halo se
   estampa **como si el emisor estuviera encima del Avatar**, con la forma que le dio la
   geometría de **otro sitio** del chunk.
2. **No se borra.** La rama incremental nunca vuelve a poner una celda a 0xFF, así que lo
   revelado **persiste** —y se acumula, fotograma a fotograma— hasta el siguiente
   recálculo.

★ **Y el caso que más se repite es justo el que NO se ve**, así que conviene decirlo antes
de que alguien lo busque y no lo encuentre: en la entrada de moongate el emisor es el tile
`0xDC` —que está en `EMITTER_TILES`— colocado en `(5,5)`, o sea **en la casilla de la
party**, con lo que para ese emisor el descentrado es un no-op y el parche cae donde la luz
está de verdad. El artefacto necesita que el **último** emisor del barrido sea **otro**: el
barrido es row-major sobre el chunk 32×32 (`0x5e72-0x5ee9`), así que el último es el de
**mayor y** y, dentro de esa fila, **mayor x**. Un candelabro al sureste de la moongate
basta.

### 6.3 Cota honesta del alcance

- **Sólo en fase `g_location < 0x80`**: la pasada de luces está gateada en `0x5947`, así que
  en mazmorra y arena no hay ceros que revelar.
- **Sólo con al menos un emisor en el chunk**: sin emisores no hay flood de luces y el
  bucle de `0x5eeb` no entra (`0x5ef7 jle 0x5f65`).
- **Y sólo mientras `g_unk_58a4` deje pintar**: la cabeza del repintado (`0x5929`) y la de
  `beep_ticks` (`0x3aed`) comprueban esa misma global antes de nada.

### 6.4 Lo que sigue necesitando testigo

Que el parche se **vea** en pantalla. La cadena está derivada pero el consumidor final del
búfer es `compose_world_view` (`0x5394`), y no he leído si algo aguas abajo vuelve a filtrar
por la máscara de radio antes de pintar. Eso convierte P1 en una predicción **falsable de
verdad** en vez de una certeza: si el compositor filtra, el parche existe en memoria y no
llega al píxel. Pre-registrado así en la tarjeta #225.

## 7. Cabo NUEVO que sale del censo de la bandera (no es de esta tarjeta)

Censando `g_unk_24e6` por los tres canales (símbolo, hex con prefijo, desplazamiento
negativo) sobre los 18 `.asm`: **58 accesos, y exactamente UN lector** — el `cmp byte ptr
[g_unk_24e6], 0` de `0x595e`, más el `mov ..., 0` de `0x598a` que lo limpia. Los otros 56
son escrituras, en dos formas que **el único lector no puede distinguir**: 33 × `or byte
ptr [g_unk_24e6], 2` (el patrón `Board|=2` que cita el ledger) y 21 × `mov byte ptr
[g_unk_24e6], 1` — que además **pisan el bit 1**. El ledger ficha la global como «flag
turno consumido […] el dispatcher cobra el turno», y ese consumidor **no tiene sitio en el
corpus** por estos tres canales.

Control de instrumento: el canal hex se midió con `0x24e6` **con prefijo** (un `grep 24e6`
a secas casa también `g_unk_24e6` y habría dado una población falsamente «independiente» —
la misma), con control positivo sobre `0x5c5a`, que sí aparece en hex en varios ficheros.
Lo que **no** cierra: un lector por PUNTERO. Tarjeta aparte, no la toco.

## 8. Gates

`tsc --noEmit` EXIT 0 · `vitest run` EXIT 0 (309 ficheros, 3947 pasados, 1 saltado) ·
`seed_gate` EXIT 0 · `pytest test_frontier + test_genero + test_cita_segmento` EXIT 0 ·
`genero` EXIT 0 · `cita_pegajosa_forma` EXIT 0 · `cita_pegajosa_atribucion` EXIT 0.
Conflicto medido ANTES de tocar `game/src`: **cero ramas vivas** tocan
`game/src/core/world/visibility.ts` respecto a `main` (último commit del fichero en main:
`010d0fb6`, 2026-07-22).
