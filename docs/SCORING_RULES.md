# Regole di Calcolo Punteggio (Scrabble/Quackle)

Questa pagina descrive le regole applicate dalla funzione unificata `calculateScore()` in `src/utils/scoring.ts`.

## Concetti base

- Board 15x15 con caselle speciali definite in `src/config/boardConstants.ts`.
- Coordinate 0-based: centro (7,7) marcato come `STAR` e vale come Double Word (DW).
- Le caselle speciali si applicano solo alle tessere appena piazzate in quella mossa.

## Formula generale

Score totale = (Punteggio parola principale × moltiplicatori parola) + Somma punteggi cross-words + Bonus Bingo

Dove:
- Punteggio parola = somma del valore lettere (con moltiplicatori lettera su nuove tessere)
- Moltiplicatori parola = prodotto dei moltiplicatori parola delle nuove tessere (DW=×2, TW=×3, STAR=×2)
- Cross-words = per ogni nuova tessera, se crea una parola perpendicolare con tiles esistenti, calcolarne il punteggio (applicando i moltiplicatori solo sulla tessera nuova) e sommarlo al totale
- Bonus Bingo = +50 punti se sono state usate tutte e 7 le tessere dalla rastrelliera

## Moltiplicatori

- DL (Double Letter): ×2 sulla lettera della tessera nuova
- TL (Triple Letter): ×3 sulla lettera della tessera nuova
- DW (Double Word): ×2 sul punteggio della parola
- TW (Triple Word): ×3 sul punteggio della parola
- STAR: trattata come DW

I moltiplicatori non si applicano a tessere già presenti sulla board.

## Edge cases gestiti

- Mossa di singola tessera: applica i moltiplicatori di quella casella direttamente (letter × word) alla singola lettera.
- Parole multiple: la parola principale viene ricostruita espandendo a sinistra/destra o su/giù finché ci sono tessere esistenti contigue.
- Cross-words: per ciascuna nuova tessera si espande nella direzione perpendicolare; se non si forma nessuna parola (lunghezza 1), il contributo è 0.
- Bingo: bonus aggiunto solo se la mossa usa esattamente 7 tessere.

## Esempi rapidi

- Inizio partita su STAR (7,7) con parola di tre lettere che include la tessera sullo STAR:
  - Punteggio = (somma lettere con eventuali DL/TL su nuove tessere) × 2 (STAR) + eventuali cross-words.

- Mossa che crea una cross-word con una tessera già esistente:
  - Il punteggio della cross-word applica DL/TL/DW/TW solo sulla nuova tessera, non sulle esistenti.

## API di riferimento

- `getMultipliersAt(row, col)` in `src/config/boardConstants.ts`: restituisce `{ letter, word }` per una posizione.
- `calculateScore({ tiles, existingBoard, context? })` in `src/utils/scoring.ts`:
  - `tiles`: array delle nuove tessere con `{ row, col, letter, points, isBlank? }`
  - `existingBoard`: `Map<string, PlacedTile>` dello stato prima della mossa
  - `context`: stringa opzionale per log ("player" | "quackle")

## Allineamento con Quackle

La logica replica il comportamento di Quackle:
- Moltiplicatori applicati solo alle nuove tessere.
- Parola principale più cross-words calcolate separatamente.
- Bingo bonus di +50.

Il bridge Quackle può riportare punteggi divergenti in alcuni casi; per questo il frontend ricalcola tramite `calculateScore()` e considera questo come fonte di verità.
