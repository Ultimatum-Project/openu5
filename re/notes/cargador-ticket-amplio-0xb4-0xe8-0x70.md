# Ticket amplio del cargador de combate (`0xb4`/`0xe8`/`0x70`) — ADJUDICADO por patas

Carril `cargador-ticket-amplio`, 2026-08-23. Cierra la adjudicación del cabo declarado en
`sprite-frame-drop-tercer-sapo-cargador.md` §TICKET SEPARADO y re-declarado en
`siembra-objetos-cbt-353.md` §7 («único resto real de §7» según el panel del 20-08).
Veredicto por pata: **`0xb4` VACUA en datos · `0xe8` divergencia REAL medida (26 unidades,
todo el lado binario ya derivado; falta solo el port) · `0x70` REFUTADA (cita de port falsa;
el sprite es el GUARDIA)**.

## 1. Vigencia (censada antes de derivar)

- La clasificación tipo-2 (`DNGLOOK 0x12b2/0x12b8/0x12c1`), el salto de fase de actor
  (`ULTIMA.EXE 0x651d`) y la fase 2 con sprite CRUDO (`0x66a6-0x66b8`) ya estaban
  derivadas (`sprite-frame-drop-tercer-sapo-cargador.md`, leídas ENTERAS las dos rutinas)
  y el port las tiene cableadas como EXCLUSIÓN (`combat.ts isArenaObjectSprite`).
- #353 aterrizó la SIEMBRA de los sprites `<0x40` (`seedArenaObject`), dejando las
  familias `0xb4`/`0xe8` explícitamente fuera (`combat.ts:1059 if (sprite >= 0x40) return`).
- El lado de CONSUMO de los campos en la arena ya estaba derivado entero:
  `field-spell-port.md` §6 (`COMBAT.OVL 0x1b1e end_of_turn_terrain_field_damage`, 328 B
  leída entera) y `an_grav_dispel_field` (`CAST2.OVL 0x07bc`, máscara `and al,0xfc /
  cmp al,0xe8`). Ambas rutinas IDENT+verified en `re/ledger/frontier.json`.
- El (G)et de la familia `0xb4` quedó derivado por cabos-353 (`siembra-objetos-cbt-353.md`
  §7): el barrido de `cmd_get` (SJOG `0x196a-0x197d`) acepta `kind<0x10`, `0x19`, `0x1b`
  y familia `0xb4` (`0x197b`), y la despacha por la rama `>0xc` de `get_item_switch`
  (`0x1464 → 0x172e`). La familia `0xe8` NO casa en ese barrido ⇒ los campos no son
  recogibles — coherente con sembrarlos como no-loot.

Las dos lecturas heredadas centrales se RE-VERIFICARON en crudo sobre el árbol de hoy
(§2). Nada de lo heredado estaba caducado; lo único FALSO era la pata `0x70` (§4).

## 2. Re-verificación en crudo de las lecturas heredadas

`DNGLOOK.OVL.asm 0x12a1-0x12fc`, byte a byte (coincide con la nota heredada):

```
12ab: or al,al / jne 12b2 ; jmp 1385      ; sprite==0 → ranura vacía
12b2: cmp al,0x40 / jb 12c5               ; <0x40           → tipo 2
12b6: and al,0xfc / cmp al,0xb4 / je 12c5 ; familia 0xb4    → tipo 2
12bf: and al,0xfc / cmp al,0xe8 / jne 12d2; familia 0xe8    → tipo 2
12c5: [bp-0x12]=2 ; si = sprite CRUDO     ; tipo 2 (objeto)
12d2: [bp-0x12]=0 ; 12dc: sub ax,0x40 / shr ax,1 / shr ax,1 ; tipo 0, índice=(s−0x40)>>2
```

