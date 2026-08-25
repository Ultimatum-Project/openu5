# ACTA #167 — el guarda ciego al empate a puñetazos, y el SEGUNDO punto ciego que sólo salió con el control positivo

> Carril `guard-167`, rama `e2e/guard-167` desde `main` **f2df60d9**, retenida.
> Mutex de e2e en mano. Puerto 5256. Salida de #166 (`re/notes/throw-166-acta.md` §5).

**Titular: el guarda nuevo funciona — pero mi PRIMERA colocación no servía para nada, y sólo
lo descubrí porque exigí un control POSITIVO. El control negativo la había dado por buena.**

---

## §1 — El defecto (medido en #166)

`resolveArenaCombatInner` tenía `noProgress > 60` (`nav.ts`) como detector de atasco, y no veía
el caso de #166: party desarmada, enemigos congelados, **400 rondas, cero bajas**, y
`noProgress` en **0** todo el rato. El combate corría hasta el techo de presupuesto y salía
como THROW — no-veredicto, casilla 3 — en vez de como atasco.

## §2 — El arreglo: una señal que mira SÓLO al bando enemigo

Contador nuevo, **aditivo** (no sustituye a `noProgress`):

```ts
const foeSig = `${s.enemies.length}#${s.enemies.map(e => `${e.x},${e.y}`).sort().join("|")}`;
frozenEnemies = foeSig === enemySig ? frozenEnemies + 1 : 0;
enemySig = foeSig;
if (frozenEnemies > FROZEN_LIMIT /* 150 */) return false;
```

Censo **y** celdas: la firma cambia si muere alguien o si alguno se mueve. El censo va aparte
del join a propósito — una baja simultánea a un paso podría dejar el join igual. Umbral
holgado (150 rondas de jugador) para no cortar peleas lentas pero vivas. Al ser aditivo, sólo
puede hacer que el resolvedor se rinda ANTES en combates que hoy agotan el presupuesto; nunca
en uno donde algo se mueve.

---

## §3 — ★★ EL HALLAZGO: la COLOCACIÓN, y por qué el control negativo la dio por buena

**Primer intento**: puse el contador abajo, junto a `enemyPrev`. Corrí el control negativo
sobre ch20+ch26+ch27: **6 passed, EXIT 0, los tres digests idénticos a sus sellos**. Parecía
perfecto — cero sobre-detección.

**Era un verde vacío.** El control positivo (desarmar el fixture de ch26 a propósito y
comprobar que el guarda SALTA) lo destapó: el fallo seguía llegando en la **ronda 399**, igual
que antes. El guarda no se ejecutaba nunca.

**La causa, y es el segundo defecto de esta tarjeta**: la rama

```ts
if (s.aimAt) { await pressAimAttack(...); stuck = 0; continue; }
```

hace `stuck = 0; continue;` **incondicionalmente** — ataca y da el turno por bueno **sin
comprobar que el ataque consiguiera nada**. Con la party a puñetazos esa rama se toma cada
ronda ⇒ resetea `stuck` y **se salta cualquier contador puesto más abajo**. Es el hermano del
punto ciego de `noProgress`, y explica por qué la telemetría de #166 mostraba `stuck=0` durante
las 400 rondas enteras.

⇒ El contador se movió **arriba del todo**, justo tras la telemetría y **antes** del `aimAt`.

### 3.1 La lección, que vale más que el fix

**Un control NEGATIVO no puede validar un guarda.** «No rompe nada» es exactamente lo que hace
un guarda que no se ejecuta. Sólo el control positivo —verlo SUSPENDER— distingue «no molesta»
de «no existe». Aquí el negativo dio 6/6 verdes sobre código muerto.

---

## §4 — Los DOS controles, con el guarda ya en su sitio

| control | montaje | resultado |
|---|---|---|
| **POSITIVO** | fixture de ch26 desarmado a propósito (se revierte el fix de #166) | **el guarda DISPARA en la ronda 151** (umbral 150), `stuck(max)=150`. Antes: ronda 399. Capítulo: 472 s → 305 s |
| **NEGATIVO** | árbol sano (fixture restaurado), ch20 + ch26 + ch27 | **6 passed · EXIT 0**, los tres digests **idénticos carácter a carácter** a sus sellos. El guarda no se dispara ni una vez |

★ El positivo se corrió con el guarda BIEN colocado; el negativo se **repitió** tras moverlo,
porque el primero era sobre código inalcanzable y no valía. La sonda temporal que desarmaba el
fixture está **revertida**: `git diff` sobre `ch26` no muestra nada.

**Cero sobre-detección**: ninguna VICTORY se corta antes de tiempo, que era el criterio de
parada que fijó el lead.

---

## §5 — Alcance: lo que este fix NO hace

- **No convierte el THROW en `DEADEND-STUCK`.** El guarda devuelve `false` igual que los otros
  dos caminos; quien lo traduce a veredicto o a excepción es el CALLER. En `conquerRoom` sale
  como veredicto; en `dungeonDescendTo` (`nav.ts`, rama sin `crossRooms`) cualquier `false`
  sigue lanzando. Convertir eso es cambiar el contrato del caller — **no entra aquí**.
- **No toca el presupuesto de rondas** ni el reenvío de `maxRounds` de `nav.ts` (la asimetría
  400-vs-600 documentada en #166 §1): sigue siendo lote propio con ventana propia.

Lo que sí compra: si el fixture vuelve a secarse, el fallo llega en 150 rondas en vez de en
400/600, con el contador visible en la telemetría (`stuck` pasa a ser
`max(stuck, noProgress, frozenEnemies)`), y por la vía de `conquerRoom` **sale como veredicto**.

---

## §6 — Gates

`tsc --noEmit -p tsconfig.e2e.json` **EXIT 0** · control negativo **6 passed EXIT 0** ·
control positivo verificado con telemetría. Corridas: **4** (negativo inválido + positivo v1 +
positivo v2 + negativo bueno) — dos de ellas gastadas en descubrir que la primera colocación
era código muerto, y bien gastadas.
