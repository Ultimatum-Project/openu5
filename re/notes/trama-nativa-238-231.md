# La capa de trama a bytes nativos (#238) y el residuo de g_hull/g_skiffs a pie (#231)

Carril `save-nativo` · rama `fix/save-nativo-familia` · 2026-08-17.
Base: `re/notes/trama-flags-227.md` (offsets 0x322..0x325 y 0x32A verificados en RAM viva
§5.1) y `re/notes/save-window-writer.md` (ventana = volcado verbatim de DGROUP 0x55A6).

## 1. ★★ El «bitmap de doom» NO es un word aparte: son los NPC-MUERTOS de STONEGATE

El único escritor del acumulador del ritual es:

```
CAST.OVL 0x171d: 0906ca5b   or word ptr [g_npc_dead_bitmap+112], ax
```

El propio disasm lo simboliza: `DS 0x5BCA = g_npc_dead_bitmap (0x5B5A) + 112`. En la
ventana del `.GAM` eso es `0x5B4 + 112 = 0x624` — DENTRO del bitmap de NPC-muerto
(32 locations × 32 slots, MSB-first). La aritmética de fila: byte 112 ⇒ bitIdx 896..903 ⇒
fila 28 = **location 29 = STONEGATE**, la morada de los Shadowlords.

`DOOM_BIT[idx] = {0x02, 0x04, 0x08}` (DATA.OVL DS 0x4892; `ritual.ts:64`) cae MSB-first en
los slots **6/5/4** de esa fila: Falsehood→6, Hatred→5, Cowardice→4. Es decir: **destruir a
un Shadowlord lo marca como NPC muerto de Stonegate**, y el «lector» del bitmap de doom es
el filtro genérico de NPCs muertos — no hay ningún lector dedicado del word (censo: un solo
tocador de `g_npc_dead_bitmap+112` en los 28 ficheros del disasm, el `or` de arriba).

Consecuencias cableadas:
- `use-tools.ts` (ritual): escribe `npcDead[28][6−idx] = true` JUNTO a `shadowlordDoomBits`
  — sin eso el estado nace inconsistente con su propio `.GAM` (el export vuelca el bit por
  la vía doomBits y el import lo relee por la vía npcDead).
- `saveNative.ts` export: el OR del doom va DESPUÉS de `gridToBitmap` (que reescribe los
  128 B y lo pisaría), y es OR y no asignación — el gesto exacto del binario.
- `saveNative.ts` import: sin sidecar, `shadowlordDoomBits = word & 0x0E` — la máscara es
  la imagen del único escritor; sin ella, un bit de NPC-muerto legítimo de Stonegate se
  adoptaría como doom (el caveat que ya documentaba `mirror_globals.py` en CLONE_ONLY).

## 2. Los cuatro campos de #238, y por qué el sidecar no se vacía

| campo | celda | export | import sin sidecar |
|---|---|---|---|
| shadowlordLocs | 0x322..0x324 | bytes crudos; `[]` ⇒ 3×0x00 (= init.gam) | 3×0x00 ⇒ `[]` (no entra al sorteo de medianoche); si no, crudos. Y locs[i] ≥ 0x80 ⇒ `questFlags[shadowlord-dead:*] = true` (el AND del gate MAINOUT 0x07f1) |
| shadowlordSummoned | 0x325 | `undefined` ⇒ 0xFF (reposo, init.gam) | 0xFF ⇒ `undefined`; si no, crudo |
| sellos de palabra | 0x32A+i, i=loc−33 | bit 0x80 desde `questFlags[word-spoken:*]`, 7 bits bajos preservados | bit ≥0x80 ⇒ flag `true`, monótono |
| doomBits | word 0x624 (alias §1) | OR post-gridToBitmap | `word & 0x0E` |

El sidecar SIGUE llevando estos campos y SIGUE mandando al importar (patrón de #57/#106:
sidecar autoritativo + espejo nativo + fallback). Vaciarlo rompería a los consumidores del
espejo (`mirror_globals.py` DS_RUNTIME compara sidecar vs RAM) y a los saves viejos; el
objetivo de la ficha —que DOSBox y el espejo vean la trama en los 4192 B— se cumple igual.

