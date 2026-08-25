# Kal Xen Corp (#43) en combate — el gate de nivel NO es su bloqueo (item b)

**Carril:** re/oracle-3 · **Fecha:** 2026-07-20 · Encargo: rand-count del picker 0x9cb6 con el
fix de nivel. **Resultado: INCONCLUSO con hallazgo nuevo — el summon tiene un SEGUNDO gate.**

## Qué pasó

Con nivel/MP/int sembrados a 99 (native_lvl=[2,2,2,3,3,2], círculo de Kal Xen Corp = 8), cast
`k x c ⏎` en combate:
- **MP 99→91 (delta 8 = círculo)** — pasó ubicación, consumo, maná Y **el gate de nivel**
  (99≥8). El despachador de CAST.OVL llegó hasta la tabla de efecto.
- **enemigos 1→1, party 3→3, CERO nuevo combatiente** de ningún bando.
- **El picker 0x9cb6 (seg2) NUNCA rodó** — la traza (21 rolls) es sólo ruido: anim 0x4628×12,
  misreads 0xac6c×4/0x824×2, 0x4670×1, 0xf52/0x5. Ningún ret0 en 0x9cxx.

## El contraste que importa (vs el bolt)

- **In Flam Hur (bolt):** sembrar el nivel DESBLOQUEÓ el efecto (aparecieron 9-10 (0,15)@0xdcba).
  ⇒ el gate de nivel ERA su único bloqueo.
- **Kal Xen Corp (summon):** sembrar el nivel NO lo desbloqueó — MP baja pero no spawnea ni rueda
  el picker. ⇒ **el summon tiene un SEGUNDO precondición distinta del gate de nivel**, que corta
  el flujo DESPUÉS del descuento de MP y ANTES de que el picker 0x9cb6 elija.

Esto CORRIGE la sospecha del relevo-2 («el picker sigue Clase-C, se cierra al resolver la
entrada»): la entrada del cast en combate YA está resuelta (el bolt lo prueba); el summon queda
bloqueado por otra cosa, no por la vía de entrada.

## Punto EXACTO para cerrarlo (Clase-C menor)

El stub de Kal Xen Corp (bolt-owner-static-crack.md) hace `call 0xffffc192` = summon kernel →
`kernel_spawn_actor 0x6506` → picker seg2 0x9cb6. Como el picker no rueda, el bail está en
`0xffffc192`/`0x6506` ANTES del picker. Candidatos del segundo gate: (i) cap de daemons
summoned por combate; (ii) el summon exige una CELDA de spawn válida (adyacente libre / zona de
spawn) y falla al colocar → retorna sin elegir tipo; (iii) requisito de tipo de mapa/entorno.
**Cerrar:** arma un BP en la resolución de `0xffffc192` (o en `0x6506`) y observa el early-return
(qué comparación lo saca). El `probe_summon_levelfix.py` queda LISTO: en cuanto el summon
spawnee de verdad, el cluster de ret0 del picker por reintento (retry-8) se lee del stream.

## Evidencia
- Probe `re/notes/probe_summon_levelfix.py` (nivel sembrado). JSON scratchpad `summon_levelfix.json`.
- Contraste: `re/notes/combat-cast-levelgate.md` (bolt SÍ desbloqueado por nivel).
- Estático: `re/notes/bolt-owner-static-crack.md` (stub 0x1100 → 0xffffc192 → 0x6506 → 0x9cb6).
