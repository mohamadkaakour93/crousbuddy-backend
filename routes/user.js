import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import {authMiddleware} from '../middleware/auth.js';
import { scrapeWebsite } from '../scrape.js';
import { addUserToQueue } from '../scrape.js';

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

router.post('/search', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.id; // ID de l'utilisateur connecté
      const user = await User.findById(userId);
  
      if (!user) {
        return res.status(404).json({ message: 'Utilisateur non trouvé.' });
      }
  
      const { city, occupationModes } = req.body;
  
      if (!city || !occupationModes) {
        return res.status(400).json({
          message: "Les champs 'city' et 'occupationModes' sont obligatoires.",
        });
      }
  
      // Mettre à jour les préférences de l'utilisateur dans la base
      user.preferences.city = city;
      user.preferences.occupationModes = occupationModes;
      await user.save();
  
      // Créer un objet utilisateur pour le scraping
      const userPreferences = {
        email: user.email,
        preferences: {
          city: user.preferences.city,
          occupationModes: user.preferences.occupationModes,
        },
      };
  
      // Ajouter immédiatement à la file d'attente
      /*try {
        addUserToQueue(userPreferences);
      } catch (queueError) {
        console.error(`Erreur lors de l'ajout de l'utilisateur à la file d'attente : ${queueError.message}`);
        return res.status(500).json({
          message: 'Erreur lors de l’ajout de la recherche à la file d’attente.',
        });
      }*/
  
      // Lancer immédiatement le scraping
      try {
        const logements = await scrapeWebsite(userPreferences);
        if (logements.length > 0) {
          return res.status(200).json({
            message: `Nous avons trouvé ${logements.length} nouveaux logements. Vous recevrez un e-mail avec les détails.`,
            logements,
          });
        } else {
          return res.status(200).json({
            message: 'Aucun logement trouvé pour le moment. Nous continuerons à chercher pour vous.',
          });
        }
      } catch (scrapeError) {
        console.error(`Erreur lors du scraping initial : ${scrapeError.message}`);
        return res.status(500).json({
          message: 'Erreur lors du lancement initial de la recherche.',
        });
      }
    } catch (error) {
      console.error('Erreur générale lors de la recherche :', error.message);
      return res.status(500).json({
        message: 'Erreur serveur lors de la recherche.',
      });
    }
  });
  

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Erreur lors de la récupération du profil utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Mettre à jour le profil utilisateur (PUT /api/user/me)
router.put('/me', authMiddleware, async (req, res) => {
    const { email, preferences } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        // Mettre à jour les champs autorisés
        if (email) user.email = email;
        if (preferences) {
            user.preferences = {
                city: preferences.city || user.preferences.city,
                occupationModes: preferences.occupationModes || user.preferences.occupationModes,
            };
        }

        await user.save();
        res.status(200).json({ message: 'Profil mis à jour avec succès.', user });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
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
