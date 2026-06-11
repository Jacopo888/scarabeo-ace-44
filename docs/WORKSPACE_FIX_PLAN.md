# Workspace Fix Plan

Questo file e il riferimento stabile per i fix emersi dall'audit di `scarabeo-ace-44` e `quacklejacopo`. Ogni intervento dovrebbe aggiornare lo stato del relativo punto e indicare i comandi di verifica eseguiti.

## FIX-01 - CI, build production e deploy Heroku

Stato: completato

Problema: la build production non era riproducibile. `package.json` puntava a `scripts/check-env.ts`, ma nel repo esiste `scripts/check-env.mjs`; la workflow Heroku usava `npm run build` invece di `build:prod`; i guardrail cercavano ancora `coord_map_1based`, mentre il sito live e il servizio Quackle usano coordinate 0-based; lo smoke backend controllava campi non presenti nella health live.

Fix previsto:
- Correggere `prebuild:prod` per usare `scripts/check-env.mjs`.
- Far eseguire `npm run build:prod` nella workflow di deploy.
- Rimuovere il controllo sul bundle `coord_map_1based`.
- Sostituire lo smoke backend con controlli sui campi reali: `engine_ready`, `strategy_ready`, `binary_present`, `lexicon`.
- Verificare localmente `npm ci`, `npm run build:prod`, e lo stato Heroku.

Esito:
- `package.json` usa `node ./scripts/check-env.mjs --prod`.
- `build:prod` esegue `vite build` e lascia a npm il lifecycle `prebuild:prod`.
- La workflow `deploy-tilesword.yml` esegue `npm run build:prod`.
- Il guardrail bundle verifica l'URL live di `service-quackle`.
- Lo smoke backend verifica la health reale: `engine_ready`, `strategy_ready`, `binary_present`, `lexicon`.

Verifiche eseguite:
- `npm run build:prod`
- controllo bundle su `dist/assets/index-*.js`
- smoke FE su `https://tilesword-0d2009186065.herokuapp.com/`
- smoke BE su `https://service-quackle-6773ae98281f.herokuapp.com/health`

## FIX-02 - Sanitizzazione delle tile Quackle

Stato: completato

Problema: `src/lib/game/tiles.ts` ha rimosso `sanitizeQuackleTile`, ma i test e la logica di sicurezza delle mosse continuano a richiederla. Senza questo helper, il frontend puo applicare tile con coordinate fuori range, lettere placeholder o blank non normalizzati.

Fix previsto:
- Reintrodurre `sanitizeQuackleTile`.
- Validare coordinate 0-based intere nel range `0..14`.
- Normalizzare lettere in uppercase.
- Scartare lettere vuote o placeholder come `.`.
- Trattare `?` come blank con `points: 0`.
- Usare l'helper prima di chiamare `applyBotMove`.

Esito:
- `src/lib/game/tiles.ts` espone di nuovo `sanitizeQuackleTile`.
- `useGame` sanitizza `move.tiles` prima di `shouldPassBotMove`, `calculateScoreAndWords` e `applyBotMove`.
- Le tile invalide vengono scartate; se non resta nessuna tile valida, la risposta viene trattata come pass.

Verifiche eseguite:
- `npx vitest run src/lib/game/tiles.test.ts src/lib/game/botPass.test.ts src/lib/game/botMove.test.ts src/hooks/useGame.test.ts src/hooks/useGame.endgame.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`

## FIX-03 - Contratto JSON del servizio Quackle minimale

Stato: completato

Problema: il wrapper C++ emette metadati utili (`start_row`, `start_col`, `direction`, `word`, `engine_info`), ma `service-quackle-min` li lascia dentro `raw`. Il frontend invece cerca campi top-level per history, debug e UI.

Fix previsto:
- In `service-quackle-min/app/main.py`, mantenere `raw` ma hoistare i campi principali al top-level.
- Aggiungere test API per garantire compatibilita: `raw` presente, top-level presente.
- Verificare `/best-move` live/local con rack noto.

Esito:
- `service-quackle-min/app/main.py` costruisce la risposta con `_best_move_response`.
- `raw` resta invariato per debug/backward compatibility.
- I campi noti prodotti dal wrapper vengono esposti anche top-level: `score`, `equity`, `tiles`, `words`, `start_row`, `start_col`, `direction`, `word`, `engine_info`, `strategy_ok`, `exchange_letters`, `exchange_count`, `exchange_blind`.
- Aggiunti test di contratto per mosse `play` ed `exchange`.

