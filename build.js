const fs = require('fs');
const path = require('path');

// Lire le fichier .env s'il existe localement
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        // Ignorer les commentaires et lignes vides
        if (line.trim().startsWith('#') || !line.includes('=')) return;
        
        const [key, ...valueParts] = line.split('=');
        const envKey = key.trim();
        let envValue = valueParts.join('=').trim();
        
        // Nettoyer les guillemets éventuels
        if (envValue.startsWith('"') && envValue.endsWith('"')) envValue = envValue.slice(1, -1);
        if (envValue.startsWith("'") && envValue.endsWith("'")) envValue = envValue.slice(1, -1);
        
        if (!process.env[envKey]) {
            process.env[envKey] = envValue;
        }
    });
}

// Récupérer les variables d'environnement (avec valeurs par défaut)
const API_URL = process.env.API_URL || '/api/status-data';
const BACK_LINK = process.env.BACK_LINK || '/';

const configContent = `// Fichier généré automatiquement lors du build. Ne pas modifier.
window.APP_CONFIG = {
    API_URL: "${API_URL}",
    BACK_LINK: "${BACK_LINK}"
};
`;

fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
console.log('✅ config.js généré avec succès à partir des variables d\'environnement.');
