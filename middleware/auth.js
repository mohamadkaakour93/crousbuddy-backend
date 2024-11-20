import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  // Essayer d'obtenir le token depuis le header 'x-auth-token'
  let token = req.header('x-auth-token');

  // Si le token n'est pas présent, essayer de le récupérer depuis 'Authorization'
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Supprime 'Bearer ' pour obtenir le token
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Aucun token, autorisation refusée.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'votre_clé_secrète_par_défaut';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Erreur lors de la vérification du token :', err);
    res.status(401).json({ message: 'Token invalide.' });
  }
};

export default authMiddleware;
