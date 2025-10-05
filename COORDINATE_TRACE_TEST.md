# Coordinate Trace Test - Diagnosi Bug row=6

## Test Setup (Completato)

Logging aggiunto in:
1. ✅ `quackleClient.ts` - API response (raw tiles[0].row)
2. ✅ `sanitizeQuackleTile` - Input → Output transformation
3. ✅ `applyBotMove` - Before/After matrix write
4. ✅ `useGame.ts` - ULTRA-RAW log (già esistente)

## Come Eseguire Test

### Opzione A: Locale
```bash
cd /home/jacopo/Progetti-github/scarabeo-ace-44
npm run dev
# Apri http://localhost:5173?mode=quackle&difficulty=medium
# Apri DevTools → Console
# Avvia partita
# Cerca: "🎯 COORDINATE TRACE"
```

### Opzione B: Heroku (dopo deploy)
```bash
git add .
git commit -m "debug: add complete coordinate tracing"
git push heroku main
# Apri app Heroku
# Hard reload (Ctrl+Shift+R)
# Console → cerca "🎯 COORDINATE TRACE"
```

## Cosa Cercare nei Log

Se vedi:
```
[quackleClient] 🎯 COORDINATE TRACE - API Response tiles[0].row: 7
[sanitizeQuackleTile] 🎯 TRACE: { letter: 'K', rowRaw: 7, rowNum: 7, row: 7 }
[applyBotMove] 🎯 TRACE - Input sanitizedTiles[0].row: 7
[applyBotMove] 🎯 TRACE - Wrote to nextMatrix[7][...]: { row: 7, ... }
[useGame] 🚨 First tile RAW row value: 7
```
→ **NON C'È BUG**, era cache/sessione vecchia

Se vedi:
```
[quackleClient] 🎯 COORDINATE TRACE - API Response tiles[0].row: 6  ← ⚠️
```
→ Bug nel **backend/bridge**, servizio restituisce 6

Se vedi:
```
[quackleClient] 🎯 ... row: 7
[sanitizeQuackleTile] 🎯 ... row: 6  ← ⚠️
```
→ Bug in **sanitize** (improbabile, codice verific ato)

Se vedi:
```
[sanitizeQuackleTile] 🎯 ... row: 7
[applyBotMove] 🎯 Input ... row: 6  ← ⚠️
```
→ Bug tra **useGame.ts map/filter**

## Risultato Atteso

Tutte le coordinate dovrebbero essere **7** end-to-end.

Se così non è, il log mostrerà ESATTAMENTE dove avviene la trasformazione 7→6.
