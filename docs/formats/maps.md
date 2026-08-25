# Formato: mapas de Ultima V (BRIT.DAT, pueblos, DUNGEON.DAT, .CBT)

> Derivado del código real de `reference/Ultima5Redux/` (loaders verificados que funcionan).
> Rutas C#: `References/Maps/LargeMapLocationReferences.cs`, `SingleMapReference.cs`,
> `SmallMapReference.cs`, `DungeonReferences.cs`, `DungeonTile.cs`, `CombatMapReferences.cs`,
> `SingleCombatMapReference.cs`.

## 1. BRIT.DAT / UNDER.DAT — overworld 256×256

**⚠️ BRIT.DAT es DISPERSO.** La descripción de walkthrough ("256 chunks densos") fue refutada con razón:

- El mapa son 256 chunks de 16×16 tiles (1 byte/tile), chunks en orden row-major (`chunk = row*16 + col`).
- **Índice de chunks en DATA.OVL offset `0x3886`**: 256 bytes, 1 por chunk. Valor `0xFF` = chunk completamente de agua → NO está en BRIT.DAT; se rellena con tile `0x01` (agua). Cualquier otro valor = chunk presente: leer los siguientes 256 bytes secuenciales de BRIT.DAT.
- Dentro de un chunk: 256 bytes row-major (fila local 0 completa, luego fila 1…).
- **UNDER.DAT es DENSO**: sin overlay (todos los chunks presentes) = 65536 bytes exactos.

```
buildLargeMap(datBytes, overlayBytes|null):   // overlay = DATA.OVL[0x3886..0x3985]
  map = byte[256][256]  // [x][y]
  srcIdx = 0
  for chunk in 0..255:
    col = chunk % 16; row = chunk >> 4
    ov = overlay ? overlay[chunk] : 0x00
    for y in row*16 .. row*16+15:
      for x in col*16 .. col*16+15:
        map[x][y] = (ov == 0xFF) ? 0x01 : datBytes[srcIdx++]
```

- BRIT.OOL / UNDER.OOL **no son tiles**: son estados iniciales de map-units (monstruos/animaciones), equivalentes a SAVED.OOL.
- Coordenadas X,Y de las 40 localizaciones entrables: DATA.OVL chunks `LOCATIONS_X` (0x1E9A, 40 bytes) y `LOCATIONS_Y` (0x1EC2, 40 bytes).

## 2. Mapas de pueblo — TOWNE/CASTLE/KEEP/DWELLING.DAT

- Cada planta = 32×32 tiles = 1024 bytes (0x400), row-major, 1 byte/tile.
- Cada fichero = 16 plantas = 16384 bytes exactos.
- Posición inicial del jugador al entrar: **(15, 30)**, planta 0.
- Plantas: −1 = sótano (si el edificio tiene, va PRIMERA en el fichero), 0 = principal, 1+ superiores.

Orden de edificios y plantas por fichero (offset de planta acumulativo):

- **CASTLE.DAT**: Lord_Britishs_Castle (5 plantas: −1..3), Palace_of_Blackthorn (5: −1..3), West_Britanny (1), North_Britanny (1), East_Britanny (1), Paws (1), Cove (1), Buccaneers_Den (1).
- **TOWNE.DAT**: Moonglow (2), Britain (2), Jhelom (2), Yew (2: −1,0), Minoc (2), Trinsic (2), Skara_Brae (2), New_Magincia (2).
- **DWELLING.DAT**: Fogsbane (3), Stormcrow (3), Greyhaven (3), Waveguide (3), Iolos_Hut (1), Suteks_Hut (1), SinVraals_Hut (1), Grendels_Hut (1).
- **KEEP.DAT**: Ararat (2), Bordermarch (2), Farthing (1), Windemere (1), Stonegate (1), Lycaeum (3), Empath_Abbey (3), Serpents_Hold (3: −1,0,1).

Enum Location (SingleMapReference.cs L22-66): 0x00 Britannia_Underworld, luego 1..40 en el orden: Moonglow=1, Britain=2, Jhelom=3, Yew=4, Minoc=5, Trinsic=6, Skara_Brae=7, New_Magincia=8, Fogsbane=9, Stormcrow=10, Greyhaven=11, Waveguide=12, Iolos_Hut=13, Suteks_Hut=14, SinVraals_Hut=15, Grendels_Hut=16, Lord_Britishs_Castle=17, Palace_of_Blackthorn=18, West_Britanny=19, North_Britanny=20, East_Britanny=21, Paws=22, Cove=23, Buccaneers_Den=24, Ararat=25, Bordermarch=26, Farthing=27, Windemere=28, Stonegate=29, Lycaeum=30, Empath_Abbey=31, Serpents_Hold=32, Deceit=33, Despise=34, Destard=35, Wrong=36, Covetous=37, Shame=38, Hythloth=39, Doom=40.

