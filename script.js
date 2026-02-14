const API_URL = 'https://meet.baptisteaussant.com/api/status-data'; 

const statusColors = {
    operational: '#10B981',
    degraded_performance: '#F59E0B',
    partial_outage: '#F97316',
    major_outage: '#EF4444',
    offline: '#94a3b8' // Grey for offline/unknown
};

const statusLabels = {
    operational: 'Opérationnel',
    degraded_performance: 'Performance dégradée',
    partial_outage: 'Panne partielle',
    major_outage: 'Panne majeure',
    offline: 'Hors ligne'
};

let currentPeriod = '24h';
let updateInterval = null;
let chartData = null; // Store data for chart interaction
let isDataOffline = false; // Store offline state for chart

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

    // Chart Interaction
    const canvas = document.getElementById('response-chart');
    
    canvas.addEventListener('mousemove', (e) => {
        if (!chartData || chartData.length < 2) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        drawChart(chartData, isDataOffline, { x, y });
    });

    canvas.addEventListener('mouseleave', () => {
        if (!chartData) return;
        drawChart(chartData, isDataOffline, null); // Clear tooltip
    });

    // Polling every 60 seconds
    updateInterval = setInterval(fetchStatus, 60000);
});

async function fetchStatus() {
    try {
        const response = await fetch(`${API_URL}?period=${currentPeriod}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const json = await response.json();

        if (json.success) {
            // Save to cache
            localStorage.setItem('status_cache', JSON.stringify({
                timestamp: Date.now(),
                data: json.data
            }));
            
            updateUI(json.data);
            
            // Update timestamp
            const now = new Date();
            document.getElementById('last-updated').textContent = `Dernière vérification : ${now.toLocaleTimeString()}`;
        }
    } catch (error) {
        console.error('Failed to fetch status', error);
        handleOffline();
    }
}

function handleOffline() {
    // 1. Update Global Header
    document.getElementById('global-status-text').textContent = 'Hors ligne';
    document.getElementById('global-status-indicator').style.backgroundColor = statusColors.major_outage;
    document.getElementById('global-status-indicator').classList.remove('pulse');
    document.getElementById('last-updated').textContent = `Dernière tentative : ${new Date().toLocaleTimeString()} (Échec)`;
    
    // 2. Try to load cache
    const cached = localStorage.getItem('status_cache');
    let data = null;

    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            data = parsed.data;
            console.log('Loaded data from cache');
        } catch (e) {
            console.error('Cache parse error', e);
        }
    }

    if (!data) {
        // 3a. No cache -> serve default fallback
        data = {
            system: { status: 'offline' },
            components: [
                { name: 'API Core', status: 'offline' },
                { name: 'Database', status: 'offline' },
                { name: 'File Storage', status: 'offline' },
                { name: 'Background Tasks', status: 'offline' }
            ],
            history: []
        };
    } else {
        // 3b. Cache exists -> Mark everything as offline visually but keep names
        data.system.status = 'offline';
        data.components = data.components.map(c => ({ ...c, status: 'offline', responseTime: undefined }));
    }

    updateUI(data, true);
}

function updateUI(data, isOffline = false) {
    chartData = data.history; // Store for interaction
    isDataOffline = isOffline;

    // Update Header (Only if not already handled by handleOffline, or to reset if back online)
    if (!isOffline) {
        const systemStatus = data.system.status;
        const globalIndicator = document.getElementById('global-status-indicator');
        const globalText = document.getElementById('global-status-text');
        
        globalIndicator.style.backgroundColor = statusColors[systemStatus] || statusColors.operational;
        globalText.textContent = systemStatus === 'operational' ? 'Tous les systèmes sont opérationnels' : statusLabels[systemStatus];
        
        if (systemStatus === 'operational') {
            globalIndicator.className = 'status-indicator pulse';
        } else {
            globalIndicator.className = 'status-indicator';
        }
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
        if (isOffline) {
            name.style.color = '#999';
        }
        
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
        // Force offline color if offline
        statusText.style.color = isOffline ? statusColors.offline : (statusColors[component.status] || '#ccc');
        statusText.textContent = isOffline ? 'Hors ligne' : statusLabels[component.status];
        
        statusGroup.appendChild(statusText);
        
        item.appendChild(nameGroup);
        item.appendChild(statusGroup);
        componentsList.appendChild(item);
    });

    // Update Chart with historical data
    if (data.history) {
        drawChart(data.history, isOffline);
    }
}

// Canvas Chart with Graduation
const canvas = document.getElementById('response-chart');
const ctx = canvas.getContext('2d');

function drawChart(data, isOffline = false, mousePos = null) {
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
    let maxVal = Math.max(100, ...data.map(d => d.response_time)) * 1.2;
    if (isOffline) maxVal = Math.max(maxVal, 500);

    // Helper to map data to coordinates
    const timeStart = new Date(data[0].created_at).getTime();
    const timeEnd = new Date(data[data.length - 1].created_at).getTime();
    
    // If offline, use "now" as end of range to show gap until present
    const now = Date.now();
    const timeRange = (isOffline ? now : timeEnd) - timeStart;

    const getX = (time) => {
        return padding.left + ((time - timeStart) / timeRange) * chartWidth;
    };

    const getY = (val) => {
        return padding.top + chartHeight - (val / maxVal) * chartHeight;
    };

    // Draw Grid Lines (Y Axis)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
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

    // Draw Graph Line with GAP DETECTION
    ctx.beginPath();
    const GAP_THRESHOLD = 15 * 60 * 1000; // 15 minutes gap = broken line

    data.forEach((item, index) => {
        const time = new Date(item.created_at).getTime();
        const x = getX(time);
        const y = getY(item.response_time);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            const prevTime = new Date(data[index - 1].created_at).getTime();
            if (time - prevTime > GAP_THRESHOLD) {
                 // Gap detected: Stroke current path and start new one
                 ctx.stroke();
                 ctx.beginPath();
                 ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
    });
    
    ctx.strokeStyle = '#017EFF';
    if (isOffline) ctx.strokeStyle = '#94a3b8'; 
    ctx.lineWidth = 2;
    // Stroke the final segment
    ctx.stroke();

    // Draw X Axis Labels (Time)
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    
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

    // DRAW TOOLTIP if mousePos exists
    if (mousePos && mousePos.x >= padding.left && mousePos.x <= padding.left + chartWidth) {
        // Calculate exact time at mouse position
        const ratio = (mousePos.x - padding.left) / chartWidth;
        const timeAtCursor = timeStart + ratio * timeRange;
        
        // Find surrounding data points
        // data is sorted by created_at usually
        let p1 = null;
        let p2 = null;

        for (let i = 0; i < data.length - 1; i++) {
            const t1 = new Date(data[i].created_at).getTime();
            const t2 = new Date(data[i+1].created_at).getTime();
            // Check if we are inside a gap
            if (timeAtCursor >= t1 && timeAtCursor <= t2) {
                if (t2 - t1 > GAP_THRESHOLD) {
                    // We are in a gap! Don't show tooltip, or show "Data missing"
                    return; 
                }
                p1 = data[i];
                p2 = data[i+1];
                break;
            }
        }

        // If we found the interval and it's not a gap
        if (p1 && p2) {
            const t1 = new Date(p1.created_at).getTime();
            const t2 = new Date(p2.created_at).getTime();
            const factor = (timeAtCursor - t1) / (t2 - t1);
            
            const v1 = p1.response_time;
            const v2 = p2.response_time;
            const interpolatedValue = v1 + factor * (v2 - v1);

            const x = mousePos.x; // Exact mouse X
            const y = getY(interpolatedValue); // Encoded Y

            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.strokeStyle = isOffline ? '#94a3b8' : '#017EFF';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Circle at interpolated point
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.stroke();

            // Draw Tooltip Box
            const date = new Date(timeAtCursor);
            const timeStr = date.toLocaleTimeString();
            const dateStr = date.toLocaleDateString();
            const valStr = `${Math.round(interpolatedValue)} ms`;

            const tooltipText = `${dateStr} ${timeStr} - ${valStr}`;
            const textWidth = ctx.measureText(tooltipText).width;
            const boxWidth = textWidth + 20;
            const boxHeight = 25;

            // Position tooltip
            let boxX = x - boxWidth / 2;
            let boxY = y - 35;
            if (boxX < 0) boxX = 5;
            if (boxX + boxWidth > width) boxX = width - boxWidth - 5;
            if (boxY < 0) boxY = y + 15;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(tooltipText, boxX + boxWidth / 2, boxY + 16);
        }
    }
}
