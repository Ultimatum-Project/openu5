# WALKTHROUGH-ESPEJO — Part 08 (aulddragon «Buying Karma») — fase 1

Careo VIVO log-contra-log: se rejugó en el port la ruta de Part 08 escena a escena y se
comparó el transcript de la consola lógica del port (`__u5test.consoleLines()`) contra el
OCR-log del original (`original/av-referencia/yt/clips/full-part-logs/part08.ocrlog.clean.txt`).
A diferencia del careo estático previo (emitter-trace, `full-part-logs/part08-careo-masivo.md`),
aquí el veredicto sale de la EMISIÓN REAL en runtime — lo que valida fixes aterrizados y caza
divergencias que el grep no ve (flujos que no emiten, gates que faltan, ecos ausentes).

## Arnés (reproducible)

- Runner: `game/e2e/espejo-part08.spec.ts` (UNTRACKED en el worktree `espejo` — carril de
  docs, cero cambios de código; copia en el scratchpad de la sesión). 14 escenas, cada una
  = boot fresco (`gotoGame` deep-link, piel fiel, lang=en default) + conducción por teclado
  + volcado del transcript a fichero.
- Captura: el ring de consola son 12 líneas (`coreview.ts` CONSOLE_LINES) → acumulador
  page-side con poll 35 ms y dedupe por solape máximo (tolera el crecimiento in-place de
  la línea de eco). Artefacto conocido: puede DUPLICAR una línea idéntica adyacente
  (p.ej. «Party rested!» ×2) — se descuenta en el diff.
- Ejecución: `U5_E2E_PORT=5243 npx playwright test e2e/espejo-part08.spec.ts` desde el
  worktree (server propio, muerto por playwright al terminar).

### Caveats de canal (importan para TODO careo de consola)

1. `consoleLines()` devuelve líneas LÓGICAS pre-wrap; el OCR trae líneas FÍSICAS de 16
   cols. El diff se hace des-wrapeando el OCR (contenido, no saltos). Los saltos duros
   (`\n\n` del binario) SÍ se comparan cuando el port los emite como líneas vacías.
2. Los prompts modales (selector de virtud/mantra del santuario, picker de Mix, picker de
   (U)se) van por OVERLAY en el port, no por consola → sus textos no aparecen en el canal.
   En el original TODOS esos textos van por la consola (el OCR los trae). Eso es en sí una
   diferencia de presentación a listar, pero hace NO-COMPARABLE el literal por este canal.
