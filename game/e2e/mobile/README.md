# Suite E2E móvil intensiva (carril mobile-e2e)

Verificación FUNCIONAL exhaustiva de la versión phone. Fase A (censo + suite,
2026-07-23). **Fase B (2026-07-24, run definitivo iphone+android): 50/54 VERDE**
— los 4 rojos son EVIDENCIA-POR-DISEÑO de los 2 tickets UX abiertos (×2
dispositivos).

## Cómo correr

```bash
cd game
npx playwright test -c playwright.mobile.config.ts            # ambos dispositivos
npx playwright test -c playwright.mobile.config.ts --project=iphone
```

Puerto default **5196** (propio; 5199=usuario, 5197=e2e, 5219=tour), cacheDir vite
propio (`.vite-mobile-e2e`). Chromium `isMobile+hasTouch` → `(pointer: coarse)` real: el
deck aparece por su detección de producción, sin `?touch=1`. Todos los flujos van por
TAPS (helpers `deck.ts`), jamás `page.keyboard`.

**Proyectos** (4, tras el ítem de los gates de la auditoría 2026-07-25):

| proyecto | viewport | qué corre |
|---|---|---|
| `iphone` | 390×844 @3x | la suite entera |
| `android` | 412×915 @2.625 | la suite entera |
| `iphone-landscape-safari` | 844×340 @3x | sólo `mobile-geometry.spec.ts` (gate de normas) |
| `se-landscape` | 568×320 @2 | sólo `mobile-geometry.spec.ts` (gate de normas) |

Los dos apaisados existen porque el gate rotaba desde dentro y medía siempre el
apaisado ÍNTEGRO (844×390), que en un iPhone real no existe: Safari deja ~340 px con la
barra compacta y el SE rotado, 320 — y ése es el que reventaba. El gate de objetivos
corre además en **las dos lenguas** (`?lang=es`: los vocablos ES son los largos) y
asevera que **ningún rótulo queda cizallado** (`scrollWidth/Height` vs `client*`), que
es lo que dejó pasar 282/282 comandos recortados.

## Censo del soporte móvil (código, base b8585105 + merge 6a09e713)

| Pieza | Fuente | Estado |
|---|---|---|
| Deck táctil (barra de modo Move/A–Z/123/Yes-No + hojas + fila útil Space/⏎/Esc) | `src/ui/touch.ts` | ✅ (Lote 1) |
| Auto-alzado de hoja por input esperado (digit→123, string→A–Z, Y/N→Sí-No, dir→Move) | `touch.ts expectInput` + `main.ts syncTouchExpect` | ✅ (Lote 2) |
| Comandos contextuales (WORLD 22 · DUNGEON 5 · COMBAT 2), refresco 400 ms | `touch.ts refresh()` | ✅ |
| Cruceta con hold-repeat (220 ms) | `touch.ts` | ✅ |
| Tap-para-ir (A\* 140 ms) + tap-ataque en combate + destello | `ui/autowalk.ts`, `main.ts intents`, `ui/tap-feedback.ts` | ✅ |
| Orientación: banda inferior ↔ columna lateral + toggle ⇄ persistido | `touch.ts`, CSS `index.html` | ✅ (⇄ requería F3) |
| Reserva del viewport (`--u5-touch-reserve[-x]`) | `touch.ts syncReserve` | ✅ (requería F1) |
| Escala fraccionaria móvil del canvas | `skin/fiel/skin.ts mobileCanvasSize` (fiel y shader) | ✅ ambas pieles |
| Intro táctil (overlay por fase + input nativo del nombre) | `ui/faithful-intro.ts` | ✅ |
| FABs del shell siempre visibles en táctil; fila útil apartada | `gear.ts`, `shellToolbar.ts` | ✅ |

## Matriz control→resultado (run definitivo, ✅✅ = verde en ambos dispositivos)

