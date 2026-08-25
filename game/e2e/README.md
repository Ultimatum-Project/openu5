# E2E — Journeys de Playwright (clon de Ultima V)

Suite end-to-end que conduce el **juego real en un navegador** (Chromium vía
Playwright) por sus rutas críticas: creación de personaje, movimiento, comandos,
tienda, combate, mazmorra, magia, guardados y paneles. Es la red de regresión de
la capa de UI/integración; la paridad exacta contra el binario original la cubre
`re/` (ver `npm run re:parity:all`).

## Cómo correr

```bash
# Desde la raíz del monorepo
npm run e2e            # toda la suite (headless)
npm run e2e:ui         # modo UI interactivo de Playwright (-w game)

# O dentro de game/
npx playwright test                      # todo
npx playwright test panels.spec.ts       # un spec
npx playwright test --repeat-each=3      # estabilidad (flake hunting)
```

### Requisitos previos

1. **Assets extraídos.** Los journeys arrancan de la plantilla `INIT.GAM` real.
   Si falta `game/assets/initial-state.json`, `global-setup.ts` aborta la suite
   con un mensaje claro. Genéralos una vez:

   ```bash
   npm run extract        # extractor/ → game/assets/*.json
   ```

2. **Chromium de Playwright instalado.** La primera vez:

   ```bash
   npx playwright install chromium
   ```

## Arquitectura

- **Dev server reutilizable (puerto 5199).** `playwright.config.ts` levanta
  `vite --port 5199 --strictPort` con `reuseExistingServer: true`: si ya tienes
  un `npm run dev` en 5199, la suite lo reutiliza en vez de arrancar otro (y no
  lo mata al terminar). `baseURL` apunta ahí.
- **`workers: 1` (serial).** Los specs comparten `localStorage` y el mismo dev
  server; correr en serie evita interferencias. Cada test recibe igualmente un
  contexto de navegador limpio, y `gotoGame`/`createCharacter` hacen
  `localStorage.clear()` en un `addInitScript` antes de navegar.
- **Hooks dev-only (`window.__u5test`).** En modo dev, `main.ts` expone un hook
  de test con `state()` (lee el `GameState` real), `game` (la instancia `Game`,
  p.ej. `game.combat`) y `reseed(seed)` (siembra el ÚNICO stream vivo,
  `game.liveRng`, que gobierna todo el turno). Sustituyó al viejo
  `setEncounterRng(fn)` cuando se unificó el RNG (F.2): ya no hay una fuente de
  encuentros aparte que inyectar. NO existe en el build de producción. Los
  helpers lo consumen; ver `helpers.ts`.
- **Deep-links de posición/hora/seed.** En dev, los query params
  `?x&y&loc&floor&hour&seed` fijan posición, reloj y semilla del stream vivo vía
  el deep-link de `main.ts`, para arrancar un journey reproducible en una casilla
  concreta sin caminar hasta ella. `gotoGame(page, {loc,x,y,hour,seed})` los usa;
  `seed` se aplica ANTES de la pantalla de título (antes de cualquier turno).

## Helpers (`helpers.ts`)

| Helper | Qué hace |
| --- | --- |
| `gotoGame(page, params?)` | Arranca partida desde INIT ("Journey Onward"); deep-link opcional de posición/hora. |
| `createCharacter(page, name, gender, answers)` | Crea personaje por el cuestionario de la gitana (nombre → Speak → M/F → 7×A/B). |
| `readState<T>(page, expr)` | Lee una sub-expresión del `GameState` real (`"gold"`, `"position.x"`, `"characters[0].strength"`). |
| `inCombat(page)` | `true` si `game.combat !== null` (el modo no vive en `GameState`). |
| `hudLog(page, lines?)` | Últimas líneas del log del HUD (`.hud-log`). |
| `pressAndLog(page, key, lines?)` | Pulsa una tecla y devuelve el log resultante. |

## Mapa spec → journey

| Spec | Ruta que cubre |
| --- | --- |
| `title.spec.ts` | Smoke de la pantalla de título. |
| `hooks.spec.ts` | Los hooks dev-only (`__u5test`, `reseed`). |
| `determinism.spec.ts` | Determinismo del stream vivo por seed (misma seed → misma secuencia de estado; incl. medianoche; seeds distintas divergen). |
| `creation.spec.ts` / `creation-teardown.spec.ts` | Cuestionario de la gitana: stats exactos, abort, truncado de nombre, teardown del panel. |
| `movement.spec.ts` | Pasos/colisiones/reloj en pueblo y overworld. |
| `commands.spec.ts` | Comandos de mundo (Look, Open, …). |
| `shop.spec.ts` | Tienda: precios por INT. |
| `combat.spec.ts` | Combate determinista (gate + placement por el stream vivo, seed fija por page-load). |
| `dungeon.spec.ts` | Mazmorra 3D. |
| `magic-ready.spec.ts` | Magia Mix/Cast + Ready. |
| `saves.spec.ts` | F5 / load / export / autosave rotatorio. |
| **`panels.spec.ts`** | **Paneles QoL: Ztats (`z`), Journal (`F6`), Minimap (`Tab`).** |
| **`master.spec.ts`** | **Journey maestro: crear → jugar → guardar → cargar → posición exacta.** |

