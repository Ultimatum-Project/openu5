# Las cuatro rutas de `cmd_xit` que escriben PILA SIN INICIALIZAR en el +7 — y qué ES el +7

Ficha #273 (cabo del §6 de [xit-esquife-270.md](xit-esquife-270.md)). Tres preguntas, las
tres respondidas aquí: (1) ¿las cuatro rutas escriben de verdad pila sin inicializar, y qué
valor concreto acaba escrito? (2) ¿qué ES el campo +7 del objeto — «esquifes» (#231) o
«enlace con centinela 0xFF» (`frontera-infer-acta.md` §Fase 3)? (3) ¿diverge el port de
forma observable? Derivación ESTÁTICA sobre `re/disasm/{CMDS,COMSUBS,MAINOUT,SJOG}.OVL.asm`
y `ULTIMA.EXE.asm`, con la cadena de despacho resuelta por `dispatch_table`/`verify_cites`
(nunca a ojo — familia #110/#81, y este caso tiene control positivo, §2).

## 1. Las cuatro rutas, verificadas cuerpo a cuerpo

`cmd_xit` = CMDS.OVL `0x0EB4-0x102E` (marco: `sub sp,8` en 0x0EB7 — **no limpia**; locals
`[bp-2]` tile, `[bp-4]` ranura, `[bp-6]` tile bajo el party, `[bp-8]` esquifes). El único
escritor de `[bp-8]` en toda la rutina es **0x0FD1** (`mov [bp-8],al`), alcanzable SOLO
desde las tres ramas de la fragata (0x0FB5 todos / 0x0FCC+`dec` N−1 / 0x0FEC→0x0FB5).
La cola común 0x0FF4 lo escribe SIEMPRE al campo +7 del objeto emitido
(0x1020-0x1023: `mov al,[bp-8]` / `mov [bx+0x5C61],al`, bx=ranura·8). Llegan a la cola sin
pasar por 0x0FD1:

| ruta | camino | `[bp-2]` (tile del objeto) | condición |
|---|---|---|---|
| A alfombra | 0x0F20 → 0x0F38 → 0x0F43 → 0x0FF4 | 0x1B literal (0x0F3F) | tierra ortogonal (0x73E) **o** suelo pisable a pie (0x0F2B: `0x6CCC(0x1C,[bp-6])`) |
| B caballo | 0x0F60 → 0x0F6C → 0x0F43 → 0x0FF4 | tile−2 (0x0F6A) | ninguna |
| C esquife→tierra | 0x0F72 → 0x0F90 → 0x0F6C(sin el −2) → 0x0F43 → 0x0FF4 | tile (0x0F97) | tierra ortogonal y `[bp-6]&0xFE != 0x6A` |
| D default de clase | 0x0F11 → 0x0FF4 | **TAMPOCO escrito** | clase ∉ {0x10,0x14,0x1C,0x20,0x24,0x28} |

Que ninguna llamada propia pueda tapar el hueco es aritmética de marco (§2): todas las
llamadas de `cmd_xit` (print 0x58D0, 0x73E, 0x6CCC, 0x8482, y en la cola 0x7964/0x7AF4)
corren con `sp ≤ S−14`, y `[bp-8] = S−12` queda por encima. **Pila sin inicializar
VERIFICADA en las cuatro.**

La ruta D además emite `[bp-2]` sin escribir. Alcanzabilidad: exige `g_transport_tile` de
clase 0x18 o ≥0x2C; los escritores de `g_transport_tile` vistos en este careo (board
0x0875/0x0890/0x0930, xit 0x0F43/0x0FB0/0x0FC7/0x0FE7, Yell ±4 sobre 0x20/0x24) solo
producen {0x10-0x13, 0x14, 0x1C, 0x20-0x2B} ⇒ **inalcanzable salvo corrupción** (censo de
escritores parcial, no exhaustivo — banda declarada, no cierro universal).

## 2. DE DÓNDE sale la basura: el marco del CARGADOR DE OVERLAYS (como el caso 0xEC)

Cadena de despacho, resuelta con herramienta acreditada y no a ojo:

- MAINOUT 0x0BFF-0x0C00: `push tecla / call` → kernel **0x3178** (`verify_cites.resolve`,
  base MAINOUT = 0x81D0 — banda propia, no la 0xBF80 de CMDS).
- kernel 0x3178 = despachador ASCII. Rama 'X' (0x34FA→0x3456): `mov ax,0xA280 / push /
  call 0x1850` (el eco «Xit») y `call 0x806A`.
- **Control positivo**: `dispatch_table.stubs()[0x806A] = Stub(overlay CMDS.OVL,
  entry_linear 0xCE34)` y `0xCE34 − near_call_base(CMDS) 0xBF80 = 0x0EB4` = `cmd_xit`.
  Cuadra al byte.

El stub es el formato PLINK86 de 12 bytes ya derivado en
[0xec-basura-de-pila-origen.md](0xec-basura-de-pila-origen.md) §1: `lcall 0x72E:0x2EC`
(asegura el overlay) + `ljmp 0:0xCE34`. Aritmética de pila, con `S` = `sp` del despachador
en el `call 0x806A`:

| paso | sp | escribe |
|---|---|---|
| `call 0x806A` (near) | S−2 | retorno a 0x3460 en S−2 |
| stub: `lcall 0x72E:0x2EC` | S−6 | CS en S−4, IP(=stub+5) en S−6; **el cargador corre con marcos en S−8 y más abajo** |
| cargador `retf` | S−2 | — |
| `ljmp` (no empuja) → `cmd_xit: push bp` | S−4 | bp = S−4 |
| `sub sp,8` | S−12 | `[bp-2]`=S−6 · `[bp-4]`=S−8 · `[bp-6]`=S−10 · **`[bp-8]`=S−12** |
| `push si` | S−14 | las llamadas propias quedan en S−16↓ |

⇒ **`[bp-8] = S−12` cae DENTRO de la región que acaba de usar el cargador PLINK86** (y
antes que él, el print del eco). El mismo veredicto que el §2 del caso 0xEC: la basura no
es aleatoria — es «un byte concreto de la pila, escrito por lo último que pasó por ahí», y
lo último es el cargador. **El byte es el MISMO para las cuatro rutas** (ninguna toca
S−12 antes de 0x1020). Heredo también la hipótesis del §3 de esa nota, marcada igual:
el cargador tiene camino corto (overlay residente) y camino de disco ⇒ **probablemente
bimodal** según si CMDS estaba residente; no trazo el interior del cargador y NO lo afirmo.

★ Regalo de la misma aritmética: en la ruta D, `[bp-2] = S−6` = el byte bajo del IP de
retorno far del stub = low(0x806A+5) = **0x6F, determinista** — el `retf` lo pop-ea pero
nadie lo reescribe (la ruta D no llama nada antes de la cola, y 0x7964 corre en S−16↓).
Si la ruta D fuera alcanzable, aparcaría un tile 0x6F.

## 3. La contradicción de corpus: el +7 es POLIMÓRFICO por clase — las dos notas eran ciertas de SU sujeto

Censo COMPLETO de accesos a `0x5C61`/`[bx+0x5C61]`/`[si+0x5C61]` en los 28 disasm
(`grep 0x5c61|char_anim_states+7`): **18 sitios en 6 ficheros**. El lector define al campo:

| semántica | clase de objeto | sitios |
|---|---|---|
| **contador de ESQUIFES** | fragata amarrada (tile 0x24-0x27) y ranura 0 (= `g_skiffs`, #231) | escritor `cmd_xit` 0x1023 (ramas fragata); **lector `cmd_board` 0x08FE→0x0936 SOLO en su rama clase 0x24** (0x08BD; esquife 0x08AB y alfombra 0x087C NO leen +7); lector MAINOUT 0x10DD (chequeo de hundimiento, global) |
| **contador de deriva por viento** | nave a vela SUELTA (clase 0x2C, gate 0x19FE-0x1A05 `[bp-6]&0xFC==0x2C`) | MAINOUT 0x1A39-0x1A48 (`inc` + módulo contra tabla 0x2BF6 por viento) |
| **enlace de ranura, centinela 0xFF** | actores de small-map/combate | asignador kernel (init 0xFF, `frontera-infer-acta` §Fase 3; limpieza de huérfanos 0x677A; otro escritor 0x6A87); COMSUBS 0x0520 (lo LEE como índice y re-indexa la tabla, cota 0x1F en 0x0539) y 0x0D16 (escribe la ranura recién asignada); SJOG 0x0FFA (=0 en mapas <0x80) y 0x100F (=0x20 «sin enlace» en mazmorra) |

Las tres semánticas **no colisionan**: las separa la clase del tile (+0) del objeto y el
contexto de mapa. ⇒ `trama-nativa-238-231.md` §3 (esquifes) y `frontera-infer-acta.md`
§Fase 3 (enlace 0xFF) eran **las dos ciertas, cada una de su sujeto** — la familia exacta
de «la-misma-frase-rancia-en-otro-sujeto-puede-ser-cierta». Lo que SÍ estaba mal es la
frase del §6 de `xit-esquife-270.md` «escribir basura ahí es escribir en un campo de
enlace»: para un objeto de transporte del sobremundo el +7 no es enlace (corregida allí,
tachado-documentado, citando esta nota).

## 4. ¿Quién LEE la basura? Nadie en el sobremundo — pero VIAJA en el .GAM

Con el censo de §3, el +7 de un **caballo/alfombra/esquife aparcados** no tiene NINGÚN
lector en el binario mientras el objeto exista en el sobremundo:

- re-abordarlos no lo lee (`cmd_board` solo lee +7 en la rama fragata — 0x08FE está tras
  el `cmp al,0x24` de 0x08BD);
- el contador de deriva exige clase 0x2C (los aparcados son 0x10/0x11, 0x1B, 0x28-0x2B);
- los sitios de enlace son de small-map/combate.

Lo único que lo observa es el **fichero de save**: la tabla DS 0x5C5A viaja verbatim en la
ventana del `.GAM` (offset `0x6B4 + ranura·8 + 7`, `save-window-writer.md`), así que un
caballo aparcado deja su byte de basura en disco. Lo mismo pasa con el **+5**: la cola
0x100F empuja `[0x5C5F]` (= `g_hull` global) para TODAS las rutas, de modo que el caballo
aparcado se lleva el casco residual de la última fragata (residuo de GLOBAL, determinista
por historia — distinto del residuo de PILA del +7).

▷ HIPÓTESIS (no adjudicada aquí): el «+7=6 en 11/11 saves de interior SIN DETERMINAR» de
`trama-nativa-238-231.md` §3 huele a esta misma familia — residuo determinista de otro
escritor de marco, no un campo con significado. Queda como hipótesis marcada; adjudicarla
pide su propia derivación.

Y un refinamiento a un cabo declarado de esa misma nota (§3, cadena fragata→caballo→a
pie): «el binario dejaría 0» solo vale para un caballo **nunca aparcado** (el colocador de
SHOPPES 0x0957-0x0961 escribe 0). Un caballo aparcado una vez lleva basura en +7 — y de
todas formas el board de caballo **no pisa `g_skiffs`** (§3: solo la rama fragata lo hace),
así que la premisa «el board del caballo pisa los globales» tampoco era exacta.
(El cabo quedó CERRADO por #378, `board-epilogo-378.md`: epílogo 0x093E derivado y la
cadena medida en vivo — CONSERVA; también g_hull resultó exclusivo de la rama fragata.)

## 5. Careo del port — declaración razonada, SIN fix de conducta

El port no tiene equivalente del +7 para los aparcados no-navales: caballo/alfombra viven
como override de tile (`exitVehicle` → `setMapOverride`, `game.ts:4741-4746`) sin registro;
la fragata amarrada lleva `skiffs` REALES (fix de #270/#272, `game.ts:4768-4780`). Al
exportar `.GAM`, `writeNativeWorldObjects` (`saveNative.ts`) escribe `+7 = 0` en caballos.

**Adjudicación: NO es divergencia observable.** Ningún lector del binario distingue el
byte (§4); la única diferencia es el byte del fichero, y ahí el original escribe **pila
sin inicializar** — imitar basura no es calcar una regla, es fabricar una. El port escribe
el único valor especificado por un colocador derivado (SHOPPES: 0). Se corrige la
justificación del comentario de `writeNativeWorldObjects` («eso es lo que escribe su
colocador») que era incompleta: el caballo tiene DOS colocadores — SHOPPES (0) y
`cmd_xit` (basura de cargador + `g_hull` residual) — y el port sigue al primero a
propósito, citando esta nota.

## 6. Medición empírica: probe versionado, boot del oráculo BLOQUEADO (documentado)

`re/tools/xit_pila_probe.py` implementa el experimento (fuerza `g_transport_tile`, pulsa
X, diff de la tabla 0x5C5A antes/después; T1 primer X de la sesión vs T2 repetido vs T3
tras otro overlay — el diseño del §4 del caso 0xEC, que allí quedó en spec). **No se pudo
correr**: la navegación del título no llega al mundo en este host — **CUATRO intentos con
CUATRO mecanismos** (19-08): (1) `oracle.send_keys_until_main_menu()` de serie; (2) guion
propio con esperas largas y diagnóstico por tecla; (3) bucle de 15 min con
Enter/espacio/'j' cíclicos; (4) `AUTOTYPE` del autoexec (teclas a ritmo de host, sin pty).
Síntoma idéntico en los cuatro: teclas CONSUMIDAS una a una (buffer BIOS vaciado), video
0D constante, y el roster de SAVED.GAM **nunca** aparece en los 192K desde la base de
carga (~10 min/intento). Es el mecanismo de navegación del título, no el probe (el arnés
de camp_probe usa el mismo y funcionaba — huele a regresión ambiental del host/dosbox-x,
no adjudicada aquí): queda el probe listo y el bloqueo declarado — el mismo estado honesto
en que el §4 del 0xEC dejó su experimento. Si el oráculo revive, las tres corridas
adjudican la bimodalidad del §2 en minutos.

## 7. Colaterales DECLARADOS (fuera del alcance de #273, sin tocar)

1. **El port PIERDE el esquife al desembarcar**: `exitTransport` case `TILE_SKIFF`
   (`transport.ts:785-792`) devuelve solo `transportTile: TILE_FOOT` — ni `dropTile` ni
   objeto — donde el binario aparca el esquife (ruta C, tile 0x28-0x2B; la tabla de
   `get-alfombra-346.md` §1 ya documentaba el lado binario). Familia del f11 de #264/#270.
   **PORTADO (carril fix-esquife, 19-08)**: `dropTile = transport` TAL CUAL (0x0F97 +
   0x0F9A `jmp 0x0F6C`, después del `sub al,2` del caballo); guarda
   `game/tests/xit-esquife-alfombra-273.test.ts`. El careo destapó una pieza ADYACENTE:
   el (B)oard del esquife hacía `worldTile + 2` cuando la rama skiff de `cmd_board`
   (0x08B2 `mov al,[bp-0xa]` → 0x08B5 `jmp 0x0875`) SALTA el `add al,2` de 0x0873
   (exclusivo del caballo) — sin ese fix, re-abordar el esquife aparcado 0x2A/0x2B daba
   0x2C/0x2D (fuera de la clase). Corregido en el mismo carril, misma guarda.
2. **Segunda vía de aceptación de la alfombra**: el binario permite X-it de alfombra SIN
   tierra ortogonal si el suelo bajo el party es pisable a pie (0x0F2B-0x0F36,
   `0x6CCC(0x1C,[bp-6])`); el port solo mira `landNearby` (`transport.ts:743`). Divergencia
   de aceptación (p. ej. isla de 1 tile). **PORTADO (carril fix-esquife, 19-08)**:
   `walkableUnder` como 5º parámetro de `exitTransport`, con el MISMO predicado del port
   que ya modela 0x73E (`tileInfo().walkable`) — simetría verificada en el .asm: cada
   ortogonal de 0x73E se cierra con la MISMA primitiva `0x6CCC(0x1C, tile)`
   (CMDS 0x0788:0x07A6-0x07AD), y `0x6CCC` = kernel ULTIMA.EXE 0x2C4C (resuelto con
   `verify_cites.resolve`, base near-call CMDS 0xBF80; control positivo: el stub 0x806A →
   entry 0xCE34 = 0x0EB4 cuadra al byte). Guarda: mismo fichero de tests.
3. El refinamiento del cabo fragata→caballo→a pie de `trama-nativa-238-231.md` §3 (§4 de
   esta nota), anotado allí mismo con puntero aquí.
