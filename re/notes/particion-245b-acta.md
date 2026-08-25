# Acta #245 — PARTICIÓN DE BASURA del canal `idx_refs`

Carril `re/particion-245b` (worktree `.claude/worktrees/particion-245b`), rama desde `main` @`7dc4f360`.
Encargo: tarjeta #245, abierta por el carril de #240 (`re/notes/idxrefs-240-acta.md` §7.3/§7.4).

---

## 0. PRE-REGISTRO — escrito ANTES de correr nada

Lo que sigue se escribió con el instrumento **sin construir**: sólo con el ledger leído
(`globals_map.entries()`), el acta de #240 y la lectura de `_IDX_RE`. Queda aquí para que la
comparación posterior no la escriba el resultado.

### 0.1 El MODELO que estoy apostando

**«La basura de `idx_refs` es de BORDE y de SEGMENTO, no de bulto.»** Es decir: dentro de la
ventana de una global concreta, las clases (a) y (b) muerden en los EXTREMOS —(a) porque una
tabla de saltos `cs:` cae donde cae, por coincidencia aritmética; (b) porque la base ajustada
vive por construcción a menos de un stride del INICIO DE LA SIGUIENTE, o sea pegada al techo de
la ventana— y el interior de la ventana es genuino.

### 0.2 Predicción para el **172** (0x5C5A, ventana 0x5C5A..0x5D59 del ledger — 256 B)

