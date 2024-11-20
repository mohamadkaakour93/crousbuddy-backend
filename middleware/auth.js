// middleware/auth.js

import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  console.log('Headers reçus :', req.headers);

  let token = req.header('x-auth-token');
  console.log('Token initial depuis x-auth-token:', token);

  if (!token) {
    const authHeader = req.header('Authorization');
    console.log('Header Authorization:', authHeader);

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Token extrait depuis Authorization:', token);
    }
  }

  if (!token) {
    console.log('Aucun token trouvé');
    return res.status(401).json({ message: 'Token manquant. Accès non autorisé.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'votre_clé_secrète_par_défaut';
    const decoded = jwt.verify(token, jwtSecret);
    console.log('Token décodé:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Erreur lors de la vérification du token :', err);
    res.status(401).json({ message: 'Token invalide.' });
  }
};

export default authMiddleware;
