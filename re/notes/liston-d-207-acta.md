# ACTA #207 — FINISHER, TANDA 1: el grupo de `SJOG`, 5 pares, 3 lecturas — y el PRIMER par FALSO del carril

> ⚠ **CORRECCIÓN DEL LEAD (30-07 ~01:10), doble.** (1) El commit de rescate (`5a579fd3`)
> decía que este carril «murió antes de mandar su derivación»: **FALSO** — el carril seguía
> vivo, desactivó él mismo la bomba del índice compartido (restore --staged + rm de SOLO su
> fichero, antes de los ⛔ del lead) y entregó después su derivación completa. (2) El
> veredicto (a) de `SJOG.OVL:0x0e42` de este acta queda **CONCEDIDO a (b) por su propio
> autor, con derivación**: leído el PRÓLOGO de la rutina (0x0d4a) y sus guardas
> (0x0d52/0x0d59 acotan g_location fuera de 0x21-0x28; 0x0d60 desvía la mazmorra con
> call+jmp FUERA de la rutina), quien llega a 0x0e22 no puede estar en mazmorra ⇒ la
> etiqueta «en mazmorra el chequeo se salta» nombra un estado INALCANZABLE — (b) de manual,
> como adjudicó liston-c. Las cinco afirmaciones MECÁNICAS del par siguen exactas; cae la
> etiqueta. ⇒ **Las dos lecturas independientes CONVERGEN 5/5** (3a·1b·1d idéntico) y el
> «provisionalmente» del commit de rescate queda RETIRADO: el control de reproducibilidad
> de SJOG es pleno. Lección del autor, citada: «etiquetar algo como abierto-en-otra-tarjeta
> me hizo dejar de mirar — antes de aceptar la etiqueta de un gate, lee el PRÓLOGO de su
> rutina, no solo el rango citado».

> Carril `liston-d-207`. Worktree `.claude/worktrees/liston-c-207` **ADOPTADO** (ver §1.1), rama
> `re/liston-c-207`, base **main `0a46a44a`**.
> Continúa `liston-b-207-sub3-acta.md` (en main como `a033baa4`), que a su vez continúa
> `liston-b-207-sub2-acta.md` (`49b40ceb`), `liston-207-t2-acta.md` (SUB-TANDA 1) y
> `liston-207-acta.md` (HITO 1, `0a8ed045`).
> Ejecuta el orden recomendado por la sub-tanda 3 §5: *«1º `SJOG.OVL` (5)»*.
> RETENIDA: aterriza el lead.

---

## 0. VEREDICTO

**5 pares · 4 (a) exacta · 0 (b) · 0 (c) · 1 (d)** — en **3 lecturas** (ritmo 0,60).

| par | fichero del port | veredicto |
|---|---|---|
| `SJOG.OVL:0x0ad4` | `core/world/search.ts:42` | **(a)** exacta — la cadena de comparaciones de 2º nivel |
| `SJOG.OVL:0x0ae8` | `core/world/search.ts:36` | **(a)** exacta — el default, y **15 cadenas** byte a byte |
| `SJOG.OVL:0x0b6e` | `core/world/commands.ts:786` | **(a)** exacta — **15 líneas de ASM transcritas, 15/15** |
| `SJOG.OVL:0x0e42` | `core/game.ts:3551` | **(a)** exacta en las cinco afirmaciones mecánicas |
| `SJOG.OVL:0x0ee4` | `core/combat/combat.ts:3398` | ★★ **(d)** — **EL PAR ES FALSO**: la cita es de OTRO overlay (§3.3) |

★★ **ROMPE EL PLENO DE 25 (a) DEL CARRIL, y no por una cita mala: por una cita BUENA mal
emparejada.** El texto de `combat.ts:3398` es **exacto** —comprobado instrucción a instrucción— pero
lo es de **`COMBAT.OVL:0x0EE4`**, no del `SJOG.OVL:0x0ee4` con el que la banda lo casó. Y el mismo
offset tiene su cita **correcta** en `game.ts:3618`, que la banda **no ve**. Los dos fallos tienen
mecanismo derivado (§3.3) y son las dos caras de **#217**.

Y **cuatro cosas declaradas que NO son veredicto**, en §4:

