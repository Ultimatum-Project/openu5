# ACTA — #178(c): los cuatro residuos de `resolve_command_char` (kernel `0x4988`)

> Carril `naval-216`, rama `fix/naval-216` (RETENIDA). Cuerpo leído ENTERO
> `ULTIMA.EXE:0x4988`-`0x4a83` (252 B, `ret` sin argumentos) y el de su hermano
> `ULTIMA.EXE:0x2d7a`-`0x2e8b` (`ret 2`, un argumento) más la envoltura
> `ULTIMA.EXE:0x2e8e`. Los cuatro residuos vienen del anexo §6.1 de
> `re/notes/ledger-169-acta.md`, que los apuntó SIN adjudicar.
>
> **Ninguno se ha portado en este carril.** Esta acta ADJUDICA; el cableado va con
> tarjeta propia porque toca un flujo modal de UI (`ui/pickers.ts`).

## 0. El aparato, en una tabla

`g_combat_actor_records` (`0xba14`, 32 registros de 8 B) — layout **del ledger de
globales**, no supuesto aquí: `+2` flags (bit `0x80` = miembro del party, bit `0x20` =
caído), `+3` slot de roster, `+4` ranura en `0x5c5a`, `+6` X, `+7` Y.
`g_cmb_actor` (`0x589e`) = índice 0..31 del combatiente activo.

| rutina | offset | instrucción | qué hace |
|---|---|---|---|
| `resolve_command_char` | `ULTIMA.EXE:0x4995`, | `cmp byte ptr [g_location], 0x80` / `jbe 0x49b2` | rama de combate si `g_location` **> 0x80** |
| `resolve_command_char` | `ULTIMA.EXE:0x499c`, | `mov bl, byte ptr [g_cmb_actor]` / `shl bx,3` | índice → desplazamiento de registro |
| `resolve_command_char` | `ULTIMA.EXE:0x49a6`, | `mov al, byte ptr [bx - 0x45e9]` | **campo +3** (`0xba14`+idx·8+3) → devuelto TAL CUAL |
| `select_party_member` | `ULTIMA.EXE:0x2d91`, | `cmp byte ptr [g_location], 0x7f` / `jbe 0x2db2` | rama de combate si `g_location` **> 0x7f** |
| `select_party_member` | `ULTIMA.EXE:0x2da3`, | `test byte ptr [si - 0x45ea], 0x80` / `je 0x2db2` | ★ **campo +2, bit 0x80**: «esto es un PJ» |
| `select_party_member` | `ULTIMA.EXE:0x2daa`, | `mov al, byte ptr [si - 0x45e9]` | campo +3, ya validado |

## 1. Residuo (1) — el test del bit `0x80`: CONFIRMADO, y es un bug de VALOR

`select_party_member` (`ULTIMA.EXE:0x2d91`-`0x2daf`) hace tres pasos: umbral de
localización → **test del bit `0x80` del campo +2** → lectura del campo +3.
`resolve_command_char` (`ULTIMA.EXE:0x4995`-`0x49ac`) hace el primero y el tercero, y se
salta el segundo.

Consecuencia derivada del layout del ledger: si `g_cmb_actor` apunta a un MONSTRUO, su
campo +2 no tiene el bit `0x80`, y su campo +3 **no es un slot de roster**.
`resolve_command_char` lo devuelve igualmente como índice de miembro del party. No es
una diferencia de estilo: los dos leen el MISMO byte, y sólo uno comprueba que
signifique lo que van a hacer con él.

Que es asimetría del binario y no del disasm lo sostiene el tercer pariente: el gemelo
`ZSTATS.OVL:0x0000`, con el mismo esqueleto (rama de combate, prompt «Player: », eco
del nombre, `-1`→«None!») — dos de tres comprueban.

## 2. Residuo (2) — el umbral: la pregunta del encargo está MAL PLANTEADA

El encargo pedía «derivar cuál es el fiel» entre `>0x80` y `>0x7f`. **No hay un fiel y
un infiel**: son dos rutinas distintas con dos umbrales distintos, y cada una es fiel a
sí misma. Un port que las igualara estaría fabricando. Lo que sí se puede derivar —y es
lo que decide si la discrepancia importa— es **si el valor discriminante es alcanzable**.

Los dos predicados sólo difieren en `g_location == 0x80` EXACTAMENTE.

CENSO de escrituras a `g_location` en los 30 `.asm` del corpus (`re/disasm`, HEAD
`205cbdcd`; unidad = sitios de escritura, población = 33):

| forma | sitios | valores |
|---|---|---|
| literal | 19 | `0xff`(6) · `0x40`(5) · `0`(3) · `0x41`(2) · `4` · `0x42` · `0x12` · `0x11` |
| registro | 14 | ver abajo |

