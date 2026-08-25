# Pasabilidad — los 18 tiles FLAG resueltos (carril oráculo, RELEVO 2 · 2026-07-18)

Cierre de los tiles marcados **⏳ FLAG** en `passability-29tile-audit.md` (semántica incierta,
prohibido resolver por analogía). El brief los contó como "18"; la lista enumerada son **19**
(carpet 0xaa + camas 0xab-ac por separado). Mandato del lead: por-tile, (1) ¿qué hace el
BINARIO al pisar?, (2) ¿tiene el port handler?, (3) veredicto.

## TL;DR — el 72 % de los FLAG eran FALSOS POSITIVOS de un volcado anómalo

**La auditoría de 29 tiles comparó el `walkable` del port contra un volcado de `DS:0x54d4`
tomado EN OVERWORLD que NO es la tabla canónica de pasabilidad.** La tabla canónica está
**almacenada en `DATA.OVL @ file 0x54e4`** (= `DS:0x54d4` en vivo, es DATA.OVL residente en
el segmento de datos del kernel) y **coincide byte a byte con mi volcado en vivo dentro del
Castillo de LB**. Contra esa tabla canónica:

- **14 de 19 FLAG COINCIDEN con el port** → el port es FIEL; la "divergencia" era artefacto
  del snapshot overworld anómalo. NO tocar.
- **1 es DELIBERADA** (BrokenShrine 0x1a = patrón moongate: se entra para restaurar). NO tocar.
- **4 divergencias reales** quedan, todas de bajo impacto: 0x1c oasis y 0xc3 campo-muerto
  (candidatas a swap conservador→block), 0xf9 flavor-sign (trivial) y 0xff void (dejar como
  está, el port hace bien).

**Resultado neto: de los 19 FLAG, 0 swaps urgentes; el port ya es fiel salvo flecos menores.**

## Descubrimiento clave — `0x54d4` es la tabla ALMACENADA en DATA.OVL, no una foto de runtime

1. **Ruteo de pasabilidad (RE de kernel 0x2bd4/0x2c4c):** el predicado maestro `0x2c4c`
   clasifica por TRANSPORTE vía tabla `0x54f4` (indexada por el tile del vehículo, 0x10-0x2f =
   monturas/naves) y salta a 1 de 11 handlers (jump-table `0x2d60`). **A pie el índice es 0 →
   clase 0 → predicado puro del bitmap `0x54d4`** (`0x2bd4`: `bloquea ⟺ bit (0x80>>(t&7)) de
   bm[t>>3]`; bit SET = bloquea). Verificado contra tiles conocidos: grass(5)=pasa,
   agua-profunda(1)=bloquea, chimenea(0xbc)=bloquea, brick-floor(0x44)=pasa. ⇒ **para el
   Avatar a pie el bitmap ES la respuesta.**
2. **Nadie ESCRIBE `0x54d4` con dirección literal** (grep en todo el disasm: solo 4 LECTURAS
   —`0x2bee`,`0x2d28` del predicado— y 0 stores). El bitmap es el blob de DATA.OVL cargado
   residente (DATA.OVL = nivel-5, "coexiste con todos", `overlay-load-layout.md`).
3. **DATA.OVL contiene UNA sola tabla de pasabilidad** (`@0x54e4`, 32 B). El patrón
   overworld del volcado del predecesor (`…fc 7f ff 7f 03 ff ff 3f…`) **NO existe en DATA.OVL
   ni en la imagen del disco** → no es una tabla almacenada; fue un estado de runtime
   transitorio/anómalo.
4. **Las tablas contiguas también matchean el binario en vivo:** class-table `0x54f4` y
   `0x5510` (DATA.OVL 0x5504/0x5520) idénticas a la lectura viva.

### Volcados (arnés headless propio, run-dir `/private/tmp/<oracle-rundir>-*`, sin dosbox ajeno)

```
CANÓNICO (DATA.OVL@0x54e4 == vivo en Castillo LB loc=0x11):
  70 0c 00 28 01 f3 00 bd 72 3f ff ff ff cf ff ff fc f6 0f ff ff c7 ff f7 f0 3f ff f3 ff ff ff be
OVERWORLD (predecesor, lote-D obj2) — ANÓMALO, difiere SOLO en bytes 21-28 (tiles 0xa8-0xe7):
  70 0c 00 28 01 f3 00 bd 72 3f ff ff ff cf ff ff fc f6 0f ff ff fc 7f ff 7f 03 ff ff 3f ff ff be
```

