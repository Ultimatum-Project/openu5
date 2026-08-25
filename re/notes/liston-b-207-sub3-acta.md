# ACTA #207 — SUB-TANDA 3 DE LECTURA (los 37): el grupo de `SHOPPES`, 5 pares, 3 lecturas

> Rama `re/liston-207`, worktree `.claude/worktrees/liston-207`. Carril `liston-b-207`.
> Continúa `liston-b-207-sub2-acta.md`, ya en main como `49b40ceb`.
> RETENIDA: aterriza el lead.

---

## 0. VEREDICTO

**5 pares · 5 (a) exacta · 0 (b) · 0 (c) · 0 (d)** — en **3 lecturas** (ritmo 0,60).

| par | fichero del port | veredicto |
|---|---|---|
| `SHOPPES.OVL:0x083e` | `core/game.ts:3752` | **(a)** exacta — el salto de salida es literal, y la cadena byte a byte |
| `SHOPPES.OVL:0x0f2a` | `core/world/cmd-strings.ts:318` | **(a)** exacta — el «no-N ⇒ Y» se sostiene, pero por DOS pasos (§3.2) |
| `SHOPPES.OVL:0x1352` | `core/shops/shoppe-greetings.ts:116` | **(a)** exacta — sus CUATRO afirmaciones, una a una |
| `SHOPPES.OVL:0x1390` | `core/world/cmd-strings.ts:390` | **(a)** exacta — el gate de tamaño de party y su cadena |
| `SHOPPES.OVL:0x1510` | `core/world/cmd-strings.ts:382` | **(a)** exacta — y el gate es un BUCLE de reintento (§3.3) |

★ **Nueve cadenas cotejadas byte a byte** contra `DATA.OVL`, con sus espacios finales y sus saltos
de línea: ninguna discrepancia.

★★ **Y una CORRECCIÓN A MI PROPIA ACTA ANTERIOR** (§4.1): lo que la sub-tanda 2 §4.2 archivó como
«offsets imprecisos» y esto parecía repetir **son DOS géneros distintos**, y aquí el port sigue una
**convención consistente** que se verifica 4/4. No debí meterlos en el mismo saco sin medir.

## 1. RE-ANCLA

```
git log -1 main                 → 49b40ceb   (la SUB-TANDA 2 aterrizó ahí)
git diff main -- game/src       → VACÍO  ⇒ la prosa del port de mi árbol ES la de main
cita_pegajosa_atribucion.py     → 341 pares, 507 citas, 3 controles verdes   EXIT=0
clase2 × (FORZADA + LIMPIA)     → 53, cotejada POR MIEMBROS contra el HITO 1
```

| | resultado |
|---|---|
| bajas | **0** |
| altas | **0** |
| intersección | **53 / 53** |

⚠ El diff vacío de `game/src` contra main es la condición que hace válida esta lectura sin volver a
mergear: la sub-tanda 2 mergeó porque el diff **no** era vacío y un docblock se había reescrito
(desplazando una línea citada); aquí se comprueba primero y sale vacío, así que **no se mergea**.
La comprobación es la misma; lo que cambia es el resultado.

## 2. Los cinco pares agrupan en TRES lecturas

| lectura | pares | flujo del binario | flujo del port |
|---|---|---|---|
| §3.1 | `:0x083e` | escaneo de establo, `SHOPPES.OVL:0x07cb-0x086a` | `stableSpotFree` |
| §3.2 | `:0x0f2a` + `:0x1352` | venta del herrero, `SHOPPES.OVL:0x0f64` + su despachador | `sellDeal*` + charla |
| §3.3 | `:0x1390` + `:0x1510` | cadena del curandero, `SHOPPES.OVL:0x14f8` + picker | bloque `CADENA DEL CURANDERO` |

★ Otra vez agrupa por RUTINA y otra vez **cruzando ficheros**: §3.2 junta `cmd-strings.ts` con
`shoppe-greetings.ts` porque los dos describen la misma venta.

