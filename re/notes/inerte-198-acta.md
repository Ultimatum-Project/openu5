# ACTA #198 — el predicado `PREFIJO-inerte`: la tesis CONFIRMADA, y una CUARTA ceguera peor que no estaba declarada

> Carril `liston-d-207` (relevo de `rand-218`, caído dos veces sin empezar).
> Worktree `.claude/worktrees/inerte-198b`, rama **`re/inerte-198b`** (nombre distinto del que
> pedía el encargo; motivo en §1.2), base **main `0e1fd058`**.
> Toda cifra medida en ese árbol. RETENIDA: aterriza el lead.
> ⚠ NO se ha tocado el instrumento: política de #188/#190/#199 aplicada al pie (§6).

---

## 0. VEREDICTO

| | |
|---|---|
| **La tesis de la tarjeta** | **CONFIRMADA** — y no en 1 caso sino en **3 de las 4** ramas del bucket (§3) |
| **El par de mi celda F+L** (`NPC.OVL:0x1321`) | **(a) exacta** — la cita reproduce el listado; y es el **control POSITIVO** de la ceguera (§2) |
| ★★ **Hallazgo NUEVO, no previsto por la tarjeta** | la 4ª rama **ESCRIBE EN MEMORIA** y el predicado no la ve: es ciego al **PREFIJO DE SEGMENTO** (§3.2) |
| **¿Alguna conclusión archivada se apoyó en el predicado ciego?** | **NO, ninguna** — y el motivo es que las actas se NEGARON a auto-adjudicar (§4) |
| **Radio medido** | exactamente **4 ramas de 423**; **cero** escondidas bajo pares de otra forma (§3.1) |

★★ **Lo que la tarjeta pedía buscar es un caso de ceguera a REGISTROS; lo que sale es que el
bucket «no hay nada que modelar» contiene además una escritura a MEMORIA.** Y eso no es una
limitación declarada: es el control (3) del propio instrumento —*«ramas `PREFIJO-inerte` con
call/write/SALIDA: 0»*— **verde con una escritura dentro**, o sea el control fallando en el
trabajo que él mismo dice hacer. Tercera repetición del molde que el fichero documenta en su
propio docblock (*«verde por mirar la variable equivocada»*), y esta vez con la agravante de que
la variable equivocada es **la que el control nombra**.

## 1. RE-ANCLA

```
git log -1 main                → 0e1fd058     (el encargo decía b9121beb; main se movió)
cita_pegajosa_atribucion.py    → 349 pares, 3 controles verdes            EXIT=0
cita_pegajosa_forma.py         → matriz completa, 3 controles verdes      EXIT=0
clase-4                        → 345 pares · 423 ramas
celda PREFIJO-inerte           → 0 FORZADA + 1 LIMPIA + 0 LEJANA + 3 AMBIGUA = 4
```

⇒ **F+L = 1**, que es lo que el encargo anticipaba. La unidad importa y se dice: la **forma** se
asigna **por RAMA**, la **celda** es **por PAR** (la del par es la de mayor prioridad de sus
ramas, y `PREFIJO-inerte` es la ÚLTIMA de la lista de prioridad).

### 1.1 Los 4 pares de la celda, y cuáles están LEÍDOS

| par | atrib | fichero del port | ¿leído antes? |
|---|---|---|---|
| `NPC.OVL:0x1321` | LIMPIA | `core/time.ts:65` | **SÍ** — tanda 6 de #174, «CERRADAS 5/5» |
| ~~`COMBAT.OVL:0x1bbd`~~ | ~~AMBIGUA~~ REFUTADA (⚠ 30-07) | `core/game.ts:1344` | no |
| `EGA.DRV:0x25f8` | AMBIGUA | `core/transition/endgameDissolve.ts:38` | no |
| `ULTIMA.EXE:0x1c7c` | AMBIGUA | `core/shops/shoppe-greetings.ts:348` | no |

