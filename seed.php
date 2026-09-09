<?php
// seed.php - À exécuter en ligne de commande : php seed.php

require_once __DIR__ . '/includes/db.php';

try {
    // 1. Récupération de l'instance PDO via la fonction getDB()
    $pdo = getDB();

    // 2. Création automatique de la table audit_logs si elle n'existe pas
    $sqlTable = "
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
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

    // 3. Création ou mise à jour des 2 comptes superviseurs
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

        $stmt = $pdo->prepare("
            INSERT INTO user (nom, username, password, role, actif) 
            VALUES (:nom, :username, :password, :role, 1)
            ON DUPLICATE KEY UPDATE 
                nom = VALUES(nom),
                password = VALUES(password),
                role = VALUES(role),
                actif = 1
        ");

        $stmt->execute([
            ':nom' => $sup['nom'],
            ':username' => $sup['username'],
            ':password' => $hash,
            ':role' => $sup['role']
        ]);

        echo "Compte " . $sup['username'] . " configuré avec succès.\n";
    }

} catch (Exception $e) {
    die("Erreur de seeding / création de table : " . $e->getMessage() . "\n");
}