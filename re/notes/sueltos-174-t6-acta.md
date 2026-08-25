# ACTA #174 (banda PEGAJOSA) — TANDA 9, SUB-TANDA 6: cinco de `skin`/`ui`, y el QUINTO par fabricado

> Rama `re/sueltos-174`, worktree `.claude/worktrees/sueltos-174`, base **main `f07730f3`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `sueltos-174-t5-acta.md` §3 (la cola de 10, nueve de ellos de presentación).

---

## 0. VEREDICTO

**5 pares · 4 (a) exacta · 0 (b) · 0 (c) · ★★ 1 (d)**.

| par | fichero del port | veredicto |
|---|---|---|
| `ULTIMA.EXE:0x535e` | `skin/fiel/textwindow.ts:18` | **★★ (d) NO APLICA** — el par lo fabrica el instrumento (§2) |
| `CMDS.OVL:0x1ac6` | `main.ts:2716` | **(a)** — la re-pregunta es una arista de VUELTA |
| `ULTIMA.EXE:0x56e6` | `skin/fiel/moongate.ts:11` | **(a)** — el «1..15» sale de DOS guardas |
| `ULTIMA.EXE:0x6b7e` | `skin/campScene.ts:28` | **(a)** en lo que nombra; hay un CUARTO argumento sin desglosar |
| `ZSTATS.OVL:0x0a81` | `skin/fiel/skin.ts:2184` | **(a)** — «por igual» es el MISMO destino, no dos cierres |

## 1. RE-ANCLA

`main = f07730f3`, `git diff 258f6fcb..main -- game/src` **VACÍO**, 345 pares, 3 controles verdes.
Cola al empezar: **10 vivos**.

## 2. ★★ EL (d): `ULTIMA.EXE:0x535e` — la cita dice «tabla» y ahí hay un `cmp`

La cita (`skin/fiel/textwindow.ts:18`) dice: *«los VALORES del descriptor (coords px de la consola,
panel, etc.) son chrome de S8b (**tabla runtime `0x535e`** / píxel-diff)»*.

**Lo que hay en `ULTIMA.EXE` en ese offset no es una tabla: es una cadena de comparaciones.**

| call-site | instrucción | destino |
|---|---|---|
| `ULTIMA.EXE:0x5356`, | `cmp ax, 0xab` / `jne 0x535e` | `0x535e` |
| `ULTIMA.EXE:0x535e`, | `cmp ax, 0xc8` / `jne 0x5366` | `0x5366` |
| `ULTIMA.EXE:0x5366`, | `cmp ax, 0xc9` / `jne 0x536e` | `0x536e` |
| `ULTIMA.EXE:0x536e`, | `jmp 0x532c` | `0x532c` |

Un despacho por código de tecla (`0xab`, `0xc8`, `0xc9`), sin marco, sin nada que se parezca a un
descriptor de coordenadas de consola. **La cita no está mal: el par lo fabrica el instrumento.** El
`0x535e` del docblock es una dirección de DATO —una tabla que la piel lee en runtime— y el partidor
la ancló al espacio de CÓDIGO del overlay.

★ **Es la FIRMA EXACTA de #188** (el eje `FORZADA` es ciego al segmento), y la instancia trae dos
corroboraciones que la refuerzan:

1. **Su vecino inmediato en la misma cadena, `ULTIMA.EXE:0x5356`, YA está adjudicado (d)** por
   #188/#190. Los dos offsets están a ocho bytes y los dos vienen de citas que hablan de datos.
   El instrumento ancló dos direcciones de DATO consecutivas al mismo tramo de despacho.
2. **El propio partidor lo avisaba y la cadena de prioridad lo tapó**: `0x535e` sale en la lista de
   *«FORZADA con avisos TAPADOS»* con `LEJANA(dist=16)` — la asociación entre el token y el offset
   es débil, exactamente el patrón que #188 documentó.

⇒ **QUINTA instancia de la familia de marcas de DATO** (prefijo `DS` #188 · corchete #190 · token
`kernel` #199 · y ésta, sin marca notacional ninguna: lo único que delata el dato es **la palabra
«tabla» en la prosa**). Y es la primera hallada por LECTURA en esta celda, no por barrido de
notación.

