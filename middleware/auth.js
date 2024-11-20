import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization']; // Récupère l'en-tête Authorization
    console.log('Authorization Header:', authHeader);

    if (!authHeader) {
        return res.status(401).json({ message: 'Accès refusé. Aucun token fourni.' });
    }

    // Vérifie si l'en-tête commence par 'Bearer' et extrait le token
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ message: 'Token manquant. Accès non autorisé.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Vérifie et décode le token
        req.user = decoded; // Stocke les données du token dans req.user
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalide.' });
    }
}
