# Witness #4 — SERPENT-FIRE: ¿0x7bea consume rand entre gate y casco? · CERRADO

> **DESVIACIÓN BENDECIDA (no cableo).** Ruling del lead 2026-07-19: aceptada como
> "desviación derivada del binario, invisible en observación"; el motor NO se toca. Ver
> §VEREDICTO. (No hay manifiesto de rulings general en el repo; esta nota es el registro.)

**Carril:** oracle-fire (rama `re/oracle-fire`) · **Fecha:** 2026-07-19 · Cierra el
§WITNESS BRIEF de `re/notes/serpent-ranged-derivation.md`. Oráculo headless propio, sin
dosbox ajeno. **Método seed-delta** (recomendado por el lead; NO se arma la entrada
compartida 0x2092 — satura el pty). Probes en el scratchpad del carril:
`serpent_probe_v3.py/v4.py/v5.py`; capturas `serpent_capture_v3/v4/v5.json`.

## VEREDICTO

**Entre el `rand(0,7)` del gate y el `rand(1,30)` del casco NO hay 0 rands — hay MUCHOS,
y su número VARÍA entre corridas (medido: 384 y 192).** El pipeline de disparo consume
del MISMO `g_rng_seed` un número frame-dependiente de rands (redibujo de viewport 0x5910 +
trazado del proyectil 0x7bea). Por tanto:

1. **La asunción Clase-C del port es FALSA en la letra:** `fireRangedAtParty` hace gate →
   casco consecutivos sobre el rng de juego; el binario mete N rands de RENDER en medio.
2. **Pero es IRREPLICABLE y observacionalmente INVISIBLE:** el N varía por frame-timing de
   la animación (no es lógica determinista), y `g_rng_seed` **no se persiste** en la
   partida (`rng.md`). El daño sigue siendo `rand(1,30)` uniforme; sólo sale de otro punto
   del stream. No hay forma —ni sentido— de calcarlo bit a bit.
3. **Recomendación: BENDECIR la desviación.** El port ya modela la animación como stream
   SEPARADO (`tileprog.ts`), que es exactamente el modelo correcto aquí. NO tocar el motor.
   Actualizar la asunción de `serpent-ranged-derivation.md §4`: 0x7bea **SÍ** consume del
   seed compartido, pero como animación de conteo variable — no como paso de juego.

## Escenario

Overworld (86,107), party FORZADO a fragata (`g_transport_tile` DS:0x587C = 0x20, casco
`obj0+5`=0xFF → no hunde, sin prompt), UN Sea Serpent (actor byte+0 = 0x88, def 18) a dist
2 al este (rango, no melee), slots 1..31 limpios. PASS con Space (party quieto). Gate
FORZADO a disparar: escribo `g_rng_seed=0x30` en el 1er hit del BP del gate (0x13CC) →
`rand(0,7)`=0 (dispara) y deja la semilla en **0x8018** (verificado con la LCG de `rng.md`).

## Datos crudos (pasos LCG desde el post-gate 0x8018)

- **v3 (fragata, medida bruta gate→casco):** `dmg_entry`(0x109E)=0xd44c = **+384**;
  `hull`(0x10B0)=0x1eab = **+385** (= dmg_entry **+1**, el hull rand). El hull rand es el
  paso inmediatamente siguiente a la entrada de daño.
- **v4 (atribución):** gate rand → refresh (0x5910) = **0-1 pasos** (consecutivos, refresh
  ve 0x8018). El grueso (**384**) cae entre el sound/refresh y el proyectil (0x1420).
- **v5 (repetición):** el mismo tramo refresh→proj mide **192** (≠ 384 de v4).
  **La variación 384↔192 prueba que es animación frame-dependiente, no lógica.**

Detalle mecánico observado: el BP del gate 0x13CC **re-entra** (se vuelve a pisar 1 paso
después) — el refresh de viewport 0x5910 re-ejecuta el loop de actores/animación, por eso
el conteo depende de cuántos frames renderiza el proyectil. `impact`(0x142D)/`hull`(0x10B0)
no se alcanzaron end-to-end en v4/v5 porque la animación del proyectil corre más frames que
el presupuesto de idle; irrelevante para el veredicto (v3 ya dio el seed del hull = +1).

## Bonus (a pie): pipeline igual, SIN hull rand

A pie (transport 0x1C) el pipeline (refresh+sound+proj) corre idéntico pero 0x109E ramifica
a 0x1160 SIN tirar `rand(1,30)` (la seq foot de v4 llega a proj y no hay marcador hull) —
confirma el gate de fragata del cableo (`fireRangedAtParty` sólo daña casco en fragata).

## Cierre

Witness cerrado. Implicación de motor: **NINGUNA corrección obligatoria**; decisión de
bendecir la desviación RNG = del lead. La rama `re/serpent-ranged` (cableado previo) queda
correcta funcionalmente; sólo su comentario Clase-C necesita la nota de arriba.
