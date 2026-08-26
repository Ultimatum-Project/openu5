# La ceremonia de CONJURO (`CAST2.OVL:0x0000`) — un índice, ocho ventanas, y los sitios que el port no dispara

Carril `ceremonias-serie`, 2026-08-26. Cierra el censo de clases que `ceremonias-cadencia-medida.md`
(#166) dejó abierto: aquel agrupó **161 eventos de inversión de paleta** de los 33 episodios de
Lord Fenton **por DURACIÓN**, y lo declaró un proxy. Nombrados por su **CONTENIDO** —la consola del
fotograma anterior, OCR-eada con el motor de plantillas del corpus— **128 de los 161 son la MISMA
ceremonia**, la de `CAST2:0x0000`, con la duración como PARÁMETRO.

Extendido a los otros dos walkthroughs con subtítulos completos, el corpus pasa de 161 a **505
eventos de inversión**: aulddragon 78 (24 eps) y alexdiener 266 (25 eps). El reparto se repite:
la familia del conjuro domina en los tres, y alexdiener aporta **siete círculos distintos** y
doce hechizos que Lord Fenton no lanza.

---

## 1. La rutina y su único argumento (DERIVADO)

`CAST2.OVL:0x0000`, el jingle común de todos los conjuros, recibe **un** solo argumento,
gateado a `< 9` (`0005 cmp word ptr [bp+4], 9` / `0009 jge 0x80`), y con él escala todo:

| dirección | qué hace | dependencia del índice `i` |
|---|---|---|
| `000b-001d` | `noise_burst(step=0x320, dur=0x1f40+0x640·i, band=0x2bc)` | dur ∝ `i` |
| `0020-0024` | `push [g_unk_13b0]` → `set_color` | — |
| `0027-0031` | `rect(8,8,0xb7,0xb7)` en función **XOR** ⇒ viewport invertido | — |
| `0034-0056` | `tone_sweep(inc=[si+0x4af6], 1, count=0x2710+0xfa0·i, [si+0x4b08], [si+0x4b2c])` | count ∝ `i` |
| `0059-…` | el sweep espejo (mismo `count`, tabla `0x4b1a`) | count ∝ `i` |
| (cola) | el MISMO rect XOR ⇒ des-invierte (XOR involutivo) | — |

⇒ **la ventana invertida = los dos sweeps**, y crece linealmente con el índice. Es exactamente lo
que el port ya deriva en `skin/fiel/speaker.ts:timeSpellFlashWindowMs(idx)`
(`delay = dur del NB`, `dur = 2·sweep`), sin ninguna constante libre.

## 2. Qué es el índice EN CADA SITIO (DERIVADO, leído en crudo)

No es un «índice de pergamino». Cada llamador empuja **un literal propio**, y el reparto es:

| sitio | llamador | índice | qué es |
|---|---|---|---|
| `CAST.OVL:0x0f2b`, `0x0fe0`, `0x100a`, `0x1088`, `0x10b4` y ss. | manejador de CADA hechizo del `(C)ast` | literal 1..8 | **el CÍRCULO del hechizo** |
| `CAST.OVL:0x139b` | `(U)se` de POCIÓN (`cmd 0x135a`) | `push [bp+4]` | **el COLOR de la poción** (0..7) |
| `CAST.OVL:0x121b` | pergamino 0 = Vas Lor | `sub ax,ax` ⇒ **0** | literal |
| `CAST.OVL:0x1259` → stub → `CAST2:0x08f8` | pergamino 2 = In Sanct | **2** | literal |
| `CAST.OVL:0x1273` → `0x125c` | pergamino 3 = In An | **3** | literal |
| ~~`CAST.OVL:0x1294` · pergamino **5** = Kal Xen Corp · 4~~ → **pergamino 4 = In Quas Wis** | (ver §2.1) | **4** | literal |
| `CAST.OVL:0x1339` → `0x125c` | pergamino 7 = An Tym | **7** | literal |
| `CAST2:0x0428/0x04de/0x06d4/0x07d8/0x087c` | sitios de mazmorra/combate | 1\|2, 5\|8, 6\|8, 4, 4 | literales |

Que en el `(C)ast` el literal SEA el círculo no hay que suponerlo: el propio `cast_spell` lo
computa doce instrucciones antes —`CAST.OVL:0x0e0a-0x0e14`, `mov ax,[bp-2]` (índice de hechizo) /
`cdq` / `mov cx,6` / `idiv cx` / `inc ax`— y lo usa para el gate de nivel y para restar maná
(`0x0ef8 sub [si+0x55b7], al`). Los literales de los manejadores coinciden uno a uno con ese
`idx/6+1`. La corroboración VIVA está en §3.

`CAST2:0x08f8` (el setter del hechizo-de-tiempo) no aporta índice propio: guarda char y turnos
(`08fb`/`0901`) y **reenvía su primer argumento** a `0x0000` (`0907 push [bp+4]` / `090a call 0`).

### 2.1 🔴 CORRECCIÓN a la fila del pergamino (carril `destello-conjuro`, 26-08)

La fila tachada decía «pergamino **5** = Kal Xen Corp». Es **falso por los dos lados**: el sitio
`0x1294` no es del pergamino 5, y el pergamino que sí lo tiene no es Kal Xen Corp.

Lo dirime la **jump table de pergaminos**, que la nota no llegó a leer: `0x1205
jmp word ptr cs:[bx-0x2d40]`, ocho entradas en el offset de fichero **0x1340**.

| entrada | handler | ¿ceremonia? | índice |
|---|---|---|---|
| 0 Vas Lor | `0x120a` | sí, `0x1218 sub ax,ax` / `0x121b` | **0** |
| 1 Rel Hur | `0x1222` | no | — |
| 2 In Sanct | `0x124a` | sí, `0x1259 mov ax,2` → setter `0x125d` | **2** |
| 3 In An | `0x1264` | sí, `0x1273 mov ax,3` → `jmp 0x125c` | **3** |
| **4 In Quas Wis** | `0x1278` | sí, `0x1290 mov ax,4` / **`0x1294`** | **4** |
| 5 Kal Xen Corp | `0x12b4` | **no** | — |
| 6 In Mani Corp | `0x12d8` | no | — |
| 7 An Tym | `0x1300` | sí, `0x1339 mov ax,7` → `jmp 0x125c` | **7** |

`0x1294` cae DENTRO del handler que empieza en `0x1278`, que es la entrada **4**. Y el cuerpo
que sigue a la ceremonia allí no deja lugar a duda: `0x129e push g_party_x/g_party_y` →
`LOOKOBJ.OVL:0x10fc` (o `DNGLOOK.OVL:0x06a8` en mazmorra) = **el revelado del mapa**, que es
In Quas Wis. Kal Xen Corp (entrada 5, handler `0x12b4`) fuera de combate imprime «Not here!» y
en arena se va a `CAST2:0x04c2`: por ninguna de sus dos ramas pasa por `0x0000`.

★★ El error no se ve leyendo el sitio: se ve leyendo **la tabla que reparte los sitios**. Una
dirección que cae dentro del handler de al lado tiene cuerpo plausible y no falla ruidosamente
— la misma clase que el `call` cross-overlay leído en crudo.

⇒ **§7 se corrige con ella**: los dos pergaminos que el corpus no cubre son Vas Lor (0) e
**In Quas Wis (4)**, no «Vas Lor y Kal Xen Corp».

Dos gates que la tabla no lleva dentro y que quedan en el llamador: In Quas Wis exige
`g_location <= 0x7f` (`0x127f`) — en arena imprime «Not here!» y no destella — y An Tym se
salta la ceremonia con `g_location` 0x1d ó 0x28 (`0x1300`-`0x130c`, la rama «No effect!»).

## 3. La LEY, medida en vivo — y las tres parejas que la discriminan

Instrumento: brillo medio del viewport nativo (x8..183, y8..183) por fotograma a 30 fps con la
caja calibrada + NEAREST, umbral a media distancia entre las dos modas del propio tramo
(el de `pulsos.py` de #166, sin cambios). **Cada clase con representante y RÉPLICA de otro
episodio.** Todos los eventos salen como **UN solo pulso ON** (no hay tren).

Lord Fenton, 18 medidas:

| hechizo | círculo | instancia | réplica |
|---|---|---|---|
| MANI | 1 | ep19@966,3 → **2133 ms** | ep05@377,0 → 2167 ms |
| AN NOX | 1 | ep10@892,3 → **2133 ms** | ep21@213,9 → 2200 ms |
| VAS LOR | 3 | ep25@269,5 → **3333 ms** | ep30@663,5 → 3200 ms |
| IN POR | 3 | ep29@1424,2 → **3333 ms** | ep32@965,7 → 3400 ms |
| UUS POR | 4 | ep26@235,7 → **3900 ms** | ep26@1611,4 → 3867 ms |
| VAS MANI | 5 | ep24@180,7 → **4467 ms** | ep33@1594,7 → 4633 ms |
| AN XEN EX | 6 | ep33@1329,2 → **5100 ms** | ep28@494,7 → 5267 ms |
| IN VAS POR YLEM | 6 | ep22@453,7 → **5267 ms** | ep31@498,7 → 5233 ms |
| VAS REL POR | 8 | ep30@376,4 → **6367 ms** | ep29@1665,3 → 6433 ms |

Ajuste: **`dur = 1514 + 611·círculo`, R² = 0,9975.**

Y la misma ley, con OTROS hechizos y OTRO jugador, en alexdiener (17 medidas, **siete** círculos
— la muestra más rica del corpus): IN LOR y AN NOX y MANI (c1) **1233-1300 ms** · IN WIS y KAL XEN
(c2) **1600 ms** · IN POR (c3) **2000 ms** · AN GRAV (c4) **2300-2333 ms** · VAS MANI y REL TYM
(c5) **2667-2700 ms** · IN VAS POR YLEM (c6) **3067 ms** · IN QUAS XEN (c7) **3367 ms**.
Ajuste: **`dur = 897 + 359·círculo`, R² = 0,9988.** Doce de esos hechizos NO los lanza LF, y cada
círculo con una sola duración: es la misma ley.

🔴 **La ley es del CÍRCULO y no del índice de hechizo, y eso no se lee del ajuste: se lee de las
tres parejas donde las dos variables DISCREPAN** (el testigo elegido tiene que instanciar la
diferencia donde existe):

| pareja | índices en `spellQuantities` | círculo | duraciones |
|---|---|---|---|
| MANI / AN NOX | 4 / 3 | 1 / 1 | 2133-2167 / 2133-2200 |
| VAS LOR / IN POR | 12 / 17 | 3 / 3 | 3333-3200 / 3333-3400 |
| AN XEN EX / IN VAS POR YLEM | 34 / 30 | 6 / 6 | 5100-5267 / 5267-5233 |

Índices que se separan hasta 5 posiciones dan la MISMA duración; círculos que se separan uno dan
600 ms de diferencia. Y la poción lo corrobora por el otro lado: las 9 pociones de LF miden
2,13-2,20 s **salvo una de 5,20 s** — con la ley, índices 1 y 6, que son dos COLORES distintos,
como manda `0x139b`.

## 4. Lo que el PORT tiene y lo que le falta (MEDIDO, con control positivo)

El port implementa la ceremonia entera (`TimeSpellFlash` + `timeSpellFlashWindowMs` +
`invertViewportInterior`) y la dispara **sólo en tres sitios**: los pergaminos 2/3/7
(`main.ts:4478` y `:4598`). Los demás llamadores del binario no la disparan: el `(C)ast` emite
`cast-spell` —que además es `sfx_victory_fanfare 0x4368`, atribución que `sfx-catalog.md` §3.5 ya
declara falsa— y la piel fiel no invierte nada con ese cue; la poción y los pergaminos 0 y 5 no
emiten cue alguno.

Careo denso propio (`game/tools/careo-visual/captura-densa-hechizo.pw.ts`, 60 fps sobre el canvas
lógico 320×200), MISMO instrumento que el vídeo, MISMA sesión:

| ceremonia en el port | separación p90−p10 del brillo | ventana medida | ventana DERIVADA por el propio port |
|---|---|---|---|
| `(U)se` An Tym (pergamino 7) | **192,3** niveles | **2949 ms** | 2945 ms (`idx 7`) |
| `(C)ast` VAS LOR | **0,08** | — SIN BIMODALIDAD | — |
| `(C)ast` MANI (con «Success!») | **0,08** | — SIN BIMODALIDAD | — |
| `(U)se` poción amarilla (con «Slept!») | **0,08** | — SIN BIMODALIDAD | — |

El An Tym es el CONTROL POSITIVO del instrumento: sin él, «no hay destello» en las otras tres no
probaría nada. Suelo de determinismo (dos corridas idénticas): **±4 ms** en la duración y ±56 ms
en el instante de arranque; para las no-bimodales, separación 0,08 en las dos corridas.

⇒ ~~**Falta el destello en el `(C)ast` (los 48 hechizos), en la poción y en los pergaminos 0 y 5.**~~
En el corpus de LF eso son **128 + 9 = 137 de los 161 eventos** de inversión, el 85 %.

### 4.1 ✅ ARREGLADO — y con qué alcance exacto (carril `destello-conjuro`, 26-08)

**Confirmado primero de forma independiente**, con instrumento y sesión propios (mismo arnés,
puerto 5271): An Tym **separación 182,5 / pulso 2937 ms** contra 2945 derivados (control
positivo), y `(C)ast` VAS LOR · `(C)ast` MANI · poción los tres en **separación 0,1 = SIN
BIMODALIDAD**. Mismo veredicto que §4; las dos medidas difieren dentro del suelo del
instrumento.

Y medido otra vez **después** del arreglo, en la misma sesión:

| ceremonia | antes | después | ventana que el port DERIVA |
|---|---|---|---|
| (U)se An Tym (7) | 182,5 · 2937 ms | 182,5 · **2950 ms** | 2945 |
| **(C)ast VAS LOR** (círculo 3) | 0,1 — SIN BIMODALIDAD | 182,4 · **1715 ms** | **1705** |
| **(C)ast MANI** (círculo 1) | 0,1 — SIN BIMODALIDAD | 182,4 · **1084 ms** | **1085** |
| **(U)se poción amarilla** (color 1) | 0,1 — SIN BIMODALIDAD | 182,4 · **1083 ms** | **1085** |

★★ La ley `dur = a + b·círculo` queda instanciada **donde se distingue**: dos hechizos, dos
círculos, dos duraciones, cada una contra su ventana derivada. Y la captura mirada (no sólo la
cifra) enseña el XOR: interior del viewport invertido —agua azul→amarillo, hierba→magenta,
negro→blanco— con **chrome y paneles intactos** = el `rect (8,8)-(183,183)`.

**Las dos correcciones al alcance que §4 daba de oídas** (y que el port ahora implementa):

- **Pergaminos: los que faltaban eran 0 y 4**, no «0 y 5» — §2.1.
- **No son «los 48 hechizos»: son 41.** Barridas las 48 entradas de la jump table
  `0x0f1a`/`0x1146` con resolución de stubs y `ax` simbólico, **41 handlers alcanzan la
  ceremonia y los 41 empujan un literal que incluye su círculo; ninguno empuja uno ajeno**. Los
  siete que no la alcanzan son **dos familias enteras**, no una lista suelta:
  · **arma-hechizo** (Grav Por 1, Vas Flam 13, Xen Corp 37) → todos a `CAST.OVL:0x0032`, once
  instrucciones que fijan `g_cmb_weapon` y saltan a `COMSUBS.OVL:0x0c52`;
  · **abanico de línea** (In Zu 28, In Nox Hur 40, In Vas Grav Corp 44, In Flam Hur 45) → todos
  a `0x104e` → `CAST.OVL:0x1f60`, 200 instrucciones sin una sola llamada a la ceremonia.
  ★ El reparto se acredita solo: esas dos familias son exactamente las que el port ya cataloga
  con sonido PROPIO (`line-spray` nombra los mismos cuatro, derivado por otro carril sin
  conocer este censo), y el censo global lo respalda por el otro lado — COMSUBS.OVL no está
  entre los overlays que llaman a `0x0000`.
- **Vas Rel Por (46) es excepción de SITIO, no de índice**: su handler `0x112e` →
  `CAST.OVL:0x0cf0` no destella al lanzar, sino tras el gate de fase `'1'..'8'` EXACTO
  (`0x0d1d`/`0x0d23`), donde empuja el literal 8 (`0x0d2d`); las tres salidas tempranas caen en
  `0x0d46 sub ax,ax` y se la saltan. El literal coincide con su círculo, pero el disparo es UNO.

### 4.2 El CENSO COMPLETO de llamadores (lo que §2 dejaba en «y ss.»)

`dispatch_table.near_calls_to_kernel(*, 0x8106)` sobre los 28 `.asm` — el stub `0x8106` es el
que resuelve `call 0xffffc186` desde CAST.OVL (destino de 16 bits `0xc186` + base de banda
`0xbf80`). **40 sitios, en DOS overlays y ningún otro: CAST.OVL 34 y CAST2.OVL 6** (internos
`0x428`, `0x4de`, `0x6d4`, `0x7d8`, `0x87c`, y `0x90a` = el reenvío del setter).

Control positivo de la resolución, exigido antes de nombrar ninguna rutina: el stub vecino
`0x80b2` sale `CAST2:0x08f8` —el setter que esta misma nota citaba por otra vía— y las 14
resoluciones de los thunks de CAST.OVL caen **todas** en rutinas que el port ya nombra por su
cuenta (`0x00de` teclear hechizo, `0x009e` «On who:», `0x046c` revelado de la poción blanca,
`0x07bc` An Grav, `0x04c2` daemon en arena…).

## 5. La ESCALA — DOS jugadores coinciden y Lord Fenton es el ATÍPICO

#166 dejó abierta la ficha G1 («el port corre la aparición a 0,49× y la puerta lunar a 0,55× del
testigo LF; coincidir en el sentido es indicio de causa común, no prueba»). La ley de §3 da
**decenas de puntos de comparación en vez de uno**, y ahora hay TRES capturas independientes:

| captura | n | ley ajustada | R² | razón contra la ventana derivada del port |
|---|---|---|---|---|
| **alexdiener** (25 eps, 7 círculos) | 17 | `897 + 359·círculo` | 0,9988 | **1,157 ± 0,016** |
| **aulddragon part09-18** | 9 | `908 + 352·círculo` | 0,9974 | **1,157 ± 0,020** |
| aulddragon part02-07 | 2 | (sólo círculo 1) | — | 1,413 |
| **Lord Fenton** (33 eps, 6 círculos) | 18 | `1514 + 611·círculo` | 0,9975 | **1,964 ± 0,036** |
| port (derivada, `speaker.ts` con `DELAY_UNIT_MS=0,93`) | — | `775 + 310·círculo` | — | 1,000 |

★★ **Dos jugadores distintos, con DOSBox distintos y doce hechizos que no comparten, dan la
MISMA razón hasta la tercera cifra: 1,157.** Lord Fenton da 1,964 — y la diferencia entre él y
los otros dos (1,70×) es del mismo orden que la que separa sus DOS propias tandas
(1,413 vs 1,157 = 1,22×). ⇒ **el ~2× de G1 es de la captura de Lord Fenton, no del port.**
🔴 Lo que NO se sigue de ahí es que 1,157 sea «la verdad»: ver 5.1 y 5.2.

### 5.1 🔴 Y QUÉ RELOJ PACEA CADA CEREMONIA — el discriminante, medido, y su derivación

Aquí había escrito que la puerta lunar «va en sentido contrario» y que eso desmentía una causa
común. Es **falso**, y mientras yo medía el carril `cadencia-asm` lo adjudicó y lo derivó:
`cadencia-delay-pit.md` (#167) separa las TRES primitivas de temporización del binario —
`delay(n)` **0x20fa** cuenta tics de INT 1Ch (**54,9254 ms exactos**, el binario no reprograma
el PIT: censo de los 28 `.asm` con cero `out 0x43`/`out 0x40`), `run_n_frames` **0x3ae6** sólo da
cota inferior, y `pcspeaker_tone_sweep` **0x2192** es un **busy-wait calibrado a la CPU**, que
**no da milisegundos por construcción**. Con eso: la puerta lunar era derivable byte-exacta y el
port la tenía mal (1647,8 ms contra 900), y el vídeo de Lord Fenton cayó a **−0,21 %** sobre ese
fenómeno.

⇒ el jingle de `CAST2:0x0000`, el destello del curandero y la ventana del WELL DONE cuelgan
**todos** de `tone_sweep` (la primitiva sin milisegundos), y la aparición de su pareado; la
puerta lunar cuelga de `delay(n)`. Lo que yo aporto es la otra mitad, la que sólo se ve con más
de una captura: **cuánto se mueve de hecho lo que no es derivable, y qué sigue siendo adjudicable
pese a ello.**

El discriminante no hay que suponerlo: **se mide comparando la MISMA ceremonia entre capturas.**
Si las capturas coinciden, el reloj es de pared; si su razón es la razón de las capturas (aquí
LF/AD = **1,70**), es CPU-bound. Medido:

| ceremonia | LF | aulddragon | alexdiener | LF ÷ otro | ⇒ reloj |
|---|---|---|---|---|---|
| jingle del conjuro (todos los círculos) | — | — | — | **1,697** | CPU |
| pulso de la aparición | 4567 | 2694 (media de 6) | — | **1,695** | CPU |
| hueco de la aparición | 867 | 493 (media de 5) | — | 1,757 | CPU |
| santuario WELL DONE | 12 933 | 7133 | 7067-7333 | **1,813 / 1,796** | CPU |
| destello del curandero | 6133 | — | 3567-3600 | **1,712** | CPU |
| cruce de puerta lunar (#167) | fiel al 0,21 % | — | — | **1,00** | **PARED (tics)** |

Cinco ceremonias de paleta, cinco veces la razón de la captura (1,69-1,81); la única que NO
escala es la tic-paceada. La medida CONCUERDA con la derivación de #167 sin haber usado el asm:
son dos vías independientes al mismo reparto. Y cuantifica lo que «no derivable en ms» significa
en la práctica: **entre tres capturas del mismo juego, un factor de hasta 1,70; entre dos tandas
del mismo jugador, 1,22.**

### 5.2 Lo que esto SÍ dice y lo que NO — corrección a mi propia lectura

🔴 **No «absuelve» ninguna constante.** Una versión anterior de esta nota dividía cada testigo
por su escala y celebraba que la aparición cayera a 2325/2334 ms contra los 2200 del port. Eso es
CIRCULAR: las escalas 1,964 y 1,157 se derivaron del jingle **contra el propio port**, así que
«la aparición normalizada da lo del port» sólo dice que la aparición y el jingle comparten reloj
—que es el hallazgo de 5.1— y **no** que 2200 sea el valor correcto.

Lo que queda en pie, y no depende de la escala:
- **la FORMA**: afín en el círculo con R² 0,997-0,999 en las tres capturas, con las mismas
  parejas discriminantes (§3). El port la reproduce exactamente.
- **la ESTRUCTURA**: `nº de pulsos = miembros vivos` gana su TERCERA corroboración —aulddragon
  ep15@824,9 da **6 pulsos** con party de 6, tras el 3 y el 4 de #166.
- **las RAZONES internas** dentro de una misma captura, que sí son adjudicables: es lo que hace
  el §6 con el curandero (la ventana visible es `ms(2)+ms(3)`, no las tres) y lo que corrobora la
  duración extra de la donación frente al WELL DONE (§7).
- **que ninguna captura adjudica la escala absoluta de una ceremonia CPU-bound.** Que alexdiener
  y aulddragon coincidan en 1,157 no es «la verdad»: es lo que da un DOSBox en sus ciclos por
  defecto, que es lo que casi nadie toca. Lord Fenton tocó los suyos.

Dato para `cadencia-asm`, que es de quien es la adjudicación: la razón 1,157 cae justo en el
bracket de U del altavoz — con `DELAY_UNIT_MS = 1,10` (el valor del oráculo que #72 sustituyó por
0,93 tras medir el WAV) las dos capturas concordantes dan **0,979 ± 0,013** y **1,018 ± 0,085**.
Es un INDICIO y no una medida de U, por lo mismo que acabo de decir: la velocidad de un DOSBox es
libre. La vía que sí adjudicaría es la de #167 —contar qué primitiva espera y a cuántos tics—, pero
esa misma nota ya dice que para `tone_sweep` **no la hay**: es un busy-wait calibrado a la CPU.

## 6. 🔴 El destello del CURANDERO: UNA ventana y UNA máscara, no tres (ficha abierta)

### 6.1 La DURACIÓN — dos capturas coinciden en que es la SEGUNDA ventana sola

`healerFlashWindowsMs()` deriva TRES ventanas de los pares de barridos de `SHOPPES:0x13b0`
(counts `0x57e4`, `0x9c40`, `0x4650`, ×2 cada uno): **1744 + 3100 + 1395 = 6239 ms**, y la piel
las pinta las tres seguidas. Medido:

| captura | testigo | medido | ÷ escala de su captura (§5) |
|---|---|---|---|
| Lord Fenton | ep06@253,3 y ep08@941,7 | 6133 · 6067 ms | **3123 · 3089** |
| alexdiener | ep05@2182,4 y ep10@2045,2 | 3567 · 3600 ms | **3083 · 3111** |

Las CUATRO medidas, de dos jugadores con escalas que difieren en 1,70×, caen en
**3083-3123 ms** — y `ms(2)+ms(3)` (la ventana del MEDIO, `0x9c40`×2) vale **3100 ms**. La
coincidencia es del 0,3 %. ⇒ **lo que se ve es la ventana 2 SOLA**; las ventanas 1 y 3 del port
son 3139 ms de destello que el testigo no tiene.

### 6.2 La MÁSCARA

`invert-flash.ts:HEALER_FLASH_MASKS = [4, 4^15, 4]` modela los estados ACUMULADOS de los TRES
`rect` XOR de `SHOPPES.OVL:0x13b0` / `0x13f2` / `0x1438` (con `set_color([g_unk_13ae]=4)` y
`set_color([g_unk_13b0]=0xF)` de por medio), derivados en ESTÁTICO de `INTRO.OVL:0x09f4/0x09fa`.

Medido en el testigo con un instrumento propio (cuantización de cada píxel del viewport al índice
EGA más cercano; la máscara del fotograma es la MODA de `base ^ actual`):

| testigo | máscaras observadas | fracción de píxeles |
|---|---|---|
| LF ep06@253,3 «I can heal thee for 65 gold. Yes» | **15 constante** los 6133 ms | 0,908 |
| LF ep08@941,7 (réplica) | **15 constante** los 6067 ms | 0,868 |
| **CONTROL** LF ep19@577,7 (WELL DONE del Altar, `CAST2:0x0c30` empuja `[g_unk_13b0]` y hace UN solo rect) | **15 constante** | 0,962 |

El control acredita el instrumento: donde el binario hace un rect suelto con `g_unk_13b0` la moda
sale 15, que es el valor derivado. En el curandero, en cambio, no aparece **ningún** fotograma con
máscara 4 ni 11 — dos fotogramas separados 3 s dentro de la ventana difieren en **5 píxeles**.

### 6.3 La hipótesis que reconcilia las dos medidas — y por qué se marca como HIPÓTESIS

Con `g_unk_13ae = 0` en vez de 4, los tres estados acumulados serían `p^0` (invisible),
`p^0^15 = p^15` (VISIBLE) y `p^15^15 = p^0` (invisible): **una sola ventana visible, la del medio,
con máscara 15** — que es exactamente lo medido en 6.1 y 6.2, por las dos vías y en dos capturas.

★★ Se marca como HIPÓTESIS justamente porque lo explica todo, y hay una objeción que NO resuelve:
los dos globales se escriben en el MISMO bloque básico (`INTRO.OVL:0x09f4/0x09fa`, único escritor
de cada uno en todo el corpus), así que `g_unk_13b0 = 0xF` —corroborado en vivo por el WELL DONE,
que empuja ese mismo global en `CAST2:0x0c30` y mide 15— implica `g_unk_13ae = 4`. Antes de tocar
`HEALER_FLASH_MASKS` hay que descartar: (a) que la rama que los testigos ejercitan («Heal») no
entre por `0x13b0`; (b) que `0x67e0` no sea `set_color` sino otra cosa (modo/plano de escritura),
lo que cambiaría qué hace un rect XOR con color 4; (c) que el estado de entrada no sea `p`.
Mientras tanto, lo que SÍ está medido y no depende de la explicación es 6.1: **la ventana visible
es una y dura 3100 ms de reloj del port, no 6239.**

## 7. Lo que el corpus NO cubre (negativa ACOTADA a este material)

- **Resurrección del CURANDERO**: el clip curado `yt/clips/healer-resurrect/` llega hasta
  «I can raise this unfortunate person from the dead for 249 gold. Wilt thou pay?» y el jugador
  responde **No** (`ocr-log.txt` verbatim). La transacción nunca ocurre ⇒ el clip **no es un
  testigo negativo** del destello de resurrección: la ceremonia no se disparó. Buscadas
  «raise this» en las 52 OCR-logs de LF y AD: **cero**; y las 7 transacciones de curandero que el
  censo levanta en los tres walkthroughs (3 LF + 4 alexdiener) son **todas** de la rama «Healing»
  («I can heal thee for N gold. Wilt thou pay? Yes» / «Receive now the Light!»). Las únicas
  «Resurrection!» del corpus son
  de pergamino In Mani Corp (índice 6), que en el asm **no llama a `0x0000`**
  (`CAST.OVL:0x12d8-0x12f7`, sin `call 0xffffc186`) — consistente con que no haya destello ahí.
- **Rama ORDAINED del santuario**: el clip `yt/clips/shrine-meditation/` (aulddragon part09,
  Espiritualidad, «...ordained! / 'Tis now thy sacred Quest...») cubre los 80 s de la ceremonia y
  el viewport **no se ilumina en ningún fotograma** (p95 − mediana = **0,5** niveles). De las 18
  meditaciones que el censo SÍ levanta (10 LF + 8 AD), **15 terminan en «A thunderous voice booms:
  WELL DONE!»** y **3 son DONACIONES aceptadas** («Offer how many hundredweights gold?»), que
  además duran más que el WELL DONE en el mismo testigo (LF 13,73-13,80 s frente a 12,80-12,93 s;
  AD 9,80 frente a 7,07-8,27) — consistente con que la donación añada su propio par de barridos
  (`shrine-donation`, CAST2 0x0bd0). Ninguna es ORDAINED. ⇒ la asimetría del port —inversión en el
  WELL DONE, no en el ORDAINED— queda CORROBORADA en vivo, y la duración extra de la donación
  también.
- **Terremoto — la negativa de #166 (G3) era de LORD FENTON, no del corpus.** Allí el único
  candidato está cortado por un corte de montaje, y de ahí «no hay terremoto careable en este
  corpus». Censadas las 49 OCR-logs de los otros dos walkthroughs, «EARTHQUAKE» aparece **32
  veces en 10 episodios**: alexdiener ep09 (3), ep16 (4), ep18 (4), ep20 (2), ep22 (5), ep23 (5),
  ep25 (3) y aulddragon part19 (3), part20 (2), part22 (1). Mi instrumento no los ve —el
  terremoto SACUDE la geometría, no invierte la paleta— así que no los he medido; lo que aporto es
  que el material **existe** y dónde está. Para `QUAKE_PULSES`/`QUAKE_PERIOD_MS` hace falta el
  instrumento de la clase GEOMETRÍA (el de la puerta lunar), no el de brillo.
- **Ceremonia final del Códice** y **secuencia de cierre**: siguen sin carear (#166 G4).
- **Pergamino Vas Lor (índice 0) y ~~Kal Xen Corp (índice 4)~~ In Quas Wis (índice 4)**: el asm
  los manda a `0x0000`, pero no hay ninguna lectura de esos pergaminos en los eventos de
  inversión censados. Sin testigo. (Kal Xen Corp es el pergamino **5** y **no** llama a
  `0x0000` por ninguna de sus dos ramas — §2.1.)

## 8. Lo que NO es una ceremonia de paleta aunque el detector la levante

- **«View a gem!»** (3 eventos LF, 2,0-2,3 s): no hay inversión — es el **mapa de gema** (fondo
  blanco) dibujado en el viewport, verificado abriendo los fotogramas. Su duración depende de
  cuándo el jugador pulsa tecla (2300 vs 1967 ms entre dos instancias del mismo episodio, 17 % de
  diferencia, frente al 1-4 % que replican las clases de conjuro). No es constante del juego.
- **3 falsos positivos** en LF (mar brillante ep16@1764,2 de 87,8 s; pantalla clara ep20@1137,4 de
  134,5 s; una cita de virtud ep21@1236,8). Coinciden con los 2 que #166 ya declaró, más uno.
