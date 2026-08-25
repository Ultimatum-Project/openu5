# (G)et sobre una ALFOMBRA APARCADA — la rama 0x149E y por qué el caballo, la fragata y el esquife NO se cogen

Ficha #346. Reporte del usuario (16-08, jugando en openu5.org): X-it de la alfombra mágica en
el sobremundo; la alfombra queda aparcada y VISIBLE en el mapa, y (G)et hacia ella responde
**«Nothing to get!»**. Derivación ESTÁTICA sobre `re/disasm/{CMDS,SJOG}.OVL.asm`.

Veredicto: **el original SÍ la recoge** — la alfombra es una de las dos excepciones escritas a
mano en el barrido de objetos de `cmd_get` — y **el port no la miraba por el canal por el que
llega**. Y el control simétrico sale al revés de como suele salir: el esquife, la fragata y el
caballo aparcados **tampoco se cogen en el original**, y eso es una propiedad DERIVADA del
mismo barrido, no una omisión del clon.

## 1. Qué byte deja `cmd_xit` al aparcar cada vehículo

`cmd_xit` (CMDS.OVL 0x0EB4) despacha por clase de transporte en 0x0EE8-0x0F11
(`and ax,0xFC` sobre `g_transport_tile`) y todas las ramas de éxito guardan un byte en
`[bp-2]`, que la cola común 0x0FF4 emite como campo **+0** de un registro nuevo de la tabla de
objetos DS:0x5C5A (contabilidad completa en `xit-esquife-270.md` §2).

| clase | rama | `[bp-2]` ← | byte +0 del objeto aparcado |
|---|---|---|---|
| 0x10 caballo | 0x0F60 | `g_transport_tile − 2` (0x0F6A `sub al,2`) | **0x10/0x11** `HorseRight/Left` |
| 0x14 alfombra | 0x0F20 | **`0x1B` LITERAL** (0x0F3F `mov byte [bp-2],0x1b`) | **0x1B** `Carpet2` |
| 0x24 fragata | 0x0F9C | `g_transport_tile` (0x0FAD/0x0FC4/0x0FE4) | **0x24-0x27** `ShipNoSails*` |
| 0x28 esquife | 0x0F72 | `g_transport_tile` (0x0F97 → 0x0F6C, **saltándose** el `sub al,2`) | **0x28-0x2B** `Skiff*` |

★ La alfombra es la ÚNICA que escribe un literal: montada es 0x14/0x15
(`RidingMagicCarpet*`) y aparcada es 0x1B (`Carpet2`), un sprite que no es `montada − 2`. El
caballo sí es `−2` porque montado es 0x12/0x13 (`RidingHorse*`) y suelto 0x10/0x11. Quien
generalice la regla del caballo a la alfombra se lleva 0x12, que no existe como objeto.

## 2. El barrido de objetos de `cmd_get` — CUATRO condiciones sobre el byte +0

`cmd_get` (SJOG.OVL 0x18CE) barre la tabla DS:0x5C5A con stride 8, **slots 1..31**
(0x1926-0x19BD; el 0 es el vehículo activo) **ANTES** de mirar el terreno (0x19C0). Por slot
exige x (0x1941), y (0x194B) y —si `g_location ≤ 0x7F`— piso (0x1960); y luego filtra por el
byte +0, en `cx`:

```
196a: cmp cx, 0x10   / 7c10 jl 0x197f    ; (A) kind < 0x10
196f: cmp cx, 0x19   / 740b je 0x197f    ; (B) == 0x19  (Moon = piedra lunar)
1974: cmp cx, 0x1b   / 7406 je 0x197f    ; (C) == 0x1B  ⭐ Carpet2
1979: and al, 0xfc   / 3cb4 cmp al,0xb4  ; (D) (kind & 0xFC) == 0xB4 (los 4 de trama)
197d: jne 0x19a6                          ;     si no, siguiente slot
```

Casado el slot, 0x1988-0x199F llama `get_item_switch(slot, byte+5, kind)` y **retorna**
(0x19A2 `jmp 0x1b2e`): el terreno ya no se consulta.

🔴 `re/notes/cmds.md §10` transcribe la condición (A) como «kind ∈ {0x10, 0x19, 0x1B}». Es
**`jl 0x10`**, o sea `kind < 0x10` — un rango, no el valor 0x10. Con la lectura vieja el
caballo aparcado (0x10) parecería cogible y la caja de sándalo (0x0E) no. Corregido aquí.

