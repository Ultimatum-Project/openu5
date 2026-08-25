# Witness — RADIAL DE COMBATE (aplicador 0x1c36/0x1f60) · ⚠ SUPERADA 2026-07-22

> **⚠ LECTURA FALSIFICADA** (carril fiel/line-spell-mech, ver
> `fx-lineaoe-negate-derivation.md` §3): NO existe gate radial en el bucle de
> daño de 0x1f60. El «peso[celda]» de 0xbf46 era el fetch del INT del OBJETIVO
> (COMBAT:0x13e2, args `(0xfffe, si)`) del contest de veneno del MODO 2; el
> `rand30 >= X` es ese contest, no un gate universal. La curva 0x1cf0 es el
> acumulador de PENDIENTE de los 21 rayos del abanico y `0x1d33 rand0(15)` es
> pacing de animación. La cobertura real = celdas registradas por el abanico.
> Se conserva el documento por las partes aún válidas (rand30=0x7b3e→0x3ABE
> rebase-verificado; índice posicional 0x1d11). NO cablear nada desde aquí.

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Prioridad 1 del
lead: dirección del gate probabilístico + mapa celda→índice, para cablear `castLineAoe`.
Desbloquea los 2 `⏳` de `game/src/core/magic/areaSpell.ts`.

## VEREDICTO: la dirección del gate es `apply ⟺ rand ≥ peso`, y el RAND ES rand30 (0..30)

