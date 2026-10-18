const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration du dossier /uploads pour rendre les fichiers téléversés accessibles en HTTP
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_DIR));

// Configuration de Multer pour le stockage des fichiers (photos & vidéos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'file-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Redirection racine vers la page de login admin
app.get('/', (req, res) => {
    res.redirect('/admin/login.html');
});

// ================= ROUTE UPLOAD DE FICHIERS (PHOTOS / VIDÉOS) =================
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "Aucun fichier reçu." });
    }
    const filepath = '/uploads/' + req.file.filename;
    res.json({ success: true, filepath });
});

// ================= ACTUALITÉS & ÉVÉNEMENTS =================
app.get('/api/news', (req, res) => {
    db.all(`SELECT * FROM news ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/news', (req, res) => {
    const { title, content, image } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: "Le titre et le contenu sont obligatoires." });
    }

    const query = `INSERT INTO news (title, content, image) VALUES (?, ?, ?)`;
    db.run(query, [title, content, image || ''], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const newPost = {
            id: this.lastID,
            title,
            content,
            image: image || '',
            created_at: new Date().toISOString()
        };

        // Diffusion en temps réel vers la page d'accueil
        io.emit('new_post_published', newPost);

        res.json({ success: true, post: newPost, message: "Actualité / Événement publié avec succès !" });
    });
});

// ================= AUTHENTIFICATION ADMIN =================
app.post('/api/admin/login', (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Identifiant et mot de passe requis." });
    }
    const query = `SELECT * FROM admins WHERE (custom_id = ? OR telephone = ?) AND password = ?`;
    db.get(query, [identifier, identifier, password], (err, admin) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!admin) {
            return res.status(401).json({ success: false, error: "Identifiant ou mot de passe incorrect." });
        }
        res.json({ success: true, message: "Connexion réussie", admin: { id: admin.custom_id, nom: admin.nom, role: admin.role, email: admin.email } });
    });
});

// ================= ABONNÉS & LISTE DE LA DB =================
app.get('/api/abonnes', (req, res) => {
    db.all(`SELECT * FROM abonnes ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/subscribe', (req, res) => {
    const { nom, email, telephone } = req.body;
    
    if (!nom || !email) {
        return res.status(400).json({ error: "Le nom et l'email sont obligatoires." });
    }

    const query = `INSERT INTO abonnes (nom, email, telephone) VALUES (?, ?, ?)`;
    db.run(query, [nom, email, telephone || ''], function(err) {
        if (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: "Cet email est déjà enregistré." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: "Abonnement enregistré avec succès !" });
    });
});

// ================= DONS & CAMPAGNES DE COLLECTE =================
app.get('/api/dons', (req, res) => {
    db.all(`SELECT * FROM dons ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/dons', (req, res) => {
    const { donateur, montant, devise, campagne, moyen_paiement } = req.body;
    const query = `INSERT INTO dons (donateur, montant, devise, campagne, moyen_paiement) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [donateur || 'Anonyme', montant, devise || 'USD', campagne, moyen_paiement], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Don enregistré avec succès !" });
    });
});

