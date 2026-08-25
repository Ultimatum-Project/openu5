# Diff masivo OCR-logs ↔ inventario de strings del port (fase final YT)

Carril diff-masivo, 2026-07-22. Detector en masa de flujos AUSENTES: TODO el texto de
consola de los 2 walkthroughs (aulddragon part01-24 + Alex Diener ad_ep03-21, OCR-logs
de `original/av-referencia/yt/clips/full-part-logs{,-ad}/`) diffeado contra el
inventario canónico del port (corpus `game/tools/i18n-corpus.mjs` = approved-strings +
literales core AST + assets extraídos; 5.624 strings), con verificación de cada
superviviente contra los binarios originales y comprobación negativa en `game/src`.

**Herramienta re-ejecutable:** `re/tools/diff-ocr-masivo.py` (uso documentado en su
docstring; corpus se vuelca con node desde `i18n-corpus.mjs`). Cero código del juego
tocado; cero navegadores.

## Funnel (ejecución 2026-07-22, 35 logs)

| Etapa | Valor |
|---|---|
| Líneas brutas OCR | **162.118** (24 eps aulddragon + 11 eps Alex Diener) |
| Candidatas tras extracción (sin spam mov./ecos `:KEYWORD`/<8 chars/ratio-letras<0.5) | 107.956 |
| Casadas contra inventario (instancias) | 21.608 |
| No-casadas (instancias / únicas) | 86.348 / 17.714 |
| Supervivientes con cita binaria y SIN match en `game/src` | **40** |
| → tras revisión manual: strings realmente ausentes del inventario | **0 nuevas** (todo = ya-en-auditoría o artefacto; ver §3) |

Tiers de matching (claves únicas): exact 251 · substring 1.470 · composed-prefix 464
(prompt+eco, p.ej. «On who: Min», «Attack-Aim!») · template 258 · template-composed 39
(dígitos/plantillas `% ^ # $ @`) · fuzzy 322 · fuzzy-substring 275.

Clases de no-casadas únicas: GARBAGE 7.631 (OCR ilegible, dominado por los eps AD:
`Ww wogqss`…) · FRAGMENT 704 (wrap a 15-16 cols de composiciones: `with Sling:`,
`Helm, Magic Axe`) · NUMERIC 165 (interpolaciones con cantidades) · CANDIDATE 9.214
(resto; sin cita binaria = artefacto OCR con letras plausibles).

## 1. HUECOS NUEVOS (no están entre los 31 de `auditoria-cobertura-completa.md`)

