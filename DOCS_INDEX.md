# 📂 Guida alla Struttura Documentazione

Questo documento ti aiuta a navigare la documentazione del progetto scarabeo-ace-44.

---

## 🗂️ Struttura Principale

```
scarabeo-ace-44/
├── 📄 README.md                          # Documentazione principale del progetto
├── 📄 AGENTS.md                          # Linee guida per agenti AI
├── 📁 docs/                              # Documentazione tecnica
│   ├── 📁 refactoring-history/          # ⭐ Storico refactoring e semplificazioni
│   │   ├── README.md                    #    Indice della documentazione storica
│   │   ├── TODO_PROGRESS.md             #    Roadmap e tracking task
│   │   ├── SEMPLIFICAZIONE_COMPLETATA.md#    Report finale semplificazioni
│   │   └── GUIDA_DEBUG_GATING.md        #    Guida sistema gating debug
│   ├── CORE_MIGRATION.md                # Migrazione core scoring
│   ├── CORS_TROUBLESHOOTING.md          # Troubleshooting CORS
│   ├── DEBUG_LOGGER.md                  # Sistema debug logging
│   ├── FIX_QUACKLE_SCORE.md             # Fix scoring Quackle
│   ├── SCORE_ANALYSIS.md                # Analisi sistema scoring
│   └── SCORING_RULES.md                 # Regole calcolo punteggio
├── 📁 temp-logs/                         # ⚠️ File temporanei (NON committare)
│   ├── .gitignore                       #    Ignora tutti i log
│   ├── README.md                        #    Guida uso cartella temp
│   └── *.log, *.json                    #    Log e test temporanei
├── 📁 service-quackle/                   # Microservizio Quackle
│   └── README.md                        #    Documentazione servizio
├── 📁 rating-api/                        # API rating giocatori
├── 📁 specs/                             # Specifiche tecniche
└── 📁 src/                               # Codice sorgente frontend
```

---

## 🎯 Trova Rapidamente

### 📋 Per Task / Attività
**Storico refactoring e semplificazioni:**
→ `docs/refactoring-history/`

**Roadmap e tracking progressi:**
→ `docs/refactoring-history/TODO_PROGRESS.md`

**Report semplificazioni completate:**
→ `docs/refactoring-history/SEMPLIFICAZIONE_COMPLETATA.md`

### 🔧 Per Funzionalità

**Sistema di gating endpoint debug:**
→ `docs/refactoring-history/GUIDA_DEBUG_GATING.md`

**Calcolo punteggio Scrabble:**
→ `docs/SCORING_RULES.md`
→ `docs/SCORE_ANALYSIS.md`

**Debug logging:**
→ `docs/DEBUG_LOGGER.md`

**Integrazione Quackle:**
→ `service-quackle/README.md`
→ `docs/FIX_QUACKLE_SCORE.md`

### 🐛 Per Troubleshooting

**Problemi CORS:**
→ `docs/CORS_TROUBLESHOOTING.md`

**Problemi scoring:**
→ `docs/FIX_QUACKLE_SCORE.md`
→ `docs/SCORE_ANALYSIS.md`

**Log temporanei:**
→ `temp-logs/` (attenzione: non committare!)

### 🤖 Per Agenti AI

**Linee guida sviluppo:**
→ `AGENTS.md`

**Convenzioni e pattern:**
→ `docs/refactoring-history/README.md`

**Storico decisioni:**
→ `docs/refactoring-history/TODO_PROGRESS.md`

---

## 📚 Documentazione per Area

### Frontend (React + TypeScript)
- `src/` - Codice sorgente
- `docs/SCORING_RULES.md` - Regole UI scoring
- `docs/DEBUG_LOGGER.md` - Logging frontend

### Backend - Servizio Quackle
- `service-quackle/README.md` - Documentazione completa
- `docs/refactoring-history/GUIDA_DEBUG_GATING.md` - Debug endpoints
- `docs/FIX_QUACKLE_SCORE.md` - Fix scoring

### Backend - Rating API
- `rating-api/` - Codice e docs

### Refactoring & Manutenzione
- `docs/refactoring-history/` - Tutto lo storico
- `AGENTS.md` - Pattern e convenzioni

---

## 🆕 Aggiunte Recenti (4 Ottobre 2025)

### Nuove Cartelle
✨ **`docs/refactoring-history/`**
- Organizza tutta la documentazione storica
- Include roadmap, report e guide

⚠️ **`temp-logs/`**
- Workspace per log temporanei
- Non tracciata da git

### File Riorganizzati
- `TODO_PROGRESS.md` → `docs/refactoring-history/`
- `SEMPLIFICAZIONE_COMPLETATA.md` → `docs/refactoring-history/`
- `GUIDA_DEBUG_GATING.md` → `docs/refactoring-history/`
- Tutti i `*.log` → `temp-logs/`
- File test temporanei → `temp-logs/`

---

## 🔍 Cerca nel Progetto

### Per parola chiave:
```bash
# Cerca in tutta la documentazione
grep -r "keyword" docs/

# Cerca solo nello storico refactoring
grep -r "keyword" docs/refactoring-history/

# Cerca nei file markdown
find . -name "*.md" -exec grep -l "keyword" {} \;
```

### Per tipo di documento:
```bash
# Tutti i README
find . -name "README.md"

# Tutta la documentazione refactoring
ls docs/refactoring-history/

# Tutti i file markdown in docs/
find docs/ -name "*.md"
```

---

## 💡 Tips

### 📖 Leggi Prima
Nuovo al progetto? Inizia da:
1. `README.md` (root)
2. `AGENTS.md`
3. `docs/refactoring-history/README.md`

### 🛠️ Prima di Modificare
1. Controlla `docs/refactoring-history/TODO_PROGRESS.md`
2. Leggi `AGENTS.md` per convenzioni
3. Vedi esempi in `docs/refactoring-history/`

### 🐛 Debugging
1. Abilita debug console (vedi `GUIDA_DEBUG_GATING.md`)
2. Usa `temp-logs/` per log temporanei
3. Non committare file in `temp-logs/`!

---

## 🚀 Quick Links

| Documento | Scopo | Priorità |
|-----------|-------|----------|
| `README.md` | Overview progetto | ⭐⭐⭐ |
| `AGENTS.md` | Linee guida sviluppo | ⭐⭐⭐ |
| `docs/refactoring-history/README.md` | Storico refactoring | ⭐⭐ |
| `docs/SCORING_RULES.md` | Regole scoring | ⭐⭐ |
| `service-quackle/README.md` | API Quackle | ⭐⭐ |
| `docs/refactoring-history/TODO_PROGRESS.md` | Task tracking | ⭐ |

---

*Guida aggiornata: 4 Ottobre 2025*
