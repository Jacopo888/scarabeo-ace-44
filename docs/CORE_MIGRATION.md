# Migrazione al Core a Matrice (Completata Steps 1–11)

Questa nota documenta la semplificazione della board e del piazzamento mosse verso un modello minimale e deterministico basato su una matrice 15×15, con funzioni pure per validazione, scanning e calcolo punteggio.

## Obiettivi
- Board come matrice `(PlacedTile | null)[][]` con `BOARD_SIZE=15` e centro a `7,7` (0‑based).
- Mosse come semplici array di `PlacedTile` (coordinate 0‑based).
- Scanning lineare (orizzontale/verticale) per parola principale e croci.
- Punteggio consistente: moltiplicatori applicati solo alle nuove tessere, bingo +50.
- Eliminazione dei moduli legacy duplicativi.

## Moduli chiave
- `src/core/board.ts`
  - API: `createEmptyBoard`, `canPlace`, `applyMove`, `scanMainLine`, `scanCrossWords`, `scoreMove`.
  - Fonte dei moltiplicatori: `src/config/boardConstants.ts`.
- `src/core/adapters.ts`
  - `mapToBoard` ↔ converte `Map<string, PlacedTile>` → matrice.
  - `boardToMap` ↔ matrice → `Map`.
- `src/core/confirmDeps.ts`
  - `makeCoreConfirmDeps(isValidWord)` espone `validateMoveLogic` e `findNewWordsFormed` per la conferma mossa.
- `src/utils/scoring.ts`
  - `calculateScore()` delega al core (`scoreMove`) tramite `mapToBoard`.

## Integrazione UI/State
- `GameState.boardMatrix` è ora la fonte unica di verità runtime.
- Persistenza DB ancora in formato record `"r,c" -> tile`; conversione → matrice eseguita in `buildGameState`.
- Eventuali percorsi che costruivano `Map` transitorie sono stati eliminati (es. `useMultiplayerGame.submitMove`).
- `AnyBoard` nei test mantiene un singolo caso di compatibilità ma non viene più usato in flussi di produzione.

## Conferma mossa
- `applyConfirmMove` usa deps core (`makeCoreConfirmDeps`) per validazione e parole; punteggio via `calculateScore`.

## Integrazione Quackle (Step 6)
- Payload board: `buildQuackleBoard()` produce mappa 0-based `"r,c" -> {letter,isBlank}`.
- Rack: `formatRackStringForQuackle()` (stringa) o `formatRackForQuackle()`.
- Punteggio mosse Quackle: ricalcolato localmente con `calculateScore()` per coerenza con i moltiplicatori.

## Rimozione legacy
- Rimossi (definitivo): wrapper Map e scanner duplicati
  - `src/utils/wordFinder.ts`
  - `src/utils/newWordFinder.ts` (wrapper) — mantenuto solo `newWordFinder/scan.ts` come implementazione di basso livello nota ai test.
  - Adapter superflui o shim di validazione pre-matrice.
- Tutti i call‑site migrati a: `makeCoreConfirmDeps` + funzioni pure in `core/board.ts`.
- Eliminato uso della `Map` in `useMultiplayerGame.submitMove`.

## Test
- Core: `src/core/board.test.ts`, `src/core/board.integration.test.ts`, `src/core/confirmDeps.test.ts`.
- Quackle payload: `src/hooks/useQuackle.payload.test.ts`.
- Suite completa verde.

## Invarianti Aggiunti (Step 11)
- `board.invariants.test.ts`: immutabilità `setBoardTile`, correttezza `buildQuackleBoard`, coerenza scoring.

## Stato Finale
- Tutta la logica e i test usano solo `boardMatrix`.
- Nessun percorso di produzione dipende da `Map` come struttura board primaria.
- Wrapper legacy completamente eliminati.
- Suite test: 100% verde dopo rimozione wrapper (57 file / 168 test passati + 1 skipped al momento della migrazione finale).

## Prossimi passi (facoltativi)
- Rimuovere eventuale ultimo test di compat Map da `board.test.ts` se si desidera enforcement totale.
- Introdurre property-based tests per `scoreMove` / generatori di mosse.
- Aggiornare eventuali ADR per riflettere stato finale (se non già fatto).
