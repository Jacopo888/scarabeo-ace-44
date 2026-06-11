# BestBot come motore opzionale

Stato: pianificato

## Decisione

BestBot va integrato come motore opzionale, non come sostituto di Quackle.

La UX prevista e:

- `Quackle`: motore di default/stabile.
- `BestBot`: motore opzionale forte per analisi, sandbox e partite contro bot avanzato.

## Architettura prevista

Il frontend non deve conoscere i dettagli interni del motore. Deve inviare una richiesta con lo stesso stato partita normalizzato:

- board 0-based come mappa `"r,c" -> { letter, isBlank }`;
- rack;
- bag/unseen pool;
- punteggi;
- storico mosse, quando disponibile;
- `top_n` per analisi sandbox;
- budget/forza del motore.

Il routing puo avvenire in uno di questi modi:

- `service-quackle` continua a servire Quackle;
- un futuro `service-bestbot` espone endpoint compatibili;
- un gateway lato API seleziona `engine=quackle|bestbot`.

## Contratto minimo

Endpoint minimi per la prima integrazione:

- `GET /health`
- `POST /best-move`
- `POST /top-moves`

La risposta deve restare compatibile con il client attuale:

- `move_type`
- `tiles`
- `score`
- `equity`
- `words`
- `engine_info`
- `moves` per top N

## Note legali/operative

L'integrazione va fatta solo con codice e configurazioni per cui abbiamo autorizzazione esplicita. Se BestBot usa Macondo come engine sottostante, il servizio deve rispettare la licenza dei componenti effettivamente inclusi.

## Prossimi passi

1. Identificare il sorgente autorizzato da usare per BestBot.
2. Definire un payload completo con score, bag, history e ruleset.
3. Implementare un `service-bestbot` separato.
4. Aggiungere selector motore nel frontend e nel sandbox.
5. Confrontare Quackle vs BestBot su fixture note prima del deploy.
