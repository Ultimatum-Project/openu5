# Acta #149 — GÉNERO: justificaciones con la GEOMETRÍA equivocada

Carril `re/geometria-149` (worktree `.claude/worktrees/geometria-149`), rama desde `main`
@`e5272915`. Barrido del género: prosa que afirma una relación geométrica (adyacente / al
lado / encima / misma casilla…) y la apoya en un gate del binario, careada contra el
ARGUMENTO REAL que el call-site empuja.

Familia INVERSA de `yell-position-adjacent-not-ontop`: allí el port suponía «encima» donde
el binario pedía adyacente; aquí supone «al lado» donde el binario mira la casilla propia.

---

## 1. La lección del género, en una frase

**`find_object_at_xy` es NEUTRAL: la geometría vive en el CALL-SITE, no en la rutina.** De
sus **18** call-sites, sólo **DOS** empujan la casilla propia verbatim y **quince** empujan
una celda calculada. Cualquier prosa que diga «adyacente» o «propia» citando la RUTINA (y no
sus pushes) es una afirmación sin derivar, acierte o no.

---

## 2. Censo — método y cifras

Instrumento: lectura en Python (JAMÁS `grep -r`: los symlinks del worktree dan ceros en
falso), acentos plegados con NFD, case-insensitive, sobre `game/src/**/*.ts(x)`.

**Grafías barridas** (el discriminador es la PALABRA, no una grafía única): `adyacen*`,
`al lado`, `de al lado`, `junto a`, `contigu*`, `vecin*`, `aledan*`, `colindan*`,
`pegad[oa] a`, `encima`, `debajo`, `bajo los pies`, `sobre la casilla`, `en la casilla`,
`misma/propia casilla`, `casilla propia`, `su/mi/tu casilla`, `alrededor`, `circundan*`, +
inglés `adjacent`, `next to`, `on top`, `same tile`, `own tile`, `own square`, `neighbo*`,
`surrounding`.

Embudo (cifras del censo, tomadas ANTES de mis ediciones):

| | n | criterio |
|---|---:|---|
| crudo | 533 | cualquier línea con una de las grafías |
| − código no-prosa | 49 | nombres de variable/función, no comentario |
| prosa | 484 | comentario o `//` en línea |
| − prosa sin offset a ±3 | 247 | no se apoya en ningún gate ⇒ fuera del género |
| **TIER 1 (careo)** | **237** | prosa + `0x[0-9a-f]{3,4}` a ±3 líneas |
| ↳ `core/` (mecánica) | 181 | población real del género |
| ↳ `skin/` 44 · `ui/` 6 · otros 10 | 60 | «encima» = orden de PINTADO, no geometría de gate |

(Post-edición el mismo instrumento da 537/241: la deriva de +4 es prosa que YO añadí en las
dos correcciones. Se declara para que nadie lea un descuadre.)

**Control positivo del instrumento antes de firmar:** el caso semilla `camp.ts:137` sale en
el crudo, sobrevive los 4 filtros y aparece en TIER1-core. Un cero en esa fila habría
invalidado el barrido.

