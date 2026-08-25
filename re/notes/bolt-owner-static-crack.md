# Dueño del bolt/línea (0x104e→0x1f60→0x1c36) — CRACK ESTÁTICO del jump-table

**Carril:** re/oracle-2 · **Fecha:** 2026-07-19 · Encargo: invertir la búsqueda (estático antes
que casts) para NOMBRAR qué índice(s) de hechizo rutean al aplicador de línea/área tras 3 casts
vivos negativos (In Flam Hur #45, In Zu #28 — ambos con enemigo en línea y caster revivido —
dispararon MP pero CERO tiradas (0,15)/(0,30)). **Resuelto sin más casts.**

## Mapeo overlay→kernel (la piedra Rosetta)
`re/disasm/ULTIMA.EXE.seg2.md`: todo el código vive en UN CS de 64K = base de carga. CAST.OVL
carga en **CS base 0xBF80** (verificado: destino base-0 `0x842e`→real `0x43ae`, delta 0xBF80;
idéntico al rebase 0xbf80 de `cast-line-area-spell-derivation.md`). ⇒ **file_offset F ↔ CS_offset
(F + 0xBF80) & 0xFFFF**.

## La tabla de dispatch de EFECTO de hechizo
`CAST.OVL 0x0f0c`: `[bp-2]` = índice de hechizo (0-based). `0f0f cmp ax,0x2f; jbe` → 48 hechizos
(0..47). `0f17 add ax,ax; xchg bx,ax; 0f1a jmp word ptr cs:[bx-0x2f3a]`. El disp 0xd0c6 es
LITERAL (capstone lo lee crudo) ⇒ la tabla está en **file offset (0xd0c6 − 0xBF80) = 0x1146**
(DENTRO del fichero; el disasm la mal-parsea como código — `1146: mov al,[0xb2ce]; into; ...`,
firma inequívoca de datos). 48 words = CS-offsets de handler (rango 0xCExx–0xD0xx).

## Resultado del crack (48 entradas, cada hechizo con su stub)
Simulé el control-flow de cada stub (jmp/jcc) hasta el terminal. **Rutean al case 0x104e
(`call 0x1f60`→`call 0x1c36`) EXACTAMENTE 4 índices:**

| idx | hechizo (MagicDefinitions.json) | stub | modo (arg medio) | param-global | cast.ts |
|----:|--------------------------------|------|-----------------:|--------------|---------|
| 28 | **In Zu** | 0x1040 (=case 0x104e directo) | **1** | g_unk_13b6 | lineAoe mode 1 len 2 ✓ |
| 40 | **In Nox Hur** | 0x10d4 → jmp 0x104e | **2** | g_unk_13b4 | lineAoe mode 2 len 1 ✓ |
| 45 | **In Flam Hur** | 0x111c → jmp 0x104e | **3** | g_unk_13ae | lineAoe mode 3 len 2 ✓ |
| 44 | **In Vas Grav Corp** | 0x110a → jmp 0x104e | **4** | g_unk_13b2 | lineAoe mode 4 len 1 ✓ |

Cada stub: `mov al,[g_cmb_actor]; push; push <modo>; push [g_unk_13bX]; (jmp) 0x104e`. El origen
es **g_cmb_actor** (0x589E) ⇒ es un hechizo de **JUGADOR en combate**, NO habilidad de monstruo
ni aliento de dragón (responde el ítem-3 del lead). El `modo` (1/2/3/4) es el 2º arg y CASA 1:1
con el `mode` que el port ya asigna en `cast.ts:191-198`. Los 4 param-globals (0x13ae/b2/b4/b6)
son 4 words consecutivos = tabla de parámetros por-hechizo.

## Veredicto
- **El port NO estaba mal etiquetado.** `cast.ts` ya clasifica estos 4 como `lineAoe` con los
  modos correctos. El crack estático lo CONFIRMA como ground-truth: 28/40/44/45 → 0x104e→1f60→1c36.
