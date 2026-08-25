# Derivación del RESPLANDOR A DISTANCIA (cabo de #350 §6: «el encolador de (21,27) sin nombre»)

Carril deriva-resplandor, 20-08. Cierra el micro-mecanismo que el acta
`visibilidad-350-testigo.md` §5-§6 dejó ABIERTO y ACOTADO: el original revela a
distancia hasta 34 celdas del halo de una antorcha que ni la transcripción de
#256 ni el port producían, y el trace nombraba a (21,27) como celda de cola sin
encolador conocido. La orden vigente era NO PORTAR SIN DERIVACIÓN; esto es la
derivación, su validación contra TODO lo medido por #350, y el calco.

## §1 — Las dos correcciones a la lectura de §3 del acta #350

Leído instrucción a instrucción sobre `re/disasm/ULTIMA.EXE.asm` (0x5A28 y sus
helpers), SIN corrida nueva: todo lo de abajo se valida contra las corridas ya
hechas.

**(a) La polaridad de 0x5DFE estaba INVERTIDA — y con ella las dos ramas de
fuera-del-radio.** La cadena que la fija:

- `0x402` es un memchr: `0418 repne scasb`; halla → `041f lea ax,[di-1]` (≠0);
  no halla → `041a mov ax,0` (el `mov` no toca flags y el `jne 0x422` decide
  con el ZF del scasb).
- `0x5DFE` lo llama con (tabla=DS:0x6A86, tile, cuenta=0x13) y mapea:
  `5e42 or ax,ax` → `5e23 jne 5e2a` → hallado→`5e2a sub ax,ax`=0,
  no-hallado→`5e25 mov ax,1`. Los cinco `cmp` inmediatos de 5e01-5e1d (visores
  0x4B/0x4A/0xBA/0xBB/0x98) devuelven 1 sólo con radial==1 (`5e1f cmp [bp+4],1`).
  ⇒ **0x5DFE = 1 significa «el tile DEJA PASAR», 0 «bloquea»** (0x6A86 es la
  tabla de 19 opacas).
- En el flood, `5bfe call 0x5dfe / 5c01 or ax,ax / 5c03 jne 0x5c52`: el salto a
  5c52 lo toma la **TRANSPARENTE**. Por tanto:
  - **5c52-5c91 = TRANSPARENTE fuera del radio**: clamp GLOBAL 0..31
    (5c59/5c68/5c6a/5c6f) y visible ⟺ **la PROPIA celda en 0xAD14** (5c8c),
    SIN mirar al padre; si no, `5c74 mov [si],0` — decidida en los dos sentidos.
  - **5c05-5c45 = OPACA fuera del radio**: padre≠0 (5c14) Y padre en 0xAD14
    (5c29) Y propia en 0xAD14 (5c40); si falla, `5c47` escribe 0xFF
    (reintentable desde otro vecino).

  Las etiquetas de §3 del acta #350 (y la transcripción de #256) estaban
  INTERCAMBIADAS. En régimen de CONTACTO ambas lecturas coinciden en las
  escenas medidas — por eso la sonda de 15.360 posiciones de #256 y las tres
  posiciones de contacto de #350 no podían ver la inversión.

**(b) El ENCOLADOR de (21,27), nombrado.** La vía 5c74 escribe 0 en el buffer
pero **NO toca `[bp-0x214]`**, que conserva el TILE leído en 5bca. El push
(5ca1-5cd8: `call 0x5dfe` sobre `[bp-0x214]`, `5cb9 je 5cdb` salta el push si
bloquea) ve un suelo transparente y **encola la celda OCULTA**. Lo que no
empuja: 5c47 escribe 0xFF también en `[bp-0x214]` y 0xFF está en la tabla de
opacas (el truco del 0xFF-como-tile que §2.5 del acta ya midió); un visor sólo
a radial 1; los muros visibles tampoco (su tile está en tabla).

⇒ **El mecanismo del resplandor**: el paseo (clamp 0..10, 5b2b-5b40) recorre
TODA la región transparente 8-conexa alcanzable del encuadre, a oscuras
incluida, y cada celda transparente ILUMINADA que toca se enciende POR SÍ SOLA
(5c8c); cada muro ILUMINADO se enciende si su padre de cola es visible e
iluminado (5c05-5c45). En la escena de #350: (21,27) —suelo a oscuras— se
encola oculta, su anillo alcanza (22,27) —suelo iluminado, visible por sí
solo— y éste abre (22,28) —muro iluminado con padre visible+iluminado—: las
dos aristas EXACTAS del trace, con sus valores 0x44/0x4F.

## §2 — Validación contra TODO lo medido por #350 (sin corrida nueva)

Simulador V3 (`re/tools/visibility_resplandor_v3_sim.py`, calco instrucción a
instrucción incluido el anillo CUMULATIVO de la tabla de saltos 5b16 con
contador 7→0: W,SW,S,SE,E,NE,N,NW):

- **726/726 celdas-posición, CERO mismatches** contra los volcados RAM de las
  seis posiciones (px=17/19/20/21/22/25, ventana 0xAB02 + máscara 0xAD14 de las
  corridas v3/v4 del testigo). Las 34 del sobre-revelado incluidas.
- **Aristas del trace: prefijo 10/10 EXACTO** (mismo orden de anillo, mismos
  valores); la 11ª del trace RAM ya estaba adjudicada AJENA por el acta #350
  (barrido de emisores del redraw siguiente).
