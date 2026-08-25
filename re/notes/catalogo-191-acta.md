# ACTA #191 — el CATÁLOGO de globales como AVISO de la banda pegajosa (jamás filtro)

> Rama `re/catalogo-191`, worktree `.claude/worktrees/catalogo-191`, base **main `e5272915`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Ejecuta la tarjeta #191, abierta por `re/notes/corchete-190-acta.md` §4.

---

## 0. VEREDICTO, primero

**El aviso se aplica, y su primera corrida ya trae su propio falso positivo — medido.** Sobre
el pool de #174 el canal EXACTO acierta **6 pares**: **5** que #188/#190 ya habían adjudicado
**(d) NO APLICA** por tres vías independientes (prefijo `DS`, corchete, lectura de asm), y
**1 que es un FALSO POSITIVO**: `TOWN.OVL:0x13b4`, cuyo offset coincide con `g_unk_13b4`, es, leído,
**el destino real del `jne` de `TOWN.OVL:0x137e`** — una cita de código correcta (§2.3).

Precisión medida sobre el subconjunto ya leído: **5/6**. Y sobre el par que #190 identificó como
código (`ENDGAME.OVL:0x08c2`), el aviso **no dispara** en ninguno de sus dos canales, en ninguna
de las dos poblaciones. ⇒ La tarjeta acertaba de antemano: **como filtro esto borra citas
legítimas; como aviso impreso rinde**, y el 5/6 es la razón numérica de que la lectura no se
delegue nunca.

**PARTICIÓN IDÉNTICA verificada POR MIEMBROS** en las dos poblaciones y las dos unidades: 0
altas, 0 bajas, **0 cambios de celda** (§3). El alta de `0x5356` entró con las **5 predicciones
pre-registradas cumplidas al miembro** (§5).

---

## 1. PRE-REGISTRO (escrito ANTES de tocar `globals.json` ni el instrumento)

Se registra el ÍTEM, no la cifra (familia `prediccion-numerica-cuadra-por-casualidad`).

**Medido en `e5272915` con el instrumento SIN tocar** (`cita_pegajosa_atribucion.py --json`,
pool-sweep4 = 515 citas / 349 pares; `--todas` = 2680 citas / 1934 pares):

| canal del catálogo | pool: citas / pares | TODAS: citas / pares |
|---|---|---|
| nombre EXACTO | 6 / 5 | 17 / 14 |
| `nombre+k` (byte INTERIOR) | 7 / 7 | 64 / 48 |

**Predicciones del alta de `0x5356`**, a verificar en §5:

1. Canal EXACTO del pool → **7 citas / 6 pares**, y el miembro NUEVO es **exactamente
   `ULTIMA.EXE:0x5356`** y ninguno más (cotejo por MIEMBROS, no por conteo).
2. Canal EXACTO de `--todas` → **18 citas / 15 pares**, mismo miembro nuevo.
3. Canal INTERIOR **no se mueve** (7 pool / 48 todas): con `size: 2`, `0x5356` sólo añade
   cobertura de `0x5357`, y **ningún par de ninguna población está en `0x5357`** (0 citas).
4. La PARTICIÓN (par → clase) **no cambia en ningún miembro**: 349 pares, 0 altas, 0 bajas,
   **0 cambios de celda**.
5. `ENDGAME.OVL:0x08c2` **no** aparece en ninguno de los dos canales, ni antes ni después.

FRACASO declarado de antemano: si (1) sale con un miembro distinto, o si (4) mueve una sola
celda, el alta se revierte y se reporta el mecanismo.

---

## 2. RE-DERIVACIÓN DE LAS PREMISAS DEL ENCARGO — una es FALSA y otra está RANCIA

La tarjeta trae tres insumos medidos y la cola cita dos casos adversos. Ninguno se da por bueno.

### 2.1 «material 6/13» — CIERTO por miembros, pero es OTRO CANAL (y eso importa)

`liston-207-acta` §3.1 dice que el catálogo «habría etiquetado 6 de los 13 en frío». Verificado
contra `globals.json` de hoy, con positivo Y negativo:

