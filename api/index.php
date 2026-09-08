<?php
/**
 * Routeur API unique — Le Bon Refuge (PHP + MySQL)
 * Toutes les requêtes /api/* arrivent ici grâce au .htaccess
 */

require_once __DIR__ . '/../includes/auth.php';

startSession();

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH);

// Extraire le chemin après /api/
if (preg_match('#/api(/.*)?$#', $path, $m)) {
    $route = $m[1] ?? '/';
} else {
    $route = '/';
}
$route = rtrim($route, '/') ?: '/';
$segments = $route === '/' ? [] : explode('/', trim($route, '/'));

// Corps JSON
$input = [];
$raw = file_get_contents('php://input');
if ($raw) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $input = $decoded;
}
// Fallback form
if (empty($input) && !empty($_POST)) $input = $_POST;

$pdo = getDB();

// ============================================================
// ROUTING
// ============================================================

// --- AUTH ---
if ($segments[0] === 'auth') {
    $action = $segments[1] ?? '';
    if ($method === 'POST' && $action === 'login') {
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';
        if (!$username || !$password) jsonError('Identifiant et mot de passe requis');
        $stmt = $pdo->prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND actif = 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonError('Identifiants invalides', 401);
        }
        $_SESSION['user'] = [
            'id' => $user['id'],
            'username' => $user['username'],
            'role' => $user['role'],
            'nom' => $user['nom'],
        ];
        logAction(['utilisateur' => $user['username'], 'role' => $user['role'], 'action' => 'CONNEXION']);
        jsonResponse(['user' => $_SESSION['user']]);
    }
    if ($method === 'POST' && $action === 'logout') {
        $_SESSION = [];
        session_destroy();
        jsonResponse(['ok' => true]);
    }
    if ($method === 'GET' && $action === 'me') {
        jsonResponse(['user' => currentUser()]);
    }
    jsonError('Route auth inconnue', 404);
}

