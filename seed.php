
<?php


require_once __DIR__ . '/includes/db.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    // Connexion à la base de données existante
    $pdo = getDB();

    // Récupérer la définition actuelle de la colonne role
    $stmt = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'role'");
    $colonne = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$colonne) {
        throw new RuntimeException(
            "La colonne 'role' n'existe pas dans la table 'users'."
        );
    }

    $type = $colonne['Type'];

    // Si role est un ENUM, ajouter cuisinier aux valeurs autorisées
    if (stripos($type, 'enum(') === 0) {
        preg_match_all("/'((?:[^'\\\\]|\\\\.)*)'/", $type, $matches);

        $roles = $matches[1] ?? [];

        if (!in_array('cuisinier', $roles, true)) {
            $roles[] = 'cuisinier';

            $valeurs = implode(
                ', ',
                array_map(
                    static fn($role) => $pdo->quote($role),
                    $roles
                )
            );

            $sql = "ALTER TABLE `users`
                    MODIFY COLUMN `role` ENUM($valeurs)";

            // Préserver les attributs existants de la colonne
            if (stripos($colonne['Null'], 'NO') === 0) {
                $sql .= " NOT NULL";
            } else {
                $sql .= " NULL";
            }

            if ($colonne['Default'] !== null) {
                $sql .= " DEFAULT " . $pdo->quote($colonne['Default']);
            }

            $pdo->exec($sql);

            echo "Succès : le rôle 'cuisinier' a été ajouté à la colonne users.role.\n";
        } else {
            echo "Le rôle 'cuisinier' est déjà autorisé dans la colonne users.role.\n";
        }
    } else {
        echo "La colonne users.role n'est pas un ENUM.\n";
        echo "Type actuel : " . $type . "\n";
        echo "Aucune modification effectuée : ce type de colonne accepte peut-être déjà le rôle.\n";
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo "Erreur : " . $e->getMessage();
}