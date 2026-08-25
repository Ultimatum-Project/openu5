# ACTA #207 — SUB-TANDA 4 DE LECTURA (los 37): el grupo de `SJOG`, 5 pares, 3 lecturas

> Rama `re/liston-c-207`, worktree `.claude/worktrees/liston-c-207`, base **main `a033baa4`**
> — HOY en `ed79e793` por un `merge main` AJENO corrido dentro de mi worktree, ver §1.2.
> Carril `liston-c-207`, FINISHER de la tarjeta: relevo de `liston-b-207`.
> Continúa `liston-b-207-sub3-acta.md` (ya en main como `a033baa4`) y ejecuta el orden que su
> §5 recomienda: *«1º `SJOG.OVL` (5)»*.
> RETENIDA: aterriza el lead.

---

## 0. VEREDICTO

**5 pares · 3 (a) exacta · 1 (b) · 0 (c) · 1 (d)** — en **3 lecturas** (ritmo 0,60).

★ **Y es la PRIMERA sub-tanda del carril que no sale 100 % (a).** Las tres anteriores cerraron
25/25 en (a); aquí caen los dos primeros no-(a) de los 30 leídos, y los dos son de la MISMA
familia de fondo: **una etiqueta puesta a un número** (un overlay en un caso, una semántica de
localización en el otro), con el mecanismo del port intacto en ambos.

| par | fichero del port | veredicto |
|---|---|---|
| `SJOG.OVL:0x0ad4` | `core/world/search.ts:42` | **(a)** exacta — el rango es literal en sus dos extremos |
| `SJOG.OVL:0x0ae8` | `core/world/search.ts:36` | **(a)** exacta — y la tabla de saltos sale **23/23** con la receta que la propia cabecera da (§3.1) |
| `SJOG.OVL:0x0b6e` | `core/world/commands.ts:786` | **(a)** exacta — transcripción literal de 15 líneas, cotejada byte a byte |
| `SJOG.OVL:0x0e42` | `core/game.ts:3548` | **(b)** — el ASM es literal, pero *«en mazmorra»* está **refutado por el propio port** (§3.2) |
| `SJOG.OVL:0x0ee4` | `core/combat/combat.ts:3398` | **(d)** — **el par NO EXISTE**: la cita es de `COMBAT.OVL`, no de `SJOG.OVL` (§3.3) |

★★ **`:0x0ee4` es el primer contraejemplo MEDIDO del eje `LIMPIA`** de la partición de
atribución. `LIMPIA` significa «un solo overlay nombrado en la ventana y cerca», y aquí ese único
overlay es **el equivocado**: el autor escribió el offset a pelo en un fichero cuyo overlay de
casa es `COMBAT.OVL` —lo dice su propia cabecera— y el token más cercano resultó ser una
referencia cruzada a `SJOG`. El instrumento **ya advertía** que esto podía pasar
(*«Un par LIMPIO puede seguir siendo una cita equivocada»*, docstring de
`cita_pegajosa_atribucion.py`); lo que faltaba era un caso con las cifras. Aquí están.

★ **Diecisiete cadenas cotejadas byte a byte** contra `DATA.OVL` (`fileoff = DS + 0x10`), con sus
saltos de línea y su corte a media palabra: ninguna discrepancia.

★ **Y un error MÍO, declarado** (§4.2): reconstruí la tabla de saltos a mano desde el listado del
desensamblador —que la re-decodifica como instrucciones basura— y me salió **desalineada en un
byte**, con la cama en `0xaa`/`0xab` en vez de `0xab`/`0xac`. Estuve a un paso de cobrar un
defecto del port que no existe. Lo cazó leer los **bytes crudos del overlay**, no el listado.

## 1. RE-ANCLA, sobre LA BANDA ENTERA y POR MIEMBROS

```
git log -1 main   (al crear el worktree)  → a033baa4   = base de esta rama
git log -1 main   (al abrir la tanda)     → 4a27f0d0   ★ main SE MOVIÓ, 3 commits
git log -1 main   (al cerrar la tanda)    → ed79e793   ★★ y OTRA VEZ, y mi rama con él (§1.2)
git diff a033baa4..ed79e793 -- game/src     → VACÍO   (los 4 commits tocan re/notes + game/tests)
cita_pegajosa_atribucion.py                 → 341 pares, 507 citas, 3 controles verdes   EXIT=0
cita_pegajosa_forma.py                      → matriz completa, 3 controles verdes        EXIT=0
clase2 × (FORZADA + LIMPIA)                 → 3 + 50 = 53, cotejados POR MIEMBROS a los DOS SHA
```

⚠ **Main se movió DOS veces mientras leía** (`a033baa4` → `4a27f0d0` → `ed79e793`, cuatro commits
de tres carriles ajenos). Comprobado por CONTENIDO y no por fe: **ninguno toca `game/src`** —el
diff acumulado del rango sale **vacío**, y los ficheros tocados son `re/notes/` y un
`game/tests/`— ⇒ **no hay que mergear nada** y las líneas del port que leí son las de main. Es la
comprobación que la sub-tanda 2 §1.1 hizo salir positiva y la 3 negativa; hoy vuelve a salir
negativa, con main distinto **dos veces**. El cotejo por miembros se re-corrió **a los dos SHA** y
da lo mismo, así que ninguna lectura de esta acta depende de cuál de los dos se mire.

