<?php
// api/supervision.php
// Routes : GET /api/supervision/logs?role=&search=&date=
//          GET /api/supervision/export-audit   (CSV)
//          GET /api/supervision/export-full    (JSON, dump complet)
//
// IMPORTANT : cette ligne doit être la TOUTE PREMIÈRE chose exécutée dans ce
// fichier. Aucune requête SQL, aucune donnée ne doit être accessible avant
// cette vérification. C'est ÇA la vraie barrière de sécurité — pas le JS.
$user = require_role('superviseur');

$action = $sub[0] ?? '';

// ---------------------------------------------------------------------------
// GET /api/supervision/logs
// ---------------------------------------------------------------------------
if ($method === 'GET' && $action === 'logs') {
    $role = $_GET['role'] ?? '';
    $search = trim($_GET['search'] ?? '');
    $date = $_GET['date'] ?? '';

    $sql = "SELECT al.*, u.nom AS user_nom
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            WHERE 1=1";
    $params = [];

    if ($role !== '') { $sql .= " AND al.role = :role"; $params[':role'] = $role; }
    if ($date !== '') { $sql .= " AND DATE(al.created_at) = :date"; $params[':date'] = $date; }
    if ($search !== '') {
        $sql .= " AND (al.username LIKE :s1 OR al.action LIKE :s2 OR al.module LIKE :s3 OR al.details LIKE :s4)";
        $like = '%' . $search . '%';
        $params[':s1'] = $like; $params[':s2'] = $like; $params[':s3'] = $like; $params[':s4'] = $like;
    }
    $sql .= " ORDER BY al.created_at DESC LIMIT 500";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // On décode "details" en vrai objet JSON pour éviter le double-encodage côté frontend.
    $result = array_map(function ($r) {
        $r['details'] = $r['details'] ? json_decode($r['details'], true) : null;
        return $r;
    }, $rows);

    json_response($result);
}

// ---------------------------------------------------------------------------
// GET /api/supervision/export-audit (CSV)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $action === 'export-audit') {
    $rows = $pdo->query("SELECT al.*, u.nom AS user_nom FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id ORDER BY al.created_at DESC")->fetchAll();

    $nomFichier = 'Le_Bon_Refuge_Audit_' . date('Y-m-d_H-i-s') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nomFichier . '"');

    $out = fopen('php://output', 'w');
    fputs($out, "\xEF\xBB\xBF"); // BOM UTF-8 pour qu'Excel affiche correctement les accents
    fputcsv($out, ['Date', 'Utilisateur', 'Nom', 'Role', 'Action', 'Module', 'Details'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['created_at'], $r['username'], $r['user_nom'], $r['role'],
            $r['action'], $r['module'], $r['details'],
        ], ';');
    }
    fclose($out);
    exit;
}

// ---------------------------------------------------------------------------
// GET /api/supervision/export-full (dump complet de la base, superviseur uniquement)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $action === 'export-full') {
    $tables = ['users', 'products', 'product_recette', 'ingredients', 'stock',
        'orders', 'order_items', 'reservations', 'logs', 'audit_logs'];

    $dump = ['dateExport' => (new DateTime())->format('c')];
    foreach ($tables as $t) {
        $stmt = $pdo->query("SELECT * FROM `$t`");
        $rows = $stmt->fetchAll();
        // On ne divulgue jamais les hash de mots de passe, même dans un export superviseur.
        if ($t === 'users') {
            $rows = array_map(function ($r) { unset($r['password_hash']); return $r; }, $rows);
        }
        $dump[$t] = $rows;
    }

    $nomFichier = 'Le_Bon_Refuge_Dump_Complet_' . date('Y-m-d_H-i-s') . '.json';
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nomFichier . '"');
    echo json_encode($dump, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

json_response(['error' => 'Route de supervision inconnue'], 404);