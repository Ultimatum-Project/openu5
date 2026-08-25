# ACTA #174 (banda PEGAJOSA) — TANDA 7: `BACKEDGE` CERRADA 12/12

> Rama `re/pegajosa-backedge`, worktree `.claude/worktrees/pegajosa-backedge`,
> base **main `e24b53f5`**. Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Continúa `pegajosa-96-acta.md` §16 (tandas 4-6, ya en main).

---

## 0. VEREDICTO, primero

`BACKEDGE` × FORZADA+LIMPIA, **12 pares**, **CERRADA 12/12**: **11 (a) · 1 (d)**.
**Cero defectos del port**, y cero correcciones de prosa.

> ⚠ **CORRECCIÓN DEL LEAD (29-07, post-aterrizaje).** El «cero defectos» de arriba está
> **SUPERADO**: una segunda lectura independiente de la MISMA celda (acta hermana
> `backedge-174-acta.md`, cerrada en paralelo por colisión de carriles) encontró **UN
> defecto (c) del port** que esta lectura no alcanzó — el relleno de la cuenta de reagentes
> de Mix. La fila de `CMDS.OVL:0x1932` (§ tabla) llega hasta los dos `putchar` y se detiene
> antes del TERCER argumento de la llamada al impresor; ahí vive el defecto, con control
> positivo de 63 call-sites. Señas completas y relevo en la **tarjeta #200**. La hermana
> además cierra los dos «no verificado» de esta acta (`BLCKTHRN.OVL:0x091f` — nombre de
> fichero — y `SHOPPES.OVL:0x0478` — eco dentro de la cadena) y esta acta aporta la
> negativa por adyacencia de `0x6e80`, que la hermana no tiene: son COMPLEMENTARIAS, ninguna
> sustituye a la otra. El resto de este documento queda como está.

★★ **El (d) es el hallazgo, y es la marca de fabricación MÁS NÍTIDA de toda la cola** (§2):
`EGA.DRV:0x0aa6` no existe como cita — el autor escribió **`kernel 0x0aa6`**, y ese `0x0aa6`
es de `ULTIMA.EXE`, verificado al byte. **El autor SÍ marcó el destino, con una palabra, y el
instrumento la tiró.** Es distinto de #188 (prefijo `DS`), de #190 (corchete) y de la familia
valor-de-tabla: aquí no falta señal, **la señal está y se descarta**.

## 1. RE-ANCLA: reproduce, y la condición se comprueba

Carril nuevo (el anterior se retiró con sus 3 tandas ya en main). Población **338 @ `e24b53f5`**,
con los 3 controles verdes y la tabla idéntica a la de la tanda 4
(FORZADA 19 · LIMPIA 129 · LEJANA 70 · AMBIGUA 120).

La regla es re-anclar **si un aterrizaje tocó `game/src`**. Medido:
`git diff a3efe440..main -- game/src` sale **vacío** ⇒ el corpus no se movió desde mi tanda 4,
y en efecto la partición reproduce. Se comprueba **y** se declara, que son dos cosas.

## 2. ★★ `EGA.DRV:0x0aa6` — (d): la palabra «kernel» es un selector de overlay, y se tira

La cita (`frame.ts:6`) es una tabla de primitivas, y las **cuatro** llevan la misma etiqueta:

```
 *   fill_rect(x0,y0,x1,y1)  kernel 0x0aa6  (x0=[bp+0xa]..y1=[bp+4])
 *   line(x0,y0,x1,y1)       kernel 0x0b10  (mismo orden)
 *   point(x,y)              kernel 0x0f90
 *   glyph(code)@cursor      kernel 0x16ba
```

**Qué hay en cada `0x0aa6`, leídos los dos:**

```
ULTIMA.EXE:0x0aa6            ← lo que el autor cita
  0aa6: push bp / mov bp,sp
  0aac: mov ax,[bp+0xa]      ] los CUATRO argumentos, en el orden exacto
  0aaf: mov bx,[bp+8]        ] que la cita declara: [bp+0xa] .. [bp+4]
  0ab2: mov cx,[bp+6]        ]
  0ab5: mov dx,[bp+4]        ]
  0ab8: call 0x8e6
  0aca: ret 8                ← 4 argumentos palabra ⇒ cuadra

EGA.DRV:0x0aa6               ← donde el instrumento la colgó
  0aa6: mov al,4 / mov dx,0x3ce / out dx,al   ← Graphics Controller, índice 4
  0ab0: mov al, es:[bx]                        ← LEE plano de vídeo
  0abe: dec ah / jge 0xaa6                     ← bucle de 4 planos
  0ac0: and cx,0xf                             ← devuelve índice EGA de 4 bits
```