- El sim además NOMBRA el encolado: (f6,c9)=(21,27) entra en cola con su byte
  de buffer a 0 (oculta), puesto 24 de 32 pushes en px=17 (23 de los 32
  ocultos). Predicción anclada para el testigo vivo de §4.

La misma semántica transcrita en TS (`visibility-original-referencia.model.ts`
corregido) reproduce las mismas 726/726 con la máscara RAM en crudo
(`visibility-resplandor-350.test.ts`).

## §3 — Hallazgos colaterales de la validación (los midió el estreno del test)

1. **El resplandor tiene DOS piezas load-bearing, no una.** El primer mutante
   (sin encolado de ocultas) esperaba perder las 34 y en px=20 perdió CERO:
   ahí el halo toca el disco por ADYACENCIA y lo que revela es la regla
   transparente-sin-padre (pieza (a)), no el encolado (pieza (b)). Reparto
   medido de las 34: encolado (hueco a oscuras) = 2+10 (px=17/19); regla
   sin-padre por adyacencia = 22 (px=20). Dos mutantes en el test, uno por
   pieza.
2. **El pase de la party es modo 1 SIEMPRE, con o sin emisores.** El paseo por
   ocultas puede RODEAR un muro saliendo del disco y RE-ENTRAR: la evaluación
   dentro-del-radio (5bd9) no mira al padre, así que revela celdas del disco
   alcanzadas por detrás de un muro AUNQUE no haya ni una luz. Mi primera
   versión del calco trataba party-sin-emisores como modo 0 «equivalente» y el
   control «muros y sin emisores» del test de referencia la refutó (careo
   modelo-vs-port ≠ 0). El binario no tiene ese atajo; el port ya tampoco.
3. **Careo con la clase #253** (encargo): el calco cambia el CONTENIDO de la
   máscara de visibilidad del core (qué celdas), no añade paso de composición
   ni toca ninguna de las dos vías del shader (`terrainOnly` ni recorte pleno).
   Las celdas del resplandor son de la misma clase que las del halo en contacto
   (visibles-fuera-del-disco), que ya se pintan hoy. Sin cambio en render.

## §4 — El testigo VIVO del push (el BP que pedía #350 §6) — CORRIDO Y SELLADO

`re/tools/visibility_push_trace_probe.py` (commiteado): dos fases como el trace
de #350, BP en 0x5CBB (el bloque de push tras el `je 5cdb` NO tomado), vuelca
fila/col/padre/valor y el byte del buffer en cada encolado. Predicción anclada
(del sim, escrita ANTES de la corrida): 32 pushes en px=17, 23 con buffer=0,
(6,9) en el puesto 24 con buffer=0.

Corrida del 20-08 (mismo save sembrado, boot 72 s, luz 2 validada):
**prefijo 32/32 EXACTO contra la predicción** — mismo orden, mismas fila/col,
mismas 23 OCULTAS — y el sello del encolador en crudo:
`[push 24] encola (f6,c9) padre (f6,c8) valor=44 buffer=00` = **(21,27)
entra en la cola con su byte de buffer a 0**, y seis pushes después su anillo
abre el islote (`[push 30] (f6,c10) padre (f6,c9) buffer=44`). Hubo un hit 33
AJENO tras agotarse la cola del pase — (f3,c9)←(f4,c10) valor FF, la MISMA
firma (y las mismas coords) que el 11º hit del trace de #350 que el acta
adjudicó al barrido de emisores del redraw siguiente / pila rancia (regla 6 de
oracle.md). El `fin` por 0x598A no llega con el juego quieto (tras el primer
recálculo los redraws van por la rama incremental, que no pasa por 0x598A —
la MISMA limitación con la que acabó el trace2 de #350); la corrida se cerró
por SIGINT con el JSON escrito por el finally. Los 33 hits están en el log y
el JSON del scratch (no commiteados: regla de #307; el probe los regenera).

## §5 — El calco (port) y sus esperados

- `core/world/visibility.ts::floodFOV`: ramas intercambiadas corregidas +
  encolado de ocultas + parámetro `paseParty` (modo 1 explícito; los floods de
  emisor siguen en modo 0: 5be1→5c9c no escribe ni empuja fuera del radio).
- Esperados EN CRUDO en `game/tests/visibility-resplandor-350.test.ts`: la RAM
  de las seis posiciones reducida a bits visible/oculta + coordenadas
  iluminadas (los volcados completos NO se commitean: llevan rejillas de tiles,
  material EA — misma razón que smallmaps.json, ficha #307). Estreno en ROJO
  medido: 3 rojos del lado del port/modelo antes del calco (px=17/19/20, las 34
  exactas), 6/6 verdes después sin tocar una cadena esperada.
- Controles del test de referencia re-derivados (los tres ceros re-corridos +
  control positivo con predicción a mano nueva: la lectura de #256 deja a
  oscuras las 8 celdas del halo que el resplandor enciende, 8/8 exacto y
  alReves=0; mutantes 69/46 y 1361 EN CRUDO).

## §6 — Para el panel

- El cabo «encolador de (21,27) sin nombre» de #350 §6: CERRADO con derivación
  + validación 726/726 + calco. La dirección del defecto del port (sub-revelado
  conservador) queda eliminada en las escenas medidas.
- La ficha nueva de #350 §6 sobre `_find_roster`/dosbox-x 2026.08.02 sigue
  ABIERTA (no era de este cabo).
- El testigo del push (§4): CORRIDO el 20-08 y sellado — prefijo 32/32 contra
  la predicción anclada, (21,27) encolada oculta en el puesto 24. Sin deuda.