3. Saludos/despedidas de tenderos = pool 1-de-4 de SHOPPE.DAT (`shoppe.json`) con pick
   RNG → variante distinta que el LP casi siempre: se compara ESTRUCTURA (comillas,
   atribución `says $.`, expansión de $/#), no el literal.

## Tabla de escenas y veredictos

| Esc | Testigo (OCR P08) | Port (vivo) | Veredicto |
|---|---|---|---|
| E01 | «Enter the shrine of Humility» + «Thou dost approach the tranquil Shrine...» + «...and thou dost kneel before the Altar.» | Solo la línea kneel (auto al pisar; sin línea Enter, sin approach) | kneel **(a)**; approach + enter-line **(c)** → C11 |
| E01b | Interrogatorio virtud+Mantra×3 (texto en consola) | Prompts por overlay (canal); fallo da «Thine thoughts are unfocused.» | NO-COMPARABLE (canal) + nota presentación |
| E02 | Camp: «Hole up & camp» → «For how many hours? (1-9)» → «Wilt thou set watch? Yes» → «Who will stand guard?» → «Zzzzz...» → «Party rested!» | Idéntico beat a beat (incl. «Wilt thou set a watch?» — el OCR se comió la «a») | **(a)** flujo completo |
| E03 | «Use item / Item: Watch / The pocket watch reads 4:02 AM.» | «Item: Watch / The pocket watch reads 8:35 AM.» — SIN eco «Use item» | reads **(a)**; eco **(c)** menor → C12 |
| E04 | «Enter towne / MOONGLOW» | «Enter towne» a secas | banner **(a)**; nombre **(c)** → C1 |
| E04b | Cartel LAW OF HONESTY (cuerpo multilínea) | Cuerpo íntegro byte-igual (canal lo une en 1 línea lógica) | **(a)** contenido |
| E04c | «Dost thou wish to leave? Yes / Exit to / Britannia!» | Idéntico, incl. la fila en blanco y el corte «Exit to\nBritannia!» | **(a)** byte-fiel |
| E05 | Menú Nilrem: «"Fine! We sell: / A...Ginseng … E...Mandrake / Thy interest?"» | Igual, salvo «E...Mandrake Root» | menú **(a)** (TICKET-004 validado); label **(b)** menor → C2 |
| E05b | Compra: pitch descripción («This Ginseng variety… costs 25 gp for 10 roots. Is this thy need?») → Yes → «"I thank thee!" says Nilrem. / "Anything else? + re-menú» / No → «What else?» | Letra → «Here thou art!» inmediato; sin pitch, sin confirm, sin thank/else, sin re-menú | **(b)** FIRME → C2 |
| E05c | Despedida «"Use it with care and wisdom, friend." says Nilrem.» | Byte-igual | **(a)** |
| E06 | Mix: «For what spell? :AN NOX» → «-,+,*,* to move RETURN selects. / Type M to mix:» → «How much? 40» → «Mixing... / Done!» | «For what spell? AN NOX / How much? 1 / Mixing...»; líneas de picker por overlay; «Done!» no capturado | prompts **(a)**; picker NO-COMPARABLE (canal) → C13 |
| E07 | Malifora: desc + «Welcome, $, 'tis good to see thee!» + «How may I aid thee?» | desc + «How may I aid thee?» — welcome NO emitido (está en towne.json[1].description) | **(b)** → C9 |
| E07b | :COUNCIL → «Yes, $, I served on the Great Council.» | :coun → respuesta VACÍA (answer presente en towne.json[1].qa[7]) | **(c)-en-vivo** → C9 |
| E07c | :WORD → runas FALLAX / :MANTRA → «I see an honest man chanting AHM!» / BYE → «Wouldst thou pay me 15 gold crowns for my aid?» → yes → «Thy kindness shall be remembered!» | Todo presente y en orden | **(a)** contenido |
| E08 | Stuart: desc + name + «What is thy name?» + You respond- | desc/name/You respond- sí; «What is thy name?» NUNCA se imprime | **(c)** → C7 |
| E08b | job/eat/qual/quan/bye → respuestas; EDIBL → «"I cannot help thee with that.» | Verbatim las 6 | **(a)** |
| E08c | Respuestas entrecomilladas: «"My name is Lord Stuart the Hungry"» | «My name is / Lord Stuart the Hungry» SIN comillas (sistémico en todo Talk) | **(b)** → C8 |
| E09 | Sam: saludo → «May I help thee?» No → «"Hmph. Well, later then..." says Sam.» | Saludo → menú servicios DIRECTO (sin gate Y/N); farewell solo al salir con Space | **(b)** FIRME → C4 |
| E10 | Malik: «I am called Malik / What is thy name?» (primer encuentro) | «Been to see my mother today?» (variante has-met) en partida FRESCA | **(b)** → C10 |
| E10b | :GAMES → «Mostly just playing games.» | job → idéntico | **(a)** |
| E11 | Search mueble: «Player: Min / In the trunk thou dost find nothing of note» | «Search-West / Nothing of note.» — sin «Player:», sin «In the X thou dost find» | **(b)** FIRME → C6 |
| E11b | Get: «A purp[e potion» | «Search-West / a potion! / Get-West / A purple potion!» | **(a)** |
| E12 | Puente: «Thou spieth trolls under the bridge! / $ sneaks (across) / Caught! / The trolls demand a 21 gp toll! / Dost thou pay?N» | «Caught!\n\nThe trolls demand a 54 gp toll!\n\nDost thou pay?N» — peaje BYTE-FIEL (TICKET-001 VALIDADO); preámbulo spieth/sneaks AUSENTE | peaje **(a)**; preámbulo **(c)** FIRME → C5 |
| E12b | Rechazo → «TROLLS / *** CONFLICT ***» (SIN «Attacked!») | «Attacked! / TROLLS / *** CONFLICT *** / Shamino, armed with Short Sword:» | banner **(a)**; «Attacked!» espurio **(b)** → C5b |
| E13 | «Enter castle / THE LYCAEUM» | «Enter castle» a secas | → C1 |
| E13b | Faye: «Art thou in need of aid?» Yes → «"We have powers to Cure, Heal, or Resurrect." says Faye.» → «What is the nature of thy need?» → Resurrect → «Who needs my aid?» → «I can raise this unfortunate person from the dead for 249 gold. Wilt thou pay?» No → «Is there any other way in which I may aid thee?» No → «Quest forever for peace, traveler. Farewell.» | services line BYTE-FIEL (TICKET-002 VALIDADO) y farewell del pool = el MISMO del LP; pero: sin gate-aid (C4), sin nature-of-need, «For whom?» + lista a)/b)/c) en vez de «Who needs my aid?», y resurrect EJECUTA sin cotizar («It is done.» con oro; «Thou hast not the gold!» sin él) | **(b)+(c)** FIRME → C3 |
| E13c | Virden: menú 3 reactivos + pitch Mandrake 50 gp → No → «What else?» → «Hex-e-poo-hex-on-you!» | Menú (a); compra = mismo defecto C2; farewell pool estructura (a) | → C2 |
| E14 | «Z-stats... / Player: Min / Status: / Done» | «Z-stats... / Player: Avatar / Status: / Done» | **(a)** plantilla |

