<?php
// seed.php - Script pour ajouter/mettre à jour les nouveaux plats dans la base MySQL

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    // 1. Table audit_logs (si nécessaire)
    $sqlTable = "
    CREATE TABLE IF NOT EXISTS user_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    login_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    logout_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_sessions_user (user_id),
    INDEX idx_user_sessions_login (login_at),
    INDEX idx_user_sessions_logout (logout_at)
);
    ";
    $pdo->exec($sqlTable);


    echo "Well Done !\n";

} catch (Exception $e) {
    die("Erreur : " . $e->getMessage() . "\n");
}