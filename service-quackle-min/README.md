# service-quackle-min

Servizio minimale FastAPI che invoca Quackle via un wrapper subprocess JSON.

Obiettivo: massima semplicità, nessuna normalizzazione artificiale, mossa raw.

## Endpoint

GET /health
Risposta esempio:
{
  "engine_ready": true,
  "lexicon": "enable1.15",
  "lexdir": "/data/lexica",
  "dawg_size": 123456,
  "gaddag_size": 789012,
  "binary_path": "/usr/local/bin/quackle_json_wrapper",
  "binary_present": true,
  "uptime_s": 42.13
}

engine_ready = (lessico completo + binario eseguibile). Se false, /best-move ritorna 500 lexicon_not_ready.

POST /best-move -> calcola la migliore mossa (play / exchange / pass) oppure errore.

## Request /best-move
{
  "rack": "AEIRSTZ",
  "board": { "7,7": { "letter": "C", "isBlank": false } }
}

Regole:
- board è una coord map 0-based: chiave "r,c" con r,c in [0,14]. Valore: { letter: string(1), isBlank?: bool }
- letter maiuscola A-Z, blank rappresentato con isBlank=true e letter comunque presente (valutazione punteggio demandata al motore).
- rack: stringa 1..7 caratteri A-Z oppure ? per blank. Rack vuota => sarà comunque pass delegato al motore (non forziamo pass internamente).

## Response successo (play)
{
  "move_type": "play",
  "score": 78,
  "tiles": [ {"row":7,"col":7,"letter":"C","isBlank":false}, ... ],
  "raw": { ... output integrale del wrapper ... }
}

Exchange:
{ "move_type": "exchange", "exchange_letters": "AEI", "raw": { ... } }

Pass:
{ "move_type": "pass", "raw": { ... } }

## Errori
Gli errori sono resi come FastAPI default: {"detail": <codice>}

Codici possibili (detail):
- invalid_input (400)
- lexicon_not_ready (500)
- engine_error (500)
- timeout (504)

In ambiente dev (ENV=dev) engine_error include uno snippet stderr: engine_error:<stderr_snip>

## Limiti & Validazioni
- Rack: 0..7 char A-Z o '?' (vuota consentita → delega pass al motore)
- Board: <= 225 celle; chiavi "r,c" con r,c in [0,14]; ogni cella {letter,isBlank?}
- Body JSON: dimensione massima ~32KB (MAX_BODY_LEN). Oltre → 400 invalid_input
- Validazione input avviene PRIMA del controllo lexicon_ready (priorità ad errori 4xx).

## Variabili d'ambiente
- QUACKLE_ENGINE_BIN (default: /usr/local/bin/quackle_json_wrapper)
- QUACKLE_LEXDIR (default: /data/lexica)
- QUACKLE_LEXICON (default: enable1.15)
- QUACKLE_TIMEOUT_MS (default: 8000)
- QUACKLE_STRATEGY_DIR (opzionale; se impostato il wrapper verifica file strategia)
- ENV (se 'dev' abilita snippet stderr in engine_error)

## Lexicon richiesto
Nel path $QUACKLE_LEXDIR devono esistere:
- $QUACKLE_LEXICON.gaddag
- $QUACKLE_LEXICON.dawg

## Build & Run (sviluppo)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

## Sorgente Quackle canonico

Il container compila il wrapper C++ da `https://github.com/Jacopo888/quacklejacopo.git`.
Per rendere i deploy riproducibili, il Dockerfile non usa una branch mobile:

- `QUACKLE_REPO_REF=d280e6760f06b52dd8b8baf18c9bf152492c230d`
- `QUACKLE_REPO_FETCH_REF=master`

Quel commit corrisponde a `origin/master` della repo `quacklejacopo` e contiene
`CMakeLists.txt` e `json_wrapper_main.cpp`, necessari per il build del wrapper.
La branch `CommandLineRunner` resta la branch di default della repo remota, ma
non e il sorgente canonico del deploy Heroku di questo servizio.

Se si vuole testare un altro commit/branch, impostare entrambi gli argomenti di
build quando serve:

```bash
docker build \
  --build-arg QUACKLE_REPO_REF=<commit-o-branch> \
  --build-arg QUACKLE_REPO_FETCH_REF=<branch-che-contiene-il-commit> \
  -t service-quackle-min ./service-quackle-min
```

## Note Wrapper
Input JSON:
{
  "op":"best_move",
  "rack":"AEIRSTZ",
  "board": { "7,7": {"letter":"C","isBlank":false} },
  "lexicon":"enable1.15",
  "strategies": true
}
Output JSON (status ok): { "status":"ok", "move_type":"play|pass|exchange", "score":int?, "tiles":[...], ... }
Altri campi (es. strategy_ok) pass-through nel blocco raw.
Se status != ok -> HTTP 500 engine_error.

## Test
pytest -q
I test di integrazione del wrapper vengono saltati se binario o lessici non presenti (engine_ready=false). In tal caso /health rimane valido per smoke.

## Smoke Script
Vedi `scripts/smoke_quackle_min.sh` per un controllo rapido (health + best-move).

## Cutover (bozza)
1. Deploy parallelo service-quackle-min (nuovo host) con variabili identiche.
2. Impostare frontend `VITE_QUACKLE_SERVICE_URL` verso il nuovo servizio in staging → testare.
3. Swap variabile in produzione; monitor 24h (error rate, latency).
4. Disattivare vecchio service-quackle e aggiornare doc root.

## Futuro
Metriche / caching mosse / ottimizzazione pybind potranno essere valutate separatamente senza cambiare protocollo.
