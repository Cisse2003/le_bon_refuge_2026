/**
 * LE BON REFUGE - site.js
 * Gestion de la carte, du panier, des réservations et des commandes
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialisation de l'application
  await chargerDonneesEtContact();
  initialiserPanier();
  initialiserFormulaires();
  initialiserModales();
});

/* ==========================================================================
   1. GESTION DES DONNÉES & CONTACT (API)
   ========================================================================== */

let MENU_DATA = [];

async function chargerDonneesEtContact() {
  try {
    // Récupération des infos du restaurant (téléphone, réseaux, etc.)
    if (typeof API !== 'undefined' && API.getContact) {
      const contact = await API.getContact();
      injecterInfosContact(contact);
    }

    // Récupération du menu
    if (typeof API !== 'undefined' && API.getMenu) {
      MENU_DATA = await API.getMenu();
    } else {
      // Fallback de sécurité si l'API n'est pas encore connectée
      MENU_DATA = getMenuFallback();
    }

    afficherMenu(MENU_DATA);
    afficherPlatsPopulaires(MENU_DATA);
    remplirParfumsGateau(MENU_DATA);

  } catch (err) {
    console.error('Erreur lors du chargement des données :', err);
  }
}

function injecterInfosContact(contact) {
  if (!contact) return;

  const phone = contact.telephone || '+224 00 00 00 00';
  const whatsapp = contact.whatsapp || 'https://wa.me/';

  // Téléphones
  const txtTel = document.getElementById('texteTelephoneContact');
  if (txtTel) txtTel.textContent = phone;

  const lienAppelHero = document.getElementById('lienAppelHero');
  if (lienAppelHero) lienAppelHero.href = `tel:${phone.replace(/\s+/g, '')}`;

  const lienAppelContact = document.getElementById('lienAppelContact');
  if (lienAppelContact) lienAppelContact.href = `tel:${phone.replace(/\s+/g, '')}`;

  // WhatsApp
  const wsLinks = ['lienWhatsappHero', 'lienWhatsappReservation', 'lienWhatsappContact'];
  wsLinks.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = whatsapp;
  });

  // Réseaux sociaux
  const tt = document.getElementById('lienTiktokContact');
  if (tt && contact.tiktok) tt.href = contact.tiktok;

  const fb = document.getElementById('lienFacebookContact');
  if (fb && contact.facebook) fb.href = contact.facebook;
}

/* ==========================================================================
   2. RENDU DU MENU ET POPULAIRES
   ========================================================================== */

function afficherMenu(menu) {
  const tabsContainer = document.getElementById('tabsCategories');
  const grilleContainer = document.getElementById('grilleMenu');
  if (!tabsContainer || !grilleContainer) return;

  // Extraire les catégories uniques
  const categories = ['Tous', ...new Set(menu.map(item => item.categorie))];

  // Onglets
  tabsContainer.innerHTML = categories.map((cat, index) => `
    <button class="tab-btn ${index === 0 ? 'active' : ''}" data-cat="${escapeHtml(cat)}">
      ${escapeHtml(cat)}
    </button>
  `).join('');

  // Rendu de la grille
  rendreGrilleMenu(menu, 'Tous');

  // Événements sur les onglets
  tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rendreGrilleMenu(menu, btn.dataset.cat);
    });
  });
}