Esto REFUTA la asunción del port (`applyWhenRandBelowWeight`=true "centro pico-2000 casi
seguro") y CONFIRMA la lectura literal contraintuitiva del lead. Fija AMBOS knobs:
- **`applyWhenRandBelowWeight = false`** (aplica cuando rand ≥ peso).
- **`RADIAL_RAND_RANGE = 31`** (el rand es rand30 ∈ [0,30], NO rand(2048)).

### 1. El rand del gate es rand30 — REBASE VERIFICADO

`CAST.OVL:0x20c8 call 0x7b3e` (gate) y `0x1d37/0x20ed call 0x7b2e` (longitud/daño). Con la
base runtime de CAST.OVL = **0xBF80** (de `combat_parity._ret_sites`), los file-offsets
mapean al CS compartido del kernel:
- `0x7b3e` → `(0x7b3e + 0xBF80) & 0xFFFF = 0x3ABE` = **kernel rand30** (combat_parity:
  `RAND30_RET=0x3AD0` = "retorno del call 0x3AAE dentro de kernel 0x3ABE").
- `0x7b2e` → `0x3AAE` = **kernel rand0** (wrapper).
- **Verificación cruzada independiente:** combat_parity clasifica el `call 0x7b3e` de
  `0x094f` (terremoto) como "saving **rand30** @0x94f → ret 0xC8D2" — y `0x94f+3+0xBF80 =
  0xC8D2` EXACTO. ⇒ `0x7b3e` = rand30 CONFIRMADO por dos vías.

### 2. Dirección del gate — CONTROL-FLOW FIRME

```
20bc: push si ; mov ax,0xfffe ; push ax ; call 0xbf46   ; ax = peso[celda]  (0xbf46 = fetch indexado)
20c4: mov [bp-0x11a], ax                                ; peso
20c8: call 0x7b3e                                        ; ax = rand30()  (0..30)
20cb: cmp ax, [bp-0x11a]                                 ; rand30 vs peso
20cf: jl 0x2132                                          ; rand30 < peso → 0x2132 = AVANZA sin aplicar
20d1: push si ; call 0x75e4 ; push si,di ; call 0xbf6a   ; (fall-through) rand30 >= peso → APLICA
20da: jmp 0x20b4
...
2132: mov [bp-0x106],si ; add [bp-0x114],2 ; ... jmp 0x200d   ; siguiente celda, SIN aplicar
```
`0x2132` es el avance de bucle (sin aplicar); el fall-through `0x20d1` llama a `0xbf6a` (el
ÚNICO caller = la aplicación). ⇒ **APLICA ⟺ rand30() ≥ peso[celda].**

### 3. CONSECUENCIA — sólo los BORDES (peso ≤ 30) reciben efecto; el centro NUNCA

Curva radial (21 words, DS:0x1cf0, VERBATIM):
`[10,12,14,16,20,25, 35,50,80,190, 2000, 190,80,50,35, 25,20,16,14,12,10]`
                     └────────── peso ≥ 31 (índices 6–14) ──────────┘
rand30 ∈ [0,30] ⇒ para peso ≥ 31, `rand30 ≥ peso` es **IMPOSIBLE** ⇒ esas 9 posiciones
centrales (incl. el pico 2000) **NUNCA aplican**. Sólo las 12 posiciones de borde (peso 10–25)
pueden, con prob = `P(rand30 ≥ peso)`:
- peso 10 → ~21/31 ≈ **68%**, peso 12 → ~61%, peso 14 → ~55%, peso 16 → ~48%,
  peso 20 → ~35%, peso 25 → ~19%.

⇒ El efecto es un **ANILLO/borde disperso**, NO un disco lleno centrado en el pico. La
intuición "el centro del fuego siempre quema" es FALSA en el binario. (Encaja con el diseño
"pico-2000 = el MENOS probable" que marcó el lead — de hecho: imposible, no sólo improbable.)

### 4. Geometría / mapa celda→índice (item b) — DERIVADO por ASM: es una LÍNEA con caída por distancia

Tracé la construcción `0x1c36-0x1daf`:
- **Origen** (`0x1c45-0x1c67`): `[bp+6]`=actor → su celda (`[si-0x45e6/-0x45e5]`) escalada
  `*16+8` (centro de tile en px) → `[bp-0x5e]/[bp-0x60]`.
- **Dirección** (`0x1c6a` switch sobre `[bp+4]`=1/2/3/4): ajusta el origen por el aim (+8/+0x10).
- **Longitud = 21** (`0x1c8c mov [bp-0x5a],0x15`), y **copia la curva de 21 words** `0x1cf0`→
  `0xa9d0` (`0x1caf-0x1cb7 rep movsw`). El array de coords se construye **paso a paso en la
  dirección del aim** (`0x1cc4-0x1ce4`, incrementos de +0x10=1 tile / +8), i.e. una **LÍNEA de
  hasta 21 celdas** desde el origen hacia el aim.
- El índice de peso `[bp-0xb6]` avanza CON la posición en la línea (`0x1d59 add ax,0x1cf0`),
  y la LONGITUD real del trazado la recorta un **rand(0,15)** (`0x1d33`) + el corte LOS
  (`0x1bb0`/0x6a14) + los bounds del arena 11×11 (`0x1e05-0x1e1f`). Marca 0xff en 0xab02.

### Respuesta DEFINITIVA a la pregunta binaria del lead (item b): POSICIONAL, no centrado

El índice de curva `[bp-0xb6]` se **inicializa a 0** (`0x1d11 mov [bp-0xb6],0`) y AVANZA
monótonamente con cada celda del trazado (indexa la curva en `0x1d59 add ax,0x1cf0` y el peso
copiado en `0x1d64 add ax,0xa9d0`). ⇒ **idx 0 = PRIMERA celda del trazado (lado del caster) →
idx crece hacia AFUERA**. NO está centrado en la celda de impacto (idx 10 ≠ impacto). El
`peso[0]=10` es el de la celda MÁS CERCANA; el pico `peso[10]=2000` cae 10 celdas afuera y es
un TOPE DE ALCANCE inalcanzable (rand(0,15)+LOS+arena rara vez llega tan lejos; y aunque
llegue, peso≥31 nunca aplica). ⇒ el efecto es más fiable JUNTO al caster y se apaga con la
distancia — un bolt/aliento direccional, coherente físicamente (NO un anillo; esa lectura
previa asumía el pico en el impacto, que el ASM descarta).

⇒ **Es un hechizo de LÍNEA/bolt direccional desde el caster.** `índice de curva = distancia
desde el origen` a lo largo del aim (idx 0 = tile más cercano al caster). Como la curva es
`[10,12,14,16,20,25,35,...]` CRECIENTE con la distancia, y `aplica ⟺ rand30 ≥ peso`, la
probabilidad de golpe **CAE con la distancia**:

| distancia (idx) | 0 | 1 | 2 | 3 | 4 | 5 | ≥6 |
|---|---|---|---|---|---|---|---|
| peso | 10 | 12 | 14 | 16 | 20 | 25 | ≥35 |
| P(golpe)=P(rand30≥peso) | ~68% | ~61% | ~55% | ~48% | ~35% | ~19% | **~0%** |

La **mitad lejana simétrica de la curva (idx 11-20) NUNCA se alcanza** (la línea no llega a
11+ tiles: rand(0,15) + LOS + arena). El pico-2000 en idx 10 actúa de **TOPE DURO de alcance**
(imposible de aplicar), no de "centro seguro". Comportamiento efectivo: un **bolt que golpea
los ~6 tiles frontales con prob decreciente y muere ~tile 6**. (Live confirmaría idx0=celda
adyacente al caster vs a la de impacto; la ESTRUCTURA línea+caída es ASM-firme.)

## Estado del witness VIVO — NO NECESARIO (item b CERRADO por estático)

Los 3 puntos del encargo quedan resueltos por ASM (disasm-mata-resumen, sin fragilidad de
overlay-BPs): (a) dirección del gate = `apply ⟺ rand30 ≥ peso` (§1-2), y (b) mapa celda→índice
= POSICIONAL desde el caster (§4, evidencia `0x1d11 [bp-0xb6]=0`). El veredicto es ASM-firme
(rebase-verificado x2 + control-flow + init del índice). **El cast vivo NO se ejecutó y NO hace
falta.**

Residual MENOR (no pedido por el lead): la forma 2D EXACTA del footprint (línea recta vs cono
que se ensancha) — la construcción anidada de los 3 arrays de coords `0x1cc4-0x1ce4` (bucle
externo 0x1c88 con +8/+0x10, bucle interno que rellena filas) sugiere que PODRÍA ensancharse,
pero la relación índice↔distancia (lo único que el port necesita para el gate) es POSICIONAL en
cualquier caso. Si algún día se quiere el footprint pixel-exacto: combate con dummies esparcidos
+ leer 0xab02 (0xff = trazado) + HP-delta por celda, varias seeds (~8-12 min, frágil).

## Accionable para el port (`areaSpell.ts`)

1. `SEMANTICS.applyWhenRandBelowWeight = false`; `RADIAL_RAND_RANGE = 31` (rand30, compara
   `>= peso`). El modelo actual (centro casi seguro) queda INVERTIDO.
2. **`castLineAoe` = LÍNEA (bolt) con caída por distancia**, no área. `idx de curva = distancia`
   desde el caster en la dirección del aim; `peso[dist]` de la curva `[10,12,14,16,20,25,35,…]`;
   golpe por celda ⟺ `rand30() ≥ peso[dist]` → ~68/61/55/48/35/19% en dist 0..5, ~0% en ≥6.
3. La longitud del trazado la recorta `rand(0,15)` + corte LOS 0x6a14 (polaridad: bit SET =
   TRANSPARENTE, bit CLEAR = OPACO — corrección del lead 2026-07-19) + bounds del arena 11×11.
   El pico-2000 es un TOPE de alcance (imposible), no un centro seguro; la mitad lejana de la
   curva nunca se usa.

## Evidencia
- `re/disasm/CAST.OVL.asm`: gate 0x20bc-0x20da + 2132; setup 0x1c88-0x1daf; curva DS:0x1cf0.
- `re/tools/combat_parity.py:44-74` (base CAST.OVL 0xBF80, RAND30 0x3ABE, ret 0xC8D2 del 0x94f).
- `re/notes/cast-line-area-spell-derivation.md` (cadena 0x1c36→0x1f60, curva verbatim).
- Port: `game/src/core/magic/areaSpell.ts` (SEMANTICS/RADIAL_RAND_RANGE `⏳`).
