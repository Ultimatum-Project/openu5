# Reciclado de ranuras de actor, y el sellado de la boca de Doom

Derivación sobre el binario de 1988. Dos mecanismos independientes que comparten sujeto
(la tabla de 32 ranuras de actor y el mapa del Underworld) y que se midieron juntos.

Sujeto = BINARIO. Fichas #104 y #120.

---

## 1. `acquire_actor_slot`, es una cascada de DIEZ llamadas, no de ocho

`ULTIMA.EXE:0x38e4`, 232 B, `ret` pelado (cero argumentos), devuelve índice de ranura en
`ax`, o cero si no hay. Delega DIEZ veces en el escáner `ULTIMA.EXE:0x3868`, (124 B,
`ret 6`), cortocircuitando en el primer resultado no nulo.

Las diez llamadas, y sus argumentos por orden de `push`, que es `(lo, hi, cerca)`:

| # | dirección | lo | hi | cerca | clase de ranura que desaloja |
|---|---|---|---|---|---|
| 1 | `0x38ef`, | 0 | 0 | 0 | ranura LIBRE (tile 0) |
| 2 | `0x3905`, | 0x01 | 0x0f | 1 | objetos sueltos, fuera de pantalla |
| 3 | `0x391d`, | 0x80 | 0xff | 1 | monstruos y artefactos, fuera de pantalla |
| 4 | `0x3935`, | 0x10 | 0x11 | 1 | caballos sin jinete, fuera de pantalla |
| 5 | `0x394d`, | 0x30 | 0x7f | 1 | personas, fuera de pantalla |
| 6 | `0x3964`, | 0x01 | 0x0f | 0 | objetos sueltos, en pantalla también |
| 7 | `0x397b`, | 0x80 | 0xff | 0 | monstruos y artefactos, en pantalla también |
| 8 | `0x3992`, | 0x10 | 0x11 | 0 | caballos, en pantalla también |
| 9 | `0x39a9`, | 0x30 | 0x7f | 0 | personas, en pantalla también |
| 10 | `0x39bf`, | 0x00 | 0xff | 0 | CUALQUIERA |

`re/notes/kernel-turno-acta.md:281`, ya daba esta misma tabla de diez el 07-08; esta
lectura la reproduce a ciegas y vale de control. Lo que estaba mal era el CARDINAL DE LA
FICHA #104, que decía ocho y omitía las dos que deciden el asunto: la primera (ranura
realmente libre) y la décima (barrido total sin exclusión de rango).

`re/notes/kernel-sweep-3.md:262`, lista sólo cuatro, y además con los argumentos escritos
en otro orden.

### El escáner, y su única exclusión cableada

`ULTIMA.EXE:0x3868`, recorre las ranuras 1 a 23 (`cx=1`, `cmp cx,0x18`, `jl`), registros de
8 B desde `DS:0x5c5a`, con tile en `+0`, x en `+2`, y en `+3`. Acepta la primera ranura que
cumpla las tres condiciones:

1. `tile >= [bp+8]` y `tile <= [bp+6]`, el rango paramétrico, en `0x3885` y `0x388a`;
2. `cmp al, 0xb5`, `je`, en `0x388f` y `0x3891` — **la Corona queda excluida SIEMPRE**;
3. si `[bp+4]` no es cero, la ranura ha de estar FUERA de la ventana de 11×11 centrada en
   el grupo: acepta si `(x − g_party_x + 5) > 10` sin signo, o si `(y − g_party_y + 5) > 10`,
   en `0x38b0` y `0x38b4`.

La ranura 0 nunca entra en el barrido, y el cero que devuelve al fallar es también el
índice de esa ranura 0, el centinela ambiguo de la ficha #50.

La comparación con `0xb5` vive DENTRO del escáner, así que rige en las diez llamadas,
incluida la décima. Ése es el sentido exacto del titular de la ficha #104: la Corona no es
que tenga baja prioridad, es que **no es desalojable por ninguna de las diez**.

### Qué cae a cada lado, con nombre

El byte `+0` del registro es `tile − 0x100`. Traducido con `game/src/core/data/TileData.json`:

| banda | tiles | contenido | prioridad de desalojo |
|---|---|---|---|
| `0x00`, | 256 | ranura vacía | 1ª |
| `0x01`-`0x0f`, | 257-271 | cofre, oro, poción, pergamino, arma, escudo, llave, gema, yelmo, anillo, armadura, ankh, antorcha, caja de sándalo, comida | 2ª y 6ª |
| `0x10`-`0x11`, | 272-273 | caballo sin jinete | 4ª y 8ª |
| `0x12`-`0x2f`, | 274-303 | caballo y alfombra CON jinete, símbolo de suelo, escaleras, luna, cama, alfombra, avatar, aparición, cadáver, salpicadura, naves, esquifes, naves piratas | sólo la 10ª |
| `0x30`-`0x7f`, | 304-383 | sillas ocupadas, espejo de Lord British, y todas las PERSONAS | 5ª y 9ª |
| `0x80`-`0xff`, | 384-511 | todas las CRIATURAS, y con ellas los cuatro artefactos y el Shadowlord | 3ª y 7ª |

Los cinco valores de la ficha, y los dos que la ficha no nombraba:

| valor | tile | qué es | ¿reciclable? |
|---|---|---|---|
| `0xb4`, | 436 | Shard | sí, banda 3ª |
| `0xb5`, | 437 | **Corona** | **NO, nunca** |
| `0xb6`, | 438 | Cetro | sí, banda 3ª |
| `0xb7`, | 439 | Amuleto | sí, banda 3ª |
| `0xfc`, | 508 | Shadowlord, los tres usan el mismo tile | sí, banda 3ª |

El tile del Shadowlord sale de `TOWN.OVL:0x03a1`, y `0x03a6`, donde `town_place_shadowlord`
escribe `0xfc` en `+0` y en `+1` del registro. Los tres Shadowlords comparten valor; los
tiles 508 a 511 son los cuatro fotogramas del mismo sprite, no tres criaturas distintas.

**La asimetría en una frase:** los cuatro artefactos de Lord British son cuatro bytes
CONSECUTIVOS, viven todos en la banda que se desaloja en TERCER lugar —antes que las
personas, que se desalojan en quinto— y la comparación cableada rescata exactamente uno.

Y un contraste que ordena el criterio: la banda `0x12`-`0x2f`, que ninguna de las nueve
primeras llamadas toca, es la del transporte del grupo y su propio avatar. El binario
protege el vehículo del jugador por PRIORIDAD, y la Corona por EXCLUSIÓN. Son dos
mecanismos distintos, y sólo el segundo es absoluto.

### El criterio no es posicional

Es una comparación de VALOR sobre el tile. No interviene el índice de ranura, ni la
coordenada, ni la localización. La única condición geométrica es la ventana de 11×11 del
argumento `cerca`, y se aplica igual a todos los valores admitidos por el rango.

---

## 2. Los once llamadores externos, y sus contextos

Censo propio sobre los `.asm` de los 24 overlays más el kernel, resolviendo cada `E8 rel16`
con la base del overlay LLAMADOR (`re/tools/dispatch_table.py`, `overlay_near_call_base`).
Resultado: **21 llamadas, 10 internas y 11 externas**, y ninguna referencia indirecta —el
valor `0x38e4`, no aparece como word en el segmento de código del kernel, ni tampoco
`0x3868`, y no hay ningún `jmp` a ninguna de las dos.

`find_recyclable_object_offscreen` **no tiene llamador fuera de** `acquire_actor_slot`.

