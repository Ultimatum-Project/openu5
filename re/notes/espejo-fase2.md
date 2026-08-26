# WALKTHROUGH-ESPEJO — fase 2 (escalado DIRIGIDO): sistemas no careados

Ejecución del escalado ratificado en fase 1 (`re/notes/espejo-part08.md` §Evaluación):
careo VIVO log-contra-log SOLO de las partes del corpus con sistemas aún no careados.
Base del careo: **landing/batch1** (44da68a9, el port con las cadenas de presentación
recién calcadas). CAREO PURO: cero fixes de código — veredictos + tickets con evidencia.

## Arnés (reproducible; esta vez TRACKED)

- Runners: `game/e2e/espejo-fase2.spec.ts` (+ `…2b/2c/2d/2e`, escenas de reintento y
  sondas). Mismo patrón de fase 1: boot fresco (`gotoGame` deep-link, piel fiel,
  lang=en) + conducción por teclado + acumulador page-side del ring de consola
  (`__u5test.consoleLines()`, poll 35 ms, dedupe por solape máximo con tolerancia al
  eco que crece in-place). Novedades de fase 2:
  - **Localización viva del mercader**: los tenderos SE MUEVEN por schedule — el runner
    escanea `npcManager.npcAt` por dialogNumber (0x81-0x88) y coloca a la party al lado
    (los deep-links a la coord estática del .NPC fallaban a las 10:00).
  - Overlays (virtud/mantra del santuario) via `.save-name` fill; prompts modales del
    shop por tecla con sonda `__u5test.shopConsole()`/`partySelectOpen()`.
- Ejecución: `U5_E2E_PORT=5244 U5_VITE_CACHE_DIR=<scratch> npx playwright test
  e2e/espejo-fase2*.spec.ts` (server propio, muerto por playwright al terminar).
- **Caveat de canal NUEVO** (se suma a los 3 de fase 1): el ring lógico son 12 líneas;
  una ceremonia que emite >12 líneas de golpe (Codex) ROTA el ring entre polls y el
  acumulador pierde la cabeza del burst. Se compensa con la sonda de ring crudo por
  paso (runner 2c) o con el unit test del emisor (p.ej. `tests/shrine-trigger.test.ts:181`
  ya asevera la línea «The Codex of Ultimate Wisdom lies before thee...»).

## Testigos usados (OCR-logs, gitignored)

