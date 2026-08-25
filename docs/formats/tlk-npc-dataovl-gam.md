# Formato: .TLK, .NPC, DATA.OVL, INIT/SAVED.GAM

> Derivado del código real de `reference/Ultima5Redux/` (TalkScript(s).cs, NonPlayerCharacterReference(s).cs,
> NonPlayerCharacterSchedule.cs, DataOvlReference.cs, ImportedGameState.cs, PlayerCharacterRecord.cs).
> Todos los uint16 son little-endian. Bitmaps se leen MSB-first (bit 0 del índice = 0x80 del byte).

## 1. Ficheros .TLK (CASTLE/TOWNE/DWELLING/KEEP.TLK)

### Índice
```
0x00: uint16 LE nEntries
0x02: nEntries × { uint16 LE npcIndex (=DialogNumber, 0..31); uint16 LE fileOffset (absoluto) }
```
Longitud del bloque de un NPC = fileOffset(siguiente) − fileOffset(este); el último hasta EOF.

### Encoding de bytes del script
- `0x00` = fin de línea de script.
- Bytes `0xA0-0xA1`, `0xA5-0xDA`, `0xE1-0xFA` = carácter ASCII con bit alto: **restar 0x80**.
- El carácter `@` (tras restar) = marca de control, se ignora en la salida.
- Resto = opcode O índice de palabra comprimida (dicc. en DATA.OVL 0x104C).

### Opcodes (byte tal cual)
```
0x81 AvatarsName        inserta nombre del Avatar
0x82 EndConversation
0x83 Pause
0x84 JoinParty
0x85 Gold               +3 chars siguientes = cantidad (número de 3 dígitos en texto)
0x86 Change             +1 byte siguiente = item otorgado
0x87 Or                 encadena keywords alternativas para una misma respuesta
0x88 AskName
0x89 KarmaPlusOne
0x8A KarmaMinusOne
0x8B CallGuards
0x8C IfElseKnowsName    branch según si el NPC conoce al Avatar
0x8D NewLine
0x8E Rune               renderizar en alfabeto rúnico
0x8F KeyWait
0x90 StartLabelDefinition (seguido de 0xFE DefineLabel)
0x91..0x9B              labels 0..9 (label# = byte − 0x91); 1ª aparición=goto, 2ª=definición
0x9F EndScript
0xA2 StartNewSection
0xFD GotoLabel
0xFE DefineLabel
0xFF DoNothingSection
```

### Estructura del script de un NPC
```
Línea 0 = Name; 1 = Description; 2 = Greeting; 3 = Job; 4 = Bye
Luego: pares [keyword(s)] / [respuesta]; con <Or> (0x87) varias keywords comparten respuesta
Luego: sección de labels — cada label: InitialLine + defaultAnswers + su propio Q&A
Fin: 0x90 seguido de 0x9F
```
- Keywords por defecto añadidas por el motor: `name`→línea0? (name), `job`,`work`→línea3, `bye`→línea4.
- **Matching: `input.toLowerCase().startsWith(keyword.toLowerCase())`**, keywords de 1-6 chars sin espacios. Primera coincidencia gana; duplicados: gana la primera.
- Palabras comprimidas: diccionario DATA.OVL `TALK_COMPRESSED_WORDS` (0x104C, 0x24E, StringList). Mapa índice→palabra con huecos:
```
rangos (índiceByte → índiceLista con offset): [1..7]:-1, [9..27]:-2, [29..49]:-3, [51..64]:-4,
[66..66]:-5, [68..69]:-6, [71..71]:-7, [76..129]:-11
```
Añadir espacio tras cada palabra comprimida.
- Chars especiales de sustitución en strings de tienda: `%`=oro, `&`=equipo, `#`=negocio, `$`=mercader, `@`=comida, `*`=ubicación, `^`=cantidad.

## 2. Ficheros .NPC

- 8 pueblos/fichero × 576 bytes (0x240) por pueblo. Por pueblo (base = town*576):
```
base+0x000..0x1FF : 32 × NpcSchedule (16 bytes):
    +0  byte aiTypes[3]
    +3  byte x[3]
    +6  byte y[3]
    +9  byte z[3]        // piso (signed en la práctica: 0xFF = sótano −1)
    +12 byte times[4]    // horas 0-23
base+0x200..0x21F : 32 × npcType (byte)     // sprite/CharacterType; keySprite = type+0x100
base+0x220..0x23F : 32 × dialogNumber (byte) // = npcIndex del .TLK
```
- Slot 0 sin usar. Orden de pueblos = mismo orden que las plantas de su .DAT (ver maps.md).
- Tipos especiales por dialogNumber/type: 0x81 Blacksmith, 0x82 Barkeeper, 0x83 HorseSeller, 0x84 Shipwright, 0x85 MagicSeller, 0x86 GuildMaster, 0x87 Healer, 0x88 InnKeeper, 0xFD WishingWell, 0xFE Guard, 0xFF None. Estos NO tienen TalkScript (diálogo de tienda vía DATA.OVL/SHOPPE.DAT).

