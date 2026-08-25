# ACTA — «Britannia y+1»: la celda de depósito de la salida de mazmorra

Carril `britannia-y1`, ventana del 2026-08-01, rama `fix/britannia-y1` desde main `ad73d58f`.
Tarjeta de la cola post-goal. **Veredicto: SAPO REAL del port.** El binario deposita a la party
en la **misma celda en las dos capas**; el `+1` en `y` que el port sumaba al salir a Britannia
no tiene respaldo en el ASM y era **imposible** por construcción (§2).

## 1. Qué se observó, y por qué el dato observado NO era el argumento

Dos costuras de salida de la **misma** mazmorra 34 (Despise) depositaban en el mismo tile:
`ad…-g09` en Underworld `(91,67)` y `ad…-g14` en Britannia `(91,67)`, mientras el port
`exitDungeonTo` daba `(91,68)` para Britannia (`espejo-final-f1-acta.md` §3.4;
`espejo-e23-underworld.md` §3, que ya lo dejaba anotado como ticket por lectura).

★ Esa observación **no adjudica nada**, y conviene decirlo antes de usarla: el `(91,67)` de
`g14` lo produce el **resync del runner** (`runner.ts::locationOverworldTile`, que lee
`data.locationsX/Y` en crudo), no el original. Las dos puntas del careo son artefactos del
PORT: un instrumento contra un core. La tarjeta sólo se puede cerrar contra el binario.
El criterio madre —un run es evidencia sobre el port, jamás sobre el original— hace que el
sentido de la divergencia (quién de los dos está desplazado) sea justo lo que el run no sabe.

## 2. La derivación: dos sitios del ASM que direccionan EL MISMO BYTE

### 2.1 La salida escribe la tabla EN CRUDO, antes de mirar la capa

`DUNGEON.OVL 0x1d08` (rutina de salida; es la que el propio port ya citaba por sus cadenas,
`dungeon-cmds.ts:452-454` → `0x1d1e`/`0x1d31`/`0x1d3b`):

```
1d08: 56                push si
1d09: a09358            mov al, byte ptr [g_location]
1d0e: 8bf0              mov si, ax
1d10: 8a84891e          mov al, byte ptr [si + 0x1e89]   ; tabla X por location
1d14: a29658            mov byte ptr [g_party_x], al
1d17: 8a84b11e          mov al, byte ptr [si + 0x1eb1]   ; tabla Y por location
1d1b: a29758            mov byte ptr [g_party_y], al
1d1e: b8846c            mov ax, 0x6c84                   ; "\nExit to "
1d25: 803e955800        cmp byte ptr [g_floor], 0        ; ← EL TEST DE CAPA, AQUÍ
1d2a: 740a              je 0x1d36
1d2c: c6069558ff        mov byte ptr [g_floor], 0xff     ; Underworld
1d31: b88e6c            mov ax, 0x6c8e                   ; "Underworld!"
1d36: c606955800        mov byte ptr [g_floor], 0        ; Britannia
1d3b: b89c6c            mov ax, 0x6c9c                   ; "Britannia!"
1d42: c606935800        mov byte ptr [g_location], 0
1d48: c3                ret
```

★ **El orden es el argumento.** Las dos coordenadas se escriben en `0x1d10-0x1d1b`, y el test
de capa está en `0x1d25` — **después**. Lo que la capa decide es sólo `g_floor` (0xFF / 0) y
qué cadena se imprime. No hay un solo `inc`/`add`/`dec` sobre `g_party_y` en ninguna de las dos
ramas, ni un término por costura. Y el índice es el mismo en las dos: `si = g_location`, leído
en `0x1d09`, **antes** de que `0x1d42` lo ponga a 0.

Los dos llamadores (los únicos, `grep "call 0x1d08"`) tampoco retocan la `y` al volver:

| llamador | qué lo dispara | retorno |
|---|---|---|
| `0x1dce` | `0x1db8` tile 5 (escalera arriba) con `0x1dbf cmp [g_floor],0` ⇒ subir desde planta 0; y `0x1dec` tile 6 con `0x1df3 cmp [g_floor],7 / jae` ⇒ bajar desde la 7 | `0x1dd1`: `push 1` + call, `cmp [g_location],0`, `ret`. Sin escritura |
| `0x1f44` | cola de `0x1c6a` (Uus/Des Por fuera de rango) | `0x1f47`: `mov ax,1` + `ret`. Sin escritura |

