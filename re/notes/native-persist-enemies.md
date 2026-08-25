# Persistencia NATIVA de enemigos overworld en la tabla 0x6B4 (task #57)

Cierra el gap adyacente de #37: el port guardaba `overworldEnemies` SÓLO en el sidecar
(`saveNative.ts` categoría "estado sin hueco en SAVED.GAM"), pero el binario SÍ los
persiste en la tabla de objetos del `.gam`. Este carril escribe/lee esa tabla nativa.

## Formato del registro de 8 bytes (DERIVADO, con cita)

Tabla de objetos: file-offset **0x6B4** ≡ DS **0x5C5A** (delta 0x55A6; #37
`overworld-ai-rng.md §Persistencia`). **32 slots × 8 B**; slot n = `0x6B4 + n*8`.
Slot 0 = avatar/vehículo activo; **slots 1..23 = pool de monstruos errantes**
(allocator kernel `alloc_actor_slot` 0x38E4 → escáner 0x3868, primer hueco ascendente);
24..31 = otros actores.

Layout por slot (objects.md:22-23 + probe-map overworld-ai-rng.md:288, y VERIFICADO
byte-a-byte contra el escritor del binario):

| byte | campo | fuente |
|---|---|---|
| +0 | tile base (map-tile, byte) | `place_actor` kernel 0x3A74 escribe `[si+0x5C5A]=bp+0x10` |
| +1 | tile del FRAME ANIMADO vivo (= +0 al colocar) | `place_actor` escribe `[si+0x5C5B]=bp+0xE` (el caller empuja el tile 2×), pero el **mover lo AVANZA** cada turno (witness O1: NPC 0x55→0x56). NO es un espejo estático. |
| +2 | X | `[si+0x5C5C]=bp+0xC` |
| +3 | Y | `[si+0x5C5D]=bp+0xA` |
| +4 | floor (g_floor) | `[si+0x5C5E]=bp+8` |
| +5 | hull / phase / 0 | `[si+0x5C5F]=bp+6` (=0 genérico); `spawn_monster` 0x1050 lo pisa a **0x64** si tile==0x2C (pirata) |
| +6 | estado de mover VIVO (NO scratch) | `place_actor` NO lo toca al colocar, PERO lo escriben los movers/anim (kernel 0x6869=0/0x6927=0xFF, COMBAT 0x0304=0x20, TOWN 0x17FF=0) y **el save writer lo persiste** (witness O1: en disco +6≠0). |
| +7 | windCtr / drift-acc | `place_actor` NO lo toca; el mover del pirata lo usa (0x5C61); en fragata activa (obj 0) = skiffs a bordo (g_skiffs) |

**Derivación del escritor** (cadena de citas):
- `spawn_monster` MAINOUT **0x0FC4**: obtiene el tile-monstruo (`type`, ret de
  `tile_to_monster` 0x0E4E), pide slot a `alloc_actor_slot` (`call 0xffffb714` →
  kernel 0x38E4), y llama a la colocación `call 0xffffb8a4` empujando en orden
  `push type; push type; push x; push y; push g_floor; push 0; push slot` (0x102E-0x103D).
  Tras colocar, si `type==0x2C` (pirata) escribe **slot+5 = 0x64** (0x1043-0x1050).
