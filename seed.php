
<?php
// seed.php - Afficher les 30 dernières sessions utilisateur

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    $sql = "
        SELECT
    NOW() AS heure_mysql,
    CURDATE() AS date_mysql,
    MAX(login_at) AS derniere_connexion,
    COUNT(*) AS nombre_sessions
FROM user_sessions;
    ";

    $stmt = $pdo->query($sql);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "<pre>";
    print_r($sessions);
    echo "</pre>";

} catch (PDOException $e) {
    die("Erreur SQL : " . $e->getMessage());
}
