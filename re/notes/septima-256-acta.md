# ACTA #256 — la SÉPTIMA forma (`add reg, ADDR`), cruzada contra el ledger ENTERO

> Carril `re/septima-256`, worktree `.claude/worktrees/septima-256`, base `main` @`a140f19d`.
> Tarjeta abierta por el lote #251+#252 (`re/notes/lote-251-252-acta.md` §3, cabo 1).
> Encargo del lead: cruzar la forma contra el ledger entero con partición DECLARADA al
> estilo #242/#246, controles positivos Y negativos por clase, y medir qué globales tienen
> población invisible por esta vía. RETENIDA: aterriza el lead.

---

## 0. CONTROL DE ACUERDO con #251 §3 — corrido ANTES de nada

Reproducido con el método del acta (28 `.asm` leídos en Python, forma `add <reg>, 0xNNNN`,
ventana del ledger 256 B sobre `0x5C5A`), sin heredar ninguna cifra:

| magnitud | #251 §3 / tarjeta #256 | **re-medido aquí** | |
|---|---:|---:|---|
| accesos en la ventana de `0x5C5A` | **36** | **36** | ✓ |
| `FONT.OVL` | 7 | **7** | ✓ |
| `BLCKTHRN.OVL` | 4 | **4** | ✓ |
| `TOWN.OVL` | 3 | **3** | ✓ |
| `COMSUBS.OVL` | 3 | **3** | ✓ |
| `CAST.OVL` | **4** | **7** | ✗ |
| nº de overlays | acta «5 + 9 más» = 14 · **tarjeta: 15** | **14** | acta ✓ · tarjeta ✗ |

★ **La cifra que importa —36— reproduce EXACTA, y el reparto NO.** `CAST.OVL` tiene **7**,
no 4, y con eso los cinco overlays nombrados suman **24**, no 21. El total sigue cuadrando
porque los «sueltos» son 12 en 9 overlays, no 15 en 9. Y la **tarjeta** añade una segunda
deriva sobre su propia acta: dice «15 overlays» y «sueltos en 10 overlays más» donde el
acta dice 9 más (= 14). Son dos erratas de transcripción, no un desacuerdo de medida: **el
agregado aguanta, el desglose no**. Queda dicho porque quien copie el reparto de la tarjeta
copia una cifra que no vuelve a salir.

Los cuatro ejemplares de PUNTERO A CAMPO que la tarjeta cita están **todos** verificados en
su sitio: `BLCKTHRN.OVL:0x01d9 add ax, 0x5c5d` y `0x01e2 add ax, 0x5c5c`, `CAST.OVL:0x0c15`
/`0x0c26` (el mismo par `&reg.Y`/`&reg.X`), `CMDS.OVL:0x0a6e add ax, 0x5c5f`.

### 0.1 Lo demás que YA está medido al escribir el pre-registro (y por tanto NO se predice)