Verifiche eseguite:
- `python -m pytest service-quackle-min\tests -q`
- `python -m pytest service-quackle\tests -q`
- `npm run typecheck`
- `npx vitest run src/services/quackleClient.bestmove.test.ts src/hooks/useQuackle.test.ts src/hooks/useGame.test.ts`

## FIX-04 - Health Quackle semantica

Stato: completato

Problema: `useQuackleHealth` considera healthy ogni risposta HTTP ok. Un backend puo rispondere `200` con `engine_ready: false`, mostrando "ready" quando il motore non e pronto.

Fix previsto:
- Parsare il body JSON della health.
- Considerare healthy solo `res.ok && engine_ready === true`.
- Esporre nel risultato eventuali dettagli di errore/strategy/lexicon.
- Aggiornare test hook e badge.

Esito:
- `quackleHealth` ora interpreta `ok` come motore pronto, non solo HTTP ok.
- La risposta espone `data` ed `engineReady` per UI/debug.
- `useQuackleHealth` diventa unhealthy quando `/health` risponde 200 ma `engine_ready` e false.
- `QuackleHealthCheck` ora legge correttamente `snapshot.status`.
- Il banner globale distingue il caso `engineReady === false` con "motore non pronto".

Verifiche eseguite:
- `npx vitest run src/services/quackleHealth.test.ts src/hooks/useQuackleHealth.test.ts src/services/rating.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build:prod`
- smoke live su `https://service-quackle-6773ae98281f.herokuapp.com/health`

## FIX-05 - Rating API e identita utenti

Stato: completato

Problema: il frontend converte UUID Supabase con `Number(...)`, producendo `NaN/null`; il rating-api usa invece `players.id` numerico. Il report risultato multiplayer non puo funzionare in modo affidabile.

Fix previsto:
- Decidere un modello unico: rating basato su UUID Supabase/profiles oppure tabella di mapping esplicita.
- Eliminare conversioni numeriche silenziose nel frontend.
- Aggiornare schema Drizzle e route `/rating/report`.
- Aggiungere test per report con UUID e pareggio/forfeit.

Esito:
- Scelto modello con mapping esplicito: `players.id` resta interno numerico, `players.external_id` contiene l'ID pubblico Supabase/UUID.
- Aggiunta migration `rating-api/migrations/0006_player_external_id.sql`.
- `/rating/:id` accetta UUID/stringhe tramite `external_id` e mantiene supporto legacy per ID numerici.
- `/rating/report` accetta `player1Id`, `player2Id`, `winnerId` come stringhe UUID; `winnerId: null` rappresenta pareggio.
- Il report crea automaticamente righe rating mancanti con rating iniziale 1000.
- Il frontend non usa piu `Number(...)` per ID Supabase.
- Il test harness Vitest del rating-api e stato corretto con `vi.hoisted`.

Verifiche eseguite:
- `npm --prefix rating-api run build`
- `npm --prefix rating-api test`
- `npm run typecheck`
- `npm test`

## FIX-06 - Test rating-api e harness Vitest

Stato: completato

Problema: `rating-api/src/__tests__/rating.test.ts` usa `vi.mock(dbModulePath, ...)`, ma `vi.mock` viene hoistato e accede a `dbModulePath` prima dell'inizializzazione.

Fix previsto:
- Sostituire con mock a path statico o `vi.doMock` con import dinamico.
- Mantenere test isolati da DB/Redis reali.
- Rieseguire `npm test` in `rating-api`.

Esito:
- Il test harness usa `vi.hoisted` e `vi.mock('../db', ...)` con path statico.
- I mock di DB e Redis restano isolati da servizi reali.
- I test coprono leaderboard, rating lookup, UUID pubblici, ID numerici legacy, report risultato, creazione player mancanti e validazione winner.

Verifiche eseguite:
- `npm --prefix rating-api run build`
- `npm --prefix rating-api test`

## FIX-07 - Realtime Supabase multiplayer

Stato: completato

Problema: le subscription Realtime usano filtri tipo `player1_id=eq.X,player2_id=eq.X`. Supabase Realtime supporta un filtro semplice per subscription; la query normale usa correttamente `.or(...)`, ma la subscription puo perdere eventi.

