# Cutover service-quackle → service-quackle-min

Obiettivo: sostituire il vecchio servizio senza downtime e senza cambiare il contratto consumato dal frontend (se non per host base).

## Principi
1. Zero fallback: se engine non pronto deve emergere (lexicon_not_ready).
2. Nessun cambiamento nel formato mosse già consumato dal frontend (coordinate 0-based, pass-through raw incluso).
3. Log e metriche (se presenti) rimangono lato infrastruttura; il servizio nuovo resta minimale.

## Fasi
### Fase 0 – Preparazione
- Build immagine `service-quackle-min` e pubblicazione in registry.
- Verifica manuale smoke locale (script `scripts/smoke_quackle_min.sh`).

### Fase 1 – Deploy Parallelo
- Avviare nuovo servizio su host/porta separati (es: quackle-min.internal:8000).
- Impostare variabili identiche: QUACKLE_LEXDIR, QUACKLE_LEXICON, QUACKLE_TIMEOUT_MS, QUACKLE_STRATEGY_DIR.
- Caricare stessi file lessico e strategia.

### Fase 2 – Test Staging
- Puntare staging frontend a nuovo URL (variabile `VITE_QUACKLE_SERVICE_URL`).
- Eseguire regression manuale: rack noti, mosse lunghe, exchange, pass.
- Confrontare tempi medi di risposta rispetto al legacy (±10%).

### Fase 3 – Canary Production
- In produzione introdurre env override per una % limitata di utenti (feature flag reverse proxy) per 1–2 ore.
- Monitorare errori 5xx specifici (`engine_error`, `timeout`).

### Fase 4 – Full Switch
- Aggiornare definitivamente `VITE_QUACKLE_SERVICE_URL` prod.
- Continuare monitor 24h. Se nessun picco anomalo di 5xx → procedere.

### Fase 5 – Decommission Legacy
- Spegnere vecchio container service-quackle.
- Rimuovere riferimenti in docker-compose / infra.
- Aggiornare documentazione root e README principale.
- Tag release (es: quackle-min-v1.0.0).

## Rollback Strategy
- Mantenere immagine legacy per 48h: rollback = ripristinare variabile URL e riavviare frontend.

## Checklist Cutover
- [ ] Immagine quackle-min pubblicata
- [ ] Smoke script OK in staging
- [ ] Canary completato senza error spike
- [ ] Full switch completato
- [ ] Legacy spento
- [ ] Documentazione aggiornata
- [ ] Tag release creato