`ULTIMA.EXE:0x0aa6` **es** una rutina de 4 argumentos con el prólogo, el orden y el `ret 8`
que la cita describe. `EGA.DRV:0x0aa6` es un **lector de píxel** (Read Map Select), que no
tiene ni el prólogo ni los argumentos. La cita es **correcta como su autor la escribió**; lo
fabricado es el par.

★ **Por qué esta marca es la más nítida de las cuatro.** Las anteriores fallaban por falta de
señal o por señal ambigua:

| familia | qué marcaba el autor | por qué se escapó |
|---|---|---|
| #188 `DS` | el SEGMENTO | el regex lo tiraba (fuera del grupo) — **arreglado** |
| #190 corchete | nada fiable | notación compartida con arrays de TS — **refutada** |
| valor-de-tabla (tanda 4) | nada | es el CONTENIDO de una tabla, no hay marca posible |
| **`kernel` (aquí)** | **el OVERLAY** | **la palabra está, y se descarta** |

⇒ **Propuesta con control positivo incluido** (no se aplica aquí: criterio nuevo, su propio
control, y mueve población — el trato de #188/#190): que el extractor honre el token `kernel`
delante de un offset como selector de overlay hacia `ULTIMA.EXE`, igual que honra `DS` como
selector de segmento. Este par es su control positivo, con la corroboración fuerte de que los
**cuatro argumentos** cuadran en el destino correcto y **ninguno** en el fabricado.

⚠ **PREDICCIÓN FALSABLE, anotada y NO comprobada**: el mismo docblock cita otras tres
primitivas con la misma etiqueta (`0x0b10`, `0x0f90`, `0x16ba`). Si alguna cae en la banda,
debería estar fabricada por el mismo mecanismo. **No lo he medido** — se deja pre-registrado
para quien aplique el criterio, que es cuando el dato vale.

## 3. Los 11 (a)

Ocho **exactas** (cada afirmación cuadra al byte) y tres **en sus límites** (todo lo que
afirman es cierto; lo que no verifiqué va nombrado).

| par | qué se verificó |
|---|---|
| `CMDS.OVL:0x1932` | LF en la cabeza del bucle, ESPACIO en 0x1939 — los dos `putchar` en su offset |
| `SHOPPES2.OVL:0x0030` | `cmp [si],0x44` = `'D'`, salto por `je`, stride 0x20 — la frase entera |
| `SJOG.OVL:0x1706` | `mov [g_sceptre],0xff` — CETRO, y «fijando el flag» es literal |
| `SJOG.OVL:0x1712` | `mov [g_amulet_lb],0xff` — AMULETO; el despacho por 0xb6/0xb7 los separa |
| `ULTIMA.EXE:0x4912` | «bucle 0x4912-0x492b DESCENDENTE»: `dec`+`jne`, de 15 a 0 |
| `ULTIMA.EXE:0x6e80` | ver §3.1 — la negativa se prueba por adyacencia |
| `ZSTATS.OVL:0x0b12` | `'1'`-`'6'` = 0x31-0x36, y el «acotado a la party» es un `cmp` real |
| `TOWN.OVL:0x017c` | 32×32, tile 0x87, toggle por `xor 0xdd`, sin salida anticipada |
| `BLCKTHRN.OVL:0x091f` | el offset ES la carga; **no verificado**: el nombre del fichero |
| `CMDS.OVL:0x19ee` | la COL 3 se empuja en 0x1a02, exacto |
| `SHOPPES.OVL:0x0478` | imprime y re-lista; **no verificado**: que la cadena lleve el eco dentro |

### 3.1 ★ `ULTIMA.EXE:0x6e80` — una negativa demostrada por ADYACENCIA

La cita es *«sin retorno al inventario»*, que es una **afirmación de ausencia** — el género que
normalmente exige un barrido. Aquí no hace falta, porque la estructura la prueba sola:

```
6e80: mov byte ptr [si], 0xff   ; limpia la ranura
6e83: jmp 0x6f0e                ; y SALE, sin una sola instrucción en medio
```

Entre la escritura y la salida no cabe nada: **cero instrucciones**. Y las tres ranuras
(`+0x55c2`, `+0x55c3`, `+0x55c4`) convergen las tres, por sus tres `je`, en ese mismo
`0x6e80`, así que la ausencia vale para las tres a la vez. Es el caso barato de
`ausencia-no-se-prueba-con-head`: cuando el hueco entre la acción y el `jmp` es vacío, la
adyacencia **es** el barrido.

### 3.2 Las tres «en sus límites», con lo no verificado dicho

- `BLCKTHRN.OVL:0x091f` — el offset es exactamente la llamada de carga, y el par tiene además
  un **bucle de REINTENTO** (`or ax,ax / je 0x91f`: si la carga devuelve 0, vuelve a
  intentarlo) que la cita no menciona. No es un error —la cita sólo fija dónde se carga— pero
  el reintento queda **nombrado y sin adjudicar**. Que el fichero sea `BRIT.DAT` no se
  verifica aquí: haría falta decodificar el puntero, y no lo he hecho.
- `SHOPPES.OVL:0x0478` — imprime una cadena y salta a la cabeza de la lista, así que
  «re-lista», con 0x478 como cabeza de esa vía, es exacto. Que el eco `d` vaya **dentro** del registro depende del
  contenido de la cadena, que **no he decodificado**.
- `CMDS.OVL:0x19ee` — la columna 3 se empuja en `0x1a02`, exacto. La forma
  `"0xfd [0xf|espacio] 0xfd"` no se ha careado glifo a glifo.

## 4. Cola tras la tanda 7

| | pares |
|---|---|
| VIVOS al cerrar la tanda 6 | 70 |
| cerrados aquí | **12** |
| **VIVOS** | **58** |

Queda **`DIVERGE` 58** — una sola celda, la más grande y la de lectura más larga, que es
exactamente lo que el orden de ataque reserva para el final. Los **189** LEJANA+AMBIGUA
siguen fuera: atribución primero.

**Balance acumulado de los cuatro carriles de esta cola (tandas 4-7): 37 pares adjudicados —
31 (a) · 4 (b) corregidas · 2 (d). Defectos de MECÁNICA del port: CERO.**

## 5. Lo que esta tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Ni un arreglo: los 12 estaban bien.
- **No ha aplicado el criterio `kernel`** de §2, ni ha medido sus otros tres candidatos. Va a
  tarjeta con su control positivo y su predicción pre-registrada.
- **No ha decodificado ninguna cadena** (los dos «no verificado» de §3.2).
- **No ha adjudicado el bucle de reintento** de `BLCKTHRN.OVL:0x091f`.
- **No ha verificado la CONDICIÓN** de ningún (a) (#144): se adjudica que la cita describe el
  tramo, no que el port lo modele bajo la condición correcta.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes; 338 pares)
python3 re/tools/cita_pegajosa_forma.py --clase2    EXIT=0
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0
python3 re/tools/cita_hermana_emitida.py            EXIT=0
python3 re/tools/cita_clase4_efecto.py              EXIT=0
python3 re/tools/verify_pool174_claims.py           EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py    EXIT=0
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py         EXIT=0
python3 -m pytest re/tools/test_genero.py           EXIT=0
python3 re/tools/genero.py                          EXIT=0
```

`game/src` no se ha tocado ⇒ no aplican tsc ni vitest. Nada de e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (oráculo
EN VIVO); los test-files por nombre.

---

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. `re/notes/` no es corpus del extractor (medido en
`pegajosa-103-acta` §0.2), así que es disciplina, no necesidad.

Overlays nombrados: `BLCKTHRN.OVL`, `CMDS.OVL`, `EGA.DRV`, `SHOPPES.OVL`, `SHOPPES2.OVL`,
`SJOG.OVL`, `TOWN.OVL`, `ULTIMA.EXE`, `ZSTATS.OVL`.