⚠ **NO SE TOCA EL INSTRUMENTO**, mismo criterio que #188/#190/#199: cambiar el criterio cambiaría la
población de la banda y le toca su propio control. Se adjudica el par (d) y se declara la instancia.

★ Y la consecuencia práctica que conviene dejar escrita para quien implemente el criterio de #188:
**«tabla», «descriptor» o «runtime» en una cita son señales de DATO tan buenas como el prefijo `DS`
o el corchete**, y no dejan rastro en la notación del offset. Un criterio que sólo mire la forma del
número no las cazará; hay que mirar el SUSTANTIVO que la prosa le pone al lado.

## 3. Los cuatro (a)

### 3.1 `CMDS.OVL:0x1ac6` — la re-pregunta es una arista de VUELTA

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `CMDS.OVL:0x1abf`, | `cmp si, 8` / `jge 0x1ab3` | `0x1ab3` | el barrido de los 8 reagentes |
| `CMDS.OVL:0x1ac4`, | `jmp 0x1a97` | `0x1a97` | salida normal del barrido |
| `CMDS.OVL:0x1ac6`, | `cmp word ptr [bp - 4], 0` / `je 0x1a78` | `0x1a78` | **la VUELTA** |

★ El *«RE-PREGUNTA (bucle 0x1ac6)»* de la cita es literal en su forma: el `0x1ac6` es una arista
condicional **hacia atrás**, y su destino, el `0x1a78`, cae justo después del prompt «How much?» que la
misma cita sitúa en `0x1a70` ⇒ volver ahí **es** volver a leer el número. **(a) exacta** en su estructura.

⚠ Declarado: **no se ha derivado qué es `[bp-4]`**. Se adjudica que `0x1ac6` es la vuelta al prompt,
no que la condición sea exactamente «faltan reagentes».

### 3.2 `ULTIMA.EXE:0x56e6` — el «1..15» sale de DOS guardas, no de un literal

| call-site | instrucción | destino | qué acota |
|---|---|---|---|
| `ULTIMA.EXE:0x56e9`, | `cmp byte ptr [bx + si - 0x54fe], 0xdc` / `jne 0x570c` | `0x570c` | el tile `0xDC` |
| `ULTIMA.EXE:0x56f0`, | `cmp byte ptr [0x5887], 0` / `je 0x570c` | `0x570c` | corta el **0** |
| `ULTIMA.EXE:0x56f7`, | `cmp byte ptr [0x5887], 0x10` / `jae 0x570c` | `0x570c` | corta el **≥ 0x10** |
| `ULTIMA.EXE:0x5703`, | `push ax` / `push si` / `push di` / `call 0x1112` | — | el blit PARCIAL |
| `ULTIMA.EXE:0x5709`, | `jmp 0x5721` | `0x5721` | cierre exacto del rango |

★ El *«`anim` ∈ 1..15»* de la cita **no está escrito en ningún sitio**: lo producen las dos guardas
de `0x56f0` y `0x56f7`, que recortan el 0 por abajo y el 0x10 por arriba, las dos con el mismo
destino. Y el primer argumento del blit parcial es el propio `anim` (`0x56fe mov al, [0x5887]`),
que es lo que la cita escribe como `0x1112(anim,x,y)` ✓. Y el rango que la cita declara —`0x56e6-0x5709`— termina en el `jmp` ⇒ **los dos extremos, exactos**. Las «16 etapas» caen de ahí: 15 parciales más la llena.
**(a) exacta.**

### 3.3 `ULTIMA.EXE:0x6b7e` — los tres valores que nombra, y un CUARTO que no

| call-site | instrucción | qué es |
|---|---|---|
| `ULTIMA.EXE:0x6b79`, | `jae 0x6b7e` — su guarda, el `cmp word ptr [bp - 4], ax`, está en `0x6b76` | la entrada al tramo |
| `ULTIMA.EXE:0x6b7e`, | `cmp byte ptr [g_unk_adb9], 0xdc` / `jne 0x6bbb` | gate por tile |
| `ULTIMA.EXE:0x6b85`, | `mov ax, 1` / `push ax` | ★ argumento **sin nombrar** |
| `ULTIMA.EXE:0x6b89`, | `mov ax, 2` / `push ax` | el `kind=2` ✓ |
| `ULTIMA.EXE:0x6b8d`, | `mov ax, 5` / `push ax` / `push ax` | el `5` y el `5` ✓ |

