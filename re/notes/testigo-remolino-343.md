# TESTIGO EMPÍRICO del bloqueo mudo del remolino — la derivación de #282, careada en el binario VIVO

Ficha #343 (testigo de oráculo para #282, pedido por el usuario). La derivación de
LECTURA de [remolino-282-acta.md](remolino-282-acta.md) — fuerte pero sin testigo —
queda aquí CAREADA end-to-end contra ULTIMA.EXE corriendo en dosbox-x headless.
Instrumento: `re/tools/whirlpool_witness_probe.py` (corrida 20-08, log íntegro en el
carril; capturas EGA en `re/tools/logs/whirlpool-343-*.png`, gitignored — material EA).

## 0. Escenario (SAVED.GAM fabricado, cargado por el loader del propio juego)

Party a bordo de FRAGATA (t=0x25 en la corrida definitiva: arriada y encarada
al Este — la taxonomía del §2 explica por qué) en (8,8) del sobremundo — agua
profunda tile 0x01
verificada en las tres casillas (8..10,8) contra `game/assets/maps/overworld.json` —
con el REMOLINO (0xEC) adyacente al ESTE en (9,8), slots 2..31 limpios, hull 0x63.
`g_sail_dir=0` no se fabrica: lo escribe el init del sobremundo al cargar
(MAINOUT 0x0014) ⇒ vela AMARRADA, la condición de la rama muda (0x02C0 `je 0x312`).
El estado inicial LEÍDO en vivo confirmó el escenario completo, incluido que el
mover del binario ADOPTÓ al remolino sembrado (avanzó su frame +1→0xED y escribió
su byte de estado +6=0x10 antes del primer turno).

## 1. Instrumento, con sus dos controles positivos

BPs de código clasificados por CS:IP en cada pausa (red BPINT 8/16 para no
reanudar jamás sin pausa garantizada):

| BP | sitio | qué acredita |
|---|---|---|
| `printpath` | MAINOUT 0x0322 | la ENTRADA del camino Blocked!+beep — el camino que el `je 0x34A` de 0x0320 esquiva |
| `epilog` | MAINOUT 0x034A | el epílogo de `ship_try_move`; en la pausa se lee `[bp-2]` = valor devuelto |
| `whirl` | MAINOUT 0x127F | el turno del remolino (push DS 0x6B04 = "\nWHIRLPOOL!\n") |

Controles positivos DEL MISMO instrumento, en la MISMA sesión:
- `printpath` DEBE saltar en la fase B (a pie, t=0x1C medido del save del usuario,
  sin actor: el agua bloquea y a pie se cae por `jb 0x322` al Blocked! con beep);
- `whirl` DEBE saltar en la fase C (la reubicación observada).

## 2. Hallazgo previo que las corridas obligaron a derivar: la taxonomía de velas

El plan ingenuo («t=0x20 y empuja») midió DOS conductas que no eran la de la
ficha, y las dos son testigos válidos de otras ramas del acta de #282:

- **Corrida 1 (t=0x20)**: la primera pulsación de dirección NO intenta el paso —
  para tile de fragata con `(t&0xFC)==0x20` (velas IZADAS), `outdoor_move`
  0x049F-0x04AC compara `g_sail_dir` con la dirección y si difiere LO ESCRIBE y
  consume el beat (imprime «Head East», t 0x20→0x21). `ship_try_move` ni corre.
- **Corrida 2 (t=0x21, ya orientada)**: el empuje SÍ corre `ship_try_move`
  (epílogo 0x034A observado) — pero con `g_sail_dir` ya escrito por la corrida
  del heading, 0x02C0 NO salta a la cola muda: cae por 0x02C7 = **«COLLISION!» +
  `damage_ship`** (hull 99→86, rand(1,30)=13). **La nave NO avanza y el remolino
  NO se dispara**: (8,8) intacto, actor intacto. Es el testigo empírico de la
  rama NAVEGANDO del §3 del acta — ni bajo vela se puede entrar en la casilla
  del remolino.

