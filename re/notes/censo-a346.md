# Censo docs-físicos — flecos A4 / A3 / A6 (derivación + spec, SIN cablear)

**Carril:** SCOUT · **Fecha:** 2026-07-18 · **Rama:** `re/censo-a346`. Verifica contra el
binario los tres flecos abiertos del censo (`docs/censo-docs-fisicos-port.md`). Formato B3/B4.
Autoridad = ASM (`re/disasm/`). Las specs vuelven al lead para doble-ojo antes de cablear.

---

## A4. Sand Trap — «oculta en la arena hasta adyacencia» → **NO-ES-HUECO (el manual adorna)**

- **Doc:** Book of Lore pág. 28 (`book-of-lore.md:559-563`): «burrowing in the sand… nearly
  impossible to notice, but a party passing too close is in for trouble».
- **Binario:** el Sand Trap es **defIndex 40 (0x28)** con `enemyFlags = [0,0] = 0x0000`. NO
  tiene el bit de **invisibilidad (0x0008)** ni ninguna otra habilidad. Los únicos enemigos
  con el bit de invisibilidad son Blackthorn (0x0E), Ghost (0x17) y Shadowlord (0x2F).
- **Descarto el mecanismo del Mimic:** el disfraz/oculto que derivé para el Mimic es el byte
  +6 del actor de combate puesto a 0/0x20, y la lógica que lo escribe es **type-específica**
  para Mimic (0x1A) y Corpser (0x2D) (COMBAT.OVL 0x0304/0x0327 revelan, 0x047A re-oculta). El
  tipo 0x28 (Sand Trap) **no aparece** en esa lógica ni en ningún init de +6 → nunca se oculta.
  (El hint del lead —«¿el spawner pone +6=0 a la Sand Trap?»— se resuelve NO: sólo Mimic/
  Corpser tocan +6.)
- **Port:** el Sand Trap es un encuentro de desierto normal, fuerte, siempre visible
  (`encounters.ts`). **Es FIEL:** el binario tampoco lo oculta.
- **Veredicto: NO-ES-HUECO.** «Casi imposible de detectar» es sabor del Book of Lore; el U5
  DOS no da al Sand Trap ninguna invisibilidad ni emboscada. El §A4 del censo debe pasar de
  «HUECO-feature» a **NO-ES-HUECO (fiel; el doc adorna)**.

---

## A3. Sword of Chaos — posesión del portador → **HUECO real (DIVERGE), el binario SÍ lo hace**

- **Doc:** clue book pág. 53 (`cluebook-paths-of-destiny.md:879-881`): al empuñarla, el
  portador ataca a sus aliados con fuerza descomunal hasta matarlos, luego se desmaya.
- **Binario — CONFIRMADO (COMBAT.OVL 0x063E, turno del jugador, 0x069A-06C4):**
  ```
  069a: cmp [si+0x55c3], 0x23   ; roster+0x1B = arma mano IZQUIERDA == chaos sword (0x23)
  069f: je  0x6a8
  06a1: cmp [si+0x55c4], 0x23   ; roster+0x1C = arma mano DERECHA
  06a6: jne 0x6c8               ; ninguna → turno normal
  06a8: or  byte [bx-0x45ea], 1 ; ← pone el FLAG 1 (poseído/charmed) al actor
  06b7: mov g_active_char, 0xff
  06bc: mov g_unk_a9fa, 1
  06c1: call 0x3f4 ; 06c4: jmp 0xb79   ; el turno lo lleva la IA (ataca al propio bando)
  ```
  El **flag 1** es el mismo «charmed/poseído (cambia de bando)» del registro (+2 bit 0x01,
  `combat.md:34`): con él, `sideOf` invierte el bando y el PJ ataca a su propia party. Es
  EXACTAMENTE la mecánica del clue-book. (El «desmayo final» = cuando ya no quedan aliados
  vivos, el objetivo de la IA se agota → cae en el flujo normal de fin; no hay un opcode de
  «faint» propio que derivar — es el estado terminal, no un mecanismo aparte. VERIFICAR con
  oráculo si se quiere el detalle exacto del desmayo.)
- **Port — NO lo implementa.** `formulas.ts:14` trata 0x23 sólo como arma mágica auto-hit
  (`weaponIsMagic`, `AUTO_HIT_WEAPONS`); el turno del jugador (`combat.ts`) NO chequea 0x23
  en las manos para poseer. El `possessCharm`/`charmed` de `combat.ts:1950` es habilidad **de
  enemigo** (daemon posee a un PJ), no del arma.
