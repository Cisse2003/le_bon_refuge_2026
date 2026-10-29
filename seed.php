<?php
// seed.php - Script pour ajouter/mettre à jour les nouveaux plats dans la base MySQL

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    // 1. Table audit_logs (si nécessaire)
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

    // 2. Liste des nouveaux plats (de p016 à p052)
    $nouveauxPlats = [


        // Gâteaux d'anniversaire — tarifs officiels
        [
            "id" => "p053",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Petit Format (Standard)",
            "description" => "Gâteau d'anniversaire petit format, sans chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 85000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p054",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Petit Format (Chocolat)",
            "description" => "Gâteau d'anniversaire petit format avec chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 125000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p055",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Moyen Format (Standard)",
            "description" => "Gâteau d'anniversaire moyen format, sans chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 105000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p056",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Moyen Format (Chocolat)",
            "description" => "Gâteau d'anniversaire moyen format avec chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 155000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p057",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Grand Format (Standard)",
            "description" => "Gâteau d'anniversaire grand format, sans chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 200000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p058",
            "categorie" => "Gâteaux",
            "nom" => "Gâteau Grand Format (Chocolat)",
            "description" => "Gâteau d'anniversaire grand format avec chocolat. Découpage offert si vous fêtez dans le restaurant.",
            "prix" => 255000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ]
    ];

    $stmtProduct = $pdo->prepare("
        INSERT INTO products (id, categorie, nom, description, prix, photo, poste, options_json, disponible, recette_json) 
        VALUES (:id, :categorie, :nom, :description, :prix, :photo, :poste, :options_json, :disponible, :recette_json)
        ON DUPLICATE KEY UPDATE 
            nom = VALUES(nom), 
            description = VALUES(description), 
            prix = VALUES(prix), 
            categorie = VALUES(categorie), 
            options_json = VALUES(options_json), 
            recette_json = VALUES(recette_json)
    ");

    $stmtStock = $pdo->prepare("
        INSERT INTO stock (product_id, quantite, seuil_alerte) 
        VALUES (:product_id, 50, 10)
        ON DUPLICATE KEY UPDATE product_id = VALUES(product_id)
    ");

    foreach ($nouveauxPlats as $p) {
        $stmtProduct->execute([
            ':id' => $p['id'],
            ':categorie' => $p['categorie'],
            ':nom' => $p['nom'],
            ':description' => $p['description'],
            ':prix' => $p['prix'],
            ':photo' => $p['photo'],
            ':poste' => $p['poste'],
            ':options_json' => json_encode($p['options'], JSON_UNESCAPED_UNICODE),
            ':disponible' => $p['disponible'],
            ':recette_json' => json_encode($p['recette'], JSON_UNESCAPED_UNICODE)
        ]);

        $stmtStock->execute([':product_id' => $p['id']]);
    }

    echo "Tous les plats ont été insérés/mis à jour avec succès dans la base de données !\n";

} catch (Exception $e) {
    die("Erreur : " . $e->getMessage() . "\n");
}