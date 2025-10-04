# Roadmap Integrazione Quackle & Cleanup

Aggiornato: 2025-10-04

## Obiettivo generale
Snellire e modernizzare l'integrazione dell'engine Quackle eliminando il wrapper legacy (`engine/`), riducendo i formati di input supportati ad uno solo canonico (mappa 1‑based "r,c" -> { letter, isBlank }), semplificando il payload (derivare `bag_count` da `bag_pool`), limitando la superficie di debug in produzione e predisponendo la futura unificazione del calcolo punteggio (feature flag per affidarsi al punteggio del servizio senza ricalcolo frontend).

## Stato sintetico
| Stato | Task |
|-------|------|
| ✅ | Rimozione directory `engine/` (commit d13662a) |
| ✅ | Snellimento payload: `bag_count` derivato da `bag_pool`; rimosso lato client |
| ✅ | Rimozione campi obsoleti `board_schema` e `bag_count` dal payload frontend |
| ✅ | Gating endpoint debug in produzione (`DEBUG_ROUTES` + `ENV_MODE`) |
| ✅ | Merge branch di cleanup nel `main` |
| ✅ | Riparazione ref git remoto corrotto |
| ✅ | Restringere formati input board al solo coord map 1‑based |
| ✅ | Adeguare test service al nuovo unico formato + test negativi |
| 🔄 | Feature flag `VITE_USE_SERVICE_SCORE` + log comparativo |

Legenda: ✅ completato · 🔄 in corso · ⏳ da fare

## Dettagli dei task
### 1. Rimozione wrapper legacy `engine/` ✅
- Eliminati tutti i file (Dockerfile, wrapper C++, script, lessico duplicato) nel merge commit `d13662a`.
- Aggiornata documentazione per indicare il microservizio FastAPI come unica fonte.

### 2. Snellimento payload AI ✅
- Lato servizio (`routes_best_move.py`): se arriva `bag_pool` si calcola `bag_count = len(bag_pool)` e non è più necessario inviarlo dal client.
- Lato frontend (`useQuackle.ts`): rimosse le proprietà `bag_count` e `board_schema` dal payload inviato (schema unico implicito).
- Variabile env `VITE_BOARD_SCHEMA` considerata deprecata: ignorata dal codice e candidabile a rimozione da `.env.example` in un passaggio successivo.

### 3. Gating endpoint di debug ✅
- In `main.py` montaggio condizionale delle route /debug solo se `DEBUG_ROUTES=true` oppure ambiente non-prod.

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
