# TICKETS del careo yt-witness (F1/F3) — discrepancias LP vs port

Registro de discrepancias detectadas por el corpus de vídeo-testigos. Cada ticket:
evidencia del LP + verificación contra binario + estado del port + fix propuesto.
NADIE cambia código desde un vídeo sin pasar por la verificación de binario.

## TICKET-001 — ✅ RESUELTO (main e719fb4c) — Peaje: prefijo «Caught!» + doble salto restaurados

- **Evidencia LP**: aulddragon P02 25:55-27:05 (clips/peaje-troll/, OCR verificado):
  «Caught! / The trolls demand a 24 gp toll! / Dost thou pay?Y».
- **Binario (VERIFICADO)**: DATA.OVL 0x6b3c = `Caught!\n\nThe trolls demand a ` +
  `` gp toll!\n\nDost thou pay?`` — «Caught!» es prefijo del MISMO bloque, y entre
  «toll!» y «Dost» hay `\n\n`, no espacio.
- **Port (main.ts:935)**: emite `The trolls demand a ${toll} gp toll! Dost thou pay?`
  — FALTA `Caught!\n\n` y aplana `\n\n`→espacio.
- **Dato curioso**: es.json:2779 YA tiene la key fiel parcial `"Caught!\n\nThe trolls demand a "`
  (del censo i18n barrido-desde-datos) mientras es.json:2114 tiene la aplanada en uso.
- **Fix propuesto**: main.ts → literal fiel `Caught!\n\nThe trolls demand a ${e.toll} gp toll!\n\nDost thou pay?`
  + es.json: key de plantilla nueva normalizada (¡OJO trampa del entrecomillado/plantillas —
  verificar el choke con lang=ES en vivo!) + retirar la key aplanada. Los e2e (prompts.spec.ts
  87/105) usan regex sin anclar el prefijo → sobreviven.
- **Observación abierta del clip** (no resuelta): el G: del panel parece no bajar tras pagar
  (¿muestreo a 2fps o deducción por-personaje? El port deduce del pool `state.gold` — carear
  con clip a más fps o segundo testigo antes de dudar del port).
- **Estado**: PENDIENTE de fix (candidato: mini-batch i18n/fidelidad, post-latch).

## CONFIRMACIÓN-001 — Arresto por tributo sin oro (Alex Diener Ep3 27:05, 720p)

Clip: «A guard demands a 20 gp tribute to Blackthorn! → Yes con G:11 → Thou art under
arrest! / Wilt thou come quietly?». **El port ES FIEL**: blackthorn.ts:532 — Yes con
oro<tributo → NO cobra → ret 1 (ruta de escalada) → arresto. El «acepta Yes y arresta
igual» del LP es exactamente nuestro camino no-puede-pagar (TALK 0x01e2). Tributo
por-miembro (countLiving×TRIBUTE_PER_MEMBER) consistente con 20gp. Testigo del ítem #4b
(secuencia de arresto) PARCIALMENTE cubierto — queda la escena post-arresto (celda).

## CAREOS PENDIENTES del lote F1 (rutar a mini-batch)

- **healer-resurrect** (P08 18:05): plantilla «raise this unfortunate person from the dead
  for N gold. Wilt thou pay?» con N VARIABLE (249/155 observados) → carear fórmula de
  precio del port + strings del flujo Cure/Heal/Resurrect.
