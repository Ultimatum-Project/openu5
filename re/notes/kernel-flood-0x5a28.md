# los_flood_fill (0x5A28) — lectura INTERNA byte-a-byte (barrido lote 5, task #16)

Scout de lectura. El único C "por subsistema, no por cuerpo" del kernel: la semántica
externa quedó en E1-S2 (`port-e1s12-review.md`, PASS), pero el CUERPO nunca se derivó
instrucción a instrucción. Este doc lo cierra. **Hallazgo grande: el flood real es de
8 vecinos (Moore), NO cardinal-only** — corrige la premisa central del addendum de la
review E1-S2 y abre una divergencia con el port (§6).

Rango: `ULTIMA.EXE.asm` 5a28–5d06 (738 B, `ret 0xe` = 7 args word). Callers: `0x5d0a`
(pase de la PARTY, 5d61) y `emitter_collect_and_flood` 0x5e4a (pase de EMISOR, 5f57).

---

## 1. Firma y marco de pila (confirmado desde el caller 0x5d0a:5d4b-5d61)

7 args (pushes right-to-left en el caller):

| bp | arg | party (0x5d0a) | emisor (0x5e4a) | rol |
|---|---|---|---|---|
| `[bp+4]`  | buf    | 0xab02 | 0xad14 | base del buffer de salida |
| `[bp+6]`  | stride | 0x20 (32) | 0x20 | ancho de fila del buffer |
| `[bp+8]`  | x0     | 0 | (col del emisor) | offset de columna sumado al índice de salida |
| `[bp+0xa]`| y0     | **0xff91 (−0x6f, CENTINELA)** | (fila del emisor) | offset de fila / selector de modo |
| `[bp+0xc]`| cx     | party−5 | emisor−5 | origen global X de la ventana (para 0x4402) |
| `[bp+0xe]`| cy     | party−5 | emisor−5 | origen global Y de la ventana |
| `[bp+0x10]`| light | g_light_level | 0x0a (10) | RADIO |

Locales clave:
- `[bp-2]`      = **writeIdx** (tope de la cola, en words; la cola guarda pares).
- `[bp-0x20c]`  = **readIdx** (cabeza de la cola).
- `[bp-0x204+2·i]` = **cola BFS** (pila local 0x200 B → 256 words → 128 celdas máx).
- `[bp-0x216]`  = **dir** (contador de dirección, 7→0, 8 pasos por celda).
- `[bp-0x20a]`  = **okFlag** (candidata válida: en rango 0..10 y no visitada).
- `[bp-0x20e]`  = **modeFlag** (0 = emisor, 1 = party).
- `[bp-0x212]` = **cur_col (A)**, `[bp-0x210]` = **cur_row (B)** — acumuladores del
  vecino actual, MODIFICADOS por los saltos de dirección y **nunca reseteados** entre
  direcciones (ver §3 — es la clave del hallazgo).
- `[bp-0x208]`/`[bp-0x206]` = **saved_col/saved_row** — la celda PADRE (desencolada),
  fija durante las 8 direcciones; sólo la usa la consulta a 0xAD14 (§5).
- `[bp-0x214]` = tileVal de la candidata.

## 2. Prólogo y siembra (5a28-5ab9)

1. `light<=0` → return inmediato (5a4e).
2. **Centinela de modo (5a57-5a66):** si `y0 == −0x6f` ⇒ `y0=0` y `modeFlag=1` (PARTY).
   Si no ⇒ `modeFlag=0` (EMISOR). El caller de party (0x5d0a) pasa −0x6f → modo party.
3. `inc [bp+0x10]` (5a66) ⇒ **el umbral efectivo es light+1** (el "+1" que el port ya
   documenta: VISIBLE ⇔ radial ≤ light).
4. Encola el CENTRO **(5,5)** como primera celda (5a69-5a82; empuja `5` y `5`,
   writeIdx=2).
5. Pinta la celda central sin test de radio/opacidad: tile via `0x4402(cx+origin+5,
   cy+origin+5)` → `buf[y0·32 + x0 + 0xa5]` (0xa5 = 5·32+5 = índice del centro). `jmp
   0x5cf5` (chequeo de cola).

