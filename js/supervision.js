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

    // Fermeture de la modale au clic en dehors
    const modal = document.getElementById('log-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeLogModal();
        });
    }

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

    container.innerHTML = '';
    logs.slice(0, 40).forEach((log) => {
        const div = document.createElement('div');
        div.className = 'live-entry';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <span class="heure">${escapeHtml(log.created_at)}</span>
            <strong>${escapeHtml(log.username)}</strong> (${escapeHtml(log.role)}) — ${escapeHtml(log.action)}
            <span style="color:var(--text-dim);"> · ${escapeHtml(log.module)}</span>
        `;
        // Attachement propre de l'événement clic sans guillemets HTML
        div.addEventListener('click', () => showLogDetails(log));
        container.appendChild(div);
    });
}

async function checkSupervisionAuth() {
    try {
        const { user } = await apiGet('/api/auth/me');
        if (!user || user.role !== 'superviseur') {
            window.location.href = '/login.html';
            return false;
        }
        document.getElementById('rolePill').textContent = (user.nom || user.username) + ' · superviseur';
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

    if (details.commande || details.orderId) {
        html += `<span class="detail-tag detail-cmd">Cmd #${escapeHtml(details.commande || details.orderId)}</span> `;
    }
    if (details.champ) {
        html += `<span class="detail-tag detail-field">${escapeHtml(details.champ)}</span> `;
    }

    const oldVal = details.ancienne_valeur ?? details.ancienneValeur;
    const newVal = details.nouvelle_valeur ?? details.nouvelleValeur;

    if (oldVal !== undefined || newVal !== undefined) {
        html += `<div class="detail-change">
            <span class="val-old">${escapeHtml(oldVal ?? '∅')}</span> 
            <span class="arrow">→</span> 
            <span class="val-new">${escapeHtml(newVal ?? '∅')}</span>
        </div>`;
    }

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
        if (typeof toast === 'function') toast(e.message || "Impossible de charger l'audit", 'error');
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

        tr.style.cursor = 'pointer';
        tr.innerHTML = `
            <td><span class="date-cell">${escapeHtml(log.created_at)}</span></td>
            <td><strong>${escapeHtml(log.username)}</strong>${log.user_nom ? '<br><small class="user-sub">' + escapeHtml(log.user_nom) + '</small>' : ''}</td>
            <td><span class="badge-role ${roleClass}">${escapeHtml(log.role)}</span></td>
            <td><span class="action-title">${escapeHtml(log.action)}</span></td>
            <td><span class="module-tag">${escapeHtml(log.module)}</span></td>
            <td>${formatDetailsHTML(log.details)}</td>
        `;

        tr.addEventListener('click', () => showLogDetails(log));

        tbody.appendChild(tr);
    });
}

function showLogDetails(log) {
    const modalBody = document.getElementById('modal-body');
    const details = log.details || {};

    const cmd = details.commande || details.orderId || 'N/A';
    const oldVal = details.ancienne_valeur ?? details.ancienneValeur ?? '<em>Aucune</em>';
    const newVal = details.nouvelle_valeur ?? details.nouvelleValeur ?? '<em>Aucune</em>';

    modalBody.innerHTML = `
        <p><strong>Horodatage :</strong> ${escapeHtml(log.created_at)}</p>
        <p><strong>Utilisateur :</strong> ${escapeHtml(log.username)} ${log.user_nom ? '(' + escapeHtml(log.user_nom) + ')' : ''}</p>
        <p><strong>Rôle :</strong> ${escapeHtml(log.role)}</p>
        <p><strong>Action :</strong> ${escapeHtml(log.action)}</p>
        <p><strong>Module :</strong> ${escapeHtml(log.module)}</p>
        <hr>
        <p><strong>Commande :</strong> ${escapeHtml(cmd)}</p>
        <p><strong>Champ modifié :</strong> ${escapeHtml(details.champ || 'N/A')}</p>
        <p><strong>Ancienne Valeur :</strong> ${escapeHtml(oldVal)}</p>
        <p><strong>Nouvelle Valeur :</strong> ${escapeHtml(newVal)}</p>
    `;

    document.getElementById('log-modal').style.display = 'flex';
}

function closeLogModal() {
    document.getElementById('log-modal').style.display = 'none';
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