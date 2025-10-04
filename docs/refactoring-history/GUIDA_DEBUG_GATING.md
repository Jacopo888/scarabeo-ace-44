# Guida Rapida: Nuove Funzionalità Debug & Configurazione

## 🐛 Sistema di Gating Endpoint Debug

### Come Funziona

Gli endpoint `/debug/*` sono ora **condizionalmente esposti** in base all'ambiente:

```
┌─────────────────────────────────────────────────────────┐
│  LOGICA DI GATING                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  if DEBUG_ROUTES=true OR ENV != "prod":                │
│      ✅ Esponi /debug/* (13 endpoint)                   │
│  else:                                                  │
│      ❌ NON esporre /debug/* (404)                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configurazione

**File:** `service-quackle/.env` (o variabili d'ambiente)

```bash
# Ambiente applicazione (prod, dev, staging)
ENV=dev

# Forza abilitazione debug anche in prod (sconsigliato)
DEBUG_ROUTES=false
```

### Scenari

#### 🔒 Produzione (Debug Disabilitati)
```bash
ENV=prod
DEBUG_ROUTES=false  # o non impostato
```
**Risultato:**
- `/health` → ✅ 200 OK
- `/best-move` → ✅ 200 OK
- `/debug/ping` → ❌ 404 Not Found

**Log startup:**
```
[INFO] [startup] 🔒 Debug routes DISABLED (production mode, ENV=prod)
```

#### 🐛 Sviluppo (Debug Auto-Abilitati)
```bash
ENV=dev
```
**Risultato:**
- `/health` → ✅ 200 OK
- `/best-move` → ✅ 200 OK
- `/debug/ping` → ✅ 200 OK

**Log startup:**
```
[INFO] [startup] 🐛 Debug routes ENABLED (DEBUG_ROUTES=False, ENV=dev)
```

#### 🔓 Produzione con Override (Debug Forzati)
```bash
ENV=prod
DEBUG_ROUTES=true
```
**Risultato:**
- Tutti gli endpoint esposti (inclusi `/debug/*`)

**Log startup:**
```
[INFO] [startup] 🐛 Debug routes ENABLED (DEBUG_ROUTES=True, ENV=prod)
```

⚠️ **ATTENZIONE:** Usare solo per troubleshooting temporaneo!

---

## 📦 Payload Semplificato: Solo `bag_pool`

### Prima (Ridondante)
```json
{
  "rack": "AEIRSTZ",
  "board": { "8,8": {"letter": "A", "isBlank": false} },
  "bag_count": 93,     ← RIMOSSO
  "bag_pool": ["A", "A", "E", ...]
}
```

### Dopo (Semplificato)
```json
{
  "rack": "AEIRSTZ",
  "board": { "8,8": {"letter": "A", "isBlank": false} },
  "bag_pool": ["A", "A", "E", ...]
}
```

**Nota:** `bag_count` viene derivato automaticamente: `len(bag_pool)`

### Migrazione Codice Client

**Prima:**
```typescript
const payload = {
  rack: formatRack(rack),
  board: buildBoard(gameState),
  bag_count: bagTiles.length,  // ❌ Rimuovere
  bag_pool: bagTiles
}
```

**Dopo:**
```typescript
const payload = {
  rack: formatRack(rack),
  board: buildBoard(gameState),
  bag_pool: bagTiles  // ✅ Unico parametro necessario
}
```

---

## 🧪 Testing

### Verificare Gating Debug

```python
from fastapi.testclient import TestClient
from quackle_service.main import app

client = TestClient(app)

# In dev mode
os.environ['ENV'] = 'dev'
r = client.get('/debug/ping')
assert r.status_code == 200  # ✅ Disponibile

# In prod mode
os.environ['ENV'] = 'prod'
r = client.get('/debug/ping')
assert r.status_code == 404  # ❌ Non disponibile
```

### Verificare Payload Semplificato

```python
# Non è più necessario inviare bag_count
payload = {
    "rack": "AEIRSTZ",
    "board": {},
    "bag_pool": ["E", "I", "O"]  # Solo questo
}

r = client.post('/best-move', json=payload)
assert r.status_code == 200  # ✅ Funziona
```

---

## 🎨 Logging con Emoji (Visibilità Console)

I log sono ora più leggibili grazie agli emoji:

```
[INFO] [startup] 🐛 Debug routes ENABLED (DEBUG_ROUTES=True, ENV=dev)
[INFO] [startup] 🔒 Debug routes DISABLED (production mode, ENV=prod)
[INFO] [ACCESS] GET /health
[INFO] [ACCESS] POST /best-move len=245
```

**Benefici:**
- ✅ Identificazione rapida dello stato debug
- ✅ Visibilità immediata in sviluppo
- ✅ Facilitazione troubleshooting

---

## 🚀 Deploy su Heroku/Railway

### Produzione
```bash
heroku config:set ENV=prod
heroku config:set DEBUG_ROUTES=false  # o non impostare
```

### Staging (con debug)
```bash
heroku config:set ENV=staging
# DEBUG_ROUTES non necessario, auto-abilitato per ENV != prod
```

### Troubleshooting Temporaneo
```bash
# Abilita debug in produzione TEMPORANEAMENTE
heroku config:set DEBUG_ROUTES=true

# Verifica con curl
curl https://service-quackle-xxx.herokuapp.com/debug/ping

# RICORDA: Disabilitare dopo troubleshooting
heroku config:unset DEBUG_ROUTES
```

---

## 📊 Endpoint Disponibili

### Sempre Esposti
- `GET /health` - Status del servizio
- `POST /best-move` - Calcolo mossa migliore
- `POST /bag/summary` - Riassunto tessere rimanenti
- `GET /health/cors` - Configurazione CORS
- `GET /health/lexicon` - Status lessico

### Solo in Non-Produzione (o DEBUG_ROUTES=true)
- `GET /debug/ping` - Healthcheck debug
- `GET /debug/strategy` - Inventario file strategia
- `GET /debug/config` - Configurazione corrente
- `GET /debug/ldd` - Dipendenze binario (se DEBUG_ENABLE_LDD=true)
- `GET /debug/selftest` - Self-test engine
- `POST /debug/probe` - Analisi payload
- `POST /debug/bridge-payload` - Normalizzazione payload
- `POST /debug/bag-payload` - Calcolo bag helper
- `GET /debug/quackle` - Info runtime Quackle
- `GET /debug/strategy-probe` - Probe strategia
- `GET /debug/engine-config` - Configurazione engine
- `GET /debug/sample-moves` - Mosse di esempio
- `GET /debug/latency` - Snapshot latenza

---

## ✅ Checklist Post-Deploy

- [ ] Verificare `ENV=prod` in produzione
- [ ] Confermare `/debug/ping` restituisce 404
- [ ] Controllare log startup per emoji 🔒
- [ ] Testare `/health` e `/best-move` (200 OK)
- [ ] Verificare payload senza `bag_count`

---

*Guida aggiornata al 4 Ottobre 2025*