## 3. Las tres lecturas

### 3.1 `SHOPPES.OVL:0x07cb-0x086a` — el establo cerrado

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES.OVL:0x0832`, | `cmp word ptr [bp - 0xa], 4` / `je 0x83e` | `0x083e` | sin hueco de establo |
| `SHOPPES.OVL:0x083e`, | `mov ax, 0x7a48` / `push` / `call 0x75c0` | — | imprime el aviso |
| `SHOPPES.OVL:0x0845`, | `jmp 0x9a3` | `0x09a3` | **sale del flujo entero** |

DS `0x7a48` = `b'The stables are closed.\n'`, byte a byte ✓.

**(a) exacta.** La cita escribe *«sin hueco imprime … y sale SIN saludo ni despedida (…→0x09a3)»*
—con el offset de entrada elidido aquí y puesto en la tabla de arriba, en celda propia— y la flecha
es **literal**: el `jmp` a `0x09a3` está tres instrucciones después de la entrada, así que
todo lo que hubiera entre medias —saludo y despedida incluidos— queda sobrevolado. El *«SIN saludo ni
despedida»* queda probado **por ORDEN**, igual que el «SIN Abandon ship!» de la sub-tanda 2.

### 3.2 `SHOPPES.OVL:0x0f64` y su despachador — la venta del herrero

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES.OVL:0x0f12`, | `cmp al, 0x4e` / `je 0xf1a` | `0x0f1a` | la tecla es `'N'` |
| `SHOPPES.OVL:0x0f16`, | `cmp al, 0x59` / `jne 0xf0c` | `0x0f0c` | **ni `'N'` ni `'Y'` ⇒ vuelve a pedir** |
| `SHOPPES.OVL:0x0f1a`, | `cmp byte ptr [bp - 2], 0x4e` / `jne 0xf2a` | `0x0f2a` | no es `'N'` |
| `SHOPPES.OVL:0x0f20`, | `mov ax, 0x7d72` / `push` / `call 0x75c0` | — | el eco de `'N'` |
| `SHOPPES.OVL:0x0f2a`, | `mov ax, 0x7d76` / `push` / `call 0x26` | — | **el eco de `'Y'`, por el expansor** |
| `SHOPPES.OVL:0x12fe`, | `cmp ax, 0x53` / `je 0x1352` | `0x1352` | el despachador, tecla `'S'` |
| `SHOPPES.OVL:0x1352`, | `mov ax, 0x804e` / `push` / `call 0x75c0` | — | el eco de la venta |
| `SHOPPES.OVL:0x135a`, | `call 0xf64` | `0x0f64` | **entra al flujo de venta** |
| `SHOPPES.OVL:0x135d`, | `mov si, 0xffff` | — | **el centinela de vuelta** |

Cadenas: DS `0x7d72` = `b'No'` · DS `0x7d76` = `b'Yes\n\n"Done!"\nsays $.'` · DS `0x804e` =
`b'Sell\n\n"'`. Las tres byte a byte ✓, incluido el `$` del expansor.

**`:0x1352` — (a) exacta, y es la más verificada del lote**: la cita hace **cuatro** afirmaciones
—rama `'S'`, el eco con su cadena, la llamada al flujo de venta, y el centinela `0xffff` al volver— y
**las cuatro** están en el binario, en ese orden y en los offsets que dice.

**`:0x0f2a` — (a) exacta, pero la derivación tiene DOS pasos y conviene decirlo.** La cita lo llama
*«eco de `'Y'`»*, y el gate inmediato sólo dice **«no es `'N'`»**. Que eso equivalga a `'Y'` **no se
lee en ese `cmp`**: se lee en el bucle de aceptación de arriba, que rechaza y vuelve a pedir todo lo
que no sea `'N'` o `'Y'`. Con las dos piezas, «no-N» sí es `'Y'`; con una sola, no. La cita **acierta**
y la derivación **existe**, sólo que vive una rutina más arriba — anotado porque un lector que
comprobara únicamente el gate citado creería que falta algo.

