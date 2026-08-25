# ACTA #130 — El sapo del «"Nay!"» del (B)oard, en sus tres capas

Carril `nay-130`, rama `fix/nay-130` (retenida; aterriza el lead). 2026-07-28. CERO e2e.
Origen: `sapo-120-acta.md` §2.bis (primer sapo del capítulo de huérfanos).

Las tres capas del encargo están hechas. La primera exigía derivar QUÉ es el campo que
gatea el rechazo, y la respuesta cambia el nombre de la cosa.

---

## 1. ★ El campo NO es «el dueño del caballo»: es el NÚMERO DE DIÁLOGO

La tarjeta y el acta de origen preguntaban si el word en `[bx+0x5f68]` era un índice de NPC
o un flag. Es ninguna de las dos: es el **dialogNumber** del NPC.

La cadena que lo cierra, y ninguna pieza de ella es mía —el repo ya lo tenía derivado en
tres sitios independientes que nadie había cruzado con esta guarda:

- **La tabla**: `g_npc_rt` en DS 0x5F5E, 32 registros de 0x10 B. El bucle del (B)oard hace
  `bx = idx << 4` y lee `[bx+0x5f68]` ⇒ el campo está en el desplazamiento +0x0A del
  registro. `re/notes/npc.md` §0.4 y `re/notes/shadowlord-urban.md` ya dan el layout:
  `+0x00 state · +0x02 x · +0x04 y · +0x06 z · +0x08 type · +0x0A dialogNum · +0x0C objIdx
  · +0x0E schedIdx`, y el segundo lo nombra **explícitamente** como el 0x5F68.
- **De dónde sale el valor**: el cargador de NPC.OVL 0x0090-0x00ad recorre `cx = 0..0x1F`
  copiando un byte por NPC desde un búfer de 32 B en el desplazamiento +0x220 del bloque
  del fichero, y lo guarda como word con paso 0x10. O sea: viene del `.NPC`, no se calcula.
- **Quién lo pisa**: lo pone a 0 el despawn de slot (TOWN 0x00d3, junto con +0x00/+0x02/
  +0x04/+0x06) y lo sobreescriben con los centinelas **0xFE** y **0xFD** dos barridos
  masivos de TOWN 0x1170 y 0x1190 —posesión del Shadowlord y alarma de arresto— más el
  `cmp …,0xfe` de TOWN 0x0917.

⇒ La guarda del (B)oard, leída con el campo bien nombrado, dice: **«este caballo tiene
número de diálogo, es decir es de alguien»**. No hay tabla de dueños en ninguna parte.

★ **Y el port ya modelaba el campo**: es `NpcRuntime.dialogNumber`, y escribe los MISMOS
0xFE/0xFD en los mismos dos sitios (`manager.ts` `possessForShadowlord` / `arrestAlarm`).
Lo único que faltaba era que el (B)oard lo mirase. Otra vez el patrón del lote #54: el port
ya tenía la respuesta y no la usaba.

★ **CONTROL POSITIVO EN LOS DATOS DEL PROPIO PORT**: de los 20 caballos de pueblo de
`assets/npcs.json` (`type & 0xFE == 0x10`), **diecinueve tienen dialogNumber 0** y
**exactamente uno no** — location 13, slot 4, dialogNumber 13. La rama existe para UN
caballo del juego entero, que es precisamente por lo que se podía quedar muerta sin que
nadie lo notara.

## 2. Las tres capas, hechas

| capa | qué era | qué se hizo |
|---|---|---|
| texto | el port emitía `Nay!` pelado | ahora `'"Nay!"\n'` VERBATIM (DS 0x425e = fileoff 0x426e), con las comillas literales y el salto |
| cableado | `horseOwned` con default `false` y CERO call-sites de producción | `Game.board()` lo calcula de `npcAt(pos).dialogNumber !== 0`, con el gate de pueblo de 0x083b |
| arnés | el test pasaba el flag a la función PURA y sellaba el texto malo | `board-nay.test.ts` prueba `Game.board` de punta a punta; el viejo se re-selló con la historia dentro |

El aserto viejo (`transport-exact.test.ts`) **no se borró**: se quedó como prueba de la
función pura, con el porqué escrito encima, que es la forma de que nadie lo vuelva a leer
como cobertura del cableado.

## 3. ★ Lo que este carril NO arregla, y por qué la rama SIGUE sin ser alcanzable jugando

Esto es lo importante del parte y va sin adornos: **cablear el flag no resucita la
característica**. Quedan dos huecos estructurales, los dos medidos:

**(A) `Game.board()` mira la capa equivocada.** El original lee el tile del **OBJETO** bajo
el party (CMDS 0x0826, `find_object_at_xy`, y de ahí saca también el índice de objeto que
alimenta el `find_npc_by_objIdx` de 0x0842). El port lee `activeMap.tileAt`, que es
terreno + overrides. Los caballos-NPC del port se dibujan como ENTIDADES, así que
`worldTile` no vale 0x10/0x11 para ellos nunca y el (B)oard ni siquiera entra en la rama de
caballo. El único caballo alcanzable hoy es el comprado en el establo, que se representa
como override de TERRENO.

