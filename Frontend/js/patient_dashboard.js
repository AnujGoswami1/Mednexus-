// ===== PATIENT DASHBOARD =====

let patientData = null;

// Auth check
(function init() {
    if (!isLoggedIn() || getRole() !== 'patient') {
        window.location.href = '/login.html';
        return;
    }
    const user = getUser();
    document.getElementById('userGreeting').textContent = `👋 ${user.full_name}`;
    document.getElementById('welcomeMessage').textContent = `Welcome back, ${user.full_name}!`;
    loadPatientDashboard();

    // Check if redirected from map with book parameter
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    if (bookId) {
        showPatientSection('hospitals');
        setTimeout(() => openBookModal(parseInt(bookId)), 500);
    }
})();

// Section Navigation
function showPatientSection(section) {
    document.querySelectorAll('[id^="p-section-"]').forEach(el => el.style.display = 'none');
    document.getElementById(`p-section-${section}`).style.display = 'block';
    document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (section === 'bookings') loadPatientBookings();
    if (section === 'hospitals') searchHospitals();
    if (section === 'profile') loadPatientProfile();
}

// LOAD DASHBOARD
async function loadPatientDashboard() {
    try {
        const res = await fetch('/api/patient/dashboard', {
            headers: authHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            patientData = data;
            renderPatientOverview(data);
        } else {
            showToast('Failed to load dashboard', 'error');
        }
    } catch (err) {
        console.error('Dashboard error:', err);
        showToast('Network error loading dashboard', 'error');
    }
}

function renderPatientOverview(data) {
    const statsDiv = document.getElementById('patientStats');
    statsDiv.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-icon blue">📋</div>
            <div class="stat-card-info">
                <h3>${data.active_bookings ? data.active_bookings.length : 0}</h3>
                <p>Active Bookings</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon green">✅</div>
            <div class="stat-card-info">
                <h3>${data.total_visits || 0}</h3>
                <p>Total Visits</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon purple">🩸</div>
            <div class="stat-card-info">
                <h3>${data.user.blood_group || 'N/A'}</h3>
                <p>Blood Group</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon orange">📞</div>
            <div class="stat-card-info">
                <h3 style="font-size:1rem;">${data.user.emergency_contact || 'Not Set'}</h3>
                <p>Emergency Contact</p>
            </div>
        </div>
    `;

    // Active bookings list
    const activeDiv = document.getElementById('activeBookingsList');
    if (data.active_bookings && data.active_bookings.length > 0) {
        activeDiv.innerHTML = data.active_bookings.map(b => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border:2px solid var(--gray-200);border-radius:12px;margin-bottom:12px;">
                <div>
                    <div style="font-weight:700;font-size:1rem;">${b.hospital_name || 'Hospital'}</div>
                    <div style="color:var(--gray-500);font-size:0.85rem;">${b.bed_type || 'General'} Bed • ${b.priority || 'normal'} priority</div>
                    <div style="color:var(--gray-400);font-size:0.8rem;margin-top:4px;">
                        Booked: ${b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A'}
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${getStatusBadge(b.status)}">${b.status}</span>
                    ${b.status === 'pending' || b.status === 'confirmed' ?
                        `<br><button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="cancelBooking(${b.id})">Cancel</button>` : ''}
                </div>
            </div>
        `).join('');
    } else {
        activeDiv.innerHTML = `
            <div style="text-align:center;padding:40px;color:var(--gray-400);">
                <div style="font-size:3rem;margin-bottom:12px;">📋</div>
                <p>No active bookings</p>
                <a href="/" class="btn btn-primary" style="margin-top:12px;">🗺️ Find a Hospital</a>
            </div>
        `;
    }
}

function getStatusBadge(status) {
    const map = {
        pending: 'badge-warning',
        confirmed: 'badge-info',
        admitted: 'badge-primary',
        discharged: 'badge-success',
        cancelled: 'badge-gray'
    };
    return map[status] || 'badge-gray';
}

