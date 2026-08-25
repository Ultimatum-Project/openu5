# ACTA #207 — SUB-TANDA 2 DE LECTURA (los 37): el grupo de `MAINOUT`, 10 pares, 4 lecturas

> Rama `re/liston-207`, worktree `.claude/worktrees/liston-207`, base **main `f557864a`**
> (mergeada en esta sub-tanda; ver §1.1). Carril `liston-b-207`, relevo del carril
> `liston-207` que murió por límite de sesión.
> Continúa `liston-207-t2-acta.md` (SUB-TANDA 1, `545ca01a`, **no aterrizada**), que a su vez
> continúa `liston-207-acta.md` (HITO 1, en main como `0a8ed045`).
> Ejecuta el orden recomendado por la sub-tanda 1 §5: *«el grupo de `MAINOUT.OVL` (10 pares)»*.
> RETENIDA: aterriza el lead.

---

## 0. VEREDICTO

**10 pares · 10 (a) · 0 (b) · 0 (c) nuevo · 0 (d)** — con **4 lecturas** (ritmo **0,40**, idéntico
al de la sub-tanda 1 y por la misma razón: el grupo por FICHERO vuelve a ser grupo por RUTINA).

| par | fichero del port | veredicto |
|---|---|---|
| `MAINOUT.OVL:0x0129` | `core/game.ts:1752` | **(a)** exacta — la fila «a pie no imprime» de la tabla |
| `MAINOUT.OVL:0x0152` | `core/game.ts:1773` | **(a)** exacta — el esquife despacha ahí, y no pasa por el casco |
| `MAINOUT.OVL:0x016a` | `core/world/transport.ts:134` | **(a)** exacta — fragata, y la cadena cotejada byte a byte |
| `MAINOUT.OVL:0x01dc` | `core/game.ts:1772` | **(a)** exacta — «sólo si el facing CAMBIÓ», derivada del `je` |
| `MAINOUT.OVL:0x050e` | `core/world/transport.ts:254` | **(a)** exacta — el destino del «con 0 cae a», y llama al paso real |
| `MAINOUT.OVL:0x0592` | `core/world/transport.ts:253` | **(a)** exacta — es literalmente un `ret 4`, y los 4 call-sites cuadran |
| `MAINOUT.OVL:0x1120` | `core/world/transport.ts:439` | **(a)** exacta — tile 0 + cadena; el «SIN Abandon ship!» probado por ORDEN |
| `MAINOUT.OVL:0x1c01` | `core/world/loops/hazards.ts:89` | **(a)** exacta — el gate de a-pie del puente |
| `MAINOUT.OVL:0x1c0b` | `core/world/loops/hazards.ts:90` | **(a)** en su FORMA; la IDENTIDAD del destino **NO verificada** (§3.4.1) |
| `MAINOUT.OVL:0x1c37` | `core/game.ts:1286` | **(a)** exacta — `'D'`/`'S'` son `0x44`/`0x53`, y el guión entero calca |

Y **cinco cosas declaradas que NO son veredicto**, en §4:

