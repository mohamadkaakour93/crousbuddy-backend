import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function authMiddleware(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('email preferences'); // Sélectionnez les champs nécessaires

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    req.user = user; // Ajoutez les informations utilisateur complètes à req.user
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide.' });
  }
}

