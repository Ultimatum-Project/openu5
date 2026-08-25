# Las gárgolas del Palacio ATACAN — la rama 'a' de npc_engine completa, con su tail

Carril `daemons-palacio` · 2026-08-23 · sobre main `1dfdc13b`. Origen: reporte del
usuario con captura (los «demonios» del Palacio le siguieron y le acorralaron hasta no
poder continuar — un softlock blando) + testigo en vídeo (jugando-es ep. 16
«Infiltrándonos en el castillo de Lord Blackthorn», ~8:25: las estatuas se animan,
persiguen, «Attacked! GARGOYLE *** CONFLICT ***», siete gárgolas en la arena, huida).

Convención de las actas hermanas: desplazamientos en la forma `FICHERO.OVL:0x…`;
nombres de rutina en backticks aislados.

**Veredicto en una línea:** el acorralamiento es FIEL (persecución aiType 6, derivada
en #52); el softlock NO LO ES — el binario resuelve todo acorralamiento con el ATAQUE
del hostil («\nAttacked!\n» + combate + ranura fuera, incondicional), y el port tiraba
esa rama entera por una lectura truncada de `npc_engine`. DEFECTO, corregido.

---

## §1 — La tabla de aiTypes, consolidada (entregable por sí solo)

Despachador `npc_ai_step` NPC.OVL:0x0D00, tabla en 0x0D9C (base de banda 0xA290,
acreditada por dos vías en `npc-aitype6-persigue.md` §2). Ocho entradas, cinco
destinos:

| aiType | handler | conducta | fuente |
|---:|---|---|---|
| 0 | `0x0DAC` | quieto (epílogo: nada) | npc-aitype6 §2 |
| 1 | `0x0D60` | wander radio Manhattan 3 del puesto | íd. |
| 2 | `0x0D38` | wander sin límite | íd. |
| 3 | `0x0D76` | gate dist<4 → `0x06E4` rama 0x082a: **HUIR** (exclusiva del 3) | npc-aitype6 §3 |
| 4 | `0x0D40` | gate dist<4 **al PUESTO** → acercarse; si no wander 3 (mercader) | npc-aitype4 §2 |
| 5 | `0x0D91` | `0x06E4` sin gate: acercarse + cola de erratismo (0 en fábrica) | npc-aitype57 |
| 6 | `0x0D76` | **mismo handler que el 3**, rama opuesta: gate dist<4 → **PERSEGUIR** | npc-aitype6 §3 |
| 7 | `0x0D91` | = 5: acercarse sin gate + erratismo | npc-aitype57 |

★ Matiz del gate del 6 que esta tanda fija LEYENDO EL CRUDO (`NPC.OVL:0x0d76-0x0d8f`):
los push son `g_party_x/g_party_y` y `[bx+2]/[bx+4]` con `bx` = el REGISTRO VIVO
(0x5F5E+idx·16) — la distancia se mide a la **posición viva** del NPC, no a su puesto
(a diferencia del 4, que en `0x0d50/0x0d54` lee `[si+3]/[si+6]` del horario). ⇒ la
«estatua» despierta cuando el party entra a Manhattan <4 **de ella**, y sigue
persiguiendo mientras lo tenga a <4; si el party se aleja, se para donde esté (no hay
rama de retorno al puesto). Ésa es toda la «animación» del vídeo — no hay gatillo
aparte de hora ni de proximidad a la Corona.

Y a distancia **1** el fast-path (`NPC.OVL:0x0723-0x074e`, #301) corta ANTES de mover:
aiType 4/5 con dlgNum≠0 → marcador `[0x65be]='t'` 0x74; **aiType ≥6 → marcador 'a'
0x61 SIN mirar dlgNum** (0x07be); ambos `[0x65bf]=idx` — el último adyacente en orden
de slot PISA (gana el slot mayor).

## §2 — El consumidor: la rama 'a' de `npc_engine` ENTERA (lo que faltaba)

`TOWN.OVL:0x1352`, gate 0x1671 (`[0x65bf]≠0 ∨ result==2`). Con marcador 0x61
(transcrito completo del crudo, 0x1379-0x1414):

```
1379: cmp [0x65be],0x61 ; jne 0x13b4        ; no-'a' → rama de TALK (ya derivada)
1380-1390: dlgNum==0xFE → 0x1392            ; POSEÍDO de Astaroth:
   1392: push 0xa ; call K 0x94ea (= CS 0x16ba) ; (presentación, no adjudicada)
   1399: push idx ; call 0x10da             ;   town_possessed_npc_attack:
                                            ;   print DS 0x278a «"Begone,\nvermin!"»
                                            ;   + call 0x8d4(self) ⇒ dlg 0xFD + ai [3,3,3]
13a4: bx=[bp-4] ; cmp byte [bx],0x70        ; ¿actor GUARDIA?
13aa: je 0x13d6                             ;   sí → call 0x12ae (arresto/captura)
13ac: mov word [bp-2],1 ; jmp 0x13dc        ;   NO → ★ EL ELSE QUE EL PORT TIRABA
13d6: call 0x12ae ; mov [bp-2],ax           ; y su RETORNO cae en el mismo tail
13dc: cmp [bp-2],0 ; je ret                 ; tail común:
13ec-13f9: bx=[rt+0xC]*8 ; cmp [bx+0x5c5a],0x40 ; jb 0x140e
13fb: mov ax,0x2881 ; call print            ; «\nAttacked!\n» (DS 0x2881, CON su \n)
1402: push [0x65bf] ; call 0x9bc            ; town_attack_engine_commit
140e: push [0x65bf] ; call 0xb0             ; actor <0x40: npc_clear_slot a secas
```

`town_attack_engine_commit` (`TOWN.OVL:0x09BC`, cuerpo entero en
`asm-town-zstats-acta.md` §2 — 17 instrucciones, SIN UNA RAMA):
`npc_dead_bit_set(idx)` (0x0052) → `enter_combat_vs_actor([rt+0xC]·8+0x5C5A)`
(ULTIMA.EXE 0x6150) → `npc_clear_slot(idx)` (0x00B0) → `town_load_map_chunk(0)` →
`town_place_shadowlord()`.

★★ **El commit es incondicional**: el dead-bit se marca ANTES del combate y la ranura
se vacía DESPUÉS **sin mirar el desenlace** — ganar Y huir dejan al hostil FUERA del
mapa (hasta recargar el .NPC re-entrando). Ésa es la válvula anti-encajonamiento de
1988: cada gárgola sólo puede acorralarte una vez. El «solo puede huirse» del usuario
sobre el vídeo es una salida REAL, y no la única.

Y `0x12ae` (transcrito entero): loc==0x12 → captura de Blackthorn, **ret 0**; fuera,
'Y' → celda de Yew, **ret 0**; **'N' («Then defend thyself, rogue!») → alarma 0x958 →
ret 1** (0x1346) ⇒ el tail ataca con el MISMO guardia ([0x65bf] intacto): combate
contra GUARD — def 12, y `combat_spawn_encounter` (K 0x6bc2) da **8 exactos** (la
excepción de pueblo `cmp [bp+4],0xc` 0x6c6b + maxPerMap 8). La famosa pelea de los 8
guardias también colgaba de este else.

## §3 — La entrada a combate y la MULTIPLICACIÓN del vídeo

`enter_combat_vs_actor` (ULTIMA.EXE:0x6150, `kernel-turno-acta.md` §2): anuncia el
nombre del catálogo DS 0x18b6 indexado por `(tile-0x40)/4` — gárgola 0xB8 → **30
«GARGOYLE»**, daemon 0xD8 → 38, rata 0x90 → 20, guardia 0x70 → 12 — y elige arena por
el switch §2b sobre el TERRENO BAJO EL ACTOR: el suelo de interior 0x44 tiene fila
propia (**8 Brick**) y el resto-en-pueblo también cae a 8 ⇒ la arena de ladrillo de
las capturas. Portado como `arenaForActorAttack` (encounters.ts, las 15 filas).

La secuencia de pantalla del vídeo cuadra pieza a pieza (fotogramas extraídos del
fichero local `original/av-referencia/yt/jugando-es/18-…[16] - Infiltrandonos.mkv`,
gitignored — los timestamps son la cita):

| t | pantalla | mecanismo |
|---|---|---|
| 8:30 | las dos estatuas EN las almenas, flanqueando la escalera (13,18)/(17,18), party al sur | aiType 6 con party a ≥4 |
| 8:34 | una gárgola FUERA de su puesto, acercándose sobre el ladrillo | «se anima»: gate <4 de `0x0d76` (posición viva) |
| 8:38 | «Attacked! / GARGOYLE / *** CONFLICT ***» con **UNA** gárgola en la arena de ladrillo | DS 0x2881 (0x13fb, CON \n de cabecera ≠ 0x2882 del sobremundo) + catálogo de 0x6150 + banner K 0x6bc2 (DS 0xa438); count=1: regla de pueblo de 0x6c5d **y además** maxPerMap=1; arena Brick = §2b |
| 8:43 | **«Gargoyle divides!»** + «Gargoyle barely wounded!» | divideOnHit — el golpe que no mata DIVIDE; el mensaje LITERAL que el port ya emite (combat.ts «{} divides!») |
| 9:20 | **SIETE** gárgolas («Gargoyle divides! / Gargoyle heavily wounded!») | la multiplicación es TODA de combate: enemyFlags[30]=[144,0] → 0x9000 = bludgeons+divide (máscara §1.9) |
| después | el grupo escapa por el borde | salida fiel; y la gárgola YA no está en el mapa (commit incondicional) |

⚠ La cifra «count=1» está **doblemente determinada** para la gárgola (regla de pueblo
y maxPerMap=1): con estos defs un mutante que borre `inTown` no es matable desde aquí —
la regla la ejercen los tests de careo-combate T4, y se declara en vez de fingir
cobertura.

## §4 — El censo de la CLASE: todos los NPC de tile-monstruo y qué les pasa

Sobre `game/assets/npcs.json` (= los .NPC de fábrica), todo slot con type fuera de
[0x40,0x74) y ≠0 (más los especiales), con su conducta derivada:

| loc | NPCs | ai | binario | port ANTES del fix |
|---|---|---|---|---|
| 4 Yew | 3× rata 0x90 (cárcel, z=255) | 6,6,6 | persiguen a <4 y ATACAN adyacentes | perseguían sin dientes |
| 7 Skara Brae | 5× murciélago 0x94 | 6,6,6 | íd. | íd. |
| 13 Iolo's Hut | 3× rata 0x90 | 6,6,6 | íd. | íd. |
| 15 Sin'Vraal | 1× daemon 0xD8, dlg 11 | 1,0,1 | **wander: JAMÁS arma** (ai≤3) — el daemon amistoso | fiel |
| 16 Grendel | 1× rata 0x90, dlg 12 | 2,2,2 | wander: jamás arma | fiel |
| 18 Palacio | 2× daemon 0xD8 (slots 6-7) | 0,0,0 | **quietos** (tránsito de horario z 2↔3 a las 7/13/15) — BLOQUEAN, no persiguen | fiel (bloqueo) |
| 18 Palacio | 2× gárgola 0xB8 (slots 17-18, z=3) | 6,6,6 | persiguen + ATACAN (la escena del vídeo) | **softlock** |
| 28 Windemere | 7× rata 0x90 | 7,7,7 | acercarse SIN gate + erratismo + atacan | perseguían sin dientes |
| 28 Windemere | 2× daemon 0xD8 | 0,0,0 | bloqueo | fiel |
| 29 Stonegate | 3× tile-SL 0xFC | 0,0,0 | quietos | fiel |
| 29 Stonegate | 1× daemon 0xD8, dlg 10 | 4,4,4 | mercader-ai: intercepta y CORRE SU TLK (#301) | ya cableado |
| 29 Stonegate | 4× murciélago 0x94 | 7,7,7 | como Windemere | sin dientes |
| — poseídos de Astaroth | persona, dlg 0xFE | 7 | «Begone, vermin!» + auto-degradación a 0xFD/[3,3,3] (`0x10da`) | tirado |

⇒ la clase del defecto no era «los daemons del Palacio»: era **todo hostil no-guardia
adyacente** (13 NPC de fábrica en 6 localizaciones, más los poseídos dinámicos y el
guardia rehusado). Y los dos discriminantes que el censo deja probados: **el tile de
monstruo NO decide nada — decide el aiType** (Sin'Vraal es un daemon que pasea), y
**ai 0 es bloqueo fiel** (los daemons del reporte original bloquean también en 1988;
la diferencia es que en 1988 sus vecinas las gárgolas te sacaban del encajonamiento
por la vía del combate, y el port no tenía esa vía).

## §5 — El careo con el port: qué faltaba, y el fix

| pieza del binario | port ANTES | port DESPUÉS |
|---|---|---|
| persecución ai 6/7 | ✅ (#52/#78) | = |
| marcador 'a' + [0x65bf] | ✅ (`checkGuardTribute`) | = |
| 'a' + tile 0x70 → arresto/captura | ✅ | = (+ slot en el prompt) |
| **'a' + no-guardia ≥0x40 → «Attacked!» + combate + ranura fuera** | ❌ `return null` | ✅ `hostileNpcAttack` (game.ts) |
| 'a' + dlg 0xFE → Begone vermin + degradación | ❌ tirado | ✅ |
| 'a' + actor <0x40 → clear a secas | ❌ | ✅ (inalcanzable en fábrica; por forma) |
| npc_engine EN loc 18 | ❌ cortado entero | ✅ (el gate real vive en 0x12ae) |
| arresto 'N' → ret 1 → combate vs 8 GUARDS | ❌ solo alarma | ✅ |
| arena §2b de 0x6150 | ❌ (habría caído en `combatMapForTile`, Clase D) | ✅ `arenaForActorAttack` |
| divideOnHit de la gárgola | ✅ (combat.ts, flag 0x1000) | = |
| ataque player-initiated (TOWN 0x09e6 → 0x0b3a → 0x9bc, karma 0xbd66, ~~invocación~~ flash 0xb352) | ❌ Clase C | ~~❌ **sigue Clase C** — pieza aparte, la derivación ya está toda a mano~~ ✅ **CABLEADO** (carril gargolas-residuales, §8: `Game.attack` rama pueblo — mismo commit 0x09BC SIN pre-línea 0x2881, karma clampado, alarma, Murdered!/Missed!, dead-bit con gate) |

Reproducción MEDIDA (playwright, worktree, azotea z=3, deep-link):
- ANTES: party (15,19), gárgolas cierran a (14,19)/(16,19) — adyacentes ambos flancos —
  y 6 turnos de Pass sin NINGÚN evento; (A)tacar = «Nothing to attack!». Softlock
  reproducido, réplica exacta de la escena del usuario.
- DESPUÉS: al quedar adyacente, «\nAttacked!\n» + GARGOYLE + *** CONFLICT *** + arena
  Brick con UNA gárgola y la party en formación sur; la ranura 18 desaparece del mapa.

Testigo ejecutable: `game/tests/npc-hostil-ataca.test.ts` — 10 casos con esperados EN
CRUDO («GARGOYLE» centrado a 4 espacios, «GUARDS» a 5, def 30 = (0xB8-0x40)/4,
enemyFlags[30]=[144,0], 8 guardias exactos, filas del switch §2b) + los controles
negativos del censo (daemon ai 0 bloquea, Sin'Vraal ai 1 no arma, actor <0x40 sin
mensaje). Mutantes, predicción escrita antes de correr: M1 «todo hostil→arresto»
MUERTO · M2 sin clear MUERTO · M4 sin pre-línea MUERTO (⚠ el primer intento
SOBREVIVIÓ porque el sed no había casado — el control de «mutante aplicado» lo cazó;
un mutante que no enrojece se re-verifica como instrumento) · M5 defIndex sin −0x40
MUERTO · M6 sin rama 0xFE MUERTO · M7 'N' sin tail MUERTO · M8 default Glade MUERTO ·
M3 sin `inTown` SOBREVIVE COMO PREDICHO (§3, doble determinación — fuera del diff).

## §6 — Por qué se nos pasó (root-cause, con las citas)

1. **La lectura truncada**: `blackthorn.md` §2.1a transcribió la «RAMA 0x61» hasta el
   `je 0x13d6` y presentó ese salto como el final («→ ¿objeto guardia? → captura»);
   el else 0x13ac y el tail 0x13dc-0x1414 no aparecen en el acta. El port
   (`guard-encounters.ts`) copió esa lectura como gate: «Exige además tile de
   guardia… `return null`». Un `je` leído como precondición de la rama entera.
   Tachado-documentado en las dos partes.
2. **La adjudicación que disolvía la premisa ya estaba en el corpus y nadie re-censó
   a sus consumidores**: #201 (`shadowlord-residuos-acta.md` §1) estableció que
   `0x09BC` es la ENTRADA A COMBATE URBANO con sus dos llamadores (0x0b3a el jugador,
   0x1408 el NPC — precedido de «\nAttacked!\n»), y `kernel-turno-acta.md` §2 selló
   `0x6150` con su regla de arena. La declaración Clase C del port («no hay
   entidad-combate en pueblo», game.ts `attack()`) y el `return null` de
   guard-encounters quedaron VIVOS apuntando a la premisa vieja. Es la clase de
   [[el-aserto-de-ausencia-caduca-cuando-aterriza-un-escritor-legitimo]] aplicada a
   una divergencia declarada: **una Clase C también caduca, y nadie tenía el censo de
   sus citas**.
3. **La tercera señal ignorada**: `shadowlord-urban.md` §3.2 ya había derivado el
   ataque del poseído (0x138a→0x10da) y lo aparcó en la misma Clase C.

Lo que lo habría cazado antes: tratar cada «Clase C / no se modela» como un aserto de
ausencia CON DUEÑO, re-censable cuando una adjudicación nueva toque su premisa (aquí:
la re-etiqueta de 0x09BC en #201 debió disparar el grep de sus consumidores).

## §7 — Lo que esta acta NO hace

- ~~No cablea el ataque player-initiated (TOWN 0x09e6: karma −5 0xbd66 + invocación de
  guardias 0xb352 + el mismo 0x09BC) — pieza aparte declarada en `attack()`.~~
  [CERRADO 23-08, carril gargolas-residuales: §8.1 — cableado entero; y «invocación de
  guardias 0xb352» era una adjudicación ERRADA: K 0xb352 = CS 0x3522 es el FLASH
  audiovisual del golpe, no spawnea nada (§8.1c).]
- ~~No cablea la vía (T)alk del poseído 0xFE (TALK 0x03cc → K 0xbb02 = CS 0x7a82 →
  TOWN.OVL:0x10da).~~ [CERRADO 23-08: §8.2 — la vía emite DS 0x278a byte-exacto; la
  degradación por esta vía NO existe en el binario (argumento sin inicializar, §8.2).]
- ~~No persiste el dead-bit en el save (el binario lo lleva en SAVED.GAM; el port
  revive al re-entrar Y al save/load en mapa — declarado en `clearSlot`, va con la
  discusión del .GAM nativo #227/#238).~~ [CERRADO 23-08 POR REFUTACIÓN PARCIAL: §8.3 —
  el gate de TOWN 0x52 niega el bit a los monstruos (el revive del port era FIEL); la
  mitad persona queda cableada (`townNpcDeadBitSet` → npcDead nativo); residuo acotado:
  save in-town tras un clear (ficha, §8.3).]
- No adjudica `K 0x94ea(0xa)` (= CS 0x16ba) ni `K 0xa8d8` (= CS 0x2aa8) —
  presentación del golpe del poseído.
- No mide el orden binario captura-vs-gárgola cuando AMBOS son adyacentes (slot mayor
  pisa; en el port la captura corre antes) — inalcanzable en fábrica: los palace
  guards no pisan z=3 y las gárgolas no bajan de ella (gate <4 y puesto fijo).

## §8 — Residuales cerrados (carril gargolas-residuales, 23-08)

Los cuatro residuales del reporte de este acta, cada uno con su crudo. Testigos:
`game/tests/npc-hostil-ataca.test.ts` (describes «(A)ttack del jugador» y «(T)alk al
poseído», 4 mutantes muertos con predicción escrita).

### §8.1 — El (A)ttack del jugador en pueblo (TOWN 0x09e6, cuerpo 0x09e6-0x0b80)

Transcrito entero (los literales, de DATA.OVL fileoff = DS+0x10):

```
09f2: print DS 0x26e0 "Attack-"
09f9-0a0b: tile del MAPA bajo la party (K 0xc232 = CS 0x4402 get_tile_ptr) < 4 (agua)
           ∧ transport ≠ 0x1c
           → print DS 0x26e8 "On foot!\n", [bp-4]=0 (SIN turno), exit   ; attackContext
0a24: call 0xffffb41c getdir (en banda TOWN cae en CS 0x35ec; el crudo no resuelve
      único entre overlays); cancel → exit ([bp-4]=1)
0a4f-0a8a: mapa[objetivo]==0x9d espejo → rama de #217 (ya derivada/portada)
0a8e-0a9d: K 0xb4be(tx,ty,floor) (= CS 0x368e actor-at-position) → ax=TILE del actor,
           [0x5876]=número de actor; TOWN 0x011e → slot (o −1)
0aa5-0ad3: ATACABLE ⟺ tile≠0 ∧ tile≥0x40 ∧ tile∉[0xe8,0xf0) ∧ (tile&0xfc)≠0xb4
           ; exclusiones = defs 42/43 'x' (no-actores) y cañones (def 29 'x')
0ad8-0ae5: no atacable → print DS 0x26fb "Nothing to attack!\n", exit
0ae8-0b05: tile<0x80 → K 0xbd66(0x5888,5) karma−5 CLAMPADO (CS 0x3f36: ≤5→0)
           + call 0x958 alarma; (tile&0xfc)==0xd8 → SOLO alarma; resto: nada
0b08-0b29: TILE DE MAPA bajo el objetivo (K 0xc232 = CS 0x4402, ¡el MAPA, no el
           actor!) ∈ {0x84 Stocks, 0x85 Manacles, 0x9f MirrorBroken, 0xab LeftBed}
           → INDEFENSO:
   0b40: actor==0x78 (BLACKTHORN: catálogo (0x78−0x40)/4=14 "BLACKTHORN", atlas
         0x178 "Blackthorn1") → print DS 0x270f "Missed!\n", exit — inmatable
   0b4c: print DS 0x2718 "Murdered!\n" + SEGUNDO K 0xbd66 −5 (CS 0x3f36;
         incondicional: una persona indefensa cuesta −10) + K 0xb352 (= CS 0x3522,
         flash AV) + dead-bit 0x52 + clear 0xb0 — SIN combate
0b2b-0b3a: no indefenso, slot≥0 → dead-bit 0x52 + call 0x9bc (EL MISMO
           town_attack_engine_commit de la vía NPC) — SIN pre-línea 0x2881
           (DS 0x2881 "\nAttacked!\n" sólo lo imprime npc_engine 0x13fb)
0b79: exit, ret [bp-4]  ; =1 en todo salvo "On foot!" → también "Nothing to
      attack!" consume turno en pueblo (≠ overworld)
```

- (a) **Mismo tail que la vía NPC**: sí — 0x0b3a llama al MISMO 0x09BC (dead-bit →
  K 0xdf80 combate (= CS 0x6150 `enter_combat_vs_actor`, la adjudicación de #201) →
  clear), y por tanto misma arena por catálogo (`arenaForActorAttack`)
  y misma regla de grupo. La única diferencia observable es la pre-línea 0x2881, que es
  del LLAMADOR npc_engine. Port: `Game.townAttackCommit` compartido por
  `hostileNpcAttack` (con pre-línea) y `attack` (sin ella).
- (b) **La fila vieja de deliberate-divergences leía los tiles al revés**: decía
  «imprime "Murdered!" al golpear un guardia (tiles 0x84/0x85/0x9f/0xab)». FALSO en los
  dos espacios de tiles: 0x0b08 lee por K 0xc232 (= CS 0x4402 get_tile_ptr) = puntero de MAPA (la misma rutina del
  check de agua 0x09f9 y del espejo 0x0a4f), y {0x84,0x85,0x9f,0xab} son Stocks,
  Manacles, MirrorBroken y LeftBed (TileData; en el atlas de actores 0x184/0x185 son
  Squid — tampoco guardias). Es la mecánica del ASESINATO del indefenso (cepo/grilletes/
  cama), no una rama de guardias. ⚠ 0x9f (espejo roto) en el set es crudo verbatim; la
  hipótesis (persona sobre el espejo que acabas de romper) queda SIN adjudicar.
- (c) **«Invoca guardias (0xb352)» era una adjudicación errada**: K 0xb352 → CS 0x3522
  (conversión por banda TOWN base 0x81d0, control positivo: 0x94ea→0x16ba del §2
  reproduce con `dispatch_table.py`). Cuerpo (ULTIMA.EXE.asm 0x3522-0x3561): mundo→
  pantalla restando `party−5` (centro del viewport 11×11), `call 0x10e0` = el BLITTER
  de tile (kernel-sweep-2 §3, tanda14) con **tile 0** sobre la celda del golpeado,
  tono 0x223c(0x7d0,0xbb8,0xa) y tick 0x5910. Es el FLASH AV del golpe. Los guardias
  del ataque a una persona vienen de la ALARMA 0x958 (que ya estaba portada:
  `arrestAlarm`). Port: flash = Clase C presentación (declarado en `attack()`).
- (d) **Dead-bit CON SU GATE** — ver §8.3.
- Karma: CS 0x3f36 transcrito — `cmp [stat],amount; jbe → 0; sino sub` ⇒ −5 clampado
  (5→0, 4→0). El port lo calca (`karma > 5 ? karma−5 : 0`, mismo gesto que fireCannon).

### §8.2 — La vía (T)alk del poseído 0xFE: el argumento NO EXISTE

La adjudicación del salto es SÓLIDA y coincide con `overlay-load-layout.md`:155:
TALK 0x03d3 `call 0xffffbb02` → (0xbb02+0xbf80)&0xffff = CS 0x7a82 = far-stub
(`dispatch_table.stubs()[0x7a82]` → TOWN.OVL entry_file_off 0x10DA) =
`town_possessed_npc_attack`: print DS 0x278a `"Begone,\nvermin!"\n` + K 0xa8d8
(= CS 0x2aa8, presentación sin adjudicar — la misma del §7) + `call 0x8d4([bp+4])`.

**Pero TALK no le pasa argumento** (compárese npc_engine 0x1399: `push idx; call
0x10da`): en 0x03d3 no hay push, así que `[bp+4]` de 0x10da = la palabra en lo alto de
la pila del llamador = **el `si` salvado por el prólogo de `talk_converse_dispatch`
0x031e** (push bp · sub sp,6 · push si; nada más se apila entre 0x0324 y 0x03d3 — cada
`push/call 0x573a` se limpia con su `ret 2`). El `ret 2` de 0x10da desbalancea la pila
y el epílogo de 0x031e la rescata con `mov sp,bp` (0x0415). Ese `si` es un registro
muerto del bucle de comandos del kernel (0x31ee..0x33f9: CERO instrucciones sobre si;
⚠ HIPÓTESIS de valor: si=0xb3 del tramo 0x312a/0x3171 — fuera de la tabla de 32
slots), NO el slot del NPC hablado (que TALK guarda en [0xbcdc] y aquí no lee). Bug de
argumento sin inicializar de 1988: la degradación por (T)alk aterriza en un índice
basura, con los gates de 0x8d4 (tile[idx]∈[0x40,0x74) ∧ (dlg==0xFE ∨ schedule≠0))
leyendo memoria ajena a los NPC.

⇒ El observable del binario sobre el NPC HABLADO: la frase, y sigue 0xFE (volverá a
atacar). El port emite DS 0x278a byte-exacto (CON su `\n` final) y NO degrada — la
degradación real corre por la vía de intercepción (npc_engine, argumento bien pasado),
ya cableada. Calcar la basura de pila es imposible por construcción (el valor es un
residuo de runtime, no una función del estado); la elección queda declarada aquí y en
el docstring de `tryTalkPossessed`. De paso, la rama 0xFD (TALK 0x03a6) emite
`"` + DS 0x9176 + `"` + `\n` — el cierre y el salto son del putchar 0x573a: el port
ahora los incluye (antes recortaba el `\n` final en 0xFD y 0xFE).

### §8.3 — El dead-bit: el gate de TOWN 0x52 cierra el residual por refutación

`npc_dead_bit_set` 0x52 transcrito: gate 0≤idx≤0x1f; `fam = tile[idx]&0xfc`;
**marca ⟺ (fam<0x80 ∧ fam≠0x70) ∨ fam==0xb4** (0x0073-0x0082: el `je 0x7d` de 0x70
cae en `cmp 0xb4/jne ret`). El bit va a `[0x5b56+loc·4]` (32 bits/loc) — que ES
`state.npcDead` = SAVED.GAM file 0x5B4 (`saveNative.NPC_DEAD_OFFSET`; base DS 0x5b5a
para loc 1, coherente con el alias doomBits de CAST 0x171d). Consecuencias:

- **Monstruos y guardias NUNCA reciben bit** ⇒ en el binario la gárgola armada
  también revive al recargar el .NPC. El «revive al re-entrar» del port era FIEL;
  el residual se cierra por refutación de su premisa («el binario lo persiste»).
- **Personas sí** ⇒ la mitad que faltaba entra con §8.1: `Game.townNpcDeadBitSet`
  escribe `npcDead`, que ya viaja nativo en el .GAM y que `NpcManager.enterMap` ya
  filtra (la infraestructura era pre-existente: prisioneros de Yew, cañonazos).
- ~~**Residuo ACOTADO (ficha, no pieza)**: save DENTRO del pueblo tras un clear de
  monstruo → load: el port lo revive antes de hora (el binario conserva la tabla viva
  0x5F5E.. dentro de la ventana del .GAM y el slot sigue vacío hasta re-entrar).
  Alcance mínimo (monstruo ya-armado + save in situ + load); va con #227/#238.
  Declarado en `clearSlot` (manager.ts).~~ **CERRADO (24-08, carril save-residuos)**:
  la premisa se confirmó en crudo — `npc_clear_slot` TOWN 0x00B0 escribe TODO dentro
  de la ventana persistida 0x55A6..0x6605 (vivo `[si+0x5F5E]=0` 0x00d3-0x00e3 ·
  horario 0x5D5E..+2 0x00fd-0x0105 · flag 0x659E 0x010c · registro-objeto 0x5C5A
  0x00e7-0x00f9) y la carga restaura la ventana verbatim sin releer el .NPC. Fix en
  el port: `clearSlot` sincroniza `state.npcWalk` INMEDIATAMENTE (no al tick) y el
  overlay de restore de `enterMap` DESCARTA los runtimes ausentes de npcWalk (el
  espejo completo de la lista viva). Testigos: `npc-clear-slot-save.test.ts`
  (sync inmediato · load in situ sin revivir · re-entrada revive [control positivo] ·
  compat save viejo sin npcWalk).

### §8.4 — La key es.json

La variante emitida por 0x10da lleva `\n` final (DS 0x278a completo) y es.json sólo
traía la key sin él (el mensaje salía en EN bajo lang=es). Cerrado moviendo las DOS
entradas del poseído a sus formas byte-exactas (`"Begone,\nvermin!"\n` y
`"Don't hurt me!\nPlease go away!"\n`) y añadiendo `Missed!\n` / `Murdered!\n` para
§8.1. El lookup de `t()` es por key exacta (i18n/index.ts), de ahí que el `\n` final
forme parte de la key.
