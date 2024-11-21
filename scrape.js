import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import pLimit from 'p-limit';

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

// État global pour la file d'attente
const userQueue = [];
const userStates = new Map();
const cityCache = new Map();

// Limitation de concurrence
const limit = pLimit(5); // Limite à 5 utilisateurs en parallèle

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

// Fonction pour effectuer le scraping
async function performScrape(user) {
  const { email, preferences } = user;
  const { city, occupationModes } = preferences;

  if (!userStates.has(email)) {
    userStates.set(email, {
      notifiedLogements: new Set(),
      noLogementMailSent: false,
    });
  }

  const userState = userStates.get(email);

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
      for (const logement of nouveauxLogements)
        userState.notifiedLogements.add(logement.link);

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
}

// Fonction pour ajouter un utilisateur à la file d'attente
export function scrapeWebsite(user) {
  userQueue.push(user);
  console.log(`Utilisateur ${user.email} ajouté à la file d'attente.`);
}

// Fonction pour traiter la file d'attente
async function processQueue() {
  if (userQueue.length === 0) {
    console.log('La file d\'attente est vide.');
    return;
  }

  console.log(`Traitement de la file d'attente : ${userQueue.length} utilisateur(s) en attente.`);
  await Promise.all(userQueue.map((user) => limit(() => performScrape(user))));

  // Une fois le traitement terminé, vide la queue
  userQueue.length = 0;
}

// Lancer un intervalle pour traiter la file d'attente toutes les 30 secondes
setInterval(processQueue, 30000);