Los 14 de registro, leídos uno a uno con 7 instrucciones de contexto:
5 copian `g_unk_5894` (localización previa; el único sitio que la gatea, `CMDS.OVL:0x0322`,
exige `< 0x21`) · 2 son `[bp-N] + 1` sobre el índice de la tabla de localizaciones
(`MAINOUT.OVL:0x088c`, `OUTSUBS.OVL:0x0420`) · 1 lee la tabla `0x5840`
(`ULTIMA.EXE:0x483d`) · 1 lee `[0xbd15]` (`CAST2.OVL:0x10e7`) · 1 es IDENTIDAD
(`INTRO.OVL:0x1332` lee `g_location` y lo reescribe) · 1 escribe `ah`, que vale 0 por el
`sub ah, ah` de `TOWN.OVL:0x07ee` · 3 más de INTRO, en la banda de pantallas `0x40`-`0x42`.

**Ninguna produce `0x80` en esta lectura.** ⚠ Pero NO está cerrado: tres de ellas
(`MAINOUT.OVL:0x088c`, `OUTSUBS.OVL:0x0420`, `ULTIMA.EXE:0x483d`) dependen de CONTENIDOS
DE TABLA que no he volcado. Lo que se afirma es una COTA, no una ausencia: *ningún sitio
de escritura literal produce `0x80`, y ninguna de las 14 rutas de registro lo produce por
su forma*. Cerrar el «no es alcanzable» exige volcar esas tres tablas — está fuera de esta
acta y es lo que impide dar el residuo (2) por resuelto.

⇒ VEREDICTO PROVISIONAL: discrepancia **REAL en los bytes, probablemente INOBSERVABLE**.
El port no debe tocarla en ninguna dirección: debe copiar el umbral de la rutina que
esté portando, cada una con el suyo.

## 3. Residuo (3) — la rama `-2` es INALCANZABLE: CONFIRMADO por camino completo

`resolve_command_char` trata `-2` en `ULTIMA.EXE:0x4a6e` (`cmp word ptr [bp - 8], -2` →
salto de línea). `[bp-8]` sólo puede valer `-2` si se lo pasa `si`, y `si` viene de
`ULTIMA.EXE:0x4a09` `call 0x2e8e`.

La envoltura `ULTIMA.EXE:0x2e8e` es literalmente `sub ax, ax` / `push ax` /
`call 0x2d7a`: **fuerza el argumento a 0**.

Dentro de `select_party_member`, `-2` nace en un único sitio,
`ULTIMA.EXE:0x2e44` `mov word ptr [bp - 2], 0xfffe`, y se llega ahí sólo por
`ULTIMA.EXE:0x2e3e` `cmp word ptr [bp + 4], 0` / `je 0x2e19` — es decir, **sólo con
argumento ≠ 0**. Con argumento 0 la tecla `'0'` (`ULTIMA.EXE:0x2e67`) vuelve al bucle.

⇒ Con el único camino de entrada que usa `resolve_command_char`, `-2` no se produce
jamás. Las instrucciones CS `0x4a6e`-`0x4a7a` son CÓDIGO MUERTO para este caller (vivo para el otro
caller de `0x2d7a`, el que pasa argumento ≠ 0). El port no debe modelarlo.

## 4. Residuo (4) — ~~`pickCommandChar` sin rama de combate: CONFIRMADO Y ALCANZABLE~~ **REFUTADO (ver §6)**

> 🔴 **Esta sección entera quedó refutada el 22-08.** Se conserva verbatim porque su
> ⚠ del final es la que llevó al carril siguiente a medir el dato que faltaba; pero
> `g_location` en el PASILLO de mazmorra vale `0x21..0x28`, no 0xFF (el 0xFF de
> `DUNGEON.OVL:0x00a8` es de la SALA, que es un combate), así que la rama del `jbe` que
> toma la mazmorra es la que PREGUNTA — el port ya era fiel. Derivación, controles y el
> cierre de la contradicción, en **§6**. Lee §6 antes de citar nada de aquí.


`game/src/ui/pickers.ts:118` implementa los caminos 2, 3 y 4 (activo→directo ·
≤1 elegible→auto · si no, prompt «Player: » + nombre + `None!`) y **no tiene el camino 1**
(`ULTIMA.EXE:0x4995`).

