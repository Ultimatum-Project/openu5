# Byte z de los slots de trama del Underworld — semántica (F1.10-T2, Clase C → A-estático)

Cierre de la Clase C sobre el significado COMPLETO del byte `z` (slot **+5**) que el
sembrador del Underworld (OUTSUBS 0x0566) escribe en los slots de shard/amuleto. La
pregunta abierta era: ¿por qué `0xF0-0xF3` y no `0-3`? ¿los bits altos codifican algo
(plano/altura/render)? ¿alguien más lo lee? **Resuelto por lectura del asm (grado A,
decisivo): z sólo se lee como `z & 3` (índice de shard); el nibble alto 0xF0 es inerte.**

## 1. Qué escribe el sembrador (OUTSUBS 0x0566)

Slots de 8 B en `g_world_objects` (0x5C5A): `+0/+1` tile · `+2` x · `+3` y · `+4`
floor · `+5` **z (contenido/calidad)** · `+6/+7`. El sembrador (gated por `g_floor!=0`):
- **Shards** (bucle si=0..2, slots desde 0x5D42): `+0=+1=0xB4` (tile de shard, **el MISMO
  para los 3**), `+2=[si+0x3a06]` (x), `+3=[si+0x3a0a]` (y), `+4=0xFF` (floor),
  `+5=[si+0x3a0e]` (**z**). Tabla `0x3a0e = F0 F1 F2` (confirmado por `data.json
  shardSpawns z=240/241/242`). Falsehood=(192,80,z=0xF0), Hatred=(130,65,z=0xF1),
  Cowardice=(176,184,z=0xF2).
- **Amuleto** (slot 0x5D3A, 0x057c-0x0598): `+0=+1=0xB7`, `+2=0x69`(x), `+3=0xE1`(y),
  `+4=0xFF`, `+5=0xF3` (**z hardcodeado**, 0x0598).

⇒ `z = 0xF0 | index` (index 0..3). Nibble alto siempre 0xF.

## 2. Quién LEE z (el único lector: el Get)

El (G)et de objeto (SJOG) despacha **por TILE**, no por z. Caller (SJOG 0x1979):
```
1979: and al,0xfc ; cmp al,0xb4 ; jne skip   ; agrupa tiles 0xB4-0xB7 (shard/amuleto)
198f: al = [bx+0x5c5f] (bx=slot*8)           ; ← LEE z = g_world_objects[slot]+5
1998: push tile(0xB4-B7) ; push z ; push slot ; call apply_item_grant 0x1458
```
`apply_item_grant` (0x1458) despacha por el TILE ([bp+8]): 0xB4→shard branch 0x16b6,
0xB7→amuleto 0x1712 (y 0xB5→corona, 0xB6→cetro). **Rama SHARD (0x16b6), uso de z ([bp+6]):**
```
16b6: si = [bp+6]          ; z
16b9: and si, 3            ; ← si = z & 3   (SÓLO los 2 bits bajos)
16bd: mov [si+0x57b6],0xff ; g_shards[si] = recogido  (0=Falsehood,1=Hatred,2=Cowardice)
16c9: si==0→"Falsehood!"(DS 0x8D18) / 1→"Hatred!"(0x8D24) / 2→"Cowardice!"(0x8D2E)
```
**Rama AMULETO (0x1712):** `g_amulet_lb=0xff` incondicional — **NO lee z** (basta el tile 0xB7).

## 3. VEREDICTO (grado A, estático decisivo)

- **z (byte+5) = campo "contenido/calidad" del objeto** (el mismo slot que casco de
  nave / contenido de cofre). Para shards/amuleto el sembrador escribe `0xF0|index`.
- **Sólo se lee `z & 3`** (SJOG 0x16b9 `and si,3`): es el **ÍNDICE DE SHARD** — y es
  **LOAD-BEARING** porque los 3 shards comparten el tile 0xB4B4: z&3 es lo ÚNICO que
  distingue Falsehood/Hatred/Cowardice (marca `g_shards[z&3]` y elige el string).
- **El nibble alto 0xF0 NO se lee en ningún sitio** (queda enmascarado). Es un valor
  base inerte del sembrador (convención de "contenido especial/quest"; byte+5 de cofres
  guarda ids de item 1..15, y 0xF0-F3 es un rango distintivo). **Funcionalmente z pudo
  ser 0-3; el juego sólo usa z&3.** Responde el "¿por qué 0xF0-F3 y no 0-3?": es cosmético.
- **El amuleto no usa z** (tile-dispatched, 0x1712).
- **z NO es plano/altura**: el "floor" es **byte+4** (=0xFF), filtrado contra `g_floor`
  (0x5895) por NPC.OVL. La hipótesis "¿capa/altura del Underworld?" del port queda
  **REFUTADA**.
- **Ningún lector de render de byte+5**: el compositor dibuja por el TILE (byte+0 →
  sprite +0x100, objects.md O-render); los reads de byte+5 en MAINOUT (0x5c5f) son todos
  del casco de nave (slot0). z no afecta al render del shard.

## 4. Implicación para el port

`state.ts plotZ` (byte+5 preservado, "semántica pendiente de oráculo / ¿capa?") queda
**resuelto**: z&3 = índice de shard, sin semántica de capa. El port ya deriva la
identidad del shard por `plotItem` al sembrar (equivalente a z&3), así que **plotZ es
inerte y correcto de preservar** (no hace falta usarlo; podría documentarse como
"z&3 = shard idx, nibble alto inerte" y dejar de llamarlo pendiente-de-oráculo). Sin
divergencia conductual.

## 5. Confirmación runtime (OPCIONAL — el asm es inambiguo)

No necesaria para la semántica (el `and si,3` no deja ambigüedad, y se confirmó que no
hay otro lector), pero de quererse un witness B-runtime: entrar al Underworld con los
shards sembrados, y sobre el slot vivo de Falsehood (tile 0xB4, z=0xF0) escribir
`z=0x00` / `0x03` / `0xF7` y (G)et: se predice **idx = z&3** (0x00→Falsehood, 0x03/0xF7→
idx 3 = fuera del rango de 3 shards → marca `g_shards[3]`=0x57b9, que NO es un shard —
edge no alcanzable en juego real porque el sembrador sólo escribe 0xF0-F2), render del
tile **sin cambios** (usa byte+0). Pendiente sólo si se quiere el sello runtime; el
grado A estático ya cierra la Clase C.
