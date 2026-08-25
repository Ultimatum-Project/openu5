# ¿QUÉ DISPARA UN TRIGGER DE SALA? — adjudicación (tarea #24, 2026-07-27)

**Pregunta.** El testigo YT (`re/notes/sonda-0xec-testigo-yt.md`) vio el cuartito de cm64
abrirse por un **impacto a distancia** — un proyectil de Magic Axe aterrizando en la casilla
de la lápida (6,5) — ni Push ni pisarla. ¿Modela el port esa vía?

**VEREDICTO: HUECO, con el predicado exacto SIN CERRAR.** El port sólo dispara triggers por
OCUPACIÓN de casilla (4 call-sites, censados abajo); el testigo muestra al original
disparando sin ocupación. Pero **la condición exacta del binario NO se cierra en estático**,
y por eso **no hay fix**: cablear hoy sería inventar el predicado. Probe exacto al final.

---

## 1. El handler: COMBAT.OVL 0x111A — identificado y caracterizado

Es el handler de triggers, y la identificación no depende de la memoria del repo: **es el
ÚNICO consumidor de los campos de trigger** en todo el corpus (§2).

```
1122: [bp-0xe] = 0                       ; contador
1127: test [g_unk_58a1], 0x80  ─┐ GUARDA de contexto: sólo sigue si uno de
112e: test [g_unk_58a1], 2     ─┘ los dos bits está puesto; si no → 0x1202 (salir)
1138: si = 0xae1f   ; X del trigger        ┐
113b: di = 0xae27   ; Y del trigger        │ los 7 punteros del registro,
113e: [bp-0x10] = 0xad1f  ; tile a poner   │ TODOS dentro del bloque de sala
1143/1148: 0xae3f / 0xae47 ; destino A x,y │ cargado en DS:0xAD14 (§2)
114d/1152: 0xae5f / 0xae67 ; destino B x,y ┘
1157: [bp-0xc] = 8 ; dx = 8               ; ← 8 TRIGGERS por sala
115f: cmp [si], [bp+6]   ; ¿X del trigger == arg1?
1168: cmp [di], [bp+4]   ; ¿Y del trigger == arg2?
116f: al=0xff; [di]=al; [si]=al           ; ONE-SHOT: quema X e Y a 0xFF
1175/117d: cmp [destinoA.x],0xb / [destinoA.y],0xb ; jae → saltar (0xB = fuera de la rejilla 11×11)
11a2: mov [bx-0x52ec], al                 ; escribe el TILE en el bloque:
                                          ; -0x52ec ≡ 0xAD14 (mod 0x10000) ⇒ 0xAD14 + (y<<5) + x
11a6-11d7: ídem para el destino B
```

**Firma:** `fire_triggers_at(x, y)` — los dos argumentos son la CASILLA, y la rutina quema
el trigger cuya (x,y) coincide, pintando hasta DOS tiles en otras posiciones. Coincide con
lo que el port implementa en `Combat.fireTriggers` (mismo one-shot 0xFF, mismos dos
destinos, misma guarda de 0xB).

**Lo que la firma NO dice, y es justo la pregunta:** recibe una casilla, sin más. **Quién
decide pasarle esa casilla —y por tanto si el disparador es ocupar, impactar o destruir— es
el LLAMADOR**, y ahí está el problema.

## 2. Dónde vive el dato (para que la identificación no sea por fe)

`dng_enter_room` (DUNGEON.OVL 0x005e-0x007b) carga el bloque de sala de `DUNGEON.CBT`:
`0x160` bytes leídos a **DS:0xAD14** (`mov di,0xad14` · `mov cx,0x160` · borrado con
`repne stosb` · `call` de lectura con el offset calculado en 0x0051). Los 7 punteros de
0x111A caen todos dentro de `[0xAD14, 0xAD14+0x160)`:

| puntero | offset en el bloque | papel |
|---|---|---|
| 0xad1f | 11 | tile a estampar |
| 0xae1f | 267 | X del trigger |
| 0xae27 | 275 | Y del trigger |
| 0xae3f / 0xae47 | 299 / 307 | destino A (x, y) |
| 0xae5f / 0xae67 | 331 / 339 | destino B (x, y) |

**Censo sobre los 28 `.asm`**: `ae1f` y `ae27` aparecen **una sola vez cada uno**, y las dos
en 0x111A. Nadie más toca los campos de trigger.

## 3. ★ EL LLAMADOR NO EXISTE EN EL CORPUS ESTÁTICO (resultado negativo, con controles)

Es el hallazgo que bloquea el fix, así que va con su método y sus controles — un cero sin
control no es prueba de nada.

| vía | método | resultado |
|---|---|---|
| etiquetas impresas | `grep 111a` en los 28 `.asm` | 0 referencias (todo son direcciones homónimas) |
| stub entre overlays | `dispatch_table.stubs()` da **0x7EBA → COMBAT 0x111a**; llamadores = operando `0xFCEA` por el sesgo `(x+0x81D0)&0xFFFF` | **0** |
| llamadas internas | decodificación BYTE A BYTE de los **197** `call rel16` de COMBAT.OVL (destino = addr+3+rel16), sin fiarme de la etiqueta | **0** |
| tabla de saltos | la palabra LE `1a 11` en los bytes reconstruidos de COMBAT.OVL | **0** |

**Controles positivos (sin ellos no firmo ningún cero):**
- El sesgo funciona: operando `0xFA92` → stub `0x7C62` → DNGLOOK 0x0844, y el grep encuentra
  su llamador documentado en `DUNGEON.OVL:00de`. ✅