- `0xffffb8a4` = kernel **0x3A74** (thunk +0x81D0; verificado: `0xffffb714`→0x38E4).
  Escribe +0..+5 desde `bp+0x10,+0xE,+0xC,+0xA,+8,+6` (→ tile, tile, x, y, floor, 0),
  deja +6/+7 intactos, `ret 0xE` (7 args). **El +0/+1 = tile ESPEJO** (el "campo
  espejo" que avisaba el brief).

**Byte +0 = `def.tile − 0x100`** (encounters.ts:240: "el id es el tile de sprite −
0x100"): pirata def.tile=300=0x12C → +0=0x2C (cuadra con dispatch 0x2C y con el 0x64).
`enemyDefs` (combat/enemies.ts `buildEnemyDefs`): `tile = i===8 ? 300 : 320 + i*4`.
⇒ **defIndex es DERIVABLE del tile por fórmula pura** (sin la tabla de datos):
`defIndex = tile===300 ? 8 : (tile−320)/4` (validando divisibilidad y rango 0..47).

**`water` = derivable del defIndex** (AdditionalEnemyFlags.json `IsWaterEnemy`): índices
`{8,16,17,18,19,43}` = pirata + seahorse/squid/seaserpent/shark + remolino. El .gam NO
guarda un bit de agua (el DOS despacha la pasabilidad por clase de tile en `move_one`);
se re-deriva en la carga. Set anclado a la JSON por `save-native-enemies.test.ts`.

## Referencia real (solo-lectura) — `original/u5/ultima5/SAVED.GAM`

Es un save en **town** (loc 0x11), así que sus slots 1..23 son **NPCs** (+0≠+1, +6≠0),
NO monstruos errantes. Confirma el layout (obj0 avatar = `1c 1c 0f 1a ff 00 00 00`:
+0=+1=0x1C tile, +2/+3 = x/y = pos, +4=floor 0xFF). No hay save de overworld con
monstruos a mano ⇒ el escritor se derivó del ASM (arriba) y se valida por round-trip.

## Decisión de diseño (DOCUMENTADA)

El **sidecar SIGUE siendo el almacén autoritativo del port** para `overworldEnemies`, y
se añade un **ESPEJO en la tabla nativa** (patrón idéntico al de obj0 X/Y, que se
duplica en 0x6B6/0x6B7 mientras `position` es el estado real). Motivos:

1. **Fixtures con `defIndex`/`tile` DESACOPLADOS.** En gameplay real el tile está atado
   al defIndex (`tile=def.tile`), pero tests existentes usan pares arbitrarios
   (`{defIndex:41, tile:0x148}`, `{defIndex:4, tile:0x94}`) que la fórmula tile→defIndex
   NO puede reconstruir. El sidecar los preserva EXACTOS (deep-equal).
2. **Compat garantizada**: los saves+sidecar viejos (incluidos los 8 sellos del tour)
   importan igual que antes; dos tests ya committeados exigen `overworldEnemies` en el
   sidecar.
3. **Cierra el gap**: en export (SÓLO cuando `location===0`) se escribe la tabla nativa
   1..23 → un save del port es legible por una herramienta DOS / el espejo del Grand Tour
   ve los monstruos. En import, si el sidecar NO trae la lista (un SAVED.GAM DOS puro sin
   sidecar) y `location===0`, se **reconstruye de la tabla nativa** (defIndex por fórmula,
   water por set, hull/windCtr para el pirata de +5/+7). Fallback exacto.

**Escritura gateada por `location===0`** (large map: overworld si floor≠0xFF, underworld
si floor==0xFF; `map.ts:29` "location: 0 para large maps"). En town (loc≠0) los slots
1..23 son NPCs y NO se tocan → **byte-neutro para el tour** (los 8 sellos son towns con
1..23 y 24..31 a ceros; verificado). `overworldEnemies` sólo existe en el overworld, así
que el gate es también semánticamente correcto.

**Fuera de alcance (documentado):** `worldObjects` (naves atracadas/cofres) siguen en el
sidecar — su persistencia nativa es trabajo futuro. Consecuencia: en un import DOS-puro
(sin sidecar) un slot con tile 0x2C-0x2F se reconstruye como pirata; distinguir una nave
atracada de un pirata sin el sidecar requiere el byte de flag +6 (O2, sin derivar). El
bit de fase del remolino (+5 para defIndex 43) queda dormido (el dispatch de #37 en
`enemies.ts` compara contra 0xEC, no contra el índice real 43 — bug latente de #37, fuera
de este carril): no se reconstruye phase, se documenta.

## Gate del carril
tsc + typecheck:e2e + suite unit COMPLETA + los 8 capítulos del tour headless con .gam
BYTE-IDÉNTICOS a los sellos (git status limpio en saves/). Ver reporte a team-lead.
