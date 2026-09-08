# LE BON REFUGE — Version PHP + MySQL (Hostinger)

Application complète pour le restaurant **Le Bon Refuge**.  
Déploiement **directement dans le répertoire racine** (`public_html`).

## Déploiement en 5 minutes

### 1. Créer la base de données

1. hPanel Hostinger → **Bases de données MySQL**
2. Créer une base + un utilisateur
3. Noter : nom de la base, utilisateur, mot de passe

### 2. Importer le schéma

1. Ouvrir **phpMyAdmin**
2. Sélectionner votre base
3. Onglet **Importer** → fichier `schema.sql` → Exécuter

### 3. Configurer

Éditer le fichier `config.php` (avec le gestionnaire de fichiers) :

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'uXXXXXX_lebonrefuge');   // votre base
define('DB_USER', 'uXXXXXX_user');          // votre utilisateur
define('DB_PASS', 'VotreMotDePasse');       // votre mot de passe
```

### 4. Uploader dans public_html

1. Décompressez le ZIP
2. Uploadez **tout le contenu** directement dans `public_html`  
   (index.html, admin.html, api/, css/, js/, config.php, includes/, etc.)

### 5. Initialiser les données

1. Ouvrez temporairement : `https://votredomaine.com/seed.php`
2. Vous devez voir le message de succès
3. **Supprimez immédiatement** le fichier `seed.php`

> Note : le fichier `.htaccess` bloque déjà l’accès à `config.php`, `includes/`, `schema.sql` et `data/`.

## Comptes par défaut (à changer tout de suite)

| Identifiant | Mot de passe | Rôle            |
|-------------|--------------|-----------------|
| admin       | admin123     | Administrateur  |
| chef        | chef123      | Chef de cuisine |
| assistant   | chef123      | Assistant chef  |
| serveur     | serveur123   | Serveur         |

Connexion : `/login.html` → puis **Admin → Utilisateurs** pour changer les mots de passe.

## Pages

| Page              | URL              |
|-------------------|------------------|
| Site vitrine      | `/`              |
| Connexion staff   | `/login.html`    |
| Caisse            | `/caisse.html`   |
| Cuisine (KDS)     | `/cuisine.html`  |
| Administration    | `/admin.html`    |

## Personnalisation

- Téléphone / WhatsApp / réseaux : en haut de `js/site.js`
- Logo : remplacer `images/logo.jpg`
- Devise : déjà en **Franc guinéen (FG)**

## Structure (tout dans public_html)

```
public_html/
├── .htaccess          ← protège config, includes, seed…
├── config.php         ← identifiants MySQL (à éditer)
├── schema.sql
├── seed.php           ← à supprimer après initialisation
├── index.html
├── login.html
├── caisse.html
├── cuisine.html
├── admin.html
├── api/index.php      ← routeur API
├── css/
├── js/
├── images/
├── uploads/
├── includes/
└── data/
```

## En cas de problème

- Erreur de connexion BDD → vérifiez `config.php`
- Pages blanches → activez temporairement `display_errors` dans `config.php` ou regardez les logs d’erreurs Hostinger
- Uploads impossibles → droits d’écriture sur le dossier `uploads/` (755 ou 775)

Bon service ! 🍽️