Fix previsto:
- Usare due subscription separate per `player1_id` e `player2_id`, oppure subscription larga con filtro client-side.
- Evitare duplicati chiamando `fetchActiveGames` in modo idempotente.
- Aggiungere test/harness dove possibile.

Esito:
- Aggiunto `src/lib/multiplayer/realtime.ts` con helper per generare un filtro Realtime semplice per ogni colonna partecipante.
- `useActiveGames` registra due handler `postgres_changes`, uno su `player1_id` e uno su `player2_id`, e riusa lo stesso refresh idempotente.
- `useMatchmaking` registra due handler `INSERT` con filtri semplici e mantiene anche il controllo client-side sul game ricevuto.
- Aggiunto `src/lib/multiplayer/realtime.test.ts` per impedire regressioni verso il filtro composto con virgola.

Verifiche eseguite:
- `npx vitest run src/lib/multiplayer/realtime.test.ts`
- `rg` per cercare vecchi filtri Realtime composti con virgola: nessun match residuo.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`

## FIX-08 - Stato multiplayer completato/abbandonato

Stato: completato

Problema: `buildGameState` converte ogni record Supabase in `gameStatus: 'playing'`. Partite `completed` o `abandoned` possono essere mostrate come ancora giocabili.

Fix previsto:
- Mappare `waiting -> waiting`, `active -> playing`, `completed/abandoned -> finished`.
- Aggiornare UI per mostrare risultato e bloccare input su partite finite.
- Aggiungere test su `src/lib/multiplayer/state.ts`.

Esito:
- `src/lib/multiplayer/state.ts` espone `gameRecordStatusToGameStatus`.
- `buildGameState` mappa `waiting -> waiting`, `active -> playing`, `completed/abandoned -> finished`.
- `isMyTurn` viene esposto solo per partite `active`, quindi partite finite/abbandonate non sono giocabili anche se `current_player_id` punta all'utente.
- `src/pages/MultiplayerGame.tsx` mostra stati finali espliciti: vittoria, sconfitta, completata o abbandonata.
- La board e le azioni usano `canPlayTurn`, quindi gli input restano disabilitati fuori dalle partite attive.
- Aggiunto `src/lib/multiplayer/state.test.ts`.

Verifiche eseguite:
- `npx vitest run src/lib/multiplayer/state.test.ts src/lib/multiplayer/realtime.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`

## FIX-09 - Env, segreti e igiene repo

Stato: completato

Problema: `.env`, `.env.development`, `.env.production` sono tracciati; il client Supabase hardcoda URL e publishable key; `__pycache__` Python e file generati sono presenti nella storia del repo.

Fix previsto:
- Decidere quali file env devono restare template e quali vanno rimossi dal tracking.
- Leggere Supabase URL/key da env Vite.
- Aggiornare `.gitignore` per `service-quackle-min/**/__pycache__/`.
- Rimuovere cache Python tracciate con commit dedicato.

Esito:
- Il client Supabase legge `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` da `import.meta.env`.
- Il client fallisce subito con errore esplicito se le due env mancano.
- `scripts/check-env.mjs` blocca la production build se mancano `VITE_QUACKLE_SERVICE_URL`, `VITE_SUPABASE_URL` o `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `.env.example` e README documentano le variabili Vite corrette.
- `.gitignore` ignora `.env`, `.env.*`, `__pycache__` e `*.py[cod]`, mantenendo tracciabile solo `.env.example`.
- `.env`, `.env.development`, `.env.production` sono stati rimossi dall'indice Git con `git rm --cached`, ma lasciati presenti localmente.
- I bytecode Python tracciati in `service-quackle-min/**/__pycache__` sono stati rimossi dall'indice Git.
- Heroku app `tilesword` ora ha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` configurate; `VITE_RATING_API_URL` resta non obbligatoria perche non e stato individuato un target rating-api Heroku dedicato.
- Il setup Vitest imposta env Supabase fittizie per evitare dipendenza dai file locali o da Supabase reale.

Verifiche eseguite:
- `heroku config -a tilesword --json` con output sanitizzato: Supabase env presenti.
- `git ls-files -- .env .env.development .env.production`: nessun file residuo.
- `git ls-files | Select-String -Pattern '__pycache__|\\.pyc$'`: nessun file residuo.
- `rg -n 'qjpvhhijujqblazdlfeg|eyJhbGci' src scripts README.md docs .github .env.example`: nessun hardcode residuo nel materiale tracciabile.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`

