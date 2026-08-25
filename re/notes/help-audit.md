# Auditoría de la AYUDA / shell / debug del port (carril HELP-AUDIT)

Fecha: 2026-07-20 · rama `shell/help-audit` (desde `main` 1329da3c) · pilar «shell/ayuda/debug pulidos».

Objetivo: contrastar CADA afirmación de las superficies de ayuda del shell moderno con la
realidad del binario/dispatcher de HOY (tras los 15 batches del día), cazar menciones
obsoletas, teclas que faltan y mezcla EN/ES en la capa `ts()`. Verificado EN VIVO (dev
server propio :5260, pieles fiel Y shader, idiomas es Y en) leyendo el DOM real del drawer,
los `title` de los FAB y el dispatcher de teclas de `game/src/main.ts`.

Superficies auditadas: menú SISTEMA (F10) secciones Partidas/Vídeo/Audio/Teclas/Ayuda/Debug;
tooltips de los 3 FAB (⚙ sistema / ◧ piel / 🌐 idioma); paneles Guardar/Diario/Minimapa;
botonera táctil; menú DEBUG/QA (`` ` ``/F4).

## Censo afirmación → veredicto

### Sección «Teclas» (fila = tecla + qué hace) — fuente `ui/shell/sections.ts KEY_ROWS`
Toda fila cotejada contra el handler real de `main.ts handleGameKey`.

| Fila de ayuda | Realidad (main.ts) | Veredicto |
|---|---|---|
| `F10 — abrir/cerrar este menú` | `ev.key==="F10"` → `shellPanel.toggle()` (2780) — antes de todo guard | ✅ VERDE |
| `Escape — cerrar este menú o un panel abierto` | ESC cierra journal/minimap/save/selector/debug/shell si abierto; NO abre nada; si nada abierto cae al juego (2966-2980) | ✅ VERDE — refleja el veredicto «ESC es del juego, no del shell» ya aterrizado |
| `F5 — guardar / cargar partida` | `ev.key==="F5"` → `savePanel.show()` (3025) | ✅ VERDE¹ |
| `F6 — diario` | `ev.key==="F6"` → toggle `journalPanel` (3008) | ✅ VERDE¹ |
| `Tab — minimapa` | `ev.key==="Tab"` → `minimapPanel` sólo si `!dungeon && !combat` (3014) | ✅ VERDE |
| `F7 — música on/off` | `ev.key==="F7"` → `music.toggle()` (2800) — antes de guards, funciona en todo contexto | ✅ VERDE |
| `F8 — PC-speaker on/off` | `ev.key==="F8"` → `speaker.toggle()` (2788) | ✅ VERDE |
| `F9 — cambiar de piel (1988 ↔ shader)` | `ev.key==="F9"` → `swapSkin()` (2773), cicla sólo user-facing (dev jubilada #79) | ✅ VERDE |
| `` ` / F4 — menú debug (QA) `` | sólo DEV (`import.meta.env.DEV`); fila gated a `deps.openDebug` | ✅ VERDE — oculta en prod correctamente |

¹ F5/F6 quedan tras el early-return de combate/mazmorra → sólo overworld/pueblo. Coherente
tras el fix del Hallazgo B (sus BOTONES ahora comparten la misma guarda): tecla==botón en
todo contexto. VERDE.

Set de teclas del shell COMPLETO: no falta ninguna QoL (F1-F4 juego=«What?», no hay F11/F12;
Pantalla completa es botón sin tecla — correcto). Las teclas del JUEGO (letras (T)alk/(L)ook/
(Z)tats/(R)eady/combate/cofre G-O…) NO se documentan aquí A PROPÓSITO: la sección declara
«Teclas globales (QoL, NO comandos del original)». Su referencia vive en el Companion (ver
Ayuda). No es un hueco del shell.

### Secciones de settings (Partidas/Vídeo/Audio) — botones, checkboxes, hints
Todo cotejado con las deps reales de `main.ts` y los hints con el comportamiento.

| Afirmación | Veredicto |
|---|---|
| `Guardar / Cargar (F5)` botón → `openSaves` + hint «No disponible en mazmorra ni combate (igual que F5)» | ✅ VERDE tras fix Hallazgo B — `openSaves` ahora se auto-guarda `!dungeon && !combat` (e2e nuevo cubre) |
| `Diario (F6)` botón → `openJournal` + hint «…(igual que F6)» | ✅ VERDE tras fix Hallazgo B — `openJournal` auto-guardado (e2e nuevo cubre) |
| `Minimapa (Tab)` botón + hint «No disponible en mazmorra ni combate (igual que Tab)» | ✅ VERDE — `openMinimap` se auto-guarda `!dungeon && !combat` (el modelo que ahora siguen los 3 paneles QoL) |
| `Piel activa` = label vivo de la piel; botones `Piel: 1988 (fiel)` / `Piel: Shader (xBR)` saltan directo | ✅ VERDE (e2e «saltan directo»); etiquetas de piel = nombres propios, no se traducen — correcto |
| `Aspecto 4:3 época (piel 1988)` + hint CRT 1:1,2 / default píxel cuadrado (F-0) | ✅ VERDE — coincide con `aspectStretchEnabled` |
| `Pantalla completa` | ✅ VERDE |
| `Música (F7)` + hint «enhanced XMI→OGG, fiel default OFF, opt-in» | ✅ VERDE |
| `Volumen música (%)` 0-100 step 5 | ✅ VERDE — persiste en `u5.musicVolume` (e2e) |
| `PC-speaker 1988 (F8)` | ✅ VERDE |

### Sección «Ayuda»
| Afirmación | Veredicto |
|---|---|
| `Atlas y guía (pestaña nueva)` → abre `/companion/?lang=<activo>` en pestaña aislada | ✅ VERDE (e2e «abre el companion en pestaña nueva») |
| Hint del atlas | ⚠️→✅ **CORREGIDO** (Hallazgo A): el hint NO mencionaba que el Companion incluye la **referencia de controles/comandos** del juego (pestañas «Controles» + «Chuletas rápidas»). Añadido «controles del juego» al hint (EN base + ES). Ahora el jugador que busca «¿cómo se juega / qué teclas?» tiene el puntero correcto sin duplicar el manual en el shell. |

### Tooltips de los FAB (`ui/shell/gear.ts`, `shellToolbar`, switchers)
| Tooltip | Vivo | Veredicto |
|---|---|---|
| ⚙ | `Menú sistema (F10)` | ✅ VERDE (sólo F10; ESC ya no abre) |
| ◧ piel | `Cambiar piel` | ✅ VERDE |
| 🌐 idioma | `Idioma / Language` | ✅ VERDE (bilingüe a propósito) |

### Menú DEBUG/QA (`` ` ``/F4, sólo DEV) — `debug/registry.ts`
Abierto en vivo; secciones y labels cotejados con los campos reales de estado y con
`e2e/debug-menu.spec.ts` (10 tests verdes).

| Ítem | Veredicto |
|---|---|
| Atajos: Maximizar todo / Mejor equipo para todos / Party completo al máximo | ✅ VERDE — funcional en vivo (party a C:99, e2e «no mueve la semilla») |
| Teletransporte (Localización 0-32 + Underworld; Planta dinámica; Mazmorra 33-40 con badge **RNG** rojo «flujo real») | ✅ VERDE — el badge dice la verdad (entrada NO cero-rand) |
| Party / Recursos / Mundo-Reloj / Trama-Quest / Moonstones / Inventario (Reactivos/Equipo/Hechizos/Pociones-Pergaminos) | ✅ VERDE — labels = campos reales del SAVED.GAM; escrituras vía `DebugApi` cero-rand (e2e Oro/Hora/Spyglass) |
| `` ` `` togglea el drawer; el juego sigue respondiendo con el drawer abierto | ✅ VERDE (e2e) |

### Capa i18n del shell (`i18n/shell.ts` `ts()`)
- Identidad EN estricta: drawer 100% inglés bajo `?lang=en` (verificado en vivo — CERO fuga ES).
- ES: drawer 100% español bajo `?lang=es` (verificado en vivo, pieles fiel Y shader).
- Todos los strings user-facing de los paneles (save/journal/minimap/selector/touch) enrutan
  por `ts()`; los `textContent=` crudos reciben valores YA traducidos. CERO hardcode con fuga.
- ✅ VERDE.

## Hallazgos

### A (CORREGIDO en esta rama) — hint del Atlas no anunciaba la referencia de controles
Fix aplicado: `sections.ts` + `i18n/shell.ts`, el hint del botón «Atlas y guía» ahora cita
«controles del juego». Puramente aditivo, capa shell, sin tocar mecánica. gate verde.

### B (RESUELTO — ruling del lead: OPCIÓN 1) — asimetría tecla-vs-botón de Guardar/Diario
Realidad medida (antes del fix):
- Las TECLAS `F5` (guardar) y `F6` (diario) quedan DETRÁS del early-return de combate/mazmorra
  en `handleGameKey` (`if (game.combat) return` / `if (game.dungeonState) return`, ANTES de
  llegar a los handlers F5/F6) → muertas en combate y en mazmorra.
- Pero los BOTONES del menú «Guardar / Cargar» y «Diario» llamaban `openSaves`/`openJournal`
  DIRECTO, **sin guarda** → abrían en combate y en mazmorra.
- El Minimapa YA era coherente: tecla (Tab) Y botón (`openMinimap`) se guardan `!dungeon &&
  !combat`, con el hint documentándolo.

**Fix aplicado (Opción 1, autorizado por el lead):** `openSaves` y `openJournal` adoptan la
MISMA guarda que `openMinimap` (`!dungeonState && !combat`). Ahora los 3 paneles QoL son
uniformes tecla==botón: en overworld/pueblo abren; en combate/mazmorra se auto-guardan (el
menú se cierra, el panel no abre) — mismo patrón bendecido del Minimapa. Preserva la fidelidad
del early-return del juego (no hay guardado a media pelea) [PROSA-AUTOFIEL: sin derivación citada
— barrido tanda 2, 07-27; el early-return del original no se cita en esta nota]. Añadidos sus hints («No disponible
en mazmorra ni combate (igual que F5/F6)», EN base + ES).
- Tocado: `main.ts` (deps `openSaves`/`openJournal`) + `sections.ts` (hints) + `i18n/shell.ts`
  (ES). Cero mecánica/RNG.
- Test e2e nuevo (`shell-menu.spec.ts`): entra a mazmorra (Deceit, flujo real → `dungeonState`,
  misma rama que combate), abre el shell por el ⚙ y verifica que los botones Guardar y Diario
  NO abren su panel. Verde.

## Gate (final, tras Opción 1)
- `tsc --noEmit`: verde.
- `vitest run`: **2441/2441** (191 files).
- `playwright e2e/shell-menu.spec.ts (12/12, incl. el nuevo) + e2e/debug-menu.spec.ts (10/10)`.

## Capturas
`docs/verdicts/help-audit/`: before/after SISTEMA (es/fiel, es/shader, en/fiel) + debug-QA.
El fix A y los hints B viven en el `title` del botón (tooltip), verificados por atributo.
