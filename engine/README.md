# Scarabeo Engine (Piano A - baked-in lexicon)

## Avvio locale (senza Quackle reale)

1) Copia il tuo dizionario GADDAG in `engine/lexica/enable1.gaddag`.
2) Build:
```bash
docker build -t scarabeo-engine:dev -f engine/Dockerfile engine
```

3) Run:
```bash
docker run --rm -p 8080:8080 scarabeo-engine:dev
```

4) Test:
```bash
curl -s http://localhost:8080/healthz
curl -s -X POST http://localhost:8080/api/v1/move \
  -H "content-type: application/json" \
  -d '{"board": [["" for _ in range(15)] for _ in range(15)], "rack":"CIAOXYZ", "bag":"", "turn":"me", "limit_ms":800, "ruleset":"it", "top_n":5 }'
```

Esempio payload Python (15x15 vuota + rack):
```python
import requests
board = [["" for _ in range(15)] for _ in range(15)]
resp = requests.post("http://localhost:8080/api/v1/move", json={
  "board": board,
  "rack": "CIAOXYZ",
  "bag": "",
  "turn": "me",
  "limit_ms": 800,
  "ruleset": "it",
  "top_n": 5
})
print(resp.json())
```

## Deploy Railway

- Configura repo con `engine/` e abilita deploy da Dockerfile.
- **Nessun volume richiesto**. Il lexicon è incluso nell’immagine.
- Imposta `RULESET` e `GADDAG_PATH` (già corretti di default).

## TODO per integrare Quackle

- Build del core Quackle da submodule senza Qt; wrapper linka lib statica.
- Macro usate: `QUACKLE_NO_QT`; compilazione con `-fPIC`.
- Librerie runtime richieste: ICU e Boost (regex, filesystem, system).
- Il wrapper `engine.cpp` carica GADDAG una volta e usa `Generator::kibitz`.
- I/O JSON line-based su stdin/stdout, una riga = una richiesta/risposta.

### Note build
- Submodule: `third_party/quackle` (CMake Release).
- Include paths: `src`, `src/libquackle`, `src/libquackle/include`.
- App data copiati dal repo Quackle non necessari in Piano A, ma supportati via `QUACKLE_APPDATA_DIR` se presenti.

## Build invariants

- Esegui prima:
```bash
git submodule update --init --recursive
```
- Il file `engine/lexica/enable1.gaddag` deve esistere prima del build.
- Il builder compila `third_party/quackle` e produce `third_party/quackle/build/liblibquackle.a`.
- `engine/quackle_wrapper/CMakeLists.txt` importa la lib da `${QUACKLE_BUILD_DIR}/liblibquackle.a` e include `${QUACKLE_ROOT}` (mai `${QUACKLE_ROOT}/src`).