⚠ Mi encargo adjudica **el de F+L**. Los otros tres los he **leído igualmente** —la celda tiene
cuatro miembros, leerla entera cuesta minutos y sin ellos el censo del paso 2 no se puede
hacer— pero **su ATRIBUCIÓN sigue sin adjudicar** (los tres son AMBIGUA, otro eje, otra
tarjeta). Lo que aquí se firma de ellos es **la forma de su rama**, no su atribución.

### 1.2 ⚠ Por qué la rama se llama `re/inerte-198b` y no `re/inerte-198`

El comando del encargo **falló**: `re/inerte-198` ya existía, con worktree montado, dejados por
`rand-218`. Comprobado el abandono con **seis** pruebas, no con una:

| comprobación | resultado |
|---|---|
| `git log --oneline main..re/inerte-198` | vacío ⇒ cero commits propios |
| `--is-ancestor` de main | sí ⇒ nada propio dentro |
| `git status --short` (solo lectura) | vacío |
| fichero de nota de la tarjeta en su `re/notes/` | **no existe** |
| mtimes de su `re/notes/` | uniformes al checkout ⇒ nadie escribió |
| ★ **barrido de `cwd` de todos los procesos** (`pgrep` + `lsof -d cwd`) | **cero PIDs ahí** |

Abandonado, entonces. **Y aun así no se adopta**, por la regla que el lead fijó hoy mismo: *un
idle-failed por límite no es muerte permanente, los resets reviven carriles*. Si `rand-218`
vuelve, aterriza en `inerte-198` — que es el accidente de esta misma jornada. Su worktree queda
**intacto**. El coste de la precaución es un sufijo; el de no tomarla, ya se pagó una vez.

## 2. PASO 1 — `NPC.OVL:0x1321`: (a) exacta, y el control POSITIVO de la ceguera

La rutina es el selector de posición de horario, y el tramo entero cabe en una tabla:

| call-site | instrucción | qué es |
|---|---|---|
| `NPC.OVL:0x1308`, | `xor dx, dx` | el índice arranca a 0 |
| `NPC.OVL:0x130a`, | `cmp al, ah` / `jbe 0x1311` | 1ª comparación |
| `NPC.OVL:0x130e`, | `mov al, ah` / `inc dx` | sustituye ⇒ índice 1 |
| `NPC.OVL:0x1311`, | `cmp al, bl` / `jbe 0x131a` | 2ª comparación |
| `NPC.OVL:0x1315`, | `mov al, bl` / `mov dx, 2` | sustituye ⇒ índice 2 |
| `NPC.OVL:0x131a`, | `cmp al, bh` / `jbe 0x1321` | **la guarda del par** |
| `NPC.OVL:0x131e`, | `mov dx, 1` | ★ **LA RAMA HERMANA — «inerte»** |
| `NPC.OVL:0x1321`, | `mov ax, dx` | ★ **el par: `dx` pasa a ser el RETORNO** |
| `NPC.OVL:0x1323`, | `pop ds` / `pop di` / `pop si` / `pop bp` / `ret 4` | y se va |

**(a) exacta.** La cita dice *«Reproduce byte a byte el listado …»* (el rango va en la tabla de arriba, en celda propia) y las cuatro
piezas se comprobaron una a una contra el port: los dos primeros brazos actualizan **candidato Y
índice** (`best = d1; dx = 1` y `best = d2; dx = 2`) y el tercero **sólo el índice**
(`if (best > d3) { dx = 1 }` **sin** tocar `best`) — que es exactamente lo que hace el binario,
porque después de `0x131e` ya no queda nada que comparar y por eso no hay `mov al, bh`. Y la
polaridad: `jbe` mantiene el actual cuando es `<=`, luego sustituye sólo con **estrictamente
menor** ⇒ `best > d3`. Cuatro de cuatro.

