// ===== HOSPITAL DASHBOARD =====

let hospitalData = null;
let dashboardStats = null;
let charts = {};

// Check auth
(function checkAuth() {
    if (!isLoggedIn() || getRole() !== 'hospital') {
        window.location.href = '/login.html';
        return;
    }
    const user = getUser();
    document.getElementById('userGreeting').textContent = `👋 ${user.full_name}`;
    const h = localStorage.getItem('hospital');
    if (h) {
        hospitalData = JSON.parse(h);
        document.getElementById('hospitalNameSidebar').textContent = hospitalData.name;
    }
    loadDashboard();
})();

// Section Navigation
function showSection(section) {
    document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
    document.getElementById(`section-${section}`).style.display = 'block';
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (section === 'beds') loadBeds();
    if (section === 'bookings') loadBookings();
    if (section === 'predictions') loadAllPredictions();
    if (section === 'analytics') loadAnalytics();
    if (section === 'profile') loadProfile();
}

// LOAD DASHBOARD
async function loadDashboard() {
    try {
        const res = await fetch('/api/hospital/dashboard', { headers: authHeaders() });
        const data = await res.json();

        if (res.ok) {
            hospitalData = data.hospital;
            dashboardStats = data.stats;
            renderOverview(data);
        }
    } catch (err) {
        showToast('Failed to load dashboard', 'error');
    }
}

function refreshDashboard() { loadDashboard(); }

function renderOverview(data) {
    const s = data.stats;
    document.getElementById('overviewStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-card-icon blue">🛏️</div>
            <div class="stat-card-info">
                <h3>${s.total_beds}</h3>
                <p>Total Beds</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon green">✅</div>
            <div class="stat-card-info">
                <h3>${s.available_beds}</h3>
                <p>Available Beds</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon red">🔴</div>
            <div class="stat-card-info">
                <h3>${s.occupied_beds}</h3>
                <p>Occupied Beds</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon orange">📊</div>
            <div class="stat-card-info">
                <h3>${s.occupancy_rate}%</h3>
                <p>Occupancy Rate</p>
                <span class="trend ${s.occupancy_rate > 80 ? 'up' : 'down'}">
                    ${s.occupancy_rate > 80 ? '⚠️ High' : '✅ Normal'}
                </span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon purple">📋</div>
            <div class="stat-card-info">
                <h3>${s.active_bookings}</h3>
                <p>Active Bookings</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon blue">📥</div>
            <div class="stat-card-info">
                <h3>${s.today_admissions}</h3>
                <p>Today's Admissions</p>
            </div>
        </div>
    `;

    renderBedOccupancyChart(data.hospital.beds);
    renderOccupancyTrendChart();
}

function renderBedOccupancyChart(beds) {
    if (charts.bedOccupancy) charts.bedOccupancy.destroy();

    const ctx = document.getElementById('bedOccupancyChart').getContext('2d');
    charts.bedOccupancy = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: beds.map(b => b.bed_type),
            datasets: [
                {
                    label: 'Available',
                    data: beds.map(b => b.available_count),
                    backgroundColor: '#00c85380',
                    borderColor: '#00c853',
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: 'Occupied',
                    data: beds.map(b => b.occupied_count),
                    backgroundColor: '#ff174480',
                    borderColor: '#ff1744',
                    borderWidth: 2,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            }
        }
    });
}

function renderOccupancyTrendChart() {
    if (charts.trend) charts.trend.destroy();
    const ctx = document.getElementById('occupancyTrendChart').getContext('2d');

    // Simulated hourly data for today
    const hours = [];
    const values = [];
    for (let i = 0; i < 24; i++) {
        hours.push(`${i}:00`);
        const base = 65 + 15 * Math.sin(Math.PI * i / 12) + Math.random() * 5;
        values.push(Math.round(Math.min(95, Math.max(40, base))));
    }

    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hours,
            datasets: [{
                label: 'Occupancy %',
                data: values,
                borderColor: '#0066ff',
                backgroundColor: 'rgba(0,102,255,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

// BED MANAGEMENT
async function loadBeds() {
    try {
        const res = await fetch('/api/hospital/beds', { headers: authHeaders() });
        const data = await res.json();

        const tbody = document.getElementById('bedsTableBody');
        tbody.innerHTML = data.beds.map(b => `
            <tr>
                <td><strong>${b.bed_type}</strong></td>
                <td>${b.ward_name || '-'}</td>
                <td>${b.floor_number || '-'}</td>
                <td>${b.total_count}</td>
                <td><span class="badge badge-success">${b.available_count}</span></td>
                <td><span class="badge badge-danger">${b.occupied_count}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="flex:1;height:8px;background:var(--gray-200);border-radius:4px;overflow:hidden;">
                            <div style="height:100%;width:${b.occupancy_rate}%;background:${b.occupancy_rate > 80 ? '#ff1744' : b.occupancy_rate > 50 ? '#ff9100' : '#00c853'};border-radius:4px;"></div>
                        </div>
                        <span style="font-weight:600;font-size:0.85rem;">${b.occupancy_rate}%</span>
                    </div>
                </td>
                <td>₹${b.price_per_day}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick='editBed(${JSON.stringify(b)})'>✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBed(${b.id})">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load beds', 'error');
    }
}

