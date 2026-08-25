# ACTA #190 — el CORCHETE **no** es una marca de dato: criterio REFUTADO, y los 5 leídos igual

> Rama `re/corchete-190`, worktree `.claude/worktrees/corchete-190`, base **main `f5fce746`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> Ejecuta la tarjeta #190, abierta por `re/notes/segmento-188-acta.md` §7.

---

## 0. VEREDICTO, primero

**El criterio del corchete NO se aplica.** No es que mueva demasiado: es que **no mide lo que
dice medir**. Uno de los 5 candidatos es una cita de CÓDIGO correcta que el filtro habría
borrado en silencio, y el barrido del corpus enseña que `[...]` se usa para cuatro cosas
distintas. El instrumento queda como está.

**Pero los 5 están leídos y adjudicados**, que era el paso 1 de la tarjeta, y eso sí rinde:
**4 pares salen como (d) NO APLICA** con derivación propia, y el 5º queda confirmado como
cita legítima. Cobertura real para la cola de #174 aunque el criterio se caiga.

## 1. RE-ANCLA

Población **328 pares @ `f5fce746`**, idéntica a la de la tarjeta (medida en `a229dee5`).
Los 3 controles del partidor, verdes. Candidatos con TODAS sus líneas productoras en forma de
corchete: **5**, los mismos 5 de la medida original. La cola reproduce.

## 2. LOS 5, LEÍDOS UNO A UNO

Criterio de lectura: no fiarse de la prosa. Para cada offset se busca corroboración
**independiente** — `re/ledger/globals.json` (193 globales catalogadas) o el desensamblado.

| par | veredicto | corroboración |
|---|---|---|
| `ULTIMA.EXE:0x52d2` | **DATO** ⇒ (d) NO APLICA | `g_gfx_clip_x1` en el catálogo, size 2 |
| `ULTIMA.EXE:0x5887` | **DATO** ⇒ (d) NO APLICA | `g_moongate_anim` en el catálogo, size 1 |
| `DUNGEON.OVL:0x13b2` | **DATO** ⇒ (d) NO APLICA | `g_unk_13b2` en el catálogo, size 1 |
| `ULTIMA.EXE:0x5356` | **DATO** ⇒ (d) NO APLICA | NO catalogado; derivado del asm (§2.2) |
| `ENDGAME.OVL:0x08c2` | ★ **CÓDIGO — cita CORRECTA** | §2.1 |

### 2.1 ★ `ENDGAME.OVL:0x08c2` — el FALSO POSITIVO, y es de los que duelen

Cita (`skin/fiel/endgame-scene.ts:17`): *«4. FORK `g_wooden_box` [0x08c2]:»*. El corchete
parece una dereferencia. No lo es:

```
re/ledger/globals.json →  g_wooden_box  addr 22463 = 0x57BF   (NO 0x08c2)

ENDGAME.OVL.asm:
  08b9: cmp word ptr [bp - 2], 0x59     ; ¿respuesta == 'Y'?
  08bd: je 0x8c2
  08bf: jmp 0xa76
  08c2: cmp byte ptr [g_wooden_box], 0  ; ← la cita: CÓDIGO, y el disasm YA resuelve el símbolo
  08c7: jne 0x8cc
```

`0x08c2` es el **offset de código** de la instrucción que consulta la global; la global vive en
`0x57BF`. El autor escribió el corchete como **anotación** («el FORK está en [0x08c2]»), que es
como escribe el resto de su docblock (`[0x0833-0x08b9]`, `[0x06f9, target 5/3]`).

⇒ Aplicar el criterio habría **borrado de la banda una cita correcta**, dejando sin cubrir un
fork real del endgame. Es exactamente el fallo silencioso que #188 arregló en otra puerta.

### 2.2 `ULTIMA.EXE:0x5356` — dato SIN catalogar, derivado a mano

No está en `globals.json`, así que la prosa (`calibrado C=[0x5356]`) no basta. Derivado del
binario: **ocho** accesos como memoria, con escrituras incluidas ⇒ es una variable, no un
destino de salto.

```
1146: mov ax, word ptr [0x5356]      11b4: mov word ptr [0x5356], 0
11e5: inc word ptr [0x5356]          11fc: mov ax, word ptr [0x5356]
120b: mov word ptr [0x5356], ax      1df6: mov ax, word ptr [0x5356]
1dfc: mov word ptr [0x5356], 0x1f4   1e29: mov word ptr [0x5356], ax
```

Confirma además la nota de `speaker.ts`: el reloj de calibración se escribe (`0x1f4` = 500) y
se ajusta en marcha. **Cabo suelto anotado, no resuelto**: `0x5356`, que merece entrada propia
en `globals.json`; no se añade aquí porque este carril no toca el ledger.

## 3. ★ POR QUÉ EL CRITERIO SE CAE: el corchete tiene CUATRO significados

El control de falsos positivos, corrido sobre TODO el pool de citas y no sólo sobre los 5:

```
ocurrencias en forma [0xNNNN] en el pool : 29
   offset EN el catálogo de globales     :  5
   offset FUERA del catálogo             : 24
```

