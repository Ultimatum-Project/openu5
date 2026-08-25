# Footprint de In Flam Hur (#45) en combate — item (a)

**Carril:** re/oracle-3 · **Fecha:** 2026-07-19/20 · Encargo: con la entrada resuelta (nivel
sembrado), medir el footprint 2D del bolt — nº de (0,15) (¿línea vs cono?) y nº de (0,30) (celdas).

## Dos corridas vivas (nivel sembrado, In Flam Hur = círculo 8, aim UP desde caster (5,7))

| corrida | enemigos | (0,15)@0xdcba | (0,30) | daño | MP |
|---------|----------|--------------:|-------:|------|----|
| levelgate | 1 OFF-axis (4,6) | **9** | 0 | ninguno | 99→91 |
| footprint | 4 ON-axis, columna 5 dist 1-4 (5,6)(5,5)(5,4)(5,3) HP60 | **10** | 0 | **ninguno** | 99→91 |

## Veredicto: LÍNEA que viaja, NO cono — y el nº de (0,15) NO es «celdas del footprint»

1. **El nº de (0,15) es INDEPENDIENTE de la colocación de enemigos** (9 con 1 enemigo off-axis
   vs 10 con 4 enemigos dead-on): ⇒ NO cuenta objetivos ni celdas golpeadas. Cuenta el **vuelo
   del proyectil**: una tirada rand0(15) por CELDA que recorre el bolt desde el caster (5,7) hacia
   el norte hasta el borde/obstáculo (~7 celdas: filas 6,5,4,3,2,1,0 + origen/impacto ≈ 9-10).
2. **~9-10 tiradas es coherente con una LÍNEA de longitud-al-borde, NO con un cono**: un cono que
   se abriera hacia el norte desde la fila 7 cubriría un triángulo de muchas más de 10 celdas.
   ⇒ **In Flam Hur es un bolt de LÍNEA (viaja por el eje del aim)**, consistente con la
   clasificación estática `lineAoe` (`bolt-owner-static-crack.md`: 45→0x104e→0x1f60→0x1c36).
   **La hipótesis «9 = cono de 9 filas» NO se sostiene.**
3. **`0xdb7f (100,10000)`** inunda el stream (decenas de tiradas entre cada (0,15)) = el
   **temporizador de animación por frame** del vuelo del bolt. No es gameplay.
4. **`(0,30)` = 0 en ambas corridas** ⇒ In Flam Hur **no usa gate rand30**. (El modelo previo de
   «rand30 = celdas» no aplica a este hechizo.)

## Lo que queda ABIERTO (Clase-C, punto exacto)

**El footprint 2D FINO (qué celdas reciben daño) no se manifestó vivo:** con 4 enemigos HP60
DIRECTAMENTE en la línea de tiro, In Flam Hur no bajó HP a NINGUNO (daño=[]), ni dejó marcas
0xff/tiles de campo legibles (0xab02 se recompone antes de que el probe lea). Dos causas posibles,
sin resolver por presupuesto:
- (i) el daño del bolt es probabilístico y los seeds probados fallaron el gate para los 4; o
- (ii) In Flam Hur COLOCA un campo de fuego en la línea (daño diferido al pisar), no daño
  instantáneo — coherente con «len 2» de la derivación y con el 0 de daño inmediato.

**Punto exacto para cerrarlo:** un BP DENTRO del aplicador 0x1c36 (BP de overlay, no fiable en
este arnés) para leer las celdas estampadas, O congelar el seed justo antes del gate de daño y
barrer. El nº de (0,15) ya está clavado como **longitud de vuelo (línea)**, no como footprint.

## Evidencia
- Probe `re/notes/probe_ifhur_footprint.py` (enemigos on-axis + traza completa + lectura 0xab02).
- JSON: scratchpad `ifhur_footprint.json` (tag done), `cast_levelgate.json`.
- Estático: `re/notes/bolt-owner-static-crack.md`, `re/disasm/CAST.OVL.asm` 0x1c36 (aplicador).
