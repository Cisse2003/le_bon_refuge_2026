
<?php
// seed.php - Afficher les 30 dernières sessions utilisateur

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    $sql = "
        SELECT
    id,
    user_id,
    login_at,
    logout_at
FROM user_sessions
WHERE login_at > NOW()
ORDER BY login_at ASC;
    ";

    $stmt = $pdo->query($sql);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<pre>";
    print_r($sessions);
    echo "</pre>";

} catch (PDOException $e) {
    die("Erreur SQL : " . $e->getMessage());
}
