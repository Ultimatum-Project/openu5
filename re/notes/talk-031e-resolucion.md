# ACTA — el «handler OPACO 0x1912» RESUELTO: es TALK 0x031E, leído ENTERO, y no era opaco

ALTA-1 de la auditoría general 30-07 (`docs/auditorias/auditoria-general-30-07.md` §1).
Sesión 30-07 noche. Todas las lecturas de esta acta son de primera mano sobre
`re/disasm/TOWN.OVL.asm`, `re/disasm/TALK.OVL.asm` y `re/disasm/ULTIMA.EXE.asm`, con la
resolución hecha por instrumento (`re/tools/dispatch_table.py`), no por el número
impreso del disasm.

## §1 — La resolución, re-verificada con el instrumento

- TOWN 0x13cf, bytes `e840e5`, = `call 0xfffff912` — el 0x1912 de la prosa vieja era la
  lectura INGENUA del destino impreso (0xF912 con signo).
- `near_calls_to_kernel('TOWN.OVL', 0x7AE2)` → **[0x13cf]** (único call de TOWN a ese
  kernel), `overlay_near_call_base(TOWN)` = 0x81d0.
- Kernel 0x7AE2: stub PLINK, far-call al gestor de overlays (seg `0x72e`, off `0x2ec`), + dato `11 00` (overlay 17 = TALK.OVL)
  + `ljmp 0:0xC29E`; base TALK 0xBF80 ⇒ 0xC29E − 0xBF80 = **TALK 0x031E**
  (`talk_converse_dispatch`, IDENT en frontier.json).

## §2 — TALK 0x031E leído ENTERO (0x031E–0x0418, ret 2)

Prologo: imprime `\n`; npcIdx=[bp+4] → `[0xbcdc]`; rt = 0x5f5e+idx·16; sched =
0x5d5e+idx·16.

- 0x0348-0x0354: si el byte de aiType (sched + [rt+0xe]) == 4 → lo normaliza a 1 y
  entra al despacho SIN pasar la guarda de guardia mudo.
- 0x036a-0x0387 (sólo aiType≠4): obj = [rt+0xc]·8; **si tile del objeto
  ([obj+0x5c5a]) == 0x70 (guardia) y (bit0 de [rt+0xe] LIMPIO o dlgNum==0) →
  «The guard offers no response!» (DS 0x9148), ret 0.** ⚠ La glosa del frontier
  («bit 1 de rt+0xe → no response») tiene la polaridad AL REVÉS: el `test [bx+0xe],1 /
  je 0x387`, manda a mudo con el bit LIMPIO.
- 0x0357-0x0362: dlgNum=[rt+0xa]; 0 → «No response!» (0x9168), ret 0.
- 0x0396: dlgNum<0x80 → run_scripted_conversation, `0x127e`, → **ret 0 SIEMPRE** (0x3a3 →
  0x38e `sub ax,ax`).
- 0xFD → «Don't hurt me!...» ret 0 · 0xFE → far 0xbb02 ret 0 · **0xFF → `call 0x1e2`
  y 0x03e2 `jmp 0x414` SIN pasar por 0x38e: es LA ÚNICA RAMA que propaga el retorno
  del hijo.** ≥0x80 restantes → gate horario (destino impreso 0xbbb6, resuelto con la
  base de TALK, `0xbf80`, = CS 0x7B36) → tienda o «Come see me
  at my shoppe...».

## §3 — Consecuencia mecánica: la cadena de intercepción EJECUTA el diálogo de demanda

`TOWN 0x1352` (npc_engine per-NPC; su caller, `0x1683`, empuja `result−1`):

- `result==2` ⇒ arg 1 ≠ 0 ⇒ `jne 0x13d6` ⇒ **directo a 0x12ae** (captura/arresto) sin
  tocar TALK.
- `result==1` ⇒ arg 0, y con `[0x65bf]` armado (fast-path NPC.OVL 0x06E4,
  manhattan==1) y dlgNum≠0 (`[idx·16+0x5f68]` = rt+0xa) ⇒ `call TALK 0x031E(idx)`
  ⇒ para un guardia (dlgNum 0xFF) corre **`0x1e2`, guard_demand,** y si devuelve ≠0 ⇒
  0x12ae.

`TALK 0x1e2` (leído; los exits, verificados):
- ret 1 (escalada → captura/arresto): Palacio sin insignia, `0x2a4`, → `jmp 0x216` =
  `mov ax,1/ret`, SILENCIOSO), password erróneo, `0x2ef`, tributo rehusado, `0x28d`, o
  impagable, `0x297`, y Minoc rehusado, `0x214`.
