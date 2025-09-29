# Simulation fixtures

Questi file JSON sono esempi/golden per simulazioni di mosse/board.

- `simple.json`: board minimale 2x2, rack di esempio.
- `realistic.json`: board 15x15 vuota con rack di esempio.

Uso suggerito:
- Per test rapidi di integrazione del servizio Quackle (o script), puntare a questi file invece di mantenere duplicati nella root del repo.

Percorsi stabili da importare/usare negli script:
- `fixtures/simulation/simple.json`
- `fixtures/simulation/realistic.json`

Se aggiungi nuovi scenari, mantieni i file piccoli e documenta qui lo scopo.