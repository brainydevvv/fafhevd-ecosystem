const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connexion / Création du fichier de base de données
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error("Erreur de connexion à la base de données :", err.message);
    } else {
        console.log("Connecté à la base de données SQLite.");
    }
});

// Création des tables et insertion des données par défaut
db.serialize(() => {

    // 1. TABLE ADMINS (Staff administratif et rôles)
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custom_id TEXT UNIQUE NOT NULL,
        nom TEXT NOT NULL,
        telephone TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'support',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        // Insertion automatique des admins par défaut s'ils n'existent pas encore
        const defaultAdmins = [
            {
                custom_id: 'f624122002',
                nom: 'Bienfait Bahati',
                telephone: '+243838719901',
                email: 'FAFHEVD2015@gmail.com',
                password: 'fafhevd2026',
                role: 'admin'
            },
            {
                custom_id: 'f624122003',
                nom: 'Byemba Kamundala',
                telephone: '+243975483774',
                email: 'amundalabrainy2@gmail.com',
                password: 'fafhevd2026',
                role: 'support'
            }
        ];

        defaultAdmins.forEach(adm => {
            db.get(`SELECT id FROM admins WHERE email = ?`, [adm.email], (err, row) => {
                if (!row) {
                    db.run(
                        `INSERT INTO admins (custom_id, nom, telephone, email, password, role) VALUES (?, ?, ?, ?, ?, ?)`,
                        [adm.custom_id, adm.nom, adm.telephone, adm.email, adm.password, adm.role],
                        (err) => {
                            if (!err) console.log(`Admin par défaut ajouté : ${adm.nom} (${adm.role})`);
                        }
                    );
                }
            });
        });
    });

    // 2. TABLE ABONNES (Utilisateurs abonnés de la plateforme)
    db.run(`CREATE TABLE IF NOT EXISTS abonnes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        telephone TEXT,
        statut TEXT DEFAULT 'actif',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 3. TABLE MESSAGES (Chat interactif entre abonnés et service client/admin)
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        contact TEXT NOT NULL,
        message TEXT NOT NULL,
        sender_type TEXT NOT NULL, -- 'user' ou 'admin'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. TABLE NEWS (Actualités et annonces officielles)
    db.run(`CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. TABLE COMMENTAIRES & AVIS (Pour les streams, articles, retours utilisateurs)
    db.run(`CREATE TABLE IF NOT EXISTS commentaires_avis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    auteur TEXT,
    type_cible TEXT DEFAULT 'plateforme', 
    cible_id INTEGER,
    commentaire TEXT NOT NULL,
    contenu TEXT,
    note INTEGER CHECK(note BETWEEN 1 AND 5),
    statut TEXT DEFAULT 'en-attente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

    // TABLE CAMPAGNES DE DON
    db.run(`CREATE TABLE IF NOT EXISTS campagnes_don (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT NOT NULL,
        objectif REAL NOT NULL,
        moyen_paiement TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLE DONS REÇUS
    db.run(`CREATE TABLE IF NOT EXISTS dons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        donateur TEXT DEFAULT 'Anonyme',
        montant REAL NOT NULL,
        devise TEXT DEFAULT 'USD',
        campagne TEXT,
        moyen_paiement TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. TABLE MULTIMEDIA & STREAMING (Mini TV, vidéos, flux en direct)
    db.run(`CREATE TABLE IF NOT EXISTS multimedia_stream (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT NOT NULL,
        description TEXT,
        url_media TEXT NOT NULL,
        type_media TEXT NOT NULL, -- 'live', 'video', 'podcast', 'tv', 'obs'
        statut TEXT DEFAULT 'hors-ligne',
        vues INTEGER DEFAULT 0,
        start_time TEXT,
        end_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 7. TABLE MEDIA (Gestion des fichiers, images et documents uploadés)
    db.run(`CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mimetype TEXT,
        size INTEGER,
        uploaded_by TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 8. TABLE NOTIFICATIONS (Studio de notifications et alertes abonnés)
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        target_audience TEXT DEFAULT 'all',
        reached_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'sent',
        schedule_time TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

});

module.exports = db;