| magnitud | predicción |
|---|---|
| bruto reproducido | **172** (si no sale 172, mi barrido no es el de #240 y todo lo demás sobra) |
| (a) override de segmento | **0–2** |
| (b) base ajustada | **0–6**, y si aparecen estarán con desplazamiento ≥ 0x5D40 (techo) |
| **GENUINO** | **≥ 160** (caída ≤ 12, ≤ 7 %) |

**CONDICIÓN DE FRACASO, explícita:** el modelo queda **REFUTADO** si (i) GENUINO < 146 — o sea
una caída > 15 %, peor que el ~10 % de g_dng_map, que es el único borde medido hasta hoy — **o**
(ii) alguna clase que **no** sea (a) ni (b) aporta ≥ 5 hits DENTRO de esta ventana, **o**
(iii) los hits de (b) NO se concentran en el techo de la ventana. Cualquiera de las tres y el
172 deja de poder leerse como «cota apretada» y pasa a cota floja de verdad.

### 0.3 Predicción para el corpus ENTERO (la clase que #245 no nombra)

`_IDX_RE` es `\[(?:[a-z]{2}\s*\+\s*)+0x([0-9a-f]+)\]` y **no tiene cota inferior**: casa
`[bp + 0x6]` (local de pila) y `[bx + 0x4]` (campo de struct por puntero) igual que casa
`[si + 0x5c5c]`. Predigo por tanto una **TERCERA clase** de basura, no nombrada en la tarjeta:
desplazamientos por debajo de la ventana DS.

Predicción: los hits con desplazamiento < 0x100 son **la mayoría** de los hits del corpus.
**CONDICIÓN DE FRACASO:** si son < 20 % del bruto del corpus, mi lectura de la regex está mal.

⚠ Y la contrapartida que hay que decir en la misma frase: esta clase **no puede** tocar las tres
cifras publicadas, porque las tres se miden POR VENTANA y las tres ventanas están muy por encima
de 0x100. Predigo por eso **impacto 0** de esta clase sobre 172 / 48 / 7.

### 0.4 Predicciones de control

- **g_dng_map 0x595A (control de ACUERDO):** 48 bruto → 1 en (a) + 4 en (b) → **43** genuinos.
  Es el único de los tres que #240 leyó A MANO; si mi partición no reproduce el 43 exacto, el
  instrumento está mal y no vale para los otros dos. Fracaso = cualquier desviación.
- **g_moonstone_loc 0x5840 (ventana 8 B):** 7 bruto → **7** genuinos, 0 basura. #240 §7.2 los
  listó uno a uno como «los siete legítimos (DS, sin override)». Fracaso = cualquier desviación.

### 0.5 ⚠ Nombre citado que NO existe en el ledger (anotado ANTES de medir)

#230 y #240 llaman **`g_world_objects`** a la global 0x5C5A. **No hay ninguna entrada de
`globals.json` con ese nombre**, ni como `name` ni como `old_names` (0x5C5A no tiene alias). El
ledger la ficha como **`g_char_anim_states`, 256 B**. La VENTANA que usó #240 (0x5C5A..0x5D59)
es la del ledger y es correcta; lo que no casa es el NOMBRE. Lo dejo anotado aquí antes de medir
para que no se lea como hallazgo fabricado a posteriori; la adjudicación de a quién pertenece el
nombre no es de esta tarjeta.

---

## 1. RESULTADO frente al pre-registro

### 1.1 El 172 — modelo CONFIRMADO, y por el margen máximo

| | predicho (§0.2) | **medido** | |
|---|---|---:|---|
| bruto | 172 | **172** | ✓ |
| (a) override de segmento | 0–2 | **0** | ✓ |
| (b) base ajustada | 0–6 | **0** | ✓ |
| **GENUINO** | ≥ 160 | **172** | ✓ (caída CERO) |

Ninguna de las tres condiciones de fracaso se disparó. ⚠ Con una salvedad que hay que
decir: la cláusula «y si aparecen estarán en el techo de la ventana» **no se ha puesto a
prueba**, porque no apareció ninguno. Predicción no falsada ≠ predicción confirmada.

Lo que sí se ve, y explica el resultado mejor que mi modelo: los 172 accesos usan **ocho
desplazamientos distintos, 0x5C5A..0x5C61** — los ocho primeros bytes de una ventana de
256. Es un array de registros de paso 8 accedido siempre por su base más el campo. El
techo de la ventana (donde muerde la clase (b)) está a 250 bytes de distancia. El 172
nunca estuvo en peligro, y ahora se sabe **por qué**, no sólo que no.

### 1.2 Controles de acuerdo — los dos EXACTOS

`g_dng_map` 48 → **43** (1 de clase (a) + 4 de clase (b)), con **los cinco ejemplares
literales** que #240 §7.3 había leído a mano. `g_moonstone_loc` 7 → **7**. Cero desviación
en los dos.

### 1.3 ★ Predicción §0.3: el criterio DURO aguanta, la frase NO

Predije que los desplazamientos por debajo de la ventana DS serían «**la mayoría**» del
bruto, con condición de fracaso «si son < 20 %». Medido: **442 de 1.531 = 28,9 %**.

- El criterio falsable que escribí (< 20 %) **no se dispara** ⇒ formalmente, no fracasé.
- La frase con la que titulé la predicción («la mayoría») **es falsa**: son menos de un
  tercio.

Lo anoto como error propio y con su lección, porque es un defecto de método, no de
suerte: **puse un titular más fuerte que mi propio umbral**. Con un umbral en «> 50 %»
—que es lo que «la mayoría» quiere decir— la predicción habría salido ROJA. Un
pre-registro cuyo umbral es más flojo que su titular se puede autoabsolver siempre.

Sí acerté lo que importaba operativamente: la clase existe, es la **más grande** de todas
(442 frente a 21 + 7 + 12 de las otras tres juntas), y su **impacto sobre las tres cifras
publicadas es 0**, porque las tres se miden por ventana y las tres ventanas están muy por
encima de 0x100.

### 1.4 §0.5 confirmada: `g_world_objects` no existe en el ledger

0x5C5A está fichada como `g_char_anim_states` (256 B) y no tiene `old_names`. La ventana
de #240 es la correcta; el nombre citado, no. Anotado en `idxrefs-240-acta.md` §8.4 y sin
adjudicar (tocar el ledger no es de esta tarjeta).

---

## 2. LO QUE NO ESTABA PREVISTO — y es lo más importante que sale

### 2.1 ★★ La clase (b) también SUMA: un cero-en-falso nuevo, medido

#240 y la tarjeta #245 leen la clase (b) sólo como **resta** («esos 4 no son de
g_dng_map»). Es la mitad del hecho. Un acceso base-ajustado **pertenece a la global
SIGUIENTE**, así que hay que dárselo. Una partición que sólo restara cambiaría una
ceguera del 100 % por otra ceguera del 100 % en la dirección contraria — que es
exactamente el cero-en-falso que toda la línea #230 → #240 → #245 existe para matar.

Con el lado aditivo cableado (`Censo.atribuidos`) sale un caso vivo que nadie miraba:

