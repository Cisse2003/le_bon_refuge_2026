let USER = null;
let socket = null;
let posteActif = 'tous';
let COMMANDES = [];

function biper() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* audio non disponible */ }
}

async function init() {
  USER = await requireStaffAuth(['chef', 'assistant_chef', 'admin']);
  if (!USER) return;
  document.getElementById('rolePill').textContent = USER.nom + ' · ' + USER.role;

  document.getElementById('selectPoste').addEventListener('change', (e) => { posteActif = e.target.value; charger(); });
  document.getElementById('btnDeconnexion').addEventListener('click', async () => { await apiPost('/api/auth/logout'); window.location.href = '/login.html'; });

  await charger();

  socket = connectSocket();
  if (socket) {
    socket.on('nouvelle_commande_cuisine', () => { biper(); charger(); });
    socket.on('commande_statut', charger);
    socket.on('commande_modifiee', charger);
    socket.on('commande_supprimee', charger);
  }
  setInterval(charger, 5000); // filet de sécurité si un événement socket est manqué
}

function itemsPourPoste(order) {
  if (posteActif === 'tous') return order.items;
  return order.items.filter((it) => it.poste === posteActif);
}


const commandesConnues = new Set();
let premierChargement = true;

// L'API passe la commande en CONFIRMEE à l'envoi en cuisine : pour le cuisinier, c'est une "Nouvelle"
function statutAffiche(o) {
  return o.statut === 'CONFIRMEE' ? 'NOUVELLE' : o.statut;
}

function dateISO(s) {
  return String(s || '').replace(' ', 'T'); // compatible Safari
}

function detailPerso(p) {
  if (!p) return '';
  const parts = [p.taille, p.parfum];
  if (p.decoration) parts.push('déco : ' + p.decoration);
  if (p.texte) parts.push('texte : « ' + p.texte + ' »');
  if (p.date) parts.push('retrait ' + p.date + ' ' + (p.heure || ''));
  return ' <em>- ' + escapeHtml(parts.filter(Boolean).join(', ')) + '</em>';
}

async function charger() {
  let orders;
  try {
    orders = await apiGet('/api/orders');
  } catch (err) {
    console.error('Erreur chargement cuisine :', err);
    return;
  }
  if (!Array.isArray(orders)) return;
  COMMANDES = orders;

  // Bip pour chaque commande envoyée en cuisine apparue depuis le dernier rafraîchissement
  let nouvelle = false;
  orders.filter((o) => o.envoiCuisine).forEach((o) => {
    if (!commandesConnues.has(o.id)) {
      commandesConnues.add(o.id);
      if (!premierChargement && statutAffiche(o) === 'NOUVELLE') nouvelle = true;
    }
  });
  premierChargement = false;
  if (nouvelle) biper();

  console.log('[KDS] Réponse API', {
    total: orders.length,
    envoyees: orders.filter(o => o.envoiCuisine).length,
    premierStatut: orders.find(o => o.envoiCuisine)?.statut,
    posteActif
  });

  const pertinentes = orders.filter((o) => o.envoiCuisine && itemsPourPoste(o).length > 0);

  const auj = new Date().toLocaleDateString('fr-CA'); // AAAA-MM-JJ, heure locale
  const parStatut = { NOUVELLE: [], EN_PREPARATION: [], PRETE: [], TERMINEE: [] };
  pertinentes.forEach((o) => {
    const st = statutAffiche(o);
    if (st === 'TERMINEE') {
      if (String(o.dateCreation).slice(0, 10) === auj) parStatut.TERMINEE.push(o);
    } else if (parStatut[st]) {
      parStatut[st].push(o);
    }
  });

  /*
  console.log('[KDS] Résultat du filtrage', {
    pertinentes: pertinentes.length,
    nouvelles: parStatut.NOUVELLE.length,
    preparation: parStatut.EN_PREPARATION.length,
    pretes: parStatut.PRETE.length,
    terminees: parStatut.TERMINEE.length
  });  */

  document.getElementById('colNouvelle').innerHTML = rendreColonne(parStatut.NOUVELLE, 'NOUVELLE', true);
  document.getElementById('colEnPreparation').innerHTML = rendreColonne(parStatut.EN_PREPARATION, 'EN_PREPARATION', false);
  document.getElementById('colPrete').innerHTML = rendreColonne(parStatut.PRETE, 'PRETE', false);
  document.getElementById('colTerminee').innerHTML = rendreColonne(parStatut.TERMINEE.slice(0, 8), 'TERMINEE', false);
  attacherEvenements();
}