**Clave del error del audit:** los únicos bytes que difieren (21-28) cubren EXACTAMENTE los
tiles 0xa8-0xe7 = mobiliario/vallas/carteles/campos — contenido de PUEBLO/mazmorra que **NO
aparece como terreno en el overworld**. El audit leyó los bits de pasabilidad de tiles de
PUEBLO estando EN OVERWORLD, donde esos bits no gobiernan ningún tile visible; y los comparó
contra los flags universales de TileData. En el contexto donde cada tile SÍ aparece
(pueblo/castillo/mazmorra) manda la tabla canónica de DATA.OVL — que coincide con el port.
El propio volcado overworld implicaría **desert3 0xdd = BLOQUEADO**, imposible (los desiertos
se cruzan a pie) → confirma que ese snapshot no es la pasabilidad real por-tile.

**Robustez del veredicto:** la disyuntiva "¿el overworld PARCHEA la tabla en runtime, o el
snapshot fue transitorio?" **no cambia ningún veredicto**: (a) los 14 tiles de pueblo son
autoritativos en contexto de pueblo (= mi volcado en Castillo LB = tabla almacenada = port);
(b) los tiles de overworld (0x1c/0x1a/0xdd) se juzgan con su valor de overworld, y ahí
"desert bloqueado" es el artefacto, no una regla. El test same-boot (salir del castillo al
overworld en un boot) se INTENTÓ pero el party quedó bloqueado por muro dentro del Castillo LB
(navegación cara, no justificada dado que los veredictos son robustos en ambas ramas).

## Veredicto por-tile

Leyenda: STORED = bit del bitmap canónico (BLOCK/pass). port = `IsWalking_Passable` (TileData
= Ultima5Redux, la fuente Clase-D que el port lee). "handler" = mecánica separada del port.

### A) 14 FLAG que COINCIDEN con el canónico → port FIEL, falso-positivo del audit (NO tocar)

| tile | nombre | STORED | port | handler del port | veredicto |
|---|---|---|---|---|---|
| 0xaa | Carpet | pass | walk | — | **MATCH**. Se anda sobre la alfombra decorativa (castillo LB). |
| 0xab | LeftBed | pass | walk | — | **MATCH**. Se anda sobre la cama. |
| 0xac | RightBed | pass | walk | — | **MATCH**. |
| 0xae | CoffeeTable | BLOCK | blocked | push (CMDS 0x14BA rango 0xad-af) | **MATCH** + empujable. |
| 0xaf | Box | BLOCK | blocked | push (CMDS 0x14BA) | **MATCH** + empujable. |
| 0xb0 | RightSconce | BLOCK | blocked | — | **MATCH**. Candelabro de pared sólido. |
| 0xc0 | ForceField (vivo) | BLOCK | blocked | — | **MATCH**. Campo activo bloquea. |
| 0xca | FenceHoriz | BLOCK | blocked | klimb (TOWN 0x0C19) | **MATCH** + encaramable. |
| 0xcb | FenceVert | BLOCK | blocked | klimb (TOWN 0x0C19) | **MATCH** + encaramable. |
| 0xcc | Wtf1 | BLOCK | blocked | — | **MATCH**. Sólido; sin mecánica. |
| 0xcd | Wtf2 | BLOCK | blocked | — | **MATCH**. |
| 0xdd | Desert3 | pass | walk | terreno lento | **MATCH**. Desierto transitable (el "BLOCK" del snapshot overworld era el artefacto). |
| 0xe0 | LargeSign (poste) | BLOCK | blocked | — | **MATCH**. Estructura del cartel (la CARA legible es otro tile: {0x89,0x8A,0xA0,0xA4,0xF8}). |
| 0xe1 | LargeSign (poste) | BLOCK | blocked | — | **MATCH**. Idem. |

### B) 1 FLAG DELIBERADO (bitmap bloquea, port entra para disparar mecánica) → NO tocar

