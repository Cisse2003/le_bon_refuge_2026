// /js/supervision.js

document.addEventListener('DOMContentLoaded', () => {
    checkSupervisionAuth();
    loadAuditLogs();

    document.getElementById('filterRole').addEventListener('change', loadAuditLogs);
    document.getElementById('filterKeyword').addEventListener('input', debounce(loadAuditLogs, 300));
    document.getElementById('filterDate').addEventListener('change', loadAuditLogs);

    document.getElementById('btnDeconnexion').addEventListener('click', async () => {
        await apiPost('/api/auth/logout');
        window.location.href = '/login.html';
    });
});

async function checkSupervisionAuth() {
    try {
        const { user } = await apiGet('/api/auth/me');
        if (user.role !== 'superviseur') {
            window.location.href = '/login.html';
        }
    } catch (e) {
        window.location.href = '/login.html';
    }
}

async function loadAuditLogs() {
    const role = document.getElementById('filterRole').value;
    const search = document.getElementById('filterKeyword').value;
    const date = document.getElementById('filterDate').value;

    const queryParams = new URLSearchParams({ role, search, date }).toString();
    const logs = await apiGet(`/api/supervision/logs?${queryParams}`);

    const tbody = document.getElementById('tblAuditLogs');
    tbody.innerHTML = '';

    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.created_at}</td>
            <td><strong>${escapeHtml(log.username)}</strong> (${escapeHtml(log.user_nom)})</td>
            <td><span class="badge-role role-${log.role}">${log.role}</span></td>
            <td><strong>${escapeHtml(log.action)}</strong></td>
            <td>${escapeHtml(log.module)}</td>
            <td><code>${escapeHtml(JSON.stringify(log.details))}</code></td>
        `;
        tbody.appendChild(tr);
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}