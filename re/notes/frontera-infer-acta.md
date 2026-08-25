# Frontera ASM sin INFER ni sin-ID — acta del carril `frontera-infer` (2026-07-30)

Frente 2 del goal. Encargo: censar la población de frontera con grado INFER o sin ID, y
cerrarla de mayor a menor alcanzabilidad con lectura de CUERPO ENTERO.

**Censo anclado a `main` = `f41df3f6a9c5957283cb23900f6a11d6c5a5669e`.** Toda cifra de
abajo es de ese árbol; sin el SHA una cifra de censo es una foto, no una medida.

---

## 1. CENSO INICIAL — y la primera corrección es al enunciado del encargo

`re/ledger/frontier.json`: **885 rutinas**. Las ocho métricas del `summary` las he
**recomputado desde las entradas**, una a una, y **las ocho cuadran** — el summary de este
ledger no miente:

| eje | valor | qué es |
|---|---|---|
| `IDENT` | 719 | identificadas |
| `INFER-game` | **3** | ÚNICO grado INFER vivo |
| `driver` | 163 | diferidas con razón de allowlist (`hardware-driver`) |
| `name_tentative` | 12 | nombre honesto pero no cerrado |
| `pin_only` | 9 | nombre FIJADO a mano SIN derivación de cuerpo detrás |
| `verified_heredado` | 100 | sello heredado SIN cita que lo defienda |
| `verify_blocked` | 6 | flujo que no se pudo cerrar, con razón |
| `game_routines_pending_verify` | 304 | de juego, sin cuerpo verificado |
| `unnamed_routines` | 0 | (recomputado: 0 de verdad) |

**La población «INFER» son TRES, no un lote.** Y las tres están diferidas con razón
declarada (`game-leaf-pending-B`): `CAST.OVL` en 0x05dc, `FONT.OVL` en 0x0e7b y
`ULTIMA.EXE` en 0x6f90. Los 163 `driver` no son «sin ID»: tienen rol derivado los 163
(`driver_routines_with_role: 163`) y el allowlist los declara fuera de alcance porque el
port no reimplementa el renderer EGA/CGA. ⇒ **La cola derivable de verdad no es «INFER o
sin ID» en bloque: son los ejes `pin_only` (9), `name_tentative` (12) y los marcadores.**

### 1.1 🔴 El cero de `placeholder_names` NO se podía aceptar, y el instrumento que lo
### mide no se estaba ejecutando

`summary.placeholder_names: 0` sale de `is_placeholder_name`, que es una **allowlist de
ejemplares vistos**. Control positivo antes de aceptar el cero: invocado de verdad, el
detector `Trinquete.tier1` dispara sobre `xffff` (artefacto), `call` y `jne` (mnemónico) y
`etalle` (trozo de «detalle»), y calla sobre `beep_delay` y `compose_world_view`. El
instrumento **funciona**. Aplicado a los 885 nombres:

- **TIER-1 (afirma marcador): 0.** El cero es REAL, y ahora está medido.
- **TIER-2 (sospecha): 6** — `blink`, `bytecode`, `glide`, `walkable`, `weapon`, `yell`.

**🔴 Y aquí el hallazgo de proceso: `python3 re/tools/genero.py` NO EJECUTA NADA.** El
fichero no tiene guarda `__main__` (cero coincidencias): como script importa el módulo,
define las clases y sale 0. **Siempre**, y saldría 0 con el ledger lleno de basura. El gate
real es `re/tools/test_genero.py` bajo pytest — y **está ROJO en main**:

```
FAILED test_genero.py::test_los_TIER2_del_ledger_son_exactamente_estos
  TIER-2 medido:  ['blink','bytecode','glide','walkable','weapon','yell']
  esperados:      ['blink','bytecode',        'walkable','weapon','yell']
1 failed, 44 passed
```

Entró **`glide`** sin adjudicar. El trinquete existe exactamente para eso y llevaba tiempo
gritando en una sala vacía. **Un trinquete que nadie escucha no es un trinquete**, y el
verde que la flota se apuntaba era del instrumento, no del árbol. (Medido con el worktree
LIMPIO y en el SHA exacto de main, o sea que el rojo es de main.)

---

## 2. CERRADA — `ULTIMA.EXE` en 0x43ae: `glide` → **barrido de frecuencia**

La entrada que el trinquete señalaba, y la de mayor alcanzabilidad de la cola: **31
call-sites medidos**. Su propia evidencia la declaraba deuda: «'glide' es PROSA, no un
nombre derivado […] ALLI ESTA FILA DEBE QUEDAR SIN NOMBRE […] No hay lectura de cuerpo que
respalde ni 'glide' ni 'cuerpo'». **Deuda saldada por lectura.**

### Cuerpo entero, 0x43ae-0x4401 (84 B, `ret 8` = CUATRO argumentos)