| | qué |
|---|---|
| ★★ **El eje de atribución premia el fallo que debía cazar** | `distancia` y `tokens_ventana` dan la etiqueta MÁS LIMPIA justo cuando el dueño verdadero está LEJOS (§4.1) |
| **1 offset que no cae en frontera** | `0x0b2e`: la tabla inline acaba en `0x0b2b` y el código real arranca en `0x0b2c` — el desplazamiento lo hereda del disasm (§4.2) |
| **1 comentario RANCIO (#194)** | `game.ts:3618` dice «Unlocked**!**\n» y el binario pone `'Unlocked\n'` **sin** admiración — **el código del port acierta**, el comentario no (§4.3) |
| **1 glosa que depende de #184** | «en mazmorra» para `g_location >= 0x80`; el port lo **implementa literal**, sólo lo glosa (§4.4) |

## 1. RE-ANCLA de esta tanda, sobre LA BANDA ENTERA

```
git log -1 main                → 0a46a44a
cita_pegajosa_atribucion.py    → 348 pares, 3 controles verdes            EXIT=0
cita_pegajosa_forma.py         → matriz completa, 3 controles verdes      EXIT=0
clase2 × (FORZADA + LIMPIA)    → 3 + 50 = 53
```

Cotejo **POR MIEMBROS** contra la lista de los 53 del HITO 1 (§2 de `liston-207-acta.md`), no por
conteo:

| | resultado |
|---|---|
| bajas (en el HITO 1, no hoy) | **0** |
| altas (hoy, no en el HITO 1) | **0** |
| intersección | **53 / 53** |

⚠ La banda entera **ha CRECIDO**: 341 → **348** pares entre `ed79e793` y `0a46a44a` (+7, por
prosa de otros carriles). **Mi celda NO se ha movido**, y eso es lo que dice la intersección de
53/53: si alguna de las 7 altas hubiera caído aquí, la intersección sería menor. El conteo por sí
solo también habría dicho 53=53 y no habría probado nada — el modo de fallo de #206.

### 1.1 Adopción del worktree, respondida POR CONTENIDO

El carril anterior (`liston-c-207`) murió sin commitear. Comprobado antes de adoptar:

| comprobación | resultado |
|---|---|
| `git log --oneline main..re/liston-c-207` | **vacío** ⇒ cero commits propios |
| `git merge-base --is-ancestor a033baa4 main` | **sí** ⇒ su HEAD era la sub-tanda 3, ya aterrizada |
| `git status --short` | vacío |
| symlinks (`node_modules` · `game/node_modules` · `game/assets` · `original` · `re/disasm/*.asm`) | **68 · 4 · 42 · 11 · 28**, los cinco exactos |

⇒ adoptado y fast-forward a `ed79e793`. ⚠ La rama conserva el nombre `re/liston-c-207` aunque el
acta lleve el mío; se dice para que no chirríe al aterrizar.

### 1.2 ⚠ RE-ANCLA DE LÍNEAS: dos de mis doce se habían MOVIDO

`git diff a033baa4..main -- game/src` sale **vacío**, pero contra la base del HITO 1 (`994d4fc2`)
**no**: cambiaron `commands.ts` y `combat.ts`.

| par | línea en el HITO 1 | línea HOY | |
|---|---|---|---|
| `SJOG.OVL:0x0b6e` | `commands.ts:775` | `commands.ts:786` | **+11** |
| `SJOG.OVL:0x0ee4` | `combat.ts:3381` | `combat.ts:3398` | **+17** |
| los otros 10 | — | — | intactas |

⇒ Tercera cobranza de la regla de la sub-tanda 2 §1.1: **la tabla par→LÍNEA de un hito caduca; la
tabla par→OFFSET no**. Se toman como autoritativas las líneas del volcado de HOY.

## 2. Los cinco pares agrupan en TRES lecturas

| lectura | pares | rutina del binario | fichero(s) del port |
|---|---|---|---|
| §3.1 | `:0x0ad4` + `:0x0ae8` + `:0x0b6e` | `SJOG.OVL:0x095c-0x0ba9` (el (S)earch entero) | `search.ts` **+** `commands.ts` |
| §3.2 | `:0x0e42` | el (J)immy sobre cepo, `SJOG.OVL:0x0e22-0x0ee4` | `game.ts` |
| §3.3 | `:0x0ee4` | **ninguna de SJOG** — la cita es de otro overlay | `combat.ts` |

★ **Cuarta confirmación seguida del regalo de `sueltos-174-acta` §2**, y la más fuerte hasta ahora:
los tres pares de §3.1 caen en **UNA sola rutina**, `SJOG.OVL:0x095c-0x0ba9`, comprobada **por
alcance**: hay marco de pila en `0x095c`, el único `ret` del rango está en `0x0ba9`, y **no hay
ningún prólogo oculto por medio** (barrido de `push bp` en `0x095d-0x0ba9`: CERO — la regla de
`asm-prologos-ocultos-pad-byte`). Los ocho `retf` que el listado enseña de `0x0b03` a `0x0b2b`
**no son retornos**: son la tabla de saltos de §3.1-C mal decodificada.

## 3. Las tres lecturas

### 3.1 `SJOG.OVL:0x095c-0x0ba9` — el (S)earch entero, en dos ficheros del port

#### A. La cadena de 1er nivel y los dos pares

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SJOG.OVL:0x0a6a`, | `mov ax, word ptr [bp - 0xe]` | — | **el TILE apuntado**: entra el switch |
| `SJOG.OVL:0x0a6d`, | `cmp ax, 0xa5` / `je 0xa9e` | `0x0a9e` | escritorio |
| `SJOG.OVL:0x0a72`, | `jg 0xaee` | `0x0aee` | `> 0xa5` ⇒ a la tabla con stride |
| `SJOG.OVL:0x0a74`, | `cmp ax, 0x4f` / `je 0xace` | `0x0ace` | muro |
| `SJOG.OVL:0x0a79`, | `jg 0xad4` | `0x0ad4` | ★ **el par: al 2º nivel de comparaciones** |
| `SJOG.OVL:0x0a7b`, | `cmp ax, 0x2b` / `jne 0xae8` | `0x0ae8` | tocón; si no, **al default** |
| `SJOG.OVL:0x0a83`, | `push ax` / `call 0x58d0` | — | **el impresor COMPARTIDO por las 14 ramas** |
| `SJOG.OVL:0x0ad4`, | `cmp ax, 0x5a` / `je 0xa8c` | `0x0a8c` | estante |
| `SJOG.OVL:0x0ad9`, | `cmp ax, 0x5c` / `jl 0xae8` | `0x0ae8` | por debajo ⇒ default |
| `SJOG.OVL:0x0ade`, | `cmp ax, 0x5d` / `jle 0xa92` | `0x0a92` | `0x5c`-`0x5d` ⇒ librería |
| `SJOG.OVL:0x0ae3`, | `cmp ax, 0xa1` / `je 0xa98` | `0x0a98` | pozo |
| `SJOG.OVL:0x0ae8`, | `mov ax, 0x8a34` | — | ★ **el par: el DEFAULT** |
| `SJOG.OVL:0x0aee`, | `sub ax, 0xa6` / `cmp ax, 0x16` / `ja 0xae8` | `0x0ae8` | fuera de tabla ⇒ default |
| `SJOG.OVL:0x0af9`, | `jmp word ptr cs:[bx - 0x3582]` | — | **el salto indexado** |

**`:0x0ad4` — (a) exacta.** El par es el destino del `jg` de `0x0a79` y **es** el arranque del bloque
de 2º nivel. La cita escribe *«`0x5a` shelf · `0x5c`-`0x5d` bookshelf (`0xad4`-`0xae1`)»*: el rango
cubre **exactamente** ese bloque —de `0x0ad4` a `0x0ae1`, sus dos extremos— y dentro caen los
dos ítems que la frase enumera y **sólo** esos dos. ⚠ Lo digo porque tiene lectura torcida: en esa
misma lista los demás paréntesis son **puntos** (`0x2b` stump `→ 0xa7b`, `0x4f` wall `→ 0xa74`,
`0xa5` desk `→ 0xa6d`), todos ellos el `cmp` exacto; quien extienda esa convención al paréntesis de
`bookshelf` leería que el `cmp` de `0x5c` está en `0x0ad4`, y está en `0x0ad9`. **Bajo la lectura de
RANGO —la única compatible con que sea un rango— la cita es exacta**, y el rango es además el
ajustado, no uno holgado.

**`:0x0ae8` — (a) exacta**, y es la más verificada del lote. El par es el default y la cita dice
*«Default: `\nT` (DS `0x8a34`) + remate = `\nThou dost find\n`»*. Las **quince** entradas de la tabla
del port se cotejaron byte a byte contra `DATA.OVL` (`fileoff = DS + 0x10`) y **salen 15/15**:

| tile | DS | medido en `DATA.OVL` | tile | DS | medido |
|---|---|---|---|---|---|
| `0x2b` | `0x8950` | `b'\nIn the stump\nt'` | `0xa6` | `0x89a6` | `b'\nIn the barrel\nt'` |
| `0x4f` | `0x8a24` | `b'\nIn the wall\nt'` | `0xa8` | `0x89b8` | `b'\nIn the vanity\nt'` |
| `0x5a` | `0x8960` | `b'\nOn the shelf\nt'` | `0xab`/`0xac` | `0x89ca` | `b'\nUnder the bed\nt'` |
| `0x5c`/`0x5d` | `0x8970` | `b'\nIn the bookshelf\nt'` | `0xad` | `0x89dc` | `b'\nIn the dresser\nt'` |
| `0xa1` | `0x8984` | `b'\nNear the well\nt'` | `0xaf` | `0x89ee` | `b'\nIn the trunk\nt'` |
| `0xa5` | `0x8996` | `b'\nIn the desk\nt'` | `0xb2` | `0x8a12` | `b'\nIn the brazier\nt'` |
| default | `0x8a34` | `b'\nT'` | `0xbc` | `0x89fe` | `b'\nIn the fireplace\nt'` |
| remate | `0x8a38` | `b'hou dost find\n'` | | | |

★ **Y la afirmación que parecía decorativa resulta ser la clave del diseño**: la cita dice que cada
rama *«imprime su string DS (que termina en `t`)»*. Es **literal y es lo que hace que el truco
funcione**: las 13 cadenas de mueble acaban en **`t` minúscula** y el default en **`T` mayúscula**,
y las dos empalman con el mismo remate `hou dost find\n` para dar *«…thou dost find»* o
*«\nThou dost find»*. El valor de cada entrada de la tabla del port es **exactamente** la
concatenación de las dos cadenas medidas; ninguna se escribió a ojo.

Las otras tres cadenas de la frase, también byte a byte: DS `0x86cc` = `b'nothing of note.\n'` ·
DS `0x8a48` = `b'a hidden door!\n'`. Las dos empiezan en **minúscula**, que es justo lo que la cita
afirma al decir que el resultado *«continúa la MISMA frase en minúscula»*.

#### B. La tabla de saltos inline, decodificada — y el rango que sí sale

La cita afirma *«tabla `0xa6`-`0xbc`: barrel/vanity/bed/dresser/trunk/brazier/fireplace»* y que el
remate vive *«tras la jump-table inline `0x0afe`, decodificada palabra a palabra con base
SJOG `0xBF80`»*. Las **tres** partes se comprobaron:

- el salto es `jmp word ptr cs:[bx - 0x3582]` con `bx = 2·(tile − 0xa6)`; `−0x3582` en 16 bits es
  `0xCA7E`, y `0xCA7E − 0xBF80 = 0x0AFE` ⇒ **la base declarada es la que hace cuadrar la tabla**;
- el gate `cmp ax, 0x16 / ja` admite `0..0x16` = **23 entradas** = 46 bytes ⇒ la tabla ocupa
  `0x0afe-0x0b2b`, que es exactamente la región que el listado devuelve como basura;
- decodificadas las 23 palabras y restada la base, los destinos **reproducen la tabla del port
  entrada por entrada**: `0xa6`→barrel · `0xa8`→vanity · `0xab` y `0xac`→**el mismo** destino (bed) ·
  `0xad`→dresser · `0xaf`→trunk · `0xb2`→brazier · `0xbc`→fireplace, y **las 16 posiciones restantes
  apuntan al default**. Siete ítems y ni uno de más.

#### C. `:0x0b6e` — quince líneas de ASM transcritas, y quince que cuadran

El par vive en el **mismo** flujo, ya en `commands.ts`, que transcribe la rama de puerta secreta
LITERALMENTE. Cotejadas una a una contra el listado: **`0x0b33` · `0x0b37` · `0x0b39` · `0x0b3c` ·
`0x0b3d` · `0x0b40` · `0x0b45` · `0x0b47` · `0x0b4d` · `0x0b52` · `0x0b55` · `0x0b58` · `0x0b5e` ·
`0x0b63` · `0x0b66`** — offset, bytes y mnemónico **idénticos en las quince**. El par `0x0b6e` es el
destino del `jne` de `0x0b37` y es un `cmp` contra el tile siguiente (`0xdc`): la rama de puerta
secreta se salta entera, tal como dice.

★ **Y la derivación fuerte de esa cabecera se sostiene**: afirma que *«esta rama es INALCANZABLE en
mazmorra»* citando dos guardas de la cabecera de la misma rutina. Medidas:

| call-site | instrucción | destino | qué prueba |
|---|---|---|---|
| `SJOG.OVL:0x0969`, | `cmp byte ptr [g_location], 0x20` / `jbe 0x97e` | `0x097e` | por debajo de `0x21` sigue el flujo normal |
| `SJOG.OVL:0x0970`, | `cmp byte ptr [g_location], 0x29` / `jae 0x97e` | `0x097e` | `0x29` o más, también |
| `SJOG.OVL:0x0977`, | `call 0x646` / `jmp 0xba4` | — | **`0x21`-`0x28` se desvía y RETORNA** |

Los dos offsets citados son los `cmp` exactos y el desvío es literal: quien llegue a `0x0b33` no
está en el rango de mazmorra. La derivación **no es prosa, es el único camino del salto**.

### 3.2 `SJOG.OVL:0x0e22-0x0ee4` — el (J)immy sobre cepo, y un gate de dos consultas

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SJOG.OVL:0x0e15`, | `mov ax, 0x8ae6` / `jmp 0xd70` | `0x0d70` | la rama de PUERTA: `b'Unlocked!\n'` |
| `SJOG.OVL:0x0e22`, | `cmp byte ptr [g_location], 0x80` / `jae 0xe42` | `0x0e42` | ★ **GATE 1: salta el chequeo de ocupante** |
| `SJOG.OVL:0x0e29`, | `push [bp - 6]` / `push [bp - 8]` / `push ax` (piso) / `call 0x770e` | — | los **tres** argumentos |
| `SJOG.OVL:0x0e38`, | `or ax, ax` / `jne 0xe42` | `0x0e42` | con ocupante, sigue |
| `SJOG.OVL:0x0e3c`, | `mov ax, 0x8afe` / `jmp 0xd70` | `0x0d70` | vacío ⇒ **`b'No one is there!\n'`** y retorna |
| `SJOG.OVL:0x0e42`, | `mov ax, word ptr [g_cmb_scratch_x]` | — | ★ **el par: recoge el out-param** |
| `SJOG.OVL:0x0e76`, | `cmp byte ptr [g_location], 0x7f` / `jae 0xee4` | `0x0ee4` | el split del EFECTO |
| `SJOG.OVL:0x0e7d`, | `push [bp - 2]` / `call 0xffffbb9e` | — | **GATE 2**: resuelve el NPC |
| `SJOG.OVL:0x0e86`, | `inc ax` / `jne 0xe90` | `0x0e90` | `0xFFFF` ⇒ cae |
| `SJOG.OVL:0x0e89`, | `mov ax, 0x8b1c` / `jmp 0xd70` | `0x0d70` | `b"Couldn't find this npc\n\n"` |
| `SJOG.OVL:0x0eef`, | `mov byte ptr [bx], 0x44` | — | el tile revelado |
| `SJOG.OVL:0x0ef7`, | `mov ax, 0x8b48` | — | ⚠ **`b'Unlocked\n'`, SIN admiración** (§4.3) |

**`:0x0e42` — (a) exacta, en sus cinco afirmaciones mecánicas.** (1) El `cmp`/`jae` está en el
offset que cita y salta al offset del par. (2) El bloque saltado llama a `0x770e` con los tres
argumentos en el orden que dice. (3) El cero imprime la cadena que dice, y la cadena es
**byte a byte** `b'No one is there!\n'`. (4) El rango declarado `0x0E22-0x0E3F` es el **ajustado**:
`0x0e3f` es el primer byte del `jmp` de salida, o sea frontera de instrucción, no un punto medio.
(5) ★ Y la parte más fácil de dar por buena sin mirar —*«deja el índice de slot en `g_cmb_scratch_x`
que `0x0E42` recoge»*— es **literalmente la instrucción que hay en el offset del par**.

El GATE 2 se comprobó igual y también cuadra entero: rango `0x0E7D-0x0E8C` ajustado a frontera,
`b"Couldn't find this npc\n\n"` byte a byte, y el *«`0xFFFF` →»* **derivado**, no descrito: el
`inc ax` sobre `0xFFFF` da cero y por eso el `jne` no salta. Es la única lectura del par
`inc`/`jne`.

⚠ **Lo que NO firmo de esta lectura**: que `0x770e` sea `ULTIMA.EXE 0x368E`, ni que
`0xffffbb9e` sea la rutina de `TALK`/`TOWN` que la cabecera nombra. Las dos son resoluciones
**inter-overlay**, el problema abierto de **#95**.
Se verifica que hay una `call` ahí y qué hace el retorno; **no** a dónde va. Misma parada que la
sub-tanda 2 §3.4.1 y la sub-tanda 1 §3.1.1.

### 3.3 ★★ `:0x0ee4` — (d): EL PAR ES FALSO, y los dos fallos tienen mecanismo

El texto de `combat.ts:3398` es:

> *«Eje preferido — semántica EXACTA de `0x0EE4` `0fca`-`1026` (…): `rand0(255) > 0x7F` → prueba X
> y, si está bloqueada, prueba Y; con `<= 0x7F` prueba SOLO el eje Y.»*

**Contra `SJOG.OVL`, esa frase no describe nada**: de `0x0fca` a `0x1026` ese overlay hace
colocación de objeto y escritura de campos, sin tirada de eje. **Contra `COMBAT.OVL` es exacta, y
hasta el último detalle:**

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `COMBAT.OVL:0x0fca`, | `mov ax, 0xff` / `push` / `call` | — | **`rand0(255)`**, arranca EN el offset citado |
| `COMBAT.OVL:0x0fd1`, | `cmp ax, 0x7f` / `jle 0x1000` | `0x1000` | ★ **`<= 0x7F` ⇒ SOLO el eje Y** |
| `COMBAT.OVL:0x0fd6`, | `mov al, [bx + 6]` / `add ax, [g_cmb_scratch_x]` | — | el eje **X** |
| `COMBAT.OVL:0x0fef`, | `or ax, ax` / `jne 0x1000` | `0x1000` | ★ **X bloqueada ⇒ prueba Y** |
| `COMBAT.OVL:0x1000`, | `mov al, [bx + 6]` / `add ax, [g_cmb_scratch_y]` | — | el eje **Y** |
| `COMBAT.OVL:0x1019`, | `jne 0x1026` | `0x1026` | Y bloqueada ⇒ sale del bloque |
| `COMBAT.OVL:0x1026`, | `cmp word ptr [bp - 4], 0x3de` | — | ★ **el fin del rango citado, exacto** |

Cuatro afirmaciones, cuatro aciertos, y los **dos extremos del rango** son frontera de instrucción.
La cita es de las buenas. Sólo que **no es de mi par**.

#### 3.3.1 El falso POSITIVO: por qué la banda lo colgó de `SJOG`

La política pegajosa hereda **el último nombre de overlay visto en el fichero**, con ventana de 40
líneas. En `combat.ts`:

| línea | qué hay | efecto |
|---|---|---|
| 3330 | `COMBAT:0x0EE4 + 0x0D30` — la cabecera de **la propia función** | el dueño verdadero, a **68** líneas |
| 3394 | `// placa .CBT bajo el enemigo (SJOG 0x1d3c, ambos bandos)` | un comentario **de otra cosa**, a **4** líneas |
| 3398 | `// … de 0x0EE4 0fca-1026 …` | hereda **`SJOG`** |

Y la procedencia que el propio partidor publica lo confirma sin que haya que suponerlo:

```
pair=SJOG.OVL:0x0ee4  clase=LIMPIA  distancia=4  tokens_ventana=1  ctx_line=3394  candidatos=6
```

#### 3.3.2 ★★ Y AQUÍ ESTÁ LA LECCIÓN: los dos ejes PREMIAN el fallo que debían cazar

Los dos ejes de riesgo se calculan así: `distancia` = líneas hasta el nombre heredado;
`tokens_ventana` = overlays **distintos** nombrados **dentro de esa misma ventana de 40**.

- `COMBAT` está a 68 líneas ⇒ **cae fuera de la ventana** ⇒ `tokens_ventana = 1` ⇒ **no es AMBIGUA**;
- el intruso `SJOG` está a 4 líneas ⇒ `distancia = 4` ⇒ **no es LEJANA**.

⇒ **Cuanto más lejos está el dueño verdadero, más limpio parece el par.** Los dos ejes miden
proximidad del *competidor*, y un competidor que no compite —porque está fuera de la ventana— se lee
como ausencia de competencia. El par acaba en `LIMPIA`, la etiqueta que significa «atribución sin
problemas», **precisamente por el motivo por el que la atribución está mal**. Segunda instancia,
más aguda, de `pegajosa-marca-valor-de-tabla` («`distancia` castiga la cita más explícita»), y
material directo para **#217**.

⚠ Añádase que `candidatos = 6`: **seis** overlays tienen instrucción en `0x0ee4`. El eje FORZADA
tampoco protege, porque mide si el offset existe en otros overlays, no si el que se eligió es el
bueno.

#### 3.3.3 El falso NEGATIVO: la cita CORRECTA existe y la banda no la ve

`game.ts:3618` cita el mismo offset y **sí** es de `SJOG` —habla del tile `0x44`, del turno
consumido en `0x0EF2`, y todo eso está literalmente en `SJOG.OVL:0x0eef`-`0x0ef7`—. **No está en la
banda.** Trazada la pasada pegajosa por ese fichero, la causa es de las que hacen daño:

| línea de `game.ts` | token que casa | overlay heredado |
|---|---|---|
| 3576 | `SJOG` (en prosa, correcto) | `SJOG.OVL` |
| **3594** | **`npc`** — en `const npc =`, **un nombre de variable de TypeScript** | **`NPC.OVL`** |
| 3600 | `npc` otra vez, en un `if` | `NPC.OVL` |
| 3615 | la cita buena de `0x0EE4` | hereda **`NPC.OVL`** |

`NPC.OVL` **existe** en el corpus (28 overlays cargados) y `0x0ee4` **no** es instrucción suya ⇒ la
cita se **descarta en silencio**. No hay error visible, no hay aviso: simplemente no aparece.

⇒ **El mismo offset del mismo overlay: la banda lo empareja con el fichero que no lo tiene y pierde
el que sí.** Y el sembrador que lo provoca es una palabra de TypeScript de tres letras, que es
exactamente lo que **#217** describe («`OVERLAY_TOKEN` casa SIN mayúsculas y 299 atribuciones nacen
de palabras TS»); aquí queda documentado un miembro nuevo y muy barato de esa lista: **`npc`**.

