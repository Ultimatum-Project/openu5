# `pcspeaker_glide` — la firma careada contra los TREINTA Y UN call-sites (#83, 2026-08-09)

> Ficha #83. Su enunciado decía: «no es una ficha de nombres, es una ficha de FIRMA (dos
> lecturas del cuerpo con el orden de argumentos INVERTIDO) con un nombre encima».
>
> **La contradicción de firma ya estaba resuelta** por la tercera cita de la fila
> (`nombre-43ae-readjudicado`, 2026-08-06): las dos listas son inversas entre sí porque una
> está en ORDEN DE PUSH y la otra por OFFSET DE MARCO, el primer push aterriza en el offset
> más alto, y ninguna de las dos está mal. Lo que quedaba vivo del encargo era el resto:
> **acreditar la firma con TODAS las llamadas, no con las dos o tres de las citas** — que es
> literalmente la lección de #92 («quien lo nombró leyó la última llamada y no las tres
> primeras»). Eso es lo que hace esta nota.

## 0-bis. LA «CONTRADICCIÓN DE FIRMA» NO ES UNA CONTRADICCIÓN — son dos CONVENCIONES

Añadido tras el re-encargo del lead, que nombra las dos fuentes enfrentadas. **Abrí la que no
había abierto** (`audio-diff-calibration.md:21`) antes de contestar, que es justo la regla que
la propia ficha acuñó. Resultado: **las dos lecturas son CORRECTAS y describen el MISMO marco.**

|   | tupla que publica | convención que usa | ¿correcta? |
|---|---|---|---|
| `audio-diff-calibration.md:21` | `(start, end, step, total)` | **ORDEN DE PUSH** | **sí** |
| `frontera-infer-acta` (ledger) | `(total, step, end, start)` | **OFFSET DE MARCO ascendente** | **sí** |

Son reversas la una de la otra **porque las convenciones son reversas**: el primer `push`
aterriza en el offset MÁS ALTO. No hay polaridad invertida y **no es la familia de #76** — allí
un mismo eje se leía al revés; aquí hay dos ejes distintos, cada uno leído bien.

**Comprobación empírica, independiente de las dos notas** (§2): el call-site que las dos citan,
`CAST.OVL` en 0x029a, empuja **en este orden 1200, 2000, 1, 40**. Eso es `(start, end, step,
total)` leído como push — la tupla de `audio-diff` — y es `40` en `[bp+4]` = total leído como
marco — la tupla del acta. Las dos cuadran con los mismos bytes.

🔴 **EL DEFECTO REAL, y es más pequeño y de otra clase: ninguna de las dos declara su
convención.** Quien lea una tupla bajo la convención de la otra sí invierte `start`↔`total` y
`end`↔`step`, que es el daño que el encargo teme. La tercera cita de la fila
(`nombre-43ae-readjudicado`, 06-08) ya declara las dos explícitamente; lo que falta es que cada
fuente diga la suya.

🔴 **Y hay un segundo hallazgo dentro de la misma línea: `audio-diff-calibration.md:21` MEZCLA
las dos convenciones EN UNA SOLA FILA.** Su lista de argumentos de glide va en orden de push,
pero la llamada al retardo que cita en la misma celda, `delay(step,1)`, va en orden de marco.
Derivado del cuerpo del retardo (`ULTIMA.EXE` 0x20c8), que es el árbitro:

```
20d1: mov bx, word ptr [bp + 6]        ; [bp+6] INDEXA la tabla de desplazamiento…
20d4: mov cx, word ptr [bx + 0x5426]   ; …(es el «1» de shiftTbl[1]=0 que la nota cita)
20dc: mov cx, word ptr [bp + 4]        ; [bp+4] es la CUENTA del bucle externo
```

y el sitio de llamada dentro de glide empuja `1` **primero** y el paso **después** (0x43dc-0x43e3),
así que `1` cae en `[bp+6]` y el paso en `[bp+4]`. ⇒ en push sería `(1, step)`; la nota escribe
`(step, 1)`, que es el marco. Las dos celdas de la fila, cada una en un sistema distinto.
Misma forma en la fila de `beep`, que escribe `delay(dur,1)`.

