# Catálogo de strings de DATA.OVL (Task 2.1)

Objetivo de la Fase 2: cada byte de DATA.OVL (48464 B) asignado a un chunk
nombrado. Esta tarea cataloga el **pool de strings** (y la ventana de estado
runtime que los rodea); Task 2.2 cerró las tablas numéricas hasta el 100 %
(ver `re/notes/dataovl-tables.md`: censo de accesos, reparticiones de
algunos chunks de esta nota — scrollSpellCodes, spellMnemonicCodes — y
cifras finales; las cifras de "cobertura resultante" de abajo son las
históricas de Task 2.1).

**Ámbito**: el catálogo está anclado al DATA.OVL BASE
(`original/u5/ultima5/DATA.OVL`, 48464 B); los offsets NO valen para
`upgrade/DATA.OVL`.

> **Regla de método (fix review F1.10-T3, 2026-07-14).** Para resolver un puntero
> DS a texto, anclar SIEMPRE por la fórmula canónica `fileoff = DS_off + 0x10`,
> **NUNCA** por búsqueda-de-texto (`data.find(b"…")`). Motivo: DATA.OVL contiene
> copias **DUPLICADAS** de muchos strings, y la búsqueda devuelve la PRIMERA
> ocurrencia, que rara vez es la que apunta el código → delta falso y off-by-one
> en cadena. Caso real: "Falsehood!" vive en 0x47DC **y** en el canónico 0x8D28
> (= DS 0x8D18 + 0x10); anclar en 0x47DC dio el delta espurio 0x454C y la falsa
> impresión de un "bloque de sub-cadenas irresoluble". Con la fórmula, las 7
> cadenas de la jump-table de trama (DS 0x8D0A/18/24/2E/3A/56/74) leen limpias,
> NUL-terminadas. (Da igual `ultima5/` o `play/`: son **byte-idénticos**, mismo
> sha256 — el fichero nunca fue el problema.)

> **Refinamiento (re-review):** el anclaje correcto es por **XREF del código
> consumidor** — la dirección DS literal que referencia el disasm de la rutina
> concreta (p.ej. `apply_item_grant` SJOG:16da → DS 0x8D18), y de ahí la fórmula.
> La ocurrencia duplicada de Falsehood/Hatred/Cowardice en 0x47CC/D9/E3 NO es
> basura: es el pool del **RITUAL del shard** (CAST.OVL 0x15c5-0x160a, "Gem
> Shard\n\nThou dost hold above thee the evil Shard of \0…\0\n\nNo effect!\n"
> + animación `call 0x6212`) — mismo texto-palabra en pool distinto para código
> distinto. Localizado y listo para la task del ritual (F1.10-T5).


**Sincronía TS↔python**: `DATAOVL_CHUNKS` (dataovl.ts) y `CHUNKS`
(dataovl_catalog.py) son dos listas mantenidas a mano;
`re/tools/test_dataovl_catalog.py` exige igualdad bidireccional de
(offset, length, kind, name) en el subconjunto compartido (string-pool +
runtime-state). Las notas son prosa y quedan FUERA de la comparación.

## DATA.OVL = imagen del DGROUP, no un fichero de recursos

Hallazgo de Task 1.4 (`re/notes/command-dispatch.md` §4): DATA.OVL es la
imagen del **segmento de datos del juego**. En ejecución `DS` = segmento de
carga de DATA.OVL, y

```
fileoff = DS_off + 0x10
```

Los 16 primeros bytes del fichero son su **cabecera MZ de overlay** con 3
reubicaciones (words de segmento de 3 far ptrs, en DS:0x5216/0x52AA/0x5396 =
fileoff 0x5226/0x52BA/0x53A6). Por eso los strings que imprime el dispatcher
(`mov ax, <DS_off>` → `kernel_print`) resuelven uno a uno sobre el fichero con
ese +0x10 (p.ej. "Cast...\n" en DS:0xA142 = fileoff **0xA152**).

Consecuencia para el mapa: la mitad "alta" de DATA.OVL mezcla **texto** con
**estado runtime** (valores iniciales de globals, ventana SAVED.GAM, punteros
far parcheados). Un run de bytes imprimibles NO implica siempre "string": las
tablas numéricas producen runs imprimibles por coincidencia.

## Método

1. **Reconocimiento** (python, sobre el binario primario): runs de ≥4 bytes
   ASCII imprimibles (0x20..0x7E). DATA.OVL tiene **2116 runs** (≈ los 2117 de
   `recon.json`), 22016 bytes imprimibles en total.
2. **Huecos**: se parte de los ~13.5 % ya parseados por el extractor
   (`extractor/src/parsers/dataovl.ts`) y se localizan los huecos con runs.
3. **Clustering**: los runs se agrupan en regiones contiguas (separadas por
   huecos binarios) y cada región se **inspecciona** (volcado de strings) para
   nombrarla por función. Se evita fragmentar: un pool contiguo con un
   propósito = un chunk. Los dos "mega-huecos" (0x1F8E.. y 0x4E96..) se parten
   en sus fronteras naturales (agujeros de ceros ≥24 B).
4. **Clasificación** por `kind`:
   - `string-pool` — texto real del juego.
   - `data-table` — tabla numérica/binaria cuyos bytes son imprimibles por
     coincidencia (o con 1-2 filenames embebidos). Se declara para cubrir sus
     runs; la partición fina es de Task 2.2.
   - `runtime-state` — ventana del DGROUP con estado inicial (drivers, teclado,
     far ptrs, arranque del roster).

## Fuente de verdad y test

- **`extractor/src/parsers/dataovl.ts` → `DATAOVL_CHUNKS`**: catálogo COMPLETO
  (string-lists + tablas ya parseadas + pools de Task 2.1). Es la fuente de
  verdad del test.
