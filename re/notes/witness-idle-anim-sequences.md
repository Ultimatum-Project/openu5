# Testigo EN VIVO — secuencias de animación de REPOSO de los actores de pueblo (`0x4552`)

Captura del oráculo (2026-07-19) que cierra el hueco DIFERIDO en
`sprite-anim-cadence.md §4` y la pregunta abierta de `tile-anim-census.md §2`
(«la SECUENCIA real de tile-ids por familia, pendiente de oráculo en vivo»).
Bloquea el fix del bug «NPCs congelados en idle».

Método: muestreo RAM periódico (~1 muestra/tick INT8) de la tabla de actores
`0x5c5a` (32 slots × 8 B) + lectura EN VIVO de la infraestructura de bytecode
(`0x1bc8` mapa, `0x1b18` programas). NO se usa el mapa estático de DATA.OVL
(corrupto, `tile-anim-census §2`): todo es ground-truth leído de la RAM que
CORRE. Script: `/private/tmp/<oracle-rundir>-anim/capture_idle.py`
(sha256 7dc15c75…). Salida: `capture_idle.out` (sha256 a1323e44…).
Boot: SAVED.GAM de referencia, `g_location=0 g_floor=0 g_hour=23`.

## 0. TL;DR — VEREDICTO

1. **SÍ animan en reposo.** Los sprites de persona/criatura del banco alto
   (0x1xx) SÍ se animan por `0x4552` estando el jugador quieto (0 teclas),
   contra lo que afirmaba `sprite-anim-cadence.md §1`. La tabla de actores
   `0x5c5a` guarda el **TYPE = byte bajo** del sprite (guard 0x170→`0x70`,
   merchant 0x154→`0x54`), y el intérprete opera en ese espacio de byte bajo:
   `base=[reg+0]&0xfc`, frame mostrado `[reg+1]=base+op−1` (byte bajo; el
   compositor re-suma 0x100). Por eso el animador SÍ alcanza el banco alto.
   Evidencia: Fighter 129, TownsPerson 134, Merchant 118 transiciones de frame
   en 200 ticks SIN input; controles 0x1c/0x1e = 0 transiciones (centinelas de
   salto). Refuta la premisa «el valor mostrado nunca llega a 0x100».

2. **El Avatar (party-leader) está congelado porque NO está en `0x5c5a`.** Su
   tile 0x4c SÍ tiene programa (progid 0): al SEMBRARLO en la tabla, anima
   idéntico al Fighter. El líder aparece congelado (testigo AV, `sprite-anim
   §2`) sólo porque se pinta aparte (centro del viewport), no como actor del
   animador. ⇒ El fix debe congelar el LÍDER pero animar los NPC de la tabla.

3. **Sólo hay DOS programas para las 5 familias pedidas** (leídos en vivo):
   - **progid 0 = `02 03 04 05`** → Fighter (0x48), Avatar (0x4c),
     TownsPerson (0x50), Merchant (0x54). Ciclo de 4 frames SIN delays.
   - **progid 5 = `02 84 03 84 04 84 05`** → Guard (0x70). Ciclo de 4 frames
     con **delay 4** entre cada uno (marcha lenta).

4. **CORRIGE `tile-anim-census §2`: progid 0 NO es «estático/fantasma».** En la
   RAM viva progid 0 = `02 03 04 05` y es el programa MÁS usado (todas las
   personas básicas). El desfase de la nota era off-by-one: **la `pN` de la
   nota = progid vivo `N−1`** (nota p1=`02 03 04 05`=progid0; nota p6=`02 84 03
   84 04 84 05`=progid5).

## 1. Programas resueltos EN VIVO (mapa `0x1bc8` → progid → `0x1b18`)

