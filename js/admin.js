let USER = null;
let PRODUITS_CACHE = [];
let INGREDIENTS_CACHE = [];

if (typeof escapeHtml !== 'function') {
  window.escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const dateISO = (s) => String(s || '').replace(' ', 'T'); // dates MySQL compatibles Safari
let USERS_CACHE = [];

async function init() {
  USER = await requireStaffAuth(['admin', 'chef', 'assistant_chef', 'superviseur']);
  if (!USER) return;
  document.getElementById('rolePill').textContent = USER.nom + ' · ' + USER.role;

  // Certains onglets sont réservés à l'administrateur et le supervisieur
  if (USER.role !== 'admin' && USER.role !== 'superviseur') {
    document.querySelectorAll('[data-panel="utilisateurs"]').forEach((b) => b.remove());
  }

  document.getElementById('btnDeconnexion').addEventListener('click', async () => {
    await apiPost('/api/auth/logout');
    window.location.href = '/login.html';
  });

  document.querySelectorAll('#adminNav button').forEach((btn) => {
    btn.addEventListener('click', () => ouvrirPanel(btn.dataset.panel));
  });
  document.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('open'))));

  try { PRODUITS_CACHE = await apiGet('/api/products'); } catch (e) { console.error('products', e); }
  try { INGREDIENTS_CACHE = await apiGet('/api/ingredients'); } catch (e) { INGREDIENTS_CACHE = []; }
  chargerDashboard().catch((e) => console.error('dashboard', e));

  document.getElementById('btnNouveauProduit').addEventListener('click', () => ouvrirModaleProduit());
  document.getElementById('formProduit').addEventListener('submit', enregistrerProduit);

  document.getElementById('btnNouvelUtilisateur')
      .addEventListener('click', () => ouvrirModaleUtilisateur());

  document.getElementById('formUtilisateur')
      .addEventListener('submit', enregistrerUtilisateur);

  document.getElementById('btnNouvelIngredient').addEventListener('click', () => ouvrirModaleIngredient());
  document.getElementById('formIngredient').addEventListener('submit', enregistrerIngredient);
  document.getElementById('btnAjouterLigneRecette').addEventListener('click', () => ajouterLigneRecette());

  document.getElementById('filtreStatutCommande').addEventListener('change', chargerCommandes);

  if (typeof surveillerChangements === 'function') surveillerChangements(() => {
    const chargeurs = {
      dashboard: chargerDashboard, produits: chargerProduits, stock: chargerStock,
      ingredients: chargerIngredients, commandes: chargerCommandes,
      reservations: chargerReservations, historique: chargerHistorique,
    };
    const actif = document.querySelector('.panel.active');
    if (actif && chargeurs[actif.id.replace('panel-', '')]) chargeurs[actif.id.replace('panel-', '')]();
  });
}

function ouvrirPanel(nom) {
  document.querySelectorAll('#adminNav button').forEach((b) => b.classList.toggle('active', b.dataset.panel === nom));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + nom));
  const chargeurs = {
    dashboard: chargerDashboard, produits: chargerProduits, stock: chargerStock,
    ingredients: chargerIngredients,
    commandes: chargerCommandes, reservations: chargerReservations,
    utilisateurs: chargerUtilisateurs, historique: chargerHistorique,
    planning: () => chargerDonneesPlanning()
  };
  if (chargeurs[nom]) chargeurs[nom]();
}

// ---------------- DASHBOARD ----------------
async function chargerDashboard() {
  const s = await apiGet('/api/dashboard/stats');
  document.getElementById('statsGrid').innerHTML = `
    <div class="card stat-card"><div class="num">${formatMontant(s.caJour)}</div><div class="label">CA du jour</div></div>
    <div class="card stat-card"><div class="num">${formatMontant(s.caSemaine)}</div><div class="label">CA de la semaine</div></div>
    <div class="card stat-card"><div class="num">${formatMontant(s.caMois)}</div><div class="label">CA du mois</div></div>
    <div class="card stat-card"><div class="num">${s.nbCommandesJour}</div><div class="label">Commandes du jour</div></div>
    <div class="card stat-card"><div class="num">${formatMontant(s.panierMoyen)}</div><div class="label">Panier moyen</div></div>
    <div class="card stat-card"><div class="num">${s.commandesEnCours ?? 0}</div><div class="label">Commandes en cours</div></div>
  `;
  const top = s.topProduits || [];
  const cats = s.ventesCategorie || [];
  document.getElementById('tblTopProduits').innerHTML = top.map((p) => `<tr><td>${escapeHtml(p.nom)}</td><td>${p.quantite}</td></tr>`).join('') || '<tr><td colspan="2">Pas encore de données</td></tr>';
  document.getElementById('tblVentesCategorie').innerHTML = cats.map((c) => `<tr><td>${escapeHtml(c.categorie)}</td><td>${formatMontant(c.total)}</td></tr>`).join('') || '<tr><td colspan="2">Pas encore de données</td></tr>';
}

