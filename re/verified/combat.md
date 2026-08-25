# Verificado: combate — COMBAT.OVL + COMSUBS.OVL (Task 3.2)

Reglas re-derivadas del asm con citas instrucción a instrucción
(re/notes/combat.md) y portadas al clon con tests. El arnés de paridad
runtime (re/tools/combat_parity.py + combat-run.ts) entra en un combate
REAL (rata inyectada + Attack en el overworld), captura registros/roster/
arena/semilla y compara la reproducción del clon tirada a tirada.

## Estado de la verificación runtime (2026-07-10)

VERDE: `test_combat_trace_parity_live` (re/tools/test_combat_parity.py) —
`1 passed in 635.20s (0:10:35)`, commit 86d754e. Detalle del run y de los
dos fixes de captura que lo destaparon: `.superpowers/sdd/
task-3.2-movement-report.md` y `.superpowers/sdd/
task-3.2-parity-debug-report.md`; mecánica completa en re/notes/combat.md
§15.

Mecánica del arnés verde:
- `seed_melee_positions` coloca a los enemigos ya ADYACENTES a un jugador
  (celda de melé exclusiva, Chebyshev ≤ 1 = distancia 1, §10) e infla la
  HP de todos los jugadores vivos a 9999: nadie se mueve ni muere durante
  la traza.
- `patch_anim_rand` (kernel 0x4625/0x466D/0x469F) + `patch_sprite_rand`
  (kernel 0x2F62, `ret` en la entrada) silencian los consumidores
  COSMÉTICOS del stream de rand (animación de sprites y randomizador de
  frame), que en corridas previas ahogaban el presupuesto de resumes o
  contaminaban la traza.
- `compare_subseq` verifica cada tirada CAPTURADA por semilla exacta +
  rango + HP del party + HP/posición de TODOS los enemigos, exigiendo
  avance monótono en la órbita del clon (tolera huecos de captura del pty
  sin debilitar la comparación).

VERIFICADO EN VIVO contra el binario con este arnés:
- La entrada en combate y el LAYOUT COMPLETO de los registros de
  combatiente (DS:0xBA14: hp/vel/flags/slot-tipo/obj/countdown/x/y) y de
  la tabla de objetos (DS:0x5C5A).
- La INICIATIVA: countdown = 36 − velocidad (los counters leídos en vivo
  cuadran con las velocidades); velocidad del PJ = DEX del roster (24/22/
  21 observados); velocidad del enemigo = dex ± rand0(7)−4 con fallback
  (ratas dex 20 → velocidades 17..23 observadas, nunca > 30).
- El ORDEN de actuación: el clon y el binario coinciden en qué combatiente
  actúa primero desde el snapshot (mismo barrido de slots).
- ACIERTO + DAÑO/DEFENSA + VENENO y la TRAYECTORIA DE HP resultante,
  tirada a tirada, calcados contra el binario (14 tiradas capturadas,
  0 no-modeladas, semilla 47532; re/parity/combat/last-trace.json).

EXCLUIDO de esta verificación runtime (divergencia de alcance
DELIBERADA, no laguna de modelado): el MOVIMIENTO de la IA
(COMBAT:0x0EE4). El canal pty no captura su stream de rand con
fiabilidad — de ~12 tiradas de eje emitidas por un enjambre moviéndose,
solo ~1 se lee con el caller correcto (0xB261); el resto sale como
lectura de pila desalineada y se descarta. Con la mayoría de las tiradas
de movimiento perdidas, la traza no puede registrar la secuencia
completa y el clon —que la modela entera— nunca alinea. Por eso
`seed_melee_positions` siembra a los enemigos ya en melé: nadie se mueve,
así que no hay tiradas de movimiento en ningún lado y la comparación
aísla exactamente lo que SÍ se captura con fiabilidad. La FÓRMULA del
movimiento sigue asm-derivada con cita (§8.2/§13 de re/notes/combat.md)
pero SIN paridad runtime; se verificará por otra vía. Detalle completo
en re/notes/combat.md §15.

## ✅(asm) Fórmula de ACIERTO (cierra la duda de FIDELITY)

`ACIERTA ⇔ rand30() >= (statDefensor − statAtacante + 30)/2`

- rand30 = kernel 0x3ABE = `max(1, rand_range(0,60) >> 1)` ∈ 1..30.
- statDefensor = DEX efectiva del DEFENSOR (1 si duerme/Mimic/Time-stop).
- statAtacante = DEX, o STR con armas contundentes
  (`spellAttackRange[w−1]==8`) o enemigos "bludgeons" (flag LE 0x80);
  INT vs INT en hechizos.
- Asm: COMBAT:0x14D6 (154d-1566) + 0x13E2 + 0x139A; kernel 0x3ABE.
- Ni Redux (solo dex del defensor) ni xu4 (solo la del atacante): usa
  AMBAS. Con stats iguales ≈ 53 %; ±30 puntos = imposible/seguro.

## ✅(asm) Fórmula de DAÑO

- Jugador: `rand(1, ATTACK_VALUES[arma])` (fijo si ≤1 o 99); manos
  desnudas = 1; glass sword = 99 + shatter (ignora armadura);
  jeweled sword = 0. Enemigo: stat damage FIJO (sin tirada).
