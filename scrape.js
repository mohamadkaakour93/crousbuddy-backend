const cityCache = new Map([
  ["Paris", "2.224122_48.902156_2.4697602_48.8155755"],
  ["Montpellier", "3.8070597_43.6533542_3.9413208_43.5667088"],
  ["Pau", "0.3925513_43.3580393_-0.2943049_43.2857792"],
  ["Lyon", "4.7718134_45.8082628_4.8983774_45.7073666"],
  ["Marseille", "5.2286902_43.3910329_5.5324758_43.1696205"],
  ["Grenoble", "5.6776059_45.2140762_5.7531176_45.1541442"],
  ["Nice", "7.1819535_43.7607635_7.323912_43.6454189"]

]);


import axios from "axios";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import User from "./models/User.js";

// États pour chaque utilisateur (stockage temporaire)
const userStates = new Map();

// Configuration SMTP pour envoyer des e-mails
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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

// Fonction pour obtenir les coordonnées (bounds) d'une ville
async function getCityBounds(city) {
  if (cityCache.has(city)){
    return cityCache.get(city);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "CROUS Buddy/1.0 (crousbuddy@gmail.com)" },
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
  params.set("bounds", bounds);
  if (occupationModes) params.set("occupationModes", occupationModes);
  return baseUrl + params.toString();
}

// Fonction principale de scraping
async function scrapeWebsite(userId) {
  try {
    // Récupérer l'utilisateur à partir de la base de données
    const user = await User.findById(userId).select("email preferences");
    if (!user) {
      console.error(`Utilisateur avec l'ID ${userId} introuvable.`);
      return false;
    }

    const { email, preferences } = user;
    const { city, occupationModes } = preferences;

    // Générer l'URL de recherche
    const url = await generateCrousUrl(city, occupationModes);
    console.log(`[${new Date().toISOString()}] Scraping pour ${email} : ${url}`);

    // Effectuer le scraping
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const baseUrl = "https://trouverunlogement.lescrous.fr";

    const logements = [];
    $(".fr-card").each((index, element) => {
      const title = $(element).find(".fr-card__title").text().trim();
      const link = baseUrl + $(element).find("a").attr("href");
      logements.push({ title, link });
    });

    const userState = userStates.get(userId) || { notifiedLogements: new Set(), noLogementMailSent: false };
    const logementsTrouves = logements.filter(
      (logement) => !userState.notifiedLogements.has(logement.link)
    );

    if (logementsTrouves.length > 0) {
      logementsTrouves.forEach((logement) => userState.notifiedLogements.add(logement.link));
      const message = `
Bonjour,

Nous avons trouvé ${logementsTrouves.length} nouveaux logements correspondant à vos critères :
- Ville : ${city}
- Mode d'occupation : ${occupationModes}

Voici les détails :
${logementsTrouves.map((l) => `- ${l.title}\nLien : ${l.link}`).join("\n\n")}

Cordialement,
L'équipe CROUS Buddy
      `;
      await sendEmail(email, "Nouveaux logements trouvés", message);
      console.log(`Logements trouvés pour ${email}. Notification envoyée.`);
      userStates.set(userId, userState);
      return true; // Recherche terminée pour cet utilisateur
    } else if (!userState.noLogementMailSent) {
      const noLogementMessage = `
Bonjour,

Actuellement, aucun logement correspondant à vos critères n'est disponible.
Nous continuerons à chercher et vous tiendrons informé dès qu’un logement sera trouvé.

Cordialement,
L'équipe CROUS Buddy
      `;
      await sendEmail(email, "Aucun logement disponible", noLogementMessage);
      userState.noLogementMailSent = true;
      userStates.set(userId, userState);
      console.log(`Notification "aucun logement" envoyée à ${email}.`);
    }

    console.log(`Aucun logement trouvé pour ${email}. Nouvelle tentative dans 30 secondes.`);
    return false;
  } catch (error) {
    console.error(`Erreur lors du scraping pour l'utilisateur avec l'ID ${userId} :`, error.message);
    return false;
  }
}

// Boucle de recherche continue pour chaque utilisateur
async function startSearchLoop(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, { notifiedLogements: new Set(), noLogementMailSent: false });
  }

  let logementTrouve = false;
  while (!logementTrouve) {
    logementTrouve = await scrapeWebsite(userId);
    if (!logementTrouve) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }
  console.log(`Recherche terminée pour l'utilisateur avec l'ID ${userId}.`);
  userStates.delete(userId); // Nettoyage de l'état utilisateur
}




// Fonction pour gérer les utilisateurs en parallèle
export function addUserToSearch(userId) {
  console.log(`Lancement de la recherche automatique pour l'utilisateur avec l'ID ${userId}.`);
  startSearchLoop(userId);
}