```
43b6  [bp-8] = [bp+6]                                  ; paso_di
43bc  ax = [bp+8] - [bp+0xa]                           ; freq_fin - freq_ini
43c2  imul [bp-8] ; 43c8 cx = [bp+4] ; 43cb cdq ; idiv cx
      ⇒ [bp-2] = ((freq_fin - freq_ini) * paso_di) / N   ; INCREMENTO con signo
43d1  si = [bp+0xa]   (freq actual = freq_ini) ; 43d4 di = 0
43ec  bucle mientras di < [bp+4]:
   43d8   push si ; call 0x22e2                        ; set_tone(freq actual)
   43dc   push 1 ; push [bp+6] ; call 0x20c8           ; delay_via_timer(1, paso_di)
   43e6   si += [bp-2]        ; 43e9  di += [bp+6]
43f7  call 0x230e                                      ; altavoz OFF
43ff  ret 8
```

Las tres callees, leídas:

- **`set_tone`, en 0x22e2** — `dx:ax = 0x001234de` (= 1193182, el reloj del PIT), `div cx`,
  `out 0x42` dos veces (divisor bajo y alto) y `in 0x61 ; or al,3 ; out 0x61`. Es
  **programar el canal 2 del PIT y abrir la puerta del altavoz**. Gate previo por
  `[g_unk_a9ce]` (sonido activado).
- **`delay_via_timer`, en 0x20c8** — retardo calibrado por doble bucle, con la constante de
  `[0x5356]` escalada por `[bx+0x5426]` según el índice. Casa con `audio-diff-calibration.md`.
- **0x230e** — `in al,0x61 ; and al,0xfc ; out 0x61,al ; ret`. **Apaga el altavoz.**
  (Ver §3: esta rutina NO está censada.)

⇒ **`ULTIMA.EXE` en 0x43ae es un BARRIDO LINEAL DE FRECUENCIA (portamento) sobre el
altavoz PC**: desliza el tono de `freq_ini` a `freq_fin` en `N/paso_di` pasos y apaga al
salir. La palabra de prosa «glide» **acertaba el sentido sin acreditarlo**; ahora hay
cuerpo detrás.

### Argumentos confirmados en TRES call-sites de overlays distintos

Leídos los `push` inmediatamente anteriores a la llamada, la firma es
`(N, paso_di, freq_fin, freq_ini)` con `[bp+4]=N`:

