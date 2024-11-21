import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { addUserToQueue } from '../scrape.js';
import {authMiddleware} from '../middleware/auth.js';


const router = express.Router();

/*router.post('/search', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id; // ID de l'utilisateur connecté récupéré depuis le middleware
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
  
      const { city, occupationModes } = req.body;
  
      // Vérification des paramètres
      if (!city || !occupationModes) {
        return res.status(400).json({
          message: "Les champs 'city' et 'occupationModes' sont obligatoires.",
        });
      }
  
      // Mise à jour des préférences de l'utilisateur dans la base
      user.preferences.city = city;
      user.preferences.occupationModes = occupationModes;
      await user.save();
  
      // Déclenchement du scraping pour cet utilisateur
      scrapeWebsite({
        email: user.email,
        preferences: {
          city: user.preferences.city,
          occupationModes: user.preferences.occupationModes,
        },
      });
  
      return res.status(200).json({
        message: "La recherche a été lancée. Vous recevrez un e-mail dès qu’un logement sera trouvé.",
      });
    } catch (error) {
      console.error('Erreur lors du lancement de la recherche :', error.message);
      return res.status(500).json({
        message: "Erreur serveur lors de la recherche.",
      });
    }
  });*/ 
router.post("/search", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé." });
      }
  
      const { city, occupationModes } = req.body;
  
      if (!city || !occupationModes) {
        return res.status(400).json({
          message: "Les champs 'city' et 'occupationModes' sont obligatoires.",
        });
      }
  
      user.preferences.city = city;
      user.preferences.occupationModes = occupationModes;
      await user.save();
  
      addUserToQueue({
        email: user.email,
        preferences: {
          city: user.preferences.city,
          occupationModes: user.preferences.occupationModes,
        },
      });
  
      res.status(200).json({
        message:
          "La recherche a été lancée. Vous recevrez un e-mail dès qu’un logement sera trouvé.",
      });
    } catch (error) {
      console.error("Erreur lors du lancement de la recherche :", error.message);
      res.status(500).json({ message: "Erreur serveur lors de la recherche." });
    }
  });

// Supprimer le profil utilisateur (DELETE /api/user/me)
router.delete('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du profil utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

export default router;