| Grupo | Escenarios | Resultado |
|---|---|---|
| Arranque (detección coarse, 4 hojas, FABs, cruceta ×4 direcciones, hold-repeat) | 3 | ✅✅ |
| Matriz de comandos — pueblo (Talk/Open/Look/Get/Search/Jimmy/Klimb/Cast/Mix/Ready/Use/Push/Ztats/Journal/Map/Save, con cierre Esc/Space táctil) | 1 | ✅✅ |
| Matriz de comandos — overworld (Board/Enter/Xit/Fire/Yell/Hole-up) | 1 | ✅✅ |
| Hoja de mazmorra (entrar Deceit por deck, Torch, Klimb de vuelta) | 1 | ✅✅ |
| Tap-para-ir (navegar, retarget, taps sanos propia-celda/chrome, destello) | 4 | ✅✅ |
| Auto-alzado (Y/N salida de pueblo, getstring Yell→QWERTY, respeto del cambio manual) | 3 | ✅✅ |
| Flujos completos (conversación NAME/BYE por QWERTY · compra shipwright con confirm Y/N · combate entero por taps · Search→Jimmy→Open con llave · Ztats · Mix+Cast In Lor) | 6 | ✅✅ |
| Layout portrait (sin solape deck↔canvas, viewport íntegro, sin scroll-h, canvas ≥85 %, Esc≠⚙) | 1 | ✅✅ |
| Targets táctiles ≥40 px | 1 | ❌❌ → **UX-1** |
| Rotación en caliente (columna lateral, ⇄ alterna+persiste, estado intacto, vuelta) | 1 | ✅✅ |
| Layout apaisado (comandos íntegros sin scroll) | 1 | ❌❌ → **UX-2** |
| Pieles (shader jugable por toque; cambio por FAB en vivo) | 2 | ✅✅ |
| Intro táctil (creación de personaje ENTERA sin teclado; J-sin-partida) | 2 | ✅✅ |

## Tickets

### ROTOS cazados por la suite — hotfix candidato COMMITEADO en esta rama (cherry-pick del lead)

| # | Hash | Qué estaba roto |
|---|---|---|
| F1 | `732aa4cc` | `index.html:196`: un `*/` DENTRO de un comentario CSS (lote calidad D4, 6f05b279) se tragaba la regla `.touch-controls` entera → **layout móvil portrait completo muerto** (deck sin anclar fuera de pantalla, canvas reducido a una tira). |
| F2 | `b3dc76ab` | `theme.ts` (C5, 0a3ef6fd): el drawer del shell tematizado CERRADO = popup centrado `opacity:0` SIN `pointer-events:none` → **bloqueador invisible de ~360 px** en mitad del viewport (móvil: tapaba el deck; escritorio: come clicks/tap-to-walk de esa franja). |
| F3 | `fe44c7b1` | El botón ⇄ del pad apaisado heredaba `pointer-events:none` del root del deck → **intocable desde que L4 aterrizó**. |

### UX abiertos (evidencia = los 2 tests rojos-por-diseño; fixes = carriles posteriores con ruling)

| # | Clase | Detalle medido |
|---|---|---|
| UX-1 | incómodo | Los 4 segmentos de la **barra de modo miden 36 px de alto** (<40; ambos dispositivos). El resto de targets pasa (cruceta 64, comandos ≥44, numpad/sí-no/útil OK; teclas QWERTY ~33 px de ancho aceptadas como patrón teclado-SO con alto ≥45). |
| UX-2 | incómodo | **Apaisado en teléfono (alto 390/412): la columna del deck desborda** — la barra de modo y la ▲ de la cruceta nacen RECORTADAS por arriba y ~14 comandos quedan bajo el pliegue (y+alto hasta 806 px vs 413 de viewport); operables solo con scroll interno del deck. |
| UX-3 | mejorable | Sin botón dedicado **(A)ttack / (N)ew-order / (V)iew-gem** en la hoja de mundo; alcanzables via hoja A–Z (o tap-al-enemigo, que sí inicia combate — verificado). |
| UX-4 | mejorable | Los prompts de **tecla cruda** (gate Y/N de tienda, confirmación «Wilt thou take it?») NO auto-alzan la hoja Sí/No (deliberado en touch.ts): una compra exige 2 cambios de hoja manuales. |

### Observaciones (no tickets del port móvil)

- Cast con miembro sin MP: «M.P. too low!» + «Failed!» **consumiendo la carga** — el
  avatar del INIT tiene 0 MP, así que «Cast → 1» siempre quema una carga. Conducta
  posiblemente fiel al binario (anotar si algún carril de fidelidad quiere careo).
- El shop lowercasea la tecla de opción (shop-console.ts:1187) → las MAYÚSCULAS de la
  hoja A–Z funcionan; el getstring/rúnico también las acepta.
- INIT: solo Iolo tiene MP (avatar y Shamino 0) — los flujos de magia castean con el
  miembro 3.

## Ficheros

- `playwright.mobile.config.ts` — emulación de dispositivo (puerto 5196, cacheDir propio).
- `e2e/mobile/deck.ts` — helpers tap-only del deck + geometría del canvas de juego
  (mayor-área: robusto a fiel/shader y a los canvases auxiliares 0×0 del chrome C5) +
  guarda anti-flake de rect estable en el boot.
- `e2e/mobile/mobile-intensive.spec.ts` — la suite (27 escenarios × 2 dispositivos).

Gates: `npm run typecheck:e2e` = 0 · flake android (tap durante el resize inicial)
endurecido y re-validado con el proyecto android entero en verde (25/27 + 2 por-diseño).
