# Auditoría del render 3D de mazmorra (carril dungeon-ui, 2026-07-20)

Careo estructurado de NUESTRA vista first-person de mazmorra contra el ORIGINAL
(DOS/EGA), a raíz del testigo del usuario: «no se parece en nada a la realidad —
revisar por completo». Insumos: frames de `original/av-referencia/video-N-frames/`
(Deceit L1: f010 pasillo+escalera, f020 puerta lejana, f030 escalera+puerta) y
capturas propias por deep-link (Deceit, piel fiel+shader). Modelo del binario:
`re/notes/dnglook-raster-spec.md` + `re/notes/dungeon.md`.

## 1. Cómo pinta el ORIGINAL (spec 0x0D3E)

El original **NO vectoriza trapecios**: compone un **grid 11×11 de tile-ids**
(`dng_build_view` @ DNGLOOK 0x0D3E) donde la perspectiva (trapecios de pared) está
**horneada en los bitmaps** de un tileset de vista de mazmorra (ids 0x00–0x0A). El
builder sólo COLOCA qué tile-id va en cada celda por profundidad/facing, leyendo las
tablas de geometría `DS 0x2452–0x24C6` (near L/R + 16-tab lejanas por facing). El
buffer (`DS:0xAD14`, stride 0x20) se blitea tile-a-tile al viewport (8,8)-(0xB7,0xB7)
= 176×176 = **la misma ventana 11×11 del overworld**. Encima van *features*
(escaleras/cofres/fuentes) y *sprites* de monstruo por blit de tile/sprite.

Los tilesets de pared son **DNG1.16 / DNG2.16 / DNG3.16** — tres variantes reales:
`dng1`=oliva/marrón, `dng2`=rojo-ladrillo, `dng3`=gris-piedra. La **selección de
variante por-mazmorra** la da la tabla ptr `DNGLOOK 0x25F2` (cargada por 0x109E),
**aún sin derivar → Clase C** (spec §9). Deceit usa **gris (dng3)** (medido en f010/
f030).

Rasgos visibles del original (f010): pared de ladrillo gris que **LLENA el visor**
de borde a borde; el pasillo se lee como un túnel cuadrado — muros laterales altos
en el borde cercano que convergen a una abertura pequeña al fondo; **suelo con
moteado/stipple** (cuña inferior) y **techo oscuro con líneas de fuga** (cuña
superior); escalera/puerta horneadas como pieza; casi nada de negro salvo el punto
de fuga.

## 2. Cómo pinta el PORT (`skin/fiel/dungeon.ts::paintDungeon`)

Aproximación GEOMÉTRICA (spec §10 opción b): marcos anidados por profundidad
(`FRAME=[1.0,0.62,0.4,0.26,0.17]`), muros laterales como **trapecios** (fill plano
o, con `dungeonPack`, UNA rodaja del atlas estirada por clip), muro frontal como
rect, techo/suelo a **NEGRO** (`CEIL=FLOOR=EGA[0]`), features como primitivas de
canvas (líneas/rects), motes de antorcha aleatorios.

El pack (`dungeon-persp.png` + `.json`) SÍ es arte auténtico: rodajas verticales de
DNG{1,2,3}.16 (28 rects × 3 variantes). Pero `loadDungeonPack` **fijaba la variante
0 (dng1, oliva)** — de ahí las paredes NARANJA que el usuario vio, siendo Deceit
gris. Y el modelo de blit **estira UNA rodaja** por lado en todo el trapecio, que NO
reproduce la perspectiva horneada por-celda del original.

## 3. Tabla de divergencias (priorizada)