| familia | tile base | idx `(base−0x34)>>2` | progid vivo | programa (16 B) |
|---|---|---|---|---|
| Fighter (0x148) | 0x48 | 5 | **0** | `02 03 04 05` 00… |
| Avatar (0x14c) | 0x4c | 6 | **0** | `02 03 04 05` 00… |
| TownsPerson (0x150) | 0x50 | 7 | **0** | `02 03 04 05` 00… |
| Merchant (0x154) | 0x54 | 8 | **0** | `02 03 04 05` 00… |
| Guard (0x170) | 0x70 | 15 | **5** | `02 84 03 84 04 84 05` 00… |

Mapa vivo `DS:0x1bc8[0..0x3f]` (íntegro, para futuras familias):
```
00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 05 00 00 00 00 00 00 09 00
01 06 01 01 00 04 00 03 00 0a 00 01 00 01 00 01 00 01 07 00 07 00 00 02
08 00 00 00 31 09 34 09 38 09 3d 09 41 09 44 09
```

## 2. Semántica de cada programa (calco de `0x4552`/`0x46c2`, ya en `tileprog.ts`)

Recordatorio del motor (verificado en el disasm y confirmado por la captura):
por llamada, si `timer!=0` → `timer--` (espera, sin gate); si `timer==0` →
GATE RNG 50 % (salvo base∈{0x5c,0xa8}) → si pasa, ejecuta opcodes hasta un
frame/delay. `op 1–4`=frame `base+op−1`; `op>7`=delay `op−0x80`; `op0`=PC=0;
`op5`=RNG(≥0x40 75 %→PC++/sigue; si no frame=`base`+timer 6); `op6`=RNG.

**progid 0 `02 03 04 05` (Fighter/Towns/Merchant/Avatar-tile):**
- PC0 op2→frame **base+1**; PC1 op3→**base+2**; PC2 op4→**base+3**;
  PC3 op5→ **75 %**: reinicia (→base+1, se SALTA base+0); **25 %**: frame=**base+0**,
  timer=6 (descanso de ~6 ticks en el frame 0), reevalúa op5.
- ⇒ En reposo cicla **frames 1·2·3** (p.ej. Fighter 0x149·4a·4b) y sólo muestra
  el **frame 0** (0x148) durante el descanso 25 %. Confirmado byte a byte:
  `t9:49 t11:4a t13:4b t16:49…` y descansos `t0-6:48 pt36→30`.

**progid 5 `02 84 03 84 04 84 05` (Guard):**
- frame **base+1**→delay4→**base+2**→delay4→**base+3**→delay4→op5(75 % reinicia /
  25 % frame=**base+0**+timer6). Marcha lenta y deliberada.
- Confirmado (sembrado): `t2:71 t9:72 t15:73 t23:70(descanso)… t32:71…`.

## 3. Cadencia (medida) + caveat de rate absoluto

- **Paso base:** el timer `[reg+6]&0xf` decrementa **1 por tick INT8 (~55 ms)**
  (medido: `pt36→35→34…` uno por `run_ticks(1)`) ⇒ ~1 llamada del animador/tick
  en el harness headless.
- **Familias sin delay (progid 0):** gate 50 % ⇒ ~2 llamadas/frame ≈ **~110 ms/
  frame**; vuelta de 3 frames ≈ ~330 ms; descanso 25 % ≈ ~6 ticks (~330 ms) en
  el frame 0. Irregular (RNG), no periódico.
- **Guard (progid 5):** delay 4 domina ⇒ ~5–6 ticks/frame ≈ **~300 ms/frame**.
- **CAVEAT:** los ms asumen 1 llamada = 1 tick base (así corre el harness). En
  juego real la tasa la fija cuántas veces el refresco de vista invoca `0x4552`
  en reposo; el reloj de anim del port (~110 ms, divisor 2, `tile-anim-census
  §0`) es el ritmo correcto. Lo GROUND-TRUTH es la ESTRUCTURA relativa (gate
  50 %, ramas op5, delays), no el número absoluto. Concuerda con el AV
  (`sprite-anim §2`: merchant «lento e irregular», Avatar congelado).

## 4. LISTO PARA HORNEAR en `render/tileprog.ts`

El intérprete (`tickProg`) ya calca `0x4552` exacto. Sólo faltan los datos:

