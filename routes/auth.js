import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { check, validationResult } from 'express-validator';
import nodemailer from "nodemailer";
import User from '../models/User.js';

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: '804025002@smtp-brevo.com',
    pass: 'q4mj6RNO507thbTW',
  },
});

// Middleware pour vérifier le token JWT
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ message: 'Token manquant. Accès non autorisé.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide.' });
    }
};

// Route Signup
router.post(
    '/signup',
    [
        check('email', 'Veuillez fournir un email valide').isEmail(),
        check('password', 'Le mot de passe doit contenir au moins 6 caractères').isLength({ min: 6 }),
        check('preferences.city', 'La ville est obligatoire').notEmpty(),
        check('preferences.occupationModes', 'Mode d\'occupation invalide').isIn(['house_sharing', 'alone', 'couple'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, preferences } = req.body;

        try {
            // Vérifier si l'utilisateur existe déjà
            let user = await User.findOne({ email });
            if (user) {
                return res.status(400).json({ message: 'Utilisateur déjà enregistré.' });
            }

            // Créer un nouvel utilisateur
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ email, password: hashedPassword, preferences });

            await user.save();

            // Générer un token JWT
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.json({ token });
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Erreur serveur.');
        }
    }
);

// Route Login
router.post(
    '/login',
    [
        check('email', 'Veuillez fournir un email valide').isEmail(),
        check('password', 'Le mot de passe est obligatoire').exists()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            // Vérifier si l'utilisateur existe
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(400).json({ message: 'Identifiants invalides.' });
            }

            // Vérifier le mot de passe
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Identifiants invalides.' });
            }

            // Générer un token JWT
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.json({ token });
        } catch (error) {
            console.error(error.message);
            res.status(500).send('Erreur serveur.');
        }
    }
);

// Endpoint pour réinitialiser le mot de passe
router.post('/reset-password', async (req, res) => {
    const { email } = req.body;
  
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur introuvable.' });
      }
  
      // Exemple de lien de réinitialisation (générer un token sécurisé ici)
      const resetToken = jwt.sign(
        { userId: user._id }, // Payload avec des données utilisateur
        process.env.JWT_SECRET, // Votre clé secrète pour JWT
        { expiresIn: '1h' } // Expiration du token
      );
      
      console.log('Token généré :', resetToken);
      const resetLink = `https://crousbuddy-frontend.com/reset-password?token=${resetToken}`;
  
      // Envoi de l'email
      await transporter.sendMail({
        from: '"CROUS Buddy" <crousbuddy@gmail.com>',
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Cliquez sur le lien suivant pour réinitialiser votre mot de passe : ${resetLink}`,
      });
  
      res.status(200).json({ message: 'Lien de réinitialisation envoyé par email.' });
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe :', error);
      res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
  });
  


export default router;