| # | Eje | Original | Port | Sev | Coste fix |
|---|-----|----------|------|-----|-----------|
| 1 | **Variante de textura** | Per-mazmorra vía g_dng_wall_variant (0x0e7b) → DNG{1,2,3}.16 | Hardcode dng1 (oliva) | **ALTA** (color erróneo en todo) | **BAJO** — ✅ CERRADO (tabla derivada + wired per-mazmorra, M1) |
| 2 | **Modelo de render** | Composición de TILES horneados (grid 11×11, tablas 0x2452–0x24C6) | Trapecios vector + 1 rodaja estirada por clip | **ALTA** (perspectiva «derretida», no calca) | ALTO — el «gordo» (reescritura) |
| 3 | **Suelo** | Moteado/stipple gris (cuña inferior) | Negro sólido | MED | MED (parte del sistema de tiles) |
| 4 | **Techo** | Oscuro con líneas de fuga (cuña superior) | Negro sólido | MED | MED (ídem) |
| 5 | **Relleno del visor** | Muros LLENAN el frame (túnel cuadrado) | Cuñas NEGRAS arriba/abajo (reloj de arena) | ALTA (consecuencia de #2/#3/#4) | ALTO (con #2) |
| 6 | **Proporciones de profundidad** | Anillos por geometría de tile horneada | `FRAME` scales arbitrarios | MED | MED (derivar de las tablas) |
| 7 | **Features (escalera/cofre/fuente/puerta)** | Tiles horneados del set DNG | Primitivas de canvas dibujadas a mano | MED | MED (blit de tile por id) |
| 8 | **Motes de antorcha** | Fisher-Yates de `0x40+facing·4` (jitter determinista de tiles) | 3 motes aleatorios | BAJA | BAJA |

## 4. Quick wins aplicados (batch 3)

- **#1 Variante default dng1→dng3 (gris)**: hace que Deceit (único careo disponible)
  pase de naranja-infiel a gris-correcto. Es el look canónico EGA y el arreglo más
  barato/alto-impacto. Per-mazmorra sigue Clase C (0x25F2).
- **Switches de auditoría**: `?dungpack=off` (placeholder geométrico gris plano) y
  `?dungvar=N` (0=oliva/1=rojo/2=gris) para carear en vivo durante la revisión.

Evidencia: `scratchpad/audit-3way.png` (original | dng3 gris | dng1 oliva). Tras el
fix, el COLOR/textura casan; lo que resta (#2/#5) es geométrico.

## 4b. Tabla 0x25F2 DERIVADA (M1 — cierra #1 al 100%)

`DNGLOOK 0x109E` carga el gráfico de muro indexando la tabla de punteros `DS:0x25F2`
por `g_dng_wall_variant` (`shl 1`; entradas = ptr a nombre de fichero en DATA.OVL):

```
0x25F2[0]=ITEMS.16  [1]=DNG1.16  [2]=DNG2.16  [3]=DNG3.16
```

(volcado: `xxd -s 0x2602 DATA.OVL` = `b512 be12 c612 ce12 …`; strings en 0x12c5). El
índice 0 (ITEMS.16) es el banco de *features* (cofres/etc); los muros usan 1/2/3.

**CORRECCIÓN (auditoría de cobertura, ítem mon16-corridor-sprites):** la lectura
anterior «[4..7]=MON0..3.16» era una MISATRIBUCIÓN por solape: la tabla de muros
de DNGLOOK tiene 4 entradas; lo que sigue en 0x25FA (fileoff 0x260A) es OTRA
tabla de 8 punteros = **MON0.16..MON7.16, los 8 bancos de sprite del MONSTRUO
ERRANTE de pasillo 3D**, que consume DUNGEON.OVL (no DNGLOOK): al armar el
errante tira `rand(0,7)` (0x0151-0x0158) → banco; atributos de las tablas DS
0x173C (14 15 16 17 18 19 1C 1B) y DS 0x1744 (60 A0 00 90 80 60 00 00); carga
perezosa `push word [bx*2+0x25FA]; call load` (0x01BC). Formato del contenedor
(derivado y verificado, extractor `parsers/monview.ts`): u16 count=6 + 6 pares
(u16 offImagen, u16 offMáscara); slots = 2 frames × 3 profundidades (24×66 /
16×25 / 8×6); imagen 4bpp packed + AND-mask 1bpp (bit 0 = sprite). Los 8 bancos
descomprimen a 2614 B. El extractor emite `dungeon-mon.png/json` (atlas mon0..7).
El SISTEMA errante (spawn/move/emboscada) sigue censado como no-portado; esto
deja registrado su banco gráfico (prerequisito).

`g_dng_wall_variant` lo fija `DUNGEON:0x0e7b-0x0ec4` por número de mazmorra
(`idx = g_location − 0x20`):

| loc | idx | mazmorra | variant | DNG | color | floor/ceil tile |
|-----|-----|----------|---------|-----|-------|-----------------|
| 33 | 1 | Deceit | 3 | DNG3 | gris | 0x4f / 0x45 |
| 34 | 2 | Despise | 1 | DNG1 | oliva | 0x4d / 0x05 |
| 35 | 3 | Destard | 1 | DNG1 | oliva | 0x4d / 0x05 |
| 36 | 4 | Wrong | 3 | DNG3 | gris | 0x4f / 0x45 |
| 37 | 5 | Covetous | 3 | DNG3 | gris | 0x4f / 0x45 |
| 38 | 6 | Shame | 2 | DNG2 | rojo | 0x4d / 0x05 |
| 39 | 7 | Hythloth | 2 | DNG2 | rojo | 0x4d / 0x05 |
| 40 | 8 | Doom | 1 | DNG1 | oliva | 0x4d / 0x05 |

Regla: `{1,4,5}→3`, `{6,7}→2`, else `→1`. Es EXACTAMENTE la `wallVariant()` que el
core ya tenía para los mensajes de muro especial 0xC (task E4-3) — confirmada aquí
contra el binario. **Wired** en el snapshot (`DungeonViewInfo.wallVariant`) + la piel
(carga las 3 variantes, elige por mazmorra). Deceit gris casa video-N f010; Despise
oliva / Shame rojo verificados en vivo. Los floor/ceil tiles (0x4f/0x45 vs 0x4d/0x05)
alimentan las cuñas moteadas de suelo/techo → insumo del M2.

## 6. Modelo de render REAL (M2 — reverse-engineered de DUNGEON.OVL)

CORRECCIÓN al §1: el `dnglook-raster-spec.md` describe un buffer LÓGICO 11×11 de
tile-ids (qué hay en cada celda), pero el DIBUJO del pasillo NO es un tileset 16×16.
Es **COMPOSICIÓN DE RODAJAS EN PERSPECTIVA**: las 28 imágenes de DNG{1,2,3}.16 (ancho
variable 8/16/24/32/56/80 × **alto 164**, `extractor/src/parsers/dngtiles.ts`
`parseDngView`) son piezas de pared pre-dibujadas que se blitean SIN estirar a una X
de pantalla fija por profundidad. Nuestro renderer estira 1 rodaja en un trapecio =
arquitectónicamente incorrecto.

### 6.1 Rutina de blit de pieza — `dng_blit_piece` @ DUNGEON:0x134A
Args `(pieceCode=bp+8, side=bp+6, depth=bp+4)`. `pieceCode` ≥ 0x1f → rama CERCANA
(tablas 0x2e7a/0x2e82), < 0x1f → rama LEJANA (0x2e62/0x2e72). Blitea la imagen del
gráfico de muro (`g_dng_wall_graphic` = handle de DNGn.16) por la primitiva de sprite
`0x8a2c/0x8b7c` en `(x = tabla[…], y = 0xe(14) o alto-tabla)`. Alto de pieza 164, Y
tope ≈ 14 (bajo la barra superior). Se llama **en pares** por pieza (borde near+far).

### 6.2 Tablas de geometría X (DATA.OVL, file = DS+0x10) — VOLCADAS
```
0x2e62: 10 28 48 58 98 78 68 60   (X pieza lejana, por profundidad 0..3 + …)
0x2e72: 38 48 50 58 98 78 68 60
0x2e7a: 98 78 68 60 0f 27 47 57   (X pieza cercana)
0x2e82: 0f 27 47 57 …
```
(px: 0x10=16, 0x28=40, 0x48=72, 0x58=88, …). Son las columnas de pantalla donde cae
cada rodaja según profundidad/lado.

### 6.3 Tablas de PIEZA (qué imagen por config) — VOLCADAS
```
0x2f16: 00 1f 00 1f 00 00 00 00
0x2f1e: 00 00 1f 1f 37 27 2f 3f
0x2f24: 2f 3f 00 00 ff 00 01 00
0x2f26: 00 00 ff 00 01 00 00 ff
```
El composer (DUNGEON:0x1900-0x1a60, 10 call-sites a 0x134A) indexa estas tablas por
profundidad (`bp+4`, `shl 1` para la X) y por si el vecino es muro (lee el mapa real
`g_dng_map` @ 0x595a, bit de pared) → elige pieceCode y blitea izq+der (pares) +
frente/puerta. Facing entra en la selección (0x11a0 switch, ya en §2 paso 6).

### 6.4 Plan de implementación (pasos, gate por nivel c/u)
1. **Extractor → pack por-variante**: `parseDngView(DNG{1,2,3})` → 28 rodajas × 3
   variantes a PNG/atlas (ya casi: `dungeon-persp.png` son estas rodajas; falta que
   el pack lleve alto/anchos nativos + índice, no rects estirables). Assets a rutas
   GITIGNORED.
2. **Reescribir `paintDungeon`**: por profundidad 0..3, leer celdas visibles del
   snapshot (`dv.cells`) para la config de pared (izq/der/frente), elegir pieceCode
   por las tablas 0x2f16/1e/24/26, blitear la rodaja nativa en `X=tabla-geo[depth]`,
   `Y≈14`, SIN estirar. Techo/suelo = cuñas de sus tiles (bb14/bb15 por variante,
   §4b) en vez de negro. Retirar los trapecios vectoriales.
3. **Features/sprites** (escalera/cofre/fuente/puerta/monstruo): blit desde ITEMS.16
   (handle 0xa9c4) por id (dnglook-raster-spec §4/§5), sustituyendo las primitivas.
4. **Pixel-diff** (M3): careo contra video-N (f010/f020/f030) por región del visor.

### 6.4b Catálogo de las 28 rodajas (dng3, verificado visual)
Render etiquetado de `parseDngView(DNG3)` (scratchpad/slices-dng3.png). Patrón: grupos
de 4 rodajas con anchos **24/32/16/8** = las 4 PROFUNDIDADES de una misma pieza:

| idx | ancho | pieza |
|-----|-------|-------|
| 0-3 | 24/32/16/8 | muro LATERAL liso (parallelogramo que recede), 4 profundidades |
| 4-7 | 24/32/16/8 | muro lateral con PUERTA lateral, 4 prof. |
| 8 | — | null |
| 9-11 | 56/24/8 | muro FRONTAL liso (dead-end), 3 prof. |
| 12 | 80 | muro frontal con ABERTURA central (pasillo continúa) |
| 13-15 | 56/24/8 | muro frontal con PUERTA cerrada de frente, 3 prof. |
| 16-19 | 24/32/16/8 | muro lateral variante 2 (rejilla/diagonal), 4 prof. |
| 20-23 | 24/32/16/8 | ALCOBA lateral / hueco con decorado, 4 prof. |
| 24 | — | null |
| 25-27 | — | remates/decorado lejano |

Los laterales se ESPEJAN para el lado derecho (el flag del primitivo de blit). El
ancho decreciente 24→8 = la misma pieza a mayor profundidad (más pequeña, más al
centro). Este catálogo + las tablas geo (X por profundidad) permiten el composer sin
adivinar. Falta cerrar el mapeo EXACTO pieceCode(tabla 0x2f16…)→idx-de-rodaja (el
primitivo 0x8a2c y el umbral 0x1f).

### 6.5 Riesgo/coste
El MODELO ya está mapeado (rutina de blit, tablas geo+pieza volcadas, composer
localizado). El coste está en (a) el orden EXACTO pieceCode→imagen (el ≥0x1f y los
codes 0x27/0x2f/0x37/0x3f vs 28 imágenes — el primitivo 0x8a2c mapea code→imagen, aún
por confirmar), (b) la selección por-config de las 10 call-sites, (c) pixel-diff. Es
una reescritura de VARIAS HORAS pero acotada y sin incógnitas de arquitectura.

## 7. Traza CERRADA de los 3 detalles finos (carril dungeon-composer, M2)

Los 3 huecos que §6.5 dejó «por confirmar» — resueltos del disasm
`re/disasm/DUNGEON.OVL.asm` (labels near-call FILE-relativos que MIENTEN; las
tablas 0x2e62… son offsets del **DS**, no del fichero OVL de 8016 B → viven en
DATA.OVL en `file = DS + 0x10`, verificado byte-a-byte).

### 7.1 `dng_blit_piece` @ 0x134A — args y ramas
Args (ret 6): `bp+8 = pieceCode`, `bp+6 = side`, `bp+4 = blitDepth`.
- `pieceCode ≥ 0x1f` → rama CERCANA (handle **0xa9c4** = banco de features/decor;
  imagen = `(pieceCode+1)>>1 − 16`).
- `pieceCode < 0x1f` → rama LEJANA (handle **0xa9c0** = `g_dng_wall_graphic` =
  DNGn.16; **imagen = pieceCode TAL CUAL** — se hace `push [bp+8]` sin transformar).

Las tablas de geometría son **WORD tables** (por eso el volcado del §6.2 mostraba
`10 00 28 00…`), indexadas por `(pieceCode&3)` (columna) y por `bp+4` (fila):
```
0x2e62  X lateral (screen px):  IZQ[dep]=[16,40,72,88]   DER[dep]=[152,120,104,96]
0x2e72  X cercana (a9c4):       [56,72,80,88]
0x2e7a  Y cercana:              [152,120,104,96, 15,39,71,87]  (0x2e82 = su fila 1)
0x2e80  BYTE front-base[kind]:  a=12 b=8 c=24 d=8 e=12 f=12
```

### 7.2 Item 1 — pieceCode → índice de rodaja (el «&3»)
El `&3` NO indexa la imagen: indexa la **columna X** de la tabla geo. La IMAGEN de
un tramo lejano = `pieceCode` directo. Y el `pieceCode` lo arman los dos drawers:
- **Laterales** `fn_1682` @ 0x1682: `pieceCode = depth + offset`, offset por vecino:
  muro(0xb)/secreta(0xd)→**0** (rodajas 0-3); broke(0xa)/puerta(0xe)/sala(0xf)→**4**
  (4-7, lateral con puerta); especial(0xc)→**0x14** (20-23, ALCOBA); abierto(<0xa)→
  **0x10** (16-19, pasaje lateral). `(depth+offset)&3 == depth` (offsets ≡0 mod4) →
  columna X = `SIDE_X[side][depth]`. Casa el catálogo §6.4b EXACTO.
- **Frontales** `fn_150a` @ 0x150a: `pieceCode = 0x2e80[kind] + depth`. Muro→8+dep
  (rodajas 9-11 dead-end 56/24/8), puerta/sala→12+dep (13-15), especial→24+dep (25-27).

### 7.3 Item 2 — 0x8a2c vs 0x8b7c (quién espeja) + override X=0x60
- **0x8b7c = blit NORMAL** (se usa cuando `blitDepth==0`).
- **0x8a2c = blit ESPEJADO** horizontal (se usa cuando `blitDepth!=0`).
- Ambos anclan X = **borde izquierdo** de la caja de la rodaja (el espejo voltea los
  píxeles DENTRO de `[X, X+w]`).
- **Lateral IZQ**: `fn_1682(side=0)` → blitDepth=0 → **8b7c normal** en `SIDE_X.left[dep]`.
- **Lateral DER**: `fn_1682(side=1)` → blitDepth=1 → **8a2c espejo** en `SIDE_X.right[dep]`
  (misma rodaja, píxeles volteados) → simetría del pasillo. = «los laterales se espejan».
- **Frontal** se dibuja en PAR: blit(blitDepth=0)=**8b7c normal** en `X=SIDE_X.left[(pc)&3]`
  (mitad IZQ, termina en 96) + blit(blitDepth=1)=**8a2c espejo** en `X=0x60=96` (mitad DER).
  El **override X=0x60** (0x134A:0x1372) salta sólo con `blitDepth!=0` y
  `(pc&0xf8)==8 || (pc&0xfc)==0x18` — exactamente los rangos frontales (base 8/12/24) →
  centra la mitad espejada del muro de fondo en 96. `SIDE_X.left[pc&3] + anchoRodaja == 96`
  por construcción (40+56, 72+24, 88+8).

### 7.4 Item 3 — cuñas de suelo/techo (NO hay negro)
Las 28 rodajas de DNG*.16 son **de altura completa 164** (blit a `Y=0xe=14`, cubren
Y 14..178 de los 176 del visor) y llevan el **suelo moteado y el techo HORNEADOS**
en el propio bitmap (visible en `scratchpad/slices-dng3-labeled.png`). Al componer
los 4 anillos laterales de cada lado ABUTAN sin hueco (IZQ 16→96, DER 96→176; anchos
24+32+16+8=80) → el visor queda LLENO de borde a borde y el suelo/techo salen de las
rodajas. NO hace falta relleno de cuña aparte; el único negro legítimo es el punto de
fuga más allá de la luz (`lightDepth`). Los tiles 0x4f/0x45 (§4b) son la base que el
original tira con 0x88d6/0x8a6c ANTES de las rodajas (centro lejano / pasajes), 2º
orden — cubierto por las rodajas en un pasillo amurallado.

### 7.5 Driver `dng_draw_view` @ 0x1a90 (orden de dibujo)
Marcha `si=0..3` (`cmp si,4`) desde la party por `fwd` (0x24d6/0x24de dx/dy):
por celda si llama `fn_150a(si)` (front: si `tile≥0xa0` dibuja muro de fondo y PARA)
y, si abierta, `fn_1682` IZQ+DER (vecinos perpendiculares 0x2f28/0x2f2c). Al terminar,
FEATURES de lejos-a-cerca (`fn_1952`, painter). Las features salen de ITEMS.16 (a9c4),
NO de DNG*.16 → quedan como primitivas (subsistema aparte, plan §6.4 paso 3).

## 8. Features NATIVAS de ITEMS.16 (carril dungeon-composer, §6.4 paso 3)

Las features (escalera/fuente/cofre) NO salen de DNG*.16 sino de **ITEMS.16** (banco
`a9c4`, rama CERCANA de `dng_blit_piece`). Formato CRACKEADO: mismo contenedor que
DNGn.16 PERO con **offsets de imagen de 16 bits** (no 32) — los u32 dan basura, los
u16 dan 20 frames limpios (`parseItemsView` en `extractor/parsers/dngtiles.ts`).
Primer u32 del fichero = longitud descomprimida (0x28ca=10442); tras el LZW:
`u16 count(=20)` + `count×u16` offset. Índice de color **0 = TRANSPARENTE** (sprite
overlay sobre el pasillo ya dibujado; el blit del kernel salta el color 0) → el atlas
`dungeon-feat.png` hornea alpha 0 en el índice 0 (a diferencia de las rodajas de muro).

Catálogo (verificado por render, `scratchpad/items-labeled.png`): grupos por tipo,
cada uno a profundidades con anchos 40/24/16/8:
```
0-7   ESCALERA  (40×80, 24×56, 16×24, 8×8 ; pares = 2º frame de animación)
8-15  FUENTE    (íd.)
16-19 COFRE     (40×24, 24×32 ; sólo 2 profundidades)
```
Mapeo de la piel (`featFrame` en dungeon.ts): la feature aparece a distancia si=1..3,
el frame más cercano (40) va en si=1: escalera=`0+2·(si−1)`, fuente=`8+…`, cofre=
`16+2·min(si−1,1)`. Blit centrado en X=96, apoyado en `FEAT_FLOOR_Y[si]`. Trampa y
campo mágico no tienen frame en ITEMS.16 → siguen primitivas.

RESIDUAL (Clase C, no bloquea): el frame EXACTO de animación (par impar), la
selección arriba/abajo de la escalera, y la posición sub-píxel por las tablas del
binario (`fn_1786` @0x1786 con 0x8a94 + tablas 0x2ea4/0x2ed4/0x2ef2) — la piel usa el
frame base centrado, fiel en forma y escala, aproximado en anim.
**→ CERRADO/CORREGIDO en §8b (carril feat-anim). El §8 de arriba tiene DOS premisas
falsas: (a) el catálogo 0-7/8-15/16-19 está mal agrupado y (b) "pares impares = 2º
frame de animación" NO es cierto (los impares son BASURA del extractor). Ver §8b.**
**→ Y el «formato crackeado» TAMBIÉN era falso: el contenedor son 20 PARES
(imagen, máscara-AND) — ni los impares eran basura ni el color 0 es la
transparencia. Modelo definitivo en §8e (careo decor-mazmorra 2026-07-25).**

## 8b. Features: modelo REAL derivado del binario (carril feat-anim)

Traza completa del blit de feature (`fn_1952` @DUNGEON:0x1952 + `dng_blit_piece`
@0x134A + tablas DATA.OVL DS+0x10, volcadas byte-a-byte) + careo del arte extraído.
Corrige las dos premisas falsas del §8 y cablea la posición fiel.

### 8b.1 Selector `fn_1952` @0x1952 (painter de features, lejos→cerca)
Lee el tile del mapa en la celda (`dng_get_tile` @0x10dc) y AÍSLA el **nibble ALTO**
= `kind` (1..7 = las features; dict §0.2 de dungeon.md). Por kind arma hasta DOS
bloques de pieza y los blitea en PAR (normal @0x8b7c + espejado @0x8a2c):
- **bloque 1** (`0x2f16[kind]`, con **side=1**): pieceCode = `0x2f16[kind] + prof·2`.
- **bloque 2** (`0x2f1e[kind]`, con **side=0**): pieceCode = `0x2f1e[kind] + prof·2`.
- si `kind==5` (fuente) → ADEMÁS `fn_1786(prof, animCounter)` (chorro, §8b.4).

Tablas (DATA.OVL, index por kind 0..7):
```
0x2f16 = [00,1f,00,1f,00,00,00,00]   (block1, side=1)
0x2f1e = [00,00,1f,1f,37,27,2f,3f]   (block2, side=0)
```
Reparto real: LadderUp(1)=block1 0x1f; LadderDown(2)=block2 0x1f; LadderUpDown(3)=
ambos 0x1f; Chest(4)=0x37; Fountain(5)=0x27; Trap(6)=0x2f; OpenChest(7)=0x3f.

### 8b.2 Imagen de ITEMS.16 = `((pieceCode+1)>>1) − 16` (`dng_blit_piece` 0x13c6)
Con `pieceCode = base + prof·2` da la IMAGEN-binaria por (feature, prof):
| feature | base | imágenes-binarias (prof 0..3) |
|---------|------|-------------------------------|
| escalera | 0x1f | 0,1,2,3 |
| fuente | 0x27 | 4,5,6,7 |
| trampa | 0x2f | 8,9,10,11 |
| cofre | 0x37 | 12,13,14,15 |
| cofre abierto | 0x3f | 16,17,18,19 |

**Pero el ATLAS EXTRAÍDO NO casa esa numeración.** Render etiquetado
(`scratchpad/items-labeled.png`, careo COM por columna): el ARTE real vive en los
índices **PARES** del pack y los IMPARES son **basura** (offsets u16 intermedios que
no apuntan a imagen válida):
```
pack 0/2/4/6   = ESCALERA (40×80,24×56,16×24,8×8, 4 prof.)   [impares 1/3/5/7 basura]
pack 8/10/12/14= FUENTE   (íd.)                              [impares basura]
pack 16/18     = COFRE    (40×24, 24×32, 2 prof.)            [impares basura]
```
⇒ **La premisa "par impar = 2º frame de animación" del §8 es FALSA.** El `featFrame`
de la piel (escalera `2·k`, fuente `8+2·k`, cofre `16+2·min(k,1)`, k=prof-1) YA
elegía los pares correctos — la SELECCIÓN de frame era fiel; lo infiel era la
POSICIÓN (§8b.3). Trampa/cofre-abierto no tienen arte válido en el pack → primitiva.

### 8b.3 Posición = COMPOSICIÓN ESPEJADA + Y por tipo (CABLEADO)
Los frames son **MEDIAS features** (COM volcado al borde interno). `dng_blit_piece`
las blitea DOS veces: mitad IZQ normal con borde izq en `0x2e72[k]` = `[56,72,80,88]`
(= `CENTER_X − ancho`, idéntico al muro de fondo), + mitad DER ESPEJADA anclada en
`X=0x60=96`. La Y del tope depende del TIPO (side + umbral img<8/≥8 en 0x134A):
| feature | side | Y tope (tabla) | geometría |
|---------|------|----------------|-----------|
| Escalera-arriba | 1 | `0x2e82[k]`=[15,39,71,87] | BASE fija y=95, encoge al horizonte (suelo→techo) |
| Escalera-abajo, Fuente | 0 | `0x60`=96 const | TOPE en horizonte, crece hacia abajo |
| Cofre, Cofre-abierto | 0 | `0x2e7a[k]`=[152,120,104,96] | objeto bajo, se apoya cerca del borde inferior |

Cableado en `skin/fiel/dungeon.ts` (`featYTop` + composición espejada como
`drawFront`). El código previo centraba UN medio-frame en `CENTER_X−w/2` y lo apoyaba
en `FEAT_FLOOR_Y[si]=166..` → media feature descentrada y demasiado baja. Verificado
en navegador visible (`docs/verdicts/feat-anim/harness-composite.png`): escaleras
simétricas completas encogiendo al horizonte, fuente completa (pila+chorro+pedestal),
cofre bajo, escalera-abajo hundiéndose — todo casa la estructura de f010.

### 8b.4 Animación = CHORRO de fuente (INCÓGNITA acotada, NO cableada)
**→ CORREGIDO en §8e: `g_unk_13b2` = COLOR (DS:0x13b2=1), no handle de banco; el
chorro es 100% procedural (sin sprite que extraer).**
La ÚNICA feature que anima es la **fuente** (kind 5), y NO por frames-par-impar sino
por un **subsistema de partículas** `fn_1786` @0x1786: dibuja ~8 gotas + remate con
la primitiva `0x8a94`, posiciones por profundidad en `0x2ea4`(prof0,stride16)/
`0x2ed4`(prof1,·10)/`0x2ef2`(prof2,·8)/`0x2f0a`(prof3), y el SPRITE de gota vía
`0x88a0` (handle `g_unk_13b2`, banco compartido — NO ITEMS.16). El **reloj** es un
contador `[0x2f26]` que cicla **0→1→2→0** e incrementa UNA vez por redibujo de vista
(`fn_1952` con prof==0, i.e. por cada `dng_draw_view` @0x1a90) — **por refresco de
vista, NO por turno**. Gate por `g_unk_52c8` (0/3 = sin offset).
**Fuera de alcance de este carril**: exige extraer el sprite de gota `g_unk_13b2` y
reproducir el composite de partículas (multi-hora, "gordo"). La fuente base del pack
(img 8/10/12) YA lleva un chorro HORNEADO estático → queda fiel en forma, sin el
titileo animado de gotas. Tablas volcadas arriba para un carril futuro.

## 8c. CORRECCIÓN de la posición del par (carril dungeon3d-fixpass)

Testigo del usuario: «escalera DOBLE». La premisa media-feature de §8b.3 es CORRECTA
(cada frame es media escalera: un raíl a x≈0.45·w + travesaños hacia dentro; verificado
zoom `scratchpad/item0-zoom.png` + análisis offset/tamaño del contenedor: ranuras PARES
size==gap = imagen real, IMPARES solapan = padding basura). Pero las POSICIONES de §8b.3
(normal en `0x2e72[k]`=`CENTER−w`, espejo en `X=96`) SEPARAN las dos mitades: raíles a
`74` y `118` (≈0.9·w = 44 px), con hueco al centro → se ven DOS medias escaleras
(«doble»). Careo del binario mal interpretado: esas X son del muro de FONDO (medias
rodajas que abutan borde-con-borde), no de las features (que se FUSIONAN al centro).

FIX (`skin/fiel/dungeon.ts` `drawContents`): par ESPEJADO FUSIONADO con solape `w/2` —
normal con raíl en `CENTER−0.75·w`, espejo con raíl en `CENTER−0.25·w` → 2 raíles a
`CENTER±0.3·w` (sep 0.6·w) con travesaños continuos = UNA escalera. Barrido de solape
(0/20/32/40) careado contra `f030`: **overlap w/2 casa la separación de raíles del
original** (0/=split doble, 32+/=demasiado junto). `featYTop` (Y por tipo) se conserva.
Verificado en navegador (Deceit gris + Despise oliva): escalera de 2 raíles centrada,
sin doble, casando f030. Test: `paintDungeon` con featPack = EXACTAMENTE 2 blits.

**→ §8c SUPERADO (careo decor-mazmorra wf_8648a9bf + re-disasm 2026-07-25, ver §8e):
la fusión con solape w/2 era una FABRICACIÓN COMPENSATORIA. El binario sí ABUTA las
mitades (normal en `0x2e72[si]`=96−w @0x13ee, espejo en 0x60 @0x13e6 — la MISMA rama
feature de `dng_blit_piece`, no la del muro de fondo); el «escalera doble» que motivó
§8c era el síntoma del off-by-one de profundidad (arte de 40 px en el anillo de 24:
imagen `si−1` dibujada a distancia `si`). Con imagen = imgBase+si el par abutted da
la separación de raíles de f030. El barrido de solapes «casaba» porque comparaba el
arte equivocado.**

## 8e. MODELO DEFINITIVO de features (careo decor-mazmorra, 2026-07-25) — CABLEADO

Derivación instrucción a instrucción (`fn_1952` @0x1952 + `dng_blit_piece` @0x134A
rama pieceCode≥0x1f), implementada en `dungeon.ts::featureBlits` (puro, testeado):

- **ITEMS.16 son 20 PARES (offImagen, offMáscara-AND) u16** — tabla `2+i·4`/`+2`,
  como MON*.16 (el parse u16-suelto de §8 leía el 50% y los «impares basura» eran
  las MÁSCARAS + los offsets pares corridos). Imágenes reales: 0-3 escalera, 4-7
  fuente, **8-11 TRAMPA, 12-15 COFRE cerrado, 16-19 COFRE ABIERTO** (el port
  pintaba el cofre con arte de trampa). Máscara 1bpp MSB-first; transparencia =
  bit 1 (horneada en el alpha del atlas; NADA de keying color-0 — el interior
  negro del cofre abierto es opaco).
- **imagen = imgBase[kind] + si** (si=0..3): pieceCode = base[kind] + si·2,
  imagen = (pieceCode+1)>>1 − 16. Bases (DATA.OVL DS+0x10, byte por kind):
  `0x2f16` = bloque VOLTEADO-V (sólo escalera-arriba: kinds 1 y 3 = 0x1f) y
  `0x2f1e` = bloque normal (down/kind3=0x1f, cofre=0x37→12, fuente=0x27→4,
  trampa=0x2f→8, cofre-abierto=0x3f→16). LadderUpDown = AMBOS bloques.
- **Par ABUTTED**: normal en `0x2e72[si]`=[56,72,80,88]=96−w, espejo-H en 0x60.
- **Y** (@0x13fa-0x1428): bloque volteado → `0x2e82[si]`=[15,39,71,87] (base fija
  y=95, placa-trampilla ARRIBA — careo p19-0720/f030); img≥8 → `0x2e7a[si]`=
  [152,120,104,96]; img<8 side=0 → 0x60=96. El 5º arg de 0x8b7c/0x8a2c es VFLIP
  (la rama de muros pasa 0; la de features pasa el side de fn_1952).
- **si=0 INCLUSIVE**: el driver 0x1a90 llama fn_1952 hasta la celda pisada (de
  pie sobre la escalera se ve la img 0 de 40×80 — f001/f010).
- **Trampa gateada**: fn_1952 @0x197b sólo la dibuja con (tile&7)==0.
- **kind 8 (campo)**: subsistema de chispas `0x127e` (rand por tablas 0x2e42/
  0x2e4a/0x2e52/0x2e5a, colores [0x13ae..0x13b6]+8) — NO cableado, primitiva.

CORRECCIÓN a §8b.4: **`g_unk_13b2` NO es un handle de banco — es un COLOR**
(cuatro variables de PALETA, volcadas en t#57: DS:0x13ae = 2, DS:0x13b2 = 1 azul EGA,
DS:0x13b4 = 1, DS:0x13b6 = 2 — la paleta del subsistema procedural 0x127e/0x145c/fn_1786;
consumidores COMBAT/COMSUBS/DUNGEON/TOWN). El chorro de la fuente
`fn_1786` es 100% procedural (píxeles `0x8a94` con [0x13b2]/+8 por tablas
0x2ea4/0x2ed4/0x2ef2/0x2f0a) → NO exige extraer sprite alguno (mucho más barato
que lo presupuestado en §8b.4; sigue como ticket).

La DECORACIÓN procedural de los muros 0xC (goteo de estalactita DNG1 + destello
del esqueleto DNG3, máquina 0x145c) está derivada y cableada en
`re/notes/dungeon-decor-mazmorra.md` + `skin/fiel/dungeon-decor.ts`.

## 8d. Vista TOROIDAL — borde de mapa (carril dungeon3d-fixpass)

Testigo del usuario: VACÍO NEGRO al mirar hacia el borde 8×8 (deceit-07 cross-W).
La mazmorra es un TORO: el MOVIMIENTO envuelve por eje — `dungeon.ts` `step()`
`nx=(pos.x+dx+N)%N` (cita **DUNGEON:0x057a** `or ax,ax;jge;mov 7` = x−1→7 / **0x0583**
`cmp 7;jle;mov 0` = x8→0), y `dissolveFacingField` idéntico. `cellAt` devuelve WALL en
OOB pero es fallback: el movimiento envuelve ANTES, nunca le pasa OOB (confirmado por
ch18, que cruzó bordes en verde). El compositor del binario lee el mapa con `&7`.

Bug: `coreview.dungeonView.add()` SALTABA celdas OOB (`cx<0…`) → la celda envuelta no
entraba al snapshot → el compositor rompía la marcha a negro en el borde. FIX (ruling
del lead, opción a = envolver la VISTA): `add()` guarda la celda bajo la clave MARCHADA
(cx,cy pueden salir de 0..7, igual que el rayo) pero lee el TILE de `((cx%N)+N)%N` →
el pasillo CONTINÚA por el borde hasta el muro envuelto, sin agujero negro y sin tocar
el core (el movimiento ya envolvía). Verificado en navegador: deceit-07/11 + despise-07
= corredor toroidal, cero vacío negro.

Escalera ARRIBA vs ABAJO (§8b/8c): MISMA imagen de ITEMS.16 (image=depth), la Y las
distingue — arriba=pieza `0x2f16`/side=1 → `0x2e82`=[15,39,71,87] (sube por el techo),
abajo=`0x2f1e`/side=0 → `0x60`=96 (horizonte, se hunde). Ya cableado en `featYTop`.

## 9. Verdict M3 — pixel-diff contra frames estáticos (carril dungeon-composer)

Careo del viewport del compositor contra los frames ESTÁTICOS del original
(`original/av-referencia/video-N-frames/`, Deceit L1) con `game/tools/pixeldiff`
(región `viewport` [8,8]-[183,183], modo `hist` = similitud de histograma de paleta
EGA, orden-independiente → tolera diferencia de posición/animación; umbral 0.75).

| escena | port | original | viewport hist |
|--------|------|----------|---------------|
| pasillo recto | Deceit (composer) | f010 | **0.877** PASS |
| puerta de frente | Deceit (composer) | f030 | **0.872** PASS |
| escalera a prof. 2 | Deceit (composer) | f010 | **0.867** PASS |
| **baseline placeholder** (`?dungpack=off`, trapecios grises planos) | Deceit | f010 | **0.781** |

**El compositor de rodajas sube la similitud +0.09/+0.10** sobre el placeholder
geométrico (0.78→0.88): el ladrillo, el moteado de suelo y las líneas de fuga del
techo casan la distribución de color EGA del original. El careo VISUAL lado-a-lado
(`scratchpad/pd-f010/diff.png`) confirma textura/paleta idénticas (el compositor
blitea las MISMAS rodajas extraídas). El techo del ~0.88 lo pone (a) el desajuste de
profundidad de escena (imposible casar la posición exacta del frame de vídeo) y (b)
los artefactos de captura del .mov, NO infidelidad del render.

Las 2 regiones FAIL del comparador son AJENAS al compositor: `panel_stats`
(presence: party distinta — Avatar/Shamino/Iolo vs Elwood/Iolo/Gorn del vídeo) y
`border_rule` (color: la regla del marco idx15 blanco vs idx7 del vídeo — decisión de
chrome pre-existente, `DEFAULT_FRAME_COLORS.border`, no de mazmorra).
RESUELTO (carril chrome-border): `border_rule` = FALSO POSITIVO. idx15 BLANCO es fiel —
live-read del DS del original `[0x13b0]=0x0F` (lote-D-witnesses.md §5) + captura limpia
del emulador (60416 px #ffffff exactos, 0 grises); el "idx7" del .mov es tinte
NTSC/composite (~[238,244,246] azulado) que el ajuste-a-EGA-cercano colapsa a gris.

## 5. (histórico) plan previo — SUPERADO por §6

El plan §5 asumía un tileset 16×16 (lectura gruesa del spec §1). El §6 lo corrige: es
composición de rodajas. Se conserva §4b (variante) y el pixel-diff (M3) como válidos.
