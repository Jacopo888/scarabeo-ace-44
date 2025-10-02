# Debug Logger

Utility per visualizzare log puliti e leggibili delle mosse nel browser durante lo sviluppo.

## Formato

I log seguono il pattern: **rack → mossa (score)**

### Esempi

**Mossa di Quackle (AI):**
```
🤖 Quackle: AEIRSTZ → STARE (STARE) → 12 pts
```

**Mossa del giocatore:**
```
👤 Alice: HELLO?? → HELLO ([E]LLO) → 24 pts
```

**Pass:**
```
🤖 Quackle: ZZQX → PASS
👤 Bob: QXZZZ → PASS
```

**Exchange:**
```
👤 Carol: AEIOU → EXCHANGE (5 tiles)
```

## Caratteristiche

- **Blanks**: Le tessere blank sono mostrate tra parentesi quadre `[A]`
- **Emoji**: 🤖 per Quackle, 👤 per giocatori umani
- **Dev Only**: I log appaiono solo in modalità sviluppo (`import.meta.env.DEV`)
- **Leggibilità**: Formato compatto su una riga per seguire facilmente il flusso di gioco

## Utilizzo

I log vengono automaticamente generati in:
- `useQuackle.ts`: quando Quackle calcola una mossa
- `useGame.ts`: quando il giocatore conferma una mossa, fa pass o exchange

### Debug Manuale

```typescript
import { logQuackleMove, logPlayerMove, logPlayerAction } from '@/utils/debugLogger'

// Log mossa Quackle
logQuackleMove(rack, quackleMove)

// Log mossa giocatore
logPlayerMove(playerName, rack, tiles, words, score)

// Log azione (pass/exchange)
logPlayerAction(playerName, rack, 'pass')
logPlayerAction(playerName, rack, 'exchange', 3)
```

## Funzioni Helper

- `formatRack(rack)`: Formatta rack come stringa (es. `HELLO[A]`)
- `formatMove(tiles, words, score)`: Formatta mossa completa
- `logQuackleMove()`: Log automatico per mosse Quackle
- `logPlayerMove()`: Log automatico per mosse giocatore
- `logPlayerAction()`: Log automatico per pass/exchange

## Vantaggi

✅ Più pulito dei log JSON completi
✅ Facile seguire il flusso di gioco
✅ Identifica subito chi gioca (AI vs Giocatore)
✅ Mostra rack e risultato in modo compatto
✅ Utile per debugging e testing manuale