## FIX-10 - Strategia repo Quackle e branch deploy

Stato: completato

Problema: il checkout locale `quacklejacopo` e su `CommandLineRunner`, ma il Dockerfile del servizio clona `master`. `origin/master` contiene CMake/wrapper; `CommandLineRunner` no. Questo rende ambiguo quale codice sia davvero sorgente del deploy.

Fix previsto:
- Fissare `QUACKLE_REPO_REF` a tag o commit noto, non a branch mobile.
- Oppure portare CMake/wrapper su `CommandLineRunner` e aggiornare Dockerfile.
- Documentare il ramo canonico del motore usato da Heroku.
- Aggiungere smoke build del wrapper.

Esito:
- Scelto pin a commit noto: `d280e6760f06b52dd8b8baf18c9bf152492c230d`, tip locale di `quacklejacopo/origin/master`.
- `service-quackle-min/Dockerfile` non usa piu `master` come `QUACKLE_REPO_REF` di default.
- Il Dockerfile supporta checkout detached del ref richiesto e usa `QUACKLE_REPO_FETCH_REF=master` solo come ref di fetch quando serve recuperare un commit SHA.
- `service-quackle-min/README.md` documenta che `CommandLineRunner` resta branch default remota, ma non e il sorgente canonico del deploy Heroku del servizio minimale.
- Aggiunto `service-quackle-min/tests/test_dockerfile_contract.py` per impedire regressioni verso branch mobile.
- `.github/copilot-instructions.md` ora punta a `service-quackle-min`, corregge il payload board a 0-based e documenta il commit Quackle canonico.

Verifiche eseguite:
- `git -C c:\work\quacklejacopo cat-file -e "d280e6760f06b52dd8b8baf18c9bf152492c230d^{commit}"`
- `python -m pytest service-quackle-min\tests\test_dockerfile_contract.py -q`
- `python -m pytest service-quackle-min\tests -q`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`
- Nota: `docker --version` non e disponibile in questo terminale, quindi il build Docker reale non e stato eseguito localmente.

## FIX-11 - Coerenza prodotto: Tilesword, Scrabble inglese o Scarabeo italiano

Stato: completato

Problema: il prodotto viene descritto come Scarabeo/Tilesword, ma usa distribuzione lettere e lessico inglesi (`ENABLE`, English Scrabble distribution). Se l'obiettivo e Scarabeo italiano, bag, punteggi, dizionario e AI non sono coerenti.

Fix previsto:
- Decidere il posizionamento: mantenere Tilesword inglese o migrare a Scarabeo italiano.
- Se resta inglese, aggiornare testi e documentazione.
- Se diventa Scarabeo italiano, introdurre distribuzione/punteggi/dizionario italiani e verificare compatibilita Quackle.
- Aggiungere test su bag e scoring.

Esito:
- Scelta conservativa: mantenere il prodotto live come `Tilesword` con regole word-tile inglesi e lessico ENABLE/`enable1.15`.
- Aggiunto `src/config/ruleset.ts` con nome prodotto, lingua, lessico Quackle, dimensioni board/rack e distribuzione inglese attesa.
- Aggiunto `src/config/ruleset.test.ts` per verificare che `TILE_DISTRIBUTION` runtime corrisponda alla distribuzione inglese documentata.
- Homepage, pagina dizionario e metadata HTML descrivono ora il ruleset inglese/ENABLE invece di un generico gioco di parole.
- `README.md` documenta esplicitamente che il prodotto non e ancora Scarabeo italiano e cosa servirebbe per una migrazione reale.
- `docs/CORE_MIGRATION.md` corregge la nota sul payload Quackle da 1-based a 0-based.

Verifiche eseguite:
- `npx vitest run src/config/ruleset.test.ts`
- `python -m pytest service-quackle-min\tests -q`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:prod`

## HOTFIX-2026-06-10 - Coordinate Quackle su parole con lettere gia in board

Stato: completato

