/**
 * LE BON REFUGE - site.js
 * Gestion de la carte, du panier, des réservations et des commandes
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Initialisation de l'application

    initialiserPanier();
    initialiserFormulaires();
    initialiserModales();
    chargerDonneesEtContact();
});

/* ==========================================================================
   1. GESTION DES DONNÉES & CONTACT (API)
   ========================================================================== */

let MENU_DATA = [];


/**
 * Retourne le chemin de l'image à partir du nom du plat.
 * Les images sont stockées dans le dossier /images/.
 */
function obtenirPhotoPlat(nom) {
    const correspondances = {
        "caprisun": "caprisun.png",
        "riz gras à la viande": "riz_gras_a_la_viande.png",
        "demi-poulet braisé": "demi_poulet_braise.png",
        "riz gras poulet / poisson": "riz_gras_poulet_poisson.png",
        "gâteau d'anniversaire personnalisé": "gateau_danniversaire_personnalise.png"
    };

    const nomNormalise = String(nom || "")
        .trim()
        .toLocaleLowerCase("fr-FR");

    // Utiliser le nom de fichier défini explicitement lorsqu'il existe.
    if (correspondances[nomNormalise]) {
        return "/images/" + correspondances[nomNormalise];
    }

    // Sinon, générer automatiquement un nom de fichier standard.
    const fichier = nomNormalise
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return fichier ? `/images/${fichier}.png` : "";
}


