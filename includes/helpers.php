<?php

function inferer_module($action) {
    $table = [
        'PRODUIT'          => 'produits',
        'COMMANDE'         => 'commandes',
        'CUISINE'          => 'commandes',
        'STATUT'           => 'commandes',
        'RESERVATION'      => 'reservations',
        'STOCK_INGREDIENT' => 'ingredients',
        'INGREDIENT'       => 'ingredients',
        'STOCK'            => 'stock',
        'UTILISATEUR'      => 'utilisateurs',
        'CONNEXION'        => 'auth',
        'DECONNEXION'      => 'auth',
    ];
    foreach ($table as $motCle => $module) {
        if (strpos($action, $motCle) !== false) return $module;
    }
    return 'autre';
}

function log_action($opts) {
    $pdo = get_pdo();

    // 1) Table "logs" existante
    $stmt = $pdo->prepare("INSERT INTO logs (id, order_id, order_numero, date, utilisateur, role, action, champ, ancienne_valeur, nouvelle_valeur)
        VALUES (:id, :order_id, :order_numero, :date, :utilisateur, :role, :action, :champ, :ancienne_valeur, :nouvelle_valeur)");
    $stmt->execute([
        ':id'              => uuidv4(),
        ':order_id'        => $opts['order_id'] ?? null,
        ':order_numero'    => $opts['order_numero'] ?? null,
        ':date'            => now_datetime(),
        ':utilisateur'    => $opts['utilisateur'],
        ':role'           => $opts['role'] ?? null,
        ':action'         => $opts['action'],
        ':champ'          => $opts['champ'] ?? null,
        ':ancienne_valeur' => $opts['ancienne_valeur'] ?? null,
        ':nouvelle_valeur' => $opts['nouvelle_valeur'] ?? null,
    ]);

    // 2) Table "audit_logs"
    $details = [];
    if (!empty($opts['champ']))           $details['champ'] = $opts['champ'];
    if (!empty($opts['ancienne_valeur'])) $details['ancienne_valeur'] = $opts['ancienne_valeur'];
    if (!empty($opts['nouvelle_valeur'])) $details['nouvelle_valeur'] = $opts['nouvelle_valeur'];
    if (!empty($opts['order_numero']))    $details['commande'] = $opts['order_numero'];
    if (!empty($opts['details'])) {
        $details = array_merge($details, is_array($opts['details']) ? $opts['details'] : ['info' => $opts['details']]);
    }

    $userId = $opts['user_id'] ?? (current_user()['id'] ?? null);

    $stmtAudit = $pdo->prepare("INSERT INTO audit_logs (user_id, username, role, action, module, details, created_at)
        VALUES (:user_id, :username, :role, :action, :module, :details, :created_at)");
    $stmtAudit->execute([
        ':user_id'    => $userId,
        ':username'   => $opts['utilisateur'],
        ':role'       => $opts['role'] ?? 'inconnu',
        ':action'     => $opts['action'],
        ':module'     => $opts['module'] ?? inferer_module($opts['action']),
        ':details'    => !empty($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        ':created_at' => now_datetime(),
    ]);
}