#### 3.3.4 Qué se hace con el par, y qué NO

**(d): declarado, sin tocar el instrumento.** No se cambia `OVERLAY_TOKEN`, no se cambia la ventana
de 40, no se re-corre la banda. Los tres serían decisiones de instrumento con re-medición de banda
detrás, y eso es **#217**, que tiene dueño. Lo que este carril aporta es el **caso trabajado**: un
par concreto, con su falso positivo y su falso negativo emparejados sobre el MISMO offset, con la
procedencia numérica publicada por la propia herramienta.

⚠ **Y lo que NO digo**: no digo que el port tenga aquí defecto alguno. Su prosa es correcta en los
dos sitios y nombra el overlay explícitamente en la cabecera de la función (línea 3330) y en la
constante de arriba (línea 91). Un lector humano no se confunde; el que se confunde es el extractor.

#### 3.3.5 ⚠ Alcance de mi propia medida — y por qué NO digo «12 de 13 limpios»

Corrí sobre mis 12 pares y sobre un **control POSITIVO** (`SJOG.OVL:0x158e`, el de #133, que cinco
actas discuten y está bien atribuido) la señal *«el fichero del port nombra ese mismo offset con un
prefijo de overlay EXPLÍCITO distinto del atribuido»*. Dispara **1 de 13**, y es justo el que
encontré leyendo; el control positivo no dispara.

