# Witness O1 (LIVE) — tabla de objetos 0x6B4 (DS:0x5C5A) en interior/overworld · confirma #57

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Relevo del
encargo O1: capturar EN VIVO los escenarios que `re/notes/witness-o1-0x6b4.md` sólo pudo
DERIVAR (interior-transición / overworld / barco). Oráculo headless propio
(`/private/tmp/<oracle-rundir>-queue`). Probes: `probe_persist_6b4.py` (dumps interior/overworld),
`probe_persist_inject.py` (monstruos inyectados). Método: el region de save 0x55A6-0x6605 es
un ESPEJO directo RAM→.gam (file 0x6B4 ≡ DS 0x5C5A), ya probado por el witness previo (el
SAVED.GAM de disco reproduce la RAM), así que **leer DS:0x5C5A en un estado estable = los
bytes que el Quit-save escribe** (BPM write-BP no fiable, oracle.md §BPM → uso lecturas RAM).

## Datos crudos capturados EN VIVO

### (a) INTERIOR (boot = choza de Iolo, loc=0x11, floor=0xFF)
```
slot 0: 1c 1c 0f 1a ff 00 00 00   avatar a-pie (obj0): +0/+1=0x1C tile, +2/+3=(15,26)=party, +4=0xFF
slot 1: 48 4b 0d 0b ff 00 30 00   NPC town: +0=0x48 base, +1=0x4B frame ANIMADO (≠+0), +6=0x30
slot 5: 50 53 09 17 ff 00 30 00   NPC town: +1=0x53≠+0=0x50, +6=0x30
slot 6: 1e 1e 09 09 ff 00 00 00   NPC town: +6=0
slot 7: 54 54 10 13 ff 00 35 00   NPC town: +6=0x35
slots 8-17 (tile=0, libres): +6 RANCIO no-nulo (0x60/0x60/0x20/0x10/0x30/0x30/0x30)
```
### (b) OVERWORLD (loc=0x00, floor=0x00, party 86,107)
```
slot 0: 1c 1c 56 6b 00 00 00 00   avatar (obj0): +0/+1=0x1C, +2/+3=(86,107)=party, +4=0x00 (≠interior 0xFF)
slots 1-16: TODOS tile=0x00 (los NPCs del interior DESAPARECIERON), +6 rancio (0x10/0x70/0x42/0x80/...)
```

## HUECO 1 — interior RESEED vs PERSIST: **CONFIRMADO (reseed) EN VIVO**

La transición interior→overworld **borra los NPCs del interior de la tabla**: los slots
1/5/6/7 tenían tiles NPC (0x48/0x50/0x1E/0x54) en el interior y quedan **tile=0x00** en el
overworld. ⇒ la pool 1..23 es LOCAL a la localización, NO se acarrea al cruzar la frontera.
Corrobora en vivo el veredicto derivado (memset de entrada a interior, MAINOUT 0x0857) y
VALIDA el diseño del port: `OverworldEnemies.clear()` en `loadSmallMap`/`enterDungeon` +
gate `writeNativeOverworldEnemies if location===0` = FIEL. **Sin cambios al port.**

## HUECO 2 — slot0 EN BARCO: **CONFIRMADO por identidad de dirección (sin barco vivo)**

El core del hueco 2 (¿obj0+5=hull, obj0+7=skiffs en fragata?) es una **identidad de
dirección**, no requiere navegar a un barco:
- `g_hull = DS:0x5C5F` (transport.md:32) = obj0(slot0 @0x5C5A) **+5** — MISMO byte.
- `g_skiffs = DS:0x5C61` (transport.md:33) = obj0 **+7** — MISMO byte.
- `g_transport_tile = DS:0x587C` = obj0 **+0/+1** — CONFIRMADO en vivo: obj0+0=0x1C=el tile
  de transporte a-pie en AMBOS estados (interior/overworld). En fragata el mismo byte llevará
  el tile de la nave (0x10-0x17/0x24-0x2B); el mecanismo es idéntico.
