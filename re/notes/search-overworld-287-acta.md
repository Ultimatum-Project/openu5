# Acta #287 — Search en overworld: el item id5 y los dos residuos Clase C de los gates

Carril fix-287 (2026-08-18). Cierra los DOS huecos declarados en
`deliberate-divergences.md` §3.5-C (task #1): el grant del item id5 de la entrada
0x0f (overworld 64,80) y la semántica del `call 0x770e` de los gates 0x0d/0x0f.
Vecino de fix-121 (Search en ARENA, SJOG 0x095c / search_remains_outcome 0x01f2):
rutinas DISTINTAS, mecanismo no compartido — aquí es `search_fixed_hidden_items`
(SJOG 0x0514) + `get_special_item` (SJOG 0x1458). Sin dependencia de composición.

## 1. Dispatch de get_special_item (SJOG 0x1458) — leído del disasm

```
145c  mov ax,[bp+8]          ; id del objeto
145f  cmp ax,0xc / jle 1467  ; id > 12  → 0x172e
1467  cmp ax,9   / jl  146f  ; id 9..12 → jmp 0x1670  (equipo DIRECTO)
146f  sub ax,1 / cmp ax,7 / jbe 147a   ; id 0 → 0x1750
147a  add ax,ax / xchg bx,ax
147d  jmp word ptr cs:[bx-0x2962]      ; jump-table ids 1..8
```

**Jump-table leída del BINARIO, no de oídas** (control positivo del acta): los 8
words en SJOG.OVL file-off 0x171E, con la base de carga del overlay 0xBF80
(`case_local = word − 0xBF80`):

| id | word | destino | handler |
|---|---|---|---|
| 1 | 0xd402 | 0x1482 | "Open it first!" (cofre anidado) |
| 2 | 0xd5a0 | 0x1620 | gold |
| 3 | 0xd5bc | 0x163c | potion |
| 4 | 0xd546 | 0x15c6 | scroll / planos HMS Cape |
| **5** | **0xd5f0** | **0x1670** | **EQUIPO** |
| **6** | **0xd5f0** | **0x1670** | **EQUIPO** (mismo word) |
| 7 | 0xd4e8 | 0x1568 | keys / odd keys |
| 8 | 0xd4bc | 0x153c | gems |

Coincide 8/8 con lo que declaraba `objects.md` §O3 (task #13). La rama de equipo
sirve por tanto a los ids **5/6/9/10/11/12**.

## 2. La rama de EQUIPO (SJOG 0x1670-0x16b2)

```
1670  cmp word [bp+6],0x1b / je 167c   ; quality == 0x1B (Arrows)?
1676  cmp word [bp+6],0x1d / jne 1690  ; quality == 0x1D (Quarrels)?
167c  ax = quality + 0x57c0            ; &g_equip_qty[quality]
1683  push 5 / push 0x63 (orden real: ptr, 5, 0x63)
168b  call 0x7f70                      ; add_capped(&slot, 5, cap 0x63) → MUNICIÓN +5
1690  bx = quality
1693  inc byte [bx+0x57c0]             ; resto: +1
1697  cmp byte [bx+0x57c0],0x64 / jne 16a3
169e  mov byte [bx+0x57c0],0x63        ; clamp 0x64 → 0x63 (cap 99)
16a3  bx = quality*2
16a8  push word [bx+0x17f6] / call 0x58d0   ; NOMBRE (tabla 0x17F6)
16af  ax = 0x8d06 → 15bf push/print         ; sufijo DS 0x8d06
```

- `quality` NO es cantidad: es el **CÓDIGO de equipo 0..47** (índice de
  g_equip_qty 0x57C0 — el mismo array cuyo +39 = 0x57E7 usa el gate 0x0587).
- Munición (0x1B Arrows / 0x1D Quarrels, confirmados contra `equip.ts`) → **+5**
  con add_capped 0x63; todo lo demás → **+1** con clamp 0x64→0x63. Mismo
  mecanismo que ya portó `applyLootGrant` (botín de cofre) — ahora la vía SEARCH
  (`applySearchGrant`) lo comparte.
- Nombre: tabla **0x17F6** (DATA.OVL 0x1806) — ya volcada byte a byte en
  `longEquipNames.json` (carril buy-herrero; código 39 = "Glass Sword", 27 =
  "Arrows", 29 = "Quarrels") — + sufijo DS 0x8d06, verificado en DATA.OVL
  fileoff 0x8d16 = `b'!\n'`. El port lo cubre `lootItemName` (ids 5/6/9-12).

**La entrada 0x0f del overworld**: `searchObjects[15] = {id:5, quality:39,
location:0, floor:0, x:64, y:80}` → quality 39 = **Glass Sword** → +1. El grant
AUTO-CIERRA el gate (`g_equip_qty[39]` deja de ser 0): re-hallable sólo al
perder la espada. La tabla search no trae munición (qualities reales 9..47, sin
27/29), pero la sub-rama +5 es de la MISMA rutina y queda portada y testeada en
crudo.

## 3. El `call 0x770e` de los gates 0x0d/0x0f — adjudicado SIN BP nuevo

El §3.5-C proponía un BP de DOSBox para derivar 0x770e. No hizo falta: otros
carriles ya lo habían resuelto con el instrumento del repo
(`dispatch_table.overlay_near_call_base`, grupo `load_seg 0xBF8`):
**0x770e + 0xBF80 = 0x368E → ULTIMA.EXE `find_object_at_xy`, CUERPO LEÍDO**
(`board-137-acta.md` §1, `cama-241-acta.md`, `camp.ts`): barre g_world_objects
0x5C5A slots 1..31 (stride 8) comparando +2/+3/+4 con (x,y,floor) y devuelve el
byte +0 del ocupante; 0 = casilla libre. La tabla lleva **objetos Y actores**.

En `search_fixed_hidden_items` los llamadores empujan (x, y, g_floor) — con
cdecl el callee ve [bp+8]=x, [bp+6]=y, [bp+4]=floor, el MISMO orden que el
llamador de la cama — y el gate exige retorno 0:

```
0563  push x / push y / push g_floor / call 0x770e   ; índice 0x0d (tras g_keys==0)
0570  or ax,ax / je 0x5a1                            ; ==0 → HALLA
058e  push x / push y / push g_floor / call 0x770e   ; índice 0x0f (tras equip[39]==0)
059d  or ax,ax / jne 0x5f6                           ; !=0 → NO halla (cae al camino
                                                     ; del bitmask, que 0x610-0x618
                                                     ; salta para si ∈ {0xd..0xf})
```

Semántica del gate: los dos índices son re-hallables y NO marcan el bitmask
0x585c — sin este chequeo, re-buscar ANTES del (G)et colocaría un SEGUNDO
objeto sobre el primero. El binario, con el objeto colocado en la casilla,
responde «nothing of note.» hasta que se recoge.

**Port**: predicado `occupiedAt` inyectado en `searchAt`/`isFindable`
(search.ts); Game pasa `objectOrNpcAt` (worldObjects + NpcManager — las dos
mitades de la tabla única del binario, mismo criterio que camp.ts/board). La
guarda anti-apilado de `placeSearchObject` (#22) queda como defensa para
callers sin predicado. El índice 0x0e (árbol de Minoc) NO llama a 0x770e —
gate solo diario — y los índices normales tampoco: testeado en negativo.

## 4. RNG — censo (patrón #353 §6)

NINGUNA de las piezas tocadas consume RNG: `search_fixed_hidden_items` no tiene
`call rand` en 0x0514-0x063d (el único rand del comando Search del mundo es el
de la parcela de reactivos, 0x049a, intacta), `get_special_item` 0x1670-0x16b2
tampoco, y `find_object_at_xy` es un barrido puro. El cambio no mueve el stream.

## 5. Qué queda abierto (declarado, no ampliado aquí)

El hueco O3 restante de `applySearchGrant`: ids 2 (gold), 3 (potion), 4
(scroll normal), 8 (gems), 13 (torches), 15 (food) alcanzables desde la tabla
search siguen sin grant por esta vía (sus ramas están derivadas y portadas para
el botín de cofre en `applyLootGrant`; falta unificar la vía search). Los ids
30/31 (restos) son otra rutina (la de fix-121 en arena; su gemela de mundo,
fuera de este alcance).
