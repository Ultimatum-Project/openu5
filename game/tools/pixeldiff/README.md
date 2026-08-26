# Arnés píxel-diff (task #26)

Verificador visual: compara la **piel fiel** del port contra el **original
DOSBox**, registrando ambos por el marco del chrome y comparando por región.

Doc completa (arquitectura, formato de máscaras, fase 2):
`docs/superpowers/specs/2026-07-15-pixel-diff-harness.md`.

## Piezas

| fichero | qué hace |
|---|---|
| `pdlib.py` | núcleo: paleta EGA real (**idx6 = marrón `#AA5500`, EGA con brown-fix**), snap a paleta, registro por marco, normalización a 320×200 |
| `normalize.py` | CLI: una captura → PNG lógico 320×200 |
| `extract_ref.py` | ffmpeg: frames de un .mov/imagen DOSBox → normalizados |
| `compare.py` + `regions.json` | comparador por máscaras de región + imagen de diff + veredicto |
| `capture-port.pw.ts` + `capture.config.ts` | Playwright standalone: piel fiel en estados fijos → PNG 320×200 (`.pw.ts`, no `.spec.ts`, para que vitest no lo recoja) |
| `test_pdlib.py` · `test_compare.py` | auto-test del núcleo (snap) y del comparador (`strict_ink`) |
| **FASE 2 (mismo-estado):** | |
| `samestate.py` + `samestate-cases.json` + `regions-samestate.json` | runner mismo-estado: empareja un `SAVED.GAM` (sembrado en el oráculo, cargado en el port) y compara con modos duros (`strict`/`strict_ink`) |
| `../../../re/tools/capture_original.py` | captura HEADLESS del original desde un `SAVED.GAM` (oráculo dosbox-x, VRAM EGA → PNG 320×200) |
| `capture-port.pw.ts @samestate` | carga el mismo save en la piel fiel vía `__u5test.loadNativeSave` (`?nointro`) y vuelca el canvas |

## Uso en 2 líneas

```bash
# Port: capturar estados fijos de la piel fiel (dev-server en :5199).
cd game && npx playwright test -c tools/pixeldiff/capture.config.ts
# Comparar port vs original (crudos → se normalizan aquí).
python3 tools/pixeldiff/compare.py PORT.png ORIG.png --raw --out-dir OUT
```

Salidas (PNG) → `original/av-referencia/_pixeldiff/` (gitignored). Nunca al git.
Requisitos: `python3` con numpy/PIL/scipy; `ffmpeg` (solo para vídeos).

## Mismo-estado (FASE 2)

```bash
# Regenerar capturas (paso manual: original necesita dosbox-x, port usa Playwright):
npm run re:pixeldiff:samestate:capture
# Comparar la batería contra los manifiestos versionados (NO necesita dosbox-x):
npm run re:pixeldiff:samestate      # exit 0 ok · 2 SORPRESA · 1 faltan capturas
```

Batería (4 casos): `overworld_day`/`overworld_night`/`town_day`/`town_night`
(`samestate-cases.json`; loc/hora medidos en los bytes del save, no en etiquetas).

**Modos por región** (`regions-samestate.json`): `strict`/`strict_ink` (cromo/paneles),
`hist` (viewport/cielo: contenido con tolerancia de animación), `color` (marco 1px), y
**`lit_tiles`** (NUEVO): acuerdo espacial de la máscara de luz a nivel de celda 16×16 —
pilla un radio de máscara nocturna equivocado que `hist` (orden-independiente) NO ve, y
tolera animación. Un caso puede traer su propio `regions` y un `expect` (verdicto
esperado: una divergencia catalogada queda verde hasta que el port se arregle).

Informe de divergencias + FINDING del radio de luz nocturna del overworld:
`docs/superpowers/specs/2026-07-15-pixel-diff-samestate-report.md` (§Ampliación tanda 2).
Paso manual-explícito (NO en `verify:all`/`e2e`): el oráculo necesita dosbox-x.
