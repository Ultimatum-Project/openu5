# ACTA #113 — ¿guarda el original los cambios de TERRENO de un small map?

**VEREDICTO: NO. El terreno de small map es VOLÁTIL** — ni se guarda ni sobrevive a salir.
La persistencia de la lava del TPK en `mapOverrides` era, por tanto, una **DIVERGENCIA
REAL y alcanzable**, ahora medida y arreglada en esta rama.

El modelo se derivó ENTERO del binario (vía 1 del encargo). **No hizo falta oráculo.**

---

## 1. El modelo, en tres hechos

### 1.1 La ventana del save es `[0x55A6, 0x6606)`

INTRO.OVL la lee y la escribe COMPLETA, con la misma base y el mismo tamaño:

| qué | dónde | argumentos |
|---|---|---|
| LEER | INTRO.OVL 0x0eb4 | `"SAVED.GAM"`, dest `0x55a6`, len `0x1060`, off 0 |
| ESCRIBIR | INTRO.OVL 0x1dfd | `"SAVED.GAM"`, src `0x55a6`, len `0x1060` |

`0x1060` = 4192 B = el tamaño exacto de `SAVED.GAM`/`INIT.GAM` (ya establecido en
`dungeon-map-buffers.md §1`). Los nombres salen de DATA.OVL: DS 0x364b y DS 0x31e6 →
fileoff +0x10 → ambos `"SAVED.GAM"`.

### 1.2 El búfer de terreno de small map (DS 0x6608) queda FUERA de esa ventana

`0x6608 > 0x6605`. Está **dos bytes pasada la cola** de la ventana. ⇒ **el terreno de
pueblo/castillo/keep NO viaja en el save, nunca.**

★ El contraste que lo hace un experimento y no una coincidencia está **dentro del propio
TPK**: la rama de Stonegate toca DOS búferes, y caen a lados distintos de la frontera.

| lo que borra el TPK | dirección | ¿dentro de `[0x55A6, 0x6606)`? | ⇒ |
|---|---|---|---|
| terreno 32×32 a lava (TOWN 0x0fd6) | DS 0x6608 | **NO** (`0x1062` > `0x1060`) | volátil |
| tabla de objetos/actores (TOWN 0x0fea) | DS 0x5c5a | **SÍ** (`0x6B4` < `0x1060`) | persiste |

O sea: del mismo TPK, el borrado de objetos SÍ se guarda y el de terreno NO. La frontera
no es una interpretación mía: es aritmética sobre la ventana que el propio binario lee y
escribe.

### 1.3 Y además se REESCRIBE de disco en cada entrada — TOWN.OVL 0x0408

```
042a-0431  si = g_location ; bx = (si-1) >> 3 << 1
043a       ax = [bx + 0x2652]        ; ← FICHERO, tabla de 4 entradas
0441-044f  record = [si + 0x1e19] + planta
0452       si la planta es >= 0x80 (sotano) le resta 0x100
045c-046f  read_file_block(fichero, 0x6608, 0x400, record << 10)
```

La tabla DS 0x2652, leída de DATA.OVL, tiene exactamente 4 entradas válidas:
`TOWNE.DAT` · `DWELLING.DAT` · `CASTLE.DAT` · `KEEP.DAT` (los índices 4-7 son basura, y
`(loc-1)>>3` sólo produce 0..3 para las localizaciones 1..32 — consistente).

Para **Stonegate (loc 29)**: `(29-1)>>3` = **3** ⇒ `KEEP.DAT`, y `[0x1e19+29]` = **6** ⇒
record 6 + planta. `KEEP.DAT` mide 16384 B = 16 records de `0x400`, así que el 6 existe.

**Cross-check que no busqué y salió solo:** el «recarga» de la caída por trampilla ya
estaba derivado en el lote #54 como `TOWN 0x1044 call 0x408` — es ESTA misma rutina. El
cargador que yo estaba identificando es el que el trapdoor ya usaba para bajar de planta.
⇒ el terreno se relee también **al cambiar de planta**, no sólo al entrar.

Las dos llamadas de lectura (TOWN 0x0408 y INTRO 0x0eb4) resuelven a la **misma** rutina
residente — ULTIMA.EXE 0x256E — con `re/tools/routine_census.resolve_near_call` (bases
TOWN `0x81d0`, INTRO `0x81c0`). La de escritura es otra: ULTIMA.EXE 0x25D8.

---

## 2. Y el port ya lo sabía en dos sitios — pero no en el tercero

Esto no era terreno virgen: `main` ya llevaba el modelo escrito, aplicado, dos veces.

- `loadSmallMap` resetea puertas «*el mapa se re-lee fresco, así que una puerta "abierta"
  no se filtra entre entradas*».