Los 181 de `core/` se leyeron a ojo uno a uno. Sub-clases descartadas por SENTIDO (no son
geometría de casilla): adyacencia de TABLAS y de OFFSETS de código («tabla adyacente al
equipo `0x57f0`», «cuatro pares adyacentes 0x11f6/0x1203», «su cuenta `06` CONTIGUA»),
`encima` de orden-Z / composición de búfer, y contigüidad de RECORDS del roster (#124).

---

## 3. Careo — veredicto por LECTURA de los pushes

### 3.1 ★ EQUIVOCADA #1 (semilla) — `camp.ts:137-138` · CORREGIDA

Decía: «La interrupción por un monstruo **adyacente** … es Clase C (en una posada no hay
actor **al lado**)».

Lo que dice el binario, leído (CMDS.OVL, rutina `0x0552`, único prólogo `55 8b ec` en
0x0500-0x0730 ⇒ el bloque es suyo):

```
067a: mov al,[g_party_x] / 067f: push ax     ← [bp+8]
0680: mov al,[g_party_y] / 0683: push ax     ← [bp+6]
0684: mov al,[g_floor]   / 0687: push ax     ← [bp+4]
0688: call 0x770e
068b: or ax,ax / 068d: je 0x634              ← 0 ⇒ sigue durmiendo
068f: mov si,0xffff  … 069b: jne 0x6a4
069d: mov ax,0x422a / 06a0: push ax / 06a1: call 0x58d0   ← "Thrown out of bed!"
```

⇒ la terna es **(g_party_x, g_party_y, g_floor) = LA CASILLA PROPIA**. Ninguna vecina, y sin
un solo `inc`/`add` sobre los valores empujados. La geometría escrita era la equivocada.

**CUERPO DE 0x770e LEÍDO** (la tarjeta lo declaraba sin leer, con confianza media-alta «por
convergencia de 3 call-sites»). Resuelto con el instrumento del proyecto, no a ojo:
`routine_census.resolve_near_call(CMDS.OVL, 0x770e)` → `('ULTIMA.EXE', 13966, 'kernel')` =
**ULTIMA.EXE 0x368E** (`near_call_base` 0xbf80). Ojo al sapo de instrumento: leer
`ULTIMA.EXE.asm` en el offset CRUDO 0x770e da **datos** (ceros y la cadena `Error.. Call
OSI$`) — sin pasar por el resolver se habría «leído» basura.

```
368e: push bp … 3691: sub sp,8
3699: di = 0x5c64   369c: [bp-4]=0x5c65   36a1: [bp-6]=0x5c66   36a6: si = 0x5c62
36a9: cl = [g_location]
36ad: al=[di]      / 36b1: cmp ax,[bp+8]  / jne siguiente   ← campo +2 vs arg1
36b9: al=[[bp-4]]  / 36bb: cmp ax,[bp+6]  / jne siguiente   ← campo +3 vs arg2
36c0: cmp cl,0x7f  / 36c3: ja 0x36d4      ← >0x7f NO compara planta
36ca: al=[[bp-6]]  / 36cf: cmp ax,[bp+4]  / jne siguiente   ← campo +4 vs arg3
36d4: al=[si] (byte +0) ; [g_cmb_scratch_x]=dx ; return al
36de: si+=8 … 36ec: inc dx / 36ed: cmp si,0x5d5a / jb        ← slots 1..31, stride 8
36f3: [g_cmb_scratch_x]=dx ; 36f7: ax=0 ; 36fe: ret 6
```

`ret 6` ⇒ 3 args; el orden de push casa con el orden de campos (+2,+3,+4). Es
`find_object_at_xy(x,y,floor)` sobre `g_world_objects` 0x5C5A: devuelve el byte +0 del slot
que casa (0 si ninguno) y deja el ÍNDICE en `g_cmb_scratch_x` como out-param. Concuerda con
`game.ts:3555`, que ya lo tenía resuelto — pero por USO; aquí queda por CUERPO.
Confianza: **ALTA** (sube desde la media-alta de la tarjeta).

Detalle nuevo del cuerpo: **el slot 0 queda FUERA** del barrido (si arranca en 0x5c62 = base
+ 8) y el índice devuelto es 1-based.

Dos correcciones a la propia tarjeta (mis notas, no reproche):
- «push en 0x069d» — 0x069d empuja **la cadena** 0x422a, no coordenadas. Los pushes de la
  terna están en 0x067a/0x0680/0x0684.
- «3 call-sites con la misma terna» — son **18** call-sites y **no** comparten terna (§4).
  Y el apoyo «SJOG 0x03f7 compara el retorno con 0x19 = MOONSTONE_SEARCH_ID **del propio
  port**» era razonamiento CIRCULAR (test-contra-constante-del-clon); además 0x03f7 empuja
  `[bp+8]/[bp+6]/[bp+4]` — los args de SU rutina — así que no dice nada de la party.

**La reformulación se verificó ANTES de escribirla, y NO es la que la tarjeta proponía.** La
tarjeta sugería «el gate mira la casilla PROPIA y en posada no hay objeto EN tu casilla». La
primera mitad es correcta; **la segunda no está derivada** y NO se escribió como si lo
estuviera, porque el bucle del binario llama `npc_activate_all_town` (TOWN 0x1694, `call
0xffffbb0e` @0x0677, resuelto por stub) **en cada hora y justo ANTES del gate** — o sea el
original SÍ re-coloca NPCs por horario mientras duermes. Verificado por lectura de
TOWN.OVL 0x1694, que pone a cero 32 slots en 0x16a2-0x16b9 y re-coloca por `g_hour` — no
fiándome de la seña de #158.
Pero 0x1694 escribe la banda de runtime de NPC (0x5d61/0x5d64/0x5d67, fuera de
0x5C5A..0x5D59) y **quién refleja esa banda en 0x5C5A es un eslabón NO derivado** ⇒ la
alcanzabilidad del mensaje en el ORIGINAL queda ABIERTA, y así se escribió.

Lo que SÍ sostiene la Clase C: `bedSleep` no corre snap ni test alguno, sólo reloj, así que
en el clon no hay ocupante posible. Clase C consecuente, **razón sustituida**.

### 3.2 ★ EQUIVOCADA #2 — `quest/words.ts:59-60` · CORREGIDA

Decía: «El yell es **DIRECCIONAL**: el handler busca la entrada de la mazmorra en las celdas
ADYACENTES **(party+dir)**». Y **se contradecía a doce líneas** con su propio `:66-67`: «las
**4 celdas adyacentes** al party». `party+dir` (una celda, elegida por getdir, como (J)immy)
y «las 4 adyacentes» (un escaneo) no son la misma mecánica: una de las dos tenía que caer.

Cae la de `dir`. CMDS 0x12c8 **no llama a ningún getdir**; escanea las CACHÉS DE TERRENO de
los cuatro vecinos en ORDEN FIJO y el PRIMERO que casa fija el desplazamiento:

```
12fc: al=[0xaba6]   → casa ⇒ [bp-4]=0xffff, di=0      ⇒ (-1, 0)  OESTE
131a: al=[g_unk_abc7] → casa ⇒ [bp-4]=0,     di=1      ⇒ ( 0,+1)  SUR
1338: al=[0xaba8]   → casa ⇒ [bp-4]=1,      di=0      ⇒ (+1, 0)  ESTE
1354: al=[0xab87]   → casa ⇒ [bp-4]=0,      di=0xffff ⇒ ( 0,-1)  NORTE
   (casa = `cmp [si+0x4512]` o al ∈ {0xdf, 0x1a})
139a: ax=[bp-4]+g_party_x ; cmp con [si+0x1eaa]   ← locationsX
13ad: ax=di    +g_party_y ; cmp con [si+0x1ed2]   ← locationsY
13bd: xor [si+0x58d0],0x80        ← sello
```

**Control independiente del mapeo eje↔global:** el desplazamiento que derivé para 0xabc7 es
(0,+1) = SUR, y el repo dice por otra vía (`game.ts:1559`, «al SUR de la party — g_unk_abc7,
el mismo vecino-sur del clavicémbalo») que 0xabc7 ES el vecino sur. Dos derivaciones
independientes coinciden ⇒ el mapeo no es una suposición mía. Cierra además el riesgo de eje
transpuesto (familia #70).

Sólo **UNA** celda —`party+(dx,dy)` del primer vecino que casa— se compara contra las
tablas. La prosa nueva lo dice así. La MECÁNICA del port no se tocó.

### 3.3 CORRECTAS — controles positivos (verificadas por lectura, no por confianza)

Un barrido que sólo encuentra errores no está calibrado. Estas dicen geometría, citan gate y
**aciertan**:

- **`game.ts:3414`** «(J)immy sobre una casilla **adyacente** (SJOG 0x0D4A)» — ✅. SJOG
  `0x0d82-0x0d97`, hace `[bp-6]=g_party_x+g_cmb_scratch_x`, `[bp-8]=g_party_y+g_cmb_scratch_y`
  y el gate `0x0e35` empuja esos locales. Es **el mismo 0x770e que la semilla, con la celda
  VECINA** — el par semilla/jimmy es la prueba de que la rutina no fija la geometría.
- **`game.ts:3931`** (B)oard «el transporte que hay **BAJO** el party» — ✅. CMDS `0x0818`
  empuja g_party_x/g_party_y/g_floor verbatim: casilla propia, igual que la semilla.
- **`visibility.ts:136-137`** «`cmp [bp+4],1` (5e1f), con [bp+4] = valor radial … (0x6FF0,
  **empujado en 5bfd**)» — ✅ literal: `5bfa: call 0x6ff0` / `5bfd: push ax` /
  `5bfe: call 0x5dfe`, y `5e1f: cmp word ptr [bp+4],1` dentro de 0x5dfe.
- **`blink.ts:27`** «si/di ARRANCAN en g_cmb_scratch (**la celda de al lado, NO la del
  party**)» — ✅. `06de/06e5` cargan g_cmb_scratch_x/y en si/di, y son ABSOLUTOS: 0x06f9 los
  compara contra `g_chunk_origin_y` y 0x0713/0x071a los escribe tal cual en g_party_x/y.

---

## 4. Censo de los 18 call-sites de `find_object_at_xy` (ULTIMA.EXE 0x368E)

Obtenido con `routine_census` (desensamblado + `resolve_near_call` en TODOS los ficheros de
código, no por grep de texto: 5 de los 18 llaman con crudo `0xffff93fe`/`0xffffb4be` y un
grep de `0x770e` los habría perdido — familia del cero-en-falso por banda, #173).

| celda que empuja | call-sites |
|---|---|
| **PROPIA** (g_party_x/y verbatim) | CMDS 0x0688, **semilla**: 'H' sobre cama · CMDS 0x0826, (B)oard |
| propia con **y−1** (vecino norte) | CAST 0x16be, `re/notes/shadowlord-ritual.md:81` (ritual del Shadowlord) ya lo dice bien |
| party + delta (**vecina**) | SJOG 0x0e35 ((J)immy) · LOOKOBJ 0x09de · MAINOUT 0x075b · TALK 0x045e · TALK 0x048a |
| party + arg del caller | MAINOUT 0x0236 · TOWN 0x069c · SHOPPES 0x0819 |
| locales / args propios | CMDS 0x09f3 · CMDS 0x16bf · CMDS 0x172e · SJOG 0x03f7 · SJOG 0x056d · SJOG 0x059a · TOWN 0x0a9a |

---

## 5. Declarado y NO cerrado

1. **Alcanzabilidad de «Thrown out of bed!» en el ORIGINAL** (§3.1). El snap de horario corre
   dentro del bucle y justo antes del gate, pero escribe la banda DS 0x5d61+ y no 0x5C5A. Falta
   el eslabón que refleja una en otra. Cabo → tarjeta propuesta (a).
2. **`g_cmb_scratch_x/y` tiene DOS convenciones** según qué getdir lo rellenó: DELTA en SJOG
   (`0x0d87`, suma a party) y ABSOLUTO en la rama de blink de CAST (`blink.ts:25`: «PASO =
   g_cmb_scratch − g_party»). El mismo par de globales significa dos cosas distintas y
   cualquier prosa que asuma una está a un paso de este mismo género (familia
   `dos-hermanas-dos-umbrales`). Cabo → tarjeta propuesta (b).
3. **Primer-vecino-gana vs «los 4 presentes»** (§3.2): el binario resuelve por ORDEN FIJO
   O,S,E,N; si dos vecinos fueran entradas de mazmorra el binario elige por ese orden. Si el
   port desempata igual NO se midió (sería tocar mecánica). Cabo → tarjeta propuesta (c).
4. **`main.ts` bajo EMBARGO — 2 candidatas NO tocadas**, declaradas aquí como pide el encargo:
   - `main.ts:2197` «El cofre (tile 1, COMBAT:0x1574 172c) es IMPASABLE: NO se pisa, se abre
     desde AL LADO» — coherente con `combat.ts:2752`, que sí deriva la celda vecina
     («actor_activo + dirección … NO la celda propia»). Sin careo propio: no leí ese gate.
   - `main.ts:3992` «(E)nter — kernel dispatch 0x3254. Estar ENCIMA de una localización» —
     hermana de `game.ts:1216`/`game.ts:5498`. **Gate NO leído**: queda sin careo, no como
     verde. Van post-GO.
5. **CMDS 0x36c5** `cmp cl,0x80 / jae` dentro de 0x368E es **inalcanzable**: a 0x36c5 sólo se
   llega con `cl <= 0x7f` (0x36c3 `ja` ya se llevó todo lo mayor). Guarda muerta, de la
   familia de las «8 guardas muertas» ya conocida. No toco nada por ella.

---

## 6. Errores propios, con re-medición

- Primer intento con 0x770e: fui al offset CRUDO de `ULTIMA.EXE.asm` y obtuve datos
  (`Error.. Call OSI$`). Re-medido con `resolve_near_call` → 0x368E, que sí es código con
  prólogo. **Regla:** un near-call de overlay NUNCA se lee en el offset crudo del kernel.
- Primer censo (`BIN` laxo: aceptaba «original», «fiel», cualquier `0x`) daba **377**
  candidatas, la mayoría orden-Z de shader. Re-calibrado a «offset hex a ±3» → 237, y la
  capa (`core` vs `skin`/`ui`) como discriminador declarado, no como filtro silencioso.

---

## 7. Alcance

Sólo PROSA: dos docblocks (`camp.ts`, `words.ts`). **Cero valores de aserción, cero
mecánica, cero ficheros de test.** Ningún `main.ts`. No se regeneró `routine-census.json`.
