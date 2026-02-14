const API_URL = 'https://meet.baptisteaussant.com/api/status-data';

const statusColors = {
    operational: '#10B981',
    degraded_performance: '#F59E0B',
    partial_outage: '#F97316',
    major_outage: '#EF4444',
    offline: '#94a3b8'
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
let chartData = null;
let isDataOffline = false;
let isTouching = false; // Pour empêcher le scroll pendant le touch sur le canvas

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

    // Chart Interaction - MOUSE
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
        drawChart(chartData, isDataOffline, null);
    });

    // Chart Interaction - TOUCH (Mobile) - VERSION OPTIMISÉE
    let touchTimeout = null;

    canvas.addEventListener('touchstart', (e) => {
        if (!chartData || chartData.length < 2) return;
        
        // Empêcher le scroll SEULEMENT si on touche le canvas
        e.preventDefault();
        isTouching = true;
        
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        drawChart(chartData, isDataOffline, { x, y });
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (!chartData || chartData.length < 2 || !isTouching) return;
        
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Throttle le redraw pour éviter les lags
        if (touchTimeout) return;
        
        touchTimeout = setTimeout(() => {
            drawChart(chartData, isDataOffline, { x, y });
            touchTimeout = null;
        }, 16); // ~60fps
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouching = false;
        
        if (!chartData) return;
        
        // Garder le tooltip visible un instant avant de le cacher
        setTimeout(() => {
            if (!isTouching) {
                drawChart(chartData, isDataOffline, null);
            }
        }, 1500); // Tooltip reste visible 1.5 secondes après le lift
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        isTouching = false;
        if (!chartData) return;
        drawChart(chartData, isDataOffline, null);
    }, { passive: false });

    // Améliorer le style du canvas sur mobile
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';

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
            document.getElementById('last-updated').textContent = `Dernière vérification : ${now.toLocaleTimeString('fr-FR')}`;
        }
        
    } catch (error) {
        console.error('Failed to fetch status', error);
        handleOffline();
    }
}

function handleOffline() {
    document.getElementById('global-status-text').textContent = 'Hors ligne';
    document.getElementById('global-status-indicator').style.backgroundColor = statusColors.major_outage;
    document.getElementById('global-status-indicator').classList.remove('pulse');
    document.getElementById('last-updated').textContent = `Dernière tentative : ${new Date().toLocaleTimeString('fr-FR')} (Échec)`;

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
        data.system.status = 'offline';
        data.components = data.components.map(c => ({ ...c, status: 'offline', responseTime: undefined }));
    }

    updateUI(data, true);
}

function updateUI(data, isOffline = false) {
    chartData = data.history;
    isDataOffline = isOffline;

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

    const componentsList = document.getElementById('components-list');
    componentsList.innerHTML = '';

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
        statusText.style.color = isOffline ? statusColors.offline : (statusColors[component.status] || '#ccc');
        statusText.textContent = isOffline ? 'Hors ligne' : statusLabels[component.status];
        statusGroup.appendChild(statusText);

        item.appendChild(nameGroup);
        item.appendChild(statusGroup);
        componentsList.appendChild(item);
    });

    if (data.history) {
        drawChart(data.history, isOffline);
    }
}

// Canvas Chart
const canvas = document.getElementById('response-chart');
const ctx = canvas.getContext('2d');

