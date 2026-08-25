# Resolución estática del bloqueo #8 — tile-vs-defIndex + vía de combate + arena + intro

**Contexto.** La review `.superpowers/sdd/port-t8-review.md` BLOQUEÓ ⚖️3/⚖️4: sospechó
que el byte de `AMBUSH_TABLE` (tabla DS 0x1734) NO es un `defIndex` sino "otra cosa"
porque `0x6BC2` resultó ser `render_animated_tile` (no "combat-init"), y que la arena
`CampFire` + `suppressIntro` eran invenciones sin cita. **Esta nota resuelve los 4
puntos SIN runtime** (dosbox ocupado), con el disasm crudo del kernel. Veredicto de
cabecera: **el CÓDIGO del port es correcto; lo defectuoso son 3 comentarios con nombres
equivocados y un puñado de justificaciones que sobre-afirman "derivación".** Todo se
arregla sin tocar la lógica.

Insumos leídos: `re/disasm/ULTIMA.EXE.asm` (0x6bc2 `render_animated_tile`, 0x6506
`kernel_spawn_actor`), `re/notes/kernel-sweep-2.md §6`, `game/src/core/combat/enemies.ts`
+ `world/enemies.ts` + `game.ts` (startCombat/startCampAmbush/spawnTrollCombat),
`game/src/core/combat/encounters.ts` (combatMapForTile/CombatMapIndex),
`game/src/core/data/TileData.json`, `game/assets/data.json` (monsterNamesUpper/Mixed),
`docs/formats/maps.md`, `re/deliberate-divergences.md:565/580/1075`.

---

## Punto 1 — ¿El byte es TILE, defIndex, u otra cosa? → **defIndex (índice de tipo de monstruo)**

**Cadena real del flujo (disasm crudo, no la prosa de la spec):**

1. `camp()` rama de emboscada llama `0x6BC2(enemyType=byte, flags)` (spec §2.3; el
   overworld a pie tiene `flags=0x0004` ⇒ `flag&2=0` ⇒ ESTA vía, no la `0x7C3E`).
2. `0x6BC2 = render_animated_tile` (`ULTIMA.EXE.asm:11364+`). Con `[bp+4]=byte`
   (<0x100, no se normaliza), calcula frames y en `0x6ccf-0x6cf4` **llama
   `0x6506 = kernel_spawn_actor`** empujando `push [bp+4]` como PRIMER arg (más `kind=0`,
   dos frames y `g_floor`). Confirmado también por `kernel-sweep-2.md §6`
   ("coloca el sprite `0x6506=kernel_spawn_actor`").
3. `kernel_spawn_actor` (`ULTIMA.EXE.asm:10723+`) recibe ese byte en `[bp+0xc]` y lo usa
   como **índice de TIPO de monstruo**, NO como tile de sprite:
   - `654f: ax=[bp+0xc]<<3; +0x13c1` → puntero a la tabla de sprite/frames por tipo;
     en `65cb-65d0` (rama `kind==0`) escribe `[si+0] = [[bp+0xc]<<3 + 0x13c1]` =
     **el sprite del actor se DERIVA del tipo** (no es el byte crudo).
   - `655b: ax=[bp+0xc]<<5; +0x55b3/+0x55b5` → tabla de stats por tipo (stride 32).
   - `660d: [si+3] = [bp+0xc]` → **guarda el byte como el campo TIPO** del registro de
     actor en `0xba14` (el mismo array de actores del overworld donde viven los
     errantes; `658b: si = di<<3 + 0xba14`).

   ⇒ El byte es un **índice de tipo de monstruo**: entra a tablas por-tipo y se guarda
   como el tipo del actor. **No es un sprite-tile** (el sprite se calcula A PARTIR del
   tipo), **no es el espacio `monsterNamePtrs1866`** que usó la spec.

**Tres pruebas convergentes de que ese "tipo" = `OverworldEnemy.defIndex` del port
(el espacio de 48 de `monsterNamesUpper`/`enemyDefs`):**

