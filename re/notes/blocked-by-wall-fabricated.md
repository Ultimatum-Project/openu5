# «Blocked by wall!» del ataque a distancia — VEREDICTO: **FABRICADO** · ✅ PURGADO (Fase 2, lote 3)

> **CIERRE 2026-07-19 (Fase 2 del combate fiel, lote 3).** Ejecutada la **Opción (A)** del §3
> (rework fiel completo), la contratada por el lead en el `brief-ch15-combate.md`:
> - `combat.ts` — nuevo `resolveRangedFlight` + `projectileLanding` (raycast Bresenham a la 1ª
>   celda opaca). `playerAttack` (range>1) y `castCombatAttack` (bolt) apuntan-a-CELDA: el
>   proyectil vuela, aterriza en la 1ª celda opaca y, sin ocupante, se DESPERDICIA
>   (munición+turno, SIN texto). Astas «(p)» siguen pegando por encima (golpe directo).
> - Ambos «Blocked by wall!» ELIMINADOS (`combat.ts` ranged + spell). String purgado de
>   `tests/fixtures/approved-strings.json` y `src/i18n/es.json`.
> - Animación del vuelo por evento core `projectile` → `view.emitCombatFx({kind:"projectile"})`.
> - Tests: `combat.test.ts` (montaña opaca → tiro desperdiciado, munición gastada, sin string) +
>   `polearm-over-obstacle.test.ts` (arco tras muro → desperdiciado; astas intactas).
> - `deliberate-divergences.md §6` → entrada marcada HISTÓRICA.
>
> Lo de abajo es el reporte ORIGINAL del scout que motivó el rework.

---


**Carril:** SCOUT (flota del lead) · 2026-07-19 · **Rama:** `fiel/present-residues`.
Residuo de presentación diferido de `polearm-attack.md` (§matiz proyectil-hasta-el-muro).
El lead pidió: derivar del ASM qué se anima/imprime cuando un arma que VUELA la bloquea un
muro, y si el «Blocked by wall!» del port es fabricado, reportar ANTES de purgar.

## 1. El string no existe en el binario

`grep` binario de todas las `Blocked*` en `DATA.OVL`:
```
0x26e6 'Blocked!'   0x29be 'Blocked!'   0x2d29 'Blocked!'   0x2d33 'Blocked!'   0x8ee4 'Blocked!'
```
Todas son **«Blocked!»** (movimiento de mazmorra/overworld, DS 0x26D6/0x29AE etc.,
`dungeon.md`/`kernel-survival.md`). **NO existe «Blocked by wall!»** ni ningún mensaje de
«muro» en el ataque a distancia (los únicos «wall» son «Nothing hidden on the wall.» del
Search y «In the wall…»). ⇒ El «Blocked by wall!» del port (`combat.ts:1280` y `:1573`)
es **FABRICADO**.

## 2. Qué hace el binario en ese caso (derivado)

El ataque a distancia del jugador (COMSUBS 0x0A68) NO pre-chequea línea-de-tiro:
- **Apuntado (0x0504):** sólo acota por ALCANCE + rejilla (`polearm-attack.md` §1a); el
  jugador PUEDE fijar el cursor sobre una celda tras un muro.
- **Vuelo del proyectil (0x0822 → 0x12de):** `0x12de` traza la línea **Bresenham**
  (`call 0xe26` a los buffers 0xA728/0xA872) y ANIMA el proyectil celda a celda; se
  **detiene en la primera celda opaca** (el muro). El daño se aplica en la **celda de
  aterrizaje** (donde paró el rayo), no en el objetivo → si el muro está en medio, el
  proyectil aterriza en el muro y **golpea a quien esté allí (nadie) = tiro DESPERDICIADO**.
- **Sin mensaje:** ni «Blocked», ni «missed» específico del muro. Sólo la ANIMACIÓN del
  proyectil volando hasta el muro y el consumo del turno/munición.

⇒ Presentación fiel = **el disparo se PERMITE, el proyectil vuela hasta el muro (anim), se
desperdicia (objetivo ileso), sin texto**. El port en cambio PRE-BLOQUEA con un mensaje
inventado y sin animación. Efecto NETO idéntico (objetivo ileso), presentación distinta.

## 3. Veredicto y recomendación (NO purgado — reporto como pidió el lead)

**«Blocked by wall!» = FABRICADO.** Dos sitios: `combat.ts:1280` (ataque a distancia del
jugador) y `combat.ts:1573` (apuntado de hechizo de línea). Por la doctrina no-fabricar,
debería purgarse. Pero cablear la presentación fiel (permitir el disparo + volar hasta el
muro + aterrizaje-desperdiciado) es un **rework** del combate del port, que hoy:
- exige objetivo OCUPANTE (`occupantAt`, `combat.ts:1272`) — el binario apunta a CELDA;
- pre-chequea LOS en `canReach`/`isRangedPathClear` y corta con el mensaje.

Opciones para el lead:
- **(A) Rework fiel completo:** quitar el pre-bloqueo, permitir apuntar tras muro, resolver
  el vuelo con raycast hasta la celda opaca y aterrizar el daño ahí (tiro desperdiciado).
  Necesita infra de proyectil apuntado a celda (el port hoy no anima el vuelo del jugador).
- **(B) Mínimo no-fabricado:** purgar «Blocked by wall!» y, en su lugar, resolver el disparo
  bloqueado como un FALLO silencioso / «Missed!» genuino del binario (sin inventar «muro»).
  Conserva el modelo occupant-target del port, sólo elimina el texto fabricado.
- **(C) Diferir:** dejar el mensaje marcado como fabricado-conocido hasta que haya infra de
  proyectil apuntado (paquete de presentación de combate mayor).

Recomiendo **(B)** como paso limpio ahora (elimina la fabricación sin abrir el rework),
dejando (A) para un carril de presentación de combate. Necesito tu OK antes de tocar
`combat.ts` (lo pediste: reportar antes de purgar).