// ---------------- PRODUITS ----------------
async function chargerProduits() {
  PRODUITS_CACHE = await apiGet('/api/products');
  document.getElementById('tblProduits').innerHTML = PRODUITS_CACHE.map((p) => `
    <tr>
      <td>${p.nom}</td><td>${p.categorie}</td><td>${formatMontant(p.prix)}</td><td>${p.poste}</td>
      <td>${p.disponible ? '<span class="badge badge--ok">Oui</span>' : '<span class="badge badge--out">Non</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn--sm btn--ghost" data-edit="${p.id}">Modifier</button>
        ${USER.role === 'admin' ? `<button class="btn btn--sm btn--danger" data-del="${p.id}">Suppr.</button>` : ''}
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => ouvrirModaleProduit(PRODUITS_CACHE.find((p) => p.id === b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Supprimer ce produit ?')) return;
    await apiDelete(`/api/products/${b.dataset.del}`);
    chargerProduits();
  }));
}

function ouvrirModaleProduit(produit) {
  const form = document.getElementById('formProduit');
  form.reset();
  document.getElementById('titreModalProduit').textContent = produit ? 'Modifier le produit' : 'Nouveau produit';
  if (produit) {
    form.id.value = produit.id;
    form.nom.value = produit.nom;
    form.categorie.value = produit.categorie;
    form.description.value = produit.description || '';
    form.prix.value = produit.prix;
    form.poste.value = produit.poste;
    form.options.value = (produit.options || []).join(', ');
    form.photo.value = produit.photo || '';
    form.disponible.checked = !!produit.disponible;
  } else {
    form.disponible.checked = true;
  }
  // Rôles restreints : uniquement la case "disponible" est modifiable
  const champsAdmin = ['nom', 'categorie', 'description', 'prix', 'poste', 'options', 'photoFile'];
  champsAdmin.forEach((c) => { if (form[c]) form[c].disabled = USER.role !== 'admin'; });

  document.getElementById('lignesRecette').innerHTML = '';
  (produit && Array.isArray(produit.recette) ? produit.recette : []).forEach((ligne) => ajouterLigneRecette(ligne));
  document.getElementById('btnAjouterLigneRecette').style.display = USER.role === 'admin' ? '' : 'none';

  document.getElementById('modalProduit').classList.add('open');
}

function ajouterLigneRecette(ligne) {
  if (INGREDIENTS_CACHE.length === 0) {
    document.getElementById('lignesRecette').innerHTML = '<p style="color:var(--text-dim); font-size:0.85rem;">Créez d\'abord des ingrédients dans l\'onglet "Ingrédients &amp; inventaire".</p>';
    return;
  }
  const readOnly = USER.role !== 'admin';
  const div = document.createElement('div');
  div.className = 'field-row ligne-recette';
  div.style.alignItems = 'center';
  div.innerHTML = `
    <select class="recette-ingredient" ${readOnly ? 'disabled' : ''}>
      ${INGREDIENTS_CACHE.map((i) => `<option value="${i.id}" ${ligne && ligne.ingredientId === i.id ? 'selected' : ''}>${i.nom} (${i.unite})</option>`).join('')}
    </select>
    <div style="display:flex; gap:0.4rem;">
      <input type="number" class="recette-quantite" min="0" step="1" placeholder="Qté / unité vendue" value="${ligne ? ligne.quantite : ''}" ${readOnly ? 'disabled' : ''}>
      ${!readOnly ? '<button type="button" class="btn btn--sm btn--danger" data-suppr-ligne>✕</button>' : ''}
    </div>
  `;
  document.getElementById('lignesRecette').appendChild(div);
  const btnSuppr = div.querySelector('[data-suppr-ligne]');
  if (btnSuppr) btnSuppr.addEventListener('click', () => div.remove());
}

async function enregistrerProduit(e) {
  e.preventDefault();

  const form = e.target;
  const bouton = form.querySelector('button[type="submit"]');

  if (bouton) {
    bouton.disabled = true;
    bouton.textContent = 'Enregistrement...';
  }

  try {
    const fd = new FormData(form);

    // Conserver la photo existante lors d'une modification.
    let photoUrl = fd.get('photo') || '';
    const fichier = fd.get('photoFile');

    if (fichier && fichier.size > 5 * 1024 * 1024) {
      throw new Error(
          `La photo "${fichier.name}" dépasse la limite de 5 Mo. ` +
          `Réduis sa taille avant de recommencer.`
      );
    }

    // 1. Envoyer la photo au serveur si un nouveau fichier est sélectionné.
    if (fichier instanceof File && fichier.size > 0) {
      if (!fichier.type.startsWith('image/')) {
        throw new Error('Le fichier sélectionné doit être une image.');
      }

      const uploadFd = new FormData();
      uploadFd.append('photo', fichier);

      const reponseUpload = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: uploadFd
      });

      // Lire la réponse même si le serveur renvoie une erreur.
      const texteUpload = await reponseUpload.text();

      let resultatUpload;

      try {
        resultatUpload = JSON.parse(texteUpload);
      } catch {
        throw new Error(
            `Le serveur a renvoyé une réponse invalide lors de l'envoi de la photo. ` +
            `HTTP ${reponseUpload.status}.`
        );
      }

      // Ne pas continuer si l'upload a échoué.
      if (!reponseUpload.ok) {
        throw new Error(
            resultatUpload.error ||
            resultatUpload.message ||
            `Échec de l'envoi de la photo (HTTP ${reponseUpload.status}).`
        );
      }

      if (!resultatUpload.url) {
        throw new Error(
            "La photo a été envoyée, mais le serveur n'a pas renvoyé son URL."
        );
      }

      photoUrl = resultatUpload.url;
    }

    // 2. Récupérer la recette du produit.
    const recette = Array.from(
        document.querySelectorAll('#lignesRecette .ligne-recette')
    ).map(div => ({
      ingredientId: div.querySelector('.recette-ingredient').value,
      quantite: parseFloat(
          div.querySelector('.recette-quantite').value
      ) || 0
    })).filter(ligne => ligne.quantite > 0);

    // 3. Préparer les données du produit, avec l'URL de la photo.
    const payload = {
      nom: fd.get('nom'),
      categorie: fd.get('categorie'),
      description: fd.get('description'),
      prix: parseFloat(fd.get('prix')),
      poste: fd.get('poste'),
      options: fd.get('options')
          ? fd.get('options').split(',').map(s => s.trim()).filter(Boolean)
          : [],
      photo: photoUrl,
      disponible: fd.get('disponible') === 'on',
      recette
    };

    // 4. Enregistrer ou modifier le produit.
    const id = fd.get('id');

    if (id) {
      if (USER.role === 'admin') {
        await apiPut(`/api/products/${id}`, payload);
      } else {
        await apiPut(`/api/products/${id}`, {
          disponible: payload.disponible
        });
      }
    } else {
      await apiPost('/api/products', payload);
    }

    // 5. Fermer la fenêtre et actualiser la liste.
    document.getElementById('modalProduit').classList.remove('open');

    toast('Produit enregistré avec succès.', 'success');

    await chargerProduits();

    // Actualiser aussi le menu public si cette page est ouverte.
    console.log('Produit enregistré. URL de la photo :', photoUrl);

  } catch (err) {
    console.error("Erreur lors de l'enregistrement du produit :", err);
    toast(err.message || "Impossible d'enregistrer le produit.", 'error');

  } finally {
    if (bouton) {
      bouton.disabled = false;
      bouton.textContent = 'Enregistrer';
    }
  }
}