### 3.3 `SHOPPES.OVL:0x14f8` y el picker — la cadena del curandero

| call-site | instrucción | destino | qué es |
|---|---|---|---|
| `SHOPPES.OVL:0x137c`, | `push bp` / `mov bp, sp` / `sub sp, 2` | — | **el prólogo del picker** |
| `SHOPPES.OVL:0x1382`, | `cmp byte ptr [g_party_size], 1` / `jne 0x1390` | `0x1390` | **party > 1 ⇒ hay que elegir** |
| `SHOPPES.OVL:0x1389`, | `mov word ptr [bp - 2], 0` | — | party de 1 ⇒ **miembro 0, sin preguntar** |
| `SHOPPES.OVL:0x1390`, | `mov ax, 0x805a` / `push` / `call 0x75c0` | — | la pregunta del picker |
| `SHOPPES.OVL:0x1397`, | `call 0x8bfe` | — | lee la elección |
| `SHOPPES.OVL:0x1507`, | `cmp word ptr [bp - 4], 0` / `je 0x1510` | `0x1510` | entra al gate |
| `SHOPPES.OVL:0x1510`, | `call 0x83dc` | — | **pide tecla** |
| `SHOPPES.OVL:0x1516`, | `cmp al, 0x4e` / `jne 0x1520` | `0x1520` | ¿`'N'`? |
| `SHOPPES.OVL:0x1526`, | `mov ax, 0x80a4` | — | el eco de `'Y'` |
| `SHOPPES.OVL:0x1537`, | `jne 0x1510` | `0x1510` | ★ **ni `'N'` ni `'Y'` ⇒ REPITE** |
| `SHOPPES.OVL:0x153f`, | `jmp 0x171e` | `0x171e` | `'N'` ⇒ fuera |
| `SHOPPES.OVL:0x1542`, | `mov ax, 0x80aa` / `push` / `call 0x75c0` | — | la oferta de servicios |
| `SHOPPES.OVL:0x1549`, | `mov ax, 0x80da` / `push` / `call 0x26` | — | la pregunta, por el expansor |

Cadenas: DS `0x805a` = `b'\n\n"Who needs my aid?" '` (con su espacio final) · DS `0x80a0` = `b'No'` ·
DS `0x80a4` = `b'Yes\n\n'` · DS `0x80aa` = `b'"We have powers to Cure, Heal, or Resurrect."\n'` ·
DS `0x80da` = `b'says $.\n\n"What is the nature of thy need?" '`. Las cinco byte a byte ✓.

**`:0x1390` — (a) exacta.** *«picker con party>1»*: el `jne` dispara cuando el tamaño **no** es 1, y
la rama de caída pone el miembro 0 sin preguntar nada. El complemento está modelado, no sólo la rama.

**`:0x1510` — (a) exacta, con un matiz que la refuerza.** La cita lo llama *«gate Y/N»* y lo es, pero
además es un **BUCLE**: el `jne` de `CS 0x1537`, que es precisamente la rama hermana de tipo BACKEDGE
que el partidor anotó para este par, **vuelve a la petición de tecla**. O sea que el gate no acepta
un tercer valor ni cae por defecto: insiste. La forma que el partidor clasificó y la conducta
coinciden, que es el caso en que la celda y la lectura se confirman mutuamente.

★ Y el rango que la cabecera declara, *«0x14f8 entrada + 0x137c picker + 0x146a pago»*, se comprobó
por **PRÓLOGO** en el punto que este lote toca: en `CS 0x137c`, hay marco de pila, así que el picker
empieza donde dice y no en mitad de otra rutina.

## 4. Declarado, que no es veredicto

### 4.1 ★★ CORRECCIÓN A MI PROPIA SUB-TANDA 2: son DOS géneros, no uno

