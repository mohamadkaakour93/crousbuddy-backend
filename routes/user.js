import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import scrapeWebsite from '../scrape.js';

const router = express.Router();

router.post('/search', async (req, res) => {
    const { city, occupationModes } = req.body;

    if (!city || !occupationModes) {
        return res.status(400).json({ message: 'Ville et mode d\'occupation requis.' });
    }

    try {
        const tempUser = {
            email: 'temp@user.com', // Simuler un utilisateur temporaire
            preferences: { city, occupationModes },
        };

        const results = await scrapeWebsite(tempUser);

        if (results.length > 0) {
            res.json({ message: `Nous avons trouvé ${results.length} logements !`, results });
        } else {
            res.status(404).json({ message: 'Aucun logement trouvé pour le moment.' });
        }
    } catch (error) {
        console.error('Erreur lors de la recherche :', error.message);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir les informations du profil utilisateur (GET /api/user/me)
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