**(B) El party no puede pisar la casilla de un NPC.** `game.ts:1045` corta el paso con
`npcAtTarget(dir)` para CUALQUIER NPC, sin excepción por tipo — y los caballos son NPCs de
tipo 0x10/0x11. En el original el caballo vive en la tabla de objetos y el party se le pone
encima antes de pulsar (B). Mientras esa excepción no exista, no hay forma de que el party
esté sobre un caballo-NPC.

Por eso los tests de cableado **colocan el estado a mano y lo declaran**: sellan que el
flag sale del NPC real (y no de un default ni de un barrido de la location), NO que exista
un camino de teclado. Prefiero un arnés que diga la verdad sobre su alcance a uno que
finja un camino que el juego no tiene — es el género «arnés que mide una caja que la
variante disuelve», y aquí lo dejo dicho en vez de tropezarlo.

Ninguno de los dos se arregla aquí: (A) cambia de qué capa sale `worldTile` para TODAS las
ramas del (B)oard (nave, alfombra, esquife) y (B) toca el bloqueo de movimiento de pueblo.
Los dos merecen medición propia. **Propongo tarjeta conjunta**, porque arreglar uno sin el
otro deja la rama igual de muerta.

## 4. Hallazgo lateral con nombre propio: «guardias» que son CABALLOS

`NpcManager.guardsOnFloor`, `tickGuards` y `core/world/loops/guards.ts` filtran por
`(type & 0xFE) === 0x10`. En el espacio de nombres de sprites del port el índice es
`type + 0x100`, o sea los tiles 272 y 273 = **`HorseRight` / `HorseLeft`**
(`TileData.json`). Es decir:
las tres rutinas llamadas «guardias» seleccionan **caballos**, y los «19 guardias aiType 0
= FIXED» que menciona el comentario de `manager.ts` son los 19 caballos de pueblo sin
dueño. TOWN 0x0C78 es un bucle de deambular de CABALLOS.

No lo renombro en este carril (es prosa de otro dueño y toca tres ficheros), pero es un
nombre-marcador que miente y conviene que alguien lo adjudique.

## 5. Hueco de i18n que este carril deja ABIERTO (declarado, no arreglado)

La clave fiel `'"Nay!"\n'` existe en `es.json` traducida y revisada («¡No!»\n) — era la
huérfana del censo. **Sigue sin usarse**, y no por culpa de la cadena: `Game.board()` emite
`text: res.message` **sin pasar por `t()`**, igual que el resto de mensajes de transporte
(`board`, `exitTransport`, `yell`…). O sea que la familia entera de mensajes de transporte
está fuera de la capa de idioma. Es un hueco de i18n con alcance propio; retiré del corpus
la clave FABRICADA (`Nay!` pelada, que sí estaba en `approved-strings` y en `es.json`) y
dejé la fiel, pero cablear `t()` en toda la familia no es de este carril.

## 6. Barrido hermano (pedido en la tarjeta): 5 candidatos, SIN arreglar

Instrumento: AST sobre `game/src` y `game/tests` — firmas con parámetro por defecto, y
para cada nombre el máximo de argumentos que le pasa un call-site de producción frente a
uno de test. **106 firmas con default; 5 en las que producción nunca llega al parámetro y
un test sí.**

| fichero:línea | función | parámetro | veredicto mío |
|---|---|---|---|
| `core/shops/shops.ts:693` | `buyWine` | `keepDrinking = true` | ★ **mismo género**: es un flag de CONDUCTA (seguir bebiendo) que producción nunca varía. Candidato real |
| `core/world/loops/spawn.ts:104` | `pickSpawnCoords` | `maxTries = PICK_COORDS_GUARD` | benigno: cota de guarda, perilla de test por diseño |
| `skin/fiel/skin.ts:247` | `setAspectStretch` | 2º arg | benigno probable (presentación) |
| `skin/fiel/speaker.ts:675` | `setSpeakerEnabled` | 2º arg | benigno probable |
| `ui/viewport-fit.ts:19` | `keyboardClearance` | 5º arg | benigno probable |

⚠ **Límite del instrumento, declarado**: casa por NOMBRE, no por símbolo resuelto, así que
dos funciones homónimas se mezclan y un método muy común puede dar falso negativo. Sirve
para CRIBAR, no para dictaminar. El único que yo llevaría a tarjeta es `buyWine`.

## 7. Gates

| gate | resultado |
|---|---|
| `npx vitest run` (suite entera de game/) | **EXIT 0** — 283 ficheros, 3627 pasan, 1 skip |
| `npx tsc --noEmit` | **EXIT 0** |
| `pytest re/tools/test_frontier.py test_seed_gate.py -q` | ver parte |
| `seed_diff` de esta acta | ver parte |

## 8. Predicciones falsables

1. Si alguien arregla (A) y (B), los tests de `board-nay.test.ts` seguirán verdes SIN
   tocarlos: sellan el cableado, que no cambia.
2. Mientras (B) siga en pie, ningún e2e podrá producir el «"Nay!"» por teclado. Si alguien
   afirma haberlo visto en pantalla, o arregló (B) o está mirando el caballo del establo.
3. `buyWine` con `keepDrinking = false` no lo alcanza hoy ninguna tecla; si al cablearlo
   aparece un prompt del original que el port no tiene, es el mismo sapo otra vez.