### Semántica del schedule
- 3 posiciones (índices 0,1,2); `times[4]`; índice 3 remapea a posición 1.
- Si times todos 0 → posición 0 fija. Si `hour == times[i]` → pos getIndex(i) (con getIndex(3)=1).
- Entre horas: times[3]<h<times[0]→1; times[0]<h<times[1]→0; times[1]<h<times[2]→1; times[2]<h<times[3]→2.

### AI types (byte del fichero, 0-7)
```
0 Fixed  1 Wander  2 BigWander  3 ChildRunAway  4 CustomAi(mercaderes)
6 ExtortOrAttackOrFollow  7 DrudgeWorthThing
```
(Redux define tipos 100+ como refinamientos en runtime: BlackthornGuardFixed/Wander, MerchantBuyingSelling*, Begging, GenericExtortingGuard, HalfYourGoldExtortingGuard(Minoc), StoneGargoyleTrigger, etc. — portar las reglas de adaptación de `AdaptAiTypesByNpcRef` L240-352 cuando toque.)

## 3. DATA.OVL — chunks principales (offset, longitud, formato)

StringList = strings consecutivas terminadas en \0. UINT16 LE. (vm) = valueModifier a sumar.

| Offset | Long | Formato | Contenido |
|---|---|---|---|
| 0x0052 | 0xA6 | StringList | Nombres largos de armadura (13) |
| 0x00F8 | 0x81 | StringList | Nombres de armas (10) |
| 0x0179 | 0x5A | StringList | Anillos y amuletos (5) |
| 0x01D3 | 0x158 | StringList | Nombres de monstruos (mixed case) |
| 0x032B | 0x165 | StringList | Nombres de monstruos (upper) |
| 0x04C3 | 0x2B | StringList | Special item names (5) |
| 0x0506 | 0x29 | StringList | Shards (3) |
| 0x052F | 0x43 | StringList | Special item names 2 (6) |
| 0x0572 | 0x77 | StringList | Nombres cortos de armadura |
| 0x068C | 0x30 | StringList | Pociones (8) |
| 0x06BC | 0x4D | StringList | Reagentes (8) |
| 0x0709 | 0x1BB | StringList | Hechizos (47) |
| 0x0941 | 0x64 | StringList | Sílabas rúnicas de hechizo (26) |
| 0x0A4D | 0x14B | StringList | Nombres de localización (26, mayúsculas) |
| 0x0B98 | 0x48 | StringList | Virtudes (8) |
| 0x0BE0 | 0x1E | StringList | Mantras (8) |
| 0x0BFE | 0x2FC | StringList | Nombres de tiendas |
| 0x0EFA | 0x152 | StringList | Nombres de tenderos |
| 0x104C | 0x24E | StringList | Palabras comprimidas TLK |
| 0x13CC | 0x180 | ByteList | ENEMY_STATS (48 × 8 bytes) |
| 0x154C | 0x60 | ByteList | ENEMY_FLAGS (48 × 2 bytes) |
| 0x15AC | 0x30 | ByteList | ENEMY_ATTACK_RANGE |
| 0x160C | 0x37 | ByteList | ATTACK_VALUES (55 armas) |
| 0x1644 | 0x2F | ByteList | DEFENSE_VALUES |
| 0x1674 | 0x37 | ByteList | ATTACK_RANGE_VALUES |
| 0x16AD | 0x37 | ByteList | SPELL_ATTACK_RANGE |
| 0x1806 | 0x60 | UINT16List(+0x10) | EQUIP_INDEXES (strings por equipo) |
| 0x1ABE | 0x2F | ByteList | Fuerza requerida por equipo |
| 0x1E2A/32/3A/42 | 8 c/u | ByteList | Índice de planta-inicial por fichero TOWNE/DWELLING/CASTLE/KEEP |
| 0x1E4A | 0x50 | UINT16List(+0x10) | LOCATION_NAME_INDEXES |
| 0x1E9A | 0x28 | ByteList | LOCATIONS_X (40) |
| 0x1EC2 | 0x28 | ByteList | LOCATIONS_Y (40) |
| 0x1EEA | 0x38 | ByteList | MOON_PHASES (28 días × 2) |
| 0x1F5E | 0x20 | ByteList | Índice virtud+mantra |
| 0x1F7E/0x1F86 | 8 c/u | ByteList | SHRINE_X/Y_COORDS |
| 0x3886 | 0x100 | ByteList | **OVERLAY DE CHUNKS DE BRIT.DAT** (0xFF=agua) |
| 0x3A42 | 0x28 | ByteList | Precios base reagentes |
| 0x3A6A | 0x28 | ByteList | Cantidades reagentes |
| 0x3A92 | 0x60 | UINT16List | Precios base de equipo |
| 0x3AF2 | 0x48 | ByteList | Armas vendidas por herrero (9 ciudades × 8) |
| 0x3D96/0x3D9E | 8 c/u | ByteList | Precios heal / cure |
| 0x3DA6 | 0x10 | UINT16List | Precios resurrección |
| 0x3E88..0x40C2 | 0x72 c/u | ByteList | SEARCH_OBJECT id/quality/location/floor/x/y |
| 0x44AD | 0x3A | StringList | **WORDS_OF_POWER (8)**: FALLAX, VILIS, INOPIA, MALUM, AVIDUS, INFAMA, IGNAVUS, VERAMOCOR |
| 0x4D86/0x4D8A | 4 c/u | ByteList | X/Y de docks (Jhelom, Minoc, E.Brittany, Bucc.Den) |
| 0x4E8A/0x4E90 | 6 c/u | ByteList | Camas de posada X/Y |
| (más chunks de strings de UI/tiendas — ver DataOvlReference.cs L2169-2640) |