**Cotejo POR MIEMBROS contra la lista del HITO 1** (§2 de `liston-207-acta.md`, los 53
enumerados), no por conteo:

| | resultado |
|---|---|
| bajas (en el HITO 1, no hoy) | **0** |
| altas (hoy, no en el HITO 1) | **0** |
| intersección | **53 / 53** |

⚠ Y el conteo **por sí solo habría dado un verde flojo**: la fila `clase2` de la matriz **SÍ ha
cambiado** desde el HITO 1 (`111 → 107` en total, `LEJANA 20 → 17`, `AMBIGUA 38 → 37`), y la banda
de `345 → 341`. Lo que no se ha movido es **la celda F+L**, y eso se sabe porque la intersección
vale 53, no porque el total lo diga.

### 1.1 ★ Las LÍNEAS del port han caducado; los OFFSETS no

Re-ancladas las 12 del relevo contra el partidor de hoy (no heredadas de la tabla del HITO 1),
**dos de mis cinco se han movido**:

| par | línea en el HITO 1 | línea HOY | |
|---|---|---|---|
| `SJOG.OVL:0x0b6e` | `commands.ts:775` | `commands.ts:786` | **movida (+11)** |
| `SJOG.OVL:0x0ee4` | `combat.ts:3381` | `combat.ts:3398` | **movida (+17)** |
| `SJOG.OVL:0x0ad4` · `:0x0ae8` · `:0x0e42` | 42 · 36 · 3548 | 42 · 36 · 3548 | intactas |

⇒ Segunda confirmación de la lección de la sub-tanda 2 §1.1: **la tabla par→LÍNEA de un hito
caduca; la tabla par→OFFSET no**. Con las líneas heredadas, dos de cinco lecturas habrían caído
sobre prosa que ya no está ahí.

### 1.2 🔴 INCIDENTE: alguien mergeó main DENTRO de mi worktree, y no fui yo

A mitad de la tanda, entre correr los gates y commitear, `git rev-parse HEAD` de este worktree
dejó de ser mi base. El reflog de la rama lo dice sin ambigüedad:

```
git reflog show re/liston-c-207
  ed79e793  re/liston-c-207@{0}: merge main: Fast-forward
  a033baa4  re/liston-c-207@{1}: branch: Created from main
```

**Yo no he corrido ningún `merge`** — esta acta declara en §6 que no se mergea, y el motivo está
medido en §1. Alguien ejecutó `git merge main` teniendo esta rama delante; como mi rama todavía no
tenía commits propios, **avanzó por fast-forward** y se llevó mi HEAD a `ed79e793`. La firma
—`ff` limpio sobre una rama ajena sin commits— es la de `cd-fallido-merge-en-principal` y
`worktree-colision-dos-agentes`, sólo que en la dirección contraria a la habitual: no es que yo
haya escrito en el árbol de otro, es que **otro ha escrito en el mío**.

**Daño medido: NINGUNO, y está comprobado, no supuesto.**

| qué | comprobación | resultado |
|---|---|---|
| ¿perdí trabajo? | `git status --short` | `A re/notes/liston-c-207-acta.md` — mi acta **sigue en el índice** |
| ¿cambió el port bajo mis pies? | `git diff a033baa4..ed79e793 -- game/src` | **vacío** |
| ¿cambió mi celda? | cotejo por MIEMBROS a los dos SHA | **53/53, cero altas, cero bajas** en los dos |
| ¿cambiaron mis 5 líneas? | partidor re-corrido a `ed79e793` | **las cinco idénticas** |

⚠ **Por qué lo escribo igualmente, si no rompió nada.** Porque la próxima vez puede caer sobre una
rama **con** commits, y entonces el `merge` no es un fast-forward: es un merge de verdad, con su
posibilidad de conflicto y de borrado silencioso, sobre trabajo ajeno y sin que el dueño se entere.
Y porque un carril que descubra su HEAD movido y no mire el reflog **puede creer que se lo hizo él
mismo**. La regla que faltaba, y la dejo escrita: **antes de commitear, `git rev-parse HEAD` contra
el SHA con el que abriste**; si no coinciden, el reflog dice quién y cómo antes de tocar nada.

## 2. Los cinco pares agrupan en TRES lecturas

| lectura | pares | rutina del binario | rutina del port |
|---|---|---|---|
| §3.1 | `:0x0ad4` + `:0x0ae8` + `:0x0b6e` | `(S)earch`, `SJOG.OVL:0x095c-0x0ba9` | `furnitureSearchProse` + `revealSecretDoor` |
| §3.2 | `:0x0e42` | `(J)immy` sobre prisionero, `SJOG.OVL:0x0d4a-0x0f86` | `jimmyPrisoner` + `jimmyLock` case `prisoner` |
| §3.3 | `:0x0ee4` | ★ **`COMBAT.OVL:0x0ee4-0x1119`**, no `SJOG` | movimiento de la IA de combate |