```ts
// PROGRAM_BY_BASE — añadir (progids vivos, oráculo 2026-07-19):
[0x48, [0x02, 0x03, 0x04, 0x05]], // Fighter   (progid 0)
[0x4c, [0x02, 0x03, 0x04, 0x05]], // Avatar    (progid 0)
[0x50, [0x02, 0x03, 0x04, 0x05]], // TownsPerson(progid 0)
[0x54, [0x02, 0x03, 0x04, 0x05]], // Merchant  (progid 0)
[0x70, [0x02, 0x84, 0x03, 0x84, 0x04, 0x84, 0x05]], // Guard (progid 5)

// ENABLED_PROGRAM_BASES: new Set([0x48, 0x4c, 0x50, 0x54, 0x70])
```

**AVISOS para el carril del fix (no son datos de captura, son de integración):**
- Aplica el intérprete **por-ACTOR** (como el original), NO por-celda de
  viewport en bloque. El `TileProgRunner` actual es por-celda de TERRENO; los
  actores de banco alto se pintan por el camino de `paintActors`/NPC, ahí es
  donde debe correr un `ProgState` por-actor.
- **NO animar el party-leader** (queda congelado como en el original; no está
  en `0x5c5a`). Enchufar base 0x4c a ciegas en el runner de terreno animaría el
  líder por error.
- Esto SUSTITUYE el modelo per-turn de `sprite-anim-cadence §3` **para los NPC**
  (que los congelaba en reposo); el per-turn seguía siendo correcto sólo para
  el líder. El idle continuo por bytecode es lo fiel para los NPC de la tabla.
- Estas mismas bases (0x48/0x54/0x70…) son también tiles de TERRENO en el banco
  bajo; el runner por-celda de terreno NO debe habilitarlas (morfearía terreno).
  Por eso el gating debe ser «actor del banco alto», no «tile con esa base».

## 4bis. BONUS — familias de MONSTRUO/criatura (0x180–0x1fc), captura en vivo

Segunda captura (`capture_monsters.py` sha256 5f5e3789…; salida
`capture_monsters.out` sha256 f61759c2…), mismo método: progid resuelto en
vivo para las 30 familias de monstruo + secuencia sembrada de 10
representantes (una por programa distinto). **10 programas distintos** cubren
todos los monstruos:

| progid | programa (16 B, trim) | familias (base) |
|---|---|---|
| **0** | `02 03 04 05` | Seahorse 80, Squid 84, SeaSerpent 88, Rat 90, Gremlin a4, Reaper ac, InsectSwarm bc, Skeleton c4, Ettin cc, Wisp d4, SandTrap e0, Whirlpool ec, RotWork f8, ShadowLord fc |
| **1** | `01 02 03 04` | Bat 94, Ghost 9c, Slime a0, Orc c0, Snake c8, Headless d0, Daemon d8 |
| **2** | `01 02 03 04 03 04 01 02` (ping-pong) | MongBat f0 |
| **3** | `01 02 03 04 87` (4 frames + delay 7 en el frame 3) | Gazer b0 |
| **4** | `01 8f 02 03 04` (frame0 + **HALT**) | Mimic a8 (**UNGATED**) |
| **6** | `01 02 01 02 03 04 02 03 04` | Spider 98 |
| **7** | `02 03 04 03 02 05` (ping-pong + op5) | Dragon dc, Troll e4 |
| **8** | `01 8f 02 03 04 07` (frame0 + **HALT**) | Corpser f4 |
| **9** | `02 82 03 82 04 82 06 01` (delays 2 + op6) | Shark 8c |
| **0x0a** | `01 02 03 05` (3 frames + op5) | StoneGargoyle b8 |