**Eso NO significa que los otros 12 estén limpios.** En los 12 la señal **no puede** dispararse: en
ninguno el fichero vuelve a nombrar ese offset con prefijo explícito, así que la señal no tiene
poder sobre ellos y su silencio no es evidencia. Los 12 se adjudican **por lectura**, no por la
señal. Es la regla de `ausencia-no-se-prueba-con-head` y la de
`control-negativo-no-valida-un-guarda`: un detector que sólo puede hablar de un subcaso no absuelve
al resto. Lo que sí mide sobre los 13 enteros es el otro dato de la tabla: en 12 el nombre de
overlay más cercano por arriba coincide con la atribución, y en 1 no.

## 4. Lo declarado que no es veredicto

### 4.1 El eje de atribución, resumido para #217

Está en §3.3.2 y se repite aquí en una línea porque es lo más transportable de esta tanda:
**`distancia` y `tokens_ventana` son funciones de la cercanía de un competidor, y el modo de fallo
«el dueño verdadero está lejos» produce competidor cero y distancia corta ⇒ la etiqueta más limpia
del sistema.** Los ejes no son neutrales respecto del fallo: lo favorecen.

### 4.2 `0x0b2e` no cae en frontera de instrucción — y el desplazamiento lo pone el disasm

La cabecera de `search.ts` sitúa el remate en *«código real @`0x0b2e`»*. Medido:

| | |
|---|---|
| la tabla inline ocupa | `0x0afe`-`0x0b2b` (23 palabras, §3.1-B) |
| el código real arranca en | **`0x0b2c`**: `b8 38 8a` = `mov ax, 0x8a38`, y en `0x0b30` la `call` al impresor de siempre |
| `0x0b2e` es | **el tercer byte de ese `mov`** |

**La sustancia es exacta** —justo después de la tabla se carga el remate y se imprime— así que
**no es (b)**: no hay derivación que acercar, sobra precisión en un puntero. Mismo género y misma
resolución que la sub-tanda 2 §4.2.

★ **Pero aquí el género tiene MECANISMO, que allí no lo tenía.** El desensamblador, al tropezar con
la tabla, consume su último byte (`0x0b2b`) como opcode y emite su siguiente línea limpia en…
**`0x0b2e`**. Es decir: **`0x0b2e` es exactamente el offset que el listado ofrece, y `0x0b2c` no
aparece en él**. El autor no se inventó el número: lo copió del instrumento. ⇒ El género de la
sub-tanda 2 §4.2 («offsets a media instrucción») gana una causa concreta y comprobable —**tras una
tabla de datos inline, la primera línea del listado va sistemáticamente tarde**— y con ella una
predicción falsable para quien la quiera barrer: los offsets citados justo después de una región
mal decodificada deberían caer, con desplazamiento pequeño, dentro de la primera instrucción real.
No lo barro aquí; queda escrito.

