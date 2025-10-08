# TODO – service-quackle-min (Build & Deploy Plan)

Obiettivo: Servizio minimale e deterministico che espone Quackle (modalità strategia completa) via due endpoint: /health e /best-move.

---
## Step 1 – Wrapper C++ (COMPLETATO)
Target: `quackle_json_wrapper`
Azioni:
1. Compilare con CMake (libquackle + json_wrapper_main.cpp).
2. Validare eseguibile: echo '{"op":"best_move","rack":"AEIRSTZ","board":{},"lexicon":"enable1.15","strategies":true}' | ./quackle_json_wrapper
3. Output JSON deve avere: status=ok e move_type (play/pass/exchange).
Note: Parser JSON minimale → assumiamo input ben formato.

## Step 2 – Strategie “Champions” (COMPLETATO)
Supporto variabile `QUACKLE_STRATEGY_DIR` nel wrapper:
- Se settata, verifica i file richiesti:
	- default_english/syn2
	- default_english/vcplace
	- default_english/superleaves
	- default_english/worths
	- default/bogowin
- In caso mancanze -> status=error, error=strategy_missing:lista.
Note: README aggiornato; test wrapper presenti (skip se risorse mancanti).

## Step 3 – Lessico
1. Richiedere presenza file: $QUACKLE_LEXDIR/$QUACKLE_LEXICON.dawg + .gaddag.
2. /health deve mostrare engine_ready=true solo se entrambi i file esistono e >0 byte e il binario è eseguibile.
3. In caso mancanza: /best-move → 500 {"error":"lexicon_not_ready"}.
4. (Opzionale) Script bootstrap: scarica da DAWG_URL / GADDAG_URL se mancanti (solo in fase build o entrypoint).

## Step 4 – Validazioni Input
1. rack: lunghezza 0..7, caratteri A-Z o '?'.
2. board: coord map 0-based, max 225 entry, coordinate 0..14.
3. Rifiutare qualsiasi altro formato con 400 {"error":"invalid_input"}.

## Step 5 – Error Handling Minimo
Mapping:
- Timeout subprocess → 504 {"error":"timeout"}
- rc != 0 oppure status != ok → 500 {"error":"engine_error"}
- Lessico assente → 500 {"error":"lexicon_not_ready"}
- Input invalido → 400 {"error":"invalid_input"}
Niente fallback o mosse sintetiche.

## Step 6 – Test End-to-End
Unit:
- /health shape.
- Input board invalido.
Integration (se binario presente):
- Board vuota + rack AEIRSTZ → move_type in {play,pass,exchange}.
- Timeout simulation: usare TIMEOUT_MS molto basso e rack grande (se necessario) → 504.

## Step 7 – Docker Multi-Stage
Fasi:
1. build-base: install build-essential, cmake; compila quackle_json_wrapper.
2. bundle-lexicon: copia (o scarica) enable1.15.* in /data/lexica.
3. runtime: python:3.12-slim → copia binario + lessici + strategie + codice FastAPI.
4. Utente non-root (opzionale) per sicurezza.
Healthcheck: `CMD curl -fsS http://localhost:8000/health || exit 1`.

## Step 8 – Heroku Deploy
1. Usare container registry (heroku.yml) oppure Dockerfile + heroku stack container.
2. Procfile: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Config Vars: QUACKLE_LEXDIR, QUACKLE_LEXICON (enable1.15), QUACKLE_TIMEOUT_MS.

## Step 9 – Sicurezza & Limiti (COMPLETATO)
Implementati: MAX_BODY_LEN ~32KB, board <=225, validazione anticipata.

## Step 10 – Script Smoke CI (DA FARE)
File: scripts/smoke_quackle.sh
Esegue:
1. curl /health → engine_ready
2. curl /best-move con rack AEIRSTZ board vuota → status 200
Exit !=0 se fallisce.

## Step 11 – Cutover (IN PROGRESS)
Vedi `CUTOVER.md` per il piano dettagliato.
1. Deploy parallelo nuovo endpoint (URL diverso).
2. Aggiornare frontend env VITE_QUACKLE_SERVICE_URL.
3. Monitorare error rate / tempi risposta.
4. Spegnere vecchio service-quackle dopo 24h stabile.

## Step 12 – Pulizia (PARZIALE)
Marcata deprecazione nel vecchio `service-quackle` (README aggiornato + DEPRECATION_NOTICE). Resta: rimozione directory post cutover definitivo.
1. Rimuovere directory legacy service-quackle.
2. Aggiornare documentazione root e README principale.
3. Aggiornare docker-compose se referenzia vecchio servizio.

## Step 13 – Futuri Miglioramenti (non ora)
- Metrics Prometheus / p95 latenza.
- Cache mossa (board+rack hash) con TTL breve.
- pybind11 per ridurre overhead subprocess.
---

Checklist Rapida (aggiornata):
- [x] Compila binario wrapper
- [x] Lessici presenti in image (se montati / bootstrap)
- [x] Strategie incluse e caricate (se QUACKLE_STRATEGY_DIR)
- [x] Test unit + integrazione verdi / skip controllati
- [x] Docker build OK
- [ ] Smoke script passa
- [x] README aggiornato
- [ ] Cutover instructions pronte (parziale: presente CUTOVER.md, restano flag canary infra)
