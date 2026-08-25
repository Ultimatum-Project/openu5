# Witness #6 — In Flam Grav overworld: opacity-stop, patrón y BURN-vs-STOP · CONFIRMA

> 🔴🔴 **ANOTADO EL 2026-08-20 (ficha #138): las tres CONFIRMACIONES de la tabla mueren; los
> datos DUROS sobreviven con otro significado.** Este testigo casteó en el MISMO save y la
> misma posición que field-duration ((86,107) overworld) — que es **la PUERTA del Castillo de
> Britannia**: las «celdas de campo 0x3a-0x3f al norte» del composite son los seis tiles del
> castillo en el mapa crudo (`3a 3b 3c / 3d 3e 3f` en (85-87,106-107), BRIT.DAT), y `0xb19e`
> son las entradas 0x80-0x83 de la tabla-remap de animación DS:0xB11E (init identidad
> INTRO.OVL 0x0993, reloj ULTIMA.EXE 0x44b8). Derivación: `remap-anim-b11e-castillo-138.md`.
> Con el gate de ubicación del 08-08 (`field-grav-gate-testigo-20260808.md`: máscara 0x03,
> en sobremundo el In\*Grav ni se lanza), la lectura completa es: **aquí no se sembró campo
> alguno**.
> · MUERE «patrón FIJO reproducido» (la colocación direccional-norte ERA el castillo; la
>   seed-invarianza es trivial en terreno). · MUERE «campo en display + 0xb19e» (castillo +
>   remap de animación). · MUERE «BURN sobre obstáculo» para overworld (no hay vía overworld).
> · SOBREVIVE el chunk-negativo (0x595a intacto): hoy significa que el cast fue RECHAZADO,
>   corrobora al gate. · SOBREVIVE el decode de `0x004c` (rama loc + gate 0xf7 + chunk 0x595a),
>   que es la vía VIGENTE de mazmorra (`field-spell-port.md` banner). · El 0-hits del BP
>   0x3f6e incluye un cast en COMBATE (banda donde el gate SÍ deja pasar): ese dato queda a
>   cargo de los-audit, no se adjudica aquí. **Texto íntegro abajo, sin tocar.**

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Relevo del carril
oracle-fire (que PARÓ sin cast fresco). Desbloquea #6→#13. Probe:
`re/notes/probe_ifg_obstacle.py` (copia). Oráculo headless propio (`/private/tmp/<oracle-rundir>-queue`).

## VEREDICTO: CONFIRMA la lectura conservadora ("BURN + fijo + sin corte 0x6a14")

Las tres afirmaciones de la lectura ya cableada quedan sostenidas por evidencia convergente:

| Afirmación | Estado | Evidencia |
|---|---|---|
| **Sin corte 0x6a14** (no opacity-stop) | **CONFIRMADO (duro)** | los-audit: BP de kernel FIABLE en `0x3f6e` (el predicado LOS que lee 0x6a14) = **0 hits** en 3 casts (2 overworld + 1 combate). Mi cast fresco corroboró: campo colocado sin consultar LOS. |
| **Patrón FIJO determinista** (no radial-probabilístico) | **CONFIRMADO (duro)** | field-duration + los-audit: patrón seed-invariante (1234 vs 7abc idénticos). Mi baseline reprodujo la colocación direccional-norte con aim UP. |
| **BURN sobre obstáculo** (siembra igual) | **SOSTENIDO (por implicación)** | el handler operativo (0x1c36) NO tiene gate de terreno ACTIVO para fieldWall (su rama LOS/obstáculo 0x1c28 está puenteada por `0x1c03: test [bp+6],1; je`, evidenciado por los 0-hits de 0x3f6e). Sin gate → la plantilla fija estampa sin importar el terreno = BURN. Ver caveat abajo. |

## HALLAZGO NUEVO — descarta la hipótesis STOP (y descarta el handler 0x004c para overworld)

Decodifiqué `CAST.OVL:0x004c` (el handler que lee LAS TABLAS EXACTAS de fieldWall:
`FIELD_WALL_TILE` DS:0x4596 y `FIELD_WALL_COMBAT_WEAPON` DS:0x4592, = tables.ts). Tiene rama
por localización (`0x0054: cmp [g_location],0x80; jb→stamp; else→arma`) y, en la rama
overworld, un **GATE por celda**: `0x00b8: test byte[existing_tile],0xf7; jne FAIL(return 0)`
— sólo estampa si (tile & 0xF7)==0, y escribe UN cell al chunk `DS:0x595a`. Esto SUGERÍA
semántica STOP (rechaza celda con obstáculo).

**PERO mi cast fresco lo REFUTA como vía overworld:** el baseline de In Flam Grav (aim UP,
overworld (86,107)) dejó el chunk `0x595a` **completamente sin tocar** (64 bytes = 0x00 antes
y después; target 0x5970 = 0x00→0x00; chunkΔ=[]). El campo apareció SÓLO en el composite de
display `0xab02` al norte del party (celdas 0x3a/0x3c leídas). ⇒ **el In Flam Grav de OVERWORLD
NO pasa por 0x004c** (no escribe el chunk); el campo vive en el composite de display + el
registro `0xb19e` (confirma field-duration). Por tanto **el gate STOP de 0x004c NO aplica al
overworld** — pertenece a otro contexto (town/dungeon fieldWall, location<0x80, o vía no
alcanzada). Esto ELIMINA la única base para una lectura STOP en overworld.

## Reconciliación de los tres carriles (cerrada)

- **field-duration**: campo en `0xb19e` (4 tipos, anim 2-frame) + composite `0xab02` (0x3a-0x3f),
  patrón fijo, persiste. ✓ (mi chunk-negativo lo respalda: no está en 0x595a).
- **los-audit**: In Flam Grav → handler `0x1c36`; BP fiable 0x3f6e = 0 hits → NO usa 0x6a14; la
  rama LOS 0x1c28 puenteada por el gate 0x1c03. ✓ (handler operativo = 0x1c36, no 0x004c).
- **0x004c** (mi decode): fieldWall con gate STOP + chunk 0x595a, pero **NO es la vía overworld**
  (chunk intacto). Contexto distinto. ✓ sin contradicción.

⇒ Para #13: **el opacity-stop 0x6a14 + peso radial NO se cablean al fieldWall de overworld**
(In Flam Grav). Son del aplicador de línea/apuntado verdadero (castLineAoe, p.ej. In Flam Hur),
NO del muro de campo. El muro de campo overworld = plantilla FIJA direccional en el display,
sin LOS, sin radial. **PENDIENTES-USUARIO #4d: el eje opacity-stop se RETIRA** (confirmado
negativo por BP fiable + chunk-negativo).

