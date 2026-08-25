# Witness — Catalejo nocturno (A6): entorno validado + mapeo + bloqueos

**Carril:** oráculo (SCOUT) · **Fecha:** 2026-07-18 · **Rama:** `re/oracle-witnesses`.
Cierra (o intenta) el INDETERMINADO de A6: ¿la vista celeste del catalejo pinta
cometas/planetas con posición significativa, o sólo lunas (cosmético)?

## Entorno del oráculo — VALIDADO ✅

Boot end-to-end en 78 s (headless, scratch propio `U5RE_ORACLE_SCRATCH=
/private/tmp/<oracle-rundir>-scratch-witnesses`, dosbox-x muere limpio, `pgrep` vacío tras
`quit()`). Lecturas confirmadas: `game_ds=0x1788`, `roster_off=0x55a6`,
**`g_hour=0x17` (23:00 = NOCHE)**, **`g_location=0x11` (pueblo/keep)**. Video mode = **0x0D
(EGA 320×200, 16 colores, planar)** (drivers-drv.md:128).

**Conveniencia:** el save de referencia YA está en noche + pueblo → el gate del catalejo
(`g_location<0x21 && g_floor<0x80 && (hora<6 || hora>18)`, CAST.OVL 0x1A3A) se cumple sin
navegar. Sólo falta el spyglass en inventario.

## Handler del catalejo — MAPEADO (CAST.OVL 0x1A3A)

```
1a3a: print "Spyglass" (0x498d)
1a41: cmp g_location,0x21; jae → "Not here!"       ; gate loc
1a48: cmp g_floor,0x80;   jae → "Not here!"        ; gate floor
1a4f-1a5b: si 6<=hora<=18 → "No stars!" (día)       ; gate noche
1a5d: print "Looking..." (0x4998)
1a64: call 0xffffbf9a      ; ← RENDER de la vista celeste
1a67: jmp 0x1b8a           ; fin (NO espera tecla explícita en esta rama)
```

- **Grant del spyglass:** flag gameseg **`0x57BA = 0xFF`** (npc.md:262, «Lord Seggallion»).
  Se puede sembrar con `write_mem_gameseg(0x57BA, b"\xff")`.
- **Render = `0xffffbf9a`**, thunk cross-overlay (el bias +0x81D0 de MAINOUT NO aplica a
  CAST). Sin resolver su cuerpo, no sé estáticamente si lee tabla de cometas/planetas o
  sólo fase lunar.

## Bloqueos técnicos para el «volcado de pantalla» (por eso NO fabrico un veredicto)

1. **Input del (U)se es un SELECTOR GRÁFICO, no documentado.** El (U)se de items
   especiales usa `find_next_owned`/`find_prev_owned` (@0x05a4/0x056c): una lista
   navegable. No tengo el modelo de teclas (¿flechas? ¿espacio? ¿Enter?) en las notas, y
   el estado del selector es GRÁFICO (modo 0x0D) → `screen_text()` (lee 0xB800 texto) NO
   sirve; habría que decodificar el framebuffer EGA en cada paso para saber qué item está
   resaltado. Mitigación posible: aislar el spyglass como ÚNICO item especial (poner a 0
   los demás flags: torches 0x57AE, grapple 0x57AF, carpet 0x57B0, skull 0x57B1, sextant
   0x57BC, badge 0x57BE, + scrolls/potions/amulet/crown/sceptre/shards) para que `u`+Enter
   lo use directo. Falta confirmar la tecla de confirmación.
2. **La vista celeste puede ser TRANSITORIA.** Tras 0x1A64 el handler salta a 0x1B8A (fin)
   sin esperar tecla; si el bucle principal redibuja el mapa al siguiente frame, el
   starfield se sobrescribe. Para capturarlo con garantía haría falta un BP de código justo
   en el retorno del render (CAST.OVL 0x1A67), y eso exige resolver la CS de carga de
   CAST.OVL en memoria (descubrible como el game_ds, pero es trabajo aparte). Si en cambio
   la vista PERSISTE hasta la siguiente tecla (plausible en U5: no hay redibujo continuo),
   basta pausar tras el (U)se y volcar 0xA0000.