★ **Cuarta confirmación seguida** de que agrupar por fichero del port agrupa por RUTINA del
binario — y otra vez **cruzando ficheros**: §3.1 junta `search.ts` con `commands.ts` porque los
dos describen la MISMA rutina (`0x095c`), y sus dos docblocks no se citan entre sí.

⚠ Y §3.3 muestra el reverso: **el agrupamiento por overlay del PAR puede ser falso**. El par decía
`SJOG` y la lectura hubo que hacerla en `COMBAT.OVL`.

## 3. Las tres lecturas

### 3.1 `SJOG.OVL:0x095c-0x0ba9` — el `(S)earch` entero, y una tabla de saltos que sale 23/23

Prólogo comprobado, porque la cabecera de `commands.ts` lo afirma (*«Search puerta secreta
(SJOG 0x095C)»*): en ese offset hay marco de pila, no un punto medio de otra rutina.

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SJOG.OVL:0x095c`, | `push bp` / `mov bp, sp` / `sub sp, 0x16` | — | **el prólogo** ⇒ la rutina empieza ahí ✓ |
| `SJOG.OVL:0x0969`, | `cmp byte ptr [g_location], 0x20` / `jbe 0x97e` | `0x097e` | por debajo de 0x21 ⇒ vía normal |
| `SJOG.OVL:0x0970`, | `cmp byte ptr [g_location], 0x29` / `jae 0x97e` | `0x097e` | por encima de 0x28 ⇒ vía normal |
| `SJOG.OVL:0x0977`, | `call 0x646` / `jmp 0xba4` | `0x0ba4` | **0x21-0x28 ⇒ fuera de esta rutina** |
| `SJOG.OVL:0x0a6a`, | `mov ax, word ptr [bp - 0xe]` | — | el TILE apuntado |
| `SJOG.OVL:0x0a6d`, | `cmp ax, 0xa5` / `je 0xa9e` | `0x0a9e` | escritorio |
| `SJOG.OVL:0x0a72`, | `jg 0xaee` | `0x0aee` | **por encima de 0xa5 ⇒ a la tabla** |
| `SJOG.OVL:0x0a74`, | `cmp ax, 0x4f` / `je 0xace` | `0x0ace` | pared |
| `SJOG.OVL:0x0a79`, | `jg 0xad4` | `0x0ad4` | **la rama hermana de mi par** |
| `SJOG.OVL:0x0a7b`, | `cmp ax, 0x2b` / `jne 0xae8` | `0x0ae8` | tocón, y si no **al genérico** |
| `SJOG.OVL:0x0a83`, | `push ax` / `call 0x58d0` / `jmp 0xb2c` | `0x0b2c` | el impresor compartido de las 13 ramas |
| `SJOG.OVL:0x0ad4`, | `cmp ax, 0x5a` / `je 0xa8c` | `0x0a8c` | estante |
| `SJOG.OVL:0x0ad9`, | `cmp ax, 0x5c` / `jl 0xae8` | `0x0ae8` | por debajo ⇒ genérico |
| `SJOG.OVL:0x0ade`, | `cmp ax, 0x5d` / `jle 0xa92` | `0x0a92` | **librería: 0x5c Y 0x5d** |
| `SJOG.OVL:0x0ae3`, | `cmp ax, 0xa1` / `je 0xa98` | `0x0a98` | pozo |
| `SJOG.OVL:0x0ae8`, | `mov ax, 0x8a34` / `jmp 0xa83` | `0x0a83` | **el DEFECTO genérico** |
| `SJOG.OVL:0x0aee`, | `sub ax, 0xa6` / `cmp ax, 0x16` / `ja 0xae8` | `0x0ae8` | fuera de 0xa6-0xbc ⇒ genérico |
| `SJOG.OVL:0x0af6`, | `add ax, ax` / `xchg bx, ax` / `jmp word ptr cs:[bx + 0xca7e]` | — | **el despacho por tabla** |
| `SJOG.OVL:0x0b2c`, | `mov ax, 0x8a38` / `push ax` / `call 0x58d0` | — | **el remate compartido** |
| `SJOG.OVL:0x0b33`, | `cmp word ptr [bp - 0xe], 0x4e` / `jne 0xb6e` | `0x0b6e` | puerta secreta |

**`:0x0ad4` — (a) exacta.** La cita escribe *«0x5a shelf · 0x5c-0x5d, bookshelf, (0xad4-0xae1)»* (comas mías, por el sembrador)
—con los offsets en la tabla de arriba, en celda propia— y el rango es literal **en sus dos
extremos**: en el primero arranca el `cmp` del estante, y el segundo es exactamente el `jle` que
cierra la librería. Ni un byte de más: el pozo (`0xa1`) empieza en la instrucción SIGUIENTE y la
cita lo lista aparte. Y el *«0x5c-0x5d»* está DERIVADO, no copiado: son un `jl` por debajo y un
`jle` por arriba, es decir un intervalo cerrado de dos valores al mismo destino.

**`:0x0ae8` — (a) exacta, y de las mejor respaldadas del carril.** La cita dice
*«0x0a6a-0x0ae8: SWITCH por el TILE de la celda apuntada»* (mayúscula mía, por el sembrador): `0x0a6a` es la carga del tile y
`0x0ae8` es la rama por defecto del switch, así que el rango nombra la estructura entera menos su
despacho por tabla. Lo que la eleva es que **la cabecera publica su propia receta de decodificación
y la receta funciona**: dice *«jump-table INLINE, 0x0afe, decodificada palabra a palabra con base
SJOG 0xBF80»*, y aplicada a los bytes crudos del overlay produce las **23** entradas del rango
`0xa6-0xbc` (que es el `cmp ax, 0x16` de `0x0af1`, 0x16+1 = 23 ✓), **todas resueltas**:

| tile | palabra | destino | cadena | ¿en el mapa del port? |
|---|---|---|---|---|
| `0xa6` | `0xca24` | `0x0aa4` | DS `0x89a6` barril | ✓ |
| `0xa8` | `0xca2a` | `0x0aaa` | DS `0x89b8` tocador | ✓ |
| `0xab` · `0xac` | `0xca30` | `0x0ab0` | DS `0x89ca` cama | ✓ (los dos) |
| `0xad` | `0xca36` | `0x0ab6` | DS `0x89dc` cómoda | ✓ |
| `0xaf` | `0xca3c` | `0x0abc` | DS `0x89ee` baúl | ✓ |
| `0xb2` | `0xca48` | `0x0ac8` | DS `0x8a12` brasero | ✓ |
| `0xbc` | `0xca42` | `0x0ac2` | DS `0x89fe` chimenea | ✓ |
| los otros **16** | `0xca68` | `0x0ae8` | DS `0x8a34` genérico | ✓ (ausentes del mapa) |

⇒ El mapa `FURNITURE_SEARCH_PROSE` del port tiene **exactamente** esas 8 claves de tabla más las
7 pre-switch, y **ninguna de más**: los 16 huecos que el binario manda al genérico están ausentes
del mapa, que es como el port codifica «cae al defecto». **23 de 23 y 15 claves de 15.**

Cadenas, byte a byte contra `DATA.OVL`: DS `0x8950` = `b'\nIn the stump\nt'` · `0x8960` =
`b'\nOn the shelf\nt'` · `0x8970` = `b'\nIn the bookshelf\nt'` · `0x8984` =
`b'\nNear the well\nt'` · `0x8996` = `b'\nIn the desk\nt'` · `0x89a6` = `b'\nIn the barrel\nt'` ·
`0x89b8` = `b'\nIn the vanity\nt'` · `0x89ca` = `b'\nUnder the bed\nt'` · `0x89dc` =
`b'\nIn the dresser\nt'` · `0x89ee` = `b'\nIn the trunk\nt'` · `0x89fe` =
`b'\nIn the fireplace\nt'` · `0x8a12` = `b'\nIn the brazier\nt'` · `0x8a24` =
`b'\nIn the wall\nt'` · `0x8a34` = `b'\nT'` · `0x8a38` = `b'hou dost find\n'` · `0x86cc` =
`b'nothing of note.\n'` · `0x8a48` = `b'a hidden door!\n'`. **Diecisiete, ninguna discrepancia.**

★ Y la afirmación más rara de la cabecera —*«cada rama imprime su string DS (que termina en `t`) y
cae al remate compartido»*— resulta **literalmente cierta**: las trece cadenas cortan a media
palabra en la `t` de `thou`, y el remate empieza en `hou`. El mapa del port las presenta ya
concatenadas (`"\nIn the stump\nthou dost find\n"`), que es la composición correcta. Lo mismo el
*«continúa la MISMA frase en minúscula»*: las dos continuaciones citadas empiezan por minúscula
(`nothing…`, `a hidden…`), comprobado en el byte.

**`:0x0b6e` — (a) exacta, y es la más barata de verificar y la más fácil de dar por buena sin
mirar.** La cita es una **transcripción literal de quince líneas de ASM** con sus bytes; cotejada
línea a línea contra el desensamblado, **coinciden las quince**: offsets, bytes, mnemónicos y
operandos, desde `0x0b33` hasta el `or byte ptr [g_unk_24e6], 2` de `0x0b66`. Su comentario
lateral *«DATA.OVL file 0x8a58»* también cuadra: DS `0x8a48` + `0x10`. Y el par es el destino del
`jne` de `0x0b37`, que efectivamente salta por encima de todo el bloque de la puerta secreta.

★ **Y esta cabecera hace lo que el barrido de género premia**: se adelanta a la confusión y la
desmonta con una prueba estructural — *««mazmorra» no puede ser el criterio porque esta rama es
INALCANZABLE en mazmorra: la cabecera de la misma rutina desvía TODO el rango 0x21-0x28»*.
**Comprobado y cierto**: `0x0969`/`0x0970` acotan `[0x21, 0x28]` y `0x0977` lo manda a `call 0x646`
y sale por el epílogo. Guárdese esta frase: §3.2 es el mismo argumento **sin aplicar**.

### 3.2 `SJOG.OVL:0x0d4a-0x0f86` — el `(J)immy` sobre prisionero, y una etiqueta que el propio port refuta

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SJOG.OVL:0x0d4a`, | `push bp` / `mov bp, sp` / `sub sp, 0x12` | — | **el prólogo** de la rutina |
| `SJOG.OVL:0x0d52`, | `cmp byte ptr [g_location], 0x20` / `jbe 0xd66` | `0x0d66` | por debajo de 0x21 ⇒ sigue |
| `SJOG.OVL:0x0d59`, | `cmp byte ptr [g_location], 0x29` / `jae 0xd66` | `0x0d66` | por encima de 0x28 ⇒ sigue |
| `SJOG.OVL:0x0d60`, | `call 0xc3e` / `jmp 0xf81` | `0x0f81` | ★ **0x21-0x28 SALE de la rutina ENTERA** |
| `SJOG.OVL:0x0d66`, | `cmp byte ptr [g_keys], 0` / `jne 0xd78` | `0x0d78` | sin llaves ⇒ mensaje y fuera |
| `SJOG.OVL:0x0d70`, | `push ax` / `call 0x58d0` / `jmp 0xf81` | `0x0f81` | **la cola compartida de mensaje+salida** |
| `SJOG.OVL:0x0e22`, | `cmp byte ptr [g_location], 0x80` / `jae 0xe42` | `0x0e42` | **el gate del par** |
| `SJOG.OVL:0x0e35`, | `call 0x770e` | — | el barrido de ocupante (destino fuera del overlay) |
| `SJOG.OVL:0x0e3a`, | `or ax, ax` / `jne 0xe42` | `0x0e42` | hay ocupante ⇒ sigue |
| `SJOG.OVL:0x0e3c`, | `mov ax, 0x8afe` / `jmp 0xd70` | `0x0d70` | **cepo vacío ⇒ mensaje y fuera** |
| `SJOG.OVL:0x0e54`, | `sub ax,ax` / `push` / `mov ax,0x1d` / `push` / `call 0x6112` | — | **la tirada, `rand(0,29)`** |
| `SJOG.OVL:0x0e76`, | `cmp byte ptr [g_location], 0x7f` / `jae 0xee4` | `0x0ee4` | ★ el otro gate, y es `0x7f`, no `0x80` |
| `SJOG.OVL:0x0ee4`, | `call 0x8482` / `mov byte ptr [bx], 0x44` | — | banda alta: reescribe el terreno |
| `SJOG.OVL:0x0ef2`, | `or byte ptr [g_unk_24e6], 2` | — | banda alta: **turno consumido** |

