# Inconsistenze scoring: stato corrente

Documento operativo e conciso sullo stato del calcolo punteggio. Lo scopo è mantenere coerenza e prevenire regressioni; non contiene sezioni storiche.

## Cosa è attivo oggi

- Unica funzione di punteggio: `src/utils/scoring.ts` → `calculateScore({ tiles, existingBoard, context? })`.
- Board constants uniche: `src/config/boardConstants.ts` (STAR=DW, helper per moltiplicatori). L’UI può solo re‑esportare.

## Regole chiave (allineate a Scrabble)

- Moltiplicatori applicati solo alle tessere appena piazzate.
- La parola principale è ricostruita e moltiplicata da DW/TW derivati dalle sole nuove tessere.
- Le cross‑words sono calcolate perpendicolarmente a ogni nuova tessera, usando i moltiplicatori della tessera nuova coinvolta.
- Bingo: +50 se si usano 7 tessere nel turno.

Per dettagli vedere `docs/SCORING_RULES.md`.

## Guardrail da rispettare

- Usa sempre `calculateScore`; non duplicare logica o constants.
- I moltiplicatori provengono esclusivamente da `src/config/boardConstants.ts`.
- Niente fallback “di comodo” per le mosse Quackle: input invalido → errore esplicito.
- Ogni modifica a scoring o constants deve portare test dedicati.

## Verifiche coperte dai test

- DW al centro (JIN → 20), TW, DL/TL, tessere preesistenti senza moltiplicatori.
- Bingo +50, blank tiles, array vuoto, e ricostruzione della parola principale + cross.

## Note

Se aggiungi nuove casistiche, amplia i test in `src/utils/scoring.test.ts` o `src/utils/quackleScoreRecalc.test.ts`. Mantieni il sistema deterministico e semplice.