// ---------------- STOCK (produits finis) ----------------
async function chargerStock() {
  const stock = await apiGet('/api/stock');
  document.getElementById('tblStock').innerHTML = stock.map((s) => `
    <tr>
      <td>${s.nom} ${s.alerte ? '<span class="badge badge--alert">Stock faible</span>' : ''}</td>
      <td><input type="number" value="${s.quantite}" style="margin:0; width:90px;" data-qte="${s.productId}"></td>
      <td><input type="number" value="${s.seuilAlerte}" style="margin:0; width:90px;" data-seuil="${s.productId}"></td>
      <td><button class="btn btn--sm" data-save-stock="${s.productId}">Enregistrer</button></td>
    </tr>
  `).join('');
  document.querySelectorAll('[data-save-stock]').forEach((btn) => btn.addEventListener('click', async () => {
    const id = btn.dataset.saveStock;
    const quantite = document.querySelector(`[data-qte="${id}"]`).value;
    const seuilAlerte = document.querySelector(`[data-seuil="${id}"]`).value;
    await apiPut(`/api/stock/${id}`, { quantite, seuilAlerte });
    toast('Stock mis à jour', 'success');
    chargerStock();
  }));
}

// ---------------- INGRÉDIENTS / INVENTAIRE THÉORIQUE ----------------
function formatQuantiteIngredient(unite, valeur) {
  if (unite === 'g') return valeur >= 1000 ? `${(valeur / 1000).toFixed(2).replace(/\.00$/, '')} kg` : `${valeur} g`;
  if (unite === 'ml') return valeur >= 1000 ? `${(valeur / 1000).toFixed(2).replace(/\.00$/, '')} L` : `${valeur} ml`;
  return `${valeur} pièce(s)`;
}