**24 de 29.** Y leyéndolas, el corchete resulta ser notación de propósito general:

| uso | ejemplo |
|---|---|
| dereferencia asm (DATO) | `dec [0x5887]` · `C=[0x5356]` |
| **índice de array en TypeScript** | `gam[0x206]!` · `gam[0x28a + i]!` — offset de FICHERO de save |
| **anotación de CÓDIGO** | `[0x08c2]` · `[0x06f9, target 5/3]` |
| **rango de CÓDIGO** | `[0x0833-0x08b9]` · `[0x0928→0x93d]` |
| dereferencia en CS | `cs:[0x1b23]` |

⇒ **El corchete no marca nada.** Es la diferencia de fondo con `DS`, y estaba anunciada en la
propia tarjeta: `DS` es una **declaración explícita del autor** sobre el segmento; `[...]` es
una **convención tipográfica** que en este repo se usa además para indexar arrays de
TypeScript y para anotar offsets de código. Un filtro construido sobre notación compartida no
puede discriminar, y su tasa de error medida es 1 de 5 en los candidatos (20 %) y 24 de 29 en
las ocurrencias.

## 4. LO QUE SÍ FUNCIONA, medido: corroborar contra el CATÁLOGO, no contra la notación

Lo que separó dato de código en §2 no fue la forma de la cita: fue `globals.json`. Los 3 pares
catalogados salieron dato a la primera; el no catalogado pidió lectura de asm; el falso
positivo se cazó porque **la global estaba en otra dirección**.

**Propuesta para carril propio** (no se aplica aquí — es criterio nuevo y le toca su control):
marcar los pares de la banda cuyo offset coincide con una global catalogada. Sobre los 328,
eso es una señal barata y con productor versionado detrás.

⚠ Y con la lección de #188 punto 4 ya aprendida: **que sea un AVISO, no una reclasificación
automática.** Una global puede coincidir por casualidad con un offset de código legítimo —
`0x13b2` es a la vez `g_unk_13b2` y una instrucción real de `DUNGEON.OVL`, y sólo la lectura
dice cuál quiso el autor. Imprimir el aviso deja al lector decidir; filtrar decide por él.

## 5. Cuentas de la cola de #174, tras esta tanda

Los **4 pares** de §2 se adjudican **(d) NO APLICA** — la cita no es a destino de salto, es a
un offset de dato, y el par lo fabricó el instrumento. Siguen EN la población (el filtro no se
aplica), así que esto es adjudicación, no reducción del denominador:

| | pares |
|---|---|
| población @ `f5fce746` | 328 |
| adjudicados (d) en esta tanda | **4** |
| adjudicado como cita CORRECTA de código | 1 |

Uno de los 4 (`ULTIMA.EXE:0x5887`) ya estaba adjudicado (d) en `pegajosa-103-acta` §1 por la
vía del prefijo `DS`. **Queda confirmado por segunda vía independiente**, que es el único de
los cinco con doble marca. Los otros 3 son adjudicación NUEVA.

## 6. Lo que este carril NO ha hecho

- **No ha tocado `re/tools/`.** El criterio se refuta, no se implementa. Cero cambio de
  población: los 6 consumidores siguen dando lo mismo que en la línea base capturada al
  arrancar (no se diffean porque no hay cambio que diffear — se declara, no se insinúa).
- **No ha tocado `game/src`.** Las 5 citas leídas son correctas COMO ESTÁN: 4 son citas de
  dato bien escritas por sus autores y 1 es una cita de código bien escrita. **No hay nada que
  corregir en el port**; lo que estaba mal era el par que fabricaba el instrumento.
- **No ha tocado `re/ledger/globals.json`**, pese a que a `0x5356`, según §2.2, le falta
  entrada propia. Cabo con dueño allí.
- **No ha aplicado el criterio de §4.** Va a tarjeta con su cifra y su aviso de diseño.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/cita_pegajosa_forma.py             EXIT=0   (3 controles verdes; 328 pares)
python3 re/tools/cita_pegajosa_forma.py --clase2    EXIT=0
python3 re/tools/cita_pegajosa_atribucion.py        EXIT=0
python3 re/tools/cita_hermana_emitida.py            EXIT=0
python3 re/tools/cita_clase4_efecto.py              EXIT=0
python3 re/tools/verify_pool174_claims.py           EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py    EXIT=0   (8/8)
python3 re/tools/seed_gate.py                       EXIT=0
python3 -m pytest re/tools/test_frontier.py         EXIT=0
python3 -m pytest re/tools/test_genero.py           EXIT=0
python3 re/tools/genero.py                          EXIT=0
```

`game/src` y `re/tools` no se han tocado ⇒ no aplican tsc ni vitest. Nada de e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido (oráculo
EN VIVO); los test-files por nombre.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84; `re/notes/` no es corpus del extractor (medido en
`pegajosa-103-acta` §0.2), así que es precaución.

Overlays nombrados: `ULTIMA.EXE`, `DUNGEON.OVL`, `ENDGAME.OVL`, `CAST.OVL`, `COMBAT.OVL`,
`EGA.DRV`.
