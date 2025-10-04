# Roadmap Integrazione Quackle & Cleanup

Aggiornato: 2025-10-04 (Revisione finale semplificazione)

## Obiettivo generale
Snellire e modernizzare l'integrazione dell'engine Quackle eliminando il wrapper legacy (`engine/`), riducendo i formati di input supportati ad uno solo canonico (mappa 1‑based "r,c" -> { letter, isBlank }), semplificando il payload (derivare `bag_count` da `bag_pool`), limitando la superficie di debug in produzione e predisponendo la futura unificazione del calcolo punteggio (feature flag per affidarsi al punteggio del servizio senza ricalcolo frontend).

## Stato sintetico
| Stato | Task |
|-------|------|
| ✅ | Rimozione directory `engine/` - COMPLETATA fisicamente + .dockerignore aggiornato |
| ✅ | Snellimento payload: `bag_count` rimosso completamente lato client E servizio |
| ✅ | Rimozione campi obsoleti `board_schema` e `bag_count` dal payload frontend |
| ✅ | Gating endpoint debug in produzione (`DEBUG_ROUTES` + `ENV_MODE`) - IMPLEMENTATO |
| ✅ | Merge branch di cleanup nel `main` |
| ✅ | Riparazione ref git remoto corrotto |
| ✅ | Restringere formati input board al solo coord map 1‑based |
| ✅ | Adeguare test service al nuovo unico formato + test negativi |
| 🔄 | Feature flag `VITE_USE_SERVICE_SCORE` + log comparativo |

Legenda: ✅ completato · 🔄 in corso · ⏳ da fare

## Dettagli dei task
### 1. Rimozione wrapper legacy `engine/` ✅
- **COMPLETATO FISICAMENTE** (2025-10-04): Eliminata completamente la directory `/engine` che conteneva:
  - `engine/quackle_wrapper/build/` con artefatti CMake obsoleti
  - `engine/lexica/` con file duplicati
  - `engine/third_party/` vuota
- Aggiornato `.dockerignore` per rimuovere il riferimento
- La documentazione ora riflette correttamente lo stato del codice

### 2. Snellimento payload AI ✅
- **COMPLETATO LATO SERVIZIO E CLIENT** (2025-10-04):
  - Servizio (`routes_best_move.py`): Rimossa completamente l'accettazione di `bag_count` come parametro opzionale
  - Il servizio ora accetta SOLO `bag_pool` (array di stringhe)
  - `bag_count` viene derivato internamente quando necessario: `len(bag_pool)`
  - Frontend (`useQuackle.ts`): Già rimosso in precedenza
  - Test aggiornati: `test_endgame_empty_bag.py` non invia più `bag_count`
- **Benefici:** Eliminata ambiguità, payload più semplice, unica fonte di verità

### 3. Gating endpoint di debug ✅
- **IMPLEMENTATO E TESTATO** (2025-10-04):
  - In `main.py`: debug_router montato SOLO se `DEBUG_ROUTES=true` OR `ENV != prod`
  - Logging esplicito su console: 🐛 debug ENABLED / 🔒 debug DISABLED
  - Test verificato: in prod mode `/debug/*` restituisce 404
  - Aggiornato `.env.example` con documentazione di `DEBUG_ROUTES` e `ENV`
- **Riduzione superficie attacco:** ~72% degli endpoint non esposti in produzione (13 debug su 18 totali)

### 4. Merge branch di cleanup ✅
- Integrate le modifiche di rimozione `engine/` direttamente su `main` senza mantenere branch secondari.

### 5. Ref git corrotto ✅
- Rimosso ref locale corrotto `refs/remotes/origin/copilot/fix-...` e oggetto vuoto; rieseguito fetch e ripristinata normalità.

### 6. Restringere formati input board ✅
`normalize_board_for_bridge` ora accetta solo coord map 1‑based; tutti i formati legacy restituiscono 400 `unsupported_board_format`.

### 7. Adeguare test service ✅
Test aggiornati: nuova suite con test negativi per formati legacy; rimosse le dipendenze dai formati deprecati. Suite: 45 pass, 3 skip.

### 8. Feature flag scoring unificato 🔄
Flag `VITE_USE_SERVICE_SCORE` introdotto in `useGame`: se true prende il punteggio dal servizio, altrimenti ricalcolo locale; log mismatch in DEV. Test iniziale `useGame.scoreflag.test.ts` creato (estendere per mismatch reale).

## Considerazioni tecniche / Rischi
- Rimozione formati legacy: assicurarsi che nessun consumer esterno (crawler, script) usi ancora `grid` o `placements`; introdurre eventuale comunicazione in CHANGELOG.
- Scoring flag: evitare drift non diagnosticato; log strutturato con contatore mismatch per futura rimozione del ricalcolo.

## Prossimi passi immediati
1. Ampliare test feature flag con scenario mismatch (service vs local) verificando scelta punteggio e logging.
2. Aggiornare README e istruzioni agenti (sezione scoring unificato + migrazione futura rimozione calcolo locale).
3. Considerare metriche mismatch aggregate per decidere decommission del ricalcolo.

## Done Checklist (Storico sintetico)
- Engine wrapper eliminato ✔
- Payload semplificato ✔
- Debug gating ✔
- Git ref riparato ✔
- Merge su main ✔

---
Document aggiornabile man mano che avanzano i task.