- ret 0 (sin captura): password correcto («Pass, friend!» 0x913a → `jmp 0x22b`
  `sub ax,ax`), tributo pagado, `0x29d`→`0x228`, y Minoc pagado, `0x21c`.

⇒ **Tres cierres estáticos:**

1. **La pregunta abierta de `witness-insignia.md` («¿0x1912 chequea
   g_time_spell==0x1d?») queda respondida SIN oráculo: SÍ.** La vía de captura pasa
   por el gate de la insignia (TALK 0x2a4). Sin insignia: ret 1 silencioso → captura.
   Con insignia: EL RETO DE PASSWORD SE EJECUTA EN LA INTERCEPCIÓN (getstring 0x7b9c
   incluido); IMPE → ret 0, sin captura ese turno; error → captura.
2. **En el binario NO HAY PASE PERSISTENTE.** Ningún flag se escribe en la vía del
   password: «Pass, friend!» sólo devuelve 0 para ESA interacción. El
   `blackthornPassGranted` persistente del port es un MODELO del clon (ya declarado
   Clase C §3 en deliberate-divergences), ahora contrastable: el original re-reta en
   cada intercepción.
3. **El «limitador de tasa interno de 0x1912» NO EXISTE.** Ni 0x031E ni 0x1e2
   contienen contador/flag alguno. La rareza de la demanda en el corpus de LPs hay
   que buscarla en el PRODUCTOR de `result` (la escritura de 0x159a, el armado de
   `[0x65bf]` y el marcador `[0x65be]` 0x61/0x74) — no dentro del handler.

## §4 — Efectos sobre la cola y los testigos

- `lote-D-oraculo.md` B1 («BP 0x1912 con guardias; volcar condición») — el OBJETIVO
  tal como está formulado se DISUELVE: el gate interno que el BP iba a buscar no
  existe. Si se quiere seguir la rareza de la demanda, el BP útil es sobre el
  productor de `result` (TOWN 0x159a) y `[0x65bf]`, no sobre el handler.
- `PENDIENTES-USUARIO.md` 4e (savestate del Palacio para el witness de la insignia) —
  RETIRABLE: la pregunta se respondió estáticamente (§3.1).
- El testigo DOSBox de `oracle-blackthorn.md` queda EXPLICADO, no contradicho:
  marker=0x74, result==1, captura disparó ⇒ el guardia corrió 0x1e2 sin insignia
  puesta ⇒ ret 1 ⇒ 0x12ae. Coherente byte a byte con §3.
- La suficiencia de la adyacencia (F1.7-T5) ya estaba B-RUNTIME por ese testigo; las
  declaraciones «Clase C / depende del handler opaco» que sobreviven en prosa quedan
  RANCIAS y se corrigen en el barrido de esta acta.

## §5 — Divergencias del PORT destapadas (tarjetas nuevas, no fix en caliente)

- **T-A (insignia en la intercepción):** el port captura por adyacencia sin consultar
  `wornBadge`; el binario, con la insignia puesta, RETA con el password en la
  intercepción y el acierto evita la captura. El port sólo reta vía (T)alk.
- **T-B (pase persistente):** el port modela `blackthornPassGranted` permanente; el
  binario re-reta en cada intercepción. Decidir el calcado (retar cada vez) y el
  destino del flag.
- **T-C (tributo):** el sistema de demanda/arresto del port está APARCADO
  (`enabled=false`, fallback (d)) esperando un «limitador interno» que no existe. El
  desbloqueo real es derivar el productor de `result==1` para los guardias de tributo.

## §6 — Barrido de prosa (censo por CONTENIDO de `0x1912`)

Población: ~45 líneas en ~25 ficheros tracked (git grep -in 0x1912, homónimos ajenos
excluidos: `combat-use-potions.md:104` y `routine-census.json` llevan un 0x1912 de otra
cosa y NO se tocan). El barrido sustituye «handler opaco 0x1912 (fuera de TOWN.OVL)»
por la cadena resuelta «TOWN 0x13cf → kernel 0x7AE2 (PLINK) → TALK 0x031E
talk_converse_dispatch → (guardias) TALK 0x1e2», y des-rancia las Clase C de
suficiencia ya graduadas B-RUNTIME. Los registros históricos (actas de testigos,
auditorías, handoffs) se ANOTAN con banner fechado, no se reescriben.
