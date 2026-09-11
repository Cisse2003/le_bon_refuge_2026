<?php
require_once __DIR__ . '/db.php';

// Fixe la durée du cookie de session à 30 jours (2 592 000 secondes)
ini_set('session.cookie_lifetime', 2592000);
ini_set('session.gc_maxlifetime', 2592000);

// Assure la persistance du cookie sur le navigateur
session_set_cookie_params([
    'lifetime' => 2592000,
    'path' => '/',
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

/**
 * Démarrage sécurisé de la session PHP
 */
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

/**
 * Récupère l'utilisateur connecté en session
 */
function currentUser(): ?array {
    startSession();
    return $_SESSION['user'] ?? null;
}

/**
 * Bloque l'accès si l'utilisateur n'est pas connecté
 */
function requireAuth(): array {
    $user = currentUser();
    if (!$user) {
        jsonError('Non authentifié', 401);
    }
    return $user;
}

/**
 * Bloque l'accès si l'utilisateur n'a pas l'un des rôles autorisés
 */
function requireRole(string ...$roles): array {
    $user = requireAuth();
    if (!in_array($user['role'], $roles, true)) {
        jsonError('Accès refusé pour ce rôle', 403);
    }
    return $user;
}

/**
 * Enregistre une action dans la table `logs`
 *
 * @param array $params Tableau contenant les informations à insérer
 *  - orderId (string|null)
 *  - orderNumero (string|null)
 *  - utilisateur (string)
 *  - role (string)
 *  - action (string)
 *  - champ (string|null)
 *  - ancienneValeur (mixed)
 *  - nouvelleValeur (mixed)
 */
function logAction(array $params): void {
    try {
        $pdo = getDB();
        $stmt = $pdo->prepare('
            INSERT INTO logs (
                id, 
                order_id, 
                order_numero, 
                date, 
                utilisateur, 
                role, 
                action, 
                champ, 
                ancienne_valeur, 
                nouvelle_valeur
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $stmt->execute([
            uuid(),
            $params['orderId'] ?? null,
            $params['orderNumero'] ?? null,
            now(),
            $params['utilisateur'] ?? '',
            $params['role'] ?? '',
            $params['action'] ?? '',
            $params['champ'] ?? null,
            isset($params['ancienneValeur'])
                ? (is_scalar($params['ancienneValeur']) ? (string)$params['ancienneValeur'] : json_encode($params['ancienneValeur']))
                : null,
            isset($params['nouvelleValeur'])
                ? (is_scalar($params['nouvelleValeur']) ? (string)$params['nouvelleValeur'] : json_encode($params['nouvelleValeur']))
                : null,
        ]);
    } catch (\Throwable $e) {
        // Optionnel : enregistrer l'erreur dans les logs PHP pour éviter de bloquer l'exécution de l'application
        error_log("Erreur lors de l'enregistrement de l'action : " . $e->getMessage());
    }
}