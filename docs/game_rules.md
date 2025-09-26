# Regole di fine partita (Multiplayer e vs Quackle)

La partita termina quando `canEndGame` restituisce `true`. Le condizioni attualmente implementate sono:

1. Fine immediata: la sacca è vuota e almeno un giocatore ha svuotato la propria rack. In questo caso la partita termina subito, senza far passare il turno all'altro giocatore (vale per partite locali, online e contro Quackle).
2. Pass consecutivi: ciascun giocatore ha passato il turno due volte di fila (quattro pass totali in una partita a due giocatori).
3. Nessuna mossa disponibile: non esistono più mosse valide sul tabellone dato lo stato delle rack.

Quando si verifica una di queste condizioni, l'applicazione:

1. Invoca `canEndGame` con le rack dei giocatori, la sacca corrente e l'eventuale contatore di pass.
2. Se la partita può finire, esegue `calculateEndGamePenalty` per ogni rack.
3. Sottrae le penalità dai punteggi e aggiunge al vincitore i punti residui dell'avversario.
4. Aggiorna punteggi e vincitore nello stato prima di registrare la mossa finale.
