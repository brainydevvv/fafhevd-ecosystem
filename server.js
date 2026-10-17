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