- Corrobora transport.md:141: el spawner del pirata escribe `mov [bx+0x5C5F],0x64` (hull=0x64)
  = obj0+5. Y +7 es dual: skiffs (obj0 activo) / acumulador de viento (naves NPC 0x2C, §3b).

⇒ el layout de barco `[tile tile X Y floor HULL +6 SKIFFS]` es correcto por construcción. Un
dump vivo en fragata sólo cambiaría obj0+0 de 0x1C al tile de nave (marginal). El port ya
cablea obj0 entero desde el transporte (`saveNative.ts`, witness previo §6a).

## HUECO 3 — byte +6 (O2): **CONFIRMADO campo VIVO persistido, NO scratch**

Evidencia viva: +6 es **no-nulo y por-actor** en NPCs (0x30/0x35), **rancio pero preservado**
en slots libres (el binario NO lo limpia al vaciar el tile: overworld slots 1-16 tile=0 pero
+6≠0). Y **+1 es el frame ANIMADO vivo**, no un espejo de +0 (NPCs: 0x48→0x4B, 0x50→0x53).
Confirma la corrección del witness previo a `native-persist-enemies.md` (+1=frame vivo,
+6=estado de mover persistido). El port escribe +6=0 (`saveNative.ts:341`): **divergencia de
byte del .gam, conductualmente INOCUA** (el mover del DOS reescribe +6 en el 1er turno tras
cargar). Documentada; sin cambio salvo que se exija paridad byte del .gam de overworld.

### MONSTRUOS inyectados en overworld (probe_persist_inject) — +6/+1 VIVOS, +0 estable

Inyecté 2 monstruos (tile 0x90 rata en slot2, 0x94 en slot3, +6=0 al inyectar) y pasé turnos:
```
inj_t0: slot2 90 90 59 6b 00 00 00 00   slot3 94 94 56 6e 00 00 00 00   (recién inyectados, +6=0)
inj_t1: slot2 90 93 58 6b 00 00 30 00   slot3 94 94 56 6d 00 00 10 00   (+1 y +6 CAMBIAN, X/Y se mueven)
inj_t2: slot2 90 92 58 6a 00 00 20 00   slot3 94 97 56 6c 00 00 40 00   (siguen cambiando)
```
- **+0 (tile base) ESTABLE** (0x90/0x94 todos los turnos) = identidad del monstruo.
- **+1 = frame ANIMADO VIVO**: cicla cada turno (0x90→0x93→0x92; 0x94→0x94→0x97). Confirma
  +1=frame vivo (NO espejo estático de +0).
- **+6 lo ESCRIBE EL MOVER**: 0 al inyectar → 0x30/0x10 → 0x20/0x40. ⇒ +6 es estado-de-mover
  VIVO por-actor también para MONSTRUOS (no sólo NPCs de town) — cierra hole 3 en vivo.
- **+2/+3 (X/Y) se actualizan** al moverse el monstruo hacia la party (rata 89→88, 107→106).
  ⇒ el mover procesa la entrada de la tabla y la reescribe cada turno. El save la persiste.
- **+5/+7 = 0** en monstruos genéricos inyectados (el pirata pondría +5=0x64 vía el SPAWNER
  0x1050, no vía el mover — no reproducible por inyección; ya citado en transport.md:141).

## Veredicto

Los 3 huecos de #57 quedan CERRADOS con evidencia viva (holes 1 y 3) + identidad de dirección
(hole 2): el diseño del port (`saveNative.ts`) es FIEL en los tres. El único residuo es la
paridad byte del +6 en saves de overworld (inocua, documentada) y un dump vivo en fragata
(marginal, el mecanismo está confirmado por aliasing). Confirma y NO refuta el witness previo
derivado (`witness-o1-0x6b4.md`).

## Evidencia
- Probes: `re/notes/probe_persist_6b4.py`, `re/notes/probe_persist_inject.py`; salidas
  `persist_6b4.json`, `persist_inject.json`.
- ASM/derivación: `re/notes/native-persist-enemies.md`, `witness-o1-0x6b4.md`, `transport.md`.
- Port: `game/src/core/saveNative.ts` (obj0 sync + writeNativeOverworldEnemies).