| magnitud | valor |
|---|---:|
| corpus | **28** `.asm` (ver §0.2) |
| **bruto** de la forma en todo el corpus | **542** |
| de ellos con inmediato en la ventana DS `[0x1000, 0xF000]` | **242** |
| fuera de la ventana DS | **300** (55,4 %) |
| registros del bruto | `ax` 287 · `si` 131 · `di` 72 · `al` 36 · `dx` 6 · `cx` 4 · `bx` 2 · `ah` 2 · `dh` 1 · `sp` 1 |
| registros **dentro** de la ventana DS | `ax` 181 · `si` 42 · `di` 18 · `sp` 1 |
| bruto de `0x270F` (=9999, el negativo de #238) | **0** |
| bruto de `0x1F40` (=8000, offset de vídeo EGA, leído en #246 §3) | **5** |
| bruto de `0xAD14` / `0xAB02` / `0xBA14` (ventana del ledger) | 2 / 1 / 24 |

### 0.2 Asimetría de corpus, DECLARADA: uso los 28, con `.DRV`

Los `.asm` de `re/disasm` son **28**; `binfiles.FILES` lista 24 de código y **no incluye los
cuatro `.DRV`**. Uso los 28, por la misma razón que #246 §0.1: **para medir la POBLACIÓN DE
UNA FORMA el corpus es todo el código**, mientras que para un censo de globales del KERNEL
excluir los `.DRV` es lo correcto (tienen su propio segmento de datos). En este canal la
elección no es cosmética: `EGA.DRV` aporta **3 de los 5** sitios del negativo `0x1F40`, así
que con 24 ficheros el control se quedaría casi sin material. ⚠ Las cifras `c1`/`c4` del
careo de §4 vienen de instrumentos que barren **24**; no son comparables byte a byte con
`c7`, y va dicho ahí también.

---

## 1. PRE-REGISTRO — escrito ANTES de particionar

Escrito con lo de §0.1 ya medido (la forma del bruto es de donde salen los buckets) y con
**nada** de lo que se predice abajo medido.

### 1.1 Los buckets que voy a declarar

En orden de aplicación, el primero que casa gana:

1. `MAGNITUD_FUERA_DS` — el inmediato cae fuera de `[0x1000, 0xF000]`. Umbrales
   **heredados** de `globals_negdisp`, no re-elegidos aquí. Es la basura que la tarjeta
   anuncia: `add sp, 4`, `add si, 0x50`, `add ax, 8` — aritmética normal.
2. `AJUSTE_DE_PILA` — el registro destino es `sp`. `sp` **nunca** es un puntero a dato; es
   la misma exclusión que #247 hace en el quinto canal (`mov sp, imm` fija la pila).
3. `SELECTOR_DE_SEGMENTO` — el valor acaba en `ds`/`es`/`ss`. Clase **heredada** de #244
   §5.3 (`HER.DRV` 0xB000 ×19), no inventada aquí.
4. `EN_VENTANA_SIN_FICHA` — inmediato en ventana DS pero **ninguna entrada del ledger lo
   contiene**. ★ **Éste es EL FILTRO, y va como bucket propio a propósito**: la tarjeta
   avisa de que `add reg, N` es aritmética normal y de que el cruce contra el ledger es lo
   que separa, así que el filtro se declara y se cuenta, no se esconde dentro de otro
   bucket. **No es «basura probada»**: aquí caben tanto globales sin fichar como una clase
   sin nombre. Es el gemelo del cabo 3 de #246.
5. `CANDIDATO` — inmediato en ventana DS **y** dentro de la extensión de una global del
   ledger. El único bucket que puede contener el mecanismo de la tarjeta.

Los buckets PARTICIONAN: suman al bruto, con `assert` dentro.

⚠ **La partición de #242 (PTR `bx/si/di/bp` vs NO-PTR `ax/cx/dx`) NO se hereda, y es una
decisión, no un olvido.** En el quinto canal `ax` es la clase floja porque `mov ax, DIR` no
desreferencia. En ESTA forma el idioma es *calcular el índice en el acumulador y sumarle la
base*, así que `ax` es el registro **dominante** (181 de los 242 en ventana). Heredar aquel
eje tiraría la mayor parte del control positivo por una razón que no aplica. Lo que sí se
hereda es el filtro de segmento y la ventana DS.

### 1.2 Las predicciones, con su condición de fracaso

| # | predicción | fracasa si |
|---|---|---|
| **P1** | de los 242 en ventana DS, los que caen DENTRO de una global del ledger son MAYORÍA: **55–80 %** | fuera de esa banda |
| **P2** | `SELECTOR_DE_SEGMENTO` en esta forma es **0**: un selector se CARGA, no se construye sumando | > 2 |
| **P3** | el segundo negativo `0x1F40` (5 sitios en bruto) da **0 CANDIDATO**, y con dientes: su magnitud SÍ está dentro de la ventana DS, así que el umbral no lo excluye por construcción (el defecto que #246 §3.1 clavó con el `0x0100`) | ≥ 1 candidato |
| **P4** | **NINGUNA global del catálogo se ve SÓLO por el séptimo canal**, careada contra los **SEIS** anteriores. Es #246 §4 girado, y su lección: medir «invisible» contra un SUBCONJUNTO de canales fabrica el cero-en-falso | aparece ≥ 1 con c1..c6 todos a 0 y c7 > 0 |
| **P5** | nº de globales del catálogo con población por esta vía: **8–20** (el sexto canal dio 9) | fuera de esa banda |
| **P6** | los PUNTEROS A CAMPO (inmediato ≠ base) son minoría pero no anecdóticos: **10–35 %** de los CANDIDATO | fuera de esa banda |

★ **P4 y P3 son las que el lead pidió explícitamente.** P3 es un negativo con **bruto no
nulo**: rechazar 5 sitios reales tiene más dientes que un control que da 0 porque no había
nada que rechazar — que es justo lo que le pasa a `0x270F` en este canal (§3).

### 1.3 La reserva que va IMPRESA junto a cada cifra

Heredada de #242 §3, #246 §1.3 y la propia tarjeta: **sin seguimiento de flujo real esto
produce CANDIDATOS, no accesos.** El registro puede reasignarse entre la suma y el uso, y
la ventana de búsqueda es una aproximación DECLARADA. Y la regla de la familia, que ya va
por la séptima: **«canal X vacío» = «este defecto no aplica», jamás «censo completo»**. La
lista de canales es ella misma una cota superior, y la octava forma no se descubre
razonando — ésta salió de un error de instrumento, leyendo.

---

## 2. RESULTADO — la partición, y las predicciones adjudicadas

| bucket | n | % del bruto |
|---|---:|---:|
| `MAGNITUD_FUERA_DS` | **300** | 55,4 % |
| `AJUSTE_DE_PILA` | **1** | 0,2 % |
| `SELECTOR_DE_SEGMENTO` | **1** | 0,2 % |
| `EN_VENTANA_SIN_FICHA` (**el FILTRO**) | **75** | 13,8 % |
| `CANDIDATO` | **165** | 30,4 % |
| **SUMA** | **542** | = el bruto |

De los **242** en ventana DS: **165 CANDIDATO** (68,2 %) y **75 sin ficha**. De los 165,
**46 son PUNTERO A CAMPO** (27,9 %) y **118 tienen uso en la ventana de 12 instrucciones**:
49 traspaso a registro puntero · 41 paso como argumento (`push`) · 28 desreferencia directa
· **47 sin uso** en la ventana.

### 2.1 Las seis predicciones

| # | predicción | medido | |
|---|---|---|---|
| P1 | en-ledger de los 242: 55–80 % | **165/242 = 68,2 %** | ✓ |
| P2 | `SELECTOR_DE_SEGMENTO` = 0 (fracasa si > 2) | **1** | ✓ por la condición, ✗ en el punto |
| P3 | `0x1F40` da 0 CANDIDATO | **5 brutos → 0**, los 5 a `EN_VENTANA_SIN_FICHA` | ✓ |
| P4 | ninguna global se ve SÓLO por la 7ª forma | **0 de 15** | ✓ |
| P5 | globales con población por esta vía: 8–20 | **15** | ✓ |
| P6 | punteros a campo: 10–35 % de los CANDIDATO | **27,9 %** | ✓ |

★ **P2 acierta por su condición de fracaso y falla en el punto, y la diferencia importa**:
predije **0** y salió **1**. Ese 1 es `ULTIMA.EXE:0x81d4 add ax, 0x1b48`, y dos instrucciones después
`ULTIMA.EXE:0x81d7 mov ss, ax` — la construcción del segmento de **PILA**, en la banda de bootstrap
(`CS ≥ 0x81D0`, la de la tarjeta #95). Que sea exactamente uno es la mejor noticia posible
para el filtro: **dispara**, y un guarda que nunca dispara pasa todos los tests sin filtrar
nada (la lección de «un control NEGATIVO no valida un GUARDA»). Va clavado en un test.

⚠ Y el **`AJUSTE_DE_PILA`** también es exactamente uno: `ULTIMA.EXE:0x019d add sp, 0xbd3e`.
`sp` no es puntero a dato nunca; es la misma exclusión que #247 razona para `mov sp, imm`.

---

## 3. ★ LOS DOS NEGATIVOS: el que el encargo pedía está DEGENERADO en esta forma

El encargo pedía `0x270F` = 9999 (derivado como magnitud en #238) y «un segundo de otra
clase». Lo que sale hay que decirlo entero:

| negativo | clase | bruto | candidatos | ¿dientes? |
|---|---|---:|---:|---|
| `0x270F` | MAGNITUD (no es dirección en absoluto) | **0** | 0 | ❌ **NO** |
| `0x1F40` | DIRECCIÓN, pero de la ventana de **VÍDEO**, no de DS | **5** | **0** | ✅ **SÍ** |

★ **`0x270F` no discrimina en este canal, y no por un defecto del filtro: porque NADIE suma
9999 a un registro en los 28 ficheros.** Un control que da cero porque no había nada que
rechazar es el «control degenerado» de siempre — exactamente la trampa que #246 §3.1 clavó
con el `0x0100` (excluido *por construcción*, no por discriminar). Aquí la exclusión no es
tautológica sino **vacía**, que es una tercera variante y merece nombre propio: el negativo
no se cae del lado equivocado del umbral, es que no existe. Va clavado en un test para que
nadie lo apunte como victoria del filtro.

★ **El que sí tiene dientes es `0x1F40`** (= 8000, el offset del segundo plano de vídeo
EGA), y los tiene por tres razones que hacen falta las tres:
1. **bruto no nulo**: 5 sitios reales que rechazar — `EGA.DRV:0x07fa add si, 0x1f40`,
   `0x1b07` y `0x2a99` `add di, 0x1f40` (el idioma inconfundible de avance de plano), más
   `CAST2.OVL:0x0015` y `COMSUBS.OVL:0x06d6`;
2. **su magnitud cae DENTRO** de `[0x1000, 0xF000]`, así que el umbral de `MAGNITUD_FUERA_DS`
   **no** lo excluye por construcción;
3. **lo rechaza EL FILTRO** —el cruce contra el ledger— y no un umbral: los 5 caen en
   `EN_VENTANA_SIN_FICHA`.

Y el material del control **depende del corpus de 28**: 3 de los 5 sitios están en
`EGA.DRV`. Con los 24 de `binfiles` este negativo se quedaría con 2 sitios, camino de
degenerar como el otro. Es la justificación operativa de §0.2, no una preferencia.

---

## 4. ★★ EL CRUCE CONTRA EL LEDGER ENTERO, careado con los SEIS canales anteriores

**Quince globales del catálogo tienen población por esta forma: 165 sitios.**

| global | addr | c1 hex | c2 sím | c3 neg | c4 idx | c5 reg | c6 imm | **c7 add** | ven |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `g_party_records` | 0x55A8 | 65 | 3 | 0 | 134 | 42 | 26 | **61** | 6/7 |
| `g_equip_qty` | 0x57C0 | 5 | 0 | 0 | 16 | 0 | 1 | **5** | 4/7 |
| `g_scroll_qty` | 0x5820 | 0 | 0 | 0 | 6 | 0 | 0 | **1** | **2/7** |
| `g_potion_qty` | 0x5828 | 0 | 0 | 0 | 6 | 0 | 0 | **1** | **2/7** |
| `g_reagent_qty` | 0x5850 | 0 | 0 | 0 | 9 | 0 | 0 | **1** | **2/7** |
| `g_dng_map` | 0x595A | 0 | 0 | 0 | 43 | 1 | 0 | **7** | 3/7 |
| `g_char_anim_states` | 0x5C5A | 142 | 7 | 0 | 172 | 54 | 66 | **36** | 6/7 |
| `g_npc_sched` | 0x5D5E | 1 | 0 | 0 | 44 | 2 | 0 | **6** | 4/7 |
| `g_npc_rt` | 0x5F5E | 0 | 0 | 0 | 34 | 11 | 5 | **11** | 4/7 |
| `g_npc_pathbuf` | 0x615E | 1 | 0 | 0 | 6 | 10 | 1 | **5** | 5/7 |
| `g_npc_stuck` | 0x65C2 | 0 | 0 | 0 | 6 | 2 | 1 | **2** | 4/7 |
| `g_vis_buffer` | 0xAB02 | 11 | 0 | 27 | 0 | 4 | 0 | **1** | 4/7 |
| `g_cbt_room_record` | 0xAD14 | 24 | 0 | 27 | 0 | 18 | 12 | **2** | 5/7 |
| `g_text_scratch` | 0xB21E | 1 | 0 | 26 | 0 | 8 | 0 | **3** | 4/7 |
| `g_combat_actor_records` | 0xBA14 | 0 | 0 | 160 | 0 | 23 | 16 | **23** | 4/7 |

### 4.1 VEREDICTO: ninguna global se ve SÓLO por la séptima forma — y el careo va con los SEIS

**P4 acierta: 0 de 15.** Las quince están cubiertas por al menos un canal anterior. Lo que
esta forma aporta son **165 SITIOS que ningún censo previo contaba**, sobre globales ya
visibles — no un punto ciego nuevo al nivel de «esta global no la ve nadie».

⚠ **Y el careo va con SEIS canales por la lección de #246 §4, no por completismo.** Aquella
tabla nació con dos columnas (c1 y c4) y con eso `g_combat_actor_records` salía con 23
candidatos y cero por lo demás — o sea el titular *«★ una global visible sólo por la séptima
forma»*. **Es falso**: 0xBA14 tiene **160** accesos por desplazamiento negativo y es el
control positivo de libro de `globals_negdisp`. Con dos columnas yo habría publicado el
mismo cero-en-falso que #246 estuvo a punto de publicar, sobre **la misma global**. Va
cableado en `cobertura_por_canales()` y en un test.

### 4.2 ★ Lo que sí sale: TRES globales que sólo ven DOS canales de siete

`g_scroll_qty` (0x5820), `g_potion_qty` (0x5828) y `g_reagent_qty` (0x5850) sólo tienen
población por **c4 (indexado)** y **c7 (esta forma)**. Cero por hex desnudo, cero por
símbolo, cero por negativo, cero por los canales 5 y 6. Es una cobertura **fina**, y las
tres son globales de INVENTARIO que el port toca. No es un hallazgo de mecánica —es un
hallazgo de INSTRUMENTO— pero dice dónde un censo hecho con un solo canal se queda a cero:
antes de #240 (que abrió c4) las tres daban **0 por todas las vías conocidas**.

⚠ Y la reserva: **son candidatos, no accesos**, y «2 de 7» se mide contra la lista de siete
formas de hoy, que es ella misma una cota superior.

### 4.3 La asimetría de corpus NO afecta a esta tabla

Medido, no argumentado: **0 de los 165 CANDIDATO están en un `.DRV`**. Los `.DRV` sólo
aportan material al bucket `EN_VENTANA_SIN_FICHA` (y al control negativo). Así que la
diferencia 24-vs-28 ficheros mueve el bruto y el negativo, pero **no mueve ni una fila** del
cruce contra el ledger. Las columnas c1/c4 (24 ficheros) y c7 (28) siguen sin ser
comparables byte a byte; lo que la tabla decide es cero-vs-no-cero, y para eso vale.

---

## 5. ★★ EL MECANISMO, leído en tres ejemplares (no deducido)

**Por qué los cuatro canales de corchete son ciegos por CONSTRUCCIÓN, no por un defecto de
sus regex.** `ULTIMA.EXE:0x6e60`, entero:

```
6e6c: mov si, word ptr [bp + 6]     ; índice = argumento
6e6f: mov cl, 5
6e71: shl si, cl                    ; × 32  ← el PASO del registro de party
6e73: add si, 0x55c1                ; + base+25  ← LA SÉPTIMA FORMA
6e77: mov al, byte ptr [si]         ; LECTURA
6e7b: cmp word ptr [bp + 4], ax
6e80: mov byte ptr [si], 0xff       ; ESCRITURA
```

Acceso genuino de lectura **y** escritura al campo +25 del registro N. Y la ceguera está en
la última instrucción: **el corchete es `[si]`, DESNUDO, sin dirección dentro.** `_ABS_RE`
busca `[0xNNNN]`; `idx_refs` busca `[reg + 0xNNNN]`; aquí no hay ni una cosa ni la otra.
**La forma no esconde la dirección: la SACA del operando de memoria.** Ése es el mecanismo
de toda la familia, y explica por qué ninguno de los seis canales previos podía verla.

Los otros dos, con el mismo idioma y strides distintos:

- `CAST.OVL:0x01cb-0x01d6` — `shl si, 5` + `add si, 0x55b3` (+11) + `cmp byte ptr [si],
  0x50` / `mov byte ptr [si], 0x47`. Lectura y escritura del campo +11.
- `BLCKTHRN.OVL:0x01d4-0x01f3` — `shl ax, 3` + `add ax, 0x5c5d` (**&reg.Y**) y
  `add ax, 0x5c5c` (**&reg.X**), cada uno **aparcado en un local** (`[bp-0x18]`, `[bp-0x1a]`)
  para desreferenciar mucho después. ★ Esto explica los **47 candidatos sin uso en la
  ventana**: no es que no se usen, es que el puntero se guarda. Y es el mismo destino que
  usa el sexto canal — con la diferencia de que aquí lo que se aparca es un valor
  **calculado**, no un inmediato, así que c6 tampoco lo ve. **Las dos formas componen.**

### 5.1 Corroboración lateral: los strides confirman dos `size` del ledger

Los desplazamientos previos a la suma dan el paso del registro sin que haga falta suponerlo:
`shl 5` = **32** para `g_party_records` (512 / 32 = 16 registros) y `shl 3` = **8** para
`g_char_anim_states` (256 / 8 = **32 registros**, la misma cifra que #251 §2.1 derivó por
otra vía). Es **corroboración por un canal que no se usó para derivarlos**, no una
derivación nueva, y así queda dicho: **no toco el ledger**.

---

## 6. Los 75 de `EN_VENTANA_SIN_FICHA` — el filtro, mirado por dentro

El bucket que el filtro rechaza **no es basura probada**. Repartido:

| inmediato | n | dónde |
|---|---:|---|
| `0x9248` | 14 | los **cuatro** `.DRV` (3 c/u) + `ULTIMA.EXE` (2) |
| `0x6608` | 7 | `FONT.OVL` 2 · `OUTSUBS.OVL` 3 · `ULTIMA.EXE` 2 |
| `0x1F40` | 5 | el control negativo (vídeo EGA) |
| `0x2D23` | 4 | los cuatro `.DRV`, 1 c/u |
| `0x535E` | 4 | `ULTIMA.EXE` |
| `0x1F5E` / `0x1F18` | 3 / 3 | 3 overlays · `EGA.DRV` |
| ★ `0x2EA4` `0x2EA5` `0x2EB5` · `0x2ED4` `0x2ED5` `0x2EDF` · `0x2EF2` `0x2EF3` `0x2EFB` | 9 | **`DUNGEON.OVL`**, 1 c/u |
| resto | 26 | sueltos |

★ **El racimo de `DUNGEON.OVL` es el cabo bueno, y tiene forma de TRES TABLAS sin fichar.**
Leído (`0x17f3`, `0x1873`, `0x18d3`): tres bloques con la misma estructura —índice
desplazado (`shl 4`, `shl 1`, `shl 3` ⇒ strides **16**, **2** y **8**), la base sumada, el
puntero aparcado en un local, y un `mov al, byte ptr [si]` desreferenciando— cada uno con
**tres punteros a campo** (`0x2EA4`/`+1`/`+0x11`, `0x2ED4`/`+1`/`+0xB`, `0x2EF2`/`+1`/`+9`).

⚠ **RESERVA, y va por delante**: esto son **candidatos a global sin fichar**, no un alta. No
he comprobado que la banda `0x2Exx` sea DS del kernel y no una región de datos del propio
overlay, y esa comprobación es precisamente lo que separa un cabo de un veredicto. Va a §8
como tarjeta propuesta, no al ledger.

---

## 7. Lo que este carril NO ha hecho

- **No he leído los 165 candidatos**: he leído **tres** (§5). Los otros 162 son
  **candidatos**, no accesos. Sin seguimiento de flujo no pueden serlo.
- **No he tocado el ledger.** Los strides de §5.1 son corroboración, no derivación; y el
  racimo de `DUNGEON.OVL` (§6) es un cabo, no un alta.
- **No he cambiado ninguna cifra publicada** de #240, #242, #244, #245, #246, #247 ni #251.
  La única corrección es al **desglose por overlay** de #251 §3 y de la tarjeta (§0), que
  no es una cifra de censo de nadie.
- **No he cableado la forma a ningún censo.** Igual que #240/#245/#246: el módulo HABILITA.
  Que `idx_particion` siguiera sin cablear un mes es el precedente (#254), y va dicho.
- **No he tocado `game/src`, `main.ts`, `routine-census.json`.** Nada de e2e.

## 8. Cabos (candidatos a tarjeta)

1. ★ **Las tres tablas sin fichar de `DUNGEON.OVL`** (§6): 0x2EA4/0x2ED4/0x2EF2, con stride
   derivado y tres punteros a campo cada una. **Precondición: comprobar que 0x2Exx es DS del
   kernel** antes de proponer ningún alta.
2. **`0x9248` en los cuatro `.DRV` + `ULTIMA.EXE`** (14 sitios) y **`0x6608`** (7 en 3
   ficheros): las dos direcciones más pobladas sin ficha. La de los `.DRV` pide cuidado
   extra — cada driver tiene su propio DS, así que el mismo número en cuatro drivers puede
   no ser la misma cosa.
3. **Los 47 candidatos sin uso en la ventana** (§5): el ejemplar de `BLCKTHRN` demuestra que
   al menos algunos son punteros APARCADOS, no ruido. Misma pregunta abierta que dejaron
   #242 (60) y #246 (123) — y ahora hay una hipótesis con testigo.
4. **La COMPOSICIÓN de formas** (§5): la séptima construye el puntero y lo aparca donde la
   sexta aparca los suyos. Ningún canal ve la pareja. ¿Cuántos sitios más hay de la forma
   «valor calculado aparcado en local y desreferenciado lejos»? Es la pregunta que abriría
   la **octava** — y va dicho con la reserva de siempre: **la octava no se descubre
   razonando**, ésta salió de un error de instrumento.

## 9. Overlays nombrados aquí (sección FINAL a propósito)

`ULTIMA.EXE`, `CAST.OVL`, `CAST2.OVL`, `BLCKTHRN.OVL`, `CMDS.OVL`, `COMBAT.OVL`,
`COMSUBS.OVL`, `DUNGEON.OVL`, `DNGLOOK.OVL`, `ENDGAME.OVL`, `FONT.OVL`, `MAINOUT.OVL`,
`OUTSUBS.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `SHOPPES3.OVL`, `SJOG.OVL`, `TOWN.OVL`,
`ZSTATS.OVL`, `EGA.DRV`, `CGA.DRV`, `HER.DRV`, `T1K.DRV`.
