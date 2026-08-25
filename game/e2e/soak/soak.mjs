#!/usr/bin/env node
// ARNÉS JUBILADO (auditoría de calidad G11) — usa soak-es.mjs.
//
// Este era el soak histórico (2026-07-11) que conducía la piel DEV, jubilada en
// la fase 2: su espera de `.title-screen`/`.hud-clock` (DOM sólo-dev) ya no
// existe y el bot COLGABA ~20 s por acción. Peor: su default apuntaba al puerto
// 5199 — el dev server PROTEGIDO del usuario (CLAUDE.md REGLA 3) — así que un
// lanzamiento por error quemaba una ventana de medición contra el server vivo.
//
// El sucesor es `soak-es.mjs` (misma carpeta): conduce la piel FIEL por los
// hooks `__u5test`, incluye el detector del PILAR ESPAÑOL con exit code real
// (G4), heartbeat del detector (G5), modo mazmorra dirigido y contabilidad de
// botín. Default: puerto propio 5263 (jamás el 5199).
//
//   node game/e2e/soak/soak-es.mjs --minutes 30 [--seed N] [--headed] [--dungeon 33,34,37]
//
// Fail-fast deliberado: nada de este arnés debe ejecutarse ya.
console.error("[soak.mjs] ARNÉS JUBILADO (G11): la piel dev que conducía ya no existe");
console.error("[soak.mjs] y su default (5199) era el dev server del usuario (REGLA 3).");
console.error("[soak.mjs] Usa el sucesor:  node game/e2e/soak/soak-es.mjs --minutes 30");
process.exit(1);
