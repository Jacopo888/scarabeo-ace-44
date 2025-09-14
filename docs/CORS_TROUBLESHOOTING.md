# Risoluzione Problemi CORS con Quackle AI

## Problema
Quando si accede al sito, appare l'errore: "Quackle AI non raggiungibile – controlla CORS_ORIGINS e l'URL del servizio"

## Cause Possibili

### 1. Dominio non autorizzato
Il servizio Quackle AI è configurato per accettare richieste solo da domini specifici. Se stai accedendo da un dominio non configurato, riceverai un errore CORS.

### 2. Configurazione CORS mancante
Il servizio potrebbe non avere la configurazione CORS corretta.

## Soluzioni

### Per Sviluppo Locale

#### Soluzione 1: Proxy Vite (Raccomandato)
Il progetto è già configurato con un proxy Vite che risolve automaticamente i problemi CORS durante lo sviluppo locale.

```bash
npm run dev
```

Il proxy inoltra le richieste da `http://localhost:5173/quackle/*` a `https://service-quackle-production.up.railway.app/*`, evitando completamente i problemi CORS.

#### Soluzione 2: Variabile d'ambiente
Puoi sovrascrivere l'URL del servizio Quackle:

```bash
VITE_QUACKLE_SERVICE_URL=http://localhost:5000 npm run dev
```

### Per Produzione

#### Aggiornare CORS_ORIGINS
Se stai deployando su un nuovo dominio, aggiorna la variabile `CORS_ORIGINS` in:

1. **Railway**: Aggiungi il nuovo dominio alla variabile `CORS_ORIGINS`
2. **Dockerfile**: Modifica `ENV CORS_ORIGINS` in `service-quackle/Dockerfile`
3. **railway.toml**: Aggiorna la variabile in `railway.toml`

Formato:
```
CORS_ORIGINS = "https://tuodominio.com,https://preview--tuodominio.com,http://localhost:5173"
```

#### Deploy delle Modifiche
Dopo aver aggiornato la configurazione CORS:

```bash
# Deploy su Railway
railway up

# Oppure rebuild del container
docker build -t service-quackle service-quackle/
```

## Verifica della Configurazione

### Test CORS
Usa lo script di test incluso:

```bash
node scripts/test-cors.mjs
```

### Endpoint di Debug
Il servizio espone endpoint per verificare la configurazione:

- `GET /health/cors` - Mostra gli origins CORS configurati
- `GET /debug/config` - Mostra la configurazione completa

### Test Manuale
```bash
# Test con curl
curl -H "Origin: https://tuodominio.com" https://service-quackle-production.up.railway.app/health

# Verifica header CORS nella risposta
curl -v -H "Origin: https://tuodominio.com" https://service-quackle-production.up.railway.app/health
```

## Domini Attualmente Configurati

- `https://scarabeo-ace-44.lovable.app`
- `https://preview--scarabeo-ace-44.lovable.app`
- `http://localhost:5173` (solo in sviluppo)
- `http://127.0.0.1:5173` (solo in sviluppo)

## Troubleshooting Avanzato

### 1. Verifica Network
```bash
# Test connettività
curl -I https://service-quackle-production.up.railway.app/health

# Test DNS
nslookup service-quackle-production.up.railway.app
```

### 2. Log del Servizio
Controlla i log del servizio Quackle per errori specifici:

```bash
# Se hai accesso ai log Railway
railway logs service-quackle
```

### 3. Browser DevTools
1. Apri DevTools (F12)
2. Vai alla tab Network
3. Prova a fare una richiesta
4. Controlla se ci sono errori CORS nella console

### 4. Test Preflight
Le richieste CORS complesse (POST, con headers personalizzati) richiedono un preflight request:

```bash
curl -X OPTIONS \
  -H "Origin: https://tuodominio.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://service-quackle-production.up.railway.app/best-move
```

## Configurazione CORS Completa

Il servizio è configurato con:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Questo significa che:
- ✅ Accetta richieste da domini configurati
- ✅ Supporta cookies e credenziali
- ✅ Accetta tutti i metodi HTTP
- ✅ Accetta tutti gli headers

## Contatti

Se il problema persiste, controlla:
1. I log del servizio Quackle
2. La configurazione di rete
3. Le impostazioni del browser
4. La configurazione del proxy/firewall
