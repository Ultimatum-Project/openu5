# B2 — Magic Carpet sobre agua profunda / rápida — **CONFIRMA** (+ hallazgo bonus)

**Carril:** SCOUT (flota del lead) · 2026-07-18 · **Rama:** `re/carpet-b2`.
Cierra el último `DISCREPA-verificar` vivo del censo docs-físicos (§B2). Autoridad = ASM
(`re/disasm/ULTIMA.EXE.asm`) + tablas de `DATA.OVL`, doctrina `disasm-mata-resumen`.

**Pregunta:** el clue book (pág. 52) dice que la alfombra cruza pantano + aguas CALMAS,
pero insinúa que las aguas RÁPIDAS «la empapan» (posible ahogo). ¿El binario distingue
agua calma/rápida para la alfombra, o hay un efecto soak/drown?

---

## Derivación — el predicado de pasabilidad por transporte (kernel 0x2C4C)

El mover del party clasifica el destino por TRANSPORTE (`0x2C4C`, `ULTIMA.EXE.asm`
4938-5045):
```
2c4f: bx = vehicle_tile >> 2
2c56: al = [bx + 0x54f4]        ; CLASE del transporte (class-table, DATA.OVL 0x5504)
2c5c: cmp ax,0xA ; ja → 0 (bloqueado)
2c64: jmp cs:[bx*2 + 0x2d60]    ; jump-table de 11 handlers por clase
```
**Class-table `DATA.OVL 0x5504` (idx = tile_vehículo>>2):** foot(0x1c)→0, horse(0x10)→3,
**carpet(0x14)→2**, skiff(0x18)→0, frigate(0x24)→6. La alfombra es **clase 2**.

**Handler de clase 2 — `0x2C80`** (jump-table 0x2d60[2]=0x2c80). Devuelve 1=PASABLE:
```
2c80: si (tile & 0xf0)==0x60 → PASABLE            ; WaterStream 0x60-0x6F (agua de CORRIENTE)
2c8c: si es_agua(tile) → PASABLE                  ; 0x2C2E: tile<4 (Water 0x00-0x03) …
2c99: si walkable(tile) [bitmap 0x54D4] → PASABLE  ; … o tierra transitable
      si no → BLOQUEADO
```
El predicado `es_agua` (`0x2C2E`): `tile<4` **o** `(tile&0xf0)==0x60`. ⇒ la alfombra de
clase 2 pasa por: **agua profunda 0x00-0x03**, **agua de corriente/rápida 0x60-0x6F**, y
**toda tierra transitable** (incl. pantano 0x04). Bloqueada en lo demás.

## Veredicto B2 — **CONFIRMA (el clue book adorna)**

- **Agua profunda (0x01-0x03):** binario PASABLE (clase 2, `tile<4`). Port PASABLE
  (`carpetPassable=true`). **MATCH.**
- **Agua rápida / corriente (WaterStream 0x60-0x6F):** binario PASABLE (`tile&0xf0==0x60`).
  Port PASABLE (`carpetPassable=true`, todos los 0x60-0x6F). **MATCH.**
- **NO existe distinción calma↔rápida** en el binario: ambas son ramas «PASABLE» de la
  misma clase 2. **NO hay efecto soak/empapar/ahogo** para la alfombra sobre agua (el único
  ahogo del binario es hundir la fragata sin skiff/alfombra, transport.md §7E — no aplica a
  la alfombra volando). El «fast water soaks it» del clue book es **sabor**, sin mecánica.

⇒ El port (`movement.ts::isPassable` caso `carpet` → `info.carpetPassable`) es **FIEL** para
la pregunta de B2. **Sin cableo.** Cierra el §B2 del censo como CONFIRMA-FIEL.

---

## Hallazgo BONUS (fuera de B2, para decisión del lead) — carpetPassable diverge en 22 tiles

Comparando el predicado del binario (clase 2: `tile<4 || (tile&0xf0)==0x60 || walkable`,
con el bitmap canónico `DATA.OVL@0x54E4`) contra `IsCarpet_Passable` de `TileData.json` en
los 256 tiles, hay **22 divergencias**. La mayoría son tiles de INTERIOR/MAZMORRA que la
alfombra (transporte SÓLO de mapa grande) nunca pisa → muertas conductualmente (sillas
0x90-0x93, escaleras 0xC4-0xC7, escalas 0xC8-0xC9, lava 0x8F, chimenea 0xBC, hoyo 0x8C,
letrero 0xF9, negro 0xFF). PERO **4 son de OVERWORLD y sí importan**:

| tile | nombre | binario | port | efecto |
|------|--------|---------|------|--------|
| 0x0C | SmallMountains | **BLOQUEA** | pasable | el port deja VOLAR la alfombra sobre montañas pequeñas; el binario no |
| 0x1C | Oasis | **BLOQUEA** | pasable | (0x1C ya es override de foot: el binario lo bloquea) |
| 0xD4-0xD7 | Waterfall1-4 | **BLOQUEA** | pasable | catarata: el binario la bloquea (ni agua<4 ni 0x60 ni walkable), el port la deja pasar |

`SmallMountains` es la relevante: en el port la alfombra cruza montañas pequeñas, cosa que
el binario NO permite (clase 2 cae al bitmap walkable, y las montañas no son walkable). Es
un **DIVERGE real de overworld**, pero SEPARADO de B2 (que es agua). Recomendación: abrir
como tarea propia si el lead quiere; el fix es limpio y sin rand — sustituir el caso
`carpet` de `isPassable` por el predicado de clase 2 del binario (`tile<4 || (tile&0xf0)==
0x60 || info.walkable`) en vez de `info.carpetPassable`, alineando los 22 tiles de golpe.
NO lo cableo bajo B2 (fuera de alcance + cambia comportamiento visible en montañas → merece
su propia decisión/gate). Dejo el predicado derivado y la lista para el lead.

> **ACTUALIZACIÓN 2026-07-18 — CABLEADO + corrección del 0x1A** (rama `fiel/carpet-pass`,
> commits `46aec343` fix + `64420a70` doc):
> - El fix se aterrizó: `isPassable` caso `carpet` = `tile<4 || (tile&0xF0)==0x60 ||
>   info.walkable`. Corrige montañas 0x0C, oasis 0x1C, cataratas 0xD4-D7 y los ~18 tiles
>   muertos de interior. Test `carpet-passability.test.ts` (5), gate verde.
> - **RETIRADA la idea de «alinear los 22 de golpe» / «7º override 0x1A».** El tile
>   **BrokenShrine 0x1A NO se alinea al binario**: el port lo mantiene walkable **A
>   PROPÓSITO** (divergencia DELIBERADA «walk-to-restore» — el jugador PISA el santuario
>   destruido 0x1A para restaurarlo, `checkShrineEntry`/CMDS 0x1202; documentado en
>   `los-passability-audit.test.ts` 76/90/108-110 + `shrine-trigger.test.ts` 174-198).
>   Bloquearlo rompería la quest de restauración. El predicado usa `info.walkable`, que
>   preserva esa decisión (la alfombra hereda 0x1A=walkable). En el binario 0x1A es
>   render-only (el party pisa el 0x19 del mapa; la destrucción es un bit repintado) — dos
>   modelos coherentes. **0x1A no es un gap; no tocar.** (0xF9/0xFF son interior muertos.)
