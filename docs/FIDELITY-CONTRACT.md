# Contrato de Fidelidad del PORT — OpenU5 / Ultima V (DOS 1988)

> Decisiones del usuario 2026-07-13 (a partir del análisis estratégico
> `docs/superpowers/specs/2026-07-13-estrategia-port-repensada.md`). Este documento
> hace DECIDIBLE el "100% fiel": toda decisión de borde se resuelve contra este
> contrato, no ad hoc. Cambiarlo requiere decisión explícita del usuario.

## Política bug-for-bug (regla base)

> **ENMENDADA el 2026-08-05 por decisión explícita del usuario.** La regla base anterior
> era «todo bug OBSERVABLE del original se PORTA tal cual», con tres excepciones. El
> usuario decidió que **los bugs CLAROS del original se arreglan y se registran**, como
> parte de lo que se publica. El texto de abajo sustituye a aquella regla. El registro
> canónico de bugs vive en [`bugs-del-original.md`](bugs-del-original.md), y toda entrada
> de este contrato que hable de un bug del original debe tener su fila allí.

El criterio de corte **NO es la gravedad del bug**. Es este, y en este orden:

**REGLA 1 — Lo que toca el stream de RNG se CALCA, siempre.** Sin excepción mientras el
espejo de verificación siga vivo: la comprobación de este port se apoya en reproducir la
secuencia de aleatorios del original, y arreglar un bug que mueve el stream rompe el
instrumento con el que se verifica todo lo demás. Ejemplos vinculantes: el bono nocturno
de spawn en rama muerta (`MAINOUT.OVL:0x0D8C`), la no-uniformidad de `rand30`
(`ULTIMA.EXE:0x3abe`), la puerta de posesión que mira siempre la ranura 4
(`TOWN.OVL:0x111f`), In Bet Xen invocando en una sola casilla (`CAST.OVL:0x07b4`), el
underflow de flechas (dec sobre 0 → 255), el wrap toroidal de bordes y la "tirada DEX
consumida por muertos". Se DECLARAN en el registro; no se arreglan.
Las conmutaciones «modo arreglado» quedan como posibilidad FUTURA post-espejo, no se
implementan ahora.

**REGLA 2 — Los bugs claros que NO tocan el stream se ARREGLAN y se registran.** «Claro»
exige descuido demostrable —rama muerta, hueco donde va un dato, promesa sin efecto,
aritmética rota— y, cuando exista, el argumento de simetría: la rutina hermana que sí
trata bien el mismo caso. En duda, se calca y se anota la duda.

**REGLA 3 — Las erratas de imprenta se CONSERVAN.** Una comilla sin cerrar o un `crytal`
mal escrito son parte del original que se preserva; cerrarlas es reescribir a los autores.
La frontera es el tipo de hueco: **falta un DATO** (el número de la cuenta de la taberna,
el importe de una donación) ⇒ se arregla; **falta puntuación o sobra una letra** ⇒ se
conserva.

**Siguen valiendo como arreglo automático, sin discusión** (eran las tres excepciones del
contrato anterior y la Regla 2 las absorbe): el bug corrompe el save · el bug cuelga el
juego (deadlock/crash) · es artefacto de hardware/timing de 1988 sin equivalente
(parpadeo EGA, cadencias de CPU, temporización de audio).

**Los desbordamientos fuera de régimen NO son bugs a efectos de este contrato.** Una
fórmula que se comporta de forma absurda sólo con valores que el juego no puede producir
(atributos > 30, oro > 9999) no es un bug del original: es una partida editada. Se
documenta con su régimen declarado y se calca.

## Capas y criterios de aceptación

| Capa | Qué | Criterio de aceptación | Bug-for-bug | Estado 2026-07-13 |
|---|---|---|---|---|
| **L0 Lógica/RNG** | stream seed-exacto, orden del turno | cita A (asm) **+ ≥1 ancla runtime DOSBox por subsistema** (la paridad modelo↔clon NO cuenta como ancla independiente — es guardia de regresión) | **SÍ** | 6/~13 subsistemas con runtime |
| **L1 Datos/valores** | constantes, tablas, coords | cita A a DATA.OVL o B-runtime | N/A | fuerte |
| **L2 Texto** | strings verbatim | byte-exacto de DATA.OVL | N/A | ~55 [C] por transcribir |
| **L3 Presentación/UI** | layout EGA, chrome, fuente, animaciones, luz | calcado del original (etapa 1 de F5; pixel-exacto como opción); autoridad asm/datos > capturas | no aplica | UI fiel BASE adelantada (decisión 2026-07-13) |
| **L4 Timing** | tick 18.2Hz, lectura asíncrona de teclado, turnos por inactividad | **FUERA DE LA BASE** (declarado): el port asume la discretización 1 acción = 1 paso. Las CADENCIAS visuales (18Hz llamas, ~1.6s flicker de luz) se replican como look, no como reloj byte-exacto | no | decidido |
| **L5 Sonido** | SFX PC speaker + música | set de SFX derivado del driver 0x2192 + tablas por BP (task #11); música = QoL declarado con "modo 1988" | no | task #11 |
| **L6 Input** | teclas y prompts | las teclas del original mandan (decisión #48); copy "<Cmd>-" fiel (F1.8) | N/A | resuelto/en curso |

## Rúbrica de evidencia (enmienda F1.13 + estrategia)

- **A** = asm citado línea a línea.
- **B-runtime** = verificado contra DOSBox (ancla EXTERNA).
- **B-interno** = paridad modelo↔clon (NO independiente — 11 verde-falsos históricos;
  vale como regresión, jamás como cierre de una Clase C).
- **C** = inferencia; **D** = solo-referencia (Redux/walkthrough/memoria).
- "Resuelta por diseño" está prohibido. La contra-evidencia conductual (usuario
  jugando, vídeo, DOSBox) re-abre veredictos sin discusión.

## Criterio de "PORT 100% COMPLETO"

1. Inventario inverso (re/inverse-coverage.md) 100% en [D]/[V]/[Q] — 0 [C] de lógica.
2. Catálogo: Clase B vacía; C medida o degradada a D consciente; E vacía.
3. Grand Tour purista verde con manifiesto 100% **y checkpoint-diff DOSBox por capítulo**.
4. Contrato L0-L2 cumplido; L3 etapa 1 calcada; L5 set derivado.
5. Soak sin anomalías reales.