// SEARCH HOSPITALS
async function searchHospitals() {
    const resultsDiv = document.getElementById('hospitalSearchResults');
    resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;"><div class="loading-spinner" style="margin:0 auto;"></div><p style="margin-top:12px;color:var(--gray-500);">Loading hospitals...</p></div>';

    try {
        const res = await fetch('/api/map/hospitals');
        const data = await res.json();

        if (data.hospitals && data.hospitals.length > 0) {
            const bedType = document.getElementById('pSearchBedType').value;
            let hospitals = data.hospitals;

            // Client-side filter (real filtering would need bed-type specific API)
            if (bedType) {
                hospitals = hospitals.filter(h => h.available_beds > 0);
            }

            resultsDiv.innerHTML = hospitals.map(h => {
                const availClass = h.available_beds > 20 ? 'availability-high' :
                                   h.available_beds > 5 ? 'availability-medium' :
                                   h.available_beds > 0 ? 'availability-low' : 'availability-none';

                return `
                <div style="background:white;border:2px solid var(--gray-200);border-radius:12px;padding:20px;margin-bottom:16px;transition:all 0.3s;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                        <div style="flex:1;min-width:200px;">
                            <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:4px;">${h.name}</h3>
                            <p style="color:var(--gray-500);font-size:0.85rem;margin-bottom:8px;">
                                ${h.hospital_type || 'Hospital'} • ⭐ ${h.rating || 'N/A'} • 📞 ${h.phone || 'N/A'}
                            </p>
                            <div style="display:flex;gap:16px;flex-wrap:wrap;">
                                <div>
                                    <span style="font-weight:700;font-size:1.2rem;">${h.total_beds}</span>
                                    <span style="font-size:0.75rem;color:var(--gray-500);"> Total Beds</span>
                                </div>
                                <div>
                                    <span style="font-weight:700;font-size:1.2rem;" class="${availClass}">${h.available_beds}</span>
                                    <span style="font-size:0.75rem;color:var(--gray-500);"> Available</span>
                                </div>
                                <div>
                                    <span style="font-size:0.85rem;">${h.emergency_available ? '🟢 Emergency' : '🔴 No Emergency'}</span>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <button class="btn btn-success btn-sm" onclick="openBookModal(${h.id}, '${h.name.replace(/'/g, "\\'")}')">
                                📋 Book Bed
                            </button>
                            <a href="/" class="btn btn-outline btn-sm" style="text-align:center;">
                                🗺️ View on Map
                            </a>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);">No hospitals found</div>';
        }
    } catch (err) {
        console.error('Search error:', err);
        resultsDiv.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger);">Failed to load hospitals</div>';
    }
}

// BOOKING
function openBookModal(hospitalId, hospitalName) {
    document.getElementById('bookHospitalId').value = hospitalId;
    document.getElementById('bookHospitalInfo').innerHTML = `
        <div style="padding:12px;background:var(--primary-light);border-radius:8px;border-left:4px solid var(--primary);">
            <strong>🏥 ${hospitalName || 'Hospital #' + hospitalId}</strong>
        </div>
    `;
    document.getElementById('bookBedType').value = 'General';
    document.getElementById('bookPriority').value = 'normal';
    document.getElementById('bookReason').value = '';
    document.getElementById('bookModal').classList.add('active');
}

async function submitBooking() {
    const hospitalId = document.getElementById('bookHospitalId').value;
    const bedType = document.getElementById('bookBedType').value;
    const priority = document.getElementById('bookPriority').value;
    const reason = document.getElementById('bookReason').value;

    if (!hospitalId) {
        showToast('Please select a hospital', 'error');
        return;
    }

    try {
        const res = await fetch('/api/patient/book', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                hospital_id: parseInt(hospitalId),
                bed_type: bedType,
                priority: priority,
                reason: reason
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Bed booked successfully! 🎉', 'success');
            document.getElementById('bookModal').classList.remove('active');
            loadPatientDashboard();
            loadPatientBookings();
        } else {
            showToast(data.error || 'Booking failed', 'error');
        }
    } catch (err) {
        console.error('Booking error:', err);
        showToast('Network error. Please try again.', 'error');
    }
}

// LOAD ALL BOOKINGS
async function loadPatientBookings() {
    try {
        const res = await fetch('/api/patient/bookings', {
            headers: authHeaders()
        });
        const data = await res.json();

        const tbody = document.getElementById('patientBookingsBody');

        if (data.bookings && data.bookings.length > 0) {
            tbody.innerHTML = data.bookings.map(b => `
                <tr>
                    <td>#${b.id}</td>
                    <td><strong>${b.hospital_name || 'N/A'}</strong></td>
                    <td>${b.bed_type || 'N/A'}</td>
                    <td><span class="badge ${getStatusBadge(b.status)}">${b.status}</span></td>
                    <td>${b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        ${b.status === 'pending' || b.status === 'confirmed' ?
                            `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id})">❌ Cancel</button>` :
                            '<span style="color:var(--gray-400);font-size:0.8rem;">—</span>'
                        }
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:40px;color:var(--gray-400);">
                        No bookings yet. <a href="/" style="color:var(--primary);font-weight:600;">Find a hospital →</a>
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Bookings load error:', err);
        showToast('Failed to load bookings', 'error');
    }
}

// CANCEL BOOKING
async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
        const res = await fetch(`/api/patient/bookings/${bookingId}/cancel`, {
            method: 'PUT',
            headers: authHeaders()
        });

        const data = await res.json();

        if (res.ok) {
            showToast('Booking cancelled successfully', 'success');
            loadPatientDashboard();
            loadPatientBookings();
        } else {
            showToast(data.error || 'Failed to cancel', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// PROFILE
function loadPatientProfile() {
    const user = getUser();
    if (!user) return;

    document.getElementById('ppName').value = user.full_name || '';
    document.getElementById('ppPhone').value = user.phone || '';
    document.getElementById('ppBlood').value = user.blood_group || '';
    document.getElementById('ppEmergency').value = user.emergency_contact || '';
    // medical history not in user dict from token, leave blank
}

async function updatePatientProfile(e) {
    e.preventDefault();

    try {
        const res = await fetch('/api/patient/profile', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({
                full_name: document.getElementById('ppName').value,
                phone: document.getElementById('ppPhone').value,
                blood_group: document.getElementById('ppBlood').value,
                emergency_contact: document.getElementById('ppEmergency').value,
                medical_history: document.getElementById('ppHistory').value
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Update local storage
            localStorage.setItem('user', JSON.stringify(data.user));
            showToast('Profile updated successfully! ✅', 'success');
        } else {
            showToast(data.error || 'Failed to update profile', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}