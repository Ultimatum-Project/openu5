# Oráculo relevo-4 — gate del summon (item 1) + ESC-flee (item 2)

**Carril:** re/oracle-4 · **Fecha:** 2026-07-20 · Encargo: cerrar los 2 ítems finales del paquete
CAST. **Item 1 RESUELTO (con corrección a relevo-3). Item 2 estructura CONFIRMADA por estático +
trayectoria/borde WIP (Clase-C).**

---

## ITEM 1 — ¿Qué gate frena al summon? → aborta ANTES de `kernel_spawn_actor` (0x6506)

### Método
`probe_summon_reach.py`: siembra nivel/MP/INT=99 (Kal Xen Corp #43, círculo 8), castea `k x c ⏎`
en combate y arma **BP de KERNEL FIABLE** en `0x6506` (`kernel_spawn_actor`, dentro del segmento de
carga — no overlay) y `0x674c` (convergencia/epílogo del spawn), con `tick_pulse` para sincronizar
teclas. Pregunta binaria: **¿se ALCANZA 0x6506 durante el cast?**

### Resultado (DECISIVO)
```
native_lvl=[2,2,2,3,3,2] circle=8 caster_ref=0 n_enemy0=8
MP 99->91  enemigos 8->8  ;  spawn_0x6506_hits=0  conv_0x674c_hits=0
VERDICT: 0x6506 NO alcanzado -> el summon aborta en el OVERLAY/dispatch antes del kernel
```
- **MP 99→91 (delta 8 = círculo)** ⇒ el cast DISPARA (dispatcher corrió, gate de nivel/MP pasado).
- **`kernel_spawn_actor` 0x6506 = 0 hits** en DOS configuraciones de tablero: la de relevo-3
  (1 enemigo) y ésta (8 enemigos). **Sin spawn** (enemigos 8→8).

### Veredicto y CORRECCIÓN a relevo-3
El bail NO está «en 0xffffc192/0x6506 antes del picker» (combat-summon-second-gate.md): está
**antes de 0x6506 por completo**, es decir en el CUERPO de la rutina de summon del kernel
(stub CAST.OVL `0x1100: sub ax,ax; push ax; call 0xffffc192; jmp 0xf3f` → kernel summon), que
**retorna sin llamar nunca a `kernel_spawn_actor`**. Esto **DESCARTA** las 3 hipótesis de colocación
de relevo-3:
- (ii) celda de spawn válida — el picker de celda vive DENTRO de 0x6506, que nunca corre. Descartada.
- cap de slots / tablero lleno — la búsqueda de slot es 0x6506 (di=6..0x20), nunca corre;
  además probado con 8 enemigos (no lleno) y con 1. Descartada.
- picker 0x9cb6 — es llamado por 0x6506; nunca se alcanza (coherente con relevo-3: «el picker nunca
  rodó»). Su rand-count sigue **inmedible por vía viva** hasta que un summon dispare de verdad.

⇒ **El «segundo gate» es una PRECONDICIÓN en la cabeza de la rutina de summon del kernel
(call 0xffffc192), no en la lógica de colocación.** El stub del overlay llama incondicionalmente
(0x1103, justo tras `push 0`), así que el bail está DENTRO de 0xffffc192.

### Punto EXACTO para cerrar (Clase-C menor)
El destino `call 0xffffc192` es un **call relocado a kernel** (opaco al sesgo estático:
`(0xc192+0x81D0)&0xFFFF=0x4362` cae fuera de frontera de instrucción en ULTIMA.EXE.asm — caveat
conocido [[mainout-ffff-call-bias]]). Para nombrar la comparación exacta: resolver 0xffffc192 con
la linkadura viva del overlay (leer el vector de fixup en pausa tras cargar CAST.OVL) y armar BP ahí,
o BP en el sitio del overlay 0x1103 (BP de overlay = poco fiable en este arnés). Candidato más
probable del gate: **contexto de combate / tipo de arena** (el summon a overworld coloca en el mapa;
en combate la rutina puede exigir una condición que la arena no cumple) o **cap de daemons invocados**.
El `probe_summon_reach.py` queda LISTO: en cuanto el summon dispare, 0x6506 se enciende y el
cluster de ret0 del picker (retry-8) se lee del stream.

---

## ITEM 2 — ESC-flee: estructura CONFIRMADA (estático) + borde/trayectoria WIP

### Estático (SÓLIDO — sin oráculo)
Cadena de la tecla ESC en el input de combate (verificada en el disasm):
- `COMBAT.OVL 0x0864: cmp ax,0x1b ; jne ; jmp 0x9dc` — ESC (0x1b) despacha.
- `0x9dc: call 0xffffdafe ; jmp 0x974` — ESC llama una rutina de **HUIDA SIN DIRECCIÓN** y luego
  salta a `0x974` (**avance de turno**). Contraste: las flechas (`0x9fe`) computan
  `[bp-6]-0x31` = dirección/índice y llaman `0xffffdab6` (huida CON dirección). ⇒ **ESC = huida
  rápida direction-less que termina el turno.**

**Esto VALIDA la forma del port** `playerEscapeQuick` (combat.ts:2085): «Esc huye directamente…
el binario no pasa dirección… imprime "Escape!" y el miembro deja el tablero», y su remate
`advanceTurn()` casa con `jmp 0x974`. La estructura del clon es fiel.

### Vivo (parcial / WIP)
- `probe_esc_flee2.py` (COMPLETO): tras ESC en el turno del miembro 0, muestreo su slot RAW
  (0xBA14) 18 pulsos → **fijo en (5,7), flags 0x80, resflags 0x0, no sale**. Motivo: el juego queda
  bloqueado en el prompt del SIGUIENTE miembro (jmp 0x974 → turno del miembro 1), así que el miembro
  0 no vuelve a tener oportunidad de resolver la salida en esa ventana. `esc_consumed` no logueado
  en v2.
- `probe_esc_flee3.py` (multi-ronda, PASA con Space a los demás para avanzar rondas): confirmó
  **`ESC consumed=True`** (la tecla SÍ llega al dispatcher) pero **agotó el alarm (500s)** en el
  bucle de muestreo (70 iteraciones × varios round-trips pty = demasiado lento) SIN capturar la
  trayectoria/borde. Inconcluso en instantánea-vs-trayectoria.

### Veredicto item 2
**El «cómo» estructural está CERRADO por estático (ESC = huida sin dirección → avance de turno,
fiel al port).** Queda ⚠ Clase-C EXACTA (la misma que el port ya documenta): **qué BORDE elige
0xffffdafe internamente y si respeta "same exit"** — la trayectoria/borde no se trazó (probe vivo
lento/flaky). **Punto exacto para cerrar:** probe v3 ADELGAZADO (≤8 muestras, Space entregado en
menos round-trips, alarm ≥ 900s) para ver al miembro caminar/salir por N rondas; o resolver el
borde estáticamente dentro de 0xffffdafe (mismo bloqueo de call-relocado que item 1).

---

## Evidencia
- Probes: `re/notes/probe_summon_reach.py`, `re/notes/probe_esc_flee2.py`, `re/notes/probe_esc_flee3.py`.
- JSON: `re/notes/oracle4-evidence/{summon_reach,esc_flee2}.json` (esc_flee3 = alarm, esc_consumed=True).
- Disasm: `ULTIMA.EXE.asm` 0x6506 (kernel_spawn_actor); `CAST.OVL.asm` 0x1100/0x1103 (stub Kal Xen
  Corp); `COMBAT.OVL.asm` 0x0864 (ESC dispatch)/0x09dc (flee-no-dir)/0x09fe (arrow flee).
- Contexto previo: `re/notes/combat-summon-second-gate.md` (relevo-3, corregido aquí),
  `re/notes/bolt-owner-static-crack.md`, `re/notes/fixture-combat-cast.md`, `re/notes/combat.md` §8.
