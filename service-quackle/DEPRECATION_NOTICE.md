# Deprecation Notice – service-quackle

Questo servizio è stato sostituito da `service-quackle-min/`.

Motivazioni:
1. Ridurre complessità di normalizzazione board/rack.
2. Eliminare endpoint non essenziali (`debug/*`, `bag/summary`, ecc.).
3. Avere un wrapper subprocess semplice e deterministico.

Azioni future:
- Non introdurre nuove dipendenze.
- Reindirizzare la documentazione verso `service-quackle-min/README.md`.
- Rimuovere questa directory dopo il completamento della checklist in `service-quackle-min/CUTOVER.md`.

Data deprecazione iniziale: 2025-10-08