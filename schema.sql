-- ============================================================
-- LE BON REFUGE — Schéma MySQL pour Hostinger
-- Exécutez ce fichier dans phpMyAdmin (hPanel → Bases de données → phpMyAdmin)
-- ============================================================

USE u926072297_lebonrefuge;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','chef','assistant_chef','serveur') NOT NULL DEFAULT 'serveur',
  nom VARCHAR(100) NOT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY,
  categorie VARCHAR(50) NOT NULL,
  nom VARCHAR(150) NOT NULL,
  description TEXT,
  prix INT NOT NULL DEFAULT 0,
  photo VARCHAR(255) DEFAULT '',
  poste ENUM('cuisine','cremerie','patisserie') NOT NULL DEFAULT 'cuisine',
  options_json JSON,
  disponible TINYINT(1) NOT NULL DEFAULT 1,
  recette_json JSON,
  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id VARCHAR(36) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  unite VARCHAR(20) NOT NULL DEFAULT 'g',
  quantite_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  seuil_alerte DECIMAL(12,2) NOT NULL DEFAULT 0,
  photo VARCHAR(255) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock (
  product_id VARCHAR(36) PRIMARY KEY,
  quantite INT NOT NULL DEFAULT 0,
  seuil_alerte INT NOT NULL DEFAULT 10,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  numero INT NOT NULL,
  type ENUM('sur_place','a_emporter','en_ligne','avance') NOT NULL DEFAULT 'sur_place',
  statut ENUM('NOUVELLE','CONFIRMEE','EN_PREPARATION','PRETE','TERMINEE','ANNULEE') NOT NULL DEFAULT 'NOUVELLE',
  table_num VARCHAR(20) DEFAULT NULL,
  client_nom VARCHAR(100) DEFAULT NULL,
  client_tel VARCHAR(30) DEFAULT NULL,
  notes TEXT,
  total INT NOT NULL DEFAULT 0,
  envoi_cuisine TINYINT(1) NOT NULL DEFAULT 0,
  served_by_id VARCHAR(36) DEFAULT NULL,
  served_by_nom VARCHAR(100) DEFAULT NULL,
  date_creation DATETIME NOT NULL,
  date_modif DATETIME DEFAULT NULL,
  date_envoi_cuisine DATETIME DEFAULT NULL,
  INDEX idx_date (date_creation),
  INDEX idx_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) DEFAULT NULL,
  nom VARCHAR(150) NOT NULL,
  prix INT NOT NULL DEFAULT 0,
  quantite INT NOT NULL DEFAULT 1,
  options_json JSON,
  personnalisation_json JSON,
  poste ENUM('cuisine','cremerie','patisserie') NOT NULL DEFAULT 'cuisine',
  statut_item ENUM('ATTENTE','EN_PREPARATION','PRETE') NOT NULL DEFAULT 'ATTENTE',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(36) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  tel VARCHAR(30) NOT NULL,
  date_reservation DATE NOT NULL,
  heure TIME NOT NULL,
  personnes INT NOT NULL DEFAULT 2,
  notes TEXT,
  statut ENUM('EN_ATTENTE','CONFIRMEE','ANNULEE','HONORE') NOT NULL DEFAULT 'EN_ATTENTE',
  date_creation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) DEFAULT NULL,
  order_numero INT DEFAULT NULL,
  date DATETIME NOT NULL,
  utilisateur VARCHAR(50) NOT NULL,
  role VARCHAR(30) NOT NULL,
  action VARCHAR(100) NOT NULL,
  champ VARCHAR(50) DEFAULT NULL,
  ancienne_valeur TEXT,
  nouvelle_valeur TEXT,
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
