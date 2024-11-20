// scrape.js

import axios from 'axios';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';

// État individuel pour chaque utilisateur
const userStates = new Map();

// Cache pour les coordonnées des villes
const cityCache = new Map();

// Configuration SMTP (remplacez par vos propres informations)
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: 'votre_adresse_email@exemple.com', // Remplacez par votre adresse e-mail SMTP
    pass: 'votre_mot_de_passe',              // Remplacez par votre mot de passe SMTP
  },
});

// Fonction pour envoyer un e-mail
async function sendEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: '"CROUS Buddy" <crousbuddy@gmail.com>', // Remplacez par votre adresse e-mail d'envoi
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

  // Créez une instance Axios avec les en-têtes nécessaires
  const axiosInstance = axios.create({
    withCredentials: true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const { data } = await axiosInstance.get(url);

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

// Fonction principale pour le scraping
export async function scrapeWebsite(user) {
  const { email, preferences } = user;
  const { city, occupationModes } = preferences;

  if (!userStates.has(email)) {
    userStates.set(email, {
      notifiedLogements: new Set(),
      noLogementMailSent: false,
    });
  }

  const userState = userStates.get(email);

  async function performScrape() {
    try {
      const url = await generateCrousUrl(city, occupationModes);
      console.log(
        `[${new Date().toISOString()}] Lancement du scraping pour ${email} avec URL : ${url}`
      );

      // Utilisez l'instance Axios avec les en-têtes appropriés
      const axiosInstance = axios.create({
        withCredentials: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const { data } = await axiosInstance.get(url);
      const $ = cheerio.load(data);

      const logements = [];
      $('.fr-card').each((index, element) => {
        const title = $(element).find('.fr-card__title').text().trim();
        const link = `https://trouverunlogement.lescrous.fr${$(element)
          .find('a')
          .attr('href')}`;
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
${nouveauxLogements
  .map((l) => `- ${l.title}\nLien : ${l.link}`)
  .join('\n\n')}

Cordialement,
L'équipe CROUS Buddy
`;
        await sendEmail(email, 'Nouveaux logements trouvés', message);
        console.log(
          `E-mail envoyé à ${email} avec ${nouveauxLogements.length} logements.`
        );
      } else if (!userState.noLogementMailSent) {
        const noLogementMessage = `
Bonjour,

Actuellement, aucun logement correspondant à vos critères n'est disponible.
Nous continuerons à chercher et vous tiendrons informé dès qu’un logement sera trouvé.

Cordialement,
L'équipe CROUS Buddy
`;
        await sendEmail(email, 'Aucun logement disponible', noLogementMessage);
        userState.noLogementMailSent = true;
        console.log(`E-mail "aucun logement trouvé" envoyé à ${email}.`);
      }
    } catch (error) {
      console.error(`Erreur lors du scraping pour ${email} :`, error.message);
    }
  }

  // Lancer le scraping toutes les 5 minutes
  const intervalId = setInterval(async () => {
    await performScrape();
    // Vous pouvez ajuster cette logique selon vos besoins
  }, 300000); // 300000 ms = 5 minutes
}
