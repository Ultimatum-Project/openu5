# Oráculo — suficiencia del trigger de captura de Blackthorn (F1.7 Clase C → B-runtime)

> ⚠ 30-07: el «handler OPACO 0x1912» de este acta quedó RESUELTO ESTÁTICO — es TALK
> 0x031E `talk_converse_dispatch` (leído entero, re/notes/talk-031e-resolucion.md). El
> testigo de abajo queda EXPLICADO byte a byte, no contradicho: el guardia corrió el
> guard_demand 0x1e2 sin insignia → ret 1 → captura. Registro histórico intacto.

Witness runtime (2026-07-14) de la SUFICIENCIA del trigger de captura del Palacio de
Blackthorn. La NECESIDAD de la adyacencia ya era grado A (`[0x65bf]` idx activo: sólo
lo fija el fast-path de adyacencia manhattan==1, NPC.OVL 0x06E4, 2 escrituras). Faltaba
la suficiencia: para un guardia del Palacio (aiType 0/4 → marcador **0x74** → rama
npc_engine **0x13b4**), ¿basta la adyacencia o hace falta `result==2` / el handler
OPACO `0x1912` (fuera de TOWN.OVL)? **RESUELTO: adyacencia BASTA.**

Herramienta: `re/tools/camp_probe.py` no; script de sesión (scratch) con la primitiva
de sub-prompts `oracle_input.py`. Boot con save custom por monkeypatch de
`oracle.GAME_SRC` (NO se toca oracle.py).

## Cómo se sembró (importante para el av-saves-generator)

- El save `.06b` (av-saves) está en overworld **(196,246)**, 1 tile al sur de la
  entrada de Blackthorn **(196,245)** (loc 0x12 = id 18 de `locationsX`; el "PAWS" del
  name-index es basura, ignorar).
- **Pisar el tile NO auto-entra.** Entrar es el comando **(E)nter** (kernel 0x3254 →
  MAINOUT:0x08DE). Secuencia verificada: `step UP` a (196,245) → **`send 'e'`** → loc
  pasa a **0x12**, party en el interior (15,30).
- ⚠️ **La secuencia de ENTRADA por el mapa SÍ puebla los NPCs**: tras (E)nter se
  cargaron **3 guardias type 0x70** en g_world_objects (schedule del save: (13,24),
  (17,24), (14,6) a hora 0x0C). En cambio, **sembrar loc=0x12 directo en el save NO
  carga guardias** (probado: 0 objetos type 0x70) — confirma el aviso del §8 del plan
  AV. ⇒ para cualquier witness que dependa de NPCs hay que ENTRAR por el mapa con (E).

## Flujo de captura (TOWN.OVL npc_engine 0x1352, base load_seg 0x81D0)

```
1376: call npc_target_for_attack (NPC.OVL 0x06E4) → (re)fija g_npc_attack_tile[0x65be]
1379: cmp [g_npc_attack_tile], 0x61 ; jne 0x13b4      → guardias palacio: marcador 0x74 ≠ 0x61 → 0x13b4
13b4: cmp [bp+4], 0 ; jne 0x13d6                       → result-1≠0 (result≥2) → captura DIRECTA
13ba: al=[0x65bf](idx) ; cmp [idx*16 + 0x5f68](dialogNum),0 ; je 0x13dc   → dialog 0 → nada
13cf: call 0x1912 (OPACO) ; or ax,ax ; je 0x13dc       → 0x1912==0 → nada
13d6: call 0x12ae = captura                            → re-gatea loc 0x12 + conscious
```

## Witness runtime (grado B-runtime)

Conduje el party (nav con rotación de dirección) hasta adyacencia a un guardia:

```
party (16,25), guardia idx=13 en (16,24) → manhattan==1 (ADYACENTE), party pasa turno
[BP RESULT_BR 0x9584] result-1 = 0  →  result == 1   ; idx=13 ; marcador = 0x74
[BP CAP_JUMP  0x95A6] alcanzado (se decide llamar 0x12ae)
[BP CAPTURE   0x947E] DISPARA (loc=0x12)  → CAPTURA
```

Verificación de base TOWN en RAM: `[0x947E]=55` (esp), `[0x9584]=83 7E 04 00` (esp) ✓.

**Deducción del camino tomado (decisiva):** `result==1` ⇒ `[bp+4]=0` ⇒ el `jne 0x13d6`
de 0x13b8 **NO se tomó** (rama result≥2 descartada). La única vía restante a 0x13d6
(captura) es 0x13ba→0x13cf: por tanto **`dialogNum≠0`** (guardias del palacio = 255,
`je 0x13dc` no tomado) **Y `0x1912(idx) devolvió ≠0`** (`je 0x13dc` no tomado). Como la
captura DISPARÓ, **el handler opaco `0x1912` retorna NO-CERO para los guardias del
Palacio** — eso es lo que faltaba por decidir del corpus.

## VEREDICTO

- **La adyacencia a un guardia del Palacio (type 0x70 → marcador 0x74) BASTA para la
  captura** — witness runtime. No hace falta `result==2`: en el caso observado
  `result==1` y la captura disparó igual **vía `0x1912≠0`**.
- El handler previamente OPACO `0x1912` (fuera de TOWN.OVL, no desensamblado) **retorna
  no-cero para los palace guards** (deducido de que la captura disparó con result==1).
- ⇒ **el clon (`blackthornGuardCaptureTriggers`: captura por adyacencia sola) es
  CORRECTO**; el temor de "sobre-disparo si `result==1 ∧ 0x1912==0`" **NO se
  materializa** para los guardias del Palacio. La suficiencia pasa de **Clase C
  (aproximación)** a **✅ B-runtime (adyacencia ⇒ captura confirmada)**.
- Matiz honesto: 1 witness (la captura es DETERMINISTA — loc 0x12 + conscious, sin RNG
  —, así que un witness cierra el caso). No se leyó el valor de retorno de 0x1912
  directamente (BP en 0x13d2); se DEDUJO ≠0 de que la captura ocurrió con result==1.
  La sub-rama `result==2` (captura directa 0x13b8) no se observó (con este guardia el
  result fue 1); queda como vía alterna del asm, no necesaria para la suficiencia.

## Nota para el av-saves-generator (acción sugerida)

El §7 del plan AV verifica los saves sólo con `boot()`+lectura de estado; **nunca
probó el STEP DE ENTRADA**. Aquí se probó: los saves de ENTRADA (6/6b/8/10) requieren
**pisar el tile + comando (E)nter** para cargar la localización y sus NPCs — pisar solo
NO entra. Es una nota de USO, no un bug: la entrada FUNCIONA con (E). Conviene que el
generador (o la guía del usuario para la grabación) diga explícitamente "step + (E)nter"
para esos saves, no sólo "pisa 1 tile".
