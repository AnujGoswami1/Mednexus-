// ===== AUTH UTILITIES =====

function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function getRole() {
    return localStorage.getItem('role');
}

function isLoggedIn() {
    return !!getToken();
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
    };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('hospital');
    window.location.href = '/';
}

function goToDashboard() {
    const role = getRole();
    if (role === 'hospital') {
        window.location.href = '/hospital_dashboard.html';
    } else if (role === 'patient') {
        window.location.href = '/patient_dashboard.html';
    }
}

// Update nav based on auth state
function updateNavigation() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userGreeting = document.getElementById('userGreeting');

    if (!loginBtn) return;

    if (isLoggedIn()) {
        const user = getUser();
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        dashboardBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'inline-flex';
        userGreeting.style.display = 'inline-flex';
        userGreeting.textContent = `👋 ${user?.full_name || 'User'}`;
    } else {
        loginBtn.style.display = 'inline-flex';
        registerBtn.style.display = 'inline-flex';
        dashboardBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
        userGreeting.style.display = 'none';
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Run on page load
document.addEventListener('DOMContentLoaded', updateNavigation);