La sub-tanda 2 §4.2 declaró dos offsets de una cabecera que **no caen en frontera de instrucción**.
Aquí aparecía lo que parecía el mismo caso —citas que apuntan al `mov` y hablan del `call`— y estuve
a punto de archivarlo igual. **Medido, no es lo mismo:**

| género | ejemplo | ¿frontera de instrucción? | ¿consistente? |
|---|---|---|---|
| sub-tanda 2 §4.2 | los dos de la cabecera de hundimiento | **NO**: caen dentro de la instrucción anterior | — |
| **este lote** | los cuatro de §3.2 y §3.3 | **SÍ**, los cuatro | **SÍ, 4/4** |

En este lote el port cita **el offset donde se CARGA la cadena** (el `mov`) y lo etiqueta con **la
llamada que la consume**, que va dos o tres instrucciones después. Comprobado en los cuatro sitios
que tocan mis pares —los dos ecos de la venta y los dos del curandero—: en los cuatro, el offset
citado es exactamente el `mov`. **Eso es una CONVENCIÓN, y una razonable** (el `mov` es donde vive el
número que el lector quiere buscar), no una imprecisión.

⇒ La lección es sobre mí, no sobre el port: **«el offset citado no es el del `call`» describe dos
cosas distintas**, una de las cuales es un error de puntero y la otra una convención con criterio, y
sólo se distinguen **midiendo si el offset es frontera**. Mi acta anterior no hizo esa distinción
porque allí sólo había un caso; con cinco casos más, se ve. No retiro nada de la sub-tanda 2 —sus dos
offsets siguen sin ser frontera y siguen siendo imprecisión—, pero **su redacción sugería un género
más ancho del que sostiene la medida**, y esta acta lo acota. Familia
`cota-superior-promovida-a-mecanismo`, en pequeño y cazada a tiempo.

### 4.2 Una derivación que vive una rutina más arriba

Queda dicho en §3.2 y se repite aquí por ser el único punto del lote donde el gate citado **no basta
por sí solo**: el *«eco de `'Y'`»* necesita el bucle de aceptación de arriba para excluir el resto
del teclado. La cita es correcta; su justificación completa no cabe en el `cmp` que señala.

## 5. Estado de la cola

| | pares |
|---|---|
| no leídos al empezar el carril | **37** |
| leídos: sub-tanda 1 · 2 · **3** | 10 · 10 · **5** |
| **VIVOS** | **12** |

Acumulado del carril: **25 pares en 11 lecturas** (ritmo 0,44), **25 (a)**, cero (b), cero (c) nuevo,
cero (d). ⚠ **CORTE EN FRONTERA DE GRUPO**: `SHOPPES` queda entero (5/5).

**Los 12 VIVOS**, con orden recomendado para la sub-tanda 4:

| orden | grupo | pares |
|---|---|---|
| 1º | `SJOG.OVL` (5) | `:0x0ad4` · `:0x0ae8` · `:0x0b6e` · `:0x0e42` · `:0x0ee4` |
| 2º | `SHOPPES3.OVL` (3) | `:0x01ca` · `:0x01ef` · `:0x0378` |
| 3º | `TALK.OVL` (3) | `:0x0a78` · `:0x0b0f` · `:0x1191` |
| 4º | `TOWN.OVL` (1) | `:0x10c7` |

Seña: en el 2º cae **el segundo y último token `kernel`** del HITO 1, que se tratará igual que el de
la sub-tanda 2 — **declarar, no aplicar** (#199), y sin repetir el censo que allí resultó no valer.

## 6. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src`, `re/tools` ni `re/ledger`.** Sólo `re/notes/`.
- **No ha mergeado main**, y dice por qué: el diff de `game/src` contra main sale **vacío** (§1).
- **No retira** nada de la sub-tanda 2; le **acota** el alcance a una frase (§4.1).
- **No ha leído** los 12 restantes.

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

Al final por el ctx pegajoso de #84. Overlays nombrados: `SHOPPES.OVL`, `SHOPPES3.OVL`, `SJOG.OVL`,
`TALK.OVL`, `TOWN.OVL`.
