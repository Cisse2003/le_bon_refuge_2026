
<?php
// test_sessions.php — Afficher les sessions du mois en cours

require_once __DIR__ . '/includes/db.php';

try {
    $pdo = getDB();

    // Déterminer le mois en cours.
    $mois = date('Y-m');

    $debutMois = $mois . '-01 00:00:00';

    $debutMoisSuivant = date(
        'Y-m-d H:i:s',
        strtotime($debutMois . ' +1 month')
    );

    $sql = "
        SELECT id, user_id, login_at, logout_at
        FROM user_sessions
        WHERE login_at >= :debut_mois
          AND login_at < :debut_mois_suivant
        ORDER BY login_at DESC
    ";

    // Préparer la requête et transmettre les paramètres.
    $stmt = $pdo->prepare($sql);

    $stmt->execute([
        'debut_mois' => $debutMois,
        'debut_mois_suivant' => $debutMoisSuivant
    ]);

    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo '<pre>';
    print_r($sessions);
    echo '</pre>';

} catch (PDOException $e) {
    die('Erreur SQL : ' . htmlspecialchars($e->getMessage()));
}