- **Rango.** Los 8 bytes `29 14 15 18 16 19 24 14` ∈ **0x14–0x29 (20–41)**. Eso cabe en
  el espacio de ÍNDICE de enemigo (0–47). NO cabe en el espacio de sprite-id de los
  spawns (`SPAWN_TABLES.ids` = 0x80–0xf8, `encounters.ts:149`) ni en el de tile completo
  (0x140–0x1ff). Un tile de sprite de monstruo sería ≥0x140; estos son índices.
- **Consistencia con el peaje de trolls.** `spawnTrollCombat` (`game.ts:763`) es el
  MISMO patrón (enemigo sintético en la casilla de la party → `startCombat`) y usa
  `TROLL_DEF_INDEX = 41 = 0x29`, con `monsterNamesUpper[41]='TROLLS'`, `enemyDefs[41]
  .name='Troll'`. `AMBUSH_TABLE[0] = 0x29` ⇒ el idx0 de la emboscada **es el mismo
  troll**. La emboscada del camp y el peaje del puente son el mismo mecanismo.
- **El propio test lo verifica.** `camp-ambush.test.ts:221`:
  `expect(enemy?.enemyDef?.index).toBe(AMBUSH_TABLE[idx])` — el `def.index` del
  combatiente == el byte. El código YA trata el byte como `defIndex` y lo comprueba.

**La lista REAL de emboscadores** (`data.json.monsterNamesUpper`/`monsterNamesMixed`,
indexadas por `defIndex`; verificado con node):

| idx `rand(0,7)` | byte | defIndex | nombre (singular) | prob |
|---|---|---|---|---|
| 0 | 0x29 | 41 | **Troll** | 1/8 |
| 1 | 0x14 | 20 | **Giant Rat** | 2/8 |
| 2 | 0x15 | 21 | **Bat** | 1/8 |
| 3 | 0x18 | 24 | **Slime** | 1/8 |
| 4 | 0x16 | 22 | **Giant Spider** | 1/8 |
| 5 | 0x19 | 25 | **Gremlin** | 1/8 |
| 6 | 0x24 | 36 | **Headless** | 1/8 |
| 7 | 0x14 | 20 | **Giant Rat** (repetido) | — |

Giant Rat sale doble (idx 1 y 7) ⇒ **25 %**. Es una lista temáticamente coherente de
"bichos de bajo nivel del overworld que te emboscan de noche", más el troll ocasional.

**La lista de la spec (BARD / Gazer×2 / Crawler / Orc / Gargoyle / Skeleton / Mongbat)
es INCORRECTA:** salió de `monsterNamePtrs1866` (DS 0x1866), un espacio de índice
DISTINTO (la spec misma anotó "0x21=Troll" ahí — distinto de 0x29 — lo que delata que
NO es el espacio del `defIndex`). La review acertó al rechazar esos nombres; ESTA nota
además prueba (por disasm) que el byte SÍ es un `defIndex`, cerrando la duda de ⚖️3a.

**Conclusión punto 1:** `AMBUSH_TABLE = [0x29,0x14,0x15,0x18,0x16,0x19,0x24,0x14]` y su
uso byte→`defIndex` son **CORRECTOS**. Sólo hay que corregir los NOMBRES en los
comentarios (ver diff abajo).

---

## Punto 2 — ¿Cómo entra el combate? → spawn de actor aquí + entrada de combate kernel-residente (mismo hueco que el peaje de trolls)

`0x6BC2`→`kernel_spawn_actor` **COLOCA** un actor de ese tipo en el array de actores
`0xba14` (adyacente a la party), pero **NO corre el motor de combate por turnos** (no
carga COMBAT.OVL, no elige arena). Tras el spawn, `camp()` retorna `ax=1` (epílogo
0x0306, ⚖️2 sostenida).

La entrada de combate REAL es la cadena **kernel-residente** que el propio corpus ya
reconoce para el peaje de trolls (`deliberate-divergences.md:565`): elegir enemigo
`0xb714` → colocar `0xb8a4` → **entrar a combate `0xdf80`** — los tres **FUERA de los
overlays desensamblados**. Confirmé (como la review) que `0xdf80`/`0xb714`/`0xb8a4`
**no aparecen** en la rama de sueño 0x021d-0x03a6.