`ULTIMA.EXE.asm 0x66a6-0x66d6` (fase 2, rama `cx==2` = tipo 2): `al = [bp+0xc]` (el
sprite CRUDO) se escribe en los DOS bytes del slot de la tabla de objetos (`0x5c5a` kind y
`0x5c5b` render, punteros `[bp-0xa]`/`[bp-0xc]`), luego X/Y/planta y `+7 = 0xff`
(`66d3: mov byte [bx],0xff`). El post-proceso de cantidad de DNGLOOK (`0x131d-0x1381`)
despacha por `si` = sprite crudo: `0xE8-0xEB ≥ 0x10` cae en la rama de decorado
(`0x1360: cmp si,0x10 / jge`) ⇒ **sembrar las familias `0xb4`/`0xe8` consume 0 rands** —
la afirmación de #353 sostiene: cablearlas no mueve el stream.

## 3. Censo de datos (JSON careado contra los `.CBT` crudos — coinciden byte a byte)

Fila 5 de los 128 registros (16 BRIT + 112 DUNGEON), medida DOS veces: sobre
`game/assets/maps/combatmaps.json` y sobre `original/u5/ultima5/{BRIT,DUNGEON}.CBT`
crudos (mismo resultado; el extractor `extractor/src/parsers/combatmap.ts` pasa fila 5
entera con el único descarte `sprite==0` = `DNGLOOK 0x12ab`):

| pata | apariciones | dónde (índice de `combatmaps.json` = 16 + orden-sin-Despise·16 + sala) |
|---|---|---|
| familia `0xb4` (unidades) | **0** | — |
| familia `0xb4` (triggers, fila 0) | **0** | — |
| familia `0xe8` | **26** | cm18 = Deceit r2: 12×`0xEB` · cm20 = Deceit r4: 8×`0xE8` · cm121 = Doom r9: 6×`0xE8` |
| sprite `0x70` | 16×9 + 4 | BRIT 1-8 y 13 (los 16 slots, mapas de ENCUENTRO) · cm82 = Shame r2: 2 · cm97 = Hythloth r1: 2 |

(El «232×14 · 235×12» del barrido original de la nota del tercer sapo = 8+6 de `0xE8` y
12 de `0xEB`: cuadra.)

## 4. Pata `0x70` — REFUTADA (cita de port falsa; no hay descarte y no es un campo)

La frase del ticket «`combat.ts:599` descarta también los objetos-campo `0x70` del
`.CBT`» **no se sostiene contra ningún árbol**:

- En el commit que la escribió (`71a3d20a`), `game/src/core/combat/combat.ts:599` es
  `sleeping: false,` (un literal de `makeEnemy`); en su padre, `counter:
  initiativeReset(speed)`. Ningún `combat*.ts` de ese árbol ni
  `extractor/src/parsers/combatmap.ts` contiene un filtro de `0x70` sobre el `.CBT`
  (barrido con `git grep "0x70" 71a3d20a -- game/src`: solo el cetro y comentarios).
- El sprite `0x70` de fila 5 **no es un objeto-campo: es un ENEMIGO tipo 0** — no casa
  con ninguna rama tipo-2 de `0x12b2-0x12c3` y cae en `0x12dc`: índice
  `(0x70−0x40)>>2 = 12` = **GUARDS** (`monsterNamesUpper[12]`). El port hace LO MISMO:
  `adjusted = 0x70+0x100 = 368`, `(368−320)/4 = 12` (`spriteToEnemyIndex`) ⇒ crea al
  guardia. Paridad; nada que descartar. En los 9 mapas de BRIT con los 16 slots a `0x70`
  la ranura es solo posición (encuentros: `ULTIMA.EXE 0x60EC` copia X/Y con `rep movsw`
  y el tipo lo pone el encuentro — el port ídem, rama `Array.isArray(spec)`).
- Los CAMPOS que sí llevan `0x70` son otra cosa y otra capa: los **tiles de TERRENO**
  `0x70-0x7f` de la rejilla (fila 0-10, cols 0-10), presentes en 8 registros (cm10
  Psychedelic 72 · cm112 52 · cm115 3 · cm116 3 · cm117 52 · cm120 18 · cm122 22 ·
  cm125 8), que el port **carga y pinta** (`liveTiles`, validado con testigo el
  2026-07-21, cm115/cm120) y el cetro disuelve (`CAST 0x19a5`, `(t&0xf0)==0x70`).
  El daño por turno de la fase 1 de `0x1b1e` mira `0x8F`/`0xBC`/`0x04`, no `0x70-0x7f`
  (`field-spell-port.md` §6) — tampoco ahí hay nada perdido.