### 3.1 Mapa COMPLETO de regiones (Task 2.2 — partición al 100 %)

Los 48464 bytes de DATA.OVL están particionados en **143 chunks nombrados**
(sin huecos ni solapes). La lista canónica y anotada vive en
`extractor/src/parsers/dataovl.ts` (`DATAOVL_CHUNKS`) = réplica de
`re/tools/dataovl_catalog.py` (marcado en el ledger); el método (censo de
accesos DS del disasm) y la evidencia por tabla en `re/notes/dataovl-tables.md`.
DATA.OVL es la imagen del DGROUP: `fileoff = DS_off + 0x10`
(re/notes/command-dispatch.md §4).

Resumen por clase y regiones destacadas que NO están en la tabla anterior:

| Región | Chunk | Contenido |
|---|---|---|
| 0x0000+0x10 | header | cabecera MZ-overlay (3 reubicaciones; no se carga en RAM) |
| 0x0490+0x23 / 0x8C2D+0x21 | scrollSpellCodes / scrollShortforms | códigos de los 8 scrolls (`*VL..*AT` / `VL..AT`) |
| 0x09A5+0xA8 | spellMnemonicCodes | 48 abreviaturas de hechizo (IL=In Lor … AT=An Tym), orden = `spells` |
| 0x15DC+0x30 / 0x16E4+0x30 | enemyRangeThing / enemyFriends | 2 tablas byte por enemigo (48) que faltaban |
| 0x187A+0x1EE | textIndexes187a | índices de texto (+0x10) |
| 0x1D2A+0x100 | lookTileTable1d2a | 1 byte/tile (LOOKOBJ) |
| 0x1F8E+0x200 | relCoordLists1f8e | 16 listas de pares (dx,dy) — LOS/oclusión |
| 0x21DA/0x22DA +0x100 c/u | storeNameOffsets / shoppeKeeperNameOffsets | offsets DS de texto de tienda (TALK) |
| 0x23DA+0x80 | shoppeKeeperTownes23da | townes por tipo de tienda (Redux SHOPPE_KEEPER_TOWNES_*) |
| 0x24F8+0x13E | talkWordPtrTable24f8 | offsets DS de palabras .TLK + filenames (expansión de tokens) |
| 0x50F9+0x5D | fontGlyphWidths50f9 | anchos de glifo (FONT) |
| 0x55AC+0x106A | savedGamWindow | **runtime**: copia de SAVED.GAM en DS:0x55A6 (fileoff 0x55B6, 0x1060 B) |
| 0x6616+0x484 | dgroupScratch6616 | **runtime**: buffers tras el save |
| 0xA530+0x1820 | dgroupBss | **runtime**: BSS-en-imagen (ceros; ~500 refs) |

Totales: string-pool 28358 B, runtime-state 12510 B, data-table 7563 B,
header 16 B, inert 17 B (solo pads de 1-2 bytes jamás referenciados).
9 tablas conservan nombre `*_unk_*` (274 B) con su censo anotado.

