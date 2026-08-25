# Adjudicación 0x5A28 — flood de visibilidad: ¿Moore (8 vecinos) o cardinal? (task #23)

**VEREDICTO: MOORE.** El flood recorre el ANILLO DE 8 VECINOS del padre (4 cardinales
+ 4 diagonales), sobre un acumulador de coordenadas que **no se resetea** entre las 8
direcciones. Confirmado por (A) tercera lectura independiente del disasm crudo y (B)
**witness runtime en DOSBox** que observó la traversal real del binario. La lectura
`read-sweep-5` (Moore) es CORRECTA; el addendum del reviewer E1-S2 ("estrictamente
cardinal, 4 entradas") es INCORRECTO.

Fecha: 2026-07-14. Adjudicador: tercera lectura + oráculo. dosbox limpio al salir.

---

## A. Tercera lectura independiente (disasm crudo `ULTIMA.EXE.asm` 5a28–5d06)

Leída ANTES de mirar las dos conclusiones en conflicto. Tres hechos deciden todo:

### A.1 — El contador de dirección arranca en 7 y baja a 0 = 8 iteraciones
```
5a3c: mov word ptr [bp-0x216], 7      ; dir = 7
...
5cdb: dec word ptr [bp-0x216]         ; dir--
5ce5: cmp word ptr [bp-0x216], -1
5cea: jle 0x5cef                      ; sale cuando dir < 0
5cec: jmp 0x5aec                      ; si no, otra dirección
```
El bucle interno corre para dir = 7,6,5,4,3,2,1,0 → **8 pasos por celda**, no 4.

### A.2 — El bound del dispatch es 7 (⇒ 8 entradas), no 3
```
5aec: mov ax, [bp-0x216]
5af0: cmp ax, 7                       ; <-- BOUND = 7
5af3: ja 0x5b26                       ; índice > 7 => nada
5af5: add ax, ax                      ; ax *= 2
5af8: jmp word ptr cs:[bx+0x5b16]     ; salto por tabla
```
Una tabla **cardinal de 4 entradas** tendría `cmp ax, 3`. El `cmp ax, 7` es la prueba
dura de que la tabla tiene 8 slots.

### A.3 — La tabla de 5b16 son 16 bytes = 8 words
El desensamblador la decodifica como datos-basura (`(bad) 0xfe`, `pop dx`, `or bl…`).
Bytes crudos `5b16..5b25`:
```
fe 5a | fe 5a | 0a 5b | 0a 5b | 04 5b | 04 5b | 10 5b | fe 5a
```
Little-endian → **8 destinos**:

| idx (dir) | word | target | acción |
|--:|---|---|---|
| 0 | 5afe | 0x5afe | `dec [bp-0x210]` |
| 1 | 5afe | 0x5afe | `dec [bp-0x210]` |
| 2 | 5b0a | 0x5b0a | `dec [bp-0x212]` |
| 3 | 5b0a | 0x5b0a | `dec [bp-0x212]` |
| 4 | 5b04 | 0x5b04 | `inc [bp-0x210]` |
| 5 | 5b04 | 0x5b04 | `inc [bp-0x210]` |
| 6 | 5b10 | 0x5b10 | `inc [bp-0x212]` |
| 7 | 5afe | 0x5afe | `dec [bp-0x210]` |

Ejes (de 5b48-5b5c): `[bp-0x212]` se suma a la fila y se hace `<<5` (×32 = stride de
fila) ⇒ **`[bp-0x212]` = fila (dy)**; `[bp-0x210]` se suma sin desplazar ⇒
**`[bp-0x210]` = columna (dx)**.

### A.4 — El acumulador NO se resetea entre direcciones (⇒ perímetro Moore)
Los únicos targets escriben `[bp-0x210]`/`[bp-0x212]` con **inc/dec incremental**. En
todo el cuerpo del bucle interno (5b26-5cdb) **no existe ninguna** `mov [bp-0x210],…` /
`mov [bp-0x212],…` que los devuelva al valor del padre; sólo se fijan al DESENCOLAR una
celda nueva (5ac6/5adc, fuera del bucle). El padre se guarda aparte en
`[bp-0x208]`/`[bp-0x206]` y sólo lo consulta la lógica de emisores (5c19-5c45). Por
tanto los 8 deltas se **componen**: la posición traza el perímetro completo. Contador →
posición cumulativa procesada (padre = C0,R0):

| dir | delta acumulado | vecino |
|--:|---|---|
| 7 | (−1, 0) | O (cardinal) |
| 6 | (−1,+1) | **SO (diagonal)** |
| 5 | ( 0,+1) | S (cardinal) |
| 4 | (+1,+1) | **SE (diagonal)** |
| 3 | (+1, 0) | E (cardinal) |
| 2 | (+1,−1) | **NE (diagonal)** |
| 1 | ( 0,−1) | N (cardinal) |
| 0 | (−1,−1) | **NO (diagonal)** |

⇒ los 8 vecinos de Moore, **las 4 diagonales incluidas**, cada una evaluada de forma
independiente con el MISMO test de radio/opacidad que un cardinal (5ba5-5c01). **No hay
ninguna condición de flancos que gatee la diagonal.** Es un flood-fill de
8-conectividad.

---

## B. Witness runtime (DOSBox, definitivo)

Script: `scratchpad/flood_witness.py` (usa `re/tools/oracle.py` SIN modificarlo).
Método: BP de código en `load_seg:0x5B26` (inicio del proceso del vecino, ya aplicado el
delta de la jump-table), se fuerza un turno `(RIGHT)` → redibujo → corre el flood, y por
cada hit se leen los locales `[bp-0x216]` (dir), `[bp-0x210]` (col), `[bp-0x212]` (fila)
y el padre `[bp-0x206]/[bp-0x208]` vía `EV BP`/`EV SS` + `MEMDUMPBIN`.

Traza cruda observada (mundo real, `game_ds=1788`, `load_seg=0824`):
```
hit  1 | dctr=7 | parent=(c5,r5) cur=(c4,r5) | delta=(dc-1,dr+0)   O
hit  2 | dctr=6 | parent=(c5,r5) cur=(c4,r6) | delta=(dc-1,dr+1)   SO  <- DIAGONAL
hit  3 | dctr=4 | parent=(c5,r5) cur=(c6,r6) | delta=(dc+1,dr+1)   SE  <- DIAGONAL
hit  4 | dctr=3 | parent=(c5,r5) cur=(c6,r5) | delta=(dc+1,dr+0)   E
hit  5 | dctr=2 | parent=(c5,r5) cur=(c6,r4) | delta=(dc+1,dr-1)   NE  <- DIAGONAL
hit  6 | dctr=1 | parent=(c5,r5) cur=(c5,r4) | delta=(dc+0,dr-1)   N
hit  7 | dctr=0 | parent=(c5,r5) cur=(c4,r4) | delta=(dc-1,dr-1)   NO  <- DIAGONAL
hit  8 | dctr=7 | parent=(c4,r5) cur=(c3,r5) | delta=(dc-1,dr+0)   (celda siguiente…)
… (hits 8-18: mismo anillo relativo a los padres (c4,r5) y (c4,r6))
```
Resumen agregado (offsets distintos vistos, relativos al padre):
```
(dc-1, dr-1)  DIAGONAL   (dc-1, dr+0)  cardinal   (dc-1, dr+1)  DIAGONAL
(dc+0, dr-1)  cardinal   (dc+0, dr+1)  cardinal
(dc+1, dr-1)  DIAGONAL   (dc+1, dr+0)  cardinal   (dc+1, dr+1)  DIAGONAL
vecinos distintos = 8    diagonales distintas = 4
```
El binario, EN EJECUCIÓN, visita los 8 vecinos de Moore por celda (padre FIJO mientras
`cur` recorre el anillo — se ve el acumulado sin reset), con las 4 diagonales como
vecinos de primera clase. **Witness = MOORE, coincide EXACTO con la reconstrucción
estática A.4.** (El witness observa la TRAVERSAL directamente, que es aún más limpio que
leer el buffer de marcas: prueba que la diagonal se visita y evalúa sin precondición de
flancos.)

---

## C. Las tres lecturas contrastadas — quién leyó mal qué instrucción

| — | read-sweep-5 (`kernel-flood-0x5a28.md`) | reviewer E1-S2 (`port-e1s12-review.md`) | esta adjudicación |
|---|---|---|---|
| nº entradas tabla 5b16 | **8** ✅ | 4 ❌ | 8 (A.3, `cmp ax,7`) |
| ¿reset del acumulador? | **no → perímetro** ✅ | asume reset (2 saltos cardinales vía celda intermedia) ❌ | no (A.4) |
| topología | **Moore (8, con diagonales)** ✅ | cardinal (4) ❌ | Moore ✅ (witness B) |
| gate de flancos en el binario | **ninguno** ✅ | "emergente, semántica OR" ❌ | ninguno ✅ |

**La instrucción que el reviewer leyó mal** (`port-e1s12-review.md` L268-273): *"La tabla
de saltos (5aec-5b26 …) sólo tiene 4 entradas válidas (5afe/5b04: ±col; 5b0a/5b10: ±row)
— nunca mueve las dos coordenadas a la vez … Una celda diagonal SÓLO es alcanzable por
composición de 2 saltos cardinales."* El reviewer contó los **4 targets ÚNICOS** de la
tabla y los tomó por "4 entradas", e infirió un reset del acumulador que no existe. Las
instrucciones que lo refutan y que su lectura pasó por alto:
- **`5af0: cmp ax, 7`** — el bound del dispatch es 7 ⇒ 8 entradas (una cardinal sería
  `cmp ax, 3`). Ésta es la prueba de una línea.
- **`5a3c: mov [bp-0x216], 7`** + **`5cdb: dec` / `5ce5: cmp …,-1`** — 8 iteraciones.
- **La AUSENCIA de cualquier `mov [bp-0x210]/[bp-0x212], base`** dentro de 5b26-5cdb — sin
  reset, los deltas de un solo eje se COMPONEN en un desplazamiento diagonal directo; la
  diagonal es un vecino directo del anillo, no "2 saltos vía una celda intermedia
  transparente". Su modelo "OR-de-flancos" es una consecuencia del reset imaginado.

Por qué su fuerza bruta (8000 configs, "0 discrepancias") no lo detectó: comparó el port
contra **su propia reconstrucción cardinal-only** — el mismo modelo erróneo a ambos
lados (verificación circular). Nunca contra un flood Moore ni contra DOSBox.

**Nit menor en la lectura ganadora** (no afecta al veredicto): la leyenda de locales de
`kernel-flood-0x5a28.md` §1 rotula `[bp-0x212]=cur_col` / `[bp-0x210]=cur_row`, pero el
código (5b48-5b5c: `[bp-0x212]` es la que se hace `<<5`) y el witness dan lo contrario:
**`[bp-0x212]`=fila, `[bp-0x210]`=columna**. La tabla §3 de esa misma nota ya usa la
asignación correcta (`5afe = dec col = dec [bp-0x210]`), así que es sólo un swap
cosmético en la leyenda; la conclusión Moore es firme.

---

## D. Consecuencia (Moore ⇒ el port sub-revela)

El port `game/src/core/world/visibility.ts::floodFOV` recorre los 8 vecinos pero **gatea
las diagonales** con un AND-de-flancos:
```ts
// game/src/core/world/visibility.ts:199
if (dx !== 0 && dy !== 0 && (blocks(cx + dx, cy) || blocks(cx, cy + dy))) continue;
```
El binario NO tiene esa condición. Conjunto que difiere: **celda diagonal, iluminada
(radial ≤ light) y transparente, con AMBOS flancos ortogonales opacos** (rendija diagonal
entre dos esquinas de muro). El ORIGINAL la revela (corte de esquina real); el PORT la
deja a negro. Dirección: el port **sub-revela** (lado SEGURO de la regla dura #2) pero
**no es pixel-exacto** — ocurre en cada esquina de habitación (pueblos/castillos/mazmorra).

**Fix propuesto (vía pipeline SDD; el adjudicador NO toca `game/src`):**
1. **Eliminar la línea 199** de `floodFOV` (dejar las 8 aristas sin condición). Tras
   quitarla, para cada uno de los 8 vecinos: si `lit` y no visitado → `vis[ni]=1`; si
   `!blocks` → `queue.push`. Eso calca la semántica Moore del binario (el ORDEN del anillo
   O,SO,S,SE,E,NE,N,NO no afecta al conjunto final: la alcanzabilidad es orden-independiente).
2. Corregir los comentarios que afirman "avance cardinal 5aec-5b26" / "AND-de-flancos
   equivalente" (líneas 21-24, 163-165, 197-198): el avance es Moore 8-conectado y NO hay
   gate de flancos.
3. Los tests de regresión de E1-S2 que fijan la expectativa ERRÓNEA (diagonal oculta en la
   rendija de doble esquina) deben INVERTIRSE a "diagonal revelada".

Estado de la divergencia `re/deliberate-divergences.md` (fila "Corte de esquina diagonal"):
su condición de cierre era *"confirmar contra traza DOSBox"* — **ahora CUMPLIDA por el
witness B**. Actualizada: veredicto Moore confirmado en runtime; pendiente sólo el
despacho del fix por SDD.