function openBedModal() {
    document.getElementById('bedModalTitle').textContent = 'Add Bed Type';
    document.getElementById('bedForm').reset();
    document.getElementById('editBedId').value = '';
    document.getElementById('bedModal').classList.add('active');
}

function editBed(bed) {
    document.getElementById('bedModalTitle').textContent = 'Edit Bed';
    document.getElementById('editBedId').value = bed.id;
    document.getElementById('bedFormType').value = bed.bed_type;
    document.getElementById('bedFormTotal').value = bed.total_count;
    document.getElementById('bedFormAvailable').value = bed.available_count;
    document.getElementById('bedFormPrice').value = bed.price_per_day;
    document.getElementById('bedFormWard').value = bed.ward_name || '';
    document.getElementById('bedFormFloor').value = bed.floor_number || '';
    document.getElementById('bedModal').classList.add('active');
}

function closeBedModal() {
    document.getElementById('bedModal').classList.remove('active');
}

async function saveBed(e) {
    e.preventDefault();
    const bedId = document.getElementById('editBedId').value;
    const payload = {
        bed_type: document.getElementById('bedFormType').value,
        total_count: parseInt(document.getElementById('bedFormTotal').value),
        available_count: parseInt(document.getElementById('bedFormAvailable').value),
        price_per_day: parseFloat(document.getElementById('bedFormPrice').value) || 0,
        ward_name: document.getElementById('bedFormWard').value,
        floor_number: parseInt(document.getElementById('bedFormFloor').value) || null
    };

    try {
        const url = bedId ? `/api/hospital/beds/${bedId}` : '/api/hospital/beds';
        const method = bedId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method, headers: authHeaders(), body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`Bed ${bedId ? 'updated' : 'created'} successfully`, 'success');
            closeBedModal();
            loadBeds();
            loadDashboard();
        } else {
            showToast(data.error || 'Failed to save bed', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

async function deleteBed(bedId) {
    if (!confirm('Are you sure you want to delete this bed type?')) return;

    try {
        const res = await fetch(`/api/hospital/beds/${bedId}`, {
            method: 'DELETE', headers: authHeaders()
        });
        if (res.ok) {
            showToast('Bed deleted', 'success');
            loadBeds();
            loadDashboard();
        }
    } catch (err) {
        showToast('Failed to delete bed', 'error');
    }
}

// BOOKINGS
async function loadBookings() {
    const status = document.getElementById('bookingStatusFilter')?.value || '';
    try {
        const url = status ? `/api/hospital/bookings?status=${status}` : '/api/hospital/bookings';
        const res = await fetch(url, { headers: authHeaders() });
        const data = await res.json();

        const tbody = document.getElementById('bookingsTableBody');
        if (data.bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray-500);">No bookings found</td></tr>';
            return;
        }

        const statusBadge = {
            pending: 'badge-warning',
            confirmed: 'badge-info',
            admitted: 'badge-primary',
            discharged: 'badge-success',
            cancelled: 'badge-gray'
        };

        const priorityBadge = {
            emergency: 'badge-danger',
            urgent: 'badge-warning',
            normal: 'badge-info'
        };

        tbody.innerHTML = data.bookings.map(b => `
            <tr>
                <td>#${b.id}</td>
                <td><strong>${b.patient_name || 'N/A'}</strong></td>
                <td>${b.bed_type || 'N/A'}</td>
                <td><span class="badge ${priorityBadge[b.priority] || 'badge-info'}">${b.priority}</span></td>
                <td><span class="badge ${statusBadge[b.status] || 'badge-gray'}">${b.status}</span></td>
                <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick='openBookingModal(${JSON.stringify(b)})'>
                        ✏️ Update
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load bookings', 'error');
    }
}

function openBookingModal(booking) {
    document.getElementById('editBookingId').value = booking.id;
    document.getElementById('bookingNewStatus').value = booking.status;
    document.getElementById('bookingNotes').value = booking.notes || '';
    document.getElementById('bookingModal').classList.add('active');
}

function closeBookingModal() {
    document.getElementById('bookingModal').classList.remove('active');
}

async function updateBookingStatus() {
    const bookingId = document.getElementById('editBookingId').value;
    try {
        const res = await fetch(`/api/hospital/bookings/${bookingId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
                status: document.getElementById('bookingNewStatus').value,
                notes: document.getElementById('bookingNotes').value
            })
        });
        if (res.ok) {
            showToast('Booking updated!', 'success');
            closeBookingModal();
            loadBookings();
            loadDashboard();
        }
    } catch (err) {
        showToast('Failed to update booking', 'error');
    }
}

