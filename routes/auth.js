import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { check, validationResult } from 'express-validator';
import nodemailer from "nodemailer";
import User from '../models/User.js';

const router = express.Router();



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

router.post('/auth/send-reset-password-email', async (req, res) => {
    const { email } = req.body;
  
    try {
      // Vérifier si l'utilisateur existe
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
      }
  
      // Générer un token de réinitialisation
      const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: '1h', // Token valide pour 1 heure
      });
  
      // Construire le lien de réinitialisation
      const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
      // Envoyer l'e-mail
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: '804025002@smtp-brevo.com',
          pass: 'q4mj6RNO507thbTW',
        },
      });
  
      const mailOptions = {
        from: '"CROUS Buddy" <crousbuddy@gmail.com>',
        to: email,
        subject: 'Réinitialisation du mot de passe',
        text: `Bonjour,\n\nCliquez sur le lien suivant pour réinitialiser votre mot de passe :\n${resetLink}\n\nCe lien est valide pendant 1 heure.\n\nCordialement,\nL'équipe CROUS Buddy`,
      };
  
      await transporter.sendMail(mailOptions);
  
      res.json({ message: 'E-mail de réinitialisation envoyé avec succès.' });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'e-mail de réinitialisation :', error.message);
      res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'e-mail.' });
    }
  }); 

  router.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
  
    try {
      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
  
      // Trouver l'utilisateur
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable." });
      }
  
      // Mettre à jour le mot de passe
      user.password = await bcrypt.hash(newPassword, 10); // Hasher le nouveau mot de passe
      await user.save();
  
      res.json({ message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
      console.error('Erreur lors de la réinitialisation du mot de passe :', error.message);
      res.status(400).json({ message: 'Token invalide ou expiré.' });
    }
  });
  




export default router;
