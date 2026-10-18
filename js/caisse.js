let PRODUITS = [];
let categorieActive = 'Tous';
let draft = []; // commande en cours de saisie (pas encore envoyée à l'API)
let USER = null;
let socket = null;

async function init() {
  USER = await requireStaffAuth(['serveur', 'chef', 'assistant_chef', 'admin']);
  if (!USER) return;
  document.getElementById('rolePill').textContent = USER.nom + ' · ' + USER.role;

  PRODUITS = await apiGet('/api/products');
  construireOnglets();
  afficherMenu();
  chargerCommandesEnCours();

  socket = connectSocket();
  if (socket) {
    socket.on('commande_prete', (commande) => {
      if (commande.servedBy && commande.servedBy.id === USER.id) {
        toast(`✅ Commande #${commande.numero} prête à servir !`, 'success');
      }
      chargerCommandesEnCours();
    });
    socket.on('commande_statut', chargerCommandesEnCours);
    socket.on('commande_creee', chargerCommandesEnCours);
  }
  // Filet de sécurité : si les WebSocket sont bloqués par l'hébergeur, on continue de
  // rafraîchir périodiquement (moins instantané, mais rien ne reste bloqué).
  setInterval(chargerCommandesEnCours, 15000);

  document.getElementById('btnDeconnexion').addEventListener('click', async () => {
    await apiPost('/api/auth/logout');
    window.location.href = '/login.html';
  });

  document.getElementById('btnEnvoyerCuisine').addEventListener('click', envoyerEnCuisine);
}