async function chargerIngredients() {
  INGREDIENTS_CACHE = await apiGet('/api/ingredients');
  document.getElementById('tblIngredients').innerHTML = INGREDIENTS_CACHE.map((i) => `
    <tr>
      <td style="display:flex; align-items:center; gap:0.6rem;">
        ${i.photo ? `<img src="${i.photo}" alt="${i.nom}" style="width:38px;height:38px;object-fit:cover;border-radius:6px;">` : `<span style="width:38px;height:38px;border-radius:6px;background:var(--bg-raised-2);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🥩</span>`}
        <span>${i.nom} ${i.alerte ? '<span class="badge badge--alert">Stock faible</span>' : ''}</span>
      </td>
      <td>${formatQuantiteIngredient(i.unite, i.quantiteStock)}</td>
      <td>${formatQuantiteIngredient(i.unite, i.seuilAlerte)}</td>
      <td><input type="number" placeholder="+ quantité reçue" style="margin:0; width:150px;" data-livraison="${i.id}"></td>
      <td style="white-space:nowrap;">
        <button class="btn btn--sm" data-recevoir="${i.id}">Réceptionner</button>
        <button class="btn btn--sm btn--ghost" data-edit-ing="${i.id}">Modifier</button>
        ${USER.role === 'admin' ? `<button class="btn btn--sm btn--danger" data-del-ing="${i.id}">Suppr.</button>` : ''}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5">Aucun ingrédient enregistré</td></tr>';

  document.querySelectorAll('[data-recevoir]').forEach((btn) => btn.addEventListener('click', async () => {
    const input = document.querySelector(`[data-livraison="${btn.dataset.recevoir}"]`);
    const ajouter = parseFloat(input.value);
    if (!ajouter || ajouter <= 0) return toast('Indiquez une quantité reçue supérieure à 0', 'error');
    await apiPut(`/api/ingredients/${btn.dataset.recevoir}`, { ajouter });
    toast('Livraison enregistrée, stock mis à jour', 'success');
    chargerIngredients();
  }));
  document.querySelectorAll('[data-edit-ing]').forEach((btn) => btn.addEventListener('click', () => {
    ouvrirModaleIngredient(INGREDIENTS_CACHE.find((i) => i.id === btn.dataset.editIng));
  }));
  document.querySelectorAll('[data-del-ing]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Supprimer cet ingrédient ? Les recettes qui le référencent ne le décompteront plus.')) return;
    await apiDelete(`/api/ingredients/${btn.dataset.delIng}`);
    chargerIngredients();
  }));
}

function ouvrirModaleIngredient(ingredient) {
  const form = document.getElementById('formIngredient');
  form.reset();
  document.getElementById('titreModalIngredient').textContent = ingredient ? "Modifier l'ingrédient" : 'Nouvel ingrédient';
  document.getElementById('apercuPhotoIngredient').innerHTML = '';
  if (ingredient) {
    form.id.value = ingredient.id;
    form.nom.value = ingredient.nom;
    form.unite.value = ingredient.unite;
    form.quantiteStock.value = ingredient.quantiteStock;
    form.seuilAlerte.value = ingredient.seuilAlerte;
    form.photo.value = ingredient.photo || '';
    form.quantiteStock.disabled = true; // le stock se modifie via "Réceptionner", pas ici
    if (ingredient.photo) {
      document.getElementById('apercuPhotoIngredient').innerHTML = `<img src="${ingredient.photo}" alt="" style="width:70px;height:70px;object-fit:cover;border-radius:8px;">`;
    }
  } else {
    form.quantiteStock.disabled = false;
  }
  document.getElementById('modalIngredient').classList.add('open');
}

async function enregistrerIngredient(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  let photoUrl = fd.get('photo') || '';
  const fichier = fd.get('photoFile');
  if (fichier && fichier.size > 0) {
    const uploadFd = new FormData();
    uploadFd.append('photo', fichier);
    const up = await fetch('/api/upload', { method: 'POST', body: uploadFd });
    const upData = await up.json();
    photoUrl = upData.url || photoUrl;
  }
  const id = fd.get('id');
  const payload = {
    nom: fd.get('nom'), unite: fd.get('unite'),
    seuilAlerte: parseFloat(fd.get('seuilAlerte')) || 0,
    photo: photoUrl,
  };
  if (!id) payload.quantiteStock = parseFloat(fd.get('quantiteStock')) || 0;
  try {
    if (id) await apiPut(`/api/ingredients/${id}`, payload);
    else await apiPost('/api/ingredients', payload);
    document.getElementById('modalIngredient').classList.remove('open');
    toast('Ingrédient enregistré', 'success');
    chargerIngredients();
  } catch (err) { toast(err.message, 'error'); }
}

