# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 4: seis SUELTOS de core, uno por rutina

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `258f6fcb`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t3-acta.md` §4 (el corte y la predicción de ritmo 1,0).

---

## 0. VEREDICTO

**6 pares · 6 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — con **6 lecturas**.

★ **La predicción de ritmo de la sub-tanda 3 se cumple EXACTA**: se anunció 1,0 lecturas por par
para los sueltos sin agrupación, y salen **6 por 6**. Es una predicción pre-registrada que acierta,
no una cifra ajustada a posteriori (§2).

| par | fichero del port | veredicto |
|---|---|---|
| `BLCKTHRN.OVL:0x046c` | `blackthorn.ts:200` | **(a)** — la copia al slot 15, con su aritmética confirmada |
| `CAST.OVL:0x138e` | `usePotion.ts:10` | **(a)** — «consumo ANTES del target-select», por ORDEN de offsets |
| `CAST.OVL:0x1708` | `quest/ritual.ts:180` | **(a)** — CUATRO afirmaciones en un offset, las cuatro literales |
| `DUNGEON.OVL:0x1e00` | `dungeon/dungeon.ts:425` | **(a)** — «0 en AMBAS ramas», demostrable por la siembra única |
| `SJOG.OVL:0x0b58` | `world/commands.ts:780` | **(a)** — ★★ transcripción VERBATIM que reproduce byte a byte |
| `TOWN.OVL:0x0876` | `npc/manager.ts:457` | **(a)** — el 7/6 y el `times` de cuatro ceros, DERIVADO |

## 1. RE-ANCLA: cuarta medida consecutiva, y cuarta vez idéntica

```
main = 258f6fcb
git diff 258f6fcb..HEAD -- game/src            → VACÍO
cita_pegajosa_atribucion.py → 345 pares @ ba10ad1d, 3 controles verdes
diff  {los 64 de la sub-tanda 1}  {los 64 de ahora}  → VACÍO
```

Cola al empezar: **22 vivos**, derivados **por MIEMBROS** (64 − 4 ya-(d) − 14 de carriles anteriores
− 24 míos), no por resta de conteos.

## 2. ★ La predicción de ritmo, pre-registrada y cumplida

La sub-tanda 3 cerró declarando: *«para los 22 que quedan hay que contar 1,0»*, después de medir que
los «grupos por fichero» restantes estaban a 150-1700 líneas y no eran grupos por rutina. Esta
sub-tanda ataca seis sueltos de `core` y **cada uno cae en una rutina distinta**: 6 pares, 6
lecturas, **1,0 exacto**.

| sub-tanda | pares | lecturas | ritmo | por qué |
|---|---|---|---|---|
| 1 | 8 | 5 | 0,63 | tres grupos de hermanos POR DOCBLOCK |
| 2 | 9 | 7 | 0,78 | dos grupos por docblock |
| 3 | 7 | 6 | 0,86 | vecinos de fichero, docblocks distintos |
| 4 | 6 | 6 | **1,00** | sin agrupación ninguna |

⇒ La serie es monótona y la explicación es una sola variable: **cuántos pares comparten RUTINA**.
Sirve como estimador para lo que queda: **16 vivos ≈ 16 lecturas**.

## 3. Las seis lecturas

### 3.1 `BLCKTHRN.OVL:0x046c` — la copia al slot 15, en DOS pasos, y la aritmética que la confirma

La cita afirma que el binario *«(0x046c-0x04d4) COPIA el record del ejecutado al slot 15
(DS:0x5788 = g_party_records[15]) y le pone el byte final 0x7f»*.

| call-site | instrucción | qué hace |
|---|---|---|
| `BLCKTHRN.OVL:0x046f`, | `mov cl, 5` / `shl bx, cl` | índice × 32 = desplazamiento del record |
| `BLCKTHRN.OVL:0x0476`, | `lea si, [bx + 0x55a8]` | ORIGEN: el record de la víctima |
| `BLCKTHRN.OVL:0x047f`, | `repne movsw` (`cx = 0x10`) | 16 palabras = 32 B, a un local de pila |
| `BLCKTHRN.OVL:0x04c2`, | `mov di, 0x5788` | DESTINO: el offset que la cita nombra |
| `BLCKTHRN.OVL:0x04cd`, | `repne movsw` (`cx = 0x10`) | los mismos 32 B, ya al slot |
| `BLCKTHRN.OVL:0x04cf`, | `mov byte ptr [g_party_records+511], 0x7f` | el byte final |
| `BLCKTHRN.OVL:0x04d4`, | `dec byte ptr [g_party_size]` | cierre exacto del rango declarado |

★★ **La identificación `DS:0x5788 = g_party_records[15]` no hay que creerla: sale de la aritmética
del propio tramo.** La base del array la da el `lea si, [bx + 0x55a8]` de `0x0476`, y el paso es
32 (el `shl bx, 5`). Entonces `0x55a8 + 15 × 32 = 0x5788` ✓ — exactamente el inmediato del `mov di`.
Y el byte final cuadra por la misma vía: `g_party_records+511` = `0x55a8 + 511` = `0x57a7` =
`0x5788 + 31`, o sea **el último byte del slot 15** ✓. Dos comprobaciones independientes de la
misma frase, las dos con material de este tramo.

★ Matiz que la cita comprime y conviene dejar escrito: la copia es de **DOS pasos** —al local de
pila en `0x047f` y de ahí al slot en `0x04cd`—, con la compactación del roster en medio. La cita
dice «copia al slot 15» y da el rango que cubre las dos mitades, así que es correcta en efecto y
en extensión; simplemente es más escueta que el código. **(a) exacta.**

### 3.2 `CAST.OVL:0x138e` — un aserto de ORDEN, verificado por los offsets

La cita afirma *«consumo ANTES del target-select en 0x136a; selChar en 0x138e»*.

| call-site | instrucción | qué es |
|---|---|---|
| `CAST.OVL:0x136a`, | `dec byte ptr [bx + 0x5828]` | el CONSUMO de la poción |
| `CAST.OVL:0x136e`, | `mov ax, 0x4706` / `push ax` / `call 0x58d0` | el eco, entre medias |
| `CAST.OVL:0x138e`, | `call 0xffffc1aa` | el SELECTOR de personaje |
| `CAST.OVL:0x1394`, | `or ax, ax` / `jge 0x139b` | resultado negativo ⇒ aborta |
| `CAST.OVL:0x1398`, | `jmp 0x1533` | el destino del aborto |

★ **«ANTES» es una afirmación de orden y se comprueba con la aritmética de los offsets**:
`0x136a < 0x138e`, sin ningún salto entre medias que reordene el flujo. La consecuencia que el port
extrae —que la poción se gasta aunque luego se cancele el picker— **cae del propio orden**, porque
la rama de aborto de `0x1398`, la del `jmp`, no deshace el `dec`. **(a) exacta.**

### 3.3 `CAST.OVL:0x1708` — cuatro afirmaciones en un solo offset, las cuatro literales

La cita comprime el paso 5 del ritual en una frase: *«DESTRUCCIÓN (0x1708): marca SL muerto,
consume shard, OR doom-bit. Imprime "The doom of the Shadowlord …" (0x483b …)»*.

| call-site | instrucción | la afirmación que cumple |
|---|---|---|
| `CAST.OVL:0x170b`, | `mov byte ptr [bx + 0x58c8], 0xff` | «marca SL muerto» ✓ |
| `CAST.OVL:0x1710`, | `mov byte ptr [bx + 0x57b6], 0` | «consume shard» ✓ |
| `CAST.OVL:0x171d`, | `or word ptr [g_npc_dead_bitmap+112], ax` | «OR doom-bit» ✓ (y es un `or`, literal) |
| `CAST.OVL:0x1721`, | `mov ax, 0x483b` / `push ax` / `call 0x58d0` | la cadena DS `0x483b` ✓ |

**Cuatro de cuatro, en el orden en que la cita las lista**, y las cuatro indexadas por el mismo
`bx = [bp+4]` del `0x1708`. Y el paso 4 que la enmarca también sale literal:

| call-site | instrucción | destino | gate |
|---|---|---|---|
| `CAST.OVL:0x16c1`, | `cmp ax, 0xfc` / `je 0x16c9` | `0x175c` si falla | tile `0xFC` ✓ |
| `CAST.OVL:0x16ce`, | `cmp word ptr [bp + 4], ax` / `je 0x16d6` | `0x175c` si falla | el índice ✓ |

⇒ *«Si falla cualquiera → termina SIN más texto (0x175c)»* es exacto: **los dos gates comparten
destino de fallo**, y ese destino es el que la cita da. **(a) exacta.**

### 3.4 `DUNGEON.OVL:0x1e00` — «0 en AMBAS ramas», demostrable por la siembra ÚNICA

| call-site | instrucción | qué es |
|---|---|---|
| `DUNGEON.OVL:0x1d4a`, | `push bp` / `mov bp, sp` / `sub sp, 6` | cabeza de rutina |
| `DUNGEON.OVL:0x1d51`, | `mov word ptr [bp - 2], 0` | la siembra que la cita nombra |
| `DUNGEON.OVL:0x1db5`, | `call 0xffffddb6` | la rama del combate de pasillo |
| `DUNGEON.OVL:0x1e00`, | `mov ax, 0x6cb2` / `push ax` / `call 0x9680` | la rama «What?», DS `0x6cb2` ✓ |
| `DUNGEON.OVL:0x1e07`, | `mov ax, word ptr [bp - 2]` | devuelve lo sembrado |

★ El *«Devuelve 0 = SIN turno ([bp-2]=0 @0x1d51) en AMBAS ramas»* **se demuestra por enumeración de
escrituras**: `[bp-2]` se escribe UNA sola vez en la rutina, en `0x1d51`, con 0; la rama «What?»
cae directamente al `mov ax, [bp-2]` de `0x1e07` sin tocarla. No es una impresión sobre el flujo,
es la ausencia de un segundo escritor. **(a) exacta.**

### 3.5 ★★ `SJOG.OVL:0x0b58` — una transcripción VERBATIM, y reproduce byte a byte

Este par es distinto de todos los del carril: la cita **no describe** el tramo, lo **transcribe**,
con bytes de máquina incluidos. Cotejo línea a línea contra el desensamblado:

| call-site | instrucción del disasm | ¿coincide con la cita? |
|---|---|---|
| `SJOG.OVL:0x0b33`, | `837ef24e cmp word ptr [bp - 0xe], 0x4e` | ✓ bytes y mnemónico |
| `SJOG.OVL:0x0b37`, | `7535 jne 0xb6e` | ✓ |
| `SJOG.OVL:0x0b39`, | `b8488a mov ax, 0x8a48` | ✓ |
| `SJOG.OVL:0x0b3d`, | `e8904d call 0x58d0` | ✓ |
| `SJOG.OVL:0x0b40`, | `803e955880 cmp byte ptr [g_floor], 0x80` | ✓ |
| `SJOG.OVL:0x0b45`, | `7311 jae 0xb58` | ✓ el `jae` sin signo, que es el punto de #150 |
| `SJOG.OVL:0x0b4d`, | `e83279 call 0x8482` | ✓ |
| `SJOG.OVL:0x0b52`, | `c607b9 mov byte ptr [bx], 0xb9` | ✓ |
| `SJOG.OVL:0x0b55`, | `eb0f jmp 0xb66` | ✓ |

**Nueve de nueve, incluidos los bytes de máquina.** Y la otra rama, la que da nombre al par:

| call-site | instrucción | qué hace |
|---|---|---|
| `SJOG.OVL:0x0b58`, | `push [bp-8]` / `push [bp-0xa]` / `call 0x8482` | la misma `tile_addr` |
| `SJOG.OVL:0x0b63`, | `mov byte ptr [bx], 0xb8` | el otro tile |
| `SJOG.OVL:0x0b66`, | `or byte ptr [g_unk_24e6], 2` | la REUNIÓN de los dos brazos |

⇒ los dos destinos existen, hacen cosas distintas (`0xb9` frente a `0xb8`) y se reúnen — que es la
pregunta propia de esta celda, respondida que SÍ. **(a) exacta**, y es el par más barato de
verificar de las cuatro sub-tandas: una transcripción verbatim se coteja, no se interpreta.

### 3.6 `TOWN.OVL:0x0876` — el 7/6 y los cuatro ceros, los dos DERIVADOS

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `TOWN.OVL:0x0868`, | `cmp byte ptr [bx + 0x659e], 0x2f` / `jb 0x876` | `0x0876` | el umbral `0x2f` ✓ |
| `TOWN.OVL:0x086f`, | `mov word ptr [bp - 2], 7` | — | tile ≥ `0x2f` ⇒ **7** ✓ |
| `TOWN.OVL:0x0876`, | `mov word ptr [bp - 2], 6` | — | tile < `0x2f` ⇒ **6** ✓ |
| `TOWN.OVL:0x088b`, | `sub ax, ax` / `mov cx, 2` | — | valor 0, contador 2 |
| `TOWN.OVL:0x0890`, | `lea di, [bx + 0x5d6a]` | — | destino del borrado |
| `TOWN.OVL:0x0896`, | `repne stosw` | — | 2 palabras de cero |

El rango declarado para el 7/6 (`0x0868-0x0876`) cubre **exactamente** la comparación y las dos
asignaciones, y el del horario (`0x0890-0x0896`) el `lea` y el `stosw`: **los dos rangos, con sus
dos extremos, exactos**.

★ **Y el `times=[0,0,0,0]` de la cita es una CUENTA, no una copia**: el `stosw` mueve PALABRAS y el
contador es `cx = 2` ⇒ 2 × 2 = **4 bytes** a cero. El port escribe un array de cuatro elementos, y
la cifra sale del contador, no de un literal del binario. **(a) exacta.**

## 4. Estado de la cola

| | pares |
|---|---|
| población @ `ba10ad1d` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| sub-tandas 1-3 de este carril | 24 |
| adjudicados aquí | **6** |
| **VIVOS** | **16** |

Balance del carril: **30 pares por 24 lecturas (0,80)** — 29 (a) · 1 (b) · 1 (c) · 0 (d).

**Para la sub-tanda 5**, los 16 que quedan, con su estimador ya calibrado (≈16 lecturas). Reparto
por capa, que es el único orden que queda con sentido: **7 de `core`** (`CMDS.OVL:0x1ac6`,
`DNGLOOK.OVL:0x0013`, `MAINOUT.OVL:0x0468`, `SHOPPES.OVL:0x1596`, `SHOPPES2.OVL:0x0194`,
`TOWN.OVL:0x0204`, `ZSTATS.OVL:0x1230`) · **7 de `skin`** (`DUNGEON.OVL:0x14aa`,
`ENDGAME.OVL:0x00d6`, `FONT.OVL:0x03aa`, `ULTIMA.EXE:0x31f4`, `0x535e`, `0x56e6`, `0x6b7e`,
`ZSTATS.OVL:0x0a81`) · **1 de `ui`** (`INTRO.OVL:0x0dec`). Recomendado: **la capa `core` primero**,
que es donde un defecto cuesta mecánica y no presentación.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Los 6 estaban bien.
- **No ha leído** los 16 restantes.
- **No ha verificado la CONDICIÓN** (#144) más allá de lo dicho; en `SJOG.OVL` y en `DUNGEON.OVL`
  sí se comprobó que el port modela los dos brazos.
- **No ha comprobado en el catálogo** los símbolos que las citas nombran y el desensamblado deja
  desnudos (`0x58cb` como `g_shadowlord_here`, `0x58c8` como la tabla de Shadowlords muertos): se
  adjudica lo que el tramo hace, no la nomenclatura. Materia de #81 / #191.
- Ninguna de las 6 citas lleva el token `kernel`.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

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

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `BLCKTHRN.OVL`, `CAST.OVL`, `CMDS.OVL`,
`DATA.OVL`, `DNGLOOK.OVL`, `DUNGEON.OVL`, `ENDGAME.OVL`, `FONT.OVL`, `INTRO.OVL`, `MAINOUT.OVL`,
`SHOPPES.OVL`, `SHOPPES2.OVL`, `SJOG.OVL`, `TOWN.OVL`, `ULTIMA.EXE`, `ZSTATS.OVL`.