Las dos copias tracked de la frase quedan tachado-documentadas apuntando aquí
(`sprite-frame-drop-tercer-sapo-cargador.md` §TICKET SEPARADO y
`siembra-objetos-cbt-353.md` §7). Clase del error: cita de port escrita junto a la
derivación sin verificarla (la derivación del binario era correcta; la línea de port, no).

## 5. Pata `0xb4` — rama REAL del binario, VACUA en los datos del cargador

`0x12b8` existe y clasifica la familia `0xb4` (`0xB4-0xB7` = corona/cetro/amuleto +0x100,
`objects.md` O3) como tipo 2 — pero **ningún registro de BRIT.CBT ni DUNGEON.CBT trae una
unidad ni un trigger de esa familia** (censo §3, doble fuente). ⇒ Para el CARGADOR la pata
`0xb4` se cierra como **inalcanzable desde datos**: no hay nada que sembrar y ninguna
divergencia observable puede construirse desde el `.CBT`. Lo que sigue vivo de `0xb4` no
es del cargador: es el careo del (G)et para objetos colocados EN CALIENTE (la rama
`0x197b → 0x172e` ya derivada), que solo se ejercita si algún camino de runtime deja un
regalia en la arena — fuera del alcance de este ticket.

## 6. Pata `0xe8` — divergencia REAL del port, acotada; todo el lado binario ya está

Qué hace el binario con las 26 unidades (todo con cita, nada nuevo que derivar):

1. **Siembra** (cargador): tipo 2 → fase 2 escribe el sprite crudo en `0x5c5a`/`0x5c5b`
   + X/Y/planta + `0xff` (§2). Sin rand (rama decorado).
2. **Render**: la tabla de objetos pinta con banco `+0x100` ⇒ tiles 488-491
   (`0x1E8-0x1EB`) — los cuatro campos visibles.
3. **Efecto por turno** (`COMBAT 0x1b1e` fase 2, `field-spell-port.md` §6): `0xE8` →
   VENENO (magnitud 0x32) · `0xE9` → SUEÑO (0x96, `durmiente` 0x68ae) · `0xEA` → DAÑO
   (0x64, `rand_range(0..10)`) · `0xEB` sin efecto por turno.
4. **Ocupación** (`COMBAT 0x0000 combat_cell_occupancy_test`, re-leída aquí): devuelve
   1=libre (agota el barrido → `0x00f6 jmp 0x20 → mov ax,1`) / 0=bloqueada. En el barrido
   de objetos, **`0xEB` BLOQUEA la celda** (`00a4: cmp dx,0xeb / 00aa: sub ax,ax … jmp
   0x146` — mismo retorno-0 que el terreno impasable de `0x40`) y **`0xE8`/`0xE9`/`0xEA`
   son TRANSPARENTES** (`00b6: and al,0xfc / cmp al,0xe8 / je 0xc8` = siguiente slot),
   igual que cadáver `0x1e` y mancha `0x1f` (`00be-00c6`). Coherente con el §6 de
   field-spell-port: el campo de energía no daña por turno porque no se puede pisar.
5. **Disolución**: `an_grav_dispel_field` (`CAST2 0x07bc`, `&0xfc == 0xE8`) cubre los
   cuatro; el cetro NO los toca (barre TILES, no la tabla de objetos).
6. **(G)et**: no casan en el barrido de `cmd_get` ⇒ no recogibles.

Qué hace el port en el punto equivalente: `seedArenaObject` retorna en `sprite >= 0x40`
(`combat.ts:1059`) ⇒ en cm18/cm20/cm121 **los 26 campos no existen**: ni se ven, ni
bloquean (`0xEB`), ni envenenan (`0xE8`), ni son objetivo de An Grav. Además el efecto
por turno de `0x1b1e` está entero sin portar (declarado en `combat.ts:15`), también para
el TERRENO (`0x8F`/`0xBC`/`0x04`).