function drawChart(data, isOffline = false, mousePos = null) {
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

    const hasGapMarkers = data.some(d => d.is_gap === true);
    const realDataPoints = hasGapMarkers ? data.filter(d => !d.is_gap) : data;

    if (realDataPoints.length < 2) {
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.font = '14px sans-serif';
        ctx.fillText('Pas assez de données pour afficher le graphique', width / 2, height / 2);
        return;
    }

    let maxVal = Math.max(100, ...realDataPoints.map(d => d.response_time)) * 1.2;
    if (isOffline) maxVal = Math.max(maxVal, 500);

    const timeStart = new Date(realDataPoints[0].created_at).getTime();
    const timeEnd = new Date(realDataPoints[realDataPoints.length - 1].created_at).getTime();
    
    const now = Date.now();
    const timeRange = (isOffline ? now : timeEnd) - timeStart;

    const getX = (time) => {
        return padding.left + ((time - timeStart) / timeRange) * chartWidth;
    };

    const getY = (val) => {
        return padding.top + chartHeight - (val / maxVal) * chartHeight;
    };

    // Draw Grid Lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (i / 4) * chartHeight;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        
        ctx.fillStyle = '#999';
        ctx.textAlign = 'right';
        ctx.font = '10px sans-serif';
        const val = Math.round(maxVal - (i / 4) * maxVal);
        ctx.fillText(val + 'ms', padding.left - 5, y + 4);
    }
    ctx.stroke();

    // Draw Graph Line
    const defaultColor = isOffline ? '#94a3b8' : '#017EFF';
    ctx.strokeStyle = defaultColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();

    if (hasGapMarkers) {
        // Nouveau système avec marqueurs de gap
        let lastRealPointIndex = 0;

        data.forEach((item, index) => {
            if (item.is_gap) {
                ctx.stroke();
                
                const startTime = new Date(item.created_at).getTime();
                const endTime = new Date(item.created_at_end).getTime();
                const startX = getX(startTime);
                const endX = getX(endTime);
                
                let prevY = padding.top + chartHeight / 2;
                let nextY = padding.top + chartHeight / 2;
                
                for (let i = lastRealPointIndex; i < realDataPoints.length; i++) {
                    const pointTime = new Date(realDataPoints[i].created_at).getTime();
                    if (pointTime <= startTime) {
                        prevY = getY(realDataPoints[i].response_time);
                        lastRealPointIndex = i;
                    } else {
                        nextY = getY(realDataPoints[i].response_time);
                        break;
                    }
                }
                
                ctx.beginPath();
                ctx.moveTo(startX, prevY);
                ctx.lineTo(endX, nextY);
                ctx.strokeStyle = '#EF4444';
                ctx.lineWidth = 3; // Ligne plus épaisse sur mobile
                ctx.setLineDash([6, 6]); // Pointillés plus visibles
                ctx.stroke();
                
                ctx.beginPath();
                ctx.strokeStyle = defaultColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.moveTo(endX, nextY);
                
                return;
            }

            const time = new Date(item.created_at).getTime();
            const x = getX(time);
            const y = getY(item.response_time);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevItem = data[index - 1];
                if (prevItem && prevItem.is_gap) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
    } else {
        // Ancien système - détection client-side
        const GAP_THRESHOLD = 15 * 60 * 1000;

        realDataPoints.forEach((item, index) => {
            const time = new Date(item.created_at).getTime();
            const x = getX(time);
            const y = getY(item.response_time);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevItem = realDataPoints[index - 1];
                const prevTime = new Date(prevItem.created_at).getTime();
                
                if (time - prevTime > GAP_THRESHOLD) {
                    ctx.stroke();

                    const prevX = getX(prevTime);
                    const prevY = getY(prevItem.response_time);

                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = '#EF4444';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([6, 6]);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.strokeStyle = defaultColor;
                    ctx.lineWidth = 2;
                    ctx.setLineDash([]);
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
    }
    
    ctx.stroke();

    // Draw X Axis Labels
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    
    let labelCount = 5;
    if (currentPeriod === '7d') labelCount = 7;
    if (currentPeriod === '30d') labelCount = 6;
    
    for (let i = 0; i < labelCount; i++) {
        const ratio = i / (labelCount - 1);
        const x = padding.left + ratio * chartWidth;
        const time = new Date(timeStart + ratio * timeRange);
        
        let label = '';
        if (currentPeriod === '24h') {
            label = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        } else if (currentPeriod === '7d') {
            label = time.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
        } else if (currentPeriod === '30d') {
            label = time.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        }

        ctx.fillText(label, x, height - 10);
    }

    // DRAW TOOLTIP
    if (mousePos && mousePos.x >= padding.left && mousePos.x <= padding.left + chartWidth) {
        const ratio = (mousePos.x - padding.left) / chartWidth;
        const timeAtCursor = timeStart + ratio * timeRange;
        
        let p1 = null;
        let p2 = null;
        let isInGap = false;

        if (hasGapMarkers) {
            for (let i = 0; i < data.length; i++) {
                if (data[i].is_gap) {
                    const gapStart = new Date(data[i].created_at).getTime();
                    const gapEnd = new Date(data[i].created_at_end).getTime();
                    if (timeAtCursor >= gapStart && timeAtCursor <= gapEnd) {
                        isInGap = true;
                        break;
                    }
                }
            }
        } else {
            const GAP_THRESHOLD = 15 * 60 * 1000;
            for (let i = 0; i < realDataPoints.length - 1; i++) {
                const t1 = new Date(realDataPoints[i].created_at).getTime();
                const t2 = new Date(realDataPoints[i+1].created_at).getTime();
                if (timeAtCursor >= t1 && timeAtCursor <= t2 && (t2 - t1 > GAP_THRESHOLD)) {
                    isInGap = true;
                    break;
                }
            }
        }

        if (isInGap) {
            return;
        }

        for (let i = 0; i < realDataPoints.length - 1; i++) {
            const t1 = new Date(realDataPoints[i].created_at).getTime();
            const t2 = new Date(realDataPoints[i+1].created_at).getTime();
            
            if (timeAtCursor >= t1 && timeAtCursor <= t2) {
                p1 = realDataPoints[i];
                p2 = realDataPoints[i+1];
                break;
            }
        }

        if (p1 && p2) {
            const t1 = new Date(p1.created_at).getTime();
            const t2 = new Date(p2.created_at).getTime();
            const factor = (timeAtCursor - t1) / (t2 - t1);
            
            const v1 = p1.response_time;
            const v2 = p2.response_time;
            const interpolatedValue = v1 + factor * (v2 - v1);

            const x = mousePos.x;
            const y = getY(interpolatedValue);

            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.strokeStyle = isOffline ? '#94a3b8' : '#017EFF';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Circle
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2); // Plus grand sur mobile
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = isOffline ? '#94a3b8' : '#017EFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw Tooltip Box
            const date = new Date(timeAtCursor);
            const timeStr = date.toLocaleTimeString('fr-FR');
            const dateStr = date.toLocaleDateString('fr-FR');
            const valStr = `${Math.round(interpolatedValue)} ms`;

            const tooltipText = `${dateStr} ${timeStr} - ${valStr}`;
            ctx.font = '12px sans-serif'; // Font plus grande sur mobile
            const textWidth = ctx.measureText(tooltipText).width;
            const boxWidth = textWidth + 24;
            const boxHeight = 30;

            let boxX = x - boxWidth / 2;
            let boxY = y - 45;
            if (boxX < 5) boxX = 5;
            if (boxX + boxWidth > width - 5) boxX = width - boxWidth - 5;
            if (boxY < 5) boxY = y + 20;

            // Ombre du tooltip
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6);
            ctx.fill();

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(tooltipText, boxX + boxWidth / 2, boxY + 19);
        }
    }
}
