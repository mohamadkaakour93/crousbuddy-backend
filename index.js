import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import cors from 'cors';
import userRoutes from './routes/user.js';
import attestationRoutes from './routes/attestaion.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Résolution de __dirname pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



dotenv.config();

const app = express();

// Vérification des variables d'environnement
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error('Les variables d\'environnement MONGO_URI ou JWT_SECRET sont manquantes.');
    process.exit(1);
}

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connecté à MongoDB Atlas'))
    .catch(err => {
        console.error('❌ Erreur de connexion à MongoDB Atlas :', err.message);
        process.exit(1); // Arrête l'application si la connexion échoue
    });


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/attestation', attestationRoutes);

// Servir les PDFs statiques
app.use('/attestations', express.static(path.join(__dirname, 'attestations')));



// Middleware global pour gérer les erreurs
app.use((err, req, res, next) => {
    console.error('Erreur non gérée :', err.message);
    res.status(500).json({ message: 'Une erreur interne est survenue.' });
});

// Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));
