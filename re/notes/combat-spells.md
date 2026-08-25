# Hechizos EN COMBATE — integración del consumidor de CastEffect (task #44)

Derivación EXACTA del pipeline que aplica los descriptores de `castSpell`
(`core/magic/cast.ts`) sobre el motor de combate (`core/combat/combat.ts`).
Bandas de overlay (near_call_base), derivadas de `load_seg`×16 en la tabla de overlays del
kernel (`dispatch_table.overlay_near_call_base`): banda 2 = **0xa290** (COMBAT, NPC,
BLCKTHRN, FLAMES, LOOKOBJ, DNGLOOK, OUTSUBS, SHOPPES, ENDGAME); banda 3 = **0xbf80**
(CAST, CMDS, SJOG, TALK); banda 4 = **0xe1e0** (CAST2, ZSTATS, COMSUBS, SHOPPES2,
SHOPPES3, FONT).

🔴 **CORREGIDO (ficha #110, 2026-08-09).** Esta línea decía «CAST/COMSUBS/SJOG/TALK =
0xbf80» y colocaba a COMSUBS en la banda 3. Es falso: COMSUBS es el overlay número 20, y su
segmento de carga, `0x0e1e`, lo pone en la banda 4. En la banda 3 quien va es **CMDS**, y ahí está el
error — dos nombres parecidos intercambiados, no una base mal copiada. Adjudicado por dos
vías sin nada en común, que es el mismo control con que se fijaron las cinco bandas
(PLAN-VIVO §2): (a) la tabla de overlays del kernel, y (b) el careo de destinos — de los
146 candidatos `E8` de COMSUBS, con la base 0xe1e0 caen **82** exactamente en el `start` de
una fila del ledger, y con 0xbf80 caen **cero**.

★ **Y POR QUÉ EL CUERPO DE ESTA NOTA NO ESTABA CONTAMINADO** (dicho para que nadie «lo
arregle»): un near-call se resuelve SIEMPRE con la base del overlay QUE LLAMA, nunca con la
del llamado, y los saltos entre overlays pasan por la tabla de stubs PLINK del kernel. Las
citas de COMSUBS de esta nota salen justo de ahí, con la base de CAST, que es la correcta:
`call 0xffffc19e` cae en el stub residente, `0x811e`, y `dispatch_table.stubs()` lo manda a
COMSUBS:0x0000. La base de COMSUBS sólo hace falta para resolver llamadas hechas DESDE
COMSUBS, y esta nota no resuelve ninguna. **Radio de la errata: esta línea, y nada más** —
censo en `re/notes/comsubs-base-acta.md`.

Un `call 0xffffXXXX` resuelve al kernel residente `(base + 0xXXXX) & 0xffff`
(REGLA A, quake-harpsichord.md §6). RNG: `rand30()`=kernel 0x3ABE (1..30),
`rand(lo,hi)`=0x2092, `rand0(n)`=0x3AAE (0..n). Convención pascal (primer push =
arg izquierdo).

Estado: **DERIVACIÓN** (asm leído instrucción a instrucción por el owner + 3
agentes de derivación read-only, 2026-07-16). La paridad RUNTIME vs oráculo es
el gate final (fixture nuevo `combat+spells`, requiere ventana de emulador).

---

## 0. El hueco

`castSpell` produce un `CastEffect` con los parámetros exactos del binario, pero
**en combate NADIE lo consume**: `main.ts::doCast` sólo resuelve los efectos de
overworld (light/heal/cure/awaken/sealDoor) y los globales (via `applyGlobal`).
En combate no existe siquiera un comando (C)ast (`handleCombatKey` sólo tiene
A/Space/K/números/flechas). Los descriptores de AoE/daño/estado (`combatAttack`,
`earthquake`, `lineAoe`, `fieldWall`, charm/fear/summon…) caen al vacío.

Este documento deriva el CONSUMIDOR de combate y su orden de tiradas.

---

## 1. CORRECCIONES al brief del ticket (verificadas en asm)

El ticket #44 arrastra tres atribuciones ERRÓNEAS del censo; la derivación las
corrige:

1. **In Vas Por Ylem NO es triple-shake ni 0x169d.** Es `CAST:0x091e` (índice de
   hechizo 30, confirmado en la jump table 0x1146 → trampolín 0x1062 → 0x091e) y
   emite **UNA** sacudida `call 0x70f2` (kernel 0x3072) en 0x092d, antes del bucle
   de daño. El triple-shake `0x169d×3` (tras string 0x4822) pertenece a
   **`CAST:0x15b4`**, el ritual de destrucción de los **Shards de los
   Shadowlords** (endgame, (U)se-Shard: ítems 0x1d/0x1e/0x1f → modo 0/1/2 =
   Falsehood/Hatred/Cowardice → Flame of Truth/Love/Courage → doom de
   Faulinei/Astaroth/Nosfentor; strings 0x4822/0x482a/0x4831, 0x4858/0x4861/0x486a).
   **Fuera de scope de #44** (es material de endgame, task #20). El combate sólo
   necesita la sacudida SIMPLE.

2. **CAST2:0x0e76 "espectáculo" NO es un hechizo.** Es el handler de la escena de
   **meditación / peregrinación al Shrine of the Codex** (guarda/fuerza
   g_location, snapshotea la tabla de actores 0x5c5a, escribe el bitmap de shrines
   visitados 0x58CE; sin RNG; sin índice de hechizo). Pertenece al subsistema de
   shrines (task #14), no al combate. Sólo hay que NOMBRARLO (hecho aquí).

3. 🔴 **RETIRADA (2026-08-07). In Ex Por (#26) SÍ abre puertas mágicas, y `CAST2:0x0768`
   TAMBIÉN le pertenece.** El texto anterior decía: *«#26 (`CAST:0x1026`) = getdir + anim de
   casteo (efecto 5) y NADA más (verificado 0x1026-0x1037) … `CAST2:0x0768` es el WORKER de
   abrir puerta con Skull Key, NO un hechizo. Nada que cambiar.»* **Falso en su conclusión.**

   **Medido**: el worker `CAST2.OVL:0x0768` tiene **DOS llamadores**, los dos vía stub `0x80ee`
   — `CAST.OVL:0x18dd` (rama de éxito de la Skull Key) **y `CAST.OVL:0x1026`, que es el brazo
   del hechizo 26**. La tabla de salto de `0f1a` vive en fileoff `0x1146`, 48 entradas
   (cardinal fijado por la guarda `cmp ax,0x2f/jbe`), **48/48 dentro del cuerpo y 48 distintas**;
   controles ajenos: entrada 24 → `call 0x7b4` (invocador de In Bet Xen) y entrada 25 →
   `call 0x846` (sello real de An Ex Por). La primera instrucción del brazo 26 es
   `call 0xffffc16e` → el worker, que escribe `0x97→0xB8` / `0x98→0xBA` en el mapa vivo.
   **Alcanzabilidad POSITIVA**: máscara de contexto `DS:0x1c90` ⇒ In Ex Por = `0x05` =
   pueblo+combate, que es donde hay puertas mágicas.

   ⇒ El enunciado correcto **no** es «era la llave, no el hechizo»: es **«un worker, DOS
   llamadores»**. La tarea #22 acertó al identificar la rama de la llave y **corrigió de más** al
   retirar al hechizo sin censar los llamadores.

   ★★ **POR QUÉ SE COLÓ, que es lo que impide que vuelva**: el rango citado (`0x1026-0x1037`)
   era **exactamente correcto** — son las siete instrucciones del brazo, ni una de más. Pero
   **«y NADA MÁS» no es una propiedad del RANGO: es una propiedad del CALLEE**, y el callee no se
   abrió. Lo hace invisible que `0xffffc16e` **no parece CAST2** (parece kernel) y que el worker
   empieza por `call 0x306`, o sea que «getdir» describe exactamente lo que se ve desde fuera.
   **Regla: no se afirma «y nada más» de un rango que empieza o acaba con un `call`, sin abrir el
   callee.**

   Derivación completa, controles y límites: `inexpor-dos-llamadores-acta.md`. Cadena confirmada
   por tres canales independientes (`bugs-original` la midió, `cola-cast` la corroboró, `cola-ui`
   la atacó por encargo del lead y no pudo tumbarla).

   **PENDIENTE, no arreglado aquí**: el port sigue con `cast.ts case 26 → castAnimOnly`, o sea
   **omite una mecánica que el original tiene**. Es defecto de fidelidad y se arregla APARTE,
   porque toca `game/src` y **hay que medir si mueve stream** (el worker llama a
   `prompt_direction`) — con ventana de sellos si lo mueve.

4. **Opacidad 0x3f6e / bitmap DS:0x6a14 NO la usa el combate.** ~~El único caller~~ **[CORREGIDO por #173 — son DOS; ver «Correcciones #173» al final de esta nota]** de
   0x3f6e es `CAST:0x1c28` (LOS de apuntado de hechizos). El trazado de
   proyectiles/línea del COMBATE usa OTROS kernels (0x5D8E/0x5dfe, combat.md §14).
   El port ya raycastea por celdas en `combat.ts` (§ raycast, `playerAttack`).
   Ver §6: se reconcilia, no se reimplementa a ciegas.

---

## 2. Ataques directos de hechizo — `combatAttack` (Grav Por / Vas Flam / Xen Corp)

`CAST:0x0032(weapon)`: `g_cmb_weapon=weapon; call COMSUBS:0x0C52` → **reutiliza el
motor de combate del PJ** (mismo acierto/armadura/raycast que un arma). Daño =
`attackValues[weapon]` (data.json): 0x30→16 (`rand(1,16)`), 0x31→30 (`rand(1,30)`),
0x32→99 (muerte instantánea, ignora armadura). `spellAttackRange[weapon]==8` ⇒
arma de STR. Ya modelado en `cast.ts` como `{kind:"combatAttack", weaponId}`.

**Aplicación en combate**: es un ataque APUNTADO (getdir/aim) de una sola casilla.
Se resuelve por el MISMO camino que `playerAttack(x,y)` con un arma sintética
`{id: weaponId, attack: attackValues[weaponId], range: attackRangeValues[weaponId]}`.
El flag `g_5890` (golpe mágico, media-daño anulado a no-muertos, `applyDamage`
`magicAttack`) se activa: `weaponIsMagic(weaponId)` ya lo cubre para id≥0x23
(0x30/0x31/0x32 lo son). Orden de tiradas = idéntico a un ataque normal (ya
verificado en Task 3.2). **Cero RNG nuevo.**

---

## 3. In Vas Por Ylem (terremoto) — `earthquake`, `CAST:0x091e` · VERTICAL SLICE

Handler completo 0x091e-0x099c. Orden EXACTO:

```
0926 push 6; 092a call 0xffffc186   ; anim de casteo efecto 6 (sin RNG)
092d call 0x70f2                    ; SACUDIDA (kernel 0x3072) — UNA vez, pre-bucle
0930 si = 0                         ; índice de slot
0932 [bp-4] = 0x55bc + (casterSlot<<5)   ; base del record del caster (roster)
093f di = 0xba16                    ; tabla de registros de combate, stride 8
LOOP (si=0..0x1f, di+=8):
  0942 if [di]==0            → skip            ; slot vacío
  0948 call 0xffff96c6 (kernel 0x5646)         ; ¿enemigo vivo/targetable?
       if ax==0             → skip
  094f call 0x7b3e (kernel 0x3ABE = rand30)    ; DRAW #1 → [bp-8] = umbral (1..30)
  095a call 0xffffbf46 (COMBAT:0x13e2, arg 0xfffe) ; lee INT del registro enemigo
       if enemyINT > [bp-8] → skip             ; RESISTE (saving-throw)
  0963 call 0x75e4 (kernel 0x3564)             ; flash + tono fijo (sin RNG)
  0972 call 0x6112 (kernel 0x2092, args 1,0x14); DRAW #2 → rand(1,20) = daño
  0976 call 0xffffbdae (COMBAT:0x1574)         ; aplica daño (+ XP-de-muerte interno)
  097e call 0x7f94 (kernel 0x3f14, cap 0x270f) ; XP extra al caster (acumula, cap 9999)
  0988 call 0xffffbe32                          ; graba XP al caster (g_cmb_actor)
098b di+=8; si++; loop si<0x20
```

**Orden de tiradas por enemigo VIVO** (crítico para paridad):
- slot vacío / no-enemigo / muerto: **0 tiradas**.
- enemigo que RESISTE (`enemyINT > rand30()`): **1 tirada** (rand30).
- enemigo GOLPEADO: **2 tiradas** (rand30 umbral, luego rand(1,20) daño).

Recorrido de slots: **0→0x1f ascendente** (opuesto al barrido descendente de la
IA de `selectTarget`). Daño vía `applyDamage` (ya porta 0x1574: media-daño a
no-muertos con `magicAttack`, muerte, XP-de-muerte, botín, división).

⚠ **DIVERGENCIA con magic.md §7** (que decía sólo "rand(1,20)/enemigo"): hay un
**saving-throw INT por enemigo ANTES del daño** (rand30 vs INT del registro). Es
la misma primitiva de la confusión de #42 (`rand30() > actor.int`), aquí en la
forma `enemyINT > rand30()`.

⚠ **XP extra (0x7f94/0xbe32)**: parece sumar XP al caster POR IMPACTO además de
la XP-de-muerte de 0x1574. Cantidad exacta (¿=daño? ¿=maxHP/4+1?) **pendiente de
confirmar contra oráculo** — es el punto de ajuste más probable del fixture. Para
el slice: aplico daño vía `applyDamage` (que ya da XP-de-muerte) y **dejo la XP-
por-impacto detrás de un flag que la paridad valida** (no la invento a ciegas).

**Presentación**: emitir UN evento `quake` + sfx `quake` (primitiva ya en main,
task #29/#36) al inicio, antes del bucle de daño (orden fiel 0x092d).

---

## 4. Hechizos de LÍNEA — `lineAoe`, `CAST:0x1f60(color, mode, actor)`

> ⚠ CORREGIDO 2026-07-22 (`fx-lineaoe-negate-derivation.md` §3): `[bp+4]` NO es
> «len» — es el COLOR del stub del hechizo; y 0x1c36 NO traza Bresenham: traza el
> ABANICO de 21 rayos (dirección por getdir 0xffffc162 en 1f87) y registra las
> celdas cubiertas (filas de y impar, corte LOS 0x6a14, dedupe 0xab02, cap 63).
> La TABLA DE MODOS de abajo sigue siendo correcta (confirmada instrucción a
> instrucción) y es la que cablea `applyLineCell`.

Args pascal: `[bp+8]`=actor, `[bp+6]`=mode, `[bp+4]`=color. `0x1c36` llena
X=`[bp-0x80]`, Y=`[bp-0x100]` con las celdas del abanico (slots 1..count,
pre-incremento). Por celda se busca el
PRIMER combatiente casado (barrido de records 31→0, +6=y/+7=x), saltando
ya-golpeado (+5&0x80), muerto (+2&0x20 ó +2==0); marca +5|=0x80. **Máx 1
combatiente por celda.** Al final limpia todos los +5&0x7F.

Tiradas por celda, por modo:

| modo | hechizo | gate | tiradas (en orden) | efecto |
|------|---------|------|--------------------|--------|
| 1 | In Zu (len 2) | saving INT (0xc19e=COMSUBS:0x0000, spell-id 0) → resiste salta; luego inmunidad-por-tipo CAST:0x0000 (tipos 0x2F/0x0E/0x0F, sin RNG) | **1 rand30** | dormir (kernel 0x68AE) |
| 2 | In Nox Hur (len 1) | — | **1 rand30** (0x7b3e); si `roll < statEnemigo` salta | ataque de veneno (COMBAT:0x18BA). ⚠ contest DIRECTO stat-vs-rand30, NO COMSUBS:0x0000 |
| 3 | In Flam Hur (len 2) | — | **1 rand0(30)** (0x7b2e base 0x1e) | daño 0..30, SIEMPRE aplicado (COMBAT:0x1574 + XP) |
| 4 | In Vas Grav Corp (len 1) | saving INT (0xc19e) → resiste salta; inmunidad-tipo (sin RNG) | **1 rand30** | daño FIJO 99 (sin tirada de daño); COMBAT:0x1574 + XP |

Notas de paridad:
- `0x7b2e(base)` = **`rand0(base)` = rand(0,base)**, NO `rand(1,base)`. Modo 3 =
  rand(0,30) (0..30, puede ser 0 → "grazed").
- Modo 4: el 99 es CONSTANTE y sólo se aplica si PASA el saving INT + la
  inmunidad-tipo; nunca hay segunda tirada de daño.
- Modos 1 y 4 consumen la tirada de saving ANTES de nada; si resiste, esa celda
  gastó 1 rand30 y nada más.

---

## 5. Saving-throw genérico — `resist()`, COMSUBS:0x0000

Función completa 0x0000-0x0053 (`ret 6`, 3 args pascal):
```
arg1=[bp+8] (atacante/caster)  arg2=[bp+6] (defensor/target)  arg3=[bp+4] (spell-id)
0006 if spellId in {0x30,0x31} or spellId>=0x33 → return 0   ; EXENTO (no tira)
001c INT(arg1) → [bp-4]   (accessor +0x0E)
0029 INT(arg2) → [bp-2]
0036 call 0x58de = rand30()                                  ; ÚNICA tirada
003b ax = INT(arg2) - INT(arg1) + 30 ; sar 1 (signed /2)     ; umbral
0049 if umbral <= roll → return 0    (jle)                   ; NO resiste
004d else return 1                                           ; RESISTE
```
→ **RESISTE ⟺ `(INT_def − INT_att + 30)/2 > rand30()`** (umbral ESTRICTAMENTE
mayor que el roll). **1 rand30**, tras leer ambos INT, antes del compare. El
guard de spell-id VIVE DENTRO de 0x0000 (los ataques directos 0x30/0x31 y Xen
Corp/otros ≥0x33 no tiran → auto-aplican). El clon YA tiene esta fórmula inline
en `combat.ts:1519-1522` (posesión del daemon) — se **extrae a un helper
`resist(intAtt, intDef, spellId)`** reutilizado por lineAoe modos 1/4 y por quien
lo necesite. (In Vas Por Ylem usa la forma SIMPLE `enemyINT > rand30()`, §3, no
esta genérica.)

---

## 6. Opacidad de línea-de-visión (item 4 del ticket) — reconciliación

> **⚠ §6 SUPERADO (2026-07-19, carril cast-line-aoe 90bdfc01, disasm-mata-resumen):**
> (a) el combate SÍ usa 0x6a14 — cadena verificada CAST.OVL 0x104e → 0x1f60 → 0x1fd2
> call 0x1c36 → 0x1df8 call 0x1bb0 → 0x1c28 → 0x7fee → kernel 0x3f6e («NO cablear
> 0x6a14 al combate» queda refutado); (b) la POLARIDAD estaba invertida: bit SET =
> TRANSPARENTE (210), bit CLEAR = OPACO (46) — ver la corrección en
> cast-line-area-spell-derivation.md §Datos FIRMES y los comentarios de
> areaSpellTables.ts. Se conserva el texto original de abajo como histórico.

Kernel `0x3f6e` (bitmap `DS:0x6a14`): predicado "tile opaco a LOS".
`bloquea ⟺ bit (0x80>>(tile&7)) del byte 0x6a14[tile>>3] está a 1`, tile leído de
mapbuf `DS:0xAB02` (stride 32). **Es DISTINTO de la pasabilidad** (kernel 0x2bd4,
tabla `DS:0x54d4`) y del bitmap de opacidad-de-luz (`DS:0x6a86`, kernel 0x5dfe).

~~**Pero 0x3f6e NO tiene caller en COMBAT/COMSUBS**~~ **[CORREGIDO por #173 — sí lo tiene, y son DOS; ver «Correcciones #173» al final de esta nota]** — ~~su único caller es~~ el de esta lectura es
`CAST:0x1c28` (LOS del apuntado de hechizos de overworld). El trazado de
proyectiles/línea DEL COMBATE usa `0x5D8E/0x5dfe` (combat.md §14). El port ya
raycastea celda a celda en `combat.ts`. **Acción #44**: reconciliar el raycast de
combate con la semántica de 0x5dfe (bitmap 0x6a86) — NO cablear 0x6a14 al combate
(sería la tabla equivocada). Prioridad BAJA (el raycast actual ya funciona);
volcado de los 32 bytes de 0x6a86/0x6a14 desde el DS del binario pendiente (no
están en el disasm de código).

---

## 7. Plan de implementación (por lotes)

1. **combatAttack** (§2): arma sintética por el camino de `playerAttack`. Sin RNG
   nuevo. + comando (C)ast en combate (`handleCombatKey`) y método `playerCast`.
2. **earthquake** (§3): vertical slice. `quake` + bucle 0→31 con
   saving(rand30 vs INT) → daño rand(1,20) → applyDamage. XP-por-impacto tras flag
   validado por paridad.
3. **lineAoe** (§4): Bresenham + máx-1/celda + tiradas por modo (rand30 / rand0(30)
   / 99-fijo). Reusa `resist()`.
4. **resist()** genérico (§5): extraído de 1519-1522.
5. Efectos de estado con semántica de combate ya derivados en cast.ts (charm,
   massFear, repelUndead, summon*, invisibilitySelf, revealInvisible, blink,
   sleep, poof, disarmOrOpen, fieldWall) — aplicar sobre el grid; muchos reusan
   `resist()`.
6. Heal/cure/awaken/resurrect en combate: MISMO picker de PJ que overworld.
7. **opacidad** (§6): reconciliar raycast con 0x5dfe/0x6a86. Baja prioridad.

Gate local: `tsc` + unit (tests discriminantes por hechizo). Paridad final:
fixture `combat+spells` vs oráculo (valida además el conteo de rand30 de la
confusión de #42) — **requiere ventana de emulador (pedir a team-lead)**.

Estado de aterrizaje: lotes 1-4 en main (bd17273 + 2f4480f); replay del fixture
en main (437e49c). Lote 5 = ESTE §8 (derivación); implementación tras validar la
paridad del saving-throw.

---

## 8. Lote 5 — efectos de ESTADO en combate (DERIVACIÓN, sin implementar aún)

Handlers de los descriptores que faltan por consumir en `playerCast` (hoy caen al
`default`). Cuerpos citados de `.superpowers/sdd/task-3.3-derivation-draft.md §2e`
(confianza A en estructura) + saving genérico §5. **Orden de tiradas por hechizo**
(lo que el fixture debe clavar). Todos son la ACCIÓN del turno del caster (avanzan
el turno). El saving genérico es `savingResist(casterINT, targetINT, spellId)`
(§5); el `spellId` que pasa cada handler determina la exención — la mayoría de
estos NO-ataque pasan `0` (tiran), como el de línea.

### 8.1 Objetivo único con saving (aim → 1 combatiente)
- **charm** (An Xen Ex #34, `CAST:0x09a0`): aim (picker 0xc1c2) → combatiente;
  `COMSUBS:0x0000` contest (**1 rand30**); si NO resiste `xor [record+2],1`
  (charm, cambia de bando) + " charmed!". Reusa `savingResist`.
- **polymorphRat** (Rel Xen Bet #35, `CAST:0x0a5c`): aim → combatiente; contest
  (**1 rand30**); si pasa, `kernel 0x6506` spawnea tipo 0x14 (rata) en la celda
  del objetivo → **+1 rand de spawn** (`enemySpawnSpeed` rand0(7)). Total **2
  tiradas**. ⚠ confirmar si RETIRA al original (o lo sustituye).

### 8.2 Barrido de enemigos con saving (loop 32 records)
- **repelUndead** (An Xen Corp #7, `CAST:0x043e`): loop 32; enemigo (flags&0xC0==
  0x40) con `enemyFlags[type]&0x20` (undead) que FALLA `COMSUBS:0x0000` →
  `[record]=1` (hp=1) `or [record+2],2` (huida). **1 rand30 por enemigo UNDEAD
  vivo** (los no-undead no tiran). Orden de slots como el terremoto (§3): 0→31.
- **massFear** (In Quas Corp #41, `CAST:0x0c98`): igual pero SIN filtro undead —
  todo enemigo que falla el contest huye (hp=1 + flag 0x02). **1 rand30 por
  enemigo vivo**, 0→31.

Ambos reusan `savingResist` + la marca hp=1/isFleeing (ya existe `woundClassify`/
`isFleeing`; aquí es directo).

### 8.3 Invocaciones (spawn, consumen rand de velocidad)
`kernel 0x6506` (=`makeEnemy`/`enemySpawnSpeed`) consume **1 rand0(7)** por
criatura spawneada (ya modelado en `combat.ts:makeEnemy`). El aliado se marca con
el bit de bando (charmed=true en el clon).
- **summonAlly** (Kal Xen #10): el tipo ya lo tiró `castSpell.effectFor`
  (`rand0(0x0f)`, en el stream del dispatcher) → el descriptor trae `monsterType`;
  en combate: 1 celda libre → spawn (**1 rand0(7)**).
- **summonSwarms** (In Bet Xen #24): hasta 4 celdas libres → 4× spawn (**hasta 4
  rand0(7)**), cada uno aliado (Insect Swarm 0x1f).
- **summonDaemon** (Kal Xen Corp #43, `CAST2:0x04c2`): spawnea Daemon 0x26;
  `contest rand30 < INT` decide aliado/hostil (**1 rand30** + **1 rand0(7)** de
  spawn). ⚠ el contest aquí es `rand30 < INT` (forma directa, como la posesión),
  no el `savingResist` genérico — CONFIRMAR dirección contra oráculo.

### 8.4 Sin RNG (aplicación directa sobre el grid/records)
- **blink** (In Por #17, combate `CAST:0x05f3`): celda libre **aleatoria** adyacente
  (`COMBAT:0x120E` + `0x0000`) → **1 rand** de selección de celda; mueve al caster.
  (⚠ ESTE sí tira — va aquí como aviso: no es "sin RNG"; el rand de celda hay que
  clavarlo.)
- **invisibilitySelf** (Sanct Lor #36, `CAST:0x0afe`): `or [record+2],0x10` en el
  caster. **0 rand**.
- **revealInvisible** (Wis Quas #23, `CAST:0x074c`): loop records, `and [record],
  0xEF` (revela invisibles no-jugador) + redraw. **0 rand**.
- **poof** (An Ylem #5, `CAST:0x0230`): aim → si el tile apuntado es destruible
  (0x5B/0x90-93/0x9D/0xA5-A6/A8-A9/AD-AF) → `[bx]=0x44` (suelo) + "POOF!". **0 rand**.
- **disarmOrOpen** (An Sanct #6, `CAST:0x02d2`): combate → aim a cofre-trampa
  (0xB9/0xBB) `dec` o limpia bit de trampa `and [si+5],0x7F`. **0 rand**.
- **fieldWall** (In *Grav #14/15/16/20, `CAST:0x00EC` en combate): `g_cmb_weapon =
  COMBAT_WEAPON[arg]` (0x35/0x33/0x34/0x36) → `COMSUBS:0x0C52` SIEMBRA el campo en
  la celda apuntada. Reusa el motor de arma (como `combatAttack`) pero el "daño" es
  colocar el tile de campo (0xE8-0xEB) — el clon aún no tiene tiles de campo en la
  arena (aprox. consciente, combat.ts cabecera). Orden de RNG = el del arma; **a
  verificar** si el campo consume tirada.

### 8.5 Objetivo-PJ en combate (lote 6, curación)
heal (Mani `rand30`)/cure/awaken/resurrect: MISMO picker que overworld; Mani
consume **1 rand30**. En combate el picker es sobre el roster (como Set-Active).
Se difiere a lote 6.

**Resumen RNG-crítico del lote 5** (para el fixture, además del terremoto/línea):
charm 1·rand30; repelUndead/massFear 1·rand30/enemigo; polymorph rand30+spawn;
summonDaemon rand30+spawn; summon* spawn(s); blink 1·rand de celda. El resto 0.
Todos reusan `savingResist` (§5) salvo summonDaemon (contest directo, confirmar).

---

## 9. Formato del VEREDICTO de paridad — captura combat+spells (cierre de #44)

Plantilla citable para el cierre de #44 cuando la captura viva contra el oráculo
complete. Estado: **implementación 1-6 aterrizable; captura EN CURSO** (autopsia
2026-07-17: el (C)ast en combate DISPARA end-to-end en el binario real —snapshot +
teclas c,i,v,p,y consumidas—; pendiente el orden de tiradas del terremoto por dos
fixes de ARNÉS ya escritos: (1) patch del beep-rand de la sacudida kernel 0x3072 @
`0x30B4` `rand_range(19,150)` ×~58/shake; (2) sonda SS:SP para fijar el layout de
pila de la ruta CAST.OVL).

### 9.1 Orden ESPERADO (In Vas Por Ylem, [STATIC] §3) — a casar roll-a-roll

Pre-bucle: 1 sacudida (kernel 0x3072) — **cosmética, parcheada en la captura, NO
cuenta** en el stream de juego. Luego, barrido de slots **0→31 ascendente**; por
cada combatiente que sea ENEMIGO del bando opuesto y esté VIVO:

| paso | tirada | rango en la traza | condición |
|------|--------|-------------------|-----------|
| saving | `rand30()` | `(0,60)` (kernel 0x3ABE = rand0(60)/2) | siempre, por enemigo vivo |
| — | (resiste) | — | si `enemyINT > saving` → 0 daño, SIN 2ª tirada |
| daño | `rand_range(1,20)` | `(1,20)` | si NO resiste → `applyDamage` |

Slots vacíos / no-enemigos / muertos: **0 tiradas**. PJ: 0 tiradas.

### 9.2 Tabla a rellenar con la traza capturada (por slot)

Se compara la secuencia del oráculo (trace) contra la del port (combat-run.ts con
`castAction`), roll a roll, casando por semilla-antes-de-la-tirada + rango + HP:

| slot | kind | INT | saving (0,60) dosbox | resiste | daño (1,20) dosbox | hp→ dosbox | hp→ port | ✓/✗ |
|------|------|-----|----------------------|---------|--------------------|-----------|----------|-----|
| …    | enemy| …   | (pendiente captura)  | …       | …                  | …         | …        | …   |

Criterio de PASA: misma SECUENCIA de (lo,hi) por tirada + misma trayectoria de HP
por slot + misma semilla-antes. Divergencia → punto de ajuste = `castEarthquake`
(orden saving↔daño) o el conteo de la confusión de #42 (validación de paso).

### 9.3 Qué cierra este veredicto

- **[EMPÍRICO]** el orden `(0,60)→(1,20)` por enemigo del terremoto (hoy sólo
  [STATIC] + smoke del replay puro).
- De paso, el conteo de rand30 de la confusión de #42 (mismo escenario de combate).
- Los ⚠ del lote 5 (conteo de RNG de summon/blink, contest de polymorph/daemon)
  quedan como seguimiento aparte (no bloquean el cierre del terremoto).

### 9.4 VEREDICTO de la captura (2026-07-17) — [STATIC] + hallazgo rama (b)

6 iteraciones de captura viva contra el oráculo. Desenlace BINARIO en la 6ª
(instrumentada): **el terremoto NO se disparó por la coreografía de teclas**.
Evidencia (run-2f_ejc9v, snapshot seed=8D4F, 8 records):
- `[QUAKE?] enemy hp deltas = NINGUNO` — ningún enemigo perdió HP.
- 14 rolls capturados y CLASIFICADOS LIMPIOS, todos de IA enemiga:
  `rand(0,255) caller=B261` (COMBAT.OVL), `rand(0,3) caller=B2DD`,
  `rand(1,7) caller=B61C`. **CERO** rolls del terremoto (0xC8D2 saving (0,60) /
  0xC8F5 daño (1,20)).

Lo que SÍ se validó empíricamente (positivos del arnés — el método es sólido):
- El classifier con los sites CAST.OVL captura y clasifica bien (14 rolls con
  caller identificado); la sonda SS:SP confirmó la cadena `ret0=0x3ABA` (rand0).
- El patch del beep-rand del shake (kernel 0x3072 @0x30B4, rand_range(19,150)
  ×~58) SILENCIÓ la inundación — sin él la captura ni arrancaba.
- El (C)ast en combate DISPARA end-to-end (teclas c,i,v,p,y consumidas) — pero
  el turno pasó a los enemigos SIN lanzar el hechizo.

**Conclusión:** teclear c,i,v,p,y en el combate del binario NO castea In Vas Por
Ylem (el turno se consume en otra cosa). Es un HALLAZGO SEPARADO (rama b), no un
fallo del orden de tiradas: dos hipótesis a deslindar en ticket aparte — (i) hueco
de coreografía del arnés (otras teclas para castear en combate), o (ii) fidelidad
del lote 1 (¿el `c`→runas del port, calcado del doCast de overworld, coincide con
el flujo REAL de cast-en-combate del binario?).

**Cierre de #44:** el orden `(0,60)→(1,20)` por enemigo queda **[STATIC]** (asm §3)
+ **[EMPÍRICO-REPLAY]** (smoke puro de combat-run.ts, §fixture). La captura viva
vs oráculo se cierra como DEUDA documentada (esta §9.4) + ticket (b). Implementación
1-6 aterrizada y verde. Sin 7ª iteración (acuerdo con el lead).

### 9.5 CORRECCIÓN 2026-07-18 — el "[QUAKE?]=NINGUNO" era ARTEFACTO DEL ARNÉS

La rama (b) queda ADJUDICADA por captura viva (carril oráculo). El "el terremoto NO se
disparó" de §9.4 **NO era ni fidelidad del port ni el bit 0x80**: era un **bug de tecla del
arnés**. `re/tools/combat_parity.py:299` (`cast_spell_at_turn`) enviaba `send_key("RETURN")`,
pero el oráculo no tiene scancode `"RETURN"` (Enter = `"\n"` = 0x1c, `oracle.py` `SCANCODES`).
El submit del getstring rúnico NUNCA llegaba → el hechizo no se enviaba → los rolls del
terremoto no ocurrían. (Arreglado por el lead en main, commit `1ac9849`.)

Con Enter válido el (C)ast DISPARA: `g_spell_qty[30]` 9→8 (hechizo consumido), reproducido en
3 probes independientes. ⇒ **hipótesis (ii) [fidelidad del lote 1] RECHAZADA; causa = (i) bug
de tecla del arnés.** El flujo `c`→getstring rúnico del port NO está implicado.

Derivación completa del gate de (C)ast en combate (los 3 gates PRE-getstring + semántica del
bit 0x80 = party, con testigo de RAM) en `re/notes/combat-cast-gate-0x08F0.md` (cierra #68).

PENDIENTE para sellar `[EMPÍRICO]` la SECUENCIA `(0,60)→(1,20)`: una captura con escena de
varios enemigos vivos confirmados — v4 (BP `RAND_RANGE` + inyección de teclas) dio `fired=True`
pero 0 rolls en la escena sembrada de 1 enemigo (targetabilidad `0x5646` o timing del bucle,
sin concluir). El orden de tiradas sigue `[STATIC]`+`[EMPÍRICO-REPLAY]`.

⚠ Caveat del arnés de lectura: `parse_records()["hp"]` (byte +0 de `0xBA14`) es copia
estática de spawn, NO HP vivo (los PJ vivos leen 0). Para daño usar roster `0x55B8`.

---

## Correcciones #173 — el predicado LOS tiene DOS callers, no uno

Esta sección va **al final a propósito**: nombra overlays, y el sembrador de nombres de
`routine_census` hereda el fichero nombrado hacia ABAJO (ctx pegajoso, tarjeta #84). Puesta
aquí no hay líneas posteriores que re-atribuir, así que la corrección no mueve ninguna
semilla. Escribirla en su sitio original SÍ las movía — medido, no supuesto.

El predicado de opacidad a LOS del kernel (el que lee el bitmap `DS:0x6a14`) tiene **DOS**
sitios de llamada, no uno:

| caller | overlay |
|---|---|
| `0x1c28` | `CAST.OVL` |
| `0x142a` | `COMSUBS.OVL` |

Medido con `re/tools/callers_por_banda.py` en `99c07474`. La corrección **ya existía** en
`los-passability-audit.md` §58 y no se había perseguido hasta esta nota: es el patrón
«corrección escrita en una nota y no perseguida en sus hermanas», que es justo lo que #173
vino a barrer.
