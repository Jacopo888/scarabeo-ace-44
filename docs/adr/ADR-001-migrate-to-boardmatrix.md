# ADR-001: Migrazione Completa a `boardMatrix` (15×15 Array)

**Status:** ✅ Accepted  
**Date:** 2025-01-04  
**Deciders:** Team Scarabeo-ACE  
**Context:** Post-refactoring scoring fix

---

## Contesto e Problema

Attualmente `GameState` mantiene **due rappresentazioni** della scacchiera:

```typescript
interface GameState {
  board: Map<string, PlacedTile>          // Legacy: "row,col" → tile
  boardMatrix: (PlacedTile | null)[][]    // Nuovo: matrice 15×15
  // ...
}
```

### Problemi Identificati

1. **Duplicazione logica:**
   - Ogni update richiede sincronizzazione di entrambe le strutture
   - `applyConfirmMove`, `applyBotMove` devono aggiornare sia Map che Matrix
   - Rischio di inconsistenza tra le due rappresentazioni

2. **Performance overhead:**
   - Conversioni continue `mapToBoard()` / `boardToMap()` nei percorsi critici
   - Iterazioni su Map inefficienti vs accesso diretto array

3. **Complessità codice:**
   - 23+ file usano `mapToBoard()` per conversioni
   - Logica condizionale: `gameState.boardMatrix || mapToBoard(gameState.board)`
   - Test duplicati per entrambe le rappresentazioni

4. **Debito tecnico:**
   - `Map<string, PlacedTile>` deriva da implementazione iniziale Supabase
   - Matrix introdotta per core scoring ma migrazione mai completata
   - Adapter layer (`core/adapters.ts`) necessario solo per backward compat

### Stato Attuale

**File che usano Map:**
- `src/hooks/useQuackle.ts` - iterazione su `board.forEach`
- `src/hooks/useGame.ts` - check occupancy con `snapshot.board.forEach`
- `src/lib/game/actionsPlace.ts` - `board.has(key)`
- `src/lib/game/actionsConfirm.ts` - `new Map(prev.board)`
- `src/lib/game/botMove.ts` - `new Map(prev.board)`
- `src/utils/wordFinder.ts`, `moveValidation.ts`, `gameRules.ts` - API legacy
- 15+ file di test con `new Map<string, PlacedTile>()`

**File che usano `mapToBoard`:**
- `src/pages/Game.tsx` - fallback UI
- `src/utils/scoring.ts` - conversione per core
- `src/core/confirmDeps.ts` - validazione
- `src/lib/multiplayer/state.ts` - init multiplayer

---

## Decisione

**Rimuovere completamente `GameState.board` Map e usare solo `boardMatrix`.**

### Motivazioni

1. **Single Source of Truth:** Una sola rappresentazione elimina sincronizzazione
2. **Performance:** Accesso diretto O(1) vs lookup Map
3. **Semplicità:** Eliminazione adapter layer e conversioni
4. **Allineamento Core:** Matrix è già usato da `core/board.ts` (scoring, validazione)
5. **Type Safety:** Array 15×15 è più type-safe di Map con chiavi string

---

## Implementazione

### Fase 1: Aggiornamento Types (BREAKING)

```typescript
// src/types/game.ts
interface GameState {
  // RIMOSSO: board: Map<string, PlacedTile>
  boardMatrix: (PlacedTile | null)[][]  // Rinominato da boardMatrix a board (opzionale)
  players: Player[]
  currentPlayerIndex: number
  tileBag: Tile[]
  gameStatus: GameStatus
  gameMode: GameMode
  passCounts: number[]
}
```

**Opzione naming:**
- **A)** Rinominare `boardMatrix` → `board` (breaking per tutti)
- **B)** Mantenere `boardMatrix` (meno breaking, più chiaro)

**Scelta:** Mantenere `boardMatrix` per chiarezza e ridurre breaking changes.

### Fase 2: Rimozione Map Operations

**Prima (Map):**
```typescript
const key = `${row},${col}`
if (prev.board.has(key)) return prev
const newBoard = new Map(prev.board)
newBoard.set(key, tile)
return { ...prev, board: newBoard }
```

**Dopo (Matrix):**
```typescript
if (prev.boardMatrix[row][col] !== null) return prev
const newMatrix = prev.boardMatrix.map(r => r.slice())
newMatrix[row][col] = tile
return { ...prev, boardMatrix: newMatrix }
```

### Fase 3: Eliminazione Conversioni

**File da rimuovere/svuotare:**
- `src/core/adapters.ts` - `mapToBoard`, `boardToMap` (deprecare)
- Tutti gli import di `mapToBoard` sostituiti con accesso diretto

**Helper da creare:**
```typescript
// src/core/board.ts
export function cloneBoardMatrix(board: Board): Board {
  return board.map(row => row.slice())
}

export function getBoardTile(board: Board, row: number, col: number): PlacedTile | null {
  if (!isInBounds(row, col)) return null
  return board[row][col]
}

export function setBoardTile(board: Board, row: number, col: number, tile: PlacedTile | null): Board {
  const next = cloneBoardMatrix(board)
  next[row][col] = tile
  return next
}
```

### Fase 4: Multiplayer/DB Serialization

**Supabase storage:**
```typescript
// Prima (Map serialization)
board_state: Object.fromEntries(gameState.board)

// Dopo (Matrix serialization)
board_state: {
  matrix: gameState.boardMatrix.map(row => 
    row.map(cell => cell ? { ...cell } : null)
  )
}
```

**Deserializzazione:**
```typescript
// Supportare sia legacy che nuovo formato
function deserializeBoardState(raw: any): Board {
  if (raw?.matrix) {
    return raw.matrix // Nuovo formato
  }
  // Fallback per partite salvate con Map (backward compat temporaneo)
  return legacyMapToMatrix(raw)
}
```

