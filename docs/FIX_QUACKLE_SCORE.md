# Fix: Quackle Score Calculation Bug

## Il Problema

Quackle restituiva score errati che non tenevano conto correttamente dei moltiplicatori del tabellone (DW, TW, DL, TL).

### Esempio del bug:
- **Mossa**: JIN al centro (7,7)
- **Score atteso**: J(8) + I(1) + N(1) = 10 × 2 (DW) = **20 punti**
- **Score ricevuto da Quackle**: **19 punti** ❌

## Causa Root

Il bridge C++ di Quackle (`quackle_bridge.cpp`) restituisce lo score calcolato internamente da Quackle, che potrebbe:
1. Usare configurazioni di moltiplicatori diverse
2. Avere bug nel calcolo
3. Non allinearsi perfettamente con le nostre caselle speciali

## Soluzione Implementata

### 1. Ricalcolo dello Score Lato Frontend

Creato `src/utils/quackleScoreRecalc.ts` che:
- Prende le tiles ritornate da Quackle (coordinate 0-based)
- Applica i nostri moltiplicatori del tabellone
- Considera tiles esistenti vs nuove
- Calcola cross-words correttamente
- Aggiunge bonus BINGO (50 punti per 7 tiles)

### 2. Integrazione in `useGame.ts`

```typescript
// CRITICAL FIX: Recalculate score using our board multipliers
const recalculatedScore = recalculateQuackleScore(sanitizedTiles, snapshot.board)
const finalScore = recalculatedScore

if (import.meta.env.DEV) {
  console.log('[useGame] 🔧 SCORE FIX - Bridge score:', move.score, '→ Recalculated:', finalScore)
  if (move.score !== finalScore) {
    console.warn('[useGame] ⚠️ Score mismatch detected! Using recalculated value.')
  }
}
```

### 3. Logging Dettagliato per Debug

Aggiunti log in dev mode che mostrano:
- Score raw dal bridge
- Tiles con coordinate complete
- Score ricalcolato
- Warning se c'è mismatch

## Test di Regressione

Creati 9 test completi in `src/utils/quackleScoreRecalc.test.ts`:

✅ JIN al centro con DW → 20 punti  
✅ DJIN al centro con DW → 24 punti  
✅ Parola a TW corner → score × 3  
✅ Double Letter Score  
✅ Triple Letter Score  
✅ Non applica moltiplicatori a tiles esistenti  
✅ Bonus BINGO (+50 punti)  
✅ Gestisce blank tiles (0 punti)  
✅ Ritorna 0 per array vuoto  

## Risultati

- ✅ Tutti i 49 test file passano
- ✅ 146 test totali verdi
- ✅ Score ora calcolato correttamente con moltiplicatori
- ✅ Log pulito per debugging (`🤖 Quackle: rack → mossa`)

## Come Testare

1. Avvia il dev server: `npm run dev`
2. Inizia una partita contro Quackle
3. Apri la console del browser (F12)
4. Guarda i log:
   - `🔍 RAW BRIDGE RESPONSE` - score dal bridge
   - `🔧 SCORE FIX` - confronto bridge vs ricalcolato
   - `🤖 Quackle: rack → mossa (score)` - log pulito finale

## Note Tecniche

### Coordinate System
- Le coordinate in input/output sono **0-based** (0-14)
- Centro: (7,7) con moltiplicatore DW
- SPECIAL_SQUARES definito in `quackleScoreRecalc.ts` allineato con `scoring.ts`

### Algoritmo di Ricalcolo

1. **Determina direzione**: orizzontale o verticale
2. **Espande parola completa**: include tiles esistenti prima/dopo
3. **Calcola score base**: somma punti con moltiplicatori lettera (TL/DL) solo su nuove tiles
4. **Applica moltiplicatori parola**: (TW/DW) solo da nuove tiles
5. **Aggiunge cross-words**: parole perpendicolari formate
6. **Bonus BINGO**: +50 se usate tutte 7 tiles

### Moltiplicatori Non Accumulano su Tiles Esistenti

Se una tile è già sulla board:
- ❌ Il suo moltiplicatore NON si applica più
- ✅ Solo le NUOVE tiles attivano moltiplicatori
- ✅ Questo previene double-counting dei bonus

## Prossimi Passi (Opzionali)

- [ ] Investigare fix nel bridge C++ (se vogliamo allinearlo)
- [ ] Aggiungere test per mosse più complesse (multiple cross-words)
- [ ] Log delle divergenze bridge vs frontend per statistica

---

**Data fix**: 2 ottobre 2025  
**Test status**: ✅ 146/146 passing  
**Impatto**: Risolve tutti i problemi di score errato dalle mosse di Quackle
