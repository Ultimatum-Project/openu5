# Verificación binaria: Sea Serpent/Dragon overworld · Mimic · Regalia/Insignia

**Carril:** SCOUT (flota del lead) · **Fecha:** 2026-07-18 · **Rama:** `re/overworld-b34`.
Deriva contra el binario los 3 hallazgos «a verificar» del censo docs-físicos
(`docs/censo-docs-fisicos-port.md` §B). Autoridad = ASM (`re/disasm/`); el doc/clue-book
adorna. Para cada uno: **CONFIRMA** (port fiel, doc adornaba) / **DIVERGE** (port se
desvía, con spec de cableo) / **INDETERMINADO** (no derivable estáticamente → oráculo).

---

## 1. Sea Serpent (y Dragon) atacan en el OVERWORLD — **DIVERGE → CABLEADO**

> **ERRATA + CIERRE 2026-07-18 (rama `fiel/serpent-ranged`):** (a) «call 0x5910 = ataque»
> era FALSO — `0x5910` (=`0xFFFFD740`, bias +0x81D0) es un REFRESCO de viewport, no daño;
> el daño real es `MAINOUT 0x109E` = **rand(1,30) al CASCO de la fragata** (`shipHull`),
> hundimiento si dmg≥hull, y SÓLO si el party navega en fragata (a pie no daña). (b)
> CABLEADO por decisión (A) del lead con la compuerta+rand 100% derivados; el `0x7bea` del
> pipeline queda Clase-C (cola de witness). Derivación completa + witness brief:
> `re/notes/serpent-ranged-derivation.md`. Lo de abajo se conserva como registro.

### Qué hace el binario
El world-turn de overworld (`MAINOUT.OVL 0x1A60`) llama por actor a la **acción especial
`0x131A`** ANTES de moverlo. Derivado instrucción a instrucción (`MAINOUT.OVL.asm`
1954-2045):

- Lee el tile base del actor en `DS:0x5C5A + idx*8` (byte +0 = `def.tile − 0x100`).
- Calcula |dx|,|dy| al party (wrap 256, absoluto).
- **Melé:** si (|dx|,|dy|) == (1,0) o (0,1) → `call 0x1248` (ataque melé) → return 1
  (OMITE el move). `MAINOUT 0x1396-0x139f`.
- **A distancia:** `cmp [bp-0xa], 0x88` / `cmp …, 0xdc` (`0x13A2/0x13A9`) — SÓLO estos dos
  tipos de tile. Si además |dx|≤3 y |dy|≤3 (`0x13B3-0x13C0`): `rand_range(0,7)`
  (`0x13CC`); si ==0 → **`call 0xFFFFD740` (rutina de ataque a distancia = ULTIMA.EXE
  `0x5910`)** + dibuja el proyectil `call 0xFFFFC1DE(0x64,5,0x12C,0x514)` (`0x13D6-0x13E9`).
  ⇒ **1/8 por turno cuando el monstruo está a ≤3 casillas.**

**Identidad de los dos tipos** (byte+0 = `def.tile−0x100`, `def.tile = 0x140 + defIndex*4`;
`monsterNamesMixed` va desfasado −2 respecto a defIndex):
- `0x88` → `def.tile 0x188` → **defIndex 18 = Sea Serpent** (enemigo de agua).
- `0xdc` → `def.tile 0x1dc` → **defIndex 39 = Dragon** (enemigo de tierra/aire).

El ataque apunta a `g_party_x/g_party_y` **sin mirar el transporte** → si el party va en
fragata, la Sea Serpent le dispara igual = el «mece/ataca el barco» del Book of Lore
(`book-of-lore.md:577`). El Dragon hace lo propio en tierra («shoot extremely damaging
magic fireballs… attack while in flight», `book-of-lore.md:565`).

### Qué hace el port
`game/src/core/world/enemies.ts::moveActor` (líneas 252-287) implementa la rama **MELÉ**
(orto-adyacente → devuelve el enemigo → inicia combate, `enemies.ts:263-265`) y el
movimiento por clase (chase/drift/pirata/remolino). **NO existe la rama de ATAQUE A
DISTANCIA de `0x131A`:** no hay chequeo de defIndex 18/39 (tile 0x88/0xdc), ni el
`rand(0,7)`, ni proyectil, ni daño de overworld. `grep 0x88|0xdc|ranged` en `enemies.ts` = 0.

