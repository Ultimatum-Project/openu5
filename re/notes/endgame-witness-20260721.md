# TESTIGO: vídeo completo del ENDGAME con caja (victoria) — 2026-07-21

**Fuente:** grabación del usuario en DOSBox original, 2:34 min con AUDIO.
Archivada en `original/av-referencia/endgame/endgame-victoria-box-20260721.mov` (gitignored).
Party de 6 (save loadout), entrada a la celda de LB en Doom N8 por (4,7).
Frames de referencia: 1 fps extraídos (scratchpad de la sesión orquestadora; re-extraer del .mov).

## Secuencia observada (timestamps del vídeo)

| t (s) | Evento |
|-------|--------|
| 0-2 | «Entering room...» — la celda de LB ES UNA SALA DE COMBATE (arena con muros de calaveras, trono, cama, mesa, estanterías, espejo en pared). LB SENTADO en el trono (sprite trono+figura). Enemigos = **SILUETAS-SOMBRA** (humanoide negro con borde azul brillante), ~5. |
| 2-27 | Combate por turnos normal (prompts «X, armed with Magic Bow:»). Las sombras avanzan; al CONTACTO con un miembro: **«NOMBRE is absorbed!»** — el miembro DESAPARECE del mapa (sigue en el roster del panel). Audio: bloque continuo de sfx de combate (5-24s). |
| ~27 | Blip de audio corto. Transición A: **LA SALA ENTERA SE RE-TIÑE**: ladrillo rojo → **VERDE**, antorchas → llama VERDE, mesa → tapete verde. Los miembros absorbidos REAPARECEN (party completa). LB pasa de trono a **DE PIE** (sprite rey andante). Aparece un **ARCO amarillo/azul en el borde SUR** de la sala (¿espejo/portal? — derivar). |
| 28-53 | (Pausa siléncica — lectura) |
| ~54-85 | **DIÁLOGO DE LB** (en el panel de texto, paceado por tecla): «Didst thou bring my box?» → **fork Yes/No** («You reply: Yes») → «Lord British carefully opens the box...» → discurso largo (varias páginas): «...that thee and I both call home did it come.» / ««Often did I return …» (93 B, sha1 7f7bb418 — recortado; verifica contra tu copia)» / «...the Orb of the Moons!» |
| ~85-88 | **««"FOLLOW!" cries Lord British, …» (136 B, sha1 7e38bbb8 — recortado; verifica contra tu copia)»** — partícula/estallido ROJO pequeño en el suelo delante de LB (el Orb lanzado). |
| ~88-100 | **MOONGATE ROJO** (rectángulo rojo macizo grande, estilo moongate) en el centro de la sala. LB y los miembros de la party ENTRAN UNO A UNO en el gate (se les ve caminar hacia él y desaparecer; a f095 quedan 2). |
| ~101-104 | **DISOLUCIÓN DE PÍXELES A PANTALLA COMPLETA** — TODO el frame (mapa + paneles del UI + chrome) se deshace en píxeles dispersos. Audio: blip ~110s (whoosh/página). |
| ~105-117 | **PANTALLA DE HISTORIA 1 — la casa del Avatar** (art EGA: interior de casa, silueta del Avatar a contraluz en la puerta, espada+escudo colgados): ««Much time has passed …» (255 B, sha1 6d074ac7 — recortado; verifica contra tu copia)» |
| ~118-128 | **PANTALLA DE HISTORIA 2 — «The Dream»** (rótulo gótico; art rojo/negro del trono de Blackthorn): sueño en el trono de Blackthorn hundido, LB ante él con «a serpentine amulet, a golden sceptre, and a regally bejewelled crown» (texto largo). |
| ~129-153 | **PERGAMINO FINAL**: ««Be it known that …» (194 B, sha1 727105b2 — recortado; verifica contra tu copia)» + 2 líneas RÚNICAS + «Report now, thy Quest compleat in 5 days, to Lord British at Origin Systems!». Audio: serie de notas (fanfarria) 142-149s. **ESTADO TERMINAL: frame congelado, sin input posible** (confirmado por el usuario). |

## GAP-LIST contra el port (main a7e9bd94)

El port hoy: `checkDoomRescue` (floor==7 + endgameReady) → mensajes + evento game-won → pergamino. TODO LO DEMÁS FALTA:

1. **Combate final con Sombras + mecánica «is absorbed!»** (miembro desaparece al contacto, sin morir). ¿Sala = combatmap dedicado? Derivar de ENDGAME/DUNGEON.OVL — nuestra ficha cm127 y el trigger posicional (4,7).
2. **Re-tinte VERDE de la sala entera** (suelo+antorchas+mesa) + LB trono→de pie + reaparición de los absorbidos + arco sur.
3. **Diálogo completo de LB con fork Yes/No de la caja** (strings en DATA/ENDGAME — extraer y citar; ruta sin-caja = «stranded» ya modelada en core pero sin esta presentación).
4. **Orb rojo lanzado al suelo (partícula) + MOONGATE ROJO + salida uno-a-uno** de party+LB por el gate.
5. **Disolución de píxeles a pantalla completa** (incluye UI).
6. **Pantallas de historia**: casa del Avatar + «The Dream» (art EGA — extraer del binario/ficheros de endgame, NO redibujar).
7. **Pergamino**: ya existe en el port — verificar byte-exacto contra frames (runas incluidas) + fanfarria final.
8. **Censo de sonidos**: combate (bloque 5-24s), ping transición-verde (~27s), pings de página (~110/114/128s), fanfarria del pergamino (142-149s). Derivar rutinas PC-speaker del disasm.
9. **Estado terminal**: tras el pergamino, input muerto (el original no vuelve al juego). El port debe clavar esto.

## VARIANTE SIN CAJA (2º vídeo, 1:16 — `endgame-varado-sinbox-20260721.mov`)

Mismo prólogo (combate sombras + «absorbed!» + re-tinte verde + LB de pie). Diverge en el diálogo:
- «Didst thou bring my box?» → **«You reply: No»** — la respuesta es AUTOMÁTICA (inventario/g_wooden_box), NO un prompt al jugador (igual en la victoria: «You reply: Yes»).
- **SEGUNDA OPORTUNIDAD**: LB revela la ubicación — **«The sandalwood box, from the secret passage, in my chamber!»** — y re-pregunta «Didst thou bring it?» → «You reply: No» de nuevo.
- Desenlace gag: **«I see... Well then, pull up a chair.» / «We shall be here a while.»** — **LB SE SIENTA EN LA SILLA de la mesa** (sprite sentado; el trono queda vacío). SIN moongate, SIN disolución, SIN pantallas de historia, SIN pergamino.
- **Estado final: la sala verde queda JUGABLE pero SIN SALIDA** — entre frames finales los personajes se REPOSICIONAN (el juego sigue aceptando movimiento), LB sentado para siempre, ningún borde/escalera funciona. Encierro eterno, no freeze. [Derivar del disasm el detalle exacto de qué comandos siguen vivos.]

GAP adicional (10): fork sin-caja completo — auto-respuesta por inventario, 2ª pregunta con pista del passage secreto, LB-sentado, sala-prisión jugable. El core ya modela `ending: "stranded"` pero sin NADA de esta presentación.

## Siguiente paso