**Hipótesis A (colisión estándar) vs B (llamada directa a 0xdf80):** estáticamente **no
se puede desempatar** cuál usa el caller `0x3C9A`/MAINOUT tras el `ax=1`, porque ambas
viven en código kernel-residente no volcado. **Pero da igual para el port:** las dos
convergen en el MISMO modelo que el port ya adopta y que ya está aceptado como
divergencia (peaje de trolls, `deliberate-divergences §3`, asunción 0-RNG Clase C):
construir un `OverworldEnemy` sintético en `party_x/y` y llamar `startCombat` (el
equivalente del port a `0xdf80`, con fork del stream vivo). `startCampAmbush`
(`game.ts:3756`) hace EXACTAMENTE eso, idéntico a `spawnTrollCombat`.

**Conclusión punto 2:** el modelo del port es correcto y **no fabrica nada** — reusa el
patrón troll ya aceptado. Lo que NO es cierto es la etiqueta "Clase A cerrada": la
entrada de combate es el MISMO hueco kernel-residente (`0xdf80`) que el peaje de trolls,
y debe documentarse con esa honestidad (no como derivado del disasm de la rama).

---

## Punto 3 — ¿La arena? → **CampFire, DERIVADA de los datos del juego (no del terreno, no de 0x6BC2)**

`0x6BC2` no elige arena — cierto. Pero **CampFire NO es una invención**, es derivable de
los datos SHIPeados del original, por dos hechos:

1. **BRIT.CBT trae una arena índice 0 literalmente llamada "CampFire"**
   (`docs/formats/maps.md:95`; `CombatMapIndex.CampFire=0` en `encounters.ts:26`).
2. **NINGÚN tile enruta a CampFire** vía `combatMapForTile`. Barrido de `TileData.json`:
   **0 tiles con `CombatMapIndex=="CampFire"`**; la hierba (tile 5) → `Glade`. Incluso
   el tile "CampFire" (id 179/0xb3) NO mapea al arena CampFire.

Una arena que existe en los datos pero es **inalcanzable por terreno** sólo puede
seleccionarse por una vía **explícita/hardcodeada**, y el único combate temáticamente de
campamento es esta emboscada. ⇒ la entrada de combate kernel-residente (`0xdf80`) **fuerza
CampFire**. Si la emboscada fuese por la vía de terreno estándar (Hipótesis A pura), la
arena sería **Glade** (hierba) — que sería INFIEL. Por eso el override del port es
**necesario y correcto**.

**Conclusión punto 3:** MANTENER `CombatMapIndex.CampFire`. Lo que hay que corregir es la
JUSTIFICACIÓN del comentario: NO es "override de 0x6BC2" (0x6BC2 no elige arena); es el
arena dedicada de camp-ambush (BRIT.CBT idx 0, inalcanzable por `combatMapForTile`)
forzada por la entrada de combate kernel-residente — mismo hueco que el peaje de trolls.
La INSTRUCCIÓN exacta de selección (dentro de `0xdf80`) no está volcada.

---

## Punto 4 — ¿Suena "{name} attacks!"? → **suppressIntro correcto; único residual de runtime**

El "Ambushed!" (DS 0x41e0) se imprime EN la rama, en `CMDS 0x0247`, ANTES del spawn —
es la línea de intro de la emboscada (⚖️ Punto 6 de la review, confirmado). Si la entrada
de combate kernel-residente (`0xdf80`) AÑADE además "{name} attacks!" es lo único que
**no** se puede cerrar por disasm (está en `0xdf80`, no volcado). Comportamiento de U5:
"Ambushed!" **reemplaza** la intro por-monstruo (no se ve un doble "Ambushed!" +
"Troll attacks!").

**Conclusión punto 4:** MANTENER `suppressIntro:true` (fiel), pero re-etiquetar: anclado
al print confirmado de "Ambushed!" (0x0247) + comportamiento de U5, **NO** a un falso
"0x6BC2 omite attacks!". Es el **único item que un witness DOSBox debe confirmar**.

