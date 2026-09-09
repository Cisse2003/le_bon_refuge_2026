<?php
// ============================================================================
// À FUSIONNER dans includes/helpers.php, à la place de votre log_action()
// actuelle. Signature compatible : tous vos appels existants (products.php,
// orders.php, users.php, ingredients.php, stock.php, auth.php...) continuent
// de fonctionner SANS AUCUNE MODIFICATION. Le seul changement : chaque appel
// écrit maintenant AUSSI une ligne dans audit_logs, pour que la supervision
// voie enfin des données.
// ============================================================================

// Déduit un "module" lisible à partir du nom de l'action, pour le filtre de
// supervision. Vous pouvez toujours forcer un module précis en passant
// $opts['module'] explicitement si l'inférence automatique ne convient pas.
function inferer_module($action) {
    $table = [
        'PRODUIT' => 'produits',
        'COMMANDE' => 'commandes',
        'CUISINE' => 'commandes',
        'STATUT' => 'commandes',
        'RESERVATION' => 'reservations',
        'STOCK_INGREDIENT' => 'ingredients',
        'INGREDIENT' => 'ingredients',
        'STOCK' => 'stock',
        'UTILISATEUR' => 'utilisateurs',
        'CONNEXION' => 'auth',
        'DECONNEXION' => 'auth',
    ];
    foreach ($table as $motCle => $module) {
        if (strpos($action, $motCle) !== false) return $module;
    }
    return 'autre';
}

function log_action($opts) {
    $pdo = get_pdo();

    // --- 1) Table "logs" existante (traçabilité visible par chef/admin) ---
    $stmt = $pdo->prepare("INSERT INTO logs (id, order_id, order_numero, date, utilisateur, role, action, champ, ancienne_valeur, nouvelle_valeur)
        VALUES (:id, :order_id, :order_numero, :date, :utilisateur, :role, :action, :champ, :ancienne_valeur, :nouvelle_valeur)");
    $stmt->execute([
        ':id' => uuidv4(),
        ':order_id' => $opts['order_id'] ?? null,
        ':order_numero' => $opts['order_numero'] ?? null,
        ':date' => now_datetime(),
        ':utilisateur' => $opts['utilisateur'],
        ':role' => $opts['role'] ?? null,
        ':action' => $opts['action'],
        ':champ' => $opts['champ'] ?? null,
        ':ancienne_valeur' => $opts['ancienne_valeur'] ?? null,
        ':nouvelle_valeur' => $opts['nouvelle_valeur'] ?? null,
    ]);

    // --- 2) Table "audit_logs" (vision globale, réservée au superviseur) ---
    $details = [];
    if (isset($opts['champ'])) $details['champ'] = $opts['champ'];
    if (isset($opts['ancienne_valeur'])) $details['ancienne_valeur'] = $opts['ancienne_valeur'];
    if (isset($opts['nouvelle_valeur'])) $details['nouvelle_valeur'] = $opts['nouvelle_valeur'];
    if (isset($opts['order_numero'])) $details['commande'] = $opts['order_numero'];

    // user_id : récupéré depuis la session si non fourni explicitement, pour
    // permettre la jointure avec la table users (affichage du nom complet).
    $userId = $opts['user_id'] ?? (current_user()['id'] ?? null);

    $stmtAudit = $pdo->prepare("INSERT INTO audit_logs (user_id, username, role, action, module, details, created_at)
        VALUES (:user_id, :username, :role, :action, :module, :details, :created_at)");
    $stmtAudit->execute([
        ':user_id' => $userId,
        ':username' => $opts['utilisateur'],
        ':role' => $opts['role'] ?? 'inconnu',
        ':action' => $opts['action'],
        ':module' => $opts['module'] ?? inferer_module($opts['action']),
        ':details' => json_encode($details, JSON_UNESCAPED_UNICODE),
        ':created_at' => now_datetime(),
    ]);
}