| llamador | dirección | contexto de `g_location` |
|---|---|---|
| `town_place_shadowlord`, | `TOWN.OVL:0x0314`, | pueblo con Shadowlord presente; se llama SIEMPRE que no haya ya una ranura con tile `0xfc`, no sólo cuando el pool está lleno |
| `npc_place`, | `TOWN.OVL:0x1785`, | colocación de NPC al entrar a un pueblo |
| `mainout_enter_location`, | `MAINOUT.OVL:0x07fd`, | sobremundo; es la rutina que ESCRIBE `g_location` |
| `spawn_purchased_ship`, | `MAINOUT.OVL:0x0d33`, | sobremundo |
| `spawn_monster`, | `MAINOUT.OVL:0x1021`, | sobremundo |
| `troll_toll`, | `MAINOUT.OVL:0x1bbd`, | sobremundo |
| `wishing_well`, | `LOOKOBJ.OVL:0x012c`, | compara `g_location` con `0x16`, y con `0x1f` |
| `search_strange_rock_spawn`, | `SJOG.OVL:0x0422`, | lee `g_location` |
| `search_fixed_hidden_items`, | `SJOG.OVL:0x05bd`, | lee `g_location` |
| `cmd_xit`, | `CMDS.OVL:0x0ff4`, | compara `g_location` con `0x20`, y con `0x29` |
| `summon_shadowlord_by_name`, | `CMDS.OVL:0x10c0`, | compara `g_location` con `0x1e`, `0x1f`, y `0x20` |

Los cuatro de `MAINOUT.OVL` son sobremundo puro. Los dos de `TOWN.OVL` corren al entrar a
un pueblo, y son los que hacen alcanzable el desalojo de un artefacto: en un pueblo o
fortaleza las ranuras 1 a 23 llevan NPCs, y colocar un NPC más prefiere desalojar la banda
`0x80`-`0xff`, donde está el Cetro de Stonegate, antes que la banda `0x30`-`0x7f`, donde
están los propios vecinos.

Posiciones canónicas, de `re/notes/npc-object-actors.md`: la Corona es un actor del fichero
`.NPC` de Blackthorn, y el Cetro lo es de Stonegate.

**Alcanzabilidad: SIN MEDIR.** El desalojo exige que las 23 ranuras estén ocupadas. Que eso
ocurra en Blackthorn o en Stonegate no se ha medido, y no se afirma aquí.

---

## 3. El camino de (G)et NO pasa por la cascada, es su operación inversa

`cmd_get`, `SJOG.OVL:0x18ce`, no llama a `acquire_actor_slot` —no está entre los once—.
Barre la tabla buscando un objeto en la celda apuntada y aplica un filtro de tile en
`0x196a` a `0x197d`. El conjunto RECOGIBLE es:

- `0x01`-`0x0f`, los quince objetos sueltos, por `cmp cx,0x10`, `jl`;
- `0x19`, la piedra lunar, y `0x1b`, la alfombra, por dos comparaciones sueltas;
- `0xb4`-`0xb7`, los cuatro artefactos, por `and al,0xfc`, `cmp al,0xb4`.

El despacho por valor lo hace `get_item_switch`, `SJOG.OVL:0x1458`, en `0x175e` a `0x1776`:
`0xb4` va a `0x16b6`, `0xb5` va a `0x16e6` y pone `g_crown` a `0xff`, `0xb6` va a `0x1706` y
pone `g_sceptre`, `0xb7` va a `0x1712` y pone `g_amulet_lb`. Al final, en `0x177a` a
`0x178b`, y sólo si el índice de ranura es menor que `0x20`, empuja seis ceros y llama a
`write_object_slot` — es decir, LIBERA la ranura escribiendo tile 0.

Dos consecuencias:

1. Hay DOS comparaciones cableadas contra `0xb5` en el binario, en dos rutinas sin relación:
   la del escáner, que protege la Corona del reciclado, y la de `get_item_switch`, que la
   despacha al recogerla. Son independientes.
2. Cruzando el conjunto recogible con las bandas de reciclado: **la piedra lunar y la
   alfombra están MEJOR protegidas del desalojo que el Cetro, el Shard y el Amuleto**, por
   caer en la banda `0x12`-`0x2f`, a la que sólo llega la décima llamada.

---

## 4. La boca de Doom está sellada en los datos ORIGINALES

### El mapa del port es byte a byte el original

`game/assets/maps/underworld.json`, careado celda a celda contra `original/u5/ultima5/UNDER.DAT`
decodificado en 256 chunks de 16×16: **0 diferencias sobre 65 536 celdas**. La hipótesis
«el mapa del port difiere del extraído» queda REFUTADA.

