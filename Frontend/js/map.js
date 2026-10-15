// ===== MAP MODULE =====

let map;
let userMarker;
let hospitalMarkers = [];
let routeLayer;
let userLat, userLng;
let allHospitals = [];

// Initialize map
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: true
    }).setView([28.6139, 77.2090], 12); // Default: Delhi

    // Custom tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Zoom control in custom position
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Get user location
    getUserLocation();

    // Load hospitals
    loadHospitals();
}

// Get user's current location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLat = position.coords.latitude;
                userLng = position.coords.longitude;

                // Add user marker
                const userIcon = L.divIcon({
                    className: 'user-marker-container',
                    html: '<div class="user-marker"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                });

                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker([userLat, userLng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup('<strong>📍 Your Location</strong>');

                map.setView([userLat, userLng], 13);
                showToast('Location detected successfully!', 'success');
            },
            (error) => {
                console.warn('Geolocation failed:', error);
                showToast('Using default location (Delhi). Allow location access for better results.', 'warning');
                userLat = 28.6139;
                userLng = 77.2090;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        userLat = 28.6139;
        userLng = 77.2090;
    }
}

// Load all hospitals on map
async function loadHospitals() {
    try {
        const res = await fetch('/api/map/hospitals');
        const data = await res.json();

        if (data.hospitals) {
            allHospitals = data.hospitals;
            displayHospitalsOnMap(allHospitals);
            updateMapStats(allHospitals);
        }
    } catch (err) {
        console.error('Error loading hospitals:', err);
        showToast('Failed to load hospitals', 'error');
    }
}

// Display hospitals as red plus signs on map
function displayHospitalsOnMap(hospitals) {
    // Clear existing markers
    hospitalMarkers.forEach(m => map.removeLayer(m));
    hospitalMarkers = [];

    hospitals.forEach(hospital => {
        // Determine availability status
        let statusClass = 'full';
        const availRate = hospital.total_beds > 0
            ? hospital.available_beds / hospital.total_beds
            : 0;

        if (availRate >= 0.3) statusClass = 'available';
        else if (availRate >= 0.1) statusClass = 'limited';

        // Create custom red cross marker
        const icon = L.divIcon({
            className: '',
            html: `<div class="hospital-marker ${statusClass}">
                       <div class="marker-inner">✚</div>
                   </div>`,
            iconSize: [36, 42],
            iconAnchor: [18, 42],
            popupAnchor: [0, -45]
        });

        const marker = L.marker([hospital.latitude, hospital.longitude], { icon })
            .addTo(map)
            .bindPopup(createHospitalPopup(hospital), {
                maxWidth: 320,
                className: 'hospital-popup-container'
            });

        marker.hospitalData = hospital;
        hospitalMarkers.push(marker);
    });
}

// Create hospital popup HTML
function createHospitalPopup(hospital) {
    const availStatus = hospital.available_beds > 20 ? 'availability-high' :
                        hospital.available_beds > 5 ? 'availability-medium' :
                        hospital.available_beds > 0 ? 'availability-low' : 'availability-none';

    return `
        <div class="hospital-popup">
            <h4>${hospital.name}</h4>
            <div class="popup-type">${hospital.hospital_type || 'Hospital'} • ⭐ ${hospital.rating || 'N/A'}</div>
            <div class="popup-stats">
                <div class="popup-stat">
                    <div class="popup-stat-val">${hospital.total_beds}</div>
                    <div class="popup-stat-lbl">Total Beds</div>
                </div>
                <div class="popup-stat">
                    <div class="popup-stat-val ${availStatus}">${hospital.available_beds}</div>
                    <div class="popup-stat-lbl">Available</div>
                </div>
                <div class="popup-stat">
                    <div class="popup-stat-val">${hospital.emergency_available ? '✅' : '❌'}</div>
                    <div class="popup-stat-lbl">Emergency</div>
                </div>
                <div class="popup-stat">
                    <div class="popup-stat-val">📞</div>
                    <div class="popup-stat-lbl">${hospital.phone || 'N/A'}</div>
                </div>
            </div>
            <div class="popup-actions">
                <button class="btn btn-primary btn-sm" onclick="navigateToHospital(${hospital.latitude}, ${hospital.longitude})">
                    🧭 Navigate
                </button>
                ${isLoggedIn() && getRole() === 'patient' ?
                    `<button class="btn btn-success btn-sm" onclick="bookFromMap(${hospital.id})">📋 Book Bed</button>` :
                    `<a href="/login.html" class="btn btn-outline btn-sm">Login to Book</a>`
                }
            </div>
        </div>
    `;
}

// Navigate to hospital (draw route line)
function navigateToHospital(lat, lng) {
    if (!userLat || !userLng) {
        showToast('Please allow location access', 'warning');
        return;
    }

    if (routeLayer) map.removeLayer(routeLayer);

    routeLayer = L.polyline(
        [[userLat, userLng], [lat, lng]],
        {
            color: '#0066ff',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
            className: 'route-line'
        }
    ).addTo(map);

    // Calculate distance
    const distance = calculateDistance(userLat, userLng, lat, lng);
    const midLat = (userLat + lat) / 2;
    const midLng = (userLng + lng) / 2;

    L.popup()
        .setLatLng([midLat, midLng])
        .setContent(`<div class="route-info">📏 ${distance.toFixed(1)} km • 🚗 ~${Math.ceil(distance / 30 * 60)} min</div>`)
        .openOn(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
}

// Book from map
function bookFromMap(hospitalId) {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return;
    }
    window.location.href = `/patient_dashboard.html?book=${hospitalId}`;
}

// Find nearest hospital with AI recommendation
async function findNearestHospital() {
    if (!userLat || !userLng) {
        showToast('Detecting your location...', 'info');
        getUserLocation();
        return;
    }

    const btn = document.getElementById('findNearestBtn');
    const btnText = document.getElementById('findBtnText');
    btn.disabled = true;
    btnText.innerHTML = '<div class="spinner"></div> Analyzing with AI...';

    try {
        const res = await fetch('/api/map/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: userLat,
                longitude: userLng,
                bed_type: document.getElementById('bedTypeFilter').value || null,
                priority: document.getElementById('priorityFilter').value,
                max_distance: parseInt(document.getElementById('distanceFilter').value)
            })
        });

        const data = await res.json();

        if (data.recommendations && data.recommendations.length > 0) {
            displayRecommendations(data.recommendations);
            highlightBestHospital(data.recommendations[0]);
            showToast(`Found ${data.recommendations.length} hospitals analyzed by AI!`, 'success');
        } else {
            showToast('No hospitals found in the selected range', 'warning');
        }
    } catch (err) {
        console.error('Error:', err);
        showToast('Failed to get recommendations', 'error');
    }

    btn.disabled = false;
    btnText.innerHTML = '⚡ Find Nearest Hospital';
}

