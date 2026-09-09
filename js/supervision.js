document.addEventListener('DOMContentLoaded', async () => {
    const ok = await checkSupervisionAuth();
    if (!ok) return;

    loadAuditLogs();

    document.querySelectorAll('.admin-nav button[data-panel]').forEach((btn) => {
        btn.addEventListener('click', () => ouvrirPanelSupervision(btn.dataset.panel));
    });

    document.getElementById('filterRole').addEventListener('change', loadAuditLogs);
    document.getElementById('filterKeyword').addEventListener('input', debounce(loadAuditLogs, 300));
    document.getElementById('filterDate').addEventListener('change', loadAuditLogs);

    document.getElementById('btnDeconnexion').addEventListener('click', async () => {
        await apiPost('/api/auth/logout');
        window.location.href = '/login.html';
    });

    setInterval(() => {
        const actif = document.querySelector('.panel.active');
        if (!actif) return;
        if (actif.id === 'panel-audit') loadAuditLogs();
        if (actif.id === 'panel-live') loadLiveStream();
    }, 10000);
});

function ouvrirPanelSupervision(nom) {
    document.querySelectorAll('.admin-nav button[data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === nom));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + nom));
    if (nom === 'live') loadLiveStream();
}

async function loadLiveStream() {
    const container = document.getElementById('liveStream');
    let logs = [];
    try {
        logs = await apiGet('/api/supervision/logs?role=&search=&date=');
    } catch (e) {
        container.innerHTML = `<p class="empty-state">${escapeHtml(e.message || 'Erreur de chargement')}</p>`;
        return;
    }
    if (!Array.isArray(logs) || logs.length === 0) {
        container.innerHTML = '<p class="empty-state">Aucune activité récente</p>';
        return;
    }
    container.innerHTML = logs.slice(0, 40).map((log) => `
        <div class="live-entry">
            <span class="heure">${escapeHtml(log.created_at)}</span>
            <strong>${escapeHtml(log.username)}</strong> (${escapeHtml(log.role)}) — ${escapeHtml(log.action)}
            <span style="color:var(--text-dim);"> · ${escapeHtml(log.module)}</span>
        </div>
    `).join('');
}

async function checkSupervisionAuth() {
    try {
        const { user } = await apiGet('/api/auth/me');
        if (!user || user.role !== 'superviseur') {
            window.location.href = '/login.html';
            return false;
        }
        document.getElementById('rolePill').textContent = user.nom + ' · superviseur';
        return true;
    } catch (e) {
        window.location.href = '/login.html';
        return false;
    }
}

function formatDetailsHTML(details) {
    if (!details || (typeof details === 'object' && Object.keys(details).length === 0)) {
        return '<span class="detail-empty">—</span>';
    }

    if (typeof details === 'string') {
        try { details = JSON.parse(details); } catch (e) { return `<span>${escapeHtml(details)}</span>`; }
    }

    let html = '<div class="details-container">';

    if (details.commande) {
        html += `<span class="detail-tag detail-cmd">Cmd #${escapeHtml(details.commande)}</span> `;
    }
    if (details.champ) {
        html += `<span class="detail-tag detail-field">${escapeHtml(details.champ)}</span> `;
    }
    if (details.ancienne_valeur !== undefined || details.nouvelle_valeur !== undefined) {
        html += `<div class="detail-change">
            <span class="val-old">${escapeHtml(details.ancienne_valeur ?? '∅')}</span> 
            <span class="arrow">→</span> 
            <span class="val-new">${escapeHtml(details.nouvelle_valeur ?? '∅')}</span>
        </div>`;
    }

    // Gestion des clés arbitraires restantes
    const keysIgnored = ['commande', 'champ', 'ancienne_valeur', 'nouvelle_valeur', 'orderId', 'ancienneValeur', 'nouvelleValeur'];
    Object.keys(details).forEach(key => {
        if (!keysIgnored.includes(key) && details[key] !== null && details[key] !== '') {
            html += `<span class="detail-extra"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(details[key])}</span> `;
        }
    });

    html += '</div>';
    return html;
}

async function loadAuditLogs() {
    const role = document.getElementById('filterRole').value;
    const search = document.getElementById('filterKeyword').value;
    const date = document.getElementById('filterDate').value;

    const queryParams = new URLSearchParams({ role, search, date }).toString();
    let logs = [];
    try {
        logs = await apiGet(`/api/supervision/logs?${queryParams}`);
    } catch (e) {
        toast(e.message || "Impossible de charger l'audit", 'error');
        return;
    }

    const tbody = document.getElementById('tblAuditLogs');
    tbody.innerHTML = '';

    if (!Array.isArray(logs) || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Aucune entrée pour ces filtres</td></tr>';
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        const roleClass = 'role-' + (log.role || 'inconnu').replace(/[^a-z_]/gi, '');

        tr.innerHTML = `
            <td><span class="date-cell">${escapeHtml(log.created_at)}</span></td>
            <td><strong>${escapeHtml(log.username)}</strong>${log.user_nom ? '<br><small class="user-sub">' + escapeHtml(log.user_nom) + '</small>' : ''}</td>
            <td><span class="badge-role ${roleClass}">${escapeHtml(log.role)}</span></td>
            <td><span class="action-title">${escapeHtml(log.action)}</span></td>
            <td><span class="module-tag">${escapeHtml(log.module)}</span></td>
            <td>${formatDetailsHTML(log.details)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}