// PREDICTIONS
async function loadAllPredictions() {
    if (!hospitalData) return;

    try {
        const res = await fetch(`/api/predict/combined/${hospitalData.id}`, {
            headers: authHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            renderLSTMChart(data.lstm_hourly_predictions);
            renderARIMAChart(data.arima_daily_predictions);
            renderPatientChart(data.patient_predictions);
            renderTrendAnalysis(data.trend_analysis);
        }
    } catch (err) {
        showToast('Failed to load predictions', 'error');
    }
}

function renderLSTMChart(predictions) {
    if (charts.lstm) charts.lstm.destroy();
    const ctx = document.getElementById('lstmChart').getContext('2d');

    charts.lstm = new Chart(ctx, {
        type: 'line',
        data: {
            labels: predictions.map(p => `+${p.hour}h`),
            datasets: [
                {
                    label: 'Predicted Available Beds',
                    data: predictions.map(p => p.predicted_available_beds),
                    borderColor: '#00c853',
                    backgroundColor: 'rgba(0,200,83,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                },
                {
                    label: 'Predicted Occupied',
                    data: predictions.map(p => p.predicted_occupied_beds),
                    borderColor: '#ff1744',
                    backgroundColor: 'rgba(255,23,68,0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderARIMAChart(predictions) {
    if (charts.arima) charts.arima.destroy();
    const ctx = document.getElementById('arimaChart').getContext('2d');

    charts.arima = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: predictions.map(p => p.day_name.substring(0, 3) + '\n' + p.date.substring(5)),
            datasets: [{
                label: 'Predicted Available Beds',
                data: predictions.map(p => p.predicted_available_beds),
                backgroundColor: predictions.map(p =>
                    p.predicted_occupancy_rate > 80 ? 'rgba(255,23,68,0.6)' :
                        p.predicted_occupancy_rate > 60 ? 'rgba(255,145,0,0.6)' : 'rgba(0,200,83,0.6)'
                ),
                borderRadius: 6,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderPatientChart(predictions) {
    if (charts.patient) charts.patient.destroy();
    const ctx = document.getElementById('patientChart').getContext('2d');

    charts.patient = new Chart(ctx, {
        type: 'line',
        data: {
            labels: predictions.map(p => p.day_name.substring(0, 3)),
            datasets: [{
                label: 'Predicted Patients',
                data: predictions.map(p => p.predicted_patients),
                borderColor: '#6c63ff',
                backgroundColor: 'rgba(108,99,255,0.15)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: '#6c63ff',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderTrendAnalysis(trend) {
    const div = document.getElementById('trendAnalysis');
    const trendColors = {
        'declining_fast': '#ff1744',
        'declining': '#ff9100',
        'stable': '#0066ff',
        'increasing': '#00c853',
        'increasing_fast': '#00c853'
    };

    const trendIcons = {
        'declining_fast': '📉📉',
        'declining': '📉',
        'stable': '➡️',
        'increasing': '📈',
        'increasing_fast': '📈📈'
    };

    div.innerHTML = `
        <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:3rem;">${trendIcons[trend.trend] || '➡️'}</div>
            <div style="font-size:1.2rem;font-weight:800;color:${trendColors[trend.trend] || '#333'};text-transform:uppercase;">
                ${trend.trend.replace('_', ' ')}
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="padding:12px;background:var(--gray-100);border-radius:8px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:800;">${trend.current_available}</div>
                <div style="font-size:0.7rem;color:var(--gray-500);text-transform:uppercase;">Current Available</div>
            </div>
            <div style="padding:12px;background:var(--gray-100);border-radius:8px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:800;">${trend.avg_7day}</div>
                <div style="font-size:0.7rem;color:var(--gray-500);text-transform:uppercase;">7-Day Average</div>
            </div>
            <div style="padding:12px;background:var(--gray-100);border-radius:8px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:800;color:${trend.change_rate > 0 ? '#00c853' : '#ff1744'}">
                    ${trend.change_rate > 0 ? '+' : ''}${trend.change_rate}%
                </div>
                <div style="font-size:0.7rem;color:var(--gray-500);text-transform:uppercase;">Weekly Change</div>
            </div>
            <div style="padding:12px;background:${trend.alert ? 'rgba(255,23,68,0.1)' : 'rgba(0,200,83,0.1)'};border-radius:8px;text-align:center;">
                <div style="font-size:1.4rem;font-weight:800;">${trend.alert ? '⚠️' : '✅'}</div>
                <div style="font-size:0.7rem;color:var(--gray-500);text-transform:uppercase;">
                    ${trend.alert ? 'Alert Active' : 'All Normal'}
                </div>
            </div>
        </div>
        ${trend.alert_message ? `<div style="margin-top:12px;padding:10px;background:rgba(255,23,68,0.1);border-left:3px solid #ff1744;border-radius:4px;font-size:0.85rem;color:#ff1744;font-weight:600;">${trend.alert_message}</div>` : ''}
    `;
}

// ANALYTICS
function loadAnalytics() {
    if (!hospitalData) return;

    const beds = hospitalData.beds || [];
    const totalBeds = beds.reduce((s, b) => s + b.total_count, 0);
    const totalAvailable = beds.reduce((s, b) => s + b.available_count, 0);
    const avgPrice = beds.length > 0 ? beds.reduce((s, b) => s + b.price_per_day, 0) / beds.length : 0;

    document.getElementById('analyticsStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-card-icon blue">🏥</div>
            <div class="stat-card-info">
                <h3>${beds.length}</h3>
                <p>Bed Categories</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon green">💰</div>
            <div class="stat-card-info">
                <h3>₹${Math.round(avgPrice)}</h3>
                <p>Avg Price/Day</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon purple">⭐</div>
            <div class="stat-card-info">
                <h3>${hospitalData.rating || 'N/A'}</h3>
                <p>Hospital Rating</p>
            </div>
        </div>
    `;

    // Bed Distribution Pie
    if (charts.bedDist) charts.bedDist.destroy();
    const ctx1 = document.getElementById('bedDistChart').getContext('2d');
    charts.bedDist = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: beds.map(b => b.bed_type),
            datasets: [{
                data: beds.map(b => b.total_count),
                backgroundColor: ['#0066ff', '#ff1744', '#00c853', '#ff9100', '#6c63ff', '#00b0ff'],
                borderWidth: 3,
                borderColor: '#fff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Revenue chart
    if (charts.revenue) charts.revenue.destroy();
    const ctx2 = document.getElementById('revenueChart').getContext('2d');
    charts.revenue = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: beds.map(b => b.bed_type),
            datasets: [{
                label: 'Revenue/Day (₹)',
                data: beds.map(b => b.price_per_day * b.occupied_count),
                backgroundColor: 'rgba(108,99,255,0.6)',
                borderRadius: 8
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

// PROFILE
function loadProfile() {
    if (!hospitalData) return;
    document.getElementById('profName').value = hospitalData.name || '';
    document.getElementById('profPhone').value = hospitalData.phone || '';
    document.getElementById('profAddress').value = hospitalData.address || '';
    document.getElementById('profCity').value = hospitalData.city || '';
    document.getElementById('profState').value = hospitalData.state || '';
    document.getElementById('profType').value = hospitalData.hospital_type || 'Private';
    document.getElementById('profSpec').value = hospitalData.specializations || '';
    document.getElementById('profEmergency').checked = hospitalData.emergency_available;
    document.getElementById('profAmbulance').checked = hospitalData.ambulance_available;
}

async function updateHospitalProfile(e) {
    e.preventDefault();
    try {
        const res = await fetch('/api/hospital/profile', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
                name: document.getElementById('profName').value,
                phone: document.getElementById('profPhone').value,
                address: document.getElementById('profAddress').value,
                city: document.getElementById('profCity').value,
                state: document.getElementById('profState').value,
                hospital_type: document.getElementById('profType').value,
                specializations: document.getElementById('profSpec').value,
                emergency_available: document.getElementById('profEmergency').checked,
                ambulance_available: document.getElementById('profAmbulance').checked
            })
        });

        if (res.ok) {
            const data = await res.json();
            hospitalData = data.hospital;
            localStorage.setItem('hospital', JSON.stringify(hospitalData));
            showToast('Profile updated successfully!', 'success');
        }
    } catch (err) {
        showToast('Failed to update profile', 'error');
    }
}