## 3. La rama de la alfombra: 0x149E

`get_item_switch` (0x1458) despacha la alfombra **fuera** de su jump-table de ids 1-8: el 0x1B
cae por `0x1464 jmp 0x172e` a la cadena secundaria por VALOR de object-tile, y ahí
`0x1756: cmp ax,0x1b / jne 0x175e` → `0x175b: jmp 0x149e` (ya derivado por
`lote-D-witnesses-relevo.md`, que resolvió el object-id = 0x1B por esta misma vía).

```
149e: mov ax, 0x8c5c / call print      ; "A magic carpet!\n"  (DATA.OVL fileoff 0x8C6C)
14a5: inc byte [g_carpets]             ; DS 0x57B0
14a9: cmp byte [g_carpets], 0x64 / jne ; clamp: si llega a 100 →
14b0: mov byte [g_carpets], 0x63       ;        se queda en 99
14b5: cmp byte [g_location], 0x11 / je ; SOLO en LB Castle:
14bf: mov ax,0x16 / call 0xffffbb92    ;   borra el slot 22 del dato estático
14c6: jmp 0x177a                       ; cola común
```

Cola común 0x177A, la que cierra la operación para TODAS las ramas del switch:

```
177a: cmp [bp+4], 0x20 / jge 0x178e    ; slot < 0x20 ⇒
1780: push 0 ×6 / push [bp+4] / call   ;   set_actor_record(slot, 0,0,0,0,0,0) = RANURA VACÍA
178e: or byte [g_unk_24e6], 2          ; ⭐ TURNO CONSUMIDO
1793: mov byte [g_unk_a9fa], 1
```

