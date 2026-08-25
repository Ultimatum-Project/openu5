# Karma, Tiendas y Moongates — re-derivado del código de Ultima5Redux

> Fuente: `reference/Ultima5Redux/` (rama tal cual clonada). Todas las citas son
> `ruta:línea` relativas a `reference/Ultima5Redux/`.
> Las descripciones de walkthrough previas fueron **refutadas**; este documento
> deriva la mecánica real del código C#. Donde Redux **no** implementa algo que sí
> existe en el original DOS, se marca **GAP — verificar contra DOSBox/ULTIMA.EXE**.

---

## Resumen ejecutivo

- **Karma**: es un único `byte` global (0–99), guardado en `SAVED.GAM:0x2E2`. En Redux
  tiene **un solo efecto mecánico real**: el precio de los **reactivos** (reagents) sube
  cuanto más bajo es el karma. Todo lo demás (resurrección, endgame, combate, otros
  precios) **no** depende del karma en Redux. Sube/baja en incrementos pequeños por
  acciones concretas: robar comida −1, asesinar NPC −10, liberar prisioneros +2, donar
  en santuarios +N, y los opcodes de diálogo ±1. Nótese que el "castigo" real por robar
  comida/matar en U5 es la **guardia** (`IsWantedManByThePoPo`), no el karma.
- **Tiendas**: 8 tipos de mercader (herrero, taberna, posada, reactivos/magia, healer,
  provisiones, caballos, barcos/gremio). El texto de diálogo vive en `SHOPPE.DAT`
  (strings comprimidos, descomprimidos con el diccionario de `DATA.OVL`) más muchas
  cadenas sueltas en `DATA.OVL`. El mapeo tienda→ubicación→tipo **no está en los datos**
  y Redux lo suple con un JSON propio (`ShoppeKeeperMap.json`). Precios y stock salen de
  tablas de `DATA.OVL`. **No hay regateo aleatorio**: el "descuento" es determinista por
  estadística del Avatar (Destreza para armas/armadura, Inteligencia para
  provisiones/caballos/barcos, Karma para reactivos).
- **Moongates**: 8 moonstones enterrables. Su posición y estado (enterrada / en
  inventario) vive en `SAVED.GAM:0x28A–0x2A9`. Las fases de las dos lunas (Trammel y
  Felucca) por día del mes de 28 días viven en `DATA.OVL:0x1EEA` (28 pares de bytes). De
  noche, la fase de una de las lunas selecciona **a qué moonstone enterrado** te
  teleporta la puerta. El *índice* de la moonstone en el array = su fase lunar. Redux
  calcula el destino pero **el acto de teleportar en sí lo consume el front-end** (la
  librería solo expone `GetMoongateTeleportLocation()`).

---

## 1. Karma

### 1.1 Almacenamiento y rango

- Tipo: `ushort` en runtime (`GameState.Karma`), pero se carga desde un único **byte** de
  `SAVED.GAM`.
  - `GameState.cs:47` — `public ushort Karma { get; private set; }`
  - `ImportedGameState.cs:118` — `internal byte Karma => DataChunks.GetDataChunk(DataChunkName.KARMA).GetChunkAsByte();`
  - `ImportedGameState.cs:303` — chunk **`0x2E2`**, tamaño `0x01` (1 byte) en `SAVED.GAM`.
- Rango forzado **0–99** (clamp en cada cambio):
  - `GameState.cs:274-279`
    ```csharp
    public void ChangeKarma(int nAdjustBy, TurnResults turnResults) {
        turnResults.PushTurnResult(new KarmaChanged(nAdjustBy, Karma));
        Karma = (ushort)Math.Max(0, Karma + nAdjustBy);   // suelo 0
        if (Karma > 99) Karma = 99;                        // techo 99
    }
    ```
- Todo cambio empuja un `KarmaChanged` a los `TurnResults` (para UI/mensajería):
  `MapUnits/TurnResults/SpecificTurnResults/KarmaChanged.cs`.

### 1.2 Acciones que cambian el karma (todo lo que hay en Redux)

