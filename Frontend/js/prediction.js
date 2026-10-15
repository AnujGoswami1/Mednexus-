// ===== PREDICTIONS MODULE =====
// Handles all AI prediction visualizations and data fetching
// Used by both hospital dashboard and can be embedded anywhere

const PredictionEngine = {
    
    // Cache for prediction data
    cache: {},
    charts: {},

    // ===== FETCH PREDICTIONS =====

    async fetchLSTMPredictions(hospitalId, hours = 24) {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No auth token for predictions');
            return null;
        }

        try {
            const res = await fetch(`/api/predict/beds/${hospitalId}?hours=${hours}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            this.cache[`lstm_${hospitalId}`] = data;
            return data;
        } catch (err) {
            console.error('LSTM prediction fetch error:', err);
            return this.generateFallbackLSTM(hospitalId, hours);
        }
    },

    async fetchARIMAPredictions(hospitalId, days = 14) {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const res = await fetch(`/api/predict/trend/${hospitalId}?days=${days}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            this.cache[`arima_${hospitalId}`] = data;
            return data;
        } catch (err) {
            console.error('ARIMA prediction fetch error:', err);
            return this.generateFallbackARIMA(hospitalId, days);
        }
    },

    async fetchPatientPredictions(hospitalId, days = 7) {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const res = await fetch(`/api/predict/patients/${hospitalId}?days=${days}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            this.cache[`patients_${hospitalId}`] = data;
            return data;
        } catch (err) {
            console.error('Patient prediction fetch error:', err);
            return this.generateFallbackPatients(hospitalId, days);
        }
    },

    async fetchCombinedPredictions(hospitalId) {
        const token = localStorage.getItem('token');
        if (!token) return null;

        try {
            const res = await fetch(`/api/predict/combined/${hospitalId}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            this.cache[`combined_${hospitalId}`] = data;
            return data;
        } catch (err) {
            console.error('Combined prediction fetch error:', err);
            return null;
        }
    },

    // ===== FALLBACK DATA GENERATORS =====
    // Used when API is unavailable or models aren't trained

    generateFallbackLSTM(hospitalId, hours) {
        const predictions = [];
        const now = new Date();
        const baseBeds = 100;
        const baseOccupancy = 0.65;

        for (let i = 1; i <= hours; i++) {
            const predTime = new Date(now.getTime() + i * 3600000);
            const hour = predTime.getHours();

            // Simulate realistic patterns
            let occupancyModifier = 0;
            if (hour >= 8 && hour <= 12) {
                occupancyModifier = 0.12;
            } else if (hour >= 13 && hour <= 17) {
                occupancyModifier = 0.08;
            } else if (hour >= 18 && hour <= 22) {
                occupancyModifier = 0.04;
            } else {
                occupancyModifier = -0.05;
            }

            const noise = (Math.random() - 0.5) * 0.06;
            const rate = Math.min(0.95, Math.max(0.15, baseOccupancy + occupancyModifier + noise));
            const available = Math.max(1, Math.round(baseBeds * (1 - rate)));

            predictions.push({
                hour: i,
                timestamp: predTime.toISOString(),
                predicted_occupancy_rate: Math.round(rate * 1000) / 10,
                predicted_available_beds: available,
                predicted_occupied_beds: baseBeds - available,
                confidence: Math.round(Math.max(0.7, 0.95 - (i * 0.008)) * 100) / 100
            });
        }

        return {
            hospital_id: hospitalId,
            hospital_name: 'Hospital',
            total_beds: baseBeds,
            model: 'LSTM (Fallback)',
            predictions: predictions
        };
    },

    generateFallbackARIMA(hospitalId, days) {
        const predictions = [];
        const now = new Date();
        const baseBeds = 100;
        const baseAvailable = 35;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 1; i <= days; i++) {
            const predDate = new Date(now.getTime() + i * 86400000);
            const dow = predDate.getDay();

            let modifier = 0;
            if (dow === 0 || dow === 6) {
                modifier = 8; // Weekends: more available
            } else {
                modifier = -3; // Weekdays: less available
            }

            const seasonal = 5 * Math.sin(2 * Math.PI * i / 30);
            const noise = (Math.random() - 0.5) * 6;
            const available = Math.max(2, Math.min(Math.round(baseAvailable + modifier + seasonal + noise), baseBeds - 5));
            const occupancyRate = Math.round((1 - available / baseBeds) * 1000) / 10;

            predictions.push({
                day: i,
                date: predDate.toISOString().split('T')[0],
                day_name: dayNames[dow],
                predicted_available_beds: available,
                predicted_occupancy_rate: occupancyRate,
                confidence: Math.round(Math.max(0.55, 0.90 - (i * 0.025)) * 100) / 100,
                model: 'ARIMA (Fallback)'
            });
        }

        return {
            hospital_id: hospitalId,
            hospital_name: 'Hospital',
            total_beds: baseBeds,
            model: 'ARIMA (Fallback)',
            predictions: predictions,
            trend: {
                trend: 'stable',
                change_rate: -2.5,
                current_available: baseAvailable,
                avg_7day: baseAvailable + 2,
                alert: false,
                alert_message: ''
            }
        };
    },

    generateFallbackPatients(hospitalId, days) {
        const predictions = [];
        const now = new Date();
        const basePatients = 45;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 1; i <= days; i++) {
            const predDate = new Date(now.getTime() + i * 86400000);
            const dow = predDate.getDay();

            let factor = 1.0;
            if (dow >= 1 && dow <= 5) {
                factor = 1.1;
            } else if (dow === 6) {
                factor = 0.8;
            } else {
                factor = 0.7;
            }

            const seasonal = 1 + 0.15 * Math.sin(2 * Math.PI * i / 30);
            const noise = 0.85 + Math.random() * 0.3;
            const predicted = Math.max(5, Math.round(basePatients * factor * seasonal * noise));

            predictions.push({
                day: i,
                date: predDate.toISOString().split('T')[0],
                day_name: dayNames[dow],
                predicted_patients: predicted,
                confidence: Math.round(Math.max(0.6, 0.92 - (i * 0.04)) * 100) / 100
            });
        }

        return {
            hospital_id: hospitalId,
            hospital_name: 'Hospital',
            model: 'LSTM (Fallback)',
            predictions: predictions
        };
    },

    // ===== CHART RENDERERS =====

    renderLSTMChart(canvasId, predictions, totalBeds) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return;
        }

        const ctx = canvas.getContext('2d');

        // Create gradient fills
        const availGradient = ctx.createLinearGradient(0, 0, 0, 280);
        availGradient.addColorStop(0, 'rgba(0, 200, 83, 0.3)');
        availGradient.addColorStop(1, 'rgba(0, 200, 83, 0.01)');

        const occGradient = ctx.createLinearGradient(0, 0, 0, 280);
        occGradient.addColorStop(0, 'rgba(255, 23, 68, 0.3)');
        occGradient.addColorStop(1, 'rgba(255, 23, 68, 0.01)');

        const confGradient = ctx.createLinearGradient(0, 0, 0, 280);
        confGradient.addColorStop(0, 'rgba(108, 99, 255, 0.2)');
        confGradient.addColorStop(1, 'rgba(108, 99, 255, 0.01)');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: predictions.map(p => `+${p.hour}h`),
                datasets: [
                    {
                        label: 'Available Beds',
                        data: predictions.map(p => p.predicted_available_beds),
                        borderColor: '#00c853',
                        backgroundColor: availGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 1,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#00c853'
                    },
                    {
                        label: 'Occupied Beds',
                        data: predictions.map(p => p.predicted_occupied_beds),
                        borderColor: '#ff1744',
                        backgroundColor: occGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 1,
                        pointHoverRadius: 5,
                        pointBackgroundColor: '#ff1744'
                    },
                    {
                        label: 'Confidence %',
                        data: predictions.map(p => p.confidence * (totalBeds || 100)),
                        borderColor: '#6c63ff',
                        backgroundColor: confGradient,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        hidden: true // Hidden by default, toggle in legend
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        titleFont: { size: 13, weight: '700' },
                        bodyFont: { size: 12 },
                        cornerRadius: 8,
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const idx = tooltipItems[0].dataIndex;
                                const pred = predictions[idx];
                                return [
                                    `Occupancy: ${pred.predicted_occupancy_rate}%`,
                                    `Confidence: ${Math.round(pred.confidence * 100)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 10 },
                            maxTicksLimit: 12
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    },

    renderARIMAChart(canvasId, predictions, totalBeds) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const colors = predictions.map(p => {
            if (p.predicted_occupancy_rate > 85) return 'rgba(255, 23, 68, 0.7)';
            if (p.predicted_occupancy_rate > 70) return 'rgba(255, 145, 0, 0.7)';
            if (p.predicted_occupancy_rate > 50) return 'rgba(0, 102, 255, 0.7)';
            return 'rgba(0, 200, 83, 0.7)';
        });

        const borderColors = predictions.map(p => {
            if (p.predicted_occupancy_rate > 85) return '#ff1744';
            if (p.predicted_occupancy_rate > 70) return '#ff9100';
            if (p.predicted_occupancy_rate > 50) return '#0066ff';
            return '#00c853';
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: predictions.map(p => {
                    return p.day_name.substring(0, 3) + ' ' + p.date.substring(5);
                }),
                datasets: [
                    {
                        label: 'Available Beds',
                        data: predictions.map(p => p.predicted_available_beds),
                        backgroundColor: colors,
                        borderColor: borderColors,
                        borderWidth: 2,
                        borderRadius: 8,
                        borderSkipped: false
                    },
                    {
                        label: 'Confidence',
                        data: predictions.map(p => Math.round(p.confidence * 100)),
                        type: 'line',
                        borderColor: '#6c63ff',
                        backgroundColor: 'rgba(108,99,255,0.1)',
                        fill: false,
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 3,
                        pointBackgroundColor: '#6c63ff',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            afterBody: function(tooltipItems) {
                                const idx = tooltipItems[0].dataIndex;
                                const pred = predictions[idx];
                                return [
                                    `Occupancy: ${pred.predicted_occupancy_rate}%`,
                                    `Model: ${pred.model || 'ARIMA'}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 }, maxRotation: 45 }
                    },
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Available Beds',
                            font: { size: 11, weight: '600' }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    y1: {
                        beginAtZero: true,
                        max: 100,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Confidence %',
                            font: { size: 11, weight: '600' }
                        },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    },

    renderPatientPredictionChart(canvasId, predictions) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, 'rgba(108, 99, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(108, 99, 255, 0.01)');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: predictions.map(p => p.day_name.substring(0, 3)),
                datasets: [{
                    label: 'Predicted Patients',
                    data: predictions.map(p => p.predicted_patients),
                    borderColor: '#6c63ff',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointBackgroundColor: '#6c63ff',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                const pred = predictions[idx];
                                return [
                                    `Predicted: ${pred.predicted_patients} patients`,
                                    `Date: ${pred.date}`,
                                    `Confidence: ${Math.round(pred.confidence * 100)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 12, weight: '600' } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: {
                            display: true,
                            text: 'Number of Patients',
                            font: { size: 11, weight: '600' }
                        }
                    }
                }
            }
        });
    },

    // ===== TREND ANALYSIS RENDERER =====

    renderTrendAnalysis(containerId, trendData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const trendConfig = {
            'declining_fast': { icon: '📉📉', color: '#ff1744', label: 'Rapidly Declining' },
            'declining': { icon: '📉', color: '#ff9100', label: 'Declining' },
            'stable': { icon: '➡️', color: '#0066ff', label: 'Stable' },
            'increasing': { icon: '📈', color: '#00c853', label: 'Increasing' },
            'increasing_fast': { icon: '📈📈', color: '#00c853', label: 'Rapidly Increasing' }
        };

        const config = trendConfig[trendData.trend] || trendConfig['stable'];

        container.innerHTML = `
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:3.5rem;margin-bottom:8px;">${config.icon}</div>
                <div style="font-size:1.3rem;font-weight:800;color:${config.color};text-transform:uppercase;letter-spacing:1px;">
                    ${config.label}
                </div>
                <div style="font-size:0.8rem;color:#adb5bd;margin-top:4px;">Bed Availability Trend</div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div style="padding:16px;background:#f8f9fa;border-radius:10px;text-align:center;">
                    <div style="font-size:1.6rem;font-weight:800;color:#1a1a2e;">${trendData.current_available || 0}</div>
                    <div style="font-size:0.7rem;color:#adb5bd;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Currently Available</div>
                </div>
                <div style="padding:16px;background:#f8f9fa;border-radius:10px;text-align:center;">
                    <div style="font-size:1.6rem;font-weight:800;color:#1a1a2e;">${trendData.avg_7day || 0}</div>
                    <div style="font-size:0.7rem;color:#adb5bd;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">7-Day Average</div>
                </div>
                <div style="padding:16px;background:#f8f9fa;border-radius:10px;text-align:center;">
                    <div style="font-size:1.6rem;font-weight:800;color:${trendData.change_rate >= 0 ? '#00c853' : '#ff1744'};">
                        ${trendData.change_rate >= 0 ? '+' : ''}${trendData.change_rate || 0}%
                    </div>
                    <div style="font-size:0.7rem;color:#adb5bd;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">Weekly Change</div>
                </div>
                <div style="padding:16px;background:${trendData.alert ? 'rgba(255,23,68,0.08)' : 'rgba(0,200,83,0.08)'};border-radius:10px;text-align:center;">
                    <div style="font-size:1.6rem;font-weight:800;">${trendData.alert ? '🚨' : '✅'}</div>
                    <div style="font-size:0.7rem;color:#adb5bd;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">
                        ${trendData.alert ? 'Alert Active' : 'All Normal'}
                    </div>
                </div>
            </div>
            
            ${trendData.alert_message ? `
                <div style="padding:12px 16px;background:rgba(255,23,68,0.08);border-left:4px solid #ff1744;border-radius:6px;font-size:0.85rem;color:#ff1744;font-weight:600;">
                    ⚠️ ${trendData.alert_message}
                </div>
            ` : `
                <div style="padding:12px 16px;background:rgba(0,200,83,0.08);border-left:4px solid #00c853;border-radius:6px;font-size:0.85rem;color:#00c853;font-weight:600;">
                    ✅ All systems operating normally. Bed availability is within expected range.
                </div>
            `}
        `;
    },

    // ===== OCCUPANCY BARS RENDERER =====

    renderOccupancyBars(containerId, predictions, maxItems = 12) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = predictions.slice(0, maxItems);

        container.innerHTML = items.map(p => {
            const rate = p.predicted_occupancy_rate;
            const barClass = rate > 80 ? 'high' : rate > 50 ? 'medium' : 'low';

            return `
                <div class="prediction-bar">
                    <div class="prediction-bar-label">${p.hour ? `+${p.hour}h` : p.day_name ? p.day_name.substring(0, 3) : `Day ${p.day}`}</div>
                    <div class="prediction-bar-track">
                        <div class="prediction-bar-fill ${barClass}" style="width:${rate}%"></div>
                    </div>
                    <div class="prediction-bar-value">${rate}%</div>
                </div>
            `;
        }).join('');
    },

    // ===== PREDICTION SUMMARY CARD =====

    renderPredictionSummary(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const lstmPreds = data.lstm_hourly_predictions || [];
        const arimaPreds = data.arima_daily_predictions || [];
        const patientPreds = data.patient_predictions || [];

        // Calculate key metrics
        const nextHourAvail = lstmPreds.length > 0 ? lstmPreds[0].predicted_available_beds : 'N/A';
        const next6hAvg = lstmPreds.length >= 6 ?
            Math.round(lstmPreds.slice(0, 6).reduce((s, p) => s + p.predicted_available_beds, 0) / 6) : 'N/A';
        const next24hMin = lstmPreds.length > 0 ?
            Math.min(...lstmPreds.map(p => p.predicted_available_beds)) : 'N/A';
        const tomorrowAvail = arimaPreds.length > 0 ? arimaPreds[0].predicted_available_beds : 'N/A';
        const weekAvgPatients = patientPreds.length > 0 ?
            Math.round(patientPreds.reduce((s, p) => s + p.predicted_patients, 0) / patientPreds.length) : 'N/A';
        const peakDay = patientPreds.length > 0 ?
            patientPreds.reduce((max, p) => p.predicted_patients > max.predicted_patients ? p : max, patientPreds[0]) : null;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;">
                <div style="padding:20px;background:linear-gradient(135deg,#e6f0ff,#f0e6ff);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Next Hour</div>
                    <div style="font-size:2rem;font-weight:800;color:#0066ff;">${nextHourAvail}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">beds available</div>
                </div>
                <div style="padding:20px;background:linear-gradient(135deg,#e6fff0,#e6f0ff);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">6-Hour Avg</div>
                    <div style="font-size:2rem;font-weight:800;color:#00c853;">${next6hAvg}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">beds available</div>
                </div>
                <div style="padding:20px;background:linear-gradient(135deg,#fff0e6,#ffe6e6);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">24h Minimum</div>
                    <div style="font-size:2rem;font-weight:800;color:#ff9100;">${next24hMin}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">beds available</div>
                </div>
                <div style="padding:20px;background:linear-gradient(135deg,#f0e6ff,#ffe6f0);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Tomorrow</div>
                    <div style="font-size:2rem;font-weight:800;color:#6c63ff;">${tomorrowAvail}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">beds available</div>
                </div>
                <div style="padding:20px;background:linear-gradient(135deg,#e6f0ff,#e6fff0);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Avg Daily Patients</div>
                    <div style="font-size:2rem;font-weight:800;color:#0066ff;">${weekAvgPatients}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">patients/day</div>
                </div>
                <div style="padding:20px;background:linear-gradient(135deg,#ffe6e6,#fff0e6);border-radius:12px;text-align:center;">
                    <div style="font-size:0.7rem;color:#6c757d;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Peak Day</div>
                    <div style="font-size:1.4rem;font-weight:800;color:#ff1744;">${peakDay ? peakDay.day_name.substring(0, 3) : 'N/A'}</div>
                    <div style="font-size:0.75rem;color:#6c757d;">${peakDay ? peakDay.predicted_patients + ' patients' : ''}</div>
                </div>
            </div>
        `;
    },

    // ===== UTILITY METHODS =====

    // Generate confidence indicator
    getConfidenceHTML(confidence) {
        const pct = Math.round(confidence * 100);
        let color = '#00c853';
        let label = 'High';

        if (pct < 60) {
            color = '#ff1744';
            label = 'Low';
        } else if (pct < 80) {
            color = '#ff9100';
            label = 'Medium';
        }

        return `
            <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${color}15;color:${color};border-radius:12px;font-size:0.7rem;font-weight:700;">
                <span style="width:6px;height:6px;background:${color};border-radius:50%;"></span>
                ${pct}% ${label}
            </span>
        `;
    },

    // Export prediction data as CSV
    exportToCSV(predictions, filename = 'predictions.csv') {
        if (!predictions || predictions.length === 0) {
            console.warn('No data to export');
            return;
        }

        const headers = Object.keys(predictions[0]);
        const csvContent = [
            headers.join(','),
            ...predictions.map(row => headers.map(h => {
                const val = row[h];
                return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    },

    // Clear all cached data
    clearCache() {
        this.cache = {};
    },

    // Destroy all charts
    destroyAllCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                delete this.charts[key];
            }
        });
    }
};

// Make globally available
window.PredictionEngine = PredictionEngine;

console.log(' Prediction Engine loaded successfully');