Problema: quando Quackle propone una parola che attraversa lettere gia presenti sul tabellone, il wrapper C++ usava `Move::usedTiles()` per calcolare le coordinate. `usedTiles()` contiene solo le tessere del rack e non conserva i marker delle lettere gia in board; dopo la prima ancora, le coordinate venivano quindi sfasate. Il frontend poteva ricevere tessere sopra caselle occupate, parole "fantasma" e punteggi associati a parole non realmente formate.

Fix applicato:
- In `service-quackle-min/json_wrapper_main.cpp`, la lista `tiles` viene costruita da `Move::tiles()`, che conserva i marker play-through.
- Le lettere gia in board non vengono emesse come nuove tessere, ma contribuiscono alla parola completa restituita in `word`.
- In `src/lib/game/tiles.ts`, `prepareQuacklePlacementTiles` separa tessere nuove, ancore gia presenti e conflitti.
- In `src/hooks/useGame.ts`, le mosse Quackle vengono validate con `canPlace`, i conflitti vengono respinti e il punteggio/parole vengono ricalcolati lato client sulla board reale.
- In `src/lib/game/botMove.ts`, rack e `lastMove` usano solo le tessere effettivamente piazzate, non eventuali ancore o overlap.

Verifiche eseguite:
- Riprodotto il bug con `ZAIRES` in riga 7 e rack `ABCDEFG`: prima Quackle restituiva una tessera sopra `7,4`; dopo il fix restituisce `FACADE` con nuove tessere solo su `6,4`, `8,4`, `9,4`, `10,4`, `11,4`.
- Test container locale `service-quackle-local:playthrough-fix` su `/best-move`.
- Test live su `https://service-quackle-6773ae98281f.herokuapp.com/best-move` dopo deploy Heroku `service-quackle` v116.
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build:prod`
- `python -m pytest service-quackle-min\tests -q`

## MIGRATION-2026-06-11 - Bridge forte `service-quackle`

Stato: completato e deployato

Problema: la produzione stava usando il wrapper minimale (`quackle_json_wrapper`) invece del bridge forte. Questo impediva di usare correttamente la pipeline piu potente di Quackle: kibitz ampio, simulatore Monte Carlo in late game, solver endgame con bag vuoto e risposta top N per sandbox/analisi.

Fix applicato:
- `service-quackle` ora clona e compila `Jacopo888/quacklejacopo` nel Dockerfile del bridge forte.
- Il bridge C++ forza board standard 15x15 con centro 0-based `(7,7)`, evitando crash e coordinate non coerenti.
- La `GamePosition` viene inizializzata con turno valido prima di chiamare `kibitz`.
- `bag_pool` esplicito, incluso `[]`, viene passato fino al bridge: bag vuoto attiva il solver endgame.
- `top_n` viene validato nel range `1..10` e restituito come lista `moves`.
- In modalita hard con bag piccolo viene usato il simulatore Monte Carlo; con bag vuoto viene usato `Quackle::Endgame`.
- Lo stdout rumoroso interno di Quackle viene catturato durante simulatore/endgame, cosi l'API restituisce JSON pulito.
- Lo startup strategy non segnala piu falsi `copy_failed` quando source e destination sono la stessa directory via symlink.
- Deploy Heroku eseguito come container `web` dell'app `service-quackle`.

Verifiche eseguite:
- `python -m pytest service-quackle\tests -q` -> 53 passed, 3 skipped.
- Build Docker locale `service-quackle-strong:local`.
- Health locale: `engine=quackle-bridge`, `bridge_path=/srv/bridge/engine_wrapper`, `engine_ready=true`, `strategy_ready=true`.
- Endpoint locale `/best-move`: hard + `bag_pool=[]` usa `used_endgame_solver=true`.
- Endpoint locale `/best-move`: `top_n=4` restituisce 4 mosse.
- Endpoint locale `/best-move`: hard + bag piccolo usa `used_simulator=true`.
- Deploy Heroku container registry su `service-quackle`.
- Health live `https://service-quackle-6773ae98281f.herokuapp.com/health`: `engine=quackle-bridge`, `bridge_path=/srv/bridge/engine_wrapper`, `engine_ready=true`, `strategy_ready=true`.
- Endpoint live `/best-move`: hard + `bag_pool=[]` usa endgame, `top_n` restituisce lista `moves`, hard + bag piccolo usa simulatore.
- Smoke HTTP del sito `https://tilesword-0d2009186065.herokuapp.com/`: status 200.