```
g_npc_met_bitmap (0x5BDA):  0 accesos indexados POR VENTANA  ←  «nadie la toca»
                           +4 ATRIBUIDOS desde TALK.OVL:
     TALK.OVL:0x0d6c  or  word ptr [bx + 0x5bd6], ax
     TALK.OVL:0x0d70  or  word ptr [bx + 0x5bd8], dx
     TALK.OVL:0x0d9e  mov ax,  word ptr [bx + 0x5bd6]
     TALK.OVL:0x0da2  mov dx,  word ptr [bx + 0x5bd8]
```

`0x5BD6 = 0x5BDA − 4` con índice `g_location*4`: el **gemelo exacto** del ejemplar de
TOWN que trae la tarjeta, una global más allá. Y sus cuatro desplazamientos caen dentro de
`g_npc_dead_bitmap`, así que un censo de ESA global se los comería como propios.

### 2.2 Una clase de basura que la tarjeta no nombra: `FUERA_VENTANA_DS`

442 accesos (28,9 %). Ver §1.3. La tarjeta pedía «mirar si hay más al aplicarlo a otros
rangos»; ésta no aparece por rango, aparece por corpus.

### 2.3 Mis DOS errores de instrumento, cazados por los controles de acuerdo

Los dos habrían pasado inadvertidos sin las cifras de #240 como control, y los dos iban en
la dirección peligrosa (**sobre-filtrar**, o sea fabricar ceros con aspecto de medición):

1. **`[bx + si + 0x595a]` clasificado como base ajustada.** Con dos registros índice yo
   sumaba las cadenas de `shl` de LOS DOS (bx = planta<<6, si = (y<<3)+x) y salía un
   «stride» de 512, que es la ventana entera ⇒ el criterio `gap ≤ stride` se cumplía
   trivialmente y **16 accesos legítimos a g_dng_map** se iban a la basura (43 → 27).
   *Arreglo:* con dos registros índice no hay una sola cadena de `shl` que derivar, así
   que no se deriva ninguna; y **regla estructural**: un desplazamiento que ES la base
   declarada de una entrada del ledger es una BASE, no una base ajustada.
2. **Los 7 de `g_moonstone_loc` marcados AMBIGUOS.** El paseo hacia atrás no reconocía
   `mov bx, [bp+4]` como definición de `bx` (yo sólo miraba las mitades `bl`/`bh`), así
   que el paso nunca se derivaba y caía en la cota; y el detector de «cruza destino de
   salto» era tan grosero que marcaba casi todo (**casi todo bloque básico es destino de
   algún salto**). *Arreglo:* aceptar la definición del registro entero, y contar el cruce
   sólo cuando a un destino ENTRE la definición y el uso se llega desde FUERA del tramo —
   que es la condición real de que exista un camino sin pasar por la definición.

**La lección, que es la de la tarjeta aplicada a mí mismo:** el bucket de basura de mi
partición nació **demasiado ancho**, y un bucket de basura demasiado ancho no se nota —
produce cifras más bajas, que es justo lo que uno espera al «limpiar». Lo que lo delató no
fue leer el código: fue tener **43 y 7 leídos a mano por otro** contra los que chocar.

---

## 3. Entregables

### 3.1 Dónde vive la partición, y por qué ahí

- **`re/tools/disasm.py`** — sólo la parte LÉXICA: campo nuevo `Insn.idx_seg_refs`
  (subconjunto de `idx_refs` con override ajeno). Va aquí porque sale del mismo `op_str`
  que `idx_refs` y no necesita nada externo. **`idx_refs` no se filtra**: sigue siendo el
  bruto, byte a byte el de #240.
- **`re/tools/idx_particion.py`** (NUEVO) — la partición completa. Va aparte porque las
  clases (b) y `DATO_COMO_CODIGO` necesitan el **ledger** y `globals_negdisp`, y
  `disasm.py` es importado por medio repo: meterle un import del ledger arriba arriesga un
  ciclo (hoy `disasm` sólo lo importa perezosamente dentro de `_globals_map()`).
- **`re/tools/test_disasm.py`** — el trinquete, donde ya vivía el de #240.

### 3.2 Los cinco buckets, con cifras que SUMAN

`SEG_OVERRIDE` 21 · `FUERA_VENTANA_DS` 442 · `DATO_COMO_CODIGO` 7 · `BASE_AJUSTADA` 12
(8 RESUELTOS + 4 AMBIGUOS) · `GENUINO` 1.049 · **SUMA 1.531 = el bruto**. La suma es un
`assert` dentro de `buckets()` y de `censo()`, no una nota al pie.

