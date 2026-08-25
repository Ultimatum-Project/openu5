# Sonda 0xEC — TESTIGO VISUAL EN VIVO (27-07, sesión de oráculo con el usuario)

El debugger del DOSBox-X del usuario no está compilado (menú en gris), así que la sonda
de memoria (BPM B587) no pudo correr. **La sesión se reconvirtió a testigo visual jugado**
— y contestó el veredicto de sala, aunque NO el valor del índice (ver alcance).

## Setup

Escenario `covetous-r1-remolinos` (u5save): base `doom-n5-descenso/SAVED.GAM` con SOLO
4 bytes de posición parcheados (0x2ED=37, 0x2EF=0, 0x2F0=0, 0x2F1=2). **Confound del
save-contaminado DESCARTADO leyendo el fichero**: `g_dng_room_cleared` @0x33A idéntico a
la base — Covetous ENTERO virgen (bit 49 de r1 = 0); las únicas salas marcadas del save
son Doom r0/r3 (herencia del descenso de la base).

## Lo observado (usuario jugando, capturas en la conversación del 27-07)

Sala r1 de Covetous = combatmap 65 (6× sprite 236 + 6× sprite 237 + 1 Ghost 156 + 3
objetos <0x40 en el cuartito), entrada por el wrap oeste:

1. **SIN COMBATE, nunca**: ni monstruos ni pelea, en la entrada fresca ni en re-entradas.
   Entrada y salida libres, repetibles.
2. **Las 237 son FUENTES** — visibles, con posiciones que casan EXACTAS con el .CBT
   (arriba-centro, abajo-centro, dispersas). Flanqueadas por triángulos decorativos NO
   transitables (mosaico, no salidas).
3. **Las 236 no se manifiestan como nada visible/identificable** (el bloque 2×3 en
   x2-3,y4-6 coincide con la zona del cuarto oculto).
4. **El trigger de la lápida funciona**: Push → se abre el cuarto escondido (las celdas
   del trigger del .CBT). El cuarto está VACÍO — Search en cada celda no da nada, pese a
   los 3 sprites-objeto (<0x40) del dato.
5. **El Ghost (156) NO aparece** — ni ataca ni bloquea. (Podría estar invisible — los
   fantasmas de U5 lo son — o no colocarse; PREGUNTA ABIERTA.)
6. La única entrada usable es la del oeste (por el borde toroidal) — coherente con el
   análisis del port (approachDir west). playerStarts del .CBT: solo ESTE tiene
   coordenadas reales; N/S/O son (0,0)×6 — y el original COLOCÓ al grupo correctamente
   en la columna izquierda ⇒ **existe un mecanismo de respaldo de colocación no derivado**
   (experimento de entrada-norte encargado al usuario).

## Alcance del veredicto (matiz de bancos, adoptado)

- **CIERRA**: el veredicto de las 4 salas 100%-remolinos (el original NO monta combate
  con sala fresca; re-entrada libre) **y el ticket #25** (no hay «bit de sala despejada»
  que poner porque no hay combate que ganar — la sala se comporta como transitable).
- **NO CIERRA**: el valor que `ecFamilyEnemyIndex` debería devolver. El testigo no
  distingue «coloca decoración» de «coloca algo que no llega a actor por otra vía».
  Para 237 la lectura fuente-decorativa encaja al píxel; para 236 sigue **no derivado**.
  QUE NADIE LEA ESTA ACTA COMO EL VALOR DE LA TABLA.

## Abierto

- Ghost de cm65: ¿invisible o no colocado? (caminar la sala buscando choque invisible).
- Entrada por el NORTE (y sur): dónde coloca el original al grupo con playerStarts (0,0).
- Los 3 objetos <0x40 del cuartito: Search no los revela — ¿qué son?
- Hallazgo colateral del usuario: descubrió el trigger JUGANDO — el sistema de triggers
  del original coincide con el handler fiel de Combat.fireTriggers.

---
## ⛔ [ADENDA 27-07 NOCHE — SESIÓN NO CONCLUIDA: CONFOUND DEL SAVE]

El escenario u5save usado arrastraba dentro LA COPIA DE MAPA DE DOOM (base = save del
descenso de Doom; el parcheo de posición no tocó el bloque de mapa — verificado por
bytes: solo 3 difieren de Doom-limpio, y son las 2 salas despejadas allí + 1 puerta
secreta). La gema del usuario demostró después que el original USA la copia del save al
cargar (no relee DUNGEON.DAT) ⇒ esta sesión caminó sobre el mapa de Doom etiquetado como
Covetous. TODAS las observaciones de este acta quedan NO CONCLUYENTES respecto al
original hasta rehacerse con escenario sano (los saves se parchean con el mapa
auténtico). El descarte del confound por g_dng_room_cleared @0x33A era necesario pero
NO suficiente: el bitmap estaba virgen, la COPIA DE MAPA no. Ver
sonda-0xec-experimento-entrada.md (cabecera v4) y el carril guia-dosbox.

