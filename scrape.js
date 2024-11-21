import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import User from './models/User.js'; // Assurez-vous que le modèle User est correctement défini et importé

// États pour chaque utilisateur connecté
const userStates = new Map();
const cityCache = new Map();

// Configuration SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: '804025002@smtp-brevo.com',
    pass: 'q4mj6RNO507thbTW',
  },
});

// Fonction pour envoyer un e-mail
async function sendEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: '"CROUS Buddy" <crousbuddy@gmail.com>',
      to,
      subject,
      text,
    });
    console.log(`E-mail envoyé avec succès à ${to} :`, info.response);
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error.message);
  }
}

// Fonction pour obtenir les coordonnées d'une ville
async function getCityBounds(city) {
  if (cityCache.has(city)) return cityCache.get(city);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'CROUS Buddy/1.0 (crousbuddy@gmail.com)' },
  });

  if (data.length === 0) throw new Error(`Ville introuvable : ${city}`);

  const { boundingbox } = data[0];
  const bounds = `${boundingbox[2]}_${boundingbox[1]}_${boundingbox[3]}_${boundingbox[0]}`;
  cityCache.set(city, bounds);
  return bounds;
}

// Générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
  const bounds = await getCityBounds(city);
  const params = new URLSearchParams();
  params.set('bounds', bounds);
  if (occupationModes) params.set('occupationModes', occupationModes);
  return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Fonction principale de scraping
export async function scrapeWebsite(userId) {
  try {
    // Récupérer l'utilisateur depuis MongoDB
    const user = await User.findById(userId).select('email preferences');
    if (!user) {
      console.error(`Utilisateur avec l'ID ${userId} introuvable.`);
      return;
    }

    const { email, preferences } = user;
    const { city, occupationModes } = preferences;

    if (!userStates.has(email)) {
      userStates.set(email, {
        notifiedLogements: new Set(),
        isBlocked: false,
        noLogementMailSent: false,
      });
    }

    const userState = userStates.get(email);

    // Si l'utilisateur est bloqué, ignorer cette recherche
    if (userState.isBlocked) {
      console.log(`Utilisateur ${email} est bloqué. Aucune recherche effectuée.`);
      return;
    }

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

Nous avons trouvé ${logementsTrouves.length} nouveaux logements correspondant à vos critères :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Voici les détails :
${logementsTrouves.map((l) => `- ${l.title}\nLien : ${l.link}`).join('\n\n')}

Cordialement,
L'équipe CROUS Buddy
`;
      await sendEmail(email, 'Nouveaux logements trouvés', message);
      console.log(`E-mail envoyé à ${email} avec ${logementsTrouves.length} logements.`);

      userState.isBlocked = true;
      userState.noLogementMailSent = false;
    } else if (!userState.noLogementMailSent) {
      const noLogementMessage = `
Bonjour,

Aucun logement correspondant à vos critères n'est disponible pour le moment.
Nous continuerons à chercher pour vous et vous serez notifié dès qu’un logement sera trouvé.

Cordialement,
L'équipe CROUS Buddy
`;
      await sendEmail(email, 'Aucun logement disponible', noLogementMessage);
      userState.noLogementMailSent = true;
      console.log(`E-mail "aucun logement" envoyé à ${email}.`);
    } else {
      console.log(`Aucun logement trouvé pour ${email}. Recherche toujours en cours.`);
    }
  } catch (error) {
    console.error(`Erreur lors du scraping pour l'utilisateur avec l'ID ${userId} :`, error.message);
  }
}
setInterval(() => processUsers(user), 30000);