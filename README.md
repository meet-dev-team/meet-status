# 📊 MEET - Status Page

Page d'état et de disponibilité des services MEET en temps réel (API, base de données, stockage, tâches de fond).

---

## ⚡ Commandes Rapides

### 🔨 Build & Génération de configuration
```bash
# Générer le fichier config.js à partir des variables d'environnement
npm run build
```

### 🧪 Tests Automatisés
```bash
# Lancer tous les tests unitaires
npm test

# Lancer les tests en mode surveillance (watch)
npm run test:watch

# Générer le rapport de couverture de code
npm run test:coverage
```

---

## 🛠️ Configuration (.env)

Copiez le fichier `.env.example` en `.env` :
```bash
cp .env.example .env
```

| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `API_URL` | Endpoint retournant le JSON d'état du système | `/api/status-data` |
| `BACK_LINK` | URL de retour vers le site principal MEET | `/` |

---

## 📁 Architecture des Tests (`/tests`)

- `tests/build.test.js` : Test du script de build `build.js` (génération de `config.js`, variables et fallbacks).
- `tests/script.test.js` : Test de la logique client `script.js` (palette de statuts, affichage hors ligne, rafraîchissement DOM).
