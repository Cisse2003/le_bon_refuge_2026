<?php
require_once __DIR__ . '/db.php';

function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name(SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 12 * 3600,
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function currentUser(): ?array {
    startSession();
    return $_SESSION['user'] ?? null;
}

function requireAuth(): array {
    $user = currentUser();
    if (!$user) {
        jsonError('Non authentifié', 401);
    }
    return $user;
}

function requireRole(string ...$roles): array {
    $user = requireAuth();
    if (!in_array($user['role'], $roles, true)) {
        jsonError('Accès refusé pour ce rôle', 403);
    }
    return $user;
}

function logAction(array $params): void {
    $pdo = getDB();
    $stmt = $pdo->prepare('INSERT INTO logs (id, order_id, order_numero, date, utilisateur, role, action, champ, ancienne_valeur, nouvelle_valeur)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        uuid(),
        $params['orderId'] ?? null,
        $params['orderNumero'] ?? null,
        now(),
        $params['utilisateur'] ?? '',
        $params['role'] ?? '',
        $params['action'] ?? '',
        $params['champ'] ?? null,
        isset($params['ancienneValeur']) ? (is_scalar($params['ancienneValeur']) ? (string)$params['ancienneValeur'] : json_encode($params['ancienneValeur'])) : null,
        isset($params['nouvelleValeur']) ? (is_scalar($params['nouvelleValeur']) ? (string)$params['nouvelleValeur'] : json_encode($params['nouvelleValeur'])) : null,
    ]);
}
?>
