import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// --- CONFIGURATION CHEMINS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// --- BASE DE DONNÉES ---
// Rappel : avec Docker Compose, le volume est monté sur /app/data
const db = new Database(path.join(__dirname, '../data/quantities.db'));

// Création des tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
                                         id INTEGER PRIMARY KEY AUTOINCREMENT,
                                         name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS columns (
                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                           name TEXT NOT NULL,
                                           status TEXT CHECK(status IN ('open', 'locked')) NOT NULL DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

    CREATE TABLE IF NOT EXISTS entries (
                                           id INTEGER PRIMARY KEY AUTOINCREMENT,
                                           user_id INTEGER NOT NULL,
                                           row_number TEXT NOT NULL,
                                           column_id INTEGER NOT NULL,
                                           quantity INTEGER NOT NULL DEFAULT 0,
                                           UNIQUE(user_id, row_number, column_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(column_id) REFERENCES columns(id)
        );
`);

// Initialisation
const initDb = () => {
    const colCount = db.prepare('SELECT COUNT(*) as count FROM columns').get();
    if (colCount.count === 0) {
        db.prepare("INSERT INTO columns (name, status) VALUES (?, 'open')").run('Qte Initiale');
    }
};
initDb();

// --- ROUTES API ---

app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
});

app.post('/api/users', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nom requis" });
    const stmt = db.prepare('INSERT INTO users (name) VALUES (?)');
    const info = stmt.run(name);
    res.json({ id: info.lastInsertRowid, name });
});

app.get('/api/columns', (req, res) => {
    const columns = db.prepare('SELECT * FROM columns ORDER BY id ASC').all();
    res.json(columns);
});

app.get('/api/user/:userId/entries', (req, res) => {
    const entries = db.prepare('SELECT * FROM entries WHERE user_id = ?').all(req.params.userId);
    res.json(entries);
});

app.post('/api/entries', (req, res) => {
    const { user_id, row_number, column_id, quantity } = req.body;
    const column = db.prepare("SELECT status FROM columns WHERE id = ?").get(column_id);
    if (!column || column.status !== 'open') {
        return res.status(403).json({ error: 'Colonne verrouillée' });
    }
    const stmt = db.prepare(`
        INSERT INTO entries (user_id, row_number, column_id, quantity)
        VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, row_number, column_id) 
        DO UPDATE SET quantity = excluded.quantity
    `);
    stmt.run(user_id, row_number, column_id, quantity);
    res.json({ success: true });
});

app.get('/api/admin/entries', (req, res) => {
    const data = db.prepare(`
        SELECT row_number, column_id, SUM(quantity) as total_quantity
        FROM entries
        GROUP BY row_number, column_id
    `).all();
    res.json(data);
});

app.post('/api/admin/columns/action', (req, res) => {
    const openColumn = db.prepare("SELECT id, name FROM columns WHERE status = 'open' LIMIT 1").get();
    if (!openColumn) return res.status(400).json({ error: 'Pas de colonne active' });

    const runAction = db.transaction(() => {
        db.prepare("UPDATE columns SET status = 'locked' WHERE id = ?").run(openColumn.id);
        const match = openColumn.name.match(/Saisie (\d+)/);
        const nextNumber = match ? parseInt(match[1], 10) + 1 : 1;
        const newName = openColumn.name === 'Qte Initiale' ? 'Saisie 1' : `Saisie ${nextNumber}`;
        db.prepare("INSERT INTO columns (name, status) VALUES (?, 'open')").run(newName);
    });

    runAction();
    res.json({ success: true });
});

// --- SERVIR LE FRONTEND (PROD) ---
const distPath = path.join(__dirname, '../dist');

// Servir les fichiers statiques (js, css, images)
app.use(express.static(distPath));

// Route de fallback pour le Single Page Application (SPA)
// Remplacement de /:splat* par * pour éviter l'erreur PathError
app.get('*', (req, res) => {
    // Si c'est une requête vers /api qui n'a pas été capturée plus haut
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
    }

    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Serveur prêt sur le port ${port}`);
});