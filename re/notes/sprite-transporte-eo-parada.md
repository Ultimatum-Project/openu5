# Sprite de caballo/alfombra E/O: DERIVACIÓN CERRADA, cableado pendiente (#37)

**Titular: el conflicto de tres etiquetas queda RESUELTO contra el binario — `[bp+4]` ES el
facing 0..3, así que 1=E y 3=O, y el briefing acierta. La cabecera del port generaliza a
caballo una fórmula que sólo vale para barcos, y un test verde etiqueta `0x12` como
«facing N» cuando es ESTE. Derivación cerrada; el cableado NO se hace en este carril.**

Base: `main` @ `d67931f6`. **CERO cambios de código.**

---

## 1. La mecánica (confirmada byte a byte en los dos mapas)

`MAINOUT.OVL:0x00da transport_face` — la misma rutina que #16 derivó para el verbo:

```
00e5: al = g_transport_tile ; and ax,0xfc     ← CLASE de transporte
00ed: cmp 0x10 → 0x10a  caballo   ('Ride ')
00f2: cmp 0x14 → 0x130  alfombra  ('Fly ')
00f7: cmp 0x20 / 00fc: cmp 0x24 → 0x16a  fragata
0101: cmp 0x28 → 0x152  esquife   ('Row ')

caballo   0111: cmp [bp+4],1 → tile 0x12 · 011e: cmp [bp+4],3 → tile 0x13 · resto INTACTO
alfombra  0137: cmp [bp+4],1 → tile 0x14 · 0144: cmp [bp+4],3 → tile 0x15 · resto INTACTO
```

`TOWN.OVL:0x05A9-0x05CB` repite la forma instrucción a instrucción.

## 2. ★ La piedra Rosetta: qué es `[bp+4]`

Las ramas NAVALES del **mismo** `transport_face` no comparan: **calculan**.

```
esquife 0x152           fragata 0x16a
0159: al = [bp+4]       0172: al = [bp+4]
015c: cl = tile         0175: cl = tile
0160: and cl, 0xfc      0179: and cl, 0xfc
0163: add al, cl        017c: add al, cl
0165: tile = al         017e: tile = al
```

⇒ **`tile = (tile & 0xFC) + [bp+4]`**, o sea **`[bp+4]` ES el facing 0..3 directo**. Con la
codificación que el propio port documenta (`base+0/1/2/3 = N/E/S/O`):

| `[bp+4]` | cardinal |
|---|---|
| 0 | Norte |
| **1** | **Este** |
| 2 | Sur |
| **3** | **Oeste** |

**El briefing acierta: caballo E→`0x12` / O→`0x13`, alfombra E→`0x14` / O→`0x15`, y N/S
dejan el tile INTACTO.** El conflicto de tres etiquetas se resuelve así:

- **Briefing (E→0x12): CORRECTO.**
- **Cabecera del port** (`transport.ts:12`, «0x10-0x13 base+0/1/2/3 = N/E/S/O»):
  **generaliza de más**. Esa fórmula es la de los BARCOS (0x20-0x2B), que sí hacen
  `base+facing`. El caballo **no** la usa: su rama escribe literales `0x12`/`0x13` y tiene
  **sólo dos sprites montados** (E y O). `0x10`/`0x11` son el caballo del MUNDO (sin
  jinete); montar hace `+2` (`transport.ts:386`), que es otra cosa que girar.
- **Test verde** (`wishing-well.test.ts:125`, «0x10 + 2 = montado, facing N»): el VALOR
  `0x12` está bien (montar), la ETIQUETA «facing N» está MAL — es Este.

## 3. ~~Qué falta~~ — ✅ CABLEADO, YA EN MAIN (actualizado 28-07)

> ⚠ **ESTA SECCIÓN Y LA §4 ESTABAN DESFASADAS.** Decían «cableado pendiente» y «no lo
> cablo aquí», pero el carril de #37 lo aterrizó a `main` en **8a55bfde** el mismo día:
> `mountFaceTile` en `world/transport.ts` con los inmediatos copiados, LLAMADO desde
> `core/game.ts` dentro del mover (junto al eco y ANTES de resolver el paso, así que el
> sprite gira aunque el paso quede bloqueado), y `game/tests/mount-sprite-facing.test.ts`
> con los 5 casos —incluida la mitad fina N/S y el contraste con la fórmula naval—.
> Los DOS defectos de prosa que la §2 señalaba también están corregidos en main: la
> cabecera de `transport.ts` ya declara que `base+0/1/2/3` es de los BARCOS, y el
> comentario de `wishing-well.test.ts` ya dice ESTE en vez de «facing N».
> Verificado por censo en el carril del lote #54 (tarea #54, pieza 10 = **NO-OP**), que
> comprobó el CABLEADO expresamente y no sólo la existencia del test.
> Lo de abajo se conserva como REGISTRO de lo que había que hacer, no como cola viva.

### Lo que había que cablear (hecho en 8a55bfde)

Cablear en el mover compartido, para caballo (clase `0x10`) y alfombra (clase `0x14`):

- facing **1 (E)** ⇒ `transportTile = 0x12` / `0x14`
- facing **3 (O)** ⇒ `transportTile = 0x13` / `0x15`
- facing **0 (N)** y **2 (S)** ⇒ **no tocar** `transportTile` (la mitad fina)
- **NO** aplicar `(tile&0xFC)+facing` a estas dos clases: eso es sólo naval.

**Radio medido (no es sólo visual):** 5 asertos vivos tocan `transportTile` —
`transport-exact.test.ts:288/334/339/648` y `wishing-well.test.ts:125`. Al menos el
comentario de este último hay que corregirlo («facing N» → «facing E»).

## 4. Por qué no se cableó EN AQUEL MOMENTO (histórico — ya está hecho, ver §3)

La derivación es la parte difícil y queda cerrada y citada. El cambio de código toca un
mover compartido con cinco asertos vivos y pide `tsc` ×2 + vitest del área; prefiero no
meterlo al final de una sesión larga y dejarlo con todo pinchado para que sea mecánico.
**Ninguna decisión queda abierta**: los cuatro casos y el radio están arriba.

## 5. Gates

| gate | exit |
|---|---|
| `pytest test_frontier + test_dispatch + test_ledger` | **0** |

Sin tocar `.ts` ⇒ tsc no aplica (declarado).
