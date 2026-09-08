<?php
/**
 * Script d'initialisation de la base de données.
 * À exécuter UNE SEULE FOIS après avoir importé schema.sql.
 * Usage (en local ou via SSH Hostinger) : php seed.php
 * Ou ouvrez https://votresite.com/seed.php puis SUPPRIMEZ ce fichier.
 */

require_once __DIR__ . '/includes/db.php';

$pdo = getDB();

// Vérifier si déjà seedé
$count = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
if ($count > 0) {
    echo "Base déjà initialisée ($count utilisateurs). Abandon.\n";
    exit;
}

echo "Initialisation de la base Le Bon Refuge...\n";

// === UTILISATEURS (mots de passe à changer en production) ===
// admin123 / chef123 / serveur123
$users = [
    ['admin', 'admin123', 'admin', 'Administrateur'],
    ['chef', 'chef123', 'chef', 'Chef de cuisine'],
    ['assistant', 'chef123', 'assistant_chef', 'Assistant chef'],
    ['serveur', 'serveur123', 'serveur', 'Serveur'],
];

$stmt = $pdo->prepare('INSERT INTO users (id, username, password_hash, role, nom, actif) VALUES (?, ?, ?, ?, ?, 1)');
foreach ($users as $u) {
    $hash = password_hash($u[1], PASSWORD_BCRYPT);
    $stmt->execute([uuid(), $u[0], $hash, $u[2], $u[3]]);
    echo "  Utilisateur créé : {$u[0]} / {$u[1]}\n";
}

// === INGRÉDIENTS ===
$ingredients = [
    ['ing001', 'Poulet (filet)', 'g', 5000, 1000],
    ['ing002', 'Viande de kebab', 'g', 8000, 1500],
    ['ing003', 'Steak haché', 'g', 6000, 1000],
    ['ing004', 'Pain burger', 'unite', 100, 20],
    ['ing005', 'Pâte à pizza', 'unite', 60, 10],
    ['ing006', 'Mozzarella', 'g', 4000, 800],
    ['ing007', 'Frites surgelées', 'g', 10000, 2000],
    ['ing008', 'Cheddar', 'g', 2000, 400],
    ['ing009', 'Nuggets', 'g', 6000, 1000],
    ['ing010', 'Lait (crèmerie)', 'ml', 8000, 1500],
    ['ing011', 'Farine (pâtisserie)', 'g', 5000, 1000],
];
$stmt = $pdo->prepare('INSERT INTO ingredients (id, nom, unite, quantite_stock, seuil_alerte) VALUES (?, ?, ?, ?, ?)');
foreach ($ingredients as $i) {
    $stmt->execute($i);
}
echo "  " . count($ingredients) . " ingrédients créés\n";

// === PRODUITS (menu de démonstration) ===
$products = json_decode(file_get_contents(__DIR__ . '/data/products.json'), true);
if (!$products) {
    // Fallback minimal si le JSON n'est pas là
    $products = [
        [
            'id' => 'p001', 'categorie' => 'Plats', 'nom' => 'Tacos Poulet Cheddar',
            'description' => 'Poulet mariné, frites maison, cheddar fondu.',
            'prix' => 45000, 'photo' => '', 'poste' => 'cuisine',
            'options' => ['Sauce blanche', 'Sauce algérienne'],
            'disponible' => true,
            'recette' => [['ingredientId' => 'ing001', 'quantite' => 150], ['ingredientId' => 'ing008', 'quantite' => 40]]
        ],
    ];
}

$stmtP = $pdo->prepare('INSERT INTO products (id, categorie, nom, description, prix, photo, poste, options_json, disponible, recette_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmtS = $pdo->prepare('INSERT INTO stock (product_id, quantite, seuil_alerte) VALUES (?, 50, 10)');
foreach ($products as $p) {
    $stmtP->execute([
        $p['id'],
        $p['categorie'],
        $p['nom'],
        $p['description'] ?? '',
        $p['prix'],
        $p['photo'] ?? '',
        $p['poste'] ?? 'cuisine',
        json_encode($p['options'] ?? [], JSON_UNESCAPED_UNICODE),
        !empty($p['disponible']) ? 1 : 0,
        json_encode($p['recette'] ?? [], JSON_UNESCAPED_UNICODE),
    ]);
    $stmtS->execute([$p['id']]);
}
echo "  " . count($products) . " produits + stock créés\n";

echo "\n✅ Initialisation terminée.\n";
echo "IMPORTANT : changez les mots de passe par défaut dès maintenant.\n";
echo "Puis SUPPRIMEZ ce fichier seed.php du serveur.\n";
?>