Los tres valores que la cita nombra —`kind=2`, `x=5`, `y=5`— **están los tres como inmediatos**, y el
`5` se empuja dos veces con un solo `mov` (`0x6b90 push ax` / `0x6b91 push ax`), que es por lo que
x e y son forzosamente iguales. **(a) exacta en lo que afirma.**

⚠ **Pero hay un CUARTO `push`** que la cita no desglosa: el `mov ax, 1` de `0x6b85`. La llamada
recibe cuatro argumentos y el docblock nombra tres. **No es un defecto** —el valor extra no
contradice nada—, pero es exactamente la forma en que apareció el defecto de #200 (leer hasta el
argumento que la cita no desglosa), así que se deja con señas. Tampoco se ha verificado que el
callee sea `0x6506`: la `call` cae fuera de la ventana leída.

### 3.4 `ZSTATS.OVL:0x0a81` — «por igual» quiere decir el MISMO destino

| call-site | instrucción | destino |
|---|---|---|
| `ZSTATS.OVL:0x0a78`, | `cmp byte ptr [bp - 4], 0x20` / `jne 0xa81` | — |
| `ZSTATS.OVL:0x0a7e`, | `jmp 0xbd6` | `0x0bd6` |
| `ZSTATS.OVL:0x0a81`, | `cmp byte ptr [bp - 4], 0x1b` / `jne 0xa8a` | — |
| `ZSTATS.OVL:0x0a87`, | `jmp 0xbd6` | `0x0bd6` |
| `ZSTATS.OVL:0x0a8f`, | `cmp ax, 3` / `je 0xaa6` | `0x0aa6` | (arranca la cadena de flechas) |

★ La cita dice *«SPACE (0x20) y ESC (0x1b) cierran POR IGUAL (0x0a78/0x0a81)»*, y **«por igual» es
la forma fuerte**: no es que las dos cierren, es que las dos saltan **al mismo destino, el `0x0bd6`**. Dos
teclas, dos offsets, un destino. Y el `0x0a8f` que abre la cadena de flechas cuadra con el rango
`0x0a8f-0x0b0f` que la línea siguiente del docblock declara. **(a) exacta.**

## 4. Estado de la cola

| | pares |
|---|---|
| población @ `549dd672` | 345 |
| `DIVERGE` F+L | 64 |
| ya (d) por #188/#190 | 4 |
| adjudicados por los carriles anteriores | 14 |
| sub-tandas 1-5 de este carril | 36 |
| adjudicados aquí | **5** |
| **VIVOS** | **5** |

Balance del carril: **41 pares por 34 lecturas (0,83)** — 39 (a) · 1 (b) · 1 (c) · **1 (d)**.

**Los CINCO que quedan**, todos de presentación: `DUNGEON.OVL:0x14aa`, en `dungeon-decor.ts` ·
`ENDGAME.OVL:0x00d6`, en `endgame-frame.ts` · `FONT.OVL:0x03aa`, en `skin.ts` ·
`INTRO.OVL:0x0dec`, en `faithful-intro.ts` · `ULTIMA.EXE:0x31f4`, en `main.ts`.

⚠ **CORTE EN FRONTERA DE PAR**, ninguno partido. Con esos cinco, la celda `DIVERGE × (FORZADA +
LIMPIA)` queda CERRADA 64/64.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** El (d) de §2 se declara y se deja; el criterio de #188
  sigue sin implementar y le toca su propio control.
- **No ha leído** los 5 restantes.
- **No ha derivado** `[bp-4]` de §3.1, ni el callee de §3.3, ni el cuarto argumento de esa llamada.
- **No ha barrido** el resto de la banda buscando más citas con «tabla»/«descriptor»/«runtime»: la
  medida de §2 es UNA instancia leída, no un censo. Le toca a #188 / #191.
- Ninguna de las 5 citas lleva el token `kernel`.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `DUNGEON.OVL`, `ENDGAME.OVL`,
`FONT.OVL`, `INTRO.OVL`, `ULTIMA.EXE`, `ZSTATS.OVL`.