★★ **Y AQUÍ ESTÁ EL CONTROL POSITIVO DE LA TARJETA, verificado por mi mano:** la rama que el
predicado llama **inerte** es `mov dx, 1`, y `dx` es **el valor de retorno de la función**, leído
dos bytes después en el offset del propio par. No es que mueva un registro cualquiera: **decide
el resultado**. Y el docblock del port existe para documentar **esa instrucción y ninguna otra**
—dice *«el periodo del 4º tiempo reutiliza la posición índice 1 (quirk 3→1, `0x131e` `mov dx,1`
en vez de 3)»*— y el cuerpo lo implementa con su comentario propio (*«el índice 3 remapea a la
posición 1 (quirk)»*).

⇒ Si el bucket se hubiera auto-adjudicado, **habría saltado el único par de la banda cuya rama
hermana es el sujeto entero de la cita**. La tesis de #198 no necesita más prueba que ésta.

⚠ Matiz que evita una lectura torcida: el par es **(a)**, no un defecto. La cita del port es
correcta y el port es fiel. **El defecto está en el PREDICADO que clasificó ese par como «nada
que modelar», no en el par.** Son dos cosas distintas y la celda no las distingue.

## 3. PASO 2 — el censo: las cuatro ramas, y lo que cada una hace de verdad

| par | la rama «inerte» | qué escribe | ¿vivo? | dónde se consume |
|---|---|---|---|---|
| `NPC.OVL:0x1321` | `mov dx, 1` | registro `dx` | **SÍ** | `0x1321` `mov ax, dx` ⇒ **el retorno** |
| ~~`COMBAT.OVL:0x1bbd`~~ | ~~`mov cx, 0x64`~~ | registro `cx` | ~~SÍ~~ | ⚠ **ATRIBUCIÓN REFUTADA 2026-07-30** (re-medida contra el disasm): el dueño del par es MAINOUT.OVL, no COMBAT. En COMBAT el offset cae A MITAD DE RAMA (`0x1bb8: jne 0x1bbd` · `0x1bba: mov cx,0x64` · `0x1bbd: mov bx,[bp-0x12]`); en MAINOUT es `0x1bb9: add [g_gold],ax` · `0x1bbd: call 0xffffb714`, y el docblock del port que esta fila cita (`game.ts:1331`) abre nombrando MAINOUT `0xb714`, dirección que SOLO MAINOUT tiene. La conclusión «cx es un IMPORTE» se sostenía sobre la copia equivocada. |
| `ULTIMA.EXE:0x1c7c` | `mov cl, 0` | registro `cl` | **SÍ** | `0x1c7c` `cmp cl, 0x27` — **en el offset del par mismo**, y `0x1c81` lo topa a `0x27` |
| `EGA.DRV:0x25f8` | `xor word ptr cs:[0x2541], bx` | ★★ **MEMORIA** | **SÍ** | `0x25f8` `cmp word ptr cs:[0x2541], 1` — **la cola LEE la dirección que la rama acaba de escribir** |

**Tres de cuatro** escriben un registro que fluye al retorno o a la reunión: la tesis de la
tarjeta se cumple en el 75% del bucket, no en un caso aislado. Y la cuarta es otra cosa.

### 3.1 El radio, medido — y **cero** ramas escondidas

Me preocupaba que hubiera ramas inertes ocultas bajo pares de otra forma (la prioridad las
taparía). **Medido, no las hay:**

| medida @ main `0e1fd058` | valor |
|---|---|
| clase-4 | 345 pares · 423 ramas |
| **ramas** clasificadas `PREFIJO-inerte` | **4** |
| **pares** en la celda `PREFIJO-inerte` | **4** |
| ⇒ ramas inertes bajo un par de OTRA forma | **0** |

⇒ La correspondencia es **1:1** y el radio de la ceguera es **exactamente 4 pares de 345**. Lo
digo porque yo esperaba lo contrario: **la sospecha estructural era razonable y la medida la
niega**, y eso acota el arreglo de #217/#84 a una población diminuta.

### 3.2 ★★ La CUARTA ceguera: escritura a memoria con PREFIJO DE SEGMENTO

El predicado decide «escritura» con dos expresiones, y la instrucción de `EGA.DRV` no casa con
ninguna de las dos:

| | qué exige | por qué falla aquí |
|---|---|---|
| `WRITE_RE` | mnemónico + espacios + `[` | tras `xor ` viene `word`, no `[` |
| `WRITE_PTR_RE` | mnemónico + `(byte\|word) ptr [` | la instrucción trae **`ptr cs:[`** — el prefijo de segmento se cuela entre `ptr ` y `[` |

⇒ **El predicado es ciego a toda escritura a memoria cuyo operando lleve override de segmento**
(`cs:` `ds:` `es:` `ss:`). No es una limitación documentada: el docblock declara la ceguera a
registros —dice literalmente que la hermana *«sólo mueve registros»* y en la misma frase la
declara auto-adjudicable, que es el defecto confesado sin querer— pero **de las escrituras dice
que las mira**, y el control (3) las cuenta. Cuenta 0 y hay 1.

★ **Y es la MISMA familia que #188** (*«el eje FORZADA de la banda pegajosa es CIEGO AL
SEGMENTO: el regex tira `DS:`»*): un patrón que asume `ptr [` y no contempla el override, ahora
en **otro** instrumento y con consecuencia **peor**, porque allí mal-etiquetaba una atribución y
aquí mete una escritura en el único bucket que el instrumento autoriza a cerrar sin leer.

**El radio de esta segunda ceguera, con sus controles** (mide, no supone):

| medida @ main `0e1fd058` | valor |
|---|---|
| escrituras a memoria con prefijo de segmento invisibles a `is_write()` | **1** |
| ★ y cae en | `EGA.DRV:0x25f8`, forma `PREFIJO-inerte` |
| control POSITIVO — escrituras SIN prefijo que `is_write()` **sí** ve | **309** |
| cota — instrucciones con operando de segmento en las 423 ramas | **6** |
| de esas 6, escrituras | 1 · el resto **5** son lecturas/`cmp`, ignoradas **con razón** |

⇒ La fuga es **única en toda la población**, y cae **justo en el bucket donde hace el máximo
daño**. Un evento de 1 entre 423 aterrizando en una celda de 4 no es algo que se pueda encoger
de hombros; pero tampoco es sistémico, y decirlo es parte del trabajo: **el arreglo es de dos
caracteres en un regex y su radio es UN par.** El control POSITIVO de 309 está ahí para que
nadie lea mi «1» como un cero en falso: el detector ve escrituras cuando las hay.

⚠ Detalle de familia que conviene anotar: el par vive en **`EGA.DRV`**, o sea en la extensión
que #208 sacó a la luz. No es causa de nada aquí —el partidor sí carga los `.DRV`—, pero es la
tercera vez que un hallazgo cae en un fichero de esa familia.

## 4. PASO 3 — ¿se apoyó alguna conclusión archivada en el predicado ciego? **NO**

Barridas las **8** notas de `re/notes/` que nombran el bucket, mirando **qué dicen**, no que
aparezca el token:

| acta | qué dice del bucket |
|---|---|
| `pegajosa-96-acta.md` (×8) | lo rotula **«`PREFIJO-inerte` (NO auto-adjudicable)»**, y en la tanda 6 lo cierra **POR LECTURA** («CERRADAS 5/5») |
| `pegajosa-103-acta.md` (×2) | **el mismo rótulo** «(NO auto-adjudicable)» |
| `pool-174-acta.md` (×4) | cuenta **0** en su pool, y dedica un párrafo a *«lo aprovechable no es el fallo, es cómo NO se cazó»* |
| `pegajosa-174-acta.md` (×4) | lo marca **cola viva** con aviso, no cerrado |
| `sueltos-174-cotejo-86.md` | **`PREFIJO-inerte` 1/1** entre los NOMBRADOS uno a uno |
| `sueltos-b-206-cotejo-86.md` (×3) | **1/1 ✓ «reproduce EXACTO»** — cotejado por MIEMBROS |
| `sueltos-174-cierre-acta.md` · `liston-207-acta.md` | sólo la cifra de celda en su matriz |