// ---------------- COMMANDES ----------------
async function chargerCommandes() {
  const statut = document.getElementById('filtreStatutCommande').value;
  const orders = await apiGet('/api/orders' + (statut ? `?statut=${statut}` : ''));
  const badgeClasses = { NOUVELLE: 'badge--wait', EN_PREPARATION: 'badge--wait', PRETE: 'badge--ok', TERMINEE: 'badge--ok', ANNULEE: 'badge--out', CONFIRMEE: 'badge--wait' };
  document.getElementById('tblCommandes').innerHTML = orders.map((o) => `
    <tr>
      <td>#${o.numero}</td><td>${o.type}</td>
      <td>${o.table ? 'Table ' + escapeHtml(o.table) : escapeHtml(o.clientNom || '-')}</td>
      <td>${formatMontant(o.total)}</td>
      <td><span class="badge ${badgeClasses[o.statut] || ''}">${o.statut}</span></td>
      <td>${formatHeure(dateISO(o.dateCreation))}</td>
      <td>
        <button class="btn btn--sm btn--ghost" data-voir="${o.id}">Voir</button>
        ${!o.envoiCuisine ? `<button class="btn btn--sm" data-envoyer="${o.id}">Envoyer en cuisine</button>` : ''}
        ${(USER.role !== 'serveur') ? `<button class="btn btn--sm btn--danger" data-suppr-cmd="${o.id}">Suppr.</button>` : ''}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7">Aucune commande</td></tr>';

  document.querySelectorAll('[data-voir]').forEach((b) => b.addEventListener('click', () => voirCommande(orders.find((o) => o.id === b.dataset.voir))));
  document.querySelectorAll('[data-envoyer]').forEach((b) => b.addEventListener('click', async () => {
    try { await apiPost(`/api/orders/${b.dataset.envoyer}/envoyer-cuisine`); toast('Commande envoyée en cuisine', 'success'); chargerCommandes(); }
    catch (err) { toast(err.message, 'error'); }
  }));
  document.querySelectorAll('[data-suppr-cmd]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement cette commande ?')) return;
    try { await apiDelete(`/api/orders/${b.dataset.supprCmd}`); chargerCommandes(); }
    catch (err) { toast(err.message, 'error'); }
  }));
}

function voirCommande(o) {
  document.getElementById('detailCommandeContenu').innerHTML = `
    <h3 style="font-family:var(--font-body); color:var(--paper);">Commande #${o.numero}</h3>
    <p style="color:var(--text-dim);">${o.type} · ${o.table ? 'Table ' + o.table : ''} · ${new Date(dateISO(o.dateCreation)).toLocaleString('fr-FR')}</p>
    <table><thead><tr><th>Article</th><th>Qté</th><th>Prix</th></tr></thead><tbody>
      ${o.items.map((it) => `<tr><td>${it.nom}${it.options.length ? ' <small>(' + it.options.join(', ') + ')</small>' : ''}</td><td>${it.quantite}</td><td>${formatMontant(it.prix * it.quantite)}</td></tr>`).join('')}
    </tbody></table>
    <p style="text-align:right; font-weight:700; color:var(--paper); margin-top:0.6rem;">Total : ${formatMontant(o.total)}</p>
    ${o.notesGenerales ? `<p><strong>Note :</strong> ${o.notes}</p>` : ''}
  `;
  document.getElementById('modalCommandeDetail').classList.add('open');
}

// ---------------- RÉSERVATIONS ----------------
async function chargerReservations() {
  const reservations = await apiGet('/api/reservations');
  document.getElementById('tblReservations').innerHTML = reservations.map((r) => `
    <tr>
      <td>${r.nom}</td><td>${r.tel}</td><td>${r.date}</td><td>${r.heure}</td><td>${r.personnes}</td>
      <td><span class="badge badge--wait">${r.statut}</span></td>
      <td>
        <button class="btn btn--sm btn--success" data-conf="${r.id}">Confirmer</button>
        <button class="btn btn--sm btn--danger" data-annule="${r.id}">Annuler</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7">Aucune réservation</td></tr>';
  document.querySelectorAll('[data-conf]').forEach((b) => b.addEventListener('click', async () => { await apiPatch(`/api/reservations/${b.dataset.conf}`, { statut: 'CONFIRMEE' }); chargerReservations(); }));
  document.querySelectorAll('[data-annule]').forEach((b) => b.addEventListener('click', async () => { await apiPatch(`/api/reservations/${b.dataset.annule}`, { statut: 'ANNULEE' }); chargerReservations(); }));
}

// ---------------- UTILISATEURS ----------------
async function chargerUtilisateurs() {
  try {
    USERS_CACHE = await apiGet('/api/users');

    const users = USERS_CACHE;

    document.getElementById('tblUtilisateurs').innerHTML = users.map((u) => `
      <tr>
        <td>${escapeHtml(u.nom)}</td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${u.actif
        ? '<span class="badge badge--ok">Oui</span>'
        : '<span class="badge badge--out">Non</span>'}</td>
        <td>
          <button type="button" class="btn btn--sm btn--ghost"
            data-edit-user="${u.id}">Modifier</button>
          <button type="button" class="btn btn--sm btn--danger"
            data-del-user="${u.id}">Suppr.</button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('[data-edit-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const utilisateur = USERS_CACHE.find(
            (u) => String(u.id) === btn.dataset.editUser
        );

        if (utilisateur) ouvrirModaleUtilisateur(utilisateur);
      });
    });

    document.querySelectorAll('[data-del-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cet utilisateur ?')) return;

        try {
          await apiDelete(`/api/users/${btn.dataset.delUser}`);
          await chargerUtilisateurs();
          toast('Utilisateur supprimé', 'success');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    console.error('Erreur chargement utilisateurs :', err);
    toast(err.message, 'error');
  }
}

function ouvrirModaleUtilisateur(u) {
  const form = document.getElementById('formUtilisateur');
  form.reset();
  form.elements['id'].value = u ? u.id : '';
  form.elements['nom'].value = u ? u.nom : '';
  form.elements['username'].value = u ? u.username : '';
  form.elements['username'].readOnly = !!u;
  form.elements['role'].value = u ? u.role : 'serveur';
  document.getElementById('hintMdp').textContent = u ? '(laisser vide pour ne pas changer)' : '';
  document.getElementById('modalUtilisateur').classList.add('open');
}

async function enregistrerUtilisateur(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const payload = { nom: fd.get('nom'), username: fd.get('username'), role: fd.get('role') };
  if (fd.get('password')) payload.password = fd.get('password');
  try {
    if (id) await apiPut(`/api/users/${id}`, payload);
    else {
      if (!payload.password) return toast('Mot de passe requis pour un nouvel utilisateur', 'error');
      await apiPost('/api/users', payload);
    }
    document.getElementById('modalUtilisateur').classList.remove('open');
    chargerUtilisateurs();
    toast('Utilisateur enregistré', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ---------------- HISTORIQUE ----------------
async function chargerHistorique() {
  const logs = await apiGet('/api/dashboard/logs');
  document.getElementById('tblHistorique').innerHTML = logs.map((l) => `
    <tr>
      <td>${new Date(l.date).toLocaleString('fr-FR')}</td>
      <td>${l.orderNumero ? '#' + l.orderNumero : '-'}</td>
      <td>${l.utilisateur}</td><td>${l.role}</td><td>${l.action}</td>
      <td>${l.champ || ''} ${l.ancienneValeur ? '· ' + l.ancienneValeur + ' → ' + l.nouvelleValeur : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="6">Aucune entrée</td></tr>';
}

/* ==========================================================
   PLANNING RÉEL — LE BON REFUGE
   Calendrier mensuel et heures de présence
   ========================================================== */

const planningState = {
  date: new Date(),
  users: [],
  sessions: [],
  loading: false
};


/**
 * Retrouve un utilisateur à partir de l'identifiant d'une session.
 * Les informations proviennent de planningState.users.
 */
function trouverUtilisateurSession(session) {
    const userId = session.user_id;

    const utilisateur = planningState.users.find(user => {
        const idUtilisateur = user.id ?? user.user_id;

        return String(idUtilisateur) === String(userId);
    });

    return {
        utilisateur,
        nom: utilisateur?.nom
            || utilisateur?.name
            || utilisateur?.username
            || utilisateur?.login
            || session.nom_utilisateur
            || session.identifiant_utilisateur
            || `Utilisateur ${userId ?? "inconnu"}`
};
}

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre",
  "Novembre", "Décembre"
];

const JOURS_FR = [
  "Lundi", "Mardi", "Mercredi", "Jeudi",
  "Vendredi", "Samedi", "Dimanche"
];

/**
 * Formate une durée en heures et minutes.
 */
function formaterDuree(minutes) {
  const heures = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  return `${heures} h ${String(mins).padStart(2, "0")} min`;
}

/**
 * Convertit une date en YYYY-MM-DD.
 */
function datePlanningISO(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
}

/**
 * Affiche une heure locale.
 */
function formaterHeure(dateString) {
  if (!dateString) return "En cours";

  const date = new Date(dateString.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return "Non disponible";
  }

  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Échappe les valeurs avant insertion dans le HTML.
 */
function echapperHTML(valeur) {
  return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caractere]);
}

/**
 * Calcule la durée d'une session en minutes.
 */
function dureeSession(session) {
  const debut = new Date(
      String(session.login_at).replace(" ", "T")
  );

  const fin = session.logout_at
      ? new Date(String(session.logout_at).replace(" ", "T"))
      : new Date();

  if (
      Number.isNaN(debut.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      fin < debut
  ) {
    return 0;
  }

  return Math.floor((fin - debut) / 60000);
}

/**
 * Retourne toutes les sessions d'un utilisateur pour un jour donné.
 */

function sessionsDuJour(userId, jour) {
  return planningState.sessions.filter(session => {
    if (String(session.user_id) !== String(userId)) {
      return false;
    }

    const debut = String(session.login_at || "").slice(0, 10);
    const fin = session.logout_at
      ? String(session.logout_at).slice(0, 10)
      : datePlanningISO(new Date());

    // La session doit chevaucher le jour sélectionné.
    return debut <= jour && fin >= jour;
  });
}


/**
 * Charge les données depuis le serveur.
 *
 * Les deux routes doivent être accessibles à l'administrateur.
 */
async function chargerDonneesPlanning() {
  if (planningState.loading) return;

  planningState.loading = true;

  const conteneur = document.getElementById("contenuPlanning");

  if (conteneur) {
    conteneur.innerHTML = "<p>Chargement du planning…</p>";
  }

  try {
    const annee = planningState.date.getFullYear();
    const mois = String(
        planningState.date.getMonth() + 1
    ).padStart(2, "0");

    const [reponseUsers, reponseSessions] = await Promise.all([
      apiGet("/api/users"),
      apiGet(`/api/admin/sessions?month=${annee}-${mois}`)
    ]);

    /*
     * Adapte ces deux affectations à la structure exacte
     * des objets renvoyés par ton backend.
     */
    planningState.users = Array.isArray(reponseUsers)
        ? reponseUsers
        : reponseUsers.users || [];

    planningState.sessions = Array.isArray(reponseSessions)
        ? reponseSessions
        : reponseSessions.sessions || [];

    console.log("Utilisateurs chargés :", planningState.users);
    console.log("Sessions chargées :", planningState.sessions);

    console.log(
        "Correspondance utilisateurs / sessions :",
        planningState.users.map(user => ({
          id: user.id ?? user.user_id,
          nom: user.nom ?? user.name ?? user.username,
          sessions: planningState.sessions.filter(
              session =>
                  String(session.user_id) ===
                  String(user.id ?? user.user_id)
          )
        }))
    );

    afficherCalendrierPlanning();

  } catch (erreur) {
    console.error("Erreur de chargement du planning :", erreur);

    if (conteneur) {
      conteneur.innerHTML = `
                <div class="planning-erreur">
                    <strong>Impossible de charger le planning.</strong>
                    <p>Vérifie les routes API et les droits administrateur.</p>
                </div>
            `;
    }
  } finally {
    planningState.loading = false;
  }
}

/**
 * Affiche le calendrier complet du mois.
 */
function afficherCalendrierPlanning() {
  const conteneur = document.getElementById("contenuPlanning");

  if (!conteneur) return;

  const date = planningState.date;
  const annee = date.getFullYear();
  const mois = date.getMonth();

  const premierJour = new Date(annee, mois, 1);
  const nombreJours = new Date(annee, mois + 1, 0).getDate();

  // JavaScript : dimanche = 0.
  // Calendrier français : lundi = première colonne.
  const decalage = (premierJour.getDay() + 6) % 7;

  const aujourdHui = datePlanningISO(new Date());

  const utilisateurs = planningState.users.filter(user => {
    return user.active !== false && user.deleted_at == null;
  });

  let html = `
        <section class="planning-calendrier">
            <header class="planning-entete">
                <button type="button"
                        class="planning-navigation"
                        id="planningMoisPrecedent"
                        aria-label="Mois précédent">
                    ←
                </button>

                <h3>
                    ${MOIS_FR[mois]} ${annee}
                </h3>

                <button type="button"
                        class="planning-navigation"
                        id="planningMoisSuivant"
                        aria-label="Mois suivant">
                    →
                </button>

                <button type="button"
                        class="planning-aujourdhui"
                        id="planningAujourdhui">
                    Aujourd'hui
                </button>
            </header>

            <div class="planning-legende">
                <span>🟢 Session terminée</span>
                <span>🟠 Connexion en cours</span>
                <span>⚪ Aucune session</span>
            </div>

            <div class="planning-grille">
    `;

  // En-têtes des jours de la semaine.
  for (const jour of JOURS_FR) {
    html += `
            <div class="planning-jour-entete">
                ${jour}
            </div>
        `;
  }

  // Cases vides avant le premier jour du mois.
  for (let i = 0; i < decalage; i++) {
    html += `
            <div class="planning-case planning-case-vide"
                 aria-hidden="true"></div>
        `;
  }

  // Toutes les dates du mois.
  for (let numeroJour = 1; numeroJour <= nombreJours; numeroJour++) {
    const dateCourante = new Date(annee, mois, numeroJour);
    const jourISO = datePlanningISO(dateCourante);

    const estAujourdhui = jourISO === aujourdHui;

    html += `
    <div class="planning-case ${estAujourdhui ? "planning-aujourdhui-case" : ""}"
         data-planning-jour="${jourISO}"
         tabindex="0"
         role="button"
         aria-label="Consulter les sessions du ${numeroJour}/${mois + 1}/${annee}">
                <div class="planning-numero-jour">
                    ${numeroJour}
                </div>
                <div class="planning-sessions">
        `;


// Afficher directement les sessions du jour.
// Ne pas dépendre des identifiants provenant de /api/users.
const sessionsDuCalendrier = planningState.sessions.filter(session => {
    const debut = String(session.login_at || "").slice(0, 10);
    const fin = session.logout_at
        ? String(session.logout_at).slice(0, 10)
        : datePlanningISO(new Date());

    return debut <= jourISO && fin >= jourISO;
});

for (const session of sessionsDuCalendrier) {
    const minutes = dureeSession(session);
    const estEnCours = !session.logout_at;


const { nom: nomSession } = trouverUtilisateurSession(session);


    const tooltip = [
        nomSession,
        `Connexion : ${formaterHeure(session.login_at)}`,
        `Déconnexion : ${formaterHeure(session.logout_at)}`,
        `Durée : ${formaterDuree(minutes)}`
    ].join("\n");

    html += `
    <div class="planning-session ${
    estEnCours
        ? "planning-session-active"
        : "planning-session-terminee"
  }"
  title="${echapperHTML(tooltip)}"
  aria-label="${echapperHTML(tooltip)}">

      <span class="planning-session-nom">
      ${echapperHTML(nomSession)}
</span>

  <span class="planning-session-duree">
                ${formaterDuree(minutes)}
            </span>

</div>
  `;
}


    html += `
                </div>
            </div>
        `;
  }


  for (const user of utilisateurs) {
    const idUtilisateur = user.id ?? user.user_id;

    const debutMois = `${annee}-${String(mois + 1).padStart(2, "0")}-01`;


const sessionsUtilisateur = planningState.sessions.filter(session => {
    return (
        String(session.user_id) === String(idUtilisateur)
        && String(session.login_at || "").slice(0, 7)
            === `${annee}-${String(mois + 1).padStart(2, "0")}`
    );
});


    const totalMinutes = sessionsUtilisateur.reduce((total, session) => {
      return total + dureeSession(session);
    }, 0);

    const nomUtilisateur =
        user.name ??
        user.nom ??
        user.username ??
        user.login ??
        `Utilisateur ${idUtilisateur}`;

    html += `
            <tr>
                <td>${echapperHTML(nomUtilisateur)}</td>
                <td>${sessionsUtilisateur.length}</td>
                <td>${formaterDuree(totalMinutes)}</td>
            </tr>
        `;
  }

  html += `
                    </tbody>
                </table>
            </div>
            <p class="planning-note">
                Les sessions sans heure de déconnexion sont calculées
                jusqu'à l'heure actuelle.
            </p>
        </section>
    `;

  conteneur.innerHTML = html;

  document.getElementById("planningMoisPrecedent")
      ?.addEventListener("click", () => {
        planningState.date = new Date(annee, mois - 1, 1);
        chargerDonneesPlanning();
      });

  document.getElementById("planningMoisSuivant")
      ?.addEventListener("click", () => {
        planningState.date = new Date(annee, mois + 1, 1);
        chargerDonneesPlanning();
      });

  document.getElementById("planningAujourdhui")
      ?.addEventListener("click", () => {
        planningState.date = new Date();
        chargerDonneesPlanning();
      });

  // Rendre chaque journée interactive.
  document.querySelectorAll("#contenuPlanning [data-planning-jour]")
      .forEach((caseJour) => {
        const ouvrir = () => afficherDetailsJour(caseJour.dataset.planningJour);

        caseJour.addEventListener("click", ouvrir);

        caseJour.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            ouvrir();
          }
        });
      });

}

