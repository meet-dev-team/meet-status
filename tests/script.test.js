/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

describe('meet-status: script.js', () => {
  let htmlContent;

  beforeAll(() => {
    htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  });

  beforeEach(() => {
    jest.resetModules();
    document.documentElement.innerHTML = htmlContent;

    // Mock localStorage
    const storage = {};
    window.localStorage = {
      getItem: jest.fn((key) => storage[key] || null),
      setItem: jest.fn((key, value) => { storage[key] = value.toString(); }),
      removeItem: jest.fn((key) => { delete storage[key]; }),
      clear: jest.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); })
    };

    // Mock fetch
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          system: { status: 'operational', uptime: '99.99%' },
          components: [],
          history: []
        }
      })
    }));

    // Mock HTMLCanvasElement.getContext
    const mockCtx = {
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      arc: jest.fn(),
      fillText: jest.fn(),
      measureText: jest.fn(() => ({ width: 50 })),
      createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      setLineDash: jest.fn(),
      roundRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      closePath: jest.fn(),
      rect: jest.fn()
    };
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);

    window.APP_CONFIG = {
      API_URL: '/api/status-data',
      BACK_LINK: 'https://meet.fr'
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  function loadScript() {
    const rawCode = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
    // Rendre les variables et fonctions accessibles sur window pour les assertions
    const adaptedCode = rawCode
      .replace(/^const /gm, 'window.')
      .replace(/^let /gm, 'window.')
      .replace(/^function ([a-zA-Z0-9_]+)/gm, 'window.$1 = function');
    window.eval(adaptedCode);
  }

  it('charge la configuration et initialise les éléments du DOM', () => {
    loadScript();

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const backLink = document.getElementById('back-to-site-link');
    if (backLink) {
      expect(backLink.href).toBe('https://meet.fr/');
    }
  });

  it('définit les couleurs et libellés de statuts valides', () => {
    loadScript();

    expect(window.statusColors).toBeDefined();
    expect(window.statusColors.operational).toBe('#10B981');
    expect(window.statusColors.major_outage).toBe('#EF4444');

    expect(window.statusLabels).toBeDefined();
    expect(window.statusLabels.operational).toBe('Opérationnel');
    expect(window.statusLabels.offline).toBe('Hors ligne');
  });

  it('gère l\'état hors ligne lors d\'une erreur réseau (handleOffline)', () => {
    loadScript();

    window.handleOffline();

    const statusText = document.getElementById('global-status-text');
    expect(statusText.textContent).toBe('Hors ligne');

    const statusIndicator = document.getElementById('global-status-indicator');
    expect(statusIndicator.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('met à jour l\'interface avec des données opérationnelles (updateUI)', () => {
    loadScript();

    const mockData = {
      system: {
        status: 'operational',
        uptime: '99.98%'
      },
      components: [
        { name: 'API Core', status: 'operational', responseTime: '45ms' },
        { name: 'Database', status: 'operational', responseTime: '12ms' }
      ],
      history: [
        { timestamp: Date.now() - 3600000, responseTime: 50 },
        { timestamp: Date.now(), responseTime: 42 }
      ]
    };

    window.updateUI(mockData, false);

    const statusText = document.getElementById('global-status-text');
    expect(statusText.textContent).toBe('Tous les systèmes sont opérationnels');
  });
});
