# Índice del corpus OCR del ESPEJO-2 — LP2 = Alex Diener (25 episodios, 720p)

Carril espejo2-corpus (2026-07-23). El segundo walkthrough completo archivado en
`original/av-referencia/yt/` es el LP de **Alex Diener** («Let's Play Ultima V»,
25 episodios, 1280×720, ~19.7 h de vídeo). Lord Fenton y Sinatar NUNCA se
descargaron (solo `inventory.json` en sus directorios) — los candidatos del censo
quedaron en inventario; el LP descargado y ahora explotable es este.

**Corpus**: `original/av-referencia/yt/clips/full-part-logs-ad/ad_epNN.ocrlog.txt`
(gitignored — verificado `git check-ignore`). Mismo formato que los logs de
aulddragon: líneas OCR del panel de mensajes deduplicadas por solape de scroll,
**sin timestamp por línea** (los de aulddragon tampoco lo llevan; es el formato
que consume `game/e2e/espejo-tour/tools/segment.mjs`).

## CORRECCIÓN sobre el cierre 49/49 de ocr-log-index.md (2026-07-22)

El sweep AD original salió con **bbox de autobox roto en 20/25 episodios**: los
ficheros tenían miles de líneas (por eso «0 vacíos» pasó) pero eran **basura
ilegible** (0 líneas con vocabulario real del juego en ep03-06/08-14/16/18-25;
verificado por grep de vocabulario el 2026-07-23). Solo los 5 re-runs con bbox
manual (Ep01/02/07/15/17) eran legibles.

**Re-OCR 2026-07-23 (este carril)**: los 20 episodios rotos se reprocesaron con
`ocr_video.py`/`ocr2.py` (OCR por plantilla EGA, el de aulddragon) a 2 fps, con
**box elegido por sondas en frames de juego** (8:00/12:00/20:00, puntuadas por
vocabulario OCR real) y **validación por episodio** (≥50 líneas con vocabulario
del juego; real: 438-1113 por ep). Box ganador en los 20: `160,0,1120,692`.
Marcadores de checkpoint `.epNN.rerun-ok` (JSON con box/líneas/validación) junto
a los logs. **Los 25/25 son ahora legibles.**

## Tabla por episodio

«Señal» = líneas que casan vocabulario del juego (proxy conservador de calidad;
el resto del volumen es spam de movimiento, ecos de tecleo, redibujados y tramos
sin panel — ruido estructural, igual que en el corpus aulddragon). Hitos = hits
de keywords en el OCR (×N) — orientan qué cubre el episodio, no son censo.