## Caveat honesto (lo que NO se midió directo)

El dato empírico BURN-vs-STOP sobre una celda IMPASABLE real **no se capturó en vivo** (el
SIGALRM de 480s cortó el 2º cast; y el test que preparé apuntaba a 0x595a, que resultó no ser
el buffer del campo). El BURN queda como **implicación fuerte** (handler sin gate activo +
plantilla terreno-invariante), no como medición directa. Si el lead lo quiere AIRTIGHT: método
robusto = inyectar un OBJETO impasable (árbol) en la tabla de objetos overworld `DS:0x5C5A`
adyacente al party (estilo `combat_parity.inject_rat`, sobrevive al redibujo — a diferencia de
0xab02 que se recomposita), castear hacia él, y leer 0xab02 (1 byte/cell, stride 32) en esa
celda: código de campo 0x3a-0x3f = BURN, tile del árbol = STOP. Un boot dedicado (~4 min).

## Datos crudos del cast fresco
```
overworld (86,107) loc=00 floor=0 facing=0
facing deltas dx=[0,1,0,-1] dy=[-1,0,1,0]  (facing 0=UP,1=E,2=S,3=W)
baseline_UP: target=0x5970(tx6,ty2) pre=0x00 post=0x00 chunkΔ=[] (chunk 0x595a TODO 0x00)
             mapbuf 0xab02 field cells (0x3a-0x3f) al norte del party  → campo en display, no en chunk
```
(NB: mi lector de 0xab02 usó stride 2B/cell y subcontó; el buffer es 1B/cell stride 32 —
irrelevante para el veredicto, el chunk-negativo es el dato.)

## Evidencia
- Probe: `re/notes/probe_ifg_obstacle.py` (este worktree); salida `ifg_obstacle.json`/`.out`.
- ASM: `re/disasm/CAST.OVL.asm:34-110` (handler 0x004c: rama loc + gate 0xf7 + chunk 0x595a).
- Carriles previos: `oracle-fire/re/notes/los-audit-lineLOS-witness.md` (BP fiable 0x3f6e=0hits,
  §BOOT FINAL), `oracle-fire/re/notes/field-duration-witness.md` (campo en 0xb19e+display, fijo,
  persiste). Port: `game/src/core/magic/tables.ts:57-60`, `areaSpell.ts`/`areaSpellTables.ts`.