★ Y no es una rama de un rincón: `g_location = 0xff` se escribe al entrar en COMBATE
(`CMDS.OVL:0x0332`, `CAST2.OVL:0x0ea4`, `ULTIMA.EXE:0x5fb4`) **y al entrar en MAZMORRA**
(`DUNGEON.OVL:0x00a8`, `BLCKTHRN.OVL:0x06fc`, `BLCKTHRN.OVL:0x0951`). En los dos casos
`> 0x80` se cumple, y `g_cmb_actor` tiene escritores en `DUNGEON.OVL` además de en
`COMBAT.OVL`. El port llama a `pickCommandChar` precisamente para el (S)earch y el (L)ook
DE MAZMORRA (`game/src/core/dungeon/dungeon.ts:575`, `:793`).

⚠ **CONTRADICCIÓN MEDIDA que esta acta abre y NO cierra.** La evidencia de
`re/ledger/frontier.json` para `0x4988` dice «Es el "Player:" que precede a los comandos
de mazmorra». Si en mazmorra `g_location == 0xff`, la rutina toma la rama 1 y **no llega
al prompt**: no habría «Player: » en mazmorra. El testigo vivo que respalda el prompt
(«Player: Min», LP P08 E11, citado en `pickers.ts`) es del (S)earch de superficie
(`SJOG.OVL:0x09a0`), donde `g_location` es pequeño y el prompt sí corresponde — o sea, el
testigo NO cubre el caso de mazmorra.
Lo que falta para cerrarla: el valor de `g_cmb_actor` (y del campo +3 de su registro)
mientras se anda por una mazmorra. Si vale 0 y el +3 es 0, la conducta observable coincide
con el prompt auto-resuelto y la frase del ledger es inocua-pero-imprecisa; si no, es
falsa. **No lo he medido: no lo afirmo en ninguna dirección.**

## 5. Qué queda, y por qué no se toca aquí

| residuo | veredicto | acción |
|---|---|---|
| (1) bit `0x80` | asimetría REAL entre parientes, derivada del layout del ledger | tarjeta: no es del port hasta que el port modele la rama 1 |
| (2) umbral `0x80`/`0x7f` | real en bytes, cota de inalcanzabilidad medida y NO cerrada | tarjeta: volcar 3 tablas; el port copia el umbral de SU rutina |
| (3) rama `-2` | INALCANZABLE por este caller — camino completo leído | nada que portar; queda documentado |
| (4) rama de combate en `pickCommandChar` | ~~hueco CONFIRMADO y ALCANZABLE (mazmorra)~~ **REFUTADO, §6** | nada que cablear |

Cablear (4) sin cerrar antes la contradicción de §4 sería portar una rama cuya conducta
observable no está medida. Es exactamente la trampa de #157 (mecánica archivada bajo la
etiqueta equivocada) vista desde el otro lado.

## 6. Residuo (4), REFUTADO — y la contradicción de §4, CERRADA (22-08, carril `cast-completo`)

La cautela de §5 era correcta y el veredicto de §4 no. La rama de `@0x4995` existe y es
alcanzable, pero **no por donde decía la ficha**, y en el sitio donde sí lo es el port ya
la implementa. Nada que cablear en `pickCommandChar`.

### 6.1 La mitad de MAZMORRA: `g_location` en el pasillo NO es 0xFF

§4 la daba por buena a partir de `DUNGEON.OVL:0x00a8 mov byte [g_location],0xff`. Esa
escritura es real, pero **no es la del pasillo**: está en `DUNGEON.OVL:0x0000`, la rutina
de **SALA**, y su vecindario lo delata —

```
0037: a29e58      mov byte ptr [g_cmb_actor], al   ; al = 0xff  ← también 0xFF, no 0
003a: a09358      mov al, byte ptr [g_location]
003d: 2d2100      sub ax, 0x21                     ; ⇒ aquí g_location YA es 0x21..0x28
...
00a8: c6069358ff  mov byte ptr [g_location], 0xff  ; entra el modo «combate»
00b9: e8b2f9      call → DNGLOOK.OVL:0x117e
00bc: e881d6      call → kernel 0x5910
00c4: e89bf9      call → COMBAT.OVL:0x0b94         ★ la sala ES un combate
00d8: a29358      mov byte ptr [g_location], al    ; al = g_unk_5894 — RESTAURA
0109: a29358      mov byte ptr [g_location], al    ; ídem, la otra salida
```

El `sub ax, 0x21` de `0x003d` fija el rango del pasillo por construcción, y las escrituras
de `0x00d8`/`0x0109` lo devuelven antes de seguir. Quién lo puso ahí: `MAINOUT.OVL:0x0887`
`mov al,[bp-2]` / `0x088a inc al` / `0x088c mov [g_location],al`, y **las cuatro
instrucciones siguientes son la inicialización de MAZMORRA** (`cmp byte [g_floor],0`,
`cmp al,0x28`, `g_floor=7`, `g_dng_facing=3`, `g_party_x/y=7`) — o sea, las mazmorras
viven en esa misma numeración de localizaciones.