### 4.3 ★ COMENTARIO RANCIO (#194): «Unlocked!» donde el binario pone «Unlocked» — y el código acierta

| | |
|---|---|
| `game.ts:3618` dice | *«`0x0EE4` (loc >= `0x7f`): tile `0x44` + «Unlocked**!**\n» + turno consumido (`0x0EF2`)»* |
| el binario, en `0x0ef7`, empuja | DS `0x8b48` = **`b'Unlocked\n'`** — sin admiración |
| la admiración vive en | DS `0x8ae6` = `b'Unlocked!\n'`, que se empuja en `0x0e15`, **la rama de PUERTA** |

O sea que el original tiene **dos cadenas distintas a propósito** y el comentario le cuelga a la
rama del cepo la de la puerta.

★★ **Y el código del port NO se equivoca**: `commands.ts:243`, la rama `prisoner` con
`location >= 0x7f`, devuelve `message: "Unlocked"` **sin** admiración, mientras `commands.ts:179`
—la puerta— devuelve `"Unlocked!"`. Las dos cadenas están además separadas en `es.json`. ⇒ **el
defecto es sólo del comentario**, y es del género de **#194** en su variante más engañosa: una
cabecera que contradice al hermano que la implementa, **en el lado en que el hermano tiene razón**.
Quien «arreglase» el código para casarlo con el comentario metería el sapo.

