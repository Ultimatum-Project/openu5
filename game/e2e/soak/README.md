# Soak test — bot jugador autónomo (soak-es.mjs)

Bot que juega solo contra un dev server durante `--minutes`, con acciones
semialeatorias conscientes del modo (overworld/pueblo/combate/mazmorra/panel),
chequeos de invariantes tras cada acción y el detector del **PILAR ESPAÑOL**
(escanea la consola buscando inglés bajo `lang=es`, tiers HARD/SOFT).
Anomalías → JSONL + screenshot en este directorio (gitignored).

```bash
# dev server PROPIO corriendo (jamás el 5199 del usuario — CLAUDE.md REGLA 3):
#   cd game && npx vite --port 5263
U5_SOAK_URL=http://localhost:5263/ node game/e2e/soak/soak-es.mjs --minutes 30 --seed 1234
node game/e2e/soak/soak-es.mjs --minutes 30 --headed          # con ventana visible
node game/e2e/soak/soak-es.mjs --minutes 30 --dungeon 33,34,37 # modo mazmorra dirigido
```

- Conduce la piel FIEL (canvas) por los hooks `__u5test` (worldReady/consoleLines/
  dialogueOpen/shopOpen/state) — la piel dev y su DOM se jubilaron en la fase 2.
- Acciones: mover, Look/Get/Open/Search/Klimb/Talk, paneles, F5 save, combate
  consciente de victoria-no-cierra (salida por el borde + botín con contabilidad),
  mazmorra 3D (In Lor, fosos, cofres con contabilidad, Des Por, salas de combate,
  camp, View gem) y "viajes" por deep-link (lista TRAVEL).
- Detecta: errores JS/página, HTTP≥400, invariantes de estado, reloj congelado,
  posición atascada, combate-que-no-acaba, cofre-que-no-abre, botín descuadrado,
  y las fugas de INGLÉS bajo ES (EN_TEXT en el JSONL).
- **Exit code 2 si hubo anomalías O fugas HARD de inglés** (guarda G4; las SOFT
  son señal de triage). El detector lleva **heartbeat** (guarda G5): un run con
  acciones y cero líneas escaneadas = anomalía `scan-dead`, nunca verde en falso.
- La seed hace la SECUENCIA DE ACCIONES reproducible. Hallazgos triageados en
  `docs/qa/soak-2026-07-19.md` y `docs/superpowers/specs/2026-07-11-soak-findings.md`.

## soak.mjs (histórico) — JUBILADO

El bot original (2026-07-11) conducía la piel dev (DOM), retirada en la fase 2,
y su default era el puerto 5199 (el dev server del usuario). Hoy es un stub
fail-fast que sale con exit 1 apuntando a `soak-es.mjs` (auditoría G11).