| familia | par | inmediato | catálogo hoy |
|---|---|---|---|
| A1 | `SHOPPES2.OVL:0x04b2` | `0x57a8` | `g_food@0x57a8/2` ✓ |
| A2 | `TALK.OVL:0x064e` | `0x5888` | `g_karma@0x5888/1` ✓ |
| A3 | `ULTIMA.EXE:0x4786` | `0x5887` | `g_moongate_anim@0x5887/1` ✓ |
| A4 | `TALK.OVL:0x11c7` | `0x57ac` | `g_keys@0x57ac/1` ✓ |
| A5 | `SHOPPES.OVL:0x03c2` | `0x57ac` | `g_keys` ✓ (misma dirección que A4) |
| A6 | `SHOPPES.OVL:0x0e1d` | `0x57c0` | `g_equip_qty@0x57c0/48` ✓ |
| B7 · B8 | | `0xb5de` · `0xb6e2` | — |
| C9 · C10 | | `0x21e6` · `0x2215` | — |
| D11 | | `0x04b0` · `0x07d0` | — |
| E12 · E13 | | `0x7ba4` · `0x6b9c` | — |

**6/13 en frío: exacto** (6 pares desde 5 direcciones distintas; los 7 restantes, 8 inmediatos,
ninguno catalogado). Es a la vez el control POSITIVO y el NEGATIVO del canal catálogo.

★ **Pero el 6/13 mide un canal DISTINTO del que esta tarjeta cablea**, y confundirlos habría
inflado el aviso: allí el número consultado es el **INMEDIATO que empuja la rama hermana**
(`mov ax, 0x57ac`), aquí es el **OFFSET del par** (el destino del salto). Son dos preguntas
distintas al mismo catálogo. El aviso cableado hace la segunda. **La primera queda propuesta
como tarjeta** (§7): tiene 6 aciertos ya leídos esperándola y es más barata que ésta, porque un
inmediato empujado a una rutina no compite con «ser también una instrucción».

### 2.2 Caso adverso `g_hull` — VIVO, y calibra el canal INTERIOR

`liston-b-207-sub2-acta` §4.3. Verificado contra main hoy:

- **No existe entrada `g_hull`** en `globals.json` (194 entradas tras mi alta; 0 nombres con
  `hull`).
- `0x5c5f` **no tiene entrada exacta** pero cae DENTRO de `g_char_anim_states@0x5c5a` size 256.
- El desensamblado lo confirma partido en dos: **7 accesos ABSOLUTOS** salen como
  `[g_char_anim_states+5]` (`CMDS.OVL:0x08f4`, `0x100f`; `MAINOUT.OVL:0x01b6`, `0x10be`,
  `0x10cb`; `ULTIMA.EXE:0x2966`, `0x2977`) y **16 INDEXADOS o inmediatos** siguen como
  `0x5c5f`, sin resolver, en 6 ficheros: `[bx + 0x5c5f]`, `[si + 0x5c5f]`, `mov di, 0x5c5f`.

⇒ **El canal INTERIOR, consultado sobre este byte, devuelve un nombre que NO es el suyo.** Por
eso el instrumento lo imprime etiquetado `INTERIOR` y su docblock dice que se lea «aquí hay una
estructura», nunca «este byte se llama así» — y por eso el caso está **cableado como control
ADVERSO**: si algún día el ledger le da entrada propia, el control se pone rojo y obliga a
re-escribir ese docblock en lugar de dejarlo mintiendo al revés.

⚠ Lo que NO se firma (igual que la sub-tanda 2): **no digo que el ledger esté mal.** Los 16
accesos `[reg + 0x5c5f]` son una BASE de tabla, no la dirección de un objeto
(`desplazamiento-no-es-direccion-de-objeto`). Decidir si `0x5c5f` es «un byte suelto» o «la
casilla 0 de una tabla que además es el casco» es trabajo nuevo. Lo medido es que **el port
acierta y el catálogo no lo cubre**.

### 2.3 ★ El SEGUNDO caso adverso de la cola (`g_unk_5958`) está RANCIO: main ya lo cerró

`liston-c-207-t2-acta` §4 lo declaró «gemelo exacto de `g_hull`»: el port llama
`g_shadowlord_here_idx` a `0x5958` y «ni `globals.json` ni el desensamblado le dan ese nombre».
**Contra main hoy, la mitad de esa frase es falsa:**

```
globals.json → addr 22872 = 0x5958 · name g_shadowlord_here_idx · old_names ["g_unk_5958"]
re/disasm/*.asm → g_unk_5958: 11 refs en 3 ficheros (SHOPPES.OVL, TALK.OVL, TOWN.OVL)
                  g_shadowlord_here_idx: 0 refs
```

