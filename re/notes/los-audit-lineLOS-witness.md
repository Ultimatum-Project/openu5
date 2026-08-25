# los-audit tensión (B) — trazado LOS de hechizos (CAST.OVL 0x1df8 / 0x6a14) · witness

Encargo: ¿`CAST.OVL:0x1df8` (~~único caller del predicado LOS kernel `0x3f6e`~~ **[⚠ CORREGIDO
2026-07-30, auditoría general 30-07 ALTA-4: la premisa del encargo era falsa y esta instancia
sobrevivió al censo de #173 §3.3. La banda MEDIDA de `0x3f6e` son DOS call-sites — `CAST.OVL
0x1c28` (al que `0x1df8` llega vía `0x1bb0`) y `COMSUBS.OVL 0x142a` (el vuelo del proyectil de
combate) —, medidos con `dispatch_table.near_calls_to_kernel`; ver
`proyectil-los-0x6a14-derivacion.md`. Ojo con el tercer offset: `0x1df8` no es un caller de
`0x3f6e`, es el caller de `0x1bb0`]**, que lee el
bitmap `0x6a14`) es la vía OVERWORLD de hechizos dirigidos o el lineAoe de COMBATE? Y
stop-semantic + peso radial.

> **⚠ POLARIDAD de `0x6a14` (2026-07-30).** Donde este fichero dice «LOS opaco» a partir del
> retorno de `0x1bb0`/`0x3f6e`, el sentido es: **retorno 0 = OPACO (corta) · retorno 1 = bit
> PUESTO = TRANSPARENTE**. Son 210 transparentes / 46 opacos. La lectura de `0x1dfd` que hace
> este fichero («si `0x1bb0` devuelve 0 → corta») es CORRECTA y no cambia; lo que se fija es
> el sentido del BIT, que otras actas tenían invertido.

## Cadena estática — COMPLETA (cita dura)

**In Flam Grav (idx14) → handler `CAST.OVL:0x1c36`.** Confirmado:
- `0x1c36` toma dirección en `[bp+4]` (switch 1/2/3/4, 0x1c6a-0x1c7f) y en `0x1c8c/0x1c9d`
  hace `cx=0x15(21)` + copia la **curva radial de 21 words `0x1cf0`→`0xa9d0`** (la tabla que
  resolví en LOTE E.2, `lote-E-dataovl-residual.md`).
- El CUERPO de 0x1c36 se extiende (mismo marco `sub sp,0xbe`; el único `ret 6` previo es
  0x1c32, de la rutina anterior) hasta el **bucle de línea 0x1dc9-0x1e46**:
  ```
  1df8: call 0x1bb0            ; trazado por celda
  1dfd: or ax,ax ; je 0x1e68   ; si 0x1bb0 devuelve 0 (fuera) → corta
  1e05-1e1f: bounds g_cmb_scratch_x/y en [0,0xB)  (ventana 11x11)
  1e2d: cmp byte [bx-0x54fe],0 ; jne 0x1e70   ; [0xab02+scratch] = mapbuf; obstáculo → corta
  1e34-1e46: avanza la línea (+2 a los acumuladores)
  ```
  y dentro de `0x1bb0`, en **`0x1c28: call 0x7fee`** (= kernel `0x3f6e`, rebase 0xbf80+0x7fee)
  se lee el bitmap LOS **`0x6a14`**.

⇒ **La colocación del campo de In Flam Grav consulta la opacidad LOS `0x6a14` por celda y
corta la línea en el obstáculo** (mapbuf 0xab02 != 0 o LOS opaco). El trazado `0x1df8` NO es
"combate-only": está en el handler del propio hechizo de campo, que corre en el contexto que
lo invoque. RESPALDO ESTÁTICO a la lectura conservadora (línea cortada por opacidad).

## Witness runtime — parcial (cast OK, BP de overlay no validado)

Probe `probe_linespell_los_v2.py` (oráculo headless propio). Cast de In Flam Grav en
overworld con entrega de teclas sincronizada a key-poll (caster-select Enter → runas i,f,g
→ Space submit → getdir UP):

- **El cast FUNCIONÓ**: mapbuf `0xab02` 11x11 pasó de hierba a campo:
  ```
  PRE (centro):  05 05 05 / 05 00 05 / 05 05 05      (0x05 hierba, 0x00 party)
  POST:          3a 3b 3c / 3d 00 3f / 21 25 05      (0x3a-0x3f = tiles de campo, pesado al N)
  ```
  Apunté UP → el campo aparece en las filas norte; la fila sur casi intacta ⇒ colocación
  DIRECCIONAL. (Diagnóstico del arnés: el (C)ast overworld mete caster-select 'Cast & who?'
  cursor de roster ANTES del getstring, cast-input.md §9 — el base v1 se desincronizó ahí;
  v2 lo arregló con entrega poll-sincronizada.)
- **BP en 0x1df8 (0xdd78) / 0x1bb0 (0xdb30): 0 hits** pese al cast exitoso. Negativo NO
  fiable: la dirección del BP de OVERLAY (CAST.OVL base 0xbf80 → runtime) no está validada en
  este arnés (los BP previos verificados eran de kernel/CMDS). No se concluye nada del 0-hit.

## Estado
- **Mecánica (stop-semantic por opacidad + peso radial pico-centro): CITADA estáticamente**
  → cableo conservador respaldado.
- **Matiz visual** (¿arde la celda del obstáculo o el muro para antes? patrón de borde
  probabilístico): pendiente de (a) validar BP de overlay + (b) escena con obstáculo
  adyacente. Routeado al usuario (PENDIENTES-USUARIO.md #4d) o a un boot con árbol inyectado
  en la tabla de objetos, a decisión del lead.

## BOOT FINAL — BP de kernel 0x3f6e (fiable): In Flam Grav NO usa el predicado LOS · CORRIGE la lectura previa

Para eludir la ambigüedad del BP de overlay, puse el BP en el **kernel `0x3f6e`** (el
predicado LOS que lee 0x6a14; dirección de kernel FIABLE, mismo mecanismo con que
ring_regen 0x400c picó 38×). ~~Único caller estático~~ **[CORREGIDO por #173: son DOS — `CAST.OVL:0x1c28` y `COMSUBS.OVL:0x142a`, medido con `re/tools/callers_por_banda.py` en `99c07474`; la corrección ya estaba en `los-passability-audit.md:58` y no se había perseguido hasta aquí]**; el de esta lectura es CAST:0x1c28 (dentro de 0x1bb0).

**Resultado (3 casts de In Flam Grav, campo colocado CONFIRMADO por mapbuf):**
```
OVERWORLD cast1 (seed 1234): kernel 0x3f6e hits=0 · overlay 0x1df8 hits=0
OVERWORLD cast2 (seed 7abc): kernel 0x3f6e hits=0 · overlay 0x1df8 hits=0
COMBATE       cast:          kernel 0x3f6e hits=0 · overlay 0x1df8 hits=0
```
El BP de kernel es fiable ⇒ **0 hits es dato real: In Flam Grav NO invoca el predicado LOS
0x6a14 en ningún contexto (overworld ni combate).** El trazado 0x1df8→0x1bb0→0x1c28 está
CODE-PRESENTE en el handler 0x1c36 pero **NO se ejecuta** para el fieldWall (el gate
`0x1c03: test [bp+6],1; je 0x1c2e` salta la llamada LOS 0x1c28). ⇒ el trazado LOS / 0x6a14
pertenece a otro tipo de hechizo (apuntado/línea verdadera), NO al fieldWall.

**CORRECCIÓN a mi reporte previo:** la afirmación "In Flam Grav corta por opacidad LOS"
(respaldo estático) queda INVALIDADA por runtime — el fieldWall NO consulta 0x6a14.

## Geometría de siembra del campo (SPEC de la feature In*Grav) — DETERMINISTA

El campo se coloca como tiles `0x3a-0x3f` en un bloque 3x3 direccional (apunté UP → norte),
**idéntico entre las 2 seeds** (1234 vs 7abc):
```
cast1 (seed1234):  3a 3b 3c        cast2 (seed7abc):  3a 3b 3c
                   3d 3e 3f                           3d 00 3f     (00=avatar sin sobredibujar)
                   21 25 05                           21 25 05
```
- Los 6 tiles `0x3a-0x3f` son consecutivos → variantes/frames del tile de campo, colocados
  en arreglo FIJO (no aleatorio).
- **NO varía con la seed** ⇒ el peso radial (curva 21-words 0x1cf0) **NO es probabilidad
  por-celda** que deje bordes vacíos (a esta escala 3x3): el patrón es geométrico fijo.
  (Responde la Q3 del lead: borde NO probabilístico observable.)
- La fila sur (opuesta al aim) NO recibe campo (21 25 05, no 0x3a-3f) ⇒ colocación
  DIRECCIONAL norte.
- **Stop-semantic**: no testeable aquí (spawn en hierba abierta, sin obstáculo LOS-opaco
  adyacente); y dado que el fieldWall NO usa 0x6a14, el "corte por opacidad" probablemente
  no aplica al fieldWall — su extensión es el patrón fijo, no un raycast.

CAVEAT: sin control positivo (no verifiqué que 0x3f6e SÍ pica para un hechizo APUNTADO);
el negativo es fuerte (BP fiable + campo colocado) pero un apuntado confirmaría a quién
pertenece 0x1df8. Capturas: `final_ow1.png`, `final_combat.png`.
