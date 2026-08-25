# Autopsia del binario de Ultima V — arquitectura del motor

> Qué es esto: el mapa del motor de Ultima V (Origin/EA, DOS, 1988) tal y como se ve
> desde dentro del ejecutable — qué subsistema vive en cada overlay, y por qué el código
> resultó legible. Extraído de `ULTIMA.EXE`, los **23** overlays de código y los strings de
> `DATA.OVL`, con capstone (desensamblado 8086 en modo real). Ficheros `*.OVL` hay **24**:
> los 23 de código **más `DATA.OVL`**, que es datos y no se desensambla.
>
> Qué **no** es: una lista de lo que falta por portar. Lo fue hasta el 2026-08-05 — ver
> la nota histórica al final.

## 1. Arquitectura del motor (mapa de overlays)

El juego carga código bajo demanda desde overlays. Los nombres revelan la arquitectura:

| Overlay | Tamaño | Subsistema |
|---|---|---|
| ULTIMA.EXE | 36 KB | kernel + bucle principal + estado global (vars en 0x58xx) |
| DATA.OVL | 48 KB | **tablas + TODOS los strings del motor** (2117 legibles) |
| CMDS.OVL | 7.4 KB | comandos del jugador (mover, get, open, jimmy, push…) |
| COMBAT.OVL / COMSUBS.OVL | 7.4+5.2 KB | combate táctico |
| DUNGEON.OVL / DNGLOOK.OVL | 8+5 KB | motor y render de mazmorra 3D |
| TOWN.OVL | 6.2 KB | lógica de pueblos |
| NPC.OVL | 4.9 KB | IA y horarios de NPC |
| TALK.OVL | 4.9 KB | motor de conversación |
| SHOPPES.OVL ×3 | 11 KB | tiendas (los 8 tipos) |
| CAST.OVL / CAST2.OVL | 13 KB | lanzar hechizos |
| INTRO.OVL | 8.4 KB | **intro + creación de personaje (la gitana)** |
| ENDGAME.OVL | 2.8 KB | secuencia final |
| BLCKTHRN.OVL | 3.2 KB | **Blackthorn / cárcel** |
| ZSTATS / LOOKOBJ / MAINOUT / OUTSUBS / SJOG / FONT / FLAMES | — | stats, mirar objetos, render, fuente, llamas |

Tamaños y recuento **re-verificados contra los ficheros reales**: los **24 ficheros
`.OVL`** están —23 de código y `DATA.OVL`—, y cada cifra coincide con su fichero
(CAST+CAST2 suman 12,8 KB → «13»; SHOPPES×3 suman 11,0 KB). Las dos cifras se re-derivan
en una orden cada una: `ls *.OVL | wc -l` da **24**, y el número de overlays realmente
desensamblados es el de ficheros `.asm` de overlay, **23** — `DATA.OVL` no tiene, porque
no es código. *(Re-medidas el 2026-08-06; el «24 overlays de código» que decía la cabecera
contaba `DATA.OVL` dos veces, como código y como fuente de strings a la vez.)*

**Prueba de que la lógica es legible**: CMDS.OVL desensambla a 2946 instrucciones 8086
limpias, con prólogos de función C (`push bp; mov bp,sp; sub sp,N`) e indexado de tablas
verificable (p.ej. `shl si,6` ×64 + `shl ax,3` ×8 → acceso a un array `[8][8][…]`).

Esa legibilidad es la premisa de todo el proyecto: las reglas del juego **se re-derivan
del binario**, no se adivinan del comportamiento.

## 2. Dónde mirar el estado real del port

Este documento **no** lleva la cuenta de qué está portado — se quedaba rancio en semanas
y llegó a publicar lo contrario de la verdad. Las fuentes que sí se mantienen:

| Pregunta | Fuente |
|---|---|
| ¿Qué criterio decide si algo se calca o se arregla? | [`FIDELITY-CONTRACT.md`](FIDELITY-CONTRACT.md) |
| ¿Qué se apartó del original a propósito, y por qué? | `re/deliberate-divergences.md` |
| ¿Qué defectos tiene el original y qué hacemos con cada uno? | [`bugs-del-original.md`](bugs-del-original.md) |
| ¿Cuánto del binario está cubierto por derivación? | `re/COVERAGE.md` |
| ¿Cómo se verifica la fidelidad de una regla? | [`methodology.md`](methodology.md) |

## 3. Cómo se re-deriva una regla del binario

- **Texto**: está en `DATA.OVL` y se parsea entero; cada string se mapea a su mecánica.
- **Lógica exacta** (probabilidades, umbrales, orden de las tiradas): se desensambla el
  overlay correspondiente y se lee instrucción a instrucción.
- **Comprobación**: se contrasta contra el `ULTIMA.EXE` real corriendo bajo DOSBox — es
  el «oráculo», la única fuente que no es una lectura nuestra.

Cada afirmación del proyecto viaja con el grado de evidencia que la sostiene (leída del
desensamblado, deducida, o vista ocurrir); el criterio está en
[`bugs-del-original.md`](bugs-del-original.md).

---

## Nota histórica — por qué este documento cambió de propósito

Hasta el 2026-08-05 este fichero era, en su mayor parte, una lista de «mecánicas que nos
FALTAN», escrita al principio del proyecto a partir de los strings del binario: transporte,
santuarios, pozo de deseos, guardias y cárcel, jimmy, push, yell, búsqueda con etiquetas,
hambre, rotura de armas, campos, creación de personaje con la gitana.

**Una auditoría del 2026-08-05 comprobó las 17 categorías contra el árbol: las 17 tienen
implementación.** La lista había pasado de estar incompleta a estar invertida — y como
este documento sí viaja al repo público, cada re-ensamblado publicaba que faltaban cosas
que llevaban meses hechas. Por eso se sustituyó esa parte por los punteros de arriba, en
vez de intentar mantenerla al día.

**Alcance declarado de aquella auditoría**, para que nadie la lea de más: comprobó la
**presencia** de código cuyo sujeto es cada mecánica. No auditó su fidelidad. «Existe» no
es «portado y verificado»; quién responde de eso son las fuentes de la §2.