| Sistema | Fuente | Dónde |
|---|---|---|
| Posada REST | aulddragon P05 ~2440 (Ransack, The King's Ransom Inn, Buccaneer's Den) | full-part-logs/part05.ocrlog.txt |
| Posada LEAVE | aulddragon P19 ~350 (Lorien, The Smugglers' Inn, Paws) | part19.ocrlog.txt |
| Shipwright | Alex Diener Ep01 ~3120 (Master Hawkins, The Oaken Oar, East Britanny; skiff Y frigate) | full-part-logs-ad/ad_ep01.ocrlog.txt |
| Curandero (revalida C3) | Alex Diener Ep01 ~3065 (Milan, Healers' Sanctum: resurrect 237 oro → No) | ídem |
| Arresto+tributo | clip `arrest-ep3/` (AD Ep03 27:05, OCR limpio 720p) + NOTA.md | clips/arrest-ep3/ |
| Shrine quest-ordained | aulddragon P09 ~4749 (Compassion) / ~8515 (Spirituality) / P10 ~4348 (Valour) | part09/10.ocrlog.txt |
| Codex | aulddragon P09 ~5650 («Pass, Seeker!» + lectura de página) | part09.ocrlog.txt |
| Mazmorra (Deceit) | aulddragon P16 (yell FALLAX, enter, torch, move, search, look, klimb, Pit Trap) | part16.ocrlog.txt |
| Endgame | aulddragon P24 ~1540-1720 (absorbed ×6 + diálogo LB completo + FOLLOW!) | part24.ocrlog.txt |
| Gremio | aulddragon P05 (Braunam, The Den: gems 318 oro, Sold, What else m'lady) | part05.ocrlog.txt |
| Taberna | aulddragon P04 ~1740 (Tika, The Wayfarer Tavern: Mutton/Ale/Rations + cantidad) | part04.ocrlog.txt |

## Tabla de escenas y veredictos

| Esc | Testigo | Port (vivo, landing/batch1) | Veredicto |
|---|---|---|---|
| **S1 posada REST** | «…innkeeper of The King's Ransom Inn. Mayhap I canst be of assistance?» Yes → «Ransack asks, "«Art thou here to …» (72 B, sha1 40592ad8 — recortado; verifica contra tu copia)"» → [R] → **««We are a little …» (106 B, sha1 11504e31 — recortado; verifica contra tu copia)» Yes → «"Have a pleasant night, milady!" says Ransack.» → «Zzzzzz....» → «Morning!»** | Saludo pool + gate Y/N ✓; menú R/L/P **BYTE-FIEL** («$ asks, "Art thou here…night?"»); pero R ejecuta DIRECTO: «Morning!» seco + despedida genérica del pool («It was a pleasure to serve thee!») | menú **(a)**; cadena de descanso **(b) FIRME** → **F2-T2** |
| **S2 posada LEAVE** | menú ídem → [L] → **«Who will stay?»** → pick → **«The rate for a comfortable room will be 22 gold per month, due at check-out. Wilt thou take it?» Yes → «I thank thee.»** → «Is there anything more I can do for thee?» No → despedida pool («It was a pleasure to serve thee!») | menú ✓; **«For whom?» + lista a)/b)** en vez de «Who will stay?»; ejecuta DIRECTO «It shall be done.» (sin tarifa mensual, sin confirm, sin thank); «Is there anything more I can do for thee?» **BYTE-FIEL** ✓; despedida pool ✓ («Then thou hast come to the wrong place.») | epílogo **(a)**; cadena leave **(b) FIRME** → **F2-T2** |
| **S3 shipwright** | «…The Oaken Oar! Canst I interest thee in our fine ships?» Yes → **««We sell ocean-going Frigates …» (81 B, sha1 ab0e1f29 — recortado; verifica contra tu copia)»** → [S] → **««Skiffs allow thee to …» (143 B, sha1 bbf222cd — recortado; verifica contra tu copia)»** No → «"Don't slam the door..." says Master Hawkins.» / [F] → **«These stout-hearted vessels can travel the roughest of seas! For 968 gold, thou canst master the winds! Wilt thou take it?»** No → «"Oh, well." says Master Hawkins.» | Saludo pool + gate Y/N ✓ («…we sell the fastest ships in the land! May I help thee?»); tras Yes: **lista cruda «f) Frigate — 1007 gp / s) Skiff — 193 gp»** y la letra COMPRA AL INSTANTE (sin pitch, sin «Wilt thou take it?»); sin oro: «Thou hast not the gold!» (filtra el precio antes del confirm); compra ok: «She awaits thee at the dock!» + despedida pool ✓. Fórmula de precios VALIDADA (LP 186/968 vs base 125/650 = ratio 1.488≈haggle-INT; port ídem con otro INT) | gate+saludo+despedida **(a)**; mecánica precio **(a)**; cadena de venta **(b) FIRME** → **F2-T3** |
| **S4 shrine ordained** | «Enter the shrine of Compassion» → «Thou dost approach the tranquil Shrine...» → «...«and thou dost kneel …» (77 B, sha1 fdba9fdb — recortado; verifica contra tu copia)?» :COMPASSION → Mantra:MU ×3 → **««The Altar speaks and …» (102 B, sha1 d34b4b47 — recortado; verifica contra tu copia) of the heart of a cruel soul!» → «Return again when thy Quest is done!»** | approach ✓ + kneel ✓ (C11 parcial CERRADO); prompts por overlay (canal, C13); con «Compassion»/«Mu» exactos: las 3 líneas del ordained **BYTE-FIELES** (incl. página per-virtud «heart of a cruel soul»; P10 Valour «the failing of life without Valour» y P09 Spirituality «the neglect of one's Spirit» casan con `ordainedPage`) — pero tecleando **«COMPASSION»/«MU» (como el LP) FALLA** con «Thine thoughts are unfocused.»; y la línea «Enter the shrine of <virtud>» sigue AUSENTE | textos **(a)**; case-sensitivity **(b) FIRME** → **F2-T5**; línea Enter **(c)** → **F2-T6** |
| **S5 Codex** | «"Pass, Seeker!"» → «>Enter the Shrine of the Codex!» → «The Codex of Ultimate Wisdom lies before thee...» → ««The book is open …» (86 B, sha1 bc51e058 — recortado; verifica contra tu copia):» → **«"Only a detested life owes its pleasures to another's pain."»** | «Pass, Seeker!"» ✓ (pero SIN comilla de apertura); ceremonia AUTO al pisar el tile 0x11 en (233,233) — sin línea «Enter the Shrine of the Codex!»; lectura completa **BYTE-FIEL** incl. página de Compassion (lies-before-thee verificada por unit test; el ring la rota — caveat de canal) | lectura **(a)**; comilla **(c)** → **F2-T9**; Enter-line/on-step **(c)** → **F2-T6** |
| **S6 Deceit** | «>Yell what? :FALLAX / A word of power is uttered» → «>Enter dungeon / DECEIT» → «>Ignite torch!» → ecos «>Advance / >Turn left / Blocked!» → «>Search... / Player: Min / Dir-Ahead / You find: / A hidden door!» → «>Look... / Player: Min / Dir-Ahead / You see: / a wall.» → «>Klimb-Down! / >Klimb-U/D-Down» → **«Pit Trap! / Falling... / ...splat!» (encadenado)** | Yell ✓ fiel; «Enter dungeon» ✓ pero banner DOBLE y MAL: **«SHAME» + «DECEIT»** (ver F2-T1); ecos Advance/Turn/Blocked ✓; Search: «You find: / A hidden door!» ✓ pero SIN eco «Search...», SIN «Player:», SIN «Dir-Ahead» (0x8a08 pendiente, comentario en dungeon.ts:663); Look: «Look... / You see: / a passage.» ✓ familia fiel (sin Player/Dir); Klimb single-vía: «Up!» SIN prefijo «Klimb-» (el prompt «Klimb-U/D-» del caso doble SÍ está, main.ts:1180 = P16 «Klimb-U/D-Down» ✓); **Pit Trap! / Falling... / …splat! encadenado 2 plantas BYTE-FIEL** ✓ | pit+yell+moves **(a)**; banner **(b) FIRME** → **F2-T1**; search/look chain **(b)** → **F2-T7**; klimb echo **(c)** → F2-T7 |
| **S7 banner village** | «>Enter village / PAWS» (P19) | **«Enter village / FARTHING»** — nombre de OTRA location | **(b) FIRME** → **F2-T1** |
| **S8 curandero (revalida C3)** | Milan: gate Yes → «"We have powers to Cure, Heal, or Resurrect." says Milan.» → «What is the nature of thy need?» Resurrect → «Who needs my aid?» → **«I can raise this unfortunate person from the dead for 237 gold. Wilt thou pay?»** No → «Is there any other way in which I may aid thee?» No → «"May the powers of light guard thy soul."«says Milan.» | **TODA …» (484 B, sha1 8b424adf — recortado; verifica contra tu copia)"Sold!"«says Braunam. / What …» (698 B, sha1 c98b7a8b — recortado; verifica contra tu copia)"Come again, friend!" says Tika.» | Saludo pool **BYTE-FIEL** (¡la MISMA entrada del pool que el LP!) + gate ✓; pero el menú es el genérico **«Buy a Round, Wine, Rations, or hear a Rumor?»** (≠ Mutton/Ale/Rations/Chat del testigo, ni la variante de re-visita), la 'r' compra una Ronda directa («Enjoy!»), y la cadena de Rations (pitch + «How many wouldst thou like?» + «Anything else for thee?») NO existe; despedida pool ✓ | saludo+gate+despedida **(a)**; menú+rations **(b) FIRME** → **F2-T10** |
| **Arresto+tributo** | «>South / Blocked! / A guard demands a 20 gp tribute to Blackthorn! / Dost thou pay? :Yes / "Thou art under arrest!" / "Wilt thou come quietly?" / The guard strikes thee unconscious! / Thou dost awake to...» (con G:11 < 20 — aceptar SIN oro también arresta) | **SISTEMA AUSENTE en vivo**: el motor puro `guardDemand` (blackthorn.ts:517) modela el ORO exacto (tributo=10×vivo, Minoc oro/2, password IMPE) y su ret 0/1, pero SOLO está cableada la vía password del Palacio (game.ts:3630-3670, comentario literal: «los guardias de Minoc/tributo, misma tabla, quedan sin cablear — piezas aparte»). Ni demanda, ni arresto, ni inconsciencia, ni despertar-en-celda | **(c) FIRME sistema** → **F2-T4** ⚠ **CABLEADO 2026-07-30, ver nota bajo la tabla** |

> **⚠ «SISTEMA AUSENTE en vivo» YA NO ES CIERTO — F2-T4 cableada el 2026-07-30.** La fila de
> arriba se escribió cuando sólo existía el motor puro y la única vía cableada era la del
> password del Palacio. **Hoy el tributo y el arresto están conectados al mecanismo real**,
> y la evidencia va aquí para que esta acta se lea sola:
>
> - **No hay limitador**: el guardia **re-demanda cada turno** mientras se esté adyacente, y
>   cuando hay varios manda el de **índice mayor** — no se «gasta» tras la primera negativa.
> - **Fallar el password por `(T)alk` también arresta**, no sólo negarse al tributo: es la
>   misma salida del productor, la de resultado 2.
>
> Lo que la fila SÍ sigue describiendo bien es el **oro** (tributo = 10 × vivos, Minoc oro/2,
> password IMPE) y su retorno 0/1, que era correcto y no se ha tocado. El cruce del testigo
> con este cableado queda **medible en la próxima ventana de espejos**, que es lo único que
> falta para cerrar la fila del todo.
| **Endgame (estático)** | P24: «X is absorbed!» ×6 → «Lord British / "Well met, Min!" / "Didst thou bring my box?" / You reply: Yes / …carefully opens the box... / **He says:** / "An artifact of astral power…"…«"FOLLOW!" cries Lord British…"Our worlds await!"«» → disolución/historia/pergamino (sin …» (3023 B, sha1 6e5e8387 — recortado; verifica contra tu copia)"Thou art under arrest!" / "Wilt thou come quietly?" / The guard strikes thee unconscious! / Thou dost awake to...»; el port no emite NADA en esa situación | Motor: `blackthorn.ts:517 guardDemand` (ret 1 = escalada YA modelado, incl. Yes-sin-oro→ret 1 = el GOTCHA del testigo); cableado: solo password (game.ts:3630 tryTalkGuard gated a LOC_BLACKTHORN, comentario «quedan sin cablear»); secuencia de arresto/celda = TALK 0x01e2 caller (0x318) + rutas de 3.13 por derivar |
| **F2-T10** | ALTA | Taberna: menú real + cadena de Rations | S10 vs P04: menú fiel = pool con comidas («What'll it be... roast Mutton, tankard of Ale, or Rations…» / re-visita «Shall I bring thee more Ale or roast Mutton, or… just Chat? …Rations?»), no «Buy a Round, Wine, Rations, or hear a Rumor?»; falta pitch de Rations («We buy our dried beef in quantities… 25 servings for 18 gold!») + «How many wouldst thou like?» (cantidad) + bucle «Anything else for thee?» | `SHOP_UI.tavern` (cmd-strings.ts:252, «SHOPPES2:0x066C menú») — el testigo lo DESMIENTE como literal; `shop-console.ts` tavernRound/tavernRations compran 1 directo; cadena SHOPPES2 por re-derivar |
| **F2-T5** | MEDIA | Interrogatorio de santuario CASE-SENSITIVE (el original acepta mayúsculas) | S4: «COMPASSION»/«MU» (lo que el LP tecleó y le FUNCIONÓ — ecos «:COMPASSION», «Mantra:MU» con quest ordained) → port «Thine thoughts are unfocused.»; «Compassion»/«Mu» exactos → ordained | `shrines.ts:131-136 shrineVisitCheck` compara `===` contra `data.virtues[v]`/`mantras[v]` (mixed-case); inconsistente con `blackthorn.ts:mantraMatches` (substring case-insensitive, kernel toupper 0x2032). El getstring del binario (CAST2 0x09c1/0xbd08) muy probablemente pasa por toupper — derivar y normalizar |
| **F2-T6** | MEDIA | Shrine/Codex: línea «Enter the shrine of <virtud>» / «Enter the Shrine of the Codex!» ausente (¿y ceremonia por (E) en vez de on-step?) | P09: las 3 visitas muestran el eco «>Enter the shrine of X» ANTES de «Thou dost approach…»; el Codex ídem («>Enter the / Shrine of the / Codex!»). El port corre la ceremonia AUTO al pisar (checkShrineEntry) sin eco | `game.ts:5267 checkShrineEntry` + nota «el dispatch 0x0e76 llama a shrine_visit/codex sin getkey previo» — compatible con que 0x0e76 sea el DESPACHO DE (E)nter (no un hook de move); los strings «Enter the shrine of…» deben existir en DATA.OVL (prefijo DS 0x2a6f). Adjudicación del lead contra MAINOUT cmd_enter |
| **F2-T7** | MEDIA | Mazmorra: cadena de presentación de Search/Look (+eco Klimb) | P16: «>Search... / Player: Min / Dir-Ahead / You find:» y «>Look... / Player: Min / Dir-Ahead / You see:»; port: search sin eco ni Player/Dir (look sí ecoa «Look...» pero sin Player/Dir); Klimb single-vía sin prefijo «Klimb-» (solo «Up!»; el caso doble «Klimb-U/D-» SÍ está y casa con P16) | `dungeon.ts:663` comentario: «PENDIENTE (E4-1/E4-3): … selección de miembro (0x8a08)»; dispatcher main.ts ~1160 no ecoa search; `dungeon.ts:570-575` klimb («El eco "Klimb-" lo antepone la UI» — pero solo en la rama NeedsChoice, main.ts:1178-1181) |
| **F2-T8** | BAJA | Endgame: línea «He says:» ausente de los records del diálogo | P24:1645-1648: «carefully opens the box... / He says: / "An artifact of astral power…» | `assets/endgame.json` dialogue (records 3→4 sin «He says:»); ¿string suelta de DS ensamblada en runtime (como «Lord British says:» del rec 0)? — revisar extractor/ENDMSG |
| **F2-T9** | BAJA | «Pass, Seeker!» sin comilla de APERTURA | P09: `"Pass, Seeker!"` con ambas comillas; port emite `Pass, Seeker!"` | `game.ts:5247` literal `'Pass, Seeker!"'` (DS 0x2B6E — verificar bytes) |

## Fixes de fase 1 VALIDADOS EN VIVO en esta fase

- **C3 (curandero)** — cadena COMPLETA byte-fiel (S8): gate + services-line + nature-of-need
  + «Who needs my aid?» + pitch con precio (237 = el del testigo) + «Wilt thou pay?» +
  «Is there any other way…» + despedida del pool. CERRADO.
- **C4 (gate Y/N del saludo)** — vivo en Shipwright, InnKeeper, Barkeeper, GuildMaster,
  Healer (S1-S3, S8-S10). CERRADO.
- **C11 parcial (approach del shrine)** — «Thou dost approach the tranquil Shrine...» +
  kneel emiten (S4). Queda solo la línea «Enter the shrine of» (F2-T6).
- **Gremio** — cadena entera fiel (S9); **posada menú/epílogo** fieles (S1/S2); pergamino
  Pit-Trap encadenado, yell de palabra de poder, ecos de mazmorra: fieles (S6).

## VEREDICTO DE CIERRE del espejo

Con fase 1 (Part 08) + fase 2 (este careo), los sistemas del walkthrough con careo
vivo o estático-con-testigo son: movimiento/ecos, camp completo, signos, Z-stats, uso
de items (watch), entrar/salir de pueblo, Talk (saludo/keywords/askname), reactivos,
curandero, gremio, taberna, posada (rest/leave), shipwright, peaje de trolls, banner
de combate, santuario (fail + ordained + páginas per-virtud), Codex (guardián+lectura),
tributo/arresto (estático: ausente), mazmorra de pasillo (yell/enter/torch/move/search/
look/klimb/pit/fountain-format), endgame (diálogo completo + census de gaps).

**Queda SIN carear del corpus** (con su porqué):

1. **Posada PICKUP** — sin testigo en las 24+25 partes (nadie recoge un compañero en
   cámara). El flujo existe en el port (innPickup); carear cuando haya testigo (Lord
   Fenton / Sinatar) o adjudicar por ASM (SHOPPES3 0x04E6).
2. **Celda/día-después del arresto** — el testigo del texto post-arresto («Thou dost
   awake to...» y qué sigue) se corta en el clip; la transición Ep02→Ep03 de AD no
   quedó logueada (NOTA.md de arrest-prison). Bloqueado por testigo; la mecánica entera
   ya es F2-T4.
3. **Herrero buy/sell** — careado por su propio carril (clips weapon-shop + cadenas
   buy/sell-flow recién calcadas, F3); el espejo no lo re-midió. Sin hueco conocido.
4. **Establo (HorseSeller)** — sin escena limpia en los OCR-logs (cero hits de
   steed/interested). Port tiene cadena propia (horse pitch+Deal). Testigo pendiente.
5. **Variantes de re-visita** de pools (p.ej. el 2º menú de taberna «Shall I bring
   thee more…») — cubiertas COMO EVIDENCIA en F2-T10, no medidas una a una.
6. **Presentación del endgame** (absorb-combat, verde, orb/moongate, disolución,
   historia, fanfarria) — carril endgame-visual EN VUELO con testigo-censo propio
   (re/notes/endgame-witness-20260721.md); el espejo solo CORROBORÓ el censo con el
   OCR de P24 (+F2-T8).

Fuera de esos 6 huecos acotados (2 bloqueados por testigo, 2 con carril propio, 1
menor sin testigo, 1 evidencia-en-ticket), **el espejo del walkthrough queda CERRADO**:
no queda ningún sistema jugado en la ruta canónica de aulddragon sin veredicto.