### 3.3 Cómo se deriva la clase (b), y dónde se para

El stride **se mide en el código** (paseo hacia atrás hasta la definición del registro
índice, anotando los `shl`), no se lee del ledger ni se supone: el ledger no tiene strides.
En el ejemplar sale `bx = g_location*4` de dos `shl bx,1` sobre `[0x5893]`. Cuando el
paseo no alcanza la definición, o cuando cruza un destino alcanzable desde fuera del
tramo, **el paso queda sin derivar y el candidato se marca AMBIGUO** — nunca se resuelve a
ojo. Los 4 ambiguos del corpus están citados en el informe del CLI, no escondidos.

`COTA_STRIDE = 0x20` es el único umbral inventado aquí, y está declarado: 32 B es el paso
de fila más grande medido en el repo (`g_cbt_room_record` y `g_vis_buffer`). Se usa SÓLO
para marcar ambiguos, o sea en la dirección segura: sobre-marcar hace que alguien lea; el
error contrario firma un genuino falso.

### 3.4 Trinquete (7 tests nuevos, `test_disasm.py` 11/11)

`ULTIMA.EXE:0x5af8` no sale como DS · `TOWN.OVL 0x001f` no se atribuye a `g_dng_map` · el
GENUINO conocido `NPC.OVL 0x091c → 0x5c5c` sigue en el bucket genuino · los buckets suman
al bruto (corpus y por ventana) · la clase (b) SUMA a la global de destino · control de
acuerdo con las tres cifras de #240.

**Y verlos SUSPENDER**, que es lo que los hace guardas: re-cegar al segmento ⇒ 1 rojo ·
desactivar la clase (b) ⇒ 2 rojos · sobre-filtrar todo a basura ⇒ 2 rojos. Restaurado ⇒
11 verdes.

### 3.5 CONTROL DE NO-MOVIMIENTO del instrumento compartido

Con el `disasm.py` de `main` y el de esta rama **sobre el MISMO árbol**, restaurando
siempre:

| control | resultado |
|---|---|
| SHA-256 del volcado de las 62.701 instrucciones (addr+bytes+mnem+op_str+`abs_refs`+`call_targets`) | **IDÉNTICO** |
| SHA-256 del volcado de `idx_refs` | **IDÉNTICO** (el canal viejo tampoco se movió) |
| salida de `globals_map.py` | **IDÉNTICA** |
| salida de `cita_pegajosa_forma.py` | **IDÉNTICA** |
| salida de `cita_pegajosa_atribucion.py` (118 líneas) | **IDÉNTICA** |

Los consumidores corrieron con el módulo nuevo YA presente en el árbol, así que el control
cubre también que **su mera existencia no perturba nada**.

---

## 4. Qué necesita nota, y qué no

| tarjeta | ¿cambia? | por qué |
|---|---|---|
| **#63** (`g_moonstone_loc` 0x5840) | **NO** | 7 → 7 genuinos. Su «ceguera del 100 %» aguanta entera. |
| **#134** (`g_dng_map`) | **NO** | 43 reproducidos exactos; #240 ya la anotó con el 43. Lo que gana es que el 43 pasa de leído-a-mano a **mecánicamente re-ejecutable**. |
| **#228** (`g_unk_24e6`) | **NO** | re-medida: 0 accesos indexados, y con la partición sigue 0. La adjudicación negativa de #240 §6.3 aguanta. |
| **#230/#240** | **SÍ, ya hecho** | acta corregida en §8 (cifras nuevas al lado de las viejas) + el nombre `g_world_objects` marcado como inexistente en el ledger. |
| **#160** (cabo «alta g_npc_dead_bitmap») | **SÍ, aviso** | esa global tiene 0 genuinos por ventana y **4 atribuidos** desde TOWN; y su vecina `g_npc_met_bitmap` tiene 0 y **4 desde TALK**. Quien le dé de alta la ficha necesita §2.1. |

---

## 5. Cabos (propuestas de tarjeta, NO hechos aquí)