- **`extractor/tests/dataovl-coverage.test.ts`**: para cada run de ≥4 bytes
  imprimibles, `[offset, fin)` debe caer dentro de algún chunk de
  `DATAOVL_CHUNKS` (permite runs dentro de chunks `data-table`/`runtime-state`,
  no solo `string-pool`). También verifica que los chunks no se solapan.
  Antes de Task 2.1: **1690 runs** en territorio sin catalogar → después: **0**.
- **`extractor/src/parsers/dataovl.ts` → `DataOvl.stringPools`**: extractor
  genérico offset+strings, uno por chunk `string-pool` nuevo (los que llevan
  `emitStrings: true`). Fase 3 los consume (p.ej. respuestas de comando del
  dispatcher en `textCreateCharCmdsCrt`).
- **`re/tools/dataovl_catalog.py`**: réplica del subconjunto
  `string-pool` + `runtime-state` que se marca en el ledger (idempotente,
  al estilo de `kernel_catalog.py`). Las `data-table` NO se marcan aquí: son
  de Task 2.2.

## Regiones de string catalogadas en Task 2.1

Offsets de fichero (súmales tu razonamiento DS con −0x10 para la vista en RAM).

| offset | len | kind | nombre | contenido |
|--------|-----|------|--------|-----------|
| 0x0018 | 0x38 | string | crtCopyright | copyright del runtime MSC (artefacto del compilador) |
| 0x04A0 | 0x0E | string | spellSyllableCodes | códigos `*IQW`/`*KXC`/`*IMC` |
| 0x05E9 | 0xA2 | string | weaponNamesShort | nombres cortos de arma (Flame Oil, Main Gauche...) |
| 0x08C4 | 0x7C | string | classAndStatusNames | clases/títulos (Avatar..Shepherd) + estados |
| 0x0A07 | 0x3A | string | spellReagentCodes | códigos de mezcla de reagentes por hechizo |
| 0x129A | 0x11B | string | assetFilenames1 | filenames de gráficos (PROPORT.PCS, TITLE.BIT...) |
| 0x170E | 0x4E | data | equipNameOffsetTable | tabla de índices previa a equipmentNames (Task 2.2) |
| 0x175C | 0xA8 | string | equipmentNames | nombres de equipo (indexa `equipIndexes`) |
| 0x1A92 | 0x26 | data | tileArtGlyphs | arte/glifos (imprimible coincidente) |
| 0x1AEE | 0x1E8 | data | numericTables1aee | tablas numéricas (Task 2.2) con runs coincidentes |
| 0x2636 | 0xA2F | string | mapFilesDungeonNames | filenames de mapa + verbos de movimiento + salas de mazmorra |
| 0x30F2 | 0x75E | string | introMenuU4Transfer | menú principal + transferencia de Ultima IV + fuentes |
| 0x3986 | 0xAE | string | mapDataFilenames | filenames de datos de mapa (UNDER/BRIT.DAT, BRIT.OOL) |
| 0x3B68 | 0x22C | data | priceTables3b68 | tablas de precios (Task 2.2) con runs coincidentes |
| 0x3DE8 | 0x04 | data | priceTableTail | run coincidente en precios de resurrección |
| 0x41E4 | 0x2C7 | string | campRestTransportMsgs | acampar/descansar/transporte |
| 0x44E8 | 0x75C | string | spellPushEffectMsgs | word-of-power / empujar-tirar / efectos |
| 0x4D97 | 0xF1 | string | innNoRoomMsgs | posada: sin habitación |
| 0x4E96 | 0x263 | string | innGuestRegisterDialog | posada: registro de huéspedes |
| 0x520C | 0x3A0 | runtime | dgroupRuntimeWindow | drivers, teclado, far ptrs, arranque del roster (§4) |
| 0x6A9A | 0x1A23 | string | textWorldCombatDungeon | pool principal 1: mundo/combate/mazmorra/señales |
| 0x84DE | 0x74F | string | textShopLookGather | pool principal 2: tienda + Look/Get |
| 0x8C4E | 0x1394 | string | textItemsWearUse | pool principal 3: objetos + Wear/Ready/Use + colores |
| 0xA020 | 0x50D | string | textCreateCharCmdsCrt | pool principal 4: creación de personaje + respuestas de comando + errores C |

(Las 20 string-lists ya existentes — longArmour, weaponNames, spells,
storeNames, talkCompressedWords, wordsOfPower… — siguen en `DATAOVL_CHUNKS` y
también se marcan en el ledger.)

## Estructura de la mitad alta (mapa por bloques)

```
0x4E96..0x50F9  strings de posada (innkeeper)
0x5200..0x55AC  dgroupRuntimeWindow (estado runtime; §4)
0x55B6..0x6A00  ventana SAVED.GAM / BSS (ceros iniciales; sin runs) → Task 2.2
0x6A9A..0xA540  POOL PRINCIPAL de texto (~15 KB): 4 sub-pools separados por ceros
0xA540..0xBD50  BSS / estado en cero (sin runs) → Task 2.2
```

## Cobertura resultante

- **Test del extractor** (catálogo completo, strings + tablas con runs): cubre
  **32564 / 48464 B = 67.2 %** de DATA.OVL; **0** runs imprimibles sin
  catalogar.
- **Ledger** (`coverage.json`, sólo `string-pool` + `runtime-state`; las
  `data-table` quedan para Task 2.2): **28981 / 48464 B = 59.8 %** en 39
  chunks. Baseline previo del ledger: 0 %. (`recon.json` medía 13.5 % sobre las
  string-lists+tablas ya parseadas por el extractor.)
- Reproducción de cifras: 2116 runs imprimibles (recon decía 2117); baseline
  6562 B "conocidos" de recon = 13.5 % reproducido.
