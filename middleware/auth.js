import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization']; // Récupère l'en-tête Authorization

    if (!authHeader) {
        return res.status(401).json({ message: 'Accès refusé. Aucun jeton fourni.' });
    }

    const token = authHeader.split(' ')[1]; // Supprime "Bearer" et récupère uniquement le token

    if (!token) {
        return res.status(401).json({ message: 'Token manquant. Accès non autorisé.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Vérifie et décode le token
        req.user = decoded; // Stocke les données du token dans req.user
        next();
    } catch (error) {
        console.error('Erreur JWT:', error);
        res.status(401).json({ message: 'Token invalide.' });
    }
};

export default authMiddleware;
