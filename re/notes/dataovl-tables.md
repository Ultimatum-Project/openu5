# Tablas numéricas de DATA.OVL y censo de accesos (Task 2.2)

Cierra la Fase 2: **los 48464 bytes de DATA.OVL particionados al 100 %** en
143 chunks nombrados (ledger `re/ledger/coverage.json`; catálogos gemelos
`extractor/src/parsers/dataovl.ts` ↔ `re/tools/dataovl_catalog.py`, guardia
de sincronía + test de cobertura en `re/tools/test_dataovl_catalog.py`).

Continúa `re/notes/dataovl-strings.md` (Task 2.1, strings). Ámbito: DATA.OVL
BASE (`original/u5/ultima5/DATA.OVL`, 48464 B).

## Método: censo de accesos del disasm

Herramienta: **`re/tools/dataovl_census.py`**. Como DATA.OVL es la imagen del
DGROUP (`fileoff = DS_off + 0x10`, re/notes/command-dispatch.md §4), cada
operando de memoria DS-relativo de los 24 ficheros de código apunta a un byte
concreto del fichero:

1. Se desensambla todo (kernel + 23 overlays, `disasm.py`).
2. De cada instrucción se extraen:
   - **mem**: desplazamiento positivo de operandos de memoria — directo
     `[0x1816]` o indexado `[bx + 0x1816]` / `[bx + si + 0x1816]`. Se excluyen
     overrides `cs:`/`es:`/`ss:` y operandos `bp`-relativos (segmento SS), y
     los desplazamientos negativos (locales de pila / decodificación espuria).
   - **imm**: inmediatos de `mov r16, imm` dentro del rango del fichero
     (posibles punteros: así se cargan los strings del dispatcher y las bases
     de tabla). Evidencia SECUNDARIA (un inmediato aritmético puede caer en
     rango por coincidencia).
3. Para cada hueco del ledger: qué ficheros lo referencian, con qué tamaño
   de operando (`byte/word ptr`) y desde qué base indexada → **elemento,
   stride y subsistema** de la tabla. `python3 dataovl_census.py` imprime el
   censo agregado por hueco; con `start end` el de un rango.

Fuente secundaria (solo nombres, nunca frontera sin evidencia binaria):
`reference/Ultima5Redux/.../DataOvlReference.cs` ("Redux").

Ruido conocido del censo: el disasm lineal de ULTIMA.EXE decodifica zonas de
datos como código (p.ej. `fmul qword ptr [...]`, `mov ss, ...`); las refs
únicas de aspecto absurdo se descartaron a mano.

## Hallazgos clave

- **Punteros a texto por todas partes**: varias "tablas numéricas" son en
  realidad tablas de offsets DS a los pools de strings:
  `talkWordPtrTable24f8` (0x24F8: 159 words → palabras comprimidas .TLK +
  assetFilenames1; TALK las usa para expandir tokens y los overlays hacen
  `push [0x25EA..]` para pasar FILENAMES a la carga de ficheros),
  `storeNameOffsets21da`/`shoppeKeeperNameOffsets22da` (TALK, entrada a
  tiendas), `monsterNamePtrs1866` (COMBAT imprime nombres de enemigo),
  y los words de `sjogTables4134` que apuntan a `scrollShortforms` (0x8C2D).
- **Scrolls**: los 8 códigos `*VL..*AT` de 0x0490 y sus gemelos sin `*` en
  0x8C2D son las abreviaturas de los 8 scrolls (Vas Lor, Rel Hur, In Sanct,
  In An, In Quas Wis, Kal Xen Corp, In Mani Corp, An Tym).
- **`spellMnemonicCodes` (0x9A5, 0xA8)**: 48 códigos-abreviatura, uno por
  hechizo de `spells` en el mismo orden (IL=In Lor … AT=An Tym); une el
  antiguo `spellReagentCodes` con sus vecinos.
- **Tablas de enemigo que faltaban**: `enemyRangeThing` (0x15DC) y
  `enemyFriends` (0x16E4), 48 bytes cada una (Redux + refs de COMBAT/COMSUBS
  y kernel). Ahora las parsea el extractor.