## Fixes previos VALIDADOS EN VIVO

- **TICKET-001** (peaje troll): «Caught!\n\n… gp toll!\n\nDost thou pay?» + eco `N` — byte-fiel. ✓
- **TICKET-002** (healer services): «"We have powers to Cure, Heal, or Resurrect." says $.» — comillas + atribución. ✓
- **TICKET-004** (framing menú reactivos): «"Fine! We sell:» + `A...X` + «Thy interest?" » — presente. ✓
- **TICKET-003** (ceremonia shrine): PARCIAL — kneel emite; «Thou dost approach the tranquil Shrine...» y la línea «Enter the shrine of <virtud>» NO (ver C11); el interrogatorio va por overlay (no medible por consola).

## Tickets candidatos (evidencia viva + cita de emisor; el lead firma contra binario)

| # | Candidato | Evidencia viva | Emisor / cita |
|---|---|---|---|
| C1 | Nombre de localización tras «Enter towne/castle» AUSENTE | E04/E13: solo la línea Enter; LP imprime «MOONGLOW» / «THE LYCAEUM» | `game.ts:4874` ENTER_LINES + `loadSmallMap` (4910) no imprime nombre; nombres en `data.json:locationNames` (DS 0x2637+) |
| C2 | Compra de reactivos SIN pitch/confirm/thank/else | E05/E13c: letra → «Here thou art!» seco | `shop-console.ts:1120` pickReagent → `shops.ts:589` directo; descripciones YA en `shoppe.json` (nunca emitidas); LP: pitch + «Is this thy need?» + «"I thank thee!" says $.» + «Anything else?»/«What else?» + re-menú. Menor: label «Mandrake Root» vs LP «Mandrake» |
| C3 | Healer SIN cotización ni confirm de pago | E13b: resurrect ejecuta «It is done.» sin «…for N gold. Wilt thou pay?»; «For whom?»+lista letras vs «Who needs my aid?»; sin «What is the nature of thy need?»; sin «Is there any other way…» | `shop-console.ts` pickHealMember (ejecuta healerHeal directo); `cmd-strings.ts:247` whom |
| C4 | Gate Y/N de saludo SOLO en MagicSeller | E09: Sam pasa del saludo al menú sin Y/N; LP: «May I help thee?» No → «"Hmph. Well, later then..." says Sam.»; Faye ídem («Art thou in need of aid?») | `shop-console.ts:262` start(): greet-yn condicionado a `type === "MagicSeller"` («los demás entran a su menú tras el saludo») |
| C5 | Preámbulo del peaje AUSENTE + «Attacked!» espurio | E12: sin «Thou spieth trolls under the bridge!» ni «$ sneaks across»; rechazo imprime «Attacked!» que el LP no tiene | `hazards.ts:bridgeTrollAmbush` modela SOLO RNG (sin mensajes); keys huérfanas `es.json:2799/2804`; pre-línea `game.ts:5306-5312` usa default enemy-init en el spawn del peaje |
| C6 | Search de mobiliario: formato y jugador | E11: «Nothing of note.» seco; LP: «Player: $» + «In the <mueble> thou dost find nothing of note / a potion!» | `game.ts:2235` + `search.ts:211`; key huérfana `es.json:3339` («nothing of note.\n» minúscula-continuación) delata la forma original |
| C7 | AskName sin «What is thy name?» | E08: tras el nombre del NPC va directo «You respond-» | `conversation.ts:113` WHATS_YOUR_NAME DEFINIDA y NUNCA usada; handler AskName (~:556) emite solo el prompt |
| C8 | Respuestas de Talk sin comillas | E07/E08: «My name is X» sin `"…"`; LP entrecomilla todo el discurso | Motor de conversación no envuelve; verificar contra TLK/DATA.OVL quién pone las comillas (trampa-del-entrecomillado) |
| C9 | Malifora: welcome no emitido + «coun» vacío | E07: falta «Welcome, $, 'tis good to see thee!» (está en `towne.json[1].description` tras `<Pause><StartNewSection>` — ¿gate knowsAvatar?); :coun responde VACÍO con answer presente (`towne.json[1].qa[7]`) | `conversation.ts` (secciones de description / matching qa) — investigar |
| C10 | Malik: saludo has-met en partida fresca | E10: «Been to see my mother today?» en vez de «I am called Malik / What is thy name?» | Ramas met/unmet del saludo (`towne.json[2]` + flags met) — investigar |
| C11 | Shrine: approach + línea Enter ausentes | E01: al pisar solo kneel; LP: «Enter the shrine of Humility» + «Thou dost approach the tranquil Shrine...» + kneel | Entrada por `checkShrineEntry` (auto, sin línea Enter); MISCMSG approach (~0x6f0?) no emitido — completar T-003 |
| C12 | Eco «Use item» ausente en overworld | E03: transcript arranca en «Item: Watch» | `cmd-strings.ts:37` use=«Use item\n\n» (DS 0xa24c) definido; `main.ts` openUsePicker emite solo «Item: »; en combate SÍ (`main.ts:1731`) |
| C13 | Mix/Use/Shrine: prompts de picker por overlay | E06: «-,+,*,* to move RETURN selects. / Type M to mix:» no van a consola (LP sí) | Decisión de presentación picker-vs-consola — ruling del lead (paridad-mecánica ≠ presentación); «Done!» pendiente de verificar |

