# Witness — Insignia/Blackthorn (#3): análisis + BLOQUEO de escenario → pivote a #4

> ⚠ **RESUELTO ESTÁTICO 2026-07-30 — este witness ya NO hace falta**
> (re/notes/talk-031e-resolucion.md): el «trigger opaco 0x1912» es TALK 0x031E
> `talk_converse_dispatch`, leído ENTERO. La vía de captura EJECUTA el guard_demand
> TALK 0x1e2, cuyo gate 0x2a4 (`g_time_spell==0x1d`) SÍ consulta la insignia: sin
> ella ret 1 silencioso → captura; con ella, reto de password EN la intercepción.
> La pregunta del §ABIERTO de abajo queda respondida SÍ. Las divergencias de port
> resultantes son las tarjetas T-A/T-B del acta. El texto siguiente se conserva
> como registro del análisis pre-resolución.

**Carril:** oráculo (SCOUT) · **Fecha:** 2026-07-18 (cuenta restaurada) · Rama `re/oracle-witnesses`.
Pregunta: ¿el binario respeta el Black Badge (`g_time_spell==0x1d`) para evitar la captura de
los guardias del Palacio, o el port hace bien en ignorar `wornBadge`?

## Lo que SÍ se resuelve estáticamente

1. **La Insignia SÍ pasa la GUARDIA HABLADA (confirmado, TALK.OVL 0x02a4, blackthorn.md §5):**
   en loc 0x12, `cmp g_time_spell,0x1d ; je … else return 1`. Con la insignia puesta
   (g_time_spell=0x1d) el peaje/interrogatorio da «Pass, friend!» (str 0x913a) y ret 0
   (satisfecho). Ése es el rol DOCUMENTADO de la insignia y es **fiel** (el port ya modela
   el pase por contraseña; la insignia es el mismo gate 0x1d).
2. **La escena de captura (TOWN.OVL 0x12ae) NO chequea la insignia:**
   `12b9: cmp g_location,0x12; 12c0: party_conscious_state; 12c5: jge → captura` — gate
   determinista (loc 0x12 + party no-todo-muerto), SIN rand y SIN mirar g_time_spell. O sea,
   si se LLEGA a 0x12ae, la insignia ya no importa; cualquier gate de insignia vive ANTES, en
   el TRIGGER.
3. **El trigger real de la captura-por-caminar es el handler OPACO 0x1912** (TOWN.OVL 0x13ce
   → `call 0xfffff912`, overlay-resident, no desensamblado; blackthorn.md §2.1a/§9). Ahí —y
   sólo ahí— podría estar el chequeo `g_time_spell==0x1d`. Es el único punto sin derivar.
4. **El «capture por adyacencia» del port es una APROXIMACIÓN Clase-C del clon** (blackthorn.md
   §8.5: «Trigger de captura por ataque de guardia: NUEVO»), no un cálculo directo del binario;
   el binario captura por ATAQUE de guardia (que pasa por 0x1912).

⇒ La pregunta se reduce a: **¿0x1912 chequea g_time_spell==0x1d?** Sólo el oráculo lo dice.

## BLOQUEO del escenario (por qué NO se hizo el witness ahora)

El witness exige un guardia HOSTIL del Palacio (type 0x70) adyacente al Avatar en **loc 0x12**
para que corra 0x1912. Problemas de construcción:

- El save de referencia arranca en **loc 0x11 (Castillo de Lord British)**, no en el Palacio.
  Sus guardias son de LB (amistosos), no los hostiles type 0x70 de Blackthorn.
- **Falsear `g_location=0x12` por write NO sirve:** el mapa de pueblo y sus NPCs se cargan del
  fichero al ENTRAR; un write del global deja cargado el mapa de Castle Britannia (sin los
  guardias hostiles del Palacio). El gate 0x12ae leería loc 0x12 pero no habría trigger real.
- El precedente que dio el lead (`oracle-camp-event.md`) inyecta un evento de **OVERWORLD**
  (camp en tile de pueblo, party en 0x5C5A) — NO una **carga de mapa de pueblo** con NPCs
  hostiles. La familia de inyección del camp no cubre este caso.
- Alternativa (navegar en vivo de loc 0x11 → overworld → Palacio de Blackthorn) = decenas de
  turnos por el pty lento + cruzar el overworld: fuera de «razonable».

Por eso, **según la instrucción explícita del lead** («si la inyección del palacio se atasca
más de lo razonable, pivota a #4»), PIVOTO a witness #4 (serpent-fire), que es de clase
OVERWORLD (como el camp) y por tanto construible.

## Estado del witness #3

- **PARCIAL-estático:** la insignia como pase de guardia HABLADA = CONFIRMA-FIEL (el port lo
  modela por contraseña; mismo gate 0x1d). La escena de captura no mira la insignia.
- **ABIERTO (oráculo):** ¿el trigger de captura-por-ataque (0x1912) respeta la insignia? →
  requiere el Palacio con guardia hostil cargado. Vías para cerrarlo cuando haya ventana:
  (a) un SAVE de referencia posicionado EN el Palacio de Blackthorn (lo más limpio), o
  (b) resolver + desensamblar el overlay de 0x1912 (blackthorn.md §9 ya lo pide), o
  (c) navegación viva hasta el Palacio (cara).
- **Recomendación de port entretanto:** el port ignora `wornBadge` en su captura Clase-C; como
  el pase HABLADO por insignia (contraseña/0x1d) SÍ está modelado, el hueco real es sólo si la
  captura-por-caminar debiera respetar la insignia — indeterminado hasta (a)/(b). No es
  regresión evidente (la captura-por-adyacencia es ya una aproximación declarada).