| id propuesto | claim | cita binaria | comprobación port | testigos OCR |
|---|---|---|---|---|
| `shoppe-reagent-confirm-chain` | El Magic Seller original, al elegir reactivo, imprime el PITCH del reactivo (SHOPPE.DAT: «This Ginseng variety imparts…», «…forced to ask % gold per root», etc.) + confirmación **«Is this thy need?" » Y/N** → No: «What else?» / Yes: «"I thank thee!"\nsays $.» + «Anything else?». El port (`shop-console.ts` `pickReagent`, :1119) salta directo pick→`buyReagent`→mensaje, SIN pitch ni confirmación. | **DS 0x7956** (` Is this thy need?" `), **0x7970** (`No\n\n"What else?\n\n`), **0x7988** (`\n"I thank thee!"\nsays $.\n`), **0x79a2** (`"Anything else?\n\n`) — las CUATRO empujadas por SHOPPES.OVL. [CORREGIDO t#57: la cadena decía 0x7974/0x7986/0x7997/0x79ad, ninguna inicio de nada ni presente en ningún .asm; los desvíos iban en las dos direcciones (+14, +1, −1, −5), pinta de lectura a mano de un volcado hex]; pitches SHOPPE.DAT 0x1ada-0x1f4x (p.ej. Ginseng 0x1c7c, Mandrake 0x1f05) | `grep "Is this thy need" game/src/**/*.ts` = solo es.json/data.json, ningún consumidor; `pickReagent` sin cadena | part06:583-585, part08:204/303/422/441/469/497/651/1763/1765 (≥10 avistamientos) |
| `cast-on-who-prompt` | Prompt de objetivo de hechizo sobre jugador **«On who: »** (pool de combate/cast junto a «None!», «Not dead!», «Field destroyed!», «Direction-»). El original lo imprime al castear curas/etc. y añade el nombre («On who: Min»). El port no lo emite en ningún sitio (usa el picker «Player: » DS 0x96b4 para otros flujos). | **DS 0x94f4** (`On who: `, CAST2), pool 0x94f8-0x955x — [CORREGIDO t#57: decía DS 0x9507, que cae en la `h` de «w|h|o»] | `grep "On who" game/src/**/*.ts` = sin consumidor (solo data.json/es.json) | **83 instancias** en los logs (part02/05/09/16/17/20/22/23…): «On who: Min/Iolo/Jaana/Julia/Johne» |
| `i18n-corpus-sin-endgame` (estructural) | `i18n-corpus.mjs` NO lee `game/assets/endgame.json`: toda la superficie del endgame (diálogo de LB «Didst thou bring my box?»…, ENDMSG.DAT) queda FUERA de la guarda anti-fabricación del corpus. ENDMSG.DAT es el único .DAT de texto sin superficie en el corpus. | ENDMSG.DAT 0x2d+ ↔ `game/assets/endgame.json` (contenido presente, superficie sin registrar) | `grep endgame game/tools/i18n-corpus.mjs` = 0 hits | part24:1643-1673 (30 líneas del diálogo final casan contra endgame.json pero NO contra el corpus) |

Nota sobre los 2 primeros: son huecos de **cadena de presentación** (strings presentes
en el inventario/assets pero flujo no cableado) — el diff de inventario puro dio 0
strings nuevas ausentes; estos dos salieron del análisis dirigido de los supervivientes
de alta frecuencia (mismo criterio «en-inventario-pero-sin-consumidor» que la regla de
cadena-de-presentación de `ui-flow-fidelity-gap`).

## 2. Solapes con la auditoría (ya-en-auditoría) — ahora CON testigo vivo OCR

| id auditoría | testigos OCR nuevos (ep:línea) |
|---|---|
| `shrine-approach-lines` (MISCMSG 0xa59/0xa86/0xaa4) | «…tranquil / Shrine...» ×14/×10: part06:1488-1489, part07:476-477, part08:22-23, part09:4743, part10:4108, part12:34; «lies before» part07:811; «Fore thee» part10:7402 |
| `str-miscmsg-lessons` + `codex-lesson-swap` (lecciones largas 0x4AB-0x6BB) | vistas EN VIVO en lecturas del Codex: Avaricia «they who will not share their fortune with those around» part07:822-825 (0x5ec-0x617); Orgullo ««Pride is a vice, …» (84 B, sha1 28f202fc — recortado; verifica contra tu copia)» part07:1834-1839 (0x6bb-0x6ff); «…thyself and thy / being is to…» part10:749-773 (0x682/0x6aa); «…and thus (know not themselves)» part11:6575 (0x561); «treatment unto» part12:2864 (0x5bb); «temporary gain,» part13:1142 (0x4cd). Confirma que el original imprime las LARGAS donde el port imprimiría las cortas. |
| `str-sea-echo` («Rowing!» 0x2986 / «Hull weak!» 0x2992) | «Rowing!» ~40× en part05 (739+…), también part07/12; «Hull weak!» part12:2148 ×3 |
| `interrogation-sand-threat` / familia Blackthorn | cartel «BLACKTHORN'S LAW OF JUSTICE…» leído en part02:315-325 (en signs.json — el careo de la escena de interrogatorio queda para el carril Blackthorn) |
| camp/apparition (ya-censado Clase-C, discurso KARMA #47) | «(strangely) familiar old man (vanishes)» part09:4507/4528, part10:4647, part12:2982 (**DS 0x77f8**, OUTSUBS 0x0964; string EN corpus, escena censada) |

## 3. Descartes de los 40 supervivientes (revisión manual, por clase)

- **Ya-en-auditoría (21):** todo el cluster MISCMSG de §2 (shrine-approach + lecciones).
- **Composición prompt+eco / sufijo+eco (9):** `thy need?" Yes|No` (fragmento-sufijo del
  hueco NUEVO §1), `vessels?" No`, `thou like?" 102|10d` («How many wouldst thou like?»
  **DS 0x9c4a**, SHOPPES2 0x040a, + eco), `ask 50|16 gold per`, `15|18 gold for eac(h)` (plantillas `%` de
  shoppe.json; el mapa fuzzy 1→l/8→b rompe el blanqueo de dígitos — limitación anotada).
- **Artefactos OCR de strings EN corpus (10):** `a 8hard of the` (=«a Shard of the Gem
  of Mondain!», look2.json; 8→S no mapeado), `faml]]ar old ma`, `ge]] the finest`,
  `Hal] wayfarer`, `of ]]ght guard` (=«May the powers of light guard thy soul.»,
  shoppe.json), `] ,Here lie` (SIGNS gravestone, en signs.json), `]LAW 0F JUSTICE`
  (cartel Blackthorn, en signs.json), `8word and 5hlel`, `f...Si[ver Swor`,
  `Wayfarer Inn,`, `Tu]k-Funny, no` (=«Talk-» + «Funny, no response!», ambas en port).
- Falsos «ausentes» notables cazados en la calibración v1 (todas composiciones de
  strings del port): «Attack-Aim!» = `CMD_STRINGS.attack`+`COMBAT_STRINGS.aim`
  (cmd-strings.ts:185), «Sound Off» = `Sound `+`Off\n` (familia Ctrl ya-en-auditoría
  `ctrl-s-sound`).

## 4. Limitaciones honestas

- Los logs AD (ep05/09/12…) traen tramos de OCR ilegible (gutter/panel movido) → clase
  GARBAGE 7,6K únicas; sin cita binaria no contaminan el resultado.
- Líneas <8 chars filtradas por encargo: ecos monosílabos («Yes», «No», «Hic!») no se
  auditan por esta vía.
- Sin timestamps en los logs: localización = ep:número-de-línea (muestreo ~2fps;
  minuto ≈ línea/total × duración del ep).
- El diff es de INVENTARIO: un string presente en assets pero jamás emitido solo se
  caza si aparece en un cluster de alta frecuencia y se verifica a mano el consumidor
  (así salieron los 2 huecos nuevos). El barrido sistemático de «en-corpus-pero-sin-
  consumidor» es otro carril (complementario a la auditoría de 62 agentes).