**FICHA — CERRADA (carril campos-energia, 2026-08-23; ver §7):** sembrar las
unidades de familia `0xe8` como objetos de arena en cm18/cm20/cm121 (0 rands ⇒ sin efecto
en el stream) con: render `+0x100`, bloqueo de celda SOLO `0xEB`, efecto por turno vía el
cableado de `0x1b1e` (las DOS fases: la 1 de terreno era la misma obra y va incluida),
objetivo de An Grav en su rama de combate, no-recogibles, y el cetro sin efecto sobre
ellos. Alcance de familia `0xb4`: nada (§5). Guardas:
`game/tests/campos-energia-arena.test.ts` (16, esperados en crudo del volcado + réplica
independiente del RNG; hoy 18: el carril energia-adjudicacion añadió el §f del gate del
veneno por KIND; hoy 24: combate-cabos añadió el §g del tail 0x0ca3 sobre el cadáver +
censo-guarda de la esquina (0,0)). ⚠ Los veredictos vivos de salas de cm18/cm20/cm121 no mueven
stream por la siembra, pero el TABLERO efectivo cambia (celdas bloqueadas/venenosas):
re-adjudicar jugando, como se hizo en #353 — ~~ese re-juego queda PENDIENTE (no es de
este carril: es la pasada de adjudicación de salas)~~ [HECHO 2026-08-24, carril
energia-adjudicacion: `ch47-campos-readjudicacion.spec.ts` (×2 por sala, mismas
recetas/mecanismos que los sellos) — cm20 y cm121 SOSTIENEN VICTORY:e0:d0; cm18 FLIPEA
para el resolvedor a DEADEND-STUCK:e1:d0 (el istmo 0xEB + moral rota por invisibilidad
deja un enemigo inalcanzable, y los bordes de cm18 son muro) pero la sala SE GANA
JUGANDO con An Grav ×4 (VICTORY:e0:d3) ⇒ no es softlock; ficha de arnés (repertorio
sin An Grav, familia #12) y detalle en
`re/notes/energia-readjudicacion-cm18-cm20-cm121.md`. La ficha quedó CERRADA el mismo
día (carril combate-cabos): `conquerRoom` lleva la capacidad An Grav con política
DEADEND-STUCK y cm18 re-mide VICTORY:e0:d0 del resolvedor — acta §4 de la misma nota].

## 7. Cierre del port (carril campos-energia, 2026-08-23) + lo derivado NUEVO

Cableado (todo en `game/src/core/combat/combat.ts` salvo el cursor):
`fieldSlots` (LISTA de ranuras — el `.CBT` APILA campos en la misma celda: 4+4+4 en
cm18, 4+4 en cm20, 6 en cm121, y cada uno es una ranura de `0x5C5A`) · siembra en
`seedArenaObject` (0 rands) · `fieldBlocksCell` en ocupación (celdas y blink) ·
`endOfTurnFieldDamage` (0x1b1e entera, fases 1+2+despacho) · `castDispelField` +
cursor de Aim propio en `main.ts` (sin veto de celda propia, sin clamp) · render vía
`lootTiles()` `+0x100` (tiles 0x1E8-0x1EB, la piel ya blitea esa capa).

Derivado NUEVO en este carril (re-careado en crudo, no estaba en el ticket):

- **Cuándo corre 0x1b1e**: el ÚNICO call-site es el bucle de iniciativa
  (`COMBAT 0x0ca2-0x0ca5 push g_cmb_actor / call 0x1b1e`), tras volver de la rutina
  de turno (0x0c84 → 0x3f4 enemigo / 0x63e party) y ANTES del recuento/victoria
  (0x0ca6/0x0cf6) ⇒ una vez por ACTIVACIÓN, para ambos bandos. En el port:
  `advanceTurn`, tras los ganchos de cola de party y antes del latch de victoria.
- **Fase 2 salta la ranura PROPIA del actor** (`0x1b9a cmp dx,[bp-0xa]`, con
  `[bp-0xa]` = byte +4 del registro de combatiente = su índice en la tabla de
  objetos): sin eso el actor «pisaría» su propio objeto. En el port los combatientes
  no viven en `fieldSlots` ⇒ el salto es estructural.
- **El gate del veneno** (`0x1c46 cmp [idx*8+0x5c5a],0x80 / jae`) lee el KIND del
  actor: PJ = tile de clase (byte bajo `0x1c-0x4f` < 0x80, siempre pasa); enemigo =
  sprite normalizado `(índice<<2)+0x40` ⇒ pasa sólo índice < 16. Los 208/176 de cm20
  y los 240 de cm121 son ≥ 0x80: inmunes al veneno de su propia sala.
- **An Grav en combate, cuerpo completo** (CAST2 0x866-0x8db): apuntador `0x306`
  (cursor por teclas desde la CELDA PROPIA, confirma con 0x20 — SIN veto de self y
  SIN clamp de alcance; los apuntadores de arma COMSUBS 0x0504 sí vetan self) →
  barrido de ranuras `kind&0xfc==0xe8` + (x,y) → borra **UNA** (0x8c1 call 0x5894,
  seis ceros) → res 1; sin campo → res 0. Al tail del Cast 0x11a6: 1 → "Success!"
  (DS 0x4656) · 0 → "Failed!" (DS 0x4660) · abort del cursor → −1, mudo. ⇒ una pila
  de N campos apilados pide N lanzamientos — conducta del binario, calcada.
- ~~**Divergencia declarada (Clase C)**: el binario llama 0x1b1e también con un actor
  que murió/huyó EN SU PROPIO turno (opera sobre el registro rancio); el port lo
  gatea con `isActive` — borde sólo alcanzable muriendo sobre campo/terreno dañino
  en el propio turno.~~ **CERRADA (carril combate-cabos, 2026-08-24)** — derivado el
  destino del registro rancio, la clase se PARTE en dos y ninguna queda divergente:
  · **huido/absorbido = REFUTACIÓN**: el registro llega al tail BARRIDO A CEROS
    (huida enemiga COMBAT:0x04d8-0x0512 y absorb 0x1f13 → `0x1236` con índice negado,
    que cero-ea récord Y ranura; huida de PJ SJOG:0x1c3f-0x1c46 → mismo sweep vía stub
    0xbe02) ⇒ 0x1b1e lee la celda (0,0) — nunca 0x04/0x8F/0xBC en los 128 combatmaps
    (censo-guarda `campos-energia-arena.test.ts` §g) — y fase 2 salta la ranura 0
    ([bp-0xa]=0) ⇒ NO-OP estructural: el gate `isActive` del port ES la conducta.
  · **muerto en su propio turno = FIX cableado**: la muerte NO barre (0x1574 conserva
    x,y y [rec+4]; PJ `or [rec+2],0x20` @0x15e0 + corpse 0x1E en la ranura, < 0x80 ⇒
    pasa el gate del veneno 0x1c46) y el tail 0x0ca3 corre 0x1b1e sobre el cadáver:
    veneno = rand(0..20) (0x18ba rama no-'G' @0x18dc) + 0x1574 idempotente; daño =
    rand(0..10) + 0x1574 + 0xdb22; sueño = 0x68ae exento por 'D' (0x68d9). Vector
    alcanzable: trampa ACID de cofre de arena (open_chest_world 0x122c-0x1296 mata al
    que abre en su turno). El port ahora cierra el turno del recién muerto por las
    MISMAS primitivas (`advanceTurn` gate `isActive(closing) || status==="dead"`);
    testigos con esperados de réplica en §g (seed 0x51da→0xcedd = la tirada del tick).

**CABO que queda (chico, fichado aquí):** `0x92d4` — kernel llamado en las ramas de
veneno (tras `poison_attack`) y daño (antes de `0x1574`) de 0x1b1e; 2 call-sites en
los 28 .asm, AMBOS en esa rutina, y la dirección cae FUERA del disasm del residente
(`ULTIMA.EXE.asm` acaba en 0x86ee). Por posición es un cue de realimentación
(flash/beep del dañado); NO se fabrica en el port — los eventos attacked/poisoned
llevan la realimentación. Si algún carril amplía el disasm del residente más allá de
0x86ee, derivarlo y decidir si es un sfx que falta.