// Display recommendations in panel
function displayRecommendations(recommendations) {
    const panel = document.getElementById('recommendPanel');
    const list = document.getElementById('recommendationList');

    list.innerHTML = '';

    recommendations.forEach((rec, index) => {
        const availClass = rec.availability_status === 'high' ? 'availability-high' :
                          rec.availability_status === 'medium' ? 'availability-medium' :
                          rec.availability_status === 'low' ? 'availability-low' : 'availability-none';

        const scoreColor = rec.recommendation_score >= 70 ? '#00c853' :
                          rec.recommendation_score >= 40 ? '#ff9100' : '#ff1744';

        const card = document.createElement('div');
        card.className = `recommendation-card ${index === 0 ? 'best-match' : ''}`;
        card.innerHTML = `
            <div class="rec-hospital-name">${rec.name}</div>
            <div class="rec-hospital-type">${rec.hospital_type} • ${rec.distance_km} km away • ${rec.estimated_travel_time}</div>
            <div class="rec-stats">
                <div class="rec-stat">
                    <div class="rec-stat-value ${availClass}">${rec.available_beds}</div>
                    <div class="rec-stat-label">Available</div>
                </div>
                <div class="rec-stat">
                    <div class="rec-stat-value">${rec.total_beds}</div>
                    <div class="rec-stat-label">Total Beds</div>
                </div>
                <div class="rec-stat">
                    <div class="rec-stat-value">⭐ ${rec.rating || 'N/A'}</div>
                    <div class="rec-stat-label">Rating</div>
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;margin-bottom:4px;">
                <span style="font-weight:600;">AI Score</span>
                <span style="font-weight:700;color:${scoreColor}">${rec.recommendation_score}%</span>
            </div>
            <div class="rec-score-bar">
                <div class="rec-score-fill ${rec.recommendation_score >= 70 ? 'low' : rec.recommendation_score >= 40 ? 'medium' : 'high'}"
                     style="width:${rec.recommendation_score}%"></div>
            </div>
            <div style="margin-top:8px;display:flex;gap:4px;">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="focusHospital(${rec.latitude},${rec.longitude})">📍 View</button>
                <button class="btn btn-outline btn-sm" style="flex:1;" onclick="navigateToHospital(${rec.latitude},${rec.longitude})">🧭 Navigate</button>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') {
                focusHospital(rec.latitude, rec.longitude);
            }
        });
        list.appendChild(card);
    });

    panel.classList.add('active');
}

function highlightBestHospital(hospital) {
    map.setView([hospital.latitude, hospital.longitude], 14);

    // Draw route to best hospital
    if (userLat && userLng) {
        navigateToHospital(hospital.latitude, hospital.longitude);
    }
}

function focusHospital(lat, lng) {
    map.setView([lat, lng], 16);

    // Open popup
    hospitalMarkers.forEach(m => {
        if (m.hospitalData && m.hospitalData.latitude === lat && m.hospitalData.longitude === lng) {
            m.openPopup();
        }
    });
}

function closeRecommendations() {
    document.getElementById('recommendPanel').classList.remove('active');
    if (routeLayer) map.removeLayer(routeLayer);
}

// Update map statistics bar
function updateMapStats(hospitals) {
    const totalHospitals = hospitals.length;
    const totalBeds = hospitals.reduce((sum, h) => sum + (h.total_beds || 0), 0);
    const availBeds = hospitals.reduce((sum, h) => sum + (h.available_beds || 0), 0);
    const avgOccupancy = totalBeds > 0 ? Math.round((1 - availBeds / totalBeds) * 100) : 0;

    document.getElementById('totalHospitals').textContent = totalHospitals;
    document.getElementById('totalBeds').textContent = totalBeds.toLocaleString();
    document.getElementById('availableBeds').textContent = availBeds.toLocaleString();
    document.getElementById('avgOccupancy').textContent = avgOccupancy + '%';
}

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 10);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', initMap);