1. **★ El nombre 0x5C5A.** `globals.json` dice `g_char_anim_states` («animation states»);
   #230 lee ahí campos de NPC (+2 = X) y la llama `g_world_objects`. O el ledger va corto o
   el nombre de las actas es inventado. Con 172 accesos genuinos encima, merece
   adjudicación propia.
2. **`g_npc_met_bitmap` (0x5BDA) y `g_npc_dead_bitmap` (0x5B5A)** — sus poblaciones reales
   entran enteras por base ajustada 1-based (TALK ×4, TOWN ×4) y las dos dan CERO por
   ventana. Ninguna está leída.
3. **Los 4 AMBIGUOS de la clase (b)**: `CMDS.OVL:0x13bd`, y `OUTSUBS.OVL:0x0025`, los dos
   con desplazamiento 0x58D0 (a 8 B de `g_shrine_destroyed`); más `DNGLOOK.OVL:0x0e6d`, y
   `DNGLOOK.OVL:0x0e76`, con 0x24C6 y 0x24B6 (a 16 y 32 B de `g_facing_dx`). En los cuatro
   el instrumento dice «no lo sé», y hay que leerlos a mano.
4. **Cablear la partición a los consumidores.** Hoy `idx_particion` está **disponible, no
   cableado**: ningún censo lo usa todavía. Igual que en #240, el módulo habilita, no
   repara.

---

# TANDA 2 — #254: la partición CABLEADA (decisiones (a) y (b) del lead)

Rama `re/particion-245b` re-basada sobre `main` @`ac5a929b` (que es d0415ac5 **picado**:
SHA distinto, blobs idénticos — por eso `merge-base --is-ancestor` da NO, y por eso la
rama se resetea a main en vez de mezclarse). Encargo: mensaje del lead con las tres
decisiones de #254 tomadas.

## 6. Lo que pedía cada decisión, y qué se hizo

### 6.1 (a) Censos NUEVOS por `censo()`; consumidores EXISTENTES intactos

**No se toca ningún consumidor.** `idx_refs` sigue siendo el BRUTO, sin filtrar. Lo que
se añade es el **AVISO donde se consume** —el docstring del propio campo
`disasm.Insn.idx_refs`, no el del módulo ni el de la tarjeta— con las cuatro clases de
basura medidas, el 31,5 %, y las dos direcciones del error:

- el bruto SOBRA (basura dentro de la ventana), y
- el bruto FALTA (los accesos que llegan por base ajustada y el censo por ventana no ve).

La regla queda escrita **donde alguien la va a leer al usar el campo**, que era el punto
de la decisión: no donde se descubrió.

### 6.2 (b) El lado ADITIVO por defecto, con el bucket ATRIBUIDO etiquetado aparte

`censo()` ya devolvía `atribuidos`; lo que faltaba era que **la salida enseñara las dos
mitades y su procedencia**. Ahora:

- `Censo.resumen()` — una línea con `POBLACIÓN = genuinos + atribuidos` y el bruto
  marcado literalmente **COTA**. Existe para que la palabra «cota» viaje pegada al número
  cuando alguien copie una cifra de aquí a una nota.
- El detalle por ventana sale partido en **«mitad que RESTA»** (lo que el bruto traía y no
  es de esta global, con su bucket y su razón) y **«mitad que SUMA»** (los atribuidos),
  y cada atribuido lleva `procedencia(h)`: *en la ventana de qué global cae su
  desplazamiento*, o sea **a quién se le está quitando**. Un «+4 atribuidos» sin eso es un
  número que el lector tiene que creerse.
- El informe de corpus añade **ATRIBUIDOS por DESTINO**, que es la vista global del lado
  aditivo.

★ Y esa tabla deja ver algo que en la tanda 1 sólo se veía de una en una: **las DOS
globales que reciben atribuidos tienen CERO genuinos por ventana**. O sea que el 100 % de
la población indexada de `g_npc_dead_bitmap` y de `g_npc_met_bitmap` entra por base
ajustada. No son dos casos raros: es que en esa banda del ledger la forma NORMAL de
acceso es la 1-based.

### 6.3 (c) El dato de mi ficha estaba RANCIO — corregido

Mi tarjeta #254 preguntaba si `test_disasm.py` debía entrar en la tanda de gates
estándar. **Ya estaba dentro**: el lead lo decidió al aterrizar la tanda 1 de #240 y lo
corre en cada aterrizaje; mi propio pick pasó por él (los 150 passed incluyen mis tests).
Escribí la pregunta copiando el «⚠ NO está en la tanda de gates» de
`idxrefs-240-acta.md` §2 **sin comprobar si seguía siendo verdad** — que es exactamente
el género «prosa heredada que caducó» del canon. Queda confirmado y corregido aquí.

