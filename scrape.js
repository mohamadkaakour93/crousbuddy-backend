import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import User from './models/User.js'; // Import du modèle User pour récupérer les infos par ID

// État des utilisateurs
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

// Fonction pour générer l'URL de recherche CROUS
async function generateCrousUrl(city, occupationModes) {
  const bounds = await getCityBounds(city);
  const params = new URLSearchParams();
  params.set('bounds', bounds);
  if (occupationModes) params.set('occupationModes', occupationModes);
  return `https://trouverunlogement.lescrous.fr/tools/37/search?${params.toString()}`;
}

// Scraper les logements pour un utilisateur
async function scrapeWebsite(user) {
  const { email, preferences } = user;
  const { city, occupationModes } = preferences;

  if (!userStates.has(email)) {
    userStates.set(email, {
      notifiedLogements: new Set(),
      noLogementMailSent: false,
      intervalId: null,
    });
  }

  const userState = userStates.get(email);

  const performScrape = async () => {
    try {
      const url = await generateCrousUrl(city, occupationModes);
      console.log(`[${new Date().toISOString()}] Scraping pour ${email} : ${url}`);

      const { data } = await axios.get(url);
      const $ = cheerio.load(data);

      const logements = [];
      $('.fr-card').each((index, element) => {
        const title = $(element).find('.fr-card__title').text().trim();
        const link = `https://trouverunlogement.lescrous.fr${$(element).find('a').attr('href')}`;
        logements.push({ title, link });
      });

      const nouveauxLogements = logements.filter(
        (logement) => !userState.notifiedLogements.has(logement.link)
      );

      if (nouveauxLogements.length > 0) {
        for (const logement of nouveauxLogements) {
          userState.notifiedLogements.add(logement.link);
        }

        const message = `
Bonjour,

Nous avons trouvé ${nouveauxLogements.length} nouveaux logements correspondant à vos critères :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Voici les détails :
${nouveauxLogements.map((l) => `- ${l.title}\nLien : ${l.link}`).join('\n\n')}

Cordialement,
L'équipe CROUS Buddy
`;
        await sendEmail(email, 'Nouveaux logements trouvés', message);
        console.log(`Logements trouvés pour ${email}. Notification envoyée.`);

        clearInterval(userState.intervalId); // Arrêter le scraping
        userStates.delete(email);
      } else if (!userState.noLogementMailSent) {
        const noLogementMessage = `
Bonjour,

Aucun logement correspondant à vos critères n'est disponible pour le moment.
Nous continuons à chercher pour vous. Vous serez notifié dès qu’un logement sera trouvé.

Cordialement,
L'équipe CROUS Buddy
`;
        await sendEmail(email, 'Aucun logement disponible', noLogementMessage);
        userState.noLogementMailSent = true;
        console.log(`Notification "aucun logement" envoyée à ${email}.`);
      } else {
        console.log(`Aucun logement trouvé pour ${email}. Recherche toujours en cours.`);
      }
    } catch (error) {
      console.error(`Erreur lors du scraping pour ${email} :`, error.message);
    }
  };

  userState.intervalId = setInterval(performScrape, 15000); // 1 minute
}

// Fonction pour gérer un utilisateur depuis la base de données
export async function handleUserSearch(userId) {
  try {
    const user = await User.findById(userId).select('email preferences');
    if (!user) throw new Error("Utilisateur introuvable");

    // Lancer le scraping pour cet utilisateur
    scrapeWebsite(user);
    console.log(`Scraping lancé pour ${user.email}`);
  } catch (error) {
    console.error(`Erreur lors du traitement de l'utilisateur ${userId} :`, error.message);
  }
}
