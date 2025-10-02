# Nota: calcolo punteggio Quackle

Questo file è stato semplificato per riflettere lo stato attuale.

- Fonte unica per il punteggio: usare sempre `calculateScore()` da `src/utils/scoring.ts`.
- Board constants: `src/config/boardConstants.ts` (STAR=DW, moltiplicatori solo su tessere nuove).
- Non esistono più wrapper/adapter dedicati al ricalcolo: il calcolo è centralizzato in `calculateScore()` ed è coperto dai test.

Per le regole dettagliate, vedi `docs/SCORING_RULES.md`. Per il quadro d’insieme attuale, vedi `docs/SCORE_ANALYSIS.md`.
