# BRIEF — el DEMO del attract como SECUENCIA DEL MOTOR (derivación de kernel 0xfb1a [= CS 0x7cda → FONT.OVL:0x04a4 font_scene_init])

Para el scout de kernel (intro-demo-scout-2). Consolida lo YA derivado para que no
redescubras nada. Hipótesis del usuario: **"las animaciones de la intro son SECUENCIAS DE
MAPA reales — sonidos, personajes, sprites, movimientos, en secuencia automática"** = el
demo del recuadro NO es una composición de INTRO, es **el MOTOR DE JUEGO reproduciendo una
escena** (demo playback), llegada vía return-to-view. **Confirmado en MECANISMO; falta fijar
la ESCENA.** Régimen: cita `re/disasm/ULTIMA.EXE.*` + offset, NO derives de resúmenes/vídeo
(ver memoria `disasm-completo-vs-segments`; ya me costó un dead-end, §C abajo).

## A. STAGE 1 — CONFIRMADO con citas (INTRO.OVL)

Disasm de INTRO.OVL en scratchpad de sesión (regenerable: `re/tools` binfiles+disasm sobre
`INTRO.OVL`, code_offset=0). g_location = `[0x5893]` (ledger `globals.json`).

1. **Idle-timeout del menú LANZA el demo.** Bucle de espera `INTRO 0x0d75-0x0d91`: contador
   `si` a **200 ticks** (`0x0d87: cmp si,0xc8`); sin tecla toca música (`0x2090`). Al agotarse,
   tecla por defecto = **'R' (0x52)** (`0x0dec: mov [bp-0xe],0x52`). 200 ticks ≈ 12 s ⇒ **casa**
   con el título ESTÁTICO de `video-P` f037→f060 y el demo arrancando en f061.
2. **'R' → return-to-view del KERNEL.** Dispatch de 'R' en `INTRO 0x100a: call 0xfffffb1a`
   (return-to-view) y luego `jmp 0xcd0` (redibuja el menú). ⇒ el demo corre DENTRO de
   `0xfb1a` (kernel) y al volver, menú. g_location `[0x5893]`=**0x40** (modo menú/intro) al
   entrar (set en `0x0156` play_introduction, `0x0ca3` título→menú).
3. **Las figuras del cuarto = rutas BRITISH.PTH.** `british-path.json` = 4 rutas
   (856/548/411/964 pasos, ±1 px). La figura del cuarto en `video-P` f082 (~x110,y155) ∈ bbox
   de la ruta 2 (x[74,114] y[129,170]). ⇒ los movimientos del demo SON las rutas PTH (carril
   de la caja). *(El tile 0x113=275=RidingHorseLeft del attract-de-título del asm es OTRO
   render; el demo-cuarto renderiza PERSONA — ver `intro-attract-loop.md §tile 0x113`.)*
4. **Audio de `video-P` MUDO** = -91 dB (silencio digital, toda la pista). ⇒ los SFX del demo
   (pasos/moongate/chimes) NO se witnessan de ahí; derívalos del kernel (el motor los emite
   gratis al mover actores / abrir moongate) o valida con la captura-con-audio que el lead
   pidió al usuario.

## B. EL OBSTÁCULO TÉCNICO (mapear 0xfb1a al kernel)

`call 0xfffffb1a` (INTRO 0x100a) = `e8 0d eb` → rel16 `0xeb0d` = signed −0x14F3; target desde
0x100d = **0xFB1A por wrap NEGATIVO** ⇒ apunta al **KERNEL RESIDENTE** (segmento cargado ANTES
de INTRO), no al segmento de INTRO. Para leer la función:
- El kernel está **committeado y censado**: `re/disasm/ULTIMA.EXE.segments.md` + `.seg2.md`
  (ledger: kernel 34544/34544, ~130 `kernel_fn_*`). ULTIMA.EXE: MZ, entry `081d:0000`, base de
  carga observada `0x0824` (oráculo), entry absoluto `1041:0000`.
- Hay que **resolver el layout de carga de overlays DOS/PLINK86** para mapear "0xfb1a" (como lo
  ve INTRO) a un offset de la imagen de ULTIMA.EXE. Pista: `intro-blit-formats.md` ya resolvió
  otras entradas kernel con **base de INTRO 0x81C0**; el init/loader de overlays PLINK86 está en
  `kernel-sweep-2.md §0x1158 runtime_init_and_overlay_loader`. Busca la tabla de thunks/entradas
  del overlay (el vector fijo por el que INTRO salta al kernel).

## C. DEAD-END YA DESCARTADO (no lo repitas) — el demo NO es INIT.GAM/Iolo's Hut

