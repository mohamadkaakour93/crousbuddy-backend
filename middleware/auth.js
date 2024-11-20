import jwt from 'jsonwebtoken';

export default function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    console.log('Authorization Header:', authHeader);

    if (!authHeader) {
        return res.status(401).json({ message: 'Accès refusé. Aucun token fourni.' });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ message: 'Token manquant. Accès non autorisé.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Vérifie et décode le token
        req.user = decoded; // Stocke les données dans req.user
        console.log('req.user:', req.user);
        next();
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error.message);
        res.status(401).json({ message: 'Token invalide.' });
    }
}
