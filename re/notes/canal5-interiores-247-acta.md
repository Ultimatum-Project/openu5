# Acta #247 — el QUINTO canal por INTERIORES, con el filtro de segmento cableado

Carril `re/particion-245b`, re-basado sobre `main` @`a1efa128`. Tarjeta abierta por #244
(`re/notes/lectura-244-acta.md` §5.2 y §5.3). Encargo del lead: cablear el filtro de
segmento como partición declarada y re-medir las direcciones publicadas sabiendo que su
cifra es la de la BASE — con control positivo Y negativo, y **la ventana declarada ANTES
de mirar el resultado**.

---

## 0. CONTROL DE ACUERDO con #242 — 5 de 5 EXACTO, y con la desviación NOMBRADA

| celda | #242 | re-medido | |
|---|---:|---:|---|
| bruto del canal | 3.064 | **3.064** | ✓ |
| PTR en ledger | 193 | **193** | ✓ |
| PTR fuera | 486 | **486** | ✓ |
| NO-PTR en ledger | 144 | **144** | ✓ |
| NO-PTR fuera | 2.241 | **2.241** | ✓ |

La receta de #242, reconstruida por ajuste y luego verificada: **28 `.asm`** (con los
`.DRV`) · **inmediato ≥ 0x100** · registros `ax/bx/cx/dx/si/di/bp`, **sin `sp`**.

⚠ **La desviación, medida y explicada, no dejada como «casi»:** mi primer barrido incluía
`sp` y daba 3.071 / 2.248 — exactamente **7 de más**. Son los **siete `mov sp, imm`** del
corpus (`CAST 0x114a`, `COMBAT 0x0ace`, `EGA.DRV 0x0351`, `HER.DRV 0x0373`,
`ULTIMA.EXE 0x7613`, `0x78dc`, `0x81d9`). **#242 tenía razón al excluirlo**: `mov sp, imm`
fija el PUNTERO DE PILA, no es nunca un puntero a un dato. Lo dejo escrito porque un
«3.071 vs 3.064» sin explicar es una discrepancia viva, y con la explicación es un acuerdo.

★ Y de paso, un cabo que NO contamina nada: los **7 `mov bp, imm`** que #242 cuenta como
PTR están **todos en `.DRV`** y **ninguno cae en el ledger** (`0x3500`, `0xFD7D`, `0x140`),
así que el 193 no los incluye. `bp` con inmediato es montaje de marco, no puntero a dato;
la convención de #242 es inocua para su cifra publicada y no la toco.

---

## 1. PRE-REGISTRO — escrito ANTES de particionar y ANTES de medir interiores

### 1.1 ★★ LA VENTANA, DECLARADA AQUÍ Y AHORA (regla anti-circular)

Las tres ventanas de este censo son **las del ledger, y sólo ésas**:

| dirección | ventana DECLARADA | fuente |
|---|---|---|
| `0xAB02` `g_vis_buffer` | **352 B** | `globals.json` |
| `0xAD14` `g_cbt_room_record` | **352 B** | `globals.json` |
| `0x5C5A` `g_char_anim_states` | **256 B** | `globals.json` |