| Acción | Δ Karma | Fuente |
|---|---:|---|
| Diálogo NPC opcode `KarmaPlusOne` (0x89) | +1 | `Dialogue/Conversation.cs:764-765` |
| Diálogo NPC opcode `KarmaMinusOne` (0x8A) | −1 | `Dialogue/Conversation.cs:767-768` |
| Coger/robar comida de una mesa (`IsTableWithFood`) | −1 | `World.cs:1157` |
| Cosechar trigo de un campo (`WheatInField`) | −1 | `World.cs:1098` |
| Asesinar a un NPC (`MurderNpc`) | −10 | `World.cs:348` |
| Liberar a un NPC de los cepos (stocks) | +2 | `World.cs:1313` |
| Liberar a un NPC de las esposas (manacles) | +2 | `World.cs:1323` |
| Donar oro en un santuario (shrine) | +N (N = cientos de oro donados) | `Maps/CutSceneMap.cs:66-76` |

Notas de derivación:
- Los opcodes de diálogo `KarmaPlusOne = 0x89` / `KarmaMinusOne = 0x8A` están en
  `References/Dialogue/TalkScript.cs:33-34`. Es el mecanismo por el que las respuestas
  "virtuosas/mezquinas" a NPCs ajustan karma (±1), como ya conocías.
- **Asesinato** (`World.cs:342-350`): marca al NPC muerto, `ChangeKarma(-10)` y activa
  `smallMap.IsWantedManByThePoPo = true` (te vuelves "wanted" → la guardia reacciona).
  El castigo jugable real es la guardia, no el −10.
- **Robar comida** (`World.cs:1147-1160`) y **cosechar trigo** (`World.cs:1091-1099`):
  ambos dan +1 de comida al inventario y −1 karma.
- **Donación en santuario** (`Maps/CutSceneMap.cs:65-78`): dentro del script de la
  cutscene del shrine, el comando `BoostKarmaByMoney` cobra `HundredsOfGoldDonated*100`
  de oro y llama `ChangeKarma(HundredsOfGoldDonated)` (es decir, +1 karma por cada 100
  de oro donados). Requiere tener oro suficiente; si no, `AttemptedGoldDonationNotEnoughMoney`.
  El opcode del script está en `Maps/CutOrIntroSceneScript.cs:32,94-95`.

**Acciones que NO tocan el karma en Redux** (comprobado por ausencia de `ChangeKarma`):
huir de combate, abrir/saquear cofres, extorsión de guardias, completar shrine quests
(más allá de la donación), robar objetos de tiendas. **GAP — verificar contra
DOSBox/ULTIMA.EXE** si en el original alguna de estas movía karma; en Redux no lo hacen.

### 1.3 Efectos del karma en el juego

**Único efecto mecánico implementado: precio de los reactivos.**

- `PlayerCharacters/Inventory/Reagent.cs:84-96`:
  ```csharp
  // price = Base Price * (1 + (100 - Karma) / 100)
  int nAdjustedPrice =
      GameReferences.Instance.ReagentReferences.GetPriceAndQuantity(location, ReagentType).Price
      * (1 + (100 - GameStateReference.State.Karma) / 100);
  ```
  - **Ojo aritmética entera C#**: `(100 - Karma) / 100` es división entera. Da `1` solo
    cuando `Karma == 0` (→ factor `×2`), y `0` para cualquier `Karma` en 1–99 (→ factor
    `×1`, precio base). Es decir, tal como está escrito, el efecto real es binario:
    karma 0 duplica el precio de reactivos; karma ≥1 = precio base. **GAP — verificar
    contra DOSBox/ULTIMA.EXE**: el comentario sugiere que la intención era una rampa
    lineal (float), así que la fórmula "de diseño" es `Base * (1 + (100-Karma)/100)` con
    división real; probablemente el original escala de forma continua.
- El resto de reads de `.Karma` en el código son solo carga/serialización:
  `GameState.cs:170` (import) y los casos de `Conversation.cs`. No hay uso de karma en:
  - **Resurrección**: el precio del healer NO usa karma (ver §2.6). No hay penalización de
    resurrección por karma en Redux.
  - **Precios de equipo / provisiones / caballos / barcos**: usan Destreza o Inteligencia
    del Avatar, no karma (ver §2).
  - **Endgame / combate / spawns**: sin referencias a karma.