### La tabla de bocas, y una errata de corpus

Coordenadas de entrada por localización, en `DATA.OVL`: X en el fichero en `0x1e9a`, e Y en
`0x1ec2`, 40 entradas cada una, indexadas por `location − 1`. Las ocho mazmorras son las
entradas 32 a 39, o sea X en `0x1eba`, e Y en **`0x1ee2`**.

🔴 El corpus arrastraba **`0x1eea`** para la Y. `0x1eea` es `moonPhases`. El ledger, en
`re/ledger/frontier.json`, ya tenía el valor correcto. La ficha #118 heredó la errata al
citarse. **CORREGIDO el 2026-08-10 (#141): eran CINCO sitios, no tres.** Este párrafo
listaba `game/src/core/game.ts`, `game/src/momentos/defs.ts` «y el diseño de los momentos»,
y de ahí salió el cardinal 3 de la ficha; faltaban `game/tests/yell-dungeon-seal.test.ts` y
`game/e2e/grandtour/ch17-doom.spec.ts`. Los cinco, corregidos a `0x1ee2`.

⚠️ **`0x1eea` tiene CUATRO referentes en el corpus y TRES son correctos**, así que no se
arregla con un reemplazo del número: (a) `DATA.OVL` fo `0x1EEA` = `MOON_PHASES`, decenas de
sitios legítimos; (b) esta Y mal citada; (c) el rango `0x1eea-0x1ef4` de la curva del
hechizo de área; (d) `ULTIMA.EXE` código `0x1eea` = `dos_select_drive`. El discriminante es
**la pareja «X-de-bocas, barra, `0x1eea`»**, no el número suelto — por eso este párrafo, que
no la escribe contigua y nombra las dos
direcciones en frases distintas, no es una miscita y la guarda no lo señala.

CONTROL que separa las dos tablas sin creerse ninguna cita (rehecho el 10-08 contra
`DATA.OVL`): el chunk de cada boca es `(y & 0xf0) | (x >> 4)` y tiene que reproducir la tabla
de `DATA.OVL 0x3876`. Con Y en `0x1ee2` sale **8/8**; con Y en `0x1eea`, **0/8**. Y los 56 B
de `0x1eea` caen todos en `0x30..0x4f`, la firma de las fases (+0x30).

★ La CIFRA nunca estuvo mal, sólo la CITA: el port siempre dijo Doom en (128,128), que es lo
que da `0x1ee2` (`0x1eea` habría dado (128,50)). Por eso el veredicto de #118 SOBREVIVE —
comparó datos reales y los datos eran los buenos. Es el caso de libro de «la cita junto a la
cifra no es una comprobación de la cifra»: la pareja llevaba meses ahí, con el número bueno
al lado del offset malo.

Doom es la localización 40, índice 39: X = `0x80`, e Y = `0x80`, o sea la celda 128,128. Es
la única de las ocho cuya celda en el mapa de superficie es agua; en el Underworld lleva
`0x16`, CaveEntrance. Control: barrer las 65 536 celdas de `UNDER.DAT` buscando `0x16`,
`0x17`, y `0x18`, devuelve exactamente esas ocho coordenadas.

### La tabla de pasabilidad, y la trampa de bits que invierte el veredicto

`kernel_tile_passable`, `ULTIMA.EXE:0x2c4c`, saca la CLASE del vehículo de la tabla en el
fichero en `0x5504`, indexada por `vehicle_tile >> 2`, y despacha por una tabla de saltos de
once entradas en `0x2d60`. La clase 0 consulta el mapa de bits de andabilidad en
`ULTIMA.EXE:0x2bd4`, cuyo cuerpo es la definición del formato:

```
2bda: mov ax, 0x80
2bdd: mov cl, byte [bp+4]      ; el tile
2be2: and cx, 7
2be5: sar ax, cl               ; mascara = 0x80 >> (tile & 7)   <-- MSB primero
2bec: sar bx, 3                ; byte    = tile >> 3
2bee: mov cl, byte [bx + 0x54d4]
2bf4: test cx, ax
2bf6: je ...                   ; bit A CERO = PASABLE
```

🔴 **La máscara es `0x80 >> (tile & 7)`, no `1 << (tile & 7)`.** Quien lea el mapa de bits
con el orden LSB obtiene el veredicto INVERTIDO justo en los dos tiles que deciden esta
ficha: da `0xff` bloqueado y `0x0d` pasable, cuando la verdad es la contraria. Controles con
cuatro tiles de verdad conocida, todos coherentes sólo con el orden MSB: agua `0x01`
bloqueada a pie, montaña alta `0x0d` bloqueada, montaña baja `0x0c` bloqueada —de ahí que
(K)limb necesite el gancho—, y boca de cueva `0x16` pasable.

**`0xff`, BlackSquare, es PASABLE en el binario.** El port lo bloquea, y eso es una
divergencia YA declarada y bendecida, en `game/src/core/world/movement.ts:84-91`, que cita
este mismo mapa de bits.

⇒ **las tres celdas de la ficha #120 son un artefacto de esa divergencia del port, no una
propiedad del original.** Y las 259 celdas que la ficha llamaba «contrafactual» son, en
realidad, la componente REAL del binario. El contrafactual medía lo correcto y se archivó
como hipotético.

### El sellado, medido con los predicados del propio binario

Inundación desde la celda 128,128 sobre `UNDER.DAT`, con el mapa de bits del binario:

| régimen | celdas | tiles de la frontera | ¿alcanza otra boca, el Amuleto, o la caída del remolino? |
|---|---|---|---|
| a pie | 259 | `0x0c` ×209, `0x0d` ×31, `0x03` ×46, `0x6c`-`0x6f` ×24 | no |
| a pie + (K)limb con gancho | 675 | `0x0d` ×295, `0x03` ×111, `0x6c`-`0x6f` ×66 | no |
| a pie + gancho + agua | 5 091 | **`0x0d` ×1 124, y nada más** | no |

La bolsa más ancha está cerrada por un anillo continuo de 1 124 montañas altas, `0x0d`. Y
`0x0d`, es el único tile que ninguna clase de vehículo cruza: la clase 0 lo tiene bloqueado
en el mapa de bits, la alfombra y el caballo consultan ese mismo mapa, el esquife y la
fragata sólo pasan agua, y `cmd_klimb`, en `CMDS.OVL:0x1c84`, lo rechaza por nombre con
«Impassable!», admitiendo únicamente `0x0c`.

Censo de las once clases de vehículo: las del grupo son la 0 a pie, la 2 alfombra, la 3
caballo, la 5 esquife, y la 6 fragata. **Ninguna cruza `0x0d`.** Las clases 1, 4, 7, 8, 9 y
10 pertenecen a tiles de criatura, no de transporte del grupo.

Censo de tiles DENTRO de la bolsa de 5 091: terreno y agua, más **una sola** boca de cueva,
la de Doom. No hay puerta lunar —`0xdc`—, ni escaleras.

### Quién escribe la posición del grupo en esa celda

Censo de `mov byte [g_party_x]` sobre los 25 listados: 22 sitios. Los que cambian de plano
son la salida de mazmorra, `DUNGEON.OVL:0x1d08`, que lee esas mismas tablas de bocas y pone
`g_floor` a `0xff` al volver al Underworld; el remolino, `MAINOUT.OVL:0x12b7`, que deja al
grupo en la celda 34,18; y la caída guionizada de `OUTSUBS.OVL:0x0500`, desde la celda
54,138. Ninguno escribe 128,128 salvo la salida de mazmorra con `g_location` igual a 40, es
decir, saliendo de Doom.

Detalle que confirma que bajar al Underworld es ruta prevista: `dungeon_enter`,
`MAINOUT.OVL:0x0790`, en `0x088f`, discrimina si se entra DESDE el Underworld, y en ese caso
arranca en la planta 8 — salvo para Doom, que siempre arranca en la planta 1. La entrada
exige ir a pie, en `0x07bf`, y para Doom exige además los tres Shadowlords destruidos, en
`0x07d8` a `0x07f1`.

### Veredicto de la ficha #120, y lo que queda

La bolsa de Doom está aislada **también en los datos originales**, no sólo en el port. La
ficha atribuía el aislamiento a los datos del port, y eso es falso por dos vías
independientes: el mapa coincide byte a byte, y el aislamiento persiste al usar el mapa de
bits del binario.

Lo que **no** queda contestado es la pregunta de la ficha: cómo llega el grupo a Doom la
PRIMERA vez. Con lo leído, el único escritor de esa celda es la salida de la propia Doom.
Quedan sin leer: los objetos de `INIT.GAM` dentro de la bolsa, la tabla de destinos de las
puertas lunares, y la caída por pozo de `DUNGEON.OVL:0x0af0`, que pone `g_location` a cero
sin escribir la posición del grupo. **No se afirma que el original sea inalcanzable**; se
afirma que la ruta no está en el código leído.

---

## 5. Careo con el port, para los cinco valores

El clon no tiene camino de desalojo en ninguna de sus dos listas de ranuras:

- `firstFreeSlot`, en `game/src/core/world/enemies.ts:215-224`, barre 1 a 23 ascendente y
  devuelve −1 si está lleno. El comentario declara el hueco: «Si el pool está lleno el
  binario evicta por prioridad; el port lo capa con maxEnemies». `MAX_ENEMIES_DEFAULT` es 8.
- `findFreeObjectSlot`, en `game/src/core/world/worldObjects.ts:41-46`, barre 31 a 1
  descendente, espejo de `find_free_actor_slot`, de `SJOG.OVL:0x0000`, que es un allocator
  DISTINTO del de esta nota.

Corona y Cetro no viven en esas listas: son ítems de trama, con el mapa de tile a ítem en
`game/src/core/quest/items.ts:54-58`, y el grant en `grantPlotItem`. El Shadowlord urbano sí
lleva el tile `0xfc`, en `game/src/core/world/shadowlord-urban.ts:49`, con la cita de
`TOWN.OVL:0x03a1`.

| valor | binario | port | veredicto |
|---|---|---|---|
| Corona | nunca reciclable | nunca reciclable, por ausencia de desalojo | mismo resultado, mecanismo AUSENTE — fidelidad vacua |
| Cetro | reciclable, banda 3ª | nunca reciclable | DIVERGE, el port protege de más |
| Shard | reciclable, banda 3ª | nunca reciclable | DIVERGE, igual |
| Amuleto | reciclable, banda 3ª | nunca reciclable | DIVERGE, igual |
| Shadowlord | reciclable, banda 3ª | nunca reciclable | DIVERGE, igual |

La causa es una sola, y ya tiene ficha: el port PARTE EN TRES un pool que el binario
comparte, que es la ficha #103. Mientras el reparto siga partido, el desalojo no se puede
calcar, porque el port no sabe cuántas de las 23 ranuras están realmente ocupadas: el
conjunto `occupied` de `trySpawn` se construye sólo con `this.enemies`.

No se abre fila del registro público de bugs. El asunto del binario —tres de los cuatro
artefactos son desalojables y el cuarto no— es un candidato razonable, pero su
alcanzabilidad está SIN MEDIR, y el criterio vigente pide medirla o declararla antes de
publicar.

---

## 6. Los tres cabos del §4, medidos — y los tres cierran en NEGATIVO

Encargo del lead tras la primera entrega. Ninguno de los tres abre una ruta a la boca de
Doom, y el segundo resultó ser un mecanismo mal entendido, no un dato que faltara.

### 6.1 Objetos sembrados dentro de la bolsa: NO HAY

El Underworld **no tiene lista de objetos propia**. `UNDER.OOL`, mide 256 B y es la tabla de
indirección de chunks, la de la ficha #34, no un inventario. Lo único que el binario planta
en el Underworld lo hace por código: `OUTSUBS.OVL:0x0566`, siembra el Amuleto y los tres
Shards al entrar, con la guarda `g_floor != 0` y, por objeto, `g_shard_taken[i] == 0` más
`g_shadowlord_locs[i] < 0x80`.

| objeto | coordenada | tile | ¿dentro de la bolsa de 5 091? |
|---|---|---|---|
| Shard 0 | 192,80 | `0x05`, | no |
| Shard 1 | 130,65 | `0x0f`, | no |
| Shard 2 | 176,184 | `0x05`, | no |
| Amuleto | 105,225 | `0x30`, | no |

Los tres Shards salen de tres tablas de 3 B en `DATA.OVL`, leídas en `OUTSUBS.OVL:0x05bf`,
`0x05c6` y `0x05d1`; el Amuleto va con literales en el propio código, `OUTSUBS.OVL:0x0581`
a `0x0593`.

### 6.2 Puertas lunares: el destino NO es una tabla fija, es dónde ENTERRASTE la piedra

La ficha buscaba «la tabla de destinos de las puertas lunares». **No existe.**
`kernel_moongate_teleport`, `ULTIMA.EXE:0x47f4`, indexa CUATRO arrays paralelos de 8 B por
fase lunar, que son el estado de las ocho piedras lunares:

| array | DS | fichero `.GAM` | contenido |
|---|---|---|---|
| x | `0x5830`, | `0x28a`, | columna donde está enterrada |
| y | `0x5838`, | `0x292`, | fila |
| loc | `0x5840`, | `0x29a`, | **`g_moonstone_loc`**, y `0xff` = no enterrada |
| floor | `0x5848`, | `0x2a2`, | planta |

El offset de fichero sale de que `DS 0x55A6`, es la imagen en RAM del `.GAM`; control:
`0x5c5a − 0x55a6 = 0x6b4`, que es la tabla de objetos ya acreditada.

La guarda de la puerta es `cmp byte [bx + 0x5840], 0xff`, en `0x47fd`: si la piedra de esa
fase no está enterrada, la rutina devuelve 0 y **no teletransporta**. Si lo está, escribe
los cuatro campos sobre `g_location`, `g_party_x`, `g_party_y` y `g_floor`, en `0x4841` a
`0x4856`. La escriben `CAST.OVL:0x1599`, al enterrar, y `SJOG.OVL:0x1496`, que planta el
`0xff`, al recogerla.

Y el índice de fase sale del texto de fases: `moongate_enter`, `ULTIMA.EXE:0x48a8`, lee
`0x5885` u `0x5886` según la hora y le resta `0x30`, en `0x4969` a `0x4973` — es un dígito
ASCII. ★ Eso **confirma por un tercer camino** que `DATA.OVL` fileoff `0x1eea`, es
`moonPhases` y no la tabla Y de bocas, que es la errata de la ficha #141.

⇒ una puerta lunar SÍ puede dejarte en el Underworld, porque el campo de planta se copia
tal cual. Pero sólo si hay una piedra enterrada allí, lo que exige haber llegado antes.
**Estado inicial medido, idéntico en `INIT.GAM` y en `SAVED.GAM`: las ocho piedras con
`loc = 0x00` y `floor = 0x00`**, o sea las ocho en la superficie de Britannia. Ninguna en el
Underworld, ninguna en la bolsa. **No hay ruta inicial por esta vía.**

### 6.3 La caída por pozo: sale de la mazmorra, pero NO al Underworld

`dng_pit_fall`, `DUNGEON.OVL:0x0a4c`, 306 B, un solo llamador en `0x0e00`. El pozo sólo
dispara con `g_floor < 8`, en `0x0a6e`; incrementa la planta en `0x0aa4`, lee el tile de la
planta nueva y **vuelve al principio**, en `0x0aed`, así que los pozos encadenan. Cuando la
planta llega a 8 la comparación de `0x0a6e` ya rechaza, se cae a `0x0af0` y ahí:

```
0af0: cmp byte [g_floor], 8
0af5: jne 0xafc
0af7: mov byte [g_location], 0
```

Resultado: `g_location = 0`, `g_floor = 8`, y **la posición del grupo NO se reescribe** — se
queda con las coordenadas de celda de mazmorra, de 0 a 7. El llamador no lo arregla: tras el
`call`, salta a `0x0e1f`, hace dos llamadas al kernel y retorna.

`g_floor = 8` no es 0, que es Britannia, ni `0xff`, que es el Underworld. Y el discriminante
que lo cierra: **`UNDER.DAT` se carga en UN SOLO sitio de todo el binario**,
`OUTSUBS.OVL:0x0542`, dentro de la caída guionizada de la celda 54,138 — que pone
`g_floor = 0xff` explícitamente en `0x0515`. Medido con dos instrumentos, el símbolo y el
inmediato crudo `f1 39`: un acierto cada uno, el mismo.

⇒ **la caída por pozo no es la vía al Underworld**, y desde luego no a la boca de Doom: no
escribe la celda 128,128 ni carga el mapa. La vía de mazmorra al Underworld es la otra,
`dng_exit`, `DUNGEON.OVL:0x1d08`, que sí pone `g_floor = 0xff` en `0x1d2c` y sí escribe la
posición desde las tablas de bocas.

🔴 **Cabo NUEVO que deja abierto, y que no es de esta ficha:** el estado
`g_location = 0` con `g_floor = 8` y coordenadas sin reescribir es un estado fuera de banda.
**NO he leído el bucle principal** que reacciona a `g_location == 0`, y ahí podría vivir un
saneado. Lo que sí está medido es que el saneado no está ni en `dng_pit_fall` ni en su
llamador, y que la planta 8 no puede seleccionar el mapa del Underworld. Alcanzabilidad sin
medir: exige un pozo en la planta 7 de alguna mazmorra.

### 6.4 Veredicto de los tres cabos

Los tres cierran en negativo, y con eso la declaración del §4 se estrecha pero no cambia de
signo: **sigue sin aparecer la ruta por la que el grupo llega a la boca de Doom la primera
vez**, y ahora se han descartado las tres candidatas que quedaban. Lo que queda sin leer es
el bucle principal del sobremundo, por el cabo de §6.3.

### 6.2-bis 🔴 PORT-CHECK del mismo mecanismo: el clon NO PUEDE representar una piedra enterrada fuera del sobremundo — y su propio comentario dice lo contrario

Al medir §6.2 salió una contradicción DENTRO del port, entre lo que documenta y lo que hace.

`game/src/core/world/moongates.ts:22`, declara la semántica correcta del binario:
«`buried` ⇔ location != 0xFF (en el mundo vs. en la mochila)». Pero el código que PRODUCE
ese booleano usa otro predicado — `game/src/core/saveNative.ts:302`:

```ts
buried: gam[0x29a + i]! === 0,        // lector
```

y el escritor, `game/src/core/saveNative.ts:666`, colapsa al par 0 u `0xff`:

```ts
if ((gam[0x29a + i]! === 0) !== m.buried) gam[0x29a + i] = m.buried ? 0 : 0xff;
```

`== 0` y `!= 0xff` coinciden sólo si la localización es 0 o `0xff`. El binario escribe ahí
**la localización actual, sea la que sea**: `bury_moonstone`, `CAST.OVL:0x153c`, hace
`mov al, byte [g_location]`, y `mov byte [bx + 0x5840], al`, en `0x1596` y `0x1599`. O sea
que enterrar una piedra en un pueblo guarda el id de ese pueblo.

⇒ **el modelo del clon pierde el campo**: `buryMoonstone`, en `moongates.ts:201`, guarda
`x`, `y`, `z` y el booleano, y ninguna localización. Una piedra enterrada en localización
1 a `0x20` se relee como NO enterrada, y al reescribir el `.GAM` su localización se aplasta
a 0. El comentario que promete `!= 0xFF` describe un modelo que el código no tiene.

**Alcance real, y su límite:** en el estado inicial las ocho piedras están en localización 0,
así que hoy los dos predicados coinciden y **nada de esto se observa**. Para que muerda hace
falta enterrar una piedra fuera del sobremundo. **NO he leído el llamador de `buryMoonstone`**,
así que no sé si el port ya lo impide por otra vía; si lo impide, la divergencia es LATENTE y
el defecto se reduce al comentario que miente. Cabo para el carril del port, no para esta
ficha.