| Ep | Título | Min | Líneas | Señal | Hitos gruesos (OCR) |
|---|---|---|---|---|---|
| E01 | Ignite torch | 39 | 3217 | 499 | Mantra×6, Yew×5, shrine×4, Shadowlord×2 |
| E02 | Worse off than before | 60 | 10692 | 496 | camp×18, Yew×6 — party wipe temprano |
| E03 | Thou art under arrest | 31 | 2708 | 473 | arresto+prisión; Shadowlord×7, Blackthorn×6, Empath×5, resurrect×4, apparition×2 |
| E04 | Real progress at last | 43 | 4899 | 765 | Mantra×11, shrine×7, Blackthorn×4, Crown×3 |
| E05 | Wandering around | 48 | 4736 | 752 | Shadowlord×11, Lycaeum×9, shrine×8, Deceit×5, Moonglow×4 |
| E06 | Dragons! | 52 | 5337 | 878 | Wrong×6, camp×5, resurrect×3, Skara/Paws/Trinsic |
| E07 | Grappling hook please? | 53 | 5576 | 884 | Blackthorn×19, Mantra×15, shrine×13, Shard×8, **Captured×8**, Serpent's×7 |
| E08 | Deadly dungeon Deceit | 47 | 4804 | 586 | Deceit (muerte en mazmorra), Mantra×11, Buccaneer×7 |
| E09 | A glimpse of the Underworld | 52 | 6677 | 675 | Underworld, Mantra×12, shrine×11, Amulet×4, Destard×2, Sceptre×2 |
| E10 | Collecting words | 51 | 5258 | 812 | Words of Power; Cove×7, Empath×5, Despise×3, Shard×4 |
| E11 | The Crypt | 43 | 4979 | 475 | Blackthorn×12, Serpent's×11, Magincia×10, Covetous×2 |
| E12 | Blackthorn is not a nice guy | 54 | 6808 | 1113 | captura por Blackthorn; Mantra×21, shrine×12, Word of Power×2 |
| E13 | Recruiting adventurers | 58 | 5669 | 726 | Mantra×17, shrine×14, Trinsic×4, Hythloth×2 |
| E14 | Stonegate | 47 | 5872 | 670 | **Stonegate** (aulddragon no lo pisa), Shadowlord×7 |
| E15 | Hythloth | 44 | 5837 | 438 | **Hythloth completa** (aulddragon: 0 menciones), Crown×7, Sceptre×5 |
| E16 | Nosfentor | 36 | 4154 | 553 | shard/Shadowlord (Nosfentor), Amulet×2 |
| E17 | Deceit, less deadly this time | 46 | 11419 | 759 | Deceit×7 victoria, Underworld×5, Shard×4 |
| E18 | Faulinei | 38 | 8108 | 548 | Shard×9, Shadowlord Faulinei, Doom×2 |
| E19 | The Prison Wrong | 52 | 12228 | 705 | **Wrong completa**, Crown×11, resurrect×6 |
| E20 | Shard of Hatred | 52 | 15149 | 886 | tercer shard, Underworld×3, Amulet×6 |
| E21 | Astaroth | 37 | 5338 | 580 | Shadowlord Astaroth, Sceptre×12 |
| E22 | Johne, where are you? | 42 | 5270 | 530 | Johne/Underworld, Crown×8 |
| E23 | Nearing the end | 32 | 6959 | 493 | Mantra×25, shrine×8, Wrong×3, prep final |
| E24 | Shame | 50 | 7968 | 547 | **Shame completa**, Sceptre×2 |
| E25 | Doom (finale) | 77 | 10224 | 683 | **Doom + ENDGAME legible** («Barnabas is absorbed!», «Shamino is absorbed!», absorbed×4), Sceptre×39, resurrect×3 |

Total: **~170K líneas / ~19.7 h**. Fuente por episodio: Ep01/02/07/15/17 = re-run
bbox-manual 2026-07-22 (yt-witness); resto = re-OCR probe-box 2026-07-23.

## Cobertura vs aulddragon (espejo-1) — grep cruzado de ambos corpus

- **Beats que el LP1 NO tiene** (0 hits en full-part-logs/part01-24): **Stonegate**
  (E14), **Hythloth** (E15), **Destard** (E09: auld=0, AD=6), **Covetous** (E11).
  Además AD aporta: party-wipe temprano + resurrección (E02/E03), captura por
  Blackthorn con Captured en pantalla (E07/E12), muerte real en Deceit (E08),
  y una ruta mucho más densa en mazmorras (Wrong auld=6/AD=14, Shame auld=2/AD=4,
  Despise auld=2/AD=7).
- **Compartido** (careo doble-testigo posible): Deceit, Doom+endgame (absorbed en
  ambos: auld=6, AD=4), shrines/mantras, Words of Power, shards y Shadowlords,
  acampada+aparición (camp/apparition marcados en E02-E04/E06/E10/E16/E18/E21).
- **Ruta**: aulddragon = ruta canónica pueblo-céntrica; AD = ruta mazmorra-céntrica
  con más muertes/resurrecciones — complementarias para el diff de flujos ausentes.

## Consumo

Listo para `segment.mjs`/`curate.mjs` (mismo formato que partNN.ocrlog.txt). El
diff masivo (`re/tools/diff-ocr-masivo.py`) ya apuntaba a `full-part-logs-ad` —
**sus resultados previos sobre los 20 eps basura deben considerarse inválidos y
re-correrse** sobre este corpus.