Enum Equipment (índice en tablas de equipo): LeatherHelm=0..Ankh=47 + scrolls 48-54; orden completo en DataOvlReference.cs L488-547: LeatherHelm,ChainCoif,IronHelm,SpikedHelm,SmallShield,LargeShield,SpikedShield,MagicShield,JewelShield,ClothArmour,LeatherArmour,Ringmail,ScaleMail,ChainMail,PlateMail,MysticArmour,Dagger,Sling,Club,FlamingOil,MainGauche,Spear,ThrowingAxe,ShortSword,Mace,MorningStar,Bow,Arrows,Crossbow,Quarrels,LongSword,TwoHHammer,TwoHAxe,TwoHSword,Halberd,SwordofChaos,MagicBow,SilverSword,MagicAxe,GlassSword,JeweledSword,MysticSword,RingInvisibility,RingProtection,RingRegeneration,AmuletOfTurning,SpikedCollar,Ankh (0xFF=Nothing).

## 4. INIT.GAM / SAVED.GAM (mismo layout)

### Registros de personaje: offset 0x02, 16 registros × 32 bytes (reg 0 = Avatar)
```
+0x00 char[9] name (\0-terminated)
+0x09 byte gender      0x0B=M, 0x0C=F
+0x0A byte class       'A','B','F','M'
+0x0B byte status      'G'ood,'P'oison,'C'harmed,'S'leep,'D'ead
+0x0C byte str  +0x0D byte dex  +0x0E byte int  +0x0F byte currentMP
+0x10 u16 currentHP  +0x12 u16 maxHP  +0x14 u16 exp  +0x16 byte level
+0x17 byte monthsAtInn  +0x18 byte unknown
+0x19 byte helmet  +0x1A armor  +0x1B weapon(izq)  +0x1C shield(dcha)  +0x1D ring  +0x1E amulet   (0xFF = nada)
+0x1F byte partyStatus: 0x00=en party, 0xFF=no unido, otro=nº settlement (en posada)
```

### Offsets absolutos de estado global
```
0x202 u16 comida      0x204 u16 oro       0x206 llaves   0x207 gemas   0x208 antorchas
0x209 grapple  0x20A carpet(alfombras)  0x20B skull keys
0x20D amulet LB  0x20E crown  0x20F sceptre
0x210-0x212 shards (Falsehood, Hatred, Cowardice)
0x214 spyglass  0x215 HMS cape  0x216 sextant  0x218 black badge  0x219 wooden box
0x21A + equipIdx     : cantidad de cada arma/armadura (48 slots)
0x24A..0x279         : cantidad de cada hechizo (48, orden SpellWords: In_Lor primera)
0x27A..0x281         : scrolls (Vas_Lor, Rel_Hur, In_Sanct, In_An, In_Quas_Wis, Kal_Xen_Corp, In_Mani_Corp, An_Tym)
0x282..0x289         : pociones (Blue..White)
0x28A/0x292/0x29A/0x2A2 : moonstones X/Y/buried(0=enterrada,0xFF=inv)/Z(0=Brit,0xFF=Under) × 8
0x2AA..0x2B1         : reagentes (SulfurAsh..MandrakeRoot)
0x2B5 nº miembros party    0x2B6 bitmap(0xF bytes) search-objects aún presentes
0x2CE u16 año   0x2D5 personaje activo(0-5,0xFF)   0x2D7 mes   0x2D8 día   0x2D9 hora   0x2DB minuto
0x2E2 karma    0x2E5 turnos desde inicio
0x2ED location actual   0x2EF piso(0xFF=Underworld)   0x2F0 X   0x2F1 Y
0x301 turnos de antorcha restantes
0x326 bitmap shrines con quest   0x328 bitmap shrines visitados   0x332 8 bytes shrines destruidos
0x5B4 bitmap 0x80 bytes NPC_IS_DEAD  (32 locations × 32 npcs; [location-1][npcIndex]; MSB-first)
0x634 bitmap 0x80 bytes NPC_IS_MET   (idem)
0x6B4 0x100 bytes character animation states (entorno actual)
0x9B8 0x200 UINT16List character states (incl. xyz)
0xBB8 32×16×2 bytes NPC movement lists   0xFB8 32×u16 movement offsets
0xFF8 32 bytes NPC sprite indexes (por smallmap)
```
- Partida nueva = INIT.GAM (turnos=0). BRIT.OOL/UNDER.OOL = animation states iniciales de overworld/underworld.