3. **EGA planar:** un `read_mem(0xA000,0,N)` da UN plano (el seleccionado en Read Map
   Select); los 4 planos se solapan en 0xA0000 y se conmutan por puerto 0x3CE/0x3CF, que
   MEMDUMPBIN no toca. Un volcado de 8000 B = 1 plano (1bpp, 320×200) — suficiente para ver
   la FORMA (¿discos de planeta + estelas de cometa, o 2 lunas?) pero no color pleno.

## VEREDICTO (cerrado por evidencia ESTÁTICA decisiva — supera al screen-dump)

Antes de gastar ciclos de oráculo, un barrido del ledger CIERRA la pregunta de A6:

1. **La vista celeste es un ZODÍACO decorativo.** `re/ledger/frontier.json` tiene
   **`draw_zodiac_star`** (LOOKOBJ.OVL @428, IDENT+verified) y **`draw_zodiac_lines`**
   (LOOKOBJ.OVL @588, IDENT+verified): estrellas de constelación + líneas que las unen. Eso
   es lo que se dibuja al mirar el cielo — un zodíaco, no discos de planeta con posición ni
   estelas de cometa.
2. **NO existe estado de cometa/planeta en el binario.** `grep comet|planet` en
   `re/ledger/globals.json` = **0**. Lo único astronómico con estado son las FASES LUNARES
   (`g_moon_felucca 0x5885` / `g_moon_trammel 0x5886`, refrescadas de `MOON_PHASES[g_day]`,
   usadas por los moongates) — decorativo/mecánica de moongate, no predicción.
3. **La ubicación de los Shadowlords se trackea DIRECTO, no por astronomía.**
   `g_shadowlord_locs@0x58C8` (3 bytes, ciudad de cada SL) lo fija/lee TOWN/TALK/OUTSUBS
   directamente — no hay intermediario cometa→planeta.

**⇒ La «astronomía que predice qué ciudad ataca un Shadowlord vía cometa cerca de planeta»
(clue book pág. 55) NO EXISTE como mecánica en el U5 DOS.** No hay estado de cometa/planeta
que la respalde; la vista del catalejo es un zodíaco decorativo. El port es FIEL: su
«Looking...» cosmético refleja la ausencia de mecánica de predicción; sólo falta portar el
DIBUJO decorativo del zodíaco (cosmético puro, cero gameplay). El §A6 del censo debe pasar
de INDETERMINADO a **NO-ES-HUECO de mecánica** (la predicción es adorno del manual/fan-lore)
+ nota de cosmético pendiente (zodíaco de LOOKOBJ, tarea de píxel/AV, no de fidelidad).

Confianza: ALTA (ledger verificado + ausencia de estado). Un screen-dump del catalejo sólo
confirmaría visualmente «zodíaco, no cometas/planetas» — redundante para el veredicto de la
PREDICCIÓN, que se zanja por la ausencia de estado. Queda OFRECIDO como confirmación visual
opcional si el lead lo quiere (via el BP en `draw_zodiac_star` + uso del catalejo).

## (Original) Recomendación / pregunta al lead — SUPERADA por el veredicto estático

Puedo intentar la captura con el spyglass aislado + `u`+Enter + volcado de 0xA0000 (1
plano) tras el uso, decodificando offline — es 1 ciclo de boot (~2 min) por intento, con
iteración probable por los 3 bloqueos. ANTES de gastar varios ciclos a ciegas (condición
que oracle.md avisa que da datos flaky), pido:
- ¿tienes el modelo de teclas del (U)se de items especiales del DOS (next/prev/confirm)?, o
- ¿prefieres que arranque por **Insignia** (witness #3), que es un witness de VALOR DE
  RETORNO limpio (ejecutar el handler opaco 0x1912 con `g_time_spell=0x1d` vs no, y leer
  ax) sin decodificar framebuffer — probablemente el más robusto de los cuatro?
  [⚠ 30-07: ese witness quedó SIN OBJETO — el «handler opaco 0x1912» se resolvió
  estático (TALK 0x031E leído entero) y SÍ consulta g_time_spell==0x1d;
  re/notes/talk-031e-resolucion.md]

Nada fabricado; el INDETERMINADO de A6 sigue abierto hasta resolver el input o el render.