// --- PRODUCTS ---
if ($segments[0] === 'products') {
    $id = $segments[1] ?? null;

    if ($method === 'GET' && !$id) {
        $rows = $pdo->query('SELECT * FROM products ORDER BY categorie, nom')->fetchAll();
        $out = array_map('mapProduct', $rows);
        jsonResponse($out);
    }
    if ($method === 'POST' && !$id) {
        requireRole('admin');
        $id = uuid();
        $stmt = $pdo->prepare('INSERT INTO products (id, categorie, nom, description, prix, photo, poste, options_json, disponible, recette_json) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $stmt->execute([
            $id,
            $input['categorie'] ?? 'Plats',
            $input['nom'] ?? '',
            $input['description'] ?? '',
            (int)($input['prix'] ?? 0),
            $input['photo'] ?? '',
            $input['poste'] ?? 'cuisine',
            json_encode($input['options'] ?? [], JSON_UNESCAPED_UNICODE),
            !empty($input['disponible']) ? 1 : 0,
            json_encode($input['recette'] ?? [], JSON_UNESCAPED_UNICODE),
        ]);
        $pdo->prepare('INSERT INTO stock (product_id, quantite, seuil_alerte) VALUES (?, 50, 10)')->execute([$id]);
        $row = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $row->execute([$id]);
        jsonResponse(mapProduct($row->fetch()), 201);
    }
    if ($method === 'PUT' && $id) {
        requireAuth();
        $fields = [];
        $params = [];
        foreach (['categorie','nom','description','photo','poste'] as $f) {
            if (isset($input[$f])) { $fields[] = "$f = ?"; $params[] = $input[$f]; }
        }
        if (isset($input['prix'])) { $fields[] = 'prix = ?'; $params[] = (int)$input['prix']; }
        if (isset($input['disponible'])) { $fields[] = 'disponible = ?'; $params[] = $input['disponible'] ? 1 : 0; }
        if (isset($input['options'])) { $fields[] = 'options_json = ?'; $params[] = json_encode($input['options'], JSON_UNESCAPED_UNICODE); }
        if (isset($input['recette'])) { $fields[] = 'recette_json = ?'; $params[] = json_encode($input['recette'], JSON_UNESCAPED_UNICODE); }
        if (!$fields) jsonError('Rien à modifier');
        $params[] = $id;
        $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        $row = $pdo->prepare('SELECT * FROM products WHERE id = ?');
        $row->execute([$id]);
        jsonResponse(mapProduct($row->fetch()));
    }
    if ($method === 'DELETE' && $id) {
        requireRole('admin');
        $pdo->prepare('DELETE FROM products WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }
    jsonError('Route products inconnue', 404);
}

// --- ORDERS ---
if ($segments[0] === 'orders') {
    $id = $segments[1] ?? null;
    $sub = $segments[2] ?? null;
    $itemId = $segments[3] ?? null;

    // GET /api/orders
    if ($method === 'GET' && !$id) {
        requireAuth();
        $orders = fetchOrders($pdo);
        jsonResponse($orders);
    }
    // GET /api/orders/public/:id
    if ($method === 'GET' && $id === 'public' && isset($segments[2])) {
        $order = fetchOrderById($pdo, $segments[2]);
        if (!$order) jsonError('Commande introuvable', 404);
        jsonResponse($order);
    }
    // GET /api/orders/:id
    if ($method === 'GET' && $id && $id !== 'public' && !$sub) {
        requireAuth();
        $order = fetchOrderById($pdo, $id);
        if (!$order) jsonError('Commande introuvable', 404);
        jsonResponse($order);
    }
    // POST /api/orders
    if ($method === 'POST' && !$id) {
        $items = $input['items'] ?? [];
        if (empty($items)) jsonError('Aucun article');
        $total = 0;
        foreach ($items as &$it) {
            $it['id'] = $it['id'] ?? uuid();
            $it['prix'] = (int)($it['prix'] ?? 0);
            $it['quantite'] = (int)($it['quantite'] ?? 1);
            $total += $it['prix'] * $it['quantite'];
            $it['poste'] = $it['poste'] ?? 'cuisine';
            $it['statutItem'] = $it['statutItem'] ?? 'ATTENTE';
        }
        unset($it);
        $orderId = uuid();
        $numero = nextNumero($pdo);
        $user = currentUser();
        $stmt = $pdo->prepare('INSERT INTO orders (id, numero, type, statut, table_num, client_nom, client_tel, notes, total, envoi_cuisine, served_by_id, served_by_nom, date_creation) VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)');
        $stmt->execute([
            $orderId, $numero,
            $input['type'] ?? 'sur_place',
            'NOUVELLE',
            $input['table'] ?? $input['table_num'] ?? null,
            $input['clientNom'] ?? $input['client_nom'] ?? null,
            $input['clientTel'] ?? $input['client_tel'] ?? null,
            $input['notes'] ?? null,
            $total,
            $user['id'] ?? null,
            $user['nom'] ?? null,
            now(),
        ]);
        insertOrderItems($pdo, $orderId, $items);
        // Déduction stock théorique (produits finis)
        foreach ($items as $it) {
            if (!empty($it['productId'])) {
                $pdo->prepare('UPDATE stock SET quantite = GREATEST(0, quantite - ?) WHERE product_id = ?')
                    ->execute([(int)$it['quantite'], $it['productId']]);
            }
        }
        // Déduction ingrédients selon recettes
        deduireIngredients($pdo, $items);
        $order = fetchOrderById($pdo, $orderId);
        jsonResponse($order, 201);
    }
    // PATCH /api/orders/:id
    if ($method === 'PATCH' && $id && !$sub) {
        requireAuth();
        $order = fetchOrderById($pdo, $id);
        if (!$order) jsonError('Commande introuvable', 404);
        $fields = []; $params = [];
        if (isset($input['table'])) { $fields[] = 'table_num = ?'; $params[] = $input['table']; }
        if (isset($input['notes'])) { $fields[] = 'notes = ?'; $params[] = $input['notes']; }
        if (isset($input['clientNom'])) { $fields[] = 'client_nom = ?'; $params[] = $input['clientNom']; }
        if (isset($input['clientTel'])) { $fields[] = 'client_tel = ?'; $params[] = $input['clientTel']; }
        if (isset($input['items']) && is_array($input['items'])) {
            // Remplacer les items
            $pdo->prepare('DELETE FROM order_items WHERE order_id = ?')->execute([$id]);
            $total = 0;
            foreach ($input['items'] as &$it) {
                $it['id'] = $it['id'] ?? uuid();
                $it['prix'] = (int)($it['prix'] ?? 0);
                $it['quantite'] = (int)($it['quantite'] ?? 1);
                $total += $it['prix'] * $it['quantite'];
            }
            unset($it);
            insertOrderItems($pdo, $id, $input['items']);
            $fields[] = 'total = ?'; $params[] = $total;
        }
        if ($fields) {
            $fields[] = 'date_modif = ?'; $params[] = now();
            $params[] = $id;
            $pdo->prepare('UPDATE orders SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        }
        jsonResponse(fetchOrderById($pdo, $id));
    }
    // POST /api/orders/:id/envoyer-cuisine
    if ($method === 'POST' && $id && $sub === 'envoyer-cuisine') {
        requireAuth();
        $pdo->prepare('UPDATE orders SET envoi_cuisine = 1, date_envoi_cuisine = ?, statut = IF(statut = "NOUVELLE", "CONFIRMEE", statut), date_modif = ? WHERE id = ?')
            ->execute([now(), now(), $id]);
        $user = currentUser();
        logAction(['orderId' => $id, 'utilisateur' => $user['username'], 'role' => $user['role'], 'action' => 'ENVOI_CUISINE']);
        jsonResponse(fetchOrderById($pdo, $id));
    }
    // PATCH /api/orders/:id/statut
    if ($method === 'PATCH' && $id && $sub === 'statut') {
        requireAuth();
        $statut = $input['statut'] ?? '';
        $allowed = ['NOUVELLE','CONFIRMEE','EN_PREPARATION','PRETE','TERMINEE','ANNULEE'];
        if (!in_array($statut, $allowed, true)) jsonError('Statut invalide');
        $pdo->prepare('UPDATE orders SET statut = ?, date_modif = ? WHERE id = ?')->execute([$statut, now(), $id]);
        $user = currentUser();
        logAction(['orderId' => $id, 'utilisateur' => $user['username'], 'role' => $user['role'], 'action' => 'CHANGEMENT_STATUT', 'champ' => 'statut', 'nouvelleValeur' => $statut]);
        jsonResponse(fetchOrderById($pdo, $id));
    }
    // PATCH /api/orders/:id/items/:itemId/statut
    if ($method === 'PATCH' && $id && $sub === 'items' && $itemId && ($segments[4] ?? '') === 'statut') {
        requireAuth();
        $statutItem = $input['statutItem'] ?? $input['statut'] ?? 'ATTENTE';
        $pdo->prepare('UPDATE order_items SET statut_item = ? WHERE id = ? AND order_id = ?')->execute([$statutItem, $itemId, $id]);
        // Si tous les items sont PRETE → commande PRETE
        $rest = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE order_id = ? AND statut_item != "PRETE"');
        $rest->execute([$id]);
        if ((int)$rest->fetchColumn() === 0) {
            $pdo->prepare('UPDATE orders SET statut = "PRETE", date_modif = ? WHERE id = ?')->execute([now(), $id]);
        } else {
            $pdo->prepare('UPDATE orders SET statut = "EN_PREPARATION", date_modif = ? WHERE id = ? AND statut IN ("NOUVELLE","CONFIRMEE")')->execute([now(), $id]);
        }
        jsonResponse(fetchOrderById($pdo, $id));
    }
    // DELETE /api/orders/:id
    if ($method === 'DELETE' && $id && !$sub) {
        requireRole('chef', 'assistant_chef', 'admin');
        $pdo->prepare('DELETE FROM orders WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }
    jsonError('Route orders inconnue', 404);
}

// --- RESERVATIONS ---
if ($segments[0] === 'reservations') {
    $id = $segments[1] ?? null;
    if ($method === 'POST' && !$id) {
        $rid = uuid();
        $pdo->prepare('INSERT INTO reservations (id, nom, tel, date_reservation, heure, personnes, notes) VALUES (?,?,?,?,?,?,?)')
            ->execute([
                $rid,
                $input['nom'] ?? '',
                $input['tel'] ?? '',
                $input['date'] ?? $input['date_reservation'] ?? date('Y-m-d'),
                $input['heure'] ?? '19:00',
                (int)($input['personnes'] ?? 2),
                $input['notes'] ?? null,
            ]);
        $row = $pdo->prepare('SELECT * FROM reservations WHERE id = ?');
        $row->execute([$rid]);
        jsonResponse(mapReservation($row->fetch()), 201);
    }
    if ($method === 'GET' && !$id) {
        requireAuth();
        $rows = $pdo->query('SELECT * FROM reservations ORDER BY date_reservation DESC, heure DESC')->fetchAll();
        jsonResponse(array_map('mapReservation', $rows));
    }
    if ($method === 'PATCH' && $id) {
        requireAuth();
        if (isset($input['statut'])) {
            $pdo->prepare('UPDATE reservations SET statut = ? WHERE id = ?')->execute([$input['statut'], $id]);
        }
        $row = $pdo->prepare('SELECT * FROM reservations WHERE id = ?');
        $row->execute([$id]);
        jsonResponse(mapReservation($row->fetch()));
    }
    jsonError('Route reservations inconnue', 404);
}

// --- STOCK ---
if ($segments[0] === 'stock') {
    $productId = $segments[1] ?? null;
    if ($method === 'GET' && !$productId) {
        requireAuth();
        $rows = $pdo->query('SELECT s.*, p.nom FROM stock s LEFT JOIN products p ON p.id = s.product_id')->fetchAll();
        $out = array_map(function ($r) {
            return [
                'productId' => $r['product_id'],
                'nom' => $r['nom'] ?? '',
                'quantite' => (int)$r['quantite'],
                'seuilAlerte' => (int)$r['seuil_alerte'],
            ];
        }, $rows);
        jsonResponse($out);
    }
    if ($method === 'PUT' && $productId) {
        requireRole('chef', 'assistant_chef', 'admin');
        $q = (int)($input['quantite'] ?? 0);
        $s = (int)($input['seuilAlerte'] ?? $input['seuil_alerte'] ?? 10);
        $pdo->prepare('INSERT INTO stock (product_id, quantite, seuil_alerte) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantite = VALUES(quantite), seuil_alerte = VALUES(seuil_alerte)')
            ->execute([$productId, $q, $s]);
        jsonResponse(['productId' => $productId, 'quantite' => $q, 'seuilAlerte' => $s]);
    }
    jsonError('Route stock inconnue', 404);
}

// --- INGREDIENTS ---
if ($segments[0] === 'ingredients') {
    $id = $segments[1] ?? null;
    if ($method === 'GET' && !$id) {
        requireAuth();
        $rows = $pdo->query('SELECT * FROM ingredients ORDER BY nom')->fetchAll();
        jsonResponse(array_map('mapIngredient', $rows));
    }
    if ($method === 'POST' && !$id) {
        requireRole('admin', 'chef', 'assistant_chef');
        $id = uuid();
        $pdo->prepare('INSERT INTO ingredients (id, nom, unite, quantite_stock, seuil_alerte, photo) VALUES (?,?,?,?,?,?)')
            ->execute([$id, $input['nom'] ?? '', $input['unite'] ?? 'g', (float)($input['quantiteStock'] ?? 0), (float)($input['seuilAlerte'] ?? 0), $input['photo'] ?? '']);
        $row = $pdo->prepare('SELECT * FROM ingredients WHERE id = ?');
        $row->execute([$id]);
        jsonResponse(mapIngredient($row->fetch()), 201);
    }
    if ($method === 'PUT' && $id) {
        requireRole('admin', 'chef', 'assistant_chef');
        $pdo->prepare('UPDATE ingredients SET nom=?, unite=?, quantite_stock=?, seuil_alerte=?, photo=? WHERE id=?')
            ->execute([
                $input['nom'] ?? '',
                $input['unite'] ?? 'g',
                (float)($input['quantiteStock'] ?? $input['quantite_stock'] ?? 0),
                (float)($input['seuilAlerte'] ?? $input['seuil_alerte'] ?? 0),
                $input['photo'] ?? '',
                $id,
            ]);
        $row = $pdo->prepare('SELECT * FROM ingredients WHERE id = ?');
        $row->execute([$id]);
        jsonResponse(mapIngredient($row->fetch()));
    }
    if ($method === 'DELETE' && $id) {
        requireRole('admin');
        $pdo->prepare('DELETE FROM ingredients WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }
    jsonError('Route ingredients inconnue', 404);
}

// --- USERS ---
if ($segments[0] === 'users') {
    $id = $segments[1] ?? null;
    if ($method === 'GET' && !$id) {
        requireRole('admin');
        $rows = $pdo->query('SELECT id, username, role, nom, actif, date_creation FROM users ORDER BY username')->fetchAll();
        jsonResponse(array_map(function ($u) {
            return [
                'id' => $u['id'],
                'username' => $u['username'],
                'role' => $u['role'],
                'nom' => $u['nom'],
                'actif' => (bool)$u['actif'],
                'dateCreation' => $u['date_creation'],
            ];
        }, $rows));
    }
    if ($method === 'POST' && !$id) {
        requireRole('admin');
        $id = uuid();
        $hash = password_hash($input['password'] ?? 'changeme', PASSWORD_BCRYPT);
        $pdo->prepare('INSERT INTO users (id, username, password_hash, role, nom, actif) VALUES (?,?,?,?,?,1)')
            ->execute([$id, $input['username'] ?? '', $hash, $input['role'] ?? 'serveur', $input['nom'] ?? '']);
        jsonResponse(['id' => $id, 'username' => $input['username'], 'role' => $input['role'] ?? 'serveur', 'nom' => $input['nom'] ?? '', 'actif' => true], 201);
    }
    if ($method === 'PUT' && $id) {
        requireRole('admin');
        $fields = []; $params = [];
        if (isset($input['nom'])) { $fields[] = 'nom = ?'; $params[] = $input['nom']; }
        if (isset($input['role'])) { $fields[] = 'role = ?'; $params[] = $input['role']; }
        if (isset($input['actif'])) { $fields[] = 'actif = ?'; $params[] = $input['actif'] ? 1 : 0; }
        if (!empty($input['password'])) { $fields[] = 'password_hash = ?'; $params[] = password_hash($input['password'], PASSWORD_BCRYPT); }
        if ($fields) {
            $params[] = $id;
            $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
        }
        jsonResponse(['ok' => true]);
    }
    if ($method === 'DELETE' && $id) {
        requireRole('admin');
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }
    jsonError('Route users inconnue', 404);
}

// --- DASHBOARD ---
if ($segments[0] === 'dashboard') {
    $action = $segments[1] ?? '';
    if ($method === 'GET' && $action === 'stats') {
        requireAuth();
        $today = date('Y-m-d');
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $monthStart = date('Y-m-01');

        $caJour = (int)$pdo->query("SELECT COALESCE(SUM(total),0) FROM orders WHERE DATE(date_creation) = '$today' AND statut != 'ANNULEE'")->fetchColumn();
        $caSemaine = (int)$pdo->query("SELECT COALESCE(SUM(total),0) FROM orders WHERE DATE(date_creation) >= '$weekStart' AND statut != 'ANNULEE'")->fetchColumn();
        $caMois = (int)$pdo->query("SELECT COALESCE(SUM(total),0) FROM orders WHERE DATE(date_creation) >= '$monthStart' AND statut != 'ANNULEE'")->fetchColumn();
        $nbJour = (int)$pdo->query("SELECT COUNT(*) FROM orders WHERE DATE(date_creation) = '$today' AND statut != 'ANNULEE'")->fetchColumn();
        $panierMoyen = $nbJour > 0 ? (int)round($caJour / $nbJour) : 0;

        $top = $pdo->query("SELECT oi.nom, SUM(oi.quantite) as qty FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.statut != 'ANNULEE' AND DATE(o.date_creation) >= '$monthStart' GROUP BY oi.nom ORDER BY qty DESC LIMIT 10")->fetchAll();
        $topProduits = array_map(fn($r) => ['nom' => $r['nom'], 'quantite' => (int)$r['qty']], $top);

        jsonResponse([
            'caJour' => $caJour,
            'caSemaine' => $caSemaine,
            'caMois' => $caMois,
            'nbCommandesJour' => $nbJour,
            'panierMoyen' => $panierMoyen,
            'topProduits' => $topProduits,
        ]);
    }
    if ($method === 'GET' && $action === 'logs') {
        requireAuth();
        $rows = $pdo->query('SELECT * FROM logs ORDER BY date DESC LIMIT 200')->fetchAll();
        $out = array_map(function ($r) {
            return [
                'id' => $r['id'],
                'orderId' => $r['order_id'],
                'orderNumero' => $r['order_numero'],
                'date' => $r['date'],
                'utilisateur' => $r['utilisateur'],
                'role' => $r['role'],
                'action' => $r['action'],
                'champ' => $r['champ'],
                'ancienneValeur' => $r['ancienne_valeur'],
                'nouvelleValeur' => $r['nouvelle_valeur'],
            ];
        }, $rows);
        jsonResponse($out);
    }
    jsonError('Route dashboard inconnue', 404);
}

// --- EXPORT ---
if ($segments[0] === 'export') {
    $action = $segments[1] ?? '';
    requireRole('admin', 'chef', 'assistant_chef');
    if ($method === 'GET' && $action === 'json') {
        $data = [
            'exportedAt' => now(),
            'products' => array_map('mapProduct', $pdo->query('SELECT * FROM products')->fetchAll()),
            'orders' => fetchOrders($pdo),
            'reservations' => array_map('mapReservation', $pdo->query('SELECT * FROM reservations')->fetchAll()),
            'ingredients' => array_map('mapIngredient', $pdo->query('SELECT * FROM ingredients')->fetchAll()),
            'users' => $pdo->query('SELECT id, username, role, nom, actif FROM users')->fetchAll(),
        ];
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="sauvegarde-le-bon-refuge-' . date('Y-m-d-His') . '.json"');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    if ($method === 'GET' && $action === 'excel') {
        // Export CSV simple (compatible Excel) — multi-feuilles non supporté sans lib externe
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="export-le-bon-refuge-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8
        fputcsv($out, ['Type', 'ID', 'Numero', 'Date', 'Statut', 'Total', 'Client', 'Details'], ';');
        $orders = fetchOrders($pdo);
        foreach ($orders as $o) {
            $details = implode(' | ', array_map(fn($i) => $i['quantite'] . 'x ' . $i['nom'], $o['items']));
            fputcsv($out, ['Commande', $o['id'], $o['numero'], $o['dateCreation'], $o['statut'], $o['total'], $o['clientNom'] ?? '', $details], ';');
        }
        fclose($out);
        exit;
    }
    jsonError('Route export inconnue', 404);
}

// --- UPLOAD ---
if ($segments[0] === 'upload' && $method === 'POST') {
    if (empty($_FILES['photo'])) jsonError('Aucun fichier reçu');
    $file = $_FILES['photo'];
    if ($file['error'] !== UPLOAD_ERR_OK) jsonError('Erreur upload');
    if ($file['size'] > MAX_UPLOAD_SIZE) jsonError('Fichier trop volumineux (max 5 Mo)');
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg');
    if (!in_array($ext, ['jpg','jpeg','png','gif','webp'], true)) jsonError('Format non autorisé');
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
    $name = time() . '-' . mt_rand(100000, 999999) . '.' . $ext;
    $dest = UPLOAD_DIR . '/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) jsonError('Échec enregistrement fichier');
    jsonResponse(['url' => UPLOAD_URL . '/' . $name]);
}

jsonError('Route introuvable: ' . $route, 404);

// ============================================================
// HELPERS
// ============================================================

function mapProduct(array $r): array {
    return [
        'id' => $r['id'],
        'categorie' => $r['categorie'],
        'nom' => $r['nom'],
        'description' => $r['description'],
        'prix' => (int)$r['prix'],
        'photo' => $r['photo'] ?? '',
        'poste' => $r['poste'],
        'options' => json_decode($r['options_json'] ?? '[]', true) ?: [],
        'disponible' => (bool)$r['disponible'],
        'recette' => json_decode($r['recette_json'] ?? '[]', true) ?: [],
    ];
}

function mapIngredient(array $r): array {
    return [
        'id' => $r['id'],
        'nom' => $r['nom'],
        'unite' => $r['unite'],
        'quantiteStock' => (float)$r['quantite_stock'],
        'seuilAlerte' => (float)$r['seuil_alerte'],
        'photo' => $r['photo'] ?? '',
    ];
}

function mapReservation(array $r): array {
    return [
        'id' => $r['id'],
        'nom' => $r['nom'],
        'tel' => $r['tel'],
        'date' => $r['date_reservation'],
        'heure' => substr($r['heure'], 0, 5),
        'personnes' => (int)$r['personnes'],
        'notes' => $r['notes'],
        'statut' => $r['statut'],
        'dateCreation' => $r['date_creation'],
    ];
}

function nextNumero(PDO $pdo): int {
    $today = date('Y-m-d');
    $n = $pdo->query("SELECT COUNT(*) FROM orders WHERE DATE(date_creation) = '$today'")->fetchColumn();
    return (int)$n + 1;
}

function insertOrderItems(PDO $pdo, string $orderId, array $items): void {
    $stmt = $pdo->prepare('INSERT INTO order_items (id, order_id, product_id, nom, prix, quantite, options_json, personnalisation_json, poste, statut_item) VALUES (?,?,?,?,?,?,?,?,?,?)');
    foreach ($items as $it) {
        $stmt->execute([
            $it['id'] ?? uuid(),
            $orderId,
            $it['productId'] ?? $it['product_id'] ?? null,
            $it['nom'] ?? '',
            (int)($it['prix'] ?? 0),
            (int)($it['quantite'] ?? 1),
            json_encode($it['options'] ?? [], JSON_UNESCAPED_UNICODE),
            json_encode($it['personnalisation'] ?? null, JSON_UNESCAPED_UNICODE),
            $it['poste'] ?? 'cuisine',
            $it['statutItem'] ?? $it['statut_item'] ?? 'ATTENTE',
        ]);
    }
}

function fetchOrderById(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$id]);
    $o = $stmt->fetch();
    if (!$o) return null;
    return mapOrder($pdo, $o);
}

function fetchOrders(PDO $pdo): array {
    $rows = $pdo->query('SELECT * FROM orders ORDER BY date_creation DESC LIMIT 500')->fetchAll();
    return array_map(fn($o) => mapOrder($pdo, $o), $rows);
}

function mapOrder(PDO $pdo, array $o): array {
    $items = $pdo->prepare('SELECT * FROM order_items WHERE order_id = ?');
    $items->execute([$o['id']]);
    $itemRows = $items->fetchAll();
    return [
        'id' => $o['id'],
        'numero' => (int)$o['numero'],
        'type' => $o['type'],
        'statut' => $o['statut'],
        'table' => $o['table_num'],
        'clientNom' => $o['client_nom'],
        'clientTel' => $o['client_tel'],
        'notes' => $o['notes'],
        'total' => (int)$o['total'],
        'envoiCuisine' => (bool)$o['envoi_cuisine'],
        'servedBy' => $o['served_by_id'] ? ['id' => $o['served_by_id'], 'nom' => $o['served_by_nom']] : null,
        'dateCreation' => $o['date_creation'],
        'dateModif' => $o['date_modif'],
        'dateEnvoiCuisine' => $o['date_envoi_cuisine'],
        'items' => array_map(function ($it) {
            return [
                'id' => $it['id'],
                'productId' => $it['product_id'],
                'nom' => $it['nom'],
                'prix' => (int)$it['prix'],
                'quantite' => (int)$it['quantite'],
                'options' => json_decode($it['options_json'] ?? '[]', true) ?: [],
                'personnalisation' => json_decode($it['personnalisation_json'] ?? 'null', true),
                'poste' => $it['poste'],
                'statutItem' => $it['statut_item'],
            ];
        }, $itemRows),
    ];
}

function deduireIngredients(PDO $pdo, array $items): void {
    foreach ($items as $it) {
        $pid = $it['productId'] ?? $it['product_id'] ?? null;
        if (!$pid) continue;
        $stmt = $pdo->prepare('SELECT recette_json FROM products WHERE id = ?');
        $stmt->execute([$pid]);
        $row = $stmt->fetch();
        if (!$row) continue;
        $recette = json_decode($row['recette_json'] ?? '[]', true) ?: [];
        $qte = (int)($it['quantite'] ?? 1);
        foreach ($recette as $r) {
            $ingId = $r['ingredientId'] ?? null;
            $qty = (float)($r['quantite'] ?? 0) * $qte;
            if ($ingId && $qty > 0) {
                $pdo->prepare('UPDATE ingredients SET quantite_stock = GREATEST(0, quantite_stock - ?) WHERE id = ?')
                    ->execute([$qty, $ingId]);
            }
        }
    }
}
?>