### Fase 5: Test Updates

**Pattern test vecchio:**
```typescript
const board = new Map<string, PlacedTile>()
board.set('7,7', { row: 7, col: 7, letter: 'A', points: 1 })
```

**Pattern test nuovo:**
```typescript
const board = createEmptyBoard() // from core/board.ts
board[7][7] = { row: 7, col: 7, letter: 'A', points: 1 }
```

---

## Conseguenze

### Positive

- ✅ **-300 LOC:** Eliminazione adapter layer e conversioni
- ✅ **+Performance:** Accesso diretto O(1) senza hash lookup
- ✅ **+Semplicità:** Una sola rappresentazione, meno bugs
- ✅ **+Type Safety:** Compilatore verifica bounds (con strict)
- ✅ **+Allineamento:** Tutti i moduli usano stessa struttura

### Negative

- ⚠️ **Breaking Change:** Richiede migrazione DB per partite salvate
- ⚠️ **Backward Compat:** Serve deserializer per formato Map legacy
- ⚠️ **Effort:** ~40 file da modificare, test estesi richiesti

### Mitigazioni

1. **Backward Compat Layer (temporaneo):**
   ```typescript
   function migrateGameState(old: any): GameState {
     if (old.boardMatrix) return old // Già migrato
     return {
       ...old,
       boardMatrix: legacyMapToMatrix(old.board)
     }
   }
   ```

2. **Feature Flag (opzionale):**
   ```typescript
   const USE_MATRIX_ONLY = import.meta.env.VITE_USE_MATRIX_BOARD !== 'false'
   ```

3. **Gradual Rollout:**
   - Deploy 1: Introdurre deserializer, doppio supporto
   - Deploy 2: Forzare Matrix su nuove partite
   - Deploy 3: Rimuovere backward compat (dopo 30gg)

---

## Piano Migrazione

### Step 1: Preparazione ✅
- [x] Analisi uso Map vs Matrix
- [x] Identificati 40+ file da modificare
- [x] ADR approvato

### Step 2: Core Changes (Fase 1)
- [ ] Update `src/types/game.ts` - rimuovere `board: Map`
- [ ] Update `src/lib/game/init.ts` - init solo `boardMatrix`
- [ ] Aggiungere helper `cloneBoardMatrix`, `setBoardTile` in `core/board.ts`

### Step 3: Actions & Hooks (Fase 2)
- [ ] `lib/game/actionsPlace.ts` - matrix check
- [ ] `lib/game/actionsConfirm.ts` - rimuovere `new Map`
- [ ] `lib/game/botMove.ts` - matrix update
- [ ] `hooks/useGame.ts` - rimuovere `board.forEach`
- [ ] `hooks/useQuackle.ts` - iterare su matrix

### Step 4: Utils & Validation (Fase 3)
- [ ] `utils/wordFinder.ts` - accettare Board invece di Map
- [ ] `utils/moveValidation.ts` - idem
- [ ] `utils/gameRules.ts` - idem
- [ ] `core/confirmDeps.ts` - rimuovere `mapToBoard`

### Step 5: UI & Multiplayer (Fase 4)
- [ ] `pages/Game.tsx` - usare `boardMatrix` diretto
- [ ] `pages/MultiplayerGame.tsx` - idem
- [ ] `lib/multiplayer/state.ts` - serializzazione Matrix
- [ ] `hooks/useMultiplayerGame.ts` - deserializzazione

### Step 6: Tests (Fase 5)
- [ ] Aggiornare 15+ test file con `createEmptyBoard()`
- [ ] Golden test per serializzazione/deserializzazione
- [ ] Integration test completo (local + multiplayer)

### Step 7: Cleanup (Fase 6)
- [ ] Rimuovere `mapToBoard` / `boardToMap` da `core/adapters.ts`
- [ ] Deprecare `calculateScore` (tenere solo `calculateScoreFromBoard`)
- [ ] Rimuovere backward compat layer (dopo grace period)

---

## Metriche Successo

- ✅ **0 errori compilazione TypeScript**
- ✅ **100% test passati** (nessun test skipppato)
- ✅ **<5% regressione performance** (benchmark scoring + validation)
- ✅ **Nessun bug critico in produzione** (grace period 7gg)

---

## Alternative Considerate

### A1: Mantenere entrambe le rappresentazioni
- ❌ Rifiutato: Debito tecnico permanente
- ❌ Rischio inconsistenza aumenta nel tempo

### A2: Usare Map ovunque (eliminare Matrix)
- ❌ Rifiutato: Core scoring richiede array per performance
- ❌ Performance loss su operazioni bulk (scan, validate)

### A3: Hybrid approach (Map in UI, Matrix in core)
- ❌ Rifiutato: Richiede adapter layer permanente
- ❌ Stato corrente, vogliamo eliminarlo

---

## Timeline

- **2025-01-04:** ADR creato e approvato
- **2025-01-04:** Implementazione Fase 1-3 (core + actions)
- **2025-01-04:** Test e validazione
- **2025-01-05:** Review finale e merge
- **2025-01-06:** Deploy con backward compat
- **2025-02-06:** Rimozione backward compat (dopo 30gg)

---

## References

- [SCORING_RULES.md](../SCORING_RULES.md) - Regole scoring correnti
- [SCORE_ANALYSIS.md](../SCORE_ANALYSIS.md) - Analisi scoring
- [CORE_MIGRATION.md](../CORE_MIGRATION.md) - Piano originale matrice
- [core/board.ts](../../src/core/board.ts) - Implementazione Matrix
- [types/game.ts](../../src/types/game.ts) - GameState definition

---

**Approvato da:** Team Scarabeo-ACE  
**Revisione:** N/A (prima ADR formale)