Cadenas, byte a byte: DS `0x8afe` = `b'No one is there!\n'` · `0x8b1c` =
`b"Couldn't find this npc\n\n"` · `0x8b36` = `b'\n"I thank thee!"\n'` · `0x8b48` = `b'Unlocked\n'`.

**Lo que la cita acierta, y es casi todo.** *«GATE 1 — OCUPANTE (0x0E22-0x0E3F).
`cmp [g_location],0x80 / jae 0xe42`»*: el `cmp` está EN el offset citado, el `jae` va al offset del
par, y el rango cierra **exactamente** en `0x0e3f`, que es el último `jmp` del bloque y frontera de
instrucción. El *«imprime DS 0x8AFE y retorna por 0x0d70»* es literal hasta un detalle bonito:
`0x0d70` **es** frontera —el `push ax` de la rama «sin llaves»— y la rama de cepo vacío
**reentra ahí a medias** para reutilizar impresión y salida. Y el *«SIN la tirada de 0x0E54 y SIN
tocar g_keys»* queda probado **por ORDEN**: la tirada vive 18 bytes más abajo del salto que se la
salta. El código del port es igual de literal: `OCCUPANT_CHECK_MAX_LOC = 0x80` y
`loc >= 0x80 ? null : …`, sin nombres de sitio.