function rendreColonne(orders, statut, urgent) {
  if (orders.length === 0) return '<div class="empty-state" style="padding:1rem 0;">-</div>';
  const lectureSeule = statut === 'TERMINEE';
  const casesActives = statut === 'EN_PREPARATION' || statut === 'PRETE';

  return orders.map((o) => {
    const lieu = o.table ? 'Table ' + escapeHtml(o.table)
        : o.type === 'a_emporter' ? 'À emporter'
            : o.type === 'a_l_avance' ? "À l'avance"
                : escapeHtml(o.type);

    const lignes = itemsPourPoste(o).map((it) => {
      const texte = `${it.quantite}× ${escapeHtml(it.nom)}
        ${it.options && it.options.length ? '<em>(' + escapeHtml(it.options.join(', ')) + ')</em>' : ''}
        ${detailPerso(it.personnalisation)}`;
      if (!casesActives) {
        return `<div class="kds-item-row ${it.statutItem === 'PRETE' ? 'done' : ''}"><span>${texte}</span></div>`;
      }
      return `
        <div class="kds-item-row ${it.statutItem === 'PRETE' ? 'done' : ''}">
          <label style="display:flex; gap:0.4em; align-items:center; cursor:pointer;">
            <input type="checkbox" ${it.statutItem === 'PRETE' ? 'checked' : ''}
              data-order="${o.id}" data-item="${it.id}">
            <span>${texte}</span>
          </label>
        </div>`;
    }).join('');

    const actions = statut === 'NOUVELLE'
        ? `<button class="btn btn--sm" data-demarrer="${o.id}">🔥 Démarrer la préparation</button>`
        : '';
    const annuler = !lectureSeule
        ? `<button class="btn btn--sm btn--ghost" data-annuler="${o.id}">Annuler</button>`
        : '';

    return `
    <div class="card kds-card ${urgent ? 'urgent' : ''}">
      <h4><span>#${escapeHtml(o.numero)}</span><span>${formatHeure(dateISO(o.dateCreation))}</span></h4>
      <div class="tag-poste">${lieu}</div>
      ${o.clientNom ? `<div style="font-size:0.8rem; color:var(--text-dim); margin-top:0.3rem;">${escapeHtml(o.clientNom)}</div>` : ''}
      <div style="margin-top:0.6rem;">${lignes}</div>
      ${o.notes ? `<div style="margin-top:0.5rem; font-size:0.82rem; color:var(--accent);">📝 ${escapeHtml(o.notes)}</div>` : ''}
      <div style="margin-top:0.8rem; display:flex; gap:0.4rem; flex-wrap:wrap;">${actions}${annuler}</div>
    </div>`;
  }).join('');
}

function attacherEvenements() {
  // Démarrer : tous les articles de la commande passent "en préparation"
  document.querySelectorAll('[data-demarrer]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const commande = COMMANDES.find((o) => o.id === btn.dataset.demarrer);
      if (!commande) return;
      try {
        for (const it of commande.items) {
          if (it.statutItem === 'ATTENTE') {
            await apiPatch(`/api/orders/${commande.id}/items/${it.id}/statut`, { statutItem: 'EN_PREPARATION' });
          }
        }
        charger();
      } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
    });
  });

  // Cases : article prêt / retour en préparation
  document.querySelectorAll('input[type=checkbox][data-item]').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const nouveauStatut = chk.checked ? 'PRETE' : 'EN_PREPARATION';
      try {
        await apiPatch(`/api/orders/${chk.dataset.order}/items/${chk.dataset.item}/statut`, { statutItem: nouveauStatut });
        charger();
      } catch (err) { toast(err.message, 'error'); chk.checked = !chk.checked; }
    });
  });

  document.querySelectorAll('[data-annuler]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Annuler cette commande ?')) return;
      try {
        await apiPatch(`/api/orders/${btn.dataset.annuler}/statut`, { statut: 'ANNULEE' });
        charger();
      } catch (err) { toast(err.message, 'error'); }
    });
  });
}
init();
