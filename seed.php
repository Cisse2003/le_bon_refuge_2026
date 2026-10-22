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
        [
            "id" => "p016",
            "categorie" => "Plats Chauds",
            "nom" => "Riz gras poulet / poisson",
            "description" => "Riz gras traditionnel servi avec du poulet ou du poisson.",
            "prix" => 25000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Poulet", "Poisson"],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing012", "quantite" => 250],
                ["ingredientId" => "ing001", "quantite" => 150]
            ]
        ],
        [
            "id" => "p017",
            "categorie" => "Plats Chauds",
            "nom" => "Riz gras à la viande",
            "description" => "Riz gras traditionnel servi avec de la viande.",
            "prix" => 30000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing012", "quantite" => 250],
                ["ingredientId" => "ing003", "quantite" => 150]
            ]
        ],
        [
            "id" => "p018",
            "categorie" => "Plats Chauds",
            "nom" => "Garba poulet / poisson",
            "description" => "Semoule de manioc accompagnée de poulet ou de poisson.",
            "prix" => 50000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Poulet", "Poisson"],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing013", "quantite" => 200],
                ["ingredientId" => "ing001", "quantite" => 150]
            ]
        ],
        [
            "id" => "p019",
            "categorie" => "Plats Chauds",
            "nom" => "Petit pois au poulet",
            "description" => "Plat de petits pois mijotés au poulet.",
            "prix" => 40000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing014", "quantite" => 200],
                ["ingredientId" => "ing001", "quantite" => 150]
            ]
        ],
        [
            "id" => "p020",
            "categorie" => "Plats Chauds",
            "nom" => "Petit pois à la viande",
            "description" => "Plat de petits pois mijotés à la viande.",
            "prix" => 45000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing014", "quantite" => 200],
                ["ingredientId" => "ing003", "quantite" => 150]
            ]
        ],
        [
            "id" => "p021",
            "categorie" => "Plats Chauds",
            "nom" => "Spaghetti au poulet",
            "description" => "Spaghettis sautés ou en sauce servis avec du poulet.",
            "prix" => 20000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing015", "quantite" => 150],
                ["ingredientId" => "ing001", "quantite" => 100]
            ]
        ],
        [
            "id" => "p022",
            "categorie" => "Plats Chauds",
            "nom" => "Spaghetti à la viande",
            "description" => "Spaghettis servis avec de la viande.",
            "prix" => 20000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing015", "quantite" => 150],
                ["ingredientId" => "ing003", "quantite" => 100]
            ]
        ],
        [
            "id" => "p023",
            "categorie" => "Plats Chauds",
            "nom" => "Spaghetti bolognaise",
            "description" => "Spaghettis à la sauce bolognaise.",
            "prix" => 25000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
                ["ingredientId" => "ing015", "quantite" => 150],
                ["ingredientId" => "ing003", "quantite" => 100]
            ]
        ],
        [
            "id" => "p024",
            "categorie" => "Pizzas",
            "nom" => "Pizza Poulet",
            "description"=> "Sauce tomate, mozzarella et morceaux de poulet.",
            "prix" => 90000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Petite", "Moyenne", "Grande"],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing005", "quantite" => 1],
        ["ingredientId" => "ing001", "quantite" => 100]
    ]
        ],
        [
            "id" => "p025",
            "categorie" => "Pizzas",
            "nom" => "Pizza Viande",
            "description"=> "Sauce tomate, mozzarella et viande hachée.",
            "prix" => 95000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Petite", "Moyenne", "Grande"],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing005", "quantite" => 1],
        ["ingredientId" => "ing003", "quantite" => 100]
    ]
        ],
        [
            "id" => "p026",
            "categorie" => "Pizzas",
            "nom" => "Pizza Thongwenmo",
            "description"=> "Spécialité de pizza de la maison.",
            "prix" => 100000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Petite", "Moyenne", "Grande"],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing005", "quantite" => 1]
    ]
        ],
        [
            "id" => "p027",
            "categorie" => "Poulet Braisé",
            "nom" => "Demi-poulet braisé",
            "description"=> "Demi-poulet braisé servi avec frites ou alloco.",
            "prix" => 55000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Frites", "Alloco"],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing001", "quantite" => 250],
        ["ingredientId" => "ing007", "quantite" => 100]
    ]
        ],
        [
            "id" => "p028",
            "categorie" => "Poulet Braisé",
            "nom" => "Poulet entier braisé",
            "description"=> "Poulet entier braisé servi avec frites ou alloco.",
            "prix" => 110000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => ["Frites", "Alloco"],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing001", "quantite" => 500],
        ["ingredientId" => "ing007", "quantite" => 200]
    ]
        ],
        [
            "id" => "p029",
            "categorie" => "Fast-food",
            "nom" => "Burger viande",
            "description"=> "Burger garni de viande avec frites.",
            "prix" => 55000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing003", "quantite" => 150],
        ["ingredientId" => "ing007", "quantite" => 100]
    ]
        ],
        [
            "id" => "p030",
            "categorie" => "Fast-food",
            "nom" => "Shawarma à la viande",
            "description"=> "Shawarma savoureux à la viande.",
            "prix" => 30000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing003", "quantite" => 120]
    ]
        ],
        [
            "id" => "p031",
            "categorie" => "Fast-food",
            "nom" => "Tacos poulet",
            "description"=> "Tacos garni au poulet.",
            "prix" => 65000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing001", "quantite" => 150]
    ]
        ],
        [
            "id" => "p032",
            "categorie" => "Fast-food",
            "nom" => "Tacos viande hachée",
            "description"=> "Tacos garni à la viande hachée.",
            "prix" => 75000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing003", "quantite" => 150]
    ]
        ],
        [
            "id" => "p033",
            "categorie" => "Fataya",
            "nom" => "Fataya poulet",
            "description"=> "Beignets farcis au poulet.",
            "prix" => 20000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing001", "quantite" => 80]
    ]
        ],
        [
            "id" => "p034",
            "categorie" => "Fataya",
            "nom" => "Fataya viande",
            "description"=> "Beignets farcis à la viande.",
            "prix" => 25000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => [
        ["ingredientId" => "ing003", "quantite" => 80]
    ]
        ],
        [
            "id" => "p035",
            "categorie" => "Crèmerie",
            "nom" => "Glace petit format",
            "description"=> "Glace format individuel.",
            "prix" => 5000,
            "photo" => "",
            "poste" => "cremerie",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p036",
            "categorie" => "Crèmerie",
            "nom" => "Glace grand format",
            "description"=> "Glace grand format.",
            "prix" => 10000,
            "photo" => "",
            "poste" => "cremerie",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p037",
            "categorie" => "Boissons",
            "nom" => "Fanta",
            "description"=> "Boisson gazeuse Fanta.",
            "prix" => 10000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p038",
            "categorie" => "Boissons",
            "nom" => "Coca",
            "description"=> "Boisson gazeuse Coca-Cola.",
            "prix" => 10000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p039",
            "categorie" => "Boissons",
            "nom" => "Sagiko",
            "description"=> "Boisson Sagiko.",
            "prix" => 10000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p040",
            "categorie" => "Boissons",
            "nom" => "Fruitalos",
            "description"=> "Jus Fruitalos.",
            "prix" => 9000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p041",
            "categorie" => "Boissons",
            "nom" => "Comando",
            "description"=> "Boisson Comando.",
            "prix" => 11000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p042",
            "categorie" => "Boissons",
            "nom" => "Vimto",
            "description"=> "Boisson Vimto.",
            "prix" => 11000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p043",
            "categorie" => "Boissons",
            "nom" => "Red Bull",
            "description"=> "Boisson énergisante Red Bull.",
            "prix" => 24000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p044",
            "categorie" => "Boissons",
            "nom" => "Caprisun",
            "description"=> "Jus de fruits Caprisun.",
            "prix" => 5000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p045",
            "categorie" => "Boissons",
            "nom" => "Jus bidon",
            "description"=> "Jus en format bidon.",
            "prix" => 7000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p046",
            "categorie" => "Boissons",
            "nom" => "Jus carton",
            "description"=> "Jus en format carton.",
            "prix" => 24000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p047",
            "categorie" => "Boissons",
            "nom" => "Eau petit bidon",
            "description"=> "Eau minérale petit bidon.",
            "prix" => 5000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p048",
            "categorie" => "Boissons",
            "nom" => "Eau grand bidon",
            "description"=> "Eau minérale grand bidon.",
            "prix" => 9000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p049",
            "categorie" => "Boissons",
            "nom" => "Lait Manan grand",
            "description"=> "Lait Manan grand format.",
            "prix" => 29000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p050",
            "categorie" => "Boissons",
            "nom" => "Lait Manan petit",
            "description"=> "Lait Manan petit format.",
            "prix" => 18000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p051",
            "categorie" => "Boissons",
            "nom" => "Lait Malipan grand",
            "description"=> "Lait Malipan grand format.",
            "prix" => 24000,
            "photo" => "",
            "poste" => "cuisine",
            "options" => [],
            "disponible" => 1,
            "recette" => []
        ],
        [
            "id" => "p052",
            "categorie" => "Boissons",
            "nom" => "Lait Malipan petit",
            "description"=> "Lait Malipan petit format.",
            "prix" => 18000,
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