- La familia **In *Grav (14 In Flam Grav / 15 In Nox Grav / 16 In Zu Grav / 20 In Sanct Grav)**
  llega a 0x1c36 por OTRA ruta: sus stubs hacen `call 0x4c` (arg = tipo de campo 0/1/2/3), origen
  = celda apuntada (campo overworld) = el `fieldWall` del port (ya modelado). Es lo que vio el
  witness #14 (3×3 de campo). ⇒ **0x1c36 tiene DOS clientes**: bolt-de-combate (0x1f60, origen
  actor) y campo-overworld (0x4c, origen celda).

## Por qué los 3 casts vivos salieron negativos (caveat, NO mislabel)
El case 0x104e es un `call 0x1f60` INCONDICIONAL. Si el cast hubiera dispatchado ahí, 0x1c36
habría emitido los gates rand30. Que MP bajara (delta = círculo) pero SIN tiradas de juego ⇒ el
cast en COMBATE **no llegó a la tabla 0xf3f de CAST.OVL** (probablemente el casteo en combate
dispatcha por otra vía —COMBAT.OVL— o el getstring rúnico del fixture no resolvió al índice; la
tabla 0xf3f/origen-g_cmb_actor es el efecto, pero la ENTRADA en combate puede diferir). Es un
artefacto del fixture, no evidencia de familia mal etiquetada. Confirmar la vía de ENTRADA en
combate (COMBAT.OVL→CAST) queda para un cast vivo dirigido si el lead lo pide.

## Rand-count del picker 0x9cb6 (Kal Xen Corp #43) — INCONCLUSO (mismo artefacto de combate)
Ejecutado `probe_summon_randcount.py` (idx 43 = Kal_Xen_Corp, verificado; su stub 0x1100 hace
`call 0xffffc192` = summon kernel → kernel_spawn_actor 0x6506 → picker seg2 0x9cb6). Resultado:
**`enemigos 1→1, nuevo=0` — NO se invocó ningún daemon.** MP 99→91 (delta 8 = círculo de Kal Xen
Corp) pero SIN efecto. ⇒ el picker 0x9cb6 **nunca corrió** → no hay rand-count que medir.

La traza (60 rolls) es SÓLO ruido: cosmético de anim de combate `0x4628`×31 + `0x4670`×9
(lo=0,hi=255 — este probe NO aplicó `patch_anim_rand`, sólo sprite/render) y misreads de pila del
pty `0xac6c`×15 (lo=52224,hi=9500, firma de misread ya conocida) + 5 misreads sueltos
(ret0 0xf52/0xf90/0x5/0x3/0x4, lo/hi basura). **Cero cluster atribuible al picker.**

**Veredicto: INCONCLUSO** — coherente con el mismo artefacto que tumbó los 3 casts de bolt: en
este fixture el casteo EN COMBATE resta MP pero el EFECTO no se ejecuta (ni campo, ni daño, ni
spawn, ni tiradas de juego). El picker 0x9cb6 sigue Clase-C menor; para cerrarlo hay que primero
resolver la vía de ENTRADA del cast en combate (COMBAT.OVL→CAST, o input rúnico/aim del fixture),
el mismo paso pendiente del footprint 2D. El probe (`probe_summon_randcount.py`) queda LISTO:
en cuanto un summon dispare de verdad (nuevo enemigo/aliado), el cluster de ret0 del picker por
reintento (retry-8) se lee del stream limpio.

## Evidencia
- Tabla + control-flow: script en el historial del carril (decodifica 0x1146, sigue stubs).
- `re/disasm/CAST.OVL.asm` 0x0f0c-0x1145 (dispatch+stubs), 0x1040/0x104e/0x1f60/0x1c36 (chain).
- `re/disasm/ULTIMA.EXE.seg2.md` (rebase 0xBF80). `game/src/core/magic/cast.ts:149,191-198,213`.
- Negativos vivos bolt: `/private/tmp/<oracle-rundir>-2/{ifhur,inzu}.log`, `scratchpad/{ifhur_trace,bolt_28}.json`.
- Summon: `/private/tmp/<oracle-rundir>-2/summon.log`, `scratchpad/summon_randcount.json`.
- Probes: `re/notes/{probe_bolt_variants,probe_ifhur_trace,probe_summon_randcount}.py`.