**HALLAZGO 1 — `op 0x8f` = HALT permanente (NO «delay 15»).** `delay = op−0x80`;
para `0x8f` da timer `0x0f`, que ES el CENTINELA de salto (`0x45b0 cmp
[reg+6]&0xf, 0xf → je siguiente`): el actor se CONGELA para siempre en el
frame actual. Confirmado en vivo: **Mimic y Corpser muestran SÓLO el frame
base+0 y se paran** (2 transiciones en 140 ticks; `t2:a8/pt2f`, `t2:f4/pt2f`).
Es CAMUFLAJE deliberado (el mimic finge un cofre, el corpser una trampa en el
suelo: quietos hasta que te acercas). **CORRIGE `tile-anim-census §2`** que leyó
`01 8f 02 03 04` como «frame0, delay 15, luego 1-2-3»: el 0x8f nunca continúa.
⇒ Mimic (a8) y Corpser (f4) deben renderizarse **ESTÁTICOS** en reposo.

**HALLAZGO 2 — progid 0x0a = `01 02 03 05` es NUEVO** (la lista de `census §2`
paraba en p10=progid9). StoneGargoyle: 3 frames (b8,b9,ba) + op5.

**HALLAZGO 3 — Mimic base 0xa8 es UNGATED** (sin gate RNG 50 %, `0x4617`) —
pero da igual porque el 0x8f lo congela igual.

Los demás animan como las personas (gate 50 % + estructura del programa):
Rat/etc (pg0) = 3 frames + descanso op5; Bat/etc (pg1) = 4-ciclo limpio;
MongBat (pg2) = ping-pong; Gazer (pg3) = 4 frames + retención 7 en el frame 3;
Spider (pg6), Dragon/Troll (pg7), Shark (pg9, delays 2). Secuencias completas
en `capture_monsters.out`.

**Para hornear (monstruos):** mismas 2 reglas de integración del §4 (por-actor,
no por-celda). Añadir `PROGRAM_BY_BASE` para las bases 0x80–0xfc con su progid
de la tabla de arriba, y `ENABLED_PROGRAM_BASES` esas bases — EXCEPTO que el
0x8f (Mimic/Corpser) ya produce el frame-0-congelado por el propio intérprete
(`tickProg` respeta el centinela 0xf), así que no hay caso especial: basta el
programa correcto.

## 4ter. RESIDUAL — familias de PARTY que faltaban: Bard (0x44) + Wizard/Mage (0x40)

Tercera captura (`capture_bard.py` sha256 `2c7f4d77…`; salida `capture_bard.out`
sha256 `f618e60a…`), MISMO método que §4/§4bis: progid resuelto EN VIVO del mapa
`0x1bc8` de la RAM que corre + secuencia sembrada de cada familia en un slot libre
de `0x5c5a` durante 200 ticks de reposo. Cierra el ÚLTIMO residual del cableo de
animaciones (las 2 familias de party que quedaron congeladas por no fabricar).

**VEREDICTO: las dos son `progid 0 = 02 03 04 05`, idénticas a Fighter.** No hay
programa nuevo. Leído en vivo (no del mapa estático corrupto):

| familia | tile base | idx `(base−0x34)>>2` | progid vivo | programa (16 B) |
|---|---|---|---|---|
| **Wizard/Mage** (0x140) | 0x40 | 3 | **0** | `02 03 04 05` 00… |
| **Bard** (0x144) | 0x44 | 4 | **0** | `02 03 04 05` 00… |

Secuencia sembrada (confirma la semántica de progid 0 del §2: cicla frames **1·2·3**
y sólo cae al frame **0** en el descanso 25 % con `timer=6` que decrementa 1/tick):
- **Wizard/Mage (base 0x40):** 128 transiciones en 200 ticks. Frames vistos
  0x40·41·42·43. `t2:41 t9:42 t10:43 t11:41…` (vuelta 1·2·3) y descansos
  `t30:40/pt36→…→t36:40/pt30` (frame 0, timer 6→0). Cadencia irregular por el gate
  RNG 50 %, igual que Fighter/Merchant.
- **Bard (base 0x44):** 137 transiciones. Frames 0x44·45·46·47. `t1:45 t2:46 t4:47`
  (1·2·3) y descansos `t5:44/pt36→…→t11:44/pt30`. Idéntico patrón.