Confirmaciones (a) adicionales: flujo camp completo, pocket watch, salida de pueblo
(«Dost thou wish to leave?» + «Exit to\nBritannia!»), cuerpo de cartel, Get de botín
(«A purple potion!»), eco Z-stats, contenido de Stuart/Malifora (word/mantra en runas,
pay-flow 15 oro), banner de combate («TROLLS / *** CONFLICT *** / $, armed with X:»),
farewell de Faye idéntico al del LP.

## Evaluación de escalado (corpus 24/24 completo)

- **Coste fase 1**: ~1 jornada-agente, la mayor parte AMORTIZADA (arnés de captura +
  conductores talk/shop/overlay + convenciones de canal ya resueltas). Marginal estimado
  por parte: 2-4 h (segmentar OCR, mapear escenas a deep-links, conducir, diff).
- **Rendimiento decreciente**: Part 08 tocó ~8 sistemas y produjo 13 candidatos, pero la
  mitad de los sistemas (movimiento, combate-banner, camp, signos, Z-stats) ya quedan
  careados — se repiten en las 24 partes. Barrer las 24 mecánicamente re-mediría lo mismo.
- **Recomendación**: NO barrido 1:1. Dos vías complementarias:
  1. **Espejo vivo dirigido** (este método) solo sobre partes con SISTEMAS aún no
     careados: posada/inn real (dormir de pago), shipwright/venta, arresto+cárcel,
     shrines restantes + Codex-donación (P09/P10), palabra-de-poder/yell en uso real,
     mazmorras habladas (P16-P20), endgame (P24). ≈ 7-9 partes ricas.
  2. **Grep dirigido barato** para el resto: extraer plantillas del OCR (normalizando
     ruido l/], 0/O) y carearlas contra `approved-strings.json` + emisores — detecta (c)
     sin browser; las (b) de flujo requieren la vía 1.
- Los OCR-logs de las partes de MAZMORRA tendrán más ruido (paleta oscura) — presupuestar
  más NO-COMPARABLE ahí.

## Falsos positivos de OCR descartados (no son tickets)

«Very s[ow!», «wizard[y», «towne→town» (E-caído en borde de wrap), «P[FhFTPM!» (fanfarria
de campanas del shrine renderizada como glifos), «rune(s)» con s comida, runas FALLAX/AHM
leídas como «WF[[FL»/«PFM» — todo ruido de canal OCR, verificado contra el port o los datos.