- **Accesos 1-based**: TOWN lee `[si+0x1E19]` (base = último byte de
  `lookTileTable1d2a`) para indexar `initialFloorTowne` con nº de towne
  1-based; COMBAT hace lo mismo con `spellAttackRange` (`[bx+0x169C]`, base
  0x16AC). Los bytes "pad" anteriores a esas tablas participan del acceso.
- **BSS-en-imagen**: los dos mega-huecos de ceros NO son inertes:
  `savedGamWindow` (0x55AC..0x6616: el save se copia en DS:0x55A6 = fileoff
  0x55B6, 0x1060 B; ~3200 refs) , `dgroupScratch6616` (0x6616..0x6A9A,
  buffers) y `dgroupBss` (0xA530..fin, ~500 refs; ahí viven g_unk_a9bd,
  g_unk_b114, g_unk_bb15…). Solo 17 bytes del fichero son `inert` de verdad
  (pads de 1-2 bytes entre tablas + la guarda del puntero nulo del CRT), más
  la cabecera de 16 bytes (`header`, no se carga en RAM).

## Reparticiones respecto a Task 2.1

| antes | ahora | motivo |
|---|---|---|
| `spellSyllableCodes` (0x4A0+0xE) | `scrollSpellCodes` (0x490+0x23) + `bangStrings` (0x4B3+0x10) | la lista real empieza en 0x490 y son los 8 scrolls |
| `spellReagentCodes` (0xA07+0x3A) | `spellMnemonicCodes` (0x9A5+0xA8) | una única lista de 48 códigos |
| `equipNameOffsetTable` (0x170E+0x4E) | `enemyFriends` (0x16E4+0x30) + `table_unk_1714` (+0x30) + `table_unk_1744` (+0x18) | el nombre era erróneo: no son offsets de equipo |
| `priceTableTail` (0x3DE8+0x4) | dentro de `endgameTables3de6` (0x3DE6+0xA2) | el run '~~' es el arranque de las tablas de ENDGAME |

## Chunks `table_unk_*` (propósito pendiente, censo anotado)

9 rangos (274 bytes = 0.57 % del fichero) quedan con nombre honesto
`*_unk_*` — cada uno con su censo en la nota del catálogo:

| chunk | rango | evidencia |
|---|---|---|
| `wordUnk0050` | 0x0050+0x2 | word 0x0011; sin refs mem fiables |
| `table_unk_1714` | 0x1714+0x30 | kernel, byte, bases stride 0x10/8 |
| `table_unk_1744` | 0x1744+0x18 | CMDS (Klimb), DNGLOOK/DUNGEON, 3×8 bytes |
| `table_unk_1ab8` | 0x1AB8+0x6 | 02 02 02 04 04 04; sin refs |
| `table_unk_1cd6` | 0x1CD6+0x2A | bytes bit-packed; sin refs directas |
| `table_unk_1d00` | 0x1D00+0x2A | 21 words simétricos 10..2000..10; sin refs |
| `table_unk_1f22` | 0x1F22+0x30 | 6 filas de 8 ({4},{4,5}..{4,5,3,2,1}); sin refs |
| `table_unk_3a34` | 0x3A34+0xE | 7 words; imm de OUTSUBS |
| `table_unk_3db6` | 0x3DB6+0x30 | words 11×0x0140…; sin refs directas |

(Además `townTable13b5`, `zstatsTables1a68`, `introTables3065`, etc. tienen
subsistema identificado pero semántica por derivar en sus fases 3.x.)

## Cifras

- Ledger: **48464/48464 B = 100 %** en 143 chunks:
  string-pool 28358 B, runtime-state 12510 B, data-table 7563 B,
  header 16 B, inert 17 B.
- Nuevos parseos del extractor: `enemyRangeThing`, `enemyFriends` (+ pools
  de strings `scrollSpellCodes`, `spellMnemonicCodes`, `parenDigitStrings`,
  `scrollShortforms`, `yesNoResponses84bd`, `barKeepYesNo9fe2` vía
  `stringPools`).
- Tests: `test_dataovl_catalog.py` exige partición exacta + ledger 100 % +
  igualdad TS↔python; `dataovl-coverage.test.ts` sigue verificando que todo
  run imprimible ≥4 cae en un chunk.