- El decodificador de calls internas funciona: de sus 37 destinos internos salen justo las
  rutinas del stub-table (0x1574 ×4, 0x1236 ×3, 0x13e2 ×3, 0x14d6 ×2…). ✅

**Censo de los 11 stubs de COMBAT** (externos por sesgo · internos por decodificación):

| stub | rutina | ext | int |     | stub | rutina | ext | int |
|---|---|---|---|---|---|---|---|---|
| 0x7c32 | 0xb94 | **1** | 0 | | 0x7d82 | 0x1236 | 0 | **3** |
| 0x7d22 | 0x14d6 | 0 | **2** | | 0x7e96 | 0x120e | 0 | **1** |
| 0x7d2e | 0x1574 | 0 | **4** | | **0x7eba** | **0x111a** | **0** | **0** |
| 0x7d52 | 0x194a | 0 | **2** | | 0x7ec6 | 0x13e2 | 0 | **3** |
| 0x7d5e | 0x1a5c | 0 | **1** | | 0x7eea | 0x18ba | 0 | **2** |
| 0x7d76 | 0x0 | 0 | **2** | | | | | |

**Las 11 rutinas tienen llamador menos una: la de triggers.** No es cherry-picking — es el
censo entero de la familia, con un control positivo dentro (0xb94, externo=1, que es
exactamente el `call` documentado en `dungeon.md §14.2`).

**Cómo NO leer esto.** «Código muerto» sería la lectura fácil y es casi seguro falsa: el
testigo YT vio la sala abrirse. La lectura honesta es que **la llamada llega por un
mecanismo que este corpus no expone** (candidato principal: el despacho del cargador de
overlays invocando la entrada por SELECTOR, con el número viajando como dato y no como
`call` a una dirección). Eso NO se decide leyendo más .asm: se decide con un breakpoint.

⚠ Y una trampa de método que me comió dos veces en esta misma sesión y dejo escrita: **el
primer barrido lo hice con sólo 5 `.asm` symlinkeados de los 28** y dio ceros idénticos a
los buenos. Lo cazó el control positivo, no el ojo. Ver [[censo-global-hex-y-simbolo]] —
misma familia, variante «corpus incompleto».

## 4. Las vías del PORT: cuatro, y las cuatro son OCUPACIÓN

`Combat.fireTriggers` (`game/src/core/combat/combat.ts:1094`), call-sites censados:

| línea | contexto | disparador |
|---|---|---|
| 1669 | el PJ termina su paso en (nx,ny) | ocupación |
| 3181 | el enemigo termina su paso | ocupación |
| 2488 | In Por / blink del caster (CAST 0x05f3) | ocupación (tras teleporte) |
| 3138 | teleporte de enemigo | ocupación (tras teleporte) |

**No hay ni un call-site en la ruta de proyectiles / ataque a distancia / AoE.** La cabecera
del fichero lo dice sin querer: «mutan la rejilla viva **al pisar** la placa».

## 5. Adjudicación

- **HUECO confirmado**, y confirmado por la vía que no depende del estático: el testigo vio
  al original abrir el cuartito **sin que nadie ocupara la casilla**, y el port sólo dispara
  por ocupación. Existe al menos una ruta que el port no cubre. Esto se sostiene con el
  testigo + el censo del port, sin necesitar el call-site.
- **El PREDICADO exacto queda ABIERTO.** ¿«la casilla recibe un ataque»? ¿«un proyectil
  aterriza»? ¿«el objeto de la casilla es destruido»? Las tres explican el testigo y el
  estático no las separa, porque el llamador no aparece.
- **POR ESO NO HAY FIX.** Cablear «dispara también al impactar» sería elegir uno de los tres
  a ojo y sellarlo con tests — exactamente el defecto que este repo lleva semanas
  documentando. Y los triggers son **one-shot**: un disparo de más quema la placa y cambia
  salas que hoy tienen veredicto sellado.
- **Radio (medido, para cuando haya predicado):** `fireTriggers` lo tocan 4 call-sites y la
  mecánica está bajo los sellos de sala; el trigger es one-shot, así que cualquier vía nueva
  puede alterar salas ya adjudicadas. El fix exige re-correr los capítulos de sala.

## 6. PROBE al lote-D (lo que cierra esto en un breakpoint)

**Objetivo:** ver quién llama a COMBAT 0x111A y con qué casilla.

1. **BP en COMBAT.OVL 0x111A** con el overlay YA cargado (en combate de sala; los overlays no
   están en memoria hasta cargarse). Leer la pila: la **dirección de retorno** ES el
   llamador, que es justo lo que el estático no da.
2. Leer los **args** `[bp+6]`/`[bp+4]` en cada parada y el contexto `g_unk_58a1` (la guarda
   de 0x1127, bits 0x80 / 0x02 — sin derivar qué contexto marca cada uno).
3. **Escenario del testigo**: sala cm64, disparar a distancia a la lápida (6,5) SIN pisarla.
   · si para → el disparador incluye impacto ⇒ leer el retorno y saber si es la ruta de
   proyectil o la de «objeto destruido»;
   · si NO para → el trigger de esa sala se abrió por otra cosa y hay que re-leer el testigo.
4. **Control negativo** en la misma sesión: pisar una placa conocida y confirmar que SÍ para
   (si no para nunca, el BP está mal puesto — no que el juego no dispare).

Este probe ya tiene media entrada en `PENDIENTES-USUARIO.md` («si hay combate: dispara a la
LÁPIDA desde lejos antes de tocarla (pregunta #24)»); lo de arriba es lo que hay que MIRAR
cuando dispare.