async function chargerDonneesEtContact() {
    try {
        // Récupération des informations de contact
        if (typeof apiGet === 'function') {
            try {
                const contact = await apiGet('/api/settings/contact');
                injecterInfosContact(contact);
            } catch (err) {
                console.warn('Impossible de charger les contacts :', err);
            }
        }

        // Récupération du menu
        const menu = await apiGet('/api/products');

        if (!Array.isArray(menu)) {
            throw new Error('Le serveur n’a pas renvoyé une liste de plats.');
        }

        // Reconstruire les chemins des images depuis le dossier local /images/.
        MENU_DATA = menu.map(item => ({
            ...item,
            photo: obtenirPhotoPlat(item.nom)
        }));

        afficherMenu(MENU_DATA);
        afficherPlatsPopulaires(MENU_DATA);
        remplirParfumsGateau(MENU_DATA);

        console.log("Menu chargé avec les images locales :", MENU_DATA.length, "plats");
    } catch (err) {
        console.error('Erreur lors du chargement du menu :', err);

        MENU_DATA = getMenuFallback();
        afficherMenu(MENU_DATA);
        afficherPlatsPopulaires(MENU_DATA);
        remplirParfumsGateau(MENU_DATA);
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
  <div class="card product-card">
    ${item.photo ? `<img class="product-photo" src="${escapeHtml(item.photo)}" alt="${escapeHtml(item.nom)}">` : ''}
    <div class="product-title-row">
      <h3>${escapeHtml(item.nom)}</h3>
      <span class="price">${formatMontant(item.prix)}</span>
    </div>
    <p style="font-size:0.88rem; margin:0; flex-grow:1;">${escapeHtml(item.description || '')}</p>
    ${item.disponible === false
      ? '<span class="badge badge--out">Indisponible</span>'
      : `<button class="btn btn--sm btn--block btn-ajouter-panier" data-id="${item.id}">+ Ajouter au panier</button>`}
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

  let populaires = menu.filter(i => i.populaire);
  if (populaires.length === 0) populaires = menu.filter(i => i.disponible !== false);
  populaires = populaires.slice(0, 3);
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
        const existant = this.items.find(i => String(i.productId) === String(produit.id) && !i.personnalisation);
        if (existant) {
            existant.quantite += 1;
        } else {
            this.items.push({
                id: genererIdUnique(),
                productId: produit.id,
                nom: produit.nom,
                prix: Number(produit.prix) || 0,
                quantite: 1,
                poste: produit.poste || 'cuisine',
                options: produit.options || [],
                personnalisation: produit.personnalisation || null
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
            console.log('🛒 Clic sur Passer commande');
            console.log('Articles du panier :', Panier.getItems());

            if (Panier.getItems().length === 0) {
                alert('Votre panier est vide.');
                return;
            }

            const modal = document.getElementById('modalCommande');

            if (!modal) {
                console.error('❌ Modale modalCommande introuvable dans le HTML');
                alert('Erreur : la fenêtre de commande est introuvable.');
                return;
            }

            Panier.fermerDrawer();
            modal.classList.add('active');

            console.log('✅ Modale de commande ouverte');
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
                type: formData.get('type'),
                clientNom: formData.get('nom'),
                clientTel: formData.get('tel'),
                notes: formData.get('notes'),
                items: Panier.getItems(),
                total: Panier.getTotal()
            };

            if (formData.get('type') === 'a_l_avance') {
                payload.avance = {
                    date: formData.get('date'),
                    heure: formData.get('heure'),
                    personnes: formData.get('personnes')
                };
            }

            try {
                const reponse = await apiPost('/api/orders', payload);

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
                await apiPost('/api/reservations', payload);
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
                productId: null,
                nom: `Gâteau ${formData.get('taille')} (${formData.get('parfum')})`,
                prix: 150000,
                quantite: 1,
                poste: 'cuisine',
                options: [],
              personnalisation: {
                taille: formData.get('taille'), parfum: formData.get('parfum'),
                decoration: formData.get('decoration'), texte: formData.get('texte'),
                date: formData.get('date'), heure: formData.get('heure')
              }
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
    const typeLabels = {a_emporter: 'À emporter', a_l_avance: "Commande à l'avance"};
    const dataApi = reponseApi || {};
    const items = commande.items || [];
    const brut = dataApi.numeroTicket || dataApi.numero;
    const numero = brut ? 'LR-' + brut : 'EN-COURS';
    const total = dataApi.total ?? commande.total ?? 0; // le total officiel vient du serveur

    const ticket = document.getElementById('ticketConfirmation');
    if (!ticket) {
        alert('Commande #' + numero + ' enregistrée. Nous vous appelons pour confirmer.');
        return;
    }

    const lignes = items.map((it) => `
    <div class="ticket-row">
      <span>${it.quantite}× ${escapeHtml(it.nom)}</span>
      <span>${formatMontant(it.prix * it.quantite)}</span>
    </div>`).join('');

    ticket.innerHTML = `
    <h4>Ticket #${escapeHtml(String(numero))}</h4>
    <p style="text-align:center; font-size:0.85rem; margin-bottom:0.5rem; color:#8a8168;">
      Statut : en attente de confirmation
    </p>
    <div class="ticket-row"><span>Type</span><span>${typeLabels[commande.type] || commande.type || ''}</span></div>
    ${commande.avance ? `<div class="ticket-row"><span>Retrait</span><span>${escapeHtml(commande.avance.date || '')} ${escapeHtml(commande.avance.heure || '')}</span></div>` : ''}
    <div class="ticket-row"><span>Client</span><span>${escapeHtml(commande.clientNom || '')} (${escapeHtml(commande.clientTel || '')})</span></div>
    <div class="ticket-sep"></div>
    ${lignes}
    <div class="ticket-sep"></div>
    <div class="ticket-total"><span>Total</span><span>${formatMontant(total)}</span></div>
  `;

    const btnPdf = document.getElementById('btnTelechargerPdf');
    if (btnPdf) {
        const ok = dataApi.pdfUrl && dataApi.pdfUrl !== '#';
        if (ok) btnPdf.href = dataApi.pdfUrl;
        btnPdf.style.display = ok ? 'inline-flex' : 'none';
    }
}

/**
 * Échappe les caractères HTML pour éviter d'injecter
 * du contenu non fiable dans le récapitulatif.
 */
function echapperHTML(valeur) {
    return String(valeur ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caractere]);
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

function genererIdUnique() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return 'item-' +
        Date.now() +
        '-' +
        Math.random().toString(36).substring(2, 10);
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
        // Plats Chauds
        {
            id: 1,
            nom: 'Riz gras poulet / poisson',
            categorie: 'Plats Chauds',
            prix: 25000,
            description: 'Servi chaud, recette maison.',
            populaire: true
        },
        {
            id: 2,
            nom: 'Riz gras à la viande',
            categorie: 'Plats Chauds',
            prix: 30000,
            description: 'Riz gras savoureux accompagné de viande.',
            populaire: false
        },
        {
            id: 3,
            nom: 'Garba poulet / poisson',
            categorie: 'Plats Chauds',
            prix: 50000,
            description: 'Plat traditionnel généreux.',
            populaire: true
        },
        {
            id: 4,
            nom: 'Petit pois au poulet',
            categorie: 'Plats Chauds',
            prix: 40000,
            description: 'Servi avec morceau de poulet.',
            populaire: false
        },
        {
            id: 5,
            nom: 'Petit pois à la viande',
            categorie: 'Plats Chauds',
            prix: 45000,
            description: 'Servi avec viande tendre.',
            populaire: false
        },
        {
            id: 6,
            nom: 'Spaghetti au poulet',
            categorie: 'Plats Chauds',
            prix: 20000,
            description: 'Pâtes sautées avec poulet.',
            populaire: false
        },
        {
            id: 7,
            nom: 'Spaghetti bolognaise',
            categorie: 'Plats Chauds',
            prix: 25000,
            description: 'Pâtes avec sauce bolognaise maison.',
            populaire: false
        },

        // Poulet Braisé
        {
            id: 8,
            nom: 'Demi-poulet braisé (+ frites ou alloco)',
            categorie: 'Poulet Braisé',
            prix: 55000,
            description: 'Accompagné au choix de frites ou alloco.',
            populaire: true
        },
        {
            id: 9,
            nom: 'Poulet entier braisé (+ frites ou alloco)',
            categorie: 'Poulet Braisé',
            prix: 110000,
            description: 'Accompagné au choix de frites ou alloco.',
            populaire: true
        },

        // Fast-Food
        {
            id: 10,
            nom: 'Burger viande (+ frites)',
            categorie: 'Fast-Food',
            prix: 55000,
            description: 'Burger à la viande servi avec portion de frites.',
            populaire: true
        },
        {
            id: 11,
            nom: 'Shawarma à la viande',
            categorie: 'Fast-Food',
            prix: 30000,
            description: 'Shawarma garni de viande assaisonnée.',
            populaire: false
        },
        {
            id: 12,
            nom: 'Tacos poulet',
            categorie: 'Fast-Food',
            prix: 65000,
            description: 'Garni de poulet et frites.',
            populaire: true
        },
        {
            id: 13,
            nom: 'Tacos viande hachée',
            categorie: 'Fast-Food',
            prix: 75000,
            description: 'Garni de viande hachée et frites.',
            populaire: false
        },

        // Fataya
        {
            id: 14,
            nom: 'Fataya poulet',
            categorie: 'Fast-Food',
            prix: 20000,
            description: 'Chaussons farcis au poulet.',
            populaire: false
        },
        {
            id: 15,
            nom: 'Fataya viande',
            categorie: 'Fast-Food',
            prix: 25000,
            description: 'Chaussons farcis à la viande.',
            populaire: false
        },

        // Pizzas
        {
            id: 16,
            nom: 'Pizza Margherita',
            categorie: 'Pizzas',
            prix: 70000,
            description: 'Base tomate et fromage.',
            populaire: false
        },
        {
            id: 17,
            nom: 'Pizza Poulet',
            categorie: 'Pizzas',
            prix: 90000,
            description: 'Base garnie de poulet et fromage.',
            populaire: true
        },
        {
            id: 18,
            nom: 'Pizza Viande',
            categorie: 'Pizzas',
            prix: 95000,
            description: 'Base garnie de viande hachée et fromage.',
            populaire: false
        },
        {
            id: 19,
            nom: 'Pizza Thongwenmo',
            categorie: 'Pizzas',
            prix: 100000,
            description: 'Spécialité garnie de la maison.',
            populaire: false
        },

        // Crèmerie & Desserts
        {
            id: 20,
            nom: 'Glace (petit format)',
            categorie: 'Crèmerie',
            prix: 5000,
            description: 'Glace rafraîchissante petit format.',
            populaire: false
        },
        {
            id: 21,
            nom: 'Glace (grand format)',
            categorie: 'Crèmerie',
            prix: 10000,
            description: 'Glace rafraîchissante grand format.',
            populaire: false
        },

        // Boissons
        {id: 22, nom: 'Boisson XL', categorie: 'Boissons', prix: 10000, description: 'Format XL.', populaire: false},
        {
            id: 23,
            nom: 'Fanta',
            categorie: 'Boissons',
            prix: 10000,
            description: 'Cannette / Bouteille.',
            populaire: false
        },
        {
            id: 24,
            nom: 'Coca-Cola',
            categorie: 'Boissons',
            prix: 10000,
            description: 'Cannette / Bouteille.',
            populaire: true
        },
        {
            id: 25,
            nom: 'Sagiko',
            categorie: 'Boissons',
            prix: 10000,
            description: 'Boisson aux fruits.',
            populaire: false
        },
        {id: 26, nom: 'Fruitalos', categorie: 'Boissons', prix: 9000, description: 'Jus de fruits.', populaire: false},
        {
            id: 27,
            nom: 'Comando',
            categorie: 'Boissons',
            prix: 11000,
            description: 'Boisson énergisante.',
            populaire: false
        },
        {
            id: 28,
            nom: 'Vimto',
            categorie: 'Boissons',
            prix: 11000,
            description: 'Boisson gazeuse aux fruits.',
            populaire: false
        },
        {
            id: 29,
            nom: 'Red Bull',
            categorie: 'Boissons',
            prix: 24000,
            description: 'Boisson énergisante.',
            populaire: false
        },
        {id: 30, nom: 'Capri-Sun', categorie: 'Boissons', prix: 5000, description: 'Poche de jus.', populaire: false},
        {
            id: 31,
            nom: 'Jus (petit bidon)',
            categorie: 'Boissons',
            prix: 7000,
            description: 'Jus en petit format.',
            populaire: false
        },
        {
            id: 32,
            nom: 'Jus (carton)',
            categorie: 'Boissons',
            prix: 24000,
            description: 'Jus grand format.',
            populaire: false
        },
        {
            id: 33,
            nom: 'Eau (petit bidon)',
            categorie: 'Boissons',
            prix: 5000,
            description: 'Eau minérale 0,5L.',
            populaire: false
        },
        {
            id: 34,
            nom: 'Eau (grand bidon)',
            categorie: 'Boissons',
            prix: 9000,
            description: 'Eau minérale 1,5L.',
            populaire: false
        },
        {
            id: 35,
            nom: 'Lait Manan (grand)',
            categorie: 'Boissons',
            prix: 29000,
            description: 'Lait Manan grand format.',
            populaire: false
        },
        {
            id: 36,
            nom: 'Lait Manan (petit)',
            categorie: 'Boissons',
            prix: 18000,
            description: 'Lait Manan petit format.',
            populaire: false
        },
        {
            id: 37,
            nom: 'Lait Malipan (grand)',
            categorie: 'Boissons',
            prix: 24000,
            description: 'Lait Malipan grand format.',
            populaire: false
        },
        {
            id: 38,
            nom: 'Lait Malipan (petit)',
            categorie: 'Boissons',
            prix: 18000,
            description: 'Lait Malipan petit format.',
            populaire: false
        },

        // Gâteaux d'anniversaire
        {
            id: 39,
            nom: 'Gâteau Petit Format (Standard)',
            categorie: 'Gâteaux',
            prix: 85000,
            description: 'Option sans chocolat.',
            populaire: false
        },
        {
            id: 40,
            nom: 'Gâteau Petit Format (Chocolat)',
            categorie: 'Gâteaux',
            prix: 125000,
            description: 'Gâteau nappé / fourré au chocolat.',
            populaire: false
        },
        {
            id: 41,
            nom: 'Gâteau Moyen Format (Standard)',
            categorie: 'Gâteaux',
            prix: 105000,
            description: 'Option sans chocolat.',
            populaire: false
        },
        {
            id: 42,
            nom: 'Gâteau Moyen Format (Chocolat)',
            categorie: 'Gâteaux',
            prix: 155000,
            description: 'Gâteau nappé / fourré au chocolat.',
            populaire: true
        },
        {
            id: 43,
            nom: 'Gâteau Grand Format (Standard)',
            categorie: 'Gâteaux',
            prix: 200000,
            description: 'Option sans chocolat.',
            populaire: false
        },
        {
            id: 44,
            nom: 'Gâteau Grand Format (Chocolat)',
            categorie: 'Gâteaux',
            prix: 255000,
            description: 'Gâteau nappé / fourré au chocolat.',
            populaire: false
        },

        // Suppléments
        {
            id: 45,
            nom: 'Supplément Garniture (Frites / Alloco)',
            categorie: 'Suppléments',
            prix: 5000,
            description: 'Portion supplémentaire.',
            populaire: false
        }
    ];
}
