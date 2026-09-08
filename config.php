<?php
/**
 * Configuration Le Bon Refuge — Hostinger / PHP + MySQL
 * Renseignez ces valeurs avec celles de votre base créée dans hPanel Hostinger.
 */

// === BASE DE DONNÉES (à remplir avec les infos de hPanel → Bases de données MySQL) ===
define('DB_HOST', 'localhost');          // généralement localhost sur Hostinger
define('DB_NAME', 'u926072297_lebonrefuge'); // nom de votre base
define('DB_USER', 'u926072297_user');        // utilisateur MySQL
define('DB_PASS', 'TestTest@224');  // mot de passe MySQL
define('DB_CHARSET', 'utf8mb4');

// === APPLICATION ===
define('APP_NAME', 'Le Bon Refuge');
define('SESSION_NAME', 'lbr_session');
define('UPLOAD_DIR', __DIR__ . '/uploads');
define('UPLOAD_URL', '/uploads');
define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5 Mo

// Contact / réseaux (modifiables aussi dans public/js/site.js)
define('NUMERO_TELEPHONE', '+224 XXX XX XX XX');
define('NUMERO_WHATSAPP', '224XXXXXXXXX');
define('LIEN_TIKTOK', 'https://www.tiktok.com/@lebonrefuge');
define('LIEN_FACEBOOK', 'https://www.facebook.com/lebonrefuge');

// Fuseau horaire
date_default_timezone_set('Africa/Conakry');

// Affichage erreurs (mettre à 0 en production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
?>
