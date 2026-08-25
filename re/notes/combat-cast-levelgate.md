# Combat-cast «MP baja sin efecto» = GATE DE NIVEL (no la vía de entrada)

**Carril:** re/oracle-3 · **Fecha:** 2026-07-19 · Encargo: desbloquear la vía de ENTRADA del
cast en combate del fixture #44 (el muro que dejaron los relevos 1-2: los casts RESTAN MP pero
el EFECTO no corre). **RESUELTO — y el diagnóstico previo era erróneo.**

## Veredicto

El síntoma «MP baja por el círculo pero cero tiradas de juego / sin efecto» **NO** es un fallo
de la vía de entrada COMBAT.OVL→CAST. La entrada FUNCIONA: el descuento de MP ocurre en
`CAST.OVL:0x0ef8`, DENTRO del despachador de CAST.OVL, así que CAST.OVL YA está corriendo el
cast en combate. El bloqueo es el **GATE DE NIVEL** que viene justo DESPUÉS del descuento:

```
CAST.OVL 0x0ef8: sub [si+0x55b7], al     ; si=caster*32, al=CIRCLE  → MP -= circle
         0x0efc: mov [bp-0xa], 0xffff     ; result por defecto
         0x0f01: mov al, [si+0x55be]       ; AL = LEVEL[caster]   (0x55BE + caster*32)
         0x0f07: cmp ax, [bp-8]            ; LEVEL vs CIRCLE
         0x0f0a: jb 0xee5                  ; LEVEL < CIRCLE → result=0, jmp TAIL → "Failed!"
         0x0f17: jmp cs:[idx*2-0x2f3a]     ; tabla de EFECTO (sólo si LEVEL>=CIRCLE)
```

Como 0x0ef8 (descuento) va ANTES de 0x0f0a (gate), un caster por debajo del círculo del
hechizo **gasta el maná y el hechizo mezclado, luego el gate aborta al tail sin ejecutar el
efecto** (ni campo, ni daño, ni spawn, ni tiradas rand30/rand0(15)). Idéntico al síntoma.

## Prueba viva (oracle-3, boot + enter_combat)

Leídos los niveles NATIVOS del roster del SAVED.GAM de referencia ANTES de sembrar nada:

```
NATIVE levels(6) = [2, 2, 2, 3, 3, 2]      circle(In Flam Hur #45) = 8
NATIVE mp(6)     = [17, 0, 8, 22, 0, 21]
caster = ref 0 (slot 0), nivel NATIVO 2
```

El caster es **nivel 2**. Los 3 hechizos que los relevos 1-2 probaron:
- In Zu #28 → círculo 5  (2 < 5 → gate falla)
- In Nox Hur #40 → círculo 7  (2 < 7 → gate falla)
- In Flam Hur #45 → círculo 8  (2 < 8 → gate falla)

**Los tres estaban por encima del nivel del caster** ⇒ los tres restaron MP y abortaron en el
gate de nivel. No era el fixture ni la vía de entrada: era que el pobre de nivel 2 no puede
lanzar hechizos de círculo 5-8.

## El arreglo del fixture

Sembrar el NIVEL del caster además de MP/int. Offset del nivel = **0x55BE + ref*0x20**, que en
la parametrización del probe es `ROSTER(0x55A6)+CHAR_BASE(0x02)+ref*STRIDE(0x20)+0x16`
(LVL_OFF=0x16). El fixture previo sembraba INT_OFF=0x0E y MP_OFF=0x0F pero NO el nivel.

### Resultado del cast CON nivel sembrado (nivel=99) — EL EFECTO YA CORRE

Mismo boot, tras sembrar nivel/MP/int, cast de In Flam Hur (`c i f h ⏎ UP UP UP`):
- **MP 99→91 (delta 8 = círculo)** — el descuento sigue igual.
- **9 tiradas `(0,15)` del caller `0xdcba`** aparecen en la traza — ret0 crudo 0x3aba, que con el
  rebase de CAST.OVL es el aplicador de línea/área `0x1c36` (0x3aba = 0x1c36... realmente el ret0
  es la dir de retorno dentro del aplicador; classify_roll lo whitelistea como caller de JUEGO).
  **Estas tiradas estaban a CERO en TODAS las corridas de los relevos 1-2** (niveles nativos 2-3
  < círculo) ⇒ sembrar el nivel DESBLOQUEA el efecto. **La vía de entrada COMBAT.OVL→CAST FUNCIONA.**
- `(0,30)` = 0 esta corrida (In Flam Hur no dispara rand30 en este seed/posición; el footprint
  fino es el ítem (a) siguiente).
- Sin daño al enemigo (estaba en (4,6), no en la línea del disparo hacia arriba) ni marcas 0xff
  legibles (transitorias) — ESPERADO; el footprint exige colocar al enemigo EN la línea.

**Respuesta a las 2 preguntas del lead:**
1. **`0xdb7f (100,10000)`** = un `rand_range(100,10000)` que se dispara DECENAS de veces en bucle
   apretado durante el vuelo del bolt (i28-i89, intercalado con los (0,15)). El rango 100..10000
   NO es una magnitud de juego (daño/celda) → es un **contador de tiempo/animación del vuelo del
   proyectil**, no la tirada de daño. (Whitelisted como JUEGO, pero es la animación del bolt.)
2. **Sí: el `(0,15)@0xdcba` ES la tirada del bolt** (aplicador `0x1c36` de In Flam Hur). Que
   aparezca SÓLO tras sembrar el nivel = **la entrada del cast en combate está RESUELTA**. El muro
   que dejaron los relevos NO era la vía de entrada: era el gate de nivel.

**Nota de método para el fixture:** las tiradas del cast caen DURANTE la entrega de teclas
(`after_keys=False`), no después — por eso los relevos que sólo guardaban el slice post-teclas
las perdían. Guardar `trace_all` (i0..) y filtrar por `classify_roll`/rango las recupera.

## Evidencia
- Probe: `re/notes/probe_cast_levelgate.py` (lee nivel nativo + siembra nivel/MP/int + traza).
- Gate estático: `re/disasm/CAST.OVL.asm` 0x0ef8-0x0f1a; documentado en `re/notes/magic.md §0`
  (líneas 0ef8/0f01: descuento de maná y gate de nivel — ya estaba en la nota, no se había
  conectado con el síntoma del fixture).
- Log vivo: `/private/tmp/<oracle-rundir>-3/levelgate.log`, JSON en scratchpad `cast_levelgate.json`.
