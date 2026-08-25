# ACTA #173 — Censos de callers por GREP: re-ejecutados por BANDA

**Resultado:** el defecto es real y **rinde**. De 7 afirmaciones concretas re-ejecutables,
**4 tienen delta** y una de ellas **retira la premisa de una sesión de oráculo ya
encolada**. El instrumento correcto ya existía en el repo; lo que falló fue contestar la
pregunta con `grep` teniendo `resolve_near_call` al lado.

---

## 1. El instrumento — y el control que lo salvó de nacer roto

`re/tools/callers_por_banda.py`. No re-implementa nada: es una CONSULTA sobre
`routine_census.resolve_near_call`, para poder preguntar «quién llama a X» sin construir
el censo entero y sin tentación de volver al grep.

★ **La primera corrida del control salió ROJA, y con razón.** Yo preguntaba por «callers
de `ULTIMA.EXE:0x7a8e`» y salía **cero**. `0x7a8e` no es un offset del kernel: es un
**STUB**, y `resolve_near_call` nunca devuelve `(kernel, 0x7a8e)` para él — devuelve la
ENTRADA DEL OVERLAY al que salta (`TOWN.OVL:0x1694`). O sea: mi instrumento contra el
cero-en-falso nacía con un cero-en-falso propio, una capa más abajo. Sin el control
obligatorio lo habría publicado dando cero a todo. Arreglado con `_normalize_dest`, que
traduce el destino ANTES de comparar y **imprime la traducción** para que nadie lea el
resultado creyendo otra cosa.

**Control positivo, VERDE:**

```
0x7a8e es un STUB → se resuelve como TOWN.OVL:0x1694
  esperado SHOPPES3.OVL:0x01fd   OK
  esperado CMDS.OVL:0x0677       OK
  callers por banda: 3  →  CMDS:0x0677, SHOPPES3:0x01fd, TOWN:0x051d
  grep 'call 0x7a8e': 0
```

**Hallazgo de propina del propio control:** son **TRES** sitios de llamada, no dos. El
tercero (`TOWN.OVL:0x051d`) es **intra**-overlay —dentro de la rutina 0x0408, tras
`cmp word ptr [bp+4],0 / je`— así que no es un caller inter-overlay perdido y un grep
DENTRO de TOWN lo habría visto. Pero el conteo de #158 («dos callers») queda **incompleto**:
la rutina tiene tres sitios, 2 por stub + 1 intra.

## 2. CENSO — 35 afirmaciones de callers en `re/notes`

Barrido por `único caller | N callers | sin callers | ningún caller`. De las 35, la mayoría
son prosa metodológica (los `.DRV` no producen aristas, las indirectas tampoco…). Las
**7 que nombran un offset concreto** son las re-ejecutables, y son éstas.

## 3. LOS DELTAS

### 3.1 ★★ `ULTIMA.EXE:0x0f46` — «0 callers estáticos» → **SEIS**

Afirmado en DOS sitios: `auditoria-general-cierre-20260727.md:19` («el wrapper 0x0f46
resiste el análisis estático (0 callers) → cola oráculo lote-D») y `lote-D-oraculo.md:35`,
que **encola una sesión de oráculo (B2)** para descubrir el disparador poniendo un
breakpoint y jugando hasta que pare.

```
BANDA 6: BLCKTHRN:0x098c · BLCKTHRN:0x0bfa · ENDGAME:0x004b ·
         INTRO:0x037e · INTRO:0x060c · SJOG:0x08af
grep    0
```

