# CENSO de eventos especiales y jugabilidad para vídeo — carril videos-eventos (21-08)

Derivado del código (no de oídas): cada fila cita fichero:línea del port. Los vídeos NO se
commitean (decisión usuario 11-08: material EA servible, JAMÁS tracked); este censo y el
arnés SÍ. El arnés vive en `game/tools/videocap/` y NO entra en ninguna config playwright
(usa la librería directamente — población de la foto intacta).

## Infraestructura que condiciona todo (medida por los exploradores del carril)

- **URL canónica**: `/?skin=<shader|faithful>&nointro&combeat=400` — bajo `navigator.webdriver`
  el beat de combate es 0 (main.ts:1762) y el combate saldría instantáneo; `combeat=400` lo
  devuelve al ritmo humano. `?scenebeat=` ralentiza/acelera escenas modales (main.ts:930).
- **Siembra de estado**: (a) `u5clone:save:<id>` en localStorage + `?save=<id>` (patrón
  `partida-graba.mjs:80-92`); (b) `__u5test.loadNativeSave(gam, sidecar)` con pares de
  `game/e2e/espejo-tour/saves/` (patrón `checkpoint.ts`); (c) deep-link DEV
  `?loc=&x=&y=&floor=&hour=&seed=`; (d) momentos 01..10 (`momentos/defs.ts`) horneados con
  `horneaMomento` (patrón `partida-graba.mjs:66-92`).
- **Teclas**: SIEMPRE por el handler real (`page.keyboard.press` / `locator("body").press`)
  — patrón «organic» de fix-375 (receta `game/e2e/dungeon-room-escape.spec.ts`).
- **Espera de FX**: `__u5test.fxActive()` (main.ts:6309) antes de cortar la grabación.
- **AUDIO — limitación declarada**: el `.webm` de Playwright NO captura audio. Los cues de
  cada evento se rinden aparte a WAV con el `renderCue` real
  (`game/tools/audiodiff/render-cues.ts`, `npm run re:audiodiff:render`) y acompañan a los
  vídeos en la entrega. No se muxea por timeline en esta tanda (alternativa documentada:
  usar los eventos de cue como marcas de tiempo + amix de ffmpeg).
- **Vídeo**: contexto Playwright `recordVideo` 1280×800 (= viewport, captura 1:1 sin
  reescalado — lección pagada en `playwright.grandtour.config.ts:43`), `trace` fuera.
  Los 8 guiones de `game/partidas/guiones/` se reutilizan tal cual vía el arnés #158
  (`partida-graba.mjs` + `partida-render.mjs`) donde ya cubren el evento.

## Tabla del censo

Piel: «2» = grabar fiel Y shader (FX de pantalla distinguibles); «1» = una basta (la escena
es fiel en ambas pieles o el FX es idéntico). Duración = estimación derivada de constantes
del código citadas por el censo (QUAKE_DURATION_MS=936, wellDoneInvertWindowMs≈6277, EG_*…).

### P1 — encargo explícito