⚠ Y hay una vuelta de tuerca que cierra el círculo con §3.3.3: **esa línea es la cita perdida**. Es
decir, el único sitio del port que documenta mal esta rama es precisamente el que ningún barrido
automático de la banda puede ver, porque el sembrador `npc` lo tira. Se declara y **no se toca** —el
encargo es de lectura, no de arreglo—; va a **#194** con las señas exactas (`game.ts:3618`,
DS `0x8b48` vs DS `0x8ae6`).

### 4.4 La glosa «en mazmorra» para `g_location >= 0x80` depende de #184

`game.ts:3551` glosa el gate como *«en mazmorra el chequeo se SALTA»*. El **mecanismo** es exacto
(§3.2); lo que descansa sobre terreno abierto es la **semántica** de `g_location >= 0x80`, que es
literalmente la pregunta de **#184** (*«qué es `g_location ≥ 0x80` en el port»*).

Lo que sí queda medido aquí, y es útil para esa tarjeta:

- el discriminador **no es marginal**: `g_location` se compara contra `0x7f`/`0x80` en **56
  sitios** repartidos en **6 ficheros** del corpus (`CAST` 18 · `ULTIMA.EXE` 18 · `ZSTATS` 5 ·
  `SJOG` 9 · `CMDS` 4 · `CAST2` 2);