function rendreGrilleMenu(menu, categorie) {
  const grilleContainer = document.getElementById('grilleMenu');
  if (!grilleContainer) return;

  const itemsFiltrés = categorie === 'Tous'
      ? menu
      : menu.filter(i => i.categorie === categorie);

  grilleContainer.innerHTML = itemsFiltrés.map(item => `
    <div class="card card-menu">
      ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.nom)}" style="width:100%; height:160px; object-fit:cover; border-radius:8px; margin-bottom:0.8rem;">` : ''}
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.4rem;">
        <h4 style="margin:0;">${escapeHtml(item.nom)}</h4>
        <span class="badge-prix">${formatMontant(item.prix)}</span>
      </div>
      <p style="font-size:0.85rem; color:var(--paper-muted); margin-bottom:1rem; flex-grow:1;">${escapeHtml(item.description || '')}</p>
      <button class="btn btn--sm btn--block btn-ajouter-panier" data-id="${item.id}">
        + Ajouter au panier
      </button>
    </div>
  `).join('');

  // Événements d'ajout au panier
  grilleContainer.querySelectorAll('.btn-ajouter-panier').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = MENU_DATA.find(i => String(i.id) === String(id));
      if (item) Panier.ajouter(item);
    });
  });
}

function afficherPlatsPopulaires(menu) {
  const container = document.getElementById('platsPopulaires');
  if (!container) return;

  const populaires = menu.filter(i => i.populaire).slice(0, 3);
  container.innerHTML = populaires.map(p => `
    <div class="ticket-row">
      <span>${escapeHtml(p.nom)}</span>
      <span>${formatMontant(p.prix)}</span>
    </div>
  `).join('');
}

function remplirParfumsGateau(menu) {
  const select = document.getElementById('selectParfumGateau');
  if (!select) return;

  const parfums = ['Chocolat', 'Vaniille', 'Fraise', 'Forêt Noire', 'Red Velvet', 'Pistache', 'Fruits Rouges'];
  select.innerHTML = parfums.map(p => `<option value="${p}">${p}</option>`).join('');
}

/* ==========================================================================
   3. MODULE PANIER (State & Drawer)
   ========================================================================== */

const Panier = {
  items: [],

  ajouter(produit) {
    const existant = this.items.find(i => String(i.id) === String(produit.id));
    if (existant) {
      existant.quantite += 1;
    } else {
      this.items.push({
        id: produit.id,
        nom: produit.nom,
        prix: produit.prix,
        quantite: 1
      });
    }
    this.mettreAJour();
    this.ouvrirDrawer();
  },

  modifierQuantite(id, delta) {
    const item = this.items.find(i => String(i.id) === String(id));
    if (!item) return;

    item.quantite += delta;
    if (item.quantite <= 0) {
      this.items = this.items.filter(i => String(i.id) !== String(id));
    }
    this.mettreAJour();
  },

  vider() {
    this.items = [];
    this.mettreAJour();
  },

  getTotal() {
    return this.items.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
  },

  getItems() {
    return this.items;
  },

  mettreAJour() {
    // Badge
    const badge = document.getElementById('cartBadge');
    const totalCount = this.items.reduce((sum, i) => sum + i.quantite, 0);
    if (badge) {
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'inline-block' : 'none';
    }

    // Contenu du Drawer
    const cartBody = document.getElementById('cartBody');
    const cartTotal = document.getElementById('cartTotal');

    if (cartTotal) cartTotal.textContent = formatMontant(this.getTotal());

    if (cartBody) {
      if (this.items.length === 0) {
        cartBody.innerHTML = '<p style="text-align:center; color:var(--paper-muted); margin-top:2rem;">Votre panier est vide.</p>';
      } else {
        cartBody.innerHTML = this.items.map(item => `
          <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1);">
            <div>
              <div style="font-weight:600; color:var(--paper);">${escapeHtml(item.nom)}</div>
              <div style="font-size:0.85rem; color:var(--paper-muted);">${formatMontant(item.prix)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <button class="btn btn--ghost btn--sm btn-qte" data-id="${item.id}" data-delta="-1">-</button>
              <span style="font-weight:bold; min-width:18px; text-align:center;">${item.quantite}</span>
              <button class="btn btn--ghost btn--sm btn-qte" data-id="${item.id}" data-delta="1">+</button>
            </div>
          </div>
        `).join('');

        cartBody.querySelectorAll('.btn-qte').forEach(btn => {
          btn.addEventListener('click', () => {
            this.modifierQuantite(btn.dataset.id, parseInt(btn.dataset.delta, 10));
          });
        });
      }
    }
  },

  ouvrirDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('overlay');
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('active');
  },

  fermerDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  }
};

function initialiserPanier() {
  const btnOuvrir = document.getElementById('btnOuvrirPanier');
  const btnFermer = document.getElementById('btnFermerPanier');
  const overlay = document.getElementById('overlay');
  const btnCommander = document.getElementById('btnCommander');

  if (btnOuvrir) btnOuvrir.addEventListener('click', () => Panier.ouvrirDrawer());
  if (btnFermer) btnFermer.addEventListener('click', () => Panier.fermerDrawer());
  if (overlay) overlay.addEventListener('click', () => Panier.fermerDrawer());

  if (btnCommander) {
    btnCommander.addEventListener('click', () => {
      if (Panier.getItems().length === 0) {
        alert('Votre panier est vide.');
        return;
      }
      Panier.fermerDrawer();
      ouvrirModal('modalCommande');
    });
  }
}

/* ==========================================================================
   4. FORMULAIRES & LOGIQUE MÉTIER
   ========================================================================== */

function initialiserFormulaires() {
  // A. Type de commande (À emporter / À l'avance)
  const selectType = document.getElementById('selectTypeCommande');
  const champsAvance = document.getElementById('champsAvance');
  if (selectType && champsAvance) {
    selectType.addEventListener('change', () => {
      champsAvance.style.display = selectType.value === 'a_l_avance' ? 'block' : 'none';
    });
  }

  // B. Soumission de la commande finale
  const formCommande = document.getElementById('formCommande');
  if (formCommande) {
    formCommande.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(formCommande);

      const payload = {
        typeService: formData.get('type'),
        nomClient: formData.get('nom'),
        telClient: formData.get('tel'),
        notes: formData.get('notes'),
        items: Panier.getItems(),
        montantTotal: Panier.getTotal()
      };

      if (formData.get('type') === 'a_l_avance') {
        payload.avance = {
          date: formData.get('date'),
          heure: formData.get('heure'),
          personnes: formData.get('personnes')
        };
      }

      try {
        let reponse = {};
        if (typeof API !== 'undefined' && API.creerCommande) {
          reponse = await API.creerCommande(payload);
        } else {
          // Simulation si API non liée
          reponse = { numeroTicket: 'REF-' + Math.floor(1000 + Math.random() * 9000), pdfUrl: '#' };
        }

        fermerModal('modalCommande');
        afficherRecapitulatif(payload, reponse);
        ouvrirModal('modalConfirmation');
        Panier.vider();

      } catch (err) {
        console.error('Erreur lors de la réservation/commande :', err);
        alert('Une erreur est survenue lors de la validation de votre commande.');
      }
    });
  }

  // C. Soumission Réservation de Table
  const formReservation = document.getElementById('formReservation');
  if (formReservation) {
    formReservation.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(formReservation);
      const payload = Object.fromEntries(formData.entries());

      try {
        if (typeof API !== 'undefined' && API.creerReservation) {
          await API.creerReservation(payload);
        }
        alert('Votre demande de réservation a été envoyée ! Nous vous contacterons pour confirmer.');
        formReservation.reset();
      } catch (err) {
        alert('Erreur lors de l\'envoi de la réservation.');
      }
    });
  }

  // D. Soumission Gâteau Personnalisé
  const btnCommanderGateau = document.getElementById('btnCommanderGateau');
  if (btnCommanderGateau) {
    btnCommanderGateau.addEventListener('click', () => ouvrirModal('modalGateau'));
  }

  const formGateau = document.getElementById('formGateau');
  if (formGateau) {
    formGateau.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formGateau);

      const itemGateau = {
        id: 'gateau-' + Date.now(),
        nom: `Gâteau ${formData.get('taille')} (${formData.get('parfum')})`,
        prix: 150000, // Prix estimé/base
        quantite: 1
      };

      Panier.ajouter(itemGateau);
      fermerModal('modalGateau');
      formGateau.reset();
    });
  }
}

/* ==========================================================================
   5. RÉCAPITULATIF ET CONFIRMATION
   ========================================================================== */

function afficherRecapitulatif(commande, reponseApi) {
  const typeLabels = {
    a_emporter: 'À emporter',
    a_l_avance: 'Commande à l\'avance'
  };

  const dataApi = reponseApi || {};
  const items = commande.items || [];

  const lignes = items.map((it) => `
    <div class="ticket-row">
      <span>${it.quantite}× ${escapeHtml(it.nom)}</span>
      <span>${formatMontant(it.prix * it.quantite)}</span>
    </div>
  `).join('');

  const ticketContainer = document.getElementById('ticketConfirmation');
  if (ticketContainer) {
    ticketContainer.innerHTML = `
      <h4>Ticket #${escapeHtml(dataApi.numeroTicket || dataApi.commandeId || 'EN-COURS')}</h4>
      <p style="text-align:center; font-size:0.85rem; margin-bottom:0.5rem; color:#8a8168;">
        Statut : En attente de validation
      </p>
      <div class="ticket-row">
        <span>Type</span>
        <span>${typeLabels[commande.typeService] || commande.typeService}</span>
      </div>
      ${commande.avance ? `
        <div class="ticket-row">
          <span>Retrait</span>
          <span>${escapeHtml(commande.avance.date || '')} ${escapeHtml(commande.avance.heure || '')}</span>
        </div>
      ` : ''}
      <div class="ticket-row">
        <span>Client</span>
        <span>${escapeHtml(commande.nomClient || '')} (${escapeHtml(commande.telClient || '')})</span>
      </div>
      <div class="ticket-sep"></div>
      ${lignes}
      <div class="ticket-sep"></div>
      <div class="ticket-total">
        <span>Total</span>
        <span>${formatMontant(commande.montantTotal || 0)}</span>
      </div>
    `;
  }

  // Gestion du bouton de téléchargement du PDF
  const btnPdf = document.getElementById('btnTelechargerPdf');
  if (btnPdf) {
    const hasValidPdf = dataApi && dataApi.pdfUrl && dataApi.pdfUrl !== '#';

    if (hasValidPdf) {
      if ('href' in btnPdf) {
        btnPdf.href = dataApi.pdfUrl;
      } else {
        btnPdf.setAttribute('data-href', dataApi.pdfUrl);
      }
      btnPdf.style.display = 'inline-block';
    } else {
      btnPdf.style.display = 'none';
    }
  }
}

/* ==========================================================================
   6. GESTION DES MODALES
   ========================================================================== */

function ouvrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function fermerModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function initialiserModales() {
  // Gestion de la fermeture sur clic boutons ou overlay
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

/* ==========================================================================
   7. UTILITAIRES & FALLBACKS
   ========================================================================== */

function formatMontant(montant) {
  return new Intl.NumberFormat('fr-FR').format(montant) + ' FG';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}

function getMenuFallback() {
  return [
    { id: 1, nom: 'Tacos XL Poulet Tikka', categorie: 'Tacos', prix: 45000, description: 'Sauce fromagère maison, frites incluses.', populaire: true },
    { id: 2, nom: 'Burger Le Refuge', categorie: 'Burgers', prix: 50000, description: 'Double steak 100g, cheddar fondu, oignons caramélisés.', populaire: true },
    { id: 3, nom: 'Pizza Reine', categorie: 'Pizzas', prix: 65000, description: 'Base tomate, mozzarella, jambon, champignons.', populaire: false },
    { id: 4, nom: 'Gaufre Chocolat', categorie: 'Desserts', prix: 20000, description: 'Nappage chocolat gourmand et chantilly.', populaire: true }
  ];
}