- **Veredicto: HUECO real (DIVERGE).** El binario posee al portador; el port no.
- **Spec de cableo (la infraestructura YA existe en el port):** al RESOLVER el turno de
  combate de un PJ, si su arma en mano izq **o** dcha == 0x23 → poner `combatant.charmed =
  true` y enrutar su turno a la IA (el mismo camino que un PJ poseído por daemon). El port ya
  tiene `charmed` + `sideOf` (`combat.ts:706-709`: charmed lucha para el bando contrario), así
  que reusa esa maquinaria — no hay que inventar el «ataca a aliados». Punto de cableo: el
  handler del turno del PJ activo (espejo de COMBAT.OVL 0x063E→0x069A). RNG: el chequeo no
  consume rand; la posesión sólo redirige el control. Cita: COMBAT.OVL 0x069A-06C4,
  `combat.md:253-254`.

---

## A6. Astronomía / catalejo → **la vista celeste EXISTE pero su cuerpo es opaco; la
predicción cometa→planeta→ciudad NO está verificada → spec INCOMPLETA, no fabricar**

- **Doc:** clue book pág. 55 (`cluebook-paths-of-destiny.md:895-905`): con catalejo/telescopio
  se observan 8 planetas + 3 cometas; un cometa cerca de un planeta indica qué ciudad ataca un
  Shadowlord (planeta↔virtud↔ciudad).
- **Binario — lo derivable:** el (U)se del catalejo (**CAST.OVL 0x1A3A**) gatea overworld/
  pueblo + noche y, de noche, **llama a `call 0xFFFFBF9A` (CAST.OVL 0x1A64)** = la vista
  celeste. O sea, **SÍ hay un render de vista celeste** (no es sólo mensaje).
- **Lo que NO sale limpio:** `0xFFFFBF9A` es una llamada CRUZANDO frontera de overlay (thunk).
  El bias `+0x81D0` que resuelve los `call 0xFFFFxxxx` de **MAINOUT** (memoria
  `mainout-ffff-call-bias`) NO aplica a **CAST.OVL** (otra base de carga): daría 0x416A, pero
  ese offset no tiene rutina en ULTIMA.EXE. Sin la base de carga de CAST no puedo resolver el
  cuerpo de 0xFFFFBF9A → **no sé si dibuja (a) sólo lunas/estrellas decorativas o (b) un
  indicador cometa→planeta.** Interpretarlo sería fabricar.
- **Contexto que pesa hacia «cosmético»:** `re/notes/content-audit.md:183,288` ya clasifica la
  «astronomía/cometa que predice qué ciudad ataca un SL» como **claim de internet NO
  verificada, sin derivación local, bajo impacto**. El *estado* de ubicación de los Shadowlords
  SÍ se modela (`state.shadowlordLocs`), pero no hay evidencia derivable de una UI de pista del
  astrónomo. El comentario del port (`game.ts:3666`) asume «lunas/estrellas… cosmética».
- **Veredicto: INDETERMINADO / probable cosmético.** El render existe pero su contenido no es
  derivable estáticamente aquí (thunk de overlay), y la predicción cometa→ciudad no está
  verificada en ninguna pasada. El port es OBSERVABLEMENTE fiel en gates+mensajes; sólo le
  falta el dibujo del starfield (cosmético). **NO cablear ni especificar un mecanismo de
  predicción sin evidencia.** Para cerrarlo hace falta UNA de:
  - (a) resolver `0xFFFFBF9A` con la base de carga real de CAST.OVL (o desensamblar el
    overlay destino) → ver qué lee (fase lunar/día vs tabla de cometas/planetas);
  - (b) testigo de oráculo: capturar el catalejo de noche en DOSBox y ver si aparecen
    cometas/planetas o sólo lunas/estrellas.
  El §A6 del censo debe reetiquetarse: «vista celeste existe (CAST 0x1A64), cuerpo opaco;
  predicción cometa→ciudad NO verificada; cosmético hasta derivar 0xFFFFBF9A u oráculo».

---

## Resumen para el lead

| Fleco | Veredicto | Acción |
|---|---|---|
| A4 Sand Trap | **NO-ES-HUECO** (flags 0x0000; sin invisibilidad; el +6 es Mimic/Corpser-only) | reetiquetar censo; nada que cablear |
| A3 Sword of Chaos | **HUECO real (DIVERGE)** — binario posee al portador (COMBAT 0x069A-06C4, flag 1) | spec de cableo lista (reusa `charmed`/`sideOf` del port); vuelve al lead para doble-ojo |
| A6 Astronomía | **INDETERMINADO / probable cosmético** — render existe (CAST 0x1A64→0xFFFFBF9A) pero cuerpo opaco (thunk); predicción cometa→ciudad NO verificada | NO fabricar; resolver 0xFFFFBF9A con base de CAST u oráculo |