| tile | nombre | STORED | port | veredicto |
|---|---|---|---|---|
| 0x1a | BrokenShrine | BLOCK | walk | **DELIBERADA (patrón moongate).** Mover HACIA el tile dispara la restauración del santuario: `CMDS.OVL 0x130c-0x138f` escanea los 4 vecinos por 0x1a y llama `0x1202` (shrine-restore) con las coords del santuario; el port lo espeja en `checkShrineEntry`/`pendingRestore` (game.ts:490,4577). El bitmap lo bloquea igual que a moongate 0xdc; el handler de movimiento lo override-a. Mantener `walk=1`. |

### C) 3-4 divergencias REALES (bajo impacto)

| tile | nombre | STORED | port | veredicto |
|---|---|---|---|---|
| 0x1c | Oasis | **BLOCK** | walk | **DIVERGE (binario bloquea, port anda).** No es patrón moongate (sin handler de oasis en el port; no está en el rango fuente 0xd8 del fountain-drink). En el bitmap canónico solo 0x1a y 0x1c están bloqueados de su banda (0x18-0x1f) → ambos son tiles "especiales". Candidato a **swap port→walk=0** para casar el binario. CONSERVADOR hasta un witness "andar hacia un oasis en el desierto" (¿el tile es el charco impasable y se interactúa desde adyacente?). Impacto bajo. |
| 0xc3 | ForceField (muerto) | **BLOCK** | walk | **DIVERGE.** De los 4 campos 0xc0-c3 el port bloquea c0/c1/c2 pero PASA c3; el binario bloquea los 4. Candidato a **swap port→walk=0** (Clase-A binario) — SALVO que 0xc3 solo aparezca en mazmorra (1ª persona), donde manda DUNGEON.OVL y el flag 2D es inobservable. Witness: pisar un 0xc3 en Blackthorn/mazmorra. CONSERVADOR: bloquear. |
| 0xf9 | SignShipwright | pass | **blocked** | **DIVERGE menor (binario pasa, port bloquea).** Tile "flavor" (no es cara legible). El port sobre-bloquea; a lo sumo impide un paso legítimo. Impacto trivial. Dejar como está o casar el binario (walk=1); baja confianza sin ubicación viva del tile. |
| 0xff | BlackSquare (void) | pass | **blocked** | **CONSERVADOR-SEGURO.** El bit "pasa" del void es casi seguro don't-care (el tile negro no es una celda de terreno real; aparece en niebla/bordes). El port bloquea por defensa. No es un problema de fidelidad. Mantener el bloqueo del port. |

## Dónde vive cualquier fix (si el lead lo aprueba)

Los 3-4 residuales tocarían `game/src/core/data/TileData.json` (dataset Clase-D vendorizado)
como override citado al binario `0x54d4` (Clase-A), NO edición silenciosa. Pero **ninguno es
urgente**: 0xff es correcto como está; 0xf9 es trivial; 0x1c y 0xc3 son swaps conservadores de
bajo impacto que idealmente se confirman con un witness vivo (oasis en desierto / campo en
Blackthorn) antes de tocar. El grueso del audit (los otros 14 + el shrine) **NO requiere
cambio**: el port ya es fiel a la tabla canónica de DATA.OVL.

## Método / evidencia

- Predicado y ruteo: `re/disasm/ULTIMA.EXE.asm` 0x2bd4 (bitmap), 0x2c4c (dispatch por
  transporte), jump-table 0x2d60, helper agua 0x2c2e, clases 0x2c6a-0x2d5a.
- Shrine: `re/disasm/CMDS.OVL.asm` 0x12f2-0x1398 (escaneo de vecinos + call 0x1202).
- Handlers del port: `movement.ts::isPassable` (lookup puro, sin override), `commands.ts::
  isPushableTile` (CMDS 0x14BA), `game.ts:2398` (klimb vallas), `game.ts:4239/4309`
  (SIGN_TILES = caras legibles {0x89,0x8A,0xA0,0xA4,0xF8}), `game.ts:490/4577` (shrine).
- Tablas: DATA.OVL `original/u5/play/DATA.OVL` @0x54e4 (pasabilidad), @0x5504 (clase),
  @0x5520 (0x5510). Volcado vivo confirmatorio (Castillo LB, loc 0x11): idéntico.
- Probes (scratchpad del carril): `probe_pass_tables.py`, `probe_ctx.py`, `probe_exit.py`.
