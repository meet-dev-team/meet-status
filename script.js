const API_URL = 'https://meet.baptisteaussant.com/api/status-data'; 

const statusColors = {
    operational: '#10B981',
    degraded_performance: '#F59E0B',
    partial_outage: '#F97316',
    major_outage: '#EF4444'
};

const statusLabels = {
    operational: 'Opérationnel',
    degraded_performance: 'Performance dégradée',
    partial_outage: 'Panne partielle',
    major_outage: 'Panne majeure'
};

let currentPeriod = '24h';
let updateInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    
    // Setup period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPeriod = e.target.dataset.period;
            fetchStatus();
        });
    });

    // Polling every 60 seconds
    updateInterval = setInterval(fetchStatus, 60000);
});

async function fetchStatus() {
    try {
        const response = await fetch(`${API_URL}?period=${currentPeriod}`);
        const json = await response.json();

        if (json.success) {
            updateUI(json.data);
            
            // Update timestamp
            const now = new Date();
            document.getElementById('last-updated').textContent = `Dernière vérification : ${now.toLocaleTimeString()}`;
        }
    } catch (error) {
        console.error('Failed to fetch status', error);
        document.getElementById('global-status-text').textContent = 'Hors ligne';
        document.getElementById('global-status-indicator').style.backgroundColor = statusColors.major_outage;
        document.querySelector('.loading-state').textContent = 'Impossible de joindre le serveur Meet.';
        document.getElementById('last-updated').textContent = `Dernière tentative : ${new Date().toLocaleTimeString()} (Échec)`;
    }
}

function updateUI(data) {
    const systemStatus = data.system.status;
    
    // Update Header
    const globalIndicator = document.getElementById('global-status-indicator');
    const globalText = document.getElementById('global-status-text');
    
    globalIndicator.style.backgroundColor = statusColors[systemStatus] || statusColors.operational;
    globalText.textContent = systemStatus === 'operational' ? 'Tous les systèmes sont opérationnels' : statusLabels[systemStatus];
    
    if (systemStatus === 'operational') {
        globalIndicator.className = 'status-indicator pulse';
    } else {
        globalIndicator.className = 'status-indicator';
    }

    // Update Components List
    const componentsList = document.getElementById('components-list');
    componentsList.innerHTML = ''; // Clear current list

    data.components.forEach(component => {
        const item = document.createElement('div');
        item.className = 'component-item';
        
        const nameGroup = document.createElement('div');
        nameGroup.className = 'component-name-group';
        
        const name = document.createElement('span');
        name.className = 'component-name';
        name.textContent = component.name;
        
        nameGroup.appendChild(name);

        const statusGroup = document.createElement('div');
        statusGroup.className = 'component-status-group';

        if (component.responseTime !== undefined) {
             const ping = document.createElement('span');
             ping.className = 'component-ping';
             ping.textContent = `${component.responseTime}ms`;
             statusGroup.appendChild(ping);
        }

        const statusText = document.createElement('span');
        statusText.className = 'component-status';
        statusText.style.color = statusColors[component.status];
        statusText.textContent = statusLabels[component.status];
        
        statusGroup.appendChild(statusText);
        
        item.appendChild(nameGroup);
        item.appendChild(statusGroup);
        componentsList.appendChild(item);
    });

    // Update Chart with historical data
    if (data.history) {
        drawChart(data.history);
    }
}

// Canvas Chart with Graduation
const canvas = document.getElementById('response-chart');
const ctx = canvas.getContext('2d');

function drawChart(data) {
    // Reset canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) {
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Pas assez de données pour afficher le graphique', width / 2, height / 2);
        return;
    }

    // Determine Y scale (max response time)
    // Minimum 100ms, otherwise max from data + 20%
    const maxVal = Math.max(100, ...data.map(d => d.response_time)) * 1.2;

    // Helper to map data to coordinates
    const timeStart = new Date(data[0].created_at).getTime();
    const timeEnd = new Date(data[data.length - 1].created_at).getTime();
    const timeRange = timeEnd - timeStart;

    const getX = (item) => {
        const time = new Date(item.created_at).getTime();
        return padding.left + ((time - timeStart) / timeRange) * chartWidth;
    };

    const getY = (val) => {
        return padding.top + chartHeight - (val / maxVal) * chartHeight;
    };

    // Draw Grid Lines (Y Axis)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Draw 4 horizontal lines
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (i / 4) * chartHeight;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        
        // Y Axis Labels
        ctx.fillStyle = '#999';
        ctx.textAlign = 'right';
        ctx.font = '10px sans-serif';
        const val = Math.round(maxVal - (i / 4) * maxVal);
        ctx.fillText(val + 'ms', padding.left - 5, y + 4);
    }
    ctx.stroke();

    // Draw Graph Line
    ctx.beginPath();
    data.forEach((item, index) => {
        const x = getX(item);
        const y = getY(item.response_time);
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    
    ctx.strokeStyle = '#017EFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill Area under graph
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.fillStyle = 'rgba(1, 126, 255, 0.1)';
    ctx.fill();

    // Draw X Axis Labels (Time)
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    
    // Choose label format based on period
    const labelCount = 5;
    for (let i = 0; i < labelCount; i++) {
        const ratio = i / (labelCount - 1);
        const x = padding.left + ratio * chartWidth;
        const time = new Date(timeStart + ratio * timeRange);
        
        let label = '';
        if (currentPeriod === '24h') {
            label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            label = time.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }

        ctx.fillText(label, x, height - 10);
    }
}