**Hallazgo explícito**: en Redux el karma es casi vestigial — un contador que sube y baja
pero cuyo único gancho jugable es el (defectuoso) multiplicador de precio de reactivos.
Cualquier efecto adicional del original (p.ej. huida de combate, resurrección, respuestas
de NPC condicionadas por karma) está **sin implementar → GAP verificar contra DOSBox**.

---

## 2. Tiendas / SHOPPE.DAT

### 2.1 Los 8 tipos de mercader

Enum `SpecificNpcDialogType` en
`References/MapUnits/NonPlayerCharacters/NonPlayerCharacterReference.cs:19-33`:

| Tipo | Byte | Clase de lógica |
|---|---|---|
| `Blacksmith` (herrero) | `0x81` | `MapUnits/.../ShoppeKeepers/BlackSmith.cs` |
| `Barkeeper` (taberna) | `0x82` | `.../BarKeeper.cs` |
| `HorseSeller` (caballos) | `0x83` | `.../HorseSeller.cs` |
| `Shipwright` (barcos) | `0x84` | `.../Shipwright.cs` |
| `MagicSeller` (reactivos/magia) | `0x85` | `.../MagicSeller.cs` |
| `GuildMaster` (gremio) | `0x86` | `.../GuildMaster.cs` |
| `Healer` (curandero) | `0x87` | `.../Healer.cs` + `HealerServices.cs` |
| `InnKeeper` (posada) | `0x88` | `.../Innkeeper.cs` + ref. `InnKeeperServiceReference.cs` |
| (Guard `0xFE`, None `0xFF`, WishingWell `0xFD` — no son tiendas) | | |

El "tipo tienda" del walkthrough (herrero/taberna/posada/reactivos/healer/provisiones/
caballos/barcos/gremio) mapea así: **provisiones** las vende el **Barkeeper** (comida/
antorchas) y las tablas `SHOPPE_KEEPER_TOWNES_PROVISIONS`; **reactivos** los vende el
**MagicSeller**. No hay una clase "Provisioner" separada.

Factory que instancia la clase correcta según tipo:
`References/.../ShoppeKeeperDialogueReference.cs:204-237` (`GetShoppeKeeper`).

### 2.2 SHOPPE.DAT — formato del fichero

`References/.../ShoppeKeeperDialogueReference.cs:37-48`:

- Fichero: `FileConstants.SHOPPE_DAT` (`SHOPPE.DAT`).
- Un único chunk `StringList` que abarca **offset `0x00`, longitud `0x2797`** = "All
  Shoppe Keeper Conversations".
- Son cadenas **comprimidas**: cada string cruda se pasa por
  `CompressedWordReference.ReplaceRawMerchantStringsWithCompressedWords(...)` usando el
  diccionario de palabras comprimidas de `DATA.OVL`
  (`TALK_COMPRESSED_WORDS`, chunk `DATA.OVL:0x104c`, len `0x24e`). Ver
  `BuildConversationTable()` en `ShoppeKeeperDialogueReference.cs:175-186`.
- Resultado: una `List<string> _merchantStrings` indexable por número de diálogo.

Acceso: `GetMerchantString(nDialogueIndex, ...)` (`:118-126`) devuelve la cadena tras
sustituir variables. Selección aleatoria no repetida con
`GetRandomMerchantStringFromRange(min,max)` / `GetRandomIndexFromRange` (`:128-169`).

### 2.3 Sustitución de variables en diálogos

`ShoppeKeeperDialogueReference.GetMerchantString(...)` (`:65-95`). Tokens de plantilla:

| Token | Significado |
|---|---|
| `%` | cantidad de oro (`nGold`) |
| `&` | pieza de equipo actual (o "persona de interés") |
| `#` | negocio/tienda actual (`shoppeName`) |
| `$` | nombre del mercader (`shoppeKeeperName`) |
| `@` | comida/bebida del tabernero, o nombre del momento del día (`tod`) |
| `*` | ubicación de algo (`locationToFindPersonOfInterest`) |
| `^` | cantidad de algo (p.ej. reactivo `nQuantity`) |
| `char(20)` | tratamiento con género (sir/milady) |

### 2.4 Mapeo tienda ↔ ubicación ↔ tipo (ShoppeKeeperMap.json)

