// middleware/auth.js

import jwt from 'jsonwebtoken';
// import config from 'config'; // Supprimé

const authMiddleware = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ message: 'Aucun token, autorisation refusée.' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'votre_clé_secrète_par_défaut';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalide.' });
  }
};

export default authMiddleware;
