// Petite couche d'accès à l'API + notifications (utilisée par toutes les pages)

async function api(method, url, body) {
  const opts = {
    method,
    headers: {},
    credentials: 'same-origin'
  };

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);

  if (!res.ok) {
    let message = `Erreur ${res.status}`;

    try {
      const data = await res.json();

      if (data && data.error) {
        message = data.error;
      }
    } catch (e) {
      // La réponse n'est pas du JSON
    }

    throw new Error(message);
  }

  /*
   * Certaines routes peuvent retourner du JSON,
   * d'autres un fichier.
   */
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await res.json();
  }

  if (contentType.includes('application/pdf')) {
    return await res.blob();
  }

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

const apiGet = (url) => api('GET', url);
const apiPost = (url, body) => api('POST', url, body || {});
const apiPut = (url, body) => api('PUT', url, body || {});
const apiPatch = (url, body) => api('PATCH', url, body || {});
const apiDelete = (url) => api('DELETE', url);

function ensureToastContainer() {
  let el = document.querySelector('.toast-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function toast(message, type) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function formatMontant(n) {
  // Franc guinéen (FG) : pas de décimales, séparateur de milliers "espace" (convention locale/française)
  return Math.round(Number(n || 0)).toLocaleString('fr-FR') + ' FG';
}

function formatHeure(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function getCurrentUser() {
  try {
    const { user } = await apiGet('/api/auth/me');
    return user;
  } catch (e) {
    return null;
  }
}

async function requireStaffAuth(rolesAutorises) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  if (rolesAutorises && !rolesAutorises.includes(user.role)) {
    document.body.innerHTML = '<div class="empty-state"><h2>Accès refusé</h2><p>Votre rôle ne permet pas d\'accéder à cette page.</p><a class="btn" href="/">Retour au site</a></div>';
    return null;
  }
  return user;
}

function connectSocket() {
  // Version PHP : pas de WebSocket, le polling (setInterval) des pages suffit.
  return null;
}

const API = {
  async getMenu() {
    return await apiGet('/api/products');
  },

  async getContact() {
    return await apiGet('/api/settings/contact');
  },

  async creerCommande(payload) {
    console.log('📤 Création de la commande :', payload);

    const reponse = await apiPost('/api/orders', payload);

    console.log('📥 Réponse serveur :', reponse);

    return reponse;
  },

  async creerReservation(payload) {
    return await apiPost('/api/reservations', payload);
  }
};