Es decir: **concede siempre, borra la ranura siempre, marca turno siempre**; el gate
`g_location == 0x11` sólo añade el borrado del dato estático de LB Castle (precisión ya
establecida en `lote-D-witnesses-relevo.md`, que además lee el `0x16` como el nº de slot 22 del
único `Carpet2` de fábrica). `0xffffbb92` es un thunk del kernel **sin resolver** (clase #81) y
no se nombra aquí; para la alfombra aparcada en el sobremundo la rama ni siquiera se alcanza.

## 4. Control SIMÉTRICO — los otros tres aparcados fallan las cuatro condiciones

Con los bytes de §1 contra el filtro de §2:

| aparcado | byte +0 | (A) <0x10 | (B) ==0x19 | (C) ==0x1B | (D) &0xFC==0xB4 | ⇒ |
|---|---|---|---|---|---|---|
| caballo | 0x10/0x11 | no | no | no | no (0x10) | **no se coge** |
| alfombra | 0x1B | no | no | **sí** | — | **se coge** |
| fragata | 0x24-0x27 | no | no | no | no (0x24) | **no se coge** |
| esquife | 0x28-0x2B | no | no | no | no (0x28) | **no se coge** |

Los tres que fallan caen al switch de terreno (0x19C0) y de ahí al fall-through 0x1B28
«Nothing to get!» (DS 0x8E64) — **sin turno**, porque esa salida no pasa por 0x178E. En 1988
esos tres se **abordan** ((B)oard, CMDS.OVL 0x07F6); la alfombra es la única que además es un
**contador de inventario** (`g_carpets` DS 0x57B0, el mismo que `cmd_xit` decrementa al
desplegarla desde la fragata en 0x0FDD), y por eso es la única con rama de recogida. La
asimetría es del binario, no del port: **no hay nada que ensanchar**.

## 5. Qué hacía el port y qué se ha cambiado

El clon tiene **DOS canales** para lo que el binario guarda en un solo registro de objeto —
`worldObjects` y el override de terreno del banco alto (`tile + 0x100`)—, equivalencia ya
declarada y ejercida por `board()` (#137, `board-137-acta.md`). La alfombra llega por los dos:

- **de fábrica** (LB Castle loc 17, slot 22, (15,18) z2): `hydrateInteriorObjects` la siembra
  como `worldObject` kind `"plot"` / `plotItem "carpet"`, y `get()` ya la recogía por su rama
  de trama → `grantPlotItem("carpet")`. Cubierto desde antes por `magic-carpet-get.test.ts`.
- **aparcada por (X)-it**: `exitTransport` devuelve `dropTile: 0x1b` y `exitVehicle` la escribe
  con `setMapOverride(x, y, 0x1b + ACTOR_TILE_BANK)`. `get()` **no miraba ese canal**: sus
  ramas de objeto son todas sobre `worldObjects`, así que el 0x11B caía a la cadena de TILES
  (antorcha / platos / trigo), no casaba con ninguno, y salía por el `else` que imprime
  «Nothing to get!» — literalmente el mismo fall-through 0x1B28, pero por el motivo
  equivocado. Ése es el reporte del usuario.

El fix añade en `game/src/core/game.ts::get()` una rama que lee el byte del banco alto de la
celda apuntada —el MISMO discriminante que `board()`— y, si vale 0x1B, llama a
`grantPlotItem("carpet")` (una sola implementación de la rama 0x149E para los dos canales),
borra el override y consume turno. Va colocada con las demás ramas de OBJETO, antes de la
cadena de tiles, que es el orden del binario (barrido 0x1926 antes del switch 0x19C0).

★ El espacio importa: el 0x1B **de terreno** es `Lighthouse`. Comparar el tile crudo en vez del
byte del banco alto concedería una alfombra al hacer (G)et sobre un faro — el mismo error de
espacio que #137 midió en `board()` (137 celdas transitables de falso positivo). Hay un caso de
prueba dedicado a eso.

## 6. Stream

**Cero RNG.** Ni el barrido de objetos (0x1926-0x19BD), ni la rama 0x149E, ni la cola 0x177A
llaman a `rand_range`; el grant es `inc` con clamp. La rama nueva del port tampoco toca el
generador, y no reordena ninguna tirada existente: en el camino anterior el mismo (G)et salía
por «Nothing to get!» **sin turno**, y ahora consume uno — el turno sí corre el reloj del
mundo, pero eso es la conducta del binario (0x178E), no una tirada. **Sin ventana de sellos.**

## 7. Cabos declarados (NO tocados aquí)

- **Persistencia**: la alfombra aparcada vive en `mapOverrides`, que sí viaja en el save del
  clon; la de fábrica vive en `worldObjects`, con los problemas conocidos de #106/#131/#136.
  Esta ficha no cambia ninguno de los dos canales — sólo los LEE.
- ~~**`cmds.md §10`** sigue diciendo «kind ∈ {0x10, 0x19, 0x1B}» donde el binario dice
  `kind < 0x10` (§2). Corregirlo toca un fichero de otro carril; queda anotado aquí.~~
  **RESUELTO 17-08 (ficha #354, carril fix-354-281)**: `cmds.md` §10 corregido
  tachado-documentado con la derivación de §2 re-verificada sobre el árbol.
- ~~**Piedra lunar (byte +0 = 0x19, rama 0x148C)**: es la OTRA excepción escrita a mano del
  barrido, y no se ha careado si el port la recoge por sus dos canales. Fuera de alcance.~~
  **RESUELTO (ficha #357, carril fix-354)**: careado canal a canal. El único PRODUCTOR de
  kind 0x19 en el binario es `search_moonstone` (SJOG 0x03A8: push 0x19 @0x0428 →
  place-object 0x7AF4 @0x043C) — ni `bury_moonstone` (CAST 0x1596, escribe solo los cuatro
  arrays) ni la tabla fija de search (0 entradas id 25 en data.json) colocan piedras — así
  que en el port TODA piedra llega por el canal `worldObjects` kind "search"
  (`game.ts::search` → `placeSearchObject`), y el canal del banco alto queda vacío A
  PROPÓSITO (censo de `setMapOverride` en game/src: 0x110 establo, dropTile de X-it, 0x110
  wish — nadie escribe 0x119). El grant ya estaba (`applySearchGrant` id 25 =
  `[bx+0x5840]=0xFF` de 0x1496); lo que FALTABA era el NOMBRE de la rama 0x148C:
  `lootItemName` no tenía case 25 y el default anunciaba «An item!» donde el binario imprime
  DS 0x8C4E «A moonstone!\n» (fileoff 0x8C5E, controles vecinos 0x8C3E/0x8C5C). Portado con
  estreno en rojo (`moonstone-search.test.ts`, describe del (G)et #357).