### Veredicto y spec de cableo
**DIVERGE.** En `moveActor`, tras el check melé (`enemies.ts:263`) y ANTES del despacho de
movimiento, insertar la rama ranged fiel:
```
// 0x131A rama a-distancia: SOLO Sea Serpent (def 18) y Dragon (def 39)
if ((enemy.defIndex === 18 || enemy.defIndex === 39)
    && Math.abs(dx) <= 3 && Math.abs(dy) <= 3) {
  if (rand(0, 7) === 0) {           // 0x13CC: 1/8
    // ataque a distancia sobre el party (ULTIMA.EXE 0x5910) + animación proyectil
    return { rangedAttack: enemy };  // consume el turno del actor, OMITE move
  }
  // rand!=0: cae al move normal (no return)
}
```
- El **daño** (rutina `0x5910`) queda por derivar (no lo abrí instrucción a instrucción);
  candidato a testigo de oráculo o a una 2ª pasada de ASM. La **compuerta** (tipos, rango
  3, 1/8, consumo de rand, orden dentro del turno) está DERIVADA y citada.
- Cuidado con el **stream de RNG**: este `rand(0,7)` ya está contemplado en
  `overworld-ai-rng.md` (sitio `0x13CC`) como parte del orden del turno; el fix de #37
  (movimiento) y este comparten el mismo bucle 31→1. Si se cablea, el modelo de paridad
  de overworld debe incluir el `rand(0,7)` de los actores ranged (hoy nunca disparaba
  porque no había ranged en los escenarios de captura).

---

## 2. Mimic — creatura de COMBATE con disfraz/revelado, NO cofre-trampa de overworld — **DIVERGE (menor, visual de combate)**

### Qué hace el binario
El Mimic es **tipo 0x1A**, un enemigo del **mapa de COMBATE** (encuentros/salas de
mazmorra), no un actor de overworld ni de pueblo. No hay mimic-cofre en el mundo grande;
la afirmación «disguised as a treasure chest» del Book of Lore (`book-of-lore.md:553`)
se corresponde con el mimic **de sala de combate**, que arranca DISFRAZADO y se REVELA:

- Tabla de actor de combate `DS:0x5C5A`, byte **+6 = estado de sprite: `0xFF` dormido/
  disfrazado, `0x20` revelado** (`combat.md:44`).
- **Revelado:** al melé (dist==1), «Mimic/Corpser se revelan (sprite 0x20)»
  (`combat.md:331`, COMBAT.OVL `0x02F8-0304`,`031A-0327`).
- Otras señas del 0x1A ya derivadas: **dispara SIEMPRE** a distancia (no el 50% del resto,
  `combat.md:325`, `0x016E-0180`); **DEX efectiva del defensor = 1** (como dormido,
  `combat.md:136`, `0x139A`); **NUNCA se mueve** (`combat.md:348`, `0x0EE4:0f05-0f14`).

### Qué hace el port
`game/src/core/combat/combat.ts` implementa lo mecánico: dex efectiva 1 (`combat.ts:829`),
inmóvil (`combat.ts:2093`), dispara-siempre (`combat.ts:2033`). Pero **hardcodea
`invisible=false` al spawn (`combat.ts:437`)** y no modela el byte +6 → el mimic se dibuja
SIEMPRE como mimic, nunca disfrazado, y no hay evento de «revelado».

### Veredicto
**DIVERGE (menor).** Es un hueco de **presentación de combate**, no de overworld: el mimic
debería mostrarse disfrazado (estado +6 = 0xFF, sprite de cofre) hasta que ataca en melé,
momento en que conmuta a revelado (+6 = 0x20). Spec: añadir estado `disguised` al combatant
mimic/corpser (init true), pintar sprite de cofre mientras `disguised`, y en el melé (o al
revelarse) conmutar a su sprite real + evento. Prioridad baja (cosmético de sala). **La
pregunta del lead queda contestada: NO hay cofre-trampa mimic en overworld/pueblo; es
enemigo de combate, y el disfraz/revelado vive en el mapa de combate.**

---

## 3. Regalia / Insignia