**CONSECUENCIA PARA EL ENCARGO: no hay lectura perdedora que congelar, así que no hay nada que
propagar ni que retractar por firma.** El nombre no cae: no dependía de elegir entre dos
lecturas, porque las dos dicen lo mismo. Lo que procede es que las dos fuentes declaren su
convención al lado de la tupla — y eso NO lo hago aquí: `audio-diff-calibration.md` es corpus de
otro carril y editarlo re-siembra nombres. Queda propuesto, no ejecutado.

## 0. TITULAR

**31 de 31 call-sites usan la MISMA firma. Cero contradicciones.** El nombre vigente aguanta.

Y de la lectura completa sale un hallazgo que no estaba en la ficha: **el barrido no alcanza
su frecuencia nominal en NINGUNO de los 30 sitios de argumentos estáticos** — se queda corto
siempre, y hasta 205 Hz en el peor. El clon sí la alcanza. Es divergencia de port medida, y
**no toca RNG** (sonido puro, sin ventana de sellos).

## 1. El cuerpo, releído (`re/disasm/ULTIMA.EXE.asm`, span 0x43ae-0x43ff)

`ret 8` ⇒ cuatro argumentos. Las cuatro ranuras, con la instrucción que las usa:

| ranura | papel | dónde se ve |
|---|---|---|
| `[bp+4]` | **total** (cota del bucle) | `cmp di, word ptr [bp + 4]` en 0x43ec · `idiv cx` con `cx` cargado en 0x43c8 |
| `[bp+6]` | **paso** | incremento de `di` en 0x43e9 · 2º argumento del retardo en 0x43e0 |
| `[bp+8]` | **fin** (nominal) | `sub ax, word ptr [bp + 0xa]` en 0x43bf ⇒ `fin − inicio` |
| `[bp+0xa]` | **inicio** | `mov si, word ptr [bp + 0xa]` (en `ULTIMA.EXE` 0x43d1) — carga el tono inicial |

Núcleo: `incremento = ((fin − inicio) · paso) / total`, con `idiv` (trunca hacia CERO), y
bucle `mientras di < total { tono(si); retardo(1, paso); si += incremento; di += paso }`.

🔴 **`fin` NO se compara nunca.** Sólo entra en el cálculo del incremento. El barrido termina
donde lo deje la aritmética, no donde diga `fin` — de ahí el §3.

## 2. La firma sobre TODOS los call-sites

Censo con `dispatch_table.near_calls_to_kernel` (30 en overlays + 1 intra-kernel en 0x6a3c) =
**31**, que reproduce el cardinal que ya declaraba la cita de `frontera-infer-acta` (control
del instrumento: dos corridas independientes, mismo número). De los 31:

- **30 con los cuatro argumentos literales** (patrón `mov ax, imm` / `push ax` intercalado).
  Los cuatro caen SIEMPRE en las mismas ranuras: ningún sitio invierte nada.
- **1 con el total calculado**: en `DUNGEON.OVL` el `call` de 0x1483 empuja 3200 y 3500 como
  inicio y fin, 1 como paso, y el total sale de `neg(([bp+4] << 3) − 0x14)` = `20 − 8·n`.
  ★ Con `n ≥ 3` el total es NEGATIVO y el bucle no ejecuta ni una vuelta: barrido MUDO. No
  hay `n` entero que lo haga cero, así que la división por cero **no es alcanzable** aquí
  (comprobado: `20 − 8n = 0` pide `n = 2,5`) — al contrario que el caso hermano de la ficha
  del generador de aleatorios, donde sí lo era.

**Los valores distintos que se usan en todo el juego son sólo siete**, lo que refuerza que la
firma es única: `1200→2000 (1,40)` ×9 · `800→2000 (1,50)` ×10 · `1300→300 (5,100)` ×3 ·
`1000→200 (5,300)` ×2 · `750→400 (5,150)` ×2 · `400→750 (5,150)` ×1 · `2500→800 (1,300)` ×1 ·
`660→150 (40,7800)` ×2 · `3200→3500 (1, dinámico)` ×1.

## 3. HALLAZGO NUEVO — el barrido nunca llega a su frecuencia nominal

