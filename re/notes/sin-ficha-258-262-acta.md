# ACTA #258 + #262 — la PRECONDICIÓN: ¿qué direcciones sin ficha son DS DEL KERNEL?

> Carril `re/septima-256` (segundo commit encima), base `main` @`e78fed85` — que es
> **mi propio #256 picado** (37475f73 → e78fed85, blobs idénticos). `re/ledger/globals.json`
> **sin deriva** entre mi HEAD y main, verificado con `git diff --stat` antes de empezar.
> GO del lead al lote conjunto. RETENIDA: aterriza el lead.

Las dos tarjetas son la misma pregunta por dos vías: **#258** son los 42 sitios del SEXTO
canal (`mov word ptr [mem], DIR`) con inmediato en ventana DS y sin entrada en el ledger;
**#262** son los 75 de la SÉPTIMA forma (`add reg, ADDR`) en la misma situación. La
PRECONDICIÓN que escribí yo mismo al abrir #262 va primero y es innegociable: **comprobar
que la banda es DS DEL KERNEL antes de proponer alta alguna.**

---

## 0. ★★ EL CRUCE DE LOS DOS BUCKETS: la intersección es CERO, y eso REFUTA la premisa del lote

Lo primero que pedía el método del lead — «la intersección es la cola de máxima calidad».
**No hay intersección.**