**Lo que NO: la ETIQUETA.** La cita glosa ese gate como *«en mazmorra el chequeo se SALTA»*, y el
mismo docblock llama a la otra rama *«la rama de mazmorra»* (por el `or` de `0x0EF2`). **En
mazmorra no se llega a ninguna de las dos**: `0x0d52`-`0x0d60`, a la cabeza de la rutina, desvía
TODO el rango `[0x21, 0x28]` a `call 0xc3e` y sale por el epílogo. Es **el mismo argumento
estructural que el port escribe, correctamente, cincuenta líneas más arriba para la puerta
secreta** (§3.1) — y que aquí no aplica. Tres corroboraciones independientes:

| vía | qué dice |
|---|---|
| el binario | `0x0d52`/`0x0d59`/`0x0d60`: `[0x21,0x28]` ⇒ `call 0xc3e`, la rutina no continúa |
| el propio port | `commands.ts` (25 líneas bajo `jimmyLock`): *«Esa banda NO es «mazmorra»: el original escribe g_location 0x21..0x28 en mazmorra (#123), por DEBAJO de la frontera»* |
| el propio port, otra vez | el caso `dungeonChest` de `jimmyLock` está anclado en **`0x0C3E`** — o sea, el port ya sabe que `0xc3e` ES la vía de mazmorra |

**Veredicto: (b), imprecisa CON derivación** — y la derivación no hay ni que buscarla, **ya está
escrita en el repo**, en el fichero que este mismo docblock llama dos líneas después. Lo que falta
es acercarla. ⚠ **No es (c): el mecanismo del port es fiel.** El código compara `>= 0x80` y
`>= 0x7f` en crudo, sin preguntar por «mazmorra» en ningún sitio, así que nada se comporta mal;
lo que rompe es **el lector**, que se lleva un nombre de sitio equivocado y, si algún día
«arregla» el port para que la banda alta sea mazmorra, mete un defecto donde no lo había.
Género de **#150** (allí era `g_floor >= 0x80`, aquí `g_location >= 0x80`) en su variante de #194:
**cabecera contradicha por un hermano**, y el hermano está a un `import` de distancia.

⚠ **Lo que NO firmo**: no digo qué ES la banda `g_location >= 0x7f`. `commands.ts` propone
*«localización SUSPENDIDA por una escena»* con tres call-sites y es plausible, pero eso es
**#184**, que sigue abierta, y no se resuelve aquí. Lo medido es lo que la banda **no** es.

★ Un detalle que la lectura destapa y que nadie ha declarado: **los dos gates de esta rutina usan
constantes DISTINTAS** — `0x0e22` es `cmp 0x80 / jae` (⇔ `>= 0x80`) y `0x0e76` es
`cmp 0x7f / jae` (⇔ `>= 0x7f`), que difieren exactamente en el valor `0x7f`. El port **los porta
los dos con su constante propia** (`>= 0x80` en `jimmyPrisoner`, `>= 0x7f` en el caso `prisoner` de
`jimmyLock`) ⇒ **no hay defecto**, pero tampoco hay una línea que diga que la diferencia es
deliberada, y es justo la clase de detalle que una «limpieza» futura uniformaría. Se deja escrito.

⚠ **Lo que queda sin verificar**: la identidad del destino de `call 0x770e` (que la cita llama
`ULTIMA.EXE 0x368E`). El operando es un desplazamiento a un destino **fuera del overlay**, y su
resolución es el problema abierto de **#95**. Misma parada, por la misma razón, que la sub-tanda 1
§3.1.1 y la sub-tanda 2 §3.4.1. Se adjudica la FORMA (hay una `call` en el sitio y en el orden que
la cita dice); la identidad no se firma.

### 3.3 ★★ `COMBAT.OVL:0x0ee4-0x1119` — el par decía `SJOG`, y el par NO EXISTE

La cita del par es *«Eje preferido — semántica EXACTA de 0x0EE4 0fca-1026 (verificada en vivo, run
2026-07-09): rand0(255) > 0x7F → prueba X y, si está bloqueada, prueba Y; con <= 0x7F prueba SOLO
el eje Y»*, con una hermana cuatro líneas más abajo (*«hasta 4 direcciones aleatorias rand0(3):
0→S,1→E,2→N,3→W (0x0EE4 1030-10c4)»*).

**En `SJOG.OVL` eso no está.** `SJOG.OVL:0x0ee4` es un destino de salto **dentro de la rutina de
§3.2** (entra por el `jae` de `0x0e76`, sale por `jmp 0xd70`), y el TRAMO `0x0fca`-`0x1026` de ese
overlay cae en OTRA rutina (prólogo en `0x0f88`) que coloca un objeto e imprime su nombre. No hay
ninguna tirada contra `0x7f` en todo el tramo.

**En `COMBAT.OVL` está entero, y clavado:**

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `COMBAT.OVL:0x0ee4`, | `push bp` / `mov bp, sp` / `sub sp, 0xc` | — | **el prólogo** ⇒ la rutina empieza ahí |
| `COMBAT.OVL:0x0fca`, | `mov ax, 0xff` / `push ax` / `call` | — | **`rand0(255)`** |
| `COMBAT.OVL:0x0fd1`, | `cmp ax, 0x7f` / `jle 0x1000` | `0x1000` | ★ **`<= 0x7F` ⇒ salta el eje X** |
| `COMBAT.OVL:0x0fd6`, | `mov al, byte ptr [bx + 6]` / `add ax, [g_cmb_scratch_x]` | — | el eje X, sólo si `> 0x7F` |
| `COMBAT.OVL:0x1000`, | `mov al, byte ptr [bx + 6]` / … / `add ax, [g_cmb_scratch_y]` | — | el eje Y |
| `COMBAT.OVL:0x1019`, | `jne 0x1026` | `0x1026` | movió ⇒ no hay vagabundeo |
| `COMBAT.OVL:0x102d`, | `jmp 0x10c7` | `0x10c7` | salida del bloque |
| `COMBAT.OVL:0x1030`, | `sub si, si` / `mov di, 4` | — | ★ **cuatro vueltas exactas** |
| `COMBAT.OVL:0x1046`, | `mov ax, 3` / `push ax` / `call` | — | **`rand0(3)`** |
| `COMBAT.OVL:0x1064`, | `mov [g_cmb_scratch_y], 1` / `mov [g_cmb_scratch_x], 0` | — | el caso `0` ⇒ **Sur** |
| `COMBAT.OVL:0x1053`, | `cmp ax, 1` / `je 0x1096` · `cmp ax, 2` / `je 0x10a4` · `cmp ax, 3` / `je 0x10ac` | — | los otros tres |
| `COMBAT.OVL:0x111a`, | `push bp` / `mov bp, sp` | — | el prólogo SIGUIENTE ⇒ la rutina acaba antes |

⇒ **La cita es correcta y precisa**: el `rand0(255)`, el umbral `0x7f`, la polaridad (`jle` = el
`<=` de la cita), el TRAMO `0x0fca`-`0x1026`, las cuatro vueltas, el `rand0(3)` y el mapeo del caso
`0` a Sur. Lo único equivocado es **el overlay que el partidor le colgó**.

#### 3.3.1 Cómo se produjo, con las cifras — y por qué `LIMPIA` no protegió

Del `provenance` del extractor, tal cual:

| campo | valor |
|---|---|
| par | `SJOG.OVL:0x0ee4` |
| clase de atribución | **`LIMPIA`** |
| `candidatos` (overlays con instrucción en ese offset) | **6** |
| `distancia` (líneas al nombre del overlay) | **4** |
| `tokens_ventana` (overlays distintos en la ventana de 40) | **1** |
| línea del token | `combat.ts:3394` |
| línea de la cita | `combat.ts:3398` |

La línea `3394` es `this.fireTriggers(nx, ny); // placa .CBT bajo el enemigo (SJOG 0x1d3c, ambos
bandos)` — una **referencia cruzada**, el único sitio del párrafo donde se nombra un overlay. Y la
segunda cita del mismo error sale del mismo token a 19 líneas ⇒ **`LEJANA`**. O sea que el mismo
descuido produce una fila `LIMPIA` y una `LEJANA`.

★★ **La ironía del eje**: `tokens_ventana = 1` es lo que hace la clase «limpia», y aquí es
precisamente **lo que impidió el aviso**. Si en la ventana hubiera habido un `COMBAT` compitiendo,
el par habría salido `AMBIGUA` y alguien lo habría mirado. Como el fichero da su overlay de casa
por sabido y no lo repite, **el único token presente era el ajeno**.

★★★ **Y la prueba de intención no hay ni que inferirla: el port lo escribe bien en otras tres
líneas del MISMO fichero** — `combat.ts:91` (*«COMBAT:0x0EE4 0f05»*), `combat.ts:3330`
(*«Movimiento de la IA — COMBAT:0x0EE4 + 0x0D30»*) y su cabecera de fichero, que declara
*«movimiento de la IA re-derivados de COMBAT.OVL/COMSUBS.OVL»*. Las citas con overlay explícito y
las desnudas hablan del mismo `0x0EE4`; sólo las desnudas entran en la banda mal.

**Veredicto: (d) — el par es un ARTEFACTO DE ATRIBUCIÓN, no una afirmación sobre `SJOG.OVL`.** No
se re-adjudica nada del port (la cita es correcta), **no se toca el instrumento**, y el material va
a **#217** (el token pegajoso) y a **#84** (el ctx pegajoso), que son las tarjetas con dueño. La
consecuencia medida está en §4.1.

## 4. Lo declarado, que no es veredicto

### 4.1 ★ Lo que este caso SÍ y NO dice de la banda

- **SÍ**: existe al menos **un** par `LIMPIA` con el overlay equivocado, con sus cifras
  (`candidatos = 6`, `distancia = 4`, `tokens_ventana = 1`) y con prueba de intención por triple
  vía. La advertencia del docstring deja de ser teórica.
- **NO**: no digo cuántos más hay. Este carril lee 12 pares, no barre la banda. La firma
  —fichero cuyo overlay de casa no aparece en la ventana + una referencia cruzada cerca— es
  **buscable**, pero buscarla es trabajo nuevo y cae en #217, que ya la tiene por dueño.
- ⚠ **Ni una palabra sobre el instrumento.** No propongo cambiar el umbral ni la ventana: la
  política pegajosa **recupera cobertura real** (el positivo `SJOG.OVL:0x158e` de #133 vive de
  ella) y tocarla a la vista de un caso es exactamente lo que
  `instrumento-equivocado-peor-que-ninguno` prohíbe.

### 4.2 ★ ERROR MÍO, declarado: reconstruí la tabla de saltos desde el LISTADO y salió corrida

Mi primera decodificación de la tabla de `0x0afe` la hice partiendo a ojo los bytes que el
desensamblador re-decodifica como instrucciones (`retf 0xca68`, `push 0x30ca`…), y me salió la
cama en `0xaa`/`0xab` y la cómoda en `0xac` — **un tile por debajo** del mapa del port. Durante un
minuto tuve delante lo que parecía un defecto (c) de ocho filas.

**No lo era: era mi partición de bytes.** Leídos los bytes crudos del overlay y desempaquetados
como words, la tabla sale `0xab`/`0xac` cama, `0xad` cómoda, `0xaf` baúl, y cuadra 23/23 con el
port. La lección es de instrumento y me la apunto: **un listado de desensamblado, en una región de
DATOS, no es una fuente de bytes** — su alineación es la que el decodificador eligió, no la que la
tabla tiene. Para leer una tabla hay que leer **el fichero**. Familia
`instrumento-equivocado-peor-que-ninguno`, cazada antes de escribir nada, y por eso está aquí y no
en un veredicto.

### 4.3 Un offset de la cabecera de `(S)earch` que NO cae en frontera de instrucción

| la cabecera cita | qué hay realmente | frontera |
|---|---|---|
| *«código real @0x0b2e»* | `0x0b2c` es un `mov ax, 0x8a38` de 3 bytes | `0x0b2c` (y la siguiente, `0x0b2f`) |

El código real tras la tabla empieza en **`0x0b2c`**, no en `0x0b2e`: la tabla ocupa 23 words desde
`0x0afe`, o sea, HASTA `0x0b2b` INCLUSIVE, y el `jmp 0xb2c` de `0x0a87` —que es a donde saltan las
trece ramas— lo confirma desde el otro lado. `0x0b2e` es **el byte alto del inmediato `0x8a38`**.

★ Y se ve **de dónde sale el 2**: es justo donde el listado del desensamblador deja de imprimir
basura y empieza a imprimir algo con pinta de instrucción. La imprecisión no es del autor: es
**heredada del instrumento** que estaba leyendo, el mismo del que yo me fié en §4.2.

⚠ Esto es el género de la sub-tanda 2 §4.2 (**puntero a media instrucción**) y **no** el de la
sub-tanda 3 §4.1 (**convención `mov`-por-`call`**), y se distingue por lo único que los distingue:
**midiendo si el offset es frontera**. No lo es. La sustancia sigue siendo exacta —la tabla está
donde dice, el remate es el que dice, la base `0xBF80` funciona 23/23— así que **no es (b)**:
sobra precisión en un puntero, no falta derivación. Y no es el offset de ninguno de mis pares.

## 5. Estado de la cola

| | pares |
|---|---|
| no leídos al empezar el carril `liston-207` | **37** |
| leídos: sub-tandas 1 · 2 · 3 · **4** | 10 · 10 · 5 · **5** |
| **VIVOS** | **7** |

Acumulado del carril entero: **30 pares en 14 lecturas** (ritmo 0,47), **28 (a)**, **1 (b)**,
**0 (c)**, **1 (d)**. ⚠ **CORTE EN FRONTERA DE GRUPO**: `SJOG` queda entero (5/5).

**Los 7 VIVOS**, en el orden que la sub-tanda 3 §5 recomienda:

| orden | grupo | pares |
|---|---|---|
| 1º | `SHOPPES3.OVL` (3) | `:0x01ca` · `:0x01ef` · `:0x0378` |
| 2º | `TALK.OVL` (3) | `:0x0a78` · `:0x0b0f` · `:0x1191` |
| 3º | `TOWN.OVL` (1) | `:0x10c7` |

Seña heredada y viva: en el 1º cae **el segundo y último token `kernel`** del HITO 1 (`:0x01ca`),
que se tratará igual que el de la sub-tanda 2 — **declarar, no aplicar** (#199) — y **sin repetir**
el censo de call-sites del destino que aquella sub-tanda ya midió que no vale.

⚠ Seña NUEVA que dejo yo para el resto: **cuando el fichero del port sea de un overlay y la cita no
lo nombre, mirar la cabecera del fichero antes de creerse el par** (§3.3). El par `TALK.OVL:0x1191`, que vive
en `faulinei-theft.ts`, y el par `TOWN.OVL:0x10c7`, que vive en `game.ts`: el segundo es
exactamente la configuración de riesgo.

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src`, `re/tools` ni `re/ledger`.** Cero líneas. Sólo `re/notes/`.
- **No ha mergeado main.** El diff de `game/src` entre mi base y main sale **vacío** pese a que
  main avanzó cuatro commits (§1). ⚠ Que la rama esté HOY en `ed79e793` **no es obra mía**: es
  el `merge` ajeno de §1.2, con su reflog y con el daño medido a cero.
- **No ha resuelto** la identidad del destino de `call 0x770e` (§3.2) — es #95, con dueño.
- **No ha resuelto** qué ES la banda `g_location >= 0x7f` (§3.2) — es #184, con dueño.
- **No ha barrido** la banda buscando más pares con el overlay equivocado (§4.1) — es #217.
- **No ha tocado el instrumento** ni ha propuesto tocarlo (§4.1).
- **No ha abierto tarjeta nueva**: los tres declarados caben en tarjetas vivas (#217/#84, #95,
  #184) o son imprecisión sin arreglo (§4.3).
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

Al final por el ctx pegajoso de #84. Overlays nombrados: `COMBAT.OVL`, `COMSUBS.OVL`, `DATA.OVL`,
`SHOPPES3.OVL`, `SJOG.OVL`, `TALK.OVL`, `TOWN.OVL`, `ULTIMA.EXE`.