app.get('/api/campagnes', (req, res) => {
    db.all(`SELECT * FROM campagnes_don ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/campagnes', (req, res) => {
    const { titre, objectif, moyen_paiement, description } = req.body;
    const query = `INSERT INTO campagnes_don (titre, objectif, moyen_paiement, description) VALUES (?, ?, ?, ?)`;
    db.run(query, [titre, objectif, moyen_paiement, description], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Campagne de don créée avec succès !" });
    });
});

// ================= COMMENTAIRES & AVIS =================
// ================= COMMENTAIRES & AVIS =================

// Route pour récupérer tous les commentaires (pour l'administration)
app.get('/api/commentaires', (req, res) => {
    db.all(`SELECT * FROM commentaires_avis ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Route dédiée pour récupérer uniquement les avis approuvés (pour la page d'accueil)
app.get('/api/commentaires/approuves', (req, res) => {
    db.all(`SELECT * FROM commentaires_avis WHERE LOWER(statut) IN ('approuvé', 'approuve', 'approved', 'validé', 'valide') ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

// Route pour enregistrer un nouvel avis
app.post('/api/commentaires', (req, res) => {
    const { auteur, nom, contenu, commentaire, note } = req.body;
    
    const finalAuteur = auteur || nom;
    const finalContenu = contenu || commentaire;

    if (!finalAuteur || !finalContenu) {
        return res.status(400).json({ success: false, error: "L'auteur et le contenu sont obligatoires." });
    }

    const query = `INSERT INTO commentaires_avis (auteur, nom, contenu, commentaire, note, statut) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(query, [finalAuteur, finalAuteur, finalContenu, finalContenu, note || '5', 'en-attente'], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, message: "Avis enregistré avec succès, en attente de validation par l'administration." });
    });
});

// Route pour mettre à jour le statut d'un avis (validation admin)
app.post('/api/commentaires/statut', (req, res) => {
    const { id, statut } = req.body;
    db.run(`UPDATE commentaires_avis SET statut = ? WHERE id = ?`, [statut, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Statut mis à jour !" });
    });
});
// ================= MULTIMÉDIA & STREAMING (MINI TV & STUDIO) =================
app.get('/api/multimedia', (req, res) => {
    db.all(`SELECT * FROM multimedia_stream ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/multimedia', (req, res) => {
    const { titre, description, url_media, type_media, statut, start_time, end_time } = req.body;
    const query = `INSERT INTO multimedia_stream (titre, description, url_media, type_media, statut, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [titre, description || '', url_media, type_media, statut || 'hors-ligne', start_time || null, end_time || null], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        io.emit('tv_signal_updated', { titre, url_media, statut });

        res.json({ success: true, id: this.lastID, message: "Programme / Flux mis à jour avec succès !" });
    });
});

app.get('/api/tv/status', (req, res) => {
    db.get(`SELECT * FROM multimedia_stream WHERE (type_media = 'tv' OR type_media = 'obs' OR type_media = 'live') AND statut = 'en-direct' ORDER BY created_at DESC LIMIT 1`, [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            res.json({
                isLive: true,
                title: row.titre,
                description: row.description,
                streamUrl: row.url_media
            });
        } else {
            res.json({
                isLive: false,
                title: "Aucun direct en cours",
                description: "Consultez le programme officiel pour la prochaine diffusion.",
                streamUrl: ""
            });
        }
    });
});

// --- ROUTES DU STUDIO DE NOTIFICATIONS & ANALYTICS ---

// 1. Récupérer les statistiques et l'historique des campagnes du studio
app.get('/api/admin/studio/analytics', async (req, res) => {
    try {
        // Récupérer le nombre total d'abonnés
        db.all("SELECT COUNT(*) as total FROM abonnes", [], async (err, subRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            const totalSubscribers = subRows[0] ? subRows[0].total : 0;

            // Récupérer les campagnes enregistrées (ou simuler si la table n'existe pas encore)
            db.all("SELECT * FROM campaigns ORDER BY id DESC", [], (err, campaigns) => {
                // Si la table campaigns n'est pas encore créée, on renvoie une liste vide par défaut
                const campList = (err || !campaigns) ? [] : campaigns;
                const scheduledCount = campList.filter(c => c.status === 'scheduled').length;
                const lastReached = campList.length > 0 ? campList[0].reachedCount : 0;

                res.json({
                    totalSubscribers,
                    lastReachedCount: lastReached,
                    scheduledCount,
                    campaigns: campList
                });
            });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Diffuser ou programmer une campagne de notification
app.post('/api/admin/studio/broadcast', async (req, res) => {
    const { title, message, mode, scheduleTime, target } = req.body;

    if (!title || !message) {
        return res.status(400).json({ error: "Le titre et le message sont requis." });
    }

    // Vérifier ou créer la table campaigns si elle n'existe pas
    db.run(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT,
        target TEXT,
        status TEXT,
        scheduleTime TEXT,
        reachedCount INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, async (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Compter les abonnés ciblés
        db.get("SELECT COUNT(*) as count FROM abonnes", [], (err, row) => {
            const reachedCount = row ? row.count : 0;
            const status = (mode === 'schedule') ? 'scheduled' : 'broadcasted';

            // Insérer la campagne dans SQLite
            const query = `INSERT INTO campaigns (title, message, target, status, scheduleTime, reachedCount) VALUES (?, ?, ?, ?, ?, ?)`;
            db.run(query, [title, message, target, status, scheduleTime || '', reachedCount], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Si Socket.io est configuré globalement, émettre l'événement en temps réel
                if (typeof io !== 'undefined') {
                    io.emit('notification_received', { title, message, target });
                }

                res.json({
                    success: true,
                    message: "Campagne traitée avec succès",
                    reachedCount,
                    campaignId: this.lastID
                });
            });
        });
    });
});



// --- ROUTES DE RÉCUPÉRATION ET CONFIRMATION DES NOTIFICATIONS ---

// 1. Récupérer les notifications actives/diffusées pour les utilisateurs
app.get('/api/notifications', async (req, res) => {
    try {
        db.all("SELECT * FROM campaigns WHERE status = 'broadcasted' ORDER BY id DESC", [], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(rows || []);
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Confirmer la réception d'une notification en temps réel (Incrémente les vues/portée)
app.post('/api/notifications/confirmer', async (req, res) => {
    const { campaignId } = req.body;

    if (!campaignId) {
        return res.status(400).json({ error: "L'ID de la campagne est requis." });
    }

    // Incrémenter le compteur reachedCount dans la base de données SQLite
    db.run("UPDATE campaigns SET reachedCount = reachedCount + 1 WHERE id = ?", [campaignId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Informer instantanément l'admin via Socket.io que les stats ont changé
        if (typeof io !== 'undefined') {
            io.emit('notification_stat_updated', { campaignId });
        }

        res.json({ 
            success: true, 
            message: "Réception confirmée et prise en compte en temps réel." 
        });
    });
});


app.post('/api/user/notifications/read-all', async (req, res) => {
    try {
        db.run("UPDATE campaigns SET isRead = 1", [], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Toutes les notifications ont été marquées comme lues." });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});// =========================================================================
// 1. ROUTE : DEMANDE DE PARTENARIAT (Physique, Moral / Institutionnel, Financier)
// =========================================================================
app.post('/api/partenariats', async (req, res) => {
    const { nom, organisation, type_partenaire, domaine_action, email, telephone, message } = req.body;

    if (!nom || !type_partenaire || (!email && !telephone) || !message) {
        return res.status(400).json({ 
            error: "Veuillez remplir les champs requis (Nom, Type de partenaire, Contact et Message)." 
        });
    }

    db.run(`CREATE TABLE IF NOT EXISTS partenariats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        organisation TEXT,
        type_partenaire TEXT NOT NULL, -- 'physique', 'moral', 'financier'
        domaine_action TEXT,
        email TEXT,
        telephone TEXT,
        message TEXT NOT NULL,
        statut TEXT DEFAULT 'en_attente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const sql = `INSERT INTO partenariats (nom, organisation, type_partenaire, domaine_action, email, telephone, message) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [nom, organisation || 'Individuel', type_partenaire, domaine_action || 'Général', email || '', telephone || '', message], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const idDossier = this.lastID;
            if (typeof io !== 'undefined') {
                io.emit('new_partnership_submitted', { id: idDossier, nom, type_partenaire, organisation });
            }

            res.status(201).json({
                success: true,
                message: `Demande de partenariat #${idDossier} soumise avec succès ! Nos équipes vous recontacteront.`,
                reference: `PART-${idDossier}`
            });
        });
    });
});


// =========================================================================
// 2. ROUTE : DOSSIER D'INVESTISSEMENT (Intérêt annuel garanti à 15%)
// =========================================================================
app.post('/api/investissements', async (req, res) => {
    const { nom, email, telephone, secteur, montant, duree_annees, projet_specifique } = req.body;

    const montantNum = parseFloat(montant);
    const dureeNum = parseInt(duree_annees) || 1;

    if (!nom || (!email && !telephone) || !secteur || isNaN(montantNum) || montantNum <= 0) {
        return res.status(400).json({ 
            error: "Veuillez fournir un nom, un contact valide, le secteur d'investissement et un montant valide." 
        });
    }

    // Calcul officiel des intérêts (15% par an)
    const tauxAnnuel = 0.15;
    const profitAnnuel = montantNum * tauxAnnuel;
    const profitTotal = profitAnnuel * dureeNum;
    const capitalTotalAEcheance = montantNum + profitTotal;

    db.run(`CREATE TABLE IF NOT EXISTS investissements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        email TEXT,
        telephone TEXT,
        secteur TEXT NOT NULL, -- 'technologie', 'finance', 'education', 'ressources', etc.
        montant REAL NOT NULL,
        duree_annees INTEGER DEFAULT 1,
        profit_annuel REAL NOT NULL,
        profit_total REAL NOT NULL,
        montant_final REAL NOT NULL,
        projet_specifique TEXT,
        statut TEXT DEFAULT 'en_etude',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) return res.status(500).json({ error: err.message });

        const sql = `INSERT INTO investissements 
            (nom, email, telephone, secteur, montant, duree_annees, profit_annuel, profit_total, montant_final, projet_specifique) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [nom, email || '', telephone || '', secteur, montantNum, dureeNum, profitAnnuel, profitTotal, capitalTotalAEcheance, projet_specifique || ''];

        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const idInvest = this.lastID;
            if (typeof io !== 'undefined') {
                io.emit('new_investment_submitted', { id: idInvest, nom, secteur, montant: montantNum, profitAnnuel });
            }

            res.status(201).json({
                success: true,
                message: `Dossier d'investissement #${idInvest} souscrit avec succès !`,
                details: {
                    reference: `INV-${idInvest}`,
                    montantInvesti: `$${montantNum.toFixed(2)}`,
                    profitAnnuelEstime: `$${profitAnnuel.toFixed(2)}`,
                    profitTotalEstime: `$${profitTotal.toFixed(2)}`,
                    totalAEcheance: `$${capitalTotalAEcheance.toFixed(2)}`
                }
            });
        });
    });
});


// --- ROUTE ADMIN : RÉCUPÉRER TOUS LES INVESTISSEMENTS ---
app.get('/api/admin/investissements', async (req, res) => {
    db.all("SELECT * FROM investissements ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// 1. Route pour l'administrateur : Récupérer toutes les demandes de partenariat
app.get('/api/admin/partenariats', async (req, res) => {
    db.all("SELECT * FROM partenariats ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// 2. Route publique (optionnelle) : Récupérer uniquement les partenaires approuvés ou validés
app.get('/api/partenariats/public', async (req, res) => {
    db.all("SELECT id, nom, organisation, type_partenaire, domaine_action FROM partenariats WHERE statut = 'approuve' ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});



// --- ROUTE POUR CONFIRMER LA RÉCEPTION ET RÉPONDRE À UNE DEMANDE ---
// --- ROUTE POUR CONFIRMER LA RÉCEPTION ET RÉPONDRE À UNE DEMANDE ---
app.post('/api/admin/repondre-dossier', (req, res) => {
    const { id, type, reponse_admin } = req.body; 

    if (!id || !type || !reponse_admin) {
        return res.status(400).json({ error: "L'identifiant, le type et le message de réponse sont requis." });
    }

    const table = type === 'partenariat' ? 'partenariats' : 'investissements';

    // 1. S'assurer que la colonne 'reponse_admin' existe dans la table (évite l'erreur SQLITE_ERROR)
    db.run(`ALTER TABLE ${table} ADD COLUMN reponse_admin TEXT`, (altErr) => {
        // Si la colonne existe déjà, SQLite renvoie une erreur qu'on peut ignorer en toute sécurité
        
        // 2. Mettre à jour le statut et la réponse
        const sql = `UPDATE ${table} SET statut = 'confirme_et_repondu', reponse_admin = ? WHERE id = ?`;

        db.run(sql, [reponse_admin, id], function(err) {
            if (err) {
                console.error("Erreur mise à jour dossier:", err);
                return res.status(500).json({ error: "Erreur lors de la confirmation du dossier." });
            }

            // 3. Transmettre le signal en temps réel via Socket.io
            if (typeof io !== 'undefined') {
                io.emit('dossier_repondu', {
                    type,
                    id,
                    reponse: reponse_admin,
                    updatedAt: new Date()
                });
            }

            res.json({
                success: true,
                message: `Accusé de réception et réponse enregistrés avec succès pour le dossier #${type.toUpperCase()}-${id} !`,
                dossierId: id
            });
        });
    });
});

// ================= MESSAGES & SUPPORT ISOLÉS PAR CONTACT =================
app.get('/api/messages', (req, res) => {
    db.all(`SELECT * FROM messages ORDER BY created_at ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/messages/repondre', (req, res) => {
    const { sender, receiver, contact, message, sender_type } = req.body;
    const targetContact = contact || receiver;

    if (!targetContact || !message) {
        return res.status(400).json({ error: "Contact et message requis." });
    }

    const query = `INSERT INTO messages (sender, receiver, contact, message, sender_type) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [sender || 'Admin FAFHEVD', receiver || targetContact, targetContact, message, sender_type || 'admin'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        io.to(`chat_${targetContact}`).emit('receive_message', {
            sender: sender || 'Admin FAFHEVD',
            contact: targetContact,
            text: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender_type: 'admin'
        });

        res.json({ success: true, message: "Réponse envoyée !" });
    });
});

// ================= WEBSOCKET (SOCKET.IO) =================
io.on('connection', (socket) => {
    console.log(`⚡ Un utilisateur s'est connecté : ${socket.id}`);

    socket.on('user_join', (userData) => {
        socket.join('support');
        socket.join('subscribers');
        if (userData.email) {
            socket.join(`chat_${userData.email}`);
        }
    });

    socket.on('join_chat_room', (contactKey) => {
        if (contactKey) {
            socket.join(`chat_${contactKey}`);
        }
    });

    socket.on('send_message', (data) => {
        const senderType = data.sender_type || 'user';
        const contactKey = data.email || data.contact;

        const query = `INSERT INTO messages (sender, receiver, contact, message, sender_type) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [data.sender, 'Support', contactKey, data.text, senderType], (err) => {
            if (err) console.error("Erreur d'enregistrement du message en BD :", err.message);
        });

        io.to(`chat_${contactKey}`).emit('receive_message', {
            sender: data.sender,
            contact: contactKey,
            text: data.text,
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender_type: senderType
        });
        
        io.to('support').emit('receive_message', {
            sender: data.sender,
            contact: contactKey,
            text: data.text,
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sender_type: senderType
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Utilisateur déconnecté : ${socket.id}`);
    });
});

// Lancement du serveur
server.listen(PORT, () => {
    console.log(`🚀 Serveur pro temps réel démarré sur http://localhost:${PORT}`);
});