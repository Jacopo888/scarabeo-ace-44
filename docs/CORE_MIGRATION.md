# Migrazione al Core a Matrice (Steps 1–6)

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
- `GameState.board`: resta una `Map<string, PlacedTile>` per compat UI/DB, ma il core lavora su matrice via adapter.
- `ScrabbleBoard` e helper UI accettano anche la matrice (tipo `AnyBoard`).

## Conferma mossa
- `applyConfirmMove` usa deps core (`makeCoreConfirmDeps`) per validazione e parole; punteggio via `calculateScore`.

## Integrazione Quackle (Step 6)
- Payload board: `buildQuackleBoard()` produce mappa 1‑based `"r,c" → {letter,isBlank}`.
- Rack: `formatRackStringForQuackle()` (stringa) o `formatRackForQuackle()`.
- Punteggio mosse Quackle: ricalcolato localmente con `calculateScore()` per coerenza con i moltiplicatori.

## Rimozione legacy
- Rimossi: `src/utils/moveValidation*`, `src/utils/newWordFinder*`, `src/utils/wordFinder.ts`.
- Tutti i call‑site sostituiti/adeguati.

## Test
- Core: `src/core/board.test.ts`, `src/core/board.integration.test.ts`, `src/core/confirmDeps.test.ts`.
- Quackle payload: `src/hooks/useQuackle.payload.test.ts`.
- Suite completa verde.

## Prossimi passi (Step 7)
- Migrare il `GameState.board` a matrice in due fasi:
  1. Aggiungere `boardMatrix` in `GameState` + adapter trasparenti per UI/DB; 
  2. Spostare gradualmente tutti i consumer a `boardMatrix` e rimuovere `board` Map.
- Aggiornare i test per usare direttamente la matrice dove possibile.