## Patrón de determinismo (encuentros)

El combate en overworld depende de un gate de spawn RNG. Para que los journeys
no sean flaky:

- **Grass de día nunca dispara encuentro.** El gate solo dispara si
  `threshold > rand(1,30)`; en terreno normal de día `threshold = 1` y el roll
  es siempre ≥ 1, así que caminar por Grass a mediodía (p.ej. loc 0 en `76,40`,
  `hour=10`) es siempre un paso libre. Se usa para mover/guardar sin combate
  accidental.
- **Para FORZAR combate** se elige tile/hora con threshold alto (Grass de noche
  = 4, montaña de noche = 5) y se tickean turnos hasta que el gate dispara. Tras
  la unificación del RNG (F.2) **todo el turno** —gate de spawn Y colocación del
  enemigo— rueda por el ÚNICO stream vivo (`game.liveRng`), sembrado a 0 por
  page-load, así que es **determinista por run** sin inyectar nada. Ya no existe
  el viejo `setEncounterRng(fn)` (controlaba sólo la colocación); para fijar la
  historia completa se usa `?seed=` / `__u5test.reseed(seed)`. Ver
  `combat.spec.ts` y `determinism.spec.ts`.
- **Los small maps (pueblos/mazmorras) no tiran encuentros aleatorios**, así que
  el movimiento dentro de Iolo's Hut (loc 13) es siempre determinista — es donde
  `master.spec.ts` hace su tramo de juego.

## Quirk: scoping de `.save-panel`

`SavePanel`, `ShopPanel`, `Selector` y `CreationPanel` comparten la clase
`.save-panel`, así que hay hasta 4 en el DOM y un `page.locator(".save-panel")`
pelado dispara el strict-mode de Playwright. Se desambigua por el **título
estático** del SavePanel, `"Journeys"` (los otros lo tienen dinámico):

```ts
page.locator(".save-panel", { has: page.locator(".save-title", { hasText: "Journeys" }) });
```

Además, los paneles (`SavePanel`, `Ztats`, `Journal`, `Minimap`) hacen
`stopPropagation()` en keydown en su root, y algunos auto-enfocan un input
interno (SavePanel su `input.save-name`, Journal su `.journal-filter`). Mientras
el foco está dentro, **Escape no llega al handler global**; hay que soltar el
foco primero:

```ts
await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
await page.keyboard.press("Escape");
```

(El Ztats y el Minimap no auto-enfocan nada, así que Escape los cierra directo.)

## Detalle de F5

El listener global hace `ev.preventDefault()` en `F5`, así que para un usuario
real F5 abre el panel de guardado **sin recargar la página**. En los tests
`page.keyboard.press("F5")` funciona igual.

## Divergencia conocida (fixme intencional)

[HISTÓRICO 2026-07-25: superado — el prompt se implementó en 386c171d y el
`test.fixme` fue retirado; `movement.spec.ts` ahora testea activamente
*"Dost thou wish to leave?"* (Y sin minuto / N cobra 1 / ESC=N).]

~~`movement.spec.ts` tiene un `test.fixme` activo: al salir de un pueblo por un
borde transitable, el **original** pregunta *"Dost thou wish to leave?"* ('Y'
sale sin cobrar minuto; 'N' se queda y cobra 1). El clon hoy sale
automáticamente sin prompt. Es una **divergencia deliberada de Clase B**
catalogada en `re/deliberate-divergences.md`; el `fixme` deja fijado el
comportamiento-objetivo para cuando se implemente el prompt. La suite lo reporta
como *skipped*, no como fallo.~~

## Encaje en `verify:all`

`npm run verify:all` (raíz) encadena la verificación completa del monorepo:

```
npm test                # unit de extractor + game (vitest)
npm run re:parity:all   # paridad asm-derivada vs clon, modo puro sin DOSBox (~2 min)
npm run e2e             # esta suite de Playwright
```

## Extensión futura

La ruta de victoria completa (shards → Shadowlords → Doom → rescate de Lord
British) está verificada headless en los tests del core, pero no tiene journey
E2E de browser; sería la extensión natural de `master.spec.ts` si algún día se
quiere el endgame cubierto también en UI.