**Control independiente, que no depende de leer bien ninguna de esas rutinas.** La tabla
de ventanas DS `0x1C90` reparte cuatro bits (`8` exterior · `4` pueblo · `2` mazmorra ·
`1` combate) y el gate `CAST.OVL:0x0e1a-0x0e8e` decide cuál probar por `g_location`:
`0x0e2c cmp [g_location],0x7f` / `jbe` manda a la rama de **combate** todo lo `> 0x7f`, y
el bit de **mazmorra** sólo se prueba en `0x0e86`, detrás de `0x0e74 cmp [g_location],0x21`
/ `jae`. Volcado crudo de `DATA.OVL` (fileoff `0x1ca0` + idx): **Uus Por (21) = 0x02** y
**Des Por (22) = 0x02**, es decir mazmorra y NADA más. Si en el pasillo `g_location` valiera
0xFF, los dos hechizos de mazmorra por excelencia serían incastables. ⇒ `g_location ≤ 0x80`
en el pasillo ⇒ el `jbe` de `@0x499a` toma la vía que **PREGUNTA**.

⇒ **La contradicción de §4 se cierra a favor de `re/ledger/frontier.json`**: sí hay
«Player: » delante de los comandos de mazmorra, y el testigo del (S)earch de superficie
no hacía falta que la cubriera. El port ya era fiel ahí (`main.ts doDungeonCast` →
`pickCaster`; `(S)earch`/`(L)ook` de mazmorra → `pickCommandChar`).

### 6.2 La mitad de COMBATE: alcanzable, y ya portada

El censo de llamadores de `0x4988` (near-calls resueltos con `re/tools/dispatch_table.py`
sobre los 24 overlays; control positivo `CAST.OVL→0x1850` = 68 sitios, control negativo
`→0x0001` = 0) da **once** sitios en **cuatro** overlays: `CAST.OVL:0x0dd5`,
`SJOG.OVL` ×8, `LOOKOBJ.OVL:0x09ea`, `DNGLOOK.OVL:0x0007`. Ninguno en `COMBAT.OVL` ni en
`DUNGEON.OVL` — pero el camino existe igual, porque el (C)ast de combate **reentra en el
mismo handler de overlay que el del kernel**:

```
COMBAT.OVL:0x0abe  sub ax,0x42 / cmp ax,7 / jmp word cs:[bx-0x52a2]   ; jump table @0x0ace
   ↳ 'C' (0x43) → CS 0xab80 − base 0xA290 = COMBAT.OVL:0x08f0
COMBAT.OVL:0x08f0  print DS 0x6df6 «Cast...» · si = g_cmb_actor
             0x0909  test byte [bx-0x45ea], 0x80   ★ ¿el actor es un PJ?  (residuo (1))
             0x095e  call → CAST.OVL:0x0dba        ; el MISMO entry que el 'C' del kernel
CAST.OVL:0x0dd5    call 0x8a08 → kernel 0x4988 con g_location = 0xFF ⇒ rama @0x4995
```

Dos consecuencias:

1. **El port ya la implementa.** El (C)ast de combate de `main.ts` (~2819) no llama a
   `pickCaster`: toma `cur.charIdx`, que es el actor del turno = `g_cmb_actor`. Es
   exactamente lo que hace `@0x499c-0x49ac` (leer el campo `+3` de su registro).
2. **El residuo (1) queda desactivado en la práctica por esta vía.** §1 lo describió como
   «bug de valor»: `0x4988` lee el campo `+3` sin comprobar antes el bit `0x80` del campo
   `+2` que sí comprueba `select_party_member`. En el único camino de combate que llega
   aquí, **el llamador lo comprueba por él**: `COMBAT.OVL:0x0909 test byte [bx-0x45ea],0x80`
   con `bx = g_cmb_actor·8`, el MISMO byte y el MISMO bit, y `je 0x0964` corta antes de
   `0x095e`. No convierte al residuo (1) en falso —la asimetría entre las dos rutinas
   sigue en los bytes— pero sí explica por qué no es observable.

### 6.3 Qué sí se cableó (los otros dos residuos del bloque de `cast-input.md §9`)

No son de esta acta, pero cerraron en el mismo carril y comparten epílogo: 0 elegibles →
`None!` (DS `0xa3da`, `@0x4a5f`/`@0x4a65`) y el bucle de re-pregunta con `Disabled!`
(DS `0xa3ce`, `@0x4a4e` → `@0x4a55`/`@0x4a57`). Ver `cast-input.md §9` y
`game/tests/pickers-unit.test.ts`. Los residuos (2) —umbral `0x80`/`0x7f`— y (3) —rama
`-2` inalcanzable— siguen como los dejó §5: sin acción para el port.