## 3. ⚠ El anillo de 8 vecinos (Moore) — NO cardinal (5abc-5ae8, 5aec-5b25)

Desencola un par → `cur_col/saved_col` y `cur_row/saved_row` (ambos = valor
desencolado). Luego bucle `dir = 7..0` (8 iteraciones), despacho por **jump-table de 8
entradas** en `cs:[bx+0x5b16]` (5af8):

Bytes crudos 5b16-5b25 = `fe5a fe5a 0a5b 0a5b 045b 045b 105b fe5a`, es decir:

| dir | destino | acción | (col,row) acumulado desde el padre (C0,R0) |
|--:|---|---|---|
| 7 | 5afe | `dec col` | (C0−1, R0)   ← cardinal O |
| 6 | 5b10 | `inc row` | (C0−1, R0+1) ← **DIAGONAL SO** |
| 5 | 5b04 | `inc col` | (C0,   R0+1) ← cardinal S |
| 4 | 5b04 | `inc col` | (C0+1, R0+1) ← **DIAGONAL SE** |
| 3 | 5b0a | `dec row` | (C0+1, R0)   ← cardinal E |
| 2 | 5b0a | `dec row` | (C0+1, R0−1) ← **DIAGONAL NE** |
| 1 | 5afe | `dec col` | (C0,   R0−1) ← cardinal N |
| 0 | 5afe | `dec col` | (C0−1, R0−1) ← **DIAGONAL NO** |

Los deltas se aplican **acumulativamente** sobre `[bp-0x212]/[bp-0x210]` y **no hay
ninguna instrucción que los resetee** a `saved_col/saved_row` entre direcciones (el
lazo 5cdb→5ce5→5aec sólo hace `dec dir`). Resultado: los 8 pasos trazan el PERÍMETRO
completo de Moore alrededor del padre — 4 cardinales **y 4 diagonales**. Cada vecino
(incluidas las diagonales) se evalúa de forma independiente y, si es visible+transparente,
se pinta y se encola. **Es un flood-fill de 8-conectividad, sin condición de flancos.**