El censo de escrituras a `g_party_y` en todo `DUNGEON.OVL` da 6 sitios
(`0x00fd`, `0x04d7`, `0x04f3`, `0x05e4`, `0x06b3`, `0x1d1b`); los cinco primeros son
movimiento **dentro** del 3D (coordenada de mazmorra), y el sexto es esta salida.

### 2.2 Y la ENTRADA exige estar sobre esa MISMA celda — la identidad

`MAINOUT.OVL 0x0790` (el buscador de location del `(E)nter`):

```
079d: be2000            mov si, 0x20
07a0: 8a169658          mov dl, byte ptr [g_party_x]
07a4: 8a0e9758          mov cl, byte ptr [g_party_y]
07a8: 38948a1e          cmp byte ptr [si + 0x1e8a], dl    ; X de la tabla
07ac: 7522              jne 0x7d0
07ae: 388cb21e          cmp byte ptr [si + 0x1eb2], cl    ; Y de la tabla
07b2: 751c              jne 0x7d0
07b4: 8976fe            mov word ptr [bp - 2], si
...
0887: 8a46fe            mov al, byte ptr [bp - 2]
088a: fec0              inc al
088c: a29358            mov byte ptr [g_location], al     ; g_location = si + 1
```

★★ **Aquí se cierra.** La entrada usa base `0x1e8a`/`0x1eb2` con índice `si`, y fija
`g_location = si + 1`. La salida usa base `0x1e89`/`0x1eb1` con índice `g_location`. Luego:

```
entrada:  0x1e8a + si            salida:  0x1e89 + g_location = 0x1e89 + (si + 1) = 0x1e8a + si
```

**Es el mismo byte.** La entrada EXIGE que la party esté sobre esa celda (dos `cmp` con salto
a fallo) y la salida la devuelve a esa celda. Salir de una mazmorra deja a la party
exactamente donde estaba al entrar. Un desplazamiento por capa no es que no aparezca: es que
**rompería esa identidad**, y la identidad está escrita en dos overlays distintos.

Nota de direccionamiento, porque el `−1` despista: las dos bases son **base menos uno** porque
el índice es 1-based. Las tablas son contiguas: X en `0x1e8a-0x1eb1` (40 entradas, locations
1..40) e Y en `0x1eb2-0x1ed9`. Casa con `data.json` (`locationsX`/`locationsY`, 40 entradas,
`locationAt` → `i + 1`) y con `game.ts:4256` (`DS 0x1eaa`/`0x1ed2` = location 33, la primera
mazmorra: `0x1e89 + 33 = 0x1eaa`, `0x1eb1 + 33 = 0x1ed2`).

### 2.3 Control: la costura HERMANA ya lo hacía en crudo

`TOWN.OVL 0x07eb` (salir de un pueblo/keep al overworld) es el mismo idioma, byte por byte:

```
07eb: a09358            mov al, byte ptr [g_location]
07f0: 8bf0              mov si, ax
07f2: 8a84891e          mov al, byte ptr [si + 0x1e89]
07f6: a29658            mov byte ptr [g_party_x], al
07f9: 8a84b11e          mov al, byte ptr [si + 0x1eb1]
07fd: a29758            mov byte ptr [g_party_y], al
0800: 88269358          mov byte ptr [g_location], ah
```

—y ahí también la capa (`0x07c5 cmp [g_location],0x19` → `g_floor` 0xFF) se decide **aparte**
de la coordenada. El port ya calcaba ésta bien: `game.ts::exitToOverworld` (`5946-5960`) usa
`locationsX[idx]`/`locationsY[idx]` **sin sumar nada**. O sea que el port tenía las dos
costuras hermanas con criterios distintos, y sólo una de las dos cita el ASM.

Esto es además el control de POBLACIÓN del veredicto: la salida de pueblo la miden decenas de
costuras del espejo y del tour con la tabla en crudo. Si «la tabla en crudo» estuviera
desplazada una celda, no fallaría sólo la mazmorra.

## 3. Adjudicación

**SAPO REAL.** El port desplazaba `y+1` al salir a Britannia donde el original no desplaza
nada, en dos sitios:

| sitio | antes | ahora |
|---|---|---|
| `game/src/core/dungeon/dungeon-cmds.ts` `exitDungeonTo` | `y: (locationsY[idx] ?? 0) + (underworld ? 0 : 1)` | tabla en crudo, las dos capas |
| `game/src/core/dungeon/dungeon-cmds.ts` `setDungeonPos` (costura de arnés) | `y: (locationsY[idx] ?? …) + 1` | tabla en crudo (heredaba el `+1` del anterior) |

