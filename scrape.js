import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import User from "./models/User.js";

// États séparés pour chaque utilisateur
const userStates = new Map();
const cityCache = new Map(); // Cache pour les coordonnées des villes

// Configuration SMTP
const transporter = nodemailer.createTransport({
host: 'smtp-relay.brevo.com',
port: 587,
secure: false,
auth: {
user: '804025002@smtp-brevo.com',
pass: 'q4mj6RNO507thbTW'
}
});

// Fonction pour envoyer un e-mail
async function sendEmail(to, subject, text) {
try {
const info = await transporter.sendMail({
from: '"CROUS Buddy" <crousbuddy@gmail.com>',
to,
subject,
text
});
console.log(`E-mail envoyé avec succès à ${to} :`, info.response);
} catch (error) {
console.error('Erreur lors de l\'envoi de l\'e-mail :', error.message);
}
}

// Fonction pour obtenir les coordonnées d'une ville
async function getCityBounds(city) {
if (cityCache.has(city)) return cityCache.get(city);

try {
const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
const { data } = await axios.get(url, {
headers: { 'User-Agent': 'CROUS Buddy/1.0 (crousbuddy@gmail.com)' }
});

if (data.length === 0) throw new Error(`Ville introuvable : ${city}`);

const { boundingbox } = data[0];
const bounds = `${boundingbox[2]}_${boundingbox[1]}_${boundingbox[3]}_${boundingbox[0]}`;
cityCache.set(city, bounds);
return bounds;
} catch (error) {
console.error(`Erreur lors de la récupération des bounds pour ${city} :`, error.message);
throw error;
}
}

// Fonction pour générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
const bounds = await getCityBounds(city);
const baseUrl = 'https://trouverunlogement.lescrous.fr/tools/37/search?';
const params = new URLSearchParams();

params.set('bounds', bounds);
if (occupationModes) params.set('occupationModes', occupationModes);

return baseUrl + params.toString();
}

// Fonction principale de scraping
async function scrapeWebsite(user) {
const { email, preferences } = user;
const { city, occupationModes } = preferences;

if (!userStates.has(email)) {
userStates.set(email, {
notifiedLogements: new Set(),
isBlocked: false, // Indique si cet utilisateur ne doit plus recevoir de notifications
noLogementMailSent: false // Indique si l'e-mail "aucun logement trouvé" a été envoyé
});
}

const userState = userStates.get(email);

// Si l'utilisateur est bloqué, ignorer cette recherche
if (userState.isBlocked) {
console.log(`Utilisateur ${email} est bloqué. Aucune recherche effectuée.`);
return;
}

try {
const url = await generateCrousUrl(city, occupationModes);
console.log(`[${new Date().toISOString()}] Lancement du scraping pour ${email} avec ${url}`);

const { data } = await axios.get(url);
const $ = cheerio.load(data);

const baseUrl = 'https://trouverunlogement.lescrous.fr';
const logements = [];
$('.fr-card').each((index, element) => {
const title = $(element).find('.fr-card__title').text().trim();
const link = baseUrl + $(element).find('a').attr('href');
logements.push({ title, link });
});

const logementsTrouves = logements.filter(
(logement) => !userState.notifiedLogements.has(logement.link)
);

if (logementsTrouves.length > 0) {
logementsTrouves.forEach((logement) =>
userState.notifiedLogements.add(logement.link)
);

const message = `
Bonjour,

Merci pour votre confiance en CROUS Buddy.

Voici les résultats pour votre recherche :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Nous avons trouvé ${logementsTrouves.length} nouveaux logements correspondant à vos critères :

${logementsTrouves.map((l) => `- ${l.title}\nLien : ${l.link}`).join('\n\n')}

Cordialement, 
L'équipe CROUS Buddy
`;
await sendEmail(email, 'Nouveaux logements trouvés', message);
console.log(`E-mail envoyé à ${email} avec ${logementsTrouves.length} logements.`);

// Bloquer l'utilisateur après avoir envoyé un e-mail de succès
userState.isBlocked = true;
userState.noLogementMailSent = false; // Réinitialiser l'état pour "aucun logement"
console.log(`Utilisateur ${email} bloqué après l'envoi d'un e-mail de succès.`);
} else if (!userState.noLogementMailSent) {
// Aucun logement trouvé, envoyer une seule fois
const noLogementMessage = `
Bonjour,

Merci pour votre confiance en CROUS Buddy.

Voici les résultats pour votre recherche :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Actuellement, aucun logement correspondant à vos critères n'est disponible. 
Nous continuerons à surveiller les disponibilités et vous tiendrons informé dès qu’un logement sera trouvé.

Cordialement, 
L'équipe CROUS Buddy
`;
await sendEmail(email, 'Pas de logement disponible pour l\'instant', noLogementMessage);
userState.noLogementMailSent = true; // Marquer comme envoyé
console.log(`E-mail envoyé à ${email} : Aucun logement disponible.`);
} else {
console.log(`Aucun logement trouvé pour ${email}. Nouvelle tentative dans 5 minutes.`);
}
} catch (error) {
console.error(`Erreur lors du scraping pour ${email} :`, error.message);
}
}

// Boucle de recherche continue pour chaque utilisateur
async function startSearchLoop(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, { noLogementMailSent: false }); // Initialiser l'état de l'utilisateur
  }

  let logementTrouve = false;
  while (!logementTrouve) {
    logementTrouve = await scrapeWebsite(userId);
    if (!logementTrouve) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // Attendre 30 secondes avant de relancer
    }
  }
  console.log(`Recherche terminée pour l'utilisateur avec l'ID ${userId}.`);
}

// Fonction pour gérer les utilisateurs en parallèle
export function addUserToSearch(userId) {
  console.log(`Lancement de la recherche automatique pour l'utilisateur avec l'ID ${userId}.`);
  startSearchLoop(userId); // Démarrer une recherche continue pour cet utilisateur
}
