# Multiplayer Services

This folder groups logic for multiplayer game operations.

- reads.ts: read-side operations like `fetchGameWithProfiles`.
- writes.ts: write-side operations that mutate game state (submit move, exchange, pass, resign).
- helpers.ts: shared types and pure helpers (move log entry type, turn helpers, endgame evaluation, winner mapping, and `applyEndgame`).

## Public API (barrel)

`src/services/multiplayer.ts` re-exports reads and writes so imports remain stable:

```ts
import { fetchGameWithProfiles, submitMoveForGame, passTurnForGame } from '@/services/multiplayer'
```

## Contracts

- GameRecord: shape defined in `@/types/multiplayer` (player IDs, racks, scores, bag, board_state, status).
- All write functions return minimal summaries when relevant, e.g.
  - `submitMoveForGame` -> `{ endGame: boolean, winnerId?: string | null }`
  - `passTurnForGame` -> `{ endGame: boolean, winnerId?: string | null }`
  - `surrenderGameForGame` -> `{ winnerId: string }`

## Endgame logic

- `evaluateEndgameAfterMove` and `evaluateEndgameOnPass` compute if and how a game ends (including final scores and logical winner tag `'p1' | 'p2' | null`).
- `winnerIdFromTag` maps the logical tag to the concrete `winner_id`.
- `applyEndgame` centralizes mutation of the update object (status, final scores, winner) and returns a compact `{ endGame, winnerId }` summary to avoid code duplication.

## Testing

- Unit tests live nearby in `helpers.test.ts` for pure helpers. Write ops are covered indirectly by higher-level integration and hooks tests.