**La regla, que es el corazón de la tarjeta:** la tasa de basura de un canal ensanchado
depende ENTERAMENTE de la extensión que se le declare — y para `0xAD14` la extensión es
justo lo que está EN DISPUTA (352 del ledger vs 1024 del recolector de #219 vs 736 de
DNGLOOK de #248). **Ensanchar la ventana para medir la extensión es CIRCULAR.** Si una
extensión está en disputa, se **declara** y se dice de dónde sale; no se resuelve
ensanchando y mirando cuánta basura entra.

⇒ Todo número de población de §2 sale con la ventana del ledger. La de 1024 aparece **una
sola vez** y con un papel distinto y explícito: como **control de SENSIBILIDAD del filtro
de segmento** (§3), no como medición de extensión.

### 1.2 Predicciones, con condición de fracaso

| # | predicción | fracasa si |
|---|---|---|
| **P1** | el filtro de segmento captura **0** dentro de las tres ventanas del ledger — porque `0xB000` no cae en ninguna de las tres | captura > 0 |
| **P2** | base + interiores reproducen #244 §5.2 EXACTO: `0xAB02` 5+0 · `0xAD14` 9+12 · `0x5C5A` 29+35 | cualquier desviación |
| **P3** | con el filtro cableado, ninguna de las tres ventanas pierde candidatos (corolario de P1) | pierde alguno |
| **P4** | ★ el filtro **SÍ dispara** al ensanchar `0xAD14` a 1024: **19**, todos `0xB000` de `HER.DRV` | dispara 0, o ≠ 19 |
| **P5** | al aplicar base+interiores al ledger ENTERO, los interiores se concentran en tablas y búferes grandes, y hay al menos una global con **más interiores que bases** | ninguna con más interiores que bases |

**P4 es el control que impide que el filtro sea un guarda degenerado.** Un filtro que
nunca dispara pasa todos los tests y no filtra nada: hay que verlo capturar. Y se le hace
disparar en el único sitio donde #244 lo midió, con la ventana marcada como
control-de-sensibilidad y NO como extensión.

---

## 2. RESULTADO

### 2.1 La partición del canal (buckets que SUMAN)

| bucket | n |
|---|---:|
| `SELECTOR_DE_SEGMENTO` | **95** |
| `NO_PTR` | **2.313** |
| `PTR` | **656** |
| **SUMA** | **3.064** = el bruto |

### 2.2 ★ Los tres censos, con la ventana DEL LEDGER: BASE + INTERIORES

| global | ventana | base | **INTERIORES** | total |
|---|---:|---:|---:|---:|
| `g_vis_buffer` 0xAB02 | 352 B | 4 | **0** | 4 |
| `g_cbt_room_record` 0xAD14 | 352 B | 6 | **12** | 18 |
| `g_char_anim_states` 0x5C5A | 256 B | 19 | **35** | 54 |

### 2.3 ⚠ P2 FALLA, y NO es una corrección de #242: es que medí OTRA población

Predije reproducir «5+0 · 9+12 · 29+35». Los **INTERIORES salen exactos** (0 · 12 · 35 ✓✓✓)
y las **BASES salen más bajas** (4 · 6 · 19 frente a 5 · 9 · 29). No hay discrepancia: mis
bases cuentan **sólo el bucket PTR**, y las de #242 cuentan **todos los registros**. Cuadra
al byte:

| | #242 (todos) | PTR | NO_PTR | |
|---|---:|---:|---:|---|
| 0xAB02 | 5 | 4 | 1 | 4+1 = 5 ✓ |
| 0xAD14 | 9 | 6 | 3 | 6+3 = 9 ✓ |
| 0x5C5A | 29 | 19 | 10 | 19+10 = 29 ✓ |

⇒ **las cifras de #242 quedan CONFIRMADAS, no corregidas.** Lo que aporta esta tanda es
partirlas: de las 29 cargas de la base del pin, 19 pueden desreferenciar ahí mismo y 10 no
(se pasan o se copian, la pregunta que #242 dejó abierta con sus 144 NO-PTR).

★ **Y el error de método, que es el MISMO que cometí en #246 y van dos seguidos:** predije
sobre una población y medí otra. En #246 fue el denominador; aquí es el numerador. La regla
que me falta aplicar antes de escribir una predicción: **nombrar exactamente el conjunto que
voy a contar**, con su filtro, no la magnitud «de memoria».

### 2.4 ★★ El cruce contra el ledger ENTERO: once globales con MÁS interiores que bases

| global | addr | base | interiores |
|---|---|---:|---:|
| `g_party_records` | 0x55A8 | 3 | **39** |
| `g_char_anim_states` | 0x5C5A | 19 | **35** |
| `g_combat_actor_records` | 0xBA14 | 3 | **20** |
| `g_cbt_room_record` | 0xAD14 | 6 | **12** |
| `g_npc_rt` | 0x5F5E | 0 | **11** |
| `g_npc_pathbuf` | 0x615E | 0 | **10** |
| `g_equip_name_ptrs` | 0x17F6 | 0 | **6** |
| `g_spell_qty` | 0x57F0 | 0 | **4** |
| `g_gem_tile_category` | 0x1D1A | 0 | **3** |
| `g_npc_sched` | 0x5D5E | 0 | **2** |
| `g_npc_stuck` | 0x65C2 | 0 | **2** |

**P5 confirmada, y por goleada.** Y la celda que hay que leer dos veces: **SIETE globales
tienen CERO cargas de la base y sólo interiores** — `g_npc_rt`, `g_npc_pathbuf`,
`g_equip_name_ptrs`, `g_spell_qty`, `g_gem_tile_category`, `g_npc_sched` y `g_npc_stuck`.
Un censo del quinto canal hecho POR LA BASE, como el de #242, devuelve
**cero** para las siete y sostiene «este canal no las toca». Es el mismo cero-en-falso de
#240 y #252, ahora en el quinto canal y por una razón nueva: **el código nunca carga la
base, sólo interiores.**

⚠ Reserva, en la misma frase: son **candidatos**. `g_party_records` con 39 interiores es
una cifra para ir a leer, no un censo de accesos.

## 3. ★ El filtro de segmento: DISPARA, y su límite está medido

El control de sensibilidad (ventana de 1024, **usada sólo aquí y sólo para esto**) confirma
lo que #244 §5.3 leyó a mano: **los 19 candidatos que entran al ensanchar son todos
`0xB000` de `HER.DRV`**, y todos acaban en `ds`/`es`.

**Mi filtro mecánico caza 18 de los 19.** El que se escapa es
`HER.DRV:0x0b8d mov di, 0xb000`: su `mov es, di` está **14 instrucciones después**, al otro
lado de un `call 0x47e` con `push di`/`pop di` preservando el valor. Con la ventana
declarada de #242 (**10**) no llega.

**NO he tocado la ventana para llegar a 19.** Sería ajustar el umbral al resultado — el
vicio exacto que este carril lleva tres tandas evitando. En su lugar, la **sensibilidad al
umbral, medida**:

| ventana | `0xB000` cazadas | `SEG` corpus | los tres censos |
|---:|---|---:|---|
| 8 | 18/19 | 93 | 4+0 · 6+12 · 19+35 |
| **10 (la declarada)** | **18/19** | **95** | **4+0 · 6+12 · 19+35** |
| 12 | 18/19 | 96 | 4+0 · 6+12 · 19+35 |
| 14 | 19/19 | 100 | 4+0 · 6+12 · 19+35 |
| 20 | 19/19 | 114 | 4+0 · 6+12 · 19+35 |

★★ **Y ésta es la lectura que importa: los tres censos son INVARIANTES al umbral.** De 8 a
20, base e interiores no se mueven ni una unidad. O sea que la elección de ventana —el único
umbral discutible del instrumento— **no toca la respuesta a la pregunta de #247**. Lo que sí
mueve es el conteo global de `SEG` (93→114), que es una cifra de clase, no de censo.

⇒ La CLASE es 19/19 (leída a mano por #244 y confirmada aquí); el **filtro mecánico llega a
18/19 con el umbral heredado**, y el hueco está nombrado con su causa. Las dos cosas juntas,
sin redondear ninguna.

### 3.1 DOS FUERZAS de evidencia en el filtro, y por qué existen

La primera versión cortaba el paseo al ver una reasignación del registro y cazaba **13**.
Las 6 que escapaban son el mismo idioma con una rama en medio:

```
0x0918  mov ax, 0xb000              ← el inmediato
0x091b  mov si, word ptr cs:[0x306]
0x0920  cmp word ptr [si + 0x1e], 0
0x0924  je 0x92a
0x0926  mov ax, word ptr cs:[0x2ca] ← reasigna ax SÓLO en la otra rama
0x092a  mov ds, ax                  ← los DOS caminos acaban aquí
```

«Por defecto `0xB000`, o el alternativo, y en cualquier caso a `ds`». Cortar
infra-filtraba; no cortar puede sobre-filtrar. ⇒ se cuentan las dos y la **fuerza queda
visible**: `DIRECTO` (sin reasignación) y `TRAS_REASIGNACION` (más débil, el lector puede
querer mirarlas).

## 4. Adjudicación de las predicciones

| # | predicción | medido | |
|---|---|---|---|
| P1 | el filtro captura 0 en las tres ventanas del ledger | **0** (los descartes son NO_PTR) | ✓ |
| P2 | base+interiores = 5+0 · 9+12 · 29+35 | interiores ✓✓✓; bases 4/6/19 = **otra población** | ✗ |
| P3 | ninguna ventana pierde candidatos por el filtro | ninguna | ✓ |
| P4 | el filtro dispara 19 en la ventana de 1024 | **18/19**, y el 19º necesita ventana 14 | ✗ parcial |
| P5 | hay ≥1 global con más interiores que bases | **once**, y siete con base CERO | ✓ |

## 5. Lo que NO he hecho

- **No he leído los candidatos.** Son candidatos; #244 leyó tres de 0xAD14 y los tres eran
  reales, y ahí sigue la cuenta.
- **No he tocado `globals.json`.** La extensión de `0xAD14` sigue en disputa (352 / 736 /
  1024) y esta tanda **no la resuelve a propósito**: resolverla ensanchando la ventana es la
  circularidad que la tarjeta viene a cerrar.
- **No he cambiado el umbral** `VENTANA_USO` heredado de #242, ni ninguna cifra publicada.
- **No he cableado el canal a ningún censo.** Igual que #240, #245 y #246: HABILITA.

## 6. Cabos

1. **Las siete globales con base CERO y sólo interiores** — `g_npc_rt`, `g_npc_pathbuf`,
   `g_equip_name_ptrs`, `g_spell_qty`, `g_gem_tile_category`, `g_npc_sched`, `g_npc_stuck`.
   Un censo por la base las da a cero. Sin leer.
2. **`g_party_records` (0x55A8) con 39 interiores y 3 bases** — la población mayor del
   canal, y nadie la ha mirado.
3. **Los 144 NO-PTR en ledger de #242**, ahora partidos por dirección: la pregunta «¿se pasa
   como argumento?» sigue abierta, y aquí se ve dónde pesa (10 de las 29 del pin).
4. **El 19º `0xB000`**: necesitaría ventana 14 o seguimiento de `push`/`pop`. Nombrado, no
   arreglado.