- **shoppe ↕ (#31 RESUELTO por testigo)**: «Buccaneers Booty» P05 24:55 muestra el panel
  Arms DESPLAZABLE (banda ↕ con >5 ítems) → ES el testigo que esperaba la bancada
  Clase-C de list_wares 0x0c80 (rama 9ad1c5cf) → programar des-bancado + careo visual.
- **shrine-meditation** (P09 32:18): flujo completo virtue→mantra×3→ordained→sacred Quest
  → carear strings + beats del port (ítem #4-meditación cubierto como testigo de flujo).

## TICKET-002 — ✅ RESUELTO (main e719fb4c) — Healer: forma completa + atribución says-$ restauradas (vía SHOP_UI, espejo+guardas verdes)

- **Evidencia LP** (P08 18:05, OCR): «We have powers to Cure, Heal, or Resurrect.»
- **Port** (cmd-strings.ts:230): emite el ACORTADO «Cure, Heal, or Resurrect?» (marcado `[C]`
  como acortamiento intencional).
- **VERIFICADO A BYTE (lead)**: DATA.OVL **0x80bb** = `"We have powers to Cure, Heal, or Resurrect."\n` — COMILLAS DENTRO del literal (¡trampa del entrecomillado i18n: key con \"…\"!) y seguido de `says $.` (estructura: cita + atribución). El acortado `[C]` de cmd-strings.ts:230 NO tiene ruling que lo cubra (el lote 19571721 era ES-ancho-fijo) → **FIRME: restaurar la forma completa con comillas + says-$ + wrap**. Fix al mini-batch de fidelidad junto a TICKET-001.
- Metodología F3 v2 aplicada: de los 5 careos iniciales → 1 (a) emitida-exacta (shrine
  virtue-prompt, main.ts:978), 2 (b) divergentes (peaje TICKET-001, este), 3 NECESITA-TRACE
  (resurrect-cost, arrest-ensamblado con \n duro es.json:4614, quest-ordained).

## TICKET-003 — ✅ RESUELTO (lead, 2026-07-22) — Ceremonia del shrine = INTERROGATORIO

**IMPLEMENTADO tras la re-derivación de abajo** (gate: tsc 0 + unit 2582/2582 + shrines e2e
7/7 + prompts 6/6): la visita a santuario VIVO ahora es kneel (MISCMSG 0x718) →
`shrine-visit-prompt` → virtud tecleada + Mantra ×3 (selector.prompt, patrón restore) →
`Game.submitShrineVisit` ramifica: fallo → unfocused (0x76b); match+sin-visited → ORDAINED
(quest-bit + 0x78c + 0x7b9 con página 0x4b5e[v] + 0x7f6); visited+quest → quest-complete;
visited sin quest → donación. `shrineShowMantra` se conserva como transición de estado (sus
textos ya no se imprimen). 5 strings nuevas con cita en approved-strings + keys ES.
Registro histórico del escalado:

⚠️ HALLAZGO al ejecutar (2026-07-22, lead): NO es solo añadir strings — hay CONFLICTO entre
la derivación existente del port y el testigo del LP:
- El port (shrines.ts shrineShowMantra, cita CAST2 0x0a81): la visita quest-giving IMPRIME
  virtud+mantra directamente (te lo dice).
- El LP (P07/P09): la visita quest-giving es un INTERROGATORIO — kneel → teclear virtud →
  teclear Mantra ×3 → «…is ordained!» + sacred Quest + Return again (MISCMSG 0x718/0x7b9 —
  offsets corregidos; los 0x729/0x7c9 previos caían a mitad de record).
- El prompt tecleado del port existe SOLO en el flujo de RESTAURACIÓN (shrine roto).
⇒ RE-DERIVAR CAST2 shrine_visit 0x0966 COMPLETO (¿dónde encaja 0x0a81? ¿qué modo pregunta
y cuál ordena la Quest?) antes de tocar código. Candidato: carril con foco (doom-build o
fresco), NO hack nocturno. El resto del ticket original (bytes MISCMSG) sigue válido como
material.

- **Evidencia LP** (P09 32:18 + masivo P08): «Thou dost approach the tranquil Shrine...» →
  «...and thou dost kneel before the Altar.» → [virtue-prompt ✓ port] → mantra×3 →
  «...is ordained!» → «"'Tis now thy sacred Quest to go unto the Codex and learn <X>» →
  «"Return again when thy Quest is done!»
- **Binario (VERIFICADO; offsets CORREGIDOS por el carril audit-codex-shrine — los previos
  0xa71/0x729/0x7c9 apuntaban a MITAD de record)**: MISCMSG.DAT — **0xa59**
  `\nThou dost approach the tranquil Shrine...\n\n` (buffer 0xb8cc; lo imprime la rutina de
  ENTRADA CAST2 0x0e76 en 0x0f69-0x0f78 con selector ~~loc~~**tile**!=0x11 (**corregido
  17-08, ficha #281** — derivación 10839411: el 0x11 se compara contra `[bp-4]` = el TILE
  bajo la party que `call 0x6222` devuelve en 0x0e8d, NO contra g_location — que 0x0ea4
  acaba de poner a 0xFF; loc 0x11 sería el castillo de LB) — NO forma parte del buffer
  del kneel) · **0x718** `...and thou dost kneel before the Altar.\n\n` (buffer 0xb58b,
  primer print de shrine_visit 0x09ac) · **0x7b9**
  `\n\n"'Tis now thy sacred Quest to go unto the Codex and learn ` + `\n"Return again ` —
  las líneas del Quest CON comilla-en-literal (patrón TICKET-002). El gemelo del Codex
  (~~loc~~**tile**==0x11 — ficha #281, ver corrección arriba) es 0xa86
  `\nThe Codex of Ultimate Wisdom lies before thee...` (buffer 0xb8f9).
- **Port**: SOLO emite el virtue-prompt (main.ts:978). Cero hits de kneel/tranquil/sacred Quest
  en game/src → (c) AUSENTE el marco ceremonial completo (antes Y después del prompt).
- **Fix**: al mini-batch de fidelidad (con 001/002): emitir la secuencia MISCMSG completa en el
  flujo de meditación (aproximación+kneel antes del prompt; ordained+Quest+Return tras mantra×3),
  byte-exacto + ES por choke.

## TICKET-004 — ✅ RESUELTO COMPLETO (A: main b649d340 · B: main 4bb5b560)

**B (ventana «Arms») ATERRIZADA**: variante "shop" de ReadyPickerView (marco corto 5 filas
en READY_PICKER_RECT, fila ` N-Abbrev` con cuenta alineada-derecha campo-2 — MEDIDO del PNG
del testigo, corrige la lectura literal del ticket — pad 13 esp., banda ▼▲↕ en fila 8),
reductor puro shopArmsPicker.ts, sell por ↑/↓+Enter (índice→equipId). Gate lead: tsc 0 ·
unit 2598/2598 · shop+magic-ready 11/11. Divergencias honestas documentadas: caja F:/G:+fecha
de la pantalla de tienda sin derivar; «"Show me what ye got..."» = carril saludos-shoppe
(cuya derivación quedó COMPLETA en re/notes/shoppe-greetings-witness.md — solo falta la
decisión de paridad RNG del lead). CON ESTO EL MINI-BATCH 001-004 QUEDA CERRADO.

**A (framing de reactivos) EN MAIN b649d340**: `"Fine! We sell:` (DATA.OVL 0x7a41 = SUBCADENA
DELIBERADA: la cadena empieza en 0x7a3c con el eco `Yes\n\n`, y +5 es justo la comilla —
verificado t#57) + filas
`A...<Nombre>` (letra 0x742a + `...` 0x7a26 + nombre 0x3c20, sin precio/qty) + `\nThy
interest?" ` (0x7a2a) tras la lista — derivado de SHOPPES 0x75e (Y/N del saludo) → 0x666
(lista+selección A-E, máx 5). El eco `Yes\n\n` (0x7a3c es UNA string con el Fine!) queda
para el carril saludos-shoppe (shoppe.json 128-130 + expansión @/$/#, NO derivada).
«Which reagent wouldst thou buy?» era [C] sin ruling — retirado.

**B (ventana «Arms» del herrero, list_wares 0x0c80) — TESTIGO ENTREGADO + derivación
completa, pendiente de implementación** (careo del clip #31 hecho por el lead):
- Testigo `av-referencia/yt/clips/weapon-shop/frames/arms_sell_list.png`: el flujo SELL
  pinta en el panel SUPERIOR-DERECHO (roster) una ventana enmarcada estilo pergamino con
  banner `►Arms◄`, filas `1-Main Gauch / 1-Thrwng Axe / 4-Sht. Sword / 1-Bow`, BARRA DE
  SELECCIÓN en inverso sobre la fila activa, y glifo de banda `↕` centrado en el chrome
  inferior con tapas `► ◄` — la MISMA familia de banda que Ztats/Ready.
- Fila = `<count>` + `-` + <ABREVIATURA> (rutina de formato 0xffffdd0e con tabla de punteros
  DS 0x1962 → DATA.OVL 0x1972 → nombres CORTOS «Cloth/Main Gauch/Thrwng Axe/Sht. Sword…»
  = `src/core/data/shortEquipNames.json` YA EN EL PORT) + pad de 13 espacios (DS 0x7c50 →
  DATA.OVL 0x7c60 `'             '`) que limpia el resto de la fila.
- Página = 5 filas (loop `cmp si,5` @0x0dd6); las filas sin ítem imprimen el pad (el
  testigo muestra 4 pobladas + banda ↕ = prev+next). Banda: flag @0x0dde-0x0e1d
  (+2 prev, +1 next) → `▼0x19/▲0x18/↕0x12`, tapas de ULTIMA.EXE (0xffffa99a/aa3e).
- Infraestructura del port: `ReadyPickerView` (view.setReadyPicker + variantes
  ready/mix, precedente mixReagentView en main.ts) + `readyRowCells` + banda
  `drawScrollArrowBand` — falta variante «shop» (fila `N-Abbrev`), título «Arms», página
  de 5, y el cableado de ShopConsole.sell → picker (selección por scroll+Enter, no letra).
- SOLO el path SELL se calca (list_wares lista la tabla de EQUIPO POSEÍDO 0x57c0); el BUY
  del herrero (SHOPPES 0xb30) NO está derivado — se queda como está hasta derivarlo.

Registro histórico:

NOTA de ejecución (2026-07-22, lead): 9ad1c5cf resultó estar YA EN MAIN (la consola fiel
de tienda aterrizó; lo «bancado» fue la IMPLEMENTACIÓN de la lista paginada 5-filas +
banda ▲▼↕ de list_wares 0x0c80, documentada pendiente-de-testigo). ⇒ T-004 = CONSTRUIR esa
lista + el framing («Thy interest?" → Fine! We sell: → por-letra», DATA.OVL 0x7a2b/0x7a42)
con careo visual contra el clip #31 — carril de UI de presentación, no merge.

- **Evidencia LP** (P08 masivo, batch-3): tendero recita `"Thy interest?"` → `"Fine! We sell:"` +
  lista por-letra `A...Ginseng / B...Garlic / ...` antes de la transacción.
- **Binario (VERIFICADO)**: DATA.OVL 0x7a2b `Thy interest?" ` (comilla-en-literal, patrón 002/003;
  SUBCADENA DELIBERADA: la cadena es `\nThy interest?" ` desde 0x7a2a y la cita salta el `\n` — t#57)
  + 0x7a42 `Fine! We sell:\n\n` — el armazón textual EXISTE como impresión del original.
- **Port**: emite solo transacción (Buy how many?/Here thou art!/...); el menú se presenta como
  PICKER sin recitado → hueco de CADENA DE PRESENTACIÓN (paridad mecánica ✓, presentación ✗).
- **Fix**: NO es ticket nuevo aislado — es la MISMA familia que la lista fiel bancada
  `list_wares 0x0c80` (rama 9ad5c1cf/9ad1c5cf, Clase-C esperando testigo → testigo ENTREGADO
  hoy por el clip #31). Programar: DES-BANCAR esa rama + añadir este framing (Thy interest? →
  Fine! We sell: → lista por-letra) al mismo carril de presentación de tiendas. Con 001/002/003
  forma el MINI-BATCH DE FIDELIDAD del corpus (4 tickets firmes).

### T-003 — RE-DERIVACIÓN COMPLETADA (lead, 2026-07-22) — CAST2 shrine_visit 0x0966

**Veredicto: la cita 0x0a81 del port era MISDERIVACIÓN** — 0x0a81 no imprime virtud+mantra:
es la rama ORDAINED tras un interrogatorio con match. Flujo real, instrucción a instrucción:

1. 0x097a-0x0994: localiza el santuario por (party_x,party_y) en tablas 0x1f6e/0x1f76 → v
   ([bp-8]); caso especial si==8 → v=6.
2. 0x09a1: **anim de ARRODILLARSE** (g_char_anim_states=0x6c) + redraw (0x7730).
3. 0x09ac: print buffer **0xb58b** = MISCMSG kneel («...and thou dost kneel before the
   Altar.» — offset fichero 0x718). ⚠️ CORRECCIÓN (carril audit-codex-shrine): la línea de
   APROXIMACIÓN («Thou dost approach the tranquil Shrine...», fichero 0xa59, buffer 0xb8cc)
   NO está en este buffer — la imprime la rutina de ENTRADA 0x0e76 (0x0f69-0x0f78, selector
   ~~loc~~**tile**==0x11 → 0xb8f9 Codex / else → 0xb8cc shrine; **corregido 17-08, ficha
   #281**: `cmp [bp-4],0x11` donde `[bp-4]` es el tile de `call 0x6222`, no g_location)
   ANTES de despachar a shrine_visit/codex.
   La versión previa de esta nota la fusionaba con el kneel, y por eso el port nunca la emitió
   (gap `shrine-approach-lines` de la auditoría).
4. 0x09ba: print **0xb5b6** = «Upon what virtue dost thou meditate?» → **getstring** a 0xbd08
   (máx 0xc, 0x593c); vacío → exit 0xd1d.
5. 0x09d6: strcmp (0xffff8d3e) typed vs **tabla de virtudes 0x4b3e[v]**; mismatch → flag
   [bp-0xa]=0 (NO aborta aún).
6. 0x0a0c (bucle ×3): prompt «Mantra:» + getstring + strcmp vs mantra[v]; mismatch → di=0.
7. 0x0a5e: di==0 (algún fallo) → print **0xb5de** (mensaje de fallo MISCMSG) → exit.
8. Match + bit VISITED **clear** → **0x0a81 ORDAINED**: set quest-bit + print **0xb5ff**
   («…is ordained!») + getkey + **0xb62c** («"'Tis now thy sacred Quest to go unto the Codex
   and learn ») + página [0x4b5e[v]]+0xb21e + DS 0x9598 + getkey + **0xb669** («"Return again
   when thy Quest is done!») + bucle FX ×7 (tablas 0x4be6/0x4bf4/0x4c02/0x4c10 → call 0x3fb2)
   → exit.
9. Match + VISITED set → 0x0b08: quest-bit set → 0xc18 (WELL DONE, ya fiel en el port);
   clear → rama donación.

**FIX resultante (implementación mecánica):** sustituir `shrineShowMantra` (que IMPRIME
virtud+mantra = invención) por el flujo interrogatorio: beats approach/kneel → prompt virtud
(getstring) → Mantra ×3 → compare contra shrines-data → ordained-sequence / fallo-0xb5de;
anim kneel = beat de presentación (piel). Los textos = MISCMSG byte-exactos (ya verificados).
Toca: shrines.ts (nuevo modo), game.ts (prompts estilo restore ya existente), main.ts (UI),
es.json+manifiesto. Gate: unit + e2e de shrine + verificación ES.

## TICKET-005 — ✅ RESUELTO (rama daemons-palacio) — Gárgolas del Palacio: el hostil no-guardia ATACA (softlock del port)

- **Evidencia LP**: jugando-es ep.16 «Infiltrandonos en el castillo de Lord Blackthorn»
  8:30-9:30 (local `18-…[16] - Infiltrandonos.mkv`): estatuas en las almenas de la
  azotea (loc 18, z=3, slots 17/18, ai=6) → se «animan» al acercarse la party →
  «Attacked! / GARGOYLE / *** CONFLICT ***» con UNA gárgola en arena de ladrillo
  (8:38) → «Gargoyle divides!» al golpearla (8:43) → SIETE gárgolas (9:20) → huida.
  Más el reporte del usuario con captura: en el port esas mismas gárgolas (leídas
  como «demonios») acorralaron a la party sin atacar jamás — softlock blando.
- **Binario (VERIFICADO)**: rama 'a' de npc_engine ENTERA con su tail, transcrita
  en el acta: hostil no-guardia adyacente → «\nAttacked!\n» (DS 0x2881) +
  `town_attack_engine_commit` 0x09BC — dead-bit + entrada a combate contra el
  actor + ranura FUERA, incondicional (huir también la vacía). La
  multiplicación es divideOnHit EN combate (enemyFlags[30]=[144,0]→0x9000), no
  spawn (count=1 en pueblo, y además maxPerMap=1). Derivación completa, con el
  tramo de npc_engine y la entrada de combate del kernel citados instrucción a
  instrucción: `gargolas-hostiles-palacio.md`.
- **Port**: ANTES `return null` (el `je 0x13d6` leído como gate — blackthorn.md
  §2.1a truncada) + npc_engine cortado entero en loc 18. AHORA cableado
  (`Game.hostileNpcAttack` + rama 'a' completa en guard-encounters.ts + arresto
  'N' → combate vs 8 GUARDS). Tests: `npc-hostil-ataca.test.ts` (10 casos; 7
  mutantes muertos + 1 superviviente predicho). Reproducción playwright
  antes/después careada con los fotogramas del LP.
- **Estado**: RESUELTO en la rama; pendiente de aterrizaje.