**La premisa de la tarjeta de oráculo es falsa.** No es que el wrapper «resista el análisis
estático»: es que se le preguntó con la herramienta que no sabe de bandas. Seis call-sites
estáticos, en cinco overlays. ⇒ **B2 del lote-D (#10) se puede re-acotar o retirar**; ese
tiempo de oráculo estaba comprado contra un cero que no existe.

### 3.2 ★ `ULTIMA.EXE:0x1d5e` — «único caller en CS 0x1b5b» → **DIECISÉIS**

`oracle-input.md:15`. Banda: ENDGAME×2, FONT×4, INTRO×7, TALK×2, y el sitio intra-kernel
en CS 0x1b5b, que era el único que el grep veía. El grep acertaba **1 de 16**.

### 3.3 `ULTIMA.EXE:0x3f6e` — la corrección existe pero **no se propagó**

`los-passability-audit.md:58` ya corrigió «ÚNICO caller» a **DOS**, y la banda lo confirma
(`CAST:0x1c28` + `COMSUBS:0x142a`; grep da 0). Pero la afirmación vieja **sigue viva en
tres sitios**: `combat-spells.md:59`, `combat-spells.md:209` y
`los-audit-lineLOS-witness.md:61` («Único caller estático = CAST:0x1c28»). Es el patrón de
la corrección que se escribe en una nota y no se persigue en sus hermanas.

> **⚠ EL «TRES SITIOS» DE ARRIBA ERA UNA COTA INFERIOR, NO UN CENSO (2026-07-30, auditoría
> general 30-07 ALTA-4).** Al tiempo de este barrido había **SEIS** instancias vivas. Las tres
> que faltaban —`los-passability-audit.md:13`, `lote-D-witnesses-relevo.md:39` y
> `los-audit-lineLOS-witness.md:3`, todas de 2026-07-18 (`git blame` d14d77ba / 10c0749c /
> 2c6ab578), o sea material VIEJO y no población nueva— quedan tachadas hoy. **Undercount del
> barrido**, y con dos causas identificadas que valen para el próximo: (1) `los-passability-
> audit.md` tenía DOS instancias y el barrido sólo vio la de la prosa (`:58`), no la de la
> **tabla-resumen del encabezado** (`:13`); (2) la misma frase aparece con **envoltura
> distinta** (`único caller`, `Único caller estático`, y la variante entre rayas de una celda de
> tabla), que es lo que hace que un grep de forma fija dé un cardinal corto sin dar cero.
> Doctrina: un conteo de instancias de una frase es COTA INFERIOR mientras no se censó por
> CONTENIDO — aquí, por su offset, `0x1c28`, sobre todo lo tracked; que es como aparecieron
> estas tres.

### 3.4 `CMDS.OVL:0x073e` — «3 callers» → **4**

`transport.md:399`. Los cuatro son **intra** (`CMDS:0x0f20/0f4c/0f72/0fa3`), así que NO es
un fallo de banda: es un conteo corto. Ojo con la atribución — yo mismo pregunté primero
por `kernel:0x073e` y me salió 0; el offset es de CMDS. El delta no cambia el veredicto de
la nota (misma polaridad en todos), pero el número está mal.

### 3.5 Las que CUADRAN (control negativo del barrido)

| afirmación | nota | banda |
|---|---|---|
| `0x2f62` único caller `0x5910`(`0x5944`) | camp-ambush:47, transport:223, wind-rand-decision:42, oracle-flash-rng:24 | **1** ✓ |
| `TOWN:0x12ae` único caller = npc_engine | blackthorn.md:53 | **1** (`TOWN:0x13d6`) ✓ |

Que dos cuadren importa: si TODO hubiera dado delta, el sospechoso sería mi instrumento.

### 3.6 `0x149e` — NO APLICA, y merece decirse

`lote-D-witnesses-relevo.md:180` dice «Único caller de 0x149e», pero su propia cita de dos
líneas antes es `0x175b: jmp 0x149e`: es destino de **JMP**, no de CALL. `callers_of` mira
`call` y da 0 correctamente. No es un delta: es **vocabulario** — llamar «caller» a un
salto hace que el número no se pueda comprobar con ninguna herramienta de call-graph.

## 4. Lo que NO he hecho (encargo explícito)

- **No he cableado nada.** Los seis callers de `0x0f46` son un hallazgo de DOCUMENTACIÓN y
  de ALCANCE DE ORÁCULO; **no he comprobado si el port modela el disparador del fizzle**, y
  no lo declaro ni cubierto ni ausente. Si de ahí sale cableado que falta, es tarjeta propia
  con failing-first, como pidió el precedente de la cama.
- **No he corregido las notas.** Los cuatro deltas son de ficheros con dueño y el fix es de
  una línea cada uno; los traigo como cola, no los aplico.

## 5. Cola que deja — ✅ APLICADA ENTERA en #175

Los seis puntos de abajo están **hechos**, cada cifra anclada a `99c07474` y citando
`re/tools/callers_por_banda.py`. Ficheros tocados: `auditoria-general-cierre-20260727.md` ·
`lote-D-oraculo.md` · `oracle-input.md` · `transport.md` · `calcados-lote-acta.md` ·
`combat-spells.md` (×2) · `los-audit-lineLOS-witness.md` · `lote-D-witnesses-relevo.md`.

Criterio de redacción, para que se pueda auditar la corrección y no sólo el número: **la
afirmación vieja se TACHA en su sitio, no se borra**, y al lado va la medida nueva con su
instrumento y su SHA. Quien lea la nota dentro de un mes ve QUÉ se creía, QUÉ se mide y CON
QUÉ; borrar la vieja habría dejado una cifra sin historia, que es como se pierde el rastro
de por qué nadie volvió a comprobarla.



1. **Re-acotar o retirar B2 del lote-D (#10)** — su premisa («0 callers») es falsa; hay 6.
2. Corregir los 4 números: `0x0f46` (0→6), `0x1d5e` (1→16), `0x073e` (3→4), y el conteo de
   #158 (2→3 sitios, 2 stub + 1 intra).
3. Propagar la corrección de `0x3f6e` a sus tres hermanas vivas.
4. Sustituir «caller» por «origen del salto» en `lote-D-witnesses-relevo.md:180`.
5. **Las 28 afirmaciones de prosa** que no nombran offset quedan sin re-ejecutar por
   construcción: no hay nada que consultar. Declarado, no barrido.

## 6. Gates

```
raíz: python3 re/tools/callers_por_banda.py --control   EXIT=0 (VERDE)
raíz: python3 re/tools/seed_gate.py                     EXIT=0
raíz: python3 -m pytest re/tools/test_frontier.py -q    EXIT=0
raíz: python3 re/tools/genero.py                        EXIT=0
```