| | qué |
|---|---|
| **1 colisión de NOTACIÓN** | el literal `0x2956` significa `'Ride '` en un docblock y `'Head '` en otro — **los dos correctos** (§4.1) |
| **2 offsets a media instrucción** | `0x10F5` y `0x1108` de la cabecera de hundimiento no caen en frontera (§4.2) |
| **1 token `kernel` (#199)** | `0x1c0b → 0x5910`: **declarado y no aplicado**, y el censo que parecía cerrarlo **NO cierra** (§3.4.1) |
| **1 AVISO al catálogo (#191)** | el port deriva `g_hull` en `0x5c5f`; el ledger no tiene `g_hull` y se lo traga (§4.3) |
| **1 corroboración del HITO 1** | `DS 0x6b9c = '\n\n'` medida por vía independiente ⇒ su familia E se sostiene (§4.4) |

## 1. RE-ANCLA de esta sub-tanda, sobre LA BANDA ENTERA

```
git log -1 main                → f557864a   (el HITO 1 se midió sobre 994d4fc2)
cita_pegajosa_atribucion.py    → 341 pares, 507 citas, 3 controles verdes   EXIT=0
cita_pegajosa_forma.py         → matriz completa, 3 controles verdes        EXIT=0
clase2 × (FORZADA + LIMPIA)    → 3 + 50 = 53
```

★ **LA BANDA SE HA MOVIDO Y MI CELDA NO.** La banda cae de **345 → 341 pares** entre `994d4fc2` y
`f557864a` (−4, por los arreglos de prosa de otro carril). Cotejada la celda **POR MIEMBROS** contra
la lista de los 53 del HITO 1:

| | resultado |
|---|---|
| bajas (en el HITO 1, no hoy) | **0** |
| altas (hoy, no en el HITO 1) | **0** |
| intersección | **53 / 53** |

⇒ Los 4 pares que salieron de la banda **no son de esta celda**, y eso no es una impresión: es
consecuencia de que la intersección valga 53: si alguna baja hubiera caído aquí, la intersección
sería menor. Es justo el cotejo que #206 §4 exige y que el conteo por sí solo no da — aquí el
conteo **también** habría dicho 53=53, y habría sido un verde que no prueba nada.

### 1.1 ⚠ POR QUÉ SE MERGEÓ MAIN — y por qué NO era opcional

La rama venía de `994d4fc2`. Antes de leer nada se midió el arrastre y **uno de los ficheros de este
grupo había cambiado**:

```
git diff --name-only 994d4fc2..main -- game/src/core/game.ts \
      game/src/core/world/transport.ts game/src/core/world/loops/hazards.ts
  → game/src/core/world/transport.ts
```

El cambio reescribe el docblock de `0x0341` en adelante (la cola de bloqueo naval, cabo de #216) y
**desplaza +18 líneas** todo lo que va debajo. Efecto medido sobre mis pares:

| par | línea en el HITO 1 | línea HOY | |
|---|---|---|---|
| `MAINOUT.OVL:0x1120` | `transport.ts:421` | `transport.ts:439` | **movida** |
| `MAINOUT.OVL:0x016a` · `:0x050e` · `:0x0592` | 134 · 254 · 253 | 134 · 254 · 253 | intactas |

⇒ Leer sin mergear habría adjudicado **prosa rancia** en un par y habría dejado la tabla de líneas
del HITO 1 en falso. El merge salió **limpio** (`liston-207-acta.md` es byte-idéntica a los dos
lados: aterrizó íntegra como `0a8ed045`) y las dos actas previas quedan intactas (354 y 346 líneas).
La lección, que es de método y no de este carril: **la tabla par→LÍNEA de un hito caduca; la tabla
par→OFFSET no**. Los pares sobrevivieron los cuatro; las líneas, no.

## 2. Los diez pares agrupan en CUATRO lecturas

| lectura | pares | rutina del binario | rutina del port |
|---|---|---|---|
| §3.1 | `:0x0129` + `:0x0152` + `:0x016a` + `:0x01dc` | verbo de rumbo, `MAINOUT.OVL:0x00da-0x01f0` | `faceVerb` / `moveEcho` / `pushHullWeak` |
| §3.2 | `:0x050e` + `:0x0592` | el llamador del rumbo, `MAINOUT.OVL:0x04f6-0x0595` | la regla girar-vs-avanzar |
| §3.3 | `:0x1120` | hundimiento, `MAINOUT.OVL:0x10d6-0x1166` | `sinkPlayerShip` |
| §3.4 | `:0x1c01` + `:0x1c0b` + `:0x1c37` | emboscada del puente, `MAINOUT.OVL:0x1be8-0x1ca6` | `bridgeTrollAmbush` + `buildTrollSneakScript` |

★ **Tercera confirmación seguida del regalo de `sueltos-174-acta` §2**: agrupar por fichero del port
volvió a agrupar por RUTINA del binario. Y §3.4 lo hace **cruzando ficheros**: `hazards.ts:89`,
`hazards.ts:90` y `game.ts:1286` describen **la misma rutina**, así que los tres pares caen en una
sola lectura pese a vivir en dos ficheros distintos. Un censo de hermanos por fichero no los ve.

## 3. Las cuatro lecturas

### 3.1 `MAINOUT.OVL:0x00da-0x01f0` — el verbo de rumbo, y una tabla de cinco filas que sale 5/5

Prólogo comprobado, porque la cabecera lo afirma: el docblock dice *«`transport_face` MAINOUT
**0x00DA**»* y ahí está el marco de pila, no un punto medio de otra rutina.

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x00da`, | `push bp` / `mov bp, sp` / `sub sp, 4` | — | **el prólogo** ⇒ la rutina empieza ahí ✓ |
| `MAINOUT.OVL:0x00e0`, | `mov word ptr [bp - 2], 0` | — | retorno por defecto 0 |
| `MAINOUT.OVL:0x00ea`, | `and ax, 0xfc` | — | la CLASE de vehículo |
| `MAINOUT.OVL:0x00f0`, | `cmp ax, 0x10` / `je 0x10a` | `0x010a` | caballo |
| `MAINOUT.OVL:0x00f5`, | `cmp ax, 0x14` / `je 0x130` | `0x0130` | alfombra |
| `MAINOUT.OVL:0x00fa`, | `cmp ax, 0x20` / `je 0x16a` | `0x016a` | fragata, velas izadas |
| `MAINOUT.OVL:0x00ff`, | `cmp ax, 0x24` / `je 0x16a` | `0x016a` | fragata, velas arriadas |
| `MAINOUT.OVL:0x0104`, | `cmp ax, 0x28` / `je 0x152` | `0x0152` | **esquife** |
| `MAINOUT.OVL:0x0106`, | `jmp 0x129` | `0x0129` | **resto (a pie `0x1C`) ⇒ al epílogo** |
| `MAINOUT.OVL:0x0129`, | `mov ax, [bp - 2]` / `jmp 0x1f8` | `0x01f8` | epílogo: **ni un push de cadena** |
| `MAINOUT.OVL:0x0181`, | `cmp word ptr [bp - 4], ax` / `je 0x1dc` | `0x01dc` | **facing IGUAL ⇒ salta el bloque** |
| `MAINOUT.OVL:0x01ad`, | `mov ax, 1` / `mov [bp - 2], ax` | — | facing CAMBIÓ ⇒ **devuelve 1** (aborta el paso) |
| `MAINOUT.OVL:0x01b6`, | `cmp byte ptr [0x5c5f], 0x32` / `jb 0x1c0` | `0x01c0` | el umbral de casco |
| `MAINOUT.OVL:0x01c0`, | `mov ax, 0x2976` / `push` / `call` | — | imprime el aviso de casco |
| `MAINOUT.OVL:0x01dc`, | `cmp byte ptr [g_transport_tile], 0x24` / `jb 0x1e6` | `0x01e6` | sólo velas izadas siguen |
| `MAINOUT.OVL:0x01e6`, | `cmp byte ptr [g_wind], 0` / `je 0x1f0` | `0x01f0` | **calma** |
| `MAINOUT.OVL:0x01f0`, | `mov word ptr [bp - 2], 1` | — | becalmada ⇒ **devuelve 1** |

★ **La tabla del port (`transport.ts:129-135`) sale 5/5 cotejada byte a byte contra `DATA.OVL`**
(`fileoff = DS + 0x10`), incluidos los espacios finales y la ausencia de salto de línea:

| clase | destino | la tabla dice | medido en `DATA.OVL` |
|---|---|---|---|
| `0x10` caballo | `0x010a` | `"Ride "`, DS `0x2946` = file `0x2956` | `b'Ride '` ✓ |
| `0x14` alfombra | `0x0130` | `"Fly "`, DS `0x294c` = file `0x295c` | `b'Fly '` ✓ |
| `0x28` esquife | `0x0152` | `"Row "`, DS `0x2951` = file `0x2961` | `b'Row '` ✓ |
| `0x20`/`0x24` fragata | `0x016a` | `"Head "`, DS `0x2956` = file `0x2966` | `b'Head '` ✓ |
| resto (`0x1C` a pie) | `0x0129` | — (no imprime) | **nada que imprimir** ✓ |

Y los rumbos, que la misma cabecera usa para justificar el compuesto: DS `0x295c` = `b'North\n'`,
`0x2963` = `b'South\n'`, `0x296a` = `b'East\n'`, `0x2970` = `b'West\n'`, `0x2976` = `b'Hull weak!\n'`.

**`:0x0129` — (a) exacta.** *«A pie (clase 0x1C) `transport_face` cae en 0x0129 sin imprimir ⇒ rumbo
pelado.»* `0x1C & 0xFC = 0x1C`, que no casa con ninguno de los cinco `cmp`, así que cae al
`jmp 0x129` de `0x0106`; y el *«sin imprimir»* se prueba **por enumeración**, no por impresión:
entre `0x0129` y la salida no hay ni un `push` de inmediato de cadena ni una llamada al impresor.

**`:0x0152` — (a) exacta.** El `je` que lleva ahí es el de `0x28`, y el cuerpo de `0x0152` imprime su
verbo y recompone el tile **sin pasar por el bloque de casco**, que vive en la rama de `0x016a`.
La cita *«el skiff despacha a 0x0152»* es literal.

**`:0x016a` — (a) exacta.** Las DOS clases de fragata (`0x20` en `0x00fa` y `0x24` en `0x00ff`)
saltan al MISMO destino, tal como la fila dice.

**`:0x01dc` — (a) exacta, y el *«sólo cuando el facing CAMBIÓ»* queda DERIVADO**: `[bp-4]` guarda el
tile viejo (`0x016f`) con `ah` ya a cero (`0x016d`), `ax` trae el nuevo, y `0x0181` los compara; el
`je` salta **por encima** de todo el bloque de impresión hasta `0x01dc`. No es que el port lo
describa: es la única lectura posible del salto.

### 3.2 `MAINOUT.OVL:0x04f6-0x0595` — el llamador, y los cuatro call-sites nombrados uno a uno

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x04f6`, | `call 0xda` / `or ax, ax` / `je 0x500` | `0x0500` | **NORTE** |
| `MAINOUT.OVL:0x04fd`, | `jmp 0x592` | `0x0592` | retorno ≠ 0 ⇒ **NO mueve** |
| `MAINOUT.OVL:0x0500`, | `cmp byte ptr [g_sail_dir], 0` / `jne 0x50e` | `0x050e` | con rumbo fijado, **no reimprime** |
| `MAINOUT.OVL:0x050e`, | `push [bp - 4]` / `push [bp - 6]` / `call 0x1fe` | `0x01fe` | **el paso real** |
| `MAINOUT.OVL:0x0549`, | `call 0xda` / `or ax, ax` / `jne 0x592` | `0x0592` | **SUR** (arg 2 en `0x0545`) |
| `MAINOUT.OVL:0x0563`, | `call 0xda` / `or ax, ax` / `jne 0x592` | `0x0592` | **ESTE** (arg 1 en `0x055f`) |
| `MAINOUT.OVL:0x057d`, | `call 0xda` / `or ax, ax` / `jne 0x592` | `0x0592` | **OESTE** (arg 3 en `0x0579`) |
| `MAINOUT.OVL:0x0592`, | `mov sp, bp` / `pop bp` / `ret 4` | — | **el `ret 4` literal** |

**Los dos pares, (a) exacta.** La cita enumera *«sus CUATRO call-sites (… N, … S, … E, … O)»*
—con los cuatro offsets elididos aquí y puestos en la tabla de arriba, en celda propia— y los cuatro
son `call` a la rutina de §3.1, con el argumento de rumbo empujado justo antes y en el orden que
dice. `CS 0x0592` **es** un `ret 4`, no «algo parecido a un retorno». Y el *«con 0 cae a 0x050e, que
llama al paso real (…)»* resulta literal en sus dos mitades: el destino del `jne` y el `call`.

★ **Y esta cabecera hace algo que el barrido de género premia**: se adelanta a la confusión
plausible y la desmonta con las DOS direcciones. Dice *«El gate … es g_wind (DS 0x5892), NO
g_sail_dir (DS 0x5955)»*. Comprobado contra el binario, byte a byte: en `CS 0x01e6`, la dirección
codificada es `DS 0x5892`; en `CS 0x0500`, es `DS 0x5955`. **Las dos citas son correctas y el aviso
también.** Es lo contrario del
género «docblock rancio» de #194: una cabecera que se anticipa a su propio modo de fallo.

### 3.3 `MAINOUT.OVL:0x10d6-0x1166` — el hundimiento, y una negativa probada por ORDEN

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x10e5`, | `or ax, ax` / `jg 0x10ef` | `0x010ef` | ¿quedan esquifes? |
| `MAINOUT.OVL:0x10e9`, | `cmp byte ptr [g_carpets], ah` / `je 0x1120` | `0x1120` | **ni esquife ni alfombra ⇒ ahogo** |
| `MAINOUT.OVL:0x10ef`, | `mov ax, 0x6ae6` / `push` / `call` | — | imprime el aviso de abandono |
| `MAINOUT.OVL:0x10fc`, | `mov al, [g_transport_tile]` / `and al, 3` / `add al, 0x28` | — | esquife, **facing preservado** |
| `MAINOUT.OVL:0x1106`, | `dec byte ptr [g_carpets]` | — | la alfombra SÍ se gasta |
| `MAINOUT.OVL:0x110a`, | `sub ax,ax` / `push` / `mov ax,1` / `push` / `call` | — | **la tirada `rand(0,1)`** |
| `MAINOUT.OVL:0x1114`, | `add al, 0x14` | — | alfombra con facing aleatorio |
| `MAINOUT.OVL:0x1120`, | `mov byte ptr [g_transport_tile], 0` | — | **tile 0: a pie EN el agua** |
| `MAINOUT.OVL:0x113e`, | `mov ax, 0x6af6` | — | la cadena del ahogo |

Cadenas, byte a byte: DS `0x6ae6` = `b'Abandon ship!\n'` · DS `0x6af6` = `b'DROWNING!!!\n'`.

**`:0x1120` — (a) exacta**, y su parte más fácil de dar por buena sin mirar es justo la que se
comprobó: el *«**SIN** "Abandon ship!"»*. **Se prueba por ORDEN**, no por ausencia: el `je 0x1120`
que arranca en `CS 0x10e9`, y que apunta al offset de mi par, pasa **por encima** de `CS 0x10ef`,
que es el único sitio donde se empuja esa cadena en todo el bloque. La rama de ahogo no puede
imprimirla porque el salto la sobrevuela. Mismo patrón de
prueba-por-orden que la sub-tanda 1 §3.1 y que `sueltos-174-acta` §3.2.

★ **Un (c) que NO lo es, y el port lo tenía compensado A DOS SITIOS DE DISTANCIA.** El binario
escribe **`0x64` = 100** de casco (`0x1050`), y el port declara `HULL_MAX = 0x63` = 99. Parecía la
firma de un tope mal copiado. No lo es: la constante de al lado, `PIRATE_SHIP_HULL`
(`transport.ts:44-50`), **documenta exactamente esa diferencia** —*«Son 100, UNO MÁS que el
`HULL_MAX=99` del barco del jugador»*— y la atribuye a la nave pirata, con su gate `cmp [bp-2],0x2C`
comprobado en `0x1043`. Cuarta instancia de `caso-canonico-ya-compensado`, y la compensación está en
una **constante hermana del mismo fichero**, no en la cabecera de la función: la distancia que
`sueltos-174-t2-acta` §3.1 catalogó. Confirma la regla: **leer la cabecera entera ANTES de cobrar**,
y aquí «entera» quería decir subir 400 líneas hasta la declaración de la constante.

### 3.4 `MAINOUT.OVL:0x1be8-0x1ca6` — la emboscada del puente, tres pares y dos ficheros

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `MAINOUT.OVL:0x1bf0`, | `sub ax,ax` / `push` / `mov ax,7` / `push` / `call` | — | **`rand(0,7)`**, call en `0x1bf7` |
| `MAINOUT.OVL:0x1bfa`, | `or ax, ax` / `je 0x1c01` | `0x1c01` | **sólo el 0 sigue ⇒ 1/8** |
| `MAINOUT.OVL:0x1bfe`, | `jmp 0x1ca9` | `0x1ca9` | ≠ 0 ⇒ no pasa nada |
| `MAINOUT.OVL:0x1c01`, | `cmp byte ptr [g_transport_tile], 0x1c` / `je 0x1c0b` | `0x1c0b` | **sólo A PIE sigue** |
| `MAINOUT.OVL:0x1c08`, | `jmp 0x1ca9` | `0x1ca9` | montado ⇒ no pasa nada |
| `MAINOUT.OVL:0x1c0b`, | `call` (destino fuera del overlay) | — | el tick — **identidad no verificada, §3.4.1** |
| `MAINOUT.OVL:0x1c12`, | `mov ax, 0x6b64` (en `0x1c0e`) / `push` / `call` | — | imprime el aviso de los trolls |
| `MAINOUT.OVL:0x1c19`, | `mov ax, 0xa` / `push` / `call` | — | pausa muda de 10 |
| `MAINOUT.OVL:0x1c37`, | `cmp byte ptr [di], 0x44` / `je 0x1c8a` | `0x1c8a` | **`'D'` ⇒ este miembro NO tira** |
| `MAINOUT.OVL:0x1c3c`, | `cmp byte ptr [di], 0x53` / `je 0x1c8a` | `0x1c8a` | **`'S'` ⇒ tampoco** |
| `MAINOUT.OVL:0x1c44`, | `push [bp - 0xa]` / `call` | — | el NOMBRE del miembro |
| `MAINOUT.OVL:0x1c4b`, | `mov ax, 0x6b8c` (en `0x1c47`) / `push` / `call` | — | el sufijo de la línea |
| `MAINOUT.OVL:0x1c53`, | `mov si, 3` | — | **tres vueltas exactas** |
| `MAINOUT.OVL:0x1c5a`, | `mov ax,5` / `push` / `call` | — | la pausa, **ANTES** del punto |
| `MAINOUT.OVL:0x1c61`, | `mov ax, 0x2e` / `push` / `call` | — | el `putchar` del punto |
| `MAINOUT.OVL:0x1c65`, | `dec si` / `jne 0x1c56` | `0x1c56` | cierra el bucle de 3 |
| `MAINOUT.OVL:0x1c6b`, | `mov ax, 0x6b9c` (en `0x1c67`) / `push` / `call` | — | el separador final |
| `MAINOUT.OVL:0x1c76`, | `mov ax,1` / `push` / `mov ax,0x1e` / `push` / `call` | — | **`rand(1,30)`** por miembro |

Cadenas, byte a byte: DS `0x6b64` = `b'\nThou spieth trolls under the bridge!\n\n'` ·
DS `0x6b9c` = `b'\n\n'`.

**`:0x1c01` — (a) exacta.** *«si transport != a pie (0x1C) → no pasa nada»*: el `cmp` está EN el
offset citado y la salida por `0x1c08` va al mismo sitio que la del fallo de la tirada.

**`:0x1c37` — (a) exacta**, y de las mejor derivadas del lote. La cita dice *«por cada miembro que
TIRA (no-'D'/'S', 0x1c37/0x1c3c)»*: `0x44` es `'D'` y `0x53` es `'S'`, los dos `cmp` están en los dos
offsets citados y los dos `je` van al MISMO destino de salto. Y el guión completo del docblock
—cinco beats con sus offsets— se comprobó entero: la cadena en `0x1c12`, la pausa de 10 en `0x1c19`,
el nombre y su sufijo en `0x1c44`/`0x1c4b`, las **tres** vueltas con la pausa **antes** de cada punto
en `0x1c56-0x1c65`, y el separador en `0x1c67-0x1c6b`. **Cinco de cinco.**

#### 3.4.1 ⚠ `:0x1c0b` — la FORMA sí, la IDENTIDAD no, y el censo que parecía cerrarlo NO cierra

La cita es *«world_turn KERNEL 0x5910 (tick de viento/anim, NO el 0x1A60)»*. Lo que **sí** queda
verificado: en el offset citado hay **una `call`**, es la primera instrucción de la rama que el gate
de a-pie habilita, y ocurre **antes** del primer `push` de cadena. Lo que **no**: que el destino sea
la rutina que la cita nombra. El operando es un desplazamiento cuyo destino cae **muy por encima del
fin de `MAINOUT.OVL`**, medido en `0x1caf` ⇒ está fuera del overlay, y su resolución es el problema
abierto de **#95**. Es la misma parada que la sub-tanda 1 §3.1.1, por la misma razón.

★ **Y aquí hay una lección de instrumento que pagué en tiempo.** Censé el destino en todo el corpus
buscando un control positivo: salen **17 call-sites** (9 en `MAINOUT.OVL`, 7 en `TOWN.OVL`, 1 en
`DUNGEON.OVL`), y los contextos —pueblo, mazmorra, exterior, hundimiento, puente— encajan
estupendamente con «tick de mundo». **Ese censo NO es un control positivo y por poco lo escribo como
si lo fuera.** El desensamblador ya resolvió cada `call` a un offset **relativo a su propio
segmento**; que 17 sitios de TRES overlays distintos muestren el mismo valor sólo significa que
comparten offset dentro de su CS, y si los overlays cargan en segmentos distintos son **rutinas
distintas**. Dar el censo por bueno sería suponer resuelto justamente lo que #95 tiene abierto.
⇒ **No firmo ni la identidad ni el censo**; el par se adjudica por su forma y el token va a **#199
declarado y no aplicado**, con la consecuencia ya medida por el HITO 1 §4.1: barrida la banda
entera, **no existe ningún par con offset `0x5910`**, así que el token no ha fabricado atribución.
Familia `instrumento-equivocado-peor-que-ninguno`.

## 4. Lo declarado que no es veredicto

### 4.1 ★ COLISIÓN DE NOTACIÓN: el mismo `0x2956` son DOS cadenas, y las dos citas son CORRECTAS

| dónde | cómo lo escribe | qué cadena es | ¿correcto? |
|---|---|---|---|
| `core/game.ts:1752` | *«DATA.OVL 0x2956/0x295C/0x2961»* para los tres verbos | file `0x2956` = `b'Ride '` | **sí** |
| `core/world/transport.ts:134` | *«DS 0x2956 = file 0x2966»* | DS `0x2956` = `b'Head '` | **sí** |

Ninguna miente: una etiqueta el número como **offset de fichero**, la otra como **offset DS**, y las
dos son ciertas bajo su propia etiqueta —lo comprobé decodificando las dos posiciones—. Pero el
lector que cruce el literal `0x2956` de una cabecera a la otra se lleva **la cadena equivocada**, y
son cabeceras del mismo flujo que se leen juntas. No es un defecto que arreglar en este carril (no
hay nada falso), es un **riesgo de lectura** que conviene que esté escrito. ⚠ Y el antídoto ya existe
y es barato: la fila de `transport.ts:134` imprime **las dos** formas (`DS … = file …`), que es lo
que permitió resolver la colisión en un minuto. Género de `cita-equivocada-peor-que-ninguna`,
en su variante benigna: **ninguna cita es errónea y aun así el cruce induce error.**

### 4.2 Dos offsets de la cabecera de hundimiento NO caen en frontera de instrucción

| la cabecera cita | instrucción real que lo contiene | frontera siguiente |
|---|---|---|
| `0x10F5` («skiffs NO decrementa») | `0x10f3` es un `call` de 3 bytes | `0x10f6` |
| `0x1108` (la tirada de la alfombra) | `0x1106` es un `dec` de 4 bytes | `0x110a` |

Los dos caen **dentro** de la instrucción anterior. La **sustancia es exacta en los dos casos** —los
esquifes efectivamente no se decrementan, y la conversión a alfombra efectivamente gasta una tirada,
que empieza en `0x110a` y llama en `0x1111`—, así que esto **no es (b)**: no hay derivación que
acercar, sobra precisión en un puntero. Mismo género y misma resolución que la imprecisión de
notación de la sub-tanda 1 §3.1 y que `sueltos-174-acta` §3.4. ⚠ Ninguno de los dos es el offset de
mi par (`0x1120`, que **sí** es frontera); salen de aplicar la regla de leer la cabecera entera.

### 4.3 ★ AVISO AL CATÁLOGO (#191): el port deriva `g_hull` y el ledger no lo tiene

El port llama `g_hull` al byte `0x5c5f`. **La derivación del port es buena y es por CONSUMIDOR**, que
es la clase fuerte:

| call-site | instrucción | qué prueba |
|---|---|---|
| `MAINOUT.OVL:0x109e`, | `mov al, [g_transport_tile]` / `and al, 0xf8` / `cmp al, 0x20` | la rutina **sólo corre para fragata** |
| `MAINOUT.OVL:0x10b8`, | `push 1` / `push 0x1e` / `call` | el daño es **`rand(1,30)`** |
| `MAINOUT.OVL:0x10be`, | `mov al, byte ptr [0x5c5f]` | lee el byte… |
| `MAINOUT.OVL:0x10c3`, | `cmp [bp - 2], ax` / `jae` | …lo compara con el daño (≥ ⇒ hundimiento)… |
| `MAINOUT.OVL:0x10cb`, | `sub byte ptr [0x5c5f], al` | …y **se lo resta**. Es un casco. |

Y por el otro extremo, `0x01b6` usa ese mismo byte para decidir si imprime `b'Hull weak!\n'`.
**Dos consumidores independientes, la misma semántica.**

⚠ En `re/ledger/globals.json` **no existe ninguna entrada `g_hull`**. La dirección cae dentro de
`g_char_anim_states` (`0x5c5a`, size **256**), y el desensamblador la imprime como
`[g_char_anim_states+5]`. ⇒ **El catálogo, hoy, renombraría este byte en frío y se equivocaría.**
Es material directo para #191 (*«corroborar la banda contra el CATÁLOGO… como AVISO, nunca como
filtro»*): aquí el AVISO habría sido **un falso positivo**, y es justo el modo de fallo que aquella
tarjeta necesita conocer antes de encender nada. Y la forma —una global catalogada cuya extensión
declarada se traga a otra— es la familia de **#68** y **#219**.

⚠ **Lo que NO firmo**: no digo que el ledger esté mal. Los 7 accesos ABSOLUTOS a `0x5c5f` conviven
en el corpus con accesos INDEXADOS de la forma `[bx + 0x5c5f]` y `[si + 0x5c5f]` en cinco overlays, y
un `[reg + K]` **no es la dirección de un objeto** sino la BASE de una tabla — la regla de
`desplazamiento-no-es-direccion-de-objeto`. Decidir si `0x5c5f` es «un byte suelto» o «la casilla 0
de una tabla que además es el casco» **es trabajo nuevo** y no se hace aquí. Lo que sí queda medido
es que **el port acierta y el catálogo no lo cubre**. Sin tarjeta nueva: cabe en #191.

### 4.4 ★ Corroboración INDEPENDIENTE del HITO 1: la familia E se sostiene

El HITO 1 §3 clasificó un par de este mismo overlay, `CS 0x1c56`, en la familia **E** («cadena REAL sin ninguna
letra»), con inmediato `0x6b9c` = `'\n\n'`, rechazada por la regla de «al menos una letra» del
decodificador. Esta lectura lo toca por otra vía —leyendo el bucle de puntos— y **coincide**:

- el inmediato `0x6b9c` se empuja en `0x1c67`, que es exactamente la rama hermana que el partidor
  anotó para ese par;
- decodificado hoy contra `DATA.OVL`, DS `0x6b9c` = `b'\n\n'`, **byte a byte**;
- y el port no sólo la conoce: **la emite** como beat con ese literal, y la cadena **tiene entrada en
  `es.json`** ⇒ no hay fuga de inglés aquí (contraste con #213).

⇒ La familia E del HITO 1 no era una etiqueta de conveniencia: se sostiene desde una lectura que no
la buscaba. Es el tipo de control que sólo aparece cuando dos tandas se cruzan sobre la misma rutina.

## 5. Estado de la cola

| | pares |
|---|---|
| celda `clase2` F+L @ `f557864a` | 53 |
| nombrados en actas de tandas 1-7 (HITO 1) | 16 |
| no leídos al empezar el carril | **37** |
| leídos en la SUB-TANDA 1 (`545ca01a`, sin aterrizar) | 10 |
| **leídos en esta SUB-TANDA 2** | **10** |
| **VIVOS** | **17** |

Balance acumulado del carril: **20 pares por 8 lecturas** (ritmo 0,40 sostenido), **20 (a)**, cero
(b), cero (c) nuevo, cero (d).

⚠ **CORTE EN FRONTERA DE GRUPO**: el grupo de `MAINOUT.OVL` queda **entero** (10 de 10) y no se ha
abierto el siguiente. Ningún par partido.

**Los 17 VIVOS**, por grupo, con el orden recomendado para la sub-tanda 3:

| orden | grupo | pares |
|---|---|---|
| 1º | `SHOPPES.OVL` (5) | `:0x083e` · `:0x0f2a` · `:0x1352` · `:0x1390` · `:0x1510` |
| 2º | `SJOG.OVL` (5) | `:0x0ad4` · `:0x0ae8` · `:0x0b6e` · `:0x0e42` · `:0x0ee4` |
| 3º | `SHOPPES3.OVL` (3) | `:0x01ca` · `:0x01ef` · `:0x0378` |
| 4º | `TALK.OVL` (3) | `:0x0a78` · `:0x0b0f` · `:0x1191` |
| 5º | `TOWN.OVL` (1) | `:0x10c7` |

Señas para quien siga: en el 1º caen **2 de los 7 pares sin rastro alguno** en `re/notes/` (`:0x1390`
y `:0x1510`, HITO 1 §2.3) y en el 3º cae **el segundo y último token `kernel`** (`:0x01ca`), que se
tratará igual que el de hoy: **declarar, no aplicar**.

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools` ni `re/ledger`.** Cero líneas. Sólo `re/notes/`.
- **No ha re-adjudicado** ninguno de los 16 nombrados ni ninguno de los 13 SIN-TEXTO del HITO 1
  (§4.4 los **corrobora**, que es distinto de re-adjudicarlos).
- **No ha resuelto** la identidad del destino de `:0x1c0b` (§3.4.1) — es #95/#199, con dueño.
- **No ha tocado el ledger** pese al hallazgo de §4.3: el AVISO se declara y se manda a #191.
- **No ha abierto tarjeta nueva**: los cinco declarados caben en tarjetas vivas (#191, #199, #95) o
  son riesgo de lectura sin arreglo (§4.1, §4.2).
- **No ha identificado** cuáles son los 4 pares que salieron de la banda entre `994d4fc2` y
  `f557864a` (§1): sólo que **no son de esta celda**, y eso sí está derivado, no supuesto.
- **No ha leído** los 17 restantes.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `DUNGEON.OVL`, `MAINOUT.OVL`,
`SHOPPES.OVL`, `SHOPPES3.OVL`, `SJOG.OVL`, `TALK.OVL`, `TOWN.OVL`.