🔴 **CONVENCIÓN DE ESA TUPLA: OFFSET DE MARCO ASCENDENTE**, no orden de push — el ancla
`[bp+4]=N` que va a su lado ya lo fijaba, y aquí se dice con todas las letras (ficha #139).
En ORDEN DE PUSH la misma firma es la INVERSA, `(freq_ini, freq_fin, paso_di, N)`, porque el
primer `push` aterriza en el offset más alto. **Las dos son la misma firma y ninguna está mal**;
`audio-diff-calibration.md` publica la de push y durante un tiempo pareció contradecir a ésta.
⚠ Y ojo al leer esta acta entera: la línea del retardo de arriba (`delay_via_timer(1, paso_di)`,
que transcribe `push 1 ; push [bp+6]`) SÍ está en orden de push. O sea que **este documento
también mezcla las dos convenciones**, sólo que al revés que el otro: aquí la primitiva va en
marco y su callee en push. Por eso la regla es declarar la convención EN CADA TUPLA, no una vez
por fichero.

| sitio | N | paso_di | freq_fin | freq_ini | efecto |
|---|---|---|---|---|---|
| `CAST.OVL` en 0x029a | 0x28 (40) | 1 | 0x7d0 (2000) | 0x4b0 (1200) | **sube** 1200→2000, +20 Hz/paso |
| `COMBAT.OVL` en 0x01b2 | 0x96 (150) | 5 | 0x190 (400) | 0x2ee (750) | **baja** 750→400, −11 Hz/paso |
| `CMDS.OVL` en 0x09d5 | 0x12c (300) | 5 | 0xc8 (200) | 0x3e8 (1000) | **baja** 1000→200, −13 Hz/paso |

### Radio MEDIDO, no estimado — 31 call-sites

`dispatch_table.near_calls_to_kernel` por overlay, más barrido propio de `E8 rel16`
intra-kernel. **Control positivo del instrumento en la misma corrida**: contra 0x3f6e
reproduce exactamente la banda ya adjudicada en ALTA-4 (`CAST.OVL` en 0x1c28 y
`COMSUBS.OVL` en 0x142a).

`MAINOUT` 4 · `COMBAT` 4 · `SJOG` 4 · `COMSUBS` 4 · `CAST` 6 · `CMDS` 3 · `DUNGEON` 2 ·
`OUTSUBS` 1 · `TALK` 1 · `ZSTATS` 1 — **30 en overlays** + **1 intra-kernel** (0x6a3c,
dentro de `party_anim_build`) = **31**.

**Nombre derivado propuesto: `sound_freq_sweep`** (pasa TIER-1 y TIER-2 del detector,
comprobado). Entrada lista para la capa manual en §5.

> 🔴 **SUPERADO EL 2026-08-06 (#83) EN CUANTO AL NOMBRE — la DERIVACIÓN de esta acta sigue
> siendo buena.** El nombre vivo volvió a **`pcspeaker_glide`**. Lo que NO se toca: la lectura
> de cuerpo `0x43ae-0x4401` de esta acta es correcta y se **re-confirmó** ese día con dos
> call-sites (`CAST.OVL:0x029a` 1200·2000·1·40 · `COMBAT.OVL:0x01b2` 750·400·5·150; la
> pendiente cuadra exacta). El nombre cambió porque **las dos fuentes en liza habían leído el
> cuerpo bien** —así que «manda quien leyó el cuerpo» no discriminaba— y desempató el consumo
> del corpus (19 contra 11) más una corrección explícita previa en `combat-ui-spec.md:70`.
> **Esta acta se conserva sin reescribir** para que nadie vuelva a proponer el nombre desde el
> detector sin saber que ya se adjudicó.
>
> Y una precisión que evita el malentendido que costó la ficha: la firma de más abajo está
> escrita **por offset de marco ascendente** (`[bp+4]`→`[bp+0xa]`), no en orden de push. En
> orden de push del llamador es **(inicio, fin, paso, total)**. Las dos son la misma firma.

---

## 3. 🔴 HALLAZGO NO PEDIDO — el censo se ha tragado rutinas dentro de `set_tone`

`set_tone` está censada en 0x22e2 con **tamaño 64** (o sea 0x22e2-0x2321). Pero su `ret 2`
está en 0x230a. Leídos los BYTES CRUDOS del binario (no el texto del disasm, que se
desincroniza aquí), dentro de esa extensión declarada hay **tres cuerpos y dos bytes de
relleno**:

```
0x2300: e4 61 0c 03 e6 61 1f 5f 5e 5d c2 02 00 | 00 | e4 61
0x2310: 24 fc e6 61 c3 | 00 | 55 8b ec 83 ec 06 8b e5 5d c3
0x2320: cb 90 | 55 8b ec ...   <- aqui empieza `blink`, ya censada en 0x2322
```

| tramo | bytes | qué es | alcanzabilidad MEDIDA |
|---|---|---|---|
| 0x22e2-0x230c | 43 | `set_tone` REAL (`ret 2`) | 8 call-sites |
| 0x230d | 1 | **byte de relleno `00`** | — |
| **0x230e-0x2314** | **7** | **altavoz OFF** (`in 0x61; and 0xfc; out 0x61; ret`, 0 args) | **5 call-sites** |
| 0x2315 | 1 | **byte de relleno `00`** | — |
| 0x2316-0x231f | 10 | prólogo completo que reserva 6 B y no los usa (`sub sp,6` … `mov sp,bp`) | **0** |
| 0x2320 | 1 | `retf` suelto | **0** |

Es el patrón **prólogo oculto tras byte de relleno**, y la consecuencia es concreta: la
rutina de apagar el altavoz **tiene cinco llamadores y el ledger no sabe que existe** —
`TOWN.OVL` en 0x0fd3, `CAST.OVL` en 0x1f51, e intra-kernel 0x22da (dentro de
`pcspeaker_beep`), 0x316e y 0x43f7 (dentro de la rutina de §2). Ancla de fichero verificada
con control positivo (los bytes de 0x3f6e reproducen su prólogo conocido).

**Los ceros de 0x2316 y 0x2320 son ceros MEDIDOS, no ausencia probada**, y se midieron por
los tres canales, no sólo por `call`: cero `call`, cero `jmp` (rel8 y rel16, con control
positivo — el escáner sí encuentra el `jmp` corto interno de 0x43d6 a 0x43ec) y cero
punteros-word a 0x2316. Llamarlas «muertas» sería el error de vocabulario de dar por
inalcanzable lo que sólo se midió por un canal; quedan **DECLARADAS como no alcanzables por
ningún canal medido**, que es lo que sé.

---

## 3bis. CERRADA — `ULTIMA.EXE` en 0x1f12: `get_col` CONFIRMADO (27 call-sites)

Cabeza de la cola por alcanzabilidad medida: de los 21 candidatos (`pin_only` 9 +
`name_tentative` 12), éste tiene **27 call-sites**, el máximo. Estaba `pin_only`: nombre
fijado a mano **sin derivación de cuerpo detrás**.

**Cuerpo entero, 0x1f12-0x1f25 (20 B, `ret` pelado = CERO argumentos):**

```
1f18  si = [0x539a]          ; puntero al REGISTRO de ventana de texto ACTIVA
1f1c  al = [si+4] ; 1f1f  ah = 0
1f25  ret                    ; devuelve el byte +4 extendido a word
```

El cuerpo solo dice «devuelve el byte +4». **Lo que ese campo SIGNIFICA se deriva de su
productor**, no del getter: el avance de cursor dentro de `putchar`, en 0x1735-0x1757:

```
1735  inc byte [si+4]              ; ++columna
1738  al = [si+4] + [si]           ; columna ABSOLUTA = relativa + origen
173d  cmp al,[si+2] ; jle ok       ; ¿cabe en el limite DERECHO?
1742  inc byte [si+5]              ; no cabe -> ++fila
1745  mov byte [si+4],0            ; ...y columna a 0  (retorno de carro)
1749  al = [si+5] + [si+1]         ; fila ABSOLUTA
174f  cmp al,[si+3] ; jle ok       ; ¿cabe en el limite INFERIOR? (si no, scroll)
```

⇒ **Layout del registro de 8 B**, derivado de sus consumidores: `+0/+1` origen de la
ventana (col, fila) · `+2/+3` límites derecho e inferior (init: `0x27`=39 y `0x18`=24) ·
**`+4` COLUMNA del cursor relativa a la ventana** · `+5` fila · `+6` atributo en dos
nibbles, donde el bajo lo escribe la rutina en 0x1cd0 y el alto la de 0x1f26 · `+7` banderas.

**Corroboración por la GEMELA, que es lo que lo cierra:** en 0x1cee vive una rutina de la
misma forma exacta (mismo prólogo, mismo `ret` pelado, mismo puntero) que devuelve **`[si+5]`**
en vez de `[si+4]`, y el ledger ya la tiene fichada como **`text_get_row`**. Si la del `+5`
es la fila, la del `+4` es la columna. **El nombre fijado `get_col` era CORRECTO** — lo que
le faltaba no era acierto, era acreditación. Ahora la tiene.

**RULING DEL LEAD, APLICADO (2026-07-30):** renombrada a **`text_get_col`** por paridad de
catálogo con su gemela, **con el nombre viejo registrado en `renamed_from`** — renombrar sin
archivar el nombre anterior rompe la búsqueda por símbolo, así que no se borra, se archiva.
Y **`pin_only` RETIRADO POR MÉRITO**: la métrica `pinned_names_without_derivation` baja de
**9 a 8**, que es la única dirección en la que su docstring le permite moverse.

Se **conserva** la cita de pin original (`census-name-rescue-20260727`): no se borra el
registro de que aquello fue un rescate. La guarda de pin lo permite por diseño — sólo salta
si hay cita-pin **y no hay** cita de derivación, que es justo lo que este cierre deja de ser.

★ Detalle que cierra el círculo: aquella cita de rescate ya avisaba de que regenerar el censo
convierte este nombre en `call`. O sea que la trampa de la §5bis estaba **escrita en la propia
entrada** que este carril venía a acreditar.

**Nota de método:** las otras tres direcciones que toqué al derivar la anterior —
0x16c9, 0x172a y 0x1cd0 — **NO** son rutinas ocultas. Caen dentro de dos entradas bien
censadas: `putchar`, que empieza en 0x16ba y mide 314 B, y la de 0x1cca, de 36 B. Lo
compruebo porque tras el hallazgo de §3 la tentación es ver prólogos ocultos en todas
partes, y aquí no los hay.

**Discrepancia de nombre destapada de paso** (la cazó el propio gate de siembra, que avisó
de que yo «pisaba» un nombre): la entrada de 0x1cca se llama **`text_set_fg_color`** en el
ledger, pero `kernel-sweep-3.md`, en sus líneas 134 y 194, la llama **`text_set_color`**.
No la adjudico —no he leído su cuerpo— pero queda fichada: son dos nombres para una
dirección, y el que manda es el del ledger.

## 3ter. CERRADAS — `to_upper` (19 call-sites) y `delay_via_timer` (5), las dos `pin_only`

### `ULTIMA.EXE` en 0x2032 — `to_upper` CONFIRMADO

Cuerpo entero, 0x2032-0x2054 más un `nop` de relleno en 0x2055 (36 B declarados, correctos),
`ret 2` = UN argumento:

```
2035  cmp byte [bp+4],0x61 ; jb  0x204c     ; < 'a'  -> intacto
203b  cmp byte [bp+4],0x7a ; ja  0x204c     ; > 'z'  -> intacto
2041  al = [bp+4] ; ah = 0 ; 2046  sub ax,0x20   ; en ['a','z'] -> mayuscula
204c  (rama intacta) al = [bp+4] ; ah = 0
2052  ret 2
```

ASCII a mayúsculas de manual, extendido a word. **El nombre pinado era correcto.** Sin
sorpresas y sin matices: se acredita y ya.

### `ULTIMA.EXE` en 0x20c8 — `delay_via_timer` CONFIRMADO, y el «via timer» es literal

Cuerpo entero (50 B, `ret 4` = DOS argumentos: cuenta y ÍNDICE de escala):

```
20ce  ax = [0x5356]                     ; constante de CALIBRACION
20d1  bx = [bp+6] ; 20d4  cx = [bx+0x5426]  ; escala segun el indice
20d8  jcxz ; 20da  shr ax,cl            ; calibracion >> escala
20dc  [0x5424] = [bp+4]                 ; contador EXTERNO
20e3  [0x5422] = ax
20e6  dec word [0x5422] ; jne 0x20e6    ; bucle INTERNO
20ec  dec word [0x5424] ; jne 0x20e3    ; recarga y repite
```

El cuerpo es una espera ocupada pura: **no consulta ningún reloj**. La duda razonable era si
el «via timer» del nombre pinado era prosa. **No lo es**, y se deriva del PRODUCTOR de
`[0x5356]`, la rutina de calibración en 0x11b4:

```
11b4  [0x5356] = 0 ; [0x535a] = 0
11c0  int 21h AH=35h AL=1Ch            ; LEE el vector del TICK del timer
11d1  int 21h AH=25h AL=1Ch, DX=0x1214 ; INSTALA su propia ISR en ese tick
11d8  espera a que [0x535a] cambie     ; sincroniza con el primer tick
11e5  inc [0x5356] hasta el tick SIGUIENTE
11f0  restaura el vector anterior
```

⇒ `[0x5356]` es **cuántos incrementos caben en UN tick del BIOS**, o sea una medida real de
velocidad de la máquina tomada CONTRA EL TIMER. La espera es un bucle de CPU, pero su
magnitud está calibrada por reloj: **el nombre es exacto**, y ahora está derivado en vez de
supuesto.

### Control negativo del hallazgo de §3, que importa tanto como el hallazgo

Comprobados los límites del censo en esta zona con los bytes crudos: `to_upper` (0x2032+36),
la de 0x2056 (+40) y la de 0x207e (+20) **están bien delimitadas**, y sus bytes `00`/`0x90` de
relleno caen DENTRO de los tamaños declarados, como deben. El disasm vuelve a desincronizarse
en 0x207d —mismo síntoma que en §3— **pero el censo acierta**. ⇒ El defecto de §3 **no es un
fallo general de delimitación**: es específico, y hay que tratarlo como un caso, no como una
epidemia. Sin este control, el hallazgo de §3 invitaba a sospechar de todo el censo.

## 3quater. CERRADA — `CAST.OVL` en 0x0032, renombrada a `cmb_set_weapon_then_attack`

`pin_only` **y** TIER-2 a la vez: adjudicarla encoge las dos listas de una sola lectura.
26 B, `ret 2` = UN argumento.

```
0035  al = [bp+4] ; 0038  [g_cmb_weapon] = al     ; GUARDA el argumento en la global
003b  al = [g_cmb_actor] ; ah = 0 ; 0040  push ax
0041  push [bp+4]
0044  call 0xffffc14a                              ; destino CRUDO -> regla de banda
0048  ret 2
```

**El near-call, resuelto con el instrumento y no a mano** (`overlay_near_call_base(CAST.OVL)`
= `0xbf80`): `(0xbf80 + 0xc14a) & 0xFFFF` = kernel **`0x80ca`**, que **no es una rutina**: es
un **stub PLINK** de la tabla de 164, y `dispatch_table.stubs()` lo resuelve a
**`COMSUBS.OVL` en 0x0c52**, que el ledger ya tiene fichado como `attack_dispatch_by_reach`.
Su primera instrucción confirma la semántica del argumento: `cmp word [bp+4],0x23` con `jl`,
y si no salta pone `[g_cmb_is_magic] = 1` ⇒ **el argumento es el ÍNDICE de arma/ítem**, y de
0x23 en adelante es magia.

⇒ La rutina **fija el arma de combate y despacha el ataque**. El nombre pinado `weapon`
nombraba **el argumento, no la acción** — el mismo defecto que `bytecode` (que nombraba el
dato) y que se arregló renombrando a `cutscene_anim_vm`. Propuesto **`cmb_set_weapon_then_attack`**.

★ Y un segundo control negativo, que es lo que impide convertir esto en un falso hallazgo:
kernel `0x80ca` y `0x8106` **no están en `frontier.json`**, y eso NO es un hueco. `coverage.json`
los cubre explícitamente en un segmento propio, que arranca en 0x7a16 y termina en 0x81c6, y
que se llama **kernel_overlay_stubs** («164 stubs de
12 B kernel→overlay»). Las dos capas tienen **granularidad distinta por diseño**: `frontier`
lista RUTINAS, `coverage` cubre el FICHERO entero. «No está en el frontier» ≠ «sin cubrir», y
confundirlo habría fabricado un agujero donde hay una decisión de modelo.

## 7. CERRADA — `ULTIMA.EXE` en 0x6506, `kernel_spawn_actor` CONFIRMADO (654 B, 13 callers)

La que no quise firmar a medias en el parte anterior. Ventana propia, cuerpo entero
0x6506-0x6790, **`ret 0xa` = CINCO argumentos** (no los tres que sugería el uso superficial).

**Firma derivada:** `(arg4, arg6, arg8, MODO, TIPO)`, donde el **modo** es `[bp+0xa]` con tres
valores (0, 1, 2) que bifurcan la rutina entera, y el **tipo** es `[bp+0xc]`, que indexa
**dos** tablas: una de registros de 8 B basada en 0x13bd y 0x13c1, y otra de 32 B basada en
0x55b3 y 0x55b5.

**Son DOS arrays paralelos de actores, ambos de 32 ranuras de 8 B:**

| array | ranuras | papel |
|---|---|---|
| base 0xba14 | 32 × 8 B | registro «vivo» del actor; el byte +2 es el de OCUPACIÓN |
| base 0x5c5a | 32 × 8 B | registro paralelo de estado/animación |

**Fase 1 — asignación (0x6577-0x66ef).** Recorre el primer array buscando ranura libre: con
`bx = indice<<3`, mira `[bx-0x45ea]` (que es 0xba16, o sea **el byte +2 del registro**) y sigue
sólo si vale cero; si no, incrementa y reintenta hasta 0x20. La ranura encontrada se guarda en
`[bp-6]`, que es **el valor de retorno**.

**Fase 2 — inicialización del registro.** Con `si` apuntando al registro:
- `[si+1]` = coordenada **aleatorizada**: `rand0(7)` (kernel 0x3aae, confirmado en el ledger)
  menos 4 y sumada a la base que sale de la tabla de 0x13bd ⇒ desplazamiento de −4 a +2
  alrededor del punto de la agenda; si el resultado **pasa de 0x1e**, se revierte a la base.
- `[si+5]` = `0x24 - [si+1]` — coordenada complementaria, derivada de la anterior.
- `[si+2]` = **banderas por MODO**: 0x80 en el modo 1, 0x40 en el modo 0, y **0x20 si el tipo
  es 8 o 9**; más un `or 8` condicionado a que el byte de la tabla de 32 B no sea 0x47 ni 0x50.
- `[si+3]` = TIPO · `[si+6]` = arg8 · `[si+7]` = arg6.

**Fase 3 — el array espejo**, que ocupa de 0x6634 a 0x674c. Recorre 0x5c5a de 8 en 8 buscando hueco
(`[di]==0`) y escribe los campos espejo: arg8 en 0x5c5c, arg6 en 0x5c5d, arg4 en 0x5c5e, el
tipo en 0x5c5f, y **0xff** en 0x5c61. El modo vuelve a bifurcar qué campos se tocan.

**Fase 4 — limpieza de enlaces huérfanos**, de 0x6751 a 0x6786, que es lo que más dice del diseño.
Antes de salir recorre 0xba18 hasta 0xbb18 y, para cada registro, usa su byte 0 como índice en
0x5c61; **si ese enlace apunta a la ranura recién asignada, lo pone a 0xff**. Es decir: la
rutina no sólo crea, también **invalida referencias viejas a la ranura que acaba de reutilizar**
— exactamente lo que hace falta cuando las ranuras se reciclan.

**Retorno:** el índice de ranura, o **0xffff** si no había hueco (`[bp-6]` se fuerza a −1 en
0x674c).

⇒ **El nombre pinado era CORRECTO**: asigna e inicializa una ranura de actor. Se acredita sin
renombrar. Lo que la lectura añade y el nombre no decía: **son cinco argumentos y no tres, hay
un parámetro de MODO con tres valores que bifurca todo, los arrays son DOS y paralelos, la
posición se ALEATORIZA alrededor de la agenda, y hay una fase final de limpieza de enlaces**.

## 8. CERRADA — `ENDGAME.OVL` en 0x0000, y aquí el nombre **NO** era correcto del todo

La última `pin_only` no-driver. Cuerpo entero 0x0000-0x0238, **`ret` pelado = CERO
argumentos**. **Reproductor de cutscene guionizada de SEIS paneles:**

- **Prólogo:** carga tres recursos por identificador, cada uno con **bucle de reintento**
  (`or si,si` y salto atrás hasta que la carga devuelve algo), y limpia con (0xc7, 0x13f) =
  199 × 319, o sea **pantalla completa 320×200**.
- **Bucle:** el índice va de 0 a 5 (`cmp` contra 6 con `jge`) ⇒ **seis paneles**. Cada vuelta
  lee de **nueve tablas paralelas**, vuelca a las globales de 0x5146 a 0x5158, pinta, **espera
  entrada** sondeando hasta que la rutina devuelve algo, y **avanza cinco punteros** en
  2, 2, 4, 4 y 2 bytes — que es lo que fija el ancho de registro de cada tabla.
- **Caso especial:** bandera del panel a 1 **y** índice 3 ⇒ rama de presentación propia.
- **Epílogo:** imagen final, limpieza, y la bandera de modo de vuelta a 0.

### ★ Lo importante de esta pieza no es la estructura: es que el nombre mentía a medias

`endgame_throne_scene` → **`endgame_scripted_scene`**. Se retira el calificativo **«throne»
porque NO ESTÁ ANCLADO**, y esto se sostiene en **dos lecturas independientes**: la anterior
dejó un `verify_blocked` diciendo literalmente que en el cuerpo no hay ninguna cadena ni dato
que lo ancle, y ésta —ya del cuerpo **completo**, no del esqueleto— lo **confirma**.

Se declara **NO REFUTADO sino SIN ANCLAR**, que no es lo mismo: puede que la escena sea de un
trono y que el ancla viva en el guion, en un testigo o en `END.DAT`. Por eso el nombre viejo
**se conserva en `renamed_from`** y la cita invita a restaurarlo a quien lo ancle. El nombre
nuevo dice **sólo lo que el cuerpo sostiene** — que es el estándar que este carril ha aplicado
en las otras cinco, sólo que allí el resultado fue confirmar y aquí ha sido recortar.

**Y el `verify_blocked` anterior hizo exactamente su trabajo:** no afirmó de más, dejó escrito
qué le faltaba, y por eso esta lectura supo dónde mirar. Es el argumento a favor de que los 6
`verify_blocked` de §6 son deuda honesta y no deuda a secas: **uno de ellos acaba de pagarse
solo, guiando a quien vino después.** Quedan 5.

## 6. DECLARACIÓN DE FRONTERA (cierre del carril, ratificada por el lead)

> **⚠ CIFRAS SUPERADAS POR §7 Y §8, LA MISMA NOCHE (2026-07-30).** Esta tabla se escribió
> **antes** de cerrar las dos últimas piezas, y por eso da `verify_blocked` en 6 y deja
> `ENDGAME` en 0x0000 más `ULTIMA.EXE` en 0x6506 como pendientes. **Las dos se cerraron
> después**: 0x6506 en §7 (acreditada sin renombrar) y `ENDGAME` en §8 (acreditada **y**
> recortada, retirándole un calificativo sin anclar). **Estado real de hoy:
> `pin_only` = 3 —los tres de `EGA.DRV`, fuera de alcance por allowlist— y
> `verify_blocked` = 5.** El MARCO de la tabla (qué es deuda honesta, qué está fuera de
> alcance, y por qué los ~300 son la frontera del goal) **no cambia**: sólo caducaron dos
> cifras y una fila de pendientes. Se conserva el texto como registro de lo que se declaró
> antes de las dos últimas lecturas.

El goal pide la frontera **sin INFER ni sin-ID**, no «todo `verified`». Con eso, el residuo
se declara así, y cada bloque con su razón:

| bloque | cifra | veredicto |
|---|---:|---|
| `INFER-game` | 3 | **diferidas con razón de allowlist** (`game-leaf-pending-B`). No son sin-ID. |
| `verify_blocked` | 6 | **DEUDA HONESTA**: llevan la razón por la que el flujo no se pudo cerrar. Un ledger que prefiere el hueco a la afirmación. Se quedan. |
| `driver` (incl. 3 `pin_only` de `EGA.DRV`) | 163 | **FUERA DE ALCANCE por allowlist**: el port no reimplementa el renderer. Declaradas, no excavadas. |
| `pin_only` restantes | ver §4 | dos overlay-side (`ENDGAME` en 0x0000) más `ULTIMA.EXE` en 0x6506 |
| `game_routines_pending_verify` | ~300 | **LA FRONTERA DEL GOAL**, declarada como tal |

**El criterio de radio es lo que justifica no excavar los ~300**, y conviene dejarlo escrito
porque es una decisión, no una rendición: la cola se trabajó **por alcanzabilidad medida**, y
las cerradas fueron las de 31, 27, 19 y 5 call-sites. La cola restante cae a 0-2. Leer ~300
cuerpos no cabe en ninguna ventana razonable, y el valor marginal por lectura **decrece con
el radio**: una rutina con 0 llamadores medidos no sostiene mecánica de nadie. Lo que sí
queda **prohibido** es confundir ese «0-2» con «sin llamadores» en las que viven EN overlays:
ahí el instrumento **no responde la pregunta** (ver §4), y su radio está *sin medir*.

## 4. RESIDUO, con su razón

- **Los 3 `INFER-game`** — diferidas con razón de allowlist ya declarada. No se tocan aquí:
  su cierre es el lote B, no este carril.
- **Los 163 `driver`** — fuera de alcance por allowlist (el port no reimplementa el
  renderer). Rol derivado los 163.
- **`pin_only` (9) y `name_tentative` (12)** — cola viva de este carril; **dos cerradas**
  (§2 y §3bis). Cola ordenada por alcanzabilidad MEDIDA, que es como se sigue trabajando:

  | radio | entrada | eje | estado |
  |---:|---|---|---|
  | 27 | `ULTIMA.EXE` en 0x1f12, `text_get_col` | pin_only ↓ | **CERRADA §3bis** |
  | 19 | `ULTIMA.EXE` en 0x2032 `to_upper` | pin_only | siguiente |
  | 13 | `ULTIMA.EXE` en 0x6506 `kernel_spawn_actor` (654 B) | pin_only | cola |
  | 5 | `ULTIMA.EXE` en 0x20c8 `delay_via_timer` | pin_only | cola (ya leída de paso en §2) |
  | 5 | `ULTIMA.EXE` en 0x6150, 528 B | tentative | cola |
  | 4·3·3·1·1·1 | 0x1112 · 0x0586 · 0x5394 · 0x17f4 · 0x6360 · 0x6fd6 | tentative | cola |
  | n/m | 10 en overlays (`CAST` 0x0032, `EGA.DRV` ×3, `ENDGAME` 0x0000, `INTRO`, `LOOKOBJ`, `MAINOUT`, `SHOPPES2`, `SJOG`) | mixto | ver nota |

  **Nota sobre el `n/m`:** `near_calls_to_kernel` mide llamadas **de overlay a kernel**, así
  que para una rutina que vive EN un overlay no da su radio. No es un cero: es que **ese
  instrumento no responde esa pregunta**. Medirlas exige el barrido intra-overlay, y hasta
  entonces su alcanzabilidad queda **sin medir**, no en cero.
- **Las otras 5 sospechas TIER-2** (`blink`, `bytecode`, `walkable`, `weapon`, `yell`) —
  `bytecode` ya está renombrada en la capa manual como `cutscene_anim_vm`; las otras cuatro
  son adjudicables por lectura y quedan en cola.
- **Los 2 tramos ocultos sin llamador** — declarados en §3.

---

## 5bis. VENTANA DE REGENERACIÓN — EJECUTADA (2026-07-30, autorizada por el lead)

El bloqueo de §5 queda resuelto: el lead autorizó la pasada única. **Ejecutada, con dos
desviaciones del protocolo que la propia lectura obligó** y que se declaran aquí.

**Lo aplicado:** la entrada de `ULTIMA.EXE:17326` en la capa manual —
`glide` → **`sound_freq_sweep`**, con `renamed_from`, `naming_verified`, `verified` y la
cita entera de la derivación. Copias de seguridad con sha256 de los tres artefactos ANTES
de tocar nada.

**DIFF REVIEW — deltas ENUMERADOS, y son exactamente los pretendidos:**

- **Filas: 885 → 885.** Cero altas, cero bajas, cero filas ajenas tocadas.
- **UNA fila cambiada**, `ULTIMA.EXE:17326`: `name` glide→sound_freq_sweep · `depth` C→E ·
  `verified` false→true · `cites` 7→8 · `naming_verified` → true · `renamed_from` → glide.
- **Summary, tres deltas, los tres consecuencia MECÁNICA de `verified`:**
  `body_verified` 415→416 · `by_depth` C 358→357 y E 415→416 ·
  `game_routines_pending_verify` 304→303.

### Desviación 1 — el censo NO se regenera, y no es prudencia: es una trampa documentada

El protocolo pedía copia de `routine-census.json` «por si cura de paso» las líneas
pre-corrección de ALTA-3/4. **No se ha regenerado, y no debe regenerarse a la ligera.** La
docstring de `test_no_orphan_names_only_the_stale_census_could_explain` lo tiene medido:
regenerar el censo sobre el corpus de notas actual **sustituye 26 nombres curados por ruido
de semilla**, y cita como ejemplo `get_col` → `call` — o sea, **la mismísima rutina que
este carril acaba de acreditar en §3bis**. Curar ~15 líneas de caché costaría 26 nombres.

La distinción que hace segura la ventana: **`frontier.py` escribe SÓLO `frontier.json`**
(línea 490) y lee el censo como fuente; el destructivo es `routine_census.py`, que escribe
`routine-census.json` y el `.md`. Se corrió el primero, no el segundo. **Verificado por
sha256: el censo está byte a byte idéntico antes y después.**

### Desviación 2 — el ALTA de la rutina oculta NO es posible por la capa manual

El protocolo pedía dar de alta el tramo oculto, `0x230e-0x2314`, con sus 5 llamadores. **No
se puede desde la capa manual, y escribirlo habría sido peor que no hacerlo.** `frontier.py`, en su línea 382,
fusiona iterando sobre las filas GENERADAS y buscando la clave manual de cada una:

```python
out_routines.append(apply_manual(rec, manual.get(f"{r['file']}:{r['start']}")))
```

⇒ una clave manual **sin fila generada detrás se ignora EN SILENCIO**. La entrada habría
quedado escrita en el JSON, invisible en `frontier.json`, y nadie habría avisado: un
artefacto sin productor. El alta exige que el censo DESCUBRA la rutina, y el censo no la
descubre porque su límite de `set_tone` se come el pad-byte y los tres cuerpos (§3). Queda
como **encargo para quien toque `routine_census.py`**: el arreglo es de la detección de
límites, no del ledger. La evidencia entera está en §3 para no volver a derivarla.

## 5. BLOQUEO DE RÉGIMEN (histórico — resuelto en §5bis)

La identidad derivada va a `re/ledger/frontier-manual.json`, pero `frontier.py` **superpone**
esa capa y el invariante `test_on_disk_ledger_is_fresh` exige que `frontier.json` en disco
sea igual a un build en caliente. **Medido: ese test está VERDE en main ahora mismo** ⇒
tocar la capa manual **sin** regenerar `frontier.json` lo pone ROJO, y regenerar está vedado
a este carril (#84).

⇒ **No escribo la capa manual.** La entrada queda preparada aquí para aplicarse en la misma
pasada que la regeneración, decisión del lead:

```json
  "ULTIMA.EXE:17326": {
   "name": "sound_freq_sweep",
   "renamed_from": "glide",
   "naming_verified": true,
   "verified": true,
   "cites": [
    { "note": "medicion-84-ctx-pegajoso", "text": "<< se CONSERVA la cita existente >>" },
    { "note": "frontera-infer-acta",
      "text": "DEUDA SALDADA 2026-07-30. CUERPO ENTERO LEIDO 0x43ae-0x4401 (84 B, ret 8 = 4 args) mas las TRES callees. Barrido LINEAL de frecuencia del altavoz PC: incremento = ((freq_fin - freq_ini) * paso_di) / N con idiv; bucle set_tone(si) + delay_via_timer(1, paso_di), si += incremento, di += paso_di, mientras di < N; al salir, apaga el altavoz. set_tone programa el canal 2 del PIT (1193182 / freq a out 0x42, y or al,3 en el 0x61). Firma (N, paso_di, freq_fin, freq_ini) confirmada en TRES call-sites de overlays distintos. Radio MEDIDO con near_calls_to_kernel: 31 call-sites (30 en overlays + 1 intra-kernel), con control positivo del instrumento contra 0x3f6e. El nombre de prosa acertaba el sentido sin acreditarlo." }
   ]
  },
```

Y queda **pedida una decisión de régimen**: si el battery de gates de prosa pasa a ser
`pytest re/tools/test_genero.py` en lugar de `python3 re/tools/genero.py`, que no mide nada.
Ese pytest arranca ROJO hasta que `glide` se adjudique — que es exactamente lo que cierra
este acta.