## 7. Trinquete: 11 → 14 tests, los 3 nuevos con su sensibilidad

| test | qué guarda |
|---|---|
| `test_idx_refs_SIGUE_SIN_FILTRAR_pese_a_la_particion` | decisión (a): que nadie «ayude» filtrando `idx_refs` en origen y mueva en silencio a los consumidores actuales |
| `test_censo_reporta_LAS_DOS_MITADES_y_marca_el_bruto_como_cota` | decisión (b): `poblacion` = genuinos + atribuidos, y el bruto marcado COTA. Se comprueba en los DOS sentidos: `g_dng_map` donde el bruto SOBRA (48→43) y `g_npc_met_bitmap` donde FALTA (0→4) |
| `test_procedencia_dice_a_QUIEN_se_le_quita_cada_atribuido` | que el lado aditivo sea auditable y no un número a creer |

**Sensibilidad, verificada una a una:** filtrar `idx_refs` en origen ⇒ **4 rojos** (entre
ellos el control de acuerdo) · quitar la palabra COTA del resumen ⇒ 1 rojo · vaciar
`procedencia` ⇒ 1 rojo. Restaurado ⇒ **14 verdes**.

## 8. ⚠ ERROR PROPIO de esta tanda: una edición se comió un `def`

Al insertar los tres tests usé como ancla la LÍNEA `def
test_control_de_ACUERDO_...():` y la sustituí por los tres tests nuevos — **sin volver a
poner la línea sustituida**. Resultado: el cuerpo del control de acuerdo quedó pegado
como cola del último test nuevo, su docstring convertido en una cadena suelta, y el test
**desapareció como test**.

**Y el pytest siguió VERDE**, porque las aserciones seguían ejecutándose dentro de otro
nombre. Lo que lo delató fue una cuenta: esperaba 11 + 3 = 14 y salieron **13**. Sin esa
resta, habría entregado el trinquete con su test más importante —el control de acuerdo
con las cifras de #240— disuelto dentro de otro, y cualquier informe posterior habría
dicho «14 tests» citando un fichero que tiene 13.

Re-medición tras el arreglo: **14 defs, 14 passed**, y
`pytest test_disasm.py::test_control_de_ACUERDO_con_las_cifras_leidas_a_mano_en_240`
recoge y pasa **por su nombre** — que es la comprobación que faltaba, porque «los tests
pasan» no distingue un test que existe de uno que se disolvió.

**La lección, que es nueva y no estaba en el canon:** una edición anclada en una línea
`def` puede BORRAR un test sin poner nada rojo, porque su cuerpo sigue corriendo bajo
otro nombre. ⇒ tras tocar un fichero de tests, **contar los `def test_`** y cotejar la
cifra con la esperada; y para un test que importa, invocarlo **por nombre completo** para
ver que existe como unidad, no sólo que la suite está verde.

## 9. Controles de esta tanda

- **NO-MOVIMIENTO** contra el `disasm.py` YA ATERRIZADO en main (ac5a929b), mismo árbol,
  restaurando: SHA-256 del volcado de las 62.701 instrucciones **IDÉNTICO**, SHA de
  `idx_refs` **IDÉNTICO**, y salida de `globals_map` / `cita_pegajosa_forma` /
  `cita_pegajosa_atribucion` (118 líneas) **IDÉNTICA** las tres. El AVISO es prosa: no
  podía mover nada, y queda probado que no lo movió.
- Los dos módulos se intercambiaron a la vez (disasm + idx_particion), así que el control
  cubre también que la API nueva no perturba por existir.

## 10. Lo que #254 NO hace

**Ningún consumidor existente migra en esta tanda** — es la decisión (a), no un descuido:
cada carril migra con su propia medición. Lo que cambia es que ahora hay (i) una entrada
por defecto documentada, (ii) el aviso pegado al campo que se consume, y (iii) trinquete
que impide el filtrado silencioso. Las cifras de `idx_refs` en crudo **siguen siendo
cotas** en todo el repo salvo en las ventanas que alguien re-mida con `censo()`.