⇒ **Ninguna conclusión archivada descansa sobre el predicado.** El instrumento **declara** el
bucket auto-adjudicable y **las actas se negaron a usarlo así**: lo etiquetaron «NO
auto-adjudicable», lo leyeron a mano y lo cotejaron por miembros. La ceguera existía y **nunca
se convirtió en un cierre falso**, y no por suerte: por una política explícita.

★★ **Y la política queda VINDICADA DOS VECES, no una.** La tarjeta ya recogía la primera
(`CAST.OVL:0x18dd`, la SALIDA que faltaba). Ésta es la segunda y **nadie la había nombrado**:
`EGA.DRV:0x25f8`, con una escritura a memoria dentro. Dos defectos independientes, en el mismo
bucket, cazados los dos **por lectura y ninguno por el control**. Cuando un bucket acumula dos
excepciones halladas por vías distintas, lo que falla no es el criterio: es la idea de que ese
bucket pueda cerrarse sin leer.

⚠ **Y una consecuencia viva, dicha con precisión:** de los 4 pares, **`NPC.OVL:0x1321` es el
único leído**. Los otros tres —incluido el de la escritura a memoria— **siguen sin leer** y
viven en la columna AMBIGUA. Si alguien enciende la auto-adjudicación que el docblock autoriza,
**cierra `EGA.DRV:0x25f8` con una escritura a memoria dentro**. Eso es lo que hay que evitar, y
por eso se declara en vez de arreglarse aquí.

## 5. Declarado, que no es veredicto

- **El docblock se autodelata, y merece quedar citado**: describe la rama inerte como que *«sólo
  mueve registros»* y **en la misma frase** la declara *«la única forma que se adjudica SOLA»*.
  El motivo por el que el bucket es peligroso está escrito **como si fuera su justificación**.
  Es el género de #194 en su variante más difícil de ver: no una cabecera contradicha por su
  hermano, sino **una cabecera que contiene su propia refutación en la frase siguiente**.
- **La cifra de `pool-174-acta.md` no contradice la mía**: allí `PREFIJO-inerte` cuenta **0** y
  aquí **4**, y no hay conflicto — son **poblaciones distintas** (el pool estricto ya adjudicado
  frente a la banda pegajosa). `pegajosa-174-acta.md` §1 ya avisaba de esa discordancia. Lo
  anoto porque el cruce de las dos cifras invita a un «alguien se equivocó» que no toca.

## 6. Lo que este carril NO ha hecho

- **No ha tocado el instrumento.** Ni `is_write`, ni `WRITE_PTR_RE`, ni el predicado, ni el
  control (3). El arreglo va a la ventana de #217/#84, con re-medición de banda detrás — y ahora
  con **dos** criterios que añadir, no uno: registro-vivo **y** prefijo de segmento.
- **No ha adjudicado la ATRIBUCIÓN** de los 3 pares AMBIGUA (§1.1). Sólo la forma de su rama.
- **No ha re-adjudicado** el par de F+L como defecto: es **(a)**, y lo que falla es el
  predicado (§2).
- **No ha abierto tarjeta nueva**: los dos hallazgos caben en #198 (registros) y en #188/#217
  (segmento). El de la escritura a memoria **agranda** #198, no la sustituye.
- **No ha corrido** `pytest re/tools` completo, ni ha regenerado `routine-census.json` (EMBARGO),
  ni ha tocado `game/src`, `re/tools` ni `re/ledger`. Sólo `re/notes/`.
- **No ha barrido** el cabo de HERMANOS-DE-FORK que la tarjeta menciona al final. Queda apuntado
  y sin hacer, con su seña: pares del mismo fork que aparecen dos veces en la banda, uno por
  brazo, en celdas distintas.

## 7. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 8. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CAST.OVL`, `COMBAT.OVL`, `EGA.DRV`,
`NPC.OVL`, `ULTIMA.EXE`.
