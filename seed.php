<?php
// seed.php - À exécuter avec : php seed.php

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    // 1. Table audit_logs (adaptée avec un user_id en VARCHAR(36) pour correspondre aux UUIDs)
    $sqlTable = "
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        username VARCHAR(64) NOT NULL,
        role VARCHAR(32) NOT NULL,
        action VARCHAR(255) NOT NULL,
        module VARCHAR(64) NOT NULL,
        details JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_role (role),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";

    $pdo->exec($sqlTable);
    echo "Table 'audit_logs' vérifiée / créée avec succès.\n";

    // 2. Définition des superviseurs
    $supervisors = [
        [
            'nom' => 'Superviseur 1',
            'username' => 'superviseur1',
            'password' => 'Sup1SecretPass2026!',
            'role' => 'superviseur'
        ],
        [
            'nom' => 'Superviseur 2',
            'username' => 'superviseur2',
            'password' => 'Sup2SecretPass2026!',
            'role' => 'superviseur'
        ]
    ];

    foreach ($supervisors as $sup) {
        $hash = password_hash($sup['password'], PASSWORD_BCRYPT);

        // Suppression préalable au cas où le username existe déjà
        $deleteStmt = $pdo->prepare("DELETE FROM users WHERE username = :username");
        $deleteStmt->execute([':username' => $sup['username']]);

        // Insertion avec id au format UUID et colonne password_hash
        $stmt = $pdo->prepare("
            INSERT INTO users (id, nom, username, password_hash, role, actif) 
            VALUES (:id, :nom, :username, :password_hash, :role, 1)
        ");

        $stmt->execute([
            ':id' => uuid(), // Appel de la fonction uuid() définie dans db.php
            ':nom' => $sup['nom'],
            ':username' => $sup['username'],
            ':password_hash' => $hash,
            ':role' => $sup['role']
        ]);

        echo "Compte " . $sup['username'] . " configuré avec succès.\n";
    }

} catch (Exception $e) {
    die("Erreur de seeding / création de table : " . $e->getMessage() . "\n");
}