---

## Diff conceptual para el fixer (la lógica NO cambia; son comentarios + honestidad de etiqueta)

- **A. `game.ts:326-327`** (docstring de `AMBUSH_TABLE`) — sustituir los nombres:
  `0x29 Troll · 0x14 Giant Rat · 0x15 Bat · 0x18 Slime · 0x16 Giant Spider ·
  0x19 Gremlin · 0x24 Headless · 0x14 Giant Rat` (Giant Rat doble ⇒ 25 %). **Mantener**
  "cada byte = `OverworldEnemy.defIndex`" (es correcto — ahora con prueba de disasm:
  `kernel_spawn_actor` usa el byte como índice de tipo).
- **B. `camp-ambush.test.ts:148`** — reemplazar
  "(BARD/Gazer×2/Crawler/Orc/Gargoyle/Skeleton/Mongbat)" por la lista real.
  **`:198`** — "idx 3 → AMBUSH_TABLE[3] = 0x18 (**Slime**)", no "Orc".
- **C. `game.ts:3698` y `3749/3769`** (comentario de arena en startCombat/startCampAmbush)
  — reformular: CampFire **no** la elige 0x6BC2; es el arena dedicada de camp-ambush
  (BRIT.CBT idx 0, inalcanzable por `combatMapForTile` — la vía de terreno daría Glade)
  forzada por la entrada de combate kernel-residente (`0xdf80`), mismo hueco que el
  peaje de trolls. Mantener el override.
- **D. `game.ts:3698/3770`** (comentario de `suppressIntro`) — reformular: anclado al
  print de "Ambushed!" (CMDS 0x0247) como intro propia de la emboscada; decisión fiel /
  Clase C pendiente de un witness DOSBox de si `0xdf80` añade "{name} attacks!". NO
  derivado de "0x6BC2 omite el print".
- **E. `deliberate-divergences.md:580`** — la fila ya dice "PORTADO CONDUCTUALMENTE";
  actualizar: (i) nombres reales de enemigos; (ii) re-enmarcar la entrada de combate
  como el MISMO hueco kernel-residente que el peaje de trolls (`0xdf80`), no "derivada";
  (iii) re-enmarcar CampFire como derivada de datos (arena nombrada + inalcanzable por
  terreno) forzada por la entrada kernel; (iv) marcar `suppressIntro` como el único
  residual de runtime.
- **F. `re/notes/camp-ambush-spec.md §2.1`** (insumo, no editado aquí) — su tabla de
  nombres (BARD/Gazer/…) también está MAL y debe corregirse por su dueño: usa el espacio
  `monsterNamePtrs1866` en vez del `defIndex`.

**Ancla de tabla (test `:137`):** intacta y correcta — `AMBUSH_TABLE` == DATA.OVL
fileoff 0x1744 byte a byte. No tocar (sólo el comentario de nombres de `:148`).

---

## Qué queda para runtime (ventana de oráculo) — 1 witness cierra 3 residuales

Forzar una emboscada real en DOSBox y leer, con **BP en el retorno de `camp()`
(`ax=1`)** y step-in al caller `0x3C9A`/MAINOUT:

1. **¿Se llama `0xdf80` (o equivalente) tras el retorno, y con qué arg de combat-map?**
   → cierra punto 2 (vía) y punto 3 (confirma arena == CampFire=0).
2. **¿Se imprime "{name} attacks!" después de "Ambushed!"?** → cierra punto 4
   (valida/invalida `suppressIntro`).
3. **¿El monstruo en pantalla == `AMBUSH_TABLE[rand(0,7)]`?** → sanity del punto 1
   (aunque ya está probado por disasm).
4. Leer `g_rng_seed` antes/después de la entrada → confirmar si `0xdf80` consume rands
   (relevante sólo si algún día se persigue paridad seed-exacta de camp, hoy excluida).

Ninguno bloquea el desbloqueo de #8: el CÓDIGO ya es correcto; los residuales son de
etiqueta/presentación, y la interpretación del byte (el corazón del bloqueo) queda
**cerrada estáticamente**.