- Defensa: `− rand(1, defensa)` (enemigo: stat armour; jugador: cache
  roster+0x18). dmg < 1 ⇒ "grazed". La STR no interviene en el daño.
- Asm: COMBAT:0x12B0 completo.

## ✅(asm+runtime) INICIATIVA

- Countdown por combatiente: actúa al llegar a 0 y recarga
  `36 − velocidad` (byte); barrido de slots 0..31 en orden (empate =
  slot más bajo; party primero). Velocidad: DEX del PJ; enemigo
  `dex + rand0(7) − 4` al spawn (si el byte queda > 30, la dex tal cual).
- 1 minuto de juego por cada 10 acciones de combate.
- Asm: COMBAT:0x0B94 (0c43-0c76) + kernel 0x6506 (65a0-65f6).

## ✅(asm) Turno de la IA (orden y tiradas)

Especiales → ataque → movimiento; objetivo = rival más cercano por
distancia euclídea entera; ataque a distancia con 50 % de no disparar;
veneno 3/4 en vez de daño ('G'→'P' sin daño); movimiento con eje
preferido `rand0(255) > 0x7F`, deslizamiento y 4 direcciones aleatorias.
Asm: COMBAT:0x03F4/0x0226/0x014E/0x0D30/0x0EE4 + 0x18BA.

## ⚠️→formulado (asm-derivado, paridad runtime pendiente)

PORTADAS al clon con tests unitarios, pero NO ejercitadas por el
escenario runtime (requieren enemigos/armas específicos):
XP = maxHP/4+1 SOLO al PJ del golpe mortal (cap 9999, aplicada al roster
en el momento del golpe); triple golpe casco/mano/mano; glass sword
(mágica: sin mitad de no-muerto, g_5890 con arma ≥ 0x23); robo de comida
3/4×5; gates in a daemon 1/8; poseer (INT contest, con fall-through del
slot inválido al siguiente especial y resistencia SILENCIOSA que sí
consume el turno; el Daemon se retira tras poseer); invisibilidad 1/8
(fall-through al check del daemon si falla la tirada); división al
sobrevivir; teleport; cofre/trampa `rand30 vs treasure` (sin tiradas si
el tile de suelo bajo el cadáver es agua: 0x87 o < 4); heridas por
cuartos (la escalada del nivel 2 mantiene "heavily wounded!" y solo
activa la huida) y +1 HP 1/4 al huir; interferencia de disparo; fuego
amigo del proyectil fallado; dormir/despertar (1/17 enemigo,
<0x10/255 PJ).

DERIVADAS del asm con cita pero PORT PENDIENTE (no están en el clon):
- Munición: decremento de flechas/virotes/arrojadizas y desequipado al
  agotarse (COMSUBS:0x097C) → con SJOG/inventario de combate, Task 3.3.
- Amuleto (roster+0x1E==0x2D) / Negate: 50 % de anular el proyectil
  mágico (COMBAT:0x0226 029c-02dc) y bloqueo de especiales bajo 'N'
  → con el estado de hechizos activos, Task 3.3.
- Campos 0xE8-0xEB (disipación 1/16, COMSUBS:0x0056) y daño de terreno
  al cierre del turno (lava/pantano/campos, COMBAT:0x1B1E) → con los
  hechizos que siembran campos (Task 3.3) y la integración de tiles
  reales del mapa de combate.
- Triggers del .CBT (COMBAT:0x111A) → salas de mazmorra, Task 3.4.
- Saduj (kernel 0x5646: `name[4]=='j'` lucha contra el party) → cuando
  los NPCs que se unen al party entren al motor (Task 3.5).
- Gargoyle (tipo 0x1E) al morir: la celda del mapa de combate pasa a tile
  0x4C (SIN cofre, aunque el loot_rating aplicara) — COMBAT:16f8-170f;
  re/notes/combat.md:219.

## Fuera de estos overlays (siguen ⚠️ en FIDELITY)

- Probabilidad de encuentro overworld: vive en el turno del mundo de
  MAINOUT (Task 3.7/3.9), no en COMBAT/COMSUBS.
- Umbral de subida de nivel y HP por nivel: OUTSUBS:0x658 (camp) y
  Lord British (Task 3.9); aquí solo se cierra la GANANCIA de XP.

## Resultado de los runs de paridad

**Run vigente (verde, 2026-07-10)**: `test_combat_trace_parity_live`,
`1 passed in 635.20s`. Escenario de melé sembrado (ver arriba): 14
tiradas capturadas, 0 no-modeladas, semilla 47532, comparación por
subsecuencia SIN diffs (acierto+daño+veneno+HP). Capture regenerado en
re/parity/combat/last-trace.json.

**Runs previos (2026-07-09/10, evolución histórica)**: antes de sembrar
el melé y silenciar el sprite-rand cosmético (kernel 0x2F62), los
enemigos spawneaban lejos del party y debían moverse para alcanzar
combate cuerpo a cuerpo. Un run con rata inyectada (6 enemigos) capturó
110 tiradas con estado por tirada: coincidían primer actor, primer roll
y aritmética de valores, pero divergía en cuanto el movimiento de la IA
entraba en juego (sus tiradas no whitelisteadas contaminaban/desalineaban
el stream frente al clon, que sí las modela). Ese run quedó superado por
el diseño de melé-sembrado, que elimina el movimiento del escenario en
vez de intentar capturarlo por pty.
