const fs = require('fs');
const path = require('path');

// Charger le fichier .env s'il existe (développement local)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) return;
        const [key, ...rest] = line.split('=');
        const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key.trim()]) process.env[key.trim()] = value;
    });
}

// Lire les variables (Vercel les injecte directement dans process.env)
const API_URL  = process.env.API_URL  || '/api/status-data';
const BACK_LINK = process.env.BACK_LINK || '/';

const output = `// Fichier généré automatiquement par build.js — ne pas modifier manuellement.
window.APP_CONFIG = {
    API_URL: "${API_URL}",
    BACK_LINK: "${BACK_LINK}"
};
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), output);
console.log(`✅ config.js généré → API_URL="${API_URL}", BACK_LINK="${BACK_LINK}"`);
