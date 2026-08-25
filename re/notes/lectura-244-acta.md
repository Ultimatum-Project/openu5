# ACTA #244 — lectura par a par de los 14 candidatos del QUINTO canal

> Rama `re/lectura-244`, worktree `.claude/worktrees/lectura-244`, base **main `7dc4f360`**.
> Sucesora de #242 (`re/notes/quinto-242-acta.md` + `quinto-242-relevo.md`).
> RETENIDA: aterriza el lead.

---

## 0. RE-DERIVACIÓN DE LAS PREMISAS (antes de leer nada)

El encargo lo exigía: reproducir el censo de #242 con el método del relevo **antes** de la
lectura, y declarar cualquier diferencia como hallazgo. **Reproducido exacto**, mismo corpus
(28 `.asm` leídos en Python, jamás `grep -r`), mismo patrón:

```python
MOVREG = re.compile(r'^mov\s+(ax|bx|cx|dx|si|di|bp)\s*,\s*(0x[0-9a-f]{3,5})$')
```

| medida | #242 | esta re-derivación |
|---|---|---|
| población bruta `mov reg, imm` (3-5 díg.) | 3.064 | **3.064** ✅ |
| `0xAB02` cargas · PTR | 5 · 4 | **5 · 4** ✅ |
| `0xAD14` cargas · PTR | 9 · 6 | **9 · 6** ✅ |
| `0x595A` (`g_dng_map`) | 2 | **2** ✅ |
| POSITIVO `0x5C5A` (pin #240) | 29 · 19 | **29 · 19** ✅ |
| NEGATIVO `0x270F` (=9999, #238) | 14 · **0 PTR** | **14 · 0** ✅ |
| NEGATIVO `0x0100` | 39 · 2 PTR | **39 · 2** ✅ |

Líneas de instrucción parseadas: 77.674.

### 0.1 Hallazgo lateral del instrumento (declarado, no explotado aquí)

El regex del relevo pide **3-5 dígitos** hex. Repetido sin esa restricción de ancho la
población bruta pasa de **3.064 a 4.733**: hay **1.669** `mov reg, imm` con inmediato de 1-2
dígitos que el canal no cuenta. Para los seis controles de arriba **no cambia nada** (lectura
literal y lectura numérica coinciden en los seis), porque todas sus direcciones tienen ≥3
dígitos. Queda declarado como cota del instrumento, no como corrección de cifra: una dirección
del ledger por debajo de `0x100` sería invisible a este canal.

---

## 1. ★ PREDICCIÓN PRE-REGISTRADA (escrita ANTES de abrir un solo contexto)

Escrita con el censo ya reproducido (sé el registro de cada sitio) y con **cero** contexto ASM
leído. Se registran **ITEMS**, no sólo una cifra — una cifra sola cuadra por casualidad.

**Predicción global: 12 de 14 ACCESO-REAL.**

Desglose por items, cada uno falsable por separado:

1. **Los 10 sitios PTR** (`si`/`di`) salen **todos** ACCESO-REAL. En particular los 4 de
   `0xAB02` en `ULTIMA.EXE` (`0x59fb` di, `0x5d17` si, `0x5d64` si, `0x5f23` si).
2. De los **4 sitios NO-PTR** (`mov ax, DIR`: `ULTIMA.EXE:0x5d5d`, `ULTIMA.EXE:0x5f53`,
   `ULTIMA.EXE:0x60f8`, `DUNGEON.OVL:0x0070`), **≥2** resultan puntero-argumento
   (`push ax` / paso a rutina) ⇒ ACCESO-REAL; los otros ≤2 quedan AMBIGUO o COINCIDENCIA.
3. **Ninguno** de los 14 resulta basura de las dos clases conocidas de `idx_refs` (override
   `cs:` · base ajustada al origen del índice) — esas clases son de *otro* instrumento, pero
   si aparecieran aquí se declara con el ejemplar.

**CONDICIÓN DE FRACASO, escrita por delante:**
- La predicción **FRACASA** si salen **menos de 9** ACCESO-REAL de los 14.
- El item 1 **FRACASA** si **cualquiera** de los 10 PTR sale COINCIDENCIA.
- **AUTO-ABSOLUCIÓN** (predicción demasiado floja, a declarar como tal): si salen **14 de 14**
  ACCESO-REAL, la predicción no arriesgaba nada y hay que decirlo.

**Lo que la predicción NO decide de antemano**: si #68 y #219 cambian. Un ACCESO-REAL nuevo
puede caer *dentro* de la extensión ya publicada (y entonces no cambia nada) o *fuera* (y
entonces sí). Eso sale de la lectura, no de aquí.

---

## 2. VEREDICTO DE LA PREDICCIÓN: **14 de 14 ACCESO-REAL ⇒ AUTO-ABSOLUCIÓN**

Predije 12 y salen **14**. Eso dispara exactamente la cláusula que dejé escrita: **la
predicción no arriesgaba nada y hay que decirlo.** Los items 1 y 2 aciertan (los 10 PTR
salen todos, y los 4 NO-PTR salen los 4 como puntero-argumento, no ≥2), pero el acierto
no acredita al predictor: con `mov reg, DIR` sobre una dirección de búfer del ledger,
el espacio de resultados era casi degenerado. **La cifra útil de esta tarjeta no es
14/14; es la tasa de basura MEDIDA cuando el instrumento se ensancha** (§5), donde el
mismo canal da 19 de 19 falsos.

El item 3 acierta también: ninguno de los 14 es basura. Pero al ensanchar el canal a
bytes interiores aparece una **clase de basura nueva y nombrada** (§5.3), que es lo que
el encargo pedía declarar con su ejemplar.

---

## 3. LOS 14 SITIOS, uno a uno

Criterio aplicado: **ACCESO-REAL** = el registro (o el valor empujado) se desreferencia
—lectura, escritura, recorrido— o llega a un callee que lo desreferencia, con la cita del
uso. **COINCIDENCIA** = el inmediato es otra cosa (magnitud, selector, constante).
**AMBIGUO** = declarado, no adivinado.

### 3.1 `0xAB02` (`g_vis_buffer`, #68) — 5 sitios, **5 ACCESO-REAL**

| # | sitio | uso citado | veredicto |
|---|---|---|---|
| 1 | `ULTIMA.EXE:0x59fb` `mov di, 0xab02` | DESTINO de `repne movsw` + `repne movsb` con `cx = 0x160` (`0x5a05`-`0x5a0b`); origen `si = 0xad14` | **ACCESO-REAL** (escritura de 352 B) |
| 2 | `ULTIMA.EXE:0x5d17` `mov si, 0xab02` | base del bucle de siembra: `mov di, si` / `repne stosb` con `al = 0xff` (`0x5d21`-`0x5d2a`), `add si, 0x20` (`0x5d2d`), 11 vueltas (`0x5d30`) | **ACCESO-REAL** (escritura, 121 celdas) |
| 3 | `ULTIMA.EXE:0x5d5d` `mov ax, 0xab02` | `push ax` (`0x5d60`) → `call 0x5a28` (`0x5d61`); en el callee ese argumento es `[bp + 4]` y se suma al índice en `0x5b5c`, antes de desreferenciar `si` | **ACCESO-REAL** (puntero-argumento) |
| 4 | `ULTIMA.EXE:0x5d64` `mov si, 0xab02` | `cmp byte ptr [si], 0` (`0x5d7c`), `dec byte ptr [si]` (`0x5d81`), `inc si` (`0x5d83`) | **ACCESO-REAL** (lectura y escritura) |
| 5 | `ULTIMA.EXE:0x5f23` `mov si, 0xab02` | re-siembra por emisor: `mov di, si` / `repne stosb` `0xff` (`0x5f2d`-`0x5f36`) | **ACCESO-REAL** (escritura) |

★ El sitio 3 es el que **desmonta por sí solo la duda que el relevo dejó abierta**: la
partición PTR/NO-PTR declaraba no juzgar los `mov ax, DIR`, y éste resulta ser un puntero
pasado como argumento y desreferenciado. La cautela del relevo era correcta y aquí se
cobra.

### 3.2 `0xAD14` (#219) — 9 sitios, **9 ACCESO-REAL**

| # | sitio | uso citado | veredicto |
|---|---|---|---|
| 6 | `ULTIMA.EXE:0x59fe` `mov si, 0xad14` | ORIGEN de la misma copia de 352 B del sitio 1 | **ACCESO-REAL** (lectura) |
| 7 | `ULTIMA.EXE:0x5e61` `mov di, 0xad14` | `repne stosb` `al = 0xff` con `cx = 0x400` (`0x5e5e`-`0x5e6b`) | **ACCESO-REAL** (escritura de 1024 B) |
| 8 | `ULTIMA.EXE:0x5f53` `mov ax, 0xad14` | `push ax` (`0x5f56`) → `call 0x5a28` (`0x5f57`); mismo `[bp + 4]` que el sitio 3 | **ACCESO-REAL** (puntero-argumento) |
| 9 | `ULTIMA.EXE:0x5f65` `mov si, 0xad14` | post-pase de 1024: `cmp byte ptr [si], 0xff` (`0x5f70`), `inc byte ptr [si]` (`0x5f75`), `inc si` (`0x5f77`) | **ACCESO-REAL** (lectura y escritura, 1024 B) |
| 10 | `ULTIMA.EXE:0x60f8` `mov ax, 0xad14` | `push ax` (`0x60fb`) → `call 0x256e` (`0x6104`), que reenvía a `0x7234`, donde `mov dx, word ptr [bp + 8]` (`0x726f`) + `mov ah, 0x3f` + `int 0x21` (`0x7274`) ⇒ **es el búfer destino de una lectura de fichero de DOS**. Y el propio llamador consume el resultado: `mov si, 0xad7f` (`0x6112`), `0xad85` (`0x611f`), `0xaddf` (`0x6133`), `0xadff` (`0x613e`) | **ACCESO-REAL** (doble prueba: callee + consumidor) |
| 11 | `DNGLOOK.OVL:0x06dd` `mov di, 0xad14` | `repne stosb` `al = 0xff` con `cx = 0x2e0` (`0x06da`-`0x06e7`) | **ACCESO-REAL** (escritura de **736 B**) |
| 12 | `DNGLOOK.OVL:0x0d4b` `mov si, 0xad14` | `mov di, si` / `repne stosb` `cx = 0xb` (`0x0d4e`-`0x0d5b`), `add si, 0x20` (`0x0d5e`), cierre por `cmp si, 0xae74` (`0x0d61`) ⇒ 11 filas × 11 B con paso 32 = **352 B exactos** | **ACCESO-REAL** (escritura) |
| 13 | `DUNGEON.OVL:0x0061` `mov di, 0xad14` | `repne stosb` `al = 0` con `cx = 0x160` (`0x005e`-`0x006a`) | **ACCESO-REAL** (escritura de 352 B) |
| 14 | `DUNGEON.OVL:0x0070` `mov ax, 0xad14` | `push ax` (`0x0073`) dentro de la MISMA tupla de cuatro argumentos que el sitio 10 (nombre, búfer, `0x160`, desplazamiento del registro calculado en `0x004b`-`0x005b`) | **ACCESO-REAL**, con la reserva del párrafo siguiente |

⚠ **Reserva declarada del sitio 14**: la etiqueta del callee sale sin resolver en el
disasm (`call 0xffffa39e`, salto fuera del overlay), así que la desreferencia **no** la he
leído en su cuerpo: la derivo por identidad de tupla con el gemelo del sitio 10, que sí
está leído hasta el `int 0x21`. Es derivación por forma, no lectura del callee, y así
queda dicho.

★ **Hallazgo lateral, familia #80**: `0x7234` **no se puede leer directamente en el
disasm** — el desensamblado se desalinea un byte antes (`0x7233 add byte ptr [di - 0x75], dl`
se come el `0x00` de relleno y luego `0x7236 in al, dx` es el `EC` de `mov bp, sp`). Es un
**prólogo oculto por pad-byte**, la misma familia de los 35 de #80. Lo cito realineado
porque el cuerpo a partir de `0x7240` es inequívoco (`int 0x21` con `ah = 0x3d` abrir,
`0x42` posicionar, `0x3f` leer) y porque los desplazamientos `[bp + N]` no dependen de la
alineación del prólogo. Quien re-lea `0x7234` con el disasm actual verá basura y no debe
concluir que la rutina no existe.

★ **No he podido nombrar el fichero.** Los argumentos `0xa3f0` (sitio 10) y `0x2c6a`
(sitio 14) son punteros a cadena y el segmento de datos no está en `ULTIMA.EXE` (busqué
`.CBT`, `.DAT` y `BRIT` en los 36.592 B del ejecutable: **cero ocurrencias en los tres**).
No afecta al veredicto — la desreferencia ya está probada por `int 0x21` — pero el nombre
del fichero queda **sin derivar** y no debe darse por «el `.CBT`» sin medirlo.

---

## 4. ★ CAREO CON #68 Y #219

### 4.1 #68 (`g_vis_buffer` @`0xAB02`, extensión real 352 B, paso 32) — **AGUANTA, sin cambiar una cifra**

Los cinco sitios caen **dentro** de la extensión publicada y con **su misma geometría**:

- el copiador del sitio 1 mueve EXACTAMENTE `0x160` = **352** = la extensión fichada;
- los tres bucles de los sitios 2, 4 y 5 recorren 11 filas × 11 B con `add si, 0x20`
  = las **121 celdas útiles** dentro del **paso 32**, que es literalmente lo que la ficha
  del ledger ya dice;
- el sitio 3 entra al flood, cuyo índice de escritura sobre este búfer es
  `(a << 5) + b` (`0x5b66`-`0x5b89`) con **los dos** desplazamientos acotados a `[0, 0xa]`
  — verificado aquí instrucción a instrucción en `0x5b26`-`0x5b40`, no heredado — ⇒ el
  byte más alto alcanzable es `10*32 + 10 = 330 < 352`.

Y la medida del canal ensanchado (§5) devuelve, para `0xAB02`: **cero** cargas de bytes
interiores y **cero** del sexto canal. El búfer se direcciona **siempre desde su base**.
⇒ **Ninguna cifra de #68 cambia.** Lo que #242 dejó como «no desmentida pero tampoco
confirmada» pasa a **confirmada por lectura**.

### 4.2 #219 (`0xAD14`, dos dueños por fase, dos extensiones) — **AGUANTA en lo sustantivo, y su ENUMERACIÓN queda INCOMPLETA**

Lo que **aguanta**, re-verificado por mí y no aceptado como testimonio:

- el discriminador de fase: `cmp byte ptr [g_location], 0x80` / `jb 0x595e` en `0x5954`,
  con el `jmp 0x59f8` de `0x595b` — leído, coincide con el acta de #219 al byte;
- el puente 352 de `0xAD14` a `0xAB02` en la rama ≥`0x80` (sitios 1 y 6);
- la extensión direccionable de 1024 (sitios 7 y 9);
- el registro de 352 cargado desde fichero (sitios 10, 13, 14).

Lo que **cambia**, declarado con derivación como exige el encargo:

1. **Las extensiones medidas no son dos, son TRES.** Aparece **736** (`0x2e0`) en
   `DNGLOOK.OVL:0x06dd`, que ninguna de las dos cifras publicadas cubre. La **tesis** de
   #219 no se rompe —la contención sigue: 352 ⊂ 736 ⊂ 1024, y el argumento del acotado a
   `0x1f` en los dos ejes sigue explicando el 1024 como el techo direccionable—, pero su
   frase «las dos extensiones no se contradicen» describía una enumeración **corta**.
2. **Hay un escritor estructurado en un TERCER overlay que ni el acta ni la ficha
   nombran**: `DNGLOOK.OVL`, con dos rutinas (`0x06a8` y `0x0d3e`). La segunda escribe el
   búfer con **11 filas × 11 B a paso 32**, es decir **la geometría de #68**, cerrando por
   `cmp si, 0xae74`. La ficha del ledger de `g_cbt_room_record` atribuye la carga a
   `DUNGEON.OVL` y el segundo uso a `ULTIMA.EXE:0x5e4a`; `DNGLOOK` no aparece.
   **Qué es semánticamente ese uso NO lo he derivado** — es cabo, no veredicto.
3. **Los «9 de `0xAD14`» son una COTA, y ahora se sabe de cuánto**: son 9 cargas **de la
   base**. Hay **12 cargas más de BYTES INTERIORES** y **12 del sexto canal** (§5).

⇒ #219 **no queda desmentida**; queda **ampliada**, y su columna de extensiones y su lista
de dueños necesitan una entrada más cada una. No he editado `re/ledger/globals.json`: la
corrección de una tarjeta cerrada la decide el lead.

---

## 5. ★★ LO QUE APARECIÓ LEYENDO (y que ningún canal ve)

La regla de la familia dice que un canal nuevo no se descubre razonando, sino porque
aparece un caso que ninguno ve. Aparecieron dos, **mientras leía los 14**, no antes.

### 5.1 SEXTO CANAL: la dirección escrita como INMEDIATO A MEMORIA

`mov word ptr [<mem>], 0xNNNN` — la dirección va a un local de pila y **desde ahí** se
desreferencia. No es hex desnudo, ni símbolo+N, ni desplazamiento negativo, ni indexado,
ni `mov reg, imm`: **los cinco canales conocidos son ciegos a esto.**

Población bruta en el corpus: **476** (`294` con inmediato ≥ `0x100`).

| dirección | sexto canal | |
|---|---|---|
| POSITIVO `0x5C5A` (pin de #240), ventana 256 B | **66** | ✅ |
| `0xAD14`, ventana 352 B | **12** | |
| `0xAB02`, ventana 352 B | **0** | |
| NEGATIVO `0x270F` (=9999, el número de #238), ventana 352 B | **0** | ✅ discrimina |
| NEGATIVO `0x0100`, ventana 352 B | 17 | ❌ no discrimina (son MAGNITUDES: `0x140`, `0x200`, `0x1f4`) |

**Desreferencia probada, dos ejemplares leídos:**

- `COMBAT.OVL:0x113e`-`0x1152`, que mete cinco punteros interiores en locales
  (`0xad1f`, `0xae3f`, `0xae47`, `0xae5f`, `0xae67`) y los usa en `0x1175`-`0x1191`
  (`mov bx, word ptr [bp - 4]` / `cmp byte ptr [bx], 0xb`).
- `DNGLOOK.OVL:0x0d91`-`0x0d9b`, que mete `0xad5f`, `0xad9f`, `0xad3f` y escribe por ellos en
  `0x0dab`-`0x0dbc` (`mov bx, word ptr [bp - 0xc]` / `mov byte ptr [bx], al`).

⚠ El negativo `0x0100` **falla**: en ese rango bajo hay magnitudes de sobra. Un canal que
solo se calibra con un negativo cómodo se aprueba a sí mismo; éste pasa el negativo con
dientes (`0x270F`) y suspende el otro, y las dos cosas se publican juntas.

### 5.2 El censo POR DIRECCIÓN del quinto canal solo cuenta la BASE

El relevo de #242 describe la población general cruzada contra el ledger **incluidos los
bytes interiores**, pero las cifras por dirección (`0xAB02` 5, `0xAD14` 9) son cargas de la
**base**. Un `mov di, 0xad7f` es un acceso al mismo búfer y no entra:

| ventana | base | interiores | total |
|---|---|---|---|
| `0xAB02` + 352 | 5 | **0** | 5 |
| `0xAD14` + 352 | 9 | **12** | 21 |
| `0x5C5A` + 256 (positivo) | 29 | **35** | 64 |

### 5.3 ★ CLASE DE BASURA NUEVA, con su ejemplar: el inmediato que es un SELECTOR DE SEGMENTO

Al ensanchar la ventana de `0xAD14` de 352 a 1024, entran **19 candidatos más**, y
**19 de 19 son falsos**: todos son `0xb000` en `HER.DRV`, y el mecanismo se ve en la
instrucción siguiente — `HER.DRV:0x0665` `mov si, 0xb000` seguido de `0x0668` `mov ds, si`.
Es el **segmento de vídeo Hércules**, no un byte interior de ningún búfer de datos.

⇒ **clase nombrada: «inmediato cargado en registro y volcado a un registro de SEGMENTO»**.
Es hermana de las dos clases ya conocidas de `idx_refs` (#245: override `cs:` y base
ajustada al origen), y el detector es barato: mirar si el registro alimenta un
`mov ds/es/ss, reg`. Ninguno de los 14 sitios de esta tarjeta cae en esta clase.

★ **Y la lectura útil del número**: la ventana de 352 da 12 candidatos y los tres que
inspeccioné son reales; la de 1024 añade 19 y los 19 son basura. **La tasa de basura del
canal ensanchado depende enteramente de la extensión que se le declare**, que es
precisamente la cifra en disputa. Ensanchar la ventana para medir la extensión es
**circular**, y por eso §5.2 se publica con la ventana de 352 (la del ledger) y no con la
de 1024.

---

## 6. Lo que este carril NO ha hecho

- **No he tocado `re/ledger/globals.json`.** Las dos correcciones de §4.2 (tercera
  extensión, tercer overlay dueño) son revisión de tarjeta cerrada: se declaran y las
  decide el lead.
- **No he derivado qué es `0xAD14` para `DNGLOOK`** ni por qué su limpieza es de 736.
- **No he adjudicado los 12 interiores ni los 12 del sexto canal**: leí tres, los tres
  reales. Los nueve restantes de cada grupo son **candidatos**.
- **No he cerrado el nombre del fichero** de los sitios 10 y 14 (§3.2).
- **No he tocado `re/tools`, `game/src` ni `main.ts`.** Nada de e2e. Censo embargado (#84)
  intacto.

## 7. Cabos, con propuesta de tarjeta

1. **SEXTO CANAL** (§5.1): 476 brutos / 294 con inmediato ≥ `0x100`, sin cruzar contra el
   ledger entero ni particionar. Es la tarjeta gemela de #242 para el canal nuevo.
2. **Censo por dirección con bytes interiores** (§5.2): re-medir las direcciones ya
   publicadas del ledger sabiendo que su cifra es la de la base. Precondición: la clase de
   basura de §5.3 cableada como filtro declarado.
3. **`DNGLOOK` como tercer dueño de `0xAD14`** (§4.2 punto 2): derivar la semántica de
   `DNGLOOK.OVL:0x06a8` y `0x0d3e` y la cifra 736.
4. ~~**`0x7234` invisible por pad-byte** (§3.2): comprobar si está en la lista de los 35
   de #80.~~ **COMPROBADO Y CERRADO EN ESTE MISMO CARRIL — no es cabo.** Está en la tabla
   de `re/notes/prologos-ocultos-80.md` línea 568, con el byte de relleno en `0x7233` y el
   prólogo real en `0x7234`. ⇒ **corrobora** #80 con un caso encontrado por otra vía
   (leyendo un callee, no barriendo prólogos), y la lista de #80 **no** queda como cota
   por este ejemplar. Lo apunté como cabo antes de comprobarlo; lo comprobé y lo retiro.

★ **Error propio, con su re-medición**: el cabo 4 nació de suponer que la lista de #80
podía no tenerlo, en vez de mirarla. Coste: un `grep` en una nota del propio repo. La
lección es la de siempre en esta familia — **cruzar el repo antes de elevar un hueco a
cabo**, porque un cabo mal abierto cuesta una tarjeta a alguien.

## 8. Overlays nombrados aquí (sección FINAL a propósito)

`ULTIMA.EXE`, `DNGLOOK.OVL`, `DUNGEON.OVL`, `COMBAT.OVL`, `HER.DRV`.
