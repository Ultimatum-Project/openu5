# Covetous: mapping wiki Schiraldi ↔ dungeons.json — SÚPER-ANÁLISIS (27-07, carril yt-covetous)

Encargo del usuario: los mapas de nivel del wiki (con mini-impresiones de cada sala) «no
casaban» con lo visto con (V)iew+gema en la sesión del testigo en vivo. Análisis completo.

## (a) El mapping CASA: 82/82 salas, sin off-by-one, sin espejo, sin rotación

`wiki Level N == floors[N-1]` celda a celda. La única transformación es una **TRASLACIÓN
TOROIDAL por nivel** (Schiraldi recorta el toro 8×8 desde un origen distinto por planta —
por eso «no parecen» la misma rejilla): `wiki_x=(json_x+dx)%8, wiki_y=(json_y+dy)%8` con
dx/dy = L1(3,0) L2(3,3) L3(3,6) L4(3,6) L5(0,0) L6(1,1) L7(1,5) L8(7,7).

Las 2 «discrepancias» de L6 eran ARTEFACTO del instrumento (el wiki sangra en rojo el
pasillo entre salas contiguas + la plantilla solo usaba el tile 0x44 y R12/R13 llevan
0x46/0xd8/0xc9): adjudicadas a mano por forma, y con **confirmación cruzada independiente**
— R12/R13 = cm76/77 son exactamente las dos salas que aulddragon jugó en L6 (Part 20).

Metrología (para re-hacerlo): niveles a 16 px/tile, celda 176 px (11 tiles), origen (0,25)
en L1/L7/L8 y (0,138) en L2-L6; el ancho lleva 1-3 columnas de wrap repetidas. NO 18 px/tile.
El wiki tiene Room-00..Room-15 (0-based): la sala del vídeo es Room-00=cm64, espejo de
Room-01=cm65.

## (b) ★ La celda del testigo: el ACTA tenía razón; el FICHERO derivó DESPUÉS

- floor 0 **(0,1) = MURO** (type 0xB). Posición imposible.
- floor 0 (0,2) = pasillo; al oeste por wrap (&7) → (7,2) = **Sala 1 = cm65**. ✓ el acta.
- **Recibos forenses**: los 2 backups de la sesión en vivo (`_backups/SAVED.GAM.20260727-151653`
  y `-152326`, md5 idéntico bd3d9b4846) leen `loc=37 floor=0 x=0 y=2`. El fichero vivo del
  escenario tenía y=1 (mtime 15:22, md5 distinto).
- **REPARADO el 27-07 tarde**: parcheando y=1→2 el fichero queda **byte-idéntico al backup**
  ⇒ la única corrupción era ese byte. Causa del cambio: no derivada (solo evidencia forense).
- Control de convención: los escenarios nuevos (planta2 / cadena-este / wrap) casan 3/3 con
  el JSON; las coords del .GAM son `floors[y][x]` directas.

## (c) El «no casa» de la gema: VISTA PARCIAL, no divergencia de datos

`buildGemView` (DNGLOOK 0x0388/0x06a8) reproducido sobre floor 0: la gema es ventana 22×22
CENTRADA en la party con el 8×8 embaldosado toroidal (geometría absoluta descolocada), solo
pinta el blob CONECTADO (flood-fill 8-conexo; 0xB/0xC/0xD cortan) y el PASILLO SE PINTA
NEGRO (indistinguible de no-alcanzado). Desde (0,2) salen las 8 salas de la planta pero
RE-COLOCADAS alrededor de la party — la sala pegada al oeste del cursor es json(7,2)=R1,
que en el mapa de Schiraldi está en el extremo derecho de la fila. Eso explica el «no casa»
entero. **Discriminador** (si hay captura de la sesión): desde (0,2) hay MARCO AMARILLO de
sala pegado al OESTE del cursor; desde (0,1) lo pegado al este es la ESCALERA gris de (1,1).

## Consecuencias para la sonda 0xEC (tarjeta v2)

1. El testigo en vivo SÍ estaba delante de cm65 con el banco ESTE poblado (el port ya elige
   banco por borde-opuesto: roomEntry OPPOSITE_EDGE) ⇒ la anomalía de la sala vacía sigue
   VIVA y sigue sin explicarse por degeneración. Hipótesis v2 (wrap) en pie.
2. Brazo W (0,4)→(7,4) = misma configuración que la sonda original (wrap, mismo banco):
   es la RÉPLICA deliberada de la anomalía, no un control — el contraste lo da el brazo B
   (entrada normal). Declarado así en la tarjeta.
3. En cm65 los bancos degenerados son W/S/N (el real es E); en cm64, al revés. «El oeste es
   el único lado degenerado» era impreciso: son slots por sentido de marcha.

## Límites

Celdas NO-sala (pasillos/escaleras/puertas/campos) sin verificar contra el wiki (el 82/82 es
de salas); los dx/dy ajustados maximizando coincidencia (una traslación pura da 82/82 — un
espejo habría fallado); del porqué del y=1 solo hay evidencia forense.
