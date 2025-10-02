# Score: stato attuale e guida

Questo documento descrive, in modo conciso e operativo, l’unico sistema di calcolo del punteggio usato nel progetto. Niente storia, niente alternative: solo ciò che è attivo oggi.

## Fonte unica di verità

- Calcolatore: `src/utils/scoring.ts` espone `calculateScore({ tiles, existingBoard, context? })`.
- Board constants: `src/config/boardConstants.ts` contiene `SPECIAL_SQUARES` e gli helper (incluso STAR=DW). L’UI può re‑esportare, ma il calcolo importa solo da qui.

## Regole implementate (Scrabble standard)

- Moltiplicatori si applicano solo alle tessere nuove del turno.
- Parola principale: somma dei valori lettera (con DL/TL sulle nuove), poi moltiplicatori di parola (DW/TW) derivati solo dalle nuove.
- Cross‑words: per ogni nuova tessera, se forma una parola perpendicolare con tessere esistenti, la si calcola separatamente con i moltiplicatori della sola tessera nuova coinvolta.
- Bingo: +50 punti quando si usano esattamente 7 tessere nel turno.
- Casella centrale (STAR, 7,7): vale come DW.

Per dettagli di regola consultare `docs/SCORING_RULES.md`.

## API in breve

Signature:
`calculateScore({ tiles, existingBoard, context?: 'player' | 'quackle' }): number`

Contratto essenziale:
- Input
  - `tiles`: elenco delle tessere appena posizionate, con coordinate 0‑based e proprietà `{row, col, letter, points, isBlank}`.
  - `existingBoard`: mappa `"r,c" -> PlacedTile` dello stato prima della mossa.
- Output
  - Intero: punteggio totale del turno (parola principale + cross‑words + bingo).
- Errori/edge
  - Array vuoto → 0. Tessera singola gestita correttamente. Moltiplicatori mai applicati a tessere già presenti.

## Integrazione tipica

Esempi d’uso nei flussi principali:

- Mossa giocatore: chiamare `calculateScore({ tiles: pendingTiles, existingBoard: boardMap, context: 'player' })`.
- Mossa Quackle: stessa funzione con `context: 'quackle'`. Le coordinate sono già 0‑based e non richiedono offset.

## Test che tutelano il comportamento

Copriamo i casi base in `src/utils/quackleScoreRecalc.test.ts` e `src/utils/scoring.test.ts`:
- Centro DW (JIN → 20), TW, DL/TL.
- Niente moltiplicatori su tessere preesistenti.
- Bingo +50.
- Array vuoto e blank tiles.

Se aggiungi nuove regole o correzioni, estendi i test esistenti o aggiungi casi mirati vicino ai file.

## Guardrail e convenzioni

- Usa sempre e solo `calculateScore` per il calcolo del punteggio; non duplicare logica né constants.
- I moltiplicatori provengono esclusivamente da `src/config/boardConstants.ts`.
- Non introdurre fallback o “stubs” per le mosse Quackle: se l’input non è valido, i servizi devono fallire esplicitamente.

## Note finali

L’obiettivo è mantenere il sistema deterministico, semplice e verificabile. Ogni modifica al calcolo o ai constants deve essere accompagnata da test e da un aggiornamento minimo di questa pagina e di `docs/SCORING_RULES.md`.
