<?php
// seed.php - Script pour ajouter/mettre à jour les nouveaux plats dans la base MySQL

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    // 1. Table audit_logs (si nécessaire)
    $sqlTable = "
    SELECT id, user_id, login_at, logout_at
FROM user_sessions
ORDER BY login_at DESC
LIMIT 30;
    ";
    $pdo->exec($sqlTable);


    echo "Well Done !\n";

} catch (Exception $e) {
    die("Erreur : " . $e->getMessage() . "\n");
}