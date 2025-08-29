# Multiplayer Game End Rules

A multiplayer game ends when `canEndGame` returns `true`. The helper evaluates three conditions:

1. **Rack depletion** – the tile bag is empty and a player has no tiles left.
2. **Consecutive passes** – all players have passed three turns in a row (six total passes in a two-player game).
3. **No moves available** – the current board and racks offer no valid plays.

When any of these situations occur, the application:

1. Calls `canEndGame` with both player racks, the current tile bag and the current pass counter.
2. If the game can finish, `calculateEndGamePenalty` is run for each rack.
3. Penalties are subtracted from each player's score and the opponent's leftover points are added to the winner.
4. The updated scores and winner are saved to the `games` table before the final move is recorded.