⇒ La rama MUDA exige `g_sail_dir==0` con vehículo, y eso es la fragata con
velas **ARRIADAS** (tiles 0x24-0x27, la misma clase «fragata amarrada» del
censo de #273): la puerta de 0x0496 no le escribe el heading y el intento de
paso es el REMO. El remo imprime su propio rótulo de entrada («Rowing!»,
ship_try_move 0x020E push DS 0x2982, clase `(t&0xFC)==0x24`) — que el port ya
modela — así que la letra (b) de la ficha significa exactamente lo que el
`je 0x34A` esquiva: **ni «Blocked!» ni beep del BLOQUEO**, no «pantalla sin
ningún texto».

Y un tercer regalo de la corrida 2: ~~**t=0x1C es la ALFOMBRA y sobre el agua
VUELA** (la party cruzó a (9,8) al empujar con t=0x1C sin actor delante)~~ — es
el t exacto del gate 0x1260 del turno del remolino (contacto = solo daño de
barco, sin teleport~~: volando no te traga~~).

> 🔴 **Tachado por el carril etiqueta-0x1C (20-08,
> [etiqueta-0x1c-acta.md](etiqueta-0x1c-acta.md)): t=0x1C NO es la alfombra — es
> A PIE.** La alfombra montada es 0x14/0x15 SIEMPRE (board CMDS 0x0890, use-carpet
> CAST 0x189E, face MAINOUT 0x013D/0x014A) y vuela sobre el agua por su CLASE en el
> kernel (0x2C4C: idx5→clase 2, handler 0x2C80 pasa `terreno<4`); 0x1C es clase 0 =
> bitmap puro, que BLOQUEA el agua — como este mismo testigo midió en las corridas
> 1/3 (fase B inmóvil sobre roca) y declara en su §1. El «cruce» de la corrida 2 no
> es reproducible (réplica en vivo del carril, mismo escenario: 3/3 beats Blocked!
> con el BP 0x0322 de ESTE testigo disparado y party inmóvil; y la alfombra t=0x14
> cruza la misma agua conservando 0x14) ni auditable (la
> versión del probe que corrió no se committeó); la lectura del gate 0x1260 es
> «A PIE no te traga», no «volando no te traga».

## 3. Lo medido — las tres letras de la ficha (corrida 4, 20-08 09:24-09:45, TESTIGO COMPLETO)

Escenario: fragata ARRIADA y ya encarada al Este (t=0x25), remolino en (9,8).
La pulsación RIGHT ejercita el REMO directamente (sin giro-primero).

**(a) No entra ni teletransporta en ese beat.** El beat del empuje capturó
`cola_vehiculo` (0x0319: la cola de bloqueo, rama vehículo, ANTES del check
0xEC) y `epilog` (0x034A/D): `ship_try_move` corrió y tomó el camino de
bloqueo. Al cerrar el beat: party (8,8) INTACTA, floor 0, hull 99 INTACTO,
remolino vivo en (9,8) (slot1 `ecef0908…`, sólo su frame avanzado). La nave
no entró, nada se teletransportó, nada costó casco.

**(b) Mudo.** En ese mismo beat el BP 0x0322 (la entrada del camino
Blocked!+beep) NO disparó, y la captura del panel muestra exactamente
`>East` + `Rowing!` — el eco de dirección y el rótulo del remo, que el
binario imprime SIEMPRE al remar (ship_try_move 0x020E) y el port también —
y NI RASTRO de «Blocked!» (`run4-whirlpool-343-tras-empuje.png`). Control
positivo en la MISMA sesión (fase B): t=0x1C contra el mismo remolino
(rama actor, t<0x20) → 0x0322 DISPARÓ y «Blocked!» en pantalla
(`run4-whirlpool-343-control-blocked.png`). El instrumento ve el camino
ruidoso cuando se ejecuta; en el empuje del vehículo no se ejecutó.

**(c) El remolino habla y reubica en SU turno.** Un pase de turno después:
BP 0x127F disparado, y el estado: `g_floor=0xFF`, party=(34,18) — los
literales de 0x12B2-0x12C0 —, hull 99→75 (`damage_ship` 0x12AF), actor
borrado (+0/+1 a cero, 0x1277/0x127B), «WHIRLPOOL!» y el mar del Underworld
en pantalla (`run4-whirlpool-343-final.png`). Tercera reubicación medida de
la campaña (corridas 1, 2-faseC y 4), byte-idéntica las tres veces.

Veredicto del probe (JSON `whirl343-run4.json`): las cinco condiciones
verdes — `a_no_avanza` · `b_mudo` · `b_control_positivo` ·
`c_whirlpool_reubica` · `c_damage_ship` — `RESULTADO: TESTIGO COMPLETO ✓`.

### Letra (c), ya sellada DOS veces (corridas 1 y 2, mecanismos de arranque distintos)

En el turno del remolino adyacente (ON-turn), con la party a bordo de fragata:
BP 0x127F disparado (push DS 0x6B04 = "\nWHIRLPOOL!\n"), y el estado final
en las dos corridas: `g_floor=0xFF`, party=(0x22,0x12)=(34,18) — los literales
de 0x12B2-0x12C0 —, hull con el `damage_ship` de 0x12AF aplicado (99→75 y
86→61), y el actor BORRADO de la tabla (bytes +0/+1 a cero, 0x1277/0x127B).
Captura: «WHIRLPOOL!» en el panel y la nave ya en el mar del Underworld
(`run1-whirlpool-343-tras-empuje.png`, `run2-whirlpool-343-final.png`).

### Control positivo del instrumento (corrida 1, fase B)

Con t<0x20 y paso bloqueado por terreno (roca del Underworld), el BP 0x0322
(camino print+beep) DISPARÓ y la pantalla muestra «Blocked!»
(`run1-whirlpool-343-control-blocked.png`): el instrumento VE el camino
ruidoso cuando se ejecuta. Caveat medido del canal: el pty pierde pausas
(~50% con la build lenta 2026.08.02) ⇒ los conteos de BP se leen como
«al menos N», nunca como censo exacto; la ausencia se adjudica con la
CAPTURA, el estado y el control positivo juntos.

## 4. Qué valida esto del port

- `shipTryMove` outcome `blocked-silent` (game/src/core/world/transport.ts) — la
  consulta del actor DELANTE del atajo de passability — es la conducta del binario
  medida, no sólo leída.
- El recuerdo del usuario («el remolino lleva al Underworld») es CORRECTO y el fix
  de #282 no lo rompe: lo que #282 quitó es la INVENCIÓN del port de tragarte al
  instante con la tecla del jugador; el viaje al Underworld lo hace el remolino en
  SU turno, exactamente como aquí se ve.