function construireOnglets() {
  const categories = ['Tous', ...new Set(PRODUITS.map((p) => p.categorie))];
  const container = document.getElementById('tabsCategoriesCaisse');
  container.innerHTML = categories.map((c) => `<button class="tab ${c === categorieActive ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  container.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => {
    categorieActive = btn.dataset.cat;
    construireOnglets();
    afficherMenu();
  }));
}

function afficherMenu() {
  const liste = (categorieActive === 'Tous' ? PRODUITS : PRODUITS.filter((p) => p.categorie === categorieActive)).filter((p) => p.disponible);
  const grille = document.getElementById('grilleMenuCaisse');
  grille.innerHTML = liste.map((p) => `
    <div class="card product-card">
      <div class="product-title-row"><h3>${p.nom}</h3><span class="price">${formatMontant(p.prix)}</span></div>
      ${p.options.length ? `<select data-option-for="${p.id}">${p.options.map((o) => `<option>${o}</option>`).join('')}</select>` : ''}
      <button class="btn btn--sm" data-add="${p.id}">+ Ajouter</button>
    </div>
  `).join('');
  grille.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => {
    const produit = PRODUITS.find((p) => p.id === btn.dataset.add);
    const selectOption = grille.querySelector(`select[data-option-for="${produit.id}"]`);
    ajouterAuDraft(produit, selectOption ? [selectOption.value] : []);
  }));
}

function ajouterAuDraft(produit, options) {
  const existant = draft.find((l) => l.productId === produit.id && JSON.stringify(l.options) === JSON.stringify(options));
  if (existant) existant.quantite += 1;
  else draft.push({ id: 'd' + Date.now() + Math.random().toString(36).slice(2, 5), productId: produit.id, nom: produit.nom, prix: produit.prix, quantite: 1, options: options || [] });
  afficherDraft();
}

function afficherDraft() {
  const container = document.getElementById('draftItems');
  if (draft.length === 0) {
    container.innerHTML = '<div class="empty-state" style="color:#8a8168;">Ajoutez des articles depuis le menu</div>';
  } else {
    container.innerHTML = draft.map((l) => `
      <div class="ticket-row" style="align-items:center;">
        <span>${l.quantite}× ${l.nom}${l.options.length ? ' (' + l.options.join(', ') + ')' : ''}</span>
        <span>
          <button data-moins="${l.id}" style="border:none;background:none;cursor:pointer;">−</button>
          <button data-plus="${l.id}" style="border:none;background:none;cursor:pointer;">+</button>
          <button data-suppr="${l.id}" style="border:none;background:none;cursor:pointer;color:#a83f36;">✕</button>
        </span>
      </div>
    `).join('');
    container.querySelectorAll('[data-plus]').forEach((b) => b.addEventListener('click', () => { modifierQte(b.dataset.plus, 1); }));
    container.querySelectorAll('[data-moins]').forEach((b) => b.addEventListener('click', () => { modifierQte(b.dataset.moins, -1); }));
    container.querySelectorAll('[data-suppr]').forEach((b) => b.addEventListener('click', () => { draft = draft.filter((l) => l.id !== b.dataset.suppr); afficherDraft(); }));
  }
  document.getElementById('draftTotal').textContent = formatMontant(draft.reduce((s, l) => s + l.prix * l.quantite, 0));
}

function modifierQte(id, delta) {
  const l = draft.find((x) => x.id === id);
  if (!l) return;
  l.quantite += delta;
  if (l.quantite <= 0) draft = draft.filter((x) => x.id !== id);
  afficherDraft();
}

async function envoyerEnCuisine() {
  if (draft.length === 0) return toast('Ajoutez au moins un article', 'error');
  const type = document.getElementById('selectTypeService').value;
  const table = document.getElementById('inputTable').value;
  if (type === 'sur_place' && !table) return toast('Indiquez le numéro de table', 'error');

  try {
    const commande = await apiPost('/api/orders', { type, table: type === 'sur_place' ? table : null, items: draft });
    await apiPost(`/api/orders/${commande.id}/envoyer-cuisine`);
    toast(`Commande #${commande.numero} envoyée en cuisine 🔥`, 'success');
    draft = [];
    afficherDraft();
    document.getElementById('inputTable').value = '';
    chargerCommandesEnCours();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function escapeHtml(str) {
  return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const statutsConnus = {}; // pour détecter le passage à "Prête" entre deux rafraîchissements

function libelleType(c) {
  if (c.table) return 'Table ' + escapeHtml(c.table);
  if (c.type === 'a_emporter') return 'À emporter';
  if (c.type === 'a_l_avance') return "À l'avance";
  return escapeHtml(c.type || '');
}

async function chargerCommandesEnCours() {
  try {
    const commandes = await apiGet('/api/orders');
    if (!Array.isArray(commandes)) {
      throw new Error("L'API n'a pas renvoyé une liste de commandes.");
    }

    // Commandes du site, pas encore validées par le staff
    const enAttente = commandes.filter(c =>
        !c.envoiCuisine && !c.servedBy &&
        ['NOUVELLE', 'CONFIRMEE'].includes(c.statut)
    );

    // Commandes envoyées en cuisine et pas encore terminées
    const enCuisine = commandes.filter(c =>
        c.envoiCuisine && !['TERMINEE', 'ANNULEE'].includes(c.statut)
    );

    afficherCommandesEnAttente(enAttente);
    afficherCommandesEnCuisine(enCuisine);
  } catch (err) {
    console.error('Erreur chargement commandes :', err);
  }
}

function afficherCommandesEnAttente(liste) {
  const container = document.getElementById('listeCommandesEnAttente');
  if (!container) {
    console.warn('Conteneur #listeCommandesEnAttente absent de caisse.html');
    return;
  }

  if (liste.length === 0) {
    container.innerHTML = '<div class="empty-state" style="color:#8a8168;">Aucune commande du site en attente</div>';
    return;
  }

  container.innerHTML = liste.map(c => `
    <div class="card" style="margin-bottom:0.8rem; border-left:4px solid var(--accent);">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <strong>#${escapeHtml(c.numero)} — ${escapeHtml(c.clientNom || 'Client')}</strong>
        <span class="badge badge--wait">En attente</span>
      </div>
      <p style="margin:0.4rem 0; font-size:0.9rem;">
        📞 <a href="tel:${escapeHtml(c.clientTel || '')}" style="color:var(--accent); font-weight:bold;">${escapeHtml(c.clientTel || '—')}</a><br>
        <em>${libelleType(c)}</em>
      </p>
      ${c.notes ? `<p style="margin:0.2rem 0; font-size:0.82rem; color:var(--accent);">📝 ${escapeHtml(c.notes)}</p>` : ''}
      <div class="ticket-sep"></div>
      <div style="font-size:0.85rem;">
        ${c.items.map(it => `<div>${it.quantite}× ${escapeHtml(it.nom)}${it.options && it.options.length ? ' <small>(' + escapeHtml(it.options.join(', ')) + ')</small>' : ''}</div>`).join('')}
      </div>
      <div class="ticket-total" style="font-size:0.95rem; margin-top:0.4rem;">
        <span>Total</span><span>${formatMontant(c.total)}</span>
      </div>
      <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
        <button class="btn btn--sm btn--success" style="flex:1;" onclick="validerCommande('${c.id}')">✅ Valider &amp; cuisine</button>
        <button class="btn btn--sm btn--danger" style="flex:1;" onclick="annulerCommande('${c.id}')">❌ Annuler</button>
      </div>
    </div>
  `).join('');
}

function afficherCommandesEnCuisine(liste) {
  const container = document.getElementById('listeCommandesEnCuisine')
      || document.getElementById('listeCommandesEnCours');
  if (!container) return;

  // Un serveur voit ses commandes et celles du site ; chef/admin voient tout
  const visibles = liste.filter(c =>
      USER.role !== 'serveur' || !c.servedBy || c.servedBy.id === USER.id
  );

  // Notification quand une commande vient de passer "Prête"
  visibles.forEach(c => {
    if (c.statut === 'PRETE' && statutsConnus[c.id] && statutsConnus[c.id] !== 'PRETE') {
      toast(`✅ Commande #${c.numero} prête à servir !`, 'success');
    }
    statutsConnus[c.id] = c.statut;
  });

  if (visibles.length === 0) {
    container.innerHTML = '<div class="empty-state">Aucune commande en cours.</div>';
    return;
  }

  container.innerHTML = visibles.map(c => `
    <div class="card" style="margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; gap:1rem;">
      <div>
        <strong>#${escapeHtml(c.numero)}</strong> — ${libelleType(c)}<br>
        <small>${c.items.length} article(s) · ${formatMontant(c.total)}</small>
      </div>
      <div style="text-align:right;">
        <span class="badge ${c.statut === 'PRETE' ? 'badge--ok' : 'badge--wait'}">${escapeHtml(c.statut.replace('_', ' '))}</span><br>
        ${c.statut === 'PRETE'
      ? `<button class="btn btn--sm btn--success" style="margin-top:0.4rem;" onclick="encaisserCommande('${c.id}')">Encaisser</button>`
      : ''}
      </div>
    </div>
  `).join('');
}

async function validerCommande(commandeId) {
  try {
    await apiPost(`/api/orders/${commandeId}/envoyer-cuisine`);
    toast('Commande envoyée en cuisine !', 'success');
    await chargerCommandesEnCours();
  } catch (err) {
    console.error('Erreur validation commande :', err);
    toast(err.message || 'Erreur lors de la validation', 'error');
  }
}

async function annulerCommande(commandeId) {
  if (!confirm('Voulez-vous vraiment annuler cette commande ?')) return;
  try {
    await apiPatch(`/api/orders/${commandeId}/statut`, { statut: 'ANNULEE' });
    toast('Commande annulée', 'success');
    await chargerCommandesEnCours();
  } catch (err) {
    console.error('Erreur annulation commande :', err);
    toast(err.message || "Erreur lors de l'annulation", 'error');
  }
}

async function encaisserCommande(commandeId) {
  try {
    await apiPatch(`/api/orders/${commandeId}/statut`, { statut: 'TERMINEE' });
    toast('Commande encaissée et terminée', 'success');
    await chargerCommandesEnCours();
  } catch (err) {
    toast(err.message || "Erreur lors de l'encaissement", 'error');
  }
}

init();
