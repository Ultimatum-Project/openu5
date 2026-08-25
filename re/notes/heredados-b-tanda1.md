# heredados-b · TANDA 1 — la familia GEM de LOOKOBJ, entera

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`. Releva a `heredados-168`.
Contador `verified_inherited_without_cite`: **128 → 116**.

> Offset y nombre en celdas separadas a propósito (heredados-168-tanda1 §2.3).
> Verificada con `re/tools/seed_diff.py`: 0 sembradas, 0 cambiadas.

Trece filas de un mismo subsistema: el renderizador de la gema de sobremundo/pueblo.
Doce quedan **ACREDITADAS**; una queda **REFUTADA** y no recibe `verified`.

---

## 1. Las 13

| # | rutina | nombre | veredicto |
|---|---|---|---|
| 1 | `LOOKOBJ.OVL:0xa9c` | `gem_cell_origin` | ACREDITADA — ★ el eje queda fijado por CADENA, no por analogía |
| 2 | `LOOKOBJ.OVL:0xabe` | `gem_glyph_4dots` | ACREDITADA — es también el fondo que reusa la categoría 16 |
| 3 | `LOOKOBJ.OVL:0xb60` | `gem_glyph_2strokes` | ACREDITADA — las dos filas extremas, a lo ancho |
| 4 | `LOOKOBJ.OVL:0xb98` | `gem_glyph_2lines` | ACREDITADA — la figura es un 2×2 centrado |
| 5 | `LOOKOBJ.OVL:0xbd0` | `gem_glyph_box` | ACREDITADA — marco hueco; es la 3 más dos verticales |
| 6 | `LOOKOBJ.OVL:0xc36` | `gem_glyph_lines_yellow` | ACREDITADA, ★ amarillo incluido — pero hizo falta el productor |
| 7 | `LOOKOBJ.OVL:0xc9c` | `gem_glyph_lines_points` | ACREDITADA — ★ sus dos LÍNEAS eran el hueco declarado del barrido gfx |
| 8 | `LOOKOBJ.OVL:0xcf4` | `gem_glyph_dithered_terrain` | ACREDITADA — ★★ y de aquí sale el defecto del port |
| 9 | `LOOKOBJ.OVL:0xdda` | `gem_glyph_2pts` | ACREDITADA la base; **`_adapter` RETIRADO** |
| 10 | `LOOKOBJ.OVL:0xe16` | `gem_glyph_4pts` | ACREDITADA — 4 puntos en 2 colores |
| 11 | `LOOKOBJ.OVL:0xe7a` | `gem_glyph_wall_outline_door` | ★★ **REFUTADA** — es el cruce de CAMINO; renombre propuesto |
| 12 | `LOOKOBJ.OVL:0xf7e` | `draw_gem_map_tile_dispatcher` | ACREDITADA — despacho HÍBRIDO, tabla decodificada por programa |
| 13 | `LOOKOBJ.OVL:0x10fc` | `gem_view_32x32` | ACREDITADA — ★ el parpadeo no lleva reloj |

La derivación por fila vive en `re/ledger/frontier-manual.json` (`note: heredados-b-tanda1`).

---

## 2. ★★ UN DEFECTO REAL DEL PORT: la ribera del río sale INVERTIDA

`skin/fiel/gemmap-overworld.ts::drawCoast` decide el color de cada cuadrante así:

```ts
const isBank = isRiver && (bits & (0x08 >> q)) !== 0;   // bit PUESTO = ribera
```

El binario decide lo contrario. En el bucle de `0x0d3e` (la rutina 8 de la tabla):

```
0d46: test word ptr [bp - 0x12], ax      ; ax = máscara 8,4,2,1
0d49: jne  0xd52                          ; bit PUESTO -> se va a la OTRA rama
0d4b: mov  ax, word ptr [bp - 0x10]       ; bit CLARO  -> [g_unk_13b4]+8 = verde claro
```

`test` pone ZF=1 cuando el AND da cero, y `jne` salta con ZF=0: **el bit PUESTO se va al
azul y el bit CLARO pinta el verde**. La polaridad del port está del revés.

**El control que había que hacer, hecho.** Dos errores podrían cancelarse si el port
hubiera transcrito la tabla complementada. No es el caso: los 16 bytes de `DATA.OVL`
`0x3832` son `05 06 04 01 03 06 05 07 07 0e 00 00 01 02 08 04` y `COAST_NIBBLE` del port
es **byte a byte idéntica** (comprobado contra el fichero, no contra una nota). El
complemento daría otra cosa. Los dos errores no se cancelan: **la gema pinta ribera donde
va agua y agua donde va ribera**, en los 14 tiles de río de la categoría 10 (`0x60`-`0x69`
y `0x6c`-`0x6f`).

*Corroboración interna de que la tabla se indexa por el nibble bajo:* las únicas dos
entradas a cero son la `a` y la `b`, y `0x6a` y `0x6b` son precisamente los dos tiles de la
familia que **no** son categoría 10. Las dos entradas inalcanzables son las dos nulas.

Ticket para el lead — el arreglo es una negación, pero **no lo aplico yo**: mi superficie es
el ledger, y el port tiene dueño.

---

## 3. ★★ Por qué hay una rama por MODO DE VÍDEO: es un choque de máscara, no un gusto

Cuatro sitios de esta familia repiten literalmente el mismo predicado de 12 bytes —
`cmp [g_unk_52c8],0` / `je` / `cmp [g_unk_52c8],3` / `jne` — y eligen `[g_unk_13b6]` en los
modos 0 y 3, o `[g_unk_13b2]+8` en el resto: dentro del bucle de la 8, y en las rutinas 9,
10 y en la rama de la categoría 14 del despachador. Ni el corpus ni el port dicen por qué.

**Lo dice la aritmética de la paleta.** El bloque que fija los colores está en
`INTRO.OVL` `0x09ee`-`0x0a17`, y está **guardado**: `0x09e0`-`0x09ec`, que salta a `0x0a1a` si
`g_unk_52c8` vale 0 o 3, así que en esos dos modos las asignaciones no corren y los
registros conservan los estáticos de `DATA.OVL`. Leídos del fichero:

| registro | estático de `DATA.OVL` | asignado por `INTRO.OVL` (modos ∉ {0,3}) |
|---|---|---|
| `g_unk_13ae` | 2 | 4 (rojo) |
| `g_unk_13b0` | 3 | 15 (blanco) |
| `g_unk_13b2` | 1 | 1 (azul) |
| `g_unk_13b4` | 1 | 2 (verde) |
| `g_unk_13b6` | 2 | 5 |
| `g_unk_13b8` | 3 | 14 (amarillo) |

Los estáticos son **1, 2 y 3**: exactamente los tres índices no-fondo de una paleta de
cuatro colores. Y `set_color` enmascara con `&3` en 4 colores
(`kernel-render-sweep.md:116`). Entonces, en los modos 0 y 3:

- vegetación = `g_unk_13b4` + 8 = 9, y 9 `&3` = **1**
- agua por la vía normal = `g_unk_13b2` + 8 = 9, y 9 `&3` = **1** ← *el mismo color*
- agua por la vía alternativa = `g_unk_13b6` = 2, y 2 `&3` = **2** ← distinto

⇒ La rama existe porque **sumar 8 para «aclarar» un color se pierde bajo la máscara de 4
colores y funde agua con vegetación**. El binario esquiva el choque usando un registro cuyo
valor CRUDO ya es distinto. En EGA no hace falta (10 y 9 ya difieren) y por eso allí se usa
la vía normal. Mecanismo derivado, no conjeturado.

**Corolario, y es una corrección a un comentario del port.**
`gemmap-overworld.ts:29-31` dice que «los estáticos de `DATA.OVL` son placeholders
sobreescritos». Los estáticos **no** son placeholders: son la paleta operativa de los modos
0 y 3, precisamente porque el bloque que los sobreescribiría está guardado. El port declara
apuntar a EGA, así que no es un defecto de render — es un comentario que afirma de más.

---

## 4. ★★ El triaje tiene una CUARTA ceguera, y es la más cara de todas

Las 13 filas entraron a mi cola como pobres: 11 con señal AMPLIA de 0 a 6 hits (todos ruido
al abrirlos), 2 en el bucket SIN RASTRO. La señal ESTRECHA fue **cero en doce de trece**.

Y sin embargo el corpus ya las tenía leídas. `barrido-gfx-consumidores.md` §4.3 se titula
«H — Gema de overworld/pueblo (`0x0a9c`…`0x10fc`) — **FIEL**» y trae siete comprobaciones
de coordenadas contra el port.

**Por qué el triaje no puede verlo: la nota cita la familia como un RANGO** y sólo nombra
los dos extremos. Un índice que busca offsets literales jamás casará `0x0abe` con
«`0x0a9c`…`0x10fc`». Las cegueras conocidas van así:

| variante | ejemplo | quién la encontró |
|---|---|---|
| la nota cita la dirección DS, nunca el offset de rutina | `shops.md` con `SHOPPES3` | heredados-168-tanda1 §2.1 |
| `game/src` no se escanea (cubre el 52%) | — | heredados-168-tanda1 §2.2 |
| la nota se LLAMA como el overlay y por eso la prosa nunca repite el nombre | `lookobj.md` §`0x10fc` | esta tanda |
| ★ la nota cita un **RANGO** y sólo escribe los extremos | `barrido-gfx-consumidores.md` §4.3 | esta tanda |

La cuarta es la peor por rendimiento: **una sola línea de prosa cubría doce filas**, y las
doce salieron puntuadas como si nadie las hubiera mirado nunca. El género «la lectura
existía y nadie la cruzó» va por **veinte** apariciones (ocho contadas al cerrar la tanda 2,
más estas doce).

**Recomendación concreta** (barata, para quien toque el triaje): al indexar una nota,
expandir todo par de offsets del mismo fichero unidos por `…`, `..` o `-` a **todas** las
filas del ledger que caigan dentro del rango. Con las 13 de esta tanda hay un caso de prueba
con respuesta conocida.

**⚠ Y ahora la medida, que rebaja esta sección — ver §9.** Escribí arriba que ésta era «la
más cara de todas» antes de medirla. La medí después, y **no lo es**: el canal RANGO aporta
5 filas nuevas de 116 (≈4%). La recomendación sigue en pie porque es barata y correcta; el
superlativo, no. Lo dejo escrito y corregido en vez de borrarlo, porque el error es del
género que este carril persigue.

---

## 5. Lo que el cuerpo dio y no estaba escrito en ningún sitio

**(a) El despacho es HÍBRIDO, y su tabla estaba impresa como basura.** La rutina 12
resuelve las categorías 0..7 con `jmp word ptr cs:[bx-0x4cd2]` y las 8..0x10 con una cadena
de `cmp`. El desplazamiento sin signo `0xb32e` menos la base `0xa290` da fichero `0x109e` —
y ahí el disasm imprime `test byte ptr [bp+di-0x4db6], dh`, porque son datos. Las ocho words
decodificadas caen **las ocho** en etiquetas reales del propio cuerpo, comprobado contra el
conjunto de offsets del disasm (misma técnica y mismo criterio que heredados-168-tanda4 con
`npc_ai_step`: por programa, no a mano).

**(b) Hay una rama MUERTA, y que el port no la tenga es CORRECTO.** Tras las 17 categorías
el despachador compara con **0x5A** y manda esa al mismo relleno que la 7. El histograma
completo de los 256 bytes de la tabla de categorías sólo contiene valores 0..16 ⇒ con los
datos que se distribuyen, esa rama es inalcanzable. Es el caso contrario al habitual: el
port omite algo y el binario respalda la omisión.

**(c) El parpadeo del marcador de party no lleva reloj.** En la rutina 13, el bucle
`0x118a`-`0x11bb` sondea tecla (CS 0x1B38) y repinta la celda de la party **cada cuatro
sondeos sin tecla**. La cadencia va por cuenta de sondeos, no por tiempo: en una máquina más
rápida, parpadea más rápido. Cualquier calco con un temporizador en milisegundos es una
aproximación, no un calco.

**(d) Dos escrituras muertas y tres cursores para un array.** En la rutina 8, `[bp-0xa]=4` y
`[bp-0xc]=dx` no se leen jamás (y `dx` ya vale 0 al escribirla, tras los cuatro `sar`).
Y `di`, `si` y `[bp-0x18]` recorren **el mismo** array de 4 words en paralelo — no son tres
arrays, aunque leídos sueltos lo parezcan.

**(e) El eje, fijado por cadena completa.** No lo di por analogía con nadie: la rutina 13
resta `g_chunk_origin_x` a `[bp+6]` y `g_chunk_origin_y` a `[bp+4]`; su bucle suma la
variable interior a la X y la exterior a la Y; el despachador reenvía las dos coordenadas en
ese orden; y la rutina 1 hace `origen = arg*4 + 32` en cada eje. **No hay transposición.**
Lo verifico y lo escribo porque este proyecto ya se comió una (#70) por rellenar el hueco
con una suposición razonable.

---

## 6. Globales

**Sin entrada en `globals.json`**, y las tres son tablas estáticas load-bearing:

| DS | qué es |
|---|---|
| `0x1D1A` | tabla de 256 B tile → categoría de gema (17 categorías) |
| `0x3822` | 16 B, trama de ribera por nibble bajo del tile de río |
| ~~`0x3812`~~ | ~~máscara de conexión de camino, indexada por el tile ENTERO~~ — **RETIRADA, ver abajo** |

Con las diecisiete de heredados-168 dije **veinte** (tarjeta #98) — pero **una de las tres
mías no era una global**, así que aporté **dos**, no tres. El recuento vivo lo lleva #98 y
no lo fijo aquí:

> **⚠ CORRECCIÓN 2026-07-28 (aviso del carril globals-98, acta `globals-98-acta.md`).**
> Pedí de alta `0x3812` como si fuese la base de la tabla de aristas. **No lo es: es un
> DESPLAZAMIENTO SESGADO** y esa dirección no se lee jamás. Lo he vuelto a comprobar por
> mi cuenta, en Python sobre los `.asm` —que son symlinks y `grep -r` se los salta en
> silencio—: el literal aparece **una sola vez** en todo el desensamblado, en la
> instrucción que leí, y el índice es el tile restringido a `0x20`..`0x26`, así que las
> direcciones efectivas son `0x3832`..`0x3838`. **El array real son 7 bytes en
> `DS 0x3832`**, y su base **no aparece como literal en ninguna parte** — que es
> justamente por lo que un censo de literales no la ve.
>
> **Y el daño que evita el aviso:** yo describía la tabla como «indexada por el tile
> entero», o sea con dominio 0..255; darla de alta así, con base `0x3812` y 256 B de
> extensión, **se habría tragado la tabla de ribera vecina**, que vive en `0x3822` y sí
> es una base real (su índice empieza en 0). Las otras dos de esta tabla resisten: en las
> dos el índice arranca en cero, así que la base escrita es la base de verdad.
>
> Lección, y es del acervo: **antes de dar de alta una global, comprobar si el índice
> puede valer 0.** Si no puede, la dirección escrita no es la base, y la extensión que
> uno deduzca del dominio aparente invadirá lo que haya al lado.

**Y una anchura mal declarada:** `g_cmb_scratch_x` y `g_cmb_scratch_y` (`0x5876` y `0x5878`)
constan con `size=1` y la rutina 1 las escribe con `mov word ptr` (`0x0aa9` y `0x0ab6`).
Están separadas justo 2 B, así que la separación ya lo insinuaba y ahora la instrucción lo
prueba. Misma familia que #68. Matiz honesto: `lookobj.md:66` las llama «un BYTE de scratch
de combate», y para su uso en combate es cierto; lo que falla es la anchura del slot.
La misma sospecha cae sobre los seis registros de color `0x13AE`-`0x13BA`, todos con
`size=1`, separados 2 B y leídos con `push word ptr`.

---

## 7. Estado

**13 filas adjudicadas** en una tanda; contador **128 → 116**.
12 acreditadas · 1 nombre recortado (ya contado entre las 12) · 1 **refutada** que sigue
contando, a la espera del renombre.

**PENDIENTE DE DECISIÓN DEL LEAD.** La fila `LOOKOBJ.OVL:0xe7a`, cuyo nombre actual es
`gem_glyph_wall_outline_door`: el cuerpo no tiene muro, ni contorno, ni puerta: dibuja un centro relleno y muñones hacia
los lados conectados, con la máscara de 4 bits que le da `DS 0x3812`. Los 7 tiles de la
categoría son `0x20`-`0x26` y sus máscaras son vertical, horizontal, los cuatro codos y el
cruce — una red de caminos completa. Propongo **`gem_glyph_road_junction`**: el mecanismo lo
fija el cuerpo, y el término «camino» lo fijan el juego de tiles, el corpus
(`barrido-gfx-consumidores.md:198`) y el port. Precedente exacto: heredados-168-tanda5
ejecutó los tres renombres que su tanda 2 dejó refutados. Con el visto bueno, esa fila baja
el contador a 115.

**Quedan 116** filas: 16 del bucket FUERTE, 74 DÉBIL, 26 SIN RASTRO — **reparto medido
antes de escribir esta acta, y sin fecha, que es un defecto: ver heredados-b-tanda2 §5.**
El triaje clasifica contra el corpus, así que cada acta mueve filas de bucket; esta misma
movió una. La cola sigue como en
heredados-168-tanda3 §3, con una **corrección de inventario**: aquella lista de «fuertes»
omitía `INTRO.OVL:0x2024` (108 B), que es el más pequeño de todos y por tanto el primero que
tocaba.

---

## 8. Cola nueva

1. **`DNGLOOK.OVL:0x6a8`**, el gem de MAZMORRA, es el hermano de esta familia y quedó fuera
   de la tanda: mismo papel, otro overlay, y `gemmap.ts` le declara una Clase-C que el
   barrido gfx (§5, punto I) ya dejó derivada. Candidato natural a tanda 2.
2. **`LOOKOBJ.OVL:0xb28`** — `barrido-gfx-consumidores.md:479` lo dio por código muerto;
   esta lectura lo corrobora por otra vía (el despachador no lo alcanza por ninguna de sus
   18 ramas, y la rutina anterior cierra con `ret` en `0x0b27`).
3. **`INTRO.OVL` `0x09ee`** merece fila propia: es el inicializador de la paleta de la
   gema y su guarda es la que explica §3.

---

## 9. ★ Medí mi propia recomendación, y me rebaja a mí

Construí el canal RANGO de §4 y lo pasé por las 116. Tres resultados, en orden de
importancia decreciente y de vergüenza creciente.

**(a) El instrumento suspendió su control positivo: 0 de 13.** La primera versión no
encontraba ninguna de las trece filas que YO ACABABA DE ADJUDICAR y de las que sabía la
respuesta. Antes de mirar por qué, ya había producido una salida de aspecto respetable: 17
filas «con cobertura», diez de ellas de TALK apuntando todas a la misma línea. Esas diez
eran **falsos positivos al 100%**, y por un motivo que da risa: la línea citada es un rango
de BLCKTHRN, mi reconocedor de fichero no veía «BLCKTHRN» porque va escrito sin sufijo, y el
contexto se arrastraba de líneas anteriores. Es decir, **reprodujo el `ctx` pegajoso de la
tarjeta #84 dentro del instrumento escrito para cazar otro defecto**. Si no llego a exigirle
el control positivo, esas 17 filas entran en el acta como cola priorizada.

**(b) La causa, medida:** el corpus escribe el nombre del overlay **desnudo 2375 veces y con
`.OVL` 1209** — casi 2 a 1. Mi regex pedía el sufijo. Corregido eso y prohibido el contexto
arrastrado (el fichero tiene que estar en LA MISMA LÍNEA que el rango), el control pasa a
**13 de 13**.

**(c) Y con el instrumento ya sano, la cifra honesta desinfla §4:** de las 116 filas, el
canal RANGO cubre **6**, y una de ellas es `0x0e7a`, que ya adjudiqué en esta tanda ⇒ **5
filas nuevas, un 4%**. La recomendación de §4 sigue siendo correcta y barata, pero **no es
«la más cara de todas»**: eso lo escribí antes de medirlo. Lo que hizo espectacular al caso
de esta tanda es que `barrido-gfx-consumidores.md` es una nota inusualmente bien organizada,
con una tabla de familias por rango; el corpus no suele estar así.

**Lo que NO es, y conviene decirlo para que nadie salga a arreglarlo:** esto **no** acusa a
`triage_heredados.py`. Fui a comprobar si su señal estrecha sufría el mismo problema del
sufijo y **no lo sufre**: su `stem()` compara ya contra el nombre desnudo. El defecto del
sufijo era exclusivamente mío. Lo único que al triaje le falta de verdad es la expansión de
rangos, y vale un 4%.

Las tres reglas que dejo, por si sirven más que la cifra:

1. **Un barrido nuevo no vale nada hasta verlo acertar un caso cuya respuesta ya conoces.**
   Aquí el caso de control estaba gratis: las filas de la propia tanda.
2. **Sospecha del racimo.** Diez filas del mismo overlay apuntando a la misma línea no es una
   veta, es un bug de atribución.
3. **Mide antes de poner el superlativo.** §4 decía «la más cara de todas» y era un 4%.