| | sitios | direcciones distintas |
|---|---:|---:|
| SÉPTIMA forma, sin ficha (#262) | 75 | **40** |
| SEXTO canal, sin ficha (#258) | 42 | **37** |
| **∩** | — | **0** |

★ La premisa era mía —la escribí en la tarjeta #262 («si una dirección sale en los dos
buckets, el caso se refuerza solo») y el lead la repitió al dar el GO. **Ninguna de las 40
aparece entre las 37.** El lote no tiene esa cola, y el «se refuerza solo» no va a pasar.

★★ Y la forma de las dos listas apunta a por qué, aunque **eso hay que medirlo, no
suponerlo**: las dos están hechas de **racimos por overlay**, no de direcciones compartidas.
En la 6ª: `ENDGAME.OVL` 0x3DA6/0x3DA7/0x3DB2/0x3DB4/0x3DCA · `OUTSUBS.OVL`
0x3976/0x3980/0x3989/0x3992 · `NPC.OVL` 0x6D46/0x6D50/0x6D5E/0x6D6A · `DNGLOOK.OVL`
0xA528/0xA627/0xA628/0xA728. En la 7ª, el racimo de `DUNGEON.OVL` que ya describí.
**Cada overlay trae su propio grupo de direcciones sin fichar.**

⚠ Y ese patrón admite DOS lecturas opuestas, que es exactamente lo que la precondición
existe para separar:
- **(a) globales del kernel sin fichar**, cada una usada por el overlay que la necesita;
- **(b) datos PROPIOS del overlay**, que no son globales del kernel en absoluto.

La intersección cero es evidencia *a favor de (b)* —si fueran globales compartidas del
kernel, esperaríamos ver la misma dirección desde varios sitios— pero **no la prueba**, y
hay contraejemplos claros en la propia lista: `0x9248` sale en CINCO ficheros y `0x6608` en
TRES. Así que la población no es homogénea y el corte **multi-fichero vs un solo fichero**
es el primer discriminador, medible y declarado.

---

## 1. Lo que YA está medido al escribir el pre-registro (y por tanto NO se predice)

| magnitud | valor |
|---|---|
| extensión empírica del ledger | `0x13AE` … `0xBD3F` (194 entradas) |
| `0x6608` respecto al ledger | cae **2 B después** del final de la entrada anterior, que acaba en DS 0x6606 — o sea pegada a una fichada |
| `0x2EA4`/`0x2ED4`/`0x2EF2` | dentro del hueco `0x25F1`…`0x367E` (4237 B sin fichar) |
| uso de `cs:` en los cuatro `.DRV` | **457–536 por fichero** (datos propios en CS) |
| uso de `cs:` en los overlays | **1–4 por fichero** (casi todo tablas de salto) |
| tres sitios ya leídos, **sin override** | `FONT.OVL:0x0355` (`cmp byte ptr [di], 0xfe`, bucle `add di, 0x20` ×4) · `OUTSUBS.OVL:0x00f8` (`push ax`, paso como argumento) · `ULTIMA.EXE:0x1879` (`[bx]`, `[bx+2]`, `[bx+7]`, paso 8, índice desde `[0x5386]`) |

### 1.1 EL CRITERIO de la precondición, declarado ANTES de aplicarlo

En este binario los overlays **comparten el DS del kernel** —es la premisa de que el ledger
funcione entre overlays— y sus datos propios se direccionan con **override `cs:`**. Por eso
el discriminador no es la banda numérica sino **el prefijo de segmento de la
DESREFERENCIA**, que es el mismo eje del punto ciego de #188 y del arreglo de #245:

1. `DS_SIN_OVERRIDE` — se encuentra la desreferencia del puntero construido y **no lleva
   prefijo** ⇒ direcciona DS ⇒ **precondición CUMPLIDA**.
2. `OVERRIDE_AJENO` — todas las desreferencias llevan `cs:`/`es:`/`ss:` ⇒ **no es DS del
   kernel**.
3. `PASO_COMO_ARGUMENTO` — el puntero se `push`ea y lo desreferencia el callee ⇒ **NO
   CONCLUYENTE**. Es puntero, pero el segmento se decide fuera de la ventana.
4. `SIN_RASTRO` — ni desreferencia ni `push` en la ventana ⇒ **NO CONCLUYENTE**.

★ Los buckets 3 y 4 son «no lo sé», **jamás «no lo es»**. Es la lección de «la ausencia no
se prueba con `head`»: un `push` que no veo desreferenciar no es una refutación.

## 2. PRE-REGISTRO — escrito ANTES de clasificar

| # | predicción | fracasa si |
|---|---|---|
| **Q1** | de los 75 sitios de la 7ª, `DS_SIN_OVERRIDE` es mayoría: **55–85 %** | fuera de esa banda |
| **Q2** | de los 14 sitios de `0x9248`, los 12 de `.DRV` **no** dan `DS_SIN_OVERRIDE` limpio; los 2 de `ULTIMA.EXE` son el único material posible | algún `.DRV` da desreferencia DS sin override |
| **Q3** | el racimo de `DUNGEON.OVL` (9 sitios) da `DS_SIN_OVERRIDE` en los **9** | alguno lleva override |
| **Q4** | de las 40 direcciones de la 7ª, las MULTI-FICHERO son minoría: **15–40 %** | fuera de esa banda |
| **Q5** | ★ **CONTROL DE LA INTERSECCIÓN CERO**: el cero de §0 sólo significa algo si las dos formas **sí** comparten población donde se las puede comparar. Predigo que sus direcciones EN-ledger solapan mucho: **≥ 8** globales comunes de las 15 de la 7ª | el solape en-ledger es también ~0 ⇒ las dos formas no comparten poblaciones en general, y el cero de fuera-de-ledger **no dice nada especial** |

★ **Q5 es el control que impide que yo publique §0 como hallazgo sin merecerlo.** Sin él, «la
intersección es cero» podría ser una propiedad trivial de dos instrumentos que nunca miran
lo mismo. Va con su condición de fracaso escrita, y si falla, §0 se degrada a nota.

---

## 3. RESULTADO — la precondición, aplicada

| bucket | 7ª forma (75 sitios) | 6º canal (42 sitios) |
|---|---:|---:|
| `DS_SIN_OVERRIDE` | **26** | **13** |
| `OVERRIDE_AJENO` | 1 | 0 |
| `PASO_COMO_ARGUMENTO` | 6 | 0 |
| `SIN_RASTRO` | 42 | 29 |
| **SUMA** | **75** | **42** |

Por DIRECCIÓN: de las 40 de la 7ª, **19 CUMPLEN**, 1 refutada, 20 no concluyentes; de las 37
de la 6ª, **12 cumplen**, 0 refutadas, 25 no concluyentes. Multi-fichero: **6 de 40** y
**1 de 37**.

### 3.1 Las cinco predicciones

| # | predicción | medido | |
|---|---|---|---|
| Q1 | `DS_SIN_OVERRIDE` 55–85 % de los 75 | **26/75 = 34,7 %** | ✗ **FALLA** |
| Q2 | los `.DRV` no dan DS limpio | **0 de 25** | ✓ **pero DEGENERADO** (§5) |
| Q3 | el racimo de DUNGEON da 9/9 | **5/9 por instrumento** | ✗ **FALLA — y la razón es un HALLAZGO** (§6) |
| Q4 | multi-fichero 15–40 % | **6/40 = 15,0 %** | ✓ (en el borde) |
| Q5 | ★ solape EN-ledger ≥ 8 | **8** (de 15 y 9) | ✓ |

★ **Q5 SALVA §0.** Las dos formas comparten **8 de las 9** globales fichadas que ve la 6ª, y
**0 de 77** direcciones sin fichar. El contraste es el hallazgo: no es que los dos
instrumentos nunca miren lo mismo — miran lo mismo cuando hay ficha, y no coinciden nunca
cuando no la hay. §0 se queda como hallazgo, con su control.

★ **Q3 falla y descubre algo mejor**: predije 9/9 dando por hecho que las nueve direcciones
del racimo eran PUNTEROS. **Tres de las nueve no lo son: son COTAS DE BUCLE** (`0x2EB5`,
`0x2EDF`, `0x2EFB`), que se **comparan** y nunca se desreferencian, así que no pueden dar
desreferencia jamás. El instrumento decía «no concluyente» y tenía razón; el que se
equivocaba era yo al contar. Las nueve direcciones son **tres tablas** (base, base+1, fin),
no nueve globales — y ese fin **regala la extensión de la entrada** (§6).

---

## 4. ★★ DEFECTO EN MI PROPIO INSTRUMENTO DE #256, YA ATERRIZADO EN MAIN

`canal_add_base.scan()` lee los `.asm` **linealmente** y no tiene noción de código-vs-datos.
Así que el bruto 542 incluye **datos desensamblados como código**. Medido contra las zonas
de datos que `globals_negdisp` sí conoce:

| población | en zona de datos del KERNEL |
|---|---:|
| bruto 542 | **11** (ULTIMA.EXE 7 · CAST.OVL 2 · MAINOUT.OVL 1 · TALK.OVL 1) |
| `EN_VENTANA_SIN_FICHA` 75 | **3** |
| **`CANDIDATO` 165** | **0** ✅ |

⚠ **Y `globals_negdisp` sólo mapea zonas de datos del KERNEL**: para los cuatro `.DRV` no
hay mapa, así que **ningún instrumento del repo cubre el dato-como-código de los drivers**.
Lo destapé leyendo, no midiendo. En `CGA.DRV:0x13fa`, y en su gemelo `T1K.DRV:0x1226`,
aparecen `aaa`, `lcall [0x3228]` y `adc al, 0xa`; en `EGA.DRV:0x03b4`, y en su gemelo
`HER.DRV:0x03d6`, aparecen `lds sp, ptr [di]`, `in ax, 0x15` y `aad 0x35`. **Ningún compilador de C emite eso en un driver de vídeo**: es un
bitmap o una tabla que el desensamblador lineal recorrió como instrucciones.

**Qué cambia y qué no**, dicho sin rebaja:
- **El cruce contra el ledger de #256 NO cambia**: 0 de los 165 CANDIDATO caen en zona de
  datos, y 0 están en `.DRV`. Las 15 globales y sus 165 sitios se sostienen.
- **El bruto 542 y el bucket de 75 SÍ están inflados**, y las cifras publicadas en el acta
  de #256 (y clavadas en sus tests) lo están con ellos.
- **NO re-baselineo las cifras aterrizadas.** `scan()` sigue devolviendo 542 —que es
  honestamente «sitios donde el TEXTO del disasm casa la forma»— y la corrección entra como
  medida declarada aparte, con su test. Cambiar 542 en silencio sería re-escribir un acta ya
  picada; el precedente de la casa es declarar, no reescribir.

---

## 5. ★★ `0x9248` REFUTADA POR LECTURA — y con ella mi propia heurística

El cabo (b) de #262 —14 sitios, cinco ficheros, «la dirección más poblada sin ficha»— **no
es una dirección**. `CGA.DRV:0x1460` en adelante:

```
1460: add ax, 0x9248
1463: ror ax, 1          ; ×3
1469: xor ax, 0x9248     ; ← XOR con el MISMO valor que acaba de sumar
146c: add ax, 0x11
146f: mov word ptr cs:[0x1408], ax
```

Sumar una constante, rotar tres veces, hacer XOR con **la misma constante** y guardar el
resultado en los datos propios del driver (`cs:`) es un **mezclador de bits**, no un
puntero. `0x9248` = `0b1001001001001000`, patrón repetido — la pinta exacta de una constante
de dispersión. Y estando en los cuatro `.DRV` se explica solo: **es la misma rutina compilada
en cada driver.**

★ **Y eso refuta la heurística que yo mismo propuse en la tarjeta**: «multi-fichero ⇒
candidata a global del kernel». **Su mejor ejemplo era el contraejemplo.** Multi-fichero
también significa «la misma rutina copiada en cuatro binarios». El corte que yo declaré como
primer discriminador **no discrimina**, y va retirado.

⇒ Y con eso, `Q2` es un **PASE DEGENERADO**: acerté que los `.DRV` no darían DS limpio, pero
no porque el filtro los rechazara — porque **ahí no hay punteros que rechazar**. Es la misma
trampa que el `0x270F` de #256 §3, y van dos en dos tandas.

### 5.1 El negativo `0x1F40` de #256, en cambio, SOBREVIVE Y SALE REFORZADO

Leídos sus cinco sitios uno a uno, los cinco son **código real**: `CAST2.OVL:0x0015` y
`COMSUBS.OVL:0x06d6`, los dos, calculan `n * 0x640 + 0x1f40` y lo pasan a `call 0x405c` junto con
`0x2bc` — o sea **fila × 1600 + 8000**, aritmética de offset de vídeo; y `EGA.DRV:0x1b07`
hace `add di, 0x1f40` … `sub di, 0x7cd8` con `or byte ptr es:[di], al`, el paso de plano con
su prefijo `es:` a la vista. El control negativo de #256 tenía material real, y ahora está
además **leído**.

---

## 6. ★★★ EL RACIMO DE `DUNGEON.OVL`: tres tablas derivadas, y la ceguera EN UNA SOLA RUTINA

`DUNGEON.OVL:0x17cc-0x18f8` son **tres bloques hermanos** con la misma forma: índice en
`[bp+4]` desplazado, base sumada, puntero aparcado en un local, y `mov al, byte ptr [si]` /
`[bx]` **sin prefijo de segmento** ⇒ **precondición CUMPLIDA por lectura, no por instrumento**.

| base | desplazamiento | paso | cota del bucle | pares | espejo en x |
|---|---|---:|---|---:|---|
| `0x2EA4` | `shl ax, 4` | **16** | `0x2EB5` (−`0x2EA5` = 16) | **8** | `0xBE` = 190 |
| `0x2ED4` | `ax*5*2` | **10** | `0x2EDF` (−`0x2ED5` = 10) | **5** | `0x76` = 118 |
| `0x2EF2` | `shl ax, 3` | **8** | `0x2EFB` (−`0x2EF3` = 8) | **4** | — |

★ **El conteo de pares está CORROBORADO POR SEGUNDA VÍA**: cada bloque abre con
`mov word ptr [bp-2], N` y esa N es **8, 5 y 4** — exactamente los pares que da la aritmética
de la cota. Dos derivaciones independientes que coinciden.

Cada iteración lee un byte por `bx` (offsets pares) y otro por `si` (impares), los pasa a
`call 0x8a94`, y **repite con el espejo** (`0xBE − x`, `0x76 − x`): son **listas de vértices
(x,y) entrelazadas, dibujadas con simetría especular**.

### 6.1 ★★★ La ceguera de los canales de corchete, demostrada dentro de UNA rutina

La misma rutina usa **cuatro** tablas de la misma familia. Medido:

| tabla | cómo se accede | **c4 (indexado)** |
|---|---|---:|
| `0x2EA4` | `add ax, 0x2ea4` | **0** |
| `0x2ED4` | `add ax, 0x2ed4` | **0** |
| `0x2EF2` | `add ax, 0x2ef2` | **0** |
| `0x2F0A`/`0x2F10`/`0x2F16`/`0x2F1E` | `mov al, byte ptr [si + 0x2f10]` (`0x1843`) | **GENUINO** |

**Misma rutina, mismo tipo de dato, mismo propósito — y el canal ve una y no ve las otras
tres.** La diferencia no está en la naturaleza del dato: está en **cómo emitió el compilador
el índice**. Es la demostración más limpia de todo el hilo #240→#256, y cabe en veinte
líneas de una función.

---

## 7. LAS ALTAS AL LEDGER — tres, y sólo tres

Con la precondición CUMPLIDA por lectura y la extensión de la ENTRADA derivada de la cota
del bucle, entran `g_unk_2ea4` (48 B), `g_unk_2ed4` (30 B) y `g_unk_2ef2` (24 B). Método
#191: catálogo primero (las tres caen en el hueco `0x25F1`…`0x367E`, sin entrada previa),
derivación del productor citada instrucción a instrucción, sustitución de cadena con ancla
única verificada (**jamás round-trip**), y `--stat` = **21 inserciones, 0 borrados** = mis 3
entradas × 7 líneas, sin reformateo. JSON revalidado: **197 entradas, 0 nombres duplicados,
orden por `addr` intacto, y ninguna de las tres solapa** (los 4 solapes que el validador
reporta son **preexistentes** y ajenos: 0x5146/0x5148, 0x514c/0x514e, 0xAB02/0xABC7,
0xAD14/0xAD1F).

⚠ **El `size` es COTA POR VECINDAD, y va escrito así en las tres fichas.** Lo derivado es el
**paso de entrada** (16/10/8) y los **pares por entrada** (8/5/4). El **número de entradas**
no lo da el asm: el índice viene de `[bp+4]` y su dominio no está derivado. Es el mismo tipo
de cota que `g_unk_25ea` ya lleva escrito, y el precedente de nombre también: se quedan como
`g_unk_*` porque **la estructura está derivada y la SEMÁNTICA no** — no sé qué dibujan.

★ La mejor de las tres es `0x2EF2`: su límite superior (`0x2F0A`) lo ve un **canal
independiente** (c4 GENUINO en `DUNGEON.OVL:0x1930`), no mi propia tabla.

### 7.1 Lo que NO entra, y por qué

- **`0x6608`** — precondición CUMPLIDA (7 sitios, 3 ficheros, `FONT.OVL:0x0355 cmp byte ptr
  [di], 0xfe` con bucle `add di, 0x20` ×4, sin override) y pegada a una fichada (2 B tras el
  final de la anterior). **Pero su extensión no está derivada**: `FONT` la recorre a paso 32
  y `OUTSUBS.OVL:0x00f8` la indexa a paso **256** (`ah = arg`, `al = 0`). Dos pasos
  distintos sobre la misma base es un registro dentro de otro registro, o es que uno de los
  dos no es lo que parece. **Sin leer eso, un `size` sería inventado.**
- **`0x535E`** — precondición CUMPLIDA, paso 8 y campos +0/+2/+7 leídos
  (`ULTIMA.EXE:0x1879-0x1893`), con el índice viniendo de `[0x5386]`. Falta la cardinalidad.
- **`0x9248`** — REFUTADA (§5): no es una dirección.
- **Las 20 no concluyentes de la 7ª y las 25 de la 6ª** — «no lo sé» no es alta.

## 8. Lo que este carril NO ha hecho

- **No he re-baselineado las cifras de #256** (§4): 542 sigue siendo 542, y la corrección va
  declarada y con test.
- **No he arreglado el punto ciego de dato-como-código en `.DRV`**: no existe mapa de zonas
  de datos para los drivers, y hacerlo es una tarjeta propia.
- **No he leído los 42 `SIN_RASTRO`** de la 7ª ni los 29 de la 6ª.
- **No he tocado `game/src`, `main.ts`, `routine-census.json`.** Nada de e2e.

## 9. Cabos

1. ★ **Mapa de zonas de datos para los `.DRV`** (§4): hoy ningún instrumento lo tiene, y
   `aaa`/`aad`/`lds sp` en cuatro ficheros dice que hace falta. Tarjeta propia.
2. **`0x6608`: los DOS pasos** (32 en FONT, 256 en OUTSUBS) sobre la misma base (§7.1).
3. **`0x535E`**: cardinalidad, con el índice `[0x5386]` como entrada.
4. **La cuarta tabla del racimo** (`0x2F0A`/`0x2F10`/`0x2F16`/`0x2F1E`): la ve c4, sigue sin
   ficha, y es hermana de las tres que acaban de entrar.
5. **Qué DIBUJAN las tres** (`call 0x8a94` con espejo): daría el nombre y jubilaría los
   `g_unk_*`.

## 10. Overlays nombrados aquí (sección FINAL a propósito)

`DUNGEON.OVL`, `ULTIMA.EXE`, `FONT.OVL`, `OUTSUBS.OVL`, `CAST.OVL`, `CAST2.OVL`,
`COMSUBS.OVL`, `BLCKTHRN.OVL`, `CMDS.OVL`, `MAINOUT.OVL`, `TALK.OVL`, `ENDGAME.OVL`,
`NPC.OVL`, `DNGLOOK.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `SHOPPES3.OVL`, `INTRO.OVL`,
`SJOG.OVL`, `ZSTATS.OVL`, `CGA.DRV`, `EGA.DRV`, `HER.DRV`, `T1K.DRV`.

---

## 11. ★★ ADENDA OBLIGATORIA — el alta CAMBIA el censo que la produjo

Medido después de dar de alta las tres tablas, porque los tests lo cazaron al instante:

| magnitud | ledger de 194 (acta #256) | ledger de 197 (tras este lote) |
|---|---:|---:|
| `EN_VENTANA_SIN_FICHA` de la 7ª forma | **75** | **66** |
| `CANDIDATO` de la 7ª forma | **165** | **174** |
| direcciones sin ficha de la 7ª | 40 | **31** |
| globales del catálogo con población por la 7ª | 15 | **18** |
| bruto de la forma | 542 | **542** (no depende del ledger) |
| control de acuerdo `0x5C5A` | 36 | **36** |
| negativo `0x1F40` | 5 → 0 candidatos | **5 → 0** |

★ **Los nueve sitios del racimo cruzaron la frontera** en cuanto el catálogo aprendió las
tres tablas: dejaron de ser «sin ficha» y pasaron a ser candidatos de una global fichada.
**La cifra no cambió porque cambiara el binario, sino porque cambió el CATÁLOGO** — es
«cifra de censo sin SHA = FOTO» ocurriendo en vivo, dentro de la misma tanda que la produjo.

⇒ Por eso el test que fija esos dos buckets ahora **clava también el número de entradas del
ledger (197)** en la misma aserción: quien mueva el catálogo tiene que ver caer el test y
entender por qué, en vez de encontrarse una cifra que ya no significa lo que decía.

⚠ **El acta de #256 (ya picada en main `e78fed85`) NO se reescribe.** Sus 75/165 eran
correctos para el ledger de 194 entradas que tenía delante; lo que cambia es el catálogo, no
su medición. La corrección vive aquí, con la tabla de arriba, y en el docstring del test.

★ Y el control que importa: **el cero de la intersección SOBREVIVE al alta** (31 vs 37
direcciones, 0 comunes). Si el hallazgo de §0 hubiera sido un artefacto del corte, esta era
la ocasión perfecta para que se cayera.

---

## 12. ★★★ EL VUELCO: el alta REFUTA el titular de #256, y la causa es estructural

Los tests cayeron en cuanto se dieron las altas, y lo que destaparon es lo más importante
de esta tanda.

**#256 publicó: «NINGUNA global del catálogo se ve SÓLO por la séptima forma — 0 de 15».**
Tras el alta, `cobertura_por_canales()` devuelve:

| global | c1 hex | c2 sím | c3 neg | c4 idx | c5 reg | c6 imm | **c7 add** |
|---|---:|---:|---:|---:|---:|---:|---:|
| `g_unk_2ea4` | 0 | 0 | 0 | 0 | 0 | 0 | **3** |
| `g_unk_2ed4` | 0 | 0 | 0 | 0 | 0 | 0 | **3** |

★★★ **Dos globales visibles SÓLO por la séptima forma** — las que este mismo lote acaba de
dar de alta.

**Y la causa no es que #256 midiera mal: es que su censo era ESTRUCTURALMENTE INCAPAZ de
encontrar lo que medía.** `cobertura_por_canales()` recorre *las globales del ledger*. Una
global que sólo alcanza un canal **no está en el ledger** —nadie la ha fichado, porque los
demás canales no la ven— y por tanto **no puede aparecer en el cruce**. El cero no era
evidencia de ausencia: era el censo mordiéndose la cola.

⇒ **La única manera de encontrar un «solo por el canal X» es DAR DE ALTA lo que ese canal
ve.** Es decir: el hallazgo requiere el trabajo de lectura, no un instrumento mejor. Y da
la vuelta al veredicto de #256 sin desmentir ni una de sus cifras — lo que cae es su
alcance, que yo escribí como si hablara del binario cuando hablaba del catálogo.

Es la versión más profunda de «cero emisiones ≠ cero capacidad» que ha salido en este hilo,
y la generalización va escrita para las siguientes tandas: **todo censo de invisibilidad
medido sobre un catálogo mide el CATÁLOGO.** Los de #240, #242, #246 y #256 comparten el
defecto, y ninguno lo declaraba.

### 12.1 Y con el mismo golpe se movieron cifras publicadas de #242/#247

No sólo mis buckets: **las cuatro celdas de reparto del QUINTO canal** cambiaron con el
alta, sin que el corpus se tocara.

| celda de #242 | con ledger de 194 | con ledger de 197 |
|---|---:|---:|
| bruto | 3.064 | **3.064** (no depende del ledger) |
| PTR en-ledger | 193 | **195** |
| NO-PTR en-ledger | 144 | **145** |
| PTR fuera | 486 | **484** |
| NO-PTR fuera | 2.241 | **2.240** |
| globales «base 0 y sólo interiores» (#247) | 7 | **8** |

⚠ **Ninguna de esas cifras estaba mal.** Eran fotos de un catálogo de 194 entradas. Lo que
faltaba —y ahora está— es que el test lo DIJERA: los tres trinquetes afectados clavan hoy
`len(globals_map.entries()) == 197` **en la misma aserción**, para que el siguiente que
mueva el catálogo vea caer el test y entienda por qué, en vez de encontrarse una cifra que
ya no significa lo que decía.

★ Fue el propio trinquete el que cazó las tres, en el mismo minuto del alta. Sin esos tests
yo habría publicado el lote dejando cuatro cifras de #242 desincronizadas en silencio.

---

# ANEXO — los cabos (1) y (2) de #258, que la primera tanda NO hizo

La tanda anterior cerró sólo el cabo **(3)** de #258 (los 42 sin ficha). Los otros dos
seguían abiertos y van aquí. Base: rama `re/septima-256` @`a95d892d`.

## A1. CABO (1) — los 15 `DESTINO_GLOBAL` no son 15 casos: son TRES FAMILIAS

El bucket que #246 dejó descrito como «el puntero se aparca en una global, no en un local»
tiene 15 sitios y **tres direcciones destino**. Adjudicados leyendo a sus CONSUMIDORES:

| familia | sitios | holder | qué recibe | **qué es, derivado** |
|---|---:|---|---|---|
| **A** | **9** | `[0x5394]` | `0x2320` · `0x2322` · `0x25CA` | ❌ **PUNTERO A CÓDIGO** |
| **B** | **5** | `[0xBCDE]` | `0xB21E` (`g_text_scratch`) | ✅ **CURSOR de escritura** |
| **C** | **1** | `[0xB11C]` | `0xB21E` (`g_text_scratch`) | ✅ **BASE que se SUMA** |

### A1.1 ★ Familia A: NO es material de puntero a dato — 9 de los 15 se caen

Los **diez** consumidores de `[0x5394]` son `lcall [0x5394]` (`ULTIMA.EXE:0x0bd6`, `0x0f19`,
`0x0fce`, `0x1020`, `0x1699`, `0x1d51`, `0x1eea`, `0x7289`, `0x72c8`, y `0x7698` con
prefijo `ss:`). **Llamada FAR indirecta** ⇒ `0x2320`, `0x2322` y `0x25CA` son **offsets de
CÓDIGO**, no direcciones de datos.

★ Y el `lcall` lo remata: una llamada far consume **32 bits** (offset + segmento), mientras
que el sitio del sexto canal escribe `mov word ptr [0x5394], 0x2322` — **sólo la mitad de
offset**. La otra mitad se escribe en otro sitio. Un inmediato que es media dirección far
no puede ser una global DS.

⇒ **Clase de basura NUEVA para el sexto canal: `PUNTERO A CÓDIGO APARCADO EN GLOBAL`.**
No estaba en la partición de #246 —que sólo separaba magnitud, segmento, destino-global y
destino-indirecto— y se lleva **9 de los 15** del bucket.

### A1.2 Familia B: el mecanismo que #246 sospechaba, y es real

Los 16 consumidores de `[0xBCDE]` en `TALK.OVL` son el idioma inequívoco de un **cursor**:
`inc word ptr [0xbcde]` cuatro veces (`0x0791`, `0x07bf`, `0x0958`, `0x0a1c`),
`add word ptr [0xbcde], 3` (`0x0859`), y cargas a `si`/`bx` para desreferenciar
(`0x072f`, `0x0788`, `0x07c3`, `0x094d`, `0x0981`, `0x0bef`).

⇒ Los cinco `mov word ptr [0xbcde], 0xb21e` son **RESETS del cursor al principio del
búfer**. El modelo de desreferencia de #246 (puntero en local de pila, usado cerca)
efectivamente **no cubría esto**, y la sospecha de aquella acta era correcta.

### A1.3 ★★ Familia C: la base viene de una GLOBAL — y destapa población oculta por INDIRECCIÓN

`ULTIMA.EXE:0x00a1`, que aparca `g_text_scratch` en `[0xB11C]`, y **NPC.OVL lo consume doce
veces con `add bx, word ptr [0xb11c]`** (`0x022c`, `0x0239`, `0x02b9`, `0x02f6`, `0x038a`,
`0x03c7`, `0x03d4`, `0x04ce`, `0x056a`) más tres cargas directas (`0x0253`, `0x030d`,
`0x031d`).

★ **Es la SÉPTIMA FORMA de #256 con la base viniendo de una global en vez de un
inmediato**. Y la consecuencia es la que importa: esos **doce accesos a `g_text_scratch`
mencionan `0xB11C`, nunca `0xB21E`**. Ningún censo por dirección se los atribuye a
`g_text_scratch` — su población está oculta **por una indirección**, no por una forma
sintáctica.

### A1.4 ⚠ Y por qué esto NO se convierte en una «octava forma» con su canal

Medí el patrón `add reg, word ptr [global]` en los 28 ficheros: **44 sitios**. Pero
**24 de ellos son `g_cmb_scratch_x` (13) y `g_cmb_scratch_y` (11)**, que #229 derivó como
**DELTAS**, no punteros. O sea: la misma instrucción es *aritmética normal* cuando el holder
es un escalar y *base de puntero* cuando el holder es un puntero.

⇒ **VEREDICTO NEGATIVO SOBRE EL MÉTODO: esta variante NO es mecánicamente separable.** Las
formas 1-7 se podían censar por su forma sintáctica; ésta exige **saber de qué tipo es el
holder**, que es justo lo que un censo por patrón no sabe. No se puede fabricar un canal
octavo con ella, y decir «44 sitios» como si fueran población sería el error de siempre.
Lo que sí queda probado es que **hay población real oculta por indirección**, con nueve
ejemplares leídos.

## A2. CABO (2) — VENTANA CORTA, no «punteros guardados». Los dos canales, adjudicados JUNTOS

La pregunta que #242 dejó con sus 60 y #246 con sus 123 era: *¿la ventana se queda corta o
son punteros guardados para mucho después?* Se decide con un barrido, y sale **inequívoco**:

| ventana | 6º canal (130 candidatos en-ledger) | 5º canal (bucket PTR entero, 656) |
|---:|---|---|
| 10 / 12 | 49 (38 %) | 357 (54 %) |
| 16 | 71 (55 %) | 418 (64 %) |
| 24 | 82 (63 %) | 487 (74 %) |
| 32 | 92 (71 %) | 524 (80 %) |
| 48 | 109 (84 %) | 573 (87 %) |
| **64** | **117 (90 %)** | **592 (90 %)** |

★ **Los dos canales convergen al MISMO 90 %**, por vías independientes y con instrumentos
distintos. La tarjeta apostaba a que se adjudicaban juntos y así ha sido: **el bucket «sin
uso cercano» era un artefacto de la VENTANA**, no una clase de mecanismo. De los 123 del
sexto canal, la mayoría aparecen al mirar un poco más lejos.

⚠ **Y la reserva, que va en la misma frase porque sin ella esto se lee al revés**: una
ventana más ancha es una aproximación **MÁS DÉBIL**, no una prueba más fuerte. En 64
instrucciones el registro o el local pueden reasignarse con mucha más facilidad que en 12.
El barrido **no convierte candidatos en accesos**; sólo demuestra que la frontera
12-vs-sin-uso no marcaba nada real. **La ventana de 12 se queda como está en los dos
módulos**, precisamente porque es la aproximación honesta; lo que cambia es cómo se lee su
bucket residual.

★ Lo que sí queda como población de verdad no explicada es el **~10 % restante en los dos
canales** (13 del sexto, 64 del quinto). Ése es el residuo real, y sigue sin leer.

## A3. Estado de #258 tras este anexo

| cabo | estado |
|---|---|
| (1) los 15 `DESTINO_GLOBAL` | ✅ **ADJUDICADO**: 3 familias, 9 refutados (código), 5 cursor, 1 base-por-indirección |
| (2) los 123 sin uso cercano | ✅ **ADJUDICADO**: ventana corta, no mecanismo; junto con los del 5º canal |
| (3) los 42 sin ficha en ventana DS | ✅ **ADJUDICADO** en la tanda anterior (§0-§12) |

⚠ **Lo que #258 NO cierra**: el ~10 % residual del cabo (2), la clase nueva «puntero a
código» sin cablear a la partición de `canal_inmediato_mem` (la dejo MEDIDA y con test, no
cableada: tocar la partición movería las cifras publicadas de #246, y eso es decisión del
lead), y los 9 accesos de `NPC.OVL` a `g_text_scratch` por indirección, que **no están en
ningún censo de esa global**.

---

# ANEXO B — #265 pieza (1): el MAPA DE ZONAS DE DATOS DE LOS `.DRV`, con VEREDICTO NEGATIVO

Base: rama `re/septima-256` @`34845e29`. Instrumento: `re/tools/drv_data_zones.py`.

## B1. Lo que la tarjeta pedía, y por qué no se puede entregar así

El hueco es real y lo probé leyendo en #262: en los cuatro `.DRV` hay dato-como-código
(`aaa`, `aad 0x35`, `lds sp, ptr [di]`) que ningún instrumento del repo cubre. La tarjeta
pedía el mapa «con el método de las dos zonas del kernel como plantilla».

★ **La plantilla no es transferible, y esa es la primera respuesta.** Las dos zonas del
kernel **no se estimaron**: salen de `exe_layout.segments()` (el segmento de datos del
`.EXE`, delimitado por el `retf` del trampolín crt0) y de las constantes PLINK de
`routine_census`. Son **estructura externa**. Los `.DRV` no tienen cabecera MZ ni
`exe_layout` equivalente ⇒ ese camino **no existe** para ellos.

Lo que queda es un detector estadístico. Y un detector hay que calibrarlo antes de creerle.

## B2. ★★ LA CALIBRACIÓN CONTRA VERDAD DE CAMPO, y cómo tumbó mi propio tell

Las dos zonas del kernel están derivadas ⇒ sirven de ground truth. Amplié el tell heredado
(«FPU, que U5 no tiene ninguna») con BCD, puertos, `lds sp` e inválidas, razonando que un
compilador de C de 1988 tampoco emite eso. **Medido, cada familia añadida lo empeoró:**

| familias | ratio dentro/fuera | precisión | recall |
|---|---:|---:|---:|
| todas (mi ampliación) | 9,6 | **0,46** | 0,35 |
| sin `PUERTO` | 57,0 | 0,74 | 0,28 |
| `FPU` + `INVÁLIDA` | 54,8 | 0,74 | 0,28 |
| **solo `FPU` (el heredado)** | **143,6** | **0,94** | 0,21 |

★ **La peor familia es `PUERTO`, y la causa es de manual: `in`/`out` es el OFICIO de un
driver de vídeo, no una imposibilidad.** En `EGA.DRV` son **278 de los 304** «imposibles»
que yo estaba contando. Metí en la lista de lo-que-no-puede-pasar justo lo que el fichero
hace todo el rato. El tell heredado se queda **tal cual estaba**; mi ampliación se retira.

## B3. ★★★ EL VEREDICTO: con el tell calibrado, los `.DRV` dan CERO zonas

| fichero | zonas candidatas | `FPU` (el tell) | familias que sí disparan |
|---|---:|---:|---|
| `CGA.DRV` | **0** | **0** | BCD 5 · INVÁLIDA 7 · PUERTO 7 |
| `EGA.DRV` | **0** | **5** | PUERTO 278 · INVÁLIDA 10 · BCD 9 · PTR_FAR 2 |
| `HER.DRV` | **0** | **4** | PUERTO 21 · BCD 10 · INVÁLIDA 9 · PTR_FAR 2 |
| `T1K.DRV` | **0** | **0** | INVÁLIDA 33 · PUERTO 9 · BCD 3 |

★★ **Y esto NO es «no hay datos en los `.DRV`»** — hay, los leí. Es que **el tell que
funciona en el kernel no transfiere**: los datos del kernel resultan decodificar como
instrucciones de FPU, y los de los drivers decodifican como BCD, puertos e inválidas, que
son exactamente las familias que fallaron la calibración. **No hay tell transferible.**

⇒ **VEREDICTO NEGATIVO sobre la vía estadística.** Las zonas de datos de los `.DRV` no se
pueden derivar así. Harían falta: el **formato de fichero** del driver (si lo tiene),
**alcanzabilidad** desde sus puntos de entrada, o un **oráculo**. Ninguna de las tres es un
barrido de texto, y las tres son trabajo nuevo.

## B4. Lo que SÍ se entrega, y su límite impreso al lado

`es_probable_dato(fichero, off)` — **aviso POR SITIO**, precisión **0,94** contra verdad de
campo. Es lo único que el control respalda.

⚠ Y su recall va como **constante del módulo** (`RECALL_MEDIDO = 0.21`) a propósito: un
`False` **NO** significa «esto es código», significa «no lo sé». El detector se deja cuatro
de cada cinco sitios de datos, y quien lea su silencio como prueba de codigüidad está
fabricando un cero — la firma exacta de «la ausencia no se prueba».

★ **Impacto sobre #256: NINGUNO, y es la lectura correcta.** Con cero zonas candidatas, el
detector no excluye ni un sitio: bruto 0, sin-ficha 0, candidatos 0. Las cifras de #256
**no se mueven**, y el ruido que yo declaré en §4 de esta acta **sigue ahí sin acotar**. La
tarjeta buscaba acotarlo y el resultado es que no se acota por esta vía.

## B5. Estado de #265 tras este anexo

| pieza | estado |
|---|---|
| (1) mapa de zonas de datos `.DRV` | ✅ **CERRADA con VEREDICTO NEGATIVO** — no hay tell transferible; queda el aviso por sitio |
| (2) la 4ª tabla del racimo | ⬜ **SIN HACER** — material servido en §6.1 y abajo |
| (3) qué DIBUJAN las tres | ⬜ **SIN HACER** |
| (4) `0x6608` / `0x535E` | ⬜ **SIN HACER** — material servido en §7.1 |

⚠ **Paro aquí por contexto, como el lead pidió que hiciera, y dejo el relevo servido en vez
de empezar una pieza que no podría cerrar.** Ninguna alta al ledger en este anexo ⇒ el pin
`len(entries) == 197` **no cambia**.

### B5.1 Relevo servido para la pieza (2), la más barata de las tres

La 4ª tabla es `0x2F0A`/`0x2F10`/`0x2F16`/`0x2F1E`, y **la ve el canal 4** (`idx_particion`
la da GENUINA). Sus accesos medidos: `DUNGEON.OVL:0x1843` `mov al, byte ptr [si + 0x2f10]`
y `0x183b` con `+0x2f11`, tras `shl si, 1` ⇒ **paso 2**. Los demás accesos del bloque, con su
desplazamiento en celda aparte:

| sitios en `DUNGEON.OVL` | desplazamiento |
|---|---|
| `0x1925` · `0x1930` | `0x2F0A` / `0x2F0B` |
| `0x1984` · `0x198b` | `0x2F16` |
| `0x19b1` · `0x19b8` | `0x2F1E` |
La derivación debería ser **análoga a la de las tres ya dadas de alta**: buscar el `mov
word ptr [bp-2], N` del prólogo de su bloque y la cota del bucle. Y ojo al pin: si entra al
ledger, `197` pasa a `198` en los tres trinquetes que lo clavan.

---

# ANEXO C — #265 pieza (2): la «4ª tabla» son TRES, y una trae la CARDINALIDAD DERIVADA

## C1. El encuadre de la ficha era mío y estaba mal: no es una tabla

La tarjeta hablaba de «la 4ª tabla del racimo (`0x2F0A`..`0x2F1E`)». Leído el bloque entero
(`DUNGEON.OVL:0x1920`-`0x19d7`), son **tres objetos distintos, y dos de ellos ni siquiera
viven en la misma rutina**:

| base | rutina | forma | paso | índice |
|---|---|---|---:|---|
| `0x2F0A` | la del racimo (acaba en `0x194f ret 4`) | par (x,y) con espejo, como sus 3 hermanas | **2** | `[bp+4]` |
| `0x2F16` | **otra**, empieza en `0x1952` | byte con **centinela 0** | **1** | `[bp-2]`, acotado |
| `0x2F1E` | la misma que `0x2F16` | gemela exacta, otras banderas | **1** | ídem |

## C2. ★★★ LA CARDINALIDAD SALE DE UN GATE — lo que faltaba en las tres altas de #262

Las tres tablas que entraron en #262 llevan el `size` como **cota por vecindad**, declarado
así porque el dominio del índice no estaba derivado. Aquí **sí lo está**:

```
1966: mov cl, 4
1968: sar ax, cl
196a: mov word ptr [bp - 2], ax     ; el índice
196d: or ax, ax     / 196f: jle 0x19f0   ; fuera si <= 0
1971: cmp ax, 8     / 1974: jge 0x19f0   ; fuera si >= 8
```

⇒ **el índice vive en `[1,7]` EXACTO**. Con un byte por entrada y la ranura 0 inalcanzable,
la extensión es **8 B**. Y el límite está **corroborado por segunda vía independiente**: la
tabla siguiente empieza exactamente en `0x2F16 + 8`.

★ Hay además un caso especial para el índice 6 (`cmp ax, 6` / `jne` / `test byte ptr
[bp - 4], 7` / `jne`): el 6 exige que los tres bits bajos del valor **pre-desplazado** sean
cero. Es mecánica, y va a la ficha.

★★ **Y las cuatro del racimo TESELAN sin huecos**, que es la corroboración más fuerte del
conjunto: `0x2EA4` +48 → `0x2ED4` +30 → `0x2EF2` +24 → `0x2F0A` +12 → `0x2F16` +8 →
`0x2F1E` +8 → `0x2F26`. Ninguna cota se pisa con la siguiente.

## C3. Las altas, y el pin

Tres entradas: `g_unk_2f0a` (12 B, **cota por vecindad** — pero su vecino ya es derivado),
`g_unk_2f16` (8 B, **DERIVADO del gate**), `g_unk_2f1e` (8 B, **DERIVADO**). Ancla única
verificada, sustitución de cadena, `--stat` = **21 inserciones** = 3 × 7 líneas. JSON
revalidado: **200 entradas**, 0 duplicados, orden intacto, **cero solapes míos**.

★ **Y el pin subió como estaba diseñado**: `len(globals_map.entries())` pasa de **197 a
200** en las aserciones que lo clavan, en esta misma entrega. Las cuatro celdas de #242 y
los buckets de #256 **no se movieron** con estas tres altas —se comprueba en los tests, que
siguen verdes con sus valores— porque estas direcciones entran por corchete y no por las
formas 5, 6 ni 7. Que el pin cambie y las cifras no es exactamente la señal que el trinquete
existe para dar.

## C4. Estado de #265

| pieza | estado |
|---|---|
| (1) mapa `.DRV` | ✅ CERRADA, **veredicto negativo** (Anexo B) |
| (2) la «4ª tabla» | ✅ **CERRADA — eran TRES, 3 altas, 2 con size derivado** |
| (3) qué DIBUJAN | ⬜ sin hacer |
| (4) `0x6608` / `0x535E` | ⬜ sin hacer |

⚠ Para la (3), el material que deja esta lectura: `0x2F16`/`0x2F1E` **no van a `0x8a94`**
(el plot del racimo) sino a **`call 0x134a`** con dos banderas booleanas. O sea que la
rutina de `0x1952` **no es la misma familia de dibujo**, y el nombre de las tres del racimo
no se lo puede prestar. La puerta para quien siga es la rutina `DUNGEON.OVL:0x134a`, con sus
dos banderas booleanas.