Inferí "return-to-view muestra INIT.GAM" y lo **REFUTÉ por datos**:
- Formato `.GAM` (offsets del parser del port `game/src/core/saveNative.ts`): **location `0x2ed`,
  floor `0x2ef`, x `0x2f0`, y `0x2f1`**. `INIT.GAM` = **location 0x0d=13, floor 0, (15,15)**;
  `SAVED.GAM` = loc 0x11=17.
- Enum de location (`docs/formats/maps.md`): **13 = Iolo's_Hut** (dwelling). Mapa = `DWELLING.DAT`
  idx **12** (orden: Fogsbane 0-2, Stormcrow 3-5, Greyhaven 6-8, Waveguide 9-11, **Iolos_Hut 12**,
  Suteks 13, SinVraals 14, Grendels 15; 16 mapas de 32×32×1B).
- Renderizado, Iolo's Hut = sala de **muro de ROCA (0x4d LargeRockWall)**, cookstove(0xbf)/
  barril(0xa6)/jarra(0xa9)/cama(0xab/ac)/mesa(0x94-96)/sconces(0xb0/b1), **rodeada de árboles**.
- **NO casa** con el cuarto del witness `video-P` f070: rectangular, **muro de ladrillo de
  piedra (0x4f StoneBrickWall) de borde a borde, SIN árboles**, con **espejo(0x9d) + estantería
  de libros + cómoda + planta(0x5b) + arcos(0x87 BrickWallArchway)** + cama + mesa.
⇒ **el demo NO renderiza INIT.GAM.** Qué SÍ renderiza = tu objetivo.

Búsqueda por datos (mapas con espejo0x9d + planta0x5b + arco0x87): **TOWNE idx7 (New Magincia),
CASTLE idx1/13** — ninguno casa limpio a ojo (CASTLE1 = dormitorio multi-cama). La estantería
de libros del witness NO está en TileData con nombre "Bookshelf" (identifícala). Estos son
PISTAS, no conclusión: **confirma con el ASM qué carga 0xfb1a**, no por matching de mapas.

## D. LO QUE DEBES RESPONDER (Stage 2 = SOLO identificar la escena; implementar = Stage 3 con OK del lead)

1. **¿Qué monta return-to-view (0xfb1a) cuando g_location=0x40?** ¿Carga un save/estado fijo del
   demo (¿qué fichero?)? ¿Un mapa concreto (location + x/y)? ¿O reproduce lo que haya en RAM?
   Da la **location + posición** exactas de la escena del demo (para renderizar el mapa correcto).
2. **¿De dónde salen los ACTORES y sus movimientos?** ¿Las rutas BRITISH.PTH se cargan como
   movimientos de actores en espacio de mapa? ¿Qué sprites (party de INIT.GAM = Avatar+Shamino+…,
   o NPCs de la location)? ¿Aparece el moongate (tile 0xdc) y quién lo anima?
3. **¿Quién AVANZA la secuencia y cómo TERMINA?** ¿Ticks del game-loop del kernel dentro de
   0xfb1a? ¿Vuelve al menú por tecla, por fin de rutas PTH, o por timeout? (INTRO hace `jmp 0xcd0`
   al volver.)
4. **SFX derivados**: lista los cues que el motor emitiría en el demo (pasos al mover actor,
   apertura/cierre de moongate, ambiente de la location) con su primitiva de kernel — para
   validar contra la captura-con-audio del usuario.

## E. CONVERGENCIA CON #20 (probablemente el MISMO trabajo)

El "motor de escenas de tiles" ya está parcialmente derivado en `intro-summoning-scene-engine.md`
(scene-engine de FONT 0x0418/0x02fc + intérprete 0x04a4; moongate=tile 0xdc scripteado; MISCMAPS.DAT
= mapas 11-ancho del ENDGAME "The Summoning/Journey/Arrival/Welcoming"). El demo-cuarto llega por
return-to-view (vista de juego), mecanismo HERMANO. Si 0xfb1a resulta ser el mismo motor de
demo/escena, **#20 y este encargo son la misma derivación** — coordínalo con el lead.

## F. ESTADO DEL PORT (para Stage 3, cuando toque)

El demo-cuarto actual es un **CALCO del witness** (aterrizado): `game/src/skin/fiel/summoning-room.ts`
(mapa de tiles + mobiliario a nivel de rasgo) + `attract-figures.ts` (rutas PTH, sprite persona 284,
sólo carril caja, título estático) en `ui/faithful-intro.ts`. La implementación DEFINITIVA
(Stage 3) sustituye el calco por el **mapa real + estado + actores + SFX** que fijes aquí, y
"reproduce el demo en nuestro motor" (que ya es el juego completo). El módulo está aislado para el swap.