### 3a. CETRO sobre campos de energía fuera de combate — ~~**DIVERGE**~~ [HISTÓRICO 2026-07-25: veredicto superado por `overworld-b34-sceptre-correction.md` (753e34aa) — barreras 0x70-0x7F, no campos; port fiel]

> ⚠️ **SECCIÓN CORREGIDA — NO CABLEAR ESTA SPEC.** Re-derivación independiente
> (`re/notes/overworld-b34-sceptre-correction.md`, aterrizada el mismo día): el barrido de
> CAST 0x1966 testea `(tile&0xf0)==0x70` → disuelve BARRERAS Shadowlord (0x70-0x7F→Grass),
> NO los campos elementales 0x80-0x83; es 3×3 SILENCIOSO (el «Field dissolved!» por celda
> no existe) y salta mazmorras. 0x70-0x7F no aparece en los mapas del port ⇒ inerte; el
> «No effect!» actual es observablemente fiel. Lo de abajo queda como histórico del error.
- **Binario (`CAST.OVL 0x1966`, citado por el propio port `game.ts:3778-3782`):** «Wielding
  the Sceptre of Lord British...\n» y **disuelve los campos de fuerza/energía (In Flam/Nox/
  Zu/Sanct Grav) de las celdas contiguas: "Field dissolved!\n" por cada uno, o "No effect!\n"
  si no hay ninguno**. Es un barrido de celdas adyacentes que quita tiles de campo
  (`FIELD_WALL_TILE = 0x80-0x83`, ver `field-spell-port.md:11`).
- **Port (`game.ts:3783-3789` `useSceptre`):** imprime SIEMPRE «Sceptre / Wielding… / No
  effect!». El barrido de disolución está **diferido** (comentario `game.ts:3780-3781`:
  «En juego normal no hay campos alcanzables fuera del endgame → observa No effect!»).
- **Veredicto: DIVERGE.** El argumento «no hay campos fuera del endgame» es FALSO en juego
  normal: los hechizos de campo (In Flam Grav etc., `fieldSpell.ts`) crean tiles 0x80-0x83
  pisables en overworld/mazmorra; el Cetro es una utilidad legítima para disolverlos (además
  de An Grav). **Spec:** en `useSceptre`, escanear las 4 (u 8) celdas contiguas al party; por
  cada tile ∈ {0x80,0x81,0x82,0x83} → restaurar el suelo base + emitir «Field dissolved!»;
  si ninguna → «No effect!». Ref binaria: `CAST.OVL 0x1966`, str 0x4981.

### 3b. INSIGNIA (Black Badge) ante guardias de Blackthorn — ~~INDETERMINADO (oráculo)~~ **RESUELTO ESTÁTICO 30-07**
- [⚠ 30-07, re/notes/talk-031e-resolucion.md: el «handler opaco», `0x1912`, es TALK 0x031E,
  leído ENTERO; la vía de captura ejecuta el guard_demand, `0x1e2`, y su gate, `0x2a4`, SÍ
  consulta la insignia. El párrafo siguiente queda como registro pre-resolución.]
- El requisito de la Insignia **no es derivable estáticamente**: `blackthorn.md:305-350`
  (§8.3, §9) lo marca ⚠️ oráculo — el gate del password `g_time_spell==0x1d` y «si exige el
  Black Badge» dependen del handler opaco, `0x1912`, (fuera de TOWN.OVL) y de `result==2`, no
  derivables sin BP de DOSBox.
- **Port:** dispara la captura por **adyacencia manhattan==1 a un guardia type 0x70**
  (`blackthornGuardCaptureTriggers`), la evita con `blackthornPassGranted` (password «IMPE»),
  e **ignora `wornBadge`** — declarado como **aproximación conservadora Clase C** (la
  adyacencia-necesaria SÍ está derivada; la suficiencia y el gate del badge, no).
- **Veredicto: INDETERMINADO.** No puedo CONFIRMAR ni refutar que el binario respete la
  Insignia; ya está en la cola de oráculo del carril Blackthorn. El port no diverge
  «probadamente» — es un hueco declarado a la espera de testigo. **Recomendación:** dejarlo
  en la cola de oráculo existente (no abrir cableo hasta el witness).

### 3c. CORONA anti-magia — **CONFIRMA (port fiel)** · AMULETO 50% negate — **DIVERGE**
Hay que separar TRES efectos que el clue-book funde en «Corona protege de la magia»:

1. **Corona → poder castear en el Palacio de Blackthorn.** Binario `COMBAT.OVL 0x0936`: si
   el combate se inició en el Palacio (`g_unk_5894==0x12`) y NO llevas la Corona
   (`g_crown==0`) → tu (C)ast se **«Absorbed!»** (turno consumido, hechizo no lanzado).
   **PORT: IMPLEMENTADO** — `combat.ts::combatCastAbsorbed` (266-274): `combatOriginLocation
   === LOC_PALACE_OF_BLACKTHORN && !wornCrown → true`. ~~✅ CONFIRMA~~ **[⚠ 31-07: el
   CONFIRMA era FALSO en el argumento — el binario lee POSESIÓN (`g_crown` = `[0x57b4]`,
   +0x20E del save, escritor único el (G)et SJOG 0x16e6), no el toggle de PUESTA; el port
   pasa wornCrown ⇒ quien TIENE la corona sin usarla se come «Absorbed!» donde el original
   le deja lanzar. Fix derivado (~3 líneas) bloqueado por el embargo de main.ts — tablero #42.]**
   *(Corrige al censo/scout previo, que reportó el efecto de la Corona como «diferido»: el
   toggle del (U)se es un eco, pero el efecto load-bearing SÍ está cableado en combate.)*

2. **Amuleto → 50% de negar un ataque MÁGICO entrante.** Binario `COMBAT.OVL 0x029C-02DC`
   (`combat.md:325` ctx): si la víctima es un PJ con el amuleto puesto (`roster+0x1E == 0x2D`,
   = el slot de amuleto del registro, `saveNative.ts:185 amulet=d[base+0x1e]`) y el atacante
   es mágico (flag LE 0x8000): `amulet_negate = rand0(255) < 0x80` (**50%**) → el golpe
   mágico falla. **PORT: NO PORTADO** — `combat.ts:405` usa `record.amulet` SÓLO para sumar
   su valor de defensa; no hay lógica de negate-mágico-50%. **DIVERGE.** Spec: en la
   resolución de golpe enemigo con arma mágica (flag 0x8000), si el defensor PJ lleva amuleto
   0x2D → `rand(0,255) < 0x80` anula el golpe. Ref: `COMBAT.OVL 0x029C`.

3. **Bonus de combate «efecto 9» del (U)se de Amuleto (`CAST.OVL 0x1908`, g_time_spell 0xe) y
   Corona (`CAST.OVL 0x193e`, g_time_spell 0x1c).** Ambos togglean un efecto 9 cuyo bonus de
   combate el port declara **diferido** (`game.ts:3744-3745/3762`). Separado de (1) y (2);
   queda como hueco de endgame ya conocido.

**Amuleto guía en la oscuridad del Underworld** (clue-book `:823`): es navegación del
endgame (Underworld oscuro). No lo derivé aquí (fuera del alcance de combate); el port lo
tiene como toggle sin efecto (scout §A5). Queda para el paquete endgame (#20).

---

## Resumen para el lead

| # | Hallazgo | Veredicto | Acción |
|---|----------|-----------|--------|
| 1 | Sea Serpent (def 18) + Dragon (def 39) ranged en overworld | **DIVERGE** | Cablear rama `0x131A` ranged en `enemies.ts::moveActor` (tipos+rango3+1/8 derivados; daño `0x5910` por derivar) |
| 2 | Mimic disfraz/revelado | **DIVERGE (menor)** | Combate-only (no overworld); estado +6 disfraz→0x20 revelado; cosmético de sala |
| 3a | Cetro disuelve campos fuera de combate | ~~DIVERGE~~ **CORREGIDO: barreras 0x70-0x7F, inerte — port fiel** | Ver `overworld-b34-sceptre-correction.md` |
| 3b | Insignia ante guardias | **INDETERMINADO** | Dejar en cola de oráculo Blackthorn (no derivable estático) |
| 3c | Corona anti-magia | **CONFIRMA** (ya en `combat.ts:266-274`) | — (corrige «diferido» del censo) |
| 3c' | Amuleto 50% negate-mágico | **DIVERGE** | Cablear negate 50% en golpe mágico enemigo (`COMBAT.OVL 0x029C`) |