★ El `+1` **no era una hipótesis viva**: estaba FIJADO por los asertos del propio port
(`dungeon-set-pos-zero-rand.test.ts` esperaba `y: 233`; `e2e/dungeon.spec.ts` esperaba
`(240,74)` con un comentario que lo explicaba como «la casilla JUSTO al sur de la entrada de
Deceit»). Un test que fija lo que el código hace no puede detectar que el código se lo inventó;
sólo lo conserva. Los tres asertos se re-derivaron contra el ASM.

**Corolario que invierte el ticket viejo**: `espejo-e23-underworld.md` §3 y `espejo-final-f1-acta.md`
§3.4 dan por bueno el `+1` del port y declaran el **resync** desplazado. Es al revés: el resync
del runner (tabla en crudo) era el que estaba bien, y el fix hace **converger** el core con el
instrumento en vez de separarlos. La consecuencia práctica es la contraria de la temida: las
costuras de salida a Britannia que hoy se miden deberían mejorar, no moverse a peor. Las dos
notas quedan como estaban (son actas datadas de sus ventanas); esta acta las enmienda.

## 4. Verificación

- **Test nuevo con dientes**: `game/tests/dungeon-exit-tile.test.ts` (4 casos) — celda cruda a
  Britannia; misma celda al Underworld; **igualdad entre capas** (invariante estructural, no
  depende del valor de la tabla); e **ida y vuelta** entrar→salir (la identidad de §2.2). Las
  tablas del fixture usan series distintas y no correlativas (`10+3i` / `200−2i`) para que un
  índice cruzado o un eje intercambiado no puedan pasar.
- **Mutante** (commit limpio, reintroducir `+ (underworld ? 0 : 1)`): **mata 3 de 4**, y deja
  verde exactamente el del Underworld — que es el control, porque esa rama no la toca el
  mutante. El poder discriminante está medido, no supuesto.
- Suite unitaria completa, `tsc --noEmit` en los dos tsconfigs y los gates de prosa: ver §6.

## 5. Lo que NO se ha hecho — y el RESELLO que este fix debe arrastrar

⚠ **`game/e2e/grandtour/ch14-deceit.spec.ts` sale de Deceit a Britannia**, así que su punto de
emergencia pasa de `(240,74)` a `(240,73)`. `saves/*.gam` y `covered.*.json` **sí se commitean**
(`grandtour/.gitignore`), luego el fix exige **resellar ch14** y no se puede aterrizar solo:

- `saves/ch14.gam` + `ch14.sidecar.json` — regenerar (cambia el byte de `PARTY.y`).
- `ch14-deceit.spec.ts` — la cadena de `cov.note` dice literalmente «sello desde Britannia,
  **240,74**», y las cabeceras de :19 y :36 también. Como el literal viaja a `covered.ch14.json`,
  hay que editarlo **en la misma pasada** del resello o el sello queda mintiendo.
- `ch14b` importa `ch14.gam`: su estado de partida cambia, pero **sella en el Underworld**
  (`(240,73)`, `+0` en las dos puntas) → su `.gam` no debería moverse. **Hay que comprobarlo,
  no darlo por hecho.**
- **`ch15` no se deriva afectado**: su `EMERGE` es `(240,73)` —el Underworld, que no cambia— y
  su trail arranca en `(240,74)` porque da un paso al sur, no por el `+1`.

**No he corrido el tour ni tocado un solo fichero de `grandtour/`**: el mutex es de la sesión
orquestadora, hay otro carril con `ch14b` abierto, y la ventana siguiente es la REGRABACIÓN DE
VÍDEOS. El resello es decisión de secuencia del lead, no un efecto colateral que este carril
deba provocar.

Tampoco se ha corrido el espejo: la predicción de §3 (las costuras de salida a Britannia
mejoran al converger core e instrumento) queda **anotada y sin medir**, que es como debe quedar
—una predicción anotada rinde; una medida inventada, no—.

## 6. Cifras

- `npx tsc --noEmit` y `npx tsc --noEmit -p tsconfig.e2e.json`: **EXIT 0**.
- `npx vitest run` desde `game/`: ver el commit (suite completa, sin rojos).
- `pytest re/tools/test_genesis_manifiesto.py test_strcites.py test_frontier.py`: **verde**.
- Ficheros de producción tocados: **1** (`dungeon-cmds.ts`, dos sitios). Tests: **2**
  (uno nuevo, uno re-derivado) + **1** aserto e2e (`dungeon.spec.ts`).