`References/.../ShoppeKeeperReferences.cs:24-79`:

- **La mayoría de los datos de shoppe keeper están en el código (OVL), no en ficheros de
  datos** — comentario textual `:28-29`. Por eso Redux mantiene un mapeo propio:
  - `DataFiles/ShoppeKeeperMap.json` (embebido como `Resources.ShoppeKeeperMap`),
    deserializado a `Dictionary<int, ShoppeKeeperReference>` en
    `LoadShoppeKeepersByIndex()` (`:81-87`). Cada entrada define `Location` y
    `ShoppeKeeperType` (strings → enums en `ShoppeKeeperReference.cs`).
- Nombres:
  - Nombres de tienda: `DATA.OVL` chunk `STORE_NAMES` (offset **`0xbfe`**, len `0x2fc`).
  - Nombres de mercader: `DATA.OVL` chunk `SHOPPE_KEEPER_NAMES` (offset **`0xefa`**, len
    `0x152`). Hay un dato basura ("Simplon") que Redux elimina a mano (`:38`).
  - El índice `i` liga por posición: `shoppeNames[i]` ↔ `shoppeKeeperNames[i]` ↔
    `ShoppeKeeperMap[i]`. Lista completa de las 46 tiendas y 47 nombres comentada en
    `ShoppeKeeperReferences.cs:119-214` (Iolo's Bows, The Honest Meal, etc.).
- Qué townes venden qué (tablas `ByteList` de índices de towne en `DATA.OVL`):

  | Servicio | Chunk | Offset | Nº bytes |
  |---|---|---|---|
  | Taverns | `SHOPPE_KEEPER_TOWNES_TAVERN` | `0x23ea` | 9 |
  | Caballos | `SHOPPE_KEEPER_TOWNES_HORSES` | `0x23fa` | 4 |
  | Barcos | `SHOPPE_KEEPER_TOWNES_SHIPS` | `0x240a` | 4 |
  | Reactivos | `SHOPPE_KEEPER_TOWNES_REAGENTS` | `0x241a` | 5 |
  | Provisiones | `SHOPPE_KEEPER_TOWNES_PROVISIONS` | `0x242a` | 3 |
  | Healing | `SHOPPE_KEEPER_TOWNES_HEALING` | `0x243a` | 7 |
  | Inns | `SHOPPE_KEEPER_TOWNES_INN` | `0x244a` | 6 |

  (Definiciones en `DataOvlReference.cs:2300-2325`.)

### 2.5 Herrero (armas/armadura): stock y precios

- **Stock por towne**: `ShoppeKeeperReferences.GetEquipmentList(nTown)` (`:89-104`) lee
  `WEAPONS_SOLD_BY_MERCHANTS` (`DATA.OVL` offset **`0x3af2`**, len `0x48` = **9 grupos ×
  8 bytes**). Cada byte es un `DataOvlReference.Equipment`. Las 9 ciudades con herrero:
  Britain, Jhelom, Yew, Minoc, Trinsic, British Castle, Buccaneer's Den, Border March,
  Serpent Hold (comentario `DataOvlReference.cs:2376-2377`). `Equipment.Nothing` se filtra.
- **Precios base de equipo**: `EQUIPMENT_BASE_PRICE` (`DATA.OVL` offset **`0x3a92`**, len
  `0x60`, formato **UINT16**). Expuesto vía `CombatItemReference.BasePrice` →
  `CombatItem.BasePrice` (`CombatItem.cs:19`).
- **Precio ajustado por Destreza** del Avatar (esto es el "regateo" real, determinista):
  `PlayerCharacters/CombatItems/CombatItem.cs:48-70`
  ```csharp
  const int nBaseDex = 33;
  // Compra: +3% por cada punto de DEX por debajo de 33, −3% por cada punto por encima
  buy  = BasePrice + BasePrice * 0.03f * (33 - Dexterity);
  // Venta: al revés
  sell = BasePrice - BasePrice * 0.03f * (33 - Dexterity);
  // ambos clamp a mínimo 1
  ```
- Flujo de compra (`BlackSmith.cs`): `GetForSaleList()` lista `a...`, `b...` con
  `EquipmentForSaleList`; `GetEquipmentBuyingOutput(equipment, nGold)` da la línea de
  diálogo por pieza (mapa equipo→índice de string en `:44-57`, offset +8 porque las
  strings de equipo no empiezan en 0); vender usa strings aleatorias del rango 49–56
  (`GetEquipmentSellingOutput`, `:149-153`). El herrero **no compra munición**
  (`DontDealInAmmoOutput`, `:116-119`).

### 2.6 Healer: heal / cure / resurrect

`MapUnits/.../ShoppeKeepers/HealerServices.cs` construye un diccionario
`ubicación → {Heal, Cure, Resurrect} → precio` desde 3 tablas de `DATA.OVL`:

| Servicio | Chunk | Offset | Formato |
|---|---|---|---|
| Heal | `HEALER_HEAL_PRICES` | `0x3d96` | 8 bytes |
| Cure | `HEALER_CURE_PRICES` | `0x3d9e` | 8 bytes |
| Resurrect | `HEALER_RESURRECT_PRICES` | `0x3da6` | 8 × UINT16 |

Índice = orden de `SHOPPE_KEEPER_TOWNES_HEALING`. `GetServicePrice(location, remedy)`
(`HealerServices.cs`). **Sin dependencia de karma** — precio fijo por ubicación.
`Healer.RemedyTypes = { Heal, Cure, Resurrect }`.

### 2.7 Posada (Innkeeper): descanso y camas

`References/.../ShoppeKeepers/InnKeeperServiceReference.cs`:

- Tabla hardcodeada de 6 posadas (`:14-40`), cada una:
  `InnKeeperServices(nOffset, DialogueOfferIndex, RestCost, MonthlyLeaveCost)`.

  | Ubicación | offset | Índice diálogo SHOPPE.DAT | Coste descanso | Coste dejar miembro/mes |
  |---|---|---|---|---|
  | Britain | 0 | 186 | 4 | 40 |
  | Jhelom | 1 | 187 | 6 | 60 |
  | Skara Brae | 2 | 188 | 4 | 40 |
  | North Britanny | 3 | 188 | 6 | 60 |
  | Paws | 4 | 189 | 4 | 40 |
  | Buccaneer's Den | 5 | 190 | 6 | 60 |

- **Camas (posición de dormir)**: `SleepingPosition = (INN_BED_X[offset], INN_BED_Y[offset])`
  desde `DATA.OVL`:
  - `INN_BED_X_COORDS` — offset **`0x4e8a`**, 6 bytes (`DataOvlReference.cs:2567-2568`).
  - `INN_BED_Y_COORDS` — offset **`0x4e90`**, 6 bytes (`:2569-2570`).
  - Construcción: `InnKeeperServiceReference.cs:62-70`.
- Opciones de la posada (`ShoppeKeeper.cs:26-41`, enum `DialogueType`):
  `RestInnkeeper`, `GossipInnkeeper`, `DropOffPartyMemberInnkeeper`.

### 2.8 Caballos, barcos, reactivos, provisiones (precios)

- **Caballos** (`MapUnits/Horse.cs:16-95`): precios base hardcodeados por ubicación
  (Trinsic 200, Paws 320, Buccaneer's Den 260). Ajuste por **Inteligencia**:
  `precio = base − base * 0.015 * INT` (`GetAdjustedPrice`, `:87-91`).
- **Barcos** (`MapUnits/SeaFaringVessels/Frigate.cs`, `Skiff.cs`): precios por ubicación
  hardcodeados:
  - Frigate: East Britanny 1300, Minoc 1500, Buccaneer's Den 1400, Jhelom 1200.
  - Skiff: East Britanny 250, Minoc 350, Buccaneer's Den 200, Jhelom 400.
  - Mismo ajuste por Inteligencia. `Shipwright.cs:59-67` da las ofertas
    (strings 117 = frigate, 118 = skiff, 120 = skiff dentro de frigate).
- **Reactivos** (`MagicSeller.cs` + `Reagent.cs`): precio base y cantidad de venta desde
  `DATA.OVL`:
  - `REAGENT_BASE_PRICES` — offset **`0x3a42`**, 40 bytes (`DataOvlReference.cs:2368-2369`).
  - `REAGENT_QUANTITES` — offset **`0x3a6a`**, 40 bytes (`:2371-2372`).
  - Ajuste de precio **por Karma** (única aparición de karma en precios): ver §1.3.
  - `MagicSeller.GetReagentBuyingOutput` (`:67-79`) usa strings a partir del índice 139.
- **Provisiones** (comida/antorchas, vendidas por el Barkeeper)
  (`Inventory/Provision.cs:75-91`): precio base por ubicación desde `ProvisionReferences`;
  ajuste por **Inteligencia**: `precio = base − INT * (base * 0.015)` (compra redondea
  abajo; venta al revés y redondea arriba). Referencia de diseño citada en el propio
  código: `http://infinitron.nullneuron.net/u5eco.html`.

### 2.9 ¿Hay regateo?

**No hay regateo aleatorio ni negociación turno a turno.** El "ajuste de precio" es
siempre determinista por estadística del Avatar:
- Armas/armadura → **Destreza** (±3%/punto respecto a 33).
- Provisiones, caballos, barcos → **Inteligencia** (−1.5%/punto).
- Reactivos → **Karma** (§1.3, actualmente binario por bug de entero).

Horario de apertura: `ShoppeKeeper.IsOnDuty(tod)` (`ShoppeKeeper.cs:177-182`) — el
mercader atiende cuando su índice de agenda (schedule) es 1 o 3. Estados de humor del
mercader (`HAPPY_START/STOP`, `PISSED_OFF_*` en `:59-62`) solo afectan qué string de
respuesta se elige, no el precio.

**GAP — verificar contra DOSBox/ULTIMA.EXE**: el flujo transaccional real (confirmar
compra, restar oro, añadir al inventario) se orquesta fuera de esta librería mediante
`ShoppeKeeperInteraction` turn-results + front-end; aquí solo están precios, stock y
strings.

---

## 3. Moongates + Fases lunares

### 3.1 Las 8 moonstones (enterrar/desenterrar)

`DayNightMoon/Moongates.cs`:

- `TOTAL_MOONSTONES = 8` (`:19`).
- Estado por moonstone: posición `Point3D (x,y,z)` + flag "enterrada".
- **Origen de datos: `SAVED.GAM`** (`ImportedGameState.cs:342-352`):

  | Dato | Chunk | Offset | Tamaño | Semántica |
  |---|---|---|---|---|
  | X coords | `MOONSTONE_X_COORDS` | `0x28A` | 8 bytes | válido solo si enterrada |
  | Y coords | `MOONSTONE_Y_COORDS` | `0x292` | 8 bytes | válido solo si enterrada |
  | Buried flags | `MOONSTONE_BURIED` | `0x29A` | 8 bytes | `0`=enterrada, `0xFF`=en inventario |
  | Z coords | `MOONSTONE_Z_COORDS` | `0x2A2` | 8 bytes | `0`=Britannia, `0xFF`=Underworld |

  (Rango total 0x28A–0x2A9, tal como indicaba el brief.)
- Constructor `Moongates(xPos, yPos, buriedFlags, zPos)` (`:46-65`): `bIsBuried = buried[i] == 0`
  (¡ojo, invertido: byte 0 = enterrada!). Construye además un diccionario
  posición→enterrada para lookup rápido.
- Índice ↔ fase: **el índice `i` (0–7) de la moonstone en el array ES su fase lunar**.
  - `Moonstone.MoongateIndex => (int)Phase` (`Inventory/Moonstone.cs:27`).
  - `Moongates.GetMoonPhaseByPosition(position, map)` (`:87-107`) busca la posición
    enterrada y devuelve `(MoonPhases)nPos` donde `nPos` es el índice en el array.
- Desenterrar (`Maps/LargeMap.cs:154-169`, `SearchAndExposeMoonstone`): si hay moonstone
  enterrada en `xy`, obtiene su fase por posición, la saca al mundo como
  `MoonstoneNonAttackingUnit`, y marca `SetMoonstoneBuried((int)moonPhase, false)`.
- Enterrar (`World.cs:2240-2262`, `TryToBuryMoongate`): solo en LargeMap y si
  `IsAllowedToBuryMoongate()` (`LargeMap.cs:138-142`: no permitido si ya hay una enterrada
  en esa posición). Llama `SetMoonstoneBuried(moonstone.MoongateIndex, true, posición3D)`.
  El índice bajo el que se entierra es la **fase** de esa moonstone.
- Las coordenadas iniciales de las 8 moonstones vienen del `SAVED.GAM` de partida nueva —
  Redux no las hardcodea. **GAP — verificar contra DOSBox/ULTIMA.EXE** las 8 posiciones
  de defecto (las conocidas del original: cerca de cada una de las 8 ciudades-moongate).

### 3.2 Fases lunares — DATA.OVL 0x1EEA

`References/MoonPhaseReferences.cs`:

- Enum `MoonPhases` (`:19-30`): `NewMoon=0, CrescentWaxing, FirstQuarter, GibbousWaxing,
  FullMoon, GibbousWaning, LastQuarter, CrescentWaning, NoMoon=8`. (8 fases reales 0–7 +
  `NoMoon`.)
- Enum `MoonsAndSun` (`:33-38`): `Trammel=4, Felucca=20, Sun=12` (valores usados como
  ángulos base para dibujar, no como índices).
- **Tabla de fases**: `DATA.OVL` chunk `MOON_PHASES`, offset **`0x1EEA`**, tamaño
  `0x1C * 2 = 56` bytes = **28 pares de bytes, uno por día del mes** (mes de 28 días).
  Definición: `DataOvlReference.cs:2276-2278`.
- Semántica de cada par (`GetMoonPhasesByTimeOfDay`, `:170-186`):
  - byte `[(Day-1)*2 + 0]` = fase de **Felucca** ese día.
  - byte `[(Day-1)*2 + 1]` = fase de **Trammel** ese día.
  - Cada byte está **offset por `0x30`** (`N_OFFSET_ADJUST`): valor real de fase =
    `byte − 0x30` (bytes 0x30–0x37 → fases 0–7).
- Mes de 28 días: `TimeOfDay.N_DAYS_IN_MONTH = 28` (`DayNightMoon/TimeOfDay.cs:13`),
  `Day` 1–28 (`:127-128`).

### 3.3 Qué fase abre qué gate y a dónde teleporta

- **Solo de noche**: `MoonPhaseReferences.GetMoonGateMoonPhase(tod)` (`:154-167`):
  ```
  if (tod.IsDayLight) return NoMoon;          // sin puerta de día
  if (Hour <= 4)      return Felucca phase;   // madrugada 0–4h
  if (Hour 20..23)    return Trammel phase;   // noche 20–23h
  ```
  `IsDayLight` = `Hour >= 5 && Hour < 20` (`TimeOfDay.cs:80`). Así que las moongates solo
  existen entre las 20:00–04:59; la madrugada usa **Felucca**, la noche temprana usa
  **Trammel**.
- **Destino del teleport** (`World.cs:606-617`, `GetMoongateTeleportLocation`):
  ```csharp
  return State.TheMoongates.GetMoongatePosition(
      (int)GameReferences.Instance.MoonPhaseRefs.GetMoonGateMoonPhase(State.TheTimeOfDay));
  ```
  Es decir: la fase lunar activa (0–7) indexa el array de moonstones y devuelve **la
  posición donde está enterrada esa moonstone** → allí te teletransporta. Como cada
  ciudad-moongate tiene su moonstone enterrada en su casilla, la fase determina la ciudad
  de destino.
- **¿Estás sobre una moongate activa?** `World.cs:620-628`
  (`IsAvatarOnActiveMoongate`): debe ser LargeMap, de noche, y haber una moonstone
  enterrada en la posición 3D actual del Avatar.
- El tile de la moongate se pinta sobre el mundo si hay moonstone enterrada ahí
  (`LargeMap.cs:375-383`; nota del autor: siempre incluyen la moongate y dejan que el
  juego decida). `VirtualMap.cs:258` también consulta `IsMoonstoneBuried`.
- **El acto de teleportar** (mover el Avatar, animación, avance de tiempo) **NO está en la
  librería** — solo se expone `GetMoongateTeleportLocation()`; lo consume el front-end
  (solo hay llamadas en los tests: `Ultima5ReduxTesting/Tests.cs:506-514`).
  **GAP — verificar contra DOSBox/ULTIMA.EXE** la animación/coste-de-turno del teleport.

### 3.4 Trammel y Felucca (las dos lunas)

- **Trammel** = luna exterior/lenta; **Felucca** = luna interior/rápida. En Redux ambas
  son índices en la tabla de 28 días (§3.2). Para el render del reloj celeste:
  - Ángulo Trammel: `D_TRAMMEL_ANGLE = 16/24*360 − 90` (`MoonPhaseReferences.cs:62`).
  - Ángulo Felucca: `D_FELUCCA_ANGLE = 8/24*360 − 90` (`:52`).
  - Ángulo Sol: `270°` (`:57`); posición general con `GetMoonAngle(tod)` (`:103-107`).
- Fases del día para iluminación (`GetTimeOfDayPhase`, `:116-126`): Sunset ≈ 19:00–19:50,
  Sunrise ≈ 06:10–07:00, Daytime 06<h<19, resto Nighttime.

### 3.5 ⚠️ Trampa: `GetLocationByMoonPhase` es engañoso

`MoonPhaseReferences.GetLocationByMoonPhase(moonPhase)` (`:142-146`) hace un cast directo
`(Location)(int)moonPhase`. Pero el enum `Location` empieza en
`Britannia_Underworld=0, Moonglow=1, Britain=2...`
(`References/Maps/SingleMapReference.cs:22-31`), así que fase 0 → Underworld, fase 1 →
Moonglow, etc. — **desalineado** respecto a las 8 ciudades-moongate reales
(Moonglow, Britain, Jhelom, Yew, Minoc, Trinsic, Skara Brae, New Magincia = Location 1–8).
Este método está marcado `UnusedMember.Global` y **no** es el mecanismo de destino real
(que es §3.3, vía posición enterrada). **No usar `GetLocationByMoonPhase` como verdad**;
la correspondencia fase→ciudad emerge de dónde está enterrada cada moonstone en
`SAVED.GAM`, no de este cast.

---

## Apéndice: tabla de offsets citados

### SAVED.GAM
| Offset | Tamaño | Contenido |
|---|---|---|
| `0x28A` | 8 | Moonstone X coords |
| `0x292` | 8 | Moonstone Y coords |
| `0x29A` | 8 | Moonstone buried flags (0=enterrada, 0xFF=inventario) |
| `0x2A2` | 8 | Moonstone Z coords (0=Britannia, 0xFF=Underworld) |
| `0x2E2` | 1 | Karma (byte) |

### DATA.OVL
| Offset | Tamaño/formato | Chunk |
|---|---|---|
| `0x1EEA` | 56 (28 pares) | `MOON_PHASES` (Felucca, Trammel por día; +0x30) |
| `0xbfe` | `0x2fc` StringList | `STORE_NAMES` |
| `0xefa` | `0x152` StringList | `SHOPPE_KEEPER_NAMES` |
| `0x104c` | `0x24e` StringList | `TALK_COMPRESSED_WORDS` (diccionario descompresión) |
| `0x23ea`.. | ByteList | `SHOPPE_KEEPER_TOWNES_*` (tavern/horses/ships/reagents/provisions/healing/inn) |
| `0x3a42` | 40 bytes | `REAGENT_BASE_PRICES` |
| `0x3a6a` | 40 bytes | `REAGENT_QUANTITES` |
| `0x3a92` | `0x60` UINT16 | `EQUIPMENT_BASE_PRICE` |
| `0x3af2` | `0x48` (9×8) | `WEAPONS_SOLD_BY_MERCHANTS` |
| `0x3d96` | 8 bytes | `HEALER_HEAL_PRICES` |
| `0x3d9e` | 8 bytes | `HEALER_CURE_PRICES` |
| `0x3da6` | 8×UINT16 | `HEALER_RESURRECT_PRICES` |
| `0x4e8a` | 6 bytes | `INN_BED_X_COORDS` |
| `0x4e90` | 6 bytes | `INN_BED_Y_COORDS` |

### SHOPPE.DAT
| Offset | Tamaño | Contenido |
|---|---|---|
| `0x00` | `0x2797` | Todas las conversaciones de mercader (strings comprimidos) |