- ⚠ y **el port lo implementa LITERAL, no por la glosa**: `OCCUPANT_CHECK_MAX_LOC = 0x80` con
  comparaciones `loc >= 0x80` / `loc < 0x80`. Así que aunque la glosa fuese inexacta, **el
  comportamiento seguiría siendo el del binario**. La glosa es riesgo de lectura, no de ejecución.

⇒ No re-adjudico. Va a #184 como material, con las cifras.

## 5. Estado de la cola

| | pares |
|---|---|
| no leídos al empezar el carril `liston-207` | **37** |
| leídos: sub-tanda 1 · 2 · 3 · **esta tanda** | 10 · 10 · 5 · **5** |
| **VIVOS** | **7** |

Acumulado de las cuatro tandas: **30 pares en 14 lecturas** (ritmo 0,43), **29 (a)**, cero (b),
cero (c), **1 (d)**. ⚠ **CORTE EN FRONTERA DE GRUPO**: `SJOG` queda entero (5/5).

**Los 7 VIVOS**, para la tanda 2 de este carril:

| orden | grupo | pares |
|---|---|---|
| 1º | `SHOPPES3.OVL` (3) | `:0x01ca` · `:0x01ef` · `:0x0378` |
| 2º | `TALK.OVL` (3) | `:0x0a78` · `:0x0b0f` · `:0x1191` |
| 3º | `TOWN.OVL` (1) | `:0x10c7` |

Seña heredada y confirmada: en el 1º cae **el segundo y último token `kernel`** del HITO 1
(`:0x01ca`) — **declarar, no aplicar** (#199), y sin repetir el censo de call-sites que la
sub-tanda 2 §3.4.1 midió y descartó.

## 6. Lo que esta tanda NO ha hecho

- **No ha tocado `game/src`, `re/tools` ni `re/ledger`.** Cero líneas. Sólo `re/notes/`.
- **No ha tocado el instrumento** pese a §3.3: ni `OVERLAY_TOKEN`, ni la ventana de 40, ni la
  política pegajosa. Es #217 y tiene dueño.
- **No ha arreglado** el comentario de §4.3 ni ha abierto tarjeta: cabe en #194.
- **No ha re-adjudicado** ninguno de los 25 pares de las sub-tandas 1-3 ni ninguno de los 16
  nombrados del HITO 1.
- **No ha resuelto** ninguna identidad inter-overlay (§3.2) — es #95.
- **No ha medido** cuántos pares MÁS de la banda sufren el fallo de §3.3: mi señal sólo cubre un
  subcaso y lo digo en §3.3.5. La cifra honesta hoy es **1 encontrado leyendo 5**, no una tasa.
- **No ha leído** los 7 restantes.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `CAST2.OVL`, `CMDS.OVL`,
`COMBAT.OVL`, `NPC.OVL`, `SHOPPES3.OVL`, `SJOG.OVL`, `TALK.OVL`, `TOWN.OVL`, `ULTIMA.EXE`,
`ZSTATS.OVL`.