⚠ Guarda anti-drift: escribir 0x325 siempre movió el sha del `.GAM` canónico; el extractor
lo espeja con el campo crudo `shadowlordSummonedByte` (parse+serialize, `?? 0xFF`) y el sha
se actualizó EN LAS DOS suites a la vez (game/tests/save-native.test.ts ↔
extractor/tests/savegame.test.ts).

## 3. #231 — obj0+5/+7 = g_hull/g_skiffs, y el residuo a pie es REAL

El careo de los 28 saves (13-08) refutó 15-a-2 el docblock «a pie el binario deja 0»:
a pie en el overworld el original CONSERVA casco y esquifes de la última fragata en
obj0+5/+7 (g_hull DS 0x5C5F / g_skiffs 0x5C61 son globales; nadie los borra al desembarcar).
Decisión de modelo cableada:

- **Export**: fragata ⇒ estado (como antes); **a pie en overworld ⇒ estado** (el port
  también conserva shipHull/shipSkiffs tras el Xit — `game.ts:4696` los vuelca al objeto
  sin borrarlos); ~~otro vehículo ⇒ 0 (board vuelca el registro del objeto abordado, y el
  del caballo lleva +5/+7 = 0, SHOPPES 0x0957-0x0961)~~ **REFUTADO por #378**
  (`board-epilogo-378.md` §1): el volcado registro→slot0 es EXCLUSIVO de la rama fragata
  de `cmd_board`; caballo/alfombra/esquife no escriben 0x5C5F/0x5C61 y el epílogo 0x093E
  no puede (ranura ≥1, kernel 0x3A74 sin +7) — **otro vehículo en overworld ⇒ estado
  TAMBIÉN** (medido en vivo: centinelas intactos tras B en caballo); interior ⇒ 0 (memset
  de entrada MAINOUT 0x0857; el `+7=6` de 11/11 saves de interior sigue **SIN
  DETERMINAR** y no se imita).
- **Import**: sidecar manda; sin él, en overworld se adoptan los bytes (para cualquier
  transporte: son el volcado real de g_hull/g_skiffs); en interior NO (residuo sin derivar).

~~Cabo declarado NO cubierto: la cadena fragata→caballo→a pie.~~ **CERRADO por #378**
(`board-epilogo-378.md`): derivado el epílogo 0x093E en crudo y MEDIDO en vivo
(probe 20-08, centinelas intactos tras B en caballo). ~~El binario dejaría 0 (el
board del caballo pisa los globales con su registro)~~ **REFINADO por #273**
(`xit-pila-273.md` §4) y **REFUTADO por #378**: el epílogo 0x093E borra el registro del
objeto ABORDADO (ranura ≥1 siempre — el finder 0x368E no barre la 0) vía kernel 0x3A74,
que solo escribe +0..+5; y el volcado registro→slot0 es exclusivo de la rama fragata de
`cmd_board` (0x08F4 hull / 0x0936 skiffs — caballo/alfombra/esquife no tocan
0x5C5F/0x5C61). **La cadena CONSERVA**, igual que el port en estado. ~~arreglarla
exigiría tocar el board() de `game.ts`~~ — la conducta del port ya era fiel; lo
divergente era ESTE CODEC: el export escribía 0 en obj0+5/+7 con caballo/alfombra/
esquife activos (y el registro 0 del .OOL ni llevaba el fix a-pie de arriba), corregido
en #378 con guarda `board-chain-378.test.ts`.

## 4. Citas de las dos frases rancias corregidas

- `saveNative.ts` (export obj0): «verificado a pie: obj0+5/+7=0» — refutada, reescrita.
- `state.ts` (defaults): «a pie el binario deja 0» — el default 0 se re-justifica por
  init.gam, no por ir a pie.
- `exporta.ts` / `u5gam.ts`: el ejemplo «los Shadowlords muertos no viajan en el .gam»
  caducó con #238 — retirado nombrándolo, tesis re-apoyada en lo que sigue sin celda.