Carril «endgame-visual» (P: alta, post-corolario-#7): derivar cada pieza del disasm
(ENDGAME_main 0x08c2 y satélites), extraer arts/strings, implementar paceado en la piel
(patrón RefugeScript de la secuencia de muerte), y validar contra ESTE testigo frame a frame.

## TESTIGO 3: entrada a Doom N1 sin caja (3er vídeo, 0:37 — `doom-entrada-n1-sinbox-20260721.mov`)

Save REAL del usuario (F:71, G:717, Mariah 2HP — no loadout). Secuencia:
- En la ENTRADA (isla Underworld): «Slow progress!» al andar, (U)se → «Item: None!», **Yell «VERA…» (VERAMOCOR)** para abrir.
- Nada más entrar a N1: **AMBUSH de SOMBRAS en PASILLO** — combate normal de mazmorra en la arena de MUROS MAGENTA ondulados + suelo rojo moteado (combatmap de pasillo de Doom; identificar cuál del .CBT 0-15). 4-5 sombras (mismo sprite silueta-azul clase 0x3c del endgame).
- Las sombras de pasillo pelean como monstruos NORMALES (prompts de combate, targeting, «Blocked!») — **NO se observó «is absorbed!» en pasillo** (la absorción parece EXCLUSIVA del combate final en la celda de LB — pendiente de derivar el gate).
- **(U)se Sceptre EN combate: «Wielding the Sceptre of Lord British...» — SIN efecto observable sobre las sombras** (el combate siguió; consistente con sceptre=barrido-de-campos, no anti-sombras — no sobreclamar sin derivación).
- La party HUYE por el borde oeste («Leave!») → vuelta al pasillo 3D iluminado («Ignite torch! / View a gem!»).

Valor para el port: (a) censo del combatmap-pasillo de Doom (muros magenta) para pixel-diff; (b) sombras como wandering-monsters de Doom con combate NORMAL (sin absorb) → el absorb del endgame es contextual a la celda de LB, no del enemigo per-se — refina GAP 1; (c) witness del yell VERAMOCOR + Slow progress en la isla.

## TESTIGO 4: combate de sala Doom L6 (4º vídeo, 9:16 — `doom-n6-combate-20260721.mov`)

Sala de la cruz con lava y ESQUINAS-nicho (floor 5; candidata cm120 de la ficha). Save loadout (party 6, F:9999). Observado:
- Bando enemigo MIXTO: ~7 SOMBRAS + Dragones verdes + Daemon; monstruos VERDES atrapados en los nichos-esquina negros (los compartimentos DURA de la ficha).
- **«Dragon gates in a daemon!» / «Daemon gates in a daemon!» en vivo** — invocación de refuerzos ✓ YA EN PORT (gatesInDaemon 0x0004 + picker global, oráculo relevo-5).
- **Las SOMBRAS aquí NO absorben** (9 min de combate, solo daño normal) — 2ª confirmación de que el absorb es contextual a la celda de LB (junto a testigo-3 pasillo N1).
- **Las murallas MAGENTA se ERosionan durante el combate** (arcos N/S completos al inicio → fragmentos → sliver al final). Hipótesis: campos destruibles/disipables o paso de monstruos — DERIVAR encoding (¿tiles 0x7X en rejilla? conecta con auditoría #2 tile-grid).
- XEN CORP mata dragones → COFRES en el suelo (botín de cadáver en sala) ✓.
- Desenlace: party huye por el sur → **«Escape!» + «BATTLE IS LOST!»** → pasillo 3D. ✓ YA EN PORT (combat.ts:899). Consistente con #13: sin victoria no hay mark.

Valor: testigo de VALIDACIÓN (summon + battle-lost + botín ya fieles); único derivable nuevo = la EROSIÓN de murallas magenta.

### Testigo 4 — ADDENDUM (dato del usuario): las murallas magenta las disuelve el CETRO

Identificación de sala: **cm120 (Doom r8, floor5 (3,3))** — la sala de la ficha «lava y 4 esquinas».
- **f058: «Use item → Item: Sceptre → Wielding the Sceptre of Lord British...»** (texto idéntico al port, CAST 0x1966) → la muralla magenta NORTE desaparece en los frames siguientes; **la SUR (lejos del portador) SOBREVIVE** ⇒ el barrido del original es **LOCAL** (radio corto alrededor del portador), NO de mapa entero. **VALIDA el port**: `sceptreDissolveFields` (combat.ts:443) barre 3×3 con (t&0xf0)==0x70 → fidelidad de localidad CONFIRMADA con testigo.
- ⇒ Las murallas magenta = tiles 0x7X EN REJILLA (clase tile-grid de la auditoría #2, la misma familia que la barrera de cm115/#99) — NO son unit-sprites inertes.
- **CONSECUENCIA DE CAMPAÑA: el sello DEAD-END-fiel de cm120 (ch27 r8) queda EN DUDA** — el arnés no usó cetro-barrido táctico; con las murallas disueltas los enemigos tras ellas podrían ser alcanzables. → RE-MEDIR cm120 con táctica cetro en VENTANA-#13/lote-2 (y revisar si cm116/r4, el otro dead-end de ch27, tiene murallas 0x7X). El del usuario acabó en huida (no prueba VICTORY), pero abre la puerta.
- BONUS 2 (f045): **scroll «Negate time!» → la PANTALLA ENTERA SE INVIERTE de colores** mientras dura el time-stop (murallas magenta→verdes, lava→azul, sombras→rojo). Mecánica visual del time-stop NO modelada en el port (An Tym congela pero no invierte) — DERIVAR: ¿la inversión es del scroll/time-stop en general? Conecta con snap.timeStopped de la piel.
- Comentario stale corregido en combat.ts:438 (decía «la arena no coloca 0x70-0x7f» — falso para salas con muros de rejilla, auditoría #2).

## TESTIGO 5 (playlist aulddragon, Part 24): animación de IN VAS GRAV CORP — HUECO NUEVO

Frame del usuario (LP DOS confirmado — chrome EGA idéntico): cast de In Vas Grav Corp en combate
de mazmorra → **ABANICO/SPRAY de rayos AZULES** que emana del caster abriéndose hacia la
dirección (Direction-North), cubriendo un cono ancho de varias celdas de alto.
- PORT: mecánica COMPLETA en main (castLineAoe modo 4: bolt+saving INT+99 fijo, LOS 0x6a86) pero
  **la piel NO pinta ninguna animación para los 4 hechizos de línea** (In Zu / In Nox Hur /
  In Flam Hur / In Vas Grav Corp) — grep skin/: cero referencias a lineAoe.
- DERIVAR: la rutina del spray (¿COMBAT.OVL cerca del aplicador 0x1c36?%) — nº de rayos, orden,
  color por hechizo, duración, sonido. El VÍDEO (Part 24 de la playlist) da la animación en
  movimiento + audio para careo. → cola fx-lineaoe (carril futuro).
- CONFIRMA el valor del carril yt-witness: la playlist es VERSIÓN DOS.