Cadencia = la de las demás familias progid 0 (§3): paso base 1/tick INT8, gate 50 %
⇒ ~2 llamadas/frame ≈ ~110 ms/frame, vuelta de 3 frames ≈ ~330 ms, descanso 25 % de
~6 ticks en el frame 0. El reloj de anim del port (~110 ms, divisor 2) es el correcto.

**PARA HORNEAR — 2 líneas en `render/tileprog.ts`** (tablas `ACTOR_PROGRAM_BY_BASE`
línea 219 y `ENABLED_ACTOR_BASES` línea 228; NO las de terreno `PROGRAM_BY_BASE`):
```ts
// ACTOR_PROGRAM_BY_BASE — añadir junto a las otras party (progids vivos, oráculo 2026-07-19):
[0x40, [0x02, 0x03, 0x04, 0x05]], // Wizard/Mage (progid vivo 0)
[0x44, [0x02, 0x03, 0x04, 0x05]], // Bard       (progid vivo 0)

// ENABLED_ACTOR_BASES: añadir 0x40, 0x44 →
//   new Set([0x40, 0x44, 0x48, 0x4c, 0x50, 0x54, 0x70])
```
Aplican las MISMAS 2 reglas de integración del §4: por-ACTOR (no por-celda de
terreno; estos bytes bajos son también terreno del banco bajo) y el gating es
«actor de banco alto». No requieren caso especial: basta el programa correcto.

## 5. Provenance / cierre
- dosbox muerto, run-dir limpio, sin tocar el DOSBox del usuario ni `original/`.
- Captura §4/§4bis: `capture_idle.out` sha256 `a1323e44e8ac7aa7f3740072bafcbffde5eff4c75ca3e118bf98e93a70c7917b`.
- Captura §4ter: `capture_bard.py` sha256 `2c7f4d7701dac3be32a192cceb2ea8862ae7b8117b2633f194c4a6d17d9d6af8`,
  salida `capture_bard.out` sha256 `f618e60a7635b7132cc253e5db15e40eeb3bba1841a70b85a1bbde58d81c72f4`.
- Familias pedidas por el encargo TODAS cubiertas: Guard 0x170, Fighter 0x148,
  Merchant 0x154, TownsPerson 0x150, Avatar 0x14c (control) + residual §4ter
  Wizard/Mage 0x140 y Bard 0x144. Progids resueltos en vivo + secuencia de
  `[reg+1]` durante 200 ticks de reposo por familia.

## §4quater — Barrido COMPLETO de personas de pueblo (oracle-3, 2026-07-20, banca del lead)

Captura viva (persons.log, probe con siembra en 0x5c5a + progid del mapa 0x1bc8 en RAM,
200 ticks de reposo; controles Fighter/Merchant pid0 y Guard pid5 verificados):

**Las 9 familias restantes = progid 0 (`02 03 04 05`), idénticas a Fighter:**
Jester 0x58 · BardPlaying 0x5c · PersonStocks 0x60 · WallPrisoner 0x64 · Child 0x68 ·
Begger 0x6c · Apparation 0x74 · Blackthorn 0x78 · LordBritish 0x7c.
(110-199 transiciones/200 ticks cada una; ciclo 1·2·3 + descanso 25% en frame 0 con
timer 6 — el patrón progid-0 estándar. Testigo AV del juglar:
av-referencia/capturas-2026-07-19/juglar-castillo-anim.mov.)

Cableo: añadir las 9 bases a la entrada progid-0 de ACTOR_PROGRAMS (tileprog.ts) —
con esto el banco de PERSONAS queda COMPLETO (0x40-0x7f todas capturadas o HALT).

**(d) ESC-flee 0xffffdafe: INCONCLUSO** (esc.log: el probe no capturó el movimiento de
huida — trayectoria estática; el observable del testigo del usuario, «Escape!»+salida,
ya está cableado; el borde exacto sigue ⚠ Clase-C con esta vía anotada).