- `harpsichordPassageOpen` es RUNTIME por-sesión y su comentario dice literalmente «*el
  original lo conmuta en el buffer de mapa runtime, que se recarga de CASTLE.DAT al
  reentrar*» — que es exactamente §1.3, ya derivado por el carril de TOWN lote 7.

El TPK era el caso que se salió del patrón: escribía a `mapOverrides`, la capa
**PERSISTIDA** (`saveNative.ts:564`), y nadie la limpiaba.

## 3. El bug, MEDIDO por la vía pública (no argumentado)

Sonda por `enter()` → `loadSmallMap`, antes del fix:

```
tras TPK        (10,10) = 143   (LAVA)
tras refuge     loc = 17 floor = 1      (castillo de LB)
enter()      -> ["message","map-changed"]
tras RE-ENTRAR  loc = 29   (10,10) = 143      ← la lava SIGUE
mapOverrides count = 1024
```

**1024 overrides persistidos** y el keep servido entero como tile de daño al volver. El
original habría releído `KEEP.DAT` record 6.

## 4. El fix

`volatileTerrainWipe` — un campo de instancia (NO de `GameState`, así que no se serializa),
misma familia que `harpsichordPassageOpen`:

- lo **pone** `stonegateLavaWipe` en vez de escribir 1024 entradas persistidas;
- lo **leen** `activeMap.tileAt` y `mapTileWithOverrides`, por encima de base y de
  `mapOverrides` (el memset pisa el búfer entero, así que manda mientras dure);
- lo **borra** `loadSmallMap`, junto al reset de puertas y por la misma cita.

Modela `DS:0x6608` con sus dos propiedades: no viaja en el save, y muere al recargar.

**Por qué NO toqué `mapOverrides` en general** (el peligro que marcaba el encargo, ahora
con el motivo exacto): esa capa **CONFUNDE DOS CANALES** que en el original son distintos y
caen a lados opuestos de la frontera de §1.2 — terreno (volátil, DS 0x6608) y objetos
(persistidos, DS 0x5c5a / la capa `.OOL`). De sus ~14 call-sites, unos son terreno (campo
arado, escombro de cañón, suelo de ladrillo, puertas) y otros son objeto (caballo soltado,
botín tirado, objeto empujado). Un clear indiscriminado en `loadSmallMap` **borraría los de
objeto, que en el original SÍ persisten**. Por eso el fix es un canal nuevo y separado, y no
un barrido de la capa existente.

## 5. Cola que dejo ABIERTA, con el modelo ya puesto

**Clasificar los ~14 call-sites de `setMapOverride` en TERRENO vs OBJETO** y mover los de
terreno al canal volátil. Ahora es trabajo mecánico —el criterio está derivado en §1.2— pero
es una tarjeta propia: toca puertas forzadas, campos arados y cofres en todo el juego, y
cada call-site quiere su detector. Los sospechosos de TERRENO que vi de pasada:
`game.ts` líneas 2678/2708 (puerta secreta revelada/sellada), 3104 (puerta destrabada),
3659 (escombro de cañón), 4077/4098 (suelo de ladrillo), 4139 (arado).

**NO adjudicado**: si el canal de objetos del port (`worldObjects` + los `mapOverrides`
object-like) duplica o contradice la capa `.OOL` del original. Ni lo miré.

## 6. Gates

Exits leídos **sin pipe**.

| gate | resultado |
|---|---|
| `vitest run` (suite de unidad ENTERA) | **281 ficheros · 3602 passed, 1 skipped** · EXIT 0 |
| `tsc --noEmit` | EXIT 0 |
| failing-first del detector nuevo | ROJO antes del fix: `expected 143 to be 5` |

**FAILING-FIRST de verdad**: el detector de §3 se escribió y se vio ROJO con los otros 13
del fichero en verde, ANTES de tocar `game.ts`. Y a mitad de camino cazó un fallo MÍO: tras
el fix daba `expected 140 to be 5` — 140 = `0x8C` = la trampilla, porque yo había puesto la
aserción sobre la celda que en el mapa base ES la trampilla. Se corrigió a comprobar DOS
celdas (suelo donde hay suelo **y** trampilla donde hay trampilla), que además es más fuerte:
con un clear a medias cae una de las dos.

Suite entera y no sólo el fichero tocado **a propósito**: el fix entra en `activeMap.tileAt`,
que lee todo el juego.

## 7. Ficheros tocados

- `game/src/core/game.ts` — campo `volatileTerrainWipe` + sus 3 puntos de uso
  (`activeMap.tileAt`, `mapTileWithOverrides`, `loadSmallMap`) y el reescrito de
  `stonegateLavaWipe`. **Ningún valor de aserción ni de mecánica movido**: el TPK sigue
  pintando el 32×32 de lava mientras dura la residencia.
- `game/tests/trapdoor-fall.test.ts` — detector nuevo `#113` + el helper `townGame` gana un
  parámetro opcional `entrada` para poder ejercitar la vía pública `enter()`.