Reproducida la aritmética exacta del cuerpo (truncado hacia cero incluido) sobre los 30
sitios estáticos: **el último tono emitido no coincide con `fin` en ninguno.** Dos causas que
se suman, y conviene no confundirlas:

1. **Estructural (todos los sitios):** el tono se emite al PRINCIPIO de cada vuelta, así que
   el último que suena es el anterior al incremento final. Con división exacta el desvío es
   exactamente `−incremento`: `1200→2000` termina en **1980**, no en 2000.
2. **Truncado (donde la división no es exacta):** el incremento se redondea hacia cero y el
   error se ACUMULA por vuelta. Ahí el desvío se dispara.

Los cuatro peores, con su cuenta:

| call-site | nominal | incremento | vueltas | último tono | desvío |
|---|---|---:|---:|---:|---:|
| `OUTSUBS.OVL` 0x492 | 2500 → 800 | −5 (exacto −5,67) | 300 | **1005** | +205 Hz |
| `MAINOUT.OVL` 0x113b y 0x12a6 | 660 → 150 | −2 (exacto −2,62) | 195 | **272** | +122 Hz |
| `COMSUBS.OVL` 0xacb · `MAINOUT.OVL` 0x11ec/0x13e9 | 1300 → 300 | −50 (exacto) | 20 | **350** | +50 Hz |
| `CMDS.OVL` 0x9d5 y 0xc05 | 1000 → 200 | −13 (exacto −13,33) | 60 | **233** | +33 Hz |

⚠ **Que el desvío exista no lo convierte por sí solo en defecto del original.** En los sitios
de división exacta el desvío es una vuelta de barrido y es inaudible como tal. Los que piden
adjudicación son los dos primeros: `2500→800` sonando en realidad hasta 1005, y `660→150`
hasta 272, son más de una octava de diferencia respecto a lo que el llamador pidió. Se deja
como candidato al registro de defectos del original **sin cerrarlo aquí**: falta decidir si
1988 quería el barrido corto o el nominal, y eso es lectura de intención, no de bytes.

★ Cota comprobada y NO alcanzada: `imul` deja el producto en `dx:ax` pero el cuerpo guarda
sólo `ax` y luego re-deriva `dx` del signo (`cwd`), o sea **descarta la parte alta**. Con
`|fin − inicio| · paso > 32767` el incremento saldría basura. El máximo real del corpus es
`|150 − 660| · 40 = 20400` — cabe. Riesgo latente, cero instancias vivas.

## 4. PORT-CHECK — el clon sí llega, y por eso suena distinto en los 30

`game/src/skin/fiel/speaker.ts:176` implementa el barrido como rampa limpia de `f0` a `f1`:

```ts
export function glide(startFreq: number, endFreq: number, _step: number, total: number): ToneSeg {
  return { kind: "tone", f0: clampHz(startFreq), f1: clampHz(endFreq), ms: … };
}
```

Dos divergencias, las dos medidas:

- **Llega a `endFreq`.** El binario no. En los 30 sitios el tono final difiere, de 20 Hz en
  los benignos a 205 Hz en `OUTSUBS.OVL` 0x492.
- **`_step` se ignora** (guion bajo deliberado). En el binario el paso decide dos cosas: el
  número de vueltas (`total / paso`) y el retardo de cada una. La DURACIÓN total sale bien
  igual (vueltas × retardo ≈ `total`), pero la granularidad no: con `paso = 40` el original
  emite una escalera de 195 escalones gruesos y el clon una rampa continua.

**No mueve RNG** — ni el barrido ni sus tres callees tocan el generador. Es presentación:
divergencia audible, sin ventana de sellos. La decisión de si se calca el barrido corto o se
deja la rampa limpia es del lead; esta nota sólo mide.

## 5. Lo que esta nota NO dice

- No re-abre el nombre: `pcspeaker_glide` queda como estaba, y ahora con las 31 llamadas
  detrás en vez de tres.
- No cierra el desvío como defecto del original: lo deja medido y adjudicable (§3).
- No mide el sitio dinámico de `DUNGEON.OVL` más allá de su forma: el rango real de `n` en
  ese llamador no se ha censado, así que «barrido mudo con `n ≥ 3`» es una propiedad de la
  aritmética, **no** una afirmación de que ocurra en partida.