## 3. DUNGEON.DAT — 8 mazmorras × 8 niveles × 8×8

- Fichero = 4096 bytes exactos. Mazmorra n en offset `n*512`; nivel f en `n*512 + f*64`; tile (col,row) en byte `row*8 + col`.
- Orden de mazmorras: Deceit, Despise, Destard, Wrong, Covetous, Shame, Hythloth, Doom (= Location 33..40).
- Cada byte: nibble alto = tipo, nibble bajo = subtipo/flags.

Tipos (nibble alto):
```
0x0 Nothing        (si subByte==0x8 → reinterpretar como LadderUp)
0x1 LadderUp       sub: LadderTrap {NoTrap=0, IsTrapped=8}
0x2 LadderDown     sub: idem
0x3 LadderUpDown   sub: idem
0x4 Chest          sub: ChestType {Normal=0, Trapped_1=1, Trapped_2=2, Poisoned=4}
0x5 Fountain       sub: FountainType {CurePoison=0, Heal=1, PoisonFountain=2, BadTasteDamage=3}
0x6 Trap           sub: TrapType {LowerTrapVisible=0, BombTrap=1, InvisibleTrap=2, UpperTrapVisible=3}
0x7 OpenChest      sub: ChestType
0x8 MagicField     sub: MagicFieldType {Poison=0, Sleep=1, Fire=2, Energy=3}
0x9 (sin definir)
0xA RoomsBroke
0xB Wall           sub: índice de texto de muro (ver tabla)
0xC SecondaryWall  (muros con esqueletos)
0xD SecretDoor
0xE NormalDoor
0xF Room           sub: RoomNumber (índice de sala → DUNGEON.CBT)
```
Textos de muro: `messageStarts = {0,1,-1,2,3,7,10,-1}` sobre `messages = ["BOTTOMLESS PIT","THE MAZE OF LOST SOULS","THE PRISON WRONG","THE CRYPT","UPPER CRYPTS","LOWER CRYPTS","DEBTORS ALLY","DEEP","DEEPER","DEEPEST","MOTHER LODE MAZE"]`.

## 4. BRIT.CBT / DUNGEON.CBT — mapas de combate 11×11

- 352 bytes (0x160) por mapa = 11 filas × 32 bytes. BRIT.CBT = 16 mapas (5632 B); DUNGEON.CBT = 112 mapas (39424 B).
- Cada fila: bytes 0..10 = tiles (rejilla 11×11, row-major, [x][y] tras cargar); bytes 11..31 = metadatos según fila:

```
Fila 0 : bytes 11..18  = sprites de 8 triggers
Filas 1-4: posiciones iniciales de 6 PJs por dirección de entrada
          fila 1=East, 2=West, 3=South, 4=North
          X del PJ p en byte 11+p (11..16); Y en byte 17+p (17..22)
Fila 5 : bytes 11..26 = sprite de cada uno de 16 map-units (enemigos)
Fila 6 : bytes 11..26 = X de cada map-unit
Fila 7 : bytes 11..26 = Y de cada map-unit
Fila 8 : trigger positions: X en 11..18, Y en 19..26
Fila 9 : trigger newPosition1: X en 11..18, Y en 19..26
Fila 10: trigger newPosition2: X en 11..18, Y en 19..26
```

- Dirección de entrada válida si `X del primer PJ > 0` y sin posiciones duplicadas.
- Map-unit con posición (0,0) = vacío. Sprite de enemigo real = `rawSprite + 0x100`.
- Mapas de BRIT.CBT (índice): CampFire=0, Swamp=1, Glade=2, Treed=3, Desert=4, CleanTree=5, Mountains=6, BigBridge=7, Brick=8, Basement=9, Psychedelic=10, BoatOcean=11, BoatNorth=12, BoatSouth=13, BoatBoat=14, Bay=15.
- Salas de mazmorra: DUNGEON.CBT contiene 112 mapas = 16 salas × 7 mazmorras (todas menos Despise, que no tiene salas): `location = mapNum / 16 + Deceit`, saltando Despise.