> Esto refuta la afirmación del addendum E1-S2 ("estrictamente cardinal, la tabla sólo
> tiene 4 entradas válidas, el corte de esquina es emergente"). La tabla tiene 8
> entradas y el acumulador no se resetea. El asimétrico dir7=`dec col` (en vez de
> `inc row`) es exactamente lo que arranca el anillo en un cardinal para que el
> perímetro cierre limpio — no es una entrada "muerta".

Bounds (5b26-5b48): col,row ∈ [0,10]; fuera ⇒ `okFlag=0`.
Visitado (5b5f-5b9b): en party (`modeFlag=1`) mira `buf[idx]==0xff` (0xff = sin visitar,
init por el caller); si ya visitado ⇒ `okFlag=0`. Si `okFlag==0` ⇒ `jmp 5cdb` (salta al
siguiente dir). En emisor (`modeFlag=0`) usa la máscara de mapa-en-pantalla `[…-0x54fe]`.

## 4. Test de radio / opacidad de la candidata (5ba5-5c01)

- `tileVal = *0x4402(cx+col+origin, cy+row+origin)` (5ba5-5bca).
- `radial = 0x6ff0(col,row)` (tabla 6×6 DS:0x6aa8; = RADIAL_DISTANCE del port) (5bd6).
- `radial >= light+1` ⇒ FUERA de radio → 5c93 (pinta tileVal directamente; la extensión
  por emisor se decide en 5c05/5c52 vía 0xAD14). `radial < light+1` (i.e. ≤ light) ⇒
  DENTRO de radio → `jmp 5c93` en party, o test de opacidad en 5beb.
- **`0x5dfe(tileVal, radial)`** (5bfe) = predicado de opacidad. Devuelve **1 =
  TRANSPARENTE, 0 = OPACO** (polaridad confirmada vía el `memchr` 0x402 y el cableado
  del caller — ver §7). `jne 5c52` (transparente) / cae a 5c05 (opaco).

## 5. Marcado + consulta al buffer de emisores 0xAD14 (5c05-5ca1)

Semántica de valores del buffer de salida: **0xff** = celda plenamente visible que
propaga · **tileVal (≠0)** = celda vista que NO propaga (muro, o borde de luz) · **0** =
no visible (negro / fuera).

- Rama **transparente** (5c52): dentro de límites globales y `0xAD14[candidata]!=0`
  (iluminada por algún emisor) ⇒ pinta tileVal (5c93); si `0xAD14==0` y fuera de radio
  propio ⇒ pinta 0 (5c74). Dentro de radio propio ⇒ pinta tileVal sin consultar 0xAD14.
- Rama **opaca** (5c05): consulta `0xAD14` para el PADRE (`saved`, 5c19-5c2e) y para la
  candidata (5c30-5c45); si cualquiera == 0 ⇒ pinta 0xff (5c47); si ambas != 0 ⇒ pinta
  tileVal (muro iluminado). Direccionamiento `[bx+di-0x52ec]`, −0x52ec mod 0x10000 =
  0xAD14. **Este bloque es la consulta a fuentes de luz, NO un gate de esquina** (el
  addendum E1-S2 ya lo corrigió; se confirma aquí).

## 5b. Encolado (5ca1-5cd8)

Re-evalúa `0x5dfe(tileVal_final, radial)` (5cb4): si **transparente (ret 1)** empuja
`(cur_col,cur_row)` a la cola (5cbb-5cd8); si opaco (ret 0) no propaga (`je 5cdb`). El
orden de encolado es el orden del anillo (O,SO,S,SE,E,NE,N,NO); **no afecta al conjunto
final** de visibles (alcanzabilidad = propiedad de conectividad, no de orden). `ret 0xe`.

## 6. ⚠ DIVERGENCIA con el port (game/src/core/world/visibility.ts)

El port (`floodFOV`) usa 8 vecinos pero **gatea las diagonales**: sólo propaga/revela una
diagonal si AMBOS flancos ortogonales son transparentes (`if (dx&&dy &&
(blocks(flank1)||blocks(flank2))) continue`). El binario **NO** tiene esa condición: revela
la diagonal si la propia celda es visible+transparente, con independencia de los flancos.

- **Conjunto que difiere:** celda diagonal, iluminada (radial ≤ light) y transparente,
  con **AMBOS flancos ortogonales opacos** (una rendija diagonal entre dos esquinas de
  muro). El ORIGINAL la revela (corte de esquina real); el PORT la deja a negro.
- **Dirección:** el port **sub-revela** (nunca sobre-revela) ⇒ del lado SEGURO de la
  regla dura #2. Pero **no es pixel-exacto**: en cada esquina de habitación (muy común
  en pueblos/castillos/mazmorra) hay una celda diagonal que el original muestra y el
  clon oculta.
- **Por qué la review E1-S2 lo dio por equivalente:** su fuerza bruta (8000 configs)
  comparó el port contra una **reconstrucción cardinal-only propia del reviewer** — el
  mismo modelo erróneo a ambos lados ⇒ 0 discrepancias triviales (verificación
  circular). Nunca se comparó contra un flood de 8-conectividad ni contra DOSBox.
- **Antes de tocar el port** (no es mío): confirmar contra una traza DOSBox / píxel-diff
  (arnés F3) parado en una esquina de muro con el hueco diagonal abierto. Si el original
  revela la diagonal, quitar el gate de flancos del port (dejar las 8 aristas sin
  condición) restaura la exactitud sin romper la regla #2.

## 7. Nota de polaridad de 0x5dfe (para evitar el error de la review)

`0x5dfe(tile, radial)` (5dfe-5e47): tiles con visor {0x4a,0x4b,0xba,0xbb,0x98} ⇒ ret 1
sólo si `radial==1` (transparente pegado, opaco lejos); resto ⇒ `memchr(DS:0x6a86, tile,
19)` (0x402, ret puntero≠0 si HALLADO). Hallado (en la tabla de 19 opacos: bosque 0x09,
muros 0xd0-d3…) ⇒ **ret 0 = OPACO**; no hallado ⇒ **ret 1 = TRANSPARENTE**. El caller
propaga cuando ret != 0. El `isSightBlocking` del port invierte el booleano
(true=opaco), pero el COMPORTAMIENTO coincide exacto: bosque bloquea, hierba pasa, visor
transparente sólo a radial 1. Verificado tile a tile.