---
## ★ [RE-ADJUDICACIÓN FINAL 27-07 ~19:20 — LA SESIÓN FUE UNA QUIMERA, Y SE ENTIENDE ENTERA]

Con la respuesta de memoria del testigo («todo seguido desde la carga, sin salir ni
re-entrar») + los bytes del backup pre-parche: esta sesión jugó la ÚNICA sala de la
planta 0 del mapa arrastrado de Doom — celda (1,1), valor **0xA0 = roomNo 0 YA
DESPEJADA** (cicatriz del descenso base; cruza con el bitmap Doom r0/r3 del propio
save) — que con loc=Covetous montó el combatmap **64+0 = cm64** (geografía de Doom,
contenido de Covetous). Correcciones a este acta:
- La sala NO era cm65: era **cm64** (triple candado: roomNo de la celda; party en
  columna izquierda = banco OESTE poblado de cm64 entrando al ESTE por P0a; sin-combate
  = celda 0xA0). La ruta «wrap oeste» era reconstrucción errónea (norte+este).
- El punto 6 («mecanismo de colocación de respaldo no derivado») queda **RETIRADO**:
  era la colocación P0a normal con el banco oeste de cm64.
- El punto 1 (SIN COMBATE) queda EXPLICADO: sala despejada por celda 0xA0 — no dice
  nada de salas frescas de Covetous.
- El punto 4 (cuartito VACÍO pese a 3 objetos) y el 5 (Ghost ausente): consistentes
  con sala DESPEJADA (sin spawn de actores ni botín); ya no son anomalías.
- El punto 2 (237=FUENTES visibles) SOBREVIVE y gana: se renderizan como mobiliario
  incluso en sala despejada. La coletilla «EXACTAS con el .CBT» debe releerse contra
  cm64 (no cm65) si alguien re-examina las capturas.
- El trigger de la lápida (punto 3 del hallazgo) funcionó EN SALA DESPEJADA — dato
  fino para Combat.fireTriggers (los triggers no se apagan con la despejadez).
La retractación anterior («NO CONCLUYENTE») se sustituye por esto: la sesión SÍ es
concluyente — sobre la QUIMERA, no sobre las salas frescas de Covetous. El veredicto
de las 4 salas 100%-remolinos y el #25 siguen ABIERTOS (brazos con saves parcheados).

---
## ★★ [CIERRE FINAL 28-07 — LAS «FUENTES» ERAN TERRENO: CERO ANOMALÍAS RESTANTES]

Corrección **en sitio** (no se borra nada) del punto 2 de este acta, que decía «Las 237 son
FUENTES — visibles, con posiciones que casan EXACTAS con el .CBT (arriba-centro, abajo-centro,
dispersas). Flanqueadas por triángulos decorativos NO transitables».

**Acertaba en «posiciones exactas del .CBT» y se equivocaba de ZONA del .CBT.** El registro
tiene dos zonas: **columnas 0-10 × 11 filas = la ARENA (terreno)** y **columnas 11+ = datos**
(playerStarts filas 1-4, map-units filas 5-7). Reconciliadas las posiciones en cm64:

- **Terreno**: exactamente DOS `0xD8` = `Fountain1`, en `(col 6, fila 0)` y `(col 6, fila 10)`
  = **arriba-centro y abajo-centro**, y **flanqueadas 2 de 2** por `CornerStructure`:
  `d0 [d8] d1` y `d3 [d8] d2`. (Ids del diccionario del port `TileData.json` 216 / 208-211 —
  nombres, datos de EA, no derivación del binario.)
- **Map-units `0xED` (237)**: seis, en `(8,1) (7,2) (4,1) (8,8) (7,9) (4,9)`, sobre terreno
  llano, **sin** flanqueo decorativo (1 sola adyacencia a CornerStructure entre las seis).

★ Lo decide **la propia frase de este acta**: «flanqueadas por triángulos decorativos NO
transitables» describe celda a celda el patrón del **terreno**, no el de las unidades.
⇒ **el testigo vio las fuentes de la ARENA, no los sprites 237.**

**Consecuencia: la contradicción que quedaba abierta se disuelve entera.** El terreno no lo
coloca `cbt_scene_populate`; sólo las 16 map-units pasan por su gate (`arg2 > 0xEF` = sala
viva). Con la sala despejada (`0xA0` del mapa arrastrado) el gate estaba CERRADO, así que **no
se colocó ninguna unidad** — y eso explica de una sola vez: sin combate, 236 sin manifestarse,
Ghost ausente, cuartito vacío pese a los 3 objetos del dato. Los triggers de lápida siguen
funcionando porque no son map-units. **Cero anomalías restantes.**

Corrección adicional al inventario: la fila 5 de cm64 es
`1e 02 02 05 06 | ec ec ec ec | ed ed ed ed ed ed | 9c` ⇒ **cuatro** `0xEC` (236), no seis
como decía el punto de arriba; seis `0xED` (237); y `0x9C` (156) = el Ghost.

Derivación completa: `re/notes/cbt-fila4-reconciliacion.md` §4 y
`re/notes/gate-117e-adjudicacion.md`.
