/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

describe('meet-status: build.js', () => {
  const configPath = path.join(__dirname, '../config.js');
  const envPath = path.join(__dirname, '../.env');
  const originalEnv = { ...process.env };
  let originalEnvFile = null;

  beforeAll(() => {
    if (fs.existsSync(envPath)) {
      originalEnvFile = fs.readFileSync(envPath, 'utf8');
    }
  });

  afterAll(() => {
    process.env = originalEnv;
    if (originalEnvFile !== null) {
      fs.writeFileSync(envPath, originalEnvFile);
    }
  });

  beforeEach(() => {
    jest.resetModules();
    delete process.env.API_URL;
    delete process.env.BACK_LINK;
  });

  it('génère config.js avec les valeurs par défaut si aucune variable n\'est définie', () => {
    // Si un .env existe pendant le test, on le renomme temporairement ou on simule l'absence
    const tempEnvPath = path.join(__dirname, '../.env.test-tmp');
    const hadEnv = fs.existsSync(envPath);
    if (hadEnv) {
      fs.renameSync(envPath, tempEnvPath);
    }

    try {
      require('../build.js');

      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('window.APP_CONFIG');
      expect(content).toContain('API_URL: "/api/status-data"');
      expect(content).toContain('BACK_LINK: "/"');
    } finally {
      if (hadEnv && fs.existsSync(tempEnvPath)) {
        fs.renameSync(tempEnvPath, envPath);
      }
    }
  });

  it('injecte les variables d\'environnement API_URL et BACK_LINK dans config.js', () => {
    process.env.API_URL = 'https://api.meet.fr/status';
    process.env.BACK_LINK = 'https://meet.fr';

    require('../build.js');

    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toContain('API_URL: "https://api.meet.fr/status"');
    expect(content).toContain('BACK_LINK: "https://meet.fr"');
  });
});