| # | Evento | Disparo (estado + teclas) | Audio (cues) | Piel | Dur. |
|---|--------|---------------------------|--------------|------|------|
| 1 | Ceremonia del Códice (bracket XOR ×3 + quakes) | 8/8 santuarios (`shrineVisitedBitmap=0xFF`, shrines.ts:202) + pisar tile 0x11 → `E` + 9 keywaits (shrine-ceremonies.ts:399) | quake ×3 | 2 | ~40 s |
| 2 | Captura de Blackthorn (cutscene entera) | Palacio loc 18 sin insignia, moverse adyacente a guardia (blackthorn-capture.ts:267); interrogatorio 4 rondas (mantra + Enter) | blackthorn-materialize, shard-sweep | 2 | ~90 s |
| 3 | Absorción + desenlace Lord British | momento-10 (defs.ts:899): Doom p7 → combate cm127, dejarse absorber (combat.ts:1566) → endgame (sequence.ts:166, 9 fases) | combat-absorbed, endgame-orb; pergamino final MUDO | 1 | ~120 s |
| 4 | Santuario: ORDAINED | tile 0x19 sin visitar → `E` + virtud + mantra ×3 (shrine-ceremonies.ts:515) | shrine-ordained (7 notas) | 2 | ~40 s |
| 5 | Santuario: WELL DONE | visitado+quest → mismo ritual (shrine-ceremonies.ts:555); inversión 6 277 ms + quake | shrine-well-done, quake | 2 | ~40 s |
| 6 | Santuario: donación | visitado sin quest → prompt numérico (shrine-ceremonies.ts:675) | shrine-donation | 2 | ~25 s |
| 7 | Shadowlord en ciudad: wither + anuncio | `E` en pueblo con Shadowlord (game.ts:6812; wither 0x2D→0x2C, 0x2E→0x2B) | shadowlord-announce | 1 | ~20 s |
| 8 | Shadowlord: destrucción con shard | partidas faulinei/astaroth/nosfentor (momentos 03-05): `U`+shard con SL en (x,y−1) → 3 quakes + explosión + fanfarria (use-tools.ts:61) | shard-sweep, quake, victory-fanfare | 2 | ~60 s |
| 9 | Moongate: transit con FX (cierre 16 etapas + hold 650 ms) | puerta activa por fase lunar, caminar encima (game.ts:3171; moongate.ts:30-66) | moongate | 2 | ~30 s |
| 10 | Moongate: piedra lunar (bury/dig) + Vas Rel Por | `U` Moonstone (use-tools.ts:470); `C` Vas Rel Por (main.ts:3786) | moongate | 1 | ~40 s |
| 11 | Remolino: succión con daño | fragata + remolino alcanza (game.ts:2653; daño rand(1,30) al casco) → Underworld (0x22,0x12) | — (sin cue propio) | 1 | ~40 s |
| 12 | Healer flash (+ resurrección de pago) | `T` al curandero, pagar (shop-console.ts:689) → HealerLightFlash (invert-flash.ts:170) | shop-transaction | 2 | ~30 s |
| 13 | Resurrección por hechizo (In Mani Corp) | `C` + nombre + picker (cast.ts:288) | cast-spell | 1 | ~20 s |
| 14 | Refuge: muerte total + aparición + despertar con LB | party a 0 (game.ts:6170, 17 beats; refugeScene.ts) | refuge-thunder ×2 | 2 | ~30 s |
| 15 | Acampada + aparición de LB + bardo | `H` + horas + vigía (main.ts:5595; camp.ts:392); aparición gate 25 % (lordbritish.ts:130) — seed elegida | apparition-* ×4, bard-song | 2 | ~40 s |
| 16 | Esquife/fragata: X-it round-trip | `B` embarcar, navegar, `X` (transport.ts:662/747); esquife↔fragata | move-blocked, cannon-fire (si `F`) | 1 | ~50 s |
| 17 | Siembra de tesoro en sala de mazmorra | receta dungeon-room-escape: enterDungeon + Advance orgánico, matar (`A`+flecha), cofre por chestRoll (combat.ts:2264), `G` | combat-defeat | 1 | ~60 s |
| 18 | Bad taste (fuente de mazmorra) | fuente type 0x5 + prompt beber (dungeon.ts:1223) | combat-damage (blip) | 1 | ~15 s |
| 19 | Antorcha «Borrowed!» | `G` a sconce 0xB0/0xB1 (game.ts:5915) — receta fix-375 | torch-borrowed | 1 | ~15 s |
| 20 | Endgame completo (pergamino + freeze) | continuación de #3 (mismo vídeo o corte aparte) | mudo (fanfarria refutada, sequence.ts:28) | 1 | (en #3) |
| 21 | Combate base (inicio→VICTORY) | encuentro overworld, `A`+flechas, `combeat=400` | combat-hit/damage/defeat, victory-fanfare | 2 | ~60 s |
| 22 | Tienda: compra (armas) | `T` al tendero (main.ts:5358) + consola | — (transaction solo en healer) | 1 | ~40 s |
| 23 | Conversación NPC | `T` + keywords + bye (conversation.ts:420) | — | 1 | ~30 s |

### P2 — encontrados en el censo (no estaban en el encargo; se graban si el presupuesto de la tanda lo permite)

| # | Evento | Disparo | Audio | Dur. |
|---|--------|---------|-------|------|
| 24 | Intro/atract completa + menú | boot sin `?nointro` | intro-thunder/chime/summon, title-* | ~90 s |
| 25 | Creación de personaje (gitana/tarot) | menú → Create New Character | cues de intro | ~60 s |
| 26 | Trolls del puente (sneak) | puente a pie, gate 1/8 (hazards.ts:98) — seed | mudo | ~15 s |
| 27 | Clavicémbalo → pasadizo (13 dígitos + quake) | sentado al 0x8D, dígitos (game.ts:2870) | instrument-note, quake | ~30 s |
| 28 | Palabra de poder (sello mazmorra) | `Y` + palabra (game.ts:4995) | quake | ~20 s |
| 29 | Cataratas F-A-L-L-S!!! | tile 0xD4 al sur (game.ts:2016) | waterfall-fall | ~15 s |
| 30 | Andanada de cañón (proyectil visible) | fragata + `F` + flecha (game.ts:5090) | cannon-fire | ~15 s |
| 31 | Espejo roto | `A` a tile 0x9D (game.ts:7253) | mirror-break | ~10 s |
| 32 | Pergamino de tiempo (inversión An Tym ~2,9 s) | `U` pergamino (invert-flash.ts:33) | time-spell | ~15 s |
| 33 | Vista de gema / zodiaco | `V` (main.ts:5604) | mudo | ~15 s |
| 34 | Terremoto del Underworld | hazard 1/256 (game.ts:2349) — seed | quake | ~15 s |

## Reutilización directa (ya producidos por #158/#222, servidos en la galería)

`astaroth · nosfentor · faulinei` (=#8), `corona`, `compania`, `underworld`, `regreso` — 7
tarjetas en `game/partidas/` con guion; `blackthorn` tiene guion sin partida horneada.
Donde el evento del censo coincide, la tanda re-renderiza con `partida-render.mjs` en vez
de reinventar el guion.