function afficherDetailsJour(jourISO) {
  const date = new Date(`${jourISO}T12:00:00`);

  const sessionsJour = planningState.sessions.filter((session) => {
    const debut = String(session.login_at || "").slice(0, 10);
    const fin = String(session.logout_at || "").slice(0, 10);

    // Inclure une session qui chevauche la journée sélectionnée.
    return debut <= jourISO && (!session.logout_at || fin >= jourISO);
  });

    const nomsUtilisateurs = new Map(
      planningState.users.map((user) => [
        String(user.id ?? user.user_id),
        user.nom || user.username || user.name || "Utilisateur"
      ])
    );

    const lignes = sessionsJour.map((session) => {
      const { nom } = trouverUtilisateurSession(session);

      const debut = formaterHeure(session.login_at);

      const fin = session.logout_at
        ? formaterHeure(session.logout_at)
        : "En cours";

      const minutes = dureeSession(session);

      return `
      <tr>
      <td>${echapperHTML(nom)}</td>
      <td>${echapperHTML(debut)}</td>
      <td>${echapperHTML(fin)}</td>
      <td>${formaterDuree(minutes)}</td>
    </tr>
      `;
    }).join("");


  const ancien = document.getElementById("modalDetailsPlanning");
  if (ancien) ancien.remove();

  const modal = document.createElement("div");
  modal.id = "modalDetailsPlanning";
  modal.className = "modal-overlay open";

  modal.innerHTML = `
<section class="modal" role="dialog" aria-modal="true"
aria-labelledby="titreDetailsPlanning">
    <button type="button" class="modal-close"
aria-label="Fermer">&times;</button>

<h3 id="titreDetailsPlanning">
  Sessions du ${date.toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
})}
</h3>

${
  sessionsJour.length
      ? `
            <div class="planning-table-wrapper">
              <table class="planning-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Connexion</th>
                    <th>Déconnexion</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>${lignes}</tbody>
              </table>
            </div>
          `
      : `<p>Aucune session enregistrée pour cette journée.</p>`
}
</section>
`;

  document.body.appendChild(modal);

  modal.querySelector(".modal-close").addEventListener("click", () => {
    modal.remove();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  modal.querySelector(".modal").addEventListener("keydown", (event) => {
    if (event.key === "Escape") modal.remove();
  });
}


init();