El **catálogo SÍ tiene el nombre del port** (con su `old_names`, la traducción de #75); lo que no
lo tiene es el **desensamblado congelado** — la desincronización de #81. ⇒ De los dos casos
adversos que la cola le pasaba a esta tarjeta, **queda uno** (`g_hull`), y el otro es un ejemplo
de por qué una premisa heredada se re-mide antes de usarla: el acta que lo escribió no estaba
equivocada **entonces**, y el aviso de hoy habría acertado donde ella predijo un fallo.

### 2.4 ★ «8 accesos» de `0x5356` — FALSO contra main: son 19, en DOS ficheros

El encargo hereda de `corchete-190-acta` §2.2 que `0x5356` tiene «ocho accesos». Censo completo
por el canal hex con prefijo `0x`:

| fichero | accesos a MEMORIA | offsets |
|---|---|---|
| `ULTIMA.EXE` | **12** | `0x1146`, `0x11b4`, `0x11e5`, `0x11fc`, `0x120b`, `0x1df6`, `0x1dfc`, `0x1e29`, `0x20ce`, `0x2108`, `0x2198`, `0x2289`, |
| `INTRO.OVL` | **7** | `0x0067`, `0x006d`, `0x0101`, `0x0140`, `0x09ab`, `0x0d6d`, `0x0d99`, |

**19 accesos, no 8.** El acta de #190 censó sólo los absolutos de `ULTIMA.EXE` y, dentro de
ellos, se dejó cuatro (`0x20ce`, `0x2108`, `0x2198`, `0x2289`) y el fichero `INTRO.OVL` entero.
No cambia su veredicto —sigue siendo una variable, con escrituras— pero **sí cambia el alcance
del dueño**, que es lo que el ledger publica.

★ Y hay una **20ª ocurrencia que NO es un acceso**: `ULTIMA.EXE:0x531d  jg 0x5356`. El mismo
número es dato en 19 sitios y **destino de salto** en uno. Es la condición dura de la tarjeta
vista desde el otro lado: no basta con saber que un número está en el catálogo, hay que saber
**quién lo lee**.

### 2.5 Sesgo del eje `distancia` — VIVO, y ahora cuantificado

`LOOKOBJ.OVL:0x069c` en main hoy: `distancia = 11`, `tokens_ventana = 1`, `candidatos = 10` ⇒
**LEJANA**, a **una línea** del umbral `DIST_CORTA = 10`. Cita en `game/src/core/game.ts:498`.
Reproduce el hallazgo de la memoria `pegajosa-marca-valor-de-tabla` §2 al miembro.

Y el eje no es frágil sólo ahí. De las 515 citas del pool, en **276** la clase **la decide
`distancia`** (en las demás manda `candidatos == 1` → FORZADA o `tokens_ventana > 1` → AMBIGUA,
y la distancia da igual). Con k líneas más o menos de prosa en el docblock:

| k | LEJANA→LIMPIA (prosa más CORTA) | LIMPIA→LEJANA (prosa más EXPLÍCITA) |
|---|---|---|
| ±1 | 8 | 13 |
| ±2 | 16 | 19 |
| ±3 | 27 | 25 |

⇒ **52 de 276 citas (19 %) cambian de celda con tres líneas de prosa.** El eje mide, en parte,
la LONGITUD del docblock. Como el sentido del sesgo es que **explicar el camino empuja hacia
LEJANA**, un adjudicador que lea «LEJANA» como sospecha está castigando la virtud. Eso va
IMPRESO en el instrumento (§4, punto 3), no sólo aquí.

---

## 3. ★ CONTROL DE PARTICIÓN IDÉNTICA — por MIEMBROS, dos unidades, dos poblaciones

Baseline capturado en `e5272915` **antes** de tocar nada; comparación contra el árbol final.
La unidad `par → clase` usa la MEJOR ocurrencia (la del titular); la unidad `cita` es la terna
`(par, fichero:línea, clase)`.

| población | unidad | antes | después | altas | bajas | **cambios de celda** |
|---|---|---|---|---|---|---|
| pool sweep4 | par | 349 | 349 | 0 | 0 | **0** |
| pool sweep4 | cita | 513 | 513 | — | — | **symdiff 0** |
| `--todas` | par | 1934 | 1934 | 0 | 0 | **0** |
| `--todas` | cita | 2672 | 2672 | — | — | **symdiff 0** |

(513 y 2672 en vez de 515 y 2680: la terna por cita colapsa las 2 y 8 citas que repiten par en
la MISMA línea. Colapsa igual en los dos lados, así que el symdiff sigue siendo el cotejo.)

**El aviso no ha movido ninguna adjudicación.** Y no se firma sólo con este diff de una vez:
queda **cableado en el instrumento** como invariante re-ejecutable (§4).

---

## 4. LO CABLEADO — `re/tools/cita_pegajosa_atribucion.py`, extendido (cero escáner nuevo)

Se extiende el partidor que ya existe; **no hay lector propio del ledger**: el canal delega en
`globals_map.annotate()`, el instrumento compartido que ya construye base + interiores y valida
solapes. Añadido:

- **`catalogo_aviso(off)` → `(canal, nombre)`**, con los DOS canales separados (`EXACTA` /
  `INTERIOR`) y sus modos de fallo OPUESTOS documentados en el docblock (§2.2).
- **Campos nuevos por fila** (`cat_canal`, `cat_nombre`) que **no entran en la cadena de
  prioridad**. Que no entren no es una promesa: lo verifica un control.
- **Bloque impreso del AVISO**, en las **dos unidades** (citas y PARES) y las **dos poblaciones**
  (pool-sweep4 y `--todas`), midiendo la población contraria **en vivo en la misma corrida** —
  ningún número heredado en el texto. Con los aciertos EXACTOS listados par a par, y los tres
  límites: (0) el acierto no dice «esto es dato», (1) VALOR-DE-TABLA, (2) canal INTERIOR,
  (3) sesgo de `distancia` con su tabla de ±1/±2/±3 recalculada en cada corrida.
- **5 controles del canal** (`controles_catalogo`): 2 POSITIVOS (`0x5356` → `g_snd_delay_calib`,
  que se cae si alguien retira el alta de esta tarjeta; `0x5887` → `g_moongate_anim`), 2
  NEGATIVOS medidos (`0x21e6` relleno de tabla, `0xb5de` zona de ceros) y 1 **ADVERSO**
  (`0x5c5f` → `INTERIOR g_char_anim_states+5`, el trinquete de `g_hull`). Son cinco porque el
  aviso consulta un JSON **de otro dueño**: un Set nacido de JSON ajeno necesita que se le pase
  un MIEMBRO y un NO-MIEMBRO conocidos, o el día que el fichero cambie de forma el aviso pasa de
  «no lo sé» a «no está» en silencio.
- **`control_particion`**: comprueba el INVARIANTE del que la identidad se deduce — que la clase
  es **función de los tres ejes declarados** — agrupando por firma `(candidatos==1,
  tokens_ventana, distancia)` y exigiendo UNA clase por grupo. Si el catálogo entrara en la
  cadena, dos citas con ejes idénticos y catálogo distinto caerían en clases distintas y el
  grupo lo delataría. **Con su control de SENSIBILIDAD**: se le inyecta un gemelo sintético de
  una fila real con la clase cambiada y se exige que el comparador **SUSPENDA**. Se hace con un
  gemelo y no reclasificando los aciertos del catálogo a propósito: reclasificarlos sólo delata
  el cruce si alguna otra cita comparte su firma de ejes, así que ese verde dependería del
  reparto del día.

### 4.1 ★ La derivación que impide convertir esto en filtro

No es prudencia, es una lectura del productor. `cita_rama_hermana.collect_cites` emite un par
sólo si `off in asm[ctx].text`:

```python
for m in BARE_OFF.finditer(line):
    ...
    if off in asm[ctx].text:
        out.append((ctx, off, f, n, line.strip()))
```

⇒ **el 100 % de los pares de la banda tiene una instrucción real en ese offset de ese overlay.**
Un acierto del catálogo no dice «esto es dato»: dice «este número es ADEMÁS una global». En la
población `--todas` se ve en bruto: `0x13b2` acierta con `g_unk_13b2` en **tres** overlays a la
vez (`CAST.OVL`, `DUNGEON.OVL`, `INTRO.OVL`), y en `DUNGEON.OVL:0x13b2` la instrucción es
`push word ptr [0xa9c0]`.

### 4.2 Los 6 aciertos EXACTOS del pool, adjudicados

| par | clase | global | estado | vía de la adjudicación previa |
|---|---|---|---|---|
| `DUNGEON.OVL:0x13b2` | LIMPIA | `g_unk_13b2` | ya **(d)** | `pegajosa-103-acta` §1 (prefijo `DS`) **y** `corchete-190-acta` §2 |
| `SJOG.OVL:0x17f6` | LEJANA | `g_equip_name_ptrs` | ya **(d)** | `pegajosa-103-acta` §1 (prefijo `DS`) |
| `ULTIMA.EXE:0x52d2` | FORZADA | `g_gfx_clip_x1` | ya **(d)** | `corchete-190-acta` §2 |
| `ULTIMA.EXE:0x5356` | FORZADA | `g_snd_delay_calib` | ya **(d)** | `corchete-190-acta` §2.2 |
| `ULTIMA.EXE:0x5887` | FORZADA | `g_moongate_anim` | ya **(d)** | `pegajosa-103-acta` §1 **y** `corchete-190-acta` §2 |
| **`TOWN.OVL:0x13b4`** | AMBIGUA | `g_unk_13b4` | ★ **FALSO POSITIVO** | ninguna — leído aquí |

Los cinco primeros son exactamente los cuatro que `backedge-174-acta` §1 lista como «ya (d) por
#188/#190» en la celda DIVERGE (`0x13b2`, `0x17f6`, `0x52d2`, `0x5356`) más el de la celda
BACKEDGE (`0x5887`). **El aviso los retrodice todos sin leer una línea de asm** — y las vías
previas son TRES distintas (prefijo `DS`, corchete, lectura de asm), o sea que la retrodicción no
es circular respecto a ninguna de ellas.

⚠ **Discrepancia de conteo en un acta vecina, medida al pasar y NO corregida desde aquí.**
`corchete-190-acta` §5 dice que de sus 4 pares de dato «uno (`ULTIMA.EXE:0x5887`) ya estaba
adjudicado (d) en `pegajosa-103-acta` §1 … los otros 3 son adjudicación NUEVA». Pero la lista de
cuatro de `pegajosa-103-acta` §1 es `0x5164`, `0x5887`, **`0x13b2`** y `0x17f6`: `DUNGEON.OVL:0x13b2`
**también** estaba ya adjudicado allí. ⇒ Las adjudicaciones NUEVAS de #190 fueron **2**
(`0x52d2`, `0x5356`), no 3. Su §2 sigue en pie y su veredicto no cambia; lo que sobra es un 1 en
la cuenta de novedad. Cabo §7.5 — el acta ajena no se edita desde este carril.

★ **El sexto es el falso positivo, y está leído:**

```
TOWN.OVL.asm:
  137e: 7534              jne 0x13b4      ; ← alguien SALTA ahí
  13b1: eb29              jmp 0x13dc
  13b3: 90                nop
  13b4: 837e0400          cmp word ptr [bp + 4], 0   ; ← el par: CÓDIGO
  13b8: 751c              jne 0x13d6
```

`0x13b4` es el destino del `jne` de `0x137e`, y la cita (`game/src/core/world/blackthorn.ts:149`)
dice literalmente *«rama del npc_engine en `0x13b4`, para los guardias aiType 4»* (verbatim, con
el offset entrecomillado por el régimen de siembra) — o sea que **describe el salto**.
No hay adjudicación previa suya en `re/notes/` (0 ocurrencias de `TOWN.OVL:0x13b4`). Un filtro lo
habría borrado, y con él la única cobertura de esa rama. Misma forma que `ENDGAME.OVL:0x08c2` en
#190 §2.1, esta vez con el catálogo en vez del corchete: **la marca cambia, el modo de fallo no.**

---

## 5. EL ALTA DE `0x5356`, y las 5 predicciones

**Catálogo primero, cumplido**: antes de dar de alta se buscó la dirección en `globals.json` por
las dos vías — exacta y por cobertura de extensión — y **no estaba en ninguna** (§0 medido con
`globals_map.annotate(0x5356) → None`). No es un renombre: es un hueco.

**Entrada** (`g_snd_delay_calib`, addr 21334, size 2), en la familia de sus vecinos
`g_snd_driver_names@0x5340` / `g_snd_driver_fn@0x5350` / `g_snd_driver_seg@0x5352`. Derivación,
del binario y no de la prosa del port:

```
0x11B4: mov word [0x5356], 0        ; a cero
0x11C0: int 0x21 (AH=35 AL=1C)      ; guarda el vector de INT 1Ch (tick del timer)
0x11CD: lea dx,[0x1214]; AH=25      ; instala SU handler
0x11D8: cmp word [0x535A],0 / je    ; espera el PRIMER tick
0x11E5: inc word [0x5356]           ; ★ cuenta vueltas…
0x11E9: cmp word [0x535A],0 / je    ; …hasta el SIGUIENTE tick
0x11FC: mov ax,[0x5356] / mul 0x12 / div 0x2EE / mov [0x5356],ax   ; normaliza
```

Es una **calibración de velocidad de CPU**: iteraciones de un `inc` que caben entre dos ticks de
18,2 Hz, escaladas ×0x12/0x2EE. Los consumidores lo usan como número de vueltas del retardo del
altavoz: `0x20CE` lo desplaza por la tabla de shifts (`shr ax, [bx+0x5426]`) antes del doble
`dec/jne` de `0x20E6`-`0x20F0`; `0x2198` lo divide por `0x18` si es ≥ `0x64` (tasa del sweep);
`0x2289` lo desplaza 4 (noise burst); `0x2108` lo compara con `0xF0` como **gate de velocidad de
máquina**. `0x1DF6`-`0x1E29` lo salva, lo fuerza a `0x1F4` (500) y lo restaura — override
temporal de temporización. `INTRO.OVL` escribe, en su lugar, `0x113`, = 275. Consumidor portado:
`game/src/skin/fiel/speaker.ts` (`C=[0x5356]`).

**FORMATO**: `git diff --stat re/ledger/globals.json` = **7 insertions(+), 0 deletions**. Cero
reformateo (la trampa de `json-roundtrip-impone-formato`: el `--stat` la delata). `globals_map.py`
valida: **194 entradas**, sin solapes ni nombres duplicados, EXIT=0.

### Las 5 predicciones, verificadas POR MIEMBROS

El catálogo PRE-alta se reconstruye exacto (el de hoy menos `0x5356`/`0x5357`; el diff son 7
líneas de inserción y cero borrados) y se re-clasifican las filas del baseline con él:

| # | predicción | resultado |
|---|---|---|
| 1 | EXACTA pool 5 → 6 pares, alta única `ULTIMA.EXE:0x5356` | ✅ altas `['ULTIMA.EXE:0x5356']`, bajas `[]`; 7 citas |
| 2 | EXACTA todas 14 → 15 pares, mismo miembro | ✅ altas `['ULTIMA.EXE:0x5356']`, bajas `[]`; 18 citas |
| 3 | INTERIOR sin mover | ✅ 7 → 7 (pool) y 48 → 48 (todas), altas y bajas `[]` |
| 4 | partición sin un solo cambio de celda | ✅ §3: 0/0/0 en las dos poblaciones y unidades |
| 5 | `ENDGAME.OVL:0x08c2` en ningún canal | ✅ `cat_canal = ''` antes y después, ambas poblaciones |

**5/5 al miembro.** Y la nº 4 es la que valía la pena pre-registrar: es exactamente el conteo que
puede cuadrar por casualidad, y aquí se cotejó por identidad de conjunto.

---

## 6. Lo que este carril NO ha hecho

- **No ha filtrado nada.** El aviso es impreso; los 6 aciertos siguen en la población. Cero
  cambio de denominador para #204 / #205.
- **No ha adjudicado el falso positivo como «cita mala»**: `TOWN.OVL:0x13b4` es una cita
  **correcta** de código y así queda. Lo que estaba mal era la corroboración automática.
- **No ha tocado `game/src`.** El sesgo de `distancia` se DOCUMENTA; corregir prosa de docblocks
  para mover celdas sería justo el error que §2.5 mide.
- **No ha regenerado `routine-census.json`** (embargo #84) ni ningún censo. El aviso se cableó
  sin regenerar nada.
- **No ha tocado `g_hull`**: el ledger sigue sin entrada para `0x5c5f`. Lo que hay es el control
  ADVERSO que se pondrá rojo cuando alguien la cree.
- **No ha retirado `old_names`** de `g_shadowlord_here_idx` pese a §2.3: es material de #81 y el
  disasm congelado todavía imprime `g_unk_5958`.
- **Nada de e2e** (HOLD). No se ha tocado `main.ts`.

---

## 7. Cabos, con dueño

1. ★ **El canal del INMEDIATO** (§2.1): aplicar el catálogo al inmediato que empuja la rama
   hermana, no al offset del par. **6 aciertos ya leídos** esperándolo (familia A de
   `liston-207-acta` §3) y sin la ambigüedad «global E instrucción», porque un inmediato empujado
   a una rutina no compite con ser un destino de salto. **Tarjeta propuesta al lead.**
2. **Vecinos de `0x5356` sin catalogar**, todos derivados de paso en §5 y ninguno dado de alta
   aquí: `0x535A` (la bandera que pone el handler de INT 1Ch), `0x5358` (`int 0x12`, memoria
   BIOS), `0x535E` (base de la tabla de 4×8 que rellena la rutina `0x1184`,), `0x5386`, `0x539A`,
   `0x5422`/`0x5424` (los dos contadores del doble bucle de retardo), `0x5426` (tabla de shifts),
   `0x5454`/`0x5456`. Familia del ledger, cola de #98/#99.
3. **`corchete-190-acta` §2.2 tiene el censo corto** (8 vs 19 accesos, §2.4). No se corrige el
   acta ajena desde aquí; queda anotado y el ledger publica ya la cifra buena.
4. **`liston-c-207-t2-acta` §4 está rancia** (§2.3): su `g_unk_5958` ya está en el catálogo. Al
   dueño de esa cola por si sostiene alguna cuenta.
5. **`corchete-190-acta` §5 cuenta 3 adjudicaciones nuevas y son 2** (§4.2): `0x13b2` ya estaba
   en la lista de cuatro de `pegajosa-103-acta` §1. Corrección de UNA cifra de novedad, sin
   efecto en ningún veredicto; al dueño de esa acta.

---

## 8. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

Desde la RAÍZ del worktree, con los 28 `.asm` y las 11 entradas de `original/` symlinkeadas una
a una (sin `original/` el `seed_gate` sale rojo MUDO).

```
python3 re/tools/seed_gate.py                                    EXIT=0
python3 -m pytest re/tools/test_frontier.py \
                 re/tools/test_genero.py \
                 re/tools/test_cita_segmento.py -q                EXIT=0   (97 passed)
python3 re/tools/genero.py                                        EXIT=0
python3 re/tools/cita_pegajosa_forma.py                           EXIT=0   (349 pares, 3 controles)
python3 re/tools/cita_pegajosa_atribucion.py                      EXIT=0   (3 + 5 + 2 controles)
python3 -m pytest re/tools/test_globals.py -q                     EXIT=0   (20 passed)  ← toco el ledger
python3 re/tools/globals_map.py                                   EXIT=0   (194 entradas)
```

Los dos últimos NO estaban en la lista del encargo: se añaden porque este carril **toca
`globals.json`**, y el validador de solapes/duplicados del catálogo es quien defiende el alta.

⚠ **`seed_gate` salió ROJO en la primera pasada** y con razón: mi propia acta sembraba nombres
(11 `[siembra]` + 2 `[pisa]`), casi todos por listas de offsets entrecomillados PEGADOS entre sí
en las tablas de §2.4 — el offset anterior deja su cola (`x1146`) como «nombre» del siguiente.
Arreglado con COMAS (nunca con prefijo `CS`), en dos pasadas, hasta verde. Queda anotado porque
es el modo de fallo más probable de cualquier acta que publique un censo de offsets en tabla.

⚠ **`--todas` devuelve EXIT=1 por diseño y NO es regresión mía**: el control (3) del partidor
compara la población contra la reducción de `sweep4`, así que con `--todas` no puede cuadrar.
Verificado en el árbol base antes de tocar nada. El gate verde es el modo por defecto.

Nada de e2e (HOLD). `routine-census.json` NO regenerado (embargo #84). `pytest re/tools`
COMPLETO no corrido (lleva un test de oráculo EN VIVO); los ficheros de test, por nombre.
`game/src` sin tocar ⇒ no aplican `tsc` ni vitest.

---

## 9. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84; `re/notes/` no es corpus del extractor (medido en
`pegajosa-103-acta` §0.2), así que es precaución.

Overlays nombrados: `ULTIMA.EXE`, `INTRO.OVL`, `TOWN.OVL`, `DUNGEON.OVL`, `SJOG.OVL`,
`CMDS.OVL`, `MAINOUT.OVL`, `CAST.OVL`, `TALK.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `COMBAT.OVL`,
`ENDGAME.OVL`, `LOOKOBJ.OVL`, `OUTSUBS.OVL`, `EGA.DRV`.
